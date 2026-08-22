/**
 * Screenshot the Phase 1 vertical-slice harness.
 *
 * The review loop in `docs/DESIGN_REVIEW.md` wants a REAL render, not an
 * assumed one, so this drives the harness in headless Chromium and writes
 * `docs/slice/`. Any console error fails the run — a harness that renders half
 * a page and reports success is worse than one that crashes.
 *
 *   npx vite --port 5188 --strictPort &
 *   node scripts/slice-shot.mjs
 *
 * playwright-core is intentionally NOT a dependency (see scripts/ui-audit.mjs).
 * Install it on demand:  npm i --no-save playwright-core
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const BASE = process.env.SLICE_BASE ?? 'http://localhost:5188/harness/'
const OUT = process.env.SLICE_OUT ?? 'docs/slice'
const CHROME = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2 })

const errors = []
const missing = []
page.on('console', (m) => {
  // A 404 surfaces as a console error too, but the response hook below already
  // names the file; keeping both would report every missing sprite twice.
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text())
})
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`))
/*
 * A missing sprite does NOT 404 in dev. Vite's SPA fallback answers
 * `/assets/sprites/<pack>/nope.png` with 200 and index.html, which the browser
 * then fails to decode as an image — the exact behaviour `sprites.ts` warns
 * about. So detect by content type: an image request answered as HTML is a
 * file that was never authored.
 */
page.on('response', (r) => {
  const path = new URL(r.url()).pathname
  if (!/\.png$/.test(path)) return
  const type = r.headers()['content-type'] ?? ''
  if (r.status() === 404 || type.startsWith('text/html')) missing.push(path)
})

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('section', { timeout: 15000 })
await page.waitForTimeout(600)

const warn = (await page.locator('#warn').textContent())?.trim()
if (warn) errors.push(`HARNESS WARNING: ${warn}`)

await page.screenshot({ path: `${OUT}/00-full.png`, fullPage: true })

const sections = await page.locator('section').all()
for (let i = 0; i < sections.length; i++) {
  const title = (await sections[i].locator('h2').textContent()) ?? `section-${i}`
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
  const box = await sections[i].boundingBox()
  // `clip` needs fullPage coordinates, and boundingBox() returns them relative
  // to the document — so without fullPage a section below the fold clips to
  // nothing and Playwright throws rather than returning a blank image.
  if (box && box.width > 0 && box.height > 0) {
    await page.screenshot({
      path: `${OUT}/${String(i + 1).padStart(2, '0')}-${slug}.png`,
      clip: box,
      fullPage: true,
    })
  }
}

console.log(`slice-shot: wrote ${sections.length + 1} shot(s) to ${OUT}/`)
await browser.close()

/*
 * Missing sprites are NOT a failure while the pack is placeholder — the loader
 * is built to 404 gracefully and fall back. They are reported by name so a
 * missing file never hides inside a generic "console error", which is exactly
 * how the harness first rendered procedural circles and looked fine.
 */
if (missing.length) {
  const roles = [...new Set(missing.map((p) => p.split('/').pop()))].sort()
  console.log(`slice-shot: ${roles.length} sprite(s) not authored yet — expected while the pack is placeholder:`)
  console.log('  ' + roles.join(' '))
}

if (errors.length) {
  console.error('slice-shot: FAILED\n  ' + errors.slice(0, 10).join('\n  '))
  process.exit(1)
}
console.log('slice-shot: no script errors.')
