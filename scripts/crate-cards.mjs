/**
 * crate-cards — the sealed crates' review cards, from the RUNNING app (Oct 2026,
 * the crates pass; `docs/ui-audit-2026-10/crates/`).
 *
 *   npx vite --port 5291 --strictPort &
 *   node scripts/crate-cards.mjs <outDir> [what]
 *
 * what: comma list of screen (the screen, phone + desk), open (the opening as
 *       frames → animated WebP: `full`, `common`, `legendary`, plus the
 *       summary PNG), fps (the opening at a 4× CPU throttle, real time, phone)
 *       (default all).
 *
 * The opening is captured in SLOW MOTION (the CSS clock through CDP, every JS
 * clock patched ×0.125, as `motion-audit.mjs` does), a frame every 50 ms of
 * world time, and tapped along by a small in-page player: three taps on the
 * crate 300 ms apart, then each card read for 1.1 s. A crate's contents are
 * fixed by its seed (`metaStore.crates.seed`): seed 1 is a Level 1, seed 2 a
 * Level 3, seed 9 a Level 2 and a Level 3 (`hq.rollPull`, the save below).
 * Env: BASE (default http://localhost:5291/), PW_CHROMIUM.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')
const OUT = path.resolve(process.argv[2] ?? 'crate-cards-out')
const WHAT = new Set((process.argv[3] ?? 'screen,open,fps').split(','))
const BASE = process.env.BASE ?? 'http://localhost:5291/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'))
const SLOW = 0.125
const STEP = 50
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const VIEWS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  phone15: { viewport: { width: 400, height: 760 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true },
  desk: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
}

async function open(view, { seed = 1, bank = 2480, fx = 'full', motion = true } = {}) {
  const ctx = await browser.newContext({ ...VIEWS[view], reducedMotion: motion ? 'no-preference' : 'reduce' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('pageerror', String(e)))
  await page.goto(BASE)
  await page.waitForFunction(() => !!window.__meta, null, { timeout: 20000 })
  await page.evaluate(
    async ({ seed, bank }) => {
      localStorage.clear()
      const st = await import('/src/game/run/standing.ts')
      const sk = await import('/src/game/data/skills.ts')
      const ik = await import('/src/game/data/itemKinds.ts')
      const ids = ['spice', 'art', 'metals', 'silk', 'scrolls']
      const lv = { spice: 4, art: 2, metals: 2, silk: 1, scrolls: 2 }
      window.__meta.setState({
        bank,
        standing: Object.fromEntries(ids.map((c) => [c, st.standingXpToReach(lv[c])])),
        skills: sk.RANDOM_UNLOCK_SKILLS.slice(0, 6),
        items: ik.UNLOCK_ITEM_KINDS.slice(0, 5),
        crates: { seed, opened: 0 },
        stats: { ...window.__meta.getState().stats, runsCompleted: 6, runsWon: 4 },
      })
      const s = window.__settings.getState()
      window.__settings.setState({ taught: { ...s.taught, board: true, market: true, war: true, crates: true } })
    },
    { seed, bank },
  )
  await page.waitForTimeout(300)
  await page.reload()
  await page.waitForFunction(() => document.querySelector('.tm-canvas.is-ready'), null, { timeout: 20000 })
  await page.evaluate((fx) => {
    window.__settings.getState().setEffects?.(fx)
    window.__fxQuality?.setFxAuto(false)
  }, fx)
  await page.waitForTimeout(800)
  const cdp = await ctx.newCDPSession(page)
  return { ctx, page, cdp }
}

async function toCrates(page) {
  await page.locator('.mn-place', { hasText: /Crates|Sealed/ }).first().click()
  await page.waitForSelector('.cr-hero')
  await page.waitForTimeout(900)
}

async function slow(p, rate) {
  await p.cdp.send('Animation.enable').catch(() => {})
  await p.cdp.send('Animation.setPlaybackRate', { playbackRate: rate }).catch(() => {})
  await p.page.evaluate((r) => {
    if (window.__slowed) return
    window.__slowed = r
    const rate = r
    const perf = performance.now.bind(performance)
    let real = perf()
    let virt = real
    const now = () => {
      const t = perf()
      virt += (t - real) * rate
      real = t
      return virt
    }
    performance.now = now
    const raf = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (cb) => raf(() => cb(now()))
    const st = window.setTimeout.bind(window)
    window.setTimeout = (fn, ms, ...a) => st(fn, (ms ?? 0) / rate, ...a)
  }, rate)
}

/** The in-page player: taps the crate three times, then reads each card for `read` ms (world time). */
const player = ({ tapGap, read }) => {
  const root = () => document.querySelector('.cr-open')
  const tap = () => root()?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'touch' }))
  let busy = false
  const tick = () => {
    const r = root()
    if (!r) return setTimeout(tick, 40)
    if (busy) return setTimeout(tick, 20)
    if (r.classList.contains('at-ready')) {
      busy = true
      setTimeout(() => {
        tap()
        busy = false
      }, tapGap)
    } else if (r.querySelector('.cr-card.is-shown')) {
      busy = true
      setTimeout(() => {
        tap()
        busy = false
      }, read)
    }
    setTimeout(tick, 20)
  }
  tick()
}

