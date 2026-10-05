/**
 * Start-of-run and leave-the-battle state: the shared reset objects every entry
 * and exit point spreads, so no two of them can drift apart.
 */
import { pickBattleMap } from '../../game/data/maps'
import { newRarityPity } from '../../game/data/items'
import { addDifficultyElites, emptyPlacements, makeRun, mapOptionsFor } from '../../game/run/map'
import { freshFeats } from '../../game/run/settle'
import { ENDLESS_LIVES, MAX_BASE_HP } from '../../game/run/economy'
import type { Tactics } from '../../game/types'
import { difficultyRules, type DifficultyRules } from '../../game/run/watch'
import { STANDARD_RUN } from '../daily'
import { clearBeatTimer, runUnlocked, streams } from './runtime'
import type { BattlePhase, GameData, GameMode, HeroTab, HudSnapshot, RunPhase, Screen, ShellSelection, Speed } from './types'

export const DEFAULT_TACTICS: Tactics = { focus: 'first' }

/** Cleared whenever the shell changes subject, so nothing leaks between contexts. */
export const CLEAR_SHELL = {
  shellSelection: null as ShellSelection,
  heroTab: 'stats' as HeroTab,
  gearSlot: null,
  detailOpen: false,
  fieldNote: null as GameData['fieldNote'],
  gearNotice: null as GameData['gearNotice'],
} satisfies Partial<GameData>

export function freshHud(): HudSnapshot {
  return {
    baseHp: MAX_BASE_HP,
    maxBaseHp: MAX_BASE_HP,
    goldEarned: 0,
    enemiesAlive: 0,
    enemiesSpawned: 0,
    enemiesTotal: 0,
    subWave: 0,
    subWaveCount: 1,
    breather: false,
    commandReady: false,
  }
}

/**
 * Deal the run map off the map stream for the live run's hub, then turn the
 * difficulty step's extra battle nodes into elites (SK1). Which ones is a hash
 * of the run seed (`addDifficultyElites`), never a draw on the map stream, so
 * step 0 deals exactly the map it always did.
 */
export function dealRunMap(rules: DifficultyRules = difficultyRules(0), runSeed = 0) {
  const opts = mapOptionsFor(runUnlocked)
  const run = makeRun(streams.mapRng, opts)
  return { ...run, runMap: addDifficultyElites(run.runMap, rules.extraElites, runSeed, !!opts.standingOrders) }
}

/**
 * Every run-scoped field at its start-of-run value (m-2).
 *
 * `newRun` and `startEndless` BOTH spread this one object, so their reset lists
 * cannot drift (they once did, and a Forge room plus 30 dust leaked from
 * Endless into a campaign — see docs/AUDIT_2026-08-20.md, m-2).
 *
 * Call it AFTER `seedRunStreams`: it deals the run map off the map stream.
 *
 * `runSeed` is a parameter because the **battlefield** is dealt here too (WS8).
 * It rides its own `field` stream rather than `mapRng`, so which field a run is
 * fought on is a pure function of the run seed alone: re-dealing the run map —
 * which `setRunDifficulty` does on every difficulty change, from the same seed — can
 * never be used to reroll the battlefield, and a resumed run lands back on the
 * field its snapshot names.
 */
export function freshRunState(runSeed: number) {
  // This nulls `waveBeat` below; the timer holding it goes with it (F6).
  clearBeatTimer()
  const battleMap = pickBattleMap(runSeed)
  return {
    runPhase: 'active' as RunPhase,
    runSettled: false,
    runDifficulty: 0,
    challenge: STANDARD_RUN,
    firstRun: false,
    victory: null,
    ...dealRunMap(),
    event: null,
    battleMap,
    placements: emptyPlacements(battleMap),
    threat: 1,
    runKills: 0,
    marksEarned: 0,
    // A drought belongs to the run that suffered it (M9).
    lootPity: newRarityPity(),
    activeNodeId: null,
    currentWave: null,
    battlePhase: 'setup' as BattlePhase,
    speed: 1 as Speed,
    tactics: DEFAULT_TACTICS,
    engine: null,
    hud: freshHud(),
    lastResult: null,
    lastLoot: [],
    waveBeat: null,
    merchant: null,
    shrineOffer: null,
    recruitOptions: [],
    reward: null,
    runMods: [],
    relics: [],
    feats: freshFeats(),
    breatherPick: null,
    crossroads: null,
    forkDone: false,
    dust: 0,
    lives: ENDLESS_LIVES,
    wins: 0,
    round: 1,
    endlessRecruitCost: 100,
    endlessRoom: null,
    selectedSentinelId: null,
    skillPool: [] as string[],
    ...CLEAR_SHELL,
  } satisfies Partial<GameData>
}

/**
 * Leave a battle that cannot be resolved, landing somewhere with a way out
 * (M-4). Used by the `finishBattle` guards, which used to bail without
 * clearing `engine` — so the rAF loop, which calls `finishBattle` on every
 * frame a finished engine is still mounted, called it forever.
 */
export const abandonBattle = (mode: GameMode) => {
  // Same reason as `freshRunState`: the beat is dropped below, so is its timer.
  clearBeatTimer()
  return {
    engine: null,
    battlePhase: 'setup' as BattlePhase,
    activeNodeId: null,
    currentWave: null,
    lastResult: null,
    lastLoot: [],
    waveBeat: null,
    victory: null,
    screen: (mode === 'endless' ? 'endless' : 'map') as Screen,
    selectedSentinelId: null,
    ...CLEAR_SHELL,
  } satisfies Partial<GameData>
}

/** Back to the Watchtower with no event, offer or room left standing. */
export const leaveToHub = () => ({
  ...abandonBattle('campaign'),
  screen: 'hub' as Screen,
  runPhase: 'active' as RunPhase,
  event: null,
  merchant: null,
  shrineOffer: null,
  recruitOptions: [],
  reward: null,
  crossroads: null,
  endlessRoom: null,
}) satisfies Partial<GameData>
