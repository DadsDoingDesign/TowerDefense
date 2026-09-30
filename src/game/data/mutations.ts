import { nextId, type RNG } from '../core/rng'
import type { EffectMods, Mutation } from '../types'

/**
 * Three mutations used to also grant a free level of an upgrade path
 * (`grantUpgrade`). The paths are spec perks now (Phase 3b), so the level each
 * one granted is folded into its own mods at the same value: Quickdraw's Tempo
 * L1 (×1.12 rate), Siege Weight's Onslaught L1 (×1.15 damage), Executioner's
 * Precision L1 (+14% crit). Nothing about what the card does changed.
 */
/**
 * Two templates (Phase 3b). The review found every mutation was one shape — a
 * big reshaping of the attack (splash, chains, pierce, rate) paid for with
 * "−N% damage per hit". `reshape` is that shape, kept. `rule` is the second:
 * a TRIGGER the attack did not have — a cadence, a rush, a last stand — whose
 * price is a real cost on another axis rather than always the hit.
 */
export type MutationTemplate = 'reshape' | 'rule'
interface MutTemplate { key: string; name: string; desc: string; downside: string; mods: EffectMods; template?: MutationTemplate }

/**
 * Attack mutations — the game's Mythic-tier reward, and the most consequential
 * choice a hero ever makes: one per hero, permanent, no reroll.
 *
 * **The rule every entry here obeys (M7/M9).** A mutation *re-shapes* how a hero
 * attacks; it is not a stat stick with a warning label. So its raw throughput —
 * `damageMult × rateMult` — is at or below 1.0 whenever it also gains reach,
 * area, pierce, chain or a status, and above 1.0 only when it gives one of those
 * up. The consequence is the point: every mutation is *clearly* better on one
 * shape of wave and *clearly* worse on another, and the `downside` string states
 * the number the engine actually applies.
 *
 * Before this rule, six of the eleven were pure upside wearing a tradeoff label
 * (balance §8 measured Volatile / Chain / Pierce / Rapid / Incendiary / Cryo at
 * +48pt in their *worst* scenario) and two — Overcharge and Concussive — were
 * negative everywhere, i.e. traps. Both failures came from the same place: the
 * downside was priced at 12–20% while the upside multiplied the number of
 * enemies a shot touches.
 *
 * **And one number in here was never measured honestly at all** until the
 * `updateEnemies` iterator bug was fixed — see `Incendiary` below, which the
 * bug had been paying an invisible subsidy for the life of the project. Any
 * entry carrying `burn`, `trap` or another over-time effect is graded on a
 * different baseline since that fix; the only one that had to move was
 * Incendiary, and it moved a long way.
 */
