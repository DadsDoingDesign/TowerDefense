/**
 * Hask designs — the stamping and measuring kit (exploration only; nothing
 * here is wired into the game).
 *
 * A design is hand-authored PIXEL MAPS: string rows, one letter a pixel, keyed
 * to a palette of the old-CC0 Tiny Swords inks. The only mechanical step is the
 * outline stamp a pixel artist does with Aseprite's Outline: each part, back to
 * front, gets the pack's navy ink ring (2 px on straights, 3 on the diagonals:
 * the octagon r² ≤ 5) over whatever sits behind it, then its own pixels. Ink a
 * part needs inside itself (a fold, a strand gap, a parting) is placed by hand
 * as `k` in its rows.
 *
 * Motion is the pack's: the idle squashes the head mass (a hand-picked row of
 * it is dropped, so the top sinks while the flare stays put) and bobs the
 * hands; tics swap in hand-drawn alternate rows for a part.
 */

export const INK = '#161c2e'
/** The pack's ground shadow: the ink at alpha 80 (measured off the CC0 stills). */
export const SHADOW_ALPHA = 80

export type Group = 'back' | 'body' | 'head' | 'hands' | 'prop' | 'feet' | 'fx'

export interface Part {
  id: string
  group: Group
  x: number
  y: number
  rows: readonly string[]
  /** Ink ring in px: 2 (default, the pack's line), 1 (a thin inner part), 0 (none: ink drawn by hand, light). */
  ring?: 0 | 1 | 2
  hidden?: boolean
  /** Rows of this part (top-down indices) that a squash may drop, in order. */
  squash?: readonly number[]
}

export interface Frame {
  /** Whole-group moves [dx, dy]. */
  move?: Partial<Record<Group, readonly [number, number]>>
  /** One part moved on top of its group. */
  nudge?: Readonly<Record<string, readonly [number, number]>>
  /** Rows dropped from every part that lists `squash` (the head mass sinks). */
  squash?: number
  show?: readonly string[]
  hide?: readonly string[]
  /** Hand-drawn alternate rows for a part this frame. */
  swap?: Readonly<Record<string, readonly string[]>>
  /** Where a swapped part sits instead (absolute). */
  at?: Readonly<Record<string, readonly [number, number]>>
}

export interface Design {
  id: string
  title: string
  concept: string
  /** letter → #rrggbb ('k' is always the ink, 's' the shadow, '.' clear). */
  pal: Readonly<Record<string, string>>
  parts: readonly Part[]
  /** Canvas row (exclusive) where the head mass (hair / hat / hood / load) ends, in the still. */
  headBottom: number
  idle: readonly Frame[]
  idleMs: readonly number[]
  tic: readonly Frame[]
  ticMs: readonly number[]
}

export const W = 100
export const H = 100

export interface Rgba {
  w: number
  h: number
  data: Uint8ClampedArray
}

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]

/** The octagon a 2 px ring dilates by (2 on straights, 3 deep on the diagonals). */
const RING2: [number, number][] = []
for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && dx * dx + dy * dy <= 5) RING2.push([dx, dy])
const RING1: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]

/** Drop the given rows of a part (a squash). */
function dropRows(rows: readonly string[], drop: readonly number[]): string[] {
  const s = new Set(drop)
  return rows.filter((_, i) => !s.has(i))
}

/** Compose one frame. */
export function render(d: Design, f: Frame = {}): Rgba {
  const data = new Uint8ClampedArray(W * H * 4)
  const put = (x: number, y: number, hex: string, a = 255) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const [r, g, b] = rgb(hex)
    const i = (y * W + x) * 4
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = a
  }
  const shown = (p: Part) => (p.hidden ? f.show?.includes(p.id) : !f.hide?.includes(p.id))
  for (const p of d.parts) {
    if (!shown(p)) continue
    let rows = f.swap?.[p.id] ?? p.rows
    const mv = f.move?.[p.group] ?? [0, 0]
    const nd = f.nudge?.[p.id] ?? [0, 0]
    let [x, y] = f.at?.[p.id] ?? [p.x, p.y]
    if (p.squash && f.squash && !f.swap?.[p.id]) {
      const n = Math.min(f.squash, p.squash.length)
      rows = dropRows(rows, p.squash.slice(0, n))
      y += n
    }
    x += mv[0] + nd[0]
    y += mv[1] + nd[1]
    if (p.id === 'shadow') {
      rows.forEach((row, r) => [...row].forEach((ch, c) => ch !== '.' && put(x + c, y + r, INK, SHADOW_ALPHA)))
      continue
    }
    const solid = (c: number, r: number) => r >= 0 && r < rows.length && c >= 0 && c < rows[r].length && rows[r][c] !== '.'
    const ring = p.ring ?? 2
    if (ring) {
      const off = ring === 2 ? RING2 : RING1
      const maxW = Math.max(...rows.map((r) => r.length))
      for (let r = -2; r < rows.length + 2; r++)
        for (let c = -2; c < maxW + 2; c++) {
          if (solid(c, r)) continue
          if (off.some(([dx, dy]) => solid(c + dx, r + dy))) put(x + c, y + r, INK)
        }
    }
    rows.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch === '.') return
        const hex = ch === 'k' ? INK : d.pal[ch]
        if (!hex) throw new Error(`${d.id}/${p.id}: no ink for '${ch}' (row ${r})`)
        put(x + c, y + r, hex)
      }),
    )
  }
  return { w: W, h: H, data }
}

