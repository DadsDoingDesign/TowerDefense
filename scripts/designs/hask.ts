/**
 * Hask — ten brand-new character designs at the Tiny Swords pack's scale
 * (exploration cards for the designer; nothing here is wired into the game).
 *
 *   npx tsx scripts/designs/hask.ts                 # measure all ten against the pack's bands, audit inks and clearance
 *   npx tsx scripts/designs/hask.ts --preview DIR [id]   # 8× stills + 1×/3× line-ups for the critique rounds
 *   npx tsx scripts/designs/hask.ts --cards         # the cards in docs/characters/cards/designs/hask/
 *
 * Every figure is a hand-authored pixel map (hask-d01.ts … hask-d10.ts);
 * hask-lib.ts only stamps the pack's outline and composes the frames. The
 * pack figures shown beside them are the old-CC0 stills already shipped in
 * public/assets/sprites/tinyswords/ (see sprites/CREDITS.md).
 *
 * Two audits run with the measure:
 * - inks: every colour a design uses must be in the old-CC0 pack's palette
 *   (read from the harvest cache, node_modules/.cache/cc0-pack, when present);
 * - clearance (the designer's note on Saffra: "a different item that doesn't
 *   overlap w the hat"): no prop or effect pixel, in any frame, may touch the
 *   head mass (the head group with its ink ring).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { H, INK, W, idleFrames, measure, misses, orphans, render, ticFrames, type Design, type Frame, type Rgba } from './hask-lib'
import { DESIGNS } from './hask-all'

const ROOT = resolve(import.meta.dirname, '..', '..')
export const PACK = join(ROOT, 'public', 'assets', 'sprites', 'tinyswords')
const CC0_CACHE = join(ROOT, 'node_modules', '.cache', 'cc0-pack')
const OUT = join(ROOT, 'docs', 'characters', 'cards', 'designs', 'hask')

export const png = (img: Rgba, scale = 1) =>
  sharp(Buffer.from(img.data), { raw: { width: img.w, height: img.h, channels: 4 } })
    .resize(img.w * scale, img.h * scale, { kernel: 'nearest' })
    .png()
    .toBuffer()

export async function readPack(file: string): Promise<Rgba> {
  const { data, info } = await sharp(join(PACK, `${file}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { w: info.width, h: info.height, data: new Uint8ClampedArray(data) }
}

export const PACK_PEOPLE = [
  { file: 'mystic', name: 'Pawn' },
  { file: 'fighter', name: 'Knight' },
  { file: 'rogue', name: 'Archer' },
  { file: 'torch1', name: 'Torch goblin' },
]

/** Every opaque colour of the old-CC0 pack (the harvest cache), or null when the cache is absent. */
export async function cc0Palette(): Promise<Set<string> | null> {
  if (!existsSync(CC0_CACHE)) return null
  const files: string[] = []
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (p.endsWith('.png')) files.push(p)
    }
  }
  walk(CC0_CACHE)
  const set = new Set<string>()
  for (const f of files) {
    const { data } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 250) set.add('#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join(''))
  }
  return set
}

/** The inks a design actually puts down (every frame). */
function inksUsed(d: Design): Set<string> {
  const used = new Set<string>([INK])
  for (const p of d.parts) for (const row of p.rows) for (const ch of row) if (ch !== '.' && ch !== 'k' && ch !== 's') used.add(d.pal[ch])
  for (const f of [...d.idle, ...d.tic]) for (const rows of Object.values(f.swap ?? {})) for (const row of rows) for (const ch of row) if (ch !== '.' && ch !== 'k' && ch !== 's') used.add(d.pal[ch])
  return used
}

/** A frame with only some groups' parts. */
function only(d: Design, groups: readonly string[], f: Frame): Rgba {
  return render({ ...d, parts: d.parts.filter((p) => groups.includes(p.group)) }, f)
}

