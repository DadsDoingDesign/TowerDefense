import { afterEach, describe, expect, it } from 'vitest'
import { idCounterState } from '../src/game/core/rng'
import {
  COVERAGE_RANGE,
  CURSED_DAMAGE_MULT,
  DANGER_COPY,
  DANGER_POOL,
  DANGER_TILES,
  OBSTACLE_POOL,
  OBSTACLES,
  dangerAt,
  layHazards,
  roadCoverage,
  tileDamageMult,
} from '../src/game/data/hazards'
import { ALL_MAPS, fieldFor, fieldIdOf, FIRST_MAP, legacyPosts, orientField, withTerrainRule } from '../src/game/data/maps'
import { nameCounterState, createSentinel } from '../src/game/data/sentinels'
import { layTiles, TERRAIN_RULE_IDS } from '../src/game/data/terrain'
import { GameEngine, TICK } from '../src/game/engine/engine'
import { endlessHazardSeed, nodeHazardSeed } from '../src/game/run/terrain'
import type { FieldTile, GameMap, SpawnEvent, TerrainRuleId } from '../src/game/types'
import { STANDARD_RUN } from '../src/state/daily'
import { useGameStore } from '../src/state/gameStore'
import { setLayoutOrientation, streams } from '../src/state/game/runtime'
import { captureRun, migrateSnapshot, snapshotBattleMap } from '../src/state/runSnapshot'
import { slotCoverage } from '../balance/harness'

/**
 * Q1 — danger ground and seeded obstacles.
 *
 * Every battle lays, from one seed hashed off (run seed, node), ONE cursed tile
 * drawn from the best few open tiles by road coverage and a few boulders on the
 * next-best ground. A hero on cursed ground deals `CURSED_DAMAGE_MULT` damage.
 */

const RULES: (TerrainRuleId | null)[] = [null, ...TERRAIN_RULE_IDS]
const SEEDS = Array.from({ length: 60 }, (_, i) => (i * 2654435761) >>> 0 || 1)

/** The open tiles of `map`, best road coverage first (ties by id). */
function ranked(map: GameMap): FieldTile[] {
  const open = map.tiles!.filter((t) => !t.block)
  return [...open].sort((a, b) => roadCoverage(map.path, b.pos) - roadCoverage(map.path, a.pos) || a.id.localeCompare(b.id))
}

