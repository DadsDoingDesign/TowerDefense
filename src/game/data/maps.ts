import { streamRng } from '../core/rng'
import type { Vec2 } from '../core/vec'
import type { GameMap, TerrainRuleId } from '../types'
import { layHazards } from './hazards'
import { layTiles, TERRAIN_RULES, TILE, type TerrainPiece } from './terrain'

/**
 * The battlefields. Every landscape field is 960x560 logical px; the renderer
 * composes at exactly the map's own size and blits down, so the field
 * dimensions are a fixed contract, not a per-map choice. Each one also has a
 * 620x960 portrait twin a phone fights on (see § Portrait battlefields below).
 *
 * ---------------------------------------------------------------------------
 * Why there is more than one (WS8)
 * ---------------------------------------------------------------------------
 *
 * `ALL_MAPS = [FIRST_MAP]` was the last untouched finding of the audit. One
 * battlefield, one path, six build slots, for every run forever, means the only
 * thing that varied below the map layer was a single scalar (Threat) and the
 * team — so **placement was solved once and became a calculator**. The genre
 * doctrine is specific about which half of the loop randomness belongs in:
 * before the decision (a varied setup the player has to solve), never after it.
 * A different battlefield is input randomness done right — it makes the player
 * re-solve rather than re-execute.
 *
 * ---------------------------------------------------------------------------
 * Free-form deployment on a tile grid (G1-2)
 * ---------------------------------------------------------------------------
 *
 * The six fixed build circles are gone. The field is a 12 × 7 grid of 80px
 * tiles (`data/terrain.ts`) and a hero may stand on ANY open grass tile; the
 * forest frame on the outer ring and the field's terrain pieces are blocked,
 * and a tap on the road itself says so. `GameMap.slots` is the list of open
 * tiles, so the engine, the breather move and the balance harness read one
 * place exactly as they did.
 *
 * **The road runs BETWEEN the tiles.** Every corner of every path sits on a
 * grid intersection (x, y ∈ 80k), so the dirt lane runs along tile edges and a
 * hero on a roadside tile stands at its centre, 40px from the lane's centre
 * line — 15px clear of the dirt, the same "hugging the lane" distance the old
 * circles were placed at (35–65px), which is what the engine's numbers are
 * tuned against: a Fighter's 72px hold, a sapper's 50–55px trigger, a
 * bomber's 150px lob. The alternative — the road down the middle of a row of
 * tiles — puts every hero at least 80px from the lane, out of reach of every
 * hold in the game; measured before it was rejected (G1-2 notes in
 * docs/DESIGN_REVIEW.md). One tile back is 120px: a set-back post only the
 * long-range heroes can use.
 *
 * Both fields kept their shape — the Green Line's snake with its wrapped
 * pocket, the Kiln Road's three stacked lanes — snapped onto the grid, which
 * moves each fold by up to 40px and quantises the length in 80–160px steps:
 * the Kiln Road is 2300px end to end (it was 2300), the Green Line 2220 (it
 * was 2290, the nearest grid shape either side being 2380). Path length still
 * matters exactly as before: enemy speeds in `enemies.ts` are tuned as
 * *crossing times*, and time-in-range is the one difficulty axis Threat does
 * not multiply. `balance/report.ts` §14 holds the spread under 6%.
 *
 * The two fields stay opposite in the axis that decides placement, **how many
 * lanes a tile can see**:
 *
 *  - *The Green Line* is a wide snake that wraps a pocket of grass (c6–c8,
 *    r2–r4) on three sides — where coverage overlaps and auras reach, and the
 *    answer is to stack the pocket.
 *  - *The Kiln Road* folds three lanes 160px apart across the field: every
 *    tile between two lanes hugs one and sees the other, and the middle of the
 *    field sees all three. Its top-right corner is out of everything's reach
 *    and is rock.
 */
export const FIELD_W = 960
export const FIELD_H = 560

