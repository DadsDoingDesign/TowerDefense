/**
 * What a retired run is owed. Pure: the facts of a run in, the one ledger call
 * to make out. The store's `settleSavedRun` (src/state/game/settle.ts) decides
 * WHICH run to settle and guarantees it is settled once; this decides what
 * settling it pays.
 */
import type { RunChallenge } from '../../state/daily'
import type { RunFacts } from '../data/achievements'
import type { Sentinel } from '../types'
import type { HeroStyle } from '../data/items'
import { actOf } from './threat'

/**
 * What a run tracks for the feats (Phase 3b) — the few facts a settle cannot
 * read back off the finished run's roster and map. Snapshotted with the run.
 */
export interface RunFeats {
  /** What the first hero fought with when the march began (its weapon's style). */
  starter: HeroStyle | null
  /** Company size when the march began (the leader plus any hub extras). */
  startSize: number
  maxFielded: number
  actBosses: number
  flawlessBosses: number
  goldPeak: number
}
export const freshFeats = (): RunFeats => ({ starter: null, startSize: 0, maxFielded: 0, actBosses: 0, flawlessBosses: 0, goldPeak: 0 })

/** The facts a settled run's feats are judged on. */
export function runFacts(v: {
  mode: 'campaign' | 'endless'
  won: boolean
  feats: RunFeats
  roster: readonly Pick<Sentinel, 'mutations'>[]
  deepestLayer: number
  difficulty: number
  wins: number
  dailyScored: boolean
  goblinsSeen: number
}): RunFacts {
  return {
    mode: v.mode,
    won: v.won,
    starter: v.feats.starter,
    hires: Math.max(0, v.roster.length - v.feats.startSize),
    maxFielded: v.feats.maxFielded,
    act: v.deepestLayer > 0 ? actOf(v.deepestLayer) : 1,
    flawlessBosses: v.feats.flawlessBosses,
    actBosses: v.feats.actBosses,
    mutated: v.roster.some((s) => (s.mutations?.length ?? 0) > 0),
    goldPeak: v.feats.goldPeak,
    difficulty: v.difficulty,
    rounds: v.wins,
    daily: v.dailyScored,
    goblinsSeen: v.goblinsSeen,
  }
}

/** Distinct goblin KINDS in a Codex list (a Warded Bomber is still a Bomber). */
export const goblinKinds = (enemyIds: readonly string[]): number => new Set(enemyIds.map((id) => id.split('_')[0])).size

export type SettleMode = 'campaign' | 'endless'

/** What a settle needs to know about the run it is retiring. */
export interface SettleFacts {
  mode: SettleMode
  depth: number
  kills: number
  wins: number
  /** The difficulty step the run was played at — it scales the payout (SK1). */
  difficulty: number
  /** Daily / custom seed: a scored Daily records its result, a custom seed is unranked. */
  challenge: RunChallenge
  /** The facts the feats are judged on, when the settle has them (Phase 3b). */
  facts?: RunFacts
}

/**
 * The Daily / climb arguments every campaign settle passes to `grantRunRewards`.
 * Only an ordinary run counts toward the difficulty climb (SK1): a custom seed
 * can be shopped for an easy map, and a Daily is standard rules.
 */
export const challengeGrant = (c: RunChallenge) => ({
  ranked: c.kind === 'standard',
  daily: c.kind === 'daily' && c.scored ? c.date : null,
})

/**
 * A campaign run only counts as one you PLAYED (m-6).
 *
 * `grantRunRewards` increments `runsCompleted` unconditionally, so a settle of a
 * never-played run must skip the grant entirely — a run that cleared nothing and
 * killed nothing earns nothing either way, and granting it would add a
 * completed run to the record for zero marks.
 */
export const runWasPlayed = (f: SettleFacts): boolean => f.depth > 0 || f.kills > 0

/** The arguments `metaStore.grantRunRewards` takes, as a settle builds them. */
export interface RunGrant {
  mode?: SettleMode
  depth: number
  won: boolean
  kills: number
  difficulty?: number
  ranked?: boolean
  daily?: string | null
  facts?: RunFacts
}

export type PayoutPlan =
  | { kind: 'none' }
  /** A scored Daily abandoned before its first clear: close the day's attempt at depth 0. */
  | { kind: 'closeDaily'; date: string }
  | { kind: 'grant'; grant: RunGrant }

/**
 * The payout for a retired, un-won run.
 *
 * `topDifficulty` is the Watchtower's: the step a stored payload claims is
 * validated against what this save has reached, exactly as a resume is (F8) —
 * nothing else stands between a hand-edited `runDifficulty: 9` on a fresh
 * Watchtower and a ×3.25 payout.
 */
export function planPayout(f: SettleFacts, topDifficulty: number): PayoutPlan {
  if (f.mode === 'endless') {
    // Endless settles through the same ledger as the campaign (M13): the
    // Chronicler multiplier and the lifetime stats apply to it too.
    if (!runWasPlayed(f)) return { kind: 'none' }
    return { kind: 'grant', grant: { mode: 'endless', depth: f.wins, won: false, kills: f.kills, ...(f.facts ? { facts: f.facts } : {}) } }
  }
  if (!runWasPlayed(f)) {
    // A scored Daily abandoned before its first clear is still the day's
    // attempt: close it at depth 0 rather than leave it "under way" forever.
    if (f.challenge.kind === 'daily' && f.challenge.scored && f.challenge.date) return { kind: 'closeDaily', date: f.challenge.date }
    return { kind: 'none' }
  }
  const difficulty = Math.min(f.difficulty, topDifficulty)
  return {
    kind: 'grant',
    grant: { depth: f.depth, won: false, kills: f.kills, difficulty, ...challengeGrant(f.challenge), ...(f.facts ? { facts: f.facts } : {}) },
  }
}
