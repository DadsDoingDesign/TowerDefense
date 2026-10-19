/**
 * Odile design 04 — the Ford Toll-Keeper. Hand-authored pixel maps (see odile-lib.ts).
 *
 * She keeps the stones at Rosethread Ford and takes the toll from every
 * barge: a lily pad for a hat, broad and flat, its rim curling, a rose lotus
 * standing up off it; plum hair, the leaf ears out under the pad; a plum gown
 * with a green belt and a coin purse, the toll lantern hanging low from her
 * fist. Silhouette: a wide flat disc with a bloom on top.
 * Tic: she lifts the lantern for the toll and it burns bright.
 */
import type { Design } from './odile-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, EAR_FAR, EAR_NEAR, CHEEK, HAIR_FLARE, gown, ink, over } from './odile-common'

const PAD = [
  '...................vvvvvvgvvvvv',
  '...........vvvvvvggvvvvvvgvvvvvvggvvGGG',
  '......vvgggvvvvwwvvVVvvvvgvvvvvgvvvvvvvGgggG',
  '....vvvvvvvgVVgvvvvvggvvvgvvvggwBvvvggggGGGGGG',
  '...vvvvvvvwvvvvggggvvvgvvgvvgvvBbgggvvvvGGGGGGGG',
  '.....vvvvvvvvvvvvvvgggggggggggggvvvvvvvGGGGGGGGgg',
  '.....ggggggggggggggggggggggggggggggggggggggggggggg',
  '.G.Gvvvvvvvvvvvvvvvvvgggggvvvvg.GGGGGGGGGGGGGGGgg',
  '.GGGGGGGGGGGGvvvvggggvvgGgGGGGgg.gGGGGGGGGGGGgggg',
  '.ggGGGGGGGGGGGgggGGGGGgGGGgGGGGg..ggGGGGGGGgggggg',
  '...ggggGGGGgggGGGGGGGgGGGGgGGGGg....gGGgggggggg',
  '.....ggggggggggGGGGGgGGGGGgGGGGgg....gggggggg',
  '.........gggggggggggggggggggggggg......gg',
  '.................gggggggggggggggg',
]

const LOTUS = [
  '......jQ',
  '..j...jQR...j',
  '..jQ.jjQRr.jR',
  '...QQjQRRrQR',
  'jj.QjQQRRrRr.Rr',
  '.jQQjQRRRrRrRr',
  '..QQjQRRRRrRr',
  '...QQQRRRRrr',
  '....rRRRRrr',
  '......rrr',
  '.....ggG',
  '.....ggG',
  '.....ggG',
  '.....ggG',
]

const LOTUS_OPEN = [
  '.......j',
  '..j...jQ....j',
  '.jQ...jQR..jR',
  '.jQQ.jjQRr.Rr',
  'jjQQQjQRRrQRr',
  '.jQQjQQRRrRrRr',
  '..jQjQRRRrRrr',
  '...QQjQRRRRr',
  '....QQRRRRr',
  '.....rRRrr',
  '......rrr',
  '.....ggG',
  '.....ggG',
  '.....ggG',
  '.....ggG',
]

const LANTERN = [
  '..uoOu',
  '..uoOu',
  '.uuUUuu',
  '.uUUUUu',
  'uoOOOOOu',
  'uOyywyOu',
  'uOyyyyOu',
  'uOyyyyOu',
  'uOyyyyOu',
  'uoOyyOou',
  'uUUUUUUu',
  '.uuuuuu',
]

/** The lantern burning bright: its brass glass flares to flame. */
const LANTERN_BRIGHT = LANTERN.map((r, i) => (i >= 4 && i <= 9 ? r.replace(/O/g, 'y') : r))

const BELT = [
  'ggggggggggggggggg',
  'gGvvGGGGGGGGGGGGg',
]

const PURSE = [
  '.UU',
  'UOOU',
  'UOOu',
  '.uu',
]

const HAIR = ink(HAIR_FLARE, { l: 'i', m: 'P', d: 'p' })
const BODY = over(gown({ l: 'Q', m: 'R', d: 'r', t: 'g' }), [[3, 7, BELT], [14, 8, PURSE]])

export const D04: Design = {
  id: 'd04',
  title: 'Ford Toll-Keeper',
  concept: 'Takes the toll from every barge at the ford: a lily pad for a hat with a lotus standing up off it, the toll lantern hanging low from her fist.',
  pal: PAL,
  headBottom: 53,
  parts: [
    { id: 'shadow', group: 'feet', x: 33, y: 66, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 64, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 38, y: 47, rows: BODY, squash: [9] },
    { id: 'lantern', group: 'prop', x: 63, y: 58, rows: LANTERN },
    { id: 'hair', group: 'head', x: 28, y: 41, rows: HAIR, spread: [9, 10, 11, 12] },
    { id: 'cheek', group: 'head', x: 57, y: 45, rows: CHEEK },
    { id: 'earL', group: 'head', x: 17, y: 38, rows: EAR_FAR },
    { id: 'earR', group: 'head', x: 68, y: 34, rows: EAR_NEAR },
    { id: 'lotus', group: 'head', x: 40, y: 18, rows: LOTUS, squash: [11] },
    { id: 'pad', group: 'head', x: 25, y: 32, rows: PAD, squash: [6], spread: [6, 7, 8] },
    { id: 'handB', group: 'hands', x: 33, y: 55, rows: FIST_L },
    { id: 'handF', group: 'hands', x: 63, y: 57, rows: FIST_R },
  ],
  idle: [
    {},
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1] } },
    {},
  ],
  idleMs: [190, 130, 150, 200, 130, 170],
  // she holds the lantern out for the toll: it swings out, burns bright, the lotus opens a little
  tic: [
    { nudge: { handF: [1, 0], lantern: [1, 0] } },
    { nudge: { handF: [2, 0], lantern: [3, 0] }, swap: { lantern: LANTERN_BRIGHT } },
    { nudge: { handF: [2, 0], lantern: [3, 0] }, swap: { lantern: LANTERN_BRIGHT, lotus: LOTUS_OPEN } },
    { nudge: { handF: [2, 0], lantern: [3, 0] }, swap: { lotus: LOTUS_OPEN } },
    { nudge: { handF: [1, 0], lantern: [1, 0] } },
    { squash: 1 },
  ],
  ticMs: [110, 140, 260, 220, 120, 180],
}
