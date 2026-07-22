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

/**
 * Additive/multiplicative combat modifiers contributed by archetype branches,
 * gear enchantments, and keepsakes. Merged by mergeMods() in the archetype tree.
 * Multipliers default to 1 and multiply; adds default to 0 and sum; status
 * objects take the strongest when stacked.
 */
export interface EffectMods {
  damageMult?: number
  rateMult?: number
  rangeMult?: number
  hpMult?: number
  splashAdd?: number
  critChanceAdd?: number
  critMultAdd?: number
  /** Extra enemies a projectile passes through (marksman). */
  pierce?: number
  /** Damage-over-time on hit. */
  burn?: { dps: number; dur: number }
  /** Movement slow on hit (slow = fraction, 0..1). */
  chill?: { slow: number; dur: number }
  /** Chain lightning: hit `chains` nearby enemies for `dmgFrac` of the hit. */
  shock?: { chains: number; dmgFrac: number }
  stunChance?: number
  stunDur?: number
  /** Instantly kill targets below this HP fraction (assassin). */
  execute?: number
  /** This Sentinel halts up to `count` enemies within `radius` (fighter line). */
  block?: { count: number; radius: number }
  /** Multiplies the Sentinel's Thorns reflect. */
  thornsMult?: number
  /** Heal allied Sentinels in radius, HP/sec (cleric). */
  healAura?: { hps: number; radius: number }
  /** Buff allied Sentinel damage in radius (cleric/guard). */
  buffAura?: { damageMult: number; radius: number }
  /** Reduce melee damage taken by allies in radius, 0..1 (guard). */
  dmgReductionAura?: { reduction: number; radius: number }
  /** Return a fraction of damage dealt as base-HP healing (warlock). */
  lifedrain?: number
  /** Spend this fraction of max HP at wave start for a damage bonus (warlock). */
  selfSacrifice?: number
  /** Drop a persistent hazard on the path near this Sentinel (trickster). */
  trap?: { dps: number; slow: number }
}

export type ItemSlot = 'weapon' | 'armor' | 'trinket'
export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary'

/** A rolled affix on an item — flat stat bonuses and/or combat mods. */
export interface Enchantment {
  id: string
  label: string
  stats?: Partial<CoreStats>
  thorns?: number
  patience?: number
  mods?: EffectMods
}

export interface Item {
  id: string
  name: string
  slot: ItemSlot
  rarity: ItemRarity
  /** Flat base stat block. */
  base: {
    physDamage?: number
    magDamage?: number
    attackSpeed?: number
    physDef?: number
    magDef?: number
    hp?: number
  }
  enchantments: Enchantment[]
  /** Keepsakes (a trinket variant) buff the whole team instead of one Sentinel. */
  keepsake?: boolean
}

/** Gear slots on a Sentinel. Items are defined in game/data/items.ts (M3). */
export interface Equipment {
  weapon: Item | null
  armor: Item | null
  trinket: Item | null
}

/** A recruited tower unit. The persistent, between-wave definition. */
export interface Sentinel {
  id: string
  name: string
  archetype: Archetype
  /** Node ids from the archetype tree, tier 0 → current, e.g. ['fighter','knight']. */
  branchPath: string[]
  stats: CoreStats
  /** Secondary: reflect damage back at melee attackers. */
  thorns: number
  /** Secondary: scales stat gain the longer a Sentinel survives a wave un-KO'd. */
  patience: number
  /** Base attack from the tier-0 archetype; branches/gear modify it via mods. */
  attack: AttackProfile
  level: number
  xp: number
  equipment: Equipment
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
  /** Melee damage dealt to a Sentinel that blocks it, per second. */
  meleeDps: number
  /** Physical damage resistance, 0..1 (reduces incoming physical). */
  physResist?: number
  /** Magic damage resistance, 0..1. */
  magResist?: number
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
