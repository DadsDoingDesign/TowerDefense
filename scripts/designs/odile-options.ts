/**
 * Odile d04, five refinement options (the designer: "Odile is better but also
 * give me 5 options"), beside the current d04-final (exploration cards;
 * nothing here is wired into the game).
 *
 *   npx tsx scripts/designs/odile-options.ts               # measure all six: bands, colours, prop clearance
 *   npx tsx scripts/designs/odile-options.ts --quick DIR   # each at 8×, frames, all six at 3× / 1× beside the pack
 *   npx tsx scripts/designs/odile-options.ts --cards       # d04-options.png + d04-options.webp
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { idleFrames, render, ticFrames, type Design, type Rgba } from './odile-lib'
import { OUT, PACK, ROOT, b64, crop, frameBox, onGrass, png, readPack, report, shoot } from './odile-cards'
import { D04_FINAL } from './odile-d04-final'
import { D04_RA } from './odile-d04-ra'
import { D04_RB } from './odile-d04-rb'
import { D04_RC } from './odile-d04-rc'
import { D04_RD } from './odile-d04-rd'
import { D04_RE } from './odile-d04-re'

/** In card order, each with its one-line label. */
const SIX: readonly (readonly [Design, string])[] = [
  [D04_FINAL, 'the parts pass you have now (d04-final)'],
  [D04_RA, D04_RA.concept],
  [D04_RB, D04_RB.concept],
  [D04_RC, D04_RC.concept],
  [D04_RD, D04_RD.concept],
  [D04_RE, D04_RE.concept],
]

const tight = (d: Design, f = render(d)) => {
  const b = frameBox([f])
  return crop(f, b.x, b.y, b.w, b.h)
}

async function quick(dir: string) {
  mkdirSync(dir, { recursive: true })
  for (const [d] of SIX) {
    await sharp(await onGrass([tight(d)], 8, 2)).toFile(join(dir, `${d.id}-8x.png`))
    const fr = [...idleFrames(d), ...ticFrames(d)]
    const fb = frameBox(fr)
    await sharp(await onGrass(fr.map((f) => crop(f, fb.x, fb.y, fb.w, fb.h)), 3, 2)).toFile(join(dir, `${d.id}-frames.png`))
  }
  const pack = await Promise.all(['mystic', 'fighter', 'rogue', 'torch1'].map(readPack))
  const all = SIX.map(([d]) => tight(d))
  await sharp(await onGrass([...pack, ...all], 3)).toFile(join(dir, 'options-3x.png'))
  await sharp(await onGrass([...pack, ...all], 1)).toFile(join(dir, 'options-1x.png'))
}

