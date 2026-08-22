import { hashSeed, RNG } from '../core/rng'
import { ENEMY_TYPES, modKey } from './enemies'
import type { SpawnEvent, WaveDef } from '../types'

export type EncounterKind = 'normal' | 'elite' | 'boss'

const clampTier = (n: number) => Math.max(1, Math.min(4, n))

/**
 * ---------------------------------------------------------------------------
 * The encounter model: a BUDGET, spent on a ROSTER, inside a WINDOW.
 * ---------------------------------------------------------------------------
 *
 * The old generator multiplied four independent difficulty axes together and
 * called the product a curve. Depth and kind each bumped the enemy *tier*, the
 * head *count*, the flat `hpMult` and the spawn *gap*, so an elite node landed
 * at roughly the cube of the step it looked like. Measured raw HP pool by
 * depth was 168 / 633 / 1426 / **15497** / 5905 / 9272 / 22241 / **87590** /
 * 43867 / **8760** — the depth-4 elite was 11× the node before it, the depth-5
 * node after it was *half* the elite, and "The Final Watch" was a fifth of the
 * wave immediately preceding it. Two spikes with relief valleys behind them
 * and a boss that was the easiest node in the back half is not a difficulty
 * curve, and the balance harness measured exactly that: 78% of all lost Monte
 * Carlo runs ended on depth 8, 76% of all fresh runs ended on depth 4, and the
 * boss killed 0 of the 100 teams that reached it.
 *
 * Worse, the spikes were partly made of *wall clock*. A depth-8 elite spawned
 * 46 enemies over 36 seconds, and the slowest of them (a Siege Barrel at
 * 34px/s on a 2290px path) needed another 67 to walk the lane. Every single
 * Monte Carlo loss — 50 of 50 — was the wave running out of time, not the base
 * falling. The game's difficulty was literally how long a wave took.
 *
 * So the axes are separated and each is given one job:
 *
 *  - **Budget** ({@link waveBudget}) is the difficulty dial: the raw HP pool a
 *    node may spend, before the run's Threat multiplier. Smooth and monotone
 *    in depth, by construction.
 *  - **Head count** ({@link headcount}) is designed, not derived, because it
 *    decides *which way* a wave kills you. Solving it from the budget produced
 *    30-enemy waves carrying a ×23 multiplier — a Torch Berserker with 9,000
 *    effective HP — which nothing leaked past, because a blocking Sentinel
 *    simply held the queue while the clock ran out. Designing the count and
 *    solving the *multiplier* puts the pressure back on the base.
 *  - **Roster** is *shape*: which factions and tiers turn up. Tier decides
 *    armour, speed, melee damage and leak-on-arrival — what kind of problem
 *    the wave is — never how big it is.
 *  - **Window** is pacing. It grows slowly and caps, so late waves get
 *    *denser*, never longer.
 *
 * Kinds are then **rule changes rather than multipliers**. An elite inverts the
 * faction mix into an armour column and, from the mid-game on, fields a
 * champion; a boss is mostly champions with a thin escort. Both ask a question
 * a swarm does not — can you get through armour, and do you have single-target
 * burst — instead of asking the same question three times as loudly.
 */

/** Raw HP pool for a depth-1 node. A brand-new level-1 hero must clear this. */
const BUDGET_BASE = 170
/** Step between consecutive depths at the start of a run… */
const BUDGET_RATIO_TOP = 2.7
/**
 * …and the step it decays toward, once the player's own power curve flattens.
 *
 * 1.30 → **1.44** (F-M1). The player's curve does *not* flatten where this
 * assumed it did: by depth 5 a run has hired two or three bodies, is buying
 * upgrade levels out of node gold and trades up a gear slot most nodes, so a
 * step of 1.30–1.35 through the back half meant nodes 5–9 stopped asking
 * anything and the boss carried the entire second act on its own. Both gated
 * models said so in the same shape — §6 ended **65%** of all lost runs on the
 * boss (ceiling 60%), and the fresh run's worst node was the boss as well.
 *
 * The answer is not a bigger boss (see {@link BOSS_STEP}, which moved the other
 * way) but a back half that climbs with the player. Measured at n=200 a cell:
 * §6's deadliest node moves off the boss to depth 8 at **54%**, boss kills 41%
 * → 29% (target ≥10%), §6 win 49% → 48% (band 45–60%), and the fresh
 * first-timer run 35% → 30% (band 15–35%).
 */
const BUDGET_RATIO_FLOOR = 1.44
/** How fast the step decays from TOP to FLOOR (per depth). */
const BUDGET_RATIO_DECAY = 0.8

/**
 * An elite spends **less** HP budget than a normal node at its depth.
 *
 * The first correction was to stop an elite multiplying tier AND head count AND
 * `hpMult` AND spawn rate at once — the depth-4 elite used to come out at 11×
 * the node before it, so the budget was set equal to a normal node's. That fixed
 * the spike but not the shape: the harness kept measuring the elite carrying the
 * whole campaign on its own, with 47–64% of every lost Monte Carlo run ending on
 * depth 8, the second elite, no matter what else was tuned.
 *
 * An elite is *already* a rule change on four axes — an armour column instead of
 * a swarm, a tier-above vanguard rank, a champion from depth 6 on, and a window
 * compressed to 0.85 — and the run charges ×1.52 Threat for clearing one instead
 * of ×1.42. Paying full budget on top of all four made it the hidden wall of the
 * run. At 0.80 the elite is a *different* fight rather than a bigger one, and the
 * difficulty it was hoarding moves onto the boss ({@link BOSS_STEP}), which is
 * where a campaign's final exam belongs. The two changes are deliberately paid
 * for out of each other: the elite gives up 20% of its budget and the boss takes
 * 18% more, so the campaign's total HP pool is within a percent of where it was
 * and only its *distribution* has moved. Measured: the deadliest single Monte
 * Carlo node fell from 49% of all losses to 42%, and boss kills rose from 30% to
 * 36% of arrivals while the win rate stayed at 50%.
 */