/** Prop / effect pixels that touch the head mass (head group plus its ink ring), per frame. */
function clearance(d: Design): string[] {
  const bad: string[] = []
  ;[...d.idle, ...d.tic].forEach((f, i) => {
    const head = only(d, ['head'], f)
    const prop = only(d, ['prop', 'fx'], f)
    let hits = 0
    for (let k = 3; k < W * H * 4; k += 4) if (head.data[k] && prop.data[k]) hits++
    if (hits) bad.push(`frame ${i}: ${hits} px`)
  })
  return bad
}

export function report(d: Design, cc0: Set<string> | null) {
  const still = render(d)
  const m = measure(still, d.headBottom)
  const miss = misses(m)
  const orph = orphans(still, ['#ffffff', '#ffed44', '#bdd763', '#fffce7', '#f1da84', '#efe1ab'])
  const off = cc0 ? [...inksUsed(d)].filter((c) => !cc0.has(c)) : []
  const clash = clearance(d)
  const f2 = (v: number) => v.toFixed(2)
  console.log(
    `${d.id} ${d.title.padEnd(20)} ${m.box.w}x${m.box.h} fill ${f2(m.fill)} aspect ${f2(m.aspect)} head ${f2(m.headShare)} top ${f2(m.topMass)} legs ${f2(m.legShare)} line ${f2(m.outlinePx)} inked ${f2(m.inkedEdge)} colours ${m.colours} orphans ${orph}` +
      `  ${miss.length ? 'MISS ' + miss.join('; ') : 'bands ok'}` +
      `  ${cc0 ? (off.length ? 'NOT CC0 ' + off.join(' ') : 'inks cc0') : 'inks unchecked (no cc0 cache)'}` +
      `  ${clash.length ? 'PROP ON HEAD ' + clash.join(', ') : 'head clear'}`,
  )
  return { m, miss, off, clash }
}

