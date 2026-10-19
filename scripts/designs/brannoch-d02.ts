/**
 * Brannoch design 02 — the Abacus Clerk. Hand-authored pixel maps (see brannoch-lib.ts).
 *
 * Keeps the books in the forge hall's counting room: a red felt cap with a
 * stitched seam and a leather ear flap tied down, a long grey beard combed
 * straight and tucked into his belt, a soot-grey clerk's coat, and an abacus
 * held low at his hip. Silhouette: a square cap block with a flap hanging off
 * its back. Tic: he flicks the beads across, one rod after another, and sniffs.
 */
import type { Design } from './brannoch-lib'
import { AT, FEET, FIST_B, FIST_F, PAL, SHADOW, bell } from './brannoch-common'

const CAP = [
  '..........QQQQQQQQQQQQRRRR',
  '.......QQQQQwwQQQQQQQQQRRRRRr',
  '.....QQQQQwwQQQQQQQQQQQQRRRRRrr',
  '...QQQQQQwQQQQQQQQQQrQQQQRRRRRrr',
  '..QQQQQQQQQQQQQQQQQQRQQQQRRRRRRrrr',
  '.QQQQQQQQQQQQQQQQQQQrQQQRRRRRRRrrr',
  '.QQQQQQQQQQQQQQQQQQQRQQQRRRRRRrrrr',
  'QQQQQQQQQQQQQQQQQQQQrQQRRRRRRRrrrr',
  'QQQQQQQQQQQQQQQQQQQRRQRRRRRRRrrrrr',
  'RQQQQQQQQQQQQQQQQRRRRRRRRRRRrrrrrr',
  'RRRRQQQQQQQQRRRRRRRRRRRRRRrrrrrrr',
  'rRRRRRRRRRRRRRRRRRRRRRRRrrrrrrrr',
]

const BAND = [
  'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUUUU',
  'VVUUVVUUVVUUVVUUVVUUVVUUVVUUVVUUUuuu',
  'UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUuuuu',
]

const FLAP = [
  'VVVVVVVVU',
  'VVVVVVVUU',
  'VUVVVVUUu',
  'VUVVVVUUu',
  'VVVVVVUUu',
  'VUVVVUUUu',
  'VUVVVUUuu',
  'UVVVUUUuu',
  'UUVVUUuuu',
  '.UUUUUuu',
  '..uuuuu',
  '...uu',
]
const TIE = ['t', 'a', 't', 'a']
const KNOB = ['QR', 'Rr']

const BEARD = [
  '....LLLLLLLLLLLLLLLLLLLLLMMMMM',
  '..LLLLLLLLLLLLLLLLLLLLLLLMMMMMMM',
  '.LLLLLLlllLLLLLLLLLLLLLLLMMMMMMMM',
  '.LLLLLllLLLLLLLLLLLLLLLLLMLMMMMMM',
  'LLLLLlLLLLLLLLLLLLLMLLLLLMLMMMMMM',
  'LLLLLLLLLLLLLLLLLLLMLLLLLMMMMMMmM',
  'LLLLLLLMLLLLLLLLLLLMLLMLLMMMMMMmM',
  'LLLLMLLMLLMLLMLMLLLMLLMLMMMMMMMmM',
  'LMLLMLLMLLMLLMLMLLLMLLMMMmMMmMMmM',
  '.MLLMLLMLLMLLMLMLLLMMMMMMmMMmMMm',
  '.MMMMLLMLLMLLMLMMMMMMMMMMmMMmMmm',
  '..MMmMMMMMmMMmMMMMMmMMMMMmMMmmm',
  '..MMmMMmMMmMMmMmMMMmMMmMMmmmmmm',
  '...MmMMmMMmMMmMmMMMmMmmmmmmmmm',
  '....mmMmMMmMMmmmmmmmmmmmmmmmm',
  '.....mmmmmmmmmmmmmmmmmmmmmm',
  '......mmmmmmmmmmmmmmmmmmm',
]

const MOUSTACHE = [
  '.....LLLLLLLLLLLLLLLL',
  '..LLLllLLLLLLLLLLLLLLLM',
  '.LLlLLLLLLLLLLLLLLLLLLMm',
  'LLLLLMMMMMMMMMMMMMMLLLMmm',
  'MMMm...............mMMm',
]

const NOSE = [
  '.DCC',
  'DCCCc',
  'CCCcc',
  '.ccc',
]

