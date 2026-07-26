import { create } from 'zustand'
import { RNG } from '../game/core/rng'
import { GameEngine, type BattleResult } from '../game/engine/engine'
import { applyXp, evolutionPending, evolveInto } from '../game/engine/leveling'
import { gameSfx, sfx } from '../audio/audio'
import { effectiveUpgradeLevels, teamKeepsakeMods } from '../game/engine/combat'
import { FIRST_MAP } from '../game/data/maps'
import { createSentinel, startingRoster } from '../game/data/sentinels'
import {
  canUpgrade,
  generateItem,
  HERO_SLOTS,
  heroSlotsFor,
  RARITY,
  RARITY_ORDER,
  reforgeCost,
  reforgeDust,
  reforgeItem,
  upgradeCost,
  upgradeDust,
  upgradeRarity,
} from '../game/data/items'
import { generateRunMap, type MapNode, type RunMap } from '../game/data/runmap'
import { generateRewardCards, type RewardCard } from '../game/data/rewards'
import { rollMutation } from '../game/data/mutations'
import { getUpgradePath, milestoneForLevel } from '../game/data/upgradeTree'
import { rollShrine, type ShrineOffer } from '../game/data/shrines'
import { generateEncounter, generateEndlessWave, type EncounterKind } from '../game/data/waves'
import type { Archetype, EffectMods, GameMap, HeroSlot, Item, ItemRarity, Mutation, Placement, Sentinel, Tactics, WaveDef } from '../game/types'
import { useMetaStore, type MetaBonuses } from './metaStore'

const DEFAULT_TACTICS: Tactics = { focus: 'first', holdFire: false }

export type Screen = 'hub' | 'heroPick' | 'map' | 'crossroads' | 'battle' | 'endless'
export type BattlePhase = 'setup' | 'battle'
export type RunPhase = 'active' | 'won' | 'lost'
export type Speed = 1 | 2 | 3
export type EventKind = 'merchant' | 'shrine' | 'recruit'

export const MAX_BASE_HP = 20
export const START_GOLD = 60
export const MAX_ROSTER = 5

// Endless Watch starting pool + tuning.
export const ENDLESS_START_GOLD = 200
export const ENDLESS_START_DUST = 30
export const ENDLESS_LIVES = 3

const ITEM_PRICE: Record<ItemRarity, number> = { common: 30, rare: 60, epic: 110, legendary: 200, mythic: 340 }
/** Gold / dust recovered when dismantling an item, by rarity. */
const SCRAP_GOLD: Record<ItemRarity, number> = { common: 8, rare: 18, epic: 40, legendary: 75, mythic: 130 }
const SCRAP_DUST: Record<ItemRarity, number> = { common: 2, rare: 4, epic: 8, legendary: 14, mythic: 22 }
export const scrapGold = (item: Item): number => SCRAP_GOLD[item.rarity]
export const scrapDust = (item: Item): number => SCRAP_DUST[item.rarity]

/** Inventory sort: rarity (highest first), then kind, then name. */
function sortItems(items: Item[]): Item[] {
  const kindOrder = ['oneHand', 'twoHand', 'offHand', 'body']
  return [...items].sort((a, b) => {
    const r = RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity)
    if (r) return r
    const k = kindOrder.indexOf(a.slot) - kindOrder.indexOf(b.slot)
    if (k) return k
    return a.name.localeCompare(b.name)
  })
}
const RECRUIT_PRICE = 80

// Compounding difficulty: a campaign run is one continuous escalating defense.
// Threat rises as you clear nodes and as you gain power (shrines / recruits), so
// enemies get tougher to reflect your own compounding strength.
export const THREAT_PER_NODE = { normal: 1.12, elite: 1.2, boss: 1 } as const
export const THREAT_PER_CHOICE = 1.05

export type GameMode = 'campaign' | 'endless'
export type EndlessRoom = 'merchant' | 'forge' | 'shrine' | 'recruit'

const rng = new RNG()

