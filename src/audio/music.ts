/**
 * Music — an original, procedurally performed folk score.
 *
 * ---- why there is no .ogg here ------------------------------------------
 *
 * The brief was: ship music, but only under a licence that is unambiguously
 * safe for commercial use. The cheapest way to make that guarantee absolute is
 * to not have a third-party file at all. This score is written in this
 * repository (`theme.ts` holds the notes) and performed here, in code: 0 bytes
 * of payload, nothing to precache, nothing that can 404 on a train, and a live
 * performance rather than a loop, so it does not audibly stitch.
 *
 * ---- the band -----------------------------------------------------------
 *
 * Cozy medieval, not chiptune (Phase 4 re-orchestration). Every voice is
 * synthesised; the plucked ones are pre-rendered Karplus–Strong strings
 * (`instruments.ts`) replayed through `playbackRate`:
 *
 *   lute    short, nasal plectrum pluck — the ostinato on the Green Line
 *   harp    long, round gut pluck — arpeggios, counter-lines, the hub
 *   recorder  sine + a little 2nd/3rd harmonic, breath noise with a tongued
 *           chiff, pitch scoop, and a 5 Hz vibrato that waits 0.2 s to bloom
 *   reed    the same with a buzzier spectrum — a shawm, for the Kiln Road and
 *           the boss
 *   drone   hurdy-gurdy: saws on tonic + fifth through two formant bandpasses,
 *           with the "dog" buzz rasping in 16ths when the fight gets hot
 *   viols   the pad: three soft saws under one lowpass
 *   frame drum / tabor (dum, tek), shaker, tambourine; war drums for the boss;
 *           low brass-ish saws with a filter swell for the boss
 *
 * ---- the transport ------------------------------------------------------
 *
 * A lookahead scheduler: a coarse `setInterval` queues the next fraction of a
 * second of 16th-note steps onto the audio clock. At every barline the
 * performer asks `theme.ts` what the bar holds (`planBar`), applies the
 * intensity level the director last reported (with hysteresis), swaps between
 * the battle and boss forms if a champion arrived or fell, and picks up key
 * changes — so every adaptive change lands on a barline.
 *
 * The transport also IS the game's music clock: `audio.ts` asks it for the
 * next beat and the current key, so stings land in time and in tune.
 *
 * Nothing here reads game state; `director.ts` decides what should play.
 */
import {
  audioMuted,
  isCalmAudio,
  lowGateActive,
  musicBus,
  onAudioReady,
  registerMusicClock,
  setAudioHidden,
  setMusicActive,
  wakeAudio,
  type MusicClock,
} from './audio'
import { voiceBank, type DrumKind, type PluckKind, type VoiceBank } from './instruments'
import { CUE_LEVEL_DB, dbToGain, nextLevel, STEM_DB, STEM_PAN, STEM_SEND, STEMS_FOR_LEVEL, type Stem } from './mix'
import {
  chordAt,
  CUES,
  DEFAULT_FIELD,
  DRUMS,
  FIELD_VOICES,
  formBars,
  OSTINATO,
  planBar,
  REST,
  type BarPlan,
  type Chord,
  type CueDef,
  type CueId,
  type FieldVoice,
  type Lead,
} from './theme'

/** What the director can ask for. The boss is not a cue: it is the battle cue in its boss form. */
export type MusicCue = 'hub' | 'prep' | 'battle' | 'victory' | 'defeat'

/** Semitones above A2 → Hz. */
const hz = (semi: number): number => 110 * Math.pow(2, semi / 12)
/** Fold a key into −5…+6 so every cue stays in a singable register. */
const foldKey = (k: number): number => ((((k + 5) % 12) + 12) % 12) - 5

/* --------------------------------------------------------------- state */

/** What the director reports. Read only at barlines. */
export interface MusicState {
  /** Target intensity level, 0–3. */
  level: number
  /** A champion is on the field. */
  boss: boolean
  /** Battlefield id — picks the key and the lead/ostinato voices. */
  field: string
  /** Extra semitones (endless: +1 every ten waves). */
  keyLift: number
}
const state: MusicState = { level: 2, boss: false, field: 'greenline', keyLift: 0 }

