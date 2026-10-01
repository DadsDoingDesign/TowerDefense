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
import { DANGER_TILES } from '../src/game/data/hazards'
import { emptyPlacements } from '../src/game/run/map'
import {
  RUN_SNAPSHOT_KEY,
  RUN_SNAPSHOT_VERSION,
  captureRun,
  describeSnapshot,
  migrateSnapshot,
  payoutFromRaw,
  snapshotBattleMap,
  type RunSnapshot,
} from '../src/state/runSnapshot'
import { relicTeamMods } from '../src/game/data/relics'
import { skillById, skillFits, STARTER_SKILLS } from '../src/game/data/skills'
import { MAX_SKILLS, skillOffer } from '../src/game/run/skills'
import { MAX_DIFFICULTY } from '../src/game/run/watch'
import { offHandAllowed } from '../src/game/run/inventory'
import { equipRules } from '../src/game/run/relics'

// ---------------------------------------------------------------- the base run

/**
 * A real snapshot, built the way the game builds one: a new run, a hero, a
 * node entered — then dressed with every earned-content field the validators
 * guard (equipped gear with affixes, a mutation, upgrades, a reward offer, a
 * merchant shelf, a fork, run mods), so a mutation can land on each of them.
 */
function buildBase(): Record<string, unknown> {
  // LS3: dealt as a returning player's run, so the node lays its danger ground
  // for the mutations to land on — then marked a staged first run, so the
  // `firstRun` flag rides in the base too.
  const runs = useMetaStore.getState().stats.runsCompleted
  useMetaStore.setState({ stats: { ...useMetaStore.getState().stats, runsCompleted: Math.max(1, runs) } })
  const g = useGameStore.getState()
  g.newRun()
  useGameStore.getState().pickStartingHero('fighter')
  const st = useGameStore.getState()
  // v9: the node is entered held portrait, so the base carries a portrait
  // battlefield (`fieldOrientation`) for the mutations to land on.
  setLayoutOrientation(() => 'portrait')
  st.selectNode(st.reachableNodeIds.find((id) => st.runMap.nodes.find((n) => n.id === id)?.type === 'battle') ?? st.reachableNodeIds[0])
  setLayoutOrientation(null)
  useMetaStore.setState({ stats: { ...useMetaStore.getState().stats, runsCompleted: runs } })
  useGameStore.setState({ firstRun: true })
  // v10 (G1-2): the battle is fought under a map challenge with the hero posted
  // on a tile, so mutations land on `terrainRule` and a tile-keyed placement.
  // Q1: `withTerrainRule` keeps the node's danger ground, so they land on
  // `hazardSeed` too.
  {
    const cur = useGameStore.getState()
    const field = withTerrainRule(cur.battleMap, 'wildfire')
    useGameStore.setState({ battleMap: field, placements: { ...emptyPlacements(field), [field.slots[5].id]: cur.roster[0].id } })
  }

  const rng = new RNG(1234)
  const epic = (slot: Item['slot']): Item => generateItem(rng, { slot, rarity: 'epic' })
  const muts = allMutations()
  const s = useGameStore.getState()
  const hero: Sentinel = {
    ...s.roster[0],
    equipment: { mainHand: epic('oneHand'), offHand: { ...epic('offHand'), keepsake: true }, body: epic('body') },
    mutations: [muts[0]],
    // SK1 (v13): two skills held and one milestone settled.
    skills: ['hold_fast', 'heavy_blows'],
    skillPicks: 1,
  }
  // Round 3 (Q5): a hero wearing what the off hand no longer takes — a Sword,
  // on a Mystic nowhere near the Twinblade Harness's DEX — so every load of the
  // base exercises the move to the pack, and every mutation lands on it too.
  const extra: Sentinel = {
    ...createSentinel('mystic'),
    equipment: { mainHand: null, offHand: { ...epic('oneHand'), name: 'Heavy Sword' }, body: null },
  }
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
    // …and the Twinblade Harness under its pre-round-3 id, `ambidextrous`.
    relics: ['ledger', 'charter', 'warding_stone', 'ambidextrous'],
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
  'thorns', 'patience', 'dps',
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
  // Q1: the danger-ground seed is a uint32 or null, and the field resumed is
  // the one it lays — at most one cursed 2 × 2 patch per DANGER_TILES, never blocked.
  const hz = snap.hazardSeed ?? null
  if (hz !== null && !(Number.isInteger(hz) && hz >= 0 && hz <= 0xffffffff)) throw new Error(`${where}: hazard seed ${hz}`)
  if ((field.hazardSeed ?? null) !== hz) throw new Error(`${where}: field hazard ${field.hazardSeed} ≠ ${hz}`)
  const cursed = (field.tiles ?? []).filter((t) => t.danger)
  if (cursed.length > DANGER_TILES * 4 || cursed.some((t) => t.block)) throw new Error(`${where}: bad danger ground`)
  const team = [...snap.runMods, ...teamKeepsakeMods(snap.roster), ...relicTeamMods(snap.relics)]
  const heroes: Sentinel[] = [
    ...snap.roster,
    ...snap.recruitOptions,
    ...(snap.merchant?.recruit ? [snap.merchant.recruit.sentinel] : []),
    ...(snap.crossroads?.recruits ?? []),
  ]
  for (const s of heroes) assertFiniteCombat(s, team, where)
  // Round 3 (Q5): nobody on the company resumes wearing what their off hand
  // does not take, and a load never mints or loses an item doing so.
  const rules = equipRules(snap.relics)
  for (const s of snap.roster) {
    if (!offHandAllowed(s, rules)) throw new Error(`${where}: ${s.id} resumes with ${s.equipment.offHand?.name} in the off hand`)
  }
  if (snap.relics.includes('ambidextrous')) throw new Error(`${where}: a legacy relic id survived the load`)
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
  for (const k of ['gold', 'baseHp', 'maxBaseHp', 'enemyHpMult', 'threat', 'runDifficulty', 'dust', 'lives', 'round'] as const) {
    if (!Number.isFinite(snap[k])) throw new Error(`${where}: ${k} = ${snap[k]}`)
  }
  // SK1 (v13): the run's pool is known skill ids, and every hero's skills are
  // known, distinct, its class's, at most three — and its owed offer deals.
  if (!snap.skillPool.length || !snap.skillPool.every((id) => !!skillById(id))) throw new Error(`${where}: bad skill pool`)
  if (!Number.isInteger(snap.runDifficulty) || snap.runDifficulty < 0 || snap.runDifficulty > MAX_DIFFICULTY) throw new Error(`${where}: difficulty ${snap.runDifficulty}`)
  for (const s of heroes) {
    const ks = s.skills ?? []
    if (ks.length > MAX_SKILLS || new Set(ks).size !== ks.length) throw new Error(`${where}: ${s.id} skills ${ks}`)
    for (const id of ks) {
      const k = skillById(id)
      if (!k || !skillFits(k, s.archetype)) throw new Error(`${where}: ${s.id} holds ${id}`)
    }
    const picks = s.skillPicks ?? 0
    if (!Number.isInteger(picks) || picks < 0 || picks > 3) throw new Error(`${where}: ${s.id} skillPicks ${picks}`)
    if (s.branchPath.length !== 1 || s.branchPath[0] !== s.archetype) throw new Error(`${where}: ${s.id} path ${s.branchPath}`)
    skillOffer(s, snap.skillPool, snap.runSeed)
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
    // …and the node's danger ground (Q1): a seed, and a cursed tile on the field.
    expect(snap!.hazardSeed).toEqual(expect.any(Number))
    expect(snapshotBattleMap(snap!).tiles!.filter((t) => t.danger === 'cursed')).toHaveLength(DANGER_TILES * 4)
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
      const shouldPay = !!pay && pay.runSeed !== ownSeed && (pay.depth > 0 || pay.kills > 0)
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

  it('leaves a current payload alone', () => {
    const raw = buildBase() as Record<string, unknown> & { gold: number }
    const snap = migrateSnapshot(JSON.parse(JSON.stringify(raw)))
    expect(snap!.gold).toBe(raw.gold)
    expect(snap!.roster[0].skills).toEqual(['hold_fast', 'heavy_blows'])
  })
})

