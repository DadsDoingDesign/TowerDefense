import { RNG } from '../core/rng'
import type { Vec2 } from '../core/vec'
import type { GameMap } from '../types'
import { mapFromDef, type FieldDef } from './maps'
import { patch, type TerrainPiece } from './terrain'

/**
 * ---------------------------------------------------------------------------
 * Procedural battlefields (Oct 2026)
 * ---------------------------------------------------------------------------
 *
 * The designer: "can battlefields be procedural? This way we can control
 * weights instead of manually making each variant."
 *
 * A field is its ROAD (plus a few rock patches); `layTiles` derives the open
 * tiles from it, the hazards are seeded on top, the portrait twin is derived,
 * the caravan finds its own spot. So this module only has to deal a road,
 * and say how good it is.
 *
 * ## The road
 *
 * A self-avoiding walk on a lattice of tile centres TWO tiles apart (80px):
 * columns 3, 5, … 19 (x 140…780) and rows 1, 3, … 11 (y 60…460). It enters
 * from the left at its first row (x −30 → 140) and leaves to the right at its
 * last (x 780 → 990). Two roads that never share a lattice point never cross,
 * and two that pass on neighbouring lattice points leave one open tile
 * between them — the Green Line's tightest gap.
 *
 * Length is fixed by construction: 170 in + 210 out + 80 a step, and a walk
 * takes 23 or 24 steps, so every road is 2,220 or 2,300px — exactly the two
 * shipped fields. Enemy speeds are tuned as crossing times (`maps.ts`), so a
 * generated road is as fair as a hand-made one by length.
 *
 * ## The weights
 *
 * {@link FieldWeights}: how strongly the walk goes on (east), turns (north or
 * south), doubles back (west), and keeps its heading; the shortest run between
 * two corners; how many corners a road
 * may have; how long one straight may run; how many choke tiles it needs; how
 * many one-tile gaps it may squeeze; how much dead ground becomes rock.
 *
 * ## The score
 *
 * {@link scoreField} measures a built road the way a player would: corners,
 * longest straight, open tiles, CHOKE tiles (an open tile whose reach covers
 * two stretches of road far apart along it — the posts worth arguing over),
 * the best tile's road-in-reach, one-tile gaps, and how much road runs along
 * the forest edge where nobody can stand. A road is kept only inside its
 * weights' bands.
 *
 * Pure and seeded: the same (weights, seed) deals the same field.
 */

export interface FieldWeights {
  /** A step east (towards the exit). */
  forward: number
  /** A step north or south. */
  turn: number
  /** A step west (doubling back). */
  back: number
  /** Multiplier on the weight of keeping the last heading (> 1: longer straights). */
  straight: number
  /**
   * The shortest run between two corners, in lattice steps (80px each). 2
   * keeps every bend a real bend: at 1 the walk makes one-step staircases
   * and notches, which read as a glitch, not a road.
   */
  minRun: number
  /** Corners the road may have. */
  turns: readonly [number, number]
  /** The longest one straight may run, px. */
  maxStraight: number
  /** Choke tiles the road must make. */
  minChokes: number
  /** One-tile gaps (a tile with road on two opposite sides) it may squeeze. */
  maxTight: number
  /** The most of the road that may run along the forest edge, where nobody can stand (0–1). */
  maxEdge: number
  /** Rock patches laid on dead ground (tiles no road is near). */
  rocks: readonly [number, number]
}

/** The three profiles the gallery shows (and the generator's default is the first). */
export const FIELD_PROFILES: Readonly<Record<string, { label: string; weights: FieldWeights }>> = {
  // Bands calibrated on the two hand-made fields: the Green Line scores 8
  // corners, a 500px longest straight, 46 chokes, 7 tight tiles, 0.33 edge;
  // the Kiln Road 6, 660, 72, 0, 0.36.
  balanced: {
    label: 'Balanced',
    weights: { forward: 1, turn: 1, back: 0.55, straight: 1.6, minRun: 2, turns: [7, 9], maxStraight: 560, minChokes: 36, maxTight: 7, maxEdge: 0.4, rocks: [1, 2] },
  },
  switchbacks: {
    label: 'Switchbacks',
    weights: { forward: 0.7, turn: 0.9, back: 0.9, straight: 3.5, minRun: 2, turns: [5, 8], maxStraight: 640, minChokes: 45, maxTight: 8, maxEdge: 0.4, rocks: [0, 1] },
  },
  winding: {
    label: 'Winding',
    weights: { forward: 1, turn: 1.6, back: 0.5, straight: 0.5, minRun: 2, turns: [10, 14], maxStraight: 320, minChokes: 36, maxTight: 6, maxEdge: 0.45, rocks: [1, 3] },
  },
}

