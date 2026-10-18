/**
 * stop-scenes.ts — bake the four stops' scenes (merchant, campfire, shrine,
 * recruit), and each company's post where its liaison stands (Draft 4 · D:
 * `liaison-<company>`), from the CC0 Tiny Swords pack.
 *
 *   npx tsx scripts/stop-scenes.ts
 *   npx tsx scripts/stop-scenes.ts --proposals <dir>   # also the two proposed posts, into <dir> only
 *   npx tsx scripts/stop-scenes.ts --faces <dir>       # ONLY the posts, each with its company face (the
 *                                                       # hand-drawn prototype, `render/hero/post.ts`) at the
 *                                                       # counter, into <dir>: the review cards; nothing shipped
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
 * same folder. Nothing from the current, non-CC0 download. The stalls, tents,
 * stones, hearth, racks, barrels and every other prop are drawn here, in the
 * pack's palette, inked with its outline colour, lit from the upper left, at
 * the pack's people's scale and stood on a shadow; the yards are the pack's
 * sand re-inked as trodden earth; the night, dusk and fire light is a
 * multiply plus banded, dithered light. (Asset critique, Oct 2026:
 * `docs/ui-audit-2026-10/asset-critique/places/SCORECARD.md`.)
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
import { postFrame } from '../src/game/render/hero/post'
import type { PersonaId } from '../src/game/render/hero/rig'

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
//
// Every drawn prop is inked with the pack's outline, lit from the upper left
// (its left or top edge a step lighter, its right or bottom a step darker) and
// sized against the pack's people: a pawn stands 59 px, a knight 91.

const WD = { hi: [233, 186, 118], lt: [214, 156, 96], md: [176, 112, 62], dk: [128, 78, 44], sh: [92, 56, 34] } as const
const CREAM: RGB = [241, 228, 190]
const GOLD: RGB = [224, 172, 76]
const RED: RGB = [196, 74, 58]
const STONE = { hi: [196, 214, 206], lt: [150, 176, 176], md: [110, 136, 142], dk: [76, 96, 110], sh: [52, 64, 82] } as const
const IRON: RGB = [64, 70, 86]
const LEAF = { lt: [155, 185, 78], md: [121, 168, 99], dk: [103, 145, 117] } as const

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
/** A canvas tent, its lit side left, its door open; a trim along its hem if given. */
function tent(w: number, h: number, canvas: RGB, dark: RGB, trim?: RGB): Cv {
  const c = new Cv(w, h)
  for (let y = 0; y < h; y++) {
    const half = Math.round(((y + 1) / h) * (w / 2))
    for (let x = w / 2 - half; x < w / 2 + half; x++) c.px(x, y, x < w / 2 ? canvas : dark)
  }
  // seams down each flank
  for (let y = 4; y < h; y++) {
    const half = Math.round(((y + 1) / h) * (w / 2))
    c.px(w / 2 - Math.round(half * 0.55), y, darker(canvas, 0.12))
    c.px(w / 2 + Math.round(half * 0.55), y, darker(dark, 0.12))
  }
  if (trim)
    for (let y = h - 4; y < h - 1; y++) {
      const half = Math.round(((y + 1) / h) * (w / 2))
      for (let x = w / 2 - half; x < w / 2 + half; x++) c.px(x, y, x < w / 2 ? trim : darker(trim, 0.25))
    }
  const dh = Math.round(h * 0.55)
  for (let y = h - dh; y < h; y++) {
    const half = Math.round(((y - (h - dh) + 1) / dh) * (w / 7))
    for (let x = w / 2 - half; x < w / 2 + half; x++) c.px(x, y, [40, 30, 34])
  }
  c.px(w / 2 - 1, 0, GOLD)
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
  const moss: RGB[] = [LEAF.dk, [126, 170, 70]]
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
/** Worn flagstones round the stones: slabs in the stone ramp, grouted, nicked with moss, a ragged edge. */
function flagstones(c: Cv, cx: number, cy: number, rx: number, ry: number, seed: number): void {
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      const lx = x - c.ox
      const dx = (lx - cx) / rx
      const dy = (y - cy) / ry
      const d = Math.sqrt(dx * dx + dy * dy) + (vnoise(x, y, 6, seed) - 0.5) * 0.3
      if (d >= 1) continue
      const row = Math.floor((y - cy + 40) / 5)
      const col = Math.floor((lx + (row % 2) * 6 + 40) / 11)
      const gx = (lx + (row % 2) * 6 + 40) % 11
      const gy = (y - cy + 40) % 5
      const tone = hash2(col, row, seed)
      let k: RGB = tone < 0.3 ? STONE.lt : tone > 0.8 ? STONE.dk : STONE.md
      if (gy === 0) k = tone < 0.3 ? STONE.hi : STONE.lt
      if (gx === 0 || gy === 4) k = STONE.sh
      if (d > 0.9) k = STONE.sh
      if (hash2(x, y, seed + 1) < 0.04) k = LEAF.dk
      c.px(x, y, k)
    }
}
function steppingStone(): Cv {
  const c = new Cv(10, 5)
  c.rect(1, 0, 8, 5, STONE.md)
  c.rect(0, 1, 10, 3, STONE.md)
  c.rect(1, 0, 6, 1, STONE.hi)
  c.rect(0, 1, 3, 2, STONE.lt)
  c.rect(1, 4, 8, 1, STONE.dk)
  return outline(c)
}
/** A bedroll, rolled at its head: warm wool, a cream blanket. */
function bedroll(w = 40, h = 11): Cv {
  const c = new Cv(w, h)
  c.rect(0, 0, w, h, [150, 70, 54])
  c.rect(0, 0, w, 2, [190, 96, 70])
  c.rect(0, h - 2, w, 2, [112, 50, 40])
  for (let x = 6; x < w - 10; x += 9) c.rect(x, 0, 2, h, GOLD)
  c.rect(w - 9, 0, 9, h, [214, 196, 152])
  c.rect(w - 9, 0, 9, 2, CREAM)
  c.rect(w - 9, 0, 1, h, [168, 150, 112])
  return outline(c)
}
/** The cook's pot on its spit: two forked uprights, a bar, the pot on a chain, stew in it. */
function spit(): Cv {
  const c = new Cv(24, 26)
  for (const x of [1, 21]) {
    c.rect(x, 3, 2, 23, WD.dk)
    c.px(x, 3, WD.md)
    c.px(x - 1, 1, WD.dk)
    c.px(x + 2, 1, WD.dk)
    c.px(x - 1, 2, WD.dk)
    c.px(x + 2, 2, WD.dk)
  }
  c.rect(0, 3, 24, 2, WD.md)
  c.rect(0, 3, 24, 1, WD.lt)
  c.rect(11, 5, 1, 5, STONE.dk)
  c.rect(6, 10, 12, 10, IRON)
  c.rect(5, 11, 14, 8, IRON)
  c.rect(6, 10, 12, 2, [176, 108, 52])
  c.rect(7, 12, 3, 4, [104, 110, 126])
  c.rect(15, 12, 3, 7, [44, 48, 60])
  return outline(c)
}
/** A hearth: a ring of stones round its ash, three logs stacked for the flame. */
function hearth(): Cv {
  const c = new Cv(46, 13)
  // ash and embers inside the ring
  for (let y = 3; y < 12; y++)
    for (let x = 4; x < 42; x++) {
      const dx = (x - 23) / 19
      const dy = (y - 7.5) / 4.5
      if (dx * dx + dy * dy < 1) c.px(x, y, (x + y) % 5 ? [70, 60, 58] : [140, 70, 40])
    }
  const log = (x: number, y: number, w: number) => {
    c.rect(x, y, w, 3, WD.dk)
    c.rect(x, y, w, 1, WD.md)
    c.rect(x + w - 2, y, 2, 3, WD.hi)
    c.px(x + w - 1, y + 1, WD.md)
  }
  log(10, 7, 13)
  log(23, 7, 13)
  log(16, 4, 14)
  const stones: [number, number][] = []
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    stones.push([Math.round(23 + Math.cos(a) * 20), Math.round(7 + Math.sin(a) * 4.5)])
  }
  for (const [sx, sy] of stones.sort((a, b) => a[1] - b[1])) {
    c.rect(sx - 2, sy - 1, 5, 3, STONE.md)
    c.rect(sx - 2, sy - 1, 3, 1, STONE.hi)
    c.rect(sx - 2, sy + 1, 5, 1, STONE.dk)
  }
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
/** A crate of planks, a brace across it: lit top and left. */
function crate(w = 22, h = 18): Cv {
  const c = new Cv(w, h)
  c.rect(0, 0, w, h, WD.md)
  c.rect(0, 0, w, 2, WD.hi)
  c.rect(0, h - 2, w, 2, WD.dk)
  for (let y = 5; y < h - 2; y += 5) c.rect(2, y, w - 4, 1, WD.dk)
  for (let i = 0; i < Math.min(w, h) - 2; i++) {
    c.px(2 + Math.round((i * (w - 4)) / (h - 4)), h - 2 - i, WD.dk)
    c.px(3 + Math.round((i * (w - 4)) / (h - 4)), h - 2 - i, WD.lt)
  }
  c.rect(0, 0, 2, h, WD.lt)
  c.rect(w - 2, 0, 2, h, WD.dk)
  return outline(c)
}
/** A barrel: staves in the wood ramp, two iron hoops, its lid. */
function barrel(): Cv {
  const c = new Cv(18, 22)
  for (let y = 0; y < 22; y++) {
    const inset = y < 2 || y > 19 ? 2 : y < 4 || y > 17 ? 1 : 0
    for (let x = inset; x < 18 - inset; x++) c.px(x, y, x < 5 ? WD.lt : x > 12 ? WD.dk : WD.md)
    for (const x of [6, 11]) if (x >= inset && x < 18 - inset) c.px(x, y, WD.dk)
  }
  c.rect(2, 0, 14, 3, WD.hi)
  c.rect(4, 1, 10, 1, WD.md)
  for (const y of [5, 15]) {
    c.rect(0, y, 18, 2, STONE.dk)
    c.rect(1, y, 4, 1, STONE.lt)
  }
  return outline(c)
}
/** A rack of arms: a sword, a spear and a sword or an axe, stood between two bars. */
function rack(axe = false): Cv {
  const c = new Cv(30, 32)
  const sword = (x: number, top: number) => {
    c.px(x, top, STONE.hi)
    c.rect(x, top + 1, 1, 15, STONE.hi)
    c.rect(x + 1, top + 1, 1, 15, STONE.lt)
    c.rect(x - 2, top + 16, 6, 2, GOLD)
    c.rect(x, top + 18, 2, 5, WD.dk)
    c.rect(x, top + 23, 2, 2, GOLD)
  }
  sword(5, 2)
  // the spear
  c.rect(14, 0, 2, 1, STONE.hi)
  c.rect(13, 1, 4, 3, STONE.lt)
  c.rect(13, 1, 2, 3, STONE.hi)
  c.rect(14, 4, 2, 1, STONE.md)
  c.rect(14, 5, 1, 27, WD.lt)
  c.rect(15, 5, 1, 27, WD.dk)
  if (axe) {
    c.rect(23, 3, 1, 29, WD.lt)
    c.rect(24, 3, 1, 29, WD.dk)
    c.rect(25, 4, 4, 7, STONE.md)
    c.rect(25, 4, 4, 2, STONE.hi)
    c.rect(28, 4, 1, 7, STONE.hi)
  } else sword(23, 4)
  for (const x of [0, 28]) {
    c.rect(x, 10, 2, 22, WD.md)
    c.rect(x, 10, 1, 22, WD.lt)
  }
  for (const y of [13, 27]) {
    c.rect(0, y, 30, 2, WD.md)
    c.rect(0, y, 30, 1, WD.hi)
  }
  return outline(c)
}
/** A helm on the counter: an iron dome with its slit and a red crest. */
function helm(): Cv {
  const c = new Cv(14, 12)
  for (let y = 2; y < 10; y++)
    for (let x = 1; x < 13; x++) {
      const dx = (x - 6.5) / 6
      const dy = (y - 9) / 7
      if (dx * dx + dy * dy < 1) c.px(x, y, x < 5 ? STONE.lt : x > 9 ? STONE.dk : STONE.md)
    }
  c.rect(3, 3, 3, 1, STONE.hi)
  c.rect(3, 6, 8, 1, STONE.sh)
  c.rect(6, 7, 2, 3, STONE.sh)
  c.rect(5, 0, 4, 2, RED)
  c.rect(1, 10, 12, 2, STONE.dk)
  return outline(c)
}
/** A heater shield hung on the stall's post: quartered, iron-rimmed, lit left. */
function shield([a, b]: [RGB, RGB]): Cv {
  const c = new Cv(14, 17)
  for (let y = 0; y < 17; y++) {
    const inset = y < 10 ? 0 : Math.round(((y - 10) / 7) * 6)
    for (let x = inset; x < 14 - inset; x++) {
      const q = (x < 7) === (y < 8)
      c.px(x, y, q ? a : b)
    }
  }
  for (let y = 0; y < 17; y++) {
    const inset = y < 10 ? 0 : Math.round(((y - 10) / 7) * 6)
    c.px(inset, y, STONE.lt)
    c.px(13 - inset, y, STONE.dk)
  }
  c.rect(0, 0, 14, 1, STONE.hi)
  c.rect(6, 6, 2, 2, GOLD)
  return outline(c)
}
/** A straw man on a post for the yard's drill: a sack body, a stuffed head, a red sash. */
function dummy(): Cv {
  // A man's height beside the pawns (59 px): a stuffed head, a sack body on a crossbar.
  const c = new Cv(30, 54)
  const STRAW: RGB = [226, 200, 120]
  c.rect(14, 18, 3, 36, WD.md)
  c.rect(14, 18, 1, 36, WD.lt)
  c.rect(16, 18, 1, 36, WD.dk)
  c.rect(1, 22, 28, 3, WD.md)
  c.rect(1, 22, 28, 1, WD.lt)
  c.rect(1, 24, 28, 1, WD.dk)
  for (let y = 19; y < 40; y++) {
    const inset = y < 21 || y > 37 ? 1 : 0
    for (let x = 7 + inset; x < 24 - inset; x++) c.px(x, y, x < 11 ? BURLAP.lt : x > 19 ? BURLAP.dk : BURLAP.md)
  }
  c.rect(7, 30, 17, 2, BURLAP.dk)
  for (let y = 2; y < 18; y++)
    for (let x = 7; x < 24; x++) {
      const dx = (x - 15.5) / 7.5
      const dy = (y - 9.5) / 7.5
      if (dx * dx + dy * dy < 1) c.px(x, y, x < 11 && y < 10 ? BURLAP.hi : x > 20 || y > 15 ? BURLAP.md : BURLAP.lt)
    }
  for (const [x, y] of [[10, 1], [14, 0], [18, 1], [21, 2], [0, 21], [0, 24], [29, 22], [29, 25], [9, 40], [13, 41], [19, 41], [22, 40]] as const) c.px(x, y, STRAW)
  // a red sash across the sack, and the stitched eyes the drill aims at
  for (let i = 0; i < 17; i++) {
    c.px(7 + i, 20 + Math.round(i * 0.95), RED)
    c.px(7 + i, 21 + Math.round(i * 0.95), darker(RED, 0.2))
  }
  c.rect(12, 8, 2, 2, [92, 70, 44])
  c.rect(18, 8, 2, 2, [92, 70, 44])
  c.rect(14, 13, 4, 1, [138, 102, 64])
  return outline(c)
}

