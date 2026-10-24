/**
 * Wren design 09 · E, smock variant — the Flowerpot Potter (E, smock). Hand-placed pixel maps (see wren-lib.ts).
 *
 * The Flowerpot Potter, option E, as the designer chose it: stooped forward, the
 * pot resting on broad shoulders over a rounded back, wide clay boots, a gnarled root
 * stick. The nose DANGLES: a skin-toned sausage hanging from its root under the rim,
 * over the moustache, tip lowest, swinging a frame behind the head like a pendulum.
 * The torso is a body first (chest, belly, the hump of the back, lit from the upper
 * left) and the garment wraps it: a jade smock with a lighter yoke over the shoulders, gathered below its seam, cinched by a belt that rides up over the hump.
 * The arms are sleeves from the shoulder, bent at the elbow, into the fists.
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
  '..IwII.......IwIIX',
  '.IwIIIX.....IIIIIIX',
  'IIIIIXX.....XIIIIXX',
  '.IIXXX.......XXIIX',
  '..XX...........XX',
]

const NOSE = [
  '.mmNn',
  'mmNNNn',
  'mwNNNn',
  'mwNNNn',
  'mmNNNn',
  '.mNNNn',
  '.mNNNNn',
  '.mmNNNn',
  '..mNMNNn',
  '..mMMNNn',
  '...nMNNn',
  '....nnn',
]

const BELLY = [
  '....ggggggggggggggggggggggggggg',
  '..ggiiiiiiJJiiiiiiiiiiiiiJJJJJJgggg',
  '.giiiiiiiJJJiiiiiiiiiiiJJJJJJJJJJJJgg',
  'giiiiiiiiJJJiiiiiiiiiiJJJJJJJJJJJJJjjg',
  'iiiiiiiiJJJJiiiiiiiJJJJJJJJJJJJJJJjjjjj',
  'kkkkkkkkkkkkkkkkJJJJJJJJJJJJJJJJjjjjkkk',
  'JJJJJjjjjjjjjjjjkkkkkJJJJJJJJJjkkkkkggg',
  'jjjjjjjjjjjjjjjjjjjjjkkkkkkkkkkgggggggg',
  'kjjjjjjjjgjggjgjjjjjjjjjgggggggggggggg',
  'kkkjjjjjjggggjgjjjjgggggggggggggggggg',
  'jkkkkjjjgggggJgJJJJgJJJJgjjjjjgjjjgg',
  '.gjkkkkggggJJJgJJJJgJJJJgjjjjjgjjjggg',
  '..gggkkkkkJJJJJjJJJgJJjjgjjjjjgjjjggg',
  '....JJJkkkkkJJjjjJJJjjjjjjjjjjjjjggggg',
  '...JJJJJJJkkkkkkkkkkkkkkkkkkkkkHyHkkkk',
  '...jJJJJJJjjkkkkkkkkkkkkkkkkkkkHkHkkkk',
  '...jjjjjjjjjjjjjjjjjjjjjjjjjjggggggggg',
  '...jjjjjjjjjgjjjjjgjjjjjgjjgggggggggg',
  '....jjjjjjjjgjjjgggjjjjjggggggggggggg',
  '....jjjjjjjjgggggggjjggggggggggggggg',
  '......ggggggggggggggggggggggggggggg',
  '.......gggggggggggggggggggggggggg',
  '..........gggggggggggggggggggg',
  '.....................gggg',
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
  '.DhD',
  '.DhD',
  'DDhD',
  '.DhD',
  '.DhD',
  '.ddd',
]

const DUST = [
  '.x...x',
  'o.x.o..x',
  '..o..o',
]

const ARM_B = [
  '.....Jj',
  '....Jjjj',
  '...Jjjjg',
  '..Jjjjg',
  '.Jjjjg',
  'Jjjjg',
  'Jjjjg',
  'Jjjjjg',
  '.Jjjjjjg',
  '..gjjjjjFF',
  '....gggjFF',
]

const ARM_F = [
  'Jjj',
  'Jjjj',
  'Jjjjg',
  '.Jjjjg',
  '..Jjjjg',
  '...Jjjjg',
  '...Jjjjjg',
  '....JjjjjFF',
  '....gjjjgFF',
  '.....gggg',
]

const NOSE_F = [
  '.mmNn',
  'mmNNNn',
  'mwNNNn',
  'mwNNNn',
  'mmNNNn',
  '.mNNNn',
  '..mNNNNn',
  '..mmNNNn',
  '...mNMNNn',
  '...mMMNNn',
  '.....nMNNn',
  '......nnn',
]

const NOSE_B = [
  '...mmNn',
  '..mmNNNn',
  '..mwNNNn',
  '..mwNNNn',
  '..mmNNNn',
  '...mNNNn',
  '..mNNNNn',
  '..mmNNNn',
  '...mNMNNn',
  '...mMMNNn',
  '...nMNNn',
  '....nnn',
]

const NOSE_DROP = [
  '.mmNn',
  'mmNNNn',
  'mwNNNn',
  'mwNNNn',
  'mmNNNn',
  '.mNNNn',
  '.mNNNNn',
  '.mmNNNn',
  '..mNMNNn',
  '...mNMNNn',
  '...mMMNNn',
  '....nMNNn',
  '.....nnn',
]

export const D09_E_SMOCK: Design = {
  id: 'd09Es',
  title: 'Flowerpot Potter (E, smock)',
  concept: 'Option E made final: an old potter stooped over a wide stance and a root stick, the pot resting on broad shoulders over a rounded back, a long ruddy nose hanging down from under its rim; a jade smock with a lighter yoke over the shoulders, gathered below its seam, cinched by a belt that rides up over the hump.',
  pal: PAL,
  headBottom: 62,
  parts: [
    { id: 'shadow', group: 'feet', x: 33, y: 82, rows: SHADOW_W, ring: 0 },
    { id: 'boots', group: 'feet', x: 38, y: 80, rows: BOOTS },
    { id: 'body', group: 'body', x: 33, y: 58, rows: BELLY },
    { id: 'armB', group: 'hands', x: 28, y: 60, rows: ARM_B },
    { id: 'pot', group: 'head', x: 32, y: 28, rows: POT, squash: [10, 13, 16] },
    { id: 'sprout', group: 'head', x: 49, y: 24, rows: SPROUT, ring: 1, ride: true },
    { id: 'beard', group: 'head', x: 47, y: 61, rows: BEARD, ring: 1 },
    { id: 'nose', group: 'head', x: 55, y: 56, rows: NOSE, ring: 1 },
    { id: 'armF', group: 'hands', x: 68, y: 60, rows: ARM_F },
    { id: 'stick', group: 'prop', x: 79, y: 64, rows: STICK },
    { id: 'handF', group: 'hands', x: 78, y: 65, rows: FIST_CLAY_F },
    { id: 'dust', group: 'fx', x: 77, y: 83, rows: DUST, ring: 0, hidden: true },
    { id: 'handB', group: 'hands', x: 38, y: 68, rows: FIST_CLAY_B },
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
    { nudge: { stick: [0, -1], handF: [0, -1], armF: [0, -1] }, swap: { nose: NOSE_B }, at: { nose: [53, 56] } },
    { nudge: { stick: [0, -2], handF: [0, -2], armF: [0, -1] } },
    { squash: 3, move: { hands: [0, 1] }, swap: { nose: NOSE_DROP }, nudge: { nose: [0, 1] }, show: ['dust'] },
    { squash: 2, swap: { nose: NOSE_F }, nudge: { dust: [0, -1] }, show: ['dust'] },
    { squash: 1, swap: { nose: NOSE_B }, at: { nose: [53, 56] } },
    {},
  ],
  ticMs: [200, 200, 190, 240, 200, 260],
}
