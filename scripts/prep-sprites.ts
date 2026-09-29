/**
 * prep-sprites.ts — build box-filtered x1/2 downscales of the Tiny Swords pack
 * into `public/assets/sprites/tinyswords@half/`, so the renderer can draw them
 * at 1:1 instead of minifying them live.
 *
 *   npx tsx scripts/prep-sprites.ts           # rebuild the @half pack
 *   npx tsx scripts/prep-sprites.ts --check   # report what WOULD change
 *
 * ## What problem this solves
 *
 * The field currently draws every sprite through a non-integer minification.
 * A 115x80 goblin lands in roughly a 20x14 box, so the browser reconstructs it
 * from about 3% of its own pixels — and because the scale factor is fractional
 * and the entity moves, it picks a DIFFERENT 3% each frame. That is the crawl:
 * edges shimmer, single-pixel details strobe in and out, and the pixel grid
 * visibly swims under motion. Canvas 2D gives no control over the filter beyond
 * `imageSmoothingEnabled`, and neither setting fixes it: smoothing on turns
 * pixel art to mush, smoothing off is nearest-neighbour, which is precisely the
 * filter that drops 97% of the source and aliases hardest.
 *
 * The fix has two halves. The renderer composites the field to an offscreen
 * buffer at 1:1 logical pixels, draws sprites at a UNIFORM INTEGER scale, and
 * blits once. This script is the other half: it supplies art that is already
 * the right size, resampled properly, offline.
 *
 * ## Why an offline box filter beats runtime nearest-neighbour
 *
 * Nearest-neighbour picks one source pixel per destination pixel and discards
 * the rest. It is a point sample of a signal with far more detail than the
 * destination grid can hold, so it aliases — and the aliasing pattern depends on
 * exactly where the sample lands, which is why it crawls when things move.
 *
 * A box (area-average) filter integrates every source pixel covering a
 * destination pixel. Nothing is discarded; at exactly x1/2 each output pixel is
 * the mean of one clean 2x2 block. That is the correct band-limiting step, it is
 * stable frame to frame, and it costs nothing at runtime because it happened
 * here. The runtime then does a 1:1 blit, which has no filter at all and so
 * cannot crawl.
 *
 * Averaging is done in PREMULTIPLIED alpha. Averaging straight RGBA lets the
 * colour of fully transparent pixels (usually black) bleed into the edges and
 * leaves a dark fringe around every sprite.
 *
 * ## Animation strips
 *
 * `*_walk`, `*_idle` and `*_atk` are horizontal N-frame strips; frame counts
 * come from `src/game/render/anim.ts`, which is imported rather than duplicated
 * so the two cannot drift. Each frame is resampled INSIDE ITS OWN CELL. Filter
 * a strip as one image and the 2x2 blocks straddle the frame boundaries,
 * smearing the last column of frame 3 into the first column of frame 4 — one
 * pixel of the wrong pose bleeding into every frame edge.
 *
 * Four strips have ODD frame widths (torch 115, rogue_idle 71, rogue_atk 87,
 * mystic_atk 97), which cannot halve exactly. Those cells are padded to an even
 * width with transparent pixels first, so the box grid stays aligned to the
 * cell rather than drifting across the strip.
 *
 * ## The halo
 *
 * Field sprites carry a 1px outline — `#161C2E` at alpha 80 — so they read
 * against grass. It is STRIPPED before resampling and REDRAWN at the new size,
 * rather than being filtered along with the art. Box-filtering an outline halves
 * its opacity and smears it to two half-strength pixels, which at this size is
 * the difference between an outline and a grey haze. Redrawing gives a true 1px
 * ring at the intended alpha.
 *
 * Detection keys on the exact `#161C2E` + alpha 80 pair, so genuine
 * semi-transparent art survives — `tree4.png` (the stump) carries 102 px of soft
 * drop shadow at alpha 69 that must NOT be mistaken for halo and deleted.
 *
 * Each output cell is `ceil(cellW / 2) + 2` wide and `ceil(cellH / 2) + 2` tall:
 * the +2 is the redrawn ring, and giving every cell its own margin is what keeps
 * a frame's halo from leaking into its neighbour. Frame width therefore stays
 * `width / frames`, exactly as `anim.ts` expects.
 *
 * `grass.png` is exempt from all of the above: it is a seamless terrain tile, so
 * it is halved as a plain 64x64 -> 32x32 block average with no trim, no padding
 * and no ring. Adding a halo to it would draw a grid over the field.
 *
 * ## Re-running
 *
 * Run it after any change to the pack — `scripts/harvest-cc0.ts` rewrites the
 * source art, so run this second. Output is deterministic: same input, same
 * bytes. `--check` prints the before/after table without writing.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { ANIM_FRAMES } from '../src/game/render/anim'

const ROOT = resolve(import.meta.dirname, '..')
const SRC = join(ROOT, 'public', 'assets', 'sprites', 'tinyswords')
const OUT = join(ROOT, 'public', 'assets', 'sprites', 'tinyswords@half')
const CHECK_ONLY = process.argv.includes('--check')

/** The outline colour and alpha. Detection requires an exact match on both. */
const HALO = { r: 0x16, g: 0x1c, b: 0x2e, a: 80 }
/** Seamless terrain tiles: halved raw, never trimmed, never haloed. */
const TILES = new Set(['grass', 'road'])

