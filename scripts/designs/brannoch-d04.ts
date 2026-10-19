/**
 * Brannoch design 04 — the Ore Assayer. Hand-authored pixel maps (see brannoch-lib.ts).
 *
 * Weighs every cart's sample at the Ironvein gate: a red felt fez with a
 * brass assay badge and a black tassel, a round chestnut beard bound at its
 * tip with a brass ring, a leather coat, and a little brass balance hung from his fist — a
 * lump of ore in one pan, a weight in the other. Silhouette: a tall square
 * fez with its tassel swinging. Tic: the beam tips, wobbles, and settles level; he nods.
 */
import type { Design } from './brannoch-lib'
import { AT, FEET, FIST_B, FIST_F, PAL, SHADOW, bell } from './brannoch-common'

const HAT = [
  '......QQQQQQQQQQQQQQQRR',
  '....QQwwQQQQQQQQQQQQQQRR',
  '...RQQQQQQQQQQQQQQQQQQRRr',
  '...QQwQQQQQQQQQQQQQQQRRRr',
  '...QwQQQQQQQQQQQQQQQQRRRr',
  '..QQQQQQQQQQQQQQQQQQRRRRrr',
  '..QQQQQQQQQQQQQQQQQQRRRRrr',
  '..QQQQQQQQQQQQQQQQQRRRRRrr',
  '.QQQQQQQQQQQQQQQQQQRRRRRrrr',
  '.QQQQQQQQQQQQQQQQQRRRRRRrrr',
  '.QQQQQQQQQQQQQQQQRRRRRRrrrr',
  'RRQQQQQQQQQQQQQQQRRRRRrrrrr',
  'RRRRRRRRRRRRRRRRRRRRRRrrrrrr',
  'rRrRrRrRrRrRrRrRrRrRrRrrrrrr',
  'rrrrrrrrrrrrrrrrrrrrrrrrrrrr',
]

const BADGE = ['.tA.', 'tyAa', 'AAaa', '.aa.']

const TASSEL = [
  '......zZZ',
  '.....zZd',
  '....zZ',
  '...zZ',
  '...zZ',
  '..zZ',
  '..zZ',
  '..zZ',
  '.zZZd',
  'zZdZZz',
  'zZZZZz',
  'zZzZzz',
  '.z.z.z',
]

const BEADRING = ['tAAAAAAa', 'aAAAAAaa']

const BEARD = [
  '......BBBBBBBBBBBBBBBBBBBbbbbbbb',
  '....BBBBBBBBBBBBBBBBBBBBBBbbbbbbbb',
  '...BBBBBBBBBBBBBBBBBBBBBBBBbbbbbbbb',
  '..BBBBBGGGBBBBBBBBBBBbBBBBBbbbbbbbb',
  '.BBBBBGGBBBBBBBBBbBBBbBBBBBbbbbbubbu',
  '.BBBBGBBBBBBBBBBBbBBBbBBbBBbbbbbubbu',
  'BBBBBBBBBBBBBBBBBbBBBbBBbBbbbbbbubuu',
  'BBBBBBBBBBBBBBbBBbBBBbBBbbbbbbbbubuu',
  'BBBBbBBBBBBbBBbBBbBBBbBBbbbbbbbbuuuu',
  'BbBBbBBbBBBbBBbBBbBBBbbbbbbbbbbbuuuu',
  'bbBBbBBbBBBbBBbBBuBBbbbbubbububuuuuu',
  '.bbbbBBbBBBbBBbbbubbbbbbubbubuuuuuu',
  '.bbbbbbbbbbbbbubbubbbbbbubbuuuuuuu',
  '...bbbbbbbbbbbubbubbbubbuuuuuuuu',
  '......bbbbbubbubbubbbuuuuuu',
  '.........bbubbuuuuuuuuu',
  '..........uuuuuuuuuuu',
  '...........uuuuuuuu',
  '...........uuuuuuuu',
  '............uuuuu',
]

const MOUSTACHE = [
  '.....GGGGGGGGGGGGGGGGG',
  '..GGGFFGGGGGGGGGGGGGGGGb',
  'GGGFGGGGGGGGGGGGGGGGGGbbb',
  'bGGGGGbbbbbbbbbbbbbGGGbbu',
  '.bbbbu............ubbbu',
]

const NOSE = [
  '.DCC..',
  '.DCCC.',
  'DDCCCc',
  'CCCCCc',
  '.CCccc',
  '..ccc.',
]

