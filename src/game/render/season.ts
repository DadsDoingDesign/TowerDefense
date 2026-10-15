import type { FieldSeason } from '../data/fieldSeasons'

/**
 * The battlefield's season, laid into the terrain bake (Oct 2026; the data is
 * `data/fieldSeasons.ts`). Runs ONCE per map inside `terrain.bakeTerrain`,
 * before the environment grade, so it costs nothing per frame and the grade
 * still clears every channel the enemies have reserved.
 *
 * What it touches is the ground and the scenery: `keep` marks the pixels it
 * must leave exactly as they are — the road (and its verge) and the danger
 * ground (water, fire, cursed) — and everything drawn over the bake (slots,
 * units, shots, the wagon) never passes through here at all.
 *
 *  1. speckle on the open grass (fallen leaves, blossom, rime), in pairs of
 *     pixels so it reads at a phone's scale, seeded per pixel — the same on
 *     every bake;
 *  2. a low mist, thickest at the foot of the map;
 *  3. the season's washes (canvas composites), then the kept pixels put back.
 */

/** A per-pixel hash in [0, 1): the speckle is the same on every bake. */
export const hash01 = (x: number, y: number, salt: number): number => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 2246822519)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

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

export function seasonBake(ctx: CanvasRenderingContext2D, w: number, h: number, season: FieldSeason, keep: Uint8Array): void {
  const before = ctx.getImageData(0, 0, w, h)
  const d = before.data
  const flecks = season.ground?.colors.map(rgb) ?? []
  const mist = season.mist ? rgb(season.mist.color) : null
  if (flecks.length || mist) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (keep[i]) continue
        const j = i * 4
        if (season.ground && x + 1 < w && !keep[i + 1] && isGrass(d[j], d[j + 1], d[j + 2]) && hash01(x >> 1, y, 11) < season.ground.share) {
          const c = flecks[Math.floor(hash01(x >> 1, y, 12) * flecks.length)]
          d[j] = c[0]
          d[j + 1] = c[1]
          d[j + 2] = c[2]
          d[j + 4] = c[0]
          d[j + 5] = c[1]
          d[j + 6] = c[2]
          x++
          continue
        }
        if (mist && season.mist) {
          const low = Math.max(0, Math.min(1, (y / h - (1 - season.mist.reach)) / season.mist.reach))
          const a = season.mist.alpha * low * (0.35 + 0.65 * swell(x, y))
          if (a > 0.004) {
            d[j] += (mist[0] - d[j]) * a
            d[j + 1] += (mist[1] - d[j + 1]) * a
            d[j + 2] += (mist[2] - d[j + 2]) * a
          }
        }
      }
    }
    ctx.putImageData(before, 0, 0)
  }
  // The washes over everything, then the kept pixels back as they were.
  for (const wash of season.washes) {
    ctx.globalCompositeOperation = wash.op
    ctx.fillStyle = rgba(wash.color, wash.alpha)
    ctx.fillRect(0, 0, w, h)
  }
  ctx.globalCompositeOperation = 'source-over'
  const after = ctx.getImageData(0, 0, w, h)
  const a = after.data
  for (let i = 0, n = w * h; i < n; i++) {
    if (!keep[i]) continue
    const j = i * 4
    a[j] = d[j]
    a[j + 1] = d[j + 1]
    a[j + 2] = d[j + 2]
    a[j + 3] = d[j + 3]
  }
  ctx.putImageData(after, 0, 0)
}

/**
 * A sprite's opaque pixels at the size it is drawn, for the caps and crowns
 * (cached per image and size).
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
 * one of its shade), and flecks in a tree's crown.
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
  if (season.crowns && tree) {
    const crown = Math.floor(h * 0.6)
    for (let cy = 0; cy < crown; cy += 2)
      for (let cx = 0; cx < w; cx += 2) {
        if (!at(cx, cy) || !at(cx + 1, cy + 1)) continue
        if (hash01(cx + salt * 7, cy, 31) >= season.crowns.share) continue
        ctx.fillStyle = season.crowns.colors[Math.floor(hash01(cx, cy + salt, 32) * season.crowns.colors.length)]
        ctx.fillRect(px(cx) - (flip ? 1 : 0), y + cy, 2, 2)
      }
  }
}
