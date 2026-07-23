import type { Archetype, AttackProfile, CoreStats, EffectMods } from '../types'

/**
 * The Sentinel progression tree: 3 base archetypes → 9 sub-archetypes (tier 1,
 * unlocked at level 10) → 27 specializations (tier 2, level 20).
 *
 * Abilities are data, not code: each node contributes stat grants and `EffectMods`
 * that the engine reads. This keeps 27 distinct builds real while the engine
 * implements ~16 effect primitives once. Gear enchantments (M3) reuse EffectMods.
 */
export interface TreeNode {
  id: string
  name: string
  tier: 0 | 1 | 2
  parent: string | null
  archetype: Archetype
  /** One-line identity. */
  blurb: string
  /** Ability preview shown on the evolution card. */
  ability: string
  /** Stats granted when this node is chosen (evolutions) or the base (tier 0). */
  grant?: { stats?: Partial<CoreStats>; thorns?: number; patience?: number }
  mods?: EffectMods
  // Tier-0 only:
  base?: AttackProfile
  baseStats?: CoreStats
  baseThorns?: number
  basePatience?: number
  color?: string
  accent?: string
}

const HUES: Record<Archetype, { color: string; accent: string }> = {
  fighter: { color: '#d9743f', accent: '#f0a868' },
  rogue: { color: '#4fae72', accent: '#88e0a8' },
  mystic: { color: '#5b8cd6', accent: '#9ec1f0' },
}

// ---------------------------------------------------------------- Tier 0
const TIER0: TreeNode[] = [
  {
    id: 'fighter',
    name: 'Fighter',
    tier: 0,
    parent: null,
    archetype: 'fighter',
    blurb: 'Frontline bruiser who holds the line.',
    ability: 'Blocks up to 2 enemies at close range.',
    base: {
      damage: 26,
      range: 96,
      rate: 0.95,
      projectileSpeed: 560,
      splashRadius: 0,
      critChance: 0.05,
      critMult: 1.5,
      damageType: 'physical',
    },
    baseStats: { str: 12, dex: 6, int: 3 },
    baseThorns: 8,
    basePatience: 5,
    mods: { block: { count: 2, radius: 72 }, physDefAdd: 20 },
    ...HUES.fighter,
  },
  {
    id: 'rogue',
    name: 'Rogue',
    tier: 0,
    parent: null,
    archetype: 'rogue',
    blurb: 'Single-target burst with high crit.',
    ability: 'Fast, long-range strikes that crit often.',
    base: {
      damage: 14,
      range: 168,
      rate: 2.1,
      projectileSpeed: 760,
      splashRadius: 0,
      critChance: 0.28,
      critMult: 2.0,
      damageType: 'physical',
    },
    baseStats: { str: 6, dex: 12, int: 4 },
    baseThorns: 2,
    basePatience: 4,
    ...HUES.rogue,
  },
  {
    id: 'mystic',
    name: 'Mystic',
    tier: 0,
    parent: null,
    archetype: 'mystic',
    blurb: 'Area control and elemental damage.',
    ability: 'Splashes magic damage on impact.',
    base: {
      damage: 16,
      range: 150,
      rate: 0.8,
      projectileSpeed: 480,
      splashRadius: 58,
      critChance: 0.05,
      critMult: 1.5,
      damageType: 'magic',
    },
    baseStats: { str: 4, dex: 5, int: 13 },
    baseThorns: 2,
    basePatience: 4,
    ...HUES.mystic,
  },
]

// Compact builders to keep the 36 evolution nodes readable.
const t1 = (
  id: string,
  parent: Archetype,
  name: string,
  blurb: string,
  ability: string,
  grant: TreeNode['grant'],
  mods: EffectMods,
): TreeNode => ({ id, name, tier: 1, parent, archetype: parent, blurb, ability, grant, mods })

const t2 = (
  id: string,
  parent: string,
  archetype: Archetype,
  name: string,
  ability: string,
  grant: TreeNode['grant'],
  mods: EffectMods,
): TreeNode => ({ id, name, tier: 2, parent, archetype, blurb: ability, ability, grant, mods })

