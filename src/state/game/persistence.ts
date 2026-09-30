// ---------------------------------------------------------------------------
// Run persistence (C3)
//
// Rather than sprinkle save() calls through thirty actions — where the one that
// gets forgotten is the one that loses a run — the snapshot is driven off the
// store itself: any change to a field that is part of the run schedules a write.
// A battle can't dirty this on a per-frame basis, because the loop only ever
// touches `hud`, which is not watched.
// ---------------------------------------------------------------------------
import { idCounterState } from '../../game/core/rng'
import { nameCounterState } from '../../game/data/sentinels'
import { onAppHidden } from '../lifecycle'
import { captureRun, clearSnapshot, loadSnapshot, saveSnapshot, type RunSnapshot, type StreamPositions } from '../runSnapshot'
import { session, streams } from './runtime'
import { isLiveRun } from './selectors'
import { useGameStore } from './store'
import type { GameData, GameState } from './types'

/** The state fields that constitute "the run". Changing any of them re-saves. */
const SNAPSHOT_FIELDS = [
  'challenge',
  'firstRun',
  'mode',
  'runSeed',
  'screen',
  'runPhase',
  'runMap',
  'currentNodeId',
  'clearedNodeIds',
  'reachableNodeIds',
  'event',
  'battleMap',
  'roster',
  'placements',
  'gold',
  'baseHp',
  'maxBaseHp',
  'enemyHpMult',
  'threat',
  'runBanner',
  'inventory',
  'runKills',
  'marksEarned',
  // Persisted state, so a change to it has to be able to trigger a write (M9).
  // In practice it only ever moves alongside `inventory` / `reward` / `merchant`,
  // but a dirty-check that omits a snapshotted field is a latent stale save.
  'lootPity',
  'activeNodeId',
  'currentWave',
  'battlePhase',
  'tactics',
  // Run-material, not presentation (C-1): `lastResult` is what says the wave at
  // `activeNodeId` has already been fought and paid for. Leaving it out is what
  // let a post-battle snapshot come back as a pre-battle one.
  'lastResult',
  'lastLoot',
  'merchant',
  'shrineOffer',
  'recruitOptions',
  'reward',
  'runMods',
  'crossroads',
  'forkDone',
  'relics',
  'feats',
  'evolutionQueue',
  'dust',
  'lives',
  'wins',
  'round',
  'endlessRecruitCost',
  'endlessRoom',
] as const satisfies readonly (keyof GameData)[]

/**
 * Where each stream currently sits, for the run snapshot (C3). Restoring these
 * is what makes a resumed run CONTINUE its seeded sequence instead of re-dealing
 * the loot it already handed out — a reload must not be a re-roll.
 *
 * `lootPity` rides along for exactly the same reason (M9). It is not a stream
 * POSITION but it is stream-shaped state: the drop the next roll produces is a
 * function of (loot stream position, dry counter), so restoring one without the
 * other resumes into a different sequence than the one that was interrupted.
 * Anything that has to be restored in lockstep with `rngLoot` belongs beside it.
 */
const streamPositions = (s: Pick<GameData, 'lootPity'>): StreamPositions => ({
  rngLoot: streams.rng.saveState(),
  rngMap: streams.mapRng.saveState(),
  lootPity: s.lootPity.dry,
  idCounter: idCounterState(),
  nameCounters: nameCounterState(),
})

/** Write (or clear) the run snapshot right now, synchronously. */
export function flushRunSnapshot(): void {
  const s = useGameStore.getState()
  if (isLiveRun(s)) {
    session.ownsRun = true
    saveSnapshot(captureRun(s, streamPositions(s)))
    return
  }
  // The run this session was playing has ended (won, lost, or abandoned to the
  // hub) — that, and only that, retires the snapshot.
  if (session.ownsRun) {
    session.ownsRun = false
    clearSnapshot()
  }
}

/** The persisted run, if there is a usable one. Null once it has been consumed. */
export function peekSavedRun(): RunSnapshot | null {
  return loadSnapshot()
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastFields: unknown[] = []

function scheduleSnapshot(s: GameState): void {
  const next = SNAPSHOT_FIELDS.map((k) => s[k])
  if (next.length === lastFields.length && next.every((v, i) => v === lastFields[i])) return
  lastFields = next
  if (saveTimer) return
  // Coalesce the burst of sets a single action fires into one write.
  saveTimer = setTimeout(() => {
    saveTimer = null
    flushRunSnapshot()
  }, 0)
}

let persistenceInstalled = false

/**
 * Start persisting the run. Called once from `main.tsx`; kept out of module
 * scope so the headless balance harness can import the store without ever
 * touching storage or the DOM.
 */
export function installRunPersistence(): void {
  if (persistenceInstalled) return
  persistenceInstalled = true
  lastFields = SNAPSHOT_FIELDS.map((k) => useGameStore.getState()[k])
  useGameStore.subscribe(scheduleSnapshot)
  // Backgrounding a tab on a phone is routine and can be the last thing that
  // happens before the OS reclaims it, so the write has to be synchronous here
  // rather than waiting on the coalescing timer.
  //
  // The beat is settled FIRST (H18). A snapshot taken mid-hold would describe a
  // battle that is still in progress and has in fact already resolved — the
  // exact incoherent-resume shape C-1 exists to prevent — and the hold's timer
  // may never fire again if the OS reclaims the tab. Settling is idempotent and
  // a no-op when no beat is running.
  onAppHidden(() => {
    useGameStore.getState().skipWaveBeat()
    flushRunSnapshot()
  })
}
