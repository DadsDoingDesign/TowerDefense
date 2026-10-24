import { describe, expect, it } from 'vitest'
import {
  CASTLE_PARTS,
  CASTLE_TIERS,
  castlePart,
  castleTier,
  HQ_IDS,
  HQ_LEVELS_MAX,
  hqCost,
  hqLevelsBought,
  hqMax,
  hqUpgrade,
} from '../src/game/run/hq'
import { ctaWords, firstFocus, hqCard, hqCards, hqMark, HQ_ORDER, TIER_MARK, tierLine } from '../src/ui/shell/hq/hqModel'
import { CASTLE_SCENE, CASTLE_SHEETS } from '../src/ui/shell/hq/castleScene.generated'
import { ICON_ORDER } from '../src/game/data/iconAtlas'

const ALL = Object.fromEntries(HQ_IDS.map((id) => [id, hqMax(id)]))
const tierOf = (lv: Record<string, number>) => castleTier(lv).tier.id

describe('the castle: a part per upgrade (hq.castlePart)', () => {
  it('gives every upgrade its own part', () => {
    const ids = HQ_IDS.map((id) => CASTLE_PARTS[id].id)
    expect(new Set(ids).size).toBe(HQ_IDS.length)
    expect(castlePart('scouting', 1)).toEqual({ id: 'lookout', name: 'Lookout', level: 1, max: 2 })
    expect(castlePart('deal', 0).id).toBe('yard')
  })

  it('clamps the level to the upgrade’s range', () => {
    expect(castlePart('pack', 99).level).toBe(4)
    expect(castlePart('pack', -3).level).toBe(0)
    expect(castlePart('hiring', Number.NaN).level).toBe(0)
    expect(castlePart('focus', 2.7).level).toBe(2)
  })

  it('has a baked sprite for every part at every level, in every tier, inside the scene', () => {
    for (const t of CASTLE_TIERS)
      for (const id of HQ_IDS) {
        const layers = CASTLE_SHEETS[t.id].layers[CASTLE_PARTS[id].id]
        expect(layers).toHaveLength(hqMax(id) + 1)
        for (const [sx, sy, w, h, x, y] of layers) {
          expect(sy).toBeGreaterThanOrEqual(CASTLE_SCENE.h)
          expect(sx + w).toBeLessThanOrEqual(CASTLE_SCENE.w)
          expect(sy + h).toBeLessThanOrEqual(CASTLE_SHEETS[t.id].h)
          expect(x).toBeGreaterThanOrEqual(0)
          expect(y).toBeGreaterThanOrEqual(0)
          expect(x + w).toBeLessThanOrEqual(CASTLE_SCENE.w)
          expect(y + h).toBeLessThanOrEqual(CASTLE_SCENE.h)
        }
      }
  })
})

