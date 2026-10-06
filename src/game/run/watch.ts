/**
 * The Watch's long game (SK1): Watch XP and Watch levels, the skill cards they
 * unlock, and the difficulty steps a win climbs. Pure — the meta store
 * (`state/metaStore.ts`) applies these at the end of a run, the hero pick reads
 * the pool, and the balance harness prices the same numbers.
 *
 * The designer: "As you play you unlock levels of progress and you get a
 * random skill every so often when leveling (this should not be super slow at
 * first but it shouldnt unlock all the cards easily). If you beat the game you
 * get a skill each time. but each time you beat the game the difficulty goes
 * up a bit. you can turn it back down but you dont get another skill unless
 * you beat your score when you win at the same difficulty."
 */
import { hashSeed, RNG } from '../core/rng'
import { ALL_SKILLS, FEAT_SKILLS, RANDOM_UNLOCK_SKILLS, STARTER_SKILLS } from '../data/skills'
import { UNLOCK_ITEM_KINDS } from '../data/itemKinds'

// ---------------------------------------------------------------------------
// Watch XP and Watch levels
// ---------------------------------------------------------------------------

/**
 * Watch XP a finished run earned: 15 a depth reached, 1 per 10 enemies felled,
 * and 60 for a win. Kept for the meta migration and for the curve standing
 * reuses (`run/standing.ts`); nothing earns Watch XP any more.
 *
 * Fitted to the harness's first-timer line (REPORT §11 — a zero-meta run dies
 * around depth 5–8 with ~150–300 kills): a first run earns ~90–150, a win
 * ~260. Watch level 2 costs 80, so the first card lands after the first run.
 */
export const WATCH_XP = { perDepth: 15, killsPerXp: 10, win: 60 } as const

/**
 * XP from Watch level `n` to `n + 1`: 80, then 20 more each level. So the
 * first levels arrive about a run apart and the twentieth costs 460 — four
 * losing runs, or a win and a half. The twenty random cards cost 5,400 XP in
 * all: dozens of runs, not a weekend.
 */
export const watchLevelCost = (n: number): number => 80 + 20 * (Math.max(1, Math.floor(n)) - 1)

/** Cumulative Watch XP to reach `level` (level 1 = 0). */
export function watchXpToReach(level: number): number {
  let t = 0
  for (let n = 1; n < Math.floor(level); n++) t += watchLevelCost(n)
  return t
}

export const MAX_WATCH_LEVEL = 99

/** The Watch level a cumulative XP total is. */
export function watchLevelFor(xp: number): number {
  let level = 1
  while (level < MAX_WATCH_LEVEL && xp >= watchXpToReach(level + 1)) level++
  return level
}

/** Where a total sits: its level, and XP into and needed for the next. */
export function watchProgress(xp: number): { level: number; into: number; need: number } {
  const level = watchLevelFor(xp)
  return { level, into: Math.max(0, xp - watchXpToReach(level)), need: watchLevelCost(level) }
}

// ---------------------------------------------------------------------------
// Skill cards
// ---------------------------------------------------------------------------

/**
 * ---------------------------------------------------------------------------
 * The one unlock roll — generic on purpose
 * ---------------------------------------------------------------------------
 *
 * "Unlock one random thing still locked, from pool P, at tier >= R" — the
 * shape every unlock in the game takes, whatever pays for it. Today two
 * SOURCES feed it (a Watch level, a card-paying win) and two POOLS sit behind
 * it (skill cards, item kinds); a later economy can add sources (a company's
 * standing, a contract, an item pull) or narrow a pool (one company's cards,
 * `Skill.company` / `ItemKind.company`) by passing a different `pool`,
 * `filter` or `minTier`, without touching the roll. Pure: the result is a
 * function of the save and the `salt` (the meta store passes the source's name,
 * the run count and a counter), so nothing can be rerolled.
 */
export interface UnlockRoll<T extends string = string> {
  /** Everything this source could ever open, in a stable order. */
  pool: readonly T[]
  /** What is open already (never dealt again). */
  have: readonly string[]
  /** The tier of an entry (a skill's level; an item kind has none: 1). */
  tierOf?: (id: T) => number
  /** Deal only entries at this tier or above. */
  minTier?: number
  /** Any further narrowing (one company's entries, say). */
  filter?: (id: T) => boolean
  /** Hash parts that name this roll: the pool's own tag first. */
  salt: readonly (string | number)[]
}

