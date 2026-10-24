/**
 * Brannoch — ten brand-new character designs for Ironvein's ore factor at the
 * Tiny Swords pack's scale (exploration cards for the designer; nothing here
 * is wired into the game).
 *
 *   npx tsx scripts/designs/brannoch.ts                 # measure all ten: bands, palette, clearance
 *   npx tsx scripts/designs/brannoch.ts --preview DIR   # 8× stills + 1×/3× line-ups for the critique rounds
 *   npx tsx scripts/designs/brannoch.ts --cards         # the cards in docs/characters/cards/designs/brannoch/
 *   npx tsx scripts/designs/brannoch.ts --bodies [DIR]  # the top three's own bodies: before/after card + motion (or a preview into DIR)
 *   npx tsx scripts/designs/brannoch.ts --final [DIR]   # the designer's pick, d07, with his boots: before/after + 1× line-up, and the loop
 *
 * Every figure is a hand-authored pixel map (brannoch-d01.ts … brannoch-d10.ts);
 * brannoch-lib.ts only stamps the pack's outline and composes the frames. The
 * pack figures shown beside them are the old-CC0 stills already shipped in
 * public/assets/sprites/tinyswords/ (see sprites/CREDITS.md).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { H, INK, W, idleFrames, measure, misses, orphans, render, ticFrames, type Design, type Rgba } from './brannoch-lib'
import { DESIGNS } from './brannoch-all'
import { AT, DASH } from './brannoch-common'
import { BODY_SHARED as D01_SHARED } from './brannoch-d01'
import { BODY_SHARED as D06_SHARED } from './brannoch-d06'
import { BODY_SHARED as D07_SHARED, D07_BEFORE } from './brannoch-d07'
import { packColours } from './brannoch-pal'

const ROOT = resolve(import.meta.dirname, '..', '..')
const PACK = join(ROOT, 'public', 'assets', 'sprites', 'tinyswords')
const OUT = join(ROOT, 'docs', 'characters', 'cards', 'designs', 'brannoch')
const GROUP = 'Brannoch designs'

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

/** Every ink a design names must be a colour of the old-CC0 pack. */
function offPalette(d: Design, pack: Map<string, number>): string[] {
  const used = new Set<string>()
  for (const p of d.parts) for (const r of p.rows) for (const ch of r) if (ch !== '.' && ch !== 'k' && ch !== 's') used.add(ch)
  const swaps = [...d.idle, ...d.tic].flatMap((f) => Object.values(f.swap ?? {}))
  for (const rows of swaps) for (const r of rows) for (const ch of r) if (ch !== '.' && ch !== 'k' && ch !== 's') used.add(ch)
  return [...used].filter((ch) => !pack.has(d.pal[ch])).map((ch) => `${ch}=${d.pal[ch]}`)
}

/**
 * The designer's note on Saffra ("a different item that doesn't overlap the
 * hat"): in no frame of the idle or the tic may a prop or an effect cover the
 * head mass (hat, hair, beard). Its pixels may not sit on the head's pixels
 * or its ink ring, and its ink ring may not cut into the head's pixels; two
 * ink rings touching (the pack's way of setting one thing beside another) is
 * allowed.
 */
function clearance(d: Design): string[] {
  const only = (g: (p: Design['parts'][number]) => boolean, ring: boolean): Design => ({
    ...d,
    parts: d.parts.filter(g).map((p) => (ring ? p : { ...p, ring: 0 as const })),
  })
  const isHead = (p: Design['parts'][number]) => p.group === 'head'
  const isProp = (p: Design['parts'][number]) => p.group === 'prop' || p.group === 'fx'
  const bad: string[] = []
  ;[...d.idle, ...d.tic].forEach((f, i) => {
    const headAll = render(only(isHead, true), f).data
    const headSolid = render(only(isHead, false), f).data
    const propAll = render(only(isProp, true), f).data
    const propSolid = render(only(isProp, false), f).data
    for (let k = 3; k < W * H * 4; k += 4)
      if ((propSolid[k] && headAll[k]) || (propAll[k] && headSolid[k])) {
        const px = (k - 3) / 4
        bad.push(`frame ${i} (${px % W},${(px / W) | 0})`)
        return
      }
  })
  return bad
}

