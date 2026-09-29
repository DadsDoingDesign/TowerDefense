/**
 * The score, as data — one theme, six settings of it.
 *
 * Pure: no Web Audio, no store, no side effects, so every musical claim (the
 * melody stays in its mode, the battle cue does not repeat for minutes, the
 * boss really is Phrygian) is a unit test rather than a promise. `music.ts`
 * performs what is written here.
 *
 * ---- the theme ----------------------------------------------------------
 *
 * Four bars in A Dorian — A C D E | G E D C | D E C A | B G A — the rising
 * fourth and falling answer of a work song, with Dorian's raised sixth (F♯)
 * saved for the phrase that needs lifting. Every cue is that tune:
 *
 *   hub      D Dorian, 72 BPM — harp and a lone recorder, rubato, mostly air
 *   prep     the battlefield's key, 96 BPM — lute ostinato, soft tabor
 *   battle   the battlefield's key, 132 BPM — A / A′ / B / bridge / A″ / B′,
 *            48 bars, three instrumentation cycles before an exact repeat
 *   boss     same tempo, Phrygian: Am–B♭ | Am–G | F | E, war drums, low brass
 *   victory  A major, the theme turned up: A C♯ D E | A…  ~11 s
 *   defeat   the theme falling apart: E D C A | G F E | A…  ~12 s
 *
 * ---- units --------------------------------------------------------------
 *
 * Melody notes are `[semitones above the tonic at octave 4, length in 8ths]`
 * (A4 = 0 in A); `REST` is a rest. Chord tones are semitones above the tonic
 * at octave 3. A cue's key is added on top, so the same bars play in D in the
 * hub and in G on the Kiln Road.
 */

export type Mode = 'dorian' | 'phrygian' | 'major' | 'minor'

/** Pitch classes each mode allows, relative to its tonic. */
export const MODE_PCS: Record<Mode, number[]> = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
}

export const REST = 99
export type Note = [semi: number, eighths: number]
export type Bar = Note[]

export interface Chord {
  name: string
  /** Bass root, semitones above the tonic at octave 3 (kept within −5…+6). */
  root: number
  /** Chord tones, same reference. */
  tones: number[]
}
const ch = (name: string, root: number, tones: number[]): Chord => ({ name, root, tones })

/* Relative to an A tonic; transposed with the cue. */
export const CHORDS = {
  Am: ch('i', 0, [0, 3, 7]),
  A: ch('I', 0, [0, 4, 7]),
  C: ch('III', 3, [3, 7, 10]),
  D: ch('IV', 5, [5, 9, 12]),
  Dm: ch('iv', 5, [5, 8, 12]),
  Em: ch('v', -5, [7, 10, 14]),
  E: ch('V', -5, [7, 11, 14]),
  F: ch('VI', -4, [-4, 0, 3]),
  G: ch('VII', -2, [-2, 2, 5]),
  Bb: ch('bII', 1, [1, 5, 8]),
} as const
const K = CHORDS

/** One bar's harmony: a chord for the whole bar, or one per half. */
export type BarChord = Chord | [Chord, Chord]

export interface Section {
  id: string
  chords: BarChord[]
  /** The tune for these bars, or null for a section that has none written. */
  melody: Bar[] | null
}

/* ------------------------------------------------------------ the tune */

/** The motif (bars 1–4) and its answer (5–8). */
const THEME_A: Bar[] = [
  [[0, 2], [3, 1], [5, 1], [7, 4]], //                A  C D E—
  [[10, 3], [7, 1], [5, 2], [3, 2]], //               G. E D  C
  [[5, 2], [7, 1], [3, 1], [0, 4]], //                D  E C A—
  [[2, 2], [-2, 2], [0, 4]], //                       B  G  A—
  [[0, 2], [3, 1], [5, 1], [7, 3], [10, 1]], //       A  C D E. G
  [[12, 3], [10, 1], [7, 2], [5, 2]], //              A. G E  D
  [[3, 1], [5, 1], [7, 2], [9, 2], [7, 2]], //        C D E  F♯ E   (the Dorian lift)
  [[5, 2], [2, 2], [0, 4]], //                        D  B  A—
]
const CHORDS_A: BarChord[] = [K.Am, K.G, K.D, [K.Em, K.Am], K.Am, K.C, K.D, [K.Em, K.Am]]

