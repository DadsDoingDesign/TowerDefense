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
  /** The keg's hoop colours (palette letters), replacing the plain keg's cream. */
  bands?: { light: string; dark: string }
}

// ── helpers ─────────────────────────────────────────────────────────────────
/** Mirror each half-row about its last column (odd widths: the centre column is the last char). */
const sym = (half: readonly string[]): string[] => half.map((r) => r + [...r.slice(0, -1)].reverse().join(''))

/** A pole `len` px long under `top` (its wood two px wide at column `col`). */
function pole(top: readonly string[], col: number, len: number, wood = 'b'): string[] {
  const w = Math.max(...top.map((r) => r.length), col + 2)
  const rows = top.map((r) => r.padEnd(w, '.'))
  for (let i = 0; i < len; i++) rows.push('.'.repeat(col) + wood + 'B' + '.'.repeat(Math.max(0, w - col - 2)))
  return rows
}

/** Paint `top` onto a copy of `base` at (x, y) — '.' in `top` keeps `base`. */
function overlay(base: readonly string[], top: readonly string[], x: number, y: number): string[] {
  const w = Math.max(1, ...base.map((r) => r.length), ...top.map((r) => r.length + x))
  const rows = base.map((r) => r.padEnd(w, '.').split(''))
  while (rows.length < y + top.length) rows.push('.'.repeat(w).split(''))
  top.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r[i] !== '.') rows[y + j][x + i] = r[i]
  })
  return rows.map((r) => r.join(''))
}

/** One part, or several laid together (a crest's flames over its band). */
type P = Part | readonly Part[]
const all = (...ps: (P | null | undefined | false)[]): Part[] => ps.flatMap((p) => (!p ? [] : Array.isArray(p) ? [...p] : [p as Part]))

/** One clan's kit: every part the ladder can call for. */
interface Kit {
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
  bands: { light: string; dark: string }
}

/** A torch head part moved onto the bomber's head (its crown sits 36 px left, 2 px lower). */
const onTnt = (p: P, dx = -36, dy = 2): P =>
  Array.isArray(p) ? p.map((q) => onTnt(q, dx, dy) as Part) : { ...(p as Part), name: `tnt-${(p as Part).name}`, x: (p as Part).x + dx, y: (p as Part).y + dy }

/** A banner: a pole with a cloth hung to its right at the top. */
const banner = (cloth: readonly string[], len: number): string[] => pole(overlay(['BB'], cloth, 2, 1), 0, len)

