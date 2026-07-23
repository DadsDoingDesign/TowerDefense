import { nextId, RNG } from '../core/rng'
import type { Enchantment, HeroSlot, Item, ItemRarity, ItemSlot } from '../types'

export const RARITY_ORDER: ItemRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic']

/** The three equip slots on a hero, in display order. */
export const HERO_SLOTS: HeroSlot[] = ['mainHand', 'offHand', 'body']
export const HERO_SLOT_LABEL: Record<HeroSlot, string> = {
  mainHand: 'Main Hand',
  offHand: 'Off Hand',
  body: 'Body',
}
export const KIND_LABEL: Record<ItemSlot, string> = {
  oneHand: '1-Hand',
  twoHand: '2-Hand',
  offHand: 'Off-Hand',
  body: 'Body',
}
/** Which hero slot(s) an item of this kind may occupy. */
export function heroSlotsFor(kind: ItemSlot): HeroSlot[] {
  switch (kind) {
    case 'oneHand': return ['mainHand', 'offHand']
    case 'twoHand': return ['mainHand'] // also blocks offHand while equipped
    case 'offHand': return ['offHand']
    case 'body': return ['body']
  }
}

export const RARITY: Record<
  ItemRarity,
  { label: string; budget: number; enchants: number; color: string; dropWeight: number }
> = {
  common: { label: 'Common', budget: 1.0, enchants: 0, color: '#c3b291', dropWeight: 56 },
  rare: { label: 'Rare', budget: 1.7, enchants: 1, color: '#5fb0c4', dropWeight: 28 },
  epic: { label: 'Epic', budget: 2.5, enchants: 2, color: '#c67ab0', dropWeight: 11 },
  legendary: { label: 'Legendary', budget: 3.6, enchants: 3, color: '#f0b868', dropWeight: 4 },
  mythic: { label: 'Mythic', budget: 5.0, enchants: 4, color: '#ef6a3a', dropWeight: 1 },
}

// ---- weapon subtypes give damage a physical/magic identity + a hand cost ----
interface WeaponType {
  name: string
  damageType: 'physical' | 'magic'
  hands: 'oneHand' | 'twoHand'
  speedBias: number
}
const WEAPONS: WeaponType[] = [
  // one-hand: modest damage, can pair with an off-hand
  { name: 'Sword', damageType: 'physical', hands: 'oneHand', speedBias: 0.05 },
  { name: 'Axe', damageType: 'physical', hands: 'oneHand', speedBias: 0.02 },
  { name: 'Dagger', damageType: 'physical', hands: 'oneHand', speedBias: 0.12 },
  { name: 'Wand', damageType: 'magic', hands: 'oneHand', speedBias: 0.06 },
  { name: 'Rod', damageType: 'magic', hands: 'oneHand', speedBias: 0.03 },
  { name: 'Scepter', damageType: 'magic', hands: 'oneHand', speedBias: 0.04 },
  // two-hand: bigger damage, but fills both hands
  { name: 'Greatsword', damageType: 'physical', hands: 'twoHand', speedBias: -0.05 },
  { name: 'Warhammer', damageType: 'physical', hands: 'twoHand', speedBias: -0.08 },
  { name: 'Bow', damageType: 'physical', hands: 'twoHand', speedBias: 0.04 },
  { name: 'Staff', damageType: 'magic', hands: 'twoHand', speedBias: 0 },
  { name: 'Grimoire', damageType: 'magic', hands: 'twoHand', speedBias: 0.02 },
]
const OFFHANDS = ['Shield', 'Buckler', 'Tome', 'Quiver', 'Focus']
const BODIES = ['Plate', 'Mail', 'Robe', 'Cloak', 'Aegis']
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
  { id: 'reach', label: 'of Reach', roll: (r, b) => ({ mods: { rangeMult: 1 + r.range(0.05, 0.1) * b } }) },
  { id: 'patience', label: 'of Patience', roll: (r, b) => ({ patience: round(r.range(2, 4) * b) }) },
  { id: 'cruelty', label: 'Cruel', roll: (r, b) => ({ mods: { critChanceAdd: r.range(0.04, 0.08) * b } }) },
  { id: 'ruin', label: 'Ruinous', roll: (r, b) => ({ mods: { critMultAdd: r.range(0.15, 0.3) * b } }) },
  { id: 'bursting', label: 'Bursting', roll: (r, b) => ({ mods: { splashAdd: round(r.range(6, 12) * b) } }) },
  { id: 'heavy', label: 'Heavy', roll: (r, b) => ({ mods: { damageMult: 1 + r.range(0.06, 0.12) * b } }) },
  { id: 'swift', label: 'Swift', roll: (r, b) => ({ mods: { rateMult: 1 + r.range(0.05, 0.1) * b } }) },
  { id: 'flaming', label: 'Flaming', roll: (r, b) => ({ mods: { burn: { dps: round(r.range(6, 12) * b), dur: 3 } } }) },
  { id: 'frost', label: 'Frost', roll: (r, b) => ({ mods: { chill: { slow: Math.min(0.6, r.range(0.15, 0.3) * b), dur: 1.5 } } }) },
  { id: 'shocking', label: 'Shocking', roll: (r) => ({ mods: { shock: { chains: r.int(1, 2), dmgFrac: 0.5 } } }) },
  { id: 'piercing', label: 'Piercing', roll: (r) => ({ mods: { pierce: r.int(1, 2) } }) },
  { id: 'vampiric', label: 'Vampiric', roll: (r, b) => ({ mods: { lifedrain: r.range(0.1, 0.2) * b } }) },
  { id: 'executioner', label: 'Executioner', roll: (r, b) => ({ mods: { execute: Math.min(0.25, r.range(0.08, 0.14) * b) } }) },
]

