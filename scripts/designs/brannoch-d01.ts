/**
 * Brannoch design 01 — the Lamp-Helm Foreman. Hand-authored pixel maps (see brannoch-lib.ts).
 *
 * Runs the ore carts out of the Ironvein deeps: a riveted iron miner's dome
 * with a brass lamp burning on its brow, a copper beard combed into a spade,
 * an overcast-blue tunic with a stitched leather hem, and a chalk slate of the
 * day's carts held up at his side. Silhouette: a round iron dome over a beard. Tic: he chalks
 * two more carts under the struck five, the lamp flares, and he nods once.
 */
import type { Design } from './brannoch-lib'
import { AT, FEET, FIST_B, FIST_F, PAL, SHADOW, bell } from './brannoch-common'

const HELM = [
  '.............JJJJJJJJJJ',
  '..........JJJJJJJJJJJJJJJJ',
  '.......JJJJwwwJJJJJJJIJJJJII',
  '......JJJwwJJJJJJJJJJIJJJJJIII',
  '....JJJJwJJJJJJJJJJJJKJJJJJJIIII',
  '...JJJJJJJJJJJJJJJJJJiJJJJJJIIIII',
  '..JJJJJJJJJJJJJJJJJJJIJJJJJIIIIIII',
  '..JJJJJJJJJJJJJJJJJJJIJJJJJIIIIIII',
  '.JJJJJJJJJJJJJJJJJJJJKJJJJIIIIIIIII',
  '.JJJJJJJJJJJJJJJJJJJJiJJJIIIIIIIIIi',
  'IJJJJJJJJJJJJJJJJJJJJIJIIIIIIIIIiii',
  'IIIIJJJJJJJJJJJJJJJJJiIIIIIIIIIIiiii',
  'IIIIIIIIIIJJJJJIIIIIJIIIIIIIIIiiiiii',
  'IIIIIIIIIIIIIIIIIIIIiIIIIIIIiiiiiiii',
  'iiiIIIIIIIIIIIIIIIIIIIIIIiiiiiiiiiii',
]

const BRIM = [
  '..JJIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIi.',
  'JJJKIIIIIIKIIIIIIKIIIIIIKIIIIIIKIIIIIiii',
  'IJJiIIIIIIiIIIIIIiIIIIIIiIIIIIIiIIIIiiii',
  'iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii',
]

const LAMP = [
  '..aaaa',
  '.aAttAa',
  'aAYwwYAa',
  'aAYwYYAa',
  'aAyYYyAa',
  '.aAyyAa',
  '..aaaa',
]
const LAMP_LIT = [
  '..aaaa',
  '.aAttAa',
  'aAwwwwAa',
  'aAwwwYAa',
  'aAYYYyAa',
  '.aAyyAa',
  '..aaaa',
]

const BEARD = [
  '.....HHHHHHHHHHHHHHHHHHHHHHHHhhhhhh',
  '....HHHHHHHHHHHHHHHHHHHHHHHHHhhhhhhh',
  '...HHHHHHHHHHHHHHHHHHHHHHHHHHhhhhhhhh',
  '..HHHHHHHjjjHHHHHHHHHHHHHHHHHhHhhhhhh',
  '..HHHHHHjjHHHHHHHHHHHHHhHHHHHhHhhhhhhh',
  '.HHHHHHjHHHHHHHHHhHHHHHhHHHHHhhhhhhhhh',
  '.HHHHHHHHHHHHHHHHhHHHHHhHHHHHhhhhhhhhh',
  'HHHHHHHHHHHHHHhHHhHhHHHhHHhHHhhhhhhqhhh',
  'HhHHhHHhHHHhHHhHHhHhHHHhHHhhhhhhhhhqhhq',
  'HhHHhHHhHHHhHHhHHhHhHHHhHhhhhqhhqhhqhqq',
  'hhhHhHHhHHHhHHhHHhHhHHhhhhhhhqhhqhhqqqq',
  '.hhhhhhhhhHhHHhhhqhhhhhhhhhhhqhhqhqqqq',
  '..hhhhhhhhhhhhhhhqhhhhhqhhhhhqhqqqqqq',
  '....hhhhhhhhhhqhhqhqhhhqhhqhqqqqqqqq',
  '......hhhhhqhhqhhqhqhhhqqqqqqqqqqqq',
  '........qqhqhhqqqqqqqqqqqqqqqqqqq',
  '..........qqqqqqqqqqqqqqqqqqqq',
  '.............qqqqqqqqqqqqqq',
  '................qqqqqq',
]

const MOUSTACHE = [
  '.....HHHHHHHHHHHHHHHHH',
  '..HHHjjjHHHHHHHHHHHHHHHh',
  'HHHjjHHHHHHHHHHHHHHHHHHhhh',
  'hHHHHHHhhhhhhhhhhhhhHHHhhh',
  '.hhhhq............qhhhhq',
]

const NOSE = [
  '.DDCC.',
  'DDCCCc',
  'DCCCCc',
  'CCCCcc',
  '.cccc.',
]

/** The shared bell this design wore before it got its own body (for the before/after card). */
export const BODY_SHARED = bell(
  { 1: 'N', 2: 'n', 3: 'v', 4: 'u', 5: 'U' },
  {
    5: '...VVUUUUUUUUUUUAttAUUUUUuuu',
    6: '..uuuuuuuuuuuuuaAAauuuuuuuuu',
  },
)

