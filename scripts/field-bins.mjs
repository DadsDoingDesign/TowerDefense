/**
 * The terrain bake's hue bins against the enemies' reserved tier hues, per
 * season (Oct 2026 job critique; the measure the season-accent call rests on).
 *
 * Bakes the real terrain (`render/terrain.drawField`) of a real battle's field
 * in the running dev app, once per variant, each in a fresh module instance
 * (a fresh bake cache), and counts the hue-carrying pixels (HSL saturation
 * ≥ 12 %, lightness 8–92 %) in each tier's bin: t1 red 0–30°, t4 gold 30–60°,
 * t2 blue 195–225°, t3 purple 255–285° (as a share of the hue-carrying
 * pixels), and the pixels STRONG enough to be mistaken for a tier's colour
 * (saturation ≥ 25 %; tier 4's gold is 61 %) in red, gold and blue, as a share of
 * every pixel in the region. Two regions: NEAR (within 1.5 tiles of
 * the drawn road or a slot's centre: where units stand and walk) and the
 * PLAY rectangle.
 *
 *   npx vite --port 5215 --strictPort &
 *   node scripts/field-bins.mjs            (FIELD_PNG=<dir> also saves each bake)
 */
const PW = process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs'
const { chromium } = await import(PW)
const BASE = process.env.FIELD_BASE ?? 'http://localhost:5215/'
const CHROME = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const COS = (process.env.FIELD_SEASONS ?? 'spice,art,metals,silk,scrolls').split(',')

const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForFunction(() => !!window.__game)

const rows = await page.evaluate(async (cos) => {
  const seeds = await import('/src/state/seeds.ts')
  const FS = await import('/src/game/data/fieldSeasons.ts')
  const g = window.__game
  g.getState().beginCampaign(424242, seeds.STANDARD_RUN, { company: 'spice', crates: 0 })
  g.getState().marchOut('pick-0')
  await new Promise((r) => setTimeout(r, 800))
  const map = g.getState().battleMap
  let n = 0
  async function bake(season) {
    const T = await import(`/src/game/render/terrain.ts?bins=${n++}`)
    const W = T.worldOf(map)
    const c = document.createElement('canvas')
    c.width = W.w
    c.height = W.h
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.translate(-W.x0, -W.y0)
    T.setFieldSeason(season)
    T.drawField(ctx, map)
    return { T, W, d: ctx.getImageData(0, 0, W.w, W.h).data, png: c.toDataURL('image/png') }
  }
  // Region masks, in bake px.
  const first = await bake(null)
  const { W } = first
  const tile = map.tile ?? 40
  const reach = 1.5 * tile
  const mk = document.createElement('canvas')
  mk.width = W.w
  mk.height = W.h
  const m = mk.getContext('2d', { willReadFrequently: true })
  m.translate(-W.x0, -W.y0)
  m.strokeStyle = '#fff'
  m.fillStyle = '#fff'
  m.lineCap = 'round'
  m.lineJoin = 'round'
  m.lineWidth = 2 * reach
  const road = first.T.drawnRoad(map)
  m.beginPath()
  road.forEach((p, i) => (i ? m.lineTo(p.x, p.y) : m.moveTo(p.x, p.y)))
  m.stroke()
  for (const s of map.slots) {
    m.beginPath()
    m.arc(s.pos.x, s.pos.y, tile, 0, Math.PI * 2)
    m.fill()
  }
  const near = m.getImageData(0, 0, W.w, W.h).data
  const pr = first.T.playRect(map)
  function bins(d) {
    const out = {}
    for (const region of ['near', 'play']) {
      let all = 0, hue = 0, red = 0, gold = 0, blue = 0, purple = 0, sat = 0, sRed = 0, sGold = 0, sBlue = 0
      for (let y = 0; y < W.h; y += 1) {
        const fy = y + W.y0
        for (let x = 0; x < W.w; x += 1) {
          const i = (y * W.w + x) * 4
          if (region === 'near' ? near[i + 3] === 0 : x + W.x0 < pr.x0 || x + W.x0 > pr.x1 || fy < pr.y0 || fy > pr.y1) continue
          all++
          const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255
          const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b)
          const l = (mx + mn) / 2, ch = mx - mn
          if (l < 0.08 || l > 0.92 || ch === 0) continue
          const s = ch / (1 - Math.abs(2 * l - 1))
          if (s < 0.12) continue
          let h = mx === r ? 60 * (((gg - b) / ch) % 6) : mx === gg ? 60 * ((b - r) / ch + 2) : 60 * ((r - gg) / ch + 4)
          if (h < 0) h += 360
          hue++
          sat += s
          if (h < 30) { red++; if (s >= 0.25) sRed++ }
          else if (h < 60) { gold++; if (s >= 0.25) sGold++ }
          else if (h >= 195 && h < 225) { blue++; if (s >= 0.25) sBlue++ }
          else if (h >= 255 && h < 285) purple++
        }
      }
      const pc = (v) => +((100 * v) / Math.max(1, hue)).toFixed(1)
      const pa = (v) => +((100 * v) / Math.max(1, all)).toFixed(1)
      out[region] = { red: pc(red), gold: pc(gold), blue: pc(blue), purple: pc(purple), sat: +((100 * sat) / Math.max(1, hue)).toFixed(1), strongRed: pa(sRed), strongGold: pa(sGold), strongBlue: pa(sBlue) }
    }
    return out
  }
  const rows = [{ co: 'plain', v: 'plain', ...bins(first.d), png: first.png }]
  for (const co of cos) {
    const s = FS.FIELD_SEASONS[co]
    const had = s.accent
    const now = await bake(s)
    rows.push({ co, v: 'now', ...bins(now.d), png: now.png })
    if (had) {
      s.accent = false
      const off = await bake(s)
      rows.push({ co, v: 'no-accent', ...bins(off.d), png: off.png })
      s.accent = had
    }
  }
  return rows
}, COS)

const PNG = process.env.FIELD_PNG
if (PNG) {
  const { mkdirSync, writeFileSync } = await import('node:fs')
  mkdirSync(PNG, { recursive: true })
  for (const r of rows) writeFileSync(`${PNG}/bake-${r.co}-${r.v}.png`, Buffer.from(r.png.split(',')[1], 'base64'))
}
for (const r of rows) {
  const f = (o) => `red ${String(o.red).padStart(5)} gold ${String(o.gold).padStart(5)} blue ${String(o.blue).padStart(5)} purp ${String(o.purple).padStart(4)} sat ${String(o.sat).padStart(4)} | s≥25%: red ${String(o.strongRed).padStart(4)} gold ${String(o.strongGold).padStart(4)} blue ${String(o.strongBlue).padStart(4)}`
  console.log(`${r.co.padEnd(7)} ${r.v.padEnd(9)} NEAR ${f(r.near)}  |  PLAY ${f(r.play)}`)
}
await browser.close()
