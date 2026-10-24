import { describe, expect, it } from 'vitest'
import { ALL_MAPS, fieldFor, fieldIdOf, PORTRAIT_MAPS } from '../src/game/data/maps'
import { CARAVAN_BOX, caravanLayout, roadExit } from '../src/game/render/caravan'
import type { GameMap, TerrainRuleId } from '../src/game/types'
import { COMPANIES, COMPANY_LOGOS } from '../src/game/data/companies'
import { BANNER_H, BANNER_W } from '../src/game/data/banner'
import { companyStandardPalette, companyStandardRows, STANDARD_H, STANDARD_W } from '../src/game/data/companyStandard'

/*
 * The wagon at the road's end (build step 4 fix): it stands in the forest
 * margin where the road leaves the field — never over a tile a hero can stand
 * on, never over the lane, never off the field — on both fields, in both
 * orientations, under every map challenge and seeded hazard layout.
 */
const RULES: (TerrainRuleId | null)[] = [null, 'flooded', 'wildfire', 'quarry', 'hexed']

function maps(): GameMap[] {
  const out: GameMap[] = [...ALL_MAPS, ...PORTRAIT_MAPS]
  for (const base of ALL_MAPS) {
    for (const o of ['landscape', 'portrait'] as const) {
      for (const rule of RULES) {
        for (const hazard of [null, 7, 1234]) {
          const m = fieldFor(fieldIdOf(base), rule, o, hazard)
          if (m) out.push(m)
        }
      }
    }
  }
  return out
}

const segDist = (px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy))
}

describe('the caravan stands at the road’s end, in the forest margin', () => {
  it.each(maps().map((m) => [m.id, m] as const))('%s', (_id, map) => {
    const at = caravanLayout(map)
    const box = { x0: at.x + CARAVAN_BOX.left, x1: at.x + CARAVAN_BOX.right, y0: at.y + CARAVAN_BOX.top, y1: at.y + CARAVAN_BOX.bottom }
    // On the field, so every screen that shows the field shows the wagon.
    expect(box.x0).toBeGreaterThanOrEqual(0)
    expect(box.y0).toBeGreaterThanOrEqual(0)
    expect(box.x1).toBeLessThanOrEqual(map.width)
    expect(box.y1).toBeLessThanOrEqual(map.height)
    // Over forest only: no open tile, no lane tile, no challenge piece.
    const h = (map.tile ?? 40) / 2
    const under = (map.tiles ?? []).filter((t) => t.pos.x + h > box.x0 && t.pos.x - h < box.x1 && t.pos.y + h > box.y0 && t.pos.y - h < box.y1)
    expect(under.length).toBeGreaterThan(0)
    expect(under.filter((t) => t.block !== 'forest').map((t) => t.id)).toEqual([])
    // Clear of the drawn road.
    for (let i = 0; i < map.path.length - 1; i++) {
      for (const [px, py] of [[box.x0, box.y0], [box.x1, box.y0], [box.x0, box.y1], [box.x1, box.y1], [(box.x0 + box.x1) / 2, box.y0], [(box.x0 + box.x1) / 2, box.y1]]) {
        expect(segDist(px, py, map.path[i], map.path[i + 1])).toBeGreaterThanOrEqual(22)
      }
    }
    // Beside the road's end, not somewhere else in the wood.
    const exit = roadExit(map)
    expect(Math.hypot((box.x0 + box.x1) / 2 - exit.x, (box.y0 + box.y1) / 2 - exit.y)).toBeLessThan(170)
  })
})

describe('the wagon flies the flag of whoever the run is for', () => {
  it('each company’s standard: its colour, its logo, inside the flag’s box', () => {
    for (const co of COMPANIES) {
      const rows = companyStandardRows(co.id)
      const pal = companyStandardPalette(co.id)
      expect(rows).toHaveLength(STANDARD_H)
      for (const r of rows) expect(r).toHaveLength(STANDARD_W)
      // 2 px a cell fits the banner's box (the caravan's layout does not move).
      expect(STANDARD_W * 2).toBeLessThanOrEqual(BANNER_W * 3)
      expect(STANDARD_H * 2).toBe(BANNER_H * 3)
      // The cloth is the company's colour, and every key drawn has a colour.
      expect(pal['4']).toBe(co.color)
      const keys = new Set(rows.join('').replace(/\./g, ''))
      for (const k of keys) expect(pal[k], `${co.id} key ${k}`).toBeDefined()
      // The logo is on the cloth: every one of its cells, at its place.
      COMPANY_LOGOS[co.id].rows.forEach((row, j) =>
        row.split('').forEach((ch, i) => {
          if (ch !== '.') expect(rows[3 + j][3 + i]).toBe(ch)
        }),
      )
    }
    // Five companies, five different standards.
    expect(new Set(COMPANIES.map((c) => companyStandardRows(c.id).join('') + companyStandardPalette(c.id)['4'])).size).toBe(COMPANIES.length)
  })
})
