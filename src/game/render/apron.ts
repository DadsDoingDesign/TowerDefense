/**
 * The apron — the woodland the battlefield sits in (Phase 2).
 *
 * The field is a fixed 960×560 and every portrait phone is taller than that
 * aspect, so the Stage always has room the field cannot use. It used to be two
 * `#17100a` letterbox bars — ~100 CSS px of black at 390×844, more once the live
 * wave gives the Stage the Detail band's height. The apron fills that room with
 * the same meadow the field is made of, deepening into forest shade, so the
 * field reads as a sunlit clearing rather than a picture on a black mat.
 *
 * It is purely decorative and never interactive: it sits BEHIND the field
 * canvas (a separate element), holds no slot and no lane, and is baked once per
 * map + pack into one offscreen canvas. `BattleCanvas` scales and positions it
 * with CSS so its hole lines up with the field at any view scale, which means a
 * layout change (the Detail band collapsing for a live wave) costs a style
 * write, not a re-bake.
 *
 * Geometry: the apron is the field grown by `APRON_X` / `APRON_Y` logical px on
 * each side — enough to cover the tallest Stage the shell can produce (430×932
 * during a live wave needs ~470 above and below) and the widest height-bound
 * setup layout (320×568 needs ~90 either side).
 */
import type { GameMap } from '../types'
import { pixmap } from './pixmap'
import { onSpritesReady, spriteFor } from './sprites'
import { decoPools, decoStamp, gradeEnvironment, mulberry32 } from './terrain'
import { getActiveStyle } from './themes'

export const APRON_X = 260
export const APRON_Y = 560

/**
 * How far the apron reaches past the field on each side, per orientation
 * (Portrait battlefields).
 *
 * A landscape field is width-bound on a phone, so its spare room is above and
 * below (`APRON_Y`). A portrait field is height-bound, so its spare room is
 * beside it: at a live wave only ~10 CSS px a side at 390 wide, but ~100 at
 * 375×667 and ~115 at 320×568 (field scale 0.435 / 0.344), and ~200 when the
 * Detail band is opened during setup and the field shrinks to the setup Stage.
 * 560 logical px a side covers all of those; 240 above and below covers the
 * boss nameplate's reserved strip. The two bakes cost the same (~2.5 Mpx).
 */
export function apronMargins(map: GameMap): { x: number; y: number } {
  return map.orientation === 'portrait' ? { x: 560, y: 240 } : { x: APRON_X, y: APRON_Y }
}

/**
 * Baked aprons, most recent first. Two entries, not one: the menu's attract
 * battle is always the landscape Green Line while a phone battle is now fought
 * on a portrait twin, and a one-entry cache re-baked ~2.5 Mpx of forest on every
 * trip between the menu and a battle.
 */
const CACHE_SIZE = 2
let cache: { key: string; canvas: HTMLCanvasElement }[] = []
onSpritesReady(() => {
  cache = []
})

