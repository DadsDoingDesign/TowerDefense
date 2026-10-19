import type { FieldSeason, WeatherKind } from '../data/fieldSeasons'
import type { GameMap } from '../types'
import type { FxLevel } from './fxQuality'
import { clearGrid, isClear, type ClearGrid } from './edgeFx'
import { PixelBatch } from './pixelBatch'
import { hash01 } from './seasonHash'

/**
 * The season's weather on the battlefield (Oct 2026; the designer: "map
 * seasons should have more visual interest beyond a color filter"): rain
 * with its splashes, steady snow, petals, glowing spores rising, dust and
 * seed fluff in a low sun, dew twinkling, fog banks drifting at different
 * speeds, cloud shadows crossing the field, and now and then a far flash.
 *
 * The game always reads on top of it:
 *  - it is drawn under the wagon, the units, the shots, the HP bars and the
 *    plaques (`BattleCanvas` calls it right after the terrain);
 *  - it is sparse and faint over the game — the road and its verge, every
 *    open tile, the wagon (`edgeFx.clearGrid`) — and full only on the clear
 *    ground at the margins: a particle over the game is drawn at a third of
 *    its strength, few spawn there, and nothing lands or splashes there;
 *  - the fog and the cloud shadows go through a mask that keeps them thick at
 *    the view's edges and thin over the game; the flash lights the margins
 *    only, so it never washes out the lane.
 *
 * The calm pass (Oct 2026; the designer: "a bit overwhelming now that I'm
 * playing more"): 40–50% of the old particles, the sheets narrower, sparser
 * and fainter, the fog and the clouds fainter, everything at
 * {@link WEATHER_PEAK} of its old strength, a particle over the game at
 * {@link OVER_GAME} of its own, and the flash rarer and fainter.
 *
 * Capped (`SeasonWeather.count`: ≤ 18 on a phone, ~1.7× on a desk, plus a few
 * large shapes — fog banks, cloud shadows, the rain or snow sheet); Light
 * halves the particles and the fog, keeps one sheet, drops the cloud shadows
 * and the flash, and redraws the fog at half the rate; the particles are
 * batched (`pixelBatch.ts`), a dozen fills a frame; reduced motion (`off`) draws none of it — the
 * baked season stays. One per battle (`BattleCanvas` makes it), drawn inside
 * the battle's own loop. `Math.random` only: never a run's RNG stream.
 */
interface WP {
  kind: WeatherKind
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  /** Where a falling particle lands (field px), or Infinity. */
  land: number
  /** Landed: splashing / settling, for this long. */
  down: number
  color: string
  phase: number
  size: number
}

const COLORS: Record<WeatherKind, readonly string[]> = {
  rain: ['#c4d2e4', '#dae4f0'],
  snow: ['#ffffff', '#eef4fb', '#dfe8f4'],
  petal: ['#f6c8da', '#fbe6ee', '#e9a2bc', '#ffffff'],
  leaf: ['#cc6e30', '#dca238', '#9e4a2a', '#b8502e'],
  dust: ['#fff2c4', '#ffe7a0'],
  fluff: ['#fffaf0', '#f4ecdc'],
  butterfly: ['#fdf6e8', '#f6dc6a', '#c8dcf4'],
  dew: ['#ffffff', '#e6f4ff'],
  spore: ['#cfe86a', '#a8e08a', '#7fe0c4'],
}

/** A drifting shape for the fog or the cloud shadows: a posterised blob on a small canvas. */
interface Blob {
  img: HTMLCanvasElement
  /** Where it starts, as shares of the view (x wraps). */
  fx: number
  fy: number
  /** Its drift (× the veil's speed) and strength: a far bank is slower and fainter (parallax). */
  speed: number
  alpha: number
}

/**
 * A low-resolution layer over the view: blobs drifting through a margin
 * mask, drawn up with crisp pixels. Only the rows the blobs cover are
 * blitted (in bands), so a veil costs what it covers, not the whole screen.
 */
class Veil {
  blobs: Blob[] = []
  private c: HTMLCanvasElement | null = null
  private g: CanvasRenderingContext2D | null = null
  private mask: HTMLCanvasElement | null = null
  private maskKey = ''
  private skip = 0
  /** The rows drawn last redraw, as bands: [y0, y1, x0, x1] in veil cells. */
  private bands: number[][] = []