// ─────────────────────────────────────────────────────────────── CINDER ──
// Peppercorn's road: ember-and-spice raiders. The tell: a crest of live flame
// over a soot-iron band, leaning back as they run; the torch burns on;
// firepots for bombs; the keg wears soot hoops and grows a chilli's stem.

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
  const crest: Part[] = [
    { name: 'crest-flames', grid: FLAMES, at: 'head', x: 66, y: -3, ink: false },
    { name: 'soot-band', grid: SOOT_BAND, at: 'head', x: 66, y: 10 },
  ]
  const crestBig: Part[] = [
    { name: 'tall-crest-flames', grid: FLAMES_TALL, at: 'head', x: 66, y: -13, ink: false },
    { name: 'soot-band', grid: SOOT_BAND, at: 'head', x: 66, y: 10 },
  ]
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
  const mantle = [
    '..1111111....',
    '.12222222....',
    '.122222221...',
    '1222222221...',
    '12222222221..',
    '12222222221..',
    '122222222221.',
    '122222222221.',
    '1222222222221',
    '1222222222221',
    '1222222222221',
    '122222222222R',
    '12222222222rR',
    '1222222222eR.',
    '122R22R2rR...',
    '1RrRRrRrR....',
    '.ReRrRe......',
  ]
  const pot = ['.oEEEo.', 'oEEaEEo', 'oEaEEEo', 'oEEEEao', '.oEEEo.']
  const potFlame = ['..e..', '.eye.', '.eyye', 'eyWye', 'eyyye', '.eee.']
  return {
    weapon: null,
    hat: crest,
    hatBig: crestBig,
    crown,
    pad: { name: 'soot-pauldron', grid: pad, at: 'head', x: 79, y: 28 },
    back: { name: 'chilli-banner', grid: banner(chilliFlag, 52), at: 'head', x: 56, y: -14, layer: 'under' },
    mantle: { name: 'ember-mantle', grid: mantle, at: 'head', x: 50, y: 30, layer: 'under' },
    tntHat: onTnt(crest),
    tntHatBig: onTnt(crestBig),
    tntCrown: onTnt(crown),
    tntPad: { name: 'soot-pauldron', grid: pad, at: 'head', x: 44, y: 33 },
    tntBack: { name: 'chilli-banner', grid: banner(chilliFlag, 30), at: 'head', x: 3, y: -14, layer: 'under' },
    tntStandard: { name: 'ember-standard', grid: banner(overlay(mantle.slice(0, 12), chilliFlag, 1, 1), 34), at: 'head', x: 0, y: -16, layer: 'under' },
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
      name: 'flame-mark',
      grid: [
        '1111111111111111111111111111',
        '1222222222222e22222222222221',
        '122222222222eye2222222222221',
        '12222222222eyye2222222222221',
        '1222222222eyWye2222222222221',
        '1222222222eyWyye222222222221',
        '12222222222eyye2222222222221',
        '122222222222ee22222222222221',
        '1111111111111111111111111111',
      ],
      at: 'head',
      x: 12,
      y: 47,
    },
    hoops: { name: 'ember-studs', grid: ['r..e..r..e..r..e..r..e..r', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', 'r..e..r..e..r..e..r..e..r'], at: 'head', x: 13, y: 43, ink: false },
    sides: {
      name: 'flame-fins',
      grid: [
        '1........................................................1',
        '21......................................................12',
        '221....................................................122',
        '2r21..................................................12r2',
        '2er21................................................12re2',
        '2rer21..............................................12rer2',
        '2er21................................................12re2',
        '2r21..................................................12r2',
        '221....................................................122',
        '21......................................................12',
      ],
      at: 'head',
      x: -3,
      y: 24,
      layer: 'under',
    },
    bands: { light: '2', dark: '1' },
  }
}

// ────────────────────────────────────────────────────────────── SMUDGE ──
// Easel House's road: paint-splattered scavengers. The tell: an upturned paint
// bucket for a helmet, dripping colour down the hood; brushes for weapons;
// paint tubes in the basket; the keg is a paint tin under a tall wire bail.

const BUCKET = [
  '....11111111111111111111....',
  '...1444444444444444444441...',
  '...1455555555555555544431...',
  '...1454444444444444444331...',
  '..14544444444444444443331...',
  '..14544444444444444443331...',
  '..14444444444444444443331...',
  '..14444444444444444443331...',
  '.1444444444444444444433331..',
  '.1444444444444444444433331..',
  '.1333333333333333333333331..',
  '1uuuu333PPPP333yyyy33qqqq31.',
  '1uuuu333PPPP333yyyy33qqqq31.',
  '.uu......PP.....yy....qq....',
  '.uu......PP.....yy....qq....',
  '..........P.....yy..........',
  '................y...........',
]

