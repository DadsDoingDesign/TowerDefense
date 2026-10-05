/**
 * Custom seeds (Phase 1; the Daily Watch that shared this file is gone — the
 * mercenary company removed it, the endgame charter replaces it later).
 *
 * Every map, wave, loot roll and combat roll hangs off one run seed. A
 * contract deals its own (`run/contracts`, from the board's seed and the
 * company); a player may type another on the hero pick to replay a receipt.
 */
import { hashSeed } from '../game/core/rng'

/**
 * What kind of run this is:
 *
 *  - `standard` — the seed the contract board dealt.
 *  - `seeded` — a seed the player typed. It plays and pays its gold like any
 *    contract, but it earns no standing and unlocks nothing: a typed seed can
 *    be shopped for an easy road.
 */
export type RunKind = 'standard' | 'seeded'

export interface RunChallenge {
  kind: RunKind
}

export const STANDARD_RUN: RunChallenge = { kind: 'standard' }
export const SEEDED_RUN: RunChallenge = { kind: 'seeded' }

/**
 * A typed seed. A plain unsigned integer is used as-is (so the number printed
 * on a receipt replays that run); any other text is hashed, so "tuesday" is a
 * seed too. Empty or whitespace is null.
 */
export function parseSeed(input: string): number | null {
  const t = input.trim()
  if (!t) return null
  if (/^\d{1,10}$/.test(t)) {
    const n = Number(t)
    if (n >= 1 && n <= 0xffffffff) return n
  }
  return hashSeed('fieldwatch-seed', t)
}

/**
 * Coerce a stored challenge (snapshot) back to a valid one. A Daily saved
 * before the Daily was removed resumes as a standard run on its own seed.
 */
export function migrateChallenge(raw: unknown): RunChallenge {
  if (!raw || typeof raw !== 'object') return STANDARD_RUN
  return (raw as Record<string, unknown>).kind === 'seeded' ? SEEDED_RUN : STANDARD_RUN
}
