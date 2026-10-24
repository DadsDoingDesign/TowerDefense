/**
 * dock-faces — the phone-board cards for the company faces in the home dock
 * (`src/ui/shell/DockFace.tsx`), shot in the running app.
 *
 *   npx vite --port 5273 --strictPort &
 *   node scripts/dock-faces.mjs [outDir]      (default docs/ui-audit-2026-10/dock-faces)
 *
 * Writes `home-<company>.png` (the home at 390 × 844 with that company
 * focused, over a 3× crop of the dock round its slot), `home-locked.png`
 * (Greenvial not hiring yet: its face is a shadow), `desk.png` (1280 × 800,
 * with a crop of the dock at its own pixels), `dock-live.webp` (4 s of the
 * real dock on a fake clock: the idles, a tic or two, a pick's reaction) and
 * `manifest.json`. Env: DOCK_BASE (default http://localhost:5273/).
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const OUT = path.resolve(process.argv[2] ?? 'docs/ui-audit-2026-10/dock-faces')
const BASE = process.env.DOCK_BASE ?? 'http://localhost:5273/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import(process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs')

const IDS = ['spice', 'art', 'metals', 'silk', 'scrolls']
const NAMES = { spice: 'Peppercorn', art: 'Butcherblock', metals: 'Ironvein', silk: 'Rosethread', scrolls: 'Greenvial' }
const FACE = { spice: 'Saffra', art: 'Hask', metals: 'Brannoch', silk: 'Odile', scrolls: 'Wren' }
// A played save (as hero-dock.mjs): every company hiring, Ironvein leading the war.
const OPEN = { bank: 12480, runs: 31, standing: { spice: 4, art: 2, metals: 6, silk: 3, scrolls: 3 }, season: { n: 3, contracts: 4, shares: { spice: 27, art: 14, metals: 32, silk: 11, scrolls: 16 }, deliveries: { spice: 1, art: 0, metals: 2, silk: 0, scrolls: 0 }, log: ['metals', 'spice', null, 'metals'] } }
// An early save: no standing 3 yet, so Greenvial is not hiring.
const EARLY = { bank: 340, runs: 5, standing: { spice: 2, art: 1, metals: 1 }, season: { n: 1, contracts: 2, deliveries: { spice: 1, art: 0, metals: 0, silk: 0, scrolls: 0 }, log: ['spice', null] } }

const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})
fs.mkdirSync(OUT, { recursive: true })

async function home(save, viewport, dpr, focus) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, isMobile: viewport.width < 900, hasTouch: viewport.width < 900 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('  ! pageerror', e.message))
  await page.goto(BASE)
  await page.waitForFunction(() => !!window.__meta, null, { timeout: 20000 })
  await page.evaluate(async (save) => {
    localStorage.clear()
    const st = await import('/src/game/run/standing.ts')
    const tw = await import('/src/game/run/tradeWar.ts')
    const ids = ['spice', 'art', 'metals', 'silk', 'scrolls']
    window.__meta.setState({
      bank: save.bank,
      standing: Object.fromEntries(ids.map((c) => [c, st.standingXpToReach(save.standing[c] ?? 0)])),
      season: { ...tw.freshSeason(), ...save.season },
      stats: { ...window.__meta.getState().stats, runsCompleted: save.runs, runsWon: save.runs },
    })
    const s = window.__settings.getState()
    window.__settings.setState({ taught: { ...s.taught, board: true, market: true, war: true } })
  }, save)
  await page.waitForTimeout(300)
  await page.reload()
  await page.waitForSelector('.mn-dock .mn-slot', { timeout: 20000 })
  await page.waitForFunction(() => document.querySelector('.tm-canvas.is-ready'), null, { timeout: 20000 }).catch(() => {})
  if (focus) await page.evaluate((f) => window.__game.getState().focusRoad(f), focus)
  await page.waitForTimeout(1400)
  return { ctx, page }
}

const box = (page, sel) => page.evaluate((sel) => {
  const r = document.querySelector(sel).getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height }
}, sel)
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const chrome = (w, h, title, lines) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#16120e"/>
  <text x="18" y="24" fill="#e3b64f" font-family="sans-serif" font-weight="700" font-size="13" letter-spacing="1.5">DOCK LIVE</text>
  <text x="18" y="52" fill="#f2e8d8" font-family="Georgia, serif" font-weight="700" font-size="24">${esc(title)}</text>
  ${lines.map((l, i) => `<text x="18" y="${h - 16 - (lines.length - 1 - i) * 22}" fill="#b3a48c" font-family="sans-serif" font-size="16">${esc(l)}</text>`).join('')}</svg>`)
const png = (b) => sharp(b).png({ palette: true, colours: 256, dither: 0, compressionLevel: 9 }).toBuffer()
const W = 600, HEAD = 66, FOOT = 64
const manifest = []

/** The home at 390 × 844 (CSS px), over a 3× crop of the dock round the focused slot (at the device's own 3× pixels). */
async function phoneCard(save, focus, file, title, lines) {
  const one = await home(save, { width: 390, height: 844 }, 1, focus)
  const shot = await one.page.screenshot({ type: 'png' })
  await one.ctx.close()
  const three = await home(save, { width: 390, height: 844 }, 3, focus)
  const slot = await box(three.page, `.mn-dock > .mn-slot:nth-child(${IDS.indexOf(focus) + 1})`)
  const big = await three.page.screenshot({ type: 'png' })
  await three.ctx.close()
  const cw = Math.floor((W - 36) / 3) // CSS px across the crop
  const left = Math.max(0, Math.min(390 - cw, Math.round(slot.x + slot.w / 2 - cw / 2)))
  // from the slot's hung marks and crown down to its notch
  const top = Math.round(slot.y - 22)
  const ch = Math.round(slot.h + 34)
  const crop = await sharp(big).extract({ left: left * 3, top: top * 3, width: cw * 3, height: ch * 3 }).png().toBuffer()
  const H = HEAD + 844 + 18 + ch * 3 + FOOT
  const out = await sharp(chrome(W, H, title, lines))
    .composite([
      { input: shot, left: (W - 390) / 2, top: HEAD },
      { input: crop, left: 18, top: HEAD + 844 + 18 },
    ])
    .png()
    .toBuffer()
  fs.writeFileSync(path.join(OUT, file), await png(out))
  console.log('wrote', file)
}

