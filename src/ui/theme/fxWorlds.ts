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
 * The designer's bar: every world reads as its theme in ONE still frame, at a
 * glance, on a phone, even in greyscale. So each has a shape of its own:
 *
 *   - FIRE (Peppercorn): fat embers (2–3 px, white-hot at the core, a red
 *     halo) rising with a sway, crowded at the foot of the screen and beside
 *     the focused road (never on its line); flame tongues licking up from the floor (the dock's
 *     top on the home) out of a dithered heat glow; press: flames flaring up
 *     the CTA's face, embers thrown off its ends; switch-in: a wall of flame.
 *   - FORGE (Ironvein): three spark fountains at the floor, sparks with
 *     white-yellow cores and orange tails thrown in gravity arcs, ash drifting
 *     down; press: a molten flash along the CTA's seams and a spark shower in
 *     arcs off it; switch-in: a hammer-strike flash and a ring of sparks.
 *   - PAINT (Easel House): bold splats that land, drip and dry, flecks of
 *     paint drifting, watercolour washes; press: a bold splat at the CTA's
 *     end with drips and droplets; switch-in: a brush wipe.
 *   - SILK (Rosethread): rose petals tumbling down, ribbons flowing across
 *     with a stitch along them and a sheen running; press: a running stitch
 *     along the CTA and petals off its ends; switch-in: a ribbon sweep.
 *   - ARCANE NIGHT (Moonquill): a crescent moon and its dithered beam,
 *     twinkling stars, runes drifting up, quill strokes writing themselves;
 *     press: a ring of sparkles along the CTA and runes at its ends;
 *     switch-in: a moonlit shimmer sweeping down.
 *   - The house look (your militia's neutral): a few lantern motes.
 *
 * A press burst is ZONED to its CTA: it plays on the button's face and in its
 * margins (`zone`, the engine clips to it, and clears under the label), and
 * never flies over the panel's text above it.
 *
 * Pure: no DOM (a canvas context is passed in). Random draws come from the
 * `rand` the engine passes, so a test can drive a world deterministically.
 */
import type { ThemeId } from '../../game/run/militiaTheme'
import { RUNES_5 } from './themeArt'

/** CSS pixels per effect pixel. */
export const FX_PX = 3

/** A box in effect pixels: left, top, right, bottom. */
export interface Zone {
  l: number
  t: number
  r: number
  b: number
}

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
  /** Extra per-kind data (a rune's glyph, a splat's shape, a flame's height…). */
  n?: number
  /** A press burst's particles are drawn only inside their CTA's zone. */
  zone?: Zone
  /** A dark rim drawn round it, so it reads on a bright button face. */
  ink?: string
}

/**
 * Where things are on the screen, measured by the engine a few times a
 * second: the FLOOR (the top of the home's dock, else the screen's foot),
 * which the fire and the forge burn along, and the focused road's points,
 * which the fire crowds its embers beside.
 */
export interface Scene {
  floor: number
  hot: readonly (readonly [number, number])[]
  /**
   * Over the home's open map (true), or behind a page's panels: a big shape
   * (a ribbon, the moon) is drawn only over the map — between a page's
   * panels it would show as fragments, or through a translucent one.
   */
  map?: boolean
  /** The light set (`fxQuality`): no glows or washes behind the particles. */
  light?: boolean
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
  spawn(rand: Rand, w: number, h: number, seed: boolean, scene?: Scene): Particle
  /** Behind the particles each frame: glows, washes, beams, ribbons, stars. */
  backdrop?(pen: Pen, w: number, h: number, t: number, scene?: Scene): void
  /** A press on the CTA whose box is `zone`, at (x, y): the particles, each zoned to it. */
  burst(rand: Rand, x: number, y: number, zone?: Zone): Particle[]
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

/**
 * Where a burst may draw: its CTA and the margins round it — a little to each
 * side and below, barely above (the panel's words sit there).
 */
export function burstClip(z: Zone): Zone {
  return { l: z.l - 10, t: z.t - 2, r: z.r + 10, b: z.b + 10 }
}
/** A CTA-sized zone round a point, when a burst has none (a test, a key press). */
const zoneAt = (x: number, y: number): Zone => ({ l: x - 40, t: y - 9, r: x + 40, b: y + 9 })

/** Advance one particle `dt` seconds; false once it is done or far off screen. */
export function step(q: Particle, dt: number, w: number, h: number): boolean {
  q.age += dt
  if (q.age >= q.life) return false
  switch (q.kind) {
    case 'ember':
      // Rising with a sway, the way a coal's spark rides the heat.
      q.vx = Math.sin(q.age * 2.1 + q.phase) * 6
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
      q.vx = Math.sin(q.age * 1.6 + q.phase) * 8
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

/**
 * A dithered glow rising from `base` (a row) for `rows` rows, thinning as it
 * rises (and for a few rows below it, so it has no hard foot).
 */
function glowBand(pen: Pen, w: number, h: number, base: number, rows: number, color: string, peak: number, t: number): void {
  pen.fillStyle = color
  const b = Math.min(h - 1, Math.round(base))
  for (let y = Math.min(h - 1, b + 4); y > b - rows; y--) {
    const i = Math.max(0, b - y)
    const keep = (1 - i / rows) * (y > b ? 1 - (y - b) / 5 : 1) // how much of the row is lit
    pen.globalAlpha = stepAlpha(peak * keep + 0.04)
    const stride = keep > 0.66 ? 2 : keep > 0.33 ? 3 : 5
    const shift = (i + Math.floor(t * 6)) % stride
    for (let x = shift; x < w; x += stride) pen.fillRect(x, y, 1, 1)
  }
}

const floorOf = (h: number, scene?: Scene) => Math.max(h * 0.3, Math.min(h, scene?.floor ?? h))
/** Anywhere above the floor, where no road is focused. */
const aboveFloor = (rand: Rand, w: number, floor: number): [number, number] => [rand() * w, floor * (0.4 + rand() * 0.6)]

/** How far a road's ember keeps off the road's line, in effect pixels (one is 3 CSS px). */
export const ROAD_CLEAR = 4
/** …and how far out beside it one may land. */
export const ROAD_BESIDE = 11

/** Distance from (x, y) to the focused road's line (its points joined), in effect pixels. */
export function roadDistance(hot: Scene['hot'], x: number, y: number): number {
  if (!hot.length) return Infinity
  if (hot.length === 1) return Math.hypot(x - hot[0][0], y - hot[0][1])
  let best = Infinity
  for (let i = 1; i < hot.length; i++) {
    const [ax, ay] = hot[i - 1]
    const [bx, by] = hot[i]
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)))
  }
  return best
}

