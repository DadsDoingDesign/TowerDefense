import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { sfx } from '../audio/audio'
import { num, numRecord, onStorageKeyChange, safePersistStorage } from './storage'
import { dailyScore } from './daily'
import { ACHIEVEMENTS, newlyEarned, type RunFacts } from '../game/data/achievements'
import { addFelled, sanitizeFelled } from '../game/data/enemyKnowledge'

/**
 * What a hub purchase *does* to the game (H15).
 *
 *  - `ramp` makes the player stronger. Every one of the seven original hub
 *    upgrades was one of these, which made the whole meta layer a treadmill:
 *    the only thing a hundred runs could buy was a bigger number, and a maxed
 *    hub simply deleted the early game.
 *  - `unlock` makes the *run* wider — more map, more stops, more choices —
 *    without making the player stronger at any of them.
 *
 * The ramp is kept, deliberately and bounded. The balance harness measures a
 * zero-meta solo run clearing about six of ten nodes, so a new player does need
 * a hand; what it must not do is keep paying out forever. Every ramp line now
 * caps in one or two purchases (they used to run to five and six), so the whole
 * ramp is worth +10 base, +50 gold, +2 stats, one Sentinel and one item — a
 * first-week leg-up, not a permanent power budget. Everything bought after that
 * widens the game instead.
 */
export type UpgradeKind = 'ramp' | 'unlock'

export interface MetaUpgrade {
  id: string
  name: string
  desc: string
  maxLevel: number
  baseCost: number
  step: number
  kind: UpgradeKind
  /**
   * The feat that makes this purchasable (Phase 3b). A horizontal service is
   * opened by PLAYING — the achievement — and then bought with marks; the
   * ramp needs nothing.
   */
  requires?: string
}

export const UPGRADES: MetaUpgrade[] = [
  // ── the onboarding ramp — bounded on purpose ─────────────────────────────
  { id: 'base', name: 'Reinforced Gate', desc: '+5 max Gate HP', maxLevel: 2, baseCost: 60, step: 40, kind: 'ramp' },
  { id: 'gold', name: 'War Chest', desc: '+25 starting gold', maxLevel: 2, baseCost: 50, step: 30, kind: 'ramp' },
  // The copy says "every Sentinel", and since M18 the code agrees: the bonus is
  // applied in `buildStartingRoster` AND in `scaledRecruit`, so it covers the
  // company you start with and every body the run hires. It used to say
  // "starting Sentinels" and mean it, which made a permanent purchase quietly
  // worth less the longer a run went on.
  { id: 'stats', name: 'Seasoned Recruits', desc: '+1 to all stats on every hero you start with or hire', maxLevel: 2, baseCost: 80, step: 50, kind: 'ramp' },
  { id: 'roster', name: 'Standing Company', desc: 'Begin each run with an extra hero', maxLevel: 1, baseCost: 150, step: 150, kind: 'ramp' },
  { id: 'loot', name: 'Quartermaster', desc: 'Begin each run with an extra item', maxLevel: 1, baseCost: 70, step: 60, kind: 'ramp' },
  /**
   * **`marks` — "Chronicler", +15% Watch Marks per level, four levels — is gone
   * (F-B5).**
   *
   * It was 880 of the hub's ~1,990 marks, its single biggest sink, and it did
   * nothing to a run. A currency multiplier is correct on every horizon past
   * its own payback (~7 runs here) and correct regardless of how you play, so
   * the hub's first click had a known answer and its most expensive line was a
   * tax rebate. That is the opposite of what a hub is for: every other line on
   * this list changes a run, and the player should be choosing between changes.
   *
   * Marks now scale with the *risk the player accepts* — the Banner ladder,
   * where a multiplier is the payout on a bet rather than a purchase — and with
   * how far the run got. Nothing else multiplies them.
   *
   * A save that already bought levels of it keeps its marks; the level is
   * simply never read again. `migrateMeta` clamps unknown ids out of the way.
   */

  // ── horizontal unlocks — these widen the run, they do not strengthen you ──
  //
  // All three are graded by the harness on TWO gates (§12): the breadth their
  // card promises has to show up in the generated map, and none of them — alone
  // or in any combination — may lower the measured win rate. The second gate
  // exists because the first version of `Cartographer's Table` did exactly
  // that: it moved the boss two layers deeper and took the campaign from 40%
  // winnable to 7%, permanently, for 120 marks.
  {
    id: 'cartographer',
    name: "Cartographer's Table",
    desc: 'The Watch maps every fork it can find: three or four roads a layer and never a corridor — the route becomes an argument, not a queue',
    maxLevel: 1,
    baseCost: 120,
    step: 0,
    kind: 'unlock',
  },
  {
    id: 'freeCompanies',
    name: 'Free Companies',
    desc: 'A second Recruit stop on every map, and mercenaries arrive trained for the depth you hire them at',
    maxLevel: 1,
    baseCost: 180,
    step: 0,
    kind: 'unlock',
  },
  {
    id: 'standingOrders',
    name: 'Standing Orders',
    desc: 'The Watch picks its fights: no Elite ever stands on a road with no way around it — every ambush has a way past, if you would rather spend the march elsewhere',
    maxLevel: 1,
    baseCost: 160,
    step: 0,
    kind: 'unlock',
  },
  // ── Phase 3b: services opened by a feat, then bought — more choices, never
  //    more power at any one of them. Each is graded in §12 like the rest.
  {
    id: 'fieldKitchen',
    name: 'Field Kitchen',
    desc: 'Every campfire offers a third choice: forage the road for 40 gold instead of resting or training',
    maxLevel: 1,
    baseCost: 220,
    step: 0,
    kind: 'unlock',
    requires: 'act_two',
  },
  {
    id: 'cartulary',
    name: 'Relic Cartulary',
    desc: 'An act boss lays out four relics instead of three — the same prize, a wider pick',
    maxLevel: 1,
    baseCost: 260,
    step: 0,
    kind: 'unlock',
    requires: 'first_light',
  },
]
const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]))

