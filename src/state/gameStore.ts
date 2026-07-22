import { create } from 'zustand'
import { RNG } from '../game/core/rng'
import { GameEngine, type BattleResult } from '../game/engine/engine'
import { applyXp, evolutionPending, evolveInto } from '../game/engine/leveling'
import { teamKeepsakeMods } from '../game/engine/combat'
import { FIRST_MAP } from '../game/data/maps'
import { startingRoster } from '../game/data/sentinels'
import {
  canUpgrade,
  generateItem,
  reforgeCost,
  reforgeItem,
  upgradeCost,
  upgradeRarity,
} from '../game/data/items'
import { generateWave, TOTAL_WAVES } from '../game/data/waves'
import type { GameMap, Item, ItemSlot, Placement, Sentinel } from '../game/types'

// Item RNG lives outside the store; auto-seeded (no Date/Math.random dependency).
const itemRng = new RNG()

function startingInventory(): Item[] {
  return [
    generateItem(itemRng, { slot: 'weapon', rarity: 'common' }),
    generateItem(itemRng, { slot: 'armor', rarity: 'common' }),
    generateItem(itemRng, { slot: 'trinket', rarity: 'rare' }),
  ]
}

export type Phase = 'setup' | 'battle' | 'won' | 'lost'
export type Speed = 1 | 2 | 3

export const MAX_BASE_HP = 20
export const START_GOLD = 40

interface HudSnapshot {
  baseHp: number
  maxBaseHp: number
  goldEarned: number
  enemiesAlive: number
  enemiesSpawned: number
  enemiesTotal: number
}

interface GameState {
  map: GameMap
  phase: Phase
  waveIndex: number
  totalWaves: number
  roster: Sentinel[]
  placements: Placement
  baseHp: number
  gold: number
  speed: Speed

  // Setup interaction
  selectedSentinelId: string | null
  /** Sentinel whose detail panel is open, or null. */
  detailId: string | null
  /** Which sentinel+slot is choosing an item to equip (M3), or null. */
  equipContext: { sentinelId: string; slot: import('../game/types').ItemSlot } | null
  /** Sentinel ids owed an evolution choice after the last battle. */
  evolutionQueue: string[]

  // Inventory / loot
  inventory: Item[]
  lastLoot: Item[]

  // Battle runtime
  engine: GameEngine | null
  hud: HudSnapshot
  lastResult: BattleResult | null

