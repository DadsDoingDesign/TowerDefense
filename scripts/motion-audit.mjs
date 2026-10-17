/**
 * motion-audit — every motion in the game, measured in the RUNNING app, per
 * company world (Oct 2026, `docs/ui-audit-2026-10/motion/AUDIT.md`).
 *
 *   npx vite --port 5227 --strictPort &
 *   node scripts/motion-audit.mjs <outDir> [what] [worlds]
 *
 * what:   comma list of home, homemodes (Light and reduced motion only), pages,
 *         battle, fps (default all but homemodes, which home includes)
 * worlds: comma list of spice, art, metals, silk, scrolls, neutral (default all)
 *
 * For each capture it records a frame sequence, then builds:
 *  - a MOTION-ENERGY HEATMAP (`<out>/heat/<capture>.png`): how often each
 *    pixel changed (frame to frame, any channel by ≥ 24), per second, over a
 *    dimmed greyscale of the first frame — cool = rare, hot = constant;
 *  - the energy per REGION (`<out>/metrics.json`): for the whole screen, the
 *    page's words (every text line box), the card, the CTA, the focused road
 *    (a 10 px band round its line), the dock, the bar, the field's edge band…
 *    `hz` = changes per pixel per second (0.5 = each pixel of it changes every
 *    two seconds), `kpx` = thousands of changed pixels a second.
 *
 * Home and pages are captured in SLOW MOTION (the CSS clock through CDP
 * `Animation.setPlaybackRate`, every JS clock — `performance.now`, the rAF
 * timestamp, `Date.now`, the timers — patched in the page, both ×0.25), so a
 * 24 fps sequence of the real motion is caught frame by frame: the worlds'
 * loop, the map's traffic, the battle's ticks and FX alike. (The worlds'
 * loop also caps its own cadence by the clock, so it is faithful too.)
 *
 * `fps` runs each state at a 4× CPU throttle (CDP
 * `Emulation.setCPUThrottlingRate`, a low-end phone) on 390 × 844 for 5 s and
 * records the frame rate, frames over 50 ms and the 95th-percentile frame —
 * for Full (the automatic step down held off), Full with the step down,
 * Light and reduced motion.
 *
 * Keep the frames out of the repo (a scratch folder); commit only a few
 * heatmaps, palette-compressed. Env: AUDIT_BASE (default
 * http://localhost:5227/), PW_CHROMIUM, AUDIT_EVAL (code run in each page once it
 * is up — an experiment, e.g. one world's layer switched off), AUDIT_TAG (a
 * suffix on every capture's name).
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const OUT = path.resolve(process.argv[2] ?? 'motion-audit-out')
const WHAT = new Set((process.argv[3] && process.argv[3] !== 'all' ? process.argv[3] : 'home,pages,battle,fps').split(','))
const WORLDS = (process.argv[4] ?? 'spice,art,metals,silk,scrolls,neutral').split(',')
const BASE = process.env.AUDIT_BASE ?? 'http://localhost:5227/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'))

const VIEW = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }
const SLOW = 0.25
const FPS = 24
const THRESH = 24

const SAVE = {
  runs: 31,
  bank: 12480,
  standing: { spice: 7, art: 4, metals: 3, silk: 2, scrolls: 5 },
  skills: 999,
  items: 999,
  season: { n: 3, contracts: 4, shares: { spice: 27, art: 14, metals: 32, silk: 11, scrolls: 16 }, deliveries: { spice: 1, art: 0, metals: 2, silk: 0, scrolls: 0 }, log: ['metals', 'spice', null, 'metals'] },
}

fs.mkdirSync(path.join(OUT, 'heat'), { recursive: true })
const metricsFile = path.join(OUT, 'metrics.json')
const metrics = fs.existsSync(metricsFile) ? JSON.parse(fs.readFileSync(metricsFile, 'utf8')) : {}
const saveMetrics = () => fs.writeFileSync(metricsFile, JSON.stringify(metrics, null, 1))
const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ------------------------------------------------------------------ states
async function open({ motion = true, fx = 'full', auto = false } = {}) {
  const ctx = await browser.newContext({ ...VIEW, reducedMotion: motion ? 'no-preference' : 'reduce' })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  await page.goto(BASE)
  await page.waitForFunction(() => !!window.__meta, null, { timeout: 20000 })
  await page.evaluate(async (save) => {
    localStorage.clear()
    const st = await import('/src/game/run/standing.ts')
    const sk = await import('/src/game/data/skills.ts')
    const ik = await import('/src/game/data/itemKinds.ts')
    const tw = await import('/src/game/run/tradeWar.ts')
    const ids = ['spice', 'art', 'metals', 'silk', 'scrolls']
    window.__meta.setState({
      bank: save.bank,
      standing: Object.fromEntries(ids.map((c) => [c, st.standingXpToReach(save.standing[c] ?? 0)])),
      skills: sk.RANDOM_UNLOCK_SKILLS.slice(0, save.skills),
      items: ik.UNLOCK_ITEM_KINDS.slice(0, save.items),
      militia: { name: 'The Lantern Guard', shape: 'swallow', tincture: 'crimson', charge: 'keep', pattern: 'plain', tincture2: 'sable', metal: 'gold' },
      season: { ...tw.freshSeason(), ...save.season },
      stats: { ...window.__meta.getState().stats, runsCompleted: save.runs, runsWon: save.runs },
    })
    const s = window.__settings.getState()
    window.__settings.setState({ taught: { ...s.taught, board: true, market: true, war: true } })
  }, SAVE)
  await page.waitForTimeout(300)
  await page.reload()
  await page.waitForFunction(() => document.querySelector('.tm-canvas.is-ready'), null, { timeout: 20000 })
  await page.evaluate(
    ({ fx, auto }) => {
      window.__settings.getState().setEffects?.(fx)
      window.__fxQuality?.setFxAuto(auto)
    },
    { fx, auto },
  )
  // An experiment's hook: code run in the page once it is up (e.g. one layer off).
  if (process.env.AUDIT_EVAL) await page.evaluate(process.env.AUDIT_EVAL)
  await page.waitForTimeout(1500)
  const cdp = await ctx.newCDPSession(page)
  return { ctx, page, cdp, errs }
}

const focus = (page, f) => page.evaluate((f) => window.__game.getState().focusRoad(f), f)
const homeFocusOf = (w) => (w === 'neutral' ? 'charter' : w)

/** Hold the house look on a run's screens ("neutral": Peppercorn's contract, the theme held off). */
async function holdNeutral(page) {
  await page.evaluate(() => {
    const root = document.documentElement
    const hold = () => root.dataset.coTheme && delete root.dataset.coTheme
    new MutationObserver(hold).observe(root, { attributes: true, attributeFilter: ['data-co-theme'] })
    hold()
    window.__worldFx?.setTheme('neutral')
  })
}

