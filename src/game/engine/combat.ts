import { clamp } from '../core/vec'
import { getNode, mergeMods } from '../data/archetypeTree'
import { MAX_PATH_LEVEL, UPGRADE_PATHS, pathModsUpTo } from '../data/upgradeTree'
import type { CoreStats, EffectMods, Equipment, Item, Sentinel } from '../types'

/**
 * Effective upgrade-path level for each path: bought levels plus free levels
 * granted by equipped items and mutations, capped at the path maximum.
 */
export function effectiveUpgradeLevels(s: Sentinel): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of UPGRADE_PATHS) out[p.id] = s.upgrades?.[p.id] ?? 0
  const addGrant = (g?: { path: string; levels: number }) => {
    if (g && out[g.path] != null) out[g.path] += g.levels
  }
  for (const it of [s.equipment.mainHand, s.equipment.offHand, s.equipment.body]) addGrant(it?.grantUpgrade)
  for (const m of s.mutations ?? []) addGrant(m.grantUpgrade)
  for (const k of Object.keys(out)) out[k] = Math.min(MAX_PATH_LEVEL, out[k])
  return out
}

/** EffectMods contributed by a Sentinel's effective upgrade-path levels. */
function upgradeModsFor(s: Sentinel): EffectMods[] {
  const levels = effectiveUpgradeLevels(s)
  const out: EffectMods[] = []
  for (const [pathId, lvl] of Object.entries(levels)) out.push(...pathModsUpTo(pathId, lvl))
  return out
}

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
  /** Physical-defense for block mitigation (fighter Guardian line only). */
  physDef: number
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
  acc.critChance += b.critChance ?? 0
  acc.rangeMult += b.rangeMult ?? 0
  acc.splashAdd += b.splashAdd ?? 0
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
  addItem(acc, equipment.offHand)
  addItem(acc, equipment.body)
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
  const mutationMods = s.mutations?.map((m) => m.mods) ?? []
  const upgradeMods = upgradeModsFor(s)
  const mods = mergeMods([...branchMods, ...mutationMods, ...upgradeMods, ...gear.mods, ...(ctx.teamMods ?? [])])

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
  const range = base.range * ((mods.rangeMult ?? 1) + gear.rangeMult)
  const critChance = clamp(base.critChance + st.dex * 0.004 + (mods.critChanceAdd ?? 0) + gear.critChance, 0, 0.95)
  const critMult = base.critMult + (mods.critMultAdd ?? 0)
  const splashRadius = base.splashRadius + (mods.splashAdd ?? 0) + gear.splashAdd
  const maxHp = Math.round((70 + st.str * 9) * (mods.hpMult ?? 1))
  const thorns = (s.thorns + gear.thorns) * (mods.thornsMult ?? 1)

  const avgCrit = 1 + critChance * (critMult - 1)
  const dps = damage * rate * avgCrit

  return {
    damage,
    range,
    rate,
    projectileSpeed: base.projectileSpeed * (mods.projSpeedMult ?? 1),
    splashRadius,
    critChance,
    critMult,
    damageType: base.damageType,
    maxHp,
    startMissingFrac: mods.selfSacrifice ?? 0,
    thorns,
    physDef: Math.max(0, mods.physDefAdd ?? 0),
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
