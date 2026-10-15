/**
 * The trade war's banners at the field's margins (Draft 4 § D, mockup 3d).
 *
 * On a company's road its standards stand in the forest at the field's
 * edges — the employer's first, and, when another company leads the season,
 * every other spot flies the leader's ("its banners line every road"). On
 * the Sovereign Route, your own road, they are your militia's banner. They
 * frame the field: **never on the lane, never on a tile a hero can stand on,
 * never over the caravan** (CLAUDE.md: decoration frames the map at its
 * margins). Like the caravan, the spots are SEARCHED, not authored
 * ({@link marginBannerSpots}), so every field — hand-made or generated, in
 * either orientation, under every challenge — gets them by one rule, held by
 * `tests/marginBanners.test.ts`.
 *
 * Original pixel art: the same rows the wagon's flag and the notice fly
 * (`data/companyStandard.ts`, `data/banner.ts`), baked once per look and
 * blitted at a whole pixel unit. Pure presentation: it reads no engine state.
 */
import type { GameMap } from '../types'
import type { Vec2 } from '../core/vec'
import { pixelRuns, type Palette, type PixelRows } from '../data/pixelArt'
import { BANNER_H, BANNER_W, bannerKey, bannerPalette, bannerRows, type BannerLook } from '../data/banner'
import type { CompanyId } from '../data/companies'
import { companyStandardPalette, companyStandardRows, STANDARD_H, STANDARD_W, standardKey, type StandardLook } from '../data/companyStandard'
import { CARAVAN_BOX, caravanLayout, laneClear, onlyForest } from './caravan'
import { playRect } from './terrain'

/** One flag at the margins: a company's standard (as you dressed it), or a militia's banner. */
export type MarginFlag = { company: CompanyId; livery?: StandardLook | null } | { banner: BannerLook }

/** The most banners a field flies. */
export const MARGIN_BANNERS = 4
/** A company standard's cell, field px: 19 × 30 cells at 2 px, the wagon's flag's size. */
const STANDARD_UNIT = 2
/** A militia banner's cell: 13 × 20 cells at 3 px, the same box. */
const BANNER_UNIT = 3
/** The box every flag fits, its foot at the spot (the pole's base). */
export const FLAG_BOX = { w: Math.max(STANDARD_W * STANDARD_UNIT, BANNER_W * BANNER_UNIT), h: Math.max(STANDARD_H * STANDARD_UNIT, BANNER_H * BANNER_UNIT) } as const
/** Inside the play rect's edge (`terrain.playRect`, the part every Stage shows): never cropped. */
const EDGE = 6
/** How close to an edge a spot must be to count as the margin. */
const MARGIN_BAND = 150
/** How far a banner keeps from the caravan's box. */
const CARAVAN_CLEAR = 28
/** How far a banner keeps from a hero's post (its centre). */
const POST_CLEAR = 34

/** A flag's box at a spot (its pole's foot), field px. */
export const flagBox = (at: Vec2) => ({ x0: at.x - FLAG_BOX.w / 2, x1: at.x + FLAG_BOX.w / 2, y0: at.y - FLAG_BOX.h, y1: at.y })

const SPOTS = new WeakMap<GameMap, Vec2[]>()

/**
 * Up to {@link MARGIN_BANNERS} spots for the banners: each on forest only,
 * clear of the lane, the posts and the caravan, inside the play rect (the
 * part of the field every Stage shows) and within {@link MARGIN_BAND} of its
 * edge — spread as far apart as the margin allows
 * (the first nearest an edge, then each the farthest from those placed).
 * Cached per map. A field with no forest margin flies none.
 */
