import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { idCounterState, RNG } from '../src/game/core/rng'
import { generateItem, ITEM_BASES, heroSlotsFor } from '../src/game/data/items'
import { FIRST_MAP, legacyPosts } from '../src/game/data/maps'
import { createSentinel, nameCounterState } from '../src/game/data/sentinels'
import { crowds, HELD_COPY, parseTileId, roomyTiles, tileId, withinClearance, type Post } from '../src/game/data/terrain'
import { relicTeamMods, RELICS } from '../src/game/data/relics'
import { computeCombat } from '../src/game/engine/combat'
import { GameEngine, TICK } from '../src/game/engine/engine'
import { isMelee, MELEE_LINE, swingWeapon } from '../src/game/engine/melee'
import { conflictCopy, conflictsAmong, equipWarning, roomLine, type Standing } from '../src/game/run/clearance'
import { emptyPlacements } from '../src/game/run/map'
import type { Archetype, GameMap, Item, ItemSlot, Sentinel } from '../src/game/types'
import { STANDARD_RUN } from '../src/state/daily'
import { deployTeam } from '../balance/harness'
import { useGameStore } from '../src/state/gameStore'
import { setLayoutOrientation } from '../src/state/game/runtime'
import { fieldConflicts, gearLocked } from '../src/state/game/selectors'
import { useMetaStore } from '../src/state/metaStore'
import { captureRun, migrateSnapshot } from '../src/state/runSnapshot'

/*
 * Weapon clearance. The designer: "skills and weapon type affect your hero.
 * like equiping a sword might make it unsafe to use a tower where it is and
 * require you to make space. show conflicts and block round start until
 * resolved", then "items locked during rounds, and towers cannot be moved
 * during rounds. only between". Pinned here: the skill hook, conflicts after
 * an equip, Start Wave / Next held and released, the breather, a save that
 * loads with a conflict, "never stuck", and the gear lock.
 */

beforeAll(() => useMetaStore.setState({ stats: { ...useMetaStore.getState().stats, runsCompleted: 3 } }))
afterEach(() => {
  setLayoutOrientation(null)
  useGameStore.setState({ engine: null, screen: 'map', battlePhase: 'setup', breatherPick: null, gearSlot: null })
})

let seq = 0
const gear = (noun: string, slot: ItemSlot = ITEM_BASES[noun].slot): Item => ({
  id: `wc-${noun}-${++seq}`,
  name: `Plain ${noun}`,
  slot,
  rarity: 'common',
  base: {},
  enchantments: [],
})
const holding = (a: Archetype, noun: string | null, name?: string): Sentinel => {
  const h = createSentinel(a)
  return { ...h, ...(name ? { name } : {}), equipment: { mainHand: noun ? gear(noun) : null, offHand: null, body: null } }
}

/** Two open tiles of `map` side by side, clear of `avoid` by two tiles. */
function pairOf(map: GameMap, avoid: string[] = []): [string, string] {
  const open = new Set(map.slots.map((s) => s.id))
  for (const s of map.slots) {
    const p = parseTileId(s.id)!
    const right = tileId(p.c + 1, p.r)
    if (!open.has(right)) continue
    const far = (t: string) => avoid.every((a) => { const q = parseTileId(a)!, w = parseTileId(t)!; return Math.max(Math.abs(q.c - w.c), Math.abs(q.r - w.r)) > 2 })
    if (far(s.id) && far(right)) return [s.id, right]
  }
  throw new Error('no pair')
}

