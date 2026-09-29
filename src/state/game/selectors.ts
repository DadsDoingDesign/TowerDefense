/**
 * Pure reads over the store's state — safe to pass straight to
 * `useGameStore(selector)` or to call on a plain object in a test.
 */
import { RARITY } from '../../game/data/items'
import type { ItemRarity } from '../../game/types'
import type { GameData } from './types'

/**
 * The exact fields `canStartWave` reads. `GameState` satisfies it structurally,
 * so `useGameStore(canStartWave)` works — and so does calling it on a plain
 * object in a test.
 */
export type StartWaveGate = Pick<
  GameData,
  'screen' | 'runPhase' | 'mode' | 'currentWave' | 'lastResult' | 'engine' | 'battlePhase' | 'activeNodeId' | 'clearedNodeIds'
>

/**
 * Exactly the conditions `startWave` honours — exported so the UI can never
 * render an enabled "Start Wave" that the store then refuses (M-3).
 *
 * `startWave` calls this and nothing else, so the two cannot drift. A renderer
 * may add its own STRICTER gate on top (both UIs also require at least one
 * deployed Sentinel); it must never relax one. The soft-lock this exists to
 * kill was precisely a screen whose only control was a button the store
 * refused, on a state where nothing else rendered either.
 *
 * Pure, and deliberately so: it reads state and touches nothing, which is what
 * lets the UI ask the question as often as it likes.
 */
export function canStartWave(s: StartWaveGate): boolean {
  if (s.screen !== 'battle') return false
  if (s.runPhase !== 'active') return false
  if (!s.currentWave) return false
  // A wave that has already resolved can never be fought again.
  if (s.lastResult) return false
  if (s.engine) return false
  if (s.battlePhase !== 'setup') return false
  if (s.mode === 'campaign') {
    // No node, no campaign wave: there is nothing to pay out into.
    if (!s.activeNodeId) return false
    if (s.clearedNodeIds.includes(s.activeNodeId)) return false
  }
  return true
}

/**
 * A run is worth saving only while it is live and outside the Watchtower. A
 * finished run (won/lost) has already been paid out, so keeping its snapshot
 * would offer a resume into a dead run.
 *
 * `runSettled` is the third condition and the one that closes M-1: a run that
 * has been paid out is dead even though `runPhase` still reads 'active' and
 * even if something puts `screen` back to a battle or the map. Without it,
 * settling a live run wrote it straight back out on the next autosave and the
 * next settle paid it all over again.
 */
export const isLiveRun = (s: Pick<GameData, 'runPhase' | 'screen' | 'runSettled'>): boolean =>
  s.runPhase === 'active' && s.screen !== 'hub' && !s.runSettled

export const rarityColor = (r: ItemRarity) => RARITY[r].color
