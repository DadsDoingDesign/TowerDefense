import { create } from 'zustand'
import { GameEngine, type BattleResult } from '../game/engine/engine'
import { applyXp, evolutionPending, evolveInto } from '../game/engine/leveling'
import { FIRST_MAP } from '../game/data/maps'
import { startingRoster } from '../game/data/sentinels'
import { generateWave, TOTAL_WAVES } from '../game/data/waves'
import type { GameMap, Placement, Sentinel } from '../game/types'

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
    const { engine, roster, gold, waveIndex, totalWaves } = get()
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

    const wonRun = waveIndex >= totalWaves
    set({
      roster: nextRoster,
      gold: gold + result.goldEarned,
      baseHp: result.baseHpLeft,
      lastResult: result,
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

  chooseEvolution: (sentinelId, nodeId) => {
    const { roster, evolutionQueue } = get()
    const nextRoster = roster.map((s) => (s.id === sentinelId ? evolveInto(s, nodeId) : s))
    set({
      roster: nextRoster,
      evolutionQueue: evolutionQueue.filter((id) => id !== sentinelId),
    })
  },
}))
