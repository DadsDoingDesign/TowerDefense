/**
 * Odile d04, refinement option E — The Toll, Please. Hand-authored pixel maps (see odile-lib.ts).
 *
 * A stronger posture and a palette lean. She leans into the ask: the whole
 * head rides 4 px forward of her hem, and her front hand is held out flat,
 * palm up, thumb raised, for the coin; the lantern goes to her back fist. The
 * cloak turns Rosethread's own satin rose over a cream gown (the blue goes),
 * so she wears the company's colours against the pad's green and her dark hair.
 * Tic: the toll, please: the palm lifts, a coin drops into it on the third
 * frame and the palm dips with the weight; she nods at the price.
 */
import type { Design } from './odile-lib'
import { PAL, CHEEK, EAR_FAR, EAR_NEAR, SHADOW_M, over } from './odile-common'

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
  '...................QQQQQQQRRRRRRRRr',
  '..................QQQQQQQQRRRRRRRRr',
  '.................QQQQQQQQQQRRRRRRRrr',
  '................QQQQRQQQQQRrRRrFErrr',
  '...............QQQQRQQQQQQRrRRrFErrr',
  '...............QQQQRQQQQQRQRRrFEErRr',
  '..............QQQQRQQQQQQRQRRrFEErRr',
  '.............QQQQQRQQQQQRQQRRrFFEErrr',
  '............QQQQQRQQQQQQRQQRrFFEyErrr',
  '............QQQwQRQQQQQRQQQRrFFyoorRr',
  '...........QQQwQRQQQQQQRQQQRrFFEEErRr',
  '...........QQQQRQQQQQQQRQQQRrFFEEErRrr',
  '..........QQQQQRQQQQQQRQQQQrFFFEEErRRr',
  '.........QQwQQRQQQQQQQRQQQQrFFFEEErRRr',
  '.......QQQwQRQQQQQQQRQQQQQrFFFFEEEErRRRr',
  '.......QQwQQRQQQQQQRQQQQQQrFFFFEEEErRRRr',
  '......QQQwQRQQQQQQQRQQQQQrFFFFEEEEErRRRRr',
  '.....QQQQQRQQQQQQQQRQQQQQrFFFFEEEEErRRRRr',
  '.....QQQQQRQQQQQQQRQQQQQQrFFFFEEEEErRRRRRr',
  '....QQQQQRQQQQQQQQRQQQQQQrFFFFEEEEErRRRRRr',
  '...QQQQQQRQQQQQQQRQQQQQQrFFFFFEEEEErRRRRRRr',
  '...RQQQQRQQQQQQQQRQQQQQQrFFFFFEEEEEErRRRRRR',
  '..RRQQQQRQQQQQQQRQQQQQQQrFFFFFEEEEEErRRRRRrr',
  '.rrrrrrrrrrrrrrrrrrrrrrrrFFFFFEEEEEErrrrrrrrr',
  '..rrrrrrrrrrrrrrrrrrrrrrFFFFFEEEEEEErrrrrrrr',
  '.......................rFFFFFEEEEEEEr',
]

const STRAP = [
  '......uu',
  '.....uu',
  '....uu',
  '...uu',
  '..uu',
  '.uu',
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

const BOOTS = [
  '.uoou....uooou',
  '.uoou....uooou',
  '.uoou....uoooou',
  'uuooou...uooooooo',
  'uuuuuu...uuuuuuuu',
]

const PALM = [
  '.....E',
  '....EE',
  'EEEEEEFF',
  'eEEEEEEF',
  '.eeeeee',
]

const PALM_DIP = [
  '.....E',
  '....EE',
  'EEEEEEFF',
  'eEyEEEEF',
  '.eeeeee',
]

const COIN = [
  '.y',
  'yo',
]

/** The cloak with the satchel's strap laid across it. */
const CLOAK_STRAPPED = over(CLOAK, [[9, 9, STRAP]])

export const D04_RE: Design = {
  id: 'd04-re',
  title: 'The Toll, Please',
  concept: 'E · The toll, please: leaning in, palm out for the coin; the cloak turns Rosethread rose.',
  pal: PAL,
  headBottom: 53,
  parts: [
    { id: 'shadow', group: 'feet', x: 32, y: 71, rows: SHADOW_M, ring: 0 },
    { id: 'boots', group: 'feet', x: 41, y: 72, rows: BOOTS },
    { id: 'cloak', group: 'body', x: 27, y: 46, rows: CLOAK_STRAPPED, squash: [12] },
    { id: 'satchel', group: 'body', x: 34, y: 61, rows: SATCHEL },
    { id: 'hair', group: 'head', x: 33, y: 42, rows: HAIR, spread: [6, 7, 8] },
    { id: 'cheek', group: 'head', x: 58, y: 46, rows: CHEEK },
    { id: 'earL', group: 'head', x: 20, y: 39, rows: EAR_FAR },
    { id: 'earR', group: 'head', x: 73, y: 33, rows: EAR_NEAR },
    { id: 'lotus', group: 'head', x: 46, y: 19, rows: LOTUS, squash: [10] },
    { id: 'pad', group: 'head', x: 29, y: 31, rows: PAD, squash: [4], spread: [6, 7, 8] },
    { id: 'lantern', group: 'prop', x: 22, y: 61, rows: LANTERN },
    { id: 'coin', group: 'fx', x: 77, y: 47, rows: COIN, hidden: true },
    { id: 'handB', group: 'hands', x: 22, y: 58, rows: FIST_B },
    { id: 'palm', group: 'hands', x: 71, y: 55, rows: PALM },
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
  // the toll, please: the palm lifts, a coin drops into it on the third frame and the palm dips with its weight; she weighs it and nods
  tic: [
    { nudge: { palm: [0, -1] }, show: ['coin'] },
    { nudge: { palm: [0, -1] }, show: ['coin'], at: { coin: [77, 51] } },
    { swap: { palm: PALM_DIP }, nudge: { palm: [0, 1] }, squash: 1 },
    { swap: { palm: PALM_DIP }, nudge: { palm: [0, 1], pad: [1, 1], lotus: [1, 1], hair: [1, 0] } },
    { swap: { palm: PALM_DIP } },
    {},
  ],
  ticMs: [160, 100, 190, 260, 180, 170],
}
