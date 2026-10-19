/**
 * The clans' pixel parts — ORIGINAL art, drawn here, in the pack's palette
 * (every letter below is a colour the CC0 Tiny Swords build already ships;
 * `enemy-clans.ts` snaps to the pack regardless). Read by the bake only.
 *
 * A part is a grid of palette letters, '.' clear. The bake inks every part in
 * the pack's outline colour (unless `ink: false` — a flame, a drip, a wire),
 * so a grid holds fills and inner lines only.
 *
 * Coordinates are frame 0 of the plain tier-1 strip, before the headroom:
 *  - torch (115 × 80): the hood's crown spans x 66–92 at y 14, its tip at
 *    (72, 5); the front arm leaves the robe at (88, 31); the back is x ≈ 58;
 *  - tnt (90 × 71): the head's crown spans x 30–58 at y 13, the goggles
 *    x 35–62, y 16–33; the dynamite bundle filled x 4–31, y 4–33, above the
 *    tier-hued basket (x 5–27, y 33–56);
 *  - barrel (52 × 72): the fuse filled x 22–33, y 1–27; the lid's rim is at
 *    y 16; the hoops are y 41–46 and 56–60; the TNT lettering x 12–39, y 47–56.
 * `at: 'tip'` is relative to the torch haft's top in each frame (the wood,
 * once the flame and its rag are cut), `at: 'hand'` to the middle of the
 * bomber's lit stick — so the walk cycle carries them.
 *
 * **The ladder** (`recipeFor`): ornament climbs with the tier, the same way in
 * every clan, so tiers read in order by silhouette as well as by the tier hue
 * the parts leave showing —
 *   T1 the clan's headgear and its weapon (the bomber: its load and bomb; the
 *      keg: its cap, mark and hoop colour); T2 + a pauldron (the keg: studs or
 *      drips); T3 + a back piece (the keg: side pieces); T4 the headgear's big
 *      form (the keg: the big cap); T5, the champion, the clan's own boss
 *      look — a crown, and a mantle or a great standard.
 */
import type { ClanId, Faction } from '../src/game/data/clans'

/** The pack's outline colour (every Tiny Swords sprite is inked in it). */
export const INK = '#161c2e'

/** Palette letters → colours taken from the CC0 pack (`harvest-cc0.ts` palette). */
export const MASTER: Readonly<Record<string, string>> = {
  k: INK,
  // iron / soot / steel
  '1': '#394243',
  '2': '#4f5e65',
  '3': '#737f8e',
  '4': '#bac1c8',
  '5': '#e1d4bd',
  W: '#ffffff',
  // fire
  y: '#ffed44',
  f: '#ffe325',
  e: '#d9945f',
  E: '#d08c41',
  o: '#b16c4d',
  r: '#db4c4c',
  R: '#8b4a4a',
  // leaf
  g: '#38b251',
  G: '#387253',
  h: '#95d562',
  // wood / leather / brass
  t: '#d5b583',
  T: '#efe1ab',
  b: '#977b6b',
  B: '#685757',
  a: '#b48355',
  // rose / silk
  p: '#f69e7d',
  P: '#d55869',
  m: '#b45076',
  M: '#87465a',
  l: '#a8719a',
  L: '#95809d',
  // moon / night
  c: '#8cc3c4',
  C: '#c6f0db',
  s: '#c8d0d8',
  u: '#3e8698',
  U: '#404e75',
  n: '#2a3e5d',
  v: '#775396',
  V: '#433d5b',
  q: '#47aba9',
  z: '#5ab3ac',
}

export interface Part {
  name: string
  grid: readonly string[]
  /** What it follows frame by frame: the head (and body), the torch haft's top, the bomber's hand. */
  at: 'head' | 'tip' | 'hand'
  /** Top-left: frame-0 coords for `head`; an offset from the anchor for `tip` / `hand`. */
  x: number
  y: number
  /** `under`: fills only empty pixels — behind the body. */
  layer?: 'over' | 'under'
  flip?: boolean
  /** False: no outline (a flame, a drip, a wire). */
  ink?: boolean
  /** False: ink only into empty pixels, never over the body (a part flush on a surface). */
  inkOver?: boolean
}

export type Cut = 'flame' | 'sticks' | 'stick' | 'fuse'
export interface Recipe {
  cuts: Cut[]
  parts: Part[]
  /** The keg's hoop colours (palette letters), replacing the plain keg's cream; `hi` takes the hoops' white glints. */
  bands?: { light: string; dark: string; hi?: string }
  /**
   * Colours of the plain art re-inked inside a head-tracked box (frame-0
   * coords, before the headroom): source hex → palette letter. Keeps the
   * faction's own shape (the bomber's goggles) and gives it the clan's hue.
   */
  recolor?: { box: readonly [number, number, number, number]; map: Readonly<Record<string, string>> }[]
}

// ── helpers ─────────────────────────────────────────────────────────────────
/** Mirror each half-row about its last column (odd widths: the centre column is the last char). */
export const sym = (half: readonly string[]): string[] => half.map((r) => r + [...r.slice(0, -1)].reverse().join(''))

/** A pole `len` px long under `top` (its wood two px wide at column `col`). */
export function pole(top: readonly string[], col: number, len: number, wood = 'b'): string[] {
  const w = Math.max(...top.map((r) => r.length), col + 2)
  const rows = top.map((r) => r.padEnd(w, '.'))
  for (let i = 0; i < len; i++) rows.push('.'.repeat(col) + wood + 'B' + '.'.repeat(Math.max(0, w - col - 2)))
  return rows
}

/** Paint `top` onto a copy of `base` at (x, y) — '.' in `top` keeps `base`. */
export function overlay(base: readonly string[], top: readonly string[], x: number, y: number): string[] {
  const w = Math.max(1, ...base.map((r) => r.length), ...top.map((r) => r.length + x))
  const rows = base.map((r) => r.padEnd(w, '.').split(''))
  while (rows.length < y + top.length) rows.push('.'.repeat(w).split(''))
  top.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r[i] !== '.') rows[y + j][x + i] = r[i]
  })
  return rows.map((r) => r.join(''))
}

/** One part, or several laid together (a crest's flames over its band). */
export type P = Part | readonly Part[]
const all = (...ps: (P | null | undefined | false)[]): Part[] => ps.flatMap((p) => (!p ? [] : Array.isArray(p) ? [...p] : [p as Part]))

