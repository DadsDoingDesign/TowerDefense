/**
 * hq-shots — the HQ, captured from the RUNNING app (the HQ pass, Oct 2026,
 * `docs/ui-audit-2026-10/hq/`): the home bar's HQ plate and the HQ page at
 * each castle stage, on a phone and a desk.
 *
 *   npx vite --port 5231 --strictPort &
 *   node scripts/hq-shots.mjs <outDir> [p390,d1280] [only,saves]
 *
 * Each save is reached through the real controls: the save is seeded through
 * the dev handles (`window.__meta`, `window.__settings`), the page reloads, and
 * the HQ plate is tapped. Keep a round's shots in a scratch folder; commit
 * only the cards.
 *
 * Env: HQ_BASE (default http://localhost:5231/), PW_CHROMIUM.
 */
import fs from 'node:fs'
import path from 'node:path'

if (!process.argv[2]) {
  console.error('hq-shots: name an output folder (outside the repo).')
  process.exit(1)
}
const OUT = path.resolve(process.argv[2])
const ONLY_VIEWS = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3].split(',') : null
const ONLY = process.argv[4] ? new Set(process.argv[4].split(',')) : null
const BASE = process.env.HQ_BASE ?? 'http://localhost:5231/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

const loadChromium = async () => {
  for (const pkg of ['playwright', 'playwright-core', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try {
      return (await import(pkg)).chromium
    } catch {
      /* next */
    }
  }
  console.error('hq-shots: install playwright or playwright-core first.')
  process.exit(1)
}

const VIEWS = {
  p390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  p320: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  d1280: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
}

/** Saves by HQ progress: levels bought per upgrade, the bank, finished contracts. */
const SAVES = {
  // Stage 1: nothing bought yet, a bank that just opened the HQ.
  s1: { runs: 2, bank: 620, upgrades: {} },
  // Stage 2: three levels; focus not shown yet (4 runs).
  s2: { runs: 4, bank: 240, upgrades: { deal: 1, pack: 1, scouting: 1 } },
  // Stage 3: eight levels; focus open.
  s3: { runs: 9, bank: 1240, upgrades: { deal: 2, hiring: 1, pack: 2, focus: 1, scouting: 2 }, focus: 'spice' },
  // Stage 4: twelve levels.
  s4: { runs: 22, bank: 3400, upgrades: { deal: 4, hiring: 1, pack: 4, focus: 1, scouting: 2 }, focus: 'metals' },
  // Everything bought.
  max: { runs: 40, bank: 5200, upgrades: { deal: 5, hiring: 1, pack: 4, focus: 3, scouting: 2 }, focus: 'silk' },
}

fs.mkdirSync(OUT, { recursive: true })
const chromium = await loadChromium()
const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})
const want = (s) => !ONLY || ONLY.has(s)

async function open(view, save, log) {
  const ctx = await browser.newContext({ ...VIEWS[view], reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`))
  await page.goto(BASE)
  await page.waitForFunction(() => !!window.__meta, null, { timeout: 20000 })
  await page.evaluate(async (save) => {
    localStorage.clear()
    const st = await import('/src/game/run/standing.ts')
    const sk = await import('/src/game/data/skills.ts')
    const ik = await import('/src/game/data/itemKinds.ts')
    const ids = ['spice', 'art', 'metals', 'silk', 'scrolls']
    const lv = { spice: 4, art: 3, metals: 2, silk: 1, scrolls: 1 }
    window.__meta.setState({
      bank: save.bank,
      upgrades: save.upgrades,
      focus: save.focus ?? null,
      standing: Object.fromEntries(ids.map((c) => [c, st.standingXpToReach(lv[c])])),
      skills: sk.RANDOM_UNLOCK_SKILLS.slice(0, 12),
      items: ik.UNLOCK_ITEM_KINDS.slice(0, 8),
      met: ['hq', 'crates'],
      stats: { ...window.__meta.getState().stats, runsCompleted: save.runs, runsWon: save.runs },
    })
    const s = window.__settings.getState()
    window.__settings.setState({ taught: { ...s.taught, board: true, market: true, war: true, hq: true, focus: true } })
  }, save)
  await page.waitForTimeout(400)
  await page.reload()
  await page.waitForFunction(() => document.querySelector('.tm-canvas.is-ready'), null, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(700)
  return { ctx, page }
}

async function run(view) {
  const log = []
  for (const [name, save] of Object.entries(SAVES)) {
    if (!want(name)) continue
    let ctx
    try {
      const o = await open(view, save, log)
      ctx = o.ctx
      const page = o.page
      // The plate, cut from the bar.
      const plate = page.locator('.mn-place').first()
      await plate.screenshot({ path: path.join(OUT, `plate-${name}-${view}.png`) })
      await page.locator('.mn-bar').first().screenshot({ path: path.join(OUT, `bar-${name}-${view}.png`) }).catch(() => {})
      await plate.click()
      await page.waitForTimeout(1200)
      await page.screenshot({ path: path.join(OUT, `hq-${name}-${view}.png`) })
      await page.screenshot({ path: path.join(OUT, `hq-${name}-${view}-full.png`), fullPage: true })
      // Every token in the strip, when the page has one.
      const toks = page.locator('.hq-strip .pk-tok')
      const n = await toks.count()
      for (let i = 0; i < n; i++) {
        await toks.nth(i).click()
        await page.waitForTimeout(300)
        await page.screenshot({ path: path.join(OUT, `hq-${name}-${view}-tok${i}.png`) })
        const card = page.locator('.hq-up').first()
        if (await card.count()) await card.screenshot({ path: path.join(OUT, `card-${name}-${view}-tok${i}.png`) }).catch(() => {})
      }
      // Older pages: the second tab.
      const tab = page.getByRole('tab', { name: /Operations/ })
      if (await tab.count()) {
        await tab.click()
        await page.waitForTimeout(400)
        await page.screenshot({ path: path.join(OUT, `hq-${name}-${view}-ops.png`), fullPage: true })
      }
      log.push(`shot ${name}`)
    } catch (e) {
      log.push(`ERR ${name}: ${e.message.split('\n')[0].slice(0, 200)}`)
    }
    await ctx?.close()
  }
  return log
}

for (const view of Object.keys(VIEWS)) {
  if (ONLY_VIEWS && !ONLY_VIEWS.includes(view)) continue
  console.log(view, (await run(view)).join('\n  '))
}
await browser.close()
