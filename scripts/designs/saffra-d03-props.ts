/**
 * Saffra design 03, refined — the Field Burner, and five props that replace
 * her torch (the designer: "3 is my favorite but a different item that
 * doesn't overlap w the hat"; then "also refine it more").
 *
 * The approved silhouette is kept row for row (saffra-d03.ts stays as the
 * approved "before"); the refinement is all inside it, hand-placed: a worn
 * dent in the crown, a stitched seam and a stitched crown base, scuffs and a
 * scorch on the felt, a gold buckle on the ember band, stitching round the
 * brim, the rolled lip of the brim lit with a singed nick in it, folds in the
 * smoke kerchief and its tails at the nape, strands in the hair, a belt on the tunic. The idle is weightier: the hat sinks, the body settles
 * a beat later, and the hat rebounds a pixel.
 *
 * Every prop hangs below the brim (canvas row 53 and lower) or right of it
 * (column 83 and beyond), so the hat's outline reads clean at 1×.
 */
import type { Design, Frame, Part } from './saffra-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, bell } from './saffra-common'

const BODY = bell({ d: 'o', m: 'O', l: 'g', t: 'u' }, { 4: '...uuuuuuuuuuuuuuuOgOuu' })

/** The refined figure, without a prop: shared by all five. */
function figure(): Part[] {
  return [
    { id: 'shadow', group: 'feet', x: 31, y: 68, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 41, y: 65, rows: FEET, ring: 0 },
    { id: 'tails', group: 'head', x: 18, y: 53, rows: TAILS },
    { id: 'body', group: 'body', x: 35, y: 52, rows: BODY },
    { id: 'hairB', group: 'head', x: 23, y: 51, rows: HAIRB },
    { id: 'mask', group: 'head', x: 60, y: 51, rows: MASK },
    { id: 'hat', group: 'head', x: 19, y: 22, rows: HAT, squash: [6, 10] },
    { id: 'handB', group: 'hands', x: 30, y: 58, rows: FIST_L },
  ]
}

/** The weightier idle: the hat sinks, the body settles a beat later, the hat rebounds a pixel. */
const IDLE: Frame[] = [
  {},
  { squash: 1 },
  { squash: 2, move: { hands: [0, 1], prop: [0, 1], fx: [0, 1] } },
  { squash: 2, move: { hands: [0, 1], prop: [0, 1], fx: [0, 1], body: [0, 1] } },
  { squash: 1, move: { body: [0, 1] } },
  { move: { head: [0, -1] } },
]
const IDLE_MS = [220, 130, 150, 230, 140, 170]

/** The shared inks plus the pack's iron greys (pot, smoke, ash). */
const INKS = { ...PAL, i: '#394243', I: '#4f5e65', J: '#737f8e', K: '#bac1c8' }

const base = { pal: INKS, headBottom: 53, idle: IDLE, idleMs: IDLE_MS }

/** The ember pot's idle: the weighty bob, and a wisp of smoke that drifts up off the coals and thins. */
const DRIFT = [0, 0, 1, 1, 2, 3]
const POT_IDLE: Frame[] = IDLE.map((f, i) => ({ ...f, nudge: { smokeS: [i > 3 ? 1 : 0, -DRIFT[i]] as const }, ...(i === 5 ? { hide: ['smokeS'] } : {}) }))