// ------------------------------------------------------------- the ground

/** A fixed hash of a cell: the same blob every bake, no RNG. */
function hash2(x: number, y: number, s: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1013904223)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
/** Smooth value noise in [0, 1): blobs about `cell` pixels across. */
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
/** Swap colours pixel for pixel: a palette swap keeps the art's own shapes. */
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
/**
 * The meadow's tonal patches: the grass tile tiles every 64 px, and a scene of
 * it alone shows the repeat. Blobs of the tile's own darker and lighter greens
 * (its four colours, swapped a step) break it, as the battlefield's patches do.
 */
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
/**
 * Trodden earth: the pack's sand tile re-inked in a warm earth ramp, pixel for
 * pixel (Tiny Swords' yellow sand is its beach, and a stall on a beach read as
 * one). The battle road is dirt; a stop is a patch of the same road.
 */
const EARTH = new Map<number, RGB>([
  [key(254, 250, 157), [230, 204, 152]],
  [key(248, 242, 115), [216, 186, 132]],
  [key(241, 218, 132), [200, 168, 118]],
  [key(222, 200, 126), [180, 148, 104]],
  [key(178, 150, 120), [142, 110, 80]],
])
const EARTH_RIM: RGB = [142, 110, 80]
const EARTH_DEEP: RGB = [120, 92, 66]
/**
 * A yard of trodden earth: an ellipse with a noisy edge (never a tile's
 * straight one), its rim inked a step darker and nicked by grass blades, the
 * way the pack's own sand meets its grass.
 */
