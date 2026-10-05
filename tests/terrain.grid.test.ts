import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { idCounterState, streamRng } from '../src/game/core/rng'
import {
  ALL_MAPS,
  fieldFor,
  fieldIdOf,
  legacyPosts,
  orientField,
  PORTRAIT_PAD,
  withTerrainRule,
} from '../src/game/data/maps'
import { generateRunMap } from '../src/game/data/runmap'
import { classicHero, nameCounterState } from '../src/game/data/sentinels'
import {
  crowds,
  distToPolyline,
  withinClearance,
  fineFromCoarse,
  GRID_COLS,
  GRID_ROWS,
  LANE_CLEAR,
  LANE_HALF,
  PLAYABLE,
  roomyTiles,
  parseTileId,
  TERRAIN_RULE_IDS,
  TILE,
  tileId,
} from '../src/game/data/terrain'
import { carryPlacements, emptyPlacements, meleeOf } from '../src/game/run/map'
import { CHALLENGE_SHARE, endlessTerrainRule, nodeHazardSeed, nodeTerrainRule } from '../src/game/run/terrain'
import type { GameMap, TerrainRuleId } from '../src/game/types'
import { STANDARD_RUN } from '../src/state/daily'
import { useGameStore } from '../src/state/gameStore'
import { useMetaStore } from '../src/state/metaStore'
import { setLayoutOrientation } from '../src/state/game/runtime'
import { captureRun, migrateSnapshot, snapshotBattleMap } from '../src/state/runSnapshot'

// LS3: this file is about a returning player's road. A first run fights its
// first depths on plain ground (see tests/staging.test.ts and firstRun.test.ts).
beforeAll(() => useMetaStore.setState({ stats: { ...useMetaStore.getState().stats, runsCompleted: 1 } }))

/**
 * G1-2 — free-form deployment on a tile grid, with terrain that blocks.
 *
 * The grid is pure geometry (`data/terrain.ts`, `data/maps.ts`), the map
 * challenges are a pure draw (`run/terrain.ts`), and the store routes taps
 * through one action (`battleSlice.tapTile`). Each is pinned here.
 */

const RULES: (TerrainRuleId | null)[] = [null, ...TERRAIN_RULE_IDS]

/** Three open tiles of `map`, a clearance apart, in grid order. */
function roomy3(map: GameMap): [string, string, string] {
  const out: string[] = []
  for (const s of map.slots) if (!out.some((o) => withinClearance(o, s.id))) out.push(s.id)
  return [out[0], out[1], out[2]]
}

/** Road seen from `pos` within `r`, sampled every 8px (the §14 coverage proxy). */
function coverage(map: GameMap, pos: { x: number; y: number }, r = 150): number {
  let seen = 0
  for (let i = 1; i < map.path.length; i++) {
    const a = map.path[i - 1]
    const b = map.path[i]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const n = Math.max(1, Math.round(len / 8))
    for (let k = 0; k < n; k++) {
      const p = { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n }
      if (Math.hypot(p.x - pos.x, p.y - pos.y) <= r) seen += len / n
    }
  }
  return seen
}

