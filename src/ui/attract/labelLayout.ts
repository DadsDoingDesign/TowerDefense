/**
 * Where the home map's labels go — the PURE half (no DOM): the roads'
 * signposts, and the focused road's three city labels with their leader
 * lines. `TradeMap`'s `Labels` measures each label and asks here;
 * `tests/labelLayout.test.ts` lays every road out at the phone and desk
 * sizes and checks nothing collides.
 *
 * Everything is in CSS px from the map's top-left.
 *
 * ## Signposts never move on a pick
 *
 * A signpost's place depends on the layout and your standing only — never on
 * which road is in focus (October 2026, "no wiggle": a view you click around
 * keeps its geometry). They are placed in a fixed order: the roads you hold
 * the most standing with first, a road not hiring yet last.
 *
 * ## City labels are annotations
 *
 * The designer: "the city labels on the paths … cluster tightly and overlap,
 * they can be tidy and use annotation lines". The focused road's three cities
 * are hung in a line PARALLEL to the road, all on one side of it, each joined
 * to its town by a thin leader line. The side is the road's outer side (away
 * from the fan's middle; east for the middle road) unless that does not fit;
 * the offset is the smallest that clears the road. Every label stays inside
 * the open area, off the focused road, off every signpost, off the overlays
 * and off the other labels. If no common offset fits, each label takes its
 * own (still on one side, then either side); a name with no room at all is
 * left off the map (its list still reads it).
 */
import type { Rect } from './mapRules'

/** A box, CSS px. */
export interface Box {
  l: number
  r: number
  t: number
  b: number
}

/** Do two boxes overlap (closer than `gap`)? */
export const hits = (a: Box, b: Box, gap = 0): boolean => !(a.r + gap <= b.l || a.l - gap >= b.r || a.b + gap <= b.t || a.t - gap >= b.b)
const clearOf = (q: Box, others: readonly Box[], gap: number) => others.every((p) => !hits(q, p, gap))
const within = (q: Box, o: Box, m = 4) => q.l >= o.l + m && q.r <= o.r - m && q.t >= o.t + 4 && q.b <= o.b - 6
export const boxOf = (o: Rect): Box => ({ l: o.x, r: o.x + o.w, t: o.y, b: o.y + o.h })

// ---------------------------------------------------------------------------
// Signposts
// ---------------------------------------------------------------------------

/**
 * A signpost's placement order: the roads you hold the most standing with
 * first, a road not hiring yet last, then west to east. Never the focus, so a
 * pick never moves a signpost.
 */
export const signPrio = (road: { state: string; standing: number }, index: number): number => (road.state === 'uncharted' ? 0 : 100 + road.standing * 10) - index

export interface SignIn {
  id: string
  /** Where its post stands: the road's end, CSS px (the post's foot). */
  x: number
  y: number
  /** Its visible face, CSS px. */
  w: number
  h: number
  /** Placement order, highest first (ties keep the input's order). Never the focus. */
  prio: number
}
export interface SignOut {
  id: string
  /** The post's foot after placing (the label's `left` / `top`). */
  x: number
  y: number
  /** The face's box. */
  box: Box
}

/**
 * Each signpost at its road's end, nudged sideways (then up or down) to the
 * nearest spot clear of the ones placed before it and of `avoid`, kept inside
 * `open`. The face sits 6px above the foot.
 */