// ---------------------------------------------------------------- regions
/** The regions a capture is scored on, in CSS px, measured in the page. */
const measureRegions = () => {
  const box = (e) => {
    const b = e.getBoundingClientRect()
    return [b.left, b.top, b.width, b.height]
  }
  const vis = (e) => {
    const b = e.getBoundingClientRect()
    return b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight
  }
  const all = (sel) => Array.from(document.querySelectorAll(sel)).filter(vis).map(box)
  const text = []
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  for (let n = walk.nextNode(); n && text.length < 900; n = walk.nextNode()) {
    if (!n.textContent?.trim()) continue
    const el = n.parentElement
    if (el && getComputedStyle(el).visibility === 'hidden') continue
    range.selectNodeContents(n)
    for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0 && r.height < 80 && r.bottom > 0 && r.top < innerHeight) text.push([r.left, r.top, r.width, r.height])
  }
  const road = []
  const svg = document.querySelector('.tm-leaders[data-road]')
  if (svg) {
    const b = svg.getBoundingClientRect()
    for (const pt of (svg.dataset.road ?? '').split(' ')) {
      const [x, y] = pt.split(',').map(Number)
      if (Number.isFinite(x) && Number.isFinite(y)) road.push([b.left + x, b.top + y])
    }
  }
  const stage = document.querySelector('.battle-canvas')
  const st = stage && vis(stage) ? box(stage) : null
  return {
    text,
    road,
    card: all('.mn-card, .pk-card'),
    cta: all('.pg-cta:not(.quiet), .mn-cta'),
    dock: all('.mn-dock'),
    bar: all('.mn-bar, .pg-head, .sh-header'),
    panels: all('.mn-season, .pg-row, .tk-card, .cx-tile, .ct-route, .ct-mode, .hq-card, .pk-tok'),
    signs: all('.tm-label'),
    stage: st ? [st] : [],
    edge: st ? [[st[0], st[1], st[2], 26], [st[0], st[1] + st[3] - 26, st[2], 26], [st[0], st[1], 26, st[3]], [st[0] + st[2] - 26, st[1], 26, st[3]]] : [],
    detail: all('.sh-detail, .sh-setupbar, .sh-live'),
  }
}

