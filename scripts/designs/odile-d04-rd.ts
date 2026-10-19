/**
 * Odile d04, refinement option D — Wading the Ford. Hand-authored pixel maps (see odile-lib.ts).
 *
 * She stands in the ford she keeps: the cloak cut to the knee and its front
 * corner caught up in her fist, so the hem rises to the right; tall river
 * boots to the knee, wet and lit, stand in a pale ring of ford water (drawn
 * see-through, like the pack's ground shadow). The hands swap jobs: the
 * lantern hangs from her back fist, the satchel rides her front hip.
 * Tic: she stamps the near boot for the toll: lifted, the stamp lands on the
 * third frame and throws a splash, the ripples spreading.
 */
import type { Design } from './odile-lib'
import { PAL, CHEEK, EAR_FAR, EAR_NEAR, over } from './odile-common'

const PAD = [
  '..............VVVVVVVVVvvvvvvvvGvvvv',
  '........VVVVVGGVVVVVVVVVVVVvvvGvvvvvvvvvvv',
  '....VVVVVVVVVVwwGGVVVVVVVVVVGGvvvvvvvvvvvvvvvv',
  '..vVVVVVVwVVVVVVVVGGGVVVVVVGVvvvvvvvvvvvvvvvvvvv',
  '.vvvvVVVVVVVVVVVVVVVVGGGVVGvvvvvvvvGGGGGGGGGGGvvG',
  '.vvvvvvvvVVVVVVGGGGGGGGGGGGGGGGGGGGvvvvvvvvvvvvGG',
  '.GGvGGGGGGGGGGGvvvvvvvvvvvv.GvvvvvvvvvvvvvvvvGGGG',
  '.GGGGGGvvvvvvvvvvvvvvvvvvvvv..GGvvvvvvvvvGGGGGGGG',
  '..GGGGGGGGGGGvvvvvvvvvvvvvvvvv...GvGGGGGGGGGGGGG',
  '.....GGGGGGGGGGGGGGGGGGGGGGGGGG....GGGGGGGGGG',
  '..........GGGGGGGGGGGGGGGGGGGGGG.....GGG',
  '',
]

const LOTUS = [
  '.......j',
  '......jjQ',
  '..j..jjQQR..R',
  '.jjQ.jjQQRRRr',
  '.jjQQjjQRRRrr',
  '..jQQjQQRRRr',
  '..jjQQQRRRrr',
  '...QQQRRRrr',
  '....rrRRrr',
  '......gG',
  '......gG',
  '......gG',
  '......gG',
  '......gG',
]

const HAIR = [
  '...pppppppppppppppppppppppppppppppppp',
  '..pppppppppppppppppppppppppppppppppp',
  '.ppppPPPPPPPPpppppppppppppppp',
  'pppPPPPPPPPPPPPpppppppppp',
  'ppPPiPPpPPPPiPpPppppipppp',
  '.pPPPPPPpPPPPPPpppppPpppp',
  '.ppPPPPPP.PPPPPp.pppPpppp',
  '.ppppPpPPpPPPPpppppppPppp',
  '.ppppPpppkpppPpppkpppPppp',
  '..pppppp.kpppppppkppppppp',
  '...pppp...pppppp...pppp',
  '............pp',
]

const CLOAK = [
  '..............tttttttttttNNNNNn',
  '.............ttttttttttttNNNNNNn',
  '............tttttttttttttNNNNNNN',
  '...........tttttNtttttNtttnjQnNNn',
  '..........ttttttNtttttNtttnjQnNNNn',
  '.........ttttttNttttttNtttnjQQnNNn',
  '........tttttttNtttttNtttnjjQQnNNNn',
  '........tttttttNtttttNtttnjjQQnNNNN',
  '.......tttttttwttttttNtttnjjyQQnNNNN',
  '......tttttttwNttttttNtttnjyooQnNNNNN',
  '......ttttttttNttttttNtttnjjQQQnNNNNNn',
  '.....ttttttttNtttttttNtttnjjQQQnNNNNNNn',
  '....ttttttwttNttttttNtttnjjjQQQQnNNNNNN',
  '....ttttttwtNtttttttNtttnjjjQQQQnNNNNNNN....n',
  '...ttttttwttNtttttttNtttnjjjQQQQnNNNNNNNN..nnn',
  '..tttttttwttNtttttttNtttnjjjQQQQnNNNNNNNNNnnn',
  '..tttttttwtNttttttttNtttnjjjjQQQQnNNNNNNNnnnn',
  '.NttttttwttNttttttttNtttnjjjjQQQQnNnnnnnnnnn',
  '.nnnntttwttNtttttttNtttnjjjjQQQQQnnnnnnnnnn',
  '..nnnnnnnnnnnnnnnnnnnnnnjjjjjQQQQQnnn',
  '.......nnnnnnnnnnnnnnnnnjjjjjQQQQQn',
  '',
]

const STRAP = [
  'uu......',
  'uu.....',
  'uu....',
  'uu...',
  'uu..',
  'uu.',
  'uu',
]

const SATCHEL = [
  'oOOOOOOOOo',
  'OOOOOOOOOo',
  'OwOOyyOOOo',
  'uuuuyyuuuu',
  'ooooooooou',
  'ooooooooou',
  'oooooooouu',
  'uuuuuuuuuu',
]

const LANTERN = [
  '...uu',
  '..u..u',
  '..u..u',
  '.uuuuuu',
  'uuoooooU',
  'uywwyyyu',
  'uyyyuyyu',
  'uywyuyyu',
  'uyyyuyyu',
  'uyyyuyyu',
  'uuoooooU',
  '.uuuuuu',
  '...uu',
]