// ---- curse pool: dramatic tradeoffs (a big upside bought with a real downside).
// Rolled rarely on epic+ items as an extra affix; flat magnitudes (not budget-
// scaled) so the gamble reads the same on every high-rarity item. ----
const CURSE_ENCHANTS: EnchantTemplate[] = [
  { id: 'cx_reckless', label: 'Reckless', roll: () => ({ mods: { damageMult: 1.5, rangeMult: 0.75 } }) },
  { id: 'cx_frenzied', label: 'Frenzied', roll: () => ({ mods: { rateMult: 1.7, damageMult: 0.72 } }) },
  { id: 'cx_wild', label: 'Wild', roll: () => ({ mods: { critChanceAdd: 0.2, critMultAdd: 0.6, rateMult: 0.82 } }) },
  { id: 'cx_erratic', label: 'Erratic', roll: () => ({ mods: { splashAdd: 34, damageMult: 0.82 } }) },
  { id: 'cx_vengeful', label: 'Vengeful', roll: () => ({ mods: { damageMult: 1.55, critChanceAdd: -0.15 } }) },
]
const CURSE_CHANCE = 0.2

// ---- keepsake pool (team-wide global mods) ----
const KEEPSAKE_ENCHANTS: EnchantTemplate[] = [
  { id: 'k_rally', label: 'of Rallying', roll: (r, b) => ({ mods: { damageMult: 1 + r.range(0.05, 0.1) * b } }) },
  { id: 'k_quicken', label: 'of Haste', roll: (r, b) => ({ mods: { rateMult: 1 + r.range(0.05, 0.09) * b } }) },
  { id: 'k_focus', label: 'of Focus', roll: (r, b) => ({ mods: { critChanceAdd: r.range(0.03, 0.06) * b } }) },
  { id: 'k_reach', label: 'of the Hunt', roll: (r, b) => ({ mods: { rangeMult: 1 + r.range(0.06, 0.12) * b } }) },
  { id: 'k_ruin', label: 'of Ruin', roll: (r, b) => ({ mods: { critMultAdd: r.range(0.2, 0.4) * b } }) },
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
  if (slot === 'oneHand' || slot === 'twoHand') {
    const w = weapon!
    // two-handers hit noticeably harder in exchange for the off-hand slot
    const dmg = round(rng.range(slot === 'twoHand' ? 9 : 5, slot === 'twoHand' ? 13 : 8) * budget)
    return w.damageType === 'physical'
      ? { physDamage: dmg, attackSpeed: w.speedBias * budget }
      : { magDamage: dmg, attackSpeed: w.speedBias * budget }
  }
  if (slot === 'offHand') {
    // "Precision" slot — attack speed + crit, useful on every tower
    return {
      attackSpeed: rng.range(0.04, 0.08) * budget,
      critChance: rng.range(0.03, 0.06) * budget,
    }
  }
  // body — the "Amplifier" slot: reach + area, useful on every tower
  return {
    rangeMult: rng.range(0.06, 0.12) * budget,
    splashAdd: round(rng.range(8, 16) * budget),
  }
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
  // Keepsakes only appear on unforced (random-slot) drops. They wear on the body
  // slot but buff the whole team instead of the holder.
  const isKeepsake = opts.slot === undefined && rng.chance(opts.keepsakeChance ?? 0.12)
  const slot: ItemSlot = opts.slot ?? rng.pick(['oneHand', 'oneHand', 'twoHand', 'offHand', 'body', 'body'] as ItemSlot[])

  if (isKeepsake) {
    const noun = rng.pick(KEEPSAKES)
    const ench = rollEnchantments(KEEPSAKE_ENCHANTS, Math.max(1, cfg.enchants), cfg.budget, rng)
    return {
      id: nextId('itm'),
      name: `${cfg.label} ${noun} ${ench[0]?.label ?? ''}`.trim(),
      slot: 'body',
      rarity,
      base: {},
      enchantments: ench,
      keepsake: true,
    }
  }

  const isWeapon = slot === 'oneHand' || slot === 'twoHand'
  const weapon = isWeapon ? rng.pick(WEAPONS.filter((w) => w.hands === slot)) : undefined
  const noun = isWeapon ? weapon!.name : slot === 'offHand' ? rng.pick(OFFHANDS) : rng.pick(BODIES)
  const ench = rollEnchantments(ENCHANTS, cfg.enchants, cfg.budget, rng)
  // Epic+ items can roll a rare "curse": a dramatic extra affix with a downside.
  const canCurse = rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic'
  if (canCurse && rng.chance(CURSE_CHANCE)) {
    const c = rng.pick(CURSE_ENCHANTS)
    ench.push({ id: c.id, label: c.label, ...c.roll(rng, cfg.budget) })
  }
  const name = nameItem(cfg.label, noun, ench)
  // Mythic items grant a free level toward a slot-themed upgrade path.
  const grantUpgrade =
    rarity === 'mythic'
      ? { path: slot === 'body' ? 'tempo' : slot === 'offHand' ? 'precision' : 'power', levels: 1 }
      : undefined
  return {
    id: nextId('itm'),
    name: name.trim(),
    slot,
    rarity,
    base: baseFor(slot, cfg.budget, rng, weapon),
    enchantments: ench,
    ...(grantUpgrade ? { grantUpgrade } : {}),
  }
}

