/**
 * Wren design 08 — the Twig-crown Druid. Hand-placed pixel maps (see wren-lib.ts).
 *
 * He keeps the wild garden the glasshouses were built over, and it keeps
 * him: his night-blue hood is wound with ivy and two twigs have rooted in it and
 * grown out like antlers, leafing at the tips. A forked beard with a vine in it;
 * a little lichen-gold sickle at his side. Silhouette: a round hood with two
 * branching horns. Tic: a new leaf opens on a twig as the sickle catches light.
 */
import type { Design } from './wren-lib'
import { PAL, SHADOW, FEET, FIST_L, FIST_R } from './wren-common'

const HOOD = [
  '.................tttttttt',
  '..............TTTTtttttttttt',
  '............TTTTTTTTttttttttSS',
  '...........TTTTTTTTTtttttttttSS',
  '.........TTwwTTTTTTTtttttttttSSSS',
  '........TTTTTTTTTTTTtttttttttSSSSS',
  '........TwTTTTTTTTTTttttttttttSSSS',
  '.......TTTTTTTTTTTTTtttttttttSSSSSS',
  '......TTTTTTTTTTTTTttttttttttSSSSWVV',
  '.....TTTTTTTTTTTTWVtttttttttWVSSSWiVS',
  '.....TTTTTTTTTTTWiVttttttttWiVvvvSVSS',
  '....TTTTTWVTvvvTTVttttttttttVVSSSSSSSS',
  '....WWVTTWiVTTTvvvvvvtttttvvSSSSSSSSSS',
  '...tWiVTvvVTTTTttttttWVvvvttSSSSSSSSSSS',
  '...ttVvvDTTTTTtttttttWiVtttSSSSSSSSSSSS',
  '...tvvhDDTTTTtttttttttVtttSSSSSSSSSSSSS',
  '...tvDDDDTTtttttttttttttttSSSSSSSSSSSSS',
  '..tttttttttttttttttttttttSSSSSSSSSSSSSSS',
  '..ttttttttttttttttttttttSSSSSSSSSSSSSSSS',
  '..tttttttttttttttttttttSSSSSSSSSSSSSTSSS',
  '..ttttttttSttttttttttttSSSSSSSSSSSSSTSSS',
  '..tttttttTStttttttttttSSSSSSSSSSSSSSSTSS',
  '..tttTTTTTTtttttttSttttttSSSSSTSSSSSSTSS',
  '..ttTTTTTSTttttttTSttttttSSSSSTSSSSSSTSS',
  '.tttTTTTTSTttttttTSttttttSSSSSSTSSSSSSTSS',
  '.tttTTTTSTTttttttTSttttttSSSSSSTSSSSSSTSS',
  '.ttTTTTTSTTtttttTStttttttSSSSSSTSSSSSSTSS',
  'tttTTTTTSTTtttttTStttttttSSSSSSTSSSSSSSTSS',
  'tttTTTTSTTttttttTuuuuuuuuuuuTTTTTTTTTTTTTT',
  'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
]

const TWIG_B = [
  'iW...Wi',
  'WVW.WWV',
  '.VDdDV....Wi',
  '..dDd....WWV',
  '...dD...dDV',
  '...dDd.dDd',
  '....dDdDd',
  '.....dDd',
  '......dD',
  '.......dD',
  '........dD',
  '.........dD',
  '..........dD',
]

const TWIG_F = [
  '.....iW...Wi',
  '.....WVW.WWV',
  'iW....VDdDV',
  'WWV....dDd',
  '.VDd...dD',
  '..dDd.dDd',
  '...dDdDd',
  '....dDd',
  '...dD',
  '..dD',
  '.dD',
  'dD',
]

const TWIG_F_LEAF = [
  '.....iW...Wi',
  '.....WVW.WWV',
  'iW....VDdDV.iW',
  'WWV....dDd.WWV',
  '.VDd...dDdDV',
  '..dDd.dDd',
  '...dDdDd',
  '....dDd',
  '...dD',
  '..dD',
  '.dD',
  'dD',
]