function report(d: Design, pack: Map<string, number>) {
  const still = render(d)
  const m = measure(still, d.headBottom)
  const miss = misses(m)
  const orph = orphans(still, DASH)
  const off = offPalette(d, pack)
  const clr = clearance(d)
  const f2 = (v: number) => v.toFixed(2)
  console.log(
    `${d.id} ${d.title.padEnd(20)} ${m.box.w}x${m.box.h} fill ${f2(m.fill)} aspect ${f2(m.aspect)} head ${f2(m.headShare)} top ${f2(m.topMass)} legs ${f2(m.legShare)} line ${f2(m.outlinePx)} inked ${f2(m.inkedEdge)} colours ${m.colours} orphans ${orph}` +
      `  ${miss.length ? 'MISS ' + miss.join('; ') : 'bands ok'}` +
      `  ${off.length ? 'OFF-PALETTE ' + off.join(' ') : 'palette ok'}` +
      `  ${clr.length ? 'PROP ON HEAD ' + clr.join(', ') : 'props clear'}`,
  )
  return { m, miss, off, clr }
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
  const tag = process.env.TAG ?? 0
  for (const d of DESIGNS) {
    if (only && d.id !== only) continue
    const still = render(d)
    const box = frameBox([still])
    const c = crop(still, box.x0 - 2, box.y0 - 2, box.x1 - box.x0 + 5, box.y1 - box.y0 + 5)
    await sharp(await png(c, 8)).flatten({ background: '#79a863' }).toFile(join(dir, `${d.id}-8x-${tag}.png`))
    const frames = [...idleFrames(d), ...ticFrames(d)].map((f) => crop(f, box.x0 - 6, box.y0 - 12, box.x1 - box.x0 + 14, box.y1 - box.y0 + 16))
    const strip = await Promise.all(frames.map((f) => png(f, 3)))
    const html = `<!doctype html><style>${CSS(grass)} .row{display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px;padding:8px}</style>
      <div class="grass row">${(await Promise.all(pack.map(async (p) => `<img src="${b64(await png(p.img, 3))}">`))).join('')}<img src="${b64(await png(c, 3))}"></div>
      <div class="grass row">${(await Promise.all(pack.map(async (p) => `<img src="${b64(await png(p.img, 1))}">`))).join('')}<img src="${b64(await png(c, 1))}"></div>
      <div class="grass row">${strip.map((s) => `<img src="${b64(s)}">`).join('')}</div>`
    await shoot(html, join(dir, `${d.id}-lineup-${tag}.png`), 1300)
  }
  if (only) return
  const all = frameBox(DESIGNS.map((d) => render(d)))
  const cut = (img: Rgba) => crop(img, all.x0 - 1, all.y0 - 1, all.x1 - all.x0 + 3, all.y1 - all.y0 + 3)
  const row = async (s: number) =>
    (await Promise.all(pack.map(async (p) => `<img src="${b64(await png(p.img, s))}">`))).join('') +
    (await Promise.all(DESIGNS.map(async (d) => `<img src="${b64(await png(cut(render(d)), s))}">`))).join('')
  const html = `<!doctype html><style>${CSS(grass)} .row{display:flex;align-items:flex-end;gap:0;padding:6px;flex-wrap:wrap}</style>
    <div class="grass row">${await row(3)}</div><div class="grass row">${await row(1)}</div>`
  await shoot(html, join(dir, `all-lineup-${tag}.png`), 1900)
  // all ten at 5×, two rows: the 8×-level read of texture, clusters and ramps in one look
  const zoom = `<!doctype html><style>${CSS(grass)} .row{display:flex;align-items:flex-end;gap:4px;padding:6px;flex-wrap:wrap}</style>
    <div class="grass row">${(await Promise.all(DESIGNS.map(async (d) => `<img src="${b64(await png(cut(render(d)), 5))}">`))).join('')}</div>`
  await shoot(zoom, join(dir, `all-zoom-${tag}.png`), 1660)
}

