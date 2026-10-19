/**
 * Brannoch design 08 — the Fur-Hooded Mountain Trader. Hand-authored pixel maps (see brannoch-lib.ts).
 *
 * Walks the high passes between the quarries when the snow closes the cart
 * roads: a deep overcast-blue hood with a thick frost-white fur ruff that
 * swallows his head, only the red nose and a chestnut beard spilling out of
 * it, a hide coat, and a forge
 * lantern swinging low from his fist. Silhouette: one big round hood with a white ring of fur.
 * Tic: the lantern swings, he lifts it to peer at the road, the flame flares.
 */
import type { Design } from './brannoch-lib'
import { AT, FEET, FIST_B, FIST_F, PAL, SHADOW, bell } from './brannoch-common'

const HOOD = [
  '..............NNNNNNNNNNNNNNNN',
  '...........NNNNwwNNNNNNNNNNNNNNNN',
  '.........NNNNwwNNNNNNNnNNNNNNNNNNNN',
  '.......NNNNNwNNNNNNNNNnNNNNNNNNNNNNvv',
  '......NNNNNnNNNNNNNNNNnNNNNNNNNNNNNnvv',
  '.....NNNNNNnNNNNNNNNNNnNNNNNNNNNNNNnnvv',
  '....NNNNNNNnNNNNNNNNNNnNNNNNNNNNnNNnnnvv',
  '...NNNNNNNNnNNNNNNNNNNnNNNNNNNNNnNNnnnnvv',
  '..NNNNNNNNNnNNNNNNNNNnNNNNNNNNNNnNNnnnnnvv',
  '.NNNNNNNNNNnNNNNNNNNNnNNNNNNNNNNnNnnnnnnnvv',
  '.NNNNNNNNNnNNNNNNNNNNnNNNNNNNNNNnNnnnnnnnvv',
  '.NNNNNNNNNnNNNNNNNNNNnNNNNNNNNNnNnnnnnnnnvv',
  'vvNNNNNNNNnNNNNNNNNNnNNNNNNNNNNnNnnnnnnnnnvv',
  'vvNNNNNNNNnNNNNNNNNNnNNNNNNNNNnNnnnnnnnnnnvv',
  'vvNNNNNNNNnNNNNNNNNNnNNNNNNNNNnnnnnnnnnnnnvv',
  'vvNNNNNNNnNNNNNNNNNnNNNNNNNNNvnnnnnnnnnnnnvv',
  'vvNNNNNNNnNNNNNNNNNnNNNNNNNNnvnnnnnnnnnnnvv',
  'vvNNNNNNnNNNNNNNNNnNNNNNNNnnvnnnnnnnnnnnnvv',
  'vvnnNNNNnNNNNNNNNNnNNNNnnnnnvnnnnnnnnnnnvv',
  '.vvnnnnnnNNNNNNNNnNnnnnnnnnvnnnnnnnnnnnvv',
  '.vvvnnnvnnnnnnnnvnnnnnnnnnvnnnnnnnnnnnvv',
  '.vvvnnnvnnnnnnnnvnnnnnnnnnnnnnnnnnnnnvv',
  '.vvvnnvnnnnnnnnvnnnnnnnnnnnnnnnnnnnnvv',
  '..vvvnvnnnnnnnvnnnnnnnnnnnnnnnnnnnvv',
  '..vvvnnnnnnnnnvnnnnnnnnnnnnnnnnnnvv',
  '...vvvnnnnnnnvnnnnnnnnnnnnnnnnnnvv',
  '...vvvnnnnnnnnnnnnnnnnnnnnnnnnvv',
  '....vvvvvvvvvvvvvvvvvvvvvvvvvvv',
  '.....vvvvvvvvvvvvvvvvvvvvvvvv',
  '.....vvvvvvvvvvvvvvvvvvvvvvv',
]

/** The hood's face opening, on its front: deep fur shade with the frost-rimmed edge. */
const OPENING = [
  '......LLLLLLL',
  '....LLLlLLLLLLM',
  '...LLlLLLLLLLLMM',
  '..LLlLLLLLLLLLMMm',
  '.LLLLLMMMMMMLLMMm',
  '.LLLMuuuuuuuuMMMm',
  'LLLMuuuuuuuuuuMMm',
  'LLMuuuuuuuuuuuuMm',
  'LLMuuuuuuuuuuuuMm',
  'LLuuuuuuuuuuuuuMm',
  'LLuuuuuuuuuuuuuMm',
  'LLuuuuuuuuuuuuuMm',
  'MLuuuuuuuuuuuuuMm',
  'MLLuuuuuuuuuuuMMm',
  'MMLuuuuuuuuuuuMm',
  '.MLLuuuuuuuuuMMm',
  '.MMLLuuuuuuuMMm',
  '..MMLLLLLLLLMMm',
  '...mMMMMMMMMmm',
]