/** Total walking distance along a path, in field px — a map's crossing budget. */
export function pathLength(path: readonly Vec2[]): number {
  let n = 0
  for (let i = 1; i < path.length; i++) n += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y)
  return n
}

/**
 * A battlefield as authored: its lane, the terrain pieces every battle on it
 * has, and what each map challenge adds (G1-2).
 *
 * `posts` are the six build circles the field used to have, by their old ids.
 * Nothing in the game reads them; they exist so a save written before the grid
 * (placements keyed `s0`…`s5`) resumes with its company on the nearest open
 * tiles, and so the balance suite's fixed benches keep meaning "the tile where
 * `s3` used to be" ({@link legacyPostTile}).
 */
interface FieldDef {
  id: string
  name: string
  path: Vec2[]
  posts: Record<string, Vec2>
  pieces: readonly TerrainPiece[]
  rules: Record<TerrainRuleId, readonly TerrainPiece[]>
}

/*
 * The Green Line on the grid (landscape). `T` forest, `R` rock, `.` open;
 * the road runs along the tile edges between them.
 *
 *        0 1 2 3 4 5 6 7 8 9 10 11
 *   r0   T T T T T T T T T T T  T
 *   r1   T . . . . . . . . . R  T
 *   r2   T . . . . . . . . . .  T
 *   r3   T . . . . . . . . . .  T
 *   r4   T R . . . . . . . . .  T
 *   r5   T R . . . . . . . . .  T
 *   r6   T T T T T T T T T T T  T
 *
 * Road: in along the top (y 80) to x 240, down to y 320, east to x 480, up to
 * y 160, east to x 720, down to y 400, back west to x 480, down to y 480 and
 * east off the field to the Gate.
 */
const GREEN: FieldDef = {
  id: 'greenline',
  name: 'The Green Line',
  path: [
    { x: -30, y: 80 },
    { x: 240, y: 80 },
    { x: 240, y: 320 },
    { x: 480, y: 320 },
    { x: 480, y: 160 },
    { x: 720, y: 160 },
    { x: 720, y: 400 },
    { x: 480, y: 400 },
    { x: 480, y: 480 },
    { x: 990, y: 480 },
  ],
  posts: {
    s0: { x: 185, y: 200 },
    s1: { x: 430, y: 345 },
    s2: { x: 610, y: 180 },
    s3: { x: 660, y: 300 },
    s4: { x: 655, y: 395 },
    s5: { x: 560, y: 485 },
  },
  // Three boulders, all on ground no tower wants — the dead bottom-left and
  // the far corner. They teach "rock = blocked" on every battle without taking
  // a decision away.
  pieces: [
    [1, 4, 'rock'],
    [1, 5, 'rock'],
    [10, 1, 'rock'],
  ],
  rules: {
    // Two ponds, each on the best ground of its part of the field: an L in the
    // heart of the wrapped pocket (c6–c7 r3, c7 r4) and a pair in the first
    // loop (c4 r2–r3). The company keeps the pocket's rim; it cannot stack the
    // middle.
    flooded: [
      [6, 3, 'water'],
      [7, 3, 'water'],
      [7, 4, 'water'],
      [4, 2, 'water'],
      [4, 3, 'water'],
    ],
    // Five burning patches, one on each bend's best tile — scattered rather
    // than pooled, so they break the obvious posts without closing an area.
    wildfire: [
      [7, 3, 'fire'],
      [5, 4, 'fire'],
      [8, 5, 'fire'],
      [4, 2, 'fire'],
      [2, 2, 'fire'],
    ],
  },
}

