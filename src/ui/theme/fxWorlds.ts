/**
 * ---------------------------------------------------------------------------
 * The company worlds' motion: ambient particles, press bursts, switch-ins
 * ---------------------------------------------------------------------------
 *
 * Each theme's world, as particles drawn in PIXELS: the engine (`fxEngine.ts`)
 * keeps a low-resolution canvas (`FX_PX` CSS px a pixel, `image-rendering:
 * pixelated`), and everything here works in those pixels — whole-pixel
 * squares, a small palette per world, alpha in eighth steps. No smooth
 * gradients: glows and washes are DITHERED (a checker of pixels).
 *
 *   - FIRE (Peppercorn): embers and sparks rising, a dithered heat glow at
 *     the foot with shimmer lines wavering through it; press: an ember burst;
 *     switch-in: a wall of flame flaring up the screen.
 *   - PAINT (Easel House): flecks of paint drifting, splats that land and dry,
 *     dithered watercolour washes; press: a splat and droplets; switch-in: a
 *     brush wipe.
 *   - FORGE (Ironvein): sparks thrown in arcs that fall, ash drifting down, the
 *     forge's glow at the foot; press: a spark shower; switch-in: a hammer-
 *     strike flash and a ring of sparks.
 *   - SILK (Rosethread): rose petals tumbling, ribbons waving across; press: a
 *     petal burst; switch-in: a ribbon sweep.
 *   - ARCANE NIGHT (Moonquill): twinkling stars, a dithered moonbeam, runes
 *     drifting up, ink-quill strokes writing themselves; press: an arcane
 *     sparkle; switch-in: a moonlit shimmer sweeping down.
 *   - The house look (your militia's neutral): a few lantern motes.
 *
 * Pure: no DOM (a canvas context is passed in). Random draws come from the
 * `rand` the engine passes, so a test can drive a world deterministically.
 */
import type { ThemeId } from '../../game/run/militiaTheme'
import { RUNES_5 } from './themeArt'

/** CSS pixels per effect pixel. */
export const FX_PX = 3

export interface Particle {
  kind: string
  x: number
  y: number
  vx: number
  vy: number
  /** Seconds lived, and the seconds it lives. */
  age: number
  life: number
  size: number
  color: string
  /** A per-particle phase for sway, twinkle and flips. */
  phase: number
  /** Extra per-kind data (a rune's glyph, a splat's shape…). */
  n?: number
}

/** The slice of a 2D context the worlds draw with. */
export interface Pen {
  fillStyle: string | CanvasGradient | CanvasPattern
  globalAlpha: number
  fillRect(x: number, y: number, w: number, h: number): void
}

export type Rand = () => number

/** A sweep across the screen (a switch-in's band), drawn by its world. */
export interface Sweep {
  age: number
  life: number
}

export interface World {
  /** How many ambient particles a screen of `w` × `h` effect pixels holds (before the engine's cap). */
  density: number
  /** A new ambient particle (`seed`: true while the screen is first filled — spawn anywhere). */
  spawn(rand: Rand, w: number, h: number, seed: boolean): Particle
  /** Behind the particles each frame: glows, washes, beams, ribbons, stars. */
  backdrop?(pen: Pen, w: number, h: number, t: number): void
  /** A press: particles from the point. */
  burst(rand: Rand, x: number, y: number): Particle[]
  /** The switch-in: particles to add, and the sweep drawn over the screen while it runs. */
  switchIn(rand: Rand, w: number, h: number): Particle[]
  drawSweep?(pen: Pen, w: number, h: number, s: Sweep): void
  sweepLife?: number
}

const TAU = Math.PI * 2
/** Alpha in eighths: pixel art fades in steps, not smoothly. */
export const stepAlpha = (a: number): number => Math.max(0, Math.min(1, Math.round(a * 8) / 8))
const pick = <T,>(rand: Rand, xs: readonly T[]): T => xs[Math.floor(rand() * xs.length) % xs.length]
const p = (o: Partial<Particle> & Pick<Particle, 'kind' | 'x' | 'y'>): Particle => ({ vx: 0, vy: 0, age: 0, life: 1, size: 1, color: '#fff', phase: 0, ...o })

