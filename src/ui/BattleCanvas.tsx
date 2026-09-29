import { useEffect, useRef } from 'react'
import { computeCombat } from '../game/engine/combat'
import { MAX_STEPS_PER_FRAME, TICK, type GameEngine, type RtSentinel } from '../game/engine/engine'
import {
  baseAnchor,
  drawBattleEntities,
  drawField,
  drawRange,
  drawSentinel,
  drawSlot,
  fitView,
  setPresentationTime,
  setViewScale,
  type DrawSentinel,
} from '../game/render/renderer'
import type { EffectMods } from '../game/types'
import {
  FLOAT_CRIT,
  FLOAT_NUM,
  FLOAT_WORD,
  fxAdvance,
  fxArc,
  fxBaseFrac,
  fxDefeat,
  fxDotEnemy,
  fxDown,
  fxFloater,
  fxHitEnemy,
  fxHitstop,
  fxHitstopLeft,
  fxImpact,
  fxKill,
  fxLeak,
  fxMuzzle,
  fxPreload,
  fxProc,
  fxReset,
  fxShake,
  fxStats,
  fxTrauma,
  setFxReducedMotion,
  type DeathClass,
  type ProcKind,
} from '../game/render/fx'
import { dist } from '../game/core/vec'
import { getActiveStyle } from '../game/render/themes'
import { placedSentinels, useGameStore } from '../state/gameStore'
import { useSettingsStore } from '../state/settingsStore'
import { reportFatal } from './fatal'

/**
 * Slot hit geometry (M2).
 *
 * `SLOT_HIT_RADIUS` is in the map's LOGICAL space — a 960×560 field — and the
 * shell draws that field into ~390×387 CSS px, a scale of ~0.406. So 26 logical
 * px is **10.6 CSS px of radius on a phone**: a 21px target for the core
 * placement gesture of the game, under a quarter of the 44px floor. Measured
 * before the fix by tapping at increasing offsets from a slot centre: 9px off
 * still landed, 11px off missed.
 *
 * The fix is not a bigger fixed radius — that would scale wrong on every other
 * viewport — but a floor expressed in the units the finger actually lives in.
 * `SLOT_HIT_SCREEN_RADIUS` is converted back through the live view scale each
 * tap, so the target is ~44px across whatever the field is squeezed to, and the
 * generous logical radius on a desktop-sized canvas is never *smaller* than the
 * original.
 */
const SLOT_HIT_RADIUS = 26
/**
 * Half of the touch target, in CSS pixels. 24 rather than 22 so the guarantee
 * is the 44px floor with margin rather than exactly on the boundary — measured,
 * a tap 22px off centre lands, which is what "44px target" has to mean.
 */
const SLOT_HIT_SCREEN_RADIUS = 24
/**
 * Ceiling on the converted radius, in logical px. Slots on the shipped map sit
 * ~95 logical px apart, so this lets neighbouring catchment areas meet (nearest
 * wins, so meeting is fine and is what "snapping" means) while still refusing a
 * tap that is simply nowhere near the build line.
 */
const SLOT_HIT_MAX_RADIUS = 80

/**
 * A subtle warm grade over the finished frame — the second post-process on the
 * field after the vignette (which is baked into the terrain now). One
 * `fillRect` in `overlay` at 6% pulls the composite together and answers the
 * brand's "warm storybook, no cool blue-grey" without touching any sprite.
 */
const GRADE = 'rgba(255,186,110,0.06)'

/**
 * ── `pixelated` vs `auto` is a per-viewport decision, not a global one (M3) ──
 *
 * The rejection of `image-rendering: pixelated` written into `app.css` reasons
 * entirely from one number: "960 → 780 nearest-neighbour discards 180 of 960
 * columns", i.e. the dpr-2 case at 390×844, where the composite really is being
 * MINIFIED and dropped columns really do delete a 1px sword. That argument is
 * correct and it is kept.
 *
 * It just does not apply to the other half of the matrix. The mapping ratio is
 * `view.scale × dpr`, and at **dpr 3 four of the five matrix viewports are
 * upscales** — 390×844 → 1.219×, 375×667 → 1.172×, 360×740 → 1.125×,
 * 360×640 → 1.055×. Nothing is discarded in an upscale; there is no "which
 * pixel survives" question to lose. What `auto` does there instead is smear a
 * frame that was composed at exactly 1.000 for the sole purpose of not being
 * smeared: measured on the same capture, it blurs the grass texture and softens
 * the baked `#161C2E`-class contour into the ground it is there to separate the
 * unit from. dpr-3 phones are the majority of current flagships, so that is the
 * common case, not the exotic one.
 *
 * So the property follows the ratio, and the two cases each get the answer that
 * was argued for them:
 *
 *   ratio ≥ 1  (upscale, e.g. any dpr-3 phone)  → `pixelated`, nothing to drop
 *   ratio < 1  (downscale, every dpr-1/2 phone) → `auto`, one filtered resample
 *
 * The CSS keeps `auto` as its declared value, which is both the correct default
 * for the downscale case and the right answer for the frames before the first
 * layout runs.
 */
function resampleMode(viewScale: number, dpr: number): 'pixelated' | 'auto' {
  return viewScale * dpr >= 1 ? 'pixelated' : 'auto'
}

