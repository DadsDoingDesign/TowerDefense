/**
 * Music — an original, procedurally performed score.
 *
 * ---- why there is no .ogg here ------------------------------------------
 *
 * The settings page has promised "music and effects" since before there was any
 * music, and the brief for this phase was: ship music, but only under a licence
 * that is unambiguously safe for commercial use with no attribution trap —
 * this repository is public and has already had one licence problem with a
 * sprite pack. The cheapest way to make that guarantee absolute is to not have
 * a third-party file at all. This score is written here, in code, and is
 * therefore the project's own work: no download, no CC-BY small print, nothing
 * to re-verify when the next asset pack changes its terms.
 *
 * It also happens to be the right engineering answer for a mobile PWA:
 *   - **0 bytes** of payload. Two streamed tracks would have been ~1.5–3 MB and
 *     would have landed in the service worker's precache (see vite.config.ts),
 *     which every player pays for on install.
 *   - It never has to be fetched, so it cannot 404, stall on a train, or need
 *     the negative-cache/backoff machinery the UI samples needed.
 *   - It is a live performance rather than a loop, so an eight-bar cycle does
 *     not audibly stitch every 30 seconds.
 *
 * ---- how it works --------------------------------------------------------
 *
 * A lookahead scheduler (the standard Web Audio pattern): a coarse `setInterval`
 * wakes up often enough to queue the next fraction of a second of notes onto the
 * *audio* clock, which is sample-accurate and immune to the main thread
 * stuttering. Nothing here reads game state; `src/audio/director.ts` decides
 * which cue should be playing and this module performs it.
 *
 * Everything is routed through the music bus in `audio.ts`, so master volume,
 * the music volume and mute all apply for free — this file never touches
 * `destination`.
 */
import { audioMuted, musicBus, onAudioReady } from './audio'

export type MusicCue = 'hub' | 'battle'

/* --------------------------------------------------------------- the notes */

/** Semitones above A2 (110 Hz) → frequency. The whole score is written in A minor. */
const hz = (semi: number): number => 110 * Math.pow(2, semi / 12)

/** A chord: its root (for the bass) and the tones the upper voices may use. */
interface Chord {
  root: number
  tones: number[]
}
const C = (root: number, tones: number[]): Chord => ({ root, tones })

/* A minor / C major, the mode this game already looks like: modal, plain, no
 * leading-tone drama except at the turn-around (the E major in bar 8). */
const Am = C(0, [0, 3, 7, 12])
const F = C(-4, [-4, 0, 3, 8])
const G = C(-2, [-2, 2, 5, 10])
const Cmaj = C(3, [3, 7, 10, 15])
const Dm = C(5, [5, 8, 12, 17])
const E = C(7, [7, 11, 14, 19])

interface CueDef {
  bpm: number
  /** One chord per bar; the progression loops. */
  bars: Chord[]
  /** Perform one 16th-note step. `t` is the audio-clock time it lands on. */
  step: (i: number, bar: number, chord: Chord, t: number, stepDur: number) => void
}

/* ----------------------------------------------------------------- voices */

let bus: { ctx: AudioContext; out: GainNode; send: GainNode } | null = null
/** Everything the score plays goes through here, so a cue can be faded as one. */
let track: GainNode | null = null
let noiseBuf: AudioBuffer | null = null

function getNoise(c: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf
  const n = Math.floor(c.sampleRate * 2)
  const b = c.createBuffer(1, n, c.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
  noiseBuf = b
  return b
}

/** Notes actually scheduled this session. Exported for verification. */
let scheduled = 0

interface NoteOpts {
  type?: OscillatorType
  attack?: number
  /** Portion of this voice sent to the music reverb. */
  send?: number
  /** Glide to this frequency across the note. */
  to?: number
  /** Detune in cents, for the two-oscillator pad. */
  detune?: number
  /** Lowpass the voice; the pad uses it to stay behind the melody. */
  lp?: number
}

function note(freq: number, t: number, dur: number, peak: number, o: NoteOpts = {}): void {
  if (!bus || !track) return
  const { ctx } = bus
  const n = ctx.createOscillator()
  n.type = o.type ?? 'triangle'
  n.frequency.setValueAtTime(Math.max(1, freq), t)
  if (o.to) n.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + dur)
  if (o.detune) n.detune.setValueAtTime(o.detune, t)
  const g = ctx.createGain()
  const a = o.attack ?? 0.008
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  let head: AudioNode = n
  if (o.lp) {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = o.lp
    n.connect(f)
    head = f
  }
  head.connect(g)
  g.connect(track)
  if (o.send) {
    const s = ctx.createGain()
    s.gain.value = o.send
    g.connect(s)
    s.connect(bus.send)
  }
  n.start(t)
  n.stop(t + dur + 0.05)
  scheduled++
}