describe('v12 → v13: perks and evolutions became skills (SK1)', () => {
  it('maps a grown hero onto skills, keeps the Vow as the difficulty, and drops the evolution queue', () => {
    const raw = buildBase() as Record<string, unknown> & { roster: (Sentinel & { perks?: string[] })[] }
    raw.v = 12
    const hero = raw.roster[0]
    delete hero.skills
    delete hero.skillPicks
    hero.level = 16
    hero.branchPath = ['fighter', 'guard']
    hero.perks = ['f5_second_wind']
    raw.runBanner = 2
    delete raw.runDifficulty
    delete raw.skillPool
    raw.evolutionQueue = [hero.id]
    const strBefore = hero.stats.str
    const snap = migrateSnapshot(JSON.parse(JSON.stringify(raw)))
    expect(snap).not.toBeNull()
    const h = snap!.roster[0]
    expect(h.skills).toEqual(['hold_fast', 'anchor'])
    expect(h.skillPicks).toBe(2)
    expect(h.branchPath).toEqual(['fighter'])
    expect(h.stats.str).toBe(strBefore)
    expect((h as { perks?: unknown }).perks).toBeUndefined()
    expect(snap!.runDifficulty).toBe(2)
    expect(snap!.skillPool).toEqual([...STARTER_SKILLS])
    expect((snap as unknown as Record<string, unknown>).evolutionQueue).toBeUndefined()
    assertPlayable(snap!, 'v12')
  })
})