/**
 * What a Banner rung used to cost, kept ONLY so {@link migrateMeta} can refund
 * it: rung N cost `200 + 150·(N−1)` Watch Marks (200 / 350 / 500 / 650 / 800 —
 * v1 saves could hold rungs 4–5). Rungs are earned by winning now.
 */
const LEGACY_BANNER_PRICE = (rung: number): number => 200 + 150 * (rung - 1)
export const legacyBannerRefund = (unlocked: number): number => {
  let total = 0
  for (let r = 1; r <= Math.max(0, Math.floor(unlocked)); r++) total += LEGACY_BANNER_PRICE(r)
  return total
}

/**
 * ---------------------------------------------------------------------------
 * The Banner ladder — what Dark Sacrifice became (H16 / M29).
 * ---------------------------------------------------------------------------
 *
 * Dark Sacrifice broke every rule a difficulty ladder has. It was:
 *
 *  - **permanent and global** — one tap raised enemy HP by 15% *forever*, on
 *    every run, in both modes, with no way back short of erasing the save;
 *  - **bought, not earned** — the gate was 200 Watch Marks, so it measured
 *    grinding rather than skill. (The Banner ladder that replaced it kept the
 *    price — 200 / 350 / 500 marks a rung — until Phase 1, contradicting this
 *    very line. A rung is now unlocked by WINNING a run under the rung below
 *    it: Banner 1 by winning an unbannered run. Marks already spent on rungs
 *    are refunded by {@link migrateMeta}.)
 *  - **numbers only** — +1 to every stat, +10% marks, +15% enemy HP. Nothing
 *    about the game changed; the same run happened with different arithmetic;
 *  - **a stat ratchet on both sides** — it made the player stronger *and* the
 *    enemies stronger, so it did not even reliably raise difficulty.
 *
 * A Banner is the opposite of all four. It is chosen **per run, at the start**,
 * from the rungs you have unlocked; it never applies to a run you did not
 * choose it for; each rung takes a *rule* away rather than adding a multiplier;
 * and the reward scales with the rung, so flying a Banner is a bet rather than
 * a tax. Rungs are cumulative — Banner 3 flies 1, 2 and 3.
 */
export interface BannerRung {
  tier: number
  name: string
  /** The rule this rung changes, in the player's words. */
  rule: string
  /** Marks multiplier for finishing a run under this Banner (cumulative). */
  markMult: number
}