// ---- economy sinks ----
export function reforgeCost(item: Item): number {
  return { common: 20, rare: 35, epic: 60, legendary: 100, mythic: 160 }[item.rarity]
}
export function upgradeCost(item: Item): number {
  // Cost to reach the NEXT tier from this one (0 at the top tier).
  return { common: 50, rare: 90, epic: 150, legendary: 260, mythic: 0 }[item.rarity]
}
/** Dust costs used by the Endless Watch Forge. */
export function reforgeDust(item: Item): number {
  return { common: 4, rare: 7, epic: 12, legendary: 20, mythic: 32 }[item.rarity]
}
export function upgradeDust(item: Item): number {
  return { common: 8, rare: 14, epic: 24, legendary: 40, mythic: 0 }[item.rarity]
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
  const floatKeys = new Set(['attackSpeed', 'critChance', 'rangeMult'])
  const base: Item['base'] = { ...item.base }
  for (const k of Object.keys(base) as (keyof Item['base'])[]) {
    if (base[k] != null) base[k] = floatKeys.has(k) ? base[k]! * scale : Math.round(base[k]! * scale)
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

/** Compose an item name: [prefix] Rarity Noun [of Suffix]. A curse wins the prefix. */
function nameItem(rarityLabel: string, noun: string, ench: Enchantment[]): string {
  const suffix = ench.find((e) => e.label.startsWith('of'))
  const prefix =
    ench.find((e) => e.id.startsWith('cx_')) ?? ench.find((e) => !e.label.startsWith('of'))
  return `${prefix ? prefix.label + ' ' : ''}${rarityLabel} ${noun}${suffix ? ' ' + suffix.label : ''}`.trim()
}

function renameFor(item: Item, ench: Enchantment[]): Item['name'] {
  const cfg = RARITY[item.rarity]
  const nounMatch = item.name.match(/(Greatsword|Sword|Axe|Dagger|Wand|Rod|Scepter|Warhammer|Bow|Staff|Grimoire|Shield|Buckler|Tome|Quiver|Focus|Plate|Mail|Robe|Cloak|Aegis|Banner|Standard|Relic|Beacon|Oath)/)
  const noun = nounMatch?.[0] ?? 'Relic'
  if (item.keepsake) return `${cfg.label} ${noun} ${ench[0]?.label ?? ''}`.trim()
  return nameItem(cfg.label, noun, ench)
}

/** Human-readable base-stat lines for tooltips. */
export function describeBase(item: Item): string[] {
  const b = item.base
  const out: string[] = []
  const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
  if (b.physDamage) out.push(`+${b.physDamage} Physical Damage`)
  if (b.magDamage) out.push(`+${b.magDamage} Magic Damage`)
  if (b.attackSpeed) out.push(`${signed(Math.round(b.attackSpeed * 100))}% Attack Speed`)
  if (b.critChance) out.push(`+${Math.round(b.critChance * 100)}% Crit Chance`)
  if (b.rangeMult) out.push(`+${Math.round(b.rangeMult * 100)}% Range`)
  if (b.splashAdd) out.push(`+${b.splashAdd} Splash Radius`)
  return out
}
