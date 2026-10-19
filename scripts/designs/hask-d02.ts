/**
 * Hask design 02 — the Marsh Trapper. Hand-authored pixel maps (see hask-lib.ts).
 *
 * Runs the trap lines out past the last smokehouse: a deep hood and shoulder cape
 * stitched together from patched hides, his snout and one eye out of the
 * dark of it; an iron jaw-trap swings from his fist on its
 * chain, low at his side. Silhouette: a round patched cowl flaring to a ragged
 * cape. Tic: he gives the trap a shake and it snaps shut.
 */
import type { Design } from './hask-lib'
import { PAL, FEET, SHADOW_W, FIST_B, FIST_F, SNOUT, TAIL, TAIL_UP, bell } from './hask-common'

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

const BODY = bell({ d: 'a', m: 'A', l: 'j', t: 'h' }, {
  2: '.....aaaAAAAAAAAhAAAAAAAjj',
  3: '....aaaAAAAAAAAhIhAAAAAAAjj',
  4: '....aaaAAAAAAAAAhAAAAAAAAjj',
})

/** A belt with a bone toggle and a pouch of salt. */
const BELT = [
  'hhhhhhhhhhhhhhhhhhhhhhhhhhh',
  'HHHHHHHHHHHCdCHHHHHHHHHHHHH',
  'hhhhhhhhhhhcCchhhhhhhhhhhhh',
]
const POUCH = ['.HiiH', 'HiiIiH', 'HiiiiH', 'hHHHHh', '.hhhh']

/** The jaw-trap, open, on its chain. */
const CHAIN = ['N', 'x', 'N', 'x', 'N', 'x']
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
  concept: 'Runs the trap lines past the last smokehouse: a cowl and cape stitched from patched hides, his eye in the dark of it, an iron jaw-trap swung low on its chain.',
  pal: PAL,
  headBottom: 56,
  parts: [
    { id: 'shadow', group: 'feet', x: 22, y: 72, rows: SHADOW_W, ring: 0 },
    { id: 'tail', group: 'back', x: 13, y: 57, rows: TAIL },
    { id: 'feet', group: 'feet', x: 41, y: 69, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 35, y: 56, rows: BODY },
    { id: 'belt', group: 'body', x: 36, y: 62, rows: BELT, ring: 0 },
    { id: 'pouch', group: 'body', x: 40, y: 63, rows: POUCH, ring: 1 },
    { id: 'hood', group: 'head', x: 25, y: 27, rows: HOOD, squash: [6, 12, 16] },
    { id: 'snout', group: 'head', x: 54, y: 43, rows: SNOUT },
    { id: 'eye', group: 'head', x: 55, y: 40, rows: EYE, ring: 0 },
    { id: 'handB', group: 'hands', x: 31, y: 59, rows: FIST_B },
    { id: 'chain', group: 'prop', x: 69, y: 63, rows: CHAIN, ring: 1 },
    { id: 'trap', group: 'prop', x: 63, y: 68, rows: TRAP },
    { id: 'trapShut', group: 'prop', x: 63, y: 69, rows: TRAP_SHUT, hidden: true },
    { id: 'handF', group: 'hands', x: 66, y: 59, rows: FIST_F },
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