/* ══════════════════════════════════════════════════════════════════════════
 * The tick differ — how presentation feedback is derived without an engine edit
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `npm run balance` must stay byte-identical, and the cheapest way to guarantee
 * that is not to touch the simulation at all. So nothing pushes events out of
 * `GameEngine`: instead this snapshots the engine's own public state either
 * side of a whole `TICK` and reads the difference.
 *
 * One tick is the right granularity, not one frame. At 3× a frame runs three
 * ticks, and a frame-level diff would lose the ordering (which shot hit which
 * enemy), merge two impacts into one, and miss an enemy that spawned, took a
 * hit and died inside a single frame. Diffing per tick recovers exactly what
 * the engine did, in the order it did it.
 *
 * What the difference tells us, and how:
 *
 * | event            | derived from                                            |
 * |------------------|---------------------------------------------------------|
 * | shot fired       | `fireFlash === 1` after the tick (`fire()` sets it, and   |
 * |                  | the decay is `dt*5`, so 1.0 exactly means "this tick")    |
 * | impact           | a projectile present before and absent after — the only  |
 * |                  | way `updateProjectiles` drops one is `arrived`           |
 * | enemy hit        | `hp` fell by MORE than continuous attrition can account  |
 * |                  | for, and a reconstructed projectile reaches it           |
 * | enemy worn down  | `hp` fell with no projectile behind it (burn/thorns/trap)|
 * | kill vs leak     | ids that disappeared, split by `leakCount`'s delta: the  |
 * |                  | N furthest-along vanishings are the leaks, the rest died |
 * | chain lightning  | the shock projectile's own `chains`/`dmgFrac`, resolved  |
 * |                  | the same way `impact()` does, then CONFIRMED against who |
 * |                  | actually took DISCRETE damage — so a drift in the        |
 * |                  | engine's selection shows up as a missing arc, never as a |
 * |                  | wrong one                                                |
 * | which proc fired | `procFlash === 1` plus the impacting projectile's mods   |
 * |                  | and a matching `EXECUTE`/`STUN` word floated NEAR THAT   |
 * |                  | IMPACT — never a tick-global flag, and never a guess     |
 * | Sentinel downed  | `downed` flipped                                         |
 * | base hit / loss  | `baseHp` fell / `status` became `'defeated'`             |
 *
 * ## Impact vs attrition — the distinction the first version did not draw
 *
 * `engine.ts` applies `burnDps * dt` on **every tick** a burn is live, and the
 * same holds for thorns and traps. "hp fell" is therefore true sixty times a
 * second for a burning enemy, and answering it with a hit made every burning
 * enemy a featureless white blob for the whole burn and overwrote every
 * directional knockback in the game with a straight-up 0.475 px nudge that
 * rounded to nothing (C1/C2). So the differ now classifies the drop before it
 * reacts to it: an enemy is HIT only if a reconstructed projectile reaches it
 * AND the drop exceeds what its own live DoTs could have produced this tick;
 * everything else is attrition and gets `fxDotEnemy`, which is a different
 * channel with a different colour, a different intensity and its own rate
 * limit.
 *
 * ## Allocation
 *
 * The particle pool, the decal ring, the snapshot arrays and every scratch Set
 * and Map below are allocated once and reused, so the per-tick and per-frame
 * work is bounded and steady. What a tick still allocates is proportional to
 * the EVENTS in it and nothing else: one record per floater, arc and decal
 * pushed, and the snapshot rows for enemies and projectiles the first time the
 * roster grows past its high-water mark. It is not zero — the earlier claim
 * that "a tick allocates nothing" was false — but it is bounded by what
 * happened rather than by how long the wave has been running.
 */

interface ESnap {
  id: string
  hp: number
  x: number
  y: number
  dist: number
  boss: boolean
  radius: number
  color: string
  typeId: string
  /**
   * The two resistances `damageEnemy` multiplies into everything that reaches
   * this enemy, snapshotted because attrition has to be re-derived with them —
   * see `tookDiscreteDamage`. They live on `e.type`, so they are already known
   * at snapshot time and cost nothing to carry.
   */
  physResist: number
  magResist: number
  /**
   * EXACTLY the HP this enemy's own continuous damage removed this tick: burn,
   * thorns and traps, each already multiplied by the resistance that source's
   * damage type meets on THIS enemy.
   *
   * Filled in two halves, because the two halves are decided at different
   * moments. The burn is settled by pre-tick state (`burnDps`, `burnUntil`,
   * `burnType` are all read by `updateEnemies` before anything can change them
   * this tick), so `snapBefore` computes it. Thorns and traps are decided by
   * what the tick DID — which enemies a fighter ended up holding, which ones
   * ended the tick inside a hazard — so `diffAfter` adds them.
   */
  atr: number
}
interface PSnap {
  id: string
  x: number
  y: number
  tx: number
  ty: number
  crit: boolean
  splash: number
  src: string
  targetId: string | null
  shockChains: number
  pierce: number
  hasBurn: boolean
  hasExecute: boolean
  hasStun: boolean
}

const PIERCE_RADIUS = 60 // mirrors GameEngine.PIERCE_RADIUS (private there)
/** mirrors TRAP_RADIUS in engine.ts (module-private there) */
const TRAP_RADIUS = 34

const eSnap: ESnap[] = []
/** `eSnap` by id, so the attrition pass can find an enemy without a scan. */
const snapById = new Map<string, ESnap>()
const pSnap: PSnap[] = []
const sSnapDowned = new Map<string, boolean>()
const seenFloaters = new Set<string>()
/** Scratch, refilled per tick. */
const removed: ESnap[] = []
const procOf = new Map<string, ProcKind>()
/** Post-tick HP by id; a vanished enemy is ABSENT (not zero). Built per tick. */
const hpNow = new Map<string, number>()
/**
 * Post-tick POSITION by id, as two number maps so a tick allocates no vectors.
 *
 * The engine runs `updateEnemies` before `updateProjectiles`, and
 * `updateProjectiles` re-homes every live projectile onto its target's current
 * position before moving it — so the point a shot actually landed on is the
 * target's POST-tick position, not the pre-tick `toPos` the snapshot carries.
 * Using the stale one put the impact ring, the sparks and the splash
 * reconstruction up to ~2.9 logical px off on a Swift Raid enemy, which at
 * splash radii of 9–16 px is enough to include or exclude a neighbour.
 */
const nxNow = new Map<string, number>()
const nyNow = new Map<string, number>()
const direct = new Set<string>()
const chainCands: ESnap[] = []
/** Projectile ids still alive after the tick. Cleared and refilled, not rebuilt. */
const liveP = new Set<string>()
/**
 * Enemies given a DISCRETE hit this tick. Step 5 skips them, which is what
 * stops a burn tick from overwriting the directional knockback a shot just
 * wrote (C2) — `fxHitEnemy` assigns rather than accumulates, and step 5 ran
 * afterwards with no exclusion.
 */
const hitThisTick = new Set<string>()
/**
 * Enemies that left the field BEFORE `updateProjectiles` ran — leaks and
 * attrition kills, both of which happen in `updateEnemies`. See `candidate`.
 */
const goneBefore = new Set<string>()
/**
 * Vanished enemies an earlier projectile in THIS tick has already been credited
 * with. A body can only be killed once, so it can only appear in one hit list.
 */
const goneClaimed = new Set<string>()
/** Scratch for the attrition pass: sentinels by id, and each enemy's blocker. */
const sentById = new Map<string, RtSentinel>()
const blockerOf = new Map<string, string>()

/**
 * The `EXECUTE` / `STUN` words the engine floated this tick, WITH where.
 *
 * They used to be two tick-global booleans, so in any tick where one tower
 * executed something, every other tower that merely *carries* an execute mod
 * had its proc ring relabelled — one tower's proc wearing another tower's
 * name. A word is spawned at the enemy it happened to, so matching it against
 * the impact point attributes it to the shot that caused it. Parallel arrays,
 * because this is per-tick and a `{text, pos}` per floater is not.
 */
const wordKind: string[] = []
const wordX: number[] = []
const wordY: number[] = []
let wordN = 0

