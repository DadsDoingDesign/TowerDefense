/**
 * Hask design 04 — the Block Butcher. Hand-authored pixel maps (see hask-lib.ts).
 *
 * Breaks the carcasses at the Butcherblock hall: a big floppy linen cap
 * gathered into a brine-red band, its puff slumped down the back of his
 * head; a heavy leather apron, stained; a cleaver hanging from his fist,
 * blade down, low at his side. Silhouette: a round slumped puff over a
 * snout. Tic: he flips the cleaver up flat and catches it, the edge glints.
 */
import type { Design } from './hask-lib'
import { PAL, FEET, SHADOW_W, FIST_B, FIST_F, SNOUT, TAIL, TAIL_UP, bell } from './hask-common'

const CAP = [
  '............LLLLLLLLLLLLL',
  '.........LLLLLLLLmmLLLLLLLLLL',
  '.......LLLLLmmmLLLLLLLLLLLLLLLL',
  '.....LLLLLmmLLLLLLLLLLLLLLLLLLLLb',
  '....LLLLLmLLLLLLLLLLbLLLLLLLLLLLLb',
  '...LLLLLmLLLLLLLLLLLLbLLLLLLLLLLLbb',
  '..LLLbLLLLLLLLLLLLLLLLbLLLLLLLLLLbbl',
  '.LLLLbLLLLLLLLLLLLLLLLbLLLLLLLLLLbbb',
  '.LLLbLLLLLLLLLLLLLLLLLLbLLLLLLLLLbbbl',
  'LLLLbLLLLLLLLLLLLLLLLLLLbLLLLLLLLbbbl',
  'LLLLbLLLLLLLLLLLLLLLLLLLLLLLLLLLbbbbl',
  'LLLbLLLLLLLLLLLLLLLLLLLLLLLLLLLLbbbbl',
  'LLLbLLLLLLLLLbLLLLbLLLLbLLLLLLLbbbbbl',
  'LLLLLLLLbLLLLbLLLLbLLLLbLLLbLLbbbbbll',
  'LLLLLLLLbLLLLbLLLLbLLLLbLLLbLLbbbbbl',
  'LLLLLLLLLbLLLLbLLLbLLLbLLLLbLbbbbbll',
  'LLLLLLLLLbLLLLbLLLbLLLbLLLbLbbbbbll',
  'bblbbbbbbblbbblbbblbbblbbblbbbbbbl',
  'bbblbbbbbblbbblbbblbbblbbbllllllll',
  'lllllllllllllllllllllllllllllllll',
  'LLLLbLLLLbbblQQQQRRRRRRRRRpppppp',
  'LLLLLbLLLbbblRRRRRRRRRRRRRpppppp',
  'LLLLLLbLbbbblpppppppppppppppppp',
  '.LLLLLbbbbbbl',
  '.bLLLLblbbbbl',
  '..bbbbbblbbll',
  '..llllllllll',
  '...llllllll',
  '.....lllll',
]

const EYE = ['yw']

const BODY = bell({ d: 'r', m: 'R', l: 'Q', t: 'r' })

/** The heavy leather apron: a bib, a stitched pocket, old brine stains. */
const APRON = [
  '....aAAAAAAj',
  '...aAAAAAAAAj',
  '...aAAApAAAAj',
  '..aaAAAAAAAAAj',
  '..aAAhhhhhhAAj',
  '.aaAAhjIjIhAAAj',
  '.aaAAhAAAAhAApAj',
  'aaAAAhhhhhhApRAj',
  'aaAAAAAAAAAAApAAj',
  'aaIaaIaaIaaIaaIaj',
  '.aaaaaaaaaaaaaaa',
]

/** The cleaver, hanging blade-down: a worn grip, a broad blade with a hang hole and a bright edge. */
const CLEAVER = [
  '..hA',
  '..hA',
  '..hA',
  '.nnnnnn',
  'xxxxxxxxn',
  'xNNNNNNNn',
  'xNkNNNNNn',
  'xNNNNNNNn',
  'xNNNNNNNn',
  'xNNNNNNnn',
  'xNNNNNNnn',
  'xNNNNNnnn',
  'wwxxxxxxN',
]
/** The cleaver flipped up flat, edge down, catching the light. */
const CLEAVER_UP = [
  '.......nxxxxxxxxxx',
  'hAAAhnnxNNNNNNkNNx',
  'hAAAhnnxNNNNNNNNNx',
  '......nxNNNNNNNNNw',
  '......nxNNNNNNNNNw',
  '......nnnnnnnnnnww',
]

export const D04: Design = {
  id: 'd04',
  title: 'Block Butcher',
  concept: 'Breaks the carcasses at the Butcherblock hall: a floppy linen cap slumped down his head, gathered in a brine-red band; a stained leather apron; a cleaver hung blade-down at his side.',
  pal: PAL,
  headBottom: 58,
  parts: [
    { id: 'shadow', group: 'feet', x: 22, y: 72, rows: SHADOW_W, ring: 0 },
    { id: 'tail', group: 'back', x: 13, y: 57, rows: TAIL },
    { id: 'feet', group: 'feet', x: 41, y: 69, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 35, y: 56, rows: BODY },
    { id: 'apron', group: 'body', x: 46, y: 57, rows: APRON, ring: 1 },
    { id: 'snout', group: 'head', x: 50, y: 47, rows: SNOUT },
    { id: 'cap', group: 'head', x: 27, y: 24, rows: CAP, squash: [8, 14] },
    { id: 'eye', group: 'head', x: 65, y: 48, rows: EYE, ring: 0 },
    { id: 'handB', group: 'hands', x: 31, y: 60, rows: FIST_B },
    { id: 'cleaver', group: 'prop', x: 63, y: 63, rows: CLEAVER },
    { id: 'cleaverUp', group: 'prop', x: 62, y: 63, rows: CLEAVER_UP, hidden: true },
    { id: 'handF', group: 'hands', x: 64, y: 60, rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1 },
    { squash: 2, nudge: { snout: [0, 1], eye: [0, 1] }, move: { hands: [0, 1] } },
    { squash: 2, nudge: { snout: [0, 1], eye: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, move: { prop: [0, 1] } },
    {},
  ],
  idleMs: [200, 140, 170, 200, 150, 180],
  tic: [
    { move: { hands: [0, 1], prop: [0, 1] }, squash: 1 },
    { move: { hands: [0, -1] }, hide: ['cleaver'], show: ['cleaverUp'] },
    { move: { hands: [0, -1], prop: [0, -1] }, hide: ['cleaver'], show: ['cleaverUp'], swap: { tail: TAIL_UP } },
    { hide: ['cleaver'], show: ['cleaverUp'], swap: { tail: TAIL_UP } },
    { move: { hands: [0, 1], prop: [0, 1] }, squash: 1 },
    {},
  ],
  ticMs: [140, 120, 320, 220, 140, 200],
}
