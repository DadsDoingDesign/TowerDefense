/**
 * Wren — ten brand-new character designs for Greenvial's herbalist, at the
 * Tiny Swords pack's scale (exploration cards for the designer; nothing here
 * is wired into the game). The method is the Saffra set's, which the designer
 * approved: hand-placed pixel maps, the pack's outline, its bell body, its
 * squash-and-bob idle.
 *
 *   npx tsx scripts/designs/wren.ts                 # measure all ten against the pack's bands, and the prop clearance
 *   npx tsx scripts/designs/wren.ts --preview DIR   # 8× stills + 1×/3× line-ups for the critique rounds
 *   npx tsx scripts/designs/wren.ts --cards         # the cards in docs/characters/cards/designs/wren/
 *   npx tsx scripts/designs/wren.ts --stills DIR    # 1× stills of the ten (the "before" of a later pass)
 *   npx tsx scripts/designs/wren.ts --bodies DIR    # bodies.png + dXX-body.webp, before from DIR
 *   npx tsx scripts/designs/wren.ts --final DIR     # d09-final.png + d09-final.webp, before from DIR
 *   npx tsx scripts/designs/wren.ts --opreview DIR  # the pick's five options (wren-d09-r*.ts): 8× stills + line-ups
 *   npx tsx scripts/designs/wren.ts --options       # d09-options.png + d09-options.webp
 *
 * Every figure is a hand-placed pixel map (wren-d01.ts … wren-d10.ts);
 * wren-lib.ts only stamps the pack's outline and composes the frames. The
 * pack figures shown beside them are the old-CC0 stills already shipped in
 * public/assets/sprites/tinyswords/ (see sprites/CREDITS.md).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { H, W, idleFrames, measure, misses, orphans, render, ticFrames, type Design, type Rgba } from './wren-lib'
import { DESIGNS } from './wren-all'
import { D09_RA } from './wren-d09-rA'
import { D09_RB } from './wren-d09-rB'
import { D09_RC } from './wren-d09-rC'
import { D09_RD } from './wren-d09-rD'
import { D09_RE } from './wren-d09-rE'

/** The five refinement options of the pick (d09), each pushing one direction; the label is what it pushes. */
const OPTIONS: readonly { d: Design; label: string }[] = [
  { d: D09_RA, label: 'A · the nose: bigger, red, reads at 1×; sneezes' },
  { d: D09_RB, label: 'B · the pot: jade glaze, raw clay top, a herb in flower' },
  { d: D09_RC, label: 'C · the join: a scarf the pot nests in; shrugs' },
  { d: D09_RD, label: 'D · the trade: herb satchel, drying bundle; sniffs' },
  { d: D09_RE, label: 'E · the posture: stooped, wide stance, root stick; stamps' },
]

const ROOT = resolve(import.meta.dirname, '..', '..')
const PACK = join(ROOT, 'public', 'assets', 'sprites', 'tinyswords')
const OUT = join(ROOT, 'docs', 'characters', 'cards', 'designs', 'wren')

const png = (img: Rgba, scale = 1) =>
  sharp(Buffer.from(img.data), { raw: { width: img.w, height: img.h, channels: 4 } })
    .resize(img.w * scale, img.h * scale, { kernel: 'nearest' })
    .png()
    .toBuffer()

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

/** The designer's note on Saffra: no prop may overlap the head or hat. Every frame: no prop pixel (ring included) touches a head pixel. (Effects — spores, drips, glow motes — may drift.) */
function clearance(d: Design): string[] {
  const only = (g: (p: Design['parts'][number]) => boolean) => ({ ...d, parts: d.parts.filter(g) })
  const head = only((p) => p.group === 'head')
  const props = only((p) => p.group === 'prop')
  const bad: string[] = []
  ;[...d.idle, ...d.tic].forEach((f, i) => {
    const a = render(head, f)
    const b = render(props, f)
    for (let k = 3; k < a.data.length; k += 4)
      if (a.data[k] >= 200 && b.data[k] >= 200) {
        const px = (k - 3) / 4
        bad.push(`frame ${i} (${px % W},${Math.floor(px / W)})`)
        return
      }
  })
  return bad
}

