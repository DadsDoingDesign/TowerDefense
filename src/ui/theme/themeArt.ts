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
 *   - Peppercorn Co. — FIRE: a charred line, burnt through in places, an
 *     ember crack a tile, a coal at each corner; low flames on its CTA and
 *     low flame tongues rising from the card's top edge (its crest).
 *   - Easel House — PAINT: a thin stroke in three paints swelling into small
 *     scallops, a drip now and then, a dab at each corner; paint on its CTA.
 *   - Ironvein — FORGE: an iron line jointed into plates, a rivet on each,
 *     one joint a tile lit by the forge, a bolt at each corner.
 *   - Rosethread — SILK: a satin line with a sheen pixel, an embroidered
 *     running stitch inside it, a rose bud at each corner; a ribbon on its CTA.
 *   - Moonquill — ARCANE NIGHT: a silver line, one faint rune a tile, a star
 *     at each corner; runes on its CTA.
 *
 * The frames' slice is 4 px (8 CSS px), but what is drawn in it is QUIET (the
 * frames pass, Oct 2026): one dim line and sparse detail, each world with its
 * own corner and its own SHAPE — ragged, scalloped, riveted, stitched,
 * inscribed — so a glance tells them apart even in greyscale.
 *
 * Everything here is PIXEL ROWS (one character a pixel, `.` clear) and a
 * palette: the frame (a 9-slice for `border-image`), the CTA's top strip, the
 * card's crest, and the rune glyphs
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


/**
 * The world of each company: its frame, CTA strip and effect palette — each
 * ONE still image (the calm pass, Oct 2026: they were flipbooks, flickering on
 * the card, the pick card and the CTA; the designer found the worlds "a bit
 * overwhelming"). The drawing functions take a variant `f`; the worlds wear
 * the first.
 */
export interface WorldArt {
  /** The frame's 9-slice. */
  frame: Rows
  /** The CTA strip (`STRIP_W` × `STRIP_H`), repeated along the button's top. */
  strip: Rows
  /** The card's crest (`CREST_W` × `CREST_H`), if the world has one. */
  crest?: Rows
  palette: Palette
}

const sideN = (s: Side) => (s === 'top' ? 1 : s === 'right' ? 2 : s === 'bottom' ? 3 : 4)

/**
 * The quiet corner every world turns: its line runs round the outside, the
 * very corner pixel clear (so the panel's rounded corner shows through, never
 * a square pixel tooth), and the world's own mark (`mark`) sits one pixel in.
 */
const quietCorner =
  (line: string, mark: (cx: number, cy: number) => string | null) =>
  (cx: number, cy: number): string | null => {
    if (cx === 0 && cy === 0) return null
    if (cx === 0 || cy === 0) return line
    return mark(cx, cy)
  }

// ---------------------------------------------------------------------------
// FIRE — Peppercorn Co.: a charred line, burnt through in places, a few
// embers glowing in its cracks
// ---------------------------------------------------------------------------
/*
 * The frames pass (Oct 2026; the designer: "the border on the ui can be too
 * intense, especially when it's doubled up at the bottom"): every world's
 * frame is one dominant line, one source pixel (2 CSS px), a shade or two off
 * its panel, with sparse 1 px detail inside it — the old solid 4 px bands of
 * char, paint, iron, satin and runes, with their white-hot embers, molten
 * seams and lit runes, were the loudest thing on the card. Each keeps its
 * shape at a glance: charred and embered, scalloped, riveted, stitched,
 * inscribed. The palettes are dim: the line under 0.42 luma, an accent pixel
 * under 0.6 (a label is over 0.8).
 */
