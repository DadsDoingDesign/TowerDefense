/**
 * The run's economy: starting purses, prices, scrap values and the merchant's
 * shelf roll. Pure — no store, no React, no DOM — so the balance harness reads
 * the same numbers the game charges instead of mirroring them.
 */
import type { RNG } from '../core/rng'
import { generateItem, RARITY_ORDER, type RarityPity, type RosterRef } from '../data/items'
import type { Item, ItemRarity } from '../types'

export const MAX_BASE_HP = 20
export const START_GOLD = 60
export const MAX_ROSTER = 5

// Endless Watch starting pool + tuning.
export const ENDLESS_START_GOLD = 200
export const ENDLESS_START_DUST = 30
export const ENDLESS_LIVES = 3

export const ITEM_PRICE: Record<ItemRarity, number> = { common: 30, rare: 60, epic: 110, legendary: 200, mythic: 340 }
/** What a merchant charges for the hire on its shelf. */
export const RECRUIT_PRICE = 80
/** Gold / dust recovered when dismantling an item, by rarity. */
const SCRAP_GOLD: Record<ItemRarity, number> = { common: 8, rare: 18, epic: 40, legendary: 75, mythic: 130 }
const SCRAP_DUST: Record<ItemRarity, number> = { common: 2, rare: 4, epic: 8, legendary: 14, mythic: 22 }
export const scrapGold = (item: Item): number => SCRAP_GOLD[item.rarity]
export const scrapDust = (item: Item): number => SCRAP_DUST[item.rarity]

/** Inventory sort: rarity (highest first), then kind, then name. */
export function sortItems(items: Item[]): Item[] {
  const kindOrder = ['oneHand', 'twoHand', 'offHand', 'body']
  return [...items].sort((a, b) => {
    const r = RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)
    if (r) return r
    const k = kindOrder.indexOf(a.slot) - kindOrder.indexOf(b.slot)
    if (k) return k
    return a.name.localeCompare(b.name)
  })
}

export interface ShelfEntry {
  item: Item
  price: number
}

/** A campaign merchant's luck at a map layer. */
export const merchantLuck = (layer: number): number => Math.min(0.4, layer * 0.04)
/** An Endless merchant room's luck at a round. */
export const endlessMerchantLuck = (round: number): number => Math.min(0.4, round * 0.03)

/**
 * A merchant's four-item shelf.
 *
 * The shelf is an OFFER: four items rolled with the drought's luck, and the
 * player pays for at most some of them. `commitPity: false` keeps the counter
 * where it is; the SALE charges it (F4). Each item gets a copy of `pity` even
 * though `commitPity: false` cannot write to it — the store's object is never
 * handed out to be mutated (M9).
 *
 * Deterministic in the stream: the same loot-stream position deals the same
 * shelf (item ids aside, which come from the process-wide id counter).
 */
export function rollMerchantShelf(rng: RNG, opts: { luck: number; roster: readonly RosterRef[]; pity: RarityPity; size?: number }): ShelfEntry[] {
  return Array.from({ length: opts.size ?? 4 }, () => {
    const item = generateItem(rng, { luck: opts.luck, roster: opts.roster, pity: { ...opts.pity }, commitPity: false })
    return { item, price: ITEM_PRICE[item.rarity] }
  })
}

/**
 * ---------------------------------------------------------------------------
 * The gold sinks that replaced the skill tree (Phase 3b)
 * ---------------------------------------------------------------------------
 *
 * Gold used to have one real destination: the per-hero upgrade tree (≈945 gold
 * to max one hero's three paths). Those paths are spec perks now, chosen at
 * level-up for free, so the gold needs somewhere to go that is a DECISION
 * rather than a stat top-up:
 *
 *  - **Gate repair** at a merchant — the comeback the review found missing;
 *  - **a reroll of the merchant's shelf**, dearer each time at that stall.
 */

/** A merchant's Gate repair: `hp` Gate for `price` gold, once per visit. */
export const GATE_REPAIR = { hp: 5, price: 35 } as const

/** The Gate after buying a merchant repair (capped at its maximum). */
export const repairGate = (baseHp: number, maxBaseHp: number): number => Math.min(maxBaseHp, baseHp + GATE_REPAIR.hp)

/** What rerolling a merchant's shelf costs after `rerolls` rerolls at this stall. */
export const rerollCost = (rerolls: number): number => 20 + 15 * Math.max(0, Math.floor(rerolls))
