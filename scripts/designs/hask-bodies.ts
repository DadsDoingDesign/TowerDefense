/**
 * Hask — the bodies pass (the designer: "Body doesn't need to be shared, it
 * should be unique no?"). The top three designs lose the shared bell tunic
 * and get a body each, drawn for a reptile (a heavy tail, a forward lean),
 * for the costume's cut and material, and for the posture:
 *
 *   d03 Salt-Barge Poleman: a short oilcloth smock, a rope belt, bare scaled
 *       arm and legs, a salt-crusted hem; leaning on his pole;
 *   d06 Reed Smuggler: a low-slung cloak of hanging reed with hidden
 *       pockets, over a hunched back; the far arm hidden;
 *   d02 Marsh Trapper: a patched hide vest laced over his belly scales,
 *       patched leggings, the trap's chain from his belt; planted wide.
 *
 * All three stand taller than before (the pack's people read taller), and
 * no back fist sits on the tail. The "before" figures are the committed
 * shared-tunic versions (hask-before-d0*.ts).
 *
 *   npx tsx scripts/designs/hask-bodies.ts               # bands + clearance, and the cards
 *   npx tsx scripts/designs/hask-bodies.ts --preview DIR # the critique line-ups (1×, 3×, 8×)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { idleFrames, render, ticFrames, type Design, type Rgba } from './hask-lib'
import { CSS, PACK, PACK_PEOPLE, b64, cc0Palette, crop, frameBox, motion, png, readPack, report, shoot } from './hask'
import { D02 } from './hask-d02'
import { D03 } from './hask-d03'
import { D06 } from './hask-d06'
import { D02_SHARED } from './hask-before-d02'
import { D03_SHARED } from './hask-before-d03'
import { D06_SHARED } from './hask-before-d06'

const OUT = join(resolve(import.meta.dirname, '..', '..'), 'docs', 'characters', 'cards', 'designs', 'hask')

const PAIRS: { before: Design; after: Design; note: string }[] = [
  { before: D03_SHARED, after: D03, note: 'A short oilcloth smock, a rope belt, a salt-crusted hem, bare scaled arm and legs; the pole set from behind his back into the water ahead.' },
  { before: D06_SHARED, after: D06, note: 'A low-slung cloak of hanging reed over a hunched back, two hidden pockets (salt peeks from one), a fringe at the ground; the far arm hidden.' },
  { before: D02_SHARED, after: D02, note: 'A patched hide vest laced over his belly scales, strapped hide leggings planted wide, the trap’s chain from his belt; his far fist on his hip.' },
]

async function lineups(dir: string) {
  mkdirSync(dir, { recursive: true })
  const tag = process.env.TAG ?? 0
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pack = await Promise.all(PACK_PEOPLE.map(async (p) => readPack(p.file)))
  const all = frameBox(PAIRS.flatMap((p) => [render(p.before), render(p.after)]))
  const cut = (img: Rgba) => crop(img, all.x0 - 1, all.y0 - 1, all.x1 - all.x0 + 3, all.y1 - all.y0 + 3)
  const at = async (imgs: Rgba[], s: number) => (await Promise.all(imgs.map(async (i) => `<img src="${b64(await png(i, s))}">`))).join('')
  const after = PAIRS.map((p) => cut(render(p.after)))
  const before = PAIRS.map((p) => cut(render(p.before)))
  const html = `<!doctype html><style>${CSS(grass)} .row{display:flex;align-items:flex-end;gap:4px;padding:8px;flex-wrap:wrap}</style>
    <div class="grass row">${await at(pack, 3)}${await at(after, 3)}</div>
    <div class="grass row">${await at(pack, 1)}${await at(after, 1)}<span style="width:20px"></span>${await at(before, 1)}</div>
    <div class="grass row">${await at(before, 3)}</div>`
  await shoot(html, join(dir, `bodies-lineup-${tag}.png`), 1400)
  for (const p of PAIRS) {
    const b = frameBox([render(p.after)])
    await sharp(await png(crop(render(p.after), b.x0 - 2, b.y0 - 2, b.x1 - b.x0 + 5, b.y1 - b.y0 + 5), 8)).flatten({ background: '#79a863' }).toFile(join(dir, `${p.after.id}-body-8x-${tag}.png`))
  }
}

async function cards() {
  mkdirSync(OUT, { recursive: true })
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pack = await Promise.all(PACK_PEOPLE.map(async (p) => readPack(p.file)))
  // one shared box over every frame of every figure on the card, so feet share a line
  const all = frameBox(PAIRS.flatMap((p) => [...idleFrames(p.before), ...ticFrames(p.before), ...idleFrames(p.after), ...ticFrames(p.after)]))
  const box = { x: all.x0 - 1, y: all.y0 - 1, w: all.x1 - all.x0 + 3, h: all.y1 - all.y0 + 3 }
  const cut = (img: Rgba) => crop(img, box.x, box.y, box.w, box.h)
  const cell = async (img: Rgba, s: number) => b64(await png(img, s))
  const rows = await Promise.all(
    PAIRS.map(
      async (p) => `<div class="pair"><h2>${p.after.title}</h2><p>${p.note}</p>
      <div class="ba grass"><figure><img src="${await cell(cut(render(p.before)), 4)}"><figcaption>Before · shared tunic</figcaption></figure>
      <figure><img src="${await cell(cut(render(p.after)), 4)}"><figcaption>After · his own body</figcaption></figure></div></div>`,
    ),
  )
  const ones = (await Promise.all(PAIRS.map(async (p) => `<img src="${await cell(cut(render(p.after)), 1)}">`))).join('')
  const twos = (await Promise.all(PAIRS.map(async (p) => `<img src="${await cell(cut(render(p.after)), 2)}">`))).join('')
  const pack1 = (await Promise.all(pack.map(async (i) => `<img src="${await cell(i, 1)}">`))).join('')
  const pack2 = (await Promise.all(pack.map(async (i) => `<img src="${await cell(i, 2)}">`))).join('')
  const html = `<!doctype html><meta charset="utf-8"><style>${CSS(grass)}
    .wrap{padding:12px;width:656px} h1{font-size:21px;margin:0 0 2px} .lead{margin:0 0 10px;color:#c9cbbf;font-size:13.5px}
    h2{font-size:17px;margin:12px 0 0} .pair p{margin:2px 0 6px;color:#c9cbbf;font-size:13px}
    .ba{display:flex;justify-content:space-around;align-items:flex-end;border-radius:8px;padding:8px 4px 4px}
    figure{margin:0;display:flex;flex-direction:column;align-items:center} figcaption{font-size:12px;color:#fff;text-shadow:0 1px 0 #161c2e,0 0 3px #161c2e;margin-top:2px}
    .row{display:flex;flex-wrap:wrap;row-gap:8px;align-items:flex-end;gap:4px;padding:8px;border-radius:8px;margin-top:6px} .k{font-size:12px;color:#c9cbbf;margin-top:10px}
    </style><div class="wrap"><h1>Hask · his own bodies</h1><p class="lead">The top three, before (the shared bell tunic) and after (a body drawn for each: his cut, his cloth, his posture), at 4×. Each now stands taller, and no far fist sits on the tail.</p>
    ${rows.join('')}
    <div class="k">At game size (1×) and 2×, beside the CC0 pawn, knight, archer and torch goblin</div>
    <div class="row grass">${pack1}${ones}</div><div class="row grass">${pack2}${twos}</div></div>`
  await shoot(html, join(OUT, 'bodies.png'), 680)
  for (const p of PAIRS) {
    const fr = [...idleFrames(p.after), ...ticFrames(p.after)]
    const b = frameBox(fr)
    const x = Math.max(0, b.x0 - 2), y = Math.max(0, b.y0 - 2)
    await motion(p.after, join(OUT, `${p.after.id}-body.webp`), { x, y, w: Math.min(100, b.x1 + 3) - x, h: Math.min(100, b.y1 + 3) - y })
  }
  // add (or refresh) the bodies cards in the manifest
  const mpath = join(OUT, 'manifest.json')
  type Entry = { id: string; group: string; people: string; title: string; caption: string; file: string }
  const manifest: Entry[] = existsSync(mpath) ? JSON.parse(readFileSync(mpath, 'utf8')) : []
  const keep = manifest.filter((m) => !m.id.startsWith('hask-bodies') && !m.id.endsWith('-body-motion'))
  keep.push({ id: 'hask-bodies', group: 'Hask designs', people: 'Hask', title: 'Hask · his own bodies', caption: 'The top three before (shared tunic) and after (a body each), at 4×. Judge: does each body say who he is, and does it still fit beside the pack?', file: 'bodies.png' })
  for (const p of PAIRS)
    keep.push({ id: `hask-${p.after.id}-body-motion`, group: 'Hask designs', people: 'Hask', title: `${p.after.title} · new body, motion`, caption: `${p.note} The idle and the tic, looped. Judge: does the body move with weight?`, file: `${p.after.id}-body.webp` })
  writeFileSync(mpath, JSON.stringify(keep, null, 2) + '\n')
}

async function main() {
  const args = process.argv.slice(2)
  const cc0 = await cc0Palette()
  let bad = 0
  for (const p of PAIRS) {
    const r = report(p.after, cc0)
    if (r.miss.length || r.off.length || r.clash.length) bad++
  }
  const pi = args.indexOf('--preview')
  if (pi >= 0) return lineups(args[pi + 1] ?? 'hask-bodies-preview')
  if (bad) throw new Error(`${bad} body(ies) out of band, off-palette or touching the head: no cards`)
  await cards()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
