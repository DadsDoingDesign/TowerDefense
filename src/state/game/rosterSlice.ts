/**
 * Roster slice: equipment, the pack, the forge (campaign gold prices),
 * evolution choices and the per-tower upgrade tree.
 */
import { effectiveUpgradeLevels } from '../../game/engine/combat'
import { evolveInto } from '../../game/engine/leveling'
import { canUpgrade, reforgeCost, reforgeItem, upgradeCost, upgradeRarity } from '../../game/data/items'
import { getUpgradePath, milestoneForLevel } from '../../game/data/upgradeTree'
import { scrapDust, scrapGold, sortItems } from '../../game/run/economy'
import { equipFromPack, findItem, replaceItem, unequipToPack } from '../../game/run/inventory'
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
  chooseEvolution: (sentinelId: string, nodeId: string) => void
  buyTowerUpgrade: (sentinelId: string, pathId: string) => void
}

export const createRosterSlice: Slice<RosterActions> = (set, get) => ({
  equipItem: (sentinelId, slot, itemId) => {
    const { roster, inventory } = get()
    const next = equipFromPack(roster, inventory, sentinelId, slot, itemId)
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

  chooseEvolution: (sentinelId, nodeId) => {
    const { roster, evolutionQueue } = get()
    const nextRoster = roster.map((s) => (s.id === sentinelId ? evolveInto(s, nodeId) : s))
    set({ roster: nextRoster, evolutionQueue: evolutionQueue.filter((id) => id !== sentinelId) })
    // A permanent, irreversible branch — the biggest single choice the run
    // offers — has its own sound: a riser into a struck chord.
    sfx('evolve')
  },

  buyTowerUpgrade: (sentinelId, pathId) => {
    const { roster, gold } = get()
    const s = roster.find((x) => x.id === sentinelId)
    const path = getUpgradePath(pathId)
    if (!s || !path) return
    // Buy toward the next EFFECTIVE level (free grants from gear/mutations
    // already fill the lowest levels), so a granted L1 means your first
    // purchase is L2 at L2's price.
    const eff = effectiveUpgradeLevels(s)[pathId] ?? 0
    if (eff >= path.levels.length) return
    const nextLevel = eff + 1
    if (s.level < milestoneForLevel(nextLevel)) return sfx('error')
    const cost = path.levels[nextLevel - 1].cost
    if (gold < cost) return sfx('error')
    const bought = s.upgrades?.[pathId] ?? 0
    const nextRoster = roster.map((x) =>
      x.id === sentinelId ? { ...x, upgrades: { ...x.upgrades, [pathId]: bought + 1 } } : x,
    )
    set({ roster: nextRoster, gold: gold - cost })
    sfx('upgrade')
  },
})