// ---------------------------------------------------------------- Tier 1 (9)
const TIER1: TreeNode[] = [
  // Fighter
  t1('warrior', 'fighter', 'Warrior', 'Pure damage.', 'Heavier, faster strikes.', { stats: { str: 8, dex: 3 }, thorns: 3, patience: 3 }, { damageMult: 1.25, rateMult: 1.1, physDefAdd: 6 }),
  t1('knight', 'fighter', 'Knight', 'Crowd control.', 'Bashes stun foes; holds 3 enemies.', { stats: { str: 7, dex: 2 }, thorns: 4, patience: 4 }, { stunChance: 0.18, stunDur: 0.7, block: { count: 3, radius: 80 }, physDefAdd: 16 }),
  t1('guard', 'fighter', 'Guard', 'Shields allies.', 'Reduces damage to nearby allies; strong thorns.', { stats: { str: 8, dex: 1 }, thorns: 8, patience: 5 }, { dmgReductionAura: { reduction: 0.2, radius: 120 }, block: { count: 3, radius: 85 }, thornsMult: 1.5, physDefAdd: 24 }),
  // Rogue
  t1('assassin', 'rogue', 'Assassin', 'Executes.', 'Instantly kills badly wounded foes.', { stats: { dex: 8, str: 2 }, patience: 3 }, { execute: 0.15, critChanceAdd: 0.1 }),
  t1('trickster', 'rogue', 'Trickster', 'Traps & debuffs.', 'Lays hazards that wound and slow.', { stats: { dex: 7, int: 3 }, patience: 3 }, { trap: { dps: 14, slow: 0.3 }, chill: { slow: 0.2, dur: 1 } }),
  t1('marksman', 'rogue', 'Marksman', 'Range & pierce.', 'Long shots that pierce one extra enemy.', { stats: { dex: 8, str: 1 }, patience: 3 }, { rangeMult: 1.5, pierce: 1, projSpeedMult: 1.4 }),
  // Mystic
  t1('elementalist', 'mystic', 'Elementalist', 'DoTs.', 'Splash that burns over time.', { stats: { int: 8, dex: 2 }, patience: 3 }, { burn: { dps: 12, dur: 3 }, splashAdd: 15 }),
  t1('cleric', 'mystic', 'Cleric', 'Heals & buffs.', 'Heals and empowers the Sentinel row.', { stats: { int: 7, str: 2 }, patience: 4 }, { healAura: { hps: 8, radius: 130 }, buffAura: { damageMult: 1.15, radius: 130 } }),
  t1('warlock', 'mystic', 'Warlock', 'Life-drain.', 'Drains life; sacrifices HP for power.', { stats: { int: 8, str: 2 }, patience: 2 }, { lifedrain: 0.2, selfSacrifice: 0.15, damageMult: 1.3 }),
]

