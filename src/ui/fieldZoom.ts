/**
 * Zoom to place (Q3) — the pure half: when the field zooms, how far, where to,
 * and how a finger on a zoomed field is read. No DOM, no store; `BattleCanvas`
 * owns the element and the gesture and asks these for every number.
 *
 * ## Why it exists
 *
 * The deployment grid is 80 logical px a tile. On the portrait twin that is
 * 47.8 CSS px at 390×844 (0.597 CSS px per field px) — over the 44 px touch
 * floor — but 34.8 at 375×667 (0.435) and 27.5 at 320×568 (0.344). The field
 * cannot simply be drawn bigger: it is fit to the Stage, and the lane runs edge
 * to edge. So on those phones, and only while a hero is being posted, the
 * field zooms until a tile clears the floor, and eases back out when the hero
 * lands or the arming is cancelled.
 *
 * ## The interaction: the FIRST TOUCH on the field zooms, around that point
 *
 * Not "zoom the moment a hero is armed". Where to post is the strategic call of
 * the setup — which bend, how much road a tile sees — and that call wants the
 * whole field in view. Zooming on arm would take the overview away exactly when
 * it is being used, and it would have to guess where to zoom. The first touch
 * says where: the player has already decided roughly where the hero goes, and
 * the zoom only buys the precision to hit the tile. That touch never posts; the
 * next one does (a tap, or hold + slide + lift, exactly as today).
 * Keyboard and screen-reader placement never touch the canvas, so they never
 * zoom (the grid of buttons is unchanged).
 *
 * ## Crisp: whole device pixels per field pixel
 *
 * The composite is the logical field drawn 1:1 (see `BattleCanvas`), so a
 * field pixel IS an art pixel. The zoomed scale is always `k / dpr` for a whole
 * `k`: every art pixel becomes exactly k × k device pixels, and with
 * `image-rendering: pixelated` (which `resampleMode` picks for any ratio ≥ 1)
 * that is a lossless, even upscale — no fractional sprite scaling, no smear.
 * `k` is the SMALLEST whole step whose tile clears the floor. At dpr 2 that is
 * k = 2 (scale 1.0, an 80 CSS px tile): k = 1 would be a 40 px tile, 4 px
 * short. At dpr 3 it is k = 2 (scale 0.667, a 53 px tile).
 */

/** The touch-target floor a tile must clear on screen, CSS px. */
export const TOUCH_FLOOR = 44
/** How long the zoom eases in or out (0 under reduced motion). */
export const ZOOM_EASE_MS = 220
/**
 * How far a finger may wander (CSS px) before a press on a zoomed field is a
 * drag rather than a tap.
 */
export const PAN_SLOP = 8
/**
 * How long a finger must rest before a slide moves the range preview instead
 * of panning the view. A press that moves further than {@link PAN_SLOP} before
 * this is a pan; one that moves after it is the hold-to-preview slide.
 */
export const HOLD_MS = 250

/** Where the field sits in the wrap and how big: left/top in wrap CSS px. */
export interface FieldView {
  scale: number
  left: number
  top: number
}

/** The box the field is fit into (the wrap's content box), wrap CSS px. */
export interface ViewBox {
  left: number
  top: number
  width: number
  height: number
}

/**
 * The CSS scale (CSS px per field px) the field zooms to while placing, or
 * `null` when no zoom is needed because a tile already clears `floor` at the
 * fitted scale — every such screen behaves exactly as it did before.
 *
 * The result is always `k / dpr` for a whole `k ≥ 1` (see the header): the
 * smallest whole number of device pixels per field pixel that makes a tile at
 * least `floor` CSS px, and never a zoom OUT.
 */
