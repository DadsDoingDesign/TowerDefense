/**
 * The battlefield's static art, rendered for the asset critique (Oct 2026,
 * `docs/ui-audit-2026-10/asset-critique/battlefield/`).
 *
 * Two modes, both through the real draw code in the running dev app:
 *
 *  - `bake`: the terrain bake (`terrain.drawField`) plus the wagon
 *    (`drawCaravan`) of each field below, in each company's season and the
 *    plain house look, saved 1:1 (one bake px per PNG px) so a crop can be
 *    blown up 3× with nothing smoothed;
 *  - `app`: a real battle (`window.__game`) on each company's road with its
 *    own danger ground, heroes posted, at setup, with a hero armed (the open
 *    tiles lit), and mid-wave under a crowded mixed wave, at 390×844 and
 *    1280×800.
 *
 *   npx vite --port 5255 --strictPort &
 *   node scripts/battlefield-critique.mjs <outDir> [bake|app|all] [phone|desk|all]
 *
 * playwright is not a dependency: set PW_MODULE to its index.mjs.
 */
import { mkdirSync, writeFileSync } from 'node:fs'

const PW = process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs'
const { chromium } = await import(PW)
const BASE = process.env.FIELD_BASE ?? 'http://localhost:5255/'
const CHROME = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const OUT = process.argv[2] ?? 'out/battlefield'
const MODE = process.argv[3] ?? 'all'
const WHICH = process.argv[4] ?? 'all'
const WAIT = Number(process.env.FIELD_WAIT ?? 6500)
const ONLY = process.env.FIELD_ONLY ? new Set(process.env.FIELD_ONLY.split(',')) : null
mkdirSync(OUT, { recursive: true })

/** Each company's road and its ground (`companies.ground.rules`); `neutral` is the house look on the Green Line. */
const JOBS = [
  { co: 'spice', field: 'gen.balanced.23', rule: 'wildfire' },
  { co: 'art', field: 'gen.winding.41', rule: 'flooded' },
  { co: 'metals', field: 'gen.switchbacks.53', rule: 'quarry' },
  { co: 'silk', field: 'gen.balanced.67', rule: 'flooded' },
  { co: 'scrolls', field: 'gen.winding.79', rule: 'hexed' },
  { co: 'neutral', field: 'first', rule: null },
  { co: 'spice', field: 'kiln', rule: null, tag: 'kiln' },
  { co: 'silk', field: 'first', rule: 'wildfire', tag: 'green' },
].filter((j) => !ONLY || ONLY.has(j.tag ?? j.co))
const HAZARD = 7

const browser = await chromium.launch({ executablePath: CHROME })

async function boot(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.__game)
}

// ── bake ────────────────────────────────────────────────────────────────────
if (MODE === 'bake' || MODE === 'all') {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('pageerror', (e) => console.error('  ! page error', e.message))
  await boot(page)
  for (const j of JOBS) {
    for (const orient of ['portrait']) {
      const png = await page.evaluate(
        async ({ j, orient, HAZARD }) => {
          const maps = await import('/src/game/data/maps.ts')
          const T = await import('/src/game/render/terrain.ts')
          const R = await import('/src/game/render/renderer.ts')
          const FS = await import('/src/game/data/fieldSeasons.ts')
          const id = j.field === 'first' ? maps.FIRST_MAP.id : j.field === 'kiln' ? maps.KILN_MAP.id : j.field
          const map = maps.fieldFor(id, j.rule, orient, HAZARD)
          const W = T.worldOf(map)
          const c = document.createElement('canvas')
          c.width = W.w
          c.height = W.h
          const ctx = c.getContext('2d')
          ctx.imageSmoothingEnabled = false
          ctx.translate(-W.x0, -W.y0)
          T.setFieldSeason(j.co === 'neutral' ? null : FS.FIELD_SEASONS[j.co])
          // The bake waits for the season's scatter to decode (part of its key).
          await new Promise((r) => setTimeout(r, 300))
          T.drawField(ctx, map)
          R.drawCaravan(ctx, map, { color: '#c6e05a', cargo: 1, company: j.co === 'neutral' ? 'spice' : j.co })
          T.setFieldSeason(null)
          return c.toDataURL('image/png')
        },
        { j, orient, HAZARD },
      )
      const file = `${OUT}/bake-${j.tag ?? j.co}-${orient}.png`
      writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'))
      console.log('bake', file)
    }
  }
  await page.close()
}

// ── app ─────────────────────────────────────────────────────────────────────
const VPS = { phone: { id: '390x844', width: 390, height: 844, orient: 'portrait' }, desk: { id: '1280x800', width: 1280, height: 800, orient: 'landscape' } }

