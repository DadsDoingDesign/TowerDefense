/**
 * Brannoch design 06 — the Cart-Train Master. Hand-authored pixel maps (see brannoch-lib.ts).
 *
 * Takes the ore trains down the switchbacks to the lowland markets: a wide
 * leather drover's hat with a pinched crown and a blue band, a fair copper
 * handlebar moustache over one thick beard braid with a brass bead, a blue
 * travelling coat, and the train's ledger tucked under his back arm.
 * Silhouette: a wide flat brim. Tic: he flips the ledger open, checks the
 * count, snaps it shut, and nods.
 */
import type { Design } from './brannoch-lib'
import { AT, FEET, FIST_B, FIST_F, PAL, SHADOW, bell } from './brannoch-common'

const CROWN = [
  '.....VVVVVuVVVVVVVU',
  '...VVVwVVVuVVVVVVVVUU',
  '..VVVwVVVVVuVVVVVVVUUU',
  '.VVVVVVVVVVuVVVVVVUUUUU',
  '.VVVVVVVVVVVuVVVVVUUUUU',
  'VVVVVVVVVVVVuVVVVUUUUUUu',
  'NNNNNNNNNNNNNNNNNnnnnnnn',
  'nnnnnnnnnnnnnnnnnnnnnvvv',
]

const BRIM = [
  '.......VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUUU',
  'VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUUUUUU',
  'UUUVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUUUUUUUuu',
  '.uuuuUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUuuuuu',
  '......uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu',
]

const BEARD = [
  '.....HHHHHHHHHHHHHHHHHHHHhhhhh',
  '...HHHHHHHHHHHHHHHHHHhHHHHhhhhhh',
  '..HHHHHjjjHHHHHHHHHHHhHHhHhhhhhhh',
  '.HHHHHjjHHHHHHhHHHHHHhHHhHhhhhhhh',
  '.hHHhjHhHHhHHHhHHHhHHhHHhhhhhhqhh',
  'HhHHhHHhHHhHHHhHHHhHHhHhhhqhhhqhh',
  'hhHHqHHhHHhHHHhHHHhhhqhhhhqhhhqqq',
  '.hhhqhhqhhhhhhqhhhqhhqhhqhqhqqqq',
  '..hhqhhqhhqhhhqhhhqhhqhqqqqqqqq',
  '....qqqqhhqhqqqqqqqqqqqqqqqq',
  '.......qqqqqqqqqqqqqqqq',
]

const BRAID = [
  'HHjHhh',
  'hHHhhq',
  '.HHjh',
  'HHhhq',
  'hHHhq',
  '.tAAa',
  '.aAAa',
  '.HHhq',
  '..hq',
]

const MOUSTACHE = [
  '.......HHHHHHHHHHHHHHHHHH',
  '...HHHHjjjHHHHHHHHHHHHHHHHHh',
  'HHHHjjjHHHHHHHHHHHHHHHHHHHHHhhh',
  'hHHHHHHHhhhhhhhhhhhhhhhHHHHHhhh',
  '.hhhhq..................qhhhq',
]

const NOSE = [
  '.DDCC.',
  'DDCCCc',
  'DCCCCc',
  'CCCCcc',
  '.cccc.',
]

/** The shared bell this design wore before it got its own body (for the before/after card). */
export const BODY_SHARED = bell({ 1: 'N', 2: 'n', 3: 'v', 4: 'U', 5: 'V' })

/**
 * His own body: a long overcast-blue drover's coat, square in the shoulder with a
 * turned collar, brass buttons down the front, a wide leather belt with a big buckle,
 * and skirts that split at the back vent and kick out behind him.
 */