describe('the layout', () => {
  it('measures coverage exactly as the balance harness does', () => {
    const h = slotCoverage(FIRST_MAP, COVERAGE_RANGE)
    for (const s of FIRST_MAP.slots) expect(roadCoverage(FIRST_MAP.path, s.pos)).toBe(h[s.id])
  })

  it.each(ALL_MAPS.flatMap((m) => RULES.map((r) => [m.id, r] as const)))(
    '%s / %s: one cursed tile among the best, boulders among the next best, nothing else touched',
    (id, rule) => {
      const plain = fieldFor(id, rule, 'landscape')!
      const best = ranked(plain)
      for (const seed of SEEDS) {
        const m = fieldFor(id, rule, 'landscape', seed)!
        expect(m.hazardSeed).toBe(seed)
        expect(fieldIdOf(m)).toBe(id)
        expect(m.terrainRule).toBe(rule ?? undefined)
        const cursed = m.tiles!.filter((t) => t.danger)
        expect(cursed).toHaveLength(DANGER_TILES)
        for (const t of cursed) {
          expect(t.danger).toBe('cursed')
          expect(t.block).toBeNull()
          // Open: a hero may stand there.
          expect(m.slots.some((s) => s.id === t.id)).toBe(true)
          expect(best.slice(0, DANGER_POOL).map((b) => b.id)).toContain(t.id)
        }
        // The seeded boulders: only on open ground, from the next-best pool,
        // never two side by side.
        const added = m.tiles!.filter((t, i) => t.block !== plain.tiles![i].block)
        expect(added.length).toBeGreaterThan(0)
        expect(added.length).toBeLessThanOrEqual(OBSTACLES)
        const pool = best.filter((b) => !cursed.some((c) => c.id === b.id)).slice(0, OBSTACLE_POOL).map((b) => b.id)
        for (const t of added) {
          expect(t.block).toBe('rock')
          expect(pool).toContain(t.id)
          for (const o of added) if (o !== t) expect(Math.abs(o.col - t.col) + Math.abs(o.row - t.row)).toBeGreaterThan(1)
        }
        // Everything that was blocked stays blocked as it was.
        plain.tiles!.forEach((t, i) => {
          if (t.block) expect(m.tiles![i].block).toBe(t.block)
        })
        expect(m.slots.length).toBe(plain.slots.length - added.length)
      }
    },
  )

  it('is deterministic in its seed, and the seed matters', () => {
    const land = FIRST_MAP
    const tiles = layTiles(land.path, [])
    expect(layHazards(tiles, land.path, 1234)).toEqual(layHazards(tiles, land.path, 1234))
    const layouts = new Set(SEEDS.map((s) => {
      const t = layHazards(tiles, land.path, s)
      return t.filter((x) => x.danger || (x.block === 'rock' && !tiles.find((y) => y.id === x.id)!.block)).map((x) => x.id).join(',')
    }))
    expect(layouts.size).toBeGreaterThan(5)
    // Every tile of the pool is dealt the curse on some seed.
    const hit = new Set(SEEDS.map((s) => layHazards(tiles, land.path, s).find((t) => t.danger)!.id))
    expect(hit.size).toBe(DANGER_POOL)
  })

  it('goes over to the portrait twin tile for tile, and a rule change keeps it', () => {
    const flat = fieldFor(FIRST_MAP.id, 'flooded', 'landscape', 77)!
    const tall = orientField(flat, 'portrait')
    expect(tall.orientation).toBe('portrait')
    expect(tall.hazardSeed).toBe(77)
    expect(tall.tiles!.filter((t) => t.danger).map((t) => t.id)).toEqual(flat.tiles!.filter((t) => t.danger).map((t) => t.id))
    expect(tall.slots.map((s) => s.id)).toEqual(flat.slots.map((s) => s.id))
    // Same object for the same key (the terrain bake and the store lean on it).
    expect(orientField(tall, 'landscape')).toBe(flat)
    expect(fieldFor(FIRST_MAP.id, 'flooded', 'portrait', 77)).toBe(tall)
    expect(withTerrainRule(flat, null).hazardSeed).toBe(77)
    // No seed, no hazards: the plain field is untouched.
    expect(FIRST_MAP.tiles!.some((t) => t.danger)).toBe(false)
    expect(fieldFor(FIRST_MAP.id, null, 'landscape')).toBe(FIRST_MAP)
  })

  it('the copy names the cost', () => {
    expect(DANGER_COPY.cursed.line).toBe(`Cursed ground — heroes here deal −${Math.round((1 - CURSED_DAMAGE_MULT) * 100)}% damage.`)
  })
})

describe('the seed', () => {
  it('is a pure hash of (run seed, node): every fight has one, nothing else does', () => {
    for (const type of ['battle', 'elite', 'boss', 'miniboss']) {
      const n = { id: 'n3-1', type }
      expect(nodeHazardSeed(n, 42)).toBe(nodeHazardSeed(n, 42))
      expect(nodeHazardSeed(n, 42)).not.toBe(nodeHazardSeed(n, 43))
      expect(nodeHazardSeed(n, 42)).not.toBe(nodeHazardSeed({ ...n, id: 'n3-2' }, 42))
    }
    for (const type of ['start', 'merchant', 'shrine', 'recruit', 'campfire']) expect(nodeHazardSeed({ id: 'x', type }, 42)).toBeNull()
    expect(endlessHazardSeed(4, 9)).toBe(endlessHazardSeed(4, 9))
    expect(endlessHazardSeed(4, 9)).not.toBe(endlessHazardSeed(5, 9))
  })
})

// ------------------------------------------------------------------ engine

