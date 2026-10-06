import { clamp } from '../core/vec'
import { getNode, mergeMods } from '../data/archetypeTree'
import { heroStyle, offHandShare, shieldHold, shieldThorns, type HeroStyle } from '../data/items'
import { skillModsOf } from '../data/skills'
import { STYLE_LOOK } from '../data/gear'
import type { AttackProfile, CoreStats, EffectMods, Equipment, Item, Sentinel } from '../types'

/**
 * The attack each STYLE fights with — what a class used to decide, now read
 * off the weapon (`items.heroStyle`; the tree node is `gear.STYLE_LOOK`'s). The numbers are the three old tier-0
 * profiles, unchanged, so a sword fights as the Fighter did, a bow or a knife
 * as the Rogue, a wand or a staff as the Mystic.
 */
/**
 * Bare hands: a hero holding no weapon throws stones — weak, short, physical.
 * It never swings (no clearance) and it is never where a run is meant to be.
 */
export const UNARMED: AttackProfile = {
  damage: 8,
  range: 110,
  rate: 1,
  projectileSpeed: 560,
  splashRadius: 0,
  critChance: 0.05,
  critMult: 1.5,
  damageType: 'physical',
}

/** The base attack a style fights with (null: unarmed). */
export const styleBase = (style: HeroStyle | null): AttackProfile => (style ? getNode(STYLE_LOOK[style]).base! : UNARMED)

/** The hold circle a shield's hold uses (the old Fighter's). */
export const HOLD_RADIUS = 72

/** Gather team-wide EffectMods from every equipped keepsake across a roster. */
export function teamKeepsakeMods(roster: Sentinel[]): EffectMods[] {
  const out: EffectMods[] = []
  for (const s of roster) {
    for (const it of [s.equipment.mainHand, s.equipment.offHand, s.equipment.body]) {
      if (it?.keepsake) for (const e of it.enchantments) if (e.mods) out.push(e.mods)
    }
  }
  return out
}

/** Everything the engine needs to run a Sentinel's attacks and role effects. */
export interface CombatProfile {
  /** What the hero does, from its weapon (null: unarmed). */
  style: HeroStyle | null
  damage: number
  range: number
  rate: number
  projectileSpeed: number
  splashRadius: number
  critChance: number
  critMult: number
  damageType: 'physical' | 'magic'
  /** Damage per second ground into each enemy this Sentinel holds (blockers only). */
  thorns: number
  /** Patience including gear ("of Patience"), driving the stack ceiling. */
  patience: number
  mods: EffectMods
  /** Average sustained single-target DPS, for UI. */
  dps: number
}

interface GearContribution {
  stats: CoreStats
  thorns: number
  patience: number
  flatPhys: number
  flatMag: number
  atkSpeed: number
  critChance: number
  rangeMult: number
  splashAdd: number
  /** Summed `damagePct` (a Tome, a Plate): a multiplier on the hero's damage. */
  damagePct: number
  mods: EffectMods[]
}

function emptyGear(): GearContribution {
  return {
    stats: { str: 0, dex: 0, int: 0 },
    thorns: 0,
    patience: 0,
    flatPhys: 0,
    flatMag: 0,
    atkSpeed: 0,
    critChance: 0,
    rangeMult: 0,
    splashAdd: 0,
    damagePct: 0,
    mods: [],
  }
}

/**
 * `share` scales the item's weapon line — its flat damage and attack speed —
 * and nothing else: a knife or a wand in the OFF hand counts at
 * `OFF_HAND_SHARE` (`items.offHandShare`); its affixes count in full, like any
 * off-hand piece's.
 */
function addItem(acc: GearContribution, item: Item | null, share = 1): void {
  if (!item) return
  // Keepsakes buff the whole team via teamMods, not the holder locally.
  if (item.keepsake) return
  const b = item.base
  acc.flatPhys += (b.physDamage ?? 0) * share
  acc.flatMag += (b.magDamage ?? 0) * share
  acc.atkSpeed += (b.attackSpeed ?? 0) * share
  acc.critChance += b.critChance ?? 0
  acc.rangeMult += b.rangeMult ?? 0
  acc.splashAdd += b.splashAdd ?? 0
  acc.damagePct += b.damagePct ?? 0
  for (const e of item.enchantments) {
    if (e.stats) {
      acc.stats.str += e.stats.str ?? 0
      acc.stats.dex += e.stats.dex ?? 0
      acc.stats.int += e.stats.int ?? 0
    }
    acc.thorns += e.thorns ?? 0
    acc.patience += e.patience ?? 0
    if (e.mods) acc.mods.push(e.mods)
  }
}

