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
import { PAL, SHADOW } from './wren-common'

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

const FACE = [
  '............mmNN',
  '...........mwmNNN',
  '..........mmmNNNNn',
  '..........mNNNNNNn',
  '...wwwwIIkNNNNNNnn',
  '.wwUwwIwIkkNNNNnnkk',
  'wwwwwIwIIXkknnnnkkIXX',
  'wwIwIwIIXIIkkkkkkXIXX',
  'wwIwIIIIXIIIIXIIIXXXX',
  '.wwIIXIIIIXIIIXX',
  '..XIIXX.XIIIXX',
  '....XXX...XXX',
]

const BELLY = [
  '.......VVVVVVVWWWWWWWWW',
  '.....VVVVVVVVVVWWWWWWWWWW',
  '...VVVVVVhhhhhhhhHHHHHHHWWW',
  '..vVVVVVhhhhhhhhhhHHHHHwHWWW',
  '.vvvVVVhhhhhdDhhhhhHHHHHwwWWW',
  'xXxxXxVDhhhDDDDhhhhhHHHHHHWWWXx',
  '.vvvvvDDDhhDhhdhhhhhLHLHLHHWW',
  '.vvvvvDDDDhDDDDhhhhhLLLLHHHWW',
  '.vvvvvDDDDDDhhhhhhhhlLLLfHHWW',
  '.vvvvvDDDDlLDhhhhhhhhlLlHHHWW',
  '..vvvvvDDDDlLLhhhhhhhhhhfLVV',
  '...vvvvDDDDDDDLhhhhhhhhhhlV',
  '.....vvvDDDDDDlDhhhhhhhhh',
  '.......vvvDDDDDDDDDDDDD',
  '.........DhhhhhhhHHD',
  '..........DDhhhhhhD',
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
    { id: 'shadow', group: 'feet', x: 35, y: 76, rows: SHADOW, ring: 0 },
    { id: 'boots', group: 'feet', x: 38, y: 75, rows: BOOTS },
    { id: 'body', group: 'body', x: 37, y: 61, rows: BELLY },
    { id: 'handB', group: 'hands', x: 32, y: 66, rows: FIST_CLAY_B },
    { id: 'pot', group: 'head', x: 28, y: 28, rows: POT, squash: [10, 13, 16] },
    { id: 'sprout', group: 'head', x: 45, y: 24, rows: SPROUT, ring: 1, ride: true },
    { id: 'face', group: 'head', x: 43, y: 56, rows: FACE },
    { id: 'trowel', group: 'prop', x: 67, y: 63, rows: TROWEL },
    { id: 'handF', group: 'hands', x: 68, y: 64, rows: FIST_CLAY_F },
    { id: 'soil', group: 'fx', x: 70, y: 78, rows: SOIL, ring: 0, hidden: true },
  ],
  idle: [
    {},
    { squash: 1 },
    { squash: 2, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 3, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1 },
  ],
  idleMs: [220, 120, 110, 280, 140, 170],
  // he taps the trowel twice (a crumb of soil falls) and the seedling on his head pushes up a new leaf
  tic: [
    { nudge: { trowel: [0, 1], handF: [0, 1] }, show: ['soil'] },
    {},
    { nudge: { trowel: [0, 1], handF: [0, 1] }, show: ['soil'], swap: { sprout: SPROUT_UP }, at: { sprout: [44, 22] } },
    { swap: { sprout: SPROUT_UP }, at: { sprout: [44, 22] } },
    { swap: { sprout: SPROUT_UP }, at: { sprout: [44, 22] }, squash: 1 },
    {},
  ],
  ticMs: [120, 120, 140, 300, 260, 200],
}