for (const c of IDS) {
  await phoneCard(OPEN, c, `home-${c}.png`, `${NAMES[c]}: ${FACE[c]}`, [
    `The real home, 390 × 844, ${NAMES[c]} focused; under it the dock at 3×.`,
    'Judge the face reads as its company and the Rep line still reads.',
  ])
  manifest.push({ id: `home-${c}`, group: 'Dock live', people: FACE[c], title: `${NAMES[c]}: ${FACE[c]}`, caption: `The real home at 390 wide with ${NAMES[c]} focused, and the dock at 3×; judge the face reads as its company and its Rep still reads.`, file: `home-${c}.png` })
}
await phoneCard(EARLY, 'scrolls', 'home-locked.png', 'Not hiring yet: a shadow', ['An early save: Greenvial opens at Standing 3. Its face is Wren’s', 'shadow, still; the slot says “at 3”. Judge it reads as locked.'])
manifest.push({ id: 'home-locked', group: 'Dock live', people: 'Wren', title: 'Not hiring yet: a shadow', caption: 'An early save, Greenvial focused but not hiring: the face is a still shadow and the slot says “at 3”; judge it reads as locked.', file: 'home-locked.png' })

// The desk: the whole home, and the dock at its own pixels round the focused slot.
{
  const d = await home(OPEN, { width: 1280, height: 800 }, 1, 'metals')
  const shot = await d.page.screenshot({ type: 'png' })
  const dock = await box(d.page, '.mn-dock')
  await d.ctx.close()
  const small = await sharp(shot).resize(W - 36, Math.round(((W - 36) * 800) / 1280), { kernel: 'lanczos3' }).png().toBuffer()
  const sh = Math.round(((W - 36) * 800) / 1280)
  const top = Math.round(dock.y - 14)
  const ch = Math.round(dock.h + 26)
  const cx = Math.round(dock.x + dock.w / 2 - (W - 36) / 2)
  const crop = await sharp(shot).extract({ left: cx, top, width: W - 36, height: ch }).png().toBuffer()
  const crop2 = await sharp(crop).extract({ left: 0, top: 0, width: Math.floor((W - 36) / 2), height: ch }).resize({ width: Math.floor((W - 36) / 2) * 2, kernel: 'nearest' }).png().toBuffer()
  const H = HEAD + sh + 18 + ch + 18 + ch * 2 + FOOT
  const out = await sharp(chrome(W, H, 'The desk, 1280 × 800', ['Shrunk to fit; under it the dock at its own pixels, then 2×.', 'Judge the faces sit square in the wider slots, at 2× like the phone.']))
    .composite([
      { input: small, left: 18, top: HEAD },
      { input: crop, left: 18, top: HEAD + sh + 18 },
      { input: crop2, left: 18, top: HEAD + sh + 18 + ch + 18 },
    ])
    .png()
    .toBuffer()
  fs.writeFileSync(path.join(OUT, 'desk.png'), await png(out))
  console.log('wrote desk.png')
  manifest.push({ id: 'desk', group: 'Dock live', people: 'all', title: 'The desk, 1280 × 800', caption: 'The desk home with Ironvein focused, and its dock at its own pixels; judge the faces sit square in the wider slots.', file: 'desk.png' })
}

