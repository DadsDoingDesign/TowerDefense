/**
 * Hask design 09 — the Hook Porter. Hand-authored pixel maps (see hask-lib.ts).
 *
 * Carries the sides of meat from the barges to the smokehouse hooks: a salt
 * sack worn as a hood, its corner standing up and back, its length down his
 * spine against the drip; a hide jerkin with a rope belt; a big iron meat
 * hook swinging from his fist, low at his side. Silhouette: a sack hood
 * with a peak flopped back. Tic: he hefts the hook and lets it swing.
 */
import type { Design } from './hask-lib'
import { PAL, FEET, SHADOW_W, FIST_B, FIST_F, SNOUT, TAIL, TAIL_UP, bell } from './hask-common'

const SACK = [
  '.CCdb',
  '.CCcddCC',
  '..bCccCCCCb',
  '..CCQRRddCCCCC',
  '...CbRRpcdCCbCCCb',
  '...CCCpCCcddCCCCCCCC',
  '...CCCCCCCccdCbCCCCCCb',
  '...CCCCCCCCCcddCCCCCCbbb',
  '..CCbCCCCCCCbccdbCCCbbbbcb',
  '..CCCCCCCCCCCCCcCCCbbccccccc',
  '.CCCCCbCCCCCCCbCCCbddddddCCCCC',
  '.CCCCCCCCCCCCCCCCCCbbCkkkkkkkk',
  '.CCCbCCCCCCCbCCCCCCbbCkkkkkkkk',
  '.CCRRRRCCCCCCCCCCCCbbCkkkkkkkk',
  '.CbRRRRpCChhhhbCCCbbbCkkkkkkkk',
  '.CCRRRpCCChiIhCCCCCbbCkkkkkkkk',
  '.CCCpCCCCChHihbbcbbbcbkkkkkkkk',
  '.CCCpCCCCChhhhbbbbbbcbkkkkkkkk',
  '.CbCCCCCCCcbbbcbbbcbcbkkkkkkkk',
  '.CCCCCCCCCbbbbbbbbbbcbkkkkkkkk',
  '.CCCbCCCbbbbcbbbcbbbcbkkkkkkkk',
  'CCCCCCCCbbbbbbbbbccccbkkkkkkkk',
  'CCbCCccbbbcbcbcbbccccbkkkkkkkk',
  'bbbbbcCbbbbbcbbbcccc',
  'cbbbccCbcbbbcbbbcccc',
  'bbbbbcCbbbbbcbbcccc',
  'bbcbcCcbbbcbcbccccc',
  'bbbbcCbbbbbbcccccc',
  '.cccccccccccccccc',
  '..ccccccccccccc',
]

const EYE = ['yw']

const BODY = bell({ d: 'h', m: 'H', l: 'i', t: 'h' }, {
  6: '...ooOOOOOOOOOOOOOOOOOOOOuu',
  7: '..ooooooooooooooooooooooooOO',
})

/** The meat hook: a big iron S-hook, its top curl in his fist, its point bright. */
const HOOK = [
  '..xNN',
  '.x...N',
  '.....N',
  '....xN',
  '....xN',
  '....xN',
  '....xN',
  '....xN',
  'w...xN',
  'xN..xN',
  'xN..xN',
  'xNxxNn',
  '.xNNn',
  '..nn',
]
/** The hook swung forward (the heft). */
const HOOK_SWING = [
  '..xNN',
  '.x...N',
  '.....N',
  '.....xN',
  '.....xN',
  '......xN',
  '......xN',
  '.......xN',
  '.w.....xN',
  '.xN....xN',
  '..xN..xNn',
  '..xNxxNn',
  '...xNNn',
  '....nn',
]

export const D09: Design = {
  id: 'd09',
  title: 'Hook Porter',
  concept: 'Carries the sides of meat from the barges to the smokehouse hooks: a salt sack worn as a hood, its corner flopped back; a hide jerkin with a rope belt; a big iron meat hook swung low at his side.',
  pal: PAL,
  headBottom: 56,
  parts: [
    { id: 'shadow', group: 'feet', x: 22, y: 72, rows: SHADOW_W, ring: 0 },
    { id: 'tail', group: 'back', x: 13, y: 57, rows: TAIL },
    { id: 'feet', group: 'feet', x: 41, y: 69, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 35, y: 56, rows: BODY },
    { id: 'sack', group: 'head', x: 30, y: 24, rows: SACK, squash: [7, 14, 22] },
    { id: 'snout', group: 'head', x: 51, y: 41, rows: SNOUT },
    { id: 'eye', group: 'head', x: 58, y: 39, rows: EYE, ring: 0 },
    { id: 'handB', group: 'hands', x: 31, y: 60, rows: FIST_B },
    { id: 'hook', group: 'prop', x: 65, y: 62, rows: HOOK },
    { id: 'handF', group: 'hands', x: 65, y: 60, rows: FIST_F },
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
    { move: { hands: [0, 1], prop: [0, 1] }, squash: 1 },
    { move: { hands: [1, 0] }, swap: { hook: HOOK_SWING } },
    { move: { hands: [1, -1], prop: [1, -1] }, swap: { hook: HOOK_SWING, tail: TAIL_UP } },
    { move: { hands: [1, -1], prop: [1, -1] }, swap: { tail: TAIL_UP } },
    { move: { hands: [0, 1], prop: [0, 1] }, squash: 1 },
    {},
  ],
  ticMs: [140, 120, 200, 220, 160, 200],
}
