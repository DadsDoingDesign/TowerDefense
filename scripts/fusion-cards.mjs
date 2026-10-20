/**
 * fusion-cards — the designer's cards for skill fusion (Oct 2026), drawn in
 * the running app's own CSS and icon atlas, each ≤ 700 px wide for a phone:
 *
 *  - `recipes.png`: every recipe, part + part → fusion, with its twist in one
 *    line (from `data/fusions.ts`, so it never drifts from the game);
 *  - `fusion.png`: the flow, from the shots `fusion-shots.mjs` took.
 *
 *   npx vite --port 5287 --strictPort &
 *   node scripts/fusion-shots.mjs <shots> p390
 *   node scripts/fusion-cards.mjs <shots> [outDir]
 *
 * Env: SHOTS_BASE (default http://127.0.0.1:5287/), PW_CHROMIUM.
 */
import fs from 'node:fs'
import path from 'node:path'

const SHOTS = path.resolve(process.argv[2] ?? 'docs/ui-audit-2026-10/fusion/shots')
const OUT = path.resolve(process.argv[3] ?? 'docs/ui-audit-2026-10/fusion')
const BASE = process.env.SHOTS_BASE ?? 'http://127.0.0.1:5287/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'))

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})
const ctx = await browser.newContext({ viewport: { width: 700, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.goto(BASE)
await page.waitForFunction(() => !!window.__meta, null, { timeout: 30000 })
await page.waitForTimeout(800)

const STYLE = `
  body { margin: 0; background: var(--bg); color: var(--text); font-family: Inter, system-ui, sans-serif; }
  #root, .app { display: none !important; }
  .card { width: 700px; box-sizing: border-box; padding: 22px 24px 26px; background: var(--bg); }
  .card h1 { margin: 0 0 2px; font-family: var(--font-display); font-size: 30px; color: var(--accent-text); }
  .card .sub { margin: 0 0 16px; color: var(--muted); font-size: 13px; }
  .lv { margin: 16px 0 6px; font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
  .row { display: grid; grid-template-columns: 1fr; gap: 3px; padding: 9px 10px 9px 12px; margin: 0 0 6px; border-radius: 6px; background: var(--panel); border-left: 3px solid var(--fz); }
  .eq { display: flex; align-items: center; gap: 6px; font-size: 14px; flex-wrap: wrap; }
  .eq .part { display: inline-flex; align-items: center; gap: 4px; color: var(--text); }
  .eq .op { color: var(--muted); font-weight: 800; }
  .eq .into { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-display); font-size: 19px; font-weight: 700; color: var(--text); }
  .eq .co { margin-left: auto; font-size: 11px; color: var(--muted); }
  .tw { font-size: 13px; font-weight: 700; color: var(--text); }
  .tw b { color: var(--fz); font-weight: 800; text-transform: uppercase; font-size: 10.5px; letter-spacing: .08em; margin-right: 6px; }
  .flow { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; align-items: start; }
  .flow figure { margin: 0; }
  .flow img { width: 100%; display: block; border-radius: 8px; border: 1px solid var(--line-strong); }
  .flow figcaption { margin-top: 6px; font-size: 12px; line-height: 1.35; color: var(--muted); }
  .flow figcaption b { color: var(--text); display: block; font-size: 13px; }
`

/* ------------------------------------------------------------ recipes.png */
await page.evaluate(async (style) => {
  const { FUSIONS, ELEMENT_TOKEN } = await import('/src/game/data/fusions.ts')
  const { skillById, skillHeadline } = await import('/src/game/data/skills.ts')
  const { iconCell } = await import('/src/game/data/iconAtlas.ts')
  const { companyById } = await import('/src/game/data/companies.ts')
  const icon = (k, lg) => {
    const { ix, iy } = iconCell(k)
    return `<span class="fw-i${lg ? ' lg' : ''}" style="--ix:${ix};--iy:${iy}"></span>`
  }
  const TWIST = { ricochet: 'Ricochet', focusStack: 'Focus', firstHit: 'First strike', overkill: 'Overkill', arcCarry: 'Arc carry', critFreeze: 'Freeze', heldBurst: 'Held burst', contagion: 'Contagion', deathBurst: 'Death burst', fanEvery: 'Fan', executeReady: 'Execute refund', frostSplash: 'Shatter', critAura: 'Crit aura', quakeEvery: 'Quake', frenzy: 'Frenzy' }
  const levels = [1, 2, 3].map((lv) => {
    const rows = FUSIONS.filter((f) => f.level === lv)
      .map((f) => {
        const [a, b] = f.parts.map((id) => skillById(id))
        const kind = TWIST[Object.keys(f.mods).find((k) => TWIST[k])] ?? 'Twist'
        return `<div class="row" style="--fz: var(${ELEMENT_TOKEN[f.element]})">
          <div class="eq"><span class="part">${icon(skillHeadline(a).icon)}${a.name}</span><span class="op">+</span><span class="part">${icon(skillHeadline(b).icon)}${b.name}</span><span class="op">→</span><span class="into">${icon(f.icon, true)}${f.name}</span><span class="co">${companyById(f.company).name}</span></div>
          <div class="tw"><b>${kind}</b>${f.twist}</div></div>`
      })
      .join('')
    const when = lv === 1 ? 'met at level 5' : lv === 2 ? 'met at level 10' : 'met at level 15'
    return `<p class="lv">Level ${lv} fusions · ${when}</p>${rows}`
  })
  document.head.insertAdjacentHTML('beforeend', `<style>${style}</style>`)
  document.body.insertAdjacentHTML(
    'beforeend',
    `<div class="card" id="recipes"><h1>Skill fusions</h1><p class="sub">Two skills a hero holds fuse into one, in one slot: both effects, plus a twist only the fusion has. ${FUSIONS.length} recipes.</p>${levels.join('')}</div>`,
  )
}, STYLE)
await page.waitForTimeout(500)
await page.locator('#recipes').screenshot({ path: path.join(OUT, 'recipes.png') })

/* ------------------------------------------------------------- fusion.png */
/** A shot, or its `-crop` (the panel that matters, cut by hand from the phone shot) when there is one. */
const img = (f) => {
  const crop = path.join(SHOTS, f.replace('-p390.png', '-crop.png'))
  const p = fs.existsSync(crop) ? crop : path.join(SHOTS, f)
  return fs.existsSync(p) ? `data:image/png;base64,${fs.readFileSync(p).toString('base64')}` : ''
}
const steps = [
  ['02-offer-fuses-p390.png', '1 · A card that fuses', 'At level 5 the hero holds Keen Eye; a card that fuses with it wears “Fuses”, and its card is the fusion’s.'],
  ['03-beat-b-p390.png', '2 · The fuse beat', 'The two cards slam together in the fusion’s colour. Under a second; still under reduced motion.'],
  ['04-hero-card-p390.png', '3 · One slot, two skills', 'The fusion sits in one slot; the next two milestones fill the others. Its read line names its parts.'],
  ['05-held-pair-p390.png', '4 · A pair already held', 'A hero holding both parts gets “Fuse” beside the cards: it frees a slot.'],
  ['06-codex-p390.png', '5 · The Codex', 'Every recipe: its parts and a “?” until made once, then the fusion, NEW.'],
  ['08-codex-found-p390.png', '6 · Found', 'A found fusion’s card: its recipe, what it does, its twist.'],
]
await page.evaluate((steps) => {
  document.getElementById('recipes')?.remove()
  const figs = steps.map(([src, t, c]) => `<figure>${src ? `<img src="${src}">` : ''}<figcaption><b>${t}</b>${c}</figcaption></figure>`).join('')
  document.body.insertAdjacentHTML('beforeend', `<div class="card" id="flow"><h1>Skill fusion</h1><p class="sub">“Kinda boring having my skills replace each other.” Now they fuse: a combo to chase, a slot to fill.</p><div class="flow">${figs}</div></div>`)
}, steps.map(([f, t, c]) => [img(f), t, c]))
await page.waitForTimeout(600)
await page.locator('#flow').screenshot({ path: path.join(OUT, 'fusion.png') })
await browser.close()
console.log('cards →', OUT)
