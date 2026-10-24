import { beforeEach, describe, expect, it } from 'vitest'
import { COMPANY_IDS } from '../src/game/data/companies'
import { FIRST_MAP, legacyPosts } from '../src/game/data/maps'
import { classicHero } from '../src/game/data/sentinels'
import { GameEngine, TICK } from '../src/game/engine/engine'
import type { WaveDef } from '../src/game/types'
import {
  ASK_STANDING,
  ASK_TIP,
  ASKS,
  askById,
  askGot,
  askProgressText,
  asksOf,
  askText,
  dealAsks,
  engineTally,
  fightTally,
  freshAsks,
  judgeAsks,
  nodeServesAsk,
  readAskResults,
  tallyAsks,
  type RunAsk,
} from '../src/game/run/asks'
import { CITY_COUNT, freshContract, type RunContract } from '../src/game/run/contracts'
import { contractGrant, type SettleFacts } from '../src/game/run/settle'
import { standingXpFor } from '../src/game/run/standing'
import { STANDARD_RUN, SEEDED_RUN } from '../src/state/seeds'
import { lastProgress, useMetaStore } from '../src/state/metaStore'
import { useGameStore } from '../src/state/gameStore'
import { contractSeed } from '../src/state/game/contractSlice'
import { setLayoutOrientation } from '../src/state/game/runtime'
import { RNG } from '../src/game/core/rng'
import { generateItem } from '../src/game/data/items'
import { rollShrine } from '../src/game/data/shrines'

/** A signed contract on `company`'s road carrying `asks`. */
const withAsks = (asks: RunAsk[], over: Partial<RunContract> = {}): RunContract => ({
  ...freshContract({ company: 'metals', crates: 0, market: 1 }),
  signed: true,
  asks,
  ...over,
})

const facts = (contract: RunContract, gold = 0, challenge = STANDARD_RUN): SettleFacts => ({ depth: 12, kills: 300, gold, contract, challenge })

describe('the lists', () => {
  it('every company has three asks of its own, each with words and a whole target', () => {
    for (const c of COMPANY_IDS) {
      const list = asksOf(c)
      expect(list).toHaveLength(3)
      expect(new Set(list.map((a) => a.id)).size).toBe(3)
      for (const a of list) {
        expect(a.company).toBe(c)
        expect(Number.isInteger(a.target) && a.target >= 1).toBe(true)
        expect(a.text(a.target).length).toBeGreaterThan(5)
        expect(a.label.length).toBeGreaterThan(2)
      }
    }
    expect(ASKS).toHaveLength(15)
    expect(askText({ id: 'metals.plated', target: 30 })).toBe('Fell 30 Plated raiders')
    expect(askText({ id: 'metals.elite', target: 1 })).toBe('Win an elite fight')
    expect(askText({ id: 'silk.roadGold', target: 3500 })).toBe('Deliver with 3,500 road gold')
  })
})

describe('the deal', () => {
  it('a company contract is dealt two distinct asks from its own list, the same for the same seed', () => {
    const pairs = new Set<string>()
    for (const c of COMPANY_IDS) {
      for (let seed = 1; seed < 80; seed++) {
        const a = dealAsks(seed, c)
        expect(a).toHaveLength(2)
        expect(a[0].id).not.toBe(a[1].id)
        for (const x of a) expect(x.company).toBe(c)
        expect(dealAsks(seed, c).map((x) => x.id)).toEqual(a.map((x) => x.id))
        pairs.add(a.map((x) => x.id).join('+'))
      }
    }
    // Every pair a list holds is dealt across seeds: five lists, three pairs each.
    expect(pairs.size).toBe(15)
  })

  it('the Sovereign Route is dealt three asks from three different companies, never two counting the same thing', () => {
    const companies = new Set<string>()
    for (let seed = 1; seed < 200; seed++) {
      const a = dealAsks(seed, null)
      expect(a).toHaveLength(3)
      expect(new Set(a.map((x) => x.company)).size).toBe(3)
      expect(new Set(a.map((x) => x.stat)).size).toBe(3)
      expect(dealAsks(seed, null).map((x) => x.id)).toEqual(a.map((x) => x.id))
      for (const x of a) companies.add(x.company)
    }
    expect(companies.size).toBe(COMPANY_IDS.length)
  })

  it('a run carries its asks as dealt, nothing counted', () => {
    expect(freshAsks(42, 'spice')).toEqual(dealAsks(42, 'spice').map((a) => ({ id: a.id, target: a.target, got: 0 })))
  })
})

