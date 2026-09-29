import { useGameStore } from '../../state/gameStore'
import type { GameState } from '../../state/game/types'

/**
 * Which part of a battle the shell is in, for LAYOUT (Phase 2).
 *
 *  - `setup`   — posting heroes. The four bands as designed: the Detail band is
 *                where you read heroes, gear and the pack.
 *  - `live`    — a wave is running (or its clear beat is holding). The Detail
 *                band collapses to the wave strip and the Stage takes the height.
 *  - `settled` — the wave is over and its receipt is on the Stage (the
 *                wave-clear ceremony). Still collapsed, so nothing jumps at the
 *                one moment the eye is on the field.
 *  - `none`    — not a battle.
 *
 * `peek`: during `live`/`settled`, selecting something (a hero card, a posted
 * hero on the field) re-opens the Detail band so rule one still holds — tap a
 * thing, read it. Deselect and the Stage gets the height back.
 */
export type BattleLayout = 'none' | 'setup' | 'live' | 'settled'

export function battleLayoutOf(s: Pick<GameState, 'screen' | 'runPhase' | 'battlePhase' | 'engine' | 'waveBeat' | 'lastResult'>): BattleLayout {
  if (s.screen !== 'battle' || s.runPhase !== 'active') return 'none'
  if (s.waveBeat) return 'live'
  if (s.battlePhase === 'battle' && s.engine) return 'live'
  if (s.lastResult) return 'settled'
  return 'setup'
}

export function useBattleLayout(): { layout: BattleLayout; collapsed: boolean; peek: boolean } {
  const layout = useGameStore(battleLayoutOf)
  const selected = useGameStore((s) => !!s.shellSelection)
  const collapsible = layout === 'live' || layout === 'settled'
  return { layout, collapsed: collapsible && !selected, peek: collapsible && selected }
}
