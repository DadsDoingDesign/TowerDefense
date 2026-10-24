/**
 * Wren design 10 — the Hollow Warden. Hand-placed pixel maps (see wren-lib.ts).
 *
 * He wardens the deep hollows where things are let to rot on purpose, and
 * his hat has gone the way of everything there: a broad jade felt, sagging, its
 * crown pinched, lichen crusted on it, toadstools coming up through the brim.
 * A moss-grey beard. He grinds what he gathers in a stone mortar. Silhouette: a
 * broad drooping brim with bumps. Tic: he grinds, a puff of dust lifts.
 */
import type { Design } from './wren-lib'
import { PAL, SHADOW, FEET, FIST_L, FIST_R } from './wren-common'

const HAT = [
  '............................jj',
  '.........................jjjjj....jgg',
  '........................JJJJJJ....jjgg',
  '.......................JJJJJJJ....jjjgg',
  '......................iiJJJJJJJiGjjjjjgg',
  '.....................iiiJJJJJJJiGjjjjjggg',
  '....................JJJJJJJJJJJijGjjjjgggg',
  '....................JJJJJgJJJJjijGjjjjgggg',
  '...................JJJJJJgJJJJjijGjjjjggggg',
  '...................JJJJJJgJJJjjijGjjjgJgggg',
  '..................jJJUJJJgJJJjjjjGjjjggJgggg',
  '..................jJUPUggJJJjjjjjjjjjggggggg',
  '..................jJJUJgjJJjjjjjjjjjgggggggg',
  '.................jjJJJJJjJjjjjjjjjjjggggggggg',
  '.................jjJJJJJgjjjjjjjjjjgggggggggg',
  '.................jjjjJjjgjjjjjjjjjjgggggggggg',
  '.................HHHHHHHHHHHHHHHHHHHHHHHHHHHH',
  '.................hhhhhhhhhhDDDDDDDDDDDDDDDDDD',
  '.............JJJJhhhhhhhhhhDDDDDDDDDDDDDDDDDDDjjj',
  '..........JJJJJJJDDDDDDDDDDDDDDDDDDDDDDDDDDDDDjjgggg',
  '........JJJiiJJJJJJJJJJJJJJJJJjjjjjjjjjjjjjjjjjggggggg',
  '......JJJiJJJJJJJJJJJJJJJJjjjjjjjjjjjjjjjjjjgggggggggggg',
  '.....JJJJJJJJJJJJJJJJjjjjjjjjjjjjjjjjjjjjjggggggggggggggg',
  '...jjUPjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjggggggggggiUggggggggg',
  '..jjjPUijjjjjjjjjjjjjjjjjjjjjjjjjjjggggggggggggUPUg.gggggggg',
  'jjjjjjjj..jjjjjjjjjjjjjjjjjjjjjjggggggggggggggggggg..ggggggggg',
  'jjjjjjjjjjjjj...jjjjjjjjjjjggggggggggggggggggggggggggggggggggg',
  'jjjjjjjjjjjjj.....gggg...gggggg...gggggg.....gg.....gggggggggg',
  'jjjj...j.jjj.......gg......ggg......ggg...............gggg',
  '.jj...................................................gg',
]

const SHROOM_B = [
  '..bbA',
  '.bwbAA..bA',
  'AbbbAAa.bbAa',
  'aAAAAaa.aAAa',
  '..FE.....FE',
  '..FE',
]

const SHROOM_F = [
  '...bbbA',
  '..bwbbAA',
  '.AbbbbAAa',
  '.aAAAAAaa',
  '....FE',
  '....FE',
]

const FACE = [
  '............mmNN',
  '...........mwmNNN',
  '..........mmmNNNNn',
  '..........mNNNNNNn',
  '..UUUUqqqkNNNNNNnn',
  '.UwUUqUqqkkNNNNnn',
  'UUUUUqUqqQkknnnnkk',
  '.UUqUqUqqQqkkkkkk',
  '..UUqUqqQqqqQqqQ',
  '...UqUqqQqqqQqQQ',
  '...UqUqQqqqQqqQ',
  '...UqUqQqqqQqQQ',
  '....UqUQqqqQqQ',
  '....UqqQqqQqqQ',
  '.....UqQqqQqQ',
  '.....UqQqqQqQ',
  '......UqQqQq',
  '.......qQqQ',
  '........qQ',
]

const BODY = [
  '......xxXXXXXXXXIII',
  '.....xxXXXXXXXXXXII',
  '....xxxXXXXXXXXXXIII',
  '...xxxXXXXxXXXXXXXII',
  '...xxxXXXXxXXXXXXXIII',
  '..ddddHdddddddddddddd',
  '..xxxXXXXXxXXXXXxXXIII',
  '.xxxxXXXXXxXXXXXxXXXII',
  'xGGGGGGGGGGGGGGGGGGGGx',
  'xxxxxxxxxxxxxxxxxxxxxx',
  '..xxxxxxxxxxxxxxxxxx',
]

const PESTLE = [
  '.hD',
  'hHD',
  'hDd',
  '.Dd',
  '.Dd',
  '.dd',
]

const MORTAR = [
  'QQQQQQQQQQQ',
  'QUUUqqxxqqqQ',
  'QUUqqqqqqqQQ',
  'QUqqqqqqqqQQ',
  '.QqqqqqqqQQ',
  '..QQqqqQQQ',
  '...QQQQQ',
]

const DUST = [
  '..U',
  'U...q',
  '.q.U',
]

export const D10: Design = {
  id: 'd10',
  title: 'Hollow Warden',
  concept: 'Watches the rot in the deep hollows: a broad sagging felt hat gone green, toadstools and lichen growing on its brim, a mortar and pestle held low.',
  pal: PAL,
  headBottom: 62,
  parts: [
    { id: 'shadow', group: 'feet', x: 34, y: 73, rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 72, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 39, y: 62, rows: BODY },
    { id: 'handB', group: 'hands', x: 35, y: 65, rows: FIST_L },
    { id: 'shroomB', group: 'head', x: 23, y: 43, rows: SHROOM_B },
    { id: 'hat', group: 'head', x: 19, y: 29, rows: HAT, squash: [9, 11, 13] },
    { id: 'shroomF', group: 'head', x: 65, y: 43, rows: SHROOM_F },
    { id: 'face', group: 'head', x: 43, y: 56, rows: FACE },
    { id: 'pestle', group: 'prop', x: 70, y: 63, rows: PESTLE },
    { id: 'mortar', group: 'prop', x: 64, y: 67, rows: MORTAR },
    { id: 'handF', group: 'hands', x: 74, y: 69, rows: FIST_R },
    { id: 'dust', group: 'fx', x: 66, y: 62, rows: DUST, ring: 0, hidden: true },
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
  // he grinds: the pestle works round in the bowl, a puff of dust lifts and thins
  tic: [
    { nudge: { pestle: [-1, 0] } },
    { nudge: { pestle: [-1, 1] } },
    { nudge: { pestle: [1, 1] }, show: ['dust'] },
    { nudge: { pestle: [1, 0] }, show: ['dust'], at: { dust: [68, 58] } },
    { nudge: { pestle: [-1, 0] }, show: ['dust'], at: { dust: [69, 56] } },
    { nudge: { pestle: [-1, 1] } },
    {},
  ],
  ticMs: [140, 140, 140, 180, 200, 160, 200],
}
