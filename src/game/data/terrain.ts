/**
 * ---------------------------------------------------------------------------
 * The deployment grid and the terrain that blocks it (G1-2, grid-fit)
 * ---------------------------------------------------------------------------
 *
 * Deployment used to be six fixed build circles per field. It is a TILE GRID
 * now: every grass tile off the road can take a hero, and the only tiles that
 * cannot are the ones the field itself fills — the road, the forest round the
 * playable middle ({@link PLAYABLE}) and terrain pieces (rocks, water, fire).
 * The battlefield is one continuous map: `render/terrain.ts` bakes the woodland
 * on past the grid, on this same lattice. Placement is still a
 * decision because the company is at most five heroes (`MAX_ROSTER`) and a
 * held sub-wave still allows exactly one move.
 *
 * **Geometry (grid-fit).** Tiles are {@link TILE} = 40 logical px, laid over
 * the 960×560 landscape field as a 24 × 14 grid that fills it exactly. G1-2's
 * tiles were 80px with the road along their EDGES, so the road straddled two
 * rows of tiles and the lit grid sat half a tile off the ground it was drawn
 * on. Now the road runs through tile CENTRES, one tile wide: a road tile is
 * road, every other tile is whole grass, and rocks, ponds, fire and cursed
 * ground are laid in whole tiles on the same lattice.
 *
 * The 40px lattice is also what keeps the fight the same one. A hero on the
 * tile beside the road stands 40px from its centre line — exactly where a
 * G1-2 roadside hero stood, which is what every hold (a Fighter's 72px), sapper
 * trigger and reach in the game is tuned against — and every post G1-2 had is
 * still a tile here, relative to the road (`maps.ts`). What the finer grid adds
 * is the in-between: a hero can stand at a bend's corner, one step back, or
 * half a big tile along the road.
 *
 * **Heroes keep a tile of room** ({@link POST_ROOM}): a hero's sprite is wider
 * than a 40px tile, so no two heroes may stand on neighbouring tiles
 * (diagonals included) — the closest two heroes can be is 80px, G1-2's
 * spacing. The lit grid leaves a posted hero's neighbours dark.
 *
 * The portrait twin is the same grid transposed (14 columns × 24 rows between
 * the twin's 30px side pads), so a tile id names the same patch of ground
 * either way up and the twins stay isometric by construction (`maps.ts`
 * § Portrait battlefields). At the phone's live Stage (0.55–0.60 CSS px per
 * field px) a tile is 22–24 CSS px: the finger aims a hero, the tile under it
 * decides where it lands to the nearest 40px, and a hero's room (80px, 44–48
 * CSS px) is the target the touch floor is measured against (`ui/fieldZoom`).
 *
 * **Ids are landscape coordinates** (`c{col}r{row}`, 0-based) whichever way the
 * field is drawn. A placement keyed by tile id therefore rides the run snapshot
 * and the portrait/landscape swap unchanged, exactly as slot ids used to. A
 * save from the 80px grid (snapshot v10–v11) has its ids doubled on load
 * ({@link fineFromCoarse}): coarse `c7r2` is fine `c14r4`, the same place
 * relative to the road.
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
export const TILE = 40
/** Landscape grid: 24 columns × 14 rows exactly fills the 960×560 field. */
export const GRID_COLS = 24
export const GRID_ROWS = 14
/**
 * The G1-2 grid's tile (80px): a hero's room, the size a terrain piece is
 * authored at, and the target the touch floor is measured against.
 */
export const COARSE = 80

/**
 * A tile whose centre is nearer the lane's centre-line than this is lane: the
 * road runs through it, and a hero on it would stand in the dirt. The shipped
 * roads run through tile centres, so a road tile's centre is ON the line and
 * every other tile's is at least a whole tile (40px) off it.
 */
export const LANE_CLEAR = 20

/**
 * Half the drawn road's width (the dirt plus its grassy edge, one tile wide in
 * `render/terrain.ts`). The road runs down the middle of its own tiles, so this
 * band always lies inside road tiles.
 */
export const LANE_HALF = 20

