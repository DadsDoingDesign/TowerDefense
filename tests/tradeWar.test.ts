import { beforeEach, describe, expect, it } from 'vitest'
import { COMPANIES, COMPANY_IDS, rivalOf, type CompanyId } from '../src/game/data/companies'
import { BASIC_ITEM_KINDS, itemKindById, ITEM_KINDS } from '../src/game/data/itemKinds'
import {
  cashOutValue,
  cityPay,
  contractRules,
  crateCap,
  DESPERATE_PAY,
  DESPERATE_STRENGTH,
  freshContract,
  MARKET_FROM_RUN,
  stakeRules,
} from '../src/game/run/contracts'
import {
  CHAMPION_MIN,
  CHAMPION_PURSE,
  contractsLeft,
  DELIVERED_SHARE,
  endSeason,
  EXCLUSIVE_XP,
  EXCLUSIVE_XP_UNRIVALLED,
  exclusiveXpMult,
  fitShares,
  freshSeason,
  isCold,
  isDesperate,
  LOST_SHARE,
  moveShares,
  readSeason,
  recordContract,
  regressShares,
  seasonCrateCap,
  seasonLast,
  seasonLeader,
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
 * moves and always sums to 100, the season's end (the champion's purse and
 * vault, desperate terms for the last), rivals and exclusives, and the save.
 */
const sum = (s: Record<string, number>) => Object.values(s).reduce((a, b) => a + b, 0)
const deliver = (company: CompanyId, crates = 0): WarContract => ({ company, crates, status: 'delivered' })
const play = (s: Season, list: WarContract[]): Season => list.reduce(recordContract, s)

