/**
 * ---------------------------------------------------------------------------
 * The company worlds' pixel art (Oct 2026)
 * ---------------------------------------------------------------------------
 *
 * The designer, on the first themes: "i want the theming to be more. like if
 * one is fire themed it should have fire effects … this is just ez boring
 * crap". So each company theme is a WORLD, drawn in the game's pixel
 * language — crisp pixels, a small palette, nothing smooth:
 *
 *   - Peppercorn Co. — FIRE: scorched, ember-lit edges; flames on its CTA.
 *   - Easel House — PAINT: brush-stroke edges in three paints, a drip; wet
 *     paint dabs on its CTA.
 *   - Ironvein — FORGE: riveted iron plate with a molten seam that glows.
 *   - Rosethread — SILK: satin edge, an embroidered running stitch, a sheen
 *     that travels the thread; a waving ribbon on its CTA.
 *   - Moonquill — ARCANE NIGHT: an ink edge, a silver line, runes at the
 *     corners that pulse with light; a row of glowing runes on its CTA.
 *
 * Everything here is PIXEL ROWS (one character a pixel, `.` clear) and a
 * palette: the frames (a 9-slice for `border-image`, a few animation frames
 * each), the CTA's top strip (a sprite sheet of frames), and the rune glyphs
 * the ambient layer drifts. `themeArtDom.ts` rasterises them once into CSS
 * variables; nothing is a file and nothing is third-party (procedural, our own).
 *
 * Pure: no DOM. Deterministic: a hash, never `Math.random`.
 */
import type { CompanyId } from '../../game/data/companies'

export type Rows = readonly string[]
export type Palette = Readonly<Record<string, string>>

/** A frame's slice: its edge is `FRAME_T` source pixels thick (drawn at 2×: 6 CSS px). */
export const FRAME_T = 3
/** One edge tile's length between the corners, in source pixels. */
export const FRAME_SPAN = 16
/** The frame image's side: two corners and one edge tile. */
export const FRAME_SIZE = FRAME_T * 2 + FRAME_SPAN

/** The CTA strip: one tile's size, in source pixels (drawn at 2×). */
export const STRIP_W = 16
export const STRIP_H = 6

/** A small integer hash: the same inputs, the same irregularity, every build. */
export function hash(...n: number[]): number {
  let h = 2166136261
  for (const v of n) {
    h ^= v | 0
    h = Math.imul(h, 16777619)
    h ^= h >>> 13
  }
  return (h >>> 0) / 4294967296
}

type Grid = string[][]
const grid = (w: number, h: number): Grid => Array.from({ length: h }, () => Array.from({ length: w }, () => '.'))
const rows = (g: Grid): Rows => g.map((r) => r.join(''))

/**
 * Walk a frame's ring: for every pixel within `FRAME_T` of an edge, its depth
 * into the frame (0 = the outer edge) and the position along that edge.
 */
function ring(fn: (x: number, y: number, depth: number, along: number, side: 'top' | 'right' | 'bottom' | 'left') => string | null): Rows {
  const n = FRAME_SIZE
  const g = grid(n, n)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.min(x, y, n - 1 - x, n - 1 - y)
      if (d >= FRAME_T) continue
      const side = d === y ? 'top' : d === n - 1 - y ? 'bottom' : d === x ? 'left' : 'right'
      const along = side === 'top' || side === 'bottom' ? x : y
      const c = fn(x, y, d, along, side)
      if (c) g[y][x] = c
    }
  }
  return rows(g)
}

/** Is (x, y) in one of the frame's four corner squares? */
const inCorner = (x: number, y: number) => (x < FRAME_T || x >= FRAME_SIZE - FRAME_T) && (y < FRAME_T || y >= FRAME_SIZE - FRAME_T)