const COLS = [3, 5, 7, 9, 11, 13, 15, 17, 19] as const
const ROWS = [1, 3, 5, 7, 9, 11] as const
const at = (ci: number, ri: number): Vec2 => ({ x: 20 + 40 * COLS[ci], y: 20 + 40 * ROWS[ri] })
/** The walk's length in lattice steps: 2,220 or 2,300px with the way in and out. */
const STEPS = [23, 24] as const

type Dir = 'E' | 'W' | 'N' | 'S'
const MOVES: Record<Dir, [number, number]> = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] }

/**
 * One road: the lattice walk as a polyline (corners only), entering at x −30
 * and leaving at x 990. Null if the walk boxed itself in within its budget.
 */
function walkRoad(rng: RNG, w: FieldWeights): Vec2[] | null {
  const steps = STEPS[rng.int(0, STEPS.length - 1)]
  const r0 = rng.int(0, ROWS.length - 1)
  const seen = new Set<string>()
  const key = (c: number, r: number) => `${c},${r}`
  const trail: [number, number][] = [[0, r0]]
  seen.add(key(0, r0))
  let budget = 4000
  const lastCol = COLS.length - 1
  // Depth-first with weighted, shuffled choices and backtracking.
  const go = (c: number, r: number, left: number, heading: Dir, run: number): boolean => {
    if (--budget < 0) return false
    // Done in the exit column — and the last run is a real one too, unless it
    // already heads east into the way out.
    if (left === 0) return c === lastCol && (heading === 'E' || run >= w.minRun)
    // Can the exit still be reached? (Each step moves one column at most.)
    if (lastCol - c > left) return false
    const opts: { d: Dir; wt: number }[] = []
    for (const d of ['E', 'N', 'S', 'W'] as Dir[]) {
      const [dc, dr] = MOVES[d]
      const nc = c + dc
      const nr = r + dr
      if (nc < 0 || nc > lastCol || nr < 0 || nr >= ROWS.length || seen.has(key(nc, nr))) continue
      // Only the last step may arrive in the exit column — the road leaves from there.
      if (nc === lastCol && left > 1 && d !== 'E') continue
      // A corner only after a run of at least `minRun` steps.
      if (d !== heading && run < w.minRun) continue
      let wt = d === 'E' ? w.forward : d === 'W' ? w.back : w.turn
      if (d === heading) wt *= w.straight
      opts.push({ d, wt })
    }
    // A weighted shuffle: draw without replacement.
    while (opts.length) {
      const total = opts.reduce((s, o) => s + o.wt, 0)
      let roll = rng.range(0, total)
      let i = 0
      for (; i < opts.length - 1; i++) {
        roll -= opts[i].wt
        if (roll <= 0) break
      }
      const { d } = opts.splice(i, 1)[0]
      const [dc, dr] = MOVES[d]
      const nc = c + dc
      const nr = r + dr
      seen.add(key(nc, nr))
      trail.push([nc, nr])
      if (go(nc, nr, left - 1, d, d === heading ? run + 1 : 1)) return true
      trail.pop()
      seen.delete(key(nc, nr))
    }
    return false
  }
  // The way in is a long straight already, so the first lattice step may turn.
  if (!go(0, r0, steps, 'E', w.minRun)) return null
  // The whole line — in, the walk, out — then corners only.
  const pts = trail.map(([c, r]) => at(c, r))
  const line: Vec2[] = [{ x: -30, y: pts[0].y }, ...pts, { x: 990, y: pts[pts.length - 1].y }]
  const corners: Vec2[] = [line[0]]
  for (let i = 1; i < line.length - 1; i++) {
    const a = corners[corners.length - 1]
    const b = line[i]
    const c = line[i + 1]
    const straight = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)
    if (!straight) corners.push(b)
  }
  corners.push(line[line.length - 1])
  return corners
}

/** Rock patches on dead ground: 2×2 tiles no road comes within three tiles of. */
function layRocks(rng: RNG, road: Vec2[], count: number): TerrainPiece[] {
  const out: TerrainPiece[] = []
  const used = new Set<string>()
  for (let tries = 0; out.length < count * 4 && tries < 200; tries++) {
    const c = rng.int(2, 19)
    const r = rng.int(2, 9)
    const cells = patch(c, r, 'rock', 2, 2)
    const ok = cells.every(([cc, rr]) => !used.has(`${cc},${rr}`) && distToRoad({ x: 20 + 40 * cc, y: 20 + 40 * rr }, road) > 110)
    if (!ok) continue
    for (const [cc, rr] of cells) used.add(`${cc},${rr}`)
    out.push(...cells)
  }
  return out
}

