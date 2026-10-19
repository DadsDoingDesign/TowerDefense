/**
 * Hask design 06 — the Reed Smuggler. Hand-authored pixel maps (see hask-lib.ts).
 *
 * Runs untaxed salt through the reed channels by night: a deep woven reed
 * basket hat over his whole head, one eye glinting through its viewing slit,
 * his snout out under the rim; his own body: a low-slung cloak of hanging
 * reed over a hunched back, with hidden pockets; a shuttered lantern held
 * low at his side. Silhouette: a tall basket over a hump of reed. Tic: he
 * shutters the lantern, the eye in the slit glances back, the light comes on.
 */
import type { Design } from './hask-lib'
import { PAL, FEET, SHADOW_W, SNOUT, TAIL, TAIL_UP } from './hask-common'

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

/** The low-slung reed cloak over his hunched back: layers of hanging reed, two hidden pockets, a fringe at the ground. */
const CLOAK = [
  '.........TTTTTTT',
  '......TTTTuuuTTTTTT',
  '....TTTuuTTTTTUTTHHHh',
  '...TTHTTTTTTTTUTHHHHHHh',
  '..TTUuTTTTTTTTTHHHHHHHHHh',
  '.TTTuTTTTTTTTHHHHHHHHHHHHHh',
  '.THTUUTTTTTTHHHHHHHHHHHHHHHHh',
  'UUTUTUTTTTHHHHHHHHHHHHHHHHHhHhh',
  'UhUUTUUUTTTHHTTHHHHHHHHTTHhhTHhh',
  'TTTThhTThTThhTTHTTHHTTHTThhTThTTh',
  'TTTHhhHHhHHhhHHhTThhTThHHhhHHhHhhh',
  'HHHTHHHHHHHHHHHhHHhhHHhHHHhHHHHhhhh',
  'HHHTHHHHHHHHHHHHHHHHHHHHHHHHHhThhhh',
  'HHHTHHHHHHHHHHHHHHHHHHHHHhHHHhThhhh',
  'HHHHHHHHHHHHHHHHHHHHHHHHHhHHHHThhhh',
  'TTUTHHHHHmmHHHhHHHhHHHHHHhHHHHThhhh',
  'TTUTHHTTLmLlHThHHHhHHHHTTHHTTTUhhhT',
  'HHHHhhhUhUhUhUhhTThHTTTTThhTTTUhhhh',
  '.HHHhhhHHhHhhHhTTThhTTTHHhhHHHThhhh',
  '.HHHHHhHHHHHHHhhHHhhHHHHHHHHHHThhHh',
  '.HHHHHhHHHHHHHhHHHHHHHHHHHHHHHThhHh',
  '.HHHHHhHHHHHHHhHHHHHHHHHHHHHHHThhHh',
  '.HHHHHhHHHHHHHhHHhHHHHHHHHHHHHThhhh',
  '.hHTHHhhhhhhhhhHHhTHHHHHHHHHHHThhhh',
  '.ThTHHTHTHTHHTHHHhTHHHHHTHHTHTThhhT',
  '.HhHhhThThThhThTHThUhUhUhUhThThhhhh',
  '.HHHhhHhHhHhhhhThThhThThHhhThHhhhhh',
  '..HHHHHHHHHHHhHHhHhhHhHHHHHTHHThhhhh',
  '..HHHHHHHHHHHHHHHhhHHHHHHHHTHHThhhhh',
  '..HHHHHHHHHHHHHHHhhHHHHHHHHTHHThhhhh',
  '..HHHHHTHHHHHhHHHhHHHHHHHHHHHHThhhhh',
  '..THhHHTHHHHHhHHHhHHHHHHHHHHHHThHhhh',
  '..hhhHHHThHHHhHHHHHHHHHHHHHHHTThHhhh',
  '...hhhhhThhhhhhTHHHHHHThhhhhhThhhhhhh',
  '...HhhhhHhhhHhhThhhhhhThhhhhhhhhhhhhh',
  '...HHHHHHHHHTHHHhhhHhhHHHHHHHhThHhhhh',
  '...HHHHHHHHHTHHHHHHTHHHHHHHHHhThHHhhh',
  '...HHHHHHHHHHHHHHHHHHHHHHHHhHhThHHhhh',
  '..hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
  '...H.HH.HH.HH.HH.HH.HH.HH.HH.HH.HH.HH',
]

/** His near arm, scaled, out of the cloak's front, one piece to the fist that holds the lantern (the far arm stays hidden). */
const ARM = [
  'gGG',
  'gGvG',
  '.gGvVv',
  '.gGvVVv',
  '.gGGvvV',
  '.zgGGGg',
  '..zggg',
]

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
  concept: 'Runs untaxed salt through the reed channels by night: a deep woven basket hat over his whole head, one eye glinting through its slit, a low-slung reed cloak over a hunched back, hidden pockets, a shuttered lantern held low.',
  pal: PAL,
  headBottom: 48,
  parts: [
    { id: 'shadow', group: 'feet', x: 18, y: 69, rows: SHADOW_W, ring: 0 },
    { id: 'tail', group: 'back', x: 6, y: 58, rows: TAIL },
    { id: 'feet', group: 'feet', x: 40, y: 66, rows: FEET, ring: 0 },
    { id: 'cloak', group: 'body', x: 26, y: 27, rows: CLOAK },
    { id: 'basket', group: 'head', x: 36, y: 12, rows: BASKET, squash: [7, 12, 18] },
    { id: 'snout', group: 'head', x: 54, y: 36, rows: SNOUT },
    { id: 'eye', group: 'head', x: 62, y: 27, rows: EYE, ring: 0 },
    { id: 'lantern', group: 'prop', x: 63, y: 59, rows: LANTERN },
    { id: 'lanternShut', group: 'prop', x: 63, y: 59, rows: LANTERN_SHUT, hidden: true },
    { id: 'arm', group: 'hands', x: 59, y: 52, rows: ARM },
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
