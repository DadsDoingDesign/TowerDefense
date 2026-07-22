import type { Vec2 } from './core/vec'

/** The three base archetypes. Sub-archetypes/specializations arrive in M2. */
export type Archetype = 'fighter' | 'rogue' | 'mystic'

/** Core stats. STR→physical/HP, DEX→speed/crit/dodge, INT→magic/ability power. */
export interface CoreStats {
  str: number
  dex: number
  int: number
}

/** How a sentinel's attack behaves. Extended per-branch in M2. */
export interface AttackProfile {
  /** Base damage per hit before crit/scaling. */
  damage: number
  /** Pixels; enemies within this radius of the slot can be targeted. */
  range: number
  /** Attacks per second. */
  rate: number
  /** Projectile travel speed in px/s. */
  projectileSpeed: number
  /** Radius of splash damage on impact (0 = single target). */
  splashRadius: number
  /** 0..1 chance to crit. */
  critChance: number
  /** Damage multiplier on crit. */
  critMult: number
  /** 'physical' | 'magic' — matters for defenses in M3. */
  damageType: 'physical' | 'magic'
}

/** A recruited tower unit. The persistent, between-wave definition. */
export interface Sentinel {
  id: string
  name: string
  archetype: Archetype
  stats: CoreStats
  attack: AttackProfile
  /** In-run experience (leveling lands in M2; tracked from M1). */
  level: number
  xp: number
  color: string
  accent: string
}

/** A fixed build position beside the path. */
export interface TowerSlot {
  id: string
  pos: Vec2
}

/** A map: the path plus the slots available to build on. */
export interface GameMap {
  id: string
  name: string
  /** Logical field size; the renderer scales this to the canvas. */
  width: number
  height: number
  path: Vec2[]
  slots: TowerSlot[]
  /** Where the base sits (end of path). */
  base: Vec2
}

/** An enemy archetype/template. */
export interface EnemyType {
  id: string
  name: string
  baseHp: number
  /** Path travel speed in px/s. */
  speed: number
  /** Gold granted on kill. */
  reward: number
  /** Base HP lost when this enemy leaks to the base. */
  leak: number
  radius: number
  color: string
  isBoss?: boolean
}

/** One scheduled spawn within a wave. */
export interface SpawnEvent {
  typeId: string
  /** Seconds after wave start to spawn. */
  at: number
  /** HP multiplier applied to the enemy template for this wave. */
  hpMult: number
}

export interface WaveDef {
  index: number
  label: string
  spawns: SpawnEvent[]
  isBoss: boolean
}

/** Mapping of which sentinel occupies which slot, for the setup phase. */
export type Placement = Record<string, string | null> // slotId -> sentinelId | null