const P = legacyPosts(FIRST_MAP.id)
const cursedOn = (tile: string): GameMap => ({
  ...FIRST_MAP,
  id: `${FIRST_MAP.id}~test`,
  tiles: FIRST_MAP.tiles!.map((t) => (t.id === tile ? { ...t, danger: 'cursed' as const } : t)),
})
const at = (typeId: string, t: number, hpMult = 1, group?: number): SpawnEvent => ({ typeId, at: t, hpMult, group })

function fight(map: GameMap, spawns: SpawnEvent[], seconds: number, breathers: 'pause' | 'auto' = 'auto'): GameEngine {
  const e = new GameEngine({
    map,
    wave: { index: 1, label: 't', spawns, isBoss: false },
    placedSentinels: [{ sentinel: createSentinel('rogue'), slotId: P.s1 }],
    baseHp: 500,
    maxBaseHp: 500,
    seed: 7,
    breathers,
  })
  for (let i = 0; i < seconds / TICK && e.status === 'running' && !e.breather; i++) e.step(TICK)
  return e
}

describe('the debuff', () => {
  it('a hero on cursed ground deals exactly CURSED_DAMAGE_MULT of its damage', () => {
    // Bodies too big to kill in the window: the two fights are shot for shot
    // the same, so only the multiplier separates them.
    const spawns = [at('torch1', 0, 400), at('torch1', 1, 400), at('torch1', 2, 400)]
    const safe = fight(FIRST_MAP, spawns, 12)
    const bad = fight(cursedOn(P.s1), spawns, 12)
    const a = safe.sentinels[0]
    const b = bad.sentinels[0]
    expect(a.damageDealt).toBeGreaterThan(0)
    expect(a.shots).toBe(b.shots)
    expect(b.groundMult).toBe(CURSED_DAMAGE_MULT)
    expect(a.groundMult).toBe(1)
    expect(b.damageDealt / a.damageDealt).toBeCloseTo(CURSED_DAMAGE_MULT, 9)
  })

  it('is applied when a breather move steps onto it and removed when it steps off', () => {
    const map = cursedOn(P.s4)
    expect(tileDamageMult(map, P.s4)).toBe(CURSED_DAMAGE_MULT)
    expect(tileDamageMult(map, P.s1)).toBe(1)
    const spawns = [at('torch1', 0, 0.5, 0), at('torch1', 0, 0.5, 1), at('torch1', 0, 0.5, 2)]
    const e = fight(map, spawns, 60, 'pause')
    expect(e.breather).toBe(true)
    const hero = e.sentinels[0]
    expect(hero.groundMult).toBe(1)
    expect(e.moveHero(P.s1, P.s4)).toBe(true)
    expect(hero.groundMult).toBe(CURSED_DAMAGE_MULT)
    e.resume()
    for (let i = 0; i < 60 / TICK && !e.breather && e.status === 'running'; i++) e.step(TICK)
    expect(e.breather).toBe(true)
    expect(e.moveHero(P.s4, P.s1)).toBe(true)
    expect(hero.groundMult).toBe(1)
  })
})

// ------------------------------------------------------------------- store