/** The approved figure refined, holding the ember pot (the recommended prop). */
const HAT = [
  '........................uUVVVV.VVVUUUu',
  '.....................uUVVVVwBUUuVVVVUUUUu',
  '...................uUVVVVVBbVVUubVVVVUUUUUu',
  '..................uUVVVVbVVVVVVuVVVVVUUUUUUu',
  '.................uUUVVbVVVVVVVVubVVVVUUUUUUUu',
  '................uuUVVbVVVVVVVVVuVVVVUUUUUUUUu',
  '................uuUVbVVVVVVVVVVubVVVUUUUUUUUUu',
  '................uuUVbVVVVVVVVVVuVVVUUUUUUUUUUu',
  '...............uuUUbVVVVVVVVVVubVVUUUUUUUUUUUu',
  '...............uuUUVVVVVVVVVVVVuVVUUUUUUUUUUUUu',
  '...............uuUUVVVVVVVVVVVVubVUUUUUUUUUUUUu',
  '...............uuuUUVVVVVVVVVVVuVVUUUUUUUUUUUUu',
  '...............uuuUUVVVVVVVVVVVubVUUUUUUUUUUUUu',
  '..............uuuUUUVVVVVVVVVVVuVVUUUUuuuuUuuuu',
  '..............uuuUUUUVVVVVVVVVVubVUUUUUuuuuuuuuu',
  '..............uuuUUUUVVVVVVVVVVuVVUUUUuuuuuuuuuu',
  '..............uuuuUUUUUUUUUUUUUuUUUUUUUUUUUUUUuu',
  '..............rrRRQQQQQQQQQQQQQQQQQQRRRRoOOyORRr',
  '.............rrRRRRRRRRRRRRRRRRRRRRRRRRRoukuORRRr',
  '.............rrrRRRRRRRRRRRRRRRRRRRRRRRRoOOOyRRrr',
  '.............rrrrrrrrrrrrrrrrrrrrrrrrrrrooooorrrr',
  '......uUUVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUUUUUUUUUUUUUUUu',
  '...uUUUVVVVVVVVbbVVVVVVVVVVVVVVVVVVVVbbVVVVVUUUUUUUUUUUUUuu',
  '.uuUUUUVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUUUUUUuu',
  'uuuUUbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbuxubbbBbUUuu',
  'uuuUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUuuu',
  'uuuuuuuuukkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkuuuuuuuuu',
  '.uuuuuuu..............................................uuuuuuu',
  '..uuuu...................................................uuuu',
]

const MASK = [
  'eEEEEFF',
  'eEEEEFFF',
  'rRRQQQQQ',
  'rRrRRRQRQ',
  '.rRRrRRRR',
  '..rRRRrR',
  '....rRR',
]

const TAILS = [
  '..rR',
  'rRRr',
  '.rRr',
  'rr',
]

const HAIRB = [
  '.hHHjHHHHHh',
  'qhHHHHjHHHhh',
  'qhhHhHHHhHhq',
  '.qhhqhhhqhq',
  '..qqhqhqq',
  '....qqq',
]

const POT_CHAIN = [
  'k',
  'U',
]

const POT = [
  '....iIIIIi',
  '...i....i',
  '.iIHyHwyHyHIi',
  'iIIHyywyyHHIIi',
  'iiiiiiiiiiiiii',
  'iIJKJJJJJIIIii',
  'iIJJJJJJIIIiii',
  '.iIIJJIIIIiii',
  '..iIIIIIIiii',
  '...iiiiiiii',
  '...ii....ii',
]

const SMOKE_S = [
  '.JJ',
  'JKKJ',
  '.IJ',
]

const SMOKE_B = [
  '..JJJ',
  '.JKKKJ',
  'JKKJKKJ',
  'IJKKKJI',
  '.IIJJI',
]

const BELLOWS = [
  '.uU....Uu',
  '.uU....Uu',
  'xuVVVVVVVu',
  'XuVVbbVVVVu',
  'xuVVVVVVVVu',
  'XuVVVoyVVVu',
  'xuVVVOOVVVu',
  '.XuVVVVVVu',
  '.xuVVVVVu',
  '..XuVVVVu',
  '...uUUUu',
  '....oOo',
  '....oOo',
  '....oOg',
  '.....y',
]

const BELLOWS_SHUT = [
  '.uU....Uu',
  '.uU....Uu',
  'xuVVbbVVVVu',
  'XuVVVoyVVVu',
  '.XuVVVOOVu',
  '..xuVVVVu',
  '...uUUUu',
  '....oOo',
  '....oOo',
  '....oOg',
  '.....y',
]

const SPARKS = [
  'y...w',
  '..H',
  'w...y',
]

const RISTRA = [
  '....uuu',
  '...u..u',
  '....uuu',
  '...uuuuu',
  'rRQ.rRQ.rRQ',
  'rRQ.rRQ.rRQ',
  'rRQ.rRQ.rRQ',
  'rRQ.rRQ.rRQ',
  'rR..rRQ..RQ',
  'rR..rRQ..RQ',
  'r...rRQ...Q',
  '.....rQ',
  '.....rQ',
  '......Q',
]

