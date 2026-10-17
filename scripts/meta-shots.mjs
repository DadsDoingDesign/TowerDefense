/**
 * meta-shots — the home and the meta screens, captured from the RUNNING app for
 * the job critique (Oct 2026, `docs/ui-audit-2026-10/job-critique/home/`).
 *
 *   npx vite --port 5211 --strictPort &
 *   node scripts/meta-shots.mjs <outDir> [p390,p375,p320,d1280] [only,screens]
 *
 * A round is ~150 shots: keep them in a scratch folder, out of the repo, and
 * commit only the few before/after pairs worth showing.
 *
 * Screens: home (each company and Buy Company, a first launch, the update
 * notice), terms, charter, militia (create and edit), track, livery, war,
 * seasonend, hq, crates, codex, settings, resume, result (a delivery and a
 * fall). Every screen is reached through the real controls from a seeded save
 * (the dev handles in `src/main.tsx`), like `home-stability.mjs`. Two honest
 * shortcuts: the season's end is the real `endSeason` of the seeded season,
 * and a receipt's fight is won or lost by emptying its queue or its wagon.
 * The update notice is the real component, with the waiting worker faked.
 *
 * Env: META_BASE (default http://localhost:5211/), PW_CHROMIUM.
 */
import fs from 'node:fs'
import path from 'node:path'

if (!process.argv[2]) {
  console.error('meta-shots: name an output folder (outside the repo).')
  process.exit(1)
}
const OUT = path.resolve(process.argv[2])
const ONLY_VIEWS = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3].split(',') : null
const ONLY = process.argv[4] ? new Set(process.argv[4].split(',')) : null
const BASE = process.env.META_BASE ?? 'http://localhost:5211/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

const loadChromium = async () => {
  for (const pkg of ['playwright', 'playwright-core', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try {
      return (await import(pkg)).chromium
    } catch {
      /* next */
    }
  }
  console.error('meta-shots: install playwright or playwright-core first.')
  process.exit(1)
}

const VIEWS = {
  p390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  p375: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  p320: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  d1280: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
}

const SAVES = {
  fresh: null,
  mid: { runs: 6, bank: 1240, standing: { spice: 3, art: 2, metals: 1 }, skills: 12, items: 8, season: { n: 1, contracts: 3, deliveries: { spice: 2, art: 0, metals: 0, silk: 0, scrolls: 0 }, log: ['spice', null, 'spice'] } },
  veteran: {
    runs: 31,
    bank: 12480,
    standing: { spice: 7, art: 4, metals: 3, silk: 2, scrolls: 5 },
    term: { metals: 2 },
    skills: 999,
    items: 999,
    militia: true,
    season: {
      n: 3,
      contracts: 4,
      shares: { spice: 27, art: 14, metals: 32, silk: 11, scrolls: 16 },
      deliveries: { spice: 1, art: 0, metals: 2, silk: 0, scrolls: 0 },
      log: ['metals', 'spice', null, 'metals'],
      desperate: 'silk',
    },
  },
  // Every unlock, no militia yet: Buy Company opens the founding first.
  founder: { runs: 20, bank: 8000, standing: { spice: 5, art: 3, metals: 2, silk: 1, scrolls: 1 }, skills: 999, items: 999, season: { n: 2, contracts: 1, deliveries: { spice: 1, art: 0, metals: 0, silk: 0, scrolls: 0 }, log: ['spice'] } },
}

fs.mkdirSync(OUT, { recursive: true })
const chromium = await loadChromium()
const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})
const want = (s) => !ONLY || ONLY.has(s)