type Img = { d: Buffer; w: number; h: number }

const px = (img: Img, x: number, y: number): number => (y * img.w + x) * 4

async function load(p: string): Promise<Img> {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { d: data, w: info.width, h: info.height }
}

const blank = (w: number, h: number): Img => ({ d: Buffer.alloc(w * h * 4), w, h })

/** Copy a rectangle out of `src` into a fresh image. */
function cell(src: Img, x0: number, w: number): Img {
  const out = blank(w, src.h)
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < w; x++) {
      const sx = x0 + x
      if (sx >= src.w) continue
      for (let k = 0; k < 4; k++) out.d[px(out, x, y) + k] = src.d[px(src, sx, y) + k]
    }
  return out
}

/** Blank every pixel that is exactly the halo colour at exactly the halo alpha. */
function stripHalo(img: Img): { img: Img; removed: number } {
  const out: Img = { d: Buffer.from(img.d), w: img.w, h: img.h }
  let removed = 0
  for (let i = 0; i < out.d.length; i += 4) {
    if (out.d[i + 3] !== HALO.a) continue
    if (out.d[i] !== HALO.r || out.d[i + 1] !== HALO.g || out.d[i + 2] !== HALO.b) continue
    out.d[i] = out.d[i + 1] = out.d[i + 2] = out.d[i + 3] = 0
    removed++
  }
  return { img: out, removed }
}

/**
 * Exact x1/2 area average, in premultiplied alpha.
 *
 * Each destination pixel integrates the 2x2 source block that maps onto it,
 * clipped at the edges so an odd dimension keeps its last row/column instead of
 * dropping it. Straight (non-premultiplied) averaging would pull the RGB of
 * transparent pixels into the edge and fringe every sprite dark.
 */
function boxHalve(src: Img): Img {
  const w = Math.ceil(src.w / 2)
  const h = Math.ceil(src.h / 2)
  const out = blank(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const sx = x * 2 + dx, sy = y * 2 + dy
          if (sx >= src.w || sy >= src.h) continue
          const i = px(src, sx, sy)
          const al = src.d[i + 3] / 255
          r += src.d[i] * al; g += src.d[i + 1] * al; b += src.d[i + 2] * al
          a += src.d[i + 3]
          n++
        }
      if (!n) continue
      const i = px(out, x, y)
      const aAvg = a / n
      out.d[i + 3] = Math.round(aAvg)
      if (aAvg <= 0) continue
      // Un-premultiply through the AVERAGED alpha:
      //   mean premultiplied channel = r / n
      //   divide by mean alpha (aAvg / 255)  =>  (r / n) * 255 / aAvg
      const k = 255 / (aAvg * n)
      out.d[i] = Math.min(255, Math.round(r * k))
      out.d[i + 1] = Math.min(255, Math.round(g * k))
      out.d[i + 2] = Math.min(255, Math.round(b * k))
    }
  return out
}

/** Place `src` at (1,1) on a canvas 2px larger, then draw the 1px outline ring. */
function padAndHalo(src: Img): Img {
  const out = blank(src.w + 2, src.h + 2)
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++)
      for (let k = 0; k < 4; k++) out.d[px(out, x + 1, y + 1) + k] = src.d[px(src, x, y) + k]
  const snap = Buffer.from(out.d)
  const N = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const i = px(out, x, y)
      if (snap[i + 3] !== 0) continue
      let near = false
      for (const [dx, dy] of N) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= out.w || ny >= out.h) continue
        if (snap[(ny * out.w + nx) * 4 + 3] > 0) { near = true; break }
      }
      if (!near) continue
      out.d[i] = HALO.r; out.d[i + 1] = HALO.g; out.d[i + 2] = HALO.b; out.d[i + 3] = HALO.a
    }
  return out
}

