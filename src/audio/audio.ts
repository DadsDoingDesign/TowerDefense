/**
 * Audio engine — three channels (UI, Game, Music) under a master gain, into a
 * gentle limiter.
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
type Channel = 'ui' | 'game'
type UiEvent = 'click' | 'select' | 'confirm' | 'back' | 'open' | 'close' | 'toggle' | 'error' | 'equip' | 'reward'
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
  vol = { ...vol, ...v, music: v.music ?? vol.music }
  applyGains()
  for (const cb of readyCbs) safely(cb)
}

/** Is audio muted right now? Read by the music engine, which idles when it is. */
export const audioMuted = (): boolean => vol.muted

function applyGains(): void {
  if (!ctx) return
  masterGain.gain.value = vol.muted ? 0 : vol.master
  gameGain.gain.value = vol.game
  uiGain.gain.value = vol.ui
  musicGain.gain.value = vol.music
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
     * One compressor across everything, on the way out.
     *
     * A dense wave fires shoot + hit + crit + death within a few milliseconds of
     * each other and the sum clipped — which on a phone speaker is heard as the
     * whole mix going thin and papery exactly when the most is happening. A
     * gentle limiter is also what lets the individual voices stay quiet enough
     * to layer while the mix still reads loud.
     */
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -12
    comp.knee.value = 22
    comp.ratio.value = 6
    comp.attack.value = 0.003
    comp.release.value = 0.16
    comp.connect(ctx.destination)
    masterGain = ctx.createGain()
    masterGain.connect(comp)
    gameGain = ctx.createGain()
    gameGain.connect(masterGain)
    uiGain = ctx.createGain()
    uiGain.connect(masterGain)
    musicGain = ctx.createGain()
    musicGain.connect(masterGain)
    // Combat: short and bright, so it adds body without smearing the next hit.
    gameSend = buildSpace(ctx, gameGain, 0.7, 2.6, 0.5, 0.5)
    // Music: longer and darker, so pads bloom.
    musicSend = buildSpace(ctx, musicGain, 1.8, 2.2, 0.22, 0.6)
    applyGains()
    for (const name of Object.values(UI_SAMPLES)) void loadSample(name)
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
export function musicBus(): { ctx: AudioContext; out: GainNode; send: GainNode } | null {
  if (!ctx || (ctx.state as string) !== 'running') return null
  return { ctx, out: musicGain, send: musicSend }
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
  for (const name of Object.values(UI_SAMPLES)) void fetchSample(name)
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
  route(g, o.bus ?? 'game', o.send ?? 0)
  n.start(t0)
  n.stop(t0 + dur + 0.03)
}

interface NoiseOpts {
  at?: number
  lp?: number
  hp?: number
  send?: number
  bus?: Channel
  /** Sweep the lowpass down to this frequency across the burst. */
  lpTo?: number
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
  route(g, o.bus ?? 'game', o.send ?? 0)
  src.start(t0, offset, dur + 0.05)
  src.stop(t0 + dur + 0.05)
}

/** Dry to the channel, plus an optional tap into that channel's reverb. */
function route(g: GainNode, bus: Channel, send: number): void {
  if (!ctx) return
  g.connect(bus === 'ui' ? uiGain : gameGain)
  if (send > 0) {
    const s = ctx.createGain()
    s.gain.value = send
    g.connect(s)
    s.connect(gameSend)
  }
}

/** A chord or arpeggio, one call. `spread` is the seconds between notes. */
function arp(freqs: number[], dur: number, peak: number, spread: number, o: VoiceOpts = {}): void {
  freqs.forEach((f, i) => osc(f, dur, peak, { ...o, at: (o.at ?? 0) + i * spread }))
}

function playGame(event: GameEvent): void {
  switch (event) {
    /* Quietest thing in the mix: it fires more than anything else, and a shot
       that competes with its own impact is what makes combat mush. */
    case 'shoot':
      noise(0.02, 0.05, { hp: 1600, lp: 7000 })
      osc(vary(760, 90), 0.07, 0.07, { to: 200, type: 'square' })
      break
    /* THE most frequent meaningful event in the game, and it was silent.
       Transient (the contact) + body (the weight) + tick (the readability). */
    case 'hit':
      noise(0.032, 0.17, { hp: 900, lp: 5200, lpTo: 1800, send: 0.08 })
      osc(vary(196, 120), 0.09, 0.16, { to: 108, type: 'triangle', send: 0.08 })
      osc(vary(1380, 140), 0.022, 0.05, { type: 'square' })
      break
    /* A crit must not be "hit, louder": brighter transient, a real sub, and a
       rising shine on top, so the channel carries information. */
    case 'crit':
      noise(0.05, 0.26, { hp: 1300, lp: 9000, lpTo: 2400, send: 0.3 })
      osc(vary(262, 60), 0.15, 0.2, { to: 92, type: 'sawtooth', send: 0.25 })
      osc(vary(92, 40), 0.18, 0.24, { to: 54, type: 'sine' })
      osc(vary(1760, 60), 0.24, 0.11, { to: 2794, type: 'triangle', at: 0.012, send: 0.4 })
      break
    /* A kill is the loudest routine sound — the payoff the whole loop is for. */
    case 'death':
      noise(0.2, 0.26, { lp: 2600, lpTo: 500, send: 0.2 })
      osc(vary(184, 80), 0.22, 0.15, { to: 46, type: 'sawtooth', send: 0.18 })
      osc(vary(74, 50), 0.17, 0.2, { to: 44, type: 'sine' })
      break
    /* A Sentinel going down. Falls, where a kill drops — different shape on
       purpose, because this one is YOUR loss. */
    case 'down':
      osc(330, 0.2, 0.16, { to: 233, type: 'square', send: 0.3 })
      osc(247, 0.34, 0.16, { to: 155, type: 'square', at: 0.11, send: 0.35 })
      noise(0.3, 0.1, { lp: 900, lpTo: 260, send: 0.25 })
      break
    case 'leak':
      osc(140, 0.38, 0.28, { to: 46, type: 'sawtooth', send: 0.3 })
      osc(56, 0.42, 0.2, { to: 40, type: 'sine' })
      noise(0.2, 0.14, { lp: 800, lpTo: 200, send: 0.2 })
      break
    case 'coin':
      osc(1046, 0.05, 0.14, { type: 'square', send: 0.15 })
      osc(1568, 0.13, 0.14, { type: 'square', at: 0.05, send: 0.25 })
      osc(2093, 0.09, 0.06, { type: 'triangle', at: 0.05, send: 0.3 })
      break
    /* A horn call, not a beep: two saws a fifth apart, rising together. */
    case 'wave':
      osc(196, 0.5, 0.13, { to: 294, type: 'sawtooth', attack: 0.05, send: 0.35 })
      osc(294, 0.5, 0.09, { to: 440, type: 'sawtooth', attack: 0.06, send: 0.35 })
      noise(0.25, 0.05, { hp: 400, lp: 2000, send: 0.3 })
      break
    /*
     * The wave-clear sting (H18). Short — it has to fit inside the hold and be
     * skippable — but it resolves: a rising third to a fifth, a shimmer over
     * the top, and a bloom of reverb that says "that is finished".
     */
    case 'clear':
      arp([523.25, 659.25, 783.99], 0.2, 0.16, 0.075, { type: 'triangle', send: 0.45 })
      osc(1046.5, 0.5, 0.11, { type: 'triangle', at: 0.225, send: 0.6 })
      osc(130.81, 0.6, 0.13, { type: 'sine', at: 0.225 })
      noise(0.5, 0.045, { hp: 3500, send: 0.5 })
      break
    /* The run win. Longer, a full triad, and it lands on an octave. */
    case 'victory':
      arp([523.25, 659.25, 783.99, 1046.5], 0.22, 0.17, 0.13, { type: 'square', send: 0.4 })
      arp([523.25, 659.25, 783.99, 1046.5], 1.1, 0.09, 0, { type: 'triangle', at: 0.52, send: 0.6 })
      osc(130.81, 1.2, 0.14, { type: 'sine', at: 0.52 })
      noise(0.9, 0.05, { hp: 3000, send: 0.6 })
      break
    /* The run LOSS (M32) — called from nowhere before this phase. Descending
       minor over a drone: unmistakably an ending, and not a long one. */
    case 'defeat':
      arp([392, 349.23, 293.66, 233.08], 0.3, 0.15, 0.17, { type: 'sawtooth', send: 0.4 })
      osc(87.31, 1.5, 0.16, { to: 65.41, type: 'sine', attack: 0.12 })
      osc(116.54, 1.4, 0.07, { type: 'triangle', at: 0.2, send: 0.5 })
      noise(0.8, 0.05, { lp: 700, lpTo: 180, send: 0.4 })
      break
    case 'upgrade':
      arp([659.25, 830.61, 987.77, 1318.5], 0.14, 0.13, 0.06, { type: 'square', send: 0.3 })
      osc(164.81, 0.3, 0.1, { type: 'sine', at: 0.06 })
      break
    /*
     * Evolution — the loudest ceremony in a run that is not its ending. A riser
     * into a struck chord, so the moment has a before and an after.
     */
    case 'evolve':
      osc(220, 0.55, 0.09, { to: 880, type: 'sawtooth', attack: 0.3, send: 0.4 })
      noise(0.55, 0.06, { hp: 600, lp: 1200, lpTo: 9000, send: 0.4 })
      arp([523.25, 783.99, 1046.5, 1567.98], 0.75, 0.12, 0.035, { type: 'triangle', at: 0.5, send: 0.6 })
      osc(130.81, 0.9, 0.15, { type: 'sine', at: 0.5 })
      break
  }
}

/** Rarity tiers, brightest last. Shared with `sfxRarity`. */
const RARITY_STING: Record<string, { notes: number[]; peak: number; spread: number; send: number; sub?: number }> = {
  /* Common: a two-note acknowledgement. Not a fanfare — most drops are these,
     and a mythic that sounds like them is the actual bug. */
  common: { notes: [523.25, 659.25], peak: 0.11, spread: 0.07, send: 0.2 },
  rare: { notes: [523.25, 659.25, 783.99], peak: 0.12, spread: 0.065, send: 0.3, sub: 130.81 },
  epic: { notes: [523.25, 659.25, 783.99, 1046.5], peak: 0.13, spread: 0.06, send: 0.4, sub: 130.81 },
  legendary: { notes: [523.25, 659.25, 783.99, 1046.5, 1318.51], peak: 0.14, spread: 0.055, send: 0.5, sub: 98 },
  mythic: { notes: [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98], peak: 0.15, spread: 0.05, send: 0.65, sub: 65.41 },
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
    arp(cfg.notes, 0.26, cfg.peak, cfg.spread, { type: 'triangle', send: cfg.send })
    if (cfg.sub) osc(cfg.sub, 0.7, 0.13, { type: 'sine', at: cfg.spread })
    // The top tiers get a shimmer tail; the bottom two deliberately do not.
    if (cfg.notes.length >= 4) noise(0.6, 0.04, { hp: 4000, at: cfg.spread * 2, send: cfg.send })
  }
  if (needsResume(c)) void resumeCtx(c).then(play)
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

let resuming: Promise<void> | null = null

/** Resume the context, coalescing concurrent attempts into one. */
function resumeCtx(c: AudioContext): Promise<void> {
  if (!needsResume(c)) return Promise.resolve()
  if (resuming) return resuming
  resuming = c
    .resume()
    .catch(() => {
      /* no gesture yet, or the OS refused — the next gesture tries again */
    })
    .finally(() => {
      resuming = null
      // The moment audio is actually running is the moment the music engine can
      // schedule anything at all, so tell it here rather than making it poll.
      if (!needsResume(c)) fireReady()
    })
  return resuming
}

/**
 * Wake an EXISTING context back up — for the app's shared visibility handler
 * (see src/state/lifecycle.ts). Deliberately does not create a context: with no
 * gesture behind it that would only produce a suspended one.
 */
export function resumeAudio(): void {
  if (ctx && needsResume(ctx)) void resumeCtx(ctx)
}

/** Play a sound event. `throttleMs` drops repeats of the same event fired too close together (combat spam). */
export function sfx(event: SoundEvent, opts: { throttleMs?: number } = {}): void {
  const c = ensureCtx()
  if (!c) return
  if (vol.muted) return
  if (opts.throttleMs) {
    const now = c.currentTime * 1000
    const last = lastPlayed.get(event) ?? -1e9
    if (now - last < opts.throttleMs) return
    lastPlayed.set(event, now)
  }

  const emit = () => {
    if (vol.muted) return
    if (isUiEvent(event)) playBuffer(UI_SAMPLES[event], 'ui')
    else playGame(event)
  }

  // The gesture that unlocks audio is usually the same gesture that asks for a
  // sound. Firing without awaiting the resume played that first sound into a
  // still-suspended context, where it was simply dropped (M31).
  if (needsResume(c)) void resumeCtx(c).then(emit)
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
export function gameSfx(event: string): void {
  switch (event) {
    case 'shoot':
      sfx('shoot', { throttleMs: 90 })
      break
    case 'hit':
      // 70ms ⇒ ≤14/s. Was 55 (≤18/s), which at 3× with a full line of
      // Sentinels was a continuous rattle rather than a series of impacts.
      sfx('hit', { throttleMs: 70 })
      break
    case 'crit':
      // Its own budget, so a crit is never swallowed by the hit stream — that
      // is the entire reason the event exists.
      sfx('crit', { throttleMs: 110 })
      break
    case 'kill':
      sfx('death', { throttleMs: 70 })
      break
    case 'down':
      // Rare and important: nearly unthrottled, because two Sentinels falling
      // in the same second is exactly what the player needs to hear.
      sfx('down', { throttleMs: 180 })
      break
    case 'leak':
      sfx('leak', { throttleMs: 120 })
      break
    // NOT `'coin'`. `gameSfx` maps ENGINE events (`GameEngine.onEvent`) to the
    // mixer, and the engine has no coin event: gold is credited by the store,
    // at the settlement, and the store calls `sfx('coin')` there directly. A
    // case for an event nothing emits reads as coverage while being dead (F12)
    // — and worse, it implied the coin shared the combat stream's throttle,
    // which it never did.
  }
}
