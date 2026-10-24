/**
 * places-shots — the PLACES, captured from the RUNNING app for the asset
 * critique (Oct 2026, `docs/ui-audit-2026-10/asset-critique/places/`): the four
 * stops (the merchant's stall with a ware held up, the campfire, the shrine, a
 * city's hiring yard) and the five companies' posts heading a city's page.
 *
 *   npx vite --port 5253 --strictPort &
 *   node scripts/places-shots.mjs <outDir> [views]
 *
 * views: comma list of p390,d1280 (default both). The run is Peppercorn's
 * contract; a stop is entered by making its node the next reachable one, the
 * hiring yard by setting the city's Crossroads (`citySlate`, as the boss's win
 * does) at the node whose line is the sergeant's longest, and each city by
 * setting the contract's company and its pending city (named shortcuts:
 * nothing is drawn that the real flow does not draw).
 *
 * Keep the round's capture out of the repo (a scratch folder); the review
 * cards cite a few, cropped.
 *
 * Math.random and the clock are fixed in the page, so a run deals the same wares, hires and
 * lines every capture: a before and an after differ in the art alone.
 *
 * Env: SHOTS_BASE (default http://127.0.0.1:5253/), PW_CHROMIUM, SHOTS_DPR
 * (the device pixel ratio, default 1; the review cards shoot at 1.5).
 */
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.argv[2] ?? 'places-shots')
const VIEW_ARG = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3].split(',') : null
const BASE = process.env.SHOTS_BASE ?? 'http://127.0.0.1:5253/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'))

const DPR = Number(process.env.SHOTS_DPR ?? 1)
const VIEWS = {
  p390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true },
  d1280: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: DPR },
}
const COMPANIES = ['spice', 'art', 'metals', 'silk', 'scrolls']

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})

async function seed(page, tries = 3) {
  try {
    await seedOnce(page)
  } catch (e) {
    if (tries <= 1) throw e
    await seed(page, tries - 1)
  }
}

async function seedOnce(page) {
  await page.goto(BASE)
  await page.waitForFunction(() => !!window.__meta, null, { timeout: 30000 })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(async () => {
    localStorage.clear()
    const st = await import('/src/game/run/standing.ts')
    window.__meta.setState({
      bank: 1240,
      standing: { spice: st.standingXpToReach(3), art: st.standingXpToReach(2), metals: st.standingXpToReach(2), silk: st.standingXpToReach(1), scrolls: st.standingXpToReach(1) },
      stats: { ...window.__meta.getState().stats, runsCompleted: 6, runsWon: 4 },
    })
    const s = window.__settings.getState()
    window.__settings.setState({ taught: { ...s.taught, board: true, market: true, war: true, cashOut: true }, showEverything: true })
  })
  await page.waitForTimeout(400)
  await page.reload()
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 })
  await page.waitForTimeout(900)
  await page.evaluate(() => window.__game.getState().focusRoad('spice'))
  await page.waitForTimeout(400)
}

const cta = async (page, wait = 1500) => {
  await page.locator('.pg-cta:visible').first().click({ timeout: 8000 })
  await page.waitForTimeout(wait)
}

