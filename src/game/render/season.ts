import type { FieldSeason } from '../data/fieldSeasons'
import { hash01, valueNoise } from './seasonHash'

export { hash01 } from './seasonHash'

/**
 * The battlefield's season, laid into the terrain bake (Oct 2026; the data is
 * `data/fieldSeasons.ts`, the scenery's pixels `seasonArt.ts`). Runs ONCE per
 * map inside `terrain.bakeTerrain`, before the environment grade, so it costs
 * nothing per frame and the grade still governs every channel the enemies
 * have reserved.
 *
 * What it touches is the ground and the scenery: `keep` marks the pixels it
 * must leave exactly as they are — the road (and its verge) and the danger
 * ground (water, fire, cursed) — and everything drawn over the bake (slots,
 * units, shots, the wagon) never passes through here at all.
 *
 * Two passes, with the scenery drawn between them (`terrain.drawSpriteTerrain`):
 *
 *  1. {@link seasonGround}, on the bare ground before any tree stands on it:
 *     the ground cover in patches (dry grass, snow with the blades poking
 *     through, mud) — each grass pixel takes the cover's step for its own
 *     lightness, so the grass's texture carries on under it — the speckle
 *     (fallen leaves, blossom) and the dew;
 *  2. {@link seasonFinish}, over everything: the lakes' rims frozen, the low
 *     mist, the season's washes and its low side-light, then the kept pixels
 *     put back.
 *
 * `accent` (one byte a pixel) marks what the season painted in its own
 * colour, so the grade can keep its hue rather than cutting it as it cuts
 * the rest of the environment's (`terrain.gradeEnvironment`) — at the
 * margins always, near the play only where the hue is no tier's
 * ({@link ACCENT_PAINT}, {@link ACCENT_KEEP}).
 */

const rgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16)
  return [v >> 16, (v >> 8) & 255, v & 255]
}
const rgba = (hex: string, a: number): string => {
  const [r, g, b] = rgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

/** A soft, seeded swell for the mist (no texture, no state). */
const swell = (x: number, y: number): number => 0.5 + 0.25 * Math.sin(x / 37 + Math.sin(y / 23) * 2) + 0.25 * Math.sin(y / 11 + x / 53)

/** Is this pixel open grass (green leads both other channels)? */
const isGrass = (r: number, g: number, b: number): boolean => g > r + 6 && g > b + 6

/** The noise level under which a share of the ground falls (measured once per salt). */
const QUANTILES = new Map<string, number>()
function noiseQuantile(share: number, scale: number, salt: number): number {
  const key = `${share}:${scale}:${salt}`
  const hit = QUANTILES.get(key)
  if (hit !== undefined) return hit
  const xs: number[] = []
  for (let i = 0; i < 4096; i++) xs.push(valueNoise(hash01(i, 1, salt) * 4000, hash01(i, 2, salt) * 4000, scale, salt))
  xs.sort((a, b) => a - b)
  const q = xs[Math.min(xs.length - 1, Math.max(0, Math.floor(share * xs.length)))]
  QUANTILES.set(key, q)
  return q
}

/**
 * The ground's season, on the bare ground (grass, the terrain pieces, the
 * road) before the scenery is drawn. `salt` is the field's (a hash of its
 * id), so two fields' patches differ and a field's are the same every bake.
 */
export function seasonGround(ctx: CanvasRenderingContext2D, w: number, h: number, season: FieldSeason, keep: Uint8Array, accent: Uint8Array, salt: number): void {
  const flecks = season.ground?.colors.map(rgb) ?? []
  const cover = season.cover
  const ramp = cover?.colors.map(rgb) ?? []
  if (!flecks.length && !cover && !season.dew) return
  const id = ctx.getImageData(0, 0, w, h)
  const d = id.data
  const scale = 46 * (cover?.grain ?? 1)
  const line = cover ? noiseQuantile(cover.share, scale, salt) : 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (keep[i]) continue
      const j = i * 4
      const r = d[j]
      const g = d[j + 1]
      const b = d[j + 2]
      if (!isGrass(r, g, b)) continue
      // Speckle in pairs of pixels, so it reads at a phone's scale.
      if (season.ground && x + 1 < w && !keep[i + 1] && hash01(x >> 1, y, 11) < season.ground.share) {
        const c = flecks[Math.floor(hash01(x >> 1, y, 12) * flecks.length)]
        for (const k of [j, j + 4]) {
          d[k] = c[0]
          d[k + 1] = c[1]
          d[k + 2] = c[2]
        }
        x++
        continue
      }
      if (cover) {
        // A crisp, dithered patch edge: pixel art, not a blur.
        const n = valueNoise(x, y, scale, salt) + (hash01(x, y, salt + 3) - 0.5) * 0.035
        if (n < line) {
          const lum = 0.299 * r + 0.587 * g + 0.114 * b
          // The darkest blades poke through the snow.
          if (cover.tufts && lum < 92 && hash01(x, y >> 1, 14) < 0.7) continue
          const t = Math.max(0, Math.min(0.999, (lum - 70) / 110))
          const c = ramp[Math.floor(t * ramp.length)]
          d[j] = c[0]
          d[j + 1] = c[1]
          d[j + 2] = c[2]
          accent[i] = ACCENT_PAINT
          continue
        }
      }
      if (season.dew && hash01(x, y, 15) < season.dew) {
        d[j] = 246
        d[j + 1] = 252
        d[j + 2] = 255
      }
    }
  }
  ctx.putImageData(id, 0, 0)
}

