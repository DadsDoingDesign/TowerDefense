import { GamePath } from '../core/path'
import { hashSeed, nextId, RNG } from '../core/rng'
import { dist, distSq, moveToward, type Vec2 } from '../core/vec'
import { ENEMY_TYPES } from '../data/enemies'
import type { EffectMods, EnemyType, GameMap, Sentinel, Tactics, WaveDef } from '../types'
import { computeCombat, type CombatProfile } from './combat'

/**
 * The one true simulation tick (seconds). The sim only ever advances in whole
 * TICKs; play speed multiplies how MANY ticks run per frame, never their size,
 * so a battle resolves identically at 1×/2×/3× and at any framerate (C2).
 */
export const TICK = 1 / 60
/** Ceiling on accumulator catch-up steps per frame — avoids a spiral of death after a tab-out. */
export const MAX_STEPS_PER_FRAME = 6

const PATIENCE_INTERVAL = 3 // seconds per stack
const PATIENCE_PER_STACK = 0.04
const TRAP_RADIUS = 34
/** How often a Sentinel re-scores its target against the active focus tactic (H4). */
const RETARGET_INTERVAL = 0.45
/**
 * Life-drain scale: the mod value is a *rate coefficient*, not a share of the
 * hit — 0.5 life-drain heals the base for 1% of damage dealt. describe.ts states
 * this same number; keep the two in step (H5).
 */
const LIFEDRAIN_SCALE = 0.02

export interface RtSentinel {
  id: string
  def: Sentinel
  pos: Vec2
  slotId: string
  profile: CombatProfile
  cooldown: number
  targetId: string | null
  aimAngle: number
  fireFlash: number
  hp: number
  maxHp: number
  downed: boolean
  patienceTime: number
  patienceStacks: number
  patienceMax: number
  blockIds: string[]
  buffMult: number
  reduction: number
  kills: number
  damageDealt: number
  procFlash: number // pulses when an on-hit effect fires (visual feedback, M7)
  /** Seconds until this Sentinel re-scores its target against the focus tactic. */
  retargetIn: number
}

export interface RtEnemy {
  id: string
  type: EnemyType
  hp: number
  maxHp: number
  distance: number
  pos: Vec2
  hitFlash: number
  burnDps: number
  burnUntil: number
  /** Who owns the burn — so DoT kills award kill credit and XP (H3). */
  burnSrcId: string | undefined
  /** Burn inherits the applying tower's damage type, so resists apply honestly (M25). */
  burnType: 'physical' | 'magic'
  chillSlow: number
  chillUntil: number
  stunUntil: number
  blockedBy: string | null
}

export interface RtProjectile {
  id: string
  pos: Vec2
  toPos: Vec2
  targetId: string | null
  srcId: string
  damage: number
  damageType: 'physical' | 'magic'
  isCrit: boolean
  speed: number
  splashRadius: number
  pierce: number
  color: string
  mods: EffectMods
  lifedrain: number
}

export interface RtTrap {
  id: string
  pos: Vec2
  dps: number
  slow: number
  /** The Sentinel that laid it — trap kills credit their owner (H3). */
  srcId: string
  /**
   * The owner's damage type, carried on the trap.
   *
   * `updateTraps` used to pass a hardcoded `'physical'`. That is correct today
   * only by coincidence — every `trap` grant in `archetypeTree.ts` sits on the
   * rogue branch — and it would silently misresist the moment one landed on a
   * mystic, or on an item/mutation that can roll onto one. A burn already
   * carries its owner's type for exactly this reason (M25); a trap is the same
   * argument with the same answer.
   */
  damageType: 'physical' | 'magic'
}

export interface FloatingText {
  id: string
  pos: Vec2
  text: string
  color: string
  life: number
  maxLife: number
  vy: number
}

export type BattleStatus = 'running' | 'cleared' | 'defeated'

export interface BattleResult {
  status: 'cleared' | 'defeated'
  goldEarned: number
  /**
   * Base HP left, in WHOLE points, and the number the campaign carries forward.
   *
   * It reconciles with {@link leakDamage} by construction: with no lifedrain in
   * play it is exactly `baseHp at wave start − leakDamage`, so a summary that
   * prints "N left (−D)" against a starting base of S always satisfies
   * N = S − D. It used to be the raw simulated float, which under the assist
   * dial handed the campaign a fractional base for the rest of the run and made
   * the receipt disagree with itself by a point (F3).
   */
  baseHpLeft: number
  /**
   * Base-HP DAMAGE the line took, in whole points — **not** a head count.
   *
   * An enemy's `leak` value is how many points it costs, and the tough ones
   * cost several, so this is always ≥ the number that got through. Render it
   * next to "left"; render {@link enemiesLeaked} when you mean "how many
   * reached the line" (F3).
   */
  leakDamage: number
  /** @deprecated Kept as the historical name for {@link leakDamage}; identical value. */
  leaks: number
  /** How many enemies actually reached the line. A head count, not damage (F3). */
  enemiesLeaked: number
  downed: number
  enemiesKilled: number
  perSentinel: { id: string; kills: number; damageDealt: number; xpGained: number; downed: boolean }[]
}

export class GameEngine {
  readonly map: GameMap
  readonly path: GamePath
  readonly wave: WaveDef

  sentinels: RtSentinel[] = []
  enemies: RtEnemy[] = []
  projectiles: RtProjectile[] = []
  traps: RtTrap[] = []
  floaters: FloatingText[] = []

