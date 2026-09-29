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
 * map, and every Vow tier that changes what a node fields (tier 2 turns every
 * battle node into an elite encounter).
 */
function fightNodes(state: ReturnType<typeof useGameStore.getState>) {
  return state.runMap.nodes.filter((n) => n.type === 'battle' || n.type === 'elite' || n.type === 'boss')
}

describe('encounter preview == spawned encounter', () => {
  const SEEDS = [1, 7, 42, 1337, 90210, 424242, 777777, 20260929, 3141592, 99999999]
  const TIERS = [0, 2, 5]

  for (const tier of TIERS) {
    it(`matches selectNode for every fight node across ${SEEDS.length} seeds (Vow ${tier})`, () => {
      let checked = 0
      for (const seed of SEEDS) {
        const runMap = generateRunMap(streamRng(seed, 'map'))
        useGameStore.setState({
          runSeed: seed,
          runBanner: tier,
          runMap,
          mode: 'campaign',
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
    const run = { runSeed: 5, runBanner: 0, runMap }
    for (const n of runMap.nodes) {
      if (n.type === 'merchant' || n.type === 'shrine' || n.type === 'recruit' || n.type === 'start') {
        expect(previewEncounter(run, n.id)).toBeNull()
        expect(encounterKindFor(n, 0)).toBeNull()
      }
    }
  })

  it('an all-elite Vow turns battle nodes into elite encounters, and only battle nodes', () => {
    expect(encounterKindFor({ type: 'battle' }, 0)).toBe('normal')
    expect(encounterKindFor({ type: 'battle' }, 2)).toBe('elite')
    expect(encounterKindFor({ type: 'boss' }, 5)).toBe('boss')
  })

  it('names a damage type only when the wave leans on it', () => {
    const base = { kind: 'elite' as const, variant: 'x', asks: '', mod: null, heads: 10, champions: [] }
    expect(resistHint({ ...base, physShare: 0.8, magShare: 0, physMax: 0.45, magMax: 0 })).toMatch(/Steel bounces/)
    expect(resistHint({ ...base, physShare: 0, magShare: 0.8, physMax: 0, magMax: 0.49 })).toMatch(/Magic bounces/)
    expect(resistHint({ ...base, physShare: 0.1, magShare: 0.1, physMax: 0.15, magMax: 0.15 })).toBeNull()
  })
})
