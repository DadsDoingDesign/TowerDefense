/**
 * Odile d04-A-final, the Ford Toll-Keeper. Hand-authored pixel maps (see odile-lib.ts).
 *
 * Option A, The Elf Leads, as the designer chose it ("I like A, but the
 * flower should be centered on the lily not floating above"). The lotus now
 * sits ON the pad: no stalk, its base sunk 2 px into the leaf's top face so it
 * grows from it, centred on the middle of the top ellipse (not on the box),
 * drawn after the pad so one ink edge runs round its base. It rides the pad:
 * every frame the pad's squash drops a row, the bud drops the same row.
 * Everything else is A's: the big leaf ears lifted clear, the face in its
 * window of dark hair, the 44 px pad, the boots, the ears lagging the bob;
 * her hair's locks hang a row longer.
 * Tic: the ears prick at a barge's bell, then the toll: the lantern out at
 * arm's length on the third frame, blazing, the bud opening on the pad.
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

const BUD = [
  '.......j',
  '......jjQ',
  '..j..jjQQR..R',
  '.jjQ.jjQQRRRr',
  '.jjQQjjQRRRrr',
  '..jQQjQQRRRr',
  '..jjQQQRRRrr',
  '...QQQRRRrr',
  '....rrRRrr',
]

const BUD_OPEN = [
  '.......j',
  'j.....jjQ....R',
  'jj.j..jjQQR.RR',
  '.jjjQ.jjQQRRRr',
  '..jjQQjQQRRRr',
  '..jjQQjQRRRrr',
  '...jQQQRRRrr',
  '....QQRRRrr',
  '.....rRRrr',
]

const HAIR = [
  '...ppppppppppppppppppppppppppppppppp',
  '..ppppppppppppppppppppppppppppppppppp',
  '.ppppPPPPPPPPppppppppp.....pppppppppp',
  'pppPPPPPPPPPPPPppppp.........ppppppppp',
  'ppPPiPppPPPPiPppppp...........pppipppp',
  '.pPPPPPppPPPPPPppp.............ppPppp',
  '..pPPPPP..PPPPPp...............ppPpp',
  '.ppppPPPPPPPPPppp...............ppPpp',
  '.ppppPpppppppPppp...............ppPppp',
  '.ppppPpppkpppPppp..............pppPppp',
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

export const D04_A_FINAL: Design = {
  id: 'd04-a-final',
  title: 'Ford Toll-Keeper',
  concept: 'The Elf Leads, final: the lotus sits on the pad, centred on its top face; big leaf ears, a face you can find.',
  pal: PAL,
  headBottom: 54,
  parts: [
    { id: 'shadow', group: 'feet', x: 32, y: 71, rows: SHADOW_M, ring: 0 },
    { id: 'boots', group: 'feet', x: 41, y: 72, rows: BOOTS },
    { id: 'cloak', group: 'body', x: 27, y: 46, rows: CLOAK_STRAPPED, squash: [12] },
    { id: 'satchel', group: 'body', x: 32, y: 60, rows: SATCHEL },
    { id: 'face', group: 'head', x: 49, y: 45, rows: FACE },
    { id: 'hair', group: 'head', x: 30, y: 41, rows: HAIR, spread: [6, 7, 8] },
    { id: 'earL', group: 'head', x: 13, y: 37, rows: EAR_L },
    { id: 'earR', group: 'head', x: 70, y: 30, rows: EAR_R },
    { id: 'pad', group: 'head', x: 28, y: 31, rows: PAD, squash: [4], spread: [5, 6, 7] },
    { id: 'lotus', group: 'head', x: 43, y: 24, rows: BUD },
    { id: 'lantern', group: 'prop', x: 66, y: 60, rows: LANTERN },
    { id: 'handB', group: 'hands', x: 26, y: 57, rows: FIST_B },
    { id: 'handF', group: 'hands', x: 66, y: 57, rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1, nudge: { lotus: [0, 1], face: [0, 1], hair: [0, 1] } },
    { squash: 2, squashBy: { cloak: 1 }, spread: 1, move: { hands: [0, 1], prop: [0, 1] }, nudge: { lotus: [0, 1], face: [0, 1], hair: [0, 1], earL: [0, 1], earR: [0, 1] } },
    { squash: 2, squashBy: { cloak: 1 }, spread: 1, move: { hands: [0, 1], prop: [0, 1] }, nudge: { lotus: [0, 1], face: [0, 1], hair: [0, 1], earL: [0, 2], earR: [0, 2] } },
    { squash: 1, nudge: { lotus: [0, 1], face: [0, 1], hair: [0, 1], earL: [0, 2], earR: [0, 2] } },
    { nudge: { earL: [0, 1], earR: [0, 1] } },
  ],
  idleMs: [190, 130, 150, 200, 150, 170],
  // her ears prick at a barge's bell, then the toll: the lantern swings back, then out at arm's length on the third frame, blazing, the bud opening on the pad; held, then home
  tic: [
    { nudge: { earL: [-1, -1], earR: [1, -1], handF: [-1, 0], lantern: [-2, 0] } },
    { nudge: { earL: [-1, -2], earR: [1, -2], handF: [1, 0], lantern: [1, 0] } },
    { nudge: { earL: [-1, -1], earR: [1, -1], handF: [2, 0], lantern: [3, 0] }, swap: { lantern: LANTERN_BRIGHT, lotus: BUD_OPEN } },
    { nudge: { handF: [2, 0], lantern: [3, 0] }, swap: { lantern: LANTERN_BRIGHT, lotus: BUD_OPEN } },
    { nudge: { handF: [1, 0], lantern: [2, 0] }, swap: { lotus: BUD_OPEN } },
    { squash: 1, nudge: { lotus: [0, 1] } },
  ],
  ticMs: [130, 90, 190, 320, 180, 170],
}
