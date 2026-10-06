/**
 * The Fieldwatch identity, rendered (Phase 4).
 *
 *   npm run brand            # rewrite every generated brand file
 *
 * Sources of truth, all hand-authored:
 *  - `src/assets/brand/mark.svg` / `mark-mono.svg` — the vector mark (48-unit grid)
 *  - `src/assets/brand/wordmark.svg` — Crimson Text Bold outlined by
 *    `scripts/brand-wordmark.py` (kerned by eye; see that file)
 *  - `PIXEL_MARK` below — the 16×16 reduction, drawn on the grid, for every
 *    size at which the vector turns to mud (favicons, in-game)
 *  - `scene()` below — the dusk diorama, composed from the game's own CC0
 *    Tiny Swords sprites (old public-domain build, already in the repo)
 *
 * Outputs (all committed, so the build generates no images and `sharp` stays a
 * dev dependency — the same contract as `scripts/icons.ts`, which now defers
 * to this file):
 *  - `src/assets/brand/lockup.svg`, `lockup-stacked.svg`
 *  - `src/assets/brand/mark-16.png` (the pixel mark, 1×)
 *  - `public/icons/favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`,
 *    `icon-192.png`, `icon-512.png`, `icon-192-maskable.png`, `icon-512-maskable.png`
 *  - `public/social/og-image.png` (1200×630 — the 600×315 scene at exactly 2×)
 *  - `ios/App/App/Assets.xcassets/`: the App Store icon (1024, opaque) and the
 *    launch image (2732², shown aspect-fill while the game loads)
 *  - `docs/brand/identity-sheet.png` (the review sheet BRAND.md points at)
 *
 * No web-fetched and no generated-by-model imagery anywhere: every pixel is
 * either drawn here, drawn in the SVGs above, or a CC0 sprite already listed
 * in `public/assets/CC0-MANIFEST.md`.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp, { type OverlayOptions } from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BRAND = resolve(ROOT, 'src/assets/brand')
const ICONS = resolve(ROOT, 'public/icons')
const SOCIAL = resolve(ROOT, 'public/social')
const DOCS = resolve(ROOT, 'docs/brand')
const XCASSETS = resolve(ROOT, 'ios/App/App/Assets.xcassets')
const SPR = resolve(ROOT, 'public/assets/sprites/tinyswords')
const DECO = resolve(ROOT, 'public/assets/deco/tinyswords')

/** Brand tokens — the same values as `src/styles/global.css` :root. */
const T = {
  bg: '#201711',
  bg2: '#2a1f16',
  panel: '#2f2418',
  paper: '#ece0c8',
  ink: '#4a3a1e',
  gold: '#e0ac4c',
  teal: '#57a2b6',
  text: '#f3e7d0',
  lamp: '#fff1c8',
  /** The Tiny Swords outline (see scripts/fw-icons.ts) — used by the pixel mark only. */
  outline: '#161c2e',
}

// ───────────────────────────────────────────────────────────── raster helpers

type RGB = [number, number, number]
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

/** A straight-alpha RGBA raster. Every scene op is a whole-pixel op: no AA. */
class Raster {
  data: Uint8ClampedArray
  constructor(
    public w: number,
    public h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4)
  }
  static async load(file: string | Buffer): Promise<Raster> {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const r = new Raster(info.width, info.height)
    r.data.set(data)
    return r
  }
  a(x: number, y: number): number {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.data[(y * this.w + x) * 4 + 3]
  }
  /** Source-over one pixel. `a` is 0..1. */
  blend(x: number, y: number, c: RGB, a = 1): void {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return
    const i = (y * this.w + x) * 4
    const d = this.data
    const da = d[i + 3] / 255
    const oa = a + da * (1 - a)
    if (oa <= 0) return
    for (let k = 0; k < 3; k++) d[i + k] = (c[k] * a + d[i + k] * da * (1 - a)) / oa
    d[i + 3] = oa * 255
  }
  /** Additive light (for torches and the sun) on an opaque pixel. */
  add(x: number, y: number, c: RGB, a: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 4
    for (let k = 0; k < 3; k++) this.data[i + k] += c[k] * a
  }
  mul(x: number, y: number, m: [number, number, number]): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 4
    for (let k = 0; k < 3; k++) this.data[i + k] *= m[k]
  }
  rect(x0: number, y0: number, w: number, h: number, c: RGB, a = 1): void {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.blend(x, y, c, a)
  }
  /** Blit another raster at an integer position. */
  draw(src: Raster, dx: number, dy: number, flip = false, alpha = 1): void {
    dx = Math.round(dx)
    dy = Math.round(dy)
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const sx = flip ? src.w - 1 - x : x
        const i = (y * src.w + sx) * 4
        const a = src.data[i + 3] / 255
        if (a > 0) this.blend(dx + x, dy + y, [src.data[i], src.data[i + 1], src.data[i + 2]], a * alpha)
      }
  }
  crop(x0: number, y0: number, w: number, h: number): Raster {
    const r = new Raster(w, h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const si = ((y0 + y) * this.w + x0 + x) * 4
      r.data.set(this.data.subarray(si, si + 4), (y * w + x) * 4)
    }
    return r
  }
  /** Integer nearest-neighbour upscale — the only resize a finished scene gets. */
  scale(n: number): Raster {
    const r = new Raster(this.w * n, this.h * n)
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const si = ((Math.floor(y / n)) * this.w + Math.floor(x / n)) * 4
      r.data.set(this.data.subarray(si, si + 4), (y * r.w + x) * 4)
    }
    return r
  }
  png(palette = false): Promise<Buffer> {
    const img = sharp(Buffer.from(this.data.buffer, this.data.byteOffset, this.data.byteLength), {
      raw: { width: this.w, height: this.h, channels: 4 },
    })
    return (palette ? img.png({ palette: true, colours: 256, dither: 0, effort: 10 }) : img.png({ compressionLevel: 9 })).toBuffer()
  }
}

