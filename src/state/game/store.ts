/**
 * `useGameStore` — the ONE zustand store for a run, assembled from slices.
 *
 * Each slice (`runSlice`, `endlessSlice`, `battleSlice`, `eventsSlice`,
 * `rosterSlice`, `shellSlice`) contributes a group of actions over the whole
 * `GameState`; the data fields are shared and initialised here. Pure rules the
 * actions apply live in `src/game/run/` (no zustand there), and process-wide
 * mutable state (RNG streams, the beat timer) in `runtime.ts`.
 */
import { create } from 'zustand'
import { newRunSeed } from '../../game/core/rng'
import { startingRoster } from '../../game/data/sentinels'
import { MAX_BASE_HP, START_GOLD } from '../../game/run/economy'
import { freshRunState } from './fresh'
import { seedRunStreams } from './runtime'
import { createRunSlice } from './runSlice'
import { createEndlessSlice } from './endlessSlice'
import { createBattleSlice } from './battleSlice'
import { createEventsSlice } from './eventsSlice'
import { createRosterSlice } from './rosterSlice'
import { createShellSlice } from './shellSlice'
import type { GameState } from './types'

export const useGameStore = create<GameState>()((...a) => {
  const bootSeed = newRunSeed()
  seedRunStreams(bootSeed)
  // Boot ORDER is load-bearing: fresh run state (which deals the map off
  // `mapRng`), then the roster (which spends entity ids). Nothing may move
  // between them.
  const bootRun = freshRunState(bootSeed)
  const bootRoster = startingRoster()
  return {
    ...bootRun,
    mode: 'campaign',
    runSeed: bootSeed,
    screen: 'hub',
    roster: bootRoster,
    gold: START_GOLD,
    baseHp: MAX_BASE_HP,
    maxBaseHp: MAX_BASE_HP,
    enemyHpMult: 1,
    inventory: [],

    ...createRunSlice(...a),
    ...createEndlessSlice(...a),
    ...createBattleSlice(...a),
    ...createEventsSlice(...a),
    ...createRosterSlice(...a),
    ...createShellSlice(...a),
  }
})
