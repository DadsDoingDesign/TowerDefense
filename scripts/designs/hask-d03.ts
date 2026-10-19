/**
 * Hask design 03 — the Salt-Barge Poleman. Hand-authored pixel maps (see hask-lib.ts).
 *
 * Poles the salt barges down the reed channels to the smokehouses: a broad
 * flat reed cone hat, ribbed and lashed at the peak with a reed tuft, wider
 * than he is; a linen smock with a brine-red sash; the barge pole held low
 * across him in both fists, its foot in the water ahead. Silhouette: a wide
 * low cone over a snout. Tic: he leans in and pushes, the pole slides back.
 */
import type { Design } from './hask-lib'
import { PAL, FEET, SHADOW_W, SNOUT, TAIL, TAIL_DOWN } from './hask-common'

const HAT = [
  '..........................vVv',
  '.........................gvVvg',
  '..........................pRp',
  '..........................OOOoh',
  '.........................OOOOoHh',
  '.......................OOuOOOooHHh',
  '.....................OOoOooOOOHHohHh',
  '....................OuoOoOoOOOHoHHhhh',
  '..................OOuoOoOOoOOOHooHHhHhh',
  '................OOOoOOoOOoOOOOoHooHoHhHhh',
  '...............OOuoOOoOOOoOOOOOHoooHHHhHhh',
  '.............OOOOoOOOoOOoOOOOOOoHooHoHHhHhhh',
  '............OOuOoOOOoOOOoOOOOOOoHoooHoHHhHhhh',
  '..........OOOOoOOOOoOOOoOOOOOOOooHoooHoHHHhHhhh',
  '........OOOuOoOOOOoOOOOoOOOOOOOOoHooooHoHHHhHHhhh',
  '.......OOOOOoOOOOoOOOOOoOOOOOOOOoHoooooHoHHHhHHhhh',
  '.....OOOuOOoOOOOoOOOOOoOOOOOOOOOooHoooooHoHHHhHHhhhh',
  '...OOOOOOoOOOOOOoOOOOOoOOOOOOOOOooHoooooHooHHHHhHHhhhh',
  '..OOuOOOoOOOOOOoOOOOOoOOOOOOOOOOOooHoooooHooHHHHhHHhhhh',
  'OOOOOOOoOOOOOOoOOOOOOoOOOOOOOOOOOooHooooooHooHHHHhHHHhhhh',
  'ooooooooooooooooooooooooooooooooooooooooooooHHHHHHHHHhhhh',
  '.hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
]

const EYE = ['yw']

const SMOCK = [
  '........666665554',
  '......66666666555554',
  '.....6666ww66655555544',
  '....666w666666555555544',
  '...666w66666665555555444',
  '...6666666666655555555444',
  '..66666666666665555555444',
  '..666666666666655555554444',
  '..666666666666655555554444',
  '..666666666666665555554444',
  '..OuOOuOOuOOuOOuOOuOuOOOOo',
  '..oOooOooOooOooOooOooooooH',
  '..6666666566666664555O5444',
  '.5555555w555555565455oO5444',
  '.555555w45555555564555o5444',
  '5555556545555555554555555444',
  '5555556455555555556455554444',
  '4mL44Lmm444Lm444mLm444mL44Lm4',
  '.Lmm.4mL4.44m4.44mm4.44mmL44',
]

/** His near arm, bare and scaled, one piece from shoulder to fist, gripping the pole (the far arm is behind him). */
const ARM_F = [
  'GGv',
  'gGvV',
  'gGGv',
  '.gGvG',
  '.gGvVv',
  '.gGvVVv',
  '.gGGvvV',
  '.zgGGGg',
  '..zggg',
]

/** Bare reptile legs under the hem: short, thick, scaled. */
const LEGS = [
  'gGGvv....gGvvV',
  'gGGvv....gGvvV',
  'gGvGv....gGvGv',
  'gGGGg....gGGGv',
  'gGvGg....gGvGg',
  'zgGgg....zgGGg',
  '.zgg......zgg',
]

/** The barge pole: worn wood, dark where the hands go, wet at the foot. */
const POLE = [
  'Hi',
  'aHHi',
  '..aaHHi',
  '....aaHHi',
  '......aaHHi',
  '........aaHHi',
  '..........aaHHi',
  '............aaHHi',
  '..............aaHHi',
  '................aaHHi',
  '..................aaHHi',
  '....................aaHHi',
  '......................aaHHi',
  '........................aaHHi',
  '..........................aaHHi',
  '............................aaHHi',
  '..............................aaHHi',
  '................................aaHHi',
  '..................................aaHHi',
  '....................................aaHHi',
  '......................................aaHHi',
  '........................................aaHHi',
  '..........................................aaHHi',
  '............................................aaHHi',
  '..............................................aa556',
  '................................................aa556',
  '...................................................556',
]

export const D03: Design = {
  id: 'd03',
  title: 'Salt-Barge Poleman',
  concept: 'Poles the salt barges down the reed channels: a broad ribbed reed cone wider than he is, a linen smock and brine-red sash, the barge pole held low across him.',
  pal: PAL,
  headBottom: 48,
  parts: [
    { id: 'shadow', group: 'feet', x: 21, y: 70, rows: SHADOW_W, ring: 0 },
    { id: 'tail', group: 'back', x: 12, y: 59, rows: TAIL },
    { id: 'feet', group: 'feet', x: 40, y: 67, rows: FEET, ring: 0 },
    { id: 'pole', group: 'prop', x: 29, y: 44, rows: POLE },
    { id: 'legs', group: 'feet', x: 41, y: 59, rows: LEGS },
    { id: 'smock', group: 'body', x: 33, y: 41, rows: SMOCK },
    { id: 'snout', group: 'head', x: 50, y: 36, rows: SNOUT },
    { id: 'hat', group: 'head', x: 20, y: 14, rows: HAT, squash: [10, 15] },
    { id: 'eye', group: 'head', x: 65, y: 38, rows: EYE, ring: 0 },
    { id: 'armF', group: 'hands', x: 55, y: 53, rows: ARM_F },
  ],
  idle: [
    {},
    { squash: 1 },
    { squash: 2, nudge: { snout: [0, 1], eye: [0, 1] }, move: { hands: [0, 1] } },
    { squash: 2, nudge: { snout: [0, 1], eye: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, move: { prop: [0, 1] } },
    {},
  ],
  idleMs: [220, 160, 180, 220, 160, 200],
  tic: [
    { move: { head: [1, 0], body: [1, 0], hands: [1, 0], prop: [1, 0] } },
    { move: { head: [2, 1], body: [1, 0], hands: [2, 0], prop: [1, 0] }, squash: 1 },
    { move: { head: [2, 1], body: [1, 0], hands: [2, 0], prop: [-1, 1] }, squash: 1, swap: { tail: TAIL_DOWN } },
    { move: { head: [1, 0], body: [1, 0], hands: [1, 0], prop: [-2, 1] }, swap: { tail: TAIL_DOWN } },
    { move: { prop: [-1, 0] } },
    {},
  ],
  ticMs: [160, 180, 260, 220, 180, 200],
}
