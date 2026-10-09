/**
 * The caravan at the road's end (the mercenary company: "the Gate is the
 * caravan"). A wagon stands where the road leaves the field, loaded with
 * crates in the route's colour — one crate for every third of the cargo still
 * on board — so a leak that steals cargo is SEEN to take a crate off the
 * wagon (mockup `trade/r3/4b-battle.png`). Your militia's banner flies on its
 * own pole beside it (build step 4, `CaravanLook.banner`).
 *
 * ## Where it stands
 *
 * In the forest margin, beside the road's last stretch, as close to where the
 * road leaves the field as it fits — never over a tile a hero can stand on,
 * never over the lane ({@link caravanLayout}). The spot is SEARCHED, not
 * authored: every field and its portrait twin get one by the same rule, and
 * `tests/caravan.test.ts` holds every shipped map to it. (Step 2 backed up the
 * lane and stepped off toward the field's centre, which put the wagon over
 * open ground on both fields.)
 *
 * Original pixel art in the Tiny Swords style (`data/pixelArt.ts`,
 * `data/banner.ts`), drawn with `fillRect` runs at a whole pixel unit —
 * nothing imported from a pack. Pure presentation: it reads no engine state
 * and changes nothing.
 */
import type { GameMap } from '../types'
import type { Vec2 } from '../core/vec'
import { CRATE, cratePalette, pixelRuns, WAGON, WAGON_PALETTE, type Palette, type PixelRows } from '../data/pixelArt'
import { BANNER_H, BANNER_W, bannerKey, bannerPalette, bannerRows, DEFAULT_BANNER, type BannerLook } from '../data/banner'

export interface CaravanLook {
  /** The route's company colour — the crates' band. */
  color: string
  /** Cargo still on board, 0–1. */
  cargo: number
  /** Your militia's banner, on its pole beside the wagon (the default one until you raise your own). */
  banner?: BannerLook | null
}

const WAGON_UNIT = 3
const CRATE_UNIT = 2
const BANNER_UNIT = 3
const SLOTS = 3

const WAGON_W = WAGON[0].length * WAGON_UNIT
/** The wagon's drawn height: its last two rows are clear. */
const WAGON_H = 11 * WAGON_UNIT
const CRATE_H = CRATE.length * CRATE_UNIT
const FLAG_W = BANNER_W * BANNER_UNIT
const FLAG_H = BANNER_H * BANNER_UNIT
/** The gap between the wagon's tail and the banner's pole. */
const FLAG_GAP = 2

/**
 * The caravan's box around the wagon's centre: the crates on top, the banner
 * on its pole to the right, standing on the same ground as the wheels.
 */
export const CARAVAN_BOX = {
  left: -WAGON_W / 2,
  right: WAGON_W / 2 + FLAG_GAP + FLAG_W,
  top: Math.min(-WAGON_H / 2 - CRATE_H + WAGON_UNIT, WAGON_H / 2 - FLAG_H),
  bottom: WAGON_H / 2,
} as const

/** How far the caravan's box keeps from the lane's centre line (the drawn road is ~40px wide). */
const LANE_CLEAR = 26
/** How far the caravan's box keeps from the field's edge. */
const EDGE = 10

function blit(ctx: CanvasRenderingContext2D, rows: PixelRows, pal: Palette, x: number, y: number, unit: number): void {
  for (const r of pixelRuns(rows, pal)) {
    ctx.fillStyle = r.fill
    ctx.fillRect(Math.round(x + r.x * unit), Math.round(y + r.y * unit), r.w * unit, unit)
  }
}

function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const L = dx * dx + dy * dy || 1
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Where the lane crosses the field's edge on its way out (the road's end, as the player sees it). */
export function roadExit(map: GameMap): Vec2 {
  const p = map.path
  const end = p[p.length - 1]
  const prev = p[p.length - 2] ?? p[0]
  const cx = Math.max(0, Math.min(map.width, end.x))
  const cy = Math.max(0, Math.min(map.height, end.y))
  // The last segment is axis-aligned on every shipped field; clamp along it.
  if (prev.x === end.x) return { x: end.x, y: cy }
  if (prev.y === end.y) return { x: cx, y: end.y }
  return { x: cx, y: cy }
}

