/**
 * Odile d04, refinement option A — The Elf Leads. Hand-authored pixel maps (see odile-lib.ts).
 *
 * The cheek-and-ear merge solved for good, and the elf pushed to the front:
 * bigger, broader leaf ears lifted well clear of everything; a bigger cheek
 * and pointed nose in a rounded window of dark hair, a lock hanging on its far
 * side, so skin never touches skin (face, dark lock, ear); the pad a little
 * smaller (44 px) so the ears and face carry the read. The cloak is cut 3 px
 * shorter so her river boots show. The ears follow through a frame behind the bob.
 * Tic: her ears prick at a barge's bell, then the toll: the lantern swings
 * back, then out at arm's length on the third frame, blazing.
 */
import type { Design } from './odile-lib'
import { PAL, SHADOW_M, over } from './odile-common'

const PAD = [
  '............VVVVVVVVvvvvvvvGvvvv',
  '......VVVVVGGVVVVVVVVVVVvvGvvvvvvvvvvv',
  '...VVVVVVVVVwwGGGVVVVVVVGGvvvvvvvvvvvvvvv',
  '.vvVVVVVwVVVVVVVVGGGGVVGVvvvvvvvvvvvvvvvvvv',
  'vvvvVVVVVVVVVVVVVVGGGGGGGGGGGGGGGGGGGGGGGvGG',
  '.GvvvvvvVGGGGGGGGGVVvvv.GvvvvvvvvvvvvvvvGGG',
  '.GGGGGGGGvvvvvvvvvvvvvvvv.GvvvvvvvvvvGGGGGG',
  '..GGGGGGGGGvvvvvvvvvvvvvvv..GvvGGGGGGGGGGG',
  '....GGGGGGGGGGGGGGGGGGGGGGG...GGGGGGGGGG',
  '........GGGGGGGGGGGGGGGGGGGG....GGGG',
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

const LOTUS_OPEN = [
  '.......j',
  'j.....jjQ....R',
  'jj.j..jjQQR.RR',
  '.jjjQ.jjQQRRRr',
  '..jjQQjQQRRRr',
  '..jjQQjQRRRrr',
  '...jQQQRRRrr',
  '....QQRRRrr',
  '.....rRRrr',
  '......gG',
  '......gG',
  '......gG',
  '......gG',
  '......gG',
]

const HAIR = [
  '...ppppppppppppppppppppppppppppppppp',
  '..ppppppppppppppppppppppppppppppppppp',
  '.ppppPPPPPPPPppppppppp.....pppppppppp',
  'pppPPPPPPPPPPPPppppp.........ppppppppp',
  'ppPPiPPpPPPPiPppppp...........pppipppp',
  '.pPPPPPPpPPPPPPppp.............ppPppp',
  '.ppPPPPPP.PPPPPp...............ppPppp',
  '.ppppPpPPPPPPPppp...............ppPppp',
  '.ppppPpppkpppPppp...............ppPppp',
  '..pppppp.kppppppp..............ppppppp',
  '...pppp...pppppp...............pppppp',
  '............pp..................pppp',
]

const FACE = [
  '.EEEEEEFF',
  'EEEEEEEFFF',
  'eEEEEEEEFFw',
  'eEEEEEEEEFF',
  '.eEEEEEEE',
  '..eeEEEe',
  '....ee',
]

const EAR_L = [
  'FF',
  'FEE',
  'FEEEEE',
  '.FEEEEEEE',
  '..FEEEEEEEe',
  '...EEEeeeEEee',
  '....EEEEEeeeee',
  '......EEEEeee',
  '........eee',
]

const EAR_R = [
  '..............FF',
  '............EEF',
  '.........EEEEEF',
  '......EEEEEEEF',
  '...eEEEEEEEEF',
  '.eeEEEeeeEEF',
  'eeEEeeEEEEE',
  'eeeEEEEEE',
  '.eeeEEE',
  '..eee',
]

const CLOAK = [
  '...............ttttttttttNNNNNn',
  '..............tttttttttttNNNNNNn',
  '..............ttttttttttttNNNNNn',
  '.............tttNtttttNtttnjQnNnn',
  '.............tttNtttttNtttnjQnNNn',
  '.............ttNttttttntttnjQQnNn',
  '............tttNtttttNttttnjQQnNNn',
  '............ttNttttttNtttnjjQQnNNn',
  '...........tttNttttttNtttnjjyQQnNNn',
  '...........tttwtttttNttttnjyooQnNNn',
  '..........tttwttttttNttttnjjQQQnNNNn',
  '..........tttNttttttNttttnjjQQQnNNNn',
  '.........ttttNttttttNttttnjjjQQQnNNnn',
  '.........twtNtttttttnttttnjjjQQQnNNNn',
  '.......ttwtNttttttNtttttnjjjjQQjQnNNNNn',
  '.......twtNtttttttNtttttnjjjjQQQjnNNNNn',
  '......ttwtNtttttttNtttttnjjjjQQQjQnNNNnn',
  '.....tttttNtttttttNtttttnjjjQQQQjQnNNNNnn',
  '.....ttttNttttttttntttttnjjjQQQQjQnNNNNnN',
  '....tttttNtttttttNttttttnjjjQQQQjQnNNNNNnn',
  '...tttttNttttttttNttttttnjjjQjQQjQQnNNNNnNn',
  '...tttttNttttttttNtttttnjjjjQQQQQjQnNNNNnNN',
  '..NtttttNtttttttNttttttnjjjjQQQQQjQnNNNNNnnn',
  '.nnnnnnnnnnnnnnnnnnnnnnnjjjjQQQQQjQnnnnnnnnnn',
  '..nnnnnnnnnnnnnnnnnnnnnnjjjjQQQQQjQQnnnnnnnn',
  '.......................njjjjjQQQQQQQn',
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

const LANTERN_BRIGHT = [
  '...uu',
  '..u..u',
  '..u..u',
  '.uuuuuu',
  'uuOOOOOU',
  'uywwyyyu',
  'uyyyuyyu',
  'uywyuyyu',
  'uyyyuyyu',
  'uyyyuyyu',
  'uuOOOOOU',
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

/** The cloak with the satchel's strap laid across it. */
const CLOAK_STRAPPED = over(CLOAK, [[6, 9, STRAP]])

export const D04_RA: Design = {
  id: 'd04-ra',
  title: 'The Elf Leads',
  concept: 'A · The elf leads: big leaf ears clear of all, a face you can find, a smaller pad; the cheek-and-ear merge fixed.',
  pal: PAL,
  headBottom: 53,
  parts: [
    { id: 'shadow', group: 'feet', x: 32, y: 71, rows: SHADOW_M, ring: 0 },
    { id: 'boots', group: 'feet', x: 41, y: 72, rows: BOOTS },
    { id: 'cloak', group: 'body', x: 27, y: 46, rows: CLOAK_STRAPPED, squash: [12] },
    { id: 'satchel', group: 'body', x: 32, y: 60, rows: SATCHEL },
    { id: 'face', group: 'head', x: 49, y: 45, rows: FACE },
    { id: 'hair', group: 'head', x: 30, y: 41, rows: HAIR, spread: [6, 7, 8] },
    { id: 'earL', group: 'head', x: 13, y: 37, rows: EAR_L },
    { id: 'earR', group: 'head', x: 70, y: 30, rows: EAR_R },
    { id: 'lotus', group: 'head', x: 41, y: 20, rows: LOTUS, squash: [10] },
    { id: 'pad', group: 'head', x: 28, y: 31, rows: PAD, squash: [4], spread: [5, 6, 7] },
    { id: 'lantern', group: 'prop', x: 66, y: 60, rows: LANTERN },
    { id: 'handB', group: 'hands', x: 26, y: 57, rows: FIST_B },
    { id: 'handF', group: 'hands', x: 66, y: 57, rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1, nudge: { face: [0, 1], hair: [0, 1] } },
    { squash: 2, squashBy: { cloak: 1 }, spread: 1, move: { hands: [0, 1], prop: [0, 1] }, nudge: { face: [0, 1], hair: [0, 1], earL: [0, 1], earR: [0, 1] } },
    { squash: 2, squashBy: { cloak: 1 }, spread: 1, move: { hands: [0, 1], prop: [0, 1] }, nudge: { face: [0, 1], hair: [0, 1], earL: [0, 2], earR: [0, 2] } },
    { squash: 1, nudge: { face: [0, 1], hair: [0, 1], earL: [0, 2], earR: [0, 2] } },
    { nudge: { earL: [0, 1], earR: [0, 1] } },
  ],
  idleMs: [190, 130, 150, 200, 150, 170],
  // her ears prick at a barge's bell, then the toll: the lantern swings back, out at arm's length on the third frame, blazing; held, then home
  tic: [
    { nudge: { earL: [-1, -1], earR: [1, -1], handF: [-1, 0], lantern: [-2, 0] } },
    { nudge: { earL: [-1, -2], earR: [1, -2], handF: [1, 0], lantern: [1, 0] } },
    { nudge: { earL: [-1, -1], earR: [1, -1], handF: [2, 0], lantern: [3, 0] }, swap: { lantern: LANTERN_BRIGHT, lotus: LOTUS_OPEN } },
    { nudge: { handF: [2, 0], lantern: [3, 0] }, swap: { lantern: LANTERN_BRIGHT, lotus: LOTUS_OPEN } },
    { nudge: { handF: [1, 0], lantern: [2, 0] }, swap: { lotus: LOTUS_OPEN } },
    { squash: 1 },
  ],
  ticMs: [130, 90, 190, 320, 180, 170],
}
