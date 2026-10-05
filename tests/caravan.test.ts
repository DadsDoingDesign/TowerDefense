import { describe, expect, it } from 'vitest'
import { ALL_MAPS, fieldFor, fieldIdOf, PORTRAIT_MAPS } from '../src/game/data/maps'
import { CARAVAN_BOX, caravanLayout, roadExit } from '../src/game/render/caravan'
import type { GameMap, TerrainRuleId } from '../src/game/types'

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