/** Whether the box (field px) covers only forest — no open tile, no lane, no challenge piece. */
function onlyForest(map: GameMap, x0: number, y0: number, x1: number, y1: number): boolean {
  const tiles = map.tiles
  if (!tiles?.length) return true
  const h = (map.tile ?? 40) / 2
  for (const t of tiles) {
    if (t.pos.x + h <= x0 || t.pos.x - h >= x1 || t.pos.y + h <= y0 || t.pos.y - h >= y1) continue
    if (t.block !== 'forest') return false
  }
  return true
}

function laneClear(map: GameMap, x0: number, y0: number, x1: number, y1: number): boolean {
  const p = map.path
  // The box's distance to the lane: sample its edges every 4px.
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i]
    const b = p[i + 1]
    // Quick reject: the segment's own box, grown by the clearance.
    if (Math.max(a.x, b.x) + LANE_CLEAR < x0 || Math.min(a.x, b.x) - LANE_CLEAR > x1) continue
    if (Math.max(a.y, b.y) + LANE_CLEAR < y0 || Math.min(a.y, b.y) - LANE_CLEAR > y1) continue
    for (let x = x0; x <= x1; x += 4) {
      if (segDist({ x, y: y0 }, a, b) < LANE_CLEAR || segDist({ x, y: y1 }, a, b) < LANE_CLEAR) return false
    }
    for (let y = y0; y <= y1; y += 4) {
      if (segDist({ x: x0, y }, a, b) < LANE_CLEAR || segDist({ x: x1, y }, a, b) < LANE_CLEAR) return false
    }
  }
  return true
}

const LAYOUTS = new WeakMap<GameMap, Vec2>()

/**
 * The wagon's centre: the nearest spot to the road's exit where the whole
 * caravan (wagon, crates, banner) stands on forest inside the field and keeps
 * clear of the lane — on the outer side of the road when both sides fit, so
 * it frames the field instead of crowding it. Cached per map.
 */
export function caravanLayout(map: GameMap): Vec2 {
  const hit = LAYOUTS.get(map)
  if (hit) return hit
  const exit = roadExit(map)
  const mid = { x: map.width / 2, y: map.height / 2 }
  const R = 260
  const tries: { x: number; y: number; score: number }[] = []
  for (let y = Math.max(0, exit.y - R); y <= Math.min(map.height, exit.y + R); y += 4) {
    for (let x = Math.max(0, exit.x - R); x <= Math.min(map.width, exit.x + R); x += 4) {
      const cx = x + (CARAVAN_BOX.left + CARAVAN_BOX.right) / 2
      const cy = y + (CARAVAN_BOX.top + CARAVAN_BOX.bottom) / 2
      // Near the exit first; the outer side (away from the field's centre) wins a tie.
      tries.push({ x, y, score: Math.hypot(cx - exit.x, cy - exit.y) - 0.25 * Math.hypot(cx - mid.x, cy - mid.y) })
    }
  }
  tries.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x)
  const fits = tries.find(({ x, y }) => {
    const x0 = x + CARAVAN_BOX.left
    const x1 = x + CARAVAN_BOX.right
    const y0 = y + CARAVAN_BOX.top
    const y1 = y + CARAVAN_BOX.bottom
    // Off the field's very edge too: the Stage crops there on some screens.
    if (x0 < EDGE || y0 < EDGE || x1 > map.width - EDGE || y1 > map.height - EDGE) return false
    return onlyForest(map, x0, y0, x1, y1) && laneClear(map, x0, y0, x1, y1)
  })
  // No forest fits (a field without a margin): just inside the exit.
  const at = fits ? { x: fits.x, y: fits.y } : { x: exit.x - CARAVAN_BOX.right, y: exit.y + 48 }
  LAYOUTS.set(map, at)
  return at
}

/** Where the wagon stands (its centre) — the cargo floater rises from here. */
export const caravanSpot = (map: GameMap): Vec2 => caravanLayout(map)

/**
 * The caravan's pixels — wagon, load and banner — baked once per look
 * (October audit 4.4). They were re-rasterised every frame: the pixel runs,
 * the banner rows and both palettes rebuilt, then several hundred `fillRect`s,
 * which made the caravan one of the hottest functions on a throttled phone.
 * Now a look (crate colour, crates on board, banner) is drawn once into a
 * small canvas at {@link BAKE} device px per field px, and each frame is one
 * `drawImage` with smoothing off — the same nearest-neighbour pixels.
 *
 * The bake's origin is the caravan box's top-left; the ground shadows stay
 * live vector (cheap, and they sit under the bake).
 */