/**
 * Box-filter to exactly ×½, alpha-weighted — the same bake `pixmap.ts` runs in
 * the browser, so the diorama sits at the density the battle draws at.
 */
function halve(s: Raster): Raster {
  const r = new Raster(Math.ceil(s.w / 2), Math.ceil(s.h / 2))
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      let ar = 0, ag = 0, ab = 0, aa = 0, n = 0
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) {
          const sx = x * 2 + i, sy = y * 2 + j
          if (sx >= s.w || sy >= s.h) continue
          const k = (sy * s.w + sx) * 4
          const a = s.data[k + 3]
          ar += s.data[k] * a
          ag += s.data[k + 1] * a
          ab += s.data[k + 2] * a
          aa += a
          n++
        }
      const o = (y * r.w + x) * 4
      if (aa > 0) {
        r.data[o] = ar / aa
        r.data[o + 1] = ag / aa
        r.data[o + 2] = ab / aa
      }
      r.data[o + 3] = aa / n
    }
  return r
}

/** Snap alpha to 0/255 — for silhouettes, which must have hard pixel edges. */
function harden(s: Raster, colour?: RGB, cut = 110): Raster {
  const r = new Raster(s.w, s.h)
  for (let i = 0; i < s.data.length; i += 4) {
    if (s.data[i + 3] < cut) continue
    const c = colour ?? [s.data[i], s.data[i + 1], s.data[i + 2]]
    r.data[i] = c[0]
    r.data[i + 1] = c[1]
    r.data[i + 2] = c[2]
    r.data[i + 3] = 255
  }
  return r
}

/**
 * Grade a sprite for dusk and give it the contour ring the battle gives every
 * unit (`pixmap.ts`): dark at the sides and below, a warm rim light above —
 * here the rim is the low sun behind the goblin column.
 */
function dusk(s: Raster, m: [number, number, number], rim: number): Raster {
  const r = new Raster(s.w + 2, s.h + 2)
  r.draw(s, 1, 1)
  for (let i = 0; i < r.data.length; i += 4) for (let k = 0; k < 3; k++) r.data[i + k] *= m[k]
  const ring = new Raster(r.w, r.h)
  const warm = hex('#ffc977')
  const dark = hex('#1a100b')
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      if (r.a(x, y) >= 96) continue
      const below = r.a(x, y + 1) >= 96
      const any = below || r.a(x, y - 1) >= 96 || r.a(x - 1, y) >= 96 || r.a(x + 1, y) >= 96
      if (!any) continue
      if (below && rim > 0) ring.blend(x, y, warm, rim)
      else ring.blend(x, y, dark, 0.62)
    }
  ring.draw(r, 0, 0)
  return ring
}

/** Deterministic hash noise in [0,1). */
const hash = (x: number, y: number, s = 0): number => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// ─────────────────────────────────────────────────────────────── pixel mark

/**
 * The mark at 16×16, drawn — not scaled. Below ~40px the vector's pole, pennant
 * and window fall between pixels, so this reduction keeps the three things that
 * carry the idea (disc, tower, horizon) and thickens the tower from 18% to 36%
 * of the disc so it still reads as a tower rather than a nick.
 *
 * Same convention as the icon atlas (`scripts/fw-icons.ts`): interior only,
 * inside rows/cols 1..14; `outline()` then rings it in the Tiny Swords
 * `#161C2E`, so it sits beside the atlas icons as one family.
 */
const PIXEL_MARK = [
  '................',
  '.....YYDTTY.....',
  '...YYYYDTYYYY...',
  '..YYYYYDYYYYYY..',
  '..YYYYDDDYYYYY..',
  '.YYYYDDDDDYYYYY.',
  '.YYYDDDDDDDYYYY.',
  '.YYYYDDDDDYYYYY.',
  '.YYYYDDWDDYYYYY.',
  '.YYYYDDWDDYYYYY.',
  '.YYYYDDDDDYYYYY.',
  '..yyDDDDDDDyyy..',
  '..yDDDDDDDDDDy..',
  '...DDDDDDDDDD...',
  '.....DDDDDD.....',
  '................',
]
const PIXEL_PAL: Record<string, string> = {
  Y: T.gold,
  y: '#c98d3c', // the disc just above the horizon — the sun reddening as it sets
  D: '#2a1a10', // the silhouette: dark wood, never the page black
  W: T.lamp,
  T: T.teal,
  K: T.outline,
}

