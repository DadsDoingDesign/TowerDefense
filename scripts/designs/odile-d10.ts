/**
 * Odile design 10 — the Grande Mercer. Hand-authored pixel maps (see odile-lib.ts).
 *
 * The house's own mercer, who sets the season's silk prices from the fords
 * and dresses like it: her plum hair dressed up into a towering beehive,
 * wound like a shell and looped with pearls, a big rose silk bow pinned at
 * its back, the leaf ears out beneath; a green gown, a fat plum purse of coin
 * held low. Silhouette: a tall egg of hair with a bow at its back, the ears out flat.
 * Tic: she weighs the purse and a coin hops out of its neck.
 */
import type { Design } from './odile-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, EAR_FAR, EAR_NEAR, CHEEK, gown } from './odile-common'

const POUF = [
  '...................iiiiiP',
  '.................iiiiiippPP',
  '...............iiiiiippiiPPPP',
  '..............iwwiippiiiiPPPPp',
  '.............iiiippiiiiiiPPPPPp',
  '.............iiipiiiiiiiiPPPPPP',
  '............iwiipiiiiipiiiPPPPPp',
  '...........iiiipiiiiipiiiiPPPpPpp',
  '...........iiipiiiiipiiiiiPPpPPPp',
  '...........iiipiiiiipiiiiiPPpPPPp',
  '..........iiipiiiiipiiiiiiPpPPPPpp',
  '..........iiipiiiipiiiiiiipPPPPPpp',
  '..........wipiiiipiiiiiiiipPPPPPpp',
  '..........iipiiiipiiiiiiipPPPPPPpp',
  '..........iipiiiipiiiiiiipPPPPPPpp',
  '..........iipiiiipiiiiiiipPPPPPPpp',
  '..........iipiiiipiiiiiiipPPPPPppp',
  '..........iipiiipiiiiiiiipPPPPPppp',
  '..........ipiiiipiiiiiiipPPPPPPppp',
  '..........ipiiiipiiiiiiipPPPPPPppp',
  '..........ipiiiipiiiiiiipPPPPPPppp',
  '..........ipiiiipiiiiiiipPPPPPPppp',
  '...........piiiipiiiiiiPpPPPPPPFE',
  '...........piiiipiiiiiiPpPPPPPppp',
  '...........FEiiiipiiiiPPPpPPPFEpp',
  '............piFEipiiiPPPPpFEPppp',
  '.............PPiiFEPFEPFEPpPppp',
  '.............pPPPPpPPPPPPPpPPpp',
  '..............PPPPPpPPPPPPpPPP',
  '..............pPPPPpPPPPPPPpPPPP',
  '............PPpPPPPPpPPPPPPpPPPPPP',
  '..........PPPPppPPPPpPPPPpppPPPPPPPP',
  '.........PPPppPPpppPPPpppPPPpppPPPPPp',
  '........PPppPPPPPPPpppPPPPPPPPPppPPPPp',
  '........PpPPPPPPPPPPPPPPPPPPPPPPPPPPPp',
  '.......PPiiiiiiiiiiiiPPPPPPPPPPPPPPPPpp',
  '.......iiiiiiiiiiiiiiiiPPPPPPPPPPPPPPpp',
  '.......iiiiiiiiiiiiiiiiiPPPPPPPPPPPPppp',
  '.......iiiiiiiiiiiiiiiiiPPPPPPPpppppppp',
  '......iiiiiiiiiiiiiiiiiiPPPPPppppppppp',
  '.....PiiiiiiiiiiiiiiiiiiPPPPPpppp',
  '.....PPiiiPiiiiiiiiiiiiPPPPPppp',
  '....PPPPPiPiiiiiPiiiiPpPPPPPppp',
  '...PPPPPPpPPPPPPpPPPPPpPPPPPppp',
  '...PPPPPPpPPPPPPpPPPPPpPPPPPPpp',
  '..PPPPPPPpPPPPPPpPPPPPpPPPPPPpp',
  '.PPPPPPPPpPPPPPpPPPPPPpPPPPPPpp',
  '.PPPPPPPpPPPPPPpPPPPPPpPPPPPPpp',
  '.PPPPPPPpPPPPPPpPPPPPPpPPPppppp',
  '.PPPPpPPPPPPPPPpPPPPPPpPPpppppp',
  '.ppppppppppppppppppppppppppp',
  '..ppppp.ppppppppppppppppppp',
]

const BOW = [
  '.QQj......jQQ',
  'QQjQQ....QQRRr',
  'QjQQRR.RQQRRrr',
  'QQRRRRrRRRRrrr',
  '.QRRRrRrRRrrr',
  '..RRr.rr.Rrr',
  '.....Rr',
  '....Rrr',
]

const PURSE = [
  '...oOo',
  '..oyyOo',
  '..pPPPp',
  '.piiPPPp',
  'piwiPPPPp',
  'piiPPPPpp',
  'piPPPPPpp',
  'pPPPPPppp',
  '.pPPpppp',
  '..ppppp',
]

const COIN = [
  '.yy',
  'yyO',
  '.O',
]

const BODY = gown({ l: 'v', m: 'G', d: 'g', t: 'R' })

export const D10: Design = {
  id: 'd10',
  title: 'Grande Mercer',
  concept: 'Sets the season’s silk prices and dresses like it: plum hair in a towering beehive looped with pearls and a rose bow, a fat purse of coin held low.',
  pal: PAL,
  headBottom: 52,
  parts: [
    { id: 'shadow', group: 'feet', x: 33, y: 66, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 64, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 38, y: 47, rows: BODY, squash: [9] },
    { id: 'cheek', group: 'head', x: 59, y: 44, rows: CHEEK },
    { id: 'pouf', group: 'head', x: 27, y: 6, rows: POUF, squash: [12, 20, 32], spread: [46, 47, 48, 49] },
    { id: 'bow', group: 'head', x: 24, y: 17, rows: BOW },
    { id: 'earL', group: 'head', x: 19, y: 38, rows: EAR_FAR },
    { id: 'earR', group: 'head', x: 67, y: 35, rows: EAR_NEAR },
    { id: 'purse', group: 'prop', x: 62, y: 55, rows: PURSE },
    { id: 'coin', group: 'fx', x: 66, y: 52, rows: COIN, hidden: true },
    { id: 'handB', group: 'hands', x: 33, y: 55, rows: FIST_L },
    { id: 'handF', group: 'hands', x: 63, y: 53, rows: FIST_R },
  ],
  idle: [
    {},
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], bow: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], bow: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], bow: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1], cheek: [0, 1], bow: [0, 1] } },
    {},
  ],
  idleMs: [190, 130, 150, 200, 130, 170],
  // she weighs the purse in her hand and it chinks: a coin hops out of its neck and drops back
  tic: [
    { nudge: { purse: [0, 1], handF: [0, 1] } },
    { nudge: { purse: [0, -2], handF: [0, -2] } },
    { show: ['coin'], at: { coin: [69, 53] } },
    { show: ['coin'], at: { coin: [75, 50] }, squash: 1 },
    { show: ['coin'], at: { coin: [72, 55] } },
    {},
  ],
  ticMs: [120, 100, 120, 160, 120, 200],
}
