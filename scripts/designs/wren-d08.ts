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
import { PAL, SHADOW } from './wren-common'

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
  '...FEFEEeE.EeEEeEe',
  '....FEFe....EEEe',
  '....FEe......EEe',
  '.....e........e',
]

const ROBE = [
  '.........vvVVVVVVVVVVWWWW',
  '........vvvVVWVVVVVVVVWWWW',
  '........vvvVWiWVVVVVVVWiWW',
  '.......vvvvVVWVvWVVVVVVWWWW',
  '.......vvvVVVVVvWVVVViVVWWiW',
  '......vvvVVViVVvWVVVWiWVvWVWWW',
  '......vvPVVWVVVvWVVVVWVVvWVWWW',
  '.....vvvVVWiWVVvWVVVVVVVvWVVWWW',
  '.....ggjgjjgjjgjjgjjgjjgJjJJiJ',
  '....vvvVVVVVVvWVVViWVVVvWVVViWW',
  '....vvvVViVVVvWVVVWVVVVvWVVWWWW',
  '...vvvvVVWVVVvWVVVVVVPVVvWVVWWWW',
  '...vvvvvVVVVVvVVVVVVVVVVvVVVVWWV',
  '...dDhdDhDDdDhhDdDhhDDdDhDhhDDhD',
  '.DhdD.dhh..dh..Dh...dh..hD.dhhDDd',
  'Dd......d...D...d....d...D.....dD',
]

const KNOT = [
  '.WiW',
  'WWiV',
  '.VV',
]

const SLEEVE_B = [
  '.vVV',
  'vvVVV',
  'vVVVW',
  'vVViW',
  'dDDDhD',
  '.eEEE',
  '..eE',
]

const SLEEVE_F = [
  'VVW.',
  'VWWW',
  'VWiWW',
  'VVWWW',
  'dDDhDh',
  '.eEEFF',
  '.eEEEF',
  '..eeE',
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
    { id: 'shadow', group: 'feet', x: 33, y: 73, rows: SHADOW, ring: 0 },
    { id: 'robe', group: 'body', x: 33, y: 61, rows: ROBE },
    { id: 'knot', group: 'body', x: 40, y: 68, rows: KNOT, ring: 1 },
    { id: 'sleeveB', group: 'hands', x: 31, y: 64, rows: SLEEVE_B },
    { id: 'hood', group: 'head', x: 28, y: 30, rows: HOOD, squash: [10, 13, 16] },
    { id: 'twigB', group: 'head', x: 31, y: 23, rows: TWIG_B, ring: 1, ride: true },
    { id: 'twigF', group: 'head', x: 55, y: 23, rows: TWIG_F, ring: 1, ride: true },
    { id: 'face', group: 'head', x: 44, y: 55, rows: FACE },
    { id: 'sickle', group: 'prop', x: 67, y: 64, rows: SICKLE },
    { id: 'sleeveF', group: 'hands', x: 65, y: 63, rows: SLEEVE_F },
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
    { nudge: { sickle: [1, 0], sleeveF: [1, 0] }, show: ['glint'] },
    { nudge: { sickle: [1, 0], sleeveF: [1, 0], glint: [1, 1] }, show: ['glint'], swap: { twigF: TWIG_F_LEAF } },
    { swap: { twigF: TWIG_F_LEAF } },
    { swap: { twigF: TWIG_F_LEAF }, squash: 1 },
    {},
  ],
  ticMs: [200, 160, 200, 400, 300, 200],
}