describe('the skill hook', () => {
  it('a hero whose own mods grant melee swings whatever it holds; a team-wide source never makes it swing', () => {
    const plain = holding('mystic', 'Staff')
    expect(isMelee(plain)).toBe(false)
    // A skill (today: any of the hero's own mods — path, mutation, perk, gear).
    const skilled: Sentinel = {
      ...plain,
      mutations: [{ id: 'm', key: 'k', name: 'Whirling Step', desc: '', rarity: 'mythic', mods: { grantsMelee: true }, downside: '' }],
    }
    expect(computeCombat(skilled).mods.grantsMelee).toBe(true)
    expect(isMelee(skilled)).toBe(true)
    expect(swingWeapon(skilled)).toBeNull()
    expect(roomLine(skilled)).toBe(`Too close — ${skilled.name} swings, so keep the tiles next to ${skilled.name} clear.`)
    // Gear can carry it too (an enchant), and taking that gear off ends it.
    const charm: Item = { ...gear('Cloak'), enchantments: [{ id: 'e', label: 'of the Whirl', mods: { grantsMelee: true } }] }
    expect(isMelee({ ...plain, equipment: { ...plain.equipment, body: charm } })).toBe(true)
    // Relics are team-wide: nothing in them grants it, and isMelee never reads team mods.
    for (const m of relicTeamMods(RELICS.map((r) => r.id))) expect(m.grantsMelee).toBeUndefined()
    expect(MELEE_LINE).toBe('Swings — needs clearance')
  })
})

describe('what each class can hold', () => {
  it('no item is class-locked: every class can wield every weapon kind, so a Mystic can carry a sword', () => {
    for (const a of ['fighter', 'rogue', 'mystic'] as const) {
      const h = createSentinel(a)
      for (const [noun, b] of Object.entries(ITEM_BASES)) {
        if (b.slot === 'body') continue
        expect(heroSlotsFor({ name: noun, slot: b.slot }, h).length).toBeGreaterThan(0)
      }
    }
    expect(isMelee(holding('mystic', 'Sword'))).toBe(true)
  })
})

describe('conflicts', () => {
  it('a hero that starts swinging beside another is a conflict; two ranged heroes are not', () => {
    const [a, b] = ['c5r5', 'c6r5']
    const doyle = holding('rogue', 'Bow', 'Doyle')
    const vesper = holding('mystic', 'Wand', 'Vesper')
    const standing: Standing[] = [{ hero: doyle, tile: a }, { hero: vesper, tile: b }]
    expect(conflictsAmong(standing)).toEqual([])
    const armed = { ...doyle, equipment: { ...doyle.equipment, mainHand: gear('Sword') } }
    // The warning, before the swap.
    expect(equipWarning(doyle, armed, 'Sword', standing)).toEqual({ count: 1, text: 'Equipping Sword makes Doyle melee — 1 hero is too close.' })
    // Not for a hero already swinging, nor one stopping, nor one off the field.
    expect(equipWarning(armed, armed, 'Sword', standing)).toBeNull()
    expect(equipWarning(armed, doyle, 'Bow', standing)).toBeNull()
    expect(equipWarning(doyle, armed, 'Sword', [{ hero: vesper, tile: b }])).toBeNull()
    const after = conflictsAmong([{ hero: armed, tile: a }, { hero: vesper, tile: b }])
    expect(after).toHaveLength(1)
    expect(after[0].hero.id).toBe(doyle.id)
    expect(after[0].crowding.map((o) => o.hero.id)).toEqual([vesper.id])
    expect(conflictCopy(after, { moveLeft: true, breather: false }).line).toBe('Make space: Doyle swings a sword — move a hero out of the red zone.')
    expect(conflictCopy(after, { moveLeft: true, breather: true }).fix).toBe('Move a hero out of the red zone, or take the sword off.')
    expect(conflictCopy(after, { moveLeft: false, breather: true }).fix).toBe('Your move is spent — take the sword off.')
  })
})

