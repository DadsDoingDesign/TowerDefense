/**
 * BEFORE: design 03 as first refined (the hat sat behind his skull), kept only
 * for the hat-centring before/after card (hask-d03-final.ts).
 *
 * Hask design 03 — the Salt-Barge Poleman (the designer's pick: "hask 1 is my
 * favorite but also still needs refinement"). Hand-authored pixel maps (see hask-lib.ts).
 *
 * Poles the salt barges down the reed channels to the smokehouses: a broad
 * ribbed reed cone, woven in courses and lit along its slope and rolled brim;
 * his own body, leaning into the stroke: a short oilcloth smock, a rope belt,
 * a hem crusted with salt; bare scaled arm and legs in a stride; the barge
 * pole in both fists, the far one high behind his back, the near one low at
 * his hip, its foot in the water ahead. Silhouette: a wide cone over a
 * snout, a smock leaning on a pole.
 * Idle: the poling breath (he leans in, settles onto his legs, the pole
 * follows). Tic: a full stroke: he draws the pole up, plants it, drives
 * forward (the hit lands on the third frame), the water splashes, he recovers.
 */
import type { Design } from './hask-lib'
import { PAL, SHADOW_W, TAIL, TAIL_DOWN, TAIL_UP } from './hask-common'

const HAT = [
  '..........................vVv',
  '.........................gvVvg',
  '..........................pRp',
  '..........................uOOoh',
  '.........................uOOOohh',
  '.......................uOuOOOoohhh',
  '.....................uOoOooOOOHHohhh',
  '....................uuoOoOoOOOHoHHhhh',
  '..................uOOooHooooOohHHHhhhhh',
  '................uOOoOOoOOoOOOOoHooHoHhhhh',
  '...............uOuoOOoOOOoOOOOOHoooHHHhhhh',
  '.............uOOOoOOOoOOoOOOOOOoHooHoHHhHhhh',
  '............uouoooooHOoOHoooOoOHhHHohohhhhhhh',
  '..........uuOOoOOOOoOOOoOOOOOOOooHoooHoHHHhHhhh',
  '........uuOuOoOOOOoOOOOoOOOOOOOOoHooooHoHHHhHHhhh',
  '.......uOOOOoOOOOoOOOOOoOOOOOOOOoHoooooHoHHHhHHhhh',
  '.....uuOOOooooooooOoooHOoOooooOooHhHHoHohHhhHhHhhhhh',
  '...uuOOOOoOOOOOOoOOOOOoOOOOOOOOOooHoooooHooHHHHhHHhhhh',
  '..uOuOOOoOOOOOOoOOOOOoOOOOOOOOOOOooHoooooHooHHHHhHHhhhh',
  'uuOOOOOoOOOOOOoOOOOOOoOOOOOOOOOOOooHooooooHooHHHHhHHHhhhh',
  'uuOOuOOOuOOOuOOOuOOOuOOOuOOOuOooooooooooooooHHHHHHHHHhhhh',
  '.hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
]

/** The snout, in the shadow of the brim: its top a step darker than the shared snout. */
const SNOUT_SHADED = [
  '..gGGGGGGGGGg.gGvG',
  '.gGGGGGGGGGGGGgGGGv',
  'gGGGGGGGGvGGGGvGGGGvv',
  'gGvvvvvvvvGvvvvGvvVvvVV',
  'gGGvvvvvvvvvvvvvvvvGvvvVv',
  'zgGGGGGGGGGGGGGGGGGGGGgvV',
  'zggGGGggGGGGGGggGGGGGGGGG',
  'zzggGGGGGGGGGGGGGGGGgGGGg',
  '.zzzgggggzzzzzzzzzzzzzzz',
  '..zzggggzCCCCdCCCCCdCCCc',
  '....zzzzzcccccccccccc',
]

const EYE = ['yw']

/** The short oilcloth smock, leaning into the stroke (shoulders ahead of the hem): collar in the cone's shadow, rope belt, salt-crusted hem. */
const SMOCK = [
  '.............555444444',
  '..........55555554444444',
  '.........66666666555555544',
  '........666ww66655555555444',
  '.......66w666666555555554444',
  '......66w6666666555555555444',
  '.....66666666666555555555444',
  '.....666666666665555555544444',
  '.....666666666666555555544444',
  '....uOOuOOuOOuOOuOOuOOuuOOoo',
  '....OooOooOooOooOooOooOoooHH',
  '....66666656666656455555O444',
  '..5555556455555556455555oO44',
  '..5L5555w5555555554555L55o44',
  '.555555w45555LL55564555554444',
  '.5555L64555L55555564L55544444',
  '44mw4444mm44444m44444mw444m44',
  '.mLmLmmLmLmmLmLmmLmLmmLmLmmL',
]

/** His near arm, bare and scaled (paired light and dark dashes), one piece from the shoulder to the fist wrapped round the pole. */
const ARM_F = [
  'gGG',
  'gGvV',
  '.gGvG',
  '.gGGv',
  '..gGvV',
  '..gGvVv',
  '.gGvVVv',
  '.gGgvgV',
  '.gGGvvv',
  '.zgGGGg',
  '..zggg',
]
/** The far fist, high on the pole behind his back (its arm is behind the body). */
const GRIP_FAR = [
  '.gGG',
  'gGGvv',
  'gGgvG',
  'zgGGg',
  '.zgg',
]

