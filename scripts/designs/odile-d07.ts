/**
 * Odile design 07 — the Fan Merchant. Hand-authored pixel maps (see odile-lib.ts).
 *
 * She sells painted fans and lace at the river fair and is the best-dressed
 * woman on the quay: a tall carved comb standing up behind her head, a plum
 * lace mantilla thrown over it and falling to her shoulders, the leaf ears out
 * through the lace; a cream collar on a rose gown, and a painted silk fan
 * held open at her hip.
 * Silhouette: a scalloped comb over a dome of lace, the ears out flat.
 * Tic: the fan snaps shut and flutters open again.
 */
import type { Design } from './odile-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, EAR_FAR, EAR_NEAR, CHEEK, gown, over } from './odile-common'

const COMB = [
  '',
  '..............u....u',
  '.........o....o....U',
  '......oooOoooOOoooooUUUU',
  '.....oooOwooooooooooUUUUU',
  '....uoooouooooouooooUuUUUu',
  '...oouoooouoooouoooouUUUUuu',
  '...ooouooouoooouoooouUUUuUu',
  '..ooooouooouooouooouUUUuUUUu',
  '..oooooouoouooouooouUUuUUUUu',
  '.oooooooouuouoouoouUuuUUUUUuu',
  '.UooooooooououououUuUUUUUUUuu',
  '.UUooooooooouuououuUUUUUUUUuu',
  '.UUUoooooooooOOOOuUUUUUUUUUuu',
  '.uuuuuuuuuuuOOOOOOuuuuuuuuuuu',
  '.uuuuuuuuuuuOOOOOOuuuuuuuuuuu',
  '',
  '',
]

const VEIL = [
  '...................iiiiiiii',
  '................iiiiiiiiiiiiiP',
  '..............iiiiiwiiiiiiiiiPPP',
  '............iiiwwiiiiPiiiiiPiPPPPi',
  '...........iiiPpPiiiPpPiiiPpPiPPipp',
  '..........iiiiiPiiiiiPiiiiiPiiPPPiPp',
  '..........iiiiiiiiiiiiiiiiiiiiPppppp',
  '.........iiiPiiiiiPiiiiiPiiiipppppppp',
  '.........iiPpPiiiPpPiiiPpPiiipppp',
  '........iiiiPiiiiiPiiiiiPiiiipp',
  '........iiiiiiiiiiiiiiiiiiiiipp',
  '........iPiiiiiPiiiiiPiiiiiPipp',
  '........PpPiiiPpPiiiPpPiiiPpPpp',
  '.......iiPiiiiiPiiiiiPiiiiiPipp',
  '.......iiiiiiiiiiiiiiiiiiiiiipp',
  '.......iiiiiPiiiiiPiiiiiPiiiipp',
  '......pPiiiPpPiiiPpPiiiPpPiiipp',
  '......PiiiiiPiiiiiPiiiiiPiiiPpp',
  '.....PiiiiiiiiiiiiiiiiiiiiiiPpp',
  '.....PPiiPiiiiiPiiiiiPiiiiiiPpp',
  '.....PPiPpPiiiPpPiiiPpPiiiipipp',
  '....PPPPiPiiiiiPiiiiiPiiiiPiPpp',
  '....PPPPPiiiiiiiiiiiiiiiiPPPPpp',
  '...PPPiPPPiiPiiiiiPiiiiiiPPPPpp',
  '...PPipiPPPPpPiiiPpPiiPipiPPPpp',
  '...PPPiPPPPPPPiiiiPiPPPPiPPPPpp',
  '..PPPPPPPPPPPPPPPPPPPPPPPPPPPpp',
  '..PPPPPPPPPPPPPPPPPPPPPPPPPPPpp',
  '..PPpPPPPpPPPPpPPPPpPPPPpPPPPpp',
  '.PPpipPPpipPPpipPPpipPPpipPPpip',
  '..pppp.pppp.pppp.pppp.pppp.pppp',
  '...pp...pp...pp...pp...pp...pp',
]

const FRINGE = [
  '.iiiPPPp',
  'iiiPPPPpp',
  'iiPPPPpp',
  'iPPPPpp',
  '.PPPpp',
  '..pp',
]

const FAN = [
  'Ug',
  'GGgg',
  'GvQQjQ',
  'vQQRQQjQ',
  '.QQRQQRQQj',
  '.QjQRQQRQQR',
  '..QQRQRQQRr',
  '..QQRQRQRRr',
  '...QRQRRRr',
  '....RRrRr',
  '......rr',
]

const FAN_SHUT = [
  'Ug',
  'GGg',
  'vQQ',
  '.QQR',
  '.QQRr',
  '..QRRr',
  '...QRr',
  '....QRr',
  '.....Rr',
]

const FAN_HALF = [
  'Ug',
  'GGg',
  'GvQQj',
  'vQQRQQ',
  '.QQRQQR',
  '.QjQRQRR',
  '..QQRRRr',
  '...QRRr',
  '....RRr',
  '.....rr',
]

const COLLAR = [
  'FFFFFFFFFFFFFEe',
  '.EFEFEFEFEFEFe',
]

const BODY = over(gown({ l: 'Q', m: 'R', d: 'r', t: 'p' }), [[5, 5, COLLAR]])

export const D07: Design = {
  id: 'd07',
  title: 'Fan Merchant',
  concept: 'Sells painted fans and lace at the river fair: a tall carved comb under a plum lace mantilla, a painted silk fan held open at her hip.',
  pal: PAL,
  headBottom: 53,
  parts: [
    { id: 'shadow', group: 'feet', x: 33, y: 66, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 64, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 38, y: 47, rows: BODY, squash: [9] },
    { id: 'comb', group: 'head', x: 35, y: 12, rows: COMB },
    { id: 'fringe', group: 'head', x: 56, y: 34, rows: FRINGE },
    { id: 'veil', group: 'head', x: 27, y: 22, rows: VEIL, squash: [7, 11], spread: [27, 28, 29, 30] },
    { id: 'cheek', group: 'head', x: 58, y: 41, rows: CHEEK },
    { id: 'earL', group: 'head', x: 17, y: 36, rows: EAR_FAR },
    { id: 'earR', group: 'head', x: 68, y: 30, rows: EAR_NEAR },
    { id: 'fan', group: 'prop', x: 65, y: 56, rows: FAN },
    { id: 'handB', group: 'hands', x: 33, y: 55, rows: FIST_L },
    { id: 'handF', group: 'hands', x: 63, y: 54, rows: FIST_R },
  ],
  idle: [
    {},
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], fringe: [0, 1], comb: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], fringe: [0, 1], comb: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], fringe: [0, 1], comb: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], fringe: [0, 1], comb: [0, 1] } },
    {},
  ],
  idleMs: [190, 130, 150, 200, 130, 170],
  // the fan snaps shut and flutters open again, a merchant's flourish over a good price
  tic: [
    { swap: { fan: FAN_HALF } },
    { swap: { fan: FAN_SHUT }, nudge: { handF: [0, -1] } },
    { swap: { fan: FAN_SHUT }, nudge: { handF: [0, -1] }, squash: 1 },
    { swap: { fan: FAN_HALF } },
    {},
    { swap: { fan: FAN_HALF } },
  ],
  ticMs: [90, 90, 220, 90, 160, 90],
}
