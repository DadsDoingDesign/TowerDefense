/**
 * Brannoch design 07 — the Mason Guild Elder. Hand-authored pixel maps (see brannoch-lib.ts).
 *
 * Has cut Ironvein's gate stones for sixty winters: a bald, polished dome
 * with a fringe of white hair, two bushy white brows that hide his eyes, the
 * biggest white beard on the mountain, a stone-dust smock, and his old
 * mason's mallet hanging head-down from his fist. Silhouette: a shining
 * dome over a great white square. Tic: he strokes his beard, slowly, twice —
 * the sentimental one.
 */
import type { Design } from './brannoch-lib'
import { AT, FEET, FIST_B, FIST_F, PAL, SHADOW, bell } from './brannoch-common'

const DOME = [
  '...........EEEEEEEE',
  '........EEEEFFEEEEEEEe',
  '......EEEFFwwFEEEEEEEEee',
  '.....EEEFwwFEEEEEEEEEEEee',
  '...EEEEEFFEEEEEEEEEEEEEeeee',
  '...EEEEFEEEEEEEEEEEEEEEeeee',
  '..EEEEEEEEEEEEEEEEEEEEEeeeee',
  '.EEEEEEEEEEEEEEEEEEEEEeeeeeee',
  '.EEEEEEEEEEEEEEEEEEEEeeeeeeee',
  'eEEEEEEEEEEEEEEEEEEEeeeeeeeee',
  'eeEEEEEEEEEEEEEEEEeeeeeeeeeee',
  'eeeeeeEEEEEEEEeeeeeeeeeeeeeee',
]

const FRINGE = [
  '...LLLLLM',
  '.LLLlLLMMm',
  'LLLLLLMMMm',
  'LLlLLLMMmm',
  'MLLLLMMMmm',
  'MMLLMMMmm',
  '.MMMMMmm',
]

const BROWS = [
  '.LLLLLL.....LLLLLLL',
  'LLlLLLLM...LLllLLLLLM',
  'MLLLMMMm..MLLLLLLLMMm',
  '.mmmmm.....mmmmmmmm',
]

const BEARD = [
  '.......LLLLLLLLLLLLLLLLLLLLLLLLMMMMM',
  '.....LLLLLLLLLLLLLLLLLLLLLLLLLLLMMMMMM',
  '...LLLLLLLLLLLLLLLLLLLLLLLLLLLLLMMMMMMMM',
  '..LLLLLLLlllLLLLLLLLLLLLLLLLLLLLMMMMMMMM',
  '.LLLLLLLllLLLLLLLLLLLLLLLMLLLLLLMMMMMMMM',
  '.LLLLLLlLLLLLLLLLLLLLLLLLMLLMLLLMMMMMMMM',
  'LLLLLLLLLLLLLLLLLLLMLLLLLMLLMLLLMMMMMMMM',
  'LLLLLLLMLLLLLLLLLLLMLLLLLMLLMLLMMMMMMMMM',
  'LLLLLLLMLLMLLMLMLLLMLLLLLMLLMMMMMMMMMMMM',
  'LMLLMLLMLLMLLMLMLLLMLLMLLMLLMMMMmMMMmMMM',
  'LMLLMLLMLLMLLMLMLLLMLLMLLMMMMMMMmMMMmMmm',
  'MMMMMLLMLLMLLMLMLLLMLMMMMmMMMMMMmMMMmmmm',
  '.MMMMMMMMMmMMmMMMMMMMMMMMmMMMMMMmMMmmmm',
  '.MMMmMMmMMmMMmMMMMMmMMMMMmMMmMMMmmmmmmm',
  '..MMmMMmMMmMMmMmMMMmMMMMMmMMmmmmmmmmm',
  '...MmMMmMMmMMmMmMMMmMMmMmmmmmmmmmmmmm',
  '....mmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
  '......mmmmmmmmmmmmmmmmmmmmmmmm',
  '.........mmmmmmmmmmmmmmmmm',
]

const MOUSTACHE = [
  '......LLLLLLLLLLLLLLLLL',
  '...LLLLlllLLLLLLLLLLLLLLM',
  '.LLLllLLLLLLLLLLLLLLLLLLMMm',
  'LLLLLLLLMMMMMMMMMMMMLLLLMMm',
  'MLLLMMm............mMMMMm',
  '.mmmm...............mmm',
]

const NOSE = [
  '..DDCC.',
  '.DDCCCc',
  'DDCCCCc',
  'DCCCCCc',
  'CCCCCcc',
  '.ccccc.',
]

const BODY = bell({ 1: 'T', 2: 'P', 3: 'p', 4: 'u', 5: 'U' })

const MALLET = [
  '......VU',
  '......VU',
  '......VU',
  'JIVVVVVVVVVVJI',
  'JIVVwVVVVVVUJI',
  'JIVVVVVVTVVUJI',
  'JIVVVVVVVVVUJI',
  'IiVVVVVVVVUUIi',
  'IiUUUUUUUUUuIi',
  '.iuuuuuuuuuui',
]

export const D07: Design = {
  id: 'd07',
  title: 'Mason Guild Elder',
  concept: 'Has cut the gate stones for sixty winters: a bald polished dome, white brows hiding his eyes, the biggest white beard on the mountain, a mallet hanging low.',
  pal: PAL,
  headBottom: 56,
  parts: [
    { id: 'shadow', group: 'feet', x: AT.shadow[0], y: AT.shadow[1], rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: AT.feet[0], y: AT.feet[1], rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: AT.body[0], y: AT.body[1], rows: BODY },
    { id: 'fringe', group: 'head', x: 31, y: 28, rows: FRINGE },
    { id: 'dome', group: 'head', x: 36, y: 20, rows: DOME, squash: [4, 7] },
    { id: 'beard', group: 'head', x: 29, y: 36, rows: BEARD, sags: true },
    { id: 'brows', group: 'head', x: 46, y: 30, rows: BROWS },
    { id: 'moustache', group: 'head', x: 42, y: 37, rows: MOUSTACHE },
    { id: 'nose', group: 'head', x: 58, y: 34, rows: NOSE },
    { id: 'mallet', group: 'prop', x: 63, y: 61, rows: MALLET },
    { id: 'handB', group: 'hands', x: AT.handB[0], y: AT.handB[1], rows: FIST_B },
    { id: 'handF', group: 'hands', x: AT.handF[0], y: AT.handF[1], rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1, nudge: { brows: [0, 1] } },
    { squash: 2, sag: 1, nudge: { brows: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, sag: 1, nudge: { brows: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { brows: [0, 1] } },
    {},
  ],
  idleMs: [300, 160, 180, 280, 160, 220],
  // the back hand comes up onto the beard and strokes it down, twice; the brows lift, fond
  tic: [
    { nudge: { handB: [4, -12] }, squash: 1 },
    { nudge: { handB: [5, -8], brows: [0, -1] }, sag: 1 },
    { nudge: { handB: [5, -3], brows: [0, -1] }, sag: 1 },
    { nudge: { handB: [4, -12], brows: [0, -1] }, squash: 1 },
    { nudge: { handB: [5, -6], brows: [0, -1] }, sag: 1 },
    { nudge: { handB: [3, -1] }, squash: 2, sag: 1 },
  ],
  ticMs: [260, 280, 300, 240, 300, 320],
}
