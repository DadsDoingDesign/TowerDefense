import type { EnemyBehaviour, EnemyBehaviourKind, EnemyType } from '../types'

/**
 * ---------------------------------------------------------------------------
 * The enemy behaviour kit (Phase 3a)
 * ---------------------------------------------------------------------------
 *
 * Before this file every goblin was HP, speed, reward, leak and two
 * resistances: fifteen enemies that were three stat profiles at five sizes.
 * "TNT bombers" did not bomb and the bosses were long HP bars.
 *
 * Heroes have no HP (the no-HP rule change): nothing here hurts a hero. The
 * TNT kit — sappers, bombers, the Powderkeg King — hurts the GATE instead.
 *
 * Each behaviour below is a declarative capability (`EnemyType.behaviours`)
 * that the engine resolves in one place per kind. Each one ships with four
 * things, and a behaviour missing any of them is not done:
 *
 *   1. a TELEGRAPH — drawn by `src/game/render/telegraphs.ts` off engine state
 *      (`engine.telegraphs` for moments, enemy fields for standing states);
 *   2. an EVENT — `behaviour:<kind>` / `bossPhase` through `engine.onEvent`, for
 *      the audio director and the UI;
 *   3. a COUNTERPLAY a player can say out loud (below, `BEHAVIOUR_INFO`);
 *   4. a MEASUREMENT — `engine.behaviourStats` counts what it did, and the
 *      balance report's §16 shows the counter moving that number.
 *
 * ### Faction identity, by tier
 *
 * The tier a node fields is set by depth (`waves.ts` → `roster`), so assigning
 * behaviours by tier is also a TEACHING ORDER: depths 2–3 meet one new idea
 * (the Fuse Whelp's blast at the Gate), depths 4–5 meet two (bomber lobs, the
 * Roller's vault), depths 6–8 meet the support casters (shaman, shield-bearer)
 * and the heavier lob, and depths 9–10 the berserker, the big sapper and the
 * splitter. Elites run one tier hot, so they preview the next band early.
 *
 *   torch  (rushers)   shaman heal pulse (specialist) · berserker enrage (torch4)
 *   tnt    (bombers)   sapper blast (tnt1, tnt4) · lobbed charge (tnt2, tnt3)
 *   barrel (tanks)     vault (barrel2) · shield-bearer (specialist) · split (barrel4)
 *
 * ### Why the casters are SPECIALISTS and the rest are the base type
 *
 * A behaviour that acts on a body — enrage, vault, split, a blast on arrival —
 * can sit on every member of a rank without changing what the rank is. A
 * behaviour that acts on OTHER enemies cannot: a column where every Ironbarrel
 * projects a shield is a column with +20% resist, which is just a stat, and
 * the decision it is supposed to create ("kill the bearer first") has no
 * answer when everything is a bearer. So the healer and the shield are carried
 * by a few named specialists carved OUT of a rank (`SPECIALISTS`, applied in
 * `waves.ts` → `roster`), never added on top of it — the node's head count and
 * budget stay what they were.
 *
 * Specialists keep the base type's `id` (its art identity — the renderer draws
 * them as the goblin they are, with a telegraph on top) and get their own
 * registry KEY (`torch3_shaman`), exactly the two-identity rule the elite
 * modifiers already follow, and they compose with those modifiers
 * (`torch3_shaman_plated`).
 */

// ---------------------------------------------------------------- the numbers

/**
 * Gate-damage numbers are NOT Threat-scaled, on purpose. Threat multiplies
 * enemy HP (how long a body lives), and a blast is a property of the TNT, not
 * of how tough the goblin carrying it is. They are in Gate points (the Gate
 * holds 20), on top of the body's own leak when it walks through.
 *
 * The King's TNT is a clock, not a target: every 8s from 3s in, and every 4s
 * once he is below half, whatever the line does — so a company that cannot
 * race him down pays for every second he lives.
 */
export const HEAL_PULSE: Extract<EnemyBehaviour, { kind: 'healPulse' }> = {
  kind: 'healPulse',
  radius: 110,
  heal: 0.06,
  interval: 3,
}

export const BERSERK: Extract<EnemyBehaviour, { kind: 'enrage' }> = {
  kind: 'enrage',
  below: 0.4,
  speedMult: 1.5,
}

