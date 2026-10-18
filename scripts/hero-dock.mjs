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
  // the proposal: the slot grows 16 px so the 48 px figure stands clear of its Rep line (the crest box was 32)
  const st = document.createElement('style')
  st.textContent = '.mn-dock .mn-slot{height:92px}.mn-dock .mn-slot-crest{height:48px}'
  document.head.append(st)
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
    c.style.cssText = `width:${fr.w * 2}px;height:${fr.h * 2}px;image-rendering:pixelated;display:block;margin-top:-6px`
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
const png = (b) => sharp(b).png({ palette: true, colours: 256, dither: 0, compressionLevel: 9 }).toBuffer()
fs.writeFileSync(OUT, await png(shot))
console.log('wrote', OUT)

// the phone cards: the whole home with the figures in, and the dock before / after (in the card), ~600 px wide
const CARDS = path.join(path.dirname(OUT), 'cards')
if (fs.existsSync(path.join(CARDS, 'manifest.json'))) {
  const beforeShot = BEFORE ? fs.readFileSync(BEFORE) : null
  const dock = await page.evaluate(() => {
    const r = document.querySelector('.mn-dock').getBoundingClientRect()
    return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
  })
  const label = (title, caption, w, h) =>
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#1d1713"/>
      <text x="18" y="26" fill="#e3b64f" font-family="sans-serif" font-weight="700" font-size="14">DOCK</text>
      <text x="18" y="54" fill="#f2e8d8" font-family="Georgia, serif" font-weight="700" font-size="26">${title}</text>
      <text x="18" y="${h - 40}" fill="#b3a48c" font-family="sans-serif" font-size="17">${caption[0]}</text>
      <text x="18" y="${h - 16}" fill="#b3a48c" font-family="sans-serif" font-size="17">${caption[1]}</text></svg>`)
  // 1 · the home at phone size (the 2× shot, halved to the phone's own 390 px: CSS px, pixel art at its 2×)
  const home = await sharp(shot).resize(390, 844, { kernel: 'nearest' }).png().toBuffer()
  const c1 = await sharp(label('The home dock, with the faces', ['Real home, 390 × 844: crests swapped for the figures, slots 16 px taller', '(the picked slot reacts; the fifth shown locked). Judge it stays calm.'], 600, 66 + 844 + 92))
    .composite([{ input: home, left: 105, top: 66 }]).png().toBuffer()
  fs.writeFileSync(path.join(CARDS, 'dock-home-mock.png'), await png(c1))
  // 2 · the dock strip, before and after, at the phone's 2× pixels
  const cropW = Math.min(564, dock.w * 2), cropH = dock.h * 2 + 24
  const cut = (b) => sharp(b).extract({ left: Math.max(0, dock.x * 2 - 4), top: Math.max(0, dock.y * 2 - 24), width: cropW, height: cropH }).png().toBuffer()
  const after = await cut(shot)
  const parts = [{ input: after, left: 18, top: 66 + cropH + 40 }]
  if (beforeShot) parts.push({ input: await cut(beforeShot), left: 18, top: 66 + 20 })
  const h2 = 66 + 2 * cropH + 60 + 92
  const lab = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${h2}"><text x="18" y="${66 + 14}" fill="#efe6d6" font-family="sans-serif" font-weight="700" font-size="15">Today: the crests</text><text x="18" y="${66 + cropH + 34}" fill="#efe6d6" font-family="sans-serif" font-weight="700" font-size="15">Proposed: the company faces</text></svg>`)
  const c2 = await sharp(label('Crests → faces', ['Before / after at the phone’s own pixels; the slot grows 16 px for', 'the figure. Judge each slot still reads as its company at a glance.'], 600, h2)).composite([...parts, { input: lab, left: 0, top: 0 }]).png().toBuffer()
  fs.writeFileSync(path.join(CARDS, 'dock-before-after.png'), await png(c2))
  const mf = path.join(CARDS, 'manifest.json')
  const m = JSON.parse(fs.readFileSync(mf, 'utf8')).filter((e) => e.id !== 'home-mock' && e.id !== 'before-after')
  m.push(
    { id: 'home-mock', group: 'Dock', people: 'all', title: 'The home dock, with the faces', caption: 'The real home at phone size with the five figures in the dock; judge it stays calm next to the map.', file: 'dock-home-mock.png' },
    { id: 'before-after', group: 'Dock', people: 'all', title: 'Crests → faces', caption: 'The dock strip before and after; judge each slot still reads as its company.', file: 'dock-before-after.png' },
  )
  fs.writeFileSync(mf, JSON.stringify(m, null, 2) + '\n')
  console.log('cards: dock-home-mock.png, dock-before-after.png (+ manifest)')
}
await browser.close()
