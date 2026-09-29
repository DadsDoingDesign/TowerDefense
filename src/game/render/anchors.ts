/**
 * Attach points for the paper-doll compositor.
 *
 * Gear has to travel with the animation, so every frame of every hero strip
 * carries a grip position. Two constraints shape this file:
 *
 * 1. **Rotation is not available.** Acceptance gate 2 forbids off-axis
 *    rotation — it resamples and destroys pixel purity, which is why barrels
 *    use lossless 90° `quarterTurns` rather than a free spin. So a weapon
 *    cannot be rotated to follow a swing. Instead every weapon is authored as
 *    a strip of {@link GEAR_POSES}, and all three heroes animate their arms to
 *    hit those same angles. The cost is per-weapon, not per weapon-per-hero-
 *    per-frame: 11 weapons × 5 poses rather than 11 × 3 × 14.
 *
 * 2. **Anchors are authored, not computed.** There is no way to infer where a
 *    hand is from a silhouette. The numbers here come from a marker-pixel
 *    layer the artist draws in Aseprite (`<role>_<anim>_anchors.png`, magenta
 *    for the main hand, cyan for the off hand, yellow for the weapon tip) which
 *    `scripts/anchors.ts` reads into {@link anchors.generated}. Drawing beats
 *    maintaining a table by hand — the table goes stale on the first revision.
 */
import { ANCHORS } from './anchors.generated'

/** One frame's attach points, in cell px from the cell's top-left corner. */
export interface Anchor {
  /** Main-hand grip. */
  mx: number
  my: number
  /** Off-hand grip. */
  ox: number
  oy: number
  /**
   * Weapon tip — the emission point for enchant particles (flame, frost,
   * shock). Keeping it in the anchor table is what lets `Flaming` cost one
   * number instead of a bespoke sprite per weapon.
   */
  tx: number
  ty: number
}

export type AnchorStrip = readonly Anchor[]
export type AnchorTable = Readonly<Record<string, AnchorStrip>>

/**
 * The shared angle vocabulary. Every hero's arm hits these five positions and
 * every weapon is authored as these five cells, in this order. Changing the
 * list changes every gear PNG in the pack, so it is deliberately short.
 */
export const GEAR_POSES = ['rest', 'raise', 'strike', 'extend', 'recover'] as const
export type GearPose = (typeof GEAR_POSES)[number]

/** Cells per gear strip. Gear sheets are `GEAR_POSE_CELLS × cellW` wide. */
export const GEAR_POSE_CELLS = GEAR_POSES.length

/**
 * Which pose a given animation frame wants.
 *
 * Idle holds `rest` throughout — a breathing loop does not move the weapon
 * enough to be worth four more cells. Attack front-loads the strike to match
 * the strips: frame 0 is the wind-up, contact lands by frame 2–3, the rest is
 * recovery. `fireFlash` decays at 5/s so the whole strip plays over ~0.2s,
 * which is too fast for anyone to read a sixth position.
 */
export function poseIndexFor(anim: string, frame: number, frames: number): number {
  if (anim !== 'atk') return 0
  if (frames <= 1) return 2
  // Normalise to the 6-frame shape so the 8-frame rogue strip maps too.
  const t = frame / (frames - 1)
  if (t < 0.18) return 1 // raise
  if (t < 0.45) return 2 // strike
  if (t < 0.62) return 3 // extend
  return 4 // recover
}

/** Anchors for one strip, e.g. `fighter_idle`. Null when the art has none yet. */
export function anchorsFor(strip: string): AnchorStrip | null {
  return ANCHORS[strip] ?? null
}

/**
 * Where a gear cell is held, in cell px. Authored the same way as hero
 * anchors — magenta marks the grip — and keyed by the FULL sprite role
 * (`gear_sword`), matching the table the extractor writes.
 *
 * Falls back to bottom-centre of the cell, which is what a hilt-down weapon
 * wants and is close enough to keep an un-anchored piece on screen rather than
 * silently dropping it.
 */
export function gearGrip(role: string, pose: number, cellW: number, cellH: number): { x: number; y: number } {
  const strip = ANCHORS[role]
  const a = strip?.[pose]
  if (a) return { x: a.mx, y: a.my }
  return { x: Math.round(cellW / 2), y: cellH - 1 }
}

/** The weapon tip for a gear cell, used to site enchant particles. */
export function gearTip(role: string, pose: number, cellW: number): { x: number; y: number } {
  const strip = ANCHORS[role]
  const a = strip?.[pose]
  if (a) return { x: a.tx, y: a.ty }
  return { x: Math.round(cellW / 2), y: 0 }
}