function maskOf(w, h, rects) {
  const m = new Uint8Array(w * h)
  for (const [x, y, rw, rh] of rects) {
    const x0 = Math.max(0, Math.floor(x))
    const y0 = Math.max(0, Math.floor(y))
    const x1 = Math.min(w, Math.ceil(x + rw))
    const y1 = Math.min(h, Math.ceil(y + rh))
    for (let yy = y0; yy < y1; yy++) m.fill(1, yy * w + x0, yy * w + x1)
  }
  return m
}
function roadMask(w, h, pts, r = 10) {
  const m = new Uint8Array(w * h)
  if (pts.length < 2) return m
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]
    const [bx, by] = pts[i]
    const len = Math.hypot(bx - ax, by - ay)
    for (let s = 0; s <= len; s += 2) {
      const cx = ax + ((bx - ax) * s) / (len || 1)
      const cy = ay + ((by - ay) * s) / (len || 1)
      for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(h, cy + r); y++)
        for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(w, cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) m[y * w + x] = 1
    }
  }
  return m
}

// ---------------------------------------------------------------- capture
/** Slow both clocks (CSS through CDP, the worlds' loop through its time scale). */
async function slow(p, rate) {
  await p.cdp.send('Animation.enable').catch(() => {})
  await p.cdp.send('Animation.setPlaybackRate', { playbackRate: rate }).catch(() => {})
  // Every JS clock the page reads — performance.now, the rAF timestamp,
  // Date.now and the timers' delays — runs at `rate` from here on, continuous
  // with what came before: the worlds' loop, the map's traffic and its focus
  // fade, the battle's ticks and FX, the toasts' timers.
  await p.page.evaluate((r) => {
    if (window.__slowed) return
    window.__slowed = r
    const perf = performance.now.bind(performance)
    const p0 = perf()
    const now = () => p0 + (perf() - p0) * r
    performance.now = now
    const raf = window.requestAnimationFrame.bind(window)
    // The frame's own timestamp is not used: under a capture's screenshots a
    // headless frame's timestamp runs behind the wall clock, so the loops
    // would play slower than the clock the capture keeps.
    window.requestAnimationFrame = (cb) => raf(() => cb(now()))
    const date = Date.now
    const d0 = date()
    Date.now = () => d0 + (date() - d0) * r
    const st = window.setTimeout.bind(window)
    window.setTimeout = (fn, ms, ...a) => st(fn, (ms ?? 0) / r, ...a)
    const si = window.setInterval.bind(window)
    window.setInterval = (fn, ms, ...a) => si(fn, (ms ?? 0) / r, ...a)
  }, rate)
}

/**
 * `n` frames at `fps` of world time: at `rate` (slow motion) each is taken
 * 1 / (fps · rate) s of real time apart. `during(i)` runs before frame i.
 */
