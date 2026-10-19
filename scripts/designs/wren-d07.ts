/**
 * Wren design 07 — the Foxglove Doser. Hand-placed pixel maps (see wren-lib.ts).
 *
 * She measures the doses, the ones that cure and the ones that do not. Her
 * hat is a foxglove bell, the purple of the flower, its petals flaring at the
 * rim and speckled at the throat, the stalk bent forward with a bud. A white
 * bob, no beard. Silhouette: a bell with a scalloped flare and a crook on top.
 * Tic: she squeezes the dropper and lets one bright drop fall.
 */
import type { Design } from './wren-lib'
import { PAL, SHADOW, FEET, FIST_L, FIST_R } from './wren-common'

const HAT = [
  '...............bbbbbbAAA',
  '.............bbbbbbbbAAAAAa',
  '............bbwwbbbbAAaAAAaa',
  '...........bbbbbbbbAAAaAAaaaa',
  '...........AbwbAAaAAAAaAaaaaaa',
  '...........AbbbbAaAAAAaAaaaaaa',
  '...........AbbbbAaAAAAaAaaaaaa',
  '...........AbbBbaAAAAAaAaaaaaa',
  '...........AbbBbaAAAAAaAaaaaaaa',
  '...........AbBbbaAAAAAaAAaaaaaa',
  '...........AbBbbaAAAAAaAAaaaaaaa',
  '..........AAbBbaAAAAAAaAAaaaaaaa',
  '..........AbBbbaAAAAAAaAAaaaaaaaa',
  '..........AbBbbaAAAAAAaAAAaaaaaaa',
  '..........AbBbbaAAAAAAaAAAaaaaaaaa',
  '.........AAbBbbaAAAAAAaAAAaaaaaaaaa',
  '.........AbBbbabAAAAAAaAAAAaaaaaaaa',
  '........AAbBbbabAAAAAAaAAAAaaaaaaaaa',
  '........AAbBbbabAAAAAAaAAAAaaaaaaaaaa',
  '.......AAbBbbbaAAAAAAAaAAAAAaaaaaaaaaa',
  '...mmm.AAbBbbabAAAAAAAaAAAAAaaaaaaaaaa',
  '.mmmmmcmbbbbbabAAAAAAAaAAAAAAaaaaaaaaaa',
  'mmmcmmmmBbbbbabAAAAAAAaAAAAAAaaaaaaaaaaa',
  'AAAAAAaaa.mmmmmcm.........................bb',
  'AAAAAaaaaammcmmmmB..mmmmcm......bb.....mmmmmcmm',
  'AAAaaaaaAaAAAAAaaaammcmmmmBa.mmmmmcmm.ammcmmmmBm',
  '.aaaaaaaAaAAAAaaaaammmmmmmmaammcmmmmBmaAAAAAAaaaa',
  '...aaa....AAaaaaaaaAAAAAaaaAaAAAAAAaaaaAAAAAaaaaa',
  '..........aaaaaaa..AAAaaaaaAaAAAAAaaaaaAAAaaaaaa',
  '............aaa....aaaaaaaa..AAAaaaaaa.aaaaaaaa',
  '.....................aaaa....aaaaaaaa.....aa',
  '................................aa',
]

const STALK = [
  '.......VWWWV',
  '.....VWWV..VWV',
  '....VWV......VV',
  '...VWV......bAAa',
  '..VWV......bwbAAa',
  '..VW.......bAAAAa',
  '.VWV.......bbAAAa',
  '.VW.........aAAa',
  'VWV..........aa',
  'VW',
]

const HAIR_B = [
  '.wIIX',
  'wIIXX',
  'IIIXX',
  'IIXX',
  '.IXX',
  '..X',
]

const HAIR_F = [
  'XIIw.',
  'XXIIw',
  'XXIII',
  'XXIX',
  'XIX',
  'X',
]

const NOSE = [
  '..mmNN..',
  '.mwmNNN.',
  'mmmNNNNn',
  'mNNNNNNn',
  'NNNNNNnn',
  '.NNNNnn.',
  '..nnnn..',
]

const BODY = [
  '......GGggggggggjjj',
  '.....GGggggggggggjj',
  '....GGGggggggggggjjj',
  '...GGGggggGgggggggjj',
  '...GGGggggGgggggggjjj',
  '..aaaaPaaaaaaaaaaaaaa',
  '..GGGgggggGgggggGggjjj',
  '.GGGGgggggGgggggGgggjj',
  'GbbbbbbbbbbbbbbbbbbbbG',
  'GGGGGGGGGGGGGGGGGGGGGG',
  '..GGGGGGGGGGGGGGGGGG',
]

const DROPPER = [
  '..bbAA',
  '.bwbAAa',
  '.bAAAAa',
  '..aAAa',
  '..dDDd',
  '..uUUT',
  '..uwJT',
  '..uJiT',
  '..uJJT',
  '..uJjT',
  '...uT',
  '...uT',
  '....T',
]

const SQUEEZE = [
  '..bbAAa',
  '.bAAAAAa',
  '..aAAAa',
  '..dDDd',
  '..uUUT',
  '..uwJT',
  '..uJiT',
  '..uJJT',
  '..uJjT',
  '...uT',
  '...uT',
  '....T',
]

const DROP = [
  '.z',
  'zPP',
  'PPO',
  '.O',
]

export const D07: Design = {
  id: 'd07',
  title: 'Foxglove Doser',
  concept: 'Measures the doses that cure or kill: a foxglove bell for a hat, petals flaring, speckled inside, a dropper of green held low.',
  pal: PAL,
  headBottom: 62,
  parts: [
    { id: 'shadow', group: 'feet', x: 34, y: 73, rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 72, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 39, y: 62, rows: BODY },
    { id: 'handB', group: 'hands', x: 35, y: 65, rows: FIST_L },
    { id: 'hat', group: 'head', x: 27, y: 29, rows: HAT, squash: [11, 14, 17] },
    { id: 'stalk', group: 'head', x: 48, y: 21, rows: STALK, ring: 1, ride: true },
    { id: 'hairB', group: 'head', x: 36, y: 58, rows: HAIR_B, ring: 1 },
    { id: 'hairF', group: 'head', x: 61, y: 58, rows: HAIR_F, ring: 1 },
    { id: 'nose', group: 'head', x: 53, y: 56, rows: NOSE },
    { id: 'dropper', group: 'prop', x: 65, y: 64, rows: DROPPER },
    { id: 'handF', group: 'hands', x: 66, y: 70, rows: FIST_R },
    { id: 'drop', group: 'fx', x: 68, y: 77, rows: DROP, ring: 0, hidden: true },
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
  // she squeezes the bulb; one bright drop gathers at the tip and falls
  tic: [
    { swap: { dropper: SQUEEZE }, at: { dropper: [65, 65] } },
    { swap: { dropper: SQUEEZE }, at: { dropper: [65, 65] }, show: ['drop'] },
    { show: ['drop'], nudge: { drop: [0, 2] } },
    { show: ['drop'], nudge: { drop: [0, 4] } },
    {},
  ],
  ticMs: [200, 220, 120, 120, 240],
}
