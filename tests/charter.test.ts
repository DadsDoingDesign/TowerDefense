import { beforeEach, describe, expect, it } from 'vitest'
import { RNG } from '../src/game/core/rng'
import { COMPANY_IDS } from '../src/game/data/companies'
import { ENEMY_TYPES } from '../src/game/data/enemies'
import { roadCoverage, ROUTE_HAZARDS } from '../src/game/data/hazards'
import {
  ALL_ITEM_KINDS,
  BASIC_ITEM_KINDS,
  isSovereignKind,
  ITEM_KINDS,
  itemKindById,
  SOVEREIGN_ITEM_KINDS,
  UNLOCK_ITEM_KINDS,
} from '../src/game/data/itemKinds'
import { generateItem, ITEM_BASES, itemNoun, shieldHold, SOVEREIGN_EDGE } from '../src/game/data/items'
import { ALL_MAPS, fieldFor } from '../src/game/data/maps'
import { generateRunMap } from '../src/game/data/runmap'
import { RANDOM_UNLOCK_SKILLS } from '../src/game/data/skills'
import { COMPOSITE_RULES } from '../src/game/data/terrain'
import { nodeEncounter } from '../src/game/data/waves'
import {
  CHARTER_FEE,
  CHARTER_PAYOUT,
  CHARTER_PRICE_MULT,
  CHARTER_TOWNS,
  charterDoor,
  encounterRulesOf,
  MUSTER_STRENGTH,
  rollSovereign,
  routeOf,
  routePrice,
  sovereignPool,
  SOVEREIGN_DILUTION,
  TRADE_OFFS,
} from '../src/game/run/charter'
import { ADVANCE, cashOutValue, cityPay, CITY_COUNT, contractPlan, contractRules, contractStake, runItemPool, stakeRules } from '../src/game/run/contracts'
import { STANDING_XP, standingXpFor } from '../src/game/run/standing'
import { crateKinds, MAX_BONUS_ITEMS, rollPull } from '../src/game/run/hq'
import { encounterNode } from '../src/game/run/map'
import { nodeHazardSeed, nodeTerrainRule } from '../src/game/run/terrain'
import { ITEM_PRICE, RECRUIT_PRICE } from '../src/game/run/economy'
import { useGameStore } from '../src/state/gameStore'
import { useMetaStore } from '../src/state/metaStore'
import { devCharter } from '../src/state/devCharter'
import { setLayoutOrientation } from '../src/state/game/runtime'
import { migrateMeta } from '../src/state/metaStore'

/** The Sovereign Route — the endgame charter (build step 5). */

describe('the door', () => {
  it('opens when every skill card and every item kind of Levels 1–3 is unlocked — standing and the HQ do not count', () => {
    const none = charterDoor({ skills: [], items: [] })
    expect(none).toMatchObject({ progress: 0, open: false })
    expect(none.skills.need).toBe(RANDOM_UNLOCK_SKILLS.length)
    expect(none.items.need).toBe(UNLOCK_ITEM_KINDS.length)
    expect(charterDoor({ skills: [...RANDOM_UNLOCK_SKILLS], items: [] }).open).toBe(false)
    expect(charterDoor({ skills: [], items: [...UNLOCK_ITEM_KINDS] }).open).toBe(false)
    const all = charterDoor({ skills: [...RANDOM_UNLOCK_SKILLS], items: [...UNLOCK_ITEM_KINDS] })
    expect(all).toMatchObject({ progress: 1, open: true })
    // The basic five and a Sovereign kind are not part of it.
    expect(charterDoor({ skills: [], items: [...BASIC_ITEM_KINDS, ...SOVEREIGN_ITEM_KINDS] }).items.have).toBe(0)
    // The meter counts what is held.
    const half = charterDoor({ skills: RANDOM_UNLOCK_SKILLS.slice(0, 10), items: UNLOCK_ITEM_KINDS.slice(0, 5) })
    expect(half.progress).toBeCloseTo(15 / (RANDOM_UNLOCK_SKILLS.length + UNLOCK_ITEM_KINDS.length))
  })
})