const BEARD = [
  '......GGGGGGGGGGGGGGBB',
  '....GGGGGGGGGGGGGGGGGBBB',
  '..GGGGFFFGGGGGGGGGGGGBBBBB',
  '.GGGGFFGGGGGGGGGGGGGGBBBBBB',
  'GGGGFGGGGGGGGGGGGGGGGBBBBBBB',
  'GGGBGGGGGBGGBGGBGGGBGBBBBbBB',
  'GGGBGGBGGBGGBGGBGGGBBBBBBbBb',
  '.GGBGGBGGBGGBGGBGGBBBBBBBbBb',
  '.GGBGGBGGBGGBGGBBBBBBBbBBbb',
  '..BBBBBGGBGBBBBbBBBbBBbBbbb',
  '...BBBBBBBBBBBBbBBBbBBbbbb',
  '.....BBBBbBBbBBbBBBbbbbb',
  '......BBBbBBbBBbbbbbbbb',
  '.......bbbbbbbbbbbbbb',
  '.........bbbbbbbbbb',
  '...........bbbbb',
]

const MOUSTACHE = [
  '...LLLLLLLLLLLL',
  '.LLLllLLLLLLLLLM',
  'LLlLLLLLLLLLLLLMm',
  'MLLLLMMMMMMMLLMMm',
  '.mmm.......mmmm',
]

const NOSE = [
  '.DCC',
  'DCCCc',
  'CCCcc',
  '.ccc',
]

const BODY = bell({ 1: 'V', 2: 'U', 3: 'u', 4: 'b', 5: 'B' })

const BAIL = ['.k.', 'k.k', '.k.']
const LANTERN = [
  '...iIIi',
  '..iIJJIi',
  '.iIIIIIIi',
  'iIiYYYYiIi',
  'iIYwwwyYIi',
  'iIYwwyyYIi',
  'iIyyyyyOIi',
  'iIOOOOOOIi',
  '.iIIIIIIi',
  '..iiiiii',
]
const LANTERN_LIT = [
  '...iIIi',
  '..iIJJIi',
  '.iIIIIIIi',
  'iIiwwwwiIi',
  'iIwwwwwwIi',
  'iIwwwwwYIi',
  'iIYYYYYyIi',
  'iIyyyyyyIi',
  '.iIIIIIIi',
  '..iiiiii',
]

export const D08: Design = {
  id: 'd08',
  title: 'Fur-Hooded Trader',
  concept: 'Walks the high passes when snow shuts the cart roads: a deep blue hood with a frost-white fur ruff, only his nose and beard showing, a forge lantern swung low.',
  pal: PAL,
  headBottom: 57,
  parts: [
    { id: 'shadow', group: 'feet', x: AT.shadow[0], y: AT.shadow[1], rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: AT.feet[0], y: AT.feet[1], rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: AT.body[0], y: AT.body[1], rows: BODY },
    { id: 'hood', group: 'head', x: 28, y: 22, rows: HOOD, squash: [6, 9] },
    { id: 'opening', group: 'head', x: 52, y: 23, rows: OPENING },
    { id: 'beard', group: 'head', x: 48, y: 39, rows: BEARD, sags: true },
    { id: 'moustache', group: 'head', x: 54, y: 36, rows: MOUSTACHE },
    { id: 'nose', group: 'head', x: 60, y: 32, rows: NOSE },
    { id: 'bail', group: 'prop', x: 72, y: 60, rows: BAIL, ring: 0 },
    { id: 'lantern', group: 'prop', x: 70, y: 61, rows: LANTERN },
    { id: 'handB', group: 'hands', x: AT.handB[0], y: AT.handB[1], rows: FIST_B },
    { id: 'handF', group: 'hands', x: AT.handF[0], y: AT.handF[1], rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1, nudge: { opening: [0, 1], nose: [0, 1] } },
    { squash: 2, sag: 1, nudge: { opening: [0, 1], nose: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, sag: 1, nudge: { opening: [0, 1], nose: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { opening: [0, 1], nose: [0, 1] } },
    {},
  ],
  idleMs: [280, 150, 170, 260, 150, 200],
  // the lantern swings out and back, then he lifts it to peer down the road; the flame flares
  tic: [
    { move: { prop: [1, 0] } },
    { move: { prop: [-1, 0] } },
    { move: { prop: [1, -1] }, nudge: { handF: [0, -1] } },
    { move: { prop: [0, -2] }, nudge: { handF: [0, -2] }, swap: { lantern: LANTERN_LIT } },
    { move: { prop: [0, -2] }, nudge: { handF: [0, -2] }, swap: { lantern: LANTERN_LIT }, squash: 1 },
    { move: { prop: [0, -1] }, nudge: { handF: [0, -1] } },
  ],
  ticMs: [180, 180, 160, 260, 260, 180],
}
