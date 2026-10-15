/**
 * stop-scenes.ts — bake the four stops' scenes (merchant, campfire, shrine,
 * recruit), and each company's post where its liaison stands (Draft 4 · D:
 * `liaison-<company>`), from the CC0 Tiny Swords pack.
 *
 *   npx tsx scripts/stop-scenes.ts
 *
 * Writes `public/assets/scenes/<scene>.png` (native pixels; the page draws them
 * at 2× with `image-rendering: pixelated`) and `src/ui/shell/stopScenes.generated.ts`
 * (where the keeper's head, the clerk's hands and the fire are, so the page
 * can hang the speech bubble, the held ware and the animated flame on them).
 * A liaison's post flies its company's standard: the very rows the wagon
 * flies (`src/game/data/companyStandard.ts`), drawn at a pixel a cell.
 *
 * ## Where the art comes from
 *
 * Every sprite is read from the OLD, public-domain build of Tiny Swords, from
 * the same verified upstream `harvest-cc0.ts` uses (`FulAppiOS/Agent-Quest`,
 * which ships the old build under a real CC0 1.0 LICENSE.txt), cached in the
 * same folder. Nothing from the current, non-CC0 download. The stall, tent,
 * standing stones, altar, bedroll, crates, flag, pot and candles are drawn
 * here, in the pack's palette and inked with its outline colour; the night,
 * dusk and fire light is a multiply plus banded, dithered light.
 *
 * The scenes are not under the four `tinyswords` folders the palette check
 * scans: they carry drawn props and lighting, so their colours are not the
 * pack's by construction. Provenance: `public/assets/sprites/CREDITS.md`.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import sharp from 'sharp'
import { companyById, type CompanyId } from '../src/game/data/companies'
import { companyStandardPalette, companyStandardRows } from '../src/game/data/companyStandard'

const ROOT = resolve(import.meta.dirname, '..')
const CACHE = join(ROOT, 'node_modules', '.cache', 'cc0-pack')
const OUT = join(ROOT, 'public', 'assets', 'scenes')
const GEN = join(ROOT, 'src', 'ui', 'shell', 'stopScenes.generated.ts')
const UPSTREAM =
  'https://raw.githubusercontent.com/FulAppiOS/Agent-Quest/main/client/public/assets/themes/tiny-swords-cc0/'

/**
 * Scene size in native pixels: drawn at 2×, an 800 × 300 stage. The scene is
 * composed on its middle 260 (`OX` in), which is what a phone sees; the wings
 * are more of the same ground, for a desk's wider column.
 */
const W = 400
const H = 150
const OX = 70

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
  /** Drawing offset: a scene composes in its middle and `draw` shifts it there. */
  ox = 0
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
    x = Math.round(x + this.ox)
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
  tile(t: Cv, x0: number, y0: number, w: number, h: number): void {
    for (let y = y0; y < y0 + h; y += t.h) for (let x = x0; x < x0 + w; x += t.w) this.draw(t, x, y)
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
function bbox(s: Cv): { x0: number; y0: number; x1: number; y1: number } {
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
function flip(s: Cv): Cv {
  const c = new Cv(s.w, s.h)
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const a = (y * s.w + x) * 4
      const b = (y * s.w + (s.w - 1 - x)) * 4
      for (let k = 0; k < 4; k++) c.d[b + k] = s.d[a + k]
    }
  return c
}

/** The pack's ink: a 1px ring round every opaque pixel. */
const INK: RGB = [22, 28, 46]
function outline(s: Cv, c: RGB = INK): Cv {
  const o = new Cv(s.w + 2, s.h + 2)
  const op = (x: number, y: number) => x >= 0 && y >= 0 && x < s.w && y < s.h && s.d[(y * s.w + x) * 4 + 3] > 100
  for (let y = -1; y <= s.h; y++)
    for (let x = -1; x <= s.w; x++) {
      if (op(x, y)) continue
      if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) o.px(x + 1, y + 1, c)
    }
  o.draw(s, 1, 1)
  return o
}
function shadow(w: number, h: number, a = 70): Cv {
  const c = new Cv(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2)
      const dy = (y + 0.5 - h / 2) / (h / 2)
      if (dx * dx + dy * dy <= 1) c.px(x, y, [22, 28, 46, a])
    }
  return c
}

// ------------------------------------------------------------- light

function multiply(s: Cv, m: RGB): void {
  for (let i = 0; i < s.d.length; i += 4) for (let k = 0; k < 3; k++) s.d[i + k] = (s.d[i + k] * m[k]) / 255
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
/** Banded, dithered light: four steps, a 4×4 Bayer at their edges — pixel-art light, not airbrush. */
function light(s: Cv, cx: number, cy: number, r: number, col: RGB, k = 1, sy = 1): void {
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const dx = x - cx
      const dy = (y - cy) / sy
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d >= r) continue
      let f = 1 - d / r
      f = f * f * k
      const b = BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5
      f = Math.max(0, Math.round(f * 4 + b * 0.55) / 4)
      const i = (y * s.w + x) * 4
      for (let c = 0; c < 3; c++) s.d[i + c] = Math.min(255, s.d[i + c] + (col[c] * f * s.d[i + c]) / 160 + col[c] * f * 0.18)
    }
}
function vignette(s: Cv, k: number): void {
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const dx = (x - s.w / 2) / (s.w / 2)
      const dy = (y - s.h / 2) / (s.h / 2)
      const f = Math.min(1, Math.max(0, Math.sqrt(dx * dx + dy * dy) - 0.6) / 0.9) * k
      const i = (y * s.w + x) * 4
      for (let c = 0; c < 3; c++) s.d[i + c] *= 1 - f
    }
}

