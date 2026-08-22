/**
 * The presentation feedback layer — particles, decals, shake, hitstop, arcs and
 * floaters (Phase 3, game feel).
 *
 * ## Three rules this module exists to keep
 *
 * **1. Rendering is not simulation.** Nothing in here is reachable from
 * `GameEngine`. The engine is never called, never read for a decision, never
 * written to, and `balance/harness.ts` does not import a single module in this
 * file's closure. Every effect is *derived* by `BattleCanvas` diffing the
 * engine's own public state either side of a whole `TICK` — see the "tick
 * differ" note there — so a battle resolves byte-identically whether this file
 * exists or not. That is also why hitstop lives here rather than in `step()`:
 * hitstop only decides **whether real time is banked into the accumulator**, and
 * the accumulator only ever hands the sim whole TICKs.
 *
 * **2. Presentation decays in REAL time.** This is the visual half of H20.
 * Every timer in the game used to decay in *game* time, so at 3× a damage
 * number lived 0.2 real seconds and a hit flash was sub-perceptual. Everything
 * here is advanced by `dtReal`, so a floater is readable for the same 1.15
 * seconds at 1× and at 3×, and a hit flash is the same 90 ms of white whatever
 * the speed dial says. Gameplay-state timestamps (burn/chill/stun) are
 * untouched and still live on `engine.elapsed` — the two-clock split from
 * Phase 1 gains a third hand rather than losing one.
 *
 * **3. Reduced motion reaches the canvas.** Finding L11: the setting governed
 * CSS transitions and never crossed into the field, so a player who asked the
 * OS for less motion still got everything the canvas could throw. {@link
 * setFxReducedMotion} is pushed in from `BattleCanvas` every frame and gates
 * shake, hitstop, particles and decals — but *not* floaters, hit flashes or the
 * proc tells, because those carry information rather than motion, and a
 * setting that hides what happened is an accessibility failure of its own.
 *
 * ## Budget
 *
 * Everything is pooled and capped: {@link MAX_PARTICLES} particle records are
 * allocated once and reused by swap-remove, so a dense wave allocates nothing.
 * Emitters ask for a count and get {@link degrade}'d down as the pool fills, so
 * the hundredth kill of a swarm wave costs a fraction of the first and the
 * frame budget degrades smoothly instead of falling off a cliff.
 */
import { ANIM_FRAMES } from './anim'
import { pixmap, type Pixmap } from './pixmap'
import { getSprite } from './sprites'
import { getActiveStyle } from './themes'

// ── budget ──────────────────────────────────────────────────────────────────

const MAX_PARTICLES = 420
const MAX_DECALS = 40
const MAX_FLOATERS = 36
const MAX_ARCS = 20

// ── the real-time clock ─────────────────────────────────────────────────────

let fxT = 0
/** Seconds of REAL time since the canvas mounted. Frozen during hitstop. */
export const fxNow = (): number => fxT
/**
 * The shake's own phase clock, which does **not** freeze during hitstop.
 *
 * Split out from `fxT` because the two want opposite things. `fxT` must stop —
 * it is what makes a hitstop a held frame, and every particle, decal and
 * floater is integrated against it. The *shake* must keep running, because the
 * documented effect is Sakurai's layered one: "a totally frozen frame reads as
 * a dropped frame; a frozen frame that is vibrating reads as impact."
 *
 * It did not. `fxAdvance` computed `shake.dx/dy` from `fxT` and then returned
 * early **before** `fxT += dt`, so for the 2–8 frames of a stop the phase was
 * pinned and only the amplitude decayed: a static offset, i.e. the field simply
 * jumped sideways and sat there. Feeding the trig a clock that never freezes is
 * the whole fix, and it costs one more float.
 */
let shakeT = 0

let reducedMotion = false
/** Pushed in from `BattleCanvas` each frame (L11). */
export function setFxReducedMotion(v: boolean): void {
  reducedMotion = v
  fxStats.reduced = v
}
export const fxReducedMotion = (): boolean => reducedMotion

/**
 * Live counters, for the measurement harness. Read-only from outside.
 *
 * The `enemy*` block exists because of C1/C2. Every gate this layer shipped
 * behind stayed green while **every burning enemy was a featureless white blob
 * for the whole burn** and the drawn knockback was measurably zero, for one
 * reason: nothing here watched the hit flash or the recoil, so the two channels
 * that were broken were the two nobody could see the numbers for. A counter for
 * particles and none for the flash is a scorecard that grades the cheap claim.
 * These are recomputed once per {@link fxAdvance} over the same map the decay
 * loop already walks, so they cost one comparison per tracked entity.
 */
export const fxStats = {
  particles: 0,
  decals: 0,
  floaters: 0,
  arcs: 0,
  trauma: 0,
  hitstop: 0,
  /** Cumulative: particles spawned, hitstops granted, hitstops refused. */
  spawned: 0,
  stops: 0,
  stopsRefused: 0,
  traumaEvents: 0,
  /** Cumulative floaters, kills, arcs and impacts emitted. */
  floatersMade: 0,
  kills: 0,
  arcsMade: 0,
  impacts: 0,
  leaks: 0,
  reduced: false,

  // ── the channels C1 and C2 broke, now measurable ──────────────────────────
  /** Entities currently tracked for flash/recoil/attrition. */
  enemyFx: 0,
  /** How many of them are drawing a HIT flash this frame. */
  enemyFlash: 0,
  /** Mean hit-flash level (0–1) over the tracked set — 1.0 means "all white". */
  enemyFlashMean: 0,
  /** How many are drawing the DoT attrition tint this frame. */
  enemyDot: 0,
  /** Live drawn recoil: how many are non-zero, and the longest, in logical px. */
  recoilNonZero: 0,
  recoilMax: 0,
  /** Cumulative discrete hits, DoT pulses, and DoT ticks the gap suppressed. */
  hits: 0,
  dots: 0,
  dotsThrottled: 0,
}

// ── particles ───────────────────────────────────────────────────────────────

const SPARK = 0
const DUST = 1
const EMBER = 2
const CHUNK = 3
const RING = 4
const SMOKE = 5
const SHEET = 6

interface P {
  k: number
  x: number
  y: number
  vx: number
  vy: number
  t: number
  life: number
  r: number
  r2: number
  a: number
  g: number
  d: number
  col: string
  rot: number
  vrot: number
  sheet: number
  fps: number
}

const pool: P[] = []
for (let i = 0; i < MAX_PARTICLES; i++) {
  pool.push({ k: 0, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, r: 1, r2: 1, a: 1, g: 0, d: 0, col: '#fff', rot: 0, vrot: 0, sheet: -1, fps: 12 })
}
let pn = 0

/**
 * Take a particle from the pool, or `null` when full.
 *
 * A full pool refuses rather than growing or evicting: an emitter that cannot
 * place its twelfth spark still placed eleven, and the alternative — evicting
 * the oldest — makes a dense wave delete the effects the player is still
 * looking at in order to draw ones they have not noticed yet.
 */