/*
 * The Kiln Road on the grid:
 *
 *        0 1 2 3 4 5 6 7 8 9 10 11
 *   r0   T T T T T T T T T T T  T
 *   r1   T . . . . . . . . R R  T
 *   r2   T . . . . . . . . . R  T
 *   r3   T . . . . . . . . . R  T
 *   r4   T . . . . . . . . . .  T
 *   r5   T . . . . . . . . . .  T
 *   r6   T T T T T T T T T T T  T
 *
 * Road: the horde enters bottom-left (y 480), climbs the left (x 160) to the
 * top lane (y 160), runs it east to x 640, drops to the middle lane (y 320)
 * and runs back west to x 320, drops to the bottom lane (y 480) and runs east
 * to the Gate.
 */
const KILN: FieldDef = {
  id: 'kilnroad',
  name: 'The Kiln Road',
  path: [
    { x: -30, y: 480 },
    { x: 160, y: 480 },
    { x: 160, y: 160 },
    { x: 640, y: 160 },
    { x: 640, y: 320 },
    { x: 320, y: 320 },
    { x: 320, y: 480 },
    { x: 990, y: 480 },
  ],
  posts: {
    s0: { x: 95, y: 300 },
    s1: { x: 250, y: 60 },
    s2: { x: 450, y: 185 },
    s3: { x: 450, y: 315 },
    s4: { x: 660, y: 250 },
    s5: { x: 870, y: 300 },
  },
  // A rocky corner where no lane reaches (c9–c10, r1–r3).
  pieces: [
    [9, 1, 'rock'],
    [10, 1, 'rock'],
    [10, 2, 'rock'],
    [10, 3, 'rock'],
  ],
  rules: {
    // A pond across the middle of the field (c6 r2–r3) and an L between the
    // middle and bottom lanes (c5 r4–r5, c6 r4): the tiles that see all three
    // lanes shrink to their edges.
    flooded: [
      [6, 2, 'water'],
      [6, 3, 'water'],
      [5, 4, 'water'],
      [5, 5, 'water'],
      [6, 4, 'water'],
    ],
    wildfire: [
      [3, 3, 'fire'],
      [6, 2, 'fire'],
      [5, 5, 'fire'],
      [3, 5, 'fire'],
      [7, 4, 'fire'],
    ],
  },
}

const FIELD_DEFS: readonly FieldDef[] = [GREEN, KILN]
const defById = (id: string): FieldDef | undefined => FIELD_DEFS.find((d) => d.id === id)

/**
 * Lay one field's grid, with a map challenge's pieces on top when it has one,
 * and — Q1 — the battle's danger ground and seeded obstacles over both when it
 * has a `hazard` seed (`data/hazards.ts`).
 */
function buildField(def: FieldDef, rule: TerrainRuleId | null, hazard: number | null = null): GameMap {
  const laid = layTiles(def.path, [...def.pieces, ...(rule ? def.rules[rule] : [])])
  const tiles = hazard == null ? laid : layHazards(laid, def.path, hazard)
  const variant = rule != null || hazard != null
  return {
    id: `${def.id}${rule ? `~${rule}` : ''}${hazard != null ? `~h${hazard}` : ''}`,
    name: def.name,
    width: FIELD_W,
    height: FIELD_H,
    path: def.path,
    base: def.path[def.path.length - 1],
    slots: tiles.filter((t) => !t.block).map((t) => ({ id: t.id, pos: t.pos })),
    tile: TILE,
    tiles,
    ...(rule ? { terrainRule: rule } : {}),
    ...(hazard != null ? { hazardSeed: hazard } : {}),
    ...(variant ? { baseId: def.id } : {}),
  }
}

export const FIRST_MAP: GameMap = buildField(GREEN, null)
export const KILN_MAP: GameMap = buildField(KILN, null)

/**
 * Every battle map this build ships. The run snapshot stores a map *id*, so this
 * registry is what turns one back into a field — add a map here and a save that
 * names it resumes onto the right one, instead of onto whatever happens to be
 * first (m-5).
 *
 * **Tile ids are shared across every map on purpose.** `Placement` is keyed by
 * tile id (`c{col}r{row}`) and rides in the run snapshot; a company deployed to
 * `c7r2` resumes to `c7r2` whichever twin it is standing on. What changes
 * between fields — and between battles, under a map challenge — is which tiles
 * are OPEN, so a placement on a tile the next battle blocks is dropped back to
 * the bench when that battle is entered (`run/map.carryPlacements`).
 */
