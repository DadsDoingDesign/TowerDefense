import { GamePath } from '../core/path'
import { nextId, RNG } from '../core/rng'
import { distSq, moveToward, type Vec2 } from '../core/vec'
import { ENEMY_TYPES } from '../data/enemies'
import type { EnemyType, GameMap, Sentinel, WaveDef } from '../types'
import { computeEffectiveAttack } from './effective'

export interface RtSentinel {
  id: string
  def: Sentinel
  pos: Vec2
  slotId: string
  cooldown: number
  targetId: string | null
  aimAngle: number
  fireFlash: number // 0..1, decays; drives the muzzle/swing pulse
  kills: number
  damageDealt: number
  eff: ReturnType<typeof computeEffectiveAttack>
}

export interface RtEnemy {
  id: string
  type: EnemyType
  hp: number
  maxHp: number
  distance: number
  pos: Vec2
  hitFlash: number
  slowUntil: number // reserved for M2 debuffs
}

export interface RtProjectile {
  id: string
  pos: Vec2
  toPos: Vec2
  targetId: string | null
  srcId: string
  damage: number
  speed: number
  splashRadius: number
  isCrit: boolean
  color: string
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
  baseHpLeft: number
  leaks: number
  perSentinel: { id: string; kills: number; damageDealt: number; xpGained: number }[]
}

/**
 * Owns all mutable battle state for a single wave and advances it with `step(dt)`.
 * The renderer reads these arrays directly each frame; React reads a lightweight
 * HUD snapshot a few times per second.
 */
export class GameEngine {
  readonly map: GameMap
  readonly path: GamePath
  readonly wave: WaveDef

  sentinels: RtSentinel[] = []
  enemies: RtEnemy[] = []
  projectiles: RtProjectile[] = []
  floaters: FloatingText[] = []

  baseHp: number
  maxBaseHp: number
  goldEarned = 0
  leaks = 0
  status: BattleStatus = 'running'
  elapsed = 0

  private spawnQueue: { typeId: string; at: number; hpMult: number }[]
  private spawnIndex = 0
  private rng: RNG
  private xpGained = new Map<string, number>()

  constructor(opts: {
    map: GameMap
    wave: WaveDef
    placedSentinels: { sentinel: Sentinel; slotId: string }[]
    baseHp: number
    maxBaseHp: number
    seed?: number
  }) {
    this.map = opts.map
    this.path = new GamePath(opts.map.path)
    this.wave = opts.wave
    this.baseHp = opts.baseHp
    this.maxBaseHp = opts.maxBaseHp
    this.rng = new RNG(opts.seed)

    const slotById = new Map(opts.map.slots.map((s) => [s.id, s]))
    this.sentinels = opts.placedSentinels.map(({ sentinel, slotId }) => {
      const slot = slotById.get(slotId)!
      return {
        id: sentinel.id,
        def: sentinel,
        pos: { ...slot.pos },
        slotId,
        cooldown: 0,
        targetId: null,
        aimAngle: 0,
        fireFlash: 0,
        kills: 0,
        damageDealt: 0,
        eff: computeEffectiveAttack(sentinel),
      }
    })

    this.spawnQueue = [...opts.wave.spawns].sort((a, b) => a.at - b.at)
  }

  get enemiesSpawned(): number {
    return this.spawnIndex
  }
  get enemiesTotal(): number {
    return this.spawnQueue.length
  }
  get enemiesAlive(): number {
    return this.enemies.length
  }