/**
 * Every rung states exactly one rule, only the rule that rung ADDS, and every
 * rule is implemented and measurable.
 *
 * ---------------------------------------------------------------------------
 * What the ladder used to be, and why none of it survived (F-C2)
 * ---------------------------------------------------------------------------
 *
 * Measured at n=150 paired runs per rung, marks by `grantRunRewards`'s own
 * formula, on the zero-meta baseline:
 *
 * | old rung | rule added | ×marks | win% | marks/run |
 * |---|---|--:|--:|--:|
 * | 1 Forced March | no merchants | 1.25 | 40% | 142 |
 * | 2 Thin Pickings | two cards | 1.55 | 32% | 157 |
 * | 3 Elite Watch | every node elite | 2.0 | 11% | 136 |
 * | 4 Blood Price | no recruits | 2.6 | 1% | 128 |
 * | 5 The Long Dark | start at Threat ×2 | 3.4 | 1% | 137 |
 *
 * Banner 0 wins 40% and banks 114 marks a run. So:
 *
 *  - **Rung 1 was free money.** Deleting the merchants costs a first run
 *    nothing measurable — a merchant detour is a ×1.13 Threat step for a shop
 *    the run usually cannot afford — and it paid +25%. There was no reason to
 *    ever fly Banner 0 again, which makes the ladder's first rung a mandatory
 *    bonus rather than a bet.
 *  - **Rungs 3–5 were strictly ignorable.** The payout multiplier exactly
 *    cancelled the difficulty: marks/run flatlined around 130–160 while the win
 *    rate collapsed 32 → 11 → 1 → 1%. Climbing was never worth it.
 *  - **Rung 5 was a numbers-only rung** — `startThreat: 2` and a line of copy
 *    ("the horde never sends a patrol again") that restated rung 3. Doctrine:
 *    numbers-only rungs are a treadmill.
 *
 * ---------------------------------------------------------------------------
 * What it is now
 * ---------------------------------------------------------------------------
 *
 * Every candidate rule was measured **alone**, on top of Banner 0, at n=200
 * paired runs per cell on the zero-meta baseline, across four routing policies
 * (win rate against Banner 0's 28 / 37 / 35 / 37%):
 *
 * | rule alone | specials | battles | recruits | adaptive |
 * |---|--:|--:|--:|--:|
 * | two reward cards | −9 | −12 | −6 | −7 |
 * | **no Merchants** | **−1** | **−7** | **−1** | **−3** |
 * | **every node elite** | **0** | **−3** | **+1** | **−1** |
 * | no recruits | −10 | −23 | −21 | −21 |
 * | start at Threat ×2 | −24 | −28 | −24 | −25 |
 *
 * **Re-measured after the Banner-2 pricing fix (M19-g).** `allElite` used to
 * read −10 / −25 / −17 / −15 on this table, and almost none of that was the
 * composition: it was `THREAT_PER_NODE[kind]`, which charged every battle node
 * the ×1.52 elite step under this rung instead of ×1.42 — a compounding
 * surcharge the rung's card never mentioned (`gameStore.mapKind`). With the
 * price *and* the elite pay (+25 gold, +0.15 card luck) both following the kind
 * the map dealt, the rule alone is close to free at this sample size. It still
 * earns its rung cumulatively — the ladder measures 39 → 29 → 26 → 11% win with
 * marks 110 → 130 → 181 → 210, so both §13 invariants hold — but Elite Watch is
 * now the cheapest rule on the ladder carrying the second-largest multiplier,
 * and that is the next thing to re-price. The honest fix is a harder elite
 * *composition* (`waves.ts`), not a second surcharge here.
 *
 * So the ladder is three rungs, priced so that *expected marks per run rise
 * across every rung* — the invariant the harness now gates on (§13). Two
 * candidates were cut:
 *
 *  - **Forced March is not a rung.** Deleting the merchants does not make a run
 *    meaningfully harder — a merchant is a ×1.13 Threat step for a shelf a
 *    gold-poor run cannot buy from, so on the line a first-timer walks it once
 *    measured *easier* (+6pt) and re-measures at −1 to −7pt: noise either side
 *    of free. A rung has to be a bet, and this one paid +25% for that. That the
 *    game contains a node type whose removal can measure as a *buff* is a real
 *    defect — it
 *    belongs to the shop economy (prices, stock, the special Threat step), not
 *    to this ladder, and it is reported as such. `noMerchants` stays wired and
 *    tested so the rung can come back the day a merchant is worth stopping at.
 *  - **The Long Dark is not a rung.** `startThreat: 2` is the largest number on
 *    the table and the only one that changes no decision — the definition of a
 *    treadmill rung. A fourth rung needs a fourth *rule* (no Shrines is the
 *    obvious next one, and wants a `noShrines` flag threaded through
 *    `mapOptionsFor`), not a bigger multiplier.
 *
 * Existing saves that had unlocked rungs 4–5 clamp to 3 in {@link migrateMeta}.
 */
