import type { PropKind, Ramp, RockRamp } from '../data/fieldSeasons'
import { hash01 } from './seasonHash'

/**
 * The seasons' scenery, in pixels (Oct 2026; the designer: "map seasons
 * should have more visual interest beyond a color filter"). Everything here
 * is drawn ONCE, into the terrain bake (`terrain.bakeTerrain`), and cached:
 *
 *  - {@link repaint}: a sprite with its palette swapped — the pines' needles
 *    turned amber, wet or snow-laden, the rocks wet or snowed on. The pack's
 *    ramps are exact colours, so a swap is a lookup, never a filter.
 *  - {@link broadleaf}: a round broadleaf tree in the pack's look (light
 *    from the upper left, a 1 px `#161c2e` outline, a brown trunk), standing
 *    in for some pines: maples in the harvest, blossom trees in spring.
 *  - {@link propArt}: the seasonal props — hay bales, sheaves, sunflowers,
 *    flowers, puddles, mud, reeds, lily pads, drifts, fallen leaves — drawn
 *    procedurally, and Tiny Swords' own pumpkins and mushrooms (the caps
 *    repainted from red to a tan, off the tier-1 enemies' red)
 *    from the old CC0 build (`public/assets/deco/tinyswords/`, recorded in
 *    `CC0-MANIFEST.md`).
 *
 * Every variation is a hash of (seed, salt) — never a run's RNG stream.
 */

export interface PropArt {
  img: CanvasImageSource
  w: number
  h: number
  /** Stands upright (merged into the scenery's depth order) or lies flat on the ground. */
  upright: boolean
}

const OUTLINE = '#161c2e'
/** The pack's foliage ramp (pines and bushes), darkest first. */
export const FOLIAGE_FROM = ['#2a485e', '#27716f', '#2f966a', '#5ab659', '#bdd763'] as const
/** The pack's rock ramp, darkest first. */
export const ROCK_FROM = ['#506a69', '#669d9d', '#8cc3c4', '#d0deb5'] as const

const rgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.slice(1), 16)
  return [v >> 16, (v >> 8) & 255, v & 255]
}

/** A small pixel surface: set pixels by hex, then take it as a canvas. */
class Px {
  readonly data: Uint8ClampedArray
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4)
  }
  set(x: number, y: number, hex: string, a = 255): void {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const [r, g, b] = rgb(hex)
    const i = (y * this.w + x) * 4
    this.data[i] = r
    this.data[i + 1] = g
    this.data[i + 2] = b
    this.data[i + 3] = a
  }
  on(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.data[(y * this.w + x) * 4 + 3] > 0
  }
  /** A 1 px outline round everything drawn so far (the pack's halo colour). */
  outline(hex = OUTLINE, below = true): void {
    const add: [number, number][] = []
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.on(x, y)) continue
        if (this.on(x - 1, y) || this.on(x + 1, y) || this.on(x, y - 1) || (below && this.on(x, y + 1))) add.push([x, y])
      }
    for (const [x, y] of add) this.set(x, y, hex)
  }
  canvas(): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null
    const c = document.createElement('canvas')
    c.width = this.w
    c.height = this.h
    const g = c.getContext('2d')
    if (!g) return null
    g.putImageData(new ImageData(new Uint8ClampedArray(this.data), this.w, this.h), 0, 0)
    return c
  }
}

// ── Palette swaps ────────────────────────────────────────────────────────────
const SWAPS = new WeakMap<object, Map<string, HTMLCanvasElement>>()

/**
 * `img` (drawn at w × h) with each `from` colour replaced by the matching
 * `to` (nearest within a small distance; the outline, the trunk and anything
 * else are kept). Cached per image, size and ramp.
 */
