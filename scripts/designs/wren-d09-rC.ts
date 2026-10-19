/**
 * Wren design 09 · option C — the Potter C · Scarf Nest. Hand-placed pixel maps (see wren-lib.ts).
 *
 * Option C of the Flowerpot Potter. Where the pot meets the body is made the
 * point: a thick knitted scarf of foxglove-purple wool, rolled round the shoulders, wider than
 * the rim at its ends, the pot's rim sunk into it; one end hangs down his front over
 * the apron, fringed. Tic: a shrug — he rises a pixel (frame 2), drops on the third
 * frame so the pot thumps into the scarf (the nose flops low, a little lint puffs),
 * then settles.
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

const SCARF = [
  'bb..................................................bb',
  'bbbBBbbbbbb................................bbbbbBbbbbb',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'AcbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbAc',
  'AcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAc',
  'AcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAc',
  'AcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAcAAAc',
  'AcAAAccccccAAcAAAcccccccccccccccccccAcAAAcAcccccAcAAAc',
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  'cccccccccccccccccc..................cccccccccccccccccc',
  'cccccc..........................................cccccc',
]

const SCARF_END = [
  'AbbbA',
  'cAbBA',
  'cAbbA',
  'ccAAA',
  'cAbbA',
  'cAbBA',
  'ccAAc',
  'cAbAc',
  'c.c.c',
  'c.c.c',
]

const LINT = [
  '.U...U',
  'U.....',
  '....U.U',
]

const LINT2 = [
  'U.....U',
  '.......',
  '.U....',
]

export const D09_RC: Design = {
  id: 'd09c',
  title: 'Potter C · Scarf Nest',
  concept: 'The join made a feature: a thick rolled scarf of foxglove-purple wool round the shoulders, the pot\'s rim sunk into it like a nest, one fringed end hanging down his front; he shrugs and the pot thumps back.',
  pal: PAL,
  headBottom: 62,
  parts: [
    { id: 'shadow', group: 'feet', x: 30, y: 77, rows: SHADOW_W, ring: 0 },
    { id: 'boots', group: 'feet', x: 42, y: 76, rows: BOOTS },
    { id: 'body', group: 'body', x: 30, y: 58, rows: BELLY },
    { id: 'scarf', group: 'body', x: 23, y: 56, rows: SCARF },
    { id: 'scarfEnd', group: 'body', x: 64, y: 62, rows: SCARF_END },
    { id: 'handB', group: 'hands', x: 21, y: 65, rows: FIST_CLAY_B },
    { id: 'pot', group: 'head', x: 28, y: 28, rows: POT, squash: [10, 13, 16] },
    { id: 'sprout', group: 'head', x: 45, y: 24, rows: SPROUT, ring: 1, ride: true },
    { id: 'beard', group: 'head', x: 43, y: 60, rows: BEARD },
    { id: 'nose', group: 'head', x: 50, y: 55, rows: NOSE },
    { id: 'lint', group: 'fx', x: 19, y: 55, rows: LINT, ring: 0, hidden: true },
    { id: 'lint2', group: 'fx', x: 72, y: 54, rows: LINT2, ring: 0, hidden: true },
    { id: 'trowel', group: 'prop', x: 72, y: 63, rows: TROWEL },
    { id: 'handF', group: 'hands', x: 73, y: 64, rows: FIST_CLAY_F },
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
  // a shrug: he rises a pixel, drops on the third frame so the pot thumps into the scarf (nose low, lint puffs), then settles
  tic: [
    { squash: 1 },
    { move: { body: [0, -1], head: [0, -1], hands: [0, -1], prop: [0, -1] }, swap: { nose: NOSE_UP }, nudge: { nose: [0, -1] } },
    { squash: 3, move: { hands: [0, 1], prop: [0, 1] }, swap: { nose: NOSE_DOWN }, nudge: { nose: [1, 2] }, show: ['lint', 'lint2'] },
    { squash: 2, swap: { nose: NOSE_DOWN }, nudge: { nose: [0, 1], lint: [0, -1], lint2: [0, -1] }, show: ['lint', 'lint2'] },
    { squash: 1, swap: { nose: NOSE_UP } },
    {},
  ],
  ticMs: [160, 200, 190, 260, 180, 220],
}