async function capture(p, name, n, { rate = SLOW, fps = FPS, during } = {}) {
  name += process.env.AUDIT_TAG ?? ''
  const dir = path.join(OUT, 'frames', name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const gap = 1000 / (fps * rate)
  const times = []
  const trace = []
  const t0 = Date.now()
  for (let i = 0; i < n; i++) {
    if (during) await during(i)
    const due = t0 + i * gap
    const wait = due - Date.now()
    if (wait > 0) await sleep(wait)
    times.push((Date.now() - t0) * rate)
    await p.page.screenshot({ path: path.join(dir, `f${String(i).padStart(3, '0')}.png`) })
    if (process.env.AUDIT_TRACE) trace.push(await p.page.evaluate(process.env.AUDIT_TRACE))
  }
  if (trace.length) console.log(`  trace ${name}: ${trace.join(' ')}`)
  const regions = await p.page.evaluate(measureRegions)
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ times, regions }))
  return analyse(name)
}

/** Real-time capture (the battle): as fast as screenshots go. */
async function captureLive(p, name, ms) {
  const dir = path.join(OUT, 'frames', name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const times = []
  const t0 = Date.now()
  for (let i = 0; Date.now() - t0 < ms; i++) {
    times.push(Date.now() - t0)
    await p.page.screenshot({ path: path.join(dir, `f${String(i).padStart(3, '0')}.png`) })
  }
  const regions = await p.page.evaluate(measureRegions)
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ times, regions }))
  return analyse(name)
}

// ---------------------------------------------------------------- analysis
async function raw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, w: info.width, h: info.height }
}

const ramp = (k) => {
  // dark blue → violet → orange → yellow → white
  const stops = [
    [0, [20, 20, 70]],
    [0.25, [120, 30, 160]],
    [0.5, [230, 80, 40]],
    [0.75, [255, 200, 40]],
    [1, [255, 255, 255]],
  ]
  for (let i = 1; i < stops.length; i++)
    if (k <= stops[i][0]) {
      const [a, ca] = stops[i - 1]
      const [b, cb] = stops[i]
      const t = (k - a) / (b - a)
      return ca.map((c, j) => c + (cb[j] - c) * t)
    }
  return [255, 255, 255]
}

async function analyse(name) {
  const dir = path.join(OUT, 'frames', name)
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'))
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort()
  if (files.length < 2) return null
  const first = await raw(path.join(dir, files[0]))
  const { w, h } = first
  const count = new Float32Array(w * h)
  let prev = first.data
  for (let i = 1; i < files.length; i++) {
    const cur = (await raw(path.join(dir, files[i]))).data
    for (let p = 0, q = 0; p < w * h; p++, q += 4) {
      const d = Math.max(Math.abs(cur[q] - prev[q]), Math.abs(cur[q + 1] - prev[q + 1]), Math.abs(cur[q + 2] - prev[q + 2]))
      if (d >= THRESH) count[p]++
    }
    prev = cur
  }
  const secs = (meta.times[meta.times.length - 1] - meta.times[0]) / 1000
  const R = meta.regions
  const masks = {
    screen: new Uint8Array(w * h).fill(1),
    text: maskOf(w, h, R.text),
    card: maskOf(w, h, R.card),
    cta: maskOf(w, h, R.cta),
    road: roadMask(w, h, R.road),
    dock: maskOf(w, h, R.dock),
    bar: maskOf(w, h, R.bar),
    panels: maskOf(w, h, R.panels),
    signs: maskOf(w, h, R.signs),
    stage: maskOf(w, h, R.stage),
    edge: maskOf(w, h, R.edge),
    detail: maskOf(w, h, R.detail),
  }
  const out = { frames: files.length, secs: +secs.toFixed(2), fps: +((files.length - 1) / secs).toFixed(1), regions: {} }
  for (const [k, m] of Object.entries(masks)) {
    let area = 0
    let sum = 0
    for (let p = 0; p < w * h; p++)
      if (m[p]) {
        area++
        sum += count[p]
      }
    if (!area) continue
    out.regions[k] = { hz: +(sum / area / secs).toFixed(3), kpx: +(sum / secs / 1000).toFixed(1), area }
  }
  // The heatmap: a dimmed greyscale of the first frame, and how often each
  // pixel changed per second over it (log scale, 0.1 Hz → 12 Hz).
  const img = Buffer.alloc(w * h * 3)
  for (let p = 0, q = 0; p < w * h; p++, q += 4) {
    const hz = count[p] / secs
    const g = (first.data[q] * 0.3 + first.data[q + 1] * 0.59 + first.data[q + 2] * 0.11) * 0.32
    if (hz < 0.1) {
      img[p * 3] = img[p * 3 + 1] = img[p * 3 + 2] = g
      continue
    }
    const k = Math.min(1, Math.log(hz / 0.1) / Math.log(120))
    const c = ramp(k)
    const a = 0.45 + 0.55 * k
    for (let j = 0; j < 3; j++) img[p * 3 + j] = g * (1 - a) + c[j] * a
  }
  await sharp(img, { raw: { width: w, height: h, channels: 3 } }).png({ palette: true, colors: 64 }).toFile(path.join(OUT, 'heat', `${name}.png`))
  metrics[name] = { ...(metrics[name] ?? {}), ...out }
  saveMetrics()
  const r = out.regions
  const f = (k) => (r[k] ? `${k} ${r[k].hz}` : '')
  console.log(`${name}: ${out.frames} frames, ${out.fps} fps | ${['screen', 'text', 'card', 'cta', 'road', 'dock', 'bar', 'signs', 'stage', 'edge', 'detail'].map(f).filter(Boolean).join(' · ')}`)
  return out
}