  constructor(
    private readonly color: string,
    private readonly over: number,
  ) {}

  /** Add `n` blobs of about `w × h` veil cells (a fixed set: the same shapes every battle). */
  build(n: number, w: number, h: number, salt: number, speed = 1, alpha = 1, edges = false): void {
    if (typeof document === 'undefined') return
    for (let k = 0; k < n; k++) {
      const bw = Math.round(w * (0.7 + hash01(k, salt, 1) * 0.6))
      const bh = Math.round(h * (0.6 + hash01(k, salt, 2) * 0.6))
      const img = document.createElement('canvas')
      img.width = bw
      img.height = bh
      const g = img.getContext('2d')
      if (!g) continue
      const id = g.createImageData(bw, bh)
      const [r, gg, b] = hex(this.color)
      // Lumps along the bank, then three steps of density with an ordered dither between them.
      const lumps = Array.from({ length: 5 }, (_, i) => ({ x: (0.15 + 0.7 * (i / 4)) * bw, y: bh * (0.45 + (hash01(i, k + salt, 3) - 0.5) * 0.3), r: bh * (0.32 + hash01(i, k + salt, 4) * 0.22) }))
      for (let y = 0; y < bh; y++)
        for (let x = 0; x < bw; x++) {
          let v = 0
          for (const l of lumps) v = Math.max(v, 1 - Math.hypot((x - l.x) / (l.r * 1.6), (y - l.y) / l.r))
          if (v <= 0) continue
          const step = v + (BAYER[(y & 3) * 4 + (x & 3)] - 0.5) * 0.18
          const a = step > 0.55 ? 0.85 : step > 0.3 ? 0.55 : step > 0.1 ? 0.28 : 0
          if (!a) continue
          const i = (y * bw + x) * 4
          id.data[i] = r
          id.data[i + 1] = gg
          id.data[i + 2] = b
          id.data[i + 3] = Math.round(a * 255)
        }
      g.putImageData(id, 0, 0)
      // `edges`: the bank keeps to the top or the bottom of the view (a fog lying at the margins).
      const fy = edges ? (k % 2 === 0 ? 0.02 + hash01(k, salt, 6) * 0.14 : 0.84 + hash01(k, salt, 6) * 0.14) : hash01(k, salt, 6)
      this.blobs.push({ img, fx: hash01(k, salt, 5), fy, speed: speed * (0.6 + hash01(k, salt, 7) * 0.8), alpha })
    }
  }

