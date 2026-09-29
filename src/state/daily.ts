/**
 * Daily Watch and custom seeds (Phase 1).
 *
 * The seed infrastructure has been there since WS1 — every map, wave, loot roll
 * and combat roll hangs off one run seed — but the only thing that ever chose a
 * seed was `newRunSeed()`. This file is the rest of it: a seed everybody shares
 * for a UTC day, and a seed the player types in.
 */
import { hashSeed } from '../game/core/rng'

/**
 * What kind of run this is, beyond campaign/endless.
 *
 *  - `standard` — a fresh random seed, the player's hub and Banner.
 *  - `daily` — today's shared seed under **standard rules** (no hub bonuses or
 *    unlocks, no Banner), so the map, the waves and the offers are the same for
 *    everyone who plays it that day. The first run a player *commits a hero to*
 *    each UTC day is the scored one; later ones that day are practice.
 *  - `seeded` — a seed the player typed. Their own hub and Banner apply, so a
 *    receipt seed replays the run it came from; it pays its marks but does not
 *    count toward the Banner ladder (a seed can be shopped for an easy map).
 */
export type RunKind = 'standard' | 'daily' | 'seeded'

export interface RunChallenge {
  kind: RunKind
  /** The UTC day (`YYYY-MM-DD`) a Daily Watch belongs to. */
  date: string | null
  /** Whether this run is the day's scored Daily attempt. */
  scored: boolean
}

export const STANDARD_RUN: RunChallenge = { kind: 'standard', date: null, scored: false }

/** `YYYY-MM-DD` for the UTC day containing `now`. */
export function utcDateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * The shared seed for a UTC day: a stable FNV-1a hash of the date string, so
 * every client on every platform derives the same number with no server.
 */
export function dailySeed(dateKey: string): number {
  return hashSeed('fieldwatch-daily', dateKey)
}

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

/** Coerce a stored challenge (snapshot or meta) back to a valid one. */
export function migrateChallenge(raw: unknown): RunChallenge {
  if (!raw || typeof raw !== 'object') return STANDARD_RUN
  const o = raw as Record<string, unknown>
  const kind: RunKind = o.kind === 'daily' || o.kind === 'seeded' ? o.kind : 'standard'
  const date = typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : null
  if (kind === 'daily' && !date) return STANDARD_RUN
  return { kind, date: kind === 'daily' ? date : null, scored: kind === 'daily' && o.scored === true }
}

/** The day's score: depth first, kills as the tie-break, a win on top. */
export const dailyScore = (depth: number, kills: number, won: boolean): number =>
  Math.max(0, Math.floor(depth)) * 100 + Math.max(0, Math.floor(kills)) + (won ? 1000 : 0)