function startingInventory(extra = 0): Item[] {
  const items = [
    generateItem(rng, { slot: 'oneHand', rarity: 'common' }),
    generateItem(rng, { slot: 'body', rarity: 'common' }),
    generateItem(rng, { slot: 'offHand', rarity: 'rare' }),
  ]
  for (let i = 0; i < extra; i++) items.push(generateItem(rng, { luck: 0.1 }))
  return items
}

function applyStatBonus(s: Sentinel, n: number): Sentinel {
  if (!n) return s
  return { ...s, stats: { str: s.stats.str + n, dex: s.stats.dex + n, int: s.stats.int + n } }
}

/** Starting roster including any meta bonuses (extra Sentinels + flat stats). */
function buildStartingRoster(bonuses: MetaBonuses): Sentinel[] {
  const archs: Archetype[] = ['fighter', 'rogue', 'mystic']
  const extra: Sentinel[] = []
  for (let i = 0; i < bonuses.extraSentinels; i++) extra.push(createSentinel(archs[i % 3]))
  return [...startingRoster(), ...extra].map((s) => applyStatBonus(s, bonuses.statBonus))
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
  // Mode
  mode: GameMode
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
  maxBaseHp: number
  enemyHpMult: number
  /** Compounding campaign difficulty multiplier (1 = start of run). */
  threat: number
  inventory: Item[]
  // Run tallies (for meta rewards)
  runKills: number
  runDowns: number
  marksEarned: number

  // Active battle
  activeNodeId: string | null
  currentWave: WaveDef | null
  battlePhase: BattlePhase
  speed: Speed
  tactics: Tactics
  engine: GameEngine | null
  hud: HudSnapshot
  lastResult: BattleResult | null
  lastLoot: Item[]

  // Event payloads
  merchant: MerchantStock | null
  shrineOffer: ShrineOffer | null
  recruitOptions: Sentinel[]
  /** Post-wave: three cards to choose one of (attribute buff or item). */
  reward: RewardCard[] | null
  /** Team-wide mods granted by attribute rewards this run. */
  runMods: EffectMods[]
  /** Mid-map fork (once per run): recruit a teammate or roll an attack mutation. */
  crossroads: { recruits: Sentinel[]; revealed?: { heroName: string; mutation: Mutation } } | null
  forkDone: boolean

  // Endless Watch
  dust: number
  lives: number
  wins: number
  round: number
  endlessRecruitCost: number
  endlessRoom: EndlessRoom | null

  // UI
  selectedSentinelId: string | null
  detailId: string | null
  equipContext: { sentinelId: string; tab: HeroSlot | 'all' } | null
  /** Sentinel id whose tower-upgrade panel is open, or null. */
  upgradeTarget: string | null
  /** Whether the drag-and-drop inventory manager overlay is open. */
  inventoryOpen: boolean
  evolutionQueue: string[]

  // Actions — run/map
  newRun: () => void
  pickStartingHero: (archetype: Archetype) => void
  returnToHub: () => void
  selectNode: (nodeId: string) => void
  // Actions — endless
  startEndless: () => void
  endlessOpenRoom: (room: EndlessRoom) => void
  endlessCloseRoom: () => void
  endlessBeginWave: () => void
  endlessBuyItem: (itemId: string) => void
  endlessRecruit: () => void
  endlessForgeReforge: (itemId: string) => void
  endlessForgeUpgrade: (itemId: string) => void
  endlessShrineAccept: () => void
  // Actions — battle
  selectSentinel: (id: string | null) => void
  placeOnSlot: (slotId: string) => void
  clearSlot: (slotId: string) => void
  setSpeed: (s: Speed) => void
  setTactics: (t: Partial<Tactics>) => void
  startWave: () => void
  syncHud: () => void
  finishBattle: () => void
  chooseReward: (cardId: string) => void
  recruitTeammate: (sentinelId: string) => void
  rollHeroMutation: (heroId: string) => void
  finishCrossroads: () => void
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
  openEquip: (sentinelId: string, tab?: HeroSlot | 'all') => void
  closeEquip: () => void
  equipItem: (sentinelId: string, slot: HeroSlot, itemId: string) => void
  unequipItem: (sentinelId: string, slot: HeroSlot) => void
  sortInventory: () => void
  dismantleItem: (itemId: string) => void
  reforge: (itemId: string) => void
  upgradeItem: (itemId: string) => void
  chooseEvolution: (sentinelId: string, nodeId: string) => void
  // Actions — per-tower upgrade tree
  openUpgrade: (sentinelId: string) => void
  closeUpgrade: () => void
  buyTowerUpgrade: (sentinelId: string, pathId: string) => void
  openInventory: () => void
  closeInventory: () => void
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

function findItem(state: GameState, itemId: string): { item: Item } | null {
  const inv = state.inventory.find((i) => i.id === itemId)
  if (inv) return { item: inv }
  for (const s of state.roster) {
    for (const slot of HERO_SLOTS) {
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
    for (const slot of HERO_SLOTS) {
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
    mode: 'campaign',
    screen: 'hub',
    runPhase: 'active',
    ...initial,
    event: null,

    battleMap: FIRST_MAP,
    roster: startingRoster(),
    placements: emptyPlacements(FIRST_MAP),
    gold: START_GOLD,
    baseHp: MAX_BASE_HP,
    maxBaseHp: MAX_BASE_HP,
    enemyHpMult: 1,
    threat: 1,
    inventory: startingInventory(),
    runKills: 0,
    runDowns: 0,
    marksEarned: 0,

    activeNodeId: null,
    currentWave: null,
    battlePhase: 'setup',
    speed: 1,
    tactics: DEFAULT_TACTICS,
    engine: null,
    hud: freshHud(),
    lastResult: null,
    lastLoot: [],

    merchant: null,
    shrineOffer: null,
    recruitOptions: [],
    reward: null,
    runMods: [],
    crossroads: null,
    forkDone: false,

    dust: 0,
    lives: ENDLESS_LIVES,
    wins: 0,
    round: 1,
    endlessRecruitCost: 100,
    endlessRoom: null,

    selectedSentinelId: null,
    detailId: null,
    equipContext: null,
    upgradeTarget: null,
    inventoryOpen: false,
    evolutionQueue: [],

    newRun: () => {
      const b = useMetaStore.getState().bonuses()
      set({
        mode: 'campaign',
        screen: 'heroPick',
        runPhase: 'active',
        ...makeRun(),
        event: null,
        battleMap: FIRST_MAP,
        roster: [],
        placements: emptyPlacements(FIRST_MAP),
        gold: b.startGold,
        baseHp: b.maxBaseHp,
        maxBaseHp: b.maxBaseHp,
        enemyHpMult: b.enemyHpMult,
        threat: 1,
        inventory: startingInventory(b.extraItems),
        runKills: 0,
        runDowns: 0,
        marksEarned: 0,
        activeNodeId: null,
        currentWave: null,
        battlePhase: 'setup',
        speed: 1,
        tactics: DEFAULT_TACTICS,
        engine: null,
        hud: freshHud(),
        lastResult: null,
        lastLoot: [],
        merchant: null,
        shrineOffer: null,
        recruitOptions: [],
        reward: null,
        runMods: [],
        crossroads: null,
        forkDone: false,
        selectedSentinelId: null,
        detailId: null,
        equipContext: null,
        upgradeTarget: null,
        evolutionQueue: [],
      })
    },

    pickStartingHero: (archetype) => {
      const b = useMetaStore.getState().bonuses()
      const archs: Archetype[] = ['fighter', 'rogue', 'mystic']
      const extra: Sentinel[] = []
      for (let i = 0; i < b.extraSentinels; i++) extra.push(createSentinel(archs[i % 3]))
      const roster = [createSentinel(archetype), ...extra].map((s) => applyStatBonus(s, b.statBonus))
      set({ roster, screen: 'map' })
    },

    returnToHub: () => set({ screen: 'hub', runPhase: 'active', engine: null }),

    // ---- Endless Watch ----
    startEndless: () => {
      const b = useMetaStore.getState().bonuses()
      set({
        mode: 'endless',
        screen: 'endless',
        runPhase: 'active',
        battleMap: FIRST_MAP,
        roster: buildStartingRoster(b),
        placements: emptyPlacements(FIRST_MAP),
        gold: ENDLESS_START_GOLD,
        dust: ENDLESS_START_DUST,
        lives: ENDLESS_LIVES,
        wins: 0,
        round: 1,
        endlessRecruitCost: 100,
        endlessRoom: null,
        baseHp: b.maxBaseHp,
        maxBaseHp: b.maxBaseHp,
        enemyHpMult: b.enemyHpMult,
        threat: 1,
        inventory: startingInventory(b.extraItems),
        runKills: 0,
        runDowns: 0,
        marksEarned: 0,
        activeNodeId: null,
        currentWave: null,
        battlePhase: 'setup',
        speed: 1,
        tactics: DEFAULT_TACTICS,
        engine: null,
        hud: freshHud(),
        lastResult: null,
        lastLoot: [],
        merchant: null,
        shrineOffer: null,
        reward: null,
        runMods: [],
        crossroads: null,
        forkDone: false,
        selectedSentinelId: null,
        detailId: null,
        equipContext: null,
        upgradeTarget: null,
        evolutionQueue: [],
      })
    },

    endlessOpenRoom: (room) => {
      const { roster } = get()
      if (room === 'merchant') {
        const luck = Math.min(0.4, get().round * 0.03)
        const items = Array.from({ length: 4 }, () => {
          const item = generateItem(rng, { luck })
          return { item, price: ITEM_PRICE[item.rarity] }
        })
        set({ endlessRoom: 'merchant', merchant: { items, recruit: null } })
      } else if (room === 'shrine') {
        set({ endlessRoom: 'shrine', shrineOffer: rollShrine(rng) })
      } else if (room === 'recruit') {
        const archs: Archetype[] = ['fighter', 'rogue', 'mystic']
        set({ endlessRoom: 'recruit', recruitOptions: roster.length < MAX_ROSTER ? archs.map(createSentinel) : [] })
      } else {
        set({ endlessRoom: 'forge' })
      }
    },

    endlessCloseRoom: () => set({ endlessRoom: null, merchant: null, shrineOffer: null, recruitOptions: [] }),

    endlessBeginWave: () => {
      const wave = generateEndlessWave(get().round)
      const { baseHp, maxBaseHp } = get()
      set({
        currentWave: wave,
        battlePhase: 'setup',
        screen: 'battle',
        endlessRoom: null,
        selectedSentinelId: null,
        lastResult: null,
        lastLoot: [],
        hud: { ...freshHud(), baseHp, maxBaseHp, enemiesTotal: wave.spawns.length },
      })
    },

    endlessBuyItem: (itemId) => {
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

    endlessRecruit: () => {
      const { gold, roster, endlessRecruitCost, recruitOptions } = get()
      if (roster.length >= MAX_ROSTER || gold < endlessRecruitCost) return
      const pick = recruitOptions[0] ?? createSentinel(rng.pick(['fighter', 'rogue', 'mystic'] as Archetype[]))
      set({
        gold: gold - endlessRecruitCost,
        roster: [...roster, pick],
        endlessRecruitCost: Math.round(endlessRecruitCost * 1.6),
        endlessRoom: null,
        recruitOptions: [],
      })
    },

    endlessForgeReforge: (itemId) => {
      const { dust } = get()
      const found = findItem(get(), itemId)
      if (!found) return
      const cost = reforgeDust(found.item)
      if (dust < cost) return
      replaceItem(get, set, itemId, reforgeItem(found.item, rng))
      set({ dust: dust - cost })
    },

    endlessForgeUpgrade: (itemId) => {
      const { dust } = get()
      const found = findItem(get(), itemId)
      if (!found || !canUpgrade(found.item)) return
      const cost = upgradeDust(found.item)
      if (dust < cost) return
      replaceItem(get, set, itemId, upgradeRarity(found.item, rng))
      set({ dust: dust - cost })
    },

    endlessShrineAccept: () => {
      const { shrineOffer, roster, baseHp, gold } = get()
      if (!shrineOffer) return
      const eff = shrineOffer.apply({ roster, baseHp, gold })
      set({
        roster: eff.roster ?? roster,
        baseHp: Math.max(1, baseHp + (eff.baseHpDelta ?? 0)),
        gold: Math.max(0, gold + (eff.goldDelta ?? 0)),
        endlessRoom: null,
        shrineOffer: null,
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
      const { baseHp, maxBaseHp } = get()
      set({
        activeNodeId: nodeId,
        currentWave: wave,
        battlePhase: 'setup',
        screen: 'battle',
        selectedSentinelId: null,
        lastResult: null,
        lastLoot: [],
        hud: { ...freshHud(), baseHp, maxBaseHp, enemiesTotal: wave.spawns.length },
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
    setTactics: (t) => set({ tactics: { ...get().tactics, ...t } }),

    startWave: () => {
      const { battleMap, roster, placements, baseHp, maxBaseHp, enemyHpMult, threat, mode, currentWave, tactics, runMods } = get()
      if (!currentWave) return
      // Campaign compounds via Threat; endless escalates via its own round scaling.
      const effHpMult = enemyHpMult * (mode === 'campaign' ? threat : 1)
      const engine = new GameEngine({
        map: battleMap,
        wave: currentWave,
        placedSentinels: placedSentinels(roster, placements),
        baseHp,
        maxBaseHp,
        enemyHpMult: effHpMult,
        teamMods: [...teamKeepsakeMods(roster), ...runMods],
        tactics,
        onEvent: gameSfx,
      })
      sfx('wave')
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
      const st = get()
      if (!st.engine) return
      const result = st.engine.result()
      sfx(result.status === 'cleared' ? 'confirm' : 'defeat')
      const totalKills0 = st.runKills + result.enemiesKilled
      const totalDowns0 = st.runDowns + result.downed

      // XP + evolution apply in both modes and both outcomes.
      const xpById0 = new Map(result.perSentinel.map((p) => [p.id, p.xpGained]))
      const rosterXp = st.roster.map((s) => applyXp(s, xpById0.get(s.id) ?? 0))
      const evoQueue0 = rosterXp.filter(evolutionPending).map((s) => s.id)

      if (st.mode === 'endless') {
        if (result.status === 'cleared') {
          const isBoss = st.round % 10 === 0
          const isElite = !isBoss && st.round % 5 === 0
          const dustGain = 5 + (isElite ? 5 : 0) + (isBoss ? 15 : 0)
          const lootCount = isBoss ? 3 : isElite ? 2 : 1
          const loot = Array.from({ length: lootCount }, () =>
            generateItem(rng, { luck: Math.min(0.45, st.round * 0.03) }),
          )
          set({
            roster: rosterXp,
            gold: st.gold + result.goldEarned,
            dust: st.dust + dustGain,
            baseHp: st.maxBaseHp,
            inventory: [...st.inventory, ...loot],
            lastResult: result,
            lastLoot: loot,
            evolutionQueue: evoQueue0,
            wins: st.wins + 1,
            round: st.round + 1,
            engine: null,
            runKills: totalKills0,
            runDowns: totalDowns0,
          })
        } else {
          const lives = st.lives - 1
          if (lives <= 0) {
            const marks = Math.round(st.wins * 8)
            useMetaStore.getState().grantMarks(marks)
            set({
              roster: rosterXp,
              gold: st.gold + result.goldEarned,
              lives: 0,
              runPhase: 'lost',
              lastResult: result,
              engine: null,
              marksEarned: marks,
              runKills: totalKills0,
              runDowns: totalDowns0,
              evolutionQueue: evoQueue0,
            })
          } else {
            set({
              roster: rosterXp,
              gold: st.gold + result.goldEarned,
              baseHp: st.maxBaseHp,
              lives,
              round: st.round + 1,
              lastResult: result,
              engine: null,
              runKills: totalKills0,
              runDowns: totalDowns0,
              evolutionQueue: evoQueue0,
            })
          }
        }
        return
      }

      // ---- Campaign ----
      const { roster, gold, inventory, runMap, activeNodeId } = st
      if (!activeNodeId) return
      const node = runMap.nodes.find((n) => n.id === activeNodeId)!
      const totalKills = totalKills0
      const totalDowns = totalDowns0

      if (result.status === 'defeated') {
        const depth = get().clearedNodeIds.length - 1
        const marks = useMetaStore
          .getState()
          .grantRunRewards({ depth, won: false, kills: totalKills, downs: totalDowns })
        set({
          runPhase: 'lost',
          lastResult: result,
          baseHp: 0,
          engine: null,
          runKills: totalKills,
          runDowns: totalDowns,
          marksEarned: marks,
        })
        return
      }

      // XP + evolution.
      const xpById = new Map(result.perSentinel.map((p) => [p.id, p.xpGained]))
      const nextRoster = roster.map((s) => applyXp(s, xpById.get(s.id) ?? 0))
      const evolutionQueue = nextRoster.filter(evolutionPending).map((s) => s.id)

      // Advance the map.
      const kind = nodeKind(node)
      const cleared = [...get().clearedNodeIds, activeNodeId]
      const reachable = neighborsOf(runMap, activeNodeId).filter((id) => !cleared.includes(id))
      const wonRun = node.type === 'boss'
      if (wonRun) sfx('victory')
      const marks = wonRun
        ? useMetaStore
            .getState()
            .grantRunRewards({ depth: cleared.length - 1, won: true, kills: totalKills, downs: totalDowns })
        : 0
      // The world escalates with each node cleared — more so for elites.
      const nextThreat = st.threat * THREAT_PER_NODE[kind]
      const bonusGold = kind === 'boss' ? 100 : kind === 'elite' ? 25 : 0
      const luck = (kind === 'boss' ? 0.35 : kind === 'elite' ? 0.15 : 0) + node.layer * 0.03

      // Non-boss clears offer a 3-card pick (attribute buff or item). The boss
      // win ends the run, so it just drops its loot straight to the inventory.
      const reward = wonRun ? null : generateRewardCards(rng, { luck, count: 3 })
      const bossLoot = wonRun ? Array.from({ length: 3 }, () => generateItem(rng, { luck })) : []

      // At the map's halfway point, fire the one-time fork: recruit or mutate.
      const half = Math.ceil((runMap.layers - 1) / 2)
      const fireFork = !st.forkDone && !wonRun && node.layer >= half
      const crossroads = fireFork
        ? { recruits: nextRoster.length < MAX_ROSTER ? (['fighter', 'rogue', 'mystic'] as Archetype[]).map(createSentinel) : [] }
        : null

      set({
        roster: nextRoster,
        gold: gold + result.goldEarned + bonusGold,
        baseHp: result.baseHpLeft,
        inventory: [...inventory, ...bossLoot],
        threat: nextThreat,
        lastResult: result,
        lastLoot: bossLoot,
        reward,
        crossroads,
        forkDone: st.forkDone || fireFork,
        evolutionQueue,
        clearedNodeIds: cleared,
        currentNodeId: activeNodeId,
        reachableNodeIds: reachable,
        runPhase: wonRun ? 'won' : 'active',
        engine: null,
        runKills: totalKills,
        runDowns: totalDowns,
        marksEarned: marks,
      })
    },

    chooseReward: (cardId) => {
      const { reward, roster, inventory, runMods } = get()
      if (!reward) return
      const card = reward.find((c) => c.id === cardId)
      if (!card) return
      sfx('reward')
      let nextRoster = roster
      let nextInv = inventory
      let nextMods = runMods
      if (card.kind === 'item' && card.item) {
        nextInv = [...inventory, card.item]
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
      // Applying a reward returns to the map — or to the mid-map fork if it fired.
      set({
        roster: nextRoster,
        inventory: nextInv,
        runMods: nextMods,
        reward: null,
        screen: get().crossroads ? 'crossroads' : 'map',
        activeNodeId: null,
        currentWave: null,
        lastResult: null,
        lastLoot: [],
        battlePhase: 'setup',
      })
    },

    recruitTeammate: (sentinelId) => {
      const { crossroads, roster } = get()
      if (!crossroads) return
      const hero = crossroads.recruits.find((s) => s.id === sentinelId)
      if (!hero || roster.length >= MAX_ROSTER) return
      set({ roster: [...roster, hero], crossroads: null, screen: 'map', threat: get().threat * THREAT_PER_CHOICE })
    },

    rollHeroMutation: (heroId) => {
      const { crossroads, roster } = get()
      if (!crossroads) return
      const hero = roster.find((s) => s.id === heroId)
      if (!hero) return
      const mutation = rollMutation(rng, (hero.mutations ?? []).map((m) => m.key))
      const nextRoster = roster.map((s) =>
        s.id === heroId ? { ...s, mutations: [...(s.mutations ?? []), mutation] } : s,
      )
      set({
        roster: nextRoster,
        crossroads: { ...crossroads, revealed: { heroName: hero.name, mutation } },
        threat: get().threat * THREAT_PER_CHOICE,
      })
    },

    finishCrossroads: () => set({ crossroads: null, screen: 'map' }),

    continueAfterWave: () => {
      // Endless returns to the Rooms screen; campaign returns to the node map.
      const dest = get().mode === 'endless' ? 'endless' : 'map'
      set({ screen: dest, activeNodeId: null, currentWave: null, lastResult: null, lastLoot: [], reward: null, battlePhase: 'setup' })
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
        threat: get().threat * THREAT_PER_CHOICE,
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
        threat: get().threat * THREAT_PER_CHOICE, // a stronger team draws a stronger foe
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
      if (pick && roster.length < MAX_ROSTER) {
        set({ roster: [...roster, pick], threat: get().threat * THREAT_PER_CHOICE })
      }
      completeNode(get, set, event.nodeId)
    },

    skipRecruit: () => {
      const { event } = get()
      if (event) completeNode(get, set, event.nodeId)
    },

    // ---- items / detail / evolution ----
    openDetail: (id) => set({ detailId: id }),
    closeDetail: () => set({ detailId: null }),
    openEquip: (sentinelId, tab = 'all') => set({ equipContext: { sentinelId, tab } }),
    closeEquip: () => set({ equipContext: null }),

    equipItem: (sentinelId, slot, itemId) => {
      const { roster, inventory } = get()
      const item = inventory.find((i) => i.id === itemId)
      if (!item || !heroSlotsFor(item.slot).includes(slot)) return
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
      set({ roster: nextRoster, inventory: nextInv })
      sfx('equip')
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
      const found = findItem(get(), itemId)
      if (!found) return
      const cost = reforgeCost(found.item)
      if (gold < cost) return sfx('error')
      replaceItem(get, set, itemId, reforgeItem(found.item, rng))
      set({ gold: gold - cost })
    },

    upgradeItem: (itemId) => {
      const { gold } = get()
      const found = findItem(get(), itemId)
      if (!found || !canUpgrade(found.item)) return
      const cost = upgradeCost(found.item)
      if (gold < cost) return sfx('error')
      replaceItem(get, set, itemId, upgradeRarity(found.item, rng))
      set({ gold: gold - cost })
    },

    chooseEvolution: (sentinelId, nodeId) => {
      const { roster, evolutionQueue } = get()
      const nextRoster = roster.map((s) => (s.id === sentinelId ? evolveInto(s, nodeId) : s))
      set({ roster: nextRoster, evolutionQueue: evolutionQueue.filter((id) => id !== sentinelId) })
      sfx('upgrade')
    },

    openUpgrade: (sentinelId) => set({ upgradeTarget: sentinelId }),
    closeUpgrade: () => set({ upgradeTarget: null }),
    openInventory: () => set({ inventoryOpen: true }),
    closeInventory: () => set({ inventoryOpen: false }),

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
