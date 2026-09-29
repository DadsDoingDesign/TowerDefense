/**
 * The mix, as data — every number that decides how loud something is, in one
 * pure module with no Web Audio in it, so it can be unit-tested and so a level
 * change is a one-line diff with the measurement next to it.
 *
 * Levels were set against the OfflineAudioContext render harness (ffmpeg
 * `ebur128` + pyloudnorm, 400 ms momentary windows, K-weighted), at the
 * shipped default volumes. "Mmax" below is momentary-max LUFS of one event
 * played on its own.
 *
 * Like `audio.ts` this module has zero module-level side effects (F11).
 */

export const dbToGain = (db: number): number => Math.pow(10, db / 20)

/** The UI samples that ship (Kenney CC0, public/assets/audio/ui). */
export type UiSample = 'click' | 'confirm' | 'back' | 'close' | 'toggle' | 'error' | 'equip' | 'reward'

/**
 * Per-sample trim, in dB.
 *
 * Kenney's pack is peak-normalised to about −1 dBFS, which is not the same as
 * loudness-matched: played untrimmed the ten samples spanned 35 LU (click −42
 * Mmax, reward −7.6), and the loudest were 15–35 dB above the combat mix, so
 * one menu tap was louder than a crit and the `reward` sample buried the whole
 * rarity ladder. These bring every sample to one momentary-max target, a few
 * LU under a crit (`UI_TARGET_MMAX`) — measured, not guessed.
 */
export const UI_TRIM_DB: Record<UiSample, number> = {
  // Measured Mmax in the final chain (harness, default volumes, after bus
  // makeup, glue and limiter): click −28.0, back −26.5, equip −24.4, toggle
  // −24.1, error −23.8, close −23.7, confirm −24.1, reward −22.0 — against
  // crit −19.9. Click and back read a few LU shy because they are 60–115 ms
  // long and a 400 ms window under-reads a transient; pushing them further
  // only drives their peaks into the limiter, which ducks the score on
  // every tap.
  click: 14,
  back: 8,
  equip: 2,
  toggle: -6,
  error: -9.5,
  close: -11,
  confirm: -21,
  reward: -24.5,
}

/** Momentary-max LUFS the trims aim each UI sample at (final chain, defaults). */
export const UI_TARGET_MMAX = -24

/**
 * Fixed makeup per bus, in dB, on top of the player's slider.
 *
 * The whole game used to sit around −26.5 LUFS integrated in battle and −34
 * in the hub — about 10 dB under every other phone game, so players turned the
 * device up and then got blasted by the next app. The makeup is what brings
 * the default mix to ≈ −18 LUFS in battle and ≈ −22 in the hub, with the
 * limiter below catching the peaks that creates. Measured (harness, default
 * volumes): battle 1× −18.2, 3× −16.6, hub −21.9 LUFS-I; true peak ≤ −2.0
 * dBTP everywhere. The UI bus gets 2 dB less than the others because it plays
 * alone, in the hub, a few centimetres from the player's attention.
 */
export const BUS_MAKEUP_DB = { game: 8, ui: 6, music: 8 } as const

/**
 * Per-cue level inside the music bus, in dB. The hub cue has no drums and a
 * long reverb, so at the same fader it measures ~3 LU under the battle cue;
 * this lifts it to its target without re-orchestrating it.
 */
export const CUE_LEVEL_DB = { hub: 1, battle: 0 } as const

/**
 * The master chain: a gentle glue compressor, then a real limiter.
 *
 * The old single compressor (−12 dB, 22 dB knee, 6:1) was neither: too soft
 * to stop a dense 3× wave from overshooting, too early to leave the mix any
 * punch. Glue first (slow, low ratio — it holds the mix together), then a
 * brick-ish wall (hard knee, 20:1, 1 ms attack), then a small output trim that
 * pays for Chromium's automatic makeup gain and inter-sample overshoot, so the
 * true peak stays at or under −1 dBTP.
 */
export const MASTER_CHAIN = {
  glue: { threshold: -20, knee: 8, ratio: 2, attack: 0.01, release: 0.2 },
  limiter: { threshold: -3, knee: 0, ratio: 20, attack: 0.001, release: 0.1 },
  outTrimDb: -1.5,
} as const

/** Time constant for gain changes (mute, sliders) — 15 ms, click-free. */
export const GAIN_SMOOTH_S = 0.015

export interface Volumes {
  master: number
  game: number
  ui: number
  music: number
  muted: boolean
}

/** A slider value that is safe to multiply into a gain node (NaN is silence forever). */
export const safeLevel = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback

/** The gain each bus node should be set to for these volumes. */
export function busGains(v: Volumes): { master: number; game: number; ui: number; music: number } {
  return {
    master: v.muted ? 0 : safeLevel(v.master, 0.8),
    game: safeLevel(v.game, 0.7) * dbToGain(BUS_MAKEUP_DB.game),
    ui: safeLevel(v.ui, 0.9) * dbToGain(BUS_MAKEUP_DB.ui),
    music: safeLevel(v.music, 0.55) * dbToGain(BUS_MAKEUP_DB.music),
  }
}

/** Rarities that have their own sting (see `RARITY_STING` in audio.ts). */
export const RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'] as const
export const hasRaritySting = (rarity: string | undefined): boolean =>
  !!rarity && (RARITIES as readonly string[]).includes(rarity)

/**
 * Should the context be suspended right now?
 *
 * A running AudioContext is not free even when silent: the two convolvers
 * (0.7 s and 1.8 s impulse responses) and the compressors keep processing
 * zeros on the audio thread, which on a phone is battery for nothing. So:
 *
 *  - muted → suspend (after the fade-out ramp has finished);
 *  - otherwise, while music is playing or a voice is still ringing, never;
 *  - otherwise suspend when the tab is hidden, or after `IDLE_SUSPEND_S` of
 *    silence with the music off.
 *
 * `busyUntil` is the audio-clock time the last scheduled voice (plus its
 * reverb tail) ends; `lastVoice` when the most recent one started.
 */
export const IDLE_SUSPEND_S = 8
export const REVERB_TAIL_S = 2
export function shouldSuspend(s: {
  muted: boolean
  hidden: boolean
  musicPlaying: boolean
  now: number
  busyUntil: number
}): boolean {
  if (s.muted) return true
  if (s.musicPlaying) return false
  if (s.now < s.busyUntil + REVERB_TAIL_S) return false
  if (s.hidden) return true
  return s.now >= s.busyUntil + IDLE_SUSPEND_S
}

/** Per-event repeat gate in real (audio-clock) milliseconds — see `gameSfx`. */
export const throttleAllows = (lastMs: number | undefined, nowMs: number, throttleMs: number): boolean =>
  lastMs === undefined || nowMs - lastMs >= throttleMs
