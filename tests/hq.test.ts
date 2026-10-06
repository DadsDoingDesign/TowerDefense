import { beforeEach, describe, expect, it } from 'vitest'
import {
  BASE_DEAL,
  BASE_INTEREST,
  crateKinds,
  cratesOpenFor,
  dealRules,
  earnsInterest,
  focusBoost,
  foldOldHub,
  FOCUS_MAX_SHARE,
  FOCUS_STEP,
  homeGold,
  homeTotal,
  hqCost,
  HQ_UPGRADES,
  INTEREST_FULL_AT,
  interestFor,
  packSlots,
  PACK_BASE,
  PULL_BASE,
  PULL_LIFT_MAX,
  PULL_PRICE,
  pullLift,
  pullNewChance,
  pullOdds,
  refundRetiredHq,
  RETIRED_HQ,
  RETIRED_ROCK_ORDER,
  ROAD_SHARE,
  rollPull,
  runHqFor,
  NO_ORDERS,
} from '../src/game/run/hq'
import { contractPlan, kindCompany, poolShare, skillCompany, weightPool } from '../src/game/run/contracts'
import { heroChoices, previewOf } from '../src/game/run/heroes'
import { stow, soldText } from '../src/game/run/inventory'
import { ALL_ITEM_KINDS, BASIC_ITEM_KINDS, itemKindById, UNLOCK_ITEM_KINDS } from '../src/game/data/itemKinds'
import { ALL_SKILLS, skillById } from '../src/game/data/skills'
import { generateItem, ITEM_BASES } from '../src/game/data/items'
import { RNG } from '../src/game/core/rng'
import { fieldFor, FIRST_MAP } from '../src/game/data/maps'
import { MIN_OBSTACLES, OBSTACLES } from '../src/game/data/hazards'
import { META_VERSION, NEW_BANK, migrateMeta, useMetaStore } from '../src/state/metaStore'
import { useGameStore } from '../src/state/gameStore'
import { scrapGold } from '../src/game/run/economy'

const ALL_SKILL_IDS = ALL_SKILLS.map((k) => k.id)

describe('road gold comes home, taxed', () => {
  it("the designer's example: purse returned 40 · road gold 412 → 103 banked", () => {
    // A 60-gold purse, 20 spent at a merchant, 412 earned on the road.
    const h = homeGold({ purse: 60, earned: 412, gold: 60 - 20 + 412 })
    expect(h).toMatchObject({ purse: 60, purseBack: 40, road: 412, roadBanked: 103, pct: 25 })
    expect(homeTotal(h)).toBe(143)
    expect(ROAD_SHARE).toBe(0.25)
  })

  it('spending comes out of the purse first; what is left of it comes home in full', () => {
    // Untouched purse, nothing earned: all of it comes home.
    expect(homeGold({ purse: 100, earned: 0, gold: 100 })).toMatchObject({ purseBack: 100, road: 0, roadBanked: 0 })
    // The purse spent down, then the road refills it: that refill is road gold.
    expect(homeGold({ purse: 100, earned: 80, gold: 80 })).toMatchObject({ purseBack: 0, road: 80, roadBanked: 20 })
    // Partly spent, nothing earned.
    expect(homeGold({ purse: 100, earned: 0, gold: 30 })).toMatchObject({ purseBack: 30, road: 0 })
  })

  it('no ledger can claim more purse than the purse; junk is whole and non-negative', () => {
    for (let i = 0; i < 400; i++) {
      const r = new RNG(i)
      const purse = Math.floor(r.next() * 300)
      const earned = Math.floor(r.next() * 900) - 100
      const gold = Math.floor(r.next() * 1200) - 50
      const h = homeGold({ purse, earned, gold })
      expect(h.purseBack).toBeLessThanOrEqual(purse)
      expect(h.purseBack + h.road).toBe(Math.max(0, gold))
      expect(h.roadBanked).toBeLessThanOrEqual(h.road)
      expect(Number.isInteger(h.roadBanked)).toBe(true)
    }
    expect(homeGold({ purse: NaN, earned: Infinity, gold: -4 })).toMatchObject({ purseBack: 0, road: 0, roadBanked: 0 })
  })

  it('the company’s advance is split off the same way, and none of it is banked', () => {
    // A 60 advance, 20 spent at a merchant, 412 earned on the road.
    const h = homeGold({ purse: 60, earned: 412, gold: 60 - 20 + 412, advance: true })
    expect(h).toMatchObject({ purse: 60, advance: true, purseBack: 40, road: 412, roadBanked: 103 })
    expect(homeTotal(h)).toBe(103)
    // Spent first: an advance spent whole leaves every gold in hand the road's.
    expect(homeTotal(homeGold({ purse: 60, earned: 100, gold: 100, advance: true }))).toBe(25)
    // Untouched and nothing earned: nothing comes home.
    expect(homeTotal(homeGold({ purse: 60, earned: 0, gold: 60, advance: true }))).toBe(0)
    // No flag is the old rule: an older save's bank purse comes home in full.
    expect(homeTotal(homeGold({ purse: 60, earned: 0, gold: 60 }))).toBe(60)
  })
})

