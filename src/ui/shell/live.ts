import { useGameStore } from '../../state/gameStore'
import type { GameState } from '../../state/game/types'
import { orientationOf } from '../../game/data/maps'
import { useShallow } from 'zustand/react/shallow'

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

/**
 * Portrait battlefields: setup collapses too.
 *
 * A portrait field is height-bound, so on the phone column the setup Stage
 * (390×286 at 390×844, 320×111 at 320×568) would draw it SMALLER than the
 * landscape field it replaced — 0.30 CSS px per field px against 0.41. So on a
 * portrait field, setup takes the live layout: the Detail band is the wave
 * strip (the hint and Start Wave), and the Stage has the height, where the
 * field draws at 0.60 (390), 0.44 (375), 0.34 (320).
 *
 * Posting is the gesture setup exists for, and its target is the field, so
 * arming a hero from the party row does NOT open the band (the selection IS
 * the armed hero). It opens for everything that is a read rather than a post:
 * the strip's Details toggle, or a posted hero tapped on the field (its
 * Upgrades tab). A post lets go of the selection (`placeOnSlot`), so the band
 * does not open under the hero that just landed. The wide layout undoes the
 * collapse in CSS, so none of this reaches a desk.
 */
export function setupCollapsible(
  s: Pick<GameState, 'battleMap' | 'shellSelection' | 'selectedSentinelId' | 'detailOpen'>,
): { collapsed: boolean; peek: boolean } {
  if (orientationOf(s.battleMap) !== 'portrait') return { collapsed: false, peek: false }
  const armed = s.shellSelection?.kind === 'hero' && s.selectedSentinelId === s.shellSelection.id
  const reading = s.detailOpen || (!!s.shellSelection && !armed)
  return { collapsed: !reading, peek: reading }
}

export function useBattleLayout(): { layout: BattleLayout; collapsed: boolean; peek: boolean } {
  const layout = useGameStore(battleLayoutOf)
  const selected = useGameStore((s) => !!s.shellSelection)
  const setup = useGameStore(useShallow(setupCollapsible))
  if (layout === 'setup') return { layout, ...setup }
  const collapsible = layout === 'live' || layout === 'settled'
  return { layout, collapsed: collapsible && !selected, peek: collapsible && selected }
}