  /** Advance the simulation by `dt` seconds (already scaled by battle speed). */
  step(dt: number): void {
    if (this.status !== 'running') return
    this.elapsed += dt

    this.spawnDue()
    this.moveEnemies(dt)
    this.updateSentinels(dt)
    this.updateProjectiles(dt)
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
      const maxHp = Math.round(type.baseHp * s.hpMult)
      this.enemies.push({
        id: nextId('en'),
        type,
        hp: maxHp,
        maxHp,
        distance: 0,
        pos: this.path.pointAt(0),
        hitFlash: 0,
        slowUntil: 0,
      })
      this.spawnIndex++
    }
  }

  private moveEnemies(dt: number): void {
    const survivors: RtEnemy[] = []
    for (const e of this.enemies) {
      e.distance += e.type.speed * dt
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt * 4)
      if (e.distance >= this.path.length) {
        // Leaked to the base.
        this.baseHp -= e.type.leak
        this.leaks += e.type.leak
        continue
      }
      e.pos = this.path.pointAt(e.distance)
      survivors.push(e)
    }
    this.enemies = survivors
  }

  private updateSentinels(dt: number): void {
    for (const s of this.sentinels) {
      if (s.cooldown > 0) s.cooldown -= dt
      if (s.fireFlash > 0) s.fireFlash = Math.max(0, s.fireFlash - dt * 5)

      // Keep current target if alive and in range; else acquire a new one.
      const rangeSq = s.eff.range * s.eff.range
      let target = s.targetId ? this.enemies.find((e) => e.id === s.targetId) : undefined
      if (!target || distSq(s.pos, target.pos) > rangeSq) {
        target = this.acquireTarget(s, rangeSq)
        s.targetId = target?.id ?? null
      }

      if (target) {
        s.aimAngle = Math.atan2(target.pos.y - s.pos.y, target.pos.x - s.pos.x)
        if (s.cooldown <= 0) this.fire(s, target)
      }
    }
  }

  /** Target the enemy furthest along the path (closest to the base) within range. */
  private acquireTarget(s: RtSentinel, rangeSq: number): RtEnemy | undefined {
    let best: RtEnemy | undefined
    for (const e of this.enemies) {
      if (distSq(s.pos, e.pos) > rangeSq) continue
      if (!best || e.distance > best.distance) best = e
    }
    return best
  }

  private fire(s: RtSentinel, target: RtEnemy): void {
    s.cooldown = 1 / s.eff.rate
    s.fireFlash = 1
    const isCrit = this.rng.chance(s.eff.critChance)
    const damage = s.eff.damage * (isCrit ? s.eff.critMult : 1)
    this.projectiles.push({
      id: nextId('p'),
      pos: { ...s.pos },
      toPos: { ...target.pos },
      targetId: target.id,
      srcId: s.id,
      damage,
      speed: s.eff.projectileSpeed,
      splashRadius: s.eff.splashRadius,
      isCrit,
      color: s.def.accent,
    })
  }

  private updateProjectiles(dt: number): void {
    const alive: RtProjectile[] = []
    for (const p of this.projectiles) {
      const target = p.targetId ? this.enemies.find((e) => e.id === p.targetId) : undefined
      if (target) p.toPos = target.pos
      const { pos, arrived } = moveToward(p.pos, p.toPos, p.speed * dt)
      p.pos = pos
      if (arrived) {
        this.impact(p)
        continue
      }
      alive.push(p)
    }
    this.projectiles = alive
  }

  private impact(p: RtProjectile): void {
    const srcId = p.srcId
    if (p.splashRadius > 0) {
      const r2 = p.splashRadius * p.splashRadius
      for (const e of this.enemies) {
        if (distSq(e.pos, p.pos) <= r2) this.damageEnemy(e, p.damage, srcId, p.isCrit)
      }
    } else {
      const target = p.targetId ? this.enemies.find((e) => e.id === p.targetId) : undefined
      if (target) this.damageEnemy(target, p.damage, srcId, p.isCrit)
    }
  }

  private damageEnemy(e: RtEnemy, amount: number, srcId: string | undefined, isCrit: boolean): void {
    const dealt = Math.min(e.hp, amount)
    e.hp -= amount
    e.hitFlash = 1
    if (srcId) {
      const s = this.sentinels.find((x) => x.id === srcId)
      if (s) s.damageDealt += dealt
    }
    this.spawnFloater(e.pos, Math.round(amount).toString(), isCrit ? '#ffd166' : '#ffffff', isCrit)

    if (e.hp <= 0) this.killEnemy(e, srcId)
  }

  private killEnemy(e: RtEnemy, srcId: string | undefined): void {
    const idx = this.enemies.indexOf(e)
    if (idx === -1) return
    this.enemies.splice(idx, 1)
    this.goldEarned += e.type.reward
    if (srcId) {
      const s = this.sentinels.find((x) => x.id === srcId)
      if (s) {
        s.kills++
        const xp = Math.round(e.maxHp * 0.2) + e.type.reward
        this.xpGained.set(srcId, (this.xpGained.get(srcId) ?? 0) + xp)
      }
    }
  }

  private spawnFloater(pos: Vec2, text: string, color: string, big: boolean): void {
    // Cap floater count so long fights don't accumulate junk.
    if (this.floaters.length > 60) this.floaters.shift()
    this.floaters.push({
      id: nextId('f'),
      pos: { x: pos.x + this.rng.range(-6, 6), y: pos.y - 6 },
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

  /** Snapshot for the HUD (cheap; safe to poll each frame). */
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
    return {
      status: this.status === 'defeated' ? 'defeated' : 'cleared',
      goldEarned: this.goldEarned,
      baseHpLeft: this.baseHp,
      leaks: this.leaks,
      perSentinel: this.sentinels.map((s) => ({
        id: s.id,
        kills: s.kills,
        damageDealt: Math.round(s.damageDealt),
        xpGained: this.xpGained.get(s.id) ?? 0,
      })),
    }
  }

  static enemyHpFrac(e: RtEnemy): number {
    return Math.max(0, e.hp) / e.maxHp
  }
}