export function repaint(img: CanvasImageSource, w: number, h: number, from: readonly string[], to: readonly string[], key: string): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  let byKey = SWAPS.get(img as object)
  if (!byKey) SWAPS.set(img as object, (byKey = new Map()))
  const k = `${w}x${h}:${key}`
  const hit = byKey.get(k)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) return null
  g.imageSmoothingEnabled = false
  g.drawImage(img, 0, 0, w, h)
  const id = g.getImageData(0, 0, w, h)
  const d = id.data
  const src = from.map(rgb)
  const dst = to.map(rgb)
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    let best = -1
    let bd = 34 * 34 * 3
    for (let s = 0; s < src.length; s++) {
      const dr = d[i] - src[s][0]
      const dg = d[i + 1] - src[s][1]
      const db = d[i + 2] - src[s][2]
      const dd = dr * dr + dg * dg + db * db
      if (dd < bd) {
        bd = dd
        best = s
      }
    }
    if (best < 0) continue
    d[i] = dst[best][0]
    d[i + 1] = dst[best][1]
    d[i + 2] = dst[best][2]
  }
  g.putImageData(id, 0, 0)
  byKey.set(k, c)
  return c
}

export const repaintFoliage = (img: CanvasImageSource, w: number, h: number, ramp: Ramp): HTMLCanvasElement | null => repaint(img, w, h, FOLIAGE_FROM, ramp, ramp.join(''))
export const repaintRock = (img: CanvasImageSource, w: number, h: number, ramp: RockRamp): HTMLCanvasElement | null => repaint(img, w, h, ROCK_FROM, ramp, ramp.join(''))

// ── Broadleaf trees ──────────────────────────────────────────────────────────
const TRUNK = ['#5a4646', '#866353', '#b48355'] as const
const BROAD = new Map<string, PropArt | null>()

/**
 * A round broadleaf tree, w × h, in `ramp` (the pack's five steps), lit from
 * the upper left like the pack; `blossom` dots its lit side with flowers.
 * The same (seed, size, ramp) is the same tree on every bake.
 */
export function broadleaf(ramp: Ramp, seed: number, w: number, h: number, blossom?: readonly string[]): PropArt | null {
  const key = `${ramp.join('')}:${seed % 7}:${w}x${h}:${blossom?.join('') ?? ''}`
  if (BROAD.has(key)) return BROAD.get(key) ?? null
  const p = new Px(w, h)
  const s = seed % 7
  // The trunk: from the foot up into the crown, flaring at the root.
  const cx = Math.floor(w / 2)
  const trunkTop = Math.round(h * 0.5)
  for (let y = trunkTop; y < h - 1; y++) {
    const flare = y > h - 5 ? 1 : 0
    for (let x = cx - 2 - flare; x <= cx + 1 + flare; x++) p.set(x, y, x <= cx - 2 ? TRUNK[0] : x >= cx + 1 ? TRUNK[0] : x === cx - 1 ? TRUNK[2] : TRUNK[1])
  }
  // The crown: a union of disks round an oval.
  const ccx = w / 2
  const ccy = h * 0.4
  const rx = w / 2 - 1.5
  const ry = h * 0.38
  const disks: { x: number; y: number; r: number }[] = [{ x: ccx, y: ccy, r: Math.min(rx, ry) * 0.72 }]
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + hash01(s, k, 51) * 0.6
    const rr = Math.min(rx, ry) * (0.36 + hash01(s, k, 52) * 0.14)
    disks.push({ x: ccx + Math.cos(a) * (rx - rr), y: ccy + Math.sin(a) * (ry - rr) * 0.92, r: rr })
  }
  const L = { x: -0.62, y: -0.78 }
  const crown: boolean[] = new Array(w * h).fill(false)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let best = -Infinity
      let nx = 0
      let ny = 0
      for (const d of disks) {
        const dx = (x + 0.5 - d.x) / d.r
        const dy = (y + 0.5 - d.y) / d.r
        const q = 1 - (dx * dx + dy * dy)
        if (q > best) {
          best = q
          nx = dx
          ny = dy
        }
      }
      if (best < 0) continue
      crown[y * w + x] = true
      // Light on the clump it belongs to, a little darker toward the crown's foot.
      const lit = -(nx * L.x + ny * L.y) * 0.75 + 0.35 - ((y - ccy) / ry) * 0.3 + (hash01(x >> 2, y >> 2, 53 + s) - 0.5) * 0.1
      const step = lit > 0.85 ? 4 : lit > 0.45 ? 3 : lit > 0.05 ? 2 : lit > -0.35 ? 1 : 0
      p.set(x, y, ramp[step])
    }
  // Blossom (or fruit): small clusters on the lit side.
  if (blossom?.length) {
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        if (!crown[y * w + x] || !crown[(y + 1) * w + x]) continue
        const r = hash01(x, y, 61 + s)
        if (r > 0.05) continue
        const c = blossom[Math.floor(hash01(x, y, 62) * blossom.length)]
        p.set(x, y, c)
        if (r < 0.025) {
          p.set(x + 1, y, c)
          p.set(x, y - 1, c)
        }
      }
  }
  p.outline()
  const c = p.canvas()
  const out = c ? { img: c, w, h, upright: true } : null
  BROAD.set(key, out)
  return out
}

