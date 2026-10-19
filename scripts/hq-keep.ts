/**
 * hq-keep.ts — bake the HQ page's castle, one picture per stage
 * (`run/hq.HQ_STAGES`), from the CC0 Tiny Swords pack.
 *
 *   npx tsx scripts/hq-keep.ts            # write public/assets/scenes/hq-<stage>.png
 *   npx tsx scripts/hq-keep.ts --check    # re-bake into memory and compare; write nothing
 *
 * The HQ grows the way a Town Hall does (the HQ pass, Oct 2026; the designer:
 * "I need the castle icon to be like castle upgrades"): a thatched lodge, a
 * watchtower, a castle, a castle flying its banners. Each picture is the
 * pack's own buildings at their own density (drawn at 1× on the page, never
 * scaled), stood on the pack's meadow, with the NEXT stage's footing beside
 * it — the hint of what is coming, in the pack's own construction art:
 *
 *  - Lodge: `House_Blue`, and `Tower_Construction` going up beside it;
 *  - Watchtower: `Tower_Blue` by the lodge, and `Castle_Construction` laid
 *    out behind them;
 *  - Castle: `Castle_Blue`, bare flagpoles on its two towers;
 *  - Stronghold: the castle with red pennants on the poles and its two
 *    hanging banners re-dyed red: the cloth `Castle_Red` dyes, found pixel
 *    for pixel, in the pack's red ramp (its shades kept).
 *
 * ## Where the art comes from
 *
 * Every sprite is read from the OLD, public-domain build of Tiny Swords, from
 * the cache `harvest-cc0.ts` and `stop-scenes.ts` fill (the verified upstream,
 * `FulAppiOS/Agent-Quest`, CC0 1.0). Nothing from the current, non-CC0
 * download. The poles and pennants are drawn here in the pack's palette and
 * inked with its outline. The scenes are not under the `tinyswords` folders
 * the palette check scans; provenance: `public/assets/sprites/CREDITS.md`.
 *
 * Size: `HQ_SCENE` (`ui/shell/hq/hqModel.ts`), 400 × 232 native; the scene is
 * composed on its middle 358, which a 390 px phone sees.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import sharp from 'sharp'
import { HQ_STAGES, type HqStageId } from '../src/game/run/hq'
import { HQ_SCENE } from '../src/ui/shell/hq/hqModel'

const ROOT = resolve(import.meta.dirname, '..')
const CACHE = join(ROOT, 'node_modules', '.cache', 'cc0-pack')
const OUT = join(ROOT, 'public', 'assets', 'scenes')
const UPSTREAM = 'https://raw.githubusercontent.com/FulAppiOS/Agent-Quest/main/client/public/assets/themes/tiny-swords-cc0/'
const CHECK = process.argv.includes('--check')

const W = HQ_SCENE.w
const H = HQ_SCENE.h
/** Where the buildings stand: their feet. */
const GROUND = H - 8

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
function shadow(w: number, h: number, a = 60): Cv {
  const c = new Cv(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - w / 2) / (w / 2)
      const dy = (y + 0.5 - h / 2) / (h / 2)
      if (dx * dx + dy * dy <= 1) c.px(x, y, [22, 28, 46, a])
    }
  return c
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

// ------------------------------------------------------------- drawn parts (the pack's palette)

const WD = { lt: [214, 156, 96], md: [176, 112, 62], dk: [128, 78, 44] } as const
const RED = { hi: [246, 150, 120], lt: [228, 102, 84], md: [196, 74, 58], dk: [140, 48, 50] } as const
const GOLD: RGB = [224, 172, 76]

/** A flagpole of `h` px, a gold knob on top; with a pennant flying `dir` (+1 right, −1 left), or bare. */
function pole(h: number, flag: 0 | 1 | -1): Cv {
  const fw = 24
  const fh = 13
  const c = new Cv(3 + fw * 2, h + 3)
  const px = fw
  c.rect(px, 3, 2, h, WD.md)
  c.rect(px, 3, 1, h, WD.lt)
  c.rect(px - 1, 0, 4, 3, GOLD)
  if (flag) {
    // A swallow-tailed pennant, wider at the pole, lit on top and darker in its fold.
    for (let y = 0; y < fh; y++) {
      const t = Math.abs(y - (fh - 1) / 2) / ((fh - 1) / 2)
      const len = Math.round(fw - t * 3)
      const notch = Math.max(0, Math.round((1 - t * 1.6) * 7))
      for (let i = 0; i < len - notch; i++) {
        const x = flag > 0 ? px + 2 + i : px - 1 - i
        const wave = Math.round(Math.sin(i / 4) * 0.8)
        const col = y + wave <= 1 ? RED.lt : y + wave >= fh - 3 ? RED.dk : (i + 2) % 8 === 0 ? RED.dk : RED.md
        c.px(x, 4 + y + wave, col)
      }
    }
  }
  return outline(trim(c))
}