function perc(t: number, dur: number, peak: number, hp: number, lp: number, send = 0): void {
  if (!bus || !track) return
  const { ctx } = bus
  const src = ctx.createBufferSource()
  src.buffer = getNoise(ctx)
  const f1 = ctx.createBiquadFilter()
  f1.type = 'highpass'
  f1.frequency.value = hp
  const f2 = ctx.createBiquadFilter()
  f2.type = 'lowpass'
  f2.frequency.value = lp
  const g = ctx.createGain()
  g.gain.setValueAtTime(peak, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f1)
  f1.connect(f2)
  f2.connect(g)
  g.connect(track)
  if (send) {
    const s = ctx.createGain()
    s.gain.value = send
    g.connect(s)
    s.connect(bus.send)
  }
  src.start(t, Math.random() * 1.5, dur + 0.05)
  src.stop(t + dur + 0.05)
  scheduled++
}

/** Two detuned saws under a lowpass — the bed both cues sit on. */
function pad(chord: Chord, t: number, dur: number, peak: number, lp: number): void {
  for (const s of chord.tones.slice(0, 3)) {
    note(hz(s + 12), t, dur, peak, { type: 'sawtooth', attack: dur * 0.28, send: 0.5, lp, detune: -6 })
    note(hz(s + 12), t, dur, peak * 0.8, { type: 'sawtooth', attack: dur * 0.34, send: 0.5, lp, detune: 7 })
  }
}

/* ------------------------------------------------------------------- cues */

/**
 * The battle cue. 132 BPM, driving but deliberately not busy in the top
 * octave — combat SFX live up there and the music must not fight them for the
 * band the player is listening to for information (Lisa Brown's rule: juice
 * that obscures the next threat is a defect).
 */
const BATTLE: CueDef = {
  bpm: 132,
  bars: [Am, Am, F, G, Am, Cmaj, Dm, E],
  step(i, bar, ch, t, sd) {
    // --- drums -------------------------------------------------------------
    if (i === 0 || i === 8 || i === 11) {
      note(128, t, 0.13, 0.34, { type: 'sine', to: 44, attack: 0.002 })
    }
    if (i === 4 || i === 12) {
      perc(t, 0.15, 0.16, 1400, 9000, 0.25)
      note(196, t, 0.07, 0.09, { type: 'triangle', to: 150, attack: 0.002 })
    }
    if (i % 2 === 0) perc(t, i === 14 ? 0.14 : 0.03, i === 14 ? 0.06 : 0.045, 7000, 16000, 0.15)

    // --- bass: straight 8ths, octave lift on the back half of the bar ------
    if (i % 2 === 0) {
      const oct = i === 6 || i === 14 ? 12 : 0
      note(hz(ch.root - 12 + oct), t, sd * 1.7, 0.2, { type: 'sawtooth', lp: 700, attack: 0.006 })
    }

    // --- arpeggio: 16ths through the chord, two octaves, with a rest that
    //     moves each bar so eight bars never repeat exactly ------------------
    const rest = (bar * 3 + 5) % 16
    if (i !== rest && i !== (rest + 1) % 16) {
      const seq = [...ch.tones, ...ch.tones.map((x) => x + 12)]
      const n = seq[(i + bar) % seq.length]
      note(hz(n + 12), t, sd * 2.2, 0.062, { type: 'square', send: 0.35, lp: 4200 })
    }

    // --- pad: one hit per bar, long enough to overlap the next -------------
    if (i === 0) pad(ch, t, sd * 18, 0.035, 1500)
  },
}

/**
 * The hub / menu cue. 76 BPM, no drums, wide reverb: the Watchtower is where
 * you read numbers and decide things, so the music holds still.
 */
const HUB: CueDef = {
  bpm: 76,
  bars: [Am, Am, Cmaj, Cmaj, F, F, G, E],
  step(i, bar, ch, t, sd) {
    if (i === 0) {
      pad(ch, t, sd * 19, 0.042, 1100)
      note(hz(ch.root - 12), t, sd * 14, 0.15, { type: 'sine', attack: 0.06 })
    }
    // A sparse plucked figure. The pattern rotates with the bar so the phrase
    // breathes instead of ticking.
    const pattern = [0, 3, 6, 10, 13]
    if (pattern.includes((i + bar * 2) % 16)) {
      const seq = [...ch.tones, ...ch.tones.map((x) => x + 12)]
      const n = seq[(i + bar) % seq.length]
      note(hz(n + 12), t, sd * 6, 0.075, { type: 'triangle', send: 0.7, attack: 0.01 })
    }
    // A high, quiet fifth on the last beat of every other bar — the one thing
    // in the cue that draws the ear, and it happens rarely.
    if (i === 14 && bar % 2 === 1) {
      note(hz(ch.tones[1] + 24), t, sd * 8, 0.03, { type: 'sine', send: 0.8, attack: 0.15 })
    }
  },
}

const CUES: Record<MusicCue, CueDef> = { hub: HUB, battle: BATTLE }

/* -------------------------------------------------------------- transport */

/** How far ahead notes are queued, and how often the scheduler wakes. */
const HORIZON = 0.35
const TICK_MS = 60

