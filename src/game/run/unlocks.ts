/**
 * Which content a feat opens, as the run applies it (Phase 3b). Pure: the
 * achievement ledger arrives as a predicate, so the store, the UI and the
 * balance harness (which models a player with no feats) ask the same question.
 */
import { childrenOf, type TreeNode } from '../data/archetypeTree'
import { LOCKED_SPECS } from '../data/achievements'
import { evolutionPending } from '../engine/leveling'
import type { Sentinel } from '../types'

/** Whether a tree node is open: every node is, except the feat-locked specs. */
export const specOpen = (nodeId: string, unlocked: (achievementId: string) => boolean): boolean =>
  !LOCKED_SPECS[nodeId] || unlocked(LOCKED_SPECS[nodeId])

/**
 * The evolutions a hero is offered: its branch's children, minus any spec still
 * behind a feat. Every branch keeps at least two open paths.
 */
export function availableEvolutions(s: Sentinel, unlocked: (achievementId: string) => boolean): TreeNode[] {
  if (!evolutionPending(s)) return []
  return childrenOf(s.branchPath[s.branchPath.length - 1]).filter((n) => specOpen(n.id, unlocked))
}

/** The evolutions shown locked (with the feat that opens them). */
export function lockedEvolutions(s: Sentinel, unlocked: (achievementId: string) => boolean): TreeNode[] {
  if (!evolutionPending(s)) return []
  return childrenOf(s.branchPath[s.branchPath.length - 1]).filter((n) => !specOpen(n.id, unlocked))
}