const BAKE = 3
const BAKES = new Map<string, HTMLCanvasElement>()
const BAKE_MAX = 24

function bakeKey(look: CaravanLook, full: number): string {
  const b = look.banner ?? DEFAULT_BANNER
  return `${look.color}|${full}|${bannerKey(b)}`
}

/** The caravan's pixels drawn at `(x0, y0)` (the wagon's top-left), straight to `ctx`. */
function drawPixels(ctx: CanvasRenderingContext2D, look: CaravanLook, full: number, x0: number, y0: number): void {
  const ground = y0 + WAGON_H
  const flagX = x0 + WAGON_W + FLAG_GAP
  blit(ctx, WAGON, WAGON_PALETTE, x0, y0, WAGON_UNIT)
  // The load: one crate per third of the cargo still on board.
  const cw = CRATE[0].length * CRATE_UNIT
  const bedLeft = x0 + 7 * WAGON_UNIT
  const bedW = WAGON_W - 8 * WAGON_UNIT
  const gap = (bedW - SLOTS * cw) / (SLOTS - 1 || 1)
  const pal = cratePalette(look.color)
  for (let i = 0; i < full; i++) blit(ctx, CRATE, pal, bedLeft + i * (cw + gap), y0 - CRATE_H + WAGON_UNIT, CRATE_UNIT)
  // The banner, its pole planted beside the wagon's tail.
  const b = look.banner ?? DEFAULT_BANNER
  ctx.fillStyle = 'rgba(0,0,0,0.26)'
  ctx.fillRect(flagX - 1, ground - 2, 6, 2)
  blit(ctx, bannerRows(b), bannerPalette(b), flagX, ground - FLAG_H, BANNER_UNIT)
}

/** The baked look, or null where there is no DOM (tests) — then the caller draws live. */
function bakeFor(look: CaravanLook, full: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const key = bakeKey(look, full)
  const hit = BAKES.get(key)
  if (hit) return hit
  const w = CARAVAN_BOX.right - CARAVAN_BOX.left
  const h = CARAVAN_BOX.bottom - CARAVAN_BOX.top
  const cv = document.createElement('canvas')
  cv.width = Math.ceil(w * BAKE)
  cv.height = Math.ceil(h * BAKE)
  const cx = cv.getContext('2d')
  if (!cx) return null
  cx.imageSmoothingEnabled = false
  cx.scale(BAKE, BAKE)
  // The wagon's top-left sits at (-left, -top) inside the box.
  drawPixels(cx, look, full, -CARAVAN_BOX.left - WAGON_W / 2, -CARAVAN_BOX.top - WAGON_H / 2)
  if (BAKES.size >= BAKE_MAX) BAKES.delete(BAKES.keys().next().value as string)
  BAKES.set(key, cv)
  return cv
}

export function drawCaravan(ctx: CanvasRenderingContext2D, map: GameMap, look: CaravanLook): void {
  const at = caravanLayout(map)
  const x0 = Math.round(at.x - WAGON_W / 2)
  const y0 = Math.round(at.y - WAGON_H / 2)
  const ground = y0 + WAGON_H
  ctx.save()
  // A trodden patch under the caravan, so it stands in a clearing rather than
  // on the treetops, then the contact shadow every object on the field has.
  ctx.fillStyle = 'rgba(74, 56, 34, 0.55)'
  ctx.beginPath()
  ctx.ellipse(at.x + (FLAG_GAP + FLAG_W) / 2, ground - 8, (WAGON_W + FLAG_W) * 0.56, 16, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.26)'
  ctx.beginPath()
  ctx.ellipse(at.x + 6, ground - 6, WAGON_W * 0.46, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  const full = Math.max(0, Math.min(SLOTS, Math.ceil(look.cargo * SLOTS - 1e-6)))
  const bake = bakeFor(look, full)
  if (bake) {
    ctx.imageSmoothingEnabled = false
    const bx = x0 + WAGON_W / 2 + CARAVAN_BOX.left
    const by = y0 + WAGON_H / 2 + CARAVAN_BOX.top
    ctx.drawImage(bake, bx, by, CARAVAN_BOX.right - CARAVAN_BOX.left, CARAVAN_BOX.bottom - CARAVAN_BOX.top)
  } else drawPixels(ctx, look, full, x0, y0)
  ctx.restore()
}
