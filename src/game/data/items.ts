import { nextId, RNG } from '../core/rng'
import type { Enchantment, Item, ItemRarity, ItemSlot } from '../types'

export const RARITY_ORDER: ItemRarity[] = ['common', 'rare', 'epic', 'legendary']

export const RARITY: Record<
  ItemRarity,
  { label: string; budget: number; enchants: number; color: string; dropWeight: number }
> = {
  common: { label: 'Common', budget: 1.0, enchants: 0, color: '#c9d1cc', dropWeight: 58 },
  rare: { label: 'Rare', budget: 1.7, enchants: 1, color: '#7aa8f0', dropWeight: 28 },
  epic: { label: 'Epic', budget: 2.5, enchants: 2, color: '#c48ff0', dropWeight: 11 },
  legendary: { label: 'Legendary', budget: 3.6, enchants: 3, color: '#f0b868', dropWeight: 3 },
}

// ---- weapon subtypes give damage a physical/magic identity ----
interface WeaponType {
  name: string
  damageType: 'physical' | 'magic'
  speedBias: number
}
const WEAPONS: WeaponType[] = [
  { name: 'Blade', damageType: 'physical', speedBias: 0.05 },
  { name: 'Maul', damageType: 'physical', speedBias: 0 },
  { name: 'Bow', damageType: 'physical', speedBias: 0.06 },
  { name: 'Staff', damageType: 'magic', speedBias: 0 },
  { name: 'Wand', damageType: 'magic', speedBias: 0.06 },
  { name: 'Focus', damageType: 'magic', speedBias: 0.03 },
]
const ARMORS = ['Plate', 'Mail', 'Garb', 'Hide', 'Aegis']
const TRINKETS = ['Charm', 'Ring', 'Idol', 'Sigil', 'Totem']
const KEEPSAKES = ['Banner', 'Standard', 'Relic', 'Beacon', 'Oath']

// ---- enchantment pool (per-item) ----
interface EnchantTemplate {
  id: string
  label: string
  roll: (rng: RNG, budget: number) => Omit<Enchantment, 'id' | 'label'>
}

const round = (n: number) => Math.max(1, Math.round(n))

const ENCHANTS: EnchantTemplate[] = [
  { id: 'might', label: 'of Might', roll: (r, b) => ({ stats: { str: round(r.range(3, 6) * b) } }) },
  { id: 'precision', label: 'of Precision', roll: (r, b) => ({ stats: { dex: round(r.range(3, 6) * b) } }) },
  { id: 'insight', label: 'of Insight', roll: (r, b) => ({ stats: { int: round(r.range(3, 6) * b) } }) },
  { id: 'warding', label: 'of Warding', roll: (r, b) => ({ thorns: round(r.range(3, 7) * b) }) },
  { id: 'patience', label: 'of Patience', roll: (r, b) => ({ patience: round(r.range(2, 4) * b) }) },
  { id: 'cruelty', label: 'Cruel', roll: (r, b) => ({ mods: { critChanceAdd: r.range(0.04, 0.08) * b } }) },
  { id: 'heavy', label: 'Heavy', roll: (r, b) => ({ mods: { damageMult: 1 + r.range(0.06, 0.12) * b } }) },
  { id: 'swift', label: 'Swift', roll: (r, b) => ({ mods: { rateMult: 1 + r.range(0.05, 0.1) * b } }) },
  { id: 'flaming', label: 'Flaming', roll: (r, b) => ({ mods: { burn: { dps: round(r.range(6, 12) * b), dur: 3 } } }) },
  { id: 'frost', label: 'Frost', roll: (r, b) => ({ mods: { chill: { slow: Math.min(0.6, r.range(0.15, 0.3) * b), dur: 1.5 } } }) },
  { id: 'shocking', label: 'Shocking', roll: (r) => ({ mods: { shock: { chains: r.int(1, 2), dmgFrac: 0.5 } } }) },
  { id: 'piercing', label: 'Piercing', roll: (r) => ({ mods: { pierce: r.int(1, 2) } }) },
  { id: 'vampiric', label: 'Vampiric', roll: (r, b) => ({ mods: { lifedrain: r.range(0.1, 0.2) * b } }) },
  { id: 'executioner', label: 'Executioner', roll: (r, b) => ({ mods: { execute: Math.min(0.25, r.range(0.08, 0.14) * b) } }) },
]