  baseHp: number
  maxBaseHp: number
  goldEarned = 0
  /** Base-HP damage taken from leaks, as simulated (fractional under assist). */
  leaks = 0
  /** How many enemies reached the line. A head count — `leaks` is the damage (F3). */
  leakCount = 0
  /** `baseHp` the wave started from, so the result can reconcile against it (F3). */
  private readonly startBaseHp: number
  /**
   * Optional sound/event hook (app supplies audio; the headless harness omits it).
   *
   * The vocabulary: `'shoot'` (a Sentinel fires), `'hit'` / `'crit'` (a
   * projectile lands — one per impact, not per enemy touched), `'kill'` (an
   * enemy dies), `'down'` (a Sentinel falls), `'leak'` (something reaches the
   * line).
   *
   * It is a plain string callback and nothing here ever reads a result from it,
   * which is what keeps the sim headless-safe and deterministic: the listener
   * cannot influence a roll, cannot consume the RNG, and does not exist at all
   * in `balance/harness.ts`.
   */
  private onEvent?: (e: string) => void
  downedCount = 0
  killCount = 0
  status: BattleStatus = 'running'
  elapsed = 0

  private spawnQueue: { typeId: string; at: number; hpMult: number }[]
  private spawnIndex = 0
  /** Combat stream: every roll that changes the outcome (crits, stuns, cooldown offsets). */
  private rng: RNG
  /** Cosmetic stream: floater jitter and friends, kept off the combat stream (C1). */
  private cosmeticRng: RNG
  private teamMods: EffectMods[]
  private enemyHpMult: number
  /**
   * Multiplier on the damage the base takes from a leak — the assist dial (M34).
   *
   * It is an *option*, not a store read, on purpose. The engine has to stay
   * reproducible from `(seed, options)` alone: the balance harness constructs it
   * directly in Node where `useSettingsStore` means nothing, and a replay must
   * reproduce the run it is replaying rather than the settings of whoever is
   * watching. So the caller that owns the settings (`gameStore.startWave`) reads
   * the dial and passes the number in; everything else gets 1 and is unaffected.
   */
  private baseDamageMul: number
  private tactics: Tactics
  private holdThreshold: number
  private xpGained = new Map<string, number>()
  /** Set when an enemy spawns, so every Sentinel re-scores its target that tick (H4). */
  private retargetDirty = false

  constructor(opts: {
    map: GameMap
    wave: WaveDef
    placedSentinels: { sentinel: Sentinel; slotId: string }[]
    baseHp: number
    maxBaseHp: number
    teamMods?: EffectMods[]
    enemyHpMult?: number
    tactics?: Tactics
    seed?: number
    /** Assist dial: multiplier on base damage per leak (default 1 = shipped difficulty). */
    baseDamageMul?: number
    onEvent?: (e: string) => void
  }) {
    this.onEvent = opts.onEvent
    this.map = opts.map
    this.path = new GamePath(opts.map.path)
    this.wave = opts.wave
    this.baseHp = opts.baseHp
    this.startBaseHp = opts.baseHp
    this.maxBaseHp = opts.maxBaseHp
    this.teamMods = opts.teamMods ?? []
    this.enemyHpMult = opts.enemyHpMult ?? 1
    // Guarded rather than trusted: a NaN or a negative here would either destroy
    // the base instantly or make it unkillable, and both are silent. ZERO is
    // rejected for exactly the reason the sentence above gives and used to be
    // let through anyway (F6): at 0 no leak costs anything, the base can never
    // fall, and `checkEnd` can only ever return 'cleared' — an unlosable game
    // that still hands out every reward. There is no assist level that means
    // "invulnerable", so a 0 here is a caller bug, and it takes the default.
    this.baseDamageMul =
      Number.isFinite(opts.baseDamageMul) && (opts.baseDamageMul as number) > 0
        ? (opts.baseDamageMul as number)
        : 1
    this.tactics = opts.tactics ?? { focus: 'first', holdFire: false }
    this.holdThreshold = this.tactics.holdFire ? this.path.length * 0.45 : 0
    this.rng = new RNG(opts.seed)
    // Derived, not shared: cosmetic draws can never shift a combat roll.
    this.cosmeticRng = new RNG(hashSeed(opts.seed ?? 0, 'cosmetic'))

    const slotById = new Map(opts.map.slots.map((s) => [s.id, s]))
    let placeIndex = 0
    for (const { sentinel, slotId } of opts.placedSentinels) {
      const slot = slotById.get(slotId)!
      const profile = computeCombat(sentinel, { teamMods: this.teamMods, patienceMult: 1 })
      const maxHp = profile.maxHp
      const rt: RtSentinel = {
        id: sentinel.id,
        def: sentinel,
        pos: { ...slot.pos },
        slotId,
        profile,
        cooldown: this.rng.range(0, 0.3),
        targetId: null,
        aimAngle: 0,
        fireFlash: 0,
        hp: maxHp * (1 - profile.startMissingFrac),
        maxHp,
        downed: false,
        patienceTime: 0,
        patienceStacks: 0,
        // Gear "of Patience" counts toward the stack ceiling, not just the raw stat (H10).
        patienceMax: 3 + Math.floor(profile.patience / 5),
        blockIds: [],
        buffMult: 1,
        reduction: 0,
        kills: 0,
        damageDealt: 0,
        procFlash: 0,
        // Stagger re-targeting deterministically so a big team never re-scores in one tick.
        retargetIn: (placeIndex % 4) * (RETARGET_INTERVAL / 4),
      }
      placeIndex++
      this.sentinels.push(rt)
      // Traps are laid at wave start near the Sentinel's nearest path point.
      if (profile.mods.trap) {
        this.traps.push({
          id: nextId('t'),
          pos: this.nearestPathPoint(slot.pos),
          dps: profile.mods.trap.dps,
          slow: profile.mods.trap.slow,
          srcId: sentinel.id,
          damageType: profile.damageType,
        })
      }
    }

    this.spawnQueue = [...opts.wave.spawns].sort((a, b) => a.at - b.at)
  }

