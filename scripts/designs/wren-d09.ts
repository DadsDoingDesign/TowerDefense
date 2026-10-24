/**
 * Wren design 09 — the Flowerpot Potter. Hand-placed pixel maps (see wren-lib.ts).
 *
 * He pots up the glasshouse cuttings and cannot leave a pot empty, so he
 * wears one: a chipped terracotta flowerpot, upside down, its lip at his brow,
 * a seedling coming up through the drain hole. A white beard, a moss smock, a
 * trowel at his side. Silhouette: a flat-topped cone on a wide lip, with a
 * sprig. Tic: he taps the trowel and the seedling on his head grows a leaf.
 */
import type { Design } from './wren-lib'
import { PAL, SHADOW_W } from './wren-common'

const POT = [
  '...................ffffff',
  '............ffffffffffffffffffff',
  '..........fffffffffddddddfffffffff',
  '..........fffffffffddddddfffffffff',
  '.........LLffffffffffffffffffffflll',
  '.........LfffffffLLffffffLLllllllll',
  '.........LfffffffLLLLLLLLLLllllllll',
  '........LLffffffLLLLLLLLLLLlllllllll',
  '........LfffmfffLLLLLLLLLLLLllllllll',
  '........LLLLLLLLLLLLLLLLLLLLllllllll',
  '.......LLffmmfffLLLLLLLLLLLLlllllllll',
  '.......LffffffffLLLLLLLLLLLLlllllllll',
  '.......LffffffffLLLLLLLLLLLLlllllllll',
  '......LLffmfffffLLLLLLLLLLLLllllllllll',
  '......LffffffffLLLLLLLLLLLLLllllllllll',
  '.....LLLLLLLLLLLLLLLLLLLLLLLLllllllllll',
  '.....LLffffffffLLLLLLLLLLLLLLlllllllVll',
  '.....LfffffffffLLLLLLLLLLLLLLlllllllVll',
  '....LLfffffffffLLLLLLLLLLLLLLllllllVVlll',
  '....LLfffffffffLLLLLLLLLLLLLLllllllvVVll',
  '....LLLLLLLLLLLLLLLLLLLLLLLLLlllllvvVVll',
  '...LLfffffffffLLLLLLLLLLLLLLLllllllllllll',
  'Llllllllllllllllllllllllllllllllllllllllllll',
  'LLLLLLLLLLLLllllllllllllllllllllllllllllllll',
  'LLLffffffffffLLLLLLLLLLLLLLLLlllllllllllllll',
  'LLLlffffmmfffLLLLLLLLLLLLLLLLlllllllllllllll',
  'LLLllfmffffffLLLLLLLLLLLLLLLLlllllllllllllll',
  'LLLffffffffffLLLLLLLLLLLLLLLLlllllllllllllll',
  '.LLffffffffffLLLLLLLLLLLLLLLLllllllllllllll',
  '...ffffffffffLLLLLLLLLLLLLLLLllllllllllll',
]

const SPROUT = [
  'VWW.....WWV',
  'VWiWW..WWiWV',
  '.vVWWVVWWVv',
  '...vVWWVv',
  '.....VW',
  '.....vV',
  '.....vV',
]

const SPROUT_UP = [
  '.....WiW',
  'VWW..VWV..WWV',
  'VWiWW.VV.WWiWV',
  '.vVWWVVVVWWVv',
  '...vVWWWWVv',
  '......VW',
  '......vV',
  '......vV',
  '......vV',
]

const BEARD = [
  '...wwwwIIIIIIIIIIX',
  '.wwUwwIwIIIIIIIIIIX',
  'wwwwwIwIIXIIIIXIIIIXX',
  'wwIwIwIIXIIIIXIIIXIXX',
  'wwIwIIIIXIIIIXIIIXXXX',
  '.wwIIXIIIIXIIIXX',
  '..XIIXX.XIIIXX',
  '....XXX...XXX',
]

const NOSE = [
  '.mmmNN',
  'mmwwmNNN',
  'mmmmNNNNNN',
  'NNNNNNNNNNNn',
  '.nNNNNNNNNNNn',
  '..nnnNNNNNNNn',
  '......nnNNNNn',
  '........nNNn',
  '.........nn',
]

const NOSE_DOWN = [
  '.mmmNN',
  'mmwwmNNN',
  'mmmmNNNNN',
  'NNNNNNNNNNn',
  '.nNNNNNNNNNn',
  '..nnnNNNNNNn',
  '......nNNNNn',
  '.......nNNNn',
  '........nNNn',
  '.........nn',
]

const NOSE_UP = [
  '.mmmNN',
  'mmwwmNNNNN',
  'mmmmNNNNNNNn',
  'NNNNNNNNNNNNn',
  '.nNNNNNNNNNNn',
  '..nnnnnNNNNn',
  '.........nn',
]