async function browser() {
  const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  const { chromium } = await import(process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs')
  return chromium.launch(existsSync(EXEC) ? { executablePath: EXEC } : {})
}

export const b64 = (buf: Buffer) => `data:image/png;base64,${buf.toString('base64')}`

export async function shoot(html: string, path: string, width: number) {
  const b = await browser()
  const page = await b.newPage({ viewport: { width, height: 200 } })
  await page.setContent(html)
  await page.waitForLoadState('load')
  await page.screenshot({ path, fullPage: true })
  await b.close()
}

export const CSS = (grass: string) => `body{margin:0;background:#1b2130;font:14px/1.35 system-ui,sans-serif;color:#eef0e6}
img{image-rendering:pixelated;display:block}
.grass{background:url(${grass}) repeat;image-rendering:pixelated}`

async function preview(dir: string, pick?: string) {
  mkdirSync(dir, { recursive: true })
  const tag = process.env.TAG ?? 0
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pack = await Promise.all(PACK_PEOPLE.map(async (p) => ({ ...p, img: await readPack(p.file) })))
  const packAt = async (s: number) => (await Promise.all(pack.map(async (p) => `<img src="${b64(await png(p.img, s))}">`))).join('')
  for (const d of DESIGNS) {
    if (pick && !pick.split(',').includes(d.id)) continue
    const still = render(d)
    const b = frameBox([still])
    const c8 = crop(still, b.x0 - 2, b.y0 - 2, b.x1 - b.x0 + 5, b.y1 - b.y0 + 5)
    await sharp(await png(c8, 8)).flatten({ background: '#79a863' }).toFile(join(dir, `${d.id}-8x-${tag}.png`))
    const frames = [...idleFrames(d), ...ticFrames(d)]
    const strip = await Promise.all(frames.map((f) => png(crop(f, b.x0 - 4, b.y0 - 8, b.x1 - b.x0 + 9, b.y1 - b.y0 + 12), 3)))
    const html = `<!doctype html><style>${CSS(grass)} .row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px;padding:8px}</style>
      <div class="grass row">${await packAt(3)}<img src="${b64(await png(still, 3))}"></div>
      <div class="grass row">${await packAt(1)}<img src="${b64(await png(still, 1))}"></div>
      <div class="grass row" style="flex-wrap:wrap">${strip.map((s) => `<img src="${b64(s)}">`).join('')}</div>`
    await shoot(html, join(dir, `${d.id}-lineup-${tag}.png`), 1300)
  }
  const all = frameBox(DESIGNS.map((d) => render(d)))
  const cut = (img: Rgba) => crop(img, all.x0 - 1, all.y0 - 1, all.x1 - all.x0 + 3, all.y1 - all.y0 + 3)
  const html = `<!doctype html><style>${CSS(grass)} .row{display:flex;align-items:flex-end;gap:0;padding:6px;flex-wrap:wrap}</style>
    <div class="grass row">${await packAt(3)}${(await Promise.all(DESIGNS.map(async (d) => `<img src="${b64(await png(cut(render(d)), 3))}">`))).join('')}</div>
    <div class="grass row">${await packAt(1)}${(await Promise.all(DESIGNS.map(async (d) => `<img src="${b64(await png(cut(render(d)), 1))}">`))).join('')}</div>`
  await shoot(html, join(dir, `all-lineup-${tag}.png`), 1400)
}

// ── the cards ─────────────────────────────────────────────────────────────────

/** Crop a frame to a box so the cards don't waste space. */
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

/** The union box of every frame of a design (opaque or shadow). */
export function frameBox(frames: Rgba[]) {
  let x0 = W, y0 = H, x1 = 0, y1 = 0
  for (const f of frames)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (f.data[(y * W + x) * 4 + 3]) {
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
        }
  return { x0, y0, x1, y1 }
}

async function cards() {
  mkdirSync(OUT, { recursive: true })
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pack = await Promise.all(PACK_PEOPLE.map(async (p) => ({ ...p, img: await readPack(p.file) })))
  const pawn = pack[0].img
  const knight = pack[1].img
  // one shared box over every frame of all ten, so the feet share a line and nothing is clipped
  const all = frameBox(DESIGNS.flatMap((d) => [...idleFrames(d), ...ticFrames(d)]))
  const BOX = { x0: Math.max(0, all.x0 - 1), y0: Math.max(0, all.y0 - 1), w: Math.min(W, all.x1 + 2) - Math.max(0, all.x0 - 1), h: Math.min(H, all.y1 + 2) - Math.max(0, all.y0 - 1) }
  const cut = (img: Rgba) => crop(img, BOX.x0, BOX.y0, BOX.w, BOX.h)
  const cell = async (img: Rgba, s: number) => b64(await png(img, s))

  // sheet.png: all ten at 3×, numbered and named, with the pawn and the knight at 3×
  const sheetCells = await Promise.all(
    DESIGNS.map(async (d, i) => `<div class="c"><div class="n">${i + 1}</div><img src="${await cell(cut(render(d)), 3)}"><b>${d.title}</b></div>`),
  )
  const refCells = [`<div class="c ref"><img src="${await cell(pawn, 3)}"><b>CC0 pawn</b></div>`, `<div class="c ref"><img src="${await cell(knight, 3)}"><b>CC0 knight</b></div>`]
  const sheet = `<!doctype html><meta charset="utf-8"><style>${CSS(grass)}
    .wrap{padding:14px}
    h1{font-size:22px;margin:0 0 2px} p{margin:0 0 10px;color:#c9cbbf;font-size:14px}
    .g{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-radius:8px;overflow:hidden}
    .c{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:6px 0 10px}
    .c b{font-size:18px;color:#fff;text-shadow:0 2px 0 #161c2e,0 0 4px #161c2e;margin-top:-4px}
    .c.ref b{color:#ffe46b}
    .n{position:absolute;left:10px;top:8px;width:32px;height:32px;border-radius:16px;background:#161c2e;color:#ffe46b;font-weight:700;font-size:18px;display:flex;align-items:center;justify-content:center}
    </style><div class="wrap"><h1>Hask · ten designs</h1><p>Butcherblock's salter, a Reptilian of the salt marsh: ten brand-new hand-drawn takes at 3× (the game shows them at 1×), beside the CC0 pawn and knight at the same scale.</p>
    <div class="g grass">${sheetCells.join('')}${refCells.join('')}</div></div>`
  await shoot(sheet, join(OUT, 'sheet.png'), 1240)

  // lineup.png: all ten at 1× on grass beside the pack, the true game size (and 2× for a phone)
  const ones = await Promise.all(DESIGNS.map(async (d) => `<img src="${await cell(cut(render(d)), 1)}">`))
  const packOnes = await Promise.all(pack.map(async (p) => `<img src="${await cell(p.img, 1)}">`))
  const twos = await Promise.all(DESIGNS.map(async (d) => `<img src="${await cell(cut(render(d)), 2)}">`))
  const packTwos = await Promise.all(pack.map(async (p) => `<img src="${await cell(p.img, 2)}">`))
  const lineup = `<!doctype html><meta charset="utf-8"><style>${CSS(grass)}
    .wrap{padding:12px} h1{font-size:18px;margin:0 0 2px} p{margin:0 0 8px;color:#c9cbbf;font-size:13px}
    .row{display:flex;align-items:flex-end;gap:2px;padding:10px 8px 6px;border-radius:6px}
    .big{flex-wrap:wrap;row-gap:8px}
    </style><div class="wrap"><h1>At game size (1×)</h1><p>The CC0 pawn, knight, archer and torch goblin, then Hask 1–10, on the pack's grass. Below: the same row at 2× for a phone.</p>
    <div class="row grass">${packOnes.join('')}${ones.join('')}</div>
    <div class="row grass big" style="margin-top:10px">${packTwos.join('')}${twos.join('')}</div></div>`
  await shoot(lineup, join(OUT, 'lineup.png'), 1240)

  // d01..d10: the design at 4× beside the pawn at 4×, the idle and the tic at 2×, the concept line; and the motion loop
  const manifest: { id: string; group: string; people: string; title: string; caption: string; file: string }[] = []
  for (const [i, d] of DESIGNS.entries()) {
    const idle = idleFrames(d)
    const tic = ticFrames(d)
    const box = frameBox([...idle, ...tic])
    const bx = Math.max(0, box.x0 - 2), by = Math.max(0, box.y0 - 2)
    const bw = Math.min(W, box.x1 + 3) - bx, bh = Math.min(H, box.y1 + 3) - by
    const still = crop(render(d), bx, by, bw, bh)
    const idles = await Promise.all(idle.map(async (f) => `<img src="${await cell(crop(f, bx, by, bw, bh), 2)}">`))
    const tics = await Promise.all(tic.map(async (f) => `<img src="${await cell(crop(f, bx, by, bw, bh), 2)}">`))
    const html = `<!doctype html><meta charset="utf-8"><style>${CSS(grass)}
      .wrap{padding:12px;width:576px}
      h1{font-size:20px;margin:0} .no{color:#ffe46b}
      p{margin:2px 0 8px;color:#c9cbbf;font-size:13.5px}
      .top{display:flex;align-items:flex-end;justify-content:center;gap:16px;padding:10px 6px 4px;border-radius:8px}
      .lab{display:flex;justify-content:center;gap:16px;font-size:12px;color:#c9cbbf;margin:4px 0 8px}
      .strip{display:flex;flex-wrap:wrap;align-items:flex-end;gap:2px;padding:6px;border-radius:8px}
      .k{font-size:12px;color:#c9cbbf;margin:8px 0 3px}
      </style><div class="wrap"><h1><span class="no">${i + 1}.</span> ${d.title}</h1><p>${d.concept}</p>
      <div class="top grass"><img src="${await cell(pawn, 4)}"><img src="${await cell(still, 4)}"></div>
      <div class="lab"><span>CC0 pawn · 4×</span><span>Hask ${i + 1} · 4×</span></div>
      <div class="k">Idle, ${idle.length} frames · 2×</div><div class="strip grass">${idles.join('')}</div>
      <div class="k">Tic · 2×</div><div class="strip grass">${tics.join('')}</div></div>`
    await shoot(html, join(OUT, `${d.id}.png`), 600)
    await motion(d, join(OUT, `${d.id}.webp`), { x: bx, y: by, w: bw, h: bh })
    manifest.push({
      id: `hask-${d.id}`,
      group: 'Hask designs',
      people: 'Hask',
      title: `${i + 1}. ${d.title}`,
      caption: `${d.concept} Judge: would it pass for Pixel Frog's, and is it Hask?`,
      file: `${d.id}.png`,
    })
    manifest.push({
      id: `hask-${d.id}-motion`,
      group: 'Hask designs',
      people: 'Hask',
      title: `${i + 1}. ${d.title} · motion`,
      caption: `The idle (the pack's squash and bob) and the tic, looped: does the tic say who he is?`,
      file: `${d.id}.webp`,
    })
  }
  manifest.unshift(
    { id: 'hask-sheet', group: 'Hask designs', people: 'Hask', title: 'Hask · all ten at 3×', caption: 'Ten brand-new designs beside the CC0 pawn and knight. Judge: which two or three are Hask?', file: 'sheet.png' },
    { id: 'hask-lineup', group: 'Hask designs', people: 'Hask', title: 'Hask · at game size', caption: 'All ten at 1× on the grass beside the pack. Judge: does each read as a reptile, and does any stand out as not Pixel Frog?', file: 'lineup.png' },
  )
  // keep the cards other scripts add (hask-bodies.ts, hask-d03-final.ts) after the set's own
  const mpath = join(OUT, 'manifest.json')
  const own = new Set(manifest.map((m) => m.id))
  const extra = existsSync(mpath) ? (JSON.parse(readFileSync(mpath, 'utf8')) as typeof manifest).filter((m) => !own.has(m.id)) : []
  writeFileSync(mpath, JSON.stringify([...manifest, ...extra], null, 2) + '\n')
}

/** A 3 s+ loop at 4× on grass: the idle twice, the tic, then the idle to fill 3 s. Animated WebP (lossless) via sharp. */
export async function motion(d: Design, path: string, box: { x: number; y: number; w: number; h: number }) {
  const S = 4
  const pad = 8
  const grass = await sharp(join(PACK, 'grass.png')).resize(128, 128, { kernel: 'nearest' }).png().toBuffer()
  const cw = box.w * S + pad * 2, ch = box.h * S + pad * 2
  const bg = await sharp({ create: { width: cw, height: ch, channels: 4, background: '#79a863' } })
    .composite([{ input: grass, tile: true, left: 0, top: 0 }])
    .png()
    .toBuffer()
  const idle = idleFrames(d)
  const tic = ticFrames(d)
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

async function main() {
  const args = process.argv.slice(2)
  const cc0 = await cc0Palette()
  let bad = 0
  for (const d of DESIGNS) {
    const r = report(d, cc0)
    if (r.miss.length || r.off.length || r.clash.length) bad++
  }
  const pi = args.indexOf('--preview')
  if (pi >= 0) await preview(args[pi + 1] ?? join(tmpdir(), 'hask-preview'), args[pi + 2])
  if (args.includes('--cards')) {
    if (bad) throw new Error(`${bad} design(s) out of band, off-palette or touching the head: no cards`)
    await cards()
  }
}

// run only as a script (hask-bodies.ts imports the card helpers above)
if (import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