// ------------------------------------------------------------- the scenes

const P = {
  flat: 'Terrain/Ground/Tilemap_Flat.png',
  tree: 'Resources/Trees/Tree.png',
  house: 'Factions/Knights/Buildings/House/House_Blue.png',
  tower: 'Factions/Knights/Buildings/Tower/Tower_Blue.png',
  towerBuild: 'Factions/Knights/Buildings/Tower/Tower_Construction.png',
  castle: 'Factions/Knights/Buildings/Castle/Castle_Blue.png',
  castleRed: 'Factions/Knights/Buildings/Castle/Castle_Red.png',
  castleBuild: 'Factions/Knights/Buildings/Castle/Castle_Construction.png',
  deco: (n: number) => `Deco/${String(n).padStart(2, '0')}.png`,
}

/**
 * The castle's two hanging banners, in the sprite's own pixels (`Castle_Blue`
 * is 320 × 256; the banners hang off the front wall's lip either side of the
 * gate). Inside these boxes, a colour that `Castle_Red` paints differently at
 * the same pixel is the banner's dye — the walls behind it are teal in one and
 * red in the other too, so only the banner's own colours (the mint and teal of
 * the cloth, never the stone's) are swapped: those that occur nowhere in the
 * walls' boxes above.
 */
const BANNERS = [
  { x: 70, y: 164, w: 30, h: 50 },
  { x: 222, y: 164, w: 30, h: 50 },
]
/** The decks the castle's two towers stand open on, where a pole is set (sprite pixels). */
/** The cloth's floor: a pixel this green or lighter inside a banner box is cloth, not stone. */
const CLOTH_G = 150
/** The poles' height: their pennants clear the back battlements. */
const POLE = 56
const DECKS = [
  [62, 96],
  [258, 96],
] as const

async function redBanners(): Promise<Cv> {
  const blue = await load(P.castle)
  const red = await load(P.castleRed)
  const out = crop(blue, 0, 0, blue.w, blue.h)
  // The cloth: inside the boxes, the light mint and teal the blue castle
  // hangs (the stone behind it is darker), taken from the red castle's same pixel.
  const map = new Map<number, RGB>()
  const at = (c: Cv, x: number, y: number) => {
    const i = (y * c.w + x) * 4
    return [c.d[i], c.d[i + 1], c.d[i + 2], c.d[i + 3]] as const
  }
  for (const bx of BANNERS)
    for (let y = bx.y; y < bx.y + bx.h; y++)
      for (let x = bx.x; x < bx.x + bx.w; x++) {
        const [r, g, b, a] = at(blue, x, y)
        const [r2, g2, b2] = at(red, x, y)
        if (!a || g < CLOTH_G || (r === r2 && g === g2 && b === b2)) continue
        // The red castle's cloth is a faded rose; the stronghold's is dyed deep,
        // its shades kept: each cloth colour takes the red ramp's step for its light.
        const l = 0.3 * r + 0.59 * g + 0.11 * b
        map.set(key(r, g, b), l > 215 ? RED.hi : l > 188 ? RED.lt : l > 160 ? RED.md : RED.dk)
      }
  for (const bx of BANNERS) swap(out, map, (x, y) => x >= bx.x && x < bx.x + bx.w && y >= bx.y && y < bx.y + bx.h)
  return out
}