const ELITE_BUDGET = 0.8
/**
 * …and the variant it fields prices itself on top of this (WS8): the three
 * elite shapes carry `budgetScale` 1.03 / 1.25 / 0.96, so a Warded Host — a
 * bomber host whose armour is a magic ward rather than plate — is sold ~30%
 * more HP than a Swift Raid of the same nominal budget, because measured
 * against random depth-8 lines it puts ~35% less through the base per point.
 * `ELITE_BUDGET` remains what an elite costs *as a kind*; the scale is what a
 * particular shape is worth. See §14c of the balance report.
 *
 * **The ratio is capped by §14b, not by §14c.** Equalising the three shapes'
 * measured leak exactly would need a scale ratio of about ×1.5 (the fit is
 * recorded on {@link ELITE_VARIANTS} below), and §14b's 35% ceiling on total-HP
 * spread forbids anything past ×1.35 — a "fair" price list that sold one column
 * half again the HP pool of another would be a difficulty roll wearing a price
 * tag, which is the exact failure that ceiling exists to catch. So the scales
 * are fitted to ×1.30 and the residual is reported rather than hidden: §14c
 * measures ×1.54 against its ×2.00 ceiling.
 */
/** …and it arrives faster, which is the rest of the difference. */
const ELITE_WINDOW = 0.85
/** From this depth on, an elite fields a champion of its own. */
const ELITE_CHAMPION_DEPTH = 6
/**
 * From this depth on, even an ORDINARY node is led by a champion — the horde
 * has stopped sending patrols. It is also what stops the campaign's difficulty
 * from living entirely in its two elite nodes and its boss: a champion is a
 * single-target check, and a run needs more than one node that asks it.
 */
const NORMAL_CHAMPION_DEPTH = 7
/** Share of an elite's budget its champion carries. */
const ELITE_CHAMPION_SHARE = 0.08
/** …and of a deep normal node's, where the champion is a lone herald. */
const NORMAL_CHAMPION_SHARE = 0.22

/**
 * A boss is measured against the node BEFORE it, not against its own depth.
 *
 * That is the only framing that makes the Endless Watch work: round 10 is a
 * boss at depth 12 and round 9 a normal wave at depth 11, so quoting the boss
 * budget off `waveBudget(depth - 1)` makes every boss round exactly this much
 * harder than the round it follows — which is the whole of H7. The old boss
 * did not scale at all: round 30's "boss" was an order of magnitude weaker
 * than round 29's normal wave while paying a full heal, bonus dust and triple
 * loot.
 *
 * The factor is below 1 on purpose. A boss node's step up is its **Threat**
 * step (clearing the node before it multiplies Threat by 1.42) plus its three
 * champions, which take 45% of the budget and concentrate it into single
 * entities carrying 11–22 leak apiece. HP in that shape is worth far more per
 * point than the same HP spread across a swarm, so quoting the boss at a
 * *premium* on top made it a wall: the standard Monte Carlo team lost 87% of
 * its runs there and the other nine nodes went back to contributing nothing.
 *
 * 0.66 → **0.78** (M19-e2), paid for by the elite relief above. At 0.66 the boss
 * was the *easiest* thing a zero-meta run met all game: §11 measured it killing
 * 2 of the 44 fresh runs that reached it — 4.5% — while §6's design target for
 * the same node is ≥10% of arrivals. A final node that only threatens teams
 * arriving under ×26 Threat is not a final exam, it is a formality for anyone
 * who routed well. At 0.78 it kills 36% of Monte Carlo arrivals and is the
 * biggest single step on the fresh-player curve.
 *
 * It does not go higher, and the reason is worth recording: the boss budget is
 * multiplied by the run's Threat, and a run that fought all ten nodes arrives
 * carrying ×26 while a well-routed one arrives carrying ×7. Every rung above
 * 0.78 therefore lands ~3.7× harder on §6 than on §11 — at 0.86 the boss ended
 * 74% of all Monte Carlo losses, blowing the 60% concentration ceiling, while
 * the fresh win rate had already stopped moving.
 *
 * 0.58 → **0.515** (WS8), and this one is bookkeeping between two nodes rather
 * than a change to the campaign's total. Composition variants made the elite
 * nodes *different* fights, and three of the six new shapes turned out to be
 * worth materially less per point of HP than the shape they replaced — so more
 * teams survived depths 7–9 and arrived at the boss, and the boss's share of
 * all Monte Carlo losses went to **67%**, past the 60% concentration ceiling,
 * without the boss itself changing at all. Two dials moved together and in
 * opposite directions: the elite variants' `budgetScale` went up (0.88/0.92/0.82
 * → 1.01/1.21/0.935, since refitted to 1.03/1.25/0.96 against the same bench
 * when the mixes were rebuilt) and the boss step came down, so the back half climbs again
 * and the final node stops being the only thing in it. Measured at n=300:
 * deaths spread 7:13 / 8:54 / 9:6 / 10:78, deadliest node 10 at **48%**, boss
 * kills 33% of arrivals, §6 win 50%.
 *
 * 0.78 → **0.58** (F-M1), and this is a *step* change, not a nerf. The boss is
 * quoted off `waveBudget(depth - 1)`, and raising {@link BUDGET_RATIO_FLOOR}
 * from 1.30 to 1.44 raised `waveBudget(9)` by ×1.34 — so 0.78 / 1.34 = 0.58
 * leaves the boss the **same absolute HP pool it had before**. What changed is
 * the height of the stair in front of it: node 9 caught up, so the final node
 * stopped being a wall standing on flat ground. That is what the 60%
 * concentration ceiling was complaining about, and pulling the step down is the
 * half of the fix the ceiling could not do on its own — a bigger boss makes
 * that number worse, never better. It still kills 29% of the teams that reach
 * it in §6, against a design target of ≥10%.
 */
const BOSS_STEP = 0.515
/** Share of the boss budget carried by its champions rather than their escort. */
const BOSS_CHAMPION_SHARE = 0.45

