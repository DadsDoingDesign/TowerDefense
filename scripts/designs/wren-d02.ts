/**
 * Wren design 02 — the Bell-jar Keeper. Hand-placed pixel maps (see wren-lib.ts).
 *
 * He tends Greenvial's glasshouses, and the dearest seedling he carries on
 * his own head, under a glass cloche set on a bed of loam. Silhouette: a tall
 * glass bell with a knob, on a grey chin-tuft. Tic: he tips the can and it drips
 * on the roots of whatever grows at his feet.
 */
import type { Design } from './wren-lib'
import { PAL, SHADOW, FEET, FIST_L, FIST_R } from './wren-common'

const JAR = [
  '...................wwUU',
  '..................wwUUuu',
  '.................UUUUUuuT',
  '.................UUUuuuTT',
  '..................uuuTTT',
  '................UUUTTTTuuuuu',
  '..............UUUUUUUUUuuuuuuu',
  '............UUUUUUUUUUUuuuuuuuuT',
  '...........UUUUwUUUU.VWuuuuuuuuTT',
  '.........UUUUUUwUUUUVWWuuuuuuuuTTTT',
  '.........UwwUwwUUUUU.vUuu.....VWWTT',
  '........UUwwUwUUUUUUUUuuu...VVWiWWTT',
  '.......UUUUUUwUUUUUUUuuuu.vVVVWWuWvTT',
  '.......UUUwUUwUUUUUUuuuuuvvVVVVVvUTTT',
  '......UUUUUUwUUUUUUuuuuvu.vvvvvTTUTTTT',
  '......UUUUUUwUUUUUuuuuuvuuuuuUTTTTUTTT',
  '.....uUUUUUUwU..VVWWuuuvuuuuTTTTTTuTTTT',
  '.....uuUUUUUw.VVVWWiWuuvuuuTTTTTTTUTTTT',
  '.....uuuuuuuwvVVVWWWWvvuuuTTTTTUTTUTTTT',
  '.....uuuuuuwu.vvVVVVvvvuuTTTTTTTTTUTTTT',
  '.....uuuuUuuu...vvvvuuvVuuTTTTTTTTuTTTT',
  '.....uuuuUuuuuuuuuuuuuvVuuTTTTTTTTUTTTT',
  '....uuuuuUuwuuuuuuuuuuvVuuTTTTTTTTTUTTTT',
  '....uuuuuUuwuuuuuuuuuuvVuuuTTTTTTTTTTTTT',
  '....uuuuuUTwTTTTTTTTTTTvVTTTTTTTUTTTTTTT',
  '....uuTTTTuwuuuuuuuuuuuvVuuTTTTTTTTTTTTT',
  '....uuuuUUuwuuuuuuuuuuxvVuuTTTTTTUTTTTTT',
  '...uuuuuUuuwuoooooxxxxxvVxxxxxooTTTTTTTTT',
  '...uuuuuUowoooooooxxxxxxxxxxXIooUoooTTTTT',
  '...uuuuooooooIooouuuuuuuuuuxxxooooooooTTT',
  '...uuouuuuuuuuuuuuuuuuuuuTTTTTTTTTTTTTooT',
  '..uuuuuuuuuuuuuuuuuuuTTTTTTTTTTUwTTttttttt',
  'TTuuuuuuwwuuuuuuTTTTTTTTTTTTTTTTtttttttttttt',
  'TTTTUTTTTTTTTTTTTTTTTTTTTTTTTttttttttttttttt',
  '..TTTTTTTTTTTTTTTTTTTTTTtttttttttttttttttt',
  '......TTTTTTTTTTTTTttttttttttttttttttt',
  '.................tttttttttt',
]

const FACE = [
  '............mmNN',
  '...........mwmNNN',
  '..........mmmNNNNn',
  '..........mNNNNNNn',
  '...IIIIIIkNNNNNNnn',
  '.IwIIIIIIkkNNNNnn',
  'IIIIIIXIIIkknnnn',
  '.IIIIXIIIIXkkkk',
  '..IIIXIIIXIIX',
  '....IXIIXIX',
  '......IXX',
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
  'voooooooooooooooooooov',
  'vvvvvvvvvvvvvvvvvvvvvv',
  '..vvvvvvvvvvvvvvvvvv',
]

const HANDLE = [
  '.DDDD',
  'D....D',
  'D....D',
]

const CAN = [
  '..............kk',
  '.vVVVVVVv....kWVk',
  'vVWWWWVVVv..kWVVk',
  'vWiWWWVVVv.kVVvk',
  'vWWWWVVVVvkVvvk',
  'vWWWVVVVVvVvk',
  'vWWVVVVVvvvk',
  'vVVVVVVvvv',
  'vVVVVVvvvv',
  '.vvvvvvvv',
]

const DRIPS = [
  'u',
  '',
  '..w',
  '.u',
  '',
  '...u',
]

export const D02: Design = {
  id: 'd02',
  title: 'Bell-jar Keeper',
  concept: 'Keeps the glasshouse seedlings, and keeps one under a bell jar on his own head; a moss-green can low at his side.',
  pal: PAL,
  headBottom: 62,
  parts: [
    { id: 'shadow', group: 'feet', x: 34, y: 73, rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 72, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 39, y: 62, rows: BODY },
    { id: 'handB', group: 'hands', x: 35, y: 65, rows: FIST_L },
    { id: 'jar', group: 'head', x: 28, y: 24, rows: JAR, squash: [9, 16, 23] },
    { id: 'face', group: 'head', x: 43, y: 56, rows: FACE },
    { id: 'handle', group: 'prop', x: 63, y: 63, rows: HANDLE, ring: 1 },
    { id: 'can', group: 'prop', x: 62, y: 66, rows: CAN },
    { id: 'handF', group: 'hands', x: 64, y: 61, rows: FIST_R },
    { id: 'drips', group: 'fx', x: 77, y: 70, rows: DRIPS, ring: 0, hidden: true },
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
  // he tips the can (the spout dips), and it drips
  tic: [
    { nudge: { can: [1, 1] } },
    { nudge: { can: [1, 2], handF: [0, 1] }, show: ['drips'] },
    { nudge: { can: [1, 2], handF: [0, 1], drips: [0, 2] }, show: ['drips'] },
    { nudge: { can: [1, 1] } },
    {},
  ],
  ticMs: [140, 200, 220, 160, 200],
}
