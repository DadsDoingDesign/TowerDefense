import type { Vec2 } from './core/vec'

/** The three base archetypes. Sub-archetypes/specializations arrive in M2. */
export type Archetype = 'fighter' | 'rogue' | 'mystic'

/** Core stats. STR→physical damage, DEX→speed/crit, INT→magic damage. Heroes have no HP. */
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
  /** Projectile-speed multiplier — faster shots reach targets sooner (marksman). */
  projSpeedMult?: number
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
  /**
   * This Sentinel's thorns are a **strike**: the grind it puts on everything it
   * blocks applies its {@link burn} as well as its reflect damage.
   *
   * Statuses are otherwise written in exactly one place — `engine.applyHit`,
   * reachable only from a projectile impact — so a blocker's melee retaliation
   * could not light anything, and `Warden of Ash` ("Everything it holds burns on
   * its thorns") sold a mechanism the engine did not have. Opt-in rather than
   * universal; the reasoning is in `engine.igniteFromThorns`.
   */
  thornsIgnite?: boolean
  /** Buff allied Sentinel damage in radius (cleric/bannerman). */
  buffAura?: { damageMult: number; radius: number }
  /** Return a fraction of damage dealt as base-HP healing (warlock). */
  lifedrain?: number
  /** Drop a persistent hazard on the path near this Sentinel (trickster). */
  trap?: { dps: number; slow: number }

  // ---- rule capabilities (Phase 3b) ---------------------------------------
  // Spec perks and relics that change a RULE rather than add a percentage.
  // Each is read in exactly one place in `engine.ts`, and each is off unless a
  // source grants it, so a hero without one fights exactly as before.
  /** Every `every`th shot this hero fires pierces `pierce` extra enemies. */
  volley?: { every: number; pierce: number }
  /** Every `n`th shot this hero fires is a guaranteed crit. */
  critEvery?: number
  /** A kill makes this hero attack `rate` faster (×(1+rate)) for `dur` seconds. */
  killRush?: { rate: number; dur: number }
  /** For the first `dur` seconds of a wave this hero attacks `rate` faster. */
  openingRush?: { rate: number; dur: number }
  /** TEAM rule: the first `n` enemies to reach the Gate each wave cost it nothing. */
  leakWard?: number
  /**
   * TEAM rule (Phase 3a capability, granted by the Ember Urn relic): a burning
   * enemy that dies spreads its burn to its nearest neighbours
   * (`engine.onDeath`, `SPREAD_COUNT` / `SPREAD_RADIUS`).
   */
  burnSpreadOnDeath?: boolean
}

/** A run-acquired attack mutation applied to one hero (rolled at the mid-map fork). */
export interface Mutation {
  id: string
  key: string
  name: string
  desc: string
  /** Mutations are always Mythic quality — the super-rare top tier. */
  rarity: ItemRarity
  mods: EffectMods
  /** One-line summary of the downside this mutation trades for its power. */
  downside: string
  /** Legacy (v6 saves): a free upgrade-path level. The tree is gone; v7 migration folds it away. */
  grantUpgrade?: UpgradeGrant
}

/** What kind of item this is — determines which hero slot(s) it can occupy. */
export type ItemSlot = 'oneHand' | 'twoHand' | 'offHand' | 'body'
/** The equip slots on a hero. A two-hand item fills mainHand and blocks offHand. */
export type HeroSlot = 'mainHand' | 'offHand' | 'body'
export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'

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
  /**
   * Flat base stat block. Weapons carry damage + attack speed; off-hands and
   * body items carry universally-useful offense/utility (crit, range, splash)
   * so no equip slot is dead on a tower that never gets hit. Defensive stats
   * (HP/armour) live on the fighter "Guardian" tree, not on gear.
   */
  base: {
    physDamage?: number
    magDamage?: number
    /** Attack-rate bonus fraction (e.g. 0.05 = +5% rate). Weapons + off-hands. */
    attackSpeed?: number
    /** Flat crit-chance add (e.g. 0.05 = +5%). Off-hands. */
    critChance?: number
    /** Range multiplier bonus fraction (e.g. 0.1 = +10% range). Body. */
    rangeMult?: number
    /** Flat splash-radius add in px. Body. */
    splashAdd?: number
  }
  enchantments: Enchantment[]
  /** Keepsakes (a trinket variant) buff the whole team instead of one Sentinel. */
  keepsake?: boolean
  /** Legacy (v6 saves): a free upgrade-path level. v7 migration turns it into the Mythic Edge enchant. */
  grantUpgrade?: UpgradeGrant
}

