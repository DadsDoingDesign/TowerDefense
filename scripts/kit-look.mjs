/**
 * kit-look — the hero's kit on the field and in every portrait, from the
 * RUNNING app (Oct 2026 kit-look review: the body layer and the kit
 * portraits, `render/bodyLayer.ts`, `render/heroPortrait.ts`).
 *
 *   npx vite --port 5223 --strictPort &
 *   node scripts/kit-look.mjs <outDir> [shots|perf|both] [views] [themes]
 *
 * shots: a contract's opening fight with four heroes in set kits (every body
 * piece across them), captured in setup (the party bar), with the hero card
 * open, on the Pack before and after equipping a body piece from it (the
 * portrait must change), and mid-wave in a crowded mixed wave.
 *
 * perf: the same crowded wave at 4× CPU throttling (a phone's budget), every
 * rAF callback timed by a wrapper installed before the app boots; prints the
 * mean and p95 script ms per frame and the frame rate over 6 s.
 *
 * views: p390,p320,d1280 (default all); themes: neutral,metals,… (default
 * neutral). Env: KIT_BASE (default http://localhost:5223/), KIT_A11Y=1 (high
 * contrast + reduced motion), PW_CHROMIUM.
 */
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.argv[2] ?? 'kit-look')
const MODE = process.argv[3] ?? 'both'
const VIEW_ARG = process.argv[4] && process.argv[4] !== 'all' ? process.argv[4].split(',') : null
const THEMES = process.argv[5] ? process.argv[5].split(',') : ['neutral']
const BASE = process.env.KIT_BASE ?? 'http://localhost:5223/'
/** KIT_A11Y=1: high contrast and reduced motion on (the shots' names say `-a11y`). */
const A11Y = !!process.env.KIT_A11Y
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import(process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs')

const VIEWS = {
  p390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  p320: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  d1280: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
}
/** Four kits: every body piece is on one of them, and each look is there. */
const KITS = [
  { main: 'Sword', off: 'Shield', body: 'Plate' },
  { main: 'Bow', off: null, body: 'Silkwind Cloak' },
  { main: 'Greatsword', off: null, body: 'Ironheart Plate' },
  { main: 'Wand', off: 'Tome', body: 'Robe' },
]
/** In the Pack, to equip during the review: the rest of the bodies. */
const PACK = ['Mail', 'Cloak', 'Aegis']

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})

const RAF_PROBE = () => {
  const raf = window.requestAnimationFrame.bind(window)
  const frames = new Map()
  window.__rafProbe = { frames, on: false }
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      const s = performance.now()
      try {
        cb(t)
      } finally {
        if (window.__rafProbe.on) frames.set(t, (frames.get(t) ?? 0) + performance.now() - s)
      }
    })
}

async function open(view, theme, probe) {
  const ctx = await browser.newContext({ ...VIEWS[view] })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('  ! pageerror', e.message))
  if (probe) await page.addInitScript(RAF_PROBE)
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__game)
  const company = theme === 'neutral' ? 'spice' : theme
  const r = await page.evaluate(
    async ({ company, KITS, PACK, neutral, a11y }) => {
      const items = await import('/src/game/data/items.ts')
      const heroes = await import('/src/game/run/heroes.ts')
      const seeds = await import('/src/state/seeds.ts')
      const { RNG } = await import('/src/game/core/rng.ts')
      const g = window.__game
      window.__settings.setState({ autoContinue: false, showEverything: true, ...(a11y ? { highContrast: true, reducedMotion: true } : {}) })
      window.__meta.setState({ bank: 5000, stats: { ...window.__meta.getState().stats, runsCompleted: 12, runsWon: 4, bestDepth: 9 } })
      g.getState().beginCampaign(424242, seeds.STANDARD_RUN, { company, crates: 0 })
      g.getState().marchOut('pick-0')
      const st = g.getState()
      if (st.screen !== 'battle') return { err: `screen ${st.screen}` }
      const rng = new RNG(777)
      const deal = (kind) => (kind ? items.generateItem(rng, { kind, rarity: 'rare', allowCurse: false }) : null)
      const extra = [1, 2, 3].map((k) => heroes.chosenHero(9100 + k * 31, st.skillPool, st.itemPool, `pick-${k % 3}`)).filter(Boolean)
      const roster = [...st.roster, ...extra].slice(0, 4).map((h, i) => ({
        ...h,
        equipment: { mainHand: deal(KITS[i].main), offHand: deal(KITS[i].off), body: deal(KITS[i].body) },
      }))
      // Spread the posts along the road.
      const map = st.battleMap
      const slots = Object.keys(st.placements)
      const pl = { ...st.placements }
      for (const k of Object.keys(pl)) pl[k] = null
      const by = map.slots.filter((s) => slots.includes(s.id))
      const pick = [0.2, 0.42, 0.62, 0.82].map((f) => by[Math.floor(by.length * f)]?.id).filter(Boolean)
      roster.forEach((s, i) => pick[i] && (pl[pick[i]] = s.id))
      const sp = []
      const add = (typeId, n, t0, dt) => { for (let i = 0; i < n; i++) sp.push({ typeId, at: t0 + i * dt, hpMult: 3.2 }) }
      add('torch1', 6, 0, 0.4)
      add('tnt2_warded', 2, 0.6, 0.5)
      add('torch2', 4, 0.9, 0.45)
      add('barrel1', 2, 1.2, 0.6)
      add('torch3_plated', 3, 1.6, 0.5)
      add('torch2_swift', 3, 2.0, 0.35)
      add('tnt1', 4, 2.4, 0.35)
      add('torch4', 3, 2.9, 0.6)
      add('tnt3', 3, 3.5, 0.45)
      add('torch1', 6, 4.2, 0.3)
      add('torch5', 1, 2.6, 0)
      g.setState({
        roster,
        placements: pl,
        inventory: PACK.map(deal),
        currentWave: { index: 0, label: 'Kit look', isBoss: false, spawns: sp.sort((a, b) => a.at - b.at) },
      })
      if (neutral) {
        const root = document.documentElement
        const hold = () => root.dataset.coTheme && delete root.dataset.coTheme
        new MutationObserver(hold).observe(root, { attributes: true, attributeFilter: ['data-co-theme'] })
        hold()
      }
      return { ok: true, posted: pick.length }
    },
    { company, KITS, PACK, neutral: theme === 'neutral', a11y: A11Y },
  )
  if (!r.ok) throw new Error(JSON.stringify(r))
  await page.waitForTimeout(900)
  return { ctx, page }
}

