/**
 * peoples-sheets — shoot the Peoples & Trades contact sheets from the
 * harness (`harness/peoples.html`) to `docs/peoples/<people>-{items,skills}.png`.
 *
 *   npx vite --port 5229 --strictPort &
 *   node scripts/peoples-sheets.mjs [outRoot] [people]
 *
 * Every `.sheet` on the page is captured at 1344 px wide (shown at 672 in
 * the doc column), then palette-compressed (256 colours, no dither: the art
 * is a few dozen flat inks). Prints the harness's review checks — the closest
 * icon pairs, the closest hero figures, and any tell that touches a goblin
 * or its HP bar. Env: PEOPLES_BASE (default http://localhost:5229/), PW_CHROMIUM.
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(process.argv[2] ?? '.')
const ONLY = process.argv[3]
const BASE = process.env.PEOPLES_BASE ?? 'http://localhost:5229/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import(process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs')

const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})
const page = await browser.newPage({ viewport: { width: 1344, height: 1000 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.error('  ! pageerror', e.message))
await page.goto(`${BASE}harness/peoples.html${ONLY ? `?people=${ONLY}` : ''}`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__peoplesReady === true, null, { timeout: 120000 })
await page.evaluate(() => document.fonts.ready)

const report = await page.evaluate(() => window.__peoples)
console.log(`icons: ${report.icons}; closest pairs (differing px of 256):`)
for (const p of report.closestIcons) console.log(`  ${String(p.d).padStart(3)}  ${p.a}  ~  ${p.b}`)
console.log(`hero figures: ${report.heroes}; closest pairs (differing px at 1×):`)
for (const p of report.closestHeroes) console.log(`  ${String(p.d).padStart(4)}  ${p.a}  ~  ${p.b}`)
console.log(`tells touching a goblin or its HP bar: ${report.tellOverlaps.length ? report.tellOverlaps.join(', ') : 'none'}`)
console.log(`widest tells (px right of the hero): ${report.tellMaxX.map((t) => `${t.skill} ${t.x}`).join(', ')}`)

const sheets = await page.$$('section.sheet')
let total = 0
for (const s of sheets) {
  const rel = await s.getAttribute('data-out')
  const file = path.join(ROOT, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const raw = await s.screenshot({ type: 'png' })
  const png = await sharp(raw).png({ palette: true, colours: 256, dither: 0, compressionLevel: 9, effort: 10 }).toBuffer()
  fs.writeFileSync(file, png)
  const { width, height } = await sharp(png).metadata()
  total += png.length
  console.log(`${rel}  ${width}x${height}  ${(png.length / 1024).toFixed(0)} KB`)
}
console.log(`total ${(total / 1024 / 1024).toFixed(2)} MB`)
await browser.close()