// ------------------------------------------------------------- the pack's art

const P = {
  flat: 'Terrain/Ground/Tilemap_Flat.png',
  pawn: (c: string) => `Factions/Knights/Troops/Pawn/${c}/Pawn_${c}.png`,
  warrior: (c: string) => `Factions/Knights/Troops/Warrior/${c}/Warrior_${c}.png`,
  archer: 'Factions/Knights/Troops/Archer/Blue/Archer_Blue.png',
  tree: 'Resources/Trees/Tree.png',
  house: 'Factions/Knights/Buildings/House/House_Blue.png',
  tower: 'Factions/Knights/Buildings/Tower/Tower_Blue.png',
  sheep: 'Resources/Sheep/HappySheep_Idle.png',
  fire: 'Effects/Fire/Fire.png',
  deco: (n: number) => `Deco/${String(n).padStart(2, '0')}.png`,
}
const cell = async (rel: string, col: number, row: number, size = 192) => trim(crop(await load(rel), col * size, row * size, size, size))

// ------------------------------------------------------------- drawn props (the pack's palette)

const WD = { hi: [233, 186, 118], lt: [214, 156, 96], md: [176, 112, 62], dk: [128, 78, 44], sh: [92, 56, 34] } as const
const CREAM: RGB = [241, 228, 190]
const GOLD: RGB = [224, 172, 76]
const RED: RGB = [196, 74, 58]
const STONE = { hi: [196, 214, 206], lt: [150, 176, 176], md: [110, 136, 142], dk: [76, 96, 110], sh: [52, 64, 82] } as const

function counter(w: number, h: number, cloth: [RGB, RGB]): Cv {
  const c = new Cv(w, h)
  c.rect(0, 0, w, 3, WD.hi)
  c.rect(0, 3, w, 2, WD.md)
  c.rect(1, 5, w - 2, h - 5, WD.md)
  for (let x = 1; x < w - 1; x += 9) c.rect(x, 5, 1, h - 5, WD.dk)
  c.rect(1, h - 2, w - 2, 2, WD.sh)
  c.rect(4, 5, w - 8, h - 9, cloth[0])
  for (let x = 4; x < w - 4; x += 4) {
    c.px(x + 1, h - 4, cloth[1])
    c.px(x + 2, h - 5, cloth[1])
  }
  c.rect(4, 5, w - 8, 1, cloth[1])
  return outline(c)
}
function awning(w: number, h = 16, a: RGB = CREAM, b: RGB = GOLD): Cv {
  const c = new Cv(w, h + 4)
  for (let x = 0; x < w; x++) {
    const col = ((x / 8) | 0) % 2 ? b : a
    for (let y = 0; y < h; y++) c.px(x, y, col)
    const m = x % 8
    const dip = m === 0 || m === 7 ? 1 : m === 1 || m === 6 ? 2 : 3
    for (let y = h; y < h + dip; y++) c.px(x, y, col)
    c.px(x, 0, [255, 246, 214])
    c.px(x, 3, [0, 0, 0, 30])
    c.px(x, h - 3, [0, 0, 0, 40])
  }
  return outline(c)
}
function post(h: number): Cv {
  const c = new Cv(3, h)
  c.rect(0, 0, 3, h, WD.md)
  c.rect(0, 0, 1, h, WD.lt)
  c.rect(2, 0, 1, h, WD.dk)
  return outline(c)
}
function tent(w: number, h: number, canvas: RGB, dark: RGB): Cv {
  const c = new Cv(w, h)
  for (let y = 0; y < h; y++) {
    const half = Math.round(((y + 1) / h) * (w / 2))
    for (let x = w / 2 - half; x < w / 2 + half; x++) c.px(x, y, x < w / 2 ? canvas : dark)
  }
  const dh = Math.round(h * 0.55)
  for (let y = h - dh; y < h; y++) {
    const half = Math.round(((y - (h - dh) + 1) / dh) * (w / 7))
    for (let x = w / 2 - half; x < w / 2 + half; x++) c.px(x, y, [40, 30, 34])
  }
  return outline(c)
}
function monolith(w: number, h: number, rune: boolean): Cv {
  const c = new Cv(w, h)
  const top = (x: number) => Math.round(Math.abs(x / (w - 1) - 0.45) * 9 + ((x * 7) % 3))
  for (let y = 0; y < h; y++) {
    const taper = Math.round((1 - y / h) * Math.max(2, w * 0.12))
    for (let x = taper; x < w - taper; x++) {
      if (y < top(x)) continue
      const t = (x - taper) / (w - 2 * taper)
      c.px(x, y, y < top(x) + 2 ? STONE.hi : t < 0.22 ? STONE.lt : t > 0.72 ? STONE.dk : STONE.md)
    }
  }
  for (let i = 0; i < 3; i++) {
    const cx = (w * (0.3 + i * 0.22)) | 0
    const cy = (h * (0.25 + i * 0.2)) | 0
    for (let k = 0; k < 5; k++) c.px(cx + (k % 2), cy + k, STONE.sh)
  }
  const moss: RGB[] = [
    [96, 140, 64],
    [126, 170, 70],
  ]
  for (let x = 1; x < w - 1; x++) {
    const mh = 3 + ((x * 5) % 4)
    for (let y = h - 3 - mh; y < h - 3; y++) if (c.d[(y * w + x) * 4 + 3]) c.px(x, y, moss[(x + y) % 2])
  }
  if (rune) {
    const R: RGB = [190, 255, 246]
    const cx = (w / 2) | 0
    const cy = (h * 0.42) | 0
    for (let i = -4; i <= 4; i++) c.px(cx, cy + i, R)
    for (let i = -2; i <= 2; i++) c.px(cx + i, cy - 2 + Math.abs(i), R)
    c.px(cx - 2, cy + 3, R)
    c.px(cx + 2, cy + 3, R)
  }
  c.rect(0, h - 3, w, 3, STONE.sh)
  return outline(c)
}
function slab(w: number, h: number): Cv {
  const c = new Cv(w, h)
  c.rect(0, 0, w, 4, STONE.hi)
  c.rect(0, 4, w, h - 4, STONE.md)
  c.rect(0, h - 3, w, 3, STONE.dk)
  for (let x = 6; x < w; x += 12) c.rect(x, 5, 1, h - 8, STONE.dk)
  return outline(c)
}
function bedroll(w = 22, h = 8): Cv {
  const c = new Cv(w, h)
  c.rect(0, 0, w, h, [74, 110, 160])
  c.rect(0, 0, w, 2, [104, 146, 196])
  for (let x = 4; x < w; x += 7) c.rect(x, 0, 2, h, RED)
  c.rect(w - 5, 0, 5, h, [214, 196, 152])
  c.rect(w - 5, 0, 5, 2, CREAM)
  return outline(c)
}
function pot(): Cv {
  const c = new Cv(18, 22)
  c.rect(1, 0, 2, 22, WD.dk)
  c.rect(15, 0, 2, 22, WD.dk)
  c.rect(1, 0, 16, 2, WD.dk)
  c.rect(8, 2, 2, 4, [70, 70, 80])
  c.rect(3, 6, 12, 9, [58, 58, 70])
  c.rect(4, 7, 4, 2, [96, 98, 112])
  c.rect(3, 6, 12, 2, [150, 120, 70])
  return outline(c)
}
function candle(h: number): Cv {
  const c = new Cv(3, h + 3)
  c.rect(0, 3, 3, h, CREAM)
  c.rect(2, 3, 1, h, [200, 184, 146])
  c.px(1, 0, [255, 236, 150])
  c.px(1, 1, [255, 190, 80])
  c.px(1, 2, [255, 236, 150])
  return c
}
function flagpole(h: number, cloth: RGB): Cv {
  const c = new Cv(22, h)
  c.rect(0, 0, 2, h, WD.dk)
  c.rect(0, 0, 1, h, WD.md)
  c.rect(2, 3, 18, 14, cloth)
  c.rect(2, 3, 18, 2, GOLD)
  for (let x = 2; x < 20; x++) if (x % 4 < 2) c.px(x, 17, cloth)
  c.rect(8, 8, 6, 5, GOLD)
  c.rect(10, 7, 2, 7, GOLD)
  return outline(c)
}
function crate(w = 14, h = 12): Cv {
  const c = new Cv(w, h)
  c.rect(0, 0, w, h, WD.md)
  c.rect(0, 0, w, 2, WD.hi)
  c.rect(0, h - 2, w, 2, WD.dk)
  for (let i = 0; i < Math.min(w, h); i++) {
    c.px(i, h - 1 - i, WD.dk)
    c.px(i + 1, h - 1 - i, WD.dk)
  }
  c.rect(0, 0, 2, h, WD.lt)
  c.rect(w - 2, 0, 2, h, WD.dk)
  return outline(c)
}

