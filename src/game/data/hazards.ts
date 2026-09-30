/**
 * ---------------------------------------------------------------------------
 * Danger ground and seeded obstacles (Q1)
 * ---------------------------------------------------------------------------
 *
 * Free placement on the tile grid (G1-2) made the field too easy to solve: the
 * best tile sees ~720px of road where the best old build circle saw 567, and a
 * whole company can stand on the best ground together. The designer's answer:
 *
 * > "danger spots where you can build but it will debuff your tower so it may
 * > force a certain playstyle in a spot that isnt ideal? not too much of this
 * > but maybe the 1 of the best spots get this and then there are some extra
 * > obstacles around and thats part of the seed"
 *
 * So every battle's field is laid with two things on top of its authored
 * terrain and its map challenge, both a pure function of one seed:
 *
 *  - **Cursed ground** ({@link DANGER_TILES}, drawn from the {@link DANGER_POOL}
 *    best open tiles by road coverage). A hero MAY stand there, but deals
 *    {@link CURSED_DAMAGE_MULT}× damage while it does — every point of it: shots,
 *    splash, burns it lights, traps it lays, thorns. That is the forced
 *    playstyle: the tile still sees the most road, so it is the natural post
 *    for a hero whose worth is NOT its damage (a blocker holding the lane, an
 *    aura-bearer), and a carry put there pays for the view.
 *  - **Seeded obstacles** ({@link OBSTACLES} boulders, drawn from the
 *    {@link OBSTACLE_POOL} next-best open tiles, never two side by side). Plain
 *    rock, blocked like any authored rock — "some extra obstacles around".
 *
 * **Pure and seeded.** The seed is a hash of (run seed, node) — see
 * `run/terrain.ts` — never a draw from a run stream, so adding the layout
 * shifts no loot, no map and no fight (RNG draw ORDER is behaviour). The draw
 * itself runs on its own `RNG(seed)`: danger first, then the obstacles.
 *
 * **Coverage** is the balance harness's own measure (road px within 150px of a
 * tile's centre, sampled every 8px) so "one of the best tiles" means the same
 * tile to the game, the preview and the harness's modelled player.
 */
import { RNG } from '../core/rng'
import type { Vec2 } from '../core/vec'
import type { DangerKind, FieldTile, GameMap } from '../types'

// ---- the levers (Q1 balance: tune ONLY these) ------------------------------

/**
 * One object, read at lay time, so the balance harness's exploration CLI can
 * try a setting in-process (`balance/hazard-sweep.ts`); the game never writes
 * it. What each value was measured against is in `balance/README.md` (Q1).
 */
/*
 * Tuned in the no-HP pass (the first lever in its order): ×0.5 / 1 tile of
 * the best 2 → ×0.3 / 3 tiles of the best 6. It is a small lever on §6 — this
 * setting moved the Monte Carlo 83.3% → 79.7%, and the harshest one swept
 * (four ×0 tiles, twelve boulders) only to 78.7% — so the rest of the refit is
 * the Threat curve (`run/threat.ts`). Boulders were left alone: they cost the
 * same few points and take tiles a player can use.
 */
export const HAZARD_LEVERS = {
  /** Damage a hero standing on cursed ground deals, as a multiplier. */
  cursedDamageMult: 0.3,
  /** How many patches (2 × 2 tiles, grid-fit) of each battle's field are cursed. */
  dangerTiles: 3,
  /** The cursed patches are drawn from this many best distinct patches (by coverage). */
  dangerPool: 6,
  /** How many seeded boulder patches each battle's field adds. */
  obstacles: 6,
  /** …drawn from this many best distinct patches after the cursed ones. */
  obstaclePool: 12,
}

/** The shipped values, by name, for the UI copy and the tests. */
export const CURSED_DAMAGE_MULT = HAZARD_LEVERS.cursedDamageMult
export const DANGER_TILES = HAZARD_LEVERS.dangerTiles
export const DANGER_POOL = HAZARD_LEVERS.dangerPool
export const OBSTACLES = HAZARD_LEVERS.obstacles
export const OBSTACLE_POOL = HAZARD_LEVERS.obstaclePool

/** The nominal reach coverage is measured at (the harness's `slotCoverage`). */
export const COVERAGE_RANGE = 150

/** What a danger kind is called and the line the coach strip says for it. */
export const DANGER_COPY: Record<DangerKind, { name: string; line: string; short: string }> = {
  cursed: {
    name: 'Cursed ground',
    line: `Cursed ground — heroes here deal −${Math.round((1 - CURSED_DAMAGE_MULT) * 100)}% damage.`,
    short: `−${Math.round((1 - CURSED_DAMAGE_MULT) * 100)}% damage`,
  },
}

/** Road px within `range` of `pos`, sampling the path every 8px. */
export function roadCoverage(path: readonly Vec2[], pos: Vec2, range = COVERAGE_RANGE): number {
  const step = 8
  let seen = 0
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const n = Math.max(1, Math.round(len / step))
    for (let k = 0; k <= n; k++) {
      const t = k / n
      const x = a.x + (b.x - a.x) * t
      const y = a.y + (b.y - a.y) * t
      if (Math.hypot(x - pos.x, y - pos.y) <= range) seen += len / n
    }
  }
  return Math.round(seen)
}

