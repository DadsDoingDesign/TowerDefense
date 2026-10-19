/**
 * Wren design 03 — the Vial Peddler. Hand-placed pixel maps (see wren-lib.ts).
 *
 * The oldest woman in the hollows sells doses door to door, a tray of three
 * vials before her. A long knitted lichen-grey cap slumps over backward under its own
 * weight, a glowing spore puffball for a bobble; grey braids. Silhouette: a dome
 * with a tail falling back to a ball. Tic: she holds the tray out a little, the
 * middle vial lights and a bubble rises out of it.
 */
import type { Design } from './wren-lib'
import { PAL, SHADOW, FEET, FIST_L, FIST_R } from './wren-common'

const CAP = [
  '................uuuqqquuuqqq',
  '...............uuuuqqqquuuqqq',
  '...........uuqquuuuqqqqQuqqqqq',
  '.........uquuuQqQuqqQqQQQqQqQqQ',
  '........uquuuqqQqQqqqQqQQqqkkkkk',
  '........uuuuqqqqqQqqqqQQkkkkqqqqqqqq',
  '.......uuuuqqqqqQQQqqqkkkuuuuuqqqqqqqqq',
  '......uquqqQqQqqQQQQkkkququuuquQqqqQqQqqQ',
  '....uuquuqqqQqqQQQQkkuuuquuuuuquqqqqQqqqqQQ',
  '....uuuuqqqqQqQQQQkkuuQQuuuuuuuuqqqqqqqqqQQQ',
  '...uuuuqqqqQQQQQQkkuuuuQQuuuuuuuqqqqqqqqqqQQQ',
  '...qQqqqQqQQQQQQkkuuququQuququuuQqQqqqQqQqQQQQ',
  '...QuuqqqQQQQQQkkuuuuquuuuuqwwuqqQqqqqqQqqQQQQQ',
  '..uuuuqqqQQQQQQ.uuuuuuuuuuwuuuuqqqqqqqqqqqQQQQQQ',
  '.uuuuqqqqQQQQ...uuuuuuuuuuuuuuuqqqqqqqqqqqQQQQQQ',
  '.quuqQqQQQQQQ..uuququuuququuuqqQqqqQqQqqqQQQQQQQQ',
  '.qqqqqQqQQQ....uuuquuuuuquuuuqQqqqqqQqqqqQQQQQQQQ',
  '.qqqqqqQQQ....quuuuuuuuuuuuuuqqqqqqqqqqqqQQQQQQQQQ',
  '.quuqqQQQQ....uuuuuuuuuuuuuuqqqqqqqqqqqqQQQQQQQQQQ',
  '.uquQqqQQQ...qququuuququuuqqQqqqQqQqqqQqQQQQQQQQQQQ',
  'uuuQqqQQQ....ququuuuuquuuuqQqqqqqQqqqqqQQQQQQQQQQQQ',
  'quqqqqQQ.....quuuuuuuuuuqqqqqqqqqqqqqqqQQQQQQQQQQQQ',
  'qquqqQQQ.....qquuuuuuuuqqqqqqqqqqqqqqqQQQQQQQQQQQQQ',
  'qquuqQQQ....qQqququqqqqQqQqqqQqQqqqQqQQQQQQQQQQQQQQQ',
  'quuqqqQ.....QqqqqqQqqqqqQqqqqqQqqqqqQQQQQQQQQQQQQQQQ',
  'qqqqqQQ.....qqqqqqqqqqqqqqqqqqqqqqqqQQQQQQQQQQQQQQQQ',
  'qqqqQQQ.....qqqqqqqqqvWWvWWvWWvWWvWWvVVvVVvQQQQQQQQQ',
  'qqqQQQQ.....qqqqWWvWivWWvWWvWWvWWvWWvVVvVVvVVvVVQQQQ',
  '.QQQQQ......qWWvWivWWvWWvWWvWWvWWvVVvVVvVVvVVvVVvvvQ',
  '..QQQ......vvWWvWWvWWvWWvWWvWVvVVvVVvVVvVVvVVvvvvvvvv',
  '...........VvWWvWWvWWvWWvVVvVVvVVvVVvVVvVVvvvvvvvvvvv',
  '...........VvVVvVVvVVvVVvVVvVVvVVvVVvVVvvvvvvvvvvvvvv',
  '...........VvVVvVVvVVvVVvVVvVVvVVvVVvvvvvvvvvvvvvvvvv',
  '.............VVvVVvVVvVVvVVvVVvVVvvvvvvvvvvvvvvvvvv',
  '................VVvVVvVVvVVvVVvvvvvvvvvvvvvvvvvv',
  '.....................vvvvvvvvvvvvvvvvvvvvvv',
]