function report(d: Design) {
  const still = render(d)
  const m = measure(still, d.headBottom)
  const miss = misses(m)
  const orph = orphans(still, ['#ffffff', '#ffed44', '#f4e341', '#ede6ac', '#ffcfb4'])
  const clear = clearance(d)
  const f2 = (v: number) => v.toFixed(2)
  console.log(
    `${d.id} ${d.title.padEnd(20)} ${m.box.w}x${m.box.h} fill ${f2(m.fill)} aspect ${f2(m.aspect)} head ${f2(m.headShare)} top ${f2(m.topMass)} legs ${f2(m.legShare)} line ${f2(m.outlinePx)} inked ${f2(m.inkedEdge)} colours ${m.colours} orphans ${orph} props ${clear.length ? 'TOUCH THE HEAD ' + clear[0] : 'clear'}  ${miss.length ? 'MISS ' + miss.join('; ') : 'ok'}`,
  )
  return { m, miss, clear }
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

async function preview(dir: string, only?: string, list: readonly Design[] = DESIGNS) {
  mkdirSync(dir, { recursive: true })
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pack = await Promise.all(PACK_PEOPLE.map(async (p) => ({ ...p, img: await readPack(p.file) })))
  const tag = process.env.TAG ?? 0
  for (const d of list) {
    if (only && d.id !== only) continue
    const fb = frameBox([...idleFrames(d), ...ticFrames(d)])
    const cutp = (img: Rgba) => crop(img, fb.x0 - 1, fb.y0 - 1, fb.x1 - fb.x0 + 3, fb.y1 - fb.y0 + 3)
    const still = cutp(render(d))
    await sharp(await png(still, 8)).flatten({ background: '#79a863' }).toFile(join(dir, `${d.id}-8x-${tag}.png`))
    const frames = [...idleFrames(d), ...ticFrames(d)]
    const strip = await Promise.all(frames.map((f) => png(cutp(f), 2)))
    const html = `<!doctype html><style>${CSS(grass)} .row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px;padding:8px}</style>
      <div class="grass row">
      ${(await Promise.all(pack.map(async (p) => `<img src="${b64(await png(p.img, 3))}">`))).join('')}<img src="${b64(await png(still, 3))}"></div>
      <div class="grass row">${(await Promise.all(pack.map(async (p) => `<img src="${b64(await png(p.img, 1))}">`))).join('')}<img src="${b64(await png(still, 1))}"></div>
      <div class="grass row" style="flex-wrap:wrap">${strip.map((s) => `<img src="${b64(s)}">`).join('')}</div>`
    await shoot(html, join(dir, `${d.id}-lineup-${tag}.png`), 1100)
  }
  if (only) return
  const own = (d: Design) => {
    const fb = frameBox([render(d)])
    return crop(render(d), fb.x0 - 1, fb.y0 - 1, fb.x1 - fb.x0 + 3, fb.y1 - fb.y0 + 3)
  }
  const all2 = await Promise.all(list.map(async (d) => b64(await png(own(d), 3))))
  const html = `<!doctype html><style>${CSS(grass)} .row{display:flex;align-items:flex-end;gap:0;padding:6px;flex-wrap:wrap}</style>
    <div class="grass row">${(await Promise.all(pack.map(async (p) => `<img src="${b64(await png(p.img, 3))}">`))).join('')}${all2.map((s) => `<img src="${s}">`).join('')}</div>
    <div class="grass row">${(await Promise.all(pack.map(async (p) => `<img src="${b64(await png(p.img, 1))}">`))).join('')}${(await Promise.all(list.map(async (d) => `<img src="${b64(await png(own(d), 1))}">`))).join('')}</div>`
  await shoot(html, join(dir, `all-lineup-${tag}.png`), 1500)
}

// ── the cards ─────────────────────────────────────────────────────────────────

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

/** The union box of every frame (opaque or shadow). */
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
    </style><div class="wrap"><h1>Wren · ten designs</h1><p>Greenvial's herbalist, a gnome: ten brand-new hand-drawn takes at 3× (the game shows them at 1×), beside the CC0 pawn and knight at the same scale.</p>
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
    </style><div class="wrap"><h1>At game size (1×)</h1><p>The CC0 pawn, knight, archer and torch goblin, then Wren 1–10, on the pack's grass. Below: the same row at 2× for a phone.</p>
    <div class="row grass">${packOnes.join('')}${ones.join('')}</div>
    <div class="row grass big" style="margin-top:10px">${packTwos.join('')}${twos.join('')}</div></div>`
  await shoot(lineup, join(OUT, 'lineup.png'), 1240)

  // d01..d10: the design at 4× beside the pawn at 4×, the idle and tic at 2×, the concept line; and the motion loop
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
      <div class="lab"><span>CC0 pawn · 4×</span><span>Wren ${i + 1} · 4×</span></div>
      <div class="k">Idle, ${idle.length} frames · 2×</div><div class="strip grass">${idles.join('')}</div>
      <div class="k">Tic · 2×</div><div class="strip grass">${tics.join('')}</div></div>`
    await shoot(html, join(OUT, `${d.id}.png`), 600)
    await motion(d, join(OUT, `${d.id}.webp`), { x: bx, y: by, w: bw, h: bh })
    manifest.push({
      id: `wren-${d.id}`,
      group: 'Wren designs',
      people: 'Wren',
      title: `${i + 1}. ${d.title}`,
      caption: `${d.concept} Judge: would it pass for Pixel Frog's, and is it a gnome at 1×?`,
      file: `${d.id}.png`,
    })
    manifest.push({
      id: `wren-${d.id}-motion`,
      group: 'Wren designs',
      people: 'Wren',
      title: `${i + 1}. ${d.title} · motion`,
      caption: `The idle (the pack's squash and bob) and the tic, looped: does the tic say quiet, a little ominous?`,
      file: `${d.id}.webp`,
    })
  }
  manifest.unshift(
    { id: 'wren-sheet', group: 'Wren designs', people: 'Wren', title: 'Wren · all ten at 3×', caption: 'Ten brand-new gnome designs beside the CC0 pawn and knight. Judge: which two or three are Wren?', file: 'sheet.png' },
    { id: 'wren-lineup', group: 'Wren designs', people: 'Wren', title: 'Wren · at game size', caption: 'All ten at 1× on the grass beside the pack. Judge: does each read as a gnome, and does any stand out as not Pixel Frog?', file: 'lineup.png' },
  )
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
}

