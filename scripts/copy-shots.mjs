/**
 * copy-shots — the copy pass's review screens (Oct 2026, `docs/copy/COPY.md`),
 * captured from the RUNNING app at 390 × 844 and 1280 × 800.
 *
 *   npx vite --port 5205 --strictPort &
 *   PW_CHROMIUM=<chrome> node scripts/copy-shots.mjs docs/ui-audit-2026-10/copy-pass/r1 [phone|desk] [only,screens]
 *
 * Screens: home, terms, pick, hud, spoils, merchant, campfire, shrine, hire,
 * result, hq, codex, settings. Each is reached through the real store and
 * controls (the dev handles in `src/main.tsx`); the shortcuts are honest and
 * named: a fight is won or lost by emptying its queue or its wagon, the spoils
 * hand is dealt one item, one relic and one pact so all three kinds show, and
 * a stop is entered by making its node the next reachable one.
 *
 * Env: COPY_BASE (default http://127.0.0.1:5205/).
 */
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.argv[2] ?? 'docs/ui-audit-2026-10/copy-pass/shots')
const ONLY_VIEW = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3] : null
const ONLY = process.argv[4] ? new Set(process.argv[4].split(',')) : null
const BASE = process.env.COPY_BASE ?? 'http://127.0.0.1:5205/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

const loadChromium = async () => {
  for (const pkg of ['playwright', 'playwright-core', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try {
      return (await import(pkg)).chromium
    } catch {
      /* next */
    }
  }
  console.error('copy-shots: install playwright or playwright-core first.')
  process.exit(1)
}

const VIEWS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, tag: 'p390' },
  desk: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, tag: 'd1280' },
}

fs.mkdirSync(OUT, { recursive: true })
const chromium = await loadChromium()
const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})
const want = (s) => !ONLY || ONLY.has(s)

