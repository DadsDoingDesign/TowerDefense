/**
 * Saffra design 08 — the Guild Dame. Hand-authored pixel maps (see saffra-lib.ts).
 *
 * Saffra as she is now: the Peppercorn guild's senior broker, who sets the
 * season's price at the hall. A tall ember hennin banded in gold and leaning
 * back, a jewelled gold roll at its foot, a linen veil streaming from its tip
 * down her back, an ermine-collared mantle, and a fat velvet purse she never
 * puts down. Silhouette: a leaning cone and a flag of veil over the widest
 * collar of the ten. Tic: she jingles the purse and a coin hops out and back in.
 */
import type { Design } from './saffra-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, bell } from './saffra-common'

const NOSE = [
  'EEF',
  'EEFF',
  'EEEF',
]

const MANTLE = [
  '..........lmmmLmmmmLmmmmLmmmmLmmmmLmmmmL',
  '......lLmmkmmmmmkmmmmmkmmmmmkmmmmmkmmmmmmLl',
  '...llLLmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmLLl',
  '..lllLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLl',
  '.rrrrRRRRRRRRrRRRRRRRRRRRRRRrRRRRRRRRRRRRRRQQr',
  'rrrrrRRRRRRRRrRRRRRRRRRRRRRRrRRRRRRRRRRRRRRQQr',
  'rrrrrRRRRRRRrRRRRRRRRRRRRRRRrRRRRRRRRRRRRRRQQr',
  'rrrrrrRRRRRRrRRRRRRRRRRRRRRRrRRRRRRRRRRRRRRQQr',
  'rrrrrrRRRRRRrRRRRRRRRRRRRRRRrRRRRRRRRRRRRRQr',
  'rrrrrrrrrrrrrrr................rrrrrrrrrrrrrrr',
  '.rrrrrrrrrrrr...................rrrrrrrrrrrr',
  '...rrrrrrrr.......................rrrrrrrr',
]

const PURSE = [
  '...yOy',
  '..oOyOo',
  '..rRRRr',
  '.rRRRRRQ',
  'rRRyRRRRQ',
  'rRyyyRRRQ',
  'rRRyRRRRQ',
  'rRRRRRRRQ',
  '.rRRRRRQ',
  '..rrrrr',
]

const COIN = [
  '.y',
  'yYy',
  '.y',
]

const BODY = bell({ d: 'x', m: 'X', l: 'R', t: 'o' })

const BUN = [
  '.hHHHh',
  'qhHjHh',
  'qhHHHh',
  'qqhhhq',
  '.qqqq',
]

const CONE = [
  '.....QR',
  '.....rQR',
  '.....rQRR',
  '.....rQwR',
  '.....rRQRR',
  '.....rRQQRR',
  '.....rRQQRR',
  '.....rRRQQRR',
  '.....ogggyggO',
  '....ooOOOOOOo',
  '....rrRRQQRRRR',
  '....rrRRQQQRRRR',
  '....rrRRRQQRRRR',
  '....rrRRRQQQRRRR',
  '....oggggyggggygO',
  '....ooOOOOOOOOOOo',
  '...rrRRRRQQQRRRRRR',
  '...rrRRRRQQQQRRRRRR',
  '...rrrRRRRQQQRRRRRR',
  '...rrrRRRRQQQQRRRRRR',
  '...ogggggyggggggyggOo',
  '...ooOOOOOOOOOOOOOOOo',
  '..rrrRRRRRQQQQRRRRRRRr',
  '..rrrRRRRRRQQQRRRRRRRRr',
]

const FINIAL = [
  '.y',
  'yYy',
]

const BAND = [
  '...oOOgggggggggggggggggOo',
  '.ooOgggRRgggggRRgggggRRggOo',
  'oooOggQRggggggQRgggggQRgOOoo',
  'ooooOOOOOOOOOOOOOOOOOOOOOooo',
  '..oooooooooooooooooooooooo',
]

const VEIL = [
  '....................mL',
  '..................mmLL',
  '................mmmLLl',
  '..............mmmmLLl',
  '............mmmmmLLLl',
  '...........lmmmmmLLl',
  '..........lmmmmlmLLl',
  '.........lmmmmlmmLl',
  '........lLmmmlmmmLl',
  '.......lLmmlmmmmLl',
  '......lLmmmlmmmmLl',
  '......lLmmlmmmmLl',
  '......LmmmlmmmmLl',
  '.......mmlmmmmLl',
  '.......mmlmmmmLl',
  '.....lmmmlmmmmLl',
  '...lLLmmmlmmmmLl',
  '...lLmmmlmmmmmLl',
  '..lLLmmmlmmmmmLl',
  '..lLmmmmlmmmmmLl',
  '..lLLmmmlmmmmmLl',
  '...LmmmmlmmmmmLl',
  '...lmmmlmmmmmmLl',
  '..lLmmmlmmmmmmLl',
  'lLLmmmmlmmmmmLl',
  'lLmmmmlmmmmmmLl',
  'lLLmmmlmmmmmLLl',
  'lLLLLlLLLLLLLl',
  'lLLll..lLLLll',
  '.lll....llll',
]

export const D08: Design = {
  id: 'd08',
  title: 'Guild Dame',
  concept: 'The guild’s senior broker, who sets the season’s price: a tall banded hennin trailing a veil, an ermine collar, a fat purse.',
  pal: PAL,
  headBottom: 46,
  parts: [
    { id: 'shadow', group: 'feet', x: 30, y: 60, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 40, y: 57, rows: FEET, ring: 0 },
    { id: 'veil', group: 'head', x: 21, y: 9, rows: VEIL, squash: [12, 20] },
    { id: 'body', group: 'body', x: 34, y: 44, rows: BODY },
    { id: 'bun', group: 'head', x: 26, y: 32, rows: BUN },
    { id: 'mantle', group: 'head', x: 23, y: 35, rows: MANTLE, squash: [6] },
    { id: 'nose', group: 'head', x: 61, y: 34, rows: NOSE },
    { id: 'cone', group: 'head', x: 36, y: 8, rows: CONE, squash: [12, 18] },
    { id: 'finial', group: 'head', x: 40, y: 5, rows: FINIAL, ring: 1 },
    { id: 'band', group: 'head', x: 34, y: 30, rows: BAND },
    { id: 'handB', group: 'hands', x: 28, y: 47, rows: FIST_L },
    { id: 'coin', group: 'fx', x: 66, y: 45, rows: COIN, ring: 1, hidden: true },
    { id: 'purse', group: 'prop', x: 63, y: 49, rows: PURSE },
    { id: 'handF', group: 'hands', x: 64, y: 46, rows: FIST_R },
  ],
  idle: [{}, { squash: 1 }, { squash: 2, move: { hands: [0, 1], prop: [0, 1] } }, { squash: 2, move: { hands: [0, 1], prop: [0, 1] } }, { squash: 1 }, {}],
  idleMs: [260, 170, 190, 260, 170, 230],
  // a jingle: the purse bounces twice, a coin hops out over the knot and drops back in
  tic: [
    { move: { prop: [0, 1], hands: [0, 1] } },
    { move: { prop: [0, -1], hands: [0, -1] }, show: ['coin'] },
    { move: { prop: [0, 1], hands: [0, 1] }, show: ['coin'], nudge: { coin: [0, -4] } },
    { show: ['coin'], nudge: { coin: [0, -5] }, squash: 1 },
    { show: ['coin'], nudge: { coin: [0, -2] } },
    { move: { prop: [0, 1], hands: [0, 1] } },
    {},
  ],
  ticMs: [110, 110, 120, 160, 120, 120, 200],
}
