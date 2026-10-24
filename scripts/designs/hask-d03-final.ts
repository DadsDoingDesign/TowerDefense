/**
 * Hask d03, the Salt-Barge Poleman: the designer's pick ("hask 1 is my
 * favorite but also still needs refinement"; then "the hat isn't centered on
 * his head really"). This script measures, per frame, where the reed cone
 * sits over his skull, and renders the card: the first refinement
 * (hask-before-d03-refined.ts) beside the centred one (hask-d03.ts) at 4×
 * with centre lines, the idle and the stroke at 2×, the per-frame offsets,
 * a 1× / 2× line-up beside the pack; and the motion loop.
 *
 *   npx tsx scripts/designs/hask-d03-final.ts           # bands + clearance + the per-frame centring, then the cards
 *   npx tsx scripts/designs/hask-d03-final.ts --measure # the per-frame centring only
 *
 * The measure (from the rendered pixels of each frame, ink ring excluded):
 * - the hat's brim midpoint: the middle of the cone's widest row;
 * - the hat's apex: the middle of its top row (the reed tuft);
 * - the skull's centre: the middle of the head piece's skull, its first 18
 *   columns (cheek to brow; the snout runs on ahead of it).
 * The cone is 57 px wide and the skull 18, so dead centre is ±0.5 px.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { INK, W, H, idleFrames, render, ticFrames, type Design, type Frame, type Rgba } from './hask-lib'
import { CSS, PACK, PACK_PEOPLE, b64, cc0Palette, crop, frameBox, motion, png, readPack, report, shoot } from './hask'
import { D03 } from './hask-d03'
import { D03_REFINED } from './hask-before-d03-refined'

const OUT = join(resolve(import.meta.dirname, '..', '..'), 'docs', 'characters', 'cards', 'designs', 'hask')
const SKULL_COLS = 18

/** The opaque, non-ink pixels of one part in one frame, as [x, y]. */
function partPixels(d: Design, id: string, f: Frame): [number, number][] {
  const img = render({ ...d, parts: d.parts.filter((p) => p.id === id) }, f)
  const ink = [1, 3, 5].map((i) => parseInt(INK.slice(i, i + 2), 16))
  const out: [number, number][] = []
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      if (img.data[i + 3] < 200) continue
      if (img.data[i] === ink[0] && img.data[i + 1] === ink[1] && img.data[i + 2] === ink[2]) continue
      out.push([x, y])
    }
  return out
}

export interface Centring { hatMid: number; apex: number; skull: number; dMid: number; dApex: number }

export function centring(d: Design, f: Frame = {}): Centring {
  const hat = partPixels(d, 'hat', f)
  const rows = new Map<number, number[]>()
  for (const [x, y] of hat) rows.set(y, [...(rows.get(y) ?? []), x])
  let widest: number[] = []
  for (const xs of rows.values()) if (xs.length > widest.length) widest = xs
  const top = rows.get(Math.min(...rows.keys()))!
  const mid = (xs: number[]) => (Math.min(...xs) + Math.max(...xs)) / 2
  const head = partPixels(d, 'snout', f)
  const x0 = Math.min(...head.map((p) => p[0]))
  const skullXs = head.map((p) => p[0]).filter((x) => x < x0 + SKULL_COLS)
  const hatMid = mid(widest), apex = mid(top), skull = mid(skullXs)
  return { hatMid, apex, skull, dMid: hatMid - skull, dApex: apex - skull }
}

function table(d: Design) {
  const rows = [...d.idle.map((f, i) => ({ name: `idle ${i + 1}`, c: centring(d, f) })), ...d.tic.map((f, i) => ({ name: `stroke ${i + 1}`, c: centring(d, f) }))]
  return rows
}

const CHANGES = [
  'The reed cone centred on his skull: apex and brim midpoint over the skull’s centre (−0.5 px, half a pixel, the closest a 57 px cone gets to an 18 px skull), the brim overhanging 28 px each side; it rides the head in every frame.',
  'A full far fist, fingers marked, gripping the pole high behind his back: it reads at 1×.',
  'The impact frame throws a real splash of brine: more water, a darker core, bright drops.',
  'Solid lit edges on the cone: two pixels of light all the way down its slope and one unbroken run along the brim.',
]