// ── The CC0 Tiny Swords scatter (old build) ─────────────────────────────────
// Named literally so the service worker's precache finds them (`build/pwa.ts`).
const DECO_FILES = {
  mushroom1: 'assets/deco/tinyswords/deco_01.png',
  mushroom2: 'assets/deco/tinyswords/deco_02.png',
  pumpkin1: 'assets/deco/tinyswords/deco_12.png',
  pumpkin2: 'assets/deco/tinyswords/deco_13.png',
} as const
type DecoName = keyof typeof DECO_FILES
const decoImgs = new Map<DecoName, HTMLImageElement>()
let decoLoaded = 0

/** Fetch the scatter the seasons use (idempotent; a no-op outside a document). */
export function preloadSeasonArt(): void {
  if (typeof document === 'undefined' || decoImgs.size) return
  for (const [name, src] of Object.entries(DECO_FILES) as [DecoName, string][]) {
    const img = new Image()
    img.onload = () => decoLoaded++
    img.src = src
    decoImgs.set(name, img)
  }
}
/** How many of the scatter have decoded (part of the bake's key, so a bake re-runs once they arrive). */
export const seasonArtStamp = (): number => decoLoaded

/** One scatter sprite trimmed to its art, or null before it has decoded. */
const TRIM = new Map<DecoName, PropArt | null>()
function scatter(name: DecoName): PropArt | null {
  const img = decoImgs.get(name)
  if (!img || !img.complete || !img.naturalWidth || typeof document === 'undefined') return null
  if (TRIM.has(name)) return TRIM.get(name) ?? null
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) return null
  g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, c.width, c.height).data
  let x0 = c.width
  let y0 = c.height
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] > 40) {
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x)
        y1 = Math.max(y1, y)
      }
  if (x1 < 0) return null
  const t = document.createElement('canvas')
  t.width = x1 - x0 + 1
  t.height = y1 - y0 + 1
  t.getContext('2d')!.drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height)
  const out = { img: t, w: t.width, h: t.height, upright: true }
  TRIM.set(name, out)
  return out
}

// ── The procedural props ────────────────────────────────────────────────────
const PROPS = new Map<string, PropArt | null>()

const STRAW = ['#7a5a26', '#a8822e', '#cca440', '#e8cc6a', '#f6e4a0'] as const

function bale(s: number): Px {
  // A round bale on its side: the rolled face toward you, the body behind it.
  const W = 24
  const H = 17
  const p = new Px(W, H)
  const fx = 7.5
  const fy = 8.5
  const rx = 7
  const ry = 8
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const inBody = x >= fx && x <= W - 2 && y >= 1 && y <= H - 1
      const q = ((x + 0.5 - fx) / rx) ** 2 + ((y + 0.5 - fy) / ry) ** 2
      const backQ = ((x + 0.5 - (W - 2)) / (rx * 0.5)) ** 2 + ((y + 0.5 - fy) / ry) ** 2
      if (q > 1 && !inBody && backQ > 1) continue
      if (q <= 1) {
        // The cut face: a spiral of straw, lit from the upper left.
        const r = Math.sqrt(q)
        const ang = Math.atan2(y + 0.5 - fy, x + 0.5 - fx)
        const ring = Math.floor(r * 3.4 + ang / Math.PI + 4) % 2 === 0
        const lit = x + y < fx + fy - 2
        p.set(x, y, ring ? (lit ? STRAW[4] : STRAW[3]) : lit ? STRAW[3] : STRAW[2])
      } else {
        const step = y < 4 ? 3 : y < 9 ? 2 : y < 13 ? 1 : 0
        const streak = hash01(x, y >> 1, 70 + s) < 0.22
        p.set(x, y, streak ? STRAW[Math.min(4, step + 1)] : STRAW[step])
      }
    }
  // The twine round the body.
  for (let y = 1; y < H; y++) p.set(16, y, y % 3 === 0 ? STRAW[1] : STRAW[0])
  p.outline()
  return p
}

