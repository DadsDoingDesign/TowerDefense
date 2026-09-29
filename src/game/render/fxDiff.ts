/**
 * The FX differ: presentation events (impacts, hits, kills, leaks, procs, chain
 * arcs) derived from the engine's own public state either side of each `TICK`,
 * so the simulation never has to push events out — `npm run balance` stays
 * byte-identical by construction.
 *
 * One `FxDiffer` per battle: `BattleCanvas` makes a fresh one whenever a new
 * engine mounts (`new FxDiffer(engine)`), and there is no module-level mutable
 * state here — every snapshot table and scratch set is an instance field. The
 * effects themselves go to `fx.ts` through an injectable `FxSink`, which is
 * what lets `tests/fxDiff.test.ts` drive it on synthetic engine snapshots.
 */
import { takenMult, TICK, type GameEngine, type RtSentinel } from '../engine/engine'
import type { EffectMods } from '../types'
import {
  FLOAT_CRIT,
  FLOAT_NUM,
  FLOAT_WORD,
  fxArc,
  fxBaseFrac,
  fxDefeat,
  fxDotEnemy,
  fxDown,
  fxFloater,
  fxHitEnemy,
  fxHitstop,
  fxImpact,
  fxKill,
  fxLeak,
  fxMuzzle,
  fxProc,
  fxTrauma,
  type DeathClass,
  type ProcKind,
} from './fx'
import { baseAnchor } from './overlays'

