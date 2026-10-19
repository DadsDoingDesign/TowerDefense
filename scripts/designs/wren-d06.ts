/**
 * Wren design 06 — the Leaf-hat Sower. Hand-placed pixel maps (see wren-lib.ts).
 *
 * She sows the hidden gardens, and when it rains she picks a leaf off the
 * nearest giant and wears it. Its sides droop past her ears, its tip hangs at
 * the front, the stalk curls up off the crown. A forked straw-brown beard; a burlap seed
 * pouch at her hip. Silhouette: a broad drooping arch with a curl. Tic: she
 * flicks a pinch of seed out in an arc.
 */
import type { Design } from './wren-lib'
import { PAL, SHADOW, FEET, FIST_L, FIST_R } from './wren-common'

const LEAF = [
  '.....................WWWWWWWWWWWW',
  '.................WWiiiWWWWWizWWWWWWWW',
  '..............WWiiiiiVVVVVVVizWWWWWWWVVV',
  '............iiVVVVVVViiiiWWWizWWWWWWWWVVVV',
  '..........WWiwwiiiiiiiiiiiWWWizWWWWWWWWVVVVV',
  '.........iiiiiiiiiiiiiiiiiWWVVzWWWWWWWWVVVVVV',
  '.......WWiiwiiiiiiiiiiiiiiVVWWVVVWWWWWWVVVVVVVV',
  '......WWiiiiiiiiiiiiiiiVVVWWWWWizVVVVVVVVVVVVVVV',
  '.....WWiiiiiiiiiiiiiiVViiWWWWWWizWWWWWWVVVVVVVVVV',
  '.....WiiiiiiiiiiiiiVViiiWWWWWWWWzzWWWWWVVVVVVVVVV',
  '....WiiiiiiiiiiiiiiiiiiiWWWWWWVVizWWWWWVVVVVVVVVVV',
  '...WWiiiiiiiiiiiiiiiiiiWWWWWVVWWWizWWWWVVVVVVVVVVVV',
  '..WWiiiiiiiiiiiiiiiiiiWWWWVVWWWWWWVVVWVVVVVVVVVVVVVV',
  '..WWiiiiiiiiiiiiiiiiiWWWWWWWWWWWWWWiVVVVVVVVVVVVVVVV',
  '..WWiiiiiiiiiiiiiiiiWWWVVWWWWWWWWWWWVVVVVVVVVVVVVVVV',
  '.WWWiiiiiiiiiiiiiiiWWVVWWWWWWWWWWWVVViVVVVVVVVVVVVVVV',
  '.WWWiiiiiiiiiiiiiWWVVWWWWWWWWWWWVVWWVViVVVVVVVVVVVVVV',
  '.WWWiiiiiiiiiiiWWWWWWWWWWWWWWWWWWWWVVVVVVVVVVVVVVVVVV',
  'WWWWWiiiiiiiiWWWWWWWWWWWWWWWWVVWWWWVVVVVVVVVVVVVVVVVVV',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWVVVVVVViVVVVVVVVVVVV',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWVVWWWWWVVVVVVVVViVVVVVVVVVVV',
  'WWW..VVWWWWWWWWWWWWWWWWWVVWWWWWWVVVVVVVVVVViVVVVVVVVVV',
  'WWW...VWWWWWWWWWWWWWWWWWWWWWWWWVVVVVVVVVVVVViVVVVVVVVV',
  'VWWWW..VVVV..WWWW..WWWW..WWWW..VVVV..VVVV..VViVVVVVVVV',
  '.VVVV...pp....WW....WW....WW....VV....VV...VVVV.VVVvVV',
  '..pp........................................pp...VVvVV',
  '..................................................VVV',
  '..................................................pp',
]

const STALK = [
  '.WWV',
  'W..vV',
  'V...V',
  '.V..V',
  '...VV',
  '...V',
  '..VV',
]

const FACE = [
  '............mmNN',
  '...........mwmNNN',
  '..........mmmNNNNn',
  '..........mNNNNNNn',
  '...HHHHhhkNNNNNNnnk',
  '.HHFHHhHhkkNNNNnnkkD',
  'HHHHHhHhhDkknnnnkkDDD',
  '.HHhHhHhhDhkkkkkkhDD',
  '..HHhHhhDhhhDhhhDDD',
  '...HhHhhDhhhDhhDhD',
  '...HhHhDhh.hDhhDD',
  '....HhHDh...hhhD',
  '....HhhD....hhDD',
  '.....HhD.....hhD',
  '.....HD......hhD',
  '......D.......D',
]

const BODY = [
  '......ggjjjjjjjjJJJ',
  '.....ggjjjjjjjjjjJJ',
  '....gggjjjjjjjjjjJJJ',
  '...gggjjjjgjjjjjjjJJ',
  '...gggjjjjgjjjjjjjJJJ',
  '..ddddHdddddddddddddd',
  '..gggjjjjjgjjjjjgjjJJJ',
  '.ggggjjjjjgjjjjjgjjjJJ',
  'gDDDDDDDDDDDDDDDDDDDDg',
  'gggggggggggggggggggggg',
  '..gggggggggggggggggg',
]

const POUCH = [
  '....xx',
  '...xHx',
  '...DhD',
  '..DhHhD',
  '.DhHHhhD',
  'DhHHhhhhD',
  'DhHhhhhDD',
  'DhhhhhDDD',
  '.DDDDDDD',
]

const SEEDS = [
  '.........H',
  '.....h',
  '..H.........H',
  'h',
  '.......h',
]

export const D06: Design = {
  id: 'd06',
  title: 'Leaf-hat Sower',
  concept: 'Sows the hidden gardens: one great leaf laid over her head like a hat, a stalk curling off the crown, a burlap seed pouch held low.',
  pal: PAL,
  headBottom: 62,
  parts: [
    { id: 'shadow', group: 'feet', x: 34, y: 73, rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 72, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 39, y: 62, rows: BODY },
    { id: 'handB', group: 'hands', x: 35, y: 65, rows: FIST_L },
    { id: 'stalk', group: 'head', x: 46, y: 27, rows: STALK, ring: 1, ride: true },
    { id: 'leaf', group: 'head', x: 23, y: 33, rows: LEAF, squash: [8, 11, 14] },
    { id: 'face', group: 'head', x: 43, y: 56, rows: FACE },
    { id: 'pouch', group: 'prop', x: 66, y: 66, rows: POUCH },
    { id: 'handF', group: 'hands', x: 68, y: 63, rows: FIST_R },
    { id: 'seeds', group: 'fx', x: 70, y: 60, rows: SEEDS, ring: 0, hidden: true },
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
  // she flicks the pouch out; a pinch of seed flies off in an arc and falls
  tic: [
    { nudge: { pouch: [-1, 1], handF: [-1, 1] } },
    { nudge: { pouch: [2, 0], handF: [2, 0] }, show: ['seeds'] },
    { nudge: { pouch: [1, 0], handF: [1, 0], seeds: [2, 2] }, show: ['seeds'] },
    { nudge: { seeds: [4, 6] }, show: ['seeds'] },
    {},
  ],
  ticMs: [140, 120, 180, 200, 200],
}