/** The hero pick: three dealt heroes, each token and the card cut from its own figure. */
async function pickShot(view, theme) {
  const ctx = await browser.newContext({ ...VIEWS[view] })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__game)
  await page.evaluate(async (company) => {
    const seeds = await import('/src/state/seeds.ts')
    window.__settings.setState({ showEverything: true })
    window.__meta.setState({ stats: { ...window.__meta.getState().stats, runsCompleted: 12, runsWon: 4, bestDepth: 9 } })
    window.__game.getState().beginCampaign(424242, seeds.STANDARD_RUN, { company, crates: 0 })
  }, theme === 'neutral' ? 'spice' : theme)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: path.join(OUT, `0-pick-${view}-${theme}.png`) })
  await ctx.close()
}

async function shots(view, theme) {
  await pickShot(view, theme)
  const { ctx, page } = await open(view, theme, false)
  const shot = async (name) => {
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(OUT, `${name}-${view}-${theme}${A11Y ? '-a11y' : ''}.png`) })
  }
  await shot('1-setup')
  await page.locator('canvas').first().screenshot({ path: path.join(OUT, `1-field-${view}-${theme}.png`) })
  const detail = async (i) =>
    page.evaluate((i) => {
      const g = window.__game
      g.getState().shellSelect({ kind: 'hero', id: g.getState().roster[i].id })
      if (innerWidth < 700 && !g.getState().detailOpen) g.getState().toggleDetail()
    }, i)
  await detail(0)
  await shot('2-card')
  await page.getByRole('tab', { name: /Pack/ }).first().click({ timeout: 3000 }).catch(() => {})
  await shot('3-pack')
  // Equip the Pack's Aegis on the first hero: the portraits must follow.
  await page.evaluate(() => {
    const g = window.__game
    const s = g.getState()
    const aegis = s.inventory.find((i) => /Aegis/.test(i.name))
    if (aegis) s.equipItem(s.roster[0].id, 'body', aegis.id)
  })
  await shot('4-pack-equipped')
  // The rest of the Pack goes on for the wave, so all seven pieces are seen on the field.
  await page.evaluate(() => {
    const g = window.__game
    const s = g.getState()
    const by = (re) => s.inventory.find((i) => re.test(i.name))
    if (by(/Mail/)) s.equipItem(s.roster[2].id, 'body', by(/Mail/).id)
    if (by(/Cloak/) && !/Silkwind/.test(by(/Cloak/).name)) g.getState().equipItem(s.roster[3].id, 'body', by(/Cloak/).id)
  })
  await page.evaluate(() => {
    const g = window.__game
    if (g.getState().detailOpen && innerWidth < 700) g.getState().toggleDetail()
    g.getState().shellSelect(null)
    g.getState().startWave()
  })
  await page.waitForTimeout(5200)
  await shot('5-wave')
  await page.locator('canvas').first().screenshot({ path: path.join(OUT, `5-field-${view}-${theme}.png`) })
  await ctx.close()
}

async function perf(view, theme) {
  const { ctx, page } = await open(view, theme, true)
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.evaluate(() => window.__game.getState().startWave())
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    window.__rafProbe.frames.clear()
    window.__rafProbe.on = true
  })
  await page.waitForTimeout(6000)
  const m = await page.evaluate(() => {
    window.__rafProbe.on = false
    const ts = [...window.__rafProbe.frames.keys()].sort((a, b) => a - b)
    const ms = [...window.__rafProbe.frames.values()].sort((a, b) => a - b)
    const e = window.__game.getState().engine
    return {
      frames: ms.length,
      fps: +((ms.length - 1) / ((ts[ts.length - 1] - ts[0]) / 1000)).toFixed(1),
      meanMs: +(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(2),
      p95Ms: +ms[Math.floor(ms.length * 0.95)].toFixed(2),
      enemies: e ? e.enemies.length : 0,
      heroes: e ? e.sentinels.length : 0,
    }
  })
  console.log(`perf ${view} ${theme} (4x CPU): ${JSON.stringify(m)}`)
  await ctx.close()
  return m
}

const views = VIEW_ARG ?? Object.keys(VIEWS)
const report = []
for (const theme of THEMES)
  for (const view of views) {
    if (MODE !== 'perf') await shots(view, theme)
    if (MODE !== 'shots') report.push({ view, theme, ...(await perf(view, theme)) })
  }
if (report.length) fs.writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify(report, null, 1))
await browser.close()