/** Gather all gear contributions on a Sentinel (excludes team keepsakes). */
export function gearOf(equipment: Equipment): GearContribution {
  const acc = emptyGear()
  addItem(acc, equipment.mainHand)
  // A light weapon in the off hand is a second, lighter weapon (Q5); a main-hand
  // one-hander there (only under the Twinblade Harness) counts in full (Q4).
  addItem(acc, equipment.offHand, equipment.offHand ? offHandShare(equipment.offHand) : 1)
  addItem(acc, equipment.body)
  return acc
}

export interface CombatContext {
  /** Team-wide mods from relics (and legacy keepsakes). */
  teamMods?: EffectMods[]
  /** Patience multiplier applied to core stats (1 = none). */
  patienceMult?: number
}

/**
 * Fold a Sentinel's gear, skills, mutations, stats, and (optional)
 * Patience/team mods into a ready-to-use combat profile. There is no class:
 * the WEAPON decides the attack ({@link styleBase}) and a SHIELD the hold.
 */
export function computeCombat(s: Sentinel, ctx: CombatContext = {}): CombatProfile {
  const style = heroStyle(s)
  const base = styleBase(style)

  const gear = gearOf(s.equipment)
  const mutationMods = s.mutations?.map((m) => m.mods) ?? []
  // Skills (SK1) are the one way a hero grows: they sit where the evolution
  // nodes and the spec perks used to.
  const skillMods = skillModsOf(s)
  // A shield in the off hand holds enemies on the road; a bigger one holds more.
  const held = shieldHold(s.equipment.offHand)
  const shieldMods: EffectMods | undefined = held ? { block: { count: held, radius: HOLD_RADIUS } } : undefined
  const mods = mergeMods([shieldMods, ...skillMods, ...mutationMods, ...gear.mods, ...(ctx.teamMods ?? [])])
  // A hold skill adds onto the shield's hold — or, with no shield, is the hold.
  const extra = mods.holdAdd ?? 0
  if (mods.block || extra > 0) {
    mods.block = {
      count: (mods.block?.count ?? 0) + extra,
      radius: Math.max(mods.block?.radius ?? HOLD_RADIUS, mods.holdRadius ?? 0),
    }
  }

  const pMult = ctx.patienceMult ?? 1
  // Intended (L9d): Patience is a percentage buff on the unit's TOTAL core stats,
  // gear included — the same way every other multiplier here treats gear.
  const st = {
    str: (s.stats.str + gear.stats.str) * pMult,
    dex: (s.stats.dex + gear.stats.dex) * pMult,
    int: (s.stats.int + gear.stats.int) * pMult,
  }

  const isPhys = base.damageType === 'physical'
  const damageStat = isPhys ? st.str : st.int
  const flat = isPhys ? gear.flatPhys : gear.flatMag
  const damage = (base.damage + flat) * (1 + damageStat * 0.04) * (mods.damageMult ?? 1) * (1 + gear.damagePct)
  const rate = base.rate * (1 + st.dex * 0.02) * (mods.rateMult ?? 1) * (1 + gear.atkSpeed)
  const range = base.range * ((mods.rangeMult ?? 1) + gear.rangeMult)
  const critChance = clamp(base.critChance + st.dex * 0.004 + (mods.critChanceAdd ?? 0) + gear.critChance, 0, 0.95)
  const critMult = base.critMult + (mods.critMultAdd ?? 0)
  const splashRadius = base.splashRadius + (mods.splashAdd ?? 0) + gear.splashAdd
  const thorns = (s.thorns + gear.thorns + shieldThorns(s.equipment.offHand)) * (mods.thornsMult ?? 1)
  // "of Patience" gear was accumulated and then dropped on the floor (H10).
  const patience = s.patience + gear.patience

  const avgCrit = 1 + critChance * (critMult - 1)
  const dps = damage * rate * avgCrit

  return {
    style,
    damage,
    range,
    rate,
    projectileSpeed: base.projectileSpeed * (mods.projSpeedMult ?? 1),
    splashRadius,
    critChance,
    critMult,
    damageType: base.damageType,
    thorns,
    patience,
    mods,
    dps,
  }
}

/** Total core stats including gear (for the hero panel). */
export function totalStats(s: Sentinel): CoreStats {
  const gear = gearOf(s.equipment)
  return {
    str: s.stats.str + gear.stats.str,
    dex: s.stats.dex + gear.stats.dex,
    int: s.stats.int + gear.stats.int,
  }
}
