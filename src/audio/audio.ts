/**
 * Audio engine — three channels (UI, Game, Music) under a master gain, into a
 * glue compressor and a limiter. Every level, trim and chain setting is data
 * in `mix.ts`; this file is the plumbing.
 *
 * UI events play real CC0 samples (Kenney "Interface Sounds", public/assets/
 * audio/ui/*.wav — licence and provenance in docs/AUDIO_CREDITS.md). Game and
 * ceremony events are synthesised here with the Web Audio API, so there is no
 * dependency on a sample pack and every action can have a sound; each one is
 * layered (transient + body + tail) and fed a little generated reverb, because
 * a single oscillator per event is a beep and the game needs impacts.
 *
 * The MUSIC bus is wired here and performed by `music.ts`, which connects only
 * to the nodes `musicBus()` hands it — so the score answers the same master
 * fader and the same mute as everything else, and nothing but this file ever
 * touches `destination`.
 *
 * Volumes come from the settings store via `setAudioVolumes()`; this module
 * imports nothing app-side, so it stays headless-safe (the balance harness
 * never touches it, and the sim can never reach it — the engine emits event
 * strings and a listener plays them).
 *
 * ---- HEADLESS SAFETY IS A LOAD-BEARING PROPERTY OF THIS FILE (F11) ---------
 *
 * "The balance harness never touches it" is not true and has not been for a
 * while: `balance/report.ts` → `src/state/gameStore.ts` → here. The harness
 * never CALLS anything in this module, but node evaluates it, and `npm run
 * balance` runs under plain Node with no `window`, no `document` and no
 * `AudioContext`.
 *
 * It survives that for one reason, and it is worth stating rather than
 * re-discovering: **this module has zero module-level side effects.** Every
 * browser API it touches — `new AudioContext()`, `document.baseURI`,
 * `fetch`, `window.addEventListener` — is reached only from inside a function,
 * and the entry point to all of them (`ensureCtx`) both guards for a DOM and
 * sits in a try/catch that returns null.
 *
 * So: no top-level `new AudioContext()`, no top-level `fetch`, no top-level
 * listener registration, no top-level `document` read. One line of any of those
 * breaks `npm run balance` — the whole balance suite, not one bench — with a
 * ReferenceError in a file the suite does not knowingly use. If a future change
 * needs eager setup, it belongs behind an explicit `initAudio()` the app calls,
 * not at module scope.
 */
import {
  busGains,
  CALM,
  dbToGain,
  DUCK,
  GAIN_SMOOTH_S,
  hasRaritySting,
  IDLE_SUSPEND_S,
  LOW_GATE,
  MASTER_CHAIN,
  panFor,
  RARITIES,
  REVERB_TAIL_S,
  shouldSuspend,
  throttleAllows,
  UI_TRIM_DB,
  type UiSample,
} from './mix'
import { voiceBank, type DrumKind, type PluckKind } from './instruments'
import { stingDegrees } from './theme'

type Channel = 'ui' | 'game'
/*
 * `open` and `select` used to be here too. Nothing ever played `open`, and
 * `select` only previewed the legacy Interface slider — yet both were fetched
 * at boot and precached on install. They are gone from code and from public/.
 */
type UiEvent = UiSample
/**
 * Combat/ceremony events. `crit`, `down`, `clear` and `evolve` are Phase-3
 * additions: a crit that sounds identical to a normal hit wastes the channel,
 * a Sentinel going down was silent, and the two emotional peaks of the loop
 * (clearing a wave, evolving a hero) had no sound of their own.
 */
type GameEvent =
  | 'shoot'
  | 'hit'
  | 'crit'
  | 'death'
  | 'down'
  | 'leak'
  | 'coin'
  | 'wave'
  | 'clear'
  | 'victory'
  | 'defeat'
  | 'upgrade'
  | 'evolve'
  | 'deploy'
  | 'undeploy'
  | 'levelup'
  | 'boss'
  | 'melee'
export type SoundEvent = UiEvent | GameEvent

/**
 * What the engine says about a combat event, beyond its name (Phase 2). All
 * optional: an event without a payload plays the generic sound it always did.
 * `x` is the field position, −1 (left edge) … 1 (right edge), for panning.
 */
export interface SfxPayload {
  arch?: string
  x?: number
  faction?: string
  tier?: number
  boss?: boolean
}

/**
 * Every UI event, the file it plays and the trim it plays at. The trims are
 * the whole fix for the samples being peak- rather than loudness-normalised —
 * see `UI_TRIM_DB` in mix.ts for the measurements.
 */
const UI_SAMPLES: Record<UiEvent, { file: string; gain: number }> = {
  click: { file: 'click', gain: dbToGain(UI_TRIM_DB.click) },
  confirm: { file: 'confirm', gain: dbToGain(UI_TRIM_DB.confirm) },
  back: { file: 'back', gain: dbToGain(UI_TRIM_DB.back) },
  close: { file: 'close', gain: dbToGain(UI_TRIM_DB.close) },
  toggle: { file: 'toggle', gain: dbToGain(UI_TRIM_DB.toggle) },
  error: { file: 'error', gain: dbToGain(UI_TRIM_DB.error) },
  equip: { file: 'equip', gain: dbToGain(UI_TRIM_DB.equip) },
  reward: { file: 'reward', gain: dbToGain(UI_TRIM_DB.reward) },
}
const SAMPLE_FILES = Object.values(UI_SAMPLES).map((s) => s.file)
/**
 * Where a UI sample lives, resolved against the deploy's base.
 *
 * This used to be the absolute `'/assets/audio/ui/'`, which only works when
 * the app owns the origin root. Vite is configured with `base: './'` precisely
 * because it does not have to — itch.io, GitHub Pages project sites and any
 * `/game/` subpath all serve it from a subdirectory — and there every sample
 * 404'd, which the negative cache below then remembered for the session.
 *
 * Relative, and resolved against `document.baseURI` the way pwa.ts resolves
 * `sw.js` — the same base the rest of the app's plain relative asset URLs
 * (sprites, the icons, the web manifest) already resolve against.
 *
 * That is the answer written out rather than a different answer: `fetch()`
 * would apply the document base to a bare relative URL by itself, and under
 * `base: './'` `import.meta.env.BASE_URL` is that same `'./'`. What writing it
 * out buys is the `catch` — somewhere with no `document` at all still gets a
 * usable URL instead of a thrown TypeError.
 */
const SAMPLE_DIR = 'assets/audio/ui/'
const sampleUrl = (name: string): string => {
  const rel = SAMPLE_DIR + name + '.wav'
  try {
    return new URL(rel, document.baseURI).href
  } catch {
    return rel // no document (tests, a worker) — a relative URL is still correct
  }
}
const isUiEvent = (e: SoundEvent): e is UiEvent => e in UI_SAMPLES

let ctx: AudioContext | null = null
let masterGain: GainNode
let gameGain: GainNode
let uiGain: GainNode
/**
 * The music bus. A third sibling of the two that already existed rather than a
 * second graph: music has to answer the same master fader and the same mute as
 * everything else, and `src/audio/music.ts` never touches `destination` itself.
 */
let musicGain: GainNode
/**
 * After the music fader: the low-Gate lowpass, then the duck. The duck is its
 * own node so ducking can never touch — or be undone by — the player's volume.
 */
let musicFilter: BiquadFilterNode
let musicDuck: GainNode
let glueNode: DynamicsCompressorNode
let limiterNode: DynamicsCompressorNode
/** Accessibility options (settings: "Calm audio", "Mono"). */
let opts = { calm: false, mono: false }
let lowGate = false
/** Per-channel reverb sends — see `buildSpace()`. */
let gameSend: GainNode
let musicSend: GainNode
let vol = { master: 0.8, game: 0.7, ui: 0.9, music: 0.55, muted: false }
const buffers = new Map<string, AudioBuffer>()
/** In-flight decodes, so the first press can await the sample it needs (M31). */
const loading = new Map<string, Promise<void>>()
/** Raw bytes fetched before any AudioContext exists; released once decoded. */
const rawSamples = new Map<string, ArrayBuffer>()
/**
 * In-flight NETWORK fetches, keyed by sample.
 *
 * The boot preload and a click that lands while it is still running both want
 * the same bytes; without this the click opened a SECOND request for a file
 * already on the wire.
 */
const fetching = new Map<string, Promise<ArrayBuffer | null>>()
/**
 * Samples that are PERMANENTLY unavailable — a 404, a 410, bytes that will not
 * decode. Nothing here was ever recorded, so every press retried the same
 * missing file: twelve clicks across the UI cost twenty-one fetch and
 * decodeAudioData round trips, none of which could ever succeed, and it never
 * stopped. A missing file is a fact about the build, so remember it for good.
 */