describe('the store: setup', () => {
  const start = () => {
    setLayoutOrientation(() => 'landscape')
    useGameStore.getState().beginCampaign(4242, STANDARD_RUN)
    useGameStore.getState().pickStartingHero('rogue')
    const st = useGameStore.getState()
    const node = st.runMap.nodes.find((n) => st.reachableNodeIds.includes(n.id) && n.type === 'battle')!
    useGameStore.setState({ screen: 'map', event: null, reachableNodeIds: [node.id], clearedNodeIds: [], currentWave: null })
    useGameStore.getState().selectNode(node.id)
  }
  const safe = () => {
    const m = useGameStore.getState().battleMap
    return { ...m, slots: m.slots.filter((s) => !m.tiles!.find((t) => t.id === s.id)!.danger) }
  }
  const company = () => {
    const doyle = holding('rogue', 'Bow', 'Doyle')
    const vesper = holding('mystic', 'Wand', 'Vesper')
    const sword = gear('Sword')
    const [a, b] = pairOf(safe())
    useGameStore.setState({
      roster: [doyle, vesper],
      inventory: [sword],
      placements: { ...emptyPlacements(useGameStore.getState().battleMap), [a]: doyle.id, [b]: vesper.id },
    })
    return { doyle, vesper, sword, a, b }
  }

  it('equipping a sword next to a hero: a conflict, nobody moved, Start Wave held — then released by a move', () => {
    start()
    const { doyle, vesper, sword, a, b } = company()
    expect(fieldConflicts(useGameStore.getState())).toEqual([])
    useGameStore.getState().equipItem(doyle.id, 'mainHand', sword.id)
    const st = useGameStore.getState()
    expect(st.roster[0].equipment.mainHand?.id).toBe(sword.id)
    // Nobody moved behind the player's back.
    expect([st.placements[a], st.placements[b]]).toEqual([doyle.id, vesper.id])
    const c = fieldConflicts(st)
    expect(c).toHaveLength(1)
    expect(c[0].crowding[0].tile).toBe(b)
    // Start Wave refuses.
    st.startWave()
    expect(useGameStore.getState().engine).toBeNull()
    // A move into the red zone is still refused; one out of it resolves it, live.
    const inside = safe().slots.find((s) => s.id !== a && s.id !== b && withinClearance(s.id, a))!
    useGameStore.getState().shellSelect(null)
    useGameStore.getState().shellSelect({ kind: 'hero', id: vesper.id })
    useGameStore.getState().tapTile(inside.id)
    expect(useGameStore.getState().placements[inside.id]).toBeFalsy()
    expect(useGameStore.getState().fieldNote?.line).toBe('Too close — Doyle swings a sword, so keep the tiles next to Doyle clear.')
    const out = safe().slots.find((s) => !withinClearance(s.id, a) && s.id !== a && Math.abs(parseTileId(s.id)!.c - parseTileId(a)!.c) <= 4)!
    useGameStore.getState().tapTile(out.id)
    expect(useGameStore.getState().placements[out.id]).toBe(vesper.id)
    expect(fieldConflicts(useGameStore.getState())).toEqual([])
    useGameStore.getState().startWave()
    expect(useGameStore.getState().engine).not.toBeNull()
  })

  it('changing gear resolves it too: the sword back off, and the wave may start', () => {
    start()
    const { doyle, sword } = company()
    useGameStore.getState().equipItem(doyle.id, 'mainHand', sword.id)
    expect(fieldConflicts(useGameStore.getState())).toHaveLength(1)
    useGameStore.getState().unequipItem(doyle.id, 'mainHand')
    expect(fieldConflicts(useGameStore.getState())).toEqual([])
    useGameStore.getState().startWave()
    expect(useGameStore.getState().engine).not.toBeNull()
  })

  it('a save with a conflict loads WITH the conflict — nobody is benched — and still holds the wave', () => {
    start()
    const { doyle, vesper, sword, a, b } = company()
    useGameStore.getState().equipItem(doyle.id, 'mainHand', sword.id)
    const snap = captureRun(useGameStore.getState(), { rngLoot: 1, rngMap: 2, lootPity: 0, idCounter: idCounterState(), nameCounters: nameCounterState() })
    useGameStore.getState().resumeRun(migrateSnapshot(JSON.parse(JSON.stringify(snap)))!)
    const st = useGameStore.getState()
    expect([st.placements[a], st.placements[b]]).toEqual([doyle.id, vesper.id])
    expect(fieldConflicts(st)).toHaveLength(1)
    st.startWave()
    expect(useGameStore.getState().engine).toBeNull()
  })

  it('gear locks during a live wave, and moves are refused — both open again between rounds', () => {
    start()
    const { doyle, vesper, sword, b } = company()
    useGameStore.getState().startWave()
    const st = useGameStore.getState()
    const engine = st.engine!
    engine.step(TICK)
    expect(gearLocked(useGameStore.getState())).toBe(true)
    // Every equip path lands on these two actions (and arming a slot).
    useGameStore.getState().equipItem(doyle.id, 'mainHand', sword.id)
    expect(useGameStore.getState().roster[0].equipment.mainHand?.name).toBe('Plain Bow')
    expect(useGameStore.getState().inventory.map((i) => i.id)).toEqual([sword.id])
    useGameStore.getState().unequipItem(vesper.id, 'mainHand')
    expect(useGameStore.getState().roster[1].equipment.mainHand?.name).toBe('Plain Wand')
    useGameStore.getState().activateGearSlot(doyle.id, 'mainHand')
    expect(useGameStore.getState().gearSlot).toBeNull()
    // A move is refused live: the field ignores taps, nothing is picked up.
    const posts = engine.sentinels.map((s) => s.slotId)
    useGameStore.getState().tapTile(b)
    useGameStore.getState().breatherTap(b)
    useGameStore.getState().placeOnSlot(safe().slots[0].id)
    expect(useGameStore.getState().breatherPick).toBeNull()
    expect(engine.sentinels.map((s) => s.slotId)).toEqual(posts)
    // And no conflict can be raised while live (nothing to read).
    expect(fieldConflicts(useGameStore.getState())).toEqual([])
  })
})

