/**
 * run-shots — the run's UI, captured from the RUNNING app for the job critique
 * (Oct 2026, `docs/ui-audit-2026-10/job-critique/run/`): the run map, the
 * battle shell in setup and live (HUD, wave preview, party, hero card, Gear |
 * Pack, Team, Upgrade and the owed skill, the setup bar, the live strip, the
 * spoils hand), the stops (merchant, campfire, shrine, a city's payout and its
 * hiring yard) and the ceremony on the Stage.
 *
 *   npx vite --port 5213 --strictPort &
 *   node scripts/run-shots.mjs <outDir> [views] [themes] [only,screens]
 *
 * views: comma list of p390,p375,p320,d1280 (default all); themes: comma list
 * of neutral,spice,metals,silk,art (default neutral). Each state is reached
 * through the real store and controls (the dev handles in `src/main.tsx`); the
 * shortcuts are named: a hero is raised to level 5 to owe a skill, the pack is
 * filled with generated items, five relics (one a pact) are granted, a fight is
 * won or lost by emptying its queue or its wagon, and a stop is entered by
 * making its node the next reachable one. "neutral" runs Peppercorn's contract
 * with the house look forced on (the theme attribute held off the root).
 *
 * Keep a round's full capture out of the repo (put <outDir> in a scratch
 * folder) and commit only the few before/after shots a review cites,
 * palette-compressed.
 *
 * Env: SHOTS_BASE (default http://127.0.0.1:5213/), PW_CHROMIUM.
 */
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.argv[2] ?? 'docs/ui-audit-2026-10/job-critique/run/shots')
const VIEW_ARG = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3].split(',') : null
const THEMES = process.argv[4] ? process.argv[4].split(',') : ['neutral']
const ONLY = process.argv[5] ? new Set(process.argv[5].split(',')) : null
const BASE = process.env.SHOTS_BASE ?? 'http://127.0.0.1:5213/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'))

const VIEWS = {
  p390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  p375: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  p320: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  d1280: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
}

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})
const want = (s) => !ONLY || ONLY.has(s)

async function seed(page, theme, tries = 2) {
  await page.goto(BASE)
  await page.waitForFunction(() => !!window.__meta, null, { timeout: 20000 })
  await page.waitForLoadState('networkidle').catch(() => {})
  try {
    await seedMeta(page)
  } catch (e) {
    if (tries <= 1) throw e
    return seed(page, theme, tries - 1)
  }
  await finishSeed(page, theme)
}

async function seedMeta(page) {
  await page.evaluate(async () => {
    localStorage.clear()
    const st = await import('/src/game/run/standing.ts')
    const sk = await import('/src/game/data/skills.ts')
    const ik = await import('/src/game/data/itemKinds.ts')
    const tw = await import('/src/game/run/tradeWar.ts')
    window.__meta.setState({
      bank: 1240,
      standing: { spice: st.standingXpToReach(3), art: st.standingXpToReach(2), metals: st.standingXpToReach(2), silk: st.standingXpToReach(1), scrolls: 0 },
      skills: sk.RANDOM_UNLOCK_SKILLS.slice(0, 12),
      items: ik.UNLOCK_ITEM_KINDS.slice(0, 8),
      season: { ...tw.freshSeason(), n: 1, contracts: 3, deliveries: { spice: 2, art: 0, metals: 0, silk: 0, scrolls: 0 }, log: ['spice', null, 'spice'] },
      stats: { ...window.__meta.getState().stats, runsCompleted: 6, runsWon: 4 },
    })
    const s = window.__settings.getState()
    // Coach tips stay on: they are part of the run's UI under review.
    window.__settings.setState({ taught: { ...s.taught, board: true, market: true, war: true }, showEverything: true })
  })
}

async function finishSeed(page, theme) {
  await page.waitForTimeout(400)
  await page.reload()
  await page.waitForFunction(() => !!window.__game, null, { timeout: 20000 })
  await page.waitForTimeout(900)
  const company = theme === 'neutral' ? 'spice' : theme
  await page.evaluate((c) => window.__game.getState().focusRoad(c), company)
  if (theme === 'neutral')
    await page.evaluate(() => {
      const root = document.documentElement
      const hold = () => root.dataset.coTheme && delete root.dataset.coTheme
      new MutationObserver(hold).observe(root, { attributes: true, attributeFilter: ['data-co-theme'] })
      hold()
    })
  await page.waitForTimeout(400)
}

