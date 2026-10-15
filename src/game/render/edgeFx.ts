import type { EdgeKind, FieldSeason } from '../data/fieldSeasons'
import type { GameMap } from '../types'
import type { FxLevel } from './fxQuality'
import { PixelBatch } from './pixelBatch'
import { drawnRoad, worldOf } from './terrain'

/**
 * The company world at the battlefield's edges (Oct 2026). The designer:
 * "Edges only" — embers, leaves, sparks and drizzle, paint and blossom,
 * petals and mist, snow and stars, in a thin band along the margins of the
 * view, in the run's world and season (`data/fieldSeasons.ts`, `edge`).
 *
 * Never over the game: a particle lives only in a cell of the map that is
 * clear of the road (and its verge), every build slot and the wagon, and
 * only within the band at the view's edges; one that drifts out of either
 * is gone. It is drawn under the wagon and the units in any case. One per
 * battle (`BattleCanvas` makes it), drawn inside the battle's own loop — no
 * second rAF. Respects the effects level: Light halves it, reduced motion
 * (`off`) clears it. `Math.random` only: never a run's RNG stream.
 */
interface P {
  kind: EdgeKind
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
  color: string
  phase: number
}

/** Cell size of the clear-of-the-game grid, field px. */
const CELL = 8

const COLORS: Record<EdgeKind, readonly string[]> = {
  ember: ['#fff3c0', '#ffd35e', '#ff8a2c'],
  leaf: ['#b86a26', '#9c5420', '#c88a34'],
  fleck: ['#c6a4ff', '#e2aa5a', '#5fb0a8', '#e58fb0'],
  blossom: ['#f6d2de', '#fbeef2', '#e9a8bf'],
  spark: ['#fff6d8', '#ffe08a'],
  ash: ['#8a939e', '#b3bcc6'],
  drizzle: ['#b8c6d8'],
  petal: ['#e9a8bf', '#f6d2de', '#d98aa6'],
  mote: ['#f2e8f0'],
  snow: ['#ffffff', '#eef3f8'],
  star: ['#ffffff', '#d4daf2'],
}

/** Which cells of a map are clear of the road (and its verge), every slot and the wagon (`CELL` px). */
export interface ClearGrid {
  key: string
  ok: Uint8Array
  x0: number
  y0: number
  cols: number
  rows: number
}
const GRIDS = new WeakMap<GameMap, ClearGrid>()

/** The clear-of-the-game grid for `map` (cached per map; shared by the edge band and the weather). */
export function clearGrid(map: GameMap): ClearGrid {
  const key = `${map.id}:${map.width}x${map.height}:${map.slots.length}`
  const hit = GRIDS.get(map)
  if (hit?.key === key) return hit
  const W = worldOf(map)
  const cols = Math.ceil(W.w / CELL)
  const rows = Math.ceil(W.h / CELL)
  const ok = new Uint8Array(cols * rows).fill(1)
  const T = map.tile ?? 40
  const block = (cx: number, cy: number, r: number) => {
    const c0 = Math.max(0, Math.floor((cx - r - W.x0) / CELL))
    const c1 = Math.min(cols - 1, Math.floor((cx + r - W.x0) / CELL))
    const r0 = Math.max(0, Math.floor((cy - r - W.y0) / CELL))
    const r1 = Math.min(rows - 1, Math.floor((cy + r - W.y0) / CELL))
    for (let j = r0; j <= r1; j++)
      for (let i = c0; i <= c1; i++) {
        const x = W.x0 + (i + 0.5) * CELL
        const y = W.y0 + (j + 0.5) * CELL
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) ok[j * cols + i] = 0
      }
  }
  // The road and its verge, sampled along every segment.
  const road = drawnRoad(map)
  for (let k = 1; k < road.length; k++) {
    const a = road[k - 1]
    const b = road[k]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const n = Math.max(1, Math.ceil(len / (CELL * 2)))
    for (let s = 0; s <= n; s++) block(a.x + ((b.x - a.x) * s) / n, a.y + ((b.y - a.y) * s) / n, 20 + 22)
  }
  for (const sl of map.slots) block(sl.pos.x, sl.pos.y, T * 0.85)
  block(map.base.x, map.base.y, 96)
  const g = { key, ok, x0: W.x0, y0: W.y0, cols, rows }
  GRIDS.set(map, g)
  return g
}

