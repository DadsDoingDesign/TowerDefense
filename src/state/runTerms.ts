/**
 * The terms of the run being set up on hero-pick: what its seed is, whether it
 * can be changed, whether a Vow can be sworn on it, and — on a Daily Watch —
 * what committing a hero will cost.
 *
 * One pure table, read by BOTH the store (which enforces it) and every hero-pick
 * layout (which says it), so the screen cannot offer what the store refuses.
 * That is exactly what went wrong before: the Vow chips rendered on a Daily and
 * `setRunBanner` silently ignored them, and the seed field on a Daily quietly
 * turned the day's run into a custom-seed run.
 *
 * The rules themselves are the Daily's, from `daily.ts`: a Daily is one set of
 * standard rules for everyone that day — no hub, no Banner — so there is no Vow
 * to choose and no seed to change. A player who wants their own seed starts an
 * ordinary run and types it there.
 */
import type { RunChallenge, RunKind } from './daily'

/** The meta save's record of the day's claimed attempt — the two fields that matter here. */
export interface DailyClaim {
  date: string
  done: boolean
}

/** What committing a hero to a Daily will be: the day's scored attempt, or practice. */
export type DailyAttempt = 'scored' | 'practice'

/** A Vow is a hub rule, and a Daily reads no hub: never on a Daily. */
export const vowAllowed = (c: RunChallenge): boolean => c.kind !== 'daily'

/** A Daily's seed IS the Daily; typing another one would make it a different run. */
export const seedEditable = (c: RunChallenge): boolean => c.kind !== 'daily'

/**
 * Whether a hero committed to this Daily will be the day's scored attempt.
 * Mirrors `metaStore.beginDaily`: the attempt is spent the moment ANY hero was
 * committed to that day's seed, finished or not. Null when the run is not a Daily.
 */
export function dailyAttempt(c: RunChallenge, claim: DailyClaim | null | undefined): DailyAttempt | null {
  if (c.kind !== 'daily' || !c.date) return null
  return claim?.date === c.date ? 'practice' : 'scored'
}

export interface RunTerms {
  kind: RunKind
  /** The seed control's visible text: "Seed 93200335", "Custom seed 424242", "Daily · 2026-09-30". */
  seedLabel: string
  /** The seed control's accessible name — the visible text plus what pressing it does. */
  seedName: string
  /** Whether the seed can be typed over. */
  editable: boolean
  /** Whether a Vow can be sworn. */
  vow: boolean
  /** On a Daily, what picking a hero spends. */
  attempt: DailyAttempt | null
  /**
   * The run's terms in plain sentences, or empty for an ordinary random run
   * (which needs none). The first line is the one that matters most.
   */
  lines: string[]
}

export function runTerms(c: RunChallenge, seed: number, claim: DailyClaim | null | undefined): RunTerms {
  const attempt = dailyAttempt(c, claim)
  if (c.kind === 'daily') {
    return {
      kind: c.kind,
      seedLabel: `Daily · ${c.date}`,
      seedName: `Daily Watch ${c.date}, seed ${seed}. Today's seed is the same for everyone and cannot be changed.`,
      editable: false,
      vow: false,
      attempt,
      lines: [
        attempt === 'scored'
          ? "Picking a hero uses today's one scored attempt."
          : "Today's scored attempt is used — this run is practice.",
        'Standard rules: no Watchtower perks, no Vow.',
      ],
    }
  }
  if (c.kind === 'seeded') {
    return {
      kind: c.kind,
      seedLabel: `Custom seed ${seed}`,
      seedName: `Custom seed ${seed}. Change the seed`,
      editable: true,
      vow: true,
      attempt: null,
      lines: ['Custom seed · not ranked.', "Pays Marks, but a win won't unlock a Vow."],
    }
  }
  return {
    kind: c.kind,
    seedLabel: `Seed ${seed}`,
    seedName: `Seed ${seed}, random. Play a set seed instead`,
    editable: true,
    vow: true,
    attempt: null,
    lines: [],
  }
}