describe('counting', () => {
  it('a tally moves only the asks that count it, and leaves a contract with none alone', () => {
    const c = withAsks([
      { id: 'metals.plated', target: 25, got: 3 },
      { id: 'metals.elite', target: 2, got: 0 },
    ])
    const t = tallyAsks(c, { platedKills: 4, wardedKills: 9, kills: 30 })
    expect(t.asks).toEqual([
      { id: 'metals.plated', target: 25, got: 7 },
      { id: 'metals.elite', target: 2, got: 0 },
    ])
    // Nothing moved: the very same object.
    expect(tallyAsks(c, { wares: 1 })).toBe(c)
    const none = freshContract({ company: 'metals', crates: 0, market: 1 })
    expect(tallyAsks(none, { platedKills: 5 })).toBe(none)
    expect(tallyAsks(null, { platedKills: 5 })).toBeNull()
  })

  it('a fight is tallied from the engine: kills by armour off the registry keys, and clean, elite, city from the result', () => {
    const e = { killCount: 20, burningKills: 6, killsByKey: new Map([['barrel3_plated', 4], ['torch1_plated', 2], ['tnt2_warded', 3], ['torch1', 11]]) }
    expect(engineTally(e)).toEqual({ kills: 20, burnKills: 6, platedKills: 6, wardedKills: 3 })
    const city = { type: 'miniboss', layer: 4 }
    expect(fightTally(e, { cleared: true, enemiesLeaked: 0, cargoBefore: 20, cargoAfter: 20, node: city })).toMatchObject({ cleanFights: 1, cleanCities: 1, eliteWins: 0 })
    // A raider through the line, or cargo the fight did not give back, is a leak.
    expect(fightTally(e, { cleared: true, enemiesLeaked: 1, cargoBefore: 20, cargoAfter: 20, node: city })).toMatchObject({ cleanFights: 0, cleanCities: 0 })
    expect(fightTally(e, { cleared: true, enemiesLeaked: 0, cargoBefore: 20, cargoAfter: 17, node: city })).toMatchObject({ cleanFights: 0 })
    expect(fightTally(e, { cleared: true, enemiesLeaked: 0, cargoBefore: 18, cargoAfter: 18, node: { type: 'elite', layer: 6 } })).toMatchObject({ cleanFights: 1, cleanCities: 0, eliteWins: 1 })
    // A lost fight still felled what it felled, and wins nothing.
    expect(fightTally(e, { cleared: false, enemiesLeaked: 0, cargoBefore: 5, cargoAfter: 0, node: { type: 'elite', layer: 6 } })).toMatchObject({ kills: 20, eliteWins: 0, cleanFights: 0 })
  })

  it('the engine counts a kill while it burns, and only then', () => {
    const P = legacyPosts(FIRST_MAP.id)
    const wave: WaveDef = { index: 1, label: 't', isBoss: false, spawns: Array.from({ length: 10 }, (_, i) => ({ typeId: 'torch1', at: i * 0.6, hpMult: 3 })) }
    const fight = (burn: boolean) => {
      const engine = new GameEngine({
        map: FIRST_MAP,
        wave,
        placedSentinels: [{ sentinel: classicHero('mystic'), slotId: P.s3 }],
        baseHp: 50,
        maxBaseHp: 50,
        teamMods: burn ? [{ burn: { dps: 6, dur: 4 } }] : [],
        seed: 3,
      })
      for (let i = 0; i < 60 * 240 && engine.status === 'running'; i++) engine.step(TICK)
      return engine
    }
    const plain = fight(false)
    const burning = fight(true)
    expect(plain.burningKills).toBe(0)
    expect(burning.burningKills).toBeGreaterThan(0)
    expect(burning.burningKills).toBeLessThanOrEqual(burning.killCount)
  })
})

