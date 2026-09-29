/**
 * The folk instruments, as pure DSP.
 *
 * Every function here takes a sample rate and returns a `Float32Array` — no Web
 * Audio, no module-level state, no side effects (the F11 rule `audio.ts` spells
 * out applies here too: `npm run balance` evaluates this file under plain
 * Node). `bank.ts`-style caching of the resulting `AudioBuffer`s lives in
 * `voiceBank()` below, behind a context the caller passes in.
 *
 * Why pre-rendered rather than built from oscillators per note: a plucked
 * string is a delay line with a filter in its feedback loop (Karplus–Strong),
 * and Web Audio has no per-sample feedback short of an AudioWorklet. Rendering
 * each voice once, at a few anchor pitches, and replaying it with
 * `playbackRate` costs one BufferSource and one gain per note — cheaper on a
 * phone than the three-oscillator "pluck" it replaces, and it sounds like wood
 * and gut instead of a chip.
 */

/** A small deterministic PRNG, so a render is the same on every boot. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) / 4294967296) * 2 - 1
  }
}

/** RBJ biquad, direct form I, applied in place. */
function biquad(x: Float32Array, sr: number, type: 'bp' | 'lp' | 'hp' | 'peak', f: number, q: number, gainDb = 0): void {
  const w = (2 * Math.PI * Math.min(f, sr * 0.45)) / sr
  const cw = Math.cos(w)
  const al = Math.sin(w) / (2 * q)
  const A = Math.pow(10, gainDb / 40)
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number
  switch (type) {
    case 'lp':
      b0 = (1 - cw) / 2
      b1 = 1 - cw
      b2 = b0
      a0 = 1 + al
      a1 = -2 * cw
      a2 = 1 - al
      break
    case 'hp':
      b0 = (1 + cw) / 2
      b1 = -(1 + cw)
      b2 = b0
      a0 = 1 + al
      a1 = -2 * cw
      a2 = 1 - al
      break
    case 'bp':
      b0 = al
      b1 = 0
      b2 = -al
      a0 = 1 + al
      a1 = -2 * cw
      a2 = 1 - al
      break
    case 'peak':
    default:
      b0 = 1 + al * A
      b1 = -2 * cw
      b2 = 1 - al * A
      a0 = 1 + al / A
      a1 = -2 * cw
      a2 = 1 - al / A
      break
  }
  b0 /= a0
  b1 /= a0
  b2 /= a0
  a1 /= a0
  a2 /= a0
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i]
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1
    x1 = x0
    y2 = y1
    y1 = y0
    x[i] = y0
  }
}

function normalise(x: Float32Array, peak: number): Float32Array {
  let m = 0
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]))
  if (m > 0) {
    const k = peak / m
    for (let i = 0; i < x.length; i++) x[i] *= k
  }
  // A few-ms fade at the end, so a buffer that stops early never clicks.
  const fade = Math.min(x.length, 256)
  for (let i = 0; i < fade; i++) x[x.length - 1 - i] *= i / fade
  return x
}

export type PluckKind = 'lute' | 'harp' | 'bow'

export interface PluckSpec {
  /** Seconds to −60 dB at the fundamental. */
  t60: number
  /** 0 = dark (thumb on gut), 1 = bright (plectrum on wire). */
  bright: number
  /** Pluck position along the string, 0–0.5; sets which harmonics are missing. */
  pick: number
  /** Rendered length in seconds. */
  len: number
  /** Body resonances: [Hz, Q, dB]. */
  body: [number, number, number][]
}

/**
 * The three plucked voices. The lute is short and nasal (a plectrum near the
 * bridge, a small box body); the harp is long, round and dark; the bow is the
 * Rogue's bowstring — very low, very short, mostly thump.
 */