  private nearestPathPoint(p: Vec2): Vec2 {
    // Sample the path coarsely to find the closest point.
    let best = this.path.pointAt(0)
    let bestD = Infinity
    for (let d = 0; d <= this.path.length; d += 12) {
      const pt = this.path.pointAt(d)
      const dd = distSq(p, pt)
      if (dd < bestD) {
        bestD = dd
        best = pt
      }
    }
    return best
  }

  get enemiesAlive(): number {
    return this.enemies.length
  }

  step(dt: number): void {
    if (this.status !== 'running') return
    this.elapsed += dt

    this.spawnDue()
    this.updatePatience(dt)
    this.updateAuras(dt)
    this.assignBlocking()
    this.updateSentinels(dt)
    this.updateEnemies(dt)
    this.updateProjectiles(dt)
    this.updateTraps(dt)
    this.updateFloaters(dt)
    this.checkEnd()
  }

  private spawnDue(): void {
    while (
      this.spawnIndex < this.spawnQueue.length &&
      this.spawnQueue[this.spawnIndex].at <= this.elapsed
    ) {
      const s = this.spawnQueue[this.spawnIndex]
      const type = ENEMY_TYPES[s.typeId]
      /*
       * A spawn naming a type this build has no entry for (F2).
       *
       * `runSnapshot.migrateSnapshot` is the real gate — it drops a stored wave
       * whose `typeId` the registry lacks, so nothing the boot path offers can
       * get here. This is the belt to that brace, and it earns its two lines:
       * the throw it replaces (`type.baseHp` on `undefined`) lands INSIDE the
       * rAF battle loop, where the error boundary's primary button is "Return
       * to last checkpoint" — which restores the same payload and throws again.
       * A crash that re-arms itself is worse than a wave one body short.
       *
       * Skipping keeps the wave finishable: `checkEnd` counts spawns actually
       * queued, so the encounter still resolves and still pays.
       */
      if (!type) {
        this.spawnIndex++
        continue
      }
      const maxHp = Math.round(type.baseHp * s.hpMult * this.enemyHpMult)
      this.enemies.push({
        id: nextId('en'),
        type,
        hp: maxHp,
        maxHp,
        distance: 0,
        pos: this.path.pointAt(0),
        hitFlash: 0,
        burnDps: 0,
        burnUntil: 0,
        burnSrcId: undefined,
        burnType: 'magic',
        chillSlow: 0,
        chillUntil: 0,
        stunUntil: 0,
        blockedBy: null,
      })
      this.retargetDirty = true // a new arrival may outrank everyone's current pick
      this.spawnIndex++
    }
  }

  private updatePatience(dt: number): void {
    for (const s of this.sentinels) {
      if (s.downed) continue
      s.patienceTime += dt
      const stacks = Math.min(s.patienceMax, Math.floor(s.patienceTime / PATIENCE_INTERVAL))
      if (stacks !== s.patienceStacks) {
        s.patienceStacks = stacks
        s.profile = computeCombat(s.def, {
          teamMods: this.teamMods,
          patienceMult: 1 + stacks * PATIENCE_PER_STACK,
        })
        // Keep current HP ratio when max HP shifts.
        const ratio = s.maxHp > 0 ? s.hp / s.maxHp : 1
        s.maxHp = s.profile.maxHp
        s.hp = s.maxHp * ratio
      }
    }
  }

  /** Resolve buff / heal / damage-reduction auras onto each Sentinel this step. */
  private updateAuras(dt: number): void {
    for (const s of this.sentinels) {
      if (s.downed) {
        s.buffMult = 1
        s.reduction = 0
        continue
      }
      let buff = 1
      let reduction = 0
      let heal = 0
      for (const src of this.sentinels) {
        if (src.downed) continue
        const m = src.profile.mods
        const withinBuff = m.buffAura && dist(s.pos, src.pos) <= m.buffAura.radius
        const withinRed = m.dmgReductionAura && dist(s.pos, src.pos) <= m.dmgReductionAura.radius
        const withinHeal = m.healAura && dist(s.pos, src.pos) <= m.healAura.radius
        if (withinBuff) buff *= m.buffAura!.damageMult
        if (withinRed) reduction = Math.max(reduction, m.dmgReductionAura!.reduction)
        if (withinHeal) heal += m.healAura!.hps
      }
      s.buffMult = buff
      s.reduction = reduction
      if (heal > 0 && s.hp < s.maxHp) {
        s.hp = Math.min(s.maxHp, s.hp + heal * dt)
      }
    }
  }

  /** Halt enemies inside blockers' radius (up to their capacity). */
  private assignBlocking(): void {
    for (const s of this.sentinels) s.blockIds = []
    for (const e of this.enemies) e.blockedBy = null
    for (const s of this.sentinels) {
      const block = s.profile.mods.block
      if (!block || s.downed) continue
      const r2 = block.radius * block.radius
      const inRange = this.enemies
        .filter((e) => !e.blockedBy && distSq(s.pos, e.pos) <= r2)
        .sort((a, b) => b.distance - a.distance)
        .slice(0, block.count)
      for (const e of inRange) {
        e.blockedBy = s.id
        s.blockIds.push(e.id)
      }
    }
  }