export const BANNER_RUNGS: BannerRung[] = [
  { tier: 1, name: 'Thin Pickings', rule: 'Every clear offers two reward cards instead of three, only elites and act bosses deal relics, merchants stock one item fewer, and the Crossroads offers two mutations. Half the build, same march.', markMult: 1.4 },
  /*
   * ---- this card said three things and one of them was true (M7a) ---------
   *
   * It read "armour columns, champions, compressed waves". Measured against the
   * code it names:
   *
   *  - **"armour columns"** — `pickVariant` rotates uniformly over `plated` /
   *    `warded` / `swift` (`waves.ts`), so roughly two thirds of an Elite Watch
   *    run's battle nodes are not armour at all. Warded is a light host and
   *    Swift is a fast one; a player who buys this rung and brings magic to
   *    counter the plate meets a Warded Host that resists exactly that.
   *  - **"champions"** — `ELITE_CHAMPION_DEPTH` is 6, so on the standard
   *    11-layer map depths 1–5 field none. Half the march, no champions.
   *  - **"compressed waves"** — true: `ELITE_WINDOW` is 0.85.
   *
   * That is a card taking Watch Marks for mechanics two thirds of which do not
   * arrive, on a rung the player cannot opt out of once flown. This project has
   * now shipped copy describing a mechanic that does not exist five times; the
   * rule below says what the code does, including the depth the champion is
   * actually gated behind.
   */
  /*
   * ---- one depth deeper (Phase 1) -------------------------------------------
   *
   * With the ≥3pt-per-rung gate (§13), this rung was the one that could not
   * pass it: alone it measured −0.8pt and on top of Thin Pickings −3.0pt at
   * n=600 — composition alone is close to free. Its elites are now drawn one
   * depth deeper (`eliteDepth`), which the card says, and which moves the
   * champion to depth 5; it costs ~9pt over rung 1 on every routing line. The
   * payout moved ×2.2 → ×2.5 so expected marks keep rising across the ladder.
   */
  { tier: 2, name: 'Elite Watch', rule: 'Every battle node is an elite drawn from one depth deeper: armoured, warded or swift, arriving faster — champion-led from depth 5.', markMult: 2.5 },
  // ×3.5 → ×4.2 (Phase 3b): on the three-act road the rung's win rate fell
  // further than the old multiplier paid for — §13 measured it banking fewer
  // marks a run than Vow 2, which makes the top rung a decoration.
  { tier: 3, name: 'Blood Price', rule: 'No recruits, anywhere. The heroes you start with are the heroes you finish with.', markMult: 4.2 },
]

export const MAX_BANNER = BANNER_RUNGS.length

/** Everything a run needs to know about the Banner it is flying. */
export interface BannerRules {
  tier: number
  /** No merchant nodes are generated. */
  noMerchants: boolean
  /** Reward picks drop from three cards to two. */
  thinPickings: boolean
  /** Every battle node resolves as an elite encounter. */
  allElite: boolean
  /**
   * How many depths deeper a Banner-made elite is drawn from (0 = its own
   * depth). Map-dealt elites are never moved: a Banner substitutes an
   * encounter, not a node.
   */
  eliteDepth: number
  /** Recruit offers are withheld (nodes, crossroads, merchant hires). */
  noRecruits: boolean
  /**
   * Threat the run starts at.
   *
   * No rung sets this any more: it was the whole of the old rung 5, and a rung
   * that only multiplies a number is a treadmill rather than a wager. The field
   * stays because `setRunBanner` reads it to seed a run's Threat and a future
   * rung may want it *alongside* a rule — not as one.
   */
  startThreat: number
  /** Marks multiplier for the run. */
  markMult: number
}

export const NO_BANNER: BannerRules = {
  tier: 0,
  noMerchants: false,
  thinPickings: false,
  allElite: false,
  eliteDepth: 0,
  noRecruits: false,
  startThreat: 1,
  markMult: 1,
}

/** The cumulative ruleset for flying Banner `tier` (0 = none). */
export function bannerRules(tier: number): BannerRules {
  const t = Math.max(0, Math.min(MAX_BANNER, Math.floor(num(tier, 0))))
  if (t <= 0) return NO_BANNER
  return {
    tier: t,
    thinPickings: t >= 1,
    allElite: t >= 2,
    eliteDepth: t >= 2 ? 1 : 0,
    noRecruits: t >= 3,
    // No rung takes these two. Both are wired, implemented and covered by the
    // map generator; both were measured and neither earns a rung today (see
    // BANNER_RUNGS above).
    noMerchants: false,
    startThreat: 1,
    markMult: BANNER_RUNGS[t - 1].markMult,
  }
}

export interface MetaStats {
  bestDepth: number
  /** Deepest Endless round survived — tracked separately so one cannot flatter the other (M33). */
  bestRound: number
  /** Highest Banner ever carried to a campaign win. The real difficulty record. */
  bestBanner: number
  totalKills: number
  runsCompleted: number
  runsWon: number
}