const unavailable = new Set<string>()
/**
 * Samples that failed for a reason that might not still be true.
 *
 * The negative cache above used to swallow these too, and `preloadAudioSamples()`
 * runs at BOOT: one dead moment on a train — a 503 from the CDN, a dropped
 * connection, a captive portal not yet signed into — marked all ten UI sounds
 * unavailable for the entire session, and the game stayed silent long after
 * the connection came back, with nothing short of a reload to fix it. A
 * transient failure is a fact about the NETWORK, so it expires: the value is
 * the earliest time this sample is worth asking for again.
 */
const retryAfter = new Map<string, number>()
/** Consecutive transient failures per sample, for the backoff below. */
const failures = new Map<string, number>()
/** 1s, 2s, 4s … capped, so a long outage costs one request every half minute. */
const backoffMs = (n: number): number => Math.min(30_000, 1000 * 2 ** (n - 1))
/**
 * Floor on how often an `online` event may pull the failed set forward.
 *
 * Deliberately the same 30s the backoff tops out at, so the reconnect shortcut
 * can never ask for a sample more often than `backoffMs()`'s own ceiling
 * already promises — which is the only way that promise holds at all.
 */
const RECONNECT_MIN_MS = 30_000
const lastPlayed = new Map<string, number>()

export function setAudioVolumes(v: {
  master: number
  game: number
  ui: number
  music?: number
  muted: boolean
}): void {
  // `music` is optional so a payload written before it existed (or any caller
  // that predates it) keeps whatever the current value is instead of setting a
  // gain to `undefined`, which is NaN and silences the bus permanently.
  const wasMuted = vol.muted
  vol = { master: v.master, game: v.game, ui: v.ui, music: v.music ?? vol.music, muted: v.muted }
  applyGains()
  // Un-muting is a tap on the mute control — a gesture — so this is the one
  // moment a context we suspended for the mute can always be woken.
  if (wasMuted && !vol.muted && ctx && asleep(ctx)) void resumeCtx(ctx)
  for (const cb of readyCbs) safely(cb)
  // Muting starts the fade; the suspend follows once it has finished.
  scheduleIdleCheck(vol.muted ? GAIN_SMOOTH_S * 8 : undefined)
}

// ---- power: suspend the context when nothing can be heard ------------------
//
// A running AudioContext costs battery even when silent: the two convolvers
// and both compressors process zeros on the audio thread forever. The policy
// is `shouldSuspend` (mix.ts, unit-tested); this is the plumbing.

/** The tab is hidden (set via the music engine's lifecycle hooks). */
let hidden = false
/** The score is performing (set by `music.ts`). */
let musicActive = false
/** Audio-clock time the last scheduled voice ends. */
let busyUntil = 0
/**
 * WE suspended the context, on purpose. The state-change handler must tell
 * that apart from iOS taking the audio session away, which it must undo.
 */
let intendedSuspend = false
let idleTimer: ReturnType<typeof setTimeout> | null = null

/** A voice was scheduled to ring until `end` (audio clock). */
function markBusy(end: number): void {
  if (end > busyUntil) busyUntil = end
  // Lazy: one pending timer at a time. When it fires it re-reads `busyUntil`
  // and re-arms itself if the mix got busier meanwhile, so a dense wave costs
  // one timer, not one per voice.
  if (idleTimer === null) scheduleIdleCheck()
}

function scheduleIdleCheck(inSeconds?: number): void {
  if (!ctx || typeof setTimeout !== 'function') return
  if (idleTimer !== null) {
    if (inSeconds === undefined) return
    clearTimeout(idleTimer)
  }
  if (inSeconds === undefined) {
    if (musicActive && !vol.muted) {
      idleTimer = null
      return
    }
    // The earliest the policy could flip: tail over while hidden, or the idle
    // window over while visible. Re-evaluated when it fires.
    inSeconds = Math.max(0.25, busyUntil - ctx.currentTime + (hidden ? REVERB_TAIL_S : IDLE_SUSPEND_S))
  }
  idleTimer = setTimeout(checkSuspend, inSeconds * 1000)
}

function checkSuspend(): void {
  idleTimer = null
  const c = ctx
  if (!c) return
  const want = shouldSuspend({ muted: vol.muted, hidden, musicPlaying: musicActive, now: c.currentTime, busyUntil })
  if (want) {
    if ((c.state as string) === 'running') {
      intendedSuspend = true
      disarmUnlock()
      try {
        void c.suspend().catch(() => {
          intendedSuspend = false
        })
      } catch {
        intendedSuspend = false
      }
    }
    return
  }
  scheduleIdleCheck()
}

/** Called by the music engine when its transport starts or stops. */
export function setMusicActive(on: boolean): void {
  if (musicActive === on) return
  musicActive = on
  // A stopping track still has its fade and a reverb tail to ring out.
  if (!on && ctx) markBusy(ctx.currentTime + 0.5)
}

/** Called by the music engine from the app's one visibility lifecycle. */
export function setAudioHidden(h: boolean): void {
  hidden = h
  if (h) scheduleIdleCheck(0.5)
}

/**
 * Wake a context we (or the OS) put to sleep, when something wants to be
 * heard — the music engine calls this when a cue is wanted but the bus is not
 * running. Never creates a context and never overrides a mute. Without a
 * gesture behind it this can fail (iOS); the armed unlock listeners then
 * retry on the next touch.
 */
export function wakeAudio(): void {
  if (ctx && !vol.muted && asleep(ctx)) void resumeCtx(ctx)
}

// ---- unlock: stay armed until the context is actually running --------------

const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'mousedown', 'touchend', 'keydown', 'click'] as const
let unlockArmed = false

function onUnlockGesture(): void {
  if (!ctx) return
  if ((ctx.state as string) === 'running') {
    disarmUnlock()
    return
  }
  if (!vol.muted) void resumeCtx(ctx)
}

/**
 * The first-touch unlock in App.tsx is `once`, and a first touch does not
 * always grant activation (a scroll, a touchstart on some iOS versions, a
 * resume the OS refused). These listeners stay on the document until the
 * context really reports 'running' — every gesture until then tries again.
 */
function armUnlock(): void {
  if (unlockArmed || typeof document === 'undefined' || !document.addEventListener) return
  unlockArmed = true
  for (const e of UNLOCK_EVENTS) document.addEventListener(e, onUnlockGesture, { capture: true, passive: true })
}

function disarmUnlock(): void {
  if (!unlockArmed || typeof document === 'undefined') return
  unlockArmed = false
  for (const e of UNLOCK_EVENTS) document.removeEventListener(e, onUnlockGesture, { capture: true })
}

/**
 * The context changed state behind our back — or in front of it.
 *
 * 'running': unlocked or recovered; stop listening for gestures, tell the
 * music. A suspend WE asked for: nothing to do. Anything else (iOS
 * 'interrupted' after a call, 'suspended' by the OS): re-arm the gesture
 * listeners and, if the tab is visible, try to come back straight away.
 */
function onCtxStateChange(c: AudioContext): void {
  if (c !== ctx) return
  const st = c.state as string
  if (st === 'running') {
    intendedSuspend = false
    disarmUnlock()
    fireReady()
    scheduleIdleCheck()
    return
  }
  if (st === 'closed') {
    // Nothing can reopen a closed context; the next sound builds a new one.
    ctx = null
    disarmUnlock()
    return
  }
  if (intendedSuspend || vol.muted) return
  armUnlock()
  if (!hidden) void resumeCtx(c)
}

/** Is audio muted right now? Read by the music engine, which idles when it is. */
export const audioMuted = (): boolean => vol.muted

/**
 * Push the volumes into the bus nodes. `busGains` adds each bus's fixed makeup
 * (mix.ts) and guards against NaN.
 *
 * Ramped, not set: writing `.value` on a live gain is a step, and a step in a
 * signal is a click — most audibly on mute, which used to cut the whole mix
 * mid-waveform. A 15 ms time constant is inaudible as a fade and kills the
 * click. `immediate` is for the one moment there is nothing to click: the
 * graph being built.
 */
function applyGains(immediate = false): void {
  if (!ctx) return
  const g = busGains(vol, opts.calm)
  const t = ctx.currentTime
  const set = (p: AudioParam, v: number): void => {
    if (immediate) {
      p.value = v
      return
    }
    // Hold wherever an in-flight ramp has got to, then glide from there.
    const hold = (p as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam }).cancelAndHoldAtTime
    if (hold) hold.call(p, t)
    else {
      p.cancelScheduledValues(t)
      p.setValueAtTime(p.value, t)
    }
    p.setTargetAtTime(v, t, GAIN_SMOOTH_S)
  }
  set(masterGain.gain, g.master)
  set(gameGain.gain, g.game)
  set(uiGain.gain, g.ui)
  set(musicGain.gain, g.music)
}

/** The music bus's own volume, so the music engine can scale within it. */
export const musicVolume = (): number => vol.music

/**
 * A short algorithmic impulse response — exponentially decaying noise, darkened
 * over time — so combat and music sit in a space instead of being dry blips.
 *
 * Generated rather than fetched: it costs no payload, no licence and no request,
 * and a convolution reverb is the cheapest way to make a handful of oscillators
 * read as "a sound" rather than "a beep" (the Sakurai rule — instant peak, short
 * tail, so overlapping hits stay legible).
 */