const RISTRA_L = [
  '....uuu',
  '...u..u',
  '...uuu',
  '..uuuuu',
  'rRQ.rRQ.rRQ',
  'rRQ.rRQ.rRQ',
  'rRQ.rRQ.rRQ',
  'rRQ.rRQ.rRQ',
  'rR..rRQ..RQ',
  'rR..rRQ..RQ',
  'r...rRQ...Q',
  '....rQ',
  '....rQ',
  '....Q',
]

const HANDLE = [
  'aA',
  '.aA',
  '..aA',
  '...aA',
  '....aA',
  '.....aA',
  '......aA',
  '.......aA',
  '........aA',
]

const BEATER = [
  '...rRr',
  '..rRQRr',
  '.uUVUVUu',
  '.uUVUVUVu',
  'uVUuVUVUu',
  'uUVuUVuVUu',
  '.uVUuVUuVUu',
  '.uU.Vu.Uu.VU',
  '..u..u..u..u',
]

const ASH = [
  '.JK..J',
  'IJKJ.JK',
  '..IJ',
]

const SACK = [
  '.....RQ.RQ',
  '....rRRrRRr',
  '....eEFFEe',
  '.....eEEe',
  '.....uuuu',
  '....eEEFFe',
  '..eeEEEFFFe',
  '.eeEEEEFFFEe',
  'eeEEERREFFEe',
  'eEEERQREEFFe',
  'eEEEERREEFEe',
  'eEEEEREEEEEe',
  'eeEEEEEEEEee',
  '.eexeexeexe',
  '..eeeeeeee',
]

const SMOCK = [
  '....xxXXXXXXXXXXXXXXXXRR',
  '...xxxXXXXXXVbbbbbbVXXXRR',
  '...xxxXXXXXXVbBBbbbVXXXRR',
  '..xxxxXXXXXXVbbbbbbVXXXXRR',
  '..xxxxXXXXXXVbbbbbbVXXXXRR',
  '..rrrrRRRRRRRRRRRRRRRRRRQQ',
  '.rrRRrRRRRRRRRRRRRRRRRRRQQ',
  '.xxrRrxVVbbbbbbbbbbbbbbVXXR',
  '.xxxrRrVbbbbbbbBbbbbbbVXXR',
  'xxxxrRrVbbbbbbbbbbbbbbVXXRR',
  'xxxxxrrVbbbVbbbbbbbbbbVXXRR',
  'xxxxxxxVbbbbVbbbbbbbVbbVXXR',
  'xxxxxxxVVbbbVbbbbbbbVbbVXXR',
  '.xxxxxxuVVVVVVVVVVVVVVVuXXR',
  '..xxxxxuuUuuUuuHuuUuuHuuxx',
  '...xxxx.uH.uuu.uHu.uu.x',
]

const BOOTS = [
  '..kkk.........kkk',
  '..kkk.........kkk',
  '.uUUu........uUUu',
  '.uUUu........uUUVu',
  'uUUUUu......uUUUUVu',
  'uUUUUUu.....uUUUUUVVu',
  'kkkkkkk.....kkkkkkkkkk',
]

const SPOUCH = [
  '.rr',
  'uVVu',
  'uVbU',
  'uUUu',
  '.uu',
]

export const P1: Design = {
  ...base,
  id: 'd03p1',
  title: 'Ember Pot',
  idle: POT_IDLE,
  concept: 'She carries the fire to the field in a brass ember pot on a chain, swung low at her knee; it smokes while she talks price.',
  parts: [
    ...figure(),
    { id: 'chain', group: 'prop', x: 70, y: 61, rows: POT_CHAIN, ring: 0 },
    { id: 'pot', group: 'prop', x: 64, y: 62, rows: POT },
    { id: 'smokeS', group: 'fx', x: 77, y: 57, rows: SMOKE_S, ring: 1 },
    { id: 'smokeB', group: 'fx', x: 80, y: 55, rows: SMOKE_B, ring: 1, hidden: true },
    { id: 'handF', group: 'hands', x: 68, y: 56, rows: FIST_R },
  ],
  // she swings the pot out and back, and it coughs up a fat puff that drifts off
  tic: [
    { nudge: { pot: [1, 0], chain: [0, 0] }, hide: ['smokeS'] },
    { nudge: { pot: [2, -1] }, hide: ['smokeS'], squash: 1 },
    { nudge: { pot: [1, 0] }, hide: ['smokeS'] },
    { nudge: { pot: [-1, 0] }, show: ['smokeB'], hide: ['smokeS'] },
    { show: ['smokeB'], nudge: { smokeB: [1, -1] }, hide: ['smokeS'] },
    { show: ['smokeB'], nudge: { smokeB: [3, -1] } },
    {},
  ],
  ticMs: [110, 130, 110, 140, 200, 220, 160],
}