// ------------------------------------------------------------- the scenes

type Pt = readonly [number, number]
interface Anchors {
  /** The top of the keeper's head: the speech bubble's tail points here. */
  speaker: Pt
  /** The merchant's raised hands: the focused ware is held up here. */
  held?: Pt
  /** The fire's feet: the animated flame stands here. */
  fire?: Pt
}

async function bake(): Promise<Record<string, Anchors>> {
  const flat = await load(P.flat)
  const grass = crop(flat, 64, 64, 64, 64)
  const sand = (c: number, r: number) => crop(flat, 320 + c * 64, r * 64, 64, 64)
  const meadow = (c: Cv) => c.tile(grass, -c.ox, 0, c.w, c.h)
  const clearing = (c: Cv, x: number, y: number, cols: number, rows: number) => {
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++)
        c.draw(sand(i === 0 ? 0 : i === cols - 1 ? 2 : 1, j === 0 ? 0 : j === rows - 1 ? 2 : 1), x + i * 64, y + j * 64)
  }
  const tree = async (i: number) => trim(crop(await load(P.tree), i * 192, 0, 192, 192))
  const deco = async (n: number) => trim(await load(P.deco(n)))
  const carry = async (c: string) => cell(P.pawn(c), 0, 4)
  const idle = async (rel: string) => cell(rel, 0, 0)
  const fireFrame = trim(crop(await load(P.fire), 0, 0, 128, 128))
  const scene = () => {
    const c = new Cv(W, H)
    c.ox = OX
    return c
  }
  /** The wings a desk sees past the phone's middle: pines and brush, nothing that speaks. */
  const wings = async (c: Cv, kind: 'day' | 'wood') => {
    const t = [await tree(0), await tree(1), await tree(2), await tree(3)]
    const left: [number, number][] = kind === 'wood' ? [[-56, 60], [-30, 104], [-64, 150], [-12, 40]] : [[-48, 74], [-20, 120], [-60, 150]]
    const right: [number, number][] = kind === 'wood' ? [[316, 62], [288, 108], [326, 150], [272, 36]] : [[306, 70], [282, 124], [322, 152]]
    for (const [i, [x, y]] of [...left, ...right].entries()) c.put(t[i % 4], x, y)
    c.put(await deco(9), -36, 140)
    c.put(await deco(8), 300, 138)
  }
  const out: Record<string, Anchors> = {}

  // ---- the merchant: a stall in front of a cottage, the clerk's hands raised for the ware you look at
  {
    const c = scene()
    meadow(c)
    clearing(c, -80, 80, 9, 2)
    await wings(c, 'day')
    c.put(await tree(0), 36, 70)
    c.put(await tree(3), 226, 64)
    c.put(await tree(1), 8, 112)
    c.put(await tree(2), 254, 106)
    c.put(trim(await load(P.house)), 130, 88)
    const w = 132
    const ox = 130 - w / 2
    const oy = 76
    c.draw(post(62), ox + 2, oy - 4)
    c.draw(post(62), ox + w - 7, oy - 4)
    const clerk = await carry('Yellow')
    c.put(clerk, 130, oy + 60)
    c.draw(counter(w, 20, [RED, CREAM]), ox, oy + 50)
    c.draw(awning(w + 8), ox - 4, oy - 22)
    c.put(crate(), 46, 146)
    c.put(crate(12, 10), 52, 134)
    c.put(await deco(9), 216, 148)
    c.put(trim(crop(await load(P.sheep), 0, 0, 128, 128)), 236, 146)
    c.put(await deco(10), 20, 148)
    out.merchant = { speaker: [OX + 130, oy + 60 - clerk.h], held: [OX + 130, oy + 60 - clerk.h - 2] }
    await write('merchant', c)
  }

  // ---- the campfire: night in a clearing, the cook at the pot, a sentry resting
  {
    const c = scene()
    meadow(c)
    clearing(c, 10, 60, 4, 2)
    await wings(c, 'wood')
    c.put(await tree(0), 20, 96)
    c.put(await tree(3), 244, 90)
    c.put(await tree(2), 196, 52)
    c.put(await tree(1), 70, 46)
    c.put(await tree(0), 132, 36)
    c.put(tent(48, 36, [214, 196, 152], [150, 126, 92]), 64, 84)
    c.put(bedroll(), 186, 100)
    const fx = 130
    const fy = 122
    const wood = trim(await load('Resources/Resources/W_Idle.png'))
    c.put(wood, fx - 34, fy + 8)
    c.put(flip(wood), fx + 36, fy + 10)
    c.put(pot(), fx + 34, fy - 2)
    const cook = flip(await idle(P.pawn('Red')))
    c.put(cook, fx + 58, fy + 2)
    c.put(await idle(P.warrior('Blue')), fx - 58, fy + 6)
    c.put(trim(crop(await load(P.tree), 0, 384, 192, 192)), 34, 146)
    c.put(await deco(10), 226, 148)
    c.put(shadow(30, 8, 90), fx, fy + 3)
    multiply(c, [78, 88, 150])
    light(c, OX + fx, fy - 16, 130, [255, 150, 60], 1.6, 0.8)
    vignette(c, 0.5)
    c.put(fireFrame, fx, fy)
    out.campfire = { speaker: [OX + fx + 58, fy + 2 - cook.h], fire: [OX + fx, fy] }
    await write('campfire', c)
  }

  // ---- the shrine: standing stones at dusk, the keeper raising an offering
  {
    const c = scene()
    meadow(c)
    await wings(c, 'wood')
    c.put(await tree(0), 22, 92)
    c.put(await tree(2), 240, 88)
    c.put(await tree(1), 60, 54)
    c.put(await tree(3), 204, 48)
    c.put(await tree(0), 132, 30)
    const sx = 130
    const sy = 116
    c.put(monolith(18, 36, false), sx - 46, sy - 18)
    c.put(monolith(16, 30, false), sx + 30, sy - 26)
    c.put(monolith(30, 62, true), sx, sy - 10)
    c.put(slab(44, 12), sx, sy + 2)
    c.put(candle(6), sx - 16, sy - 9)
    c.put(candle(4), sx - 10, sy - 9)
    c.put(candle(5), sx + 14, sy - 9)
    const keeper = flip(await carry('Purple'))
    c.put(keeper, sx + 52, sy + 20)
    c.put(await deco(1), 64, 146)
    c.put(await deco(1), 198, 140)
    c.put(await deco(10), 40, 148)
    c.put(await deco(11), 222, 150)
    multiply(c, [130, 120, 190])
    light(c, OX + sx, sy - 44, 80, [120, 230, 240], 1.0)
    light(c, OX + sx, sy - 8, 44, [255, 190, 90], 0.8)
    vignette(c, 0.4)
    out.shrine = { speaker: [OX + sx + 52, sy + 20 - keeper.h] }
    await write('shrine', c)
  }

  // ---- the recruiter: a yard by a watchtower, the sergeant out front
  {
    const c = scene()
    meadow(c)
    clearing(c, -80, 70, 9, 2)
    await wings(c, 'day')
    c.put(await tree(1), 14, 86)
    c.put(await tree(2), 250, 80)
    c.put(await tree(0), 120, 34)
    c.put(trim(await load(P.tower)), 222, 92)
    c.put(tent(56, 40, [92, 130, 186], [62, 92, 140]), 58, 92)
    c.put(flagpole(52, RED), 92, 96)
    // two hands already hired, idling by the tower: the yard, not the slate
    c.put(await idle(P.pawn('Blue')), 166, 104)
    c.put(flip(await idle(P.archer)), 196, 112)
    const sarge = await idle(P.warrior('Red'))
    c.put(sarge, 112, 146)
    c.put(crate(), 46, 140)
    c.put(await deco(10), 236, 148)
    out.recruit = { speaker: [OX + 112, 146 - sarge.h] }
    await write('recruit', c)
  }

  // ---- the liaisons' posts (Draft 4 · D): each company's own stall, its
  // standard on a pole to the left, its liaison behind the counter. Every
  // post keeps one layout, so the home notice's short band and the city's
  // taller one crop them alike: the liaison's head at y ≈ 70, the counter
  // from y 108, the bubble's room to the right of the head (rows 40–80).
  const LX = 110
  const FEET = 130
  const liaisonPost = async (company: CompanyId, fig: Cv, draw: (c: Cv, top: number) => Promise<void>, lit?: (c: Cv) => void) => {
    const c = scene()
    const top = FEET - fig.h
    await draw(c, top)
    if (lit) lit(c)
    // The speaker's mouth level, not a plume's tip: the bubble's tail points at the face.
    out[`liaison-${company}`] = { speaker: [OX + LX, Math.max(top, FEET - 60)] }
    await write(`liaison-${company}`, c)
  }
  const flagAt = (c: Cv, company: CompanyId, x = 44) => c.put(standard(company, 30), x, FEET + 2)
  const cloth = (company: CompanyId): [RGB, RGB] => {
    const k = hex(companyById(company).color)
    return [k, darker(k, 0.3)]
  }

  // Peppercorn Co. — Saffra's spice stall: lime awning hung with chilies, sacks of spice, a brazier (the burning road).
  {
    const fig = await idle(P.pawn('Red'))
    await liaisonPost(
      'spice',
      fig,
      async (c, top) => {
        meadow(c)
        clearing(c, -80, 74, 9, 2)
        await wings(c, 'day')
        c.put(await tree(1), 18, 66)
        c.put(await tree(3), 236, 60)
        c.put(trim(await load(P.house)), 186, 70)
        c.put(await tree(0), 120, 26)
        flagAt(c, 'spice')
        const w = 108
        const x0 = LX - w / 2
        c.draw(post(56), x0 + 2, top - 14)
        c.draw(post(56), x0 + w - 7, top - 14)
        c.put(fig, LX, FEET)
        c.draw(counter(w, 24, [hex('#c44a3a'), CREAM]), x0, 108)
        for (const [i, k] of [[8, 0], [30, 1], [78, 2], [100, 3]] as const) c.draw(chilies(14 + (k % 2) * 5), x0 + i, top - 20)
        c.draw(awning(w + 8, 14, hex(companyById('spice').color), CREAM), x0 - 4, top - 32)
        c.put(sack([214, 72, 44]), x0 + 18, 112)
        c.put(sack([236, 160, 52]), x0 + 40, 112)
        c.put(sack([132, 92, 52]), x0 + 68, 112)
        c.put(sack([226, 196, 70]), 196, 140)
        c.put(sack([214, 72, 44]), 214, 146)
        c.put(brazier(), 236, 136)
        c.put(half(fireFrame), 236, 124)
        c.put(await deco(10), 18, 148)
      },
      (c) => {
        multiply(c, [255, 236, 212])
        light(c, OX + 236, 118, 46, [255, 150, 60], 1.1)
      },
    )
  }

  // Easel House — Vell's canal gallery: a lavender tent, an easel and framed canvases, the canal at the bank's foot.
  {
    const fig = flip(await idle(P.pawn('Purple')))
    await liaisonPost('art', fig, async (c, top) => {
      meadow(c)
      clearing(c, -80, 70, 9, 1)
      await wings(c, 'day')
      c.put(await tree(2), 12, 70)
      c.put(await tree(0), 246, 66)
      c.put(await tree(1), 196, 30)
      const lav = hex(companyById('art').color)
      c.put(tent(84, 58, mix(lav, CREAM, 0.35), darker(lav, 0.25)), LX + 6, top + 6)
      flagAt(c, 'art')
      c.put(fig, LX, FEET)
      c.draw(counter(100, 24, cloth('art')), LX - 50, 108)
      c.put(painting(16, 14, 0), LX - 30, 110)
      c.put(painting(12, 16, 1), LX + 26, 110)
      c.put(easel(), 188, 134)
      c.put(painting(18, 14, 2), 214, 136)
      c.put(painting(12, 12, 1), 228, 138)
      c.put(crate(12, 10), 214, 146)
      c.draw(canal(), -OX, 136)
    })
  }

  // Ironvein — Brannoch's ore yard: the blue watchtower behind, a stone counter, ore heaps and an anvil with its forge glow.
  {
    const fig = await idle(P.warrior('Blue'))
    await liaisonPost(
      'metals',
      fig,
      async (c, top) => {
        meadow(c)
        clearing(c, -80, 66, 9, 2)
        await wings(c, 'wood')
        c.put(await tree(1), 16, 62)
        c.put(trim(await load(P.tower)), 196, 96)
        c.put(await tree(3), 250, 70)
        c.put(await tree(0), 116, 22)
        flagAt(c, 'metals')
        // A lean-to over the counter, slate and the company's blue.
        c.draw(post(80), LX - 54, top - 12)
        c.draw(post(80), LX + 49, top - 12)
        c.put(fig, LX, FEET)
        c.draw(stoneCounter(104, 24), LX - 52, 108)
        c.draw(awning(116, 12, hex(companyById('metals').color), STONE.md), LX - 58, top - 24)
        c.put(oreHeap(26, 12, [120, 176, 255]), LX - 28, 111)
        c.put(oreHeap(20, 10, [246, 206, 96]), LX + 30, 111)
        c.put(anvil(), 168, 142)
        c.put(oreHeap(30, 14, [96, 150, 236]), 208, 148)
        c.put(oreHeap(18, 10, [230, 190, 90]), 232, 146)
        c.put(crate(), 18, 140)
        c.put(await deco(9), 244, 148)
      },
      (c) => {
        multiply(c, [214, 222, 236])
        light(c, OX + 168, 132, 34, [255, 140, 60], 0.9)
      },
    )
  }

  // Rosethread — Odile's silk stall: bolts of silk hung on a line, folded bolts on the counter, a sheep for the wool trade, reeds by the ford.
  {
    const fig = await idle(P.pawn('Yellow'))
    await liaisonPost('silk', fig, async (c, top) => {
      meadow(c)
      clearing(c, -80, 72, 9, 2)
      await wings(c, 'day')
      c.put(await tree(3), 20, 64)
      c.put(await tree(2), 244, 62)
      c.put(await tree(0), 150, 26)
      flagAt(c, 'silk')
      const rose = hex(companyById('silk').color)
      const line = top - 16
      c.draw(post(48), LX - 52, line - 2)
      c.draw(post(48), LX + 47, line - 2)
      c.rect(OX + LX - 50, line, 98, 1, WD.dk)
      const hung: RGB[] = [rose, CREAM, [196, 74, 96], GOLD, mix(rose, CREAM, 0.5), [150, 70, 120]]
      hung.forEach((k, i) => c.draw(drape(13, 22 + ((i * 7) % 9), k), LX - 46 + i * 16, line + 1))
      c.put(fig, LX, FEET)
      c.draw(counter(100, 24, [mix(rose, CREAM, 0.3), rose]), LX - 50, 108)
      c.put(bolts([rose, CREAM, GOLD]), LX - 28, 110)
      c.put(bolts([[196, 74, 96], mix(rose, CREAM, 0.5)]), LX + 28, 110)
      c.put(trim(crop(await load(P.sheep), 0, 0, 128, 128)), 200, 146)
      c.put(bolts([CREAM, rose, [150, 70, 120]]), 234, 144)
      c.draw(reeds(), 160, 128)
      c.put(await deco(10), 22, 148)
    })
  }

  // Moonquill — Wren's scriptorium by night: a rack of sealed scrolls, a lectern with the open ledger, candles and a warded stone.
  {
    const fig = flip(await idle(P.pawn('Blue')))
    await liaisonPost(
      'scrolls',
      fig,
      async (c, top) => {
        meadow(c)
        await wings(c, 'wood')
        c.put(await tree(0), 18, 70)
        c.put(await tree(2), 248, 72)
        c.put(await tree(1), 60, 32)
        c.put(await tree(3), 200, 28)
        c.put(scrollRack(72, 48), LX, top + 18)
        flagAt(c, 'scrolls')
        c.put(fig, LX, FEET)
        c.draw(counter(100, 24, cloth('scrolls')), LX - 50, 108)
        c.put(ledger(), LX - 22, 110)
        c.put(candle(7), LX + 18, 110)
        c.put(candle(5), LX + 24, 110)
        c.put(candle(6), LX + 36, 110)
        c.put(monolith(20, 40, true), 200, 140)
        c.put(candle(5), 180, 146)
        c.put(candle(7), 222, 146)
        c.put(await deco(1), 236, 148)
        c.put(await deco(11), 30, 150)
      },
      (c) => {
        multiply(c, [96, 104, 168])
        light(c, OX + LX + 10, 96, 70, [255, 180, 90], 1.2, 0.8)
        light(c, OX + 200, 112, 40, [120, 230, 240], 0.9)
        vignette(c, 0.45)
      },
    )
  }
  return out
}