function take(): P | null {
  if (pn >= MAX_PARTICLES) return null
  fxStats.spawned++
  return pool[pn++]
}

/**
 * Scale a requested particle count by how full the pool already is.
 *
 * Sakurai's "Particle Limits" in reverse: abundance is sold with short
 * lifespans and staggered timing, so thinning the *count* under load costs far
 * less than it looks like it should. A swarm wave keeps its shape; it just
 * stops paying for every last spark.
 */
function degrade(n: number): number {
  const load = pn / MAX_PARTICLES
  if (load < 0.5) return n
  if (load < 0.72) return Math.ceil(n * 0.6)
  if (load < 0.88) return Math.ceil(n * 0.32)
  return 1
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

// ── decals (permanence) ─────────────────────────────────────────────────────

interface Decal {
  x: number
  y: number
  t: number
  life: number
  /** Baked sprite for a corpse, or null for a procedural scorch/splat. */
  pm: Pixmap | null
  frame: number
  /** Feet anchor offset, so the corpse lands where the unit stood. */
  feet: number
  col: string
  r: number
  /** Seconds of "kill pop" before the body settles. */
  pop: number
  ringCol: string
}
const decals: Decal[] = []

// ── floaters (the renderer's own copies, on the real-time clock) ────────────

const F_NUM = 0
const F_CRIT = 1
const F_WORD = 2

interface Floater {
  x: number
  y: number
  vy: number
  t: number
  life: number
  text: string
  col: string
  k: number
}
const floaters: Floater[] = []

// ── chain-lightning arcs ────────────────────────────────────────────────────

interface Arc {
  x0: number
  y0: number
  x1: number
  y1: number
  t: number
  life: number
  seed: number
}
const arcs: Arc[] = []

// ── per-entity presentation state ───────────────────────────────────────────

/**
 * Hit flash and *visual* knockback, keyed by entity id.
 *
 * The knockback is doctrine item 7 ("enemies recoil when hit; the player
 * recoils when firing") implemented without touching a single gameplay
 * coordinate: `RtEnemy.pos` is where the sim says the unit is and decides hit
 * detection, splash and blocking; this is a decaying offset applied at DRAW
 * time only. So a hit visibly knocks a goblin back three pixels and the goblin
 * has not moved.
 */
interface EFx {
  flash: number
  /** Continuous-attrition tint (burn/thorns/trap), NOT a hit. See {@link fxDotEnemy}. */
  dot: number
  /** `fxT` of the last attrition pulse, so the pulse has a floor on its period. */
  dotAt: number
  rx: number
  ry: number
  seen: number
}
const enemyFx = new Map<string, EFx>()

interface SFx {
  /** Fire recoil (drawn offset, opposite the shot). */
  rx: number
  ry: number
  muzzle: number
  muzzleAngle: number
  proc: number
  procKind: ProcKind
  seen: number
}
export type ProcKind = 'shock' | 'burn' | 'execute' | 'stun' | null
const sentinelFx = new Map<string, SFx>()

const HIT_FLASH_SECONDS = 0.11
const RECOIL_DECAY = 13
const PROC_SECONDS = 0.5
const MUZZLE_SECONDS = 0.09

/**
 * ── attrition is not impact (C1) ────────────────────────────────────────────
 *
 * `engine.ts` applies `burnDps * dt` on **every tick** a burn is live, and the
 * same is true of thorns (a blocked enemy grinding against a fighter) and of
 * traps. The tick differ used to answer "hp fell" with {@link fxHitEnemy},
 * which assigns `flash = HIT_FLASH_SECONDS` unconditionally — so a 4-second
 * burn re-armed a 110 ms flash sixty times a second and the flash never
 * decayed. Measured: 42 of 44 frames pinned at 1.000, and `blitPixmap` paints
 * the white silhouette at `globalAlpha 0.92`. Every burning enemy was a
 * featureless white blob: faction, tier colour, the torch goblin's detached
 * flame, all gone, for the whole burn.
 *
 * A tick of a damage-over-time is **not a hit**, so it gets its own channel and
 * its own decay:
 *
 *  - it never touches `flash`, so the white impact silhouette stays reserved
 *    for discrete impacts and keeps meaning "something just landed";
 *  - it never touches `rx`/`ry`, so it cannot overwrite the directional
 *    knockback a real impact wrote earlier in the same tick (C2);
 *  - it is **rate-limited to a pulse**. A continuous process drawn continuously
 *    is a constant, and a constant carries no information; drawn as a heartbeat
 *    at ~2.2 Hz it reads as *ongoing* rather than as *now*, which is what a DoT
 *    actually is. `DOT_GAP` is the floor on the period, so ticking sixty times
 *    a second and ticking three times a second look the same.
 *  - it tints with the unit's own silhouette in **ember orange at 0.34**, not
 *    warm white at 0.92 — a different hue and a third of the intensity, so it
 *    never competes with an impact and never erases the sprite underneath.
 */
const DOT_PULSE_SECONDS = 0.17
const DOT_GAP = 0.45

function efx(id: string): EFx {
  let e = enemyFx.get(id)
  if (!e) enemyFx.set(id, (e = { flash: 0, dot: 0, dotAt: -99, rx: 0, ry: 0, seen: fxT }))
  e.seen = fxT
  return e
}
function sfx(id: string): SFx {
  let s = sentinelFx.get(id)
  if (!s) sentinelFx.set(id, (s = { rx: 0, ry: 0, muzzle: 0, muzzleAngle: 0, proc: 0, procKind: null, seen: fxT }))
  s.seen = fxT
  return s
}

/** White-hot silhouette flash, 0–1, for the enemy with this id. Impacts only. */
export const fxEnemyFlash = (id: string): number => (enemyFx.get(id)?.flash ?? 0) / HIT_FLASH_SECONDS
/** Attrition pulse, 0–1 — burn/thorns/trap wear, never a hit. */
export const fxEnemyDot = (id: string): number => (enemyFx.get(id)?.dot ?? 0) / DOT_PULSE_SECONDS
/**
 * Drawn-only knockback offset for the enemy with this id.
 *
 * Fills a module-scoped scratch rather than allocating: this is called once per
 * enemy per frame, which on a dense wave was ~40 short-lived objects a frame
 * for a value the caller reads twice and drops.
 */
export function fxEnemyRecoil(id: string): { x: number; y: number } {
  const e = enemyFx.get(id)
  RECOIL_OUT.x = e ? e.rx : 0
  RECOIL_OUT.y = e ? e.ry : 0
  return RECOIL_OUT
}
const RECOIL_OUT = { x: 0, y: 0 }

/** Tower recoil/muzzle/proc state. Same scratch-fill contract as above. */
export function fxSentinel(id: string): { rx: number; ry: number; muzzle: number; muzzleAngle: number; proc: number; procKind: ProcKind } {
  const s = sentinelFx.get(id)
  SFX_OUT.rx = s ? s.rx : 0
  SFX_OUT.ry = s ? s.ry : 0
  SFX_OUT.muzzle = s ? s.muzzle / MUZZLE_SECONDS : 0
  SFX_OUT.muzzleAngle = s ? s.muzzleAngle : 0
  SFX_OUT.proc = s ? s.proc / PROC_SECONDS : 0
  SFX_OUT.procKind = s ? s.procKind : null
  return SFX_OUT
}
const SFX_OUT = { rx: 0, ry: 0, muzzle: 0, muzzleAngle: 0, proc: 0, procKind: null as ProcKind }

// ── the base ────────────────────────────────────────────────────────────────

const base = {
  hurt: 0,
  /** Fraction of base HP remaining, 0–1 — drives the standing damage state. */
  frac: 1,
  /** Run-loss ceremony, counts UP from 0 when the base falls. */
  lost: -1,
  smokeAt: 0,
}
export const fxBaseState = () => base

// ── screenshake (trauma model — Eiserloh) ───────────────────────────────────

/**
 * Trauma, 0–1, decaying linearly; the offset is trauma **squared**.
 *
 * That exponent is the whole point (Eiserloh, "Juicing Your Cameras With
 * Math"): a normal hit adds so little trauma that it barely registers, while a
 * boss death or a leak slams, and the two never have to be special-cased
 * against each other. Trauma decays linearly, so a burst of small events cannot
 * accumulate into a permanent wobble.
 *
 * **Translation only, and rounded to whole logical px.** The rotational
 * component the trauma model also offers was built and then dropped on
 * evidence: the visible canvas *is* the 960×560 composite, so rotating it
 * rotates the composed pixel-art frame, and with `imageSmoothingEnabled = false`
 * that is a nearest-neighbour resample of every sprite on the field for the
 * duration of the shake — the exact defect the Phase 3 pixel pipeline exists to
 * end, reintroduced for 200 ms at a time. Rounding the translation to whole
 * logical px keeps the field on its pixel grid throughout, which costs nothing
 * the eye can see at a 0.41 view scale and keeps every draw at scale 1.000.
 */
let trauma = 0
const TRAUMA_DECAY = 1.9
const SHAKE_MAX_PX = 7
const shake = { dx: 0, dy: 0, on: false }

/**
 * Add trauma.
 *
 * @param ceiling the highest trauma THIS event is allowed to produce. Frequent
 *   minor events (every boss hit, every splash) pass a low ceiling, so a fast
 *   line of towers on a boss cannot stack a 0.05-per-hit contribution into a
 *   permanent wobble — measured at 224 trauma events in one scripted fight,
 *   which without this is a screen that never stops moving. Big, rare events
 *   (a leak, a boss death, the run loss) pass no ceiling and slam. This is
 *   Lisa Brown's rule in one parameter: juice that fires constantly means
 *   nothing, and juice that hides the next threat is a defect.
 */
export function fxTrauma(amount: number, ceiling = 1): void {
  if (reducedMotion) return
  // Never *lower* standing trauma: a small event landing during a big shake
  // must not cut the big shake short.
  trauma = Math.max(trauma, Math.min(1, Math.min(trauma + amount, ceiling)))
  fxStats.traumaEvents++
}
export const fxShake = () => shake

// ── hitstop ─────────────────────────────────────────────────────────────────

/**
 * Freeze-frame on significant impacts (Sakurai's "Stop for Big Moments";
 * Nijman's "sleep").
 *
 * **Why this is safe.** It never touches `engine.step`. `BattleCanvas` simply
 * does not bank real time into the fixed-timestep accumulator while
 * `hitstopLeft > 0`, and the accumulator only ever hands the sim whole `TICK`s.
 * Skipping a few frames of accumulation changes *when* ticks run in wall-clock
 * terms and changes nothing at all about which ticks run or in what order — the
 * same property that already lets the game run at 30 Hz, 60 Hz and 144 Hz and
 * produce the identical battle.
 *
 * **Why it is budgeted.** A dense wave at 3× can produce a dozen kills a
 * second, and a game that stops for all of them has simply been slowed down.
 * The budget refills at {@link STOP_REFILL} seconds per second and is capped, so
 * hitstop is guaranteed to be a *punctuation* — at most ~18% of real time — and
 * the first kill of a burst gets the full freeze while the tenth gets none.
 * Requests are also scaled by play speed, so 3× spends the same *simulated*
 * time frozen as 1× does.
 */
let hitstopLeft = 0
let stopBudget = 0.3
const STOP_REFILL = 0.18
const STOP_BUDGET_MAX = 0.3

/**
 * @param seconds  requested freeze at 1× (0.033 = 2 frames, 0.133 = 8).
 * @param speed    the play-speed dial, so 3× freezes for a third as long.
 */
export function fxHitstop(seconds: number, speed = 1): void {
  if (reducedMotion) return
  const want = seconds / Math.max(1, speed)
  const grant = Math.min(want, stopBudget)
  if (grant <= 0.004) {
    fxStats.stopsRefused++
    return
  }
  stopBudget -= grant
  if (grant > hitstopLeft) hitstopLeft = grant
  fxStats.stops++
}
export const fxHitstopLeft = (): number => hitstopLeft

// ── the fx sprite sheets (CC0, harvested — see public/assets/CC0-MANIFEST.md) ─

/**
 * The two effect sheets, loaded here rather than through `sprites.ts`.
 *
 * `sprites.ts` owns *pack roles* — the per-theme art a pack declares it ships —
 * and these are neither: they live under `assets/fx/` and are theme-independent.
 * They are fetched lazily on the first battle frame (19 KB for both) so they
 * cost nothing on the boot path, and they are baked through the same ×½ box
 * filter as everything else, then drawn **1:1**, so they hold the one pixel
 * density the field is built on.
 */
interface Sheet {
  img: HTMLImageElement | null
  frames: number
  pm: Pixmap | null
}
const SHEETS: Sheet[] = [
  { img: null, frames: 9, pm: null }, // 0 explosion — 1728×192, 9 × 192²  → 96² baked
  { img: null, frames: 7, pm: null }, // 1 fire      —  896×128, 7 × 128²  → 64² baked
]
const SHEET_FILES = ['explosions', 'fire']
export const FX_EXPLOSION = 0
export const FX_FIRE = 1

let sheetsRequested = false
/** Fetch the effect sheets once. No-op outside a document. */
export function fxPreload(): void {
  if (sheetsRequested || typeof document === 'undefined') return
  sheetsRequested = true
  SHEETS.forEach((s, i) => {
    const img = new Image()
    img.src = `assets/fx/tinyswords/${SHEET_FILES[i]}.png`
    s.img = img
  })
}

function sheetPm(i: number): Pixmap | null {
  const s = SHEETS[i]
  if (s.pm) return s.pm
  if (!s.img || !s.img.complete || !s.img.naturalWidth) return null
  s.pm = pixmap(s.img, { scale: 0.5, frames: s.frames })
  return s.pm
}

// ── lifecycle ───────────────────────────────────────────────────────────────

/** Drop everything. Called when a new battle starts. */
export function fxReset(): void {
  pn = 0
  decals.length = 0
  floaters.length = 0
  arcs.length = 0
  enemyFx.clear()
  sentinelFx.clear()
  trauma = 0
  hitstopLeft = 0
  stopBudget = STOP_BUDGET_MAX
  base.hurt = 0
  base.frac = 1
  base.lost = -1
  base.smokeAt = 0
  shake.dx = shake.dy = 0
  shake.on = false
}

/**
 * Advance every presentation timer by REAL seconds.
 *
 * During hitstop the world holds still — particles, floaters, decals and the
 * clock all stop — but **shake keeps running**. That is deliberate and is the
 * layered version of the effect (Sakurai's "Eight Hit-Stop Specs": micro-shake
 * *during* the stop). A totally frozen frame reads as a dropped frame; a frozen
 * frame that is vibrating reads as impact.
 */
export function fxAdvance(dtReal: number): void {
  const dt = dtReal > 0.1 ? 0.1 : dtReal

  // Shake and the hitstop budget run on unconditional real time — including
  // the shake's PHASE, which is what makes a held frame vibrate rather than
  // just sit at an offset (see `shakeT`).
  shakeT += dt
  if (trauma > 0) trauma = Math.max(0, trauma - TRAUMA_DECAY * dt)
  stopBudget = Math.min(STOP_BUDGET_MAX, stopBudget + STOP_REFILL * dt)
  const s = trauma * trauma
  // Two incommensurate frequencies so the offset never traces a circle and
  // never repeats on a beat the eye can lock onto.
  shake.dx = Math.round(s * SHAKE_MAX_PX * Math.sin(shakeT * 47.3 + 1.7))
  shake.dy = Math.round(s * SHAKE_MAX_PX * Math.sin(shakeT * 39.1 + 4.2))
  shake.on = shake.dx !== 0 || shake.dy !== 0

  if (hitstopLeft > 0) {
    hitstopLeft = Math.max(0, hitstopLeft - dt)
    fxStats.hitstop = hitstopLeft
    fxStats.trauma = trauma
    return
  }
  fxStats.hitstop = 0
  fxStats.trauma = trauma

  fxT += dt

  // --- particles: integrate, then swap-remove the dead ---------------------
  for (let i = 0; i < pn; ) {
    const p = pool[i]
    p.t += dt
    if (p.t >= p.life) {
      pool[i] = pool[pn - 1]
      pool[pn - 1] = p
      pn--
      continue
    }
    p.vy += p.g * dt
    if (p.d > 0) {
      const k = 1 - Math.min(1, p.d * dt)
      p.vx *= k
      p.vy *= k
    }
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.rot += p.vrot * dt
    i++
  }

  for (let i = decals.length - 1; i >= 0; i--) {
    const d = decals[i]
    d.t += dt
    if (d.t >= d.life) decals.splice(i, 1)
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i]
    f.t += dt
    f.y += f.vy * dt
    // Ease the rise out so the number settles instead of sliding off at speed.
    f.vy *= 1 - Math.min(1, 2.6 * dt)
    if (f.t >= f.life) floaters.splice(i, 1)
  }
  for (let i = arcs.length - 1; i >= 0; i--) {
    arcs[i].t += dt
    if (arcs[i].t >= arcs[i].life) arcs.splice(i, 1)
  }

  // --- per-entity state ----------------------------------------------------
  const rk = 1 - Math.min(1, RECOIL_DECAY * dt)
  let nFlash = 0
  let sFlash = 0
  let nDot = 0
  let nRecoil = 0
  let maxRecoil = 0
  for (const [id, e] of enemyFx) {
    e.flash = Math.max(0, e.flash - dt)
    e.dot = Math.max(0, e.dot - dt)
    e.rx *= rk
    e.ry *= rk
    sFlash += e.flash / HIT_FLASH_SECONDS
    if (e.flash > 0) nFlash++
    if (e.dot > 0) nDot++
    const rl = Math.hypot(e.rx, e.ry)
    if (rl > 1e-9) nRecoil++
    if (rl > maxRecoil) maxRecoil = rl
    if (e.flash <= 0 && e.dot <= 0 && Math.abs(e.rx) < 0.05 && Math.abs(e.ry) < 0.05 && fxT - e.seen > 1.5) enemyFx.delete(id)
  }
  fxStats.enemyFx = enemyFx.size
  fxStats.enemyFlash = nFlash
  fxStats.enemyFlashMean = enemyFx.size ? sFlash / enemyFx.size : 0
  fxStats.enemyDot = nDot
  fxStats.recoilNonZero = nRecoil
  fxStats.recoilMax = maxRecoil
  for (const [id, s2] of sentinelFx) {
    s2.muzzle = Math.max(0, s2.muzzle - dt)
    s2.proc = Math.max(0, s2.proc - dt)
    s2.rx *= rk
    s2.ry *= rk
    if (s2.muzzle <= 0 && s2.proc <= 0 && fxT - s2.seen > 3) sentinelFx.delete(id)
  }

  base.hurt = Math.max(0, base.hurt - dt)
  if (base.lost >= 0) base.lost += dt

  fxStats.particles = pn
  fxStats.decals = decals.length
  fxStats.floaters = floaters.length
  fxStats.arcs = arcs.length
}

