/**
 * Odile, final pass on the designer's pick, design 04 (the Ford Toll-Keeper):
 * part separation (exploration cards; nothing here is wired into the game).
 *
 *   npx tsx scripts/designs/odile-final.ts               # measure: bands, colours, prop clearance
 *   npx tsx scripts/designs/odile-final.ts --quick DIR   # 8× before → after, frames, 1× / 3× beside the pack
 *   npx tsx scripts/designs/odile-final.ts --cards       # d04-final.png + d04-final.webp
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { idleFrames, render, ticFrames, type Design, type Rgba } from './odile-lib'
import { OUT, ROOT, b64, crop, frameBox, motion, onGrass, png, readPack, report, shoot } from './odile-cards'
import { D04_BODY } from './odile-d04-body'
import { D04_FINAL } from './odile-d04-final'

const BEFORE: Design = D04_BODY
const AFTER: Design = D04_FINAL

const tight = (d: Design, f = render(d)) => {
  const b = frameBox([f])
  return crop(f, b.x, b.y, b.w, b.h)
}

async function quick(dir: string) {
  mkdirSync(dir, { recursive: true })
  const b = frameBox([render(BEFORE), render(AFTER)])
  const cut = (f: Rgba) => crop(f, b.x, b.y, b.w, b.h)
  await sharp(await onGrass([cut(render(BEFORE)), cut(render(AFTER))], 8, 2)).toFile(join(dir, 'final-8x.png'))
  const fr = [...idleFrames(AFTER), ...ticFrames(AFTER)]
  const fb = frameBox(fr)
  await sharp(await onGrass(fr.map((f) => crop(f, fb.x, fb.y, fb.w, fb.h)), 3, 2)).toFile(join(dir, 'final-frames.png'))
  const pack = await Promise.all(['mystic', 'fighter', 'rogue', 'torch1'].map(readPack))
  await sharp(await onGrass([...pack, tight(BEFORE), tight(AFTER)], 3)).toFile(join(dir, 'final-3x.png'))
  await sharp(await onGrass([...pack, tight(BEFORE), tight(AFTER)], 1)).toFile(join(dir, 'final-1x.png'))
}

/** Where a part sits (the middle of its painted cells), in canvas pixels; `at` picks a cell inside it instead. */
function partPoint(d: Design, id: string, at?: readonly [number, number]): [number, number] {
  const p = d.parts.find((q) => q.id === id)
  if (!p) throw new Error(`${d.id}: no part ${id}`)
  if (at) return [p.x + at[0], p.y + at[1]]
  let sx = 0, sy = 0, n = 0
  p.rows.forEach((row, r) => [...row].forEach((ch, c) => ch !== '.' && ((sx += c), (sy += r), n++)))
  return [p.x + sx / n, p.y + sy / n]
}

/** The callout: each part named, a leader line to it, labels down both sides. */
const CALLOUT: readonly { label: string; id: string; at?: readonly [number, number]; side: 'l' | 'r' }[] = [
  { label: 'lotus bud', id: 'lotus', side: 'l' },
  { label: 'lily-pad hat', id: 'pad', at: [12, 4], side: 'l' },
  { label: 'leaf ear', id: 'earL', side: 'l' },
  { label: 'dark plum hair', id: 'hair', at: [8, 4], side: 'l' },
  { label: 'fist', id: 'handB', side: 'l' },
  { label: 'toll satchel', id: 'satchel', side: 'l' },
  { label: 'river cloak', id: 'cloak', at: [12, 20], side: 'l' },
  { label: 'leaf ear', id: 'earR', side: 'r' },
  { label: 'cheek and nose', id: 'cheek', side: 'r' },
  { label: 'brass clasp', id: 'cloak', at: [28, 9], side: 'r' },
  { label: 'rose gown', id: 'cloak', at: [30, 22], side: 'r' },
  { label: 'fist', id: 'handF', side: 'r' },
  { label: 'toll lantern', id: 'lantern', at: [4, 7], side: 'r' },
]