// ---------------------------------------------------------------- Tier 2 (27)
const TIER2: TreeNode[] = [
  // Warrior
  t2('berserker', 'warrior', 'fighter', 'Berserker', 'Reckless: huge damage, thinner armor.', { stats: { str: 12, dex: 4 }, thorns: 4 }, { damageMult: 1.4, rateMult: 1.25, hpMult: 0.85 }),
  t2('juggernaut', 'warrior', 'fighter', 'Juggernaut', 'An immovable wall with punishing thorns.', { stats: { str: 10 }, thorns: 10, patience: 6 }, { hpMult: 1.6, block: { count: 4, radius: 90 }, thornsMult: 2, physDefAdd: 30 }),
  t2('weaponmaster', 'warrior', 'fighter', 'Weaponmaster', 'Precise strikes crit often and hard.', { stats: { str: 8, dex: 8 } }, { critChanceAdd: 0.2, critMultAdd: 0.6, damageMult: 1.2 }),
  // Knight
  t2('bulwark', 'knight', 'fighter', 'Bulwark', 'Fortress: blocks many, shields all.', { stats: { str: 10 }, thorns: 8, patience: 8 }, { block: { count: 5, radius: 95 }, dmgReductionAura: { reduction: 0.3, radius: 130 }, physDefAdd: 34 }),
  t2('vanguard', 'knight', 'fighter', 'Vanguard', 'A stunning charge with real damage.', { stats: { str: 10, dex: 4 } }, { stunChance: 0.25, stunDur: 0.9, damageMult: 1.25 }),
  t2('order_sentinel', 'knight', 'fighter', 'Sentinel of Order', 'Locks the lane with stun and chill.', { stats: { str: 8, int: 4 }, patience: 5 }, { stunChance: 0.3, stunDur: 0.8, chill: { slow: 0.4, dur: 1.5 } }),
  // Guard
  t2('aegis', 'guard', 'fighter', 'Aegis', 'An aura of protection for the whole line.', { stats: { str: 9 }, thorns: 8, patience: 8 }, { dmgReductionAura: { reduction: 0.4, radius: 150 }, block: { count: 3, radius: 85 }, physDefAdd: 26 }),
  t2('warden_of_ash', 'guard', 'fighter', 'Warden of Ash', 'Attackers burn themselves on thorns.', { stats: { str: 10 }, thorns: 16, patience: 6 }, { thornsMult: 3, block: { count: 4, radius: 90 }, physDefAdd: 22 }),
  t2('bannerman', 'guard', 'fighter', 'Bannerman', 'Rallies allies with damage and healing.', { stats: { str: 7, int: 4 }, patience: 6 }, { buffAura: { damageMult: 1.25, radius: 140 }, healAura: { hps: 6, radius: 120 } }),
  // Assassin
  t2('deathdealer', 'assassin', 'rogue', 'Deathdealer', 'Bigger executes, deadly crits.', { stats: { dex: 12, str: 3 } }, { execute: 0.22, critChanceAdd: 0.15, critMultAdd: 0.5 }),
  t2('nightblade', 'assassin', 'rogue', 'Nightblade', 'A blur of executing strikes.', { stats: { dex: 14 } }, { execute: 0.18, rateMult: 1.5 }),
  t2('reaper', 'assassin', 'rogue', 'Reaper', 'Reaps anything close to death.', { stats: { dex: 10, str: 4 } }, { execute: 0.28, damageMult: 1.2 }),
  // Trickster
  t2('saboteur', 'trickster', 'rogue', 'Saboteur', 'Devastating traps carpet the path.', { stats: { dex: 10, int: 4 } }, { trap: { dps: 30, slow: 0.35 } }),
  t2('venomancer', 'trickster', 'rogue', 'Venomancer', 'Poisons that rot foes over time.', { stats: { dex: 8, int: 6 } }, { burn: { dps: 18, dur: 4 }, trap: { dps: 12, slow: 0.3 } }),
  t2('hexblade', 'trickster', 'rogue', 'Hexblade', 'Curses that freeze and stun.', { stats: { dex: 9, int: 5 } }, { stunChance: 0.2, stunDur: 0.7, chill: { slow: 0.45, dur: 1.6 } }),
  // Marksman
  t2('sharpshooter', 'marksman', 'rogue', 'Sharpshooter', 'Extreme range, brutal crits.', { stats: { dex: 12, str: 2 } }, { rangeMult: 1.9, critChanceAdd: 0.25, critMultAdd: 0.4 }),
  t2('ranger', 'marksman', 'rogue', 'Ranger', 'Rapid piercing volleys.', { stats: { dex: 14 } }, { pierce: 3, rateMult: 1.35 }),
  t2('arbalest', 'marksman', 'rogue', 'Arbalest', 'Heavy bolts punch through ranks.', { stats: { dex: 9, str: 5 } }, { pierce: 2, damageMult: 1.5 }),
  // Elementalist
  t2('pyromancer', 'elementalist', 'mystic', 'Pyromancer', 'Infernos that spread and burn.', { stats: { int: 12 } }, { burn: { dps: 26, dur: 4 }, splashAdd: 25 }),
  t2('cryomancer', 'elementalist', 'mystic', 'Cryomancer', 'Freezing fields slow everything.', { stats: { int: 10, dex: 3 } }, { chill: { slow: 0.55, dur: 2.5 }, splashAdd: 20 }),
  t2('stormcaller', 'elementalist', 'mystic', 'Stormcaller', 'Lightning arcs between foes.', { stats: { int: 11, dex: 3 } }, { shock: { chains: 3, dmgFrac: 0.6 }, splashAdd: 10 }),
  // Cleric
  t2('radiant', 'cleric', 'mystic', 'Radiant', 'Powerful sustained healing.', { stats: { int: 10, str: 3 }, patience: 5 }, { healAura: { hps: 16, radius: 160 } }),
  t2('templar', 'cleric', 'mystic', 'Templar', 'Empowers the whole line.', { stats: { int: 9, str: 4 } }, { buffAura: { damageMult: 1.35, radius: 150 }, healAura: { hps: 6, radius: 120 } }),
  t2('oracle', 'cleric', 'mystic', 'Oracle', 'A balance of speed, heal, and buff.', { stats: { int: 11 }, patience: 4 }, { buffAura: { damageMult: 1.2, radius: 150 }, healAura: { hps: 10, radius: 150 }, rateMult: 1.15 }),
  // Warlock
  t2('soulflay', 'warlock', 'mystic', 'Soulflay', 'Massive drain and raw power.', { stats: { int: 12, str: 2 } }, { lifedrain: 0.35, selfSacrifice: 0.2, damageMult: 1.4 }),
  t2('plaguebringer', 'warlock', 'mystic', 'Plaguebringer', 'Plague clouds that devour ranks.', { stats: { int: 10, str: 3 } }, { burn: { dps: 22, dur: 5 }, splashAdd: 35, lifedrain: 0.15 }),
  t2('doomcaller', 'warlock', 'mystic', 'Doomcaller', 'Ruinous power at great personal cost.', { stats: { int: 13 } }, { selfSacrifice: 0.3, damageMult: 1.8, execute: 0.15 }),
]