// ── the cards ─────────────────────────────────────────────────────────────────

/** Crop a frame to a box (pixels outside the canvas stay clear). */
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
    </style><div class="wrap"><h1>Brannoch · ten designs</h1><p>Ironvein's ore factor, ten brand-new hand-drawn takes at 3× (the game shows them at 1×), beside the CC0 pawn and knight at the same scale.</p>
    <div class="g grass">${sheetCells.join('')}${refCells.join('')}</div></div>`
  await shoot(sheet, join(OUT, 'sheet.png'), 1240)

  // lineup.png: all ten at 1× on grass beside the pack (the true game size), then the same row at 2×
  const ones = await Promise.all(DESIGNS.map(async (d) => `<img src="${await cell(cut(render(d)), 1)}">`))
  const packOnes = await Promise.all(pack.map(async (p) => `<img src="${await cell(p.img, 1)}">`))
  const twos = await Promise.all(DESIGNS.map(async (d) => `<img src="${await cell(cut(render(d)), 2)}">`))
  const packTwos = await Promise.all(pack.map(async (p) => `<img src="${await cell(p.img, 2)}">`))
  const lineup = `<!doctype html><meta charset="utf-8"><style>${CSS(grass)}
    .wrap{padding:12px} h1{font-size:18px;margin:0 0 2px} p{margin:0 0 8px;color:#c9cbbf;font-size:13px}
    .row{display:flex;align-items:flex-end;gap:2px;padding:10px 8px 6px;border-radius:6px}
    .big{flex-wrap:wrap;row-gap:8px}
    </style><div class="wrap"><h1>At game size (1×)</h1><p>The CC0 pawn, knight, archer and torch goblin, then Brannoch 1–10, on the pack's grass. Below: the same row at 2× for a phone.</p>
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
      <div class="lab"><span>CC0 pawn · 4×</span><span>Brannoch ${i + 1} · 4×</span></div>
      <div class="k">Idle, ${idle.length} frames · 2×</div><div class="strip grass">${idles.join('')}</div>
      <div class="k">Tic, ${tic.length} frames · 2×</div><div class="strip grass">${tics.join('')}</div></div>`
    await shoot(html, join(OUT, `${d.id}.png`), 600)
    await motion(d, join(OUT, `${d.id}.webp`), { x: bx, y: by, w: bw, h: bh })
    manifest.push({
      id: `brannoch-${d.id}`,
      group: GROUP,
      people: 'Brannoch',
      title: `${i + 1}. ${d.title}`,
      caption: `${d.concept} Judge: would it pass for Pixel Frog's, and is it Brannoch?`,
      file: `${d.id}.png`,
    })
    manifest.push({
      id: `brannoch-${d.id}-motion`,
      group: GROUP,
      people: 'Brannoch',
      title: `${i + 1}. ${d.title} · motion`,
      caption: `The idle (a heavy squash and bob) and the tic, looped: does the tic say who he is?`,
      file: `${d.id}.webp`,
    })
  }
  manifest.unshift(
    { id: 'brannoch-sheet', group: GROUP, people: 'Brannoch', title: 'Brannoch · all ten at 3×', caption: 'Ten brand-new dwarf designs beside the CC0 pawn and knight. Judge: which two or three are Brannoch?', file: 'sheet.png' },
    { id: 'brannoch-lineup', group: GROUP, people: 'Brannoch', title: 'Brannoch · at game size', caption: 'All ten at 1× on the grass beside the pack. Judge: does each read as a dwarf, and does any stand out as not Pixel Frog?', file: 'lineup.png' },
  )
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
}

