/**
 * Odile, final pass: design 04, the Ford Toll-Keeper (the designer's pick:
 * "all of these are hard to distinguish the parts, i think 1 is the best of
 * them but still needs passes").
 *
 * The pass is part separation. Every part is one block of value set against
 * its neighbours, light against dark, with one ink edge between them:
 *   - the lily pad: the LIGHT green top face, four veins, a mid edge band;
 *   - the lotus bud: rose, standing clear above it;
 *   - her hair: DARK plum in the pad's shade, three big locks;
 *   - the leaf ears and the cheek: LIGHT skin against that dark hair;
 *   - the cloak: MID river blue, two long folds, standing out in an A;
 *   - its front opening: a wide V of LIGHT rose gown between two dark edges,
 *     a brass clasp at the throat;
 *   - the satchel: LIGHT leather on the blue, one flap line, one big buckle;
 *   - the lantern: a dark cage, a bright flame, hung on a bail clear of the fist;
 *   - the fists: bigger, a knuckle crease and a thumb.
 * Dropped as muddying: the water beads, the tally tag, the hem creases, the
 * pad's extra veins and dark rim line, the hair's strands.
 * Tic: she lifts the lantern for the toll and it burns bright; the bud opens a little.
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
  '.........twtNttttttNtttttnjjjQQjnNNNn',
  '........twttnttttttNtttttnjjjQQjnNNNNn',
  '........twtNtttttttNttttnjjjjQQjQnNNNn',
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

/** The cloak with the satchel's strap laid across it. */
const CLOAK_STRAPPED = over(CLOAK, [[6, 9, STRAP]])

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

const FEET_HEM = [
  'kkkkk..kkkkk',
  '.kkkk..kkkk',
  '..kkk..kkk',
]

export const D04_FINAL: Design = {
  id: 'd04-final',
  title: 'Ford Toll-Keeper',
  concept: 'Takes the toll at the ford: a lily-pad hat with a rose bud, dark hair, a river-blue cloak open over a rose gown, the toll satchel and lantern.',
  pal: PAL,
  headBottom: 53,
  parts: [
    { id: 'shadow', group: 'feet', x: 32, y: 71, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 44, y: 73, rows: FEET_HEM, ring: 0 },
    { id: 'cloak', group: 'body', x: 27, y: 46, rows: CLOAK_STRAPPED, squash: [12] },
    { id: 'satchel', group: 'body', x: 32, y: 60, rows: SATCHEL },
    { id: 'hair', group: 'head', x: 29, y: 42, rows: HAIR, spread: [6, 7, 8] },
    { id: 'cheek', group: 'head', x: 54, y: 46, rows: CHEEK },
    { id: 'earL', group: 'head', x: 16, y: 39, rows: EAR_FAR },
    { id: 'earR', group: 'head', x: 69, y: 33, rows: EAR_NEAR },
    { id: 'lotus', group: 'head', x: 42, y: 19, rows: LOTUS, squash: [10] },
    { id: 'pad', group: 'head', x: 25, y: 31, rows: PAD, squash: [4], spread: [6, 7, 8] },
    { id: 'lantern', group: 'prop', x: 66, y: 60, rows: LANTERN },
    { id: 'handB', group: 'hands', x: 26, y: 57, rows: FIST_B },
    { id: 'handF', group: 'hands', x: 66, y: 56, rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], hair: [0, 1] } },
    { squash: 2, squashBy: { cloak: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], hair: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, squashBy: { cloak: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], hair: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], hair: [0, 1] } },
    {},
  ],
  idleMs: [190, 130, 150, 200, 130, 170],
  // she lifts the lantern for the toll: it swings up, burns bright, the bud opens a little
  tic: [
    { nudge: { handF: [0, -1], lantern: [0, -1] } },
    { nudge: { handF: [0, -2], lantern: [0, -2] }, swap: { lantern: LANTERN_BRIGHT } },
    { nudge: { handF: [0, -2], lantern: [0, -2] }, swap: { lantern: LANTERN_BRIGHT, lotus: LOTUS_OPEN } },
    { nudge: { handF: [0, -2], lantern: [0, -2] }, swap: { lotus: LOTUS_OPEN } },
    { nudge: { handF: [0, -1], lantern: [0, -1] } },
    { squash: 1 },
  ],
  ticMs: [110, 140, 260, 220, 120, 180],
}
