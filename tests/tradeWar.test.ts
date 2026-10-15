import { beforeEach, describe, expect, it } from 'vitest'
import { COMPANY_IDS, type CompanyId } from '../src/game/data/companies'
import { BASIC_ITEM_KINDS, itemKindById, ITEM_KINDS } from '../src/game/data/itemKinds'
import {
  cashOutValue,
  cityPay,
  contractRules,
  DESPERATE_PAY,
  DESPERATE_STRENGTH,
  freshContract,
  MARKET_FROM_RUN,
  stakeRules,
} from '../src/game/run/contracts'
import {
  contractsLeft,
  DELIVERED_SHARE,
  endSeason,
  fitShares,
  freshSeason,
  isDesperate,
  LOST_SHARE,
  moveShares,
  patronStatus,
  PATRON_PURSE,
  placeOf,
  readSeason,
  recordContract,
  regressShares,
  seasonLast,
  seasonLeader,
  seasonBars,
  seasonPatron,
  SEASON_LENGTH,
  seasonOver,
  SHARE_FLOOR,
  shareMove,
  sharesValid,
  vaultPicks,
  VAULT_PICKS,
  type Season,
  type WarContract,
} from '../src/game/run/tradeWar'
import { standingXpFor } from '../src/game/run/standing'
import { META_VERSION, migrateMeta, useMetaStore } from '../src/state/metaStore'
import { migrateContract } from '../src/state/runSnapshot'
import { hashSeed, RNG } from '../src/game/core/rng'

/*
 * The trade war (Draft 4 § D): seasons of seven contracts, market share that
 * moves and always sums to 100, the leader (outright only), your patron and
 * what it pays at the season's end, desperate terms for the last, and the save.
 */
const sum = (s: Record<string, number>) => Object.values(s).reduce((a, b) => a + b, 0)
const deliver = (company: CompanyId, crates = 0): WarContract => ({ company, crates, status: 'delivered' })
const play = (s: Season, list: WarContract[]): Season => list.reduce(recordContract, s)

describe('market share', () => {
  it('starts even: 20 each, summing to 100', () => {
    const s = freshSeason()
    expect(COMPANY_IDS.map((c) => s.shares[c])).toEqual([20, 20, 20, 20, 20])
    expect(s).toMatchObject({ n: 1, contracts: 0, desperate: null, ended: null })
  })

  it('a delivery takes points for its company, evenly from the others; a bigger stake takes more', () => {
    expect(shareMove('delivered', 0)).toBe(DELIVERED_SHARE)
    expect(shareMove('delivered', 4)).toBe(DELIVERED_SHARE + 2)
    expect(shareMove('cashedOut', 6)).toBe(2)
    expect(shareMove('lost', 8)).toBe(-LOST_SHARE)
    const s = moveShares(freshSeason().shares, 'metals', 4)
    expect(s).toEqual({ spice: 19, art: 19, metals: 24, silk: 19, scrolls: 19 })
    // A fall hands its points to the smallest shares.
    const f = moveShares(s, 'metals', -2)
    expect(f.metals).toBe(22)
    expect(sum(f)).toBe(100)
  })

  it('shares stay whole, at or above the floor, and sum to 100 through any run of contracts', () => {
    const rng = new RNG(hashSeed('trade-war-test'))
    let s = freshSeason()
    for (let i = 0; i < 500; i++) {
      const c = COMPANY_IDS[Math.floor(rng.next() * COMPANY_IDS.length)]
      const status = (['delivered', 'cashedOut', 'lost'] as const)[Math.floor(rng.next() * 3)]
      s = recordContract({ ...s, contracts: 0 }, { company: c, crates: Math.floor(rng.next() * 9), status })
      expect(sharesValid(s.shares)).toBe(true)
      expect(sum(s.shares)).toBe(100)
      for (const v of Object.values(s.shares)) expect(v).toBeGreaterThanOrEqual(SHARE_FLOOR)
    }
    // A long run of deliveries for one company runs the others down to the floor, never past it.
    let one = freshSeason().shares
    for (let i = 0; i < 40; i++) one = moveShares(one, 'spice', 8)
    expect(one).toEqual({ spice: 100 - 4 * SHARE_FLOOR, art: SHARE_FLOOR, metals: SHARE_FLOOR, silk: SHARE_FLOOR, scrolls: SHARE_FLOOR })
  })

  it('the Sovereign Route counts toward the season but moves no share', () => {
    const s = recordContract(freshSeason(), { company: null, crates: 0, status: 'delivered', charter: true })
    expect(s.contracts).toBe(1)
    expect(s.shares).toEqual(freshSeason().shares)
    expect(sum(s.deliveries)).toBe(0)
  })

  it('remembers the shares before the last contract (the standings’ trend) and tallies deliveries', () => {
    const s = play(freshSeason(), [deliver('art'), { company: 'art', crates: 0, status: 'lost' }, deliver('art', 2)])
    expect(s.deliveries.art).toBe(2)
    expect(s.log).toEqual(['art', null, 'art'])
    expect(s.shares.art - s.before.art).toBe(DELIVERED_SHARE + 1)
    expect(contractsLeft(s)).toBe(SEASON_LENGTH - 3)
  })

  it('fitShares makes any table whole and summing to 100; regression halves the gap to even', () => {
    expect(sum(fitShares({ spice: 1.5, art: 7, metals: -3, silk: NaN }))).toBe(100)
    expect(sharesValid(fitShares({}))).toBe(true)
    const r = regressShares({ spice: 44, art: 14, metals: 14, silk: 14, scrolls: 14 })
    expect(sum(r)).toBe(100)
    expect(r.spice).toBe(32)
    // The order holds: the leader still leads.
    expect(seasonLeader({ shares: r })).toBe('spice')
  })
})