function outline(g: string[]): string[] {
  return g.map((row, y) =>
    row
      .split('')
      .map((c, x) => {
        if (c !== '.') return c
        const hit = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const n = g[y + dy]?.[x + dx]
          return n !== undefined && n !== '.'
        })
        return hit ? 'K' : '.'
      })
      .join(''),
  )
}

function pixelRaster(g: string[]): Raster {
  const r = new Raster(g[0].length, g.length)
  g.forEach((row, y) => row.split('').forEach((c, x) => c !== '.' && r.blend(x, y, hex(PIXEL_PAL[c]))))
  return r
}

/** The pixel mark as SVG rects, merged into horizontal runs; crisp at 16 and 32. */
function pixelSvg(g: string[], bg?: string): string {
  let body = ''
  g.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const c = row[x]
      let n = 1
      while (row[x + n] === c) n++
      if (c !== '.') body += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${PIXEL_PAL[c]}"/>`
      x += n
    }
  })
  const back = bg ? `<rect width="16" height="16" rx="3" fill="${bg}"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><title>Fieldwatch</title>${back}${body}</svg>\n`
}

// ────────────────────────────────────────────────────────────── vector mark

const paths = (svg: string) => [...svg.matchAll(/<path[^>]*\/>/g)].map((m) => m[0]).join('')

interface Wordmark { d: string; x: number; y: number; w: number; h: number; cap: number }
function parseWordmark(svg: string): Wordmark {
  const vb = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(svg)!
  const d = /<path[^>]* d="([^"]+)"/.exec(svg)![1]
  const cap = +/data-cap-height="(\d+)"/.exec(svg)![1]
  return { d, x: +vb[1], y: +vb[2], w: +vb[3], h: +vb[4], cap }
}

/**
 * Lockups. The wordmark's BASELINE sits on the mark's horizon crest (y≈35 on
 * the 48 grid) and its cap height is 20 units — so the word stands on the same
 * ground as the tower. Gap: 10 units, half the disc's radius, which is also the
 * clear-space unit (see BRAND.md).
 */
function lockups(markSvg: string, wm: Wordmark, word: string, markFill?: string) {
  const s = 20 / wm.cap
  const mark = markFill ? paths(markSvg).replace(/fill="[^"]+"/g, `fill="${markFill}"`) : paths(markSvg)
  const wordW = wm.w * s
  // Horizontal: mark 48 wide (disc spans 2..46), gap 10 from the disc edge.
  const hx = 46 + 10 - wm.x * s
  const hW = Math.ceil(46 + 10 + wordW + 2)
  const horizontal = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${hW} 48" width="${hW * 2}" height="96">
  <title>Fieldwatch</title>
  <!-- Generated by scripts/brand.ts from mark.svg + wordmark.svg. Clear space: 11 units (half the disc) on every side. -->
  ${mark}
  <path fill="${word}" d="${wm.d}" transform="translate(${hx.toFixed(2)} 35.05) scale(${s.toFixed(5)})"/>
</svg>
`
  // Stacked: mark centred over the word; word cap height 16 (80%), 6 units below the disc.
  const ss = 16 / wm.cap
  const sW = Math.ceil(wm.w * ss + 4)
  const sx = (sW - wm.w * ss) / 2 - wm.x * ss
  const stacked = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sW} 68" width="${sW * 2}" height="136">
  <title>Fieldwatch</title>
  <!-- Generated by scripts/brand.ts from mark.svg + wordmark.svg. -->
  <g transform="translate(${((sW - 48) / 2).toFixed(2)} 0)">${mark}</g>
  <path fill="${word}" d="${wm.d}" transform="translate(${sx.toFixed(2)} ${(46 + 6 + 16).toFixed(2)}) scale(${ss.toFixed(5)})"/>
</svg>
`
  return { horizontal, stacked, hW, sW }
}

/** Rasterise an SVG at an exact pixel size. */
const svgPng = (svg: string, w: number, h = w) =>
  sharp(Buffer.from(svg), { density: 72 * 8 }).resize(w, h, { fit: 'fill' }).png().toBuffer()

/**
 * App-icon art. The mark over a dusk glow on dark wood, with the hill and tower
 * filled in a deeper wood so the disc reads as a whole circle at launcher size.
 * `inset` is the fraction of the tile the disc's diameter spans.
 */
