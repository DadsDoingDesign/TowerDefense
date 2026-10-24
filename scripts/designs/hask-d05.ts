/**
 * Hask design 05 — the Hide Tanner. Hand-authored pixel maps (see hask-lib.ts).
 *
 * Works the tanning pits behind the salt sheds and dresses like the guild
 * master he means to be: a leather chaperon, its pleated comb rising from a
 * fat roundlet of twisted brine-red cloth, the roundlet sitting low on
 * his shoulders; a hide smock; a scraped hide laced into a stretching
 * frame, held low at his side to show you. Silhouette: a tall pleated crest
 * on a fat ring. Tic: he turns the frame to show both sides.
 */
import type { Design } from './hask-lib'
import { PAL, FEET, SHADOW_W, FIST_B, FIST_F, SNOUT, TAIL, TAIL_DOWN, bell } from './hask-common'

const CHAPERON = [
  '........jIIAAAAAAA',
  '.....AjjhjAAAAhAAAAah',
  '....AAjAhAAAAAhAAAAAhah',
  '...AAjAAhAAAAAhAAAAAhahh',
  '...AAjAAAhAAAAAhAAAAAhahhh',
  '...AAAAAAhAAAAAhAAAaAhahhh',
  '...AjAAAAhAAAAAhAAAaAhahhh',
  '...AAAAAAhAAAAAhAAaAahhhhh',
  '....AAAAAAhAAAAhAAaAhahhhh',
  '.....AAAAAAhAAAAhAAAAhhhhh',
  '...AAAAAAhAAAAAhAAAaAhahhh',
  '...AjAAAAhAAAAAhAAAaAhahhh',
  '...AAAAAAhAAAAAhAAaAahhhhh',
  '....AAAAAAhAAAAhAAaAhahhhh',
  '.....AAAAAAhAAAAhAAAAhhhhh',
  '......AAAAAhAAAAhAAAAhhhhh',
  '......AAAAAhAAAAhAAAAhAhh',
  '......AAAAAhAAAAhAAAAhAAh',
  '.....aaaaaahaaaahaaaahaaah',
  '...QQQQQQQQQQRRRRRRRRRRRRpppp',
  '.RRRpRRRRpRRRRpRRRRpRRRRpppppp',
  'RRRpRRRRpRRRRpRRRRpRRRRpRRppppp',
  'RRpRRRRpRRRRpRRRRpRRRRpRRRppppp',
  'RpRRRRpRRRRpRRRRpRRRRpRRRRppppp',
  '.ppppppppppppppppppppppppppppp',
  '..ppppppppppppppppppppppppppp',
]


const EYE = ['yw']

const BODY = bell({ d: 'h', m: 'H', l: 'i', t: 'h' }, {
  4: '....hhhHHHHHHHHHHHHHHHHHii',
  5: '...hhhhHHHHHHHHHHHHHHHHHHii',
  6: '...hhhhHHHHHHHiHHHHHHHHHHii',
  7: '..hhhhHHHHHHHHHHHHHHHHHHHHii',
})

/** The scraped hide, laced into a wooden stretching frame. */
const FRAME = [
  'iiiiiiiiiiiiiH',
  'iHHHHHHHHHHHHh',
  'iH.a..a..a.aHh',
  'iHadddddddCaHh',
  'iH.ddwdddCC.Hh',
  'iHaddddddCCaHh',
  'iH.dddCCddC.Hh',
  'iHadddCCddCaHh',
  'iHaddddddCCaHh',
  'iH.CddddCCC.Hh',
  'iHaCCCCCCCCaHh',
  'iH.a..a..a.aHh',
  'iHHHHHHHHHHHHh',
  'hhhhhhhhhhhhhh',
]
/** The frame turned to show its back (the hide's flesh side, darker). */
const FRAME_TURN = [
  'iiiiiiiiiiiiiH',
  'iHHHHHHHHHHHHh',
  'iH.a..a..a.aHh',
  'iHaCCCCCCCcaHh',
  'iH.CCdCCCcc.Hh',
  'iHaCCCCCCccaHh',
  'iH.CCCcCCCc.Hh',
  'iHaCCCccCCcaHh',
  'iHaCCCCCCccaHh',
  'iH.cCCCCccc.Hh',
  'iHaccccccccaHh',
  'iH.a..a..a.aHh',
  'iHHHHHHHHHHHHh',
  'hhhhhhhhhhhhhh',
]

export const D05: Design = {
  id: 'd05',
  title: 'Hide Tanner',
  concept: 'Works the tanning pits and dresses like the guild master he means to be: a leather chaperon on a twisted brine-red roundlet sitting low on his shoulders; a scraped hide in a stretching frame, held low.',
  pal: PAL,
  headBottom: 59,
  parts: [
    { id: 'shadow', group: 'feet', x: 22, y: 72, rows: SHADOW_W, ring: 0 },
    { id: 'tail', group: 'back', x: 13, y: 57, rows: TAIL },
    { id: 'feet', group: 'feet', x: 41, y: 69, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 35, y: 56, rows: BODY },
    { id: 'snout', group: 'head', x: 50, y: 47, rows: SNOUT },
    { id: 'chaperon', group: 'head', x: 30, y: 27, rows: CHAPERON, squash: [5, 9, 13] },
    { id: 'eye', group: 'head', x: 65, y: 48, rows: EYE, ring: 0 },
    { id: 'handB', group: 'hands', x: 31, y: 60, rows: FIST_B },
    { id: 'frame', group: 'prop', x: 66, y: 63, rows: FRAME },
    { id: 'handF', group: 'hands', x: 63, y: 62, rows: FIST_F },
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
    { move: { prop: [0, -1], hands: [0, -1] } },
    { swap: { frame: FRAME_TURN }, move: { prop: [0, -1], hands: [0, -1] } },
    { swap: { frame: FRAME_TURN, tail: TAIL_DOWN } },
    { move: { prop: [0, -1], hands: [0, -1] }, swap: { tail: TAIL_DOWN } },
    { squash: 1 },
    {},
  ],
  ticMs: [160, 160, 220, 300, 160, 200],
}