describe('the season’s end', () => {
  const seven = (who: CompanyId, delivered: number, other: CompanyId = 'art'): Season =>
    play(freshSeason(), [...Array.from({ length: delivered }, () => deliver(who)), ...Array.from({ length: SEASON_LENGTH - delivered }, () => ({ company: other, crates: 0, status: 'lost' as const }))])

  it('ends at the seventh contract', () => {
    const s = seven('metals', 3)
    expect(s.contracts).toBe(SEASON_LENGTH)
    expect(seasonOver(s)).toBe(true)
    expect(seasonOver({ contracts: SEASON_LENGTH - 1 })).toBe(false)
  })

  it('your patron is the company you delivered the most for — leader or not — and pays a purse per delivery and a pick of three from its vault', () => {
    // Three Moonquill deliveries and four Peppercorn cash-outs: you delivered most for Moonquill.
    const s = play(freshSeason(), [deliver('scrolls'), deliver('scrolls'), deliver('scrolls'), ...Array.from({ length: 4 }, () => ({ company: 'spice' as const, crates: 0, status: 'cashedOut' as const }))])
    expect(seasonPatron(s)).toBe('scrolls')
    const { end, next } = endSeason(s, { haveItems: [] })
    expect(end).toMatchObject({ n: 1, patron: 'scrolls', delivered: 3, purse: 3 * PATRON_PURSE })
    expect(end.vault).toHaveLength(VAULT_PICKS)
    for (const v of end.vault) {
      expect(itemKindById(v.kind)!.company).toBe('scrolls')
      expect(itemKindById(v.kind)!.level).toBeLessThanOrEqual(3)
    }
    // The locked kinds come first; the basics are owned, so never a fresh unlock.
    expect(end.vault.every((v) => v.unlock)).toBe(true)
    expect(end.vault.some((v) => BASIC_ITEM_KINDS.includes(v.kind))).toBe(false)
    // The next season: number, tallies cleared, shares regressed, the page waiting.
    expect(next).toMatchObject({ n: 2, contracts: 0, ended: end })
    expect(sum(next.deliveries)).toBe(0)
    expect(sum(next.shares)).toBe(100)
  })

  it('a patron need not lead: one delivery is enough, and the leader pays nothing', () => {
    const s = play(freshSeason(), [deliver('silk', 8), ...Array.from({ length: 6 }, () => ({ company: 'spice' as const, crates: 0, status: 'cashedOut' as const }))])
    // Peppercorn's six cash-outs (+12) outrun Rosethread's one big delivery (+8).
    expect(seasonLeader(s)).toBe('spice')
    const { end } = endSeason(s, { haveItems: [] })
    expect(end).toMatchObject({ leader: 'spice', patron: 'silk', delivered: 1, purse: PATRON_PURSE })
    expect(end.vault.every((v) => itemKindById(v.kind)!.company === 'silk')).toBe(true)
  })

  it('no delivery this season, no patron: nothing is paid', () => {
    const s = play(freshSeason(), Array.from({ length: SEASON_LENGTH }, () => ({ company: 'art' as const, crates: 0, status: 'cashedOut' as const })))
    expect(seasonPatron(s)).toBeNull()
    const { end } = endSeason(s, { haveItems: [] })
    expect(end).toMatchObject({ patron: null, delivered: 0, purse: 0, vault: [] })
  })

  it('a tie on your deliveries goes to the bigger share, then a hash of the season', () => {
    // Two each for Ironvein and Easel House; Ironvein's bigger stakes took more share.
    const s = play(freshSeason(), [deliver('metals', 4), deliver('art'), deliver('metals', 4), deliver('art')])
    expect(s.shares.metals).toBeGreaterThan(s.shares.art)
    expect(seasonPatron(s)).toBe('metals')
    // Level on share too: a hash of the season, the same every time.
    const flat = { ...freshSeason(), deliveries: { ...freshSeason().deliveries, metals: 1, art: 1 } }
    const pick = seasonPatron(flat)
    expect(['metals', 'art']).toContain(pick)
    expect(seasonPatron({ ...flat })).toBe(pick)
  })

  it('the vault offers owned kinds as Rare bonus items once every kind of its own is unlocked', () => {
    const own = ITEM_KINDS.filter((k) => k.company === 'silk' && k.level <= 3).map((k) => k.id)
    const picks = vaultPicks('silk', own, 4)
    expect(picks).toHaveLength(Math.min(VAULT_PICKS, own.length))
    expect(picks.every((p) => !p.unlock)).toBe(true)
    // Deterministic: a hash of its parts.
    expect(vaultPicks('silk', own, 4)).toEqual(picks)
  })

  it('the last company that hires you posts desperate terms; never the leader', () => {
    const s = seven('metals', 4)
    const all = seasonLast(s)
    expect(all).not.toBe('metals')
    expect(all).not.toBeNull()
    // Moonquill is not hiring yet: the last that hires you is someone else.
    const hiring = seasonLast(s, (c) => c !== 'scrolls')
    expect(hiring).not.toBe('scrolls')
    expect(endSeason(s, { haveItems: [], open: (c) => c !== 'scrolls' }).next.desperate).toBe(hiring)
    // The art road fell five times this season: it is last.
    const fell = play(freshSeason(), [deliver('metals'), deliver('metals'), ...Array.from({ length: 5 }, () => ({ company: 'art' as const, crates: 0, status: 'lost' as const }))])
    expect(seasonLast(fell)).toBe('art')
  })

  it('no last place when every company that hires you is level', () => {
    expect(seasonLast(freshSeason())).toBeNull()
    // Only Peppercorn hires you: no other company can be last.
    const s = seven('spice', 3)
    expect(seasonLast(s, (c) => c === 'spice')).toBeNull()
  })
})

