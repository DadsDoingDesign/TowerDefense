import { beforeAll, describe, expect, it, vi } from 'vitest'

/*
 * A Storage shim, installed before any store module loads: `storage.ts` probes
 * `window.localStorage` once and caches the answer, and the settle path under
 * test only exists when there is somewhere to read a saved run from.
 */
const mem = vi.hoisted(() => {
  const data = new Map<string, string>()
  const localStorage = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    },
  }
  ;(globalThis as { window?: unknown }).window = {
    localStorage,
    addEventListener: () => {},
    removeEventListener: () => {},
  }
  return data
})

import { RNG, idCounterState, nextId } from '../src/game/core/rng'
import { generateItem } from '../src/game/data/items'
import { allMutations } from '../src/game/data/mutations'
import { createSentinel, nameCounterState } from '../src/game/data/sentinels'
import { computeCombat, teamKeepsakeMods } from '../src/game/engine/combat'
import type { EffectMods, Item, Sentinel } from '../src/game/types'
import { peekSavedRun, useGameStore } from '../src/state/gameStore'
import { useMetaStore } from '../src/state/metaStore'
import { setLayoutOrientation } from '../src/state/game/runtime'
import { withTerrainRule } from '../src/game/data/maps'
import { parseTileId } from '../src/game/data/terrain'
import { carryPlacements } from '../src/game/run/map'
import {
  RUN_SNAPSHOT_KEY,
  captureRun,
  describeSnapshot,
  migrateSnapshot,
  payoutFromRaw,
  snapshotBattleMap,
  type RunSnapshot,
} from '../src/state/runSnapshot'
import { relicTeamMods } from '../src/game/data/relics'

// ---------------------------------------------------------------- the base run

/**
 * A real snapshot, built the way the game builds one: a new run, a hero, a
 * node entered — then dressed with every earned-content field the validators
 * guard (equipped gear with affixes, a mutation, upgrades, a reward offer, a
 * merchant shelf, a fork, run mods), so a mutation can land on each of them.
 */
function buildBase(): Record<string, unknown> {
  const g = useGameStore.getState()
  g.newRun()
  useGameStore.getState().pickStartingHero('fighter')
  const st = useGameStore.getState()
  // v9: the node is entered held portrait, so the base carries a portrait
  // battlefield (`fieldOrientation`) for the mutations to land on.
  setLayoutOrientation(() => 'portrait')
  st.selectNode(st.reachableNodeIds.find((id) => st.runMap.nodes.find((n) => n.id === id)?.type === 'battle') ?? st.reachableNodeIds[0])
  setLayoutOrientation(null)
  // v10 (G1-2): the battle is fought under a map challenge with the hero posted
  // on a tile, so mutations land on `terrainRule` and a tile-keyed placement.
  {
    const cur = useGameStore.getState()
    const field = withTerrainRule(cur.battleMap, 'wildfire')
    useGameStore.setState({ battleMap: field, placements: { ...carryPlacements({}, field), [field.slots[5].id]: cur.roster[0].id } })
  }

  const rng = new RNG(1234)
  const epic = (slot: Item['slot']): Item => generateItem(rng, { slot, rarity: 'epic' })
  const muts = allMutations()
  const s = useGameStore.getState()
  const hero: Sentinel = {
    ...s.roster[0],
    equipment: { mainHand: epic('oneHand'), offHand: { ...epic('offHand'), keepsake: true }, body: epic('body') },
    mutations: [muts[0]],
    perks: ['f5_second_wind'],
  }
  const extra = createSentinel('mystic')
  const runMods: EffectMods[] = [{ damageMult: 1.05, burn: { dps: 2, dur: 1.5 } }]
  useGameStore.setState({
    roster: [hero, extra],
    inventory: [...s.inventory, epic('twoHand')],
    runKills: 25,
    runMods,
    reward: [
      { id: 'rw-a', kind: 'item', title: 'An item', desc: '', rarity: 'epic', item: epic('body') },
      { id: 'rw-b', kind: 'stat', title: 'A stat', desc: '', rarity: 'rare', grant: { stats: { str: 2 }, mods: { rateMult: 1.1 } } },
      { id: 'rw-c', kind: 'relic', title: 'Hound Banner', desc: '', rarity: 'rare', relic: 'hound_banner' },
    ],
    // Phase 3b: relics held (a stat one, a rule one, a team capability) and the feats ledger.
    relics: ['ledger', 'charter', 'warding_stone'],
    feats: { starter: 'fighter', startSize: 1, maxFielded: 2, actBosses: 1, flawlessBosses: 0, goldPeak: 120 },
    merchant: { items: [{ item: epic('oneHand'), price: 40 }], recruit: { sentinel: createSentinel('rogue'), price: 90 }, repair: { hp: 5, price: 35 }, rerolls: 1 },
    crossroads: { recruits: [createSentinel('rogue')], mutations: muts.slice(1, 4), mutationHeroId: null },
  })
  const snap = captureRun(useGameStore.getState(), {
    rngLoot: 7,
    rngMap: 9,
    lootPity: 2,
    idCounter: idCounterState(),
    nameCounters: nameCounterState(),
  })
  // Through JSON, exactly as storage would hand it back.
  return JSON.parse(JSON.stringify(snap))
}

