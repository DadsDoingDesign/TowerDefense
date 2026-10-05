/**
 * Roster slice: equipment, the pack, the forge (campaign gold prices), and
 * the skill choices heroes make at their milestones (SK1).
 */
import { roadPays } from './purse'
import { canUpgrade, reforgeCost, reforgeItem, upgradeCost, upgradeRarity } from '../../game/data/items'
import type { BumpStat } from '../../game/data/skills'
import { takeBump, takeSkill } from '../../game/run/skills'
import { scrapGold, sortItems } from '../../game/run/economy'
import { equipFromPack, findItem, replaceItem, unequipToPack } from '../../game/run/inventory'
import { equipRules } from '../../game/run/relics'
import type { HeroSlot } from '../../game/types'
import { sfx } from '../../audio/audio'
import { streams } from './runtime'
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

  // Crafting is gear too: while a sub-wave is live the item panel offers none
  // of it, and the store refuses it here (a worn piece reforged mid-wave would
  // be a gear change the fight never saw).
  dismantleItem: (itemId) => {
    if (gearLocked(get())) return sfx('error')
    const { inventory } = get()
    const item = inventory.find((i) => i.id === itemId)
    if (!item) return
    // Gold is the only currency: scrapping pays gold into the purse (road gold).
    set({ inventory: inventory.filter((i) => i.id !== itemId), ...roadPays(get(), scrapGold(item)) })
    sfx('coin')
  },

  reforge: (itemId) => {
    if (gearLocked(get())) return sfx('error')
    const { gold } = get()
    const found = findItem(get().inventory, get().roster, itemId)
    if (!found) return
    const cost = reforgeCost(found.item)
    if (gold < cost) return sfx('error')
    set(replaceItem(get().inventory, get().roster, itemId, reforgeItem(found.item, streams.rng)))
    set({ gold: gold - cost })
    redressWearer(get, set, itemId)
  },

  upgradeItem: (itemId) => {
    if (gearLocked(get())) return sfx('error')
    const { gold } = get()
    const found = findItem(get().inventory, get().roster, itemId)
    if (!found || !canUpgrade(found.item)) return
    const cost = upgradeCost(found.item)
    if (gold < cost) return sfx('error')
    set(replaceItem(get().inventory, get().roster, itemId, upgradeRarity(found.item, streams.rng)))
    set({ gold: gold - cost })
    redressWearer(get, set, itemId)
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

/** A worn piece reforged or raised in the breather reaches the fight too. */
function redressWearer(get: GetState, set: SetState, itemId: string): void {
  const wearer = get().roster.find((h) => Object.values(h.equipment).some((it) => it?.id === itemId))
  if (wearer) redress(get, set, wearer.id)
}
