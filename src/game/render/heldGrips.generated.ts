/**
 * GENERATED — do not edit by hand.
 *
 * Written by `npm run anchors` (`scripts/held-grips-lib.ts`): where each
 * hand is on every frame of every hero strip a held mark is drawn over, in
 * logical px from the hero's origin (feet at y = +8) — the fist tracked off
 * the Tiny Swords art, frame by frame (a hand hidden behind the body follows
 * the tunic), and a marker-layer pack's own grips. `r` is the weapon hand,
 * `l` the off hand; `gearMarks.drawMainHand` / `drawOffHand` hold the
 * mark there. `npm run anchors:check` fails the build if this file and the
 * PNGs disagree.
 */
import type { HeldGrips } from './gearMarks'

export const HELD_GRIPS: HeldGrips = {
  "fieldwatch": {
    "fighter_atk": {
      r: [[9, -20], [11, -22], [19, -25], [25, -27], [23, -26], [15, -22]],
      l: [[-15, -22], [-15, -23], [-15, -22], [-15, -21], [-15, -21], [-15, -21]],
    },
    "fighter_idle": {
      r: [[13, -21], [13, -21], [13, -22], [13, -22], [13, -21], [13, -21]],
      l: [[-15, -21], [-15, -21], [-15, -22], [-15, -22], [-15, -21], [-15, -21]],
    },
  },
  "tinyswords": {
    "fighter_atk": {
      r: [[2, -27], [1, -27], [1, -27], [7, -24], [7, -23], [4, -24]],
      l: [[-49, -30], [-50, -34], [-50, -34], [-31, -31], [-33, -27], [-40, -28]],
    },
    "fighter_idle": {
      r: [[21, -21], [21, -21], [22, -20], [22, -19], [21, -20], [21, -21]],
      l: [[-26, -24], [-26, -24], [-27, -23], [-27, -22], [-26, -23], [-26, -24]],
    },
    "mystic_atk": {
      r: [[5, -13], [4, -14], [4, -14], [12, -9], [12, -10], [14, -10]],
      l: [[-27, -11], [-23, -13], [-23, -13], [-41, -15], [-40, -17], [-35, -11]],
    },
    "mystic_idle": {
      r: [[20, -13], [20, -12], [21, -11], [22, -11], [21, -12], [20, -13]],
      l: [[-18, -12], [-18, -11], [-19, -10], [-20, -10], [-19, -11], [-18, -12]],
    },
    "rogue_atk": {
      r: [[23, -13], [23, -13], [23, -13], [21, -13], [21, -13], [21, -13], [19, -13], [23, -13]],
      l: [[-26, -11], [-26, -11], [-26, -11], [-29, -11], [-29, -11], [-29, -11], [-31, -11], [-26, -11]],
    },
    "rogue_idle": {
      r: [[25, -13], [26, -14], [26, -14], [28, -13], [26, -11], [24, -12]],
      l: [[-24, -11], [-25, -12], [-25, -12], [-27, -11], [-27, -10], [-24, -9]],
    },
  },
}