// ── emitters ────────────────────────────────────────────────────────────────

/** A Sentinel fires: muzzle flash, three sparks, and the shooter's own recoil. */
export function fxMuzzle(id: string, x: number, y: number, angle: number, color: string): void {
  const s = sfx(id)
  s.muzzle = MUZZLE_SECONDS
  s.muzzleAngle = angle
  if (reducedMotion) return
  // Item 7: the player recoils when firing. 2.2 logical px, gone in ~0.1s.
  s.rx = -Math.cos(angle) * 2.2
  s.ry = -Math.sin(angle) * 2.2
  const n = degrade(3)
  for (let i = 0; i < n; i++) {
    const p = take()
    if (!p) break
    const a = angle + rnd(-0.4, 0.4)
    const sp = rnd(40, 105)
    init(p, SPARK, x + Math.cos(angle) * 9, y + Math.sin(angle) * 9, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.1, 0.2), 1.6, 0, color)
    p.d = 6
  }
}

/**
 * A shot lands. The seven Sakurai "hit mark" conditions in one call: bright,
 * high contrast, exactly at the point of contact, several elements layered
 * (ring + sparks + dust), short-held, and — because it is thrown *outward along
 * the shot* — never sitting flat on top of the character it hit.
 */
export function fxImpact(x: number, y: number, dx: number, dy: number, opts: { crit?: boolean; splash?: number; color?: string }): void {
  fxStats.impacts++
  if (reducedMotion) return
  const crit = !!opts.crit
  const col = crit ? '#ffd166' : (opts.color ?? '#fff3d6')
  const dirA = Math.atan2(dy, dx)

  const ring = take()
  if (ring) {
    init(ring, RING, x, y, 0, 0, crit ? 0.26 : 0.17, crit ? 5 : 3.5, 0, col)
    ring.r2 = opts.splash && opts.splash > 0 ? opts.splash : crit ? 26 : 15
  }

  const n = degrade(crit ? 10 : 5)
  for (let i = 0; i < n; i++) {
    const p = take()
    if (!p) break
    const a = dirA + rnd(-1.05, 1.05)
    const sp = rnd(60, crit ? 210 : 140)
    init(p, SPARK, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rnd(0.13, crit ? 0.34 : 0.24), crit ? 2.2 : 1.5, 0, col)
    p.g = 130
    p.d = 3.4
  }
  const dn = degrade(crit ? 3 : 2)
  for (let i = 0; i < dn; i++) {
    const p = take()
    if (!p) break
    init(p, DUST, x, y, rnd(-22, 22), rnd(-26, 4), rnd(0.2, 0.34), 1.6, crit ? 6 : 4, 'rgba(226,206,172,0.35)')
  }
  if (opts.splash && opts.splash > 0) {
    sheetBurst(x, y, FX_EXPLOSION, 1, 20)
    fxTrauma(0.07, 0.34)
  }
}