function makeImpulse(c: AudioContext, seconds: number, decay: number, tone: number): AudioBuffer {
  const n = Math.max(1, Math.floor(c.sampleRate * seconds))
  const buf = c.createBuffer(2, n, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < n; i++) {
      const t = i / n
      const white = Math.random() * 2 - 1
      // One-pole lowpass that closes as the tail decays: bright early
      // reflections, dark tail. `tone` is the starting coefficient.
      lp += (white - lp) * (tone * (1 - t) + 0.06)
      d[i] = lp * Math.pow(1 - t, decay)
    }
  }
  return buf
}

/**
 * Wire one channel's reverb: voices connect a per-voice send gain to `send`,
 * and the wet signal returns INTO that channel's gain node — so reverb obeys
 * the same channel fader and the same mute the dry signal does. (Returning it
 * to the master instead is how a muted channel keeps ringing.)
 */
function buildSpace(c: AudioContext, into: GainNode, seconds: number, decay: number, tone: number, wet: number): GainNode {
  const send = c.createGain()
  send.gain.value = 1
  const conv = c.createConvolver()
  conv.buffer = makeImpulse(c, seconds, decay, tone)
  const wetGain = c.createGain()
  wetGain.gain.value = wet
  send.connect(conv)
  conv.connect(wetGain)
  wetGain.connect(into)
  return send
}

/**
 * The single door to the Web Audio API in this file (F11).
 *
 * The `typeof window` guard is not belt-and-braces over the try/catch: it is
 * the explicit statement that this module is evaluated in headless Node on
 * every `npm run balance`, and that "no audio here" is a supported answer
 * rather than an exception that happens to be swallowed. See the file header.
 */
function ensureCtx(): AudioContext | null {
  if (ctx) return ctx
  if (typeof window === 'undefined') return null
  try {
    const AC: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    /*
     * The master chain: glue compressor → limiter → output trim.
     *
     * A dense wave fires shoot + hit + crit + death within a few milliseconds of
     * each other, and with the mix now at a phone-game loudness (≈ −18 LUFS in
     * battle, see BUS_MAKEUP_DB) those sums would clip — heard on a phone
     * speaker as the whole mix going thin and papery exactly when the most is
     * happening. The old single soft-knee compressor was not a limiter; this
     * is. Settings and reasoning in `MASTER_CHAIN` (mix.ts).
     */
    const comp = (o: { threshold: number; knee: number; ratio: number; attack: number; release: number }) => {
      const k = ctx!.createDynamicsCompressor()
      k.threshold.value = o.threshold
      k.knee.value = o.knee
      k.ratio.value = o.ratio
      k.attack.value = o.attack
      k.release.value = o.release
      return k
    }
    const glue = comp(opts.calm ? CALM.glue : MASTER_CHAIN.glue)
    const limiter = comp(opts.calm ? CALM.limiter : MASTER_CHAIN.limiter)
    glueNode = glue
    limiterNode = limiter
    const outTrim = ctx.createGain()
    outTrim.gain.value = dbToGain(MASTER_CHAIN.outTrimDb)
    glue.connect(limiter)
    limiter.connect(outTrim)
    outTrim.connect(ctx.destination)
    masterGain = ctx.createGain()
    masterGain.connect(glue)
    applyMono()
    gameGain = ctx.createGain()
    gameGain.connect(masterGain)
    uiGain = ctx.createGain()
    uiGain.connect(masterGain)
    musicGain = ctx.createGain()
    musicFilter = ctx.createBiquadFilter()
    musicFilter.type = 'lowpass'
    musicFilter.Q.value = 0.8
    musicFilter.frequency.value = lowGate ? LOW_GATE.lowpassHz : LOW_GATE.openHz
    musicDuck = ctx.createGain()
    musicGain.connect(musicFilter)
    musicFilter.connect(musicDuck)
    musicDuck.connect(masterGain)
    // Combat: short and bright, so it adds body without smearing the next hit.
    gameSend = buildSpace(ctx, gameGain, 0.7, 2.6, 0.5, 0.5)
    // Music: longer and darker, so pads bloom.
    musicSend = buildSpace(ctx, musicGain, 1.8, 2.2, 0.22, 0.6)
    applyGains(true)
    const made = ctx
    made.onstatechange = () => onCtxStateChange(made)
    hidden = typeof document !== 'undefined' && !!document.hidden
    if (needsResume(made)) armUnlock()
    for (const name of SAMPLE_FILES) void loadSample(name)
  } catch {
    ctx = null
  }
  return ctx
}

/**
 * What `src/audio/music.ts` needs and nothing more: the live context and the
 * two nodes it is allowed to connect to. Returns null when audio never
 * initialised or is still locked — deliberately does NOT create a context, for
 * the same reason `resumeAudio()` does not (with no gesture behind it that
 * would only produce a suspended one).
 */
export function musicBus(): { ctx: AudioContext; out: GainNode; send: GainNode; sfx: GainNode } | null {
  if (!ctx || (ctx.state as string) !== 'running') return null
  return { ctx, out: musicGain, send: musicSend, sfx: gameGain }
}

// ---- the music clock, ducking, low Gate, accessibility (Phase 2) ------------

/** What the score tells the SFX about where it is: tempo, next beat, key. */
export interface MusicClock {
  cue: string
  bpm: number
  /** Seconds per beat. */
  beat: number
  /** Tonic, semitones from A (folded to −5…+6). */
  key: number
  mode: string
  /** The first beat (or 8th, for slow cues) at or after audio time `after`. */
  nextBeat(after: number): number
}
let clockSource: (() => MusicClock | null) | null = null
/** `music.ts` hands its transport over here, so this file never imports it. */
export function registerMusicClock(fn: () => MusicClock | null): void {
  clockSource = fn
}
/** The live music clock, or null when no score is playing. */
export const musicClock = (): MusicClock | null => (clockSource ? clockSource() : null)

/** Longest a sting may be held to reach its beat. */
const STING_MAX_WAIT = 0.7

/**
 * When a sting should start (seconds from now) and in which key: on the next
 * beat of the score, in the score's key — or at once, in A, with no score.
 */
export function stingTiming(): { delay: number; key: number; clocked: boolean } {
  const c = musicClock()
  if (!c || !ctx) return { delay: 0, key: 0, clocked: false }
  const now = ctx.currentTime
  const at = c.nextBeat(now + 0.03)
  const delay = at - now
  return { delay: delay >= 0 && delay <= STING_MAX_WAIT ? delay : 0, key: c.key, clocked: true }
}

/**
 * Duck the music bus by `db` from `at` seconds from now, for `hold` seconds.
 * Fast attack, slow release, on the duck node only.
 */
export function duckMusic(db: number, hold: number, at = 0): void {
  if (!ctx || !musicDuck) return
  const p = musicDuck.gain
  const t = ctx.currentTime + Math.max(0, at)
  const h = (p as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam }).cancelAndHoldAtTime
  if (h) h.call(p, t)
  else p.cancelScheduledValues(t)
  p.setTargetAtTime(dbToGain(-Math.abs(db)), t, DUCK.attackTau)
  p.setTargetAtTime(1, t + Math.max(0.05, hold), DUCK.releaseTau)
}

/**
 * Low Gate (≤30 % Gate HP): the score closes in behind a 900 Hz lowpass, the
 * heartbeat starts (music.ts), and a leak tolls instead of clanging.
 */
export function setLowGate(on: boolean): void {
  if (lowGate === on) return
  lowGate = on
  if (!ctx || !musicFilter) return
  const f = musicFilter.frequency
  f.cancelScheduledValues(ctx.currentTime)
  f.setValueAtTime(f.value, ctx.currentTime)
  f.setTargetAtTime(on ? LOW_GATE.lowpassHz : LOW_GATE.openHz, ctx.currentTime, on ? 0.35 : 0.8)
}
export const lowGateActive = (): boolean => lowGate
export const isCalmAudio = (): boolean => opts.calm

/** Calm audio / mono, from the settings store. */
export function setAudioOptions(o: { calm?: boolean; mono?: boolean }): void {
  opts = { calm: o.calm ?? opts.calm, mono: o.mono ?? opts.mono }
  if (!ctx) return
  const set = (k: DynamicsCompressorNode, c: { threshold: number; knee: number; ratio: number; attack: number; release: number }) => {
    k.threshold.value = c.threshold
    k.knee.value = c.knee
    k.ratio.value = c.ratio
    k.attack.value = c.attack
    k.release.value = c.release
  }
  if (glueNode) set(glueNode, opts.calm ? CALM.glue : MASTER_CHAIN.glue)
  if (limiterNode) set(limiterNode, opts.calm ? CALM.limiter : MASTER_CHAIN.limiter)
  applyMono()
  applyGains()
}

/**
 * Mono: fold the whole mix to one channel at the master (one ear, one
 * speaker, a hearing difference) — the next node up-mixes it back to both.
 */
