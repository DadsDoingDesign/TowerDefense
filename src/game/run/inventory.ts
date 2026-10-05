/**
 * Moving items between the pack and the company. Pure: each function takes the
 * roster and inventory and returns the next pair (or null when refused), so the
 * store's actions are a guard, a call and a `set`.
 */
import { HERO_SLOTS, heroSlotsFor, RARITY_ORDER, type EquipRules } from '../data/items'
import type { Equipment, HeroSlot, Item, Sentinel } from '../types'
import { scrapGold } from './economy'

/**
 * Pack slots (the HQ's Operations office): how many loose items the pack holds.
 *
 * When loot arrives at a full pack, the **cheapest** pieces are sold for their
 * scrap gold — the arrivals and what was already there, judged together — so
 * a better drop never vanishes because a worse one was in the way. Only as
 * many are sold as arrived: moving gear you already own off a hero is never
 * refused and never sells anything (a pack over its slots from that sells its
 * extras the next time loot arrives). Ties go to the oldest piece in the pack.
 */
export function stow(pack: readonly Item[], arriving: readonly Item[], slots: number): { inventory: Item[]; sold: Item[]; gold: number } {
  if (!arriving.length) return { inventory: [...pack], sold: [], gold: 0 }
  const all = [...pack, ...arriving]
  const over = Math.min(arriving.length, Math.max(0, all.length - Math.max(0, Math.floor(slots))))
  if (!over) return { inventory: all, sold: [], gold: 0 }
  const order = all
    .map((item, i) => ({ item, i }))
    .sort((a, b) => scrapGold(a.item) - scrapGold(b.item) || RARITY_ORDER.indexOf(a.item.rarity) - RARITY_ORDER.indexOf(b.item.rarity) || a.i - b.i)
  const out = new Set(order.slice(0, over).map((x) => x.item.id))
  const sold = all.filter((x) => out.has(x.id))
  return { inventory: all.filter((x) => !out.has(x.id)), sold, gold: sold.reduce((t, x) => t + scrapGold(x), 0) }
}

/** The receipt for a full pack's sale: "Pack full: sold the Axe for 8 gold". */
export function soldText(sold: readonly Pick<Item, 'name'>[], gold: number): string {
  if (!sold.length) return ''
  const what = sold.length === 1 ? `the ${sold[0].name.replace(/\b(Common|Rare|Epic|Legendary|Mythic) /, '')}` : `${sold.length} pieces`
  return `Pack full: sold ${what} for ${gold} gold`
}

/** An item by id, whether it is in the pack or worn by anyone on the roster. */
export function findItem(inventory: readonly Item[], roster: readonly Sentinel[], itemId: string): { item: Item } | null {
  const inv = inventory.find((i) => i.id === itemId)
  if (inv) return { item: inv }
  for (const s of roster) {
    for (const slot of HERO_SLOTS) {
      const it = s.equipment[slot]
      if (it && it.id === itemId) return { item: it }
    }
  }
  return null
}

/** Swap an item for its reforged / upgraded self wherever it lives. */
export function replaceItem(
  inventory: Item[],
  roster: Sentinel[],
  itemId: string,
  next: Item,
): { inventory: Item[]; roster: Sentinel[] } {
  const nextInv = inventory.map((i) => (i.id === itemId ? next : i))
  const nextRoster = roster.map((s) => {
    let eq = s.equipment
    for (const slot of HERO_SLOTS) {
      if (eq[slot]?.id === itemId) eq = { ...eq, [slot]: next }
    }
    return eq === s.equipment ? s : { ...s, equipment: eq }
  })
  return { inventory: nextInv, roster: nextRoster }
}

/**
 * Put `item` into `slot` of `equipment` — the ONE statement of the two-hand
 * rules, read by the pack (`equipFromPack`), the item panel's preview
 * (`gearPlan.planEquip`) and the balance model (`harness.equipAndDisplace`):
 *
 *  - a two-hander fills the main hand and empties the off hand;
 *  - anything put in the off hand frees a held two-hander;
 *  - otherwise the slot's old occupant comes off.
 *
 * `displaced` is everything that came off, in that order. It does not ask
 * whether the item FITS the slot — callers check `heroSlotsFor` first.
 */
