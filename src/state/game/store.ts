/**
 * `useGameStore` — the ONE zustand store for a run, assembled from slices.
 *
 * Each slice (`runSlice`, `contractSlice`, `battleSlice`, `eventsSlice`,
 * `rosterSlice`, `shellSlice`) contributes a group of actions over the whole
 * `GameState`; the data fields are shared and initialised here. Pure rules the
 * actions apply live in `src/game/run/` (no zustand there), and process-wide
 * mutable state (RNG streams, the beat timer) in `runtime.ts`.
 */
import { create } from 'zustand'
import { newRunSeed } from '../../game/core/rng'
import { createHero } from '../../game/data/sentinels'
import { MAX_BASE_HP, START_GOLD } from '../../game/run/economy'
import { freshRunState } from './fresh'
import { seedRunStreams } from './runtime'
import { createRunSlice } from './runSlice'
import { createContractSlice } from './contractSlice'
import { createBattleSlice } from './battleSlice'
import { createEventsSlice } from './eventsSlice'
import { createRosterSlice } from './rosterSlice'
import { createShellSlice } from './shellSlice'
import type { GameState } from './types'
import { useSettingsStore } from '../settingsStore'
import { markAssisted } from '../../game/run/ranking'
import { isLiveRun } from './selectors'

export const useGameStore = create<GameState>()((...a) => {
  const bootSeed = newRunSeed()
  seedRunStreams(bootSeed)
  // Boot ORDER is load-bearing: fresh run state (which deals the map off
  // `mapRng`), then the roster (which spends entity ids). Nothing may move
  // between them.
  const bootRun = freshRunState(bootSeed)
  // Three bare bodies, as the boot roster always was (the hub never shows them).
  const bootRoster = [createHero(), createHero(), createHero()]
  return {
    ...bootRun,
    runSeed: bootSeed,
    screen: 'hub',
    homeFocus: null,
    roster: bootRoster,
    gold: START_GOLD,
    baseHp: MAX_BASE_HP,
    maxBaseHp: MAX_BASE_HP,
    enemyHpMult: 1,
    inventory: [],

    ...createRunSlice(...a),
    ...createContractSlice(...a),
    ...createBattleSlice(...a),
    ...createEventsSlice(...a),
    ...createRosterSlice(...a),
    ...createShellSlice(...a),
  }
})

/**
 * The assist dial marks the live run the moment it is turned on, wherever it
 * is turned on — Settings, the result page's "Assist: Steady" — and the mark
 * stays when it is turned off again (`game/run/ranking.markAssisted`). A run
 * that is not live (the hub, a finished run) is not marked: the next one is,
 * when it begins with the dial on.
 */
useSettingsStore.subscribe((s) => {
  const g = useGameStore.getState()
  if (!g.assisted && isLiveRun(g) && markAssisted(false, s.assist)) useGameStore.setState({ assisted: true })
})