function iconSvg(markSvg: string, size: number, inset: number, shape: 'square' | 'squircle'): string {
  const d = size * inset
  const k = d / 44 // the disc is 44 units across
  const ox = size / 2 - 24 * k
  // Optical centre: the disc's visible mass is its top 80%, so nudge down a hair.
  const oy = size / 2 - 24 * k + size * 0.01
  const r = size * 0.225
  const clip =
    shape === 'squircle'
      ? // Superellipse-ish: a rounded rect with continuous-curvature corners
        `<clipPath id="t"><path d="M${r} 0H${size - r}C${size - r * 0.3} 0 ${size} ${r * 0.3} ${size} ${r}V${size - r}C${size} ${size - r * 0.3} ${size - r * 0.3} ${size} ${size - r} ${size}H${r}C${r * 0.3} ${size} 0 ${size - r * 0.3} 0 ${size - r}V${r}C0 ${r * 0.3} ${r * 0.3} 0 ${r} 0Z"/></clipPath>`
      : `<clipPath id="t"><rect width="${size}" height="${size}"/></clipPath>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${clip}
    <radialGradient id="g" cx="50%" cy="44%" r="55%"><stop offset="0" stop-color="#4a2e1c"/><stop offset=".55" stop-color="${T.bg2}"/><stop offset="1" stop-color="${T.bg}"/></radialGradient>
  </defs>
  <g clip-path="url(#t)">
    <rect width="${size}" height="${size}" fill="url(#g)"/>
    <g transform="translate(${ox} ${oy}) scale(${k})">
      <circle cx="24" cy="24" r="22" fill="#170f0a"/>
      ${paths(markSvg)}
    </g>
  </g>
</svg>`
}

// ─────────────────────────────────────────────────────────────────── scene

interface Sprites {
  fighter: Raster; rogue: Raster; mystic: Raster
  torch: Raster[]; tnt: Raster
  tree: Raster[]; treeFar: Raster[]; bush: Raster[]; rock: Raster[]
  mushroom: Raster; pumpkin: Raster; grass: Raster
}

async function loadSprites(): Promise<Sprites> {
  const L = (f: string | Buffer) => Raster.load(f)
  const H = async (f: string) => halve(await L(f))
  const trees = await Promise.all(['tree1', 'tree2', 'tree3'].map((t) => L(`${SPR}/${t}.png`)))
  return {
    fighter: await H(`${SPR}/fighter.png`),
    rogue: await H(`${SPR}/rogue.png`),
    mystic: await H(`${SPR}/mystic.png`),
    torch: await Promise.all(['torch1', 'torch2', 'torch4'].map((t) => H(`${SPR}/${t}.png`))),
    tnt: await H(`${SPR}/tnt1.png`),
    tree: trees.map(halve),
    // Distant pines are flat silhouettes: ¼ density is invisible once a sprite
    // has no interior detail, and it is what makes them read as far away.
    treeFar: trees.map((t) => harden(halve(halve(t)), hex('#2b1a17'), 100)),
    bush: await Promise.all(['bush1', 'bush2'].map((t) => H(`${SPR}/${t}.png`))),
    rock: await Promise.all(['rock1', 'rock3', 'rock2'].map((t) => H(`${SPR}/${t}.png`))),
    mushroom: await H(`${DECO}/deco_02.png`),
    pumpkin: await H(`${DECO}/deco_13.png`),
    grass: await H(`${SPR}/grass.png`),
  }
}

interface SceneOpts {
  w: number
  h: number
  /** Horizon height above the bottom edge. The subject is laid out from it. */
  ground?: number
}

/**
 * The dusk diorama of the 600×315 social card. Every coordinate is relative to
 * the horizontal centre `cx` and the horizon `hy`, so a bigger canvas only
 * grows sky and margin, never moves the subject.
 *
 * Composition: a road comes out of the far wood on the right; a goblin column
 * with torches walks it toward the viewer; three heroes hold their circles
 * beside it. Trees and brush frame the two outer margins. (It also drew the
 * menu's key art, with the Watchtower on the ridge, until the menu became the
 * trade map in the mercenary company's build step 4.)
 */