let prevLeakHeads = 0
let prevStatus = 'running'

/**
 * Claim the nearest unclaimed `kind` word within `r` of (x, y).
 *
 * Consuming the match matters: two towers with execute mods hitting two
 * different enemies in the same tick must not both claim the one EXECUTE.
 */
function takeWord(kind: string, x: number, y: number, r: number): boolean {
  let best = -1
  let bestD = r * r
  for (let i = 0; i < wordN; i++) {
    if (wordKind[i] !== kind) continue
    const d = d2(wordX[i], wordY[i], x, y)
    if (d <= bestD) {
      bestD = d
      best = i
    }
  }
  if (best < 0) return false
  wordKind[best] = ''
  return true
}

/**
 * The one proc a Sentinel could possibly have fired, or `null` if it is not
 * decidable.
 *
 * A projectile that is created and arrives inside a single tick never appears
 * in `pSnap` at all, so the impact reconstruction has nothing to say about it —
 * and the code fell through to `procOf.get(s.id) ?? 'burn'`, painting an orange
 * burn ring for whatever had actually procced. By this layer's own rule — "a
 * wrong picture is worse than no picture" — the fallback has to be a no-op.
 * But it can be better than nothing for free: a tower carrying exactly one proc
 * mod can only have fired that one, and that is a fact about the tower rather
 * than a guess about the tick.
 */
function soleProc(mods: EffectMods): ProcKind {
  let k: ProcKind = null
  let n = 0
  if (mods.shock && mods.shock.chains > 0) {
    k = 'shock'
    n++
  }
  if (mods.burn) {
    k = 'burn'
    n++
  }
  if (mods.stunChance) {
    k = 'stun'
    n++
  }
  if (mods.execute) {
    k = 'execute'
    n++
  }
  return n === 1 ? k : null
}

function deathClass(typeId: string): DeathClass {
  if (typeId.startsWith('torch')) return 'torch'
  if (typeId.startsWith('tnt')) return 'tnt'
  if (typeId.startsWith('barrel')) return 'barrel'
  return 'other'
}

/** Re-arm the differ for a fresh engine. */
function fxArm(engine: GameEngine): void {
  eSnap.length = 0
  snapById.clear()
  pSnap.length = 0
  hpNow.clear()
  sSnapDowned.clear()
  seenFloaters.clear()
  prevLeakHeads = engine.leakCount
  prevStatus = engine.status
  for (const f of engine.floaters) seenFloaters.add(f.id)
}

function snapBefore(engine: GameEngine): void {
  eSnap.length = 0
  snapById.clear()
  /**
   * The clock the tick about to run will compare its DoTs against.
   *
   * `step()` does `this.elapsed += dt` as its FIRST statement, so a burn is
   * live for this tick iff `elapsed + TICK < burnUntil`. Testing the pre-
   * increment value kept a burn "live" in the snapshot for one tick past the
   * one the engine last billed it for — which, now that the burn term is
   * subtracted exactly, would have eaten one real hit per burn expiry.
   * `a += b` and `a + b` are the same IEEE double, so this is not an
   * approximation of the engine's clock, it is the engine's clock.
   */
  const tickElapsed = engine.elapsed + TICK
  for (const e of engine.enemies) {
    const physResist = e.type.physResist ?? 0
    const magResist = e.type.magResist ?? 0
    const snap: ESnap = {
      id: e.id,
      hp: e.hp,
      x: e.pos.x,
      y: e.pos.y,
      dist: e.distance,
      boss: !!e.type.isBoss,
      radius: e.type.radius,
      color: e.type.color,
      typeId: e.type.id,
      physResist,
      magResist,
      // `updateEnemies` runs `damageEnemy(e, e.burnDps * dt, …, e.burnType)`,
      // and `damageEnemy` deals `amount * (1 - resist)`. Same two products, in
      // the same order, against the same doubles — so this is the burn's exact
      // toll, not a bound on it.
      atr:
        e.burnDps > 0 && tickElapsed < e.burnUntil
          ? e.burnDps * TICK * (1 - (e.burnType === 'physical' ? physResist : magResist))
          : 0,
    }
    eSnap.push(snap)
    snapById.set(e.id, snap)
  }
  pSnap.length = 0
  for (const p of engine.projectiles) {
    pSnap.push({
      id: p.id,
      x: p.pos.x,
      y: p.pos.y,
      tx: p.toPos.x,
      ty: p.toPos.y,
      crit: p.isCrit,
      splash: p.splashRadius,
      src: p.srcId,
      targetId: p.targetId,
      shockChains: p.mods.shock?.chains ?? 0,
      pierce: p.pierce,
      hasBurn: !!p.mods.burn,
      hasExecute: !!p.mods.execute,
      hasStun: !!p.mods.stunChance,
    })
  }
  sSnapDowned.clear()
  for (const s of engine.sentinels) sSnapDowned.set(s.id, s.downed)
  prevStatus = engine.status
}

const d2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by)

/**
 * Where this enemy is NOW — post-tick if it survived the tick, otherwise the
 * last position anything knows about it.
 *
 * The engine resolves impacts against post-tick positions (`updateEnemies`
 * precedes `updateProjectiles`), so any reconstruction of a splash or a
 * splinter radius has to use the same ones or it includes and excludes
 * different neighbours than the engine did.
 */
const ex = (e: ESnap): number => nxNow.get(e.id) ?? e.x
const ey = (e: ESnap): number => nyNow.get(e.id) ?? e.y

/**
 * Float slack on the attrition comparison — NOT a damage budget.
 *
 * `drop` is `hp_before − hp_after`, read back off the engine's own doubles;
 * `atr` is the same arithmetic re-run here. The two agree to within a few ulps
 * of the enemy's HP — about 7e-13 even at a champion's 15,600 — so 1e-6 is a
 * million times the error it has to absorb and still six orders of magnitude
 * below the smallest damage anything in the game can deal. It can never eat a
 * hit, and it can never let a rounding artefact become one.
 */
const ATTRITION_EPS = 1e-6

