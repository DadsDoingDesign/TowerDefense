/**
 * Wren design 09 · E, apron variant — the Flowerpot Potter (E, apron). Hand-placed pixel maps (see wren-lib.ts).
 *
 * The Flowerpot Potter, option E, as the designer chose it: stooped forward, the
 * pot resting on broad shoulders over a rounded back, wide clay boots, a gnarled root
 * stick. The nose now DANGLES: a red sausage hanging from its root under the rim, over
 * the moustache, tip lowest, swinging a frame behind the head like a pendulum.
 * The outfit is one garment, each piece one block of value with ink between:
 * a dark leather potter's apron on straps, a pocket of cuttings low on its front, over a moss shirt; its hem rides up at the back over the rounded spine.
 * Tic: he lifts the stick and stamps it on the third frame; the nose bounces down
 * and wobbles still.
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
  '.mmRr',
  'mmRRRr',
  'mwRRRr',
  'mwRRRr',
  'mmRRRr',
  '.mRRRr',
  '.mRRRRr',
  '.mmRRRr',
  '..mRRRRr',
  '..mRRRRr',
  '...rRRRr',
  '....rrr',
]

const BELLY = [
  '...............vvvvvvvvvvvvvv',
  '....vvvvvvvvvvvVVVWWWWWWWWWWWvvvvvvv',
  '..vvVVVVVVVVVVddVVVVWWWWWWWWWWWWWWWdvvv',
  '.vVVVVVVVVVVVddVVVVVVVWWWWWWWWWWWWWWddWvv',
  'vvvvVVVVVVVVVVVVVVVVVVVWWWWWWWWWWWWWWWWWWv',
  'vvvvvvVVVVVVVVVkkkkkkkkkkkkkkkkkkkkWWWWWWW',
  'vvvvvvvVVVVVVVkDDDDDDDDDDDDhhhhhhhhkWWWWW',
  'vvvvvvvvvVVVVkDDDDDDDDDDDDDDDhhhhhhhkW',
  'vvvvvvvvvvvVVkDDDDDDDDDDDDDDDDhhhhhhkWW',
  '.vvvvvvvvvvvvkDDDDDDDDDDDDDDDDDDhhhhkWW',
  '..vvvvvvvvvvvkdDDDDDDDDDDDD.V.W.iDhhkWW',
  '....vvvvvvvvvkddDDDDDDDDDDDVWiVWVDDDkWW',
  '.....vvvvvvvvkddddDDDDDDDDDkkkkkkkDDkVW',
  '......vvvvvvvkddddddDDDDDDDkDDDDDkDDkV',
  '.......vvvvvvkkkkdddddDDDDDkDhhhDkDDD',
  '.........vvvvvvvvkkkkkdDDDDkkkkkkkD',
  '...........vvvvvvvvvvvkkkkkdddddd',
  '...............vvvvvvvvvvvvkd',
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

const NOSE_F = [
  '.mmRr',
  'mmRRRr',
  'mwRRRr',
  'mwRRRr',
  'mmRRRr',
  '.mRRRr',
  '..mRRRRr',
  '..mmRRRr',
  '...mRRRRr',
  '...mRRRRr',
  '.....rRRRr',
  '......rrr',
]

const NOSE_B = [
  '...mmRr',
  '..mmRRRr',
  '..mwRRRr',
  '..mwRRRr',
  '..mmRRRr',
  '...mRRRr',
  '..mRRRRr',
  '..mmRRRr',
  '...mRRRRr',
  '...mRRRRr',
  '...rRRRr',
  '....rrr',
]

const NOSE_DROP = [
  '.mmRr',
  'mmRRRr',
  'mwRRRr',
  'mwRRRr',
  'mmRRRr',
  '.mRRRr',
  '.mRRRRr',
  '.mmRRRr',
  '..mRRRRr',
  '...mRRRRr',
  '...mRRRRr',
  '....rRRRr',
  '.....rrr',
]

export const D09_E_APRON: Design = {
  id: 'd09Ea',
  title: 'Flowerpot Potter (E, apron)',
  concept: 'Option E made final: an old potter stooped over a wide stance and a root stick, the pot resting on broad shoulders over a rounded back, a long red nose hanging down from under its rim; a dark leather potter\'s apron on straps, a pocket of cuttings low on its front, over a moss shirt.',
  pal: PAL,
  headBottom: 62,
  parts: [
    { id: 'shadow', group: 'feet', x: 33, y: 77, rows: SHADOW_W, ring: 0 },
    { id: 'boots', group: 'feet', x: 38, y: 75, rows: BOOTS },
    { id: 'body', group: 'body', x: 30, y: 58, rows: BELLY },
    { id: 'handB', group: 'hands', x: 24, y: 66, rows: FIST_CLAY_B },
    { id: 'pot', group: 'head', x: 32, y: 28, rows: POT, squash: [10, 13, 16] },
    { id: 'sprout', group: 'head', x: 49, y: 24, rows: SPROUT, ring: 1, ride: true },
    { id: 'beard', group: 'head', x: 47, y: 60, rows: BEARD },
    { id: 'nose', group: 'head', x: 55, y: 56, rows: NOSE },
    { id: 'stick', group: 'prop', x: 75, y: 63, rows: STICK },
    { id: 'handF', group: 'hands', x: 74, y: 64, rows: FIST_CLAY_F },
    { id: 'dust', group: 'fx', x: 73, y: 78, rows: DUST, ring: 0, hidden: true },
  ],
  idle: [
    { swap: { nose: NOSE_B }, at: { nose: [53, 56] } },
    { squash: 1 },
    { squash: 2, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 3, move: { hands: [0, 1], prop: [0, 1] }, swap: { nose: NOSE_F } },
    { squash: 2, move: { hands: [0, 1], prop: [0, 1] }, swap: { nose: NOSE_F } },
    { squash: 1 },
  ],
  idleMs: [220, 120, 110, 280, 140, 170],
  // he lifts the stick and stamps it on frame 3 (dust, the pot jolts); the nose bounces down, swings forward and back, and hangs still
  tic: [
    { nudge: { stick: [0, -1], handF: [0, -1] }, swap: { nose: NOSE_B }, at: { nose: [53, 56] } },
    { nudge: { stick: [0, -2], handF: [0, -2] } },
    { squash: 3, move: { hands: [0, 1] }, swap: { nose: NOSE_DROP }, nudge: { nose: [0, 1] }, show: ['dust'] },
    { squash: 2, swap: { nose: NOSE_F }, nudge: { dust: [0, -1] }, show: ['dust'] },
    { squash: 1, swap: { nose: NOSE_B }, at: { nose: [53, 56] } },
    {},
  ],
  ticMs: [200, 200, 190, 240, 200, 260],
}
