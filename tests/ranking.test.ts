import { beforeEach, describe, expect, it } from 'vitest'
import { countsForRanking, markAssisted } from '../src/game/run/ranking'
import { contractGrant, type SettleFacts } from '../src/game/run/settle'
import { useGameStore } from '../src/state/gameStore'
import { useMetaStore } from '../src/state/metaStore'
import { useSettingsStore } from '../src/state/settingsStore'
import { captureRun, migrateSnapshot } from '../src/state/runSnapshot'

const g = () => useGameStore.getState()

describe('countsForRanking — the one gate every leaderboard calls (game/run/ranking)', () => {
  it('a plain run counts; an assisted run or a custom seed does not', () => {
    expect(countsForRanking({})).toBe(true)
    expect(countsForRanking({ assisted: false, challenge: { kind: 'standard' } })).toBe(true)
    expect(countsForRanking({ assisted: true, challenge: { kind: 'standard' } })).toBe(false)
    expect(countsForRanking({ assisted: false, challenge: { kind: 'seeded' } })).toBe(false)
    expect(countsForRanking({ assisted: true, challenge: { kind: 'seeded' } })).toBe(false)
  })

  it('only a literal true is assisted — a payload cannot buy its way off the mark by shape alone', () => {
    expect(countsForRanking({ assisted: 'yes' as unknown as boolean })).toBe(true)
    expect(countsForRanking({ assisted: undefined, challenge: null })).toBe(true)
  })

  it('once assisted, always: turning the dial back off never clears the mark', () => {
    expect(markAssisted(false, 'off')).toBe(false)
    expect(markAssisted(false, 'steady')).toBe(true)
    expect(markAssisted(false, 'sure')).toBe(true)
    expect(markAssisted(true, 'off')).toBe(true)
  })

  it('the grant a settle makes carries it', () => {
    const facts = (assisted: boolean): SettleFacts => ({ depth: 4, kills: 30, gold: 80, contract: null, challenge: { kind: 'standard' } as SettleFacts['challenge'], assisted })
    expect(contractGrant(facts(false), 'delivered').rankable).toBe(true)
    expect(contractGrant(facts(true), 'delivered').rankable).toBe(false)
  })
})

describe('an assisted run, in the store', () => {
  beforeEach(() => {
    useMetaStore.getState().resetMeta()
    useSettingsStore.setState({ assist: 'off' })
  })

  it('turning assist on mid-run marks it, and turning it off again keeps the mark', () => {
    g().beginCampaign(77, { kind: 'standard' }, { company: 'silk', crates: 0 })
    g().pickStartingHero('pick-0')
    expect(g().assisted).toBe(false)
    useSettingsStore.setState({ assist: 'steady' })
    expect(g().assisted).toBe(true)
    useSettingsStore.setState({ assist: 'off' })
    expect(g().assisted).toBe(true)
  })

  it('a run begun with assist on is assisted from the start; the next one begun with it off is not', () => {
    useSettingsStore.setState({ assist: 'sure' })
    g().beginCampaign(78, { kind: 'standard' }, { company: 'silk', crates: 0 })
    expect(g().assisted).toBe(true)
    useSettingsStore.setState({ assist: 'off' })
    g().beginCampaign(79, { kind: 'standard' }, { company: 'silk', crates: 0 })
    expect(g().assisted).toBe(false)
  })

  it('the mark rides the snapshot, validated: only a literal true reads back as assisted', () => {
    g().beginCampaign(80, { kind: 'standard' }, { company: 'silk', crates: 0 })
    g().pickStartingHero('pick-0')
    useSettingsStore.setState({ assist: 'steady' })
    useSettingsStore.setState({ assist: 'off' })
    const snap = captureRun(g(), { rngLoot: null, rngMap: null, lootPity: 0, idCounter: 0, nameCounters: {} } as never)
    expect(snap.assisted).toBe(true)
    expect(migrateSnapshot(JSON.parse(JSON.stringify(snap)))!.assisted).toBe(true)
    expect(migrateSnapshot(JSON.parse(JSON.stringify({ ...snap, assisted: 'true' })))!.assisted).toBe(false)
    const { assisted: _gone, ...older } = snap
    expect(migrateSnapshot(JSON.parse(JSON.stringify({ ...older, v: 18 })))!.assisted).toBe(false)
    // Resumed with the dial off, it stays marked.
    g().resumeRun(migrateSnapshot(JSON.parse(JSON.stringify(snap)))!)
    expect(g().assisted).toBe(true)
  })

  it('an assisted settle keeps every reward and leaves the records alone', () => {
    const meta = useMetaStore.getState()
    const before = { ...meta.stats }
    const contract = { company: 'silk' as const, crates: 0, status: 'delivered' as const }
    const ranked = { depth: 12, won: true, kills: 90, contract, deposit: 300 }
    // An assisted delivery: gold and standing land; best depth and the stake record do not move.
    const bankBefore = useMetaStore.getState().bank
    useMetaStore.getState().settleContract({ ...ranked, rankable: false })
    const after = useMetaStore.getState()
    expect(after.bank).toBeGreaterThan(bankBefore)
    expect(after.standing.silk).toBeGreaterThan(0)
    expect(after.stats.runsCompleted).toBe(before.runsCompleted + 1)
    expect(after.stats.bestDepth).toBe(before.bestDepth)
    expect(after.record['0']).toBeUndefined()
    // The same delivery unassisted is a record.
    useMetaStore.getState().settleContract({ ...ranked, rankable: true })
    expect(useMetaStore.getState().stats.bestDepth).toBe(12)
    expect(useMetaStore.getState().record['0']).toEqual({ runs: 1, delivered: 1 })
  })
})