/**
 * Did this enemy take damage from something OTHER than its own attrition?
 *
 * ── an upper bound is the wrong side of this inequality (C1) ────────────────
 *
 * The version this replaces subtracted `burnDps * TICK` and defended it as "a
 * strict UPPER bound on what the burn alone can have taken off — which is
 * exactly the property needed". It is a bound on the right quantity, argued
 * backwards. This test SUBTRACTS the bound, and every unit of slack in a
 * subtracted bound is a unit of real damage the predicate silently eats:
 *
 *     drop = attrition_actual + discrete        (a drop can be nothing else)
 *     drop > bound   ⇔   discrete > bound − attrition_actual
 *
 * With an UPPER bound the right-hand side is positive, so every hit smaller
 * than the slack is classified as attrition — the more generous the bound, the
 * more hits it swallows. Only a bound at or below the real toll drives that
 * right-hand side to ≤ 0. A LOWER bound is therefore the safe side for a test
 * that must not miss hits — and the one value that is safe in BOTH directions,
 * never eating a hit and never painting a burn tick as one, is the exact toll.
 *
 * The slack was not theoretical. `damageEnemy` resists burn by `e.burnType`;
 * this predicate did not. On a 55%-plated column an Incendiary burn at 180 dps
 * charged `180 × TICK = 3.000` of attrition per tick while the burn actually
 * removed `1.350` — 1.650 of over-charge, 3.3× the entire floor it was added
 * to. Measured against engine ground truth it swallowed 21 of 214 real hits
 * (9.8%), 8 of 134 impacts and 22 of 213 chain arcs, and step 5 then repainted
 * 40 of those swallowed hits as burn pulses, so a shot read as a burn. The same
 * team against an unarmoured column was clean at a +18.62 margin, which is what
 * identifies ARMOUR rather than the build as the trigger.
 *
 * So `atr` is not a bound at all any more. It is the engine's own arithmetic,
 * re-run: all three continuous sources — `updateSentinels` thorns,
 * `updateEnemies` burn, `updateTraps` — each multiplied by the resistance ITS
 * damage type meets on THIS enemy, in the same order of operations, so the two
 * agree to the ulp. That is what makes the predicate independent of the
 * magnitudes it used to be sensitive to: raising Incendiary's burn 45 → 180
 * (the rebalance that turned a 0.41 nuisance into a 1.65 defect) moves `atr`
 * and the real drop by the identical amount and the margin not at all. The same
 * holds for any future value, in either direction, and for thorns and trap dps
 * — none of which the old floor of 0.5 could have covered either: a Juggernaut
 * grinds 0.5/tick of thorns on its own and a Saboteur's trap another 0.5.
 *
 * A vanished enemy is treated as damaged: it is either a kill or a leak, and
 * both are handled in step 6 with far better evidence than this.
 */
function tookDiscreteDamage(e: ESnap): boolean {
  const now = hpNow.get(e.id)
  if (now === undefined) return true
  const drop = e.hp - now
  if (drop <= 0) return false
  return drop > e.atr + ATTRITION_EPS
}

/**
 * Add one continuous source's exact toll to an enemy's attrition budget.
 *
 * The resist lookup mirrors `damageEnemy`'s exactly — physical damage meets
 * `physResist`, magic meets `magResist` — which is the whole point: a trap laid
 * by a mystic and a fighter's thorns are resisted differently by the same
 * enemy, and both differently again from the burn already on the snapshot.
 */
function addAttrition(id: string, amount: number, type: 'physical' | 'magic'): void {
  const s = snapById.get(id)
  if (!s) return
  s.atr += amount * (1 - (type === 'physical' ? s.physResist : s.magResist))
}

/**
 * Was this enemy on the field when this tick's shots resolved? (minor 1)
 *
 * The comment this answers used to claim that "enemies that died earlier in the
 * tick are not in [`direct`]". They were: `eSnap` is the PRE-tick roster and
 * has no liveness filter at all, so a body that leaked or burned to death in
 * `updateEnemies` — which runs BEFORE `updateProjectiles` — stayed a candidate
 * for every shot that landed afterwards. Measured, 1–40 corpse memberships per
 * wave, 1–16 of which became the chain `origin`: an arc anchored to a dead
 * enemy's stale pre-tick position while the engine's own origin was `hitList[0]`
 * and alive.
 *
 * The three ways a body can leave the field split cleanly by WHEN:
 *
 *   • leak, or death by burn/thorns — `updateEnemies` / `updateSentinels`,
 *     both before projectiles. Never a candidate. Excluded.
 *   • death to an earlier projectile in this same tick — was a candidate for
 *     that shot and no other, because a body can only be killed once. First
 *     claim wins, and `pSnap` is in the engine's own projectile order.
 *   • death to a trap — `updateTraps` runs LAST, after every impact, so that
 *     body was still standing for all of them. Deliberately left in.
 */
function candidate(e: ESnap): boolean {
  if (hpNow.has(e.id)) return true
  return !goneBefore.has(e.id) && !goneClaimed.has(e.id)
}