export function marginBannerSpots(map: GameMap): Vec2[] {
  const hit = SPOTS.get(map)
  if (hit) return hit
  const wagon = caravanLayout(map)
  const cv = { x0: wagon.x + CARAVAN_BOX.left - CARAVAN_CLEAR, x1: wagon.x + CARAVAN_BOX.right + CARAVAN_CLEAR, y0: wagon.y + CARAVAN_BOX.top - CARAVAN_CLEAR, y1: wagon.y + CARAVAN_BOX.bottom + CARAVAN_CLEAR }
  const posts = map.slots.map((s) => s.pos)
  // Inside the part of the field every Stage shows, so no screen crops a banner.
  const pr = playRect(map)
  const r = { x0: Math.max(0, pr.x0) + EDGE, y0: Math.max(0, pr.y0) + EDGE, x1: Math.min(map.width, pr.x1) - EDGE, y1: Math.min(map.height, pr.y1) - EDGE }
  const ok: { x: number; y: number; edge: number }[] = []
  for (let y = r.y0 + FLAG_BOX.h; y <= r.y1; y += 12) {
    for (let x = r.x0 + FLAG_BOX.w / 2; x <= r.x1 - FLAG_BOX.w / 2; x += 12) {
      const b = flagBox({ x, y })
      const edge = Math.min(b.x0 - r.x0, b.y0 - r.y0, r.x1 - b.x1, r.y1 - b.y1)
      if (edge > MARGIN_BAND) continue
      if (!(b.x1 < cv.x0 || b.x0 > cv.x1 || b.y1 < cv.y0 || b.y0 > cv.y1)) continue
      if (posts.some((p) => p.x > b.x0 - POST_CLEAR && p.x < b.x1 + POST_CLEAR && p.y > b.y0 - POST_CLEAR && p.y < b.y1 + POST_CLEAR)) continue
      if (!onlyForest(map, b.x0, b.y0, b.x1, b.y1) || !laneClear(map, b.x0, b.y0, b.x1, b.y1)) continue
      ok.push({ x, y, edge })
    }
  }
  const out: Vec2[] = []
  if (ok.length) {
    // The first: the spot nearest an edge (then top-left), so the set is stable.
    ok.sort((a, b) => a.edge - b.edge || a.y - b.y || a.x - b.x)
    out.push({ x: ok[0].x, y: ok[0].y })
    // Each next: the farthest from every banner placed and from the caravan.
    const minSpread = Math.min(map.width, map.height) * 0.3
    while (out.length < MARGIN_BANNERS) {
      let best: { x: number; y: number } | null = null
      let bestD = -1
      for (const c of ok) {
        const d = Math.min(...out.map((o) => Math.hypot(c.x - o.x, c.y - o.y)), Math.hypot(c.x - wagon.x, c.y - wagon.y))
        if (d > bestD) {
          bestD = d
          best = c
        }
      }
      if (!best || bestD < minSpread) break
      out.push({ x: best.x, y: best.y })
    }
  }
  SPOTS.set(map, out)
  return out
}

/** Which flag flies at each spot: the employer's first; with a leader that is not it, every other spot is the leader's. */
export function flagsForSpots(n: number, employer: MarginFlag, leader?: MarginFlag | null): MarginFlag[] {
  return Array.from({ length: n }, (_, i) => (leader && i % 2 === 1 ? leader : employer))
}

const flagKey = (f: MarginFlag): string => ('company' in f ? `co:${f.company}:${standardKey(f.livery)}` : `b:${bannerKey(f.banner)}`)

function blit(ctx: CanvasRenderingContext2D, rows: PixelRows, pal: Palette, x: number, y: number, unit: number): void {
  for (const r of pixelRuns(rows, pal)) {
    ctx.fillStyle = r.fill
    ctx.fillRect(Math.round(x + r.x * unit), Math.round(y + r.y * unit), r.w * unit, unit)
  }
}

/** A flag drawn with its box's top-left at (x0, y0), straight to `ctx`. */
function drawFlag(ctx: CanvasRenderingContext2D, f: MarginFlag, x0: number, y0: number): void {
  if ('company' in f) {
    const w = STANDARD_W * STANDARD_UNIT
    const h = STANDARD_H * STANDARD_UNIT
    blit(ctx, companyStandardRows(f.company, f.livery), companyStandardPalette(f.company, f.livery), x0 + (FLAG_BOX.w - w) / 2, y0 + FLAG_BOX.h - h, STANDARD_UNIT)
  } else {
    const w = BANNER_W * BANNER_UNIT
    const h = BANNER_H * BANNER_UNIT
    blit(ctx, bannerRows(f.banner), bannerPalette(f.banner), x0 + (FLAG_BOX.w - w) / 2, y0 + FLAG_BOX.h - h, BANNER_UNIT)
  }
}

const BAKE = 3
const BAKES = new Map<string, HTMLCanvasElement>()

function bakeFor(f: MarginFlag): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const key = flagKey(f)
  const hit = BAKES.get(key)
  if (hit) return hit
  const cv = document.createElement('canvas')
  cv.width = Math.ceil(FLAG_BOX.w * BAKE)
  cv.height = Math.ceil(FLAG_BOX.h * BAKE)
  const cx = cv.getContext('2d')
  if (!cx) return null
  cx.imageSmoothingEnabled = false
  cx.scale(BAKE, BAKE)
  drawFlag(cx, f, 0, 0)
  if (BAKES.size >= 16) BAKES.delete(BAKES.keys().next().value as string)
  BAKES.set(key, cv)
  return cv
}

/** The banners at the field's margins: a contact shadow, then each flag, one blit apiece. */
export function drawMarginBanners(ctx: CanvasRenderingContext2D, map: GameMap, flags: readonly MarginFlag[]): void {
  const spots = marginBannerSpots(map)
  if (!spots.length || !flags.length) return
  ctx.save()
  ctx.imageSmoothingEnabled = false
  spots.forEach((at, i) => {
    const f = flags[i % flags.length]
    const b = flagBox(at)
    ctx.fillStyle = 'rgba(0,0,0,0.28)'
    ctx.beginPath()
    ctx.ellipse(at.x - FLAG_BOX.w / 2 + 6, at.y - 1, 9, 3, 0, 0, Math.PI * 2)
    ctx.fill()
    const bake = bakeFor(f)
    if (bake) ctx.drawImage(bake, b.x0, b.y0, FLAG_BOX.w, FLAG_BOX.h)
    else drawFlag(ctx, f, b.x0, b.y0)
  })
  ctx.restore()
}