/**
 * The day's scored Daily Watch attempt (Phase 1). One per UTC day: it is
 * claimed the moment a hero is committed to that day's seed, so backing out
 * after a bad first wave does not buy a second scored try.
 */
export interface DailyRecord {
  date: string
  depth: number
  won: boolean
  kills: number
  score: number
  /** True once the run has settled; false while the attempt is still live. */
  done: boolean
}

function migrateDaily(raw: unknown): DailyRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) return null
  return {
    date: o.date,
    depth: Math.max(0, num(o.depth, 0)),
    won: o.won === true,
    kills: Math.max(0, num(o.kills, 0)),
    score: Math.max(0, num(o.score, 0)),
    done: o.done === true,
  }
}

/** The Codex (Phase 3b): the Watch's field notes, persisted with the meta save. */
export interface Codex {
  /** Enemy type ids met in a wave (modded ids included — a Warded Bomber is its own entry). */
  enemies: string[]
  /** Relic ids ever taken. */
  relics: string[]
  /** Archetype-tree node ids ever reached (base, sub-archetype, specialization). */
  specs: string[]
  /** Spec perk ids ever taken. */
  perks: string[]
  /**
   * Q10 — enemies felled, by KIND (`enemyKind`: the key without its elite
   * modifier). The enemy info card's knowledge rule reads it
   * (`game/data/enemyKnowledge.ts`). Added without a version step: an older
   * save simply has none, which is the truth.
   */
  felled: Record<string, number>
}
const freshCodex = (): Codex => ({ enemies: [], relics: [], specs: [], perks: [], felled: {} })
const strList = (raw: unknown): string[] =>
  Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === 'string'))] : []
function migrateCodex(raw: unknown): Codex {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { enemies: strList(o.enemies), relics: strList(o.relics), specs: strList(o.specs), perks: strList(o.perks), felled: sanitizeFelled(o.felled) }
}
function migrateAchievements(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!raw || typeof raw !== 'object') return out
  const known = new Set(ACHIEVEMENTS.map((a) => a.id))
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (known.has(k)) out[k] = Math.max(1, Math.floor(num(v, 1)))
  }
  return out
}

/**
 * Endless payout (Phase 3b). It paid a flat 8 marks a round and read no
 * multiplier at all, so the mode a strong player would spend an hour in paid
 * least per minute. It now pays per round, a bonus every fifth (an elite or a
 * boss round), and the multiplier of the highest Vow the player has WON — the
 * ladder's reward carries into the endless mode it opened.
 */
export function endlessMarks(rounds: number, bestBanner: number): number {
  const r = Math.max(0, Math.floor(num(rounds, 0)))
  return Math.round((r * 8 + Math.floor(r / 5) * 20) * bannerRules(bestBanner).markMult)
}

/** Bonuses the meta layer grants to each new run. */
export interface MetaBonuses {
  maxBaseHp: number
  startGold: number
  statBonus: number
  extraSentinels: number
  extraItems: number
  enemyHpMult: number
}

interface MetaState {
  watchMarks: number
  upgrades: Record<string, number>
  /**
   * Highest Banner rung UNLOCKED — a record of what you have opened up, not a
   * penalty you are stuck with. Persisted under its old name so every existing
   * save keeps its progress; what changed is what the number means (H16).
   * Raised only by winning: a campaign win under Banner N opens Banner N+1.
   */
  sacrificeTier: number
  stats: MetaStats
  /** Today's (or the last played day's) scored Daily Watch attempt. */
  daily: DailyRecord | null
  /**
   * Feats earned (Phase 3b): achievement id → the run count it was earned on.
   * A feat opens content — a spec, a relic, a perk option, a Watchtower
   * service — and pays its purse once.
   */
  achievements: Record<string, number>
  /** What the Watch has seen and used, for the Codex (Phase 3b). */
  codex: Codex
  // actions
  /**
   * Claim `date`'s scored Daily attempt. Returns false — and changes nothing —
   * when that day's attempt was already claimed: the run is practice.
   */
  beginDaily: (date: string) => boolean
  /** Close `date`'s attempt as it stands (a run abandoned before it earned anything). */
  closeDaily: (date: string) => void
  upgradeCost: (id: string) => number
  buyUpgrade: (id: string) => void
  /** True once this hub unlock has been bought. */
  unlocked: (id: string) => boolean
  grantMarks: (n: number) => void
  grantRunRewards: (info: {
    depth: number
    won: boolean
    kills: number
    mode?: 'campaign' | 'endless'
    /** Banner the run was flying, if any — scales the payout. */
    banner?: number
    /**
     * Whether a win here may open the next Banner rung (default true). A
     * hand-picked custom seed can be shopped for an easy map, so it pays its
     * marks but does not count toward the ladder.
     */
    ranked?: boolean
    /** The UTC day of a SCORED Daily attempt this settle belongs to. */
    daily?: string | null
    /** The facts the feats are judged on (Phase 3b). Omitted: no feat can be earned. */
    facts?: RunFacts
  }) => number
  bonuses: () => MetaBonuses
  /** True once a feat is earned. */
  achieved: (id: string) => boolean
  /** Whether a hub purchase's feat (if it has one) is earned. */
  purchasable: (id: string) => boolean
  /** Add to the Codex. Ids are deduplicated; order of first sighting is kept. */
  recordCodex: (seen: Partial<Omit<Codex, 'felled'>>) => void
  /** Q10 — add one settled wave's kills (by registry key) to the Codex's felled tally. */
  recordFelled: (byKey: Iterable<readonly [string, number]>) => void
  resetMeta: () => void
}

