/**
 * The pack's figure bands — what a person drawn beside the CC0 Tiny Swords
 * people must measure to sit among them (Oct 2026; the designer, of slim
 * anatomical 42–57 px figures: "they don't fit in at all with the other
 * assets"). The pack's people are not anatomy: squat, round, blobby masses
 * whose head (hair, helmet, hood) is about half the figure, no neck, a
 * rounded body, nub feet, stub arms; one thick navy outline; three tones a
 * material lit from the upper left plus a white dash.
 *
 * {@link measureFigure} measures one still (an RGBA buffer); {@link checkBands}
 * says which measurements fall outside {@link PACK_BANDS}. The bands are the
 * pack's own range (pawn, knight, archer, torch / TNT / barrel goblins,
 * measured by `npx tsx scripts/pack-bands.ts`) widened a little — a figure
 * outside them reads as from another game. `tests/packBands.test.ts` keeps
 * the pack inside them and a slim anatomical figure out.
 *
 * Pure: no DOM.
 */
import { INK } from './palette'

export interface Rgba {
  w: number
  h: number
  /** RGBA, row-major, `w * h * 4`. */
  data: ArrayLike<number>
}

export interface FigureMeasure {
  /** The figure's box (opaque pixels only: the ground shadow is alpha 80). */
  box: { x: number; y: number; w: number; h: number }
  /** Opaque pixels / box area: how solid the mass is (blobs fill, stick figures don't). */
  fill: number
  /** box width / box height: squat is near 1. */
  aspect: number
  /** Share of the opaque pixels in the box's upper half: a big head puts the mass high. */
  topMass: number
  /** Height share of the bottom run of rows narrower than 45% of the widest row: nub feet are short. */
  legShare: number
  /** Height share of the head (hair, helmet, hood) — only when its bottom row is given. */
  headShare?: number
  /** The most common colour on the silhouette's edge, as #rrggbb. */
  outline: string
  /** Distance (RGB) of {@link outline} from the pack's ink. */
  outlineDist: number
  /** Share of edge pixels in the ink (within 40 of it). */
  inkedEdge: number
  /** How deep the ink runs in from the edge, px (1 + the ink share of the next two layers in). */
  outlinePx: number
  /** Colours covering at least 1% of the figure (the ink included). */
  colours: number
}

export interface Band {
  min: number
  max: number
}
export type BandKey = 'fill' | 'aspect' | 'topMass' | 'legShare' | 'headShare' | 'outlineDist' | 'inkedEdge' | 'outlinePx' | 'colours' | 'height'

/**
 * The pack's bands. Measured (the stills shipped in `sprites/tinyswords/`;
 * `scripts/pack-bands.ts` prints the table):
 *
 * | figure | box (opaque) | fill | aspect | topMass | legShare | head | outline | colours ≥1% |
 * |---|---|---|---|---|---|---|---|---|
 * | Pawn | 58 × 53 | .65 | 1.09 | .47 | .13 | .68 | #161c2e, 2.67 px | 7 |
 * | Knight | 78 × 86 | .56 | .91 | .37 | .08 | .74 | #161c2e, 2.54 px | 9 |
 * | Archer | 62 × 73 | .66 | .85 | .42 | .10 | .62 | #161c2e, 2.53 px | 8 |
 * | Torch goblin | 74 × 74 | .55 | 1.00 | .46 | .08 | .64 | #161c2e, 2.23 px | 13 |
 * | TNT goblin | 86 × 61 | .62 | 1.41 | .45 | .11 | .67 | #161c2e, 2.42 px | 13 |
 * | Barrel goblin | 50 × 67 | .72 | .75 | .36 | .00 | (a keg) | #161c2e, 2.56 px | 8 |
 *
 * The line is 2 px on straights and 3 on curves (2.2–2.7 deep on average):
 * one even 2 px ring reads thinner than the pack. The mass sits LOW in the box (topMass under half): the head flares widest
 * at its bottom edge, over a short body — not a ball on a stick. Card:
 * `docs/characters/cards/pack-direction/measure.png`.
 *
 * `height` is for people at field / post size (the 192-px cell, 1:1), not
 * the 24 × 28 dock faces.
 */
export const PACK_BANDS: Readonly<Record<BandKey, Band>> = {
  height: { min: 50, max: 92 },
  fill: { min: 0.5, max: 0.78 },
  aspect: { min: 0.7, max: 1.45 },
  topMass: { min: 0.32, max: 0.52 },
  legShare: { min: 0, max: 0.16 },
  headShare: { min: 0.55, max: 0.75 },
  outlineDist: { min: 0, max: 12 },
  inkedEdge: { min: 0.8, max: 1 },
  outlinePx: { min: 2.2, max: 2.8 },
  colours: { min: 6, max: 16 },
}

