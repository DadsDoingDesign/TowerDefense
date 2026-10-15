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
 *   - Peppercorn Co. — FIRE: a charred, burnt-through edge split by ember
 *     cracks that flicker, a live coal at each corner; flames on its CTA and
 *     flame tongues licking up from the card's top edge (its crest).
 *   - Easel House — PAINT: a scalloped brush stroke in three paints with a
 *     wet lip and a drip, a paint blob at each corner; wet paint on its CTA.
 *   - Ironvein — FORGE: riveted iron plates (a joint and a rivet every eight
 *     pixels), a bolt at each corner, a molten seam on the inside that glows.
 *   - Rosethread — SILK: satin with a sheen sliding along it, an embroidered
 *     running stitch, a rose worked at each corner; a ribbon on its CTA.
 *   - Moonquill — ARCANE NIGHT: a silver line over a band of runes that pass
 *     their light along, a star at each corner; glowing runes on its CTA.
 *
 * The frames are 4 px thick (8 CSS px) and each has its own corner piece and
 * its own SHAPE — ragged, scalloped, riveted, stitched, inscribed — so a
 * glance tells them apart even in greyscale.
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

/** A frame's slice: its edge is `FRAME_T` source pixels thick (drawn at 2×: 8 CSS px). */
export const FRAME_T = 4
/** One edge tile's length between the corners, in source pixels. */
export const FRAME_SPAN = 16
/** The frame image's side: two corners and one edge tile. */
export const FRAME_SIZE = FRAME_T * 2 + FRAME_SPAN

/** The CTA strip: one tile's size, in source pixels (drawn at 2×). */
export const STRIP_W = 16
export const STRIP_H = 6

/** The card's crest (Peppercorn's flame tongues along its top): one tile, drawn at 2×. */
export const CREST_W = 16
export const CREST_H = 10

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

type Side = 'top' | 'right' | 'bottom' | 'left'
/** Which corner a corner pixel is in: 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right. */
type Corner = 0 | 1 | 2 | 3

/**
 * Draw a frame: `edge` for every pixel of the four edges (its depth into the
 * frame, 0 = the outer edge, and its position along that edge), `corner` for
 * the four corner squares, in the corner's own coordinates (0 = outermost on
 * each axis, mirrored, so one design serves all four corners).
 */
function frame(
  edge: (depth: number, along: number, side: Side) => string | null,
  corner: (cx: number, cy: number, which: Corner) => string | null,
): Rows {
  const n = FRAME_SIZE
  const g = grid(n, n)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const d = Math.min(x, y, n - 1 - x, n - 1 - y)
      if (d >= FRAME_T) continue
      const cxIn = x < FRAME_T || x >= n - FRAME_T
      const cyIn = y < FRAME_T || y >= n - FRAME_T
      let c: string | null
      if (cxIn && cyIn) {
        const which = ((y >= n - FRAME_T ? 2 : 0) + (x >= n - FRAME_T ? 1 : 0)) as Corner
        c = corner(Math.min(x, n - 1 - x), Math.min(y, n - 1 - y), which)
      } else {
        const side: Side = d === y ? 'top' : d === n - 1 - y ? 'bottom' : d === x ? 'left' : 'right'
        // Position along the edge, measured within the tiled span (0…FRAME_SPAN-1).
        const along = (side === 'top' || side === 'bottom' ? x : y) - FRAME_T
        c = edge(d, along, side)
      }
      if (c) g[y][x] = c
    }
  }
  return rows(g)
}

/** A 4 × 4 corner piece from rows (outermost pixel first on each axis). */
const piece = (art: Rows) => (cx: number, cy: number): string | null => {
  const ch = art[cy]?.[cx] ?? '.'
  return ch === '.' ? null : ch
}

/** The world of each company: its frame, CTA strip and effect palette. */
export interface WorldArt {
  /** The frame's 9-slice, one image per animation frame (a flipbook). */
  frames: Rows[]
  /** The CTA strip's frames (each `STRIP_W` × `STRIP_H`), stacked into one sheet. */
  strip: Rows[]
  /** The card's crest frames (each `CREST_W` × `CREST_H`), if the world has one. */
  crest?: Rows[]
  palette: Palette
  /** How long one full flipbook of the frame takes, in ms. */
  frameMs: number
  /** How long one full loop of the CTA strip takes, in ms. */
  stripMs: number
}

const sideN = (s: Side) => (s === 'top' ? 1 : s === 'right' ? 2 : s === 'bottom' ? 3 : 4)