function sheaf(s: number): Px {
  // Three sheaves leaned together into a stook.
  const p = new Px(19, 24)
  for (const [bx, lean] of [
    [5, 2],
    [9, 0],
    [13, -2],
  ] as const) {
    for (let y = 3; y < 24; y++) {
      const t = (y - 3) / 20
      const x0 = bx + Math.round(lean * (1 - t))
      const wid = y < 9 ? 2 : y < 14 ? 1 : 2 + (y > 20 ? 1 : 0)
      for (let x = x0 - wid; x <= x0 + wid; x++) {
        const c = y < 7 ? STRAW[4] : y === 12 || y === 13 ? STRAW[0] : x === x0 - wid ? STRAW[1] : hash01(x, y, 72 + s) < 0.3 ? STRAW[3] : STRAW[2]
        p.set(x, y, c)
      }
    }
    // Ears of grain at the top.
    for (const dx of [-2, 0, 2]) p.set(bx + lean + dx, 2 - (dx === 0 ? 1 : 0), STRAW[3])
  }
  p.outline()
  return p
}

function sunflowers(s: number): Px {
  const p = new Px(22, 34)
  const n = 2 + (s % 2)
  for (let k = 0; k < n; k++) {
    const x = 4 + k * 7 + (hash01(k, s, 74) < 0.5 ? 0 : 1)
    const top = 4 + Math.floor(hash01(k, s, 75) * 8)
    for (let y = top + 3; y < 34; y++) p.set(x, y, y % 5 === 0 ? '#5a8a34' : '#3e6a2a')
    // Leaves.
    const ly = top + 11 + (k % 2) * 4
    for (const [dx, dy, c] of [
      [-1, 0, '#5a8a34'],
      [-2, -1, '#5a8a34'],
      [-3, -1, '#3e6a2a'],
      [1, 4, '#5a8a34'],
      [2, 3, '#5a8a34'],
      [3, 3, '#3e6a2a'],
    ] as const)
      p.set(x + dx, ly + dy, c)
    // The head: petals round a dark centre, tipped toward the light.
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const r = Math.abs(dx) + Math.abs(dy)
        if (r > 4 || (Math.abs(dx) === 3 && Math.abs(dy) === 3)) continue
        const centre = Math.abs(dx) <= 1 && Math.abs(dy) <= 1
        p.set(x + dx, top + dy, centre ? (dx < 0 && dy < 0 ? '#7a4a22' : '#4a2a16') : dy < 0 || dx < -1 ? '#ffe066' : '#f2b82a')
      }
  }
  p.outline(OUTLINE, false)
  return p
}

function flowers(s: number, palette: readonly string[]): Px {
  // A clump of blooms, each a 2 px petal cross round a yellow eye.
  const p = new Px(22, 14)
  const n = 4 + (s % 3)
  for (let k = 0; k < n; k++) {
    const x = 3 + Math.floor(hash01(k, s, 76) * 16)
    const y = 3 + Math.floor(hash01(k, s, 77) * 8)
    const c = palette[Math.floor(hash01(k, s, 78) * palette.length)]
    p.set(x, y + 3, '#3e7a3a')
    p.set(x + 1, y + 3, '#3e7a3a')
    p.set(x - 1, y + 3, '#5a9a4a')
    for (const [dx, dy] of [
      [-2, 0],
      [-1, 0],
      [1, 0],
      [2, 0],
      [0, -2],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const)
      p.set(x + dx, y + dy, c)
    p.set(x, y, '#f6d64a')
  }
  return p
}

/**
 * A rain puddle lying IN the ground (Oct 2026 asset critique: the old one, a
 * bright sky-blue oval with no rim, read as a disc floating over the grass):
 * smaller, a two-lobed wobbly outline, a wet-mud lip on the near side, the
 * overcast's grey sky in it and one glint — the water sits a value below the
 * grass, as a hollow does.
 */
function puddle(s: number): Px {
  const w = 16 + (s % 3) * 5
  const h = 8 + (s % 2) * 2
  const p = new Px(w, h)
  const lobe = 0.3 + (s % 4) * 0.1
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w
      const v = (y + 0.5 - h / 2) / (h / 2)
      // Two lobes: a pinched waist so it is not an ellipse.
      const half = Math.max(Math.sin(Math.PI * Math.min(1, u / lobe) * 0.5) * 0.85, Math.sin(Math.PI * Math.max(0, (u - lobe) / (1 - lobe)) * 0.5 + Math.PI / 2) * 0.95)
      const edge = Math.min(half, Math.sin(Math.PI * u)) + (hash01(x >> 1, s, 79) - 0.5) * 0.14
      if (Math.abs(v) > edge) continue
      const rim = Math.abs(v) > edge - 0.34
      // The near (lower) rim is wet mud; the far rim the water's dark edge.
      const c = rim ? (v > 0 ? '#2c2a22' : '#3a454c') : v < -0.2 ? '#8a9cac' : '#4e5e6c'
      p.set(x, y, c)
    }
  // One glint along the sky's band.
  const gy = Math.floor(h * 0.36)
  for (let x = Math.floor(w * 0.34); x < Math.floor(w * 0.34) + 3; x++) if (p.on(x, gy)) p.set(x, gy, '#d6e2ea')
  return p
}

