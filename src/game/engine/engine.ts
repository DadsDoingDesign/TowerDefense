import { GamePath } from '../core/path'
import { nextId, RNG } from '../core/rng'
import { dist, distSq, moveToward, type Vec2 } from '../core/vec'
import { ENEMY_TYPES } from '../data/enemies'
import type { EffectMods, EnemyType, GameMap, Sentinel, Tactics, WaveDef } from '../types'
import { computeCombat, type CombatProfile } from './combat'

const PATIENCE_INTERVAL = 3 // seconds per stack
const PATIENCE_PER_STACK = 0.04
const TRAP_RADIUS = 34

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
  leaks = 0
  /** Optional sound/event hook (app supplies audio; the headless harness omits it). */
  private onEvent?: (e: string) => void
  downedCount = 0
  killCount = 0
  status: BattleStatus = 'running'
  elapsed = 0

  private spawnQueue: { typeId: string; at: number; hpMult: number }[]
  private spawnIndex = 0
  private rng: RNG
  private teamMods: EffectMods[]
  private enemyHpMult: number
  private tactics: Tactics
  private holdThreshold: number
  private xpGained = new Map<string, number>()

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
    onEvent?: (e: string) => void
  }) {
    this.onEvent = opts.onEvent
    this.map = opts.map
    this.path = new GamePath(opts.map.path)
    this.wave = opts.wave
    this.baseHp = opts.baseHp
    this.maxBaseHp = opts.maxBaseHp
    this.teamMods = opts.teamMods ?? []
    this.enemyHpMult = opts.enemyHpMult ?? 1
    this.tactics = opts.tactics ?? { focus: 'first', holdFire: false }
    this.holdThreshold = this.tactics.holdFire ? this.path.length * 0.45 : 0
    this.rng = new RNG(opts.seed)

    const slotById = new Map(opts.map.slots.map((s) => [s.id, s]))
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
        patienceMax: 3 + Math.floor(sentinel.patience / 5),
        blockIds: [],
        buffMult: 1,
        reduction: 0,
        kills: 0,
        damageDealt: 0,
        procFlash: 0,
      }
      this.sentinels.push(rt)
      // Traps are laid at wave start near the Sentinel's nearest path point.
      if (profile.mods.trap) {
        this.traps.push({
          id: nextId('t'),
          pos: this.nearestPathPoint(slot.pos),
          dps: profile.mods.trap.dps,
          slow: profile.mods.trap.slow,
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
        chillSlow: 0,
        chillUntil: 0,
        stunUntil: 0,
        blockedBy: null,
      })
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
      let target = s.targetId ? this.enemies.find((e) => e.id === s.targetId) : undefined
      if (!target || distSq(s.pos, target.pos) > rangeSq || target.distance < this.holdThreshold) {
        target = this.acquireTarget(s, rangeSq)
        s.targetId = target?.id ?? null
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
          if (!e || this.elapsed < e.stunUntil) continue
          taken += e.type.meleeDps
          if (s.profile.thorns > 0) this.damageEnemy(e, s.profile.thorns * dt, s.id, false, s.profile.damageType, true)
        }
        s.hp -= taken * (1 - s.reduction) * mitigation * dt
        if (s.hp <= 0) this.downSentinel(s)
      }
    }
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
      if (e.distance < this.holdThreshold) continue // hold fire until past the point
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

  private updateEnemies(dt: number): void {
    const survivors: RtEnemy[] = []
    for (const e of this.enemies) {
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt * 4)

      // Burn DoT
      if (this.elapsed < e.burnUntil && e.burnDps > 0) {
        this.damageEnemy(e, e.burnDps * dt, undefined, false, 'magic', true)
        if (e.hp <= 0) continue
      }

      const stunned = this.elapsed < e.stunUntil
      const chill = this.elapsed < e.chillUntil ? e.chillSlow : 0
      if (!stunned && !e.blockedBy) {
        e.distance += e.type.speed * (1 - chill) * dt
      }

      if (e.distance >= this.path.length) {
        this.baseHp -= e.type.leak
        this.leaks += e.type.leak
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

  private impact(p: RtProjectile, primary: RtEnemy | undefined): void {
    const hitList: RtEnemy[] = []
    if (p.splashRadius > 0) {
      const r2 = p.splashRadius * p.splashRadius
      for (const e of this.enemies) if (distSq(e.pos, p.pos) <= r2) hitList.push(e)
    } else {
      if (primary) hitList.push(primary)
      if (p.pierce > 0) {
        const extra = this.enemies
          .filter((e) => e !== primary && distSq(e.pos, p.pos) <= 60 * 60)
          .slice(0, p.pierce)
        hitList.push(...extra)
      }
    }

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
    // Execute: kill outright if already below the threshold.
    if (p.mods.execute && e.hp / e.maxHp <= p.mods.execute) {
      this.spawnFloater(e.pos, 'EXECUTE', '#ff5d5d', true)
      const src = this.sentinels.find((x) => x.id === p.srcId)
      if (src) src.procFlash = 1
      this.killEnemy(e, p.srcId)
      return
    }
    this.damageEnemy(e, p.damage, p.srcId, p.isCrit, p.damageType, false)

    // On-hit statuses (only if the enemy is still alive).
    if (e.hp > 0) {
      const src = p.srcId ? this.sentinels.find((x) => x.id === p.srcId) : undefined
      if (p.mods.burn) {
        const fresh = this.elapsed >= e.burnUntil
        e.burnDps = Math.max(e.burnDps, p.mods.burn.dps)
        e.burnUntil = Math.max(e.burnUntil, this.elapsed + p.mods.burn.dur)
        if (fresh && src) src.procFlash = 1
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

    // Life-drain heals the base.
    if (p.lifedrain > 0 && this.baseHp < this.maxBaseHp) {
      this.baseHp = Math.min(this.maxBaseHp, this.baseHp + p.damage * p.lifedrain * 0.02)
    }
  }

  private damageEnemy(
    e: RtEnemy,
    amount: number,
    srcId: string | undefined,
    isCrit: boolean,
    type: 'physical' | 'magic',
    quiet: boolean,
  ): void {
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

  private updateTraps(dt: number): void {
    for (const t of this.traps) {
      const r2 = TRAP_RADIUS * TRAP_RADIUS
      for (const e of this.enemies) {
        if (distSq(e.pos, t.pos) > r2) continue
        this.damageEnemy(e, t.dps * dt, undefined, false, 'physical', true)
        if (e.hp > 0 && t.slow > 0) {
          e.chillSlow = Math.max(e.chillSlow, t.slow)
          e.chillUntil = Math.max(e.chillUntil, this.elapsed + 0.4)
        }
      }
    }
  }

  private downSentinel(s: RtSentinel): void {
    s.hp = 0
    s.downed = true
    s.blockIds = []
    s.targetId = null
    s.patienceStacks = 0
    s.patienceTime = 0
    this.downedCount++
    this.spawnFloater(s.pos, 'DOWN', '#e05a4f', true)
  }

  private spawnFloater(pos: Vec2, text: string, color: string, big: boolean): void {
    if (this.floaters.length > 70) this.floaters.shift()
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
