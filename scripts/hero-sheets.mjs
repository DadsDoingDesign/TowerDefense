/**
 * hero-sheets — export the hero builder's review sheets and phone cards from
 * the harness (`harness/heroes.html`).
 *
 *   npx vite --port 5257 --strictPort &
 *   node scripts/hero-sheets.mjs [outRoot] [only]
 *
 * Writes `docs/characters/*.png` (1344 px wide) and `docs/characters/cards/`
 * (one ~600 px card per idea; animated cards as GIF) with `manifest.json`
 * (`[{ id, group, people, title, caption, file }]`). Everything is
 * palette-compressed: the art is a few dozen flat inks. `only` passes the
 * harness's `?only=` (e.g. `lineup,faces`) and skips the manifest. Prints the
 * harness's review report. Env: HEROES_BASE (default http://localhost:5257/).
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(process.argv[2] ?? '.')
const ONLY = process.argv[3]
const BASE = process.env.HEROES_BASE ?? 'http://localhost:5257/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import(process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs')

const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})
const page = await browser.newPage({ viewport: { width: 1344, height: 1000 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.error('  ! pageerror', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.error('  ! console', m.text()) })
await page.goto(`${BASE}harness/heroes.html${ONLY ? `?only=${ONLY}` : ''}`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__heroReady === true, null, { timeout: 300000 })
// the second build, once the terrain bake has landed
await page.waitForTimeout(2500)
await page.waitForFunction(() => window.__heroReady === true, null, { timeout: 300000 })

const data = await page.evaluate(() => window.__heroOut)
console.log('report', JSON.stringify(data.report))

const png = (buf, colours = 256) => sharp(buf).png({ palette: true, colours, dither: 0, compressionLevel: 9, effort: 10 }).toBuffer()
const fromURL = (u) => Buffer.from(u.split(',')[1], 'base64')

let total = 0
for (const s of data.sheets) {
  const file = path.join(ROOT, s.file)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const b = await png(fromURL(s.url))
  fs.writeFileSync(file, b)
  const { width, height } = await sharp(b).metadata()
  total += b.length
  console.log(`${s.file}  ${width}x${height}  ${(b.length / 1024).toFixed(0)} KB`)
}
console.log(`sheets ${(total / 1024 / 1024).toFixed(2)} MB`)

const cardDir = path.join(ROOT, 'docs/characters/cards')
fs.mkdirSync(cardDir, { recursive: true })
if (!ONLY) for (const f of fs.readdirSync(cardDir)) fs.rmSync(path.join(cardDir, f))
let cardTotal = 0
const manifest = []
for (const c of data.cards) {
  const raw = fromURL(c.url)
  let b
  if (c.frames) {
    const meta = await sharp(raw).metadata()
    const h = meta.height / c.frames
    b = await sharp(raw, { animated: false })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
      .then(({ data: px, info }) => sharp(px, { raw: { width: info.width, height: info.height, channels: 4, pageHeight: h } })
        .gif({ delay: c.delays.map((d) => Math.round(d)), loop: 0, colours: 96, effort: 10, dither: 0, interFrameMaxError: 0 })
        .toBuffer())
  } else b = await png(raw, 128)
  fs.writeFileSync(path.join(cardDir, c.file), b)
  cardTotal += b.length
  manifest.push({ id: c.id, group: c.group, people: c.people, title: c.title, caption: c.caption, file: c.file })
}
if (!ONLY) fs.writeFileSync(path.join(cardDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
const big = [...data.cards].map((c) => c.file)
console.log(`cards ${data.cards.length}  ${(cardTotal / 1024 / 1024).toFixed(2)} MB  (${big.length} files)`)
await browser.close()
