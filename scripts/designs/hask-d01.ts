/**
 * Hask design 01 — the Smokehouse Keeper. Hand-authored pixel maps (see hask-lib.ts).
 *
 * Keeps the smokehouses at the reed-channel mouth: he wears one. A tall
 * three-tier thatch hat, bound with brine-red twine and capped with a hide
 * vent, sits on him like a smokehouse roof; a leather apron; a string of
 * smoked sausages hangs from his fist, low at his side. Silhouette: a tall
 * thatched beehive with a snout under it and a tail behind.
 * Tic: the hat's vent puffs smoke (the house is drawing), he leans back.
 */
import type { Design } from './hask-lib'
import { PAL, FEET, SHADOW_W, FIST_B, FIST_F, SNOUT, TAIL, TAIL_UP, bell } from './hask-common'

const HAT = [
  '..................iIiH',
  '.................iIiiHH',
  '................iiiiHHHh',
  '................IiiiHHHhh',
  '...............kkkkkkkkkkk',
  '..............QQQRRRRRRpppp',
  '.............OOOOOOOOooooHHH',
  '............OOOOuOOOooHoooHHH',
  '............OOOOOuuooOHoooHHH',
  '...........OOOOOOOuoOOHoooHHHH',
  '..........OOOOOOOOOoOOooooHHHHH',
  '..........oooOOOoOOOOooooooHHHH',
  '.........OoooOOOoOOOOooooooHHHHH',
  '........O.OO.OO.OO.Oo.oo.oo.HH.HH',
  '..........QQQQRRRRRRRRRRRpppppp',
  '.........oooooooooooooooooooHHHH',
  '........oOOOOOuOOOOOOOooooHoHHHHH',
  '........ooOOOOOuuOOOOOHoooHoHHHHH',
  '.......OooOOOOouOOOOOOooooHHoHHHHH',
  '......OOOoOOOOoOOOOOOOOoHooHoHHHHHH',
  '.....OOoooOoOOOOOOOOOOHoHooooHHHHHHH',
  '.....OOHooOoOOOoOOOOOOHoHHoooHHHHHHH',
  '....OOOoooOoOOOoOOOOOooooHoooooHHHHHH',
  '....OO.OO.OO.OO.OO.Oo.oo.oo.oo.HH.HH.H',
  '.....QQQQQQRRRRRRRRRRRRRRRRRpppppppp',
  '....oooooooooooooooooooooooooooHHHHHH',
  '....OOOoOOouOOOoOOOoOOoooooooooHHHHHH',
  '....oOOoOOoOuuOHOOOoOOoooHoooooHHHHHH',
  '...OoOOOoOoOouOHOOOOOOOooHoooooHHHHHHH',
  '..OOOOOooOOOOOoOOoOOOOOOoHHooooHHHHHHHH',
  '..OOOOOoOOOOOOoOOoOOOOOHooHHooooHHHHHHH',
  '..OOOOOoOOOOOOOOOOOOOOOHooHHooooHHHHHHH',
  '.OOOOOOOOoOOOOOOOOOOOOoHooHHooHooHHHHHHH',
  'OOOOOOOOOoOOOOOOOOOOOooHooooooHooHHHHHHHH',
  '.OO.OO.OO.OO.OO.OO.Oo.oo.oo.oo.oo.HH.HH.H',
]

const EYE = ['ky']

/** A leather apron over the tunic: bib to hem, a stitched hem, a smear of brine. */
const APRON = [
  '...aAAAAAAAj',
  '..aaAhAAAhAAj',
  '..aAAhAAAhAAj',
  '.aaAAAAAAAAAAj',
  '.aaAhhhhhhAAAj',
  '.aaAhAAAAhApAAj',
  'aaAAhAAAAhpRpAj',
  'aaAAhhhhhhApAAj',
  'aajjAjjAjjAjjAj',
  'aaaaaaaaaaaaaaa',
]

const BODY = bell({ d: 'h', m: 'H', l: 'i', t: 'a' })

/** A string of smoked sausages hanging from the fist (twine, three links, a knotted end). */
const SAUSAGES = [
  '..Il',
  '..l',
  '.HiiH',
  'HiIiph',
  'HiiRph',
  'HRRRph',
  'hpRpph',
  '.hpph',
  '..l',
  '.HiiH',
  'HiIiph',
  'HRRRph',
  'hpRpph',
  '.hhhh',
]

/** The vent's smoke: a puff, swelling, then drifting off in two. */
const SMOKE = [
  '.788.',
  '78888',
  '.777.',
]
const SMOKE2 = [
  '..7888.',
  '.788w88',
  '7788888',
  '.77788.',
  '..777',
]
const SMOKE3 = [
  '.....788.',
  '....78w88',
  '.78.78888',
  '7888.777',
  '.777',
]

export const D01: Design = {
  id: 'd01',
  title: 'Smokehouse Keeper',
  concept: 'Keeps the smokehouses at the reed-channel mouth and wears one: a three-tier thatch hat bound in brine-red twine with a hide vent, a leather apron, smoked sausages on a string.',
  pal: PAL,
  headBottom: 57,
  parts: [
    { id: 'shadow', group: 'feet', x: 22, y: 72, rows: SHADOW_W, ring: 0 },
    { id: 'tail', group: 'back', x: 13, y: 57, rows: TAIL },
    { id: 'feet', group: 'feet', x: 41, y: 69, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 35, y: 56, rows: BODY },
    { id: 'apron', group: 'body', x: 47, y: 58, rows: APRON, ring: 1 },
    { id: 'snout', group: 'head', x: 56, y: 45, rows: SNOUT },
    { id: 'hat', group: 'head', x: 27, y: 21, rows: HAT, squash: [9, 18, 28] },
        { id: 'eye', group: 'head', x: 71, y: 46, rows: EYE, ring: 0 },
    { id: 'handB', group: 'hands', x: 31, y: 60, rows: FIST_B },
    { id: 'sausages', group: 'prop', x: 66, y: 63, rows: SAUSAGES, ring: 2 },
    { id: 'handF', group: 'hands', x: 65, y: 59, rows: FIST_F },
    { id: 'smoke', group: 'fx', x: 45, y: 14, rows: SMOKE, ring: 0, hidden: true },
    { id: 'smoke2', group: 'fx', x: 44, y: 11, rows: SMOKE2, ring: 0, hidden: true },
    { id: 'smoke3', group: 'fx', x: 44, y: 7, rows: SMOKE3, ring: 0, hidden: true },
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
    { squash: 1 },
    { show: ['smoke'], move: { head: [-1, 0] } },
    { show: ['smoke2'], move: { head: [-1, 0] } },
    { show: ['smoke3'], swap: { tail: TAIL_UP } },
    { show: ['smoke3'], nudge: { smoke3: [2, -2] }, swap: { tail: TAIL_UP } },
    {},
  ],
  ticMs: [160, 200, 260, 280, 240, 200],
}