/** Never let the solved multiplier drop below this — enemies must not read as *weaker* than their tier. */
const MIN_HP_MULT = 0.85

/**
 * Ceiling on {@link waveBudget} (F9).
 *
 * Sited to bite ONLY in the overflow neighbourhood: the raw curve passes 1e300
 * at about depth 2600 and reaches `Infinity` at 2670, so nothing a run can
 * reach — depth 100 is 2.4e15, depth 400 is 3.6e49 — is touched by it, and the
 * curve is unchanged everywhere that has ever been played. It exists purely so
 * that the ceiling is a number instead of `Infinity`.
 *
 * It is safe to sit this high because a budget does not buy head count without
 * bound: `roster()` caps the count at `headcount(depth, kind)` and spends the
 * rest on `hpMult`, so a colossal budget produces a heavy wave, not an
 * unallocatable one.
 */
const MAX_WAVE_BUDGET = 1e300

/**
 * The step from depth `d-1` to depth `d`. Decays from {@link BUDGET_RATIO_TOP}
 * toward {@link BUDGET_RATIO_FLOOR}, because the player's power curve is
 * steepest early (level 1→20, three gear rarities, two evolutions) and flat
 * once it caps — and in the Endless Watch, where depth runs past 30, a fixed
 * geometric step would overflow long before the run had a reason to end.
 */
function budgetStep(depth: number): number {
  return BUDGET_RATIO_FLOOR + (BUDGET_RATIO_TOP - BUDGET_RATIO_FLOOR) * BUDGET_RATIO_DECAY ** (depth - 2)
}

/**
 * Raw enemy HP a node at this depth is allowed to throw, before the run's
 * Threat multiplier. This is the difficulty curve — the single number the rest
 * of encounter generation is solved against.
 */
export function waveBudget(depth: number): number {
  let b = BUDGET_BASE
  for (let d = 2; d <= depth; d++) b *= budgetStep(d)
  // The step never drops below 1, so this compounds forever: at Endless round
  // ~2669 it reaches `Infinity`, and every number solved against it downstream
  // becomes `NaN` (spawn counts) or `Infinity` (the champion's `hpMult`) — an
  // unkillable wave that never ends. Unreachable in play; clamped anyway,
  // because "unreachable" is not a property the arithmetic itself has (F9).
  return Math.min(b, MAX_WAVE_BUDGET)
}

/** The HP pool this node may spend, kind included. */
function kindBudget(depth: number, kind: EncounterKind): number {
  if (kind === 'boss') return waveBudget(Math.max(1, depth - 1)) * BOSS_STEP
  return waveBudget(depth) * (kind === 'elite' ? ELITE_BUDGET : 1)
}

/**
 * How long the spawn schedule may run. Grows early, then caps: a deep wave is
 * *denser* than a shallow one, never longer. The cap is what stops difficulty
 * from being made of wall clock — a wave the player wins should not outlast
 * their attention, and a wave they lose should lose on the base, not the clock.
 */
function spawnWindow(depth: number, kind: EncounterKind): number {
  const base = Math.min(24, 12 + depth * 1.5)
  if (kind === 'elite') return base * ELITE_WINDOW
  if (kind === 'boss') return base * 1.15
  return base
}

/**
 * How many bodies a wave fields — designed directly, because head count is what
 * decides which way a wave kills you. A depth-9 node fields ~110 goblins worth
 * ~280 leak damage against a 20-HP base, so letting one in fourteen through
 * ends the run. That is a defence failing, which is what the game is about;
 * a 30-goblin wave with a ×23 HP multiplier is a stopwatch.
 */
function headcount(depth: number, kind: EncounterKind): number {
  const n = 10 + depth * 4.5
  // An elite is FEWER, tougher bodies: an armour column, not a bigger swarm.
  if (kind === 'elite') return Math.round(n * 0.55)
  // A boss spends most of its budget on champions, so its escort is thin.
  if (kind === 'boss') return Math.round(n * 0.55)
  return Math.round(n)
}

/**
 * ---------------------------------------------------------------------------
 * COMPOSITION VARIANTS (WS8)
 * ---------------------------------------------------------------------------
 *
 * `generateEncounter(depth, kind)` used to take no randomness at all. Depth 4
 * was the identical wave in every run forever, and two battle nodes on the same
 * map layer were literally the same fight — so run-to-run variance below the map
 * layer was one scalar (Threat) plus the player's own team, and placement
 * therefore solved once and stayed solved.
 *
 * A variant is **input randomness**: it changes the problem the player is handed
 * *before* they decide, never the dice that resolve the decision afterwards. So
 * the rule every variant obeys is that it may change composition, arrival shape,
 * tier and head count — and may not change how big the wave is:
 *
 *  - **The HP budget is the same number.** {@link kindBudget} is untouched by
 *    the variant, and `hpMult` is solved against whatever roster the variant
 *    asks for, so four different depth-7 waves all spend the same pool. What
 *    differs is *what the pool was spent on*.
 *  - **{@link WaveVariant.budgetScale} is the only exception**, and it exists to
 *    pay for a change that is qualitative but not difficulty-neutral: a
 *    resistance a modifier grants, or a rush that cuts time in range. It is
 *    fitted against measurement (§14 of the balance report), not chosen.
 *  - **The preview stays honest.** Variants are built out of real
 *    `ENEMY_TYPES` keys, so `waveComposition` and the pre-wave panel disclose
 *    the names, the counts and the resistances of exactly what is coming,
 *    through the code path that already did.
 *
 * Variant 0 of each kind is the canonical shape. For `normal` and `boss` it is
 * byte-identical to what shipped before variants existed, which is what keeps
 * the balance suite's pinned affix benches (`BENCH_PIN`) measuring the same
 * pressure they were fitted at.
 */
export type ScheduleShape = 'lead-armour' | 'even' | 'front-load' | 'back-load'

export interface FactionMix {
  torch: number
  tnt: number
  barrel: number
}