describe('the Sovereign tier', () => {
  it('is five Level 4 kinds, one per company, each saying only its own effect', () => {
    expect(SOVEREIGN_ITEM_KINDS).toHaveLength(5)
    expect(SOVEREIGN_ITEM_KINDS.map((k) => itemKindById(k)!.company).sort()).toEqual([...COMPANY_IDS].sort())
    for (const k of SOVEREIGN_ITEM_KINDS) {
      const kind = itemKindById(k)!
      expect(kind.level).toBe(4)
      expect(ITEM_BASES[k].slot).toBe(kind.slot)
      // One sentence about itself: no pairing hints, no other piece named.
      expect(kind.does).toMatch(/^(One hand|Both hands|Off hand|Body)\./)
      expect(kind.does).not.toMatch(/with|combo|pairs/i)
    }
  })

  it('is never a contract, standing or crate unlock, and never dealt to a pool that does not name it', () => {
    for (const k of SOVEREIGN_ITEM_KINDS) {
      expect(UNLOCK_ITEM_KINDS).not.toContain(k)
      expect(ALL_ITEM_KINDS).not.toContain(k)
      expect([1, 2, 3].flatMap((l) => crateKinds(l as 1 | 2 | 3))).not.toContain(k)
    }
    for (let n = 0; n < 400; n++) expect(isSovereignKind(rollPull(77, n, 30, []).kind)).toBe(false)
    // A roll with no pool, and one with every Level 1–3 kind, never deals one.
    const rng = new RNG(5)
    for (let i = 0; i < 3000; i++) expect(isSovereignKind(itemNoun(generateItem(rng)) ?? '')).toBe(false)
    for (let i = 0; i < 3000; i++) expect(isSovereignKind(itemNoun(generateItem(rng, { kinds: ALL_ITEM_KINDS })) ?? '')).toBe(false)
  })

  it('a roll with no pool deals exactly what it dealt before the tier, draw for draw', () => {
    // The unfiltered generator must not have shifted: the same seed deals the same names.
    const a = new RNG(42)
    const names = Array.from({ length: 200 }, () => generateItem(a).name)
    const b = new RNG(42)
    const again = Array.from({ length: 200 }, () => generateItem(b, { kinds: undefined }).name)
    expect(again).toEqual(names)
    expect(names.some((n) => /Saffron|Moonquill|Gilded|Ironheart|Silkwind/.test(n))).toBe(false)
  })

  it('carries its own edge whatever its rarity, and the Easel holds 4', () => {
    const rng = new RNG(9)
    for (const k of SOVEREIGN_ITEM_KINDS) {
      for (const rarity of ['common', 'mythic'] as const) {
        const it = generateItem(rng, { kind: k, rarity })
        expect(itemNoun(it)).toBe(k)
        if (SOVEREIGN_EDGE[k]) expect(it.enchantments.map((e) => e.id)).toContain(SOVEREIGN_EDGE[k].id)
      }
    }
    expect(shieldHold({ name: 'Gilded Easel', slot: 'offHand' })).toBe(4)
  })

  it('is dealt at a low weight once owned: a pool with none is untouched, and each owned kind is listed once per four of any other', () => {
    const plain = runItemPool([...UNLOCK_ITEM_KINDS], 'art', null)
    expect(sovereignPool(plain)).toEqual(plain)
    const owned = runItemPool([...UNLOCK_ITEM_KINDS, 'Saffron Brand'], null, null)
    expect(owned.filter((k) => k === 'Saffron Brand')).toHaveLength(1)
    expect(owned.filter((k) => k === 'Sword')).toHaveLength(SOVEREIGN_DILUTION)
    // Measured through the generator: a Sovereign weapon is a small share of one-handers.
    const rng = new RNG(11)
    let brand = 0
    let oneHand = 0
    for (let i = 0; i < 6000; i++) {
      const it = generateItem(rng, { kinds: owned, slot: 'oneHand' })
      oneHand++
      if (itemNoun(it) === 'Saffron Brand') brand++
    }
    expect(brand / oneHand).toBeGreaterThan(0.01)
    expect(brand / oneHand).toBeLessThan(0.08)
  })

  it('unlocks one at a time from a delivered charter, each once, then nothing', () => {
    const owned: string[] = []
    for (let i = 0; i < 5; i++) {
      const k = rollSovereign(owned, i, 1)!
      expect(SOVEREIGN_ITEM_KINDS).toContain(k)
      expect(owned).not.toContain(k)
      owned.push(k)
    }
    expect(rollSovereign(owned, 5, 1)).toBeNull()
    expect(rollSovereign([], 3, 9)).toBe(rollSovereign([], 3, 9))
  })

  it('is in the Collection data with every other kind', () => {
    for (const k of SOVEREIGN_ITEM_KINDS) expect(ITEM_KINDS.map((x) => x.id)).toContain(k)
  })
})

