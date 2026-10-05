import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { idCounterState } from '../src/game/core/rng'
import { ALL_NODES, BASE_ARCHETYPE_NODES, getNode, mergeMods } from '../src/game/data/archetypeTree'
import { FIRST_MAP, legacyPosts } from '../src/game/data/maps'
import { allMutations } from '../src/game/data/mutations'
import { allPerkPoints } from '../src/game/data/perks'
import { RELICS, relicTeamMods } from '../src/game/data/relics'
import { createSentinel, nameCounterState } from '../src/game/data/sentinels'
import {
  CLEARANCE_LABEL,
  clearanceOverlay,
  clearanceTiles,
  crowds,
  parseTileId,
  ROOM_COPY,
  tileId,
  withinClearance,
} from '../src/game/data/terrain'
import { GameEngine, TICK } from '../src/game/engine/engine'
import { isMelee } from '../src/game/engine/melee'
import { ITEM_BASES, itemSwings } from '../src/game/data/items'
import { carryPlacements, emptyPlacements, meleeOf } from '../src/game/run/map'
import type { Archetype, GameMap, Item, ItemSlot, Sentinel } from '../src/game/types'
import { STANDARD_RUN } from '../src/state/daily'
import { useGameStore } from '../src/state/gameStore'
import { setLayoutOrientation } from '../src/state/game/runtime'
import { useMetaStore } from '../src/state/metaStore'
import { captureRun, migrateSnapshot } from '../src/state/runSnapshot'

/*
 * A swinger's clearance (the designer: "maybe melee towers have this rule since
 * they swing around them", then "equiping a sword might make it unsafe to use a
 * tower where it is"). Only a hero that swings — a sword, axe, greatsword or
 * warhammer in hand, or a skill that says so — keeps the 8 tiles round it
 * clear; ranged heroes may stand side by side. Pinned here: who is melee, the
 * rule in both directions, the store, the breather move, and the tiles the
 * placement overlay lights and outlines. Conflicts, the gear lock and the
 * skill hook are `weaponClearance.test.ts`.
 */

/** A plain item named by its base noun. */
const gear = (noun: string, slot: ItemSlot = ITEM_BASES[noun].slot): Item => ({
  id: `it-${noun}-${Math.random().toString(36).slice(2, 8)}`,
  name: `Plain ${noun}`,
  slot,
  rarity: 'common',
  base: {},
  enchantments: [],
})
/** A fresh hero holding `noun` in the main hand (nothing when null). */
const holding = (a: Archetype, noun: string | null): Sentinel => {
  const h = createSentinel(a)
  return { ...h, equipment: { mainHand: noun ? gear(noun) : null, offHand: null, body: null } }
}

beforeAll(() => useMetaStore.setState({ stats: { ...useMetaStore.getState().stats, runsCompleted: 3 } }))
afterEach(() => setLayoutOrientation(null))

/** Two open tiles of `map` side by side (same row, next column), both a clearance clear of `avoid`. */
function pairOf(map: GameMap, avoid: string[] = []): [string, string] {
  const open = new Set(map.slots.map((s) => s.id))
  for (const s of map.slots) {
    const p = parseTileId(s.id)!
    const right = tileId(p.c + 1, p.r)
    if (!open.has(right)) continue
    if (avoid.some((a) => a === s.id || a === right || withinClearance(a, s.id) || withinClearance(a, right))) continue
    return [s.id, right]
  }
  throw new Error('no pair')
}