describe('the deployment grid', () => {
  it.each(ALL_MAPS.flatMap((m) => RULES.map((r) => [m.id, r] as const)))('%s / %s: tiles, lane and open slots agree', (id, rule) => {
    const map = fieldFor(id, rule, 'landscape')!
    const tiles = map.tiles!
    expect(tiles).toHaveLength(GRID_COLS * GRID_ROWS)
    expect(new Set(tiles.map((t) => t.id)).size).toBe(tiles.length)
    // The grid fills the field edge to edge.
    expect(GRID_COLS * TILE).toBe(map.width)
    expect(GRID_ROWS * TILE).toBe(map.height)
    for (const t of tiles) {
      expect(parseTileId(t.id)).toEqual({ c: t.col, r: t.row })
      const d = distToPolyline(t.pos, map.path)
      if (d < LANE_CLEAR) expect(t.block).toBe('lane')
      else expect(t.block).not.toBe('lane')
      // Forest is the frame round the playable middle, and only that.
      const inside = t.pos.x > PLAYABLE.x0 && t.pos.x < PLAYABLE.x1 && t.pos.y > PLAYABLE.y0 && t.pos.y < PLAYABLE.y1
      if (inside) expect(t.block).not.toBe('forest')
      else if (t.block !== 'lane') expect(t.block).toBe('forest')
    }
    // `slots` is exactly the open tiles, in grid order.
    expect(map.slots.map((s) => s.id)).toEqual(tiles.filter((t) => !t.block).map((t) => t.id))
    // Grid-fit: every lane corner sits on a tile CENTRE, so the road runs
    // through whole tiles, one tile wide. A hero beside it stands a whole tile
    // (40px) off the lane's centre line — where a G1-2 roadside hero stood,
    // the distance the engine's holds, sapper triggers and lobs are tuned
    // against — and no open tile has any road in it.
    for (const p of map.path.slice(1, -1)) {
      expect(p.x % TILE).toBe(TILE / 2)
      expect(p.y % TILE).toBe(TILE / 2)
    }
    const gaps = map.slots.map((s) => distToPolyline(s.pos, map.path))
    expect(Math.min(...gaps)).toBe(TILE)
    expect(gaps.filter((d) => d === TILE).length).toBeGreaterThanOrEqual(40)
    // The drawn road (its dirt and grassy edge, LANE_HALF either side of the
    // centre line) lies wholly in lane tiles: sample it every 4px, both edges.
    const tileAt = (x: number, y: number) => tiles.find((t) => Math.abs(x - t.pos.x) < TILE / 2 && Math.abs(y - t.pos.y) < TILE / 2)
    for (let i = 1; i < map.path.length; i++) {
      const a = map.path[i - 1]
      const b = map.path[i]
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      const nx = -(b.y - a.y) / len
      const ny = (b.x - a.x) / len
      for (let k = 0; k <= len; k += 4) {
        for (const o of [-(LANE_HALF - 0.5), 0, LANE_HALF - 0.5]) {
          const x = a.x + ((b.x - a.x) * k) / len + nx * o
          const y = a.y + ((b.y - a.y) * k) / len + ny * o
          const t = tileAt(x, y)
          if (t) expect(t.block).toBe('lane')
        }
      }
    }
  })

  it.each(ALL_MAPS.map((m) => [m.id] as const))('%s: every G1-2 post is still a tile, at the same place relative to the road', (id) => {
    // The fine tile at (2c, 2r) sees exactly the road the 80px tile (c, r) saw
    // before grid-fit: the fields moved by half a fine tile with the road.
    const land = fieldFor(id, null, 'landscape')!
    const even = land.slots.filter((s) => {
      const p = parseTileId(s.id)!
      return p.c % 2 === 0 && p.r % 2 === 0
    })
    // G1-2 posts sat 40px off a road that ran along their edges; so do these.
    expect(even.filter((s) => distToPolyline(s.pos, land.path) === TILE).length).toBeGreaterThanOrEqual(15)
    expect(even.length).toBeGreaterThanOrEqual(30)
    expect(fineFromCoarse('c7r2')).toBe('c14r4')
    expect(fineFromCoarse('c11r6')).toBe('c22r12')
    expect(fineFromCoarse('c12r0')).toBeNull()
    expect(fineFromCoarse('s3')).toBeNull()
  })

  it('a Fighter keeps a clearance: neighbours crowd it, diagonals included; two tiles apart do not', () => {
    expect(crowds('c5r5', true, 'c6r5', false)).toBe(true)
    expect(crowds('c5r5', false, 'c6r6', true)).toBe(true)
    expect(crowds('c5r5', true, 'c4r4', true)).toBe(true)
    expect(crowds('c5r5', true, 'c7r5', false)).toBe(false)
    expect(crowds('c5r5', true, 'c7r7', true)).toBe(false)
    expect(crowds('c5r5', true, 'c5r5', true)).toBe(false)
    expect(crowds('c5r5', true, 's3', true)).toBe(false)
    // Two ranged heroes may stand side by side.
    expect(crowds('c5r5', false, 'c6r5', false)).toBe(false)
    const land = ALL_MAPS[0]
    const fighter = { tile: land.slots[40].id, melee: true }
    const roomy = roomyTiles(land.slots, [fighter], false)
    expect(roomy.some((s) => s.id === fighter.tile)).toBe(false)
    for (const s of roomy) expect(withinClearance(s.id, fighter.tile)).toBe(false)
  })

  it.each(ALL_MAPS.map((m) => [m.id] as const))('%s: each challenge adds its terrain and still leaves a real choice', (id) => {
    const plain = fieldFor(id, null, 'landscape')!
    for (const rule of TERRAIN_RULE_IDS) {
      const m = fieldFor(id, rule, 'landscape')!
      const kind = rule === 'flooded' ? 'water' : 'fire'
      const added = m.tiles!.filter((t) => t.block === kind)
      expect(added.length).toBeGreaterThanOrEqual(4)
      // Only grass was taken: no lane or forest tile changed.
      for (const t of m.tiles!) {
        const p = plain.tiles!.find((x) => x.id === t.id)!
        if (p.block) expect(t.block).toBe(p.block)
      }
      expect(m.slots.length).toBe(plain.slots.length - added.length)
      // Enough ground left that reaches the lane for a full company, twice over.
      expect(m.slots.filter((s) => coverage(m, s.pos) > 150).length).toBeGreaterThanOrEqual(10)
      // It takes some of the field's best ground — a challenge, not wallpaper.
      const best = [...plain.slots].sort((a, b) => coverage(plain, b.pos) - coverage(plain, a.pos)).slice(0, 8)
      expect(best.some((s) => !m.slots.some((o) => o.id === s.id))).toBe(true)
    }
  })

  it('the portrait twin carries the grid transposed, ids and blocks unchanged', () => {
    for (const land of ALL_MAPS) {
      for (const rule of RULES) {
        const flat = fieldFor(land.id, rule, 'landscape')!
        const tall = fieldFor(land.id, rule, 'portrait')!
        expect(tall.orientation).toBe('portrait')
        expect(tall.terrainRule).toBe(flat.terrainRule)
        expect(fieldIdOf(tall)).toBe(land.id)
        expect(tall.slots.map((s) => s.id)).toEqual(flat.slots.map((s) => s.id))
        for (const t of flat.tiles!) {
          const u = tall.tiles!.find((x) => x.id === t.id)!
          expect(u.block).toBe(t.block)
          expect(u.col).toBe(t.row)
          expect(u.row).toBe(t.col)
          expect(u.pos).toEqual({ x: t.pos.y + PORTRAIT_PAD, y: t.pos.x })
        }
      }
    }
  })

  it('a field is one object per (field, rule, orientation); orienting keeps the rule', () => {
    for (const land of ALL_MAPS) {
      for (const rule of TERRAIN_RULE_IDS) {
        const a = fieldFor(land.id, rule, 'portrait')!
        expect(fieldFor(land.id, rule, 'portrait')).toBe(a)
        expect(orientField(a, 'landscape')).toBe(fieldFor(land.id, rule, 'landscape'))
        expect(orientField(orientField(a, 'landscape'), 'portrait')).toBe(a)
        expect(withTerrainRule(a, null)).toBe(orientField(land, 'portrait'))
        expect(withTerrainRule(land, rule)).toBe(fieldFor(land.id, rule, 'landscape'))
      }
    }
    expect(fieldFor('nowhere', null, 'landscape')).toBeNull()
  })

  it('the six old circles land on six different open tiles on each field', () => {
    for (const land of ALL_MAPS) {
      const posts = legacyPosts(land.id)
      expect(Object.keys(posts).sort()).toEqual(['s0', 's1', 's2', 's3', 's4', 's5'])
      const tiles = Object.values(posts)
      expect(new Set(tiles).size).toBe(6)
      for (const t of tiles) expect(land.slots.some((s) => s.id === t)).toBe(true)
    }
  })

  it('carryPlacements never benches a hero for standing too close — a conflict shows instead (weapon clearance)', () => {
    const land = ALL_MAPS[0]
    const a = land.slots[40]
    const next = land.slots.find((s) => withinClearance(s.id, a.id))!
    const far = land.slots.find((s) => !withinClearance(s.id, a.id) && s.id !== a.id)!
    const kept = carryPlacements({ [a.id]: 'a', [next.id]: 'b', [far.id]: 'c' }, land, () => true, Infinity)
    expect(kept[a.id]).toBe('a')
    expect(kept[next.id]).toBe('b')
    expect(kept[far.id]).toBe('c')
    expect(meleeOf([])('a')).toBe(false)
  })

  it('carryPlacements keeps open tiles only, each hero once, up to the cap', () => {
    const land = ALL_MAPS[0]
    const flooded = fieldFor(land.id, 'flooded', 'landscape')!
    const water = flooded.tiles!.find((t) => t.block === 'water')!.id
    const open = flooded.slots.map((s) => s.id)
    const [o0, o1, o2] = roomy3(flooded)
    const next = carryPlacements({ [water]: 'a', [o0]: 'b', [o1]: 'b', [o2]: 'c', constructor: 'd', nope: 'e' }, flooded, (id) => id !== 'c', Infinity)
    expect(Object.entries(next).filter(([, v]) => v)).toEqual([[o0, 'b']])
    expect(Object.keys(next).sort()).toEqual([...open].sort())
    const capped = carryPlacements({ [o0]: 'a', [o1]: 'b', [o2]: 'c' }, flooded, () => true, 2)
    expect(Object.values(capped).filter(Boolean)).toHaveLength(2)
  })
})