const MUTATIONS: MutTemplate[] = [
  {
    key: 'volatile',
    name: 'Blasting Powder',
    desc: 'Every shot detonates in a wide blast — but the round itself is mostly casing.',
    downside: '−55% damage per hit, −15% attack speed',
    mods: { splashAdd: 50, damageMult: 0.45, rateMult: 0.85 },
  },
  {
    key: 'chain',
    name: 'Chain Arc',
    desc: 'The strike forks to 3 more enemies for 55% of its force — and the first one barely feels it.',
    downside: '−60% damage on the main hit',
    mods: { shock: { chains: 3, dmgFrac: 0.55 }, damageMult: 0.4 },
  },
  {
    key: 'pierce',
    name: 'Piercing Volley',
    desc: 'Needle-thin bolts punch through 3 enemies and fire 30% faster — each one lands like a splinter.',
    downside: '−70% damage per hit',
    mods: { pierce: 3, rateMult: 1.3, damageMult: 0.3 },
  },
  {
    key: 'rapid',
    name: 'Quickdraw',
    desc: 'Over twice the rate of fire (×2.24), and no time to aim any of it.',
    downside: '−62% damage per hit',
    mods: { rateMult: 2.24, damageMult: 0.38 },
  },
  {
    key: 'heavy',
    name: 'Siege Weight',
    desc: 'One devastating 3.2× shell per reload. Anything small is a waste of it.',
    downside: '−50% attack speed',
    mods: { damageMult: 3.22, rateMult: 0.5 },
  },
  /**
   * ---- re-costed against an honest baseline (F1-B) --------------------------
   *
   * This entry was `burn 45/s over 4s` for `−20% attack speed, −10% damage`, and
   * §8 measured it at **−4.4 / −6.3 / −5.2pt** — negative in all three
   * scenarios, i.e. one of the two strictly-bad trap picks the §12 invariant
   * exists to forbid. It had been passing for the life of the project on a
   * measurement that was not real: `updateEnemies` walked the live enemy array
   * while `killEnemy` spliced it, so every damage-over-time kill deleted the
   * body standing behind it *uncounted* — no gold, no XP, and no leak damage
   * either. That silently credited every burn with the bodies it made vanish.
   * With the iterator fixed the same card measured −6.3pt at its best.
   *
   * The re-cost is a magnitude change, not a shape change.
   *
   * ---- and the argument that used to be given for it was false (M5) ---------
   *
   * This comment used to justify the size by saying the −attack-speed downside
   * "was paying a bill its upside could not read", because "burn does not stack
   * and does not scale with attack rate". The first clause is true: `applyHit`
   * writes one `burnDps` per enemy and takes the strongest, so a second ignition
   * *on the same target* adds nothing. The second does not follow from it, and
   * it is wrong wherever this card is worth taking. Against a **queue** — which
   * `armour` and `line` both are, and which is the only place a 4-second DoT
   * outlives its target — each shot ignites a *different* body, so ignition
   * throughput is proportional to rate exactly the way ordinary damage is.
   *
   * Swept on the shipped card (burn 180/4s, damage ×0.8), varying only the rate:
   *
   *   rateMult   0.35    0.50    0.70*   1.00    1.40
   *   swarm     −21.1   −15.6    −7.8    +0.0   +12.2
   *   armour    −12.5    +2.1   +12.5   +39.6   +52.1
   *   line       +0.6    +7.8   +23.0   +26.2   +35.8      (* = shipped)
   *
   * Monotone increasing in all three columns, +0.6 → +35.8pt on `line` alone. So
   * the −30% rate is a real bill and the upside reads it fine; what the entry
   * was actually correcting was a baseline that had never been honest (above).
   * The numbers below are unchanged — only the reasoning was wrong, and a
   * comment that mis-explains a live number is how the next re-cost goes wrong.
   *
   * At **180/s over 4s** for `−30% attack speed, −20% damage` (raw throughput
   * ×0.56, inside the rule above because it gains a status) §8 measures
   * **−7.8pt on `swarm`, +12.5pt on `armour`, +23.0pt on `line`** — and the
   * shape of that row is the design. `swarm` is 90 Torch Runts that die to one
   * hit, so nothing ever burns and the card is pure cost; `armour` and `line`
   * are fights long enough for the burn to be the reason a body dies. That is
   * "clearly better on one shape of wave and clearly worse on another", stated
   * as numbers rather than asserted. Stable at 12 seeds (−7.8 / +10.4 / +23.9).
   */
  {
    key: 'incendiary',
    name: 'Emberbrand',
    desc: 'Every hit sets the target burning for 180/s over 4s — the ignition takes a moment.',
    downside: '−30% attack speed, −20% damage',
    mods: { burn: { dps: 180, dur: 4 }, rateMult: 0.7, damageMult: 0.8 },
  },
  {
    key: 'cryo',
    name: 'Hoarfrost',
    desc: 'A freezing burst that halves the speed of everything it touches — and barely scratches it.',
    downside: '−70% damage per hit',
    mods: { chill: { slow: 0.55, dur: 3 }, splashAdd: 34, damageMult: 0.3 },
  },
  {
    key: 'executioner',
    name: 'Executioner',
    desc: 'Finishes anything under 38% HP outright, and crits 29% more often — you take your time.',
    downside: '−20% attack speed',
    mods: { execute: 0.38, critChanceAdd: 0.29, rateMult: 0.8 },
  },
  /**
   * ---- the outlier §8 could not fail, re-costed onto an axis (M5) -----------
   *
   * (The card also once said "heals the base for 50% of damage". The engine
   * heals `damage × lifedrain × 0.02` — `engine.LIFEDRAIN_SCALE` — so the card
   * overstated it by 45×. `describe.ts` quotes the same per-100 number; keep all
   * three in step (H5).)
   *
   * At `lifedrain 0.55 / rangeMult 0.78` this was **+7.4 / −4.2 / +54.6pt** on
   * §8's three scenarios: rank 1 of 11 on `line` at **z = +2.77**, thirty-one
   * points clear of the runner-up, and above the −17…+51pt spread this module's
   * own doc claims for the tier. §8 could not fail it, because both its checks
   * were floors — a mutation had to move *at least* 3pt in each direction and
   * nothing bounded how far up. (Pushing Incendiary's burn to 300/s scores
   * −7.8 / +31.3 / +25.0 and passes the old form too.) There is a ceiling now.
   *
   * The card was also holding its tradeoff certificate by an accident. Its only
   * negative column was `armour` at −4.2pt — two leak points against a −3.0pt
   * floor — and it is not a cost, it is a **range cliff**. Sweeping `rangeMult`
   * with everything else fixed:
   *
   *   rangeMult   0.60    0.68    0.72    0.78*   0.85    1.00
   *   armour     −47.9   −47.9   −47.9    −4.2    +0.0    +0.0
   *   line       −18.6   +18.5   +25.3   +54.6   +51.5   +51.4   (* = shipped)
   *
   * The shipped point sits three pixels of reach above a discontinuity where
   * `armour` falls 47.9pt and `line` halves. At 12 seeds instead of 4 the same
   * card reads **−2.8pt** on `armour` and fails the cost floor outright.
   *
   * So the cost moves onto the axis the upside is made of. Life-drain is paid
   * out of damage dealt, so buying it *with* damage is self-limiting — a weaker
   * hit drains less — and it costs most exactly where the drain is worth least:
   * a 30%-resistant armour queue, where the card now reads −16.7pt (−18.1 at 12
   * seeds) with no cliff anywhere near it. The whole neighbourhood
   * `lifedrain 0.34–0.46 × damage 0.66–0.74` holds the same three signs
   * (`swarm` +6.4…+8.6, `armour` −16.7…−18.8, `line` +21.9…+31.5), so the pass
   * is a basin. Measured at 0.40/0.70: **+7.5 / −16.7 / +26.8pt**.
   *
   * ---- and onto attack speed, after heroes lost their HP (no-HP pass) --------
   *
   * With a Weaponmaster that no longer falls, the damage bill stopped costing
   * anything (`armour` +33.9pt) while the drain ran on. Paid in attack speed
   * instead — the `swarm` bench is rate-bound, so that is where it bites — at
   * 0.25 drain / ×0.6 rate §8 reads **−12.0 / −1.4 / +22.0pt**, 10pt clear of
   * the `line` runner-up rather than the 17.6pt 0.30/×0.65 left it.
   */
  {
    key: 'siphon',
    name: 'Siphon',
    desc: 'Damage feeds the Gate: +0.5 Gate HP per 100 damage dealt — and every strike takes a moment to draw.',
    downside: '−40% attack speed',
    mods: { lifedrain: 0.25, rateMult: 0.6 },
  },
  // Stormcharged (`overcharge`: ×1.9 range, +20% crit, +0.8 crit damage, −45%
  // attack speed) was cut with the no-HP pass: §8 measured it negative on all
  // three benches (best −2.1pt before the change, −6.5pt after), and no rate it
  // was swept at bought a positive column. A saved one still works as saved.
  // ---- the `rule` template (Phase 3b) -------------------------------------
  {
    key: 'ricochet',
    name: 'Ricochet',
    desc: 'Every 3rd shot tears through everything within its reach — and every shot lands lighter.',
    downside: '−35% damage per hit',
    mods: { volley: { every: 3, pierce: 99 }, damageMult: 0.65 },
    template: 'rule',
  },
  {
    key: 'frenzy',
    name: 'Blood Frenzy',
    desc: 'Every kill doubles its rate of fire for 2 seconds; between kills it swings wild.',
    downside: '−35% damage per hit',
    mods: { killRush: { rate: 1, dur: 2 }, damageMult: 0.65 },
    template: 'rule',
  },
  {
    key: 'salvo',
    name: 'Opening Salvo',
    desc: 'Fires at 2.5× speed for the first 20s of every wave, then settles into a slow reload.',
    downside: '−40% attack speed after the opening',
    mods: { openingRush: { rate: 1.5, dur: 20 }, rateMult: 0.6 },
    template: 'rule',
  },
  // Cornered (below half its HP, ×2.3 damage; −25% attack speed) went with
  // hero HP — a saved one is dropped on load (`runSnapshot`, v10 → v11).
  {
    key: 'concussive',
    name: 'Concussive',
    desc: 'A relentless flurry: 55% of hits stagger for 1.1s, and every one of them lands light.',
    downside: '−58% damage per hit',
    mods: { stunChance: 0.55, stunDur: 1.1, rateMult: 1.5, damageMult: 0.42 },
  },
]