describe('judging', () => {
  it('a counted ask is met by its count however the run ends; an ask judged at the end only by a delivery', () => {
    const c = withAsks(
      [
        { id: 'art.clean', target: 7, got: 7 },
        { id: 'art.cargo', target: 100, got: 0 },
      ],
      { company: 'art', cargoAt: [100, 100, 100], paid: [60, 60, 210] },
    )
    expect(judgeAsks({ contract: c, gold: 0 }, 'delivered').map((r) => r.met)).toEqual([true, true])
    expect(judgeAsks({ contract: c, gold: 0 }, 'cashedOut').map((r) => r.met)).toEqual([true, false])
    expect(judgeAsks({ contract: c, gold: 0 }, 'lost').map((r) => r.met)).toEqual([true, false])
    // The cargo is read off the destination's reading, not a stored count.
    const hurt = { ...c, cargoAt: [100, 100, 95] }
    expect(judgeAsks({ contract: hurt, gold: 0 }, 'delivered')[1]).toMatchObject({ got: 95, met: false })
  })

  it('the road\'s gold and the gold earned are read off the purse and the contract', () => {
    const c = withAsks(
      [
        { id: 'silk.roadGold', target: 3500, got: 0 },
        { id: 'silk.earned', target: 3900, got: 0 },
      ],
      { company: 'silk', purse: 60, advance: true, earned: 4000, cargoAt: [100, 100, 100] },
    )
    // 3,700 in hand after spending 360: spending comes out of the advance
    // first (`hq.homeGold`), so every gold left is the road's.
    const r = judgeAsks({ contract: c, gold: 3700 }, 'delivered')
    expect(r[0]).toMatchObject({ got: 3700, met: true })
    // With nothing spent, the 60 advance in hand is not the road's.
    expect(judgeAsks({ contract: c, gold: 4060 }, 'delivered')[0].got).toBe(4000)
    expect(r[1]).toMatchObject({ got: 4000, met: true })
    expect(askGot(c.asks![1], { contract: c, gold: 0 })).toBe(4000)
    expect(askProgressText(c.asks![0], 3640)).toBe('3,640/3,500')
    expect(askProgressText({ id: 'metals.plated', target: 25 }, 40)).toBe('25/25')
  })

  it('the map tags only the nodes that serve an ask', () => {
    const elite = { id: 'metals.elite', target: 2, got: 0 }
    expect(nodeServesAsk(elite, { type: 'elite', layer: 5 }, null)).toBe(true)
    expect(nodeServesAsk(elite, { type: 'battle', layer: 5 }, null)).toBe(false)
    expect(nodeServesAsk({ id: 'metals.plated', target: 25, got: 0 }, { type: 'battle', layer: 5 }, 'plated')).toBe(true)
    expect(nodeServesAsk({ id: 'metals.plated', target: 25, got: 0 }, { type: 'battle', layer: 5 }, 'warded')).toBe(false)
    expect(nodeServesAsk({ id: 'scrolls.city', target: 2, got: 0 }, { type: 'miniboss', layer: 8 }, null)).toBe(true)
    expect(nodeServesAsk({ id: 'silk.wares', target: 4, got: 0 }, { type: 'merchant', layer: 3 }, null)).toBe(true)
    expect(nodeServesAsk({ id: 'scrolls.pact', target: 1, got: 0 }, { type: 'shrine', layer: 3 }, null)).toBe(true)
    // An ask every fight serves tags none.
    expect(nodeServesAsk({ id: 'spice.felled', target: 260, got: 0 }, { type: 'battle', layer: 3 }, null)).toBe(false)
  })

  it('a judged list from a settle is validated: known ids once, the catalogue\'s company, met only when true', () => {
    const r = readAskResults([
      { id: 'metals.plated', company: 'spice', target: 25, got: 30, met: true },
      { id: 'metals.plated', company: 'metals', target: 25, got: 30, met: true },
      { id: 'nope', met: true },
      { id: 'metals.elite', target: 2, got: 2, met: 'yes' },
    ])
    expect(r).toEqual([
      { id: 'metals.plated', company: 'metals', target: 25, got: 30, met: true },
      { id: 'metals.elite', company: 'metals', target: 2, got: 2, met: false },
    ])
    expect(readAskResults('all of them')).toEqual([])
  })
})