function yard(c: Cv, earth: Cv, cx: number, cy: number, rx: number, ry: number, seed: number): void {
  const inside = (x: number, y: number) => {
    const dx = (x - c.ox - cx) / rx
    const dy = (y - cy) / ry
    return Math.sqrt(dx * dx + dy * dy) + (vnoise(x, y, 11, seed) - 0.5) * 0.28 < 1
  }
  const m = new Uint8Array(c.w * c.h)
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) m[y * c.w + x] = inside(x, y) ? 1 : 0
  const at = (x: number, y: number) => x < 0 || y < 0 || x >= c.w || y >= c.h || m[y * c.w + x] === 1
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      if (!m[y * c.w + x]) continue
      const k = ((y % earth.h) * earth.w + (x % earth.w)) * 4
      const rim = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1)
      c.px(x, y, rim ? EARTH_RIM : [earth.d[k], earth.d[k + 1], earth.d[k + 2]])
    }
  // Grass blades over the rim, from the side the grass is on.
  for (let y = 1; y < c.h - 2; y++)
    for (let x = 1; x < c.w - 1; x++) {
      if (!m[y * c.w + x] || at(x, y - 1)) continue
      if (hash2(x, y, seed + 3) < 0.22) {
        c.px(x, y, [121, 168, 99])
        c.px(x, y + 1, [103, 145, 117])
      }
    }
}

// ------------------------------------------------------------- the scenes

type Pt = readonly [number, number]
interface Anchors {
  /** The keeper's face: the speech bubble's tail points here. */
  speaker: Pt
  /** The merchant's raised hands: the focused ware is held up here. */
  held?: Pt
  /** The fire's feet: the animated flame stands here. */
  fire?: Pt
  /** A tall speaker: the bubble hangs beside the face, never over the plume. */
  beside?: true
}

/**
 * `--faces <dir>`: every post bakes with its company's face at the counter in
 * place of the CC0 pawn (the review cards), and only the posts are written,
 * only into <dir>. The face stands as the pawn does: feet on the post's floor,
 * turned as the pawn is turned.
 */
const fi = process.argv.indexOf('--faces')
const FACES_DIR = fi > 0 ? resolve(process.argv[fi + 1] ?? 'faces') : null
function faceOr(id: PersonaId, pawn: Cv, turned: boolean): Cv {
  if (!FACES_DIR) return pawn
  const f = postFrame(id, 'idle', 0)
  const c = new Cv(f.w, f.h)
  c.d.set(f.rgba)
  return turned ? flip(trim(c)) : trim(c)
}