describe('the season’s log and its seven bars', () => {
  it('logs each finished contract in order: the company delivered for, else null (a cash-out, a fall, your own road)', () => {
    const s = play(freshSeason(), [
      deliver('metals'),
      { company: 'spice', crates: 0, status: 'cashedOut' },
      { company: null, crates: 0, status: 'delivered', charter: true },
      deliver('silk'),
      { company: 'art', crates: 0, status: 'lost' },
    ])
    expect(s.log).toEqual(['metals', null, null, 'silk', null])
    expect(s.log).toHaveLength(s.contracts)
    expect(seasonBars(s)).toEqual(['metals', 'miss', 'miss', 'silk', 'miss', null, null])
    expect(seasonBars(freshSeason())).toEqual(Array(SEASON_LENGTH).fill(null))
  })

  it('a new season starts its log empty', () => {
    const s = play(freshSeason(), Array.from({ length: SEASON_LENGTH }, () => deliver('metals')))
    expect(s.log).toHaveLength(SEASON_LENGTH)
    expect(endSeason(s, { haveItems: [] }).next.log).toEqual([])
  })

  it('an older save, with no log, has one rebuilt from its deliveries: deliveries first, in catalogue order, then misses', () => {
    const r = readSeason({ n: 2, contracts: 5, deliveries: { metals: 2, spice: 1 } })
    expect(r.log).toEqual(['spice', 'metals', 'metals', null, null])
    // A log that does not tally to the deliveries is rebuilt; unknown ids read as misses; it is clipped to the contracts.
    expect(readSeason({ contracts: 3, deliveries: { art: 1 }, log: ['nope', 'art', null, 'art'] }).log).toEqual([null, 'art', null])
    expect(readSeason({ contracts: 2, deliveries: { art: 1 }, log: ['metals', 'art'] }).log).toEqual(['art', null])
  })
})