function scene(S: Sprites, o: SceneOpts): Raster {
  const { w: W, h: H } = o
  const r = new Raster(W, H)
  const cx = Math.floor(W / 2)
  const hy = H - (o.ground ?? 172)
  const sunX = cx - 14

  // ── sky: banded, with a checker row between bands (pixel-art gradient)
  const SKY = ['#241619', '#2e1b1f', '#3a2025', '#492629', '#5b2e2d', '#703831', '#874534', '#a15536', '#bb6a3a', '#d3853f']
  const bandH = (hy + 6) / SKY.length
  for (let y = 0; y < hy + 6; y++) {
    const f = y / bandH
    let b = Math.min(SKY.length - 1, Math.floor(f))
    for (let x = 0; x < W; x++) {
      const edge = f - Math.floor(f) > 0.86 && (x + y) % 2 === 0
      r.blend(x, y, hex(SKY[Math.min(SKY.length - 1, b + (edge ? 1 : 0))]))
    }
  }
  // Early stars in the top bands.
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, 1, 7) * W)
    const y = Math.floor(hash(i, 2, 7) * hy * 0.45)
    r.blend(x, y, hex(T.text), 0.5 + hash(i, 3, 7) * 0.5)
  }
  // Two long cloud streaks, lit gold along their undersides.
  const cloud = (x0: number, y0: number, len: number) => {
    for (let x = 0; x < len; x++) {
      const t = Math.sin((x / len) * Math.PI)
      const th = Math.max(1, Math.round(t * 3))
      for (let j = 0; j < th; j++) r.blend(x0 + x, y0 + j, hex('#5a2f30'), 0.9)
      if (t > 0.25) r.blend(x0 + x, y0 + th, hex('#c77a44'), 0.8)
    }
  }
  // The card's sky carries the lockup and the line; keep it clear above them.
  cloud(cx - 250, hy - 16, 150)
  cloud(cx + 120, hy - 12, 170)

  // ── the sun's afterglow, low on the horizon
    for (let y = hy - 30; y <= hy + 4; y++)
      for (let x = 0; x < W; x++) {
        const t = 1 - Math.abs(x - sunX) / (W * 0.5)
        if (t > 0) r.blend(x, y, hex('#e7a24a'), 0.18 * t * ((y - hy + 30) / 34))
      }

  // ── far ridge with pine silhouettes
  const ridgeY = (x: number) => Math.round(hy + 2 + 3 * Math.sin(x / 37) + 2 * Math.sin(x / 11 + 1) - 3 * Math.exp(-(((x - sunX) / 50) ** 2)))
  for (let x = 0; x < W; x++) for (let y = ridgeY(x); y < hy + 14; y++) r.blend(x, y, hex('#2b1a17'))
  const farTrees: [number, number][] = [
    [-150, 0], [-136, 1], [-124, 2], [-176, 1], [-205, 0], [-228, 2], [-246, 1], [-264, 0], [-100, 1],
    [70, 1], [92, 0], [118, 2], [150, 1], [171, 0], [196, 2], [214, 1], [238, 0], [262, 2], [285, 1],
  ]
  for (const [dx, t] of farTrees) {
    const tr = S.treeFar[t]
    const x = cx + dx
    r.draw(tr, x - tr.w / 2, ridgeY(x) - tr.h + 4)
  }

  // ── meadow: the game's grass tile at battle density, graded for dusk
  const g0 = hy + 8
  for (let y = g0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = ((y % S.grass.h) * S.grass.w + (x % S.grass.w)) * 4
    r.blend(x, y, [S.grass.data[i], S.grass.data[i + 1], S.grass.data[i + 2]])
  }
  // Ridge foot overlaps the meadow top with a soft broken edge.
  for (let x = 0; x < W; x++) {
    const d = 3 + Math.floor(hash(x, 0, 3) * 3)
    for (let y = hy + 8; y < hy + 8 + d; y++) r.blend(x, y, hex('#2b1a17'), 0.9)
  }
  // Tonal patches and tufts so the ground is never one flat block.
  for (let i = 0; i < 60; i++) {
    const bx = hash(i, 4, 1) * W, by = g0 + 10 + hash(i, 5, 1) * (H - g0)
    const br = 6 + hash(i, 6, 1) * 16
    const light = hash(i, 7, 1) > 0.55
    for (let y = Math.floor(by - br / 2); y < by + br / 2; y++)
      for (let x = Math.floor(bx - br); x < bx + br; x++)
        if (((x - bx) / br) ** 2 + ((y - by) / (br / 2)) ** 2 < 1) r.blend(x, y, light ? hex('#9fd46a') : hex('#2f6a36'), 0.22)
  }
  for (let i = 0; i < 180; i++) {
    const x = Math.floor(hash(i, 8, 2) * W), y = Math.floor(g0 + 6 + hash(i, 9, 2) * (H - g0))
    const c = hex(hash(i, 10, 2) > 0.5 ? '#a7dc6e' : '#2d6538')
    r.blend(x, y, c)
    r.blend(x - 1, y - 1, c)
    r.blend(x + 1, y - 1, c)
  }
  // A few flowers, nearer = more.
  for (let i = 0; i < 44; i++) {
    const y = Math.floor(g0 + 20 + Math.sqrt(hash(i, 11, 3)) * (H - g0 - 20))
    const x = Math.floor(hash(i, 12, 3) * W)
    const c = ['#fff1c8', '#f2d45c', '#e98a8a'][i % 3]
    r.blend(x, y, hex(c))
  }

  // ── the road: tapers with distance, dark edge, worn lighter centre, speckle
  const road: [number, number, number][] = [
    [cx + 212, hy + 8, 4], [cx + 176, hy + 20, 6], [cx + 136, hy + 34, 8], [cx + 92, hy + 52, 10],
    [cx + 40, hy + 76, 12], [cx - 14, hy + 106, 14], [cx - 64, hy + 140, 16], [cx - 92, H + 16, 18],
  ]
  const distRoad = (px: number, py: number) => {
    let best = 1e9, bt = 0, bhw = 0
    for (let k = 0; k < road.length - 1; k++) {
      const [ax, ay, aw] = road[k], [bx, by, bw] = road[k + 1]
      const vx = bx - ax, vy = by - ay
      const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)))
      const d = Math.hypot(px - (ax + vx * t), py - (ay + vy * t))
      const hw = lerp(aw, bw, t)
      if (d - hw < best - bhw || k === 0) { best = d; bhw = hw; bt = t }
    }
    return { d: best, hw: bhw, t: bt }
  }
  const EDGE = hex('#3c2c18'), FILL = hex('#7a5a30'), WORN = hex('#8e6c3c'), DARK = hex('#624722')
  for (let y = hy + 6; y < H; y++)
    for (let x = 0; x < W; x++) {
      const { d, hw } = distRoad(x, y)
      const jit = (hash(x, y, 9) - 0.5) * 1.6
      if (d > hw + 2 + jit) continue
      const q = d / hw
      let c = d > hw - 1 + jit ? EDGE : q < 0.4 ? WORN : FILL
      if (c !== EDGE && hash(x, y, 5) > 0.93) c = DARK
      if (c !== EDGE && hash(x, y, 6) > 0.97) c = hex('#a8875a')
      r.blend(x, y, c)
    }

  // ── dusk grade on the terrain: far = hazed and dim, near = warm and rich.
  for (let y = hy + 6; y < H; y++) {
    const t = (y - hy) / (H - hy) // 0 far → 1 near
    const m: [number, number, number] = [lerp(0.46, 0.78, t), lerp(0.36, 0.68, t), lerp(0.4, 0.6, t)]
    const haze = (1 - t) ** 2 * 0.5
    for (let x = 0; x < W; x++) {
      r.mul(x, y, m)
      r.blend(x, y, hex('#6e3a30'), haze)
      // warm light spilling from the low sun across the grass
      const sun = Math.max(0, 1 - Math.abs(x - sunX) / 230) * (1 - t) * 0.35
      if (sun > 0) r.add(x, y, hex('#e0a050'), sun * 0.35)
    }
  }

  // ── actors, painter-ordered by their feet
  type Actor = { spr: Raster; x: number; y: number; flip?: boolean; shadow?: number; torch?: [number, number]; post?: boolean }
  const heroGrade: [number, number, number] = [0.96, 0.89, 0.81]
  const G = (s: Raster, rim = 0.55) => dusk(s, heroGrade, rim)
  const Gf = (s: Raster) => dusk(s, [0.86, 0.78, 0.72], 0.8)
  const actors: Actor[] = [
    // the goblin column on the road, leader nearest; torches glow
    { spr: Gf(S.torch[1]), x: cx + 132, y: hy + 37, flip: true, shadow: 9, torch: [16, -35] },
    { spr: Gf(S.tnt), x: cx + 94, y: hy + 53, flip: true, shadow: 10 },
    { spr: Gf(S.torch[0]), x: cx + 54, y: hy + 71, flip: true, shadow: 10, torch: [16, -35] },
    // the company at their circles, facing the column
    { spr: G(S.fighter), x: cx - 30, y: hy + 64, shadow: 12, post: true },
    { spr: G(S.rogue), x: cx - 100, y: hy + 96, shadow: 11, post: true },
    { spr: G(S.mystic), x: cx + 24, y: hy + 112, shadow: 11, post: true },
    // framing: pines and brush at the outer margins only
    { spr: G(S.tree[0], 0.3), x: cx - 214, y: hy + 92 },
    { spr: G(S.tree[2], 0.3), x: cx - 244, y: hy + 150 },
    { spr: G(S.tree[1], 0.3), x: cx + 222, y: hy + 118 },
    { spr: G(S.tree[0], 0.3), x: cx + 252, y: hy + 176 },
    { spr: G(S.bush[0], 0.2), x: cx - 176, y: hy + 168 },
    { spr: G(S.bush[1], 0.2), x: cx + 190, y: hy + 150 },
    { spr: G(S.bush[1], 0.2), x: cx - 150, y: hy + 44 },
    { spr: G(S.rock[0], 0.2), x: cx - 40, y: hy + 150 },
    { spr: G(S.rock[1], 0.2), x: cx + 172, y: hy + 70 },
    { spr: G(S.pumpkin, 0.2), x: cx - 62, y: hy + 132 },
    { spr: G(S.mushroom, 0.2), x: cx - 130, y: hy + 146 },
    { spr: G(S.mushroom, 0.2), x: cx + 96, y: hy + 160 },
  ]
  actors.sort((a, b) => a.y - b.y)
  for (const a of actors) {
    if (a.post) {
      // The circle a hero is posted on — the game's slot ring, cream on grass.
      const rx = 15, ry = 6
      for (let y = -ry - 1; y <= ry + 1; y++)
        for (let x = -rx - 1; x <= rx + 1; x++) {
          const e = (x / rx) ** 2 + (y / ry) ** 2
          if (e <= 1.18 && e >= 0.72) r.blend(a.x + x, a.y + y, hex('#f5e9cf'), 0.55)
        }
    }
    if (a.shadow) {
      const rx = a.shadow, ry = Math.max(2, Math.round(a.shadow / 3))
      for (let y = -ry; y <= ry; y++)
        for (let x = -rx; x <= rx; x++) if ((x / rx) ** 2 + (y / ry) ** 2 <= 1) r.blend(a.x + x, a.y + y - 1, hex('#1a100b'), 0.32)
    }
    r.draw(a.spr, a.x - Math.floor(a.spr.w / 2), a.y - a.spr.h + 2, a.flip)
  }
  // Torch light: stepped rings of additive warmth around each flame.
  for (const a of actors) {
    if (!a.torch) continue
    const tx = a.x + (a.flip ? a.torch[0] : -a.torch[0]), ty = a.y + a.torch[1]
    for (let y = -26; y <= 26; y++)
      for (let x = -26; x <= 26; x++) {
        const d = Math.hypot(x, y)
        const k = d < 5 ? 0.34 : d < 11 ? 0.18 : d < 18 ? 0.09 : d < 26 && (x + y) % 2 === 0 ? 0.06 : 0
        if (k) r.add(tx + x, ty + y, hex('#ffb050'), k)
      }
  }
  // More of the horde: torch sparks where the road leaves the far wood.
  for (const [dx, dy] of [[168, 24], [176, 21], [186, 16], [196, 12], [206, 9], [214, 7]] as const) {
    const x = cx + dx, y = hy + dy
    r.blend(x, y, hex('#ffd27a'))
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) r.add(x + ax, y + ay, hex('#ff9a40'), 0.35)
  }

  // ── vignette: darken the corners and the bottom edge a touch
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const nx = (x - cx) / (W / 2), ny = (y - H * 0.55) / (H * 0.6)
      const v = Math.max(0, Math.hypot(nx * 0.8, ny) - 0.75)
      if (v > 0) r.mul(x, y, [1 - v * 0.55, 1 - v * 0.6, 1 - v * 0.55])
    }
  return r
}

