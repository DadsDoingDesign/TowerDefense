/**
 * The one function every field sprite goes through, and the census that proves
 * it draws at 1.000. See `pixmap.ts` for how the frames it blits are baked.
 */
import { emberOf, flashOf } from './fx'
import type { Pixmap } from './pixmap'

/**
 * Blit one baked frame at 1:1, with its contour+rim ring underneath.
 *
 * `Math.round` on the destination: the composite is 960×560 = the logical
 * field, so a whole logical px IS a whole texel of the offscreen. Snapping the
 * blit there is what stops the crawl — a moving unit used to land on a
 * different sub-pixel phase every frame, and with nearest-neighbour
 * minification that changed *which* source pixels survived, frame to frame, on
 * every unit in motion. One logical px is 0.41 CSS px at the shipping view, so
 * the snap costs less than half a CSS pixel of position and the final smoothed
 * blit recovers the sub-pixel motion anyway.
 */
export function blitPixmap(
  ctx: CanvasRenderingContext2D,
  pm: Pixmap,
  frame: number,
  cx: number,
  by: number,
  flashA = 0,
  dotA = 0,
): void {
  const sx = frame * pm.fw
  const dx = Math.round(cx - pm.fw / 2)
  const dy = Math.round(by - pm.fh)
  if (blitCensus.on) census(ctx, dx, dy)
  if (pm.ring) ctx.drawImage(pm.ring, sx, 0, pm.fw, pm.fh, dx, dy, pm.fw, pm.fh)
  ctx.drawImage(pm.img, sx, 0, pm.fw, pm.fh, dx, dy, pm.fw, pm.fh)
  /**
   * Continuous attrition — burn, thorns, a trap — in the unit's own ember
   * silhouette at a third of the impact flash's alpha (C1).
   *
   * Drawn UNDER the impact flash so a shot landing on a burning enemy still
   * reads as a shot. This is a pulse, not a level: see `fxDotEnemy`.
   */
  if (dotA > 0) {
    const em = emberOf(pm)
    if (em) {
      ctx.save()
      ctx.globalAlpha = Math.min(1, dotA) * 0.34
      ctx.drawImage(em, sx, 0, pm.fw, pm.fh, dx, dy, pm.fw, pm.fh)
      ctx.restore()
    }
  }
  /**
   * The hit mark, and the one change that fixes the most frequent event in the
   * game (impact was ONE white circle over `type.radius`, sitting inside the
   * silhouette rather than being it, and decaying at `dt*4` in GAME time).
   *
   * A white silhouette of the unit's own baked frame, on the same 1:1 cell grid
   * and therefore still a scale-1.000 draw, held for a fixed ~110 REAL ms so it
   * is exactly as readable at 3× as at 1×.
   */
  if (flashA > 0) {
    const fl = flashOf(pm)
    if (fl) {
      ctx.save()
      ctx.globalAlpha = Math.min(1, flashA) * 0.92
      ctx.drawImage(fl, sx, 0, pm.fw, pm.fh, dx, dy, pm.fw, pm.fh)
      ctx.restore()
    }
  }
}

/**
 * The 1.000 invariant, measured on the TRANSFORM as well as the size ratio (M4).
 *
 * The pass that built this pipeline graded itself on `dw/sw × dh/sh === 1.000`
 * and reported zero non-1.000 draws — while 1,935 of ~15,000 field blits, all
 * of them barrels, were being drawn under `ctx.rotate` at fourteen distinct
 * angles, twelve of them non-axis-aligned. A nearest-neighbour rotation of
 * pixel art is the third of the three amateur tells the surrounding comments
 * spend paragraphs eliminating, and the metric could not see it, because a
 * rotated blit is still 1.000 × 1.000. A ratio is not a resample test.
 *
 * So the invariant is stated in full here, in the one function every sprite in
 * the field goes through, and it is four conditions rather than one:
 *
 *   A. size ratio     `dw/sw` and `dh/sh` are exactly 1 — structural: this
 *                     function only ever passes `pm.fw`/`pm.fh` for both.
 *   B. context scale  `|a|` and `|d|` are exactly 1.
 *   C. context skew   `b` and `c` are exactly 0 — no rotation at ANY scale.
 *   D. destination    `dx`, `dy` are whole logical px — structural: `Math.round`.
 *
 * `on` is false by default and the census costs literally nothing until a
 * harness turns it on, because `getTransform()` allocates a `DOMMatrix` and
 * this runs ~70 times a frame.
 */
export const blitCensus = {
  on: false,
  blits: 0,
  /** Violations of B, C and D above. A is structurally impossible here. */
  ctxScaled: 0,
  ctxRotated: 0,
  fracDest: 0,
}
function census(ctx: CanvasRenderingContext2D, dx: number, dy: number): void {
  const t = ctx.getTransform()
  blitCensus.blits++
  if (Math.abs(Math.abs(t.a) - 1) > 1e-9 || Math.abs(Math.abs(t.d) - 1) > 1e-9) blitCensus.ctxScaled++
  if (Math.abs(t.b) > 1e-9 || Math.abs(t.c) > 1e-9) blitCensus.ctxRotated++
  if (dx % 1 !== 0 || dy % 1 !== 0) blitCensus.fracDest++
}