// ---------------------------------------------------------------- frame rate
async function frameRate(p, ms = 5000) {
  await p.cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await sleep(1200)
  const d = await p.page.evaluate(
    (ms) =>
      new Promise((res) => {
        const out = []
        let last = performance.now()
        const t0 = last
        const f = (now) => {
          out.push(now - last)
          last = now
          if (now - t0 < ms) requestAnimationFrame(f)
          else res(out)
        }
        requestAnimationFrame(f)
      }),
    ms,
  )
  const level = await p.page.evaluate(() => document.documentElement.dataset.fx)
  await p.cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  const total = d.reduce((a, b) => a + b, 0)
  const sorted = [...d].sort((a, b) => a - b)
  return { fps: +((d.length / total) * 1000).toFixed(1), long: d.filter((x) => x > 50).length, p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1), level }
}

// ---------------------------------------------------------------- the run
async function toBattle(p, world) {
  await focus(p.page, world === 'neutral' ? 'spice' : world)
  await p.page.waitForTimeout(600)
  const cta = async (wait) => {
    await p.page.locator('.pg-cta:visible, .mn-cta:visible').first().click({ timeout: 8000 })
    await p.page.waitForTimeout(wait)
  }
  await cta(1500) // home → terms
  await cta(1500) // sign → pick
  await cta(2500) // march → the opening fight
  if (world === 'neutral') await holdNeutral(p.page)
  const post = (at) =>
    p.page.evaluate((at) => {
      const g = window.__game
      const s = g.getState()
      const hero = s.roster[0]
      const free = s.battleMap.slots.filter((sl) => !Object.values(s.placements).includes(sl.id) && !s.placements[sl.id])
      const slot = free[Math.floor(free.length * at)] ?? s.battleMap.slots[0]
      g.setState({ selectedSentinelId: hero.id })
      g.getState().placeOnSlot(slot.id)
    }, at)
  const startWave = () => p.page.getByRole('button', { name: /Start Wave/ }).first().click({ timeout: 5000 })
  // The opening fight is a handful of raiders: won by emptying its queue
  // (as run-shots does), the spoils taken, then the next fight — 19 raiders.
  await post(1 / 3)
  await p.page.waitForTimeout(300)
  await startWave()
  await p.page.waitForTimeout(1500)
  await p.page.evaluate(() => {
    const e = window.__game.getState().engine
    if (!e) return
    e.spawnIndex = e.spawnQueue.length
    e.enemies = []
    e.projectiles = []
    e.pendingSpawns = []
    e.breather = null
  })
  await p.page.waitForTimeout(1200)
  await p.page.evaluate(() => window.__game.getState().skipWaveBeat())
  await p.page.waitForTimeout(1500)
  await p.page.evaluate(() => {
    const g = window.__game
    const r = g.getState().reward
    if (r?.length) g.getState().chooseReward(r[0].id)
  })
  await p.page.waitForTimeout(1600)
  await p.page.evaluate(() => {
    const g = window.__game
    const s = g.getState()
    const n = s.reachableNodeIds.map((id) => s.runMap.nodes.find((x) => x.id === id)).find((x) => x && (x.type === 'battle' || x.type === 'elite'))
    if (n) g.getState().selectNode(n.id)
  })
  await p.page.waitForTimeout(1500)
  await p.page.getByRole('button', { name: /^March|Fight/ }).first().click({ timeout: 2000 }).catch(() => {})
  await p.page.waitForTimeout(1500)
  if (world === 'neutral') await holdNeutral(p.page)
  await post(0.5)
  await p.page.waitForTimeout(300)
  await startWave().catch(async (e) => {
    const where = await p.page.evaluate(() => {
      const s = window.__game.getState()
      return `${s.screen} ${s.battlePhase ?? ''} reward=${s.reward?.length ?? 0}`
    })
    throw new Error(`no Start Wave (${where}): ${e.message.split('\n')[0]}`)
  })
  // Wait for the road to fill.
  await p.page.waitForFunction(() => (window.__game.getState().engine?.enemies?.length ?? 0) >= 8, null, { timeout: 30000 }).catch(() => {})
  await p.page.waitForTimeout(500)
}