/** How many mutations a fork offers the player to choose between (M8) — two under Vow 1. */
export const MUTATION_OFFER_SIZE = 3

/** The Crossroads' mutation offer: two under Vow 1, and one more with the Strange Growth feat. */
export const mutationOfferSize = (thinPickings: boolean, strangeGrowth: boolean): number =>
  (thinPickings ? 2 : MUTATION_OFFER_SIZE) + (strangeGrowth ? 1 : 0)

/** Which template a mutation is. Everything that predates Phase 3b is `reshape`. */
export const mutationTemplate = (key: string): MutationTemplate => MUTATIONS.find((m) => m.key === key)?.template ?? 'reshape'

function toMutation(t: MutTemplate, id: string): Mutation {
  return { id, key: t.key, name: t.name, desc: t.desc, rarity: 'mythic', downside: t.downside, mods: t.mods }
}

/*
 * `rollMutation(rng, exclude)` — one blind roll, applied straight to a hero —
 * used to live here and was the store's only entry point. It is gone rather
 * than deprecated: the fork now deals `rollMutationChoices` into run state and
 * the player picks (M8), and leaving a one-shot roller in the module is leaving
 * the loaded gun that the next caller reaches for.
 */

/**
 * Roll a small *choice* of distinct mutations (M8).
 *
 * A mutation is Mythic, permanent, unrepeatable and spans a −21pt…+52pt value
 * spread depending on the wave shape ahead (§8, and the +52 is the `swarm`
 * bench's own ceiling — a 47.8% baseline cannot be moved further than that) — so
 * handing the player one blind
 * roll at the fork is the game's most consequential decision with no decision in
 * it. Offering `MUTATION_OFFER_SIZE` distinct options turns the roll into a read
 * of the run: "I have no answer to armour, so I take Heavy Ordnance."
 */
