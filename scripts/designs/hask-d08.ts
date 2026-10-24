/**
 * Hask design 08 — the Salt-Caravan Elder. Hand-authored pixel maps (see hask-lib.ts).
 *
 * Led the salt caravans across the flats for forty seasons and still sets the
 * price of a block: a tall linen head-wrap wound with a brine-red stripe and
 * pinned with a salt crystal, its end hanging down his back; a hide robe; a
 * jointed reed cane planted at his side. He stoops: the snout hangs low.
 * Silhouette: a tall wound dome with a cloth tail behind. Tic: a slow nod,
 * and the cane taps twice.
 */
import type { Design } from './hask-lib'
import { PAL, FEET, SHADOW_W, FIST_B, FIST_F, SNOUT_LOW, TAIL, TAIL_DOWN, bell } from './hask-common'

const WRAP = [
  '.........bblLLLLLll',
  '......bblLmmLLLbbbblcc',
  '....bllLLLLLLLLLblllcbbb',
  '...cLLLmbbbbbblllcLLbbbll',
  '..LLLbbbbbblllccLLLLblllll',
  '.LLbbbbbbllccLLLLbbbbblcccc',
  'bbbbbblllcLLLLbbbbbbllccRRRR',
  'bbblllcLLLLbbbbbbbllccRRRRpp',
  'lllcLLLLLbbbbbbllccQQQRppppp',
  'ccLLLLbbbbbblllcQQQQRRpppppp',
  'LLLbbbbbblllcQQQQQRRRRmppppp',
  'bbbbbblllcQQQQQRRRRRRwxmpbbb',
  'bbmbllccQQQQRRRRRRppCxmNcbbl',
  'blllcQQQQRRRRRRppppLLCNcllll',
  'lcQQQQQRRRRRRppppLLLLblllllc',
  'QQQQRRRRRRppppLLLLbbbbllcccc',
  'QRRRRRRppppLLLLbbbbbblcccbbb',
  'RRRRppppLLLLLbbbbbbllccbbbbl',
  'RppppLLLLLbbbbbbllccLLbbllll',
  'pppLLLLbbbbbblllcLLLLLllllll',
  '.LLLbbbbbblllcLLLLLbbblllcc',
  '..bbbbbbllccLLLLbbbbblcccc',
]

/** The wrap's loose end, hanging down his back past the shoulder. */
const VEIL = [
  '.LLLbbl',
  'LmLbbbll',
  'LLLbbbll',
  'LLbbbbll',
  '.LbbbblL',
  '.Lbbbbll',
  '..Lbbbll',
  '..RRRpp',
  '..Lbbbl',
  '...Lbbl',
  '...Lbl',
  '....l',
]

const EYE = ['yw']

const BODY = bell({ d: 'h', m: 'H', l: 'i', t: 'h' }, {
  10: 'hIhhIhhIhhIhhIhhIhhIhhIhhIhhh',
})

/** A string of bone beads at his throat. */
const BEADS = ['d.d.d.d.d', '.C.C.C.C']

/** The reed cane: jointed every few pixels, worn pale where the hand goes. */
const CANE = [
  'iH',
  'iH',
  'hh',
  'iH',
  'iH',
  'iH',
  'hh',
  'iH',
  'iH',
  'iH',
  'aH',
]

export const D08: Design = {
  id: 'd08',
  title: 'Salt-Caravan Elder',
  concept: 'Led the salt caravans across the flats for forty seasons: a tall linen head-wrap with a brine-red stripe and a salt crystal, its end down his back; a hide robe; a jointed reed cane. He stoops.',
  pal: PAL,
  headBottom: 59,
  parts: [
    { id: 'shadow', group: 'feet', x: 22, y: 72, rows: SHADOW_W, ring: 0 },
    { id: 'tail', group: 'back', x: 13, y: 57, rows: TAIL },
    { id: 'feet', group: 'feet', x: 41, y: 69, rows: FEET, ring: 0 },
    { id: 'veil', group: 'head', x: 30, y: 45, rows: VEIL },
    { id: 'body', group: 'body', x: 35, y: 56, rows: BODY },
    { id: 'beads', group: 'body', x: 52, y: 58, rows: BEADS, ring: 0 },
    { id: 'snout', group: 'head', x: 50, y: 47, rows: SNOUT_LOW },
    { id: 'wrap', group: 'head', x: 33, y: 26, rows: WRAP, squash: [6, 11, 16] },
    { id: 'eye', group: 'head', x: 65, y: 48, rows: EYE, ring: 0 },
    { id: 'handB', group: 'hands', x: 31, y: 60, rows: FIST_B },
    { id: 'cane', group: 'prop', x: 69, y: 64, rows: CANE },
    { id: 'handF', group: 'hands', x: 67, y: 61, rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1 },
    { squash: 2, nudge: { snout: [0, 1], eye: [0, 1] }, move: { hands: [0, 1] } },
    { squash: 2, nudge: { snout: [0, 1], eye: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, move: { prop: [0, 1] } },
    {},
  ],
  idleMs: [300, 220, 260, 320, 220, 300],
  tic: [
    { move: { head: [0, 1] }, squash: 1 },
    { move: { head: [0, 1], prop: [0, -1], hands: [0, -1] }, squash: 1 },
    { move: { head: [0, 1] }, squash: 1, swap: { tail: TAIL_DOWN } },
    { move: { head: [0, 1], prop: [0, -1], hands: [0, -1] }, squash: 1, swap: { tail: TAIL_DOWN } },
    { move: { head: [0, 1] }, squash: 1 },
    {},
  ],
  ticMs: [300, 140, 200, 140, 300, 300],
}
