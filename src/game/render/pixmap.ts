/**
 * One pixel density, enforced at bake time (Phase 3).
 *
 * ## The problem this exists to end
 *
 * The field is 960×560 logical px drawn into 390×331 CSS px on the shipping
 * phone — `fitView` scale 0.40625, and `dpr × view = 0.8125`. Every sprite used
 * to be sized from a *gameplay* number (`type.radius × enemyScale`, or a body
 * height normalised per archetype), so the product of that arbitrary factor and
 * 0.8125 was never an integer: measured across one battle screen, **not one of
 * 39 draws landed on an integer scale**, the reciprocals ran 0.88 → 5.54, and
 * the ratio between the densest asset on screen (grass, *upscaled* 1.14×) and
 * the sparsest (a barrel, 0.18×) was **6.30×**. With
 * `imageSmoothingEnabled = false` that is nearest-neighbour minification
 * throwing away 73–97% of the source pixels, and because units move at
 * sub-pixel positions *which* pixels survive changes every frame — pixel crawl
 * on everything that moves.
 *
 * ## The fix
 *
 * Resample **once, offline-style, at load**, never per frame:
 *
 * 1. Every sprite is box-filtered to exactly ×½ into a canvas whose cell
 *    dimensions are whole numbers (`Math.ceil(n / 2)`; an odd edge row simply
 *    averages fewer taps, so the *content* scale stays exactly 0.5 on both
 *    axes — no 1.6% squash, no half-pixel shift).
 * 2. The renderer then draws that baked canvas **1:1** into an offscreen field
 *    composite that is itself 960×560 — so every `drawImage` in the field is at
 *    scale exactly 1.000, source px to logical px, with smoothing off.
 * 3. One clean resample of the finished frame down to the device happens in
 *    `BattleCanvas`, with smoothing ON. One filtered resize of a composed image
 *    replaces ~30 per-frame nearest-neighbour minifications.
 *
 * The box filter is **alpha-weighted** (RGB accumulated premultiplied), because
 * Tiny Swords sprites carry colour in fully transparent pixels and a naive
 * average pulls that into the edge as a halo.
 *
 * ## The one deliberate exception: champions
 *
 * You cannot have (a) five tiers differentiated by size, (b) one pixel density,
 * and (c) this asset pack — Tiny Swords ships **one** goblin per faction and the
 * game invented five tiers by scaling it. So there are exactly **two render
 * buckets**: rank and file at ×½, and the tier-5 champion at the pack's native
 * density (`scale: 1`, the source image drawn 1:1). The champion is therefore
 * 2× the size of its own faction's line troops *and* carries pixels half their
 * size. That is a real density split and it is the only one; it is spent where a
 * boss is supposed to look like a different order of thing, and it costs no
 * resampling at all, because 1:1 is still 1:1. Everything between tier 1 and
 * tier 4 is the same size on purpose — tier is read off the notch tag
 * (`drawTierTag`), which encodes it as a *count* and survives colour-vision
 * differences, screenshots and the 0.41 view scale.
 *
 * ## On `public/assets/sprites/tinyswords@half/`
 *
 * That folder now exists — 46 PNGs plus an `index.json` from
 * `scripts/prep-sprites.ts`, declaring `"filter": "box (area average,
 * premultiplied alpha)"`, which is exactly the bake below. The renderer does
 * **not** read it, and the reason is measured rather than territorial:
 *
 *  - The champion bucket needs the pack at native density, so consuming the
 *    half pack means shipping BOTH — 236.9 KB + 85.5 KB = 322.4 KB against the
 *    236.9 KB the game already fetches. Baking in the browser costs one pass
 *    over ~1.2M source pixels at load (measured below in the review log) and
 *    zero extra bytes.
 *  - The half pack has a 1px halo baked in at `#161C2E` — a cool blue-grey,
 *    which `docs/BRAND.md` rules out by name — and the ring baked here is warm
 *    above and dark below, i.e. a rim light rather than a flat outline.
 *
 * If the champion bucket is ever retired, or the halo is re-authored warm, the
 * swap is a loader change and nothing in the renderer moves: the geometry is
 * identical, because this bake IS that pipeline run in the browser.
 */

/** A baked, ready-to-blit sprite. Every field draw of one is 1:1. */
export interface Pixmap {
  img: CanvasImageSource
  /** Cell size in LOGICAL field px. Baked px === logical px === 1:1. */
  fw: number
  fh: number
  frames: number
  /**
   * The contour+rim ring, on the same cell grid, drawn UNDER the sprite.
   * Dark on the sides and below (value separation from the grass), warm above
   * (a rim light). TF2's remedy for "the units share the ground's value band",
   * and it costs one extra `drawImage` per unit rather than a shader.
   */
  ring: CanvasImageSource | null
}

const cache = new WeakMap<HTMLImageElement, Map<string, Pixmap>>()

const canBake = (): boolean => typeof document !== 'undefined'