function diffAfter(engine: GameEngine, speed: number): void {
  // One pass builds the post-tick HP and POSITION tables every branch below
  // reads; anything in the pre-tick roster that is missing from them is gone.
  hpNow.clear()
  nxNow.clear()
  nyNow.clear()
  for (const e of engine.enemies) {
    hpNow.set(e.id, e.hp)
    nxNow.set(e.id, e.pos.x)
    nyNow.set(e.id, e.pos.y)
  }
  hitThisTick.clear()

  // --- 0a. the tick's exact continuous damage ------------------------------
  // The burn half is already on the snapshot (`snapBefore` — it is settled by
  // pre-tick state). Thorns and traps are settled by what the tick DID, so they
  // are read off the engine now, when those answers are final.
  sentById.clear()
  for (const s of engine.sentinels) sentById.set(s.id, s)
  blockerOf.clear()
  // `blockedBy` is the exact answer for anything still standing, and it outlives
  // its blocker being downed mid-tick — `downSentinel` empties `blockIds` AFTER
  // that tick's thorns have already been dealt, so the blocker's own list is the
  // one thing that cannot be trusted there.
  for (const e of engine.enemies) if (e.blockedBy) blockerOf.set(e.id, e.blockedBy)
  // …and for anything the tick removed, the blocker's list is all that is left
  // to name it. `assignBlocking` rebuilds these arrays every tick, so they hold
  // this tick's holds and no older ones.
  for (const s of engine.sentinels) {
    for (const id of s.blockIds) if (!blockerOf.has(id)) blockerOf.set(id, s.id)
  }
  for (const id of blockerOf.keys()) {
    const s = sentById.get(blockerOf.get(id)!)
    if (!s || s.profile.thorns <= 0) continue
    addAttrition(id, s.profile.thorns * TICK, s.profile.damageType)
  }
  const trapR2 = TRAP_RADIUS * TRAP_RADIUS
  for (const t of engine.traps) {
    const amt = t.dps * TICK
    for (const e of engine.enemies) {
      if (d2(e.pos.x, e.pos.y, t.pos.x, t.pos.y) > trapR2) continue
      addAttrition(e.id, amt, t.damageType)
    }
  }

  // --- 0b. what the tick removed, and whether it was still there for the shots
  // Hoisted above step 3 (it used to live in step 6) because `candidate` needs
  // the leak split BEFORE any impact is reconstructed.
  removed.length = 0
  for (const e of eSnap) if (!hpNow.has(e.id)) removed.push(e)
  // `leakCount` is a HEAD count and `leaks` is DAMAGE — the tough leakers cost
  // several points each, so the split is read off the head count or a two-point
  // leaker would be reported as two breaches (F3).
  const leakHeads = removed.length
    ? Math.min(removed.length, Math.max(0, engine.leakCount - prevLeakHeads))
    : 0
  prevLeakHeads = engine.leakCount
  if (leakHeads > 0) removed.sort((a, b) => b.dist - a.dist)
  goneBefore.clear()
  goneClaimed.clear()
  for (let i = 0; i < removed.length; i++) {
    const e = removed[i]
    // A leak and an attrition kill both resolve inside `updateEnemies`, before
    // any projectile moves. `e.hp <= e.atr` is not a guess: it says this tick's
    // own exact DoT toll was at least the whole of what the body had left.
    if (i < leakHeads || e.hp <= e.atr + ATTRITION_EPS) goneBefore.add(e.id)
  }

  // --- 1. new floaters, mirrored onto the REAL-time clock (H20) ------------
  // The engine's own copies keep decaying in game time and keep expiring;
  // these are the ones that get drawn, and they live the same number of REAL
  // seconds at 1× and at 3×.
  wordN = 0
  for (const f of engine.floaters) {
    if (seenFloaters.has(f.id)) continue
    seenFloaters.add(f.id)
    const word = f.text === 'EXECUTE' || f.text === 'STUN' || f.text === 'DOWN'
    if (f.text === 'EXECUTE' || f.text === 'STUN') {
      // Recorded WITH its position, so step 3 can attribute it to one impact
      // rather than letting it relabel every tower on the field.
      wordKind[wordN] = f.text
      wordX[wordN] = f.pos.x
      wordY[wordN] = f.pos.y
      wordN++
    }
    const crit = !word && f.color === '#ffd166'
    fxFloater(f.pos.x, f.pos.y, f.text, f.color, word ? FLOAT_WORD : crit ? FLOAT_CRIT : FLOAT_NUM)
  }
  if (seenFloaters.size > 400) {
    seenFloaters.clear()
    for (const f of engine.floaters) seenFloaters.add(f.id)
  }

  // --- 2. shots fired ------------------------------------------------------
  for (const s of engine.sentinels) {
    if (s.fireFlash === 1) fxMuzzle(s.id, s.pos.x, s.pos.y, s.aimAngle, s.def.accent)
    if (s.downed && sSnapDowned.get(s.id) === false) {
      fxDown(s.pos.x, s.pos.y)
      fxHitstop(0.09, speed)
    }
  }

  // --- 3. impacts ----------------------------------------------------------
  procOf.clear()
  liveP.clear()
  for (const p of engine.projectiles) liveP.add(p.id)
  for (const p of pSnap) {
    if (liveP.has(p.id)) continue
    /**
     * `moveToward` arrived, so the impact point is where it was heading — and
     * where it was heading is the target's POST-tick position, because
     * `updateProjectiles` assigns `p.toPos = target.pos` after `updateEnemies`
     * has already moved it. The snapshot's `tx`/`ty` are one tick stale, which
     * is up to ~2.9 logical px on a Swift Raid enemy. Fall back to them only
     * when the target is gone (it died in this impact), where they are the last
     * position anything knows — and where `fxKill` uses the same one, so the
     * two effects at least agree with each other.
     */
    const lx = p.targetId !== null ? nxNow.get(p.targetId) : undefined
    const ix = lx !== undefined ? lx : p.tx
    const iy = lx !== undefined ? nyNow.get(p.targetId!)! : p.ty
    let dirx = ix - p.x
    let diry = iy - p.y
    if (dirx === 0 && diry === 0) {
      dirx = 1
      diry = 0
    }
    /**
     * The direct set, reconstructed exactly the way `impact()` builds its hit
     * list: the blast, then up to `pierce` more inside the splinter radius —
     * and measured against POST-tick positions, because that is the roster
     * `impact()` itself sees.
     *
     * `candidate` is what makes that last clause true. `impact()` scans
     * `this.enemies`, from which every leak and every earlier kill has already
     * been spliced; `eSnap` is the pre-tick roster and has none of them
     * removed, so without the filter a corpse joined the hit list and — worse —
     * became the chain `origin`, anchoring an arc to a position a tick old on a
     * body the engine had already buried. See `candidate` for the split.
     */
    direct.clear()
    let origin: ESnap | null = null
    if (p.splash > 0) {
      const r2 = p.splash * p.splash
      for (const e of eSnap) {
        if (!candidate(e)) continue
        if (d2(ex(e), ey(e), ix, iy) <= r2) {
          direct.add(e.id)
          if (!origin) origin = e
        }
      }
    } else if (p.targetId) {
      for (const e of eSnap) {
        if (e.id === p.targetId) {
          // A single-target shot whose target left the field mid-flight hits
          // NOTHING: `impact()` gets `primary === undefined` and builds an empty
          // hit list. Leaving the corpse in drew a full impact for a shot that
          // landed on bare ground.
          if (!candidate(e)) break
          direct.add(e.id)
          origin = e
          break
        }
      }
    }
    if (p.pierce > 0) {
      const r2 = PIERCE_RADIUS * PIERCE_RADIUS
      let extra = 0
      for (const e of eSnap) {
        if (extra >= p.pierce) break
        if (direct.has(e.id)) continue
        if (!candidate(e)) continue
        if (d2(ex(e), ey(e), ix, iy) <= r2) {
          direct.add(e.id)
          extra++
        }
      }
    }

    let anyHit = false
    for (const e of eSnap) {
      if (!direct.has(e.id)) continue
      if (!tookDiscreteDamage(e)) continue
      anyHit = true
      hitThisTick.add(e.id)
      if (!hpNow.has(e.id)) goneClaimed.add(e.id)
      fxHitEnemy(e.id, ex(e) - ix || dirx, ey(e) - iy || diry, e.boss ? 0.5 : 1)
      if (e.boss) {
        // Ceilinged: a boss takes many hits a second and an uncapped 0.05 each
        // becomes a permanent wobble rather than an impact (see `fxTrauma`).
        fxTrauma(0.05, 0.42)
        fxHitstop(0.05, speed)
      }
    }
    if (anyHit || p.targetId === null) {
      fxImpact(ix, iy, dirx, diry, { crit: p.crit, splash: p.splash })
      if (p.crit) fxHitstop(0.045, speed)
    }

    // Chain lightning — the arcs the game never drew.
    if (p.shockChains > 0 && origin) {
      const o = origin
      const ox = ex(o)
      const oy = ey(o)
      chainCands.length = 0
      // `impact()` chains from `this.enemies.filter(e => !hitList.includes(e))`
      // — the LIVE roster minus what the blast already took. Same two filters.
      for (const e of eSnap) if (!direct.has(e.id) && candidate(e)) chainCands.push(e)
      chainCands.sort((a, b) => d2(ox, oy, ex(a), ey(a)) - d2(ox, oy, ex(b), ey(b)))
      const n = Math.min(p.shockChains, chainCands.length)
      for (let i = 0; i < n; i++) {
        const c = chainCands[i]
        /**
         * Confirmed, and confirmed against the right question.
         *
         * "Did this enemy lose HP this tick" answered yes for two kinds of
         * enemy that were never chained: one already off the field before the
         * shot resolved, and any burning enemy at all, every tick. The first is
         * now settled by `candidate` — where it belongs, since it is a fact
         * about the roster and not about this arc — and the second by an exact
         * attrition figure rather than an inflated bound.
         *
         * What that leaves is the case the old `!hpNow.has(c.id)` guard threw
         * away wholesale (minor 2): an arc that KILLED what it chained to. Its
         * target is absent from `hpNow` for the best possible reason, and it is
         * the most legible chain event there is — in the stormcaller scenario
         * every single one of the arcs still missing after the C1 fix was one
         * of these. `candidate` has already ruled out the corpses that were
         * never candidates, so absence here means this arc did it.
         */
        if (!tookDiscreteDamage(c)) continue
        if (!hpNow.has(c.id)) goneClaimed.add(c.id)
        hitThisTick.add(c.id)
        fxArc(ox, oy - 4, ex(c), ey(c) - 4)
        fxHitEnemy(c.id, ex(c) - ox, ey(c) - oy, 0.4)
      }
      procOf.set(p.src, 'shock')
    }
    if (p.hasBurn && !procOf.has(p.src)) procOf.set(p.src, 'burn')
    // A word is claimed by the impact it landed near, not by the tick.
    const wordR = Math.max(p.splash, 0) + 26
    if (p.hasStun && takeWord('STUN', ix, iy, wordR)) procOf.set(p.src, 'stun')
    if (p.hasExecute && takeWord('EXECUTE', ix, iy, wordR)) procOf.set(p.src, 'execute')
  }

  // --- 4. which proc fired -------------------------------------------------
  // No fallback guess: an unattributable proc draws NOTHING. `soleProc` is not
  // a guess — it is the only proc the tower carries.
  for (const s of engine.sentinels) {
    if (s.procFlash !== 1) continue
    const kind = procOf.get(s.id) ?? soleProc(s.profile.mods)
    if (kind) fxProc(s.id, kind, s.pos.x, s.pos.y)
  }

  // --- 5. attrition: damage with no projectile behind it -------------------
  // Burn, thorns, traps. Deliberately the quietest tell in the set and
  // deliberately NOT a hit: no white silhouette, no knockback, and rate-limited
  // to a pulse inside `fxDotEnemy`, because the engine applies these every
  // single tick and a continuous signal drawn continuously is a constant.
  for (const e of eSnap) {
    const now = hpNow.get(e.id)
    if (now === undefined || now >= e.hp) continue
    if (hitThisTick.has(e.id)) continue
    fxDotEnemy(e.id)
  }

  // --- 6. kills and leaks --------------------------------------------------
  // `removed` and `leakHeads` were both settled in step 0b, sorted furthest-
  // along-first when there are leaks to split off, exactly as they were here.
  if (removed.length) {
    for (let i = 0; i < removed.length; i++) {
      const e = removed[i]
      if (i < leakHeads) {
        // Not `map.base`: on both shipped maps that point is off the drawn
        // field (see `baseAnchor`). The breach is shown where it is visible.
        const a = baseAnchor(engine.map)
        fxLeak(a.x, a.y, Math.max(0, engine.baseHp) / engine.maxBaseHp)
        fxHitstop(0.075, speed)
      } else {
        fxKill(e.id, e.x, e.y, {
          cls: deathClass(e.typeId),
          boss: e.boss,
          typeId: e.typeId,
          radius: e.radius,
          color: e.color,
        })
        fxHitstop(e.boss ? 0.13 : e.radius >= 15 ? 0.06 : 0.035, speed)
      }
    }
  }

  // --- 7. the base ---------------------------------------------------------
  fxBaseFrac(Math.max(0, engine.baseHp) / engine.maxBaseHp)
  if (engine.status === 'defeated' && prevStatus !== 'defeated') {
    const a = baseAnchor(engine.map)
    fxDefeat(a.x, a.y)
    fxHitstop(0.15, speed)
  }
  prevStatus = engine.status
}

