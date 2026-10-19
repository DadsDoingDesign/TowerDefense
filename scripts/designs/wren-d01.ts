/**
 * Wren design 01 — the Toadstool Forager. Hand-placed pixel maps (see wren-lib.ts).
 *
 * She walks the mushroom hollows under Greenvial's glasshouses picking what
 * glows. A jade toadstool for a hat, its rim rolled under, spores lit on it.
 * Silhouette: a round dome on two nubs. Tic: she shakes the basket and the cap puffs spores.
 */
import type { Design } from './wren-lib'
import { PAL, SHADOW, FEET, FIST_L, FIST_R } from './wren-common'

const CAP = [
  '....................jjjjjjjjjj',
  '.................jjjjjjjjjjjjjjjj',
  '...............JJJJJJjjjjjjjjjjjjgg',
  '.............JJJJJJJJJjjjjjjjjjjjjggg',
  '............JJJJwwJJJJJjjzPPjjjjjjjggg',
  '..........iiiiwJJJJJJJJjzPPPOjjjjjjggggg',
  '.........JJJJJJJJJJJJJJjPPPPOjjjjjjgggggg',
  '........iiJJJJJJJJJJJJJjjOOOjjJjjjjggggggg',
  '.......jJJJJzzPJJJJJJJJjjjjjjjJJjjjjggggggg',
  '......ijJJJzzPPPJJJJJJJjjjjjjjjjjjjjgggggggg',
  '......JJJJJPPPPOJJJJJJJjjjjjjjjjjjjjgggggggg',
  '.....jJJJJJPPPOOJJJJjjJjjjjjjjjjjjjjzzggggggg',
  '....jjJJwJJJOOOJJJJJJjjjjjjjjjjjjjjzPPPggggggg',
  '....jJJJJJJJJJJJJJJJJJjjjjjjjjjjjjjPPPPggggggg',
  '...jjJJJJJJJJJJJJJJJJjjjjjjjjjjjjjjgOOggggggggg',
  '...jJJJJJJJJJJJJJJJzzjjjjjjjjjjjjjjgggggggggggg',
  '..jjJJJJJjjJJJJJJJJJPjjjjjjjjjjjjjgggggJgggggggg',
  '..jjJJJJJJjJJJJJJJJjjjjjjjjjjjjjjjgggggJJggggggg',
  '..jjJJzzJJJJJJJJJJjjjjjjjjjjjzPPjjgggggggggggggg',
  '.jjJJzPPPJJJJJJJJjjjjjjjjjjjzPPPOgggggggggggggggg',
  '.jjJJPPPPJJJJJJJJjjjjjjjjjjjPPPPOgggggggggggggggg',
  '.jjjJJOOJJJJJjjjjjjjjjjjjjjjjOOOgggggggggzggggggg',
  '.jjjJJJJJJJJJJjjjjjjjjjjjjjjjjjjggggggggggPgggggg',
  'jjjjjJJJJJJJJjjjjjjjjjjjjjjjjjjggggggggggggggggggg',
  'jjjjjjjjJJjjjjjzjjjjjjjjjjjjjjjgggggggggggggJggggg',
  'jjjjjjjjjjjjjjjjPjjjjjjjjjjjjjgggJggggggggggJJgggg',
  'jjjjjjjjjjjjjjjjjjjjjjJjjjjjjggggJJggggggggggggggg',
  'jjjjjjjjjjjjjjjjjjjjjjJJjjjjjggggggggggggggggggggg',
  'eGGGjjjjjjjjjjjjjjjjjjjjjjjjggggggggggggggggggGGGG',
  'eeeeGGGGGjjjjjjjjjjjjjjjjjjggggggggggggggGGGGGeeee',
  '.eeeeeeeeGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGeeeeeee',
  '....eeeeeEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEEEeeee',
  '.........eEeEeEeEeEeEeEeEeEeEeEeEeEeEeEeE',
]