const BOBBLE = [
  '...zzPP',
  '.zzwzPPP',
  '.zwzPPPOP',
  'zzPPzPPPO',
  'zPPPPPPOO',
  'PPzPPPOOO',
  '.PPPPOOo',
  '..POOOo',
  '...OOo',
]

const BRAID_B = [
  'XIX',
  'XIIX',
  'XIXX',
  '.XIX',
  '.ooo',
  '.OPO',
]

const BRAID_F = [
  'IIX',
  'XIIX',
  'XIXX',
  'XIX',
  'ooo',
  'OPO',
]

const NOSE = [
  '..mmNN..',
  '.mwmNNN.',
  'mmmNNNNn',
  'mNNNNNNn',
  'NNNNNNnn',
  '.NNNNnn.',
  '..nnnn..',
]

const BODY = [
  '......ccAAAAAAAAbbb',
  '.....ccAAAAAAAAAAbb',
  '....cccAAAAAAAAAAbbb',
  '...cccAAAAcAAAAAAAbb',
  '...cccAAAAcAAAAAAAbbb',
  '..aaaaPaaaaaaaaaaaaaa',
  '..cccAAAAAcAAAAAcAAbbb',
  '.ccccAAAAAcAAAAAcAAAbb',
  'cPPPPPPPPPPPPPPPPPPPPc',
  'cccccccccccccccccccccc',
  '..cccccccccccccccccc',
]

const RACK = [
  '.dD....dD....dD',
  '.uU....tT....aA',
  'uwJu..tTPt..aAbA',
  'uJJu..tPPt..ABbA',
  'uJiu..tPyt..AbBA',
  'ujJu..tyyt..aAAa',
  'hHHHHHHHHHHHHHHHh',
  'DhhhhhhhhhhhhhhhD',
  'ddDDDDDDDDDDDDDdd',
]

const GLOW = [
  '.....z',
  '....zPz',
  '.....z',
]

export const D03: Design = {
  id: 'd03',
  title: 'Vial Peddler',
  concept: 'Sells doses door to door: a long grey-green stocking cap slumped over backward with a spore-puff bobble, grey braids, a tray of three vials held low.',
  pal: PAL,
  headBottom: 62,
  parts: [
    { id: 'shadow', group: 'feet', x: 34, y: 73, rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 72, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 39, y: 62, rows: BODY },
    { id: 'handB', group: 'hands', x: 35, y: 65, rows: FIST_L },
    { id: 'cap', group: 'head', x: 18, y: 24, rows: CAP, squash: [18, 20, 23] },
    { id: 'bobble', group: 'head', x: 16, y: 51, rows: BOBBLE },
    { id: 'braidB', group: 'head', x: 33, y: 59, rows: BRAID_B, ring: 1 },
    { id: 'braidF', group: 'head', x: 64, y: 59, rows: BRAID_F, ring: 1 },
    { id: 'nose', group: 'head', x: 54, y: 56, rows: NOSE },
    { id: 'rack', group: 'prop', x: 62, y: 68, rows: RACK },
    { id: 'handF', group: 'hands', x: 76, y: 72, rows: FIST_R },
    { id: 'glow', group: 'fx', x: 67, y: 63, rows: GLOW, ring: 0, hidden: true },
  ],
  idle: [
    {},
    { squash: 1 },
    { squash: 2, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 3, move: { hands: [0, 1], prop: [0, 1] }, nudge: { bobble: [0, 2] } },
    { squash: 2, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1 },
  ],
  idleMs: [220, 120, 110, 280, 140, 170],
  // she holds the tray out a little, the middle vial lights up and a bubble rises out of it, then she lowers it
  tic: [
    { move: { prop: [1, 0], hands: [1, 0] } },
    { move: { prop: [1, 0], hands: [1, 0] }, show: ['glow'] },
    { move: { prop: [1, 0], hands: [1, 0] }, show: ['glow'], nudge: { glow: [1, -2] } },
    { show: ['glow'], nudge: { glow: [0, -4] } },
    {},
  ],
  ticMs: [150, 200, 200, 200, 200],
}