function scratch(w: number, h: number): CanvasRenderingContext2D {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c.getContext('2d', { willReadFrequently: true })!
}

/**
 * Box-filter one frame of `full` down by ×2 into fresh ImageData.
 *
 * `Math.ceil` on the output size rather than round or floor: an odd source
 * dimension leaves a final row/column that averages one tap instead of four,
 * which keeps the content scale at exactly 0.5 on both axes. Rounding the
 * output size instead would have bent the scale by up to 1.6% and, worse, bent
 * it by *different* amounts on x and y — a squash, which is the same defect the
 * static barrels had at 3.7%.
 */
function halfOf(full: ImageData, sx: number, sy: number, sw: number, sh: number): ImageData {
  const dw = Math.ceil(sw / 2)
  const dh = Math.ceil(sh / 2)
  const out = new ImageData(dw, dh)
  const src = full.data
  const dst = out.data
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0
      for (let j = 0; j < 2; j++) {
        const py = sy + y * 2 + j
        if (py >= sy + sh) continue
        for (let i = 0; i < 2; i++) {
          const px = sx + x * 2 + i
          if (px >= sx + sw) continue
          const o = (py * full.width + px) * 4
          const al = src[o + 3]
          r += src[o] * al
          g += src[o + 1] * al
          b += src[o + 2] * al
          a += al
          n++
        }
      }
      const o = (y * dw + x) * 4
      if (a > 0) {
        dst[o] = Math.round(r / a)
        dst[o + 1] = Math.round(g / a)
        dst[o + 2] = Math.round(b / a)
      }
      dst[o + 3] = n ? Math.round(a / n) : 0
    }
  }
  return out
}

const RING_DARK = [26, 15, 8, 214] as const
const RING_RIM = [255, 238, 196, 150] as const

/**
 * Dilate each cell's silhouette by one pixel and colour the ring by direction:
 * warm where the ring sits above the body (a rim light), dark elsewhere (a
 * contour). Strictly per cell — a strip's frames must not bleed into each other
 * or a walk cycle grows a seam.
 */
function ringOf(id: ImageData, cellW: number, frames: number): ImageData {
  const out = new ImageData(id.width, id.height)
  const s = id.data
  const d = out.data
  const W = id.width
  const H = id.height
  const A = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : s[(y * W + x) * 4 + 3])
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (A(x, y) >= 48) continue
      const cell = Math.min(frames - 1, Math.floor(x / cellW))
      const x0 = cell * cellW
      const x1 = Math.min(W, x0 + cellW) - 1
      let hit = false
      let below = false
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          if (!i && !j) continue
          const nx = x + i
          if (nx < x0 || nx > x1) continue
          if (A(nx, y + j) >= 128) {
            hit = true
            if (j > 0) below = true
          }
        }
      }
      if (!hit) continue
      const c = below ? RING_RIM : RING_DARK
      const o = (y * W + x) * 4
      d[o] = c[0]
      d[o + 1] = c[1]
      d[o + 2] = c[2]
      d[o + 3] = c[3]
    }
  }
  return out
}

function toCanvas(id: ImageData): HTMLCanvasElement {
  const ctx = scratch(id.width, id.height)
  ctx.putImageData(id, 0, 0)
  return ctx.canvas
}

export interface PixmapOpts {
  /**
   * The render bucket, and there are exactly **two**: `0.5` is the box-filtered
   * half density every rank-and-file unit and every piece of terrain draws at,
   * `1` is the pack's native density and is spent only on the tier-5 champion.
   *
   * Typed as the literal union rather than as `number` because the bake does
   * not honour anything else: the non-`1` branch runs {@link halfOf}, which is
   * a fixed ×½ box filter, so `0.75` would silently produce `0.5` and the
   * caller would get a sprite at two-thirds of the size it asked for with no
   * error anywhere. Nothing passes anything else today; this makes it
   * impossible to start.
   */
  scale: 0.5 | 1
  frames?: number
  /** Bake the contour+rim ring. Units yes; terrain dressing no (it is graded). */
  ring?: boolean
  /** Optional source sub-rect, in source px — used to pull ONE barrel out of a sheet. */
  cell?: { x: number; y: number; w: number; h: number }
}

/**
 * The baked form of a sprite, cached per image + options. Returns `null` only
 * when there is no document to bake into (the headless balance harness never
 * calls the renderer, but the guard keeps the module import-safe).
 */
