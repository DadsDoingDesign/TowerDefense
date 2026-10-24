/**
 * Saffra — ten brand-new character designs at the Tiny Swords pack's scale
 * (exploration cards for the designer; nothing here is wired into the game).
 *
 *   npx tsx scripts/designs/saffra.ts                 # measure all ten against the pack's bands
 *   npx tsx scripts/designs/saffra.ts --preview DIR   # 8× stills + 1×/3× line-ups for the critique rounds
 *   npx tsx scripts/designs/saffra.ts --cards         # the cards in docs/characters/cards/designs/saffra/
 *   npx tsx scripts/designs/saffra.ts --props [DIR]   # design 03 refined, five props: preview to DIR, or the props cards
 *   npx tsx scripts/designs/saffra.ts --body [DIR]    # design 03 on her own body (ember pot, ristra): preview, or the body cards
 *
 * Every figure is a hand-authored pixel map (saffra-d01.ts … saffra-d10.ts);
 * saffra-lib.ts only stamps the pack's outline and composes the frames. The
 * pack figures shown beside them are the old-CC0 stills already shipped in
 * public/assets/sprites/tinyswords/ (see sprites/CREDITS.md).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { H, W, idleFrames, measure, misses, orphans, render, ticFrames, type Design, type Rgba } from './saffra-lib'
import { DESIGNS } from './saffra-all'
import { D03 } from './saffra-d03'
import { OWN_BODY, PROPS } from './saffra-d03-props'

const ROOT = resolve(import.meta.dirname, '..', '..')
const PACK = join(ROOT, 'public', 'assets', 'sprites', 'tinyswords')
const OUT = join(ROOT, 'docs', 'characters', 'cards', 'designs', 'saffra')

const png = (img: Rgba, scale = 1) =>
  sharp(Buffer.from(img.data), { raw: { width: img.w, height: img.h, channels: 4 } })
    .resize(img.w * scale, img.h * scale, { kernel: 'nearest' })
    .png()
    .toBuffer()

/** Trim to the opaque box (plus the shadow), keep the feet row. */
async function readPack(file: string): Promise<Rgba> {
  const { data, info } = await sharp(join(PACK, `${file}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { w: info.width, h: info.height, data: new Uint8ClampedArray(data) }
}

const PACK_PEOPLE = [
  { file: 'mystic', name: 'Pawn' },
  { file: 'fighter', name: 'Knight' },
  { file: 'rogue', name: 'Archer' },
  { file: 'torch1', name: 'Torch goblin' },
]

function report(d: Design) {
  const still = render(d)
  const m = measure(still, d.headBottom)
  const miss = misses(m)
  const orph = orphans(still, ['#ffffff', '#ffcfb4', '#fffce7', '#f5efa9', '#ffed44'])
  const f2 = (v: number) => v.toFixed(2)
  console.log(
    `${d.id} ${d.title.padEnd(18)} ${m.box.w}x${m.box.h} fill ${f2(m.fill)} aspect ${f2(m.aspect)} head ${f2(m.headShare)} top ${f2(m.topMass)} legs ${f2(m.legShare)} line ${f2(m.outlinePx)} inked ${f2(m.inkedEdge)} colours ${m.colours} orphans ${orph}  ${miss.length ? 'MISS ' + miss.join('; ') : 'ok'}`,
  )
  return { m, miss }
}

async function browser() {
  const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  const { chromium } = await import(process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs')
  return chromium.launch(existsSync(EXEC) ? { executablePath: EXEC } : {})
}

const b64 = (buf: Buffer) => `data:image/png;base64,${buf.toString('base64')}`

async function shoot(html: string, path: string, width: number) {
  const b = await browser()
  const page = await b.newPage({ viewport: { width, height: 200 } })
  await page.setContent(html)
  await page.waitForLoadState('load')
  await page.screenshot({ path, fullPage: true })
  await b.close()
}

const CSS = (grass: string) => `body{margin:0;background:#1b2130;font:14px/1.35 system-ui,sans-serif;color:#eef0e6}
img{image-rendering:pixelated;display:block}
.grass{background:url(${grass}) repeat;image-rendering:pixelated}`

async function preview(dir: string, only?: string) {
  mkdirSync(dir, { recursive: true })
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pack = await Promise.all(PACK_PEOPLE.map(async (p) => ({ ...p, img: await readPack(p.file) })))
  for (const d of DESIGNS) {
    if (only && d.id !== only) continue
    const still = render(d)
    await sharp(await png(still, 8)).flatten({ background: '#79a863' }).toFile(join(dir, `${d.id}-8x-${process.env.TAG ?? 0}.png`))
    const frames = [...idleFrames(d), ...ticFrames(d)]
    const strip = await Promise.all(frames.map((f) => png(f, 3)))
    const html = `<!doctype html><style>${CSS(grass)} .row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px;padding:8px}</style>
      <div class="grass row">
      ${await Promise.all(pack.map(async (p) => `<img src="${b64(await png(p.img, 3))}">`)).then((a) => a.join(''))}<img src="${b64(await png(still, 3))}"></div>
      <div class="grass row">${await Promise.all(pack.map(async (p) => `<img src="${b64(await png(p.img, 1))}">`)).then((a) => a.join(''))}<img src="${b64(await png(still, 1))}"></div>
      <div class="grass row" style="flex-wrap:wrap">${strip.map((s) => `<img src="${b64(s)}">`).join('')}</div>`
    await shoot(html, join(dir, `${d.id}-lineup-${process.env.TAG ?? 0}.png`), 1100)
  }
  // all ten at 1× and 3×
  const all3 = await Promise.all(DESIGNS.map(async (d) => b64(await png(render(d), 2))))
  const html = `<!doctype html><style>${CSS(grass)} .row{display:flex;align-items:flex-end;gap:0;padding:6px;flex-wrap:wrap}</style>
    <div class="grass row">${await Promise.all(pack.map(async (p) => `<img src="${b64(await png(p.img, 2))}">`)).then((a) => a.join(''))}${all3.map((s) => `<img src="${s}">`).join('')}</div>
    <div class="grass row">${await Promise.all(pack.map(async (p) => `<img src="${b64(await png(p.img, 1))}">`)).then((a) => a.join(''))}${await Promise.all(DESIGNS.map(async (d) => `<img src="${b64(await png(render(d), 1))}">`)).then((a) => a.join(''))}</div>`
  await shoot(html, join(dir, `all-lineup-${process.env.TAG ?? 0}.png`), 1400)
}

// ── the cards ─────────────────────────────────────────────────────────────────

/** Crop a frame to a shared box so the cards don't waste space. */
function crop(img: Rgba, x: number, y: number, w: number, h: number): Rgba {
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
function frameBox(frames: Rgba[]) {
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
  // Feet sit on one line: every design's canvas has its feet near row 86; the pack stills end at their shadow.
  // one shared box over every frame of all ten, so the feet share a line and nothing is clipped
  const all = frameBox(DESIGNS.flatMap((d) => [...idleFrames(d), ...ticFrames(d)]))
  const BOX = { x0: Math.max(0, all.x0 - 1), y0: Math.max(0, all.y0 - 1), w: Math.min(W, all.x1 + 2) - Math.max(0, all.x0 - 1), h: Math.min(H, all.y1 + 2) - Math.max(0, all.y0 - 1) }
  const cut = (img: Rgba) => crop(img, BOX.x0, BOX.y0, BOX.w, BOX.h)

  // sheet.png: all ten at 3×, numbered and named, with the pawn and the knight at 3×
  const cell = async (img: Rgba, s: number) => b64(await png(img, s))
  const sheetCells = await Promise.all(
    DESIGNS.map(async (d, i) => `<div class="c"><div class="n">${i + 1}</div><img src="${await cell(cut(render(d)), 3)}"><b>${d.title}</b></div>`),
  )
  const refCells = [`<div class="c ref"><img src="${await cell(pawn, 3)}"><b>CC0 pawn</b></div>`, `<div class="c ref"><img src="${await cell(knight, 3)}"><b>CC0 knight</b></div>`]
  const sheet = `<!doctype html><meta charset="utf-8"><style>${CSS(grass)}
    .wrap{padding:14px}
    h1{font-size:22px;margin:0 0 2px} p{margin:0 0 10px;color:#c9cbbf;font-size:14px}
    .g{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-radius:8px;overflow:hidden}
    .c{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:6px 0 10px}
    .c img{width:auto;height:auto}
    .c.ref img{width:auto;height:auto}
    .c b{font-size:18px;color:#fff;text-shadow:0 2px 0 #161c2e,0 0 4px #161c2e;margin-top:-4px}
    .c.ref b{color:#ffe46b}
    .n{position:absolute;left:10px;top:8px;width:32px;height:32px;border-radius:16px;background:#161c2e;color:#ffe46b;font-weight:700;font-size:18px;display:flex;align-items:center;justify-content:center}
    </style><div class="wrap"><h1>Saffra · ten designs</h1><p>Peppercorn Co.'s spice broker, ten brand-new hand-drawn takes at 3× (the game shows them at 1×), beside the CC0 pawn and knight at the same scale.</p>
    <div class="g grass">${sheetCells.join('')}${refCells.join('')}</div></div>`
  await shoot(sheet, join(OUT, 'sheet.png'), 1240)

  // lineup.png: all ten at 1× on grass beside the pack, the true game size (shown at 2× page px for a phone too)
  const ones = await Promise.all(DESIGNS.map(async (d) => `<img src="${await cell(cut(render(d)), 1)}">`))
  const packOnes = await Promise.all(pack.map(async (p) => `<img src="${await cell(p.img, 1)}">`))
  const twos = await Promise.all(DESIGNS.map(async (d) => `<img src="${await cell(cut(render(d)), 2)}">`))
  const packTwos = await Promise.all(pack.map(async (p) => `<img src="${await cell(p.img, 2)}">`))
  const lineup = `<!doctype html><meta charset="utf-8"><style>${CSS(grass)}
    .wrap{padding:12px} h1{font-size:18px;margin:0 0 2px} p{margin:0 0 8px;color:#c9cbbf;font-size:13px}
    .row{display:flex;align-items:flex-end;gap:2px;padding:10px 8px 6px;border-radius:6px}
    .x2 img{width:auto} .lab{display:flex;gap:2px;padding:0 8px;font-size:11px;color:#c9cbbf}
    .big{flex-wrap:wrap;row-gap:8px}
    </style><div class="wrap"><h1>At game size (1×)</h1><p>The CC0 pawn, knight, archer and torch goblin, then Saffra 1–10, on the pack's grass. Below: the same row at 2× for a phone.</p>
    <div class="row grass">${packOnes.join('')}${ones.join('')}</div>
    <div class="row grass big" style="margin-top:10px">${packTwos.join('')}${twos.join('')}</div></div>`
  await shoot(lineup, join(OUT, 'lineup.png'), 1240)

  // d01..d10: the design at 4× beside the pawn at 4×, the idle at 2×, the concept line; and the motion loop
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
      <div class="lab"><span>CC0 pawn · 4×</span><span>Saffra ${i + 1} · 4×</span></div>
      <div class="k">Idle, 6 frames · 2×</div><div class="strip grass">${idles.join('')}</div>
      <div class="k">Tic · 2×</div><div class="strip grass">${tics.join('')}</div></div>`
    await shoot(html, join(OUT, `${d.id}.png`), 600)
    await motion(d, join(OUT, `${d.id}.webp`), { x: bx, y: by, w: bw, h: bh })
    manifest.push({
      id: `saffra-${d.id}`,
      group: 'Saffra designs',
      people: 'Saffra',
      title: `${i + 1}. ${d.title}`,
      caption: `${d.concept} Judge: would it pass for Pixel Frog's, and is it Saffra?`,
      file: `${d.id}.png`,
    })
    manifest.push({
      id: `saffra-${d.id}-motion`,
      group: 'Saffra designs',
      people: 'Saffra',
      title: `${i + 1}. ${d.title} · motion`,
      caption: `The idle (the pack's squash and bob) and the tic, looped: does the tic say who she is?`,
      file: `${d.id}.webp`,
    })
  }
  manifest.unshift(
    { id: 'saffra-sheet', group: 'Saffra designs', people: 'Saffra', title: 'Saffra · all ten at 3×', caption: 'Ten brand-new designs beside the CC0 pawn and knight. Judge: which two or three are Saffra?', file: 'sheet.png' },
    { id: 'saffra-lineup', group: 'Saffra designs', people: 'Saffra', title: 'Saffra · at game size', caption: 'All ten at 1× on the grass beside the pack. Judge: does any stand out as not Pixel Frog?', file: 'lineup.png' },
  )
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
}

/** A 3 s loop at 4× on grass: the idle twice, the tic, then the idle to fill exactly 3 s. Animated WebP (lossless) via sharp. */
async function motion(d: Design, path: string, box: { x: number; y: number; w: number; h: number }) {
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
  const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0)
  const passes = 2 * sum(d.idleMs) + sum(d.ticMs) <= 3000 ? 2 : 1
  for (let k = 0; k < passes; k++) idle.forEach((img, i) => seq.push({ img, ms: d.idleMs[i] }))
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

// ── design 03, refined, with five props in place of the torch ─────────────────

/** Every pixel of every prop / effect, in every frame, must sit below the brim (row ≥ 53) or right of it (column ≥ 83). */
function clearance(d: Design): string[] {
  const only = { ...d, parts: d.parts.filter((p) => p.group === 'prop' || p.group === 'fx') }
  const bad: string[] = []
  ;[...d.idle, ...d.tic].forEach((f, i) => {
    const img = render(only, f)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (img.data[(y * W + x) * 4 + 3] && y < 53 && x < 83) {
          bad.push(`frame ${i} (${x},${y})`)
          return
        }
  })
  return bad
}

async function propsPreview(dir: string) {
  mkdirSync(dir, { recursive: true })
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pack = await Promise.all(PACK_PEOPLE.map(async (p) => ({ ...p, img: await readPack(p.file) })))
  const tag = process.env.TAG ?? 0
  for (const d of [D03, ...PROPS]) {
    await sharp(await png(render(d), 8)).flatten({ background: '#79a863' }).toFile(join(dir, `${d.id}-8x-${tag}.png`))
    const strip = await Promise.all([...idleFrames(d), ...ticFrames(d)].map((f) => png(f, 2)))
    const html = `<!doctype html><style>${CSS(grass)} .row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:2px;padding:6px}</style>
      <div class="grass row">${strip.map((s) => `<img src="${b64(s)}">`).join('')}</div>`
    await shoot(html, join(dir, `${d.id}-frames-${tag}.png`), 1100)
  }
  const three = await Promise.all([pack[0], pack[1]].map(async (p) => `<img src="${b64(await png(p.img, 3))}">`))
  const html = `<!doctype html><style>${CSS(grass)} .row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:4px;padding:6px}</style>
    <div class="grass row">${three.join('')}${(await Promise.all([D03, ...PROPS].map(async (d) => `<img src="${b64(await png(render(d), 3))}">`))).join('')}</div>
    <div class="grass row">${(await Promise.all(pack.map(async (p) => `<img src="${b64(await png(p.img, 1))}">`))).join('')}${(await Promise.all([D03, ...PROPS].map(async (d) => `<img src="${b64(await png(render(d), 1))}">`))).join('')}</div>`
  await shoot(html, join(dir, `props-lineup-${tag}.png`), 1500)
}

async function propsCards() {
  mkdirSync(OUT, { recursive: true })
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pack = await Promise.all(PACK_PEOPLE.map(async (p) => ({ ...p, img: await readPack(p.file) })))
  const cell = async (img: Rgba, s: number) => b64(await png(img, s))
  const all = frameBox(PROPS.flatMap((d) => [...idleFrames(d), ...ticFrames(d)]))
  const bx = Math.max(0, all.x0 - 1), by = Math.max(0, all.y0 - 1)
  const bw = Math.min(W, all.x1 + 2) - bx, bh = Math.min(H, all.y1 + 2) - by
  const cut = (img: Rgba) => crop(img, bx, by, bw, bh)
  const opts = await Promise.all(PROPS.map(async (d, i) => `<div class="c"><div class="n">${i + 1}</div><img src="${await cell(cut(render(d)), 3)}"><b>${d.title}</b></div>`))
  const ones = await Promise.all(PROPS.map(async (d) => `<img src="${await cell(cut(render(d)), 1)}">`))
  const packOnes = await Promise.all([pack[0], pack[1], pack[3]].map(async (p) => `<img src="${await cell(p.img, 1)}">`))
  const twos = await Promise.all(PROPS.map(async (d) => `<img src="${await cell(cut(render(d)), 2)}">`))
  const packTwos = await Promise.all([pack[0], pack[1], pack[3]].map(async (p) => `<img src="${await cell(p.img, 2)}">`))
  const sheet = `<!doctype html><meta charset="utf-8"><style>${CSS(grass)}
    .wrap{padding:14px} h1{font-size:22px;margin:0 0 2px} p{margin:0 0 10px;color:#c9cbbf;font-size:14px}
    .g{display:flex;justify-content:space-between;border-radius:8px;padding:8px 6px 4px}
    .c{position:relative;display:flex;flex-direction:column;align-items:center}
    .c b{font-size:17px;color:#fff;text-shadow:0 2px 0 #161c2e,0 0 4px #161c2e;margin:2px 0 6px}
    .n{position:absolute;left:6px;top:0;width:30px;height:30px;border-radius:15px;background:#161c2e;color:#ffe46b;font-weight:700;font-size:17px;display:flex;align-items:center;justify-content:center}
    .row{display:flex;align-items:flex-end;gap:6px;padding:10px 8px 6px;border-radius:8px;margin-top:10px;flex-wrap:wrap}
    .k{font-size:13px;color:#c9cbbf;margin:10px 0 0}
    </style><div class="wrap"><h1>Field Burner · five props</h1><p>The refined Field Burner at 3× with five props in place of the torch, each held low and clear of the brim. Below: at 1× (game size) and 2× beside the CC0 pawn, knight and torch goblin.</p>
    <div class="g grass">${opts.join('')}</div>
    <div class="k">At 1× (game size)</div><div class="row grass">${packOnes.join('')}${ones.join('')}</div>
    <div class="k">The same row at 2×</div><div class="row grass">${packTwos.join('')}${twos.join('')}</div></div>`
  await shoot(sheet, join(OUT, 'd03-props.png'), 1240)

  // before / after at 4×: the approved Field Burner beside the refined one (with the recommended prop), the pawn for scale
  const before = frameBox([render(D03)]), after = frameBox([render(PROPS[0])])
  const u = { x0: Math.min(before.x0, after.x0) - 1, y0: Math.min(before.y0, after.y0) - 1, x1: Math.max(before.x1, after.x1) + 2, y1: Math.max(before.y1, after.y1) + 2 }
  const ba = (d: Design) => crop(render(d), u.x0, u.y0, u.x1 - u.x0, u.y1 - u.y0)
  const html = `<!doctype html><meta charset="utf-8"><style>${CSS(grass)}
    .wrap{padding:12px;width:876px} h1{font-size:20px;margin:0} p{margin:2px 0 8px;color:#c9cbbf;font-size:13.5px}
    .top{display:flex;align-items:flex-end;justify-content:center;gap:18px;padding:10px 6px 4px;border-radius:8px}
    .lab{display:flex;justify-content:space-around;font-size:13px;color:#c9cbbf;margin:4px 0 0}
    </style><div class="wrap"><h1>Field Burner · before and after</h1><p>Approved (left) and refined (right) at 4×: the same silhouette; a dented, stitched crown with a highlight streak, a buckled band, a rolled and singed brim lit along its lip, kerchief folds and tails, hair strands, a belt, and the ember pot in place of the torch.</p>
    <div class="top grass"><img src="${await cell(ba(D03), 4)}"><img src="${await cell(ba(PROPS[0]), 4)}"></div>
    <div class="lab"><span>Approved</span><span>Refined, with the ember pot</span></div></div>`
  await shoot(html, join(OUT, 'd03-before-after.png'), 900)

  for (const [i, d] of PROPS.entries()) {
    const fr = [...idleFrames(d), ...ticFrames(d)]
    const b = frameBox(fr)
    const x = Math.max(0, b.x0 - 2), y = Math.max(0, b.y0 - 2)
    await motion(d, join(OUT, `d03-props-${String(i + 1).padStart(2, '0')}.webp`), { x, y, w: Math.min(W, b.x1 + 3) - x, h: Math.min(H, b.y1 + 3) - y })
  }

  // add (or refresh) the props cards in the manifest
  const mpath = join(OUT, 'manifest.json')
  const manifest: { id: string; group: string; people: string; title: string; caption: string; file: string }[] = existsSync(mpath) ? JSON.parse(readFileSync(mpath, 'utf8')) : []
  const keep = manifest.filter((m) => !m.id.startsWith('saffra-d03-props') && m.id !== 'saffra-d03-before-after')
  keep.push(
    { id: 'saffra-d03-before-after', group: 'Saffra designs', people: 'Saffra', title: '3. Field Burner · before / after', caption: 'The approved Field Burner beside the refined one at 4×. Judge: is the refinement Pixel Frog’s level, and is the silhouette unchanged?', file: 'd03-before-after.png' },
    { id: 'saffra-d03-props', group: 'Saffra designs', people: 'Saffra', title: '3. Field Burner · five props', caption: 'Five props in place of the torch, all clear of the brim. Judge: which one says field-burning spice broker?', file: 'd03-props.png' },
    ...PROPS.map((d, i) => ({
      id: `saffra-d03-props-${String(i + 1).padStart(2, '0')}`,
      group: 'Saffra designs',
      people: 'Saffra',
      title: `3.${i + 1} Field Burner · ${d.title}`,
      caption: `${d.concept} The idle and the prop’s tic, looped. Judge: does the tic say who she is?`,
      file: `d03-props-${String(i + 1).padStart(2, '0')}.webp`,
    })),
  )
  writeFileSync(mpath, JSON.stringify(keep, null, 2) + '\n')
}

// ── design 03 on her own body ──────────────────────────────────────────────────

async function bodyPreview(dir: string) {
  mkdirSync(dir, { recursive: true })
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pack = await Promise.all(PACK_PEOPLE.map(async (p) => ({ ...p, img: await readPack(p.file) })))
  const tag = process.env.TAG ?? 0
  const set = [PROPS[0], OWN_BODY[0], PROPS[2], OWN_BODY[1]]
  for (const d of OWN_BODY) {
    await sharp(await png(render(d), 8)).flatten({ background: '#79a863' }).toFile(join(dir, `${d.id}-8x-${tag}.png`))
    const strip = await Promise.all([...idleFrames(d), ...ticFrames(d)].map((f) => png(f, 2)))
    await shoot(`<!doctype html><style>${CSS(grass)} .row{display:flex;flex-wrap:wrap;gap:2px;padding:6px}</style><div class="grass row">${strip.map((x) => `<img src="${b64(x)}">`).join('')}</div>`, join(dir, `${d.id}-frames-${tag}.png`), 1100)
  }
  const at = async (s: number) => (await Promise.all([pack[0], pack[1], pack[3]].map(async (p) => `<img src="${b64(await png(p.img, s))}">`))).join('') + (await Promise.all(set.map(async (d) => `<img src="${b64(await png(render(d), s))}">`))).join('')
  await shoot(`<!doctype html><style>${CSS(grass)} .row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:4px;padding:6px}</style><div class="grass row">${await at(3)}</div><div class="grass row">${await at(1)}</div>`, join(dir, `body-lineup-${tag}.png`), 1500)
}

async function bodyCards() {
  mkdirSync(OUT, { recursive: true })
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pack = await Promise.all(PACK_PEOPLE.map(async (p) => ({ ...p, img: await readPack(p.file) })))
  const pairs: [Design, Design, string][] = [[PROPS[0], OWN_BODY[0], 'Ember Pot'], [PROPS[2], OWN_BODY[1], 'Pepper Ristra']]
  const box = frameBox(pairs.flatMap(([a, b]) => [...idleFrames(a), ...ticFrames(a), ...idleFrames(b), ...ticFrames(b)]))
  const bx = Math.max(0, box.x0 - 1), by = Math.max(0, box.y0 - 1)
  const cut = (d: Design) => crop(render(d), bx, by, Math.min(W, box.x1 + 2) - bx, Math.min(H, box.y1 + 2) - by)
  const cell = async (img: Rgba, sc: number) => b64(await png(img, sc))
  const rows = await Promise.all(pairs.map(async ([a, b, name]) => `<div class="k">${name}</div><div class="top grass"><img src="${await cell(cut(a), 4)}"><img src="${await cell(cut(b), 4)}"></div><div class="lab"><span>Shared bell tunic (before)</span><span>Her own body (after)</span></div>`))
  const ones = (await Promise.all([pack[0], pack[1], pack[3]].map(async (p) => `<img src="${await cell(p.img, 1)}">`))).join('') + (await Promise.all(pairs.flatMap(([a, b]) => [a, b]).map(async (d) => `<img src="${await cell(cut(d), 1)}">`))).join('')
  const html = `<!doctype html><meta charset="utf-8"><style>${CSS(grass)}
    .wrap{padding:12px;width:876px} h1{font-size:20px;margin:0} p{margin:2px 0 6px;color:#c9cbbf;font-size:13.5px}
    .top{display:flex;align-items:flex-end;justify-content:space-around;padding:8px 6px 2px;border-radius:8px}
    .lab{display:flex;justify-content:space-around;font-size:13px;color:#c9cbbf;margin:4px 0 0}
    .k{font-size:14px;color:#ffe46b;margin:10px 0 3px;font-weight:600}
    .row{display:flex;align-items:flex-end;gap:6px;padding:8px;border-radius:8px}
    </style><div class="wrap"><h1>Field Burner · her own body</h1><p>The shared, re-inked bell tunic (left) against a body drawn for her (right), at 4×: an oxblood work smock, a tan leather apron singed and smouldering at the hem, an ember sash knotted at the back hip with a leather spice pouch, and work boots planted one ahead of the other.</p>
    ${rows.join('')}
    <div class="k">At 1× beside the CC0 pawn, knight and torch goblin: before, after, before, after</div><div class="row grass">${ones}</div></div>`
  await shoot(html, join(OUT, 'd03-body.png'), 900)
  for (const [d, file] of [[OWN_BODY[0], 'd03-body-ember.webp'], [OWN_BODY[1], 'd03-body-ristra.webp']] as const) {
    const fr = [...idleFrames(d), ...ticFrames(d)]
    const b = frameBox(fr)
    const x = Math.max(0, b.x0 - 2), y = Math.max(0, b.y0 - 2)
    await motion(d, join(OUT, file), { x, y, w: Math.min(W, b.x1 + 3) - x, h: Math.min(H, b.y1 + 3) - y })
  }
  const mpath = join(OUT, 'manifest.json')
  const manifest: { id: string; group: string; people: string; title: string; caption: string; file: string }[] = existsSync(mpath) ? JSON.parse(readFileSync(mpath, 'utf8')) : []
  const keep = manifest.filter((m) => !m.id.startsWith('saffra-d03-body'))
  keep.push(
    { id: 'saffra-d03-body', group: 'Saffra designs', people: 'Saffra', title: '3. Field Burner · her own body', caption: 'The shared bell tunic against a body drawn for her, with the ember pot and the ristra. Judge: is it hers, and does the hat still lead?', file: 'd03-body.png' },
    { id: 'saffra-d03-body-ember', group: 'Saffra designs', people: 'Saffra', title: '3. Field Burner · own body · Ember Pot', caption: 'The idle and the pot’s tic on her own body. Judge: weight and timing.', file: 'd03-body-ember.webp' },
    { id: 'saffra-d03-body-ristra', group: 'Saffra designs', people: 'Saffra', title: '3. Field Burner · own body · Pepper Ristra', caption: 'The idle and the ristra’s tic on her own body. Judge: weight and timing.', file: 'd03-body-ristra.webp' },
  )
  writeFileSync(mpath, JSON.stringify(keep, null, 2) + '\n')
}

async function main() {
  const args = process.argv.slice(2)
  for (const d of DESIGNS) report(d)
  const pi = args.indexOf('--preview')
  if (pi >= 0) await preview(args[pi + 1] ?? join(tmpdir(), 'saffra-preview'), args[pi + 2])
  if (args.includes('--cards')) {
    await cards()
    await propsCards()
    await bodyCards()
  }
  const bb = args.indexOf('--body')
  if (bb >= 0) {
    for (const d of OWN_BODY) report(d)
    for (const d of OWN_BODY) {
      const bad = clearance(d)
      console.log(`${d.id} clearance ${bad.length ? 'OVERLAPS THE BRIM: ' + bad.join(', ') : 'clear of the brim in every frame'}`)
    }
    if (args[bb + 1] && !args[bb + 1].startsWith('--')) await bodyPreview(args[bb + 1])
    else await bodyCards()
  }
  const pp = args.indexOf('--props')
  if (pp >= 0) {
    for (const d of [D03, ...PROPS]) report(d)
    for (const d of PROPS) {
      const bad = clearance(d)
      console.log(`${d.id} clearance ${bad.length ? 'OVERLAPS THE BRIM: ' + bad.join(', ') : 'clear of the brim in every frame'}`)
    }
    if (args[pp + 1] && !args[pp + 1].startsWith('--')) await propsPreview(args[pp + 1])
    else await propsCards()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