export const PLUCKS: Record<PluckKind, PluckSpec> = {
  lute: { t60: 1.1, bright: 0.62, pick: 0.13, len: 1.0, body: [[190, 2.2, 5], [420, 3, 3], [2600, 1.2, -2]] },
  harp: { t60: 2.6, bright: 0.35, pick: 0.3, len: 1.6, body: [[260, 1.5, 2]] },
  bow: { t60: 0.22, bright: 0.5, pick: 0.08, len: 0.32, body: [[160, 3, 6], [900, 4, 4]] },
}

/**
 * Karplus–Strong with a pick-position comb and a body.
 *
 * Integer delay line; the fractional part of the period is not corrected here
 * because the caller replays the buffer through `playbackRate` against the
 * pitch this returns (`hz`), which is exact.
 */
export function renderPluck(sr: number, f0: number, spec: PluckSpec, seed = 1): { data: Float32Array; hz: number } {
  const n = Math.max(8, Math.round(sr / f0))
  const hz = sr / (n + 0.5) // the two-tap average adds half a sample of delay
  const out = new Float32Array(Math.floor(sr * spec.len))
  const r = rng(seed * 7919 + n)
  // Excitation: noise, darkened by a one-pole lowpass (brightness), then a
  // comb at the pick position — plucking at 1/8 of the string removes every
  // 8th harmonic, which is most of what makes a lute sound like a lute.
  const exc = new Float32Array(n)
  let lp = 0
  const a = 0.15 + 0.8 * spec.bright
  for (let i = 0; i < n; i++) {
    lp += (r() - lp) * a
    exc[i] = lp
  }
  const pd = Math.max(1, Math.round(spec.pick * n))
  const line = new Float32Array(n)
  for (let i = 0; i < n; i++) line[i] = exc[i] - (i >= pd ? exc[i - pd] : 0) * 0.9
  // Loss per period for the requested T60 at f0.
  const g = Math.pow(10, -3 / (spec.t60 * hz))
  // Brightness also sets the loop filter: a bright string loses its top slower.
  const s = 0.5 - 0.22 * spec.bright
  let idx = 0
  let prev = 0
  for (let i = 0; i < out.length; i++) {
    const cur = line[idx]
    out[i] = cur
    const next = g * ((1 - s) * cur + s * prev)
    prev = cur
    line[idx] = next
    idx = idx + 1 === n ? 0 : idx + 1
  }
  for (const [f, q, db] of spec.body) biquad(out, sr, 'peak', f, q, db)
  // Keep the sub out: nothing under ~70 Hz is doing anything but eating headroom.
  biquad(out, sr, 'hp', 70, 0.7)
  return { data: normalise(out, 0.85), hz }
}

export type DrumKind = 'dum' | 'tek' | 'tomLo' | 'tomHi' | 'shaker' | 'jingle' | 'heart' | 'thud'

/**
 * Frame drum and friends.
 *
 * A struck membrane is a set of INHARMONIC modes (1, 1.59, 2.14, 2.30 × the
 * fundamental for an ideal circular membrane), each decaying at its own rate,
 * plus the noise of the hand. The 808 kick this replaces was one sine gliding
 * down — a synthesiser's idea of a drum. These are a hand on a skin.
 */