describe('the pay plan', () => {
  beforeEach(() => useMetaStore.getState().resetMeta())

  const met = withAsks(
    [
      { id: 'metals.plated', target: 25, got: 30 },
      { id: 'metals.elite', target: 2, got: 1 },
    ],
    { cargoAt: [100, 100, 100], paid: [60, 60, 210], status: 'delivered' },
  )

  it('the grant carries the asks judged, from the same facts both settles read', () => {
    const g = contractGrant(facts(met), 'delivered')
    expect(g.asks).toEqual([
      { id: 'metals.plated', company: 'metals', target: 25, got: 30, met: true },
      { id: 'metals.elite', company: 'metals', target: 2, got: 1, met: false },
    ])
    // A contract with no asks grants none.
    expect('asks' in contractGrant(facts(freshContract({ company: 'metals', crates: 0, market: 1 })), 'lost')).toBe(false)
  })

  it('a delivery pays each ask met its standing and its tip', () => {
    const bank0 = useMetaStore.getState().bank
    const g = contractGrant(facts(met), 'delivered')
    const banked = useMetaStore.getState().settleContract(g)
    const interest = lastProgress.run!.interest
    expect(banked).toBe(g.deposit + ASK_TIP + interest)
    expect(useMetaStore.getState().bank - bank0).toBe(banked)
    const base = standingXpFor({ depth: 12, kills: 300, delivered: true })
    expect(useMetaStore.getState().standing.metals).toBe(base + ASK_STANDING)
    expect(lastProgress.run).toMatchObject({ xp: base + ASK_STANDING, askXp: ASK_STANDING, askTips: ASK_TIP })
    expect(lastProgress.run!.asks.map((a) => a.met)).toEqual([true, false])
  })

  it('a fall keeps the standing of an ask met on the road, and banks no tip', () => {
    const lost = { ...met, status: 'lost' as const, paid: [60], cargoAt: [100] }
    const g = contractGrant({ ...facts(lost), depth: 5, kills: 100 }, 'lost')
    const banked = useMetaStore.getState().settleContract(g)
    expect(banked).toBe(g.deposit)
    expect(useMetaStore.getState().standing.metals).toBe(standingXpFor({ depth: 5, kills: 100, delivered: false }) + ASK_STANDING)
    expect(lastProgress.run!.askTips).toBe(0)
  })

  it('a custom seed earns neither', () => {
    const g = contractGrant(facts(met, 0, SEEDED_RUN), 'delivered')
    const banked = useMetaStore.getState().settleContract(g)
    expect(banked).toBe(g.deposit)
    expect(useMetaStore.getState().standing.metals).toBe(0)
    expect(lastProgress.run).toMatchObject({ askXp: 0, askTips: 0 })
  })

  it('on the Sovereign Route each ask met pays the company whose ask it is', () => {
    const charter: RunContract = {
      ...freshContract({ company: null, crates: 0, market: 1, charter: true }),
      signed: true,
      status: 'delivered',
      paid: [0, 0, 1000],
      cargoAt: Array<number>(CITY_COUNT).fill(100),
      asks: [
        { id: 'spice.burning', target: 120, got: 130 },
        { id: 'metals.plated', target: 25, got: 4 },
        { id: 'scrolls.pact', target: 1, got: 1 },
      ],
    }
    const g = contractGrant(facts(charter), 'delivered')
    useMetaStore.getState().settleContract(g)
    const s = useMetaStore.getState().standing
    const p = lastProgress.run!
    expect(s.spice).toBe(p.xp + ASK_STANDING)
    expect(s.scrolls).toBe(p.xp + ASK_STANDING)
    expect(s.metals).toBe(p.xp)
    expect(s.art).toBe(p.xp)
    expect(p.askTips).toBe(2 * ASK_TIP)
    expect(askById('scrolls.pact')!.company).toBe('scrolls')
  })
})

