/**
 * Wren design 04 — the Moss Hermit. Hand-placed pixel maps (see wren-lib.ts).
 *
 * He has lived in one mushroom hollow so long the moss took him for a stone:
 * a shaggy cowl of living moss, lichen crusts, two toadstools on its crown, and
 * a long lichen-white beard. He carries a spore-light low, so as not to wake
 * what grows. Silhouette: a shaggy mound with hanging locks. Tic: he lifts the
 * lantern a hair and its light swells, then sinks.
 */
import type { Design } from './wren-lib'
import { PAL, SHADOW, FEET, FIST_L, FIST_R } from './wren-common'

const MOSS = [
  '.............................J',
  '..........................JJJJJJj',
  '...................JJJJJ.JJJJJJJjj',
  '..................JJJwwJjJJiiPJJjjg',
  '.................JJwJJJJjgJJPiJjjgG',
  '.................JJJJJJjjGJJJJjjjgG',
  '.............JJ..JJJJJJjgGJJJjjjggG....JJ',
  '...........JJJJJJiPJJjjggGJjjjjggGG..JJJJjj',
  '..........JJJJJJiPPijjggGGjjjgggGGG.JJJJJjjg',
  '.........JJJJJJJJPijjggGGGGgggGGGGgJJJJJjjggG',
  '......JJJJJJwJJJjjGGGGGGjjGGGGGGGjgGJJPjjjggG',
  '....JJJJJJJJJJJjjgGJJGjjjggGGGGjjggGJPOjjggGG',
  '...JJJJJJJJJJJjjggGJjjjjggGGJjjjggGGjjjjggGGG',
  '..JJJJJJJJJJjjjggGGjjjgggGGGjjjggGGGjggggGGGGg',
  '..JJJJJJJJgjjjggGGGjggggGGGjjgggGGGGGggGGGGGggG',
  '..JJJJJJJJGGgggGGGGGggGGGGGgggGGGGGjGGGGGGGjggG',
  '..JJJJJiPjjgGGGGGjjGGGGGGJjGGGGGGGjgggGGGGjggGGG',
  '..JJJJJPijjggGJJjjjggGJJjjjgGGGGGjgggGGGGjggGGGG',
  '..JJJJjjjgggGGJjjjggGGjjjjgggGGGggggGGGGGggGGGGGjjg',
  '..jjjjjjgggGGGjjgggGGGgggggGGGGgggGGGGGGggGGGGGjjjggG',
  '.JJGgggggGGGGjgggGGGGJJGGGGGGGGGGGGGGGGGGGGGGGGjjjggGG',
  '.JJJGGGGGGGGGGggGGGGJJJjGGGGGjjGGGGGGGGGGGGGGGjjjggGGG',
  '.JJJJJGGGGJJjGGGGGGJJJjjjggGGjjjggGGGGjGGGGGGjjjggGGGG',
  '.JJJJjjggGjjjgggGGJJjjjjggGGGjgggGGGGGjggGGGGggggGGGGG',
  '.jjjjjggGGjjggGGGGjjjjgggGGGggggGGGGGgggGGGGGgggGGGGGG',
  '.jgjgggGGGgggGGGGjggggggGGGGggGGGGGGGggGGGGGGGGGGGGGGG',
  '.JGGgGGGGGGGGGGGGjgGggGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  '.JJJGGGGJJGGGGGJJjgGGGGGGGGGGGGGGGGGGGGGGGGGjgGGGGGGGG',
  '.JJJjjgGJJjg..JJjjgGjjGGGjjggGGGGGggGGGGGGGjggGG.gggGG',
  'JJJJjggGJjjgG.JjjggGjggGGjjgGG..jggGGGGGGGGggGGGgggGGG',
  '.JJjjgGGjjgGG.jjjgGGggGGGgggGG..ggGGGgggGGGggGGG.gGGGG',
  '.jjjggGGjjgGG.jjggGGgGGGGgGGGG..GGGGGggGGGGgGGGG.GGGGG',
  '.jjggGGjjggGG.jggGGGGGGGGGGGGG..GGGGGGGGGGGgGGGG.GGGGG',
  '.GggGGGjggGG..gggGGGGGGG.GGGG....GGG.GGGGGGGGGGG.GGGGG',
  '.GGGGGGgggGG..GgGGG..GG...........G..GGGGGGGGGGG..GGG',
  '..GGGGgggGGG..GGGGG..................GGGGGGGGGGG..GG',
  '...GG..GGGGG...GGGG...................GGG.GGGGG',
  '.......GGGG.....GG.........................GGGG',
  '........GGG.................................GG',
  '.........G',
]

