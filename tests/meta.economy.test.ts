import { beforeEach, describe, expect, it } from 'vitest'
import { RANDOM_UNLOCK_SKILLS, skillById } from '../src/game/data/skills'
import { itemKindById, UNLOCK_ITEM_KINDS } from '../src/game/data/itemKinds'
import { COMPANY_IDS } from '../src/game/data/companies'
import { watchLevelFor } from '../src/game/run/watch'
import { standingFor, standingXpFor, standingXpToReach } from '../src/game/run/standing'
import { contractGrant, planPayout, runDeposit } from '../src/game/run/settle'
import { freshContract } from '../src/game/run/contracts'
import { STANDARD_RUN, SEEDED_RUN } from '../src/state/seeds'
import { lastProgress, legacyBannerRefund, META_VERSION, migrateMeta, NEW_BANK, retroWatchXp, useMetaStore } from '../src/state/metaStore'

/** The mercenary company: the bank, standing, and what a finished contract pays. */
const contract = (crates: number, status: 'delivered' | 'cashedOut' | 'lost', company = 'metals' as const) => ({ company, crates, status })

describe('the ledger: settleContract', () => {
  beforeEach(() => useMetaStore.getState().resetMeta())

  it('a new militia starts with a bank, and a settle banks exactly the deposit (plus feats)', () => {
    expect(useMetaStore.getState().bank).toBe(NEW_BANK)
    const got = useMetaStore.getState().settleContract({ depth: 3, kills: 20, won: false, contract: contract(0, 'lost'), deposit: 75 })
    expect(got).toBe(75)
    expect(useMetaStore.getState().bank).toBe(NEW_BANK + 75)
  })

  it('pays standing XP to the contract’s company only, and a card per standing level crossed', () => {
    const xp = standingXpFor({ depth: 12, kills: 400, delivered: true })
    useMetaStore.getState().settleContract({ depth: 12, kills: 400, won: true, contract: contract(0, 'delivered'), deposit: 0 })
    const s = useMetaStore.getState()
    expect(s.standing.metals).toBe(xp)
    for (const c of COMPANY_IDS) if (c !== 'metals') expect(s.standing[c]).toBe(0)
    const p = lastProgress.run!
    expect(p.standingAfter).toBe(standingFor(xp))
    expect(p.standingCards).toHaveLength(p.standingAfter - p.standingBefore)
    // The company's own cards come first.
    for (const id of p.standingCards) expect(skillById(id)!.company).toBe('metals')
  })

  it('a delivery unlocks the contract’s skill and item, plus a skill per milestone and the stake’s item chances', () => {
    useMetaStore.getState().settleContract({ depth: 12, kills: 0, won: true, contract: contract(5, 'delivered'), deposit: 0 })
    const p = lastProgress.run!
    expect(p.contractCards).toHaveLength(1 + 2) // milestones at 2 and 5
    expect(p.items).toHaveLength(1 + 2) // floor(5 / 2) item chances
    // The floor rises with the stake: 5 crates deal Level 2 and up while any are left.
    for (const id of p.contractCards) expect(skillById(id)!.level).toBeGreaterThanOrEqual(2)
    for (const id of p.items) expect(itemKindById(id)!.level).toBeGreaterThanOrEqual(2)
    const s = useMetaStore.getState()
    expect(s.items).toEqual(p.items)
    expect(new Set(s.skills).size).toBe(s.skills.length)
  })

  it('a cash-out keeps standing but unlocks no contract skill or item; a fall likewise', () => {
    for (const status of ['cashedOut', 'lost'] as const) {
      useMetaStore.getState().resetMeta()
      useMetaStore.getState().settleContract({ depth: 8, kills: 100, won: false, contract: contract(4, status), deposit: 10 })
      const p = lastProgress.run!
      expect(p.xp).toBeGreaterThan(0)
      expect(p.contractCards).toEqual([])
      expect(p.items).toEqual([])
    }
  })

  it('a custom seed pays its gold and earns nothing else', () => {
    useMetaStore.getState().settleContract({ depth: 12, kills: 400, won: true, contract: contract(4, 'delivered'), deposit: 90, unranked: true })
    const s = useMetaStore.getState()
    expect(s.bank).toBe(NEW_BANK + 90)
    expect(s.standing.metals).toBe(0)
    expect(s.skills).toEqual([])
    expect(lastProgress.run!.unranked).toBe(true)
  })

  it('keeps the record by stake: runs finished and delivered', () => {
    const m = useMetaStore.getState()
    m.settleContract({ depth: 12, kills: 0, won: true, contract: contract(3, 'delivered'), deposit: 0 })
    m.settleContract({ depth: 5, kills: 0, won: false, contract: contract(3, 'lost'), deposit: 0 })
    expect(useMetaStore.getState().record['3']).toEqual({ runs: 2, delivered: 1 })
    expect(useMetaStore.getState().stats.bestStake).toBe(3)
  })

  it('the bank refuses a withdrawal it cannot cover', () => {
    expect(useMetaStore.getState().withdraw(NEW_BANK + 1)).toBe(false)
    expect(useMetaStore.getState().bank).toBe(NEW_BANK)
    expect(useMetaStore.getState().withdraw(40)).toBe(true)
    expect(useMetaStore.getState().bank).toBe(NEW_BANK - 40)
  })

  it('every random card and kind is eventually unlocked once, and then nothing more', () => {
    for (let i = 0; i < 120; i++) useMetaStore.getState().settleContract({ depth: 12, kills: 900, won: true, contract: contract(8, 'delivered', COMPANY_IDS[i % 5] as 'metals'), deposit: 0 })
    const s = useMetaStore.getState()
    expect(new Set(s.skills).size).toBe(RANDOM_UNLOCK_SKILLS.length)
    expect(new Set(s.items).size).toBe(UNLOCK_ITEM_KINDS.length)
  })
})