  /**
   * One frame: the blobs (the first `n`), drifted, through the mask, onto
   * `ctx` over `view`. `cellPx`: field px per veil cell. `t`: seconds.
   * `speed`: CSS px / s at a blob's speed 1. `half`: redraw every other
   * frame (Light; the blit still happens every frame).
   */
  draw(ctx: CanvasRenderingContext2D, grid: ClearGrid, view: View, cellPx: number, cssPerField: number, t: number, speed: number, alpha: number, half: boolean, n = this.blobs.length): void {
    if (typeof document === 'undefined' || !this.blobs.length) return
    const cw = Math.max(1, Math.ceil(view.w / cellPx))
    const ch = Math.max(1, Math.ceil(view.h / cellPx))
    if (!this.c || this.c.width !== cw || this.c.height !== ch) {
      this.c = document.createElement('canvas')
      this.c.width = cw
      this.c.height = ch
      this.g = this.c.getContext('2d')
      this.skip = 0
    }
    const g = this.g
    if (!g) return
    const mk = `${Math.round(view.x0)},${Math.round(view.y0)},${cw}x${ch}`
    if (mk !== this.maskKey) {
      this.mask = buildMask(grid, view, cw, ch, cellPx, this.over)
      this.maskKey = mk
      this.skip = 0
    }
    if (!half || this.skip++ % 2 === 0) {
      g.globalCompositeOperation = 'source-over'
      g.clearRect(0, 0, cw, ch)
      const cellsPerSec = speed / Math.max(0.1, cssPerField) / cellPx
      // Which rows each blob covers, for the bands below.
      const rows = new Int32Array(ch * 2).fill(-1)
      for (const b of this.blobs.slice(0, n)) {
        const span = cw + b.img.width
        const x = Math.round((((b.fx * span + t * cellsPerSec * b.speed) % span) + span) % span) - b.img.width
        const y = Math.round(b.fy * (ch + b.img.height * 0.5) - b.img.height * 0.5)
        g.globalAlpha = b.alpha
        g.drawImage(b.img, x, y)
        for (let r = Math.max(0, y); r < Math.min(ch, y + b.img.height); r++) {
          const x0 = Math.max(0, x)
          const x1 = Math.min(cw, x + b.img.width)
          if (x1 <= x0) continue
          rows[r * 2] = rows[r * 2] < 0 ? x0 : Math.min(rows[r * 2], x0)
          rows[r * 2 + 1] = Math.max(rows[r * 2 + 1], x1)
        }
      }
      g.globalAlpha = 1
      if (this.mask) {
        g.globalCompositeOperation = 'destination-in'
        g.drawImage(this.mask, 0, 0)
        g.globalCompositeOperation = 'source-over'
      }
      // Bands of 4 rows, each as wide as what its rows cover.
      this.bands = []
      for (let r0 = 0; r0 < ch; r0 += 4) {
        let x0 = cw
        let x1 = -1
        for (let r = r0; r < Math.min(ch, r0 + 4); r++) {
          if (rows[r * 2] < 0) continue
          x0 = Math.min(x0, rows[r * 2])
          x1 = Math.max(x1, rows[r * 2 + 1])
        }
        if (x1 > x0) this.bands.push([r0, Math.min(ch, r0 + 4), x0, x1])
      }
    }
    const a0 = ctx.globalAlpha
    const sm = ctx.imageSmoothingEnabled
    ctx.imageSmoothingEnabled = false
    ctx.globalAlpha = alpha
    for (const [y0, y1, x0, x1] of this.bands)
      ctx.drawImage(this.c!, x0, y0, x1 - x0, y1 - y0, view.x0 + x0 * cellPx, view.y0 + y0 * cellPx, (x1 - x0) * cellPx, (y1 - y0) * cellPx)
    ctx.globalAlpha = a0
    ctx.imageSmoothingEnabled = sm
  }
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16)
const hex = (h: string): [number, number, number] => {
  const v = parseInt(h.slice(1), 16)
  return [v >> 16, (v >> 8) & 255, v & 255]
}

type View = { x0: number; y0: number; w: number; h: number }

/**
 * The veil's mask: full at the view's edges and on the clear ground, `over`
 * on the game (the road, the open tiles, the wagon).
 */
function buildMask(grid: ClearGrid, view: View, cw: number, ch: number, cellPx: number, over: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const m = document.createElement('canvas')
  m.width = cw
  m.height = ch
  const g = m.getContext('2d')
  if (!g) return null
  const id = g.createImageData(cw, ch)
  const reach = Math.max(1, Math.min(cw, ch) * 0.3)
  // The game's footprint, softened (a box blur, twice) so the veil thins
  // gradually toward the lane instead of tracing the tiles' edges.
  let base = new Float32Array(cw * ch)
  for (let j = 0; j < ch; j++)
    for (let i = 0; i < cw; i++) base[j * cw + i] = isClear(grid, view.x0 + (i + 0.5) * cellPx, view.y0 + (j + 0.5) * cellPx) ? 0.75 : over
  const R = Math.max(2, Math.round(28 / cellPx))
  for (let pass = 0; pass < 2; pass++) {
    const tmp = new Float32Array(cw * ch)
    for (let j = 0; j < ch; j++) {
      let acc = 0
      for (let i = -R; i <= R; i++) acc += base[j * cw + Math.min(cw - 1, Math.max(0, i))]
      for (let i = 0; i < cw; i++) {
        tmp[j * cw + i] = acc / (2 * R + 1)
        acc += base[j * cw + Math.min(cw - 1, i + R + 1)] - base[j * cw + Math.max(0, i - R)]
      }
    }
    const out = new Float32Array(cw * ch)
    for (let i = 0; i < cw; i++) {
      let acc = 0
      for (let j = -R; j <= R; j++) acc += tmp[Math.min(ch - 1, Math.max(0, j)) * cw + i]
      for (let j = 0; j < ch; j++) {
        out[j * cw + i] = acc / (2 * R + 1)
        acc += tmp[Math.min(ch - 1, j + R + 1) * cw + i] - tmp[Math.max(0, j - R) * cw + i]
      }
    }
    base = out
  }
  for (let j = 0; j < ch; j++)
    for (let i = 0; i < cw; i++) {
      const edge = Math.min(i, j, cw - 1 - i, ch - 1 - j) / reach
      const e = edge >= 1 ? 0 : 1 - edge * edge
      // Thick at the view's edges — but never where the edge is the game (the road's way in, the wagon).
      const b = base[j * cw + i]
      const clear = Math.max(0, Math.min(1, (b - over) / Math.max(0.01, 0.75 - over)))
      const a = Math.max(b, e * clear)
      id.data[(j * cw + i) * 4 + 3] = Math.round(a * 255)
    }
  g.putImageData(id, 0, 0)
  return m
}