  private updateSentinels(dt: number): void {
    for (const s of this.sentinels) {
      if (s.downed) continue
      if (s.cooldown > 0) s.cooldown -= dt
      if (s.fireFlash > 0) s.fireFlash = Math.max(0, s.fireFlash - dt * 5)
      if (s.procFlash > 0) s.procFlash = Math.max(0, s.procFlash - dt * 3)

      const rangeSq = s.profile.range * s.profile.range
      s.retargetIn -= dt
      const target0 = s.targetId ? this.enemies.find((e) => e.id === s.targetId) : undefined
      // A target is stale when it died, left range, or slipped back behind the
      // hold line; otherwise we still re-score on a cadence (and on any spawn)
      // so lowestHp/nearest/strongest actually steer the fight, not just the
      // moment of acquisition (H4).
      const stale = !target0 || distSq(s.pos, target0.pos) > rangeSq || !this.targetable(target0)
      let target = target0
      if (stale || this.retargetDirty || s.retargetIn <= 0) {
        target = this.acquireTarget(s, rangeSq)
        s.targetId = target?.id ?? null
        s.retargetIn = RETARGET_INTERVAL
      }
      if (target) {
        s.aimAngle = Math.atan2(target.pos.y - s.pos.y, target.pos.x - s.pos.x)
        if (s.cooldown <= 0) this.fire(s, target)
      }

      // Take melee damage from enemies this Sentinel is blocking; reflect thorns.
      if (s.blockIds.length > 0) {
        const mitigation = 50 / (50 + s.profile.physDef)
        let taken = 0
        for (const id of s.blockIds) {
          const e = this.enemies.find((x) => x.id === id)
          if (!e) continue
          // A stun stops the enemy swinging, but thorns keep grinding: a fighter's
          // own stun proc must never switch off its own damage (L9a).
          if (this.elapsed >= e.stunUntil) taken += e.type.meleeDps
          if (s.profile.thorns > 0) this.damageEnemy(e, s.profile.thorns * dt, s.id, false, s.profile.damageType, true)
          if (e.hp > 0) this.igniteFromThorns(s, e)
        }
        s.hp -= taken * (1 - s.reduction) * mitigation * dt
        if (s.hp <= 0) this.downSentinel(s)
      }
    }
    this.retargetDirty = false
  }

  /**
   * Hold Fire delays engagement until enemies pass the threshold — but an enemy
   * held by a blocker is never coming any closer, so exempting it stops a
   * forward-placed fighter from soft-stalling the whole wave (H6).
   */
  private targetable(e: RtEnemy): boolean {
    return e.distance >= this.holdThreshold || e.blockedBy !== null
  }

  /** Score an in-range enemy per the active focus tactic (higher = preferred). */
  private focusScore(s: RtSentinel, e: RtEnemy): number {
    switch (this.tactics.focus) {
      case 'lowestHp':
        return -e.hp
      case 'strongest':
        return e.maxHp
      case 'nearest':
        return -distSq(s.pos, e.pos)
      case 'first':
      default:
        return e.distance
    }
  }

  private acquireTarget(s: RtSentinel, rangeSq: number): RtEnemy | undefined {
    let best: RtEnemy | undefined
    let bestScore = -Infinity
    for (const e of this.enemies) {
      if (distSq(s.pos, e.pos) > rangeSq) continue
      if (!this.targetable(e)) continue // hold fire until past the point (blocked enemies exempt)
      const score = this.focusScore(s, e)
      if (!best || score > bestScore) {
        best = e
        bestScore = score
      }
    }
    return best
  }

  private fire(s: RtSentinel, target: RtEnemy): void {
    s.cooldown = 1 / s.profile.rate
    s.fireFlash = 1
    this.onEvent?.('shoot')
    const isCrit = this.rng.chance(s.profile.critChance)
    const damage = s.profile.damage * (isCrit ? s.profile.critMult : 1) * s.buffMult
    this.projectiles.push({
      id: nextId('p'),
      pos: { ...s.pos },
      toPos: { ...target.pos },
      targetId: target.id,
      srcId: s.id,
      damage,
      damageType: s.profile.damageType,
      isCrit,
      speed: s.profile.projectileSpeed,
      splashRadius: s.profile.splashRadius,
      pierce: s.profile.mods.pierce ?? 0,
      color: s.def.accent,
      mods: s.profile.mods,
      lifedrain: s.profile.mods.lifedrain ?? 0,
    })
  }