describe('v10 → v11: heroes have no HP', () => {
  it('loads an old save and drops the retired HP fields and mods', () => {
    const raw = buildBase() as Record<string, unknown> & { roster: Sentinel[]; inventory: Item[]; runMods: EffectMods[] }
    raw.v = 10
    raw.runDowns = 4
    raw.lastResult = {
      status: 'cleared', goldEarned: 5, baseHpLeft: 18, leakDamage: 2, leaks: 2, enemiesLeaked: 1, downed: 1, enemiesKilled: 9,
      perSentinel: [{ id: raw.roster[0].id, kills: 9, damageDealt: 300, xpGained: 40, downed: true }],
    }
    const legacy = { hpMult: 1.6, physDefAdd: 20, healAura: { hps: 8, radius: 130 }, dmgReductionAura: { reduction: 0.2, radius: 120 }, selfSacrifice: 0.15, blockRegen: 0.03 } as unknown as EffectMods
    const hero = raw.roster[0]
    hero.equipment.body!.enchantments.push({ id: 'old', label: 'of the Old Build', mods: { damageMult: 1.1, ...legacy } })
    hero.mutations = [{ ...hero.mutations![0], mods: { ...hero.mutations![0].mods, ...legacy } }]
    raw.inventory[0].enchantments.push({ id: 'old2', label: 'of Iron', mods: { ...legacy } })
    raw.runMods = [{ damageMult: 1.05, ...legacy }]
    const snap = migrateSnapshot(JSON.parse(JSON.stringify(raw)))
    expect(snap).not.toBeNull()
    expect(snap!.v).toBe(RUN_SNAPSHOT_VERSION)
    expect((snap as unknown as Record<string, unknown>).runDowns).toBeUndefined()
    expect((snap!.lastResult as unknown as Record<string, unknown>).downed).toBeUndefined()
    expect((snap!.lastResult!.perSentinel[0] as unknown as Record<string, unknown>).downed).toBeUndefined()
    const retired = ['hpMult', 'physDefAdd', 'healAura', 'dmgReductionAura', 'selfSacrifice', 'blockRegen']
    const clean = (m: EffectMods | undefined) => retired.every((k) => !(k in (m ?? {})))
    const old = snap!.roster[0].equipment.body!.enchantments.find((e) => e.id === 'old')!
    expect(clean(old.mods)).toBe(true)
    expect(old.mods!.damageMult).toBe(1.1)
    expect(clean(snap!.roster[0].mutations![0].mods)).toBe(true)
    expect(snap!.inventory.every((i) => i.enchantments.every((e) => clean(e.mods)))).toBe(true)
    expect(snap!.runMods.every(clean)).toBe(true)
    expect(snap!.runMods[0].damageMult).toBe(1.05)
    assertPlayable(snap!, 'v10 save')
  })
})

