/**
 * hq-keep.ts — bake the HQ page's castle from the CC0 Tiny Swords pack: one
 * sheet per quality tier (`run/hq.CASTLE_TIERS`), each holding the scene and
 * every part of the castle at every level.
 *
 *   npx tsx scripts/hq-keep.ts                    # write the sheets and their layout
 *   npx tsx scripts/hq-keep.ts --check            # re-bake into memory and compare; write nothing
 *   npx tsx scripts/hq-keep.ts --compose <dir>    # also each tier's whole castle and each part's
 *                                                 # levels as flat PNGs, into <dir> (review cards)
 *
 * The designer (the HQ pass, Oct 2026): "the upgrades should correlate to
 * parts of the castle but when certain milestone across all the options are
 * met then the entire castle upgrades in quality". So:
 *
 *  - **The castle** is the pack's own (`Castle_Blue`) at its own density
 *    (drawn at 1×, never scaled), re-dressed per tier by `dress`: its slate
 *    re-inked, pixel for pixel by light, in logs (Timber), grey stone
 *    (Stone), the pack's slate as it ships (Fortified) or white stone with
 *    gold caps and red banners (Grand) — every brick and crack is the pack's.
 *  - **Each upgrade is a part** (`run/hq.CASTLE_PARTS`) in a fixed spot, one
 *    sprite per level from its empty plot (0): the barracks yard before the
 *    west tower (fence, tents, the pack's pawns and archer), the great hall
 *    at the back of the courtyard, the storehouse before the east tower
 *    (pallets, crates, barrels), three company pennants
 *    on the front wall, and the lookout on the east tower. Each part is drawn
 *    in the tier's material, so a tier redraws the whole castle and every
 *    part keeps its level.
 *
 * Each sheet is `public/assets/scenes/hq-castle-<tier>.png`: the scene at the
 * top, the parts packed under it; `src/ui/shell/hq/castleScene.generated.ts`
 * says where every part's every level is in the sheet and where it stands in
 * the scene, so the page lays the parts as layers it can light one at a time.
 *
 * ## Where the art comes from
 *
 * Every sprite is read from the OLD, public-domain build of Tiny Swords, from
 * the cache `harvest-cc0.ts` and `stop-scenes.ts` fill (the verified upstream,
 * `FulAppiOS/Agent-Quest`, CC0 1.0). Nothing from the current, non-CC0
 * download, nothing from `BuildingsCustom/`. The hall, lookout, tents, crates,
 * barrels, pallets, stakes and poles are drawn here in the pack's palette and
 * inked with its outline. Provenance: `public/assets/sprites/CREDITS.md`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import sharp from 'sharp'
import { COMPANY_IDS, companyById } from '../src/game/data/companies'
import { CASTLE_PARTS, CASTLE_TIERS, HQ_IDS, hqMax, type CastlePartId, type CastleTierId } from '../src/game/run/hq'

const ROOT = resolve(import.meta.dirname, '..')
const CACHE = join(ROOT, 'node_modules', '.cache', 'cc0-pack')
const OUT = join(ROOT, 'public', 'assets', 'scenes')
const GEN = join(ROOT, 'src', 'ui', 'shell', 'hq', 'castleScene.generated.ts')
const UPSTREAM = 'https://raw.githubusercontent.com/FulAppiOS/Agent-Quest/main/client/public/assets/themes/tiny-swords-cc0/'
const CHECK = process.argv.includes('--check')

/** The scene, native pixels: a 390 phone sees its middle 358, a 320 phone (full bleed) its middle 320. */
const W = 400
const H = 300

type RGB = readonly [number, number, number]
type RGBA = readonly [number, number, number, number?]