/** Update what the score should reflect. Cheap; safe to call every frame. */
export function setMusicState(p: Partial<MusicState>): void {
  if (p.level !== undefined && Number.isFinite(p.level)) state.level = Math.max(0, Math.min(3, Math.round(p.level)))
  if (p.boss !== undefined) state.boss = !!p.boss
  if (p.field !== undefined) state.field = p.field
  if (p.keyLift !== undefined && Number.isFinite(p.keyLift)) state.keyLift = Math.max(0, Math.min(11, Math.round(p.keyLift)))
}

/* ------------------------------------------------------------ the track */

interface StemNodes {
  in: GainNode
}
interface Track {
  ctx: AudioContext
  gain: GainNode
  sendGain: GainNode
  stems: Partial<Record<Stem, StemNodes>>
  bank: VoiceBank
  drone: Drone | null
}

let bus: { ctx: AudioContext; out: GainNode; send: GainNode; sfx: GainNode } | null = null
let track: Track | null = null
let noiseBuf: AudioBuffer | null = null
/** Notes scheduled this session. Exported (via status) for verification. */
let scheduled = 0

function getNoise(c: BaseAudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf
  const n = Math.floor(c.sampleRate * 2)
  const b = c.createBuffer(1, n, c.sampleRate)
  const d = b.getChannelData(0)
  let s = 12345
  for (let i = 0; i < n; i++) {
    s = (s * 16807) % 2147483647
    d[i] = (s / 2147483647) * 2 - 1
  }
  noiseBuf = b
  return b
}

const waves = new WeakMap<BaseAudioContext, Record<'recorder' | 'reed', PeriodicWave>>()
function periodic(c: BaseAudioContext, kind: 'recorder' | 'reed'): PeriodicWave {
  let w = waves.get(c)
  if (!w) {
    const make = (amps: number[]) => {
      const real = new Float32Array(amps.length + 1)
      const imag = new Float32Array(amps.length + 1)
      amps.forEach((a, i) => (imag[i + 1] = a))
      return c.createPeriodicWave(real, imag)
    }
    // Recorder: nearly a sine — the 2nd harmonic is its "chiff" colour.
    // Reed (shawm): a double reed's dense odd-and-even ladder.
    w = { recorder: make([1, 0.3, 0.1, 0.04, 0.015]), reed: make([1, 0.75, 0.6, 0.45, 0.34, 0.25, 0.17, 0.11, 0.07]) }
    waves.set(c, w)
  }
  return w[kind]
}

/** A stem's input node on the live track, created on first use. */
function stem(s: Stem): AudioNode | null {
  if (!track) return null
  const have = track.stems[s]
  if (have) return have.in
  const { ctx } = track
  const g = ctx.createGain()
  g.gain.value = dbToGain(STEM_DB[s])
  let head: AudioNode = g
  const pan = STEM_PAN[s]
  if (pan && typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner()
    p.pan.value = pan
    g.connect(p)
    head = p
  }
  head.connect(track.gain)
  const snd = ctx.createGain()
  snd.gain.value = STEM_SEND[s]
  head.connect(snd)
  snd.connect(track.sendGain)
  track.stems[s] = { in: g }
  return g
}

/* ------------------------------------------------------------ voices */

function pluck(kind: PluckKind, semi: number, t: number, vel: number, to: AudioNode | null, cut?: number): void {
  if (!track || !to) return
  const v = track.bank.pluck(kind, semi)
  if (!v) return
  const { ctx } = track
  const src = ctx.createBufferSource()
  src.buffer = v.buf
  src.playbackRate.value = v.rate
  const g = ctx.createGain()
  g.gain.setValueAtTime(vel, t)
  if (cut) {
    // A palm-muted or damped note: choke it.
    g.gain.setValueAtTime(vel, t + cut)
    g.gain.exponentialRampToValueAtTime(0.0001, t + cut + 0.05)
  }
  src.connect(g)
  g.connect(to)
  src.start(t)
  src.stop(t + Math.min(v.buf.duration / v.rate, cut ? cut + 0.08 : 99))
  scheduled++
}

function drum(kind: DrumKind, t: number, vel: number, to: AudioNode | null, rate = 1): void {
  if (!track || !to) return
  const buf = track.bank.drum(kind)
  if (!buf) return
  const { ctx } = track
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = rate
  const g = ctx.createGain()
  g.gain.value = vel
  src.connect(g)
  g.connect(to)
  src.start(t)
  scheduled++
}

/**
 * The recorder (and, with `reed`, the shawm): a wind voice, tongued.
 */