describe('the offices: prices and levels', () => {
  it('every purchase has a price for each level and none past the top', () => {
    for (const u of HQ_UPGRADES) {
      u.costs.forEach((c, i) => expect(hqCost(u.id, i)).toBe(c))
      expect(hqCost(u.id, u.costs.length)).toBeNull()
      expect(u.costs.every((c, i) => i === 0 || c > u.costs[i - 1])).toBe(true)
    }
  })

  it('HR: each Opening deal level adds one plain improvement', () => {
    expect(dealRules(0)).toEqual(BASE_DEAL)
    expect(dealRules(1)).toMatchObject({ dressed: true, rareBody: false, pick: 3 })
    expect(dealRules(2)).toMatchObject({ dressed: true, rareBody: true })
    expect(dealRules(3).pick).toBe(4)
    expect(dealRules(4).skill2).toBe(true)
    expect(dealRules(5).second).toBe(true)
    expect(dealRules(99)).toEqual(dealRules(5))
  })

  it('the bank: a plain 2% on finished contracts, capped at 20, full at 1,000 gold — nothing to buy', () => {
    expect(BASE_INTEREST).toEqual({ rate: 0.02, cap: 20 })
    expect(interestFor(INTEREST_FULL_AT)).toBe(BASE_INTEREST.cap)
    expect(interestFor(INTEREST_FULL_AT * 10)).toBe(BASE_INTEREST.cap)
    expect(interestFor(500)).toBe(10)
    expect(interestFor(-50)).toBe(0)
    expect(earnsInterest('delivered') && earnsInterest('cashedOut')).toBe(true)
    expect(earnsInterest('lost')).toBe(false)
  })

  it('the bank’s cap never beats the smallest stake (one crate, delivered)', () => {
    const escort = contractPlan({ company: 'spice', crates: 0, market: 1 }).profit
    const one = contractPlan({ company: 'spice', crates: 1, market: 1 }).profit - escort
    expect(BASE_INTEREST.cap).toBeLessThan(one)
  })

  it('October 2026: the Finance office and "Fewer boulders" are gone; Operations sells three things', () => {
    expect(HQ_UPGRADES.map((u) => u.id)).toEqual(['deal', 'hiring', 'pack', 'focus', 'scouting'])
    expect(HQ_UPGRADES.filter((u) => u.office === 'ops').map((u) => u.id)).toEqual(['pack', 'focus', 'scouting'])
    expect(hqCost('rate' as never, 0)).toBeNull()
    expect(hqCost('rocks' as never, 0)).toBeNull()
  })

  it('Operations: pack slots and focus steps; a contract signed now clears no boulders', () => {
    expect(packSlots(0)).toBe(PACK_BASE)
    expect(packSlots(4)).toBe(PACK_BASE + 4)
    expect(packSlots(40)).toBe(PACK_BASE + 4)
    expect(focusBoost(0, false)).toBe(0)
    expect(focusBoost(3, false)).toBe(3 * FOCUS_STEP)
    expect(focusBoost(3, true)).toBe(4 * FOCUS_STEP)
    expect(runHqFor({}, null, NO_ORDERS)).toEqual({ rocks: 0, focus: null, boost: 0, pack: PACK_BASE })
    // A save's leftover "Fewer boulders" levels do nothing any more.
    expect(runHqFor({ rocks: 3 }, null, NO_ORDERS).rocks).toBe(0)
    // No company in focus: no boost, whatever was bought.
    expect(runHqFor({ focus: 3 }, null, { focus: true }).boost).toBe(0)
  })

  it('the staggered reveal’s HQ-side gates: crates at the first delivery', () => {
    expect(cratesOpenFor(0)).toBe(false)
    expect(cratesOpenFor(1)).toBe(true)
  })
})

