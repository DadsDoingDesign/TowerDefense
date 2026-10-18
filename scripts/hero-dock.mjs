/**
 * hero-dock — the company faces in the home's dock, rendered for real: the
 * running app at phone size (390 × 844), with each `.mn-slot`'s crest
 * swapped for its company's dock figure (`src/game/render/hero/mini.ts`,
 * loaded from the dev server), the focused slot in its reaction pose and a
 * locked company as its shadow. A MOCK for the designer: nothing in the
 * shipped dock changes.
 *
 *   npx vite --port 5257 --strictPort &
 *   node scripts/hero-dock.mjs [out.png] [before.png]
 *
 * Env: HEROES_BASE (default http://localhost:5257/).
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const OUT = path.resolve(process.argv[2] ?? 'docs/characters/dock-mock.png')
const BEFORE = process.argv[3] ? path.resolve(process.argv[3]) : null
const BASE = process.env.HEROES_BASE ?? 'http://localhost:5257/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import(process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs')

const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.error('  ! pageerror', e.message))
// A played save (as `scripts/motion-audit.mjs` seeds one): every company hiring but the last, still locked.
const SAVE = {
  runs: 31,
  bank: 12480,
  standing: { spice: 4, art: 2, metals: 6, silk: 3, scrolls: 0 },
  season: { n: 3, contracts: 4, shares: { spice: 27, art: 14, metals: 32, silk: 11, scrolls: 16 }, deliveries: { spice: 1, art: 0, metals: 2, silk: 0, scrolls: 0 }, log: ['metals', 'spice', null, 'metals'] },
}
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
}, SAVE)
await page.waitForTimeout(300)
await page.reload()
await page.waitForSelector('.mn-dock .mn-slot', { timeout: 20000 })
await page.waitForFunction(() => document.querySelector('.tm-canvas.is-ready'), null, { timeout: 20000 }).catch(() => {})
// focus the ore road, so its slot shows the picked reaction
await page.evaluate(() => window.__game?.getState().focusRoad?.('metals'))
await page.waitForTimeout(1200)
if (BEFORE) {
  fs.mkdirSync(path.dirname(BEFORE), { recursive: true })
  fs.writeFileSync(BEFORE, await page.screenshot({ type: 'png' }))
}

const info = await page.evaluate(async () => {
  const mini = await import('/src/game/render/hero/mini.ts')
  // dock order (COMPANY_IDS): spice, art, metals, silk, scrolls
  const faces = ['saffra', 'hask', 'brannoch', 'odile', 'wren']
  const slots = [...document.querySelectorAll('.mn-dock > .mn-slot')]
  const out = []
  slots.forEach((slot, i) => {
    const id = faces[i]
    if (!id) return
    // the fifth company is shown locked (its shadow) for review: in this save every company is hiring
    const locked = slot.classList.contains('is-locked') || i === 4
    const on = slot.getAttribute('aria-pressed') === 'true'
    const fr = mini.miniFrame(id, on ? 'react' : 'idle', on ? 1 : 0, locked)
    const c = document.createElement('canvas')
    c.width = fr.w
    c.height = fr.h
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.rgba), fr.w, fr.h), 0, 0)
    // shown at 2× (the crest's own pixel scale), centred in the crest's box
    c.style.cssText = `width:${fr.w * 2}px;height:${fr.h * 2}px;image-rendering:pixelated;display:block;margin-top:-12px`
    const crest = slot.querySelector('.mn-slot-crest')
    const old = crest.querySelector('svg, img, canvas, .crest, span:not(.mn-slot-crown)')
    if (old) old.replaceWith(c)
    else crest.prepend(c)
    out.push({ id, locked, on })
  })
  return out
})
console.log('slots', JSON.stringify(info))
await page.waitForTimeout(300)
const shot = await page.screenshot({ type: 'png' })
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, await sharp(shot).png({ palette: true, colours: 256, dither: 0, compressionLevel: 9 }).toBuffer())
console.log('wrote', OUT)
await browser.close()