function wind(semi: number, t: number, dur: number, vel: number, reed: boolean, to: AudioNode | null): void {
  if (!track || !to) return
  const { ctx } = track
  const f = hz(semi)
  const o = ctx.createOscillator()
  o.setPeriodicWave(periodic(ctx, reed ? 'reed' : 'recorder'))
  o.frequency.setValueAtTime(f, t)
  // The scoop: a wind note starts a little flat and blows up to pitch.
  o.detune.setValueAtTime(-28, t)
  o.detune.linearRampToValueAtTime(0, t + 0.045)
  const env = ctx.createGain()
  const a = reed ? 0.02 : 0.03
  const end = t + Math.max(0.08, dur)
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(vel, t + a)
  env.gain.setValueAtTime(vel, Math.max(t + a, end - 0.07))
  env.gain.exponentialRampToValueAtTime(0.0001, end)
  let head: AudioNode = o
  if (reed) {
    // The shawm's bell: a nasal formant, and the very top rolled off.
    const bp = ctx.createBiquadFilter()
    bp.type = 'peaking'
    bp.frequency.value = 1250
    bp.Q.value = 1.4
    bp.gain.value = 6
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3800
    o.connect(bp)
    bp.connect(lp)
    head = lp
  }
  head.connect(env)
  // Vibrato: delayed, so short notes are straight and long ones sing.
  if (dur > 0.3) {
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 5 + (semi % 3) * 0.15
    const depth = ctx.createGain()
    depth.gain.setValueAtTime(0, t)
    depth.gain.setValueAtTime(0, t + 0.2)
    depth.gain.linearRampToValueAtTime(f * 0.0065, t + Math.min(dur, 0.55))
    lfo.connect(depth)
    depth.connect(o.frequency)
    lfo.start(t)
    lfo.stop(end + 0.02)
  }
  // Breath: band-passed noise, a burst on the tongue then a thin whisper.
  const n = ctx.createBufferSource()
  n.buffer = getNoise(ctx)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = Math.min(9000, f * 2.2)
  bp.Q.value = 1.2
  const ng = ctx.createGain()
  const breath = reed ? 0.1 : 0.22
  ng.gain.setValueAtTime(0.0001, t)
  ng.gain.exponentialRampToValueAtTime(vel * breath * 2.2, t + 0.012)
  ng.gain.exponentialRampToValueAtTime(vel * breath * 0.35, t + 0.09)
  ng.gain.setValueAtTime(vel * breath * 0.35, Math.max(t + 0.09, end - 0.07))
  ng.gain.exponentialRampToValueAtTime(0.0001, end)
  n.connect(bp)
  bp.connect(ng)
  ng.connect(to)
  env.connect(to)
  o.start(t)
  o.stop(end + 0.02)
  n.start(t, (semi * 0.037) % 1.5, dur + 0.1)
  n.stop(end + 0.02)
  scheduled++
}

/**
 * The hurdy-gurdy: tonic, fifth and octave, bowed by a wheel that never stops
 * — so it is ONE voice for the life of a track, not a note per bar (notes
 * per bar left a dip at every restart). Two formant bandpasses make it a
 * wooden box rather than a synth; `buzz` opens the trompette's rasp in 16ths.
 * Key, level and buzz move at barlines, gliding.
 */
interface Drone {
  oscs: OscillatorNode[]
  env: GainNode
  buzzDepth: GainNode
  buzzBase: GainNode
  lfo: OscillatorNode
  tonic: number
}
const DRONE_PARTS: [interval: number, detune: number, level: number][] = [
  [0, -2, 1],
  [7, 2, 0.8],
  [12, 0, 0.3],
]