function smudge(): Kit {
  const bucket: Part[] = [
    { name: 'bucket-helm', grid: BUCKET.slice(0, 13), at: 'head', x: 65, y: 1 },
    { name: 'bucket-drips', grid: BUCKET.slice(13), at: 'head', x: 65, y: 14, ink: false },
    { name: 'bucket-bail', grid: ['B..........................B', 'B..........................B', '.B........................B.', '..BB....................BB..', '....BBBBBBBBBBBBBBBBBBBB....'], at: 'head', x: 65, y: 9, ink: false },
  ]
  const top = ['.....111111111111.....', '....14444444444441....', '....14555555554441....', '....14444444444331....', '....13333333333331....', '....1PP33uu33yy331....']
  const stack: Part[] = [{ name: 'top-bucket', grid: top, at: 'head', x: 68, y: -5 }, ...bucket]
  const crown: Part[] = [
    {
      name: 'brush-crown',
      grid: [
        '..PP......uu......yy......qq..',
        '.PPPP....uuuu....yyyy....qqqq.',
        '.PPPP....uuuu....yyyy....qqqq.',
        '.tttt....tttt....tttt....tttt.',
        '.4444....4444....4444....4444.',
        '.4344....4344....4344....4344.',
        '..bb......bb......bb......bb..',
        '..bb......bb......bb......bb..',
        '..bb......bb......bb......bb..',
        '111111111111111111111111111111',
        '1tPttttuttttyttttqttttPttttut1',
        '111111111111111111111111111111',
      ],
      at: 'head',
      x: 64,
      y: 2,
    },
  ]
  const palette = ['....ttttttt....', '..ttttttttttt..', '.ttPPtttuuttbt.', 'tttPPtt.uuttbbt', 'tttttt...ttbbt.', '.ttyytqqtttbt..', '...tttttttt....']
  const canvas = ['WWWWWWWWWWW', 'W555555555W', 'W5PP5555u5W', 'W5PPP55uu5W', 'W555y55u55W', 'W55yyy5555W', 'W55555q555W', 'WWWWWWWWWWW', '.B.......B.']
  const smock = [
    '..5555555....',
    '.555555555...',
    '.5u55555P5...',
    '5555555555...',
    '55555y555555.',
    '5P5555555u55.',
    '555555555555.',
    '55q5555P55555',
    '5555555555555',
    '555u55y555555',
    '5555555555P55',
    '5y555555q5555',
    '555555555555.',
    '55P55u55555..',
    '5555555555...',
    '555555y5.....',
    '.5.5.5.......',
  ]
  const brush = ['.PPPPPPP.', 'PPPPPPPPP', 'PPPPPPPPP', 'PtPtPtPtP', 'ttttttttt', 'ttttttttt', 'ttttttttt', '.4444444.', '.4343434.', '.4444444.', '...bbb...', '...bBb...', '...bBb...']
  const tubes = [
    '..44.....44........44.....',
    '.4PP4...4uu4......4yy4....',
    '.4PP4...4uu4..44..4yy4....',
    '.4PP4...4uu4.4qq4.4yy4.44.',
    '.4PP4...4uu4.4qq4.4yy44vv4',
    '.4PP4..4uuu4.4qq4.4yy44vv4',
    '.4PP44.4uu4..4qq4.4yy4.4vv4',
    '4PPP4..4uu4..4qq4.4yy4.4vv4',
    '4PP4...4uu4.4qqq4.4yy4.4vv4',
    '4PP4...4uu4.4qq4..4yy4.4vv4',
  ]
  const bail = [
    '..........BBBBBBBBBBBBBBBBBBBBBBBB..........',
    '.......BBB........................BBB.......',
    '.....BB..............................BB.....',
    '....B..................................B....',
    '...B....................................B...',
    '..B......................................B..',
    '..B......................................B..',
    '.B........................................B.',
    '.B........................................B.',
    '.B........................................B.',
    'B..........................................B',
    'B..........................................B',
    'B..........................................B',
    '4..........................................4',
    '3..........................................3',
  ]
  return {
    weapon: { name: 'paintbrush', grid: brush, at: 'tip', x: -4, y: -12 },
    hat: bucket,
    hatBig: stack,
    crown,
    pad: { name: 'palette-pauldron', grid: palette, at: 'head', x: 79, y: 28 },
    back: { name: 'canvas-flag', grid: banner(canvas, 52), at: 'head', x: 56, y: -14, layer: 'under' },
    mantle: { name: 'splattered-smock', grid: smock, at: 'head', x: 50, y: 30, layer: 'under' },
    tntHat: onTnt(bucket),
    tntHatBig: onTnt(stack),
    tntCrown: onTnt(crown),
    tntPad: { name: 'palette-pauldron', grid: palette, at: 'head', x: 44, y: 33 },
    tntBack: { name: 'canvas-flag', grid: banner(canvas, 30), at: 'head', x: 3, y: -14, layer: 'under' },
    tntStandard: { name: 'easel-standard', grid: banner(overlay(smock.slice(0, 12), canvas, 1, 1), 34), at: 'head', x: 0, y: -16, layer: 'under' },
    pack: { name: 'paint-tubes', grid: tubes, at: 'head', x: 3, y: 22, layer: 'under' },
    bomb: { name: 'paint-bomb', grid: ['...bb...', '...tt...', '..4PP4..', '.4PPPP4.', '4PPWPPP4', '4PPPPPP4', '4PPPPPP4', '.4PPPP4.', '..4444..', '...P....', '...P....'], at: 'hand', x: -4, y: -9 },
    cap: [
      { name: 'wire-bail', grid: bail, at: 'head', x: 4, y: 3, ink: false },
      { name: 'tin-lid-knob', grid: ['..444..', '.43334.', '4333334'], at: 'head', x: 22, y: 15 },
    ],
    capBig: [
      { name: 'wire-bail', grid: bail, at: 'head', x: 4, y: 3, ink: false },
      { name: 'brush-in-tin', grid: ['..PPP..', '.PPPPP.', '.PtPtP.', '..ttt..', '..444..', '..bbb..', '..bbb..', '..bbb..', '.43334.', '4333334'], at: 'head', x: 22, y: 8 },
    ],
    bossCap: [
      { name: 'wire-bail', grid: bail, at: 'head', x: 4, y: 3, ink: false },
      {
        name: 'brush-crown',
        grid: ['.PP...uu...yy...qq.', 'PPPP.uuuu.yyyy.qqqq', 'tttt.tttt.tttt.tttt', '4444.4444.4444.4444', '.bb...bb...bb...bb.', '1111111111111111111', '1tPttuttyttqttPttt1', '1111111111111111111'],
        at: 'head',
        x: 16,
        y: 6,
      },
    ],
    mark: {
      name: 'paint-splotch',
      grid: [
        '.....PPPP......uuu.......',
        '...PPPPPPPP..uuuuuu......',
        '..PPPPPWPPPPuuuWuuuuu....',
        '.PPPPPPPPPPPuuuuuuuuuyy..',
        'PPPPPPPPPPyyyyuuuuuyyyyy.',
        '.PPPPPPPPyyyyyyyyyyyyWyyy',
        '..PPPPPPqqqqyyyyyyyyyyyy.',
        '...PPP.qqqqqqqyyyyyyyy...',
        '.......qqqqqqqq..yyyy....',
        '........qqqqq............',
      ],
      at: 'head',
      x: 13,
      y: 46,
      inkOver: false,
    },
    hoops: {
      name: 'paint-drips',
      grid: ['PP...uu....yy...qq...PP..', 'PP...uu....yy...qq...PP..', 'PP...uu....yy...qq...PP..', '.P...uu....yy....q...PP..', '.P....u....yy....q....P..', '......u.....y.........P..', '............y............'],
      at: 'head',
      x: 13,
      y: 58,
      ink: false,
    },
    sides: {
      name: 'brush-handles',
      grid: [
        'PP......................................................uu',
        'PP......................................................uu',
        'Pt......................................................tu',
        'tt......................................................tt',
        '44......................................................44',
        'bb......................................................bb',
        'bb......................................................bb',
        'bb......................................................bb',
        'bb......................................................bb',
      ],
      at: 'head',
      x: -3,
      y: 26,
      layer: 'under',
    },
    bands: { light: '4', dark: '3' },
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
    pad: { name: 'riveted-pauldron', grid: pad, at: 'head', x: 79, y: 28 },
    back: { name: 'lantern-pole', grid: pole(lantern, 1, 52), at: 'head', x: 56, y: -10, layer: 'under' },
    mantle: { name: 'mail-mantle', grid: mail, at: 'head', x: 50, y: 30, layer: 'under' },
    tntHat: onTnt(hat),
    tntHatBig: onTnt({ name: 'twin-lamp-helm', grid: twin, at: 'head', x: 66, y: 3 }),
    tntCrown: onTnt({ name: 'great-helm', grid: greatHelm, at: 'head', x: 64, y: 0 }),
    tntPad: { name: 'riveted-pauldron', grid: pad, at: 'head', x: 44, y: 34 },
    tntBack: { name: 'lantern-pole', grid: pole(lantern, 1, 32), at: 'head', x: 3, y: -12, layer: 'under' },
    tntStandard: { name: 'iron-standard', grid: banner(overlay(mail.slice(0, 12), ironFlag, 2, 1), 34), at: 'head', x: 0, y: -16, layer: 'under' },
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
    sides: {
      name: 'side-plates',
      grid: [
        '1222....................................................2221',
        '23331..................................................13332',
        '2t331..................................................133t2',
        '23331..................................................13332',
        '2t331..................................................133t2',
        '23331..................................................13332',
        '2t331..................................................133t2',
        '1222....................................................2221',
      ],
      at: 'head',
      x: -4,
      y: 28,
      layer: 'under',
    },
    bands: { light: '3', dark: '2' },
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
  '.11VVVVVVVVVVVVVVVVVVGVVVVVVVVVVVVV11',
  '1VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV1',
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
    '..W..',
    '.4.4.',
    '.4.4.',
    '..4..',
    '.P4..',
    '..4P.',
    '.P4..',
    '..4P.',
    '..4..',
    '..4..',
    '..4..',
    '..4..',
    '..4..',
    '..4..',
    '..4..',
    '..4..',
    '..4..',
    'P444P',
    'PPlPP',
    '..b..',
    '..B..',
  ]
  const spool = ['bbbbbbb', '.PpPPp.', '.pPPpP.', '.PpPPp.', '.pPPpP.', '.PpPPp.', 'bbbbbbb']
  const flange = [
    '.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.',
    'ttttttttttttttttttttttttttttttttttttttttttttttttttttttttt',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '.BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB.',
  ]
  const peg = ['...P...', '..PpP..', '...b...', '...b...', '..bbb..', '.bbbbb.']
  return {
    weapon: { name: 'needle-blade', grid: needle, at: 'tip', x: -2, y: -19 },
    hat: { name: 'wide-brim', grid: BRIM, at: 'head', x: 60, y: 5 },
    hatBig: { name: 'plumed-brim', grid: plume, at: 'head', x: 60, y: -1 },
    crown: { name: 'rose-crown', grid: roseCrown, at: 'head', x: 64, y: 4 },
    pad: { name: 'ribbon-bow', grid: bow, at: 'head', x: 80, y: 27 },
    back: { name: 'swallowtail-pennant', grid: banner(pennant, 52), at: 'head', x: 56, y: -14, layer: 'under' },
    mantle: { name: 'silk-train', grid: train, at: 'head', x: 50, y: 30, layer: 'under' },
    tntHat: onTnt({ name: 'wide-brim', grid: BRIM, at: 'head', x: 60, y: 5 }),
    tntHatBig: onTnt({ name: 'plumed-brim', grid: plume, at: 'head', x: 60, y: -1 }),
    tntCrown: onTnt({ name: 'rose-crown', grid: roseCrown, at: 'head', x: 64, y: 4 }),
    tntPad: { name: 'ribbon-bow', grid: bow, at: 'head', x: 44, y: 32 },
    tntBack: { name: 'swallowtail-pennant', grid: banner(pennant, 30), at: 'head', x: 3, y: -14, layer: 'under' },
    tntStandard: { name: 'silk-standard', grid: banner(train.slice(0, 13), 34), at: 'head', x: 0, y: -16, layer: 'under' },
    pack: { name: 'spools', grid: overlay(overlay(overlay(['', ''], spool, 0, 4), spool, 8, 0), spool, 16, 5), at: 'head', x: 3, y: 20, layer: 'under' },
    bomb: [
      { name: 'thread-ball', grid: ['..PPPP..', '.PpPPpP.', 'PPpPPpPP', 'PpPPpPPP', 'PPPpPPpP', '.PpPPpP.', '..PPPP..'], at: 'hand', x: -4, y: -4 },
      { name: 'ball-needle', grid: ['....4', '...4.', '..W..'], at: 'hand', x: 1, y: -7 },
    ],
    cap: [
      { name: 'top-flange', grid: flange, at: 'head', x: -3, y: 15 },
      { name: 'spindle-peg', grid: peg, at: 'head', x: 23, y: 9 },
    ],
    capBig: [
      { name: 'top-flange', grid: flange, at: 'head', x: -3, y: 15 },
      { name: 'rose-peg', grid: ['.PPPP..', 'PPpPPP.', 'PpPPpP.', '.PPPPG.', '..PGG..', '...b...', '...b...', '..bbb..', '.bbbbb.'], at: 'head', x: 23, y: 6 },
    ],
    bossCap: [
      { name: 'top-flange', grid: flange, at: 'head', x: -3, y: 15 },
      { name: 'rose-crown', grid: roseCrown.map((r) => r.slice(3, 26)), at: 'head', x: 14, y: 5 },
    ],
    mark: {
      name: 'thread-band',
      grid: [
        'pPpPpPpPpPpPpPpPpPpPpPpPpPpP',
        'PpPpPpPpPpPpPpPpPpPpPpPpPpPp',
        'pPpPpPpPpPpPpPpPpPpPpPpPpPpP',
        'PpPpPpPpPpPpPpPpPpPpPpPpPpPp',
        'pPpPpPpPpPpPpPpPpPpPpPpPpPpP',
        'PpPpPpPpPpPpPpPpPpPpPpPpPpPp',
        'pPpPpPpPpPpPpPpPpPpPpPpPpPpP',
        'PpPpPpPpPpPpPpPpPpPpPpPpPpPp',
        'pPpPpPpPpPpPpPpPpPpPpPpPpPpP',
      ],
      at: 'head',
      x: 12,
      y: 47,
      inkOver: false,
    },
    hoops: { name: 'needle-through', grid: ['4.................................', '.4444444444444444444444444444444W.', '4..................................'], at: 'head', x: 4, y: 51 },
    sides: { name: 'bottom-flange', grid: flange, at: 'head', x: -3, y: 61 },
    bands: { light: 'b', dark: 'B' },
  }
}

