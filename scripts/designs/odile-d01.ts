/**
 * Odile design 01 — the Loom Mistress. Hand-authored pixel maps (see odile-lib.ts).
 *
 * She runs the long looms at the Rosethread fords and wears her trade on her
 * head: a silk spool for a hat, two turned wooden flanges and the rose thread
 * wound between them; plum hair flaring out beneath, the leaf ears through
 * it; a green gown, a linen apron, a shuttle in her fist, held low.
 * Silhouette: a spool on a flared head, the ears out flat.
 * Tic: she throws the shuttle across to her other hand and back.
 */
import type { Design } from './odile-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, EAR_FAR, EAR_NEAR, CHEEK, HAIR_FLARE, gown, ink, over } from './odile-common'

const HAT = [
  '................OOOOOOOOOOOUUU',
  '...........OOOOOOOUUUUUUUUUUUUUUUUU',
  '..........OOOOUUUUOwOOOOOOOUUUUUUUUo',
  '..........OOOOwwOOOOOOOOOUUUUUUUUUoo',
  '..........uooooUUUUUUUUUUUUUUoooooou',
  '...........oouuuooooooooooooooUUuuu',
  '.............QQQQRRRRRRRRRRRRrrrrr',
  '.............RRRRQQQQQQQQrrrQRrrrr',
  '.............QQjjRRRRRRRRRRRQrrrrr',
  '.............RRRRQQQQQQQQrrrQRrrrr',
  '.............QQjQRRRRRRRRRRRQrrrrr',
  '.............RRRRQQQQQQQQrrrQRrrrr',
  '.............QQQQRRRRRRRRRRRQrrrrr',
  '.............RRRRQQQQQQQQrrrQRrrrr',
  '.............QQQQRRRRRRRRRRRQrrrrr',
  '.............RRRRQQQQQQQQrrrQRrrrr',
  '.............QQQQRRRRRRRRRRRQrrrrr',
  '.............OOOOOOOOOOOOOOOOOOOOr',
  '......OOOOOOOOOOOOOOOOOOOOOOOOOOOOUUUUUU',
  '...OOOOOOOyyyOOOOOOOOOOOOOOOOOOOUUUUUUUUUUU',
  '..OOOOOwwOOOOOOOOOOOOOOOOOOOUUUUUUUUUUUUUUoo',
  '...ooUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUoooo',
  '...uuuooooooUUUUUUUUUUUUUUUUUUUUoooooooouuu',
  '....oooooouuuooooooooooooooooooooUUUUUUuuu',
  '.........ooooooooUUUUUUUUUUUUUUUUUuuu',
  '',
]

const SHUTTLE = [
  '...oOOOOOOOOOOo',
  '.oOOOrRRQQjOOOOw',
  'UoooorRRRQQoooOO',
  '.UUUUrrrrrrUUUo',
  '...UUUUUUUUUUu',
]

const SHUTTLE_L = [
  'oOOOOOOOOOOo...',
  'wOOOOjQQRRrOOOo.',
  'OOoooQQRRRrooooU',
  'oUUUrrrrrrUUUU.',
  'uUUUUUUUUUU...',
]

const APRON = [
  '.FFFFFFEEe',
  'FFwFFFFEEe',
  'FFFFFFEEEe',
  'FFFeeeeeEee',
  'FFFeFFEeEee',
  'FeFeFEEeEee',
  'FFEFEFEeEee',
  'eeeeeeeeeeee',
]

const HAIR = ink(HAIR_FLARE, { l: 'i', m: 'P', d: 'p' })
const BODY = over(gown({ l: 'v', m: 'G', d: 'g', t: 'R' }), [[7, 7, APRON]])

export const D01: Design = {
  id: 'd01',
  title: 'Loom Mistress',
  concept: 'Runs the long looms at the fords and wears her trade: a silk spool for a hat, rose thread wound on it, a shuttle held low in her fist.',
  pal: PAL,
  headBottom: 53,
  parts: [
    { id: 'shadow', group: 'feet', x: 33, y: 66, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 64, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 38, y: 47, rows: BODY, squash: [9] },
    { id: 'hair', group: 'head', x: 28, y: 41, rows: HAIR, spread: [9, 10, 11, 12] },
    { id: 'cheek', group: 'head', x: 57, y: 45, rows: CHEEK },
    { id: 'earL', group: 'head', x: 17, y: 38, rows: EAR_FAR },
    { id: 'earR', group: 'head', x: 68, y: 34, rows: EAR_NEAR },
    { id: 'hat', group: 'head', x: 25, y: 19, rows: HAT, squash: [10, 13], spread: [20, 21, 22] },
    { id: 'shuttle', group: 'prop', x: 55, y: 56, rows: SHUTTLE },
    { id: 'shuttleL', group: 'prop', x: 27, y: 57, rows: SHUTTLE_L, hidden: true },
    { id: 'handB', group: 'hands', x: 33, y: 55, rows: FIST_L },
    { id: 'handF', group: 'hands', x: 63, y: 54, rows: FIST_R },
  ],
  idle: [
    {},
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1] } },
    {},
  ],
  idleMs: [190, 130, 150, 200, 130, 170],
  // a weaver's pass: the shuttle flies across under her hands to the other fist, and back
  tic: [
    { move: { hands: [0, 1], prop: [0, 1] }, squash: 1 },
    { hide: ['shuttle'], show: ['shuttleL'], at: { shuttleL: [44, 58] }, nudge: { handF: [-2, 1] } },
    { hide: ['shuttle'], show: ['shuttleL'], nudge: { handB: [1, 0] } },
    { hide: ['shuttle'], show: ['shuttleL'], squash: 1, nudge: { handB: [1, 1] } },
    { at: { shuttle: [45, 57] }, nudge: { handF: [-2, 1] } },
    {},
  ],
  ticMs: [140, 90, 220, 160, 90, 180],
}
