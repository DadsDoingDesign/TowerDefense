/**
 * Odile design 03 — the Court Tailor. Hand-authored pixel maps (see odile-lib.ts).
 *
 * She cuts for the river lords: a wide plum velvet tam slouched back over
 * her crown, its padded band stuck with a row of gold-headed pins; rose hair
 * under it, the leaf ears out beneath; a green gown with her measuring
 * ribbon slung round her neck, and the big shears in her fist.
 * Silhouette: a wide soft cap slouched to the back, the ears out under it.
 * Tic: the shears snip the air twice.
 */
import type { Design } from './odile-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, EAR_FAR, EAR_NEAR, CHEEK, HAIR_FLARE, gown, ink } from './odile-common'

const CAP = [
  '',
  '...................iiiiiiiPPP',
  '................iiiiiiiiiiiPPPP',
  '..............iiiwwiiiiiiiiPPPPPPP',
  '.............iiiiiiiiiiiiPiPPPPPPPP',
  '............iiiiiPiiiiiiPiiPPPPPPPPP',
  '...........iiwiiPiiiiiiiPiiPPPPPPPPPP',
  '..........iiwiiPiiiiiiiPiiiPPPPPPPPPPP',
  '.........iiiiiPiiiiiiiPiiiiPPPPPPPPPpPp',
  '........iiiiiiPiiiiiiPiiiiiPPPPPPPPPPpPp',
  '........iijiiPiiiiiiPiiiiiPPPPPPPPPPPPpp',
  '.......iiiiiPiiiiiiiPiiiiiPPPPPPPPPPPPpPp',
  '.......iijiPiiiiiiiPiiiiiiPPPPppPPPPPPPpp',
  '.......iiiiPiiiiiiiPiiiiiPPPPppppPPPPPPPpp',
  '......PPiiiPiiiiiiiPiiiiPPPPPppp..PPPPPPpp',
  '......PPiiiPiiiiiiPiiiiiPPPPPpp...PPPPPPppp',
  '......PPPPiPiiiiiiPiiiPPPPPPPPp....PPPPppp',
  '.....PPPPPPiiiiiiiPiiPPPPPPPPPp....pPppppp',
  '.....PPPPPPPPiiiiiPPPPPPPPPPPPpp....ppppp',
  '.....PPPPPPPPPPPPPPPPPPPPPPPPPpp......p',
  '.....PPPPPppppppppppppppppPPPppp',
  '.....ppppppppppppppppppppppppppp',
  '.....pppppppQQQQQQQQQRRRRRRRpppp',
  '.....ppQQQQQQQQQQQQQQQQQRRRRRRRRR',
  '.....QQQQyOQQQQyOQQQQyOQQQRyORRRRRr',
  '....QQQQQBQQQQQBQQQQQBQQQQRBRRRRRrrr',
  '....rQQQQBQQQQQBQQQQQBQQRRRBRRRrrrrr',
  '.....rrrrrQQQQQQQQQQQRRRRRrrrrrrrrr',
  '......prrrrrrrrrrrrrrrrrrrrrrrrrrp',
  '............rrrrrrrrrrrrrrrr',
]

const TAPE_L = [
  'FE',
  'Fp',
  'FE',
  'FE',
  'Fp',
  'FE',
  'FE',
  'Fp',
  'FE',
  'ee',
]

const TAPE_R = [
  'FE',
  'pE',
  'FE',
  'FE',
  'pE',
  'FE',
  'FE',
  'pE',
  'eE',
]

const SHEARS = [
  'nnn.nnn',
  'n.nNn.n',
  'nnnNnnn',
  '..nNn',
  '..FwEe',
  '..FFEe',
  '..FFEe',
  '..FFEe',
  '..FFEe',
  '..FEe',
  '..FEe',
  '...Ee',
  '...e',
]

const SHEARS_SNIP = [
  'nnn.nnn',
  'n.nNn.n',
  'nnnNnnn',
  '..nNn',
  '.FwEEe',
  '.FFeEe',
  'FFe.Ee',
  'FF..EEe',
  'Fe...Ee',
  'Fe....Ee',
  'F.....Ee',
  '.......e',
]

const HAIR = ink(HAIR_FLARE, { l: 'Q', m: 'R', d: 'r' })
const BODY = gown({ l: 'v', m: 'G', d: 'g', t: 'p' })

export const D03: Design = {
  id: 'd03',
  title: 'Court Tailor',
  concept: 'Cuts for the river lords: a plum velvet tam slouched back, its band stuck with pins, the measuring ribbon round her neck, shears in her fist.',
  pal: PAL,
  headBottom: 53,
  parts: [
    { id: 'shadow', group: 'feet', x: 33, y: 66, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 64, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 38, y: 47, rows: BODY, squash: [9] },
    { id: 'tapeL', group: 'body', x: 45, y: 52, rows: TAPE_L, ring: 1 },
    { id: 'tapeR', group: 'body', x: 53, y: 52, rows: TAPE_R, ring: 1 },
    { id: 'shears', group: 'prop', x: 62, y: 53, rows: SHEARS },
    { id: 'hair', group: 'head', x: 28, y: 41, rows: HAIR, spread: [9, 10, 11, 12] },
    { id: 'cheek', group: 'head', x: 57, y: 45, rows: CHEEK },
    { id: 'earL', group: 'head', x: 17, y: 39, rows: EAR_FAR },
    { id: 'earR', group: 'head', x: 67, y: 37, rows: EAR_NEAR },
    { id: 'cap', group: 'head', x: 30, y: 16, rows: CAP, squash: [9, 14] },
    { id: 'handB', group: 'hands', x: 33, y: 55, rows: FIST_L },
    { id: 'handF', group: 'hands', x: 63, y: 54, rows: FIST_R },
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
  // a tailor's snip: the shears bite the air twice, quick, then she settles
  tic: [
    { swap: { shears: SHEARS_SNIP }, nudge: { handF: [0, -1], shears: [0, -1] } },
    { nudge: { handF: [0, -1], shears: [0, -1] } },
    { swap: { shears: SHEARS_SNIP }, nudge: { handF: [0, -1], shears: [0, -1] } },
    { nudge: { handF: [0, -1], shears: [0, -1] } },
    { squash: 1 },
    {},
  ],
  ticMs: [90, 90, 90, 150, 160, 200],
}