const SHROOMS = [
  '..bbA',
  '.bwbAA',
  'AbbbAAa......bA',
  'aAAAAaa....bbbAa',
  '...FE.....aAAAa',
  '...FE.......FE',
]

const FACE = [
  '............mmNN',
  '...........mwmNNN',
  '..........mmmNNNNn',
  '..........mNNNNNNn',
  '..UUUUIIIkNNNNNNnn',
  '.UwUUIUIIkkNNNNnn',
  'UUUUUIUIIXkknnnnkk',
  '.UUIUIUIIXIkkkkkk',
  '..UUIUIIXIIIXIIX',
  '...UIUIIXIIIXIXX',
  '...UIUIXIIIXIIX',
  '...UIUIXIIIXIXX',
  '....UIUXIIIXIX',
  '....UIIXIIXIIX',
  '.....UIXIIXIX',
  '.....UIXIIXIX',
  '......UIXIXI',
  '.......IXIX',
  '........IX',
]

const BODY = [
  '......SSttttttttTTT',
  '.....SSttttttttttTT',
  '....SSSttttttttttTTT',
  '...SSSttttStttttttTT',
  '...SSSttttStttttttTTT',
  '..ddddHdddddddddddddd',
  '..SSStttttStttttSttTTT',
  '.SSSStttttStttttStttTT',
  'SooooooooooooooooooooS',
  'SSSSSSSSSSSSSSSSSSSSSS',
  '..SSSSSSSSSSSSSSSSSS',
]

const LOOP = [
  '.dd',
  'd..d',
  'd..d',
]

const LANTERN = [
  '..dxXd',
  '.dxXXXd',
  'dxxxxxxd',
  '.dYwYyd',
  '.dYYYyd',
  '.dyYyyd',
  'dxxxxxxd',
  '.dddddd',
]

const FLARE = [
  '...z.z',
  '.z.....z',
  '..........',
  'z........z',
  '.z......z',
  '...z..z',
]

export const D04: Design = {
  id: 'd04',
  title: 'Moss Hermit',
  concept: 'Lives in a mushroom hollow and grows moss like a coat: a shaggy cowl of living moss with toadstools on its crown, a spore-lantern held low.',
  pal: PAL,
  headBottom: 63,
  parts: [
    { id: 'shadow', group: 'feet', x: 34, y: 73, rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 72, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 39, y: 62, rows: BODY },
    { id: 'handB', group: 'hands', x: 34, y: 65, rows: FIST_L },
    { id: 'moss', group: 'head', x: 23, y: 24, rows: MOSS, squash: [14, 17, 20] },
    { id: 'shrooms', group: 'head', x: 37, y: 22, rows: SHROOMS, ride: true },
    { id: 'face', group: 'head', x: 44, y: 55, rows: FACE },
    { id: 'loop', group: 'prop', x: 71, y: 66, rows: LOOP, ring: 1 },
    { id: 'lantern', group: 'prop', x: 69, y: 69, rows: LANTERN },
    { id: 'handF', group: 'hands', x: 70, y: 64, rows: FIST_R },
    { id: 'flare', group: 'fx', x: 67, y: 67, rows: FLARE, ring: 0, hidden: true },
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
  // he lifts the lantern a hair; its light swells into a ring of motes, then sinks back
  tic: [
    { move: { prop: [0, -1], hands: [0, -1] } },
    { move: { prop: [0, -1], hands: [0, -1], fx: [0, -1] }, show: ['flare'] },
    { move: { prop: [0, -1], hands: [0, -1], fx: [0, -2] }, show: ['flare'] },
    { show: ['flare'], nudge: { flare: [0, -3] } },
    { squash: 1 },
    {},
  ],
  ticMs: [200, 220, 260, 240, 180, 200],
}
