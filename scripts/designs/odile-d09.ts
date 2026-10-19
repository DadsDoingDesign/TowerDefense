/**
 * Odile design 09 — the Silkworm Keeper. Hand-authored pixel maps (see odile-lib.ts).
 *
 * She keeps the worm-houses in the mulberry groves above the river, where the
 * silk begins: a low straw hat with a fine gauze veil hung from its brim down
 * to her shoulders, the leaf ears out through slits in it; a plum gown, and a
 * mulberry branch held low with two white cocoons on it.
 * Silhouette: a small crown on a brim over a tall bell of netting.
 * Tic: a moth hatches off the branch and flutters away past her ear.
 */
import type { Design } from './odile-lib'
import { PAL, FEET, SHADOW_M, FIST_L, FIST_R, EAR_FAR, EAR_NEAR, gown } from './odile-common'

const HAT = [
  '..................OOOOOOOOOO',
  '...............OOOOOOwOOOOOOOOO',
  '..............ooowwooooUooooUooo',
  '.............OOOOoOOOOoOoooUooUUu',
  '.............OOOOOOOOOOOooooooUUU',
  '.............OOoOOOOoOOOoUoooouUU',
  '.............OOOoOOOOoOOooUoooUuU',
  '.............OOOOOOOOOOoooooooUUU',
  '.............vvvvvvvvGGGGGGGGgggg',
  '............OvvvvvvvvGGGGGGGGggggo',
  '......OOOOOOOOOOOOOOOOOOOOOOOOOOOOoooooo',
  '...OOOOOwwOOOOOOOOOOOOOOOOOOOOOOOOooooooooo',
  '..OOOooOooOooOooOooOooOooOooOooOoooooooooooo',
  '...ooOOOOOOOOOOOOOOOOOOOOOOOOoooooooooooooo',
  '...uuuoooooooooooooooooooooooooooooooooouuu',
  '....boooouuuooooooooooooooooooooooUUUUuuub',
  '....bbbbbbbbooooooUUUUUUUUUUUUUuuubbbbbbbb',
  '...bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  '...BBBbBBBBbBBBBbBBBBbBBBBbBBBBbBBBBbBBBBbb',
  '...BBBbBBBBbBBBbbbbbbbbbbbbBBBBbBBBBbBBBBbb',
  '...BBbBBBBBbBBbbbbbbbbbbbbbbBBBbBBBBbBBBBbb',
  '...BBbBBBBBbBbbbbbbbbbbbbbbbbBBbBBBBbBBBBbb',
  '...BBbBBBBbBbbbbbbbbbbbbbbbbbbBBBBBBbBBBBbb',
  '...BBbBBBBbBbbbbbbbbbbbbbbbbbbBBBwwBbBBBBBb',
  '..BBBbBBBBbBBbbbbbbbbbbbbbbbbBBBBBBBbBBBBBb',
  '..BBBbBBBBbBBBbbbbbbbbbbbbbbBBBBBBBBbBBBBBbb',
  '..BBBbBBBBbBBBBbbbbbbbbbbbbBBBBbBBBBbBBBBBbb',
  '..BBbBBBBBbBBBBbBBBBbBBBBBbBBBBBbBBBBbBBBBbb',
  '..BBbBBBBBbBBBBbBBBBbBBBBBbBBBBBbBBBBbBBBBbb',
  '..BBbBBBBBbBBBBbBBBBbBBBBBbBBBBBbBBBBbBBBBbb',
  '..BBbBBBBBbBBBBbBBBBbBBBBBbBBBBBbBBBBbBBBBbb',
  '.BBBbBBBBBbBBBBbBBBBbBBBBBbBBBBBbBBBBbBBBBbb',
  '.BBBbBBBBbBBBBBbBBBBbBBBBBbBBBBBbBBBBbBBBBBbb',
  '.BBBbBBBBbBBBBBbBBBBbBBBBBbBBBBBbBBBBbBBBBBbb',
  '.BBbBBBBBbBBBBBbBBBBbBBBBBbBBBBBbBBBBbBBBBbbb',
  '.BBbBBBBBbBBBBBbBBBBbBBBBBbBBBBBbBBBBbBBBbbbb',
  '..BbbBBBBbBBBBbbBBBbbBBBbBbBBbBBbBbBBbBbbbbb',
  '.BBbbbABbbbBBbbbABbbbBBbbbABbbbBbbbbAbbbbbA',
  '..Abbb.bbbA.Abbb.bbbA.Abbb.bbbA.Abbb.bbbA',
  '...bA...Ab...bA...Ab...bA...Ab...bA...Ab',
]

const BRANCH = [
  'uU',
  '.uU',
  '..uUU....vvG',
  '...uUUvvvVvGg',
  '..vvGUUvVvGGg',
  '.vVvGGuUGGgg',
  '.vvGGgg.uU..vvG',
  '..GGgg...uUvVvGg',
  '...g...FFw.vvGGg',
  '......FFFEe.Ggg',
  '......FFEEe',
  '.......Eee..FwE',
  '............Ee',
]

const MOTH = [
  'F.F',
  'FwF',
  '.e',
]

const MOTH2 = [
  'FwF',
  '.e',
]

const BODY = gown({ l: 'i', m: 'P', d: 'p', t: 'R' })

export const D09: Design = {
  id: 'd09',
  title: 'Silkworm Keeper',
  concept: 'Keeps the worm-houses in the mulberry groves: a straw hat with a gauze veil to her shoulders, a mulberry branch with two cocoons held low.',
  pal: PAL,
  headBottom: 55,
  parts: [
    { id: 'shadow', group: 'feet', x: 33, y: 66, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 43, y: 64, rows: FEET, ring: 0 },
    { id: 'body', group: 'body', x: 38, y: 47, rows: BODY, squash: [9] },
    { id: 'hat', group: 'head', x: 27, y: 16, rows: HAT, squash: [5, 20], spread: [34, 35, 36, 37] },
    { id: 'earL', group: 'head', x: 18, y: 36, rows: EAR_FAR },
    { id: 'earR', group: 'head', x: 67, y: 34, rows: EAR_NEAR },
    { id: 'branch', group: 'prop', x: 67, y: 60, rows: BRANCH },
    { id: 'moth', group: 'fx', x: 74, y: 49, rows: MOTH, hidden: true },
    { id: 'handB', group: 'hands', x: 33, y: 55, rows: FIST_L },
    { id: 'handF', group: 'hands', x: 64, y: 57, rows: FIST_R },
  ],
  idle: [
    {},
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 2, squashBy: { body: 1 }, spread: 1, nudge: { earL: [0, 1], earR: [0, 1] }, move: { hands: [0, 1], prop: [0, 1] } },
    { squash: 1, nudge: { earL: [0, 1], earR: [0, 1] } },
    {},
  ],
  idleMs: [190, 130, 150, 200, 130, 170],
  // a moth hatches off the branch, flutters up beside her and away
  tic: [
    { show: ['moth'], at: { moth: [73, 60] } },
    { show: ['moth'], at: { moth: [76, 55] }, swap: { moth: MOTH2 } },
    { show: ['moth'], at: { moth: [79, 50] } },
    { show: ['moth'], at: { moth: [82, 46] }, swap: { moth: MOTH2 }, nudge: { earR: [1, -1] } },
    { show: ['moth'], at: { moth: [85, 41] }, nudge: { earR: [1, -1] } },
    { squash: 1 },
  ],
  ticMs: [120, 110, 110, 110, 120, 200],
}
