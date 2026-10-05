import { afterEach, describe, expect, it } from 'vitest'
import { RNG, streamRng } from '../src/game/core/rng'
import { generateRunMap } from '../src/game/data/runmap'
import { battleRelicsWithheld, CALM_DEPTH, CHALLENGE_DEPTH, FIRST_MERCHANT_LAYER, stageFirstRunMap } from '../src/game/run/firstRun'
import { rewardHand } from '../src/game/run/relics'
import { nodeHazardSeed, nodeTerrainRule } from '../src/game/run/terrain'
import { useGameStore } from '../src/state/gameStore'
import { useMetaStore } from '../src/state/metaStore'
import { streams } from '../src/state/game/runtime'

/**
 * LS3 — the four things a first run holds back on the road itself
 * (`game/run/firstRun.ts`), and the promise that pays for them: every other
 * run — and the balance harness — deals exactly what it dealt before, draw for
 * draw, and even a first run draws nothing extra.
 */

const SEEDS = Array.from({ length: 400 }, (_, i) => 1000 + i * 7919)

describe('merchants from the second stop', () => {
  it('a first run has no merchant before layer 2, and keeps its merchants wherever the road has room', () => {
    let moved = 0
    for (const seed of SEEDS) {
      const map = generateRunMap(new RNG(seed))
      const staged = stageFirstRunMap(map, true)
      expect(staged.nodes.some((n) => n.type === 'merchant' && n.layer < FIRST_MERCHANT_LAYER)).toBe(false)
      const count = (m: typeof map) => m.nodes.filter((n) => n.type === 'merchant').length
      expect(count(staged)).toBeLessThanOrEqual(count(map))
      if (staged !== map) {
        moved++
        // A moved merchant lands on the nearest later layer with room; only a
        // road with no room anywhere loses it — and never its last one.
        expect(count(staged)).toBeGreaterThanOrEqual(Math.max(1, count(map) - 1))
        // Only node TYPES move: the shape of the road is untouched.
        expect(staged.edges).toBe(map.edges)
        expect(staged.nodes.map((n) => [n.id, n.layer, n.row])).toEqual(map.nodes.map((n) => [n.id, n.layer, n.row]))
        // Every layer still has a fight on it.
        for (let l = 1; l < staged.layers - 1; l++) {
          const row = staged.nodes.filter((n) => n.layer === l)
          expect(row.some((n) => ['battle', 'elite', 'miniboss'].includes(n.type))).toBe(true)
        }
      }
    }
    // The case is real: some deals do put a merchant on the first stop.
    expect(moved).toBeGreaterThan(0)
  })

  it('is the identity for any run that is not a first run', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      const map = generateRunMap(new RNG(seed))
      expect(stageFirstRunMap(map, false)).toBe(map)
    }
  })
})

describe('danger tiles and map challenges not before depth 3', () => {
  const nodes = [1, 2, 3, 4, 5, 6].flatMap((layer) => [0, 1, 2].map((r) => ({ id: `n${layer}-${r}`, type: 'battle', layer })))

  it('a first run lays no cursed ground before depth 3, and no challenge before depth 4', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      for (const n of nodes) {
        const hazard = nodeHazardSeed(n, seed, { firstRun: true })
        const rule = nodeTerrainRule(n, seed, { firstRun: true })
        if (n.layer < CALM_DEPTH) expect(hazard).toBeNull()
        else expect(hazard).toBe(nodeHazardSeed(n, seed))
        if (n.layer < CHALLENGE_DEPTH) expect(rule).toBeNull()
        else expect(rule).toBe(nodeTerrainRule(n, seed))
      }
    }
    expect(CALM_DEPTH).toBeGreaterThanOrEqual(3)
  })

  it('every other run — and the harness, which passes nothing — gets exactly the old answer', () => {
    for (const seed of SEEDS.slice(0, 60)) {
      for (const n of nodes) {
        expect(nodeHazardSeed(n, seed, { firstRun: false })).toBe(nodeHazardSeed(n, seed))
        expect(nodeTerrainRule(n, seed, { firstRun: false })).toBe(nodeTerrainRule(n, seed))
      }
    }
  })
})

