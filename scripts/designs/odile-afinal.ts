/**
 * Odile d04-A-final: option A with the lotus sat on the pad (the designer: "I
 * like A, but the flower should be centered on the lily not floating above").
 * Exploration cards; nothing here is wired into the game.
 *
 *   npx tsx scripts/designs/odile-afinal.ts               # measure A and A-final, and the bud-on-pad table, frame by frame
 *   npx tsx scripts/designs/odile-afinal.ts --quick DIR   # 8× A → A-final, frames, 1× / 3× beside the pack
 *   npx tsx scripts/designs/odile-afinal.ts --cards       # d04-A-final.png + d04-A-final.webp
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { INK, W, idleFrames, render, ticFrames, type Design, type Frame, type Rgba } from './odile-lib'
import { OUT, PACK, ROOT, b64, crop, frameBox, motion, onGrass, png, readPack, report, shoot } from './odile-cards'
import { D04_RA } from './odile-d04-ra'
import { D04_A_FINAL } from './odile-d04-a-final'

const BEFORE: Design = D04_RA
const AFTER: Design = D04_A_FINAL

/** The painted (non-ink) pixels of one part in one frame. */
function painted(d: Design, f: Frame, id: string): [number, number][] {
  const img = render(d, f, undefined, [id])
  const ink = [1, 3, 5].map((i) => parseInt(INK.slice(i, i + 2), 16))
  const out: [number, number][] = []
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < 200) continue
    if (img.data[i] === ink[0] && img.data[i + 1] === ink[1] && img.data[i + 2] === ink[2]) continue
    out.push([(i / 4) % W, Math.floor(i / 4 / W)])
  }
  return out
}

/**
 * Where the bud sits on the pad in one frame: the horizontal offset of the bud's centre from the centre of
 * the pad's top face (the ellipse's mid-span, not the box), and the vertical gap from the bud's lowest row
 * to the pad's top surface under it (negative: the base is sunk into the leaf by that many px).
 */
export function budOnPad(d: Design, f: Frame) {
  const pad = painted(d, f, 'pad')
  const bud = painted(d, f, 'lotus')
  const mid = (pts: [number, number][]) => (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0])) + 1) / 2
  const padMid = mid(pad)
  const budMid = mid(bud)
  const budBottom = Math.max(...bud.map((p) => p[1]))
  const col = Math.floor(budMid)
  const under = pad.filter((p) => p[0] === col || p[0] === col - 1).map((p) => p[1])
  const padTop = Math.min(...under)
  return { offset: budMid - padMid, gap: padTop - (budBottom + 1), padMid, budMid, padTop }
}

function table(d: Design) {
  const frames: [string, Frame][] = [['still', {}], ...d.idle.map((f, i): [string, Frame] => [`idle ${i + 1}`, f]), ...d.tic.map((f, i): [string, Frame] => [`tic ${i + 1}`, f])]
  console.log(`  ${d.id}: bud on pad, frame by frame (offset = bud centre - pad-top centre, px; gap = pad top - bud base, px, negative = sunk in)`)
  let worstOff = 0, worstGap = -Infinity
  for (const [name, f] of frames) {
    const m = budOnPad(d, f)
    worstOff = Math.max(worstOff, Math.abs(m.offset))
    worstGap = Math.max(worstGap, m.gap)
    console.log(`    ${name.padEnd(8)} offset ${m.offset.toFixed(1).padStart(5)}  gap ${String(m.gap).padStart(3)}  (pad-top centre x ${m.padMid}, bud centre x ${m.budMid}, pad top y ${m.padTop})`)
  }
  console.log(`    worst: |offset| ${worstOff.toFixed(1)} px, gap ${worstGap} px  ${worstOff <= 0.5 && worstGap <= 0 ? 'ok' : 'MISS'}`)
}

const tight = (d: Design, f = render(d)) => {
  const b = frameBox([f])
  return crop(f, b.x, b.y, b.w, b.h)
}