  /**
   * ---- walk a SNAPSHOT, never the live list (F1) ---------------------------
   *
   * `damageEnemy → killEnemy` splices `this.enemies`, and this loop used to be a
   * `for..of` over that same array. Every burn kill therefore advanced the
   * iterator past the body standing behind the one that died — that body was
   * never pushed to `survivors`, and `this.enemies = survivors` then deleted it.
   *
   * It did not die and it did not leak: it EVAPORATED. No kill credit, no gold,
   * no XP, no corpse — and, when it had already walked past the line, no leak
   * damage either, which is a hit the base simply never took. Measured across
   * 720 real waves: 17.2% of waves lost at least one body.
   *
   * Iterating a copy costs one array per tick and makes the loop's contract the
   * obvious one: every enemy that was alive at the top of the tick is either
   * killed, leaked, or carried forward — exactly once.
   */
  private updateEnemies(dt: number): void {
    const survivors: RtEnemy[] = []
    for (const e of this.enemies.slice()) {
      // Already removed by something earlier in this same tick.
      if (e.hp <= 0) continue
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt * 4)

      // Burn DoT — credited to whoever lit it, and typed by their damage type,
      // so burn builds earn XP (H3) and physical burns aren't magic-resisted (M25).
      if (e.burnDps > 0) {
        if (this.elapsed < e.burnUntil) {
          this.damageEnemy(e, e.burnDps * dt, e.burnSrcId, false, e.burnType, true)
          if (e.hp <= 0) continue
        } else {
          // Expired: drop the stack rather than leave it standing (m-3). Nothing
          // else reads it while it is lapsed, but leaving it set is what let a
          // later, weaker burn inherit this one's dps.
          e.burnDps = 0
          e.burnSrcId = undefined
        }
      }

      const stunned = this.elapsed < e.stunUntil
      const chill = this.elapsed < e.chillUntil ? e.chillSlow : 0
      if (!stunned && !e.blockedBy) {
        e.distance += e.type.speed * (1 - chill) * dt
      }

      if (e.distance >= this.path.length) {
        // The assist dial lands here and nowhere else (M34): what gets through
        // still gets through, and the wave, the loot and the marks are the same
        // ones — only the bite the line takes is smaller. `leaks` is the number
        // the summary prints next to "left", so it reports the damage ACTUALLY
        // taken; reporting the un-assisted figure would make the receipt lie.
        const dmg = e.type.leak * this.baseDamageMul
        this.baseHp -= dmg
        this.leaks += dmg
        // The head count is tracked separately from the damage, because they are
        // different numbers and two readouts printed one as the other (F3).
        this.leakCount++
        this.onEvent?.('leak')
        continue
      }
      e.pos = this.path.pointAt(e.distance)
      survivors.push(e)
    }
    this.enemies = survivors
  }

  private updateProjectiles(dt: number): void {
    const alive: RtProjectile[] = []
    for (const p of this.projectiles) {
      const target = p.targetId ? this.enemies.find((e) => e.id === p.targetId) : undefined
      if (target) p.toPos = target.pos
      const { pos, arrived } = moveToward(p.pos, p.toPos, p.speed * dt)
      p.pos = pos
      if (arrived) {
        this.impact(p, target)
        continue
      }
      alive.push(p)
    }
    this.projectiles = alive
  }

  /**
   * How far a pierce splinter reaches from the impact point (L9b).
   *
   * Pierce is modelled as a splinter rather than a swept line, and it applies
   * even when the primary died mid-flight — a piercing shot is never wasted,
   * which is exactly what the enchant promises.
   */
  private static readonly PIERCE_RADIUS = 60

  /**
   * Resolve an impact into the set of enemies it touches.
   *
   * ---- splash and pierce COMPOSE; neither cancels the other (F10) ----------
   *
   * This used to be `if (splash) {...} else { primary; if (pierce) {...} }`, so
   * `p.pierce` was unreachable the instant a Sentinel carried any splash at all
   * — and every body item rolls `splashAdd` (9–16px at COMMON, and the fresh
   * player's starting kit contains a common body). The practical result was that
   * pierce did nothing for essentially every hero in every real run: the whole
   * Marksman branch, the `piercing` enchant and the Piercing Volley mutation
   * were all switched off by ordinary armour, while `describeMods` went on
   * printing "pierces N extra enemies" and the body advertised its splash as
   * pure upside. A build that a piece of gear silently deletes is the
   * unwinnable-combination trap this project's doctrine forbids, and it is
   * worse than dead copy because the player is told the opposite.
   *
   * The rule now: the impact touches the blast, and then the shot punches on
   * through up to `pierce` MORE enemies it has not already hit. Each mechanic
   * keeps exactly the semantics it had on its own — the blast is still
   * everything within `splashRadius`, pierce is still up to N within the
   * splinter radius — so a single-target weapon's hit list is byte-identical to
   * before, and no shot ever hits the same enemy twice. A blast wider than the
   * splinter naturally leaves pierce nothing to add, which is correct rather
   * than a loss: splash already damages every one of those targets in full.
   */
  private impact(p: RtProjectile, primary: RtEnemy | undefined): void {
    const hitList: RtEnemy[] = []
    if (p.splashRadius > 0) {
      const r2 = p.splashRadius * p.splashRadius
      // Single pass over a list with no duplicates, so no dedupe is needed here.
      for (const e of this.enemies) if (distSq(e.pos, p.pos) <= r2) hitList.push(e)
    } else if (primary) {
      hitList.push(primary)
    }
    if (p.pierce > 0) {
      const already = new Set(hitList)
      const r2 = GameEngine.PIERCE_RADIUS * GameEngine.PIERCE_RADIUS
      // Same order and same cutoff the `filter(...).slice(0, pierce)` above had,
      // so a no-splash shot resolves to the identical hit list it always did.
      for (const e of this.enemies) {
        if (hitList.length >= already.size + p.pierce) break
        if (e === primary || already.has(e)) continue
        if (distSq(e.pos, p.pos) <= r2) hitList.push(e)
      }
    }

    /*
     * The most frequent meaningful event in the game, and it made no sound at
     * all (H17): `gameSfx` has handled `'hit'` all along and nothing ever
     * emitted it, so every projectile impact in every wave was silent.
     *
     * ONE event per impact, not one per enemy touched — a splash that lands on
     * six enemies is one impact and should sound like one, or a wide blast
     * turns into a burst of six identical clicks.
     *
     * Crits are their own event rather than a louder `'hit'`. The roll already
     * exists on the projectile (`p.isCrit`, decided in `fire()` from the combat
     * stream), so this costs nothing and gives the mix a channel it was
     * throwing away: a crit that sounds identical to a normal hit tells the
     * player nothing.
     *
     * A shot that arrives with nothing to hit (its target died mid-flight, no
     * splash, no pierce) stays silent, which is correct — nothing was struck.
     */
    if (hitList.length > 0) this.onEvent?.(p.isCrit ? 'crit' : 'hit')

    for (const e of hitList) this.applyHit(e, p)

    // Chain lightning: arc to nearby enemies for a fraction of the hit.
    if (p.mods.shock && hitList.length > 0) {
      const origin = hitList[0]
      const chained = this.enemies
        .filter((e) => !hitList.includes(e))
        .sort((a, b) => distSq(origin.pos, a.pos) - distSq(origin.pos, b.pos))
        .slice(0, p.mods.shock.chains)
      const src = this.sentinels.find((x) => x.id === p.srcId)
      if (src) src.procFlash = 1
      for (const e of chained) {
        this.damageEnemy(e, p.damage * p.mods.shock.dmgFrac, p.srcId, false, p.damageType, false)
      }
    }
  }

  private applyHit(e: RtEnemy, p: RtProjectile): void {
    /*
     * ---- execute does not go through `damageEnemy`, so no resist applies ----
     *
     * Raised as a possible skeleton key: an Executioner would be a free answer
     * to the 55%-plated columns the Phase-3 elites are built around, because
     * the last `execute` share of every body is removed rather than ground
     * through the armour. INTENDED, and measured, for two reasons:
     *
     *  1. **Arithmetically it is not differential.** Removing a body of `maxHp`
     *     H at resistance r costs H/(1−r) damage; with an execute threshold x it
     *     costs H(1−x)/(1−r). The ratio is (1−x) — independent of r. Execute
     *     saves the same FRACTION of the grind at 0% resist as at 55%. The
     *     absolute saving is larger against armour only because the whole fight
     *     is larger against armour, which is what armour is for.
     *
     *  2. **Measured, it is smaller against plate, not larger.** One 18-body
     *     column at ×6 HP, one physical 3-tower line, execute 0.28 (Reaper, the
     *     largest threshold on the tree), mean clear time with vs without:
     *
     *       barrel4_warded    0% phys resist   34.30s → 31.01s   −9.6%
     *       barrel4_swift    15%               35.62s → 28.61s  −19.7%
     *       barrel4          30%               44.06s → 35.76s  −18.8%
     *       barrel4_plated   55%               50.90s → 48.48s   −4.7%
     *
     *     The plated column gains the LEAST from an execute build, because a
     *     modifier that also slows the column (`plated` is speedMult 0.9) puts
     *     more of the clear into walking time, which no threshold shortens.
     *
     * The mechanic is a threshold, not a damage source: there is no damage for a
     * resistance to multiply. Making it resist-aware would mean inventing a rule
     * ("armour resists being removed") that the card could not state. Left as
     * is, written down here so the next reader does not have to re-derive it.
     */
    if (p.mods.execute && e.hp / e.maxHp <= p.mods.execute) {
      this.spawnFloater(e.pos, 'EXECUTE', '#ff5d5d', true)
      const src = this.sentinels.find((x) => x.id === p.srcId)
      if (src) {
        src.procFlash = 1
        // Book the executed remainder, or per-Sentinel damage under-reports every
        // execute the build lands (L9).
        src.damageDealt += Math.max(0, e.hp)
      }
      this.killEnemy(e, p.srcId)
      return
    }
    const dealt = this.damageEnemy(e, p.damage, p.srcId, p.isCrit, p.damageType, false)

    // On-hit statuses (only if the enemy is still alive).
    if (e.hp > 0) {
      const src = p.srcId ? this.sentinels.find((x) => x.id === p.srcId) : undefined
      if (p.mods.burn) {
        if (this.writeBurn(e, p.mods.burn, p.srcId, p.damageType) && src) src.procFlash = 1
      }
      if (p.mods.chill) {
        e.chillSlow = Math.max(e.chillSlow, p.mods.chill.slow)
        e.chillUntil = Math.max(e.chillUntil, this.elapsed + p.mods.chill.dur)
      }
      if (p.mods.stunChance && this.rng.chance(p.mods.stunChance)) {
        e.stunUntil = Math.max(e.stunUntil, this.elapsed + (p.mods.stunDur ?? 0.5))
        this.spawnFloater(e.pos, 'STUN', '#ffe08a', true)
        if (src) src.procFlash = 1
      }
    }

    /*
     * Life-drain heals the base (see LIFEDRAIN_SCALE — describe.ts quotes the
     * same number).
     *
     * On the damage ACTUALLY DEALT, not the damage rolled. This used to read
     * `p.damage`, the pre-resist figure, while the card says "per 100 damage
     * dealt" and `damageEnemy` uses `applied` — the post-resist, non-overkilled
     * amount — for every other meaning of that phrase, including the per-Sentinel
     * `damageDealt` on the run summary. Two definitions of "damage dealt" in one
     * engine, and the tooltip quoted the one the code did not use: a shot that
     * scratched a 55%-plated column for 45 healed as if it had hit for 100.
     */
    if (p.lifedrain > 0 && this.baseHp < this.maxBaseHp) {
      this.baseHp = Math.min(this.maxBaseHp, this.baseHp + dealt * p.lifedrain * LIFEDRAIN_SCALE)
    }
  }

  /**
   * Write a burn onto an enemy, and report whether it is a FRESH ignition.
   *
   * The strongest burn owns the stack — including its owner and damage type, so
   * the credit and the resist both follow the real source.
   *
   * An EXPIRED burn owns nothing (m-3). `burnDps` was never reset on expiry, so
   * a weak burn re-igniting a lapsed stronger one inherited the strong dps
   * through the `Math.max` while stamping its own srcId and damage type —
   * over-damaging, crediting the wrong Sentinel and applying the wrong resist. A
   * fresh burn is written outright, not maxed.
   *
   * Extracted so the two things that can light an enemy — a projectile impact
   * and a {@link igniteFromThorns} grind — write the stack the same way rather
   * than through two copies of this rule.
   */
  private writeBurn(
    e: RtEnemy,
    burn: { dps: number; dur: number },
    srcId: string | undefined,
    type: 'physical' | 'magic',
  ): boolean {
    const fresh = this.elapsed >= e.burnUntil
    if (fresh || burn.dps >= e.burnDps) {
      e.burnDps = burn.dps
      e.burnSrcId = srcId
      e.burnType = type
    }
    e.burnUntil = Math.max(e.burnUntil, this.elapsed + burn.dur)
    return fresh
  }

  /**
   * ---- thorns that burn (C2) -----------------------------------------------
   *
   * `Warden of Ash` is a level-20, irreversible pick whose whole card is
   * *"Everything it holds burns on its thorns."* It could not do that. Thorns go
   * through {@link damageEnemy}, which applies resist and books kill credit and
   * writes **no statuses**; burn was written only in {@link applyHit}, reachable
   * only from {@link impact}, i.e. only from a projectile. And a Fighter fires
   * one projectile at one target with `splashRadius 0` and `pierce 0` while burn
   * does not stack, so of the four enemies the Warden holds, at most **one** was
   * ever lit — never four, and never by the thorns.
   *
   * The mechanic is what moved, not the card. `thornsIgnite` makes the grind a
   * strike for the purposes of one status: whatever burn this Sentinel carries
   * is applied to everything it is holding, every tick it is holding it.
   *
   * **What it is worth, measured, because a fix nobody priced is the defect one
   * layer down.** Held bodies actually alight, mean over the hold, Warden of Ash
   * with Epic gear:
   *
   *   bench                        held   burning BEFORE   burning AFTER
   *   20 Siege Barrels, ×10, gap 4  2.44       2.44 (100%)     2.44 (100%)
   *   24 Siege Barrels, ×8, gap 0.4 3.65       3.09  (85%)     3.65 (100%)
   *   24 Plated, ×8, gap 0.4        3.48       3.22  (93%)     3.48 (100%)
   *   60 Torch Berserkers, ×14      3.63       2.29  (63%)     3.63 (100%)
   *
   * Solo stop rate moves by **+0.0pt** on all four and by at most **+1.7pt**
   * anywhere on a six-rung siege ladder, because the burn is 26/s against thorns
   * of 144/s — 18% of what the same body is already taking. So this is a
   * correctness fix, not a re-cost, and it is worth saying why the gap was
   * smaller than it looks: the Warden *shoots while it blocks*, `RETARGET_INTERVAL`
   * re-scores every 0.45s, and a 3s burn outlives several shots, so the projectile
   * path was incidentally lighting most of the queue anyway. What it could not do
   * is light **all** of it, and it was never the thorns doing it.
   *
   * **Why the flag, rather than "every blocker's thorns apply its burn".** The
   * universal rule is the more elegant sentence and it was measured before this
   * one was written. It fails for a reason that has nothing to do with the
   * Warden: `block` starts on the **tier-0 Fighter** (`count: 2`), so every
   * fighter in the game blocks — including the Weaponmaster §8 grades every
   * mutation on. Under the universal rule the Incendiary mutation (burn 180/s)
   * lights both bodies that Weaponmaster holds, continuously and for free, and
   * §8's row for it goes
   *
   *   swarm −7.8 → **+52.2**,  armour +12.5 → +33.3,  line +23.0 → +39.2 pt
   *
   * — which deletes Incendiary's only measurable cost and turns a priced
   * tradeoff into the largest pure upside in the table. That is a re-costing of
   * the Mythic tier smuggled in as a fix to one tier-2 node.
   *
   * So the capability is real and reusable — any node, affix or mutation may
   * declare it — but it is *declared*, and today exactly one node declares it.
   *
   * Chill and stun deliberately do NOT ride along. A blocked enemy is already
   * stopped, so chill on it is nearly inert; and a stun stops it swinging, so a
   * blocker that stun-locked what it holds would take no melee at all — which is
   * the same "a tower is damageable only while blocking" loophole the Guard line
   * was rebuilt to close (see `archetypeTree.ts`).
   */
  private igniteFromThorns(s: RtSentinel, e: RtEnemy): void {
    const burn = s.profile.mods.burn
    if (!s.profile.mods.thornsIgnite || !burn) return
    if (this.writeBurn(e, burn, s.id, s.profile.damageType)) s.procFlash = 1
  }

  /**
   * Apply damage, and return what was ACTUALLY dealt — post-resist, capped at
   * the target's remaining HP. That figure is what `damageDealt` books and what
   * the run summary prints, so anything else scaling off "damage dealt" (life
   * drain) reads it here rather than re-deriving its own.
   */
  private damageEnemy(
    e: RtEnemy,
    amount: number,
    srcId: string | undefined,
    isCrit: boolean,
    type: 'physical' | 'magic',
    quiet: boolean,
  ): number {
    const resist = type === 'physical' ? (e.type.physResist ?? 0) : (e.type.magResist ?? 0)
    const dealt = amount * (1 - resist)
    const applied = Math.min(e.hp, dealt)
    e.hp -= dealt
    e.hitFlash = 1
    if (srcId) {
      const s = this.sentinels.find((x) => x.id === srcId)
      if (s) s.damageDealt += applied
    }
    if (!quiet) {
      this.spawnFloater(e.pos, Math.round(dealt).toString(), isCrit ? '#ffd166' : '#ffffff', isCrit)
    }
    if (e.hp <= 0) this.killEnemy(e, srcId)
    return applied
  }

  private killEnemy(e: RtEnemy, srcId: string | undefined): void {
    const idx = this.enemies.indexOf(e)
    if (idx === -1) return
    this.enemies.splice(idx, 1)
    this.killCount++
    this.goldEarned += e.type.reward
    this.onEvent?.('kill')
    if (srcId) {
      const s = this.sentinels.find((x) => x.id === srcId)
      if (s) {
        s.kills++
        const xp = Math.round(e.maxHp * 0.2) + e.type.reward
        this.xpGained.set(srcId, (this.xpGained.get(srcId) ?? 0) + xp)
      }
    }
  }

  /**
   * Same splice-during-iteration shape as `updateEnemies` (F1), with a milder
   * symptom: nothing is dropped here — `this.enemies` is not reassigned — but a
   * trap that killed mid-sweep skipped the next enemy in the pan, so that enemy
   * took no trap damage and no chill for that tick. The snapshot is taken per
   * trap, so a body a previous trap already killed is genuinely gone by the time
   * the next one sweeps.
   */
  private updateTraps(dt: number): void {
    for (const t of this.traps) {
      const r2 = TRAP_RADIUS * TRAP_RADIUS
      for (const e of this.enemies.slice()) {
        if (e.hp <= 0) continue
        if (distSq(e.pos, t.pos) > r2) continue
        // Credit the Sentinel that laid the trap, so trap kills award XP (H3),
        // and resist it as that Sentinel's damage rather than as `'physical'`
        // by assumption — see `RtTrap.damageType`.
        this.damageEnemy(e, t.dps * dt, t.srcId, false, t.damageType, true)
        if (e.hp > 0 && t.slow > 0) {
          e.chillSlow = Math.max(e.chillSlow, t.slow)
          e.chillUntil = Math.max(e.chillUntil, this.elapsed + 0.4)
        }
      }
    }
  }

  private downSentinel(s: RtSentinel): void {
    // Idempotent by its own state rather than by its caller's (F10). The one
    // call site sits under `if (s.downed) continue`, so a second entry was
    // unreachable — but the cost of the guard is a comparison and the cost of
    // its absence is `downedCount` counting one Sentinel twice, a doubled
    // `'down'` sting, and a run summary that reports more losses than the run
    // had. `killEnemy` already guards itself the same way.
    if (s.downed) return
    s.hp = 0
    s.downed = true
    s.blockIds = []
    s.targetId = null
    s.patienceStacks = 0
    s.patienceTime = 0
    this.downedCount++
    // Losing a Sentinel is the worst thing that can happen inside a wave short
    // of the base falling, and it announced itself with a floater and nothing
    // else. The player is WATCHING this game — a loss that happens off the part
    // of the screen they are looking at has to be audible.
    this.onEvent?.('down')
    this.spawnFloater(s.pos, 'DOWN', '#e05a4f', true)
  }

  private spawnFloater(pos: Vec2, text: string, color: string, big: boolean): void {
    if (this.floaters.length > 70) this.floaters.shift()
    this.floaters.push({
      id: nextId('f'),
      // Cosmetic stream only — jitter must never perturb a combat roll (C1).
      pos: { x: pos.x + this.cosmeticRng.range(-6, 6), y: pos.y - 6 },
      text,
      color,
      life: big ? 0.9 : 0.6,
      maxLife: big ? 0.9 : 0.6,
      vy: big ? -46 : -34,
    })
  }

  private updateFloaters(dt: number): void {
    const alive: FloatingText[] = []
    for (const f of this.floaters) {
      f.life -= dt
      f.pos = { x: f.pos.x, y: f.pos.y + f.vy * dt }
      if (f.life > 0) alive.push(f)
    }
    this.floaters = alive
  }

  private checkEnd(): void {
    if (this.baseHp <= 0) {
      this.baseHp = 0
      this.status = 'defeated'
      return
    }
    const done =
      this.spawnIndex >= this.spawnQueue.length &&
      this.enemies.length === 0 &&
      this.projectiles.length === 0
    if (done) this.status = 'cleared'
  }

  hudSnapshot() {
    return {
      baseHp: this.baseHp,
      maxBaseHp: this.maxBaseHp,
      goldEarned: this.goldEarned,
      status: this.status,
      enemiesAlive: this.enemies.length,
      enemiesSpawned: this.spawnIndex,
      enemiesTotal: this.spawnQueue.length,
      elapsed: this.elapsed,
    }
  }

  result(): BattleResult {
    const defeated = this.status === 'defeated'
    // ---- one rounding rule, applied once, so the receipt adds up (F3) -------
    //
    // The SIM stays fractional: `baseDamageMul` below 1 and lifedrain both make
    // fractions, and rounding them per tick would change what the simulation
    // does. The REPORT is whole points, and it is derived rather than rounded
    // field-by-field — `leaks` used to be `Math.round`ed while the base was left
    // raw for the UI to `Math.ceil`, so an assisted receipt could read
    // "19 left (−2)" against a base of 20, and `finishBattle` then carried the
    // raw fraction into the rest of the run.
    const leakDamage = Math.round(this.leaks)
    // Whatever moved the base that leaks did not: lifedrain. Reported as its own
    // whole number so the subtraction below is the only arithmetic there is.
    const healed = Math.round(this.baseHp - (this.startBaseHp - this.leaks))
    // A cleared wave means the line held, so it holds at least one point — the
    // rounding above must never hand the campaign a base of 0 it can still play.
    const left = this.startBaseHp - leakDamage + healed
    return {
      status: defeated ? 'defeated' : 'cleared',
      goldEarned: this.goldEarned,
      baseHpLeft: defeated ? 0 : Math.min(this.maxBaseHp, Math.max(1, left)),
      leakDamage,
      leaks: leakDamage,
      enemiesLeaked: this.leakCount,
      downed: this.downedCount,
      enemiesKilled: this.killCount,
      perSentinel: this.sentinels.map((s) => ({
        id: s.id,
        kills: s.kills,
        damageDealt: Math.round(s.damageDealt),
        xpGained: this.xpGained.get(s.id) ?? 0,
        downed: s.downed,
      })),
    }
  }

  static enemyHpFrac(e: RtEnemy): number {
    return Math.max(0, e.hp) / e.maxHp
  }
}