const FIST_B = [
  '.EE.E',
  'EEEEEE',
  'eeeeEE',
  'eEEEEe',
  'eeEEee',
  '.eeee',
]

const FIST_F = [
  '.E.EE',
  'EEEEEE',
  'EeeeeE',
  'eEEEEE',
  'eeEEEe',
  '.eeee',
]

const BOOTS = [
  '.uooou......uoooou',
  '.uooou......uoooou',
  '.uowou......uowoou',
  '.uooou......uoooou',
  '.uooou......uoooou',
  'uuooou......uooooou',
  'uuooooou....uoooooooo',
  'uuuuuuuu....uuuuuuuuu',
]

const WATER = [
  '..............tttttttttttttttt',
  '.......tttttttttNNNNNNNNNNNNttwtttttt',
  '...tttttNNNNNNNttttttttttttttNNNNNNNttttt',
  '.tttwwNNNttttttNNNNNNNNNNNNNNttttttNNNNtttt',
  'ttttNNNNttttNNNNNNNNNNNNNNNNNNNNttttNNNNtttt',
  '.ttttNNNNttttttNNNNNNNNNNNNNNttttttNwwNtttt',
  '...tttttNNNNNNNttttttttttttttNNNNNNNttttt',
  '.......tttttwtttNNNNNNNNNNNNttttttttt',
  '..............tttttttttttttttt',
]

const WATER_RING = [
  '..............tttttttttttttttt',
  '.......tttttttttwwwwwwwwwwwwttwtttttt',
  '...tttttwwwwwwwttttttttttttttwwwwwwwttttt',
  '.tttwwwwwttttttwwwwwwwwwwwwwwttttttwwwwtttt',
  'ttttwwwwttttwwwwwwwwwwwwwwwwwwwwttttwwwwtttt',
  '.ttttwwwwttttttwwwwwwwwwwwwwwttttttwwwwtttt',
  '...tttttwwwwwwwttttttttttttttwwwwwwwttttt',
  '.......tttttwtttwwwwwwwwwwwwttttttttt',
  '..............tttttttttttttttt',
]

const SPLASH = [
  'w..w..w',
  '.w.w.w.',
  '..www..',
]

const SPLASH_UP = [
  '.w...w.',
  'w..w..w',
  '.w.w.w.',
  '..www..',
]

/** The cloak with the satchel's strap over her left shoulder down to her right hip. */
const CLOAK_STRAPPED = over(CLOAK, [[25, 3, STRAP]])

export const D04_RD: Design = {
  id: 'd04-rd',
  title: 'Wading the Ford',
  concept: 'D · Wading the ford: cloak hitched up in her fist, tall boots in the water, lantern in the other hand.',
  pal: PAL,
  headBottom: 53,
  parts: [
    { id: 'water', group: 'feet', x: 28, y: 70, rows: WATER, alpha: 199 },
    { id: 'boots', group: 'feet', x: 38, y: 65, rows: BOOTS },
    { id: 'cloak', group: 'body', x: 27, y: 46, rows: CLOAK_STRAPPED, squash: [12] },
    { id: 'satchel', group: 'body', x: 58, y: 57, rows: SATCHEL },
    { id: 'hair', group: 'head', x: 29, y: 42, rows: HAIR, spread: [6, 7, 8] },
    { id: 'cheek', group: 'head', x: 54, y: 46, rows: CHEEK },
    { id: 'earL', group: 'head', x: 16, y: 39, rows: EAR_FAR },
    { id: 'earR', group: 'head', x: 69, y: 33, rows: EAR_NEAR },
    { id: 'lotus', group: 'head', x: 42, y: 19, rows: LOTUS, squash: [10] },
    { id: 'pad', group: 'head', x: 25, y: 31, rows: PAD, squash: [4], spread: [6, 7, 8] },
    { id: 'splash', group: 'fx', x: 50, y: 68, rows: SPLASH, hidden: true },
    { id: 'lantern', group: 'prop', x: 21, y: 61, rows: LANTERN },
    { id: 'handB', group: 'hands', x: 21, y: 58, rows: FIST_B },
    { id: 'handF', group: 'hands', x: 69, y: 59, rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1, nudge: { cheek: [0, 1], hair: [0, 1] } },
    { squash: 2, squashBy: { cloak: 1 }, spread: 1, move: { hands: [0, 1], prop: [0, 1] }, nudge: { cheek: [0, 1], hair: [0, 1], earL: [0, 1], earR: [0, 1] } },
    { squash: 2, squashBy: { cloak: 1 }, spread: 1, move: { hands: [0, 1], prop: [0, 1] }, nudge: { cheek: [0, 1], hair: [0, 1], earL: [0, 2], earR: [0, 2] } },
    { squash: 1, nudge: { cheek: [0, 1], hair: [0, 1], earL: [0, 2], earR: [0, 2] } },
    { nudge: { earL: [0, 1], earR: [0, 1] } },
  ],
  idleMs: [190, 130, 150, 200, 150, 170],
  // she stamps the near boot in the ford for the toll: lifted, the stamp on the third frame throws a splash; the ripples spread
  tic: [
    { nudge: { boots: [0, -1], cloak: [0, -1] }, squash: 1 },
    { nudge: { boots: [1, -2] } },
    { show: ['splash'], swap: { water: WATER_RING }, squash: 2, squashBy: { cloak: 1 } },
    { show: ['splash'], swap: { splash: SPLASH_UP, water: WATER_RING }, at: { splash: [50, 66] } },
    { swap: { water: WATER_RING } },
    {},
  ],
  ticMs: [140, 100, 190, 230, 180, 160],
}