const BELT = [
  'uUUUUUUUUUUUAttAUUUUUUUuu',
  'uuuuuuuuuuuuaAAauuuuuuuuu',
]

const BODY = bell({ 1: 'd', 2: 'Z', 3: 'z', 4: 'z', 5: 'Z' })

const ABACUS = [
  'tVVVVVVVVVVVVVVU',
  'VtAtAtAIIIIIItAU',
  'VaaaaaakkkkkkaaU',
  'VkkkkkkkkkkkkkkU',
  'VIIItAtAtAtAIIIU',
  'VkkkaaaaaaaakkkU',
  'VkkkkkkkkkkkkkkU',
  'VQRQRIIIIIIIQRQU',
  'VrrrrkkkkkkkrrrU',
  'UUUUUUUUUUUUUUUu',
]
const ABACUS2 = [
  'tVVVVVVVVVVVVVVU',
  'VtAtAIIIIIItAtAU',
  'VaaaakkkkkkaaaaU',
  'VkkkkkkkkkkkkkkU',
  'VIIItAtAtAtAIIIU',
  'VkkkaaaaaaaakkkU',
  'VkkkkkkkkkkkkkkU',
  'VQRQRIIIIIIIQRQU',
  'VrrrrkkkkkkkrrrU',
  'UUUUUUUUUUUUUUUu',
]
const ABACUS3 = [
  'tVVVVVVVVVVVVVVU',
  'VtAIIIIIItAtAtAU',
  'VaakkkkkkaaaaaaU',
  'VkkkkkkkkkkkkkkU',
  'VIIItAtAtAtAIIIU',
  'VkkkaaaaaaaakkkU',
  'VkkkkkkkkkkkkkkU',
  'VQRIIIIIIIQRQRQU',
  'VrrkkkkkkkrrrrrU',
  'UUUUUUUUUUUUUUUu',
]

export const D02: Design = {
  id: 'd02',
  title: 'Abacus Clerk',
  concept: 'Keeps the forge hall\'s books: a red felt cap with a leather ear flap, a grey beard combed straight and tucked in his belt, an abacus at his hip.',
  pal: PAL,
  headBottom: 56,
  parts: [
    { id: 'shadow', group: 'feet', x: AT.shadow[0], y: AT.shadow[1], rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: AT.feet[0], y: AT.feet[1], rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: AT.body[0], y: AT.body[1], rows: BODY },
    { id: 'beard', group: 'head', x: 34, y: 38, rows: BEARD, sags: true },
    { id: 'belt', group: 'body', x: 37, y: 55, rows: BELT },
    { id: 'knob', group: 'head', x: 51, y: 16, rows: KNOB, ring: 1 },
    { id: 'cap', group: 'head', x: 33, y: 18, rows: CAP, squash: [6, 8] },
    { id: 'band', group: 'head', x: 31, y: 29, rows: BAND },
    { id: 'flap', group: 'head', x: 29, y: 31, rows: FLAP },
    { id: 'tie', group: 'head', x: 33, y: 42, rows: TIE, ring: 1 },
    { id: 'moustache', group: 'head', x: 43, y: 36, rows: MOUSTACHE },
    { id: 'nose', group: 'head', x: 57, y: 33, rows: NOSE },
    { id: 'abacus', group: 'prop', x: 71, y: 59, rows: ABACUS },
    { id: 'handB', group: 'hands', x: AT.handB[0], y: AT.handB[1], rows: FIST_B },
    { id: 'handF', group: 'hands', x: AT.handF[0], y: AT.handF[1], rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1, nudge: { knob: [0, 1] } },
    { squash: 2, sag: 1, nudge: { knob: [0, 2] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, sag: 1, nudge: { knob: [0, 2] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { knob: [0, 1] } },
    {},
  ],
  idleMs: [260, 140, 160, 240, 140, 180],
  // he flicks the beads across, one rod after another, then a sniff (the nose lifts)
  tic: [
    { nudge: { handF: [0, -1] }, move: { prop: [0, -1] } },
    { nudge: { handF: [1, -1] }, move: { prop: [0, -1] }, swap: { abacus: ABACUS2 } },
    { nudge: { handF: [1, -1] }, move: { prop: [0, -1] }, swap: { abacus: ABACUS3 } },
    { swap: { abacus: ABACUS3 }, nudge: { nose: [0, -1] } },
    { swap: { abacus: ABACUS3 }, squash: 1 },
    { swap: { abacus: ABACUS3 } },
  ],
  ticMs: [140, 150, 150, 220, 200, 260],
}
