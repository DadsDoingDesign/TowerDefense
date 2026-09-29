import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BUS_MAKEUP_DB,
  busGains,
  dbToGain,
  hasRaritySting,
  IDLE_SUSPEND_S,
  RARITIES,
  REVERB_TAIL_S,
  safeLevel,
  shouldSuspend,
  throttleAllows,
  UI_TRIM_DB,
} from '../src/audio/mix'

describe('dbToGain', () => {
  it('maps the landmarks', () => {
    expect(dbToGain(0)).toBe(1)
    expect(dbToGain(20)).toBeCloseTo(10, 10)
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3)
  })
})

describe('UI sample trims', () => {
  const dir = join(__dirname, '..', 'public', 'assets', 'audio', 'ui')
  const shipped = readdirSync(dir)
    .filter((f) => f.endsWith('.wav'))
    .map((f) => f.slice(0, -4))
    .sort()

  it('has exactly one trim per shipped sample — no dead files, no missing trims', () => {
    expect(Object.keys(UI_TRIM_DB).sort()).toEqual(shipped)
  })

  it('no longer ships the never-played open/select samples', () => {
    expect(shipped).not.toContain('open')
    expect(shipped).not.toContain('select')
  })

  it('pulls the loud samples down and the quiet ones up', () => {
    // Untrimmed Mmax: click −42.2 … reward −7.6. The ordering of the trims
    // must be the reverse of that, or the table was typed backwards.
    const order = ['click', 'back', 'equip', 'toggle', 'error', 'close', 'confirm', 'reward'] as const
    for (let i = 1; i < order.length; i++) {
      expect(UI_TRIM_DB[order[i]]).toBeLessThanOrEqual(UI_TRIM_DB[order[i - 1]])
    }
    expect(UI_TRIM_DB.reward).toBeLessThanOrEqual(-18)
    expect(UI_TRIM_DB.click).toBeGreaterThan(0)
  })
})

describe('reward ceremony', () => {
  it('knows which rarities own a sting', () => {
    for (const r of RARITIES) expect(hasRaritySting(r)).toBe(true)
    expect(hasRaritySting(undefined)).toBe(false)
    expect(hasRaritySting('')).toBe(false)
    expect(hasRaritySting('keepsake')).toBe(false)
  })
})

describe('busGains', () => {
  const base = { master: 0.8, game: 0.7, ui: 0.9, music: 0.55, muted: false }

  it('applies the fixed bus makeup on top of the slider', () => {
    const g = busGains(base)
    expect(g.master).toBeCloseTo(0.8)
    expect(g.game).toBeCloseTo(0.7 * dbToGain(BUS_MAKEUP_DB.game))
    expect(g.ui).toBeCloseTo(0.9 * dbToGain(BUS_MAKEUP_DB.ui))
    expect(g.music).toBeCloseTo(0.55 * dbToGain(BUS_MAKEUP_DB.music))
  })

  it('mute zeroes the master only, so un-muting restores every bus', () => {
    const g = busGains({ ...base, muted: true })
    expect(g.master).toBe(0)
    expect(g.game).toBeGreaterThan(0)
  })

  it('never hands a node NaN or an out-of-range level', () => {
    const g = busGains({ master: NaN, game: 5, ui: -1, music: undefined as unknown as number, muted: false })
    for (const v of Object.values(g)) expect(Number.isFinite(v)).toBe(true)
    expect(g.master).toBeCloseTo(0.8)
    expect(g.game).toBeCloseTo(dbToGain(BUS_MAKEUP_DB.game))
    expect(g.ui).toBe(0)
    expect(safeLevel('x', 0.3)).toBe(0.3)
  })
})

describe('shouldSuspend', () => {
  const s = { muted: false, hidden: false, musicPlaying: false, now: 100, busyUntil: 99 }

  it('suspends whenever muted', () => {
    expect(shouldSuspend({ ...s, muted: true, musicPlaying: true })).toBe(true)
  })

  it('never suspends under playing music', () => {
    expect(shouldSuspend({ ...s, hidden: true, musicPlaying: true, busyUntil: 0 })).toBe(false)
  })

  it('lets a ringing voice and its reverb tail finish first', () => {
    expect(shouldSuspend({ ...s, hidden: true, busyUntil: 100 - REVERB_TAIL_S + 0.1 })).toBe(false)
    expect(shouldSuspend({ ...s, hidden: true, busyUntil: 100 - REVERB_TAIL_S })).toBe(true)
  })

  it('suspends a visible tab only after the idle window with the music off', () => {
    expect(shouldSuspend({ ...s, busyUntil: 100 - IDLE_SUSPEND_S + 0.5 })).toBe(false)
    expect(shouldSuspend({ ...s, busyUntil: 100 - IDLE_SUSPEND_S })).toBe(true)
  })
})

describe('throttleAllows', () => {
  it('gates repeats inside the window and lets the first one through', () => {
    expect(throttleAllows(undefined, 0, 70)).toBe(true)
    expect(throttleAllows(1000, 1069, 70)).toBe(false)
    expect(throttleAllows(1000, 1070, 70)).toBe(true)
  })
})
