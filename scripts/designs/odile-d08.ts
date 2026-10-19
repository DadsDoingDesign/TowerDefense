/**
 * Odile design 08 — the Bolt Weaver. Hand-authored pixel maps (see odile-lib.ts).
 *
 * She weaves the long bolts at the loom-houses up the river and carries the
 * best of them herself: long pale rose hair falling straight like a curtain
 * of silk, a fine circlet of green leaves on her brow, the leaf ears out
 * through it; a plum gown, and a bolt of green silk under her arm, its
 * rolled end out and a length hanging free.
 * Silhouette: a tall curtain of pale hair, the ears out flat through it.
 * Tic: she shakes the bolt's end so the silk flutters.
 */
import type { Design } from './odile-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, EAR_FAR, EAR_NEAR, CHEEK, gown } from './odile-common'

const HAIR = [
  '...................jjjRjjjj',
  '................jjjjjjRjjjjjjj',
  '..............jjjjRjjjRjjjRjjjjQ',
  '.............jRjwjRjjRjjjjRjjjjjQ',
  '............jjRjjjRjjRjjjjRjjjRjQQ',
  '...........jjwwjjRjjjjjjjjRjjjRjQQR',
  '..........jjjRjjjRjjjjjjjjRjjjjRQQQR',
  '..........jjjRjjjRjjjjjjjjRjjjjRQQQR',
  '.........jwjRjjjRjjjjjjjjjRjjjjRQQQRR',
  '.........jjjRjjjRjjjjjjjjjjRjjjjRQQRR',
  '.........jjRjjjjRjjjjjjjjjjRjjjjRQQRR',
  '.........jjRjjjjRjjjjjjjjjjRjjjjRQQQR',
  '.........jjRjjjjRjjjjjjjjjjRjjjjRQQQR',
  '........jjRjjjjRjjjjjjjjjjjRjjjjQRQQRR',
  '........jjRjjjjRjjjjjjjjjjjRjjjjQRQQRR',
  '........jjRjjjjRjjjjjjjjjjjRjjjQQQQQRR',
  '........jjRjjjjRjjjjjjjjjjjRjjjQQQQQQR',
  '........jjRjjjjRjjjjjjjjjjjRjjjQQQQQRR',
  '.......jjjRjjjRjjjjjRjjjjjjRjjjRRRRRRRR',
  '.......jjRjjjjRjjjjjRjjjjjjRRRRRRRRRRR',
  '.......jjRjjjjRjjjjjRjjjjRjRRRRRR',
  '.......jjRjjjjRjjjjjRjjjjRjjRR',
  '.......jjRjjjjRjjjjjRjjjjRjjRR',
  '......jjjRjjjjRjjjjjRjjjjRjjRR',
  '......jjjRjjjjRjjjjjRjjjjRjjRRR',
  '......QjjRjjjjRjjjjjRjjjjRjQRRR',
  '......QQRjjjjjRjjjjjRjjjjRQQRRR',
  '......QQRjjjjRjjjjjjRjjjjRQQRRR',
  '.....QQQRjjjjRjjjjjjRjjjQRQQRQR',
  '.....QQQRQjQjRjjjjjjRjQjQRQQQQR',
  '.....QQQRQjQQRjjjjjjRQQjQRQQQQRR',
  '....QQQQRQjQQRQjQQQRQQQjQQRQQQQR',
  '....QQQQRQQQQRQjQQQRQQQjQQRQQQQQ...QQQRQQR',
  '....QQQQRQQQQRQjQQQRQQQjQQRQQQQQQRQQQQRQQR',
  '...QQQQRjQQQQRQjQQQRQQQQQQRQQQQQQRQQQQQRQRR',
  '...QQQQRQQQQQRQjQQQRQQQQQQRQQQQQQQRQQQQRQQR',
  '...QQQQRQQQQRQQjQQQRQQQQQQRQQQQQQQRQQQQRQQR',
  '..QQQQQRQQQQRQQQQQQRQQQQQQRQQQQQQQRQQQQQRQRR',
  '..QQQQQRQQQQRQQQQQQRQQQQQQRQQQQQQQQRQQQQRQQR',
  '..QQQQRQQQQQRQQQQQQRQQQQQQRQQQQQQQQRQQQQRQQR',
  '.QQQQQRQQQQQRQQQQQQRQQQQQQRQQQQQQQQRQQQQQRRRR',
  '.QQQQQRQQQQQRQQQQQQRQQQQQQRQQQQQQQQQRQQQQRRRR',
  '.QQQQQRQQQQQRQQQQQQRQQQQQQRQQRRRRRRRRRRRRRRR',
  '.QQQRRQRQQRRQRQQRRQRQQRRQRQQRRRRRRRRRRRRRRR',
  '.RRRRRRrRRRRRrRRRRRrRRRRRrRRRRR',
  '..RRRR..RRRR..RRRR..RRRR..RRRR',
]