/** Gear slots on a Sentinel: two hands + a body slot. One item per slot. */
export interface Equipment {
  mainHand: Item | null
  offHand: Item | null
  body: Item | null
}

/** A recruited tower unit. The persistent, between-wave definition. */
export interface Sentinel {
  id: string
  name: string
  archetype: Archetype
  /** Node ids from the archetype tree, tier 0 → current, e.g. ['fighter','knight']. */
  branchPath: string[]
  stats: CoreStats
  /** Secondary: damage per second ground into every enemy this Sentinel holds. */
  thorns: number
  /** Secondary: scales stat gain the longer a wave goes on. */
  patience: number
  // NOTE: the base attack is NOT stored here — combat.ts reads it live from the
  // tier-0 archetype node, so evolutions/gear never desync from a stale copy (L1).
  level: number
  xp: number
  equipment: Equipment
  /** Attack mutations rolled at the mid-map fork; merged into combat mods. */
  mutations?: Mutation[]
  /**
   * Spec perks taken, in milestone order: `perks[0]` at level 5, `perks[1]` at
   * level 15 (Phase 3b — `data/perks.ts`).
   */
  perks?: string[]
  /**
   * LEGACY: bought levels of the per-hero upgrade tree the perks replaced.
   * Nothing reads it; a v6 save's levels are refunded as gold on load
   * (`runSnapshot.migrateSnapshot`) and the field is dropped.
   */
  upgrades?: Record<string, number>
  color: string
  accent: string
}

/** A free grant of upgrade-path levels carried by an item or mutation. */
export interface UpgradeGrant {
  path: string
  levels: number
}

/**
 * A place a hero can stand: one OPEN deployment tile (G1-2). The id is the
 * tile's landscape grid id (`c{col}r{row}`, `data/terrain.ts`), shared by both
 * twins of a field.
 */
export interface TowerSlot {
  id: string
  pos: Vec2
}

/** What fills a blocked deployment tile (G1-2, `data/terrain.ts`). */
export type TerrainKind = 'lane' | 'forest' | 'rock' | 'water' | 'fire'

/** A map challenge, as a terrain rule (G1-2): what the battle's field adds. */
export type TerrainRuleId = 'flooded' | 'wildfire'

/**
 * One tile of the deployment grid, open or blocked. `col`/`row` are in the
 * DRAWN orientation (a portrait twin's are transposed), `pos` is its centre.
 */
export interface FieldTile {
  id: string
  pos: Vec2
  col: number
  row: number
  /** What stops a hero standing here, or null for open grass. */
  block: TerrainKind | null
  /**
   * Q1 danger ground: an OPEN tile a hero may stand on, at a cost
   * (`data/hazards.ts`). Absent on ordinary grass and on every blocked tile.
   */
  danger?: DangerKind
}

/** What makes an open tile dangerous to stand on (Q1, `data/hazards.ts`). */
export type DangerKind = 'cursed'

/** A map: the path plus the slots available to build on. */
export interface GameMap {
  id: string
  name: string
  /** Logical field size; the renderer scales this to the canvas. */
  width: number
  height: number
  path: Vec2[]
  /** The OPEN deployment tiles — where a hero may stand (G1-2). */
  slots: TowerSlot[]
  /** Edge of one deployment tile in field px (G1-2). */
  tile?: number
  /** Every deployment tile, open and blocked, row-major in landscape order. */
  tiles?: FieldTile[]
  /** The battle's map challenge, when it has one (G1-2). */
  terrainRule?: TerrainRuleId
  /**
   * Q1: the seed this battle's danger ground and seeded obstacles were laid
   * from (`data/hazards.ts`). Absent on a field without them.
   */
  hazardSeed?: number
  /**
   * The seeded field this map is a variant of (a terrain rule on it). Absent
   * on the base fields; see `maps.fieldIdOf`.
   */
  baseId?: string
  /** Where the base sits (end of path). */
  base: Vec2
  /**
   * Which way up this field is drawn (Portrait battlefields). Absent means
   * `landscape` — every map in `ALL_MAPS` is the landscape original.
   */
  orientation?: 'landscape' | 'portrait'
  /**
   * The id of the landscape field this one is the portrait twin of. The run's
   * seeded field identity (`pickBattleMap`, the snapshot's `battleMapId`, the
   * music cue) is always the twin's id, never this map's.
   */
  twinOf?: string
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
  /** Physical damage resistance, 0..1 (reduces incoming physical). */
  physResist?: number
  /** Magic damage resistance, 0..1. */
  magResist?: number
  isBoss?: boolean
  /**
   * What this enemy DOES, beyond walking and swinging (Phase 3a). Each entry is
   * a declarative capability the engine resolves in `engine.ts`; the numbers
   * and the per-faction assignment live in `src/game/data/behaviours.ts`.
   * Absent = a plain walker, which is what every enemy was before.
   */
  behaviours?: readonly EnemyBehaviour[]
}

