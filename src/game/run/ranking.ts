/**
 * ---------------------------------------------------------------------------
 * Whether a run counts for a ranking (the gameplay pass, October 2026)
 * ---------------------------------------------------------------------------
 *
 * The designer: "make assist mode mark the game in a way that it won't be
 * counted for leader boards". The assist dial (`settingsStore.assistProfile`,
 * M34) softens what a raider steals, and it is live on purpose — it helps the
 * run you are losing — so a run is **assisted** the moment the dial is off
 * `off` at any point of it, and stays assisted: turning the dial back off
 * mid-run never clears the mark (`markAssisted`).
 *
 * The prior art it follows: Celeste's Assist Mode marks the save file it was
 * used on and leaves the game otherwise whole; Hades' God Mode keeps every
 * reward and says only that it is on. So an assisted run keeps its
 * progression — gold, standing, unlocks, feats, the trade war — and is left
 * out of the RECORD surfaces only: today the best depth and best stake
 * (`metaStore.stats`) and the per-stake record ("your record" on the terms
 * and the city). Any leaderboard or ranking added later reads this one
 * function and nothing else.
 *
 * A custom seed (`challenge.kind === 'seeded'`) is not ranked either: it
 * already pays its gold and earns nothing else (`settle.contractGrant`).
 *
 * Pure: no store, no React, no DOM.
 */

/** What a ranking needs to know about a run: was assist ever on, and was it a custom seed. */
export interface RankingFacts {
  /** Assist was on at some point of the run (`GameData.assisted`). */
  assisted?: boolean
  /** The run's challenge: a custom seed is unranked. */
  challenge?: { kind: string } | null
}

/**
 * THE gate: true when a run may count toward a leaderboard, a ranking or a
 * record. Every ranked surface — today's records, and any leaderboard added
 * later — must call this, never read `assisted` itself.
 */
export function countsForRanking(run: RankingFacts): boolean {
  if (run.assisted === true) return false
  if (run.challenge?.kind === 'seeded') return false
  return true
}

/**
 * The run's mark after the dial is read at `level`: once assisted, always
 * assisted. `level` is the assist level's id (`'off'` | `'steady'` |
 * `'sure'`); anything but `'off'` marks the run.
 */
export const markAssisted = (assisted: boolean, level: string): boolean => assisted || level !== 'off'

/** The marker's word, on the HUD, the result and the receipt. */
export const ASSISTED_TAG = 'Assisted'
