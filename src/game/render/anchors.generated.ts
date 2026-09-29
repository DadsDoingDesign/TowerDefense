/**
 * GENERATED — do not edit by hand.
 *
 * Written by `npm run anchors`, which reads the `*_anchors.png` marker layers
 * in every sprite pack. `npm run anchors:check` fails the build if this file
 * and the PNGs disagree, the same guard `scripts/fw-icons.ts` puts on the icon
 * atlas.
 *
 * Keyed by PACK first: anchors are cell coordinates, and one pack's cells are
 * not another's (fieldwatch's 64px idle cell against Tiny Swords' 84px). A pack
 * with no entry draws its heroes un-geared rather than wrongly geared.
 */
import type { AnchorPacks } from './anchors'

export const ANCHORS: AnchorPacks = {
  "fieldwatch": {
    "fighter_atk": [
      { mx: 58, my: 62, ox: 34, oy: 60, tx: 60, ty: 44 },
      { mx: 60, my: 60, ox: 34, oy: 59, tx: 62, ty: 42 },
      { mx: 68, my: 57, ox: 34, oy: 60, tx: 70, ty: 39 },
      { mx: 74, my: 55, ox: 34, oy: 61, tx: 76, ty: 37 },
      { mx: 72, my: 56, ox: 34, oy: 61, tx: 74, ty: 38 },
      { mx: 64, my: 60, ox: 34, oy: 61, tx: 66, ty: 42 },
    ],
    "fighter_idle": [
      { mx: 45, my: 43, ox: 17, oy: 43, tx: 47, ty: 25 },
      { mx: 45, my: 43, ox: 17, oy: 43, tx: 47, ty: 25 },
      { mx: 45, my: 42, ox: 17, oy: 42, tx: 47, ty: 24 },
      { mx: 45, my: 42, ox: 17, oy: 42, tx: 47, ty: 24 },
      { mx: 45, my: 43, ox: 17, oy: 43, tx: 47, ty: 25 },
      { mx: 45, my: 43, ox: 17, oy: 43, tx: 47, ty: 25 },
    ],
    "gear_buckler": [
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 24, ty: 0 },
      { mx: 24, my: 42, ox: 24, oy: 42, tx: 24, ty: 0 },
      { mx: 24, my: 41, ox: 24, oy: 41, tx: 24, ty: 0 },
      { mx: 24, my: 42, ox: 24, oy: 42, tx: 24, ty: 0 },
      { mx: 24, my: 43, ox: 24, oy: 43, tx: 24, ty: 0 },
    ],
    "gear_dagger": [
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 24, ty: 0 },
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 28, ty: 26 },
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 40, ty: 35 },
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 42, ty: 45 },
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 24, ty: 0 },
    ],
    "gear_greatsword": [
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 24, ty: 0 },
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 33, ty: 3 },
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 24, ty: 0 },
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 12, ty: 23 },
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 18, ty: 47 },
    ],
    "gear_shield": [
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 24, ty: 0 },
      { mx: 24, my: 42, ox: 24, oy: 42, tx: 24, ty: 0 },
      { mx: 24, my: 41, ox: 24, oy: 41, tx: 24, ty: 0 },
      { mx: 24, my: 42, ox: 24, oy: 42, tx: 24, ty: 0 },
      { mx: 24, my: 43, ox: 24, oy: 43, tx: 24, ty: 0 },
    ],
    "gear_staff": [
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 24, ty: 0 },
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 32, ty: 5 },
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 24, ty: 0 },
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 11, ty: 24 },
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 16, ty: 47 },
    ],
    "gear_sword": [
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 24, ty: 0 },
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 30, ty: 15 },
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 24, ty: 0 },
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 2, ty: 29 },
      { mx: 24, my: 44, ox: 24, oy: 44, tx: 6, ty: 46 },
    ],
  },
}