export const ALL_MAPS: readonly GameMap[] = [FIRST_MAP, KILN_MAP]

/** The map with this id, or null if this build has never heard of it. */
export const mapById = (id: string): GameMap | null => ALL_MAPS.find((m) => m.id === id) ?? null

/**
 * The open tile a pre-grid build circle maps to on `fieldId`: the nearest open
 * tile of the field's base terrain to where the circle stood (ties by id).
 * Null for an id that was never a circle or a field this build does not have.
 */
export function legacyPostTile(fieldId: string, postId: string): string | null {
  const def = defById(fieldId)
  const land = mapById(fieldId)
  const at = def?.posts[postId]
  if (!def || !land || !at) return null
  let best: { id: string; d: number } | null = null
  for (const s of land.slots) {
    const d = Math.hypot(s.pos.x - at.x, s.pos.y - at.y)
    if (!best || d < best.d - 1e-9 || (Math.abs(d - best.d) <= 1e-9 && s.id < best.id)) best = { id: s.id, d }
  }
  return best?.id ?? null
}

/** Every pre-grid circle id → its tile on `fieldId` (see {@link legacyPostTile}). */
export function legacyPosts(fieldId: string): Record<string, string> {
  const def = defById(fieldId)
  if (!def) return {}
  const out: Record<string, string> = {}
  for (const id of Object.keys(def.posts)) {
    const t = legacyPostTile(fieldId, id)
    if (t) out[id] = t
  }
  return out
}

/**
 * ---------------------------------------------------------------------------
 * Portrait battlefields
 * ---------------------------------------------------------------------------
 *
 * A 960×560 landscape field on a portrait phone is width-bound: at 390×844 in
 * a live wave the Stage is 390×573 and the field used 390×228 of it, with ~170
 * px of decorative forest above and below (more on a 430×932). The lane is the
 * subject of the game and it was 40% of the screen it had.
 *
 * So every field ships a PORTRAIT TWIN, drawn tall, and a phone fights on it.
 *
 * **The twin is the landscape field under an isometry**, not a redrawn map: the
 * transpose `(x, y) → (y + PORTRAIT_PAD, x)`, a reflection across the diagonal
 * plus a shift. Rather than authoring a second path by hand and then tuning it
 * until it measures "close", the twin is exactly as long (±0 px), has the same
 * tiles, and every tile sees exactly the same road at every range, every
 * aura pair is the same distance apart, and the order in which the column meets
 * each slot is unchanged. Balance does not *transfer*, it is identical by
 * construction — and `balance/report.ts` §17 proves it on the live engine (a
 * geometry check plus a stop-rate / Gate-HP battery at several depths), so any
 * future axis-dependent rule in the sim (a lob that falls "down", a spawn edge
 * that assumes x) fails the gate instead of quietly making phones easier.
 *
 * That matters more than it looks: the **Daily Watch deals one seed to every
 * player**, on whatever device they own. A portrait twin that was "within 3%"
 * would make the daily a different puzzle on a phone than on a desk. An
 * isometric one makes it the same puzzle turned on its side.
 *
 * The transpose sends the landscape's left edge to the top: the column enters
 * at the top of a phone screen and walks down toward the Gate at the bottom,
 * which is where the party row and the wave strip are — the fight moves toward
 * the player's thumb. `PORTRAIT_PAD` widens the field by 30 px either side so
 * the meadow fills a 390-wide Stage (the field is height-bound there: 573/960
 * = 0.597, so it can be up to 653 wide before width starts to bind).
 *
 * Scale at the live Stage (CSS px per field px), landscape → portrait:
 * 390×844 0.406 → 0.597 · 375×667 0.391 → 0.435 · 320×568 0.333 → 0.344 ·
 * 430×932 0.448 → 0.689. Units draw at the field's own density, so a goblin
 * that was ~24 CSS px on a 390 phone is ~35 on the portrait field.
 */