const BODY = bell({ 1: 'V', 2: 'U', 3: 'u', 4: 'a', 5: 'A' })

const STEM = ['aA', 'aA', 'aA']
const BEAM = [
  'tAAAAAAAAAAAAAAAAAAAa',
  'aaaaaaaaaaaaaaaaaaaaa',
]
const BEAM_TIP = [
  'tAAAAAAa',
  'aaaaaaaaAAAAAAAa',
  '........aaaaaaaaAAAAAa',
  '................aaaaa',
]
const CHAIN = ['k', 'k', 'k', 'k']
const PAN_ORE = [
  '..zZZd..',
  '.zZZdZz.',
  'zZZZZZZz',
  'tAAAAAAa',
  '.aaaaaa',
]
const PAN_WT = [
  '...IJ...',
  '..iIJI..',
  '.iIIJJI.',
  'tAAAAAAa',
  '.aaaaaa',
]

export const D04: Design = {
  id: 'd04',
  title: 'Ore Assayer',
  concept: 'Weighs every cart\'s sample at the gate: a red felt fez with a brass badge and a black tassel, a round chestnut beard, a balance hung low from his fist.',
  pal: PAL,
  headBottom: 56,
  parts: [
    { id: 'shadow', group: 'feet', x: AT.shadow[0], y: AT.shadow[1], rows: SHADOW, ring: 0 },
    { id: 'feet', group: 'feet', x: AT.feet[0], y: AT.feet[1], rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: AT.body[0], y: AT.body[1], rows: BODY },
    { id: 'beard', group: 'head', x: 32, y: 36, rows: BEARD, sags: true },
    { id: 'tassel', group: 'head', x: 31, y: 14, rows: TASSEL, ring: 1 },
    { id: 'hat', group: 'head', x: 36, y: 14, rows: HAT, squash: [5, 8] },
    { id: 'badge', group: 'head', x: 55, y: 21, rows: BADGE, ring: 1 },
    { id: 'beadring', group: 'head', x: 42, y: 52, rows: BEADRING, sags: true },
    { id: 'moustache', group: 'head', x: 43, y: 34, rows: MOUSTACHE },
    { id: 'nose', group: 'head', x: 57, y: 31, rows: NOSE },
    { id: 'stem', group: 'prop', x: 70, y: 63, rows: STEM, ring: 1 },
    { id: 'beam', group: 'prop', x: 61, y: 65, rows: BEAM },
    { id: 'beamTip', group: 'prop', x: 61, y: 64, rows: BEAM_TIP, hidden: true },
    { id: 'chainL', group: 'prop', x: 64, y: 67, rows: CHAIN, ring: 0 },
    { id: 'chainR', group: 'prop', x: 78, y: 67, rows: CHAIN, ring: 0 },
    { id: 'panL', group: 'prop', x: 61, y: 69, rows: PAN_ORE },
    { id: 'panR', group: 'prop', x: 75, y: 69, rows: PAN_WT },
    { id: 'handB', group: 'hands', x: AT.handB[0], y: AT.handB[1], rows: FIST_B },
    { id: 'handF', group: 'hands', x: AT.handF[0], y: AT.handF[1], rows: FIST_F },
  ],
  idle: [
    {},
    { squash: 1, nudge: { tassel: [0, 1], badge: [0, 1] } },
    { squash: 2, sag: 1, nudge: { tassel: [-1, 2], badge: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, sag: 1, nudge: { tassel: [-1, 2], badge: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { tassel: [0, 1], badge: [0, 1] } },
    {},
  ],
  idleMs: [260, 150, 170, 250, 150, 190],
  // the beam tips to the ore's side, wobbles back, settles level: he nods at the weight
  tic: [
    { hide: ['beam'], show: ['beamTip'], nudge: { chainL: [0, -1], panL: [0, -1], chainR: [0, 2], panR: [0, 2] } },
    { nudge: { chainL: [0, 1], panL: [0, 1], chainR: [0, -1], panR: [0, -1] } },
    { hide: ['beam'], show: ['beamTip'], nudge: { chainL: [0, -1], panL: [0, -1], chainR: [0, 2], panR: [0, 2] } },
    {},
    { squash: 2, sag: 1 },
    { squash: 1 },
  ],
  ticMs: [200, 160, 160, 220, 240, 200],
}