async function captureOpening(name, { seed, many = 1, view = 'phone15', ms, read = 1100, tapGap = 320, fx = 'full' }) {
  const p = await open(view, { seed, fx })
  await toCrates(p.page)
  for (let i = 1; i < many; i++) await p.page.locator('.cr-many .ct-step').last().click()
  await slow(p, SLOW)
  await p.page.evaluate(player, { tapGap, read })
  const dir = path.join(OUT, 'frames', name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  await p.page.locator('.pg-cta').first().click()
  // A screenshot can take longer than a frame's slot: each frame keeps the
  // world time it was really taken at, and the WebP shows it for exactly that long.
  const t0 = Date.now()
  const times = []
  for (let i = 0; ; i++) {
    const due = t0 + (i * STEP) / SLOW
    const wait = due - Date.now()
    if (wait > 0) await sleep(wait)
    const t = (Date.now() - t0) * SLOW
    if (t > ms) break
    times.push(t)
    await p.page.screenshot({ path: path.join(dir, `f${String(i).padStart(3, '0')}.png`) })
  }
  fs.writeFileSync(path.join(dir, 'times.json'), JSON.stringify(times))
  await p.ctx.close()
  return dir
}

async function webp(dir, file, { width = 600, quality = 62 } = {}) {
  const frames = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort()
  const times = JSON.parse(fs.readFileSync(path.join(dir, 'times.json'), 'utf8'))
  const delay = frames.map((_, i) => Math.max(20, Math.round((times[i + 1] ?? times[i] + STEP) - times[i])))
  const bufs = await Promise.all(frames.map((f) => sharp(path.join(dir, f)).resize({ width, kernel: 'nearest' }).png().toBuffer()))
  await sharp(bufs, { join: { animated: true } })
    .webp({ quality, effort: 5, delay, loop: 0 })
    .toFile(file)
  const kb = Math.round(fs.statSync(file).size / 1024)
  const total = delay.reduce((a, b) => a + b, 0)
  console.log(`${path.basename(file)}: ${frames.length} frames, ${(total / 1000).toFixed(1)} s, ${kb} KB`)
}

if (WHAT.has('screen')) {
  for (const view of ['phone', 'desk']) {
    const p = await open(view)
    await p.page.screenshot({ path: path.join(OUT, `home-${view}.png`) })
    await toCrates(p.page)
    await p.page.screenshot({ path: path.join(OUT, `screen-${view}.png`) })
    await p.ctx.close()
  }
  // A short bank: the refusal.
  const p = await open('phone', { bank: 320 })
  await toCrates(p.page)
  await p.page.screenshot({ path: path.join(OUT, 'screen-short-phone.png') })
  await p.ctx.close()
}

if (WHAT.has('open')) {
  const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null
  const runs = [
    ['full', { seed: 9, many: 2, ms: 9000 }],
    ['common', { seed: 1, ms: 5600 }],
    ['legendary', { seed: 2, ms: 6400 }],
    ['desk', { seed: 9, many: 2, ms: 9000, view: 'desk' }],
  ]
  for (const [name, o] of runs) {
    if (only && !only.has(name)) continue
    const dir = await captureOpening(name, o)
    if (name !== 'desk') await webp(dir, path.join(OUT, `opening-${name}.webp`))
  }
}

if (WHAT.has('fps')) {
  const out = {}
  for (const fx of ['full', 'light']) {
    const p = await open('phone', { seed: 9, fx })
    await toCrates(p.page)
    await p.page.locator('.cr-many .ct-step').last().click()
    await p.cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE ?? 4) })
    await p.page.evaluate(player, { tapGap: 320, read: 1100 })
    await p.page.locator('.pg-cta').first().click()
    await p.page.waitForSelector('.cr-open.at-summary', { timeout: 30000 })
    const f = await p.page.evaluate(() => window.__crateFrames ?? [])
    const d = await p.page.evaluate(() => window.__crateDraws ?? [])
    const s = [...f].sort((a, b) => a - b)
    const avg = f.reduce((a, b) => a + b, 0) / Math.max(1, f.length)
    out[fx] = { frames: f.length, fps: Math.round(1000 / avg), p95: Math.round(s[Math.floor(s.length * 0.95)] ?? 0), over50: f.filter((x) => x > 50).length, drawMs: +(d.reduce((a, b) => a + b, 0) / Math.max(1, d.length)).toFixed(2) }
    await p.ctx.close()
  }
  console.log(`fps (${process.env.THROTTLE ?? 4}× CPU throttle, 390×844):`, JSON.stringify(out))
  fs.writeFileSync(path.join(OUT, 'fps.json'), JSON.stringify(out, null, 1))
}
await browser.close()