// ------------------------------------------------------------------- checkers

const PROFILE_NUMBERS = [
  'damage', 'range', 'rate', 'projectileSpeed', 'splashRadius', 'critChance', 'critMult',
  'maxHp', 'startMissingFrac', 'thorns', 'patience', 'physDef', 'dps',
] as const

function assertFiniteCombat(s: Sentinel, teamMods: EffectMods[], where: string): void {
  const p = computeCombat(s, { teamMods })
  for (const k of PROFILE_NUMBERS) {
    if (!Number.isFinite(p[k])) throw new Error(`${where}: ${s.id}.${k} = ${p[k]}`)
  }
}

/** Everything a loaded snapshot can put into arithmetic must be finite. */
function assertPlayable(snap: RunSnapshot, where: string): void {
  const field = snapshotBattleMap(snap)
  describeSnapshot(snap)
  // G1-2 (v10): placements are tile id → hero id strings, each hero once, and
  // the map challenge is one this build has (or none).
  const posted = Object.values(snap.placements)
  if (!Object.keys(snap.placements).every((k) => parseTileId(k))) throw new Error(`${where}: a placement key is not a tile`)
  if (!posted.every((v) => typeof v === 'string')) throw new Error(`${where}: a placement value is not a hero id`)
  if (new Set(posted).size !== posted.length) throw new Error(`${where}: a hero is posted twice`)
  if (field.terrainRule !== (snap.terrainRule ?? undefined)) throw new Error(`${where}: terrain ${field.terrainRule} ≠ ${snap.terrainRule}`)
  const team = [...snap.runMods, ...teamKeepsakeMods(snap.roster), ...relicTeamMods(snap.relics)]
  const heroes: Sentinel[] = [
    ...snap.roster,
    ...snap.recruitOptions,
    ...(snap.merchant?.recruit ? [snap.merchant.recruit.sentinel] : []),
    ...(snap.crossroads?.recruits ?? []),
  ]
  for (const s of heroes) assertFiniteCombat(s, team, where)
  // Every item that can end up on a hero, worn by a plain one.
  const items: Item[] = [
    ...snap.inventory,
    ...snap.lastLoot,
    ...(snap.merchant?.items.map((e) => e.item) ?? []),
    ...(snap.reward?.flatMap((c) => (c.item ? [c.item] : [])) ?? []),
  ]
  const probe = createSentinel('fighter')
  for (const it of items) {
    const slot = it.slot === 'body' ? 'body' : it.slot === 'offHand' ? 'offHand' : 'mainHand'
    assertFiniteCombat({ ...probe, equipment: { ...probe.equipment, [slot]: it } }, team, `${where} item ${it.id}`)
  }
  // A stat card, taken, and a fork mutation, chosen.
  for (const c of snap.reward ?? []) {
    const gr = c.grant
    if (!gr) continue
    const s = {
      ...probe,
      stats: {
        str: probe.stats.str + (gr.stats?.str ?? 0),
        dex: probe.stats.dex + (gr.stats?.dex ?? 0),
        int: probe.stats.int + (gr.stats?.int ?? 0),
      },
      thorns: probe.thorns + (gr.thorns ?? 0),
      patience: probe.patience + (gr.patience ?? 0),
    }
    assertFiniteCombat(s, gr.mods ? [...team, gr.mods] : team, `${where} grant ${c.id}`)
  }
  for (const m of snap.crossroads?.mutations ?? []) {
    assertFiniteCombat({ ...probe, mutations: [m] }, team, `${where} mutation ${m.id}`)
  }
  for (const k of ['gold', 'baseHp', 'maxBaseHp', 'enemyHpMult', 'threat', 'runBanner', 'dust', 'lives', 'round'] as const) {
    if (!Number.isFinite(snap[k])) throw new Error(`${where}: ${k} = ${snap[k]}`)
  }
  // v7: the merchant's Gate repair and reroll count both reach arithmetic.
  const rep = snap.merchant?.repair
  if (rep && !(Number.isFinite(rep.hp) && Number.isFinite(rep.price))) throw new Error(`${where}: merchant.repair`)
  if (snap.merchant && snap.merchant.rerolls !== undefined && !Number.isFinite(snap.merchant.rerolls)) {
    throw new Error(`${where}: merchant.rerolls = ${snap.merchant.rerolls}`)
  }
}

