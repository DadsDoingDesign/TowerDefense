/**
 * Brannoch design 10 — the Gate Tollman. Hand-authored pixel maps (see brannoch-lib.ts).
 *
 * Takes the toll from every cart at the Ironvein gate: a soot-grey wool flat
 * cap pulled down with its stiff peak jutting forward, bushy copper mutton
 * chops and a short beard smudged with coal, a patched blue work tunic, and
 * the gate's great ring of iron keys hung from his fist. Silhouette: a flat
 * cap with a long peak over a round bush. Tic: he jingles the keys — they
 * swing and glint — and gives a short nod (pay up).
 */
import type { Design } from './brannoch-lib'
import { AT, FEET, FIST_B, FIST_F, PAL, SHADOW, bell } from './brannoch-common'

const CAP = [
  '..........ddddddddddddddZZ',
  '......ddddddddddddddddddddZZZ',
  '....ddddwwdddddddddZddddddddZZZ',
  '..ddddwwdddddddddddZdddddddddZZZZ',
  '.dddddddddddddddddZdddddddddZZZZZz',
  'ddddddddddddddddddZddddddddZZZZZZzz',
  'ZdddddddddddddddddZdddddddZZZZZZZzz',
  'ZZddddddddddddddddZddddddZZZZZZZzzz',
  'ZZZZdddddddddddZZZZZZZZZZZZZZZzzzzz',
  'zZZZZZZZZZZZZZZZZZZZZZZZZZZZZZzzzzz',
]

const PEAK = [
  '..ZZZZZZZZZZZZZZZZz',
  'ZZZZZZZZZZZZZZZZZZZzz',
  'zzzzzzzzzzzzzzzzzzzzz',
]

const BEARD = [
  '.HHHHHHHH..................Hhhhhhh',
  'HHHHHHHHHH................HHHhhhhhh',
  'HHHHHHHHjjj..............HHHHHhhhhh',
  'HHHHHHHjjHHHHHHHHHHHHHHHHHHHHHhhhhhh',
  'HHHHHHjHHHHHHHHHHHHHHhHHHHhHHHhhhhhh',
  'HHHHHHHHHHHHHHHHHHHHHhHHhHhHHhhhhhhh',
  'HHHHHHHHHHHHHHhHzHHHHhHHhHhHhhhhhhhh',
  'HHHHhHHhHHhHHHhHHHHHHhHHhHhhhhqhhqh',
  'HhHHhHHhHHhHHHhHHHhHHhHHhhhhhhqhhqq',
  '.hHHhHHhHHhHHHhHHHhHHhhhhhqhhhqhqqq',
  '.hhhqhhhhhhhhhhhhhhhhqhhhhqhhhqqq',
  '..hhqhhqhhhhhhqhhhqhhqhhqhqqqqqq',
  '...hqhhqhhqhhhqhhhqhhqhqqqqqqq',
  '....qqqqqqqhqqqqqqqqqqqqqqq',
  '......qqqqqqqqqqqqqqqqqq',
  '.........qqqqqqqqqqqq',
]

const MOUSTACHE = [
  '.....HHHHHHHHHHHHHHHH',
  '..HHHjjHHHHHHHHHHHHHHHh',
  'HHHjHHHHHHHHHHzHHHHHHhhh',
  'hHHHHHhhhhhhhhhhhhHHHhhh',
  '.hhhq.............qhhq',
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
  { 1: 'N', 2: 'n', 3: 'v', 4: 'z', 5: 'Z' },
  { 4: '...1122222222322NNNNN2223333', 5: '...1122222222322NnNnN2223333', 6: '..112222222233222NNNNN233333' },
)

const RING = [
  '..iIIIi',
  '.iI...Ii',
  'iI.....Ii',
  'iI.....Ii',
  'iI.....Ii',
  '.iI...Ii',
  '..iIIIi',
]
const KEYS = [
  'tA...t...tA',
  'Aa...A...Aa',
  'Aa..tAA..Aa',
  'aA...A...aA',
  'tAA..A..tAA',
  'Aa...Aa..Aa',
  '.....a',
]
const KEYS_SWING = [
  '.tA...t..tA',
  '.Aa...A..Aa',
  '.Aa..tAA.Aa',
  '..aA..A..aA',
  '..tAA.A.tAA',
  '..Aa..Aa.Aa',
  '.......a',
]
const GLINT = ['w', '.', 'w']

export const D10: Design = {
  id: 'd10',
  title: 'Gate Tollman',
  concept: 'Takes the toll from every cart at the gate: a soot-grey flat cap with a jutting peak, bushy copper mutton chops smudged with coal, the gate\'s iron keys at his hip.',
  pal: PAL,
  headBottom: 57,
  parts: [
    { id: 'shadow', group: 'feet', x: AT.shadow[0], y: AT.shadow[1], rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: AT.feet[0], y: AT.feet[1], rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: AT.body[0], y: AT.body[1], rows: BODY },
    { id: 'beard', group: 'head', x: 32, y: 36, rows: BEARD, sags: true },
    { id: 'cap', group: 'head', x: 32, y: 23, rows: CAP, squash: [4, 6] },
    { id: 'peak', group: 'head', x: 54, y: 31, rows: PEAK },
    { id: 'moustache', group: 'head', x: 45, y: 38, rows: MOUSTACHE },
    { id: 'nose', group: 'head', x: 58, y: 35, rows: NOSE },
    { id: 'ring', group: 'prop', x: 66, y: 58, rows: RING },
    { id: 'keys', group: 'prop', x: 64, y: 64, rows: KEYS, ring: 1 },
    { id: 'glint', group: 'fx', x: 76, y: 62, rows: GLINT, ring: 0, hidden: true },
    { id: 'handB', group: 'hands', x: AT.handB[0], y: AT.handB[1], rows: FIST_B },
    { id: 'handF', group: 'hands', x: AT.handF[0], y: AT.handF[1], rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1 },
    { squash: 2, sag: 1, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, sag: 1, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1 },
    {},
  ],
  idleMs: [260, 150, 170, 250, 150, 190],
  // a jingle of the keys: they swing out and back, glint; then a short nod (pay up)
  tic: [
    { nudge: { handF: [0, -1], ring: [0, -1], keys: [0, -1] } },
    { nudge: { handF: [1, -1], ring: [1, -1] }, swap: { keys: KEYS_SWING }, at: { keys: [64, 63] }, show: ['glint'] },
    { nudge: { handF: [0, -1], ring: [0, -1], keys: [-1, -1] } },
    { nudge: { handF: [1, -1], ring: [1, -1] }, swap: { keys: KEYS_SWING }, at: { keys: [64, 63] }, show: ['glint'] },
    { squash: 2, sag: 1 },
    { squash: 1 },
  ],
  ticMs: [120, 110, 110, 140, 240, 220],
}