describe('the leader', () => {
  it('leads outright or not at all: a tie at the top — the even start too — crowns nobody', () => {
    expect(seasonLeader(freshSeason())).toBeNull()
    const tie = { spice: 30, art: 10, metals: 30, silk: 14, scrolls: 16 }
    expect(seasonLeader({ shares: tie })).toBeNull()
    expect(seasonLeader({ shares: { ...tie, metals: 31, art: 9 } })).toBe('metals')
    // A season that ends level: no leader on its page, and the patron still pays.
    const s = { ...play(freshSeason(), Array.from({ length: SEASON_LENGTH - 1 }, () => ({ company: null, crates: 0, status: 'delivered' as const, charter: true }))), deliveries: freshSeason().deliveries }
    const ended = endSeason(recordContract(s, { company: null, crates: 0, status: 'delivered', charter: true }), { haveItems: [] })
    expect(ended.end.leader).toBeNull()
  })

  it('level shares share a place', () => {
    const s = { shares: { spice: 30, art: 10, metals: 30, silk: 14, scrolls: 16 } }
    expect(COMPANY_IDS.map((c) => placeOf(s, c))).toEqual([1, 5, 1, 4, 3])
    expect(COMPANY_IDS.every((c) => placeOf(freshSeason(), c) === 1)).toBe(true)
  })
})

describe('the standings card: where you stand with your patron', () => {
  it('no delivery yet', () => {
    const st = patronStatus(freshSeason())
    expect(st).toMatchObject({ state: 'none', patron: null, delivered: 0, purse: 0, level: [], left: SEASON_LENGTH, lastContract: false })
  })

  it('one company ahead in your deliveries: what it would pay now', () => {
    const s = play(freshSeason(), [deliver('metals'), deliver('silk'), deliver('metals')])
    expect(patronStatus(s)).toMatchObject({ state: 'ahead', patron: 'metals', delivered: 2, purse: 2 * PATRON_PURSE, level: [], breaksBy: null, left: SEASON_LENGTH - 3 })
  })

  it('tied in your deliveries: the bigger share takes it, said as such; level shares fall to the hash', () => {
    const s = play(freshSeason(), [deliver('metals', 8), deliver('art')])
    expect(s.shares.metals).toBeGreaterThan(s.shares.art)
    expect(patronStatus(s)).toMatchObject({ state: 'tied', patron: 'metals', delivered: 1, purse: PATRON_PURSE, level: ['metals', 'art'], breaksBy: 'share' })
    const flat = { ...freshSeason(), contracts: 2, deliveries: { ...freshSeason().deliveries, metals: 1, art: 1 } }
    expect(patronStatus(flat)).toMatchObject({ state: 'tied', breaksBy: 'hash' })
  })

  it('the season’s last contract', () => {
    const s = play(freshSeason(), Array.from({ length: SEASON_LENGTH - 1 }, () => deliver('spice')))
    expect(patronStatus(s)).toMatchObject({ state: 'ahead', left: 1, lastContract: true })
    expect(patronStatus({ ...freshSeason(), contracts: SEASON_LENGTH - 1 })).toMatchObject({ state: 'none', lastContract: true })
  })
})