async function source(rel: string): Promise<string> {
  const dst = join(CACHE, rel)
  if (existsSync(dst)) return dst
  const url = UPSTREAM + rel.split('/').map(encodeURIComponent).join('/')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`)
  mkdirSync(dirname(dst), { recursive: true })
  writeFileSync(dst, Buffer.from(await res.arrayBuffer()))
  return dst
}

// ------------------------------------------------------------- the canvas

class Cv {
  d: Uint8ClampedArray
  constructor(
    public w: number,
    public h: number,
  ) {
    this.d = new Uint8ClampedArray(w * h * 4)
  }
  px(x: number, y: number, c: RGBA): void {
    x |= 0
    y |= 0
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 4
    const a = (c[3] ?? 255) / 255
    if (a >= 1) {
      this.d[i] = c[0]
      this.d[i + 1] = c[1]
      this.d[i + 2] = c[2]
      this.d[i + 3] = 255
      return
    }
    const ba = this.d[i + 3] / 255
    const oa = a + ba * (1 - a)
    if (oa <= 0) return
    for (let k = 0; k < 3; k++) this.d[i + k] = ((c[k] ?? 0) * a + this.d[i + k] * ba * (1 - a)) / oa
    this.d[i + 3] = oa * 255
  }
  rect(x: number, y: number, w: number, h: number, c: RGBA): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c)
  }
  draw(s: Cv, x: number, y: number): this {
    x = Math.round(x)
    y = Math.round(y)
    for (let j = 0; j < s.h; j++)
      for (let i = 0; i < s.w; i++) {
        const k = (j * s.w + i) * 4
        const a = s.d[k + 3]
        if (a) this.px(x + i, y + j, [s.d[k], s.d[k + 1], s.d[k + 2], a])
      }
    return this
  }
  /** Place by feet: centre-x, bottom-y. */
  put(s: Cv, cx: number, by: number): this {
    return this.draw(s, cx - Math.floor(s.w / 2), by - s.h)
  }
  tile(t: Cv): void {
    for (let y = 0; y < this.h; y += t.h) for (let x = 0; x < this.w; x += t.w) this.draw(t, x, y)
  }
}

const cache = new Map<string, Cv>()
async function load(rel: string): Promise<Cv> {
  const hit = cache.get(rel)
  if (hit) return hit
  const { data, info } = await sharp(await source(rel)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const c = new Cv(info.width, info.height)
  c.d.set(data)
  cache.set(rel, c)
  return c
}
function crop(s: Cv, x: number, y: number, w: number, h: number): Cv {
  const c = new Cv(w, h)
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const sx = x + i
      const sy = y + j
      if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) continue
      const a = (sy * s.w + sx) * 4
      const b = (j * w + i) * 4
      for (let k = 0; k < 4; k++) c.d[b + k] = s.d[a + k]
    }
  return c
}
function bbox(s: Cv) {
  let x0 = s.w
  let y0 = s.h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++)
      if (s.d[(y * s.w + x) * 4 + 3] > 8) {
        x0 = Math.min(x0, x)
        x1 = Math.max(x1, x)
        y0 = Math.min(y0, y)
        y1 = Math.max(y1, y)
      }
  return { x0, y0, x1, y1 }
}
function trim(s: Cv): Cv {
  const b = bbox(s)
  return b.x1 < 0 ? new Cv(1, 1) : crop(s, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1)
}

/** The pack's ink. */
const INK: RGB = [22, 28, 46]
function outline(s: Cv): Cv {
  const o = new Cv(s.w + 2, s.h + 2)
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < s.w && y < s.h && s.d[(y * s.w + x) * 4 + 3] > 100
  for (let y = -1; y <= s.h; y++)
    for (let x = -1; x <= s.w; x++) {
      if (op(x, y)) continue
      if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) o.px(x + 1, y + 1, INK)
    }
  o.draw(s, 1, 1)
  return o
}

// ------------------------------------------------------------- the meadow

function hash2(x: number, y: number, s: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1013904223)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
function vnoise(x: number, y: number, cell: number, s: number): number {
  const gx = Math.floor(x / cell)
  const gy = Math.floor(y / cell)
  const sm = (t: number) => t * t * (3 - 2 * t)
  const u = sm(x / cell - gx)
  const v = sm(y / cell - gy)
  const a = hash2(gx, gy, s)
  const b = hash2(gx + 1, gy, s)
  const c = hash2(gx, gy + 1, s)
  const d = hash2(gx + 1, gy + 1, s)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const key = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b
function swap(s: Cv, map: Map<number, RGB>, where: (x: number, y: number) => boolean): void {
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const i = (y * s.w + x) * 4
      const to = map.get(key(s.d[i], s.d[i + 1], s.d[i + 2]))
      if (to && where(x, y)) {
        s.d[i] = to[0]
        s.d[i + 1] = to[1]
        s.d[i + 2] = to[2]
      }
    }
}
/** The grass tile's own greens a step darker and lighter, in blobs: the tile's repeat broken (as `stop-scenes.ts`). */
const GRASS_DARKER = new Map<number, RGB>([
  [key(155, 185, 78), [121, 168, 99]],
  [key(191, 186, 91), [155, 185, 78]],
  [key(121, 168, 99), [103, 145, 117]],
])
const GRASS_LIGHTER = new Map<number, RGB>([[key(121, 168, 99), [155, 185, 78]]])
function patches(c: Cv, seed: number): void {
  const n = (x: number, y: number) => vnoise(x, y, 26, seed) * 0.7 + vnoise(x, y, 9, seed + 7) * 0.3
  swap(c, GRASS_DARKER, (x, y) => n(x, y) > 0.64)
  swap(c, GRASS_LIGHTER, (x, y) => n(x, y) < 0.26)
}
/** A soft dusk at the top and the sides: the eye goes to the building. */
function vignette(s: Cv, k: number): void {
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const dx = (x - s.w / 2) / (s.w / 2)
      const dy = (y - s.h * 0.62) / (s.h * 0.62)
      const f = Math.min(1, Math.max(0, Math.sqrt(dx * dx * 0.8 + dy * dy) - 0.55) / 0.8) * k
      const i = (y * s.w + x) * 4
      for (let c = 0; c < 3; c++) s.d[i + c] *= 1 - f
    }
}

// ------------------------------------------------------------- the pack's palette

const WD = { hi: [233, 186, 118], lt: [214, 156, 96], md: [176, 112, 62], dk: [128, 78, 44], sh: [92, 56, 34] } as const
const GOLD: RGB = [224, 172, 76]
const IRON: RGB = [64, 70, 86]
const DARK: RGB = [40, 30, 34]
const lum = (c: readonly number[]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * t)) as unknown as RGB
const hexRgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const rampOf = (c: RGB): [RGB, RGB, RGB] => [mix(c, [255, 255, 255], 0.3), c, mix(c, [0, 0, 0], 0.32)]

// ------------------------------------------------------------- the four materials

type Ramp5 = readonly [RGB, RGB, RGB, RGB, RGB]
type Ramp4 = readonly [RGB, RGB, RGB, RGB]
interface Material {
  /** The walls' stone (or logs), light to dark; null keeps the pack's own (Fortified). */
  stone: Ramp5 | null
  /** The merlon caps' light; null: the stone's lightest step. */
  cap: RGB | null
  /** The hanging banners' cloth. */
  cloth: Ramp4 | null
  /** The gate's doors. */
  door: readonly [RGB, RGB, RGB] | null
  /** The parts' walls (the pack's own stone where `stone` is null). */
  wall: Ramp5
  /** The hall's and the lookout's roofs. */
  roof: Ramp4
  /** The yard's tents: canvas, and its shade or stripe. */
  canvas: readonly [RGB, RGB]
  /** The storehouse's bands. */
  band: RGB
  /** Logs, not courses: the timber castle's walls are staked. */
  logs: boolean
  /** Gold trim on the hall (Grand). */
  trim: boolean
}
/** The pack's own slate (Castle_Blue's stone), for Fortified's parts. */
const SLATE: Ramp5 = [
  [132, 214, 196],
  [92, 176, 172],
  [70, 138, 150],
  [56, 100, 122],
  [44, 66, 94],
]
const MAT: Record<CastleTierId, Material> = {
  timber: {
    stone: [
      [206, 150, 92],
      [178, 120, 70],
      [146, 92, 54],
      [112, 68, 40],
      [80, 48, 30],
    ],
    cap: [228, 178, 116],
    cloth: [
      [204, 172, 120],
      [176, 140, 92],
      [142, 108, 70],
      [104, 76, 50],
    ],
    door: [
      [150, 96, 56],
      [116, 70, 42],
      [84, 50, 32],
    ],
    wall: [
      [206, 150, 92],
      [178, 120, 70],
      [146, 92, 54],
      [112, 68, 40],
      [80, 48, 30],
    ],
    roof: [
      [240, 216, 150],
      [214, 184, 118],
      [176, 144, 88],
      [128, 100, 64],
    ],
    canvas: [
      [204, 176, 132],
      [160, 128, 92],
    ],
    band: WD.dk,
    logs: true,
    trim: false,
  },
  stone: {
    stone: [
      [210, 212, 214],
      [176, 180, 186],
      [142, 148, 156],
      [108, 114, 126],
      [74, 80, 94],
    ],
    cap: [226, 228, 230],
    cloth: [
      [172, 186, 172],
      [138, 154, 142],
      [106, 120, 112],
      [76, 88, 84],
    ],
    door: [
      [140, 100, 70],
      [108, 74, 52],
      [78, 54, 40],
    ],
    wall: [
      [210, 212, 214],
      [176, 180, 186],
      [142, 148, 156],
      [108, 114, 126],
      [74, 80, 94],
    ],
    roof: [
      [146, 152, 168],
      [116, 122, 140],
      [90, 96, 116],
      [64, 68, 88],
    ],
    canvas: [
      [236, 226, 196],
      [198, 184, 152],
    ],
    band: WD.dk,
    logs: false,
    trim: false,
  },
  fortified: {
    stone: null,
    cap: null,
    cloth: null,
    door: null,
    wall: SLATE,
    roof: [
      [104, 128, 170],
      [78, 100, 140],
      [58, 76, 112],
      [42, 54, 82],
    ],
    canvas: [
      [226, 232, 236],
      [74, 118, 176],
    ],
    band: IRON,
    logs: false,
    trim: false,
  },
  grand: {
    stone: [
      [250, 246, 234],
      [230, 222, 202],
      [202, 192, 172],
      [164, 154, 140],
      [118, 110, 106],
    ],
    cap: [236, 192, 86],
    cloth: [
      [246, 150, 120],
      [228, 102, 84],
      [196, 74, 58],
      [140, 48, 50],
    ],
    door: [
      [176, 72, 58],
      [138, 50, 46],
      [98, 34, 36],
    ],
    wall: [
      [250, 246, 234],
      [230, 222, 202],
      [202, 192, 172],
      [164, 154, 140],
      [118, 110, 106],
    ],
    roof: [
      [222, 104, 78],
      [188, 76, 60],
      [148, 54, 48],
      [104, 38, 40],
    ],
    canvas: [
      [246, 236, 212],
      [196, 74, 58],
    ],
    band: GOLD,
    logs: false,
    trim: true,
  },
}

// ------------------------------------------------------------- the castle, re-dressed

const P = {
  flat: 'Terrain/Ground/Tilemap_Flat.png',
  tree: 'Resources/Trees/Tree.png',
  castle: 'Factions/Knights/Buildings/Castle/Castle_Blue.png',
  pawn: 'Factions/Knights/Troops/Pawn/Blue/Pawn_Blue.png',
  archer: 'Factions/Knights/Troops/Archer/Blue/Archer_Blue.png',
  deco: (n: number) => `Deco/${String(n).padStart(2, '0')}.png`,
}

/** The castle's two hanging banners and its gate, in `Castle_Blue`'s own pixels (320 × 256). */
const BANNERS = [
  { x: 70, y: 164, w: 30, h: 50 },
  { x: 222, y: 164, w: 30, h: 50 },
]
const GATE = { x: 138, y: 186, w: 46, h: 64 }
/** A pixel this green or lighter inside a banner box is cloth, not stone. */
const CLOTH_G = 150
const inBox = (b: { x: number; y: number; w: number; h: number }, x: number, y: number) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h

/**
 * The castle in a tier's material: every pixel of the pack's slate (its
 * stone, merlon caps, banners and doors — the teal the Blue set is built
 * from) takes the material's step for its light, ranked over the sprite's
 * own colours, so every brick, crack and highlight is the pack's. The ink and
 * the wood (decks, palisade, gate frame) are kept. Fortified is the pack's
 * castle as it ships.
 */
function dress(src: Cv, m: Material): Cv {
  const out = crop(src, 0, 0, src.w, src.h)
  if (!m.stone) return out
  const teal = (r: number, g: number, b: number) => b > r + 8 && g > r && lum([r, g, b]) > 55
  // Rank the stone's colours by light: five bins.
  const stoneCols = new Map<number, number>()
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4
      const [r, g, b, a] = [src.d[i], src.d[i + 1], src.d[i + 2], src.d[i + 3]]
      if (a && teal(r, g, b) && !BANNERS.some((bx) => inBox(bx, x, y) && g >= CLOTH_G) && !inBox(GATE, x, y)) stoneCols.set(key(r, g, b), lum([r, g, b]))
    }
  const ls = [...stoneCols.values()].sort((a, b) => b - a)
  const step = (l: number, n: number, list: number[]) => Math.min(n - 1, Math.floor((list.findIndex((v) => v <= l) / Math.max(1, list.length)) * n))
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4
      const [r, g, b, a] = [src.d[i], src.d[i + 1], src.d[i + 2], src.d[i + 3]]
      if (!a || !teal(r, g, b)) continue
      const l = lum([r, g, b])
      let to: RGB
      if (BANNERS.some((bx) => inBox(bx, x, y)) && g >= CLOTH_G) to = m.cloth![l > 215 ? 0 : l > 188 ? 1 : l > 160 ? 2 : 3]
      else if (inBox(GATE, x, y)) to = m.door![l > 150 ? 0 : l > 110 ? 1 : 2]
      else {
        const k = step(l, 5, ls)
        to = k === 0 && m.cap ? m.cap : m.stone[k]
      }
      out.d[i] = to[0]
      out.d[i + 1] = to[1]
      out.d[i + 2] = to[2]
    }
  return out
}

// ------------------------------------------------------------- drawn parts

/** A block of wall in a material: courses of stone (or upright logs), lit from the upper left. */
function wall(c: Cv, x: number, y: number, w: number, h: number, m: Material): void {
  const r = m.wall
  c.rect(x, y, w, h, r[1])
  if (m.logs) {
    for (let i = 0; i < w; i += 4) {
      c.rect(x + i, y, 1, h, r[0])
      c.rect(x + i + 3, y, 1, h, r[3])
    }
  } else
    for (let j = 3; j < h; j += 4) {
      c.rect(x, y + j, w, 1, r[2])
      for (let i = ((j / 4) | 0) % 2 ? 2 : 6; i < w; i += 8) c.px(x + i, y + j - 1, r[2])
    }
  c.rect(x, y, w, 1, r[0])
  c.rect(x, y, 1, h, r[0])
  c.rect(x + w - 1, y, 1, h, r[3])
}
/** A hip roof seen from the front: shingle rows, a lit left slope, a ridge. */
function roof(c: Cv, x: number, y: number, w: number, h: number, m: Material): void {
  const r = m.roof
  for (let j = 0; j < h; j++) {
    const inset = Math.round(((h - 1 - j) / Math.max(1, h - 1)) * w * 0.24)
    for (let i = inset; i < w - inset; i++) {
      const left = i < w / 2
      let col = left ? r[1] : r[2]
      if (j % 4 === 3) col = r[3]
      if (m.logs && (i + j * 3) % 7 === 0) col = r[0]
      c.px(x + i, y + j, col)
    }
    c.px(x + inset, y + j, r[0])
  }
  c.rect(x + Math.round(w * 0.24), y, w - 2 * Math.round(w * 0.24), 1, m.trim ? GOLD : r[0])
}
/** Merlons along a top edge. */
function merlons(c: Cv, x: number, y: number, w: number, m: Material): void {
  for (let i = 0; i < w; i += 6) {
    c.rect(x + i, y, Math.min(4, w - i), 4, m.wall[1])
    c.rect(x + i, y, Math.min(4, w - i), 1, m.wall[0])
  }
  c.rect(x, y + 4, w, 3, m.wall[2])
}
function crate(m: Material, w = 18, h = 15): Cv {
  const c = new Cv(w, h)
  c.rect(0, 0, w, h, WD.md)
  c.rect(0, 0, w, 2, WD.hi)
  c.rect(0, h - 2, w, 2, WD.dk)
  for (let i = 0; i < Math.min(w, h) - 2; i++) c.px(2 + Math.round((i * (w - 4)) / (h - 4)), h - 2 - i, WD.dk)
  c.rect(0, 0, 2, h, m.band)
  c.rect(w - 2, 0, 2, h, m.band)
  return outline(c)
}
function barrel(m: Material): Cv {
  const c = new Cv(14, 18)
  for (let y = 0; y < 18; y++) {
    const inset = y < 2 || y > 15 ? 2 : y < 4 || y > 13 ? 1 : 0
    for (let x = inset; x < 14 - inset; x++) c.px(x, y, x < 4 ? WD.lt : x > 9 ? WD.dk : WD.md)
  }
  c.rect(2, 0, 10, 2, WD.hi)
  for (const y of [4, 12]) c.rect(0, y, 14, 2, m.band)
  return outline(c)
}
function pallet(): Cv {
  const c = new Cv(30, 5)
  c.rect(0, 0, 30, 2, WD.lt)
  c.rect(0, 2, 30, 3, WD.dk)
  for (const x of [2, 13, 25]) c.rect(x, 2, 3, 3, WD.md)
  return outline(c)
}
function stake(h: number): Cv {
  const c = new Cv(2, h)
  c.rect(0, 0, 2, h, WD.md)
  c.rect(0, 0, 1, h, WD.lt)
  return outline(c)
}
/** A pile of building timber: the plot of a part not built yet. */
function timber(w: number): Cv {
  const c = new Cv(w, 8)
  for (const [y, inset] of [
    [0, 4],
    [3, 2],
    [5, 0],
  ] as const) {
    c.rect(inset, y, w - inset * 2, 3, WD.md)
    c.rect(inset, y, w - inset * 2, 1, WD.hi)
    c.px(inset, y + 1, WD.sh)
    c.px(w - inset - 1, y + 1, WD.sh)
  }
  return outline(c)
}
/** A rack of arms: two posts, a bar, a sword, a spear and a sword stood in it; its iron in the tier's band. */
function rack(m: Material): Cv {
  const c = new Cv(26, 30)
  c.rect(0, 8, 2, 22, WD.md)
  c.rect(24, 8, 2, 22, WD.md)
  c.rect(0, 12, 26, 2, WD.lt)
  c.rect(0, 24, 26, 2, WD.dk)
  const steel: RGB = [196, 214, 206]
  const steelDk: RGB = [110, 136, 142]
  for (const [x, top] of [
    [6, 2],
    [18, 3],
  ] as const) {
    c.rect(x, top, 1, 16, steel)
    c.rect(x + 1, top, 1, 16, steelDk)
    c.rect(x - 2, top + 16, 6, 2, m.band)
    c.rect(x, top + 18, 2, 6, WD.dk)
  }
  c.rect(12, 0, 2, 3, steel)
  c.rect(12, 3, 2, 26, WD.lt)
  return outline(c)
}
/** A canvas tent, its lit side left, its door open. */
function tent(w: number, h: number, m: Material): Cv {
  const c = new Cv(w, h)
  const [a, b] = m.canvas
  for (let y = 0; y < h; y++) {
    const half = Math.round(((y + 1) / h) * (w / 2))
    for (let x = w / 2 - half; x < w / 2 + half; x++) {
      const stripe = Math.floor((x - (w / 2 - half)) / 4) % 2 === 1
      c.px(x, y, x < w / 2 ? (stripe ? mix(a, b, 0.5) : a) : stripe ? b : mix(b, [0, 0, 0], 0.15))
    }
  }
  const dh = Math.round(h * 0.55)
  for (let y = h - dh; y < h; y++) {
    const half = Math.round(((y - (h - dh) + 1) / dh) * (w / 7))
    for (let x = w / 2 - half; x < w / 2 + half; x++) c.px(x, y, DARK)
  }
  c.px(w / 2 - 1, 0, GOLD)
  return outline(c)
}
/** A flagpole of `h` px, a gold knob on top; with a pennant (`ramp`) flying right, or bare. */
function pole(h: number, ramp: readonly [RGB, RGB, RGB] | null, fw = 18): Cv {
  const fh = fw >= 22 ? 13 : 11
  const c = new Cv(3 + fw * 2, h + 3)
  const px = fw
  c.rect(px, 3, 2, h, WD.md)
  c.rect(px, 3, 1, h, WD.lt)
  c.rect(px - 1, 0, 4, 3, GOLD)
  if (ramp)
    for (let y = 0; y < fh; y++) {
      const t = Math.abs(y - (fh - 1) / 2) / ((fh - 1) / 2)
      const len = Math.round(fw - t * 3)
      const notch = Math.max(0, Math.round((1 - t * 1.6) * 6))
      for (let i = 0; i < len - notch; i++) {
        const wave = Math.round(Math.sin(i / 4) * 0.8)
        const col = y + wave <= 1 ? ramp[0] : y + wave >= fh - 3 ? ramp[2] : ramp[1]
        c.px(px + 2 + i, 4 + y + wave, col)
      }
    }
  return outline(trim(c))
}

/** The company pennants on the front wall: the first three companies' colours, one a level. */
const PENNANTS = COMPANY_IDS.slice(0, 3).map((id) => rampOf(hexRgb(companyById(id).color)))

type Sprite = { cv: Cv; x: number; y: number }
interface PartArt {
  /** Draw the part at a level, in a material: its sprite and where it stands in the scene. */
  draw: (level: number, m: Material) => Promise<Sprite>
}

const cell = async (rel: string, col: number, row: number, size = 192) => trim(crop(await load(rel), col * size, row * size, size, size))
const flipX = (s: Cv): Cv => {
  const c = new Cv(s.w, s.h)
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const a = (y * s.w + x) * 4
      const b = (y * s.w + (s.w - 1 - x)) * 4
      for (let k = 0; k < 4; k++) c.d[b + k] = s.d[a + k]
    }
  return c
}

/**
 * The castle's layout, in scene pixels. The castle (296 × 205) stands centred
 * with its feet at y 241; scene = sprite + (`CX`, `CY`).
 */
const CX = 40
const CY = -3
/** Where each part stands. */
const AT = {
  /** The great hall: the back of the courtyard deck, centred. */
  hall: { cx: 200, by: 82 },
  /** The lookout: the east tower's open deck. */
  lookout: { cx: 300, by: 96 },
  /** The pennants: three poles on the front wall's walk. */
  banners: { xs: [150, 200, 250], by: 140 },
  /** The barracks yard: the ground before the west tower. */
  yard: { x: 34, w: 140, by: 296 },
  /** The storehouse: the ground before the east tower. */
  store: { x: 258, w: 100, by: 294 },
}

const PARTS: Record<CastlePartId, PartArt> = {
  hall: {
    async draw(level, m) {
      if (level <= 0) {
        // The plot: a stone sill marked out on the deck, four stakes, timber stacked.
        const c = new Cv(108, 14)
        c.rect(2, 9, 104, 4, m.wall[2])
        c.rect(2, 9, 104, 1, m.wall[0])
        for (const x of [2, 36, 70, 104]) c.draw(stake(10), x - 1, 0)
        c.draw(timber(30), 8, 2)
        c.draw(timber(30), 40, 2)
        const o = outline(c)
        return { cv: o, x: AT.hall.cx - Math.floor(o.w / 2), y: AT.hall.by - o.h }
      }
      const w = 104
      const c = new Cv(w + 10, 52)
      roof(c, 0, 0, w + 10, 28, m)
      wall(c, 5, 28, w, 24, m)
      // The door, its frame, and two windows.
      c.rect(w / 2 - 3, 34, 16, 18, m.trim ? GOLD : WD.lt)
      c.rect(w / 2 - 1, 36, 12, 16, WD.dk)
      c.rect(w / 2 + 4, 36, 1, 16, WD.sh)
      for (const x of [22, w - 22]) {
        c.rect(x, 36, 10, 8, DARK)
        c.rect(x - 1, 44, 12, 1, m.trim ? GOLD : m.wall[0])
      }
      if (m.trim) {
        // A red banner over the door.
        c.rect(w / 2 + 1, 29, 8, 5, [196, 74, 58])
      }
      const o = outline(c)
      return { cv: o, x: AT.hall.cx - Math.floor(o.w / 2), y: AT.hall.by - o.h }
    },
  },
  lookout: {
    async draw(level, m) {
      if (level <= 0) {
        const c = new Cv(30, 14)
        c.draw(stake(12), 2, 0)
        c.draw(stake(12), 26, 0)
        c.draw(timber(24), 3, 5)
        const o = outline(c)
        return { cv: o, x: AT.lookout.cx - Math.floor(o.w / 2), y: AT.lookout.by - o.h }
      }
      const shaft = level >= 2 ? 36 : 26
      const roofH = level >= 2 ? 18 : 0
      const flag = level >= 2 ? 22 : 0
      const c = new Cv(40, flag + roofH + 7 + shaft)
      let y = 0
      if (flag) {
        const p = pole(flag - 3, PENNANTS[1], 14)
        c.draw(p, 20 - 15, 0)
        y = flag
      }
      if (roofH) {
        roof(c, 2, y, 36, roofH, m)
        y += roofH
      }
      merlons(c, 4, y, 32, m)
      y += 7
      wall(c, 6, y, 28, shaft, m)
      // A window slit for the watch.
      c.rect(18, y + 6, 4, 9, DARK)
      const o = outline(trim(c))
      return { cv: o, x: AT.lookout.cx - Math.floor(o.w / 2), y: AT.lookout.by - o.h }
    },
  },
  banners: {
    async draw(level) {
      const c = new Cv(150, 40)
      AT.banners.xs.forEach((x, i) => {
        const p = pole(30, i < level ? PENNANTS[i] : null, 22)
        c.draw(p, x - AT.banners.xs[0] + 6 - 1, 40 - p.h)
      })
      const t = trim(c)
      const b = bbox(c)
      return { cv: t, x: AT.banners.xs[0] - 6 + b.x0, y: AT.banners.by - 40 + b.y0 }
    },
  },
  yard: {
    async draw(level, m) {
      // Back to front: the fence and tents at the castle's foot, then the rack,
      // then the recruits on the grass — each level adds one, spaced so none
      // hides another.
      const W = AT.yard.w
      const H = 104
      const c = new Cv(W, H)
      const back = 58
      for (let i = 0; i < 5; i++) c.draw(stake(12), 4 + i * 29, back - 12)
      c.rect(5, back - 8, 118, 1, WD.sh)
      if (level >= 1) c.put(tent(46, 36, m), 44, back + 4)
      if (level >= 3) c.put(tent(40, 32, m), 104, back + 2)
      if (level >= 2) c.put(rack(m), 74, back + 8)
      if (level >= 4) c.put(await cell(P.pawn, 0, 0), 16, H)
      if (level >= 5) c.put(flipX(await cell(P.archer, 0, 0)), 120, H)
      const b = bbox(c)
      return { cv: trim(c), x: AT.yard.x + b.x0, y: AT.yard.by - H + b.y0 }
    },
  },
  store: {
    async draw(level, m) {
      const W = AT.store.w
      const H = 60
      const c = new Cv(W, H)
      c.put(pallet(), 24, H)
      c.put(pallet(), 66, H)
      if (level >= 1) {
        c.put(crate(m), 16, H - 4)
        c.put(crate(m), 34, H - 4)
      }
      if (level >= 2) {
        c.put(barrel(m), 58, H - 4)
        c.put(barrel(m), 74, H - 4)
      }
      if (level >= 3) {
        c.put(crate(m), 25, H - 18)
        c.put(crate(m, 14, 12), 26, H - 32)
      }
      if (level >= 4) {
        c.put(barrel(m), 66, H - 21)
        c.put(crate(m), 92, H - 4)
        c.put(crate(m, 14, 12), 92, H - 18)
      }
      const b = bbox(c)
      return { cv: trim(c), x: AT.store.x + b.x0, y: AT.store.by - H + b.y0 }
    },
  },
}

/** Each part's levels: one sprite each, from its empty plot (0) to its last. */
const PART_LEVELS: Record<CastlePartId, number> = Object.fromEntries(HQ_IDS.map((id) => [CASTLE_PARTS[id].id, hqMax(id) + 1])) as Record<CastlePartId, number>

// ------------------------------------------------------------- the meadow and the earth

const EARTH = new Map<number, RGB>([
  [key(254, 250, 157), [230, 204, 152]],
  [key(248, 242, 115), [216, 186, 132]],
  [key(241, 218, 132), [200, 168, 118]],
  [key(222, 200, 126), [180, 148, 104]],
  [key(178, 150, 120), [142, 110, 80]],
])

async function base(tier: CastleTierId, castle: Cv): Promise<Cv> {
  const flat = await load(P.flat)
  const grass = crop(flat, 64, 64, 64, 64)
  const earth = crop(flat, 384, 64, 64, 64)
  swap(earth, EARTH, () => true)
  const c = new Cv(W, H)
  c.tile(grass)
  patches(c, 31)
  // The road out of the gate: trodden earth, a noisy edge.
  for (let y = 232; y < H; y++) {
    const t = (y - 232) / (H - 232)
    const half = 26 + t * 22
    for (let x = 0; x < W; x++) {
      const d = Math.abs(x - 200) + (vnoise(x, y, 7, 5) - 0.5) * 8
      if (d < half) {
        const k = ((y % 64) * 64 + (x % 64)) * 4
        c.px(x, y, d > half - 1.5 ? [142, 110, 80] : [earth.d[k], earth.d[k + 1], earth.d[k + 2]])
      }
    }
  }
  const tree = async (i: number) => trim(crop(await load(P.tree), i * 192, 0, 192, 192))
  for (const [i, [x, y]] of ([[-6, 96], [26, 60], [404, 92], [374, 58], [-26, 180], [424, 182]] as const).entries()) c.put(await tree(i % 4), x, y)
  c.draw(trim(dress(castle, MAT[tier])), CX + 12, CY + 45)
  c.put(trim(await load(P.deco(9))), 16, H - 4)
  c.put(trim(await load(P.deco(5))), 384, H - 6)
  vignette(c, 0.5)
  return c
}

// ------------------------------------------------------------- the sheets

/** One layer: where it is in the sheet (sx, sy, w, h) and where it stands in the scene (x, y). */
type Layer = readonly [number, number, number, number, number, number]

async function bakeTier(tier: CastleTierId): Promise<{ png: Buffer; layers: Record<CastlePartId, Layer[]>; h: number }> {
  const castle = await load(P.castle)
  const b = await base(tier, castle)
  const sprites: { part: CastlePartId; s: Sprite }[] = []
  for (const part of Object.keys(PARTS) as CastlePartId[])
    for (let lv = 0; lv < PART_LEVELS[part]; lv++) sprites.push({ part, s: await PARTS[part].draw(lv, MAT[tier]) })
  // Shelf-pack the parts under the scene.
  let x = 0
  let y = H + 2
  let row = 0
  const placed: { part: CastlePartId; s: Sprite; sx: number; sy: number }[] = []
  for (const it of sprites) {
    if (x + it.s.cv.w > W) {
      x = 0
      y += row + 2
      row = 0
    }
    placed.push({ ...it, sx: x, sy: y })
    x += it.s.cv.w + 2
    row = Math.max(row, it.s.cv.h)
  }
  const sheetH = y + row
  const sheet = new Cv(W, sheetH)
  sheet.draw(b, 0, 0)
  const layers = Object.fromEntries((Object.keys(PARTS) as CastlePartId[]).map((p) => [p, [] as Layer[]])) as Record<CastlePartId, Layer[]>
  for (const p of placed) {
    sheet.draw(p.s.cv, p.sx, p.sy)
    layers[p.part].push([p.sx, p.sy, p.s.cv.w, p.s.cv.h, p.s.x, p.s.y])
  }
  const png = await sharp(Buffer.from(sheet.d.buffer), { raw: { width: W, height: sheetH, channels: 4 } }).png({ compressionLevel: 9, effort: 10 }).toBuffer()
  return { png, layers, h: sheetH }
}

/** `--compose <dir>`: also write each tier's whole castle at given part levels (the review cards). */
async function compose(dir: string, sheet: Buffer, layers: Record<CastlePartId, Layer[]>, levels: Record<CastlePartId, number>, name: string) {
  const comp = [{ input: await sharp(sheet).extract({ left: 0, top: 0, width: W, height: H }).png().toBuffer(), left: 0, top: 0 }]
  for (const part of ['hall', 'lookout', 'banners', 'store', 'yard'] as CastlePartId[]) {
    const [sx, sy, w, h, x, y] = layers[part][levels[part]]
    comp.push({ input: await sharp(sheet).extract({ left: sx, top: sy, width: w, height: h }).png().toBuffer(), left: x, top: y })
  }
  await sharp({ create: { width: W, height: H, channels: 4, background: '#000' } }).composite(comp).png().toFile(join(dir, name))
}

function generated(sheets: Record<CastleTierId, { layers: Record<CastlePartId, Layer[]>; h: number }>): string {
  const tiers = CASTLE_TIERS.map((t) => t.id)
  const lines = [
    '// Generated by `npx tsx scripts/hq-keep.ts` — do not edit.',
    '// The HQ castle: one sheet per tier (`public/assets/scenes/hq-castle-<tier>.png`), the',
    '// scene (its base) at the top and every part at every level under it. A layer is',
    '// [sx, sy, w, h, x, y]: where it is in the sheet, and where it stands in the scene.',
    "import type { CastlePartId, CastleTierId } from '../../../game/run/hq'",
    '',
    `export const CASTLE_SCENE = { w: ${W}, h: ${H} } as const`,
    'export type CastleLayer = readonly [number, number, number, number, number, number]',
    `export const CASTLE_SHEETS: Record<CastleTierId, { h: number; layers: Record<CastlePartId, readonly CastleLayer[]> }> = {`,
  ]
  for (const t of tiers) {
    lines.push(`  ${t}: {`, `    h: ${sheets[t].h},`, '    layers: {')
    for (const [p, ls] of Object.entries(sheets[t].layers)) lines.push(`      ${p}: [${ls.map((l) => `[${l.join(', ')}]`).join(', ')}],`)
    lines.push('    },', '  },')
  }
  lines.push('}', '')
  return lines.join('\n')
}

async function main() {
  const ci = process.argv.indexOf('--compose')
  const composeDir = ci > 0 ? resolve(process.argv[ci + 1]) : null
  const sheets = {} as Record<CastleTierId, { png: Buffer; layers: Record<CastlePartId, Layer[]>; h: number }>
  for (const t of CASTLE_TIERS) sheets[t.id] = await bakeTier(t.id)
  const ts = generated(sheets)
  let stale = 0
  const put = (file: string, data: Buffer | string) => {
    if (CHECK) {
      const on = existsSync(file) ? readFileSync(file) : null
      if (!on || !on.equals(Buffer.from(data))) {
        console.error(`hq-keep: ${file} is stale — run \`npx tsx scripts/hq-keep.ts\``)
        stale++
      }
    } else {
      writeFileSync(file, data)
      console.log(`hq-keep: ${file}`)
    }
  }
  mkdirSync(OUT, { recursive: true })
  for (const t of CASTLE_TIERS) put(join(OUT, `hq-castle-${t.id}.png`), sheets[t.id].png)
  put(GEN, ts)
  if (composeDir) {
    mkdirSync(composeDir, { recursive: true })
    const mixed: Record<CastleTierId, Record<CastlePartId, number>> = {
      timber: { yard: 2, hall: 0, store: 1, banners: 0, lookout: 1 },
      stone: { yard: 3, hall: 1, store: 2, banners: 1, lookout: 1 },
      fortified: { yard: 4, hall: 1, store: 3, banners: 2, lookout: 2 },
      grand: { yard: 5, hall: 1, store: 4, banners: 3, lookout: 2 },
    }
    for (const t of CASTLE_TIERS) await compose(composeDir, sheets[t.id].png, sheets[t.id].layers, mixed[t.id], `tier-${t.id}.png`)
    for (const part of Object.keys(PARTS) as CastlePartId[])
      for (let lv = 0; lv < PART_LEVELS[part]; lv++) {
        const lvls = { yard: 0, hall: 0, store: 0, banners: 0, lookout: 0, [part]: lv } as Record<CastlePartId, number>
        await compose(composeDir, sheets.stone.png, sheets.stone.layers, lvls, `part-${part}-${lv}.png`)
      }
  }
  if (stale) process.exit(1)
  if (CHECK) console.log(`hq-keep: ${CASTLE_TIERS.length} castle sheets current`)
}

main()
