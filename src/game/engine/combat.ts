import { clamp } from '../core/vec'
import { getNode, mergeMods } from '../data/archetypeTree'
import type { CoreStats, EffectMods, Equipment, Item, Sentinel } from '../types'

/** Gather team-wide EffectMods from every equipped keepsake across a roster. */
export function teamKeepsakeMods(roster: Sentinel[]): EffectMods[] {
  const out: EffectMods[] = []
  for (const s of roster) {
    const t = s.equipment.trinket
    if (t?.keepsake) for (const e of t.enchantments) if (e.mods) out.push(e.mods)
  }
  return out
}

/** Everything the engine needs to run a Sentinel's attacks and role effects. */
export interface CombatProfile {
  damage: number
  range: number
  rate: number
  projectileSpeed: number
  splashRadius: number
  critChance: number
  critMult: number
  damageType: 'physical' | 'magic'
  maxHp: number
  /** Fraction of max HP the unit starts a wave missing (warlock self-sacrifice). */
  startMissingFrac: number
  thorns: number
  physDef: number
  magDef: number
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
  physDef: number
  magDef: number
  hp: number
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
    physDef: 0,
    magDef: 0,
    hp: 0,
    mods: [],
  }
}

function addItem(acc: GearContribution, item: Item | null): void {
  if (!item) return
  // Keepsakes buff the whole team via teamMods, not the holder locally.
  if (item.keepsake) return
  const b = item.base
  acc.flatPhys += b.physDamage ?? 0
  acc.flatMag += b.magDamage ?? 0
  acc.atkSpeed += b.attackSpeed ?? 0
  acc.physDef += b.physDef ?? 0
  acc.magDef += b.magDef ?? 0
  acc.hp += b.hp ?? 0
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
  addItem(acc, equipment.weapon)
  addItem(acc, equipment.armor)
  addItem(acc, equipment.trinket)
  return acc
}

export interface CombatContext {
  /** Team-wide mods from keepsakes and cleric/guard auras resolved at runtime. */
  teamMods?: EffectMods[]
  /** Patience multiplier applied to core stats (1 = none). */
  patienceMult?: number
}

/**
 * Fold a Sentinel's branch nodes, gear, stats, and (optional) Patience/team mods
 * into a ready-to-use combat profile.
 */
export function computeCombat(s: Sentinel, ctx: CombatContext = {}): CombatProfile {
  const tier0 = getNode(s.branchPath[0])
  const base = tier0.base!

  const gear = gearOf(s.equipment)
  const branchMods = s.branchPath.map((id) => getNode(id).mods)
  const mods = mergeMods([...branchMods, ...gear.mods, ...(ctx.teamMods ?? [])])

  const pMult = ctx.patienceMult ?? 1
  const st = {
    str: (s.stats.str + gear.stats.str) * pMult,
    dex: (s.stats.dex + gear.stats.dex) * pMult,
    int: (s.stats.int + gear.stats.int) * pMult,
  }

  const isPhys = base.damageType === 'physical'
  const damageStat = isPhys ? st.str : st.int
  const flat = isPhys ? gear.flatPhys : gear.flatMag
  const sacBonus = 1 + (mods.selfSacrifice ?? 0)
  const damage = (base.damage + flat) * (1 + damageStat * 0.04) * (mods.damageMult ?? 1) * sacBonus
  const rate = base.rate * (1 + st.dex * 0.02) * (mods.rateMult ?? 1) * (1 + gear.atkSpeed)
  const range = base.range * (mods.rangeMult ?? 1)
  const critChance = clamp(base.critChance + st.dex * 0.004 + (mods.critChanceAdd ?? 0), 0, 0.95)
  const critMult = base.critMult + (mods.critMultAdd ?? 0)
  const splashRadius = base.splashRadius + (mods.splashAdd ?? 0)
  const maxHp = Math.round((70 + st.str * 9 + gear.hp) * (mods.hpMult ?? 1))
  const thorns = (s.thorns + gear.thorns) * (mods.thornsMult ?? 1)

  const avgCrit = 1 + critChance * (critMult - 1)
  const dps = damage * rate * avgCrit

  return {
    damage,
    range,
    rate,
    projectileSpeed: base.projectileSpeed,
    splashRadius,
    critChance,
    critMult,
    damageType: base.damageType,
    maxHp,
    startMissingFrac: mods.selfSacrifice ?? 0,
    thorns,
    physDef: gear.physDef,
    magDef: gear.magDef,
    mods,
    dps,
  }
}

/** Total core stats including gear (for the detail panel). */
export function totalStats(s: Sentinel): CoreStats {
  const gear = gearOf(s.equipment)
  return {
    str: s.stats.str + gear.stats.str,
    dex: s.stats.dex + gear.stats.dex,
    int: s.stats.int + gear.stats.int,
  }
}
