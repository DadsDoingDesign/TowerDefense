/**
 * Odile d04, refinement option C — Belted Bell. Hand-authored pixel maps (see odile-lib.ts).
 *
 * The cloak is less of a block: cut as a fitted coat, buttoned up the bodice,
 * cinched to a narrow belted waist, then flaring to a wide bell whose hem is
 * cut in five petals like the lily's; below the belt it parts over the rose
 * gown. The satchel is smaller and hangs from the belt at her hip. Boots show
 * under the petals.
 * Tic: she slaps the satchel at her hip (the slap lands on the third frame)
 * and a coin hops out of it and drops back.
 */
import type { Design } from './odile-lib'
import { PAL, CHEEK, EAR_FAR, EAR_NEAR, SHADOW_M } from './odile-common'

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
  '...............tttttttttttttNNNNnnn',
  '...............ttttttttttttttNNNnn',
  '................tttttttttttttNNnnn',
  '................tttwtttttttttNNnnn',
  '................ttwttttttttttNNnn',
  '.................ttttttttttttNNnn',
  '.................tttttttttttttnnn',
  '.................tttttttttttttnnn',
  '..................tttttttttyttnn',
  '..................tttttttttttnnn',
  '..................tttttttttytnnn',
  '...................ttttttttttnn',
  '...................ttttttttyttn',
  '...................tttttttttttN',
  '.................oooooooooyyoooooo',
  '.................uuuuuuuuuyuuuuuuu',
  '...............tttttttttttnjQnNNNNN',
  '..............tttttNttNtttnjQQnNnNNN',
  '.............wttttNtttNttnjjQQnNNnNNN',
  '............wttttNtttNtttnjjQQQnNNnNNN',
  '..........twttttNttttNtttnjjQQQnNNNnNNNN',
  '.........ttwtttNtttttNtttnjjjQQQnNNNnNNNN',
  '........ttwtttNttttttNtttnjjjQQQnNNNNnNNNN',
  '.......ttwttttNtttttNtttnjjjjQQQQnNNNnNNNNN',
  '..NttttttttttNttttttNtttnjjjjQQQQnNNNNnNNNNNNNNN',
  'NNNNttttttttNttttnttNtttnjjjjQQQQQnNNNNnNNNNNNNNnn',
  'NNNNtttttttNtttttnnnNtttnjjjjQQQQQnNNNNNnNNNNNNNnn',
  'NNNNttnnttNtttttnnn.ttttnjjjjjQQQQQnNNnnNnNNNNNnnn',
  'nnNnnnnnnnnnnnnnnnn.nnnnjjjjjQQQQQQnnnnnnnnNnnnnnn',
  '.nnnnnnn..nnnnnnnn...nnnjjjjjQQQQQQQnnnn..nnnnnnn',
  '....n........................................n',
]

const SATCHEL = [
  '..uu',
  '.u..u',
  'oooooooo',
  'ooyyoooo',
  'uuyyuuuu',
  'oooooooo',
  'oooooouu',
  'uuuuuuuu',
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
  '.uoou....uooou',
  '.uoou....uooou',
  '.uoou....uoooou',
  'uuooou...uooooooo',
  'uuuuuu...uuuuuuuu',
]

const COIN = [
  '.y',
  'yo',
]


export const D04_RC: Design = {
  id: 'd04-rc',
  title: 'Belted Bell',
  concept: 'C · Belted bell: the cloak cut as a coat, cinched to a narrow waist, flaring to a petalled hem.',
  pal: PAL,
  headBottom: 53,
  parts: [
    { id: 'shadow', group: 'feet', x: 30, y: 74, rows: SHADOW_M, ring: 0 },
    { id: 'boots', group: 'feet', x: 41, y: 75, rows: BOOTS },
    { id: 'cloak', group: 'body', x: 25, y: 46, rows: CLOAK, squash: [9] },
    { id: 'satchel', group: 'body', x: 33, y: 59, rows: SATCHEL },
    { id: 'hair', group: 'head', x: 29, y: 42, rows: HAIR, spread: [6, 7, 8] },
    { id: 'cheek', group: 'head', x: 54, y: 46, rows: CHEEK },
    { id: 'earL', group: 'head', x: 16, y: 39, rows: EAR_FAR },
    { id: 'earR', group: 'head', x: 69, y: 33, rows: EAR_NEAR },
    { id: 'lotus', group: 'head', x: 42, y: 19, rows: LOTUS, squash: [10] },
    { id: 'pad', group: 'head', x: 25, y: 31, rows: PAD, squash: [4], spread: [6, 7, 8] },
    { id: 'coin', group: 'fx', x: 30, y: 61, rows: COIN, hidden: true },
    { id: 'lantern', group: 'prop', x: 68, y: 63, rows: LANTERN },
    { id: 'handB', group: 'hands', x: 25, y: 60, rows: FIST_B },
    { id: 'handF', group: 'hands', x: 68, y: 60, rows: FIST_F },
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
  // she slaps the satchel at her hip and it rings: the slap lands on the third frame, a coin hops out, and she swings the lantern a touch
  tic: [
    { nudge: { handB: [0, -2] } },
    { nudge: { handB: [3, -1] } },
    { nudge: { handB: [6, 0], satchel: [0, 1] }, show: ['coin'], squash: 1 },
    { nudge: { handB: [5, 0] }, show: ['coin'], at: { coin: [27, 58] } },
    { show: ['coin'], at: { coin: [26, 62] } },
    {},
  ],
  ticMs: [130, 90, 190, 230, 170, 180],
}