const BASE_MAX_HP = 20
const BASE_GOLD = 60

const freshStats = (): MetaStats => ({
  bestDepth: 0,
  bestRound: 0,
  bestBanner: 0,
  totalKills: 0,
  runsCompleted: 0,
  runsWon: 0,
})

/**
 * Persisted meta schema version (M11). Bump this and add a case to
 * {@link migrateMeta} whenever the shape changes.
 *
 * v2 — `stats.bestRound` / `stats.bestBanner` added, and `sacrificeTier`
 * reinterpreted from "permanent global heat, already applied" to "highest
 * Banner unlocked, flown per run". No data has to move: an old save's tier N
 * becomes N unlocked Banners, and the permanent +15% enemy HP / +1 stats it
 * used to carry simply stops applying, which is strictly what the player would
 * have chosen given the option.
 *
 * v3 — Banner rungs are earned by winning, not bought. Every mark a v1/v2 save
 * spent unlocking rungs is refunded (`legacyBannerRefund`), and the rungs it
 * holds are KEPT: the fix is to the price, not a reason to take back progress.
 * `daily` (the Daily Watch record) is added and defaults to null.
 *
 * v4 — Phase 3b: `achievements` (feats earned) and `codex` (enemies, relics,
 * specs and perks seen) are added and default to empty. Nothing moves.
 */
export const META_VERSION = 4

/** Persisted slice — the only part of the store that survives a reload. */
type PersistedMeta = Pick<MetaState, 'watchMarks' | 'upgrades' | 'sacrificeTier' | 'stats' | 'daily' | 'achievements' | 'codex'>

/**
 * Bring any stored payload up to the current shape, defaulting EVERY numeric
 * field (M11).
 *
 * This store does `stats.x + n` arithmetic, so a field added in a later version
 * would arrive as `undefined` from an older save, become NaN on the first
 * grant, and stay NaN forever — persisted back out each time. Coercing on the
 * way in is what prevents that. It is also what keeps the existing (verified)
 * property that a hand-corrupted `fieldwatch-meta` key degrades to defaults
 * rather than crashing: anything unrecognisable simply becomes its default.
 */
export function migrateMeta(persisted: unknown, version: number): PersistedMeta {
  const o = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>
  const rawStats = (o.stats && typeof o.stats === 'object' ? o.stats : {}) as Record<string, unknown>
  const base = freshStats()
  // Old saves bought hub levels against caps that are now lower; clamp rather
  // than leave a level the UI can never render and `bonuses()` would over-pay.
  const upgrades = numRecord(o.upgrades)
  for (const u of UPGRADES) {
    if (upgrades[u.id] != null) upgrades[u.id] = Math.max(0, Math.min(u.maxLevel, Math.floor(upgrades[u.id])))
  }
  // Read BEFORE the clamp: a v1 save that bought rungs 4–5 paid for them too.
  const rawTier = Math.max(0, Math.floor(num(o.sacrificeTier, 0)))
  // v3: rungs were bought with marks until now; give every one of them back.
  // Only on a real version step — `merge` calls this with META_VERSION on
  // every load, and a refund there would pay out on every boot.
  const refund = version < 3 ? legacyBannerRefund(rawTier) : 0
  return {
    watchMarks: Math.max(0, num(o.watchMarks, 0)) + refund,
    upgrades,
    sacrificeTier: Math.max(0, Math.min(MAX_BANNER, rawTier)),
    stats: {
      bestDepth: Math.max(0, num(rawStats.bestDepth, base.bestDepth)),
      bestRound: Math.max(0, num(rawStats.bestRound, base.bestRound)),
      bestBanner: Math.max(0, num(rawStats.bestBanner, base.bestBanner)),
      totalKills: Math.max(0, num(rawStats.totalKills, base.totalKills)),
      runsCompleted: Math.max(0, num(rawStats.runsCompleted, base.runsCompleted)),
      runsWon: Math.max(0, num(rawStats.runsWon, base.runsWon)),
    },
    daily: migrateDaily(o.daily),
    achievements: migrateAchievements(o.achievements),
    codex: migrateCodex(o.codex),
  }
}