// ------------------------------------------------------------- the liaisons' props

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * t)) as unknown as RGB
const darker = (c: RGB, k: number): RGB => c.map((v) => Math.round(v * (1 - k))) as unknown as RGB

/** A company's standard — the very rows the wagon flies (`data/companyStandard.ts`) — on a taller pole. */
function standard(company: CompanyId, pole: number): Cv {
  const rows = companyStandardRows(company)
  const pal = companyStandardPalette(company)
  const c = new Cv(rows[0].length, rows.length + pole)
  rows.forEach((r, y) =>
    r.split('').forEach((k, x) => {
      if (k !== '.' && pal[k]) c.px(x, y, hex(pal[k]))
    }),
  )
  for (let y = rows.length; y < rows.length + pole; y++) {
    c.px(0, y, hex(pal['1']))
    c.px(1, y, hex(pal['2']))
  }
  return outline(c)
}
/** Nearest-neighbour half size (a brazier's flame from the campfire's). */
function half(s: Cv): Cv {
  const c = new Cv(Math.ceil(s.w / 2), Math.ceil(s.h / 2))
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      const k = (y * 2 * s.w + x * 2) * 4
      if (s.d[k + 3]) c.px(x, y, [s.d[k], s.d[k + 1], s.d[k + 2], s.d[k + 3]])
    }
  return c
}
const BURLAP = { hi: [226, 196, 146], lt: [204, 168, 116], md: [178, 140, 92], dk: [138, 102, 64] } as const
function sack(spice: RGB): Cv {
  const c = new Cv(14, 14)
  for (let y = 4; y < 14; y++) {
    const inset = y < 6 || y > 12 ? 1 : 0
    for (let x = inset; x < 14 - inset; x++) c.px(x, y, x < 4 ? BURLAP.lt : x > 10 ? BURLAP.dk : BURLAP.md)
  }
  c.rect(0, 4, 14, 2, BURLAP.hi)
  const tops = [2, 4, 5, 6]
  for (let y = 0; y < 4; y++) for (let x = 7 - tops[y]; x < 7 + tops[y]; x++) c.px(x, y + 1, y === 0 ? mix(spice, [255, 255, 255], 0.35) : x < 7 ? spice : darker(spice, 0.18))
  return outline(c)
}
function chilies(h: number): Cv {
  const c = new Cv(5, h)
  for (let y = 0; y < h; y++) c.px(2, y, WD.dk)
  for (let y = 3; y < h - 2; y += 4) {
    c.rect(0, y, 2, 3, [214, 60, 44])
    c.rect(3, y + 1, 2, 3, [236, 92, 52])
    c.px(2, y, [90, 150, 60])
  }
  return c
}
function brazier(): Cv {
  const c = new Cv(16, 14)
  const IRON: RGB = [64, 70, 86]
  c.rect(0, 0, 16, 5, IRON)
  c.rect(1, 0, 14, 1, [120, 128, 146])
  c.rect(2, 1, 12, 2, [255, 170, 70])
  c.rect(3, 5, 2, 9, IRON)
  c.rect(11, 5, 2, 9, IRON)
  c.rect(6, 5, 4, 2, IRON)
  return outline(c)
}
function painting(w: number, h: number, kind: 0 | 1 | 2): Cv {
  const c = new Cv(w, h)
  c.rect(0, 0, w, h, GOLD)
  c.rect(0, 0, w, 1, [250, 214, 120])
  c.rect(0, h - 1, w, 1, WD.dk)
  const ix = 2
  const iy = 2
  const iw = w - 4
  const ih = h - 4
  if (kind === 0) {
    // a landscape: sky, a sun, a green hill
    c.rect(ix, iy, iw, ih, [126, 182, 222])
    c.rect(ix + iw - 4, iy + 1, 2, 2, [255, 226, 96])
    for (let x = 0; x < iw; x++) {
      const hh = Math.round(ih * 0.45 + Math.sin((x / iw) * Math.PI) * ih * 0.2)
      c.rect(ix + x, iy + ih - hh, 1, hh, x % 3 ? [96, 150, 80] : [80, 128, 66])
    }
  } else if (kind === 1) {
    // a portrait: a dark ground, a face, a collar
    c.rect(ix, iy, iw, ih, [96, 62, 92])
    const cx = ix + Math.floor(iw / 2)
    c.rect(cx - 2, iy + 2, 4, 5, [234, 196, 160])
    c.rect(cx - 2, iy + 1, 4, 1, [80, 50, 40])
    c.rect(ix + 1, iy + ih - 4, iw - 2, 4, [70, 100, 170])
  } else {
    // the sea and a sail
    c.rect(ix, iy, iw, ih, [150, 200, 230])
    c.rect(ix, iy + Math.floor(ih / 2), iw, Math.ceil(ih / 2), [56, 112, 170])
    c.rect(ix + 5, iy + 2, 3, 5, CREAM)
    c.rect(ix + 4, iy + 7, 6, 1, WD.dk)
  }
  return outline(c)
}
function easel(): Cv {
  const c = new Cv(24, 38)
  for (let y = 10; y < 38; y++) {
    const t = (y - 10) / 28
    const l = Math.round(7 - t * 6)
    const r = Math.round(16 + t * 6)
    c.px(l, y, WD.dk)
    c.px(l + 1, y, WD.md)
    c.px(r, y, WD.md)
    c.px(r + 1, y, WD.dk)
  }
  c.rect(11, 0, 2, 38, WD.dk)
  c.rect(3, 26, 18, 2, WD.md)
  c.draw(painting(20, 24, 0), 2, 2)
  return outline(c)
}
/** The canal along the bank's foot: a stone lip, the water, its ripples. */
function canal(): Cv {
  const c = new Cv(W, 14)
  for (let x = 0; x < W; x++) {
    c.px(x, 0, STONE.hi)
    c.px(x, 1, x % 6 ? STONE.md : STONE.dk)
    for (let y = 2; y < 14; y++) c.px(x, y, y < 5 ? [70, 128, 178] : [56, 112, 168])
    if ((x * 7 + 3) % 13 === 0) c.rect(x, 6 + (x % 3) * 2, 3, 1, [150, 206, 236])
  }
  return c
}
function stoneCounter(w: number, h: number): Cv {
  const c = new Cv(w, h)
  c.rect(0, 0, w, 4, STONE.hi)
  c.rect(0, 4, w, h - 4, STONE.md)
  for (let y = 8; y < h; y += 6) c.rect(0, y, w, 1, STONE.dk)
  for (let y = 4; y < h; y += 6) for (let x = (y / 6) % 2 ? 4 : 10; x < w; x += 14) c.rect(x, y + 1, 1, 5, STONE.dk)
  c.rect(0, h - 3, w, 3, STONE.sh)
  // the company's blue cloth over its lip
  c.rect(10, 4, w - 20, 6, [93, 139, 226])
  c.rect(10, 9, w - 20, 1, [58, 92, 168])
  return outline(c)
}
function oreHeap(w: number, h: number, vein: RGB): Cv {
  const c = new Cv(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2)
      const dy = (h - y - 0.5) / h
      if (dx * dx + dy * dy > 1) continue
      const lit = dx < -0.2 && dy > 0.4
      c.px(x, y, lit ? STONE.lt : dx > 0.45 ? STONE.dk : STONE.md)
      if ((x * 13 + y * 7) % 11 === 0) c.px(x, y, vein)
      if ((x * 5 + y * 17) % 23 === 0) c.px(x, y, STONE.sh)
    }
  return outline(c)
}
function anvil(): Cv {
  const c = new Cv(22, 13)
  const IRON: RGB = [70, 76, 94]
  c.rect(0, 0, 22, 4, IRON)
  c.rect(0, 0, 22, 1, [140, 150, 170])
  c.rect(16, 0, 6, 2, [140, 150, 170])
  c.rect(6, 4, 10, 4, IRON)
  c.rect(3, 8, 16, 5, WD.md)
  c.rect(3, 8, 16, 1, WD.hi)
  return outline(c)
}
function drape(w: number, h: number, k: RGB): Cv {
  const c = new Cv(w, h + 2)
  for (let x = 0; x < w; x++) {
    const fold = x % 4 === 0 ? darker(k, 0.2) : x % 4 === 1 ? mix(k, [255, 255, 255], 0.25) : k
    const len = h + ((x * 3) % 3)
    for (let y = 0; y < len; y++) c.px(x, y, fold)
  }
  c.rect(0, 0, w, 1, darker(k, 0.35))
  return outline(c)
}
function bolts(ks: RGB[]): Cv {
  const c = new Cv(18, ks.length * 4)
  ks.forEach((k, i) => {
    const y = (ks.length - 1 - i) * 4
    c.rect(i % 2, y, 17, 4, k)
    c.rect(i % 2, y, 17, 1, mix(k, [255, 255, 255], 0.35))
    c.rect(i % 2 ? 16 : 15, y, 2, 4, darker(k, 0.25))
  })
  return outline(c)
}
function reeds(): Cv {
  const c = new Cv(14, 18)
  for (const [x, h] of [[1, 14], [4, 17], [7, 12], [10, 16], [12, 10]] as const) {
    for (let y = 18 - h; y < 18; y++) c.px(x, y, [96, 140, 64])
    c.rect(x, 18 - h, 1, 3, [124, 84, 52])
  }
  return c
}
function scrollRack(w: number, h: number): Cv {
  const c = new Cv(w, h)
  c.rect(0, 0, w, h, WD.dk)
  c.rect(0, 0, w, 3, WD.lt)
  const cols = 6
  const rows = 4
  const cw = Math.floor((w - 4) / cols)
  const ch = Math.floor((h - 6) / rows)
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = 2 + i * cw
      const y = 4 + j * ch
      c.rect(x, y, cw - 1, ch - 1, WD.sh)
      if ((i * 5 + j * 3) % 7 === 6) continue
      // a scroll's end, some with a seal
      c.rect(x + 2, y + 2, cw - 5, ch - 5, CREAM)
      c.px(x + 2 + Math.floor((cw - 5) / 2), y + 2 + Math.floor((ch - 5) / 2), [200, 184, 146])
      if ((i + j) % 3 === 0) c.rect(x + cw - 4, y + ch - 4, 2, 2, RED)
    }
  return outline(c)
}
function ledger(): Cv {
  const c = new Cv(20, 8)
  c.rect(0, 2, 20, 6, [70, 64, 110])
  c.rect(1, 0, 8, 6, CREAM)
  c.rect(11, 0, 8, 6, CREAM)
  c.rect(9, 1, 2, 6, [200, 184, 146])
  for (let y = 1; y < 5; y += 2) {
    c.rect(2, y, 6, 1, [120, 110, 140])
    c.rect(12, y, 6, 1, [120, 110, 140])
  }
  return outline(c)
}

