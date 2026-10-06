import { describe, expect, it } from 'vitest'
import { RNG } from '../src/game/core/rng'
import { COMPANIES, COMPANY_IDS, companyById, crestRows } from '../src/game/data/companies'
import { ALL_SKILLS, RANDOM_UNLOCK_SKILLS } from '../src/game/data/skills'
import { ITEM_KINDS, UNLOCK_ITEM_KINDS, itemPoolFor } from '../src/game/data/itemKinds'
import { CHARTER_FEE, CHARTER_PAYOUT, charterDoor } from '../src/game/run/charter'
import { generateItem } from '../src/game/data/items'
import { drawDistinct, poolFor } from '../src/game/run/skills'
import {
  ADVANCE,
  canCashOut,
  ESCORT_FEE,
  cashOutValue,
  cityOfLayer,
  cityPay,
  COMPANY_WEIGHT,
  contractLetter,
  contractPlan,
  CRATE_PRICE,
  crateCap,
  cratesLeftAfter,
  cratesSoldAt,
  dangerPips,
  deliveryUnlocks,
  kindCompany,
  MARKET_MULT,
  marketFor,
  marketOfDay,
  MAX_CRATES,
  MARKET_FROM_RUN,
  marketOpen,
  milestonesAt,
  recordAt,
  freshContract,
  signingCost,
  STAKES_OPEN_AT,
  stakesOpen,
  skillCompany,
  stakeRules,
  weightPool,
} from '../src/game/run/contracts'
import {
  cardFloor,
  charterStandingXp,
  companyOpen,
  contractFloor,
  MAX_STANDING,
  rollContractItem,
  rollContractSkill,
  rollStandingCard,
  spreadWatchXp,
  standingFor,
  standingXpFor,
  standingXpToReach,
} from '../src/game/run/standing'
import { nodeTerrainRule } from '../src/game/run/terrain'
import { fieldFor, FIRST_MAP } from '../src/game/data/maps'

const terms = (crates: number, market = 1) => ({ company: 'spice' as const, crates, market })

describe('companies', () => {
  it('five companies, each with a name, goods, ground, three towns and a crest', () => {
    expect(COMPANIES.map((c) => c.id)).toEqual(['spice', 'art', 'metals', 'silk', 'scrolls'])
    for (const c of COMPANIES) {
      expect(c.name.length).toBeGreaterThan(3)
      expect(c.towns).toHaveLength(3)
      expect(c.ground.rules.length).toBeGreaterThan(0)
      expect(c.letters.length).toBeGreaterThan(0)
      const rows = crestRows(c.emblem)
      expect(rows).toHaveLength(18)
      expect(rows.every((r) => r.length === 16)).toBe(true)
    }
    expect(companyById('spice').name).toBe('Peppercorn Co.')
  })

  it('every skill card and item kind belongs to a company, and every company has a share of each', () => {
    for (const k of ALL_SKILLS) expect(COMPANY_IDS).toContain(k.company)
    for (const k of ITEM_KINDS) expect(COMPANY_IDS).toContain(k.company)
    for (const c of COMPANY_IDS) {
      expect(RANDOM_UNLOCK_SKILLS.filter((id) => skillCompany(id) === c).length).toBeGreaterThanOrEqual(5)
      expect(UNLOCK_ITEM_KINDS.filter((id) => kindCompany(id) === c).length).toBeGreaterThanOrEqual(3)
    }
  })

  it('each route deals its own ground, from the same hash', () => {
    let seen = 0
    for (let i = 0; i < 200; i++) {
      const node = { id: `n${2 + (i % 9)}-${i % 3}`, type: 'battle', layer: 2 + (i % 9) }
      const open = nodeTerrainRule(node, 1000 + i)
      const spice = nodeTerrainRule(node, 1000 + i, { ground: companyById('spice').ground.rules })
      const metals = nodeTerrainRule(node, 1000 + i, { ground: companyById('metals').ground.rules })
      // A challenge on one road is a challenge on every road: only the rule differs.
      expect(spice === null).toBe(open === null)
      expect(metals === null).toBe(open === null)
      if (open) {
        seen++
        expect(spice).toBe('wildfire')
        expect(metals).toBe('quarry')
        expect(['flooded', 'wildfire']).toContain(open)
      }
    }
    expect(seen).toBeGreaterThan(80)
  })

  it('quarry ground lays more boulders, cursed ground more cursed tiles', () => {
    const plain = fieldFor(FIRST_MAP.id, null, 'landscape', 777)!
    const quarry = fieldFor(FIRST_MAP.id, 'quarry', 'landscape', 777)!
    const hexed = fieldFor(FIRST_MAP.id, 'hexed', 'landscape', 777)!
    const rocks = (m: typeof plain) => m.tiles!.filter((t) => t.block === 'rock').length
    const cursed = (m: typeof plain) => m.tiles!.filter((t) => t.danger === 'cursed').length
    expect(rocks(quarry)).toBeGreaterThan(rocks(plain))
    expect(cursed(hexed)).toBeGreaterThan(cursed(plain))
  })
})