/** Is (x, y) on a clear cell? */
export function isClear(g: ClearGrid, x: number, y: number): boolean {
  const i = Math.floor((x - g.x0) / CELL)
  const j = Math.floor((y - g.y0) / CELL)
  return i >= 0 && j >= 0 && i < g.cols && j < g.rows && g.ok[j * g.cols + i] === 1
}

export class EdgeBand {
  private parts: P[] = []
  private batch = new PixelBatch()
  /** Particles alive (the review's numbers). */
  count = 0
  /** The most it keeps alive on a phone and a desk at Full (a season with weather keeps fewer). */
  caps = { phone: 24, desk: 40 }

  /**
   * One frame: step, spawn and draw, in field px, on a context set up for the
   * field (call it after the terrain, before the wagon and the units).
   * `cssPerField`: CSS px per field px, so a flake is the same size on a
   * phone and a desk.
   */
  frame(
    ctx: CanvasRenderingContext2D,
    map: GameMap,
    view: { x0: number; y0: number; w: number; h: number },
    cssPerField: number,
    season: FieldSeason | null,
    level: FxLevel,
    dtMs: number,
  ): void {
    if (!season || level === 'off') {
      this.parts = []
      this.count = 0
      return
    }
    const g = clearGrid(map)
    const dt = Math.min(0.05, Math.max(0, dtMs / 1000))
    const u = Math.max(1, Math.round(2 / Math.max(0.1, cssPerField)))
    const band = Math.max(10, Math.round(26 / Math.max(0.1, cssPerField)))
    const phone = view.w * cssPerField < 700
    const cap = Math.round((phone ? this.caps.phone : this.caps.desk) * (level === 'light' ? 0.5 : 1))
    const inBand = (x: number, y: number, slack: number) => {
      const b = band * slack
      return x < view.x0 + b || x > view.x0 + view.w - b || y < view.y0 + b || y > view.y0 + view.h - b
    }
    const inView = (x: number, y: number) => x >= view.x0 && x <= view.x0 + view.w && y >= view.y0 && y <= view.y0 + view.h

    // Step: drift, and go when out of the band, off the clear ground or old.
    this.parts = this.parts.filter((q) => {
      q.age += dt
      if (q.age >= q.life) return false
      switch (q.kind) {
        case 'ember':
        case 'leaf':
        case 'blossom':
        case 'petal':
        case 'snow':
          q.vx = Math.sin(q.age * 1.9 + q.phase) * 8 * u
          break
        case 'spark':
          q.vy += 90 * u * dt
          break
      }
      q.x += q.vx * dt
      q.y += q.vy * dt
      return inView(q.x, q.y) && inBand(q.x, q.y, 1.4) && isClear(g, q.x, q.y)
    })
    if (this.parts.length > cap) this.parts.splice(0, this.parts.length - cap)
    // Spawn: up to two a frame, each on a clear cell inside the band.
    for (let n = 0; n < 2 && this.parts.length < cap; n++) {
      for (let tries = 0; tries < 8; tries++) {
        const side = Math.floor(Math.random() * 4)
        const t = Math.random()
        const d = Math.random() * band
        const x = side === 0 ? view.x0 + d : side === 1 ? view.x0 + view.w - d : view.x0 + t * view.w
        const y = side === 2 ? view.y0 + d : side === 3 ? view.y0 + view.h - d : view.y0 + t * view.h
        if (!isClear(g, x, y)) continue
        this.parts.push(this.spawn(season.edge[Math.floor(Math.random() * season.edge.length)], x, y, u))
        break
      }
    }
    this.count = this.parts.length

    // Draw, in whole field px.
    const B = this.batch
    for (const q of this.parts) {
      const k = q.age / q.life
      const fade = Math.min(1, q.age / 0.3, (1 - k) * 3)
      const x = Math.round(q.x)
      const y = Math.round(q.y)
      const s = q.size
      B.color = q.color
      switch (q.kind) {
        case 'ember':
          B.alpha = fade * 0.45
          B.color = '#e0521f'
          B.rect(x - u, y - u, s + 2 * u, s + 2 * u)
          B.alpha = fade
          B.color = k < 0.4 ? '#ffd35e' : '#ff8a2c'
          B.rect(x, y, s, s)
          break
        case 'spark':
          B.alpha = fade * 0.6
          B.color = '#ff8a2c'
          B.rect(Math.round(x - q.vx * 0.03), Math.round(y - q.vy * 0.03), u, u)
          B.alpha = fade
          B.color = q.color
          B.rect(x, y, s, s)
          break
        case 'drizzle':
          B.alpha = fade * 0.55
          B.rect(x, y, u, 4 * u)
          break
        case 'leaf': {
          const turn = Math.sin(q.age * 4 + q.phase) > 0
          B.alpha = fade
          B.rect(x, y, turn ? 2 * u : u, turn ? u : 2 * u)
          break
        }
        case 'petal':
          B.alpha = fade * 0.9
          B.rect(x, y, s, Math.round(s * 1.5))
          break
        case 'mote':
          B.alpha = fade * 0.35
          B.rect(x, y, s, s)
          break
        case 'star': {
          const tw = 0.5 + 0.5 * Math.sin(q.age * 2.6 + q.phase)
          B.alpha = fade * (0.35 + 0.65 * tw)
          B.rect(x, y, u, u)
          if (tw > 0.75) {
            B.alpha = fade * 0.5
            B.rect(x - u, y, u, u)
            B.rect(x + u, y, u, u)
            B.rect(x, y - u, u, u)
            B.rect(x, y + u, u, u)
          }
          break
        }
        default:
          B.alpha = fade * (q.kind === 'ash' ? 0.6 : 0.9)
          B.rect(x, y, s, s)
      }
    }
    B.flush(ctx)
  }