const FIRE: Palette = {
  // The char line, and the darker scorch beside it.
  k: '#4a2c19',
  c: '#2c190e',
  // Embers, dim: a cooling red and an orange (only the crest burns brighter).
  e: '#8e3a1c',
  o: '#c2642a',
  // The crest's flame: root, body, tip.
  h: '#c88440',
  f: '#b0582a',
  t: '#7e3418',
}
function fireFrame(_f: number): Rows {
  return frame(
    (d, along, side) => {
      const s = sideN(side)
      // Burnt through once a tile: a two-pixel break, never beside the crack,
      // so every run of the line is long (no lone pixel between breaks).
      const at = 2 + Math.floor(hash(s, 41) * 5)
      const gap = (at + 8) % FRAME_SPAN
      if (d === 0) return along === gap || along === gap + 1 ? null : 'k'
      if (d === 1) {
        // An ember crack under the line, once a tile: a cooling end, a glowing heart.
        if (along === at) return 'e'
        if (along === at + 1) return 'o'
        if (along === at + 2) return 'e'
        return null
      }
      return null
    },
    // A coal one pixel in from each corner.
    quietCorner('k', (cx, cy) => (cx === 1 && cy === 1 ? 'e' : null)),
  )
}
function fireStrip(_f: number): Rows {
  const g = grid(STRIP_W, STRIP_H)
  // An ember line along the button's lip, two low tongues a tile rising
  // off it — clean 45° flanks, one taller than the other.
  for (let x = 0; x < STRIP_W; x++) g[STRIP_H - 1][x] = 'e'
  for (const [cx, h] of [
    [3, 3],
    [11, 2],
  ] as const) {
    for (let i = 1; i < h; i++) for (let dx = -(h - 1 - i); dx <= h - 1 - i; dx++) g[STRIP_H - 1 - i][cx + dx] = i === h - 1 ? 'e' : 'o'
    for (let dx = -(h - 1); dx <= h - 1; dx++) g[STRIP_H - 1][cx + dx] = 'o'
  }
  return rows(g)
}
/**
 * Flame tongues rising from the card's top edge: three to a tile, each a low
 * pointed tongue — warm at the root, orange, a dull red at the tip. Lower and
 * duller since the frames pass (no white heart), still read at a glance.
 */
function fireCrest(f: number): Rows {
  const g = grid(CREST_W, CREST_H)
  const tongues = [
    { x: 2, w: 4 },
    { x: 7, w: 3 },
    { x: 12, w: 4 },
  ]
  tongues.forEach((t, i) => {
    const h = 3 + Math.round(3 * hash(i, f, 4))
    const lean = Math.round((hash(i, f, 6) - 0.5) * 2)
    for (let r = 0; r < h; r++) {
      const k = r / h
      const half = Math.max(0, Math.round((t.w / 2) * (1 - k * k)))
      const cx = t.x + Math.round(lean * k * 2)
      for (let dx = -half; dx <= half; dx++) {
        const x = (cx + dx + CREST_W) % CREST_W
        const y = CREST_H - 1 - r
        const edge = Math.abs(dx) === half
        g[y][x] = edge && r > 0 ? 't' : k < 0.34 ? 'h' : k < 0.7 ? 'f' : 't'
      }
    }
  })
  // Rooted on the edge: a low ember line under the tongues.
  for (let x = 0; x < CREST_W; x++) if (g[CREST_H - 1][x] === '.') g[CREST_H - 1][x] = 't'
  return rows(g)
}

// ---------------------------------------------------------------------------
// PAINT — Easel House: a confident brush stroke in three paints, each dab
// with its bristle shade under it; a drip now and then
// ---------------------------------------------------------------------------
/*
 * The second frames pass (Oct 2026; the board: Peppercorn and Rosethread
 * GOOD, Ironvein "the most minimal in our UI aesthetic"): every world as
 * present as those two — a line and a rhythm of its own you can read at a
 * glance — still one deep, still dim, still no lone pixel.
 */
