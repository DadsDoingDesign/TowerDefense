import { clamp } from '../core/vec'
import { getNode, mergeMods } from '../data/archetypeTree'
import { offHandShare } from '../data/items'
import { perkModsOf } from '../data/perks'
import { skillModsOf } from '../data/skills'
import type { CoreStats, EffectMods, Equipment, Item, Sentinel } from '../types'

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
 * Fold a Sentinel's branch nodes, gear, stats, and (optional) Patience/team mods
 * into a ready-to-use combat profile.
 */
export function computeCombat(s: Sentinel, ctx: CombatContext = {}): CombatProfile {
  const tier0 = getNode(s.branchPath[0])
  const base = tier0.base!

  const gear = gearOf(s.equipment)
  const branchMods = s.branchPath.map((id) => getNode(id).mods)
  const mutationMods = s.mutations?.map((m) => m.mods) ?? []
  // Spec perks (Phase 3b) sit where the per-hero upgrade tree's path levels
  // used to: chosen at levels 5 and 15, free, one line's rules per pick.
  const perkMods = perkModsOf(s)
  const mods = mergeMods([...branchMods, ...skillModsOf(s), ...mutationMods, ...perkMods, ...gear.mods, ...(ctx.teamMods ?? [])])

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
  const damage = (base.damage + flat) * (1 + damageStat * 0.04) * (mods.damageMult ?? 1)
  const rate = base.rate * (1 + st.dex * 0.02) * (mods.rateMult ?? 1) * (1 + gear.atkSpeed)
  const range = base.range * ((mods.rangeMult ?? 1) + gear.rangeMult)
  const critChance = clamp(base.critChance + st.dex * 0.004 + (mods.critChanceAdd ?? 0) + gear.critChance, 0, 0.95)
  const critMult = base.critMult + (mods.critMultAdd ?? 0)
  const splashRadius = base.splashRadius + (mods.splashAdd ?? 0) + gear.splashAdd
  const thorns = (s.thorns + gear.thorns) * (mods.thornsMult ?? 1)
  // "of Patience" gear was accumulated and then dropped on the floor (H10).
  const patience = s.patience + gear.patience

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
