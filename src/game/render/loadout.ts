/**
 * The paper-doll compositor.
 *
 * ## Why this exists
 *
 * Three heroes × 11 weapons × 5 off-hands × 5 bodies is **825 sprite sets**,
 * each 6 idle + 6–8 attack frames. Pre-rendering that matrix is not an option.
 *
 * So it is never rendered. A run has three heroes wearing one loadout each, so
 * roughly three composites are live at a time, rebuilt only when the player
 * equips something and cached by loadout key. The matrix never exists.
 *
 * ## The one rule that matters: composite BEFORE the bake
 *
 * The contour ring is generated inside `pixmap()` by dilating each cell's
 * silhouette. So the layering has to happen first, at native resolution, on
 * the whole strip:
 *
 *   body + gear ──▶ one canvas ──▶ pixmap({ring:true}) ──▶ one unified ring
 *
 * Blitting gear on top at draw time instead would send each layer through
 * `pixmap()` separately and give each its **own** ring — the sword outlined
 * against the hand holding it, which is the classic sticker look. Compositing
 * first also means the hit-flash, the DoT ember and the corpse shade, all
 * derived by `source-in` from the silhouette, pick up the gear for free.
 *
 * `pixmap()` accepts a canvas as a source and caches per-source in a WeakMap,
 * so a composite is a first-class input and needs no special case there.
 */
import { anchorsFor, gearGrip, poseIndexFor, GEAR_POSE_CELLS } from './anchors'
import { getSprite } from './sprites'
import { onThemeChange } from './themes'

/** What a hero is wearing, as gear art names (lowercased item nouns). */
export interface Loadout {
  mainHand: string | null
  offHand: string | null
  body: string | null
}

export const EMPTY_LOADOUT: Loadout = { mainHand: null, offHand: null, body: null }

export const isBare = (lo: Loadout | undefined | null): boolean =>
  !lo || (!lo.mainHand && !lo.offHand && !lo.body)

/** Stable cache key. `-` rather than empty so `a||b` can't collide with `ab`. */
export const loadoutKey = (lo: Loadout): string =>
  `${lo.mainHand ?? '-'}|${lo.offHand ?? '-'}|${lo.body ?? '-'}`

/**
 * Composites are keyed by pack, strip and loadout. Bounded because a long run
 * equips a lot: without a cap this grows for the whole session, and each entry
 * holds a full strip canvas.
 */
const CACHE_MAX = 24
const composites = new Map<string, HTMLCanvasElement>()

/** Drop everything. A new pack invalidates every layer in every composite. */
export function clearLoadoutCache(): void {
  composites.clear()
}

// Same module-scope registration `sprites.ts` uses to fetch a switched pack.
// Without this a composite built from Tiny Swords art would survive into the
// new pack and draw last season's hero holding this season's sword.
onThemeChange(clearLoadoutCache)

function remember(key: string, canvas: HTMLCanvasElement): HTMLCanvasElement {
  // Map preserves insertion order, so the first key is the oldest.
  if (composites.size >= CACHE_MAX) {
    const oldest = composites.keys().next().value
    if (oldest !== undefined) composites.delete(oldest)
  }
  composites.set(key, canvas)
  return canvas
}

/**
 * Draw one held gear cell so its grip lands on `(atX, atY)`.
 *
 * `role` is the full sprite role (`gear_sword`), not the bare noun — the two
 * families are named differently on disk and prefixing here would have looked
 * up `gear_body_plate` for an overlay.
 *
 * Returns false when the art is not loaded yet, which the caller uses to
 * decide the composite is incomplete and must not be cached.
 */
function drawHeld(
  ctx: CanvasRenderingContext2D,
  pack: string,
  role: string,
  pose: number,
  atX: number,
  atY: number,
): boolean {
  const sheet = getSprite(pack, role)
  if (!sheet) return false
  const cw = Math.round(sheet.naturalWidth / GEAR_POSE_CELLS)
  const ch = sheet.naturalHeight
  if (cw <= 0 || ch <= 0) return false
  const grip = gearGrip(role, pose, cw, ch)
  ctx.drawImage(sheet, pose * cw, 0, cw, ch, atX - grip.x, atY - grip.y, cw, ch)
  return true
}