describe('the castle’s quality: a milestone across every upgrade (hq.castleTier)', () => {
  it('is a ladder of four, from Timber, ending with everything maxed', () => {
    expect(CASTLE_TIERS.map((t) => t.id)).toEqual(['timber', 'stone', 'fortified', 'grand'])
    expect(CASTLE_TIERS[0].needs).toEqual({})
    expect(CASTLE_TIERS.at(-1)!.needs).toEqual(ALL)
    // Each mark asks at least what the one before did, and never past a max.
    for (let i = 1; i < CASTLE_TIERS.length; i++)
      for (const id of HQ_IDS) {
        expect(CASTLE_TIERS[i].needs[id] ?? 0).toBeGreaterThanOrEqual(CASTLE_TIERS[i - 1].needs[id] ?? 0)
        expect(CASTLE_TIERS[i].needs[id] ?? 0).toBeLessThanOrEqual(hqMax(id))
      }
  })

  it('reads the LOWEST upgrade: one short keeps the whole castle back', () => {
    expect(tierOf({})).toBe('timber')
    expect(tierOf({ deal: 5, hiring: 1, pack: 4, scouting: 0 })).toBe('timber')
    expect(tierOf({ deal: 1, hiring: 1, pack: 1, scouting: 1 })).toBe('stone')
    // Company focus opens late (the fifth contract), so Stone does not ask for it…
    expect(tierOf({ deal: 1, hiring: 1, pack: 1, scouting: 1, focus: 0 })).toBe('stone')
    // …and Fortified does: halfway on every upgrade.
    expect(tierOf({ deal: 3, hiring: 1, pack: 2, scouting: 1, focus: 1 })).toBe('stone')
    expect(tierOf({ deal: 3, hiring: 1, pack: 2, scouting: 1, focus: 2 })).toBe('fortified')
    expect(tierOf({ ...ALL, focus: 2 })).toBe('fortified')
    expect(tierOf(ALL)).toBe('grand')
  })

  it('never falls back as levels rise, one level at a time in any order', () => {
    const orders = [HQ_IDS, [...HQ_IDS].reverse(), ['focus', 'scouting', 'deal', 'pack', 'hiring'] as const]
    for (const order of orders) {
      const lv: Record<string, number> = {}
      let last = 0
      for (let step = 0; step < HQ_LEVELS_MAX; step++) {
        const id = order.find((i) => (lv[i] ?? 0) < hqMax(i))!
        lv[id] = (lv[id] ?? 0) + 1
        const t = castleTier(lv)
        expect(t.index).toBeGreaterThanOrEqual(last)
        last = t.index
      }
      expect(hqLevelsBought(lv)).toBe(HQ_LEVELS_MAX)
      expect(last).toBe(3)
    }
  })

  it('names what the next tier still needs, and nothing at the last', () => {
    expect(castleTier({ deal: 1, hiring: 1 }).missing).toEqual([
      { id: 'pack', have: 0, need: 1 },
      { id: 'scouting', have: 0, need: 1 },
    ])
    expect(castleTier(ALL)).toMatchObject({ next: null, missing: [] })
    expect(castleTier({ deal: 99, rate: 3, nope: 7 } as Record<string, number>).tier.id).toBe('timber')
  })

  it('says the next milestone in one line', () => {
    expect(tierLine({ deal: 1, hiring: 1 })).toBe('Stone castle: raise Pack slots and Scouts to level 1')
    expect(tierLine({ deal: 1, hiring: 1, pack: 1 })).toBe('Stone castle: raise Scouts to level 1')
    expect(tierLine({ deal: 2, hiring: 1, pack: 2, scouting: 1, focus: 1 })).toBe('Fortified castle: raise Opening deal to 3 and Company focus to 2')
    expect(tierLine({})).toBe('Stone castle: raise Opening deal, Hiring Hall, Pack slots and Scouts to level 1')
    expect(tierLine({ ...ALL, deal: 3, pack: 2, focus: 2 })).toBe('Grand castle: max the last 3 upgrades')
    expect(tierLine({ ...ALL, deal: 4 })).toBe('Grand castle: raise Opening deal to level 5')
    expect(tierLine(ALL)).toBe('Every upgrade bought')
  })

  it('has a home-plate mark per tier, in the atlas', () => {
    for (const t of CASTLE_TIERS) expect(ICON_ORDER).toContain(TIER_MARK[t.id])
    expect(hqMark({})).toBe('hqTimber')
    expect(hqMark({ deal: 1, hiring: 1, pack: 1, scouting: 1 })).toBe('hqStone')
    expect(hqMark(ALL)).toBe('hqGrand')
  })
})

describe('the HQ page as data (hqModel)', () => {
  const facts = { levels: {}, bank: 0, runs: 9, focus: null }

  it('shows every upgrade once, in the page order, with its own mark and part', () => {
    expect([...HQ_ORDER].sort()).toEqual([...HQ_IDS].sort())
    const cards = hqCards(facts)
    expect(cards.map((c) => c.id)).toEqual([...HQ_ORDER])
    expect(new Set(cards.map((c) => c.mark)).size).toBe(cards.length)
    expect(new Set(cards.map((c) => c.part)).size).toBe(cards.length)
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
