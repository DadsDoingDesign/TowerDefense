/**
 * Audio engine — two channels (UI + Game) under a master gain.
 *
 * UI events play real CC0 samples (Kenney "Interface Sounds", public/assets/
 * audio/ui/*.wav). Game/combat events are synthesised procedurally with the Web
 * Audio API (short retro SFX) so there is no dependency on large sample packs
 * and every action can have a sound. Volumes come from the settings store via
 * setAudioVolumes(); the engine imports nothing app-side, so it stays headless-
 * safe (the balance harness never touches it).
 */
type Channel = 'ui' | 'game'
type UiEvent = 'click' | 'select' | 'confirm' | 'back' | 'open' | 'close' | 'toggle' | 'error' | 'equip' | 'reward'
type GameEvent = 'shoot' | 'hit' | 'death' | 'leak' | 'coin' | 'wave' | 'victory' | 'defeat' | 'upgrade'
export type SoundEvent = UiEvent | GameEvent

const UI_SAMPLES: Record<UiEvent, string> = {
  click: 'click',
  select: 'select',
  confirm: 'confirm',
  back: 'back',
  open: 'open',
  close: 'close',
  toggle: 'toggle',
  error: 'error',
  equip: 'equip',
  reward: 'reward',
}
const BASE = '/assets/audio/ui/'
const isUiEvent = (e: SoundEvent): e is UiEvent => e in UI_SAMPLES

let ctx: AudioContext | null = null
let masterGain: GainNode
let gameGain: GainNode
let uiGain: GainNode
let vol = { master: 0.8, game: 0.7, ui: 0.9, muted: false }
const buffers = new Map<string, AudioBuffer>()
const lastPlayed = new Map<string, number>()

export function setAudioVolumes(v: { master: number; game: number; ui: number; muted: boolean }): void {
  vol = { ...v }
  applyGains()
}

function applyGains(): void {
  if (!ctx) return
  masterGain.gain.value = vol.muted ? 0 : vol.master
  gameGain.gain.value = vol.game
  uiGain.gain.value = vol.ui
}

function ensureCtx(): AudioContext | null {
  if (ctx) return ctx
  try {
    const AC: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    masterGain = ctx.createGain()
    masterGain.connect(ctx.destination)
    gameGain = ctx.createGain()
    gameGain.connect(masterGain)
    uiGain = ctx.createGain()
    uiGain.connect(masterGain)
    applyGains()
    for (const name of Object.values(UI_SAMPLES)) void loadSample(name)
  } catch {
    ctx = null
  }
  return ctx
}

async function loadSample(name: string): Promise<void> {
  if (!ctx || buffers.has(name)) return
  try {
    const res = await fetch(BASE + name + '.wav')
    const arr = await res.arrayBuffer()
    buffers.set(name, await ctx.decodeAudioData(arr))
  } catch {
    /* sample missing — silently skip */
  }
}

function playBuffer(name: string, channel: Channel, gain = 1): void {
  if (!ctx) return
  const buf = buffers.get(name)
  if (!buf) {
    void loadSample(name) // warm the cache for next time
    return
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  const g = ctx.createGain()
  g.gain.value = gain
  src.connect(g)
  g.connect(channel === 'ui' ? uiGain : gameGain)
  src.start()
}

// ---- tiny procedural synth for game/combat SFX ----
interface ToneOpts {
  slideTo?: number
  gain?: number
  delay?: number
  type?: OscillatorType
}
function tone(freq: number, dur: number, opts: ToneOpts = {}): void {
  if (!ctx) return
  const t0 = ctx.currentTime + (opts.delay ?? 0)
  const osc = ctx.createOscillator()
  osc.type = opts.type ?? 'square'
  osc.frequency.setValueAtTime(freq, t0)
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + dur)
  const g = ctx.createGain()
  const peak = opts.gain ?? 0.4
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g)
  g.connect(gameGain)
  osc.start(t0)
  osc.stop(t0 + dur + 0.03)
}
function noise(dur: number, opts: { gain?: number; lowpass?: number; delay?: number } = {}): void {
  if (!ctx) return
  const t0 = ctx.currentTime + (opts.delay ?? 0)
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur))
  const buf = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  const g = ctx.createGain()
  g.gain.setValueAtTime(opts.gain ?? 0.35, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  let node: AudioNode = src
  if (opts.lowpass) {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = opts.lowpass
    src.connect(f)
    node = f
  }
  node.connect(g)
  g.connect(gameGain)
  src.start(t0)
  src.stop(t0 + dur + 0.03)
}

function playGame(event: GameEvent): void {
  switch (event) {
    case 'shoot':
      tone(720, 0.09, { slideTo: 180, gain: 0.16, type: 'square' })
      break
    case 'hit':
      noise(0.06, { gain: 0.22, lowpass: 2400 })
      tone(220, 0.05, { gain: 0.1, type: 'square' })
      break
    case 'death':
      noise(0.22, { gain: 0.28, lowpass: 1500 })
      tone(160, 0.2, { slideTo: 55, gain: 0.14, type: 'sawtooth' })
      break
    case 'leak':
      tone(130, 0.3, { slideTo: 55, gain: 0.3, type: 'sawtooth' })
      noise(0.16, { gain: 0.14, lowpass: 800 })
      break
    case 'coin':
      tone(880, 0.06, { gain: 0.2, type: 'square' })
      tone(1320, 0.13, { gain: 0.2, type: 'square', delay: 0.06 })
      break
    case 'wave':
      tone(330, 0.42, { slideTo: 660, gain: 0.2, type: 'sawtooth' })
      break
    case 'victory':
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, { gain: 0.24, type: 'square', delay: i * 0.13 }))
      break
    case 'defeat':
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.2, { gain: 0.24, type: 'sawtooth', delay: i * 0.16 }))
      break
    case 'upgrade':
      [660, 880, 1320].forEach((f, i) => tone(f, 0.12, { gain: 0.2, type: 'square', delay: i * 0.07 }))
      break
  }
}

/** Play a sound event. `throttleMs` drops repeats of the same event fired too close together (combat spam). */
export function sfx(event: SoundEvent, opts: { throttleMs?: number } = {}): void {
  const c = ensureCtx()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  if (vol.muted) return
  if (opts.throttleMs) {
    const now = c.currentTime * 1000
    const last = lastPlayed.get(event) ?? -1e9
    if (now - last < opts.throttleMs) return
    lastPlayed.set(event, now)
  }
  if (isUiEvent(event)) playBuffer(UI_SAMPLES[event], 'ui')
  else playGame(event)
}

/** Engine → audio dispatcher for per-frame combat events (throttled to avoid spam). */
export function gameSfx(event: string): void {
  switch (event) {
    case 'shoot':
      sfx('shoot', { throttleMs: 90 })
      break
    case 'hit':
      sfx('hit', { throttleMs: 55 })
      break
    case 'kill':
      sfx('death', { throttleMs: 60 })
      break
    case 'leak':
      sfx('leak', { throttleMs: 120 })
      break
    case 'coin':
      sfx('coin', { throttleMs: 130 })
      break
  }
}
