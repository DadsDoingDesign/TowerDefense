import { describe, expect, it } from 'vitest'
import { ALL_MAPS, PORTRAIT_MAPS } from '../src/game/data/maps'
import { BEST_TILES, bestTiles, gateDistance, inLastStretch, LAST_STRETCH, lastStretch, roadCoverage, roadOf } from '../src/game/run/placement'

/*
 * Placement (October audit 2.1 and 2.4): the wagons' last stretch and the
 * "best ground" stars, on every shipped field in both orientations.
 */
const MAPS = [...ALL_MAPS, ...PORTRAIT_MAPS]
const openOf = (m: (typeof MAPS)[number]) => (m.tiles ?? []).filter((t) => !t.block)

describe('placement: the last stretch', () => {
  it('ends at the Gate and runs LAST_STRETCH back along the road', () => {
    for (const m of MAPS) {
      const path = roadOf(m)
      const s = lastStretch(path, m.base)
      expect(s.to).toBeGreaterThan(0)
      expect(s.to).toBeLessThanOrEqual(path.length)
      expect(s.to - s.from).toBeCloseTo(Math.min(LAST_STRETCH, s.to))
      // The Gate's point on the road is the road's nearest point to the Gate.
      const g = path.pointAt(gateDistance(path, m.base))
      for (let d = 0; d <= path.length; d += 50) {
        const p = path.pointAt(d)
        expect(Math.hypot(g.x - m.base.x, g.y - m.base.y)).toBeLessThanOrEqual(Math.hypot(p.x - m.base.x, p.y - m.base.y) + 4)
      }
    }
  })
  it('a raider at or past the stretch is in it; one before it is not', () => {
    const s = { from: 900, to: 1000 }
    expect(inLastStretch(s, 899)).toBe(false)
    expect(inLastStretch(s, 900)).toBe(true)
    expect(inLastStretch(s, 1040)).toBe(true)
  })
})

describe('placement: best ground', () => {
  it('stars at most BEST_TILES open, uncursed tiles that actually cover road', () => {
    for (const m of MAPS) {
      const open = openOf(m)
      for (const range of [60, 120, 200]) {
        const ids = bestTiles(m, open, range)
        expect(ids.length).toBeLessThanOrEqual(BEST_TILES)
        expect(new Set(ids).size).toBe(ids.length)
        for (const id of ids) {
          const t = open.find((x) => x.id === id)!
          expect(t).toBeTruthy()
          expect(t.danger).toBeFalsy()
          expect(roadCoverage(roadOf(m), m.base, t.pos, range)).toBeGreaterThan(0)
        }
      }
    }
  })
  it('ranks by coverage, best first, and nothing open beats the first star', () => {
    for (const m of MAPS) {
      const open = openOf(m).filter((t) => !t.danger)
      const ids = bestTiles(m, open, 120)
      if (!ids.length) continue
      const cov = (id: string) => roadCoverage(roadOf(m), m.base, open.find((t) => t.id === id)!.pos, 120)
      for (let i = 1; i < ids.length; i++) expect(cov(ids[i - 1])).toBeGreaterThanOrEqual(cov(ids[i]))
      for (const t of open) expect(roadCoverage(roadOf(m), m.base, t.pos, 120)).toBeLessThanOrEqual(cov(ids[0]))
    }
  })
  it('is deterministic and needs a range and open ground', () => {
    const m = MAPS[0]
    expect(bestTiles(m, openOf(m), 120)).toEqual(bestTiles(m, openOf(m), 120))
    expect(bestTiles(m, openOf(m), 0)).toEqual([])
    expect(bestTiles(m, [], 120)).toEqual([])
  })
  it('weights the last stretch: a tile beside the wagons outranks one with equal plain road', () => {
    const m = MAPS[0]
    const path = roadOf(m)
    const s = lastStretch(path, m.base)
    const atStretch = path.pointAt((s.from + s.to) / 2)
    const early = path.pointAt(Math.max(0, s.from - 400))
    // The same point offset the same way from the road: the stretch counts double.
    const off = { x: 30, y: 0 }
    const near = roadCoverage(path, m.base, { x: atStretch.x + off.x, y: atStretch.y + off.y }, 40)
    const far = roadCoverage(path, m.base, { x: early.x + off.x, y: early.y + off.y }, 40)
    expect(near).toBeGreaterThan(far)
  })
})