/** One clan's kit: every part the ladder can call for. */
export interface Kit {
  /** Torch weapon head (replaces the flame and its rag), on the haft's top. Null: the torch keeps its flame. */
  weapon: P | null
  hat: P
  hatBig: P
  crown: P
  pad: P
  back: P
  mantle: P
  /** A torch part every tier wears (a mask). */
  face?: P
  /** The bomber's head, shoulder and back pieces (its head is lower and further left). */
  tntHat: P
  tntHatBig: P
  tntCrown: P
  tntPad: P
  tntBack: P
  /** The bomber champion's great standard (its back is its basket, so no mantle). */
  tntStandard: P
  tntFace?: P
  /** The bomber's load (replaces the dynamite bundle) and the bomb in its hand (replaces the lit stick). */
  pack: P
  bomb: P
  cap: P
  capBig: P
  bossCap: P
  mark: P
  hoops: P
  sides: P
  /** The keg's hoops (cream on the plain keg), recoloured. */
  bands: { light: string; dark: string; hi?: string }
  /** The bomber's own art re-inked (see {@link Recipe.recolor}). */
  tntRecolor?: Recipe['recolor']
}

/** A torch head part moved onto the bomber's head (its crown sits 36 px left, 2 px lower). */
export const onTnt = (p: P, dx = -36, dy = 2): P =>
  Array.isArray(p) ? p.map((q) => onTnt(q, dx, dy) as Part) : { ...(p as Part), name: `tnt-${(p as Part).name}`, x: (p as Part).x + dx, y: (p as Part).y + dy }

/**
 * Where the tier-2 shoulder piece sits (asset critique, Oct 2026, round 1).
 * It sat at (83, 31) — over the torch goblin's nose and the bomber's mouth, so
 * it read as a gag or a third eye. It is on the BACK shoulder now, where the
 * torch arm (and the bomber's basket strap) leaves the robe: outside the face,
 * on the lit side, and mirrored so its curve faces the arm.
 */
export const PAD_AT = { at: 'head', x: 53, y: 30, flip: true } as const
export const TNT_PAD_AT = { at: 'head', x: 12, y: 31, flip: true } as const

/**
 * A keg's pair of side pieces, touching its staves where it is widest (round 1:
 * they hung a few px off the keg, so fins, stones and brushes floated). The
 * grid is the LEFT piece, its right column against the keg; the right piece is
 * its mirror. `under`: the overlap with the keg is skipped, so each reads as
 * strapped on behind the stave line.
 */
export function lugs(name: string, left: readonly string[], y: number, mirror = true): Part[] {
  const w = Math.max(...left.map((r) => r.length))
  return [
    { name: `${name}-l`, grid: left, at: 'head', x: 3 - w, y, layer: 'under' },
    { name: `${name}-r`, grid: left, at: 'head', x: 49, y, layer: 'under', flip: mirror },
  ]
}

/**
 * A flat disc seen from the 3/4 view, `w` wide: an elliptical face `faceH`
 * tall (light from the upper left, a dark hole in its middle) over a rim
 * `thick` px deep. The reel's flanges (round 1: they were flat planks, the
 * one shape on the keg drawn without the view's perspective).
 */
export function disc(w: number, faceH: number, thick: number, face = 't', lit = 'T', rim = 'b', shade = 'B', hole = 'B'): string[] {
  const a = w / 2
  const b = faceH / 2
  const cx = (w - 1) / 2
  const cy = (faceH - 1) / 2
  const inFace = (i: number, j: number) => ((i - cx) / a) ** 2 + ((j - cy) / b) ** 2 <= 1
  const rows: string[] = []
  for (let j = 0; j < faceH + thick; j++) {
    let r = ''
    for (let i = 0; i < w; i++) {
      const d = ((i - cx) / a) ** 2 + ((j - cy) / b) ** 2
      if (inFace(i, j)) {
        if (((i - cx) / (a * 0.16)) ** 2 + ((j - cy) / (b * 0.4)) ** 2 <= 1) r += hole
        else if (d > 0.5 && j < cy && i < cx + a * 0.25) r += lit
        else r += face
      } else {
        let under = false
        for (let k = 1; k <= thick && !under; k++) under = inFace(i, j - k)
        r += under ? (i > cx + a * 0.45 ? shade : rim) : '.'
      }
    }
    rows.push(r)
  }
  return rows
}

/**
 * A wire handle: the top half of an ellipse `w` wide and `h` tall, one px
 * thick and unbroken, ending in a rivet at each foot (round 1: the paint
 * tin's bail hung in the air, its feet a few px off the tin).
 */
export function bailArc(w: number, h: number, wire = 'b'): string[] {
  const g = Array.from({ length: h + 2 }, () => Array(w).fill('.'))
  const rx = (w - 1) / 2
  let prev = -1
  for (let i = 0; i < w; i++) {
    const t = (i - rx) / rx
    const y = Math.round(h - h * Math.sqrt(Math.max(0, 1 - t * t)))
    const from = prev < 0 ? y : Math.min(y, prev + (y > prev ? 1 : 0))
    const to = prev < 0 ? y : Math.max(y, prev - (y < prev ? 1 : 0))
    for (let yy = Math.min(from, to); yy <= Math.max(from, to); yy++) g[yy][i] = wire
    prev = y
  }
  for (const x of [0, w - 3]) for (let j = h - 1; j <= h + 1; j++) for (let i = x; i < x + 3; i++) g[j][i] = j === h - 1 && i === x ? '4' : '3'
  return g.map((r) => r.join(''))
}

/** A banner: a pole with a cloth hung to its right at the top. */
export const banner = (cloth: readonly string[], len: number): string[] => pole(overlay(['BB'], cloth, 2, 1), 0, len)

// ─────────────────────────────────────────────────────────────── CINDER ──
// Peppercorn's road: ember-and-spice raiders. The tell: the hood's own tip is
// alight, a plume of live flame; the torch burns on; firepots for bombs; the
// keg wears soot hoops, a Peppercorn spice label and a chilli's stem.

/**
 * Round 2: the crest is ONE plume of live flame burning off the hood's own
 * peak — the hood is the wick — not a row of candles on a soot plank (which
 * read as a crown, the champion's mark, and sat on the pointed hood like a
 * lid with air under its corners). T4 burns taller.
 */
const PLUME = [
  '...e................',
  '...ee.......e.......',
  '....ee......ee......',
  '....eye.....eye.....',
  '...eyye....eyye.....',
  '...eyyye...eyyye..e.',
  '..eyyyye..eyyyye.ee.',
  '..eyyyyee.eyyyyeeye.',
  '..eyyWyyeeyyWyyeyye.',
  '.eyyyWWyyyyWWyyyyye.',
  '.eyyyWWyyyyWWWyyyye.',
  'eyyyyWWWyyyyWWyyyyye',
  'eyyyyyWWWyyyWWyyyyye',
  'eeyyyyyWWWWWWyyyyyee',
  'oeeyyyyyWWWWyyyyyeeo',
  '.oeeyyyyyyyyyyyyeeo.',
  '..ooeeeyyyyyyyeeoo..',
  '....ooeeeeeeeeoo....',
  '......oooooooo......',
]
const PLUME_TALL = [
  '..e.................',
  '..ee................',
  '...ee.........e.....',
  '...eye.......ee.....',
  '....eye.....eye.....',
  ...PLUME.slice(2),
]

