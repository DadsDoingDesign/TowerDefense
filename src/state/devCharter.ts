/**
 * The Sovereign Route's dev handle (the endgame charter): one call opens the
 * charter's door and funds the bank, for screenshots and tests — exposed as
 * `window.__charter` in dev builds only (`main.tsx`). Never called by the game.
 */
import { CHARTER_FEE } from '../game/run/charter'
import { RANDOM_UNLOCK_SKILLS } from '../game/data/skills'
import { SOVEREIGN_ITEM_KINDS, UNLOCK_ITEM_KINDS } from '../game/data/itemKinds'
import { useMetaStore } from './metaStore'

export const devCharter = {
  /**
   * Unlock every skill card and item kind of Levels 1–3 (the door), mark a
   * contract finished (so the menu is not a first-timer's), and fund the bank
   * to at least `bank` gold — two fees by default.
   */
  ready(bank = CHARTER_FEE * 2): void {
    useMetaStore.setState((s) => ({
      skills: [...RANDOM_UNLOCK_SKILLS],
      items: [...UNLOCK_ITEM_KINDS],
      bank: Math.max(s.bank, Math.floor(bank)),
      stats: { ...s.stats, runsCompleted: Math.max(1, s.stats.runsCompleted) },
    }))
  },
  /** Put `n` more gold in the bank. */
  fund(n: number): void {
    useMetaStore.getState().deposit(n)
  },
  /** Own the first `n` Sovereign kinds (0 owns none). */
  own(n: number): void {
    useMetaStore.setState({ sovereign: SOVEREIGN_ITEM_KINDS.slice(0, Math.max(0, Math.floor(n))) })
  },
}
