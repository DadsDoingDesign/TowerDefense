import { beforeEach, describe, expect, it } from 'vitest'
import { dailySeed, parseSeed, utcDateKey } from '../src/state/daily'
import { START_GOLD, useGameStore } from '../src/state/gameStore'
import { useMetaStore } from '../src/state/metaStore'
import { migrateSnapshot, RUN_SNAPSHOT_VERSION } from '../src/state/runSnapshot'

const g = () => useGameStore.getState()
const mapShape = () => g().runMap.nodes.map((n) => `${n.layer}.${n.row}:${n.type}`).join(",")

describe('Daily Watch', () => {
  beforeEach(() => {
    useMetaStore.getState().resetMeta()
  })

  it('derives a stable seed from the UTC date', () => {
    expect(dailySeed('2026-09-29')).toBe(dailySeed('2026-09-29'))
    expect(dailySeed('2026-09-29')).not.toBe(dailySeed('2026-09-30'))
    expect(utcDateKey(new Date('2026-09-29T23:59:59Z'))).toBe('2026-09-29')
    expect(utcDateKey(new Date('2026-09-30T00:00:00Z'))).toBe('2026-09-30')
  })

  it('deals the same map, field and kit on every start, whatever the hub owns', () => {
    g().startDaily()
    const a = { seed: g().runSeed, map: mapShape(), field: g().battleMap.id, gold: g().gold }
    g().pickStartingHero('rogue')
    const kitA = g().roster[0].equipment.mainHand!.name
    // A hub that has bought everything must not change today's run.
    useMetaStore.setState({ upgrades: { gold: 2, base: 2, stats: 2, roster: 1, loot: 1, cartographer: 1, freeCompanies: 1, standingOrders: 1 } })
    g().startDaily()
    expect(g().runSeed).toBe(a.seed)
    expect(mapShape()).toBe(a.map)
    expect(g().battleMap.id).toBe(a.field)
    expect(g().gold).toBe(START_GOLD)
    g().pickStartingHero('rogue')
    expect(g().roster).toHaveLength(1)
    expect(g().roster[0].equipment.mainHand!.name).toBe(kitA)
    expect(a.seed).toBe(dailySeed(utcDateKey()))
  })

  it('one scored attempt a day — claimed when a hero is committed', () => {
    g().startDaily()
    expect(g().challenge.scored).toBe(false)
    g().pickStartingHero('fighter')
    expect(g().challenge).toMatchObject({ kind: 'daily', scored: true })
    expect(useMetaStore.getState().daily).toMatchObject({ date: utcDateKey(), done: false })
    g().startDaily()
    g().pickStartingHero('fighter')
    expect(g().challenge.scored).toBe(false)
  })

  it('records the scored attempt once, on settle', () => {
    const date = utcDateKey()
    useMetaStore.getState().beginDaily(date)
    useMetaStore.getState().grantRunRewards({ depth: 6, won: false, kills: 40, daily: date })
    expect(useMetaStore.getState().daily).toMatchObject({ depth: 6, won: false, score: 640, done: true })
    // A second settle for the same day (practice) does not overwrite it.
    useMetaStore.getState().grantRunRewards({ depth: 10, won: true, kills: 90, daily: date })
    expect(useMetaStore.getState().daily?.score).toBe(640)
  })

  it('backing out of the hero pick spends nothing and records no run', () => {
    const before = useMetaStore.getState()
    const runs = before.stats.runsCompleted
    const marks = before.marks
    g().startDaily()
    g().cancelHeroPick()
    expect(g().screen).toBe('hub')
    expect(useMetaStore.getState().stats.runsCompleted).toBe(runs)
    expect(useMetaStore.getState().marks).toBe(marks)
    expect(useMetaStore.getState().daily?.date === utcDateKey() && useMetaStore.getState().daily?.done).toBeFalsy()
    // Today's scored attempt is still there to take.
    g().startDaily()
    g().pickStartingHero('fighter')
    expect(g().challenge).toMatchObject({ kind: 'daily', scored: true })
    // Once a hero is committed, Back is no longer the way out.
    g().cancelHeroPick()
    expect(g().screen).not.toBe('hub')
  })

  it('flies no Banner', () => {
    useMetaStore.setState({ sacrificeTier: 3 })
    g().startDaily()
    g().setRunBanner(2)
    expect(g().runBanner).toBe(0)
  })
})

describe('custom seeds', () => {
  it('parses numbers as-is and hashes text', () => {
    expect(parseSeed('12345')).toBe(12345)
    expect(parseSeed('  ')).toBeNull()
    expect(parseSeed('tuesday')).toBe(parseSeed('tuesday'))
    expect(parseSeed('tuesday')).not.toBe(parseSeed('wednesday'))
  })

  it('re-deals the run from the typed seed, and replays it identically', () => {
    g().newRun()
    expect(g().reseedRun('424242')).toBe(true)
    expect(g().runSeed).toBe(424242)
    expect(g().challenge.kind).toBe('seeded')
    const shape = mapShape()
    g().newRun()
    g().reseedRun('424242')
    expect(mapShape()).toBe(shape)
    // Refused once a hero is committed.
    g().pickStartingHero('mystic')
    expect(g().reseedRun('7')).toBe(false)
    expect(g().runSeed).toBe(424242)
  })
})

describe('snapshot v6', () => {
  it('a v5 payload is a standard run, and a v5 hero-pick drops the old pre-pick kit', () => {
    g().newRun()
    const st = g()
    const base = {
      v: 5,
      mode: 'campaign',
      runSeed: 99,
      screen: 'heroPick',
      runPhase: 'active',
      runMap: st.runMap,
      currentNodeId: st.currentNodeId,
      clearedNodeIds: st.clearedNodeIds,
      reachableNodeIds: st.reachableNodeIds,
      battleMapId: st.battleMap.id,
      roster: [],
      inventory: [{ id: 'itm_x', name: 'Common Sword', slot: 'oneHand', rarity: 'common', base: { physDamage: 5 }, enchantments: [] }],
    }
    const snap = migrateSnapshot(base)
    expect(snap).not.toBeNull()
    expect(snap!.v).toBe(RUN_SNAPSHOT_VERSION)
    expect(snap!.challenge.kind).toBe('standard')
    expect(snap!.inventory).toEqual([])
    const kept = migrateSnapshot({ ...base, v: 6, challenge: { kind: 'daily', date: '2026-09-29', scored: true } })
    expect(kept!.challenge).toEqual({ kind: 'daily', date: '2026-09-29', scored: true })
    expect(kept!.inventory).toHaveLength(1)
  })
})
