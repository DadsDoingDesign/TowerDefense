/**
 * The caravan at the road's end (the mercenary company: "the Gate is the
 * caravan"). A wagon stands just inside the gate, off the lane, loaded with
 * crates in the route's colour — one crate for every third of the cargo still
 * on board — so a leak that steals cargo is SEEN to take a crate off the
 * wagon (mockup `trade/r3/4b-battle.png`). The militia's banner flies beside
 * it in build step 4: `CaravanLook.banner` is the slot for it.
 *
 * Original pixel art in the Tiny Swords style (`data/pixelArt.ts`), drawn
 * with `fillRect` runs at a whole pixel unit — nothing imported from a pack.
 * Pure presentation: it reads no engine state and changes nothing.
 */
import type { GameMap } from '../types'
import { CRATE, cratePalette, pixelRuns, WAGON, WAGON_PALETTE, type Palette, type PixelRows } from '../data/pixelArt'
import { baseAnchor } from './overlays'

export interface CaravanLook {
  /** The route's company colour — the crates' band. */
  color: string
  /** Cargo still on board, 0–1. */
  cargo: number
  /** Build step 4: the militia's banner, drawn on the wagon's pole. Unused until then. */
  banner?: null
}

const WAGON_UNIT = 3
const CRATE_UNIT = 2
const SLOTS = 3

function blit(ctx: CanvasRenderingContext2D, rows: PixelRows, pal: Palette, x: number, y: number, unit: number): void {
  for (const r of pixelRuns(rows, pal)) {
    ctx.fillStyle = r.fill
    ctx.fillRect(Math.round(x + r.x * unit), Math.round(y + r.y * unit), r.w * unit, unit)
  }
}

/** Where the wagon stands: just inside the gate, beside the lane, on the field side. */
export function caravanSpot(map: GameMap): { x: number; y: number } {
  const a = baseAnchor(map)
  const p = map.path
  const prev = p[p.length - 2] ?? p[0]
  const end = p[p.length - 1]
  const len = Math.hypot(end.x - prev.x, end.y - prev.y) || 1
  const dx = (end.x - prev.x) / len
  const dy = (end.y - prev.y) / len
  // Back up the lane from the gate, then step off it to the side nearer the
  // field's centre, so the wagon frames the road's end without covering it.
  const back = { x: a.x - dx * 70, y: a.y - dy * 70 }
  const side = { x: -dy, y: dx }
  const toward = (map.width / 2 - back.x) * side.x + (map.height / 2 - back.y) * side.y >= 0 ? 1 : -1
  return { x: back.x + side.x * 64 * toward, y: back.y + side.y * 64 * toward }
}

export function drawCaravan(ctx: CanvasRenderingContext2D, map: GameMap, look: CaravanLook): void {
  const at = caravanSpot(map)
  const w = WAGON[0].length * WAGON_UNIT
  const h = WAGON.length * WAGON_UNIT
  const x0 = Math.round(at.x - w / 2)
  const y0 = Math.round(at.y - h / 2)
  ctx.save()
  // Contact shadow, like every other object on the field.
  ctx.fillStyle = 'rgba(0,0,0,0.26)'
  ctx.beginPath()
  ctx.ellipse(at.x + 6, y0 + h - 6, w * 0.46, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  blit(ctx, WAGON, WAGON_PALETTE, x0, y0, WAGON_UNIT)
  // The load: one crate per third of the cargo still on board.
  const full = Math.max(0, Math.min(SLOTS, Math.ceil(look.cargo * SLOTS - 1e-6)))
  const cw = CRATE[0].length * CRATE_UNIT
  const ch = CRATE.length * CRATE_UNIT
  const bedLeft = x0 + 7 * WAGON_UNIT
  const bedW = w - 8 * WAGON_UNIT
  const gap = (bedW - SLOTS * cw) / (SLOTS - 1 || 1)
  const pal = cratePalette(look.color)
  for (let i = 0; i < full; i++) blit(ctx, CRATE, pal, bedLeft + i * (cw + gap), y0 - ch + WAGON_UNIT, CRATE_UNIT)
  ctx.restore()
}