// ---------------------------------------------------------------------------
// FIRE — Peppercorn Co.: charred, scorched edges split by glowing ember cracks
// ---------------------------------------------------------------------------
const FIRE: Palette = { k: '#140a05', c: '#3a2010', b: '#5e3016', r: '#b8321e', o: '#ff8a2c', y: '#ffd35e', w: '#fff3c0' }
function fireFrame(f: number): Rows {
  const hot = (h: number) => (h < 0.2 ? 'y' : h < 0.3 ? 'w' : h < 0.78 ? 'o' : 'r')
  return frame(
    (d, along, side) => {
      const s = sideN(side)
      // An ember crack zig-zags through the char, glowing and flickering.
      const crackAt = [1, 2, 3, 2][along % 4]
      if (d === crackAt && hash(Math.floor(along / 5), s, 2) < 0.7) return hot(hash(along, s, f, 3))
      if (d === 0) return hash(along, s, 7) < 0.22 ? null : 'k' // burnt through in places
      if (d === 1) return 'c'
      if (d === 2) return hash(along, s, 5) < 0.5 ? 'b' : 'c'
      // Scorch fading inward, dithered.
      return (along + s) & 1 ? 'c' : null
    },
    // A live coal in each corner.
    (cx, cy) => {
      if (cx === 0 || cy === 0) return 'k'
      if (cx === 2 && cy === 2) return f % 3 === 1 ? 'w' : 'y'
      if (cx + cy === 3 || (cx === 3 && cy === 2) || (cx === 2 && cy === 3)) return 'o'
      if (cx === 3 && cy === 3) return 'r'
      return 'c'
    },
  )
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
/**
 * Flame tongues licking up from the card's top edge: three to a tile, each a
 * pointed tongue that leans and flickers frame to frame — white-yellow at the
 * root, orange, red at the tip, a dark char rim so they read on any ground.
 */
function fireCrest(f: number): Rows {
  const g = grid(CREST_W, CREST_H)
  const tongues = [
    { x: 2, w: 5 },
    { x: 7, w: 4 },
    { x: 12, w: 5 },
  ]
  tongues.forEach((t, i) => {
    const h = 4 + Math.round(5 * hash(i, f, 4))
    const lean = Math.round((hash(i, f, 6) - 0.5) * 2)
    for (let r = 0; r < h; r++) {
      const k = r / h
      const half = Math.max(0, Math.round((t.w / 2) * (1 - k * k)))
      const cx = t.x + Math.round(lean * k * 2)
      for (let dx = -half; dx <= half; dx++) {
        const x = (cx + dx + CREST_W) % CREST_W
        const y = CREST_H - 1 - r
        const edge = Math.abs(dx) === half
        g[y][x] = edge && r > 1 ? 'r' : k < 0.25 ? 'w' : k < 0.5 ? 'y' : k < 0.8 ? 'o' : 'r'
      }
    }
    // A spark off the tip.
    if (hash(i, f, 11) < 0.5 && h + 2 < CREST_H) g[CREST_H - 2 - h][(t.x + 1) % CREST_W] = 'y'
  })
  return rows(g)
}

// ---------------------------------------------------------------------------
// PAINT — Easel House: a painted, scalloped edge in three paints
// ---------------------------------------------------------------------------
const PAINT: Palette = { p: '#c6a4ff', q: '#6c4bb0', o: '#e2aa5a', t: '#5fb0a8', s: '#e58fb0', w: '#f6efff', d: '#2a1d3c' }
function paintFrame(f: number): Rows {
  return frame(
    (d, along, side) => {
      const s = sideN(side)
      // Scallops: the stroke swells 2 → 4 px and back every eight pixels.
      const thick = 2 + Math.round(2 * Math.abs(Math.sin((along * Math.PI) / 8)))
      if (d >= thick) return side === 'bottom' && d === thick && hash(along, 13) < 0.25 ? 'q' : null // a drip
      if (d === thick - 1) return 'q' // the stroke's wet inner lip
      const band = (Math.floor(along / 8) + s) % 3
      // A wet glint that travels the stroke frame to frame.
      if (d === 1 && (along + f * 5) % 16 === 3) return 'w'
      return band === 0 ? 'p' : band === 1 ? 'o' : 't'
    },
    // A blob of paint in each corner, a different paint across the diagonal.
    (cx, cy, which) => piece(['.mm.', 'mmwm', 'mmmm', '.mm.'])(cx, cy)?.replace('m', which === 0 || which === 3 ? 'o' : 's') ?? null,
  )
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
// FORGE — Ironvein: riveted iron plates, a bolt at each corner, a molten seam
// ---------------------------------------------------------------------------
const FORGE: Palette = { k: '#0d1219', i: '#46536a', l: '#8796ab', d: '#2a3341', r: '#e2e9f2', R: '#9aa8ba', m: '#c8541c', M: '#ff9a3a', H: '#ffe08a' }
function forgeFrame(f: number): Rows {
  const seam = (along: number) => {
    const phase = (along + f * 4) % 12
    return phase < 2 ? 'H' : phase < 6 ? 'M' : 'm'
  }
  return frame(
    (d, along, side) => {
      if (d === 0) return 'k'
      // The molten seam: it breathes — dim, lit, white-hot — along its length.
      if (d === 3) return seam(along)
      // A solid bevelled iron band, a round rivet every eight pixels (lit
      // top-left, its shadow bottom-right).
      const a = along % 8
      if (a === 3 && d === 1) return 'r'
      if ((a === 4 && d === 1) || (a === 3 && d === 2)) return 'R'
      if (a === 4 && d === 2) return 'k'
      if (d === 1) return side === 'top' || side === 'left' ? 'l' : 'i'
      return side === 'top' || side === 'left' ? 'i' : 'd'
    },
    // A bolt head in each corner, the seam turning round it.
    (cx, cy) => {
      if (cx === 0 || cy === 0) return 'k'
      if (cx === 3 || cy === 3) return f % 3 === 0 ? 'H' : 'M'
      return cx === 1 && cy === 1 ? 'r' : cx === 2 && cy === 2 ? 'd' : 'R'
    },
  )
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
// SILK — Rosethread: satin with a sliding sheen, an embroidered running
// stitch, a rose worked in each corner
// ---------------------------------------------------------------------------
const SILK: Palette = { k: '#3a1626', s: '#7a2f4a', t: '#f6d2de', w: '#ffffff', r: '#e9a8bf', n: '#c4627f' }
function silkFrame(f: number): Rows {
  return frame(
    (d, along) => {
      if (d === 0) return 'k'
      if (d === 1) {
        // The satin, and its sheen: a white glint sliding along it.
        const p = (along + f * 6) % 16
        return p === 0 ? 'w' : p < 3 ? 'r' : 'n'
      }
      // The running stitch, two on, two off, on the satin's shade.
      if (d === 2) return along % 4 < 2 ? 't' : 's'
      return 's'
    },
    piece(['kkkk', 'knrn', 'krwr', 'knrs']),
  )
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
  // The stitch along the button's lip.
  for (let x = 0; x < STRIP_W; x++) if (x % 4 < 2) g[STRIP_H - 1][x] = 't'
  return rows(g)
}

// ---------------------------------------------------------------------------
// ARCANE NIGHT — Moonquill: a silver line over a band of runes that pass
// their light along, a star at each corner
// ---------------------------------------------------------------------------
const ARCANE: Palette = { k: '#0b0d22', s: '#d4daf2', g: '#8fa4ff', G: '#c9d4ff', w: '#ffffff', i: '#3b3f8a' }
/** Five little runes, 3 × 3, for the frame's band and the CTA strip. */
const RUNES_3: Rows[] = [
  ['s.s', '.s.', 's.s'],
  ['ss.', '.s.', '.ss'],
  ['.s.', 'sss', '.s.'],
  ['s..', 'ss.', 's.s'],
  ['sss', 's..', '.s.'],
]
function arcaneFrame(f: number): Rows {
  return frame(
    (d, along, side) => {
      if (d === 0) return 's'
      // Three runes a tile (at 1, 6 and 11), one lit at a time.
      for (let k = 0; k < 3; k++) {
        const x = along - (1 + k * 5)
        if (x < 0 || x > 2) continue
        const rune = RUNES_3[(k + sideN(side)) % RUNES_3.length]
        if (rune[d - 1][x] === 's') return f % 3 === k ? 'w' : 'g'
        return 'k'
      }
      return d === 2 && along % 5 === 0 ? 'i' : 'k'
    },
    (cx, cy) => {
      if (cx === 0 || cy === 0) return 's'
      if (cx === 2 && cy === 2) return f % 3 === 0 ? 'w' : 'G'
      return (cx === 2) !== (cy === 2) ? 'G' : 'k'
    },
  )
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
  spice: {
    frames: [0, 1, 2].map(fireFrame),
    strip: Array.from({ length: STRIP_FRAMES }, (_, f) => fireStrip(f)),
    crest: Array.from({ length: STRIP_FRAMES }, (_, f) => fireCrest(f)),
    palette: FIRE,
    frameMs: 600,
    stripMs: 480,
  },
  art: { frames: [0, 1, 2].map(paintFrame), strip: Array.from({ length: STRIP_FRAMES }, (_, f) => paintStrip(f)), palette: PAINT, frameMs: 1800, stripMs: 1600 },
  metals: { frames: [0, 1, 2].map(forgeFrame), strip: Array.from({ length: STRIP_FRAMES }, (_, f) => forgeStrip(f)), palette: FORGE, frameMs: 1500, stripMs: 560 },
  silk: { frames: [0, 1, 2].map(silkFrame), strip: Array.from({ length: STRIP_FRAMES }, (_, f) => silkStrip(f)), palette: SILK, frameMs: 1800, stripMs: 1200 },
  scrolls: { frames: [0, 1, 2].map(arcaneFrame), strip: Array.from({ length: 3 }, (_, f) => arcaneStrip(f)), palette: ARCANE, frameMs: 2400, stripMs: 1500 },
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