describe('company focus: one company, meaningful steps, never cancelling out', () => {
  const pool = ALL_ITEM_KINDS
  it('with no focus the pool is exactly the route-weighted one', () => {
    expect(weightPool(pool, 'art', kindCompany, null)).toEqual(weightPool(pool, 'art', kindCompany))
    expect(weightPool(pool, 'art', kindCompany, { company: 'metals', boost: 0 })).toEqual(weightPool(pool, 'art', kindCompany))
  })
  it('each step raises the focused company’s share by about its points, up to the ceiling', () => {
    const base = poolShare(weightPool(pool, null, kindCompany), 'metals', kindCompany)
    for (let step = 1; step <= 4; step++) {
      const share = poolShare(weightPool(pool, null, kindCompany, { company: 'metals', boost: step * FOCUS_STEP }), 'metals', kindCompany)
      expect(share).toBeCloseTo(Math.min(FOCUS_MAX_SHARE / 100, base + (step * FOCUS_STEP) / 100), 1)
    }
    // Every other company's pieces still turn up.
    const top = weightPool(pool, null, kindCompany, { company: 'metals', boost: 999 })
    expect(new Set(top).size).toBe(new Set(pool).size)
  })
  it('works on skills too, and on a route of another company', () => {
    const before = poolShare(weightPool(ALL_SKILL_IDS, 'spice', skillCompany), 'scrolls', skillCompany)
    const after = poolShare(weightPool(ALL_SKILL_IDS, 'spice', skillCompany, { company: 'scrolls', boost: 30 }), 'scrolls', skillCompany)
    expect(after - before).toBeGreaterThan(0.25)
  })
})

describe('HR: the opening deal', () => {
  it('level 0 deals exactly the base pick', () => {
    expect(heroChoices(77, ALL_SKILL_IDS, BASIC_ITEM_KINDS, dealRules(0))).toEqual(heroChoices(77, ALL_SKILL_IDS, BASIC_ITEM_KINDS))
  })
  it('dressed heroes carry body armour (Rare from level 2), and an off hand when a hand is free', () => {
    for (let seed = 1; seed < 40; seed++) {
      for (const c of heroChoices(seed, ALL_SKILL_IDS, ALL_ITEM_KINDS, dealRules(2))) {
        expect(c.equipment.body?.rarity).toBe('rare')
        const twoHand = ITEM_BASES[c.plan.main].slot === 'twoHand'
        if (!twoHand) expect(c.equipment.offHand).not.toBeNull()
      }
    }
  })
  it('level 3 deals four, level 4 gives one of them a Level 2 skill', () => {
    const four = heroChoices(5, ALL_SKILL_IDS, BASIC_ITEM_KINDS, dealRules(3))
    expect(four).toHaveLength(4)
    const withL2 = heroChoices(5, ALL_SKILL_IDS, BASIC_ITEM_KINDS, dealRules(4))
    expect(withL2.filter((c) => skillById(c.skill!)?.level === 2)).toHaveLength(1)
    // The skill swap moves nothing else.
    withL2.forEach((c, i) => expect(previewOf(c).equipment).toEqual(previewOf(four[i]).equipment))
  })
})