/**
 * A point BESIDE the focused road, never on its line (job critique leftovers,
 * Oct 2026): square, node-sized embers spawned on the road read like its
 * stops and crowded it. A point along the road, stepped out to one side,
 * kept only if it clears the whole line by `ROAD_CLEAR` (a bend can fold the
 * road back over it); null when no throw lands clear.
 */
function besideRoad(rand: Rand, scene?: Scene): [number, number] | null {
  const hot = scene?.hot
  if (!hot?.length) return null
  for (let tries = 0; tries < 4; tries++) {
    let px: number
    let py: number
    let nx: number
    let ny: number
    if (hot.length === 1) {
      ;[px, py] = hot[0]
      const a = rand() * TAU
      nx = Math.cos(a)
      ny = Math.sin(a)
    } else {
      const i = 1 + (Math.floor(rand() * (hot.length - 1)) % (hot.length - 1))
      const [ax, ay] = hot[i - 1]
      const [bx, by] = hot[i]
      const t = rand()
      px = ax + (bx - ax) * t
      py = ay + (by - ay) * t
      const len = Math.hypot(bx - ax, by - ay) || 1
      nx = -(by - ay) / len
      ny = (bx - ax) / len
      // An ember rises: set it on the road's upper side, so its climb takes
      // it away from the line rather than across it (a steep run: either side).
      const side = Math.abs(ny) < 0.25 ? (rand() < 0.5 ? -1 : 1) : ny > 0 ? -1 : 1
      nx *= side
      ny *= side
    }
    const d = ROAD_CLEAR + 1 + rand() * (ROAD_BESIDE - ROAD_CLEAR - 1)
    const x = px + nx * d
    const y = py + ny * d
    if (roadDistance(hot, x, y) >= ROAD_CLEAR) return [x, y]
  }
  return null
}

// ---------------------------------------------------------------------------
// FIRE — Peppercorn
// ---------------------------------------------------------------------------
const FIRE_C = ['#fff3c0', '#ffd35e', '#ff8a2c', '#e0521f', '#b8321e']
const fireColor = (k: number) => FIRE_C[Math.min(FIRE_C.length - 1, Math.floor(k * FIRE_C.length))]

/** A flame tongue: `n` px at its tallest, growing and dying over its life, white at the root. */
function drawFlame(pen: Pen, q: Particle, dim: number): void {
  const k = q.age / q.life
  const flick = 0.75 + 0.25 * Math.sin(q.age * 19 + q.phase)
  const h = Math.max(1, Math.round((q.n ?? 6) * Math.sin(Math.PI * Math.min(1, k * 1.15)) * flick))
  const x = Math.round(q.x)
  const y = Math.round(q.y)
  const wpx = q.size
  for (let i = 0; i < h; i++) {
    const f = i / h
    // The tongue narrows to a point, leaning with its sway.
    const lean = Math.round(Math.sin(q.age * 6 + q.phase + i * 0.5) * f * 1.4)
    const ww = f > 0.7 ? 1 : wpx
    const x0 = x + lean + Math.floor((wpx - ww) / 2)
    if (q.zone) {
      // On a bright button, a dark char rim so the tongue reads.
      pen.fillStyle = '#5a1a0c'
      pen.globalAlpha = stepAlpha(dim * 0.9)
      pen.fillRect(x0 - 1, y - i, ww + 2, 1)
    }
    pen.fillStyle = f < 0.2 ? '#fff3c0' : f < 0.45 ? '#ffd35e' : f < 0.8 ? '#ff8a2c' : '#b8321e'
    pen.globalAlpha = stepAlpha(dim * (f < 0.8 ? 1 : 0.75))
    pen.fillRect(x0, y - i, ww, 1)
  }
  if (q.zone && h > 2) {
    pen.fillStyle = '#5a1a0c'
    pen.fillRect(x + Math.floor(wpx / 2), y - h, 1, 1)
  }
}

/**
 * A burning horizon: flame tongues all along a row (`base`), each four pixels
 * wide, their heights a sum of waves that flicker — white at the roots, red at
 * the tips. Drawn behind the particles; it is what makes the world FIRE at a
 * glance, even in greyscale.
 */
