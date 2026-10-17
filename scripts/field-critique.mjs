/**
 * The battlefield canvas under load, in every season (Oct 2026 job critique).
 *
 * Drives the running app (dev build, `window.__game`) into a real battle on
 * the opening road of a contract for each company, posts four heroes, swaps
 * the wave for a crowded mixed one (tiers 1–4, Plated / Warded / Swift elites,
 * a tier-5 champion behind them) and screenshots it mid-wave — the actual
 * draw code, not a reimplementation. `neutral` is the same battle with
 * `window.__seasonOff`.
 *
 *   npx vite --port 5215 --strictPort &
 *   node scripts/field-critique.mjs <outDir> [phone|desk|all] [full|light|both]
 *
 * Also prints, per shot, the hue bins of the canvas's ENVIRONMENT pixels near
 * the lane and slots (units masked out by diffing against a unit-free frame):
 * the share of hue-carrying pixels in 0–30° (tier 1's red) and 30–60°
 * (tier 4's gold). That is the measure the season accent work quoted.
 *
 * playwright is not a dependency: set PW_MODULE to its index.mjs.
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const PW = process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs'
const { chromium } = await import(PW)
const BASE = process.env.FIELD_BASE ?? 'http://localhost:5215/'
const CHROME = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const OUT = process.argv[2] ?? 'docs/ui-audit-2026-10/job-critique/field/r1'
const VPS = { phone: { id: '390x844', width: 390, height: 844 }, desk: { id: '1280x800', width: 1280, height: 800 } }
const which = process.argv[3] ?? 'all'
const fxs = (process.argv[4] ?? 'both') === 'both' ? ['full', 'light'] : [process.argv[4]]
const SEASONS = (process.env.FIELD_SEASONS ?? 'neutral,spice,art,metals,silk,scrolls').split(',')
const WAIT = Number(process.env.FIELD_WAIT ?? 8500)
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ executablePath: CHROME })
const report = []

async function setup(page, company, effects) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__game)
  return page.evaluate(async ({ company, effects, neutral }) => {
    const seeds = await import('/src/state/seeds.ts')
    const heroes = await import('/src/game/run/heroes.ts')
    const g = window.__game
    window.__seasonOff = neutral
    window.__settings.setState({ effects, autoContinue: false })
    window.__meta.setState({ bank: 5000, stats: { ...window.__meta.getState().stats, runsCompleted: 12, runsWon: 4, bestDepth: 9 } })
    g.getState().beginCampaign(424242, seeds.STANDARD_RUN, { company: neutral ? 'spice' : company, crates: 0 })
    g.getState().marchOut('pick-0')
    const st = g.getState()
    if (st.screen !== 'battle') return { err: `screen ${st.screen}` }
    // Three more heroes, each dealt with its own gear (a hashed deal: no run stream moves).
    const extra = [1, 2, 3].map((k) => heroes.chosenHero(9100 + k * 31, st.skillPool, st.itemPool, `pick-${k % 3}`)).filter(Boolean)
    const roster = [...st.roster, ...extra]
    const slots = Object.keys(st.placements)
    // Spread the posts along the road: the slots beside it, at four points of its length.
    const map = st.battleMap
    const T = map.tile ?? 40
    const segs = []
    let acc = 0
    for (let i = 1; i < map.path.length; i++) {
      const a = map.path[i - 1], b = map.path[i]
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      segs.push({ a, b, len, at: acc })
      acc += len
    }
    const along = (p) => {
      let best = { d: Infinity, t: 0 }
      for (const s of segs) {
        const u = Math.max(0, Math.min(1, ((p.x - s.a.x) * (s.b.x - s.a.x) + (p.y - s.a.y) * (s.b.y - s.a.y)) / (s.len * s.len || 1)))
        const d = Math.hypot(s.a.x + u * (s.b.x - s.a.x) - p.x, s.a.y + u * (s.b.y - s.a.y) - p.y)
        if (d < best.d) best = { d, t: (s.at + u * s.len) / acc }
      }
      return best
    }
    const pl = { ...st.placements }
    for (const k of Object.keys(pl)) pl[k] = null
    const cursed = new Set((map.tiles ?? []).filter((t) => t.danger).map((t) => t.id))
    const beside = map.slots.map((s) => ({ id: s.id, ...along(s.pos) })).filter((s) => s.d <= 1.6 * T && slots.includes(s.id) && !cursed.has(s.id))
    const pick = []
    for (const f of [0.22, 0.45, 0.66, 0.84]) {
      const c = beside.filter((s) => !pick.includes(s.id)).sort((a, b) => Math.abs(a.t - f) - Math.abs(b.t - f))[0]
      if (c) pick.push(c.id)
    }
    roster.forEach((s, i) => { if (pick[i]) pl[pick[i]] = s.id })
    const sp = []
    const add = (typeId, n, t0, dt) => { for (let i = 0; i < n; i++) sp.push({ typeId, at: t0 + i * dt, hpMult: 3.2 }) }
    add('torch1', 5, 0, 0.45)
    add('tnt2_warded', 1, 0.6, 0)
    add('torch2', 3, 0.9, 0.5)
    add('barrel1', 1, 1.2, 0)
    add('torch3_plated', 2, 1.6, 0.6)
    add('torch2_swift', 2, 2.0, 0.4)
    add('tnt1', 3, 2.4, 0.4)
    add('torch4', 2, 2.9, 0.7)
    add('barrel3_warded', 1, 3.2, 0)
    add('tnt3', 2, 3.5, 0.5)
    add('barrel4', 1, 3.9, 0)
    add('torch1', 4, 4.2, 0.35)
    add('tnt4_plated', 1, 4.8, 0)
    add('torch3', 2, 5.1, 0.5)
    add('barrel2', 1, 5.6, 0)
    add('torch5', 1, 2.6, 0)
    g.setState({ roster, placements: pl, currentWave: { index: 0, label: 'Critique', isBoss: false, spawns: sp.sort((a, b) => a.at - b.at) } })
    return { ok: true, posted: Object.values(pl).filter(Boolean).length, slots: slots.length }
  }, { company, effects, neutral: company === 'neutral' })
}

// Environment hue bins: pixels that differ from the unit-free frame by a lot are
// units / shots / bars and are dropped; the rest is the field. `near` keeps the
// pixels within `reach` canvas px of the lane or a slot (sampled from the map).
async function bins(page) {
  return page.evaluate(() => {
    const c = document.querySelector('canvas')
    const g = window.__game.getState()
    const ctx = c.getContext('2d')
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let hue = 0, b0 = 0, b1 = 0, sat = 0, n = 0
    for (let i = 0; i < d.length; i += 4 * 3) {
      const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b)
      const l = (mx + mn) / 2, ch = mx - mn
      n++
      if (ch < 0.08 || l < 0.08 || l > 0.92) continue
      let h
      if (mx === r) h = 60 * (((gg - b) / ch) % 6)
      else if (mx === gg) h = 60 * ((b - r) / ch + 2)
      else h = 60 * ((r - gg) / ch + 4)
      if (h < 0) h += 360
      hue++
      sat += ch / (1 - Math.abs(2 * l - 1))
      if (h < 30) b0++
      else if (h < 60) b1++
    }
    return { hueShare: +(100 * hue / n).toFixed(1), red0_30: +(100 * b0 / hue).toFixed(1), gold30_60: +(100 * b1 / hue).toFixed(1), meanSat: +(100 * sat / hue).toFixed(1), enemies: g.engine ? g.engine.enemies.length : 0 }
  })
}

for (const vpKey of which === 'all' ? ['phone', 'desk'] : [which]) {
  const vp = VPS[vpKey]
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('  ! page error', e.message))
  for (const fx of fxs) {
    for (const co of SEASONS) {
      const r = await setup(page, co, fx)
      if (!r.ok) { console.error(co, vp.id, fx, r); continue }
      await page.waitForTimeout(500)
      const setupFile = `${OUT}/${co}-${fx}-${vp.id}-setup.png`
      if (fx === 'full') {
        await page.screenshot({ path: setupFile })
        // A hero armed for posting: the open tiles lit (the slots' job).
        await page.evaluate(() => { const g = window.__game; g.setState({ selectedSentinelId: g.getState().roster[1].id }) })
        await page.waitForTimeout(400)
        await page.screenshot({ path: `${OUT}/${co}-${fx}-${vp.id}-armed.png` })
        await page.evaluate(() => window.__game.setState({ selectedSentinelId: null }))
        await page.waitForTimeout(200)
      }
      await page.evaluate(() => { window.__game.getState().setSpeed?.(1); window.__game.getState().startWave() })
      await page.waitForTimeout(WAIT)
      const file = `${OUT}/${co}-${fx}-${vp.id}-wave.png`
      await page.screenshot({ path: file })
      const canvas = page.locator('canvas').first()
      await canvas.screenshot({ path: `${OUT}/${co}-${fx}-${vp.id}-canvas.png` })
      const m = await bins(page)
      report.push({ co, fx, vp: vp.id, ...m })
      console.log(co.padEnd(8), fx.padEnd(5), vp.id, JSON.stringify(m))
    }
  }
  await ctx.close()
}
writeFileSync(`${OUT}/bins.json`, JSON.stringify(report, null, 1))
await browser.close()
