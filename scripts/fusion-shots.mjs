/**
 * fusion-shots — skill fusion (Oct 2026, `docs/SKILL_FUSION.md`) captured from
 * the RUNNING app: a milestone offer with a card that fuses, the fuse choice
 * for a pair already held, the fuse beat mid-flight, the hero card with a
 * fusion in its slot, and the Codex's Fusions (found and not).
 *
 *   npx vite --port 5287 --strictPort &
 *   node scripts/fusion-shots.mjs <outDir> [views] [fx]
 *
 * views: comma list of p390,d1280 (default both; p390 is 390 × 844 at DPR 2);
 * fx: full (default), light or off — the effects level the beat is shot at.
 * Each state is reached through the real store and controls (the dev handles
 * in `src/main.tsx`): a hero is raised to its milestone and handed the skills
 * that make the choice, as `run-shots.mjs` raises one to owe a skill.
 *
 * Env: SHOTS_BASE (default http://127.0.0.1:5287/), PW_CHROMIUM.
 */
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.argv[2] ?? 'docs/ui-audit-2026-10/fusion/shots')
const VIEW_ARG = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3].split(',') : null
const FX = process.argv[4] ?? 'full'
const BASE = process.env.SHOTS_BASE ?? 'http://127.0.0.1:5287/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'))

const VIEWS = {
  p390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  d1280: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
}

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})