/**
 * A sheet of falling rain or snow: one small tile of streaks or flakes,
 * repeated and scrolled — no state, no spawning: where each drop is follows
 * from the time alone. Only in a band at the view's edges (a second,
 * narrower pass with its own tile thickens the very edge); the particles
 * carry the weather over the middle, sparsely. Drawn through the frame's
 * {@link PixelBatch}, so a downpour is a few fills.
 */
class Sheet {
  /** The tile's drops: position in the tile (0–1), and a length / size factor. */
  private drops: { x: number; y: number; s: number }[] = []

  constructor(
    private readonly kind: 'rain' | 'snow',
    salt: number,
  ) {
    // Drops a tile (7 and 9 before the calm pass).
    const n = kind === 'rain' ? 4 : 5
    for (let i = 0; i < n; i++) this.drops.push({ x: hash01(i, salt, 91), y: hash01(i, salt, 92), s: hash01(i, salt, 93) })
  }

  /** The sheet over `rects` at time `t`, falling at (vx, vy) field px / s with a sway. */
  fill(B: PixelBatch, rects: readonly View[], k: number, u: number, t: number, vx: number, vy: number, sway: number, alpha: number, grid?: ClearGrid): void {
    const T = Math.max(16, Math.round(96 * k))
    const ox = vx * t + Math.sin(t * 0.8) * sway
    const oy = vy * t
    const thin = Math.max(1, Math.round(u / 2))
    for (const r of rects) {
      const i0 = Math.floor((r.x0 - ox) / T) - 1
      const i1 = Math.floor((r.x0 + r.w - ox) / T) + 1
      const j0 = Math.floor((r.y0 - oy) / T) - 1
      const j1 = Math.floor((r.y0 + r.h - oy) / T) + 1
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++)
          for (const d of this.drops) {
            const x = Math.round(ox + (i + d.x) * T)
            const y = Math.round(oy + (j + d.y) * T)
            if (x < r.x0 || x >= r.x0 + r.w || y < r.y0 || y >= r.y0 + r.h) continue
            // Never over the game where the band meets it (the road's way
            // in, the wagon, a slot by the edge): the calm pass, Oct 2026.
            if (grid && !isClear(grid, x, y)) continue
            if (this.kind === 'rain') {
              // A slanted streak in two steps, brightest at its head.
              const len = Math.round((9 + d.s * 5) * u * 0.5)
              const half = Math.round(len / 2)
              const slant = vx / (vy || 1)
              B.color = '#e2ecf8'
              B.alpha = alpha * 0.95
              B.rect(x, y, thin, half + 1)
              B.color = '#b8c8de'
              B.alpha = alpha * 0.6
              B.rect(Math.round(x - slant * half), y - half, thin, half + 1)
            } else {
              const size = d.s < 0.35 ? 2 * u : u
              // A flake, with a cool shade under it so it reads on the snow too.
              B.alpha = alpha * 0.7
              B.color = '#96aac8'
              B.rect(x, y + size, size, thin)
              B.alpha = alpha
              B.color = '#ffffff'
              B.rect(x, y, size, size)
            }
          }
    }
  }
}

