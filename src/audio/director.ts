/**
 * Which piece of music should be playing, how hard, and why.
 *
 * Kept apart from `music.ts` on purpose: the music engine performs a cue and
 * knows nothing about the game, and this file knows the game and nothing about
 * oscillators. Nothing in `src/audio/` that the engine or the balance harness
 * can reach imports a store — this module is imported only by `main.tsx`.
 *
 * It reads the stores and states what should be true — a cue, an intensity,
 * a key, a low-Gate flag — and the music engine applies each of those on its
 * next barline. It never touches the game: it only subscribes.
 */
import { setAudioOptions, setLowGate, sfx } from './audio'
import { levelFor, LOW_GATE, musicIntensity, type IntensityInput } from './mix'
import { playMusic, setMusicState, type MusicCue } from './music'
import { endlessKeyLift } from './theme'
import { useGameStore } from '../state/gameStore'
import { useSettingsStore } from '../state/settingsStore'
import { fieldIdOf } from '../game/data/maps'

/** The slice of game state the rule reads. */
export interface CueInput {
  screen: string
  battlePhase: string
  engine: unknown
  runPhase: string
}

/**
 * The rule, in one function.
 *
 *  - a run that has just ended gets its outro (victory / defeat), which hands
 *    over to the hub on its own when it finishes;
 *  - a live wave gets the battle cue (which turns into the boss form by
 *    itself when a champion is on the field);
 *  - the run map, the crossroads, the endless room and the deploy phase get
 *    the prep cue — the field's key, the ostinato already walking, so the
 *    wave's first bar lands as a change;
 *  - the Watchtower and hero pick get the hub.
 *
 * Music volume at zero is "off", not "inaudible": the scheduler stops.
 */
export function cueFor(s: CueInput, musicVolume: number): MusicCue | null {
  if (musicVolume <= 0) return null
  if (s.runPhase === 'won') return 'victory'
  if (s.runPhase === 'lost') return 'defeat'
  if (s.screen === 'battle' && s.battlePhase === 'battle' && s.engine && s.runPhase === 'active') return 'battle'
  if (s.screen === 'battle' || s.screen === 'map' || s.screen === 'crossroads' || s.screen === 'endless') return 'prep'
  return 'hub'
}

interface EngineView {
  enemies?: { type?: { isBoss?: boolean } }[]
  baseHp?: number
  maxBaseHp?: number
}

/** The intensity inputs, from store state (and the live engine, read-only). */
export function intensityInput(s: {
  engine: unknown
  hud: { baseHp: number; maxBaseHp: number; enemiesAlive: number }
  speed: number
  mode: string
  round: number
  clearedNodeIds: string[]
}): IntensityInput {
  const eng = (s.engine ?? null) as EngineView | null
  const enemies = eng?.enemies
  const max = s.hud.maxBaseHp
  return {
    alive: enemies ? enemies.length : s.hud.enemiesAlive,
    boss: !!enemies?.some((e) => e.type?.isBoss),
    gate: max > 0 ? s.hud.baseHp / max : 1,
    depth: s.mode === 'endless' ? s.round / 2 : Math.max(0, s.clearedNodeIds.length - 1),
    speed: s.speed,
  }
}

/** Low-Gate with hysteresis, so a Gate hovering at 30 % does not flicker the filter. */
export const lowGateNext = (was: boolean, gate: number): boolean => (was ? gate < LOW_GATE.off : gate <= LOW_GATE.on)

let installed = false
let lowGate = false
/** Hero levels seen this run, to hear a level-up. */
let levels = new Map<string, number>()
let levelsRun: number | null = null

/** Subscribe the music to the game. Called once from `main.tsx`. */
export function installMusicDirector(): void {
  if (installed) return
  installed = true
  const sync = (): void => {
    const s = useGameStore.getState()
    const set = useSettingsStore.getState()
    setAudioOptions({ calm: set.calmAudio, mono: set.monoAudio })

    const cue = cueFor(s, set.audio.music)
    const live = cue === 'battle'
    const input = intensityInput(s)
    lowGate = live ? lowGateNext(lowGate, input.gate) : false
    setLowGate(lowGate)
    setMusicState({
      level: live ? levelFor(musicIntensity(input)) : 1,
      boss: live && input.boss,
      field: s.battleMap ? fieldIdOf(s.battleMap) : 'greenline',
      keyLift: s.mode === 'endless' ? endlessKeyLift(s.round) : 0,
    })
    playMusic(cue)

    // A hero levelled up: the roster's level went up for an id we already
    // knew, in the same run. A new run (or a restore) re-learns silently.
    if (levelsRun !== s.runSeed) {
      levelsRun = s.runSeed
      levels = new Map(s.roster.map((h) => [h.id, h.level]))
    } else {
      let up = false
      for (const h of s.roster) {
        const was = levels.get(h.id)
        if (was !== undefined && h.level > was) up = true
        if (was !== h.level) levels.set(h.id, h.level)
      }
      if (up && s.runPhase !== 'lost') sfx('levelup')
    }
  }
  useGameStore.subscribe(sync)
  useSettingsStore.subscribe(sync)
  sync()
}