export function rollMutationChoices(
  rng: RNG,
  exclude: string[] = [],
  count = MUTATION_OFFER_SIZE,
): Mutation[] {
  const pool = MUTATIONS.filter((m) => !exclude.includes(m.key))
  const src = pool.length >= count ? [...pool] : [...MUTATIONS]
  const out: Mutation[] = []
  // An offer of two or more always holds BOTH templates when the pool has them
  // (Phase 3b): a reshape and a rule, so the fork is a choice of kind, not
  // three variations on "−N% damage per hit".
  if (count >= 2) {
    for (const tpl of ['rule', 'reshape'] as const) {
      const of = src.filter((m) => (m.template ?? 'reshape') === tpl)
      if (!of.length) continue
      const t = rng.pick(of)
      src.splice(src.indexOf(t), 1)
      out.push(toMutation(t, nextId('mut')))
    }
  }
  while (out.length < count && src.length > 0) {
    const t = rng.pick(src)
    src.splice(src.indexOf(t), 1)
    out.push(toMutation(t, nextId('mut')))
  }
  return out
}

/** One of every mutation (for balance tooling and previews). */
export function allMutations(): Mutation[] {
  return MUTATIONS.map((t) => toMutation(t, `mut_${t.key}`))
}

/**
 * The CURRENT display name for a mutation key.
 *
 * Six mutations were renamed (Wave 1 copy pass — Volatile Rounds → Blasting
 * Powder, Heavy Ordnance → Siege Weight, Rapid Fire → Quickdraw, Cryo Blast →
 * Hoarfrost, Overcharge → Stormcharged, Incendiary → Emberbrand). A hero that
 * took one before the rename carries the OLD `name` in its saved run, because a
 * `Mutation` is copied onto the hero whole. The key never changed, so every
 * render site reads the name through here and a resumed save shows the new one.
 */
export function mutationName(key: string, fallback: string): string {
  return MUTATIONS.find((m) => m.key === key)?.name ?? CUT_MUTATION_NAMES[key] ?? fallback
}

/** Names for mutations cut from the pool that a saved hero may still carry. */
const CUT_MUTATION_NAMES: Readonly<Record<string, string>> = { overcharge: 'Stormcharged' }