describe('the store: a live wave answers instead of ignoring', () => {
  const start = () => {
    setLayoutOrientation(() => 'landscape')
    useGameStore.getState().beginCampaign(4242, STANDARD_RUN)
    useGameStore.getState().pickStartingHero('rogue')
    const st = useGameStore.getState()
    const node = st.runMap.nodes.find((n) => st.reachableNodeIds.includes(n.id) && n.type === 'battle')!
    useGameStore.setState({ screen: 'map', event: null, reachableNodeIds: [node.id], clearedNodeIds: [], currentWave: null })
    useGameStore.getState().selectNode(node.id)
    const m = useGameStore.getState().battleMap
    const safe = m.slots.filter((s) => !m.tiles!.find((t) => t.id === s.id)!.danger)
    const doyle = holding('rogue', 'Sword', 'Doyle')
    const [a] = pairOf({ ...m, slots: safe })
    useGameStore.setState({ roster: [doyle], inventory: [gear('Axe')], placements: { ...emptyPlacements(m), [a]: doyle.id } })
    useGameStore.getState().startWave()
    useGameStore.getState().engine!.step(TICK)
    return { doyle, a, empty: safe.find((s) => s.id !== a && !withinClearance(s.id, a))!.id }
  }

  it('a tap on a posted hero mid-wave says posts are held, opens the hero, and moves nothing', () => {
    const { doyle, a, empty } = start()
    useGameStore.setState({ fieldNote: null })
    useGameStore.getState().tapTile(empty)
    expect(useGameStore.getState().fieldNote).toBeNull()
    useGameStore.getState().tapTile(a)
    const st = useGameStore.getState()
    expect(st.fieldNote).toMatchObject({ tileId: a, kind: 'held' })
    expect(st.shellSelection).toEqual({ kind: 'hero', id: doyle.id })
    expect(st.selectedSentinelId).toBeNull()
    expect(st.engine!.sentinelOnSlot(a)?.def.id).toBe(doyle.id)
    expect(HELD_COPY.line.startsWith(HELD_COPY.name)).toBe(true)
  })

  it('crafting is gear too: reforge, raise and scrap all refuse mid-wave', () => {
    const { doyle } = start()
    const before = useGameStore.getState()
    const worn = before.roster[0].equipment.mainHand!
    const packed = before.inventory[0]
    useGameStore.setState({ gold: 10_000 })
    useGameStore.getState().reforge(worn.id)
    useGameStore.getState().upgradeItem(worn.id)
    useGameStore.getState().dismantleItem(packed.id)
    const st = useGameStore.getState()
    expect(st.gold).toBe(10_000)
    expect(st.roster.find((h) => h.id === doyle.id)!.equipment.mainHand).toEqual(worn)
    expect(st.inventory.map((i) => i.id)).toEqual([packed.id])
  })
})