const PAINT: Palette = {
  // Each paint and its bristle shade.
  p: '#6e5a96',
  P: '#4c3d70',
  o: '#84663e',
  O: '#5c4628',
  t: '#40726c',
  T: '#2b4f4b',
  s: '#8a5a72',
  q: '#46326e',
}
function paintFrame(_f: number): Rows {
  return frame(
    (d, along, side) => {
      const s = sideN(side)
      // Dabs eight pixels long, each its own paint: the paint on the outside,
      // its bristle shade under it, parted where one dab meets the next (the
      // stroke's scallops: inner bumps read as battlements, not paint).
      const a = along % 8
      const band = (Math.floor(along / 8) + s) % 3
      const [paint, shade] = band === 0 ? ['p', 'P'] : band === 1 ? ['o', 'O'] : ['t', 'T']
      if (d === 0) return paint
      if (d === 1) return a === 0 || a === 7 ? null : shade
      // A drip off the foot, once a tile, hanging from a dab's edge.
      if (side === 'bottom' && (d === 2 || d === 3) && along === 6) return shade
      return null
    },
    // A dab of paint in each corner, a different paint across the diagonal.
    (cx, cy, which) => {
      const [paint, shade] = which === 0 || which === 3 ? ['o', 'O'] : ['s', 'q']
      return quietCorner(paint, (x, y) => (x === 1 && y === 1 ? shade : (x === 2 && y === 1) || (x === 1 && y === 2) ? shade : null))(cx, cy)
    },
  )
}
function paintStrip(_f: number): Rows {
  const g = grid(STRIP_W, STRIP_H)
  // A brush stroke standing on the button's lip: a dab of each of two paints,
  // its bristle shade under it (parted where the dabs meet), a scallop of
  // paint swelling up in the middle of each.
  for (let x = 0; x < STRIP_W; x++) {
    const [paint, shade] = x < 8 ? ['p', 'P'] : ['t', 'T']
    const a = x % 8
    g[STRIP_H - 2][x] = a === 0 ? '.' : shade
    g[STRIP_H - 3][x] = paint
    if (a >= 2 && a <= 5) g[STRIP_H - 4][x] = paint
  }
  return rows(g)
}

// ---------------------------------------------------------------------------
// FORGE — Ironvein: a two-tone iron band lit on its top edge, a rivet head
// every eight pixels, a riveted bracket plate at each corner, the forge's
// glow in each plate joint
// ---------------------------------------------------------------------------
const FORGE: Palette = {
  // The iron: its lit edge, its body, its shadow, a joint.
  L: '#5c697e',
  i: '#3e495c',
  D: '#262e3b',
  k: '#141922',
  // A rivet head, lit, and its shadow side.
  r: '#8a97ab',
  R: '#66738a',
  // The forge's glow in a joint.
  m: '#8a4422',
  M: '#b4602c',
}
function forgeFrame(_f: number): Rows {
  return frame(
    (d, along, side) => {
      // Lit from the top left, like the pack: the top and left bands catch the
      // light on their outer edge, the bottom and right fall into shadow.
      const lit = side === 'top' || side === 'left'
      // A plate joint every sixteen pixels, glowing from the forge.
      if (along === 15) return d === 0 ? 'k' : d === 1 ? 'm' : d === 2 ? 'M' : null
      // A rivet head on the band every eight pixels: lit, then its shadow side.
      if (d === 1 && along % 8 === 3) return 'r'
      if (d === 1 && along % 8 === 4) return 'R'
      if (d === 0) return lit ? 'L' : 'i'
      if (d === 1) return lit ? 'i' : 'D'
      return null
    },
    // A riveted bracket plate at each corner, deeper than the band, its
    // outer edge in the light of whichever side it turns.
    (cx, cy, which) => {
      if (cx === 0 && cy === 0) return null
      const top = which < 2
      const left = which === 0 || which === 2
      if (cy === 0) return top ? 'L' : 'i'
      if (cx === 0) return left ? 'L' : 'i'
      if (cx === 1 && cy === 1) return 'r'
      if ((cx === 2 && cy === 1) || (cx === 1 && cy === 2)) return 'R'
      if (cx + cy === 5 || (cx === 3 && cy === 1) || (cx === 1 && cy === 3)) return 'D'
      if (cx + cy <= 4) return 'i'
      return null
    },
  )
}
function forgeStrip(_f: number): Rows {
  const g = grid(STRIP_W, STRIP_H)
  // An iron bar standing on the button's lip: its lit top, its body, a domed
  // rivet every eight pixels, and the forge glowing in its one joint.
  for (let x = 0; x < STRIP_W; x++) {
    g[STRIP_H - 3][x] = 'L'
    g[STRIP_H - 2][x] = 'i'
  }
  // Each rivet a round head two pixels wide, domed over the bar, lit on its left.
  for (const x of [3, 11]) {
    g[STRIP_H - 4][x] = g[STRIP_H - 4][x + 1] = 'R'
    g[STRIP_H - 3][x] = 'r'
    g[STRIP_H - 3][x + 1] = 'R'
  }
  g[STRIP_H - 3][15] = 'm'
  g[STRIP_H - 2][15] = 'M'
  return rows(g)
}