export function wearItem(equipment: Equipment, item: Item, slot: HeroSlot): { equipment: Equipment; displaced: Item[] } {
  const eq = { ...equipment }
  const displaced: Item[] = []
  const ret = (it: Item | null) => {
    if (it) displaced.push(it)
  }
  if (item.slot === 'twoHand') {
    ret(eq.mainHand)
    ret(eq.offHand)
    eq.mainHand = item
    eq.offHand = null
  } else if (slot === 'offHand' && eq.mainHand?.slot === 'twoHand') {
    ret(eq.mainHand)
    eq.mainHand = null
    ret(eq.offHand)
    eq.offHand = item
  } else {
    ret(eq[slot])
    eq[slot] = item
  }
  return { equipment: eq, displaced }
}

/**
 * Equip a pack item into a hero's slot, returning whatever it displaces to the
 * pack. Null when the item is not in the pack or cannot go in that slot on
 * that hero (`items.heroSlotsFor`: the item's grip, and — for a main-hand
 * one-hander in the off hand — the Twinblade Harness and the hero's DEX;
 * `rules` from `run/relics.equipRules`).
 */
export function equipFromPack(
  roster: Sentinel[],
  inventory: Item[],
  sentinelId: string,
  slot: HeroSlot,
  itemId: string,
  rules: EquipRules = {},
): { roster: Sentinel[]; inventory: Item[] } | null {
  const item = inventory.find((i) => i.id === itemId)
  const hero = roster.find((s) => s.id === sentinelId)
  if (!item || !hero || !heroSlotsFor(item, hero, rules).includes(slot)) return null
  const worn = wearItem(hero.equipment, item, slot)
  return {
    roster: roster.map((s) => (s.id === sentinelId ? { ...s, equipment: worn.equipment } : s)),
    inventory: [...inventory.filter((i) => i.id !== itemId), ...worn.displaced],
  }
}

/** Whether what `hero` wears in the off hand may be there under `rules`. */
export const offHandAllowed = (hero: Sentinel, rules: EquipRules = {}): boolean => {
  const it = hero.equipment.offHand
  return !it || heroSlotsFor(it, hero, rules).includes('offHand')
}

/** The one line a load says about what {@link settleOffHands} moved. */
export function gearReturnedText(moved: readonly { hero: string; item: string }[]): string {
  const why = 'the off hand holds knives, wands, shields and the like now'
  if (moved.length === 1) return `${moved[0].hero}'s ${moved[0].item} is back in the pack — ${why}`
  return `${moved.length} off-hand items are back in the pack — ${why}`
}

/**
 * Round 3 (Q5) — bring worn gear up to the off-hand rule. A save written before
 * it may wear something the off hand no longer takes: a sword without the
 * Twinblade Harness (or without the DEX for it), or, from before R3-2, any
 * one-hander. Each such item moves to the PACK — nothing is destroyed — and is
 * listed in `moved` so the player can be told once. Idempotent: a company that
 * already obeys the rule comes back unchanged (same arrays).
 */
export function settleOffHands(
  roster: Sentinel[],
  inventory: Item[],
  rules: EquipRules = {},
): { roster: Sentinel[]; inventory: Item[]; moved: { hero: string; item: string }[] } {
  const moved: { hero: string; item: string }[] = []
  const returned: Item[] = []
  const next = roster.map((s) => {
    if (offHandAllowed(s, rules)) return s
    const it = s.equipment.offHand!
    moved.push({ hero: s.name, item: it.name })
    returned.push(it)
    return { ...s, equipment: { ...s.equipment, offHand: null } }
  })
  if (!moved.length) return { roster, inventory, moved }
  return { roster: next, inventory: [...inventory, ...returned], moved }
}

/** Take a worn item off into the pack. Null when the slot is empty. */
export function unequipToPack(
  roster: Sentinel[],
  inventory: Item[],
  sentinelId: string,
  slot: HeroSlot,
): { roster: Sentinel[]; inventory: Item[] } | null {
  const s = roster.find((x) => x.id === sentinelId)
  const item = s?.equipment[slot]
  if (!item) return null
  const nextRoster = roster.map((x) =>
    x.id === sentinelId ? { ...x, equipment: { ...x.equipment, [slot]: null } } : x,
  )
  return { roster: nextRoster, inventory: [...inventory, item] }
}