async function bake(): Promise<Record<HqStageId, Buffer>> {
  const flat = await load(P.flat)
  const grass = crop(flat, 64, 64, 64, 64)
  const tree = async (i: number) => trim(crop(await load(P.tree), i * 192, 0, 192, 192))
  const deco = async (n: number) => trim(await load(P.deco(n)))
  const meadow = async (seed: number) => {
    const c = new Cv(W, H)
    c.tile(grass)
    patches(c, seed)
    // Trees frame the top corners and the wings; nothing stands in the middle.
    const t = [await tree(0), await tree(1), await tree(2), await tree(3)]
    for (const [i, [x, y]] of ([[-6, 70], [28, 40], [404, 66], [372, 38], [-18, 150], [414, 152]] as const).entries()) c.put(t[i % 4], x, y)
    return c
  }
  /** The meadow's foreground: tufts and a bush or two, at the margins. */
  const scatter = async (c: Cv) => {
    c.put(await deco(8), 34, H - 2)
    c.put(await deco(10), 70, H - 18)
    c.put(await deco(5), 356, H - 6)
    c.put(await deco(11), 330, H - 22)
    c.put(await deco(7), 380, H - 30)
  }
  const finish = (c: Cv) => {
    vignette(c, 0.55)
    return sharp(Buffer.from(c.d.buffer), { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9, effort: 10 }).toBuffer()
  }
  const house = trim(await load(P.house))
  const tower = trim(await load(P.tower))
  const towerBuild = trim(await load(P.towerBuild))
  const castleBuild = trim(await load(P.castleBuild))
  const castleBlue = await load(P.castle)
  const cb = bbox(castleBlue)
  const castle = trim(castleBlue)
  const castleDressed = trim(await redBanners())
  const out = {} as Record<HqStageId, Buffer>

  /** A stand of pines behind a small building, so its sky is woodland, not bare grass. */
  const grove = async (c: Cv, xs: readonly number[]) => {
    for (const [i, x] of xs.entries()) c.put(await tree(i % 4), x, 112 + (i % 2) * 14)
  }
  // ---- the lodge: a thatched house, and the next stage's footing going up beside it.
  {
    const c = await meadow(21)
    await grove(c, [96, 150, 214, 300])
    c.put(shadow(96, 12, 50), 252, GROUND - 2)
    c.put(towerBuild, 254, GROUND)
    c.put(house, 166, GROUND)
    await scatter(c)
    out.lodge = await finish(c)
  }
  // ---- the watchtower: the tower beside the lodge, the castle's deck laid out behind them.
  {
    const c = await meadow(22)
    await grove(c, [70, 132])
    c.put(castleBuild, 262, GROUND - 22)
    c.put(house, 106, GROUND)
    c.put(tower, 196, GROUND)
    await scatter(c)
    out.watchtower = await finish(c)
  }
  // ---- the castle, bare poles set on its towers' decks (the banners are next).
  // ---- the stronghold: the poles fly red pennants, the banners are dyed red.
  for (const id of ['castle', 'stronghold'] as const) {
    const c = await meadow(id === 'castle' ? 23 : 24)
    const x0 = Math.round(W / 2 - castle.w / 2)
    const y0 = GROUND - castle.h
    c.draw(id === 'stronghold' ? castleDressed : castle, x0, y0)
    // Poles stand on the towers' open decks.
    const poles: Cv[] = [pole(POLE, id === 'stronghold' ? -1 : 0), pole(POLE, id === 'stronghold' ? 1 : 0)]
    DECKS.forEach(([dx, dy], i) => c.put(poles[i], x0 + (dx - cb.x0), y0 + (dy - cb.y0)))
    await scatter(c)
    out[id] = await finish(c)
  }
  return out
}

async function main() {
  const out = await bake()
  if (Object.keys(out).length !== HQ_STAGES.length) throw new Error('hq-keep: a stage has no picture')
  mkdirSync(OUT, { recursive: true })
  let stale = 0
  for (const s of HQ_STAGES) {
    const file = join(OUT, `hq-${s.id}.png`)
    if (CHECK) {
      const on = existsSync(file) ? readFileSync(file) : null
      if (!on || !on.equals(out[s.id])) {
        console.error(`hq-keep: ${file} is stale — run \`npx tsx scripts/hq-keep.ts\``)
        stale++
      }
    } else {
      writeFileSync(file, out[s.id])
      console.log(`hq-keep: ${file}  ${W}x${H}  ${(out[s.id].length / 1024).toFixed(1)} KB`)
    }
  }
  if (stale) process.exit(1)
  if (CHECK) console.log(`hq-keep: ${HQ_STAGES.length} scenes current`)
}

main()