/** Advance one particle `dt` seconds; false once it is done or far off screen. */
export function step(q: Particle, dt: number, w: number, h: number): boolean {
  q.age += dt
  if (q.age >= q.life) return false
  switch (q.kind) {
    case 'ember':
      q.vx += Math.sin(q.age * 3 + q.phase) * 6 * dt
      break
    case 'spark':
    case 'drop':
      q.vy += 70 * dt
      break
    case 'heavy':
      q.vy += 150 * dt
      break
    case 'pburst':
      q.vy += 35 * dt
      q.vx *= 1 - 1.5 * dt
      break
    case 'petal':
      q.vx = Math.sin(q.age * 1.6 + q.phase) * 7
      break
    case 'ash':
    case 'mote':
    case 'fleck':
      q.vx += Math.sin(q.age * 0.9 + q.phase) * 2 * dt
      break
  }
  q.x += q.vx * dt
  q.y += q.vy * dt
  return q.x > -12 && q.x < w + 12 && q.y > -16 && q.y < h + 16
}

/** A dithered wash: every other pixel of a disc, so a glow stays pixel art. */
function dither(pen: Pen, cx: number, cy: number, r: number, color: string, alpha: number, offset = 0): void {
  pen.fillStyle = color
  pen.globalAlpha = stepAlpha(alpha)
  const r2 = r * r
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if ((x + y + offset) & 1) continue
      if (x * x + y * y > r2) continue
      pen.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1)
    }
  }
}

/** A dithered band along the foot of the screen, thinning as it rises. */
function footGlow(pen: Pen, w: number, h: number, color: string, rows: number, t: number): void {
  pen.fillStyle = color
  for (let i = 0; i < rows; i++) {
    const y = h - 1 - i
    const keep = 1 - i / rows // how much of the row is lit
    pen.globalAlpha = stepAlpha(0.32 * keep + 0.04)
    const stride = keep > 0.66 ? 2 : keep > 0.33 ? 3 : 5
    const shift = (i + Math.floor(t * 6)) % stride
    for (let x = shift; x < w; x += stride) pen.fillRect(x, y, 1, 1)
  }
}

// ---------------------------------------------------------------------------
const FIRE_C = ['#fff3c0', '#ffd35e', '#ff8a2c', '#e0521f', '#b8321e']
const fireColor = (q: Particle) => FIRE_C[Math.min(FIRE_C.length - 1, Math.floor((q.age / q.life) * FIRE_C.length + (q.n ?? 0)))]

const fire: World = {
  density: 0.0045,
  spawn(rand, w, h, seed) {
    const spark = rand() < 0.18
    return p({
      kind: spark ? 'spark' : 'ember',
      x: rand() * w,
      // Anywhere in the lower three quarters (it fades in where it is born):
      // the home's card covers the foot, so embers must rise through the map.
      y: seed ? rand() * h : h * (0.25 + rand() * 0.8),
      vx: (rand() - 0.5) * (spark ? 14 : 4),
      vy: spark ? -40 - rand() * 30 : -9 - rand() * 14,
      life: spark ? 0.7 + rand() * 0.6 : 4 + rand() * 4,
      size: !spark && rand() < 0.25 ? 2 : 1,
      phase: rand() * TAU,
      n: spark ? 0 : 1,
    })
  },
  backdrop(pen, w, h, t) {
    footGlow(pen, w, h, '#ff7a24', Math.max(10, Math.round(h * 0.14)), t)
    // Heat shimmer: broken lines that waver through the glow.
    pen.fillStyle = '#ffd35e'
    for (let i = 0; i < 5; i++) {
      const y = Math.round(h - 6 - i * 7 + Math.sin(t * 2.2 + i * 1.7) * 1.5)
      pen.globalAlpha = stepAlpha(0.18 - i * 0.03)
      const shift = Math.floor(t * 9 + i * 13) % 11
      for (let x = shift - 11; x < w; x += 11) pen.fillRect(x, y, 5, 1)
    }
  },
  burst(rand, x, y) {
    return Array.from({ length: 44 }, (_, i) => {
      const spark = i < 12
      const a = -Math.PI / 2 + (rand() - 0.5) * (spark ? 2.2 : 3)
      const v = spark ? 50 + rand() * 40 : 18 + rand() * 30
      return p({ kind: spark ? 'spark' : 'ember', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: spark ? 0.8 + rand() * 0.5 : 1.1 + rand() * 0.9, size: !spark && rand() < 0.7 ? 2 : 1, phase: rand() * TAU, n: 0 })
    })
  },
  switchIn(rand, w, h) {
    // A wall of flame: tongues all along the foot, flaring up the screen.
    return Array.from({ length: Math.round(w * 0.9) }, () =>
      p({ kind: 'ember', x: rand() * w, y: h + rand() * 6, vx: (rand() - 0.5) * 6, vy: -(h * 0.75) * (0.6 + rand() * 0.6), life: 0.8 + rand() * 0.5, size: rand() < 0.5 ? 2 : 3, phase: rand() * TAU, n: 0 }),
    )
  },
  sweepLife: 0.85,
  drawSweep(pen, w, h, s) {
    const k = 1 - s.age / s.life
    footGlow(pen, w, h, '#ffb347', Math.round(h * 0.6 * k + 6), s.age)
  },
}

