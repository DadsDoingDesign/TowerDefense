/**
 * Saffra design 05 — the Spice-Road Traveller. Hand-authored pixel maps (see saffra-lib.ts).
 *
 * She walked the long road east for the seed of the first pepper fields: a
 * tall wound turban of harvest gold with a ruby brooch and a cream plume, a
 * fringed ember shawl over her shoulders, and a staff on her shoulder with
 * her bindle swinging from its tip. Silhouette: a tall egg of a turban with a
 * diagonal staff and bundle behind. Tic: she hitches the staff, the bindle
 * bounces, the plume nods.
 */
import type { Design } from './saffra-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, bell } from './saffra-common'

const TURBAN = [
  '...............oOgggwggOo',
  '............ooOgggBBggggOOoo',
  '..........ooOgggggBggggggOOOoo',
  '.........ooOOgggggggggggggOOOOoo',
  '........ooOOggggggggggggggOOOOOoo',
  '.......oooOOggggggggggggggOOOOOOoo',
  '......ooooooooOOggggggggggggOOOOOoo',
  '......rRRRRRRRooooooooggggggggOOOOoo',
  '.....rrRRQQQQQQQRRRRRRooooooooggOOoo',
  '.....rrRRRQQQQQQQQRRRRRRRRRRRRoooooo',
  '....rrRRRRRRRRQQQQQQQQRRRRRRRRRRRRRrr',
  '....rrrrrrrrRRRRRRRRRRRRRRRRRRRRRRRrr',
  '....oOOgggggrrrrrrrrRRRRRRRRRRRRRRRrr',
  '...ooOOgggggggggggggrrrrrrrrRRRRRRRRrr',
  '...ooOOgggggggggBBggggggggggrrrrrrrrrr',
  '...ooOOOggggggggggggggggggggggggOOOOoo',
  '...ooooooooOggggggggggggggggggggOOOOoo',
  '...rrRRQQQQooooooooggggggggggggggOOOOoo',
  '...rrRRQQQQQQRRRRRRooooooooggggggOOOOoo',
  '...rrRRQQQQQQQQQRRRRRRRRRRRooooooooooo',
  '...rrRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRrr',
  '....rrrrrrrRRRRRRRRRRRRRRRRRRRRRRRRrr',
  '....oOOggggrrrrrrrrRRRRRRRRRRRRRRRRrr',
  '....oOOggggggggggggrrrrrrrrRRRRRRRRrr',
  '.....ooOOggggggggggggggggOOrrrrrrrrr',
  '......oooOOOOOOOOOOOOOOOOOOOOOOOooo',
]

const PLUME = [
  '....mm',
  '...mLLm',
  '..mLLl',
  '.mLLl',
  '.mLl',
  'mLLl',
  'mLl',
  'mLl',
  '.mL',
  '.mL',
  '..L',
  '..l',
]

const SHAWL = [
  '......rrRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRQQ',
  '....rrRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRQQ',
  '...rrrRRRRRRRRRrRRRRRRRRRRRRRRRRrRRRRRRRRRRRRRQ',
  '..rrrRRRRRRRRrRRRRRRRRRRRRRRRRRRRrRRRRRRRRRRRRQ',
  '.rrrRRRRRRRRrRRRRRRRRRRRRRRRRRRRRrRRRRRRRRRRRRQQ',
  'rrrrRRRRRRRrRRRRRRRRRRRRRRRRRRRRRrRRRRRRRRRRRRQQ',
  'rrrrRRRRRRrRRRRRRRRRRRRRRRRRRRRRRrRRRRRRRRRRRRQQ',
  'rrrrrRRRRRrRRRRRRRRRRRRRRRRRRRRRRrRRRRRRRRRRRRQQ',
  'rrrrrRRRRRrr......................rrRRRRRRRRRRQQ',
  'rrrrrrRRRrr........................rrRRRRRRRQQ',
  '.ogogogogo..........................ogogogogo',
  '.g.g.g.g.g...........................g.g.g.g.g',
]

const FACE = [
  '.eEEF',
  'eEEEFF',
  'eEEEEFF',
  'eEEEF',
  '.eeE',
]

const STAFF = [
  'aA',
  'aA',
  '.aA',
  '.aA',
  '..aA',
  '..aA',
  '...aA',
  '...aA',
  '....aA',
  '....aA',
  '.....aA',
  '.....aA',
  '......aA',
  '......aA',
  '.......aA',
  '.......aA',
  '........aA',
  '........aA',
  '.........aA',
  '.........aA',
  '..........aA',
  '..........aA',
  '...........aA',
  '...........aA',
  '............aA',
  '............aA',
  '.............aA',
  '.............aA',
  '..............aA',
  '..............aA',
  '...............aA',
  '...............aA',
  '................aA',
  '................aA',
  '.................aA',
  '.................aA',
  '..................aA',
  '..................aA',
]

const BINDLE = [
  '...rRRr',
  '.rRRQQRr',
  'rRyRRQyRR',
  'rRRRyRRQR',
  'rRyRRRyRR',
  'rRRRyRRRR',
  '.rRRRRRRr',
  '..rrrrrr',
]

const BODY = bell({ d: 'x', m: 'X', l: 'R', t: 'o' })

const BROOCH = [
  '.yyy',
  'yRQRy',
  'yRRRy',
  '.yyy',
]

export const D05: Design = {
  id: 'd05',
  title: 'Spice-Road Traveller',
  concept: 'Walked the long road east for the first pepper seed: a tall wound turban with a ruby and plume, a fringed shawl, a bindle on her staff.',
  pal: PAL,
  headBottom: 53,
  parts: [
    { id: 'shadow', group: 'feet', x: 30, y: 66, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 40, y: 63, rows: FEET, ring: 0 },
    { id: 'staff', group: 'prop', x: 9, y: 21, rows: STAFF },
    { id: 'bindle', group: 'prop', x: 1, y: 17, rows: BINDLE },
    { id: 'body', group: 'body', x: 34, y: 50, rows: BODY },
    { id: 'shawl', group: 'head', x: 20, y: 41, rows: SHAWL, squash: [4] },
    { id: 'face', group: 'head', x: 63, y: 38, rows: FACE },
    { id: 'turban', group: 'head', x: 26, y: 16, rows: TURBAN, squash: [10, 20] },
    { id: 'plume', group: 'head', x: 54, y: 18, rows: PLUME },
    { id: 'brooch', group: 'head', x: 56, y: 30, rows: BROOCH, ring: 1 },
    { id: 'handB', group: 'hands', x: 26, y: 56, rows: FIST_L },
    { id: 'handF', group: 'hands', x: 66, y: 55, rows: FIST_R },
  ],
  idle: [{}, { squash: 1 }, { squash: 2, move: { hands: [0, 1], prop: [0, 1] } }, { squash: 2, move: { hands: [0, 1], prop: [0, 1] } }, { squash: 1 }, {}],
  idleMs: [220, 140, 160, 220, 140, 200],
  // she hitches the staff up her shoulder: the bindle bounces, the plume nods
  tic: [
    { move: { prop: [0, 1], hands: [0, 1] }, squash: 1 },
    { move: { prop: [1, -2], hands: [0, -2] }, nudge: { bindle: [0, 1] } },
    { move: { prop: [1, -2], hands: [0, -2] }, nudge: { bindle: [0, -2], plume: [1, 0], brooch: [0, 0] } },
    { move: { prop: [1, -1], hands: [0, -1] }, nudge: { bindle: [0, 1], plume: [1, 0] } },
    { nudge: { bindle: [0, -1] } },
    {},
  ],
  ticMs: [120, 100, 120, 140, 140, 200],
}
