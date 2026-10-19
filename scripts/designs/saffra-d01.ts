/**
 * Saffra design 01 — the Caravan Runner. Hand-authored pixel maps (see saffra-lib.ts).
 *
 * She runs the pepper carts down the burnt-field roads: a ginger mop bursting
 * out under a red bandana whose folds pull back to the knot, the tails flying
 * behind, a burlap sack swung from her front fist. Silhouette: a dome with
 * drooping wings of hair, streamers at the back, a sack-lump low in front.
 * Tic: she hefts the sack up to her shoulder (the tails flick) and drops it.
 */
import type { Design } from './saffra-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, bell } from './saffra-common'

// the bandana: a dome over the crown; its folds run back to the knot; the hem dips over the brow at the front
// ruler      0         1         2         3         4
//            01234567890123456789012345678901234567890
const BANDANA = [
  '.........................RQQQQQQQRRRRR',
  '......................RRQQQQQQQQQQRRRRRRR',
  '....................rRQQQQQQQQQQQQRRRRRRRRR',
  '..................rrRQQQQQQQQQQQQQRRRRRRRRRRR',
  '.................rrRQQQQQQQQQQQQQQQQrRRRRRRRRR',
  '................rrRRQQQQQQQQQQQQQrrRRRRRRRRRRRR',
  '...............rrRRRQQQQQQQQQQQrQRRRRRRRRRRRRRRR',
  '..............rrRRRQQQQQQQQQrrQRRRRRRRRRRRRRRRRR',
  '..............rrRRRQQQQQQQrQRRRRRRRRRRRRRRRRRRRRR',
  '.............rrRRRrQRRRRRRRRRRRRRRRRRRRRRrrRRRRRRR',
  '..............rrRRRRRRRRRRRRRRRRRRRRRrrrRRRRRRRRRR',
  '..............rrrRRRRRRRRRRRRRRRRrrrRRRRRRRRRRRRRR',
  '...............rrrRRRRRRRRRRrrrrRRRRRRRRRRRRRRRRRR',
  '...............rrrrRRRRrrrrrRRRRRRRRRRRRRRRRRRRRRR',
  '................rrrrrrrRRRRRRRRRRRRRRRRRRRRRRRRRRR',
  '.................rrrrrrrrrrRRRRRRRRRRRRRRRRRRRRRRR',
  '...................rrrrrrrrrrrrRRRRRRRRRRRRRRRRRr',
  '......................rrrrrrrrRRRRRRRRRRRRRRRRRRr',
  '..........................rrrrrrrrrRRRRRRRRRRRRRr',
  '...............................rrrrrrrrrrrrrrrrr',
  '.....................................rrrrrrrrrr',
]

// the mop: hidden under the bandana at the top, it bursts out at the sides and flares into drooping wings
// ruler      0         1         2         3         4         5
//            0123456789012345678901234567890123456789012345678901234567
const HAIR = [
  '........................hhhhhhhhhhhhhhh',
  '.....................hhhhhhhhhhhhhhhhhhhhh',
  '...................hhhhhhhhhhhhhhhhhhhhhhhhh',
  '.................hhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
  '................hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
  '...............hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
  '..............hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
  '............qqhhHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
  '............qhhhHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
  '...........qqhhHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
  '...........qhhhHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
  '..........qhhHhHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHh',
  '..........qhhHhHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHh',
  '..........qhhHhHHHHHhHHHHHHHHHHHHHHHHHHHHHHHHHHHHhHh',
  '.........qhhHHhHHHHHhHHHHHHHHHHHHHHHHHHHHHHHHHHHHhHjh',
  '.........qhhHHhHHHHHhHHHHHhHHHHHHHHHHHHHjHHHHHjHHhHHh',
  '........qhhhHHhHHHHHhHHHHHhHHHHHhHHjHHHHjHHHHHjHHhHHh',
  '........qhhhHHhHHHHHhHHHHHhHHHHHhHHjHHhHHjHHhHHHHhHHHh',
  '.......qhhhhHHhHHHHHhHHHHHhHHHHHhHHHHHhHHHHHhHHHHhHHHh',
  '.......qhhhhHHhHHHHHhHHHHHhHHHHHhHHHHHhHHHHHhHHHHhHHhHh',
  '......qhhhhhHHHHHhHHhHHHHHhHHHHHhHHHHHhHHHHHhHHHHhHHhHh',
  '.....qhhhhhhhHHHHhHHhHHHHHhHHHHHhHHHHHhHHHHHhHHhHHHHhHHh',
  '....qhhhhhhhhhhHHhHHHHHhHHhHHhHHhHHHHHhHHHHHhHHhHHHHhHHHh',
  '..qqhhhhhhhhhhhhhhHHHHHhHHHHHhHHhHHhHHhHHhHHhHHhHHHHhHHHHh',
  '.qqhhhhhhhhhhhhhhhhhhhHhHHHHHhHHhHHhHHhHHhHHHHHhHHHHhHHHHHh',
  'qqqhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhq',
  'qqqqhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhq',
  'qqqqqhhhhhhhhqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqhhhhhhhhhhhqqq',
  'qqqqhhhhhhhhhq.................................qhhhhhhhhhhhqq',
  '.qqqhhhhhhhq.....................................qhhhhhhhhqq',
  '..qqhhhhhq.........................................qhhhhhqq',
  '....qqqq.............................................qqqq',
]