const results = { fps: metrics.__fps ?? {} }

if (WHAT.has('home')) {
  const p = await open()
  await slow(p, SLOW)
  // Start from another focus, so each world's switch-in plays.
  for (const w of WORLDS) {
    await focus(p.page, w === 'spice' ? 'art' : 'spice')
    await sleep(2500 / SLOW)
    await capture(p, `home-${w}-switch`, 30, { during: (i) => (i === 1 ? focus(p.page, homeFocusOf(w)) : null) })
    await sleep(800 / SLOW)
    await capture(p, `home-${w}`, 72)
    const tag = `home-${w}${process.env.AUDIT_TAG ?? ''}`
    metrics[tag].particles = await p.page.evaluate(() => window.__worldFx.count().ambient)
    if (process.env.AUDIT_DEBUG) console.log(await p.page.evaluate(process.env.AUDIT_DEBUG))
    saveMetrics()
    console.log(`  ${tag}: ${metrics[tag].particles} ambient particles`)
    await capture(p, `home-${w}-press`, 26, {
      during: (i) =>
        i === 1
          ? p.page.evaluate(() => {
              const b = document.querySelector('.mn-cta').getBoundingClientRect()
              window.__worldFx.burst(b.left + b.width * 0.7, b.top + b.height / 2, b)
            })
          : null,
    })
  }
  await p.ctx.close()
}
if (WHAT.has('home') || WHAT.has('homemodes')) {
  // Light and reduced motion on Peppercorn and Ironvein, the busiest.
  for (const [tag, opts] of [['light', { fx: 'light' }], ['reduced', { motion: false }]]) {
    const q = await open(opts)
    await slow(q, SLOW)
    for (const w of ['spice', 'metals']) {
      await focus(q.page, w)
      await sleep(2500 / SLOW)
      await capture(q, `home-${w}-${tag}`, 48)
    }
    await q.ctx.close()
  }
}

if (WHAT.has('pages')) {
  for (const w of WORLDS) {
    const p = await open()
    await focus(p.page, homeFocusOf(w))
    await p.page.waitForTimeout(800)
    await slow(p, SLOW)
    if (w !== 'neutral') {
      // The terms (and its CTA), then the hero pick (the pick card).
      await p.page.locator('.mn-cta').click()
      await sleep(1500 / SLOW)
      await capture(p, `page-${w}-terms`, 48)
      await p.page.locator('.pg-cta:visible').first().click()
      await sleep(1500 / SLOW)
      await capture(p, `page-${w}-pick`, 48)
    } else {
      await p.page.locator('.mn-cta').click()
      await sleep(1500 / SLOW)
      await capture(p, `page-${w}-charter`, 48)
    }
    await p.ctx.close()
    if (['spice', 'scrolls', 'neutral'].includes(w)) {
      for (const [name, re] of [['codex', /^Codex/], ['settings', /^Settings/], ['hq', /^(HQ|Headquarters)/]]) {
        const q = await open()
        await focus(q.page, homeFocusOf(w))
        await q.page.waitForTimeout(800)
        await q.page.getByRole('button', { name: re }).first().click({ timeout: 6000 }).catch(() => {})
        await slow(q, SLOW)
        await sleep(1500 / SLOW)
        await capture(q, `page-${w}-${name}`, 48)
        await q.ctx.close()
      }
    }
  }
}