/**
 * Register the white flash + drawn knockback for one **discrete impact**.
 *
 * Only a shot, a splash, a splinter or a chain may call this. Continuous
 * attrition calls {@link fxDotEnemy} instead — see the note on `DOT_GAP` for
 * why conflating the two erased every readability channel on a burning enemy.
 *
 * `RECOIL_PX` is the documented ceiling and is now actually reachable. It was
 * `Math.min(3.4, 1.9 * strength)` with no call site passing `strength > 1`, so
 * the real ceiling was 1.9 px, not the 3.4 the scorecard claimed — and since
 * `blitPixmap` rounds the destination to whole logical px, a full-strength hit
 * moved the sprite by two px and the 0.25-strength attrition tick that was
 * overwriting it moved it by none. `strength` now scales the ceiling itself:
 * a normal hit is the full 3.4, a boss 1.7, a chained enemy 1.36.
 */
const RECOIL_PX = 3.4
export function fxHitEnemy(id: string, dx: number, dy: number, strength = 1): void {
  const e = efx(id)
  e.flash = HIT_FLASH_SECONDS
  fxStats.hits++
  if (reducedMotion) return
  const l = Math.hypot(dx, dy) || 1
  const k = RECOIL_PX * Math.min(1, strength)
  e.rx = (dx / l) * k
  e.ry = (dy / l) * k
}