export function placeSignposts(signs: readonly SignIn[], open: Rect, avoid: readonly Box[] = []): SignOut[] {
  const order = signs.map((s, i) => ({ s, i })).sort((a, b) => b.s.prio - a.s.prio || a.i - b.i)
  const placed: Box[] = []
  const out: SignOut[] = []
  for (const { s } of order) {
    const { w, h } = s
    const lo = open.x + 6 + w / 2
    const hi = open.x + open.w - 6 - w / 2
    const clampX = (x: number) => (hi < lo ? open.x + open.w / 2 : Math.max(lo, Math.min(hi, x)))
    const clampY = (y: number) => Math.max(open.y + 6 + h, y)
    const box = (x: number, y: number): Box => ({ l: x - w / 2, r: x + w / 2, t: y - 6 - h, b: y - 6 })
    let at = { x: clampX(s.x), y: clampY(s.y) }
    search: for (const dy of [0, -(h + 4), h + 4, 2 * (h + 4), 3 * (h + 4)]) {
      for (let d = 0; d <= 240; d += 8) {
        for (const sg of d ? [1, -1] : [1]) {
          const x = clampX(s.x + sg * d)
          const y = clampY(s.y + dy)
          const q = box(x, y)
          if (clearOf(q, placed, 4) && clearOf(q, avoid, 4)) {
            at = { x, y }
            break search
          }
        }
      }
    }
    const b = box(at.x, at.y)
    placed.push(b)
    out.push({ id: s.id, x: at.x, y: at.y, box: b })
  }
  // Back in the input's order.
  return signs.map((s) => out.find((o) => o.id === s.id)!)
}

/**
 * The HQ keep and the militia's banner over it (`paintMap.drawHub`), CSS px:
 * no city label covers your own town.
 */
export const hubBoxes = (hub: readonly [number, number], cssPerPx: number): Box[] => {
  const at = (l: number, r: number, t: number, b: number): Box => ({ l: (hub[0] + l) * cssPerPx, r: (hub[0] + r) * cssPerPx, t: (hub[1] + t) * cssPerPx, b: (hub[1] + b) * cssPerPx })
  return [at(-8, 9, -12, 3), at(8, 19, -22, -7)]
}

// ---------------------------------------------------------------------------
// City labels
// ---------------------------------------------------------------------------

export interface CityIn {
  /** The town's marker, CSS px. */
  x: number
  y: number
  /** The label's size, CSS px. */
  w: number
  h: number
}
export interface CityOut {
  box: Box
  /** The leader: from just off the town's marker to the label's near edge. */
  line: { x1: number; y1: number; x2: number; y2: number }
  /** Which side of its label the leader meets: the label's coloured edge goes there. */
  edge: 'left' | 'right' | 'top' | 'bottom'
}

/** A road's pixels as a set of `CELL`-px cells, to test a box against. */
const CELL = 4
export function roadCells(chains: readonly (readonly (readonly [number, number])[])[], pad = 3): Set<number> {
  const s = new Set<number>()
  for (const ch of chains)
    for (const [x, y] of ch)
      for (let cx = Math.floor((x - pad) / CELL); cx <= Math.floor((x + pad) / CELL); cx++)
        for (let cy = Math.floor((y - pad) / CELL); cy <= Math.floor((y + pad) / CELL); cy++) s.add(cx * 8192 + cy)
  return s
}
export function cellsUnder(q: Box, cells: Set<number>): number {
  let n = 0
  for (let cx = Math.floor(q.l / CELL); cx <= Math.floor((q.r - 0.01) / CELL); cx++)
    for (let cy = Math.floor(q.t / CELL); cy <= Math.floor((q.b - 0.01) / CELL); cy++) if (cells.has(cx * 8192 + cy)) n++
  return n
}

const OFFSETS = [18, 26, 36, 48, 62, 78, 96]

/**
 * Lay out the focused road's three city labels (hub first, the destination
 * last). `own` is the focused road's chain, `others` the other roads' (a label
 * may cross one, at a cost), `blocked` the signposts and overlays, `bounds`
 * the open area. Returns one result per town, or null for a name with no room.
 */
