/**
 * Odile designs — the card kit shared by the later runners (odile-bodies.ts,
 * odile-final.ts): the measure line, on-grass line-ups, the loop and the
 * page shot. Exploration only; nothing here is wired into the game.
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { H, W, idleFrames, measure, misses, orphans, overlap, render, strangers, ticFrames, type Design, type Rgba } from './odile-lib'
import { PACK_INKS } from './odile-common'

export const ROOT = resolve(import.meta.dirname, '..', '..')
export const PACK = join(ROOT, 'public', 'assets', 'sprites', 'tinyswords')
export const OUT = join(ROOT, 'docs', 'characters', 'cards', 'designs', 'odile')

export const png = (img: Rgba, scale = 1) =>
  sharp(Buffer.from(img.data), { raw: { width: img.w, height: img.h, channels: 4 } })
    .resize(img.w * scale, img.h * scale, { kernel: 'nearest' })
    .png()
    .toBuffer()

export async function readPack(file: string): Promise<Rgba> {
  const { data, info } = await sharp(join(PACK, `${file}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { w: info.width, h: info.height, data: new Uint8ClampedArray(data) }
}

export function crop(img: Rgba, x: number, y: number, w: number, h: number): Rgba {
  const out = new Uint8ClampedArray(w * h * 4)
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const sx = x + c, sy = y + r
      if (sx < 0 || sy < 0 || sx >= img.w || sy >= img.h) continue
      const si = (sy * img.w + sx) * 4, di = (r * w + c) * 4
      for (let k = 0; k < 4; k++) out[di + k] = img.data[si + k]
    }
  return { w, h, data: out }
}

export function frameBox(frames: Rgba[]) {
  let x0 = W, y0 = H, x1 = 0, y1 = 0
  for (const f of frames)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (f.data[(y * W + x) * 4 + 3]) {
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
        }
  return { x: Math.max(0, x0 - 2), y: Math.max(0, y0 - 2), w: Math.min(W, x1 + 3) - Math.max(0, x0 - 2), h: Math.min(H, y1 + 3) - Math.max(0, y0 - 2) }
}

export function report(d: Design) {
  const still = render(d)
  const m = measure(still, d.headBottom)
  const miss = misses(m)
  const alien = [...new Set([still, ...idleFrames(d), ...ticFrames(d)].flatMap((f) => strangers(f, PACK_INKS)))]
  if (alien.length) miss.push(`not pack inks: ${alien.join(' ')}`)
  const clash = overlap(d)
  if (clash) miss.push(`a prop touches the head mass (${clash} px)`)
  const f2 = (v: number) => v.toFixed(2)
  if (process.argv.includes('--colours')) {
    const inv = new Map(Object.entries(d.pal).map(([l, h]) => [h, l]))
    const count = new Map<string, number>()
    let n = 0
    for (let i = 0; i < still.data.length; i += 4) {
      if (still.data[i + 3] < 200) continue
      n++
      const hx = '#' + [0, 1, 2].map((j) => still.data[i + j].toString(16).padStart(2, '0')).join('')
      count.set(hx, (count.get(hx) ?? 0) + 1)
    }
    console.log(`  ${d.id} colours:`, [...count].sort((a, b) => b[1] - a[1]).map(([h, c]) => `${inv.get(h) ?? 'k'} ${((c / n) * 100).toFixed(1)}%`).join(' · '))
  }
  console.log(
    `${d.id.padEnd(9)} ${m.box.w}x${m.box.h} fill ${f2(m.fill)} aspect ${f2(m.aspect)} head ${f2(m.headShare)} top ${f2(m.topMass)} legs ${f2(m.legShare)} line ${f2(m.outlinePx)} colours ${m.colours} orphans ${orphans(still, ['#ffffff', '#ffcfb4', '#ffed44', '#efe1ab', '#d0deb5', '#bdd763'])} clearance ${clash ? clash + ' px' : 'clear'}  ${miss.length ? 'MISS ' + miss.join('; ') : 'ok'}`,
  )
}

/** Figures on the pack's grass, bottoms on one line. */
export async function onGrass(imgs: Rgba[], s: number, gap = 4): Promise<Buffer> {
  const g = gap * s
  const hh = Math.max(...imgs.map((i) => i.h)) * s + g * 2
  const ww = imgs.reduce((a, i) => a + i.w * s + g, g)
  const grass = await sharp(join(PACK, 'grass.png')).resize(64 * Math.max(1, Math.round(s / 2)), 64 * Math.max(1, Math.round(s / 2)), { kernel: 'nearest' }).png().toBuffer()
  let x = g
  const comp: { input: Buffer; left: number; top: number }[] = []
  for (const img of imgs) {
    comp.push({ input: await png(img, s), left: x, top: hh - g - img.h * s })
    x += img.w * s + g
  }
  return sharp({ create: { width: ww, height: hh, channels: 4, background: '#79a863' } })
    .composite([{ input: grass, tile: true, left: 0, top: 0 }, ...comp])
    .png()
    .toBuffer()
}

export async function shoot(html: string, path: string, width: number) {
  const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  const { chromium } = await import(process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs')
  const b = await chromium.launch(existsSync(EXEC) ? { executablePath: EXEC } : {})
  const page = await b.newPage({ viewport: { width, height: 200 } })
  await page.setContent(html)
  await page.waitForLoadState('load')
  await page.screenshot({ path, fullPage: true })
  await b.close()
}

export const b64 = (buf: Buffer) => `data:image/png;base64,${buf.toString('base64')}`

/** A 3 s loop at 4× on grass: the idle twice, the tic, then the idle to fill 3 s (lossless animated WebP). */
export async function motion(d: Design, path: string) {
  const S = 4, pad = 8
  const idle = idleFrames(d)
  const tic = ticFrames(d)
  const box = frameBox([...idle, ...tic])
  const grass = await sharp(join(PACK, 'grass.png')).resize(128, 128, { kernel: 'nearest' }).png().toBuffer()
  const cw = box.w * S + pad * 2, ch = box.h * S + pad * 2
  const bg = await sharp({ create: { width: cw, height: ch, channels: 4, background: '#79a863' } }).composite([{ input: grass, tile: true, left: 0, top: 0 }]).png().toBuffer()
  const seq: { img: Rgba; ms: number }[] = []
  idle.forEach((img, i) => seq.push({ img, ms: d.idleMs[i] }))
  idle.forEach((img, i) => seq.push({ img, ms: d.idleMs[i] }))
  tic.forEach((img, i) => seq.push({ img, ms: d.ticMs[i] }))
  for (let k = 0, t = seq.reduce((a, s) => a + s.ms, 0); t < 3000; k++) {
    const ms = Math.min(d.idleMs[k % idle.length], 3000 - t)
    seq.push({ img: idle[k % idle.length], ms })
    t += ms
  }
  const frames: Buffer[] = []
  for (const s of seq) {
    const fig = await png(crop(s.img, box.x, box.y, box.w, box.h), S)
    frames.push(await sharp(bg).composite([{ input: fig, left: pad, top: pad }]).raw().toBuffer())
  }
  await sharp(Buffer.concat(frames), { raw: { width: cw, height: ch * frames.length, channels: 4, pageHeight: ch } })
    .webp({ lossless: true, loop: 0, delay: seq.map((s) => s.ms) })
    .toFile(path)
}