async function write(name: string, c: Cv): Promise<void> {
  mkdirSync(OUT, { recursive: true })
  await sharp(Buffer.from(c.d.buffer), { raw: { width: c.w, height: c.h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(join(OUT, `${name}.png`))
  console.log(`  scene ${name}.png ${c.w}x${c.h}`)
}

/** Where the flame sits in its 128px cell of `fx/tinyswords/fire.png`, so the overlay's feet land on the scene's. */
async function fireCell(): Promise<{ cx: number; by: number }> {
  const b = bbox(crop(await load(P.fire), 0, 0, 128, 128))
  return { cx: Math.round((b.x0 + b.x1 + 1) / 2), by: b.y1 + 1 }
}

const anchors = await bake()
const fc = await fireCell()
writeFileSync(
  GEN,
  [
    '// Generated by scripts/stop-scenes.ts — do not edit by hand.',
    '// Native pixels of `public/assets/scenes/<stop>.png`; the page draws them at 2×.',
    '',
    `export const SCENE_SIZE = { w: ${W}, h: ${H} } as const`,
    '',
    '/** Where the flame stands in its 128px cell of `fx/tinyswords/fire.png`. */',
    `export const FIRE_CELL = { cx: ${fc.cx}, by: ${fc.by} } as const`,
    '',
    'export const SCENE_ANCHORS = {',
    ...Object.entries(anchors).map(
      ([k, a]) =>
        `  ${/^[a-z]+$/.test(k) ? k : `'${k}'`}: { speaker: [${a.speaker.join(', ')}]${a.held ? `, held: [${a.held.join(', ')}]` : ''}${a.fire ? `, fire: [${a.fire.join(', ')}]` : ''} },`,
    ),
    '} as const',
    '',
  ].join('\n'),
)
console.log(`  wrote ${GEN.replace(ROOT + '/', '')}`)