function applyMono(): void {
  if (!masterGain) return
  masterGain.channelCount = opts.mono ? 1 : 2
  masterGain.channelCountMode = 'explicit'
  masterGain.channelInterpretation = 'speakers'
}

const readyCbs = new Set<() => void>()
function safely(cb: () => void): void {
  try {
    cb()
  } catch {
    /* one listener must not break the unlock path */
  }
}

/**
 * Run `cb` whenever the context is running (an unlock, an iOS interruption
 * ending, or a volume change). Fires immediately if audio is already up, so a
 * late subscriber is never left waiting for an event that already happened.
 */
export function onAudioReady(cb: () => void): () => void {
  readyCbs.add(cb)
  if (ctx && (ctx.state as string) === 'running') safely(cb)
  return () => readyCbs.delete(cb)
}

function fireReady(): void {
  for (const cb of readyCbs) safely(cb)
}

/**
 * Fetch every UI sample's bytes before any AudioContext exists.
 *
 * Decoding needs a context, and the context can only be created on a user
 * gesture — but the network fetch does not. Doing it at boot means the very
 * first tap has the bytes in hand and only has to decode, which is what makes
 * that first sound audible instead of silently warming a cache (M31).
 */
export function preloadAudioSamples(): void {
  if (typeof fetch !== 'function') return
  listenForReconnect()
  for (const name of SAMPLE_FILES) void fetchSample(name)
}

let reconnectBound = false
/** When a reconnect sweep last actually issued fetches. 0 = never, so the first is free. */
let lastReconnect = 0
/** An `online` that arrived while the tab was hidden, waiting to be acted on. */
let reconnectPending = false

/**
 * Come back from an outage without waiting for the backoff to expire.
 *
 * The backoff alone already guarantees eventual recovery; this just makes it
 * immediate in the case players actually notice — the connection returning
 * while the game is open. Only samples that failed transiently are retried,
 * and only ones nothing else has since loaded.
 *
 * `online` is not the rare, once-per-outage event it looks like. Flapping
 * wifi, a wifi↔cellular handoff, a VPN reconnecting and a train going through
 * tunnels all fire it in bursts, and each burst used to re-fetch all ten
 * samples AND `failures.delete()` them, rewinding the exponent to zero so the
 * next burst was just as expensive: twenty events over half a second cost 210
 * requests — 21 per sample in 1.3s, against a documented budget of one per
 * thirty seconds. Two things keep that honest now.
 *
 * One: the sweep clears the WAIT, not the COUNT. Bringing the next attempt
 * forward is the whole point; pretending the sample never failed is not, and
 * the count is already cleared where it means something — a fetch that
 * actually succeeds (see `fetchSample`).
 *
 * Two: `RECONNECT_MIN_MS` between sweeps that do any work, so the shortcut is
 * worth at most one extra round of requests per half minute however hard the
 * network flaps. An event that finds nothing to retry costs nothing and does
 * not start that clock, so a genuine recovery is never rate-limited out by a
 * burst of no-op events that preceded it.
 */
function retryFailedSamples(): void {
  const now = Date.now()
  if (now - lastReconnect < RECONNECT_MIN_MS) return
  let issued = 0
  for (const name of retryAfter.keys()) {
    if (buffers.has(name) || rawSamples.has(name)) continue
    retryAfter.delete(name)
    issued++
    void fetchSample(name)
  }
  if (issued) lastReconnect = now
}

function listenForReconnect(): void {
  if (reconnectBound || typeof window === 'undefined' || !window.addEventListener) return
  reconnectBound = true
  window.addEventListener('online', () => {
    // A backgrounded tab has nobody to play a sound to, so it should not be
    // spending a player's radio and data on one. Remember that the network
    // came back and act on it when the tab is looked at again.
    if (typeof document !== 'undefined' && document.hidden) {
      reconnectPending = true
      return
    }
    retryFailedSamples()
  })
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden || !reconnectPending) return
      reconnectPending = false
      retryFailedSamples()
    })
  }
}

/**
 * Is this status the file's fault or the network's?
 *
 * 404/410 and the rest of the 4xx range say the server understood the request
 * and this sample is not there — no amount of retrying changes that, and the
 * build would have to change for it to. 5xx, 408 and 429 say "not now": a
 * flaky edge, a rate limit, a gateway restarting. So do a network error, which
 * arrives here as a rejected fetch and never reaches this function at all.
 */
const isPermanent = (status: number): boolean =>
  status >= 400 && status < 500 && status !== 408 && status !== 429

/**
 * The one place a sample's bytes are fetched. Every caller — the boot preload
 * and any press that races it — shares the same request; a file that is
 * genuinely missing is remembered for good, and one that merely failed is
 * held off for a backoff rather than abandoned for the session.
 */
function fetchSample(name: string): Promise<ArrayBuffer | null> {
  if (unavailable.has(name)) return Promise.resolve(null)
  const have = rawSamples.get(name)
  if (have) return Promise.resolve(have)
  const inflight = fetching.get(name)
  if (inflight) return inflight
  const until = retryAfter.get(name)
  if (until !== undefined && Date.now() < until) return Promise.resolve(null)

  const p = fetch(sampleUrl(name))
    .then((r) => {
      // A 404 resolves rather than rejects, and its HTML body decodes into
      // nothing — so treat a bad status as the failure it is, here.
      if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status })
      return r.arrayBuffer()
    })
    .then((buf) => {
      rawSamples.set(name, buf)
      retryAfter.delete(name)
      failures.delete(name)
      return buf
    })
    .catch((err: { status?: number }) => {
      // No status means the request never completed: DNS, offline, a reset
      // socket. That is the most transient failure there is.
      if (typeof err?.status === 'number' && isPermanent(err.status)) {
        unavailable.add(name)
      } else {
        const n = (failures.get(name) ?? 0) + 1
        failures.set(name, n)
        retryAfter.set(name, Date.now() + backoffMs(n))
      }
      return null // playBuffer degrades to silence for that one event
    })
    .finally(() => {
      fetching.delete(name)
    })
  fetching.set(name, p)
  return p
}

/** Resolve once `name` is decoded and in `buffers` (or known to be unavailable). */
function loadSample(name: string): Promise<void> {
  if (!ctx || buffers.has(name) || unavailable.has(name)) return Promise.resolve()
  const inflight = loading.get(name)
  if (inflight) return inflight
  const c = ctx
  const p = (async () => {
    try {
      const raw = await fetchSample(name)
      if (!raw) return
      // decodeAudioData DETACHES what it is handed, so drop the reference
      // first and let it consume the original. The old code kept every raw wav
      // alive for the process lifetime (236 KB across the ten UI samples) and
      // paid for a full slice(0) copy on each decode to protect bytes nothing
      // reads again — once decoded, the AudioBuffer is what plays.
      rawSamples.delete(name)
      buffers.set(name, await c.decodeAudioData(raw))
    } catch {
      // Bytes that will not decode will not decode next time either.
      unavailable.add(name)
    } finally {
      loading.delete(name)
    }
  })()
  loading.set(name, p)
  return p
}

function emitBuffer(buf: AudioBuffer, channel: Channel, gain: number): void {
  if (!ctx) return
  const src = ctx.createBufferSource()
  src.buffer = buf
  const g = ctx.createGain()
  g.gain.value = gain
  src.connect(g)
  g.connect(channel === 'ui' ? uiGain : gameGain)
  src.start()
  markBusy(ctx.currentTime + buf.duration)
}

/**
 * Play a UI sample. If it isn't decoded yet this AWAITS the decode and then
 * plays it — the old code returned early to "warm the cache for next time",
 * which made the first press of every distinct UI sound silent (M31).
 */
function playBuffer(name: string, channel: Channel, gain = 1): void {
  if (!ctx) return
  const buf = buffers.get(name)
  if (buf) {
    emitBuffer(buf, channel, gain)
    return
  }
  void loadSample(name).then(() => {
    const ready = buffers.get(name)
    if (ready && !vol.muted) emitBuffer(ready, channel, gain)
  })
}

// ---- procedural synth for game/combat SFX ---------------------------------
//
// Still synthesised rather than sampled — no payload, no licence, and every
// event can have a sound — but no longer one oscillator per event. Each combat
// sound is now LAYERED (transient + body + tail), pitch-varied so a burst of
// them does not read as one stuck sample, and fed a little reverb so it has a
// place to sit. The mix follows Sakurai's "balance SFX by importance": a kill
// and a crit are the loudest things in a wave, a shot is the quietest.

