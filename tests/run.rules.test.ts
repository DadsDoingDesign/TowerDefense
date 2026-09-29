import { describe, expect, it } from 'vitest'
import { idCounterState, restoreIdCounter, streamRng } from '../src/game/core/rng'
import { newRarityPity, generateItem } from '../src/game/data/items'
import type { MapNode } from '../src/game/data/runmap'
import type { RewardCard } from '../src/game/data/rewards'
import { createSentinel } from '../src/game/data/sentinels'
import { xpToReach } from '../src/game/engine/leveling'
import { endlessRoundSpoils } from '../src/game/run/battle'
import { ITEM_PRICE, merchantLuck, rollMerchantShelf, sortItems } from '../src/game/run/economy'
import { forkFires } from '../src/game/run/map'
import { recruitSlate, recruitTargetLevel, scaledRecruit } from '../src/game/run/recruits'
import { applyRewardCard } from '../src/game/run/rewards'
import { planPayout, runWasPlayed, type SettleFacts } from '../src/game/run/settle'
import {
  THREAT_PER_CHOICE,
  THREAT_PER_NODE,
  THREAT_PER_ROUND,
  clearBonusGold,
  mapKind,
  nodeClearLuck,
  nodeKind,
  threatAfterChoice,
  threatAfterClear,
  threatAfterRound,
  threatAfterSpecial,
} from '../src/game/run/threat'
import { STANDARD_RUN } from '../src/state/daily'
import type { Sentinel } from '../src/game/types'

const node = (type: MapNode['type'], layer = 3): MapNode => ({ id: `n-${type}-${layer}`, type, layer, row: 0 }) as MapNode

describe('threat maths (game/run/threat)', () => {
  it('charges each node its MAP kind, whatever the Banner substitutes', () => {
    expect(threatAfterClear(1, node('battle'))).toBe(THREAT_PER_NODE.normal)
    expect(threatAfterClear(1, node('elite'))).toBe(THREAT_PER_NODE.elite)
    expect(threatAfterClear(2, node('boss'))).toBe(2)
    // Elite Watch substitutes the encounter, never the node's worth (M19-g).
    expect(nodeKind(node('battle'), { allElite: true })).toBe('elite')
    expect(mapKind(node('battle'))).toBe('normal')
  })

  it('compounds: a route is the product of its steps', () => {
    let t = 1
    t = threatAfterClear(t, node('battle'))
    t = threatAfterSpecial(t, 'shrine')
    t = threatAfterChoice(t)
    t = threatAfterClear(t, node('elite'))
    expect(t).toBeCloseTo(1.42 * 1.13 * 1.05 * 1.52, 12)
    // The exact float the store used to compute inline, step by step.
    expect(t).toBe(((1 * THREAT_PER_NODE.normal) * THREAT_PER_NODE.special * THREAT_PER_CHOICE) * THREAT_PER_NODE.elite)
  })

  it('only specials charge the special step; the rest pass through', () => {
    for (const s of ['merchant', 'shrine', 'recruit'] as const) expect(threatAfterSpecial(1, s)).toBe(THREAT_PER_NODE.special)
    for (const s of ['battle', 'elite', 'boss', 'start'] as const) expect(threatAfterSpecial(1.5, s)).toBe(1.5)
    expect(threatAfterSpecial(1.5, undefined)).toBe(1.5)
  })

  it('an Endless elite round compounds harder than a plain one', () => {
    expect(threatAfterRound(1, false)).toBe(THREAT_PER_ROUND)
    expect(threatAfterRound(1, true)).toBe(THREAT_PER_ROUND * 1.08)
  })

  it('purse and luck follow the map kind', () => {
    expect(clearBonusGold(node('battle'))).toBe(0)
    expect(clearBonusGold(node('elite'))).toBe(25)
    expect(clearBonusGold(node('boss'))).toBe(100)
    expect(nodeClearLuck(node('battle', 2))).toBeCloseTo(0.06)
    expect(nodeClearLuck(node('elite', 2))).toBeCloseTo(0.21)
    expect(nodeClearLuck(node('boss', 10))).toBeCloseTo(0.65)
  })
})

