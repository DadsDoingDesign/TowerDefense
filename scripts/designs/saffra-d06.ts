/**
 * Saffra design 06 — the Harvest Farmer. Hand-authored pixel maps (see saffra-lib.ts).
 *
 * Before she sold pepper she picked it: a tall woven straw sun hat with a red
 * ribbon and a chilli stuck in the band, a brim wider than she is, a ginger
 * plait out the back, and a basket of red peppers on her hip. Silhouette:
 * a peaked cone over the widest flat brim of the ten. Tic: she hitches the
 * basket up her hip and a pepper hops.
 */
import type { Design } from './saffra-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, bell } from './saffra-common'

const HAT = [
  '..................................AbbA',
  '.................................aAbwbA',
  '................................aAAbbwbA',
  '...............................aAAbbbBbbA',
  '..............................aAAAbbbbBbbA',
  '..............................aAbAbAbAbAbA',
  '.............................aaAAAbbbbbBbbA',
  '.............................aAbAbAbAbAbAbA',
  '............................aaAAAbbbbbbBbbbA',
  '............................aAbAbAbAbAbAbAbA',
  '...........................aaAAAAbbbbbbBBbbbA',
  '...........................aAbAbAbAbAbAbAbAbA',
  '..........................aaAAAAbbbbbbbBBbbbbA',
  '..........................aAbAbAbAbAbAbAbAbAbA',
  '.........................aaaAAAAbbbbbbbBBbbbbbA',
  '.........................aaAbAbAbAbAbAbAbAbAbAb',
  '........................rrRRRRRRRRRRRRRRRRRRRQQr',
  '........................rrRRRRRRRRRRRRRRRRRRRRQr',
  '.......................rrrRRRRRRRRRRRRRRRRRRRRrrr',
  '.......................aaAAAAAAbbbbbbbbbbbbBBbbbA',
  '..........aAAbAAbAAbAAbAAbAbbAbbAbbAbbAbbAbbAbbAbBBbbbbbbbbbbA',
  '....aaAAAbAAbAAbAAbAAbAAbbAbbAbbAbbAbbAbbAbbAbbAbbBbbBbbBbbbbbbbbbbA',
  '.aaAAAbAAbAAbAAbAAbAAbAAbAbbAbbAbbAbbAbbAbbAbbAbbAbBbbBbbBbbBbbbbbbbbbA',
  'aaaAAAbAAbAAbAAbAAbAAbAAbbAbbAbbAbbAbbAbbAbbAbbAbbbbbbbbbbbbbbbbbbbbbbbA',
  'aaAAAbAAbAAbAAbAAbAAbAAbAbbAbbAbbAbbAbbAbbAbbAbbAbbAbbbbbbbbbbbbbbbbbbbA',
  '.aaaaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAaaaaaa',
  '....uuuuaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaauuuu',
]

const CHILI = [
  '..u',
  '.uR',
  '.RQ',
  'RRQ',
  'RQ',
  'R',
]

const BRAID = [
  '.hHHh',
  'qhHHh',
  '.qhHHh',
  '.qhhHh',
  '..qhHHh',
  '..qhhHh',
  '...qhHH',
  '...qhhH',
  '...rRRQ',
  '...rrRR',
  '..hHHHh',
  '..qhHjh',
  '...qhHh',
  '....qh',
]

const FACE = [
  '.eEEF',
  'eEEEFF',
  'eEEEEFF',
  'eEEEF',
  '.eeE',
]

const BODY = bell({ d: 'x', m: 'X', l: 'R', t: 'L' })

const BASKET = [
  '...RQ..RQRQ',
  '..RRQRRRQRRQR',
  '.RRRRRRQRRRRRR',
  'uUVUVUVUVUVUVUu',
  'uUUUUUUUUUUUUUu',
  'uUVVUVVUVVUVVUu',
  'uUUUUUUUUUUUUUu',
  'uUVVUVVUVVUVVUu',
  '.uUUUUUUUUUUUu',
  '.uUVVUVVUVVUVu',
  '..uUUUUUUUUUu',
  '...uuuuuuuuu',
]

export const D06: Design = {
  id: 'd06',
  title: 'Harvest Farmer',
  concept: 'Picked pepper before she sold it: a woven sun hat wider than she is, a chilli in the band, a ginger plait, a basket on her hip.',
  pal: PAL,
  headBottom: 41,
  parts: [
    { id: 'shadow', group: 'feet', x: 31, y: 59, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 41, y: 56, rows: FEET, ring: 0 },
    { id: 'braid', group: 'head', x: 21, y: 38, rows: BRAID },
    { id: 'body', group: 'body', x: 35, y: 43, rows: BODY },
    { id: 'face', group: 'head', x: 62, y: 40, rows: FACE },
    { id: 'hat', group: 'head', x: 14, y: 12, rows: HAT, squash: [5, 9] },
    { id: 'chili', group: 'head', x: 57, y: 24, rows: CHILI },
    { id: 'handB', group: 'hands', x: 31, y: 47, rows: FIST_L },
    { id: 'basket', group: 'prop', x: 58, y: 46, rows: BASKET },
    { id: 'handF', group: 'hands', x: 57, y: 47, rows: FIST_R },
  ],
  idle: [{}, { squash: 1 }, { squash: 2, move: { hands: [0, 1], prop: [0, 1] } }, { squash: 2, move: { hands: [0, 1], prop: [0, 1] } }, { squash: 1 }, {}],
  idleMs: [230, 150, 170, 230, 150, 210],
  // she hitches the basket up her hip and a pepper hops out of the heap and back
  tic: [
    { move: { prop: [0, 1], hands: [0, 1] }, squash: 1 },
    { move: { prop: [0, -3], hands: [0, -3] } },
    { move: { prop: [0, -3], hands: [0, -3] }, squash: 1 },
    { move: { prop: [0, -1], hands: [0, -1] } },
    {},
  ],
  ticMs: [130, 110, 200, 130, 220],
}