/** One random entry of `pool` still locked (and passing the filters), or null. */
export function rollFromPool<T extends string>(r: UnlockRoll<T>): T | null {
  const have = new Set(r.have)
  const min = r.minTier ?? -Infinity
  const locked = r.pool.filter((id) => !have.has(id) && (r.tierOf ? r.tierOf(id) : 1) >= min && (!r.filter || r.filter(id)))
  if (!locked.length) return null
  return locked[Math.floor(new RNG(hashSeed(...r.salt)).next() * locked.length)]
}

const skillLevelOf = (id: string): number => ALL_SKILLS.find((k) => k.id === id)?.level ?? 1

/**
 * One random skill card still locked, or null when every random card is open
 * (`rollFromPool` over the random cards). `salt` seeds it.
 */
export function rollUnlock(unlocked: readonly string[], ...salt: (string | number)[]): string | null {
  return rollFromPool({ pool: RANDOM_UNLOCK_SKILLS, have: unlocked, tierOf: skillLevelOf, salt: ['skill-unlock', ...salt] })
}

/**
 * One random item KIND still locked, or null when every kind is open — the
 * item half of the shared unlock track (the classless rework). Each Watch
 * level and each card-paying win deals one skill card AND one item kind while
 * both remain (`metaStore.grantRunRewards`), so both grow at the pace SK1 set
 * for skills: fast early (Watch level 2 costs 80 XP, about one run), slower
 * later (each level costs 20 XP more). The 17 kinds run out around Watch
 * level 15 for a player who also wins; the 27 random skill cards go on longer.
 */
export function rollItemUnlock(unlocked: readonly string[], ...salt: (string | number)[]): string | null {
  return rollFromPool({ pool: UNLOCK_ITEM_KINDS, have: unlocked, salt: ['item-unlock', ...salt] })
}

/**
 * The skills a run can deal: the starters, every card unlocked, and the feat
 * cards whose feat is earned — in library order.
 */
export function skillPoolFor(unlocked: readonly string[], achieved: (id: string) => boolean): string[] {
  const have = new Set([...STARTER_SKILLS, ...unlocked])
  return ALL_SKILLS.filter((k) => have.has(k.id) || (FEAT_SKILLS[k.id] && achieved(FEAT_SKILLS[k.id]))).map((k) => k.id)
}

// ---------------------------------------------------------------------------
// Difficulty — the dial a contract's stake turns (one step a crate)
// ---------------------------------------------------------------------------
//
// SK1's difficulty steps replaced the Vow ladder; the mercenary company turned
// the step into the stake (`contracts.stakeRules`): every crate carried is
// one step — enemies 19% stronger and one more elite an act — and the payout
// for it is the stake's (crate sales, the completion bonus, item chances).

/** The highest difficulty step there is. */
export const MAX_DIFFICULTY = 10
/**
 * Enemy strength each step adds (on the run's starting Threat). 0.08 → **0.19**
 * (October audit, designer item 1). At 0.08 a crate cost nothing measurable:
 * the veteran's ladder (§13c, which carries the scouts, so every stake elite
 * has a way round it) read 29.5% → 19.8% over eight crates, steps of −16% to
 * +13% relative inside a ±2.5pt paired noise, and REPORT §13 failed six of
 * eight "every crate costs" checks. The economy audit proposed 0.15; with the
 * eased road below (`threat.ACT_STEPS`) 0.15 left the veteran's max stake at
 * 18–20% against its 10–20% band, so 0.19 puts it mid-band. Measured at n=600
 * (`tune.ts 600 contract`): veteran 39% → 17% over eight crates (≈10% a crate
 * on the fit), zero meta 27% → 6.5% (≈16% a crate).
 */
export const STRENGTH_PER_STEP = 0.19
/** Battle nodes per act each step turns into elites. */
export const ELITES_PER_STEP = 1

/** Everything a run needs to know about the difficulty step it is played at. */
export interface DifficultyRules {
  step: number
  /** The Threat the run starts at: 1 + 19% a step. */
  startThreat: number
  /** Battle nodes in each act that become elites. */
  extraElites: number
}

export const clampStep = (step: number): number => Math.max(0, Math.min(MAX_DIFFICULTY, Math.floor(Number.isFinite(step) ? step : 0)))

export function difficultyRules(step: number): DifficultyRules {
  const s = clampStep(step)
  return {
    step: s,
    startThreat: Math.round((1 + STRENGTH_PER_STEP * s) * 1000) / 1000,
    extraElites: s * ELITES_PER_STEP,
  }
}

/** "Enemies 24% stronger · 3 more elites an act" — what a step does, in words. */
export function difficultyEffect(step: number): string {
  const r = difficultyRules(step)
  if (r.step === 0) return 'Standard raiders.'
  return `Raiders ${Math.round((r.startThreat - 1) * 100)}% stronger · ${r.extraElites} more elite${r.extraElites === 1 ? '' : 's'} an act`
}
