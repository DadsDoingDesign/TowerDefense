/**
 * ---------------------------------------------------------------------------
 * The deployment grid and the terrain that blocks it (G1-2)
 * ---------------------------------------------------------------------------
 *
 * Deployment used to be six fixed build circles per field. It is a TILE GRID
 * now: every grass tile off the lane can take a hero, and the only tiles that
 * cannot are the ones the field itself fills — the lane, the forest frame at the
 * margins, and terrain pieces (rocks, water, fire). Placement is still a
 * decision because the company is at most five heroes (`MAX_ROSTER`) and a
 * held sub-wave still allows exactly one move.
 *
 * **Geometry.** Tiles are {@link TILE} = 80 logical px, laid over the 960×560
 * landscape field as a 12 × 7 grid that fills it exactly. The portrait twin is
 * the same grid transposed (7 columns × 12 rows between the twin's 30px side
 * pads), so a tile id names the same patch of ground either way up and the
 * twins stay isometric by construction (`maps.ts` § Portrait battlefields). At
 * the phone's live Stage (0.55–0.60 CSS px per field px) a tile is 44–48 CSS
 * px — the touch-target floor — and on a desk 80 px.
 *
 * **Ids are landscape coordinates** (`c{col}r{row}`, 0-based) whichever way the
 * field is drawn. A placement keyed by tile id therefore rides the run snapshot
 * and the portrait/landscape swap unchanged, exactly as slot ids used to.
 *
 * **What blocks, and why it is pure.** Whether a tile is open is a function of
 * the path, the grid and the field's authored pieces — never of sprite sizes —
 * so the engine, the balance harness and the renderer all read the same answer.
 * The renderer's job is only to make each blocked tile *look* like its reason
 * (`render/terrain.ts`).
 *
 * **Map challenges are terrain rules** ({@link TERRAIN_RULES}): a battle may be
 * fought on a Flooded meadow (lakes) or through a Wildfire (burning patches).
 * The pieces a rule adds are authored per field (`maps.ts`), fixed for the
 * battle, and named in the node preview before the march.
 */
import type { Vec2 } from '../core/vec'
import type { FieldTile, TerrainKind, TerrainRuleId } from '../types'

/** Edge of one deployment tile, in logical field px. */
export const TILE = 80
/** Landscape grid: 12 columns × 7 rows exactly fills the 960×560 field. */
export const GRID_COLS = 12
export const GRID_ROWS = 7

/**
 * A tile whose centre is nearer the lane's centre-line than this is lane: the
 * road runs through it, and a hero on it would stand in the dirt.
 *
 * The shipped fields route every lane along tile EDGES (`maps.ts`), so no tile
 * is lane there: a roadside tile's centre is exactly 40px from the lane's
 * centre-line, 15px clear of the 25px half-width of dirt — the distance the old
 * hand-placed circles hugged the lane at (35–65px). The rule stays for any
 * field whose road cuts through a tile.
 */
export const LANE_CLEAR = 30

/**
 * Half the drawn lane's width (the dirt plus its grassy edge, 50px in
 * `render/terrain.ts`). The lanes run along tile EDGES (`maps.ts`), so a tap
 * this close to the path's centre line landed on the road, not on the tile
 * whose square it is in — and says so.
 */
export const LANE_HALF = 25

/** The id of the tile at landscape column `c`, row `r`. */
export const tileId = (c: number, r: number): string => `c${c}r${r}`

/** Landscape column/row back out of a tile id, or null for anything else. */
export function parseTileId(id: string): { c: number; r: number } | null {
  const m = /^c(\d{1,2})r(\d{1,2})$/.exec(id)
  if (!m) return null
  const c = Number(m[1])
  const r = Number(m[2])
  return c < GRID_COLS && r < GRID_ROWS ? { c, r } : null
}

/** Centre of a landscape tile. */
export const tileCenter = (c: number, r: number): Vec2 => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 })

/** Shortest distance from a point to a polyline. */
export function distToPolyline(p: Vec2, pts: readonly Vec2[]): number {
  let best = Infinity
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
    const d = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
    if (d < best) best = d
  }
  return best
}

/** An authored terrain piece: which tile, and what stands on it. */
export type TerrainPiece = readonly [col: number, row: number, kind: Exclude<TerrainKind, 'lane' | 'forest'>]

/**
 * Lay the landscape grid for a path plus authored pieces.
 *
 * Precedence: lane first (a piece authored onto the lane is ignored — the road
 * is never blocked, the horde has to walk it), then the authored pieces, then
 * the forest frame on the outer ring. A piece may replace a ring tile's forest:
 * that is how a lake would reach the field's edge.
 */
export function layTiles(path: readonly Vec2[], pieces: readonly TerrainPiece[]): FieldTile[] {
  const authored = new Map(pieces.map(([c, r, k]) => [tileId(c, r), k]))
  const out: FieldTile[] = []
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const id = tileId(c, r)
      const pos = tileCenter(c, r)
      const ring = r === 0 || r === GRID_ROWS - 1 || c === 0 || c === GRID_COLS - 1
      let block: TerrainKind | null = null
      if (distToPolyline(pos, path) < LANE_CLEAR) block = 'lane'
      else if (authored.has(id)) block = authored.get(id)!
      else if (ring) block = 'forest'
      out.push({ id, pos, col: c, row: r, block })
    }
  }
  return out
}

/** What each blocking kind is called, and the coach line a tap on it gets. */
export const BLOCK_COPY: Record<TerrainKind, { name: string; line: string }> = {
  lane: { name: 'Road', line: 'Road — the horde marches here. Post heroes beside it.' },
  forest: { name: 'Forest', line: 'Forest — too thick to stand in.' },
  rock: { name: 'Rock', line: 'Rock — nothing can stand here.' },
  water: { name: 'Lake', line: 'Lake — heroes can’t stand in water.' },
  fire: { name: 'Fire', line: 'Fire — this ground is burning.' },
}

/** A map challenge, as a terrain rule. */
export interface TerrainRule {
  id: TerrainRuleId
  /** The challenge's name, as the preview and the Stage show it. */
  name: string
  /** One line for the node preview: what the rule does to the field. */
  blurb: string
}

export const TERRAIN_RULES: Record<TerrainRuleId, TerrainRule> = {
  flooded: {
    id: 'flooded',
    name: 'Flooded meadow',
    blurb: 'Lakes have spread over the grass. Fewer tiles to post on near the bends.',
  },
  wildfire: {
    id: 'wildfire',
    name: 'Wildfire',
    blurb: 'Patches of the field are burning. No hero can stand in the flames.',
  },
}

export const TERRAIN_RULE_IDS = Object.keys(TERRAIN_RULES) as TerrainRuleId[]

/** The rule with this id, or null for anything this build does not know. */
export const terrainRuleById = (id: unknown): TerrainRule | null =>
  typeof id === 'string' && Object.prototype.hasOwnProperty.call(TERRAIN_RULES, id)
    ? TERRAIN_RULES[id as TerrainRuleId]
    : null