/**
 * One tick of damage-over-time landed on this enemy — burn, thorns or a trap.
 *
 * Deliberately the quietest tell in the set, and deliberately **not** a hit: no
 * white silhouette, no knockback, and rate-limited to a pulse so sixty ticks a
 * second and three ticks a second look the same. It exists so a DoT build is
 * not invisible, not so it competes.
 */
export function fxDotEnemy(id: string): void {
  const e = efx(id)
  if (fxT - e.dotAt < DOT_GAP) {
    fxStats.dotsThrottled++
    return
  }
  e.dotAt = fxT
  e.dot = DOT_PULSE_SECONDS
  fxStats.dots++
}

export type DeathClass = 'torch' | 'tnt' | 'barrel' | 'other'

/**
 * The death beat — "the single most important feedback in the game" (Berbece),
 * and until this pass it was an `Array.prototype.splice`.
 *
 * Clarity and spectacle, per class: a torch goblin comes apart in embers and
 * fire, a TNT goblin detonates the charge it was carrying, a barrel bursts into
 * wood and dust. Every one of them leaves a **corpse**: the unit's own baked
 * frame, darkened, fading over five and a half real seconds under a splat
 * decal, so the lane carries a record of the fight instead of forgetting it the
 * frame the enemy dies (item 8, permanence).
 */
export function fxKill(
  id: string,
  x: number,
  y: number,
  o: { cls: DeathClass; boss: boolean; typeId: string; radius: number; color: string },
): void {
  fxStats.kills++
  enemyFx.delete(id)
  if (reducedMotion) return
  const big = o.boss
  const R = Math.max(9, o.radius)

  // The corpse + the pop, as one decal: white silhouette flash for 0.14s, then
  // the body settles and fades.
  const art = corpseArt(o.typeId, o.boss)
  if (decals.length >= MAX_DECALS) decals.shift()
  decals.push({
    x,
    y,
    t: 0,
    life: big ? 8 : 5.5,
    pm: art?.pm ?? null,
    frame: art?.frame ?? 0,
    feet: art?.feet ?? 0,
    col: o.color,
    r: R,
    pop: 0.14,
    ringCol: o.cls === 'torch' ? '#ffb14a' : o.cls === 'tnt' ? '#ffd166' : '#fff3d6',
  })

  const burst = degrade(big ? 20 : 9)
  for (let i = 0; i < burst; i++) {
    const p = take()
    if (!p) break
    const a = rnd(0, Math.PI * 2)
    const sp = rnd(35, big ? 190 : 125)
    if (o.cls === 'torch') {
      init(p, EMBER, x, y - R * 0.3, Math.cos(a) * sp, Math.sin(a) * sp - 30, rnd(0.3, 0.7), rnd(1.4, 2.6), 0, i % 3 ? '#ff8a3c' : '#ffd166')
      p.g = 70
      p.d = 1.8
    } else if (o.cls === 'barrel') {
      init(p, CHUNK, x, y - R * 0.3, Math.cos(a) * sp, Math.sin(a) * sp - 55, rnd(0.4, 0.85), rnd(1.6, 3.2), 0, i % 2 ? '#8a5a32' : '#6b4526')
      p.g = 340
      p.vrot = rnd(-9, 9)
    } else {
      init(p, SPARK, x, y - R * 0.3, Math.cos(a) * sp, Math.sin(a) * sp - 40, rnd(0.2, 0.45), rnd(1.4, 2.4), 0, i % 3 ? '#fff3d6' : o.color)
      p.g = 200
      p.d = 2.6
    }
  }
  const dn = degrade(big ? 6 : 3)
  for (let i = 0; i < dn; i++) {
    const p = take()
    if (!p) break
    init(p, SMOKE, x + rnd(-R * 0.5, R * 0.5), y - rnd(0, R * 0.5), rnd(-16, 16), rnd(-34, -12), rnd(0.5, 1.0), rnd(3, 5), big ? 16 : 11, 'rgba(38,26,16,0.42)')
  }

  if (o.cls === 'tnt' || big) sheetBurst(x, y - R * 0.3, FX_EXPLOSION, big ? 2 : 1, big ? 30 : 16)
  if (o.cls === 'torch') sheetBurst(x, y - R * 0.4, FX_FIRE, 1, 10)

  if (big) {
    fxTrauma(0.42)
  } else if (o.cls === 'tnt') {
    fxTrauma(0.08, 0.4)
  }
}

