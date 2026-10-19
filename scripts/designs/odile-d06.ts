/**
 * Odile design 06 — the Ribbon Dancer. Hand-authored pixel maps (see odile-lib.ts).
 *
 * She dances the spring fair at the fords and sells the ribbons she dances
 * with: rose hair flaring to her shoulders, a big plum silk bloom tucked at
 * the back of her crown with two spring leaves, the leaf ears out through it;  a green
 * gown with a linen flounce, and a ribbon wand held low, its silk thrown in
 * a loop round her side to the grass.
 * Silhouette: a round head with a rose standing up off its back, the ears out flat.
 * Tic: a flick of the wand spins the loop round.
 */
import type { Design } from './odile-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, EAR_FAR, EAR_NEAR, CHEEK, gown, over } from './odile-common'

const HAIR = [
  '..................QQQQQQQQ',
  '...............QQQQQQQQQQQQQQ',
  '.............QQQQQRQQQRQQQQQQQQ',
  '............QQRQQQwQQQRQQQRQQQQQ',
  '...........QQQwwQRQQQQRQQQRQQQQQQ',
  '..........QQQRQQQRQQQQRQQQRQQQQQQr',
  '.........QQwQjQQQRQQQQRQQQRQQRQQQQr',
  '.........QQQjQQQRQQQQQRQQQRQQRQQQQr',
  '........QQQQRQQQRQQQQRQQQQQRQQRQQQrr',
  '........QQQjQQQQRQQQQRQQQQQRQQRQQQrr',
  '........QQQRQQQQRQQQQRQQQQQRQQRQQQrr',
  '........QQRQQQQRQQQQQRQQQQQRQQRQQQrr',
  '........QQRQQQQRQQQQQRQQQQQRQQRQQQrr',
  '........QQRQQQQRQQQQQRQQQQQQQQQRQQrr',
  '........QQRQQQQRQQQQQRQQQQQQQQQRQRRr',
  '........QRQQQQQRQQQQQRQQQQQQQQQQQrRr',
  '.......QQRQRQQQRQQQQQRQQRQQQQQQQQrRRr',
  '.......QQRQRQQRQQQQQQRQQRQQQQQQQRRRRr',
  '......QQRQQRQQRQQRQQRQQQRQQQQQQQRRRrrr',
  '......QQRQRQQQRQQRQQRQQQRQQQQQrrrrrrrr',
  '......QQRQRQQQRQQRQQRQQQRQQQrrrrrrrrr',
  '.....QQQQQRQQQRQQRQQRQQQRQQQrrrr',
  '.....QQQQQrQQQRQQrQQRQQQRQQQrr',
  '....QQQQQQrQQQQQRQQQRQQQRQQRrr',
  '....QQQQQQrQQQQQRQQQRQQQRQRRrr',
  '...RRQQQQRQQQQQQRQQQQQQQRRRRrr',
  '..RRRRRQQrQQQQQQRQQQQRRRRRRRrr',
  '..RRRRRRRrRRRRRRRrRRRRRRRRRRrr',
  '.RRRRRRRRrRRRRRRRrRRRRRRRRRRrr',
  '.RRRRRRRRRRRRRRRRrRRRRRRRRrrrr',
  '.RRRRrRRRRRRRRRRRRRRRRRRRrrrrr',
  '.rrrrrrRrRRrrRrRRRrrRrRRrrrr',
  '..rrrrr.rrrrrrrrrrrrrrrrrrr',
  '.........rrrr..rrrrr..rrrr',
]

const WREATH = [
  '',
  '......iii',
  '.....wwiii',
  '...iiiiiiPii',
  '..iiwPiiiiiiP',
  '..iiiiiiiiiPP',
  '..viiiiyyipP',
  '.vviiiiiOPPP',
  'GGGiiipiPPPpv',
  '..GGiiiPPPpGvv',
  '.....iP.PpGGGG',
  '.........GGGGGG',
  '..........GGG',
]

const RIBBON = [
  '.........uU',
  '........uU',
  '.......uU',
  '......uUjQQ',
  '.....jQQQRRrr',
  '....jQQr...RRr',
  '...jQQ......RRr',
  '..jQQ........RRr',
  '..QQR.........RRr',
  '..QQR.........RRr',
  '..QQR........QRRr',
  '...QRR......jQRr',
  '....RRRQQQQQRRr',
  '......rrrrrr',
]

const RIBBON_TWIRL = [
  '.........uU',
  '........uU',
  '.......uU',
  '......uURRrr',
  '.....jQQr.RRr',
  '....jQQ....RRr',
  '....QQ......RRr',
  '....QQR.....RRr',
  '.....QRR...QRRr',
  '......RRQQQRRr',
  '........jQQQ',
  '..........QQRr',
  '............RRr',
  '..............rr',
]

const FLOUNCE = [
  'FEEFEEFEEFEEFEEFEEFEEFEF',
  'EeeEeeEeeEeeEeeEeeEeeEeE',
]

const BODY = over(gown({ l: 'v', m: 'G', d: 'g', t: 'e' }), [[0, 13, FLOUNCE]])

export const D06: Design = {
  id: 'd06',
  title: 'Ribbon Dancer',
  concept: 'Dances the spring fair at the fords and sells the ribbons she dances with: a plum silk bloom tucked in her rose hair, a ribbon wand looped low.',
  pal: PAL,
  headBottom: 53,
  parts: [
    { id: 'shadow', group: 'feet', x: 33, y: 66, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 64, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 38, y: 47, rows: BODY, squash: [9] },
    { id: 'wreath', group: 'head', x: 31, y: 14, rows: WREATH },
    { id: 'cheek', group: 'head', x: 58, y: 43, rows: CHEEK },
    { id: 'hair', group: 'head', x: 28, y: 20, rows: HAIR, squash: [8, 12], spread: [29, 30, 31, 32] },
    { id: 'earL', group: 'head', x: 17, y: 36, rows: EAR_FAR },
    { id: 'earR', group: 'head', x: 67, y: 34, rows: EAR_NEAR },
    { id: 'ribbon', group: 'prop', x: 57, y: 55, rows: RIBBON },
    { id: 'handB', group: 'hands', x: 33, y: 55, rows: FIST_L },
    { id: 'handF', group: 'hands', x: 63, y: 56, rows: FIST_R },
  ],
  idle: [
    {},
    { squash: 1, nudge: { wreath: [0, 0], earL: [0, 1], earR: [0, 1], cheek: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { wreath: [0, 0], earL: [0, 1], earR: [0, 1], cheek: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { wreath: [0, 0], earL: [0, 1], earR: [0, 1], cheek: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { wreath: [0, 0], earL: [0, 1], earR: [0, 1], cheek: [0, 1] } },
    {},
  ],
  idleMs: [190, 130, 150, 200, 130, 170],
  // she flicks the wand and the ribbon's loop spins round, then falls back
  tic: [
    { nudge: { handF: [0, -1], ribbon: [0, -1] } },
    { swap: { ribbon: RIBBON_TWIRL }, nudge: { handF: [1, -2], ribbon: [1, -2] }, squash: 1 },
    { swap: { ribbon: RIBBON_TWIRL }, nudge: { handF: [1, -2], ribbon: [1, -2] } },
    { nudge: { handF: [0, -1], ribbon: [0, -1] } },
    { swap: { ribbon: RIBBON_TWIRL } },
    {},
  ],
  ticMs: [100, 120, 160, 120, 140, 200],
}
