/**
 * Saffra design 07 — the Fire Dancer. Hand-authored pixel maps (see saffra-lib.ts).
 *
 * At the burning of the fields she dances the fire out for the buyers: her
 * ginger hair swept up into three tongues of flame, an ember band, a coin
 * belt that rings, and a painted fan snapped open over her head. Silhouette:
 * a flame-topped dome with a fan raised like a torch. Tic: the fan snaps
 * shut and flicks open again in a spray of sparks.
 */
import type { Design } from './saffra-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, bell } from './saffra-common'

const HAIR = [
  '.............Hy',
  '.............HyH',
  '..............HyyH',
  '..............HywyH',
  '...............HyywyH',
  '...............HyyywyH............Hy',
  '...............HHyywyyH..........HyH',
  '...............hHyyywyyH.........HywH',
  '.....Hy........hHHyyywyyH.......HyywH',
  '.....HyH.......hHHyyyywyyH......HyywyH',
  '.....HyyH......qhHHyyyyyyHH....hHyywyH',
  '.....hHyyH.....qhHHHyyyyyHHh...hHHyyyHH',
  '.....hHyyHH....qhHHHHyyyyHHHh.hHHHyyyHHH',
  '.......hHHyHH.qhHHHHHyyHHHHhh.qhHHHHyHHH',
  '........qhHHHqhHHHHHHjHHHHHHqhHHHHHHHHHh',
  '.........qhHHhhhhHHHHHjHHHHHhhHHHHHHHHh',
  '.........qhhHHhhHHHHHHjHHHHHhHHHHHHHHHHh',
  '........qhhHHHhHHHHHHHjHHHHhHHHHHHHHHHHHh',
  '........qqhHHHhHHHHHHHHHHHHhHHHHHHHHHHHHHh',
  '.......qqhhHHHhHHHHHHHHHHHhHHHHHHHHHHHHHHh',
  '......qqhhHHHHhHHHHHHHHHHhHHHHHHHHHHHHHHHh',
  '.....qqhhhHHHHhHHHHHHHHHhHHHHHHHHHHHHHHHHh',
  '....qqhhhhhHHHhHHHHHHHHhHHHHHHHHHHHHHHHHHh',
  '....rrRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRQ',
  '...rrrRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRyyRRRQ',
  '...rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrryyrrrrr',
  '..qqhhhhhhhhhHHHHHHHhHHHHHHHHHhHHHHHHHHHHHHh',
  '..qqhhhhhhhhhhhHHHHhHHHHHHHHHhHHHHHHHHHHHHHhh',
  '.qqhhhhhhhhhhhhhhhhHHHHHHHHhHHHHHHHHHHHHHHHhh',
  '.qqqhhhhhhhhhhhhhhhhhhHHHHhHHHHHHHHHhHHHHHHhh',
  'qqqhhhhhhhhhhhhhhhhhhhhhhhhHHHHHHHhhHHHHHHhhh',
  'qqqqhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
  'qqqqhhhhhhhhhqqqqqqqqqqqqqqqqqqqqqqqqhhhhhhhhhqqqq',
  'qqqqhhhhhhhhq........................qhhhhhhhhqqq',
  '.qqqhhhhhhq..........................qhhhhhhqqq',
  '...qqqhhqq..............................qqhhqqq',
  '......qq...................................qq',
]

const FACE = [
  '.eEEF',
  'eEEEFF',
  'eEEEEFF',
  'eEEEF',
  '.eeE',
]

const FAN = [
  '.....RRQQggOO',
  '...rRRQQggggOOo',
  '..rRRRQQggggOOOo',
  '.rRRRRQQggggOOOOo',
  '.rRRRRQQggggOOOOo',
  '..rRRRQQggggOOOo',
  '...rRRQQggggOOo',
  '....rRQQggOOOo',
  '.....rRQggOOo',
  '......rQggOo',
  '.......rgOo',
  '........uu',
]

const FAN_SHUT = [
  '.RQg',
  '.RQg',
  '.RQg',
  'rRQgO',
  'rRQgO',
  '.rQgO',
  '.rQgo',
  '..Qg',
  '..uu',
]

const SPARKS = [
  '.y.....y',
  '.......H',
  'H....y',
]

const BODY = bell({ d: 'r', m: 'R', l: 'Q', t: 'o' }, { 4: '...oyoyoyoyoyoyoyoyoyoyo' })

export const D07: Design = {
  id: 'd07',
  title: 'Fire Dancer',
  concept: 'Dances the fields’ burning for the buyers: hair swept up into tongues of flame, a ringing coin belt, a painted fan snapped open.',
  pal: PAL,
  headBottom: 47,
  parts: [
    { id: 'shadow', group: 'feet', x: 29, y: 58, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 39, y: 55, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 34, y: 43, rows: BODY },
    { id: 'face', group: 'head', x: 67, y: 36, rows: FACE },
    { id: 'hair', group: 'head', x: 22, y: 9, rows: HAIR, squash: [19, 28] },
    { id: 'handB', group: 'hands', x: 28, y: 46, rows: FIST_L },
    { id: 'fan', group: 'prop', x: 59, y: 14, rows: FAN },
    { id: 'sparks', group: 'fx', x: 59, y: 7, rows: SPARKS, ring: 0, hidden: true },
    { id: 'handF', group: 'hands', x: 66, y: 26, rows: FIST_R },
  ],
  idle: [{}, { squash: 1 }, { squash: 2, move: { hands: [0, 1], prop: [0, 1] } }, { squash: 2, move: { hands: [0, 1], prop: [0, 1] } }, { squash: 1 }, {}],
  idleMs: [150, 110, 130, 150, 110, 140],
  // snap: the fan shuts, a beat, and flicks open in a spray of sparks; a little dip of the head
  tic: [
    { swap: { fan: FAN_SHUT }, at: { fan: [65, 17] }, move: { hands: [0, 1], prop: [0, 1] } },
    { swap: { fan: FAN_SHUT }, at: { fan: [65, 17] }, move: { hands: [0, 1], prop: [0, 1] }, squash: 1 },
    { move: { hands: [0, -1], prop: [0, -1] }, show: ['sparks'] },
    { show: ['sparks'], nudge: { sparks: [1, -2] }, squash: 1 },
    { squash: 2 },
    {},
  ],
  ticMs: [90, 220, 110, 160, 140, 160],
}
