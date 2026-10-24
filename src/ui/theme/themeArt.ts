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
 *   - Butcherblock — MARSH: a dry reed stem jointed every few pixels, lashed
 *     with hide twine once a tile, a bone knuckle at each corner; a
 *     smokehouse rail on its CTA, two hooks hanging from it.
 *   - Ironvein — FORGE: an iron line jointed into plates, a rivet on each,
 *     one joint a tile lit by the forge, a bolt at each corner.
 *   - Rosethread — SILK: a satin line with a sheen pixel, an embroidered
 *     running stitch inside it, a rose bud at each corner; a ribbon on its CTA.
 *   - Greenvial — GLASSHOUSE: a leaded glass line, a vine climbing along
 *     inside it with a leaf a tile, a spore bud at each corner; a vine on
 *     its CTA.
 *
 * The frames' slice is 4 px (8 CSS px), but what is drawn in it is QUIET (the
 * frames pass, Oct 2026): one dim line and sparse detail, each world with its
 * own corner and its own SHAPE — ragged, jointed, riveted, stitched,
 * climbing — so a glance tells them apart even in greyscale.
 *
 * Everything here is PIXEL ROWS (one character a pixel, `.` clear) and a
 * palette: the frame (a 9-slice for `border-image`), the CTA's top strip and
 * the card's crest. `themeArtDom.ts` rasterises them once into CSS
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
// MARSH — Butcherblock: a dry reed stem along the edge, jointed, lashed with
// hide twine once a tile; a bone knuckle in each corner
// ---------------------------------------------------------------------------
/*
 * The rename (Oct 2026): the `art` slot is Butcherblock's now — reeds, mist,
 * hide and bone on the salt marsh — so its frame is the reed bed's, as quiet
 * as Peppercorn's char and Rosethread's satin: one dim line (a reed stem a
 * shade off the smoke-grey panel), a darker joint every eight pixels, and a
 * short wrap of twine once a tile, two pixels deep.
 */
const MARSH: Palette = {
  // The reed stem, and its joint.
  r: '#6a6448',
  n: '#46412e',
  // The hide twine lashed round it, and its shadow.
  t: '#7e5c42',
  T: '#523a28',
  // A bone knuckle: lit, and its shade.
  w: '#9c9076',
  W: '#706650',
  // The CTA's hooks, steel.
  S: '#8a939c',
}
function marshFrame(_f: number): Rows {
  return frame(
    (d, along) => {
      // The lashing, once a tile: a two-pixel wrap across the stem and under it.
      const lash = along === 11 || along === 12
      if (d === 0) return lash ? 't' : along % 8 === 3 ? 'n' : 'r'
      if (d === 1) return lash ? 'T' : null
      return null
    },
    // A bone knuckle one pixel in from each corner, its shade toward the panel.
    quietCorner('r', (cx, cy) => (cx === 1 && cy === 1 ? 'w' : (cx === 2 && cy === 1) || (cx === 1 && cy === 2) ? 'W' : null)),
  )
}
function marshStrip(_f: number): Rows {
  // A smokehouse rail along the button's top, one butcher's hook a tile
  // hanging from it, its J resting on the lip (two a tile read as a ruler).
  return [
    '................',
    'tttttttttttttttt',
    '.......S........',
    '.......S........',
    '.......S.S......',
    '........S.......',
  ]
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
// GLASSHOUSE — Greenvial: a leaded glass line, a vine climbing along inside
// it with a leaf a tile, a spore bud in each corner
// ---------------------------------------------------------------------------
/*
 * The rename (Oct 2026): the `scrolls` slot is Greenvial's now — glass, vines
 * and glowing spores in the hidden gardens — so its frame is a glasshouse
 * pane's: one dim leaded line, a pane's faint glint inside it once a tile,
 * and a vine running along under it, a leaf put out twice a tile.
 */
const GLASS: Palette = {
  // The lead line, and the pane's glint along it.
  g: '#3e6a5c',
  q: '#487462',
  // The vine, and its leaf.
  v: '#2f5a40',
  l: '#4c8a52',
  // The spore bud in the corner, and the CTA's spore.
  s: '#7aa444',
}
function glassFrame(_f: number): Rows {
  return frame(
    (d, along) => {
      if (d === 0) return along === 13 ? 'q' : 'g'
      // The vine runs along under the lead, a pixel in, and puts out a leaf twice a tile.
      if (d === 1) return 'v'
      if (d === 2) return along === 3 || along === 11 ? 'l' : null
      return null
    },
    // A spore bud one pixel in from each corner, a leaf beside it.
    quietCorner('g', (cx, cy) => (cx === 1 && cy === 1 ? 's' : cx === 2 && cy === 2 ? 'l' : null)),
  )
}
function glassStrip(_f: number): Rows {
  // A vine running along the button's lip, a leaf rising off it twice a tile
  // and one glowing spore bud.
  return [
    '................',
    '................',
    '..........s.....',
    '...l......v...l.',
    '.vvlv....vv..vl.',
    'v...vvvvvv.vvv.v',
  ]
}

const WORLDS: Record<CompanyId, WorldArt> = {
  spice: { frame: fireFrame(0), strip: fireStrip(0), crest: fireCrest(0), palette: FIRE },
  art: { frame: marshFrame(0), strip: marshStrip(0), palette: MARSH },
  metals: { frame: forgeFrame(0), strip: forgeStrip(0), palette: FORGE },
  silk: { frame: silkFrame(0), strip: silkStrip(0), palette: SILK },
  scrolls: { frame: glassFrame(0), strip: glassStrip(0), palette: GLASS },
}

/** A company's world art. */
export const worldArt = (c: CompanyId): WorldArt => WORLDS[c]