function droneStart(tonic: number, t: number, bpm: number, to: AudioNode): Drone | null {
  if (!track) return null
  const { ctx } = track
  const sum = ctx.createGain()
  sum.gain.value = 0.4
  const oscs = DRONE_PARTS.map(([iv, det, lvl]) => {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = hz(tonic + iv)
    o.detune.value = det
    const g = ctx.createGain()
    g.gain.value = lvl
    o.connect(g)
    g.connect(sum)
    return o
  })
  const f1 = ctx.createBiquadFilter()
  f1.type = 'bandpass'
  f1.frequency.value = 620
  f1.Q.value = 2.2
  const f2 = ctx.createBiquadFilter()
  f2.type = 'bandpass'
  f2.frequency.value = 1350
  f2.Q.value = 3
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  const f2g = ctx.createGain()
  f2g.gain.value = 0.6
  const env = ctx.createGain()
  env.gain.setValueAtTime(0, t)
  sum.connect(f1)
  sum.connect(f2)
  sum.connect(lp)
  f1.connect(env)
  f2.connect(f2g)
  f2g.connect(env)
  lp.connect(env)
  // The buzz: the envelope's output through a gain the 16th-note square wave wobbles.
  const buzzBase = ctx.createGain()
  buzzBase.gain.value = 1
  const lfo = ctx.createOscillator()
  lfo.type = 'square'
  lfo.frequency.value = (bpm / 60) * 4
  const buzzDepth = ctx.createGain()
  buzzDepth.gain.value = 0
  lfo.connect(buzzDepth)
  buzzDepth.connect(buzzBase.gain)
  env.connect(buzzBase)
  buzzBase.connect(to)
  for (const o of oscs) o.start(t)
  lfo.start(t)
  scheduled++
  return { oscs, env, buzzDepth, buzzBase, lfo, tonic }
}

/** Move the drone at a barline: glide to a new tonic, level and buzz. */
function droneSet(d: Drone, tonic: number, vel: number, buzz: number, t: number): void {
  if (tonic !== d.tonic) {
    d.oscs.forEach((o, i) => o.frequency.setTargetAtTime(hz(tonic + DRONE_PARTS[i][0]), t, 0.08))
    d.tonic = tonic
  }
  d.env.gain.setTargetAtTime(vel, t, 0.25)
  d.buzzDepth.gain.setTargetAtTime(buzz * 0.45, t, 0.05)
  d.buzzBase.gain.setTargetAtTime(1 - buzz * 0.45, t, 0.05)
}

function droneStop(d: Drone, t: number): void {
  d.env.gain.setTargetAtTime(0, t, 0.3)
  for (const o of d.oscs) o.stop(t + 2)
  d.lfo.stop(t + 2)
}

/** Viols: three soft saws on the chord, under one lowpass. */
function viols(tones: number[], t: number, dur: number, vel: number, lp: number, to: AudioNode | null): void {
  if (!track || !to) return
  const { ctx } = track
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = lp
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(vel, t + dur * 0.3)
  env.gain.setValueAtTime(vel, t + dur * 0.7)
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4)
  f.connect(env)
  env.connect(to)
  tones.slice(0, 3).forEach((s, i) => {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = hz(s)
    o.detune.value = [-7, 5, 1][i]
    o.connect(f)
    o.start(t)
    o.stop(t + dur + 0.45)
  })
  scheduled++
}

/** The boss's low brass: a power chord of saws with a filter swell. */
function brass(root: number, t: number, dur: number, vel: number, to: AudioNode | null): void {
  if (!track || !to) return
  const { ctx } = track
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.Q.value = 2
  f.frequency.setValueAtTime(300, t)
  f.frequency.exponentialRampToValueAtTime(1700, t + 0.1)
  f.frequency.exponentialRampToValueAtTime(800, t + 0.45)
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(vel, t + 0.05)
  env.gain.setValueAtTime(vel * 0.75, t + Math.max(0.1, dur - 0.1))
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15)
  f.connect(env)
  env.connect(to)
  for (const [s, d] of [
    [root, -6],
    [root, 6],
    [root + 7, 0],
    [root + 12, 3],
  ] as const) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = hz(s)
    o.detune.value = d
    o.connect(f)
    o.start(t)
    o.stop(t + dur + 0.2)
  }
  scheduled++
}

/* ------------------------------------------------------------ performing */

/** The chord's ostinato voicing: root, fifth, octave, tenth, twelfth. */
const voicing = (c: Chord): number[] => {
  const [r, third, fifth] = c.tones
  return [r, fifth, r + 12, third + 12, fifth + 12]
}

/** The melody note sounding at a 16th step (for the counter-line), or null. */
function melodyAt(bar: BarPlan['melody'], step: number): number | null {
  if (!bar) return null
  let pos = 0
  for (const [s, e] of bar) {
    if (step >= pos && step < pos + e * 2) return s === REST ? null : s
    pos += e * 2
  }
  return null
}

/** A harmony note under the tune: the chord tone a third-to-sixth below it. */
export function counterNote(c: Chord, mel: number | null): number {
  const pcs = c.tones.map((x) => ((x % 12) + 12) % 12)
  if (mel === null) return c.tones[1] + 12
  for (let d = 3; d <= 9; d++) {
    const cand = mel - d
    if (pcs.includes(((cand % 12) + 12) % 12)) return cand
  }
  return mel - 12
}