/** The band at a view's edges, as four rects (`share` of its shorter side). */
function edgeRects(view: View, share: number): View[] {
  const b = Math.min(view.w, view.h) * share
  return [
    { x0: view.x0, y0: view.y0, w: view.w, h: b },
    { x0: view.x0, y0: view.y0 + view.h - b, w: view.w, h: b },
    { x0: view.x0, y0: view.y0 + b, w: b, h: view.h - 2 * b },
    { x0: view.x0 + view.w - b, y0: view.y0 + b, w: b, h: view.h - 2 * b },
  ]
}

/** How strongly a particle shows over the game, as a share of its strength on clear ground (0.34 before the calm pass). */
export const OVER_GAME = 0.18
/** How many particles spawn over the game, as a share of those thrown there (0.3 before). */
const SPAWN_OVER_GAME = 0.12
/** Every weather particle's strength against its old one (the calm pass, Oct 2026). */
export const WEATHER_PEAK = 0.65
/** Seconds to the first far flash, and between flashes, at the least (each gets up to {@link FLASH_SPREAD_S} more). */
export const FLASH_GAP_S = 45
const FLASH_SPREAD_S = 45

export class WeatherLayer {
  private parts: WP[] = []
  private fog: Veil | null = null
  private clouds: Veil | null = null
  private veilFor: FieldSeason | null = null
  private sheets: [Sheet, Sheet] | null = null
  private batch = new PixelBatch()
  private t = 0
  private nextFlash = FLASH_GAP_S + Math.random() * FLASH_SPREAD_S
  private flash = -1
  /** Particles alive (the review's numbers). */
  count = 0
  /** Fog banks and cloud shadows alive. */
  shapes = 0

  /** The particle cap for a view: a phone's count, ~1.7× on a desk, halved by Light. */
  static cap(season: FieldSeason, phone: boolean, level: FxLevel): number {
    if (level === 'off') return 0
    return Math.round(season.weather.count * (phone ? 1 : 1.7) * (level === 'light' ? 0.5 : 1))
  }