/** A Sentinel falls. Loudest non-terminal event in a wave. */
export function fxDown(x: number, y: number): void {
  if (reducedMotion) return
  fxTrauma(0.22)
  const n = degrade(12)
  for (let i = 0; i < n; i++) {
    const p = take()
    if (!p) break
    const a = rnd(0, Math.PI * 2)
    init(p, SPARK, x, y, Math.cos(a) * rnd(30, 130), Math.sin(a) * rnd(30, 130) - 40, rnd(0.25, 0.55), 2, 0, i % 2 ? '#e05a4f' : '#fff3d6')
    p.g = 260
    p.d = 2.2
  }
  for (let i = 0; i < degrade(3); i++) {
    const p = take()
    if (!p) break
    init(p, SMOKE, x + rnd(-6, 6), y, rnd(-12, 12), rnd(-30, -14), rnd(0.6, 1.1), 4, 13, 'rgba(224,90,79,0.30)')
  }
}

/** Something reached the line. The base takes it, visibly. */
export function fxLeak(bx: number, by: number, frac: number): void {
  fxStats.leaks++
  base.frac = frac
  base.hurt = 0.55
  if (reducedMotion) return
  fxTrauma(0.34)
  const n = degrade(14)
  for (let i = 0; i < n; i++) {
    const p = take()
    if (!p) break
    const a = rnd(-Math.PI, 0)
    init(p, CHUNK, bx + rnd(-14, 14), by + rnd(-10, 10), Math.cos(a) * rnd(40, 150), Math.sin(a) * rnd(60, 190), rnd(0.4, 0.9), rnd(1.4, 3), 0, i % 3 ? '#5c7fa8' : '#98c1d9')
    p.g = 430
    p.vrot = rnd(-8, 8)
  }
  const r = take()
  if (r) {
    init(r, RING, bx, by, 0, 0, 0.34, 10, 0, '#e05a4f')
    r.r2 = 60
  }
}

/** The run-loss moment. */
export function fxDefeat(bx: number, by: number): void {
  base.lost = 0
  base.frac = 0
  if (reducedMotion) return
  fxTrauma(1)
  sheetBurst(bx, by, FX_EXPLOSION, 3, 44)
  sheetBurst(bx, by - 8, FX_FIRE, 2, 22)
  for (let i = 0; i < degrade(26); i++) {
    const p = take()
    if (!p) break
    const a = rnd(-Math.PI, 0.2)
    init(p, CHUNK, bx + rnd(-20, 20), by + rnd(-16, 12), Math.cos(a) * rnd(60, 260), Math.sin(a) * rnd(90, 300), rnd(0.7, 1.5), rnd(1.6, 3.6), 0, i % 3 ? '#3d5a80' : '#98c1d9')
    p.g = 470
    p.vrot = rnd(-11, 11)
  }
  for (let i = 0; i < degrade(8); i++) {
    const p = take()
    if (!p) break
    init(p, SMOKE, bx + rnd(-18, 18), by + rnd(-10, 6), rnd(-24, 24), rnd(-46, -18), rnd(1.2, 2.2), 6, 20, 'rgba(30,20,12,0.5)')
  }
}

/** Keep the standing base-damage state current (cracks, smoke, fire). */
export function fxBaseFrac(frac: number): void {
  base.frac = frac
}

/** One chain-lightning arc, from the struck enemy to a chained one. */
export function fxArc(x0: number, y0: number, x1: number, y1: number): void {
  fxStats.arcsMade++
  if (arcs.length >= MAX_ARCS) arcs.shift()
  arcs.push({ x0, y0, x1, y1, t: 0, life: 0.24, seed: (Math.random() * 65535) | 0 })
  if (reducedMotion) return
  for (let i = 0; i < degrade(3); i++) {
    const p = take()
    if (!p) break
    const a = rnd(0, Math.PI * 2)
    init(p, SPARK, x1, y1, Math.cos(a) * rnd(30, 90), Math.sin(a) * rnd(30, 90), rnd(0.12, 0.24), 1.6, 0, '#bfe9ff')
    p.d = 5
  }
}

/**
 * Which of the four procs a Sentinel just fired.
 *
 * They shared one yellow ring — shock, execute, burn and stun, four mechanics
 * with different costs, different builds and different tells, rendered
 * identically. Each has its own colour AND its own ring geometry now (see
 * `drawProcRing` in `renderer.ts`), so the channel survives a colour-vision
 * difference and a phone-sized sprite.
 */
export function fxProc(id: string, kind: Exclude<ProcKind, null>, x: number, y: number): void {
  const s = sfx(id)
  s.proc = PROC_SECONDS
  s.procKind = kind
  if (reducedMotion) return
  const col = kind === 'shock' ? '#bfe9ff' : kind === 'burn' ? '#ff8a3c' : kind === 'execute' ? '#ff5d5d' : '#ffe08a'
  for (let i = 0; i < degrade(4); i++) {
    const p = take()
    if (!p) break
    const a = rnd(0, Math.PI * 2)
    init(p, SPARK, x, y - 4, Math.cos(a) * rnd(24, 70), Math.sin(a) * rnd(24, 70) - 20, rnd(0.18, 0.36), 1.7, 0, col)
    p.d = 3
    p.g = 40
  }
}

/** A damage number or a word, on the real-time clock. */
export function fxFloater(x: number, y: number, text: string, color: string, kind: number): void {
  fxStats.floatersMade++
  if (floaters.length >= MAX_FLOATERS) floaters.shift()
  floaters.push({
    x,
    y,
    vy: kind === F_CRIT ? -44 : kind === F_WORD ? -40 : -34,
    t: 0,
    // REAL seconds, and the same at every play speed — this is H20's visual half.
    life: kind === F_CRIT ? 1.45 : kind === F_WORD ? 1.55 : 1.15,
    text,
    col: color,
    k: kind,
  })
}
export const FLOAT_NUM = F_NUM
export const FLOAT_CRIT = F_CRIT
export const FLOAT_WORD = F_WORD

// ── internals ───────────────────────────────────────────────────────────────