interface Perf {
  cue: CueDef
  field: FieldVoice
  /** Tonic, semitones above A2. */
  key: number
  plan: BarPlan
  stems: ReadonlySet<Stem>
  level: number
  calm: boolean
}

const leadVoice = (lead: Lead, field: FieldVoice): Lead => (lead === 'recorder' ? field.lead : lead)

function performStep(p: Perf, step: number, t: number, sd: number): void {
  const { plan, key, cue } = p
  const chord = chordAt(plan.chord, step)
  const on = (s: Stem) => p.stems.has(s)
  const rnd = () => 0.9 + ((step * 7 + plan.bar * 13) % 10) / 50 // deterministic ±10 % velocity

  // --- drums ---------------------------------------------------------------
  if (on('drums') && plan.drums) {
    const pat = DRUMS[plan.drums]
    const c = pat.hits[step]
    const to = stem('drums')
    if (c === 'D') drum('dum', t, 0.9 * rnd(), to)
    else if (c === 't') drum('tek', t, (step % 4 === 0 ? 0.62 : 0.4) * rnd(), to)
    else if (c === 'L' || c === 'l') drum('tomLo', t, (c === 'L' ? 0.85 : 0.36) * rnd(), to)
    else if (c === 'H' || c === 'h') drum('tomHi', t, (c === 'H' ? 0.75 : 0.32) * rnd(), to)
    const sh = pat.shaker[step]
    if (sh === 'x') drum('shaker', t, 0.34 * rnd(), to)
    else if (sh === 'o') drum('shaker', t, 0.15 * rnd(), to, 1.08)
    if (p.level >= 3 && (step === 4 || step === 12) && cue.id === 'battle') drum('jingle', t, 0.2, to)
    // The boss keeps the frame drum under its war drums, on the beat.
    if (cue.id === 'boss' && (step === 0 || step === 8)) drum('dum', t, 0.85, to)
  }

  // --- bass / drone ----------------------------------------------------------
  if (!on('bass') && step === 0 && track?.drone) droneSet(track.drone, key, 0, 0, t)
  if (on('bass')) {
    const to = stem('bass')
    if (step === 0 && track && to) {
      const buzz = p.calm ? 0 : cue.id === 'boss' ? 0.8 : cue.id === 'battle' && p.level >= 2 ? 0.45 : 0
      const vel = cue.id === 'hub' ? 0.12 : cue.id === 'defeat' ? 0.09 : 0.11
      if (!track.drone) track.drone = droneStart(key, t, cue.bpm, to)
      if (track.drone) droneSet(track.drone, key, vel, buzz, t)
    }
    if (cue.id === 'boss') {
      if (step === 0 || (step === 8 && Array.isArray(plan.chord))) brass(key + chord.root, t, sd * 7.5, 0.12, to)
    } else if (cue.id !== 'hub' && cue.id !== 'defeat') {
      // A low harp on the roots: 1 and 3, the fifth pushing on the "and" of 2
      // once the fight is up.
      const root = key + chord.root
      const hits = p.level >= 2 && cue.id === 'battle' ? [0, 6, 8, 14] : [0, 8]
      if (hits.includes(step)) pluck('harp', step === 6 ? root + 7 : step === 14 ? root + 12 : root, t, 0.5, to, sd * 3.5)
    }
  }

  // --- the ostinato --------------------------------------------------------
  if (on('pluck') && plan.ostinato) {
    const pat = OSTINATO[plan.ostinato]
    const v = voicing(chord)
    const kind: PluckKind = cue.id === 'hub' || cue.id === 'defeat' ? 'harp' : p.field.ostinato
    const to = stem('pluck')
    const vel = cue.id === 'hub' ? 0.5 : plan.ostinato === 'run' ? 0.26 : plan.ostinato === 'muted' ? 0.4 : 0.34
    pat.forEach(([s, idx], i) => {
      if (s !== step) return
      const semi = key + 12 + v[Math.min(v.length - 1, idx)]
      if (plan.ostinato === 'strum') pluck('harp', semi, t + i * 0.035, 0.3, to)
      else if (plan.ostinato === 'muted') pluck('lute', semi - 12, t, vel, to, sd * 1.2)
      else pluck(kind, semi, t, vel * (s % 4 === 0 ? 1 : 0.8), to)
    })
  }

  // --- the tune ------------------------------------------------------------
  if (on('melody') && plan.melody && plan.lead) {
    const to = stem('melody')
    const voice = leadVoice(plan.lead, p.field)
    let pos = 0
    for (const [s, e] of plan.melody) {
      if (pos === step && s !== REST) {
        const semi = key + 24 + s + 12 * plan.leadOct
        const dur = e * 2 * sd
        // Rubato in the hub: the tune breathes a few ms either side of the grid.
        const lean = cue.id === 'hub' ? (((s * 31 + plan.bar * 17) % 7) - 3) * 0.006 : 0
        if (voice === 'recorder' || voice === 'reed') wind(semi, t + Math.max(0, lean), dur * 0.94, voice === 'reed' ? 0.16 : 0.2, voice === 'reed', to)
        else pluck(voice, semi, t + Math.max(0, lean), voice === 'harp' ? 0.5 : 0.46, to)
      }
      pos += e * 2
    }
  }
  if (on('melody') && plan.counter && (step === 0 || step === 8) && (cue.id !== 'battle' || p.level >= 2)) {
    const mel = melodyAt(plan.melody, step)
    const semi = key + 24 + counterNote(chord, mel) + 12 * Math.min(0, plan.leadOct)
    pluck(p.field.ostinato === 'harp' ? 'lute' : 'harp', semi, t, 0.26, stem('melody'))
  }

  // --- the pad ---------------------------------------------------------------
  if (on('pad') && (step === 0 || (step === 8 && Array.isArray(plan.chord)))) {
    const len = Array.isArray(plan.chord) ? sd * 8 : sd * 16
    const vel = cue.id === 'hub' ? 0.05 : 0.04
    viols(
      chord.tones.map((x) => key + 12 + x),
      t,
      len,
      vel,
      cue.id === 'boss' ? 1300 : 950,
      stem('pad'),
    )
  }

  // --- the Gate's heartbeat -------------------------------------------------
  // Locked to the score (every two beats: 66 BPM at the fight's 132), and on
  // the Effects bus, so the music's low-gate lowpass never muffles it.
  if (lowGateActive() && (cue.id === 'battle' || cue.id === 'boss') && step % 8 === 0 && bus) {
    const buf = track?.bank.drum('heart')
    if (buf && track) {
      const src = track.ctx.createBufferSource()
      src.buffer = buf
      const g = track.ctx.createGain()
      g.gain.value = 0.14
      src.connect(g)
      g.connect(bus.sfx)
      src.start(t)
      scheduled++
    }
  }
}