describe('the store: the breather', () => {
  const P = legacyPosts(FIRST_MAP.id)
  const at = (typeId: string, t: number, hpMult: number, group: number) => ({ typeId, at: t, hpMult, group })
  const held = (team: Sentinel[], tiles: string[]): GameEngine => {
    const e = new GameEngine({
      map: FIRST_MAP,
      wave: { index: 1, label: 't', spawns: [at('torch1', 0, 0.5, 0), at('torch1', 0, 0.5, 1)], isBoss: false },
      placedSentinels: team.map((sentinel, i) => ({ sentinel, slotId: tiles[i] })),
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
  const enter = (e: GameEngine, roster: Sentinel[], inventory: Item[]) => {
    setLayoutOrientation(() => 'landscape')
    useGameStore.getState().beginCampaign(4242, STANDARD_RUN)
    useGameStore.getState().pickStartingHero('rogue')
    useGameStore.setState({ screen: 'battle', battlePhase: 'battle', engine: e, breatherPick: null, fieldNote: null, roster, inventory, battleMap: FIRST_MAP })
  }
  const beside = (t: string) => FIRST_MAP.slots.find((s) => withinClearance(s.id, t) && s.id !== P.s2)!.id

  it('gear opens in the breather and reaches the fight; a conflict holds Next until the sword comes off', () => {
    const doyle = holding('rogue', 'Bow', 'Doyle')
    const vesper = holding('mystic', 'Wand', 'Vesper')
    const sword = gear('Sword')
    const tiles = [P.s1, beside(P.s1)]
    const e = held([doyle, vesper], tiles)
    enter(e, [doyle, vesper], [sword])
    expect(gearLocked(useGameStore.getState())).toBe(false)
    useGameStore.getState().equipItem(doyle.id, 'mainHand', sword.id)
    // The fight has it: the hero in the field is re-dressed, and it is logged.
    expect(e.sentinelOnSlot(P.s1)!.def.equipment.mainHand?.id).toBe(sword.id)
    expect(e.inputLog.at(-1)).toMatchObject({ kind: 'gear', id: doyle.id })
    expect(fieldConflicts(useGameStore.getState())).toHaveLength(1)
    useGameStore.getState().resumeSubWave()
    expect(e.breather).toBe(true)
    // The breather's one move resolves it (Vesper steps out of the red zone)...
    const out = FIRST_MAP.slots.find((s) => !withinClearance(s.id, P.s1) && s.id !== P.s1 && !e.sentinelOnSlot(s.id))!.id
    useGameStore.getState().breatherTap(tiles[1])
    useGameStore.getState().breatherTap(out)
    expect(e.subWaveState().moved).toBe(true)
    expect(fieldConflicts(useGameStore.getState())).toEqual([])
    useGameStore.getState().resumeSubWave()
    expect(e.breather).toBe(false)
  })

  it('with the move spent, taking the sword off always frees the next sub-wave', () => {
    const doyle = holding('rogue', 'Bow', 'Doyle')
    const vesper = holding('mystic', 'Wand', 'Vesper')
    const sword = gear('Sword')
    const e = held([doyle, vesper], [P.s1, P.s3])
    enter(e, [doyle, vesper], [sword])
    // Spend the move: Vesper steps beside Doyle (two ranged heroes — legal).
    useGameStore.getState().breatherTap(P.s3)
    useGameStore.getState().breatherTap(beside(P.s1))
    expect(e.subWaveState().moved).toBe(true)
    useGameStore.getState().equipItem(doyle.id, 'mainHand', sword.id)
    const c = fieldConflicts(useGameStore.getState())
    expect(c).toHaveLength(1)
    expect(conflictCopy(c, { moveLeft: false, breather: true }).fix).toMatch(/take the sword off/)
    useGameStore.getState().resumeSubWave()
    expect(e.breather).toBe(true)
    useGameStore.getState().unequipItem(doyle.id, 'mainHand')
    expect(fieldConflicts(useGameStore.getState())).toEqual([])
    useGameStore.getState().resumeSubWave()
    expect(e.breather).toBe(false)
  })

  it('a worn piece reforged in the breather reaches the fight too', () => {
    const doyle = holding('rogue', 'Bow', 'Doyle')
    const e = held([doyle], [P.s1])
    enter(e, [doyle], [])
    useGameStore.setState({ gold: 10_000 })
    const bow = doyle.equipment.mainHand!
    useGameStore.getState().reforge(bow.id)
    const now = useGameStore.getState().roster[0].equipment.mainHand!
    expect(now.id).toBe(bow.id)
    expect(e.sentinelOnSlot(P.s1)!.def.equipment.mainHand).toEqual(now)
    expect(e.inputLog.at(-1)).toMatchObject({ kind: 'gear', id: doyle.id })
  })

  it('a replay re-dresses the hero at the same tick and fights the same fight', () => {
    const doyle = holding('rogue', 'Bow', 'Doyle')
    const run = () => held([doyle], [P.s1])
    const a = run()
    a.regear({ ...a.sentinels[0].def, equipment: { ...a.sentinels[0].def.equipment, mainHand: gear('Axe') } })
    a.resume()
    for (let i = 0; i < 60 * 120 && a.status === 'running'; i++) a.step(TICK)
    const replay = new GameEngine({
      map: FIRST_MAP,
      wave: a.wave,
      placedSentinels: [{ sentinel: doyle, slotId: P.s1 }],
      baseHp: 200,
      maxBaseHp: 200,
      tactics: { focus: 'first' },
      seed: 99,
      script: a.inputLog,
    })
    for (let i = 0; i < 60 * 120 && replay.status === 'running'; i++) replay.step(TICK)
    expect(replay.sentinels[0].def.equipment.mainHand?.name).toBe('Plain Axe')
    expect(replay.result()).toEqual(a.result())
  })
})

describe('never stuck', () => {
  it('whatever a breather does — one legal move, any gear — taking every swinging weapon off leaves no conflict', () => {
    const rng = new RNG(1234)
    const slots = FIRST_MAP.slots
    const swords = ['Sword', 'Axe', 'Greatsword', 'Warhammer']
    const ranged = ['Bow', 'Wand', 'Staff', 'Dagger', null]
    for (let trial = 0; trial < 300; trial++) {
      // A legal field at the breather's start (as Start Wave demands).
      const team: Standing[] = []
      const n = rng.int(2, 5)
      for (let i = 0; i < n; i++) {
        const hero = holding(rng.pick(['fighter', 'rogue', 'mystic'] as const), rng.chance(0.4) ? rng.pick(swords) : rng.pick(ranged))
        const posts: Post[] = team.map((s) => ({ tile: s.tile, melee: isMelee(s.hero) }))
        const room = roomyTiles(slots, posts, isMelee(hero))
        if (!room.length) break
        team.push({ hero, tile: rng.pick(room).id })
      }
      expect(conflictsAmong(team)).toEqual([])
      // Gear first or the move first, in either order, as the player likes.
      const regear = () => {
        const i = rng.int(0, team.length - 1)
        const h = team[i].hero
        team[i] = { ...team[i], hero: { ...h, equipment: { ...h.equipment, mainHand: rng.chance(0.7) ? gear(rng.pick(swords)) : null } } }
      }
      const move = () => {
        const i = rng.int(0, team.length - 1)
        const others = team.filter((_, j) => j !== i)
        const room = roomyTiles(slots, others.map((s) => ({ tile: s.tile, melee: isMelee(s.hero) })), isMelee(team[i].hero))
        if (room.length) team[i] = { ...team[i], tile: rng.pick(room).id }
      }
      if (rng.chance(0.5)) {
        regear()
        move()
        regear()
      } else {
        regear()
        regear()
        move()
      }
      // The fix that is always there: every weapon that swings, off.
      const stripped = team.map((s) => {
        const w = swingWeapon(s.hero)
        if (!w) return s
        const eq = { ...s.hero.equipment }
        for (const k of ['mainHand', 'offHand'] as const) if (eq[k]?.id === w.id) eq[k] = null
        return { ...s, hero: { ...s.hero, equipment: eq } }
      })
      expect(conflictsAmong(stripped)).toEqual([])
      // And in setup, taking a hero off the field always does it as well.
      for (const c of conflictsAmong(team)) expect(conflictsAmong(team.filter((s) => s.hero.id !== c.hero.id)).some((x) => x.hero.id === c.hero.id)).toBe(false)
    }
  })

  it('crowds is the only spacing rule the conflicts read', () => {
    const standing: Standing[] = [
      { hero: holding('fighter', 'Sword'), tile: 'c5r5' },
      { hero: holding('rogue', 'Bow'), tile: 'c6r6' },
    ]
    expect(conflictsAmong(standing).length > 0).toBe(crowds('c5r5', true, 'c6r6', false))
  })
})

describe('auto-equip on a drop waits for the wave to end', () => {
  it('nothing reaches a hero mid-wave; the spoils land (worn or in the pack) once the wave is settled', () => {
    setLayoutOrientation(() => 'landscape')
    useGameStore.getState().startEndless()
    useGameStore.getState().endlessBeginWave()
    const st0 = useGameStore.getState()
    const hero = st0.roster[0]
    // Free the body slot, so a drop has somewhere it could auto-equip.
    useGameStore.setState({
      roster: st0.roster.map((h, i) => (i === 0 ? { ...h, equipment: { ...h.equipment, body: null } } : h)),
      placements: { ...emptyPlacements(st0.battleMap), [st0.battleMap.slots[Math.floor(st0.battleMap.slots.length / 2)].id]: hero.id },
    })
    const before = JSON.stringify(useGameStore.getState().roster.map((h) => h.equipment))
    const bag = useGameStore.getState().inventory.length
    useGameStore.getState().startWave()
    const e = useGameStore.getState().engine!
    for (let i = 0; i < 60 * 300 && e.status === 'running'; i++) {
      if (e.breather) useGameStore.getState().resumeSubWave()
      e.step(TICK)
      if (i % 600 === 0) expect(JSON.stringify(useGameStore.getState().roster.map((h) => h.equipment))).toBe(before)
    }
    expect(e.status).not.toBe('running')
    expect(JSON.stringify(useGameStore.getState().roster.map((h) => h.equipment))).toBe(before)
    useGameStore.getState().finishBattle()
    useGameStore.getState().skipWaveBeat()
    const st = useGameStore.getState()
    expect(st.lastResult?.status).toBe('cleared')
    {
      const worn = st.roster.flatMap((h) => Object.values(h.equipment).filter(Boolean).map((i) => i!.id))
      for (const it of st.lastLoot) expect(worn.includes(it.id) || st.inventory.some((i) => i.id === it.id)).toBe(true)
      expect(st.inventory.length + worn.length).toBeGreaterThanOrEqual(bag)
    }
  })
})

describe('every place the rule lives reads isMelee', () => {
  it('the menu cinematic: a weapon\'s kind is its stream\'s first draw, whatever the rarity — so reading it early draws nothing new', () => {
    const rarities = ['common', 'rare', 'epic', 'legendary', 'mythic'] as const
    for (let seed = 1; seed < 400; seed++)
      for (const damageType of ['physical', 'magic'] as const) {
        const kinds = rarities.map((rarity) => generateItem(new RNG(seed), { slot: 'oneHand', rarity, allowCurse: false, damageType }).name)
        const noun = (n: string) => Object.keys(ITEM_BASES).find((k) => n.includes(k))
        expect(new Set(kinds.map(noun)).size).toBe(1)
      }
  })

  it('the balance harness posts a hero with a sword clear of everyone, and lets two bows stand together', () => {
    const swordsman = holding('rogue', 'Sword')
    const team = [swordsman, holding('rogue', 'Bow'), holding('mystic', 'Wand'), holding('mystic', 'Staff')]
    const out = deployTeam(FIRST_MAP, team.map((sentinel) => ({ sentinel, slotId: '' })))
    const at = out.find((o) => o.sentinel.id === swordsman.id)!.slotId
    for (const o of out) if (o.sentinel.id !== swordsman.id) expect(withinClearance(o.slotId, at)).toBe(false)
    expect(conflictsAmong(out.map((o) => ({ hero: o.sentinel, tile: o.slotId })))).toEqual([])
  })
})
