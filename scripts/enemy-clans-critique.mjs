/**
 * The goblin clans under load, on every company's road (Oct 2026, the enemy
 * clans pass — `docs/DESIGN_REVIEW.md`).
 *
 * Drives the running app (dev build, `window.__game`) into a real battle on
 * the opening road of a contract for each company, posts four heroes, swaps
 * the wave for the crowded mixed one `field-critique.mjs` builds (tiers 1–4,
 * Plated / Warded / Swift elites, a tier-5 champion behind them) and shoots it
 * mid-wave — the real draw code. Per shot it also writes a GREYSCALE copy of
 * the canvas (the silhouette test: clans told apart by shape, not hue) and
 * measures the frame's JS cost (every rAF callback timed, ~4 s mid-wave).
 * `bench` is the same battle forced onto the hand-made Green Line, which keeps
 * the plain goblins.
 *
 *   npx vite --port 5225 --strictPort &
 *   node scripts/enemy-clans-critique.mjs <outDir> [phone|desk|all] [roads] [extras]
 *
 * roads: comma list of bench,spice,art,metals,silk,scrolls (default all);
 * extras: `ui` also shoots the wave preview, the enemy card and the Codex.
 * Env: CLAN_BASE (default http://localhost:5225/), PW_MODULE, PW_CHROMIUM.
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const PW = process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs'
const { chromium } = await import(PW)
const BASE = process.env.CLAN_BASE ?? 'http://localhost:5225/'
const CHROME = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const OUT = process.argv[2] ?? 'docs/ui-audit-2026-10/enemy-clans/r1'
const VPS = { phone: { id: '390x844', width: 390, height: 844 }, desk: { id: '1280x800', width: 1280, height: 800 } }
const which = process.argv[3] ?? 'all'
const ROADS = (process.argv[4] && process.argv[4] !== 'all' ? process.argv[4] : 'bench,spice,art,metals,silk,scrolls').split(',')
const EXTRAS = new Set((process.argv[5] ?? '').split(',').filter(Boolean))
const WAIT = Number(process.env.CLAN_WAIT ?? 8000)
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ executablePath: CHROME })
const report = []

/** Times every rAF callback: the JS cost of a frame (simulation + draw). */
const TIMER = () => {
  const raw = window.requestAnimationFrame.bind(window)
  window.__frameMs = []
  window.requestAnimationFrame = (cb) =>
    raw((t) => {
      const a = performance.now()
      cb(t)
      if (window.__frameMs.length < 20000) window.__frameMs.push(performance.now() - a)
    })
}

async function setup(page, road) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__game)
  return page.evaluate(async ({ road }) => {
    const seeds = await import('/src/state/seeds.ts')
    const heroes = await import('/src/game/run/heroes.ts')
    const maps = await import('/src/game/data/maps.ts')
    const g = window.__game
    window.__settings.setState({ effects: 'full', autoContinue: false })
    window.__meta.setState({ bank: 5000, stats: { ...window.__meta.getState().stats, runsCompleted: 12, runsWon: 4, bestDepth: 9 } })
    g.getState().beginCampaign(424242, seeds.STANDARD_RUN, { company: road === 'bench' ? 'spice' : road, crates: 0 })
    g.getState().marchOut('pick-0')
    if (road === 'bench') g.setState({ battleMap: maps.mapById('greenline') ?? maps.ALL_MAPS[0] })
    const st = g.getState()
    if (st.screen !== 'battle') return { err: `screen ${st.screen}` }
    const extra = [1, 2, 3].map((k) => heroes.chosenHero(9100 + k * 31, st.skillPool, st.itemPool, `pick-${k % 3}`)).filter(Boolean)
    const roster = [...st.roster, ...extra]
    const slots = Object.keys(st.placements)
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
    const pl = Object.fromEntries(map.slots.map((s) => [s.id, null]))
    const cursed = new Set((map.tiles ?? []).filter((t) => t.danger).map((t) => t.id))
    const beside = map.slots.map((s) => ({ id: s.id, ...along(s.pos) })).filter((s) => s.d <= 1.6 * T && !cursed.has(s.id))
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
    add('tnt5', 1, 4.4, 0)
    g.setState({ roster, placements: pl, currentWave: { index: 0, label: 'Critique', isBoss: false, spawns: sp.sort((a, b) => a.at - b.at) } })
    return { ok: true, posted: Object.values(pl).filter(Boolean).length, map: map.id }
  }, { road })
}

