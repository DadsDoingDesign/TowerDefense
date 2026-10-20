/**
 * held-gear-shots — every held mark through every frame it is drawn over,
 * from the real draw code (`harness/kit.html?held=1`: `drawSentinel` →
 * `heroFigure` + `drawHeldGear`), one PNG per frame, for the held-gear review
 * (`docs/ui-audit-2026-10/held-gear/`, `scripts/held-gear-cards.ts`).
 *
 *   npx vite --port 5223 --strictPort &
 *   node scripts/held-gear-shots.mjs <outDir> [scale]
 *
 * Writes `<outDir>/<kit>/<idle|atk>-<frame>.png` (the canvas's own pixels, no
 * page chrome). Env: KIT_BASE (default http://localhost:5223/), PW_CHROMIUM.
 */
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.argv[2] ?? 'held-gear')
const SCALE = Number(process.argv[3] ?? 1)
const BASE = process.env.KIT_BASE ?? 'http://localhost:5223/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import(process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs')

const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})
const page = await browser.newPage()
page.on('pageerror', (e) => console.error('  ! pageerror', e.message))
await page.goto(`${BASE}harness/kit.html?held=1&scale=${SCALE}`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__kitReady === true, null, { timeout: 30000 })
const rows = await page.evaluate(() =>
  [...document.querySelectorAll('section[data-held]')].map((s) => ({
    title: s.dataset.held,
    idle: [...s.querySelectorAll('.idle canvas')].map((c) => c.toDataURL('image/png')),
    atk: [...s.querySelectorAll('.atk canvas')].map((c) => c.toDataURL('image/png')),
  })),
)
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
for (const r of rows) {
  const dir = path.join(OUT, slug(r.title))
  fs.mkdirSync(dir, { recursive: true })
  for (const [kind, urls] of [['idle', r.idle], ['atk', r.atk]])
    urls.forEach((u, f) => fs.writeFileSync(path.join(dir, `${kind}-${f}.png`), Buffer.from(u.split(',')[1], 'base64')))
  console.log(`${slug(r.title)}: ${r.idle.length} idle, ${r.atk.length} atk`)
}
await browser.close()
