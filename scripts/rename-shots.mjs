/**
 * rename-shots — the companies' rename (Oct 2026: Easel House → Butcherblock,
 * Moonquill → Greenvial), shot in the running app for the review loop.
 *
 *   npx vite --port 5291 --strictPort &
 *   node scripts/rename-shots.mjs <outDir>
 *
 * Per view (phone 390 × 844, desk 1280 × 800): the home with each of the two
 * focused, its terms page, its first city (the liaison speaking), and the
 * Codex goblins tab. Raw screenshots only; `rename-cards.mjs` lays the cards.
 * Env: SHOT_BASE (default http://localhost:5291/).
 */
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.argv[2] ?? 'rename-shots')
const BASE = process.env.SHOT_BASE ?? 'http://localhost:5291/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import(process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs')
const VIEWS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desk: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
}
const ONLY = process.argv[3] ? process.argv[3].split(',') : null
fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})

async function seed(page) {
  await page.goto(BASE)
  await page.waitForFunction(() => !!window.__meta, null, { timeout: 30000 })
  await page.evaluate(async () => {
    localStorage.clear()
    const st = await import('/src/game/run/standing.ts')
    const ids = ['spice', 'art', 'metals', 'silk', 'scrolls']
    const lv = { spice: 4, art: 3, metals: 6, silk: 3, scrolls: 3 }
    window.__meta.setState({
      bank: 12480,
      standing: Object.fromEntries(ids.map((c) => [c, st.standingXpToReach(lv[c])])),
      stats: { ...window.__meta.getState().stats, runsCompleted: 31, runsWon: 24 },
      codex: {
        ...window.__meta.getState().codex,
        clans: ['cinder', 'smudge', 'delve', 'silkcut', 'hexmoon'],
        // Every unit studied, so each clan's tiles show their dress and names.
        felled: Object.fromEntries(['torch', 'tnt', 'barrel'].flatMap((f) => [1, 2, 3, 4, 5].map((t) => [`${f}${t}`, 40]))),
      },
    })
    const s = window.__settings.getState()
    window.__settings.setState({ taught: { ...s.taught, board: true, market: true, war: true, cashOut: true } })
  })
  await page.waitForTimeout(300)
  await page.reload()
  await page.waitForSelector('.mn-dock .mn-slot', { timeout: 30000 })
  await page.waitForFunction(() => document.querySelector('.tm-canvas.is-ready'), null, { timeout: 20000 }).catch(() => {})
}

for (const view of Object.keys(VIEWS)) {
  const ctx = await browser.newContext({ ...VIEWS[view] })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('  ! pageerror', e.message))
  const shot = async (name, wait = 900) => {
    await page.waitForTimeout(wait)
    await page.screenshot({ path: path.join(OUT, `${name}-${view}.png`) })
    console.log('  ', view, name)
  }
  await seed(page)
  for (const co of ONLY ?? ['art', 'scrolls']) {
    await page.evaluate((c) => window.__game.getState().focusRoad(c), co)
    await shot(`home-${co}`, 1600)
    // The terms.
    await page.locator('.mn-card .pg-cta, .mn-card button.pg-cta').first().click({ timeout: 8000 })
    await shot(`terms-${co}`, 1400)
    // Sign, pick, march into the opening fight, then stand in the first city.
    await page.locator('.pg-cta:visible').first().click({ timeout: 8000 })
    await page.waitForTimeout(1200)
    await page.locator('.pg-cta:visible').first().click({ timeout: 8000 })
    await page.waitForTimeout(2500)
    await page.evaluate(() => {
      const g = window.__game
      g.setState({ screen: 'map' })
      g.setState({ contract: { ...g.getState().contract, pending: 0 } })
    })
    await shot(`city-${co}`, 1600)
    await page.evaluate(() => {
      const g = window.__game
      g.setState({ contract: { ...g.getState().contract, pending: null } })
    })
    // A battle on its road (the season, the clan).
    await page.evaluate(() => window.__game.setState({ screen: 'battle' }))
    await shot(`battle-${co}`, 2200)
    await page.evaluate(() => {
      window.__game.getState().abandonRun?.()
    })
    await seed(page)
  }
  // The Codex's goblins: the clans by name.
  await page.getByRole('button', { name: /Codex/ }).first().click({ timeout: 8000 })
  await page.waitForTimeout(900)
  await page.getByRole('tab', { name: /Goblins/i }).click({ timeout: 8000 })
  await shot('codex-goblins', 1200)
  for (const name of ['Gnawbone Pack', 'Sporecap Rot']) {
    const h = page.getByText(name, { exact: true }).first()
    if (await h.count()) {
      await h.scrollIntoViewIfNeeded()
      await shot(`codex-${name.split(' ')[0].toLowerCase()}`, 600)
    }
  }
  fs.writeFileSync(path.join(OUT, `done-${view}.txt`), 'ok\n')
  await ctx.close()
}
await browser.close()
