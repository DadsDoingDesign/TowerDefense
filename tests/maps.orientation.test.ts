import { afterEach, describe, expect, it } from 'vitest'
import { idCounterState } from '../src/game/core/rng'
import {
  ALL_MAPS,
  chooseFieldOrientation,
  fieldIdOf,
  legacyPostTile,
  orientationOf,
  orientField,
  pathLength,
  pickBattleMap,
  PORTRAIT_MAPS,
} from '../src/game/data/maps'
import { createSentinel, nameCounterState } from '../src/game/data/sentinels'
import { generateEncounter } from '../src/game/data/waves'
import { GameEngine, TICK } from '../src/game/engine/engine'
import type { Archetype, GameMap } from '../src/game/types'
import { useGameStore } from '../src/state/gameStore'
import { STANDARD_RUN } from '../src/state/daily'
import { setLayoutOrientation } from '../src/state/game/runtime'
import { captureRun, migrateSnapshot, RUN_SNAPSHOT_VERSION } from '../src/state/runSnapshot'

/**
 * Portrait battlefields: every field has a tall twin a phone fights on. The
 * twin is the landscape field under an isometry, so everything the balance
 * suite reads — path length, what each slot sees, how far apart the slots are,
 * and the fight itself — must come out identical.
 */

/** Road seen from `pos` within `r`, sampled every 4px — the §14 coverage metric. */
function coverage(map: GameMap, pos: { x: number; y: number }, r: number): number {
  let seen = 0
  for (let i = 1; i < map.path.length; i++) {
    const a = map.path[i - 1]
    const b = map.path[i]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const n = Math.max(1, Math.round(len / 4))
    for (let k = 0; k < n; k++) {
      const p = { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }
      if (Math.hypot(p.x - pos.x, p.y - pos.y) <= r) seen += len / n
    }
  }
  return seen
}

describe('portrait twins', () => {
  it('one tall twin per field, never dealt by the seed', () => {
    expect(PORTRAIT_MAPS).toHaveLength(ALL_MAPS.length)
    for (let seed = 1; seed < 400; seed++) {
      const m = pickBattleMap(seed)
      expect(orientationOf(m)).toBe('landscape')
      expect(pickBattleMap(seed)).toBe(m)
    }
  })

  it.each(ALL_MAPS.map((m) => [m.id, m] as const))('%s: the twin is the same field turned on its side', (_id, land) => {
    const tall = orientField(land, 'portrait')
    expect(tall.orientation).toBe('portrait')
    expect(tall.height).toBeGreaterThan(tall.width)
    expect(fieldIdOf(tall)).toBe(land.id)
    expect(orientField(tall, 'landscape')).toBe(land)
    expect(orientField(tall, 'portrait')).toBe(tall)
    expect(pathLength(tall.path)).toBeCloseTo(pathLength(land.path), 6)
    expect(tall.slots.map((s) => s.id)).toEqual(land.slots.map((s) => s.id))
    for (const [i, s] of land.slots.entries()) {
      const t = tall.slots[i]
      // Inside the field, like the original.
      expect(t.pos.x).toBeGreaterThan(0)
      expect(t.pos.x).toBeLessThan(tall.width)
      expect(t.pos.y).toBeGreaterThan(0)
      expect(t.pos.y).toBeLessThan(tall.height)
      for (const r of [96, 150, 168, 200]) expect(coverage(tall, t.pos, r)).toBeCloseTo(coverage(land, s.pos, r), 6)
      for (const [j, o] of land.slots.entries()) {
        const d0 = Math.hypot(s.pos.x - o.pos.x, s.pos.y - o.pos.y)
        const d1 = Math.hypot(t.pos.x - tall.slots[j].pos.x, t.pos.y - tall.slots[j].pos.y)
        expect(d1).toBeCloseTo(d0, 9)
      }
    }
  })

  it('the engine plays the twin exactly as it plays the original', () => {
    const team: [Archetype, string][] = [
      ['fighter', 's3'],
      ['rogue', 's2'],
      ['mystic', 's4'],
    ]
    const fight = (map: GameMap, seed: number) => {
      const e = new GameEngine({
        map,
        wave: generateEncounter(5, 'normal', { seed }),
        // G1-2: the old circle ids, as each field's nearest open tiles.
        placedSentinels: team.map(([a, post]) => ({ sentinel: createSentinel(a), slotId: legacyPostTile(fieldIdOf(map), post)! })),
        baseHp: 20,
        maxBaseHp: 20,
        seed,
        breathers: 'auto',
      })
      for (let i = 0; i < 200_000 && e.status === 'running'; i++) e.step(TICK)
      const r = e.result()
      return { status: r.status, baseHp: e.baseHp, killed: r.enemiesKilled, elapsed: e.elapsed, dmg: r.perSentinel.map((p) => [p.kills, Math.round(p.damageDealt), p.downed]) }
    }
    for (const land of ALL_MAPS) {
      for (const seed of [3, 17]) expect(fight(orientField(land, 'portrait'), seed)).toEqual(fight(land, seed))
    }
  })
})

