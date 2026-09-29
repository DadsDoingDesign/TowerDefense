/**
 * Which piece of music should be playing, and why.
 *
 * Kept apart from `music.ts` on purpose: the music engine performs a cue and
 * knows nothing about the game, and this file knows the game and nothing about
 * oscillators. Nothing in `src/audio/` that the engine or the balance harness
 * can reach imports a store — this module is imported only by `main.tsx`.
 */
import { playMusic, type MusicCue } from './music'
import { useGameStore } from '../state/gameStore'
import { useSettingsStore } from '../state/settingsStore'

/**
 * The rule, in one function.
 *
 * A live wave gets the battle cue; everything else — the Watchtower, the run
 * map, the crossroads, the setup phase before a wave, and every screen that
 * follows a finished run — gets the hub cue. Deployment happens on the
 * battlefield screen with the score still calm, which is what makes the wave's
 * first bar land as a change.
 *
 * Music volume at zero is treated as "off" rather than "inaudible": that is the
 * settings row's meaning, and it saves the scheduler entirely.
 */
export function cueFor(
  s: { screen: string; battlePhase: string; engine: unknown; runPhase: string },
  musicVolume: number,
): MusicCue | null {
  if (musicVolume <= 0) return null
  if (s.screen === 'battle' && s.battlePhase === 'battle' && s.engine && s.runPhase === 'active') {
    return 'battle'
  }
  return 'hub'
}

let installed = false

/** Subscribe the music to the game. Called once from `main.tsx`. */
export function installMusicDirector(): void {
  if (installed) return
  installed = true
  const sync = (): void => {
    const s = useGameStore.getState()
    playMusic(cueFor(s, useSettingsStore.getState().audio.music))
  }
  useGameStore.subscribe(sync)
  useSettingsStore.subscribe(sync)
  sync()
}
