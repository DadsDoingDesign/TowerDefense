/**
 * The game store's public API — a barrel. The store itself lives in
 * `src/state/game/` (one `useGameStore` assembled from slices; see
 * `game/store.ts`), and the pure run rules it applies in `src/game/run/`.
 * Import from here; nothing outside `src/state/game/` needs the deep paths.
 */
export { useGameStore } from './game/store'
export { flushRunSnapshot, installRunPersistence, peekSavedRun } from './game/persistence'
export { canStartWave, rarityColor, type StartWaveGate } from './game/selectors'
export type {
  BattlePhase,
  Crossroads,
  EndlessRoom,
  EventKind,
  GameMode,
  HeroTab,
  RunPhase,
  RunRecap,
  Screen,
  ShellSelection,
  Speed,
} from './game/types'
export {
  ENDLESS_LIVES,
  ENDLESS_START_DUST,
  ENDLESS_START_GOLD,
  MAX_BASE_HP,
  MAX_ROSTER,
  START_GOLD,
  scrapDust,
  scrapGold,
} from '../game/run/economy'
export { THREAT_PER_CHOICE, THREAT_PER_NODE, THREAT_PER_ROUND } from '../game/run/threat'
export { placedSentinels } from '../game/run/map'