async function open(view, saveName, log, opts = {}) {
  const ctx = await browser.newContext({ ...VIEWS[view], reducedMotion: opts.motion ? 'no-preference' : 'reduce' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`))
  if (opts.update) {
    // The update notice's real component, with a worker faked as waiting.
    await page.route(/\/src\/pwa\.ts/, async (route) => {
      const res = await route.fetch()
      const body = (await res.text()) + '\nwindow.__pwaWaiting = () => setWaiting({ postMessage() {} })\n'
      await route.fulfill({ response: res, body })
    })
  }
  await page.goto(BASE)
  await page.waitForFunction(() => !!window.__meta, null, { timeout: 20000 })
  const save = SAVES[saveName]
  await page.evaluate(async (save) => {
    localStorage.clear()
    if (!save) return
    const st = await import('/src/game/run/standing.ts')
    const tr = await import('/src/game/run/track.ts')
    const sk = await import('/src/game/data/skills.ts')
    const ik = await import('/src/game/data/itemKinds.ts')
    const tw = await import('/src/game/run/tradeWar.ts')
    const ids = ['spice', 'art', 'metals', 'silk', 'scrolls']
    window.__meta.setState({
      bank: save.bank,
      standing: Object.fromEntries(ids.map((c) => [c, st.standingXpToReach(save.standing[c] ?? 0) + ((save.term?.[c] ?? 1) > 1 ? tr.TERM_XP : 0)])),
      terms: save.term ?? {},
      skills: sk.RANDOM_UNLOCK_SKILLS.slice(0, save.skills),
      items: ik.UNLOCK_ITEM_KINDS.slice(0, save.items),
      militia: save.militia ? { name: 'The Lantern Guard', shape: 'swallow', tincture: 'crimson', charge: 'keep', pattern: 'plain', tincture2: 'sable', metal: 'gold' } : null,
      season: { ...tw.freshSeason(), ...save.season },
      stats: { ...window.__meta.getState().stats, runsCompleted: save.runs, runsWon: save.runs },
    })
    const s = window.__settings.getState()
    window.__settings.setState({ taught: { ...s.taught, board: true, market: true, war: true } })
  }, save)
  if (opts.before) await page.evaluate(opts.before)
  await page.waitForTimeout(400)
  await page.reload()
  await page.waitForFunction(() => document.querySelector('.tm-canvas.is-ready') || document.querySelector('.fw-resume'), null, { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(700)
  const shot = async (name, full = false) => {
    await page.waitForTimeout(450)
    await page.screenshot({ path: path.join(OUT, `${name}-${view}.png`), fullPage: full })
    log.push(`shot ${name}`)
  }
  const click = async (loc, wait = 900) => {
    await loc.first().click({ timeout: 6000 })
    await page.waitForTimeout(wait)
  }
  const st = (fn, arg) => page.evaluate(fn, arg)
  const focus = (f) => st((f) => window.__game.getState().focusRoad(f), f)
  const scrollEnd = () => st(() => document.querySelectorAll('.pg-body, .pg-scroll, main, .pg, [class*="scroll"]').forEach((e) => (e.scrollTop = 99999)))
  return { ctx, page, shot, click, st, focus, scrollEnd }
}

/** A stop node made the next one, and stepped onto. */
const enterNode = (p, type) =>
  p.st((type) => {
    const g = window.__game
    const s = g.getState()
    const n = s.runMap.nodes.find((x) => x.type === type && !s.clearedNodeIds.includes(x.id))
    if (!n) return false
    g.setState({ reachableNodeIds: [n.id], event: null, merchant: null, shrineOffer: null })
    g.getState().selectNode(n.id)
    return true
  }, type)

async function fight(p, win) {
  await p.st(() => {
    const g = window.__game
    const s = g.getState()
    const hero = s.roster[0]
    const slot = s.battleMap.slots[Math.floor(s.battleMap.slots.length / 3)]
    g.setState({ selectedSentinelId: hero.id })
    g.getState().placeOnSlot(slot.id)
  })
  await p.page.waitForTimeout(300)
  await p.page.getByRole('button', { name: /Start Wave/ }).first().click({ timeout: 5000 }).catch(() => {})
  await p.page.waitForTimeout(1500)
  await p.st((win) => {
    const e = window.__game.getState().engine
    if (!e) return
    if (win) {
      e.spawnIndex = e.spawnQueue.length
      e.enemies = []
      e.projectiles = []
      e.pendingSpawns = []
      e.breather = null
    } else e.baseHp = 0
  }, win)
  await p.page.waitForTimeout(1300)
  await p.st(() => window.__game.getState().skipWaveBeat?.())
  await p.page.waitForTimeout(1800)
}

async function run(view) {
  const log = []
  const go = async (save, fn, opts) => {
    let p = null
    try {
      p = await open(view, save, log, opts)
      await fn(p)
    } catch (e) {
      log.push(`ERR ${e.message.split('\n')[0].slice(0, 160)}`)
    }
    await p?.ctx.close()
  }

  if (want('home')) {
    await go('fresh', (p) => p.shot('00-home-first'))
    await go('mid', async (p) => {
      await p.shot('01-home-mid')
      for (const c of ['art', 'metals', 'silk', 'scrolls']) {
        await p.focus(c)
        await p.shot(`01-home-mid-${c}`)
      }
      await p.focus('charter')
      await p.shot('01-home-mid-charter')
    })
    await go('veteran', async (p) => {
      for (const c of ['spice', 'silk', 'charter']) {
        await p.focus(c)
        await p.shot(`02-home-vet-${c}`)
      }
    })
  }
  if (want('update'))
    await go('mid', async (p) => {
      await p.st(() => window.__pwaWaiting?.())
      await p.shot('03-home-update')
    }, { update: true })
  if (want('motion'))
    await go('veteran', async (p) => {
      await p.focus('spice')
      await p.page.waitForTimeout(1500)
      await p.shot('04-home-motion-spice')
    }, { motion: true })
  if (want('terms'))
    await go('mid', async (p) => {
      await p.click(p.page.locator('.mn-cta'), 1500)
      await p.shot('10-terms')
      await p.scrollEnd()
      await p.shot('10b-terms-end')
    })
  if (want('charter')) {
    await go('veteran', async (p) => {
      await p.focus('charter')
      await p.click(p.page.locator('.mn-cta'), 1500)
      await p.shot('11-charter')
      await p.scrollEnd()
      await p.shot('11b-charter-end')
    })
    await go('founder', async (p) => {
      await p.focus('charter')
      await p.click(p.page.locator('.mn-cta'), 1500)
      await p.shot('12-militia-create')
    })
  }
  if (want('militia'))
    await go('veteran', async (p) => {
      await p.click(p.page.locator('.mn-purse-btn'), 1500)
      await p.shot('13-militia-edit')
      await p.scrollEnd()
      await p.shot('13b-militia-edit-end')
    })
  if (want('track'))
    await go('veteran', async (p) => {
      await p.focus('spice')
      await p.click(p.page.locator('.mn-fact.is-link'), 1500)
      await p.shot('14-track')
      await p.scrollEnd()
      await p.shot('14b-track-end')
    })
  if (want('livery'))
    await go('veteran', async (p) => {
      await p.focus('spice')
      await p.click(p.page.locator('button.mn-livery'), 1500)
      await p.shot('15-livery')
      await p.scrollEnd()
      await p.shot('15b-livery-end')
    })
  if (want('war'))
    await go('veteran', async (p) => {
      await p.click(p.page.locator('.mn-season'), 1500)
      await p.shot('16-war')
      await p.scrollEnd()
      await p.shot('16b-war-end')
    })
  if (want('seasonend'))
    await go('veteran', (p) => p.shot('17-season-end'), {
      before: async () => {
        const tw = await import('/src/game/run/tradeWar.ts')
        const m = window.__meta.getState()
        const { next } = tw.endSeason({ ...m.season, contracts: 6 }, { haveItems: m.items ?? [] })
        window.__meta.setState({ season: next })
      },
    })
  if (want('places'))
    await go('mid', async (p) => {
      for (const [name, re] of [['18-hq', /^(HQ|Headquarters)/], ['19-crates', /^(Crates|Sealed)/], ['20-codex', /^Codex/], ['22-settings', /^Settings/]]) {
        await p.click(p.page.getByRole('button', { name: re }), 1300)
        await p.shot(name)
        if (name === '20-codex') {
          await p.click(p.page.locator('.cx-tile'), 900).catch(() => {})
          await p.shot('21-codex-card')
          await p.page.keyboard.press('Escape')
          await p.page.waitForTimeout(400)
        }
        if (name === '22-settings' || name === '18-hq') {
          await p.scrollEnd()
          await p.shot(`${name}-end`)
        }
        await p.page.goto(BASE)
        await p.page.waitForFunction(() => document.querySelector('.tm-canvas.is-ready'), null, { timeout: 20000 }).catch(() => {})
        await p.page.waitForTimeout(700)
      }
    })
  if (want('resume'))
    await go('mid', async (p) => {
      await p.click(p.page.locator('.mn-cta'), 1500)
      await p.click(p.page.locator('.pg-cta:visible'), 1500)
      await p.click(p.page.locator('.pg-cta:visible'), 2500)
      await p.page.waitForTimeout(1500)
      await p.page.reload()
      await p.page.waitForTimeout(2500)
      await p.shot('23-resume')
      await p.click(p.page.locator('.fw-resume-btn.quiet'), 600)
      await p.shot('23b-resume-armed')
    })
  if (want('result')) {
    for (const [name, win] of [['24-result-delivered', true], ['25-result-fall', false]])
      await go('mid', async (p) => {
        await p.click(p.page.locator('.mn-cta'), 1500)
        await p.click(p.page.locator('.pg-cta:visible'), 1500)
        await p.click(p.page.locator('.pg-cta:visible'), 2500)
        if (win) {
          // The two cities on the way paid, as they would have on the road.
          await p.st(async () => {
            const k = await import('/src/game/run/contracts.ts')
            const g = window.__game
            const c = g.getState().contract
            const paid = [0, 1].map((i) => k.cityPay(c, i, 100).total)
            g.setState({ contract: { ...c, paid, cargoAt: [100, 100] } })
          })
          const ok = await enterNode(p, 'boss')
          await p.page.waitForTimeout(1500)
          if (!ok) log.push('no boss node')
        }
        await fight(p, win)
        await p.shot(name)
        await p.scrollEnd()
        await p.shot(`${name}-end`)
      })
  }
  fs.writeFileSync(path.join(OUT, `log-${view}.txt`), log.join('\n') + '\n')
  console.log(`${view}: ${log.filter((l) => !l.startsWith('shot')).join(' | ') || 'ok'} (${log.length} entries)`)
}

for (const v of ONLY_VIEWS ?? Object.keys(VIEWS)) await run(v)
await browser.close()
