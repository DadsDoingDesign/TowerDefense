import { describe, expect, it } from 'vitest'
import { FIRST_MAP } from '../src/game/data/maps'
import { generateEncounter } from '../src/game/data/waves'
import { GameEngine, TICK } from '../src/game/engine/engine'
import type { WaveDef } from '../src/game/types'
import { chipsThatFit, lineUp, lineUpWords, queueFor, spawnOrder } from '../src/ui/shell/enemyQueue'

/**
 * G2-2 — the wave strip's enemy queue. `spawnOrder` restates the engine's
 * spawn order so setup (no engine yet) and a live wave read one derivation;
 * these tests hold the restatement to the real engine.
 */

/** Every body the engine spawns, in the order it spawned them. */
function spawnedByEngine(wave: WaveDef): { order: string[]; spawnedAt: number[] } {
  const engine = new GameEngine({ map: FIRST_MAP, wave, placedSentinels: [], baseHp: 9999, maxBaseHp: 9999, seed: 5 })
  const seen = new Set<string>()
  const order: string[] = []
  const spawnedAt: number[] = []
  for (let i = 0; i < 60 * 600 && engine.status === 'running'; i++) {
    engine.step(TICK)
    for (const e of engine.enemies) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      order.push(e.type.id)
    }
    spawnedAt.push(engine.hudSnapshot().enemiesSpawned)
  }
  expect(engine.status).not.toBe('running')
  return { order, spawnedAt }
}

describe('enemy queue (G2-2)', () => {
  it('spawnOrder is the order the engine spawns in — groups out of order, gaps in their numbers, times unsorted', () => {
    // No splitters or summoners, so every new body on the field is a spawn.
    const wave: WaveDef = {
      index: 1,
      label: 't',
      isBoss: false,
      spawns: [
        { typeId: 'barrel1', at: 2.0, hpMult: 0.2, group: 5 },
        { typeId: 'torch1', at: 0.5, hpMult: 0.2, group: 2 },
        { typeId: 'torch3', at: 1.5, hpMult: 0.2, group: 5 },
        { typeId: 'torch2', at: 0.2, hpMult: 0.2, group: 2 },
        { typeId: 'barrel3', at: 0.1, hpMult: 0.2, group: 9 },
        { typeId: 'torch1', at: 0.5, hpMult: 0.2, group: 5 },
        { typeId: 'torch2', at: 1.0, hpMult: 0.2, group: 2 },
      ],
    }
    const { order } = spawnedByEngine(wave)
    expect(order).toEqual(spawnOrder(wave).map((s) => s.typeId))
    expect(spawnOrder(wave).map((s) => s.group)).toEqual([0, 0, 0, 1, 1, 1, 2])
  })

  it('agrees with the engine on a real generated sub-wave encounter', () => {
    for (const depth of [2, 5, 8]) {
      const wave = generateEncounter(depth, 'normal')
      // Keep to kinds that never split into new bodies mid-wave.
      const plain = { ...wave, spawns: wave.spawns.filter((s) => !/^barrel[45]/.test(s.typeId)) }
      const { order } = spawnedByEngine(plain)
      expect(new Set(plain.spawns.map((s) => s.group ?? 0)).size).toBeGreaterThan(1)
      expect(order.length).toBe(plain.spawns.length)
      expect(order).toEqual(spawnOrder(plain).map((s) => s.typeId.replace(/_.*$/, '')))
    }
  })

  it('live lists what has not spawned; held lists only the next sub-wave', () => {
    const wave: WaveDef = {
      index: 1,
      label: 't',
      isBoss: false,
      spawns: [
        { typeId: 'torch1', at: 0, hpMult: 1, group: 0 },
        { typeId: 'tnt1', at: 1, hpMult: 1, group: 0 },
        { typeId: 'barrel1', at: 0, hpMult: 1, group: 1 },
        { typeId: 'barrel1', at: 1, hpMult: 1, group: 1 },
        { typeId: 'torch5', at: 0, hpMult: 1, group: 2 },
      ],
    }
    expect(queueFor(wave, 'setup', { enemiesSpawned: 3, subWave: 1 })).toHaveLength(5)
    expect(queueFor(wave, 'live', { enemiesSpawned: 1, subWave: 0 }).map((s) => s.typeId)).toEqual([
      'tnt1',
      'barrel1',
      'barrel1',
      'torch5',
    ])
    // The engine increments `subWave` on entering the breather: 1 is the next group.
    expect(queueFor(wave, 'held', { enemiesSpawned: 2, subWave: 1 }).map((s) => s.typeId)).toEqual(['barrel1', 'barrel1'])
    expect(queueFor(null, 'live', { enemiesSpawned: 0, subWave: 0 })).toEqual([])
  })

  it('lineUp groups by kind in order of first arrival, counts, and flags champions', () => {
    const entries = lineUp([
      { typeId: 'tnt2', group: 0 },
      { typeId: 'torch2', group: 0 },
      { typeId: 'tnt2', group: 0 },
      { typeId: 'nope', group: 0 },
      { typeId: 'torch5', group: 1 },
    ])
    expect(entries.map((e) => [e.typeId, e.count, e.boss])).toEqual([
      ['tnt2', 2, false],
      ['torch2', 1, false],
      ['torch5', 1, true],
    ])
    expect(lineUpWords(entries)).toBe('Bomber ×2, Torch Goblin ×1, Warlord Grukk ×1')
    // An elite draws as its base goblin.
    expect(lineUp([{ typeId: 'barrel3_plated', group: 0 }])[0].art).toBe('barrel3')
  })

  it('chipsThatFit: at most three kinds, and room for "+N" when some are left out', () => {
    expect(chipsThatFit(400, 7)).toBe(3)
    expect(chipsThatFit(400, 2)).toBe(2)
    expect(chipsThatFit(104, 3)).toBe(3) // three, nothing left out
    expect(chipsThatFit(104, 4)).toBe(2) // two + "+2"
    expect(chipsThatFit(60, 4)).toBe(1)
    expect(chipsThatFit(40, 4)).toBe(0)
    expect(chipsThatFit(0, 0)).toBe(0)
  })
})