/** One shared noise buffer, filled once. The old code allocated one per hit. */
let noiseBuf: AudioBuffer | null = null
function getNoise(c: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf
  const n = Math.floor(c.sampleRate * 2)
  const buf = c.createBuffer(1, n, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
  noiseBuf = buf
  return buf
}

/**
 * Cheap ceiling on how many voices may START in a short window.
 *
 * The per-event throttles already bound each sound's rate; this bounds their
 * SUM, which is what a 3× wave with four Sentinels firing actually produces.
 * A leaky counter rather than tracking `onended`: no per-voice callback, no
 * garbage, and the only question being asked is "is right now already busy".
 */
let voiceTokens = 0
let voiceStamp = 0
const VOICE_BUDGET = 36 // voices per 100ms window
function takeVoice(now: number): boolean {
  if (now - voiceStamp > 0.1) {
    voiceStamp = now
    voiceTokens = 0
  }
  if (voiceTokens >= VOICE_BUDGET) return false
  voiceTokens++
  return true
}

/** ±`cents` of random detune, so repeats of one event never phase-lock. */
const vary = (hz: number, cents: number): number => hz * Math.pow(2, ((Math.random() * 2 - 1) * cents) / 1200)

interface VoiceOpts {
  /** Glide the pitch to this frequency across the note. */
  to?: number
  type?: OscillatorType
  /** Seconds from now. */
  at?: number
  /** Attack in seconds (default 4ms — an instant peak, per the doctrine). */
  attack?: number
  /** 0–1 of this voice's level sent to the channel reverb. */
  send?: number
  /** Which bus this voice belongs to. */
  bus?: Channel
  /** Stereo position −1…1 (already scaled). Leave lows at 0. */
  pan?: number
}

/** One enveloped oscillator voice. */
function osc(freq: number, dur: number, peak: number, o: VoiceOpts = {}): void {
  if (!ctx) return
  const t0 = ctx.currentTime + (o.at ?? 0)
  if (!takeVoice(t0)) return
  const n = ctx.createOscillator()
  n.type = o.type ?? 'square'
  n.frequency.setValueAtTime(Math.max(1, freq), t0)
  if (o.to) n.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + dur)
  const g = ctx.createGain()
  const a = o.attack ?? 0.004
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  n.connect(g)
  route(g, o.bus ?? 'game', o.send ?? 0, o.pan)
  n.start(t0)
  n.stop(t0 + dur + 0.03)
  markBusy(t0 + dur)
}

interface NoiseOpts {
  at?: number
  lp?: number
  hp?: number
  /** Band-pass centre, Hz — the phone-presence layers use it. */
  bp?: number
  /** Band-pass Q (default 1). */
  q?: number
  send?: number
  bus?: Channel
  /** Sweep the lowpass down to this frequency across the burst. */
  lpTo?: number
  /** Sweep the band-pass centre to this frequency across the burst. */
  bpTo?: number
  pan?: number
}

/** One enveloped noise burst, band-limited. */
function noise(dur: number, peak: number, o: NoiseOpts = {}): void {
  if (!ctx) return
  const t0 = ctx.currentTime + (o.at ?? 0)
  if (!takeVoice(t0)) return
  const src = ctx.createBufferSource()
  src.buffer = getNoise(ctx)
  // Start somewhere random in the buffer so consecutive bursts differ.
  const offset = Math.random() * Math.max(0.001, src.buffer.duration - dur - 0.05)
  let node: AudioNode = src
  if (o.bp) {
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.setValueAtTime(o.bp, t0)
    if (o.bpTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.bpTo), t0 + dur)
    f.Q.value = o.q ?? 1
    node.connect(f)
    node = f
  }
  if (o.hp) {
    const f = ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = o.hp
    node.connect(f)
    node = f
  }
  if (o.lp) {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(o.lp, t0)
    if (o.lpTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.lpTo), t0 + dur)
    node.connect(f)
    node = f
  }
  const g = ctx.createGain()
  g.gain.setValueAtTime(peak, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  node.connect(g)
  route(g, o.bus ?? 'game', o.send ?? 0, o.pan)
  src.start(t0, offset, dur + 0.05)
  src.stop(t0 + dur + 0.05)
  markBusy(t0 + dur)
}

/**
 * Dry to the channel, plus an optional tap into that channel's reverb. A
 * voice with a `pan` gets a StereoPanner first (skipped in mono, and for a pan
 * too small to hear — a node per voice is not free).
 */
function route(g: GainNode, bus: Channel, send: number, pan = 0): void {
  if (!ctx) return
  let out: AudioNode = g
  if (!opts.mono && Math.abs(pan) > 0.03 && typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    g.connect(p)
    out = p
  }
  out.connect(bus === 'ui' ? uiGain : gameGain)
  if (send > 0) {
    const s = ctx.createGain()
    s.gain.value = send
    out.connect(s)
    s.connect(gameSend)
  }
}

/** A pre-rendered string (instruments.ts) — the folk stings and the Rogue's bow. */
function pluckVoice(kind: PluckKind, semiA2: number, peak: number, o: { at?: number; send?: number; pan?: number; cut?: number } = {}): void {
  if (!ctx) return
  const t0 = ctx.currentTime + (o.at ?? 0)
  if (!takeVoice(t0)) return
  const v = voiceBank(ctx).pluck(kind, semiA2)
  if (!v) return
  const src = ctx.createBufferSource()
  src.buffer = v.buf
  src.playbackRate.value = v.rate
  const g = ctx.createGain()
  g.gain.setValueAtTime(peak, t0)
  const len = o.cut ?? v.buf.duration / v.rate
  if (o.cut) g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.cut)
  src.connect(g)
  route(g, 'game', o.send ?? 0, o.pan)
  src.start(t0)
  src.stop(t0 + len + 0.02)
  markBusy(t0 + len)
}

/** A pre-rendered percussive buffer (instruments.ts). */
function drumVoice(kind: DrumKind, peak: number, o: { at?: number; rate?: number; send?: number; pan?: number } = {}): void {
  if (!ctx) return
  const t0 = ctx.currentTime + (o.at ?? 0)
  if (!takeVoice(t0)) return
  const buf = voiceBank(ctx).drum(kind)
  if (!buf) return
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = o.rate ?? 1
  const g = ctx.createGain()
  g.gain.value = peak
  src.connect(g)
  route(g, 'game', o.send ?? 0, o.pan)
  src.start(t0)
  markBusy(t0 + buf.duration)
}

/** Two-operator FM: the Mystic's sparkle. The index falls, so it starts bright and settles. */
function fm(f0: number, f1: number, ratio: number, index: number, dur: number, peak: number, o: VoiceOpts = {}): void {
  if (!ctx) return
  const t0 = ctx.currentTime + (o.at ?? 0)
  if (!takeVoice(t0)) return
  const car = ctx.createOscillator()
  car.type = 'sine'
  car.frequency.setValueAtTime(f0, t0)
  car.frequency.exponentialRampToValueAtTime(f1, t0 + dur)
  const mod = ctx.createOscillator()
  mod.frequency.setValueAtTime(f0 * ratio, t0)
  mod.frequency.exponentialRampToValueAtTime(f1 * ratio, t0 + dur)
  const idx = ctx.createGain()
  idx.gain.setValueAtTime(f0 * index, t0)
  idx.gain.exponentialRampToValueAtTime(Math.max(1, f1 * index * 0.1), t0 + dur)
  mod.connect(idx)
  idx.connect(car.frequency)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  car.connect(g)
  route(g, 'game', o.send ?? 0, o.pan)
  car.start(t0)
  mod.start(t0)
  car.stop(t0 + dur + 0.03)
  mod.stop(t0 + dur + 0.03)
  markBusy(t0 + dur)
}

/** Semitones above A4 → Hz, and above A2 for the string bank. */
const a4 = (semi: number): number => 440 * Math.pow(2, semi / 12)
const A4_IN_BANK = 24

/**
 * A struck bell: sine partials at 1, 2, 2.4 and 3× the fundamental (the 2.4
 * is what makes it a bell rather than an organ), the upper ones quieter and
 * shorter, all with an instant attack.
 */
function bell(f0: number, decay: number, peak: number, o: VoiceOpts = {}): void {
  const partials: [number, number, number][] = [
    [1, 1, 1],
    [2, 0.55, 0.8],
    [2.4, 0.4, 0.6],
    [3, 0.28, 0.45],
  ]
  for (const [mul, amp, len] of partials) {
    osc(f0 * mul, decay * len, peak * amp, { type: 'sine', attack: 0.002, send: 0.3, ...o })
  }
}

/** A chord or arpeggio, one call. `spread` is the seconds between notes. */
function arp(freqs: number[], dur: number, peak: number, spread: number, o: VoiceOpts = {}): void {
  freqs.forEach((f, i) => osc(f, dur, peak, { ...o, at: (o.at ?? 0) + i * spread }))
}

/**
 * The events that are STINGS: musical phrases rather than impacts. They are
 * held to the score's next beat, written in its key, and duck it (Phase 2).
 * Everything else is an impact and plays the instant it happens.
 */
const STINGS: ReadonlySet<GameEvent> = new Set<GameEvent>(['wave', 'clear', 'victory', 'defeat', 'upgrade', 'evolve', 'levelup', 'boss'])