// ---------------------------------------------------------------------------
const PAINTS = ['#c6a4ff', '#9b74e8', '#e2aa5a', '#5fb0a8', '#e58fb0', '#f6efff']
/** Splat shapes, 7 × 7. */
const SPLATS = [
  ['..x....', '.xxx.x.', 'xxxxxx.', '.xxxxx.', 'x.xxxx.', '..xx...', '....x..'],
  ['...x...', '.xxxxx.', 'xxxxxxx', '.xxxxx.', '.xxxxxx', 'x..x...', '...x...'],
  ['x...x..', '.xxx...', '.xxxxx.', 'xxxxxx.', '..xxx..', '.x..xx.', '.......'],
]
function drawSplat(pen: Pen, q: Particle, scale: number): void {
  const s = SPLATS[(q.n ?? 0) % SPLATS.length]
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 7; x++) if (s[y][x] === 'x') pen.fillRect(Math.round(q.x + (x - 3) * scale), Math.round(q.y + (y - 3) * scale), scale, scale)
}

const paint: World = {
  density: 0.0026,
  spawn(rand, w, h) {
    if (rand() < 0.1) {
      // A splat lands, lingers and dries away.
      return p({ kind: 'splat', x: rand() * w, y: rand() * h, life: 3 + rand() * 2, color: pick(rand, PAINTS), n: Math.floor(rand() * 3), size: rand() < 0.3 ? 2 : 1 })
    }
    return p({ kind: 'fleck', x: rand() * w, y: rand() * h, vx: (rand() - 0.5) * 5, vy: 3 + rand() * 6, life: 9 + rand() * 6, size: rand() < 0.6 ? 2 : 1, color: pick(rand, PAINTS), phase: rand() * TAU })
  },
  backdrop(pen, w, h, t) {
    // Three watercolour washes drifting slowly, dithered.
    const washes: [number, number, string][] = [
      [0.22, 0.3, '#c6a4ff'],
      [0.78, 0.55, '#e2aa5a'],
      [0.35, 0.82, '#5fb0a8'],
    ]
    washes.forEach(([fx, fy, c], i) => dither(pen, fx * w + Math.sin(t * 0.15 + i) * 6, fy * h + Math.cos(t * 0.12 + i) * 5, Math.round(Math.min(w, h) * 0.16), c, 0.14, i))
  },
  burst(rand, x, y) {
    const c = pick(rand, PAINTS.slice(0, 5))
    return [
      p({ kind: 'splat', x, y, life: 1.3, color: c, n: Math.floor(rand() * 3), size: 3 }),
      ...Array.from({ length: 22 }, () => {
        const a = rand() * TAU
        const v = 25 + rand() * 35
        return p({ kind: 'drop', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 15, life: 0.9 + rand() * 0.6, size: rand() < 0.7 ? 2 : 1, color: rand() < 0.7 ? c : pick(rand, PAINTS) })
      }),
    ]
  },
  switchIn(rand, w, h) {
    return Array.from({ length: 24 }, () => p({ kind: 'drop', x: rand() * w * 0.3, y: h * (0.3 + rand() * 0.4), vx: 60 + rand() * 80, vy: -10 + rand() * 20, life: 0.5 + rand() * 0.4, size: 2, color: pick(rand, PAINTS) }))
  },
  sweepLife: 0.85,
  drawSweep(pen, w, h, s) {
    // A brush wipe: a broad, ragged stroke whose head crosses the screen.
    const head = (s.age / s.life) * (w + 40)
    const y0 = h * 0.28
    const y1 = h * 0.72
    for (let x = 0; x < Math.min(w, head); x++) {
      const behind = head - x
      const a = stepAlpha(0.42 - behind / (w * 1.4))
      if (a <= 0) continue
      pen.globalAlpha = a
      pen.fillStyle = PAINTS[Math.floor(x / 9) % 2]
      const top = Math.round(y0 + Math.sin(x * 0.31) * 3 + Math.sin(x * 0.07) * 6)
      const bot = Math.round(y1 + Math.sin(x * 0.23 + 1) * 3 - Math.sin(x * 0.05) * 6)
      pen.fillRect(x, top, 1, bot - top)
      // Bristle streaks.
      if (x % 3 === 0) {
        pen.fillStyle = '#f6efff'
        pen.fillRect(x, top + 3 + ((x * 7) % (bot - top - 6)), 1, 1)
      }
    }
  },
}