const FACE = [
  '............mmNN',
  '...........mwmNNN',
  '..........mmmNNNNn',
  '..........mNNNNNNn',
  '...FFFFEEkNNNNNNnnk',
  '.FFwFFEFEkkNNNNnnkke',
  'FFFFFEFEEekknnnnkkeee',
  '.FFEFEFEEeEkkkkkkEee',
  '..FFEFEEeEEEeEEEeee',
  '...FEFEEeEEEeEEeEe',
  '...FEFEeEEEeEEEee',
  '....FEFeEEEeEEee',
  '....FEEeEEeEEee',
  '.....FEeEEeEEe',
  '......FEeEeEe',
  '.......EEeEe',
  '........Ee',
]

const BODY = [
  '......ddDDDDDDDDhhh',
  '.....ddDDDDDDDDDDhh',
  '....dddDDDDDDDDDDhhh',
  '...dddDDDDdDDDDDDDhh',
  '...dddDDDDdDDDDDDDhhh',
  '..xxxxHxxxxxxxxxxxxxx',
  '..dddDDDDDdDDDDDdDDhhh',
  '.ddddDDDDDdDDDDDdDDDhh',
  'dHHHHHHHHHHHHHHHHHHHHd',
  'dddddddddddddddddddddd',
  '..dddddddddddddddddd',
]

const HANDLE = [
  '...hhhhh',
  '..h.....h',
  '.h.......h',
  'h.........h',
]

const BASKET = [
  '..AbA...zPz',
  '.AbbbA.zPPPO',
  '..cAc...OOO',
  'HHhHhHhHhHhHh',
  'hDhDhDhDhDhDh',
  'DdDdDdDdDdDdD',
  'hDhDhDhDhDhDh',
  '.ddddddddddd',
]

const PUFF1 = [
  '..........................................................y',
  '.z.............................................................',
  'zP..............................................................z',
  '.......................................................P.......zP',
  '...P.............................................................',
]

const PUFF2 = [
  '.......................................................z',
  '..z.......................................................',
  '.zP........................................................P',
  '..............................................................z',
  '.....................................................z.......zP',
  '.y',
]

export const D01: Design = {
  id: 'd01',
  title: 'Toadstool Forager',
  concept: 'Gathers in the mushroom hollows: a round jade toadstool for a hat, spotted with glowing spores, a basket of finds held low at her side.',
  pal: PAL,
  headBottom: 63,
  parts: [
    { id: 'shadow', group: 'feet', x: 34, y: 73, rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 72, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 39, y: 62, rows: BODY },
    { id: 'handB', group: 'hands', x: 35, y: 65, rows: FIST_L },
    { id: 'cap', group: 'head', x: 25, y: 26, rows: CAP, squash: [14, 17, 21] },
    { id: 'face', group: 'head', x: 43, y: 55, rows: FACE },
    { id: 'handle', group: 'prop', x: 64, y: 67, rows: HANDLE, ring: 1 },
    { id: 'basket', group: 'prop', x: 63, y: 69, rows: BASKET },
    { id: 'handF', group: 'hands', x: 66, y: 64, rows: FIST_R },
    { id: 'puff1', group: 'fx', x: 18, y: 38, rows: PUFF1, ring: 0, hidden: true },
    { id: 'puff2', group: 'fx', x: 18, y: 31, rows: PUFF2, ring: 0, hidden: true },
  ],
  idle: [
    {},
    { squash: 1 },
    { squash: 2, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 3, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1 },
  ],
  idleMs: [220, 120, 110, 280, 140, 170],
  // she gives the basket a shake; the cap shivers and puffs its spores, which drift up and out
  tic: [
    { squash: 2, move: { hands: [0, 1], prop: [0, 1] } },
    { move: { head: [0, -1], prop: [1, -1], hands: [1, -1] }, show: ['puff1'] },
    { squash: 1, move: { prop: [-1, 0], hands: [-1, 0] }, show: ['puff1'] },
    { show: ['puff2'] },
    { show: ['puff2'], nudge: { puff2: [0, -2] } },
    {},
  ],
  ticMs: [160, 110, 140, 220, 220, 160],
}