export const P2: Design = {
  ...base,
  id: 'd03p2',
  title: 'Bellows',
  concept: 'A leather hand bellows at her side for fanning the burn along the rows; she squeezes it and it spits sparks.',
  parts: [
    ...figure(),
    { id: 'bellows', group: 'prop', x: 64, y: 58, rows: BELLOWS },
    { id: 'sparks', group: 'fx', x: 65, y: 69, rows: SPARKS, ring: 0, hidden: true },
    { id: 'handF', group: 'hands', x: 66, y: 56, rows: FIST_R },
  ],
  // two quick pumps: the boards clap shut, sparks spit from the nozzle
  tic: [
    { swap: { bellows: BELLOWS_SHUT }, at: { bellows: [64, 58] }, show: ['sparks'] },
    { nudge: { sparks: [2, -1] }, show: ['sparks'] },
    {},
    { swap: { bellows: BELLOWS_SHUT }, at: { bellows: [64, 58] }, show: ['sparks'], squash: 1 },
    { nudge: { sparks: [2, -1] }, show: ['sparks'] },
    {},
  ],
  ticMs: [90, 130, 120, 90, 160, 200],
}

export const P3: Design = {
  ...base,
  id: 'd03p3',
  title: 'Pepper Ristra',
  concept: 'A string of the summer’s dried red peppers hanging from her fist, the sample she shows every buyer.',
  parts: [
    ...figure(),
    { id: 'ristra', group: 'prop', x: 63, y: 58, rows: RISTRA },
    { id: 'handF', group: 'hands', x: 68, y: 56, rows: FIST_R },
  ],
  // she gives the string a shake: it swings out, back, and settles
  tic: [
    { swap: { ristra: RISTRA_L }, at: { ristra: [64, 58] } },
    { swap: { ristra: RISTRA_L }, at: { ristra: [66, 58] }, squash: 1 },
    { swap: { ristra: RISTRA_L }, at: { ristra: [64, 58] } },
    {},
    { nudge: { ristra: [-1, 0] } },
    {},
  ],
  ticMs: [110, 160, 110, 110, 140, 200],
}

export const P4: Design = {
  ...base,
  id: 'd03p4',
  title: 'Fire Beater',
  concept: 'A birch-twig fire beater held low and angled away, for slapping out the burn where it jumps the furrow.',
  parts: [
    ...figure(),
    { id: 'handle', group: 'prop', x: 70, y: 59, rows: HANDLE },
    { id: 'beater', group: 'prop', x: 76, y: 64, rows: BEATER },
    { id: 'ash', group: 'fx', x: 82, y: 69, rows: ASH, ring: 1, hidden: true },
    { id: 'handF', group: 'hands', x: 68, y: 56, rows: FIST_R },
  ],
  // she lifts the beater and slaps the ground: a puff of ash
  tic: [
    { move: { prop: [0, -2], hands: [0, -1] } },
    { move: { prop: [0, -3], hands: [0, -2] }, squash: 1 },
    { move: { prop: [0, 1], hands: [0, 1] }, squash: 2, show: ['ash'] },
    { show: ['ash'], nudge: { ash: [1, -2] } },
    {},
  ],
  ticMs: [110, 150, 90, 220, 220],
}

export const P5: Design = {
  ...base,
  id: 'd03p5',
  title: 'Smoked Sack',
  concept: 'A sack of the smoked pepper the burn leaves behind, swung from her fist, stamped with the company pepper.',
  parts: [
    ...figure(),
    { id: 'sack', group: 'prop', x: 62, y: 57, rows: SACK },
    { id: 'handF', group: 'hands', x: 66, y: 59, rows: FIST_R },
  ],
  // she hefts the sack to show its weight; a pepper hops in its mouth
  tic: [
    { move: { prop: [0, 1], hands: [0, 1] }, squash: 1 },
    { move: { prop: [0, -1], hands: [0, -1] } },
    { move: { prop: [0, -2], hands: [0, -2] } },
    { move: { prop: [0, 1], hands: [0, 1] }, squash: 2 },
    {},
  ],
  ticMs: [120, 110, 260, 140, 200],
}