describe('who is melee', () => {
  it('the swinging weapons: Sword, Axe, Greatsword, Warhammer — and nothing else', () => {
    const swing = Object.entries(ITEM_BASES).filter(([noun, b]) => itemSwings({ name: `Rare ${noun}`, slot: b.slot })).map(([n]) => n)
    expect(swing.sort()).toEqual(['Axe', 'Greatsword', 'Sword', 'Warhammer'])
    // Every swinger is a physical weapon of a main-hand or two-hand grip; the
    // knife (either grip) and the bow do not swing.
    for (const n of swing) expect(['main', 'twoHand']).toContain(ITEM_BASES[n].grip)
    expect(itemSwings({ name: 'Rare Dagger', slot: 'oneHand' })).toBe(false)
    expect(itemSwings({ name: 'Rare Bow', slot: 'twoHand' })).toBe(false)
    // A noun only classifies an item of its own kind (a body piece "of the Sword" is not one).
    expect(itemSwings({ name: 'Sword Mail', slot: 'body' })).toBe(false)
    expect(itemSwings(null)).toBe(false)
  })

  it('melee comes from what the hero holds, not its class', () => {
    for (const a of ['fighter', 'rogue', 'mystic'] as const) {
      expect(isMelee(holding(a, 'Sword'))).toBe(true)
      expect(isMelee(holding(a, 'Warhammer'))).toBe(true)
      expect(isMelee(holding(a, 'Bow'))).toBe(false)
      expect(isMelee(holding(a, 'Dagger'))).toBe(false)
      expect(isMelee(holding(a, 'Staff'))).toBe(false)
      expect(isMelee(holding(a, 'Wand'))).toBe(false)
      // Unarmed, or a shield alone: nothing to swing.
      expect(isMelee(holding(a, null))).toBe(false)
      expect(isMelee({ ...holding(a, null), equipment: { mainHand: null, offHand: gear('Shield'), body: null } })).toBe(false)
    }
    // A sword in the OFF hand (the Twinblade Harness) is still a sword being swung.
    expect(isMelee({ ...holding('rogue', 'Dagger'), equipment: { mainHand: gear('Dagger'), offHand: gear('Sword', 'oneHand'), body: gear('Plate') } })).toBe(true)
  })

  it('evolutions never change it on their own: the same weapon, the same answer, down every path', () => {
    for (const n of ALL_NODES) {
      const path: string[] = []
      for (let at: string | null = n.id; at; at = getNode(at).parent) path.unshift(at)
      expect(isMelee({ ...holding(n.archetype, 'Sword'), branchPath: path })).toBe(true)
      expect(isMelee({ ...holding(n.archetype, 'Bow'), branchPath: path })).toBe(false)
    }
  })

  it('holding enemies stays the Fighter line\'s, whatever it holds — only the clearance moved', () => {
    for (const n of BASE_ARCHETYPE_NODES) expect(n.mods?.block != null).toBe(n.archetype === 'fighter')
    const archer = holding('fighter', 'Bow')
    expect(isMelee(archer)).toBe(false)
    expect(mergeMods(archer.branchPath.map((id) => getNode(id).mods)).block).toBeDefined()
  })

  it('nothing grants a hold to a ranged line: perks, mutations, relics, gear', () => {
    for (const pt of allPerkPoints())
      for (const perk of pt.options) if (perk.mods.block) expect(getNode(pt.line).archetype).toBe('fighter')
    for (const m of allMutations()) expect(m.mods.block).toBeUndefined()
    for (const m of relicTeamMods(RELICS.map((r) => r.id))) expect(m.block).toBeUndefined()
    const items = readFileSync(join(__dirname, '..', 'src', 'game', 'data', 'items.ts'), 'utf8')
    expect(/\bblock\s*:/.test(items)).toBe(false)
  })
})

describe('the rule', () => {
  it('ranged beside ranged is fine; anyone beside a Fighter is not, whichever is posted first', () => {
    for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
      const b = tileId(5 + dc, 5 + dr)
      expect(crowds('c5r5', false, b, false)).toBe(false)
      expect(crowds('c5r5', true, b, false)).toBe(true)
      expect(crowds('c5r5', false, b, true)).toBe(true)
      expect(crowds('c5r5', true, b, true)).toBe(true)
    }
    expect(crowds('c5r5', true, 'c7r5', true)).toBe(false)
    expect(crowds('c5r5', true, 'c7r6', false)).toBe(false)
  })

  it('the coach says why in plain words: the weapon, never the class', () => {
    expect(ROOM_COPY.line.startsWith(ROOM_COPY.name)).toBe(true)
    expect(ROOM_COPY.line).toMatch(/sword, axe or hammer/)
    expect(ROOM_COPY.line).not.toMatch(/Fighter/)
  })

  it('the clearance is the 3 × 3 block on the lattice, clipped at the grid edge', () => {
    expect(clearanceTiles('c5r5').sort()).toEqual(
      ['c4r4', 'c5r4', 'c6r4', 'c4r5', 'c5r5', 'c6r5', 'c4r6', 'c5r6', 'c6r6'].sort(),
    )
    expect(clearanceTiles('c0r0').sort()).toEqual(['c0r0', 'c0r1', 'c1r0', 'c1r1'])
    expect(clearanceTiles('s3')).toEqual([])
    // Every tile in it but the centre is exactly the tiles a Fighter there crowds.
    for (const t of clearanceTiles('c5r5')) expect(withinClearance('c5r5', t)).toBe(t !== 'c5r5')
    expect(CLEARANCE_LABEL).toBe('Clearance')
  })
})

