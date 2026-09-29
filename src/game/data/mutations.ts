import { nextId, type RNG } from '../core/rng'
import type { EffectMods, Mutation, UpgradeGrant } from '../types'

interface MutTemplate { key: string; name: string; desc: string; downside: string; mods: EffectMods; grantUpgrade?: UpgradeGrant }

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
    name: 'Volatile Rounds',
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
    name: 'Rapid Fire',
    desc: 'Twice the rate of fire, and no time to aim any of it.',
    downside: '−62% damage per hit',
    mods: { rateMult: 2.0, damageMult: 0.38 },
    grantUpgrade: { path: 'tempo', levels: 1 },
  },
  {
    key: 'heavy',
    name: 'Heavy Ordnance',
    desc: 'One devastating 2.8× shell per reload. Anything small is a waste of it.',
    downside: '−50% attack speed',
    mods: { damageMult: 2.8, rateMult: 0.5 },
    grantUpgrade: { path: 'power', levels: 1 },
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
    name: 'Incendiary',
    desc: 'Every hit sets the target burning for 180/s over 4s — the ignition takes a moment.',
    downside: '−30% attack speed, −20% damage',
    mods: { burn: { dps: 180, dur: 4 }, rateMult: 0.7, damageMult: 0.8 },
  },
  {
    key: 'cryo',
    name: 'Cryo Blast',
    desc: 'A freezing burst that halves the speed of everything it touches — and barely scratches it.',
    downside: '−70% damage per hit',
    mods: { chill: { slow: 0.55, dur: 3 }, splashAdd: 34, damageMult: 0.3 },
  },
  {
    key: 'executioner',
    name: 'Executioner',
    desc: 'Finishes anything under 38% HP outright, and crits 15% more often — you take your time.',
    downside: '−20% attack speed',
    mods: { execute: 0.38, critChanceAdd: 0.15, rateMult: 0.8 },
    grantUpgrade: { path: 'precision', levels: 1 },
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
   */
  {
    key: 'siphon',
    name: 'Siphon',
    desc: 'Damage feeds the base: +0.8 base HP per 100 damage dealt — the strike gives up its bite to pay for it.',
    downside: '−30% damage per hit',
    mods: { lifedrain: 0.4, damageMult: 0.7 },
  },
  {
    key: 'overcharge',
    name: 'Overcharge',
    desc: 'A wound-up shot that reaches almost twice as far and lands like an execution — once in a long while.',
    downside: '−45% attack speed',
    mods: { rangeMult: 1.9, critChanceAdd: 0.2, critMultAdd: 0.8, rateMult: 0.55 },
  },
  {
    key: 'concussive',
    name: 'Concussive',
    desc: 'A relentless flurry: 55% of hits stagger for 1.1s, and every one of them lands light.',
    downside: '−58% damage per hit',
    mods: { stunChance: 0.55, stunDur: 1.1, rateMult: 1.5, damageMult: 0.42 },
  },
]

/** How many mutations a fork offers the player to choose between (M8). */
export const MUTATION_OFFER_SIZE = 3

function toMutation(t: MutTemplate, id: string): Mutation {
  return { id, key: t.key, name: t.name, desc: t.desc, rarity: 'mythic', downside: t.downside, mods: t.mods, grantUpgrade: t.grantUpgrade }
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