for (const view of VIEW_ARG ?? Object.keys(VIEWS)) {
  const ctx = await browser.newContext({ ...VIEWS[view], reducedMotion: 'reduce' })
  await ctx.addInitScript(() => {
    let s = 20261018
    Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
    // A run seed also hashes the clock (`rng.newRunSeed`): hold it still. The
    // shots are stills under reduced motion, so nothing needs it to move.
    const t = 1760000000000
    Date.now = () => t
    performance.now = () => 1000
  })
  const page = await ctx.newPage()
  const log = []
  page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`))
  const boxes = {}
  const shot = async (name) => {
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(OUT, `${name}-${view}.png`) })
    // Where the scene, its sign and its bubble landed: the critique checks
    // that they never collide, and the cards crop the scene by it.
    boxes[name] = await page.evaluate(() => {
      const b = (sel) => {
        const e = document.querySelector(sel)
        if (!e) return null
        const q = e.getBoundingClientRect()
        return [Math.round(q.x), Math.round(q.y), Math.round(q.width), Math.round(q.height)]
      }
      return { scene: b('.stop-scene'), bubble: b('.ss-bubble'), sign: b('.t-title, .ct-sign') }
    })
    log.push(name)
  }
  const st = (fn, arg) => page.evaluate(fn, arg)
  await seed(page)
  await cta(page) // home → terms
  await cta(page) // sign → pick
  await cta(page, 2500) // march → the opening fight

  for (const type of ['merchant', 'campfire', 'shrine']) {
    await st(() => window.__game.setState({ screen: 'map' }))
    const ok = await st((type) => {
      const g = window.__game
      const s = g.getState()
      const n = s.runMap.nodes.find((x) => x.type === type && !s.clearedNodeIds.includes(x.id))
      if (!n) return false
      g.setState({ reachableNodeIds: [n.id], event: null, merchant: null, shrineOffer: null })
      g.getState().selectNode(n.id)
      return true
    }, type)
    await page.waitForTimeout(1500)
    if (!ok) {
      log.push(`no ${type}`)
      continue
    }
    if (type === 'merchant') await page.locator('.shop-wares button').nth(1).click({ timeout: 2000 }).catch(() => {})
    await shot(type)
    await st(() => window.__game.getState().leaveEvent())
    await page.waitForTimeout(800)
  }

  // A city's hiring yard: the Crossroads a boss's win sets.
  await st(async () => {
    const g = window.__game
    const { citySlate } = await import('/src/game/run/recruits.ts')
    const { recruitHub } = await import('/src/state/game/runtime.ts')
    const { stopLine } = await import('/src/ui/shell/stopScene.ts')
    const s = g.getState()
    // The sergeant's line that wraps to three lines (it is fixed per node):
    // the bubble's worst case, the one that once ran off the scene's top.
    const worst = (id) => (stopLine('recruit', id).startsWith('“Blades') ? 100 : stopLine('recruit', id).length)
    const node = [...s.runMap.nodes].sort((a, b) => worst(b.id) - worst(a.id))[0]
    g.setState({
      currentNodeId: node.id,
      screen: 'crossroads',
      crossroads: { recruits: citySlate(s.runSeed, 0, s.roster, recruitHub(s.relics)), mutations: [], mutationHeroId: null },
    })
  })
  await page.waitForTimeout(1500)
  await shot('recruit')
  await st(() => window.__game.setState({ crossroads: null, screen: 'map' }))

  // Each company's post, heading its first city.
  for (const co of COMPANIES) {
    await st((co) => {
      const g = window.__game
      const c = g.getState().contract
      g.setState({ contract: { ...c, company: co, pending: 0 } })
    }, co)
    await page.waitForTimeout(1500)
    await shot(`liaison-${co}`)
    await st(() => {
      const g = window.__game
      g.setState({ contract: { ...g.getState().contract, pending: null } })
    })
  }
  fs.writeFileSync(path.join(OUT, `log-${view}.txt`), log.join('\n') + '\n')
  fs.writeFileSync(path.join(OUT, `boxes-${view}.json`), JSON.stringify(boxes, null, 1))
  for (const [name, b] of Object.entries(boxes)) {
    const hit = b.bubble && b.sign && b.bubble[0] < b.sign[0] + b.sign[2] && b.sign[0] < b.bubble[0] + b.bubble[2] && b.bubble[1] < b.sign[1] + b.sign[3] && b.sign[1] < b.bubble[1] + b.bubble[3]
    const cut = b.bubble && b.scene && (b.bubble[1] < b.scene[1] || b.bubble[0] < b.scene[0] || b.bubble[0] + b.bubble[2] > b.scene[0] + b.scene[2])
    if (hit || cut) console.log(`  ${view} ${name}: bubble ${hit ? 'over the sign' : ''}${cut ? ' cut by the scene' : ''}`)
  }
  console.log(`${view}: ${log.join(' | ')}`)
  await ctx.close()
}
await browser.close()