function distToSeg(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const L = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
const distToRoad = (p: Vec2, road: readonly Vec2[]) => {
  let best = Infinity
  for (let i = 0; i < road.length - 1; i++) best = Math.min(best, distToSeg(p, road[i], road[i + 1]))
  return best
}

export interface FieldScore {
  /** Road length, px (2,220 or 2,300 by construction). */
  length: number
  /** Corners. */
  turns: number
  /** The longest straight, px (on the field). */
  longestStraight: number
  /** Tiles a hero may stand on. */
  open: number
  /** Open tiles whose reach covers two stretches of road ≥ 400px apart along it. */
  chokes: number
  /** The best tile's road-in-reach, px. */
  bestReach: number
  /** Open tiles with road on two opposite sides, one tile away. */
  tight: number
  /** Share of the on-field road along the forest edge (rows 1 and 11), 0–1. */
  edge: number
}

/** The reach the score measures a post with (a mid-range hero's). */
export const SCORE_REACH = 130

export function scoreField(map: GameMap): FieldScore {
  const road = map.path
  // The road as samples every 10px, with their distance along it.
  const samples: { p: Vec2; s: number }[] = []
  let s = 0
  for (let i = 0; i < road.length - 1; i++) {
    const a = road[i]
    const b = road[i + 1]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    for (let d = 0; d < len; d += 10) samples.push({ p: { x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len }, s: s + d })
    s += len
  }
  const onField = (p: Vec2) => p.x >= 0 && p.x <= map.width && p.y >= 0 && p.y <= map.height
  let chokes = 0
  let bestReach = 0
  let tight = 0
  for (const t of map.slots) {
    const near = samples.filter((q) => onField(q.p) && Math.hypot(q.p.x - t.pos.x, q.p.y - t.pos.y) <= SCORE_REACH)
    if (near.length) {
      const lo = Math.min(...near.map((q) => q.s))
      const hi = Math.max(...near.map((q) => q.s))
      if (hi - lo >= 400) chokes++
      bestReach = Math.max(bestReach, near.length * 10)
    }
    const lane = (dx: number, dy: number) => distToRoad({ x: t.pos.x + dx, y: t.pos.y + dy }, road) < 1
    if ((lane(40, 0) && lane(-40, 0)) || (lane(0, 40) && lane(0, -40))) tight++
  }
  // Corners and straights, on the field only.
  let turns = 0
  let longest = 0
  let edgeLen = 0
  let fieldLen = 0
  for (let i = 0; i < road.length - 1; i++) {
    const a = { x: Math.max(0, Math.min(map.width, road[i].x)), y: road[i].y }
    const b = { x: Math.max(0, Math.min(map.width, road[i + 1].x)), y: road[i + 1].y }
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    longest = Math.max(longest, len)
    fieldLen += len
    if (a.y === b.y && (a.y <= 60 || a.y >= 460)) edgeLen += len
    if (i > 0) turns++
  }
  return {
    length: Math.round(s),
    turns,
    longestStraight: Math.round(longest),
    open: map.slots.length,
    chokes,
    bestReach,
    tight,
    edge: fieldLen ? Math.round((edgeLen / fieldLen) * 100) / 100 : 0,
  }
}

/** Whether a score sits inside its weights' bands. */
export function withinBands(sc: FieldScore, w: FieldWeights): boolean {
  return (
    sc.turns >= w.turns[0] &&
    sc.turns <= w.turns[1] &&
    sc.longestStraight <= w.maxStraight &&
    sc.chokes >= w.minChokes &&
    sc.tight <= w.maxTight &&
    sc.edge <= w.maxEdge
  )
}

export interface GeneratedField {
  map: GameMap
  score: FieldScore
  /** The seed of the try that was kept (the deal is reproducible from it). */
  seed: number
  /** How many roads were dealt before one passed. */
  tries: number
}

/**
 * Deal a field: walk roads off `seed` until one sits inside the weights'
 * bands (at most `maxTries`), lay its rocks, build it through `mapFromDef`.
 * Null when nothing passed — the caller falls back to a hand-made field.
 */
export function generateField(seed: number, w: FieldWeights, opts: { id?: string; name?: string; maxTries?: number } = {}): GeneratedField | null {
  const maxTries = opts.maxTries ?? 120
  for (let i = 0; i < maxTries; i++) {
    const trySeed = (seed * 7919 + i * 104729) >>> 0
    const rng = new RNG(trySeed)
    const road = walkRoad(rng, w)
    if (!road) continue
    const def: FieldDef = { id: opts.id ?? `gen${trySeed}`, name: opts.name ?? 'A new road', path: road, posts: {}, pieces: [], rules: {} }
    const bare = mapFromDef(def)
    const score = scoreField(bare)
    if (!withinBands(score, w)) continue
    const rocks = layRocks(rng, road, rng.int(w.rocks[0], w.rocks[1]))
    const map = rocks.length ? mapFromDef({ ...def, pieces: rocks }) : bare
    return { map, score: rocks.length ? scoreField(map) : score, seed: trySeed, tries: i + 1 }
  }
  return null
}
