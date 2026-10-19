/**
 * Hask design 10 — the Weighmaster. Hand-authored pixel maps (see hask-lib.ts).
 *
 * Keeps Butcherblock's scale at the salt quay, where every block and side is
 * weighed before it is paid for: a tall brine-red felt capotain with a bone
 * band and a brass buckle, a high-collared hide coat with bone buttons, and
 * the quay balance hung from his fist, salt in one pan, held low.
 * Silhouette: a tall flat-topped hat on a high collar. Tic: he drops a coin
 * in the other pan; the beam tips, then settles.
 */
import type { Design } from './hask-lib'
import { PAL, FEET, SHADOW_W, FIST_B, FIST_F, SNOUT, TAIL, TAIL_DOWN, bell } from './hask-common'

const HAT = [
  '.........QQQQQQQQQRRRRRRR',
  '........RRRRRRRRRRRRpppprr',
  '........QRRRRRRRRRRRpppprr',
  '........QRQRRRRRRRRRpppprr',
  '........QRRRRRRRRRRRpppprr',
  '........QRRRRRRRRRRRRppprr',
  '.......QRRQRRRRRRRRRRpppprr',
  '.......QRRRRRRRRRRRRRpppprr',
  '.......QRRRRRRRRRRRRRpppprr',
  '.......QRRQRRRRRRRRRRpppprr',
  '.......QRRRRRRRRRRRRRpppprr',
  '.......QRRRRRRRRRRRRRRppprr',
  '......QRRRRRRRRRRRRRRRpppprr',
  '......ddddddddddddddKKKKdddd',
  '......CCCCCCCCCCCCCCKkuKCCCC',
  '......ccccccccccccccoooocccc',
  '......rrrrrrrrrrrrrrrrrrrrrr',
  '.RQQQQQQQRRRRRRRRRRRRRRRRRRRRRRRpp',
  'ppppppppppppppppppppppppppppppppprr',
  '.rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
]

/** The coat's high standing collar, up to the brim behind his cheek. */
const COLLAR = [
  '...iiHHHHHHHHd',
  '..iiHHHHHHHHHdd',
  '.iiHHHHHHHHHhhd',
  '.iHHHHHHHHHHhhd',
  'iiHHHHHHHHHhhhd',
  'iHHHHHHHHHHhhdd',
  'iHHHHHHHHHhhhd',
  'hHHHHHHHHhhhdd',
  'hhHHHHHhhhhdd',
  '.hhhhhhhhhdd',
]

const EYE = ['yw']

const BODY = bell({ d: 'h', m: 'H', l: 'i', t: 'h' }, {
  1: '.....hhHHHHHHHHHHHHdHHHHii',
  3: '....hhhHHHHHHHHHHHHdHHHHHii',
  5: '...hhhhHHHHHHHHHHHHdHHHHHHii',
  7: '..hhhhHHHHHHHHHHHHHdHHHHHHHii',
  9: '.hhhhhHHHHHHHHHHHHHdHHHHHHHHii',
})

/** The quay balance, hung from his fist: a brass beam on chains, salt in one pan, the coin pan empty. */
const BALANCE = [
  '.......NN',
  '.......xN',
  'xxxxxxxxxxxxxxxx',
  'NnnnnnnNNnnnnnnn',
  'N..............N',
  'N..............N',
  'N..............N',
  'mmL............N',
  'mLLb...........N',
  'KKKKo.......KKKKo',
  '.ooo.........ooo',
]
/** The beam tipped: the coin pan down a pixel, the salt pan up. */
const BALANCE_TIP = [
  '.......NN',
  '.......xN',
  'xxxxxxxxxxxxxxxx',
  'NnnnnnnNNnnnnnnn',
  'N..............N',
  'N..............N',
  'mmL............N',
  'mLLb...........N',
  'KKKKo..........N',
  '.ooo...........N',
  '............KKKKo',
  '.............ooo',
]
/** A coin dropped into the pan. */
const COIN = ['yK', 'Ko']

export const D10: Design = {
  id: 'd10',
  title: 'Weighmaster',
  concept: 'Keeps Butcherblock’s scale at the salt quay: a tall brine-red felt capotain with a bone band and brass buckle, a high-collared hide coat, the quay balance hung low with salt in one pan.',
  pal: PAL,
  headBottom: 56,
  parts: [
    { id: 'shadow', group: 'feet', x: 22, y: 72, rows: SHADOW_W, ring: 0 },
    { id: 'tail', group: 'back', x: 13, y: 57, rows: TAIL },
    { id: 'feet', group: 'feet', x: 41, y: 69, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 35, y: 56, rows: BODY },
    { id: 'collar', group: 'head', x: 36, y: 43, rows: COLLAR, squash: [3] },
    { id: 'snout', group: 'head', x: 50, y: 43, rows: SNOUT },
    { id: 'hat', group: 'head', x: 25, y: 21, rows: HAT, squash: [4, 8, 11] },
    { id: 'eye', group: 'head', x: 66, y: 44, rows: EYE, ring: 0 },
    { id: 'handB', group: 'hands', x: 31, y: 60, rows: FIST_B },
    { id: 'balance', group: 'prop', x: 54, y: 61, rows: BALANCE, ring: 1 },
    { id: 'coin', group: 'fx', x: 67, y: 62, rows: COIN, ring: 1, hidden: true },
    { id: 'handF', group: 'hands', x: 59, y: 58, rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1 },
    { squash: 2, nudge: { snout: [0, 1], eye: [0, 1] }, move: { hands: [0, 1] } },
    { squash: 2, nudge: { snout: [0, 1], eye: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, move: { prop: [0, 1] } },
    {},
  ],
  idleMs: [220, 150, 180, 220, 150, 200],
  tic: [
    { show: ['coin'] },
    { show: ['coin'], nudge: { coin: [0, 3] } },
    { swap: { balance: BALANCE_TIP, tail: TAIL_DOWN } },
    { swap: { balance: BALANCE_TIP, tail: TAIL_DOWN } },
    { squash: 1 },
    {},
  ],
  ticMs: [160, 120, 240, 360, 200, 200],
}