export interface WaveVariant {
  id: string
  /** Appended to the wave label, so the player is told which problem this is. */
  label: string
  /** One line of what it asks for. */
  asks: string
  /** Shallowest depth this variant is legal at. */
  minDepth: number
  /** Faction weights — shape, not size. */
  mix: FactionMix
  /** Overrides {@link mix} where the shape has to ramp with depth. */
  mixAt?: (depth: number) => FactionMix
  /** Head count against the kind's designed count. */
  countMult: number
  /** Enemy tier against the depth's tier. */
  tierBump: number
  /** The modifier the whole column wears (`ENEMY_MODS`), or null. */
  mod: string | null
  /** Arrival shape. */
  shape: ScheduleShape
  /** Boss only: the order its champions arrive in. */
  champions?: readonly string[]
  /** Correction on the kind's HP budget. See the class comment. */
  budgetScale: number
}

/**
 * When each faction is allowed on the field at all. Every variant is filtered
 * through this, so the campaign's teaching ramp — torches, then bombers, then
 * armour — survives having four shapes instead of one.
 */
function gate(mix: FactionMix, depth: number): FactionMix {
  return {
    torch: mix.torch,
    tnt: depth >= 2 ? mix.tnt : 0,
    barrel: depth >= 3 ? mix.barrel : 0,
  }
}

/**
 * The champions a BOSS fields, in order. All three tier-5 goblins are here on
 * purpose: the Powderkeg King (`tnt5`) was defined, sprited and priced and
 * could not spawn anywhere in the game (M16).
 *
 * The *order* is a boss variant's whole content, and it is not cosmetic: below
 * depth 9 a boss fields only the first one or two, and champions land on spaced
 * beats, so which of the three walks in first decides whether the fight opens on
 * 2600 HP of slow armour or 950 HP of fast Warlord. The champion budget is a
 * fixed share either way, so every order costs the same pool.
 */
const BOSS_CHAMPIONS = ['barrel5', 'torch5', 'tnt5'] as const

const NORMAL_VARIANTS: readonly WaveVariant[] = [
  {
    id: 'patrol',
    label: 'Patrol',
    asks: 'a mixed column with an armoured spine — the baseline shape',
    minDepth: 1,
    mix: { torch: 6, tnt: 3, barrel: 1 },
    // The one depth ramp that predates variants: armour thickens from depth 7.
    mixAt: (depth) => ({ torch: 6, tnt: 3, barrel: depth >= 7 ? 1.5 : 1 }),
    countMult: 1,
    tierBump: 0,
    mod: null,
    shape: 'lead-armour',
    budgetScale: 1,
  },
  /**
   * ---- minDepth 1 → 4: a variant is only legal where its identity exists (M1)
   *
   * Swarm's identity is *"a third more bodies, a tier lighter"*, and the second
   * half of that is what separates it from a Patrol. `roster()` computes
   * `clampTier(1 + ⌊(depth−1)/2.5⌋ + tierBump)`, which is **1** for every depth
   * below 4 — so `tierBump: -1` clamps to nothing there and Swarm was Patrol
   * with a few more torches. Measured body-mix distance against Patrol:
   *
   *   depth   1     2      3     4      5      6+
   *   dist   0.0%  14.2%  19.1%  100%   100%   100%
   *
   * against §14b's 35% floor. §14b only ever measured depths 4/7/9, where the
   * tier split makes the pair disjoint by construction, so the three depths the
   * player meets first were the three that were never looked at — and a gate
   * whose sampled range excludes its own failure region is the shape of defect
   * this suite exists to catch, not an instance of it being caught.
   *
   * No variant table can fix depths 1–3 here: at depth 1 `gate()` admits torches
   * alone, so *every* normal variant is 100% torch whatever it is called, and at
   * 2–3 Patrol's own 6:3 mix caps the achievable distance at 33%. The honest
   * move is therefore not to reshape Swarm but to stop offering it where it is
   * not a second shape. Depth 1 fields one normal shape, which is the truth
   * about a one-faction ramp; depth 2 fields Patrol and Bombard (50.8% apart)
   * and depth 3 adds Column (43.5% worst pair). §14b now gates **every** depth
   * 1–10 with no carve-out, which it could not before.
   */
  {
    id: 'swarm',
    label: 'Swarm',
    asks: 'a third more bodies, a tier lighter, arriving in one continuous stream',
    minDepth: 4,
    mix: { torch: 9, tnt: 2, barrel: 0.4 },
    countMult: 1.3,
    tierBump: -1,
    mod: null,
    shape: 'even',
    budgetScale: 1.13,
  },
  {
    id: 'bombard',
    label: 'Bombard',
    asks: 'bombers — magic-resistant, heavy on leak, building to a crescendo',
    minDepth: 2,
    mix: { torch: 2, tnt: 8, barrel: 1 },
    countMult: 0.95,
    tierBump: 0,
    mod: null,
    shape: 'back-load',
    budgetScale: 1.02,
  },
  {
    id: 'column',
    label: 'Column',
    asks: 'armour: two thirds fewer bodies, most of them rolling',
    minDepth: 3,
    mix: { torch: 1.5, tnt: 1.5, barrel: 7 },
    countMult: 0.72,
    tierBump: 0,
    mod: null,
    shape: 'lead-armour',
    budgetScale: 1.25,
  },
]

