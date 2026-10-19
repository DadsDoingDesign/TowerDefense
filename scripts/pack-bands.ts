/**
 * Measure the CC0 pack's people against `render/hero/packBands.ts` and render
 * the designer's card `docs/characters/cards/pack-direction/measure.png`.
 *
 *   npx tsx scripts/pack-bands.ts            # print the table
 *   npx tsx scripts/pack-bands.ts --card     # also render the card (Playwright)
 *
 * Reads only the old-CC0 stills already shipped in `sprites/tinyswords/`
 * (fighter = Warrior, rogue = Archer, mystic = Pawn, torch1 / tnt1 / barrel1 =
 * the red goblins; see `sprites/CREDITS.md`).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { PACK_BANDS, checkBands, measureFigure, type FigureMeasure } from '../src/game/render/hero/packBands'

const ROOT = resolve(import.meta.dirname, '..')
const PACK = join(ROOT, 'public', 'assets', 'sprites', 'tinyswords')
const OUT = join(ROOT, 'docs', 'characters', 'cards', 'pack-direction')

/** The pack's people, and the row (in the still) where each one's head mass ends. */
export const PACK_PEOPLE = [
  { file: 'mystic', name: 'Pawn', head: 'hair mop', headBottom: 37 },
  { file: 'fighter', name: 'Knight', head: 'helmet + plume', headBottom: 65 },
  { file: 'rogue', name: 'Archer', head: 'hood', headBottom: 46 },
  { file: 'torch1', name: 'Torch goblin', head: 'hood + ears', headBottom: 48 },
  { file: 'tnt1', name: 'TNT goblin', head: 'head + ears', headBottom: 42 },
  { file: 'barrel1', name: 'Barrel goblin', head: 'a keg', headBottom: undefined },
] as { file: string; name: string; head: string; headBottom?: number }[]