/** His own body: a padded miner's jerkin, square and boxy, quilted in puffed cells, brick-set and pinched at the seams, leather braces over it, a leather belt. */
const BODY = [
  '.NNNnNUuNnNNNNvNNnnvNUunvnnnnvn.',
  'NNNnnNUunnNNNnvNnnnvNUunvnnnvvnn',
  'NnnnvNUunvNnnnvnnnvvnUuvvnnvvvnn',
  'vnvvvvUuvvvnvvvvvvvvvUuvvvvvvvvv',
  'NNnNNNUuNNNNnNNnnvNNnUuNnnnvnnnn',
  'NnnNNNUuNNNnnNnnnvNnnUuNnnvvnnnv',
  'nnvNnnUuNnnnvNnnvvnnnUunnvvvnnvv',
  'vvvvnvUuvnvvvvvvvvvvvUuvvvvvvvvv',
  'UUUUUUUUUUUUUUtAAtUUUUUUUUUUUUuu',
  'uuuuuuuuuuuuuuaAAauuuuuuuuuuuuuu',
  'NNNNnNNNNnNNNNvNNnnvNNnnvnnnnvnn',
  'NNNnnNNNnnNNNnvNnnnvNnnnvnnnvvnn',
  '.vvvvvvvvvvvvvvvvvvvvvvvvvvvvvv.',
]

/** A tin lamp-oil flask with a brass stopper, hung from the belt on the front hip. */
const FLASK = [
  '.aAa',
  '.iJi',
  'iJwJIi',
  'iJJIIi',
  'iJIIii',
  '.iiii',
]

const SLATE = [
  'tVVVVVVVVVVU',
  'VzzzzzzzzzzU',
  'VzLzLzLzLllU',
  'VzLzLzLllzzU',
  'VzLzLllzLzzU',
  'VzLllzLzLzzU',
  'VlzzzzzzzzZU',
  'VzzzzzzzzzzU',
  'VzLzLzzzzzzU',
  'VzLzLzzzZzzU',
  'VzLzLzzzzzzU',
  'VzLzLzzzzzzU',
  'VzZzzzzzzzzU',
  'UUUUUUUUUUUu',
]
const SLATE4 = [
  'tVVVVVVVVVVU',
  'VzzzzzzzzzzU',
  'VzLzLzLzLllU',
  'VzLzLzLllzzU',
  'VzLzLllzLzzU',
  'VzLllzLzLzzU',
  'VlzzzzzzzzZU',
  'VzzzzzzzzzzU',
  'VzLzLzLzzzzU',
  'VzLzLzLzZzzU',
  'VzLzLzLzzzzU',
  'VzLzLzLzzzzU',
  'VzZzzzzzzzzU',
  'UUUUUUUUUUUu',
]
const SLATE5 = [
  'tVVVVVVVVVVU',
  'VzzzzzzzzzzU',
  'VzLzLzLzLllU',
  'VzLzLzLllzzU',
  'VzLzLllzLzzU',
  'VzLllzLzLzzU',
  'VlzzzzzzzzZU',
  'VzzzzzzzzzzU',
  'VzLzLzLzLzzU',
  'VzLzLzLzLzzU',
  'VzLzLzLzLzzU',
  'VzLzLzLzLzzU',
  'VzZzzzzzzzzU',
  'UUUUUUUUUUUu',
]

export const D01: Design = {
  id: 'd01',
  title: 'Lamp-Helm Foreman',
  concept: 'Runs the ore carts out of the deeps: a riveted miner\'s dome with a brass lamp on its brow, a copper spade beard, a chalk slate of the day\'s carts held at his side.',
  pal: PAL,
  headBottom: 56,
  parts: [
    { id: 'shadow', group: 'feet', x: AT.shadow[0], y: AT.shadow[1], rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: AT.feet[0], y: AT.feet[1], rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 34, y: 52, rows: BODY },
    { id: 'bodyFlask', group: 'body', x: 58, y: 61, rows: FLASK },
    { id: 'beard', group: 'head', x: 31, y: 37, rows: BEARD, sags: true },
    { id: 'helm', group: 'head', x: 33, y: 18, rows: HELM, squash: [8, 11] },
    { id: 'brim', group: 'head', x: 31, y: 31, rows: BRIM },
    { id: 'lamp', group: 'head', x: 57, y: 22, rows: LAMP },
    { id: 'moustache', group: 'head', x: 43, y: 37, rows: MOUSTACHE },
    { id: 'nose', group: 'head', x: 58, y: 34, rows: NOSE },
    { id: 'slate', group: 'prop', x: 72, y: 45, rows: SLATE },
    { id: 'handB', group: 'hands', x: AT.handB[0], y: AT.handB[1], rows: FIST_B },
    { id: 'handF', group: 'hands', x: 69, y: 55, rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1, nudge: { lamp: [0, 1] } },
    { squash: 2, sag: 1, nudge: { lamp: [0, 2] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, sag: 1, nudge: { lamp: [0, 2] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { lamp: [0, 1] } },
    {},
  ],
  idleMs: [260, 140, 160, 240, 140, 180],
  // he chalks two more carts under the struck five: lifts the slate, a mark, another, a nod
  tic: [
    { move: { prop: [0, -1] }, nudge: { handF: [0, -1] } },
    { move: { prop: [0, -1] }, nudge: { handF: [0, -1] }, swap: { slate: SLATE4 } },
    { move: { prop: [0, -1] }, nudge: { handF: [0, -1] }, swap: { slate: SLATE4 } },
    { move: { prop: [0, -1] }, nudge: { handF: [0, -1] }, swap: { slate: SLATE5, lamp: LAMP_LIT } },
    { squash: 2, sag: 1, nudge: { lamp: [0, 2] }, swap: { slate: SLATE5, lamp: LAMP_LIT } },
    { swap: { slate: SLATE5 } },
  ],
  ticMs: [140, 160, 160, 220, 240, 260],
}
