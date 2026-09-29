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
import { getSprite, spriteGeneration } from './sprites'
import { onThemeChange } from './themes'

/** What a hero is wearing, as gear art names (lowercased item nouns). */
export interface Loadout {
  mainHand: string | null
  offHand: string | null
  body: string | null
}

const isBare = (lo: Loadout | undefined | null): boolean =>
  !lo || (!lo.mainHand && !lo.offHand && !lo.body)

/** Stable cache key. `-` rather than empty so `a||b` can't collide with `ab`. */
const loadoutKey = (lo: Loadout): string =>
  `${lo.mainHand ?? '-'}|${lo.offHand ?? '-'}|${lo.body ?? '-'}`

/**
 * Composites are keyed by pack, strip and loadout, in a small LRU. Bounded
 * because a long run equips a lot: without a cap this grows for the whole
 * session, and each entry holds a full strip canvas.
 *
 * **Identity is the point.** `pixmap()` caches its bake per source object, so
 * handing the renderer a fresh canvas every frame re-bakes (ring and all) every
 * frame — measured at ~4.3 ms per geared hero per frame when a composite was
 * incomplete and therefore never cached. Incomplete composites are cached now
 * too, tagged with the sprite-load generation they were built at: they are
 * reused until more art arrives (the generation moves), and rebuilt once then.
 * Art that 404s never arrives, so its composite settles into the cache instead
 * of being rebuilt forever.
 */
const CACHE_MAX = 24
interface Composite {
  canvas: HTMLCanvasElement
  /** Every layer was drawn — valid until the cache is cleared. */
  complete: boolean
  /** `spriteGeneration()` at build time; an incomplete entry expires when it moves. */
  generation: number
}
const composites = new Map<string, Composite>()

/** Drop everything. A new pack invalidates every layer in every composite. */
function clearLoadoutCache(): void {
  composites.clear()
}

// Same module-scope registration `sprites.ts` uses to fetch a switched pack.
// Without this a composite built from Tiny Swords art would survive into the
// new pack and draw last season's hero holding this season's sword.
onThemeChange(clearLoadoutCache)

/** A still-valid cached composite, refreshed as most-recently-used. */
function recall(key: string): HTMLCanvasElement | null {
  const hit = composites.get(key)
  if (!hit) return null
  if (!hit.complete && hit.generation !== spriteGeneration()) {
    composites.delete(key)
    return null
  }
  // Map iteration is insertion order: re-inserting moves it to the young end.
  composites.delete(key)
  composites.set(key, hit)
  return hit.canvas
}

function remember(key: string, entry: Composite): HTMLCanvasElement {
  composites.delete(key)
  while (composites.size >= CACHE_MAX) {
    const oldest = composites.keys().next().value
    if (oldest === undefined) break
    composites.delete(oldest)
  }
  composites.set(key, entry)
  return entry.canvas
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
  const grip = gearGrip(pack, role, pose, cw, ch)
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
 * Gear only ever lands on anchors drawn for THIS pack (see `anchors.ts`): a
 * pack with no anchors for the strip returns the bare body — the same object
 * every call, so the bake behind it is cached too.
 *
 * Each frame's layers are clipped to that frame's cell. A weapon reaching past
 * its cell used to paint into the NEXT frame of the strip, where it flickered
 * in for one frame of the following pose; `npm run anchors:check` now refuses
 * art that would need the clip, and the clip keeps a miss from bleeding.
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
  const anchors = anchorsFor(pack, `${archetype}_${anim}`)
  if (!anchors) return body

  const key = `${pack}|${archetype}|${anim}|${frames}|${loadoutKey(lo!)}`
  const hit = recall(key)
  if (hit) return hit

  const cw = Math.round(body.naturalWidth / frames)
  const ch = body.naturalHeight
  if (cw <= 0 || ch <= 0) return body

  // Read before drawing: an image that lands mid-build must still expire this
  // entry, so the generation is the one the build STARTED from.
  const generation = spriteGeneration()
  const canvas = document.createElement('canvas')
  canvas.width = cw * frames
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) return body
  // Every layer is authored at the pack's density and lands on a whole pixel,
  // so there is nothing to interpolate. Smoothing on would soften the grip seam.
  ctx.imageSmoothingEnabled = false

  let complete = true

  for (let f = 0; f < frames; f++) {
    const dx = f * cw
    const a = anchors[f] ?? null
    const pose = poseIndexFor(anim, f, frames)

    ctx.save()
    ctx.beginPath()
    ctx.rect(dx, 0, cw, ch)
    ctx.clip()

    // Behind the body.
    if (lo!.offHand && a && !drawHeld(ctx, pack, `gear_${lo!.offHand}`, pose, dx + a.ox, a.oy)) complete = false

    ctx.drawImage(body, dx, 0, cw, ch, dx, 0, cw, ch)

    // Body overlay is a silhouette change — pauldron and hem — not a torso
    // texture, which is invisible at this size. It shares the main-hand pose
    // index so a cloak can swing with the strike.
    if (lo!.body && !drawOverlay(ctx, pack, `body_${lo!.body}`, pose, dx, cw, ch)) complete = false

    // In front.
    if (lo!.mainHand && a && !drawHeld(ctx, pack, `gear_${lo!.mainHand}`, pose, dx + a.mx, a.my)) complete = false

    ctx.restore()
  }

  return remember(key, { canvas, complete, generation })
}