describe('desperate terms', () => {
  it('pay ×1.5 at every city and on a cash-out, on top of the market', () => {
    const t = { company: 'metals' as const, crates: 4, market: 1 }
    for (let city = 0; city < 3; city++) {
      const plain = cityPay(t, city, 100)
      const hot = cityPay({ ...t, desperate: true }, city, 100)
      expect(hot.fee).toBe(Math.round(plain.fee * DESPERATE_PAY))
      expect(hot.total).toBeGreaterThanOrEqual(Math.round(plain.total * DESPERATE_PAY) - 2)
    }
    expect(cashOutValue({ ...t, desperate: true }, 1)).toBe(Math.round(cashOutValue(t, 1) * DESPERATE_PAY))
    // Never on the Sovereign Route.
    expect(cityPay({ company: null, crates: 0, market: 1, charter: true, desperate: true }, 2).total).toBe(cityPay({ company: null, crates: 0, market: 1, charter: true }, 2).total)
  })

  it('make its raiders 20% stronger from the first fight, the stake’s step unchanged', () => {
    const r = contractRules({ crates: 3, desperate: true })
    expect(r.startThreat).toBe(DESPERATE_STRENGTH)
    expect({ ...r, startThreat: 1 }).toEqual(stakeRules(3))
    // Ordinary terms are exactly what they were.
    expect(contractRules({ crates: 3 })).toEqual(stakeRules(3))
  })

  it('are signed onto the contract only for the desperate company', () => {
    const s = { ...freshSeason(), desperate: 'art' as const }
    expect(isDesperate(s, 'art')).toBe(true)
    expect(isDesperate(s, 'metals')).toBe(false)
    expect(isDesperate(s, null)).toBe(false)
    expect(freshContract({ company: 'art', crates: 0, market: 1, desperate: true }).desperate).toBe(true)
    expect('desperate' in freshContract({ company: 'art', crates: 0, market: 1 })).toBe(false)
    expect('desperate' in freshContract({ company: null, crates: 0, market: 1, charter: true, desperate: true })).toBe(false)
  })

  it('a resumed run keeps them only as a strict true', () => {
    const base = freshContract({ company: 'art', crates: 2, market: 1, desperate: true })
    expect(migrateContract(base, { nodes: [] }, []).desperate).toBe(true)
    expect('desperate' in migrateContract({ ...base, desperate: 'yes' }, { nodes: [] }, [])).toBe(false)
    expect('desperate' in migrateContract({ ...base, desperate: undefined }, { nodes: [] }, [])).toBe(false)
  })
})

