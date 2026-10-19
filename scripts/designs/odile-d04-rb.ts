/**
 * Odile d04, refinement option B — Great Pad. Hand-authored pixel maps (see odile-lib.ts).
 *
 * The hat as the whole read: the lily pad grows to 64 px, far wider than she
 * is, its bloom on a tall stalk; under it the cloak is cut slim and tapering
 * (narrow shoulders, a gentle flare), so the pad is the widest thing by far
 * and the ears tuck out beneath its rim. Boots under the hem.
 * Tic: a bead of river water gathers at the pad's rim, falls past her, and
 * splashes at her boots on the third frame; the bud nods.
 */
import type { Design } from './odile-lib'
import { PAL, CHEEK, EAR_FAR, EAR_NEAR, SHADOW_M, over } from './odile-common'

const PAD = [
  '....................VVVVVVVVVVvvvvvvvvvvvvvG',
  '............VVVVVVVVGGVVVVVVVVVVVVVvvvvvvvGvvvvvvvvv',
  '.......VVVVVVVVVVVwwVVGGVVVVVVVVVVVVVvvGGGvvvvvvvvvvvvvvv',
  '....VVVVVVVVwVVVVVVVVVVVGGVVVVVVVVVVVvGvvvvvvvvvvvvvvvvvGGGG',
  '..vvvvVVVVVVVVVVVVVVVVVVVVGGGVVVVVVGGGvvvvvvvvGGGGGGGGGGvvvvvv',
  '.vvvvvvvvvvVVVVVVVVVVVVVVVVVVGGvvvGvvGGGGGGGGGvvvvvvvvvvvvvvvvv',
  'vvvvvvvvvvvvvvvvvvvGGGGGGGGGGGGGGGGGGGGGGGGGvvvvvvvvvvvvvvvvvvGG',
  '.vvvvvGGGGGGGGGGGGGvvvvvvvvvvvvvv.GvvvvvvvvvGGGGGGGGGGGGGGGGGGG',
  '.GGvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv.GGvvvvvvvvvvvvvvvvvvvvvGGGG',
  '.GGGGGvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv...GvvvvvvvvvvvvvvvvGGGGGGG',
  '...GGGGGGGGvvvvvvvvvvvvvvvvvvvvvvvvvv....GvvvvvvvvvGGGGGGGGGG',
  '.....GGGGGGGGGGGGGGvvvvvvvvvvvvvvvvvvvv....GGGGGGGGGGGGGGGG',
  '.........GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG.....GGGGGGGGGG',
  '...............GGGGGGGGGGGGGGGGGGGGGGGGGGG......G',
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
  '......gG',
  '......gG',
  '......gG',
  '.....ggG',
]

const HAIR = [
  '...pppppppppppppppppppppppppppppp',
  '..ppppppppppppppppppppppppppppppp',
  '.ppppPPPPPPPPpppppppppppppp',
  'pppPPPPPPPPPPPPppppppppp',
  'ppPPiPPPPPPiPPPPpppipppp',
  '.pPPPPPPPPPPPPPPpppPpppp',
  '.ppPPPPPPPPPPPPppppPpppp',
  '.ppppPpPPPPPPpppppppPppp',
  '.ppppppppkppppppkppppppp',
  '..pppppp.kppppppkpppppp',
  '...pppp..ppppppp..pppp',
  '...........ppp',
]

