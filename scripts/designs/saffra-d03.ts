/**
 * Saffra design 03 — the Field Burner. Hand-authored pixel maps (see saffra-lib.ts).
 *
 * Every summer the pepper stubble is burned off, and Saffra sells the burn: a
 * scorched leather kettle hat with an ember band, its wide brim drooping, a
 * red kerchief tied over her nose against the smoke, and a pole with a
 * burning straw sheaf. Silhouette: a wide brim with a flame standing off it.
 * Tic: she gives the sheaf a swing and it flares, spitting embers.
 */
import type { Design } from './saffra-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, bell } from './saffra-common'

const HAT = [
  '........................uUVVVVVVVVUUUu',
  '.....................uUVVVwbVVVVVVVUUUUUu',
  '...................uUVVVBBVVVVVVVVVUUUUUUUu',
  '..................uUVVVVbVVVVVVuVVVUUUUUUUUu',
  '.................uUUVVVVVVVVVVVuVVVUUUUUUUUUu',
  '................uuUVVVVVVVVVVVVuVVUUUUUUUUUUu',
  '................uuUVVVVVVVVVVVVuVVUUUUUUUUUUUu',
  '................uuUVVVVVVVVVVVVuVVUUUUUUUUUUUu',
  '...............uuUUVVVVVVVVVVVVuVUUUUUUUUUUUUu',
  '...............uuUUVVVVVVVVVVVVuVUUUUUUUUUUUUUu',
  '...............uuUUVVVVVVVVVVVVuVUUUUUUUUUUUUUu',
  '...............uuuUUVVVVVVVVVVVuUUUUUUUUUUUUUUu',
  '...............uuuUUVVVVVVVVVVVuUUUUUUUUUUUUUUu',
  '..............uuuUUUVVVVVVVVVVVuUUUUUUUUUUUUUUu',
  '..............uuuUUUUVVVVVVVVVVuUUUUUUUUUUUUUUUu',
  '..............uuuUUUUVVVVVVVVVVuUUUUUUUUUUUUUUUu',
  '..............uuuuUUUUUUUUUUUUUuUUUUUUUUUUUUUUuu',
  '..............rrRRQQQQQQQQQQQQQQQQQQRRRRRRRRRRRr',
  '.............rrRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRr',
  '.............rrrRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRrr',
  '.............rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
  '......uUUVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUUUUUu',
  '...uUUUVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUUUUUuu',
  '.uuUUUUVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUUUUUUuu',
  'uuuUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUuu',
  'uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu',
  'uuuuuuuuukkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkuuuuuuuuu',
  '.uuuuuuu..............................................uuuuuuu',
  '..uuuu...................................................uuuu',
]

const HAIRB = [
  '.hHHHHHHHHHh',
  'qhHHHjHHHHhh',
  'qhhHHHHHHhhq',
  '.qhhhhhhhhq',
  '..qqhhhqq',
  '....qqq',
]

const MASK = [
  'eEEEEFF',
  'eEEEEFFF',
  'rRRRRRRQ',
  'rRRRRRRRQ',
  '.rRRRRRRR',
  '..rRRRRR',
  '....rRR',
]

const BODY = bell({ d: 'o', m: 'O', l: 'g', t: 'u' })

const POLE = [
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
  'aA',
]

const SHEAF = [
  '.AbAbAbA',
  'aAbAbAbAb',
  'aAAbAbAbA',
  'uuuuuuuuu',
  '.aAbAbAbA',
  '.aAAbAbA',
  '..aAbAb',
]

const FLAME = [
  '.....H',
  '....HH',
  '...HHH..H',
  '...HyH.HH',
  '..HyyHHHyH',
  '..HyyyHHyH',
  '.HHywyyyyH',
  '.HyywwyyyH',
  'HHyywwyyyH',
  'HyyywwyyyHH',
  'HyyyywyyyyH',
  'HHyyyyyyyHH',
  '.HHyyyyyHH',
  '..HHHHHHH',
]

const FLAME2 = [
  '....H',
  '...HH...H',
  '...HyH.HH',
  '..HHyHHyH',
  '..HyyyHyyH',
  '.HHyyyyyyH',
  '.HyywwyyyH',
  '.HyywwyyyHH',
  'HHyywwyyyH',
  'HyyywwyyyHH',
  'HyyyywyyyyH',
  'HHyyyyyyyHH',
  '.HHyyyyyHH',
  '..HHHHHHH',
]

const FLAME_BIG = [
  '......H',
  '.....HH....H',
  '..H..HyH..HH',
  '..HH.HyyH.HyH',
  '.HyHHHyyHHHyyH',
  '.HyyHyyyyHyyyH',
  'HHyyyyywyyyyH',
  'HyyyywwwyyyyHH',
  'HyyyywwwwyyyyH',
  'HHyyyywwyyyyyH',
  'HyyyyywwyyyyHH',
  'HHyyyyywyyyyH',
  '.HyyyyyyyyyHH',
  '.HHyyyyyyyHH',
  '..HHHHHHHHH',
]

const EMBERS = [
  '..y......H',
  'H.........y',
  '.....y',
]

export const D03: Design = {
  id: 'd03',
  title: 'Field Burner',
  concept: 'Burns off the pepper stubble each summer: a scorched kettle hat, a kerchief against the smoke, a burning straw sheaf on a pole.',
  pal: PAL,
  headBottom: 53,
  parts: [
    { id: 'shadow', group: 'feet', x: 31, y: 68, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 41, y: 65, rows: FEET, ring: 0 },
    { id: 'pole', group: 'prop', x: 70, y: 30, rows: POLE },
    { id: 'sheaf', group: 'prop', x: 66, y: 26, rows: SHEAF },
    { id: 'flame', group: 'fx', x: 65, y: 12, rows: FLAME },
    { id: 'flameBig', group: 'fx', x: 64, y: 10, rows: FLAME_BIG, hidden: true },
    { id: 'embers', group: 'fx', x: 63, y: 6, rows: EMBERS, ring: 0, hidden: true },
    { id: 'body', group: 'body', x: 35, y: 52, rows: BODY },
    { id: 'hairB', group: 'head', x: 23, y: 51, rows: HAIRB },
    { id: 'mask', group: 'head', x: 60, y: 51, rows: MASK },
    { id: 'hat', group: 'head', x: 19, y: 22, rows: HAT, squash: [6, 10] },
    { id: 'handB', group: 'hands', x: 30, y: 58, rows: FIST_L },
    { id: 'handF', group: 'hands', x: 68, y: 56, rows: FIST_R },
  ],
  idle: [
    {},
    { squash: 1, swap: { flame: FLAME2 } },
    { squash: 2, move: { hands: [0, 1] }, swap: { flame: FLAME2 } },
    { squash: 2, move: { hands: [0, 1] } },
    { squash: 1 },
    { swap: { flame: FLAME2 } },
  ],
  idleMs: [170, 120, 140, 170, 120, 150],
  // a swing of the sheaf: it flares, spits embers, burns down again
  tic: [
    { move: { prop: [0, 1], fx: [0, 1], hands: [0, 1] }, squash: 1 },
    { move: { prop: [0, -1], fx: [0, -1], hands: [0, -1] }, hide: ['flame'], show: ['flameBig'] },
    { hide: ['flame'], show: ['flameBig', 'embers'] },
    { hide: ['flame'], show: ['flameBig', 'embers'], nudge: { embers: [0, -2] }, swap: { flame: FLAME2 } },
    { swap: { flame: FLAME2 }, show: ['embers'], nudge: { embers: [1, -4] } },
    {},
  ],
  ticMs: [120, 100, 160, 200, 160, 180],
}