describe('the save (meta v14)', () => {
  it('an older save starts the war at season 1, even', () => {
    expect(META_VERSION).toBeGreaterThanOrEqual(14)
    const m = migrateMeta({ bank: 400 }, 12)
    expect(m.season).toEqual(freshSeason())
    expect(migrateMeta({ bank: 400 }, 13).season).toEqual(freshSeason())
  })

  it('validates every field', () => {
    const r = readSeason({
      n: -3,
      contracts: 99,
      shares: { spice: 90, art: 90, metals: 'x' },
      deliveries: { spice: 50, art: 2, nope: 4 },
      exclusive: 'metals',
      desperate: 'art',
      ended: { leader: 'metals', patron: 'metals', delivered: 2, purse: 99999, vault: [{ kind: 'Pavise', unlock: true }, { kind: 'Bow', unlock: true }, { kind: 'nope' }], shares: {} },
    })
    expect(r.n).toBe(1)
    expect(r.contracts).toBe(SEASON_LENGTH - 1)
    expect(sharesValid(r.shares)).toBe(true)
    expect(sum(r.deliveries)).toBeLessThanOrEqual(r.contracts)
    // An exclusive (cut in October 2026) is read past and dropped.
    expect('exclusive' in r).toBe(false)
    expect(r.desperate).toBe('art')
    // The end as the rules could have written it: its purse capped, its vault the patron's own kinds,
    // and no crown on even shares.
    expect(r.ended!.purse).toBe(2 * PATRON_PURSE)
    expect(r.ended!.vault.map((v) => v.kind)).toEqual(['Pavise'])
    expect(r.ended!.leader).toBeNull()
  })

  it('a season’s end from before the simplification: a champion’s leader reads as your patron; one that paid nothing is no page', () => {
    const shares = { spice: 16, art: 16, metals: 36, silk: 16, scrolls: 16 }
    const paid = readSeason({ ended: { n: 3, leader: 'metals', share: 36, delivered: 3, champion: true, purse: 225, vault: [{ kind: 'Pavise', unlock: true }], desperate: 'silk', shares } }).ended
    expect(paid).toMatchObject({ n: 3, leader: 'metals', patron: 'metals', delivered: 3, purse: 225, desperate: 'silk' })
    expect(paid!.vault.map((v) => v.kind)).toEqual(['Pavise'])
    expect(readSeason({ ended: { n: 3, leader: 'metals', delivered: 1, champion: false, purse: 0, vault: [], desperate: 'silk', shares } }).ended).toBeNull()
    // The v15 save as it was: an exclusive signed mid-season.
    const v15 = migrateMeta({ bank: 400, season: { n: 2, contracts: 3, shares, before: shares, deliveries: { metals: 2 }, exclusive: 'metals', desperate: null, ended: null } }, 15)
    expect('exclusive' in v15.season).toBe(false)
    expect(v15.season).toMatchObject({ n: 2, contracts: 3, desperate: null })
    expect(v15.season.deliveries.metals).toBe(2)
  })

  it('survives random garbage', () => {
    const rng = new RNG(hashSeed('season-fuzz'))
    // Mid-season, with the last season's page still waiting: every field filled.
    const ended = endSeason(play(freshSeason(), Array.from({ length: SEASON_LENGTH }, () => deliver('metals', 3))), { haveItems: [] }).next
    const base = play(ended, [deliver('art'), { company: 'silk', crates: 0, status: 'lost' }, deliver('silk', 2), deliver('art')])
    const junk = [null, undefined, -1, 1e12, NaN, 'x', {}, [], true, 3.7, 'metals']
    for (let i = 0; i < 3000; i++) {
      const raw = JSON.parse(JSON.stringify(base)) as Record<string, unknown>
      const keys = ['n', 'contracts', 'shares', 'before', 'deliveries', 'log', 'exclusive', 'desperate', 'ended']
      const k = keys[Math.floor(rng.next() * keys.length)]
      const v = junk[Math.floor(rng.next() * junk.length)]
      if (rng.next() < 0.5 && raw[k] && typeof raw[k] === 'object') {
        const inner = raw[k] as Record<string, unknown>
        const ik = Object.keys(inner)[Math.floor(rng.next() * Math.max(1, Object.keys(inner).length))]
        if (ik) inner[ik] = v
      } else raw[k] = v
      const s = readSeason(raw)
      expect(sharesValid(s.shares)).toBe(true)
      expect(sharesValid(s.before)).toBe(true)
      expect(Number.isInteger(s.n) && s.n >= 1).toBe(true)
      expect(s.contracts).toBeGreaterThanOrEqual(0)
      expect(s.contracts).toBeLessThan(SEASON_LENGTH)
      for (const c of COMPANY_IDS) expect(Number.isInteger(s.deliveries[c])).toBe(true)
      expect('exclusive' in s).toBe(false)
      expect(s.log).toHaveLength(s.contracts)
      for (const c of COMPANY_IDS) expect(s.log.filter((x) => x === c).length).toBe(s.deliveries[c])
      expect(seasonBars(s)).toHaveLength(SEASON_LENGTH)
      if (s.ended) {
        expect(Number.isFinite(s.ended.purse)).toBe(true)
        expect(s.ended.purse).toBeLessThanOrEqual(PATRON_PURSE * SEASON_LENGTH)
        expect(s.ended.purse).toBeLessThanOrEqual(PATRON_PURSE * s.ended.delivered)
        if (!s.ended.patron) expect(s.ended.vault).toEqual([])
        if (s.ended.leader) expect(seasonLeader({ shares: s.ended.shares })).toBe(s.ended.leader)
      }
    }
  })
})