const COAT = [
  '.......NNNNNNNNNNNNNNNNNNNNnnnnnnnnnn',
  '......NNNNNNNNNNNNNNNNNNNNNNNnnnnnnnnnv',
  '......NNNNnnnnnnnnnnnnnnnnnnnnnnnnnnnvv',
  '......NNNnNNNNNNNNNNNNNNNNNNNnnnnnnnnvv',
  '......NNNnNNNNNNNNNNNNNNNNNNNnntnnnnnvv',
  '......NNNnNNNNNNNNNNNNNNNNNNNnnnnnnnnvv',
  '......NNNnNNNNNNNNNNNNNNNNNNNnnnnnnnnvv',
  '......NNnNNNNNNNNNNNNNNNNNNNNnntnnnnnvv',
  '......NNnNNNNNNNNNNNNNNNNNNNNnnnnnnnnvv',
  '......NNnNNNNNNNNNNNNNNNNNNNNnnnnnnnvvv',
  '......UUUUUUUUUUUUUUUUtAAAAtUUUUUUUuuuu',
  '......VVVVVUUUUUUUUUUUAyyyyAUUUUUUuuuuu',
  '......uuuuuuuuuuuuuuuutAAAAtuuuuuuuuuuu',
  '.....NNNnNNNNNNvNNNNNNNNNNNNNnnnnnnnnvv',
  '....NNNnNnNNNNNvNNNNNNnNNNNNNnnnnnnnnvv',
  '...NNNNnNnNNNNvNNNNNNNnNNNNNNnnnnnnnnvv',
  '..NNNNnNNnNNNNvNNNNNNNnNNNNNNnnnnnnnnvv',
  '.NNNNnNNnNNNNvvNNNNNNNnNNNNNNnnnnnnnvvv',
  'NNNNnNNNnNNNNvnNNNNNNNnNNNNNNnnnnnnnvvv',
  'NNNnnNNNnNNNvvnnNNNNNNnNNNNNnnnnnnnvvv',
  'vnnnnnnnnnnvv.vnnnnnnnnnnnnnnnnnnnnvv',
  '.vvvvvvvvvvv...vvvvvvvvvvvvvvvvvvvvvv',
]

const LEDGER = [
  'RRRRRRRRRRRRr',
  'RQQQQQQQQQRRr',
  'RQRRRRRRRRRRr',
  'RQRRRtAAtRRRr',
  'RQRRRAyyARRRr',
  'RQRRRtAAtRRRr',
  'RQRRRRRRRRRRr',
  'RRRRRRRRRRRRr',
  'LLLLLLLLLLLLM',
  'LmmLLmmLLmmLM',
  'rrrrrrrrrrrrr',
]
const LEDGER_OPEN = [
  '.LLLLLLL.LLLLLLL',
  'LLmmmmmLLLmmmmLL',
  'LLLLLLLLMLLLLLLL',
  'LLmmmmLLMLmmmmmL',
  'LLLLLLLLMLLLLLLL',
  'LLmmmLLLMLLmmmLL',
  'LLLLLLLLMLLLLLLM',
  'LLmmmmLLMLmmLLLM',
  'RRRRRRRRrRRRRRRr',
]

export const D06: Design = {
  id: 'd06',
  title: 'Cart-Train Master',
  concept: 'Takes the ore trains down the switchbacks: a wide leather drover\'s hat, a copper handlebar moustache over one braided beard, the train\'s ledger under his arm.',
  pal: PAL,
  headBottom: 54,
  parts: [
    { id: 'shadow', group: 'feet', x: AT.shadow[0], y: AT.shadow[1], rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: AT.feet[0], y: AT.feet[1], rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 27, y: 45, rows: COAT },
    { id: 'beard', group: 'head', x: 34, y: 34, rows: BEARD, sags: true },
    { id: 'braid', group: 'head', x: 50, y: 44, rows: BRAID, sags: true },
    { id: 'crown', group: 'head', x: 40, y: 17, rows: CROWN, squash: [3, 4] },
    { id: 'brim', group: 'head', x: 27, y: 25, rows: BRIM },
    { id: 'moustache', group: 'head', x: 40, y: 33, rows: MOUSTACHE },
    { id: 'nose', group: 'head', x: 57, y: 30, rows: NOSE },
    { id: 'ledger', group: 'prop', x: 16, y: 50, rows: LEDGER },
    { id: 'ledgerOpen', group: 'prop', x: 14, y: 52, rows: LEDGER_OPEN, hidden: true },
    { id: 'handB', group: 'hands', x: 26, y: 55, rows: FIST_B },
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
  // the ledger flips open, he reads the count, snaps it shut, and nods
  tic: [
    { move: { prop: [0, -1] }, nudge: { handB: [0, -1] } },
    { hide: ['ledger'], show: ['ledgerOpen'], nudge: { handB: [0, -1] } },
    { hide: ['ledger'], show: ['ledgerOpen'], nudge: { handB: [0, -1] }, squash: 1 },
    { hide: ['ledger'], show: ['ledgerOpen'], nudge: { handB: [0, -1] }, squash: 1 },
    { move: { prop: [0, -1] }, nudge: { handB: [0, -1] } },
    { squash: 2, sag: 1 },
  ],
  ticMs: [150, 200, 220, 220, 140, 240],
}
