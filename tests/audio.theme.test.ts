import { describe, expect, it } from 'vitest'
import {
  chordAt,
  CUES,
  DRUMS,
  endlessKeyLift,
  exactRepeatBars,
  FIELD_VOICES,
  formBars,
  MODE_PCS,
  OSTINATO,
  planBar,
  REST,
  stingDegrees,
  type CueId,
} from '../src/audio/theme'
import { anchorFor, ANCHOR_STEP, PLUCKS, renderDrum, renderPluck } from '../src/audio/instruments'

const pc = (s: number) => ((s % 12) + 12) % 12

/** Every note a cue can play, at every level and in every cycle. */
function everyBar(id: CueId): ReturnType<typeof planBar>[] {
  const cue = CUES[id]
  const out = []
  for (let n = 0; n < exactRepeatBars(cue); n++) for (let lvl = 0; lvl <= 3; lvl++) out.push(planBar(cue, n, lvl))
  return out
}

describe('the theme', () => {
  it('every written bar fills exactly 4/4 (eight 8ths)', () => {
    for (const id of Object.keys(CUES) as CueId[]) {
      for (const sec of CUES[id].form) {
        for (const bar of sec.melody ?? []) expect(bar.reduce((n, [, e]) => n + e, 0), `${id}/${sec.id}`).toBe(8)
        expect(sec.melody === null || sec.melody.length === sec.chords.length).toBe(true)
      }
    }
  })

  it('is the same four-bar motif in every setting: A C D E | G E D C | D E C A | B G A', () => {
    const hub = planBar(CUES.hub, 4, 1) // hub bars 5–8 of lap one state it
    const battle = planBar(CUES.battle, 2, 2) // after the 2-bar intro
    const motif = [0, 3, 5, 7]
    expect(battle.melody?.map(([s]) => s)).toEqual(motif)
    expect(planBar(CUES.hub, 0, 1).melody?.map(([s]) => s)).toEqual(motif)
    expect(hub.melody).not.toBeNull()
    // The boss bends it (the flat second), the victory lifts it (the major third).
    expect(planBar(CUES.boss, 0, 3).melody?.map(([s]) => s)).toContain(1)
    expect(planBar(CUES.victory, 0, 0).melody?.map(([s]) => s)).toEqual([0, 4, 5, 7])
  })

  it('keeps each cue\'s tune in its mode (the bridge\'s last-bar V and the boss\'s V are the only leading tones)', () => {
    for (const id of ['hub', 'prep', 'battle', 'boss', 'victory', 'defeat'] as CueId[]) {
      const allowed = new Set(MODE_PCS[CUES[id].mode])
      if (id === 'boss' || id === 'battle' || id === 'prep') allowed.add(pc(-1)) // G♯ of the E (V) chord
      if (id === 'defeat') allowed.add(pc(-4)) // F over the F chord
      for (const p of everyBar(id)) {
        for (const [s] of p.melody ?? []) if (s !== REST) expect(allowed.has(pc(s)), `${id} bar ${p.section}:${p.bar} note ${s}`).toBe(true)
      }
    }
  })

  it('the boss is Phrygian-coloured: Am–B♭ | Am–G | F | E', () => {
    const names = [0, 1, 2, 3].flatMap((b) => {
      const c = planBar(CUES.boss, b, 3).chord
      return Array.isArray(c) ? c.map((x) => x.name) : [c.name]
    })
    expect(names).toEqual(['i', 'bII', 'i', 'VII', 'VI', 'V'])
    expect(CUES.boss.bpm).toBe(CUES.battle.bpm) // cuts in on a barline with no seam
  })

  it('the battle cue runs 2 + 48 bars and three cycles before it repeats exactly — minutes, not 14.5 s', () => {
    const cue = CUES.battle
    expect(formBars(cue)).toBe(50)
    const seconds = (exactRepeatBars(cue) * 4 * 60) / cue.bpm
    expect(seconds).toBeGreaterThan(250)
    // And consecutive cycles really do differ (the tune changes hands).
    const lead = (n: number) => planBar(cue, n, 2).lead
    expect([lead(2), lead(2 + 50), lead(2 + 100)]).toEqual(['recorder', 'lute', 'harp'])
  })

  it('the outros are one-shot and 8–12 s long', () => {
    for (const id of ['victory', 'defeat'] as const) {
      const cue = CUES[id]
      expect(cue.oneShot).toBe(true)
      const s = (formBars(cue) * 4 * 60) / cue.bpm
      expect(s).toBeGreaterThanOrEqual(8)
      expect(s).toBeLessThanOrEqual(12)
    }
  })

  it('patterns are well-formed', () => {
    for (const d of Object.values(DRUMS)) {
      expect(d.hits).toHaveLength(16)
      expect(d.shaker.length === 0 || d.shaker.length === 16).toBe(true)
    }
    for (const o of Object.values(OSTINATO)) for (const [step, idx] of o) expect(step >= 0 && step < 16 && idx >= 0 && idx < 5).toBe(true)
  })

  it('chords change on the half bar when written in pairs', () => {
    const c = CUES.battle.form[1].chords[3]
    expect(chordAt(c, 0).name).toBe('v')
    expect(chordAt(c, 8).name).toBe('i')
  })
})