/**
 * The elite variants — the answer to "an elite is the same wave, denser".
 *
 * Each wears one of `ENEMY_MODS` and is built around the faction that modifier
 * makes interesting, so an elite node asks a *different* question rather than
 * a louder one. Every one of them leaves one damage type fully viable, and the
 * pre-wave preview prints the resistance in the enemy's own row.
 *
 * ---- the mixes were three names on one wave, and are not any more (F5) -----
 *
 * The first version of this table set the three mixes at `{3,2,4}`, `{5,3,1}`
 * and `{7,2,0.5}` — two torch-led hosts and one armour column — and §14b's
 * composition-distance gate reported a flat **100%** apart for all nine elite
 * pairs at every depth, the strongest number in the whole sweep. It was
 * measuring nothing: the metric keyed on the registry key (`barrel4_plated`),
 * and since each variant wears a *different* modifier every elite pair is
 * disjoint by construction whatever bodies are actually in it. Re-keyed onto
 * the base body id — what the renderer draws and what the player watches walk
 * down the road — the same three mixes measured **17.6%–39.5%** apart against a
 * 35% floor, with Warded Host and Swift Raid at 17.6% at depth 9. Two of the
 * three columns really were the same wave with different paperwork, and a
 * concurrent render review found the difference invisible on the battlefield as
 * well: the modifier changes `speed`, `physResist` and `magResist`, and the
 * renderer reads none of the three.
 *
 * So the mixes are rebuilt onto **one faction each**, which is the only thing
 * that makes three columns three columns when there are three factions:
 *
 *  - **Plated Column** — barrels. Rolling armour, physical bounces off it.
 *  - **Warded Host** — bombers. The faction that already shrugs off magic,
 *    warded so that it shrugs off nearly all of it; bring steel.
 *  - **Swift Raid** — torches. Light, numerous, and 40% faster.
 *
 * Measured at **every depth 1–10** — not at the three §14b used to sample, which
 * is how depths 1–2 shipped at 0.0% and 13.3% (see `plated.minDepth` below) —
 * the elite pairs sit **42.7%–57.8%** apart and the binding cell in §14b is a
 * *normal* pair (patrol vs bombard, 41.9% at depth 5). `countMult` on Swift moved 1.2 → 1.3 to hold
 * §14b's ×1.60 max-leak ceiling: a bomber host leaks 3 per body and a torch
 * raid 1, so a pure-faction table separates the leak pools as well as the
 * bodies, and the extra torches are what closes that back up (×1.68 → ×1.47 at
 * depth 4).
 *
 * `budgetScale` is then refitted against §14c on the new mixes — see
 * {@link ELITE_BUDGET}. Per unit of scale the three shapes are worth very
 * different amounts of base HP through a random depth-8 line (warded 5.97,
 * plated 7.74, swift 13.50), which is the price list those numbers are; the
 * fit is bounded by §14b's HP-spread ceiling rather than by §14c itself.
 */
const ELITE_VARIANTS: readonly WaveVariant[] = [
  /**
   * ---- minDepth 1 → 3, for the same reason and with a second one (M1) -------
   *
   * `gate()` withholds barrels until depth 3, so at depths 1–2 the "column of
   * rolling armour" contained **zero barrels** — its `asks` line was false about
   * the wave it generated — and, being torch-led by default, it was
   * indistinguishable from Swift Raid: 0.0% apart at depth 1 and 13.3% at depth
   * 2, against a 35% floor. Both elite variants carried `minDepth: 1` and Banner
   * 2 (*Elite Watch*) makes every battle node an elite from depth 1, so this was
   * not a corner: it was the first fight of every Elite Watch run, offered as a
   * choice between two columns that were one column.
   *
   * From depth 3 it is what it says it is (50% barrels at depth 3, 52–54% from
   * depth 6) and the pair sits 44.4–46.4% apart. Depth 1 now fields Swift Raid
   * alone and depth 2 Warded Host against Swift Raid (57.8%).
   */
  {
    id: 'plated',
    label: 'Plated Column',
    asks: 'a column of rolling armour — physical bounces off it, bring magic',
    minDepth: 3,
    mix: { torch: 3, tnt: 1.5, barrel: 4.5 },
    countMult: 1,
    tierBump: 0,
    mod: 'plated',
    shape: 'lead-armour',
    budgetScale: 1.03,
  },
  {
    id: 'warded',
    label: 'Warded Host',
    asks: 'a host of bombers — magic bounces off it, bring steel',
    minDepth: 2,
    mix: { torch: 2, tnt: 6, barrel: 1 },
    countMult: 1.15,
    tierBump: 0,
    mod: 'warded',
    shape: 'even',
    budgetScale: 1.25,
  },
  {
    id: 'swift',
    label: 'Swift Raid',
    asks: 'a torch raid, lightly armoured and 40% faster — a coverage problem, not a damage one',
    minDepth: 1,
    mix: { torch: 8, tnt: 1.6, barrel: 0.3 },
    countMult: 1.3,
    tierBump: 0,
    mod: 'swift',
    shape: 'front-load',
    budgetScale: 0.96,
  },
]

const BOSS_VARIANTS: readonly WaveVariant[] = [
  {
    id: 'final-watch',
    label: '',
    asks: 'the Colossus Keg leads',
    minDepth: 1,
    mix: { torch: 6, tnt: 3, barrel: 1 },
    mixAt: (depth) => ({ torch: 6, tnt: 3, barrel: depth >= 7 ? 1.5 : 1 }),
    countMult: 1,
    tierBump: 0,
    mod: null,
    shape: 'lead-armour',
    champions: BOSS_CHAMPIONS,
    budgetScale: 1,
  },
  {
    id: 'warlords-vanguard',
    label: "Warlord's Vanguard",
    asks: 'Grukk opens — fast, and the escort is armour',
    minDepth: 1,
    mix: { torch: 2, tnt: 2, barrel: 6 },
    countMult: 0.75,
    tierBump: 0,
    mod: null,
    shape: 'back-load',
    champions: ['torch5', 'tnt5', 'barrel5'],
    budgetScale: 1,
  },
  {
    id: 'powder-court',
    label: 'The Powder Court',
    asks: 'the Powderkeg King opens, behind a swarm that arrives first',
    minDepth: 1,
    mix: { torch: 8, tnt: 2, barrel: 0.5 },
    countMult: 1.25,
    tierBump: 0,
    mod: null,
    shape: 'front-load',
    champions: ['tnt5', 'barrel5', 'torch5'],
    budgetScale: 1,
  },
]

const VARIANTS: Record<EncounterKind, readonly WaveVariant[]> = {
  normal: NORMAL_VARIANTS,
  elite: ELITE_VARIANTS,
  boss: BOSS_VARIANTS,
}