describe('chooseFieldOrientation', () => {
  it('portrait on every portrait phone, landscape on tablets, desks and landscape windows', () => {
    for (const [w, h] of [[390, 844], [375, 667], [320, 568], [430, 932], [360, 740]]) expect(chooseFieldOrientation(w, h)).toBe('portrait')
    for (const [w, h] of [[768, 1024], [1440, 900], [1024, 768], [844, 390], [690, 700], [0, 0]]) expect(chooseFieldOrientation(w, h)).toBe('landscape')
  })
})

describe('the orientation is chosen per battle and fixed for it', () => {
  afterEach(() => setLayoutOrientation(null))
  const enterBattle = () => {
    const st = useGameStore.getState()
    const node = st.runMap.nodes.find((n) => st.reachableNodeIds.includes(n.id) && n.type === 'battle')!
    st.selectNode(node.id)
    return node
  }
  const snap = () =>
    captureRun(useGameStore.getState(), { rngLoot: 1, rngMap: 2, lootPity: 0, idCounter: idCounterState(), nameCounters: nameCounterState() })

  it('deals the same field and the same wave either way up; only the twin differs', () => {
    useGameStore.getState().beginCampaign(4242, STANDARD_RUN)
    useGameStore.getState().pickStartingHero('fighter')
    const field = useGameStore.getState().battleMap
    const saved = JSON.parse(JSON.stringify(snap()))

    setLayoutOrientation(() => 'landscape')
    const node = enterBattle()
    const land = useGameStore.getState()
    expect(land.battleMap).toBe(orientField(field, 'landscape'))
    const waveLand = land.currentWave

    // Same run, same node, held the other way up.
    useGameStore.getState().resumeRun(migrateSnapshot(saved)!)
    setLayoutOrientation(() => 'portrait')
    useGameStore.getState().selectNode(node.id)
    const tall = useGameStore.getState()
    expect(tall.battleMap).toBe(orientField(field, 'portrait'))
    expect(fieldIdOf(tall.battleMap)).toBe(field.id)
    expect(tall.currentWave).toEqual(waveLand)
  })

  it('a resume keeps the saved twin whatever the viewport; the next node chooses again', () => {
    useGameStore.getState().beginCampaign(777, STANDARD_RUN)
    useGameStore.getState().pickStartingHero('rogue')
    setLayoutOrientation(() => 'portrait')
    enterBattle()
    const s = snap()
    expect(s.v).toBe(RUN_SNAPSHOT_VERSION)
    expect(s.fieldOrientation).toBe('portrait')
    expect(orientationOf(pickBattleMap(777))).toBe('landscape')
    expect(s.battleMapId).toBe(pickBattleMap(777).id)

    // The window is now a desk: the battle in hand stays on its portrait twin.
    setLayoutOrientation(() => 'landscape')
    useGameStore.getState().resumeRun(migrateSnapshot(JSON.parse(JSON.stringify(s)))!)
    expect(orientationOf(useGameStore.getState().battleMap)).toBe('portrait')
  })

  it('a v8 save (no orientation) resumes on the landscape field', () => {
    useGameStore.getState().beginCampaign(99, STANDARD_RUN)
    useGameStore.getState().pickStartingHero('mystic')
    const raw = JSON.parse(JSON.stringify(snap())) as Record<string, unknown>
    raw.v = 8
    delete raw.fieldOrientation
    const m = migrateSnapshot(raw)!
    expect(m.fieldOrientation).toBe('landscape')
    raw.fieldOrientation = 'sideways'
    raw.v = 9
    expect(migrateSnapshot(raw)!.fieldOrientation).toBe('landscape')
  })
})