/** The B strain: the theme's intervals turned over, a register up, slower. */
const THEME_B: Bar[] = [
  [[7, 3], [5, 1], [3, 2], [5, 2]], //                E. D C  D
  [[7, 4], [10, 2], [7, 2]], //                       E—  G  E
  [[5, 3], [3, 1], [0, 2], [3, 2]], //                D. C A  C
  [[5, 8]], //                                        D———
  [[3, 3], [0, 1], [-2, 2], [0, 2]], //               C. A G  A
  [[3, 2], [5, 2], [7, 4]], //                        C  D  E—
  [[10, 2], [9, 2], [7, 2], [5, 2]], //               G  F♯ E  D
  [[7, 8]], //                                        E———
]
const CHORDS_B: BarChord[] = [K.C, K.G, K.F, K.D, K.F, K.C, [K.G, K.D], K.Em]

/** The bridge has no tune of its own — the ostinato and drums build under a fragment. */
const CHORDS_BRIDGE: BarChord[] = [K.F, K.G, K.Am, K.Am, K.F, K.G, K.Em, K.E]
/** A low fragment of the motif for the bridge's second half (played by the counter voice). */
const BRIDGE_FRAG: Bar[] = [
  [[REST, 8]],
  [[REST, 8]],
  [[REST, 8]],
  [[REST, 8]],
  [[0, 2], [3, 1], [5, 1], [7, 4]],
  [[10, 3], [7, 1], [5, 2], [3, 2]],
  [[7, 2], [5, 2], [3, 2], [2, 2]],
  [[-1, 4], [2, 4]], //                               G♯ B — the V that pulls home
]

/** The boss: the same motif with Phrygian's flat second, over a descending bass. */
const THEME_BOSS: Bar[] = [
  [[0, 2], [3, 2], [5, 2], [1, 2]], //                A C | D B♭
  [[0, 3], [3, 1], [5, 2], [-2, 2]], //               A. C | D G
  [[-4, 2], [0, 2], [3, 2], [1, 2]], //               F A C B♭
  [[-1, 4], [-5, 2], [-1, 2]], //                     G♯— E G♯   (E major: Phrygian dominant)
]
const CHORDS_BOSS: BarChord[] = [[K.Am, K.Bb], [K.Am, K.G], K.F, K.E]

const THEME_VICTORY: Bar[] = [
  [[0, 2], [4, 1], [5, 1], [7, 4]], //                A C♯ D E—
  [[12, 3], [11, 1], [9, 2], [7, 2]], //              A. G♯ F♯ E
  [[5, 2], [7, 2], [9, 2], [11, 2]], //               D E F♯ G♯
  [[12, 8]], //                                       A———
]
const CHORDS_VICTORY: BarChord[] = [K.A, K.D, [K.D, K.E], K.A]

const THEME_DEFEAT: Bar[] = [
  [[7, 2], [5, 2], [3, 2], [0, 2]], //                E D C A
  [[-2, 2], [-4, 2], [-5, 4]], //                     G F E—
  [[-12, 8]], //                                      A (an octave down)
]
const CHORDS_DEFEAT: BarChord[] = [K.Am, [K.F, K.E], K.Am]

/* Sections, by name. */
const S = {
  intro: { id: 'intro', chords: [K.Am, K.Am], melody: null },
  A: { id: 'A', chords: CHORDS_A, melody: THEME_A },
  B: { id: 'B', chords: CHORDS_B, melody: THEME_B },
  bridge: { id: 'bridge', chords: CHORDS_BRIDGE, melody: BRIDGE_FRAG },
  boss: { id: 'boss', chords: [...CHORDS_BOSS, ...CHORDS_BOSS, ...CHORDS_BOSS, ...CHORDS_BOSS], melody: [...THEME_BOSS, ...THEME_BOSS, ...THEME_BOSS, ...THEME_BOSS] },
  victory: { id: 'victory', chords: CHORDS_VICTORY, melody: THEME_VICTORY },
  defeat: { id: 'defeat', chords: CHORDS_DEFEAT, melody: THEME_DEFEAT },
} satisfies Record<string, Section>

/* ------------------------------------------------------------ cues */

export type CueId = 'hub' | 'prep' | 'battle' | 'boss' | 'victory' | 'defeat'

export type Lead = 'recorder' | 'reed' | 'harp' | 'lute'

/** What one bar of one section asks the performer for. */
export interface BarPlan {
  section: string
  /** Bar within the section. */
  bar: number
  /** Is this the last bar of its section (drum fills, ritardando)? */
  last: boolean
  chord: BarChord
  /** The melody bar (tune or fragment), or null for none. */
  melody: Bar | null
  /** Which voice has the tune this bar, and in which octave (0 = as written). */
  lead: Lead | null
  leadOct: number
  /** Harmony counter-line under the tune. */
  counter: boolean
  /** Ostinato pattern name, or null. */
  ostinato: OstinatoId | null
  /** Drum pattern name, or null. */
  drums: DrumPatternId | null
}