describe('round 3 (Q5): the off hand takes off-hand things only', () => {
  const owned = (snap: { roster: Sentinel[]; inventory: Item[] }) =>
    [...snap.inventory, ...snap.roster.flatMap((s) => [s.equipment.mainHand, s.equipment.offHand, s.equipment.body])]
      .filter((i): i is Item => !!i)
      .map((i) => i.id)
      .sort()

  it('a legacy off-hand sword goes back to the pack on load — nothing lost, the player told once', () => {
    const raw = buildBase() as Record<string, unknown> & { roster: Sentinel[]; inventory: Item[] }
    const before = owned(raw)
    const snap = migrateSnapshot(JSON.parse(JSON.stringify(raw)))!
    expect(snap).not.toBeNull()
    // the relic's old id reads as the Twinblade Harness
    expect(snap.relics).toContain('twinblade')
    expect(snap.relics).not.toContain('ambidextrous')
    // the Mystic (DEX 5) cannot carry a sword in the off hand, Harness or not
    const mystic = snap.roster[1]
    expect(mystic.equipment.offHand).toBeNull()
    expect(snap.inventory.some((i) => i.name === 'Heavy Sword')).toBe(true)
    expect(snap.gearReturned).toEqual([{ hero: mystic.name, item: 'Heavy Sword' }])
    expect(owned(snap)).toEqual(before)
    // the fighter's off-hand piece stays where it is
    expect(snap.roster[0].equipment.offHand).not.toBeNull()

    // Resumed, the toast has its line; saved again, the next load moves nothing.
    useGameStore.getState().resumeRun(snap)
    expect(useGameStore.getState().gearNotice?.text).toBe(`${mystic.name}'s Heavy Sword is back in the pack — the off hand holds knives, wands, shields and the like now`)
    const again = captureRun(useGameStore.getState(), {
      rngLoot: 7,
      rngMap: 9,
      lootPity: 2,
      idCounter: idCounterState(),
      nameCounters: nameCounterState(),
    })
    expect('gearReturned' in again).toBe(false)
    const reload = migrateSnapshot(JSON.parse(JSON.stringify(again)))!
    expect(reload.gearReturned).toBeUndefined()
    expect(owned(reload)).toEqual(before)
  })

  it('a hero with the DEX keeps the sword under the Harness, and loses it without', () => {
    const raw = buildBase() as Record<string, unknown> & { roster: Sentinel[]; relics: string[] }
    raw.roster[1].stats.dex = 14
    const kept = migrateSnapshot(JSON.parse(JSON.stringify(raw)))!
    expect(kept.roster[1].equipment.offHand?.name).toBe('Heavy Sword')
    expect(kept.gearReturned).toBeUndefined()
    raw.relics = raw.relics.filter((r) => r !== 'ambidextrous')
    const lost = migrateSnapshot(JSON.parse(JSON.stringify(raw)))!
    expect(lost.roster[1].equipment.offHand).toBeNull()
    expect(lost.gearReturned).toHaveLength(1)
  })
})