export function placeCityLabels(o: {
  towns: readonly CityIn[]
  hub: readonly [number, number]
  own: readonly (readonly [number, number])[]
  others: readonly (readonly (readonly [number, number])[])[]
  blocked: readonly Box[]
  /** Boxes a label may not cover but a leader may cross (your keep, `hubBoxes`). */
  keep?: readonly Box[]
  bounds: Rect
  /** The fan's middle x: the outer side is away from it. */
  midX: number
}): (CityOut | null)[] {
  const { towns, hub } = o
  const dest = towns[towns.length - 1]
  const bounds = boxOf(o.bounds)
  let ux = dest.x - hub[0]
  let uy = dest.y - hub[1]
  const len = Math.hypot(ux, uy) || 1
  ux /= len
  uy /= len
  // The two normals; the outer one points away from the fan's middle (east for a road up the middle).
  const nA: [number, number] = [-uy, ux]
  const nB: [number, number] = [uy, -ux]
  const outward = dest.x - o.midX
  const outer = Math.abs(outward) < 12 ? (nA[0] >= 0 ? nA : nB) : Math.sign(nA[0]) === Math.sign(outward) ? nA : nB
  const inner = outer === nA ? nB : nA
  const own = roadCells([o.own], 4)
  const ownLine = roadCells([o.own], 1)
  /** Does a leader cross its own road (past its first few px, by the town)? */
  const crossesOwn = (l: CityOut['line']) => {
    const L = Math.hypot(l.x2 - l.x1, l.y2 - l.y1)
    for (let d = 6; d < L; d += 2) {
      const x = l.x1 + ((l.x2 - l.x1) * d) / L
      const y = l.y1 + ((l.y2 - l.y1) * d) / L
      if (ownLine.has(Math.floor(x / CELL) * 8192 + Math.floor(y / CELL))) return true
    }
    return false
  }
  const reach = (l: CityOut['line']) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1)
  const other = roadCells(o.others, 2)
  // The towns' own markers are kept clear too.
  const marks: Box[] = towns.map((t) => ({ l: t.x - 7, r: t.x + 7, t: t.y - 10, b: t.y + 5 }))

  /** A label hung off its town at offset `d` along normal `n`. */
  const hang = (t: CityIn, n: readonly [number, number], d: number): CityOut => {
    const ax = t.x + n[0] * d
    const ay = t.y + n[1] * d
    let box: Box
    let edge: CityOut['edge']
    if (Math.abs(n[0]) >= 0.45) {
      edge = n[0] > 0 ? 'left' : 'right'
      const l = n[0] > 0 ? ax : ax - t.w
      box = { l, r: l + t.w, t: ay - t.h / 2, b: ay + t.h / 2 }
    } else {
      edge = n[1] < 0 ? 'bottom' : 'top'
      const tp = n[1] < 0 ? ay - t.h : ay
      box = { l: ax - t.w / 2, r: ax + t.w / 2, t: tp, b: tp + t.h }
    }
    return { box, edge, line: leader(t, box, edge) }
  }
  const column = (n: readonly [number, number]) => Math.abs(n[0]) >= 0.45
  /** The label slid `s` px along its line (down a column, or along a row). */
  const slide = (c: CityOut, t: CityIn, n: readonly [number, number], s: number): CityOut => {
    const box = column(n) ? { ...c.box, t: c.box.t + s, b: c.box.b + s } : { ...c.box, l: c.box.l + s, r: c.box.r + s }
    return { box, edge: c.edge, line: leader(t, box, c.edge) }
  }
  const signs = o.blocked
  const ok = (c: CityOut, placed: readonly CityOut[]) =>
    within(c.box, bounds) &&
    cellsUnder(c.box, own) === 0 &&
    clearOf(c.box, signs, 3) &&
    clearOf(c.box, marks, 2) &&
    clearOf(c.box, o.keep ?? [], 2) &&
    !crossesOwn(c.line) &&
    placed.every((p) => !hits(c.box, p.box, 4) && !segHitsBox(c.line, p.box) && !segHitsBox(p.line, c.box) && !segsCross(c.line, p.line)) &&
    signs.every((b) => !segHitsBox(c.line, b))
  /**
   * Lay all three on side `n` at offset `d` (or, with `d` null, each at the
   * smallest offset that fits it), the destination first, each slid along
   * its line as little as it takes.
   */
  const plan = (n: readonly [number, number], d: number | null): { outs: CityOut[]; slid: number } | null => {
    const outs: CityOut[] = []
    let slid = 0
    for (let i = towns.length - 1; i >= 0; i--) {
      const t = towns[i]
      const k = column(n) ? (t.h + 4) / 2 : 16
      let pick: CityOut | null = null
      search: for (const dd of d == null ? OFFSETS : [d]) {
        const base = hang(t, n, dd)
        for (const s of SLIDES) {
          const c = slide(base, t, n, s * k)
          if (ok(c, outs)) {
            pick = c
            slid += Math.abs(s * k)
            break search
          }
        }
      }
      if (!pick) return null
      outs.unshift(pick)
    }
    return { outs, slid }
  }

  // 1. One offset for all three, on one side: the tidiest. The cheapest plan
  //    wins: little road of any other company under it, a short reach, the
  //    outer side, little sliding.
  //    Square to the road first (the outer side, then the inner); on a short,
  //    crowded road, straight out to one side (a column) or above or below
  //    (a row), at a cost.
  const square: (readonly [number, number])[] = [
    [1, 0],
    [-1, 0],
    [0, -1],
    [0, 1],
  ]
  const sides: { n: readonly [number, number]; penalty: number }[] = [
    { n: outer, penalty: 0 },
    { n: inner, penalty: 40 },
    ...square.map((n) => ({ n, penalty: 60 })),
  ]
  let best: { outs: CityOut[]; cost: number } | null = null
  for (const { n, penalty } of sides) {
    // One offset for all three; failing that, each its own, still on this side (at a small cost).
    for (const d of [...OFFSETS, null]) {
      const p = plan(n, d)
      if (!p) continue
      // Short leaders read best: the reach of all three, not the nominal offset.
      const cost = p.outs.reduce((a, c) => a + cellsUnder(c.box, other) * 3 + reach(c.line), 0) + penalty + (d == null ? 20 : 0)
      if (!best || cost < best.cost) best = { outs: p.outs, cost }
    }
  }
  if (best) return best.outs

  // 2. Each label its own offset: the outer side first, then the inner; the destination first.
  const out: (CityOut | null)[] = towns.map(() => null)
  const placed: CityOut[] = []
  for (let i = towns.length - 1; i >= 0; i--) {
    let pick: CityOut | null = null
    search: for (const n of [outer, inner]) {
      for (const d of OFFSETS) {
        const base = hang(towns[i], n, d)
        for (const s of SLIDES) {
          const c = slide(base, towns[i], n, s * (column(n) ? (towns[i].h + 4) / 2 : 16))
          if (ok(c, placed)) {
            pick = c
            break search
          }
        }
      }
    }
    out[i] = pick
    if (pick) placed.push(pick)
  }
  return out
}

