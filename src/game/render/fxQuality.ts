/**
 * How much of the company worlds' motion a device gets (Oct 2026).
 *
 * The designer, on the cost of the worlds on a slow phone: "Auto + setting".
 *
 *  - The player's setting, `Effects: Full / Light` (`settingsStore.effects`).
 *    Light is the reduced set: half the particles, the frames still (no
 *    flipbook, no strip, no crest, no sheen), no glows behind the particles.
 *  - Auto: on Full, a device that cannot hold the frame rate drops to Light by
 *    itself — the loops that draw the worlds (`fxEngine`, the battle's edge
 *    band) report each frame's length here; a measured rate under
 *    {@link AUTO_LOW_FPS} for {@link AUTO_DOWN_MS} steps down, and over
 *    {@link AUTO_HIGH_FPS} for {@link AUTO_UP_MS} steps back up. The gap
 *    between the two rates, the longer wait to recover, and a recovery that
 *    takes twice as long after each relapse are the hysteresis that keeps it
 *    from flapping.
 *  - Reduced motion wins over both: `off`, nothing moves.
 *
 * Pure state, no DOM: the UI mirrors `level()` onto `<html data-fx>` for the
 * CSS (`ui/theme/useCompanyTheme`).
 */
export type EffectsSetting = 'full' | 'light'
export type FxLevel = 'full' | 'light' | 'off'

/** Under this measured rate for {@link AUTO_DOWN_MS}, Full steps down to Light. */
export const AUTO_LOW_FPS = 45
/** Over this rate for {@link AUTO_UP_MS}, an automatic Light steps back up. */
export const AUTO_HIGH_FPS = 56
export const AUTO_DOWN_MS = 2000
export const AUTO_UP_MS = 6000
/** A frame longer than this is a pause (a tab switch, a GC), not a rate. */
const GAP_MAX_MS = 250

interface State {
  setting: EffectsSetting
  reducedMotion: boolean
  /** Full stepped down by itself. */
  auto: boolean
  /** How long the rate has been under / over its line (ms). */
  low: number
  high: number
  /** The smoothed frame length (ms). */
  avg: number
  /** Relapses this session: each one doubles the wait to recover. */
  relapses: number
  /** The automatic step down is on (always, in play; a review holds Full to measure it). */
  autoOn: boolean
}

const s: State = { setting: 'full', reducedMotion: false, auto: false, low: 0, high: 0, avg: 1000 / 60, relapses: 0, autoOn: true }
const listeners = new Set<(l: FxLevel) => void>()

export function fxLevel(): FxLevel {
  if (s.reducedMotion) return 'off'
  if (s.setting === 'light' || s.auto) return 'light'
  return 'full'
}

/** Whether the light set is on because the device could not keep up (not the setting). */
export const fxAutoLight = (): boolean => s.auto && s.setting === 'full' && !s.reducedMotion

function changed(before: FxLevel): void {
  const now = fxLevel()
  if (now !== before) for (const fn of listeners) fn(now)
}

/** The player's settings, from the settings store. */
export function setFxSettings(setting: EffectsSetting, reducedMotion: boolean): void {
  const before = fxLevel()
  s.setting = setting
  s.reducedMotion = reducedMotion
  if (setting === 'light') s.auto = false
  s.low = 0
  s.high = 0
  changed(before)
}

/** Listen for the level changing; returns the unsubscribe. */
export function onFxLevel(fn: (l: FxLevel) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * One frame drawn by a loop that shows the worlds, `ms` after the last. Only
 * Full (or an automatic Light) is measured; the setting's Light and reduced
 * motion are left alone.
 */
export function noteFxFrame(ms: number): void {
  if (s.reducedMotion || s.setting === 'light' || !s.autoOn) return
  if (!(ms > 0) || ms > GAP_MAX_MS) return
  s.avg += (ms - s.avg) * 0.1
  const fps = 1000 / s.avg
  const before = fxLevel()
  if (!s.auto) {
    s.low = fps < AUTO_LOW_FPS ? s.low + ms : 0
    if (s.low >= AUTO_DOWN_MS) {
      s.auto = true
      s.low = 0
      s.high = 0
    }
  } else {
    s.high = fps > AUTO_HIGH_FPS ? s.high + ms : 0
    if (s.high >= AUTO_UP_MS * 2 ** Math.min(4, s.relapses)) {
      s.auto = false
      s.high = 0
      s.low = 0
      s.relapses++
    }
  }
  changed(before)
}

/** Hold Full without the automatic step down (a review measuring Full on its own). */
export function setFxAuto(on: boolean): void {
  const before = fxLevel()
  s.autoOn = on
  if (!on) s.auto = false
  changed(before)
}

/** The measured rate (dev handle and the review's numbers). */
export const fxMeasuredFps = (): number => Math.round(1000 / s.avg)

/** Back to a fresh session (tests). */
export function resetFxQuality(): void {
  Object.assign(s, { setting: 'full', reducedMotion: false, auto: false, low: 0, high: 0, avg: 1000 / 60, relapses: 0, autoOn: true })
  listeners.clear()
}
