import { create } from 'zustand'
import { RNG } from '../game/core/rng'
import { GameEngine, type BattleResult } from '../game/engine/engine'
import { applyXp, evolutionPending, evolveInto } from '../game/engine/leveling'
import { teamKeepsakeMods } from '../game/engine/combat'
import { FIRST_MAP } from '../game/data/maps'
import { createSentinel, startingRoster } from '../game/data/sentinels'
import {
  canUpgrade,
  generateItem,
  RARITY,
  reforgeCost,
  reforgeItem,
  upgradeCost,
  upgradeRarity,
} from '../game/data/items'
import { generateRunMap, type MapNode, type RunMap } from '../game/data/runmap'
import { rollShrine, type ShrineOffer } from '../game/data/shrines'
import { generateEncounter, type EncounterKind } from '../game/data/waves'
import type { Archetype, GameMap, Item, ItemRarity, ItemSlot, Placement, Sentinel, WaveDef } from '../game/types'

export type Screen = 'map' | 'battle'
export type BattlePhase = 'setup' | 'battle'
export type RunPhase = 'active' | 'won' | 'lost'
export type Speed = 1 | 2 | 3
export type EventKind = 'merchant' | 'shrine' | 'recruit'

export const MAX_BASE_HP = 20
export const START_GOLD = 60
export const MAX_ROSTER = 5

const ITEM_PRICE: Record<ItemRarity, number> = { common: 30, rare: 60, epic: 110, legendary: 200 }
const RECRUIT_PRICE = 80

const rng = new RNG()

function startingInventory(): Item[] {
  return [
    generateItem(rng, { slot: 'weapon', rarity: 'common' }),
    generateItem(rng, { slot: 'armor', rarity: 'common' }),
    generateItem(rng, { slot: 'trinket', rarity: 'rare' }),
  ]
}

interface HudSnapshot {
  baseHp: number
  maxBaseHp: number
  goldEarned: number
  enemiesAlive: number
  enemiesSpawned: number
  enemiesTotal: number
}

interface MerchantStock {
  items: { item: Item; price: number }[]
  recruit: { sentinel: Sentinel; price: number } | null
}

interface GameState {
  // Run structure
  screen: Screen
  runPhase: RunPhase
  runMap: RunMap
  currentNodeId: string
  clearedNodeIds: string[]
  reachableNodeIds: string[]
  event: { kind: EventKind; nodeId: string } | null

  // Persistent run resources
  battleMap: GameMap
  roster: Sentinel[]
  placements: Placement
  gold: number
  baseHp: number
  inventory: Item[]

  // Active battle
  activeNodeId: string | null
  currentWave: WaveDef | null
  battlePhase: BattlePhase
  speed: Speed
  engine: GameEngine | null
  hud: HudSnapshot
  lastResult: BattleResult | null
  lastLoot: Item[]

  // Event payloads
  merchant: MerchantStock | null
  shrineOffer: ShrineOffer | null
  recruitOptions: Sentinel[]

  // UI
  selectedSentinelId: string | null
  detailId: string | null
  equipContext: { sentinelId: string; slot: ItemSlot } | null
  evolutionQueue: string[]

  // Actions — run/map
  newRun: () => void
  selectNode: (nodeId: string) => void
  // Actions — battle
  selectSentinel: (id: string | null) => void
  placeOnSlot: (slotId: string) => void
  clearSlot: (slotId: string) => void
  setSpeed: (s: Speed) => void
  startWave: () => void
  syncHud: () => void
  finishBattle: () => void
  continueAfterWave: () => void
  // Actions — events
  buyMerchantItem: (itemId: string) => void
  buyMerchantRecruit: () => void
  leaveEvent: () => void
  acceptShrine: () => void
  declineShrine: () => void
  acceptRecruit: (sentinelId: string) => void
  skipRecruit: () => void
  // Actions — items / detail / evolution
  openDetail: (id: string) => void
  closeDetail: () => void
  openEquip: (sentinelId: string, slot: ItemSlot) => void
  closeEquip: () => void
  equipItem: (sentinelId: string, slot: ItemSlot, itemId: string) => void
  unequipItem: (sentinelId: string, slot: ItemSlot) => void
  reforge: (itemId: string) => void
  upgradeItem: (itemId: string) => void
  chooseEvolution: (sentinelId: string, nodeId: string) => void
}

function emptyPlacements(map: GameMap): Placement {
  const p: Placement = {}
  for (const s of map.slots) p[s.id] = null
  return p
}