// the knot at the back of the head, and its two tails streaming behind
const KNOT = [
  '.rRR',
  'rRQRR',
  'rRRRRr',
  '.rRRRRr',
  'rRRQRRr',
  'rrRRRr',
  '.rrr',
]
const TAILS = [
  '...........rRRR',
  '........rrRRRR',
  '.....rrRRRRr',
  '...rrRRRr',
  '.rrRRr',
  'rRr',
  '.........rRRR',
  '......rrRRRr',
  '...rrRRRr',
  '.rrRRr',
  'rRr',
]
/** The tails flicked up (the tic). */
const TAILS_UP = [
  '.rRR',
  '..rRRR',
  '....rRRRr',
  '......rrRRRr',
  '........rrRRRR',
  '...........rRRR',
  '..rRr',
  '.rRRRr',
  'rRRRRRr',
  '..rrRRRRr',
  '.....rrRRR',
]

// the nose, just under the fringe (no eyes, no mouth: the pack hides faces)
const NOSE = [
  'eEE',
  'eEEF',
  'eEEFF',
  'eEEEFF',
  'eeEEE',
  '.eee',
]

// a gold tunic and a dark belt; only its lower half shows under the hair
const BODY = bell({ d: 'x', m: 'X', l: 'R', t: 'o' })

// the burlap pepper sack, tied at the neck, a red pepper poking out
const SACK_TOP = ['..RQ.QR', '..rRrRr', '.uUVVUVu', '..uUUVu']
const SACK = [
  '...uuu',
  '..uUUVVu',
  '.uUUUUVVu',
  'uUUUUUUVVu',
  'uUUaUUUUVu',
  'uUUUaUUUVu',
  'uUUUUUUUUu',
  '.uUUUUUUu',
  '..uuuuuu',
]

export const D01: Design = {
  id: 'd01',
  title: 'Caravan Runner',
  concept: 'Runs the pepper carts down the burnt-field roads: a ginger mop under a red bandana, its tails flying, a sack swung from her fist.',
  pal: PAL,
  headBottom: 65,
  parts: [
    { id: 'shadow', group: 'feet', x: 31, y: 73, rows: SHADOW_M, ring: 0 },
    { id: 'tails', group: 'head', x: 13, y: 30, rows: TAILS },
    { id: 'tailsUp', group: 'head', x: 13, y: 20, rows: TAILS_UP, hidden: true },
    { id: 'feet', group: 'feet', x: 41, y: 70, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 35, y: 57, rows: BODY },
    { id: 'hair', group: 'head', x: 19, y: 32, rows: HAIR, squash: [12, 15] },
    { id: 'handB', group: 'hands', x: 30, y: 64, rows: FIST_L },
    { id: 'nose', group: 'head', x: 69, y: 46, rows: NOSE },
    { id: 'bandana', group: 'head', x: 19, y: 25, rows: BANDANA, squash: [10] },
    { id: 'knot', group: 'head', x: 26, y: 32, rows: KNOT },
    { id: 'sack', group: 'prop', x: 62, y: 69, rows: SACK },
    { id: 'sackTop', group: 'prop', x: 62, y: 63, rows: SACK_TOP },
    { id: 'handF', group: 'hands', x: 64, y: 66, rows: FIST_R },
  ],
  idle: [{}, { squash: 1 }, { squash: 2, move: { hands: [0, 1] } }, { squash: 2, move: { hands: [0, 1] } }, { squash: 1 }, {}],
  idleMs: [180, 120, 140, 180, 120, 160],
  // she hefts the sack up onto her shoulder, the tails flick up, then she drops it back to the swing
  tic: [
    { move: { prop: [0, 1], hands: [0, 1] }, squash: 1 },
    { nudge: { sack: [1, -6], sackTop: [1, -6], handF: [1, -6] } },
    { nudge: { sack: [2, -12], sackTop: [2, -12], handF: [2, -12] }, hide: ['tails'], show: ['tailsUp'] },
    { nudge: { sack: [2, -12], sackTop: [2, -12], handF: [2, -12] }, hide: ['tails'], show: ['tailsUp'] },
    { nudge: { sack: [2, -12], sackTop: [2, -12], handF: [2, -12] } },
    { nudge: { sack: [1, -5], sackTop: [1, -5], handF: [1, -5] } },
    { move: { prop: [0, 1], hands: [0, 1] }, squash: 2 },
  ],
  ticMs: [120, 90, 160, 240, 200, 100, 160],
}