const FLAMES = [
  '......e...................',
  '.....ey.........e.........',
  '....eyy........ey.........',
  '....eyye......eyy.....e...',
  '...eyyye.....eyyy....ey...',
  '...eyWye..e..eyWye..eyy...',
  '..eyyWye.ey.eyyWye..eyye..',
  '..eyWWyeeyyeeyWWyye.eyWye.',
  '.eyyWWyyeyyeyyWWyyeeyyWye.',
  '.eyyWWyyeyyeyyWWWyyeyyWyye',
  'oeyyyWyeeyyeeyyWyyeeyyyyeo',
  'oeeyyyyeeeyeeeyyyyeeeyyyeo',
  '.ooeeeeooeeooeeeeeooeeeeo.',
  '..rooorroorrooooorroooor..',
]
const FLAMES_TALL = [
  '.....e.......e............',
  '....ey......ey............',
  '....eye....eyy............',
  '...eyye....eyye...........',
  '...eyyye..eyyye......e....',
  ...FLAMES.slice(0, 5).map((r, i) => (i < 2 ? r : r)),
  ...FLAMES.slice(5),
]
const SOOT_BAND = ['11111111111111111111111111', '22222222222222222222222222', 'r1e1r1e1r1e1r1e1r1e1r1e1r1', '11111111111111111111111111']