/** The world of each company: its frame, CTA strip and effect palette. */
export interface WorldArt {
  /** The frame's 9-slice, one image per animation frame (a flipbook). */
  frames: Rows[]
  /** The CTA strip's frames (each `STRIP_W` × `STRIP_H`), stacked into one sheet. */
  strip: Rows[]
  palette: Palette
  /** How long one full flipbook of the frame takes, in ms. */
  frameMs: number
  /** How long one full loop of the CTA strip takes, in ms. */
  stripMs: number
}

// ---------------------------------------------------------------------------
// FIRE — Peppercorn Co.
// ---------------------------------------------------------------------------
const FIRE: Palette = { k: '#1a0f07', c: '#3a2010', r: '#b8321e', o: '#ff8a2c', y: '#ffd35e', w: '#fff3c0' }
function fireFrame(f: number): Rows {
  return ring((x, y, d, along, side) => {
    const s = side.length
    if (d === 0) {
      // Charred lip, burnt through in places.
      return hash(along, s, 7) < 0.16 && !inCorner(x, y) ? null : 'k'
    }
    if (d === 1) {
      // The ember line: orange, some coals hot, and which flicker frame to frame.
      const h = hash(along, s, f, 3)
      return h < 0.18 ? 'y' : h < 0.24 ? 'w' : h < 0.7 ? 'o' : 'r'
    }
    // Scorch creeping inward.
    return hash(along, s, 11) < 0.45 ? 'c' : null
  })
}
function fireStrip(f: number): Rows {
  const g = grid(STRIP_W, STRIP_H)
  for (let x = 0; x < STRIP_W; x++) {
    // A tongue per column, its height flickering with the frame.
    const base = 1 + Math.round(2.4 * (0.5 + 0.5 * Math.sin((x / STRIP_W) * Math.PI * 4 + f * 1.7)))
    const h = Math.min(STRIP_H, base + (hash(x, f, 5) < 0.3 ? 1 : 0))
    for (let i = 0; i < h; i++) {
      const y = STRIP_H - 1 - i
      g[y][x] = i === h - 1 ? (h > 3 ? 'y' : 'o') : i < 1 ? 'r' : i < 3 ? 'o' : 'y'
    }
    if (h < STRIP_H - 1 && hash(x, f, 9) < 0.12) g[STRIP_H - 1 - h - 1][x] = 'y' // a spark above
  }
  return rows(g)
}

// ---------------------------------------------------------------------------
// PAINT — Easel House
// ---------------------------------------------------------------------------
const PAINT: Palette = { p: '#c6a4ff', q: '#9b74e8', o: '#e2aa5a', t: '#5fb0a8', s: '#e58fb0', w: '#f6efff', d: '#2a1d3c' }
function paintFrame(f: number): Rows {
  return ring((_x, _y, d, along, side) => {
    const s = side.length
    // A brush stroke whose thickness wanders (1–3 px) along each edge.
    const thick = 1 + Math.round(2 * (0.5 + 0.5 * Math.sin(along * 0.7 + s * 1.3)))
    if (d >= thick) {
      // A drip on the bottom edge, and a dab of another paint now and then.
      if (side === 'bottom' && hash(along, 13) < 0.12) return 'q'
      return null
    }
    const band = Math.floor(along / 6 + s) % 3
    if (d === 0) return band === 0 ? 'q' : 'p'
    // A wet glint that travels the stroke frame to frame.
    if (d === 1 && (along + f * 5) % 16 === 3) return 'w'
    return band === 1 ? 'o' : band === 2 ? 't' : 'p'
  })
}
function paintStrip(f: number): Rows {
  const g = grid(STRIP_W, STRIP_H)
  const paints = ['p', 'o', 't', 's']
  for (let x = 0; x < STRIP_W; x++) {
    // The bristles' ragged top edge, wet paint on the button's lip.
    const h = 2 + (hash(x, 3) < 0.4 ? 1 : 0)
    for (let i = 0; i < h; i++) g[STRIP_H - 1 - i][x] = i === h - 1 && hash(x, 8) < 0.5 ? 'q' : 'p'
  }
  // Two flecks of other paint that hop above it.
  for (let k = 0; k < 2; k++) {
    const x = Math.floor(hash(k, f, 21) * STRIP_W)
    const y = Math.floor(hash(k, f, 22) * 3)
    g[y][x] = paints[(k + f) % paints.length]
  }
  return rows(g)
}