describe('market share', () => {
  it('starts even: 20 each, summing to 100', () => {
    const s = freshSeason()
    expect(COMPANY_IDS.map((c) => s.shares[c])).toEqual([20, 20, 20, 20, 20])
    expect(s).toMatchObject({ n: 1, contracts: 0, exclusive: null, desperate: null, ended: null })
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
    expect(seasonLeader({ n: 1, shares: r, deliveries: freshSeason().deliveries })).toBe('spice')
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

  it('the leader pays its champion: a purse per delivery and a pick of three from its vault', () => {
    const s = seven('metals', 3)
    expect(seasonLeader(s)).toBe('metals')
    const { end, next } = endSeason(s, { haveItems: [] })
    expect(end).toMatchObject({ n: 1, leader: 'metals', delivered: 3, champion: true, purse: 3 * CHAMPION_PURSE })
    expect(end.vault).toHaveLength(VAULT_PICKS)
    for (const v of end.vault) {
      expect(itemKindById(v.kind)!.company).toBe('metals')
      expect(itemKindById(v.kind)!.level).toBeLessThanOrEqual(3)
    }
    // The locked kinds come first; the basics are owned, so never a fresh unlock.
    expect(end.vault.every((v) => v.unlock)).toBe(true)
    expect(end.vault.some((v) => BASIC_ITEM_KINDS.includes(v.kind))).toBe(false)
    // The next season: number, tallies cleared, shares regressed, the page waiting.
    expect(next).toMatchObject({ n: 2, contracts: 0, exclusive: null, ended: end })
    expect(sum(next.deliveries)).toBe(0)
    expect(sum(next.shares)).toBe(100)
  })

  it('a militia with fewer than two deliveries for the leader is not its champion: nothing is paid', () => {
    const s = play(freshSeason(), [deliver('silk', 8), ...Array.from({ length: 6 }, () => ({ company: 'spice' as const, crates: 0, status: 'cashedOut' as const }))])
    // Peppercorn's six cash-outs (+12) outrun Rosethread's one big delivery (+8).
    expect(seasonLeader(s)).toBe('spice')
    expect(s.deliveries.spice).toBeLessThan(CHAMPION_MIN)
    const { end } = endSeason(s, { haveItems: [] })
    expect(end).toMatchObject({ leader: 'spice', champion: false, purse: 0, vault: [] })
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

describe('rivals and exclusives', () => {
  it('the rival pairs are fixed and mutual; Easel House has none', () => {
    expect(rivalOf('metals')).toBe('scrolls')
    expect(rivalOf('scrolls')).toBe('metals')
    expect(rivalOf('spice')).toBe('silk')
    expect(rivalOf('silk')).toBe('spice')
    expect(rivalOf('art')).toBeNull()
    for (const c of COMPANIES) if (c.rival) expect(rivalOf(c.rival)).toBe(c.id)
  })

  it('an exclusive pays more standing on its company’s contracts, and turns its rival cold: one crate fewer', () => {
    const s = { ...freshSeason(), exclusive: 'metals' as const }
    expect(exclusiveXpMult(s, 'metals')).toBe(EXCLUSIVE_XP)
    expect(exclusiveXpMult(s, 'scrolls')).toBe(1)
    expect(exclusiveXpMult(s, null)).toBe(1)
    expect(isCold(s, 'scrolls')).toBe(true)
    expect(isCold(s, 'art')).toBe(false)
    expect(seasonCrateCap(s, 'scrolls', 5)).toBe(crateCap(5) - 1)
    expect(seasonCrateCap(s, 'scrolls', 0)).toBe(1)
    expect(seasonCrateCap(s, 'metals', 5)).toBe(crateCap(5))
  })

  it('Easel House’s exclusive costs nothing and pays a little less', () => {
    const s = { ...freshSeason(), exclusive: 'art' as const }
    expect(exclusiveXpMult(s, 'art')).toBe(EXCLUSIVE_XP_UNRIVALLED)
    for (const c of COMPANY_IDS) expect(isCold(s, c)).toBe(false)
  })

  it('lasts until the season ends', () => {
    const s = play({ ...freshSeason(), exclusive: 'metals' }, Array.from({ length: SEASON_LENGTH }, () => deliver('metals')))
    expect(endSeason(s, { haveItems: [] }).next.exclusive).toBeNull()
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
      exclusive: 'nope',
      desperate: 'art',
      ended: { leader: 'metals', champion: true, delivered: 2, purse: 99999, vault: [{ kind: 'Pavise', unlock: true }, { kind: 'Bow', unlock: true }, { kind: 'nope' }], shares: {} },
    })
    expect(r.n).toBe(1)
    expect(r.contracts).toBe(SEASON_LENGTH - 1)
    expect(sharesValid(r.shares)).toBe(true)
    expect(sum(r.deliveries)).toBeLessThanOrEqual(r.contracts)
    expect(r.exclusive).toBeNull()
    expect(r.desperate).toBe('art')
    // The end as the rules could have written it: its purse capped, its vault the leader's own kinds.
    expect(r.ended!.purse).toBe(2 * CHAMPION_PURSE)
    expect(r.ended!.vault.map((v) => v.kind)).toEqual(['Pavise'])
  })

  it('survives random garbage', () => {
    const rng = new RNG(hashSeed('season-fuzz'))
    const base = endSeason(play(freshSeason(), Array.from({ length: SEASON_LENGTH }, () => deliver('metals', 3))), { haveItems: [] }).next
    const junk = [null, undefined, -1, 1e12, NaN, 'x', {}, [], true, 3.7, 'metals']
    for (let i = 0; i < 3000; i++) {
      const raw = JSON.parse(JSON.stringify(base)) as Record<string, unknown>
      const keys = ['n', 'contracts', 'shares', 'before', 'deliveries', 'exclusive', 'desperate', 'ended']
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
      if (s.ended) {
        expect(Number.isFinite(s.ended.purse)).toBe(true)
        expect(s.ended.purse).toBeLessThanOrEqual(CHAMPION_PURSE * SEASON_LENGTH)
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

  it('the seventh contract ends the season: the champion’s purse banked, the vault pick waiting, desperate terms posted', () => {
    veteran()
    const bank0 = useMetaStore.getState().bank
    // Each settle's own deposit (its interest) is returned; the champion's purse comes on top.
    let banked = 0
    for (let i = 0; i < SEASON_LENGTH; i++) banked += settle('metals')
    const m = useMetaStore.getState()
    expect(m.season.n).toBe(2)
    expect(m.season.ended).toMatchObject({ leader: 'metals', champion: true, delivered: SEASON_LENGTH, purse: SEASON_LENGTH * CHAMPION_PURSE })
    expect(m.bank).toBe(bank0 + banked + SEASON_LENGTH * CHAMPION_PURSE)
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

  it('an exclusive is signed once a season, and pays its company ×1.5 standing', () => {
    veteran()
    expect(useMetaStore.getState().signExclusive('metals')).toBe(true)
    expect(useMetaStore.getState().signExclusive('art')).toBe(false)
    expect(useMetaStore.getState().season.exclusive).toBe('metals')
    settle('metals')
    expect(useMetaStore.getState().standing.metals).toBe(Math.floor(standingXpFor({ depth: 12, kills: 200, delivered: true }) * EXCLUSIVE_XP))
    // Another company's contract pays as ever.
    settle('art')
    expect(useMetaStore.getState().standing.art).toBe(standingXpFor({ depth: 12, kills: 200, delivered: true }))
  })

  it('the Sovereign Route counts and moves nothing', () => {
    veteran()
    settle(null)
    const s = useMetaStore.getState().season
    expect(s.contracts).toBe(1)
    expect(s.shares).toEqual(freshSeason().shares)
  })
})