// The dock in motion: the real dock on a fake clock, 4 s at 80 ms a frame, Rosethread picked at 1.6 s.
{
  const FPS = 12.5, SECS = 4, DPR = 2
  const d = await home(OPEN, { width: 390, height: 844 }, DPR, 'metals')
  await d.page.clock.install()
  await d.page.clock.runFor(100)
  const dock = await box(d.page, '.mn-docked')
  const own = await box(d.page, '.mn-own')
  const clip = { x: 8, y: Math.round(Math.min(own.y, dock.y) - 14), width: 374, height: 0 }
  clip.height = Math.round(dock.y + dock.h + 12 - clip.y)
  const frames = []
  const n = SECS * FPS
  for (let i = 0; i < n; i++) {
    if (i === Math.round(1.6 * FPS)) await d.page.evaluate(() => window.__game.getState().focusRoad('silk'))
    await d.page.clock.runFor(1000 / FPS)
    frames.push(await d.page.screenshot({ type: 'png', clip }))
  }
  await d.ctx.close()
  const w = clip.width * DPR, h = clip.height * DPR
  const head = 40
  const base = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h + head}"><rect width="100%" height="100%" fill="#16120e"/><text x="12" y="27" fill="#f2e8d8" font-family="sans-serif" font-weight="700" font-size="18">The dock, live · 4 s · Rosethread picked at 1.6 s</text></svg>`)).png().toBuffer()
  const joined = []
  for (const f of frames) joined.push(await sharp(base).composite([{ input: f, left: 0, top: head }]).png().toBuffer())
  const file = path.join(OUT, 'dock-live.webp')
  let kb = Infinity
  for (const quality of [80, 70, 60, 50]) {
    await sharp(joined, { join: { animated: true } }).webp({ quality, effort: 6, loop: 0, delay: Array(n).fill(Math.round(1000 / FPS)) }).toFile(file)
    kb = Math.round(fs.statSync(file).size / 1024)
    if (kb <= 1400) break
  }
  console.log(`wrote dock-live.webp (${w}×${h + head}, ${n} frames, ${kb} KB)`)
  manifest.push({ id: 'dock-live', group: 'Dock live', people: 'all', title: 'The dock, live', caption: 'Four seconds of the real dock: five idles out of step, a tic now and then, Odile’s half-bow when Rosethread is picked; judge it stays calm.', file: 'dock-live.webp' })
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`manifest: ${manifest.length} cards`)
await browser.close()
