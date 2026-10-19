/**
 * Odile design 02 — the Barge Trader. Hand-authored pixel maps (see odile-lib.ts).
 *
 * She sells silk off the long barges that pole down to the Rosethread fords:
 * a tall plaited straw riverhat with a rose band whose bow streams off behind,
 * silver hair, the leaf ears out under the brim; a rose gown with a plum
 * shawl, and a furled parasol carried low like a cane (it never comes near
 * the hat). Silhouette: a sugarloaf crown on a wide brim, the bow flying off.
 * Tic: she twirls the parasol on its ferrule.
 */
import type { Design } from './odile-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, EAR_FAR, EAR_NEAR, CHEEK, HAIR_FLARE, gown, ink, over } from './odile-common'

const HAT = [
  '...................OOOOwOOO',
  '................OOOwwOOOOOOOOo',
  '................OOOOOOOOOOOOoo',
  '................UUoOOOoOOooUoU',
  '...............woUUUoUooooUUUU',
  '...............OOOOOOOOOooooUUU',
  '...............OoOOOOoOOooUoUUU',
  '...............OOoOOOOoOoooUUUU',
  '...............OOOOOOOOOooooUUU',
  '..............OOoOOOOoOOooUoUUU',
  '..............OoOOOOoOOOoUoooUuU',
  '..............OOOOOOOOOOoooooUUU',
  '..............OOOoOOOOoooooUoUUU',
  '..............OOOOoOOOOUooooUUUU',
  '.............OOOOOOOOOOooooooUUU',
  '.............OOoOOOOoOOooUoooouUU',
  '.............OoOOOOoOOOoUooooUUUU',
  '.............OOOOOOOOOooooooooUUU',
  '.............QjjQQQQRRRRRRRRRRUUU',
  '........OOQQQQQQQQQQRRRRRRRRRRRrrrrrro',
  '....OOOOOOQQQQQQQQQQRRRRRRRRRRRrrrrrrooooo',
  '.OOOOOOOwwooOooOooOooOooOooOooOooOooooooooooo',
  'oOOOooOooOOOOOOOOOOOOOOOOOOOOOOooooooooooooooo',
  '.ooooOOOOOOOOOOOOOOOOOOOOOOoooooooooooooooooo',
  '.uuuoooooooooooooooooooooooooooooooooooooouuu',
  '..oouuuuooooooooooooooooooooooooooooooUUuuuu',
  '.....oooooooooooooooUUUUUUUUUUUUUUUUUuuuu',
  '............oooooooUUUUUUUUUUUuuuu',
  '',
  '',
]

const BOW = [
  'rRR......',
  'rrRRRRQQ..',
  'rrrRRRRQQ',
  'rr..rrRRQ.',
  'rr....rrR..',
  'r......r...',
]

const PARASOL = [
  '..uUUu',
  '.uU..Uu',
  '.uU..UU',
  '.....UU',
  '.....UU',
  '.....UU',
  '.....UU',
  '.....UU',
  '....QQRr',
  '...QjQRRr',
  '..QQQRRRrr',
  '..QQQRRRrr',
  '..vvvGGGgg',
  '...QQRRrr',
  '...QjRRr',
  '....QRRr',
  '....QRr',
  '.....Rr',
  '.....UU',
]

const PARASOL_TWIRL = [
  '..uUUu',
  '.uU..Uu',
  '.uU..UU',
  '.....UU',
  '.....UU',
  '.....UU',
  '.....UU',
  '.....UU',
  '....RRQr',
  '...RjRQQr',
  '..RRRQQQrr',
  '..RRRQQQrr',
  '..GGGvvvgg',
  '...RRQQrr',
  '...RjQQr',
  '....RQQr',
  '....RQr',
  '.....Qr',
  '.....UU',
]

const SHAWL = [
  'FFFFFFFFFFFFFEEe',
  '.eFFFFFFFFFEEee',
  '..eFFFFEFEEee',
  '....eFEEee',
  '......ee',
]

const HAIR = ink(HAIR_FLARE, { l: 'Q', m: 'R', d: 'r' })
const BODY = over(gown({ l: 'i', m: 'P', d: 'p', t: 'R' }), [[4, 6, SHAWL]])

export const D02: Design = {
  id: 'd02',
  title: 'Barge Trader',
  concept: 'Sells silk off the long barges at the fords: a tall straw riverhat, its rose bow streaming behind, a furled parasol carried low like a cane.',
  pal: PAL,
  headBottom: 53,
  parts: [
    { id: 'shadow', group: 'feet', x: 33, y: 66, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 64, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 38, y: 47, rows: BODY, squash: [9] },
    { id: 'parasol', group: 'prop', x: 61, y: 50, rows: PARASOL },
    { id: 'hair', group: 'head', x: 28, y: 41, rows: HAIR, spread: [9, 10, 11, 12] },
    { id: 'cheek', group: 'head', x: 57, y: 45, rows: CHEEK },
    { id: 'earL', group: 'head', x: 17, y: 38, rows: EAR_FAR },
    { id: 'earR', group: 'head', x: 68, y: 34, rows: EAR_NEAR },
    { id: 'bow', group: 'head', x: 23, y: 33, rows: BOW },
    { id: 'hat', group: 'head', x: 27, y: 17, rows: HAT, squash: [8, 13], spread: [22, 23, 24, 25] },
    { id: 'handB', group: 'hands', x: 33, y: 55, rows: FIST_L },
    { id: 'handF', group: 'hands', x: 64, y: 54, rows: FIST_R },
  ],
  idle: [
    {},
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], bow: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], bow: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], bow: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], bow: [0, 1] } },
    {},
  ],
  idleMs: [190, 130, 150, 200, 130, 170],
  // she twirls the parasol on its ferrule, chin up
  tic: [
    { nudge: { handF: [0, -1] } },
    { swap: { parasol: PARASOL_TWIRL }, nudge: { handF: [0, -1] } },
    { nudge: { handF: [0, -1] } },
    { swap: { parasol: PARASOL_TWIRL }, nudge: { handF: [0, -1] } },
    { squash: 1 },
    {},
  ],
  ticMs: [110, 110, 110, 110, 160, 200],
}