// ---------------------------------------------------------------------------
// FORGE — Ironvein
// ---------------------------------------------------------------------------
const FORGE: Palette = { k: '#0d1219', i: '#3b4656', l: '#7d8ca0', d: '#242c38', r: '#b9c6d6', m: '#c8541c', M: '#ff9a3a', H: '#ffe08a' }
function forgeFrame(f: number): Rows {
  return ring((x, y, d, along, side) => {
    if (d === 0) return 'k'
    // Rivets: at each corner and every eight pixels along an edge.
    const rivet = inCorner(x, y) ? d === 1 && (x === 1 || x === FRAME_SIZE - 2) && (y === 1 || y === FRAME_SIZE - 2) : d === 1 && along % 8 === 3
    if (rivet) return 'r'
    if (d === 1) return side === 'top' || side === 'left' ? 'l' : 'd'
    // The molten seam: it breathes — dim, lit, white-hot — along its length.
    const phase = (along + f * 4) % 12
    return phase < 2 ? 'H' : phase < 6 ? 'M' : 'm'
  })
}
function forgeStrip(f: number): Rows {
  const g = grid(STRIP_W, STRIP_H)
  for (let x = 0; x < STRIP_W; x++) g[STRIP_H - 1][x] = (x + f * 3) % 8 < 3 ? 'M' : 'm'
  // Sparks thrown up off the plate, in arcs that move frame to frame.
  for (let k = 0; k < 3; k++) {
    const x0 = Math.floor(hash(k, 31) * STRIP_W)
    const t = (f + k) % 4
    const x = (x0 + t * (k % 2 ? 1 : -1) + STRIP_W) % STRIP_W
    const y = STRIP_H - 2 - [0, 2, 3, 2][t]
    if (y >= 0) g[y][x] = t === 0 ? 'H' : t === 3 ? 'm' : 'M'
  }
  return rows(g)
}

// ---------------------------------------------------------------------------
// SILK — Rosethread
// ---------------------------------------------------------------------------
const SILK: Palette = { k: '#3a1626', s: '#7a2f4a', t: '#f6d2de', w: '#ffffff', r: '#e9a8bf', n: '#c4627f' }
function silkFrame(f: number): Rows {
  return ring((x, y, d, along) => {
    if (d === 0) return 's'
    if (d === 1) {
      // The sheen: a white glint sliding along the satin.
      const p = (along + f * 6) % 22
      return p === 0 ? 'w' : p < 3 ? 'r' : null
    }
    // A running stitch, two on, two off; a knot at each corner.
    if (inCorner(x, y)) return x === FRAME_T - 1 || x === FRAME_SIZE - FRAME_T ? 'n' : null
    return along % 4 < 2 ? 't' : null
  })
}
function silkStrip(f: number): Rows {
  const g = grid(STRIP_W, STRIP_H)
  for (let x = 0; x < STRIP_W; x++) {
    // A ribbon that waves across the button's lip.
    const y = Math.round(2 + 1.6 * Math.sin(((x + f * 4) / STRIP_W) * Math.PI * 2))
    g[y][x] = 'r'
    if (y + 1 < STRIP_H) g[y + 1][x] = 'n'
    if ((x + f * 4) % STRIP_W === 5) g[Math.max(0, y - 1)][x] = 'w'
  }
  return rows(g)
}