export type OstinatoId = 'bounce' | 'tresillo' | 'run' | 'harpRoll' | 'harpSparse' | 'muted' | 'strum'
export type DrumPatternId = 'prep' | 'walk' | 'groove' | 'drive' | 'fill' | 'boss' | 'roll' | 'toll'

/** Ostinato: [16th step, index into the chord voicing]. */
export const OSTINATO: Record<OstinatoId, [number, number][]> = {
  bounce: [[0, 0], [2, 2], [4, 1], [6, 2], [8, 0], [10, 3], [12, 1], [14, 2]],
  tresillo: [[0, 0], [3, 2], [6, 1], [8, 2], [10, 3], [11, 2], [14, 1]],
  run: [[0, 0], [1, 2], [2, 1], [3, 2], [4, 3], [5, 2], [6, 1], [7, 2], [8, 0], [9, 2], [10, 1], [11, 2], [12, 4], [13, 3], [14, 2], [15, 1]],
  harpRoll: [[0, 0], [2, 1], [4, 2], [6, 3], [8, 4], [12, 2]],
  harpSparse: [[0, 0], [6, 2], [12, 3]],
  muted: [[0, 0], [2, 0], [4, 0], [6, 1], [8, 0], [10, 0], [12, 0], [14, 1]],
  strum: [[0, 0], [0, 1], [0, 2], [0, 3]],
}

/**
 * Drum patterns, one character per 16th.
 *  D dum (open low stroke)  t tek (slap)  L/H low/high war drum (ghosted
 *  lower-case)  j tambourine  . rest.  `shaker` rides alongside: x accent,
 *  o ghost.
 */
export const DRUMS: Record<DrumPatternId, { hits: string; shaker: string }> = {
  prep: { hits: 'D.......t.......', shaker: '' },
  walk: { hits: 'D.......t.......', shaker: 'x.o.x.o.x.o.x.o.' },
  groove: { hits: 'D...t.D.D..Dt...', shaker: 'xoxoxoxoxoxoxoxo' },
  drive: { hits: 'D..Dt.D.D.DDt.tt', shaker: 'xoxoxoxoxoxoxoxo' },
  fill: { hits: 'D...t.D.t.t.tttt', shaker: 'xoxoxoxo........' },
  boss: { hits: 'LlHlLlHlLlHlLHLH', shaker: 'x.x.x.x.x.x.x.x.' },
  roll: { hits: 'tttttttttttttttD', shaker: '' },
  toll: { hits: 'D...............', shaker: '' },
}

export interface CueDef {
  id: CueId
  bpm: number
  mode: Mode
  /** Key offset from the cue's host key (the hub is a fourth up from the field). */
  keyShift: number
  /** One-shot cues end after their form; the others loop it. */
  oneShot: boolean
  form: Section[]
  /** How many passes through the form before the arrangement itself repeats. */
  cycles: number
  /**
   * Rubato: a per-step tempo factor. The hub leans on the last bar of every
   * phrase; everything else keeps strict time (it has drums).
   */
  stretch?: (plan: BarPlan, step: number) => number
  /** `pass` counts earlier appearances of the same section in the form (A, A′, A″ = 0, 1, 2). */
  arrange: (sec: Section, bar: number, cycle: number, level: number, pass: number) => Omit<BarPlan, 'section' | 'bar' | 'last' | 'chord' | 'melody'> & { melody?: Bar | null }
}

const lastOf = (sec: Section, bar: number) => bar === sec.chords.length - 1