async function cards() {
  mkdirSync(OUT, { recursive: true })
  const grass = b64(await sharp(join(ROOT, 'public', 'assets', 'sprites', 'tinyswords', 'grass.png')).png().toBuffer())
  const b = frameBox([render(BEFORE), render(AFTER)])
  const cut = (f: Rgba) => crop(f, b.x, b.y, b.w, b.h)
  const pack = await Promise.all(['mystic', 'fighter', 'rogue', 'torch1'].map(readPack))
  const ones = [...pack, tight(BEFORE), tight(AFTER)]
  const lineup = await Promise.all(ones.map(async (img) => `<img src="${b64(await png(img, 1))}">`))
  const lineup2 = await Promise.all(ones.map(async (img) => `<img src="${b64(await png(img, 2))}">`))

  // the callout figure at 5×, with labels in two columns and SVG leader lines
  const S = 4
  const fb = frameBox([render(AFTER)])
  const fig = crop(render(AFTER), fb.x, fb.y, fb.w, fb.h)
  const figW = fig.w * S, figH = fig.h * S
  const colW = 150, padY = 10
  const boxW = colW * 2 + figW + 40
  const left = CALLOUT.filter((c) => c.side === 'l')
  const right = CALLOUT.filter((c) => c.side === 'r')
  const rowY = (i: number, n: number) => padY + ((figH - padY * 2) * (i + 0.5)) / n
  const figX = colW + 20
  let svg = ''
  let labels = ''
  for (const [list, side] of [[left, 'l'], [right, 'r']] as const)
    list.forEach((c, i) => {
      const [px, py] = partPoint(AFTER, c.id, c.at)
      const tx = figX + (px - fb.x + 0.5) * S
      const ty = (py - fb.y + 0.5) * S
      const ly = rowY(i, list.length)
      const lx = side === 'l' ? colW + 6 : figX + figW + 14
      svg += `<line x1="${lx}" y1="${ly}" x2="${tx}" y2="${ty}" stroke="#ffe46b" stroke-width="1.5"/><circle cx="${tx}" cy="${ty}" r="3.5" fill="#ffe46b" stroke="#161c2e" stroke-width="1.5"/>`
      labels += `<div class="lab ${side}" style="top:${ly - 9}px;${side === 'l' ? 'left:0;width:' + colW + 'px' : 'left:' + (figX + figW + 18) + 'px;width:' + (colW - 4) + 'px'}">${c.label}</div>`
    })
  const callout = `<div class="call grass" style="width:${boxW}px;height:${figH}px">
      <img style="position:absolute;left:${figX}px;top:0;width:${figW}px" src="${b64(await png(fig, S))}">
      <svg width="${boxW}" height="${figH}" style="position:absolute;left:0;top:0">${svg}</svg>${labels}</div>`

  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#1b2130;font:14px/1.35 system-ui,sans-serif;color:#eef0e6}
    img{image-rendering:pixelated;display:block}
    .grass{background:url(${grass}) repeat;image-rendering:pixelated}
    .wrap{padding:12px;width:640px} h1{font-size:20px;margin:0 0 2px} h2{font-size:16px;margin:12px 0 4px;color:#ffe46b}
    p{margin:2px 0 6px;color:#c9cbbf;font-size:13px}
    .g{display:flex;justify-content:space-around;align-items:flex-end;border-radius:8px;padding:8px 4px 4px}
    figure{margin:0;display:flex;flex-direction:column;align-items:center}
    figcaption{font-size:12px;color:#fff;text-shadow:0 1px 0 #161c2e,0 0 3px #161c2e;margin-top:2px}
    .line{display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px;row-gap:10px;padding:8px;border-radius:8px;margin-top:6px}
    .call{position:relative;border-radius:8px;margin:0 auto}
    .lab{position:absolute;font-size:13px;font-weight:600;color:#fff;text-shadow:0 1px 0 #161c2e,0 0 3px #161c2e,0 0 6px #161c2e}
    .lab.l{text-align:right;padding-right:4px}
    </style><div class="wrap"><h1>Ford Toll-Keeper · the parts pass</h1>
    <p>The designer's pick, with every part made to read on its own: light against dark at every boundary, one ink edge between parts, fewer and bigger shapes.</p>
    <div class="g grass"><figure><img src="${b64(await png(cut(render(BEFORE)), 4))}"><figcaption>before · 4×</figcaption></figure>
    <figure><img src="${b64(await png(cut(render(AFTER)), 4))}"><figcaption>after · 4×</figcaption></figure></div>
    <h2>Every part, named</h2>${callout}
    <h2>At game size, beside the pack</h2><p>CC0 pawn, knight, archer and torch goblin, then before and after: 1×, then 2×.</p>
    <div class="line grass">${lineup.join('')}</div><div class="line grass">${lineup2.join('')}</div></div>`
  await shoot(html, join(OUT, 'd04-final.png'), 664)
  await motion(AFTER, join(OUT, 'd04-final.webp'))
}

async function main() {
  const args = process.argv.slice(2)
  report(BEFORE)
  report(AFTER)
  const qi = args.indexOf('--quick')
  if (qi >= 0) await quick(args[qi + 1] ?? join(ROOT, 'odile-final-quick'))
  if (args.includes('--cards')) await cards()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