/** A 3 s loop at 4× on grass: the idle twice, the tic, then the idle to fill 3 s (longer if the tic needs it). Animated WebP (lossless) via sharp. */
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
  idle.forEach((img, i) => seq.push({ img, ms: d.idleMs[i] }))
  idle.forEach((img, i) => seq.push({ img, ms: d.idleMs[i] }))
  tic.forEach((img, i) => seq.push({ img, ms: d.ticMs[i] }))
  for (let k = 0, t = seq.reduce((a, s) => a + s.ms, 0); t < 3000 || k % idle.length; k++) {
    const ms = d.idleMs[k % idle.length]
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

// ── the bodies pass: each of the top three in a body of its own ───────────────

const BODY_IDS = ['d08', 'd02', 'd09']

/** bodies.png (each before vs after at 4×, from 1× stills of the shared-body version saved in `beforeDir`) and dXX-body.webp. */
async function bodies(beforeDir: string) {
  mkdirSync(OUT, { recursive: true })
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pawn = await readPack('mystic')
  const cell = async (img: Rgba, s: number) => b64(await png(img, s))
  const rows: string[] = []
  for (const id of BODY_IDS) {
    const d = DESIGNS.find((x) => x.id === id)!
    const { data, info } = await sharp(join(beforeDir, `${id}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const before: Rgba = { w: info.width, h: info.height, data: new Uint8ClampedArray(data) }
    const after = render(d)
    const b = frameBox([before, after, ...idleFrames(d), ...ticFrames(d)])
    const x = Math.max(0, b.x0 - 2), y = Math.max(0, b.y0 - 2), w = Math.min(W, b.x1 + 3) - x, h = Math.min(H, b.y1 + 3) - y
    rows.push(`<div class="r"><h2>${d.title}</h2><div class="top grass"><img src="${await cell(crop(before, x, y, w, h), 4)}"><img src="${await cell(crop(after, x, y, w, h), 4)}"></div>
      <div class="lab"><span>Before: the shared bell</span><span>After: ${BODY_NOTE[id]}</span></div>
      <div class="one grass">${(await Promise.all([pawn, crop(before, x, y, w, h), crop(after, x, y, w, h)].map((im) => cell(im, 1)))).map((u) => `<img src="${u}">`).join('')}</div></div>`)
    await motion(d, join(OUT, `${id}-body.webp`), { x, y, w, h })
  }
  const html = `<!doctype html><meta charset="utf-8"><style>${CSS(grass)}
    .wrap{padding:12px;width:576px} h1{font-size:20px;margin:0} p{margin:2px 0 8px;color:#c9cbbf;font-size:13.5px}
    h2{font-size:16px;margin:12px 0 4px;color:#ffe46b}
    .top{display:flex;align-items:flex-end;justify-content:space-around;padding:10px 6px 4px;border-radius:8px}
    .lab{display:flex;justify-content:space-around;font-size:12px;color:#c9cbbf;margin:4px 0 4px}
    .one{display:flex;align-items:flex-end;gap:10px;padding:6px 10px;border-radius:6px;width:max-content}
    </style><div class="wrap"><h1>Wren · bodies of their own</h1><p>The top three, each before (the shared bell and fists) and after (a body drawn for who they are) at 4×; below each, the CC0 pawn, before and after at 1×.</p>
    ${rows.join('')}</div>`
  await shoot(html, join(OUT, 'bodies.png'), 600)
  const mpath = join(OUT, 'manifest.json')
  const manifest: { id: string; group: string; people: string; title: string; caption: string; file: string }[] = existsSync(mpath) ? JSON.parse(readFileSync(mpath, 'utf8')) : []
  const keep = manifest.filter((m) => !m.id.endsWith('-body') && m.id !== 'wren-bodies')
  keep.push({ id: 'wren-bodies', group: 'Wren designs', people: 'Wren', title: 'Wren · bodies of their own', caption: 'The top three before (shared bell) and after (own body) at 4× and 1×. Judge: does each body say who they are, and do the three differ below the neck?', file: 'bodies.png' })
  for (const id of BODY_IDS) {
    const d = DESIGNS.find((x) => x.id === id)!
    keep.push({ id: `wren-${id}-body`, group: 'Wren designs', people: 'Wren', title: `${Number(id.slice(1))}. ${d.title} · own body, motion`, caption: `${BODY_NOTE[id][0].toUpperCase()}${BODY_NOTE[id].slice(1)}, with the idle and tic. Judge: still a tiny round gnome, hat leading?`, file: `${id}-body.webp` })
  }
  writeFileSync(mpath, JSON.stringify(keep, null, 2) + '\n')
}

/** d09-final.png (the designer's pick before / after its shoulders and nose, 4×, plus a 1× line-up beside the pack) and d09-final.webp. */
async function final(beforeDir: string) {
  mkdirSync(OUT, { recursive: true })
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pack = await Promise.all(PACK_PEOPLE.map(async (p) => ({ ...p, img: await readPack(p.file) })))
  const cell = async (img: Rgba, s: number) => b64(await png(img, s))
  const d = DESIGNS.find((x) => x.id === 'd09')!
  const { data, info } = await sharp(join(beforeDir, 'd09.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const before: Rgba = { w: info.width, h: info.height, data: new Uint8ClampedArray(data) }
  const after = render(d)
  const b = frameBox([before, after, ...idleFrames(d), ...ticFrames(d)])
  const x = Math.max(0, b.x0 - 2), y = Math.max(0, b.y0 - 2), w = Math.min(W, b.x1 + 3) - x, h = Math.min(H, b.y1 + 3) - y
  const ones = await Promise.all([...pack.map((p) => p.img), crop(before, x, y, w, h), crop(after, x, y, w, h)].map((im) => cell(im, 1)))
  const twos = await Promise.all([...pack.map((p) => p.img), crop(after, x, y, w, h)].map((im) => cell(im, 2)))
  const html = `<!doctype html><meta charset="utf-8"><style>${CSS(grass)}
    .wrap{padding:12px;width:576px} h1{font-size:20px;margin:0} p{margin:2px 0 8px;color:#c9cbbf;font-size:13.5px}
    .top{display:flex;align-items:flex-end;justify-content:space-around;padding:10px 6px 4px;border-radius:8px}
    .lab{display:flex;justify-content:space-around;font-size:12px;color:#c9cbbf;margin:4px 0 8px}
    .k{font-size:12px;color:#c9cbbf;margin:8px 0 3px}
    .row{display:flex;align-items:flex-end;gap:6px;padding:8px 10px;border-radius:6px;flex-wrap:wrap}
    </style><div class="wrap"><h1>9. Flowerpot Potter · shoulders and nose</h1><p>The pick, before and after at 4×: broad round shoulders the pot now rests on, and a long sausage nose that flops a frame behind the head.</p>
    <div class="top grass"><img src="${await cell(crop(before, x, y, w, h), 4)}"><img src="${await cell(crop(after, x, y, w, h), 4)}"></div>
    <div class="lab"><span>Before</span><span>After</span></div>
    <div class="k">At 1× (game size): the CC0 pawn, knight, archer and torch goblin, then before and after</div>
    <div class="row grass">${ones.map((u) => `<img src="${u}">`).join('')}</div>
    <div class="k">The same at 2×</div>
    <div class="row grass">${twos.map((u) => `<img src="${u}">`).join('')}</div></div>`
  await shoot(html, join(OUT, 'd09-final.png'), 600)
  await motion(d, join(OUT, 'd09-final.webp'), { x, y, w, h })
  const mpath = join(OUT, 'manifest.json')
  const manifest: { id: string; group: string; people: string; title: string; caption: string; file: string }[] = existsSync(mpath) ? JSON.parse(readFileSync(mpath, 'utf8')) : []
  const keep = manifest.filter((m) => !m.id.startsWith('wren-d09-final'))
  keep.push(
    { id: 'wren-d09-final', group: 'Wren designs', people: 'Wren', title: '9. Flowerpot Potter · shoulders and nose', caption: 'Before and after at 4× and 1× beside the pack: the pot now sits on round shoulders, and the nose is a long sausage. Judge: does the pot fit the body now?', file: 'd09-final.png' },
    { id: 'wren-d09-final-motion', group: 'Wren designs', people: 'Wren', title: '9. Flowerpot Potter · the nose flops', caption: 'The idle and the trowel tic, looped: the nose lags the head a frame and swings on each tap. Judge: floppy, not jittery?', file: 'd09-final.webp' },
  )
  writeFileSync(mpath, JSON.stringify(keep, null, 2) + '\n')
}

/** d09-options.png (the pick and A–E at 4× with what each pushes, then all at 1× and 2× beside the pack) and d09-options.webp (all six idling and doing their tic). */
async function options() {
  mkdirSync(OUT, { recursive: true })
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pack = await Promise.all(PACK_PEOPLE.map(async (p) => ({ ...p, img: await readPack(p.file) })))
  const cell = async (img: Rgba, s: number) => b64(await png(img, s))
  const pick = DESIGNS.find((x) => x.id === 'd09')!
  const six = [{ d: pick, label: 'Now · d09-final, the pick' }, ...OPTIONS]
  const all = frameBox(six.flatMap(({ d }) => [...idleFrames(d), ...ticFrames(d)]))
  const x = Math.max(0, all.x0 - 1), y = Math.max(0, all.y0 - 1), w = Math.min(W, all.x1 + 2) - x, h = Math.min(H, all.y1 + 2) - y
  const cut = (img: Rgba) => crop(img, x, y, w, h)
  const tiles = await Promise.all(six.map(async ({ d, label }) => `<div class="c"><img src="${await cell(cut(render(d)), 4)}"><b>${label}</b></div>`))
  const ones = await Promise.all([...pack.map((p) => p.img), ...six.map(({ d }) => cut(render(d)))].map((im) => cell(im, 1)))
  const twos = await Promise.all([...pack.map((p) => p.img), ...six.map(({ d }) => cut(render(d)))].map((im) => cell(im, 2)))
  const html = `<!doctype html><meta charset="utf-8"><style>${CSS(grass)}
    .wrap{padding:12px;width:1176px} h1{font-size:22px;margin:0} p{margin:2px 0 10px;color:#c9cbbf;font-size:14px}
    .g{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-radius:8px;overflow:hidden}
    .c{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:8px 4px 10px}
    .c b{font-size:16px;color:#fff;text-shadow:0 2px 0 #161c2e,0 0 4px #161c2e;margin-top:2px;text-align:center}
    .k{font-size:13px;color:#c9cbbf;margin:10px 0 3px}
    .row{display:flex;align-items:flex-end;gap:8px;padding:8px 10px;border-radius:6px;flex-wrap:wrap}
    </style><div class="wrap"><h1>Wren · the Flowerpot Potter, five ways further</h1><p>The pick (d09-final) and five refinements at 4×, each pushing one direction; all keep the pot, the shoulders it sits on, the floppy nose and his own body.</p>
    <div class="g grass">${tiles.join('')}</div>
    <div class="k">At 1× (game size): the CC0 pawn, knight, archer and torch goblin, then Now, A, B, C, D, E</div>
    <div class="row grass">${ones.map((u) => `<img src="${u}">`).join('')}</div>
    <div class="k">The same at 2×</div>
    <div class="row grass">${twos.map((u) => `<img src="${u}">`).join('')}</div></div>`
  await shoot(html, join(OUT, 'd09-options.png'), 1200)
  await optionsMotion(six.map((o) => o.d), join(OUT, 'd09-options.webp'), { x, y, w, h })
  const mpath = join(OUT, 'manifest.json')
  const manifest: { id: string; group: string; people: string; title: string; caption: string; file: string }[] = existsSync(mpath) ? JSON.parse(readFileSync(mpath, 'utf8')) : []
  const keep = manifest.filter((m) => !m.id.startsWith('wren-d09-options'))
  keep.push(
    { id: 'wren-d09-options', group: 'Wren designs', people: 'Wren', title: '9. Flowerpot Potter · five options', caption: 'The pick and five refinements, each pushing one thing (nose, pot, join, trade, posture), at 4× and at 1× beside the pack. Judge: which direction, or which mix?', file: 'd09-options.png' },
    { id: 'wren-d09-options-motion', group: 'Wren designs', people: 'Wren', title: '9. Flowerpot Potter · five options, moving', caption: 'All six idling and doing their tic: sneeze, spores, shrug, sniff, stamp. Judge: which tic says him?', file: 'd09-options.webp' },
  )
  writeFileSync(mpath, JSON.stringify(keep, null, 2) + '\n')
}

/** All six side by side at 3× on one grass strip: each plays its idle once, then its tic, then idles out to 3 s; a frame is cut wherever any of the six changes (on a 20 ms grid). */
async function optionsMotion(list: readonly Design[], path: string, box: { x: number; y: number; w: number; h: number }) {
  const S = 3, pad = 6, gap = 4
  const cw = list.length * (box.w * S + gap) - gap + pad * 2, ch = box.h * S + pad * 2
  const grassTile = await sharp(join(PACK, 'grass.png')).resize(96, 96, { kernel: 'nearest' }).png().toBuffer()
  const bg = await sharp({ create: { width: cw, height: ch, channels: 4, background: '#79a863' } }).composite([{ input: grassTile, tile: true, left: 0, top: 0 }]).png().toBuffer()
  const TOTAL = 3000
  // each design's timeline: [start ms, frame]
  const lines = list.map((d) => {
    const idle = idleFrames(d), tic = ticFrames(d)
    const seq: { img: Rgba; ms: number }[] = []
    idle.forEach((img, i) => seq.push({ img, ms: d.idleMs[i] }))
    tic.forEach((img, i) => seq.push({ img, ms: d.ticMs[i] }))
    for (let k = 0, t = seq.reduce((a, q) => a + q.ms, 0); t < TOTAL; k++) { seq.push({ img: idle[k % idle.length], ms: d.idleMs[k % idle.length] }); t += d.idleMs[k % idle.length] }
    return seq
  })
  const at = (seq: { img: Rgba; ms: number }[], t: number) => { let a = 0; for (const q of seq) { if (t < a + q.ms) return q.img; a += q.ms } return seq[seq.length - 1].img }
  const cuts = new Set<number>([0])
  // cuts snapped to a 20 ms grid: players stretch any delay of 10 ms or less to 100 ms
  for (const seq of lines) { let a = 0; for (const q of seq) { a += q.ms; const c = Math.round(a / 20) * 20; if (c > 0 && c < TOTAL) cuts.add(c) } }
  const times = [...cuts].sort((p, q) => p - q)
  const frames: Buffer[] = []
  const delays: number[] = []
  for (const [i, t] of times.entries()) {
    const comp = await Promise.all(lines.map(async (seq, k) => ({ input: await png(crop(at(seq, t), box.x, box.y, box.w, box.h), S), left: pad + k * (box.w * S + gap), top: pad })))
    frames.push(await sharp(bg).composite(comp).raw().toBuffer())
    delays.push((times[i + 1] ?? TOTAL) - t)
  }
  await sharp(Buffer.concat(frames), { raw: { width: cw, height: ch * frames.length, channels: 4, pageHeight: ch } }).webp({ lossless: true, loop: 0, delay: delays }).toFile(path)
}

const BODY_NOTE: Record<string, string> = {
  d08: 'a mossy robe to the ground, root-hemmed, a vine belt, hands in its sleeves',
  d02: "a gardener's waistcoat, rolled sleeves, a trowel loop, soil on the knees",
  d09: "a clay-smeared potter's apron over a round belly",
}

async function main() {
  const args = process.argv.slice(2)
  const results = DESIGNS.map(report)
  const pi = args.indexOf('--preview')
  if (pi >= 0) await preview(args[pi + 1] ?? join(tmpdir(), 'wren-preview'), args[pi + 2])
  const si = args.indexOf('--stills')
  if (si >= 0) {
    const dir = args[si + 1]
    mkdirSync(dir, { recursive: true })
    for (const d of DESIGNS) await sharp(await png(render(d), 1)).toFile(join(dir, `${d.id}.png`))
  }
  const bi = args.indexOf('--bodies')
  if (bi >= 0) await bodies(args[bi + 1])
  const oi = args.indexOf('--opreview')
  if (oi >= 0) {
    OPTIONS.forEach((o) => report(o.d))
    await preview(args[oi + 1], undefined, [DESIGNS.find((x) => x.id === 'd09')!, ...OPTIONS.map((o) => o.d)])
  }
  if (args.includes('--options')) {
    const bad = OPTIONS.map((o) => report(o.d)).filter((r) => r.miss.length || r.clear.length)
    if (bad.length) throw new Error('an option is out of band or a prop touches the head: no cards')
    await options()
  }
  const fi = args.indexOf('--final')
  if (fi >= 0) await final(args[fi + 1])
  if (args.includes('--cards')) {
    if (results.some((r) => r.miss.length || r.clear.length)) throw new Error('a design is out of band or a prop touches the head: no cards')
    await cards()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
