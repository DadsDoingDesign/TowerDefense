/**
 * Pure rules around one battle of a run: its combat seed, the XP it pays, and
 * what an Endless round is worth. The settlement that applies them lives in the
 * store's battle slice (`src/state/game/battleSlice.ts`).
 */
import { hashSeed } from '../core/rng'
import { applyXp, evolutionPending } from '../engine/leveling'
import type { Sentinel } from '../types'

/**
 * The combat seed for one battle. Deterministic in (run seed, node, wave), so a
 * replayed run replays its fights exactly, while two different nodes never share
 * a roll sequence.
 */
export function combatSeed(runSeed: number, nodeKey: string, wave: number): number {
  return hashSeed(runSeed, 'combat', nodeKey, wave)
}

/**
 * The roster after a wave's XP lands, and the heroes that now owe a branch
 * choice. XP + evolution apply in both modes and both outcomes.
 */
export function applyBattleXp(
  roster: Sentinel[],
  perSentinel: readonly { id: string; xpGained: number }[],
): { roster: Sentinel[]; evolutionQueue: string[] } {
  const xpById = new Map(perSentinel.map((p) => [p.id, p.xpGained]))
  const next = roster.map((s) => applyXp(s, xpById.get(s.id) ?? 0))
  return { roster: next, evolutionQueue: next.filter(evolutionPending).map((s) => s.id) }
}

/** What clearing an Endless round pays: every 10th is a boss, every other 5th an elite. */
export function endlessRoundSpoils(round: number): {
  isBoss: boolean
  isElite: boolean
  dustGain: number
  lootCount: number
  luck: number
} {
  const isBoss = round % 10 === 0
  const isElite = !isBoss && round % 5 === 0
  return {
    isBoss,
    isElite,
    dustGain: 5 + (isElite ? 5 : 0) + (isBoss ? 15 : 0),
    lootCount: isBoss ? 3 : isElite ? 2 : 1,
    luck: Math.min(0.45, round * 0.03),
  }
}