describe('merchant shelf (game/run/economy)', () => {
  const roster = [createSentinel('rogue')]
  const shelfFrom = (seed: number) => {
    const ids = idCounterState()
    const shelf = rollMerchantShelf(streamRng(seed, 'loot'), { luck: merchantLuck(4), roster, pity: newRarityPity() })
    restoreIdCounter(ids)
    return shelf.map((e) => ({ name: e.item.name, rarity: e.item.rarity, slot: e.item.slot, price: e.price }))
  }

  it('is deterministic in the seed', () => {
    expect(shelfFrom(42)).toEqual(shelfFrom(42))
    expect(shelfFrom(42)).not.toEqual(shelfFrom(43))
  })

  it('deals four items priced by rarity, and never spends the pity counter', () => {
    const pity = { dry: 7 }
    const shelf = rollMerchantShelf(streamRng(9, 'loot'), { luck: 0.2, roster, pity })
    expect(shelf).toHaveLength(4)
    for (const e of shelf) expect(e.price).toBe(ITEM_PRICE[e.item.rarity])
    expect(pity).toEqual({ dry: 7 })
  })

  it('sorts the pack rarity-first without mutating it', () => {
    const rng = streamRng(3, 'loot')
    const items = [generateItem(rng, { rarity: 'common' }), generateItem(rng, { rarity: 'epic' }), generateItem(rng, { rarity: 'rare' })]
    const sorted = sortItems(items)
    expect(sorted.map((i) => i.rarity)).toEqual(['epic', 'rare', 'common'])
    expect(items.map((i) => i.rarity)).toEqual(['common', 'epic', 'rare'])
  })
})

describe('reward application (game/run/rewards)', () => {
  const base = () => ({ roster: [createSentinel('fighter'), createSentinel('mystic')], inventory: [], runMods: [], lootPity: { dry: 4 } })

  it('a stat card buffs the whole company and appends its team mods', () => {
    const t = base()
    const card: RewardCard = { id: 'c', kind: 'stat', title: '', desc: '', rarity: 'rare', grant: { stats: { str: 2, int: 1 }, thorns: 3, mods: { rateMult: 1.1 } } }
    const next = applyRewardCard(t, card)
    next.roster.forEach((s, i) => {
      expect(s.stats.str).toBe(t.roster[i].stats.str + 2)
      expect(s.stats.int).toBe(t.roster[i].stats.int + 1)
      expect(s.stats.dex).toBe(t.roster[i].stats.dex)
      expect(s.thorns).toBe(t.roster[i].thorns + 3)
    })
    expect(next.runMods).toEqual([{ rateMult: 1.1 }])
    // A stat card is not a drop: the pity counter does not move.
    expect(next.lootPity).toBe(t.lootPity)
  })

  it('an item card lands on the company (or the pack) and credits a COPY of pity', () => {
    const t = base()
    const item = generateItem(streamRng(5, 'loot'), { rarity: 'common', slot: 'oneHand' })
    const card: RewardCard = { id: 'c', kind: 'item', title: '', desc: '', rarity: 'common', item }
    const next = applyRewardCard(t, card)
    const everywhere = [...next.inventory, ...next.roster.flatMap((s) => Object.values(s.equipment))]
    expect(everywhere.some((i) => i?.id === item.id)).toBe(true)
    expect(next.lootPity).toEqual({ dry: 5 })
    expect(t.lootPity).toEqual({ dry: 4 })
  })
})

describe('recruit scaling (game/run/recruits)', () => {
  const lv = (...levels: number[]) => levels.map((level) => ({ level }))

  it('targets the roster median, three back unless trained, never below 1', () => {
    expect(recruitTargetLevel([])).toBe(1)
    expect(recruitTargetLevel(lv(2, 3))).toBe(1)
    expect(recruitTargetLevel(lv(4, 9, 12))).toBe(6)
    expect(recruitTargetLevel(lv(4, 9, 12), true)).toBe(9)
    // Median of an even roster is the upper-middle, as the store always read it.
    expect(recruitTargetLevel(lv(1, 5, 7, 20))).toBe(4)
  })

  it('a hire arrives at the target level with the hub stat bonus', () => {
    const veteran = (level: number): Sentinel => ({ ...createSentinel('fighter'), level, xp: xpToReach(level) })
    const roster = [veteran(10), veteran(10), veteran(12)]
    const plain = scaledRecruit(streamRng(1, 'loot'), 'rogue', roster, { statBonus: 0, trained: false })
    expect(plain.level).toBe(7)
    const trained = scaledRecruit(streamRng(1, 'loot'), 'rogue', roster, { statBonus: 0, trained: true })
    expect(trained.level).toBe(10)
    const fresh = scaledRecruit(streamRng(1, 'loot'), 'rogue', [], { statBonus: 2, trained: false })
    const bare = scaledRecruit(streamRng(1, 'loot'), 'rogue', [], { statBonus: 0, trained: false })
    expect(fresh.level).toBe(1)
    expect(fresh.stats.str).toBe(bare.stats.str + 2)
    // Armed on arrival.
    expect(plain.equipment.mainHand).toBeTruthy()
  })

  it('the slate is one per archetype and deterministic in the stream', () => {
    const deal = () => {
      // Names come off a process-wide, forward-only counter, so compare what
      // the STREAM decides: archetype, weapon and its rolled numbers.
      const slate = recruitSlate(streamRng(8, 'loot'), [], { statBonus: 0, trained: false })
      return slate.map((s) => ({ a: s.archetype, w: s.equipment.mainHand?.name, base: s.equipment.mainHand?.base }))
    }
    const a = deal()
    expect(a.map((s) => s.a)).toEqual(['fighter', 'rogue', 'mystic'])
    expect(deal()).toEqual(a)
  })
})