  /**
   * One frame: step, spawn and draw, in field px, on a context set up for the
   * field (after the terrain, before the wagon and the units). `cssPerField`:
   * CSS px per field px, so a raindrop is the same size on a phone and a desk.
   */
  frame(ctx: CanvasRenderingContext2D, map: GameMap, view: View, cssPerField: number, season: FieldSeason | null, level: FxLevel, dtMs: number): void {
    if (!season || level === 'off') {
      this.parts = []
      this.count = 0
      this.shapes = 0
      return
    }
    const w = season.weather
    const grid = clearGrid(map)
    const dt = Math.min(0.05, Math.max(0, dtMs / 1000))
    this.t += dt
    const k = 1 / Math.max(0.1, cssPerField) // field px per CSS px
    const u = Math.max(1, Math.round(2 * k))
    const phone = view.w * cssPerField < 700
    const light = level === 'light'
    const cap = WeatherLayer.cap(season, phone, level)

    // The veils first: the fog lies under the particles, the clouds over the ground.
    if (this.veilFor !== season) {
      this.veilFor = season
      // Parallax: the fog in two layers on one veil, the far banks bigger, slower and fainter.
      this.fog = w.fog ? new Veil(w.fog.color, 0.16) : null
      this.fog?.build(Math.floor((w.fog?.banks ?? 0) / 2), 70, 22, 17, 1.6, 1, true)
      this.fog?.build(Math.ceil((w.fog?.banks ?? 0) / 2), 110, 34, 11, 0.6, 0.7, true)
      this.clouds = w.clouds ? new Veil(w.clouds.color, 0.3) : null
      this.clouds?.build(w.clouds?.count ?? 0, 46, 28, 23)
      this.sheets = w.sheet ? [new Sheet(w.sheet, 3), new Sheet(w.sheet, 7)] : null
    }
    const cellPx = Math.max(2, Math.round(3 * k))
    this.shapes = 0
    // Light keeps no cloud shadows (the costliest shapes: they cross the whole field).
    if (this.clouds && w.clouds && !light) {
      const n = this.clouds.blobs.length
      this.clouds.draw(ctx, grid, view, cellPx * 2, cssPerField, this.t, 7, w.clouds.alpha, false, n)
      this.shapes += n
    }
    if (this.fog && w.fog) {
      // Light keeps half the banks (the near ones first).
      const n = light ? Math.ceil(this.fog.blobs.length / 2) : this.fog.blobs.length
      this.fog.draw(ctx, grid, view, cellPx, cssPerField, this.t, 5, w.fog.alpha, light, n)
      this.shapes += n
    }
    // A far flash: the margins only, never the lane (Full only).
    if (w.lightning && !light) {
      if (this.flash < 0 && this.t > this.nextFlash) {
        this.flash = 0
        this.nextFlash = this.t + FLASH_GAP_S + Math.random() * FLASH_SPREAD_S
      }
      if (this.flash >= 0) {
        this.flash += dt
        const f = this.flash
        const a = f < 0.08 ? 1 : f < 0.16 ? 0.25 : f < 0.24 ? 0.8 : f < 0.6 ? 0.8 * (1 - (f - 0.24) / 0.36) : 0
        if (f >= 0.6) this.flash = -1
        if (a > 0) {
          const g0 = ctx.globalAlpha
          ctx.globalAlpha = 0.08 * a
          ctx.fillStyle = '#e8f0ff'
          const b = Math.min(view.w, view.h) * 0.16
          ctx.fillRect(view.x0, view.y0, view.w, b)
          ctx.fillRect(view.x0, view.y0 + view.h - b, view.w, b)
          ctx.fillRect(view.x0, view.y0 + b, b, view.h - 2 * b)
          ctx.fillRect(view.x0 + view.w - b, view.y0 + b, b, view.h - 2 * b)
          ctx.globalAlpha = g0
        }
      }
    }

    // The falling sheet, at the view's edges only: a wide band, and on Full a
    // narrower one with drops of its own (the particles carry the middle).
    // The rain's band is narrower and fainter than the snow's (the motion
    // audit, Oct 2026: at 540 px/s every pixel of a 22% band changed every
    // frame, four times the next world's motion at the battlefield's edges).
    // The calm pass (Oct 2026) narrowed both again, thinned their tiles and
    // halved their strength: the rain was still the busiest margin in the game.
    const B = this.batch
    if (this.sheets && w.sheet === 'rain') {
      const vy = 420 * k
      this.sheets[0].fill(B, edgeRects(view, 0.1), k, u, this.t, -0.22 * vy, vy, 0, 0.3, grid)
      if (!light) this.sheets[1].fill(B, edgeRects(view, 0.05), k, u, this.t + 0.37, -0.22 * vy * 1.15, vy * 1.15, 0, 0.3, grid)
      this.shapes += light ? 1 : 2
    } else if (this.sheets && w.sheet === 'snow') {
      this.sheets[0].fill(B, edgeRects(view, 0.15), k, u, this.t, -4 * k, 16 * k, 5 * k, 0.32, grid)
      if (!light) this.sheets[1].fill(B, edgeRects(view, 0.07), k, u, this.t + 3.1, -6 * k, 26 * k, 8 * k, 0.45, grid)
      this.shapes += light ? 1 : 2
    }

    // Step.
    this.parts = this.parts.filter((q) => {
      q.age += dt
      if (q.down > 0) {
        q.down -= dt
        return q.down > 0
      }
      if (q.age >= q.life) return false
      switch (q.kind) {
        case 'snow':
          q.vx = Math.sin(q.age * 1.4 + q.phase) * 9 * k
          break
        case 'petal':
        case 'leaf':
          q.vx = (Math.sin(q.age * 1.7 + q.phase) * 14 - 8) * k
          break
        case 'dust':
          q.vx = Math.sin(q.age * 0.7 + q.phase) * 4 * k
          q.vy = Math.cos(q.age * 0.9 + q.phase) * 3 * k
          break
        case 'fluff':
          q.vy = (Math.sin(q.age * 1.3 + q.phase) * 5 - 2) * k
          break
        case 'butterfly':
          q.vx = Math.cos(q.age * 0.6 + q.phase) * 26 * k
          q.vy = Math.sin(q.age * 1.1 + q.phase * 2) * 18 * k
          break
        case 'spore':
          // Riding the warm air up out of the hollows, swaying.
          q.vx = Math.sin(q.age * 0.8 + q.phase) * 5 * k
          break
      }
      q.x += q.vx * dt
      q.y += q.vy * dt
      if (q.y >= q.land) {
        // Landed: rain splashes and snow settles — on the clear ground only.
        if ((q.kind === 'rain' || q.kind === 'snow') && isClear(grid, q.x, q.y)) {
          q.down = q.kind === 'rain' ? 0.22 : 0.5
          q.vy = 0
          q.vx = 0
          return true
        }
        return false
      }
      return q.x > view.x0 - 20 * k && q.x < view.x0 + view.w + 20 * k && q.y > view.y0 - 40 * k && q.y < view.y0 + view.h + 10 * k
    })
    if (this.parts.length > cap) this.parts.splice(0, this.parts.length - cap)
    // Spawn: a few a frame, most on the clear ground; few over the game.
    for (let n = 0; n < 3 && this.parts.length < cap; n++) {
      const kind = w.kinds[Math.floor(Math.random() * w.kinds.length)]
      if (kind === 'butterfly' && this.parts.filter((p) => p.kind === 'butterfly').length >= (light ? 1 : 2)) continue
      for (let tries = 0; tries < 6; tries++) {
        const x = view.x0 + Math.random() * view.w
        const y = view.y0 + Math.random() * view.h
        const clear = isClear(grid, x, y)
        if (kind === 'dew' && !clear) continue
        if (!clear && Math.random() > SPAWN_OVER_GAME) continue
        this.parts.push(this.spawn(kind, x, y, k, u, view))
        break
      }
    }
    this.count = this.parts.length

    // Draw, in whole field px.
    for (const q of this.parts) {
      const over = (isClear(grid, q.x, q.y) ? 1 : OVER_GAME) * WEATHER_PEAK
      const fade = Math.min(1, q.age / 0.25, q.life - q.age < 0.4 ? (q.life - q.age) / 0.4 : 1)
      const x = Math.round(q.x)
      const y = Math.round(q.y)
      B.color = q.color
      switch (q.kind) {
        case 'rain': {
          if (q.down > 0) {
            // A splash: a pair of droplets either side, then a ring.
            const s = 1 - q.down / 0.22
            B.alpha = 0.55 * (1 - s) * WEATHER_PEAK
            const r = Math.round(u * (1 + s * 2))
            B.rect(x - r, y - u, u, u)
            B.rect(x + r, y - u, u, u)
            B.rect(x - Math.round(r / 2), y - 2 * u, u, u)
            B.rect(x + Math.round(r / 2), y - 2 * u, u, u)
            break
          }
          B.alpha = 0.7 * fade * over
          const len = Math.round(7 * u)
          // A streak, slanted with the wind: three steps of one pixel.
          const sx = q.vx / (q.vy || 1)
          for (let s = 0; s < 3; s++) B.rect(Math.round(x - sx * (len * s) / 3), y - Math.round((len * s) / 3), Math.max(1, Math.round(u / 2)), Math.round(len / 3) + 1)
          break
        }
        case 'snow': {
          const settle = q.down > 0 ? q.down / 0.5 : 1
          B.alpha = 0.95 * fade * over * settle
          B.color = '#96aac8'
          B.rect(x, y + q.size, q.size, Math.max(1, Math.round(u / 2)))
          B.color = q.color
          B.rect(x, y, q.size, q.size)
          if (q.size > u) {
            B.alpha *= 0.5
            B.rect(x - u, y + Math.round(q.size / 2) - Math.round(u / 2), u, u)
          }
          break
        }
        case 'petal':
        case 'leaf': {
          const flat = Math.sin(q.age * 5 + q.phase) > 0
          B.alpha = 0.95 * fade * over
          B.rect(x, y, flat ? 2 * u : u, flat ? u : 2 * u)
          if (q.kind === 'petal') {
            B.alpha *= 0.6
            B.color = '#ffffff'
            B.rect(x, y, u, u)
          }
          break
        }
        case 'dust': {
          const tw = 0.5 + 0.5 * Math.sin(q.age * 3 + q.phase)
          B.alpha = (0.25 + 0.55 * tw) * fade * over
          B.rect(x, y, Math.max(1, Math.round(u / 2)), Math.max(1, Math.round(u / 2)))
          break
        }
        case 'fluff': {
          B.alpha = 0.85 * fade * over
          B.rect(x, y, u, u)
          B.alpha *= 0.55
          B.rect(x - u, y, u, u)
          B.rect(x + u, y, u, u)
          B.rect(x, y - u, u, u)
          break
        }
        case 'butterfly': {
          const up = Math.sin(q.age * 22 + q.phase) > 0
          B.alpha = 0.95 * fade * over
          B.color = '#3a2a2a'
          B.rect(x, y, Math.max(1, Math.round(u / 2)), u)
          B.color = q.color
          if (up) {
            B.rect(x - u, y - u, u, u)
            B.rect(x + Math.max(1, Math.round(u / 2)), y - u, u, u)
          } else {
            B.rect(x - u, y, u, u)
            B.rect(x + Math.max(1, Math.round(u / 2)), y, u, u)
            B.rect(x - 2 * u, y, u, u)
            B.rect(x + Math.max(1, Math.round(u / 2)) + u, y, u, u)
          }
          break
        }
        case 'spore': {
          // A glowing spore: its core, a faint cross of glow round it that
          // swells and ebbs slowly.
          const glow = 0.5 + 0.5 * Math.sin(q.age * 1.1 + q.phase)
          const s = Math.max(1, Math.round(u / 2))
          B.alpha = (0.55 + 0.35 * glow) * fade * over
          B.rect(x, y, s, s)
          B.alpha = 0.35 * glow * fade * over
          B.rect(x - s, y, s, s)
          B.rect(x + s, y, s, s)
          B.rect(x, y - s, s, s)
          B.rect(x, y + s, s, s)
          break
        }
        case 'dew': {
          const tw = Math.sin((q.age / q.life) * Math.PI)
          B.alpha = tw * 0.9 * WEATHER_PEAK
          const s = Math.max(1, Math.round(u / 2))
          B.rect(x, y, s, s)
          if (tw > 0.7) {
            B.alpha = tw * 0.45 * WEATHER_PEAK
            B.rect(x - s, y, s, s)
            B.rect(x + s, y, s, s)
            B.rect(x, y - s, s, s)
            B.rect(x, y + s, s, s)
          }
          break
        }
      }
    }
    B.flush(ctx)
  }

