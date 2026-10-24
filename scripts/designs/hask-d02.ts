/**
 * Hask design 02 — the Marsh Trapper. Hand-authored pixel maps (see hask-lib.ts).
 *
 * Runs the trap lines out past the last smokehouse: a deep hood and shoulder cape
 * stitched together from patched hides, his snout and one eye out of the
 * dark of it; his own body: a patched hide vest laced over his belly
 * scales, strapped hide leggings planted wide; an iron jaw-trap in his fist,
 * its chain to his belt. Silhouette: a round patched cowl over a vest on
 * two legs. Tic: he gives the trap a shake and it snaps shut.
 */
import type { Design } from './hask-lib'
import { PAL, FEET, SHADOW_W, SNOUT, TAIL, TAIL_UP } from './hask-common'

const HOOD = [
  '.............iiiiiiiiiiii',
  '..........iiiiIIIiiiiiiiiiiH',
  '........iiiiIIiiiiiiiiiiiiiiHa',
  '.......iiiIhIhIhIhIhiiiiiiiiHHa',
  '......iiiiihddCCCcchiiiiiiHHHHHa',
  '.....iiiiiiIddCCCccIiiiiiiHHHHHHa',
  '.....iiiiiihCCCCCcchIiIiIiHHHHHHHa',
  '....iiiiiiiICCCCCccIiiiiiiHHHHHHHHa',
  '....iiiiiiihhIhIhIhhiiiiHHHHHHHHHHHH',
  '....iiiiiiiiiiiiiiiiiiiiaaaaaaaaaaaa',
  '....iiiiHiiiiiiiiiiiiiiiakkkkkkkkk',
  '....iiiiHiiiiiiiHiiiiiiiakkkkkkkkk',
  '....iiiiHiiiiiiiHiiiiiiiakkkkkkkkk',
  '....iiiiHiiiiiiiHiiiiiiiakkkkkkkkk',
  '....iiiiiHiiiiiiHiiiiiiiakkkkkkkkk',
  '....iiiiiHiiiiiiHiiiiiiiakkkkkkkkk',
  '....iiiiiHiiiiiiHiiiiiiHakkkkkkkkk',
  '....iiiiiHiiiiiiiHiiiiiHakkkkkkkkk',
  '....iiiiiiHiiiiiiHiiiiiHakkkkkkkkk',
  '....iiiiiiHiiiiiiHiiiiiHakkkkkkkkk',
  '...iiiiiiiHiiiiiiHiiiiiHakkkkkkkkkk',
  '..aaaaaaaaaaaaaaaaaaaaaHHHHHHHHHHHHHa',
  '.iiihhIhIhIhhiiiiiiiiiiHHHHHHHHHHHHHHa',
  'HHHHhAAaaaaahHHHHHHHHHHHHHHHHHHHHHHHHaa',
  'HHHHIAAaaaaaIHHHHHHHHHHHHHHHHHHHHHHHaaa',
  'aaaahAAaaaaahaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '..aaa.aaa.aaa.aaa.aaa.aaa.aaa.aaa.aaa',
]


const EYE = ['yw']

/** His torso in one piece: a patched hide vest laced over his pale belly scales, a belt with a bone buckle. */
const TORSO = [
  '......iiiiiiiiiHH',
  '....iiiiiiiiiiiIddC',
  '...iiiiiiiiiiiiIhchch',
  '..iihIhIhhiiiiiIddCCCC',
  '.iiihddCChiiiiHIccccccH',
  '.iiiIddCCIiiiHHIdhChChHH',
  '.iiihCCCChiiHHHiccccccHH',
  'HHHHhhIhIhHHHHHiddCCCCHHa',
  'HHHHHHHHHHHHHHHihchchchHa',
  'HHHhHhHhHHHHHHHiddCCCCHHa',
  'HHHHhhIhIhHHHHHiddCCCCHHa',
  'HHHHHHHHHHHHHHHihchchchHa',
  'HHHhHhHhHHHHHHHiddCCCCHHa',
  'HHHHhHhHHHHHHHHiccccccHHa',
  'aaaHaaaHaaaHaaaadCdaaaaaa',
  'hhhhhhhhhhhhhhhhckchhhhhh',
  '.HHHHHHHHHHHHHHHHHHHaaaa',
  '..aaaaaaaaaaaaaaaaaaaaa',
  '...aaaaaaaaaaaaaaaaaaa',
]

