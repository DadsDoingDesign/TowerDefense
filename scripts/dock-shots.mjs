/**
 * dock-shots — the home dock's company faces, captured from the RUNNING app
 * (the liaisons pass, Oct 2026): the whole home and the dock strip at phone
 * width (390 × 844 at 2×) and on a desk (1280 × 800), with a played save in
 * which four companies hire and Greenvial is still locked (its shadow), the
 * ore road focused.
 *
 *   npx vite --port 5253 --strictPort &
 *   node scripts/dock-shots.mjs <outDir> [tag] [--full]
 *
 * `tag` names the files (`dock-<tag>-p390.png`, `dock-<tag>-p390-strip.png`,
 * …). `--full` is a MOCK for the review (option b of the pass): each slot's
 * dock figure swapped for the liaison's approved final at 1×, its idle frame
 * 1, overflowing the slot as it would; nothing in the shipped dock changes.
 * Reduced motion, so every face is its still pose and the shots compare.
 *
 * Env: SHOTS_BASE (default http://127.0.0.1:5253/), PW_CHROMIUM.
 */
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.argv[2] ?? 'dock-shots')
const TAG = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'now'
const FULL = process.argv.includes('--full')
const BASE = process.env.SHOTS_BASE ?? 'http://127.0.0.1:5253/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'))

const VIEWS = {
  p390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  d1280: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
}
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})

for (const [view, opts] of Object.entries(VIEWS)) {
  const ctx = await browser.newContext({ ...opts, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('  ! pageerror', e.message))
  await page.goto(BASE)
  await page.waitForFunction(() => !!window.__meta, null, { timeout: 30000 })
  await page.evaluate(async () => {
    localStorage.clear()
    const st = await import('/src/game/run/standing.ts')
    const tw = await import('/src/game/run/tradeWar.ts')
    // every standing under 3: Greenvial (opens at Standing 3) is still locked, its face a shadow
    const lv = { spice: 2, art: 2, metals: 2, silk: 1, scrolls: 0 }
    window.__meta.setState({
      bank: 1240,
      standing: Object.fromEntries(Object.entries(lv).map(([c, n]) => [c, st.standingXpToReach(n)])),
      season: { ...tw.freshSeason(), n: 2, contracts: 3, shares: { spice: 27, art: 14, metals: 32, silk: 11, scrolls: 16 }, deliveries: { spice: 1, art: 0, metals: 2, silk: 0, scrolls: 0 }, log: ['metals', 'spice', 'metals'] },
      stats: { ...window.__meta.getState().stats, runsCompleted: 6, runsWon: 4 },
    })
    const s = window.__settings.getState()
    window.__settings.setState({ taught: { ...s.taught, board: true, market: true, war: true } })
  })
  await page.waitForTimeout(300)
  await page.reload()
  await page.waitForSelector('.mn-dock .mn-slot', { timeout: 30000 })
  await page.waitForFunction(() => document.querySelector('.tm-canvas.is-ready'), null, { timeout: 20000 }).catch(() => {})
  await page.evaluate(() => window.__game?.getState().focusRoad?.('metals'))
  await page.waitForTimeout(1200)
  if (FULL) {
    await page.evaluate(async () => {
      const { LIAISON_FINALS, boxOf } = await import('/scripts/liaison-finals.ts')
      const who = { spice: 'saffra', art: 'hask', metals: 'brannoch', silk: 'odile', scrolls: 'wren' }
      const ids = ['spice', 'art', 'metals', 'silk', 'scrolls']
      document.querySelectorAll('.mn-dock > .mn-slot').forEach((slot, i) => {
        const f = LIAISON_FINALS[who[ids[i]]].idle()[0]
        const b = boxOf(f)
        const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const img = new ImageData(w, h)
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) img.data[(y * w + x) * 4 + k] = f.data[((y + b.y0) * f.w + x + b.x0) * 4 + k]
        // a locked company: its shadow, as the dock draws one
        if (slot.classList.contains('is-locked')) for (let p = 0; p < img.data.length; p += 4) if (img.data[p + 3] === 255) img.data.set([42, 62, 93], p)
        c.getContext('2d').putImageData(img, 0, 0)
        c.style.cssText = `width:${w}px;height:${h}px;image-rendering:pixelated;display:block;margin:${48 - h}px 0 0`
        slot.querySelector('.dock-face')?.replaceWith(c)
      })
    })
    await page.waitForTimeout(300)
  }
  const name = `dock-${TAG}${FULL ? '-full' : ''}-${view}`
  await page.screenshot({ path: path.join(OUT, `${name}.png`) })
  const r = await page.evaluate(() => {
    const q = document.querySelector('.mn-docked, .mn-dock').getBoundingClientRect()
    return { x: Math.max(0, Math.floor(q.left) - 8), y: Math.max(0, Math.floor(q.top) - 40), w: Math.ceil(q.width) + 16, h: Math.ceil(q.height) + 48 }
  })
  await page.screenshot({ path: path.join(OUT, `${name}-strip.png`), clip: { x: r.x, y: r.y, width: Math.min(r.w, opts.viewport.width - r.x), height: r.h } })
  console.log('  wrote', name)
  await ctx.close()
}
await browser.close()