// ---- keepsake pool (team-wide global mods) ----
const KEEPSAKE_ENCHANTS: EnchantTemplate[] = [
  { id: 'k_rally', label: 'of Rallying', roll: (r, b) => ({ mods: { damageMult: 1 + r.range(0.05, 0.1) * b } }) },
  { id: 'k_quicken', label: 'of Haste', roll: (r, b) => ({ mods: { rateMult: 1 + r.range(0.05, 0.09) * b } }) },
  { id: 'k_focus', label: 'of Focus', roll: (r, b) => ({ mods: { critChanceAdd: r.range(0.03, 0.06) * b } }) },
  { id: 'k_vigor', label: 'of Vigor', roll: (r, b) => ({ mods: { hpMult: 1 + r.range(0.1, 0.2) * b } }) },
  { id: 'k_barbs', label: 'of Barbs', roll: (r, b) => ({ mods: { thornsMult: 1 + r.range(0.3, 0.6) * b } }) },
]

function rollEnchantments(pool: EnchantTemplate[], count: number, budget: number, rng: RNG): Enchantment[] {
  const chosen: Enchantment[] = []
  const used = new Set<string>()
  let guard = 0
  while (chosen.length < count && guard++ < 40) {
    const t = rng.pick(pool)
    if (used.has(t.id)) continue
    used.add(t.id)
    chosen.push({ id: t.id, label: t.label, ...t.roll(rng, budget) })
  }
  return chosen
}

function baseFor(slot: ItemSlot, budget: number, rng: RNG, weapon?: WeaponType): Item['base'] {
  if (slot === 'weapon') {
    const w = weapon!
    const dmg = round(rng.range(5, 8) * budget)
    return w.damageType === 'physical'
      ? { physDamage: dmg, attackSpeed: w.speedBias * budget }
      : { magDamage: dmg, attackSpeed: w.speedBias * budget }
  }
  if (slot === 'armor') {
    return {
      physDef: round(rng.range(6, 10) * budget),
      magDef: round(rng.range(5, 9) * budget),
      hp: round(rng.range(16, 26) * budget),
    }
  }
  // trinket
  return { hp: round(rng.range(8, 14) * budget), magDef: round(rng.range(2, 5) * budget) }
}

const pickRarity = (rng: RNG): ItemRarity => {
  const total = RARITY_ORDER.reduce((s, r) => s + RARITY[r].dropWeight, 0)
  let roll = rng.range(0, total)
  for (const r of RARITY_ORDER) {
    roll -= RARITY[r].dropWeight
    if (roll <= 0) return r
  }
  return 'common'
}

export interface GenerateOpts {
  slot?: ItemSlot
  rarity?: ItemRarity
  keepsakeChance?: number
  /** Shift rarity odds upward, e.g. elite/boss loot. 0 = normal. */
  luck?: number
}

/** Generate a random item. */
export function generateItem(rng: RNG, opts: GenerateOpts = {}): Item {
  let rarity = opts.rarity ?? pickRarity(rng)
  // Luck: chance to bump rarity up a tier.
  if (opts.luck && !opts.rarity) {
    const idx = RARITY_ORDER.indexOf(rarity)
    if (idx < RARITY_ORDER.length - 1 && rng.chance(opts.luck)) rarity = RARITY_ORDER[idx + 1]
  }
  const cfg = RARITY[rarity]
  // Keepsakes only appear on unforced (random-slot) drops, never when a specific
  // weapon/armor/trinket slot was requested.
  const isKeepsake = opts.slot === undefined && rng.chance(opts.keepsakeChance ?? 0.12)
  const slot: ItemSlot = opts.slot ?? rng.pick(['weapon', 'armor', 'trinket'] as ItemSlot[])

  if (isKeepsake) {
    const noun = rng.pick(KEEPSAKES)
    const ench = rollEnchantments(KEEPSAKE_ENCHANTS, Math.max(1, cfg.enchants), cfg.budget, rng)
    return {
      id: nextId('itm'),
      name: `${cfg.label} ${noun} ${ench[0]?.label ?? ''}`.trim(),
      slot: 'trinket',
      rarity,
      base: {},
      enchantments: ench,
      keepsake: true,
    }
  }

  const weapon = slot === 'weapon' ? rng.pick(WEAPONS) : undefined
  const noun = slot === 'weapon' ? weapon!.name : slot === 'armor' ? rng.pick(ARMORS) : rng.pick(TRINKETS)
  const ench = rollEnchantments(ENCHANTS, cfg.enchants, cfg.budget, rng)
  const suffix = ench.find((e) => e.label.startsWith('of'))
  const prefix = ench.find((e) => !e.label.startsWith('of'))
  const name = `${prefix ? prefix.label + ' ' : ''}${cfg.label} ${noun}${suffix ? ' ' + suffix.label : ''}`
  return {
    id: nextId('itm'),
    name: name.trim(),
    slot,
    rarity,
    base: baseFor(slot, cfg.budget, rng, weapon),
    enchantments: ench,
  }
}