  private spawn(kind: WeatherKind, x: number, y: number, k: number, u: number, view: View): WP {
    const r = Math.random
    const color = COLORS[kind][Math.floor(r() * COLORS[kind].length)]
    const base: WP = { kind, x, y, vx: 0, vy: 0, age: 0, life: 4, land: Infinity, down: 0, color, phase: r() * 6.28, size: u }
    switch (kind) {
      case 'rain': {
        // From above the view or anywhere in it; it lands a little way below.
        const vy = (340 + r() * 110) * k
        const yy = r() < 0.5 ? view.y0 - 10 * k : y
        return { ...base, y: yy, vy, vx: -0.22 * vy, life: 2, land: yy + (30 + r() * 140) * k }
      }
      case 'snow':
        return { ...base, vy: (12 + r() * 12) * k, life: 7 + r() * 4, land: y + (40 + r() * 160) * k, size: r() < 0.3 ? 2 * u : u }
      case 'petal':
      case 'leaf':
        return { ...base, vy: (8 + r() * 9) * k, life: 5 + r() * 3 }
      case 'dust':
        return { ...base, life: 3 + r() * 3 }
      case 'fluff':
        return { ...base, vx: (8 + r() * 10) * k, life: 5 + r() * 3 }
      case 'butterfly':
        return { ...base, life: 9 + r() * 6 }
      case 'dew':
        return { ...base, life: 0.9 + r() * 0.8 }
      case 'spore':
        return { ...base, vy: -(5 + r() * 6) * k, life: 6 + r() * 4 }
    }
  }
}