describe('the store', () => {
  afterEach(() => setLayoutOrientation(null))

  const enterFirstBattle = (seed: number) => {
    setLayoutOrientation(() => 'landscape')
    useGameStore.getState().beginCampaign(seed, STANDARD_RUN)
    useGameStore.getState().pickStartingHero('fighter')
    const st = useGameStore.getState()
    const node = st.runMap.nodes.find((n) => st.reachableNodeIds.includes(n.id) && n.type === 'battle')!
    st.selectNode(node.id)
    return node
  }

  it('laying the ground draws nothing from the run streams (RNG order is behaviour)', () => {
    setLayoutOrientation(() => 'landscape')
    useGameStore.getState().beginCampaign(31337, STANDARD_RUN)
    useGameStore.getState().pickStartingHero('rogue')
    const st = useGameStore.getState()
    const node = st.runMap.nodes.find((n) => st.reachableNodeIds.includes(n.id) && n.type === 'battle')!
    const before = [streams.rng.saveState(), streams.mapRng.saveState()]
    for (let s = 1; s < 50; s++) fieldFor(fieldIdOf(st.battleMap), null, 'landscape', nodeHazardSeed(node, s))
    expect([streams.rng.saveState(), streams.mapRng.saveState()]).toEqual(before)
    // …and entering the battle draws exactly what it drew before Q1: nothing.
    st.selectNode(node.id)
    expect([streams.rng.saveState(), streams.mapRng.saveState()]).toEqual(before)
    expect(useGameStore.getState().battleMap.hazardSeed).toBe(nodeHazardSeed(node, 31337))
  })

  it('a battle is fought on its node’s danger ground, and a save resumes onto it', () => {
    const node = enterFirstBattle(4242)
    const st = useGameStore.getState()
    expect(st.battleMap.hazardSeed).toBe(nodeHazardSeed(node, 4242))
    const cursed = st.battleMap.tiles!.find((t) => t.danger)!
    expect(cursed).toBeDefined()
    const snap = captureRun(st, { rngLoot: 1, rngMap: 2, lootPity: 0, idCounter: idCounterState(), nameCounters: nameCounterState() })
    expect(snap.hazardSeed).toBe(st.battleMap.hazardSeed)
    const back = migrateSnapshot(JSON.parse(JSON.stringify(snap)))!
    expect(snapshotBattleMap(back)).toBe(st.battleMap)
    expect(dangerAt(snapshotBattleMap(back), cursed.id)).toBe('cursed')
  })

  it('a save written before Q1 (no hazard seed) — or with a bad one — resumes onto plain ground', () => {
    enterFirstBattle(99)
    const snap = captureRun(useGameStore.getState(), { rngLoot: 1, rngMap: 2, lootPity: 0, idCounter: idCounterState(), nameCounters: nameCounterState() })
    const raw = JSON.parse(JSON.stringify(snap)) as Record<string, unknown>
    delete raw.hazardSeed
    const old = migrateSnapshot(raw)!
    expect(old).not.toBeNull()
    expect(old.hazardSeed).toBeNull()
    const map = snapshotBattleMap(old)
    expect(map.hazardSeed).toBeUndefined()
    expect(map.tiles!.some((t) => t.danger)).toBe(false)
    for (const bad of [-1, 1.5, 2 ** 32, 'x', Number.NaN, null, {}]) {
      raw.hazardSeed = bad
      expect(migrateSnapshot(raw)!.hazardSeed).toBeNull()
    }
  })

  it('posting on cursed ground says what it costs; posting elsewhere does not', () => {
    enterFirstBattle(4242)
    const st = useGameStore.getState()
    const hero = st.roster[0]
    const cursed = st.battleMap.tiles!.find((t) => t.danger)!
    const safe = st.battleMap.slots.find((s) => s.id !== cursed.id)!
    // Arming a hero on a field with cursed ground: the note arrives first,
    // naming the tile (the canvas outlines it).
    useGameStore.getState().shellSelect({ kind: 'hero', id: hero.id })
    expect(useGameStore.getState().fieldNote).toMatchObject({ tileId: cursed.id, kind: 'cursed' })
    useGameStore.getState().clearFieldNote()
    // A safe tile says nothing.
    useGameStore.getState().noteDanger(safe.id)
    expect(useGameStore.getState().fieldNote).toBeNull()
    // Posted: allowed, and noted.
    useGameStore.getState().tapTile(cursed.id)
    expect(useGameStore.getState().placements[cursed.id]).toBe(hero.id)
    expect(useGameStore.getState().fieldNote).toMatchObject({ tileId: cursed.id, kind: 'cursed' })
    // Moved to safe ground: the note is retired.
    useGameStore.getState().shellSelect(null)
    useGameStore.getState().shellSelect({ kind: 'hero', id: hero.id })
    useGameStore.getState().tapTile(safe.id)
    expect(useGameStore.getState().placements[safe.id]).toBe(hero.id)
    expect(useGameStore.getState().fieldNote).toBeNull()
  })
})
