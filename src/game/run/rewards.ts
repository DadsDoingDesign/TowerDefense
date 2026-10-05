/**
 * Applying a taken reward card to the run. Pure: roster, pack, team mods and
 * the pity counter in; their next values out. Dealing the hand lives in
 * `data/rewards.ts`; this is what happens when one card of it is picked.
 */
import { creditPity, type RarityPity } from '../data/items'
import type { RewardCard } from '../data/rewards'
import type { EffectMods, Item, Sentinel } from '../types'
import { receiveItems } from './recruits'
import { takeRelicOn } from './relics'

export interface RewardTarget {
  roster: Sentinel[]
  inventory: Item[]
  runMods: EffectMods[]
  lootPity: RarityPity
  /** Relics held this run (Phase 3b). */
  relics: string[]
}

/** What taking a card did that the target does not hold: a full pack's sale (`inventory.stow`). */
export interface RewardTaken extends RewardTarget {
  sold: Item[]
  /** Scrap gold the sale paid into the purse. */
  gold: number
}

/**
 * The run after taking `card`.
 *
 * The hand was dealt with the drought's luck but did not spend it (F4): a hand
 * of three is one pick, and the two cards that go in the bin are not drops. The
 * counter moves here, for the card actually taken — and only when that card is
 * an item, since a stat card is not a drop either. The input pity object is
 * never mutated (M9): a fresh copy is credited and returned.
 */
export function applyRewardCard(t: RewardTarget, card: RewardCard, slots = Infinity): RewardTaken {
  const { roster, inventory, runMods, lootPity, relics } = t
  let nextRoster = roster
  let nextInv = inventory
  let nextMods = runMods
  let nextPity = lootPity
  let nextRelics = relics
  let sold: Item[] = []
  let gold = 0
  if (card.kind === 'relic' && card.relic) {
    // A relic is held once: a second copy of a held relic grants nothing.
    // Its team mods are read off `relics` every wave; its flat stats land on
    // the company now (and on every later hire — `withRecruits`).
    if (!relics.includes(card.relic)) {
      nextRelics = [...relics, card.relic]
      nextRoster = takeRelicOn(roster, card.relic)
    }
  } else if (card.kind === 'item' && card.item) {
    // Into an empty slot it strictly improves, if the company has one;
    // otherwise the pack — a full one sells its cheapest piece. Never over
    // anything already worn.
    const got = receiveItems(roster, inventory, [card.item], relics, slots)
    nextRoster = got.roster
    nextInv = got.inventory
    sold = got.sold
    gold = got.gold
    nextPity = { ...lootPity }
    creditPity(nextPity, card.item.rarity)
  } else if (card.grant) {
    const g = card.grant
    nextRoster = roster.map((s) => ({
      ...s,
      stats: {
        ...s.stats,
        str: s.stats.str + (g.stats?.str ?? 0),
        dex: s.stats.dex + (g.stats?.dex ?? 0),
        int: s.stats.int + (g.stats?.int ?? 0),
      },
      thorns: s.thorns + (g.thorns ?? 0),
      patience: s.patience + (g.patience ?? 0),
    }))
    if (g.mods) nextMods = [...runMods, g.mods]
  }
  return { roster: nextRoster, inventory: nextInv, runMods: nextMods, lootPity: nextPity, relics: nextRelics, sold, gold }
}
