import { describe, expect, it } from 'vitest'
import { ALL_MAPS, fieldFor, fieldIdOf, PORTRAIT_MAPS } from '../src/game/data/maps'
import { actFieldIds } from '../src/game/run/fields'
import { CARAVAN_BOX, caravanLayout } from '../src/game/render/caravan'
import { playRect } from '../src/game/render/terrain'
import { flagBox, flagsForSpots, marginBannerSpots, MARGIN_BANNERS } from '../src/game/render/marginBanners'
import type { GameMap, TerrainRuleId } from '../src/game/types'

/*
 * The trade war's banners (Draft 4 § D, mockup 3d) frame the field at its
 * margins: on forest only, clear of the lane, the posts and the caravan, on
 * the field, near an edge — on the hand-made fields and on generated roads,
 * in both orientations, under every challenge.
 */
const RULES: (TerrainRuleId | null)[] = [null, 'flooded', 'wildfire', 'quarry', 'hexed']

function maps(): GameMap[] {
  const out: GameMap[] = [...ALL_MAPS, ...PORTRAIT_MAPS]
  for (const base of ALL_MAPS) for (const o of ['landscape', 'portrait'] as const) for (const rule of RULES) {
    const m = fieldFor(fieldIdOf(base), rule, o, 7)
    if (m) out.push(m)
  }
  // Generated roads, as runs deal them.
  for (const seed of [1, 42, 977, 31337]) for (const id of actFieldIds(seed)) for (const o of ['landscape', 'portrait'] as const) {
    const m = fieldFor(id, 'wildfire', o, seed)
    if (m) out.push(m)
  }
  return out
}

const segDist = (px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy))
}

describe('the margin banners stand in the forest at the field’s edges', () => {
  const all = maps()
  it.each(all.map((m, i) => [`${m.id}#${i}`, m] as const))('%s', (_id, map) => {
    const spots = marginBannerSpots(map)
    expect(spots.length).toBeLessThanOrEqual(MARGIN_BANNERS)
    const wagon = caravanLayout(map)
    const h = (map.tile ?? 40) / 2
    for (const at of spots) {
      const b = flagBox(at)
      // On the field.
      expect(b.x0).toBeGreaterThanOrEqual(0)
      expect(b.y0).toBeGreaterThanOrEqual(0)
      expect(b.x1).toBeLessThanOrEqual(map.width)
      expect(b.y1).toBeLessThanOrEqual(map.height)
      // Over forest only: no post, no lane tile, no challenge piece.
      const under = (map.tiles ?? []).filter((t) => t.pos.x + h > b.x0 && t.pos.x - h < b.x1 && t.pos.y + h > b.y0 && t.pos.y - h < b.y1)
      expect(under.filter((t) => t.block !== 'forest').map((t) => t.id)).toEqual([])
      for (const s of map.slots) expect(s.pos.x > b.x0 - 20 && s.pos.x < b.x1 + 20 && s.pos.y > b.y0 - 20 && s.pos.y < b.y1 + 20).toBe(false)
      // Clear of the drawn road.
      for (let i = 0; i < map.path.length - 1; i++) {
        for (const [px, py] of [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1], [(b.x0 + b.x1) / 2, b.y0], [(b.x0 + b.x1) / 2, b.y1]]) {
          expect(segDist(px, py, map.path[i], map.path[i + 1])).toBeGreaterThanOrEqual(22)
        }
      }
      // Off the caravan.
      const cv = { x0: wagon.x + CARAVAN_BOX.left, x1: wagon.x + CARAVAN_BOX.right, y0: wagon.y + CARAVAN_BOX.top, y1: wagon.y + CARAVAN_BOX.bottom }
      expect(b.x1 < cv.x0 || b.x0 > cv.x1 || b.y1 < cv.y0 || b.y0 > cv.y1).toBe(true)
      // Inside what every Stage shows (the play rect), and at its margin: near an edge.
      const pr = playRect(map)
      expect(b.x0 >= pr.x0 && b.y0 >= pr.y0 && b.x1 <= pr.x1 && b.y1 <= pr.y1).toBe(true)
      expect(Math.min(b.x0 - pr.x0, b.y0 - pr.y0, pr.x1 - b.x1, pr.y1 - b.y1)).toBeLessThanOrEqual(160)
    }
  })

  it('most fields fly at least two, and the spots are stable', () => {
    const counts = all.map((m) => marginBannerSpots(m).length)
    expect(counts.filter((n) => n >= 2).length / counts.length).toBeGreaterThan(0.8)
    expect(marginBannerSpots(all[0])).toBe(marginBannerSpots(all[0]))
  })

  it('the employer flies first; a leader that is not it takes every other spot', () => {
    const emp = { company: 'metals' as const }
    const lead = { company: 'spice' as const }
    expect(flagsForSpots(4, emp, lead)).toEqual([emp, lead, emp, lead])
    expect(flagsForSpots(3, emp, null)).toEqual([emp, emp, emp])
  })
})