/* ------------------------------------------------------------ transport */

const HORIZON = 0.35
const TICK_MS = 60

let wanted: MusicCue | null = null
let playing: MusicCue | null = null
/** The form actually being performed ('boss' while the battle cue is in its boss form). */
let form: CueId = 'hub'
let timer: ReturnType<typeof setInterval> | null = null
let barN = 0
let step = 0
let nextTime = 0
let plan: BarPlan | null = null
let perf: Perf | null = null
let level = 2
let barsBelow = 0
let suspended = false
let readyBound = false
/** A one-shot outro that has finished while still wanted — the hub follows it. */
let outroDone: MusicCue | null = null
/** Recent beat times (audio clock), for the music clock. */
const beats: number[] = []
let beatDur = 0.5
let prerenderMs = 0

/** Each cue's bar when it last stopped (the hub resumes on its phrase). */
const position: Record<MusicCue, number> = { hub: 0, prep: 0, battle: 0, victory: 0, defeat: 0 }

/**
 * Where a cue should start, in bars. The hub and the prep cue pick up at the
 * start of the four-bar phrase they were in (the player hears them after
 * every wave; bar 1 every time was the same four bars all session). The fight
 * and the outros start at the top: their first bar landing is the point.
 */
export function resumeBar(cue: MusicCue, stoppedAt: number): number {
  if (cue !== 'hub' && cue !== 'prep') return 0
  const total = formBars(CUES[cue])
  return (Math.floor(Math.max(0, stoppedAt) / 4) * 4) % total
}

const fieldVoice = (): FieldVoice => FIELD_VOICES[state.field] ?? DEFAULT_FIELD