export function pixmap(src: HTMLImageElement, opts: PixmapOpts): Pixmap | null {
  if (!canBake() || !src.naturalWidth) return null
  const frames = opts.frames ?? 1
  const key = `${opts.scale}|${frames}|${opts.ring ? 1 : 0}|${opts.cell ? `${opts.cell.x},${opts.cell.y},${opts.cell.w},${opts.cell.h}` : ''}`
  let byKey = cache.get(src)
  if (!byKey) cache.set(src, (byKey = new Map()))
  const hit = byKey.get(key)
  if (hit) return hit

  const cw = opts.cell?.w ?? src.naturalWidth / frames
  const ch = opts.cell?.h ?? src.naturalHeight
  const cx = opts.cell?.x ?? 0
  const cy = opts.cell?.y ?? 0

  let out: Pixmap
  if (opts.scale === 1 && !opts.cell && !opts.ring) {
    // Native density, whole sheet, no ring: the source image IS the pixmap.
    out = { img: src, fw: cw, fh: ch, frames, ring: null }
  } else {
    const sc = scratch(src.naturalWidth, src.naturalHeight)
    sc.drawImage(src, 0, 0)
    const full = sc.getImageData(0, 0, src.naturalWidth, src.naturalHeight)

    let fw: number, fh: number, strip: ImageData
    if (opts.scale === 1) {
      fw = Math.round(cw)
      fh = Math.round(ch)
      strip = new ImageData(fw * frames, fh)
      for (let f = 0; f < frames; f++) {
        const sx = Math.round(cx + f * cw)
        for (let y = 0; y < fh; y++) {
          for (let x = 0; x < fw; x++) {
            const so = ((cy + y) * full.width + sx + x) * 4
            const dofs = (y * strip.width + f * fw + x) * 4
            strip.data[dofs] = full.data[so]
            strip.data[dofs + 1] = full.data[so + 1]
            strip.data[dofs + 2] = full.data[so + 2]
            strip.data[dofs + 3] = full.data[so + 3]
          }
        }
      }
    } else {
      const first = halfOf(full, Math.round(cx), cy, Math.round(cw), ch)
      fw = first.width
      fh = first.height
      strip = new ImageData(fw * frames, fh)
      for (let f = 0; f < frames; f++) {
        const part = f === 0 ? first : halfOf(full, Math.round(cx + f * cw), cy, Math.round(cw), ch)
        for (let y = 0; y < fh; y++) {
          for (let x = 0; x < fw; x++) {
            const so = (y * part.width + x) * 4
            const dofs = (y * strip.width + f * fw + x) * 4
            strip.data[dofs] = part.data[so]
            strip.data[dofs + 1] = part.data[so + 1]
            strip.data[dofs + 2] = part.data[so + 2]
            strip.data[dofs + 3] = part.data[so + 3]
          }
        }
      }
    }
    out = {
      img: toCanvas(strip),
      fw,
      fh,
      frames,
      ring: opts.ring ? toCanvas(ringOf(strip, fw, frames)) : null,
    }
  }
  byKey.set(key, out)
  return out
}

/**
 * A four-cell strip of the SAME pixmap at 0°, 90°, 180° and 270° (M4).
 *
 * Quarter turns are the only rotations of a raster that resample nothing: they
 * are a permutation of the source pixels, so the output holds every one of them
 * exactly once, at full fidelity, with no filter and no choice about which
 * survive. That is the whole reason the roll is baked into four poses rather
 * than sixteen — sixteenths are twelve nearest-neighbour resamples wearing a
 * quantiser, and a resampled pixel-art sprite looks resampled however stable
 * its sampling phase is.
 *
 * Baked once per source pixmap, cached on it, and blitted afterwards exactly
 * like any other cell: identity transform, scale 1.000, whole-px destination.
 *
 * The cell is squared to `max(fw, fh)` because a 90° turn swaps the axes; the
 * content is centred in it, so the caller's anchor arithmetic is unchanged
 * apart from reading the (square) `fh`.
 */
const turnCache = new WeakMap<object, Pixmap>()
export function quarterTurns(pm: Pixmap): Pixmap {
  const hit = turnCache.get(pm as unknown as object)
  if (hit) return hit
  if (!canBake()) return pm
  // Even, so the cell centre is a whole pixel and the four poses share one grid.
  let n = Math.max(pm.fw, pm.fh)
  if (n % 2) n++
  const half = n / 2
  const ox = -Math.round(pm.fw / 2)
  const oy = -Math.round(pm.fh / 2)
  const build = (src: CanvasImageSource): HTMLCanvasElement => {
    const cx = scratch(n * 4, n)
    cx.imageSmoothingEnabled = false
    for (let q = 0; q < 4; q++) {
      cx.save()
      // Rotate about the cell centre. The angle is an exact multiple of 90°, so
      // the mapping is a permutation: every source pixel lands on exactly one
      // whole destination pixel and none is filtered, dropped or duplicated.
      cx.translate(q * n + half, half)
      cx.rotate((q * Math.PI) / 2)
      cx.drawImage(src, 0, 0, pm.fw, pm.fh, ox, oy, pm.fw, pm.fh)
      cx.restore()
    }
    return cx.canvas
  }
  const out: Pixmap = {
    img: build(pm.img),
    fw: n,
    fh: n,
    frames: 4,
    ring: pm.ring ? build(pm.ring) : null,
  }
  turnCache.set(pm as unknown as object, out)
  return out
}