function playGame(event: GameEvent, p: SfxPayload = {}): void {
  const pan = panFor(p.x)
  if (STINGS.has(event)) {
    const { delay, key, clocked } = stingTiming()
    playSting(event, delay, key, clocked)
    return
  }
  switch (event) {
    /* Quietest thing in the mix: it fires more than anything else, and a shot
       that competes with its own impact is what makes combat mush. Each
       archetype now has its own (Phase 2) — the player can hear who fired. */
    case 'shoot':
      if (p.arch === 'fighter') {
        // A blade swish: a band of noise sweeping down 3 → 1 kHz in 90 ms,
        // and a small metallic ting (inharmonic 2.2/3.1 kHz) on the edge.
        noise(0.09, 0.44, { bp: 3000, bpTo: 1000, q: 2.2, pan })
        osc(vary(2200, 25), 0.12, 0.032, { type: 'sine', at: 0.012, pan, send: 0.1 })
        osc(vary(3100, 25), 0.09, 0.023, { type: 'sine', at: 0.012, pan })
      } else if (p.arch === 'rogue') {
        // A bowstring (a real Karplus–Strong string, very short) and the
        // arrow leaving: a band of noise sweeping up.
        pluckVoice('bow', 7 + Math.round(Math.random() * 2), 0.25, { pan, cut: 0.2 })
        noise(0.12, 0.075, { bp: 1300, bpTo: 3800, q: 1.6, at: 0.018, pan })
      } else if (p.arch === 'mystic') {
        // FM sparkle, 1.2 → 2.4 kHz.
        fm(vary(1200, 40), 2400, 1.51, 1.6, 0.14, 0.07, { pan, send: 0.3 })
      } else {
        noise(0.02, 0.05, { hp: 1600, lp: 7000, pan })
        osc(vary(760, 90), 0.07, 0.07, { to: 200, type: 'square', pan })
      }
      break
    /* THE most frequent meaningful event in the game. Transient (the contact)
       + body (the weight) + a 2.5 kHz band — where a small speaker is most
       efficient — so a phone hears it over the score. The body/transient
       change with who struck; the presence band never goes away. */
    case 'hit':
      if (p.arch === 'rogue') {
        // An arrow thunking into wood and hide: short, higher, drier.
        noise(0.025, 0.8, { bp: 2400, q: 1.4, pan })
        osc(vary(520, 90), 0.06, 0.21, { to: 250, type: 'triangle', pan, send: 0.05 })
        osc(vary(1100, 60), 0.018, 0.1, { type: 'square', pan })
      } else if (p.arch === 'mystic') {
        // A spell landing: a rising ping and a hiss, no thud.
        noise(0.025, 0.63, { bp: 2600, q: 1.2, pan })
        osc(vary(880, 50), 0.09, 0.14, { to: 1320, type: 'sine', pan, send: 0.2 })
        noise(0.06, 0.09, { hp: 3200, pan, send: 0.2 })
      } else {
        noise(0.032, 0.24, { hp: 900, lp: 5200, lpTo: 1800, send: 0.08, pan })
        noise(0.025, 0.7, { bp: 2500, q: 1.2, pan })
        osc(vary(330, 120), 0.09, 0.2, { to: 180, type: 'triangle', send: 0.08, pan })
        osc(vary(1380, 140), 0.022, 0.1, { type: 'square', pan })
      }
      break
    /* A crit must not be "hit, louder": brighter transient, a real sub, and a
       rising shine on top, so the channel carries information. */
    case 'crit':
      noise(0.05, 0.26, { hp: 1300, lp: 9000, lpTo: 2400, send: 0.3, pan })
      osc(vary(262, 60), 0.15, 0.2, { to: 92, type: 'sawtooth', send: 0.25, pan })
      osc(vary(92, 40), 0.18, 0.24, { to: 54, type: 'sine' })
      osc(vary(1760, 60), 0.24, 0.11, { to: 2794, type: 'triangle', at: 0.012, send: 0.4, pan })
      break
    /* A kill is the loudest routine sound — the payoff the whole loop is for.
       Each faction dies its own way (Phase 2): a torch goblin pops, a bomber
       goes up, a barrel splinters. */
    case 'death':
      if (p.faction === 'tnt') {
        // The boom: noise closing 1.2 kHz → 200 Hz over 250 ms, a sub under
        // it, and a crackle a phone can play.
        noise(0.25, 0.33, { lp: 1200, lpTo: 200, send: 0.25, pan })
        osc(vary(70, 30), 0.3, 0.25, { to: 38, type: 'sine' })
        osc(vary(170, 40), 0.18, 0.12, { to: 60, type: 'sawtooth', send: 0.2, pan })
        noise(0.07, 0.42, { bp: 1500, q: 1, pan })
      } else if (p.faction === 'barrel') {
        // Wood giving way: three splintering cracks and a hollow knock.
        noise(0.04, 0.55, { bp: 750, q: 3, pan })
        noise(0.035, 0.75, { bp: 1250, q: 3, at: 0.028, pan })
        noise(0.05, 0.7, { bp: 1800, q: 2.5, at: 0.06, pan, send: 0.15 })
        osc(vary(150, 40), 0.1, 0.24, { to: 90, type: 'triangle', pan })
        osc(vary(62, 20), 0.14, 0.16, { to: 44, type: 'sine' })
      } else {
        noise(0.2, 0.26, { lp: 2600, lpTo: 500, send: 0.2, pan })
        osc(vary(184, 80), 0.22, 0.15, { to: 46, type: 'sawtooth', send: 0.18, pan })
        osc(vary(74, 50), 0.17, 0.2, { to: 44, type: 'sine' })
        // The "pop" a phone can actually play: everything above is sub-400 Hz.
        osc(vary(700, 60), 0.06, 0.1, { to: 160, type: 'square', pan })
      }
      if (p.boss) {
        // A champion falls: a struck bell in the score's key over it all.
        const k = musicClock()?.key ?? 0
        bell(a4(k - 12), 1.6, 0.16, { pan })
        osc(55 * Math.pow(2, k / 12), 0.9, 0.2, { type: 'sine' })
        duckMusic(DUCK.sting, 0.8)
      }
      break
    /* A Sentinel going down. Falls, where a kill drops — different shape on
       purpose, because this one is YOUR loss. */
    case 'down':
      osc(330, 0.2, 0.16, { to: 233, type: 'square', send: 0.3, pan })
      osc(247, 0.34, 0.16, { to: 155, type: 'square', at: 0.11, send: 0.35, pan })
      noise(0.3, 0.1, { lp: 900, lpTo: 260, send: 0.25 })
      duckMusic(DUCK.down, 0.45)
      break
    /* Something got through — the most important warning in a wave. The low
       thud stays for headphones; the struck bell is what a phone hears. With
       the Gate low it becomes a TOLL: slower, deeper, longer — the same bell
       the town rings. */
    case 'leak': {
      osc(140, 0.38, 0.28, { to: 46, type: 'sawtooth', send: 0.3 })
      osc(56, 0.42, 0.2, { to: 40, type: 'sine' })
      noise(0.2, 0.14, { lp: 800, lpTo: 200, send: 0.2 })
      const k = musicClock()?.key ?? 0
      if (lowGate) bell(a4(k - 12), 2.4, 0.1, { send: 0.55 })
      else bell(a4(k), 0.6, 0.2)
      duckMusic(DUCK.leak, lowGate ? 1.2 : 0.4)
      break
    }
    /* A goblin's club on a blocking hero's shield — dull, low-mid, no ring. */
    case 'melee':
      drumVoice('thud', 0.13, { rate: 0.9 + Math.random() * 0.2, pan })
      break
    case 'coin':
      osc(1046, 0.05, 0.14, { type: 'square', send: 0.15 })
      osc(1568, 0.13, 0.14, { type: 'square', at: 0.05, send: 0.25 })
      osc(2093, 0.09, 0.06, { type: 'triangle', at: 0.05, send: 0.3 })
      break
    /*
     * Setting a hero down on a slot: a wooden "thock" — a narrow band of noise
     * at 900 Hz (the knock), a short triangle falling 220→150 Hz (the weight),
     * and a 1.3 kHz tick on top so a phone hears it land.
     */
    case 'deploy':
      noise(0.03, 1.0, { bp: 900, q: 4 })
      osc(vary(220, 40), 0.08, 0.3, { to: 150, type: 'triangle', send: 0.1 })
      osc(vary(1300, 50), 0.018, 0.18, { type: 'square' })
      break
    /* Lifting one off again: the same materials lower and reversed. */
    case 'undeploy':
      noise(0.03, 0.8, { bp: 650, q: 4 })
      osc(vary(130, 40), 0.08, 0.28, { to: 185, type: 'triangle', send: 0.1 })
      osc(vary(1000, 50), 0.018, 0.15, { type: 'square', at: 0.05 })
      break
  }
}

/**
 * The stings — every one written in scale degrees and transposed to the
 * score's key, starting on its next beat (`at`). Open fifths and octaves over
 * the tonic (see `stingDegrees`), so a sting is consonant whichever chord it
 * lands on. With no score playing they start at once, in A.
 */
