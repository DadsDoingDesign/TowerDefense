/**
 * Saffra design 09 — the Sack-Bearer. Hand-authored pixel maps (see saffra-lib.ts).
 *
 * The first Peppercorn sack she ever sold, she carried to market on her own
 * head; she still does it to show the young ones how. A burlap sack bigger
 * than she is, cinched with a red cord, peppers poking out of its mouth, the
 * company's pepper stencilled on its side; her fists up on its flanks and a
 * ginger fringe under it. Silhouette: the sack is the head. Tic: she bounces
 * the load and a pepper pops up out of the neck.
 */
import type { Design } from './saffra-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, bell } from './saffra-common'

const SACK = [
  '.....................eFFwFFe',
  '...................eEFFwwFFFEe',
  '....................eeEFFFEee',
  '.....................rRRQRRr',
  '...................eeEFFwFFEee',
  '...............eeeeeEFFFwFFeFFEEee',
  '...........eeeeEeEEFFFFwFFFeFFFFEEEEee',
  '........eeeeEEeEEEFFFFFwFFFFeFFFFFEEEEEee',
  '......eeeeEEEeEEEFFFFFFwFFFFFeFFFFFFEEEEEee',
  '.....eeeeeEEEeEEEFFFFFFwwFFFFeFFFFFFFEEEEEee',
  '....eeeeeEEEEeEEEFFFFFFFFFFFFeFFFFFFFFEEEEEee',
  '...eeeeeEEEEEeEEEFFFFFFFFFFFeFFFFFFFFFEEEEEEee',
  '..eeeeeEEEEEEeEEEFFFFFFFFFFeFFFFFFFFFFEEEEEEee',
  '..eeeeeeEEEEEEeEEEFFFFFFFFFeFFFFFFFFFFFEEEEEEee',
  '.eeeeeeEEEEEEEeEEEFFFFFFFFFeFFFFFFFFFFFFEEEEEee',
  '.eeeeeeEEEEEEEEeEEEFFFFFFFFeFFFFFFeFFFFFEEEEEee',
  'eeeeeeEEEEEEEEEeEEEFFFFFFFFeFFFFRRRRFFFFFEEEEEee',
  'eeeeeeeEEEEEEEEeEEEFFFFFFFeFFFFRQQRRFFFFEEEEEeee',
  'eeeeeeeEEEEEEEEeEEEFFFFFFFeFFFFRQRRRFFFFEEEEEeee',
  'eeeeeeeEEEEEEEEEeEEFFFFFFFeFFFFRQRRRFFFFEEEEEeee',
  'eeeeeeeEEEEEEEEEeEEFFFFFFFeFFFFFRRRRFFFFEEEEEeee',
  'eeeeeeeEEEEEEEEEeEEFFFFFFFeFFFFFRRRFFFFFEEEEEeee',
  'eeeeeeeeEEEEEEEEEeEFFFFFFFeFFFFFFRRFFFFFEEEEEeee',
  'eeeeeeeeEEEEEEEEEeEFFFFFFFFeFFFFFFRFFFFFEEEEEeee',
  'eeeeeeeeEEEEEEEEEEeFFFFFFFFeFFFFFFFFFFFFEEEEEeee',
  'eeeeeeeeeEEEEEEEEEeFFFFFFFFeFFFFFFFFFFFFEEEEeeee',
  '.eeeeeeeeeEEEEEEEEeFFFFFFFFeFFFFFFFFFFFEEEEeeee',
  '.eeeeeeeeeeEEEEEEEEEeEFFFFFFeEFFFFFFFFFEEEeeeee',
  '..eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  '....eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  '.......eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]

const PEPPERS = [
  '...u..u',
  '..RQ.uR',
  '.RRQ.RQ',
  '.RQ..RQ',
]

const UNDER = [
  '....qhhHHHHhHHHHHHhHHHHHHHhHHHHHHhHHHHHH',
  '..qqhhHHHHhHHHHHHhHHHHHHHhHHHHHHhHHHHHHHh',
  '.qqhhhHHHhHHHHHHhHHHHHHHhHHHHHHhHHHHHHHHh',
  'qqhhhhHHhHHHHHHhhHHHHHHhhHHHHHhhHHHHHHHh',
  'qqqhhhhhhhHHHhhhhhHHHHhhhhHHHhhhhhHHHHhh',
  'qqqqhhhhhhqqqqqqqqqqqqqqqqqqqqqqqqhhhhhhh',
  '.qqqhhhhhq.......................qhhhhhqq',
  '..qqhhhhq.........................qhhhqq',
  '....qqqq............................qqq',
]

const FACE = [
  '.eEEF',
  'eEEEFF',
  'eEEEEFF',
  'eEEEF',
  '.eeE',
]

const BODY = bell({ d: 'r', m: 'R', l: 'Q', t: 'o' })

export const D09: Design = {
  id: 'd09',
  title: 'Sack-Bearer',
  concept: 'Carried her first sack to market on her head and still does: a burlap load bigger than she is, the company pepper stencilled on it.',
  pal: PAL,
  headBottom: 55,
  parts: [
    { id: 'shadow', group: 'feet', x: 31, y: 67, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 41, y: 64, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 35, y: 51, rows: BODY },
    { id: 'under', group: 'body', x: 28, y: 46, rows: UNDER },
    { id: 'face', group: 'body', x: 66, y: 47, rows: FACE },
    { id: 'peppers', group: 'head', x: 43, y: 11, rows: PEPPERS },
    { id: 'sack', group: 'head', x: 24, y: 16, rows: SACK, squash: [16, 22] },
    { id: 'handB', group: 'hands', x: 21, y: 40, rows: FIST_L },
    { id: 'handF', group: 'hands', x: 69, y: 40, rows: FIST_R },
  ],
  idle: [{}, { squash: 1 }, { squash: 2, move: { hands: [0, 1] } }, { squash: 2, move: { hands: [0, 1] } }, { squash: 1 }, {}],
  idleMs: [240, 150, 170, 240, 150, 210],
  // a bounce of the load: it hops off her head and lands, a pepper pops up from the neck and drops back
  tic: [
    { squash: 2, move: { hands: [0, 1], head: [0, 1] } },
    { move: { head: [0, -2], hands: [0, -2] } },
    { move: { head: [0, -3], hands: [0, -3] }, nudge: { peppers: [0, -3] } },
    { move: { head: [0, -1], hands: [0, -1] }, nudge: { peppers: [0, -2] } },
    { squash: 2, move: { hands: [0, 1], head: [0, 1] } },
    {},
  ],
  ticMs: [120, 90, 120, 110, 150, 200],
}