export function placedSentinels(
  roster: Sentinel[],
  placements: Placement,
): { sentinel: Sentinel; slotId: string }[] {
  const byId = new Map(roster.map((s) => [s.id, s]))
  const out: { sentinel: Sentinel; slotId: string }[] = []
  for (const [slotId, sentId] of Object.entries(placements)) {
    if (!sentId) continue
    const sentinel = byId.get(sentId)
    if (sentinel) out.push({ sentinel, slotId })
  }
  return out
}

const SLOTS: ItemSlot[] = ['weapon', 'armor', 'trinket']

function findItem(state: GameState, itemId: string): { item: Item } | null {
  const inv = state.inventory.find((i) => i.id === itemId)
  if (inv) return { item: inv }
  for (const s of state.roster) {
    for (const slot of SLOTS) {
      const it = s.equipment[slot]
      if (it && it.id === itemId) return { item: it }
    }
  }
  return null
}

function replaceItem(
  get: () => GameState,
  set: (partial: Partial<GameState>) => void,
  itemId: string,
  next: Item,
): void {
  const { inventory, roster } = get()
  const nextInv = inventory.map((i) => (i.id === itemId ? next : i))
  const nextRoster = roster.map((s) => {
    let eq = s.equipment
    for (const slot of SLOTS) {
      if (eq[slot]?.id === itemId) eq = { ...eq, [slot]: next }
    }
    return eq === s.equipment ? s : { ...s, equipment: eq }
  })
  set({ inventory: nextInv, roster: nextRoster })
}

const neighborsOf = (map: RunMap, nodeId: string): string[] =>
  map.edges.filter((e) => e.from === nodeId).map((e) => e.to)

function freshHud(): HudSnapshot {
  return {
    baseHp: MAX_BASE_HP,
    maxBaseHp: MAX_BASE_HP,
    goldEarned: 0,
    enemiesAlive: 0,
    enemiesSpawned: 0,
    enemiesTotal: 0,
  }
}

function makeRun() {
  const runMap = generateRunMap(rng)
  const start = runMap.nodes.find((n) => n.type === 'start')!
  return {
    runMap,
    currentNodeId: start.id,
    clearedNodeIds: [start.id],
    reachableNodeIds: neighborsOf(runMap, start.id),
  }
}

const nodeKind = (node: MapNode): EncounterKind =>
  node.type === 'elite' ? 'elite' : node.type === 'boss' ? 'boss' : 'normal'