/** Lay cells left to right into one strip. */
function joinCells(cells: Img[]): Img {
  const cw = cells[0].w, ch = cells[0].h
  const out = blank(cw * cells.length, ch)
  cells.forEach((c, f) => {
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++)
        for (let k = 0; k < 4; k++) out.d[px(out, f * cw + x, y) + k] = c.d[px(c, x, y) + k]
  })
  return out
}

const write = (img: Img, p: string): Promise<unknown> =>
  sharp(img.d, { raw: { width: img.w, height: img.h, channels: 4 } })
    .png({ compressionLevel: 9, palette: true })
    .toFile(p)

type Row = {
  file: string; frames: number
  src: string; out: string
  srcFrame: string; outFrame: string
  srcBytes: number; outBytes: number
}

async function main(): Promise<void> {
  if (!CHECK_ONLY) mkdirSync(OUT, { recursive: true })
  const files = readdirSync(SRC).filter((f) => f.endsWith('.png')).sort()
  const rows: Row[] = []
  let haloTotal = 0

  for (const f of files) {
    const name = f.replace(/\.png$/, '')
    const srcPath = join(SRC, f)
    const outPath = join(OUT, f)
    const src = await load(srcPath)
    const frames = ANIM_FRAMES[name] ?? 1
    let out: Img

    if (TILES.has(name)) {
      // seamless tile: plain halve, no ring, no padding
      out = boxHalve(src)
    } else {
      if (src.w % frames !== 0)
        throw new Error(`${f}: width ${src.w} is not divisible by ${frames} frames`)
      const cw = src.w / frames
      const cells: Img[] = []
      for (let i = 0; i < frames; i++) {
        // pad an odd cell to even so the 2x2 grid stays aligned to the cell
        const padded = cw % 2 === 0 ? cell(src, i * cw, cw) : cell(src, i * cw, cw + 1)
        const { img: bare, removed } = stripHalo(padded)
        haloTotal += removed
        cells.push(padAndHalo(boxHalve(bare)))
      }
      out = joinCells(cells)
    }

    if (!CHECK_ONLY) await write(out, outPath)
    rows.push({
      file: f, frames,
      src: `${src.w}x${src.h}`, out: `${out.w}x${out.h}`,
      srcFrame: `${src.w / frames}x${src.h}`, outFrame: `${out.w / frames}x${out.h}`,
      srcBytes: readFileSync(srcPath).length,
      // In --check the file was not rewritten, so report the one already on disk.
      outBytes: existsSync(outPath) ? readFileSync(outPath).length : 0,
    })
  }

  // A machine-readable index so the renderer does not have to probe dimensions.
  const index = {
    generatedBy: 'scripts/prep-sprites.ts',
    scale: 0.5,
    filter: 'box (area average, premultiplied alpha)',
    halo: { color: '#161C2E', alpha: HALO.a, width: 1, redrawn: true },
    sprites: Object.fromEntries(rows.map((r) => [
      r.file.replace(/\.png$/, ''),
      { frames: r.frames, width: parseInt(r.out), height: parseInt(r.out.split('x')[1]), frameWidth: parseInt(r.outFrame) },
    ])),
  }
  if (!CHECK_ONLY) writeFileSync(join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n')

  const wide = Math.max(...rows.map((r) => r.file.length))
  console.log(`${'file'.padEnd(wide)}  fr   source        ->  half          source frame -> half frame     bytes`)
  console.log('-'.repeat(wide + 74))
  for (const r of rows)
    console.log(
      `${r.file.padEnd(wide)}  ${String(r.frames).padStart(2)}   ${r.src.padEnd(12)} ->  ${r.out.padEnd(12)}  ` +
      `${r.srcFrame.padEnd(11)} -> ${r.outFrame.padEnd(11)}  ${String(r.srcBytes).padStart(6)} -> ${String(r.outBytes).padStart(5)}`,
    )
  const sb = rows.reduce((n, r) => n + r.srcBytes, 0), ob = rows.reduce((n, r) => n + r.outBytes, 0)
  console.log(
    `\n${rows.length} sprites · halo pixels stripped and redrawn: ${haloTotal}\n` +
    `full pack ${(sb / 1024).toFixed(1)} KB -> half pack ${(ob / 1024).toFixed(1)} KB ` +
    `(${((ob / sb) * 100).toFixed(0)}% of the original)`,
  )
}

await main()