export function renderDrum(sr: number, kind: DrumKind, seed = 3): Float32Array {
  const r = rng(seed * 104729 + kind.length * 31)
  const mk = (s: number) => new Float32Array(Math.floor(sr * s))
  const modes = (x: Float32Array, f0: number, drop: number, list: [number, number, number][]): void => {
    // [ratio, amp, decay s]; the pitch settles from f0·(1+drop) to f0 in 40 ms.
    const ph = list.map(() => 0)
    for (let i = 0; i < x.length; i++) {
      const t = i / sr
      const bend = 1 + drop * Math.exp(-t / 0.04)
      let v = 0
      for (let k = 0; k < list.length; k++) {
        const [ratio, amp, dec] = list[k]
        ph[k] += (2 * Math.PI * f0 * ratio * bend) / sr
        v += Math.sin(ph[k]) * amp * Math.exp(-t / dec)
      }
      x[i] += v
    }
  }
  const burst = (x: Float32Array, amp: number, dec: number, f: number, q: number, type: 'bp' | 'hp' | 'lp' = 'bp'): void => {
    const nb = new Float32Array(x.length)
    for (let i = 0; i < nb.length; i++) nb[i] = r() * amp * Math.exp(-i / sr / dec)
    biquad(nb, sr, type, f, q)
    for (let i = 0; i < x.length; i++) x[i] += nb[i]
  }
  let x: Float32Array
  switch (kind) {
    case 'dum': // the open low stroke: body + a phone-audible head mode
      x = mk(0.55)
      modes(x, 84, 0.5, [
        [1, 1, 0.22],
        [1.59, 0.45, 0.12],
        [2.14, 0.3, 0.08],
        [3.9, 0.22, 0.05], // ~330 Hz — what a phone speaker actually plays
      ])
      burst(x, 0.6, 0.02, 700, 0.8)
      biquad(x, sr, 'peak', 330, 1.5, 4)
      return normalise(x, 0.9)
    case 'tek': // the slap near the rim
      x = mk(0.16)
      modes(x, 410, 0.15, [
        [1, 0.5, 0.03],
        [2.3, 0.3, 0.02],
      ])
      burst(x, 1, 0.035, 2200, 0.9)
      burst(x, 0.4, 0.012, 5200, 1.2)
      return normalise(x, 0.85)
    case 'tomLo':
    case 'tomHi': {
      // The boss's war drums: bigger, tighter skins with a stick.
      const f = kind === 'tomLo' ? 98 : 146
      x = mk(0.42)
      modes(x, f, 0.7, [
        [1, 1, 0.18],
        [1.59, 0.5, 0.1],
        [2.14, 0.35, 0.06],
        [3.1, 0.25, 0.04],
      ])
      burst(x, 0.7, 0.015, 1500, 0.8)
      return normalise(x, 0.9)
    }
    case 'shaker': {
      // Seeds in a gourd: a short swell, not a click, then a quick fall.
      x = mk(0.1)
      for (let i = 0; i < x.length; i++) {
        const t = i / sr
        const env = Math.min(1, t / 0.012) * Math.exp(-Math.max(0, t - 0.012) / 0.028)
        x[i] = r() * env
      }
      biquad(x, sr, 'hp', 4800, 0.7)
      biquad(x, sr, 'peak', 7500, 1, 4)
      return normalise(x, 0.7)
    }
    case 'jingle': {
      // Tambourine zils: a handful of inharmonic high partials, and a rattle.
      x = mk(0.3)
      const parts = [5230, 6120, 7410, 8870, 9620]
      for (const p of parts) {
        const d = 0.06 + 0.1 * Math.abs(r())
        for (let i = 0; i < x.length; i++) x[i] += Math.sin((2 * Math.PI * p * i) / sr) * 0.2 * Math.exp(-i / sr / d)
      }
      burst(x, 0.6, 0.05, 6500, 0.9, 'hp')
      return normalise(x, 0.6)
    }
    case 'heart': {
      // Lub-dub at the bottom of a phone's reach, plus the soft tick that
      // is what a phone actually hears.
      x = mk(0.6)
      const thump = (at: number, f: number, amp: number) => {
        const i0 = Math.floor(at * sr)
        let ph = 0
        for (let i = i0; i < x.length; i++) {
          const t = (i - i0) / sr
          ph += (2 * Math.PI * f * (1 + 0.3 * Math.exp(-t / 0.02))) / sr
          x[i] += Math.sin(ph) * amp * Math.min(1, t / 0.006) * Math.exp(-t / 0.07)
        }
      }
      thump(0, 60, 1)
      thump(0.26, 55, 0.7)
      const tick = new Float32Array(x.length)
      for (let i = 0; i < Math.floor(0.03 * sr); i++) tick[i] = r() * Math.exp(-i / sr / 0.006)
      biquad(tick, sr, 'bp', 1400, 2)
      for (let i = 0; i < x.length; i++) x[i] += tick[i] * 0.5
      return normalise(x, 0.9)
    }
    case 'thud':
    default: {
      // A goblin's club on a shield: dull, low-mid, no ring.
      x = mk(0.2)
      modes(x, 150, 0.4, [
        [1, 1, 0.05],
        [1.7, 0.5, 0.035],
      ])
      burst(x, 0.9, 0.03, 480, 1.1)
      biquad(x, sr, 'lp', 1800, 0.7)
      return normalise(x, 0.9)
    }
  }
}

