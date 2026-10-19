import { describe, expect, it } from 'vitest'
import { HQ_IDS, HQ_LEVELS_MAX, HQ_STAGES, hqCost, hqLevelsBought, hqMax, hqStage, hqUpgrade } from '../src/game/run/hq'
import { ctaWords, firstFocus, hqCard, hqCards, hqMark, HQ_ORDER, STAGE_MARK, stageLine } from '../src/ui/shell/hq/hqModel'
import { ICON_ORDER } from '../src/game/data/iconAtlas'

const ALL = Object.fromEntries(HQ_IDS.map((id) => [id, hqMax(id)]))

describe('the castle grows with the upgrades (hq.hqStage)', () => {
  it('counts every level bought, clamped, unknown ids ignored', () => {
    expect(hqLevelsBought(undefined)).toBe(0)
    expect(hqLevelsBought({})).toBe(0)
    expect(hqLevelsBought({ deal: 2, pack: 1 })).toBe(3)
    expect(hqLevelsBought({ deal: 99, rate: 3, rocks: 2, nope: 7 })).toBe(hqMax('deal'))
    expect(hqLevelsBought({ deal: -4, pack: Number.NaN, focus: 1.9 })).toBe(1)
    expect(hqLevelsBought(ALL)).toBe(HQ_LEVELS_MAX)
    expect(HQ_LEVELS_MAX).toBe(15)
  })

  it('is a ladder: four stages, from 0, rising, the last reachable', () => {
    expect(HQ_STAGES.map((s) => s.id)).toEqual(['lodge', 'watchtower', 'castle', 'stronghold'])
    expect(HQ_STAGES[0].from).toBe(0)
    for (let i = 1; i < HQ_STAGES.length; i++) expect(HQ_STAGES[i].from).toBeGreaterThan(HQ_STAGES[i - 1].from)
    expect(HQ_STAGES.at(-1)!.from).toBeLessThanOrEqual(HQ_LEVELS_MAX)
  })

  it('stands at the stage its levels reach, and says how far the next is', () => {
    const at = (n: number) => {
      // n levels spread over the purchases in order.
      const lv: Record<string, number> = {}
      let left = n
      for (const id of HQ_IDS) {
        lv[id] = Math.min(hqMax(id), left)
        left -= lv[id]
      }
      return hqStage(lv)
    }
    expect(at(0)).toMatchObject({ index: 0, bought: 0, toNext: 3 })
    expect(at(0).stage.id).toBe('lodge')
    expect(at(2).stage.id).toBe('lodge')
    expect(at(3).stage.id).toBe('watchtower')
    expect(at(6)).toMatchObject({ toNext: 1 })
    expect(at(7).stage.id).toBe('castle')
    expect(at(11).stage.id).toBe('castle')
    expect(at(12).stage.id).toBe('stronghold')
    expect(at(15)).toMatchObject({ next: null, toNext: 0, bought: 15 })
    // Every count lands on exactly one stage, and the stage never goes back.
    let last = -1
    for (let n = 0; n <= HQ_LEVELS_MAX; n++) {
      const s = at(n)
      expect(s.index).toBeGreaterThanOrEqual(last)
      last = s.index
      expect(s.bought).toBe(n)
      if (s.next) expect(s.next.from - n).toBe(s.toNext)
    }
  })

  it('has a home-plate mark per stage, in the atlas', () => {
    for (const s of HQ_STAGES) expect(ICON_ORDER).toContain(STAGE_MARK[s.id])
    expect(hqMark({})).toBe('hqLodge')
    expect(hqMark(ALL)).toBe('hqStronghold')
  })

  it('says the next stage in words', () => {
    expect(stageLine({})).toBe('Watchtower in 3 upgrades')
    expect(stageLine({ deal: 2 })).toBe('Watchtower in 1 upgrade')
    expect(stageLine({ deal: 5, hiring: 1, pack: 4, focus: 2 })).toBe('12 of 15 upgrades')
    expect(stageLine(ALL)).toBe('Every upgrade bought')
  })
})