function flameLine(pen: Pen, w: number, base: number, t: number, maxH: number, alpha: number): void {
  const SHAPE = [0.55, 0.95, 1, 0.6]
  const heights: number[] = []
  for (let x0 = 0; x0 < w; x0 += 4) {
    const i = x0 / 4
    const n = 0.42 + 0.28 * Math.sin(i * 1.7 + t * 4.3) + 0.18 * Math.sin(i * 0.53 - t * 2.1) + 0.12 * Math.sin(i * 3.1 + t * 11)
    const tall = Math.max(1, n * maxH)
    for (let c = 0; c < 4; c++) heights.push(Math.round(tall * SHAPE[c]))
  }
  // One colour at a time, a vertical run per column: white roots, yellow,
  // orange, red tips.
  const BANDS: [number, number, string, number][] = [
    [0, 0.22, '#fff3c0', 1],
    [0.22, 0.48, '#ffd35e', 1],
    [0.48, 0.8, '#ff8a2c', 1],
    [0.8, 1, '#b8321e', 0.75],
  ]
  const b = Math.round(base)
  for (const [lo, hi, color, a] of BANDS) {
    pen.fillStyle = color
    pen.globalAlpha = stepAlpha(alpha * a)
    for (let x = 0; x < w && x < heights.length; x++) {
      const h = heights[x]
      const r0 = Math.ceil(lo * h)
      const r1 = Math.ceil(hi * h)
      if (r1 > r0) pen.fillRect(x, b - r1 + 1, 1, r1 - r0)
    }
  }
}

const fire: World = {
  density: 0.006,
  spawn(rand, w, h, seed, scene) {
    const floor = floorOf(h, scene)
    const r = rand()
    if (r < 0.16) {
      // A flame licking up from the floor.
      return p({ kind: 'flame', x: rand() * w, y: floor + 1, life: 0.7 + rand() * 0.7, size: rand() < 0.5 ? 3 : 2, n: 5 + Math.floor(rand() * 7), phase: rand() * TAU })
    }
    if (r < 0.28) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 0.9
      const v = 40 + rand() * 30
      return p({ kind: 'spark', x: rand() * w, y: floor - rand() * 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + rand() * 0.6, n: 1 })
    }
    // An ember: beside the focused road a third of the time (never on its
    // line), else biased to the foot.
    const foot = (): [number, number] => [rand() * w, seed ? floor - floor * Math.pow(rand(), 1.8) : floor - rand() * floor * 0.3]
    let [x, y] = r < 0.5 ? (besideRoad(rand, scene) ?? (scene?.hot.length ? foot() : aboveFloor(rand, w, floor))) : foot()
    // One thrown at the foot that lands on the road's line is thrown again,
    // then set beside the road.
    const hot = scene?.hot ?? []
    for (let k = 0; k < 6 && roadDistance(hot, x, y) < ROAD_CLEAR; k++) [x, y] = k < 3 ? foot() : (besideRoad(rand, scene) ?? [x, y])
    return p({
      kind: 'ember',
      x,
      y,
      vy: -9 - rand() * 14,
      life: 2.5 + rand() * 3,
      size: rand() < 0.35 ? 3 : 2,
      phase: rand() * TAU,
      n: 1,
    })
  },
  backdrop(pen, w, h, t, scene) {
    const floor = floorOf(h, scene)
    // The heat: a deep red band, an orange one nearer the coals, and the
    // flames themselves licking up all along the floor.
    if (!scene?.light) {
      glowBand(pen, w, h, floor, Math.max(16, Math.round(h * 0.2)), '#b8321e', 0.3, t)
      glowBand(pen, w, h, floor, Math.max(8, Math.round(h * 0.08)), '#ff8a2c', 0.4, t * 1.3)
      // The screen's own foot smoulders too (round the dock on a desk).
      if (floor < h - 8) glowBand(pen, w, h, h - 1, 10, '#b8321e', 0.3, t)
    }
    flameLine(pen, w, floor + 1, t, Math.max(6, Math.min(12, h * 0.045)), 0.85)
    if (scene?.light) return
    // Heat shimmer: broken lines that waver through the glow.
    pen.fillStyle = '#ffd35e'
    for (let i = 0; i < 5; i++) {
      const y = Math.round(floor - 3 - i * 6 + Math.sin(t * 2.2 + i * 1.7) * 1.5)
      pen.globalAlpha = stepAlpha(0.3 - i * 0.05)
      const shift = Math.floor(t * 9 + i * 13) % 11
      for (let x = shift - 11; x < w; x += 11) pen.fillRect(x, y, 5, 1)
    }
  },
  burst(rand, x, y, zone = zoneAt(x, y)) {
    const out: Particle[] = []
    // Flames flare up the CTA's face from its foot, tallest where it was pressed.
    for (let fx = zone.l + 1; fx < zone.r - 1; fx += 3) {
      const near = 1 - Math.min(1, Math.abs(fx - x) / ((zone.r - zone.l) * 0.5))
      out.push(p({ kind: 'flame', x: fx, y: zone.b - 1, life: 0.5 + rand() * 0.35, size: 3, n: Math.round(5 + near * (zone.b - zone.t) * 0.9 + rand() * 3), phase: rand() * TAU, zone }))
    }
    // Embers thrown off its two ends, out to the sides.
    for (let i = 0; i < 18; i++) {
      const right = i % 2 === 1
      const v = 25 + rand() * 45
      out.push(p({ kind: 'ember', x: right ? zone.r - 2 : zone.l + 2, y: zone.t + rand() * (zone.b - zone.t), vx: (right ? 1 : -1) * v, vy: -10 - rand() * 20, life: 0.6 + rand() * 0.6, size: rand() < 0.5 ? 3 : 2, phase: rand() * TAU, n: 1, zone }))
    }
    return out
  },
  switchIn(rand, w, h) {
    // A wall of flame: tongues all along the foot, flaring up the screen.
    return Array.from({ length: Math.round(w * 0.9) }, () =>
      p({ kind: 'ember', x: rand() * w, y: h + rand() * 6, vx: (rand() - 0.5) * 6, vy: -(h * 0.75) * (0.6 + rand() * 0.6), life: 0.8 + rand() * 0.5, size: rand() < 0.5 ? 2 : 3, phase: rand() * TAU, n: 1 }),
    )
  },
  sweepLife: 0.85,
  drawSweep(pen, w, h, s) {
    const k = 1 - s.age / s.life
    glowBand(pen, w, h, h - 1, Math.round(h * 0.6 * k + 6), '#ffb347', 0.36, s.age)
  },
}