/* ------------------------------------------------------------ the bank */

/** Anchor spacing in semitones — every anchor covers ±2 by resampling. */
export const ANCHOR_STEP = 4
/** Lowest anchor, semitones above A2 (110 Hz). */
export const ANCHOR_LO = -12
export const ANCHOR_HI = 40

/** Which anchor serves semitone `s` (relative to A2), and the playback rate. */
export function anchorFor(s: number): { anchor: number; rate: number } {
  const clamped = Math.max(ANCHOR_LO, Math.min(ANCHOR_HI, s))
  const anchor = ANCHOR_LO + Math.round((clamped - ANCHOR_LO) / ANCHOR_STEP) * ANCHOR_STEP
  return { anchor, rate: Math.pow(2, (s - anchor) / 12) }
}

export interface VoiceBank {
  /** Buffer + exact playback rate for a pluck at `semi` above A2. */
  pluck(kind: PluckKind, semi: number): { buf: AudioBuffer; rate: number } | null
  drum(kind: DrumKind): AudioBuffer | null
  /** Total milliseconds spent rendering so far, and buffers held. */
  stats(): { ms: number; buffers: number; bytes: number }
}

/**
 * Pluck buffers are rendered at 24 kHz whatever the context runs at: nothing a
 * gut string does above 12 kHz matters on a phone, and it is half the memory of
 * 48 kHz for a bank that would otherwise be the largest thing audio holds.
 */
const PLUCK_SR = 24000

const banks = new WeakMap<BaseAudioContext, VoiceBank>()

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/** The per-context voice bank. Lazy: an anchor is rendered the first time it is asked for. */
export function voiceBank(ctx: BaseAudioContext): VoiceBank {
  const have = banks.get(ctx)
  if (have) return have
  const plucks = new Map<string, { buf: AudioBuffer; hz: number }>()
  const drums = new Map<DrumKind, AudioBuffer>()
  let ms = 0
  let bytes = 0
  const makeBuf = (data: Float32Array, sr: number): AudioBuffer | null => {
    try {
      const b = ctx.createBuffer(1, data.length, sr)
      b.getChannelData(0).set(data)
      bytes += data.length * 4
      return b
    } catch {
      return null
    }
  }
  const getAnchor = (kind: PluckKind, anchor: number) => {
    const key = kind + anchor
    let v = plucks.get(key)
    if (!v) {
      const t0 = now()
      const { data, hz } = renderPluck(PLUCK_SR, 110 * Math.pow(2, anchor / 12), PLUCKS[kind], anchor + 40)
      const buf = makeBuf(data, PLUCK_SR)
      ms += now() - t0
      if (!buf) return null
      v = { buf, hz }
      plucks.set(key, v)
    }
    return v
  }
  const bank: VoiceBank = {
    pluck(kind, semi) {
      const { anchor } = anchorFor(semi)
      const v = getAnchor(kind, anchor)
      if (!v) return null
      return { buf: v.buf, rate: (110 * Math.pow(2, semi / 12)) / v.hz }
    },
    drum(kind) {
      let b = drums.get(kind)
      if (!b) {
        const t0 = now()
        b = makeBuf(renderDrum(ctx.sampleRate, kind), ctx.sampleRate) ?? undefined
        ms += now() - t0
        if (!b) return null
        drums.set(kind, b)
      }
      return b
    },
    stats: () => ({ ms, buffers: plucks.size + drums.size, bytes }),
  }
  banks.set(ctx, bank)
  return bank
}