/** Every variant a node of this kind and depth may field. Never empty. */
export function variantsFor(kind: EncounterKind, depth: number): readonly WaveVariant[] {
  const pool = VARIANTS[kind].filter((v) => depth >= v.minDepth)
  return pool.length ? pool : [VARIANTS[kind][0]]
}

/**
 * Which shape a node fields, from a seed and its position in its map layer.
 *
 * A **falsy seed means the canonical variant**, deliberately: every bench in the
 * balance suite that borrows a real encounter (§1–§5, §7, §8, §10) calls
 * `generateEncounter` without one, so those benches keep measuring the same
 * pressure they were fitted and pinned at. Only the run — and the sweeps that
 * are *about* variety — pass a seed.
 *
 * `sibling` is the node's **row**, and it *rotates* the draw rather than
 * re-rolling it. Two battle nodes standing in one layer share a seed and differ
 * by their row, so rows `0…w-1` are dealt `pool[(base+0)…(base+w-1)]` — which is
 * `min(w, pool.length)` DISTINCT shapes, the most any assignment can manage.
 * That is the shuffle-bag answer the genre's randomness doctrine prescribes for
 * "a fork between two identical fights is not a fork": guarantee the
 * distribution over a window, keep the surprise inside it. An iid draw would
 * repeat a quarter of the time at four variants and half the time at two.
 *
 * ---- what this does NOT guarantee (F4) ------------------------------------
 *
 * The doc here used to say two nodes in one layer "can never be dealt the same
 * shape". That is false, and it is false in exactly the place the player meets
 * first. `runmap.ts` puts **2–4** nodes in a layer (3–4 on a wide map), while
 * `variantsFor('normal', d)` returns **1** at depth 1, **2** at depth 2 and
 * **3** at depth 3. When the layer is wider than the pool the pigeonhole decides
 * it, not the rotation: a wide map's layer 1 — which `assignTypes` forces
 * all-battle — repeats on every seed. §14d gates the property that IS true (the
 * rotation is always optimal) rather than the one that was written down.
 *
 * A second, separate reason two shallow nodes look alike, and the reason the
 * pools above are the size they are: `gate()` admits bombers only from depth 2
 * and armour only from depth 3, so at depth 1 every variant collapses to a pure
 * torch column whichever one is drawn — 0.0% composition distance, for any
 * variant table anyone could write. The pools used to be 2 and 3 there anyway,
 * which is how §14b came to be reporting a floor it was clearing at depths 4/7/9
 * and failing at 1/2/3 (M1). A shape is now offered only where it is a second
 * shape; depth 1 fields one, and that is the honest count.
 */
export function pickVariant(kind: EncounterKind, depth: number, seed = 0, sibling = 0): WaveVariant {
  const pool = variantsFor(kind, depth)
  if (!seed) return pool[0]
  const base = new RNG(seed >>> 0).int(0, pool.length - 1)
  return pool[(base + Math.max(0, Math.floor(sibling))) % pool.length]
}

/**
 * A lone champion is always Warlord Grukk. The Colossus Keg and the Powderkeg
 * King are boss-tier and stay that way — a field commander leading an elite
 * column should not be the same creature as the thing at the end of the run,
 * and the Warlord is the one whose 11 leak does not simply delete a 20-HP base
 * the instant it arrives.
 */
const LONE_CHAMPION = 'torch5'

/** How many champions an encounter of this kind and depth fields. */
function championCount(depth: number, kind: EncounterKind): number {
  if (kind === 'boss') return depth >= 9 ? 3 : depth >= 5 ? 2 : 1
  if (kind === 'elite') return depth >= ELITE_CHAMPION_DEPTH ? 1 : 0
  // Every third node from NORMAL_CHAMPION_DEPTH on: the horde rotates its field
  // commanders rather than posting one at every gate.
  return depth >= NORMAL_CHAMPION_DEPTH && (depth - NORMAL_CHAMPION_DEPTH) % 3 === 0 ? 1 : 0
}

interface Rank {
  typeId: string
  count: number
  /** Fraction of the window this rank starts at. */
  at: number
  /** Fraction of the window this rank finishes arriving by. */
  until: number
}

/**
 * Arrival windows per faction, by {@link ScheduleShape}. Each entry is the
 * fraction of the spawn window that rank starts at and finishes arriving by.
 *
 * `lead-armour` is the shipped shape and the reason it exists is worth keeping:
 * a barrel needs 37–46s to walk a 2290px field, so a barrel scheduled at the
 * back of the window is one the *clock* deals with rather than the towers.
 * Putting armour in front makes it a wall the swarm arrives behind. The other
 * three shapes change what the defence has to budget: `even` is a continuous
 * stream with no lull to reload into, `front-load` is one burst that either
 * breaks the line or does not, and `back-load` opens quiet and crescendos —
 * which is the one shape a patience/ramp build wants and a burst build fears.
 */
const SHAPES: Record<ScheduleShape, { barrel: [number, number]; torch: [number, number]; tnt: [number, number]; heavy: [number, number] }> = {
  'lead-armour': { barrel: [0.05, 0.5], torch: [0, 0.82], tnt: [0.25, 1], heavy: [0, 0.2] },
  even: { barrel: [0, 0.9], torch: [0, 1], tnt: [0.05, 1], heavy: [0, 0.3] },
  'front-load': { barrel: [0, 0.4], torch: [0, 0.5], tnt: [0.08, 0.6], heavy: [0, 0.15] },
  'back-load': { barrel: [0.25, 0.8], torch: [0.1, 1], tnt: [0.35, 1], heavy: [0.15, 0.45] },
}

/**
 * Which goblins turn up, in what numbers, and when. Tier is *shape* — armour
 * type, speed, melee damage, leak on arrival — and never size: the multiplier
 * solved in {@link generateEncounter} pays for whatever the roster costs, so
 * scarier goblins mean fewer of them rather than a secretly bigger wave. The
 * same is true of the variant: it decides the mix, the tier and the count, and
 * the solve pays the bill.
 */