describe('the pack: a full pack sells its cheapest pieces', () => {
  const it8 = (rarity: 'common' | 'rare' | 'epic', kind = 'Sword') => generateItem(new RNG(rarity.length + kind.length), { kind, rarity, allowCurse: false })
  it('only as many as arrived, the cheapest of old and new together', () => {
    const pack = [it8('rare'), it8('common', 'Bow'), it8('epic', 'Wand')]
    const drop = it8('epic', 'Shield')
    const r = stow(pack, [drop], 3)
    expect(r.sold.map((x) => x.rarity)).toEqual(['common'])
    expect(r.inventory).toContain(drop)
    expect(r.gold).toBe(scrapGold(r.sold[0]))
    expect(soldText(r.sold, r.gold)).toMatch(/^Pack full: sold the .+ for \d+ gold$/)
    // Room to spare: nothing sold.
    expect(stow(pack, [drop], 4).sold).toEqual([])
    // A pack already over its slots sells at most what arrives.
    expect(stow([...pack, it8('common', 'Axe')], [drop], 2).sold).toHaveLength(1)
  })
})

describe('boulders: cleared by the HQ, never below the floor', () => {
  const rocks = (cut: number) => fieldFor(FIRST_MAP.id, null, 'landscape', 4242, cut)!.tiles!.filter((t) => t.block === 'rock').length
  it('each cut clears a 2 × 2 patch; cut 0 lays what it always laid; the floor holds', () => {
    const base = rocks(0)
    expect(rocks(1)).toBe(base - 4)
    expect(rocks(2)).toBe(base - 8)
    expect(rocks(OBSTACLES - MIN_OBSTACLES)).toBe(rocks(99))
    expect(fieldFor(FIRST_MAP.id, null, 'landscape', 4242)).toBe(fieldFor(FIRST_MAP.id, null, 'landscape', 4242, 0))
    expect(fieldFor(FIRST_MAP.id, null, 'landscape', 4242, 2)!.id).not.toBe(fieldFor(FIRST_MAP.id, null, 'landscape', 4242)!.id)
  })
})

describe('sealed crates', () => {
  it('the odds are whole percent, sum to 100, and standing moves at most 30 points off Level 1', () => {
    expect(pullOdds(0)).toEqual([...PULL_BASE])
    for (let l = 0; l <= 60; l++) {
      const o = pullOdds(l)
      expect(o[0] + o[1] + o[2]).toBe(100)
      expect(o[0]).toBe(PULL_BASE[0] - Math.min(PULL_LIFT_MAX, l))
    }
    expect(pullLift({ spice: 0 })).toBe(0)
    expect(pullLift({ spice: 1e9, art: 1e9, metals: 1e9, silk: 1e9, scrolls: 1e9 })).toBe(PULL_LIFT_MAX)
  })
  it('a crate is its own seeded roll: the same crate always holds the same kind', () => {
    expect(rollPull(9, 3, 0, [])).toEqual(rollPull(9, 3, 0, []))
    const seen = new Set<number>()
    for (let n = 0; n < 2000; n++) {
      const p = rollPull(123, n, 0, [])
      seen.add(p.level)
      expect(crateKinds(p.level)).toContain(p.kind)
      expect(BASIC_ITEM_KINDS).not.toContain(p.kind)
    }
    expect(seen.size).toBe(3)
    // Measured rate of Level 3 near its 8%.
    let l3 = 0
    for (let n = 0; n < 4000; n++) if (rollPull(77, n, 0, []).level === 3) l3++
    expect(l3 / 4000).toBeGreaterThan(0.06)
    expect(l3 / 4000).toBeLessThan(0.1)
  })
  it('the chance of a new kind falls as the collection fills', () => {
    expect(pullNewChance([], 0)).toBeCloseTo(1)
    expect(pullNewChance(UNLOCK_ITEM_KINDS, 0)).toBe(0)
    expect(pullNewChance(crateKinds(1), 0)).toBeCloseTo(0.3)
  })
})

