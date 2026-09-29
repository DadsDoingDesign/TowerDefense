/**
 * Moving items between the pack and the company. Pure: each function takes the
 * roster and inventory and returns the next pair (or null when refused), so the
 * store's actions are a guard, a call and a `set`.
 */
import { HERO_SLOTS, heroSlotsFor } from '../data/items'
import type { HeroSlot, Item, Sentinel } from '../types'

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
 * Equip a pack item into a hero's slot, returning whatever it displaces to the
 * pack. Null when the item is not in the pack or cannot go in that slot.
 */
export function equipFromPack(
  roster: Sentinel[],
  inventory: Item[],
  sentinelId: string,
  slot: HeroSlot,
  itemId: string,
): { roster: Sentinel[]; inventory: Item[] } | null {
  const item = inventory.find((i) => i.id === itemId)
  if (!item || !heroSlotsFor(item.slot).includes(slot)) return null
  let nextInv = inventory.filter((i) => i.id !== itemId)
  const ret = (it: Item | null) => { if (it) nextInv = [...nextInv, it] }
  const nextRoster = roster.map((s) => {
    if (s.id !== sentinelId) return s
    const eq = { ...s.equipment }
    if (item.slot === 'twoHand') {
      // two-hander fills the main hand and clears the off hand
      ret(eq.mainHand); ret(eq.offHand)
      eq.mainHand = item; eq.offHand = null
    } else if (slot === 'offHand' && eq.mainHand?.slot === 'twoHand') {
      // putting something in the off hand frees the held two-hander
      ret(eq.mainHand); eq.mainHand = null
      ret(eq.offHand); eq.offHand = item
    } else {
      ret(eq[slot]); eq[slot] = item
    }
    return { ...s, equipment: eq }
  })
  return { roster: nextRoster, inventory: nextInv }
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
