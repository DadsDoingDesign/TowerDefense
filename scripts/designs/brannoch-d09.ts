/**
 * Brannoch design 09 — the Iron Factor. Hand-authored pixel maps (see brannoch-lib.ts).
 *
 * Ironvein's money-dwarf in the lowland towns: a tall riveted iron top hat
 * with a brass band, an iron-grey beard trimmed square, a forge-red coat with
 * brass buttons, and the company's strongbox carried low by its handle.
 * Silhouette: a tall iron stovepipe on a square. Tic: he gives the strongbox
 * a shake — it clinks, gold glints at the lid — and he nods, satisfied.
 */
import type { Design } from './brannoch-lib'
import { AT, FEET, FIST_B, FIST_F, PAL, SHADOW, bell } from './brannoch-common'

const CROWN = [
  '..JJJJJJJJJJJJJJJJJII',
  '.JJJwwJJJJJJJJJJJJIIII',
  'JJJwwJJJJJJJJJJJJJIIIIi',
  'JJJwJJJJJJJJJJJJJIIIIii',
  'JJJJJJJJJJJJJJJJJIIIIii',
  'JKJJJJJJJJJJJJJKJIIIiii',
  'JiJJJJJJJJJJJJJiJIIIiii',
  'JJJJJJJJJJJJJJJJIIIIiii',
  'JJJJJJJJJJJJJJJJIIIIiii',
  'IJJJJJJJJJJJJJJJIIIiiii',
  'IJJJJJJJJJJJJJJIIIIiiii',
  'IKJJJJJJJJJJJJJKIIIiiii',
  'IiJJJJJJJJJJJJJiIIIiiii',
  'IIJJJJJJJJJJJJIIIIiiiii',
]

const HATBAND = [
  'tAAAAAAAAAAAAAAAAAAAaaa',
  'aaaaaaaaaaaaaaaaaaaaaaa',
]

const BRIM = [
  '...JJJJJJJJJJJJJJJJJJJJJJJJJJIII',
  'JJJJJJJJJJJJJJJJJJJJJJJJJJJJJIIIIii',
  'IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIiiii',
  '.iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii',
]

const HAIRB = [
  'MMMMMMMm',
  'LMMMMMMm',
  'MLMMMMmm',
  'MMMMMmm',
  '.mMMmm',
]

const BEARD = [
  '....MMMMMMMMMMMMMMMMMMMMMMmmmm',
  '..MMMLLMMMMMMMMMMMMMMMMMMMmmmmm',
  '.MMLLMMlllMMMMMMMMMMMmMMMMmmmmmm',
  'MMLMMMllMMMmMMMMMMMMMmMMmMmmmmmm',
  'MMMMmlMMmMMmMMmMMMMMMmMMmMmmmmmm',
  'MmMMmMMMmMMmMMmMMMmMMmMMmmmmmmpm',
  'MmMMmMMMmMMmMMmMMMmMMmmmmmpmmmpm',
  'mmMMmMMMmMMmMMmMMMmmmpmmmmpmmmpp',
  'mpmmmmmmmmmpmmpmmmpmmpmmmmpmpppp',
  'mpmmmmmmmmmpmmpmmmpmmpmmpppppppp',
  'ppmmpmmmpmmpmmpmmmpppppppppppppp',
  '.pppppppppppppppppppppppppppppp',
]

const MOUSTACHE = [
  '......LLLLLLLLLLLLLLLL',
  '...LLLLllLLLLLLLLLLLLLLM',
  '.LLLllLLLLLLLLLLLLLLLLLLMm',
  'LLLLLLLMMMMMMMMMMMMMLLLMMm',
  'MMMMm..............mMMMm',
]

const NOSE = [
  '.DCC..',
  '.DCCC.',
  'DDCCCc',
  'CCCCCc',
  '.CCccc',
  '..ccc.',
]

const BODY = bell(
  { 1: 'Q', 2: 'R', 3: 'r', 4: 'r', 5: 'R' },
  { 5: '...QQRRRRRRRRRRtRRRRRRRRrrrr', 7: '.QQRRRRRRRRRRRRtRRRRRRRRRrrrr' },
)

const BOX = [
  'tAiiiiiiiiiiiAa',
  'AJJJJJJJJJJJJIa',
  'iJKJJJJJJJJJIIi',
  'iJJJJJtAAaJJIIi',
  'iJJJJJAyyaJJIIi',
  'iJJJJJaAAaJJIIi',
  'iIIIIIIaaIIIIii',
  'AIIIIIIIIIIIIia',
  'aaiiiiiiiiiiiaa',
]
const HANDLE = [
  '..iIIIIi..',
  '.i......i.',
]
const GLINT = ['..y.....Y', 'Y....y']

export const D09: Design = {
  id: 'd09',
  title: 'Iron Factor',
  concept: 'Ironvein\'s money-dwarf in the lowland towns: a tall riveted iron top hat, an iron-grey beard trimmed square, a red coat, the company strongbox carried low.',
  pal: PAL,
  headBottom: 52,
  parts: [
    { id: 'shadow', group: 'feet', x: AT.shadow[0], y: AT.shadow[1], rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: AT.feet[0], y: AT.feet[1], rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: AT.body[0], y: AT.body[1], rows: BODY },
    { id: 'hairB', group: 'head', x: 35, y: 31, rows: HAIRB },
    { id: 'beard', group: 'head', x: 34, y: 37, rows: BEARD, sags: true },
    { id: 'crown', group: 'head', x: 39, y: 10, rows: CROWN, squash: [4, 8] },
    { id: 'hatband', group: 'head', x: 39, y: 24, rows: HATBAND },
    { id: 'brim', group: 'head', x: 33, y: 26, rows: BRIM },
    { id: 'moustache', group: 'head', x: 43, y: 34, rows: MOUSTACHE },
    { id: 'nose', group: 'head', x: 57, y: 31, rows: NOSE },
    { id: 'handle', group: 'prop', x: 70, y: 60, rows: HANDLE, ring: 1 },
    { id: 'box', group: 'prop', x: 68, y: 62, rows: BOX },
    { id: 'glint', group: 'fx', x: 70, y: 56, rows: GLINT, ring: 0, hidden: true },
    { id: 'handB', group: 'hands', x: AT.handB[0], y: AT.handB[1], rows: FIST_B },
    { id: 'handF', group: 'hands', x: 69, y: 57, rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1 },
    { squash: 2, sag: 1, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, sag: 1, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1 },
    {},
  ],
  idleMs: [270, 150, 170, 250, 150, 200],
  // a shake of the strongbox: clink, clink — the gold glints — and a satisfied nod
  tic: [
    { move: { prop: [0, -1] }, nudge: { handF: [0, -1] } },
    { move: { prop: [1, -1] }, nudge: { handF: [1, -1] }, show: ['glint'] },
    { move: { prop: [-1, -1] }, nudge: { handF: [-1, -1] } },
    { move: { prop: [1, -1] }, nudge: { handF: [1, -1] }, show: ['glint'] },
    { squash: 2, sag: 1 },
    { squash: 1 },
  ],
  ticMs: [140, 110, 110, 140, 260, 220],
}
