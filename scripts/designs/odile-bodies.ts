/**
 * Odile's top three with bodies of their own (the designer: "Body doesn't need
 * to be shared, it should be unique"): each design's head, hands and prop on a
 * body drawn for her costume (exploration cards; nothing here is wired into the game).
 *
 *   npx tsx scripts/designs/odile-bodies.ts               # measure: the bands, the colours, prop clearance
 *   npx tsx scripts/designs/odile-bodies.ts --quick DIR   # 8× stills, before → after, 1× / 3× line-ups (critique rounds)
 *   npx tsx scripts/designs/odile-bodies.ts --cards       # bodies.png + d04-body / d01-body / d08-body .webp
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { idleFrames, render, ticFrames, type Design, type Rgba } from './odile-lib'
import { OUT, PACK, ROOT, b64, crop, frameBox, motion, onGrass, png, readPack, report, shoot } from './odile-cards'
import { D01 } from './odile-d01'
import { D04 } from './odile-d04'
import { D08 } from './odile-d08'
import { D01_BODY } from './odile-d01-body'
import { D04_BODY } from './odile-d04-body'
import { D08_BODY } from './odile-d08-body'

/** In card order: [before, after, file stem]. */
const PAIRS: readonly (readonly [Design, Design, string])[] = [
  [D04, D04_BODY, 'd04-body'],
  [D01, D01_BODY, 'd01-body'],
  [D08, D08_BODY, 'd08-body'],
]

async function quick(dir: string) {
  mkdirSync(dir, { recursive: true })
  const pack = await Promise.all(['mystic', 'fighter', 'rogue', 'torch1'].map(readPack))
  for (const [before, after] of PAIRS) {
    const b = frameBox([render(before), render(after)])
    const cut = (f: Rgba) => crop(f, b.x, b.y, b.w, b.h)
    await sharp(await onGrass([cut(render(before)), cut(render(after))], 8, 2)).toFile(join(dir, `${after.id}-8x.png`))
    const fr = [...idleFrames(after), ...ticFrames(after)]
    const fb = frameBox(fr)
    await sharp(await onGrass(fr.map((f) => crop(f, fb.x, fb.y, fb.w, fb.h)), 3, 2)).toFile(join(dir, `${after.id}-frames.png`))
  }
  const all = frameBox(PAIRS.map(([, a]) => render(a)))
  const figs = PAIRS.map(([, a]) => crop(render(a), all.x, all.y, all.w, all.h))
  await sharp(await onGrass([...pack, ...figs], 3)).toFile(join(dir, 'bodies-3x.png'))
  await sharp(await onGrass([...pack, ...figs], 1)).toFile(join(dir, 'bodies-1x.png'))
}

async function cards() {
  mkdirSync(OUT, { recursive: true })
  const grass = b64(await sharp(join(PACK, 'grass.png')).png().toBuffer())
  const pawn = await readPack('mystic')
  const rows: string[] = []
  for (const [before, after] of PAIRS) {
    const b = frameBox([render(before), render(after)])
    const cut = (f: Rgba) => crop(f, b.x, b.y, b.w, b.h)
    rows.push(`<div class="r"><h2>${after.title}</h2><p>${after.concept}</p>
      <div class="g grass"><figure><img src="${b64(await png(cut(render(before)), 4))}"><figcaption>before · the shared gown</figcaption></figure>
      <figure><img src="${b64(await png(cut(render(after)), 4))}"><figcaption>after · her own body</figcaption></figure></div></div>`)
  }
  const tight = (d: Design) => {
    const b = frameBox([render(d)])
    return crop(render(d), b.x, b.y, b.w, b.h)
  }
  const ones = await Promise.all(PAIRS.map(async ([, a]) => `<img src="${b64(await png(tight(a), 1))}">`))
  const twos = await Promise.all(PAIRS.map(async ([, a]) => `<img src="${b64(await png(tight(a), 2))}">`))
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#1b2130;font:14px/1.35 system-ui,sans-serif;color:#eef0e6}
    img{image-rendering:pixelated;display:block}
    .grass{background:url(${grass}) repeat;image-rendering:pixelated}
    .wrap{padding:12px;width:640px} h1{font-size:20px;margin:0 0 2px} h2{font-size:17px;margin:12px 0 0;color:#ffe46b}
    p{margin:2px 0 6px;color:#c9cbbf;font-size:13px}
    .g{display:flex;justify-content:space-around;align-items:flex-end;border-radius:8px;padding:8px 4px 4px}
    figure{margin:0;display:flex;flex-direction:column;align-items:center}
    figcaption{font-size:12px;color:#fff;text-shadow:0 1px 0 #161c2e,0 0 3px #161c2e;margin-top:2px}
    .line{display:flex;align-items:flex-end;gap:6px;padding:8px;border-radius:8px;margin-top:6px}
    </style><div class="wrap"><h1>Odile · her own body</h1><p>The top three, the shared gown out: each now wears a body cut for her costume. 4×, before and after; then 1× and 2× beside the CC0 pawn. Every prop is checked clear of the head in every frame.</p>
    ${rows.join('')}
    <h2>At game size</h2><div class="line grass"><img src="${b64(await png(pawn, 1))}">${ones.join('')}</div>
    <div class="line grass"><img src="${b64(await png(pawn, 2))}">${twos.join('')}</div></div>`
  await shoot(html, join(OUT, 'bodies.png'), 664)
  for (const [, after, stem] of PAIRS) await motion(after, join(OUT, `${stem}.webp`))
}

async function main() {
  const args = process.argv.slice(2)
  for (const [before, after] of PAIRS) {
    report(before)
    report(after)
  }
  const qi = args.indexOf('--quick')
  if (qi >= 0) await quick(args[qi + 1] ?? join(ROOT, 'odile-bodies-quick'))
  if (args.includes('--cards')) await cards()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