const FACE = [
  '............mmNN',
  '...........mwmNNN',
  '..........mmmNNNNn',
  '..........mNNNNNNn',
  '...FFFFEEkNNNNNNnnk',
  '.FFwFFEFEkkNNNNnnkke',
  'FFFFFEFEEekknnnnkkeee',
  '.FFEFEFVWeEkkkkkkEee',
  '..FFEFEEiVEEeEEEeee',
  '...FEFEEeEEEeEEeEe',
  '...FEFEeEEVWeEEee',
  '....FEFeE...EEEe',
  '....FEEe....EEee',
  '.....FEe.....EEe',
  '.....Fe......EEe',
  '......e.......e',
]

const BODY = [
  '......ddDDDDDDDDhhh',
  '.....ddDDDDDDDDDDhh',
  '....dddDDDDDDDDDDhhh',
  '...dddDDDDdDDDDDDDhh',
  '...dddDDDDdDDDDDDDhhh',
  '..vvvvPvvvvvvvvvvvvvv',
  '..dddDDDDDdDDDDDdDDhhh',
  '.ddddDDDDDdDDDDDdDDDhh',
  'dVVVVVVVVVVVVVVVVVVVVd',
  'dddddddddddddddddddddd',
  '..dddddddddddddddddd',
]

const SICKLE = [
  '...zPPP',
  '......PPz',
  '........PO',
  '.........PO',
  '.........PO',
  '........PPO',
  '.dh....PPO',
  '.dh.OPPO',
  '.dhOOO',
  '.dh',
  '.dh',
  '..d',
]

const GLINT = [
  '.w',
  'www',
  '.w',
]

export const D08: Design = {
  id: 'd08',
  title: 'Twig-crown Druid',
  concept: 'Keeps the old wild garden the glasshouses were built over: a night-blue hood wound with ivy, two leafing twigs grown out of it like antlers, a gold sickle low.',
  pal: PAL,
  headBottom: 62,
  parts: [
    { id: 'shadow', group: 'feet', x: 34, y: 73, rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 72, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 39, y: 62, rows: BODY },
    { id: 'handB', group: 'hands', x: 34, y: 65, rows: FIST_L },
    { id: 'hood', group: 'head', x: 28, y: 30, rows: HOOD, squash: [10, 13, 16] },
    { id: 'twigB', group: 'head', x: 31, y: 23, rows: TWIG_B, ring: 1, ride: true },
    { id: 'twigF', group: 'head', x: 55, y: 23, rows: TWIG_F, ring: 1, ride: true },
    { id: 'face', group: 'head', x: 44, y: 55, rows: FACE },
    { id: 'sickle', group: 'prop', x: 67, y: 64, rows: SICKLE },
    { id: 'handF', group: 'hands', x: 66, y: 70, rows: FIST_R },
    { id: 'glint', group: 'fx', x: 71, y: 64, rows: GLINT, ring: 0, hidden: true },
  ],
  idle: [
    {},
    { squash: 1 },
    { squash: 2, move: { hands: [0, 1] } },
    { squash: 3, move: { hands: [0, 1] } },
    { squash: 2, move: { hands: [0, 1] } },
    { squash: 1 },
  ],
  idleMs: [220, 120, 110, 280, 140, 170],
  // he turns the sickle so it catches the light while a new leaf opens on the front twig
  tic: [
    { squash: 1 },
    { nudge: { sickle: [1, 0], handF: [1, 0] }, show: ['glint'] },
    { nudge: { sickle: [1, 0], handF: [1, 0], glint: [1, 1] }, show: ['glint'], swap: { twigF: TWIG_F_LEAF } },
    { swap: { twigF: TWIG_F_LEAF } },
    { swap: { twigF: TWIG_F_LEAF }, squash: 1 },
    {},
  ],
  ticMs: [200, 160, 200, 400, 300, 200],
}
