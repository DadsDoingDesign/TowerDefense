/**
 * Hask design 07 — the Fishmonger. Hand-authored pixel maps (see hask-lib.ts).
 *
 * Cries the eel and the salt-cod on the smokehouse wharf: an oilskin
 * sou'wester, shiny, its long back brim down over his neck; an oilskin apron
 * spangled with scales; two salt-cod hung by the tail, low at his side.
 * Silhouette: a round crown with a long flap behind, a snout in front.
 * Tic: the front cod flips its tail and flicks a drop of brine.
 */
import type { Design } from './hask-lib'
import { PAL, FEET, SHADOW_W, FIST_B, FIST_F, SNOUT, TAIL, TAIL_UP, bell } from './hask-common'

const HAT = [
  '.................666665555544',
  '...............66ww666655555544',
  '..............6ww666666555555544',
  '.............6w666666655555555544',
  '............66w6666666555555554444',
  '............6w66666665555555555444',
  '............6666666655555555555444',
  '............6666666555555555555444',
  '............5666665555555555554444',
  '............5566655555555555554444',
  '............5555555555555555544444',
  '............4444444444444444444444',
  '....66www666666666665555555555555555',
  '..6666665555555555555555555555555555544',
  '444444444444444444444444444444444444444',
  '665555555555555555555544444',
  '65555555555555555555444444',
  '44444444444444444444444444',
  '6555555555555555554444444',
  '555555555555555554444444',
  '.5555555555555544444444',
  '.44444444444444444444',
  '..5555555554444444',
  '...44444444444',
]

const EYE = ['yw']

const BODY = bell({ d: 'l', m: 'b', l: 'L', t: 'l' })

/** The oilskin apron, scales stuck to it. */
const APRON = [
  '...4555556',
  '..445555566',
  '..4555x5556',
  '.44555555566',
  '.4555555x556',
  '4455x5555556',
  '445555555x566',
  '4455555555556',
  '44444444444444',
]

/** A salt-cod hung head-down by its tail. */
const FISH = [
  '....ll',
  '.....l..',
  '.x.....n',
  '.xx...nn',
  '..xxNnn',
  '...xNn',
  '...x6Nn',
  '..x66NNn',
  '..x666Nn',
  '.x6666NNn',
  '.x6666NNn',
  '.x666kNNn',
  '..x66wkNn',
  '..x666Nn',
  '...xx6n',
]
/** The cod's tail flipped up. */
const FISH_FLIP = [
  '....ll',
  '..x..l..n',
  '..xx...nn',
  '...xxNnn',
  '...xxNn',
  '...x6Nn',
  '..x66NNn',
  '..x666Nn',
  '.x6666NNn',
  '.x6666NNn',
  '.x666kNNn',
  '..x66wkNn',
  '..x666Nn',
  '...xx6n',
]
/** The second fish, behind and higher on the cord. */
const FISH2 = [
  'x....n',
  'xx..nn',
  '.xNNn',
  '.x6Nn',
  'x66Nn',
  'x66Nn',
  'x6kNn',
  'x6wNn',
  '.x6n',
]
const DROP = ['6', 'w']

export const D07: Design = {
  id: 'd07',
  title: 'Fishmonger',
  concept: 'Cries the eel and salt-cod on the smokehouse wharf: a shiny oilskin sou’wester with its long back brim over his neck, a scale-spangled apron, two salt-cod hung by the tail, held low.',
  pal: PAL,
  headBottom: 55,
  parts: [
    { id: 'shadow', group: 'feet', x: 22, y: 72, rows: SHADOW_W, ring: 0 },
    { id: 'tail', group: 'back', x: 13, y: 57, rows: TAIL },
    { id: 'feet', group: 'feet', x: 41, y: 69, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 35, y: 56, rows: BODY },
    { id: 'apron', group: 'body', x: 48, y: 58, rows: APRON, ring: 1 },
    { id: 'snout', group: 'head', x: 50, y: 42, rows: SNOUT },
    { id: 'hat', group: 'head', x: 24, y: 27, rows: HAT, squash: [5, 8] },
    { id: 'eye', group: 'head', x: 65, y: 43, rows: EYE, ring: 0 },
    { id: 'handB', group: 'hands', x: 31, y: 60, rows: FIST_B },
    { id: 'fish2', group: 'prop', x: 71, y: 63, rows: FISH2 },
    { id: 'fish', group: 'prop', x: 63, y: 61, rows: FISH },
    { id: 'drop', group: 'fx', x: 62, y: 70, rows: DROP, ring: 0, hidden: true },
    { id: 'handF', group: 'hands', x: 66, y: 60, rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1 },
    { squash: 2, nudge: { snout: [0, 1], eye: [0, 1] }, move: { hands: [0, 1] } },
    { squash: 2, nudge: { snout: [0, 1], eye: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, move: { prop: [0, 1] } },
    {},
  ],
  idleMs: [200, 140, 170, 200, 150, 180],
  tic: [
    { swap: { fish: FISH_FLIP } },
    { swap: { fish: FISH_FLIP }, show: ['drop'], move: { prop: [1, 0] } },
    { show: ['drop'], nudge: { drop: [-2, -2] }, swap: { tail: TAIL_UP } },
    { swap: { fish: FISH_FLIP, tail: TAIL_UP }, show: ['drop'], nudge: { drop: [-3, 1] } },
    { show: ['drop'], nudge: { drop: [-3, 4] } },
    {},
  ],
  ticMs: [140, 140, 160, 140, 200, 240],
}