/**
 * A brackish marsh pool (the art slot's salt marsh): dark green-brown water
 * with a pale salt rim on the far side, lighter where it catches the sky.
 */
function pool(s: number): Px {
  const w = 20 + (s % 3) * 5
  const h = 10 + (s % 2) * 2
  const p = new Px(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const q = ((x + 0.5 - w / 2) / (w / 2)) ** 2 + ((y + 0.5 - h / 2) / (h / 2)) ** 2 + (hash01(x >> 2, y >> 1, 90 + s) - 0.5) * 0.24
      if (q > 1) continue
      const far = y < h / 2
      const c = q > 0.74 ? (far ? '#c8c6a8' : '#2a3424') : far && q < 0.5 && y < h * 0.36 ? '#6a8a72' : '#36503e'
      p.set(x, y, c)
    }
  for (let x = Math.floor(w * 0.4); x < Math.floor(w * 0.4) + 3; x++) if (p.on(x, Math.floor(h * 0.34))) p.set(x, Math.floor(h * 0.34), '#a8c4ac')
  return p
}

/**
 * A pepper plant (Peppercorn's spice fields): a round leafy bush lit from the
 * upper left, hung with red and orange pods, each with its own highlight.
 */
function pepper(s: number): Px {
  const W = 15
  const H = 15
  const p = new Px(W, H)
  const LEAF = ['#24442a', '#3a6430', '#56863a', '#82aa4c'] as const
  for (let y = 2; y < H - 1; y++)
    for (let x = 0; x < W; x++) {
      const q = ((x + 0.5 - W / 2) / (W / 2 - 0.5)) ** 2 + ((y + 0.5 - 8) / 6.2) ** 2 + (hash01(x >> 1, y >> 1, 91 + s) - 0.5) * 0.3
      if (q > 1) continue
      const lit = (W / 2 - x) * 0.09 + (8 - y) * 0.11 + (hash01(x, y, 92 + s) - 0.5) * 0.35
      p.set(x, y, LEAF[lit > 0.55 ? 3 : lit > 0.05 ? 2 : lit > -0.45 ? 1 : 0])
    }
  // The stem at the foot.
  p.set(7, H - 1, '#3a2a1a')
  p.set(8, H - 1, '#3a2a1a')
  // Pods: two pixels long, hanging, a highlight on the lit side.
  const n = 4 + (s % 3)
  for (let k = 0; k < n; k++) {
    const x = 2 + Math.floor(hash01(k, s, 93) * 11)
    const y = 4 + Math.floor(hash01(k, s, 94) * 7)
    const ripe = hash01(k, s, 95) < 0.65
    p.set(x, y, ripe ? '#e0583a' : '#ec8a32')
    p.set(x, y + 1, ripe ? '#a83224' : '#c0601e')
    p.set(x, y + 2, ripe ? '#7a2018' : '#8a4416')
    if (x > 0) p.set(x - 1, y, ripe ? '#f49a7a' : '#f6c06a')
  }
  p.outline()
  return p
}

/**
 * A ring of small glowing mushrooms (the scrolls slot's hollows — Greenvial's
 * in the world bible): three to five pale caps with a lit rim and a soft
 * glow round each, on short stems, so a hollow in the snow-dark wood reads
 * as tended, a little magic.
 */
