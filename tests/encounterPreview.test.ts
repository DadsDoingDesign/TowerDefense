import { addDifficultyElites } from '../src/game/run/map'
import { difficultyRules } from '../src/game/run/watch'
import { describe, expect, it } from 'vitest'
import { generateRunMap } from '../src/game/data/runmap'
import { streamRng } from '../src/game/core/rng'
import { useGameStore } from '../src/state/gameStore'
import {
  encounterKindFor,
  previewEncounter,
  resistHint,
  summarizeEncounter,
} from '../src/ui/shell/encounterPreview'

/**
 * The node preview must show the fight the battle actually spawns.
 *
 * This drives the REAL store: for each battle / elite / boss node it makes the
 * node reachable, calls `selectNode` — the one call that generates a battle's
 * wave — and asserts the wave it put in `currentWave` is deep-equal to
 * `previewEncounter` for the same node. Many seeds, every fight node on each
 * map, and several difficulty steps (SK1: a step's extra elites are elite
 * NODES on the map, so the preview reads them like any other elite).
 */
function fightNodes(state: ReturnType<typeof useGameStore.getState>) {
  return state.runMap.nodes.filter((n) => n.type === 'battle' || n.type === 'elite' || n.type === 'boss')
}

describe('encounter preview == spawned encounter', () => {
  const SEEDS = [1, 7, 42, 1337, 90210, 424242, 777777, 20260929, 3141592, 99999999]
  const TIERS = [0, 2, 5]

  for (const tier of TIERS) {
    it(`matches selectNode for every fight node across ${SEEDS.length} seeds (difficulty ${tier})`, () => {
      let checked = 0
      for (const seed of SEEDS) {
        const runMap = addDifficultyElites(generateRunMap(streamRng(seed, 'map')), difficultyRules(tier).extraElites, seed)
        useGameStore.setState({
          runSeed: seed,
          contract: null,
          runMap,
          runPhase: 'active',
          screen: 'map',
          event: null,
        })
        for (const node of fightNodes(useGameStore.getState())) {
          const st = useGameStore.getState()
          const preview = previewEncounter(st, node.id)
          expect(preview, `preview for ${node.type} ${node.id}`).not.toBeNull()
          useGameStore.setState({
            screen: 'map',
            event: null,
            reachableNodeIds: [node.id],
            clearedNodeIds: [],
            currentWave: null,
          })
          useGameStore.getState().selectNode(node.id)
          const spawned = useGameStore.getState().currentWave
          expect(spawned, `selectNode spawned nothing on ${node.id}`).not.toBeNull()
          expect(preview).toEqual(spawned)
          // Phase 3a: the node is cut into 2–3 sub-waves, and the preview
          // carries the same cut (the deep-equal above includes `group`).
          const groups = new Set(spawned!.spawns.map((s) => s.group))
          expect(groups.size, `sub-waves on ${node.id}`).toBeGreaterThanOrEqual(2)
          expect(groups.size).toBeLessThanOrEqual(3)
          // The summary reads that same wave.
          const sum = summarizeEncounter(st, node.id)!
          expect(sum.heads).toBe(spawned!.spawns.length)
          checked++
        }
      }
      // Guard against a vacuous pass (no fight nodes generated at all).
      expect(checked).toBeGreaterThan(SEEDS.length * 5)
    })
  }

  it('returns null for non-fight nodes', () => {
    const runMap = generateRunMap(streamRng(5, 'map'))
    const run = { runSeed: 5, runDifficulty: 0, runMap }
    for (const n of runMap.nodes) {
      if (n.type === 'merchant' || n.type === 'shrine' || n.type === 'recruit' || n.type === 'start') {
        expect(previewEncounter(run, n.id)).toBeNull()
        expect(encounterKindFor(n)).toBeNull()
      }
    }
  })

  it('a node fields its own kind: a battle is normal, an elite elite, a boss a boss', () => {
    expect(encounterKindFor({ type: 'battle' })).toBe('normal')
    expect(encounterKindFor({ type: 'elite' })).toBe('elite')
    expect(encounterKindFor({ type: 'boss' })).toBe('boss')
  })

  it('a difficulty step turns battle nodes into elites on the map, one more per act per step', () => {
    for (const seed of [3, 99, 4242]) {
      const base = generateRunMap(streamRng(seed, 'map'))
      const count = (m: typeof base) => m.nodes.filter((n) => n.type === 'elite').length
      const fights = base.nodes.filter((n) => n.type === 'battle' && n.layer > 1).length
      expect(addDifficultyElites(base, 0, seed)).toBe(base)
      const two = addDifficultyElites(base, 2, seed)
      expect(count(two) - count(base)).toBeGreaterThan(0)
      expect(count(two) - count(base)).toBeLessThanOrEqual(Math.min(6, fights))
      // The first layer is never an elite, and the same seed picks the same nodes.
      expect(two.nodes.filter((n) => n.layer === 1).every((n) => n.type !== 'elite' || base.nodes.find((b) => b.id === n.id)!.type === 'elite')).toBe(true)
      expect(addDifficultyElites(base, 2, seed)).toEqual(two)
      // Nothing else on the map moved.
      expect(two.edges).toEqual(base.edges)
      expect(two.nodes.map((n) => n.id)).toEqual(base.nodes.map((n) => n.id))
    }
  })

  it('names a damage type only when the wave leans on it', () => {
    const base = { kind: 'elite' as const, variant: 'x', asks: '', mod: null, heads: 10, champions: [] }
    expect(resistHint({ ...base, physShare: 0.8, magShare: 0, physMax: 0.45, magMax: 0 })).toMatch(/Steel bounces/)
    expect(resistHint({ ...base, physShare: 0, magShare: 0.8, physMax: 0, magMax: 0.49 })).toMatch(/Magic bounces/)
    expect(resistHint({ ...base, physShare: 0.1, magShare: 0.1, physMax: 0.15, magMax: 0.15 })).toBeNull()
  })
})
