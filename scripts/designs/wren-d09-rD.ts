/**
 * Wren design 09 · option D — the Potter D · Herb Satchel. Hand-placed pixel maps (see wren-lib.ts).
 *
 * Option D of the Flowerpot Potter. The props say herbalist, not potter: a
 * leather satchel on a strap over his shoulder, its flap buckled, cuttings and a
 * lavender sprig poking out; in his front fist a bundle of herbs tied with twine
 * and hung head-down, the way herbs are dried. Tic: he lifts the bundle, his nose
 * twitches up toward it, and on the third frame takes a sharp sniff (the nose
 * snaps down, a few herb motes fly), then lowers it.
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

const STRAP = [
  '...dD',
  '..dD',
  '.dD',
  'dD',
  'dD',
]

const SATCHEL = [
  '...V..A.W',
  '..VWb.AWiV',
  '.VWiVbAbWV',
  '...VAbVWV',
  '.dDDDDDDDDDd',
  'dDhhhhhhhhhDd',
  'DhhhhHHhhhhhD',
  'DhhhhHxhhhhhD',
  'DDhhhhhhhhhDD',
  'DhhhhhhhhhhDD',
  'DDhhhhhhhhDDD',
  'dDDDDDDDDDDDd',
  '.ddddddddddd',
]

const BUNDLE = [
  '....dD',
  '....Dh',
  '...HxHx',
  '...DhDh',
  '..VDWDVW',
  '.VWiVWiVW',
  'VWVWbWVWVV',
  'VWiVAbVWiV',
  'vVAbVWAbVv',
  '.vAbvAbVAb',
  '..vAbvAbA',
  '...A.bA.A',
  '....A..A',
]

const MOTES = [
  '.V',
  '',
  'i..b',
  '',
  '.W',
]

export const D09_RD: Design = {
  id: 'd09d',
  title: 'Potter D · Herb Satchel',
  concept: 'The herbalist\'s kit instead of the potter\'s: a leather satchel of cuttings on a strap at his hip, and a bundle of herbs hung head-down to dry in his fist; he lifts it and takes a sharp sniff.',
  pal: PAL,
  headBottom: 62,
  parts: [
    { id: 'shadow', group: 'feet', x: 30, y: 77, rows: SHADOW_W, ring: 0 },
    { id: 'boots', group: 'feet', x: 42, y: 76, rows: BOOTS },
    { id: 'body', group: 'body', x: 30, y: 58, rows: BELLY },
    { id: 'strap', group: 'body', x: 29, y: 60, rows: STRAP, ring: 1 },
    { id: 'satchel', group: 'prop', x: 18, y: 63, rows: SATCHEL },
    { id: 'handB', group: 'hands', x: 26, y: 62, rows: FIST_CLAY_B },
    { id: 'pot', group: 'head', x: 28, y: 28, rows: POT, squash: [10, 13, 16] },
    { id: 'sprout', group: 'head', x: 45, y: 24, rows: SPROUT, ring: 1, ride: true },
    { id: 'beard', group: 'head', x: 43, y: 60, rows: BEARD },
    { id: 'nose', group: 'head', x: 50, y: 55, rows: NOSE },
    { id: 'bundle', group: 'prop', x: 68, y: 65, rows: BUNDLE },
    { id: 'handF', group: 'hands', x: 71, y: 63, rows: FIST_CLAY_F },
    { id: 'motes', group: 'fx', x: 66, y: 62, rows: MOTES, ring: 0, hidden: true },
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
  // he lifts the bundle, his nose twitches up to it, and on frame 3 he sniffs sharply (nose snaps down, herb motes fly); he lowers it
  tic: [
    { nudge: { bundle: [0, -1], handF: [0, -1] } },
    { nudge: { bundle: [0, -1], handF: [0, -1], nose: [1, -1] }, swap: { nose: NOSE_UP } },
    { nudge: { bundle: [0, -1], handF: [0, -1], nose: [1, 1] }, swap: { nose: NOSE_DOWN }, squash: 2, show: ['motes'] },
    { nudge: { bundle: [0, -1], handF: [0, -1], motes: [-1, -2] }, swap: { nose: NOSE_DOWN }, squash: 1, show: ['motes'] },
    { swap: { nose: NOSE_UP } },
    {},
  ],
  ticMs: [200, 220, 170, 280, 180, 220],
}
