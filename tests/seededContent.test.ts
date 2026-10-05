/**
 * Seeded content is a function of the SEED, not of the session.
 *
 * A fight's map challenge, its cursed ground / seeded boulders and its combat
 * rolls are hashed from (run seed, node id). Node ids used to come from the
 * process-global entity counter (`nextId('node')`), so the same seed dealt
 * different challenges and ground depending on how many ids the page had
 * minted before the run began — a fresh load vs. a second run, a Banner
 * re-deal, the balance report's earlier sections. For a scored Daily that is
 * a fairness bug: two players on the same day fought different fields.
 *
 * Node ids are map-local now (`n<layer>-<row>`), so the same seed deals the
 * same ids, and everything hashed off them, however many ids were minted first.
 */
import { describe, expect, it } from 'vitest'
import { idCounterState, nextId, streamRng } from '../src/game/core/rng'
import { nameCounterState } from '../src/game/data/sentinels'
import { generateRunMap } from '../src/game/data/runmap'
import { combatSeed } from '../src/game/run/battle'
import { nodeHazardSeed, nodeTerrainRule } from '../src/game/run/terrain'
import { STANDARD_RUN } from '../src/state/seeds'
import { useGameStore } from '../src/state/gameStore'
import { captureRun, migrateSnapshot } from '../src/state/runSnapshot'

/** Everything a run's map deals per fight, keyed by the node's place on the map. */
function dealt(seed: number) {
  const st = useGameStore.getState()
  return st.runMap.nodes.map((n) => ({
    at: `${n.layer}/${n.row}`,
    id: n.id,
    type: n.type,
    rule: nodeTerrainRule(n, seed, { firstRun: st.firstRun }),
    hazard: nodeHazardSeed(n, seed, { firstRun: st.firstRun }),
    combat: combatSeed(seed, n.id, 0),
  }))
}

const burn = (n: number) => {
  for (let i = 0; i < n; i++) nextId('burn')
}

describe('seeded content does not depend on the global id counter', () => {
  it('the same map stream deals the same node ids however many ids were minted before', () => {
    for (const seed of [1, 7, 4242]) {
      const a = generateRunMap(streamRng(seed, 'map'))
      burn(137)
      const b = generateRunMap(streamRng(seed, 'map'))
      expect(b.nodes.map((n) => n.id)).toEqual(a.nodes.map((n) => n.id))
      expect(b.edges).toEqual(a.edges)
    }
  })

  it('node ids are unique on a map and name its place on it', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const map = generateRunMap(streamRng(seed, 'map'), { wideMap: seed % 2 === 0, standingOrders: seed % 3 === 0 })
      const ids = map.nodes.map((n) => n.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const n of map.nodes) expect(n.id).toBe(`n${n.layer}-${n.row}`)
    }
  })

  it('a seeded campaign deals the same challenges, cursed ground and combat seeds on a cold start and mid-session', () => {
    const seed = 90210
    useGameStore.getState().beginCampaign(seed, { kind: 'seeded' })
    const cold = dealt(seed)
    expect(cold.some((n) => n.rule)).toBe(true)
    expect(cold.some((n) => n.hazard != null)).toBe(true)

    // A whole other run in between, plus stray ids (an attract battle, a
    // Banner re-deal, a reward roll...).
    useGameStore.getState().beginCampaign(12345, STANDARD_RUN)
    useGameStore.getState().pickStartingHero('rogue')
    burn(59)

    useGameStore.getState().beginCampaign(seed, { kind: 'seeded' })
    expect(dealt(seed)).toEqual(cold)
  })

  it('a contract deals the same field from the same board seed, every time', () => {
    useGameStore.getState().beginCampaign(4040, { kind: 'standard' }, { company: 'art', crates: 0, purse: 0 })
    const seed = useGameStore.getState().runSeed
    const first = dealt(seed)
    burn(311)
    useGameStore.getState().beginCampaign(4040, { kind: 'standard' }, { company: 'art', crates: 0, purse: 0 })
    expect(useGameStore.getState().runSeed).toBe(seed)
    expect(dealt(seed)).toEqual(first)
  })
})

describe('saves dealt before the fix', () => {
  it('keep their counter-minted node ids, and so the ground they were dealt', () => {
    const seed = 777
    useGameStore.getState().beginCampaign(seed, { kind: 'seeded' })
    useGameStore.getState().pickStartingHero('fighter')
    const snap = captureRun(useGameStore.getState(), { rngLoot: 1, rngMap: 2, lootPity: 0, idCounter: idCounterState(), nameCounters: nameCounterState() })
    // Rewrite every node id the way the old counter minted them.
    const old = (id: string) => `node${(parseInt(id.replace(/\D/g, ''), 10) + 40).toString(36)}`
    const raw = JSON.parse(JSON.stringify(snap).replace(/"n(\d+)-(\d+)"/g, (_m, l, r) => `"${old(`${l}${r.padStart(2, '0')}`)}"`))
    const back = migrateSnapshot(raw)!
    expect(back).not.toBeNull()
    useGameStore.getState().resumeRun(back)
    const st = useGameStore.getState()
    expect(st.runMap.nodes.every((n) => /^node[0-9a-z]+$/.test(n.id))).toBe(true)
    expect(st.runMap.nodes.map((n) => n.id)).toEqual(raw.runMap.nodes.map((n: { id: string }) => n.id))
    expect(st.reachableNodeIds.length).toBeGreaterThan(0)
    for (const id of st.reachableNodeIds) expect(st.runMap.nodes.some((n) => n.id === id)).toBe(true)
    // Each place keeps the id it was saved under, so its hashes do not move.
    for (const n of st.runMap.nodes) expect(n.id).toBe(old(`${n.layer}${String(n.row).padStart(2, '0')}`))
  })
})
