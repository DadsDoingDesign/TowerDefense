import { describe, expect, it } from 'vitest'
import { FIRST_MAP, legacyPosts } from '../src/game/data/maps'

/** G1-2: the old build circles, as the tiles nearest where they stood. */
const P = legacyPosts(FIRST_MAP.id)
import { classicHero } from '../src/game/data/sentinels'
import { generateEncounter } from '../src/game/data/waves'
import { GameEngine, MAX_STEPS_PER_FRAME, TICK } from '../src/game/engine/engine'
import type { Archetype } from '../src/game/types'

/**
 * WS1's promise (docs/AUDIT_2026-08-20.md): the same seed and the same
 * choices produce the same battle, whatever the game speed or frame rate.
 * The balance harness depends on it, and so does resuming a run.
 */

const TEAM: [Archetype, string][] = [
  ['fighter', P.s0],
  ['rogue', P.s1],
  ['mystic', P.s2],
]

function fight(seed: number, ticksPerFrame: number) {
  const engine = new GameEngine({
    map: FIRST_MAP,
    wave: generateEncounter(4, 'normal', { seed }),
    placedSentinels: TEAM.map(([a, slotId]) => ({ sentinel: classicHero(a), slotId })),
    baseHp: 20,
    maxBaseHp: 20,
    seed,
  })
  // What BattleCanvas does at 1×/2×/3×: more whole ticks per frame, never a
  // bigger tick.
  for (let frame = 0; frame < 20_000 && engine.status === 'running'; frame++) {
    for (let t = 0; t < ticksPerFrame && engine.status === 'running'; t++) engine.step(TICK)
  }
  const r = engine.result()
  // Sentinel ids come from a global counter, so they differ between two
  // teams by construction. Compare everything else.
  return {
    elapsed: engine.elapsed,
    baseHp: engine.baseHp,
    ...r,
    perSentinel: r.perSentinel.map(({ id: _id, ...rest }) => rest),
  }
}

describe('GameEngine determinism', () => {
  it('finishes a real battle', () => {
    const r = fight(7, 1)
    expect(r.status).not.toBe('running')
    expect(r.enemiesKilled).toBeGreaterThan(0)
  })

  it('replays identically from the same seed', () => {
    expect(fight(7, 1)).toEqual(fight(7, 1))
  })

  it('is identical at 1×, 2× and 3× speed', () => {
    const at1 = fight(11, 1)
    expect(fight(11, 2)).toEqual(at1)
    expect(fight(11, MAX_STEPS_PER_FRAME / 2)).toEqual(at1)
  })
})