/** The pack's water and foam (`terrain.ts`), for the frozen rims. */
const WATERISH = ['#47aba9', '#c6f0db', '#458597'].map(rgb)
const isWater = (d: Uint8ClampedArray, j: number): boolean =>
  WATERISH.some((c) => Math.abs(d[j] - c[0]) + Math.abs(d[j + 1] - c[1]) + Math.abs(d[j + 2] - c[2]) < 40)

/**
 * The season over everything (ground and scenery), and the kept pixels put
 * back as they were — except a lake's rim, which frost freezes (the water
 * inside stays water, so a lake still reads as a lake).
 */
export function seasonFinish(ctx: CanvasRenderingContext2D, w: number, h: number, season: FieldSeason, keep: Uint8Array, accent: Uint8Array): void {
  const before = ctx.getImageData(0, 0, w, h)
  const d = before.data
  if (season.ice) {
    const R = 6
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ]
    const ice: number[] = []
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (!keep[i] || !isWater(d, i * 4)) continue
        let edge = R + 1
        for (const [dx, dy] of dirs)
          for (let s = 2; s <= R; s += 2) {
            const xx = x + dx * s
            const yy = y + dy * s
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue
            if (!isWater(d, (yy * w + xx) * 4)) {
              edge = Math.min(edge, s)
              break
            }
          }
        if (edge <= R) ice.push(i, edge)
      }
    for (let k = 0; k < ice.length; k += 2) {
      const i = ice[k]
      const x = i % w
      const y = (i / w) | 0
      const crack = hash01(x >> 2, y, 41) < 0.07
      const c = crack ? [138, 170, 196] : ice[k + 1] <= 2 ? [244, 248, 252] : ice[k + 1] <= 4 ? [214, 230, 244] : [184, 210, 230]
      const j = i * 4
      d[j] = c[0]
      d[j + 1] = c[1]
      d[j + 2] = c[2]
      accent[i] = ACCENT_PAINT
    }
  }
  const mist = season.mist ? rgb(season.mist.color) : null
  const work = new ImageData(new Uint8ClampedArray(d), w, h)
  if (mist && season.mist) {
    const m = work.data
    for (let y = 0; y < h; y++) {
      const low = Math.max(0, Math.min(1, (y / h - (1 - season.mist.reach)) / season.mist.reach))
      if (low <= 0) continue
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (keep[i]) continue
        const a = season.mist.alpha * low * (0.35 + 0.65 * swell(x, y))
        if (a <= 0.004) continue
        const j = i * 4
        m[j] += (mist[0] - m[j]) * a
        m[j + 1] += (mist[1] - m[j + 1]) * a
        m[j + 2] += (mist[2] - m[j + 2]) * a
      }
    }
  }
  ctx.putImageData(work, 0, 0)
  // The washes over everything, then the low light, then the kept pixels back.
  for (const wash of season.washes) {
    ctx.globalCompositeOperation = wash.op
    ctx.fillStyle = rgba(wash.color, wash.alpha)
    ctx.fillRect(0, 0, w, h)
  }
  ctx.globalCompositeOperation = 'source-over'
  const after = ctx.getImageData(0, 0, w, h)
  const a = after.data
  const light = season.light
  const lit = new Float32Array(w)
  if (light) for (let x = 0; x < w; x++) {
    const t = light.from === 'w' ? x / w : 1 - x / w
    lit[x] = 1 + light.lift * (1 - t) * (1 - t) - light.dim * t * t
  }
  for (let i = 0, n = w * h; i < n; i++) {
    const j = i * 4
    if (keep[i]) {
      a[j] = d[j]
      a[j + 1] = d[j + 1]
      a[j + 2] = d[j + 2]
      a[j + 3] = d[j + 3]
      continue
    }
    if (light) {
      const k = lit[i % w]
      a[j] = Math.min(255, a[j] * k)
      a[j + 1] = Math.min(255, a[j + 1] * k)
      a[j + 2] = Math.min(255, a[j + 2] * k)
    }
  }
  ctx.putImageData(after, 0, 0)
}

/**
 * A sprite's opaque pixels at the size it is drawn, for the caps, the
 * icicles and the accent mask (cached per image and size).
 */