function glowcap(s: number): Px {
  const W = 21
  const H = 13
  const p = new Px(W, H)
  const n = 3 + (s % 3)
  const caps: [number, number][] = []
  for (let k = 0; k < n; k++) caps.push([3 + Math.floor((k / n) * 14 + hash01(k, s, 96) * 3), 4 + Math.floor(hash01(k, s, 97) * 4)])
  for (const [x, y] of caps) {
    // A short pale stem, then a domed cap: a lit top, a mid body, a dark rim.
    for (let yy = y + 1; yy < Math.min(H - 1, y + 4); yy++) p.set(x, yy, '#e6dcc4')
    for (let dx = -2; dx <= 2; dx++) p.set(x + dx, y, Math.abs(dx) === 2 ? '#1f7a74' : '#3fc2b0')
    for (let dx = -1; dx <= 1; dx++) p.set(x + dx, y - 1, dx < 1 ? '#bff8ea' : '#3fc2b0')
  }
  p.outline('#1c2a30')
  // The glow, round them where nothing is drawn: a soft halo of spores.
  for (const [x, y] of caps)
    for (let dy = -3; dy <= 2; dy++)
      for (let dx = -3; dx <= 3; dx++) if (Math.abs(dx) + Math.abs(dy) <= 4 && !p.on(x + dx, y + dy)) p.set(x + dx, y + dy, '#7fe8d6', 64)
  return p
}

/**
 * Cut quarry stone (Ironvein): two or three dressed blocks stacked, each with
 * a lit top, a mid face and a dark side (light from the upper left), chisel
 * marks on the faces, in the pack's rock ramp (repainted as the season's).
 */
function blocks(s: number): Px {
  const W = 22
  const H = 17
  const p = new Px(W, H)
  const R = ['#3a4a52', '#56707a', '#7c98a0', '#b4c8cc'] as const
  const block = (x0: number, y0: number, w: number, h: number, top: number) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const isTop = y < y0 + top
        const side = x >= x0 + w - 2
        const c = isTop ? (x < x0 + 2 ? R[3] : R[2]) : side ? R[0] : (x + y * 3 + s) % 7 === 0 ? R[0] : R[1]
        p.set(x, y, c)
      }
  }
  // The back block, then the front, then (sometimes) one on top.
  block(9, 5, 12, 9, 3)
  block(1, 8, 12, 9, 3)
  if (s % 2 === 0) block(4, 1, 9, 8, 3)
  p.outline()
  return p
}

function mud(s: number): Px {
  const w = 22 + (s % 3) * 6
  const h = 10 + (s % 2) * 3
  const p = new Px(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const q = ((x + 0.5 - w / 2) / (w / 2)) ** 2 + ((y + 0.5 - h / 2) / (h / 2)) ** 2 + (hash01(x >> 2, y >> 1, 80 + s) - 0.5) * 0.3
      if (q > 1) continue
      const r = hash01(x, y, 81 + s)
      p.set(x, y, r < 0.05 ? '#9a9890' : q < 0.45 ? '#3a2c22' : '#4c3a2c')
    }
  return p
}

/**
 * A reed bed (Oct 2026 asset critique: the old tuft, 11 x 16 in two greens,
 * read as a dark smudge at a phone's scale): blades in three greens lit on
 * their left, leaning out from the clump, and bulrush heads on some stems.
 */
function reeds(s: number): Px {
  const W = 15
  const H = 22
  const p = new Px(W, H)
  const n = 7 + (s % 3)
  for (let k = 0; k < n; k++) {
    const x0 = 3 + Math.floor(hash01(k, s, 82) * 9)
    const hgt = 9 + Math.floor(hash01(k, s, 83) * 11)
    const lean = (hash01(k, s, 84) - 0.5) * 0.5 + (x0 - W / 2) * 0.05
    const lit = hash01(k, s, 98) < 0.4
    for (let i = 0; i < hgt; i++) {
      const x = x0 + Math.round(lean * i)
      p.set(x, H - 1 - i, i < 3 ? '#3e5a2a' : lit ? (i > hgt - 4 ? '#a6c46a' : '#86a852') : i % 4 === 0 ? '#6a8a40' : '#557434')
    }
    if (hash01(k, s, 85) < 0.4 && hgt > 12) {
      const x = x0 + Math.round(lean * (hgt - 3))
      for (let i = 0; i < 4; i++) p.set(x, H - hgt + i, i === 0 ? '#9a6a3e' : '#6a4426')
      p.set(x, H - hgt - 1, '#86a852')
    }
  }
  p.outline(OUTLINE, false)
  return p
}