describe('the placement overlay', () => {
  const map = FIRST_MAP
  const P = legacyPosts(map.id)
  const neighbours = (t: string) => map.slots.filter((s) => withinClearance(s.id, t)).map((s) => s.id).sort()

  it('arming a ranged hero: only a posted Fighter darkens its neighbours, and only it gets a zone', () => {
    const staying = [
      { tile: P.s1, melee: true },
      { tile: P.s3, melee: false },
    ]
    const lay = clearanceOverlay(map.slots, staying, false, P.s5)
    expect([...lay.crowded].sort()).toEqual(neighbours(P.s1))
    expect(lay.zones).toEqual([P.s1])
    expect(lay.landing).toBeNull()
  })

  it('arming a Fighter: every posted hero darkens its neighbours; zones stay on Fighters; the landing tile gets one', () => {
    const staying = [
      { tile: P.s1, melee: true },
      { tile: P.s3, melee: false },
    ]
    const lay = clearanceOverlay(map.slots, staying, true, P.s5)
    expect([...lay.crowded].sort()).toEqual([...new Set([...neighbours(P.s1), ...neighbours(P.s3)])].sort())
    expect(lay.zones).toEqual([P.s1])
    expect(lay.landing).toBe(P.s5)
    // Not a tile of this field: no landing zone.
    expect(clearanceOverlay(map.slots, staying, true, 'c0r0').landing).toBeNull()
  })

  it('what the overlay darkens is exactly what the store refuses', () => {
    const staying = [{ tile: P.s2, melee: true }, { tile: P.s4, melee: false }]
    for (const armed of [true, false]) {
      const lay = clearanceOverlay(map.slots, staying, armed, null)
      for (const s of map.slots) {
        const refused = staying.some((o) => crowds(o.tile, o.melee, s.id, armed))
        expect(lay.crowded.has(s.id)).toBe(refused)
      }
    }
  })
})

describe('the store', () => {
  const start = () => {
    setLayoutOrientation(() => 'landscape')
    useGameStore.getState().beginCampaign(4242, STANDARD_RUN)
    useGameStore.getState().pickStartingHero('fighter')
    const st = useGameStore.getState()
    const node = st.runMap.nodes.find((n) => st.reachableNodeIds.includes(n.id) && n.type === 'battle')!
    useGameStore.setState({ screen: 'map', event: null, reachableNodeIds: [node.id], clearedNodeIds: [], currentWave: null })
    useGameStore.getState().selectNode(node.id)
  }
  const safe = () => {
    const m = useGameStore.getState().battleMap
    return { ...m, slots: m.slots.filter((s) => !m.tiles!.find((t) => t.id === s.id)!.danger) }
  }
  const post = (hero: Sentinel, tile: string) => {
    // A second select of the same hero would toggle it off; start clean.
    useGameStore.getState().shellSelect(null)
    useGameStore.getState().shellSelect({ kind: 'hero', id: hero.id })
    useGameStore.getState().tapTile(tile)
  }

  it('two ranged heroes post side by side; a Fighter may not join them, nor they it', () => {
    start()
    const [fighter, rogue, mystic] = [holding('fighter', 'Sword'), holding('rogue', 'Bow'), holding('mystic', 'Wand')]
    useGameStore.setState({ roster: [fighter, rogue, mystic], placements: emptyPlacements(useGameStore.getState().battleMap) })
    const [a, b] = pairOf(safe())
    post(rogue, a)
    post(mystic, b)
    expect(useGameStore.getState().placements[a]).toBe(rogue.id)
    expect(useGameStore.getState().placements[b]).toBe(mystic.id)
    expect(useGameStore.getState().fieldNote).toBeNull()
    // The Fighter beside either of them: refused, with the reason.
    const beside = safe().slots.find((s) => s.id !== a && s.id !== b && withinClearance(s.id, b))!
    post(fighter, beside.id)
    expect(useGameStore.getState().placements[beside.id]).toBeFalsy()
    expect(useGameStore.getState().fieldNote).toMatchObject({ tileId: beside.id, kind: 'crowded' })
    // Posted clear of them, the Fighter keeps its clearance against a ranged hero.
    const far = safe().slots.find((s) => ![a, b].some((t) => t === s.id || withinClearance(t, s.id)) && safe().slots.some((o) => withinClearance(o.id, s.id) && ![a, b].some((t) => withinClearance(t, o.id) || t === o.id)))!
    post(fighter, far.id)
    expect(useGameStore.getState().placements[far.id]).toBe(fighter.id)
    const next = safe().slots.find((s) => withinClearance(s.id, far.id) && ![a, b].includes(s.id))!
    post(rogue, next.id)
    expect(useGameStore.getState().placements[next.id]).toBeFalsy()
    expect(useGameStore.getState().placements[a]).toBe(rogue.id)
    expect(useGameStore.getState().fieldNote).toMatchObject({ tileId: next.id, kind: 'crowded' })
  })

  it('a save keeps two ranged heroes side by side', () => {
    start()
    const [fighter, rogue, mystic] = [holding('fighter', 'Sword'), holding('rogue', 'Bow'), holding('mystic', 'Wand')]
    const map = safe()
    const [a, b] = pairOf(map)
    useGameStore.setState({ roster: [fighter, rogue, mystic], placements: { ...emptyPlacements(useGameStore.getState().battleMap), [a]: rogue.id, [b]: mystic.id } })
    const snap = captureRun(useGameStore.getState(), { rngLoot: 1, rngMap: 2, lootPity: 0, idCounter: idCounterState(), nameCounters: nameCounterState() })
    const back = migrateSnapshot(JSON.parse(JSON.stringify(snap)))!
    useGameStore.getState().resumeRun(back)
    expect(useGameStore.getState().placements[a]).toBe(rogue.id)
    expect(useGameStore.getState().placements[b]).toBe(mystic.id)
  })

  it('meleeOf reads who swings off the roster', () => {
    const [fighter, rogue] = [holding('fighter', 'Axe'), holding('rogue', 'Bow')]
    const melee = meleeOf([fighter, rogue])
    expect(melee(fighter.id)).toBe(true)
    expect(melee(rogue.id)).toBe(false)
    expect(meleeOf([holding('fighter', null)])('x')).toBe(false)
    // carryPlacements keeps both; the conflict is the battle's to show.
    const [a, b] = pairOf(FIRST_MAP)
    const kept = carryPlacements({ [a]: rogue.id, [b]: fighter.id }, FIRST_MAP, () => true, 5)
    expect([kept[a], kept[b]]).toEqual([rogue.id, fighter.id])
  })
})