async function bake(proposals: string | null): Promise<Record<string, Anchors>> {
  const flat = await load(P.flat)
  const grass = crop(flat, 64, 64, 64, 64)
  const earth = crop(flat, 384, 64, 64, 64)
  swap(earth, EARTH, () => true)
  const meadow = (c: Cv, seed: number) => {
    c.tile(grass, -c.ox, 0, c.w, c.h)
    patches(c, seed)
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
  /** Stand a drawn prop on the ground: its shadow first (the pack's units carry their own). */
  const stand = (c: Cv, s: Cv, cx: number, by: number, sw = Math.round(s.w * 0.9)) => {
    c.put(shadow(sw, 5, 64), cx, by + 2)
    return c.put(s, cx, by)
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

  // ---- the merchant: a kit stall in front of a cottage — a rack of blades, a
  // helm and a shield on its counter — and the clerk's hands raised for the
  // ware you look at.
  {
    const c = scene()
    meadow(c, 11)
    yard(c, earth, 130, 128, 150, 36, 12)
    await wings(c, 'day')
    c.put(await tree(0), 22, 82)
    c.put(await tree(3), 238, 78)
    c.put(trim(await load(P.house)), 54, 92)
    c.put(await tree(2), 262, 112)
    const w = 136
    const ox = 130 - w / 2
    const feet = 132
    const clerk = await carry('Yellow')
    c.draw(post(86), ox + 2, 52)
    c.draw(post(86), ox + w - 7, 52)
    c.put(clerk, 130, feet)
    c.draw(counter(w, 24, [RED, CREAM]), ox, 116)
    c.draw(awning(w + 8), ox - 4, 46)
    c.put(rack(), ox + 22, 117)
    c.put(helm(), ox + w - 30, 117)
    c.put(shield([RED, CREAM]), ox + w - 3, 104)
    stand(c, barrel(), 46, 140)
    stand(c, barrel(), 30, 146)
    stand(c, crate(), 212, 142)
    c.put(crate(18, 15), 214, 125)
    c.put(await deco(10), 196, 148)
    // The clerk's face, under the hat's brim; the ware sits in the raised hands.
    out.merchant = { speaker: [OX + 130, feet - clerk.h + 2], held: [OX + 130, feet - clerk.h + 9] }
    await write('merchant', c)
  }

  // ---- the campfire: night in a clearing, the fire on its hearth, the cook at
  // the pot, a sentry standing guard.
  {
    const c = scene()
    meadow(c, 21)
    yard(c, earth, 124, 128, 106, 28, 22)
    await wings(c, 'wood')
    c.put(await tree(0), 18, 98)
    c.put(await tree(3), 246, 92)
    c.put(await tree(2), 198, 54)
    c.put(await tree(1), 68, 48)
    stand(c, tent(70, 56, [214, 196, 152], [150, 126, 92]), -8, 104)
    const fx = 120
    const fy = 126
    c.put(trim(crop(await load(P.tree), 0, 384, 192, 192)), 26, 146)
    c.put(await idle(P.warrior('Blue')), 50, 134)
    c.put(flip(trim(await load('Resources/Resources/W_Idle.png'))), 84, 146)
    stand(c, spit(), 160, fy + 2, 24)
    const cook = flip(await idle(P.pawn('Red')))
    c.put(cook, 198, fy + 4)
    stand(c, bedroll(), 240, 142)
    c.put(await deco(10), 212, 150)
    c.put(shadow(44, 10, 90), fx, fy + 4)
    c.put(hearth(), fx, fy + 3)
    multiply(c, [78, 88, 150])
    light(c, OX + fx, fy - 18, 130, [255, 150, 60], 1.6, 0.8)
    vignette(c, 0.5)
    c.put(fireFrame, fx, fy)
    out.campfire = { speaker: [OX + 198, fy + 4 - cook.h + 4], fire: [OX + fx, fy] }
    await write('campfire', c)
  }

  // ---- the shrine: standing stones on worn flagstones at dusk, the keeper
  // raising an offering.
  {
    const c = scene()
    meadow(c, 31)
    await wings(c, 'wood')
    c.put(await tree(0), 22, 92)
    c.put(await tree(2), 240, 88)
    c.put(await tree(1), 60, 54)
    c.put(await tree(3), 204, 48)
    c.put(await tree(0), 132, 30)
    const sx = 126
    const sy = 116
    flagstones(c, sx, sy + 2, 64, 14, 32)
    c.put(monolith(18, 36, false), sx - 48, sy - 16)
    c.put(monolith(16, 30, false), sx + 32, sy - 24)
    c.put(monolith(30, 62, true), sx, sy - 10)
    c.put(slab(44, 12), sx, sy + 2)
    c.put(candle(6), sx - 16, sy - 9)
    c.put(candle(4), sx - 10, sy - 9)
    c.put(candle(5), sx + 14, sy - 9)
    for (const [x, y] of [[sx - 6, sy + 16], [sx + 6, sy + 24], [sx - 2, sy + 32]] as const) c.put(steppingStone(), x, y)
    const keeper = flip(await carry('Purple'))
    c.put(keeper, sx + 66, sy + 22)
    c.put(await deco(1), 64, 146)
    c.put(await deco(1), 214, 142)
    c.put(await deco(2), 50, 142)
    c.put(await deco(10), 30, 150)
    c.put(await deco(11), 236, 150)
    multiply(c, [130, 120, 190])
    light(c, OX + sx, sy - 44, 80, [120, 230, 240], 1.0)
    light(c, OX + sx, sy - 8, 44, [255, 190, 90], 0.8)
    vignette(c, 0.4)
    out.shrine = { speaker: [OX + sx + 66, sy + 22 - keeper.h + 2] }
    await write('shrine', c)
  }

  // ---- the hiring yard: a city's drill yard by its watchtower — a rack of
  // arms, a straw man, a hand already hired at practice — and the sergeant
  // out front. (No flag: the page's sign is the yard's pennant.)
  {
    const c = scene()
    meadow(c, 41)
    yard(c, earth, 128, 124, 160, 40, 42)
    await wings(c, 'day')
    c.put(await tree(1), 12, 88)
    c.put(await tree(0), 120, 32)
    c.put(await tree(2), 224, 76)
    c.put(trim(await load(P.tower)), 266, 98)
    stand(c, tent(84, 64, [222, 204, 160], [168, 138, 98], RED), 2, 104)
    stand(c, rack(true), 46, 124)
    stand(c, barrel(), 30, 138)
    stand(c, dummy(), 156, 128)
    c.put(flip(await idle(P.archer)), 210, 136)
    const sarge = await idle(P.warrior('Red'))
    c.put(sarge, 100, 142)
    stand(c, crate(), 64, 146)
    c.put(await deco(10), 238, 148)
    c.put(await deco(10), 130, 150)
    // The sergeant's face under the plume: the bubble beside it, below the sign.
    out.recruit = { speaker: [OX + 100, 142 - sarge.h + 24], beside: true }
    await write('recruit', c)
  }

  // ---- the liaisons' posts (Draft 4 · D): each company's own stall on its
  // own land, its standard on a pole to the left, its liaison behind the
  // counter. Every post keeps one layout, so a city's band crops them alike:
  // the liaison's head at y ≈ 70, the counter from y 108, the bubble's room to
  // the right of the head (rows 40–80), the land behind and beside the stall.
  const LX = 110
  const FEET = 130
  const liaisonPost = async (name: string, fig: Cv, draw: (c: Cv, top: number) => Promise<void>, lit?: (c: Cv) => void, dir = OUT) => {
    const c = scene()
    const top = FEET - fig.h
    await draw(c, top)
    if (lit) lit(c)
    // The speaker's mouth level, not a plume's tip: the bubble's tail points at the face.
    if (dir === OUT) out[name] = { speaker: [OX + LX, Math.max(top, FEET - 60)] }
    await write(name, c, dir)
  }
  const flagAt = (c: Cv, company: CompanyId, x = 50) => stand(c, standard(company, 30), x, FEET + 2, 10)
  const cloth = (company: CompanyId): [RGB, RGB] => {
    const k = hex(companyById(company).color)
    return [k, darker(k, 0.3)]
  }

  // Peppercorn Co. — Saffra's spice stall at the edge of its fields: chili
  // rows behind, a charred strip where last summer's burn ran, sacks of spice
  // and a brazier (the burning road).
  {
    const fig = faceOr('saffra', await idle(P.pawn('Red')), false)
    await liaisonPost(
      'liaison-spice',
      fig,
      async (c, top) => {
        meadow(c, 51)
        field(c, earth, 60, 98, 53)
        yard(c, earth, 120, 132, 160, 30, 52)
        await wings(c, 'day')
        c.put(await tree(1), 2, 62)
        c.put(await tree(3), 250, 58)
        c.put(trim(await load(P.house)), -30, 72)
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
        stand(c, sack([226, 196, 70], 18), 176, 140)
        stand(c, sack([214, 72, 44], 18), 192, 147)
        stand(c, brazier(), 212, 136, 16)
        c.put(half(fireFrame), 212, 114)
        c.put(await deco(10), 18, 148)
      },
      (c) => {
        multiply(c, [255, 236, 212])
        light(c, OX + 212, 110, 46, [255, 150, 60], 1.1)
      },
    )
  }

  // Easel House — Vell's canal gallery: a lavender tent, an easel and framed
  // canvases, the canal at the bank's foot. (The slot becomes Butcherblock's:
  // its smokehouse is a proposal, `--proposals`.)
  {
    const fig = flip(await idle(P.pawn('Purple')))
    await liaisonPost('liaison-art', fig, async (c, top) => {
      meadow(c, 61)
      yard(c, earth, 120, 118, 150, 22, 62)
      await wings(c, 'day')
      c.put(await tree(2), 12, 70)
      c.put(await tree(0), 246, 66)
      c.put(await tree(1), 196, 30)
      const lav = hex(companyById('art').color)
      c.put(tent(84, 58, mix(lav, CREAM, 0.35), darker(lav, 0.25)), LX + 6, top + 6)
      flagAt(c, 'art')
      c.put(fig, LX, FEET)
      c.draw(counter(100, 24, cloth('art')), LX - 48, 108)
      c.put(painting(16, 14, 0), LX - 28, 110)
      c.put(painting(12, 16, 1), LX + 28, 110)
      stand(c, easel(), 188, 134, 18)
      stand(c, painting(18, 14, 2), 214, 136)
      stand(c, crate(), 220, 147)
      c.draw(canal(), -OX, 136)
    })
  }

  // Ironvein — Brannoch's ore yard at the foot of its quarry: the cut cliff
  // behind with a timbered adit and a cart of ore on its rails, a stone
  // counter, ore heaps and an anvil in its forge glow.
  {
    const fig = faceOr('brannoch', await idle(P.warrior('Blue')), false)
    await liaisonPost(
      'liaison-metals',
      fig,
      async (c, top) => {
        meadow(c, 71)
        await quarry(c, 102)
        yard(c, earth, 120, 128, 170, 34, 72)
        await wings(c, 'wood')
        c.put(await tree(1), -4, 74)
        c.put(await tree(3), 262, 76)
        c.put(adit(), 206, 104)
        c.put(rails(46), 210, 116)
        stand(c, oreCart(), 220, 116, 24)
        c.put(await deco(5), 160, 104)
        c.put(await deco(4), 248, 106)
        flagAt(c, 'metals')
        // A lean-to over the counter, slate and the company's blue.
        c.draw(post(80), LX - 54, top - 12)
        c.draw(post(80), LX + 49, top - 12)
        c.put(fig, LX, FEET)
        c.draw(stoneCounter(104, 24), LX - 52, 108)
        c.draw(awning(116, 12, hex(companyById('metals').color), STONE.md), LX - 58, top - 24)
        c.put(oreHeap(26, 12, [120, 176, 255]), LX - 28, 111)
        c.put(oreHeap(20, 10, [246, 206, 96]), LX + 30, 111)
        stand(c, forge(), 166, 140, 24)
        stand(c, anvil(), 196, 146, 26)
        stand(c, oreHeap(30, 14, [96, 150, 236]), 222, 148)
        stand(c, crate(), 22, 142)
        c.put(await deco(9), 252, 150)
      },
      (c) => {
        multiply(c, [214, 222, 236])
        light(c, OX + 166, 126, 36, [255, 140, 60], 0.75)
      },
    )
  }

  // Rosethread — Odile's silk stall by the ford: the river behind with its
  // stepping stones, reeds on the bank, bolts hung on a line and a loom.
  {
    const fig = faceOr('odile', await idle(P.pawn('Yellow')), false)
    await liaisonPost('liaison-silk', fig, async (c, top) => {
      meadow(c, 81)
      await river(c, 66, 22)
      yard(c, earth, 120, 130, 160, 30, 82)
      await wings(c, 'day')
      c.put(await tree(3), 4, 66)
      c.put(await tree(2), 254, 64)
      c.put(await tree(0), 150, 48)
      c.put(await tree(1), 40, 46)
      for (const x of [-20, 30, 168, 238, 290]) c.draw(reeds(), x, 76)
      flagAt(c, 'silk')
      const rose = hex(companyById('silk').color)
      const line = top - 16
      c.draw(post(48), LX - 52, line - 2)
      c.draw(post(48), LX + 47, line - 2)
      c.rect(OX + LX - 50, line, 98, 1, WD.dk)
      const hung: RGB[] = [rose, CREAM, [196, 74, 96], GOLD, mix(rose, CREAM, 0.5), [150, 70, 120]]
      hung.forEach((k, i) => c.draw(drape(13, 22 + ((i * 7) % 9), k), LX - 46 + i * 16, line + 1))
      c.put(fig, LX, FEET)
      c.draw(counter(100, 24, [mix(rose, CREAM, 0.3), rose]), LX - 48, 108)
      c.put(bolts([rose, CREAM, GOLD]), LX - 26, 110)
      c.put(bolts([[196, 74, 96], mix(rose, CREAM, 0.5)]), LX + 30, 110)
      stand(c, loom(rose), 196, 138, 30)
      stand(c, bolts([CREAM, rose, [150, 70, 120]]), 226, 146)
      c.put(await deco(10), 22, 148)
    })
  }

  // Moonquill — Wren's scriptorium by night: a rack of sealed scrolls, a
  // lectern with the open ledger, candles and a warded stone. (The slot
  // becomes Greenvial's: its glasshouse is a proposal, `--proposals`.)
  {
    const fig = flip(await idle(P.pawn('Blue')))
    await liaisonPost(
      'liaison-scrolls',
      fig,
      async (c, top) => {
        meadow(c, 91)
        await wings(c, 'wood')
        c.put(await tree(0), 18, 70)
        c.put(await tree(2), 248, 72)
        c.put(await tree(1), 60, 32)
        c.put(await tree(3), 200, 28)
        stand(c, scrollRack(72, 48), LX, top + 18, 64)
        flagAt(c, 'scrolls')
        c.put(fig, LX, FEET)
        c.draw(counter(100, 24, cloth('scrolls')), LX - 48, 108)
        c.put(ledger(), LX - 20, 110)
        c.put(candle(7), LX + 20, 110)
        c.put(candle(5), LX + 26, 110)
        c.put(candle(6), LX + 38, 110)
        stand(c, monolith(20, 40, true), 200, 140, 18)
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

  // ---- PROPOSALS (not shipped): the posts of the two companies that take
  // Easel House's and Moonquill's slots, for the designer's review cards. The
  // person at the counter is the slot's current one: a character is being
  // drawn for each on the new rig, so the post leaves the same room for them.
  if (proposals) {
    // Butcherblock — the smokehouse on the salt marsh: a reed channel behind
    // with its jetty, a plank smokehouse breathing smoke, meat on hooks, salt
    // sacks, and a butcher's block for a counter.
    const marshFig = faceOr('hask', flip(await idle(P.pawn('Purple'))), true)
    await liaisonPost(
      'proposal-butcherblock',
      marshFig,
      async (c, top) => {
        meadow(c, 101)
        await river(c, 82, 20, true)
        yard(c, earth, 120, 136, 160, 26, 102)
        await wings(c, 'day')
        c.put(await tree(2), 0, 70)
        c.put(await tree(0), 262, 66)
        for (const x of [-30, 10, 52, 150, 236, 270]) c.draw(reeds(), x, 86)
        c.draw(jetty(), 196, 98)
        stand(c, smokehouse(), 190, 112, 60)
        c.put(smoke(), 198, 58)
        stand(c, pennant([118, 84, 60], [214, 196, 152], 'cleaver'), 50, FEET + 2, 10)
        c.draw(post(56), LX - 52, top - 14)
        c.draw(post(56), LX + 47, top - 14)
        c.rect(OX + LX - 50, top - 10, 98, 2, WD.dk)
        const meat = trim(await load('Resources/Resources/M_Idle.png'))
        for (const x of [LX - 36, LX + 26]) {
          c.rect(OX + x, top - 9, 1, 10, IRON)
          c.put(half(meat), x, top + 12)
        }
        c.put(marshFig, LX, FEET)
        c.draw(butcherBlock(104, 24), LX - 52, 108)
        c.put(cleaver(), LX + 30, 109)
        c.put(sack([244, 240, 228], 14), LX - 30, 112)
        stand(c, sack([244, 240, 228], 18), 214, 142)
        stand(c, sack([236, 232, 220], 18), 230, 148)
        c.put(await deco(14), 196, 146)
        c.put(await deco(15), 30, 148)
      },
      (c) => {
        multiply(c, [222, 226, 214])
        mist(c, 76, 92)
      },
      proposals,
    )
    // Greenvial — the glasshouse in a hidden garden: a glasshouse behind
    // the stall, vines up its posts, potions on the counter, mushrooms in the
    // hollow, spores glowing at dusk.
    const gardenFig = faceOr('wren', flip(await idle(P.pawn('Blue'))), true)
    await liaisonPost(
      'proposal-greenvial',
      gardenFig,
      async (c, top) => {
        meadow(c, 111)
        yard(c, earth, 120, 132, 150, 26, 112)
        await wings(c, 'wood')
        c.put(await tree(0), 4, 70)
        c.put(await tree(2), 258, 68)
        stand(c, glasshouse(), 208, 118, 80)
        stand(c, pennant([96, 150, 92], [236, 226, 170], 'vial'), 50, FEET + 2, 10)
        c.draw(vined(post(56)), LX - 52, top - 14)
        c.draw(vined(post(56)), LX + 47, top - 14)
        c.draw(awning(110, 12, [96, 150, 92], [236, 226, 170]), LX - 55, top - 26)
        c.put(gardenFig, LX, FEET)
        c.draw(counter(100, 24, [[96, 150, 92], [64, 108, 70]]), LX - 48, 108)
        for (const [x, k] of [[-30, 0], [-20, 1], [-10, 2], [22, 1], [32, 0]] as const) c.put(vial(k), LX + x, 110)
        for (const [x, y, n] of [[170, 146, 2], [184, 148, 1], [226, 142, 2], [252, 146, 3], [30, 148, 2], [44, 150, 1]] as const) c.put(await deco(n), x, y)
      },
      (c) => {
        multiply(c, [176, 196, 176])
        for (const [x, y, r] of [[176, 134, 8], [228, 128, 8], [36, 136, 7], [150, 96, 5], [232, 84, 5], [92, 58, 4], [196, 70, 4]] as const) light(c, OX + x, y, r * 3, [200, 255, 140], 0.9)
        vignette(c, 0.3)
      },
      proposals,
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
/** A sack, open at its neck on its goods (spice, salt): `n` pixels across. */
function sack(spice: RGB, n = 14): Cv {
  const c = new Cv(n, n)
  const neck = Math.round(n * 0.3)
  for (let y = neck; y < n; y++) {
    const inset = y < neck + 2 || y > n - 2 ? 1 : 0
    for (let x = inset; x < n - inset; x++) c.px(x, y, x < n * 0.28 ? BURLAP.lt : x > n * 0.75 ? BURLAP.dk : BURLAP.md)
  }
  c.rect(0, neck, n, 2, BURLAP.hi)
  const mid = n / 2
  const tops = [0.15, 0.3, 0.38, 0.45].map((t) => Math.round(t * n))
  for (let y = 0; y < neck; y++) {
    const r = tops[Math.min(3, Math.round((y / Math.max(1, neck - 1)) * 3))]
    for (let x = Math.round(mid - r); x < Math.round(mid + r); x++) c.px(x, y + 1, y === 0 ? mix(spice, [255, 255, 255], 0.35) : x < mid ? spice : darker(spice, 0.18))
  }
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
/** A standing iron brazier, coals glowing in its bowl. */
function brazier(): Cv {
  const c = new Cv(20, 24)
  c.rect(0, 0, 20, 6, IRON)
  c.rect(1, 0, 18, 1, [120, 128, 146])
  c.rect(2, 1, 16, 2, [255, 170, 70])
  c.rect(4, 2, 4, 1, [255, 226, 120])
  c.rect(1, 5, 18, 1, [44, 48, 60])
  c.rect(4, 6, 2, 18, IRON)
  c.rect(14, 6, 2, 18, [44, 48, 60])
  c.rect(4, 6, 1, 18, [104, 110, 126])
  c.rect(6, 14, 8, 2, IRON)
  c.rect(2, 22, 4, 2, IRON)
  c.rect(14, 22, 4, 2, IRON)
  return outline(c)
}
/** The spice field behind Peppercorn's stall: tilled rows of chili plants, and a strip the summer burn ran through. */
function field(c: Cv, earth: Cv, y0: number, y1: number, seed: number): void {
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < c.w; x++) {
      const lx = x - c.ox
      const edge = y0 + Math.round((vnoise(x, 0, 14, seed) - 0.5) * 6)
      if (y < edge) continue
      const k = ((y % earth.h) * earth.w + (x % earth.w)) * 4
      const furrow = (y - y0) % 7 === 6
      const burnt = lx > 150 && lx < 270 && vnoise(x, y, 9, seed + 5) > 0.35
      let col: RGB = [earth.d[k], earth.d[k + 1], earth.d[k + 2]]
      if (furrow) col = EARTH_DEEP
      if (burnt) col = darker(col, furrow ? 0.55 : 0.42)
      c.px(x, y, y === edge ? EARTH_RIM : col)
    }
  // The plants, row by row, the far rows smaller: a green bush, red and amber
  // pods; charred stalks in the burn. Earth shows between them: a field, not a hedge.
  for (let y = y0 + 6, row = 0; y < y1; y += 8, row++)
    for (let lx = -OX; lx < c.w - OX; lx += 15) {
      const px = lx + Math.round(hash2(lx, y, seed) * 6) + (row % 2) * 7
      const far = y - y0 < 16
      const burnt = px > 150 && px < 270 && vnoise(px + OX, y, 9, seed + 5) > 0.35
      const plant = new Cv(far ? 6 : 9, far ? 5 : 8)
      if (burnt) {
        const CHAR: RGB = [44, 36, 34]
        plant.rect(far ? 2 : 4, far ? 1 : 2, 1, far ? 4 : 6, CHAR)
        plant.rect(far ? 1 : 2, far ? 2 : 4, 2, 1, CHAR)
        if (hash2(px, y, seed + 9) < 0.4) plant.px(far ? 3 : 5, far ? 1 : 2, [255, 150, 60])
      } else if (far) {
        plant.rect(0, 1, 6, 3, LEAF.md)
        plant.rect(1, 0, 4, 1, LEAF.md)
        plant.rect(0, 1, 2, 1, LEAF.lt)
        plant.rect(3, 3, 3, 1, LEAF.dk)
        plant.px(2, 4, LEAF.dk)
        plant.px(1, 2, [214, 60, 44])
        plant.px(4, 1, [236, 160, 52])
      } else {
        plant.rect(1, 2, 7, 5, LEAF.md)
        plant.rect(2, 1, 5, 1, LEAF.md)
        plant.rect(1, 2, 3, 2, LEAF.lt)
        plant.rect(5, 5, 3, 2, LEAF.dk)
        plant.rect(4, 7, 1, 1, LEAF.dk)
        for (const [ax, ay, k] of [[2, 4, 0], [5, 3, 1], [6, 5, 0]] as const) plant.rect(ax, ay, 1, 2, k ? [236, 160, 52] : [214, 60, 44])
      }
      c.put(outline(plant), px, y + 1)
    }
}
/** The quarry: the pack's cliff — a plateau's foot and its cut face — across the whole back, its foot at `foot`. */
async function quarry(c: Cv, foot: number): Promise<void> {
  const face = crop(await load('Terrain/Ground/Tilemap_Elevation.png'), 64, 150, 64, 106)
  for (let x = -c.ox - 64; x < c.w; x += 64) c.draw(face, x, foot - face.h)
  // a shadow at its foot, where the yard meets the rock
  for (let x = 0; x < c.w; x++) for (let y = foot; y < foot + 3; y++) c.px(x, y, [22, 28, 46, 70 - (y - foot) * 20])
}
/** A mine's adit cut into the cliff: a timber frame round the dark. */
function adit(): Cv {
  const c = new Cv(36, 38)
  for (let y = 4; y < 38; y++)
    for (let x = 5; x < 31; x++) {
      const arch = y < 9 ? Math.abs(x - 17.5) < 8 + (y - 4) * 2 : true
      if (arch) c.px(x, y, y < 14 ? [34, 28, 34] : y < 26 ? [44, 34, 38] : [58, 44, 44])
    }
  for (const x of [1, 31]) {
    c.rect(x, 4, 4, 34, WD.md)
    c.rect(x, 4, 1, 34, WD.lt)
    c.rect(x + 3, 4, 1, 34, WD.dk)
  }
  c.rect(0, 1, 36, 4, WD.md)
  c.rect(0, 1, 36, 1, WD.hi)
  c.rect(0, 4, 36, 1, WD.dk)
  return outline(c)
}
/** Two rails on their sleepers, running out of the adit. */
function rails(w: number): Cv {
  const c = new Cv(w, 6)
  for (let x = 0; x < w; x += 5) c.rect(x, 0, 2, 6, WD.dk)
  c.rect(0, 1, w, 1, STONE.lt)
  c.rect(0, 4, w, 1, STONE.md)
  return c
}
/** A cart of ore on the rails: plank box, iron bands, ore heaped with its veins. */
function oreCart(): Cv {
  const c = new Cv(28, 20)
  for (let y = 0; y < 7; y++)
    for (let x = 4; x < 24; x++) {
      const dx = (x - 14) / 10
      if (dx * dx + ((7 - y) / 7) ** 2 < 1) c.px(x, y, x < 10 ? STONE.lt : x > 19 ? STONE.dk : STONE.md)
    }
  for (const [x, y, k] of [[8, 4, 0], [13, 2, 1], [18, 5, 0], [11, 6, 1]] as const) c.px(x, y, k ? [246, 206, 96] : [120, 176, 255])
  for (let y = 6; y < 15; y++) {
    const inset = Math.round((y - 6) * 0.3)
    for (let x = inset; x < 28 - inset; x++) c.px(x, y, x < 6 ? WD.lt : x > 22 ? WD.dk : WD.md)
  }
  c.rect(0, 6, 28, 1, WD.hi)
  for (const x of [6, 20]) c.rect(x, 6, 2, 9, IRON)
  for (const wx of [7, 20]) {
    c.rect(wx - 2, 15, 5, 5, IRON)
    c.rect(wx - 1, 14, 3, 1, IRON)
    c.px(wx, 17, [140, 150, 170])
  }
  return outline(c)
}
/** A heap of ore: the stone ramp, with veins. */
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
/** A smith's forge: a stone hearth, its mouth full of coals, a hood over it. */
function forge(): Cv {
  const c = new Cv(24, 26)
  c.rect(6, 0, 12, 9, STONE.md)
  c.rect(6, 0, 3, 9, STONE.lt)
  c.rect(15, 0, 3, 9, STONE.dk)
  c.rect(2, 9, 20, 17, STONE.md)
  c.rect(2, 9, 20, 2, STONE.hi)
  c.rect(2, 9, 3, 17, STONE.lt)
  c.rect(19, 9, 3, 17, STONE.dk)
  for (let y = 14; y < 26; y += 4) c.rect(5, y, 14, 1, STONE.dk)
  c.rect(6, 14, 12, 7, [58, 36, 32])
  c.rect(7, 16, 10, 5, [214, 92, 44])
  c.rect(8, 17, 6, 3, [255, 170, 70])
  c.rect(9, 18, 3, 1, [255, 226, 120])
  return outline(c)
}
/** The forge's anvil on its wooden block. */
function anvil(): Cv {
  const c = new Cv(30, 20)
  c.rect(0, 0, 26, 5, IRON)
  c.rect(0, 0, 26, 1, [140, 150, 170])
  c.rect(20, 0, 10, 3, IRON)
  c.rect(20, 0, 10, 1, [140, 150, 170])
  c.rect(26, 3, 2, 1, IRON)
  c.rect(0, 4, 26, 1, [44, 48, 60])
  c.rect(8, 5, 12, 5, IRON)
  c.rect(8, 5, 2, 5, [104, 110, 126])
  c.rect(5, 10, 18, 10, WD.md)
  c.rect(5, 10, 18, 1, WD.hi)
  c.rect(5, 10, 3, 10, WD.lt)
  c.rect(20, 10, 3, 10, WD.dk)
  return outline(c)
}
/** The river across the back: the pack's water, its banks, ripples; a ford of stones if not murky (a marsh channel if it is). */
async function river(c: Cv, y: number, h: number, murky = false): Promise<void> {
  const water: RGB = murky ? [92, 140, 120] : [71, 171, 169]
  const ripple: RGB = murky ? [150, 184, 150] : [196, 240, 224]
  for (let yy = y; yy < y + h; yy++)
    for (let x = 0; x < c.w; x++) {
      const top = y + Math.round((vnoise(x, 0, 18, 5) - 0.5) * 4)
      const bot = y + h + Math.round((vnoise(x, 9, 18, 6) - 0.5) * 4)
      if (yy < top || yy > bot) continue
      let k: RGB = yy === top ? LEAF.dk : yy === bot ? EARTH_RIM : yy > bot - 2 ? darker(water, 0.12) : water
      if (yy > top + 1 && yy < bot - 2 && hash2(x >> 2, yy, 8) < 0.08) k = ripple
      c.px(x, yy, k)
    }
  if (murky) return
  const rock = trim(crop(await load('Terrain/Water/Rocks/Rocks_02.png'), 0, 0, 128, 128))
  for (const [x, dy] of [[150, 7], [170, 12], [190, 9], [210, 15]] as const) c.put(half(rock), x, y + dy)
}
/** Reeds on a bank: a clump of stems in the grass greens, shaded on their right, cattail heads inked. */
function reeds(): Cv {
  const c = new Cv(16, 24)
  for (const [x, h] of [[1, 15], [3, 21], [6, 17], [8, 23], [11, 14], [13, 19]] as const) {
    for (let y = 24 - h; y < 24; y++) {
      c.px(x, y, y > 24 - h + 6 ? LEAF.md : LEAF.lt)
      c.px(x + 1, y, LEAF.dk)
    }
    if (h > 16) {
      c.rect(x, 24 - h - 1, 2, 4, [124, 84, 52])
      c.px(x, 24 - h - 1, [150, 104, 64])
      c.px(x, 24 - h - 2, INK)
      c.px(x + 1, 24 - h - 2, INK)
      c.px(x - 1, 24 - h, INK)
      c.px(x + 2, 24 - h, INK)
    }
  }
  c.rect(0, 21, 16, 3, LEAF.dk)
  c.rect(1, 20, 14, 1, LEAF.md)
  return c
}
/** Rosethread's loom: its frame, the warp, cloth half woven, the shuttle. */
function loom(cloth: RGB): Cv {
  const c = new Cv(32, 36)
  for (const x of [1, 28]) {
    c.rect(x, 2, 3, 34, WD.md)
    c.rect(x, 2, 1, 34, WD.lt)
    c.rect(x + 2, 2, 1, 34, WD.dk)
  }
  c.rect(0, 2, 32, 3, WD.md)
  c.rect(0, 2, 32, 1, WD.hi)
  c.rect(0, 26, 32, 3, WD.md)
  c.rect(0, 26, 32, 1, WD.hi)
  for (let x = 5; x < 27; x += 2) c.rect(x, 5, 1, 12, x % 4 === 1 ? CREAM : mix(cloth, CREAM, 0.4))
  for (let y = 17; y < 26; y++) for (let x = 4; x < 28; x++) c.px(x, y, y % 3 === 0 ? darker(cloth, 0.18) : x < 9 ? mix(cloth, CREAM, 0.25) : cloth)
  c.rect(9, 15, 14, 2, WD.hi)
  c.rect(9, 16, 14, 1, WD.dk)
  c.rect(2, 34, 6, 2, WD.dk)
  c.rect(24, 34, 6, 2, WD.dk)
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
    c.rect(ix, iy, iw, ih, [126, 182, 222])
    c.rect(ix + iw - 4, iy + 1, 2, 2, [255, 226, 96])
    for (let x = 0; x < iw; x++) {
      const hh = Math.round(ih * 0.45 + Math.sin((x / iw) * Math.PI) * ih * 0.2)
      c.rect(ix + x, iy + ih - hh, 1, hh, x % 3 ? [96, 150, 80] : [80, 128, 66])
    }
  } else if (kind === 1) {
    c.rect(ix, iy, iw, ih, [96, 62, 92])
    const cx = ix + Math.floor(iw / 2)
    c.rect(cx - 2, iy + 2, 4, 5, [234, 196, 160])
    c.rect(cx - 2, iy + 1, 4, 1, [80, 50, 40])
    c.rect(ix + 1, iy + ih - 4, iw - 2, 4, [70, 100, 170])
  } else {
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
  c.rect(10, 4, w - 20, 6, [93, 139, 226])
  c.rect(10, 9, w - 20, 1, [58, 92, 168])
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

// ---- the proposals' props (Butcherblock, Greenvial): drawn for the review cards, never shipped

/** A pennant on its pole, swallow-tailed, with a drawn emblem: a proposal's standard (the real ones come from `companyStandard`). */
function pennant(cloth: RGB, trimK: RGB, emblem: 'cleaver' | 'vial'): Cv {
  const c = new Cv(20, 52)
  c.rect(0, 0, 2, 52, WD.dk)
  c.rect(0, 0, 1, 52, WD.md)
  // the cloth, its tail cut in a swallow's V
  for (let y = 2; y < 24; y++) for (let x = 2; x < 20; x++) if (y <= 18 || Math.abs(x - 11) > (y - 18) * 1.4) c.px(x, y, x < 5 ? mix(cloth, CREAM, 0.15) : cloth)
  c.rect(2, 2, 18, 2, trimK)
  if (emblem === 'cleaver') {
    c.rect(6, 7, 9, 6, STONE.hi)
    c.rect(6, 12, 9, 1, STONE.lt)
    c.px(13, 8, cloth)
    c.rect(15, 9, 3, 2, trimK)
  } else {
    c.rect(9, 6, 4, 2, WD.lt)
    c.rect(10, 8, 2, 3, CREAM)
    c.rect(7, 11, 8, 6, CREAM)
    c.rect(8, 13, 6, 3, [150, 214, 96])
    c.px(8, 12, [255, 255, 255])
  }
  return outline(c)
}
/** Butcherblock's smokehouse: plank walls, a plank roof, the door open on its embers, a vent for the smoke. */
function smokehouse(): Cv {
  const c = new Cv(62, 58)
  for (let y = 0; y < 24; y++) {
    const half = Math.round(8 + (y / 23) * 23)
    for (let x = 31 - half; x < 31 + half; x++) c.px(x, y, x < 31 ? (y % 4 === 3 ? WD.dk : WD.md) : y % 4 === 3 ? WD.sh : WD.dk)
  }
  c.rect(26, 0, 10, 3, WD.sh)
  c.rect(27, 0, 8, 1, [70, 60, 58])
  for (let y = 24; y < 58; y++)
    for (let x = 3; x < 59; x++) {
      const plank = Math.floor((x - 3) / 6)
      c.px(x, y, (x - 3) % 6 === 0 ? WD.sh : x < 20 ? (plank % 2 ? WD.md : WD.lt) : plank % 2 ? WD.dk : WD.md)
    }
  c.rect(1, 22, 60, 3, WD.dk)
  c.rect(1, 22, 60, 1, WD.md)
  // the door, ajar on the embers inside
  c.rect(24, 36, 14, 22, [40, 26, 26])
  c.rect(26, 50, 10, 8, [150, 60, 40])
  c.rect(28, 53, 6, 3, [255, 150, 60])
  c.rect(38, 36, 4, 22, WD.lt)
  // a string of hung fish in the dark
  for (const x of [27, 31, 35]) {
    c.rect(x, 38, 1, 3, STONE.lt)
    c.rect(x - 1, 41, 3, 5, [176, 132, 92])
  }
  return outline(c)
}
/** Smoke off the vent: soft puffs, rising and drifting with the wind. */
function smoke(): Cv {
  const c = new Cv(30, 46)
  const puffs: [number, number, number, number][] = [[8, 40, 4, 150], [11, 32, 5, 140], [15, 23, 6, 120], [20, 13, 7, 95], [24, 5, 5, 70]]
  for (const [cx, cy, r, a] of puffs)
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r) c.px(cx + x, cy + y, x + y < -r * 0.4 ? [236, 230, 214, a] : [196, 190, 178, a])
  return c
}
/** A plank jetty out over the channel, on two posts. */
function jetty(): Cv {
  const c = new Cv(40, 12)
  for (let x = 0; x < 40; x++) c.rect(x, 0, 1, 4, x % 6 === 5 ? WD.dk : x < 8 ? WD.lt : WD.md)
  c.rect(0, 0, 40, 1, WD.hi)
  c.rect(0, 3, 40, 1, WD.sh)
  for (const x of [4, 32]) {
    c.rect(x, 4, 3, 8, WD.dk)
    c.rect(x, 4, 1, 8, WD.md)
  }
  return outline(c)
}
/** A butcher's block for a counter: end grain on top, planked front. */
function butcherBlock(w: number, h: number): Cv {
  const c = new Cv(w, h)
  c.rect(0, 0, w, 6, WD.hi)
  for (let x = 0; x < w; x += 13) {
    c.rect(x, 0, 1, 6, WD.md)
    c.px(x + 6, 2, WD.lt)
    c.px(x + 7, 3, WD.lt)
  }
  c.rect(0, 5, w, 1, WD.md)
  c.rect(0, 6, w, h - 6, WD.md)
  for (let x = 8; x < w; x += 16) c.rect(x, 6, 1, h - 6, WD.dk)
  c.rect(0, 6, 3, h - 6, WD.lt)
  c.rect(0, h - 3, w, 3, WD.sh)
  return outline(c)
}
function cleaver(): Cv {
  const c = new Cv(14, 7)
  c.rect(0, 0, 9, 6, STONE.lt)
  c.rect(0, 0, 9, 1, STONE.hi)
  c.rect(0, 5, 9, 1, STONE.hi)
  c.px(6, 2, [40, 30, 34])
  c.rect(9, 2, 5, 2, WD.dk)
  return outline(c)
}
/** Marsh mist: banded and dithered, never an airbrush. */
function mist(c: Cv, y0: number, y1: number): void {
  for (let y = y0; y < y1; y++)
    for (let x = 0; x < c.w; x++) {
      const n = vnoise(x, y * 3, 40, 77)
      const f = Math.max(0, Math.round((n - 0.45) * 8 + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 0.9) / 4)
      if (f <= 0) continue
      const i = (y * c.w + x) * 4
      for (let k = 0; k < 3; k++) c.d[i + k] = c.d[i + k] + (232 - c.d[i + k]) * Math.min(0.3, f * 0.3)
    }
}
/** Greenvial's glasshouse: a planted bed behind panes in a timber frame, a glass gable, a brick sill. */
function glasshouse(): Cv {
  const c = new Cv(78, 60)
  const GLASS: RGB = [200, 232, 214]
  const GLASS_DK: RGB = [150, 196, 182]
  for (let y = 0; y < 22; y++) {
    const half = Math.round(6 + (y / 21) * 33)
    for (let x = 39 - half; x < 39 + half; x++) c.px(x, y, x < 39 ? GLASS : GLASS_DK)
  }
  c.rect(0, 22, 78, 26, GLASS)
  c.rect(39, 22, 39, 26, GLASS_DK)
  // the beds inside, seen through the glass
  for (let x = 2; x < 76; x++) {
    const h = 6 + Math.round(vnoise(x, 0, 6, 3) * 10)
    for (let y = 47 - h; y < 47; y++) c.px(x, y, (x + y) % 7 === 0 ? [214, 96, 120] : x < 39 ? [126, 180, 120] : [104, 156, 110])
  }
  // the frame: mullions, transoms and the gable's ribs
  for (let x = 0; x < 78; x += 13) c.rect(x, 22, 2, 26, WD.md)
  c.rect(0, 22, 78, 2, WD.lt)
  c.rect(0, 34, 78, 1, WD.md)
  for (let y = 0; y < 22; y++) {
    const half = Math.round(6 + (y / 21) * 33)
    c.px(39 - half, y, WD.md)
    c.px(39 + half - 1, y, WD.dk)
    if (y % 7 === 6) c.rect(39 - half, y, half * 2, 1, WD.md)
  }
  c.rect(38, 0, 2, 22, WD.md)
  // shine on the lit panes
  for (const [x, y] of [[4, 26], [17, 26], [8, 10], [30, 4]] as const) for (let i = 0; i < 5; i++) c.px(x + i, y + 4 - i, [246, 252, 246])
  // the brick sill
  for (let y = 48; y < 60; y++) for (let x = 0; x < 78; x++) c.px(x, y, (y - 48) % 4 === 3 || (x + ((y - 48) >> 2) * 4) % 9 === 0 ? [120, 70, 56] : x < 30 ? [192, 116, 88] : [168, 98, 76])
  return outline(c)
}
/** A post with a vine climbing it. */
function vined(p: Cv): Cv {
  const c = new Cv(p.w + 4, p.h)
  c.draw(p, 2, 0)
  for (let y = 2; y < p.h - 2; y += 1) {
    const x = 2 + Math.round((Math.sin(y / 5) + 1) * ((p.w - 1) / 2))
    c.px(x, y, LEAF.dk)
    if (y % 6 === 0) {
      c.rect(x - 2, y - 1, 2, 2, LEAF.lt)
      c.px(x - 2, y + 1, LEAF.md)
    }
    if (y % 6 === 3) {
      c.rect(x + 1, y, 2, 2, LEAF.md)
      c.px(x + 2, y + 2, LEAF.dk)
    }
  }
  return c
}
/** A potion on the counter: green, gold or rose, corked. */
function vial(k: 0 | 1 | 2): Cv {
  const liquid = ([[150, 214, 96], [236, 196, 80], [230, 120, 150]] as const)[k]
  const c = new Cv(7, 10)
  c.rect(2, 0, 3, 2, WD.lt)
  c.rect(2, 2, 3, 2, [214, 236, 226])
  c.rect(0, 4, 7, 6, [214, 236, 226])
  c.rect(1, 6, 5, 4, liquid)
  c.rect(1, 6, 2, 1, mix(liquid, [255, 255, 255], 0.4))
  c.px(1, 4, [255, 255, 255])
  return outline(c)
}

async function write(name: string, c: Cv, dir = OUT): Promise<void> {
  if (FACES_DIR) {
    // the faces mode writes the posts only, and only into its own folder
    if (!/^(liaison|proposal)-/.test(name)) return
    dir = FACES_DIR
  }
  mkdirSync(dir, { recursive: true })
  await sharp(Buffer.from(c.d.buffer), { raw: { width: c.w, height: c.h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(join(dir, `${name}.png`))
  console.log(`  scene ${name}.png ${c.w}x${c.h}`)
}

/** Where the flame sits in its 128px cell of `fx/tinyswords/fire.png`, so the overlay's feet land on the scene's. */
async function fireCell(): Promise<{ cx: number; by: number }> {
  const b = bbox(crop(await load(P.fire), 0, 0, 128, 128))
  return { cx: Math.round((b.x0 + b.x1 + 1) / 2), by: b.y1 + 1 }
}

// `--proposals <dir>` also bakes the two posts proposed for the slots that
// change company (Butcherblock, Greenvial) into <dir>, for the review cards:
// never into `public/assets/scenes`, never into the generated anchors.
const pi = process.argv.indexOf('--proposals')
const anchors = await bake(FACES_DIR ?? (pi > 0 ? resolve(process.argv[pi + 1] ?? 'proposals') : null))
if (FACES_DIR) process.exit(0)
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
        `  ${/^[a-z]+$/.test(k) ? k : `'${k}'`}: { speaker: [${a.speaker.join(', ')}]${a.held ? `, held: [${a.held.join(', ')}]` : ''}${a.fire ? `, fire: [${a.fire.join(', ')}]` : ''}${a.beside ? ', beside: true' : ''} },`,
    ),
    '} as const',
    '',
  ].join('\n'),
)
console.log(`  wrote ${GEN.replace(ROOT + '/', '')}`)