describe('keys', () => {
  it('each battlefield has its own key and voices', () => {
    expect(FIELD_VOICES.greenline.key).not.toBe(FIELD_VOICES.kilnroad.key)
    expect(FIELD_VOICES.greenline.lead).not.toBe(FIELD_VOICES.kilnroad.lead)
  })
  it('endless lifts a semitone every ten waves, capped at a fifth', () => {
    expect([1, 10, 11, 20, 21, 71, 200].map(endlessKeyLift)).toEqual([0, 0, 1, 1, 2, 7, 7])
  })
  it('stings are open fifths and octaves over the tonic — no third to clash with any chord', () => {
    for (const k of [-5, -2, 0, 5, 6]) {
      for (const kind of ['clear', 'rise', 'levelup', 'call'] as const) {
        for (const s of stingDegrees(kind, k)) expect([0, 2, 5, 7]).toContain(pc(s - k))
      }
    }
    expect(stingDegrees('rarity', 0, 0)).toHaveLength(2)
    expect(stingDegrees('rarity', 0, 4)).toHaveLength(6)
  })
})

describe('instruments', () => {
  it('a Karplus–Strong pluck rings at the pitch it reports, and decays', () => {
    const sr = 24000
    const { data, hz } = renderPluck(sr, 220, PLUCKS.harp)
    expect(Math.abs(hz - 220) / 220).toBeLessThan(0.03)
    // Autocorrelation over a steady stretch: the best lag is one period.
    const a = Math.floor(0.3 * sr)
    const n = Math.floor(0.2 * sr)
    let best = 0
    let bestLag = 0
    for (let lag = Math.floor(sr / 400); lag <= Math.floor(sr / 150); lag++) {
      let acc = 0
      for (let i = a; i < a + n; i++) acc += data[i] * data[i + lag]
      if (acc > best) {
        best = acc
        bestLag = lag
      }
    }
    const est = sr / bestLag
    expect(Math.abs(est - hz) / hz).toBeLessThan(0.03)
    const rms = (x0: number, x1: number) => Math.sqrt(data.slice(x0, x1).reduce((n, v) => n + v * v, 0) / (x1 - x0))
    expect(rms(0, sr * 0.1)).toBeGreaterThan(rms(sr * 1.2, sr * 1.3) * 3)
    expect(data.every(Number.isFinite)).toBe(true)
  })

  it('drums render finite, bounded buffers', () => {
    for (const k of ['dum', 'tek', 'tomLo', 'tomHi', 'shaker', 'jingle', 'heart', 'thud'] as const) {
      const x = renderDrum(24000, k)
      expect(x.length).toBeGreaterThan(100)
      expect(Math.max(...Array.from(x, Math.abs))).toBeLessThanOrEqual(0.95)
    }
  })

  it('an anchor covers ±2 semitones by resampling', () => {
    for (let s = -10; s <= 38; s++) {
      const { anchor, rate } = anchorFor(s)
      expect(Math.abs(s - anchor)).toBeLessThanOrEqual(ANCHOR_STEP / 2)
      expect(rate).toBeCloseTo(Math.pow(2, (s - anchor) / 12), 10)
    }
  })
})