describe('settle payout (game/run/settle)', () => {
  const facts = (over: Partial<SettleFacts> = {}): SettleFacts => ({
    mode: 'campaign', depth: 3, kills: 10, downs: 0, wins: 0, banner: 0, challenge: STANDARD_RUN, ...over,
  })

  it('pays nothing for a run that was never played', () => {
    expect(runWasPlayed(facts({ depth: 0, kills: 0 }))).toBe(false)
    expect(planPayout(facts({ depth: 0, kills: 0 }), 5)).toEqual({ kind: 'none' })
    expect(planPayout(facts({ mode: 'endless', depth: 0, kills: 0 }), 5)).toEqual({ kind: 'none' })
  })

  it('closes an abandoned scored Daily instead of paying it', () => {
    const daily = { kind: 'daily' as const, date: '2026-09-29', scored: true }
    expect(planPayout(facts({ depth: 0, kills: 0, challenge: daily }), 0)).toEqual({ kind: 'closeDaily', date: '2026-09-29' })
  })

  it('clamps a claimed Banner to what the save has opened (F8)', () => {
    const plan = planPayout(facts({ banner: 5 }), 1)
    expect(plan.kind === 'grant' && plan.grant.banner).toBe(1)
  })

  it('Endless settles through the same ledger, on rounds won', () => {
    expect(planPayout(facts({ mode: 'endless', wins: 7 }), 0)).toEqual({
      kind: 'grant',
      grant: { mode: 'endless', depth: 7, won: false, kills: 10, downs: 0 },
    })
  })

  it('a custom seed pays but is unranked', () => {
    const plan = planPayout(facts({ challenge: { kind: 'seeded', date: null, scored: false } }), 0)
    expect(plan.kind === 'grant' && plan.grant.ranked).toBe(false)
  })
})

describe('run structure helpers', () => {
  it('endless spoils: every 10th a boss, other 5ths elite', () => {
    expect(endlessRoundSpoils(3)).toMatchObject({ isBoss: false, isElite: false, dustGain: 5, lootCount: 1 })
    expect(endlessRoundSpoils(5)).toMatchObject({ isBoss: false, isElite: true, dustGain: 10, lootCount: 2 })
    expect(endlessRoundSpoils(10)).toMatchObject({ isBoss: true, isElite: false, dustGain: 20, lootCount: 3 })
    expect(endlessRoundSpoils(30).luck).toBe(0.45)
  })

  it('the fork fires once, at half depth, never on the boss', () => {
    const map = { layers: 11 }
    expect(forkFires(map, 4, false, false)).toBe(false)
    expect(forkFires(map, 5, false, false)).toBe(true)
    expect(forkFires(map, 5, true, false)).toBe(false)
    expect(forkFires(map, 10, false, true)).toBe(false)
  })
})

describe('settle pays once (through the store)', () => {
  it('a retired run cannot be paid again, even if put back on the map (M-1)', async () => {
    const { useGameStore } = await import('../src/state/gameStore')
    const { useMetaStore } = await import('../src/state/metaStore')
    // Counted on the ledger itself: a spy on the state object would miss every
    // call after the first `set` replaces that object.
    const runs = () => useMetaStore.getState().stats.runsCompleted
    const g = () => useGameStore.getState()
    g().newRun()
    g().pickStartingHero('fighter')
    useGameStore.setState({ clearedNodeIds: [...g().clearedNodeIds, 'fake-1', 'fake-2'], runKills: 12 })
    const before = runs()
    g().returnToHub()
    expect(runs()).toBe(before + 1)
    expect(g().runSettled).toBe(true)
    // The old bug: putting `screen` back made the settled run live and payable.
    useGameStore.setState({ screen: 'map' })
    g().returnToHub()
    g().newRun()
    expect(runs()).toBe(before + 1)
  })
})