// ──────────────────────────────────────────────────────────── HEXMOON ──
// Moonquill's road: rune-masked moonlit hexers. The tell: pale crescent horns
// rising from the head and a pale moon mask; quill staves; scroll cases; the
// keg is a rune urn with silver hoops and a crescent lid.

function hexmoon(): Kit {
  const horns = sym([
    'CC...........',
    'CsC..........',
    '.CsC.........',
    '.CsC.........',
    '.CssC........',
    '..CsC........',
    '..CssC.......',
    '...CssC......',
    '...CsssC.....',
    '....CsssCCCCC',
    '.....CCssssss',
    '....nnnnnnnnn',
    '....nUcUcUcUc',
    '....nnnnnnnnn',
  ])
  const fullMoon = overlay(horns, ['.....CCCCC.....', '...CCsssssCC...', '..CssssWWsssC..', '..CsssWWWsssC..', '..CssssWssssC..', '...CCsssssCC...', '.....CCCCC.....'], 6, 0)
  const halo = sym([
    '.......CCCCCC',
    '....CCC......',
    '...C.........',
    '..C......c...',
    '.C...c.......',
    '.C...........',
    'C.....CC.....',
    'C.....CsC....',
    'C......CsC...',
    'C......CssC..',
    'C.......CssCC',
    'C........ssss',
    '.C.....nnnnnn',
    '.C.....nUcUcU',
    '..C....nnnnnn',
  ])
  const pad = ['...nnnnnnnnn...', '.nnUUUUUUUUUnn.', 'nUUUUcUUUcUUUUn', 'nUUUUUcccUUUUUn', 'nUUUUcUUUcUUUUn', '.nnnnnnnnnnnnn.']
  const scroll = ['TTTTTTTTT', 'tTTTTTTTt', '.T5c55T..', '.T55c5T..', '.Tc555T..', '.T5c55T..', '.T55c5T..', 'tTTTTTTTt', 'TTTTTTTTT']
  const stars = [
    '..nnnnnnn....',
    '.nUUUUUUUn...',
    '.nUUCUUUUUn..',
    'nUUUUUUUcUn..',
    'nUUUUUUUUUn..',
    'nUcUUUUCUUUn.',
    'nUUUUUUUUUUn.',
    'nUUUUUcUUUUUn',
    'nUUCUUUUUUUUn',
    'nUUUUUUUUcUUn',
    'nUUUUUUUUUUUn',
    'nUUUcUUUCUUn.',
    'nUUUUUUUUUn..',
    'nUCUUUUUcn...',
    'nUUUUUUUn....',
    'nUUUcUUn.....',
    '.nnnnn.......',
  ]
  const crescent = ['...CC......', '..CsC......', '.CsC.......', 'CssC.......', 'CsC........', 'CsC.....CC.', 'CssC...CsC.', '.CssCCCsC..', '..CsssC....', 'nnnnnnnnnn.', 'nUcUcUcUcn.']
  return {
    weapon: {
      name: 'quill-staff',
      grid: [
        '.......WW',
        '......WWs',
        '.....WWsW',
        '....WWsWW',
        '...WWsWW.',
        '...WsWW..',
        '..WWsW...',
        '..WsWW...',
        '.WWsW....',
        '.WsWW....',
        '.WsW.....',
        '.sWW.....',
        '.s.......',
        'cqc......',
        'qzq......',
        'cqc......',
        '.b.......',
        '.B.......',
      ],
      at: 'tip',
      x: -1,
      y: -17,
    },
    face: { name: 'moon-mask', grid: ['..CCCC..', '.CCCCCC.', 'CCccCccC', 'CCCCCCCC', 'CCCssCCC', '.CCCCCC.', '..CCCC..'], at: 'head', x: 86, y: 17 },
    hat: { name: 'crescent-horns', grid: horns, at: 'head', x: 66, y: 1 },
    hatBig: { name: 'full-moon-horns', grid: fullMoon, at: 'head', x: 66, y: 1 },
    crown: { name: 'moon-halo', grid: halo, at: 'head', x: 66, y: 0 },
    pad: { name: 'rune-pauldron', grid: pad, at: 'head', x: 79, y: 28 },
    back: { name: 'scroll-pole', grid: banner(scroll, 52), at: 'head', x: 56, y: -14, layer: 'under' },
    mantle: { name: 'star-mantle', grid: stars, at: 'head', x: 50, y: 30, layer: 'under' },
    tntHat: onTnt({ name: 'crescent-horns', grid: horns, at: 'head', x: 66, y: 1 }),
    tntHatBig: onTnt({ name: 'full-moon-horns', grid: fullMoon, at: 'head', x: 66, y: 1 }),
    tntCrown: onTnt({ name: 'moon-halo', grid: halo, at: 'head', x: 66, y: 0 }),
    tntPad: { name: 'rune-pauldron', grid: pad, at: 'head', x: 44, y: 34 },
    tntBack: { name: 'scroll-pole', grid: banner(scroll, 30), at: 'head', x: 3, y: -14, layer: 'under' },
    tntStandard: { name: 'star-standard', grid: banner(stars.slice(0, 13), 34), at: 'head', x: 0, y: -16, layer: 'under' },
    tntFace: {
      name: 'moon-mask',
      grid: ['..CCCCCCCCCCCCCCCCCCCC..', '.CCCCCCCCCCCCCCCCCCCCCC.', 'CCCnnnnCCCCCCCCnnnnCCCCC', 'CCnccccnCCCCCCnccccnCCCC', 'CCnccccnCCCCCCnccccnCCCC', 'CCCnnnnCCCssCCCnnnnCCCCC', '.CCCCCCCCCssCCCCCCCCCCC.', '..CCCCCCCCCCCCCCCCCCCC..', '....CCCCCCCCCCCCCCCC....'],
      at: 'head',
      x: 37,
      y: 18,
    },
    pack: {
      name: 'scroll-case',
      grid: [
        '..TT....TT.....TT.....',
        '.TttT..TttT...TttT....',
        '.TTTT..TTTT...TTTT....',
        '.TTTT..TTTT...TTTT....',
        '..TT....TT.....TT.....',
        'nnnnnnnnnnnnnnnnnnnn..',
        'nUUUUUUUUUUUUUUUUUUn..',
        'nUcUUUUcUUUUUUcUUUUn..',
        'nUUUUUUUUUUUUUUUUUUn..',
        'nnnnnnnnnnnnnnnnnnnn..',
      ],
      at: 'head',
      x: 4,
      y: 21,
      layer: 'under',
    },
    bomb: { name: 'hex-vial', grid: ['...bb...', '...44...', '..4cc4..', '.4cqqc4.', '4cqzqqc4', '4qqqzqq4', '4qqqqqq4', '.4qqqq4.', '..4444..'], at: 'hand', x: -4, y: -6 },
    cap: { name: 'crescent-lid', grid: crescent, at: 'head', x: 21, y: 8 },
    capBig: [
      { name: 'crescent-lid', grid: crescent, at: 'head', x: 21, y: 8 },
      { name: 'lid-star', grid: ['..W..', '.WWW.', 'WWsWW', '.WWW.', '..W..'], at: 'head', x: 28, y: 4 },
    ],
    bossCap: {
      name: 'full-moon-crown',
      grid: ['.....CCCCC.....', '...CCsssssCC...', '..CssssWWsssC..', '.CsssssWWWsssC.', '.CssssssWssssC.', '.CsssssssssssC.', '..CCsssssssCC..', '....CCCCCCC....', 'nnnnnnnnnnnnnnn', 'nUcUcUcUcUcUcUn'],
      at: 'head',
      x: 18,
      y: 6,
    },
    mark: {
      name: 'rune-mark',
      grid: [
        'nnnnnnnnnnnnnnnnnnnnnnnnnnnn',
        'nUUUUUUUUUUUUUUUUUUUUUUUUUUn',
        'nUUUUUUUUUUUcUUUUUUUUUUUUUUn',
        'nUUUUUUUUUUccUUcUUUUUUUUUUUn',
        'nUUUUUUUUUcUcUccUUUUUUUUUUUn',
        'nUUUUUUUUUUUccUcUUUUUUUUUUUn',
        'nUUUUUUUUUUcUUUUcUUUUUUUUUUn',
        'nUUUUUUUUUUUUUUUUUUUUUUUUUUn',
        'nnnnnnnnnnnnnnnnnnnnnnnnnnnn',
      ],
      at: 'head',
      x: 12,
      y: 47,
    },
    hoops: { name: 'star-studs', grid: ['W...C...W...C...W...C...W', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', '.........................', 'C...W...C...W...C...W...C'], at: 'head', x: 13, y: 43, ink: false },
    sides: {
      name: 'rune-stones',
      grid: [
        '.333......................................................333.',
        '33333....................................................33333',
        '3c3c3....................................................3c3c3',
        '33c33....................................................33c33',
        '3c3c3....................................................3c3c3',
        '33333....................................................33333',
        '.222......................................................222.',
      ],
      at: 'head',
      x: -5,
      y: 38,
      layer: 'under',
    },
    bands: { light: 's', dark: 'c' },
  }
}

const KITS: Readonly<Record<ClanId, () => Kit>> = { cinder, smudge, delve, silkcut, hexmoon }
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
  return all(...Object.entries(k).filter(([n]) => n !== 'bands').map(([, v]) => v as P))
}

/** What clan × faction × tier is baked from: the cuts, the keg's hoop colours, and the parts in paint order. */
export function recipeFor(clan: ClanId, faction: Faction, tier: number): Recipe {
  const k = kitOf(clan)
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
    }
  }
  const top = tier >= 5 ? k.bossCap : tier >= 4 ? k.capBig : k.cap
  return { cuts: ['fuse'], bands: k.bands, parts: all(tier >= 3 && k.sides, k.mark, tier >= 2 && k.hoops, top) }
}