/**
 * How many tiles of room a hero keeps round it: another hero may not stand
 * within this many tiles, diagonals included (Chebyshev distance). One tile
 * of room puts two heroes at least 80px apart, the G1-2 spacing, so a hero's
 * sprite never overlaps its neighbour's.
 */
export const POST_ROOM = 1

/** Do two tiles (by id) stand too close for two heroes? False for anything that is not a tile. */
export function crowds(a: string, b: string): boolean {
  if (a === b) return false
  const p = parseTileId(a)
  const q = parseTileId(b)
  if (!p || !q) return false
  return Math.abs(p.c - q.c) <= POST_ROOM && Math.abs(p.r - q.r) <= POST_ROOM
}

/**
 * Where a company of `others` leaves room for one more hero: the open tiles
 * of `slots` that are not taken and not crowded by any of them.
 */
export function roomyTiles<T extends { id: string }>(slots: readonly T[], others: Iterable<string>): T[] {
  const taken = [...others]
  return slots.filter((s) => !taken.some((o) => o === s.id || crowds(o, s.id)))
}

/**
 * A G1-2 (80px-grid) tile id on the fine grid: the tile whose centre is where
 * the coarse tile's centre stood relative to the road — `c{2c}r{2r}` (the
 * fields moved by half a fine tile to put the road on tile centres, `maps.ts`).
 * Null for anything that is not a coarse tile id.
 */
export function fineFromCoarse(id: string): string | null {
  const m = /^c(\d{1,2})r(\d{1,2})$/.exec(id)
  if (!m) return null
  const c = Number(m[1])
  const r = Number(m[2])
  return c < GRID_COLS / 2 && r < GRID_ROWS / 2 ? tileId(c * 2, r * 2) : null
}

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

/**
 * The tiles of one authored terrain piece: an 80px patch (2 × 2 tiles) whose
 * top-left tile is `c, r` — the size G1-2's pieces had, so a pond is still a
 * pond and a boulder cluster still blocks a hero's worth of ground. A tile of
 * it the road runs through is dropped by {@link layTiles} (lane first).
 */
export function patch(c: number, r: number, kind: Exclude<TerrainKind, 'lane' | 'forest'>, w = 2, h = 2): TerrainPiece[] {
  const out: TerrainPiece[] = []
  for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) out.push([c + dc, r + dr, kind])
  return out
}

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
 * The playable middle of every shipped field, landscape px: G1-2's 10 × 5
 * interior (inside its forest ring), moved with the road (`maps.ts`). A tile
 * whose centre lies outside it is forest. Keeping G1-2's interior, rather than
 * opening the whole box, keeps the posts the game was balanced on and adds
 * only the in-between ones; the woodland it frames continues past the grid.
 */
export const PLAYABLE = { x0: 60, y0: 60, x1: 860, y1: 460 } as const

/**
 * Lay the landscape grid for a path plus authored pieces.
 *
 * Precedence: lane first (a piece authored onto the lane is ignored — the road
 * is never blocked, the horde has to walk it), then the authored pieces, then
 * forest wherever the tile lies outside {@link PLAYABLE}.
 */
export function layTiles(path: readonly Vec2[], pieces: readonly TerrainPiece[]): FieldTile[] {
  const authored = new Map(pieces.map(([c, r, k]) => [tileId(c, r), k]))
  const out: FieldTile[] = []
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const id = tileId(c, r)
      const pos = tileCenter(c, r)
      const inside = pos.x > PLAYABLE.x0 && pos.x < PLAYABLE.x1 && pos.y > PLAYABLE.y0 && pos.y < PLAYABLE.y1
      let block: TerrainKind | null = null
      if (distToPolyline(pos, path) < LANE_CLEAR) block = 'lane'
      else if (authored.has(id)) block = authored.get(id)!
      else if (!inside) block = 'forest'
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

/** The coach line for a tile too close to a posted hero ({@link POST_ROOM}). */
export const ROOM_COPY = { name: 'Too close', line: 'Too close — heroes stand at least a tile apart.' }

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