function init(p: P, k: number, x: number, y: number, vx: number, vy: number, life: number, r: number, r2: number, col: string): void {
  p.k = k
  p.x = x
  p.y = y
  p.vx = vx
  p.vy = vy
  p.t = 0
  p.life = life
  p.r = r
  p.r2 = r2
  p.a = 1
  p.g = 0
  p.d = 0
  p.col = col
  p.rot = 0
  p.vrot = 0
  p.sheet = -1
  p.fps = 14
}

/** Place `n` frames of an effect sheet, scattered inside `spread` logical px. */
function sheetBurst(x: number, y: number, sheet: number, n: number, spread: number): void {
  const pm = sheetPm(sheet)
  if (!pm) return
  for (let i = 0; i < n; i++) {
    const p = take()
    if (!p) break
    const fps = sheet === FX_FIRE ? 12 : 18
    init(p, SHEET, x + (i ? rnd(-spread, spread) : 0), y + (i ? rnd(-spread * 0.5, spread * 0.5) : 0), 0, sheet === FX_FIRE ? -8 : 0, pm.frames / fps, 0, 0, '#fff')
    p.sheet = sheet
    p.fps = fps
  }
}

/**
 * The dying unit's OWN baked frame, so the corpse is that goblin rather than a
 * generic body. Deliberately not `fx/tinyswords/dead.png` — that strip is a
 * *knight* death, and a knight corpse where a goblin fell is worse feedback
 * than none: it fails Berbece's first test, clarity.
 */
function corpseArt(typeId: string, boss: boolean): { pm: Pixmap; frame: number; feet: number } | null {
  const style = getActiveStyle()
  const pack = style.sprites?.pack
  if (!pack) return null
  const sc = boss ? 1 : (style.sprites?.spriteScale ?? 1)
  const frames = ANIM_FRAMES[`${typeId}_walk`]
  const walk = frames ? getSprite(pack, `${typeId}_walk`) : undefined
  if (walk && frames) {
    const pm = pixmap(walk, { scale: sc, frames, ring: true })
    if (pm) return { pm, frame: (Math.random() * frames) | 0, feet: 0 }
  }
  const still = getSprite(pack, typeId)
  if (still) {
    const pm = pixmap(still, { scale: sc, ring: true })
    if (pm) return { pm, frame: 0, feet: 0 }
  }
  return null
}

// ── drawing ─────────────────────────────────────────────────────────────────

/**
 * Everything that belongs UNDER the units: corpses and ground splats.
 *
 * Drawn before the enemies and towers so a fresh body never occludes a live
 * unit — Sakurai's "make the character stand out" applied to permanence.
 */