export const CUES: Record<CueId, CueDef> = {
  /**
   * The Watchtower. 72 BPM, D Dorian (a fourth above the field), no drums.
   * The recorder states the theme once every other lap; the rest is harp and
   * air. The tempo leans back at every phrase end — a player reading numbers
   * should never feel a metronome.
   */
  hub: {
    id: 'hub',
    bpm: 72,
    mode: 'dorian',
    keyShift: 5,
    oneShot: false,
    form: [S.A, S.A, S.B, S.A],
    cycles: 3,
    stretch: (p, step) => (p.last || p.bar === 3 ? 1 + (step / 15) * 0.18 : 1),
    arrange(sec, bar, cycle, _level, pass) {
      const rot = <T,>(xs: T[]): T => xs[cycle % xs.length]
      let lead: Lead | null = null
      if (sec.id === 'B') lead = rot<Lead>(['harp', 'recorder', 'harp'])
      else if (pass === 0) lead = bar >= 4 ? rot<Lead>(['recorder', 'harp', 'recorder']) : null
      else if (pass === 1) lead = rot<Lead>(['harp', 'recorder', 'lute'])
      else lead = bar < 4 ? 'lute' : null // the last lap thins to air
      return {
        lead,
        leadOct: lead === 'recorder' && cycle === 2 ? 1 : 0,
        counter: false,
        ostinato: sec.id === 'B' || pass === 2 ? 'harpSparse' : 'harpRoll',
        drums: null,
      }
    },
  },
  /**
   * The run map, the crossroads, and the deploy phase before a wave. The
   * field's key and instruments, 96 BPM: the ostinato is already walking,
   * the tabor marks the bar, the tune is only hinted — so the wave's first
   * bar still lands as a change.
   */
  prep: {
    id: 'prep',
    bpm: 96,
    mode: 'dorian',
    keyShift: 0,
    oneShot: false,
    form: [S.A, S.B, S.bridge],
    cycles: 2,
    arrange(sec, bar, cycle) {
      const tune = sec.id === 'A' ? bar >= 4 : sec.id === 'B' ? bar < 4 : false
      return {
        lead: tune ? (cycle === 0 ? 'harp' : 'recorder') : null,
        leadOct: 0,
        counter: false,
        ostinato: sec.id === 'bridge' ? 'harpRoll' : 'bounce',
        drums: bar % 2 === 0 || sec.id === 'bridge' ? 'prep' : null,
      }
    },
  },
  /**
   * The fight. 132 BPM, 48 bars: intro(2) A A′ B bridge A″ B′ — then round
   * again with the tune handed to another voice. The four stems the
   * intensity level can add (see `STEMS_FOR_LEVEL` in mix.ts) do the rest.
   */
  battle: {
    id: 'battle',
    bpm: 132,
    mode: 'dorian',
    keyShift: 0,
    oneShot: false,
    form: [S.intro, S.A, S.A, S.B, S.bridge, S.A, S.B],
    cycles: 3,
    arrange(sec, bar, cycle, level, pass) {
      const last = lastOf(sec, bar)
      const leads: Lead[] = ['recorder', 'lute', 'harp']
      let lead: Lead | null = sec.melody && sec.id !== 'bridge' ? leads[(cycle + (pass === 2 ? 1 : 0)) % 3] : null
      let leadOct = pass === 2 && lead !== 'lute' ? 1 : 0
      if (lead === 'lute') leadOct = 0
      if (sec.id === 'bridge') {
        lead = bar >= 4 ? 'lute' : null
        leadOct = -1
      }
      const drums: DrumPatternId | null =
        sec.id === 'intro' ? (bar === 1 ? 'roll' : 'toll') : last && level >= 2 ? 'fill' : level >= 3 ? 'drive' : level >= 2 ? 'groove' : 'walk'
      const ostinato: OstinatoId = sec.id === 'bridge' && bar >= 4 ? 'run' : level >= 3 ? 'run' : (cycle + pass) % 2 ? 'tresillo' : 'bounce'
      return {
        lead,
        leadOct,
        counter: sec.id !== 'intro' && sec.id !== 'bridge' && (pass >= 1 || level >= 3),
        ostinato,
        drums,
      }
    },
  },
  /**
   * The boss. Same tempo as the fight, so it cuts in on a barline without a
   * seam: Am–B♭ | Am–G | F | E, four times, war drums in 16ths, low brass on
   * every change, the motif bent Phrygian on the reed from the second lap.
   */
  boss: {
    id: 'boss',
    bpm: 132,
    mode: 'phrygian',
    keyShift: 0,
    oneShot: false,
    form: [S.boss],
    cycles: 2,
    arrange(_sec, bar, cycle) {
      const lap = Math.floor(bar / 4)
      return {
        lead: lap === 0 ? null : lap === 3 ? (cycle ? 'lute' : 'harp') : 'reed',
        leadOct: lap === 2 ? 1 : lap === 3 ? -1 : 0,
        counter: lap === 2,
        ostinato: 'muted',
        drums: bar === 15 ? 'fill' : 'boss',
      }
    },
  },
  victory: {
    id: 'victory',
    bpm: 100,
    mode: 'major',
    keyShift: 0,
    oneShot: true,
    form: [S.victory],
    cycles: 1,
    arrange(_sec, bar) {
      return {
        lead: 'recorder',
        leadOct: 0,
        counter: bar < 3,
        ostinato: bar === 3 ? 'strum' : 'bounce',
        drums: bar === 2 ? 'roll' : bar === 3 ? 'toll' : 'walk',
      }
    },
  },
  defeat: {
    id: 'defeat',
    bpm: 66,
    mode: 'minor',
    keyShift: 0,
    oneShot: true,
    form: [S.defeat],
    cycles: 1,
    stretch: (_p, step) => 1 + (step / 15) * 0.1,
    arrange(_sec, bar) {
      return {
        lead: bar < 2 ? 'recorder' : 'harp',
        leadOct: 0,
        counter: false,
        ostinato: bar === 2 ? 'strum' : 'harpSparse',
        drums: bar === 0 ? 'toll' : null,
      }
    },
  },
}