// ---------------------------------------------------------------------------
const FORGE_C = ['#ffe08a', '#ffb347', '#ff8a2c', '#c8541c']
const ASH = ['#8a939e', '#b3bcc6', '#6b7480']
const forge: World = {
  density: 0.0045,
  spawn(rand, w, h, seed) {
    if (rand() < 0.4) {
      return p({ kind: 'ash', x: rand() * w, y: seed ? rand() * h : rand() * h * 0.6, vx: (rand() - 0.5) * 4, vy: 4 + rand() * 5, life: 10 + rand() * 6, color: pick(rand, ASH), phase: rand() * TAU })
    }
    const a = -Math.PI / 2 + (rand() - 0.5) * 1.2
    const v = 45 + rand() * 45
    return p({ kind: 'spark', x: rand() * w, y: h * (0.35 + rand() * 0.7), vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.2 + rand() * 1.2, n: 0 })
  },
  backdrop(pen, w, h, t) {
    footGlow(pen, w, h, '#ff8a2c', Math.max(8, Math.round(h * 0.1)), t * 0.5)
  },
  burst(rand, x, y) {
    return Array.from({ length: 48 }, () => {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.6
      const v = 40 + rand() * 80
      return p({ kind: 'heavy', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.8 + rand() * 0.6, size: rand() < 0.45 ? 2 : 1, n: 0 })
    })
  },
  switchIn(rand, w, h) {
    const cx = w / 2
    const cy = h * 0.7
    return Array.from({ length: 50 }, () => {
      const a = rand() * TAU
      const v = 50 + rand() * 90
      return p({ kind: 'heavy', x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.8 + rand() * 0.6, size: rand() < 0.3 ? 2 : 1, n: 0 })
    })
  },
  sweepLife: 0.6,
  drawSweep(pen, w, h, s) {
    // The strike: a white-hot flash, then a ring going out from the anvil.
    const k = s.age / s.life
    pen.fillStyle = '#ffe9c2'
    pen.globalAlpha = stepAlpha(0.3 * (1 - k) * (1 - k))
    if (pen.globalAlpha > 0) pen.fillRect(0, 0, w, h)
    const r = Math.round(6 + k * Math.max(w, h) * 0.5)
    pen.fillStyle = '#ffb347'
    pen.globalAlpha = stepAlpha(0.5 * (1 - k))
    const cx = w / 2
    const cy = h * 0.7
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * TAU
      pen.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1)
    }
  },
}