  private spawn(kind: EdgeKind, x: number, y: number, u: number): P {
    const r = Math.random
    const color = COLORS[kind][Math.floor(r() * COLORS[kind].length)]
    const base: P = { kind, x, y, vx: 0, vy: 0, age: 0, life: 3, size: 2 * u, color, phase: r() * 6.28 }
    switch (kind) {
      case 'ember':
        return { ...base, vy: -(10 + r() * 14) * u, life: 2 + r(), size: (r() < 0.4 ? 3 : 2) * u }
      case 'spark':
        return { ...base, vx: (r() - 0.5) * 30 * u, vy: -(30 + r() * 25) * u, life: 0.8 + r() * 0.5, size: u * (r() < 0.5 ? 2 : 1) }
      case 'leaf':
      case 'blossom':
      case 'petal':
        return { ...base, vy: (8 + r() * 8) * u, life: 3 + r() * 2 }
      case 'snow':
        return { ...base, vy: (7 + r() * 7) * u, life: 4 + r() * 2, size: (r() < 0.3 ? 3 : 2) * u }
      case 'drizzle':
        return { ...base, vx: -6 * u, vy: (70 + r() * 30) * u, life: 0.5 + r() * 0.3 }
      case 'ash':
        return { ...base, vx: (r() - 0.5) * 4 * u, vy: (5 + r() * 4) * u, life: 4, size: u }
      case 'mote':
        return { ...base, vx: (r() < 0.5 ? -1 : 1) * (4 + r() * 4) * u, vy: -r() * 2 * u, life: 4 + r() * 2, size: 3 * u }
      case 'star':
        return { ...base, life: 2.5 + r() * 2, size: u }
      case 'fleck':
        return { ...base, vx: (r() - 0.5) * 6 * u, vy: (3 + r() * 5) * u, life: 4 + r() * 2 }
    }
  }
}