// ---- economy sinks ----
export function reforgeCost(item: Item): number {
  return { common: 20, rare: 35, epic: 60, legendary: 100 }[item.rarity]
}
export function upgradeCost(item: Item): number {
  // Cost to reach the NEXT tier from this one.
  return { common: 50, rare: 90, epic: 150, legendary: 0 }[item.rarity]
}
export function canUpgrade(item: Item): boolean {
  return RARITY_ORDER.indexOf(item.rarity) < RARITY_ORDER.length - 1
}

/** Reroll an item's enchantments (same slot count for its rarity). */
export function reforgeItem(item: Item, rng: RNG): Item {
  const cfg = RARITY[item.rarity]
  const pool = item.keepsake ? KEEPSAKE_ENCHANTS : ENCHANTS
  const count = item.keepsake ? Math.max(1, cfg.enchants) : cfg.enchants
  const ench = rollEnchantments(pool, count, cfg.budget, rng)
  return { ...item, enchantments: ench, name: renameFor(item, ench) }
}

/** Upgrade an item's rarity one tier: more base budget + an extra enchant slot. */
export function upgradeRarity(item: Item, rng: RNG): Item {
  if (!canUpgrade(item)) return item
  const next = RARITY_ORDER[RARITY_ORDER.indexOf(item.rarity) + 1]
  const cfg = RARITY[next]
  const scale = cfg.budget / RARITY[item.rarity].budget
  const base: Item['base'] = { ...item.base }
  for (const k of Object.keys(base) as (keyof Item['base'])[]) {
    if (base[k] != null) base[k] = k === 'attackSpeed' ? base[k]! * scale : Math.round(base[k]! * scale)
  }
  // Keep existing enchantments, add new ones to reach the higher slot count.
  const pool = item.keepsake ? KEEPSAKE_ENCHANTS : ENCHANTS
  const target = item.keepsake ? Math.max(1, cfg.enchants) : cfg.enchants
  const used = new Set(item.enchantments.map((e) => e.id))
  const extra: Enchantment[] = []
  let guard = 0
  while (item.enchantments.length + extra.length < target && guard++ < 40) {
    const t = rng.pick(pool)
    if (used.has(t.id)) continue
    used.add(t.id)
    extra.push({ id: t.id, label: t.label, ...t.roll(rng, cfg.budget) })
  }
  const enchantments = [...item.enchantments, ...extra]
  return { ...item, rarity: next, base, enchantments, name: renameFor({ ...item, rarity: next }, enchantments) }
}

function renameFor(item: Item, ench: Enchantment[]): Item['name'] {
  const cfg = RARITY[item.rarity]
  const nounMatch = item.name.match(/(Blade|Maul|Bow|Staff|Wand|Focus|Plate|Mail|Garb|Hide|Aegis|Charm|Ring|Idol|Sigil|Totem|Banner|Standard|Relic|Beacon|Oath)/)
  const noun = nounMatch?.[0] ?? 'Relic'
  if (item.keepsake) return `${cfg.label} ${noun} ${ench[0]?.label ?? ''}`.trim()
  const suffix = ench.find((e) => e.label.startsWith('of'))
  const prefix = ench.find((e) => !e.label.startsWith('of'))
  return `${prefix ? prefix.label + ' ' : ''}${cfg.label} ${noun}${suffix ? ' ' + suffix.label : ''}`.trim()
}

/** Human-readable base-stat lines for tooltips. */
export function describeBase(item: Item): string[] {
  const b = item.base
  const out: string[] = []
  if (b.physDamage) out.push(`+${b.physDamage} Physical Damage`)
  if (b.magDamage) out.push(`+${b.magDamage} Magic Damage`)
  if (b.attackSpeed) out.push(`+${Math.round(b.attackSpeed * 100)}% Attack Speed`)
  if (b.physDef) out.push(`+${b.physDef} Physical Defense`)
  if (b.magDef) out.push(`+${b.magDef} Magic Defense`)
  if (b.hp) out.push(`+${b.hp} HP`)
  return out
}