// ------------------------------------------------------------------ mutations

type Path = (string | number)[]
function paths(o: unknown, at: Path = [], out: Path[] = []): Path[] {
  if (o && typeof o === 'object') {
    for (const k of Object.keys(o)) {
      const key = Array.isArray(o) ? Number(k) : k
      out.push([...at, key])
      paths((o as Record<string, unknown>)[k], [...at, key], out)
    }
  }
  return out
}

const DELETE = Symbol('delete')
const HUGE = Array.from({ length: 5000 }, () => null)
const VALUES: unknown[] = [
  DELETE, null, undefined, NaN, Infinity, -Infinity, -1, 0, 1e308, '', 'x', true, [], {}, [null], { a: 1 }, HUGE,
]

function mutate(base: unknown, path: Path, value: unknown): unknown {
  const c = structuredClone(base)
  let o = c as Record<string | number, unknown>
  for (const k of path.slice(0, -1)) o = o[k] as Record<string | number, unknown>
  const last = path[path.length - 1]
  if (value === DELETE) {
    if (Array.isArray(o)) o.splice(last as number, 1)
    else delete o[last]
  } else o[last] = value === HUGE ? HUGE.slice() : value
  return c
}

const show = (p: Path, v: unknown) =>
  `${p.join('.')} = ${v === DELETE ? '<deleted>' : v === HUGE ? '<5000 nulls>' : String(JSON.stringify(v) ?? v)}`

// ---------------------------------------------------------------------- tests