/** The canvas, greyscale (luma), written beside the colour shot. */
async function grey(page, file) {
  const data = await page.evaluate(() => {
    const c = document.querySelector('canvas.battle-canvas')
    const o = document.createElement('canvas')
    o.width = c.width
    o.height = c.height
    const x = o.getContext('2d')
    x.filter = 'grayscale(1)'
    x.drawImage(c, 0, 0)
    return o.toDataURL('image/png')
  })
  writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'))
}

const stat = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]
  return { n: s.length, mean: +(s.reduce((a, b) => a + b, 0) / (s.length || 1)).toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2) }
}

for (const vpKey of which === 'all' ? ['phone', 'desk'] : [which]) {
  const vp = VPS[vpKey]
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 })
  await ctx.addInitScript(TIMER)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.error('  ! page error', e.message))
  for (const road of ROADS) {
    const r = await setup(page, road)
    if (!r.ok) { console.error(road, vp.id, r); continue }
    await page.waitForTimeout(600)
    if (EXTRAS.has('ui')) {
      // The wave preview (setup), once the hire toasts have gone, and the
      // enemy card off its first portrait.
      await page.evaluate(() => window.__game.setState({ toasts: [] }))
      await page.waitForTimeout(3200)
      await page.screenshot({ path: `${OUT}/${road}-${vp.id}-preview.png` })
      const chip = page.locator('.sh-wavepre .sh-wq-chip, .sh-wq-chip').first()
      if (await chip.count()) {
        await chip.click().catch(() => {})
        await page.waitForTimeout(500)
        await page.screenshot({ path: `${OUT}/${road}-${vp.id}-card.png` })
        await page.keyboard.press('Escape').catch(() => {})
        await page.waitForTimeout(200)
      } else console.error('  ! no queue chip', road, vp.id)
    }
    if (process.env.CLAN_OFF) await page.evaluate(() => { window.__clanOff = true })
    await page.evaluate(() => { window.__game.getState().setSpeed?.(1); window.__game.getState().startWave() })
    await page.waitForTimeout(WAIT - 4000)
    await page.evaluate(() => { window.__frameMs.length = 0 })
    await page.waitForTimeout(4000)
    const ms = await page.evaluate(() => window.__frameMs.slice())
    const enemies = await page.evaluate(() => window.__game.getState().engine?.enemies.length ?? 0)
    await page.screenshot({ path: `${OUT}/${road}-${vp.id}-wave.png` })
    await page.locator('canvas.battle-canvas').first().screenshot({ path: `${OUT}/${road}-${vp.id}-canvas.png` })
    await grey(page, `${OUT}/${road}-${vp.id}-grey.png`)
    const row = { road, vp: vp.id, map: r.map, enemies, frame: stat(ms) }
    report.push(row)
    console.log(road.padEnd(7), vp.id, JSON.stringify(row.frame), 'enemies', enemies, r.map)
  }
  if (EXTRAS.has('ui')) {
    // The Codex's goblins tab, every clan met and every unit of it seen (no
    // run on the books, so no resume prompt over the home).
    const fresh = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 })
    const cpage = await fresh.newPage()
    await cpage.goto(BASE, { waitUntil: 'networkidle' })
    await cpage.waitForFunction(() => !!window.__meta)
    await cpage.evaluate(() => {
      const m = window.__meta.getState()
      const enemies = ['torch1', 'torch2', 'torch3', 'torch4', 'torch5', 'tnt1', 'tnt2', 'tnt3', 'tnt4', 'tnt5', 'barrel1', 'barrel2', 'barrel3', 'barrel4', 'barrel5']
      window.__meta.setState({ codex: { ...m.codex, enemies, clans: ['cinder', 'smudge', 'delve', 'silkcut', 'hexmoon'] }, stats: { ...m.stats, runsCompleted: 3 } })
    })
    await cpage.waitForTimeout(300)
    const codex = cpage.getByRole('button', { name: /Codex/ }).first()
    if (await codex.count()) {
      await codex.click()
      await cpage.waitForTimeout(500)
      await cpage.getByRole('tab', { name: /Goblins/ }).first().click().catch(() => {})
      await cpage.waitForTimeout(900)
      await cpage.screenshot({ path: `${OUT}/codex-${vp.id}.png` })
      await cpage.locator('.cx-body').first().screenshot({ path: `${OUT}/codex-${vp.id}-grid.png` }).catch(() => {})
    } else console.error('  ! no Codex button')
    await fresh.close()
  }
  await ctx.close()
}
writeFileSync(`${OUT}/frames.json`, JSON.stringify(report, null, 1))
await browser.close()