const BELLY = [
  '.............vvvvvvvvvvvvvv',
  '......vvvvvvvvVVVVVVVVVVWWWvvvvvvv',
  '...vvvvVvvvvvVVVVVVVVVVVWWWWWWlLiWvvv',
  '.vvvvvvVVVVVVVVVVVVVVVVVWWWWWWWlWWWWWvv',
  'vvvvvvvVvvVVVVVVVVVVVVVVWWWWWWWvVWWWWWWv',
  'vvvvvvvVVVVVhhhhhhhhhhHHHHHHHHHVVVVVVVVv',
  '.vvvvVVVVVVhhhhhhhhhhhhHHHHHwHHHWWWWVVV',
  '....vvvVVVhhhhhhhdDhhhhhHHHHHwwHHWWW',
  '...vvxXxxXxhhhhhDDDDhhhhhhHHHHHHHWXxW',
  '...vvvvvvhhhhhhhDhhdhhhhhLhLHLHHHHWWW',
  '...vvvvvvDhhhhhhDDDDhhhhhLLLLHHHHHWWW',
  '...vvvvvvDDhhhhhhhhhhhhhhlLLLfHHHHWWW',
  '...vvvvvvDDDDhhlLhhhhhhhhhlLlhHHHHWWW',
  '....vvvvvDDDDDhhlLLhhhhhhhhhhfLhHHVV',
  '.....vvvvvDDDDDhhhhLhhhhhhhhhhlhhVV',
  '.......vvvvDDDDDhhhlhhhhhhhhhhhhV',
  '.........vvvDDDDDDhhhhhhhhhhhhh',
  '.............vDhhhhhhhHHDDD',
  '...............DDhhhhhhD',
]

const BOOTS = [
  '.SSt.....SStT',
  '.SxtT....SxtT',
  'ddDDhd..ddDDhh',
  'dLDDDd..dDLDDhh',
  '.dddd....ddddd',
]

const FIST_CLAY_B = [
  '.eeE',
  'elEEE',
  'eLlEE',
  'eeLEE',
  '.eeE',
]

const FIST_CLAY_F = [
  '.EEF',
  'eELFF',
  'eLlEF',
  'eEEEE',
  '.eeE',
]

const TROWEL = [
  '..dD',
  '..Dh',
  '..Dh',
  '..Dh',
  '..dd',
  '.xHHx',
  '.QuUUq',
  'QuUwwUUq',
  'QuUUUUUqQ',
  'QuUUUUUqQ',
  '.QuUUUUqQ',
  '..QuUUUqQ',
  '...QuUUqQ',
  '....QuuqQ',
  '.....QQQ',
]

const SOIL = [
  '.x',
  'xo.x',
  '..o',
]

export const D09: Design = {
  id: 'd09',
  title: 'Flowerpot Potter',
  concept: 'Pots the glasshouse cuttings: a terracotta flowerpot worn upside down as a hat, a seedling up through its drain hole, a trowel held low.',
  pal: PAL,
  headBottom: 62,
  parts: [
    { id: 'shadow', group: 'feet', x: 30, y: 77, rows: SHADOW_W, ring: 0 },
    { id: 'boots', group: 'feet', x: 42, y: 76, rows: BOOTS },
    { id: 'body', group: 'body', x: 30, y: 58, rows: BELLY },
    { id: 'handB', group: 'hands', x: 26, y: 64, rows: FIST_CLAY_B },
    { id: 'pot', group: 'head', x: 28, y: 28, rows: POT, squash: [10, 13, 16] },
    { id: 'sprout', group: 'head', x: 45, y: 24, rows: SPROUT, ring: 1, ride: true },
    { id: 'beard', group: 'head', x: 43, y: 60, rows: BEARD },
    { id: 'nose', group: 'head', x: 50, y: 55, rows: NOSE },
    { id: 'trowel', group: 'prop', x: 70, y: 63, rows: TROWEL },
    { id: 'handF', group: 'hands', x: 71, y: 64, rows: FIST_CLAY_F },
    { id: 'soil', group: 'fx', x: 73, y: 78, rows: SOIL, ring: 0, hidden: true },
  ],
  idle: [
    { swap: { nose: NOSE_UP } },
    { squash: 1 },
    { squash: 2, move: { hands: [0, 1], prop: [0, 1] }, nudge: { nose: [0, 1] } },
    { squash: 3, move: { hands: [0, 1], prop: [0, 1] }, swap: { nose: NOSE_DOWN } },
    { squash: 2, move: { hands: [0, 1], prop: [0, 1] }, swap: { nose: NOSE_DOWN }, nudge: { nose: [0, 1] } },
    { squash: 1 },
  ],
  idleMs: [220, 120, 110, 280, 140, 170],
  // he taps the trowel twice (a crumb of soil falls), his nose swinging with each tap, and the seedling on his head pushes up a new leaf
  tic: [
    { nudge: { trowel: [0, 1], handF: [0, 1] }, show: ['soil'], swap: { nose: NOSE_DOWN }, squash: 1 },
    { swap: { nose: NOSE_UP } },
    { nudge: { trowel: [0, 1], handF: [0, 1], nose: [1, 2] }, show: ['soil'], swap: { sprout: SPROUT_UP, nose: NOSE_DOWN }, at: { sprout: [44, 22] }, squash: 1 },
    { swap: { sprout: SPROUT_UP, nose: NOSE_UP }, at: { sprout: [44, 22] }, nudge: { nose: [0, -1] } },
    { swap: { sprout: SPROUT_UP, nose: NOSE_DOWN }, at: { sprout: [44, 22] }, squash: 1 },
    {},
  ],
  ticMs: [130, 140, 140, 260, 260, 220],
}
