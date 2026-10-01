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
 * **Melee heroes keep a clearance** ({@link CLEARANCE}; "Tower Clearance" in
 * the designer's words, {@link CLEARANCE_LABEL} on the field): a hero that
 * swings swings all round it, so the 3 × 3 block of tiles centred on its own —
 * the 8 tiles beside it, diagonals included — holds no other hero. Ranged
 * heroes may stand shoulder to shoulder; they still may not step into a
 * swinger's clearance, and a swinger may not be posted where its clearance
 * would take in another hero. Who swings is read off what the hero HOLDS (a
 * sword, axe, greatsword or warhammer) or a skill that grants it —
 * `engine/melee.isMelee`, never the class and never a sprite. Gear changes
 * between rounds, so a hero can start swinging where it stands: that is a
 * clearance CONFLICT ({@link clearanceConflicts}, `run/clearance.ts`), shown on
 * the field and holding the next wave until the player makes space.
 *
 * The portrait twin is the same grid transposed (14 columns × 24 rows between
 * the twin's 30px side pads), so a tile id names the same patch of ground
 * either way up and the twins stay isometric by construction (`maps.ts`
 * § Portrait battlefields). At the phone's live Stage (0.55–0.60 CSS px per
 * field px) a tile is 22–24 CSS px: the finger aims a hero, the tile under it
 * decides where it lands to the nearest 40px, and an 80px patch (44–48 CSS
 * px) is the target the touch floor is measured against (`ui/fieldZoom`).
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
 * The G1-2 grid's tile (80px): the size a terrain piece is authored at, and
 * the target the touch floor is measured against.
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
 * A melee hero's clearance, in tiles: no other hero may stand within this many
 * tiles of it, diagonals included (Chebyshev distance) — the 3 × 3 block of
 * tiles centred on its own. Ranged heroes keep none.
 */
export const CLEARANCE = 1

/**
 * The clearance zone's name on the field. The designer's words were "Tower
 * Clearance"; LS4 (`tests/copy.terms.test.ts`) retires "tower" from every
 * player-facing string — the units are heroes — so the field says the second
 * word. One constant: the overlay and the keyboard layer both read it.
 */
export const CLEARANCE_LABEL = 'Clearance'

/** A hero on the grid, as the spacing rule sees it: where, and whether it swings. */
export interface Post {
  tile: string
  melee: boolean
}

/** Is `b` inside the clearance zone round `a` (or the reverse)? False for the same tile or anything not a tile. */
export function withinClearance(a: string, b: string): boolean {
  if (a === b) return false
  const p = parseTileId(a)
  const q = parseTileId(b)
  if (!p || !q) return false
  return Math.abs(p.c - q.c) <= CLEARANCE && Math.abs(p.r - q.r) <= CLEARANCE
}

/**
 * Do two heroes stand too close? Only when at least one of them is melee and
 * they are within a clearance of each other: two ranged heroes may stand side
 * by side, but nobody stands beside a hero that swings.
 */
export function crowds(a: string, aMelee: boolean, b: string, bMelee: boolean): boolean {
  return (aMelee || bMelee) && withinClearance(a, b)
}

/** The first of `posts` a hero (`melee` or not) on `tile` would stand too close to. */
export function crowdedBy<P extends Post>(tile: string, melee: boolean, posts: Iterable<P>): P | undefined {
  for (const o of posts) if (crowds(o.tile, o.melee, tile, melee)) return o
  return undefined
}

/**
 * Every clearance conflict among heroes already standing: each melee post with
 * the posts inside its clearance. A hero only ever POSTS clear (the store and
 * the breather move refuse a crowding tile), so a conflict is what a gear
 * change leaves behind — a hero starting to swing where it stands. Two melee
 * heroes too close show up twice, once as each one's conflict. Empty when the
 * field is clear.
 */
export function clearanceConflicts<P extends Post>(posts: readonly P[]): { melee: P; crowding: P[] }[] {
  const out: { melee: P; crowding: P[] }[] = []
  for (const m of posts) {
    if (!m.melee) continue
    const crowding = posts.filter((o) => o !== m && withinClearance(m.tile, o.tile))
    if (crowding.length) out.push({ melee: m, crowding })
  }
  return out
}

/**
 * Where heroes posted at `others` leave room for one more (`melee` or not):
 * the open tiles of `slots` that are not taken and not too close to any of them.
 */
export function roomyTiles<T extends { id: string }>(slots: readonly T[], others: Iterable<Post>, melee: boolean): T[] {
  const taken = [...others]
  return slots.filter((s) => !taken.some((o) => o.tile === s.id) && !crowdedBy(s.id, melee, taken))
}

/**
 * The tiles of the clearance zone round `tile`, itself included — the 3 × 3
 * block the overlay outlines — clipped to the grid. Empty for anything not a tile.
 */
export function clearanceTiles(tile: string): string[] {
  const p = parseTileId(tile)
  if (!p) return []
  const out: string[] = []
  for (let r = p.r - CLEARANCE; r <= p.r + CLEARANCE; r++)
    for (let c = p.c - CLEARANCE; c <= p.c + CLEARANCE; c++)
      if (c >= 0 && r >= 0 && c < GRID_COLS && r < GRID_ROWS) out.push(tileId(c, r))
  return out
}

/**
 * What the placement overlay shows while a hero is armed (setup) or picked up
 * (the breather's move). Pure, so the tiles the grid lights can be checked
 * against the rule the store enforces.
 *
 * - `crowded`: open tiles the armed hero may not land on because of a hero who
 *   stays where it is — they stay dark.
 * - `zones`: the tiles of the staying MELEE heroes (never a ranged hero's),
 *   whose clearance is drawn faintly so the player sees why those tiles are dark.
 * - `landing`: the tile whose clearance is drawn at full strength — the
 *   hovered open tile, when the armed hero is melee; null otherwise.
 */
export function clearanceOverlay(
  slots: readonly { id: string }[],
  staying: readonly Post[],
  armedMelee: boolean,
  hover: string | null,
): { crowded: Set<string>; zones: string[]; landing: string | null } {
  const crowded = new Set(slots.filter((s) => !!crowdedBy(s.id, armedMelee, staying)).map((s) => s.id))
  const zones = staying.filter((o) => o.melee).map((o) => o.tile)
  const landing = armedMelee && hover && slots.some((s) => s.id === hover) ? hover : null
  return { crowded, zones, landing }
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

/**
 * The coach line for a tile too close to a hero that swings ({@link CLEARANCE}):
 * the reason in plain words, whichever of the two heroes swings. The store's
 * note names the hero and its weapon when it can (`run/clearance.roomLine`);
 * this is the general form.
 */
export const ROOM_COPY = {
  name: 'Too close',
  line: 'Too close — a hero with a sword, axe or hammer swings all round it, so keep the tiles next to it clear.',
}

/** The same reason, short, in a tile's name on the keyboard layer. */
export const ROOM_REASON = 'a hero with a sword, axe or hammer swings all round it and needs the tiles beside it clear'

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