/** How far a label may slide along its line, in steps (half a label down a column, 16px along a row). */
const SLIDES = [0, 1, -1, 2, -2, 3, -3, 4, -4]

/** The leader from just off the town's marker to the middle of the label's near edge. */
function leader(t: CityIn, box: Box, edge: CityOut['edge']): CityOut['line'] {
  const x2 = edge === 'left' ? box.l : edge === 'right' ? box.r : (box.l + box.r) / 2
  const y2 = edge === 'top' ? box.t : edge === 'bottom' ? box.b : (box.t + box.b) / 2
  const dx = x2 - t.x
  const dy = y2 - t.y
  const L = Math.hypot(dx, dy) || 1
  const start = Math.min(4, L / 2)
  return { x1: t.x + (dx / L) * start, y1: t.y + (dy / L) * start, x2, y2 }
}

type Seg = CityOut['line']
/** Does a leader pass through a box (its inside, not its edge)? Sampled every 2px. */
export function segHitsBox(s: Seg, b: Box): boolean {
  const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1)
  const n = Math.max(1, Math.ceil(L / 2))
  for (let i = 0; i <= n; i++) {
    const x = s.x1 + ((s.x2 - s.x1) * i) / n
    const y = s.y1 + ((s.y2 - s.y1) * i) / n
    if (x > b.l + 1 && x < b.r - 1 && y > b.t + 1 && y < b.b - 1) return true
  }
  return false
}
/** Do two leaders cross? */
export function segsCross(a: Seg, b: Seg): boolean {
  const o = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px))
  return (
    o(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1) * o(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2) < 0 && o(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1) * o(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2) < 0
  )
}