const OPAQUE = 200
const INK_NEAR = 40

const hex = (r: number, g: number, b: number): string => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
const inkRgb = [1, 3, 5].map((i) => parseInt(INK.slice(i, i + 2), 16))
const dist = (r: number, g: number, b: number, c: readonly number[]): number => Math.hypot(r - c[0], g - c[1], b - c[2])

/** Measure one still. `headBottom` (image row, exclusive) names where the head mass ends. */
export function measureFigure(img: Rgba, opts: { headBottom?: number } = {}): FigureMeasure {
  const { w, h, data } = img
  const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] >= OPAQUE
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  let n = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (solid(x, y)) {
        n++
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (n === 0) throw new Error('measureFigure: no opaque pixels')
  const bw = x1 - x0 + 1
  const bh = y1 - y0 + 1

  // Mass high or low; the bottom run of narrow rows (the legs).
  const rows: number[] = []
  let top = 0
  const mid = y0 + bh / 2
  for (let y = y0; y <= y1; y++) {
    let c = 0
    for (let x = x0; x <= x1; x++) if (solid(x, y)) c++
    rows.push(c)
    if (y + 0.5 < mid) top += c
  }
  const widest = Math.max(...rows)
  let legs = 0
  for (let i = rows.length - 1; i >= 0 && rows[i] < widest * 0.45; i--) legs++

  // The edge: its colour, how much of it is ink, and how deep the ink runs.
  const count = new Map<number, number>()
  const edgeCount = new Map<number, number>()
  let edge = 0
  let inked = 0
  const isInk = (x: number, y: number): boolean => {
    const i = (y * w + x) * 4
    return dist(data[i], data[i + 1], data[i + 2], inkRgb) <= INK_NEAR
  }
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!solid(x, y)) continue
      const i = (y * w + x) * 4
      const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
      count.set(key, (count.get(key) ?? 0) + 1)
      if (solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1)) continue
      edge++
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1)
      if (isInk(x, y)) inked++
    }
  let outlineKey = 0
  let best = -1
  for (const [k, c] of edgeCount) if (c > best) [best, outlineKey] = [c, k]
  const oR = outlineKey >> 16
  const oG = (outlineKey >> 8) & 255
  const oB = outlineKey & 255

  // How deep the ink runs: peel the silhouette a layer at a time (4-neighbour
  // erosion) and see how much of layers 2 and 3 is still ink. A clean 2 px
  // line scores 2.0; the pack's line, 2 px with 3 on its curves, ~2.3.
  const depth = new Int8Array(w * h)
  let ring: number[] = []
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (solid(x, y) && !(solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1))) {
        depth[y * w + x] = 1
        ring.push(y * w + x)
      }
  let outlinePx = ring.length ? 1 : 0
  for (let layer = 2; layer <= 3; layer++) {
    const next: number[] = []
    for (const i of ring) {
      const x = i % w
      const y = (i / w) | 0
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
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

  const m: FigureMeasure = {
    box: { x: x0, y: y0, w: bw, h: bh },
    fill: n / (bw * bh),
    aspect: bw / bh,
    topMass: top / n,
    legShare: legs / bh,
    outline: hex(oR, oG, oB),
    outlineDist: dist(oR, oG, oB, inkRgb),
    inkedEdge: edge ? inked / edge : 0,
    outlinePx,
    colours,
  }
  if (opts.headBottom !== undefined) m.headShare = Math.max(0, opts.headBottom - y0) / bh
  return m
}

export interface BandMiss {
  key: BandKey
  value: number
  band: Band
}

/** Every measurement outside its band (empty: the figure sits in the pack). */
export function checkBands(m: FigureMeasure, bands: Readonly<Record<BandKey, Band>> = PACK_BANDS, opts: { height?: boolean } = {}): BandMiss[] {
  const out: BandMiss[] = []
  const values: Partial<Record<BandKey, number>> = {
    fill: m.fill,
    aspect: m.aspect,
    topMass: m.topMass,
    legShare: m.legShare,
    headShare: m.headShare,
    outlineDist: m.outlineDist,
    inkedEdge: m.inkedEdge,
    outlinePx: m.outlinePx,
    colours: m.colours,
  }
  if (opts.height !== false) values.height = m.box.h
  for (const key of Object.keys(bands) as BandKey[]) {
    const v = values[key]
    if (v === undefined) continue
    const b = bands[key]
    if (v < b.min - 1e-9 || v > b.max + 1e-9) out.push({ key, value: v, band: b })
  }
  return out
}