// ---------------------------------------------------------------------------
// SILK — Rosethread: a satin line with a sheen on it, an embroidered running
// stitch inside, a rose bud in each corner
// ---------------------------------------------------------------------------
const SILK: Palette = { n: '#74384e', r: '#9c5a72', t: '#9a6c7e', s: '#4e2232' }
function silkFrame(_f: number): Rows {
  return frame(
    (d, along) => {
      // The satin, and its sheen: one lighter pixel a tile.
      if (d === 0) return along === 5 ? 'r' : 'n'
      // The running stitch, two on, two off, a pixel in from the satin.
      if (d === 2) return along % 4 < 2 ? 't' : null
      return null
    },
    quietCorner('n', (cx, cy) => (cx === 1 && cy === 1 ? 'r' : (cx === 2 && cy === 1) || (cx === 1 && cy === 2) ? 's' : null)),
  )
}
function silkStrip(_f: number): Rows {
  const g = grid(STRIP_W, STRIP_H)
  // A ribbon waving gently across the button's lip, one pixel.
  for (let x = 0; x < STRIP_W; x++) g[Math.round(3 + 1 * Math.sin((x / STRIP_W) * Math.PI * 2))][x] = 'r'
  // The stitch along the lip.
  for (let x = 0; x < STRIP_W; x++) if (x % 4 < 2) g[STRIP_H - 1][x] = 't'
  return rows(g)
}

// ---------------------------------------------------------------------------
// ARCANE NIGHT — Moonquill: a silver line, two runes a tile inscribed under
// it, a four-pointed star in each corner
// ---------------------------------------------------------------------------
const ARCANE: Palette = { s: '#5e6898', g: '#56609c', G: '#8a96ca' }
/** Five little runes, 3 × 3, for the frame and the CTA strip. */
const RUNES_3: Rows[] = [
  ['s.s', '.s.', 's.s'],
  ['ss.', '.s.', '.ss'],
  ['.s.', 'sss', '.s.'],
  ['s..', 'ss.', 's.s'],
  ['sss', 's..', '.s.'],
]
function arcaneFrame(_f: number): Rows {
  return frame(
    (d, along, side) => {
      if (d === 0) return 's'
      // Two runes a tile (at 2 and 10), hung from the line, each its own.
      for (const [k, at] of [
        [0, 2],
        [1, 10],
      ] as const) {
        const x = along - at
        if (x < 0 || x > 2) continue
        const rune = RUNES_3[(sideN(side) + k * 2) % RUNES_3.length]
        return rune[d - 1][x] === 's' ? 'g' : null
      }
      return null
    },
    // A four-pointed star in each corner, its near rays touching the line.
    quietCorner('s', (cx, cy) => (cx === 2 && cy === 2 ? 'G' : (cx === 2 && (cy === 1 || cy === 3)) || (cy === 2 && (cx === 1 || cx === 3)) ? 'g' : null)),
  )
}
function arcaneStrip(_f: number): Rows {
  const g = grid(STRIP_W, STRIP_H)
  // Three runes in a row standing on the button's lip, the middle one lit.
  for (let k = 0; k < 3; k++) {
    const rune = RUNES_3[(k + 2) % RUNES_3.length]
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (rune[y][x] === 's') g[2 + y][1 + k * 5 + x] = k === 1 ? 'G' : 'g'
  }
  return rows(g)
}

const WORLDS: Record<CompanyId, WorldArt> = {
  spice: { frame: fireFrame(0), strip: fireStrip(0), crest: fireCrest(0), palette: FIRE },
  art: { frame: paintFrame(0), strip: paintStrip(0), palette: PAINT },
  metals: { frame: forgeFrame(0), strip: forgeStrip(0), palette: FORGE },
  silk: { frame: silkFrame(0), strip: silkStrip(0), palette: SILK },
  scrolls: { frame: arcaneFrame(0), strip: arcaneStrip(0), palette: ARCANE },
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