// ─────────────────────────────────────────────────────────────────── main

await Promise.all([BRAND, ICONS, SOCIAL, DOCS].map((d) => mkdir(d, { recursive: true })))
const markSvg = await readFile(resolve(BRAND, 'mark.svg'), 'utf8')
const monoSvg = await readFile(resolve(BRAND, 'mark-mono.svg'), 'utf8')
const wm = parseWordmark(await readFile(resolve(BRAND, 'wordmark.svg'), 'utf8'))
const out = async (file: string, data: Buffer | string) => {
  await writeFile(file, data)
  console.log(`brand: ${file.slice(ROOT.length + 1)} (${(Buffer.byteLength(data) / 1024).toFixed(1)} KB)`)
}

// Lockups
const L = lockups(markSvg, wm, T.text)
await out(resolve(BRAND, 'lockup.svg'), L.horizontal)
await out(resolve(BRAND, 'lockup-stacked.svg'), L.stacked)

// Pixel mark
const px = outline(PIXEL_MARK)
const px1 = pixelRaster(px)
await out(resolve(BRAND, 'mark-16.png'), await px1.png())
await out(resolve(ICONS, 'favicon.svg'), pixelSvg(px))
await out(resolve(ICONS, 'favicon-32.png'), await px1.scale(2).png())

