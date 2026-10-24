/**
 * The battlefield asset critique's phone review cards (Oct 2026,
 * `docs/ui-audit-2026-10/asset-critique/battlefield/cards/`): one card per
 * asset, BEFORE beside AFTER at phone width, a 2–3× crop of each under them,
 * the rubric's scores before → after, and one plain caption — for the
 * designer's Good / Fix / Cut, one card at a time.
 *
 *   node scripts/battlefield-cards.mjs <spec.json> <outDir>
 *
 * The spec is an array of
 *   { id, title, caption, people?, scores: { a: [b, a], b: [b, a], j: [b, a] },
 *     before, after,                      // phone stage shots (PNG paths)
 *     view?: [x, y, w, h],                // the part of the shot to show (shot px)
 *     crop: [x, y, w, h], cropBefore?: [...], zoom?: 3,
 *     cropFrom?: { before, after } }      // crop source when not the shot itself (a 1:1 bake)
 * and the script writes `<id>.png` (600 px wide) for each and `manifest.json`.
 *
 * playwright is not a dependency: set PW_MODULE to its index.mjs.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const sharp = require('sharp')
const PW = process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs'
const CHROME = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import(PW)
const [specFile, outDir] = process.argv.slice(2)
const spec = JSON.parse(readFileSync(specFile, 'utf8'))
mkdirSync(outDir, { recursive: true })

const COL = 288
const dataUrl = (buf) => `data:image/png;base64,${buf.toString('base64')}`

/** A region of a PNG, scaled (nearest neighbour) to `width` px wide. */
async function region(file, rect, width) {
  const img = sharp(resolve(file))
  const meta = await img.metadata()
  const [x, y, w, h] = rect ?? [0, 0, meta.width, meta.height]
  const cut = { left: Math.max(0, x), top: Math.max(0, y), width: Math.min(w, meta.width - Math.max(0, x)), height: Math.min(h, meta.height - Math.max(0, y)) }
  return sharp(resolve(file)).extract(cut).resize(width, Math.round((cut.height * width) / cut.width), { kernel: width >= cut.width ? 'nearest' : 'lanczos3' }).png().toBuffer()
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const score = (k, [b, a]) => `<span class="sc"><b>${k}</b> ${b}${b === a ? '' : ` → <i class="${a > b ? 'up' : 'dn'}">${a}</i>`}</span>`

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 600, height: 400 }, deviceScaleFactor: 1 })
const manifest = []
for (const c of spec) {
  const zoom = c.zoom ?? 3
  const cb = c.cropBefore ?? c.crop
  const [bView, aView, bCrop, aCrop] = await Promise.all([
    region(c.before, c.view, COL),
    region(c.after, c.viewAfter ?? c.view, COL),
    region(c.cropFrom?.before ?? c.before, cb, Math.min(COL, cb[2] * zoom)),
    region(c.cropFrom?.after ?? c.after, c.crop, Math.min(COL, c.crop[2] * zoom)),
  ])
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#201711;color:#f3e6cf;font:15px/1.35 system-ui,sans-serif;width:600px}
    .card{padding:16px 8px 14px}
    h1{font:700 24px/1.15 Georgia,serif;margin:0 4px 4px}
    .cap{margin:0 4px 10px;color:#d9c9ac}
    .scores{display:flex;gap:14px;margin:0 4px 12px;font-size:16px}
    .sc b{color:#e0ac4c;font-weight:800;margin-right:2px}
    .sc i{font-style:normal;font-weight:800}.up{color:#8fd16a}.dn{color:#ff8a70}
    .row{display:flex;gap:8px;justify-content:center;margin-bottom:8px}
    figure{margin:0;width:${COL}px}
    figcaption{font:800 12px/1 system-ui;letter-spacing:.08em;color:#e0ac4c;margin:0 0 4px}
    img{display:block;width:${COL}px;image-rendering:pixelated;border-radius:6px;outline:1px solid #4a3a2a}
    .z{font-size:11px;color:#a8977a;margin:2px 0 0;letter-spacing:.06em}
  </style><div class="card">
    <h1>${esc(c.title)}</h1>
    <p class="cap">${esc(c.caption)}</p>
    <div class="scores">${score('Aesthetics', c.scores.a)}${score('Brand', c.scores.b)}${score('Job', c.scores.j)}</div>
    <div class="row"><figure><figcaption>BEFORE</figcaption><img src="${dataUrl(bView)}"></figure><figure><figcaption>AFTER</figcaption><img src="${dataUrl(aView)}"></figure></div>
    <div class="row"><figure><img src="${dataUrl(bCrop)}"><p class="z">BEFORE · ${c.zoomLabel ?? `${zoom}×`}</p></figure><figure><img src="${dataUrl(aCrop)}"><p class="z">AFTER · ${c.zoomLabel ?? `${zoom}×`}</p></figure></div>
  </div>`
  await page.setContent(html)
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())))
  const file = `${c.id}.png`
  // Lean on disk: a palette PNG (pixel art and flat chrome quantise cleanly).
  const shot = await page.locator('.card').screenshot()
  await sharp(shot).png({ palette: true, colors: 192, effort: 10 }).toFile(`${outDir}/${file}`)
  manifest.push({ id: c.id, group: 'Battlefield', people: c.people ?? '', title: c.title, caption: c.caption, file })
  console.log('card', file)
}
writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 1) + '\n')
await browser.close()