describe('the store: settles count, pay and close a season', () => {
  beforeEach(() => useMetaStore.getState().resetMeta())
  const settle = (company: CompanyId | null, status: 'delivered' | 'cashedOut' | 'lost' = 'delivered', unranked = false) =>
    useMetaStore.getState().settleContract({ depth: 12, kills: 200, won: status === 'delivered', contract: { company, crates: 0, status, ...(company ? {} : { charter: true }) }, deposit: 0, unranked })
  const veteran = () => useMetaStore.setState((s) => ({ stats: { ...s.stats, runsCompleted: MARKET_FROM_RUN } }))

  it('before the market opens no contract counts', () => {
    settle('metals')
    expect(useMetaStore.getState().season).toEqual(freshSeason())
  })

  it('from the market’s opening each ranked contract counts; a custom seed does not', () => {
    veteran()
    settle('metals')
    settle('metals', 'delivered', true)
    const s = useMetaStore.getState().season
    expect(s.contracts).toBe(1)
    expect(s.shares.metals).toBe(20 + DELIVERED_SHARE)
  })

  it('the seventh contract ends the season: your patron’s purse banked, the vault pick waiting, desperate terms posted', () => {
    veteran()
    const bank0 = useMetaStore.getState().bank
    // Each settle's own deposit (its interest) is returned; the patron's purse comes on top.
    let banked = 0
    for (let i = 0; i < SEASON_LENGTH; i++) banked += settle('metals')
    const m = useMetaStore.getState()
    expect(m.season.n).toBe(2)
    expect(m.season.ended).toMatchObject({ leader: 'metals', patron: 'metals', delivered: SEASON_LENGTH, purse: SEASON_LENGTH * PATRON_PURSE })
    expect(m.bank).toBe(bank0 + banked + SEASON_LENGTH * PATRON_PURSE)
    expect(m.season.desperate).not.toBeNull()
    expect(m.season.desperate).not.toBe('metals')
    // The page closes only with a pick from the vault; a locked kind is unlocked.
    const pick = m.season.ended!.vault[0]
    useMetaStore.getState().closeSeasonEnd(null)
    expect(useMetaStore.getState().season.ended).not.toBeNull()
    useMetaStore.getState().closeSeasonEnd(pick.kind)
    expect(useMetaStore.getState().season.ended).toBeNull()
    if (pick.unlock) expect(useMetaStore.getState().items).toContain(pick.kind)
    else expect(useMetaStore.getState().bonusItems).toContain(pick.kind)
  })

  it('a contract pays its company the same standing whatever the season holds', () => {
    veteran()
    settle('metals')
    expect(useMetaStore.getState().standing.metals).toBe(standingXpFor({ depth: 12, kills: 200, delivered: true }))
  })

  it('the Sovereign Route counts and moves nothing', () => {
    veteran()
    settle(null)
    const s = useMetaStore.getState().season
    expect(s.contracts).toBe(1)
    expect(s.shares).toEqual(freshSeason().shares)
  })
})