function cinder(): Kit {
  // The hood's own tip is the wick: the plume stands on the peak (72, 5).
  const crest: Part[] = [{ name: 'crest-plume', grid: PLUME, at: 'head', x: 62, y: -9, ink: false }]
  const crestBig: Part[] = [{ name: 'tall-crest-plume', grid: PLUME_TALL, at: 'head', x: 62, y: -12, ink: false }]
  const horns = [
    '11......................11',
    '121....................121',
    '.121..................121.',
    '.1221................1221.',
    '..1221..............1221..',
    '..12221............12221..',
    '...1222............2221...',
  ]
  const crown: Part[] = [
    { name: 'iron-horns', grid: horns, at: 'head', x: 66, y: 3 },
    { name: 'crown-flames', grid: FLAMES_TALL.slice(0, 15), at: 'head', x: 66, y: -6, ink: false },
    { name: 'crown-band', grid: ['RRRRRRRRRRRRRRRRRRRRRRRRRR', ...SOOT_BAND], at: 'head', x: 66, y: 9 },
  ]
  const pad = ['....111111111..', '..11222222222..', '.122222r22222..', '122222rer22221.', '1222222r222211.', '.1111111111111.']
  const chilliFlag = ['1111111111', '1222222221', '122gG22221', '1222rg2221', '122rrrr221', '122rrrr221', '1222rrr22.', '1222rr2...', '12222.....', '122.......']
  // Round 2: soot cloth with a smouldering hem (it was flat grey '2', a slab).
  const mantle = [
    '..1111111....',
    '.11111111....',
    '.111211111...',
    '1112111111...',
    '11121111111..',
    '11211111111..',
    '112111111111.',
    '121111111111.',
    '1211111111111',
    '1111111111111',
    '111111111111R',
    '11111111111RR',
    '1111111111RrR',
    '111R11R1rReR.',
    '1RrRRrReRyR..',
    'ReyRerReyR...',
    '.eRe.eR......',
  ]
  const pot = ['.oEEEo.', 'oEEaEEo', 'oEaEEEo', 'oEEEEao', '.oEEEo.']
  const potFlame = ['..e..', '.eye.', '.eyye', 'eyWye', 'eyyye', '.eee.']
  return {
    weapon: null,
    hat: crest,
    hatBig: crestBig,
    crown,
    pad: { name: 'soot-pauldron', grid: pad, ...PAD_AT },
    back: { name: 'chilli-banner', grid: banner(chilliFlag, 46), at: 'head', x: 56, y: -8, layer: 'under' },
    mantle: { name: 'ember-mantle', grid: mantle, at: 'head', x: 50, y: 30, layer: 'under' },
    tntHat: onTnt(crest),
    tntHatBig: onTnt(crestBig),
    tntCrown: onTnt(crown),
    tntPad: { name: 'soot-pauldron', grid: pad, ...TNT_PAD_AT },
    tntBack: { name: 'chilli-banner', grid: banner(chilliFlag, 34), at: 'head', x: 3, y: -8, layer: 'under' },
    tntStandard: { name: 'ember-standard', grid: banner(overlay(mantle.slice(0, 12), chilliFlag, 1, 1), 42), at: 'head', x: 0, y: -16, layer: 'under' },
    pack: [
      { name: 'firepots', grid: overlay(overlay(overlay(['', '', '', '', '', '', '', '', '', '', '', '', '', '', ''], pot, 0, 6), pot, 8, 3), pot, 16, 7), at: 'head', x: 3, y: 18, layer: 'under' },
      { name: 'firepot-flames', grid: overlay(overlay(overlay(['', '', '', '', '', ''], potFlame, 1, 3), potFlame, 9, 0), potFlame, 17, 4), at: 'head', x: 3, y: 15, layer: 'under', ink: false },
    ],
    bomb: [
      { name: 'firepot', grid: ['.oEEEEo.', 'oEEaEEEo', 'oEaEEEEo', 'oEEEEEao', 'oEEEEaEo', '.oEEEEo.'], at: 'hand', x: -4, y: -3 },
      { name: 'firepot-flame', grid: ['...e....', '..eye...', '..eyye..', '.eyWyye.', '.eyyyye.', '..eeee..'], at: 'hand', x: -4, y: -9, ink: false },
    ],
    cap: {
      name: 'chilli-stem',
      grid: ['.........gg.', '........gGg.', '.......gGg..', '......gGg...', '......gG....', '......gG....', '..gGgggGgg..', '.gGhGgGgGhg.', 'gGhGgGGGgGhg', 'gG.gG.gG.gG.', 'g..g..g..g..'],
      at: 'head',
      x: 20,
      y: 8,
    },
    capBig: [
      { name: 'chilli-stem-tall', grid: ['.........gg.', '........gGg.', '.......gGg..', '......gGg...', '......gG....', '......gG....', '......gG....', '..gGgggGgg..', '.gGhGgGgGhg.', 'gGhGgGGGgGhg', 'gG.gG.gG.gG.', 'g..g..g..g..'], at: 'head', x: 20, y: 7 },
      { name: 'stem-flame', grid: ['.e..', 'eye.', 'eyye', '.ee.'], at: 'head', x: 28, y: 3, ink: false },
    ],
    bossCap: [
      { name: 'brimstone-crown', grid: ['1.....1.....1.....1', '21...121...121...12', '221.12221.12221.122', '.2222222222222222.', '.r1e1r1e1r1e1r1e1.', '.111111111111111..'], at: 'head', x: 16, y: 10 },
      { name: 'brimstone-flames', grid: ['....e.....e.....', '...eye...eye....', '...eyye..eyye...', '..eyWye.eyWye...', '..eyyye.eyyye...', '...eee...eee....'], at: 'head', x: 18, y: 3, ink: false },
    ],
    mark: {
      name: 'spice-label',
      // Round 2: a Peppercorn spice label with a chilli on it (it was a soot
      // plate with a pinhead flame: a dark box that read as nothing at size).
      grid: [
        '.TTTTTTTTTTTTTTTTTTTTTTTTTT.',
        'TtTTTTTTTTTTTTTTTTTTTTTTTTtT',
        'TTTTTTTTTTTTTTTTTTTTTGgTTTTT',
        'TTTTTTrrrrrrrrrrrrrrrgGTTTTT',
        'TTTTrrrrrrrrrrrrrrrrrrgTTTTT',
        'TTTrRRrrrrrrrrrrrrrrrrrTTTTT',
        'TTTTRRRRRRRRrrrrrrrrrrTTTTTT',
        'TtTTTTTTTRRRRRRRRRRRTTTTTTtT',
        '.TTTTTTTTTTTTTTTTTTTTTTTTTT.',
      ],
      at: 'head',
      x: 12,
      y: 47,
    },
    hoops: { name: 'ember-studs', grid: ['r..e..r..e..r..e..r..e..r', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', 'r..e..r..e..r..e..r..e..r'], at: 'head', x: 13, y: 43, ink: false },
    sides: lugs('ember-fin', ['...rr', '..rer', '.reyr', 'reyWr', '.reyr', '..rer', '...rr'], 31),
    bands: { light: '2', dark: '1', hi: '3' },
  }
}

// ──────────────────────────────────────────────────────────── GNAWBONE ──
// Butcherblock's road (the `smudge` id, Oct 2026: it wore the old house's
// paint): marsh goblins who raid the smokehouse barges for salt and meat. The
// tell: a boar's skull for a helm, snout forward (tusks at T4, a bone crown at
// T5); a meat hook for the torch; a hide pauldron; a smoke rack of meat; salt
// sacks in the basket and a salt pouch to throw; the keg heaped with salt
// under twine, crossed bones on a hide label. Greedy, swaggering, secretly
// squeamish: the skull is worn so nobody sees them flinch.
function gnawbone(): Kit {
  const skull = [
    'TT.....................T....',
    'TtT...................TtT...',
    '.TtT.................TtT....',
    '..TtT......55555555.TtT.....',
    '...TtTT..5TTTTTTTT5TtT......',
    '.....tTT5TTTTTTTTTTTT5......',
    '.......5TTTTTTTTTTTTT55.....',
    '......5TTTTTTTBBTTTTTTT5....',
    '......5TTTTTTBBBBTTTTTTTT5..',
    '......5TTTTTTTBBTTTTTTTTTT5.',
    '......t5TTTTTTTTTTTTTTTTTBT5',
    '.......t555TTTTTTTTTTTTTTTt5',
    '.........ttt5t5t5t5t5t5ttt..',
    '..........t.t.t.t.t.t.t.....',
  ]
  const tusks = overlay(skull, ['TT', 'Tt', '.Tt', '..T'], 25, 12)
  const bigSkull = overlay(
    tusks,
    ['TT.........', 'TtT........', '.TtT.......', '..TtT......', '...TtTT....'],
    0,
    0,
  )
  const boneCrown = ['.T...T...T...T.', 'TtT.TtT.TtT.TtT', 'TtTTTtTTTtTTTtT', 'ttttttttttttttt']
  const hat: Part = { name: 'boar-skull', grid: skull, at: 'head', x: 64, y: 2 }
  const hatBig: Part = { name: 'tusked-skull', grid: bigSkull, at: 'head', x: 64, y: 1 }
  const crown: Part[] = [
    { name: 'bone-crown', grid: boneCrown, at: 'head', x: 73, y: 2 },
    { name: 'crowned-skull', grid: tusks, at: 'head', x: 64, y: 2 },
  ]
  const hook = ['..3333...', '.34..43..', '34....43.', '4......3.', '4......3.', '.4.....3.', '..1....3.', '.......3.', '......aaa', '......aaa', '.......b.']
  const hide = ['....aaaaaaa....', '..aaabaaabaa...', '.aabaaaabaaab..', 'aaaaabaaaaaaab.', 'abBabBabBabBa..', '.B.B.B.B.B.B...']
  const rack = ['BBBBBBBBBBB', '.R...R...R.', '.Rr..Rr..Rr', '.RR..RR..RR', '.Rp..Rr..Rp', '.RR..RR..RR', '.R...R....R', '.....R.....']
  const cape = ['..aaaaaaa....', '.aaaaaaaaa...', '.aabaaaaaaa..', 'aaaabaaaaaa..', 'aaaaaabaaaaa.', 'aabaaaaaaaaa.', 'aaaaaaaabaaa.', 'aaaabaaaaaaaa', 'aaaaaaaaaabaa', 'abaaaaaaaaaaa', 'aaaaaabaaaaaa', 'aaaaaaaaaaaa.', 'TaTaTaTaTaTa.', '.T.T.T.T.T...']
  const sack = ['..b...', '.TbT..', 'TTTTT.', 'T5TTTT', 'TTTT5T', 'TTTTTT', '.TTTT.']
  const salt = ['.........W..........', '......WWW4WW........', '....WW44WWW4WWW.....', '...W4WWWsWW44WW4W...', '.WWW4WWW4WWWWsWWWWW.', 'W4WWWWsWWW4WWWWW4WWW', 'sWWsWWWWsWWWsWWWWsWs']
  return {
    weapon: { name: 'meat-hook', grid: hook, at: 'tip', x: -6, y: -10 },
    hat,
    hatBig,
    crown,
    pad: { name: 'hide-pauldron', grid: hide, ...PAD_AT },
    back: { name: 'smoke-rack', grid: banner(rack, 46), at: 'head', x: 56, y: -8, layer: 'under' },
    mantle: { name: 'hide-cape', grid: cape, at: 'head', x: 50, y: 30, layer: 'under' },
    tntHat: onTnt(hat),
    tntHatBig: onTnt(hatBig),
    tntCrown: onTnt(crown),
    tntPad: { name: 'hide-pauldron', grid: hide, ...TNT_PAD_AT },
    tntBack: { name: 'smoke-rack', grid: banner(rack, 34), at: 'head', x: 3, y: -8, layer: 'under' },
    tntStandard: { name: 'hide-standard', grid: banner(cape.slice(0, 12), 42), at: 'head', x: 0, y: -16, layer: 'under' },
    pack: { name: 'salt-sacks', grid: overlay(overlay(overlay(['', ''], sack, 0, 5), sack, 7, 1), sack, 14, 6), at: 'head', x: 4, y: 20, layer: 'under' },
    bomb: { name: 'salt-pouch', grid: ['...bb...', '..bTTb..', '..TTTT..', '.TTWTTT.', 'TT5TTTTT', 'TTTTT5TT', '.TTTTTT.', '..TTTT..'], at: 'hand', x: -4, y: -4 },
    cap: { name: 'salt-heap', grid: salt, at: 'head', x: 16, y: 12 },
    capBig: [
      { name: 'salt-heap', grid: salt, at: 'head', x: 16, y: 12 },
      { name: 'bone-in-salt', grid: ['TT.', 'TtT', '.Tt', '..T', '..T', '..T', '.TT'], at: 'head', x: 27, y: 6 },
    ],
    bossCap: [
      { name: 'salt-heap', grid: salt, at: 'head', x: 16, y: 12 },
      { name: 'bone-crown-keg', grid: ['.T....T....T.', 'TtT..TtT..TtT', '.t....t....t.'], at: 'head', x: 19, y: 9 },
    ],
    mark: {
      name: 'crossed-bones',
      grid: [
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'abbbbbbbbTT........TTbbbbbba',
        'abbbbbbbbbTT......TTbbbbbbba',
        'abbbbbbbbbbTTT..TTTbbbbbbbba',
        'abbbbbbbbbbbbTTTTbbbbbbbbbba',
        'abbbbbbbbbbTTT..TTTbbbbbbbba',
        'abbbbbbbbbTT......TTbbbbbbba',
        'abbbbbbbbTT........TTbbbbbba',
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ].map((r) => r.replace(/\./g, 'b')),
      at: 'head',
      x: 12,
      y: 47,
    },
    hoops: { name: 'twine', grid: ['b.a.b.a.b.a.b.a.b.a.b.a.b', '.........................', ...Array(13).fill('.........................'), 'a.b.a.b.a.b.a.b.a.b.a.b.a'], at: 'head', x: 13, y: 43, ink: false },
    sides: lugs('hanging-bone', ['.TT', 'TtT', '.T.', '.T.', '.T.', 'TtT', '.TT'], 30),
    bands: { light: 'a', dark: 'b', hi: 't' },
  }
}

// ─────────────────────────────────────────────────────────────── DELVE ──
// Ironvein's road: miners in riveted iron. The tell: a dark iron dome with a
// bright lamp on its brow; picks for torches; ore heaped in the basket; the
// keg is riveted iron under a valve wheel.

const DELVE_LAMP = ['..TTT..', '.TyyyT.', 'TyWWWyT', 'TyWWWyT', 'TyWWWyT', '.TyyyT.', '..TTT..']
const DELVE_HELM = overlay(
  [
    '...........1111111.........',
    '.........11333333311.......',
    '.......113344443333211.....',
    '......13344443333333221....',
    '.....1334433333333332221...',
    '....133443333333333322221..',
    '....1333333333333333222211.',
    '...13333333333333332222221.',
    '...1t3333t3333t3333t222t21.',
    '..122222222222222222222221.',
    '.1111111111111111111111111.',
  ],
  DELVE_LAMP,
  21,
  2,
)

function delve(): Kit {
  const hat: Part = { name: 'lamp-helm', grid: DELVE_HELM, at: 'head', x: 66, y: 4 }
  const twin = overlay(
    overlay(
      [
        '...........11B11...........',
        '..........11bBb11..........',
        '.........11133311..........',
        '.......113344443311........',
        '......13344443333321.......',
        '.....1334433333333221......',
        '....133443333333333221.....',
        '....1333333333333332221....',
        '...13333333333333332222....',
        '...1t3333t3333t3333t222....',
        '..122222222222222222222....',
        '.1111111111111111111111....',
      ],
      DELVE_LAMP,
      20,
      3,
    ),
    ['.TTT.', 'TyWyT', 'TyWyT', '.TTT.'],
    8,
    3,
  )
  const greatHelm = overlay(
    [
      '..........1.......1.........',
      '.........141.....141........',
      '.........1441...1441........',
      '..........14411144111.......',
      '.........1133333333311......',
      '.......113344443333322111...',
      '......13344443333333322221..',
      '.....1334433333333333322221.',
      '....13344333333333333332222.',
      '....13333333333333333332222.',
      '...1t333t333t333t333t332222.',
      '...13333333333333333332222..',
      '..1222222222222222222222221.',
      '.1t1t1t1t1t1t1t1t1t1t1t1t11.',
      '.111111111111111111111111111',
    ],
    DELVE_LAMP,
    21,
    6,
  )
  const pad = ['....111111111..', '..1133333333311', '.1334t333t33321', '133333333333221', '.1222222222221.']
  const lantern = ['.BBB.', '.B.B.', 'BTTTB', 'TyWyT', 'TyWyT', 'BTyTB', '.BBB.']
  const mail = [
    '..3333333....',
    '.343434343...',
    '.4343434343..',
    '434343434343.',
    '343434343434.',
    '434343434343.',
    '3434343434343',
    '4343434343434',
    '3434343434343',
    '4343434343434',
    '3434343434343',
    '434343434343.',
    '34343434343..',
    '4343434343...',
    '343434343....',
    '43434343.....',
    '3434343......',
  ]
  const ironFlag = ['11111111', '13333331', '13t33t31', '13333331', '1t3333t1', '13333331', '.133331.', '..1331..', '...11...']
  const valve = ['....111....', '..1133311..', '.13.1.1.31.', '.1.13431.1.', '131344431 1'.replace(' ', '3'), '.1.13431.1.', '.13.1.1.31.', '..1133311..', '....111....', '.....3.....', '....222....', '..1222221..', '.122222221.', '.1t2t2t2t1.']
  return {
    weapon: {
      name: 'pick',
      grid: [
        '11...................11',
        '341.................143',
        '.3441.............1443.',
        '..34433.........33443..',
        '...334443333333444433..',
        '.....3333bbBbb3333.....',
        '.........bBBBb.........',
        '.........bbBbb.........',
        '..........bBb..........',
        '..........bBb..........',
      ],
      at: 'tip',
      x: -11,
      y: -9,
    },
    hat,
    hatBig: { name: 'twin-lamp-helm', grid: twin, at: 'head', x: 66, y: 3 },
    crown: { name: 'great-helm', grid: greatHelm, at: 'head', x: 64, y: 0 },
    pad: { name: 'riveted-pauldron', grid: pad, ...PAD_AT },
    back: { name: 'lantern-pole', grid: pole(lantern, 1, 46), at: 'head', x: 56, y: -4, layer: 'under' },
    mantle: { name: 'mail-mantle', grid: mail, at: 'head', x: 50, y: 30, layer: 'under' },
    tntHat: onTnt(hat),
    tntHatBig: onTnt({ name: 'twin-lamp-helm', grid: twin, at: 'head', x: 66, y: 3 }),
    tntCrown: onTnt({ name: 'great-helm', grid: greatHelm, at: 'head', x: 64, y: 0 }),
    tntPad: { name: 'riveted-pauldron', grid: pad, ...TNT_PAD_AT },
    tntBack: { name: 'lantern-pole', grid: pole(lantern, 1, 34), at: 'head', x: 3, y: -6, layer: 'under' },
    tntStandard: { name: 'iron-standard', grid: banner(overlay(mail.slice(0, 12), ironFlag, 2, 1), 42), at: 'head', x: 0, y: -16, layer: 'under' },
    pack: {
      name: 'ore-heap',
      grid: [
        '.......3344....4433........',
        '....33344443..34444333.....',
        '...3444q43333344qq44433....',
        '..33444qq44333444q444433...',
        '.334444444433344444444433..',
        '.3444434444443444443444433.',
        '33443334444333444333444433.',
        '34433333443333333334443333.',
      ],
      at: 'head',
      x: 2,
      y: 26,
      layer: 'under',
    },
    bomb: [
      { name: 'blast-charge', grid: ['.BBBB..', '133331.', '143331.', '1t33t1.', '133331.', '143331.', '1t33t1.', '133331.'], at: 'hand', x: -4, y: -4 },
      { name: 'charge-spark', grid: ['.y.y', '..W.', '.yWy', '..e.'], at: 'hand', x: -3, y: -8, ink: false },
    ],
    cap: { name: 'valve-wheel', grid: valve, at: 'head', x: 21, y: 4 },
    capBig: [
      { name: 'valve-wheel', grid: valve, at: 'head', x: 21, y: 4 },
      { name: 'cap-lamp', grid: ['.TTT.', 'TyWyT', 'TyWyT', '.TTT.'], at: 'head', x: 32, y: 12 },
    ],
    bossCap: {
      name: 'crucible-crown',
      grid: ['1.....1.....1.....1', '41...141...141...14', '441.14441.14441.144', '.1333333333333333 1'.replace(' ', '3'), '.1t3t3t3t3t3t3t3t1.', '.12222222222222221.', '..1eeyyyyyyyyyee1..', '...1eeeeeeeeeee1...'],
      at: 'head',
      x: 16,
      y: 8,
    },
    mark: {
      name: 'rivet-plate',
      grid: [
        '1222222222222222222222222221',
        '2t333333333333333333333333t2',
        '2333333334444444433333333332',
        '2333333344111111443333333332',
        '2333333341......143333333332',
        '2333333344111111443333333332',
        '2t333333333333333333333333t2',
        '1222222222222222222222222221',
      ],
      at: 'head',
      x: 12,
      y: 48,
    },
    hoops: { name: 'rivets', grid: ['4.4.4.4.4.4.4.4.4.4.4.4.4', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '4.4.4.4.4.4.4.4.4.4.4.4.4'], at: 'head', x: 13, y: 43, ink: false },
    sides: lugs('side-plate', ['1222', '23331', '2t331', '23331', '2t331', '23331', '2t331', '1222'], 29),
    bands: { light: '3', dark: '2', hi: '4' },
  }
}

// ──────────────────────────────────────────────────────────── SILKCUT ──
// Rosethread's road: thread-and-silk cutthroats. The tell: a wide flat brim
// far past the head, a rose on its band; long needle blades; spools in the
// basket; the keg is a reel between two wooden flanges.

const BRIM = [
  '..............111111111..............',
  '.............1VVVVVVVVV1.............',
  '.............1VVVVVVVVV1.............',
  '.............1VVVVVVVVV1.............',
  '.............1LLLLLPPLL1.............',
  '.............1LLLLPpPPL1.............',
  '...1111111111VVVVVPPPGVV1111111111...',
  '.11llllllllllVVVVVVVGVVVllllllllllll11',
  '1lVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVl1',
  '.1111111111111111111111111111111111111',
]

function silkcut(): Kit {
  const plume = overlay(
    ['', '', '', '', '', '', ...BRIM],
    ['............WW', '..........WWlW', '........WWllW.', '......WWllW...', '.....WllWW....', '....WlW.......', '...WlW........', '...lW.........'],
    6,
    0,
  )
  const roseCrown = sym([
    '......PP.......',
    '.....PpPP......',
    '..PP.PPPP...PP.',
    '.PpPPGPPG..PpPP',
    '.PPPP.GG...PPPP',
    '..PPG..G....GPP',
    '...G...G.....G.',
    '.1111111111111',
    '.1LPLPLPLPLPLP',
    '.1111111111111',
  ])
  const bow = ['ll.........ll', 'lll.......lll', 'lWlllPPllllWl', 'lllllPPPlllll', 'lll...P...lll', 'll....P....ll', '......PP.....']
  const pennant = ['lllllllllllll', 'lWWWWWWWWWWll', 'lllllllll....', 'lWWWWWWl.....', 'lllllllll....', 'lWWWWWWWWWWll', 'lllllllllllll']
  const train = [
    '..lllllll....',
    '.llWlllllll..',
    '.llWlllllPll.',
    'lllWlllllPll.',
    'lllWllllPlll.',
    'llWllllPlllll',
    'llWlllPllllll',
    'lWllllPllllll',
    'lWlllPlllllll',
    'lWlllPlllllll',
    'Wllllllllllll',
    'WlllPllllllll',
    'lllPllllllll.',
    'llPllllllll..',
    'lPllllllll...',
    'Pllllll......',
    'llllll.......',
  ]
  const needle = [
    '...W...',
    '..444..',
    '..4.4..',
    '..444..',
    '.P444..',
    '..44sP.',
    '.P444..',
    '..44sP.',
    '..444..',
    '..44s..',
    '..444..',
    '..44s..',
    '..444..',
    '..44s..',
    '..444..',
    '..44s..',
    '..444..',
    'PP444PP',
    'PPPlPPP',
    '...b...',
    '...B...',
  ]
  const spool = ['bbbbbbb', '.ppppp.', '.PPPPm.', '.mmmmm.', '.ppppm.', '.PPPPm.', 'bbbbbbb']
  const flange = disc(50, 9, 3, 'b', 't', 'B', 'B', 'B')
  const flangeLow = disc(56, 8, 3, 'b', 't', 'B', 'B', 'B')
  const bottomFlange: Part = { name: 'bottom-flange', grid: flangeLow, at: 'head', x: -2, y: 60, layer: 'under' }
  const peg = ['...P...', '..PpP..', '...b...', '...b...', '..bbb..', '.bbbbb.']
  return {
    weapon: { name: 'needle-blade', grid: needle, at: 'tip', x: -3, y: -19 },
    hat: { name: 'wide-brim', grid: BRIM, at: 'head', x: 60, y: 5 },
    hatBig: { name: 'plumed-brim', grid: plume, at: 'head', x: 60, y: -1 },
    crown: { name: 'rose-crown', grid: roseCrown, at: 'head', x: 64, y: 4 },
    pad: { name: 'ribbon-bow', grid: bow, ...PAD_AT },
    back: { name: 'swallowtail-pennant', grid: banner(pennant, 46), at: 'head', x: 56, y: -8, layer: 'under' },
    mantle: { name: 'silk-train', grid: train, at: 'head', x: 50, y: 30, layer: 'under' },
    tntHat: onTnt({ name: 'wide-brim', grid: BRIM, at: 'head', x: 60, y: 5 }),
    tntHatBig: onTnt({ name: 'plumed-brim', grid: plume, at: 'head', x: 60, y: -1 }),
    tntCrown: onTnt({ name: 'rose-crown', grid: roseCrown, at: 'head', x: 64, y: 4 }),
    tntPad: { name: 'ribbon-bow', grid: bow, ...TNT_PAD_AT },
    tntBack: { name: 'swallowtail-pennant', grid: banner(pennant, 34), at: 'head', x: 3, y: -8, layer: 'under' },
    tntStandard: { name: 'silk-standard', grid: banner(train.slice(0, 13), 42), at: 'head', x: 0, y: -16, layer: 'under' },
    pack: { name: 'spools', grid: overlay(overlay(overlay(['', ''], spool, 0, 4), spool, 8, 0), spool, 16, 5), at: 'head', x: 3, y: 20, layer: 'under' },
    bomb: [
      { name: 'thread-ball', grid: ['..pppp..', '.pPPPPm.', 'pPPmmPPm', 'PPmPPmPm', 'PmPPmPPm', '.mPPPmm.', '..mmmm..'], at: 'hand', x: -4, y: -2 },
      { name: 'ball-needle', grid: ['....4', '...4.', '..W..'], at: 'hand', x: 1, y: -5 },
    ],
    cap: [
      { name: 'top-flange', grid: flange, at: 'head', x: 1, y: 13 },
      bottomFlange,
      { name: 'spindle-peg', grid: peg, at: 'head', x: 23, y: 9 },
    ],
    capBig: [
      { name: 'top-flange', grid: flange, at: 'head', x: 1, y: 13 },
      bottomFlange,
      { name: 'rose-peg', grid: ['.PPPP..', 'PPpPPP.', 'PpPPpP.', '.PPPPG.', '..PGG..', '...b...', '...b...', '..bbb..', '.bbbbb.'], at: 'head', x: 23, y: 6 },
    ],
    bossCap: [
      { name: 'top-flange', grid: flange, at: 'head', x: 1, y: 13 },
      bottomFlange,
      { name: 'rose-crown', grid: roseCrown.map((r) => r.slice(3, 26)), at: 'head', x: 14, y: 5 },
    ],
    mark: {
      name: 'thread-band',
      // Thread wound on the reel, in stripes with a lit top turn (round 1:
      // it was a pP checker — dither, which the pack never uses, and a moiré
      // at the field's half density).
      grid: ['mpppppppppppppppppppppppppm', 'mPPPPPPPPPPPPPPPPPPPPPPPPPm', 'mPPPPPPPPPPPPPPPPPPPPPPPPPm', 'mmmmmmmmmmmmmmmmmmmmmmmmmmm', 'mpppppppppppppppppppppppppm', 'mPPPPPPPPPPPPPPPPPPPPPPPPPm', 'mPPPPPPPPPPPPPPPPPPPPPPPPPm', 'mmmmmmmmmmmmmmmmmmmmmmmmmmm', 'MPPPPPPPPPPPPPPPPPPPPPPPPPM'],
      at: 'head',
      x: 12,
      y: 47,
      inkOver: false,
    },
    hoops: { name: 'needle-through', grid: ['4.................................', '.4444444444444444444444444444444W.', '4..................................'], at: 'head', x: 4, y: 51 },
    // Round 2: both flanges from tier 1 (the top one alone read as a hat
    // brim on a keg); tier 3's side piece is the thread's loose end, run
    // off the reel and trailing on the ground.
    sides: { name: 'loose-thread', grid: ['PP......', '.PP.....', '..P.....', '..PP....', '...P....', '...PP...', '....PP..', '.....PPP'], at: 'head', x: 49, y: 52, layer: 'under' },
    bands: { light: 'b', dark: 'B', hi: 't' },
  }
}

// ──────────────────────────────────────────────────────────── SPORECAP ──
// Greenvial's road (the `hexmoon` id, Oct 2026: it wore the old house's
// moon): hollow-dwellers who brew Greenvial's spoiled stock into rot. The
// tell: a huge spotted cap with glowing gills (a second cap at T4, a ring of
// toadstools at T5); a swinging spore censer; a moss pauldron; rot jars and a
// puffball to throw; the keg a verdigris vat foaming over, a window of
// bubbling rot, toadstools at its sides. Dreamy, patient, gleefully filthy.
function sporecap(): Kit {
  const cap = [
    '..........vvvvvvvv..........',
    '.......vvvvCCvvvvvvvv.......',
    '.....vvvvvCCCCvvvvvvvvv.....',
    '....vvCCvvvCCvvvvvCCvvvv....',
    '...vvCCCCvvvvvvvvCCCCvvvv...',
    '..vvvvCCvvvvvCCvvvvCCvvvVV..',
    '..vvvvvvvvvvCCCCvvvvvvvVVV..',
    '.vvvvvvvvvvvvCCvvvvvvvVVVVV.',
    '.VvvvvvvvvvvvvvvvvvvvVVVVVV.',
    'VVVVVVVVVVVVVVVVVVVVVVVVVVVV',
    '.hGhGhGhGhGhGhGhGhGhGhGhGhG.',
    '..h.h.h.h.h.h.h.h.h.h.h.h...',
  ]
  const small = ['..vvvv..', '.vCvvvv.', 'vvvvCvvV', 'VVVVVVVV', '.hGhGhG.', '...55...', '...55...']
  const doubleCap = overlay(['', '', '', '', '', '', '', ...cap], small, 12, 0)
  const toadstool = ['.vvv.', 'vCvvV', 'VVVVV', '.h5h.', '..5..']
  const ring = overlay(overlay(overlay(overlay(['', '', '', '', ''], toadstool, 0, 0), toadstool, 7, 0), toadstool, 14, 0), toadstool, 21, 0)
  const hat: Part = { name: 'spotted-cap', grid: cap, at: 'head', x: 63, y: 1 }
  const hatBig: Part = { name: 'double-cap', grid: doubleCap, at: 'head', x: 63, y: -6 }
  const crown: Part[] = [
    { name: 'toadstool-ring', grid: ring, at: 'head', x: 65, y: -4 },
    { name: 'crowned-cap', grid: cap, at: 'head', x: 63, y: 1 },
  ]
  const censer: Part[] = [
    { name: 'spore-censer', grid: ['...BB...', '..B..B..', '.333333.', '33h3h333', '3hhhhhh3', '33333333', '.3h3h33.', '..3333..', '...bb...', '...bb...'], at: 'tip', x: -4, y: -9 },
    { name: 'censer-spores', grid: ['.h...z.', 'h.h.z.z', '.h...z.', '...h...'], at: 'tip', x: -5, y: -15, ink: false },
  ]
  const moss = ['....GGGGGGG....', '..GGgGGGgGGG...', '.GgGGhGGGgGGG..', 'GGGgGGGGhGGGGG.', 'GhGGGgGGGGgGG..', '.G.G.G.G.G.G...']
  const cloak = ['..GGGGGGG....', '.GGgGGGGGG...', '.GGGGGhGGGG..', 'GGgGGGGGGGG..', 'GGGGGGGgGGGG.', 'GhGGGGGGGGGG.', 'GGGGgGGGhGGG.', 'GGGGGGGGGGGGG', 'GgGGGGhGGGGGG', 'GGGGGGGGGgGGG', 'GGhGGGGGGGGGG', 'GGGGGgGGGGGG.', 'gGgGgGgGgGgG.', '.g.g.g.g.g...']
  const jar = ['.bb.', 'cccc', 'czqc', 'cqqc', 'cqzc', 'cccc']
  const ooze = ['....gggggggggg....', '..gghhggggggghgg..', '.ghhgggGggggggggg.', 'gggggGgggggGggggg.', 'g.gg.G.ggg.g.gg.g.', 'g..g...g.g...g..g.', '...g.....g.......g', '.........g........']
  return {
    weapon: censer,
    hat,
    hatBig,
    crown,
    pad: { name: 'moss-pauldron', grid: moss, ...PAD_AT },
    back: { name: 'glow-cap-pole', grid: pole(small, 3, 40), at: 'head', x: 55, y: -6, layer: 'under' },
    mantle: { name: 'moss-cloak', grid: cloak, at: 'head', x: 50, y: 30, layer: 'under' },
    tntHat: onTnt(hat),
    tntHatBig: onTnt(hatBig),
    tntCrown: onTnt(crown),
    tntPad: { name: 'moss-pauldron', grid: moss, ...TNT_PAD_AT },
    tntBack: { name: 'glow-cap-pole', grid: pole(small, 3, 28), at: 'head', x: 2, y: -6, layer: 'under' },
    tntStandard: { name: 'moss-standard', grid: banner(cloak.slice(0, 12), 42), at: 'head', x: 0, y: -16, layer: 'under' },
    tntRecolor: [{ box: [33, 14, 64, 33], map: { '#f4e341': 'h', '#d9945f': 'g' } }],
    pack: { name: 'rot-jars', grid: overlay(overlay(overlay(['', ''], jar, 1, 4), jar, 7, 1), jar, 13, 5), at: 'head', x: 4, y: 22, layer: 'under' },
    bomb: [
      { name: 'puffball', grid: ['..5555..', '.5TT555.', '5T55t555', '5555555t', '55t5555t', '.555t5t.', '..tttt..'], at: 'hand', x: -4, y: -3 },
      { name: 'puff-spores', grid: ['h.z', '.h.', 'z.h'], at: 'hand', x: -1, y: -7, ink: false },
    ],
    cap: { name: 'rot-ooze', grid: ooze, at: 'head', x: 17, y: 14, ink: false },
    capBig: [
      { name: 'rot-ooze', grid: ooze, at: 'head', x: 17, y: 14, ink: false },
      { name: 'vat-toadstool', grid: ['..vvvv..', '.vCvvvv.', 'vvvvCvvV', 'VVVVVVVV', '...55...', '...55...'], at: 'head', x: 22, y: 7 },
    ],
    bossCap: [
      { name: 'rot-ooze', grid: ooze, at: 'head', x: 17, y: 14, ink: false },
      { name: 'vat-toadstools', grid: ring.map((r) => r.slice(0, 19)), at: 'head', x: 17, y: 8 },
    ],
    mark: {
      name: 'rot-window',
      grid: [
        '1111111111111111111111111111',
        '1cccccccccccccccccccccccccc1',
        '1cqqqqzqqqqqhqqqqqzqqqqqqc1.',
        '1cqzqqqqqhqqqqqzqqqqqhqqqc1.',
        '1cqqqhqqqqqqzqqqqqqqqqqzqc1.',
        '1cqqqqqqzqqqqqqqhqqqzqqqqc1.',
        '1cqhqqqqqqqqqqqqqqqqqqhqqc1.',
        '1cccccccccccccccccccccccccc1',
        '1111111111111111111111111111',
      ],
      at: 'head',
      x: 12,
      y: 47,
    },
    hoops: { name: 'moss-patches', grid: ['GG.....Gg.......GG....gG.', '.G......G........G.....G.', ...Array(12).fill('.........................'), 'gG......GG.....Gg.....GG.', '.G.......G......G......G.'], at: 'head', x: 13, y: 42, ink: false },
    sides: lugs('side-toadstool', ['.vvv', 'vCvvV', 'VVVVV', '..55.', '..55.'], 30),
    bands: { light: 'z', dark: 'u', hi: 'C' },
  }
}

const KITS: Readonly<Record<ClanId, () => Kit>> = { cinder, smudge: gnawbone, delve, silkcut, hexmoon: sporecap }
const kitCache = new Map<ClanId, Kit>()
function kitOf(clan: ClanId): Kit {
  const hit = kitCache.get(clan)
  if (hit) return hit
  const k = KITS[clan]()
  kitCache.set(clan, k)
  return k
}

/** Every part a clan's kit holds (the asset inventory lists them). */
export function kitParts(clan: ClanId): Part[] {
  const k = kitOf(clan)
  return all(...Object.entries(k).filter(([n]) => n !== 'bands' && n !== 'tntRecolor').map(([, v]) => v as P))
}

/** What clan × faction × tier is baked from: the cuts, the keg's hoop colours, and the parts in paint order. */
export function recipeFor(clan: ClanId, faction: Faction, tier: number): Recipe {
  return recipeFromKit(kitOf(clan), faction, tier)
}

/** The ladder over any kit. */
export function recipeFromKit(k: Kit, faction: Faction, tier: number): Recipe {
  if (faction === 'torch') {
    const head = tier >= 5 ? k.crown : tier >= 4 ? k.hatBig : k.hat
    return {
      cuts: k.weapon ? ['flame'] : [],
      parts: all(tier >= 5 && k.mantle, tier >= 3 && k.back, k.weapon, k.face, head, tier >= 2 && k.pad),
    }
  }
  if (faction === 'tnt') {
    const head = tier >= 5 ? k.tntCrown : tier >= 4 ? k.tntHatBig : k.tntHat
    return {
      cuts: ['sticks', 'stick'],
      parts: all(tier >= 5 ? k.tntStandard : tier >= 3 && k.tntBack, k.pack, k.bomb, k.tntFace, head, tier >= 2 && k.tntPad),
      recolor: k.tntRecolor,
    }
  }
  const top = tier >= 5 ? k.bossCap : tier >= 4 ? k.capBig : k.cap
  return { cuts: ['fuse'], bands: k.bands, parts: all(tier >= 3 && k.sides, k.mark, tier >= 2 && k.hoops, top) }
}