export function drawFxDecals(ctx: CanvasRenderingContext2D): void {
  for (const d of decals) {
    const k = d.t / d.life
    // Hold, then fade over the last 55% of the life.
    const a = k < 0.45 ? 1 : 1 - (k - 0.45) / 0.55
    ctx.save()
    // Ground splat.
    ctx.globalAlpha = a * 0.34
    ctx.fillStyle = 'rgba(24,14,8,1)'
    ctx.beginPath()
    ctx.ellipse(d.x, d.y + d.r * 0.5, d.r * 0.95, d.r * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()

    if (d.pm) {
      const pm = d.pm
      const dx = Math.round(d.x - pm.fw / 2)
      const dy = Math.round(d.y + d.r * 0.5 - pm.fh) + 3
      const sx = d.frame * pm.fw
      ctx.globalAlpha = a * 0.5
      ctx.drawImage(pm.img, sx, 0, pm.fw, pm.fh, dx, dy, pm.fw, pm.fh)
      // Darken the body so it reads as a fallen thing rather than as a live
      // unit standing very still — the silhouette is baked once per sprite
      // (`shadeOf`), so this is one more 1:1 blit and no per-frame compositing.
      const sh = shadeOf(pm)
      if (sh) {
        ctx.globalAlpha = a * 0.55
        ctx.drawImage(sh, sx, 0, pm.fw, pm.fh, dx, dy, pm.fw, pm.fh)
      }
    }

    // The kill pop: a white silhouette flash and an expanding ring, for the
    // first 0.14s only.
    if (d.t < d.pop) {
      const q = d.t / d.pop
      if (d.pm) {
        const pm = d.pm
        const dx = Math.round(d.x - pm.fw / 2)
        const dy = Math.round(d.y + d.r * 0.5 - pm.fh)
        ctx.globalAlpha = 1 - q
        ctx.globalCompositeOperation = 'source-over'
        const fl = flashOf(pm)
        if (fl) ctx.drawImage(fl, d.frame * pm.fw, 0, pm.fw, pm.fh, dx, dy, pm.fw, pm.fh)
      }
      ctx.globalAlpha = (1 - q) * 0.85
      ctx.strokeStyle = d.ringCol
      ctx.lineWidth = 2.5 * (1 - q) + 0.6
      ctx.beginPath()
      ctx.arc(d.x, d.y, d.r * (0.5 + q * 1.9), 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }
}

/** Particles and arcs — over the units, under the floaters. */
export function drawFxParticles(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < pn; i++) {
    const p = pool[i]
    const k = p.t / p.life
    const fade = 1 - k
    switch (p.k) {
      case SPARK: {
        // Stretched along velocity: a dot has no direction and a streak does,
        // which is the whole difference between "a pixel appeared" and "the hit
        // threw something".
        const sp = Math.hypot(p.vx, p.vy)
        const len = Math.min(9, sp * 0.026)
        ctx.globalAlpha = fade
        ctx.strokeStyle = p.col
        ctx.lineWidth = p.r * (0.4 + fade * 0.6)
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - (p.vx / (sp || 1)) * len, p.y - (p.vy / (sp || 1)) * len)
        ctx.stroke()
        break
      }
      case EMBER: {
        ctx.globalAlpha = fade * (0.65 + 0.35 * Math.sin(p.t * 34))
        ctx.fillStyle = p.col
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * fade + 0.4, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case DUST: {
        ctx.globalAlpha = fade * fade * 0.5
        ctx.fillStyle = p.col
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r + (p.r2 - p.r) * k, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case SMOKE: {
        ctx.globalAlpha = fade * 0.7
        ctx.fillStyle = p.col
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r + (p.r2 - p.r) * k, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case CHUNK: {
        ctx.globalAlpha = fade
        ctx.fillStyle = p.col
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillRect(-p.r, -p.r * 0.72, p.r * 2, p.r * 1.44)
        ctx.restore()
        break
      }
      case RING: {
        const rr = p.r + (p.r2 - p.r) * (1 - fade * fade)
        ctx.globalAlpha = fade * 0.9
        ctx.strokeStyle = p.col
        ctx.lineWidth = 1 + fade * 2
        ctx.beginPath()
        ctx.arc(p.x, p.y, rr, 0, Math.PI * 2)
        ctx.stroke()
        break
      }
      case SHEET: {
        const pm = sheetPm(p.sheet)
        if (!pm) break
        const f = Math.min(pm.frames - 1, Math.floor(p.t * p.fps))
        ctx.globalAlpha = 1
        ctx.drawImage(
          pm.img,
          f * pm.fw,
          0,
          pm.fw,
          pm.fh,
          Math.round(p.x - pm.fw / 2),
          Math.round(p.y - pm.fh / 2),
          pm.fw,
          pm.fh,
        )
        break
      }
    }
  }
  ctx.globalAlpha = 1

  // --- chain lightning -----------------------------------------------------
  for (const a of arcs) {
    const fade = 1 - a.t / a.life
    drawBolt(ctx, a, fade)
  }
  ctx.globalAlpha = 1
}

/**
 * A chain-lightning bolt.
 *
 * The game's most spectacular proc drew **nothing** — `engine.ts` resolved the
 * chain, the damage landed on enemies across the lane, and the only cue was a
 * yellow ring on the tower that fired. A player could not attribute the kill,
 * could not tell shock from burn, and could not see that the enchant was doing
 * anything at all. Two strokes: a wide soft blue halo, then a thin white core,
 * on a jitter polyline seeded per arc so it flickers without dancing.
 */
function drawBolt(ctx: CanvasRenderingContext2D, a: Arc, fade: number): void {
  const dx = a.x1 - a.x0
  const dy = a.y1 - a.y0
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const segs = 5
  // A cheap integer hash so each arc has a stable but different shape, and the
  // shape re-rolls slowly over the arc's life so the bolt crackles.
  let h = (a.seed + Math.floor(a.t * 45) * 2654435761) >>> 0
  const nxt = () => {
    h = (h * 1664525 + 1013904223) >>> 0
    return h / 4294967296
  }
  const amp = Math.min(16, len * 0.16)
  ctx.beginPath()
  ctx.moveTo(a.x0, a.y0)
  for (let i = 1; i < segs; i++) {
    const t = i / segs
    const o = (nxt() * 2 - 1) * amp * Math.sin(t * Math.PI)
    ctx.lineTo(a.x0 + dx * t + nx * o, a.y0 + dy * t + ny * o)
  }
  ctx.lineTo(a.x1, a.y1)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = fade * 0.45
  ctx.strokeStyle = '#4aa8e0'
  ctx.lineWidth = 4.5
  ctx.stroke()
  ctx.globalAlpha = fade
  ctx.strokeStyle = '#eaf8ff'
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.globalAlpha = fade * 0.8
  ctx.fillStyle = '#eaf8ff'
  ctx.beginPath()
  ctx.arc(a.x1, a.y1, 3.2 * fade + 1, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * Damage numbers and words.
 *
 * Every floater used to render at a fixed `bold 13px` in gold or white, so a
 * crit was distinguishable from a normal hit only by hue — at a scale where the
 * text is 5 CSS px tall on a phone. Now a crit is **19 px, outlined, and pops
 * from 1.5× to 1.0× over its first 90 ms**, which is a size channel, a motion
 * channel and a contrast channel on top of the colour one. Every floater gets
 * the dark outline: they are drawn over grass, dirt, sprites and explosions,
 * and cream-on-anything is not legible without one.
 */
export function drawFxFloaters(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  for (const f of floaters) {
    const k = f.t / f.life
    const alpha = k < 0.62 ? 1 : 1 - (k - 0.62) / 0.38
    const size = f.k === F_CRIT ? 19 : f.k === F_WORD ? 15 : 13
    // Scale pop: overshoot in, settle. Applied by SIZE rather than by a canvas
    // scale so nothing else on the field is transformed.
    const pop = f.t < 0.09 ? 1 + 0.5 * (1 - f.t / 0.09) : 1
    ctx.globalAlpha = alpha
    ctx.font = `bold ${(size * pop).toFixed(1)}px system-ui, sans-serif`
    ctx.lineWidth = f.k === F_CRIT ? 3.4 : 2.6
    ctx.strokeStyle = 'rgba(24,14,7,0.88)'
    ctx.strokeText(f.text, f.x, f.y)
    ctx.fillStyle = f.col
    ctx.fillText(f.text, f.x, f.y)
  }
  ctx.restore()
}

/**
 * The white silhouette of a baked sprite, for hit flashes and the kill pop.
 *
 * Derived lazily from the ALREADY-baked strip (so it inherits the ×½ box filter
 * and the exact cell grid), cached on the Pixmap itself, and warm white rather
 * than pure white because `docs/BRAND.md` rules out cool chrome and a pure-white
 * flash on warm pixel art reads blue.
 */
const flashCache = new WeakMap<object, HTMLCanvasElement | null>()
const shadeCache = new WeakMap<object, HTMLCanvasElement | null>()
const emberCache = new WeakMap<object, HTMLCanvasElement | null>()

function silhouette(pm: Pixmap, color: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const w = pm.fw * pm.frames
  const h = pm.fh
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const cx = c.getContext('2d')
  if (!cx) return null
  cx.imageSmoothingEnabled = false
  cx.drawImage(pm.img as CanvasImageSource, 0, 0)
  // `source-in` against a scratch canvas that holds ONLY this sprite.
  // `source-atop` on the *field* canvas was the first attempt and it painted a
  // dark RECTANGLE over the grass instead of over the body: the field is opaque
  // everywhere, so "atop the destination" means atop all of it. Confining the
  // tint to its own canvas is what makes it a silhouette, and it is baked once
  // per sprite rather than composited per corpse per frame.
  cx.globalCompositeOperation = 'source-in'
  cx.fillStyle = color
  cx.fillRect(0, 0, w, h)
  return c
}

export function flashOf(pm: Pixmap): HTMLCanvasElement | null {
  const hit = flashCache.get(pm as unknown as object)
  if (hit !== undefined) return hit
  const out = silhouette(pm, '#fff6e4')
  flashCache.set(pm as unknown as object, out)
  return out
}

/**
 * The attrition tint: the unit's own silhouette in ember orange.
 *
 * Same bake, same cell grid, same 1:1 blit as `flashOf` — the only differences
 * are hue and the alpha it is drawn at (0.34 against 0.92), and those two
 * differences are the whole channel. A burning goblin now reads as *a goblin,
 * lit* rather than as a white blob, so faction silhouette, tier colour and the
 * torch's detached flame all survive the burn that used to erase them.
 */
export function emberOf(pm: Pixmap): HTMLCanvasElement | null {
  const hit = emberCache.get(pm as unknown as object)
  if (hit !== undefined) return hit
  const out = silhouette(pm, '#ff8a3c')
  emberCache.set(pm as unknown as object, out)
  return out
}

/** The corpse tint: the unit's own silhouette in warm near-black. */
export function shadeOf(pm: Pixmap): HTMLCanvasElement | null {
  const hit = shadeCache.get(pm as unknown as object)
  if (hit !== undefined) return hit
  const out = silhouette(pm, '#170e07')
  shadeCache.set(pm as unknown as object, out)
  return out
}