async function quick(dir: string) {
  mkdirSync(dir, { recursive: true })
  const b = frameBox([render(BEFORE), render(AFTER)])
  const cut = (f: Rgba) => crop(f, b.x, b.y, b.w, b.h)
  await sharp(await onGrass([cut(render(BEFORE)), cut(render(AFTER))], 8, 2)).toFile(join(dir, 'afinal-8x.png'))
  const fr = [...idleFrames(AFTER), ...ticFrames(AFTER)]
  const fb = frameBox(fr)
  await sharp(await onGrass(fr.map((f) => crop(f, fb.x, fb.y, fb.w, fb.h)), 4, 2)).toFile(join(dir, 'afinal-frames.png'))
  const pack = await Promise.all(['mystic', 'fighter', 'rogue', 'torch1'].map(readPack))
  await sharp(await onGrass([...pack, tight(BEFORE), tight(AFTER)], 3)).toFile(join(dir, 'afinal-3x.png'))
  await sharp(await onGrass([...pack, tight(BEFORE), tight(AFTER)], 1)).toFile(join(dir, 'afinal-1x.png'))
}

/** The parts named on the callout, with where each one's leader points (canvas px). */
function partPoint(d: Design, id: string, at?: readonly [number, number]): [number, number] {
  const p = d.parts.find((q) => q.id === id)
  if (!p) throw new Error(`${d.id}: no part ${id}`)
  if (at) return [p.x + at[0], p.y + at[1]]
  let sx = 0, sy = 0, n = 0
  p.rows.forEach((row, r) => [...row].forEach((ch, c) => ch !== '.' && ((sx += c), (sy += r), n++)))
  return [p.x + sx / n, p.y + sy / n]
}
const CALLOUT: readonly { label: string; id: string; at?: readonly [number, number]; side: 'l' | 'r' }[] = [
  { label: 'lotus bud, on the pad', id: 'lotus', side: 'l' },
  { label: 'lily-pad hat', id: 'pad', at: [10, 4], side: 'l' },
  { label: 'leaf ear', id: 'earL', side: 'l' },
  { label: 'dark plum hair', id: 'hair', at: [8, 4], side: 'l' },
  { label: 'fist', id: 'handB', side: 'l' },
  { label: 'toll satchel', id: 'satchel', side: 'l' },
  { label: 'river cloak', id: 'cloak', at: [12, 16], side: 'l' },
  { label: 'boots', id: 'boots', at: [3, 2], side: 'l' },
  { label: 'leaf ear', id: 'earR', side: 'r' },
  { label: 'face and nose', id: 'face', side: 'r' },
  { label: 'brass clasp', id: 'cloak', at: [28, 9], side: 'r' },
  { label: 'rose gown', id: 'cloak', at: [30, 20], side: 'r' },
  { label: 'fist', id: 'handF', side: 'r' },
  { label: 'toll lantern', id: 'lantern', at: [4, 7], side: 'r' },
]