function playSting(event: GameEvent, at: number, key: number, clocked: boolean): void {
  const deg = (kind: Parameters<typeof stingDegrees>[0], rung = 0) => stingDegrees(kind, key, rung)
  switch (event) {
    /* The wave call: a horn a fifth wide, rising — tonic-and-fifth, in key. */
    case 'wave': {
      const [lo, hi] = deg('call')
      osc(a4(lo - 5), 0.5, 0.18, { to: a4(lo), type: 'sawtooth', attack: 0.05, send: 0.35, at })
      osc(a4(hi - 5), 0.5, 0.127, { to: a4(hi), type: 'sawtooth', attack: 0.06, send: 0.35, at })
      noise(0.25, 0.07, { hp: 400, lp: 2000, send: 0.3, at })
      drumVoice('dum', 0.1, { at })
      duckMusic(DUCK.sting, 0.5, at)
      break
    }
    /* The wave-clear sting: a harp up through the open fifths to the octave,
       a shimmer, and a bloom of reverb that says "that is finished". */
    case 'clear': {
      const n = deg('clear')
      n.forEach((s, i) => {
        pluckVoice('harp', A4_IN_BANK + s, 0.22, { at: at + i * 0.075, send: 0.45 })
        osc(a4(s), 0.2, 0.055, { type: 'triangle', send: 0.45, at: at + i * 0.075 })
      })
      osc(a4(n[n.length - 1] + 12), 0.5, 0.055, { type: 'triangle', at: at + 0.225, send: 0.6 })
      osc(a4(n[1] - 24), 0.6, 0.09, { type: 'sine', at: at + 0.225 })
      noise(0.5, 0.045, { hp: 3500, send: 0.5, at })
      duckMusic(DUCK.sting, 0.7, at)
      break
    }
    /* The run win. With the score on, the victory OUTRO carries the fanfare
       (music.ts) and this is only its downbeat: a strummed major chord and the
       frame drum. With the score off, it is the whole fanfare: A C♯ E A. */
    case 'victory': {
      const root = deg('call')[0] + 12
      const t = [0, 4, 7, 12].map((d) => d + root)
      if (clocked) {
        t.forEach((s, i) => pluckVoice('harp', A4_IN_BANK + s, 0.34, { at: at + i * 0.03, send: 0.5 }))
        drumVoice('dum', 0.7, { at })
      } else {
        arp(t.map(a4), 0.22, 0.17, 0.13, { type: 'square', send: 0.4, at })
        arp(t.map(a4), 1.1, 0.09, 0, { type: 'triangle', at: at + 0.52, send: 0.6 })
        osc(a4(root - 24), 1.2, 0.14, { type: 'sine', at: at + 0.52 })
        noise(0.9, 0.05, { hp: 3000, send: 0.6, at })
      }
      duckMusic(DUCK.sting, 1.2, at)
      break
    }
    /* The run loss: with the score on, the defeat outro falls away on its own
       and this is a low toll under it; without, a descending minor line. */
    case 'defeat': {
      const r = deg('call')[0] + 12
      if (clocked) {
        bell(a4(r - 12), 2.2, 0.18, { at, send: 0.5 })
        osc(a4(r - 24), 1.5, 0.16, { type: 'sine', attack: 0.08, at })
      } else {
        arp([-2, -4, -7, -11].map((d) => a4(r + d)), 0.3, 0.15, 0.17, { type: 'sawtooth', send: 0.4, at })
        osc(a4(r - 24 - 4), 1.5, 0.16, { to: a4(r - 24 - 9), type: 'sine', attack: 0.12, at })
        noise(0.8, 0.05, { lp: 700, lpTo: 180, send: 0.4, at })
      }
      duckMusic(DUCK.sting, 1.2, at)
      break
    }
    /* A purchase or a card: a quick rising figure on the harp, in key. */
    case 'upgrade': {
      const n = deg('rise')
      n.forEach((s, i) => {
        pluckVoice('harp', A4_IN_BANK + s + 12, 0.25, { at: at + i * 0.06, send: 0.3 })
        osc(a4(s + 12), 0.14, 0.062, { type: 'triangle', send: 0.3, at: at + i * 0.06 })
      })
      osc(a4(n[0] - 24), 0.3, 0.1, { type: 'sine', at: at + 0.06 })
      duckMusic(DUCK.sting - 1, 0.4, at)
      break
    }
    /* A hero levels up (new, Phase 2): a sus-to-tonic chime — tonic, fourth,
       fifth, octave — in key, with a small bell on top. */
    case 'levelup': {
      const n = deg('levelup')
      n.forEach((s, i) => pluckVoice('harp', A4_IN_BANK + s + 12, 0.22, { at: at + i * 0.07, send: 0.4 }))
      bell(a4(n[n.length - 1] + 12), 0.9, 0.06, { at: at + 0.21 })
      duckMusic(DUCK.sting - 1, 0.6, at)
      break
    }
    /* Evolution — a riser into a struck chord, so the moment has a before and
       an after. The riser starts NOW; the chord lands on the first beat after it. */
    case 'evolve': {
      const n = deg('evolve')
      osc(a4(n[0]), 0.55, 0.09, { to: a4(n[0] + 24), type: 'sawtooth', attack: 0.3, send: 0.4 })
      noise(0.55, 0.06, { hp: 600, lp: 1200, lpTo: 9000, send: 0.4 })
      const land = clockAfter(0.5)
      n.slice(2).forEach((s, i) => pluckVoice('harp', A4_IN_BANK + s, 0.24, { at: land + i * 0.035, send: 0.6 }))
      arp(n.slice(2, 6).map(a4), 0.75, 0.08, 0.035, { type: 'triangle', at: land, send: 0.6 })
      osc(a4(n[0]), 0.9, 0.15, { type: 'sine', at: land })
      duckMusic(DUCK.sting, 1, land)
      break
    }
    /* A champion arrives (new, Phase 2): a low brass call on tonic and fifth,
       rhythm TA–TA–TAAA, the filter opening 300 Hz → 2 kHz across the call. */
    case 'boss': {
      const r = deg('call')[0] // the tonic, A3 in A
      const calls: [number, number, number][] = [
        [r - 12, 0, 0.24],
        [r - 12, 0.3, 0.24],
        [r - 5, 0.6, 1.0],
      ]
      for (const [semi, dt, len] of calls) {
        for (const det of [-7, 6]) hornVoice(a4(semi), dt, len, 0.04, at, det)
        hornVoice(a4(semi + 12), dt, len, 0.03, at, 0)
      }
      drumVoice('tomLo', 0.2, { at })
      drumVoice('tomLo', 0.18, { at: at + 0.3 })
      drumVoice('dum', 0.25, { at: at + 0.6 })
      duckMusic(DUCK.horn, 1.4, at)
      break
    }
  }
}

/** The first score beat at least `min` seconds from now (or `min` with no score). */
function clockAfter(min: number): number {
  const c = musicClock()
  if (!c || !ctx) return min
  const now = ctx.currentTime
  const t = c.nextBeat(now + min) - now
  return t >= min && t <= min + STING_MAX_WAIT ? t : min
}

/** Length of the whole boss call, over which its filter opens 300 Hz → 2 kHz. */
const HORN_CALL_S = 1.6
const hornCutoff = (s: number): number => 300 * Math.pow(2000 / 300, Math.min(1, Math.max(0, s / HORN_CALL_S)))

/** One saw of the boss horn, starting `dt` into the call. */
function hornVoice(f: number, dt: number, len: number, peak: number, at: number, detune: number): void {
  if (!ctx) return
  const t0 = ctx.currentTime + at + dt
  if (!takeVoice(t0)) return
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  o.frequency.value = f
  o.detune.value = detune
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 1.5
  lp.frequency.setValueAtTime(hornCutoff(dt), t0)
  lp.frequency.exponentialRampToValueAtTime(hornCutoff(dt + len), t0 + len)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.04)
  g.gain.setValueAtTime(peak, t0 + Math.max(0.05, len - 0.08))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len + 0.1)
  o.connect(lp)
  lp.connect(g)
  route(g, 'game', 0.3, 0)
  o.start(t0)
  o.stop(t0 + len + 0.15)
  markBusy(t0 + len + 0.1)
}

/**
 * The rarity ladder. One tier, one sound: longer, brighter and wetter as it
 * climbs — open fifths and octaves over the tonic, in the score's key — and
 * from `rare` up a sub note under it. `level` evens out the loudness steps.
 */
const RARITY_STING: Record<string, { peak: number; spread: number; send: number; sub: boolean; level: number }> = {
  /* Common: a two-note acknowledgement. Not a fanfare — most drops are these,
     and a mythic that sounds like them is the actual bug. */
  common: { peak: 0.11, spread: 0.07, send: 0.2, sub: false, level: 0.68 },
  rare: { peak: 0.12, spread: 0.065, send: 0.3, sub: true, level: 0.46 },
  epic: { peak: 0.13, spread: 0.06, send: 0.4, sub: true, level: 0.55 },
  legendary: { peak: 0.14, spread: 0.055, send: 0.5, sub: true, level: 0.71 },
  mythic: { peak: 0.15, spread: 0.05, send: 0.65, sub: true, level: 0.86 },
}