const CIRCLET = [
  '..gg.....gg.....gg.....gg',
  '.gvVg...gvVg...gvVg...gvVg',
  'gvVvGgggvVvGgggvVvGgggvVvGg',
  '.gGGgGGggGGgGGggGGgGGggGGg',
  '..gg..gg..gg..gg..gg..gg',
]

const BOLT = [
  '.gGGGGGGGGGGGGgg.',
  'gvvvvvvvvvvvvvvGgg',
  'gvVvvvvvvvvvvvvGGg',
  'gGGGGGGGGGGGGGGGgg',
  'gGGGGGGGGGGGGGGGgg',
  'ggggggggggggggggg',
]

const BOLT_END = [
  '.gGGg',
  'gvVvGg',
  'gVggvg',
  'gvgvGg',
  'gGvGgg',
  '.gggg',
]

const SILK_END = [
  'vGg',
  'vGg',
  'vGgg',
  '.vGg',
  '.vGg',
  'vGg',
  'vg',
]

const SILK_END_FLUTTER = [
  'vGg',
  'vGg',
  '.vGg',
  '..vGg',
  '..vGg',
  '...vg',
  '...vg',
]

const BODY = gown({ l: 'i', m: 'P', d: 'p', t: 'G' })

export const D08: Design = {
  id: 'd08',
  title: 'Bolt Weaver',
  concept: 'Weaves the long bolts at the loom-houses: pale rose hair falling straight like silk, a leaf circlet, a bolt of green silk under her arm.',
  pal: PAL,
  headBottom: 52,
  parts: [
    { id: 'shadow', group: 'feet', x: 33, y: 66, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 64, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 38, y: 47, rows: BODY, squash: [9] },
    { id: 'cheek', group: 'head', x: 59, y: 36, rows: CHEEK },
    { id: 'hair', group: 'head', x: 27, y: 12, rows: HAIR, squash: [8, 12], spread: [40, 41, 42, 43] },
    { id: 'circlet', group: 'head', x: 35, y: 20, rows: CIRCLET, ring: 0 },
    { id: 'earL', group: 'head', x: 21, y: 30, rows: EAR_FAR },
    { id: 'earR', group: 'head', x: 69, y: 24, rows: EAR_NEAR },
    { id: 'silkEnd', group: 'prop', x: 76, y: 65, rows: SILK_END },
    { id: 'bolt', group: 'prop', x: 58, y: 62, rows: BOLT },
    { id: 'boltEnd', group: 'prop', x: 72, y: 62, rows: BOLT_END },
    { id: 'handB', group: 'hands', x: 33, y: 55, rows: FIST_L },
    { id: 'handF', group: 'hands', x: 62, y: 62, rows: FIST_R },
  ],
  idle: [
    {},
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], circlet: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], circlet: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], circlet: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], circlet: [0, 1] } },
    {},
  ],
  idleMs: [190, 130, 150, 200, 130, 170],
  // she shakes out the end of the bolt to show its fall, and the silk flutters
  tic: [
    { nudge: { bolt: [0, -1], boltEnd: [0, -1], silkEnd: [0, -1], handF: [0, -1] } },
    { swap: { silkEnd: SILK_END_FLUTTER }, nudge: { bolt: [0, -1], boltEnd: [0, -1], silkEnd: [0, -1], handF: [0, -1] } },
    { swap: { silkEnd: SILK_END_FLUTTER } },
    {},
    { swap: { silkEnd: SILK_END_FLUTTER }, squash: 1 },
    {},
  ],
  ticMs: [110, 140, 160, 120, 160, 200],
}