async function cards() {
  mkdirSync(OUT, { recursive: true })
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const S = 4
  const b = frameBox([render(BEFORE), render(AFTER)])
  const cut = (f: Rgba) => crop(f, b.x, b.y, b.w, b.h)
  const fw = b.w * S, fh = b.h * S
  // the centre-line overlay: the pad-top centre (gold) and the bud's centre (white, dashed), and the pad's top surface
  const overlay = (d: Design) => {
    const m = budOnPad(d, {})
    const px = (m.padMid - b.x) * S, bx = (m.budMid - b.x) * S, ty = (m.padTop - b.y) * S
    return `<svg width="${fw}" height="${fh}" style="position:absolute;left:0;top:0">
      <line x1="${px}" y1="0" x2="${px}" y2="${fh * 0.62}" stroke="#ffe46b" stroke-width="2"/>
      <line x1="${bx}" y1="0" x2="${bx}" y2="${fh * 0.62}" stroke="#ffffff" stroke-width="2" stroke-dasharray="5 4"/>
      <line x1="${px - 70}" y1="${ty}" x2="${px + 70}" y2="${ty}" stroke="#ffe46b" stroke-width="1.5"/></svg>`
  }
  const pair = async (d: Design, cap: string) => {
    const m = budOnPad(d, {})
    return `<figure><div style="position:relative;width:${fw}px;height:${fh}px"><img src="${b64(await png(cut(render(d)), S))}">${overlay(d)}</div>
      <figcaption>${cap}<br><small>bud ${m.offset >= 0 ? '+' : ''}${m.offset.toFixed(1)} px off the pad's centre · ${m.gap > 0 ? m.gap + ' px gap' : m.gap === 0 ? 'touching' : 'sunk ' + -m.gap + ' px'}</small></figcaption></figure>`
  }

  const fb = frameBox([render(AFTER)])
  const fig = crop(render(AFTER), fb.x, fb.y, fb.w, fb.h)
  const figW = fig.w * S, figH = fig.h * S
  const colW = 150, figX = colW + 20, boxW = colW * 2 + figW + 40
  const left = CALLOUT.filter((c) => c.side === 'l'), right = CALLOUT.filter((c) => c.side === 'r')
  const rowY = (i: number, n: number) => 10 + ((figH - 20) * (i + 0.5)) / n
  let svg = '', labels = ''
  for (const [list, side] of [[left, 'l'], [right, 'r']] as const)
    list.forEach((c, i) => {
      const [x, y] = partPoint(AFTER, c.id, c.at)
      const tx = figX + (x - fb.x + 0.5) * S, ty = (y - fb.y + 0.5) * S, ly = rowY(i, list.length)
      const lx = side === 'l' ? colW + 6 : figX + figW + 14
      svg += `<line x1="${lx}" y1="${ly}" x2="${tx}" y2="${ty}" stroke="#ffe46b" stroke-width="1.5"/><circle cx="${tx}" cy="${ty}" r="3.5" fill="#ffe46b" stroke="#161c2e" stroke-width="1.5"/>`
      labels += `<div class="lab ${side}" style="top:${ly - 9}px;${side === 'l' ? 'left:0;width:' + colW + 'px' : 'left:' + (figX + figW + 18) + 'px;width:' + (colW - 4) + 'px'}">${c.label}</div>`
    })

  const pack = await Promise.all(['mystic', 'fighter', 'rogue', 'torch1'].map(readPack))
  const ones = await Promise.all([...pack, tight(BEFORE), tight(AFTER)].map(async (img) => `<img src="${b64(await png(img, 1))}">`))
  const twos = await Promise.all([...pack, tight(BEFORE), tight(AFTER)].map(async (img) => `<img src="${b64(await png(img, 2))}">`))
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#1b2130;font:14px/1.35 system-ui,sans-serif;color:#eef0e6}
    img{image-rendering:pixelated;display:block}
    .grass{background:url(${grass}) repeat;image-rendering:pixelated}
    .wrap{padding:12px;width:640px} h1{font-size:20px;margin:0 0 2px} h2{font-size:16px;margin:12px 0 4px;color:#ffe46b}
    p{margin:2px 0 6px;color:#c9cbbf;font-size:13px}
    .g{display:flex;justify-content:space-around;align-items:flex-end;border-radius:8px;padding:8px 4px 4px}
    figure{margin:0;display:flex;flex-direction:column;align-items:center}
    figcaption{font-size:12px;color:#fff;text-shadow:0 1px 0 #161c2e,0 0 3px #161c2e;margin-top:2px;text-align:center}
    small{font-size:11px;color:#ffe46b}
    .line{display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px;row-gap:10px;padding:8px;border-radius:8px;margin-top:6px}
    .call{position:relative;border-radius:8px;margin:0 auto}
    .lab{position:absolute;font-size:13px;font-weight:600;color:#fff;text-shadow:0 1px 0 #161c2e,0 0 3px #161c2e,0 0 6px #161c2e}
    .lab.l{text-align:right;padding-right:4px}
    </style><div class="wrap"><h1>Ford Toll-Keeper · A, final</h1>
    <p>The designer's pick, option A, with the lotus sat on the lily pad: centred on the leaf's top face and grown from it, riding it in every frame. Gold line: the pad top's centre and surface; white dashes: the bud's centre.</p>
    <div class="g grass">${await pair(BEFORE, 'A · before')}${await pair(AFTER, 'A-final · after')}</div>
    <h2>Every part, named</h2><div class="call grass" style="width:${boxW}px;height:${figH}px">
      <img style="position:absolute;left:${figX}px;top:0;width:${figW}px" src="${b64(await png(fig, S))}">
      <svg width="${boxW}" height="${figH}" style="position:absolute;left:0;top:0">${svg}</svg>${labels}</div>
    <h2>At game size, beside the pack</h2><p>CC0 pawn, knight, archer and torch goblin, then A and A-final: 1×, then 2×.</p>
    <div class="line grass">${ones.join('')}</div><div class="line grass">${twos.join('')}</div></div>`
  await shoot(html, join(OUT, 'd04-A-final.png'), 664)
  await motion(AFTER, join(OUT, 'd04-A-final.webp'))
}

async function main() {
  const args = process.argv.slice(2)
  report(BEFORE)
  report(AFTER)
  table(BEFORE)
  table(AFTER)
  const qi = args.indexOf('--quick')
  if (qi >= 0) await quick(args[qi + 1] ?? join(ROOT, 'odile-afinal-quick'))
  if (args.includes('--cards')) await cards()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