/**
 * A sapper that reaches the Gate blows there for `gateDamage` on top of its
 * leak; one a blocker holds goes off at the wall for nothing (the blocker's
 * kill). So a blocker on the road is the answer, and so is killing it early.
 *
 * **The TNT leak was split, not added to.** A TNT goblin that walks the whole
 * road costs the Gate exactly what it did before the no-HP pass — Fuse Whelp
 * 1 + 1, Bomber 1 + 1, Demolisher 2 + 1, Sapper 1 + 2 (leak + blast), against
 * the old 2 / 2 / 3 / 3 — so every node's leak ceiling, and with it the
 * budget solve and §14's fairness gates, is unchanged. What changed is how
 * the blast can be dodged: hold the sapper, kill the bomber in its wind-up.
 */
export const WHELP_SAPPER: Extract<EnemyBehaviour, { kind: 'sapper' }> = {
  kind: 'sapper',
  radius: 80,
  gateDamage: 1,
}

export const SAPPER: Extract<EnemyBehaviour, { kind: 'sapper' }> = {
  kind: 'sapper',
  radius: 90,
  gateDamage: 2,
}

/**
 * A bomber that gets within `range` px of the Gate (along the road) plants and
 * throws its charge at it. Only one charge is ever in the air; a bomber that
 * finds a live mark walks on. Kill it in the wind-up and the throw never lands.
 */
export const BOMBER_LOB: Extract<EnemyBehaviour, { kind: 'lob' }> = {
  kind: 'lob',
  range: 450,
  radius: 55,
  gateDamage: 1,
  windup: 1.6,
  charges: 1,
}

export const DEMOLISHER_LOB: Extract<EnemyBehaviour, { kind: 'lob' }> = {
  kind: 'lob',
  range: 500,
  radius: 60,
  gateDamage: 1,
  windup: 1.4,
  charges: 1,
}

export const SPLITTER: Extract<EnemyBehaviour, { kind: 'split' }> = {
  kind: 'split',
  into: 'barrel1',
  count: 2,
  hpFrac: 0.25,
}

export const SHIELD_AURA: Extract<EnemyBehaviour, { kind: 'shieldAura' }> = {
  kind: 'shieldAura',
  radius: 95,
  resist: 0.2,
}

export const VAULT: Extract<EnemyBehaviour, { kind: 'leap' }> = {
  kind: 'leap',
  distance: 110,
}

export const GRUKK_WARCRY: Extract<EnemyBehaviour, { kind: 'warCry' }> = {
  kind: 'warCry',
  at: [0.66, 0.33],
  windup: 0.8,
  radius: 260,
  speedMult: 1.4,
  dur: 4,
}

export const KING_LOB: Extract<EnemyBehaviour, { kind: 'kingLob' }> = {
  kind: 'kingLob',
  interval: 8,
  first: 3,
  windup: 1.5,
  radius: 60,
  gateDamage: 1,
  rageAt: 0.5,
  rageInterval: 4,
}

export const COLOSSUS_SPLIT: Extract<EnemyBehaviour, { kind: 'bossSplit' }> = {
  kind: 'bossSplit',
  at: 0.5,
  count: 2,
  hpShare: 0.75,
  speedMult: 1.15,
  radius: 24,
}

/** No resistance may pass this — the same cap the elite modifiers obey. */
export const RESIST_CAP = 0.55

// ---------------------------------------------------------------- specialists

/**
 * A specialist carved out of a faction rank. `from` is the faction; `minTier`
 * the first tier that fields it; `every` is how many bodies of the rank buy one
 * specialist (rounded, with a floor of one once the rank has `minRank` bodies).
 */
export interface Specialist {
  suffix: string
  faction: 'torch' | 'tnt' | 'barrel'
  minTier: number
  every: number
  minRank: number
  name: string
  behaviour: EnemyBehaviour
  /** Multiplier on the base type's HP — a caster is a little frailer than the rank it walks in. */
  hpMult: number
}

export const SPECIALISTS: readonly Specialist[] = [
  { suffix: 'shaman', faction: 'torch', minTier: 3, every: 7, minRank: 4, name: 'Torch Shaman', behaviour: HEAL_PULSE, hpMult: 0.9 },
  { suffix: 'bearer', faction: 'barrel', minTier: 3, every: 4, minRank: 3, name: 'Shieldbearer', behaviour: SHIELD_AURA, hpMult: 1 },
]

/** How many of a rank of `n` bodies become this specialist. */
export function specialistCount(sp: Specialist, tier: number, n: number): number {
  if (tier < sp.minTier || n < sp.minRank) return 0
  return Math.max(1, Math.min(n - 1, Math.round(n / sp.every)))
}