// ---------------------------------------------------------------------------
const PETAL_C = ['#e9a8bf', '#c4627f', '#f6d2de', '#d98aa6']
function drawPetal(pen: Pen, q: Particle): void {
  // A petal tumbles: its width flips 1 → 2 → 3 as it turns.
  const flip = Math.abs(Math.sin(q.age * 2.4 + q.phase))
  const wpx = flip < 0.33 ? 1 : flip < 0.66 ? 2 : 3
  const x = Math.round(q.x)
  const y = Math.round(q.y)
  pen.fillRect(x, y, wpx, 2)
  pen.fillRect(x + (wpx > 1 ? 1 : 0), y + 2, 1, 1)
}
const silk: World = {
  density: 0.003,
  spawn(rand, w, h, seed) {
    return p({ kind: 'petal', x: rand() * w, y: seed ? rand() * h : rand() * h * 0.5 - 4, vy: 7 + rand() * 7, life: 30, color: pick(rand, PETAL_C), phase: rand() * TAU })
  },
  backdrop(pen, w, h, t) {
    // Two ribbons waving across, slowly.
    for (let r = 0; r < 2; r++) {
      const base = h * (0.32 + r * 0.38) + Math.sin(t * 0.2 + r * 2) * 8
      for (let x = 0; x < w; x++) {
        const y = Math.round(base + Math.sin(x * 0.06 + t * (0.6 + r * 0.2) + r) * 7)
        pen.globalAlpha = stepAlpha(0.3)
        pen.fillStyle = r ? '#c4627f' : '#e9a8bf'
        pen.fillRect(x, y, 1, 2)
        if ((x + Math.floor(t * 12)) % 29 === 0) {
          pen.globalAlpha = stepAlpha(0.6)
          pen.fillStyle = '#fff3f7'
          pen.fillRect(x, y, 1, 1)
        }
      }
    }
  },
  burst(rand, x, y) {
    return Array.from({ length: 28 }, () => {
      const a = rand() * TAU
      const v = 22 + rand() * 34
      return p({ kind: 'pburst', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: 1.1 + rand() * 0.7, color: pick(rand, PETAL_C), phase: rand() * TAU })
    })
  },
  switchIn(rand, w, h) {
    return Array.from({ length: 30 }, () => p({ kind: 'petal', x: -4 - rand() * w * 0.4, y: rand() * h, vx: 70 + rand() * 50, vy: 6, life: 1.4 + rand() * 0.6, color: pick(rand, PETAL_C), phase: rand() * TAU }))
  },
  sweepLife: 0.9,
  drawSweep(pen, w, h, s) {
    // A ribbon sweeps across the screen, its head leading, its tail fading.
    const head = (s.age / s.life) * (w + 60)
    for (let x = 0; x < Math.min(w, head); x++) {
      const a = stepAlpha(0.6 - (head - x) / (w * 1.2))
      if (a <= 0) continue
      pen.globalAlpha = a
      const y = Math.round(h * 0.5 + Math.sin(x * 0.045) * h * 0.18 + Math.sin(x * 0.17) * 4)
      pen.fillStyle = '#e9a8bf'
      pen.fillRect(x, y - 2, 1, 3)
      pen.fillStyle = '#c4627f'
      pen.fillRect(x, y + 1, 1, 2)
    }
  },
}