export const useGameStore = create<GameState>((set, get) => {
  const initial = makeRun()
  return {
    screen: 'map',
    runPhase: 'active',
    ...initial,
    event: null,

    battleMap: FIRST_MAP,
    roster: startingRoster(),
    placements: emptyPlacements(FIRST_MAP),
    gold: START_GOLD,
    baseHp: MAX_BASE_HP,
    inventory: startingInventory(),

    activeNodeId: null,
    currentWave: null,
    battlePhase: 'setup',
    speed: 1,
    engine: null,
    hud: freshHud(),
    lastResult: null,
    lastLoot: [],

    merchant: null,
    shrineOffer: null,
    recruitOptions: [],

    selectedSentinelId: null,
    detailId: null,
    equipContext: null,
    evolutionQueue: [],

    newRun: () => {
      set({
        screen: 'map',
        runPhase: 'active',
        ...makeRun(),
        event: null,
        battleMap: FIRST_MAP,
        roster: startingRoster(),
        placements: emptyPlacements(FIRST_MAP),
        gold: START_GOLD,
        baseHp: MAX_BASE_HP,
        inventory: startingInventory(),
        activeNodeId: null,
        currentWave: null,
        battlePhase: 'setup',
        speed: 1,
        engine: null,
        hud: freshHud(),
        lastResult: null,
        lastLoot: [],
        merchant: null,
        shrineOffer: null,
        recruitOptions: [],
        selectedSentinelId: null,
        detailId: null,
        equipContext: null,
        evolutionQueue: [],
      })
    },

    selectNode: (nodeId) => {
      const { reachableNodeIds, runMap, roster } = get()
      if (!reachableNodeIds.includes(nodeId)) return
      const node = runMap.nodes.find((n) => n.id === nodeId)!

      if (node.type === 'merchant') {
        const luck = Math.min(0.4, node.layer * 0.04)
        const items = Array.from({ length: 4 }, () => {
          const item = generateItem(rng, { luck })
          return { item, price: ITEM_PRICE[item.rarity] }
        })
        const recruit =
          roster.length < MAX_ROSTER
            ? { sentinel: createSentinel(rng.pick(['fighter', 'rogue', 'mystic'] as Archetype[])), price: RECRUIT_PRICE }
            : null
        set({ event: { kind: 'merchant', nodeId }, merchant: { items, recruit } })
        return
      }
      if (node.type === 'shrine') {
        set({ event: { kind: 'shrine', nodeId }, shrineOffer: rollShrine(rng) })
        return
      }
      if (node.type === 'recruit') {
        const archs: Archetype[] = ['fighter', 'rogue', 'mystic']
        set({ event: { kind: 'recruit', nodeId }, recruitOptions: archs.map(createSentinel) })
        return
      }

      // Battle / elite / boss
      const wave = generateEncounter(node.layer, nodeKind(node))
      set({
        activeNodeId: nodeId,
        currentWave: wave,
        battlePhase: 'setup',
        screen: 'battle',
        selectedSentinelId: null,
        lastResult: null,
        lastLoot: [],
        hud: { ...freshHud(), baseHp: get().baseHp, enemiesTotal: wave.spawns.length },
      })
    },

    selectSentinel: (id) => set({ selectedSentinelId: id }),

    placeOnSlot: (slotId) => {
      const { selectedSentinelId, placements, battlePhase, screen } = get()
      if (screen !== 'battle' || battlePhase !== 'setup' || !selectedSentinelId) return
      const next: Placement = { ...placements }
      for (const key of Object.keys(next)) if (next[key] === selectedSentinelId) next[key] = null
      next[slotId] = selectedSentinelId
      set({ placements: next, selectedSentinelId: null })
    },

    clearSlot: (slotId) => {
      const { placements, battlePhase } = get()
      if (battlePhase !== 'setup') return
      if (!placements[slotId]) return
      set({ placements: { ...placements, [slotId]: null } })
    },

    setSpeed: (s) => set({ speed: s }),

    startWave: () => {
      const { battleMap, roster, placements, baseHp, currentWave } = get()
      if (!currentWave) return
      const engine = new GameEngine({
        map: battleMap,
        wave: currentWave,
        placedSentinels: placedSentinels(roster, placements),
        baseHp,
        maxBaseHp: MAX_BASE_HP,
        teamMods: teamKeepsakeMods(roster),
      })
      set({ engine, battlePhase: 'battle', selectedSentinelId: null, hud: engine.hudSnapshot() })
    },

    syncHud: () => {
      const { engine } = get()
      if (!engine) return
      const s = engine.hudSnapshot()
      set({
        hud: {
          baseHp: s.baseHp,
          maxBaseHp: s.maxBaseHp,
          goldEarned: s.goldEarned,
          enemiesAlive: s.enemiesAlive,
          enemiesSpawned: s.enemiesSpawned,
          enemiesTotal: s.enemiesTotal,
        },
      })
    },

    finishBattle: () => {
      const { engine, roster, gold, inventory, runMap, activeNodeId } = get()
      if (!engine || !activeNodeId) return
      const result = engine.result()
      const node = runMap.nodes.find((n) => n.id === activeNodeId)!

      if (result.status === 'defeated') {
        set({ runPhase: 'lost', lastResult: result, baseHp: 0, engine: null })
        return
      }

      // XP + evolution.
      const xpById = new Map(result.perSentinel.map((p) => [p.id, p.xpGained]))
      const nextRoster = roster.map((s) => applyXp(s, xpById.get(s.id) ?? 0))
      const evolutionQueue = nextRoster.filter(evolutionPending).map((s) => s.id)

      // Loot + bonus gold scale with node kind.
      const kind = nodeKind(node)
      const lootCount = kind === 'boss' ? 3 : kind === 'elite' ? 2 : 1
      const luck = (kind === 'boss' ? 0.35 : kind === 'elite' ? 0.15 : 0) + node.layer * 0.03
      const loot = Array.from({ length: lootCount }, () => generateItem(rng, { luck }))
      const bonusGold = kind === 'boss' ? 100 : kind === 'elite' ? 25 : 0

      // Advance the map.
      const cleared = [...get().clearedNodeIds, activeNodeId]
      const reachable = neighborsOf(runMap, activeNodeId).filter((id) => !cleared.includes(id))

      set({
        roster: nextRoster,
        gold: gold + result.goldEarned + bonusGold,
        baseHp: result.baseHpLeft,
        inventory: [...inventory, ...loot],
        lastResult: result,
        lastLoot: loot,
        evolutionQueue,
        clearedNodeIds: cleared,
        currentNodeId: activeNodeId,
        reachableNodeIds: reachable,
        runPhase: node.type === 'boss' ? 'won' : 'active',
        engine: null,
      })
    },

    continueAfterWave: () => {
      // Return to the map after the wave-clear summary.
      set({ screen: 'map', activeNodeId: null, currentWave: null, lastResult: null, lastLoot: [], battlePhase: 'setup' })
    },

    // ---- events ----
    buyMerchantItem: (itemId) => {
      const { merchant, gold, inventory } = get()
      if (!merchant) return
      const entry = merchant.items.find((e) => e.item.id === itemId)
      if (!entry || gold < entry.price) return
      set({
        gold: gold - entry.price,
        inventory: [...inventory, entry.item],
        merchant: { ...merchant, items: merchant.items.filter((e) => e.item.id !== itemId) },
      })
    },

    buyMerchantRecruit: () => {
      const { merchant, gold, roster } = get()
      if (!merchant?.recruit || gold < merchant.recruit.price || roster.length >= MAX_ROSTER) return
      set({
        gold: gold - merchant.recruit.price,
        roster: [...roster, merchant.recruit.sentinel],
        merchant: { ...merchant, recruit: null },
      })
    },

    leaveEvent: () => {
      const { event } = get()
      if (event) completeNode(get, set, event.nodeId)
    },

    acceptShrine: () => {
      const { shrineOffer, roster, baseHp, gold, event } = get()
      if (!shrineOffer || !event) return
      const eff = shrineOffer.apply({ roster, baseHp, gold })
      const newBaseHp = Math.max(1, baseHp + (eff.baseHpDelta ?? 0))
      set({
        roster: eff.roster ?? roster,
        baseHp: newBaseHp,
        gold: Math.max(0, gold + (eff.goldDelta ?? 0)),
      })
      completeNode(get, set, event.nodeId)
    },

    declineShrine: () => {
      const { event } = get()
      if (event) completeNode(get, set, event.nodeId)
    },

    acceptRecruit: (sentinelId) => {
      const { recruitOptions, roster, event } = get()
      if (!event) return
      const pick = recruitOptions.find((s) => s.id === sentinelId)
      if (pick && roster.length < MAX_ROSTER) set({ roster: [...roster, pick] })
      completeNode(get, set, event.nodeId)
    },

    skipRecruit: () => {
      const { event } = get()
      if (event) completeNode(get, set, event.nodeId)
    },

    // ---- items / detail / evolution ----
    openDetail: (id) => set({ detailId: id }),
    closeDetail: () => set({ detailId: null }),
    openEquip: (sentinelId, slot) => set({ equipContext: { sentinelId, slot } }),
    closeEquip: () => set({ equipContext: null }),

    equipItem: (sentinelId, slot, itemId) => {
      const { roster, inventory } = get()
      const item = inventory.find((i) => i.id === itemId)
      if (!item || item.slot !== slot) return
      let nextInv = inventory.filter((i) => i.id !== itemId)
      const nextRoster = roster.map((s) => {
        if (s.id !== sentinelId) return s
        const prev = s.equipment[slot]
        if (prev) nextInv = [...nextInv, prev]
        return { ...s, equipment: { ...s.equipment, [slot]: item } }
      })
      set({ roster: nextRoster, inventory: nextInv })
    },

    unequipItem: (sentinelId, slot) => {
      const { roster, inventory } = get()
      const s = roster.find((x) => x.id === sentinelId)
      const item = s?.equipment[slot]
      if (!item) return
      const nextRoster = roster.map((x) =>
        x.id === sentinelId ? { ...x, equipment: { ...x.equipment, [slot]: null } } : x,
      )
      set({ roster: nextRoster, inventory: [...inventory, item] })
    },

    reforge: (itemId) => {
      const { gold } = get()
      const found = findItem(get(), itemId)
      if (!found) return
      const cost = reforgeCost(found.item)
      if (gold < cost) return
      replaceItem(get, set, itemId, reforgeItem(found.item, rng))
      set({ gold: gold - cost })
    },

    upgradeItem: (itemId) => {
      const { gold } = get()
      const found = findItem(get(), itemId)
      if (!found || !canUpgrade(found.item)) return
      const cost = upgradeCost(found.item)
      if (gold < cost) return
      replaceItem(get, set, itemId, upgradeRarity(found.item, rng))
      set({ gold: gold - cost })
    },

    chooseEvolution: (sentinelId, nodeId) => {
      const { roster, evolutionQueue } = get()
      const nextRoster = roster.map((s) => (s.id === sentinelId ? evolveInto(s, nodeId) : s))
      set({ roster: nextRoster, evolutionQueue: evolutionQueue.filter((id) => id !== sentinelId) })
    },
  }
})

function completeNode(
  get: () => GameState,
  set: (partial: Partial<GameState>) => void,
  nodeId: string,
): void {
  const { runMap, clearedNodeIds } = get()
  const cleared = [...clearedNodeIds, nodeId]
  set({
    clearedNodeIds: cleared,
    currentNodeId: nodeId,
    reachableNodeIds: neighborsOf(runMap, nodeId).filter((id) => !cleared.includes(id)),
    event: null,
    merchant: null,
    shrineOffer: null,
    recruitOptions: [],
    screen: 'map',
  })
}

export const rarityColor = (r: ItemRarity) => RARITY[r].color