describe('run snapshot fuzz', () => {
  let base: Record<string, unknown>
  beforeAll(() => {
    base = buildBase()
  })

  it('the base snapshot loads and is fully playable', () => {
    const snap = migrateSnapshot(structuredClone(base))
    expect(snap).not.toBeNull()
    assertPlayable(snap!, 'base')
    expect(snap!.roster[0].equipment.mainHand?.enchantments.length).toBeGreaterThan(0)
    // The base is a portrait battle, and it resumes onto the portrait twin.
    expect(snap!.fieldOrientation).toBe('portrait')
    expect(snapshotBattleMap(snap!).orientation).toBe('portrait')
    // …under its map challenge, with the hero on its tile (G1-2).
    expect(snap!.terrainRule).toBe('wildfire')
    expect(snapshotBattleMap(snap!).terrainRule).toBe('wildfire')
    expect(Object.values(snap!.placements)).toHaveLength(1)
  })

  it('every single-field mutation loads without throwing and never yields NaN combat', () => {
    const all = paths(base)
    expect(all.length).toBeGreaterThan(300)
    const failures: string[] = []
    let accepted = 0
    let cases = 0
    for (const p of all) {
      for (const v of VALUES) {
        cases++
        const raw = mutate(base, p, v)
        try {
          const snap = migrateSnapshot(raw)
          if (snap) {
            accepted++
            assertPlayable(snap, show(p, v))
          }
          const pay = payoutFromRaw(raw)
          if (pay) for (const [k, n] of Object.entries(pay)) if (typeof n === 'number' && !Number.isFinite(n)) throw new Error(`payout.${k} = ${n}`)
        } catch (e) {
          if (failures.length < 25) failures.push(`${show(p, v)} -> ${String(e).slice(0, 160)}`)
        }
      }
    }
    expect(failures, failures.join('\n')).toEqual([])
    expect(cases).toBeGreaterThan(5000)
    // Sanity: the fuzz is not trivially refusing everything.
    expect(accepted).toBeGreaterThan(cases * 0.3)
  })

  it('random multi-field mutations never throw either', () => {
    const all = paths(base)
    let seed = 99
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    const failures: string[] = []
    for (let i = 0; i < 3000; i++) {
      let raw: unknown = base
      const applied: string[] = []
      for (let j = 0; j < 3; j++) {
        const p = all[Math.floor(rnd() * all.length)]
        const v = VALUES[Math.floor(rnd() * VALUES.length)]
        try {
          raw = mutate(raw, p, v)
          applied.push(show(p, v))
        } catch {
          /* the path no longer exists after an earlier mutation */
        }
      }
      try {
        const snap = migrateSnapshot(raw)
        if (snap) assertPlayable(snap, applied.join(' & '))
        payoutFromRaw(raw)
      } catch (e) {
        if (failures.length < 10) failures.push(`${applied.join(' & ')} -> ${String(e).slice(0, 160)}`)
      }
    }
    expect(failures, failures.join('\n')).toEqual([])
  })

  it('settle pays every stored payload exactly once, and New Run never throws', () => {
    const all = paths(base)
    const failures: string[] = []
    let paid = 0
    let seed = 7
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    // Retire the base run the store is still holding (it is paid from memory),
    // so every payload below is a previous session's run, paid from storage.
    mem.delete(RUN_SNAPSHOT_KEY)
    useGameStore.getState().newRun()
    for (let i = 0; i < 400; i++) {
      const p = all[Math.floor(rnd() * all.length)]
      const v = VALUES[Math.floor(rnd() * VALUES.length)]
      const raw = mutate(base, p, v)
      mem.set(RUN_SNAPSHOT_KEY, JSON.stringify(raw))
      const pay = payoutFromRaw(JSON.parse(mem.get(RUN_SNAPSHOT_KEY)!))
      const ownSeed = useGameStore.getState().runSeed
      const shouldPay = !!pay && pay.runSeed !== ownSeed && (pay.depth > 0 || pay.kills > 0 || pay.downs > 0)
      const before = useMetaStore.getState().stats.runsCompleted
      try {
        useGameStore.getState().newRun()
        const mid = useMetaStore.getState().stats.runsCompleted
        useGameStore.getState().newRun()
        const after = useMetaStore.getState().stats.runsCompleted
        if (mid - before !== (shouldPay ? 1 : 0)) throw new Error(`first settle paid ${mid - before}x`)
        if (after !== mid) throw new Error('second settle paid again')
        if (mem.has(RUN_SNAPSHOT_KEY)) throw new Error('payload left in storage')
        if (shouldPay) paid++
      } catch (e) {
        if (failures.length < 10) failures.push(`${show(p, v)} -> ${String(e).slice(0, 160)}`)
      }
    }
    expect(failures, failures.join('\n')).toEqual([])
    expect(paid).toBeGreaterThan(200)
  })

  it('a runMap with a null node is unresumable but still paid (the New Run crash)', () => {
    const raw = structuredClone(base) as { runMap: { nodes: unknown[] } }
    raw.runMap.nodes.splice(1, 0, null)
    expect(migrateSnapshot(raw)).toBeNull()
    mem.set(RUN_SNAPSHOT_KEY, JSON.stringify(raw))
    expect(peekSavedRun()).toBeNull()
    const before = useMetaStore.getState().stats.runsCompleted
    expect(() => useGameStore.getState().newRun()).not.toThrow()
    expect(useMetaStore.getState().stats.runsCompleted).toBe(before + 1)
    expect(mem.has(RUN_SNAPSHOT_KEY)).toBe(false)
  })

  it('an item with a non-numeric base or enchantment mod is refused', () => {
    const a = structuredClone(base) as { inventory: { base: Record<string, unknown> }[] }
    a.inventory[0].base = { physDamage: 'lots' }
    expect(migrateSnapshot(a)).toBeNull()
    const b = structuredClone(base) as { roster: { equipment: { mainHand: { enchantments: { mods?: unknown }[] } } }[] }
    b.roster[0].equipment.mainHand.enchantments[0].mods = { damageMult: 'NaN?' }
    expect(migrateSnapshot(b)).toBeNull()
  })

  it('peeking at a save does not advance the id or name counters; resuming does', () => {
    const raw = structuredClone(base) as Record<string, unknown>
    raw.runSeed = 424242
    raw.idCounter = 1_000_000
    raw.nameCounters = { fighter: 500, rogue: 500, mystic: 500 }
    mem.set(RUN_SNAPSHOT_KEY, JSON.stringify(raw))
    const idBefore = idCounterState()
    const namesBefore = nameCounterState()
    const snap = peekSavedRun()
    expect(snap).not.toBeNull()
    expect(idCounterState()).toBe(idBefore)
    expect(nameCounterState()).toEqual(namesBefore)
    useGameStore.getState().resumeRun(snap!)
    expect(idCounterState()).toBeGreaterThanOrEqual(1_000_000)
    expect(nameCounterState().fighter).toBeGreaterThanOrEqual(500)
    expect(nextId()).not.toBe('e0')
  })
})