/** A 3–4 s loop at 4× on grass: the idle twice, the tic, then the idle to fill 3.6 s. Animated WebP (lossless) via sharp. */
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
  tic.forEach((img, i) => seq.push({ img, ms: d.ticMs[i] }))
  const LOOP = 3600
  for (let k = 0, t = seq.reduce((a, s) => a + s.ms, 0); t < LOOP; k++) {
    const ms = Math.min(d.idleMs[k % idle.length], LOOP - t)
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

// ── the top three's own bodies (the designer: "Body doesn't need to be shared, it should be unique") ──

interface Bodied {
  id: string
  /** The shared bell it wore before. */
  shared: readonly string[]
  /** Parts its own body moved, back where they stood in the bell. */
  before?: Readonly<Record<string, readonly [number, number]>>
  /** The body, in words, for the card. */
  body: string
}

const BODIED: readonly Bodied[] = [
  { id: 'd07', shared: D07_SHARED, body: 'a short stone-grey smock, belted, under a long leather mason\'s apron that hangs to his boots: dust ground in, a stitched pocket, a pouch and a chisel at the belt' },
  { id: 'd01', shared: D01_SHARED, body: 'a square padded miner\'s jerkin in puffed quilting, leather braces and belt, a tin lamp-oil flask at the hip' },
  {
    id: 'd06',
    shared: D06_SHARED,
    before: { ledger: [18, 55], ledgerOpen: [17, 57], handB: [AT.handB[0], AT.handB[1]] },
    body: 'a long drover\'s coat, square in the shoulder, a wide belt with a big buckle, the skirts split at the vent and kicked out behind',
  },
]

/** The design as it stood in the shared bell: its own body parts gone, the bell back at the shared spot. */
function before(d: Design, b: Bodied): Design {
  const moved = b.before ?? {}
  return {
    ...d,
    id: `${d.id}-shared`,
    parts: d.parts
      .filter((p) => (!p.id.startsWith('body') || p.id === 'body') && !p.id.startsWith('boot'))
      .map((p) =>
        p.id === 'body'
          ? { ...p, x: AT.body[0], y: AT.body[1], rows: b.shared }
          : p.id === 'feet'
            ? { ...p, hidden: false }
            : moved[p.id]
              ? { ...p, x: moved[p.id][0], y: moved[p.id][1] }
              : p,
      ),
  }
}

async function bodies(dir?: string) {
  const out = dir ?? OUT
  mkdirSync(out, { recursive: true })
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pack = await Promise.all(PACK_PEOPLE.map(async (p) => ({ ...p, img: await readPack(p.file) })))
  const pairs = BODIED.map((b) => {
    const d = DESIGNS.find((x) => x.id === b.id)
    if (!d) throw new Error(`no design ${b.id}`)
    return { ...b, d, old: before(d, b), n: DESIGNS.indexOf(d) + 1 }
  })
  const box = frameBox(pairs.flatMap((p) => [render(p.old), ...idleFrames(p.d), ...ticFrames(p.d)]))
  const cut = (img: Rgba) => crop(img, box.x0 - 2, box.y0 - 2, box.x1 - box.x0 + 5, box.y1 - box.y0 + 5)
  const cell = async (img: Rgba, s: number) => b64(await png(img, s))
  const rows = await Promise.all(
    pairs.map(
      async (p) => `<h2><span class="no">${p.n}.</span> ${p.d.title}</h2><p>${p.body}.</p>
      <div class="two grass"><figure><img src="${await cell(cut(render(p.old)), 4)}"><figcaption>Before · the shared bell</figcaption></figure>
      <figure><img src="${await cell(cut(render(p.d)), 4)}"><figcaption>After · his own body</figcaption></figure></div>`,
    ),
  )
  const ones =
    (await Promise.all(pack.map(async (p) => `<img src="${await cell(p.img, 1)}">`))).join('') +
    (await Promise.all(pairs.map(async (p) => `<img src="${await cell(cut(render(p.d)), 1)}">`))).join('')
  const threes = (await Promise.all(pairs.map(async (p) => `<img src="${await cell(cut(render(p.d)), 3)}">`))).join('')
  const html = `<!doctype html><meta charset="utf-8"><style>${CSS(grass)}
    .wrap{padding:12px;width:576px} h1{font-size:20px;margin:0 0 2px} p{margin:2px 0 6px;color:#c9cbbf;font-size:13px}
    h2{font-size:17px;margin:12px 0 0} .no{color:#ffe46b}
    .two{display:flex;justify-content:space-around;align-items:flex-end;border-radius:8px;padding:8px 4px 2px}
    figure{margin:0;display:flex;flex-direction:column;align-items:center}
    figcaption{font-size:12px;color:#fff;text-shadow:0 1px 0 #161c2e,0 0 3px #161c2e;margin:2px 0 4px}
    .row{display:flex;align-items:flex-end;gap:3px;padding:8px;border-radius:8px;margin-top:6px;flex-wrap:wrap}
    </style><div class="wrap"><h1>Brannoch · his own body</h1><p>The top three, each before (the one shared bell tunic) and after (a body drawn for who he is), at 4×.</p>
    ${rows.join('')}
    <h2>Together</h2><p>The three at 3×, then at 1× beside the CC0 pawn, knight, archer and torch goblin.</p>
    <div class="row grass">${threes}</div><div class="row grass">${ones}</div></div>`
  await shoot(html, join(out, 'bodies.png'), 600)
  for (const p of pairs) {
    const b = frameBox([...idleFrames(p.d), ...ticFrames(p.d)])
    const bx = Math.max(0, b.x0 - 2), by = Math.max(0, b.y0 - 2)
    await motion(p.d, join(out, `${p.d.id}-body.webp`), { x: bx, y: by, w: Math.min(W, b.x1 + 3) - bx, h: Math.min(H, b.y1 + 3) - by })
  }
  if (dir) return
  type Card = { id: string; group: string; people: string; title: string; caption: string; file: string }
  const mpath = join(OUT, 'manifest.json')
  const keep = (JSON.parse(readFileSync(mpath, 'utf8')) as Card[]).filter((m) => m.id !== 'brannoch-bodies' && !m.id.endsWith('-body'))
  keep.push(
    {
      id: 'brannoch-bodies',
      group: GROUP,
      people: 'Brannoch',
      title: 'Brannoch · his own body',
      caption: 'The top three, each before (the shared bell) and after (a body of his own), at 4×. Judge: does each body say who he is, and do the three differ below the beard?',
      file: 'bodies.png',
    },
    ...pairs.map((p) => ({
      id: `brannoch-${p.d.id}-body`,
      group: GROUP,
      people: 'Brannoch',
      title: `${p.n}. ${p.d.title} · own body, motion`,
      caption: `The idle and the tic in his own body: ${p.body}. Judge: is it broad and planted, and still head-led?`,
      file: `${p.d.id}-body.webp`,
    })),
  )
  writeFileSync(mpath, JSON.stringify(keep, null, 2) + '\n')
}

// ── the designer's pick: d07, the Mason Guild Elder ("i dont see his feet") ──

async function final(dir?: string) {
  const out = dir ?? OUT
  mkdirSync(out, { recursive: true })
  const d = DESIGNS.find((x) => x.id === 'd07')
  if (!d) throw new Error('no d07')
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pack = await Promise.all(PACK_PEOPLE.map(async (p) => ({ ...p, img: await readPack(p.file) })))
  const box = frameBox([render(D07_BEFORE), ...idleFrames(d), ...ticFrames(d)])
  const cut = (img: Rgba) => crop(img, box.x0 - 2, box.y0 - 2, box.x1 - box.x0 + 5, box.y1 - box.y0 + 5)
  const cell = async (img: Rgba, s: number) => b64(await png(img, s))
  const ones = (await Promise.all(pack.map(async (p) => `<img src="${await cell(p.img, 1)}">`))).join('') + `<img src="${await cell(cut(render(d)), 1)}">`
  const threes = (await Promise.all(pack.map(async (p) => `<img src="${await cell(p.img, 3)}">`))).join('') + `<img src="${await cell(cut(render(d)), 3)}">`
  const html = `<!doctype html><meta charset="utf-8"><style>${CSS(grass)}
    .wrap{padding:12px;width:576px} h1{font-size:20px;margin:0 0 2px} p{margin:2px 0 6px;color:#c9cbbf;font-size:13px}
    h2{font-size:15px;margin:12px 0 2px}
    .two{display:flex;justify-content:space-around;align-items:flex-end;border-radius:8px;padding:8px 4px 2px}
    figure{margin:0;display:flex;flex-direction:column;align-items:center}
    figcaption{font-size:12px;color:#fff;text-shadow:0 1px 0 #161c2e,0 0 3px #161c2e;margin:2px 0 4px}
    .row{display:flex;align-items:flex-end;gap:3px;padding:8px;border-radius:8px;flex-wrap:wrap}
    </style><div class="wrap"><h1>7. Mason Guild Elder · his boots</h1>
    <p>The apron now stops at his boot tops, so two dark leather boots with iron toe caps stand planted under the stepped hem. The near boot steps out past the apron, and the mallet hangs clear of it.</p>
    <div class="two grass"><figure><img src="${await cell(cut(render(D07_BEFORE)), 4)}"><figcaption>Before · the apron to the ground</figcaption></figure>
    <figure><img src="${await cell(cut(render(d)), 4)}"><figcaption>After · his boots</figcaption></figure></div>
    <h2>At game size (1×) beside the CC0 pawn, knight, archer and torch goblin</h2><div class="row grass">${ones}</div>
    <h2>The same at 3×</h2><div class="row grass">${threes}</div></div>`
  await shoot(html, join(out, 'd07-final.png'), 600)
  const b = frameBox([...idleFrames(d), ...ticFrames(d)])
  const bx = Math.max(0, b.x0 - 2), by = Math.max(0, b.y0 - 2)
  await motion(d, join(out, 'd07-final.webp'), { x: bx, y: by, w: Math.min(W, b.x1 + 3) - bx, h: Math.min(H, b.y1 + 3) - by })
  if (dir) return
  type Card = { id: string; group: string; people: string; title: string; caption: string; file: string }
  const mpath = join(OUT, 'manifest.json')
  const keep = (JSON.parse(readFileSync(mpath, 'utf8')) as Card[]).filter((m) => !m.id.startsWith('brannoch-d07-final'))
  keep.push(
    {
      id: 'brannoch-d07-final',
      group: GROUP,
      people: 'Brannoch',
      title: '7. Mason Guild Elder · his boots',
      caption: 'The pick, now with his boots showing under a shorter apron, before and after at 4×, then at 1× and 3× beside the pack. Judge: do his feet read at game size?',
      file: 'd07-final.png',
    },
    {
      id: 'brannoch-d07-final-motion',
      group: GROUP,
      people: 'Brannoch',
      title: '7. Mason Guild Elder · his boots, motion',
      caption: 'The idle and the beard-stroke tic with his boots planted. Judge: does he stand firm, and does the tic still read?',
      file: 'd07-final.webp',
    },
  )
  writeFileSync(mpath, JSON.stringify(keep, null, 2) + '\n')
}

async function main() {
  const args = process.argv.slice(2)
  const pack = await packColours()
  if (!pack.has(INK)) throw new Error('the pack palette has no outline ink')
  let fail = 0
  for (const d of DESIGNS) {
    const r = report(d, pack)
    if (r.miss.length || r.off.length || r.clr.length) fail++
  }
  const pi = args.indexOf('--preview')
  if (pi >= 0) await preview(args[pi + 1] ?? join(tmpdir(), 'brannoch-preview'), args[pi + 2])
  if (args.includes('--cards')) {
    if (fail && !args.includes('--force')) throw new Error(`${fail} design(s) out of band: fix them before making cards`)
    await cards()
  }
  const fi = args.indexOf('--final')
  if (fi >= 0) {
    if (fail && !args.includes('--force')) throw new Error(`${fail} design(s) out of band: fix them before making cards`)
    await final(args[fi + 1] && !args[fi + 1].startsWith('--') ? args[fi + 1] : undefined)
  }
  const bi = args.indexOf('--bodies')
  if (bi >= 0) {
    if (fail && !args.includes('--force')) throw new Error(`${fail} design(s) out of band: fix them before making cards`)
    await bodies(args[bi + 1] && !args[bi + 1].startsWith('--') ? args[bi + 1] : undefined)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
