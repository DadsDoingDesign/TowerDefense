/**
 * Wren design 09 · option E — the Potter E · Old Stooped Potter. Hand-placed pixel maps (see wren-lib.ts).
 *
 * Option E of the Flowerpot Potter. The posture carries the temperament (quiet,
 * a little ominous, old): the head leans four pixels and the body two forward over a
 * wide stance, the back rounds into a hump behind the shoulders, the boots plant
 * apart with a glimpse of trouser between, and he leans on a gnarled root stick
 * in place of the trowel. Tic: he lifts the stick and on the third frame stamps it
 * down (a puff of dust, the pot jolts, the nose flops), then leans on it again.
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
  '....vvVV..........vvvvvvvvvvvvvv',
  '..vvvVVVW..vvvvvvvvVVVVVVVVVVWWWvvvvvvv',
  '.vvvVVVWWvvvVvvvvvVVVVVVVVVVVWWWWWWlLiWvvv',
  'vvvVVVVWWvvvVVVVVVVVVVVVVVVVVWWWWWWWlWWWWWvv',
  'vvvVVVVWvvvvVvvVVVVVVVVVVVVVVWWWWWWWvVWWWWWWv',
  'vvvVVVVvvvvvVVVVVhhhhhhhhhhHHHHHHHHHVVVVVVVVv',
  '.vvVVVvvvvVVVVVVhhhhhhhhhhhhHHHHHwHHHWWWWVVV',
  '..vvV....vvvVVVhhhhhhhdDhhhhhHHHHHwwHHWWW',
  '........vvxXxxXxhhhhhDDDDhhhhhhHHHHHHHWXxW',
  '........vvvvvvhhhhhhhDhhdhhhhhLhLHLHHHHWWW',
  '........vvvvvvDhhhhhhDDDDhhhhhLLLLHHHHHWWW',
  '........vvvvvvDDhhhhhhhhhhhhhhlLLLfHHHHWWW',
  '........vvvvvvDDDDhhlLhhhhhhhhhlLlhHHHHWWW',
  '.........vvvvvDDDDDhhlLLhhhhhhhhhhfLhHHVV',
  '..........vvvvvDDDDDhhhhLhhhhhhhhhhlhhVV',
  '............vvvvDDDDDhhhlhhhhhhhhhhhhV',
  '..............vvvDDDDDDhhhhhhhhhhhhh',
  '..................vDhhhhhhhHHDDD',
  '....................DDhhhhhhD',
]

const BOOTS = [
  '.SSt.........SStT',
  '.SStT........SxtT',
  '.SxtT........SStT',
  'ddDDhd......ddDDhh',
  'dLDDDd......dDLDDhh',
  '.dddd........ddddd',
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

const STICK = [
  '.hHD',
  'hHhDd',
  'DhHDd',
  '.DhD',
  '.DhD',
  'DDhD',
  '.DhD',
  '.DhD',
  '.DhDD',
  '.DhD',
  '.DhD',
  '.DhD',
  'DDhD',
  '.DhD',
  '.DhD',
  '.DhD',
  '.DhD',
  '.ddd',
]

const DUST = [
  '.x...x',
  'o.x.o..x',
  '..o..o',
]

export const D09_RE: Design = {
  id: 'd09e',
  title: 'Potter E · Old Stooped Potter',
  concept: 'The body\'s attitude pushed: an old potter stooped forward, a rounded back under the pot, his feet planted wide in clay boots and a gnarled root for a stick; he lifts it and stamps it down.',
  pal: PAL,
  headBottom: 62,
  parts: [
    { id: 'shadow', group: 'feet', x: 33, y: 77, rows: SHADOW_W, ring: 0 },
    { id: 'boots', group: 'feet', x: 38, y: 75, rows: BOOTS },
    { id: 'body', group: 'body', x: 27, y: 58, rows: BELLY },
    { id: 'handB', group: 'hands', x: 24, y: 66, rows: FIST_CLAY_B },
    { id: 'pot', group: 'head', x: 32, y: 28, rows: POT, squash: [10, 13, 16] },
    { id: 'sprout', group: 'head', x: 49, y: 24, rows: SPROUT, ring: 1, ride: true },
    { id: 'beard', group: 'head', x: 47, y: 60, rows: BEARD },
    { id: 'nose', group: 'head', x: 54, y: 55, rows: NOSE },
    { id: 'stick', group: 'prop', x: 75, y: 63, rows: STICK },
    { id: 'handF', group: 'hands', x: 74, y: 64, rows: FIST_CLAY_F },
    { id: 'dust', group: 'fx', x: 73, y: 78, rows: DUST, ring: 0, hidden: true },
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
  // he lifts the stick, and on frame 3 stamps it down (dust puffs, the pot jolts, the nose flops); he leans on it again
  tic: [
    { nudge: { stick: [0, -1], handF: [0, -1] }, swap: { nose: NOSE_UP } },
    { nudge: { stick: [0, -2], handF: [0, -2] }, swap: { nose: NOSE_UP } },
    { squash: 3, move: { hands: [0, 1] }, swap: { nose: NOSE_DOWN }, nudge: { nose: [1, 2] }, show: ['dust'] },
    { squash: 2, swap: { nose: NOSE_DOWN }, nudge: { nose: [0, 1], dust: [0, -1] }, show: ['dust'] },
    { squash: 1, swap: { nose: NOSE_UP } },
    {},
  ],
  ticMs: [200, 200, 190, 260, 180, 240],
}