/** The mean of the five largest numbers. */
const top5 = (xs: number[]) => [...xs].sort((a, b) => b - a).slice(0, 5).reduce((a, b) => a + b, 0) / 5

describe('the contract', () => {
  const t = { company: null, crates: 0, market: 1, charter: true } as const

  it('pays nothing at its waypoints and the whole payout at its destination, whatever the cargo', () => {
    expect(cityPay(t, 0, 100).total).toBe(0)
    expect(cityPay(t, 1, 100).total).toBe(0)
    expect(cityPay(t, CITY_COUNT - 1, 100).total).toBe(CHARTER_PAYOUT)
    expect(cityPay(t, CITY_COUNT - 1, 5).total).toBe(CHARTER_PAYOUT)
    expect(cashOutValue(t, 1, 100)).toBe(0)
    expect(contractStake(t)).toBe(CHARTER_FEE)
    expect(contractPlan(t)).toMatchObject({ stake: CHARTER_FEE, total: CHARTER_PAYOUT, profit: CHARTER_PAYOUT - CHARTER_FEE, skills: 0, items: 0 })
    expect(routeOf(t).towns).toEqual(CHARTER_TOWNS)
  })

  it('has five trade-offs, one per company, each a one-line rule', () => {
    expect(TRADE_OFFS.map((x) => x.company).sort()).toEqual([...COMPANY_IDS].sort())
    for (const x of TRADE_OFFS) {
      expect(x.rule.length).toBeLessThan(32)
      expect(x.line.split('. ').length).toBeLessThanOrEqual(2)
    }
    expect(routePrice(ITEM_PRICE.rare, t)).toBe(ITEM_PRICE.rare * CHARTER_PRICE_MULT)
    expect(routePrice(ITEM_PRICE.rare, { company: 'silk' })).toBe(ITEM_PRICE.rare)
  })

  it('lays every company’s ground on every fight — the first and the bosses too', () => {
    const map = generateRunMap(new RNG(3), {})
    for (const n of map.nodes) {
      const rule = nodeTerrainRule(n, 77, { charter: true })
      if (['battle', 'elite', 'boss', 'miniboss'].includes(n.type)) expect(rule).toBe('sovereign')
      else expect(rule).toBeNull()
    }
    expect(COMPOSITE_RULES.sovereign).toEqual(['wildfire', 'flooded', 'quarry', 'hexed'])
  })

  it('every Sovereign field keeps room to fight: open ground near the road on every field and seed', () => {
    const boost = ROUTE_HAZARDS.sovereign!
    for (const land of ALL_MAPS) {
      const plain = fieldFor(land.id, null, 'landscape', 7919)!
      const plainTop5 = top5(plain.tiles!.filter((x) => !x.block && !x.danger).map((x) => roadCoverage(plain.path, x.pos)))
      const flood = fieldFor(land.id, 'flooded', 'landscape')!
      const fire = fieldFor(land.id, 'wildfire', 'landscape')!
      for (let seed = 1; seed <= 40; seed++) {
        const f = fieldFor(land.id, 'sovereign', 'landscape', seed * 7919)!
        const tiles = f.tiles!
        // The fire and the lakes are both laid.
        for (const id of [...flood.tiles!, ...fire.tiles!].filter((x) => x.block === 'water' || x.block === 'fire').map((x) => x.id)) {
          expect(tiles.find((x) => x.id === id)!.block).toBeTruthy()
        }
        // More cursed ground than an ordinary field, never on a blocked tile.
        const cursed = tiles.filter((x) => x.danger === 'cursed')
        expect(cursed.length).toBeGreaterThan(0)
        expect(cursed.length).toBeLessThanOrEqual((3 + boost.dangerTiles!) * 4)
        // Fair: a whole company's worth of clean ground is left, and its five
        // best posts still see at least 85% of the road a plain field's do.
        const clean = tiles.filter((x) => !x.block && !x.danger)
        expect(clean.length).toBeGreaterThanOrEqual(45)
        expect(top5(clean.map((x) => roadCoverage(f.path, x.pos)))).toBeGreaterThanOrEqual(0.85 * plainTop5)
      }
    }
    // A field's hazard seed comes off the node hash, as on every road.
    expect(nodeHazardSeed({ id: 'n1-0', type: 'battle', layer: 1 }, 5, { charter: true })).toEqual(expect.any(Number))
  })

  it('the muster makes every raider stronger and greedier, from the first fight; a stake never does', () => {
    const t = { company: null, crates: 0, charter: true } as const
    expect(MUSTER_STRENGTH).toBeGreaterThan(1)
    expect(contractRules(t)).toMatchObject({ startThreat: MUSTER_STRENGTH, leakMult: MUSTER_STRENGTH, lastLeg: 1, extraElites: 0 })
    for (let c = 0; c <= 8; c++) expect(contractRules({ crates: c })).toEqual(stakeRules(c))
    expect(contractRules(null)).toEqual(stakeRules(0))
  })

  it('musters every goblin clan from the first fight, and its road fields every goblin kind', () => {
    const rules = encounterRulesOf(t)!
    const first = nodeEncounter({ type: 'battle', layer: 1, row: 0 }, 1234, rules)!
    const clans = new Set(first.spawns.map((s) => s.typeId.replace(/\d.*$/, '')))
    expect(clans).toEqual(new Set(['torch', 'tnt', 'barrel']))
    // An ordinary road's first fight is torches only.
    const plain = nodeEncounter({ type: 'battle', layer: 1, row: 0 }, 1234)!
    expect(new Set(plain.spawns.map((s) => s.typeId.replace(/\d.*$/, '')))).toEqual(new Set(['torch']))
    // Every fight on a charter's map, together: all fifteen kinds.
    const kinds = Object.keys(ENEMY_TYPES).filter((k) => !k.includes('_'))
    for (const seed of [11, 22, 33]) {
      const map = generateRunMap(new RNG(seed), {})
      const seen = new Set<string>()
      for (const n of map.nodes) {
        const w = nodeEncounter(encounterNode(n), seed, rules)
        for (const s of w?.spawns ?? []) seen.add(s.typeId.split('_')[0])
      }
      expect(kinds.filter((k) => !seen.has(k))).toEqual([])
    }
  })
})