describe('the settle plan', () => {
  const base = { depth: 0, kills: 0, gold: 80, challenge: STANDARD_RUN }
  it('an unsigned contract takes and returns nothing', () => {
    expect(planPayout({ ...base, contract: freshContract({ company: 'art', crates: 2, market: 1 }, 60) })).toEqual({ kind: 'none' })
  })
  it('a signed contract walked away from before it was played sends its purse home', () => {
    const c = { ...freshContract({ company: 'art', crates: 2, market: 1 }, 60), signed: true }
    expect(planPayout({ ...base, contract: c })).toEqual({ kind: 'deposit', amount: 80 })
  })
  it('a fall keeps the cities’ pay and the purse', () => {
    const c = { ...freshContract({ company: 'art', crates: 2, market: 1 }, 60), signed: true, paid: [150, 90], cargoAt: [100, 80] }
    expect(runDeposit({ gold: 30, contract: c })).toBe(270)
    const g = contractGrant({ ...base, depth: 9, gold: 30, contract: c }, 'lost')
    expect(g.deposit).toBe(270)
    expect(g.won).toBe(false)
  })
  it('a custom seed’s grant is unranked; a pre-contract run is owed its old Marks as gold', () => {
    expect(contractGrant({ ...base, challenge: SEEDED_RUN, contract: null }, 'lost').unranked).toBe(true)
    expect(runDeposit({ gold: 999, contract: null, legacyGold: 64 })).toBe(64)
  })
})

describe('save migration v7 → v8 (the mercenary company)', () => {
  it('Marks become gold in the bank, one for one, never below a new militia’s bank', () => {
    expect(migrateMeta({ watchMarks: 640, stats: { runsCompleted: 3 } }, 7).bank).toBe(640)
    expect(migrateMeta({ watchMarks: 12, stats: { runsCompleted: 3 } }, 7).bank).toBe(NEW_BANK)
  })

  it('Watch XP is spread evenly over the companies, and every unlock is kept', () => {
    const m = migrateMeta({ watchXp: 1000, skills: ['charge', 'wildfire'], items: ['Axe'], topDifficulty: 3, daily: { date: '2026-10-01' } }, 7)
    expect(Object.values(m.standing)).toEqual([200, 200, 200, 200, 200])
    expect(m.skills).toEqual(['charge', 'wildfire'])
    expect(m.items).toEqual(['Axe'])
    expect('topDifficulty' in m).toBe(false)
    expect('daily' in m).toBe(false)
  })

  it('a current save keeps its bank and standing, scrubbed', () => {
    const m = migrateMeta({ bank: 900, standing: { spice: 300, art: -4, nope: 99 }, record: { '2': { runs: 3, delivered: 9 }, '40': { runs: 1, delivered: 1 }, x: 1 } }, META_VERSION)
    expect(m.bank).toBe(900)
    expect(m.standing.spice).toBe(300)
    expect(m.standing.art).toBe(0)
    expect(m.record).toEqual({ '2': { runs: 3, delivered: 3 } })
    expect(migrateMeta({ bank: 'lots' }, META_VERSION).bank).toBe(NEW_BANK)
  })

  it('older steps still apply on the way: the v6 credit and the v3 refund (as gold)', () => {
    const stats = { totalKills: 2000, runsWon: 2, runsCompleted: 10 }
    const m = migrateMeta({ stats }, 5)
    const xp = retroWatchXp(stats)
    expect(m.skills).toHaveLength(watchLevelFor(xp) - 1)
    expect(Object.values(m.standing).reduce((a, b) => a + b, 0)).toBe(Math.floor(xp / 5) * 5)
    expect(legacyBannerRefund(2)).toBe(550)
    expect(migrateMeta({ watchMarks: 40, sacrificeTier: 2, stats: {} }, 2).bank).toBe(590)
    expect(standingXpToReach(1)).toBe(80)
  })
})
