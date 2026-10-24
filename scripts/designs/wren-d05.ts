/**
 * Wren design 05 — the Goggle Distiller. Hand-placed pixel maps (see wren-lib.ts).
 *
 * He runs the stills under the big glasshouse and wears the hat he was
 * apprenticed in: a short, dented leather stovepipe with a wide brim, brass
 * goggles pushed up on its band. A round flask of jade brew hangs from his fist.
 * Silhouette: a squat topper over a wide brim. Tic: he swirls the flask and it
 * throws up bubbles.
 */
import type { Design } from './wren-lib'
import { PAL, SHADOW, FEET, FIST_L, FIST_R } from './wren-common'

const HAT = [
  '..................hhhhhhhhhhhhhh',
  '..............hhhhhhhhDDDDDDhhhhhhhh',
  '............hhhDDDDDDDDDDDDDDDDDDDDhhh',
  '............hhDDDDDDDDDDDDDDDDDDDDDDhh',
  '.............DhhDDDDDDDDDDDDDDDDDDhhd',
  '.............Dhwwhhhhhhhhhhhhhhhddddd',
  '.............DhhhhhhdDDDDDDDddddddddd',
  '.............DhhhhhhdDDDDDDhddddddddd',
  '.............DwhhhhhdDDDDDDhddddddddd',
  '.............DDhhhhhhdDDDDDhddddddddd',
  '.............DDhhhhhhdDDDDDhddddddddd',
  '.............DDhhhhhhdDDDDDDhdddddddd',
  '.............DDhhhhhhdDDDDDDhdddddddd',
  '..............DhhhhhDhdDDDDDhddddddd',
  '..............DhhhhhDhdDDDDDhddddddd',
  '..............DddhhhDhdDDDDDhddddddd',
  '..............DhhdddDDDDDDDDdddddddd',
  '..............JJJJJJJJJJJJJJJJJJJJJJ',
  '..............JJJJJjjjjjjjjjjjjjjggg',
  '..............gJJgJjgjjgjjgjjgjjgggg',
  '.............JJJJJJjjjjjjjjjjjjjjgggg',
  '...........hhgggggggggggggggggggggggggD',
  '......hhhhhhhDhhhhhDDDDDDDDDDddddddddDDDdddd',
  '...hhhhhhhhhhDhhhhhDDDDDDDDDDdddddddddddddddddd',
  '.DhhhhhhhhhhhDhhhhhDDDDDDDDDDdddddddddddddddddddd',
  'dDDDDDhhhDDDDDDDDDDDDDDDDDDDDDDDdddddddddddddddddd',
  'dddDDDDDDDDDDDDDDDDDDDDDDDDDDddddddddddddddddddddd',
  '.dddHdDDDDDDDDDDDDDDDDDDDDddddddddddddddddddddHdd',
  '...dddHdHddDDDDDDDDDDDDdddddddddddddddddddHdHdd',
  '......ddddHdddddddddddddddddddddddddddddHddd',
  '...........dddddddddddddddddddddddddddd',
]

const GOGGLES = [
  '.HHHH..HHHH',
  'HuwuuHHuwuuH',
  'HuuTuHhuuTuh',
  'hTTThhhTTThh',
  '.hhh...hhh',
]

const FACE = [
  '............mmNN',
  '...........mwmNNN',
  '..........mmmNNNNn',
  '..........mNNNNNNn',
  '...FFFFEEkNNNNNNnnk',
  '.FFwFFEFEkkNNNNnnkke',
  'FFFFFEFEEekknnnnkkeee',
  '.FFEFEFEEeEkkkkkkEee',
  '..FFEFEEeEEEeEEEeee',
  '...FEFEEeEEEeEEeEe',
  '...FEFEeEE.EeEEee',
  '....FEFeE...EEEe',
  '....FEEe....EEee',
  '.....FEe.....EEe',
  '.....Fe......EEe',
  '......e.......e',
]

const BODY = [
  '......GGSSSSSSSSttt',
  '.....GGSSSSSSSSSStt',
  '....GGGSSSSSSSSSSttt',
  '...GGGSSSSGSSSSSSStt',
  '...GGGSSSSGSSSSSSSttt',
  '..ddddHdddddddddddddd',
  '..GGGSSSSSGSSSSSGSSttt',
  '.GGGGSSSSSGSSSSSGSSStt',
  'GHHHHHHHHHHHHHHHHHHHHG',
  'GGGGGGGGGGGGGGGGGGGGGG',
  '..GGGGGGGGGGGGGGGGGG',
]

const FLASK = [
  '...dDd',
  '...uUu',
  '...uUu',
  '..uuUuu',
  '.uUwUUJu',
  'uUwJJJJju',
  'uUJiiJJju',
  'uJJiJJjju',
  'ujJJJjjgu',
  '.ujjjjgu',
  '..uuuuu',
]

const BUBBLES = [
  '....z',
  '',
  '..z',
  '...P',
  '',
  '.z',
]

export const D05: Design = {
  id: 'd05',
  title: 'Goggle Distiller',
  concept: 'Runs the stills under the glasshouse: a short dented leather stovepipe, brass goggles pushed up on the band, a round flask of jade brew held low.',
  pal: PAL,
  headBottom: 62,
  parts: [
    { id: 'shadow', group: 'feet', x: 34, y: 73, rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 72, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 39, y: 62, rows: BODY },
    { id: 'handB', group: 'hands', x: 35, y: 65, rows: FIST_L },
    { id: 'hat', group: 'head', x: 25, y: 27, rows: HAT, squash: [10, 12, 14] },
    { id: 'goggles', group: 'head', x: 50, y: 43, rows: GOGGLES, ring: 1 },
    { id: 'face', group: 'head', x: 43, y: 56, rows: FACE },
    { id: 'flask', group: 'prop', x: 67, y: 64, rows: FLASK },
    { id: 'handF', group: 'hands', x: 68, y: 62, rows: FIST_R },
    { id: 'bubbles', group: 'fx', x: 69, y: 57, rows: BUBBLES, ring: 0, hidden: true },
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
  // he swirls the flask (a quick side-to-side), the brew throws up bubbles, then settles
  tic: [
    { nudge: { flask: [-1, 0], handF: [-1, 0] } },
    { nudge: { flask: [1, 0], handF: [1, 0] } },
    { nudge: { flask: [-1, 0], handF: [-1, 0] }, show: ['bubbles'] },
    { show: ['bubbles'], nudge: { bubbles: [0, -2] } },
    { show: ['bubbles'], nudge: { bubbles: [0, -4] } },
    {},
  ],
  ticMs: [90, 90, 120, 200, 200, 180],
}
