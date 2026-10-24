/**
 * Wren design 09 · option A — the Potter A · Big Red Nose. Hand-placed pixel maps (see wren-lib.ts).
 *
 * Option A of the Flowerpot Potter. The nose is the gnome read, so it is pushed:
 * three px longer and a size fatter, in the pack's red ramp (the goblins' red, lit
 * to peach), over a short white tuft that no longer competes with it. The pot,
 * shoulders and body are the pick's. Tic: a sneeze — a breath in (the nose rises),
 * the sneeze on the third frame (the nose snaps down, the pot jolts, soil puffs
 * off its top), then the nose wobbles still.
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

const BEARD = [
  '...UUUUIIIIIIIIIX',
  '.UUwUUIUIIIIIIIIIX',
  'UUUUUIUIIXIIIXIIIXX',
  '.UUIUIUIIXIIIXIIXX',
  '...UIUIIXIIIXIX',
  '.....IIXI.IXIX',
  '.......X...XX',
]

const NOSE = [
  '..mmmRRR',
  '.mmwwmRRRR',
  'mmmmRRRRRRRR',
  'mRRRRRRRRRRRRr',
  'RRRRRRRRRRRRRRr',
  '.rRRRRRRRRRRRRr',
  '..rrrRRRRRRRRRr',
  '......rrRRRRRRr',
  '.........rRRRr',
  '..........rrr',
]

const NOSE_DOWN = [
  '..mmmRRR',
  '.mmwwmRRRR',
  'mmmmRRRRRRR',
  'mRRRRRRRRRRRr',
  'RRRRRRRRRRRRRr',
  '.rRRRRRRRRRRRr',
  '..rrrRRRRRRRRr',
  '......rRRRRRRr',
  '........rRRRRr',
  '.........rRRRr',
  '..........rrr',
]

const NOSE_UP = [
  '..mmmRRR',
  '.mmwwmRRRRRR',
  'mmmmRRRRRRRRRR',
  'mRRRRRRRRRRRRRRr',
  'RRRRRRRRRRRRRRRr',
  '.rrRRRRRRRRRRRr',
  '...rrrrrRRRRRr',
  '..........rrr',
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

const PUFF = [
  '.x...o',
  'o.x.....x',
  '...o..x',
  'x.....o',
]

const MIST = [
  '..z',
  'z...w',
  '.z.z',
]

export const D09_RA: Design = {
  id: 'd09a',
  title: 'Potter A · Big Red Nose',
  concept: 'The nose pushed until it reads at game size: a long, fat, red sausage over a pared-back white tuft; his tic is a sneeze that shakes soil off the pot.',
  pal: PAL,
  headBottom: 62,
  parts: [
    { id: 'shadow', group: 'feet', x: 30, y: 77, rows: SHADOW_W, ring: 0 },
    { id: 'boots', group: 'feet', x: 42, y: 76, rows: BOOTS },
    { id: 'body', group: 'body', x: 30, y: 58, rows: BELLY },
    { id: 'handB', group: 'hands', x: 26, y: 64, rows: FIST_CLAY_B },
    { id: 'pot', group: 'head', x: 28, y: 28, rows: POT, squash: [10, 13, 16] },
    { id: 'sprout', group: 'head', x: 45, y: 24, rows: SPROUT, ring: 1, ride: true },
    { id: 'puff', group: 'fx', x: 40, y: 22, rows: PUFF, ring: 0, hidden: true },
    { id: 'beard', group: 'head', x: 43, y: 60, rows: BEARD },
    { id: 'nose', group: 'head', x: 49, y: 55, rows: NOSE },
    { id: 'mist', group: 'fx', x: 64, y: 64, rows: MIST, ring: 0, hidden: true },
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
  // a sneeze: a breath in (the nose rises), the sneeze on frame 3 (the nose snaps down, soil puffs off the pot), the nose wobbles still
  tic: [
    { swap: { nose: NOSE_UP }, nudge: { nose: [0, -1] } },
    { swap: { nose: NOSE_UP }, nudge: { nose: [0, -1] }, squash: 1 },
    { swap: { nose: NOSE_DOWN }, nudge: { nose: [1, 2] }, squash: 3, show: ['puff', 'mist'], move: { hands: [0, 1], prop: [0, 1] } },
    { swap: { nose: NOSE_DOWN }, nudge: { nose: [0, 1], puff: [0, -2] }, squash: 2, show: ['puff'] },
    { swap: { nose: NOSE_UP }, squash: 1 },
    { nudge: { nose: [0, 1] } },
  ],
  ticMs: [200, 180, 190, 280, 160, 220],
}