if (WHAT.has('battle')) {
  for (const w of WORLDS) {
    const p = await open()
    try {
      await toBattle(p, w)
      await slow(p, SLOW)
      await capture(p, `battle-${w}`, 72)
      const live = await p.page.evaluate(() => ({ enemies: window.__game.getState().engine?.enemies?.length, weather: window.__weather ? { w: window.__weather.weather.count, e: window.__weather.edge.parts?.length ?? window.__weather.edge.count } : null }))
      metrics[`battle-${w}`].live = live
      saveMetrics()
    } catch (e) {
      console.log(`battle-${w}: ${e.message.split('\n')[0]}`)
    }
    await p.ctx.close()
  }
  for (const [tag, opts] of [['light', { fx: 'light' }], ['reduced', { motion: false }]]) {
    const p = await open(opts)
    try {
      await toBattle(p, 'scrolls')
      await slow(p, SLOW)
      await capture(p, `battle-scrolls-${tag}`, 48)
    } catch (e) {
      console.log(`battle-${tag}: ${e.message.split('\n')[0]}`)
    }
    await p.ctx.close()
  }
}

if (WHAT.has('fps')) {
  const fps = (results.fps = {})
  for (const [tag, opts] of [['full', { fx: 'full' }], ['light', { fx: 'light' }]]) {
    const p = await open(opts)
    for (const w of WORLDS) {
      await focus(p.page, homeFocusOf(w))
      await p.page.waitForTimeout(1500)
      fps[`home-${w}-${tag}`] = await frameRate(p)
      console.log(`fps home-${w}-${tag}`, fps[`home-${w}-${tag}`])
    }
    await p.ctx.close()
  }
  for (const [tag, opts] of [['auto', { auto: true }], ['reduced', { motion: false }]]) {
    const p = await open(opts)
    for (const w of ['spice', 'metals']) {
      await focus(p.page, w)
      await p.page.waitForTimeout(1500)
      fps[`home-${w}-${tag}`] = await frameRate(p, 8000)
      console.log(`fps home-${w}-${tag}`, fps[`home-${w}-${tag}`])
    }
    await p.ctx.close()
  }
  for (const w of ['spice', 'scrolls']) {
    const p = await open()
    await focus(p.page, w)
    await p.page.waitForTimeout(800)
    await p.page.locator('.mn-cta').click()
    await p.page.waitForTimeout(1500)
    fps[`page-${w}-terms-full`] = await frameRate(p)
    console.log(`fps page-${w}-terms-full`, fps[`page-${w}-terms-full`])
    await p.ctx.close()
  }
  for (const [tag, opts] of [['full', {}], ['light', { fx: 'light' }], ['reduced', { motion: false }]]) {
    for (const w of tag === 'full' ? ['spice', 'scrolls', 'neutral'] : ['scrolls']) {
      const p = await open(opts)
      try {
        await toBattle(p, w)
        fps[`battle-${w}-${tag}`] = await frameRate(p)
        console.log(`fps battle-${w}-${tag}`, fps[`battle-${w}-${tag}`])
      } catch (e) {
        console.log(`fps battle-${w}-${tag}: ${e.message.split('\n')[0]}`)
      }
      await p.ctx.close()
    }
  }
  metrics.__fps = { ...(metrics.__fps ?? {}), ...fps }
  saveMetrics()
}

await browser.close()
console.log(`metrics: ${metricsFile}`)
