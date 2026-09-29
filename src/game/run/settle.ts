/**
 * What a retired run is owed. Pure: the facts of a run in, the one ledger call
 * to make out. The store's `settleSavedRun` (src/state/game/settle.ts) decides
 * WHICH run to settle and guarantees it is settled once; this decides what
 * settling it pays.
 */
import type { RunChallenge } from '../../state/daily'

export type SettleMode = 'campaign' | 'endless'

/** What a settle needs to know about the run it is retiring. */
export interface SettleFacts {
  mode: SettleMode
  depth: number
  kills: number
  downs: number
  wins: number
  /** The Banner the run flew — it scales the payout (H16). */
  banner: number
  /** Daily / custom seed: a scored Daily records its result, a custom seed is unranked. */
  challenge: RunChallenge
}

/** The Daily / ladder arguments every campaign settle passes to `grantRunRewards`. */
export const challengeGrant = (c: RunChallenge) => ({
  ranked: c.kind !== 'seeded',
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
export const runWasPlayed = (f: SettleFacts): boolean => f.depth > 0 || f.kills > 0 || f.downs > 0

/** The arguments `metaStore.grantRunRewards` takes, as a settle builds them. */
export interface RunGrant {
  mode?: SettleMode
  depth: number
  won: boolean
  kills: number
  downs: number
  banner?: number
  ranked?: boolean
  daily?: string | null
}

export type PayoutPlan =
  | { kind: 'none' }
  /** A scored Daily abandoned before its first clear: close the day's attempt at depth 0. */
  | { kind: 'closeDaily'; date: string }
  | { kind: 'grant'; grant: RunGrant }

/**
 * The payout for a retired, un-won run.
 *
 * `unlockedBanners` is the Watchtower's `sacrificeTier`: the Banner a stored
 * payload claims is validated against what this save has opened, exactly as a
 * resume is (F8) — nothing else stands between a hand-edited `runBanner: 5` on a
 * fresh Watchtower and a ×3.4 payout.
 */
export function planPayout(f: SettleFacts, unlockedBanners: number): PayoutPlan {
  if (f.mode === 'endless') {
    // Endless settles through the same ledger as the campaign (M13): the
    // Chronicler multiplier and the lifetime stats apply to it too.
    if (!runWasPlayed(f)) return { kind: 'none' }
    return { kind: 'grant', grant: { mode: 'endless', depth: f.wins, won: false, kills: f.kills, downs: f.downs } }
  }
  if (!runWasPlayed(f)) {
    // A scored Daily abandoned before its first clear is still the day's
    // attempt: close it at depth 0 rather than leave it "under way" forever.
    if (f.challenge.kind === 'daily' && f.challenge.scored && f.challenge.date) return { kind: 'closeDaily', date: f.challenge.date }
    return { kind: 'none' }
  }
  const banner = Math.min(f.banner, unlockedBanners)
  return { kind: 'grant', grant: { depth: f.depth, won: false, kills: f.kills, downs: f.downs, banner, ...challengeGrant(f.challenge) } }
}