export const PORTRAIT_PAD = 30

export type FieldOrientation = 'landscape' | 'portrait'

/**
 * The portrait twin of a landscape field — see the note above. The deployment
 * grid goes over with it (G1-2): every tile keeps its id, its centre is
 * transposed, and its column/row swap, so the twin's grid is 7 × 12.
 */
function portraitTwin(m: GameMap): GameMap {
  const t = (p: Vec2): Vec2 => ({ x: p.y + PORTRAIT_PAD, y: p.x })
  const path = m.path.map(t)
  return {
    id: `${m.id}-tall`,
    name: m.name,
    width: m.height + PORTRAIT_PAD * 2,
    height: m.width,
    path,
    base: path[path.length - 1],
    slots: m.slots.map((s) => ({ id: s.id, pos: t(s.pos) })),
    ...(m.tiles ? { tile: m.tile, tiles: m.tiles.map((c) => ({ ...c, pos: t(c.pos), col: c.row, row: c.col })) } : {}),
    ...(m.terrainRule ? { terrainRule: m.terrainRule } : {}),
    ...(m.hazardSeed != null ? { hazardSeed: m.hazardSeed } : {}),
    ...(m.baseId ? { baseId: m.baseId } : {}),
    orientation: 'portrait',
    twinOf: m.id,
  }
}

/** Every portrait twin, in `ALL_MAPS` order. Never dealt by `pickBattleMap`. */
export const PORTRAIT_MAPS: readonly GameMap[] = ALL_MAPS.map(portraitTwin)

/**
 * The run's field identity for any map, landscape or twin, with or without a
 * map challenge — what the seed dealt, what the snapshot stores, what the
 * music cue keys on.
 */
export const fieldIdOf = (m: GameMap): string => m.baseId ?? m.twinOf ?? m.id

/** Which way up a map is drawn. */
export const orientationOf = (m: GameMap): FieldOrientation => m.orientation ?? 'landscape'

/**
 * Challenge variants, built on first use and kept, so a field is always the
 * SAME object for the same (field, rule, orientation) — the terrain bake, the
 * store's equality checks and `orientField`'s idempotence all lean on that.
 */
const variants = new Map<string, GameMap>()
/**
 * Q1: a battle with danger ground is one variant per SEED, so those are kept in
 * a small most-recent-first cache instead (the balance suite lays tens of
 * thousands of them). Within one battle the same seed keeps coming back, so it
 * stays the same object for as long as anything is looking at it.
 */
const HAZARD_CACHE = 16
let hazardVariants: { key: string; map: GameMap }[] = []

/**
 * The map a battle on `fieldId` is fought on: its base terrain plus the
 * challenge `rule` adds (G1-2), plus — Q1 — the danger ground and seeded
 * obstacles laid from `hazard` when there is one, drawn `orientation` up. A
 * pure lookup. An unknown field id returns null.
 */
