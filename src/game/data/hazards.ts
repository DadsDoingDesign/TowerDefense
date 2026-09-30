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
export const HAZARD_LEVERS = {
  /** Damage a hero standing on cursed ground deals, as a multiplier. */
  cursedDamageMult: 0.5,
  /** How many tiles of each battle's field are cursed. */
  dangerTiles: 1,
  /** The cursed tile is drawn from this many best open tiles (by coverage). */
  dangerPool: 2,
  /** How many seeded boulders each battle's field adds. */
  obstacles: 6,
  /** …drawn from this many best open tiles after the cursed one. */
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
 * Lay a battle's danger ground and seeded obstacles over a laid (landscape)
 * grid. Returns a NEW tile list; open tiles only are ever touched, so the lane,
 * the forest frame, authored rock and a challenge's lakes/fire are kept.
 */
export function layHazards(tiles: readonly FieldTile[], path: readonly Vec2[], seed: number): FieldTile[] {
  const rng = new RNG(seed)
  const open = tiles.filter((t) => !t.block)
  const cov = new Map(open.map((t) => [t.id, roadCoverage(path, t.pos)]))
  const ranked = [...open].sort((a, b) => cov.get(b.id)! - cov.get(a.id)! || a.id.localeCompare(b.id))

  const L = HAZARD_LEVERS
  const cursed = new Set<string>()
  const pool = ranked.slice(0, L.dangerPool)
  for (let i = 0; i < L.dangerTiles && pool.length; i++) {
    const at = Math.floor(rng.next() * pool.length)
    cursed.add(pool.splice(at, 1)[0].id)
  }

  const rocks = new Set<string>()
  const byId = new Map(tiles.map((t) => [t.id, t]))
  const touches = (t: FieldTile) =>
    [...rocks].some((id) => {
      const o = byId.get(id)!
      return Math.abs(o.col - t.col) + Math.abs(o.row - t.row) === 1
    })
  const candidates = ranked.filter((t) => !cursed.has(t.id)).slice(0, L.obstaclePool)
  while (rocks.size < L.obstacles && candidates.length) {
    const t = candidates.splice(Math.floor(rng.next() * candidates.length), 1)[0]
    if (!touches(t)) rocks.add(t.id)
  }

  return tiles.map((t) =>
    rocks.has(t.id) ? { ...t, block: 'rock' } : cursed.has(t.id) ? { ...t, danger: 'cursed' as const } : t,
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