async function read(file: string) {
  const { data, info } = await sharp(join(PACK, `${file}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { w: info.width, h: info.height, data }
}

const f2 = (v: number) => v.toFixed(2)

async function main() {
  const rows: { p: { file: string; name: string; head: string; headBottom?: number }; m: FigureMeasure; png: string; ih: number }[] = []
  for (const p of PACK_PEOPLE) {
    const img = await read(p.file)
    const m = measureFigure(img, { headBottom: p.headBottom })
    const png = (await sharp(join(PACK, `${p.file}.png`)).png().toBuffer()).toString('base64')
    rows.push({ p, m, png, ih: img.h })
    const miss = checkBands(m)
    console.log(
      [p.name.padEnd(14), `${m.box.w}x${m.box.h}`.padEnd(7), 'fill', f2(m.fill), 'aspect', f2(m.aspect), 'top', f2(m.topMass), 'legs', f2(m.legShare), 'head', f2(m.headShare ?? 0), 'outline', m.outline, `d${m.outlineDist.toFixed(0)}`, 'inked', f2(m.inkedEdge), `${m.outlinePx.toFixed(2)}px`, 'colours', m.colours, miss.length ? 'MISS ' + miss.map((x) => x.key).join(',') : 'ok'].join(' '),
    )
  }
  if (process.argv.includes('--card')) await card(rows)
}

async function card(rows: { p: { file: string; name: string; head: string; headBottom?: number }; m: FigureMeasure; png: string; ih: number }[]) {
  const b = PACK_BANDS
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const fig = rows
    .map(
      ({ p, m, png, ih }) => `<div class="f"><div class="art"><img src="data:image/png;base64,${png}" style="width:${m.box.w * 2}px" />
      ${p.headBottom === undefined ? '' : `<i class="hb" style="top:${200 - ih * 2 + p.headBottom * 2}px"></i>`}</div>
      <b>${p.name}</b><span>${m.box.w}×${m.box.h} · ${m.headShare === undefined ? p.head : `head ${pct(m.headShare)}`}</span><span>fill ${pct(m.fill)} · legs ${pct(m.legShare)}</span></div>`,
    )
    .join('')
  const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;width:600px;background:#1b2130;font:14px/1.35 system-ui,sans-serif;color:#eef0e6}
  .wrap{padding:16px}
  h1{font-size:19px;margin:0 0 4px}
  p.k{margin:0 0 12px;color:#c9cbbf;font-size:13px}
  .grass{background:#6fa84d url(data:image/png;base64,GRASS) repeat;background-size:64px;border-radius:6px;padding:12px 6px 8px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px 4px;image-rendering:pixelated}
  .f{display:flex;flex-direction:column;align-items:center;text-align:center}
  .art{position:relative;height:200px;display:flex;align-items:flex-end}
  .art img{image-rendering:pixelated}
  .hb{position:absolute;left:-6px;right:-6px;border-top:2px dashed #ffe46b;bottom:auto}
  .f b{font-size:13px;color:#fff;text-shadow:0 1px 0 #000;margin-top:4px}
  .f span{font-size:11.5px;color:#fff;text-shadow:0 1px 0 #000}
  ul{margin:12px 0 0;padding:0 0 0 18px}
  li{margin:0 0 5px}
  li b{color:#ffe46b}
  .note{font-size:12px;color:#aab;margin-top:8px}
  </style><div class="wrap"><h1>The pack's people, measured</h1>
  <p class="k">The CC0 Tiny Swords figures at 2×. Yellow dash: where the head (hair, helmet, hood) ends.</p>
  <div class="grass">${fig}</div>
  <ul>
  <li><b>Size:</b> ${b.height.min}–${b.height.max} px tall at 1×; about as wide as tall (width ÷ height ${b.aspect.min}–${b.aspect.max}).</li>
  <li><b>Head:</b> ${pct(b.headShare.min)}–${pct(b.headShare.max)} of the height, and the widest thing. No neck.</li>
  <li><b>Mass:</b> a solid blob: ${pct(b.fill.min)}–${pct(b.fill.max)} of its box is figure. The head flares widest at its bottom edge, so the mass sits low (${pct(b.topMass.min)}–${pct(b.topMass.max)} in the top half).</li>
  <li><b>Legs:</b> nubs. The narrow part at the bottom is at most ${pct(b.legShare.max)} of the height. Arms are stubs or round fists.</li>
  <li><b>Outline:</b> one navy ink (#161c2e), 2 px on straights, 3 on curves (${b.outlinePx.min}–${b.outlinePx.max} deep on average), closed on at least ${pct(b.inkedEdge.min)} of the edge.</li>
  <li><b>Colour:</b> ${b.colours.min}–${b.colours.max} main colours; three tones a material, lit from the upper left, plus a small white dash.</li>
  <li><b>Moving:</b> the idle squashes and bobs the whole mass (6 frames); nothing swings on its own.</li>
  </ul><p class="note">Checked by src/game/render/hero/packBands.ts (tests/packBands.test.ts): a figure outside these bands reads as from another game.</p></div>`
  const grass = (await sharp(join(PACK, 'grass.png')).png().toBuffer()).toString('base64')
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })
  const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  const { chromium } = await import(process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs')
  const browser = await chromium.launch(existsSync(EXEC) ? { executablePath: EXEC } : {})
  const page = await browser.newPage({ viewport: { width: 600, height: 400 } })
  await page.setContent(html.replace('GRASS', grass))
  await page.screenshot({ path: join(OUT, 'measure.png'), fullPage: true })
  await browser.close()
  writeFileSync(
    join(OUT, 'manifest.json'),
    JSON.stringify(
      [
        {
          id: 'pack-measure',
          group: 'Figure direction',
          people: 'all',
          title: "The pack's people, measured",
          caption: 'The bands every new figure must hit to sit beside the CC0 pawn, knight, archer and goblins. Judge: do these words match what you see?',
          file: 'measure.png',
        },
      ],
      null,
      2,
    ) + '\n',
  )
  console.log('wrote', join(OUT, 'measure.png'))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