async function open(view, theme, log) {
  const ctx = await browser.newContext({ ...VIEWS[view], reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`))
  const shot = async (name) => {
    if (!want(name)) return
    await page.waitForTimeout(450)
    await page.screenshot({ path: path.join(OUT, `${name}-${view}-${theme}.png`) })
    log.push(`shot ${name}`)
  }
  const st = (fn, arg) => page.evaluate(fn, arg)
  await seed(page, theme)
  return { ctx, page, shot, st }
}

const cta = async (p, wait = 1500) => {
  await p.page.locator('.pg-cta:visible').first().click({ timeout: 8000 })
  await p.page.waitForTimeout(wait)
}

async function toBattle(p) {
  await cta(p) // home → terms
  await cta(p) // sign → pick
  await cta(p, 2500) // march → the opening fight
}

async function post(p, i = 0, at = 1 / 3) {
  await p.st(
    ({ i, at }) => {
      const g = window.__game
      const s = g.getState()
      const hero = s.roster[i]
      if (!hero) return
      const free = s.battleMap.slots.filter((sl) => !Object.values(s.placements).includes(sl.id) && !s.placements[sl.id])
      const slot = free[Math.floor(free.length * at)] ?? s.battleMap.slots[0]
      g.setState({ selectedSentinelId: hero.id })
      g.getState().placeOnSlot(slot.id)
    },
    { i, at },
  )
  await p.page.waitForTimeout(300)
}

async function startWave(p, wait = 2600) {
  await p.page.getByRole('button', { name: /Start Wave/ }).first().click({ timeout: 5000 }).catch(() => {})
  await p.page.waitForTimeout(wait)
}

async function forceClear(p) {
  await p.st(() => {
    const e = window.__game.getState().engine
    if (!e) return
    e.spawnIndex = e.spawnQueue.length
    e.enemies = []
    e.projectiles = []
    e.pendingSpawns = []
    e.breather = null
  })
  await p.page.waitForTimeout(1200)
}

async function enterStop(p, type) {
  return p.st((type) => {
    const g = window.__game
    const s = g.getState()
    const n = s.runMap.nodes.find((x) => x.type === type && !s.clearedNodeIds.includes(x.id))
    if (!n) return false
    g.setState({ reachableNodeIds: [n.id], event: null, merchant: null, shrineOffer: null })
    g.getState().selectNode(n.id)
    return true
  }, type)
}

/** A second hero, five relics (one a pact), a full pack and a skill owed. */
async function dressRun(p) {
  await p.st(async () => {
    const g = window.__game
    const items = await import('/src/game/data/items.ts')
    const { RNG } = await import('/src/game/core/rng.ts')
    const rng = new RNG(4242)
    const s = g.getState()
    const inventory = Array.from({ length: 6 }, (_, k) => items.generateItem(rng, { depth: 3 + k }))
    const roster = s.roster.map((h, k) => (k === 0 ? { ...h, level: 5, skillPicks: [] } : h))
    g.setState({ inventory, roster, relics: ['hourglass', 'whetstone_pact', 'horn', 'ledger', 'keen'], gold: 260 })
  })
  await p.page.waitForTimeout(400)
}

async function battleSet(view, theme, log) {
  const p = await open(view, theme, log)
  await toBattle(p)
  await p.shot('10-setup')
  // Tap the hero on the party row: armed.
  await p.page.locator('.sh-hero').first().click({ timeout: 4000 }).catch((e) => log.push('arm ' + e.message.slice(0, 60)))
  await p.page.waitForTimeout(500)
  await p.shot('11-armed')
  await post(p, 0)
  await p.shot('12-posted')
  await dressRun(p)
  // Details: the hero card + Gear.
  await p.st(() => {
    const g = window.__game
    const id = g.getState().roster[0].id
    g.getState().shellSelect({ kind: 'hero', id })
    if (innerWidth < 700 && !g.getState().detailOpen) g.getState().toggleDetail()
  })
  await p.page.waitForTimeout(600)
  await p.shot('13-details-owed')
  await p.page.getByRole('tab', { name: /Pack/ }).first().click({ timeout: 3000 }).catch((e) => log.push('pack ' + e.message.slice(0, 60)))
  await p.page.waitForTimeout(500)
  await p.shot('14-pack-full')
  await p.page.locator('.sh-pack-grid button').first().click({ timeout: 3000 }).catch((e) => log.push('packitem ' + e.message.slice(0, 60)))
  await p.page.waitForTimeout(500)
  await p.shot('15-pack-item')
  // Upgrade (the owed skill first).
  await p.st(() => {
    const g = window.__game
    g.getState().shellSelect({ kind: 'hero', id: g.getState().roster[0].id })
  })
  await p.page.waitForTimeout(300)
  await p.page.locator('.sh-upgrade').first().click({ timeout: 3000 }).catch((e) => log.push('upgrade ' + e.message.slice(0, 60)))
  await p.page.waitForTimeout(600)
  await p.shot('16-upgrade-skill')
  // Team panel.
  await p.page.locator('.sh-team-btn').first().click({ timeout: 3000 }).catch((e) => log.push('team ' + e.message.slice(0, 60)))
  await p.page.waitForTimeout(500)
  await p.shot('17-team')
  await p.page.locator('.sh-relic').nth(1).click({ timeout: 3000 }).catch(() => {})
  await p.page.waitForTimeout(400)
  await p.shot('18-team-pact')
  // Close, collapse, and run the wave.
  await p.st(() => {
    const g = window.__game
    g.getState().shellSelect(null)
    if (innerWidth < 700 && g.getState().detailOpen) g.getState().toggleDetail()
  })
  await p.page.waitForTimeout(400)
  await p.shot('19-setup-ready')
  await p.st(() => window.__game.getState().setSpeed?.(2))
  await startWave(p, 7000)
  await p.shot('20-live')
  // Read a hero mid-wave.
  await p.page.locator('.sh-hero').first().click({ timeout: 3000 }).catch(() => {})
  await p.page.waitForTimeout(500)
  await p.shot('21-live-read')
  await forceClear(p)
  await p.shot('22-cleared')
  await p.st(() => window.__game.getState().skipWaveBeat())
  await p.page.waitForTimeout(1500)
  await p.shot('23-spoils')
  await p.st(() => {
    const g = window.__game
    const r = g.getState().reward
    if (r?.length) g.getState().chooseReward(r[0].id)
  })
  await p.page.waitForTimeout(1600)
  await p.shot('30-map')
  // The next fight's setup: posts carried, the level-up badge, Upgrade waiting.
  const nextFight = await p.st(() => {
    const g = window.__game
    const s = g.getState()
    const n = s.reachableNodeIds.map((id) => s.runMap.nodes.find((x) => x.id === id)).find((x) => x && (x.type === 'battle' || x.type === 'elite'))
    if (!n) return false
    g.getState().selectNode(n.id)
    return true
  })
  if (nextFight) {
    await p.page.waitForTimeout(1500)
    await p.page.getByRole('button', { name: /^March|Fight/ }).first().click({ timeout: 2000 }).catch(() => {})
    await p.page.waitForTimeout(1500)
    await p.shot('24-setup-2')
    // A fuller wave, live: 19 raiders on the second road.
    await p.st(() => window.__game.getState().setSpeed?.(2))
    await startWave(p, 9000)
    await p.shot('26-live-many')
    await forceClear(p)
    await p.st(() => window.__game.getState().skipWaveBeat())
    await p.page.waitForTimeout(1200)
    await p.st(() => {
      const g = window.__game
      const r = g.getState().reward
      if (r?.length) g.getState().chooseReward(r[0].id)
    })
    await p.page.waitForTimeout(1500)
  }
  // Stops.
  for (const [type, name] of [['merchant', '40-merchant'], ['campfire', '41-campfire'], ['shrine', '42-shrine']]) {
    if (!want(name)) continue
    await p.st(() => {
      const g = window.__game
      if (g.getState().screen === 'battle') g.setState({ screen: 'map' })
    })
    const ok = await enterStop(p, type)
    await p.page.waitForTimeout(1500)
    if (ok) await p.shot(name)
    else log.push(`no ${type}`)
    if (ok && type === 'merchant') {
      await p.page.locator('.shop-wares button').nth(1).click({ timeout: 2000 }).catch(() => {})
      await p.page.waitForTimeout(400)
      await p.shot('40b-merchant-ware')
    }
    await p.st(() => window.__game.getState().leaveEvent())
    await p.page.waitForTimeout(800)
  }
  if (want('50-city') || want('51-hire') || want('50-boss-cleared')) {
    await p.st(() => {
      const g = window.__game
      if (g.getState().screen === 'battle') g.setState({ screen: 'map' })
    })
    const ok = await enterStop(p, 'miniboss')
    await p.page.waitForTimeout(1500)
    if (ok) {
      await p.page.getByRole('button', { name: /^March|Fight|Start/ }).first().click({ timeout: 3000 }).catch(() => {})
      await p.page.waitForTimeout(1500)
      await post(p, 0, 0.5)
      await startWave(p)
      await forceClear(p)
      await p.shot('50-boss-cleared')
      await p.st(() => window.__game.getState().skipWaveBeat())
      await p.page.waitForTimeout(1000)
      await p.page.getByRole('button', { name: /^Continue/ }).first().click({ timeout: 3000 }).catch(() => {})
      await p.page.waitForTimeout(1500)
      await p.shot('50-city')
      await p.st(() => window.__game.getState().pressOn())
      await p.page.waitForTimeout(1000)
      await p.st(() => {
        const g = window.__game
        const r = g.getState().reward
        if (r?.length) g.getState().chooseReward(r[0].id)
      })
      await p.page.waitForTimeout(1500)
      await p.shot('51-hire')
    } else log.push('no miniboss')
  }
  await p.ctx.close()
}

async function defeatSet(view, theme, log) {
  if (!want('25-defeat') && !want('25b-defeat-later')) return
  const p = await open(view, theme, log)
  await toBattle(p)
  await post(p, 0)
  await startWave(p)
  await p.st(() => {
    const e = window.__game.getState().engine
    if (e) e.baseHp = 0
  })
  await p.page.waitForTimeout(350)
  await p.shot('25-defeat')
  await p.page.waitForTimeout(2500)
  await p.shot('25b-defeat-later')
  await p.ctx.close()
}

for (const view of VIEW_ARG ?? Object.keys(VIEWS)) {
  for (const theme of THEMES) {
    const log = []
    await battleSet(view, theme, log)
    await defeatSet(view, theme, log)
    fs.writeFileSync(path.join(OUT, `log-${view}-${theme}.txt`), log.join('\n') + '\n')
    console.log(`${view} ${theme}: ${log.join(' | ')}`)
  }
}
await browser.close()