function keyFor(cue: CueDef): number {
  if (cue.id === 'hub') return foldKey(cue.keyShift)
  return foldKey(fieldVoice().key + state.keyLift + cue.keyShift)
}

function stemsFor(cue: CueDef, lvl: number, calm: boolean): Set<Stem> {
  const base: readonly Stem[] =
    cue.id === 'battle' || cue.id === 'boss' ? STEMS_FOR_LEVEL[lvl] : ['drums', 'bass', 'pluck', 'melody', 'pad']
  return new Set(base.filter((s) => !(calm && s === 'drums')))
}

/** Begin a bar: the one place any adaptive change is allowed to happen. */
function beginBar(): void {
  if (!playing) return
  // Battle ⇄ boss, on the barline.
  if (playing === 'battle') {
    if (state.boss && form !== 'boss') {
      form = 'boss'
      barN = 0
    } else if (!state.boss && form === 'boss') {
      form = 'battle'
      barN = 2 // straight back into A, past the intro
    }
  }
  const cue = CUES[form]
  if (cue.oneShot && barN >= formBars(cue)) {
    finishOutro()
    return
  }
  const nl = nextLevel(level, state.level, barsBelow)
  level = nl.level
  barsBelow = nl.barsBelow
  const calm = isCalmAudio()
  plan = planBar(cue, barN, level)
  perf = { cue, field: fieldVoice(), key: keyFor(cue), plan, stems: stemsFor(cue, level, calm), level, calm }
  beatDur = 60 / cue.bpm
}

function finishOutro(): void {
  const done = playing
  outroDone = done
  plan = null
  perf = null
  stopPlaying(3)
  if (done) position[done] = 0
  apply()
}