export function fieldFor(
  fieldId: string,
  rule: TerrainRuleId | null,
  orientation: FieldOrientation,
  hazard: number | null = null,
): GameMap | null {
  const land = mapById(fieldId)
  if (!land) return null
  if (hazard != null) {
    const key = `${fieldId}~${rule ?? ''}~h${hazard}~${orientation}`
    const hit = hazardVariants.find((e) => e.key === key)
    if (hit) return hit.map
    const flatKey = `${fieldId}~${rule ?? ''}~h${hazard}~landscape`
    const flat = hazardVariants.find((e) => e.key === flatKey)?.map ?? buildField(defById(fieldId)!, rule, hazard)
    const m = orientation === 'landscape' ? flat : portraitTwin(flat)
    const add = [{ key, map: m }, ...(flatKey !== key && !hazardVariants.some((e) => e.key === flatKey) ? [{ key: flatKey, map: flat }] : [])]
    hazardVariants = [...add, ...hazardVariants].slice(0, HAZARD_CACHE)
    return m
  }
  if (!rule) return orientation === 'landscape' ? land : (PORTRAIT_MAPS.find((m) => m.twinOf === fieldId) ?? land)
  const key = `${fieldId}~${rule}~${orientation}`
  let m = variants.get(key)
  if (!m) {
    const def = defById(fieldId)!
    const flat = variants.get(`${fieldId}~${rule}~landscape`) ?? buildField(def, rule)
    variants.set(`${fieldId}~${rule}~landscape`, flat)
    m = orientation === 'landscape' ? flat : portraitTwin(flat)
    variants.set(key, m)
  }
  return m
}

/**
 * The field `map` stands for, drawn `orientation` up — same field, same map
 * challenge. Idempotent, and a pure lookup: the field identity never changes,
 * only the twin that is fought on.
 */
export function orientField(map: GameMap, orientation: FieldOrientation): GameMap {
  return fieldFor(fieldIdOf(map), map.terrainRule ?? null, orientation, map.hazardSeed ?? null) ?? map
}

/** The field's name with its map challenge, as the battle screen prints it (G1-2). */
export const fieldTitle = (map: GameMap): string =>
  map.terrainRule ? `${map.name} · ${TERRAIN_RULES[map.terrainRule].name}` : map.name

/** The same field and orientation as `map`, under map challenge `rule` (or none). Keeps its Q1 hazards. */
export function withTerrainRule(map: GameMap, rule: TerrainRuleId | null): GameMap {
  return fieldFor(fieldIdOf(map), rule, orientationOf(map), map.hazardSeed ?? null) ?? map
}

/**
 * Which orientation a battle is fought in, from the viewport at the moment the
 * battle starts (entering its node).
 *
 * Portrait exactly when the shell is the phone column (`< 700` wide, the
 * `shell-wide.css` break — tablets and desks re-flow into a side-by-side
 * layout whose Stage is landscape) AND the window is clearly tall (h ≥ 1.3 w),
 * which every portrait phone is (1.75–2.2) and a near-square narrow desktop
 * window is not. A landscape phone gets the rotate prompt; a short landscape
 * window gets the landscape field.
 *
 * **Fixed for the battle.** The choice is made once, when the node is entered,
 * and stored with the run: a rotation or window resize mid-battle re-fits the
 * same field (letterboxed in the apron) rather than swapping geometry under a
 * placed company, and a resumed battle comes back on the field it was saved
 * on. The next node chooses again. Because the twins are isometric this is a
 * presentation decision with zero balance consequence either way — which is
 * what makes "per battle, from the layout" safe rather than exploitable.
 */
export function chooseFieldOrientation(viewportW: number, viewportH: number): FieldOrientation {
  if (!(viewportW > 0) || !(viewportH > 0)) return 'landscape'
  return viewportW < 700 && viewportH >= viewportW * 1.3 ? 'portrait' : 'landscape'
}

/**
 * Which battlefield a run is fought on — drawn from the run seed, once.
 *
 * It rides its own derived stream (`field`) rather than the map stream, for the
 * same reason every other stream is separate (C1): dealing one more number here
 * must never reshuffle the run map, the loot or the fights. Because it is a
 * pure function of the seed and the choice is stored in the snapshot as an id,
 * a resumed run lands on the field it was interrupted on, and a Banner switch —
 * which re-deals the run map from the same seed — cannot be used to reroll the
 * battlefield.
 */
export function pickBattleMap(runSeed: number): GameMap {
  return streamRng(runSeed, 'field').pick(ALL_MAPS)
}