/** Every frame of the idle, then the tic. */
export function idleFrames(d: Design): Rgba[] {
  return d.idle.map((f) => render(d, f))
}
export function ticFrames(d: Design): Rgba[] {
  return d.tic.map((f) => render(d, f))
}

// ── the pack's bands (skill § 4a; the measure of `render/hero/packBands.ts`, kept here so this script touches no src/) ──

export interface Measure {
  box: { x: number; y: number; w: number; h: number }
  fill: number
  aspect: number
  topMass: number
  legShare: number
  headShare: number
  outline: string
  inkedEdge: number
  outlinePx: number
  colours: number
}

export const BANDS = {
  height: [50, 92],
  aspect: [0.7, 1.45],
  fill: [0.5, 0.78],
  headShare: [0.55, 0.75],
  topMass: [0.32, 0.52],
  legShare: [0, 0.16],
  inkedEdge: [0.8, 1],
  outlinePx: [2.2, 2.8],
  colours: [6, 16],
} as const

export function measure(img: { w: number; h: number; data: ArrayLike<number> }, headBottom: number): Measure {
  const { w, h, data } = img
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] >= 200
  let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (solid(x, y)) {
        n++
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
      }
  const bw = x1 - x0 + 1
  const bh = y1 - y0 + 1
  const rowsN: number[] = []
  let top = 0
  const mid = y0 + bh / 2
  for (let y = y0; y <= y1; y++) {
    let c = 0
    for (let x = x0; x <= x1; x++) if (solid(x, y)) c++
    rowsN.push(c)
    if (y + 0.5 < mid) top += c
  }
  const widest = Math.max(...rowsN)
  let legs = 0
  for (let i = rowsN.length - 1; i >= 0 && rowsN[i] < widest * 0.45; i--) legs++
  const ink = rgb(INK)
  const isInk = (x: number, y: number) => {
    const i = (y * w + x) * 4
    return Math.hypot(data[i] - ink[0], data[i + 1] - ink[1], data[i + 2] - ink[2]) <= 40
  }
  const count = new Map<number, number>()
  const edgeCount = new Map<number, number>()
  let edge = 0, inked = 0
  const inner = (x: number, y: number) => solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1)
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!solid(x, y)) continue
      const i = (y * w + x) * 4
      const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
      count.set(key, (count.get(key) ?? 0) + 1)
      if (inner(x, y)) continue
      edge++
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1)
      if (isInk(x, y)) inked++
    }
  let ok = 0, best = -1
  for (const [k, c] of edgeCount) if (c > best) [best, ok] = [c, k]
  const depth = new Int8Array(w * h)
  let ring: number[] = []
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (solid(x, y) && !inner(x, y)) {
        depth[y * w + x] = 1
        ring.push(y * w + x)
      }
  let outlinePx = 1
  for (let layer = 2; layer <= 3; layer++) {
    const next: number[] = []
    for (const i of ring) {
      const x = i % w, y = (i / w) | 0
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        const j = ny * w + nx
        if (solid(nx, ny) && depth[j] === 0) {
          depth[j] = layer
          next.push(j)
        }
      }
    }
    if (!next.length) break
    let k = 0
    for (const i of next) if (isInk(i % w, (i / w) | 0)) k++
    outlinePx += k / next.length
    ring = next
  }
  let colours = 0
  for (const c of count.values()) if (c >= n * 0.01) colours++
  const hex = (v: number) => '#' + v.toString(16).padStart(6, '0')
  return {
    box: { x: x0, y: y0, w: bw, h: bh },
    fill: n / (bw * bh),
    aspect: bw / bh,
    topMass: top / n,
    legShare: legs / bh,
    headShare: Math.max(0, headBottom - y0) / bh,
    outline: hex(ok),
    inkedEdge: edge ? inked / edge : 0,
    outlinePx,
    colours,
  }
}

export function misses(m: Measure): string[] {
  const v: Record<keyof typeof BANDS, number> = {
    height: m.box.h,
    aspect: m.aspect,
    fill: m.fill,
    headShare: m.headShare,
    topMass: m.topMass,
    legShare: m.legShare,
    inkedEdge: m.inkedEdge,
    outlinePx: m.outlinePx,
    colours: m.colours,
  }
  const out: string[] = []
  for (const k of Object.keys(BANDS) as (keyof typeof BANDS)[]) {
    const [lo, hi] = BANDS[k]
    if (v[k] < lo - 1e-9 || v[k] > hi + 1e-9) out.push(`${k} ${v[k].toFixed(2)} ∉ [${lo}, ${hi}]`)
  }
  if (m.outline !== INK) out.push(`outline ${m.outline}`)
  return out
}

/** Pixels with no 8-neighbour of the same colour that are not ink: the stray-pixel audit (light dashes excepted by letter). */
export function orphans(img: Rgba, allow: readonly string[] = []): number {
  const { w, h, data } = img
  const key = (x: number, y: number) => {
    const i = (y * w + x) * 4
    return data[i + 3] < 200 ? -1 : (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
  }
  const allowK = new Set(allow.map((hx) => parseInt(hx.slice(1), 16)))
  let n = 0
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const k = key(x, y)
      if (k < 0 || allowK.has(k)) continue
      let same = false
      for (let dy = -1; dy <= 1 && !same; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && key(x + dx, y + dy) === k) { same = true; break }
      if (!same) n++
    }
  return n
}
