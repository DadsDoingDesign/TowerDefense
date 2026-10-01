/**
 * Roster slice: equipment, the pack, the forge (campaign gold prices),
 * evolution choices and spec perks.
 */
import { evolveInto } from '../../game/engine/leveling'
import { canUpgrade, reforgeCost, reforgeItem, upgradeCost, upgradeRarity } from '../../game/data/items'
import { takePerk } from '../../game/run/perks'
import { availableEvolutions } from '../../game/run/unlocks'
import { scrapDust, scrapGold, sortItems } from '../../game/run/economy'
import { equipFromPack, findItem, replaceItem, unequipToPack } from '../../game/run/inventory'
import { equipRules } from '../../game/run/relics'
import type { HeroSlot } from '../../game/types'
import { sfx } from '../../audio/audio'
import { featUnlocked, perkUnlocked, streams } from './runtime'
import { useMetaStore } from '../metaStore'
import type { GetState, SetState, Slice } from './types'
import { gearLocked, inBreather } from './selectors'
import { hudOf } from './battleSlice'

export interface RosterActions {
  equipItem: (sentinelId: string, slot: HeroSlot, itemId: string) => void
  unequipItem: (sentinelId: string, slot: HeroSlot) => void
  sortInventory: () => void
  dismantleItem: (itemId: string) => void
  reforge: (itemId: string) => void
  upgradeItem: (itemId: string) => void
  chooseEvolution: (sentinelId: string, nodeId: string) => void
  /**
   * Take a spec perk at a level milestone (Phase 3b). Refused unless the perk is
   * one the hero is actually offered right now — `run/perks.perkChoices`, the
   * same list the picker draws.
   */
  choosePerk: (sentinelId: string, perkId: string) => void
}

export const createRosterSlice: Slice<RosterActions> = (set, get) => ({
  // Gear changes only between rounds (the designer: "items locked during
  // rounds"): a live sub-wave refuses every equip, unequip and swap — the
  // pack, the item panel and the keyboard all land here. In the breather the
  // hero standing in the field is re-dressed too (`engine.regear`), and a
  // change that makes someone swing beside another hero is allowed — it shows
  // as a clearance conflict and holds the next sub-wave (`fieldConflicts`).
  equipItem: (sentinelId, slot, itemId) => {
    const st = get()
    if (gearLocked(st)) return sfx('error')
    const next = equipFromPack(st.roster, st.inventory, sentinelId, slot, itemId, equipRules(st.relics))
    if (!next) return
    set(next)
    redress(get, set, sentinelId)
    sfx('equip')
  },

  unequipItem: (sentinelId, slot) => {
    const st = get()
    if (gearLocked(st)) return sfx('error')
    const next = unequipToPack(st.roster, st.inventory, sentinelId, slot)
    if (!next) return
    set(next)
    redress(get, set, sentinelId)
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
    const hero = roster.find((s) => s.id === sentinelId)
    // Only a path the hero is actually offered — a feat-locked spec is not one
    // until its feat is earned (Phase 3b).
    if (!hero || !availableEvolutions(hero, featUnlocked).some((n) => n.id === nodeId)) return
    const nextRoster = roster.map((s) => (s.id === sentinelId ? evolveInto(s, nodeId) : s))
    useMetaStore.getState().recordCodex({ specs: [nodeId] })
    set({ roster: nextRoster, evolutionQueue: evolutionQueue.filter((id) => id !== sentinelId) })
    // A permanent, irreversible branch — the biggest single choice the run
    // offers — has its own sound: a riser into a struck chord.
    sfx('evolve')
  },

  choosePerk: (sentinelId, perkId) => {
    const { roster } = get()
    const hero = roster.find((x) => x.id === sentinelId)
    if (!hero) return
    const next = takePerk(hero, perkId, perkUnlocked)
    if (!next) return sfx('error')
    set({ roster: roster.map((x) => (x.id === sentinelId ? next : x)) })
    useMetaStore.getState().recordCodex({ perks: [perkId] })
    sfx('upgrade')
  },
})

/**
 * A gear change in the breather reaches the fight: the hero standing in the
 * field is re-dressed as the roster now has it (`engine.regear`, logged), and
 * the HUD is re-read so the strip and the field re-check the clearance. A
 * no-op in setup (the engine is built from the roster at Start Wave) and off
 * the battle screen.
 */
function redress(get: GetState, set: SetState, sentinelId: string): void {
  const st = get()
  if (!st.engine || !inBreather(st)) return
  const hero = st.roster.find((h) => h.id === sentinelId)
  if (hero && st.engine.regear(hero)) set({ hud: hudOf(st.engine) })
}