describe('in the store', () => {
  const g = () => useGameStore.getState()
  beforeEach(() => {
    useMetaStore.getState().resetMeta()
    // Not a first contract: the board, its terms and its asks are open.
    useMetaStore.setState((s) => ({ stats: { ...s.stats, runsCompleted: 2 } }))
  })

  it('signs the asks the terms showed, nothing counted, and a first contract is asked nothing', () => {
    g().openContracts()
    const board = g().board!
    const shown = dealAsks(contractSeed(board.seed, board.company), board.company).map((a) => a.id)
    g().signContract()
    expect(g().contract!.asks!.map((a) => a.id)).toEqual(shown)
    expect(g().contract!.asks!.every((a) => a.got === 0)).toBe(true)
    // A first contract (LS3) never saw the terms that would name them.
    useMetaStore.getState().resetMeta()
    g().openContracts()
    expect(g().firstRun).toBe(true)
    expect(g().contract!.asks).toBeUndefined()
  })

  it('counts a fight\'s kills, a ware bought and a pact taken', () => {
    g().openContracts()
    // A fixed road: the board's seed is random, and on about one road in 25
    // (board seed 4, say) the post this test picks never sees a goblin, so
    // the fight counted nothing and the test failed by chance.
    useGameStore.setState({ board: { ...g().board!, seed: 1 } })
    g().signContract()
    g().pickStartingHero('pick-0')
    useGameStore.setState({
      contract: {
        ...g().contract!,
        asks: [
          { id: 'spice.felled', target: 260, got: 0 },
          { id: 'silk.wares', target: 4, got: 0 },
          { id: 'scrolls.pact', target: 1, got: 0 },
        ],
      },
    })
    // One fight, against weakened raiders so it is won.
    setLayoutOrientation(() => 'landscape')
    const st = g()
    const fight = st.reachableNodeIds.find((id) => st.runMap.nodes.find((n) => n.id === id)?.type === 'battle') ?? st.reachableNodeIds[0]
    st.selectNode(fight)
    const slots = g().battleMap.slots
    const hero = g().roster[0].id
    for (let j = Math.floor(slots.length / 2); j < slots.length && !Object.values(g().placements).includes(hero); j += 3) {
      useGameStore.setState({ selectedSentinelId: hero })
      g().placeOnSlot(slots[j].id)
    }
    expect(Object.values(g().placements)).toContain(hero)
    useGameStore.setState({ selectedSentinelId: null, enemyHpMult: 0.3 })
    g().startWave()
    const e = g().engine!
    for (let t = 0; t < 200000 && e.status === 'running'; t++) {
      if (e.breather) e.resume()
      e.step(1 / 30)
    }
    const felled = e.killCount
    g().finishBattle()
    g().skipWaveBeat()
    setLayoutOrientation(null)
    expect(felled).toBeGreaterThan(0)
    expect(g().contract!.asks![0].got).toBe(felled)
    expect(g().engine).toBeNull()

    // A ware off a merchant's shelf.
    const item = generateItem(new RNG(9), { rarity: 'common' })
    useGameStore.setState({ event: { kind: 'merchant', nodeId: 'nowhere' }, merchant: { items: [{ item, price: 1 }], repair: null, rerolls: 0 }, gold: 50 })
    g().buyMerchantItem(item.id)
    expect(g().contract!.asks![1].got).toBe(1)
    // A shrine's pact.
    useGameStore.setState({ event: { kind: 'shrine', nodeId: 'nowhere' }, shrineOffer: rollShrine(new RNG(5)) })
    g().acceptShrine()
    expect(g().contract!.asks![2].got).toBe(1)
    // Declined, it counts nothing.
    useGameStore.setState({ event: { kind: 'shrine', nodeId: 'nowhere' }, shrineOffer: rollShrine(new RNG(6)) })
    g().declineShrine()
    expect(g().contract!.asks![2].got).toBe(1)
  })
})