async function battle(page, j, orient) {
  await boot(page)
  return page.evaluate(
    async ({ j, orient, HAZARD }) => {
      const seeds = await import('/src/state/seeds.ts')
      const heroes = await import('/src/game/run/heroes.ts')
      const maps = await import('/src/game/data/maps.ts')
      const g = window.__game
      window.__seasonOff = j.co === 'neutral'
      window.__settings.setState({ effects: 'full', autoContinue: false })
      window.__meta.setState({ bank: 5000 })
      g.getState().beginCampaign(424242, seeds.STANDARD_RUN, { company: j.co === 'neutral' ? 'spice' : j.co, crates: 0 })
      g.getState().marchOut('pick-0')
      const st = g.getState()
      if (st.screen !== 'battle') return { err: `screen ${st.screen}` }
      const id = j.field === 'first' ? maps.FIRST_MAP.id : j.field === 'kiln' ? maps.KILN_MAP.id : j.field
      const map = maps.fieldFor(id, j.rule, orient, HAZARD)
      const extra = [1, 2, 3].map((k) => heroes.chosenHero(9100 + k * 31, st.skillPool, st.itemPool, `pick-${k % 3}`)).filter(Boolean)
      const roster = [...st.roster, ...extra]
      // Posts beside the road at four points along it, off the danger ground.
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
      const T = map.tile ?? 40
      const bad = new Set((map.tiles ?? []).filter((t) => t.danger || t.block).map((t) => t.id))
      const beside = map.slots.map((s) => ({ id: s.id, ...along(s.pos) })).filter((s) => s.d <= 1.6 * T && !bad.has(s.id))
      const pick = []
      for (const f of [0.2, 0.42, 0.64, 0.84]) {
        const c = beside.filter((s) => !pick.includes(s.id)).sort((a, b) => Math.abs(a.t - f) - Math.abs(b.t - f))[0]
        if (c) pick.push(c.id)
      }
      const pl = Object.fromEntries(map.slots.map((s) => [s.id, null]))
      roster.forEach((s, i) => {
        if (pick[i]) pl[pick[i]] = s.id
      })
      const sp = []
      const add = (typeId, n, t0, dt) => {
        for (let i = 0; i < n; i++) sp.push({ typeId, at: t0 + i * dt, hpMult: 3.2 })
      }
      add('torch1', 5, 0, 0.45)
      add('tnt2_warded', 1, 0.6, 0)
      add('torch2', 3, 0.9, 0.5)
      add('barrel1', 1, 1.2, 0)
      add('torch3_plated', 2, 1.6, 0.6)
      add('tnt1', 3, 2.4, 0.4)
      add('torch4', 2, 2.9, 0.7)
      add('tnt3', 2, 3.5, 0.5)
      add('torch1', 4, 4.2, 0.35)
      add('torch5', 1, 2.6, 0)
      g.setState({ battleMap: map, roster, placements: pl, currentWave: { index: 0, label: 'Critique', isBoss: false, spawns: sp.sort((a, b) => a.at - b.at) } })
      return { ok: true, posted: pick.length, map: map.id }
    },
    { j, orient, HAZARD },
  )
}

if (MODE === 'app' || MODE === 'all') {
  for (const vk of WHICH === 'all' ? ['phone', 'desk'] : [WHICH]) {
    const vp = VPS[vk]
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vk === 'phone' ? 2 : 1 })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => console.error('  ! page error', e.message))
    for (const j of JOBS) {
      const name = `${j.tag ?? j.co}-${vp.id}`
      const r = await battle(page, j, vp.orient)
      if (!r.ok) {
        console.error(name, r)
        continue
      }
      await page.waitForTimeout(700)
      // The stage only: the battle canvas's box, cut from a viewport shot
      // (an element shot of the canvas comes back mis-scaled in this Chromium).
      const box = await page.evaluate(() => {
        const r = document.querySelector('canvas.battle-canvas').getBoundingClientRect()
        return { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(innerWidth, r.right) - Math.max(0, r.x), height: Math.min(innerHeight, r.bottom) - Math.max(0, r.y) }
      })
      const canvas = { screenshot: (o) => page.screenshot({ ...o, clip: box }) }
      await canvas.screenshot({ path: `${OUT}/${name}-setup.png` })
      await page.evaluate(() => {
        const g = window.__game
        g.setState({ selectedSentinelId: g.getState().roster[1].id })
      })
      await page.waitForTimeout(400)
      await canvas.screenshot({ path: `${OUT}/${name}-armed.png` })
      await page.evaluate(() => window.__game.setState({ selectedSentinelId: null }))
      await page.waitForTimeout(200)
      await page.evaluate(() => {
        window.__game.getState().setSpeed?.(1)
        window.__game.getState().startWave()
      })
      await page.waitForTimeout(WAIT)
      await canvas.screenshot({ path: `${OUT}/${name}-wave.png` })
      if (vk === 'phone') await page.screenshot({ path: `${OUT}/${name}-screen.png` })
      console.log('app', name, r.map, r.posted)
    }
    await ctx.close()
  }
}
await browser.close()