describe('the breather move', () => {
  const at = (typeId: string, t: number, hpMult: number, group: number) => ({ typeId, at: t, hpMult, group })
  const engineAtBreather = (team: [Archetype, string][]): GameEngine => {
    const e = new GameEngine({
      map: FIRST_MAP,
      wave: { index: 1, label: 't', spawns: [at('torch1', 0, 0.5, 0), at('torch1', 0, 0.5, 1)], isBoss: false },
      // The Fighter swings a sword; the others hold their ranged weapons.
      placedSentinels: team.map(([a, slotId]) => ({ sentinel: holding(a, a === 'fighter' ? 'Sword' : a === 'rogue' ? 'Bow' : 'Wand'), slotId })),
      baseHp: 200,
      maxBaseHp: 200,
      breathers: 'pause',
      tactics: { focus: 'first' },
      seed: 99,
    })
    for (let i = 0; i < 60 * 60 && !e.breather && e.status === 'running'; i++) e.step(TICK)
    expect(e.breather).toBe(true)
    return e
  }
  const P = legacyPosts(FIRST_MAP.id)
  const besideOf = (t: string, avoid: string[]) =>
    FIRST_MAP.slots.find((s) => withinClearance(s.id, t) && !avoid.some((a) => a === s.id || withinClearance(a, s.id)))!.id

  it('a ranged hero may move beside another ranged hero', () => {
    const e = engineAtBreather([['rogue', P.s1], ['mystic', P.s2]])
    expect(e.moveHero(P.s1, besideOf(P.s2, [P.s1]))).toBe(true)
  })

  it('a ranged hero may not move into a Fighter\'s clearance', () => {
    const e = engineAtBreather([['rogue', P.s1], ['fighter', P.s2]])
    expect(e.moveHero(P.s1, besideOf(P.s2, [P.s1]))).toBe(false)
    expect(e.subWaveState().moved).toBe(false)
  })

  it('a Fighter may not move beside a ranged hero', () => {
    const e = engineAtBreather([['fighter', P.s1], ['mystic', P.s2]])
    expect(e.moveHero(P.s1, besideOf(P.s2, [P.s1]))).toBe(false)
  })

  it('the store refuses the same moves the engine does, and says why', () => {
    setLayoutOrientation(() => 'landscape')
    useGameStore.getState().beginCampaign(4242, STANDARD_RUN)
    useGameStore.getState().pickStartingHero('fighter')
    const e = engineAtBreather([['rogue', P.s1], ['fighter', P.s2]])
    useGameStore.setState({ screen: 'battle', battlePhase: 'battle', engine: e, breatherPick: null, fieldNote: null })
    const to = besideOf(P.s2, [P.s1])
    useGameStore.getState().breatherTap(P.s1)
    useGameStore.getState().breatherTap(to)
    expect(useGameStore.getState().fieldNote).toMatchObject({ tileId: to, kind: 'crowded' })
    expect(e.sentinelOnSlot(P.s1)).toBeDefined()
    useGameStore.setState({ engine: null, screen: 'map', battlePhase: 'setup', breatherPick: null })
  })
})