const CLOAK = [
  '...........ttttttttNNNNNn',
  '..........tttttttttNNNNNn',
  '..........ttttttttttNNNNnn',
  '..........tttNtttNttnjQnNn',
  '.........ttttNtttNttnjQnNn',
  '.........tttNttttNttnjQnNnn',
  '.........tttNtttNtttnjQQnNn',
  '........ttttNtttNtttnjQQnNn',
  '........ttttNtttNtttnjyQnNnn',
  '........tttwttttNttnjyoonNNn',
  '.......tttwNttttNttnjjQQnNNn',
  '.......ttttNttttNttnjjQQQnNnn',
  '.......ttttNtttNtttnjjQQQnNNn',
  '......twttNttttNtttnjjQQQnNNn',
  '......twttNttttNtttnjjQQQnNNnn',
  '......wtttNttttNtttnjjQQQnNNNn',
  '.....twtttNttttNtttnjjjQQQnNNn',
  '.....twttNtttttNtttnjjjQQQnNNNn',
  '.....wtttNttttNttttnjjjQQQnNNNn',
  '....twtttNttttNttttnjjjQQQnNNNNn',
  '...ttttttNttttNttttnjjjQQQnNNNNN',
  '...tttttNtttttNttttnjjjQQQQnNNNNn',
  '..ttttttNtttttNtttnjjjjQQQQnNNNNNn',
  '..ttttttNtttttNtttnjjjjQQQQnNNNNNn',
  '.NttttttNttttNttttnjjjjQQQQnNNNNnnn',
  '.nnnnttNtttttNtttNnjjjjQQQQnnnnnnnn',
  '..nnnnnnnnnnnnnnnnnjjjjQQQQQnnnnnn',
  '.......nnnnnnnnnnnnjjjjQQQQQn',
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

const DROP = [
  '.B',
  'Bw',
  'BB',
]

const SPLASH = [
  'B...B',
  '.B.B.',
  'BwBwB',
]

const SPLASH_WIDE = [
  'B.....B',
  '.B...B.',
  '..BwB..',
]

/** The cloak with the satchel's strap laid across it. */
const CLOAK_STRAPPED = over(CLOAK, [[2, 9, STRAP]])

export const D04_RB: Design = {
  id: 'd04-rb',
  title: 'Great Pad',
  concept: 'B · Great pad: the hat leads hard, far wider than her slim, tapering cloak.',
  pal: PAL,
  headBottom: 54,
  parts: [
    { id: 'shadow', group: 'feet', x: 33, y: 71, rows: SHADOW_M, ring: 0 },
    { id: 'boots', group: 'feet', x: 42, y: 72, rows: BOOTS },
    { id: 'cloak', group: 'body', x: 32, y: 46, rows: CLOAK_STRAPPED, squash: [12] },
    { id: 'satchel', group: 'body', x: 34, y: 60, rows: SATCHEL },
    { id: 'hair', group: 'head', x: 32, y: 42, rows: HAIR, spread: [6, 7, 8] },
    { id: 'cheek', group: 'head', x: 56, y: 46, rows: CHEEK },
    { id: 'earL', group: 'head', x: 19, y: 46, rows: EAR_FAR },
    { id: 'earR', group: 'head', x: 69, y: 45, rows: EAR_NEAR },
    { id: 'lotus', group: 'head', x: 43, y: 9, rows: LOTUS, squash: [12] },
    { id: 'pad', group: 'head', x: 18, y: 28, rows: PAD, squash: [5], spread: [7, 8, 9] },
    { id: 'drop', group: 'fx', x: 13, y: 51, rows: DROP, hidden: true },
    { id: 'splash', group: 'fx', x: 12, y: 70, rows: SPLASH, hidden: true },
    { id: 'lantern', group: 'prop', x: 62, y: 60, rows: LANTERN },
    { id: 'handB', group: 'hands', x: 29, y: 57, rows: FIST_B },
    { id: 'handF', group: 'hands', x: 62, y: 57, rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1, nudge: { cheek: [0, 1], hair: [0, 1] } },
    { squash: 2, squashBy: { cloak: 1 }, spread: 1, move: { hands: [0, 1], prop: [0, 1] }, nudge: { cheek: [0, 1], hair: [0, 1], earL: [0, 1], earR: [0, 1], lotus: [0, 1] } },
    { squash: 2, squashBy: { cloak: 1 }, spread: 1, move: { hands: [0, 1], prop: [0, 1] }, nudge: { cheek: [0, 1], hair: [0, 1], earL: [0, 2], earR: [0, 2], lotus: [0, 2] } },
    { squash: 1, nudge: { cheek: [0, 1], hair: [0, 1], earL: [0, 2], earR: [0, 2], lotus: [0, 2] } },
    { nudge: { earL: [0, 1], earR: [0, 1], lotus: [0, 1] } },
  ],
  idleMs: [190, 130, 150, 200, 150, 170],
  // the great pad sheds the river: a bead gathers at its rim, falls, and splashes at her boots on the third frame; the bud nods
  tic: [
    { show: ['drop'], squash: 1 },
    { show: ['drop'], at: { drop: [13, 60] }, nudge: { lotus: [-1, 0] } },
    { show: ['splash'], nudge: { lotus: [-1, 1] } },
    { show: ['splash'], swap: { splash: SPLASH_WIDE }, at: { splash: [11, 70] }, nudge: { lotus: [0, 1] } },
    { nudge: { lotus: [0, 0] } },
    {},
  ],
  ticMs: [200, 110, 190, 240, 160, 160],
}