/** A mid-career save: standing with two companies, an open HQ, a season under way. */
async function seed(page) {
  await page.goto(BASE)
  await page.waitForFunction(() => !!window.__meta, null, { timeout: 20000 })
  await page.evaluate(async () => {
    localStorage.clear()
    const st = await import('/src/game/run/standing.ts')
    const sk = await import('/src/game/data/skills.ts')
    const ik = await import('/src/game/data/itemKinds.ts')
    const tw = await import('/src/game/run/tradeWar.ts')
    window.__meta.setState({
      bank: 1240,
      standing: { spice: st.standingXpToReach(3), art: st.standingXpToReach(2), metals: st.standingXpToReach(1), silk: 0, scrolls: 0 },
      skills: sk.RANDOM_UNLOCK_SKILLS.slice(0, 12),
      items: ik.UNLOCK_ITEM_KINDS.slice(0, 8),
      season: { ...tw.freshSeason(), n: 1, contracts: 3, deliveries: { spice: 2, art: 0, metals: 0, silk: 0, scrolls: 0 }, log: ['spice', null, 'spice'] },
      stats: { ...window.__meta.getState().stats, runsCompleted: 6, runsWon: 4 },
    })
    const s = window.__settings.getState()
    window.__settings.setState({ taught: { ...s.taught, board: true, market: true, war: true }, showEverything: true })
  })
  await page.waitForTimeout(500)
  await page.reload()
  await page.waitForFunction(() => document.querySelector('.tm-canvas.is-ready'), null, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(900)
}

async function open(view, log) {
  const ctx = await browser.newContext({ ...VIEWS[view], reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`))
  const shot = async (name) => {
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(OUT, `${name}-${VIEWS[view].tag}.png`) })
    log.push(`shot ${name}`)
  }
  const cta = async (wait = 1500) => {
    await page.locator('.pg-cta:visible').first().click({ timeout: 8000 })
    await page.waitForTimeout(wait)
  }
  const st = (fn, arg) => page.evaluate(fn, arg)
  await seed(page)
  return { ctx, page, shot, cta, st }
}

/** Home → terms → pick → the opening fight's setup. */
async function toBattle(p, shots) {
  if (shots && want('home')) await p.shot('01-home')
  await p.cta()
  if (shots && want('terms')) await p.shot('02-terms')
  await p.cta()
  if (shots && want('pick')) await p.shot('03-pick')
  await p.cta(2500)
}

/** Post the first hero on an open tile and start the wave. */
async function startWave(p) {
  await p.st(() => {
    const g = window.__game
    const s = g.getState()
    const hero = s.roster[0]
    const slot = s.battleMap.slots[Math.floor(s.battleMap.slots.length / 3)]
    g.setState({ selectedSentinelId: hero.id })
    g.getState().placeOnSlot(slot.id)
  })
  await p.page.waitForTimeout(400)
  await p.page.getByRole('button', { name: /Start Wave/ }).first().click({ timeout: 5000 }).catch(() => {})
  await p.page.waitForTimeout(2600)
}

/** Empty the wave: everything spawned, nothing left alive. */
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
  await p.st(() => window.__game.getState().skipWaveBeat())
  await p.page.waitForTimeout(1200)
}

/** One item, one relic and one pact, so the hand shows all three kinds. */
async function dealMixedHand(p) {
  await p.st(async () => {
    const g = window.__game
    const rw = await import('/src/game/data/rewards.ts')
    const reward = g.getState().reward ?? []
    const item = reward.find((c) => c.kind === 'item')
    const pact = rw.allStatCards().find((c) => c.title === 'Long Watch')
    const relic = { id: 'rw-relic-shot', kind: 'relic', title: 'Watch Hourglass', desc: '', rarity: 'common', relic: 'hourglass' }
    g.setState({ reward: [item, { ...relic }, { ...pact, id: 'rw-pact-shot', kind: 'stat' }].filter(Boolean) })
  })
  await p.page.waitForTimeout(600)
}

/** Make a node of a type the next stop, and step onto it. */
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

async function run(view) {
  const log = []
  {
    const p = await open(view, log)
    await toBattle(p, true)
    if (want('hud')) await p.shot('04-hud-setup')
    await startWave(p)
    if (want('hud')) await p.shot('05-hud-wave')
    await forceClear(p)
    await dealMixedHand(p)
    if (want('spoils')) {
      await p.shot('06-spoils')
      // The relic's card: focus it.
      await p.page.locator('.sh-reward-row .sh-reward').nth(1).hover().catch(() => {})
      await p.page.locator('.sh-reward-row .sh-reward').nth(1).focus().catch(() => {})
      await p.shot('06b-spoils-relic')
      await p.page.locator('.sh-reward-row .sh-reward').nth(2).hover().catch(() => {})
      await p.shot('06c-spoils-pact')
    }
    // Take the relic, back to the map.
    await p.st(() => {
      const g = window.__game
      const r = g.getState().reward
      if (r?.length) g.getState().chooseReward(r[1].id)
    })
    await p.page.waitForTimeout(1500)
    for (const [type, name] of [['merchant', '07-merchant'], ['campfire', '08-campfire'], ['shrine', '09-shrine']]) {
      if (!want(name.slice(3))) continue
      const ok = await enterStop(p, type)
      // The shrine is dealt Trial of Iron, whose curse is a cargo cost: the
      // line the copy pass turned from Gate HP into the cargo's percent.
      if (ok && type === 'shrine')
        await p.st(async () => {
          const sh = await import('/src/game/data/shrines.ts')
          window.__game.setState({ shrineOffer: sh.shrineById('iron') })
        })
      await p.page.waitForTimeout(1500)
      if (ok) await p.shot(name)
      else log.push(`no ${type} on this map`)
      await p.st(() => window.__game.getState().leaveEvent())
      await p.page.waitForTimeout(800)
    }
    if (want('hire')) {
      // The act boss: won, the city pays, press on, take a spoil, then the hiring yard.
      const ok = await enterStop(p, 'miniboss')
      await p.page.waitForTimeout(1500)
      if (ok) {
        await p.page.getByRole('button', { name: /^March|Fight|Start/ }).first().click({ timeout: 3000 }).catch(() => {})
        await p.page.waitForTimeout(1500)
        await startWave(p)
        await forceClear(p)
        await p.page.waitForTimeout(800)
        if (want('city')) await p.shot('10a-city')
        await p.st(() => window.__game.getState().pressOn())
        await p.page.waitForTimeout(1000)
        await p.st(() => {
          const g = window.__game
          const r = g.getState().reward
          if (r?.length) g.getState().chooseReward(r[0].id)
        })
        await p.page.waitForTimeout(1500)
        await p.shot('10-hire')
      } else log.push('no miniboss')
    }
    await p.ctx.close()
  }
  if (want('result')) {
    const p = await open(view, log)
    await toBattle(p, false)
    await startWave(p)
    await p.st(() => {
      const e = window.__game.getState().engine
      if (e) e.baseHp = 0
    })
    await p.page.waitForTimeout(1500)
    await p.st(() => window.__game.getState().skipWaveBeat())
    await p.page.waitForTimeout(2500)
    await p.shot('11-result')
    await p.ctx.close()
  }
  {
    const p = await open(view, log)
    if (want('hq')) {
      await p.page.getByRole('button', { name: /^Headquarters|^HQ/ }).first().click({ timeout: 5000 }).catch((e) => log.push('hq ' + e.message.slice(0, 80)))
      await p.page.waitForTimeout(1200)
      await p.shot('12-hq')
      await p.page.getByRole('button', { name: /^Back/ }).first().click({ timeout: 3000 }).catch(() => {})
      await p.page.waitForTimeout(800)
    }
    if (want('codex')) {
      await p.page.getByRole('button', { name: /^Codex/ }).first().click({ timeout: 5000 })
      await p.page.waitForTimeout(1200)
      await p.page.locator('.cx-tile, [class*="tile"]').nth(1).click({ timeout: 3000 }).catch(() => {})
      await p.page.waitForTimeout(900)
      await p.shot('13-codex')
      await p.page.getByRole('button', { name: /^Back/ }).first().click({ timeout: 3000 }).catch(() => {})
      await p.page.waitForTimeout(800)
    }
    if (want('settings')) {
      await p.page.goto(BASE)
      await p.page.waitForTimeout(2500)
      await p.page.getByRole('button', { name: /^Settings/ }).first().click({ timeout: 5000 })
      await p.page.waitForTimeout(1200)
      await p.shot('14-settings')
      await p.page.mouse.wheel(0, 900)
      await p.page.evaluate(() => document.querySelectorAll('.pg-body, .pg-scroll, main').forEach((e) => (e.scrollTop = 9999)))
      await p.shot('14b-settings-end')
    }
    await p.ctx.close()
  }
  fs.writeFileSync(path.join(OUT, `log-${VIEWS[view].tag}.txt`), log.join('\n') + '\n')
  console.log(`${view}: ${log.join(' | ')}`)
}

for (const v of ONLY_VIEW ? [ONLY_VIEW] : Object.keys(VIEWS)) await run(v)
await browser.close()