describe('contracts: stakes and cities', () => {
  it('the crate cap is standing + 1, up to the absolute max', () => {
    expect(crateCap(0)).toBe(1)
    expect(crateCap(3)).toBe(4)
    expect(crateCap(20)).toBe(MAX_CRATES)
  })

  it('every crate is a difficulty step and more danger, never less', () => {
    for (let c = 1; c <= MAX_CRATES; c++) {
      // Every crate makes the last leg's raiders stronger and greedier (the tuning pass).
      expect(stakeRules(c).lastLeg).toBeGreaterThan(stakeRules(c - 1).lastLeg)
      expect(stakeRules(c).startThreat).toBe(1)
      expect(stakeRules(c).extraElites).toBeGreaterThan(stakeRules(c - 1).extraElites)
      expect(dangerPips(c)).toBeGreaterThanOrEqual(dangerPips(c - 1))
    }
    expect(dangerPips(0)).toBe(1)
    expect(dangerPips(MAX_CRATES)).toBe(5)
  })

  it('the cities sell every crate, and the first sale recoups the stake', () => {
    for (let c = 0; c <= MAX_CRATES; c++) {
      expect(cratesSoldAt(c, 0) + cratesSoldAt(c, 1) + cratesSoldAt(c, 2)).toBe(c)
      expect(cityPay(terms(c), 0).sales).toBeGreaterThanOrEqual(c * CRATE_PRICE)
      expect(cratesLeftAfter(c, 3)).toBe(0)
      // One crate (from two) rides to the destination: the big reward.
      expect(cratesSoldAt(c, 2)).toBe(c >= 2 ? 1 : 0)
    }
  })

  it('every crate pays more if delivered: the profit rises at every step', () => {
    let prev = contractPlan(terms(0))
    for (let c = 1; c <= MAX_CRATES; c++) {
      const plan = contractPlan(terms(c))
      expect(plan.profit).toBeGreaterThan(prev.profit)
      expect(plan.cities[2].bonus).toBeGreaterThan(prev.cities[2].bonus)
      prev = plan
    }
  })

  it('an escort is paid a fee at every city and a bonus at the end, all scaled by cargo', () => {
    const full = contractPlan(terms(0))
    expect(full.stake).toBe(0)
    expect(full.cities.map((x) => x.fee)).toEqual([ESCORT_FEE, ESCORT_FEE, ESCORT_FEE])
    expect(full.cities[2].bonus).toBeGreaterThan(0)
    expect(cityPay(terms(0), 1, 50).total).toBe(ESCORT_FEE / 2)
    expect(cityPay(terms(4), 0, 85).total).toBeLessThan(cityPay(terms(4), 0, 100).total)
  })

  it('cash out sells what is left at its full value, scaled by cargo', () => {
    const t = terms(4)
    expect(cratesLeftAfter(4, 1)).toBe(2)
    expect(cashOutValue(t, 1, 100)).toBe(200)
    expect(cashOutValue(t, 1, 50)).toBe(100)
    expect(cashOutValue(terms(0), 1)).toBe(0)
  })

  it('a bigger stake pays more if delivered', () => {
    for (let c = 1; c <= MAX_CRATES; c++) expect(contractPlan(terms(c)).total).toBeGreaterThan(contractPlan(terms(c - 1)).total)
  })

  it('a first contract may cash out from its second city; the Sovereign Route never', () => {
    const at = (pending: number | null, charter?: boolean) => ({ pending, ...(charter ? { charter } : {}) })
    expect(canCashOut(at(0), true)).toBe(false)
    expect(canCashOut(at(1), true)).toBe(true)
    expect(canCashOut(at(0), false)).toBe(true)
    expect(canCashOut(at(1, true), false)).toBe(false)
    expect(canCashOut(at(null), false)).toBe(false)
  })

  it('the market lifts sales and the bonus, not the fee', () => {
    const plain = cityPay(terms(4), 2)
    const hot = cityPay(terms(4, MARKET_MULT), 2)
    expect(hot.fee).toBe(plain.fee)
    expect(hot.sales).toBeGreaterThan(plain.sales)
    expect(hot.bonus).toBeGreaterThan(plain.bonus)
  })

  it('milestones add skills and crates add item chances', () => {
    expect(milestonesAt(1)).toBe(0)
    expect(milestonesAt(2)).toBe(1)
    expect(milestonesAt(8)).toBe(3)
    expect(deliveryUnlocks(0)).toEqual({ skills: 1, items: 1 })
    expect(deliveryUnlocks(4)).toEqual({ skills: 2, items: 3 })
  })

  it('the three act bosses are the three cities', () => {
    expect([4, 8, 12].map(cityOfLayer)).toEqual([0, 1, 2])
    expect(cityOfLayer(5)).toBeNull()
    expect(cityOfLayer(0)).toBeNull()
  })

  it('the market of the day is the same for everyone that day, and reaches every company', () => {
    expect(marketOfDay('2026-10-05')).toBe(marketOfDay('2026-10-05'))
    const seen = new Set<string>()
    for (let d = 1; d <= 60; d++) seen.add(marketOfDay(`2026-11-${String((d % 28) + 1).padStart(2, '0')}`))
    expect(seen.size).toBeGreaterThanOrEqual(4)
    const co = marketOfDay('2026-10-05')
    expect(marketFor(co, '2026-10-05')).toBe(MARKET_MULT)
    expect(COMPANY_IDS.filter((c) => marketFor(c, '2026-10-05') > 1)).toEqual([co])
  })

  it('a letter names the company and its destination', () => {
    for (const c of COMPANIES) {
      const line = contractLetter(c.id, 42)
      expect(line).toContain(c.name)
      expect(line).toContain(c.towns[2])
      expect(line).not.toMatch(/\{/)
    }
  })

  it('every contract carries the company’s advance; signing takes only the stake (an older save’s bank purse too)', () => {
    expect(ADVANCE).toBe(60)
    const c = freshContract({ company: 'art', crates: 3, market: 1 })
    expect(c).toMatchObject({ purse: ADVANCE, advance: true })
    expect(signingCost(c)).toBe(3 * CRATE_PRICE)
    expect(signingCost({ ...c, advance: false })).toBe(3 * CRATE_PRICE + ADVANCE)
    // The Sovereign Route gets the same advance; signing takes its fee.
    const s = freshContract({ company: null, crates: 0, market: 1, charter: true })
    expect(s).toMatchObject({ purse: ADVANCE, advance: true })
    expect(signingCost(s)).toBe(CHARTER_FEE)
  })

  it('the staggered reveal: stakes at standing 2 with the company, the market from the fifth contract', () => {
    expect(STAKES_OPEN_AT).toBe(2)
    expect([0, 1, 2, 3].map(stakesOpen)).toEqual([false, false, true, true])
    expect(MARKET_FROM_RUN).toBe(5)
    expect([0, 4, 5, 9].map(marketOpen)).toEqual([false, false, true, true])
    const hot = marketOfDay('2026-10-06')
    expect(marketFor(hot, '2026-10-06')).toBe(MARKET_MULT)
    expect(marketFor(hot, '2026-10-06', false)).toBe(1)
  })

  it('the charter: 7,000 in, 35,000 out, and standing with all five as a same-ending escort earns with one', () => {
    expect(CHARTER_FEE).toBe(7000)
    expect(CHARTER_PAYOUT).toBe(35000)
    const run = { depth: 12, kills: 640, delivered: true }
    const all = charterStandingXp(run)
    expect(Object.keys(all).sort()).toEqual([...COMPANY_IDS].sort())
    for (const c of COMPANY_IDS) expect(all[c]).toBe(standingXpFor(run))
    expect(charterStandingXp({ ...run, delivered: false }).spice).toBe(standingXpFor({ ...run, delivered: false }))
  })

  it('the record reads escorts alone, and stakes at this many crates or more', () => {
    const rec = { '0': { runs: 5, delivered: 4 }, '3': { runs: 2, delivered: 1 }, '5': { runs: 2, delivered: 2 } }
    expect(recordAt(rec, 0)).toEqual({ runs: 5, delivered: 4 })
    expect(recordAt(rec, 4)).toEqual({ runs: 2, delivered: 2 })
    expect(recordAt(rec, 1)).toEqual({ runs: 4, delivered: 3 })
  })
})

describe('pool affinity', () => {
  it('weights a company’s pieces and leaves an unweighted pool as it was', () => {
    const pool = itemPoolFor([])
    expect(weightPool(pool, null, kindCompany)).toEqual(pool)
    const w = weightPool(pool, 'metals', kindCompany)
    expect(w.filter((k) => k === 'Shield')).toHaveLength(COMPANY_WEIGHT)
    expect(w.filter((k) => k === 'Sword')).toHaveLength(1)
  })

  it('an unweighted pool deals exactly what it always dealt', () => {
    const pool = ALL_SKILLS.map((k) => k.id)
    expect(poolFor(pool, 1).map((k) => k.id)).toEqual(ALL_SKILLS.filter((k) => k.level === 1).map((k) => k.id))
    const a = drawDistinct(new RNG(5), [1, 2, 3, 4, 5, 6], 3)
    expect(new Set(a).size).toBe(3)
  })

  it('a weighted pool deals the company’s pieces about twice as often, and never twice in one offer', () => {
    const pool = weightPool(ALL_SKILLS.map((k) => k.id), 'spice', skillCompany)
    let own = 0
    let total = 0
    for (let i = 0; i < 400; i++) {
      const offer = drawDistinct(new RNG(1000 + i), poolFor(pool, 2), 3)
      expect(new Set(offer.map((k) => k.id)).size).toBe(offer.length)
      own += offer.filter((k) => k.company === 'spice').length
      total += offer.length
    }
    const base = ALL_SKILLS.filter((k) => k.level === 2 && k.company === 'spice').length / ALL_SKILLS.filter((k) => k.level === 2).length
    expect(own / total).toBeGreaterThan(base * 1.3)

    const kinds = weightPool(itemPoolFor([...UNLOCK_ITEM_KINDS]), 'scrolls', kindCompany)
    let co = 0
    for (let i = 0; i < 600; i++) {
      const it = generateItem(new RNG(i), { kinds })
      if (kindCompany(it.name.split(' ').find((w) => ITEM_KINDS.some((k) => k.id === w)) ?? '') === 'scrolls') co++
    }
    expect(co / 600).toBeGreaterThan(5 / 22)
  })
})

describe('standing', () => {
  it('starts at 0 and climbs on the Watch curve to a cap', () => {
    expect(standingFor(0)).toBe(0)
    expect(standingFor(80)).toBe(1)
    expect(standingFor(79)).toBe(0)
    expect(standingFor(1e9)).toBe(MAX_STANDING)
    expect(standingXpToReach(10)).toBe(1700)
  })

  it('a delivery earns more than the same road lost', () => {
    expect(standingXpFor({ depth: 12, kills: 300, delivered: true })).toBeGreaterThan(standingXpFor({ depth: 12, kills: 300, delivered: false }))
  })

  it('floors rise with standing and with the stake', () => {
    expect([0, 3, 4, 6, 7, 10].map(cardFloor)).toEqual([1, 1, 2, 2, 3, 3])
    expect([0, 2, 3, 5, 6, 8].map(contractFloor)).toEqual([1, 1, 2, 2, 3, 3])
  })

  it('a standing card comes from the company’s pool first, then any pool', () => {
    const got = rollStandingCard([], 'metals', 1, 'x')!
    expect(skillCompany(got)).toBe('metals')
    const metalsCards = RANDOM_UNLOCK_SKILLS.filter((id) => skillCompany(id) === 'metals')
    const next = rollStandingCard(metalsCards, 'metals', 2, 'x')!
    expect(next).not.toBeNull()
    expect(skillCompany(next)).not.toBe('metals')
    expect(rollStandingCard([...RANDOM_UNLOCK_SKILLS], 'metals', 3, 'x')).toBeNull()
  })

  it('a high floor deals a high card while one is left', () => {
    const got = rollStandingCard([], 'art', 7, 'y')!
    expect(ALL_SKILLS.find((k) => k.id === got)!.level).toBe(3)
    const item = rollContractItem([], 'scrolls', 6, 'z')!
    expect(ITEM_KINDS.find((k) => k.id === item)!.level).toBe(3)
    expect(rollContractSkill([], 'spice', 0, 'w')).not.toBeNull()
  })

  it('the charter opens only when every skill and item is unlocked (standing does not count)', () => {
    expect(charterDoor({ skills: [], items: [] })).toMatchObject({ progress: 0, open: false })
    expect(charterDoor({ skills: [...RANDOM_UNLOCK_SKILLS], items: [...UNLOCK_ITEM_KINDS] }).open).toBe(true)
    expect(charterDoor({ skills: [...RANDOM_UNLOCK_SKILLS], items: [] }).open).toBe(false)
  })

  it('old Watch XP is spread evenly, and Moonquill opens at standing 3 anywhere', () => {
    const spread = spreadWatchXp(1000)
    expect(Object.values(spread)).toEqual([200, 200, 200, 200, 200])
    expect(companyOpen('scrolls', {})).toBe(false)
    expect(companyOpen('scrolls', { art: standingXpToReach(3) })).toBe(true)
    expect(companyOpen('spice', {})).toBe(true)
  })
})
