import { describe, expect, it } from 'vitest'
import {
  busGains,
  CALM,
  dbToGain,
  DUCK,
  levelFor,
  LEVEL_DROP_BARS,
  LOW_GATE,
  musicIntensity,
  nextLevel,
  panFor,
  PAN_WIDTH,
  STEM_PAN,
  STEMS_FOR_LEVEL,
} from '../src/audio/mix'
import { intensityInput, lowGateNext } from '../src/audio/director'
import { counterNote } from '../src/audio/music'
import { CUES } from '../src/audio/theme'

const pc = (s: number) => ((s % 12) + 12) % 12

describe('the counter-line', () => {
  it('sits a third to a sixth under the tune, on a chord tone', () => {
    const c = CUES.battle.form[1].chords[0] as { tones: number[]; name: string; root: number }
    for (const mel of [0, 3, 5, 7, 10, 12]) {
      const n = counterNote(c, mel)
      expect(mel - n).toBeGreaterThanOrEqual(3)
      expect(c.tones.map(pc)).toContain(pc(n))
    }
  })
})

const calm = { alive: 0, depth: 0, boss: false, gate: 1, speed: 1 }

describe('intensity', () => {
  it('rises with the crowd, the danger, the depth and the speed', () => {
    const base = musicIntensity(calm)
    expect(musicIntensity({ ...calm, alive: 14 })).toBeGreaterThan(base)
    expect(musicIntensity({ ...calm, gate: 0.3 })).toBeGreaterThan(base)
    expect(musicIntensity({ ...calm, depth: 10 })).toBeGreaterThan(base)
    expect(musicIntensity({ ...calm, speed: 3 })).toBeGreaterThan(base)
  })
  it('an empty field is the lull, a crowd is the full groove, a boss is never below level 3', () => {
    expect(levelFor(musicIntensity(calm))).toBe(0)
    expect(levelFor(musicIntensity({ ...calm, alive: 14, depth: 5 }))).toBeGreaterThanOrEqual(2)
    expect(levelFor(musicIntensity({ ...calm, boss: true }))).toBe(3)
  })
  it('never hands the score NaN', () => {
    const v = musicIntensity({ alive: NaN, depth: -3, boss: false, gate: NaN, speed: 0 })
    expect(Number.isFinite(v)).toBe(true)
    expect(v).toBeGreaterThanOrEqual(0)
  })
  it('goes up at once and comes down only after a couple of bars', () => {
    expect(nextLevel(1, 3, 0)).toEqual({ level: 3, barsBelow: 0 })
    let s = { level: 3, barsBelow: 0 }
    for (let i = 0; i < LEVEL_DROP_BARS - 1; i++) s = nextLevel(s.level, 0, s.barsBelow)
    expect(s.level).toBe(3)
    s = nextLevel(s.level, 0, s.barsBelow)
    expect(s.level).toBe(2) // one step at a time
  })
  it('the melody waits for level 1; every level keeps the ground (bass + ostinato)', () => {
    expect(STEMS_FOR_LEVEL[0]).not.toContain('melody')
    expect(STEMS_FOR_LEVEL[1]).toContain('melody')
    for (const l of STEMS_FOR_LEVEL) expect(l).toEqual(expect.arrayContaining(['bass', 'pluck']))
  })
})

describe('low Gate', () => {
  it('closes in at 30 % and lets go only above 36 %', () => {
    expect(lowGateNext(false, 0.31)).toBe(false)
    expect(lowGateNext(false, LOW_GATE.on)).toBe(true)
    expect(lowGateNext(true, 0.34)).toBe(true)
    expect(lowGateNext(true, LOW_GATE.off)).toBe(false)
  })
  it('reads the Gate and the field from store state', () => {
    const i = intensityInput({
      engine: { enemies: [{ type: {} }, { type: { isBoss: true } }] },
      hud: { baseHp: 5, maxBaseHp: 20, enemiesAlive: 0 },
      speed: 2,
      mode: 'campaign',
      round: 1,
      clearedNodeIds: ['a', 'b', 'c'],
    })
    expect(i).toEqual({ alive: 2, boss: true, gate: 0.25, depth: 2, speed: 2 })
  })
})

describe('space and accessibility', () => {
  it('pans SFX by field position within ±0.4, and centre on no position', () => {
    expect(panFor(1)).toBeCloseTo(PAN_WIDTH)
    expect(panFor(-5)).toBeCloseTo(-PAN_WIDTH)
    expect(panFor(undefined)).toBe(0)
    expect(panFor(NaN)).toBe(0)
  })
  it('keeps the drums and the bass in the middle', () => {
    expect(STEM_PAN.drums).toBe(0)
    expect(STEM_PAN.bass).toBe(0)
  })
  it('Calm audio pulls the score back without touching the effects or the player’s levels', () => {
    const v = { master: 0.8, game: 0.7, ui: 0.9, music: 0.55, muted: false }
    const a = busGains(v)
    const b = busGains(v, true)
    expect(b.game).toBe(a.game)
    expect(b.master).toBe(a.master)
    expect(b.music / a.music).toBeCloseTo(dbToGain(CALM.musicDb), 6)
    expect(CALM.limiter.ratio).toBeLessThan(20)
  })
  it('ducks by about 4 dB, fast in, slow out', () => {
    expect(DUCK.leak).toBeGreaterThanOrEqual(3)
    expect(DUCK.leak).toBeLessThanOrEqual(5)
    expect(DUCK.attackTau).toBeLessThan(DUCK.releaseTau / 10)
  })
})