let wanted: MusicCue | null = null
let playing: MusicCue | null = null
let timer: ReturnType<typeof setInterval> | null = null
let stepIndex = 0
let nextTime = 0
/** Set while the tab is hidden: the transport stops rather than playing to nobody. */
let suspended = false
let readyBound = false

function stepDuration(cue: MusicCue): number {
  return 60 / CUES[cue].bpm / 4 // one 16th
}

function stopTimer(): void {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

/**
 * Fade the current track out, let its tail ring, and then let it go.
 *
 * The disconnect is the point of the timer: a cue switch, a mute and a tab
 * coming back all pass through here, and a fresh `GainNode` is created for each
 * new track — without this, every one of them stayed wired to the music bus for
 * the life of the page with a gain of zero, which over a long session is a slow
 * leak of live audio nodes for nothing.
 */
function fadeOut(seconds: number): void {
  if (!bus || !track) return
  const dying = track
  const now = bus.ctx.currentTime
  dying.gain.cancelScheduledValues(now)
  dying.gain.setValueAtTime(dying.gain.value, now)
  dying.gain.linearRampToValueAtTime(0.0001, now + seconds)
  track = null
  // A little past the fade, so the longest already-scheduled note has finished.
  setTimeout(() => dying.disconnect(), seconds * 1000 + 2500)
}

function startTrack(cue: MusicCue, fadeIn: number): void {
  const b = musicBus()
  if (!b) return
  bus = b
  track = b.ctx.createGain()
  track.gain.setValueAtTime(0.0001, b.ctx.currentTime)
  track.gain.linearRampToValueAtTime(1, b.ctx.currentTime + fadeIn)
  track.connect(b.out)
  playing = cue
  stepIndex = 0
  nextTime = b.ctx.currentTime + 0.08
  stopTimer()
  timer = setInterval(pump, TICK_MS)
  pump()
}

function pump(): void {
  if (!bus || !track || !playing || suspended) return
  const { ctx } = bus
  if (ctx.state !== 'running') return
  const cue = CUES[playing]
  const sd = stepDuration(playing)
  // A throttled or backgrounded tab can leave the transport far behind the
  // clock. Catching up note by note would dump a hundred voices at once, so
  // resynchronise instead — the score is a loop, not a recording, and nothing
  // in it needs to have been heard.
  if (nextTime < ctx.currentTime - 0.25) {
    nextTime = ctx.currentTime + 0.05
  }
  let guard = 0
  while (nextTime < ctx.currentTime + HORIZON && guard++ < 128) {
    const bar = Math.floor(stepIndex / 16) % cue.bars.length
    cue.step(stepIndex % 16, bar, cue.bars[bar], nextTime, sd)
    stepIndex++
    nextTime += sd
  }
}

/**
 * Ask for a cue. `null` stops the music.
 *
 * Safe to call before audio is unlocked and safe to call every render: asking
 * for the cue that is already playing does nothing at all, so the director can
 * simply state what should be true.
 */
export function playMusic(cue: MusicCue | null): void {
  wanted = cue
  apply()
}

function apply(): void {
  const b = musicBus()
  if (!b) {
    // No context yet (or still locked). `onAudioReady` will call back.
    bindReady()
    return
  }
  bus = b
  bindReady()
  if (audioMuted() || suspended) {
    // Muted: stop performing rather than performing into a gain of zero. The
    // master gain already silences it; this is about not spending a phone's
    // battery on notes nobody can hear.
    if (playing) {
      fadeOut(0.15)
      stopTimer()
      playing = null
    }
    return
  }
  if (wanted === playing) {
    // Already right — but the transport may have been stopped by a mute or a
    // hidden tab, so make sure it is actually running.
    if (playing && timer === null) startTrack(playing, 0.6)
    return
  }
  if (playing) {
    fadeOut(0.5)
    stopTimer()
    playing = null
  }
  if (wanted) startTrack(wanted, 1.2)
}

function bindReady(): void {
  if (readyBound) return
  readyBound = true
  // Fires on unlock, on an iOS interruption ending, and on every volume/mute
  // change — all three are moments the transport may need to start or stop.
  onAudioReady(() => apply())
}

/**
 * Stop performing because the tab went away.
 *
 * Wired from `main.tsx` to the app's ONE visibility lifecycle (`state/
 * lifecycle.ts`, Phase 1) rather than binding a second `visibilitychange`
 * listener here. A backgrounded tab's AudioContext keeps running on desktop, so
 * without this the score plays on in another app's tab forever.
 */
export function suspendMusic(): void {
  suspended = true
  if (playing) {
    fadeOut(0.2)
    stopTimer()
    playing = null
  }
}

/** The tab is back — resume whatever cue was wanted. */
export function resumeMusic(): void {
  suspended = false
  apply()
}

/** Live transport state, for tests and for the settings row. */
export function musicStatus(): {
  wanted: MusicCue | null
  playing: MusicCue | null
  running: boolean
  scheduled: number
  suspended: boolean
} {
  return { wanted, playing, running: timer !== null, scheduled, suspended }
}