async function cards() {
  mkdirSync(OUT, { recursive: true })
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  // one shared box so every figure sits on the same ground line
  const box = frameBox(SIX.flatMap(([d]) => [render(d), ...idleFrames(d), ...ticFrames(d)]))
  const cut = (f: Rgba) => crop(f, box.x, box.y, box.w, box.h)
  const cells = await Promise.all(
    SIX.map(async ([d, label], i) => `<div class="c"><img src="${b64(await png(cut(render(d)), 4))}"><b>${i === 0 ? 'Now' : 'ABCDE'[i - 1]}</b><span>${label.replace(/^[A-E] · /, '')}</span></div>`),
  )
  const pack = await Promise.all(['mystic', 'fighter', 'rogue', 'torch1'].map(readPack))
  const ones = await Promise.all([...pack, ...SIX.map(([d]) => tight(d))].map(async (img) => `<img src="${b64(await png(img, 1))}">`))
  const twos = await Promise.all([...pack, ...SIX.map(([d]) => tight(d))].map(async (img) => `<img src="${b64(await png(img, 2))}">`))
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#1b2130;font:14px/1.35 system-ui,sans-serif;color:#eef0e6}
    img{image-rendering:pixelated;display:block}
    .grass{background:url(${grass}) repeat;image-rendering:pixelated}
    .wrap{padding:14px;width:${box.w * 4 * 3 + 60}px} h1{font-size:22px;margin:0 0 2px} h2{font-size:17px;margin:14px 0 4px;color:#ffe46b}
    p{margin:2px 0 8px;color:#c9cbbf;font-size:14px}
    .g{display:grid;grid-template-columns:repeat(3,1fr);border-radius:8px;overflow:hidden}
    .c{display:flex;flex-direction:column;align-items:center;padding:8px 6px 10px}
    .c b{font-size:20px;color:#ffe46b;text-shadow:0 2px 0 #161c2e,0 0 4px #161c2e;margin-top:-6px}
    .c span{font-size:13px;color:#fff;text-shadow:0 1px 0 #161c2e,0 0 3px #161c2e,0 0 6px #161c2e;text-align:center;max-width:${box.w * 4}px}
    .line{display:flex;flex-wrap:wrap;align-items:flex-end;gap:6px;row-gap:10px;padding:8px;border-radius:8px;margin-top:6px}
    </style><div class="wrap"><h1>Odile · Ford Toll-Keeper · five options</h1>
    <p>The current d04-final and five refinements, each pushing its own way, at 4×. Then all of them at 1× and 2× beside the CC0 pawn, knight, archer and torch goblin.</p>
    <div class="g grass">${cells.join('')}</div>
    <h2>At game size (1×), then 2×</h2>
    <div class="line grass">${ones.join('')}</div><div class="line grass">${twos.join('')}</div></div>`
  await shoot(html, join(OUT, 'd04-options.png'), box.w * 4 * 3 + 88)
  await together(join(OUT, 'd04-options.webp'), box)
}

/** All six animating side by side for 3 s at 3×, each on its own clock: two idles, the tic, then idle to fill. */
async function together(path: string, box: { x: number; y: number; w: number; h: number }) {
  const S = 3, pad = 6, STEP = 20
  const cw = (box.w * S + pad) * SIX.length + pad, ch = box.h * S + pad * 2
  const grass = await sharp(join(PACK, 'grass.png')).resize(96, 96, { kernel: 'nearest' }).png().toBuffer()
  const bg = await sharp({ create: { width: cw, height: ch, channels: 4, background: '#79a863' } }).composite([{ input: grass, tile: true, left: 0, top: 0 }]).png().toBuffer()
  // each figure's timeline, sampled every STEP ms
  const timelines = SIX.map(([d], k) => {
    const idle = idleFrames(d)
    const tic = ticFrames(d)
    const seq: { img: Rgba; ms: number }[] = []
    idle.forEach((img, i) => seq.push({ img, ms: d.idleMs[i] }))
    idle.forEach((img, i) => seq.push({ img, ms: d.idleMs[i] }))
    tic.forEach((img, i) => seq.push({ img, ms: d.ticMs[i] }))
    for (let j = 0, t = seq.reduce((a, s) => a + s.ms, 0); t < 3000; j++) {
      seq.push({ img: idle[j % idle.length], ms: d.idleMs[j % idle.length] })
      t += d.idleMs[j % idle.length]
    }
    // desync: each figure starts its loop a little later than the last (the crowd never breathes in sync)
    const offset = k * 140
    return (t: number) => {
      let u = (t + offset) % 3000
      for (const s of seq) {
        if (u < s.ms) return s.img
        u -= s.ms
      }
      return seq[seq.length - 1].img
    }
  })
  const frames: Buffer[] = []
  const delays: number[] = []
  let shown: Rgba[] | null = null
  for (let t = 0; t < 3000; t += STEP) {
    const imgs = timelines.map((tl) => tl(t))
    // a new page only when some figure's frame changes
    if (shown && imgs.every((img, k) => img === shown![k])) {
      delays[delays.length - 1] += STEP
      continue
    }
    shown = imgs
    const comp = await Promise.all(imgs.map(async (img, k) => ({ input: await png(crop(img, box.x, box.y, box.w, box.h), S), left: pad + k * (box.w * S + pad), top: pad })))
    frames.push(await sharp(bg).composite(comp).raw().toBuffer())
    delays.push(STEP)
  }
  await sharp(Buffer.concat(frames), { raw: { width: cw, height: ch * frames.length, channels: 4, pageHeight: ch } })
    .webp({ lossless: true, loop: 0, delay: delays })
    .toFile(path)
}

async function main() {
  const args = process.argv.slice(2)
  for (const [d] of SIX) report(d)
  const qi = args.indexOf('--quick')
  if (qi >= 0) await quick(args[qi + 1] ?? join(ROOT, 'odile-options-quick'))
  if (args.includes('--cards')) await cards()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