// App icons (vector — at 180px and up the full mark has room)
const ICON_SET = [
  { file: 'icon-192.png', size: 192, inset: 0.74, shape: 'squircle' as const },
  { file: 'icon-512.png', size: 512, inset: 0.74, shape: 'squircle' as const },
  // Maskable: full-bleed ground, and the disc inside the 80% safe circle with
  // room to spare (the disc's diameter is 58% of the tile).
  { file: 'icon-192-maskable.png', size: 192, inset: 0.58, shape: 'square' as const },
  { file: 'icon-512-maskable.png', size: 512, inset: 0.58, shape: 'square' as const },
  // iOS masks it itself and composites alpha onto black: opaque, full-bleed.
  { file: 'apple-touch-icon.png', size: 180, inset: 0.68, shape: 'square' as const },
]
for (const t of ICON_SET) {
  await out(resolve(ICONS, t.file), await sharp(Buffer.from(iconSvg(markSvg, t.size, t.inset, t.shape))).png({ compressionLevel: 9 }).toBuffer())
}

// iOS app (Capacitor). The App Store rejects an icon with any alpha, so the
// alpha channel is dropped, not just left opaque. The launch image is cropped
// to the screen's shape (aspect-fill), so the disc sits small in the middle,
// where every phone keeps it.
const APP_ICON = await sharp(Buffer.from(iconSvg(markSvg, 1024, 0.68, 'square'))).removeAlpha().png({ compressionLevel: 9 }).toBuffer()
await out(resolve(XCASSETS, 'AppIcon.appiconset/AppIcon-512@2x.png'), APP_ICON)
const LAUNCH = await sharp(Buffer.from(iconSvg(markSvg, 2732, 0.16, 'square'))).removeAlpha().png({ compressionLevel: 9 }).toBuffer()
for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await out(resolve(XCASSETS, 'Splash.imageset', f), LAUNCH)
}

// Scenes
const S = await loadSprites()
// Social card: the 600×315 scene at exactly 2×, lockup and line in the sky.
const og = scene(S, { w: 600, h: 315, ground: 150 }).scale(2)
const ogLock = lockups(markSvg, wm, T.text)
const lockW = 700
const lockH = Math.round((lockW / ogLock.hW) * 48)
const ogBase = sharp(await og.png())
const lockPng = await svgPng(ogLock.horizontal, lockW, lockH)
const tagline = await readFile(resolve(BRAND, 'tagline.svg'), 'utf8')
const tl = parseWordmark(tagline)
const tagW = 640
const tagH = Math.round((tagW / tl.w) * tl.h)
const tagSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${tl.x} ${tl.y} ${tl.w} ${tl.h}" width="${tagW}" height="${tagH}"><path fill="${T.gold}" d="${tl.d}"/></svg>`
await out(
  resolve(SOCIAL, 'og-image.png'),
  await ogBase
    .composite([
      { input: lockPng, left: Math.round((1200 - lockW) / 2), top: 48 },
      { input: await svgPng(tagSvg, tagW, tagH), left: Math.round((1200 - tagW) / 2), top: 48 + lockH + 22 },
    ])
    .png({ palette: true, colours: 256, dither: 0, effort: 10 })
    .toBuffer(),
)

