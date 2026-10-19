/**
 * Odile design 05 — the Silk Courier. Hand-authored pixel maps (see odile-lib.ts).
 *
 * She runs the samples up the river roads before the barges arrive: a deep
 * rose silk hood, its peak tipped back, falling into a wide capelet; the face
 * in its shade but for the nose; slits let the leaf ears out; a green gown,
 * and a linen-wrapped silk parcel tied in green at her hip.
 * Silhouette: a tall soft hood over a wide cape, the ears out flat.
 * Tic: the ears twitch up at a sound behind her; she hitches the parcel up.
 */
import type { Design } from './odile-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, EAR_FAR, EAR_NEAR, gown, over } from './odile-common'

const HOOD = [
  '................QQ',
  '..............QQQQQQQ',
  '.............QQwQQQQQQQ',
  '.............QQRQQQQQQQQQ',
  '.............QQQQQRQQQQQQQQQ',
  '..............jQQQRQQQQQQQQQQ',
  '..............jQQRRQQQQQRQQQQR',
  '..............jQQRQQwQQQRQQQQRR',
  '..............QQQRQQQQQQRQQQQQRR',
  '.............jQQwwQRQQQQRQQQQRRRR',
  '.............jQQQRQQQQQQRQQQQRRRRr',
  '............jQjQQRQQQQQQRQQQQQQQQQQQ',
  '............jQQQRQQQRQQQRQQQQQQQppppQQ',
  '............jwQQRQQQQQQQRQQQQQppppppppQ',
  '...........QjjQQRQQQQQQQRQQQQpppppkkkpp',
  '...........QjQQQRQQQQRQQRQQQQpppkkkkkkkQ',
  '...........QjQQQRQQQQQQQRQQQppppkkkkkkkp',
  '...........QjQQQRQQQQQQQRQQQpppkkkkkkkkk',
  '...........QjQQQRQQQQRQQRQQQpppkkkkkkkkkQ',
  '...........QjQQQRQQQQQQQQQQQpppkkkkkkEFFQ',
  '...........QjQQRQQQQQQQQQRQQpppkkkkkkkEEF',
  '..........RQjQQRQQQQQQQQQRQQpppkkkkkkEEE',
  '........QQRRRQQRQQQQQQQQQRQQpppkkkkkeEEk',
  '.......QQQRRRRQRQQQQQQQQRRRQQpppkkkkkek',
  '.......QQQRRRRRRQQQQQQRRRRRQQpppkkkkkkk',
  '......QQQQrrRRRRRRRRRRRRRRRRQQppppkkkpRr',
  '......QQjjrrrRRRRRRRRRRRRRRRRRQQpppprRRr',
  '.....QQQQQQrQQrRRRRRRRRRRRRRRrrrrrrrrrRrr',
  '....QQQQQQQrQQQrrrRRRRRRRRrrrrrrrRRRQrRRr',
  '....QQQQQQrQQQQQQrrrrrrrrrrrrrrQrRRRRQrRr',
  '...QQQQQQQrQQQQQrQQQrrrrrrrrRRRQrRRRRQrRRr',
  '...RQQQQQQrQQQQQrQQQQQQQrRRRRRRQrRRRRQrRRr',
  '..RRRRQQQrQQQQQQrQQQQQRQrRRRRRRQrRRRRQrRRRr',
  '..RRRRRRQrQQQQQQrQQRRRRRQrRRRRRRQrRRRRQrRRr',
  '.RRRRRRQrRRRRRRQrRRRRRRRQrRRRRRRQrRRRRQrRrrr',
  '.RRRRRRQrRRRRRRQrRRRRRRRQrRRRRRRQrRRRRQrRrrr',
  '..RRRRRQrRRRRQQrRRRQRRRRQrRRRRRQQrRRRQQrRrr',
  '.RRQrrQrRQrrRRQrrrRRRQrrQrRQrrRRRQrrRRRQrrr',
  '.rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
  '..rrrr..rrrr..rrrr..rrrr..rrrr..rrrr..rrrr',
]

const PARCEL = [
  '....vGg.vGg',
  '...vVvGvVvGg',
  'FFFFFvGgEFFEe',
  'FwFFFFvGEFEEe',
  'FFFFFFvGFEEEe',
  'vvvvvvvGGGGgg',
  'GGGGGGvGgggg',
  'FFFFFFvGEEEEe',
  'FFFFFEvGEEEee',
  'EEEEEEvGEEeee',
  'eeeeeeeeeeeee',
]

const BELT = [
  'ppppppppppppppp',
  'pPPPPPPPPPPPPPp',
]

const BODY = over(gown({ l: 'v', m: 'G', d: 'g', t: 'p' }), [[4, 8, BELT]])

export const D05: Design = {
  id: 'd05',
  title: 'Silk Courier',
  concept: 'Runs the samples up the river roads ahead of the barges: a deep rose hood with slits for the ears, a wrapped silk parcel at her hip.',
  pal: PAL,
  headBottom: 53,
  parts: [
    { id: 'shadow', group: 'feet', x: 33, y: 66, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 64, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 38, y: 47, rows: BODY, squash: [9] },
    { id: 'earR', group: 'head', x: 61, y: 27, rows: EAR_NEAR },
    { id: 'hood', group: 'head', x: 26, y: 14, rows: HOOD, squash: [13, 18], spread: [35, 36, 37, 38] },
    { id: 'earL', group: 'head', x: 21, y: 32, rows: EAR_FAR },
    { id: 'parcel', group: 'prop', x: 56, y: 54, rows: PARCEL },
    { id: 'handB', group: 'hands', x: 33, y: 55, rows: FIST_L },
    { id: 'handF', group: 'hands', x: 64, y: 54, rows: FIST_R },
  ],
  idle: [
    {},
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1] } },
    {},
  ],
  idleMs: [190, 130, 150, 200, 130, 170],
  // a courier's ear for the road behind: the ears twitch up, then she hitches the parcel higher
  tic: [
    { nudge: { earL: [-1, -1], earR: [1, -1] } },
    { nudge: { earL: [-1, -2], earR: [1, -2] }, squash: 1 },
    { nudge: { earL: [-1, -1], earR: [1, -1] } },
    { nudge: { parcel: [0, -2], handF: [0, -2] } },
    { nudge: { parcel: [0, -1], handF: [0, -1] } },
    {},
  ],
  ticMs: [100, 200, 100, 140, 120, 200],
}