// ---------------------------------------------------------------- the store

const g = () => useGameStore.getState()
const meta = () => useMetaStore.getState()

/** Walk the run, fighting every battle at `hp` of its HP, until `stop` holds (as `contracts.store.test`). */
function walk(stop: () => boolean, hp = 0.01) {
  setLayoutOrientation(() => 'landscape')
  for (let i = 0; i < 300 && !stop(); i++) {
    const s = g()
    if (s.runPhase !== 'active') return
    if (s.screen === 'battle' && s.lastResult) { s.continueAfterWave(); continue }
    if (s.contract?.pending != null) { s.pressOn(); continue }
    if (s.crossroads) { s.finishCrossroads(); continue }
    if (s.reward) { s.chooseReward(s.reward[0].id); continue }
    if (s.event) {
      const k = s.event.kind
      if (k === 'shrine') s.declineShrine()
      else if (k === 'recruit') s.skipRecruit()
      else if (k === 'campfire') s.campfireRest()
      else s.leaveEvent()
      continue
    }
    if (s.screen === 'battle') {
      for (const h of s.roster) {
        if (Object.values(g().placements).includes(h.id)) continue
        const slots = g().battleMap.slots
        for (let j = Math.floor(slots.length / 2); j < slots.length; j += 3) {
          useGameStore.setState({ selectedSentinelId: h.id })
          g().placeOnSlot(slots[j].id)
          if (Object.values(g().placements).includes(h.id)) break
        }
      }
      useGameStore.setState({ selectedSentinelId: null, enemyHpMult: hp })
      g().startWave()
      const e = g().engine!
      for (let t = 0; t < 200000 && e.status === 'running'; t++) {
        if (e.breather) e.resume()
        e.step(1 / 30)
      }
      g().finishBattle()
      g().skipWaveBeat()
      continue
    }
    const nodes = s.reachableNodeIds.map((id) => s.runMap.nodes.find((n) => n.id === id)!)
    s.selectNode((nodes.find((n) => n.type === 'battle') ?? nodes[0]).id)
  }
  setLayoutOrientation(null)
}