function stopTimer(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

/** Fade the current track out, let its tail ring, then disconnect it. */
function fadeOut(seconds: number): void {
  if (!bus || !track) return
  const dying = track
  const now = bus.ctx.currentTime
  if (dying.drone) droneStop(dying.drone, now + seconds * 0.5)
  for (const g of [dying.gain, dying.sendGain]) {
    g.gain.cancelScheduledValues(now)
    g.gain.setValueAtTime(g.gain.value, now)
    g.gain.linearRampToValueAtTime(0.0001, now + seconds)
  }
  track = null
  setTimeout(() => {
    dying.gain.disconnect()
    dying.sendGain.disconnect()
  }, seconds * 1000 + 2500)
}

function stopPlaying(fade: number): void {
  if (!playing) return
  position[playing] = barN
  fadeOut(fade)
  stopTimer()
  playing = null
  setMusicActive(false)
}

function startTrack(cue: MusicCue, fadeIn: number, at?: number): void {
  const b = musicBus()
  if (!b) return
  bus = b
  const { ctx } = b
  const gain = ctx.createGain()
  const sendGain = ctx.createGain()
  const now = ctx.currentTime
  const lvl = dbToGain(CUE_LEVEL_DB[cue])
  for (const g of [gain, sendGain]) {
    g.gain.setValueAtTime(0.0001, now)
    g.gain.linearRampToValueAtTime(g === gain ? lvl : lvl, now + fadeIn)
  }
  gain.connect(b.out)
  sendGain.connect(b.send)
  const bank = voiceBank(ctx)
  const before = bank.stats().ms
  // Pre-render the strings this cue will reach for (Karplus–Strong anchors
  // from the bass roots to the top of the tune), so no note ever pays for a
  // render on the audio clock's deadline.
  bank.warm(['harp'], -8, 36)
  bank.warm(['lute'], 0, 36)
  for (const d of ['dum', 'tek', 'shaker', 'tomLo', 'tomHi', 'jingle', 'heart'] as const) bank.drum(d)
  prerenderMs += bank.stats().ms - before
  track = { ctx, gain, sendGain, stems: {}, bank, drone: null }
  playing = cue
  form = cue
  if (cue === 'battle' && state.boss) form = 'boss'
  barN = resumeBar(cue, position[cue])
  step = 0
  level = state.level
  barsBelow = 0
  setMusicActive(true)
  nextTime = at !== undefined && at > now ? at : now + 0.08
  stopTimer()
  timer = setInterval(pump, TICK_MS)
  pump()
}

function pump(): void {
  if (!bus || !track || !playing || suspended) return
  const { ctx } = bus
  if (ctx.state !== 'running') return
  // A throttled tab can leave the transport far behind the clock; resync
  // rather than dumping a hundred voices at once.
  if (nextTime < ctx.currentTime - 0.25) nextTime = ctx.currentTime + 0.05
  let guard = 0
  while (playing && nextTime < ctx.currentTime + HORIZON && guard++ < 128) {
    if (step === 0) beginBar()
    if (!playing || !perf) return
    const cue = perf.cue
    const sd = (60 / cue.bpm / 4) * (cue.stretch ? cue.stretch(perf.plan, step) : 1)
    if (step % 4 === 0) {
      beats.push(nextTime)
      if (beats.length > 8) beats.shift()
    }
    performStep(perf, step, nextTime, sd)
    nextTime += sd
    step++
    if (step === 16) {
      step = 0
      barN++
    }
  }
}

/* ------------------------------------------------------------ the clock */

/**
 * The music clock `audio.ts` quantises stings to. `nextBeat` answers with a
 * scheduled beat when one is queued, else extrapolates on the grid; when a
 * beat is more than half a second off (the 72 BPM hub) it answers on the 8th
 * instead, so a tap is never held longer than that.
 */
function clock(): MusicClock | null {
  if (!playing || !perf || !bus) return null
  const cue = perf.cue
  return {
    cue: form,
    bpm: cue.bpm,
    beat: beatDur,
    key: perf.key,
    mode: cue.mode,
    nextBeat(after: number): number {
      const grid = beatDur > 0.5 ? beatDur / 2 : beatDur
      const last = beats.length ? beats[beats.length - 1] : nextTime
      for (const b of beats) if (b >= after) return b
      if (last >= after) return last
      const k = Math.ceil((after - last) / grid)
      return last + k * grid
    },
  }
}

/* ------------------------------------------------------------ the API */

/**
 * Ask for a cue. `null` stops the music. Safe to call every render: asking for
 * what is already playing does nothing.
 */
export function playMusic(cue: MusicCue | null): void {
  if (cue !== wanted) outroDone = null
  wanted = cue
  apply()
}

/** What should actually be performing: an outro that has finished hands over to the hub. */
const effective = (): MusicCue | null => (wanted && wanted === outroDone ? 'hub' : wanted)

function apply(): void {
  const b = musicBus()
  if (!b) {
    bindReady()
    if (wanted && !audioMuted() && !suspended) wakeAudio()
    return
  }
  bus = b
  bindReady()
  if (audioMuted() || suspended) {
    stopPlaying(0.15)
    return
  }
  const want = effective()
  if (want === playing) {
    if (playing && timer === null) startTrack(playing, 0.6)
    return
  }
  // Hand over ON THE BEAT: the new cue's first bar lands on the old cue's
  // next beat — the same beat a wave-start sting was quantised to.
  const c = clock()
  const at = c ? c.nextBeat(b.ctx.currentTime + 0.03) : undefined
  const fromOutro = !playing && outroDone !== null
  stopPlaying(0.5)
  // The fight and the outros land on their downbeat; the hub and prep drift in.
  const fadeIn = fromOutro ? 3 : want === 'battle' ? 0.1 : want === 'victory' || want === 'defeat' ? 0.05 : 1.2
  if (want) startTrack(want, fadeIn, at !== undefined && at - b.ctx.currentTime < 0.7 ? at : undefined)
}

function bindReady(): void {
  if (readyBound) return
  readyBound = true
  registerMusicClock(clock)
  onAudioReady(() => apply())
}

/** Stop performing because the tab went away (the app's one lifecycle, not a second listener). */
export function suspendMusic(): void {
  suspended = true
  stopPlaying(0.2)
  setAudioHidden(true)
}

/** The tab is back — resume whatever cue was wanted. */
export function resumeMusic(): void {
  suspended = false
  setAudioHidden(false)
  apply()
}

/** Live transport state, for tests, the dev hook and the harness. */
export function musicStatus(): {
  wanted: MusicCue | null
  playing: MusicCue | null
  form: CueId | null
  bar: number
  level: number
  key: number | null
  running: boolean
  scheduled: number
  suspended: boolean
  prerenderMs: number
  bankBytes: number
} {
  return {
    wanted,
    playing,
    form: playing ? form : null,
    bar: barN,
    level,
    key: perf?.key ?? null,
    running: timer !== null,
    scheduled,
    suspended,
    prerenderMs: Math.round(prerenderMs * 10) / 10,
    bankBytes: track ? track.bank.stats().bytes : 0,
  }
}