/**
 * The reward ceremony: the rarity sting when the reward has a rarity that owns
 * one, and the generic `reward` sample only when it does not.
 *
 * They used to play together, and the sample (then −7.6 LUFS Mmax, untrimmed)
 * sat 16–26 dB over the sting, so every tier sounded the same — the one thing
 * the ladder exists to prevent.
 */
export function sfxReward(rarity?: string): void {
  if (hasRaritySting(rarity)) sfxRarity(rarity as string)
  else sfx('reward')
}

/**
 * The rarity-aware half of the reward/purchase ceremony.
 *
 * One tier, one sound: the arpeggio gets longer, brighter and wetter as the
 * tier climbs, and from `rare` up a sub note lands under it. A mythic does not
 * sound like a common, which is the whole point — but the tier is ALSO written
 * on the card in words, a letter and a pip count, so this is a second channel
 * and never the only one.
 */
export function sfxRarity(rarity: string): void {
  const cfg = RARITY_STING[rarity]
  if (!cfg) return
  const c = ensureCtx()
  if (!c || vol.muted) return
  const play = () => {
    if (vol.muted) return
    const rung = (RARITIES as readonly string[]).indexOf(rarity)
    const { delay: at, key } = stingTiming()
    // Voiced a minor third up from the other stings (C in A), where the old
    // C-major ladder sat, so the tier steps measure as they did.
    const notes = stingDegrees('rarity', key, rung).map((s) => s + 3)
    arp(notes.map(a4), 0.26, cfg.peak * cfg.level, cfg.spread, { type: 'triangle', send: cfg.send, at })
    notes.slice(0, 3).forEach((s, i) => pluckVoice('harp', A4_IN_BANK + s, cfg.peak * cfg.level * 2.2, { at: at + i * cfg.spread, send: cfg.send }))
    if (cfg.sub) osc(a4(notes[0] - (rung >= 3 ? 36 : 24)), 0.7, 0.13 * cfg.level, { type: 'sine', at: at + cfg.spread })
    // The top tiers get a shimmer tail; the bottom two deliberately do not.
    if (notes.length >= 4) noise(0.6, 0.04 * cfg.level, { hp: 4000, at: at + cfg.spread * 2, send: cfg.send })
    duckMusic(DUCK.sting - 1, 0.3 + notes.length * cfg.spread, at)
  }
  if (asleep(c)) void resumeCtx(c).then(play)
  else play()
}

// ---- unlock / interruption handling (M31) ----

/**
 * iOS puts a context into `'interrupted'` — not `'suspended'` — after a phone
 * call, a screen lock, or another app taking the audio session. Checking only
 * for `'suspended'` misses that state entirely and the game goes silent for the
 * rest of the session. `AudioContextState` doesn't name it, hence the widening.
 */
const needsResume = (c: AudioContext): boolean => (c.state as string) !== 'running'
/**
 * Not running, OR running with a suspend of ours in flight. A sound that
 * arrives in that window must resume first, or it plays into a context about
 * to freeze and is lost.
 */
const asleep = (c: AudioContext): boolean => needsResume(c) || intendedSuspend

let resuming: Promise<void> | null = null

/** Resume the context, coalescing concurrent attempts into one. */
function resumeCtx(c: AudioContext): Promise<void> {
  if (!asleep(c)) return Promise.resolve()
  if (resuming) return resuming
  // Wanting it running cancels any suspend we asked for.
  intendedSuspend = false
  let p: Promise<void>
  try {
    p = c.resume()
  } catch {
    p = Promise.reject(new Error('resume threw'))
  }
  resuming = p
    .catch(() => {
      /* no gesture yet, or the OS refused — the armed listeners try again */
    })
    .finally(() => {
      resuming = null
      // The moment audio is actually running is the moment the music engine can
      // schedule anything at all, so tell it here rather than making it poll.
      if (!needsResume(c)) {
        disarmUnlock()
        fireReady()
        scheduleIdleCheck()
      } else if (!vol.muted) armUnlock()
    })
  return resuming
}

/**
 * Wake an EXISTING context back up — for the app's shared visibility handler
 * (see src/state/lifecycle.ts). Deliberately does not create a context: with no
 * gesture behind it that would only produce a suspended one.
 */
export function resumeAudio(): void {
  hidden = false
  if (ctx && !vol.muted && asleep(ctx)) void resumeCtx(ctx)
}

/**
 * Play a sound event. `throttleMs` drops repeats of the same event fired too
 * close together (combat spam); `key` names the throttle's budget when one
 * event has several (each archetype's shot keeps its own). `p` is what the
 * engine said about it (archetype, faction, position).
 */
export function sfx(event: SoundEvent, o: { throttleMs?: number; key?: string } = {}, p?: SfxPayload): void {
  const c = ensureCtx()
  if (!c) return
  if (vol.muted) return
  if (o.throttleMs) {
    const now = c.currentTime * 1000
    const k = o.key ?? event
    if (!throttleAllows(lastPlayed.get(k), now, o.throttleMs)) return
    lastPlayed.set(k, now)
  }

  const emit = () => {
    if (vol.muted) return
    if (isUiEvent(event)) playBuffer(UI_SAMPLES[event].file, 'ui', UI_SAMPLES[event].gain)
    else playGame(event, p)
  }

  // The gesture that unlocks audio is usually the same gesture that asks for a
  // sound. Firing without awaiting the resume played that first sound into a
  // still-suspended context, where it was simply dropped (M31).
  if (asleep(c)) void resumeCtx(c).then(emit)
  else emit()
}

/**
 * Bring audio up on a user gesture. Safe to call from any tap; resolves once
 * the context is running (or has refused). Exposed so the app can unlock on the
 * first interaction rather than waiting for the first sound.
 */
export function unlockAudio(): Promise<void> {
  const c = ensureCtx()
  if (!c) return Promise.resolve()
  return resumeCtx(c)
}

/** The context's live state — 'none' when audio never initialised. */
export const audioState = (): string => (ctx ? (ctx.state as string) : 'none')

/**
 * Engine → audio dispatcher for per-frame combat events.
 *
 * ---- the throttles are in REAL time, and that is load-bearing (H20) --------
 *
 * `sfx` measures them against `ctx.currentTime`, which is wall-clock seconds of
 * audio, NOT game time. So 3× speed runs three times as much battle past these
 * gates in the same second and the ceiling below is the same ceiling: a dense
 * wave at 3× cannot machine-gun, because the limit was never expressed in
 * ticks. (Every visual feedback timer in the game decays in game time, which is
 * the other half of H20 and the renderer's to fix.)
 *
 * The numbers are a mix, not a spam filter. Sakurai's rule — balance SFX by
 * importance — puts the kill and the crit above the hit and the hit above the
 * shot, so the rarer, louder events keep their own budget and are never dropped
 * to make room for the constant one.
 */
export function gameSfx(event: string, p?: SfxPayload): void {
  switch (event) {
    case 'shoot':
      // One budget per archetype: three different sounds do not mask each
      // other the way three copies of one did, and a Fighter never silences
      // the Rogue beside it.
      sfx('shoot', { throttleMs: 120, key: 'shoot:' + (p?.arch ?? '') }, p)
      break
    case 'hit':
      // 70ms ⇒ ≤14/s. Was 55 (≤18/s), which at 3× with a full line of
      // Sentinels was a continuous rattle rather than a series of impacts.
      sfx('hit', { throttleMs: 70 }, p)
      break
    case 'crit':
      // Its own budget, so a crit is never swallowed by the hit stream — that
      // is the entire reason the event exists.
      sfx('crit', { throttleMs: 110 }, p)
      break
    case 'kill':
      // A champion's death always plays; the routine ones share a budget.
      sfx('death', p?.boss ? {} : { throttleMs: 70 }, p)
      break
    case 'down':
      // Rare and important: nearly unthrottled, because two Sentinels falling
      // in the same second is exactly what the player needs to hear.
      sfx('down', { throttleMs: 180 }, p)
      break
    case 'leak':
      sfx('leak', { throttleMs: 120 }, p)
      break
    case 'boss':
      // A champion took the field: the horn, once (two champions spawning
      // together are one call).
      sfx('boss', { throttleMs: 1500 }, p)
      break
    case 'melee':
      // The engine reports blocking every tick it deals damage; this is what
      // turns a continuous stream into a blow every ~third of a second.
      sfx('melee', { throttleMs: 320 }, p)
      break
    // NOT `'coin'`. `gameSfx` maps ENGINE events (`GameEngine.onEvent`) to the
    // mixer, and the engine has no coin event: gold is credited by the store,
    // at the settlement, and the store calls `sfx('coin')` there directly. A
    // case for an event nothing emits reads as coverage while being dead (F12)
    // — and worse, it implied the coin shared the combat stream's throttle,
    // which it never did.
  }
}