describe('v6 → v7: the skill tree became spec perks', () => {
  it('refunds every bought upgrade level and converts the free path levels', () => {
    const raw = buildBase() as Record<string, unknown> & { roster: Sentinel[]; gold: number; inventory: Item[] }
    raw.v = 6
    const hero = raw.roster[0]
    hero.upgrades = { power: 2, tempo: 1 }
    delete hero.perks
    const mythic = { ...raw.inventory[0], rarity: 'mythic' as const, grantUpgrade: { path: 'precision', levels: 1 } }
    raw.inventory = [mythic]
    const gold = raw.gold
    const snap = migrateSnapshot(JSON.parse(JSON.stringify(raw)))
    expect(snap).not.toBeNull()
    // Onslaught L1+L2 (40 + 95) and Tempo L1 (40).
    expect(snap!.gold).toBe(gold + 175)
    expect(snap!.roster[0].upgrades).toBeUndefined()
    const item = snap!.inventory[0]
    expect(item.grantUpgrade).toBeUndefined()
    expect(item.enchantments.some((e) => e.id === 'mythic_precision')).toBe(true)
  })

  it('leaves a v7 payload alone', () => {
    const raw = buildBase() as Record<string, unknown> & { gold: number }
    const snap = migrateSnapshot(JSON.parse(JSON.stringify(raw)))
    expect(snap!.gold).toBe(raw.gold)
    expect(snap!.roster[0].perks).toEqual(['f5_second_wind'])
  })
})