/**
 * Owns the requestAnimationFrame loop. Draws the field every frame, steps the
 * engine during battle, and handles tap-to-place input during setup. Reads game
 * state via getState() so the loop never restarts on store updates.
 *
 * ## Why the field is composed offscreen (Phase 3)
 *
 * The battle used to be drawn straight onto the visible canvas under a
 * `dpr × view` transform. On the shipping phone that product is **0.8125** —
 * measured, not assumed — so every sprite draw was a non-integer minification,
 * and with `imageSmoothingEnabled = false` that is nearest-neighbour throwing
 * away 73–97% of each source. Because units move at sub-pixel positions, WHICH
 * pixels survived changed every frame: pixel crawl on everything in motion, and
 * a 6.30× density spread across one screen.
 *
 * So: compose the whole field into an offscreen canvas that is exactly the
 * logical field (960×560), where one source pixel is one destination pixel and
 * every `drawImage` is at scale 1.000 with smoothing OFF — then blit that one
 * finished frame down to the device with smoothing ON. One clean resample of a
 * composed image replaces ~30 per-sprite per-frame nearest-neighbour
 * minifications, and **not one gameplay coordinate moves**: the field is still
 * 960×560, the path, the build slots, tower range and every radius are
 * untouched, and `fitView` still does the letterboxing. The audit's alternative
 * — resizing the field to 780×662 so `dpr × view` came out at 1.0 — would have
 * moved the path and the slots, which is enemy travel time and tower coverage:
 * a balance change wearing an art fix's clothes.
 */
