/**
 * Saffra design 04 — the Dockside Broker. Hand-authored pixel maps (see saffra-lib.ts).
 *
 * On the Pepperport quays she buys whole cargoes before they're unloaded: a
 * big panelled gold flat cap pulled low with a quill stuck behind it, a
 * ginger bob, an oxblood coat, and the open ledger where every sack is
 * already sold. Silhouette: a puffed cap leaning forward with a peak, the
 * quill flicking up behind. Tic: she turns the ledger out to you and taps the
 * figure — that's the number.
 */
import type { Design } from './saffra-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, bell } from './saffra-common'

const CAP = [
  '........................oOggguugggOo',
  '..................oOOggggggoggggoggOOOOOo',
  '..............ooOOgggggggogggggwwBoggOOOOOoo',
  '...........ooOOOggggggoOgggggggggwwBoOOOOOOOoo',
  '.........ooOOOOgggggoOgggggggggggggBBBoOOOOOOooo',
  '.......ooOOOOOggggoOggggggggggggggggBBggoOOOOOooo',
  '......ooOOOOOgggoOgggggggggggggggggggggggoOOOOOooo',
  '.....ooOOOOOggoOggggggggggggggggggggggggggoOOOOOooo',
  '....oooOOOOOgoOggggggggggggggggggggggggggggoOOOOooo',
  '...oooOOOOOOoOOgggggggggggggggggggggggggggggoOOOOooo',
  '...oooOOOOOOoOOggggggggggggggggggggggggggggOoOOOOooo',
  '...oooOOOOOoOOOOOOOggggggggggggggggggggggOOoOOOooo',
  '..oooooOOOoOOOOOOOOOOOgggggggggggggggOOOOOOOOOoOOooo',
  '..oooooOOOoOOOOOOOOOOOOOOggggggggggOOOOOOOOOOOoOOooo',
  '..oooooOOOoOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOoOooo',
  '..oooooOOOoOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOoOooo',
  '...ooooooooooooooooooooooooooooooooooooooooooooOOooo',
  '....ooooooOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOooooo',
  '.....uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu',
]

const PEAK = [
  '......oOOOggggg',
  '...ooOOOOOOOggggg',
  '.ooOOOOOOOOOOOOOgg',
  'ooooooooooooooooooO',
]

const HAIR = [
  '......hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
  '.....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
  '.....hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
  '....qhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
  '....qhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
  '....qhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
  '....qhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
  '....qhhHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
  '....qhhHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
  '....qhhHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
  '....qhhHHHhHHHHHHhHHHHHHhHHHHHhHHHHHHhHHHHHhHHHHHH',
  '....qhhHHhHHHjHHHhHHHHHhHHHHHHhHHHHHHhHHHHhHHHHHH',
  '...qqhhHHhHHHjHHHhHHHHHhHHHHHhHHHHHHhHHHHHhHHHHH',
  '..qhqhhhHhHHHHHHhHHHHHHhHHHHHhHHHHHHHhHHHHhHHHHH',
  '.qhhqhhhHhHHHHHhHHHHHHhHHHHHhHHHHHHHhHHHHhHHHHH',
  '.qhhqhhhhhHHHHHhHHHHHHhHHHHHhHHHHHHhHHHHHhHHHHH',
  'qqhhqqhhhhHHHHhHHHHHHhhHHHHhhHHHHHHhhHHHhhHHHHh',
  'qhhhqqhhhhhHHhHHHHHHhhhhHHhhhhHHHHhhhhHhhhHHHhh',
  'qhhhqqqhhhhhhhhhhhhhhqqqqqqqqqqqqqqqqqqqhhhhhhh',
  'qqhhqqqhhhhhhhhhhhq.....................qhhhhhhhq',
  '.qqq.qqhhhhhhhhhq.......................qhhhhhhq',
  '..qq..qqhhhhhhhq.........................qhhhhq',
  '...q...qqhhhhqq............................qqqq',
  '.........qqqq',
]

const FACE = [
  '.eEEF',
  'eEEEFF',
  'eEEEEFF',
  'eEEEFF',
  '.eeEE',
]

const QUILL = [
  'mm',
  'mLL',
  '.mLL',
  '..mLL',
  '...mLL',
  '....mLL',
  '.....mLL',
  '......mLL',
  '.......mL',
  '........l',
]

const BOOK = [
  'rRRRRRRRrRRRRRRRQ',
  'rmmmmmmmlLmmmmmmR',
  'rmlllllmlLmllllmR',
  'rmmmmmmmlLmmmmmmR',
  'rmllllmmlLmlllmmR',
  'rmmmmmmmlLmmmmmmR',
  'rmlllllmlLmllllmR',
  'rmmmmmmmlLmmmmmmR',
  'rrrrrrrrrRRRRRRRR',
]

const BOOK_UP = [
  'rRRRRRRRrRRRRRRRQ',
  'rmmmmmmmlLmmmmmmR',
  'rmlllllmlLmllllmR',
  'rmmmmmmmlLmmmmmmR',
  'rmllllmmlLmlkkmmR',
  'rmmmmmmmlLmmkkmmR',
  'rmlllllmlLmllllmR',
  'rmmmmmmmlLmmmmmmR',
  'rrrrrrrrrRRRRRRRR',
]

const BODY = bell({ d: 'x', m: 'X', l: 'R', t: 'o' })

export const D04: Design = {
  id: 'd04',
  title: 'Dockside Broker',
  concept: 'Buys whole cargoes on the Pepperport quays: a panelled flat cap with a quill behind it, an oxblood coat, the ledger where it is already sold.',
  pal: PAL,
  headBottom: 58,
  parts: [
    { id: 'shadow', group: 'feet', x: 27, y: 70, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 37, y: 67, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 31, y: 54, rows: BODY },
    { id: 'quill', group: 'head', x: 13, y: 26, rows: QUILL },
    { id: 'hair', group: 'head', x: 15, y: 33, rows: HAIR, squash: [3, 5] },
    { id: 'face', group: 'head', x: 63, y: 43, rows: FACE },
    { id: 'cap', group: 'head', x: 19, y: 23, rows: CAP, squash: [8, 12] },
    { id: 'peak', group: 'head', x: 59, y: 39, rows: PEAK },
    { id: 'handB', group: 'hands', x: 28, y: 58, rows: FIST_L },
    { id: 'book', group: 'prop', x: 51, y: 53, rows: BOOK },
    { id: 'handF', group: 'hands', x: 66, y: 57, rows: FIST_R },
  ],
  idle: [{}, { squash: 1 }, { squash: 2, move: { hands: [0, 1], prop: [0, 1] } }, { squash: 2, move: { hands: [0, 1], prop: [0, 1] } }, { squash: 1 }, {}],
  idleMs: [190, 130, 150, 190, 130, 170],
  // the ledger comes up and turns to you, the figure ringed in ink; a nod; back down
  tic: [
    { move: { prop: [0, -2], hands: [0, -2] } },
    { move: { prop: [1, -4], hands: [1, -4] }, swap: { book: BOOK_UP } },
    { move: { prop: [1, -4], hands: [1, -4] }, swap: { book: BOOK_UP }, squash: 2 },
    { move: { prop: [1, -4], hands: [1, -4] }, swap: { book: BOOK_UP } },
    { move: { prop: [0, -2], hands: [0, -2] } },
    {},
  ],
  ticMs: [100, 120, 220, 380, 110, 160],
}