// ---------------------------------------------------------------------------
// PAINT — Easel House
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
  density: 0.0034,
  spawn(rand, w, h, _seed, scene) {
    // Behind a page's panels a splat would show as stray blobs between
    // them: there the world is its flecks and washes; the splats and drips
    // are for the open map.
    const r = scene && !scene.map ? 1 : rand()
    if (r < 0.2) {
      // A bold splat lands, runs, lingers and dries away — never on the
      // focused road (a second throw if the first lands on it).
      let x = rand() * w
      let y = rand() * h * 0.85
      const onRoad = () => scene?.hot.some(([hx, hy]) => Math.abs(hx - x) < 14 && Math.abs(hy - y) < 12) ?? false
      if (onRoad()) {
        x = rand() * w
        y = rand() * h * 0.85
      }
      // Bigger on a wide screen; a phone's are a size smaller.
      const big = w > 200 ? 1 : 0
      return p({ kind: 'splat', x, y, life: 3.5 + rand() * 3, color: pick(rand, PAINTS.slice(0, 5)), n: Math.floor(rand() * 3), size: 2 + big + (rand() < 0.35 ? 1 : 0) })
    }
    if (r < 0.28) {
      // A drip running down.
      return p({ kind: 'drip', x: rand() * w, y: rand() * h * 0.8, life: 2.5 + rand() * 1.5, size: 2, color: pick(rand, PAINTS.slice(0, 5)), n: 6 + Math.floor(rand() * 10) })
    }
    return p({ kind: 'fleck', x: rand() * w, y: rand() * h, vx: (rand() - 0.5) * 5, vy: 3 + rand() * 6, life: 9 + rand() * 6, size: rand() < 0.6 ? 2 : 3, color: pick(rand, PAINTS), phase: rand() * TAU })
  },
  backdrop(pen, w, h, t, scene) {
    if (scene?.light) return
    // Three watercolour washes drifting slowly, dithered.
    const washes: [number, number, string][] = [
      [0.22, 0.3, '#c6a4ff'],
      [0.78, 0.55, '#e2aa5a'],
      [0.35, 0.82, '#5fb0a8'],
    ]
    washes.forEach(([fx, fy, c], i) => dither(pen, fx * w + Math.sin(t * 0.15 + i) * 6, fy * h + Math.cos(t * 0.12 + i) * 5, Math.round(Math.min(w, h) * 0.18), c, 0.18, i))
  },
  burst(rand, x, y, zone = zoneAt(x, y)) {
    // A bold splat at the end of the CTA nearest the press (the label stays
    // clear), a smaller one of another paint at the other end, drips and
    // droplets flung out sideways and down.
    const mid = (zone.t + zone.b) / 2
    const left = x < (zone.l + zone.r) / 2
    const a = left ? zone.l + 9 : zone.r - 9
    const b = left ? zone.r - 6 : zone.l + 6
    const c1 = pick(rand, ['#e2aa5a', '#5fb0a8', '#e58fb0'])
    const c2 = c1 === '#e2aa5a' ? '#5fb0a8' : '#e2aa5a'
    const out = [
      p({ kind: 'splat', x: a, y: mid, life: 1.4, color: '#2a1d3c', n: Math.floor(rand() * 3), size: 3, zone, phase: 1 }),
      p({ kind: 'splat', x: a, y: mid, life: 1.4, color: c1, n: 0, size: 3, zone }),
      p({ kind: 'splat', x: b, y: mid, life: 1.2, color: c2, n: 2, size: 2, zone }),
    ]
    out[1].n = out[0].n
    for (let i = 0; i < 3; i++) out.push(p({ kind: 'drip', x: a - 4 + i * 4, y: mid + 4, life: 1.3, size: 2, color: c1, n: 6 + Math.floor(rand() * 8), zone }))
    for (let i = 0; i < 20; i++) {
      const ang = (left ? Math.PI : 0) + (rand() - 0.5) * 2.2
      const v = 30 + rand() * 45
      out.push(p({ kind: 'drop', x: a, y: mid, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v * 0.5 + 10, life: 0.8 + rand() * 0.5, size: rand() < 0.6 ? 2 : 3, color: rand() < 0.7 ? c1 : c2, zone }))
    }
    return out
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
// FORGE — Ironvein
// ---------------------------------------------------------------------------
const FORGE_C = ['#fff6d8', '#ffe08a', '#ffb347', '#ff8a2c', '#c8541c']
const ASH = ['#8a939e', '#b3bcc6', '#6b7480']
/** The three anvils along the floor (fractions of the width; clear of the Buy Company slot at the right). */
const FOUNTAINS = [0.12, 0.41, 0.66]
/** An anvil, 11 × 6: `k` iron, `l` its lit face, `M` the hot bar on it. */
const ANVIL = ['...MMMMM...', 'kllllllllkk', '.kkkkkkkkk.', '...kkkkk...', '...kkkkk...', '.kkkkkkkkk.']
function drawAnvil(pen: Pen, cx: number, floor: number, t: number, i: number): void {
  const S = 2
  const x0 = Math.round(cx) - 11
  const y0 = Math.round(floor) - ANVIL.length * S
  const hot = 0.75 + 0.25 * Math.sin(t * 5 + i * 2)
  for (let y = 0; y < ANVIL.length; y++)
    for (let x = 0; x < 11; x++) {
      const ch = ANVIL[y][x]
      if (ch === '.') continue
      pen.fillStyle = ch === 'k' ? '#2a3341' : ch === 'l' ? '#9aa8ba' : hot > 0.9 ? '#fff6d8' : '#ffb347'
      pen.globalAlpha = stepAlpha(ch === 'M' ? hot : 1)
      pen.fillRect(x0 + x * S, y0 + y * S, S, S)
    }
}
const forge: World = {
  density: 0.007,
  spawn(rand, w, h, seed, scene) {
    const floor = floorOf(h, scene)
    // Ash is a few in the air at once (it lives long; the sparks are many and quick).
    if (rand() < 0.07) {
      return p({ kind: 'ash', x: rand() * w, y: seed ? rand() * h : rand() * h * 0.6, vx: (rand() - 0.5) * 4, vy: 5 + rand() * 5, life: 5 + rand() * 3, size: rand() < 0.4 ? 2 : 1, color: pick(rand, ASH), phase: rand() * TAU })
    }
    // A spark thrown from one of the fountains, in an arc that falls.
    const fx = pick(rand, FOUNTAINS) * w + (rand() - 0.5) * 8
    const a = -Math.PI / 2 + (rand() - 0.5) * 1.5
    const v = 50 + rand() * 50
    // It lives until it falls back to the floor.
    const vy = Math.sin(a) * v
    const s = p({ kind: 'heavy', x: fx, y: floor - 13, vx: Math.cos(a) * v, vy, life: Math.max(0.5, (-2 * vy) / 150 + 0.15), size: rand() < 0.6 ? 2 : 1, n: 0 })
    if (seed) s.age = rand() * s.life * 0.8
    return s
  },
  backdrop(pen, w, h, t, scene) {
    const floor = floorOf(h, scene)
    if (!scene?.light) {
      glowBand(pen, w, h, floor, Math.max(10, Math.round(h * 0.1)), '#ff8a2c', 0.28, t * 0.5)
      if (floor < h - 8) glowBand(pen, w, h, h - 1, 8, '#c8541c', 0.24, t * 0.5)
    }
    // Each anvil glows under its hot bar, breathing, the sparks fly off it.
    FOUNTAINS.forEach((f, i) => {
      if (!scene?.light) dither(pen, f * w, floor - 10, 13, '#ff9a3a', 0.3 + 0.12 * Math.sin(t * 3 + i * 2), i)
      drawAnvil(pen, f * w, floor, t, i)
    })
  },
  burst(rand, x, y, zone = zoneAt(x, y)) {
    // A molten flash runs out along the CTA's two seams from the press…
    const out: Particle[] = [
      p({ kind: 'seam', x: zone.l, y: zone.t, n: zone.r - zone.l, phase: x - zone.l, life: 0.55, zone }),
      p({ kind: 'seam', x: zone.l, y: zone.b - 2, n: zone.r - zone.l, phase: x - zone.l, life: 0.55, zone }),
    ]
    // …and sparks shower off the press in low arcs along the face (never
    // higher than the button), falling off its foot and out of its ends:
    // white-yellow cores, orange tails, an ink rim on the bright face.
    const hgt = Math.max(6, zone.b - zone.t)
    const vyMax = Math.sqrt(2 * 150 * hgt * 0.8)
    for (let i = 0; i < 54; i++) {
      const right = rand() < 0.5
      // Half from the press, half off the two ends (the label hides the middle).
      const sx = i % 2 ? x + (rand() - 0.5) * 6 : right ? zone.r - 4 : zone.l + 4
      const vx = (right ? 1 : -1) * (30 + rand() * 90)
      const vy = -vyMax * (0.35 + rand() * 0.65)
      out.push(p({ kind: 'heavy', x: sx, y: zone.b - 3, vx, vy, life: 0.7 + rand() * 0.6, size: rand() < 0.55 ? 2 : rand() < 0.5 ? 3 : 1, n: 0, zone, ink: '#3a1406' }))
    }
    return out
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
// SILK — Rosethread
// ---------------------------------------------------------------------------
const PETAL_C = ['#e9a8bf', '#f0b8cc', '#f6d2de', '#d98aa6']
/** A rose petal, tumbling: it turns edge-on and back as it falls. */
function drawPetal(pen: Pen, q: Particle, alpha: number): void {
  const flip = Math.abs(Math.sin(q.age * 2.4 + q.phase))
  const wpx = flip < 0.3 ? 1 : flip < 0.65 ? 2 : 3
  const x = Math.round(q.x)
  const y = Math.round(q.y)
  if (q.ink) {
    pen.globalAlpha = stepAlpha(alpha * 0.75)
    pen.fillStyle = q.ink
    pen.fillRect(x - 1, y - 1, wpx + 2, 5)
  }
  pen.globalAlpha = alpha
  pen.fillStyle = q.color
  pen.fillRect(x, y, wpx, 3)
  pen.fillRect(x + (wpx > 1 ? 1 : 0), y + 3, 1, 1)
  if (wpx > 1) {
    // The petal's heart, a deeper rose.
    pen.fillStyle = '#c4627f'
    pen.fillRect(x + wpx - 1, y + 2, 1, 1)
  }
}
const RIBBONS: [number, string, string][] = [
  [0.3, '#e9a8bf', '#c4627f'],
  [0.66, '#c4627f', '#8c3a57'],
]
const silk: World = {
  density: 0.0036,
  spawn(rand, w, h, seed) {
    return p({ kind: 'petal', x: rand() * w, y: seed ? rand() * h : -4 - rand() * h * 0.2, vy: 8 + rand() * 8, life: 40, color: pick(rand, PETAL_C), phase: rand() * TAU })
  },
  backdrop(pen, w, h, t, scene) {
    if (scene && !scene.map) return
    // Two ribbons flowing across, a stitch running along each, a sheen sliding.
    RIBBONS.forEach(([fy, light, dark], r) => {
      const base = h * fy + Math.sin(t * 0.2 + r * 2) * 8
      for (let x = 0; x < w; x++) {
        const y = Math.round(base + Math.sin(x * 0.05 + t * (0.6 + r * 0.2) + r) * 8)
        pen.globalAlpha = stepAlpha(0.45)
        pen.fillStyle = light
        pen.fillRect(x, y, 1, 2)
        pen.fillStyle = dark
        pen.fillRect(x, y + 2, 1, 2)
        // The stitch along its middle.
        if ((x + Math.floor(t * 4)) % 4 < 2) {
          pen.globalAlpha = stepAlpha(0.5)
          pen.fillStyle = '#fff3f7'
          pen.fillRect(x, y + 2, 1, 1)
        }
        // The sheen: a bright run sliding along.
        if ((x - Math.floor(t * 30) + r * 40) % 70 < 6) {
          pen.globalAlpha = stepAlpha(0.75)
          pen.fillStyle = '#ffffff'
          pen.fillRect(x, y, 1, 1)
        }
      }
    })
  },
  burst(rand, x, y, zone = zoneAt(x, y)) {
    // A running stitch sews itself along the CTA's foot, out from the press…
    const out: Particle[] = [
      p({ kind: 'stitch', x: zone.l + 4, y: zone.t + 4, n: zone.r - zone.l - 8, phase: x - zone.l - 4, life: 1, zone, ink: '#5a1830' }),
      p({ kind: 'stitch', x: zone.l + 4, y: zone.b - 5, n: zone.r - zone.l - 8, phase: x - zone.l - 4, life: 1, zone, ink: '#5a1830' }),
    ]
    // …and petals burst from both its ends, out across the margins and down.
    for (let i = 0; i < 30; i++) {
      const right = i % 2 === 1
      const v = 20 + rand() * 45
      out.push(p({ kind: 'pburst', x: (right ? zone.r - 6 : zone.l + 6) + (rand() - 0.5) * 6, y: zone.t + (zone.b - zone.t) * (0.3 + rand() * 0.4), vx: (right ? 1 : -1) * v, vy: -14 - rand() * 14, life: 1 + rand() * 0.6, color: pick(rand, ['#ffffff', '#f6d2de', '#c4627f', '#e9a8bf']), phase: rand() * TAU, zone, ink: '#5a1830' }))
    }
    return out
  },
  switchIn(rand, w, h) {
    return Array.from({ length: 30 }, () => p({ kind: 'petal', x: -4 - rand() * w * 0.4, y: rand() * h, vx: 70 + rand() * 50, vy: 6, life: 1.4 + rand() * 0.6, color: pick(rand, PETAL_C), phase: rand() * TAU }))
  },
  sweepLife: 0.9,
  drawSweep(pen, w, h, s) {
    // A ribbon sweeps across the screen, its head leading, its tail fading.
    const head = (s.age / s.life) * (w + 60)
    for (let x = 0; x < Math.min(w, head); x++) {
      const a = stepAlpha(0.7 - (head - x) / (w * 1.2))
      if (a <= 0) continue
      pen.globalAlpha = a
      const y = Math.round(h * 0.5 + Math.sin(x * 0.045) * h * 0.18 + Math.sin(x * 0.17) * 4)
      pen.fillStyle = '#e9a8bf'
      pen.fillRect(x, y - 3, 1, 4)
      pen.fillStyle = '#c4627f'
      pen.fillRect(x, y + 1, 1, 3)
      if (x % 4 < 2) {
        pen.fillStyle = '#fff3f7'
        pen.fillRect(x, y, 1, 1)
      }
    }
  },
}

// ---------------------------------------------------------------------------
// ARCANE NIGHT — Moonquill
// ---------------------------------------------------------------------------
const STAR_C = ['#ffffff', '#d4daf2', '#c9d4ff']
function drawRune(pen: Pen, q: Particle): void {
  const g = RUNES_5[(q.n ?? 0) % RUNES_5.length]
  const x0 = Math.round(q.x)
  const y0 = Math.round(q.y)
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (g[y][x] === 's') pen.fillRect(x0 + x, y0 + y, 1, 1)
}
const arcane: World = {
  density: 0.0045,
  spawn(rand, w, h) {
    const r = rand()
    if (r < 0.2) return p({ kind: 'rune', x: rand() * w, y: rand() * h, vy: -2 - rand() * 2.5, vx: (rand() - 0.5) * 1.5, life: 12 + rand() * 6, color: rand() < 0.3 ? '#c9d4ff' : '#8fa4ff', n: Math.floor(rand() * RUNES_5.length) })
    if (r < 0.27) return p({ kind: 'quill', x: rand() * w, y: rand() * h, life: 2.4, color: '#c9d4ff', phase: rand() * TAU, n: Math.floor(rand() * 4) })
    return p({ kind: 'star', x: rand() * w, y: rand() * h, life: 6 + rand() * 10, size: rand() < 0.3 ? 2 : 1, color: pick(rand, STAR_C), phase: rand() * TAU })
  },
  backdrop(pen, w, h, t, scene) {
    if (scene && !scene.map) return
    // The crescent moon, top right, and its beam slanting down, dithered.
    const mx = w - 22
    const my = Math.round(h * 0.2)
    if (!scene?.light) dither(pen, mx, my, 13, '#c9d4ff', 0.2)
    pen.fillStyle = '#eef1fb'
    pen.globalAlpha = stepAlpha(0.85)
    for (let y = -7; y <= 7; y++)
      for (let x = -7; x <= 7; x++) {
        const inMoon = x * x + y * y <= 49
        const inBite = (x - 3) * (x - 3) + (y + 2) * (y + 2) <= 36
        if (inMoon && !inBite) pen.fillRect(mx + x, my + y, 1, 1)
      }
    if (scene?.light) return
    pen.fillStyle = '#c9d4ff'
    const shimmer = Math.floor(t * 2) & 1
    for (let y = my; y < h; y += 1) {
      const cx = mx - (y - my) * 0.55
      const half = 6 + (y - my) * 0.12
      pen.globalAlpha = stepAlpha(0.16 * (1 - (y - my) / h) + 0.02)
      for (let x = Math.round(cx - half); x < cx + half; x++) if (((x + y + shimmer) & 3) === 0) pen.fillRect(x, y, 1, 1)
    }
  },
  burst(rand, x, y, zone = zoneAt(x, y)) {
    const mid = (zone.t + zone.b) / 2
    return [
      // A ring of sparkles going out from each end of the CTA.
      ...Array.from({ length: 24 }, (_, i) => {
        const a = ((i >> 1) / 12) * TAU
        const ex = i % 2 ? zone.r - 7 : zone.l + 7
        return p({ kind: 'spark-still', x: ex, y: mid, vx: Math.cos(a) * 40, vy: Math.sin(a) * 22, life: 0.7, size: i % 3 ? 2 : 3, color: i % 4 < 2 ? '#ffffff' : '#eef1fb', zone, ink: '#0e1030' })
      }),
      // A rune lights at each end.
      p({ kind: 'rune', x: zone.l + 4, y: mid - 2, vy: -3, life: 1, color: '#0e1030', n: Math.floor(rand() * RUNES_5.length), zone }),
      p({ kind: 'rune', x: zone.r - 9, y: mid - 2, vy: -3, life: 1, color: '#0e1030', n: Math.floor(rand() * RUNES_5.length), zone }),
      ...Array.from({ length: 14 }, () => p({ kind: 'star', x: zone.l + rand() * (zone.r - zone.l), y: zone.t + rand() * (zone.b - zone.t + 6), life: 0.8 + rand() * 0.5, size: 2, color: '#ffffff', phase: rand() * 2, zone })),
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
  burst(rand, x, y, zone = zoneAt(x, y)) {
    return Array.from({ length: 12 }, () => {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.4
      const v = 25 + rand() * 30
      return p({ kind: 'drop', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + rand() * 0.4, color: rand() < 0.5 ? '#f0c46a' : '#ffe39a', zone })
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
  const x = Math.round(q.x)
  const y = Math.round(q.y)
  switch (q.kind) {
    case 'ember': {
      if (Math.sin(q.age * 23 + q.phase) > 0.9) return // flicker
      const s = q.size
      // A glowing ember: a red halo, its body cooling white → yellow → orange → red, a white-hot heart.
      pen.fillStyle = k < 0.5 ? '#ff8a2c' : '#b8321e'
      pen.globalAlpha = stepAlpha(fade * dim * 0.5)
      pen.fillRect(x - 1, y, s + 2, s)
      pen.fillRect(x, y - 1, s, s + 2)
      pen.fillStyle = fireColor(Math.min(0.99, k * 0.7 + 0.2))
      pen.globalAlpha = stepAlpha(fade * dim)
      pen.fillRect(x, y, s, s)
      if (k < 0.6) {
        pen.fillStyle = '#fff3c0'
        pen.fillRect(x + (s > 2 ? 1 : 0), y + (s > 2 ? 1 : 0), 1, 1)
      }
      return
    }
    case 'spark':
    case 'heavy': {
      // A thrown spark: a white-yellow core cooling to orange, an orange tail back along its path.
      const s = q.size
      const tail = s > 1 ? 4 : 3
      if (q.ink) {
        pen.fillStyle = q.ink
        pen.globalAlpha = stepAlpha(fade * dim * 0.75)
        pen.fillRect(x - 1, y - 1, s + 2, s + 2)
      }
      for (let i = tail; i >= 1; i--) {
        pen.fillStyle = i === 1 ? '#ffb347' : '#ff8a2c'
        pen.globalAlpha = stepAlpha(fade * dim * (0.75 - i * 0.15))
        pen.fillRect(Math.round(q.x - q.vx * 0.018 * i), Math.round(q.y - q.vy * 0.018 * i), 1, 1)
      }
      pen.fillStyle = FORGE_C[Math.min(FORGE_C.length - 1, Math.floor(k * 3.2))]
      pen.globalAlpha = stepAlpha(fade * dim)
      pen.fillRect(x, y, s, s)
      return
    }
    case 'flame':
      drawFlame(pen, q, fade * dim)
      return
    case 'seam': {
      // A molten flash running out along a seam from the press: white-hot at
      // its fronts, orange behind, cooling to red.
      const len = q.n ?? 0
      const spread = (k * 2.2 + 0.1) * len
      const press = q.phase
      for (let i = 0; i < len; i++) {
        const d = Math.abs(i - press)
        if (d > spread) continue
        const front = spread - d < 4
        pen.fillStyle = front ? '#ffffff' : k < 0.35 ? '#fff6d8' : k < 0.65 ? '#ffd35e' : '#ff8a2c'
        pen.globalAlpha = stepAlpha(dim * (front ? 1 : Math.min(1, (1 - k) * 1.6)))
        pen.fillRect(x + i, y, 1, 2)
        // A heat haze either side of the seam, dithered.
        if ((i & 1) === 0 && k < 0.6) {
          pen.fillStyle = '#ff8a2c'
          pen.globalAlpha = stepAlpha(dim * 0.5 * (1 - k))
          pen.fillRect(x + i, y - 1, 1, 1)
          pen.fillRect(x + i + 1, y + 2, 1, 1)
        }
      }
      return
    }
    case 'stitch': {
      // A running stitch sewing itself out from the press, two on, two off.
      const len = q.n ?? 0
      const reach = Math.min(1, k * 3) * len
      pen.fillStyle = q.ink ?? '#fff3f7'
      pen.globalAlpha = stepAlpha(dim * Math.min(1, (1 - k) * 3))
      for (let i = 0; i < len; i++) if (Math.abs(i - q.phase) <= reach && i % 4 < 2) pen.fillRect(x + i, y, 1, q.ink ? 2 : 1)
      return
    }
    case 'drip': {
      // Paint running down: a 2 px trail growing to its length, a bead at its foot.
      const len = Math.round(Math.min(1, k * 2.5) * (q.n ?? 8))
      pen.fillStyle = q.color
      pen.globalAlpha = stepAlpha(0.8 * fade * dim)
      pen.fillRect(x, y, q.size, len)
      pen.fillRect(x - 1, y + len, q.size + 2, 2)
      return
    }
    case 'splat': {
      // It lands: grows to its size in the first beat.
      const scale = k < 0.06 ? Math.max(1, q.size - 1) : q.size
      pen.fillStyle = q.color
      pen.globalAlpha = stepAlpha((q.zone ? 1 : 0.8) * fade * dim)
      if (q.phase === 1) {
        // An outline: the same splat one pixel wider each way, drawn first.
        const o = { ...q, x: q.x - 1 }
        drawSplat(pen, o, scale)
        drawSplat(pen, { ...q, x: q.x + 1 }, scale)
        drawSplat(pen, { ...q, y: q.y - 1 }, scale)
        drawSplat(pen, { ...q, y: q.y + 1 }, scale)
        return
      }
      drawSplat(pen, q, scale)
      if (!q.zone && scale > 2) {
        // A wet gloss on it.
        pen.fillStyle = '#f6efff'
        pen.fillRect(Math.round(q.x - scale), Math.round(q.y - scale), scale - 1, scale - 1)
        pen.fillStyle = q.color
        // It runs: two drips growing down from its foot.
        const run = Math.round(Math.min(1, k * 2.5) * scale * 4)
        pen.fillRect(Math.round(q.x - scale), Math.round(q.y + scale * 3), 2, run)
        pen.fillRect(Math.round(q.x + scale), Math.round(q.y + scale * 2), 2, Math.round(run * 0.6))
        pen.fillRect(Math.round(q.x - scale) - 1, Math.round(q.y + scale * 3) + run, 4, 2)
      }
      if (q.zone) {
        pen.fillStyle = '#f6efff'
        pen.fillRect(Math.round(q.x - scale), Math.round(q.y - scale * 2), scale, scale)
      }
      return
    }
    case 'petal':
    case 'pburst':
      drawPetal(pen, q, stepAlpha(0.9 * fade * dim))
      return
    case 'rune':
      pen.fillStyle = q.color
      pen.globalAlpha = stepAlpha((q.zone ? 1 : 0.6) * fade * dim * (0.75 + 0.25 * Math.sin(q.age * 1.5)))
      drawRune(pen, q)
      return
    case 'quill': {
      // An ink stroke writing itself along a curl, then fading.
      pen.fillStyle = q.color
      const len = Math.floor(Math.min(1, k * 2) * 22)
      for (let i = 0; i < len; i++) {
        pen.globalAlpha = stepAlpha(0.55 * dim * (k > 0.5 ? (1 - k) * 2 : 1))
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
      pen.fillRect(x, y, 1, 1)
      if (lvl === 1 || q.size > 1) {
        // A four-point twinkle; a big star's arms are two long.
        const arm = q.size > 1 && lvl === 1 ? 2 : 1
        pen.globalAlpha = stepAlpha(0.5 * fade * dim * (lvl === 1 ? 1 : 0.5))
        pen.fillRect(x - arm, y, arm, 1)
        pen.fillRect(x + 1, y, arm, 1)
        pen.fillRect(x, y - arm, 1, arm)
        pen.fillRect(x, y + 1, 1, arm)
      }
      return
    }
    default:
      if (q.ink) {
        pen.fillStyle = q.ink
        pen.globalAlpha = stepAlpha(fade * dim * 0.75)
        pen.fillRect(x - 1, y - 1, q.size + 2, q.size + 2)
      }
      pen.fillStyle = q.color
      pen.globalAlpha = stepAlpha(fade * dim * (q.kind === 'mote' ? 0.5 : q.kind === 'ash' ? 0.6 : q.kind === 'fleck' ? 0.75 : 1))
      pen.fillRect(x, y, q.size, q.size)
  }
}

/** The most ambient particles a screen holds: the brief's cap, 60 on a phone. */
export function ambientCap(world: World, w: number, h: number, cssWidth: number): number {
  const cap = cssWidth < 700 ? 60 : 110
  return Math.min(cap, Math.round(world.density * w * h))
}