export function BattleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const hoverSlot = useRef<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    /** The VISIBLE context. It only ever does the one final blit. */
    const vctx = canvas.getContext('2d')!

    let cssW = 0
    let cssH = 0
    /** The dpr the current `image-rendering` decision was made against. */
    let lastDpr = 0

    /**
     * The canvas IS the composite.
     *
     * The backing store is the map's logical box — 960×560 — not `css × dpr`,
     * so inside `step` the transform is the identity and one source pixel is one
     * destination pixel for every sprite on the field. The element is then sized
     * in CSS to the letterboxed rect `fitView` would have produced, and the
     * browser compositor performs the single, filtered resample down to the
     * device.
     *
     * That resample used to be ours: composite offscreen, then
     * `drawImage(field, …)` with `imageSmoothingQuality`. Measured at 390×844,
     * that one call was **1.2 ms of a 1.5 ms frame** — more than everything else
     * put together, and more than the ~1000 path ops it had just replaced.
     * Handing the same resize to the compositor costs the main thread nothing
     * and is the operation hardware acceleration exists to do.
     *
     * `fitView` is untouched and still the authority: the element's own rect now
     * has the field's exact aspect, so the `ox`/`oy` it computes for hit-testing
     * come out at 0 and every existing tap path (including `dm-reach`'s and
     * `ws9-firstrun`'s slot maths, which do the same arithmetic against
     * `getBoundingClientRect`) stays correct with no change.
     */
    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      cssW = rect.width
      cssH = rect.height
      const map = useGameStore.getState().battleMap
      if (canvas.width !== map.width || canvas.height !== map.height) {
        canvas.width = map.width
        canvas.height = map.height
      }
      const view = fitView(cssW, cssH, map)
      canvas.style.width = `${map.width * view.scale}px`
      canvas.style.height = `${map.height * view.scale}px`
      // The renderer draws into the 960×560 composite and otherwise has no way
      // to know how hard that composite is about to be squeezed — which is how
      // the tier notch ended up at 1.11 CSS px on a 320×568 phone (M2).
      setViewScale(view.scale)
      lastDpr = window.devicePixelRatio || 1
      canvas.style.imageRendering = resampleMode(view.scale, lastDpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    // MUST stay byte-identical to the rotate-prompt query in overlays.css and
    // shell.css. Dropping a clause here does not just desync the prompt — it
    // freezes the sim on viewports that never see the prompt, with no way out.
    // The `max-height` clause is load-bearing: shell.css treats 501–720px-tall
    // landscape as a supported layout, so those devices must keep simulating.
    const rotated = window.matchMedia(
      '(orientation: landscape) and (max-height: 500px) and (max-width: 950px) and (pointer: coarse)',
    )

    let raf = 0
    let last = performance.now()
    let hudTimer = 0
    /** Leftover real time not yet consumed by a whole TICK. */
    let accumulator = 0
    /** Simulated seconds elapsed on screen — drives every looping animation. */
    let animTime = 0
    /** Identity of the engine the differ is armed against (a new wave re-arms). */
    let fxEngine: GameEngine | null = null

    // The effect sheets are fetched on mount, not at boot: 19 KB that the title
    // screen has no use for.
    fxPreload()
    // Live FX counters, alongside the `window.__game` the harnesses already
    // read. It is one frozen object of numbers and it is what makes claims
    // about particle counts, hitstop and reduced motion measurable rather than
    // asserted.
    ;(window as unknown as { __fx?: typeof fxStats }).__fx = fxStats

    /**
     * The unguarded body of one frame. Wrapped by `frame` below — a throw in
     * here used to freeze the battle silently forever, because rAF callbacks
     * are outside React and nothing was catching them (H21).
     */
    const step = (now: number) => {
      let dt = (now - last) / 1000
      last = now
      // A tab-out can hand us an enormous delta; cap the real time we bank.
      if (dt > 0.25) dt = 0.25

      // The rotate prompt only hides the field — rAF keeps firing behind it, so
      // without this a wave plays out, and can be lost, on a screen the player
      // cannot see. Freeze instead: nothing banks, so rotating back resumes
      // exactly where it stopped.
      if (rotated.matches) {
        accumulator = 0
        return
      }

      const st = useGameStore.getState()
      const { battleMap: map, engine, battlePhase: phase, speed } = st

      /**
       * The presentation layer runs on REAL time and is told about the reduced-
       * motion setting every frame (L11: the setting governed CSS only and never
       * reached the canvas). `fxAdvance` is called before anything is banked, so
       * shake and the hitstop budget keep moving even on a frozen frame.
       */
      setFxReducedMotion(useSettingsStore.getState().reducedMotion)
      fxAdvance(dt)

      // --- simulate ---
      // Fixed timestep (C2): the sim only ever advances in whole TICKs and play
      // speed multiplies how MANY ticks run, never their size — so 1×/2×/3× and
      // 30/60/144Hz all produce the identical battle.
      if (phase === 'battle' && engine) {
        if (engine !== fxEngine) {
          fxEngine = engine
          fxReset()
          fxArm(engine)
        }
        /**
         * ---- hitstop, and why it cannot desync the sim (Phase 3) -----------
         *
         * The freeze is bought by NOT BANKING real time, never by stalling
         * `engine.step`. The accumulator still only ever hands the sim whole
         * `TICK`s, in order, so the wave that plays is bit-for-bit the wave that
         * would have played — exactly the property that already lets 30 Hz,
         * 60 Hz and 144 Hz produce the identical battle. What changes is *when*
         * those ticks run in wall-clock terms, which is what a freeze frame is.
         *
         * Under reduced motion `fxHitstop` never grants anything, so this is a
         * no-op there.
         */
        if (fxHitstopLeft() > 0) dt = 0

        accumulator += dt
        let steps = 0
        while (accumulator >= TICK && steps < MAX_STEPS_PER_FRAME) {
          for (let i = 0; i < speed && engine.status === 'running'; i++) {
            // One diff per TICK, not per frame: at 3× a frame runs three ticks
            // and a frame-level diff would merge them.
            snapBefore(engine)
            engine.step(TICK)
            diffAfter(engine, speed)
          }
          accumulator -= TICK
          steps++
          animTime += TICK * speed
        }
        // Hit the ceiling with backlog still unconsumed: drop it instead of
        // spiralling deeper each frame.
        //
        // The `accumulator >= TICK` half matters (m-2). Without it, a frame that
        // happened to need exactly MAX_STEPS_PER_FRAME ticks threw away the
        // sub-tick remainder it had legitimately banked — so any hitch past
        // ~0.1s lost real sim time, and below ~10fps the sim ran permanently
        // slow because every frame ended at the ceiling with a live remainder.
        // Determinism is untouched: the sim still only ever advances in whole
        // TICKs, and this only decides whether a partial tick is carried.
        if (steps === MAX_STEPS_PER_FRAME && accumulator >= TICK) accumulator = 0

        hudTimer += dt
        if (hudTimer >= 0.1) {
          hudTimer = 0
          st.syncHud()
        }
        if (engine.status !== 'running') {
          st.syncHud()
          st.finishBattle()
        }
      } else {
        // Out of battle nothing is paused, so ambient animation runs on real time.
        animTime += dt
        accumulator = 0
      }
      setPresentationTime(animTime)

      // --- draw ---
      // The map can change under us (a new battle); keep the composite's box
      // and the element's letterbox in step with it.
      //
      // The dpr check is here rather than on a media-query listener because a
      // dpr change (browser zoom, a drag onto a second monitor) does not have
      // to change the element's size, so `ResizeObserver` can miss it entirely
      // — and dpr is half of the `pixelated`/`auto` decision above. One float
      // compare per frame, no allocation.
      if (canvas.width !== map.width || canvas.height !== map.height) resize()
      else if ((window.devicePixelRatio || 1) !== lastDpr) resize()
      // Identity transform: logical px ARE canvas px here, so every sprite blit
      // is 1:1 and smoothing has nothing to do. Left off so the procedural
      // fallback keeps its hard pixel edges.
      const ctx = vctx
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.imageSmoothingEnabled = getActiveStyle().smoothing

      /**
       * Screenshake, applied to the composite.
       *
       * The offset is whole logical px (see `fx.ts`), so the shaken frame stays
       * exactly on the pixel grid and every sprite is still a scale-1.000 blit.
       * The terrain is laid down ONCE UNSHAKEN first and then again under the
       * offset: the shifted copy covers all but a ≤7 px band, and that band
       * shows the unshaken terrain rather than the letterbox, so the field
       * never grows a black edge as it kicks. It costs one extra 960×560 blit,
       * on shake frames only.
       */
      const sh = fxShake()
      if (sh.on) {
        drawField(ctx, map)
        ctx.translate(sh.dx, sh.dy)
      }

      drawField(ctx, map)

      const liveEngine = st.engine
      if (phase === 'battle' && liveEngine) {
        // Show ranges faintly while the fight runs.
        for (const s of liveEngine.sentinels) {
          if (s.downed) continue
          drawRange(ctx, s.pos, s.profile.range, s.def.accent)
        }
        drawBattleEntities(ctx, liveEngine)
      } else {
        // Setup: slots + placed towers + range previews.
        const placed = placedSentinels(st.roster, st.placements)
        const occupied = new Set(placed.map((p) => p.slotId))
        for (const p of placed) {
          const slot = map.slots.find((s) => s.id === p.slotId)!
          const profile = computeCombat(p.sentinel)
          drawRange(ctx, slot.pos, profile.range, p.sentinel.accent)
        }
        for (const slot of map.slots) {
          if (occupied.has(slot.id)) continue
          const state =
            hoverSlot.current === slot.id
              ? 'hover'
              : st.selectedSentinelId
                ? 'selected'
                : 'empty'
          drawSlot(ctx, slot.pos, state)
        }
        for (const p of placed) {
          const slot = map.slots.find((s) => s.id === p.slotId)!
          const profile = computeCombat(p.sentinel)
          const ds: DrawSentinel = {
            id: p.sentinel.id,
            pos: slot.pos,
            archetype: p.sentinel.archetype,
            color: p.sentinel.color,
            accent: p.sentinel.accent,
            range: profile.range,
            aimAngle: 0,
            fireFlash: 0,
            hp: profile.maxHp,
            maxHp: profile.maxHp,
            downed: false,
            procFlash: 0,
            patienceStacks: 0,
            blocking: false,
          }
          drawSentinel(ctx, ds)
        }
      }

      // A subtle warm grade over the composed frame. The vignette that used to
      // be rebuilt here every frame is baked into the terrain now, so this is
      // the only per-frame post-process left — measured at 0.0 ms p50.
      // Applied under the identity transform so the grade covers the whole
      // canvas regardless of how far the shake has pushed the field.
      if (sh.on) ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalCompositeOperation = 'overlay'
      ctx.fillStyle = GRADE
      ctx.fillRect(0, 0, map.width, map.height)
      ctx.globalCompositeOperation = 'source-over'
    }

    const frame = (now: number) => {
      try {
        step(now)
      } catch (err) {
        // Surface the failure instead of dying silently: stop the loop and hand
        // it to the error boundary, which offers the last run snapshot back.
        reportFatal(err, 'battle-loop')
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // --- input (setup placement) ---
    /**
     * Client px → the map's logical space. Unchanged in substance: still
     * `clientX` against a live `getBoundingClientRect()`, which is what keeps
     * the mapping correct under the pinch-zoom Phase 1 restored (a visual
     * viewport zoom moves the rect, and reading it per-event is what tracks
     * it). It just also hands back the scale, because the hit test needs to
     * express its radius in screen units.
     */
    const toLogical = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      const st = useGameStore.getState()
      const view = fitView(rect.width, rect.height, st.battleMap)
      return {
        x: (clientX - rect.left - view.ox) / view.scale,
        y: (clientY - rect.top - view.oy) / view.scale,
        scale: view.scale,
      }
    }

    /**
     * Nearest slot within a radius that is at least 22 CSS px on screen.
     *
     * Nearest-wins rather than first-within-range, so two catchment areas that
     * overlap resolve to the one the finger was actually closer to — which is
     * what makes a radius bigger than half the slot spacing safe.
     */
    const hitSlot = (x: number, y: number, scale: number): string | null => {
      const st = useGameStore.getState()
      const radius = Math.min(
        SLOT_HIT_MAX_RADIUS,
        Math.max(SLOT_HIT_RADIUS, SLOT_HIT_SCREEN_RADIUS / Math.max(scale, 0.001)),
      )
      let best: { id: string; d: number } | null = null
      for (const slot of st.battleMap.slots) {
        const d = dist({ x, y }, slot.pos)
        if (d <= radius && (!best || d < best.d)) best = { id: slot.id, d }
      }
      return best?.id ?? null
    }

    const onPointerMove = (e: PointerEvent) => {
      const st = useGameStore.getState()
      if (st.battlePhase !== 'setup') {
        hoverSlot.current = null
        return
      }
      const { x, y, scale } = toLogical(e.clientX, e.clientY)
      hoverSlot.current = hitSlot(x, y, scale)
    }

    const onPointerDown = (e: PointerEvent) => {
      const st = useGameStore.getState()
      if (st.battlePhase !== 'setup') return
      const { x, y, scale } = toLogical(e.clientX, e.clientY)
      const slotId = hitSlot(x, y, scale)
      if (!slotId) return
      const occupied = st.placements[slotId]
      if (st.selectedSentinelId) {
        st.placeOnSlot(slotId)
      } else if (occupied) {
        // Clicking a placed tower inspects it — the legacy upgrade modal, or
        // the shell's Context panel on its Upgrades tab.
        st.focusTower(occupied)
      }
    }

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerleave', () => (hoverSlot.current = null))

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  return (
    <div className="battle-canvas-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} className="battle-canvas" />
    </div>
  )
}