describe('which battles carry a map challenge', () => {
  it('never the first fight, a boss or a stop; deterministic; about two in three otherwise', () => {
    let eligible = 0
    let ruled = 0
    const seen = new Set<string>()
    for (let seed = 1; seed <= 60; seed++) {
      const map = generateRunMap(streamRng(seed, 'map'))
      for (const n of map.nodes) {
        const r = nodeTerrainRule(n, seed)
        expect(nodeTerrainRule(n, seed)).toBe(r)
        if (n.type !== 'battle' && n.type !== 'elite') expect(r).toBeNull()
        else if (n.layer <= 1) expect(r).toBeNull()
        else {
          eligible++
          if (r) {
            ruled++
            seen.add(r)
          }
        }
      }
    }
    expect(eligible).toBeGreaterThan(200)
    expect(Math.abs(ruled / eligible - CHALLENGE_SHARE)).toBeLessThan(0.08)
    expect([...seen].sort()).toEqual([...TERRAIN_RULE_IDS].sort())
  })

  it('endless: plain for the first rounds and every boss round', () => {
    for (const r of [1, 2, 10, 20, 30]) expect(endlessTerrainRule(r, 5)).toBeNull()
    const some = Array.from({ length: 40 }, (_, i) => endlessTerrainRule(i + 3, 5)).filter(Boolean)
    expect(some.length).toBeGreaterThan(10)
  })
})

