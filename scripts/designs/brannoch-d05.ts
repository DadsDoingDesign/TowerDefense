/**
 * Brannoch design 05 — the Soot Smith-Trader. Hand-authored pixel maps (see brannoch-lib.ts).
 *
 * Sells what the forge hall makes, straight off the anvil: a scorched
 * leather skullcap with brass forge goggles pushed up on it, a huge bushy
 * soot-black beard with embers caught in it, a leather apron, and tongs held
 * out at his side with a glowing ingot in their jaws. Silhouette: a small cap on a wild black cloud.
 * Tic: he blows on the ingot; it flares white and spits two sparks.
 */
import type { Design } from './brannoch-lib'
import { AT, FEET, FIST_B, FIST_F, PAL, SHADOW, bell } from './brannoch-common'

const CAP = [
  '..........VVVVVVVVVV',
  '.......VVVVtVVVVVVVVVVU',
  '.....VVVtttVVVVVVVVVVVVUU',
  '...VVVVttVVVVVVVVVVVVVVVUUU',
  '..VVVVtVVVVVVVVVVVVVVVVVUUUU',
  '.VVVVVVVVVVVVVVVVVVVVVVUUUUUU',
  '.VVVVVVVVVVVVVVVVVVVVUUUUUUUu',
  'UVVVVVVVVVVVVVVVVVUUUUUUUUuuu',
  'UUUVVVVVVVVVVUUUUUUUUUUUuuuuu',
  'uUUUUUUUUUUUUUUUUUUUUUUuuuuuu',
]

const STRAP = ['uuuuuuuuuuuuuuuuuuuuuuuuuuuuuu']

const GOGGLES = [
  '.aAAa..aAAa',
  'aAgOAaaAgOAa',
  'aOgOOaaOgOOa',
  'aOOOoaaOOOoa',
  '.aaaa..aaaa',
]

const BEARD = [
  '.......ZZZZZZZZZZZZZZZZZZZZZZzzzz',
  '....ZZZZZZZZZZZZZZZZZZZZZZZZZZzzzzzz',
  '..ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZzzzzz.z',
  '.ZZZZZZZdddZZZZZZZZZZZZZZZZZZZzzzzzzzz',
  'ZZZZZZZddZZZZZZZZZZZZZZZZZZZZZzzzzzzzz',
  '.ZZZZZdZZZZZZZZZZZZZZzZZZZZZZZzzzzzzzz',
  'ZZZZZZZZZZZzZZZZOZZZZzZZZZzZZZzzzzzzzzz',
  'ZZZZzZZZzZZzZZzZZZZZZzZZzZzZZzzzzzzzzzz',
  '.zZZzZZZzZZzZZzZZZZZZzZZzZzzzzzzzzzzzz',
  'ZzZZzZZZzZZzZZzZZZzZZzZZzzzzzgzzzzzzzzz',
  '.zZZzZZZzZZzZZzZZZzZZzzzzzzzzzzzzzzzzz',
  'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  '.zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz.z',
  '..zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  '.zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  '...zzzzzzzzzzzzzzzzzzzz.zzzzzz',
  '....zzz.zzzzzzzzzzzzz...zzzz',
  '.........zzzz.zzzzz',
]

const MOUSTACHE = [
  '.....ddddddddddddddddd',
  '..dddIIIdddddddddddddddZ',
  'dddIIddddddddddddddddddZZ',
  'ZddddddZZZZZZZZZZZZZdddZZZ',
  '.ZZZZZ............ZZZZZ',
]

const NOSE = [
  '..DDCC.',
  '.DDCCCc',
  'DDCCCCc',
  'DCCCCCc',
  'CCCCCcc',
  '.ccccc.',
]

const BODY = bell(
  { 1: 'V', 2: 'U', 3: 'u', 4: 'u', 5: 'U' },
  { 9: 'zzzzzzVVVVVVVVVVVVVVVVVVUUzzzz', 10: 'zZZzzZUUVVUUVVUUVVUUVVUUuuZZzz' },
)

const TONGS = [
  '.........iIi',
  '........iIi',
  '.......iIi',
  '......iIi',
  '.....iIi',
  '....iIi',
  '...iIi',
  '..iIi',
  '.iIi',
  'iIi',
  'iI',
]
const INGOT = [
  '..gyyyYg',
  '.OgyyyyyO',
  'OOgyyyyOo',
  'oOOOOOOo',
]
const INGOT_HOT = [
  '..YwwwwY',
  '.yYwwwwYy',
  'yYwwwwwYO',
  'OyyyyyyO',
]
const SPARKS = ['y....Y', '.......', '..Y.....y']

export const D05: Design = {
  id: 'd05',
  title: 'Soot Smith-Trader',
  concept: 'Sells straight off the anvil: a leather skullcap with forge goggles pushed up, a huge soot-black beard with embers in it, tongs holding out a glowing ingot.',
  pal: PAL,
  headBottom: 54,
  parts: [
    { id: 'shadow', group: 'feet', x: AT.shadow[0], y: AT.shadow[1], rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: AT.feet[0], y: AT.feet[1], rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: AT.body[0], y: AT.body[1], rows: BODY },
    { id: 'beard', group: 'head', x: 29, y: 34, rows: BEARD, sags: true },
    { id: 'cap', group: 'head', x: 35, y: 22, rows: CAP, squash: [5, 7] },
    { id: 'strap', group: 'head', x: 34, y: 30, rows: STRAP, ring: 1 },
    { id: 'goggles', group: 'head', x: 50, y: 24, rows: GOGGLES },
    { id: 'moustache', group: 'head', x: 43, y: 35, rows: MOUSTACHE },
    { id: 'nose', group: 'head', x: 57, y: 32, rows: NOSE },
    { id: 'tongs', group: 'prop', x: 69, y: 49, rows: TONGS },
    { id: 'ingot', group: 'prop', x: 76, y: 45, rows: INGOT },
    { id: 'sparks', group: 'fx', x: 78, y: 39, rows: SPARKS, ring: 0, hidden: true },
    { id: 'handB', group: 'hands', x: AT.handB[0], y: AT.handB[1], rows: FIST_B },
    { id: 'handF', group: 'hands', x: AT.handF[0], y: AT.handF[1], rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1, nudge: { goggles: [0, 1] } },
    { squash: 2, sag: 1, nudge: { goggles: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, sag: 1, nudge: { goggles: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { goggles: [0, 1] } },
    {},
  ],
  idleMs: [270, 150, 170, 250, 150, 190],
  // he lifts the ingot a touch and blows: it flares white and spits sparks, then dulls back
  tic: [
    { move: { prop: [0, -1] }, nudge: { handF: [0, -1] } },
    { move: { prop: [0, -1] }, nudge: { handF: [0, -1] }, squash: 1 },
    { move: { prop: [0, -1] }, nudge: { handF: [0, -1] }, swap: { ingot: INGOT_HOT }, show: ['sparks'] },
    { move: { prop: [0, -1] }, nudge: { handF: [0, -1], sparks: [1, -2] }, swap: { ingot: INGOT_HOT }, show: ['sparks'] },
    { nudge: { sparks: [2, -4] }, show: ['sparks'] },
    {},
  ],
  ticMs: [150, 200, 160, 200, 180, 240],
}