/** Build the specialist's type from its base tier type. */
export function makeSpecialist(base: EnemyType, sp: Specialist): EnemyType {
  return {
    ...base,
    // The art identity stays the goblin it is (see the file note).
    id: base.id,
    name: sp.name,
    baseHp: Math.round(base.baseHp * sp.hpMult),
    behaviours: [...(base.behaviours ?? []), sp.behaviour],
  }
}

// ---------------------------------------------------------------- the reading

/**
 * What each behaviour is, how it shows, and how to beat it — the sentence the
 * UI can print and the one the balance report measures. `counter` is the
 * claim; §16 of the report is the evidence.
 */
export const BEHAVIOUR_INFO: Record<EnemyBehaviourKind, { label: string; telegraph: string; counter: string }> = {
  healPulse: {
    label: 'Heals nearby goblins',
    telegraph: 'green ring pulses out from the shaman',
    counter: 'focus it first (Threat targeting) — every pulse it lives through undoes a volley',
  },
  enrage: {
    label: 'Enrages when wounded',
    telegraph: 'red flame over it below 40% health',
    counter: 'burst it through the threshold, or chill it — slows still apply to the enraged pace',
  },
  sapper: {
    label: 'Blows up at your wagons, stealing extra cargo',
    telegraph: 'lit fuse over it; blast ring where it goes off',
    counter: 'kill it on the approach, or hold it with a blocker: a held sapper goes off harmlessly and counts as the blocker\'s kill',
  },
  lob: {
    label: 'Lobs a charge at your wagons when it gets close',
    telegraph: 'target circle on the wagons while it winds up',
    counter: 'kill it during the wind-up (Threat targeting), or before it gets near the wagons',
  },
  split: {
    label: 'Breaks apart when destroyed',
    telegraph: 'crack mark on it; burst when it breaks',
    counter: 'splash — the pieces spawn together and die together (and guns further down the lane for any that do not)',
  },
  shieldAura: {
    label: 'Shields goblins around it',
    telegraph: 'blue ring around the bearer, pip over every shielded goblin',
    counter: 'kill the bearer first — the shield is its, not theirs',
  },
  leap: {
    label: 'Vaults the first blocker',
    telegraph: 'up-chevron until it has jumped; arc when it does',
    counter: 'a second blocker further down the lane, or ranged damage before it arrives',
  },
  warCry: {
    label: 'War-cry at two-thirds and one-third health',
    telegraph: 'expanding red ring during the wind-up',
    counter: 'Flare or chill the column after the cry; save Rally Horn for the burst through a threshold',
  },
  kingLob: {
    label: 'Lobs TNT at your wagons every few seconds, faster once wounded',
    telegraph: 'large target circle on the wagons while it winds up',
    counter: 'race it down: every second it lives is another throw',
  },
  bossSplit: {
    label: 'Splits in two at half health',
    telegraph: 'crack widens; two halves roll on',
    counter: 'splash and pierce — two bodies share what one had left',
  },
}

/** Every behaviour kind a type carries (for previews and the report). */
export const behaviourKinds = (t: EnemyType): EnemyBehaviourKind[] => (t.behaviours ?? []).map((b) => b.kind)

/** First behaviour of a kind on a type, typed. */
export function behaviourOf<K extends EnemyBehaviourKind>(
  t: EnemyType,
  kind: K,
): Extract<EnemyBehaviour, { kind: K }> | undefined {
  return t.behaviours?.find((b) => b.kind === kind) as Extract<EnemyBehaviour, { kind: K }> | undefined
}

/**
 * What a champion's boss phases look like right now, for the nameplate
 * (`BossPlate` → `.sh-bossplate-extra`): how many phases it has, how many
 * have fired, and one line naming the next (or the last). `phase` is the
 * engine's `RtEnemy.phase`. Null for anything without a phase behaviour.
 */
export function bossPhaseInfo(t: EnemyType, phase: number): { total: number; done: number; label: string } | null {
  for (const b of t.behaviours ?? []) {
    if (b.kind === 'warCry') {
      const next = b.at[phase]
      return { total: b.at.length, done: phase, label: next !== undefined ? `war-cry at ${Math.round(next * 100)}%` : 'war-cries spent' }
    }
    if (b.kind === 'kingLob') return { total: 1, done: phase, label: phase ? 'enraged — throwing fast' : `rages at ${Math.round(b.rageAt * 100)}%` }
    if (b.kind === 'bossSplit') return { total: 1, done: phase, label: phase ? 'split' : `splits at ${Math.round(b.at * 100)}%` }
  }
  // A Colossus half has had its split removed — it IS the second act.
  return t.name.endsWith('(half)') ? { total: 1, done: 1, label: 'split' } : null
}