export const ALL_NODES: TreeNode[] = [...TIER0, ...TIER1, ...TIER2]
const NODE_BY_ID = new Map(ALL_NODES.map((n) => [n.id, n]))

export function getNode(id: string): TreeNode {
  const n = NODE_BY_ID.get(id)
  if (!n) throw new Error(`Unknown tree node: ${id}`)
  return n
}

export function childrenOf(id: string): TreeNode[] {
  return ALL_NODES.filter((n) => n.parent === id)
}

export const BASE_ARCHETYPE_NODES = TIER0

/** Merge a list of EffectMods into one. Mults multiply, adds sum, statuses max. */
export function mergeMods(list: (EffectMods | undefined)[]): EffectMods {
  const out: EffectMods = {
    damageMult: 1,
    rateMult: 1,
    rangeMult: 1,
    hpMult: 1,
    projSpeedMult: 1,
    physDefAdd: 0,
    splashAdd: 0,
    critChanceAdd: 0,
    critMultAdd: 0,
    pierce: 0,
    thornsMult: 1,
    stunChance: 0,
    stunDur: 0,
    execute: 0,
    lifedrain: 0,
    selfSacrifice: 0,
  }
  const stronger = <T extends { [k: string]: number }>(a: T | undefined, b: T | undefined, key: keyof T): T | undefined => {
    if (!a) return b
    if (!b) return a
    return (a[key] as number) >= (b[key] as number) ? a : b
  }
  for (const m of list) {
    if (!m) continue
    if (m.damageMult != null) out.damageMult! *= m.damageMult
    if (m.rateMult != null) out.rateMult! *= m.rateMult
    if (m.rangeMult != null) out.rangeMult! *= m.rangeMult
    if (m.projSpeedMult != null) out.projSpeedMult! *= m.projSpeedMult
    if (m.hpMult != null) out.hpMult! *= m.hpMult
    if (m.thornsMult != null) out.thornsMult! *= m.thornsMult
    if (m.physDefAdd != null) out.physDefAdd! += m.physDefAdd
    if (m.splashAdd != null) out.splashAdd! += m.splashAdd
    if (m.critChanceAdd != null) out.critChanceAdd! += m.critChanceAdd
    if (m.critMultAdd != null) out.critMultAdd! += m.critMultAdd
    if (m.pierce != null) out.pierce! += m.pierce
    if (m.stunChance != null) out.stunChance! = Math.max(out.stunChance!, m.stunChance)
    if (m.stunDur != null) out.stunDur! = Math.max(out.stunDur!, m.stunDur)
    if (m.execute != null) out.execute! = Math.max(out.execute!, m.execute)
    if (m.lifedrain != null) out.lifedrain! += m.lifedrain
    if (m.selfSacrifice != null) out.selfSacrifice! += m.selfSacrifice
    out.burn = stronger(out.burn, m.burn, 'dps')
    out.chill = stronger(out.chill, m.chill, 'slow')
    out.shock = stronger(out.shock, m.shock, 'chains')
    out.block = stronger(out.block, m.block, 'count')
    out.healAura = stronger(out.healAura, m.healAura, 'hps')
    out.buffAura = stronger(out.buffAura, m.buffAura, 'damageMult')
    out.dmgReductionAura = stronger(out.dmgReductionAura, m.dmgReductionAura, 'reduction')
    out.trap = stronger(out.trap, m.trap, 'dps')
  }
  return out
}