function lily(s: number): Px {
  const p = new Px(8, 5)
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 8; x++) {
      const q = ((x + 0.5 - 4) / 4) ** 2 + ((y + 0.5 - 2.5) / 2.5) ** 2
      if (q > 1) continue
      if (x >= 4 && x <= 5 && y === 2) continue // the notch
      p.set(x, y, y < 2 ? '#6aa45a' : '#3e7a46')
    }
  if (s % 3 === 0) {
    p.set(2, 1, '#f6c8da')
    p.set(3, 1, '#fdeef4')
    p.set(2, 0, '#f6c8da')
  }
  return p
}

function drift(s: number): Px {
  const w = 16 + (s % 3) * 4
  const h = 7 + (s % 2) * 2
  const p = new Px(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const cx = (x + 0.5) / w
      const top = h * (1 - 0.95 * Math.sin(Math.PI * cx) ** 0.7) + (hash01(x >> 1, s, 86) - 0.5) * 1.5
      if (y < top) continue
      p.set(x, y, y > h - 3 ? '#a4b8d0' : y < top + 2 ? '#ffffff' : '#e2eaf6')
    }
  p.outline('#5a6a86', false)
  return p
}

function leaves(s: number): Px {
  const p = new Px(12, 7)
  const cols = ['#9e4a2a', '#cc6e30', '#dca238', '#8e3430']
  for (let k = 0; k < 9; k++) {
    const x = Math.floor(hash01(k, s, 87) * 11)
    const y = Math.floor(hash01(k, s, 88) * 6)
    const c = cols[Math.floor(hash01(k, s, 89) * cols.length)]
    p.set(x, y, c)
    if (k % 2) p.set(x + 1, y, c)
  }
  return p
}

const SPRING_BLOOMS = ['#f2a8c4', '#fbf4f8', '#f6d64a', '#e888aa'] as const

/** A prop of `kind` in one of its variations (`seed`), or null (not decoded yet / no document). */
export function propArt(kind: PropKind, seed: number): PropArt | null {
  const v = seed % 6
  switch (kind) {
    case 'pumpkin':
      return scatter(v % 2 ? 'pumpkin1' : 'pumpkin2')
    case 'mushroom': {
      const m = scatter(v % 2 ? 'mushroom1' : 'mushroom2')
      const c = m && repaint(m.img, m.w, m.h, ['#db4c4c', '#7c4e5f'], ['#c09a72', '#7e5e4a'], 'tan')
      return m && c ? { ...m, img: c } : null
    }
  }
  const key = `${kind}:${v}`
  if (PROPS.has(key)) return PROPS.get(key) ?? null
  let p: Px
  let upright = true
  switch (kind) {
    case 'bale':
      p = bale(v)
      break
    case 'sheaf':
      p = sheaf(v)
      break
    case 'sunflower':
      p = sunflowers(v)
      break
    case 'reeds':
      p = reeds(v)
      break
    case 'drift':
      p = drift(v)
      break
    case 'flowers':
      p = flowers(v, SPRING_BLOOMS)
      upright = false
      break
    case 'puddle':
      p = puddle(v)
      upright = false
      break
    case 'mud':
      p = mud(v)
      upright = false
      break
    case 'pool':
      p = pool(v)
      upright = false
      break
    case 'pepper':
      p = pepper(v)
      break
    case 'blocks':
      p = blocks(v)
      break
    case 'glowcap':
      p = glowcap(v)
      break
    case 'lily':
      p = lily(v)
      upright = false
      break
    case 'leaves':
      p = leaves(v)
      upright = false
      break
  }
  const c = p.canvas()
  const out = c ? { img: c, w: p.w, h: p.h, upright } : null
  // Only cache a real canvas: outside a document, nothing.
  if (out) PROPS.set(key, out)
  return out
}

if (typeof document !== 'undefined') preloadSeasonArt()
