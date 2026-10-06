/**
 * ---------------------------------------------------------------------------
 * Placement — what a tile is worth, and the wagons' last stretch
 * (October audit 2.1 and 2.4)
 * ---------------------------------------------------------------------------
 *
 * Two answers the field gives before the fight, so a player never learns them
 * from a leak:
 *
 *  - **The last stretch** ({@link lastStretch}): the final run of road before
 *    the Gate — the wagons. A raider on it is about to steal cargo, so the
 *    field marks it during a wave and pulses it when one is there.
 *  - **Best ground** ({@link bestTiles}): while a hero is armed, the open tiles
 *    whose range covers the most road for THAT hero, the last stretch counting
 *    double. The grid stars the top few. Any legal tile still works; the stars
 *    are advice, not a rule (Kingdom Rush lights its plots, Backpack Battles
 *    lights the cells an item wants).
 *
 * Pure: no store, no React, no DOM. Geometry only, read off the map's own path
 * in field px, so a new field needs nothing authored.
 */
import { GamePath } from '../core/path'
import type { Vec2 } from '../core/vec'
import type { FieldTile, GameMap } from '../types'

/** How much road before the Gate counts as the wagons' last stretch, in field px (4 tiles of 40). */
export const LAST_STRETCH = 160
/** How many tiles the grid stars while a hero is armed. */
export const BEST_TILES = 3
/** The last stretch's weight in a tile's coverage: road there is worth this much more. */
export const STRETCH_WEIGHT = 2
/** Road sampling step, field px. */
const STEP = 8

const PATHS = new WeakMap<GameMap, GamePath>()
const GATES = new WeakMap<GamePath, number>()

/** The map's road as an arc-length path (cached per map). */
export function roadOf(map: GameMap): GamePath {
  const hit = PATHS.get(map)
  if (hit) return hit
  const p = new GamePath(map.path)
  PATHS.set(map, p)
  return p
}

/**
 * How far along the road the Gate stands: the point of the road nearest the
 * Gate's anchor. The engine's path runs on a few dozen px past the palisade
 * (where a leaking raider is counted), so the stretch ends at the Gate, not at
 * the path's end.
 */
export function gateDistance(path: GamePath, gate: Vec2): number {
  const hit = GATES.get(path)
  if (hit != null) return hit
  let best = { d: path.length, gap: Infinity }
  for (let d = 0; d <= path.length; d += 4) {
    const p = path.pointAt(d)
    const gap = Math.hypot(p.x - gate.x, p.y - gate.y)
    if (gap < best.gap) best = { d, gap }
  }
  GATES.set(path, best.d)
  return best.d
}

/** The wagons' last stretch, as arc-length distances along the road: `[from, to]`. */
export function lastStretch(path: GamePath, gate: Vec2): { from: number; to: number } {
  const to = gateDistance(path, gate)
  return { from: Math.max(0, to - LAST_STRETCH), to }
}

/** Is a raider `distance` along the road inside the last stretch (or past it, at the gate)? */
export const inLastStretch = (stretch: { from: number; to: number }, distance: number): boolean => distance >= stretch.from

/**
 * How much road a hero standing at `pos` with `range` covers, in field px of
 * road, up to the Gate — the last stretch weighted {@link STRETCH_WEIGHT}×.
 */
export function roadCoverage(path: GamePath, gate: Vec2, pos: Vec2, range: number): number {
  const { from, to } = lastStretch(path, gate)
  const r2 = range * range
  let covered = 0
  for (let d = 0; d <= to; d += STEP) {
    const p = path.pointAt(d)
    const dx = p.x - pos.x
    const dy = p.y - pos.y
    if (dx * dx + dy * dy <= r2) covered += STEP * (d >= from ? STRETCH_WEIGHT : 1)
  }
  return covered
}

/**
 * The open tiles worth starring for a hero with `range`: the top `n` by road
 * coverage, best first. `open` is every tile the hero may stand on now (the
 * caller has already removed blocked, taken and crowded ones). Cursed ground
 * is never starred — standing there costs damage — and a tile must cover at
 * least half the best tile's road to be called good at all. Ties break on the
 * tile's id, so the same field always stars the same tiles.
 */
export function bestTiles(map: GameMap, open: readonly Pick<FieldTile, 'id' | 'pos' | 'danger'>[], range: number, n = BEST_TILES): string[] {
  if (!(range > 0) || !open.length || map.path.length < 2) return []
  const path = roadOf(map)
  const scored = open
    .filter((t) => !t.danger)
    .map((t) => ({ id: t.id, score: roadCoverage(path, map.base, t.pos, range) }))
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  if (!scored.length) return []
  const floor = scored[0].score / 2
  return scored.filter((t) => t.score >= floor).slice(0, n).map((t) => t.id)
}