describe('the HQ in the store', () => {
  beforeEach(() => {
    useMetaStore.getState().resetMeta()
    useMetaStore.setState({ bank: 5000, stats: { ...useMetaStore.getState().stats, runsCompleted: 3 } })
  })

  it('buys a level from the bank, refuses past the top or past the bank', () => {
    const m = useMetaStore.getState()
    expect(m.buyUpgrade('pack')).toBe(true)
    expect(useMetaStore.getState().bank).toBe(5000 - 150)
    expect(useMetaStore.getState().upgrades.pack).toBe(1)
    expect(m.buyUpgrade('nope')).toBe(false)
    useMetaStore.setState({ bank: 10 })
    expect(useMetaStore.getState().buyUpgrade('pack')).toBe(false)
    expect(useMetaStore.getState().upgrades.pack).toBe(1)
  })

  it('the old service names read the folded offices', () => {
    const m = useMetaStore.getState()
    expect(m.unlocked('standingOrders')).toBe(false)
    m.buyUpgrade('scouting')
    expect(useMetaStore.getState().unlocked('standingOrders')).toBe(true)
    expect(useMetaStore.getState().unlocked('cartographer')).toBe(false)
    useMetaStore.getState().buyUpgrade('scouting')
    expect(useMetaStore.getState().unlocked('cartographer')).toBe(true)
    useMetaStore.getState().buyUpgrade('hiring')
    expect(useMetaStore.getState().unlocked('freeCompanies')).toBe(true)
  })

  it('a finished contract earns interest on the bank before its deposit; a lost one earns none', () => {
    useMetaStore.setState({ bank: 800 })
    const settle = (status: 'delivered' | 'cashedOut' | 'lost', unranked = false) =>
      useMetaStore.getState().settleContract({ depth: 3, kills: 0, won: status === 'delivered', contract: { company: 'art', crates: 0, status }, deposit: 100, unranked })
    const b0 = useMetaStore.getState().bank
    settle('cashedOut')
    expect(useMetaStore.getState().bank - b0).toBe(100 + interestFor(800))
    expect(useMetaStore.getState().lastInterest).toBe(interestFor(800))
    const b1 = useMetaStore.getState().bank
    settle('lost')
    expect(useMetaStore.getState().bank - b1).toBe(100)
    const b2 = useMetaStore.getState().bank
    settle('delivered', true)
    expect(useMetaStore.getState().bank - b2).toBe(100)
  })

  it('orders are paid now and spent when a contract is signed; the run keeps its terms', () => {
    const m = useMetaStore.getState()
    expect(m.buyOrder('focus')).toBe(false) // no company in focus yet
    m.setFocus('metals')
    m.buyUpgrade('focus')
    expect(useMetaStore.getState().buyOrder('focus')).toBe(true)
    expect(useMetaStore.getState().buyOrder('focus')).toBe(false) // once per contract
    // The boulder order is gone.
    expect(useMetaStore.getState().buyOrder('rocks' as never)).toBe(false)
    expect(useMetaStore.getState().bank).toBe(5000 - 250 - 50)
    const g = useGameStore.getState
    g().beginCampaign(4242, { kind: 'standard' }, { company: 'art', crates: 0 })
    expect(g().contract!.hq).toEqual({ rocks: 0, focus: 'metals', boost: 30, pack: PACK_BASE })
    // Backing out of the pick spends nothing.
    g().cancelHeroPick()
    expect(useMetaStore.getState().orders).toEqual({ focus: true })
    g().beginCampaign(4242, { kind: 'standard' }, { company: 'art', crates: 0 })
    g().pickStartingHero('pick-0')
    expect(useMetaStore.getState().orders).toEqual(NO_ORDERS)
    expect(g().contract!.hq.boost).toBe(30)
    expect(g().contract!.earned).toBe(0)
  })

  it('a crate costs its price, unlocks a kind or owes a bonus item, and the bonus lands in the next pack', () => {
    const before = useMetaStore.getState().bank
    const first = useMetaStore.getState().openCrate()!
    expect(useMetaStore.getState().bank).toBe(before - PULL_PRICE)
    expect(first.duplicate).toBe(false)
    expect(useMetaStore.getState().items).toContain(first.kind)
    // Own everything: every crate is now a duplicate.
    useMetaStore.setState({ items: [...UNLOCK_ITEM_KINDS] })
    const dup = useMetaStore.getState().openCrate()!
    expect(dup.duplicate).toBe(true)
    expect(useMetaStore.getState().bonusItems).toEqual([dup.kind])
    expect(itemKindById(dup.kind)).toBeTruthy()
    const g = useGameStore.getState
    g().beginCampaign(77, { kind: 'standard' }, { company: 'silk', crates: 0 })
    g().pickStartingHero('pick-0')
    expect(useMetaStore.getState().bonusItems).toEqual([])
    const bonus = g().inventory.find((i) => i.name.includes(dup.kind))
    expect(bonus?.rarity).toBe('rare')
    useMetaStore.setState({ bank: 10 })
    expect(useMetaStore.getState().openCrate()).toBeNull()
  })

  it('migration v8 → v9: the old hub folds into the offices, the rest is refunded', () => {
    const old = { base: 2, gold: 1, stats: 2, roster: 1, loot: 1, cartographer: 1, freeCompanies: 1, standingOrders: 1, fieldKitchen: 1, cartulary: 1 }
    const f = foldOldHub(old)
    expect(f.levels).toEqual({ hiring: 1, scouting: 2 })
    // Wagons 60+100, War Chest 50, Recruits 80+130, Reserve 150, Quartermaster 70, Kitchen 220, Cartulary 260.
    expect(f.refund).toBe(160 + 50 + 210 + 150 + 70 + 220 + 260)
    const m = migrateMeta({ bank: 300, upgrades: old, stats: { runsCompleted: 4 } }, 8)
    expect(m.upgrades).toEqual({ hiring: 1, scouting: 2 })
    expect(m.bank).toBe(300 + f.refund)
    expect(m.focus).toBeNull()
    expect(m.orders).toEqual(NO_ORDERS)
    // A Cartographer without Scout Reports is refunded, not mapped.
    expect(foldOldHub({ cartographer: 1 })).toEqual({ levels: {}, refund: 120 })
    // A current save is read as it is: HQ ids only, clamped; no second refund.
    const now = migrateMeta({ bank: 50, upgrades: { pack: 99, base: 2, deal: 2 }, focus: 'nope', orders: { rocks: 'yes' }, bonusItems: ['Axe', 'Nope'], crates: { seed: -3, opened: 2.7 } }, 9)
    expect(now.upgrades).toEqual({ pack: 4, deal: 2 })
    expect(now.bank).toBe(50)
    expect(now.focus).toBeNull()
    expect(now.orders).toEqual(NO_ORDERS)
    expect(now.bonusItems).toEqual(['Axe'])
    expect(now.crates).toEqual({ seed: 0, opened: 2 })
    expect(migrateMeta({}, 9).bank).toBe(NEW_BANK)
  })

  it('migration v10 → v11: Finance’s levels, "Fewer boulders" and an unspent boulder order are refunded', () => {
    expect(META_VERSION).toBe(11)
    const old = { deal: 2, rate: 3, rocks: 2, pack: 1 }
    const refund = 200 + 400 + 700 + (250 + 450) + RETIRED_ROCK_ORDER
    expect(refundRetiredHq(old, { rocks: true, focus: true })).toBe(refund)
    expect(RETIRED_HQ.rate.reduce((a, b) => a + b, 0)).toBe(1300)
    const m = migrateMeta({ bank: 300, upgrades: old, orders: { rocks: true, focus: true }, stats: { runsCompleted: 9 } }, 10)
    expect(m.bank).toBe(300 + refund)
    // The retired ids are dropped; what is kept is kept; the focus order survives.
    expect(m.upgrades).toEqual({ deal: 2, pack: 1 })
    expect(m.orders).toEqual({ focus: true })
    // A v9 save holds them too; levels past the top are refunded only up to the top.
    expect(migrateMeta({ bank: 0, upgrades: { rate: 9 } }, 9).bank).toBe(1300)
    // Once: a current save is never refunded again (merge runs on every load).
    expect(migrateMeta({ bank: 300, upgrades: old, orders: { rocks: true } }, META_VERSION).bank).toBe(300)
    // A pre-v9 save's purchases fold at v9 and never held these.
    expect(migrateMeta({ bank: 300, upgrades: { rate: 3 }, stats: { runsCompleted: 4 } }, 8).bank).toBe(300)
  })
})