export const PROPS: readonly Design[] = [P1, P2, P3, P4, P5]

// ── her own body (the designer: "Body doesn't need to be shared, it should be unique no?") ──
//
// Drawn for her, not re-inked from the shared bell: an oxblood work smock, a
// leather apron singed and still smouldering along its hem, an ember sash
// knotted at the back hip with a leather spice pouch hung from the knot, and short work boots planted one ahead of the
// other: brisk, leaning into the next field. Ramps hue-shift like the pack's
// (purple-brown shade to tan light on the leather, oxblood to ember).

/** The refined figure on her own body. */
function figureOwn(): Part[] {
  return [
    { id: 'shadow', group: 'feet', x: 31, y: 68, rows: SHADOW_M, ring: 0 },
    { id: 'boots', group: 'feet', x: 36, y: 65, rows: BOOTS },
    { id: 'tails', group: 'head', x: 18, y: 53, rows: TAILS },
    { id: 'smock', group: 'body', x: 34, y: 50, rows: SMOCK },
    { id: 'spouch', group: 'body', x: 37, y: 60, rows: SPOUCH },
    { id: 'hairB', group: 'head', x: 23, y: 51, rows: HAIRB },
    { id: 'mask', group: 'head', x: 60, y: 51, rows: MASK },
    { id: 'hat', group: 'head', x: 19, y: 22, rows: HAT, squash: [6, 10] },
    { id: 'handB', group: 'hands', x: 30, y: 58, rows: FIST_L },
  ]
}

/** The ember pot on her own body: a short wind-up, the puff lands on the third frame and holds. */
export const B1: Design = {
  ...base,
  id: 'd03b1',
  title: 'Ember Pot',
  concept: 'Her own work body (a singed leather apron over a smock, a sash and spice pouch, work boots) with the ember pot swung low.',
  idle: POT_IDLE,
  parts: [
    ...figureOwn(),
    { id: 'chain', group: 'prop', x: 70, y: 61, rows: POT_CHAIN, ring: 0 },
    { id: 'pot', group: 'prop', x: 64, y: 62, rows: POT },
    { id: 'smokeS', group: 'fx', x: 77, y: 57, rows: SMOKE_S, ring: 1 },
    { id: 'smokeB', group: 'fx', x: 80, y: 55, rows: SMOKE_B, ring: 1, hidden: true },
    { id: 'handF', group: 'hands', x: 68, y: 56, rows: FIST_R },
  ],
  tic: [
    { nudge: { pot: [-1, 0] }, hide: ['smokeS'] },
    { nudge: { pot: [2, -1] }, squash: 1, hide: ['smokeS'] },
    { nudge: { pot: [1, 0] }, show: ['smokeB'], hide: ['smokeS'], squash: 2, move: { body: [0, 1] } },
    { show: ['smokeB'], nudge: { smokeB: [1, -1] }, hide: ['smokeS'] },
    { show: ['smokeB'], nudge: { smokeB: [3, -1] } },
    { move: { head: [0, -1] } },
    {},
  ],
  ticMs: [90, 100, 260, 200, 220, 120, 160],
}

/** The pepper ristra on her own body: a shake whose swing peaks on the third frame. */
export const B3: Design = {
  ...base,
  id: 'd03b3',
  title: 'Pepper Ristra',
  concept: 'Her own work body (a singed leather apron over a smock, a sash and spice pouch, work boots) with the string of dried peppers.',
  parts: [
    ...figureOwn(),
    { id: 'ristra', group: 'prop', x: 63, y: 58, rows: RISTRA },
    { id: 'handF', group: 'hands', x: 68, y: 56, rows: FIST_R },
  ],
  tic: [
    { nudge: { ristra: [-1, 0] } },
    { swap: { ristra: RISTRA_L }, at: { ristra: [65, 58] }, squash: 1 },
    { swap: { ristra: RISTRA_L }, at: { ristra: [66, 58] }, squash: 2, move: { body: [0, 1] } },
    { swap: { ristra: RISTRA_L }, at: { ristra: [65, 58] } },
    { nudge: { ristra: [-1, 0] }, move: { head: [0, -1] } },
    {},
  ],
  ticMs: [90, 100, 260, 120, 160, 200],
}

export const OWN_BODY: readonly Design[] = [B1, B3]