// ---------------------------------------------------------------------------
const STAR_C = ['#ffffff', '#d4daf2', '#c9d4ff']
function drawRune(pen: Pen, q: Particle): void {
  const g = RUNES_5[(q.n ?? 0) % RUNES_5.length]
  const x0 = Math.round(q.x)
  const y0 = Math.round(q.y)
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (g[y][x] === 's') pen.fillRect(x0 + x, y0 + y, 1, 1)
}
const arcane: World = {
  density: 0.0042,
  spawn(rand, w, h) {
    const r = rand()
    if (r < 0.16) return p({ kind: 'rune', x: rand() * w, y: rand() * h, vy: -2 - rand() * 2.5, vx: (rand() - 0.5) * 1.5, life: 12 + rand() * 6, color: '#8fa4ff', n: Math.floor(rand() * RUNES_5.length) })
    if (r < 0.22) return p({ kind: 'quill', x: rand() * w, y: rand() * h, life: 2.4, color: '#c9d4ff', phase: rand() * TAU, n: Math.floor(rand() * 4) })
    return p({ kind: 'star', x: rand() * w, y: rand() * h, life: 6 + rand() * 10, color: pick(rand, STAR_C), phase: rand() * TAU })
  },
  backdrop(pen, w, h, t) {
    // The moon, top right, and its beam slanting down, dithered.
    dither(pen, w - 14, 10, 7, '#e4e8f6', 0.22)
    pen.fillStyle = '#c9d4ff'
    const shimmer = Math.floor(t * 2) & 1
    for (let y = 0; y < h; y += 1) {
      const cx = w - 14 - y * 0.55
      const half = 6 + y * 0.12
      pen.globalAlpha = stepAlpha(0.1 * (1 - y / h) + 0.02)
      for (let x = Math.round(cx - half); x < cx + half; x++) if (((x + y + shimmer) & 3) === 0) pen.fillRect(x, y, 1, 1)
    }
  },
  burst(rand, x, y) {
    return [
      ...Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * TAU
        return p({ kind: 'spark-still', x, y, vx: Math.cos(a) * 55, vy: Math.sin(a) * 55, life: 0.8, size: i % 3 ? 1 : 2, color: i % 2 ? '#c9d4ff' : '#ffffff' })
      }),
      ...Array.from({ length: 14 }, () => p({ kind: 'star', x: x + (rand() - 0.5) * 40, y: y + (rand() - 0.5) * 22, life: 1 + rand() * 0.6, color: '#ffffff', phase: rand() * TAU })),
    ]
  },
  switchIn(rand, w, h) {
    return Array.from({ length: 40 }, () => p({ kind: 'star', x: rand() * w, y: rand() * h * 0.2, vy: h * 0.9, life: 0.9 + rand() * 0.4, color: pick(rand, STAR_C), phase: rand() * TAU }))
  },
  sweepLife: 0.9,
  drawSweep(pen, w, h, s) {
    // A moonlit shimmer: a silver sheet of dithered light sweeping down.
    const head = (s.age / s.life) * (h + 30)
    pen.fillStyle = '#e4e8f6'
    for (let y = Math.max(0, Math.round(head - 30)); y < Math.min(h, head); y++) {
      pen.globalAlpha = stepAlpha(0.35 * (1 - (head - y) / 30))
      for (let x = (y & 1) * 2; x < w; x += 4) pen.fillRect(x, y, 1, 1)
    }
  },
}

// ---------------------------------------------------------------------------
const lantern: World = {
  density: 0.0009,
  spawn(rand, w, h) {
    return p({ kind: 'mote', x: rand() * w, y: rand() * h, vy: -3 - rand() * 4, vx: (rand() - 0.5) * 2, life: 9 + rand() * 6, color: rand() < 0.5 ? '#f0c46a' : '#ffe39a', phase: rand() * TAU })
  },
  burst(rand, x, y) {
    return Array.from({ length: 12 }, () => {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.4
      const v = 25 + rand() * 30
      return p({ kind: 'drop', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + rand() * 0.4, color: rand() < 0.5 ? '#f0c46a' : '#ffe39a' })
    })
  },
  switchIn: () => [],
}

export const WORLDS: Readonly<Record<ThemeId, World>> = { neutral: lantern, spice: fire, art: paint, metals: forge, silk, scrolls: arcane }