/**
 * A 2 × 2 patch of open tiles, named by its top-left tile — the unit Q1 lays
 * danger and boulders in since grid-fit, so a patch is still a hero's worth of
 * ground (80px, G1-2's tile) on the 40px lattice.
 */
export interface Patch {
  cells: FieldTile[]
  centre: Vec2
  c: number
  r: number
}

/**
 * Every 2 × 2 patch of open tiles, ranked by the road its centre sees (ties by
 * row, then column), thinned to patches that do not overlap a better one —
 * "the best spots" as distinct places, the way G1-2's tiles were.
 */
export function rankPatches(tiles: readonly FieldTile[], path: readonly Vec2[]): Patch[] {
  const at = new Map(tiles.map((t) => [`${t.col},${t.row}`, t]))
  const patches: (Patch & { cov: number })[] = []
  for (const t of tiles) {
    const cells = [t, at.get(`${t.col + 1},${t.row}`), at.get(`${t.col},${t.row + 1}`), at.get(`${t.col + 1},${t.row + 1}`)]
    if (cells.some((x) => !x || x.block)) continue
    const ok = cells as FieldTile[]
    const centre = { x: (ok[0].pos.x + ok[3].pos.x) / 2, y: (ok[0].pos.y + ok[3].pos.y) / 2 }
    patches.push({ cells: ok, centre, c: t.col, r: t.row, cov: roadCoverage(path, centre) })
  }
  patches.sort((a, b) => b.cov - a.cov || a.r - b.r || a.c - b.c)
  const ranked: Patch[] = []
  for (const p of patches) {
    if (ranked.some((q) => Math.abs(q.c - p.c) < 2 && Math.abs(q.r - p.r) < 2)) continue
    ranked.push({ cells: p.cells, centre: p.centre, c: p.c, r: p.r })
  }
  return ranked
}

/** Do two patches share an edge (G1-2's "never two side by side")? */
export const patchesTouch = (p: Patch, q: Patch): boolean =>
  (Math.abs(q.c - p.c) <= 2 && Math.abs(q.r - p.r) < 2) || (Math.abs(q.r - p.r) <= 2 && Math.abs(q.c - p.c) < 2)

/**
 * Lay a battle's danger ground and seeded obstacles over a laid (landscape)
 * grid. Returns a NEW tile list; open tiles only are ever touched, so the lane,
 * the forest frame, authored rock and a challenge's lakes/fire are kept.
 *
 * Grid-fit: the unit is a 2 × 2 PATCH of open tiles. Every such patch is
 * ranked by the road its centre sees, then the ranking is thinned to patches
 * that do not overlap a better one — "the best spots" are distinct places, as
 * G1-2's tiles were — and the pools and counts ({@link HAZARD_LEVERS}) are
 * drawn from that list exactly as they were drawn from tiles.
 */
export function layHazards(tiles: readonly FieldTile[], path: readonly Vec2[], seed: number): FieldTile[] {
  const rng = new RNG(seed)
  const ranked = rankPatches(tiles, path)

  const L = HAZARD_LEVERS
  const cursed: Patch[] = []
  const pool = ranked.slice(0, L.dangerPool)
  for (let i = 0; i < L.dangerTiles && pool.length; i++) {
    const at = Math.floor(rng.next() * pool.length)
    cursed.push(pool.splice(at, 1)[0])
  }

  const rocks: Patch[] = []
  const touches = (p: Patch) => rocks.some((q) => patchesTouch(p, q))
  const candidates = ranked.filter((p) => !cursed.includes(p)).slice(0, L.obstaclePool)
  while (rocks.length < L.obstacles && candidates.length) {
    const p = candidates.splice(Math.floor(rng.next() * candidates.length), 1)[0]
    if (!touches(p)) rocks.push(p)
  }

  const rockIds = new Set(rocks.flatMap((p) => p.cells.map((t) => t.id)))
  const cursedIds = new Set(cursed.flatMap((p) => p.cells.map((t) => t.id)))
  return tiles.map((t) =>
    rockIds.has(t.id) ? { ...t, block: 'rock' } : cursedIds.has(t.id) ? { ...t, danger: 'cursed' as const } : t,
  )
}

/** The danger on `tileId` of `map`, or null for safe ground or an unknown tile. */
export function dangerAt(map: Pick<GameMap, 'tiles'>, tileId: string): DangerKind | null {
  return map.tiles?.find((t) => t.id === tileId)?.danger ?? null
}

/** The damage multiplier a hero on `tileId` fights at (1 on safe ground). */
export function tileDamageMult(map: Pick<GameMap, 'tiles'>, tileId: string): number {
  return dangerAt(map, tileId) === 'cursed' ? HAZARD_LEVERS.cursedDamageMult : 1
}
