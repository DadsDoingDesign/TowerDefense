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
import { PAL, SHADOW, FEET, FIST_L, FIST_R } from './wren-common'

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
  'VWW..WWV',
  'VWiWWiWV',
  '.vVWWVv',
  '...VV',
  '...vV',
  '...vV',
]

const SPROUT_UP = [
  '.VWW..WWV',
  'VWiWWWiWVv',
  '.vVWWWVv',
  '...VWV',
  '..VWiWV',
  '...vVv',
  '....vV',
  '....vV',
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
  '.wwIwIIXIIIIXIIIXIXX',
  '.wwIwIIIIXIIIIIXIXX',
  '..wwIIXIIIIXIIIXXX',
  '...XIIIXX.XIIIXX',
  '.....XXX...XXX',
]

const BODY = [
  '......vvVVVVVVVVWWW',
  '.....vvVVVVVVVVVVWW',
  '....vvvVVVVVVVVVVWWW',
  '...vvvVVVVvVVVVVVVWW',
  '...vvvVVVVvVVVVVVVWWW',
  '..ddddHdddddddddddddd',
  '..vvvVVVVVvVVVVVvVVWWW',
  '.vvvvVVVVVvVVVVVvVVVWW',
  'vDDDDDDDDDDDDDDDDDDDDv',
  'vvvvvvvvvvvvvvvvvvvvvv',
  '..vvvvvvvvvvvvvvvvvv',
]

const TROWEL = [
  '.DD',
  'DhD',
  'DhD',
  'DhD',
  '.dd',
  '.QQQ',
  'QqUqQ',
  'QqUUqQ',
  'QqUUqQ',
  'QqUqqQ',
  '.QqxqQ',
  '..Qx',
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
    { id: 'shadow', group: 'feet', x: 34, y: 73, rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 72, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 39, y: 62, rows: BODY },
    { id: 'handB', group: 'hands', x: 35, y: 65, rows: FIST_L },
    { id: 'pot', group: 'head', x: 28, y: 28, rows: POT, squash: [10, 13, 16] },
    { id: 'sprout', group: 'head', x: 46, y: 24, rows: SPROUT, ring: 1, ride: true },
    { id: 'face', group: 'head', x: 43, y: 56, rows: FACE },
    { id: 'trowel', group: 'prop', x: 68, y: 63, rows: TROWEL },
    { id: 'handF', group: 'hands', x: 67, y: 62, rows: FIST_R },
    { id: 'soil', group: 'fx', x: 67, y: 76, rows: SOIL, ring: 0, hidden: true },
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
    { nudge: { trowel: [0, 1], handF: [0, 1] }, show: ['soil'], swap: { sprout: SPROUT_UP }, at: { sprout: [45, 22] } },
    { swap: { sprout: SPROUT_UP }, at: { sprout: [45, 22] } },
    { swap: { sprout: SPROUT_UP }, at: { sprout: [45, 22] }, squash: 1 },
    {},
  ],
  ticMs: [120, 120, 140, 300, 260, 200],
}