  // Actions
  newRun: () => void
  selectSentinel: (id: string | null) => void
  placeOnSlot: (slotId: string) => void
  clearSlot: (slotId: string) => void
  setSpeed: (s: Speed) => void
  startWave: () => void
  syncHud: () => void
  finishBattle: () => void
  continueAfterWave: () => void
  openDetail: (id: string) => void
  closeDetail: () => void
  openEquip: (sentinelId: string, slot: import('../game/types').ItemSlot) => void
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

/** Locate an item by id anywhere (inventory or equipped). */
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

/** Replace an item (same id) wherever it lives — inventory or a Sentinel slot. */
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

export const useGameStore = create<GameState>((set, get) => ({
  map: FIRST_MAP,
  phase: 'setup',
  waveIndex: 1,
  totalWaves: TOTAL_WAVES,
  roster: startingRoster(),
  placements: emptyPlacements(FIRST_MAP),
  baseHp: MAX_BASE_HP,
  gold: START_GOLD,
  speed: 1,
  selectedSentinelId: null,
  detailId: null,
  equipContext: null,
  evolutionQueue: [],
  inventory: startingInventory(),
  lastLoot: [],
  engine: null,
  hud: {
    baseHp: MAX_BASE_HP,
    maxBaseHp: MAX_BASE_HP,
    goldEarned: 0,
    enemiesAlive: 0,
    enemiesSpawned: 0,
    enemiesTotal: 0,
  },
  lastResult: null,

  newRun: () => {
    const map = FIRST_MAP
    set({
      map,
      phase: 'setup',
      waveIndex: 1,
      roster: startingRoster(),
      placements: emptyPlacements(map),
      baseHp: MAX_BASE_HP,
      gold: START_GOLD,
      speed: 1,
      selectedSentinelId: null,
      detailId: null,
      equipContext: null,
      evolutionQueue: [],
      inventory: startingInventory(),
      lastLoot: [],
      engine: null,
      lastResult: null,
      hud: {
        baseHp: MAX_BASE_HP,
        maxBaseHp: MAX_BASE_HP,
        goldEarned: 0,
        enemiesAlive: 0,
        enemiesSpawned: 0,
        enemiesTotal: 0,
      },
    })
  },

  selectSentinel: (id) => set({ selectedSentinelId: id }),

  placeOnSlot: (slotId) => {
    const { selectedSentinelId, placements, phase } = get()
    if (phase !== 'setup' || !selectedSentinelId) return
    const next: Placement = { ...placements }
    // Remove this sentinel from any slot it currently occupies (single placement).
    for (const key of Object.keys(next)) {
      if (next[key] === selectedSentinelId) next[key] = null
    }
    next[slotId] = selectedSentinelId
    set({ placements: next, selectedSentinelId: null })
  },

  clearSlot: (slotId) => {
    const { placements, phase } = get()
    if (phase !== 'setup') return
    if (!placements[slotId]) return
    set({ placements: { ...placements, [slotId]: null } })
  },

  setSpeed: (s) => set({ speed: s }),

  startWave: () => {
    const { map, roster, placements, waveIndex, baseHp } = get()
    const engine = new GameEngine({
      map,
      wave: generateWave(waveIndex),
      placedSentinels: placedSentinels(roster, placements),
      baseHp,
      maxBaseHp: MAX_BASE_HP,
      teamMods: teamKeepsakeMods(roster),
    })
    set({
      engine,
      phase: 'battle',
      selectedSentinelId: null,
      hud: engine.hudSnapshot(),
    })
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
    const { engine, roster, gold, waveIndex, totalWaves, inventory } = get()
    if (!engine) return
    const result = engine.result()

    if (result.status === 'defeated') {
      set({ phase: 'lost', lastResult: result, baseHp: 0, engine: null })
      return
    }

    // Apply XP and level growth, then find who is owed an evolution choice.
    const xpById = new Map(result.perSentinel.map((p) => [p.id, p.xpGained]))
    const nextRoster = roster.map((s) => applyXp(s, xpById.get(s.id) ?? 0))
    const evolutionQueue = nextRoster.filter(evolutionPending).map((s) => s.id)

    // Loot: one drop per cleared wave, rarity odds rising slightly with depth.
    const loot = [generateItem(itemRng, { luck: Math.min(0.35, waveIndex * 0.03) })]

    const wonRun = waveIndex >= totalWaves
    set({
      roster: nextRoster,
      gold: gold + result.goldEarned,
      baseHp: result.baseHpLeft,
      lastResult: result,
      lastLoot: loot,
      inventory: [...inventory, ...loot],
      evolutionQueue,
      phase: wonRun ? 'won' : 'setup',
      engine: null,
    })
    if (!wonRun) set({ waveIndex: waveIndex + 1 })
  },

  continueAfterWave: () => set({ lastResult: null }),

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
      if (prev) nextInv = [...nextInv, prev] // swap the old one back to the bag
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
    const next = reforgeItem(found.item, itemRng)
    replaceItem(get, set, itemId, next)
    set({ gold: gold - cost })
  },

  upgradeItem: (itemId) => {
    const { gold } = get()
    const found = findItem(get(), itemId)
    if (!found || !canUpgrade(found.item)) return
    const cost = upgradeCost(found.item)
    if (gold < cost) return
    const next = upgradeRarity(found.item, itemRng)
    replaceItem(get, set, itemId, next)
    set({ gold: gold - cost })
  },

  chooseEvolution: (sentinelId, nodeId) => {
    const { roster, evolutionQueue } = get()
    const nextRoster = roster.map((s) => (s.id === sentinelId ? evolveInto(s, nodeId) : s))
    set({
      roster: nextRoster,
      evolutionQueue: evolutionQueue.filter((id) => id !== sentinelId),
    })
  },
}))