describe('the store: tiles, the blocked-tap note, and challenge battles', () => {
  afterEach(() => setLayoutOrientation(null))

  const start = (seed: number) => {
    setLayoutOrientation(() => 'landscape')
    useGameStore.getState().beginCampaign(seed, STANDARD_RUN)
    useGameStore.getState().pickStartingHero('fighter')
  }
  const enter = (nodeId: string) => {
    useGameStore.setState({ screen: 'map', event: null, reachableNodeIds: [nodeId], clearedNodeIds: [], currentWave: null })
    useGameStore.getState().selectNode(nodeId)
  }

  it('a tap on a blocked tile says why and posts nobody; a tap on open grass posts', () => {
    start(4242)
    const st0 = useGameStore.getState()
    const first = st0.runMap.nodes.find((n) => st0.reachableNodeIds.includes(n.id) && n.type === 'battle')!
    enter(first.id)
    const st = useGameStore.getState()
    const hero = st.roster[0]
    const forest = st.battleMap.tiles!.find((t) => t.block === 'forest')!
    const rock = st.battleMap.tiles!.find((t) => t.block === 'rock')!
    useGameStore.getState().shellSelect({ kind: 'hero', id: hero.id })
    useGameStore.getState().tapTile(rock.id)
    expect(useGameStore.getState().fieldNote).toMatchObject({ tileId: rock.id, kind: 'rock' })
    expect(Object.values(useGameStore.getState().placements).filter(Boolean)).toHaveLength(0)
    // A tap on the road is a tap on a lane tile (grid-fit): it names that tile.
    const lane = st.battleMap.tiles!.find((t) => t.block === 'lane')!
    useGameStore.getState().tapTile(lane.id)
    expect(useGameStore.getState().fieldNote).toMatchObject({ tileId: lane.id, kind: 'lane' })
    // …and on the road where it runs on past the grid, the plain road note.
    useGameStore.getState().noteRoad()
    expect(useGameStore.getState().fieldNote).toMatchObject({ tileId: null, kind: 'lane' })
    // The store refuses a blocked id from any path, not only the router.
    useGameStore.getState().placeOnSlot(forest.id)
    expect(Object.values(useGameStore.getState().placements).filter(Boolean)).toHaveLength(0)
    const open = st.battleMap.slots[3].id
    useGameStore.getState().tapTile(open)
    expect(useGameStore.getState().placements[open]).toBe(hero.id)
    expect(useGameStore.getState().fieldNote).toBeNull()
  })

  it('a swinger keeps a clearance — a tap beside a posted swordsman says so and posts nobody', () => {
    start(4242)
    const st0 = useGameStore.getState()
    const first = st0.runMap.nodes.find((n) => st0.reachableNodeIds.includes(n.id) && n.type === 'battle')!
    enter(first.id)
    const sword = { id: 'sw', name: 'Plain Sword', slot: 'oneHand' as const, rarity: 'common' as const, base: {}, enchantments: [] }
    const fighter = classicHero('fighter')
    useGameStore.setState({ roster: [{ ...fighter, equipment: { ...fighter.equipment, mainHand: sword } }, classicHero('rogue')], placements: emptyPlacements(useGameStore.getState().battleMap) })
    const st = useGameStore.getState()
    const [a, b] = st.roster
    const safe = st.battleMap.slots.filter((s) => !st.battleMap.tiles!.find((t) => t.id === s.id)!.danger)
    const at = safe[20]
    useGameStore.getState().shellSelect({ kind: 'hero', id: a.id })
    useGameStore.getState().tapTile(at.id)
    expect(useGameStore.getState().placements[at.id]).toBe(a.id)
    // Beside it (diagonals too): refused, with the reason on the coach strip.
    const beside = safe.find((s) => withinClearance(s.id, at.id))!
    useGameStore.getState().shellSelect({ kind: 'hero', id: b.id })
    useGameStore.getState().tapTile(beside.id)
    expect(useGameStore.getState().placements[beside.id]).toBeFalsy()
    expect(useGameStore.getState().fieldNote).toMatchObject({ tileId: beside.id, kind: 'crowded' })
    // A tile of room away: posted.
    const clear = safe.find((s) => s.id !== at.id && !withinClearance(s.id, at.id))!
    useGameStore.getState().tapTile(clear.id)
    expect(useGameStore.getState().placements[clear.id]).toBe(b.id)
    // The first hero may move beside where it stood itself (it leaves that tile).
    useGameStore.getState().shellSelect({ kind: 'hero', id: a.id })
    const step = safe.find((s) => withinClearance(s.id, at.id) && !withinClearance(s.id, clear.id))!
    useGameStore.getState().tapTile(step.id)
    expect(useGameStore.getState().placements[step.id]).toBe(a.id)
  })

  it('a challenge node is fought on its terrain, benches a hero standing in it, and survives a save', () => {
    // Find a seed whose run map has a Flooded meadow node.
    let seed = 1
    let node: { id: string; type: string; layer: number } | undefined
    for (; seed < 200 && !node; seed++) {
      start(seed)
      node = useGameStore.getState().runMap.nodes.find((n) => nodeTerrainRule(n, seed) === 'flooded')
      if (node) break
    }
    expect(node).toBeDefined()
    const st = useGameStore.getState()
    const hero = st.roster[0]
    // Q1: fought on the flood AND the node's own danger ground / seeded rocks.
    const flooded = fieldFor(fieldIdOf(st.battleMap), 'flooded', 'landscape', nodeHazardSeed(node!, seed))!
    const water = flooded.tiles!.find((t) => t.block === 'water')!.id
    // The company stood on that tile at the last battle.
    useGameStore.setState({ placements: { ...st.placements, [water]: hero.id } })
    enter(node!.id)
    const after = useGameStore.getState()
    expect(after.battleMap).toBe(flooded)
    expect(after.battleMap.terrainRule).toBe('flooded')
    expect(Object.values(after.placements)).not.toContain(hero.id)
    expect(Object.keys(after.placements)).not.toContain(water)

    // Save and resume: same terrain, same twin.
    const open = after.battleMap.slots.find((s) => !after.battleMap.tiles!.find((t) => t.id === s.id)!.danger)!.id
    useGameStore.getState().shellSelect({ kind: 'hero', id: hero.id })
    useGameStore.getState().tapTile(open)
    const snap = captureRun(useGameStore.getState(), { rngLoot: 1, rngMap: 2, lootPity: 0, idCounter: idCounterState(), nameCounters: nameCounterState() })
    expect(snap.terrainRule).toBe('flooded')
    expect(snap.hazardSeed).toBe(nodeHazardSeed(node!, seed))
    const back = migrateSnapshot(JSON.parse(JSON.stringify(snap)))!
    expect(back.terrainRule).toBe('flooded')
    expect(snapshotBattleMap(back)).toBe(flooded)
    useGameStore.getState().resumeRun(back)
    expect(useGameStore.getState().battleMap).toBe(flooded)
    expect(useGameStore.getState().placements[open]).toBe(hero.id)
  })

  it('a v9 save moves its circle placements onto tiles, and drops what is not a tile', () => {
    start(99)
    const st = useGameStore.getState()
    const hero = st.roster[0]
    const snap = captureRun(st, { rngLoot: 1, rngMap: 2, lootPity: 0, idCounter: idCounterState(), nameCounters: nameCounterState() })
    const raw = JSON.parse(JSON.stringify(snap)) as Record<string, unknown>
    raw.v = 9
    delete raw.terrainRule
    raw.placements = { s3: hero.id, s4: hero.id, s9: 'x', c99r0: 'y', [tileId(1, 1)]: 5 }
    const m = migrateSnapshot(raw)!
    expect(m.terrainRule).toBeNull()
    expect(m.placements).toEqual({ [legacyPosts(snap.battleMapId).s3]: hero.id })
    // A v10 payload has no circles to translate, and an unknown rule is plain ground.
    raw.v = 10
    raw.terrainRule = 'lava'
    raw.placements = { s3: hero.id }
    const n = migrateSnapshot(raw)!
    expect(n.placements).toEqual({})
    expect(n.terrainRule).toBeNull()
    // Grid-fit: a v10–v11 payload's ids name the 80px grid; each is doubled
    // onto the fine tile at the same place relative to the road.
    raw.v = 11
    raw.placements = { c7r2: hero.id, c3r5: 'h2', c12r0: 'h3' }
    const o = migrateSnapshot(raw)!
    expect(o.placements).toEqual({ c14r4: hero.id, c6r10: 'h2' })
    // A v12 payload's ids are fine ids already.
    raw.v = 12
    const q = migrateSnapshot(raw)!
    expect(q.placements).toEqual({ c7r2: hero.id, c3r5: 'h2', c12r0: 'h3' })
  })
})