async function cards() {
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pack = await Promise.all(PACK_PEOPLE.map(async (p) => readPack(p.file)))
  const all = frameBox([...idleFrames(D03_REFINED), ...ticFrames(D03_REFINED), ...idleFrames(D03), ...ticFrames(D03)])
  const box = { x: all.x0 - 1, y: all.y0 - 1, w: all.x1 - all.x0 + 3, h: all.y1 - all.y0 + 3 }
  const cut = (img: Rgba) => crop(img, box.x, box.y, box.w, box.h)
  const cell = async (img: Rgba, s: number) => b64(await png(img, s))
  const S = 4
  // a figure at 4× with its centre lines: gold for the hat's brim midpoint (solid) and apex (dashed), cyan for the skull
  const withLines = async (d: Design, label: string) => {
    const c = centring(d)
    const at = (x: number) => (x - box.x + 0.5) * S
    return `<figure><div class="ov"><img src="${await cell(cut(render(d)), S)}">
      <i class="ln hat" style="left:${at(c.hatMid) - 1}px"></i><i class="ln apex" style="left:${at(c.apex) - 1}px"></i><i class="ln skull" style="left:${at(c.skull) - 1}px"></i></div>
      <figcaption>${label} · hat ${c.dMid >= 0 ? '+' : ''}${c.dMid.toFixed(1)} px off the skull</figcaption></figure>`
  }
  const strip = async (frames: Rgba[]) => (await Promise.all(frames.map(async (f) => `<img src="${await cell(cut(f), 2)}">`))).join('')
  const pack1 = (await Promise.all(pack.map(async (i) => `<img src="${await cell(i, 1)}">`))).join('')
  const pack2 = (await Promise.all(pack.map(async (i) => `<img src="${await cell(i, 2)}">`))).join('')
  const rows = table(D03)
  const fmt = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`
  const html = `<!doctype html><meta charset="utf-8"><style>${CSS(grass)}
    .wrap{padding:12px;width:656px} h1{font-size:21px;margin:0 0 2px} .lead{margin:0 0 8px;color:#c9cbbf;font-size:13.5px}
    ul{margin:0 0 10px 18px;padding:0;color:#d8dacf;font-size:13px} li{margin:1px 0}
    .ba{display:flex;flex-direction:column;align-items:center;gap:6px;border-radius:8px;padding:8px 4px 4px}
    figure{margin:0;display:flex;flex-direction:column;align-items:center} figcaption{font-size:12px;color:#fff;text-shadow:0 1px 0 #161c2e,0 0 3px #161c2e;margin-top:2px}
    .ov{position:relative} .ln{position:absolute;top:0;bottom:0;width:2px;opacity:.85}
    .ln.hat{background:#ffe46b} .ln.apex{background:repeating-linear-gradient(#ffe46b 0 6px,transparent 6px 12px);width:2px;opacity:.6} .ln.skull{background:#5ad8ff;width:2px}
    .key{font-size:12px;color:#c9cbbf;margin:4px 0 0} .key b{display:inline-block;width:14px;height:3px;vertical-align:middle;margin:0 4px 0 10px}
    table{border-collapse:collapse;font-size:12px;color:#d8dacf;margin-top:4px;width:100%} td,th{padding:2px 6px;text-align:right;border-bottom:1px solid #2c3446} th{color:#c9cbbf;font-weight:600} td:first-child,th:first-child{text-align:left}
    .row{display:flex;flex-wrap:wrap;row-gap:8px;align-items:flex-end;gap:4px;padding:8px;border-radius:8px;margin-top:6px} .k{font-size:12px;color:#c9cbbf;margin-top:10px}
    </style><div class="wrap"><h1>Salt-Barge Poleman · hat centred</h1><p class="lead">The designer: “the hat isn’t centered on his head really.” What changed:</p>
    <ul>${CHANGES.map((c) => `<li>${c}</li>`).join('')}</ul>
    <div class="ba grass">${await withLines(D03_REFINED, 'Before · 4×')}${await withLines(D03, 'After · 4×')}</div>
    <div class="key"><b style="background:#ffe46b"></b>hat: brim midpoint (solid), apex (dashed)<b style="background:#5ad8ff"></b>skull centre</div>
    <div class="k">The hat over the skull, every frame (px; + is ahead, toward the snout)</div>
    <table><tr><th>Frame</th><th>Brim mid</th><th>Apex</th><th>Skull</th><th>Brim − skull</th><th>Apex − skull</th></tr>
    ${rows.map((r) => `<tr><td>${r.name}</td><td>${r.c.hatMid.toFixed(1)}</td><td>${r.c.apex.toFixed(1)}</td><td>${r.c.skull.toFixed(1)}</td><td>${fmt(r.c.dMid)}</td><td>${fmt(r.c.dApex)}</td></tr>`).join('')}</table>
    <div class="k">Idle, 6 frames · 2×</div><div class="row grass">${await strip(idleFrames(D03))}</div>
    <div class="k">Tic, the stroke · 2×</div><div class="row grass">${await strip(ticFrames(D03))}</div>
    <div class="k">At game size (1×) and 2×, beside the CC0 pawn, knight, archer and torch goblin</div>
    <div class="row grass">${pack1}<img src="${await cell(cut(render(D03)), 1)}"></div>
    <div class="row grass">${pack2}<img src="${await cell(cut(render(D03)), 2)}"></div></div>`
  await shoot(html, join(OUT, 'd03-final.png'), 680)
  const fr = [...idleFrames(D03), ...ticFrames(D03)]
  const b = frameBox(fr)
  const x = Math.max(0, b.x0 - 2), y = Math.max(0, b.y0 - 2)
  await motion(D03, join(OUT, 'd03-final.webp'), { x, y, w: Math.min(W, b.x1 + 3) - x, h: Math.min(H, b.y1 + 3) - y })
  const mpath = join(OUT, 'manifest.json')
  type Entry = { id: string; group: string; people: string; title: string; caption: string; file: string }
  const manifest: Entry[] = existsSync(mpath) ? JSON.parse(readFileSync(mpath, 'utf8')) : []
  const keep = manifest.filter((m) => !m.id.startsWith('hask-d03-final'))
  keep.push(
    { id: 'hask-d03-final', group: 'Hask designs', people: 'Hask', title: '3. Salt-Barge Poleman · hat centred', caption: 'The cone now sits squarely on his skull: before and after at 4× with centre lines, the offset in every frame, and at 1× beside the pack. Judge: is the hat on his head?', file: 'd03-final.png' },
    { id: 'hask-d03-final-motion', group: 'Hask designs', people: 'Hask', title: '3. Salt-Barge Poleman · hat centred, motion', caption: 'The poling breath twice, then the stroke with its splash, looped. Judge: does the hat ride his head, and does the stroke land?', file: 'd03-final.webp' },
  )
  writeFileSync(mpath, JSON.stringify(keep, null, 2) + '\n')
}

async function main() {
  const cc0 = await cc0Palette()
  const r = report(D03, cc0)
  const before = centring(D03_REFINED)
  console.log(`before (still): brim mid ${before.hatMid} apex ${before.apex} skull ${before.skull} → brim ${before.dMid.toFixed(1)} apex ${before.dApex.toFixed(1)}`)
  for (const row of table(D03)) console.log(`${row.name.padEnd(9)} brim mid ${row.c.hatMid.toFixed(1)} apex ${row.c.apex.toFixed(1)} skull ${row.c.skull.toFixed(1)} → brim ${row.c.dMid.toFixed(1)} apex ${row.c.dApex.toFixed(1)}`)
  const off = table(D03).filter((row) => Math.abs(row.c.dMid) > 0.5 || Math.abs(row.c.dApex) > 0.5)
  if (off.length) throw new Error(`the hat slides off his skull in ${off.map((o) => o.name).join(', ')}`)
  if (r.miss.length || r.off.length || r.clash.length) throw new Error('d03 out of band, off-palette or touching the head')
  if (!process.argv.includes('--measure')) await cards()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