function roster(depth: number, kind: EncounterKind, budget: number, v: WaveVariant): Rank[] {
  const bump = kind === 'elite' ? 1 : 0
  const tier = clampTier(1 + Math.floor((depth - 1) / 2.5) + bump + v.tierBump)
  /**
   * The vanguard's tier — and the honest note about when it is one (F7).
   *
   * `clampTier` caps at 4 because tier 5 is the boss roster (Warlord Grukk, the
   * Colossus Keg, the Powderkeg King — 950–2600 HP and 11–22 leak apiece), and
   * those are not escort. An elite's own tier is `1 + ⌊(depth-1)/2.5⌋ + 1`, so
   * it reaches 4 at **depth 6** and the `+1` stops doing anything from there on:
   *
   *   depth  4  5  6  7  8  9  10
   *   tier   3  3  4  4  4  4   4
   *   heavy  4  4  4  4  4  4   4
   *
   * So "a tier above the rest" is true at depths 4–5 and false for depths 6–10,
   * which is where the two elites a campaign actually fights live. The rank is
   * NOT a no-op there — it still adds `1 + ⌊depth/5⌋` barrels and still lands
   * them in the `heavy` arrival window, ahead of the column — but what walks in
   * first is the same armour as the rest of it rather than a heavier grade.
   *
   * Left as a documented limit rather than "fixed", because the only fixes are
   * to put boss-tier bodies in an escort rank or to lower the elite tier ramp,
   * and both are difficulty changes to the back half of the campaign rather than
   * corrections.
   */
  const heavyTier = clampTier(tier + 1)
  const mix = gate(v.mixAt ? v.mixAt(depth) : v.mix, depth)
  // A modified column is built out of the modifier's own registry keys, so the
  // spawn ids the preview groups by are the ones it can describe.
  const id = (fam: string, t: number) => modKey(`${fam}${t}`, v.mod)

  // The head count the design wants, capped by what the budget can pay for at
  // MIN_HP_MULT — otherwise a shallow node would field more goblins than its
  // budget can afford and each would have to read as *weaker* than its tier.
  const totalWeight = mix.torch + mix.tnt + mix.barrel
  const avgHp =
    (mix.torch * ENEMY_TYPES[`torch${tier}`].baseHp +
      mix.tnt * (ENEMY_TYPES[`tnt${tier}`]?.baseHp ?? 0) +
      mix.barrel * (ENEMY_TYPES[`barrel${tier}`]?.baseHp ?? 0)) /
    totalWeight
  const affordable = budget / (MIN_HP_MULT * avgHp)
  const designed = Math.max(1, Math.round(headcount(depth, kind) * v.countMult))
  const total = Math.max(1, Math.min(designed, Math.floor(affordable)))
  const share = (w: number) => Math.round((total * w) / totalWeight)

  const torches = Math.max(1, share(mix.torch))
  const tnts = share(mix.tnt)
  const barrels = share(mix.barrel)

  const w = SHAPES[v.shape]
  const ranks: Rank[] = []
  if (barrels) ranks.push({ typeId: id('barrel', tier), count: barrels, at: w.barrel[0], until: w.barrel[1] })
  ranks.push({ typeId: id('torch', tier), count: torches, at: w.torch[0], until: w.torch[1] })
  if (tnts) ranks.push({ typeId: id('tnt', tier), count: tnts, at: w.tnt[0], until: w.tnt[1] })
  // The elite's vanguard: an armoured rank that walks in FIRST and has to be
  // chewed through while the column arrives behind it. A tier above the rest at
  // depths 4–5; the same tier from depth 6, where the ladder tops out — see
  // `heavyTier` above.
  if (kind === 'elite' && depth >= 4) {
    ranks.unshift({
      typeId: id('barrel', heavyTier),
      count: 1 + Math.floor(depth / 5),
      at: w.heavy[0],
      until: w.heavy[1],
    })
  }
  return ranks
}

/** Total unmultiplied HP a set of ranks represents — the denominator of the budget solve. */
function rosterHp(ranks: Rank[]): number {
  return ranks.reduce((a, r) => a + (ENEMY_TYPES[r.typeId]?.baseHp ?? 0) * r.count, 0)
}

/** Lay ranks out across a window and stamp every spawn with the solved multiplier. */
function schedule(ranks: Rank[], window: number, hpMult: number): SpawnEvent[] {
  const spawns: SpawnEvent[] = []
  for (const r of ranks) {
    const span = Math.max(0, (r.until - r.at) * window)
    const gap = r.count > 1 ? span / (r.count - 1) : 0
    for (let i = 0; i < r.count; i++) {
      spawns.push({ typeId: r.typeId, at: r.at * window + gap * i, hpMult })
    }
  }
  return spawns
}

/**
 * Build a wave for a map node at the given depth (layer) and kind.
 *
 * Difficulty is one number — {@link waveBudget} — spent on a depth-appropriate
 * roster inside a bounded spawn window, with champions taking a fixed share of
 * that budget off the top wherever the kind fields them. Elites and bosses are
 * therefore rule changes bought at a modest premium, not multiplier stacks.
 */
export interface EncounterOptions {
  /** Override the generated label outright (Endless names its own rounds). */
  label?: string
  /**
   * Seeds the composition variant. Falsy → the canonical shape, which is what
   * every pinned bench in the balance suite relies on. A run passes
   * {@link encounterSeed}.
   */
  seed?: number
  /**
   * The node's row inside its map layer. Rotates the variant draw so siblings
   * in one layer can never be dealt the same shape. See {@link pickVariant}.
   */
  sibling?: number
  /** Force one variant by id — the variety sweeps and nothing else. */
  variantId?: string
}

/**
 * The variant seed for one map layer — deterministic in (run seed, depth).
 *
 * Keyed on the node's *structural* coordinate rather than its id: node ids come
 * off a process-global counter, so they are stable within a run and its
 * snapshot but not across a fresh replay of the same seed, while the layer is
 * stable in both. The node's **row** is not in this key — it is passed to
 * {@link pickVariant} as `sibling`, where it rotates the draw so that two nodes
 * in one layer are guaranteed to be different fights rather than merely likely
 * to be.
 */