export function placeZoomScale(baseScale: number, dpr: number, tile: number, floor = TOUCH_FLOOR): number | null {
  if (!(baseScale > 0) || !Number.isFinite(baseScale) || !(tile > 0)) return null
  // A tile that already clears the floor: exactly today's behaviour.
  if (tile * baseScale >= floor - 1e-6) return null
  const d = dpr > 0 && Number.isFinite(dpr) ? dpr : 1
  let k = Math.max(1, Math.ceil((floor * d) / tile - 1e-9))
  // Belt and braces: a zoom must enlarge the field.
  while (k / d <= baseScale) k++
  return k / d
}

/** Round a CSS length onto the device pixel grid, so the zoomed field's pixel columns line up. */
export function snapPx(v: number, dpr: number): number {
  const d = dpr > 0 && Number.isFinite(dpr) ? dpr : 1
  return Math.round(v * d) / d
}

/**
 * Keep a view's field covering its box: on an axis where the field is larger
 * than the box it may pan only until its edge meets the box's edge; on an axis
 * where it is smaller, it is centred (the fitted view's own letterbox rule).
 */
export function clampView(v: FieldView, fieldW: number, fieldH: number, box: ViewBox): FieldView {
  const axis = (pos: number, size: number, lo: number, span: number): number =>
    size <= span ? lo + (span - size) / 2 : Math.min(lo, Math.max(lo + span - size, pos))
  return {
    scale: v.scale,
    left: axis(v.left, fieldW * v.scale, box.left, box.width),
    top: axis(v.top, fieldH * v.scale, box.top, box.height),
  }
}

/**
 * Zoom `from` to `toScale` about the point (ax, ay) in wrap CSS px: the field
 * point under that point stays under it (unless the field's edge would come
 * away from the box, when the clamp wins), snapped to device pixels.
 */
export function zoomAround(
  from: FieldView,
  toScale: number,
  ax: number,
  ay: number,
  fieldW: number,
  fieldH: number,
  box: ViewBox,
  dpr: number,
): FieldView {
  const lx = (ax - from.left) / from.scale
  const ly = (ay - from.top) / from.scale
  const v = clampView({ scale: toScale, left: ax - lx * toScale, top: ay - ly * toScale }, fieldW, fieldH, box)
  return { scale: toScale, left: snapPx(v.left, dpr), top: snapPx(v.top, dpr) }
}

/** Drag a zoomed view by (dx, dy) CSS px, clamped to its box and snapped to device pixels. */
export function panView(v: FieldView, dx: number, dy: number, fieldW: number, fieldH: number, box: ViewBox, dpr: number): FieldView {
  const c = clampView({ scale: v.scale, left: v.left + dx, top: v.top + dy }, fieldW, fieldH, box)
  return { scale: v.scale, left: snapPx(c.left, dpr), top: snapPx(c.top, dpr) }
}

/**
 * A view part-way between two. Linear in scale AND offset, which keeps the
 * zoom's anchor point fixed on screen for the whole ease (both ends map it to
 * the same place, and the map is affine in t).
 */
export function lerpView(a: FieldView, b: FieldView, t: number): FieldView {
  return {
    scale: a.scale + (b.scale - a.scale) * t,
    left: a.left + (b.left - a.left) * t,
    top: a.top + (b.top - a.top) * t,
  }
}

/** The ease both ways: fast out of the gate, settling onto the whole-pixel scale. */
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

/**
 * What a finger on the ZOOMED field is doing:
 * - `pending` — still within the slop: the range previews at the tile under it,
 *   and lifting posts (a tap, exactly as today).
 * - `pan` — it moved past the slop before the hold: dragging the view; lifting
 *   posts nothing.
 * - `hold` — it rested for {@link HOLD_MS} and then moved: the hold-to-preview
 *   slide, exactly as today; lifting posts on the tile under it.
 * Sticky: once a press is a pan or a hold it stays one.
 */
export type PressMode = 'pending' | 'pan' | 'hold'
export function nextPressMode(mode: PressMode, movedPx: number, heldMs: number): PressMode {
  if (mode !== 'pending') return mode
  if (movedPx <= PAN_SLOP) return 'pending'
  return heldMs >= HOLD_MS ? 'hold' : 'pan'
}
