/**
 * Roster slice: equipment, the pack, the forge (campaign gold prices), and
 * the skill choices heroes make at their milestones (SK1).
 */
import { canUpgrade, reforgeCost, reforgeItem, upgradeCost, upgradeRarity } from '../../game/data/items'
import type { BumpStat } from '../../game/data/skills'
import { takeBump, takeSkill } from '../../game/run/skills'
import { scrapDust, scrapGold, sortItems } from '../../game/run/economy'
import { equipFromPack, findItem, replaceItem, unequipToPack } from '../../game/run/inventory'
import { equipRules } from '../../game/run/relics'
import type { HeroSlot } from '../../game/types'
import { sfx } from '../../audio/audio'
import { streams } from './runtime'
import type { Slice } from './types'

export interface RosterActions {
  equipItem: (sentinelId: string, slot: HeroSlot, itemId: string) => void
  unequipItem: (sentinelId: string, slot: HeroSlot) => void
  sortInventory: () => void
  dismantleItem: (itemId: string) => void
  reforge: (itemId: string) => void
  upgradeItem: (itemId: string) => void
  /**
   * Take a skill at the hero's owed milestone (SK1). Refused unless the skill
   * is on the offer the hero is shown right now (`run/skills.skillOffer`, the
   * same list every picker draws), and — for a hero whose three slots are full
   * — unless `drop` names the skill it gives up. Never during a live wave:
   * choices are made between rounds.
   */
  chooseSkill: (sentinelId: string, skillId: string, drop?: string | null) => void
  /** Take the stat bump instead, at the same milestone, on the stat chosen (SK1). */
  chooseStatBump: (sentinelId: string, stat: BumpStat) => void
}

/**
 * A wave is being fought right now (the designer: gear and choices are made
 * between rounds, never mid-fight). A breather between sub-waves is still
 * the fight.
 */
const waveLive = (s: { engine: unknown; battlePhase: string }): boolean => !!s.engine && s.battlePhase === 'battle'

export const createRosterSlice: Slice<RosterActions> = (set, get) => ({
  equipItem: (sentinelId, slot, itemId) => {
    const { roster, inventory, relics } = get()
    const next = equipFromPack(roster, inventory, sentinelId, slot, itemId, equipRules(relics))
    if (!next) return
    set(next)
    sfx('equip')
  },

  unequipItem: (sentinelId, slot) => {
    const { roster, inventory } = get()
    const next = unequipToPack(roster, inventory, sentinelId, slot)
    if (!next) return
    set(next)
  },

  sortInventory: () => set({ inventory: sortItems(get().inventory) }),

  dismantleItem: (itemId) => {
    const { inventory, gold, dust, mode } = get()
    const item = inventory.find((i) => i.id === itemId)
    if (!item) return
    set({
      inventory: inventory.filter((i) => i.id !== itemId),
      gold: gold + scrapGold(item),
      dust: mode === 'endless' ? dust + scrapDust(item) : dust,
    })
    sfx('coin')
  },

  reforge: (itemId) => {
    const { gold } = get()
    const found = findItem(get().inventory, get().roster, itemId)
    if (!found) return
    const cost = reforgeCost(found.item)
    if (gold < cost) return sfx('error')
    set(replaceItem(get().inventory, get().roster, itemId, reforgeItem(found.item, streams.rng)))
    set({ gold: gold - cost })
  },

  upgradeItem: (itemId) => {
    const { gold } = get()
    const found = findItem(get().inventory, get().roster, itemId)
    if (!found || !canUpgrade(found.item)) return
    const cost = upgradeCost(found.item)
    if (gold < cost) return sfx('error')
    set(replaceItem(get().inventory, get().roster, itemId, upgradeRarity(found.item, streams.rng)))
    set({ gold: gold - cost })
  },

  chooseSkill: (sentinelId, skillId, drop) => {
    const { roster, skillPool, runSeed } = get()
    const hero = roster.find((x) => x.id === sentinelId)
    if (!hero || waveLive(get())) return
    const next = takeSkill(hero, skillId, skillPool, runSeed, drop)
    if (!next) return sfx('error')
    set({ roster: roster.map((x) => (x.id === sentinelId ? next : x)) })
    // A skill is the biggest choice a hero makes, and keeps the struck chord
    // the evolution had.
    sfx('evolve')
  },

  chooseStatBump: (sentinelId, stat) => {
    const { roster, skillPool, runSeed } = get()
    const hero = roster.find((x) => x.id === sentinelId)
    if (!hero || waveLive(get())) return
    const next = takeBump(hero, stat, skillPool, runSeed)
    if (!next) return sfx('error')
    set({ roster: roster.map((x) => (x.id === sentinelId ? next : x)) })
    sfx('upgrade')
  },
})
