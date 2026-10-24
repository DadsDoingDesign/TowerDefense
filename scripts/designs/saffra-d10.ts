/**
 * Saffra design 10 — the Saffron Smuggler. Hand-authored pixel maps (see saffra-lib.ts).
 *
 * The side of Saffra the guild doesn't put in the ledger: saffron that never
 * paid the river toll. A red felt slouch hat drooping over her eyes with a
 * long gold plume swept back, an oxblood cloak with its collar up to her nose,
 * and a saffron pouch peeking out of the fold. Silhouette: a slanted brim and
 * plume over a dark bell. Tic: she opens the cloak a crack, flashes the
 * pouch, and it's gone again.
 */
import type { Design } from './saffra-lib'
import { PAL, FEET, SHADOW_M, FIST_R } from './saffra-common'

const HAT = [
  '......................RRRQ..QQRR',
  '...................rRRRQQQQQQQQRRRR',
  '..................rrRRQQQQwQQQQQRRRR',
  '.................rrRRRQQQwwQQQQQRRRR',
  '.................rrRRRQQQQQQQQQQRRRRR',
  '................rrrRRRRQQQQQQQQRRRRRR',
  '................rrrRRRRRQQQQQQRRRRRRR',
  '................rrrRRRRRRRRRRRRRRRRRR',
  '.....RRQQRR.....ooOOOOOOOOOOOOOOOOOOggo',
  '....rRRQQQQRRRRooOOOOOOOOOOOOOOOOOOggo',
  '....rrRRQQQRRRRRoooooooooooooooooooooooo',
  '.....rrRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
  '.......rrrRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRQQ',
  '..........rrrrrRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
  '..............rrrrrrrrrrrrRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
  '..............................rrrrrRRRRRRRRRRRRRRRRRRRRQ',
  '....................................rrrrrRRRRRRRRRRRRR',
  '..........................................rrrrrrrrrrrr',
]

const FEATHER = [
  '.........gggggggOO',
  '.....ggggyyyyyyyyOOg',
  '..gggOyOOOOOOOOyyOg',
  '.gOOOgOOgOOgOOOOOo',
  'gOOoOOoOOoOOooo',
  'gOo.Oo.Oo.oo',
  'gO',
  '.o',
]

const CLOAK = [
  '..............................xXXXXXXXXXXXXR',
  '..........................xxXXXXXXXXXXXXXXXXRR',
  '......................xxxXXXXXXXXXXXXXXXXXXkRR',
  '..................xxxxXXXXXXXXXXXXXXXXXXXXkRRR',
  '..............xxxxXXXXXXXXXXXXXXXXXXXXXXXXkRRR',
  '...........xxxxxXXXXXXXXXXXXXXXXXXXXXXXXXXkRRR',
  '.........xxxxxXXXXXXXXXXXXXXXXXXXXXXXXXXXXkRRR',
  '.......xxxxxxXXXXXXXXXXXXXXXXXXXXXXXXXXXXXkRRRR',
  '......xxxxxxXXXXXxXXXXXXXXXXXXXXXXxXXXXXXkRRRR',
  '.....xxxxxxXXXXXxXXXXXXXXXXXXXXXXxXXXXXXXkRRRR',
  '....xxxxxxXXXXXxXXXXXXXXXXXXXXXXXxXXXXXXkRRRRR',
  '...xxxxxxxXXXXxXXXXXXXXXXXXXXXXXxXXXXXXXkRRRRR',
  '..xxxxxxxXXXXxXXXXXXXXXXXXXXXXXXxXXXXXXkRRRRRR',
  '..xxxxxxxXXXxXXXXXXXXXXXXXXXXXXXxXXXXXXkRRRRRR',
  '.xxxxxxxXXXXxXXXXXXXXXXXXXXXXXXXxXXXXXXkRRRRRRR',
  '.xxxxxxxXXXXxXXXXXXXXXXXXXXXXXXXxXXXXXXkRRRRRRR',
  'xxxxxxxxXXXxXXXXXXXXXXXXXXXXXXXXxXXXXXXkRRRRRRRR',
  'xxxxxxxxXXXxXXXXXXXXXXXXXXXXXXXXxXXXXXXkRRRRRRRR',
  'xxxxxxxxXXXxXXXXXXXXXXXXXXXXXXXXxXXXXXXkRRRRRRRR',
  'xxxxxxxxXXXxXXXXXXXXXXXXXXXXXXXXxXXXXXXXkRRRRRRR',
  'xxxxxxxxXXXxXXXXXXXXXXXXXXXXXXXXxXXXXXXXkRRRRRRR',
  'xxxxxxxxxXXxXXXXXXXXXXXXXXXXXXXXxXXXXXXXkRRRRRRR',
  'xxxxxxxxxXXxXXXXXXXXXXXXXXXXXXXXXxXXXXXXkRRRRRRR',
  'oooooooooooooooooooooooooooooooooooooooooooooooooo',
  '.xxxxxxxxxxxxxxx....................xxxxxxxxxxxxxx',
  '...xxxxxxxxxx.........................xxxxxxxxxx',
]

const NOSE = [
  'EEF',
  'eEEFF',
  'eEEF',
]

const POUCH = [
  '..u',
  '.oOg',
  'oOOyg',
  'oOyyg',
  'oOOOg',
  '.ooo',
]

export const D10: Design = {
  id: 'd10',
  title: 'Saffron Smuggler',
  concept: 'The saffron that never paid the river toll: a slouch hat over her eyes with a long gold plume, a collar to her nose, a pouch in the fold.',
  pal: PAL,
  headBottom: 46,
  parts: [
    { id: 'shadow', group: 'feet', x: 30, y: 64, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 40, y: 61, rows: FEET, ring: 0 },
    { id: 'cloak', group: 'body', x: 20, y: 34, rows: CLOAK },
    { id: 'nose', group: 'head', x: 70, y: 37, rows: NOSE },
    { id: 'hat', group: 'head', x: 22, y: 20, rows: HAT, squash: [3, 5] },
    { id: 'feather', group: 'head', x: 20, y: 21, rows: FEATHER },
    { id: 'pouch', group: 'prop', x: 64, y: 42, rows: POUCH, hidden: true },
    { id: 'handF', group: 'hands', x: 62, y: 49, rows: FIST_R, hidden: true },
  ],
  idle: [{}, { squash: 1 }, { squash: 2 }, { squash: 2 }, { squash: 1 }, {}],
  idleMs: [260, 160, 180, 260, 160, 240],
  // a sly flash: the fist comes out of the fold with the pouch, holds it up a beat, and it's gone
  tic: [
    { show: ['handF'], nudge: { handF: [-2, 1] } },
    { show: ['handF', 'pouch'], nudge: { pouch: [0, 0] } },
    { show: ['handF', 'pouch'], nudge: { handF: [1, -2], pouch: [1, -2] }, squash: 1 },
    { show: ['handF', 'pouch'], nudge: { handF: [1, -2], pouch: [1, -2] }, squash: 1 },
    { show: ['handF'], nudge: { handF: [-2, 1] } },
    {},
  ],
  ticMs: [120, 120, 200, 360, 110, 200],
}