async function open(view) {
  const ctx = await browser.newContext({ ...VIEWS[view], reducedMotion: FX === 'off' ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage()
  const log = []
  page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`))
  await page.goto(BASE)
  await page.waitForFunction(() => !!window.__meta, null, { timeout: 30000 })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(async (fx) => {
    localStorage.clear()
    const st = await import('/src/game/run/standing.ts')
    const sk = await import('/src/game/data/skills.ts')
    window.__meta.setState({
      bank: 1240,
      standing: { spice: st.standingXpToReach(3), art: st.standingXpToReach(2), metals: st.standingXpToReach(2), silk: st.standingXpToReach(1), scrolls: 0 },
      skills: sk.RANDOM_UNLOCK_SKILLS.slice(0, 12),
      stats: { ...window.__meta.getState().stats, runsCompleted: 6, runsWon: 4 },
    })
    const s = window.__settings.getState()
    window.__settings.setState({ taught: { ...s.taught, board: true, market: true, war: true, skill: true }, showEverything: true, effects: fx === 'light' ? 'light' : 'full' })
  }, FX)
  await page.waitForTimeout(400)
  await page.reload()
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 })
  await page.waitForTimeout(900)
  await page.evaluate(() => window.__game.getState().focusRoad('silk'))
  await page.waitForTimeout(300)
  const shot = async (name, wait = 450) => {
    await page.waitForTimeout(wait)
    await page.screenshot({ path: path.join(OUT, `${name}-${view}.png`) })
    log.push(`shot ${name}`)
  }
  return { ctx, page, shot, log, st: (fn, arg) => page.evaluate(fn, arg) }
}

const cta = async (p, wait = 1500) => {
  await p.page.locator('.pg-cta:visible').first().click({ timeout: 8000 })
  await p.page.waitForTimeout(wait)
}

/** Raise the first hero to `level`, holding `skills`, its milestones before it settled; open its Upgrade. */
async function owe(p, level, skills, picks, pool) {
  await p.st(
    ({ level, skills, picks, pool }) => {
      const g = window.__game
      const s = g.getState()
      const roster = s.roster.map((h, k) => (k === 0 ? { ...h, level, skills, skillPicks: picks } : h))
      g.setState({ roster, ...(pool ? { skillPool: pool } : {}) })
      const hero = roster[0]
      const free = s.battleMap.slots.filter((sl) => !Object.values(s.placements).includes(sl.id) && !s.placements[sl.id])
      if (!Object.values(s.placements).includes(hero.id)) {
        g.setState({ selectedSentinelId: hero.id })
        g.getState().placeOnSlot((free[Math.floor(free.length / 3)] ?? s.battleMap.slots[0]).id)
      }
      g.getState().shellSelect({ kind: 'hero', id: hero.id })
      if (innerWidth < 700 && !g.getState().detailOpen) g.getState().toggleDetail()
    },
    { level, skills, picks, pool },
  )
  await p.page.waitForTimeout(400)
  await p.page.locator('.sh-upgrade').first().click({ timeout: 4000 }).catch((e) => p.log.push('upgrade ' + e.message.slice(0, 60)))
  await p.page.waitForTimeout(600)
}

for (const view of VIEW_ARG ?? Object.keys(VIEWS)) {
  const p = await open(view)
  await cta(p) // home → terms
  await cta(p) // sign → pick
  await cta(p, 2500) // march → the opening fight

  // (a) A level-5 offer where cards fuse with the Keen Eye it holds.
  const pool = ['quick_hands', 'keen_eye', 'long_reach', 'frostbite', 'bounty', 'heavy_blows', 'long_shot', 'finisher', 'berserk', 'weaponmaster', 'volley', 'venom_spit', 'shield_wall', 'blessing']
  await owe(p, 5, ['keen_eye'], 0, pool)
  await p.shot('01-offer')
  const fusing = p.page.locator('.pk-tok:has(.fz-tag)').first()
  if (await fusing.count()) await fusing.click()
  else p.log.push('no fusing card on this offer')
  await p.shot('02-offer-fuses')

  // The beat: commit, hold it (its clock pushed out), and seek its animations
  // to frames in flight — a screenshot takes longer than a frame, so the
  // frames are set, not waited for. Then let it end.
  await p.page.locator('.sh-commit-2').first().click({ timeout: 3000 }).catch((e) => p.log.push('commit ' + e.message.slice(0, 60)))
  await p.st(async () => {
    const b = await import('/src/ui/shell/fuseBeat.ts')
    const s = b.useFuseBeat.getState().show
    if (s) b.useFuseBeat.setState({ show: { ...s, at: Date.now() + 1e6 } })
  })
  for (const [tag, ms] of [['a', 120], ['b', 290], ['c', 380], ['d', 900]]) {
    await p.st((ms) => document.getAnimations().forEach((a) => (a.pause(), (a.currentTime = ms))), ms)
    await p.page.waitForTimeout(80)
    await p.page.screenshot({ path: path.join(OUT, `03-beat-${tag}-${view}.png`) })
  }
  // FRAMES=1: the beat's panel every 40 ms, for the webp (`ffmpeg … -c:v libwebp_anim`).
  if (process.env.FRAMES) {
    fs.mkdirSync(path.join(OUT, `frames-${view}`), { recursive: true })
    const panel = p.page.locator('.fz-beat').first()
    for (let i = 0, ms = 0; ms <= 1000; i++, ms += 40) {
      await p.st((ms) => document.getAnimations().forEach((a) => (a.pause(), (a.currentTime = ms))), ms)
      await p.page.waitForTimeout(30)
      await panel.screenshot({ path: path.join(OUT, `frames-${view}`, `f${String(i).padStart(3, '0')}.png`) }).catch(() => {})
    }
  }
  await p.st(async () => (await import('/src/ui/shell/fuseBeat.ts')).endFuseBeat())
  await p.page.waitForTimeout(600)
  // The hero card, its fusion in the first slot: read it.
  await p.page.locator('.sh-sk.fused').first().click({ timeout: 3000 }).catch((e) => p.log.push('slot ' + e.message.slice(0, 60)))
  await p.shot('04-hero-card')

  // (b) A level-10 hero already holding a pair that fuses.
  await owe(p, 10, ['poison_tips', 'venom_spit'], 1, null)
  const pair = p.page.locator('.pk-tok[aria-label^="Fuse "]').first()
  if (await pair.count()) await pair.click()
  else p.log.push('no held pair token')
  await p.shot('05-held-pair')

  console.log(view, p.log.join(' · '))
  await p.ctx.close()

  // The Codex, in a fresh save with no run on the books: three found, the rest "?".
  const c = await open(view)
  await c.st(() => {
    const m = window.__meta.getState()
    window.__meta.setState({ codex: { ...m.codex, fusions: ['fz_thousand_cuts', 'fz_plaguebearer', 'fz_cinderburst'] } })
  })
  await c.page.waitForTimeout(500)
  await codexShots(c)
  console.log(view, c.log.join(' · '))
  await c.ctx.close()
}

async function codexShots(p) {
  await p.page.getByRole('button', { name: /Codex/ }).first().click({ timeout: 5000 }).catch((e) => p.log.push('codex ' + e.message.slice(0, 60)))
  await p.page.waitForTimeout(900)
  await p.page.getByRole('tab', { name: /^Skills/ }).first().click({ timeout: 3000 }).catch((e) => p.log.push('tab ' + e.message.slice(0, 60)))
  await p.page.waitForTimeout(600)
  await p.page.locator('.cx-sec[aria-label^="Fusions"]').first().scrollIntoViewIfNeeded().catch(() => {})
  await p.shot('06-codex')
  await p.page.locator('.cx-sec[aria-label^="Fusions"] .cx-tile').nth(1).click({ timeout: 3000 }).catch(() => {})
  await p.shot('07-codex-locked')
  await p.page.keyboard.press('Escape')
  await p.page.waitForTimeout(300)
  await p.page.locator('.cx-sec[aria-label^="Fusions"] .cx-tile').nth(0).click({ timeout: 3000 }).catch(() => {})
  await p.shot('08-codex-found')
}
await browser.close()
