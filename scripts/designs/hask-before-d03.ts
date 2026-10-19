/**
 * BEFORE: design 03 on the shared bell tunic, kept only for the bodies
 * before/after card (hask-bodies.ts).
 *
 * Hask design 03 — the Salt-Barge Poleman. Hand-authored pixel maps (see hask-lib.ts).
 *
 * Poles the salt barges down the reed channels to the smokehouses: a broad
 * flat reed cone hat, ribbed and lashed at the peak with a reed tuft, wider
 * than he is; a linen smock with a brine-red sash; the barge pole held low
 * across him in both fists, its foot in the water ahead. Silhouette: a wide
 * low cone over a snout. Tic: he leans in and pushes, the pole slides back.
 */
import type { Design } from './hask-lib'
import { PAL, FEET, SHADOW_W, FIST_B, FIST_F, SNOUT, TAIL, TAIL_DOWN, bell } from './hask-common'

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

const BODY = bell({ d: 'l', m: 'L', l: 'm', t: 'l' }, {
  5: '...lllLLLLLLLLLLLLLLLLLLLmm',
  6: '...pRRRRRRRRRRRRRRRRRRRRRRQ',
  7: '..ppRRRRRRRRRRRRRRRRRRRRRRQ',
  8: '..lllllLLLLLLlLLLLLLLLLlLLmm',
})

/** The sash's knot and tails, hanging at his back hip. */
const SASH = ['pRRp', 'pRQp', '.pR', '.pRp', '..pp']

/** The barge pole: worn wood, dark where the hands go, wet at the foot. */
const POLE = [
  'iiiiii',
  'HHHHHHiiiiii',
  'aaaaaaHHHHHHiiiiii',
  '......aaaaaaHHHHHHiiiiii',
  '............aaaaaaHHHHHHiiiiii',
  '..................aaaaaaHHHHHHiiiiii',
  '........................aaaaaaHHHHHHiiiiii',
  '..............................aaaaaaHHHHHHiiiiii',
  '....................................aaaaaaHHHH56',
  '..........................................aaaaa556',
]

export const D03_SHARED: Design = {
  id: 'd03',
  title: 'Salt-Barge Poleman',
  concept: 'Poles the salt barges down the reed channels: a broad ribbed reed cone wider than he is, a linen smock and brine-red sash, the barge pole held low across him.',
  pal: PAL,
  headBottom: 60,
  parts: [
    { id: 'shadow', group: 'feet', x: 22, y: 72, rows: SHADOW_W, ring: 0 },
    { id: 'tail', group: 'back', x: 13, y: 57, rows: TAIL },
    { id: 'feet', group: 'feet', x: 41, y: 69, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 35, y: 56, rows: BODY },
    { id: 'sash', group: 'body', x: 36, y: 63, rows: SASH, ring: 1 },
    { id: 'snout', group: 'head', x: 50, y: 49, rows: SNOUT },
    { id: 'hat', group: 'head', x: 20, y: 28, rows: HAT, squash: [10, 15] },
    { id: 'eye', group: 'head', x: 65, y: 51, rows: EYE, ring: 0 },
    { id: 'handB', group: 'hands', x: 31, y: 62, rows: FIST_B },
    { id: 'pole', group: 'prop', x: 29, y: 64, rows: POLE },
    { id: 'handF', group: 'hands', x: 55, y: 65, rows: FIST_F },
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