describe('the HQ page as data (hqModel)', () => {
  const facts = { levels: {}, bank: 0, runs: 9, focus: null }

  it('shows every upgrade once, in the page order, with its own mark', () => {
    expect([...HQ_ORDER].sort()).toEqual([...HQ_IDS].sort())
    const cards = hqCards(facts)
    expect(cards.map((c) => c.id)).toEqual([...HQ_ORDER])
    expect(new Set(cards.map((c) => c.mark)).size).toBe(cards.length)
    for (const c of cards) expect(ICON_ORDER).toContain(c.mark)
  })

  it('reads its prices and levels off hq.ts, never its own', () => {
    for (const id of HQ_IDS)
      for (let lv = 0; lv <= hqMax(id); lv++) {
        const c = hqCard(id, { ...facts, levels: { [id]: lv }, bank: 99999 })
        expect(c.name).toBe(hqUpgrade(id)!.name)
        expect(c.cost).toBe(hqCost(id, lv))
        expect(c.level).toBe(lv)
        expect(c.state).toBe(lv >= hqMax(id) ? 'max' : 'buy')
        expect(c.next == null).toBe(lv >= hqMax(id))
      }
  })

  it('has four states: buy, short (by how much), max and locked', () => {
    expect(hqCard('pack', { ...facts, bank: 150 })).toMatchObject({ state: 'buy', short: 0 })
    expect(hqCard('pack', { ...facts, bank: 40 })).toMatchObject({ state: 'short', short: 110 })
    expect(hqCard('hiring', { ...facts, levels: { hiring: 1 } })).toMatchObject({ state: 'max', cost: null })
    const locked = hqCard('focus', { ...facts, runs: 2, bank: 9999 })
    expect(locked.state).toBe('locked')
    expect(locked.locked).toMatch(/5th finished contract/)
    expect(hqCard('focus', { ...facts, runs: 5, bank: 9999 }).state).toBe('buy')
  })

  it('opens on the first upgrade the bank can buy', () => {
    expect(firstFocus(hqCards({ ...facts, bank: 160 }))).toBe('deal')
    expect(firstFocus(hqCards({ ...facts, bank: 160, levels: { deal: 1 } }))).toBe('pack')
    expect(firstFocus(hqCards({ ...facts, bank: 0, levels: { deal: 5 } }))).toBe('hiring')
    expect(firstFocus(hqCards({ ...facts, levels: ALL }))).toBe('deal')
  })

  it('says each effect as the number and what it touches, in a line that fits', () => {
    for (const id of HQ_IDS)
      for (let lv = 0; lv <= hqMax(id); lv++)
        for (const focus of [null, 'spice'] as const) {
          const c = hqCard(id, { ...facts, levels: { [id]: lv }, focus })
          expect(c.now.length).toBeLessThanOrEqual(60)
          if (c.next) expect(c.next.length).toBeLessThanOrEqual(60)
          expect(c.now).not.toMatch(/\.$/)
        }
    expect(hqCard('pack', facts)).toMatchObject({ now: '6 slots', next: '7 slots' })
    expect(hqCard('focus', { ...facts, levels: { focus: 1 }, focus: 'spice' })).toMatchObject({ now: '+15% Spice', next: '+30% Spice' })
    expect(hqCard('deal', facts).next).toBe('Body armour and an off-hand on every hero')
  })

  it('names the CTA for each state', () => {
    expect(ctaWords(hqCard('pack', { ...facts, bank: 999 }))).toBe('Upgrade Pack slots')
    expect(ctaWords(hqCard('hiring', { ...facts, bank: 999 }))).toBe('Open the Hiring Hall')
    expect(ctaWords(hqCard('hiring', { ...facts, levels: { hiring: 1 } }))).toBe('Fully upgraded')
    expect(ctaWords(hqCard('focus', { ...facts, runs: 0 }))).toBe('Opens after 5 contracts')
  })
})