// ---------------------------------------------------------------------------
// ARCANE NIGHT — Moonquill
// ---------------------------------------------------------------------------
const ARCANE: Palette = { k: '#0b0d22', s: '#d4daf2', g: '#8fa4ff', G: '#c9d4ff', w: '#ffffff', i: '#3b3f8a' }
/** Five little runes, 3 × 3, for the frame's corners and the CTA strip. */
const RUNES_3: Rows[] = [
  ['s.s', '.s.', 's.s'],
  ['ss.', '.s.', '.ss'],
  ['.s.', 'sss', '.s.'],
  ['s..', 'ss.', 's.s'],
  ['sss', 's..', '.s.'],
]
function arcaneFrame(f: number): Rows {
  const lit = f % 2 === 1
  const g = ring((_x, _y, d) => {
    if (d === 0) return 'k'
    if (d === 1) return 's'
    return lit ? 'g' : 'i'
  }).map((r) => r.split(''))
  // A rune glowing at each corner (it brightens on the lit frame).
  const corners = [
    [0, 0],
    [FRAME_SIZE - 3, 0],
    [0, FRAME_SIZE - 3],
    [FRAME_SIZE - 3, FRAME_SIZE - 3],
  ]
  corners.forEach(([cx, cy], i) => {
    const rune = RUNES_3[i]
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) g[cy + y][cx + x] = rune[y][x] === 's' ? (lit ? 'w' : 'G') : 'k'
  })
  return g.map((r) => r.join(''))
}
function arcaneStrip(f: number): Rows {
  const g = grid(STRIP_W, STRIP_H)
  // Three runes in a row, one glowing at a time, passing the light along.
  for (let k = 0; k < 3; k++) {
    const rune = RUNES_3[(k + 2) % RUNES_3.length]
    const on = f % 3 === k
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (rune[y][x] === 's') g[2 + y][1 + k * 5 + x] = on ? 'w' : 'g'
    if (on) g[1][2 + k * 5] = 'G'
  }
  return rows(g)
}

const STRIP_FRAMES = 4

const WORLDS: Record<CompanyId, WorldArt> = {
  spice: { frames: [0, 1, 2].map(fireFrame), strip: Array.from({ length: STRIP_FRAMES }, (_, f) => fireStrip(f)), palette: FIRE, frameMs: 600, stripMs: 480 },
  art: { frames: [0, 1, 2].map(paintFrame), strip: Array.from({ length: STRIP_FRAMES }, (_, f) => paintStrip(f)), palette: PAINT, frameMs: 1800, stripMs: 1600 },
  metals: { frames: [0, 1, 2].map(forgeFrame), strip: Array.from({ length: STRIP_FRAMES }, (_, f) => forgeStrip(f)), palette: FORGE, frameMs: 1500, stripMs: 560 },
  silk: { frames: [0, 1, 2].map(silkFrame), strip: Array.from({ length: STRIP_FRAMES }, (_, f) => silkStrip(f)), palette: SILK, frameMs: 1800, stripMs: 1200 },
  scrolls: { frames: [0, 1].map(arcaneFrame), strip: Array.from({ length: 3 }, (_, f) => arcaneStrip(f)), palette: ARCANE, frameMs: 2400, stripMs: 1500 },
}

/** A company's world art. */
export const worldArt = (c: CompanyId): WorldArt => WORLDS[c]

/**
 * The runes Moonquill's night drifts (5 × 5), and its stars' twinkle steps.
 * The ambient layer draws them pixel by pixel.
 */
export const RUNES_5: Rows[] = [
  ['..s..', '.s.s.', 's...s', '.s.s.', '..s..'],
  ['s...s', '.s.s.', '..s..', '..s..', '..s..'],
  ['sssss', '..s..', '.s.s.', 's...s', '.....'],
  ['s.s.s', 's.s.s', 'sssss', '..s..', '..s..'],
  ['.sss.', 's....', '.sss.', '....s', '.sss.'],
  ['s...s', 'ss.ss', 's.s.s', 's...s', 's...s'],
]