/** Bare legs in a stride: the far leg planted under him, the near one stepping into the push; scales in paired dashes, the tops in the hem's shadow. */
const LEGS = [
  'gGGGg......gGGGg',
  'zgGGg......zgGGgg',
  'gGvGv......gGvGvg',
  'gGGvV.......gGGvV',
  'gGvGv.......gGvGvv',
  'gGGvV........gGGvV',
  '.gGvG........gGvGv',
  '.gGGg........gGGvV',
  '.zgvg.........gGvg',
  '..zg..........zgGg',
  '...............zg',
]
/** Ink stub feet, the near one a step ahead. */
const FEET = [
  'kkkkkk',
  'kkkkkk........kkkkkk',
  '.kkkkk........kkkkkk',
  '.kkkk.........kkkkkk',
  '..kkk..........kkkkk',
  '...............kkkk',
  '...............kkk',
]

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
  '..............................................aaHHi',
  '................................................aaHHi',
  '..................................................aaHHi',
  '....................................................aa556',
  '......................................................aa556',
  '.........................................................556',
]

/** Brine thrown up where the pole bites: small, then flung. */
const SPLASH = ['..w...', '.w..6.', '6.w6.6', '.6666.']
const SPLASH2 = ['w...w..6', '..w...6.', '.6..w6..', '6.w..6.w', '.66666.', '..666']

export const D03_REFINED: Design = {
  id: 'd03',
  title: 'Salt-Barge Poleman',
  concept: 'Poles the salt barges down the reed channels: a broad ribbed reed cone, a short oilcloth smock leaning into the stroke, a rope belt and a salt-crusted hem, bare scaled legs in a stride, the pole in both fists.',
  pal: PAL,
  headBottom: 48,
  parts: [
    { id: 'shadow', group: 'feet', x: 21, y: 69, rows: SHADOW_W, ring: 0 },
    { id: 'tail', group: 'back', x: 12, y: 57, rows: TAIL },
    { id: 'feet', group: 'feet', x: 40, y: 66, rows: FEET, ring: 0 },
    { id: 'legs', group: 'feet', x: 40, y: 56, rows: LEGS },
    { id: 'pole', group: 'prop', x: 22, y: 40, rows: POLE },
    { id: 'smock', group: 'body', x: 31, y: 41, rows: SMOCK },
    { id: 'snout', group: 'head', x: 52, y: 36, rows: SNOUT_SHADED },
    { id: 'hat', group: 'head', x: 21, y: 14, rows: HAT, squash: [10, 15] },
    { id: 'eye', group: 'head', x: 67, y: 38, rows: EYE, ring: 0 },
    { id: 'gripFar', group: 'hands', x: 25, y: 41, rows: GRIP_FAR },
    { id: 'armF', group: 'hands', x: 57, y: 49, rows: ARM_F },
    { id: 'splash', group: 'fx', x: 77, y: 64, rows: SPLASH, ring: 0, hidden: true },
    { id: 'splash2', group: 'fx', x: 75, y: 60, rows: SPLASH2, ring: 0, hidden: true },
  ],
  // the poling breath: he leans in and settles onto his legs, the pole follows a frame late
  idle: [
    {},
    { squash: 1, move: { body: [1, 0], hands: [1, 0], head: [1, 0] } },
    { squash: 2, nudge: { snout: [0, 1], eye: [0, 1] }, move: { body: [1, 1], hands: [1, 1], head: [1, 0] } },
    { squash: 2, nudge: { snout: [0, 1], eye: [0, 1] }, move: { body: [1, 1], hands: [1, 1], head: [1, 0], prop: [1, 1] } },
    { squash: 1, move: { body: [1, 0], hands: [1, 0], prop: [1, 1] } },
    {},
  ],
  idleMs: [260, 180, 200, 300, 200, 240],
  // the stroke: draw up, plant, DRIVE (the hit on the third frame), hold with the splash, recover
  tic: [
    { move: { head: [-1, 0], body: [-1, 0], hands: [-1, 0], prop: [-2, 0] }, swap: { tail: TAIL_UP } },
    { move: { hands: [0, 0] }, show: ['splash'] },
    { squash: 1, move: { head: [2, 1], body: [2, 1], hands: [2, 1], prop: [-2, 1] }, swap: { tail: TAIL_DOWN }, show: ['splash2'] },
    { squash: 2, nudge: { snout: [0, 1], eye: [0, 1] }, move: { head: [2, 1], body: [2, 1], hands: [2, 1], prop: [-2, 1] }, swap: { tail: TAIL_DOWN }, show: ['splash2'], at: { splash2: [72, 58] } },
    { squash: 1, move: { head: [1, 0], body: [1, 0], hands: [1, 0], prop: [-1, 0] } },
    {},
  ],
  ticMs: [200, 100, 140, 340, 220, 240],
}