describe('the Sovereign Route, in the store', () => {
  beforeEach(() => {
    // Retire the last test's run first, so its settle lands on the old save.
    useGameStore.getState().returnToHub()
    meta().resetMeta()
  })

  it('is refused while the door is shut, or the bank cannot pay the fee', () => {
    useMetaStore.setState({ bank: 50000, stats: { ...meta().stats, runsCompleted: 4 } })
    g().signCharter()
    expect(g().screen).toBe('hub')
    devCharter.ready(0)
    useMetaStore.setState({ bank: CHARTER_FEE - 1 })
    g().signCharter()
    expect(g().screen).toBe('hub')
  })

  it('signs onto the hero pick with nothing spent; the fee leaves the bank with the hero (the purse is the company’s advance); backing out returns it all', () => {
    devCharter.ready(CHARTER_FEE + 1000)
    g().signCharter()
    expect(g().screen).toBe('heroPick')
    expect(g().contract).toMatchObject({ charter: true, company: null, crates: 0, market: 1, signed: false })
    expect(meta().bank).toBe(CHARTER_FEE + 1000)
    // No custom seed on a charter.
    expect(g().reseedRun('12345')).toBe(false)
    g().cancelHeroPick()
    expect(g().screen).toBe('hub')
    expect(meta().bank).toBe(CHARTER_FEE + 1000)
    g().signCharter()
    expect(g().contract).toMatchObject({ purse: ADVANCE, advance: true })
    g().pickStartingHero('pick-0')
    expect(meta().bank).toBe(1000)
    expect(g().contract!.signed).toBe(true)
    expect(g().gold).toBeGreaterThanOrEqual(ADVANCE)
  })

  it('deals for no company, at double the merchant’s prices, on Sovereign ground', () => {
    devCharter.ready()
    devCharter.own(1)
    useMetaStore.setState({ focus: 'metals', upgrades: { focus: 3 } })
    g().signCharter()
    g().pickStartingHero('pick-0')
    const c = g().contract!
    expect(c.hq).toMatchObject({ focus: null, boost: 0 })
    // The pool: every Level 1–3 kind once ×4, the owned Sovereign kind once.
    expect(g().itemPool.filter((k) => k === SOVEREIGN_ITEM_KINDS[0])).toHaveLength(1)
    expect(g().itemPool.filter((k) => k === 'Pavise')).toHaveLength(SOVEREIGN_DILUTION)
    // A merchant on this road.
    const merchant = g().runMap.nodes.find((n) => n.type === 'merchant')!
    useGameStore.setState({ reachableNodeIds: [merchant.id] })
    g().selectNode(merchant.id)
    const m = g().merchant!
    for (const e of m.items) expect(e.price).toBe(ITEM_PRICE[e.item.rarity] * CHARTER_PRICE_MULT)
    if (m.recruit) expect(m.recruit.price).toBe(RECRUIT_PRICE * CHARTER_PRICE_MULT)
    expect(m.repair!.price).toBe(70)
    g().leaveEvent()
    // A fight: the route's own ground.
    const fight = g().runMap.nodes.find((n) => n.type === 'battle' && !g().clearedNodeIds.includes(n.id))!
    useGameStore.setState({ reachableNodeIds: [fight.id], event: null })
    g().selectNode(fight.id)
    expect(g().battleMap.terrainRule).toBe('sovereign')
  })

  it('delivered: pays the charter, unlocks one Sovereign kind, records it, and never waits on a cash-out', () => {
    devCharter.ready()
    g().beginCampaign(1234, { kind: 'standard' }, { company: null, charter: true, crates: 0 })
    g().pickStartingHero('pick-0')
    useGameStore.setState({ roster: g().roster.map((h) => ({ ...h, level: 18 })) })
    const bank0 = meta().bank
    let waited = false
    walk(() => {
      if (g().contract?.pending != null) waited = true
      return g().runPhase !== 'active'
    }, 0.001)
    expect(waited).toBe(false)
    expect(g().runPhase).toBe('won')
    expect(g().contract!.paid).toEqual([0, 0, CHARTER_PAYOUT])
    expect(meta().bank - bank0).toBeGreaterThanOrEqual(CHARTER_PAYOUT)
    expect(meta().sovereign).toHaveLength(1)
    expect(g().victory!.progress).toMatchObject({ charter: true, sovereign: meta().sovereign[0], company: null })
    expect(meta().charters).toEqual({ runs: 1, delivered: 1 })
    // A charter is no stake: the stake record is untouched.
    expect(meta().record).toEqual({})
    // October 2026: it earns standing with all five companies — each a
    // delivered escort's standing XP with its one company.
    const p = g().victory!.progress!
    const xp = Object.values(meta().standing)
    expect(new Set(xp).size).toBe(1)
    expect(xp[0]).toBe(p.xp)
    expect(p.xp).toBeGreaterThanOrEqual(STANDING_XP.delivered)
    expect(p.standingAll).toHaveLength(COMPANY_IDS.length)
    // Every card is already unlocked (the door), so each level crossed pays a
    // Rare bonus item for the next contract instead.
    const levels = p.standingAll!.reduce((a, s) => a + s.after - s.before, 0)
    expect(levels).toBeGreaterThan(0)
    expect(p.standingCards).toEqual([])
    expect(p.standingBonus).toHaveLength(levels)
    expect(meta().bonusItems).toHaveLength(Math.min(MAX_BONUS_ITEMS, levels))
  })

  it('fallen: the fee is lost; the road’s share comes home as on any road, and a fall’s standing with all five', () => {
    devCharter.ready()
    g().beginCampaign(1234, { kind: 'standard' }, { company: null, charter: true, crates: 0 })
    g().pickStartingHero('pick-0')
    const bank0 = meta().bank
    walk(() => false, 80)
    expect(g().runPhase).toBe('lost')
    expect(g().contract!.status).toBe('lost')
    // Nothing but the road's share comes back; the fee (already paid) is gone.
    expect(meta().bank - bank0).toBeLessThan(CHARTER_FEE)
    expect(meta().sovereign).toHaveLength(0)
    expect(meta().charters).toEqual({ runs: 1, delivered: 0 })
    expect(g().victory!.outcome).toBe('lost')
    // The fall's standing (no delivery bonus), the same with every company.
    const xp = Object.values(meta().standing)
    expect(new Set(xp).size).toBe(1)
    expect(xp[0]).toBe(g().victory!.progress!.xp)
    expect(xp[0]).toBe(standingXpFor({ depth: g().victory!.depth, kills: g().victory!.kills, delivered: false }))
  })

  it('the meta save validates the Sovereign kinds and the charter record (v10), and an old save has neither', () => {
    const m = migrateMeta({ sovereign: ['Saffron Brand', 'Sword', 'Saffron Brand', 7], charters: { runs: 3, delivered: 9 } }, 10)
    expect(m.sovereign).toEqual(['Saffron Brand'])
    expect(m.charters).toEqual({ runs: 3, delivered: 3 })
    const old = migrateMeta({ bank: 400 }, 9)
    expect(old.sovereign).toEqual([])
    expect(old.charters).toEqual({ runs: 0, delivered: 0 })
    expect(migrateMeta({ charters: { runs: -4, delivered: NaN } }, 10).charters).toEqual({ runs: 0, delivered: 0 })
  })
})
