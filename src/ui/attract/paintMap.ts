/**
 * The menu's trade map — the PAINTER.
 *
 * Two bakes and a frame:
 *
 *  - {@link bakePixels}: the map at ONE pixel per map pixel — night terrain
 *    (grass with tonal noise, a sea with its shore, pine woods, a few peaks on
 *    the Metals road, farm plots round the hub), the five roads, their towns,
 *    the HQ keep and your militia's banner over it. All drawn here in the
 *    Tiny Swords manner (flat fills inside the `#161c2e` outline) from pixel
 *    strings; nothing is loaded, so nothing joins the precache.
 *  - {@link bakeBase}: that bake scaled up by a WHOLE number `k` of device
 *    pixels per map pixel (no smoothing), with the static light laid over it
 *    additively — each road's glow by standing, the town lanterns, the hub.
 *    Light is deliberately soft: it is light, not pixel art.
 *  - {@link drawFrame}: the base, then the traffic — a pulse is a 3px core and
 *    a 5px dithered tail with a small glow, a wagon every third pulse from
 *    Standing 7. One `drawImage` of the base and a few dozen small fills.
 */
import { companyById, type CompanyId } from '../../game/data/companies'
import { bannerPalette, bannerRows, type BannerLook } from '../../game/data/banner'
import { OUTLINE, pixelRuns } from '../../game/data/pixelArt'
import { RNG } from '../../game/core/rng'
import { glowAlpha, glowWidth, litBy, pulseIndex, seasonFor, type MapFocus, type MapGeometry, type MapSeason, type Pulse, type RoadView } from './mapRules'

/** The night palette, dusk-lifted (`trade/NOTES.md` § Round 2). */
const NIGHT = {
  grass: ['#1d2a1f', '#212f22', '#253425', '#2a3a29'],
  forest: ['#0e170f', '#1a2d1b', '#2a4428'],
  trunk: '#2a1c12',
  water: ['#122230', '#152837'],
  foam: '#2d5266',
  sand: '#3a3626',
  rock: ['#2e2d2a', '#45433d', '#9a9ca2'],
  field: ['#352d1c', '#2f2818'],
  road: '#4a3824',
  roadEdge: '#16100a',
  unlit: '#6a5638',
  keep: { wall: '#7a6648', roof: '#3a2614', flag: '#e0ac4c' },
  // A town's roof: warm thatch-and-tile at night, so a house reads by its roof first.
  townRoof: '#7a3f24',
  pulseCore: '#fff3c4',
  window: '#f5c451',
} as const

/**
 * A pine, 5 × 7: three tiers lit from the upper left (`2` the lit side, `0`
 * the shade). The marks critique (Oct 2026): the old one was lit in the
 * middle and darker than the grass at its foot, so a wood read as black
 * blots; this one is still dim — it frames the roads — but reads as trees.
 */
const PINE = ['..2..', '.221.', '.211.', '22110', '.210.', '21100', '..t..']

/**
 * A peak on the ore road, 13 × 7 (`2` snow, `1` the lit west face, `0` the
 * shade): a summit with a shoulder and a ragged snowline. It was a 45° wedge
 * with a flat cap, which read as a tent (the marks critique).
 */
const PEAK = ['.....2.......', '....220......', '...2120..2...', '...11000220..', '..1110000100.', '.111100000000', '1111000000000']

/**
 * The towns, by their foot's middle: a house with a pitched roof (`r`), its
 * walls (`w`) and a lit window (`y`); the destination is wider, with two. They
 * were flat boxes, which read as crates beside the road (the marks critique).
 */
const TOWN = ['...o...', '..oro..', '.orrro.', 'orrrrro', 'owwwwwo', 'owwywwo', 'ooooooo']
const CITY = ['....o....', '...oro...', '..orrro..', '.orrrrro.', 'orrrrrrro', 'owwwwwwwo', 'owywwwywo', 'ooooooooo']

const hexRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const rgba = (h: string, a: number): string => `rgba(${hexRgb(h).join(',')},${Math.max(0, Math.min(1, a))})`
const mix = (a: string, b: string, t: number): string => {
  const A = hexRgb(a)
  const B = hexRgb(b)
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`
}
const colorOf = (c: CompanyId): string => companyById(c).color

function valueNoise(seed: number): (x: number, y: number) => number {
  const R = new RNG(seed)
  const P = Array.from({ length: 512 }, () => R.next())
  const h = (x: number, y: number) => P[((x * 73856093) ^ (y * 19349663)) & 511]
  const sm = (t: number) => t * t * (3 - 2 * t)
  return (x, y) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = sm(x - xi)
    const yf = sm(y - yi)
    const a = h(xi, yi)
    const b = h(xi + 1, yi)
    const c = h(xi, yi + 1)
    const d = h(xi + 1, yi + 1)
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf
  }
}

const canvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas')
  c.width = Math.max(1, w)
  c.height = Math.max(1, h)
  return c
}

/**
 * The terrain under the roads (grass, sea, woods, peaks, farm plots). It does
 * not depend on standing or the banner, so it is cached per layout: a return
 * to the menu, or a standing gained, repaints only the roads, towns and hub.
 *
 * Baked in slices ({@link bakeTerrain}): a phone's first bake is ~30 ms of
 * main thread, ~150–250 ms under a 4× CPU throttle on a cold JIT, so it runs
 * a few ms at a time between frames instead of as one long task. The menu is
 * fully usable meanwhile; the map fades in when it lands.
 */
const TERRAIN = new Map<string, HTMLCanvasElement>()
const TERRAIN_CACHE = 2
const terrainKey = (geo: MapGeometry): string => `${geo.W}x${geo.H}|${geo.hub}|${geo.routes.map((r) => r.towns[2]).join(';')}`

/** The terrain for this layout, if it is baked. */
export const cachedTerrain = (geo: MapGeometry): HTMLCanvasElement | null => TERRAIN.get(terrainKey(geo)) ?? null

/**
 * Bake the terrain for this layout a slice at a time (`sliceMs` of work, then
 * a yield to the event loop). `cancelled()` stops it between slices.
 */
export function bakeTerrain(geo: MapGeometry, sliceMs = 6, cancelled: () => boolean = () => false): Promise<HTMLCanvasElement | null> {
  const hit = cachedTerrain(geo)
  if (hit) return Promise.resolve(hit)
  const steps = terrainSteps(geo)
  return new Promise((resolve) => {
    const run = () => {
      if (cancelled()) return resolve(null)
      const t0 = performance.now()
      let r = steps.next()
      while (!r.done && performance.now() - t0 < sliceMs) r = steps.next()
      if (!r.done) return void setTimeout(run, 0)
      TERRAIN.set(terrainKey(geo), r.value)
      while (TERRAIN.size > TERRAIN_CACHE) TERRAIN.delete(TERRAIN.keys().next().value!)
      resolve(r.value)
    }
    run()
  })
}

/** The full map at one pixel per map pixel: the terrain, then the roads, towns and hub. */
export function bakePixels(geo: MapGeometry, terrain: HTMLCanvasElement, roads: readonly RoadView[], banner: BannerLook): HTMLCanvasElement {
  const c = canvas(geo.W, geo.H)
  const ctx = c.getContext('2d')!
  ctx.drawImage(terrain, 0, 0)
  drawRoads(ctx, geo, roads)
  drawTowns(ctx, geo, roads)
  drawHub(ctx, geo, banner)
  return c
}

/** A colour as one little-endian RGBA word, for a `Uint32Array` over image data. */
const packed = (hex: string): number => {
  const [r, g, b] = hexRgb(hex)
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
}
const P = {
  grass: NIGHT.grass.map(packed),
  forest: NIGHT.forest.map(packed),
  trunk: packed(NIGHT.trunk),
  water: NIGHT.water.map(packed),
  foam: packed(NIGHT.foam),
  sand: packed(NIGHT.sand),
  rock: NIGHT.rock.map(packed),
  field: NIGHT.field.map(packed),
}

function* terrainSteps(geo: MapGeometry): Generator<void, HTMLCanvasElement, void> {
  const { W, H } = geo
  const c = canvas(W, H)
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(W, H)
  const px = new Uint32Array(img.data.buffer)
  const n1 = valueNoise(11)
  const n2 = valueNoise(23)
  const n3 = valueNoise(37)
  const set = (x: number, y: number, col: number) => {
    if (x >= 0 && y >= 0 && x < W && y < H) px[y * W + x] = col
  }
  // Keep land (and no decoration) within a few px of every road and town.
  const near = new Uint8Array(W * H)
  const mark = (x: number, y: number, r: number) => {
    for (let b = Math.max(0, y - r); b <= Math.min(H - 1, y + r); b++) near.fill(1, b * W + Math.max(0, x - r), b * W + Math.min(W - 1, x + r) + 1)
  }
  for (const r of geo.routes) {
    for (const [x, y] of r.chain) mark(x, y, 3)
    for (const [x, y] of r.towns) mark(x, y - 3, 6)
  }
  mark(geo.hub[0], geo.hub[1] - 6, 16)
  const { sea } = geo
  // The sea, as a mask, once: an ellipse with a noisy shore (the noise only
  // where the shore can be), and never within reach of a road or town.
  const wet = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    if (y % 8 === 0) yield
    const ey = ((y - sea.cy) / sea.ry) ** 2
    if (ey > 1.18) continue
    for (let x = 0; x < W; x++) {
      const e = ((x - sea.cx) / sea.rx) ** 2 + ey
      if (e > 1.18 || near[y * W + x]) continue
      if (e < 0.82 || e < 1 + (n1(x / 22, y / 22) - 0.5) * 0.35) wet[y * W + x] = 1
    }
  }
  const water = (x: number, y: number): boolean => wet[Math.max(0, Math.min(H - 1, y)) * W + Math.max(0, Math.min(W - 1, x))] === 1
  // The shore can only be within 2px of the sea's box: rows and columns
  // outside it skip the four neighbour reads.
  const sx0 = sea.cx - sea.rx * 1.1 - 3
  const sx1 = sea.cx + sea.rx * 1.1 + 3
  const sy0 = sea.cy - sea.ry * 1.1 - 3
  const sy1 = sea.cy + sea.ry * 1.1 + 3
  const R = new RNG(5)
  for (let y = 0; y < H; y++) {
    if (y % 4 === 0) yield
    const shoreRow = y >= sy0 && y <= sy1
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (wet[i]) {
        const wave = (x + y * 3 + Math.floor(n2(x / 6, y / 3) * 6)) % 17 === 0
        px[i] = wave ? P.foam : P.water[n2(x / 12, y / 12) > 0.5 ? 1 : 0]
        continue
      }
      if (shoreRow && x >= sx0 && x <= sx1 && (water(x + 2, y) || water(x - 2, y) || water(x, y + 2) || water(x, y - 2))) {
        px[i] = P.sand
        continue
      }
      const v = n1(x / 18, y / 18) * 0.7 + n2(x / 5, y / 5) * 0.3
      let col = P.grass[Math.min(3, Math.floor(v * 4.2))]
      if ((x * 7 + y * 13) % 29 === 0 && R.next() > 0.4) col = P.grass[3]
      px[i] = col
    }
  }
  // Farm plots round the hub.
  const [hx, hy] = geo.hub
  for (let y = hy - 18; y < hy + 22; y++) {
    for (let x = hx - 30; x < hx + 30; x++) {
      const r = Math.hypot(x - hx, (y - hy) * 1.3)
      if (n3(x / 9, y / 9) > 0.62 && r > 9 && r < 30 && !water(x, y)) set(x, y, P.field[y % 3 === 0 ? 1 : 0])
    }
  }
  // Pine woods everywhere, a few peaks along the Metals road. Density scales with the area.
  const metals = geo.routes.find((r) => r.company === 'metals')!.towns[1]
  const count = Math.round((160 * (W * H)) / (195 * 422))
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && !near[y * W + x] && !wet[y * W + x]
  for (let k = 0; k < count; k++) {
    if (k % 64 === 0) yield
    const x = Math.floor(R.next() * W)
    const y = Math.floor(R.next() * H)
    if (!free(x, y)) continue
    const nearPeaks = Math.hypot(x - metals[0], y - metals[1]) < Math.min(W, H) * 0.3
    if (nearPeaks && R.next() > 0.25) {
      for (let j = 0; j < PEAK.length; j++) {
        const row = PEAK[j]
        for (let i = 0; i < row.length; i++) {
          const ch = row[i]
          if (ch !== '.' && free(x + i - 5, y + j)) set(x + i - 5, y + j, P.rock[+ch])
        }
      }
    } else if (n3(x / 14, y / 14) > 0.45) {
      for (let t = 0; t < 4; t++) {
        const tx = x + Math.floor((R.next() - 0.5) * 14)
        const ty = y + Math.floor((R.next() - 0.5) * 10)
        if (!free(tx, ty)) continue
        for (let j = 0; j < PINE.length; j++) {
          const row = PINE[j]
          for (let i = 0; i < row.length; i++) {
            const ch = row[i]
            if (ch === '.') continue
            if (free(tx + i - 2, ty + j - 6)) set(tx + i - 2, ty + j - 6, ch === 't' ? P.trunk : P.forest[+ch])
          }
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

function drawRoads(ctx: CanvasRenderingContext2D, geo: MapGeometry, roads: readonly RoadView[]): void {
  for (const r of geo.routes) {
    const v = roads.find((q) => q.company === r.company)!
    const co = colorOf(r.company)
    if (v.light === 0) {
      // Dotted: unlit, or faintly in the company's colour when it is hiring.
      ctx.fillStyle = v.state === 'hiring' ? mix(NIGHT.unlit, co, 0.45) : NIGHT.unlit
      r.chain.forEach(([x, y], j) => {
        if (j % 4 < 2) ctx.fillRect(x, y, 1, 1)
      })
      continue
    }
    ctx.fillStyle = NIGHT.roadEdge
    r.chain.forEach(([x, y]) => ctx.fillRect(x - 1, y - 1, 3, 3))
    ctx.fillStyle = NIGHT.road
    r.chain.forEach(([x, y]) => ctx.fillRect(x, y, 2, 2))
    // The lit core: brighter and wider with standing.
    ctx.fillStyle = rgba(co, Math.min(1, 0.25 + v.light * 0.08))
    const z = v.light >= 4 ? 2 : 1
    r.chain.forEach(([x, y]) => ctx.fillRect(x, y, z, z))
  }
}

function drawTowns(ctx: CanvasRenderingContext2D, geo: MapGeometry, roads: readonly RoadView[]): void {
  for (const r of geo.routes) {
    const v = roads.find((q) => q.company === r.company)!
    const lit = v.light > 0
    const ink: Record<string, string> = {
      o: OUTLINE,
      r: lit ? NIGHT.townRoof : mix(NIGHT.unlit, '#000000', 0.3),
      w: lit ? NIGHT.keep.wall : NIGHT.unlit,
      y: lit ? NIGHT.window : NIGHT.unlit,
    }
    r.towns.forEach(([x, y], k) => {
      const big = k === 2
      const art = big ? CITY : TOWN
      const left = x - Math.floor(art[0].length / 2)
      const top = y - art.length + 1
      art.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const fill = ink[row[i]]
          if (!fill) continue
          ctx.fillStyle = fill
          ctx.fillRect(left + i, top + j, 1, 1)
        }
      })
      if (!lit) return
      // The company's pennant over a town on a road you have worked, on its roof's peak.
      ctx.fillStyle = OUTLINE
      ctx.fillRect(x, top - 4, 1, 4)
      ctx.fillStyle = colorOf(r.company)
      ctx.fillRect(x + 1, top - 4, 3, 2)
    })
  }
}

function drawHub(ctx: CanvasRenderingContext2D, geo: MapGeometry, banner: BannerLook): void {
  const [hx, hy] = geo.hub
  ctx.fillStyle = OUTLINE
  ctx.fillRect(hx - 7, hy - 9, 15, 11)
  ctx.fillStyle = NIGHT.keep.wall
  ctx.fillRect(hx - 6, hy - 8, 13, 9)
  ctx.fillStyle = NIGHT.keep.roof
  ctx.fillRect(hx - 6, hy - 8, 13, 3)
  ctx.fillStyle = OUTLINE
  for (const dx of [-6, -2, 2, 6]) ctx.fillRect(hx + dx, hy - 11, 1, 3)
  ctx.fillStyle = NIGHT.window
  ctx.fillRect(hx - 1, hy - 3, 3, 4)
  ctx.fillRect(hx - 4, hy - 4, 1, 1)
  ctx.fillRect(hx + 4, hy - 4, 1, 1)
  // Your militia's banner flies over the HQ.
  const bx = hx + 8
  const by = hy - 21
  for (const r of pixelRuns(bannerRows(banner), bannerPalette(banner))) {
    ctx.fillStyle = r.fill
    ctx.fillRect(bx + r.x, by + r.y, r.w, 1)
  }
}

/** A per-pixel hash in [0, 1): the speckle is the same on every bake. */
const hash01 = (x: number, y: number, salt: number): number => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 2246822519)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const MIST_NOISE = valueNoise(53)
const SEASONED = new WeakMap<HTMLCanvasElement, Map<string, HTMLCanvasElement>>()

/**
 * The map's pixels in a company's season (`mapRules.MAP_SEASONS`): the same
 * bake — the same trees, the same shore — with a speckle on the open grass
 * and the tree-tops, a low mist, then the season's washes. Cached per bake
 * and season, so a focus change costs one `drawImage` after the first.
 */
export function seasonPixels(pixels: HTMLCanvasElement, season: MapSeason | null): HTMLCanvasElement {
  if (!season) return pixels
  let byName = SEASONED.get(pixels)
  if (!byName) SEASONED.set(pixels, (byName = new Map()))
  const hit = byName.get(season.name)
  if (hit) return hit
  const W = pixels.width
  const H = pixels.height
  const c = canvas(W, H)
  const g = c.getContext('2d')!
  g.drawImage(pixels, 0, 0)
  if (season.grass || season.trees || season.mist) {
    const img = g.getImageData(0, 0, W, H)
    const px = new Uint32Array(img.data.buffer)
    const grass = new Set(P.grass)
    const top = P.forest[2]
    const fleck = season.grass?.colors.map(packed) ?? []
    const snow = season.trees ? packed(season.trees.color) : 0
    const mist = season.mist ? hexRgb(season.mist.color) : null
    const d = img.data
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        const v = px[i]
        if (season.grass && grass.has(v) && hash01(x, y, 1) < season.grass.share) px[i] = fleck[Math.floor(hash01(x, y, 2) * fleck.length)]
        else if (season.trees && v === top && hash01(x, y, 3) < season.trees.share) px[i] = snow
        if (mist && season.mist) {
          const low = Math.max(0, Math.min(1, (y / H - (1 - season.mist.reach)) / season.mist.reach))
          const a = season.mist.alpha * low * (0.35 + 0.65 * MIST_NOISE(x / 46, y / 12))
          if (a > 0.004) {
            const j = i * 4
            d[j] += (mist[0] - d[j]) * a
            d[j + 1] += (mist[1] - d[j + 1]) * a
            d[j + 2] += (mist[2] - d[j + 2]) * a
          }
        }
      }
    }
    g.putImageData(img, 0, 0)
  }
  for (const w of season.washes) {
    g.globalCompositeOperation = w.op
    g.fillStyle = rgba(w.color, w.alpha)
    g.fillRect(0, 0, W, H)
  }
  g.globalCompositeOperation = 'source-over'
  byName.set(season.name, c)
  return c
}

/** How many chain pixels out of the hub a road's glow starts. */
const HUB_CLEAR = 8

/** One road's glow, on its own transparent layer at `k` (the brighten draws it over the base). */
function strokeGlow(g: CanvasRenderingContext2D, chain: [number, number][], color: string, light: number, k: number, alphaMul = 1, widthMul = 1): void {
  g.strokeStyle = rgba(color, glowAlpha(light) * alphaMul)
  g.lineWidth = glowWidth(light) * k * widthMul
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.beginPath()
  // From a few px out of the hub: five glows stacked on it would burn it white.
  const from = Math.min(HUB_CLEAR, chain.length - 2)
  chain.forEach(([x, y], j) => {
    if (j < from || (j % 2 && j !== chain.length - 1)) return
    if (j === from) g.moveTo((x + 1) * k, (y + 1) * k)
    else g.lineTo((x + 1) * k, (y + 1) * k)
  })
  g.stroke()
}

function radial(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number): void {
  const grad = g.createRadialGradient(x, y, 0, x, y, r)
  grad.addColorStop(0, rgba(color, a))
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(x - r, y - r, r * 2, r * 2)
}

/** How much the roads not in focus keep of their light (the home's dock lights one road, October 2026). */
export const UNFOCUSED_LIGHT = 0.3
/** The night laid over the map round a focused road (or every road): the rest sinks, the roads stay lit. */
const FOCUS_DIM = 'rgba(6,8,14,0.5)'

/**
 * The pixels scaled by `k` with the static light over them. `skip` leaves one
 * road's glow out (it is being brightened, and draws its own).
 *
 * `focus` is the road the home's dock (or a signpost) has picked: the rest of
 * the map sinks under a night wash, the road's own pixels and towns are laid
 * back over it undimmed, and its glow burns at least as bright as Standing 5
 * would — a road you have never worked lights up in its colour too, so a tap
 * always shows where it runs. The others keep {@link UNFOCUSED_LIGHT} of theirs.
 * `'all'` (the dock's Buy Company slot: the Sovereign Route carries every
 * good) lights every road so, none dimmed, and only the land between sinks.
 */
export function bakeBase(
  pixels: HTMLCanvasElement,
  geo: MapGeometry,
  roads: readonly RoadView[],
  k: number,
  skip: CompanyId | null = null,
  focus: MapFocus = null,
): HTMLCanvasElement {
  const c = canvas(geo.W * k, geo.H * k)
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  // The focused company's season, over the same bake (none for no focus or every road).
  pixels = seasonPixels(pixels, seasonFor(focus))
  g.drawImage(pixels, 0, 0, geo.W * k, geo.H * k)
  const lit = geo.routes.filter((r) => litBy(focus, r.company))
  if (lit.length) {
    g.fillStyle = FOCUS_DIM
    g.fillRect(0, 0, c.width, c.height)
    // The focused roads, their towns and their pennants, back at full strength.
    const copy = (x: number, y: number, w: number, h: number) => g.drawImage(pixels, x, y, w, h, x * k, y * k, w * k, h * k)
    for (const r of lit) for (const [x, y] of r.chain) copy(x - 1, y - 1, 3, 3)
    for (const r of lit) for (const [x, y] of r.towns) copy(x - 5, y - 13, 10, 15)
  }
  g.globalCompositeOperation = 'lighter'
  for (const r of geo.routes) {
    const v = roads.find((q) => q.company === r.company)!
    const on = litBy(focus, r.company)
    const light = on ? Math.max(v.light, v.state === 'uncharted' ? 2 : 5) : v.light
    if (!light) continue
    const mul = !focus || on ? 1 : UNFOCUSED_LIGHT
    if (r.company !== skip) strokeGlow(g, r.chain, colorOf(r.company), light, k, on ? 1.5 : mul, on ? 1.15 : 1)
    if (v.light) r.towns.forEach(([x, y], i) => radial(g, x * k, (y - 3) * k, (10 + i * 4) * k, '#f5c451', (0.18 + v.light * 0.02) * (on ? 1.3 : mul)))
  }
  radial(g, geo.hub[0] * k, geo.hub[1] * k, 34 * k, '#f5c451', 0.22)
  g.globalCompositeOperation = 'source-over'
  return c
}

/** A brightening road's two layers — its glow at full strength, and a flash — cropped to the road. */
export interface BrightenLayers {
  glow: HTMLCanvasElement
  flash: HTMLCanvasElement
  /** Where the layers sit on the frame, device px. */
  x: number
  y: number
}
export function brightenLayers(geo: MapGeometry, road: RoadView, k: number): BrightenLayers {
  const r = geo.routes.find((q) => q.company === road.company)!
  const color = colorOf(road.company)
  const pad = Math.ceil(glowWidth(Math.max(road.light, 6)) / 2) + 2
  const xs = r.chain.map((p) => p[0])
  const ys = r.chain.map((p) => p[1])
  const x0 = Math.min(...xs) - pad
  const y0 = Math.min(...ys) - pad
  const w = (Math.max(...xs) - x0 + pad + 2) * k
  const h = (Math.max(...ys) - y0 + pad + 2) * k
  const shifted = r.chain.map(([x, y]) => [x - x0, y - y0] as [number, number])
  const glow = canvas(w, h)
  strokeGlow(glow.getContext('2d')!, shifted, color, road.light, k)
  const flash = canvas(w, h)
  const f = flash.getContext('2d')!
  strokeGlow(f, shifted, color, Math.max(road.light, 6), k, 2.2, 0.7)
  strokeGlow(f, shifted, '#fff3c4', 2, k, 2, 0.35)
  return { glow, flash, x: x0 * k, y: y0 * k }
}

/** The pulse light, one sprite per company colour, `9` map px in radius. */
export function glowSprite(color: string, k: number): HTMLCanvasElement {
  const r = 9 * k
  const c = canvas(r * 2, r * 2)
  radial(c.getContext('2d')!, r, r, r, color, 0.6)
  return c
}

/** Draw one frame: the base (crossfading out of the last focus's), any brighten layers, then the traffic at time `t`. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  base: HTMLCanvasElement,
  geo: MapGeometry,
  traffic: readonly Pulse[],
  sprites: ReadonlyMap<CompanyId, HTMLCanvasElement>,
  k: number,
  t: number,
  brighten?: (BrightenLayers & { glowA: number; flashA: number }) | null,
  o: {
    /** The base a focus change is fading out of, and how much of it is left (0–1). */
    fading?: { base: HTMLCanvasElement; a: number } | null
    /** The focused road (or every road): the others' traffic runs dim. */
    focus?: MapFocus
  } = {},
): void {
  const { fading, focus = null } = o
  const dim = (c: CompanyId) => !!focus && !litBy(focus, c)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.drawImage(base, 0, 0)
  if (fading && fading.a > 0.01) {
    ctx.globalAlpha = fading.a
    ctx.drawImage(fading.base, 0, 0)
    ctx.globalAlpha = 1
  }
  ctx.globalCompositeOperation = 'lighter'
  if (brighten) {
    ctx.globalAlpha = brighten.glowA
    ctx.drawImage(brighten.glow, brighten.x, brighten.y)
    if (brighten.flashA > 0.01) {
      ctx.globalAlpha = brighten.flashA
      ctx.drawImage(brighten.flash, brighten.x, brighten.y)
    }
  }
  const routes = new Map(geo.routes.map((r) => [r.company, r]))
  // The lights' glow, under the pixels.
  for (const p of traffic) {
    const ch = routes.get(p.company)!.chain
    const [x, y] = ch[pulseIndex(p, ch.length, t)]
    const s = sprites.get(p.company)!
    ctx.globalAlpha = (p.faint ? 0.58 : 1) * (dim(p.company) ? UNFOCUSED_LIGHT : 1)
    ctx.drawImage(s, (x + 1) * k - s.width / 2, (y + 1) * k - s.height / 2)
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  for (const p of traffic) {
    const ch = routes.get(p.company)!.chain
    const j = pulseIndex(p, ch.length, t)
    const color = colorOf(p.company)
    ctx.globalAlpha = dim(p.company) ? 0.45 : 1
    // The tail: five pixels behind, fading in steps.
    for (let n = 1; n <= 5; n++) {
      const q = ch[j - n * p.dir]
      if (!q) break
      ctx.fillStyle = rgba(color, (p.faint ? 0.5 : 0.9) * (1 - n / 6))
      ctx.fillRect(q[0] * k, q[1] * k, 2 * k, 2 * k)
    }
    const [x, y] = ch[j]
    const px = (X: number, Y: number, w: number, h: number) => ctx.fillRect(X * k, Y * k, w * k, h * k)
    if (p.wagon) {
      ctx.fillStyle = OUTLINE
      px(x - 3, y - 2, 7, 4)
      ctx.fillStyle = '#a8703a'
      px(x - 2, y - 1, 5, 2)
      ctx.fillStyle = color
      px(x - 2, y - 2, 5, 1)
      ctx.fillStyle = OUTLINE
      px(x - 2, y + 2, 1, 1)
      px(x + 2, y + 2, 1, 1)
      continue
    }
    const z = p.faint ? 2 : 3
    ctx.fillStyle = OUTLINE
    px(x - 1, y - 1, z + 2, z + 2)
    ctx.fillStyle = p.faint ? color : NIGHT.pulseCore
    px(x, y, z, z)
    if (!p.faint) {
      ctx.fillStyle = color
      px(x, y + z - 1, z, 1)
    }
  }
  ctx.globalAlpha = 1
}
