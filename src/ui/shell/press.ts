/**
 * One-tap commits (October 2026, audit §4 designer item 8): what a press on a
 * one-tap option meant. Pure — no React, no DOM — so the rules are unit-tested
 * (`tests/press.test.ts`) and `oneTap.tsx` only gathers the numbers.
 *
 * Rewards and the campfire commit on a tap. Everything else a finger can do to
 * the same card must NOT commit:
 *
 *  - **hold** — a press held for `HOLD_MS` shows the option's detail; letting
 *    go afterwards does nothing, so "look before you take" is still there;
 *  - **drag** — a press that travels more than `SLOP_PX` was a scroll, not a
 *    choice (a reward row can scroll sideways, a board scrolls down);
 *  - **too soon** — a press that starts within `ARRIVAL_MS` of the surface
 *    appearing is the tail of whatever the player was tapping before (a
 *    double-tap on the last screen's button), not a reading of this one.
 *
 * A keyboard activation (Enter or Space on the focused option) has no travel
 * and no hold; it is a tap that started when it landed, so only the arrival
 * guard can refuse it.
 */

/** How long a press must be held to read as "show me" rather than "take it". */
export const HOLD_MS = 350
/** How far (CSS px) a press may travel and still be a tap. */
export const SLOP_PX = 8
/** Presses that start this soon after the surface appeared are ignored. */
export const ARRIVAL_MS = 250

export type PressKind = 'tap' | 'hold' | 'drag' | 'tooSoon'

export interface Press {
  /** When the surface holding the option appeared (ms, same clock as below). */
  shownAt: number
  /** When the press began (pointer down, or the key's activation). */
  downAt: number
  /** When it ended (pointer up, or the key's activation). */
  upAt: number
  /** The farthest the pointer got from where it went down, in CSS px. */
  travel: number
  /** The press was cancelled by the browser (it became a scroll). */
  cancelled?: boolean
}

/**
 * Classify one press. The order is the guard order: a press that is too early
 * is refused whatever else it did, a press that moved is a scroll however
 * long it lasted, and only a still, short press commits.
 */
export function classifyPress(p: Press): PressKind {
  if (p.downAt - p.shownAt < ARRIVAL_MS) return 'tooSoon'
  if (p.cancelled || p.travel > SLOP_PX) return 'drag'
  if (p.upAt - p.downAt >= HOLD_MS) return 'hold'
  return 'tap'
}

/** True only for the one kind of press that commits. */
export const commits = (p: Press): boolean => classifyPress(p) === 'tap'

/** The straight-line distance between two points — the press's travel. */
export const travelOf = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(b.x - a.x, b.y - a.y)
