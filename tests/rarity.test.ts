import { describe, expect, it } from 'vitest'
import { RNG } from '../src/game/core/rng'
import { ACT_LUCK, effectiveLuck, generateItem, PITY_CAP, RARITY_BY_ACT, RARITY_ORDER, rarityWeights } from '../src/game/data/items'
import { ACT_LAYERS, ACTS } from '../src/game/run/threat'
import { RELIC_ACT_TILT } from '../src/game/run/relics'
import type { ItemRarity } from '../src/game/types'

/** The share of `n` unforced rolls at `depth` that land Epic or better. */
function epicShare(depth: number, n: number, luck = 0, dry = 0): number {
  const rng = new RNG(1234 + depth)
  let hits = 0
  for (let i = 0; i < n; i++) {
    const r = generateItem(rng, { depth, luck, pity: { dry }, commitPity: false }).rarity
    if (RARITY_ORDER.indexOf(r) >= RARITY_ORDER.indexOf('epic')) hits++
  }
  return hits / n
}

describe('rarity follows the run (data/items, the gameplay pass)', () => {
  it('has one row per act, and no tier is ever zero — an early purple stays possible', () => {
    expect(RARITY_BY_ACT).toHaveLength(ACTS)
    for (const row of RARITY_BY_ACT) for (const r of RARITY_ORDER) expect(row[r]).toBeGreaterThan(0)
  })

  it('climbs act by act: every tier above Common gains weight, Common loses it', () => {
    const share = (row: Record<ItemRarity, number>, r: ItemRarity) => row[r] / RARITY_ORDER.reduce((a, k) => a + row[k], 0)
    for (let a = 1; a < ACTS; a++) {
      expect(share(RARITY_BY_ACT[a], 'common')).toBeLessThan(share(RARITY_BY_ACT[a - 1], 'common'))
      for (const r of ['epic', 'legendary', 'mythic'] as const) expect(share(RARITY_BY_ACT[a], r)).toBeGreaterThan(share(RARITY_BY_ACT[a - 1], r))
    }
  })

  it('reads the act of the layer it is dealt at', () => {
    expect(rarityWeights(1)).toBe(RARITY_BY_ACT[0])
    expect(rarityWeights(ACT_LAYERS)).toBe(RARITY_BY_ACT[0])
    expect(rarityWeights(ACT_LAYERS + 1)).toBe(RARITY_BY_ACT[1])
    expect(rarityWeights(3 * ACT_LAYERS)).toBe(RARITY_BY_ACT[2])
  })

  it('a roll with no luck lands Epic+ about 4% of the time in act 1, more in each act after', () => {
    expect(epicShare(2, 20000)).toBeGreaterThan(0.02)
    expect(epicShare(2, 20000)).toBeLessThan(0.06)
    expect(epicShare(6, 20000)).toBeGreaterThan(0.06)
    expect(epicShare(10, 20000)).toBeGreaterThan(epicShare(6, 20000))
  })

  it('luck counts for less early: an act 1 elite is not an act 3 elite', () => {
    expect(effectiveLuck(0.3, undefined, 2)).toBeCloseTo(0.3 * ACT_LUCK[0])
    expect(effectiveLuck(0.3, undefined, 10)).toBeCloseTo(0.3 * ACT_LUCK[2])
    expect(ACT_LUCK[0]).toBeLessThanOrEqual(ACT_LUCK[2])
  })

  it('pity never guarantees a bump in acts 1 and 2 — it only makes one likelier', () => {
    const drought = { dry: 999 }
    expect(effectiveLuck(0, drought, 2)).toBeLessThan(1)
    expect(effectiveLuck(0, drought, 6)).toBeLessThan(1)
    expect(effectiveLuck(0, drought, 2)).toBeGreaterThan(0)
    expect(effectiveLuck(0, drought, 10)).toBe(PITY_CAP[2])
    // An endless drought in act 1 lifts the odds and still rolls mostly below Epic.
    const dry = epicShare(2, 20000, 0, 999)
    expect(dry).toBeGreaterThan(epicShare(2, 20000))
    expect(dry).toBeLessThan(0.5)
  })

  it('relic cards tilt the same way, never to zero', () => {
    expect(RELIC_ACT_TILT).toHaveLength(ACTS)
    for (const t of RELIC_ACT_TILT) expect(t).toBeGreaterThan(0)
    for (let a = 1; a < ACTS; a++) expect(RELIC_ACT_TILT[a]).toBeGreaterThan(RELIC_ACT_TILT[a - 1])
  })
})