const ALPHA = new WeakMap<object, Map<string, Uint8Array>>()
export function spriteAlpha(img: CanvasImageSource, w: number, h: number): Uint8Array | null {
  if (typeof document === 'undefined') return null
  let bySize = ALPHA.get(img as object)
  if (!bySize) ALPHA.set(img as object, (bySize = new Map()))
  const key = `${w}x${h}`
  const hit = bySize.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) return null
  g.imageSmoothingEnabled = false
  g.drawImage(img, 0, 0, w, h)
  const data = g.getImageData(0, 0, w, h).data
  const out = new Uint8Array(w * h)
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 3] > 128 ? 1 : 0
  bySize.set(key, out)
  return out
}

/**
 * The season on one piece of scenery drawn at (x, y), w × h (field px),
 * mirrored when `flip`: snow along its top edge (three pixels: two of snow,
 * one of its shade), and icicles under a pine's boughs.
 */
export function seasonOnDeco(
  ctx: CanvasRenderingContext2D,
  alpha: Uint8Array,
  x: number,
  y: number,
  w: number,
  h: number,
  flip: boolean,
  tree: boolean,
  season: FieldSeason,
  salt: number,
): void {
  const at = (cx: number, cy: number) => cy >= 0 && cy < h && cx >= 0 && cx < w && alpha[cy * w + cx] === 1
  const px = (cx: number) => (flip ? x + (w - 1 - cx) : x + cx)
  if (season.caps) {
    for (let cx = 0; cx < w; cx++) {
      if (hash01(cx, salt, 21) < 0.12) continue // a bare patch now and then
      let top = -1
      for (let cy = 0; cy < h; cy++)
        if (at(cx, cy)) {
          top = cy
          break
        }
      if (top < 0) continue
      ctx.fillStyle = season.caps.color
      for (let k = 0; k < 2; k++) if (at(cx, top + k)) ctx.fillRect(px(cx), y + top + k, 1, 1)
      if (at(cx, top + 2)) {
        ctx.fillStyle = season.caps.shade
        ctx.fillRect(px(cx), y + top + 2, 1, 1)
      }
    }
  }
  if (season.icicles && tree) {
    // Under a bough's tip: an opaque pixel with open air below it, in the crown.
    const crownFoot = Math.floor(h * 0.8)
    for (let cx = 1; cx < w - 1; cx++)
      for (let cy = Math.floor(h * 0.2); cy < crownFoot; cy++) {
        if (!at(cx, cy) || at(cx, cy + 1) || at(cx, cy + 2)) continue
        if (hash01(cx, cy + salt, 23) > 0.34) continue
        // Ice-blue with a darker tip, so it reads against the snow behind it too.
        const len = 3 + Math.floor(hash01(cx, cy, 24) * 3)
        ctx.fillStyle = '#d6e6f6'
        ctx.fillRect(px(cx), y + cy + 1, 1, 1)
        ctx.fillStyle = '#9fbcdc'
        ctx.fillRect(px(cx), y + cy + 2, 1, len - 2)
        ctx.fillStyle = '#5f80aa'
        ctx.fillRect(px(cx), y + cy + len, 1, 1)
      }
  }
}

/**
 * The accent mask's two marks (`terrain.gradeEnvironment` reads them):
 *
 *  - {@link ACCENT_PAINT}: the season's paint on the ground near the play —
 *    the ground cover, frozen rims, flat props. It keeps its hue only where that
 *    hue is not one the enemies' tiers wear (red 0–30°, gold 30–60°): the
 *    snow's cool white keeps it, the harvest's straw and rust do not.
 *  - {@link ACCENT_KEEP}: the season's set pieces at the margins — the
 *    upright props (on forest tiles only) and the trees beyond reach of the
 *    play. They keep their hue whatever it is: the place is told there.
 */
export const ACCENT_PAINT = 1
export const ACCENT_KEEP = 2
/**
 * The season's trees within reach of the play: their reds and golds are
 * turned to the season's ochre and olive (75–90°), saturation kept,
 * so they still read as autumn wood beside the road without wearing tier 1's
 * or tier 4's hue — the move the harvest's straw makes in its ramp.
 */
export const ACCENT_SHIFT = 3

/** Mark a drawn sprite's pixels in the accent mask (bake px; `ox`, `oy` the bake's origin). */
export function markAccent(accent: Uint8Array, bw: number, bh: number, alpha: Uint8Array, x: number, y: number, w: number, h: number, flip: boolean, mark = ACCENT_PAINT): void {
  for (let cy = 0; cy < h; cy++) {
    const by = y + cy
    if (by < 0 || by >= bh) continue
    for (let cx = 0; cx < w; cx++) {
      if (!alpha[cy * w + cx]) continue
      const bx = flip ? x + (w - 1 - cx) : x + cx
      if (bx < 0 || bx >= bw) continue
      accent[by * bw + bx] = mark
    }
  }
}
