/**
 * peoples-sheets — shoot the Peoples & Trades contact sheets from the
 * harness (`harness/peoples.html`) to `docs/peoples/<people>-{items,skills}.png`.
 *
 *   npx vite --port 5229 --strictPort &
 *   node scripts/peoples-sheets.mjs [outRoot] [people]
 *   node scripts/peoples-sheets.mjs --cards [--roster docs/peoples/roster.json] [outRoot] [people]
 *
 * `--cards` shoots the review cards instead (`harness/peoples.html?cards`):
 * one 600 px wide card per item (100) and per skill (50) — the icon at 6×,
 * the name, its level and NEW / RENAMED / KEPT tags, the hero at 5× holding
 * or wearing the item (a skill: mid-hit with its tell), and the people and
 * the effect in one line, read from the designer's roster — to
 * `docs/peoples/cards/<id>.png`, with `docs/peoples/cards/manifest.json`
 * ({ id, group, people, title, level, status, caption, file }[]).
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

const argv = process.argv.slice(2)
const CARDS = argv.includes('--cards')
const rosterAt = argv.indexOf('--roster')
const ROSTER = rosterAt >= 0 ? argv[rosterAt + 1] : 'docs/peoples/roster.json'
const positional = argv.filter((a, i) => !a.startsWith('--') && !(rosterAt >= 0 && i === rosterAt + 1))
const ROOT = path.resolve(positional[0] ?? '.')
const ONLY = positional[1]
const CARD_DIR = 'docs/peoples/cards'
const BASE = process.env.PEOPLES_BASE ?? 'http://localhost:5229/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import(process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs')

const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})
const page = await browser.newPage({ viewport: { width: CARDS ? 600 : 1344, height: 1000 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.error('  ! pageerror', e.message))
if (CARDS) {
  const roster = JSON.parse(fs.readFileSync(path.resolve(ROSTER), 'utf8'))
  await page.addInitScript((r) => (window.__roster = r), roster)
}
const query = new URLSearchParams()
if (ONLY) query.set('people', ONLY)
if (CARDS) query.set('cards', '')
await page.goto(`${BASE}harness/peoples.html${query.size ? `?${query}` : ''}`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__peoplesReady === true, null, { timeout: 120000 })
await page.evaluate(() => document.fonts.ready)

const report = await page.evaluate(() => window.__peoples)
console.log(`icons: ${report.icons}; closest pairs (differing px of 256):`)
for (const p of report.closestIcons) console.log(`  ${String(p.d).padStart(3)}  ${p.a}  ~  ${p.b}`)
console.log(`hero figures: ${report.heroes}; closest pairs (differing px at 1×):`)
for (const p of report.closestHeroes) console.log(`  ${String(p.d).padStart(4)}  ${p.a}  ~  ${p.b}`)
console.log(`tells touching a goblin or its HP bar: ${report.tellOverlaps.length ? report.tellOverlaps.join(', ') : 'none'}`)
console.log(`widest tells (px right of the hero): ${report.tellMaxX.map((t) => `${t.skill} ${t.x}`).join(', ')}`)

/** 256 colours, no dither: the art is a few dozen flat inks (the text's anti-aliasing takes the rest). */
const squeeze = (raw) => sharp(raw).png({ palette: true, colours: 256, dither: 0, compressionLevel: 9, effort: 10 }).toBuffer()

let total = 0
if (CARDS) {
  const dir = path.join(ROOT, CARD_DIR)
  fs.mkdirSync(dir, { recursive: true })
  // A clean shoot: a card that no longer exists must not linger in the folder.
  if (!ONLY) for (const f of fs.readdirSync(dir)) if (f.endsWith('.png')) fs.rmSync(path.join(dir, f))
  // Every name and effect line must fit its card whole (the line shrinks to 17 px before it may clip).
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll('.card-name, .card-line')].filter((n) => n.scrollWidth > n.clientWidth).map((n) => n.textContent),
  )
  console.log(`clipped names / effect lines: ${clipped.length ? clipped.join(' | ') : 'none'}`)
  if (clipped.length) process.exitCode = 1
  const manifest = []
  const sizes = new Map()
  for (const c of await page.$$('section.card')) {
    const meta = JSON.parse(await c.getAttribute('data-meta'))
    const png = await squeeze(await c.screenshot({ type: 'png' }))
    fs.writeFileSync(path.join(dir, meta.file), png)
    const { width, height } = await sharp(png).metadata()
    sizes.set(`${width}x${height}`, (sizes.get(`${width}x${height}`) ?? 0) + 1)
    total += png.length
    manifest.push(meta)
  }
  const at = path.join(dir, 'manifest.json')
  // `people` re-shoots one people's cards into the existing manifest.
  const kept = ONLY && fs.existsSync(at) ? JSON.parse(fs.readFileSync(at, 'utf8')).filter((m) => m.people !== ONLY) : []
  const all = [...kept, ...manifest]
  const ORDER = ['humans', 'elves', 'dwarves', 'reptilians', 'gnomes']
  all.sort((a, b) => ORDER.indexOf(a.people) - ORDER.indexOf(b.people))
  fs.writeFileSync(at, `${JSON.stringify(all, null, 2)}\n`)
  const folder = fs.readdirSync(dir).reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0)
  console.log(`${manifest.length} cards (${[...sizes].map(([s, n]) => `${n} × ${s}`).join(', ')}), ${(total / 1024 / 1024).toFixed(2)} MB; ${path.relative(ROOT, at)} lists ${all.length}; folder ${(folder / 1024 / 1024).toFixed(2)} MB`)
} else {
  for (const s of await page.$$('section.sheet')) {
    const rel = await s.getAttribute('data-out')
    const file = path.join(ROOT, rel)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const png = await squeeze(await s.screenshot({ type: 'png' }))
    fs.writeFileSync(file, png)
    const { width, height } = await sharp(png).metadata()
    total += png.length
    console.log(`${rel}  ${width}x${height}  ${(png.length / 1024).toFixed(0)} KB`)
  }
  console.log(`total ${(total / 1024 / 1024).toFixed(2)} MB`)
}
await browser.close()
