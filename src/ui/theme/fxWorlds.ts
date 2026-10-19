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
 *   - FIRE (Peppercorn): small embers rising slowly from the foot of the
 *     screen and beside the focused road (never on its line), a low burning
 *     horizon along the floor (the dock's top on the home) over a faint heat
 *     glow; press: a few flames up the CTA's face.
 *   - FORGE (Ironvein): three anvils on the floor, a few sparks thrown off
 *     them in slow arcs, ash drifting down; press: a molten flash along the
 *     CTA's seams and a handful of sparks.
 *   - MARSH (Butcherblock): a still reed bed along the floor under a low,
 *     breathing mist, smoke from the smokehouses curling slowly up, now and
 *     then a grain of salt catching the light; press: a pinch of salt
 *     scattered across the CTA's face.
 *   - SILK (Rosethread): rose petals tumbling down, two faint ribbons across
 *     the map with a slow sheen; press: a running stitch along the CTA.
 *   - GLASSHOUSE (Greenvial): three glowing mushrooms on the floor, spores
 *     rising slowly off them and drifting up through the screen, a leaf now
 *     and then; press: a puff of spores off the CTA.
 *   - The house look (your militia's neutral): a few lantern motes.
 *
 * The calm pass (Oct 2026; the designer: "a bit overwhelming now that I'm
 * playing more"): the worlds are FELT, not watched. The map, the roads and
 * the words are the show; the worlds are atmosphere at the edge of attention
 * (Slay the Spire's map, Hades' menus, Into the Breach). So: a third to a half
 * of the old particles (`ambientCap`: 24 on a phone, 40 on a desk), slow
 * drift, every ambient particle drawn at its world's `peak` at most (no pixel
 * brighter than the words near it), glows that breathe over eight seconds, a
 * switch-in that is a {@link SWITCH_S} crossfade with a faint, still wash of
 * the world, and a press that stays on its CTA's face.
 *
 * A press burst is ZONED to its CTA: it plays on the button's face only
 * (`zone`, the engine clips to it, and clears under the label), and never
 * flies over the panel's text round it.
 *
 * Pure: no DOM (a canvas context is passed in). Random draws come from the
 * `rand` the engine passes, so a test can drive a world deterministically.
 */
import type { ThemeId } from '../../game/run/militiaTheme'

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
  /**
   * The ambient particles' strength, 0–1: the engine draws them at this (× the
   * high-contrast dim). Bursts are drawn at full strength: they are feedback.
   */
  peak: number
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
/** A glow's breath, in seconds: slow enough to be felt, never watched. */
export const BREATH_S = 8
/** Alpha in eighths: pixel art fades in steps, not smoothly. */
export const stepAlpha = (a: number): number => Math.max(0, Math.min(1, Math.round(a * 8) / 8))
const pick = <T,>(rand: Rand, xs: readonly T[]): T => xs[Math.floor(rand() * xs.length) % xs.length]
const p = (o: Partial<Particle> & Pick<Particle, 'kind' | 'x' | 'y'>): Particle => ({ vx: 0, vy: 0, age: 0, life: 1, size: 1, color: '#fff', phase: 0, ...o })

/** How long a switch-in plays (s): the old world crossfades into the new over it. */
export const SWITCH_S = 0.35

/**
 * Where a burst may draw: its CTA's own face (the calm pass, Oct 2026: it
 * used to fly out into the margins round it).
 */
export function burstClip(z: Zone): Zone {
  return { l: z.l, t: z.t, r: z.r, b: z.b }
}
/** A CTA-sized zone round a point, when a burst has none (a test, a key press). */
const zoneAt = (x: number, y: number): Zone => ({ l: x - 40, t: y - 9, r: x + 40, b: y + 9 })

/** Advance one particle `dt` seconds; false once it is done or far off screen. */
export function step(q: Particle, dt: number, w: number, h: number): boolean {
  q.age += dt
  if (q.age >= q.life) return false
  switch (q.kind) {
    case 'ember':
      // Rising with a slow sway, the way a coal's spark rides the heat.
      q.vx = Math.sin(q.age * 1.1 + q.phase) * 3
      break
    case 'spark':
    case 'drop':
      q.vy += 70 * dt
      break
    case 'heavy':
      q.vy += 150 * dt
      break
    case 'grain':
      q.vy += 110 * dt
      break
    case 'wisp':
      // Smoke curling up: a slow sway, slowing as it thins.
      q.vx = Math.sin(q.age * 0.7 + q.phase) * 2.5
      break
    case 'spore':
      // A spore rides the warm air up, swaying.
      q.vx = Math.sin(q.age * 0.8 + q.phase) * 2
      break
    case 'pburst':
      q.vy += 35 * dt
      q.vx *= 1 - 1.5 * dt
      break
    case 'petal':
      q.vx = Math.sin(q.age * 0.9 + q.phase) * 4
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

/**
 * A dithered wash: every other pixel of a disc, so a glow stays pixel art.
 * The checker is anchored to the SCREEN's pixels, not the disc's centre (the
 * motion audit, Oct 2026): a wash that drifts a pixel then moves only its rim,
 * where a checker tied to its centre flipped every pixel of the disc at once —
 * a whole-blob flash, several a second, on a map.
 */
function dither(pen: Pen, cx: number, cy: number, r: number, color: string, alpha: number, offset = 0, sparse = false): void {
  pen.fillStyle = color
  pen.globalAlpha = stepAlpha(alpha)
  const r2 = r * r
  const x0 = Math.round(cx)
  const y0 = Math.round(cy)
  // `sparse`: one pixel in four (alpha steps in eighths, so a fainter wash
  // than an eighth is a thinner checker).
  const mask = sparse ? 3 : 1
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if ((x0 + x + y0 + y + offset) & mask) continue
      if (sparse && (y0 + y) & 1) continue
      if (x * x + y * y > r2) continue
      pen.fillRect(x0 + x, y0 + y, 1, 1)
    }
  }
}

/**
 * A dithered glow rising from `base` (a row) for `rows` rows, thinning as it
 * rises (and for a few rows below it, so it has no hard foot). It BREATHES —
 * its strength swells and ebbs over a few seconds — and its dither stays put:
 * the motion audit (Oct 2026) found the old crawling dither (the pattern
 * stepped sideways six times a second) changed every pixel of the band all the
 * time, the most motion on the home, along the dock you pick from. The flames
 * and the embers are the fire's motion; the heat only glows. (The calm pass:
 * one breath every {@link BREATH_S} seconds, a tenth of its strength.)
 */
function glowBand(pen: Pen, w: number, h: number, base: number, rows: number, color: string, peak: number, t: number): void {
  pen.fillStyle = color
  const b = Math.min(h - 1, Math.round(base))
  const breath = 0.9 + 0.1 * Math.sin((t * TAU) / BREATH_S)
  for (let y = Math.min(h - 1, b + 4); y > b - rows; y--) {
    const i = Math.max(0, b - y)
    const keep = (1 - i / rows) * (y > b ? 1 - (y - b) / 5 : 1) // how much of the row is lit
    pen.globalAlpha = stepAlpha(peak * keep * breath + 0.04)
    const stride = keep > 0.66 ? 2 : keep > 0.33 ? 3 : 5
    const shift = i % stride
    for (let x = shift; x < w; x += stride) pen.fillRect(x, y, 1, 1)
  }
}

const floorOf = (h: number, scene?: Scene) => Math.max(h * 0.3, Math.min(h, scene?.floor ?? h))
/** Anywhere above the floor, where no road is focused. */
const aboveFloor = (rand: Rand, w: number, floor: number): [number, number] => [rand() * w, floor * (0.4 + rand() * 0.6)]

/** How far a road's ember keeps off the road's line, in effect pixels (one is 3 CSS px). */
export const ROAD_CLEAR = 6
/** …and how far out beside it one may land. */
export const ROAD_BESIDE = 14

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
/** The fire's colours, cooling: no white-hot pixel in the ambient (the calm pass). */
const FIRE_C = ['#ffd35e', '#ff8a2c', '#e0521f', '#b8321e']
const fireColor = (k: number) => FIRE_C[Math.min(FIRE_C.length - 1, Math.floor(k * FIRE_C.length))]

/** A flame tongue: `n` px at its tallest, growing and dying over its life, yellow at the root. */
function drawFlame(pen: Pen, q: Particle, dim: number): void {
  const k = q.age / q.life
  const flick = 0.8 + 0.2 * Math.sin(q.age * 6 + q.phase)
  const h = Math.max(1, Math.round((q.n ?? 4) * Math.sin(Math.PI * Math.min(1, k * 1.15)) * flick))
  const x = Math.round(q.x)
  const y = Math.round(q.y)
  const wpx = q.size
  for (let i = 0; i < h; i++) {
    const f = i / h
    // The tongue narrows to a point, leaning with its sway.
    const lean = Math.round(Math.sin(q.age * 2.5 + q.phase + i * 0.5) * f)
    const ww = f > 0.7 ? 1 : wpx
    const x0 = x + lean + Math.floor((wpx - ww) / 2)
    if (q.zone) {
      // On a bright button, a dark char rim so the tongue reads.
      pen.fillStyle = '#5a1a0c'
      pen.globalAlpha = stepAlpha(dim * 0.9)
      pen.fillRect(x0 - 1, y - i, ww + 2, 1)
    }
    pen.fillStyle = f < 0.4 ? '#ffd35e' : f < 0.8 ? '#ff8a2c' : '#b8321e'
    pen.globalAlpha = stepAlpha(dim * (f < 0.8 ? 1 : 0.75))
    pen.fillRect(x0, y - i, ww, 1)
  }
  if (q.zone && h > 2) {
    pen.fillStyle = '#5a1a0c'
    pen.fillRect(x + Math.floor(wpx / 2), y - h, 1, 1)
  }
}

/**
 * A burning horizon: low flame tongues all along a row (`base`), each four
 * pixels wide, their heights a sum of slow waves — yellow at the roots, red at
 * the tips. Drawn behind the particles; it is what makes the world FIRE at a
 * glance, even in greyscale. (The calm pass: half as tall and half as strong,
 * its fastest wave a sixth of the old flicker, no white roots.)
 */
function flameLine(pen: Pen, w: number, base: number, t: number, maxH: number, alpha: number): void {
  const SHAPE = [0.55, 0.95, 1, 0.6]
  const heights: number[] = []
  for (let x0 = 0; x0 < w; x0 += 4) {
    const i = x0 / 4
    const n = 0.42 + 0.28 * Math.sin(i * 1.7 + t * 1.1) + 0.18 * Math.sin(i * 0.53 - t * 0.6) + 0.12 * Math.sin(i * 3.1 + t * 1.9)
    const tall = Math.max(1, n * maxH)
    for (let c = 0; c < 4; c++) heights.push(Math.round(tall * SHAPE[c]))
  }
  // One colour at a time, a vertical run per column: yellow roots, orange, red tips.
  const BANDS: [number, number, string, number][] = [
    [0, 0.45, '#ffd35e', 0.75],
    [0.45, 0.8, '#ff8a2c', 1],
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
  // The loudest world before the calm pass (Oct 2026): a quarter of its old
  // embers (11 on a phone, 34 on a desk), one pixel and slow, never white-hot.
  density: 0.0003,
  peak: 0.5,
  spawn(rand, w, h, seed, scene) {
    const floor = floorOf(h, scene)
    const r = rand()
    if (r < 0.06) {
      // A low flame licking up from the floor.
      return p({ kind: 'flame', x: rand() * w, y: floor + 1, life: 1.2 + rand() * 1.2, size: 2, n: 3 + Math.floor(rand() * 4), phase: rand() * TAU })
    }
    if (r < 0.1) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 0.9
      const v = 22 + rand() * 14
      return p({ kind: 'spark', x: rand() * w, y: floor - rand() * 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.9 + rand() * 0.6, n: 1 })
    }
    // An ember: beside the focused road a quarter of the time (never on its
    // line), else biased to the foot.
    const foot = (): [number, number] => [rand() * w, seed ? floor - floor * Math.pow(rand(), 1.8) : floor - rand() * floor * 0.3]
    const beside = r < 0.33
    let [x, y] = beside ? (besideRoad(rand, scene) ?? (scene?.hot.length ? foot() : aboveFloor(rand, w, floor))) : foot()
    // One thrown at the foot that lands on the road's line is thrown again,
    // then set beside the road.
    const hot = scene?.hot ?? []
    for (let k = 0; k < 6 && roadDistance(hot, x, y) < ROAD_CLEAR; k++) [x, y] = k < 3 ? foot() : (besideRoad(rand, scene) ?? [x, y])
    // They rise a little way and die: the fire stays a horizon at the foot,
    // not a blizzard over the map. Beside the road they are all one pixel,
    // so the road's own stops stay the biggest squares on it.
    return p({ kind: 'ember', x, y, vy: -4 - rand() * 5, life: 2.5 + rand() * 2.5, size: !beside && rand() < 0.25 ? 2 : 1, phase: rand() * TAU, n: 1 })
  },
  backdrop(pen, w, h, t, scene) {
    const floor = floorOf(h, scene)
    // The heat: a faint red band, an orange one nearer the coals, and the
    // flames themselves low along the floor.
    if (!scene?.light) {
      glowBand(pen, w, h, floor, Math.max(12, Math.round(h * 0.12)), '#b8321e', 0.12, t)
      glowBand(pen, w, h, floor, Math.max(5, Math.round(h * 0.04)), '#ff8a2c', 0.14, t + BREATH_S * 0.3)
      // The screen's own foot smoulders too (round the dock on a desk).
      if (floor < h - 8) glowBand(pen, w, h, h - 1, 8, '#b8321e', 0.12, t)
    }
    flameLine(pen, w, floor + 1, t, Math.max(4, Math.min(7, h * 0.026)), 0.45)
  },
  burst(rand, x, y, zone = zoneAt(x, y)) {
    const out: Particle[] = []
    // A few flames up the CTA's face from its foot, tallest where it was pressed.
    for (let fx = zone.l + 3; fx < zone.r - 3; fx += 7) {
      const near = 1 - Math.min(1, Math.abs(fx - x) / ((zone.r - zone.l) * 0.5))
      out.push(p({ kind: 'flame', x: fx, y: zone.b - 1, life: 0.45 + rand() * 0.25, size: 2, n: Math.round(3 + near * (zone.b - zone.t) * 0.5 + rand() * 2), phase: rand() * TAU, zone }))
    }
    // A few embers rising off the press, on the face.
    for (let i = 0; i < 4; i++) out.push(p({ kind: 'ember', x: x + (rand() - 0.5) * 10, y: zone.b - 2 - rand() * 3, vy: -8 - rand() * 8, life: 0.5 + rand() * 0.3, size: 1, phase: rand() * TAU, n: 1, zone }))
    return out
  },
  switchIn: () => [],
  sweepLife: SWITCH_S,
  drawSweep(pen, w, h, s) {
    // A faint warmth off the floor as the world comes in, fading where it lies.
    glowBand(pen, w, h, h - 1, Math.round(h * 0.25), '#ffb347', 0.16 * (1 - s.age / s.life), 0)
  },
}

// ---------------------------------------------------------------------------
// MARSH — Butcherblock
// ---------------------------------------------------------------------------
/** The smoke's greys, warm to cool, and the salt's glint. */
const SMOKE_C = ['#8a8478', '#a39d90', '#7a7f78']
const SALT_C = '#efe8d8'
/** The reed bed's stems: a dry ochre, its shade, and a cattail head. */
const REED_C = ['#8a8456', '#6a6448', '#6e4a30']
/**
 * A still reed bed along a row (`base`): stems of hashed heights every couple
 * of pixels, every so often one gone to a cattail. Still (the calm pass:
 * backdrops breathe, never crawl); the mist under it is what breathes.
 */
function reedBed(pen: Pen, w: number, base: number, maxH: number, alpha: number): void {
  const b = Math.round(base)
  for (let x = 0; x < w; x++) {
    const n = Math.sin(x * 12.9898) * 43758.5453
    const r = n - Math.floor(n)
    // The reeds stand in clumps with open water between (an even row of
    // stems read as a fence): a slow wave says where a clump is, and in one
    // a stem stands on about one column in two.
    const clump = Math.sin(x * 0.19) + 0.6 * Math.sin(x * 0.07 + 1.3)
    if (clump < 0.35 || r > 0.5) continue
    const h = Math.max(2, Math.round(maxH * (0.45 + r * 1.3)))
    pen.fillStyle = REED_C[x % 3 === 0 ? 1 : 0]
    pen.globalAlpha = stepAlpha(alpha)
    pen.fillRect(x, b - h + 1, 1, h)
    if (r < 0.06) {
      // A cattail: a brown head two pixels tall, a little under the tip.
      pen.fillStyle = REED_C[2]
      pen.fillRect(x, b - h + 2, 1, 2)
    }
  }
}
const marsh: World = {
  // Smoke and salt, slow and few: the reeds and the mist are the world.
  density: 0.0005,
  peak: 0.5,
  spawn(rand, w, h, seed, scene) {
    const floor = floorOf(h, scene)
    if (rand() < 0.18) {
      // A grain of salt on the air, catching the light now and then.
      return p({ kind: 'star', x: rand() * w, y: rand() * floor, life: 6 + rand() * 6, size: 1, color: SALT_C, phase: rand() * TAU })
    }
    // A wisp of smoke rising from the reed line, slowly, and thinning.
    const y = seed ? floor - rand() * floor * 0.8 : floor - rand() * 6
    return p({ kind: 'wisp', x: rand() * w, y, vy: -2 - rand() * 2.5, life: 9 + rand() * 6, size: rand() < 0.35 ? 2 : 1, color: pick(rand, SMOKE_C), phase: rand() * TAU })
  },
  backdrop(pen, w, h, t, scene) {
    const floor = floorOf(h, scene)
    // The marsh mist lying low over the floor, breathing; the reeds stand in it.
    if (!scene?.light) {
      glowBand(pen, w, h, floor, Math.max(10, Math.round(h * 0.09)), '#b0c4b8', 0.1, t)
      if (floor < h - 8) glowBand(pen, w, h, h - 1, 6, '#b0c4b8', 0.1, t)
    }
    reedBed(pen, w, floor + 1, Math.max(4, Math.min(8, h * 0.028)), 0.5)
  },
  burst(rand, x, y, zone = zoneAt(x, y)) {
    // A pinch of salt thrown across the CTA's face from the press, each grain
    // inked so it reads on the bright fill, falling back to the lip.
    const out: Particle[] = []
    const hgt = Math.max(6, zone.b - zone.t)
    const vyMax = Math.sqrt(2 * 110 * hgt * 0.5)
    for (let i = 0; i < 10; i++) {
      const vx = (rand() - 0.5) * 70
      const vy = -vyMax * (0.3 + rand() * 0.7)
      out.push(p({ kind: 'grain', x: x + (rand() - 0.5) * 6, y: zone.b - 3, vx, vy, life: 0.55 + rand() * 0.35, size: rand() < 0.3 ? 2 : 1, color: SALT_C, zone, ink: '#2a1a12' }))
    }
    return out
  },
  switchIn: () => [],
  sweepLife: SWITCH_S,
  drawSweep(pen, w, h, s) {
    // A faint mist off the floor as the world comes in, fading where it lies.
    glowBand(pen, w, h, h - 1, Math.round(h * 0.3), '#c8d4cc', 0.16 * (1 - s.age / s.life), 0)
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
  // The bar glows and dims over a slow breath (it flashed white-hot five times a second).
  const hot = 0.6 + 0.1 * Math.sin((t * TAU) / BREATH_S + i * 2)
  for (let y = 0; y < ANVIL.length; y++)
    for (let x = 0; x < 11; x++) {
      const ch = ANVIL[y][x]
      if (ch === '.') continue
      pen.fillStyle = ch === 'k' ? '#2a3341' : ch === 'l' ? '#9aa8ba' : '#ffb347'
      pen.globalAlpha = stepAlpha(ch === 'M' ? hot : 1)
      pen.fillRect(x0 + x * S, y0 + y * S, S, S)
    }
}
const forge: World = {
  // The forge's sparks were the most motion on a home after the fire's (the
  // calm pass, Oct 2026): a third of them, thrown lower and slower, one pixel.
  density: 0.0005,
  peak: 0.5,
  spawn(rand, w, h, seed, scene) {
    const floor = floorOf(h, scene)
    // Ash drifting down: the calm part of the forge, a third of what is in the air.
    if (rand() < 0.3) {
      return p({ kind: 'ash', x: rand() * w, y: seed ? rand() * h : rand() * h * 0.6, vx: (rand() - 0.5) * 2.5, vy: 3 + rand() * 3, life: 7 + rand() * 4, size: 1, color: pick(rand, ASH), phase: rand() * TAU })
    }
    // A spark thrown from one of the anvils, in a low arc that falls back.
    const fx = pick(rand, FOUNTAINS) * w + (rand() - 0.5) * 6
    const a = -Math.PI / 2 + (rand() - 0.5) * 1.1
    const v = 24 + rand() * 20
    // It lives until it falls back to the floor.
    const vy = Math.sin(a) * v
    const s = p({ kind: 'spark', x: fx, y: floor - 13, vx: Math.cos(a) * v, vy, life: Math.max(0.5, (-2 * vy) / 70 + 0.1), size: 1, n: 0 })
    if (seed) s.age = rand() * s.life * 0.8
    return s
  },
  backdrop(pen, w, h, t, scene) {
    const floor = floorOf(h, scene)
    if (!scene?.light) {
      glowBand(pen, w, h, floor, Math.max(8, Math.round(h * 0.07)), '#ff8a2c', 0.1, t)
      if (floor < h - 8) glowBand(pen, w, h, h - 1, 6, '#c8541c', 0.1, t)
    }
    // Each anvil glows faintly under its hot bar; the sparks fly off it.
    FOUNTAINS.forEach((f, i) => {
      if (!scene?.light) dither(pen, f * w, floor - 10, 11, '#ff9a3a', 0.125, i, true)
      drawAnvil(pen, f * w, floor, t, i)
    })
  },
  burst(rand, x, y, zone = zoneAt(x, y)) {
    // A molten flash runs a little way out along the CTA's foot seam from the press…
    const out: Particle[] = [
      p({ kind: 'seam', x: zone.l, y: zone.b - 2, n: zone.r - zone.l, phase: x - zone.l, life: 0.5, zone }),
    ]
    // …and a handful of sparks hop off the press in low arcs along the face
    // (never higher than half the button), an ink rim on the bright face.
    const hgt = Math.max(6, zone.b - zone.t)
    const vyMax = Math.sqrt(2 * 150 * hgt * 0.5)
    for (let i = 0; i < 8; i++) {
      const right = rand() < 0.5
      const vx = (right ? 1 : -1) * (15 + rand() * 40)
      const vy = -vyMax * (0.35 + rand() * 0.65)
      out.push(p({ kind: 'heavy', x: x + (rand() - 0.5) * 6, y: zone.b - 3, vx, vy, life: 0.5 + rand() * 0.4, size: rand() < 0.4 ? 2 : 1, n: 0, zone, ink: '#3a1406' }))
    }
    return out
  },
  switchIn: () => [],
  sweepLife: SWITCH_S,
  drawSweep(pen, w, h, s) {
    // A faint warm glow round the strike as the world comes in, fading where
    // it lies (it was a flash, a ring and fifty sparks).
    const glow = stepAlpha(0.2 * (1 - s.age / s.life))
    if (glow > 0) dither(pen, w / 2, h * 0.7, Math.round(Math.min(w, h) * 0.22), '#ffb347', glow)
  },
}

// ---------------------------------------------------------------------------
// SILK — Rosethread
// ---------------------------------------------------------------------------
const PETAL_C = ['#e9a8bf', '#f0b8cc', '#f6d2de', '#d98aa6']
/** A rose petal, tumbling: it turns edge-on and back as it falls. */
function drawPetal(pen: Pen, q: Particle, alpha: number): void {
  const flip = Math.abs(Math.sin(q.age * 1.3 + q.phase))
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
  // Petals falling at half the old speed, two in five of the old count.
  density: 0.00066,
  peak: 0.6,
  spawn(rand, w, h, seed) {
    return p({ kind: 'petal', x: rand() * w, y: seed ? rand() * h : -4 - rand() * h * 0.2, vy: 4 + rand() * 4, life: 30 + rand() * 8, color: pick(rand, PETAL_C), phase: rand() * TAU })
  },
  backdrop(pen, w, h, t, scene) {
    if (scene && !scene.map) return
    // Two faint ribbons across the map, a still stitch along each, a slow
    // sheen sliding (the wave a third as fast as before, the sheen a fifth).
    RIBBONS.forEach(([fy, light, dark], r) => {
      const base = h * fy + Math.sin(t * 0.08 + r * 2) * 6
      for (let x = 0; x < w; x++) {
        const y = Math.round(base + Math.sin(x * 0.05 + t * (0.12 + r * 0.05) + r) * 8)
        // A satin wash an eighth strong, its shaded edge and stitch a quarter
        // (round two of the calm pass: at a quarter all through, the ribbon
        // crossing the focused road pulled the eye off it).
        pen.globalAlpha = stepAlpha(0.125)
        pen.fillStyle = light
        pen.fillRect(x, y, 1, 2)
        pen.globalAlpha = stepAlpha(0.25)
        pen.fillStyle = dark
        pen.fillRect(x, y + 2, 1, 1)
        // The stitch along its middle.
        if (x % 4 < 2) {
          pen.fillStyle = '#fff3f7'
          pen.fillRect(x, y + 1, 1, 1)
        }
        // The sheen: a short bright run sliding slowly along.
        if (!scene?.light && (x - Math.floor(t * 6) + r * 40) % 90 < 4) {
          pen.globalAlpha = stepAlpha(0.25)
          pen.fillStyle = '#ffffff'
          pen.fillRect(x, y, 1, 1)
        }
      }
    })
  },
  burst(rand, x, y, zone = zoneAt(x, y)) {
    // A running stitch sews itself along the CTA's foot, out from the press,
    // and a few petals lift off the press.
    const out: Particle[] = [p({ kind: 'stitch', x: zone.l + 4, y: zone.b - 5, n: zone.r - zone.l - 8, phase: x - zone.l - 4, life: 0.9, zone, ink: '#5a1830' })]
    for (let i = 0; i < 6; i++) {
      out.push(p({ kind: 'pburst', x: x + (rand() - 0.5) * 16, y: zone.t + (zone.b - zone.t) * (0.3 + rand() * 0.4), vx: (rand() - 0.5) * 20, vy: -6 - rand() * 6, life: 0.7 + rand() * 0.4, color: pick(rand, ['#f6d2de', '#c4627f', '#e9a8bf']), phase: rand() * TAU, zone, ink: '#5a1830' }))
    }
    return out
  },
  switchIn: () => [],
  sweepLife: SWITCH_S,
  drawSweep(pen, w, h, s) {
    // A faint ribbon across the middle as the world comes in, fading where it lies.
    const a = stepAlpha(0.3 * (1 - s.age / s.life))
    if (!a) return
    pen.globalAlpha = a
    for (let x = 0; x < w; x++) {
      const y = Math.round(h * 0.5 + Math.sin(x * 0.045) * h * 0.18 + Math.sin(x * 0.17) * 4)
      pen.fillStyle = '#e9a8bf'
      pen.fillRect(x, y - 2, 1, 2)
      pen.fillStyle = '#c4627f'
      pen.fillRect(x, y, 1, 2)
    }
  },
}

// ---------------------------------------------------------------------------
// GLASSHOUSE — Greenvial
// ---------------------------------------------------------------------------
/** The spores' glow: lime and jade. */
const SPORE_C = ['#cfe86a', '#a8e08a', '#7fe0c4']
/** The three glowing mushrooms along the floor (fractions of the width; clear of the Buy Company slot at the right). */
const CAPS = [0.16, 0.45, 0.7]
/** A glowing mushroom, 9 × 7: `c` its cap, `C` the cap's lit spots, `g` the glowing gills, `s` the stem. */
const MUSHROOM = ['..ccccc..', '.cCcccCc.', 'ccccccccc', '.ggggggg.', '...sss...', '...sss...', '..sssss..']
function drawMushroom(pen: Pen, cx: number, floor: number, t: number, i: number): void {
  // At one effect pixel a cell (the first round drew them at two: three stalls
  // standing on the dock, watched, not felt).
  const S = 1
  const x0 = Math.round(cx) - 4
  const y0 = Math.round(floor) - MUSHROOM.length * S
  // The gills glow and dim over a slow breath, each cap on its own phase.
  const glow = 0.375 + 0.125 * Math.sin((t * TAU) / BREATH_S + i * 2.1)
  for (let y = 0; y < MUSHROOM.length; y++)
    for (let x = 0; x < 9; x++) {
      const ch = MUSHROOM[y][x]
      if (ch === '.') continue
      pen.fillStyle = ch === 'c' ? '#2a5c48' : ch === 'C' ? '#9ccc6a' : ch === 'g' ? '#cfe86a' : '#6e6a5a'
      pen.globalAlpha = stepAlpha(ch === 'g' ? glow : ch === 'C' ? 0.5 : 0.75)
      pen.fillRect(x0 + x * S, y0 + y * S, S, S)
    }
}
const glasshouse: World = {
  // Spores rising off the caps, slow and few, a leaf now and then.
  density: 0.0006,
  peak: 0.6,
  spawn(rand, w, h, seed, scene) {
    const floor = floorOf(h, scene)
    if (rand() < 0.12) {
      // A leaf drifting down from the glasshouse's vines.
      return p({ kind: 'fleck', x: rand() * w, y: seed ? rand() * h : -2, vx: (rand() - 0.5) * 2, vy: 2 + rand() * 2.5, life: 12 + rand() * 6, size: 2, color: rand() < 0.5 ? '#4c8a52' : '#6aa25a', phase: rand() * TAU })
    }
    // A spore: off one of the caps half the time, else anywhere below the sky.
    const off = rand() < 0.5
    const x = off ? pick(rand, CAPS) * w + (rand() - 0.5) * 10 : rand() * w
    const y = seed ? floor - rand() * floor * 0.9 : off ? floor - 6 : floor - rand() * floor * 0.4
    return p({ kind: 'spore', x, y, vy: -1.5 - rand() * 2, life: 10 + rand() * 8, size: rand() < 0.25 ? 2 : 1, color: pick(rand, SPORE_C), phase: rand() * TAU })
  },
  backdrop(pen, w, h, t, scene) {
    const floor = floorOf(h, scene)
    // Each cap glows faintly round its gills; the spores rise off it.
    CAPS.forEach((f, i) => {
      if (!scene?.light) dither(pen, f * w, floor - 4, 6, '#a8e08a', 0.125, i, true)
      drawMushroom(pen, f * w, floor, t, i)
    })
  },
  burst(rand, x, y, zone = zoneAt(x, y)) {
    // A puff of spores off the press, drifting up and out across the face,
    // each inked so it reads on the bright fill.
    return Array.from({ length: 9 }, (_, i) => {
      const a = -Math.PI / 2 + ((i / 8) - 0.5) * 2.6
      const v = 10 + rand() * 14
      return p({ kind: 'spore', x: x + (rand() - 0.5) * 4, y: (zone.t + zone.b) / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5, life: 0.6 + rand() * 0.4, size: 1 + (i % 2), color: pick(rand, SPORE_C), phase: rand() * TAU, zone, ink: '#06201a' })
    })
  },
  switchIn: () => [],
  sweepLife: SWITCH_S,
  drawSweep(pen, w, h, s) {
    // A faint green glow off the floor as the glasshouse comes in, fading where it lies.
    glowBand(pen, w, h, h - 1, Math.round(h * 0.28), '#a8e08a', 0.16 * (1 - s.age / s.life), 0)
  },
}

// ---------------------------------------------------------------------------
const lantern: World = {
  density: 0.0004,
  peak: 0.7,
  spawn(rand, w, h) {
    return p({ kind: 'mote', x: rand() * w, y: rand() * h, vy: -2 - rand() * 2.5, vx: (rand() - 0.5) * 1.5, life: 10 + rand() * 6, color: rand() < 0.5 ? '#f0c46a' : '#ffe39a', phase: rand() * TAU })
  },
  burst(rand, x, y, zone = zoneAt(x, y)) {
    return Array.from({ length: 5 }, () => {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.4
      const v = 12 + rand() * 12
      return p({ kind: 'drop', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + rand() * 0.3, color: rand() < 0.5 ? '#f0c46a' : '#ffe39a', zone })
    })
  },
  switchIn: () => [],
}

export const WORLDS: Readonly<Record<ThemeId, World>> = { neutral: lantern, spice: fire, art: marsh, metals: forge, silk, scrolls: glasshouse }

/** Draw one particle. */
export function drawParticle(pen: Pen, q: Particle, dim: number): void {
  const k = q.age / q.life
  // Fade in over the first tenth, out over the last third — in eighth steps.
  const fade = Math.min(1, q.age / (q.life * 0.1 + 0.001), (1 - k) * 3)
  const x = Math.round(q.x)
  const y = Math.round(q.y)
  switch (q.kind) {
    case 'ember': {
      const s = q.size
      // A glowing ember, cooling yellow → orange → red. A 2 px one has a faint
      // halo that gutters slowly; none has a white-hot heart (the calm pass).
      if (s > 1 && Math.sin(q.age * 3 + q.phase) <= 0.6) {
        pen.fillStyle = k < 0.5 ? '#ff8a2c' : '#b8321e'
        pen.globalAlpha = stepAlpha(fade * dim * 0.4)
        pen.fillRect(x - 1, y, s + 2, s)
        pen.fillRect(x, y - 1, s, s + 2)
      }
      pen.fillStyle = fireColor(Math.min(0.99, k * 0.8 + 0.05))
      pen.globalAlpha = stepAlpha(fade * dim)
      pen.fillRect(x, y, s, s)
      return
    }
    case 'grain':
      // A grain of salt: bone white, inked on the bright face.
      if (q.ink) {
        pen.fillStyle = q.ink
        pen.globalAlpha = stepAlpha(fade * dim * 0.75)
        pen.fillRect(x - 1, y - 1, q.size + 2, q.size + 2)
      }
      pen.fillStyle = q.color
      pen.globalAlpha = stepAlpha(fade * dim)
      pen.fillRect(x, y, q.size, q.size)
      return
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
      // A molten flash running a little way out along a seam from the press
      // (a third of the button at most: the calm pass), hot at its fronts,
      // orange behind, cooling to red.
      const len = q.n ?? 0
      const spread = Math.min(1, k * 2.5 + 0.1) * len * 0.3
      const press = q.phase
      for (let i = 0; i < len; i++) {
        const d = Math.abs(i - press)
        if (d > spread) continue
        const front = spread - d < 4
        pen.fillStyle = front ? '#ffe08a' : k < 0.35 ? '#ffd35e' : k < 0.65 ? '#ffb347' : '#ff8a2c'
        pen.globalAlpha = stepAlpha(dim * (front ? 0.85 : Math.min(0.75, (1 - k) * 1.4)))
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
    case 'petal':
    case 'pburst':
      drawPetal(pen, q, stepAlpha(0.9 * fade * dim))
      return
    case 'wisp': {
      // A curl of smoke: a pixel or two, thinning as it rises, a fainter
      // pixel trailing under it.
      pen.fillStyle = q.color
      pen.globalAlpha = stepAlpha(fade * dim * 0.6 * (1 - k * 0.5))
      pen.fillRect(x, y, q.size, 1)
      pen.globalAlpha = stepAlpha(fade * dim * 0.3 * (1 - k * 0.5))
      pen.fillRect(x + (Math.sin(q.age + q.phase) > 0 ? 1 : -1), y + 1, 1, 1)
      return
    }
    case 'spore': {
      // A glowing spore: its core, and on a big one a faint cross of glow
      // that swells and ebbs slowly.
      const pulse = 0.75 + 0.25 * Math.sin(q.age * 0.9 + q.phase)
      if (q.ink) {
        pen.fillStyle = q.ink
        pen.globalAlpha = stepAlpha(fade * dim * 0.75)
        pen.fillRect(x - 1, y - 1, q.size + 2, q.size + 2)
      }
      if (q.size > 1 && !q.zone) {
        pen.fillStyle = q.color
        pen.globalAlpha = stepAlpha(fade * dim * 0.3 * pulse)
        pen.fillRect(x - 1, y, q.size + 2, q.size)
        pen.fillRect(x, y - 1, q.size, q.size + 2)
      }
      pen.fillStyle = q.color
      pen.globalAlpha = stepAlpha(fade * dim * pulse)
      pen.fillRect(x, y, q.size, q.size)
      return
    }
    case 'star': {
      // A slow twinkle: one swell every seven seconds (it was under three).
      const tw = 0.5 + 0.5 * Math.sin(q.age * 0.9 + q.phase)
      const lvl = tw < 0.33 ? 0.25 : tw < 0.75 ? 0.5 : 1
      pen.fillStyle = q.color
      pen.globalAlpha = stepAlpha(lvl * fade * dim)
      pen.fillRect(x, y, 1, 1)
      if ((lvl === 1 && q.size > 1) || q.zone) {
        // A four-point twinkle, on the big stars only.
        const arm = 1
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

/** The most ambient particles a phone screen holds (60 before the calm pass, Oct 2026). */
export const AMBIENT_CAP_PHONE = 24
/** …and a desk's (110 before). */
export const AMBIENT_CAP_DESK = 40

/** The most ambient particles a screen holds: {@link AMBIENT_CAP_PHONE} on a phone, {@link AMBIENT_CAP_DESK} on a desk. */
export function ambientCap(world: World, w: number, h: number, cssWidth: number): number {
  const cap = cssWidth < 700 ? AMBIENT_CAP_PHONE : AMBIENT_CAP_DESK
  return Math.min(cap, Math.round(world.density * w * h))
}
