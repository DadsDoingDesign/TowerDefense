/**
 * Saffra design 02 — the Scale Haggler. Hand-authored pixel maps (see saffra-lib.ts).
 *
 * The stall at Pepperport market: a harvest-gold kerchief sprigged with red,
 * bordered in ember and knotted under her chin, a ginger fringe and a sharp
 * cheek peeking out, a cream market apron, and a brass balance held up high
 * with a heap of red pepper in one pan: "that's the price." Silhouette: a
 * kerchief bulb with a corner tail behind, a chin knot in front, a T-shaped
 * scale off its shoulder. Tic: the scale tips under the pinch, she lets it settle.
 */
import type { Design } from './saffra-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, bell } from './saffra-common'

const BODY = bell({ d: 'r', m: 'R', l: 'Q', t: 'l' }, {
  3: '...rrrRlLLLLLLLLLLLmRQQ',
  4: '...rrrRlLLLLLLLLLLLmRQQ',
  5: '..rrrrRlLLLLLLLLLLLLmRQQ',
  6: '..rrrrRlLLLlllllLLLLmRQQ',
  7: '.rrrrRRlLLLlLLLlLLLLLmRQQ',
  8: '.rrrrrRlLLLlllllLLLLLmRQQ',
  9: 'rrrrrRRlLLLLLLLLLLLLLmRRQQ',
})

const BEAM = [
  '.........gg',
  '.........OO',
  'gggggggggggggggggggg',
  'oOOOOOOOOOOOOOOOOOOo',
]

const BEAM_TILT = [
  '.........gg',
  '.........OO',
  'gggggggggg',
  'oOOOOOOOOOgggggggggg',
  '..........OOOOOOOOOo',
]

const ROD = [
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
  'gO',
]

const HANG = [
  '..k',
  '.k.k',
  'k...k',
]

const PAN_L = [
  '..RQR',
  '.RRQQR',
  'oOggggOo',
  '.oOOOOo',
  '..oooo',
]

const PAN_R = [
  'oOggggOo',
  '.oOOOOo',
  '..oooo',
]

const HEAD = [
  '..................oOggggwwgggOOo',
  '...............ooOgggggwwggggggOOoo',
  '.............ooOggggggBggggggggggOOoo',
  '...........ooOOgggggggggggggggggggggOoo',
  '..........ooOOggggggRggggggggggggggOOooo',
  '.........ooOOOgggggRRRgggggggggggggOOOooo',
  '........ooOOOgggggggRgggggggggggggggOOOooo',
  '.......oooOOgggggggggggggggggggggRggggOOooo',
  '......oooOOgggggggggggggggggggggRRRgggOOooo',
  '......oooOOOgggggggggggggggggggggRgggggOOooo',
  '.....oooOOOggggggggggggggggggggggggggggOOooo',
  '.....oooOOOORgggggggggggggggggggggggggggOOooo',
  '....oooOOORRRggggggggggggggggggggggggggrRRRRR',
  '....oooOOOORgggggggggggggggggggggggggggrRhHHH',
  '...ooooOOggggggggggggggggggggggggggggggrRhHjHH',
  '...ooooOOOgggggggggggggggggggggggggggggrRheEEF',
  '...ooooOOOggggggggggggggggRggggggggggggrReEEFF',
  '...oooooOOgggggggggggggggRRRgggggggggggrReEEEF',
  '..oooooOOOggggggggggggggggRggggggggggggrReeEEE',
  '..oooooOOOOggggggggggggggggggggggggggggrRxeeEE',
  '..ooooooOOOOggggggggggggOggggggggggggggrRRxeeE',
  '..ooooooOOOOOgggggggggggOggggggggggggOrRRRRxx',
  '..oooooooOOOOOggggggggggOggggggggggOOrRRRRRR',
  '..ooooooooOOOOOgggggggggOggggggggOOOrRRRRRRR',
  '..oooooooooOOOOOgggggggOggggggOOOOrRRRRRRRR',
  '..ooooooooooOOOOOOgggggOOOOOOOrrRRRRRRRRRr',
  '...oooooooooOOOOOOOOOOOOOOOOrrRRRRRRRRRRr',
  '...ooooooooooOOOOOOOOOOOOOOrrrrrrrrrrrr',
  '...rroooooOOOOOOOorr',
  '..rrooooOOOOOOorr',
  '.rroooOOOOOorr',
  'rrooOOOOorr',
  'rroOOOorr',
  'rrOOrr',
  'rRrr',
  'rr',
]

const KNOT = [
  '..rRRr',
  '.rRQQRr',
  'rRRQRRRr',
  '.rRRRRRRr',
  '..rRRrRRRr',
  '...rRr.rRR',
  '...rR...rR',
  '....r....r',
]

const NOSE = [
  'EEF',
  'eEEFF',
  'eEEF',
]

export const D02: Design = {
  id: 'd02',
  title: 'Scale Haggler',
  concept: 'Haggles at the Pepperport stalls: a gold kerchief knotted under her chin, a market apron, a brass scale held up with the price in its pan.',
  pal: PAL,
  headBottom: 56,
  parts: [
    { id: 'shadow', group: 'feet', x: 29, y: 65, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 39, y: 62, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 33, y: 49, rows: BODY },
    { id: 'nose', group: 'head', x: 65, y: 35, rows: NOSE },
    { id: 'head', group: 'head', x: 20, y: 20, rows: HEAD, squash: [10, 19] },
    { id: 'knot', group: 'head', x: 57, y: 43, rows: KNOT },
    { id: 'handB', group: 'hands', x: 28, y: 54, rows: FIST_L },
    { id: 'rod', group: 'prop', x: 71, y: 23, rows: ROD },
    { id: 'hangL', group: 'prop', x: 61, y: 23, rows: HANG, ring: 0 },
    { id: 'hangR', group: 'prop', x: 77, y: 23, rows: HANG, ring: 0 },
    { id: 'beam', group: 'prop', x: 62, y: 19, rows: BEAM },
    { id: 'panL', group: 'prop', x: 60, y: 24, rows: PAN_L },
    { id: 'panR', group: 'prop', x: 76, y: 26, rows: PAN_R },
    { id: 'handF', group: 'hands', x: 69, y: 46, rows: FIST_R },
  ],
  idle: [{}, { squash: 1 }, { squash: 2, move: { hands: [0, 1], prop: [0, 1] } }, { squash: 2, move: { hands: [0, 1], prop: [0, 1] } }, { squash: 1 }, {}],
  idleMs: [200, 130, 150, 200, 130, 190],
  // the pan of pepper drops, the beam tips; she holds it there, eyeing you, then lets it settle back level
  tic: [
    { swap: { beam: BEAM_TILT }, nudge: { hangR: [0, 1], panR: [0, 1], hangL: [0, -1], panL: [0, -1] } },
    { swap: { beam: BEAM_TILT }, nudge: { hangR: [0, 2], panR: [0, 2], hangL: [0, -1], panL: [0, -1] }, squash: 1 },
    { swap: { beam: BEAM_TILT }, nudge: { hangR: [0, 2], panR: [0, 2], hangL: [0, -1], panL: [0, -1] }, squash: 1 },
    { swap: { beam: BEAM_TILT }, nudge: { hangR: [0, 1], panR: [0, 1] } },
    {},
    { move: { prop: [0, 1], hands: [0, 1] } },
    {},
  ],
  ticMs: [110, 140, 420, 120, 120, 110, 160],
}
