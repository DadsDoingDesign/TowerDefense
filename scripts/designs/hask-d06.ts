/**
 * Hask design 06 — the Reed Smuggler. Hand-authored pixel maps (see hask-lib.ts).
 *
 * Runs untaxed salt through the reed channels by night: a deep woven reed
 * basket hat over his whole head, one eye glinting through its viewing slit,
 * his snout out under the rim; a dusk-plum cloak; a shuttered lantern held
 * low at his side. Silhouette: a tall round basket over a snout. Tic: he
 * shutters the lantern, the eye in the slit glances back, the light comes on.
 */
import type { Design } from './hask-lib'
import { PAL, FEET, SHADOW_W, FIST_B, FIST_F, SNOUT, TAIL, TAIL_UP, bell } from './hask-common'

const BASKET = [
  '..........ooHoooHooo',
  '.......HoooOuOoHoooHooH',
  '.....oHoouOoooHoooHooohHh',
  '....oHoOOHoOoHoooHoooHHHHh',
  '...oHoooHoooHoooHoooHoHHhHh',
  '..oHoOoHoOoHoOoHoooHooHhHHhh',
  '..HoooHoooHoooHoooHooohHHHhh',
  '.HoOoHoOoHoOoHoooHoooHHHHhHhh',
  '.oooHoooHoooHoooHoooHoHHhHHhh',
  '.OoHoOoHoOoHoOoHoooHooHhHHHhh',
  '.oHoooHoooHoooHoooHooohHHHhhh',
  '.HoOoHoOoHoOoHoooHoooHoHHhHhh',
  '.oooHoooHoooHoooHoooHooHhHHhh',
  '.OoHoOoHoOoHoOoHoooHooohHHHhh',
  '.oHoooHoooHoooHoookkkkkkkkkkk',
  '.HoOoHoOoHoOoHoooHkkkkkkkkkkk',
  '.oooHoooHoooHoooHoooHooohHHHh',
  'oOoHoOoHoOoHoOoHoooHoooHHHHhhh',
  'ooHoooHoooHoooHoooHoooHoHHhHhh',
  'oHoOoHoOoHoOoHoooHoooHooHhHHhh',
  'HoooHoooHoooHoooHoooHooHhHHHhh',
  'oOOuOOOOOOOOOOOoooooooooHHHHhhh',
  'HoHoHoHoHoHoHoHoHoHoHoHHhHhHhhh',
  '.hhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
  '..hhhhhhhhhhhhhhhhhhhhhhhhhhh',
]

/** The glint in the slit (the eye), and where it looks back to. */
const EYE = ['yw']

/** A short cloak cape over his shoulders under the basket. */
const CAPE = [
  '....3333333322222221',
  '..333333332222222222211',
  '.33333332222222222222211',
  '3333332222222222222222211',
  '3333222222222222222222211',
  '2332222222222222222222111',
  '1222222222222222222221111',
  '.11111111111111111111111',
  '..1.111.1111.11111.11.1',
]

const BODY = bell({ d: '1', m: '2', l: '3', t: '1' })

/** The shuttered lantern: an iron bail and cap, the glowing pane, a base. */
const LANTERN = [
  '...NN',
  '..N..N',
  '..N..N',
  '.nnnnnn',
  'nNNNNNNn',
  'nxkkkkNn',
  'n9yy9kNn',
  'n9yw9kNn',
  'n0999kNn',
  'n0F00kNn',
  'nnnnnnnn',
  '.nNNNNn',
]
const LANTERN_SHUT = [
  '...NN',
  '..N..N',
  '..N..N',
  '.nnnnnn',
  'nNNNNNNn',
  'nxNNNNNn',
  'nxnnnnNn',
  'nxNNNNNn',
  'nxnnnnNn',
  'nxNNNNNn',
  'nnnnnnnn',
  '.nNNNNn',
]

export const D06: Design = {
  id: 'd06',
  title: 'Reed Smuggler',
  concept: 'Runs untaxed salt through the reed channels by night: a deep woven basket hat over his whole head, one eye glinting through its slit, a dusk-plum cloak, a shuttered lantern held low.',
  pal: PAL,
  headBottom: 58,
  parts: [
    { id: 'shadow', group: 'feet', x: 22, y: 72, rows: SHADOW_W, ring: 0 },
    { id: 'tail', group: 'back', x: 13, y: 57, rows: TAIL },
    { id: 'feet', group: 'feet', x: 41, y: 69, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 35, y: 56, rows: BODY },
    { id: 'cape', group: 'body', x: 33, y: 50, rows: CAPE },
    { id: 'basket', group: 'head', x: 33, y: 24, rows: BASKET, squash: [7, 12, 18] },
    { id: 'snout', group: 'head', x: 51, y: 48, rows: SNOUT },
    { id: 'eye', group: 'head', x: 59, y: 39, rows: EYE, ring: 0 },
    { id: 'handB', group: 'hands', x: 30, y: 61, rows: FIST_B },
    { id: 'lantern', group: 'prop', x: 64, y: 64, rows: LANTERN },
    { id: 'lanternShut', group: 'prop', x: 64, y: 64, rows: LANTERN_SHUT, hidden: true },
    { id: 'handF', group: 'hands', x: 65, y: 62, rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1 },
    { squash: 2, nudge: { snout: [0, 1], eye: [0, 1] }, move: { hands: [0, 1] } },
    { squash: 2, nudge: { snout: [0, 1], eye: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, move: { prop: [0, 1] } },
    {},
  ],
  idleMs: [240, 160, 200, 240, 160, 220],
  tic: [
    { hide: ['lantern'], show: ['lanternShut'] },
    { hide: ['lantern'], show: ['lanternShut'], nudge: { eye: [-3, 0] } },
    { hide: ['lantern'], show: ['lanternShut'], nudge: { eye: [-6, 0] }, swap: { tail: TAIL_UP } },
    { hide: ['lantern'], show: ['lanternShut'], nudge: { eye: [-3, 0] }, swap: { tail: TAIL_UP } },
    { hide: ['lantern'], show: ['lanternShut'] },
    {},
  ],
  ticMs: [260, 200, 360, 200, 260, 220],
}