/**
 * Draw a body overlay, which is NOT a held object.
 *
 * Armour is a torso silhouette change — pauldron and hem — so it has no grip
 * and wants no anchor: giving it one would make a pauldron chase the sword
 * hand.
 *
 * It is placed by **centre-x and bottom-y** rather than at the frame origin,
 * because the idle and attack cells are different sizes (64×72 and 98×90) and
 * both are feet-anchored with the figure centred. One overlay strip therefore
 * serves every animation. Matching the origin instead meant the overlay only
 * rendered on whichever animation it happened to be authored against, and
 * silently vanished on the other.
 */
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  pack: string,
  role: string,
  pose: number,
  frameX: number,
  cellW: number,
  cellH: number,
): boolean {
  const sheet = getSprite(pack, role)
  if (!sheet) return false
  const cw = Math.round(sheet.naturalWidth / GEAR_POSE_CELLS)
  const ch = sheet.naturalHeight
  if (cw <= 0 || ch <= 0) return false
  // An overlay wider or taller than the hero cell would be cropped by the
  // composite, which is an authoring error worth refusing rather than hiding.
  if (cw > cellW || ch > cellH) return false
  const dx = frameX + Math.round((cellW - cw) / 2)
  const dy = cellH - ch
  ctx.drawImage(sheet, pose * cw, 0, cw, ch, dx, dy, cw, ch)
  return true
}

/**
 * Build the geared strip for one hero animation, or return the bare body strip
 * when there is nothing to add.
 *
 * Layer order is back-hand → body → armour → front-hand, which is what puts a
 * shield behind the torso and a sword in front of it.
 *
 * **An incomplete composite is never cached.** Sprites load asynchronously, so
 * the first few frames after a pack switch can ask for gear whose PNG has not
 * arrived. Caching that would freeze a hero holding nothing for the rest of the
 * session; instead the partial result is drawn once and rebuilt next frame.
 */
export function heroStrip(
  pack: string,
  archetype: string,
  anim: string,
  frames: number,
  lo: Loadout | undefined | null,
): HTMLImageElement | HTMLCanvasElement | null {
  const body = getSprite(pack, `${archetype}_${anim}`)
  if (!body) return null
  if (isBare(lo) || typeof document === 'undefined') return body

  const key = `${pack}|${archetype}|${anim}|${frames}|${loadoutKey(lo!)}`
  const hit = composites.get(key)
  if (hit) return hit

  const cw = Math.round(body.naturalWidth / frames)
  const ch = body.naturalHeight
  if (cw <= 0 || ch <= 0) return body

  const canvas = document.createElement('canvas')
  canvas.width = cw * frames
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) return body
  // Every layer is authored at the pack's density and lands on a whole pixel,
  // so there is nothing to interpolate. Smoothing on would soften the grip seam.
  ctx.imageSmoothingEnabled = false

  const anchors = anchorsFor(`${archetype}_${anim}`)
  let complete = true

  for (let f = 0; f < frames; f++) {
    const dx = f * cw
    const a = anchors?.[f] ?? null
    const pose = poseIndexFor(anim, f, frames)

    // Behind the body.
    if (lo!.offHand && a && !drawHeld(ctx, pack, `gear_${lo!.offHand}`, pose, dx + a.ox, a.oy)) complete = false

    ctx.drawImage(body, dx, 0, cw, ch, dx, 0, cw, ch)

    // Body overlay is a silhouette change — pauldron and hem — not a torso
    // texture, which is invisible at this size. It shares the main-hand pose
    // index so a cloak can swing with the strike.
    if (lo!.body && !drawOverlay(ctx, pack, `body_${lo!.body}`, pose, dx, cw, ch)) complete = false

    // In front.
    if (lo!.mainHand && a && !drawHeld(ctx, pack, `gear_${lo!.mainHand}`, pose, dx + a.mx, a.my)) complete = false
  }

  // No anchors authored yet means gear had nowhere to attach and the composite
  // is just the body — not worth a cache slot, and it must rebuild once the
  // anchor table lands.
  if (!complete || !anchors) return canvas

  return remember(key, canvas)
}