/** Patched hide leggings, cross-strapped at knee and shin, tapering to the ankle, planted wide. */
const LEGS = [
  'aAjjjA...aAjjjA',
  'aAjjAA...aAjjAA',
  'aAjAAa...aAjAAa',
  'hIhIhh...hhIhIh',
  'aCdCAa...aAjAAa',
  'aCCcAa...aAAAAa',
  '.hIhIh...hIhIh',
  '.aAjA.....aAja',
  '.aAAa.....aAAa',
  '..aa.......aa',
]

/** The far fist, resting on his belt at the back hip. */
const FIST_HIP = ['.gGG', 'gGGvv', 'gGvvV', 'gGGvv', '.zgg']
/** The near arm, scaled, one piece down to the fist that holds the trap. */
const ARM = [
  'gGG',
  'gGvG',
  'gGGv',
  '.gGvVv',
  '.gGvVVv',
  '.gGGvvV',
  '.zgGGGg',
  '..zggg',
]

/** The trap's chain, from his belt down to the trap in his fist. */
const CHAIN = [
  'xN',
  '..N',
  '..xN',
  '....N',
  '....xN',
  '......N',
  '......xN',
  '........N',
]

/** The jaw-trap, open. */
const TRAP = [
  'x.x.x...x.x.x',
  'NxNxN...NxNxN',
  'NNNNNx.xNNNNN',
  '.nNNNNNNNNNn',
  '..nnNxNnn',
  '...nnnnn',
]
const TRAP_SHUT = [
  '...xxxxxxx',
  '..xNxNxNxNx',
  '.NNNNNNNNNNN',
  '..nnNNxNNnn',
  '...nnnnnn',
]

export const D02: Design = {
  id: 'd02',
  title: 'Marsh Trapper',
  concept: 'Runs the trap lines past the last smokehouse: a cowl stitched from patched hides, his eye in the dark of it; a hide vest over his belly scales, patched leggings, an iron jaw-trap chained to his belt.',
  pal: PAL,
  headBottom: 46,
  parts: [
    { id: 'shadow', group: 'feet', x: 21, y: 67, rows: SHADOW_W, ring: 0 },
    { id: 'tail', group: 'back', x: 12, y: 56, rows: TAIL },
    { id: 'feet', group: 'feet', x: 39, y: 64, rows: FEET, ring: 0 },
    { id: 'legs', group: 'feet', x: 40, y: 55, rows: LEGS },
    { id: 'torso', group: 'body', x: 34, y: 38, rows: TORSO },
    { id: 'hood', group: 'head', x: 25, y: 15, rows: HOOD, squash: [6, 12, 18] },
    { id: 'snout', group: 'head', x: 54, y: 33, rows: SNOUT },
    { id: 'eye', group: 'head', x: 55, y: 29, rows: EYE, ring: 0 },
    { id: 'handB', group: 'hands', x: 31, y: 49, rows: FIST_HIP },
    { id: 'chain', group: 'prop', x: 53, y: 53, rows: CHAIN, ring: 1 },
    { id: 'trap', group: 'prop', x: 60, y: 60, rows: TRAP },
    { id: 'trapShut', group: 'prop', x: 60, y: 61, rows: TRAP_SHUT, hidden: true },
    { id: 'arm', group: 'hands', x: 58, y: 49, rows: ARM },
  ],
  idle: [
    {},
    { squash: 1 },
    { squash: 2, nudge: { snout: [0, 1], eye: [0, 1] }, move: { hands: [0, 1] } },
    { squash: 2, nudge: { snout: [0, 1], eye: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, move: { prop: [0, 1] } },
    {},
  ],
  idleMs: [200, 140, 170, 200, 150, 180],
  tic: [
    { move: { hands: [0, -1], prop: [0, -1] } },
    { move: { hands: [0, 1], prop: [1, 1] } },
    { move: { hands: [0, -1], prop: [-1, -1] }, swap: { tail: TAIL_UP } },
    { hide: ['trap'], show: ['trapShut'], move: { prop: [0, 1] }, squash: 1, swap: { tail: TAIL_UP } },
    { hide: ['trap'], show: ['trapShut'] },
    { hide: ['trap'], show: ['trapShut'] },
  ],
  ticMs: [140, 140, 140, 120, 300, 300],
}