/** Draw one particle. */
export function drawParticle(pen: Pen, q: Particle, dim: number): void {
  const k = q.age / q.life
  // Fade in over the first tenth, out over the last third — in eighth steps.
  const fade = Math.min(1, q.age / (q.life * 0.1 + 0.001), (1 - k) * 3)
  switch (q.kind) {
    case 'ember':
    case 'spark':
    case 'heavy': {
      const color = q.n === 1 ? fireColor(q) : FORGE_C[Math.min(FORGE_C.length - 1, Math.floor(k * FORGE_C.length))]
      if (q.kind === 'ember' && Math.sin(q.age * 23 + q.phase) > 0.85) return // flicker
      pen.fillStyle = q.kind === 'ember' && q.n !== 1 ? FIRE_C[Math.min(4, Math.floor(k * 5))] : color
      const x = Math.round(q.x)
      const y = Math.round(q.y)
      if (q.kind === 'ember') {
        // A glowing ember: a dim halo of pixels round its hot core.
        pen.globalAlpha = stepAlpha(fade * dim * 0.35)
        pen.fillRect(x - 1, y, q.size + 2, q.size)
        pen.fillRect(x, y - 1, q.size, q.size + 2)
      }
      pen.globalAlpha = stepAlpha(fade * dim)
      pen.fillRect(x, y, q.size, q.size)
      if (q.kind !== 'ember') {
        // A spark's tail, one pixel back along its path.
        pen.globalAlpha = stepAlpha(fade * dim * 0.5)
        pen.fillRect(Math.round(q.x - q.vx * 0.03), Math.round(q.y - q.vy * 0.03), 1, 1)
      }
      return
    }
    case 'splat':
      pen.fillStyle = q.color
      pen.globalAlpha = stepAlpha(0.55 * fade * dim)
      drawSplat(pen, q, q.size)
      return
    case 'petal':
    case 'pburst':
      pen.fillStyle = q.color
      pen.globalAlpha = stepAlpha(0.85 * fade * dim)
      drawPetal(pen, q)
      return
    case 'rune':
      pen.fillStyle = q.color
      pen.globalAlpha = stepAlpha(0.45 * fade * dim * (0.75 + 0.25 * Math.sin(q.age * 1.5)))
      drawRune(pen, q)
      return
    case 'quill': {
      // An ink stroke writing itself along a curl, then fading.
      pen.fillStyle = q.color
      const len = Math.floor(Math.min(1, k * 2) * 22)
      for (let i = 0; i < len; i++) {
        pen.globalAlpha = stepAlpha(0.5 * dim * (k > 0.5 ? (1 - k) * 2 : 1))
        const a = i * 0.28 + q.phase
        pen.fillRect(Math.round(q.x + i * 0.9 + Math.cos(a) * 2), Math.round(q.y + Math.sin(a) * 3 - i * 0.2), 1, 1)
      }
      return
    }
    case 'star': {
      const tw = 0.5 + 0.5 * Math.sin(q.age * 2.2 + q.phase)
      const lvl = tw < 0.33 ? 0.25 : tw < 0.75 ? 0.5 : 1
      pen.fillStyle = q.color
      pen.globalAlpha = stepAlpha(lvl * fade * dim)
      const x = Math.round(q.x)
      const y = Math.round(q.y)
      pen.fillRect(x, y, 1, 1)
      if (lvl === 1) {
        pen.globalAlpha = stepAlpha(0.5 * fade * dim)
        pen.fillRect(x - 1, y, 1, 1)
        pen.fillRect(x + 1, y, 1, 1)
        pen.fillRect(x, y - 1, 1, 1)
        pen.fillRect(x, y + 1, 1, 1)
      }
      return
    }
    default:
      pen.fillStyle = q.color
      pen.globalAlpha = stepAlpha(fade * dim * (q.kind === 'mote' ? 0.5 : q.kind === 'ash' ? 0.6 : q.kind === 'fleck' ? 0.7 : 1))
      pen.fillRect(Math.round(q.x), Math.round(q.y), q.size, q.size)
  }
}

/** The most ambient particles a screen holds: the brief's cap, 60 on a phone. */
export function ambientCap(world: World, w: number, h: number, cssWidth: number): number {
  const cap = cssWidth < 700 ? 60 : 110
  return Math.min(cap, Math.round(world.density * w * h))
}
