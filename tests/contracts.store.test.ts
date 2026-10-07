import { beforeEach, describe, expect, it } from 'vitest'
import { homeGold, homeTotal } from '../src/game/run/hq'
import { useGameStore } from '../src/state/gameStore'
import { NEW_BANK, useMetaStore } from '../src/state/metaStore'
import { ADVANCE, cashOutValue, cityPay, CRATE_PRICE, STAKES_OPEN_AT } from '../src/game/run/contracts'
import { standingXpToReach } from '../src/game/run/standing'
import { useSettingsStore } from '../src/state/settingsStore'
import { setLayoutOrientation } from '../src/state/game/runtime'

/** The contract in the store: signing, a city's pay, cash out, and a fall. */
const g = () => useGameStore.getState()

/** Walk the run, fighting every battle at a sliver of HP, until `stop` holds. */
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

describe('a contract, in the store', () => {
  beforeEach(() => {
    useMetaStore.getState().resetMeta()
    useMetaStore.setState({ bank: 1000, stats: { ...useMetaStore.getState().stats, runsCompleted: 3 }, standing: { spice: 0, art: 2000, metals: 0, silk: 0, scrolls: 0 } })
  })

  it('the terms clamp the stake to the standing cap and the bank, and signing takes nothing until the hero', () => {
    g().openContracts({ company: 'metals', crates: 6 })
    expect(g().board!.crates).toBe(0) // standing 0 with Ironvein: escort only until standing 2
    g().boardBack()
    g().openContracts({ company: 'art' })
    g().setCrates(6)
    expect(g().board!.crates).toBe(6)
    g().signContract()
    expect(g().screen).toBe('heroPick')
    expect(useMetaStore.getState().bank).toBe(1000)
    g().pickStartingHero('pick-0')
    // The stake leaves the bank; the purse is the company's advance and does not.
    expect(useMetaStore.getState().bank).toBe(1000 - 6 * CRATE_PRICE)
    expect(g().contract).toMatchObject({ company: 'art', crates: 6, purse: ADVANCE, advance: true, signed: true })
    expect(g().gold).toBe(ADVANCE)
  })

  it('stakes open per company at standing 2 with it (the staggered reveal)', () => {
    const at = (xp: number) => {
      useMetaStore.setState({ standing: { spice: 0, art: 0, metals: xp, silk: 0, scrolls: 0 } })
      g().openContracts({ company: 'metals' })
      g().setCrates(2)
      return g().board!.crates
    }
    expect(at(standingXpToReach(1))).toBe(0)
    expect(at(standingXpToReach(STAKES_OPEN_AT))).toBe(2)
    // "Show everything from the start" opens them at any standing.
    useSettingsStore.setState({ showEverything: true })
    expect(at(0)).toBe(1)
    useSettingsStore.setState({ showEverything: false })
  })

  it('the menu is the board: a focused road opens its terms, and back keeps it focused', () => {
    useMetaStore.setState({ standing: { spice: 0, art: standingXpToReach(2), metals: 0, silk: 0, scrolls: 0 } })
    useGameStore.setState({ screen: 'hub', board: null, homeFocus: null })
    // A road not hiring yet (the Scriptorium opens at Standing 3) can be focused; its terms cannot be opened.
    g().focusRoad('scrolls')
    expect(g().homeFocus).toBe('scrolls')
    expect(g().screen).toBe('hub')
    g().focusRoad('art')
    g().openContracts()
    expect(g().screen).toBe('contracts')
    expect(g().board!.company).toBe('art')
    g().boardBack()
    expect(g().screen).toBe('hub')
    expect(g().board).toBeNull()
    expect(g().homeFocus).toBe('art')
    // A company asked for that does not hire falls back to the focus.
    g().openContracts({ company: 'scrolls' })
    expect(g().board!.company).toBe('art')
  })

  it('choosing the hero marches straight into the first layer’s middle fight', () => {
    g().openContracts({ company: 'art' })
    g().signContract()
    const { runMap, reachableNodeIds } = g()
    const first = runMap.nodes.filter((n) => reachableNodeIds.includes(n.id) && n.type === 'battle')
    g().marchOut('pick-0')
    expect(g().screen).toBe('battle')
    expect(g().battlePhase).toBe('setup')
    const at = runMap.nodes.find((n) => n.id === g().activeNodeId)!
    expect(at.layer).toBe(1)
    expect(Math.abs(at.ny - 0.5)).toBe(Math.min(...first.map((n) => Math.abs(n.ny - 0.5))))
  })

  it('an older save’s contract set up before the advance still takes its purse from the bank', () => {
    g().beginCampaign(1234, { kind: 'standard' }, { company: 'art', crates: 2 })
    useGameStore.setState({ contract: { ...g().contract!, purse: 100, advance: false }, gold: 100 })
    g().pickStartingHero('pick-0')
    expect(useMetaStore.getState().bank).toBe(1000 - 2 * CRATE_PRICE - 100)
    expect(g().contract).toMatchObject({ purse: 100, signed: true })
    expect(g().contract!.advance).toBeFalsy()
  })

  it('backing out of the hero pick returns to the terms, with nothing spent', () => {
    g().openContracts({ company: 'art', crates: 2 })
    g().signContract()
    g().cancelHeroPick()
    expect(g().screen).toBe('contracts')
    expect(g().board).toMatchObject({ company: 'art', crates: 2 })
    expect(useMetaStore.getState().bank).toBe(1000)
  })

  it('the first city pays by the cargo that arrives, then waits on cash out or press on; cashing out banks it once', () => {
    g().beginCampaign(1234, { kind: 'standard' }, { company: 'art', crates: 4 })
    g().pickStartingHero('pick-0')
    useGameStore.setState({ roster: g().roster.map((h) => ({ ...h, level: 15 })) })
    walk(() => g().contract!.pending != null)
    const c = g().contract!
    expect(c.pending).toBe(0)
    expect(c.paid).toHaveLength(1)
    expect(c.paid[0]).toBe(cityPay(c, 0, c.cargoAt[0]).total)
    // The road waits: no march while the city's question is open.
    useGameStore.setState({ screen: 'map' })
    const before = useMetaStore.getState().bank
    const runsBefore = useMetaStore.getState().stats.runsCompleted
    const gold = g().gold
    const sale = cashOutValue(c, 1, Math.round((100 * g().baseHp) / g().maxBaseHp))
    g().cashOut()
    expect(g().runPhase).toBe('cashedOut')
    expect(g().contract!.status).toBe('cashedOut')
    // A share of the road's gold comes home (`hq.homeGold`; the advance stays
    // with the company); interest and any feat's gold land on top.
    const home = homeTotal(homeGold({ purse: c.purse, earned: c.earned, gold, advance: c.advance }))
    expect(home).toBeLessThan(gold)
    expect(useMetaStore.getState().bank - before).toBeGreaterThanOrEqual(c.paid[0] + sale + home)
    expect(useMetaStore.getState().stats.runsCompleted).toBe(runsBefore + 1)
    // Settled once: leaving does not pay it again.
    const after = useMetaStore.getState().bank
    g().returnToHub()
    expect(useMetaStore.getState().bank).toBe(after)
    expect(g().victory).toBeNull()
  })

  it('a delivery pays all three cities and deals the contract’s unlocks', () => {
    // A fixed seed: the walk fights at a sliver of HP, and a seed it can lose
    // (a lobbed charge) would make this a coin flip.
    g().beginCampaign(1234, { kind: 'standard' }, { company: 'art', crates: 2 })
    g().pickStartingHero('pick-0')
    useGameStore.setState({ roster: g().roster.map((h) => ({ ...h, level: 18 })) })
    walk(() => g().runPhase !== 'active', 0.001)
    expect(g().runPhase).toBe('won')
    expect(g().contract!.paid).toHaveLength(3)
    expect(g().contract!.status).toBe('delivered')
    expect(g().victory!.outcome).toBe('delivered')
    expect(g().victory!.progress!.contractCards.length).toBeGreaterThanOrEqual(1)
    expect(useMetaStore.getState().record['2']).toEqual({ runs: 1, delivered: 1 })
  })

  it('a fall keeps what the cities paid, and loses the unsold crates', () => {
    g().beginCampaign(1234, { kind: 'standard' }, { company: 'art', crates: 4 })
    g().pickStartingHero('pick-0')
    useGameStore.setState({ roster: g().roster.map((h) => ({ ...h, level: 15 })) })
    walk(() => g().contract!.pending != null)
    g().pressOn()
    const paid = g().contract!.paid[0]
    const before = useMetaStore.getState().bank
    walk(() => false, 60)
    expect(g().runPhase).toBe('lost')
    expect(g().contract!.status).toBe('lost')
    expect(useMetaStore.getState().bank - before).toBeGreaterThanOrEqual(paid)
    expect(g().victory!.deposit).toBeGreaterThanOrEqual(paid)
    expect(g().victory!.outcome).toBe('lost')
  })

  it('a new militia starts with a bank', () => {
    useMetaStore.getState().resetMeta()
    expect(useMetaStore.getState().bank).toBe(NEW_BANK)
  })
})
