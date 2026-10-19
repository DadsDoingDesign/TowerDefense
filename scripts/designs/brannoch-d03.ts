/**
 * Brannoch design 03 — the Quarry Boss. Hand-authored pixel maps (see brannoch-lib.ts).
 *
 * Bosses the cutting gangs on the Ironvein faces: a horned iron helm with a
 * nasal bar, a black beard cut square as a quarried block, a studded leather
 * jerkin, and a pick stood upright at his side like a staff of office.
 * Silhouette: two stubby horns over a square. Tic: he taps the pick on the
 * stone twice (a puff of quarry dust each time), then settles.
 */
import type { Design } from './brannoch-lib'
import { AT, FEET, FIST_B, FIST_F, PAL, SHADOW, bell } from './brannoch-common'

const HELM = [
  '.............JJJJJJJJJJ',
  '..........JJJJJJJJJJJJJJJJ',
  '.......JJJJwwwJJJJJJJJJJJJII',
  '......JJJwwJJJJJJJJJJJJJJJJIII',
  '....JJJJwJJJJJJJJJJJJJJJJJJJIIII',
  '...JJJJJJJJJJJJJJJJJJJJJJJJJIIIII',
  '..JJJJJJJJJJJJJJJJJJJJJJJJJIIIIIII',
  '..JJJJJJJJJJJJJJJJJJJJJJJJJIIIIIII',
  '.JJJJJJJJJJJJJJJJJJJJJJJJJIIIIIIIII',
  'IJJJJJJJJJJJJJJJJJJJJJJJIIIIIIIIIIii',
  'IIIIJJJJJJJJJJJJJJJJJIIIIIIIIIIIiiii',
  'IIIIIIIIIIJJJJJIIIIIIIIIIIIIIIiiiiii',
]

const BAND = [
  '..JJIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIi.',
  'JJJKIIIIIIKIIIIIIKIIIIIIKIIIIIIKIIIIIiii',
  'IJJiIIIIIIiIIIIIIiIIIIIIiIIIIIIiIIIIiiii',
  'iiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiiii',
]

const HORN_B = [
  'L',
  'LL',
  'LLM',
  'LLMm',
  'LLMMm',
  '.LLMMm',
  '.LLLMMm',
  '..LLLMMm',
  '...LLLMm',
]
const HORN_F = [
  '.......L',
  '......LL',
  '.....LLM',
  '....LLMm',
  '...LLMMm',
  '..LLLMMm',
  '.LLLMMm',
  'LLLMMm',
  'LLMMm',
]

const NASAL = ['JI', 'JI', 'JI', 'Ji']

const BEARD = [
  '....ZZZZZZZZZZZZZZZZZZZZZZZZzzzzz',
  '..ZZZZZZZZZZZZZZZZZZZZZZZZZZZzzzzz',
  '.ZZZZZZZdddZZZZZZZZZZZZZZZZZZzzzzzz',
  '.ZZZZZZddZZZZZZZZZZZZZZZZZZZZZzzzzz',
  'ZZZZZZdZZZZZZZZZZZZZZzZZZZzZZzzzzzz',
  'ZZZZZZZZZZZzZZZZZZZZZzZZzZzZzzzzzzz',
  'ZZZZzZZZzZZzZZzZZZZZZzZZzZzzzzzzzzz',
  'ZzZZzZZZzZZzZZzZZZzZZzZZzzzzzzzzzzz',
  'ZzZZzZZZzZZzZZzZZZzZZzZzzzzzzzzzzzz',
  'zzzZzZZZzZZzZZzZZZzzzzzzzzzzzzzzzzz',
  'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
  '.zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
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

const BODY = bell({ 1: 'V', 2: 'U', 3: 'u', 4: 'i', 5: 'J' })

const PICK = [
  '....JJJ',
  '.JJJJIIIIIIi',
  'JJIIVUIIIIIIIii',
  'JI..VU......Iii',
  'J...VU........i',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
  '....VU',
]

const DUST = [
  '..PP.......TT',
  '.PTTP....PTTP',
  'PTTTTP..PTTTTP',
]

export const D03: Design = {
  id: 'd03',
  title: 'Quarry Boss',
  concept: 'Bosses the cutting gangs on the Ironvein faces: a horned iron helm with a nasal, a black beard cut square as a block, a pick stood upright at his side.',
  pal: PAL,
  headBottom: 55,
  parts: [
    { id: 'shadow', group: 'feet', x: AT.shadow[0], y: AT.shadow[1], rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: AT.feet[0], y: AT.feet[1], rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: AT.body[0], y: AT.body[1], rows: BODY },
    { id: 'beard', group: 'head', x: 31, y: 38, rows: BEARD, sags: true },
    { id: 'hornB', group: 'head', x: 28, y: 15, rows: HORN_B },
    { id: 'hornF', group: 'head', x: 66, y: 14, rows: HORN_F },
    { id: 'helm', group: 'head', x: 33, y: 19, rows: HELM, squash: [5, 7] },
    { id: 'band', group: 'head', x: 31, y: 30, rows: BAND },
    { id: 'nasal', group: 'head', x: 58, y: 31, rows: NASAL },
    { id: 'moustache', group: 'head', x: 43, y: 37, rows: MOUSTACHE },
    { id: 'nose', group: 'head', x: 56, y: 34, rows: NOSE },
    { id: 'pick', group: 'prop', x: 71, y: 36, rows: PICK },
    { id: 'dust', group: 'fx', x: 70, y: 67, rows: DUST, ring: 0, hidden: true },
    { id: 'handB', group: 'hands', x: AT.handB[0], y: AT.handB[1], rows: FIST_B },
    { id: 'handF', group: 'hands', x: 72, y: 57, rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1, nudge: { hornB: [0, 1], hornF: [0, 1] } },
    { squash: 2, sag: 1, nudge: { hornB: [0, 2], hornF: [0, 2] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, sag: 1, nudge: { hornB: [0, 2], hornF: [0, 2] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { hornB: [0, 1], hornF: [0, 1] } },
    {},
  ],
  idleMs: [280, 150, 170, 260, 150, 200],
  // two taps of the pick on the stone: up, thunk (dust), up, thunk, a satisfied sink
  tic: [
    { move: { prop: [0, -1] }, nudge: { handF: [0, -1] } },
    { move: { prop: [0, 1] }, nudge: { handF: [0, 1] }, show: ['dust'], squash: 1 },
    { move: { prop: [0, -1] }, nudge: { handF: [0, -1], dust: [0, -1] }, show: ['dust'] },
    { move: { prop: [0, 1] }, nudge: { handF: [0, 1], hornB: [0, 2], hornF: [0, 2] }, show: ['dust'], squash: 2, sag: 1 },
    { show: ['dust'], nudge: { dust: [0, -2], hornB: [0, 2], hornF: [0, 2] }, squash: 2, sag: 1 },
    { squash: 1, nudge: { hornB: [0, 1], hornF: [0, 1] } },
  ],
  ticMs: [150, 130, 150, 130, 220, 220],
}