/** The baked apron for this map, or null before the pack has decoded. */
export function getApron(map: GameMap): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const style = getActiveStyle()
  if (!style.sprites) return null
  // Roles resolve down the theme's fallback chain one by one (sprites.ts).
  const grass = spriteFor('grass')
  if (!grass) return null
  // G1-2: a map challenge does not change the woodland round the field, so the
  // apron is keyed (and seeded) on the plain twin's id — no re-bake per rule,
  // nor (Q1) per battle's danger-ground seed.
  const apronId = map.baseId ? `${map.baseId}${map.orientation === 'portrait' ? '-tall' : ''}` : map.id
  const key = `${style.id}:${apronId}:${map.width}x${map.height}:${grass.pack}/${grass.img.naturalWidth}:${decoStamp()}`
  const hit = cache.find((e) => e.key === key)
  if (hit) {
    cache = [hit, ...cache.filter((e) => e !== hit)]
    return hit.canvas
  }

  const M = apronMargins(map)
  const W = map.width + M.x * 2
  const H = map.height + M.y * 2
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false
  // 1. The same grass the field is tiled with, at the same density.
  const gpm = pixmap(grass.img, { scale: grass.spriteScale })
  ctx.fillStyle = ctx.createPattern(gpm ? (gpm.img as CanvasImageSource) : grass.img, 'repeat')!
  ctx.fillRect(0, 0, W, H)

  // 2. Forest. A jittered grid of the field's own framing trees, everywhere
  //    outside the field's box, thicker the further out it gets. Sorted by
  //    foot so crowns overlap back-to-front.
  const { trees, litter } = decoPools()
  const rng = mulberry32((apronId.length * 2654435761) ^ (map.path.length * 40503) ^ 0x9e37)
  const fx0 = M.x, fy0 = M.y, fx1 = M.x + map.width, fy1 = M.y + map.height
  const put: { x: number; y: number; name: string; flip: boolean }[] = []
  const STEP_X = 44
  const STEP_Y = 30
  for (let gy = -40; gy < H + 90; gy += STEP_Y) {
    for (let gx = -20; gx < W + 40; gx += STEP_X) {
      const x = Math.round(gx + (rng() - 0.5) * 34 + ((gy / STEP_Y) % 2 ? STEP_X / 2 : 0))
      const y = Math.round(gy + (rng() - 0.5) * 22)
      // Distance outside the field box (0 inside).
      const dx = x < fx0 ? fx0 - x : x > fx1 ? x - fx1 : 0
      const dy = y < fy0 ? fy0 - y : y > fy1 + 70 ? y - fy1 - 70 : 0
      const out = Math.max(dx, dy)
      if (out <= 0) continue
      // A thin fringe right at the edge, dense woodland beyond it.
      // Clearings: a slow wave through the wood so it is not one flat mat.
      const glade = Math.sin(x * 0.011 + 1.3) * Math.cos(y * 0.013 + 0.4)
      const p = (out < 40 ? 0.32 : out < 110 ? 0.62 : 0.78) * (glade > 0.55 ? 0.25 : 1)
      if (rng() > p) continue
      const pool = out < 30 && rng() < 0.5 ? litter : trees
      put.push({ x, y, name: pool[Math.floor(rng() * pool.length)], flip: rng() < 0.5 })
    }
  }
  put.sort((a, b) => a.y - b.y)
  for (const d of put) {
    const spr = spriteFor(d.name)
    if (!spr) continue
    const pm = pixmap(spr.img, { scale: spr.spriteScale })
    if (!pm) continue
    ctx.beginPath()
    ctx.ellipse(d.x, d.y - 2, pm.fw * 0.34, pm.fw * 0.14, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.fill()
    const x = d.x - Math.round(pm.fw / 2)
    const y = d.y - pm.fh
    if (d.flip) {
      ctx.save()
      ctx.translate(d.x, 0)
      ctx.scale(-1, 1)
      ctx.translate(-d.x, 0)
      ctx.drawImage(pm.img, x, y, pm.fw, pm.fh)
      ctx.restore()
    } else {
      ctx.drawImage(pm.img, x, y, pm.fw, pm.fh)
    }
  }

  // 3. The field's own environment grade, so the two surfaces are one palette.
  gradeEnvironment(ctx, W, H)

  // 4. Shade. The clearing is lit and the wood is not: a flat step down at the
  //    field's edge (so the boundary reads as intentional, a treeline, rather
  //    than as a seam), deepening toward the Stage's own edges.
  ctx.fillStyle = 'rgba(18,11,5,0.34)'
  ctx.fillRect(0, 0, W, H)
  const shade = (x0: number, y0: number, x1: number, y1: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0, 'rgba(18,11,5,0)')
    g.addColorStop(1, 'rgba(18,11,5,0.66)')
    return g
  }
  ctx.fillStyle = shade(0, fy0, 0, 0)
  ctx.fillRect(0, 0, W, fy0)
  ctx.fillStyle = shade(0, fy1, 0, H)
  ctx.fillRect(0, fy1, W, H - fy1)
  ctx.fillStyle = shade(fx0, 0, 0, 0)
  ctx.fillRect(0, 0, fx0, H)
  ctx.fillStyle = shade(fx1, 0, W, 0)
  ctx.fillRect(fx1, 0, W - fx1, H)
  // A soft falloff hugging the field box — the clearing's rim, not a frame.
  const rim = 26
  const band = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1)
    g.addColorStop(0, 'rgba(10,6,2,0.4)')
    g.addColorStop(1, 'rgba(10,6,2,0)')
    ctx.fillStyle = g
    ctx.fillRect(rx, ry, rw, rh)
  }
  band(0, fy0, 0, fy0 - rim, 0, fy0 - rim, W, rim)
  band(0, fy1, 0, fy1 + rim, 0, fy1, W, rim)
  band(fx0, 0, fx0 - rim, 0, fx0 - rim, 0, rim, H)
  band(fx1, 0, fx1 + rim, 0, fx1, 0, rim, H)
  cache = [{ key, canvas: c }, ...cache].slice(0, CACHE_SIZE)
  return c
}