/** Where the differ sends what it finds. Defaults to the real `fx.ts` layer. */
export interface FxSink {
  fxFloater: typeof fxFloater
  fxMuzzle: typeof fxMuzzle
  fxDown: typeof fxDown
  fxHitstop: typeof fxHitstop
  fxHitEnemy: typeof fxHitEnemy
  fxTrauma: typeof fxTrauma
  fxImpact: typeof fxImpact
  fxArc: typeof fxArc
  fxProc: typeof fxProc
  fxDotEnemy: typeof fxDotEnemy
  fxLeak: typeof fxLeak
  fxKill: typeof fxKill
  fxBaseFrac: typeof fxBaseFrac
  fxDefeat: typeof fxDefeat
}
const FX_SINK: FxSink = {
  fxFloater, fxMuzzle, fxDown, fxHitstop, fxHitEnemy, fxTrauma, fxImpact, fxArc, fxProc, fxDotEnemy, fxLeak, fxKill, fxBaseFrac, fxDefeat,
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
   * The two multipliers `damageEnemy` applies to everything that reaches this
   * enemy — `engine.takenMult`, i.e. resistance, the shield-bearer's aura and
   * brittle — snapshotted because attrition has to be re-derived with them
   * (see `tookDiscreteDamage`). The engine freezes the aura and brittle at the
   * END of a tick, so the values read here are exactly the ones the next tick
   * uses. Before Phase 3a these were the raw resistances and the arithmetic
   * was `1 - resist`; `takenMult` returns that same double when no aura or
   * frost is in play.
   */
  physMult: number
  magMult: number
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

/** Squared distance. */
export const d2 = (ax: number, ay: number, bx: number, by: number) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by)

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
export const ATTRITION_EPS = 1e-6

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
export function soleProc(mods: EffectMods): ProcKind {
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

export function deathClass(typeId: string): DeathClass {
  if (typeId.startsWith('torch')) return 'torch'
  if (typeId.startsWith('tnt')) return 'tnt'
  if (typeId.startsWith('barrel')) return 'barrel'
  return 'other'
}

/**
 * The exact HP a live burn removes in one tick: `burnDps * TICK`, times the
 * taken-multiplier of the burn's own damage type — the same two products, in the same order, as
 * `damageEnemy`, so it agrees with the engine to the ulp (see `snapBefore`).
 * `tickElapsed` is the clock the tick about to run compares against.
 */
export function burnToll(
  e: { burnDps: number; burnUntil: number; burnType: 'physical' | 'magic' },
  tickElapsed: number,
  physMult: number,
  magMult: number,
): number {
  return e.burnDps > 0 && tickElapsed < e.burnUntil
    ? e.burnDps * TICK * (e.burnType === 'physical' ? physMult : magMult)
    : 0
}

/**
 * The predicate at the heart of `tookDiscreteDamage` (C1), on plain numbers:
 * did an enemy lose more than its own exact attrition toll this tick? A
 * vanished enemy (`hpAfter === undefined`) counts as damaged — kills and leaks
 * are settled with better evidence in step 6.
 */
export function isDiscreteDrop(hpBefore: number, hpAfter: number | undefined, atr: number): boolean {
  if (hpAfter === undefined) return true
  const drop = hpBefore - hpAfter
  if (drop <= 0) return false
  return drop > atr + ATTRITION_EPS
}

export class FxDiffer {
  private readonly eSnap: ESnap[] = []
  /** `eSnap` by id, so the attrition pass can find an enemy without a scan. */
  private readonly snapById = new Map<string, ESnap>()
  private readonly pSnap: PSnap[] = []
  private readonly sSnapDowned = new Map<string, boolean>()
  private readonly seenFloaters = new Set<string>()
  /** Scratch, refilled per tick. */
  private readonly removed: ESnap[] = []
  private readonly procOf = new Map<string, ProcKind>()
  /** Post-tick HP by id; a vanished enemy is ABSENT (not zero). Built per tick. */
  private readonly hpNow = new Map<string, number>()
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
  private readonly nxNow = new Map<string, number>()
  private readonly nyNow = new Map<string, number>()
  private readonly direct = new Set<string>()
  private readonly chainCands: ESnap[] = []
  /** Projectile ids still alive after the tick. Cleared and refilled, not rebuilt. */
  private readonly liveP = new Set<string>()
  /**
   * Enemies given a DISCRETE hit this tick. Step 5 skips them, which is what
   * stops a burn tick from overwriting the directional knockback a shot just
   * wrote (C2) — `fxHitEnemy` assigns rather than accumulates, and step 5 ran
   * afterwards with no exclusion.
   */
  private readonly hitThisTick = new Set<string>()
  /**
   * Enemies that left the field BEFORE `updateProjectiles` ran — leaks and
   * attrition kills, both of which happen in `updateEnemies`. See `candidate`.
   */
  private readonly goneBefore = new Set<string>()
  /**
   * Vanished enemies an earlier projectile in THIS tick has already been credited
   * with. A body can only be killed once, so it can only appear in one hit list.
   */
  private readonly goneClaimed = new Set<string>()
  /** Scratch for the attrition pass: sentinels by id, and each enemy's blocker. */
  private readonly sentById = new Map<string, RtSentinel>()
  private readonly blockerOf = new Map<string, string>()

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
  private readonly wordKind: string[] = []
  private readonly wordX: number[] = []
  private readonly wordY: number[] = []
  private wordN = 0

  private prevLeakHeads = 0
  private prevStatus: string = 'running'

  /** Arm the differ for a fresh engine (one differ per battle / wave). */
  constructor(
    engine: GameEngine,
    private readonly sink: FxSink = FX_SINK,
  ) {
    this.prevLeakHeads = engine.leakCount
    this.prevStatus = engine.status
    for (const f of engine.floaters) this.seenFloaters.add(f.id)
  }

  /**
   * Claim the nearest unclaimed `kind` word within `r` of (x, y).
   *
   * Consuming the match matters: two towers with execute mods hitting two
   * different enemies in the same tick must not both claim the one EXECUTE.
   */
  private takeWord(kind: string, x: number, y: number, r: number): boolean {
    let best = -1
    let bestD = r * r
    for (let i = 0; i < this.wordN; i++) {
      if (this.wordKind[i] !== kind) continue
      const d = d2(this.wordX[i], this.wordY[i], x, y)
      if (d <= bestD) {
        bestD = d
        best = i
      }
    }
    if (best < 0) return false
    this.wordKind[best] = ''
    return true
  }

  /** Snapshot the engine BEFORE one `TICK`. */
  snapBefore(engine: GameEngine): void {
    this.eSnap.length = 0
    this.snapById.clear()
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
      const physMult = takenMult(e, 'physical')
      const magMult = takenMult(e, 'magic')
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
        physMult,
        magMult,
        // `updateEnemies` runs `damageEnemy(e, e.burnDps * dt, …, e.burnType)`,
        // and `damageEnemy` deals `amount * takenMult(e, type)`. Same two
        // products, in the same order, against the same doubles — so this is the
        // burn's exact toll, not a bound on it.
        atr: burnToll(e, tickElapsed, physMult, magMult),
      }
      this.eSnap.push(snap)
      this.snapById.set(e.id, snap)
    }
    this.pSnap.length = 0
    for (const p of engine.projectiles) {
      this.pSnap.push({
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
    this.sSnapDowned.clear()
    for (const s of engine.sentinels) this.sSnapDowned.set(s.id, s.downed)
    this.prevStatus = engine.status
  }

  /**
   * Where this enemy is NOW — post-tick if it survived the tick, otherwise the
   * last position anything knows about it.
   *
   * The engine resolves impacts against post-tick positions (`updateEnemies`
   * precedes `updateProjectiles`), so any reconstruction of a splash or a
   * splinter radius has to use the same ones or it includes and excludes
   * different neighbours than the engine did.
   */
  private ex(e: ESnap): number {
    return this.nxNow.get(e.id) ?? e.x
  }
  private ey(e: ESnap): number {
    return this.nyNow.get(e.id) ?? e.y
  }

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
  private tookDiscreteDamage(e: ESnap): boolean {
    return isDiscreteDrop(e.hp, this.hpNow.get(e.id), e.atr)
  }

  /**
   * Add one continuous source's exact toll to an enemy's attrition budget.
   *
   * The resist lookup mirrors `damageEnemy`'s exactly — physical damage meets
   * `physResist`, magic meets `magResist` — which is the whole point: a trap laid
   * by a mystic and a fighter's thorns are resisted differently by the same
   * enemy, and both differently again from the burn already on the snapshot.
   */
  private addAttrition(id: string, amount: number, type: 'physical' | 'magic'): void {
    const s = this.snapById.get(id)
    if (!s) return
    s.atr += amount * (type === 'physical' ? s.physMult : s.magMult)
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
  private candidate(e: ESnap): boolean {
    if (this.hpNow.has(e.id)) return true
    return !this.goneBefore.has(e.id) && !this.goneClaimed.has(e.id)
  }

  /** Read the difference AFTER the tick and fire the presentation events it implies. */
  diffAfter(engine: GameEngine, speed: number): void {
    // One pass builds the post-tick HP and POSITION tables every branch below
    // reads; anything in the pre-tick roster that is missing from them is gone.
    this.hpNow.clear()
    this.nxNow.clear()
    this.nyNow.clear()
    for (const e of engine.enemies) {
      // A shaman's heal this tick is added back out, so a heal can never mask
      // the hit it landed alongside (the heal is not damage, so it is not
      // attrition either — it is simply not part of the drop).
      this.hpNow.set(e.id, e.hp - (e.healed ?? 0))
      this.nxNow.set(e.id, e.pos.x)
      this.nyNow.set(e.id, e.pos.y)
    }
    this.hitThisTick.clear()

    // --- 0a. the tick's exact continuous damage ------------------------------
    // The burn half is already on the snapshot (`snapBefore` — it is settled by
    // pre-tick state). Thorns and traps are settled by what the tick DID, so they
    // are read off the engine now, when those answers are final.
    this.sentById.clear()
    for (const s of engine.sentinels) this.sentById.set(s.id, s)
    this.blockerOf.clear()
    // `blockedBy` is the exact answer for anything still standing, and it outlives
    // its blocker being downed mid-tick — `downSentinel` empties `blockIds` AFTER
    // that tick's thorns have already been dealt, so the blocker's own list is the
    // one thing that cannot be trusted there.
    for (const e of engine.enemies) if (e.blockedBy) this.blockerOf.set(e.id, e.blockedBy)
    // …and for anything the tick removed, the blocker's list is all that is left
    // to name it. `assignBlocking` rebuilds these arrays every tick, so they hold
    // this tick's holds and no older ones.
    for (const s of engine.sentinels) {
      for (const id of s.blockIds) if (!this.blockerOf.has(id)) this.blockerOf.set(id, s.id)
    }
    for (const id of this.blockerOf.keys()) {
      const s = this.sentById.get(this.blockerOf.get(id)!)
      if (!s || s.profile.thorns <= 0) continue
      this.addAttrition(id, s.profile.thorns * TICK, s.profile.damageType)
    }
    const trapR2 = TRAP_RADIUS * TRAP_RADIUS
    for (const t of engine.traps) {
      const amt = t.dps * TICK
      for (const e of engine.enemies) {
        if (d2(e.pos.x, e.pos.y, t.pos.x, t.pos.y) > trapR2) continue
        this.addAttrition(e.id, amt, t.damageType)
      }
    }

    // --- 0b. what the tick removed, and whether it was still there for the shots
    // Hoisted above step 3 (it used to live in step 6) because `candidate` needs
    // the leak split BEFORE any impact is reconstructed.
    this.removed.length = 0
    for (const e of this.eSnap) if (!this.hpNow.has(e.id)) this.removed.push(e)
    // `leakCount` is a HEAD count and `leaks` is DAMAGE — the tough leakers cost
    // several points each, so the split is read off the head count or a two-point
    // leaker would be reported as two breaches (F3).
    const leakHeads = this.removed.length
      ? Math.min(this.removed.length, Math.max(0, engine.leakCount - this.prevLeakHeads))
      : 0
    this.prevLeakHeads = engine.leakCount
    if (leakHeads > 0) this.removed.sort((a, b) => b.dist - a.dist)
    this.goneBefore.clear()
    this.goneClaimed.clear()
    for (let i = 0; i < this.removed.length; i++) {
      const e = this.removed[i]
      // A leak and an attrition kill both resolve inside `updateEnemies`, before
      // any projectile moves. `e.hp <= e.atr` is not a guess: it says this tick's
      // own exact DoT toll was at least the whole of what the body had left.
      if (i < leakHeads || e.hp <= e.atr + ATTRITION_EPS) this.goneBefore.add(e.id)
    }

    // --- 1. new floaters, mirrored onto the REAL-time clock (H20) ------------
    // The engine's own copies keep decaying in game time and keep expiring;
    // these are the ones that get drawn, and they live the same number of REAL
    // seconds at 1× and at 3×.
    this.wordN = 0
    for (const f of engine.floaters) {
      if (this.seenFloaters.has(f.id)) continue
      this.seenFloaters.add(f.id)
      const word = f.text === 'EXECUTE' || f.text === 'STUN' || f.text === 'DOWN'
      if (f.text === 'EXECUTE' || f.text === 'STUN') {
        // Recorded WITH its position, so step 3 can attribute it to one impact
        // rather than letting it relabel every tower on the field.
        this.wordKind[this.wordN] = f.text
        this.wordX[this.wordN] = f.pos.x
        this.wordY[this.wordN] = f.pos.y
        this.wordN++
      }
      const crit = !word && f.color === '#ffd166'
      this.sink.fxFloater(f.pos.x, f.pos.y, f.text, f.color, word ? FLOAT_WORD : crit ? FLOAT_CRIT : FLOAT_NUM)
    }
    if (this.seenFloaters.size > 400) {
      this.seenFloaters.clear()
      for (const f of engine.floaters) this.seenFloaters.add(f.id)
    }

    // --- 2. shots fired ------------------------------------------------------
    for (const s of engine.sentinels) {
      if (s.fireFlash === 1) this.sink.fxMuzzle(s.id, s.pos.x, s.pos.y, s.aimAngle, s.def.accent)
      if (s.downed && this.sSnapDowned.get(s.id) === false) {
        this.sink.fxDown(s.pos.x, s.pos.y)
        this.sink.fxHitstop(0.09, speed)
      }
    }

    // --- 3. impacts ----------------------------------------------------------
    this.procOf.clear()
    this.liveP.clear()
    for (const p of engine.projectiles) this.liveP.add(p.id)
    for (const p of this.pSnap) {
      if (this.liveP.has(p.id)) continue
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
      const lx = p.targetId !== null ? this.nxNow.get(p.targetId) : undefined
      const ix = lx !== undefined ? lx : p.tx
      const iy = lx !== undefined ? this.nyNow.get(p.targetId!)! : p.ty
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
      this.direct.clear()
      let origin: ESnap | null = null
      if (p.splash > 0) {
        const r2 = p.splash * p.splash
        for (const e of this.eSnap) {
          if (!this.candidate(e)) continue
          if (d2(this.ex(e), this.ey(e), ix, iy) <= r2) {
            this.direct.add(e.id)
            if (!origin) origin = e
          }
        }
      } else if (p.targetId) {
        for (const e of this.eSnap) {
          if (e.id === p.targetId) {
            // A single-target shot whose target left the field mid-flight hits
            // NOTHING: `impact()` gets `primary === undefined` and builds an empty
            // hit list. Leaving the corpse in drew a full impact for a shot that
            // landed on bare ground.
            if (!this.candidate(e)) break
            this.direct.add(e.id)
            origin = e
            break
          }
        }
      }
      if (p.pierce > 0) {
        const r2 = PIERCE_RADIUS * PIERCE_RADIUS
        let extra = 0
        for (const e of this.eSnap) {
          if (extra >= p.pierce) break
          if (this.direct.has(e.id)) continue
          if (!this.candidate(e)) continue
          if (d2(this.ex(e), this.ey(e), ix, iy) <= r2) {
            this.direct.add(e.id)
            extra++
          }
        }
      }

      let anyHit = false
      for (const e of this.eSnap) {
        if (!this.direct.has(e.id)) continue
        if (!this.tookDiscreteDamage(e)) continue
        anyHit = true
        this.hitThisTick.add(e.id)
        if (!this.hpNow.has(e.id)) this.goneClaimed.add(e.id)
        this.sink.fxHitEnemy(e.id, this.ex(e) - ix || dirx, this.ey(e) - iy || diry, e.boss ? 0.5 : 1)
        if (e.boss) {
          // Ceilinged: a boss takes many hits a second and an uncapped 0.05 each
          // becomes a permanent wobble rather than an impact (see `fxTrauma`).
          this.sink.fxTrauma(0.05, 0.42)
          this.sink.fxHitstop(0.05, speed)
        }
      }
      if (anyHit || p.targetId === null) {
        this.sink.fxImpact(ix, iy, dirx, diry, { crit: p.crit, splash: p.splash })
        if (p.crit) this.sink.fxHitstop(0.045, speed)
      }

      // Chain lightning — the arcs the game never drew.
      if (p.shockChains > 0 && origin) {
        const o = origin
        const ox = this.ex(o)
        const oy = this.ey(o)
        this.chainCands.length = 0
        // `impact()` chains from `this.enemies.filter(e => !hitList.includes(e))`
        // — the LIVE roster minus what the blast already took. Same two filters.
        for (const e of this.eSnap) if (!this.direct.has(e.id) && this.candidate(e)) this.chainCands.push(e)
        this.chainCands.sort((a, b) => d2(ox, oy, this.ex(a), this.ey(a)) - d2(ox, oy, this.ex(b), this.ey(b)))
        const n = Math.min(p.shockChains, this.chainCands.length)
        for (let i = 0; i < n; i++) {
          const c = this.chainCands[i]
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
          if (!this.tookDiscreteDamage(c)) continue
          if (!this.hpNow.has(c.id)) this.goneClaimed.add(c.id)
          this.hitThisTick.add(c.id)
          this.sink.fxArc(ox, oy - 4, this.ex(c), this.ey(c) - 4)
          this.sink.fxHitEnemy(c.id, this.ex(c) - ox, this.ey(c) - oy, 0.4)
        }
        this.procOf.set(p.src, 'shock')
      }
      if (p.hasBurn && !this.procOf.has(p.src)) this.procOf.set(p.src, 'burn')
      // A word is claimed by the impact it landed near, not by the tick.
      const wordR = Math.max(p.splash, 0) + 26
      if (p.hasStun && this.takeWord('STUN', ix, iy, wordR)) this.procOf.set(p.src, 'stun')
      if (p.hasExecute && this.takeWord('EXECUTE', ix, iy, wordR)) this.procOf.set(p.src, 'execute')
    }

    // --- 4. which proc fired -------------------------------------------------
    // No fallback guess: an unattributable proc draws NOTHING. `soleProc` is not
    // a guess — it is the only proc the tower carries.
    for (const s of engine.sentinels) {
      if (s.procFlash !== 1) continue
      const kind = this.procOf.get(s.id) ?? soleProc(s.profile.mods)
      if (kind) this.sink.fxProc(s.id, kind, s.pos.x, s.pos.y)
    }

    // --- 5. attrition: damage with no projectile behind it -------------------
    // Burn, thorns, traps. Deliberately the quietest tell in the set and
    // deliberately NOT a hit: no white silhouette, no knockback, and rate-limited
    // to a pulse inside `fxDotEnemy`, because the engine applies these every
    // single tick and a continuous signal drawn continuously is a constant.
    for (const e of this.eSnap) {
      const now = this.hpNow.get(e.id)
      if (now === undefined || now >= e.hp) continue
      if (this.hitThisTick.has(e.id)) continue
      this.sink.fxDotEnemy(e.id)
    }

    // --- 6. kills and leaks --------------------------------------------------
    // `removed` and `leakHeads` were both settled in step 0b, sorted furthest-
    // along-first when there are leaks to split off, exactly as they were here.
    if (this.removed.length) {
      for (let i = 0; i < this.removed.length; i++) {
        const e = this.removed[i]
        if (i < leakHeads) {
          // Not `map.base`: on both shipped maps that point is off the drawn
          // field (see `baseAnchor`). The breach is shown where it is visible.
          const a = baseAnchor(engine.map)
          this.sink.fxLeak(a.x, a.y, Math.max(0, engine.baseHp) / engine.maxBaseHp)
          this.sink.fxHitstop(0.075, speed)
        } else {
          this.sink.fxKill(e.id, e.x, e.y, {
            cls: deathClass(e.typeId),
            boss: e.boss,
            typeId: e.typeId,
            radius: e.radius,
            color: e.color,
          })
          this.sink.fxHitstop(e.boss ? 0.13 : e.radius >= 15 ? 0.06 : 0.035, speed)
        }
      }
    }

    // --- 7. the base ---------------------------------------------------------
    this.sink.fxBaseFrac(Math.max(0, engine.baseHp) / engine.maxBaseHp)
    if (engine.status === 'defeated' && this.prevStatus !== 'defeated') {
      const a = baseAnchor(engine.map)
      this.sink.fxDefeat(a.x, a.y)
      this.sink.fxHitstop(0.15, speed)
    }
    this.prevStatus = engine.status
  }
}