/** Total bars in one pass of a cue's form. */
export const formBars = (cue: CueDef): number => cue.form.reduce((n, s) => n + s.chords.length, 0)

/** Bars before a looping cue repeats EXACTLY (arrangement included, at a fixed intensity). */
export const exactRepeatBars = (cue: CueDef): number => formBars(cue) * cue.cycles

/**
 * What to play at absolute bar `n` of a cue (counting from its start), at an
 * intensity level. Pure; `music.ts` calls it once per bar.
 */
export function planBar(cue: CueDef, n: number, level: number): BarPlan {
  const total = formBars(cue)
  const cycle = Math.floor(n / total) % cue.cycles
  let b = ((n % total) + total) % total
  let fi = 0
  while (b >= cue.form[fi].chords.length) {
    b -= cue.form[fi].chords.length
    fi++
  }
  const sec = cue.form[fi]
  // The pass: how many earlier form slots hold the same section.
  let pass = 0
  for (let i = 0; i < fi; i++) if (cue.form[i] === sec) pass++
  const a = cue.arrange(sec, b, cycle, level, pass)
  return {
    section: sec.id,
    bar: b,
    last: b === sec.chords.length - 1,
    chord: sec.chords[b],
    melody: a.melody !== undefined ? a.melody : sec.melody ? sec.melody[b] : null,
    lead: a.lead,
    leadOct: a.leadOct,
    counter: a.counter,
    ostinato: a.ostinato,
    drums: a.drums,
  }
}

/** The chord sounding at a 16th step of a bar. */
export const chordAt = (c: BarChord, step: number): Chord => (Array.isArray(c) ? c[step < 8 ? 0 : 1] : c)

/** Per-battlefield colour: key and who plays what. */
export interface FieldVoice {
  /** Semitones from A. */
  key: number
  /** The voice that carries the tune where the arrangement says "recorder". */
  lead: Lead
  /** The ostinato instrument. */
  ostinato: 'lute' | 'harp'
}
export const FIELD_VOICES: Record<string, FieldVoice> = {
  // The Green Line: A Dorian, recorder and lute — the meadow.
  greenline: { key: 0, lead: 'recorder', ostinato: 'lute' },
  // The Kiln Road: G Dorian, a reedier shawm over harp — smoke and brick.
  kilnroad: { key: -2, lead: 'reed', ostinato: 'harp' },
}
export const DEFAULT_FIELD: FieldVoice = FIELD_VOICES.greenline

/** Endless: a semitone up every ten waves, capped at a fifth so the tune stays singable. */
export const endlessKeyLift = (round: number): number => Math.max(0, Math.min(7, Math.floor((Math.max(1, round) - 1) / 10)))

/**
 * Sting pitches for a key: open fifths and octaves over the tonic, plus the
 * ninth — no third at all, so a sting is consonant over every chord in the
 * Dorian progressions (and over the Phrygian boss's tonic) whatever bar it
 * lands on. Returned in semitones above A4 for the given key.
 */
export function stingDegrees(kind: 'clear' | 'rise' | 'levelup' | 'evolve' | 'call' | 'rarity', key: number, rung = 0): number[] {
  const k = ((key % 12) + 12) % 12
  const base = k > 6 ? k - 12 : k // keep stings around A4, whatever the key
  const shape: Record<string, number[]> = {
    clear: [-5, 0, 7, 12],
    rise: [0, 2, 7, 12],
    levelup: [0, 5, 7, 12],
    evolve: [-12, -5, 0, 7, 12, 14, 19],
    call: [-12, -5],
    rarity: [0, 7, 12, 14, 19, 24].slice(0, Math.max(2, Math.min(6, rung + 2))),
  }
  return shape[kind].map((d) => d + base)
}
