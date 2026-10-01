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

// ---------------------------------------------------------------------------
// Watch XP and Watch levels
// ---------------------------------------------------------------------------

/**
 * Watch XP a finished run earns: 15 a depth reached, 1 per 10 enemies felled,
 * and 60 for a win. An Endless round counts as 10.
 *
 * Fitted to the harness's first-timer line (REPORT §11 — a zero-meta run dies
 * around depth 5–8 with ~150–300 kills): a first run earns ~90–150, a win
 * ~260. Watch level 2 costs 80, so the first card lands after the first run.
 */
export const WATCH_XP = { perDepth: 15, killsPerXp: 10, win: 60, perRound: 10 } as const

export function watchXpFor(r: { mode?: 'campaign' | 'endless'; depth: number; kills: number; won: boolean }): number {
  const d = Math.max(0, Math.floor(r.depth || 0))
  const k = Math.max(0, Math.floor(r.kills || 0))
  const base = r.mode === 'endless' ? d * WATCH_XP.perRound : d * WATCH_XP.perDepth
  return base + Math.floor(k / WATCH_XP.killsPerXp) + (r.won && r.mode !== 'endless' ? WATCH_XP.win : 0)
}

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
 * One random card still locked, or null when every random card is open.
 * `salt` seeds it (the meta store passes the run count and the card count),
 * so the roll is a pure function of the save — no stream, nothing to reroll.
 */
export function rollUnlock(unlocked: readonly string[], ...salt: (string | number)[]): string | null {
  const have = new Set(unlocked)
  const locked = RANDOM_UNLOCK_SKILLS.filter((id) => !have.has(id))
  if (!locked.length) return null
  return locked[Math.floor(new RNG(hashSeed('skill-unlock', ...salt)).next() * locked.length)]
}

/**
 * The skills a run can deal: the starters, every card unlocked, and the feat
 * cards whose feat is earned — in library order.
 */
export function skillPoolFor(unlocked: readonly string[], achieved: (id: string) => boolean): string[] {
  const have = new Set([...STARTER_SKILLS, ...unlocked])
  return ALL_SKILLS.filter((k) => have.has(k.id) || (FEAT_SKILLS[k.id] && achieved(FEAT_SKILLS[k.id]))).map((k) => k.id)
}

/**
 * The Daily Watch's pool: the starters, for everyone. A Daily reads no hub, so
 * the same seed deals the same heroes, skills and offers whatever a player
 * has unlocked.
 */
export const DAILY_SKILL_POOL: readonly string[] = STARTER_SKILLS

// ---------------------------------------------------------------------------
// Difficulty — what replaced the Vow ladder
// ---------------------------------------------------------------------------

/** The highest difficulty step there is. */
export const MAX_DIFFICULTY = 10
/** Enemy strength each step adds (on the run's starting Threat). */
export const STRENGTH_PER_STEP = 0.08
/** Battle nodes per act each step turns into elites. */
export const ELITES_PER_STEP = 1
/** Marks multiplier each step adds. */
export const MARKS_PER_STEP = 0.25

/** Everything a run needs to know about the difficulty step it is played at. */
export interface DifficultyRules {
  step: number
  /** The Threat the run starts at: 1 + 8% a step. */
  startThreat: number
  /** Battle nodes in each act that become elites. */
  extraElites: number
  /** Marks multiplier for the run. */
  markMult: number
}

export const clampStep = (step: number): number => Math.max(0, Math.min(MAX_DIFFICULTY, Math.floor(Number.isFinite(step) ? step : 0)))

export function difficultyRules(step: number): DifficultyRules {
  const s = clampStep(step)
  return {
    step: s,
    startThreat: Math.round((1 + STRENGTH_PER_STEP * s) * 1000) / 1000,
    extraElites: s * ELITES_PER_STEP,
    markMult: Math.round((1 + MARKS_PER_STEP * s) * 100) / 100,
  }
}

/** "Enemies 24% stronger · 3 more elites an act" — what a step does, in words. */
export function difficultyEffect(step: number): string {
  const r = difficultyRules(step)
  if (r.step === 0) return 'Standard enemies and elites.'
  return `Enemies ${Math.round((r.startThreat - 1) * 100)}% stronger · ${r.extraElites} more elite${r.extraElites === 1 ? '' : 's'} an act`
}

/** A won run's score at its difficulty (the Daily's formula: depth ×100 + kills + 1000). */
export const winScore = (depth: number, kills: number): number => Math.max(0, Math.floor(depth)) * 100 + Math.max(0, Math.floor(kills)) + 1000

/**
 * What a WIN at `step` earns, given the save's top step and its best score
 * there. A win at the top step unlocks a card and raises the top a step; a win
 * below it unlocks a card only when it beats that step's best score.
 */
export function winReward(v: { step: number; top: number; score: number; best: number | undefined }): { card: boolean; stepUp: boolean; newBest: boolean } {
  const step = clampStep(v.step)
  const top = clampStep(v.top)
  const newBest = v.best === undefined || v.score > v.best
  if (step >= top) return { card: true, stepUp: top < MAX_DIFFICULTY, newBest }
  return { card: newBest, stepUp: false, newBest }
}