// ── identity sheet (documentation, not shipped)
{
  const W = 1400
  const cell = (label: string, x: number, y: number) =>
    `<text x="${x}" y="${y}" font-family="DejaVu Sans, sans-serif" font-size="13" fill="#b89e7e">${label}</text>`
  const monoOn = (c: string) => monoSvg.replace(/currentColor/g, c)
  const blocks: OverlayOptions[] = []
  let labels = ''
  const put = async (buf: Buffer, x: number, y: number, label?: string) => {
    blocks.push({ input: buf, left: x, top: y })
    if (label) labels += cell(label, x, y - 10)
  }
  // Row 1: the mark in its three colour ways at 200px
  await put(await svgPng(markSvg, 200), 40, 80, 'Full colour · on dark wood')
  await put(await svgPng(monoOn(T.gold), 200), 290, 80, 'One colour · gold')
  await put(await svgPng(monoOn(T.ink), 200), 540, 80, 'One colour · ink on parchment')
  await put(await svgPng(monoOn('#000000'), 200), 790, 80, 'One colour · black (print)')
  // Reduction ladder, vector vs pixel
  let x = 1040
  for (const s of [64, 32, 16]) {
    await put(await svgPng(markSvg, s), x, 80, s === 64 ? 'Vector 64 / 32 / 16' : undefined)
    x += s + 16
  }
  x = 1040
  await put(await px1.png(), x, 190, 'Pixel 16 · 1× 2× 4× 8×')
  await put(await px1.scale(2).png(), x + 28, 190)
  await put(await px1.scale(4).png(), x + 72, 190)
  await put(await px1.scale(8).png(), x + 148, 170)
  // Row 2: lockups
  await put(await svgPng(L.horizontal, 520, Math.round((520 / L.hW) * 48)), 40, 330, 'Primary lockup · horizontal')
  await put(await svgPng(L.stacked, 220, Math.round((220 / L.sW) * 68)), 620, 330, 'Stacked')
  const inkLock = lockups(monoSvg.replace(/currentColor/g, T.ink), wm, T.ink)
  await put(await svgPng(inkLock.horizontal, 400, Math.round((400 / inkLock.hW) * 48)), 900, 358, 'One colour lockup · on parchment')
  // Row 3: app icons + favicon
  x = 40
  for (const t of ICON_SET) {
    const s = t.size > 200 ? 160 : 120
    await put(await sharp(Buffer.from(iconSvg(markSvg, s, t.inset, t.shape))).png().toBuffer(), x, 580, t.file.replace('.png', ''))
    if (t.shape === 'square' && t.file.includes('maskable')) {
      // overlay the 80% safe zone circle
      const sz = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s * 0.4}" fill="none" stroke="#6fce88" stroke-dasharray="4 3" stroke-width="1.5"/></svg>`
      blocks.push({ input: Buffer.from(sz), left: x, top: 580 })
    }
    x += s + 40
  }
  await put(await px1.scale(2).png(), x, 560, 'favicon 32 · 16')
  await put(await px1.png(), x + 60, 560)
  // A mock browser tab on light and dark chrome
  const tab = (bg: string, fg: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="36"><rect width="220" height="36" rx="8" fill="${bg}"/><text x="40" y="23" font-family="DejaVu Sans, sans-serif" font-size="13" fill="${fg}">Fieldwatch</text></svg>`
  await put(await sharp(Buffer.from(tab('#f1f1f1', '#222'))).png().toBuffer(), x, 640, 'Tab · light / dark')
  blocks.push({ input: await px1.png(), left: x + 14, top: 650 })
  await put(await sharp(Buffer.from(tab('#35363a', '#eee'))).png().toBuffer(), x, 690)
  blocks.push({ input: await px1.png(), left: x + 14, top: 700 })

  const H = 780
  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${T.bg}"/>
    <rect x="530" y="76" width="220" height="210" rx="6" fill="${T.paper}"/>
    <rect x="780" y="76" width="220" height="210" rx="6" fill="#ffffff"/>
    <rect x="20" y="552" width="880" height="200" rx="8" fill="${T.panel}"/>
    <rect x="880" y="350" width="440" height="100" rx="6" fill="${T.paper}"/>
    <text x="40" y="30" font-family="DejaVu Sans, sans-serif" font-size="16" font-weight="bold" fill="${T.text}">Fieldwatch — identity sheet (generated by scripts/brand.ts)</text>
    ${labels}
  </svg>`
  await out(resolve(DOCS, 'identity-sheet.png'), await sharp(Buffer.from(bgSvg)).composite(blocks).png({ compressionLevel: 9 }).toBuffer())
}