export function encounterSeed(runSeed: number, depth: number): number {
  return hashSeed(runSeed, 'field', 'wave', depth)
}

export function generateEncounter(depth: number, kind: EncounterKind, opts: EncounterOptions = {}): WaveDef {
  const v = opts.variantId
    ? (variantsFor(kind, depth).find((x) => x.id === opts.variantId) ?? pickVariant(kind, depth, opts.seed, opts.sibling))
    : pickVariant(kind, depth, opts.seed, opts.sibling)
  const budget = kindBudget(depth, kind) * v.budgetScale
  const window = spawnWindow(depth, kind)

  const nChamps = championCount(depth, kind)
  // A boss variant re-orders the champions it fields; it never changes WHICH it
  // fields. Below depth 9 a boss brings only one or two, and the three tier-5
  // goblins are 950 / 1350 / 2600 base HP — so letting the *order* pick the
  // roster made a shallow boss's HP pool swing 2.4× once `MIN_HP_MULT` clamped
  // the solve. The set is taken canonically and only the arrival order belongs
  // to the variant, which is the half that was interesting anyway.
  const champSet: readonly string[] = BOSS_CHAMPIONS.slice(0, nChamps)
  const champOrder = (v.champions ?? BOSS_CHAMPIONS).filter((id) => champSet.includes(id))
  const champs: string[] =
    kind === 'boss'
      ? champOrder.map((id) => modKey(id, v.mod))
      : Array.from({ length: nChamps }, () => modKey(LONE_CHAMPION, v.mod))
  const champShare =
    champs.length === 0 ? 0 : kind === 'boss' ? BOSS_CHAMPION_SHARE : kind === 'elite' ? ELITE_CHAMPION_SHARE : NORMAL_CHAMPION_SHARE
  const champBudget = budget * champShare
  const champMult = champs.length
    ? Math.max(MIN_HP_MULT, champBudget / champs.reduce((a, id) => a + ENEMY_TYPES[id].baseHp, 0))
    : 0

  const ranks = roster(depth, kind, budget - champBudget, v)
  const hpMult = Math.max(MIN_HP_MULT, (budget - champBudget) / Math.max(1, rosterHp(ranks)))

  const spawns = schedule(ranks, window, hpMult)
  // Champions land ON TOP of the escort at spaced intervals, so the fight has
  // distinct beats instead of arriving as one blob.
  champs.forEach((id, i) => {
    spawns.push({ typeId: id, at: window * (0.2 + 0.28 * i), hpMult: champMult })
  })
  spawns.sort((a, b) => a.at - b.at)

  return {
    index: depth,
    label: opts.label ?? defaultLabel(depth, kind, v),
    spawns,
    isBoss: kind === 'boss',
  }
}

/**
 * The node's name, with the variant in it.
 *
 * The variant is named rather than hidden because the whole point of input
 * randomness is that the player gets to *solve* the setup: "Elite — Warded
 * Host" plus a preview listing `Warded Bomber ×14 — shrugs off magic 49%` is a
 * counter-pick problem. The same fight with a generic name is a surprise, which
 * is the other kind of randomness.
 *
 * (The example quotes the number the game actually prints. A Bomber is `tnt2`,
 * whose own 15% magic resist plus Warded's +34% lands on 49%; 55% is the cap,
 * reached by a Sapper — `tnt4`, 25% + 34% — not by a Bomber. An example that
 * misquotes the mechanic it is illustrating is the same defect as copy that
 * does, just aimed at the next maintainer instead of the player.)
 */
function defaultLabel(depth: number, kind: EncounterKind, v: WaveVariant): string {
  if (kind === 'boss') return v.label ? `The Final Watch — ${v.label}` : 'The Final Watch'
  if (kind === 'elite') return `Elite — ${v.label}`
  return v.id === 'patrol' ? `Depth ${depth}` : `Depth ${depth} — ${v.label}`
}

/**
 * Endless Watch wave for a given round. Every 10th round is a boss, every 5th
 * an elite; difficulty ramps faster than the campaign (depth = round + 2).
 *
 * Because the boss budget is quoted off the depth *before* it, an Endless boss
 * round is now strictly harder than the round before it — which is what makes
 * its full heal, bonus dust and triple loot a reward rather than a rest (H7).
 */
export function generateEndlessWave(round: number, runSeed = 0): WaveDef {
  const kind: EncounterKind = round % 10 === 0 ? 'boss' : round % 5 === 0 ? 'elite' : 'normal'
  // A boss round jumps two depths ahead of the march it interrupts. The
  // campaign gets its boss step from Threat — clearing depth 9 multiplies it
  // by 1.42 before the final node — but an Endless boss follows a round whose
  // Threat step is smaller, so the step has to be in the depth instead. Without
  // it, round 30's boss came out at 0.78× round 29's wave (H7's second half:
  // the old boss did not scale AT ALL and was an order of magnitude weaker).
  const depth = round + (kind === 'boss' ? 4 : 2)
  // The Watch varies its shape too — same seed, same round, same wave, so a
  // resumed Endless run faces the fight it was interrupted by. There is no
  // sibling to rotate against: a round has no neighbours in its layer.
  const seed = runSeed ? encounterSeed(runSeed, depth) : 0
  const v = pickVariant(kind, depth, seed)
  const tag = kind === 'elite' ? ` — Elite · ${v.label}` : kind === 'boss' ? ` — Boss${v.label ? ` · ${v.label}` : ''}` : v.id === 'patrol' ? '' : ` — ${v.label}`
  const wave = generateEncounter(depth, kind, { seed, label: `Wave ${round}${tag}` })
  return { ...wave, index: round }
}

/** Human-readable composition summary for the pre-wave preview. */
export function waveComposition(wave: WaveDef): { typeId: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const s of wave.spawns) counts.set(s.typeId, (counts.get(s.typeId) ?? 0) + 1)
  return [...counts.entries()].map(([typeId, count]) => ({ typeId, count }))
}
