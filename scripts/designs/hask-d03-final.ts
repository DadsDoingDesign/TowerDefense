/**
 * Hask d03, the Salt-Barge Poleman: the designer's pick ("hask 1 is my
 * favorite but also still needs refinement"), refined. This script renders the
 * refinement card: the body version (hask-before-d03-body.ts) beside the
 * refined one (hask-d03.ts) at 4×, the refined idle and stroke at 2×, and a 1×
 * line-up beside the pack; and the refined motion loop.
 *
 *   npx tsx scripts/designs/hask-d03-final.ts   # bands + clearance, then d03-final.png / d03-final.webp
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { idleFrames, render, ticFrames, type Rgba } from './hask-lib'
import { CSS, PACK, PACK_PEOPLE, b64, cc0Palette, crop, frameBox, motion, png, readPack, report, shoot } from './hask'
import { D03 } from './hask-d03'
import { D03_BODY } from './hask-before-d03-body'

const OUT = join(resolve(import.meta.dirname, '..', '..'), 'docs', 'characters', 'cards', 'designs', 'hask')

const CHANGES = [
  'The smock leans into the stroke: his shoulders sit five pixels ahead of the hem.',
  'Both fists on the pole: the far one high behind his back, the near arm one piece down to the grip.',
  'Value steps between parts: the snout in the brim’s shadow, the collar a tone darker, the leg tops in the hem’s shade.',
  'The cone woven in curved courses across its ribs, lit along its slope and rolled brim.',
  'Scales as paired light and dark dashes on the arm and the striding legs; a crystalline salt crust and stains on the hem.',
  'Idle: the poling breath (he leans in and settles, the pole follows). Tic: a full stroke, the hit on the third frame, with a splash.',
]

async function main() {
  const cc0 = await cc0Palette()
  const r = report(D03, cc0)
  if (r.miss.length || r.off.length || r.clash.length) throw new Error('d03 out of band, off-palette or touching the head')
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pack = await Promise.all(PACK_PEOPLE.map(async (p) => readPack(p.file)))
  const all = frameBox([...idleFrames(D03_BODY), ...ticFrames(D03_BODY), ...idleFrames(D03), ...ticFrames(D03)])
  const box = { x: all.x0 - 1, y: all.y0 - 1, w: all.x1 - all.x0 + 3, h: all.y1 - all.y0 + 3 }
  const cut = (img: Rgba) => crop(img, box.x, box.y, box.w, box.h)
  const cell = async (img: Rgba, s: number) => b64(await png(img, s))
  const strip = async (frames: Rgba[]) => (await Promise.all(frames.map(async (f) => `<img src="${await cell(cut(f), 2)}">`))).join('')
  const pack1 = (await Promise.all(pack.map(async (i) => `<img src="${await cell(i, 1)}">`))).join('')
  const pack2 = (await Promise.all(pack.map(async (i) => `<img src="${await cell(i, 2)}">`))).join('')
  const html = `<!doctype html><meta charset="utf-8"><style>${CSS(grass)}
    .wrap{padding:12px;width:656px} h1{font-size:21px;margin:0 0 2px} .lead{margin:0 0 8px;color:#c9cbbf;font-size:13.5px}
    ul{margin:0 0 10px 18px;padding:0;color:#d8dacf;font-size:13px} li{margin:1px 0}
    .ba{display:flex;justify-content:space-around;align-items:flex-end;border-radius:8px;padding:8px 4px 4px}
    figure{margin:0;display:flex;flex-direction:column;align-items:center} figcaption{font-size:12px;color:#fff;text-shadow:0 1px 0 #161c2e,0 0 3px #161c2e;margin-top:2px}
    .row{display:flex;flex-wrap:wrap;row-gap:8px;align-items:flex-end;gap:4px;padding:8px;border-radius:8px;margin-top:6px} .k{font-size:12px;color:#c9cbbf;margin-top:10px}
    </style><div class="wrap"><h1>Salt-Barge Poleman · refined</h1><p class="lead">The designer’s pick, refined. What changed:</p>
    <ul>${CHANGES.map((c) => `<li>${c}</li>`).join('')}</ul>
    <div class="ba grass"><figure><img src="${await cell(cut(render(D03_BODY)), 4)}"><figcaption>Before · 4×</figcaption></figure>
    <figure><img src="${await cell(cut(render(D03)), 4)}"><figcaption>Refined · 4×</figcaption></figure></div>
    <div class="k">Refined idle, 6 frames · 2×</div><div class="row grass">${await strip(idleFrames(D03))}</div>
    <div class="k">Refined tic, the stroke · 2×</div><div class="row grass">${await strip(ticFrames(D03))}</div>
    <div class="k">At game size (1×) and 2×, beside the CC0 pawn, knight, archer and torch goblin</div>
    <div class="row grass">${pack1}<img src="${await cell(cut(render(D03)), 1)}"></div>
    <div class="row grass">${pack2}<img src="${await cell(cut(render(D03)), 2)}"></div></div>`
  await shoot(html, join(OUT, 'd03-final.png'), 680)
  const fr = [...idleFrames(D03), ...ticFrames(D03)]
  const b = frameBox(fr)
  const x = Math.max(0, b.x0 - 2), y = Math.max(0, b.y0 - 2)
  await motion(D03, join(OUT, 'd03-final.webp'), { x, y, w: Math.min(100, b.x1 + 3) - x, h: Math.min(100, b.y1 + 3) - y })
  const mpath = join(OUT, 'manifest.json')
  type Entry = { id: string; group: string; people: string; title: string; caption: string; file: string }
  const manifest: Entry[] = existsSync(mpath) ? JSON.parse(readFileSync(mpath, 'utf8')) : []
  const keep = manifest.filter((m) => !m.id.startsWith('hask-d03-final'))
  keep.push(
    { id: 'hask-d03-final', group: 'Hask designs', people: 'Hask', title: '3. Salt-Barge Poleman · refined', caption: 'The pick, refined: before and after at 4×, the idle and the stroke, and at 1× beside the pack. Judge: is he ready to ship as Hask?', file: 'd03-final.png' },
    { id: 'hask-d03-final-motion', group: 'Hask designs', people: 'Hask', title: '3. Salt-Barge Poleman · refined, motion', caption: 'The poling breath twice, then the stroke with its splash, looped. Judge: does it move with weight, and does the stroke land?', file: 'd03-final.webp' },
  )
  writeFileSync(mpath, JSON.stringify(keep, null, 2) + '\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