describe('relics at the first elite', () => {
  const map = { nodes: [{ id: 'b', type: 'battle' as const }, { id: 'e', type: 'elite' as const }, { id: 'm', type: 'miniboss' as const }] }
  it('a first run holds battle relics back until an elite (or act boss) is cleared', () => {
    expect(battleRelicsWithheld(true, map, ['b'])).toBe(true)
    expect(battleRelicsWithheld(true, map, ['b', 'e'])).toBe(false)
    expect(battleRelicsWithheld(true, map, ['m'])).toBe(false)
    expect(battleRelicsWithheld(false, map, ['b'])).toBe(false)
  })

  it('the elite’s own hand still carries its relic', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      const hand = rewardHand(new RNG(seed), { kind: 'elite', luck: 0, count: 3, held: [], noBattleRelics: true })
      expect(hand.some((c) => c.kind === 'relic')).toBe(true)
    }
  })
})

describe('RNG draw order (the store)', () => {
  afterEach(() => useMetaStore.getState().resetMeta())

  const dealt = (runsCompleted: number, seed: number) => {
    useMetaStore.setState({ stats: { ...useMetaStore.getState().stats, runsCompleted } })
    useGameStore.getState().beginCampaign(seed, { kind: 'standard', date: null, scored: false })
    useGameStore.getState().pickStartingHero('rogue')
    const st = useGameStore.getState()
    return { st, map: streams.mapRng.saveState(), loot: streams.rng.saveState() }
  }

  it('a returning player’s run deals the same map, from the same stream positions, as it always did', () => {
    for (const seed of [11, 4242, 90210, 31337]) {
      const { st, map } = dealt(2, seed)
      expect(st.firstRun).toBe(false)
      // The map is exactly `generateRunMap` off the run's map stream…
      const rng = streamRng(seed, 'map')
      const shape = (m: typeof st.runMap) => ({ nodes: m.nodes.map((n) => [n.type, n.layer, n.row, n.ny]), edges: m.edges.length, layers: m.layers })
      expect(shape(st.runMap)).toEqual(shape(generateRunMap(rng, { wideMap: false, extraRecruit: false, standingOrders: false, noMerchants: false, noRecruits: false })))
      // …and the stream has moved exactly as far as that one deal.
      expect(map).toBe(rng.saveState())
    }
  })

  it('a first run draws nothing extra: every stream stands where a returning player’s does', () => {
    for (const seed of [11, 4242, 90210, 31337]) {
      const back = dealt(2, seed)
      const first = dealt(0, seed)
      expect(first.st.firstRun).toBe(true)
      expect(first.map).toBe(back.map)
      expect(first.loot).toBe(back.loot)
      // The same hero, the same kit: only the road's staging differs. (Ids and
      // names come off process-wide counters, so compare what was DEALT.)
      const kit = (s: typeof first.st) => s.roster.map((h) => [h.name, h.stats, h.equipment.mainHand?.name, h.equipment.offHand?.name, h.equipment.body?.name])
      expect(kit(first.st)).toEqual(kit(back.st))
      expect(first.st.runMap.edges.length).toBe(back.st.runMap.edges.length)
      expect(first.st.runMap.nodes.map((n) => [n.layer, n.row])).toEqual(back.st.runMap.nodes.map((n) => [n.layer, n.row]))
    }
  })

  it('entering a first-run fight on a calm depth lays plain ground without touching a stream', () => {
    const seed = 777
    const first = dealt(0, seed)
    const node = first.st.runMap.nodes.find((n) => first.st.reachableNodeIds.includes(n.id) && n.type === 'battle')!
    const before = [streams.mapRng.saveState(), streams.rng.saveState()]
    useGameStore.getState().selectNode(node.id)
    const st = useGameStore.getState()
    expect(st.battleMap.hazardSeed).toBeUndefined()
    expect(st.battleMap.terrainRule).toBeUndefined()
    expect(st.battleMap.tiles?.some((t) => t.danger)).toBe(false)
    expect([streams.mapRng.saveState(), streams.rng.saveState()]).toEqual(before)
  })
})