/**
 * The enemy behaviour kit (Phase 3a). One union member per capability, so a
 * new behaviour is a new member and a new `case` in the engine — never a
 * special case keyed on an enemy id.
 *
 * Every member has a telegraph (`src/game/render/telegraphs.ts`), an engine
 * event (`behaviour:<kind>` or `bossPhase`), a counter the balance harness
 * reads (`BehaviourStats`), and a counterplay stated in `behaviours.ts`.
 */
export type EnemyBehaviour =
  /** Torch shaman: every `interval` s, heal allies within `radius` by `heal` × their max HP. */
  | { kind: 'healPulse'; radius: number; heal: number; interval: number }
  /** Torch berserker: below `below` of max HP, moves `speedMult`× faster. */
  | { kind: 'enrage'; below: number; speedMult: number }
  /**
   * TNT sapper: heads for the Gate. If it reaches it, it blows there: the Gate
   * takes `gateDamage` on top of its leak. Held by a blocker, it goes off at the
   * wall harmlessly and counts as that hero's kill. `radius` is the blast ring
   * the renderer draws.
   */
  | { kind: 'sapper'; radius: number; gateDamage: number }
  /**
   * TNT bomber: within `range` px of the Gate (along the road) it plants its
   * feet and winds up for `windup` s (telegraphed circle on the Gate); then the
   * Gate takes `gateDamage`. Killing it during the windup cancels the throw.
   * `charges` throws per bomber; `radius` is the drawn mark.
   */
  | { kind: 'lob'; range: number; radius: number; gateDamage: number; windup: number; charges: number }
  /** Barrel splitter: on death, breaks into `count` × `into`, each with `hpFrac` of this body's max HP. */
  | { kind: 'split'; into: string; count: number; hpFrac: number }
  /** Shield-bearer: allies (not itself) within `radius` gain `resist` flat to both resistances. */
  | { kind: 'shieldAura'; radius: number; resist: number }
  /** Leaper: the first time a blocker would hold it, it vaults `distance` px down the lane instead. */
  | { kind: 'leap'; distance: number }
  /** Boss (Grukk): at each HP fraction in `at`, a `windup`-s war-cry, then allies in `radius` move `speedMult`× for `dur` s. */
  | { kind: 'warCry'; at: readonly number[]; windup: number; radius: number; speedMult: number; dur: number }
  /**
   * Boss (Powderkeg King): first at `first` s, then every `interval` s, lobs
   * TNT at the Gate from wherever he stands; after `windup` s the Gate takes
   * `gateDamage`. Below `rageAt` of max HP the interval becomes `rageInterval`.
   * `radius` is the drawn mark.
   */
  | {
      kind: 'kingLob'
      interval: number
      first: number
      windup: number
      radius: number
      gateDamage: number
      rageAt: number
      rageInterval: number
    }
  /**
   * Boss (Colossus Keg): at `at` of max HP, breaks into `count` halves, each
   * carrying `hpShare` of what was left (0.5 over two halves conserves HP;
   * more makes the split a second act rather than a relabel).
   */
  | { kind: 'bossSplit'; at: number; count: number; hpShare: number; speedMult: number; radius: number }

export type EnemyBehaviourKind = EnemyBehaviour['kind']

/** One scheduled spawn within a wave. */
export interface SpawnEvent {
  typeId: string
  /**
   * Seconds after the START OF ITS SUB-WAVE to spawn. With no `group` this is
   * seconds after wave start, which is what every wave was before sub-waves.
   */
  at: number
  /** HP multiplier applied to the enemy template for this wave. */
  hpMult: number
  /**
   * Which sub-wave this spawn belongs to (0-based; Phase 3a). A group starts
   * only once the previous one is cleared and its breather has passed. Absent
   * = group 0, so a hand-built wave is one sub-wave, exactly as before.
   */
  group?: number
}

export interface WaveDef {
  index: number
  label: string
  spawns: SpawnEvent[]
  isBoss: boolean
}

/** Mapping of which sentinel occupies which open tile, for the setup phase. */
export type Placement = Record<string, string | null> // tileId -> sentinelId | null

/** Team-wide targeting priority. */
export type FocusMode = 'first' | 'lowestHp' | 'strongest' | 'nearest' | 'threat'

/** Team-wide behavior modifiers set before a wave. */
export interface Tactics {
  focus: FocusMode
}