/**
 * The feats the most recent `grantRunRewards` call earned — read by the run's
 * receipt (the recap) right after it settles. Process-local, not persisted:
 * the ledger itself is `achievements`.
 */
export const lastFeats: { ids: string[] } = { ids: [] }

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => ({
      watchMarks: 0,
      upgrades: {},
      sacrificeTier: 0,
      stats: freshStats(),
      daily: null,
      achievements: {},
      codex: freshCodex(),

      beginDaily: (date) => {
        if (get().daily?.date === date) return false
        set({ daily: { date, depth: 0, won: false, kills: 0, score: 0, done: false } })
        return true
      },

      closeDaily: (date) => {
        const rec = get().daily
        if (rec && rec.date === date && !rec.done) set({ daily: { ...rec, done: true } })
      },

      upgradeCost: (id) => {
        const u = UPGRADE_BY_ID.get(id)!
        const level = get().upgrades[id] ?? 0
        return u.baseCost + u.step * level
      },

      buyUpgrade: (id) => {
        const u = UPGRADE_BY_ID.get(id)
        if (!u) return
        const { watchMarks, upgrades } = get()
        const level = upgrades[id] ?? 0
        if (level >= u.maxLevel) return
        // A service behind a feat cannot be bought before the feat.
        if (!get().purchasable(id)) return sfx('error')
        const cost = get().upgradeCost(id)
        if (watchMarks < cost) return sfx('error')
        set({ watchMarks: watchMarks - cost, upgrades: { ...upgrades, [id]: level + 1 } })
        sfx('confirm')
      },

      unlocked: (id) => (get().upgrades[id] ?? 0) > 0,

      achieved: (id) => !!get().achievements[id],

      purchasable: (id) => {
        const u = UPGRADE_BY_ID.get(id)
        return !!u && (!u.requires || !!get().achievements[u.requires])
      },

      recordCodex: (seen) => {
        const cur = get().codex
        const merge = (a: string[], b?: string[]) => (b && b.some((x) => !a.includes(x)) ? [...a, ...b.filter((x, i) => !a.includes(x) && b.indexOf(x) === i)] : a)
        const next: Codex = {
          enemies: merge(cur.enemies, seen.enemies),
          relics: merge(cur.relics, seen.relics),
          specs: merge(cur.specs, seen.specs),
          perks: merge(cur.perks, seen.perks),
          felled: cur.felled,
        }
        if (next.enemies !== cur.enemies || next.relics !== cur.relics || next.specs !== cur.specs || next.perks !== cur.perks) set({ codex: next })
      },

      recordFelled: (byKey) => {
        const cur = get().codex
        const felled = addFelled(cur.felled, byKey)
        if (felled) set({ codex: { ...cur, felled } })
      },

      grantMarks: (n: number) => set({ watchMarks: get().watchMarks + Math.max(0, Math.round(n)) }),

      grantRunRewards: ({ depth, won, kills, mode = 'campaign', banner = 0, ranked = true, daily = null, facts }) => {
        const { watchMarks, stats, sacrificeTier, achievements } = get()
        // The scored Daily attempt records its result on the record it claimed
        // at hero-pick — and only that one, and only once.
        const rec = get().daily
        const dailyNext =
          daily && rec && rec.date === daily && !rec.done && mode !== 'endless'
            ? {
                ...rec,
                depth: Math.max(0, num(depth, 0)),
                won,
                kills: Math.max(0, num(kills, 0)),
                score: dailyScore(num(depth, 0), num(kills, 0), won),
                done: true,
              }
            : rec
        // **One multiplier, and you have to earn it.** The formula used to fold
        // in `sacrificeTier` (a permanent bonus for a permanent penalty, paid
        // whether the run was hard or not) and then the Chronicler hub line (a
        // flat rebate on every run forever). What is left is the Banner the run
        // actually flew — a bet the player placed at the start of THIS march —
        // multiplied by how far the march got.
        const markMult = bannerRules(banner).markMult
        const isEndless = mode === 'endless'
        // Endless is routed through the Vow the player has won (Phase 3b) —
        // once the Ten Rounds feat opens it; before that it pays unmultiplied.
        const runMarks = isEndless
          ? endlessMarks(depth, achievements.endless_ten ? stats.bestBanner : 0)
          : Math.round((num(depth, 0) * 8 + (won ? 120 : 0)) * markMult)
        // Feats: judged on the facts this run leaves, earned once, each paying
        // its purse on top of the run's marks.
        const feats = facts ? newlyEarned(facts, achievements) : []
        const runsDone = num(stats.runsCompleted, 0) + 1
        const featMarks = feats.reduce((a, f) => a + f.marks, 0)
        const earned = runMarks + featMarks
        lastFeats.ids = feats.map((f) => f.id)
        // **Earned, not bought.** A campaign win under Banner N opens Banner
        // N+1 (an unbannered win opens Banner 1). The flown Banner is clamped to
        // what this save has open, so a hand-edited payload cannot skip rungs.
        // Unlocking changes nothing about any run by itself — it adds a rung
        // the next run may choose to fly.
        const flown = Math.max(0, Math.min(num(sacrificeTier, 0), Math.floor(num(banner, 0))))
        const nextTier =
          won && !isEndless && ranked
            ? Math.max(num(sacrificeTier, 0), Math.min(MAX_BANNER, flown + 1))
            : num(sacrificeTier, 0)
        // Every read is coerced: this is `x + n` arithmetic over a persisted
        // record, and one field arriving as `undefined` from an older save
        // would turn a stat into NaN permanently (M11).
        set({
          watchMarks: num(watchMarks, 0) + earned,
          sacrificeTier: nextTier,
          daily: dailyNext,
          achievements: feats.length ? { ...achievements, ...Object.fromEntries(feats.map((f) => [f.id, runsDone])) } : achievements,
          stats: {
            // Campaign depth and Endless rounds are different achievements and
            // are recorded as such — an Endless run used to update nothing at
            // all, and folding its round count into `bestDepth` would have made
            // the campaign record a lie instead (M13 / M33).
            bestDepth: isEndless ? num(stats.bestDepth, 0) : Math.max(num(stats.bestDepth, 0), num(depth, 0)),
            bestRound: isEndless ? Math.max(num(stats.bestRound, 0), num(depth, 0)) : num(stats.bestRound, 0),
            // Clamped to the ladder: a record is a rung that exists (F8).
            bestBanner:
              won && !isEndless
                ? Math.max(num(stats.bestBanner, 0), Math.min(MAX_BANNER, Math.max(0, num(banner, 0))))
                : num(stats.bestBanner, 0),
            totalKills: num(stats.totalKills, 0) + num(kills, 0),
            runsCompleted: num(stats.runsCompleted, 0) + 1,
            runsWon: num(stats.runsWon, 0) + (won ? 1 : 0),
          },
        })
        return earned
      },

      bonuses: () => {
        const { upgrades } = get()
        const lvl = (id: string) => upgrades[id] ?? 0
        return {
          maxBaseHp: BASE_MAX_HP + lvl('base') * 5,
          startGold: BASE_GOLD + lvl('gold') * 25,
          statBonus: lvl('stats'),
          extraSentinels: lvl('roster'),
          extraItems: lvl('loot'),
          // Nothing the hub sells makes the world harder any more. Difficulty is
          // opted into per run, by Banner, and it is earned by winning (H16).
          enemyHpMult: 1,
        }
      },

      resetMeta: () =>
        set({ watchMarks: 0, upgrades: {}, sacrificeTier: 0, stats: freshStats(), daily: null, achievements: {}, codex: freshCodex() }),
    }),
    {
      name: 'fieldwatch-meta',
      version: META_VERSION,
      storage: createJSONStorage(() => safePersistStorage),
      partialize: (s) => ({
        watchMarks: s.watchMarks,
        upgrades: s.upgrades,
        sacrificeTier: s.sacrificeTier,
        stats: s.stats,
        daily: s.daily,
        achievements: s.achievements,
        codex: s.codex,
      }),
      migrate: migrateMeta,
      // `migrate` only runs when the stored version differs, so the coercion is
      // also applied through `merge` — that way a payload that is the current
      // version but corrupt (hand-edited, half-written on a crash) still lands
      // as defaults instead of NaN.
      merge: (persisted, current) => ({ ...current, ...migrateMeta(persisted, META_VERSION) }),
    },
  ),
)

// Another tab's marks/perks land here instead of being overwritten by this
// tab's stale copy on its next save (see onStorageKeyChange).
onStorageKeyChange('fieldwatch-meta', () => void useMetaStore.persist.rehydrate())
