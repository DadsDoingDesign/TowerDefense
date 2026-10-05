/**
 * The campfire (Phase 3b): the rest stop the run never had.
 *
 * The review's finding was that the game had **no comeback**: the Gate never
 * regenerated, nothing sold it back, and the only answer to a bad leak was to
 * lose the run slower. A campfire offers ONE of two things, and the choice is
 * the point — Slay the Spire's rest-or-smith, in this game's nouns:
 *
 *  - **Rest** — the Gate recovers `CAMPFIRE_REPAIR`, capped at its maximum;
 *  - **Train** — one hero gains a full level (the XP to its next level).
 *
 * Pure: every function takes what it needs and returns the next value.
 */
import { applyXp, MAX_LEVEL, xpToReach } from '../engine/leveling'
import type { Sentinel } from '../types'

/** Gate HP a rest restores. About a third of a fresh Gate: a real save, not a reset. */
export const CAMPFIRE_REPAIR = 7

/*
 * The Field Kitchen's third choice (forage the road for gold) retired with the
 * Watchtower (the HQ, build step 3): road gold mostly stays on the road now,
 * so a forage was a weak stop, and the HQ keeps to its three offices.
 */

/** The Gate after resting at a campfire. Never above its maximum. */
export function restAtCampfire(baseHp: number, maxBaseHp: number): number {
  return Math.min(maxBaseHp, Math.max(0, baseHp) + CAMPFIRE_REPAIR)
}

/** How much a rest would actually restore right now (0 on a full Gate). */
export const restGain = (baseHp: number, maxBaseHp: number): number => restAtCampfire(baseHp, maxBaseHp) - Math.max(0, baseHp)

/** XP a hero needs to reach its next level from exactly where it stands. */
export function xpToNextLevel(s: Pick<Sentinel, 'level' | 'xp'>): number {
  if (s.level >= MAX_LEVEL) return 0
  return Math.max(0, xpToReach(s.level + 1) - s.xp)
}

/**
 * The hero after training: exactly one level, whatever XP it already had toward
 * the next. A max-level hero cannot train (it returns unchanged).
 */
export function trainAtCampfire(s: Sentinel): Sentinel {
  const need = xpToNextLevel(s)
  return need > 0 ? applyXp(s, need) : s
}

/** Whether a hero can still benefit from training. */
export const canTrain = (s: Pick<Sentinel, 'level'>): boolean => s.level < MAX_LEVEL
