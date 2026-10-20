/**
 * fusion-shots — ordered merges (Oct 2026, `docs/SKILL_FUSION.md`) captured
 * from the RUNNING app: a milestone offer whose card makes a named merge on a
 * held skill ("→ Rimecut ★"), a card mid-drag over a full hero's slot with
 * the slot's "→ result" preview, the drop chosen and read, the fuse beat in
 * flight, the hero card with a merge in its slot, a greater named merge, and
 * the Codex's Merges build tree (found and not).
 *
 *   npx vite --port 5287 --strictPort &
 *   node scripts/fusion-shots.mjs <outDir> [views] [fx]
 *
 * views: comma list of p390,d1280 (default both; p390 is 390 × 844 at DPR 2);
 * fx: full (default), light or off — the effects level the beat is shot at.
 * Each state is reached through the real store and controls (the dev handles
 * in `src/main.tsx`): a hero is raised to its milestone and handed the skills
 * — and the run a pool — that make the choice, as `run-shots.mjs` raises one
 * to owe a skill. The drag is a real pointer drag (down, move, hold).
 *
 * Env: SHOTS_BASE (default http://127.0.0.1:5287/), PW_CHROMIUM, FRAMES=1
 * (the beat's panel every 40 ms, for the webp).
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
  await page.evaluate(() => window.__game.getState().focusRoad('scrolls'))
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

/** Raise the first hero to `level`, holding `skills`, its milestones before it settled; give the run `pool`; open its Upgrade. */
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

/** Seek every running animation to `ms` (a screenshot is slower than a frame: frames are set, not waited for). */
const seek = (p, ms) => p.st((ms) => document.getAnimations().forEach((a) => (a.pause(), (a.currentTime = ms))), ms)
/**
 * Hold the beat on screen (push its clock out) while it is shot. On a slow
 * machine the beat can end before this lands: then it is shown again, as the
 * commit showed it (`fallback`: the merge and its [base, card]).
 */
const holdBeat = (p, fallback) =>
  p.st(async (fallback) => {
    const b = await import('/src/ui/shell/fuseBeat.ts')
    const s = b.useFuseBeat.getState().show ?? (fallback && { heroId: window.__game.getState().roster[0].id, fusionId: fallback[0], parts: fallback[1] })
    if (s) b.useFuseBeat.setState({ show: { ...s, at: Date.now() + 1e6 } })
  }, fallback)
const endBeat = async (p) => {
  await p.st(async () => (await import('/src/ui/shell/fuseBeat.ts')).endFuseBeat())
  await p.page.waitForTimeout(600)
}

for (const view of VIEW_ARG ?? Object.keys(VIEWS)) {
  const p = await open(view)
  await cta(p) // home → terms
  await cta(p) // sign → pick
  await cta(p, 2500) // march → the opening fight

  // 1. Level 5, holding Frostbite: Keen Eye is on the offer and makes Rimecut
  //    dropped on it (★); onto the empty slot it stays as it is.
  await owe(p, 5, ['frostbite'], 0, ['keen_eye', 'long_reach', 'quick_hands', 'heavy_blows', 'berserk'])
  await p.page.locator('.pk-tok[data-pick="skill:keen_eye"]').first().click().catch((e) => p.log.push('tok ' + e.message.slice(0, 60)))
  await p.shot('01-offer-builds')

  // 2. Level 15 and full: a card dragged over a held skill, the slot saying what it makes.
  const full = ['arc_spark', 'hard_hitter', 'bounty']
  await owe(p, 15, full, 2, ['frostbite', 'cleave', 'keen_eye', 'berserk', 'weaponmaster', 'volley', 'reaper'])
  const tok = p.page.locator('.pk-tok[data-pick^="skill:"]').first()
  const slot = p.page.locator('.sk-slot[data-slot="0"]').first()
  const a = await tok.boundingBox()
  const b = await slot.boundingBox()
  if (a && b) {
    await p.page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await p.page.mouse.down()
    for (let i = 1; i <= 8; i++) await p.page.mouse.move(a.x + a.width / 2 + ((b.x + b.width / 2 - a.x - a.width / 2) * i) / 8, a.y + a.height / 2 + ((b.y + b.height / 2 - a.y - a.height / 2) * i) / 8)
    await p.shot('02-drag-over-full', 300)
    await p.page.mouse.up()
  } else p.log.push('no token / slot box')
  // 3. Released over the slot: the card reads the merge; the CTA names it.
  await p.shot('03-drop-chosen')

  // 4. A named merge committed: the beat in flight.
  await owe(p, 5, ['frostbite'], 0, ['keen_eye', 'long_reach', 'quick_hands', 'heavy_blows', 'berserk'])
  await p.page.locator('.pk-tok[data-pick="skill:keen_eye"]').first().click().catch(() => {})
  await p.page.locator('.sk-slot[data-slot="0"]').first().click().catch((e) => p.log.push('slot ' + e.message.slice(0, 60)))
  await p.shot('04-named-chosen', 300)
  await p.page.locator('.sh-commit-2').first().click({ timeout: 3000 }).catch((e) => p.log.push('commit ' + e.message.slice(0, 60)))
  await holdBeat(p, ['fz_rimecut', ['frostbite', 'keen_eye']])
  for (const [tag, ms] of [['a', 120], ['b', 290], ['c', 380], ['d', 900]]) {
    await seek(p, ms)
    await p.page.waitForTimeout(80)
    await p.page.screenshot({ path: path.join(OUT, `05-beat-${tag}-${view}.png`) })
  }
  if (process.env.FRAMES) {
    fs.mkdirSync(path.join(OUT, `frames-${view}`), { recursive: true })
    const panel = p.page.locator('.fz-beat').first()
    for (let i = 0, ms = 0; ms <= 1000; i++, ms += 40) {
      await seek(p, ms)
      await p.page.waitForTimeout(30)
      await panel.screenshot({ path: path.join(OUT, `frames-${view}`, `f${String(i).padStart(3, '0')}.png`) }).catch(() => {})
    }
  }
  await endBeat(p)
  // 5. The hero card, the merge in its first slot: read it.
  await p.page.locator('.sh-sk.fused').first().click({ timeout: 3000 }).catch((e) => p.log.push('slot ' + e.message.slice(0, 60)))
  await p.shot('06-hero-card')

  // 6. A greater named merge: Volley dropped on Hail of Arrows makes Skyfall.
  await owe(p, 15, ['fz_hail_of_arrows', 'hard_hitter'], 2, ['volley', 'berserk', 'weaponmaster'])
  await p.page.locator('.pk-tok[data-pick="skill:volley"]').first().click().catch(() => {})
  await p.page.locator('.sk-slot[data-slot="0"]').first().click().catch((e) => p.log.push('greater ' + e.message.slice(0, 60)))
  await p.shot('07-greater')
  await p.page.locator('.sh-commit-2').first().click({ timeout: 3000 }).catch(() => {})
  await holdBeat(p, ['fz_skyfall', ['fz_hail_of_arrows', 'volley']])
  await seek(p, 900)
  await p.page.waitForTimeout(80)
  await p.page.screenshot({ path: path.join(OUT, `08-greater-beat-${view}.png`) })
  await endBeat(p)

  console.log(view, p.log.join(' · '))
  await p.ctx.close()

  // The Codex, in a fresh save with no run on the books: four found, the rest "?".
  const c = await open(view)
  await c.st(() => {
    const m = window.__meta.getState()
    window.__meta.setState({ codex: { ...m.codex, fusions: ['fz_rimecut', 'fz_hail_of_arrows', 'fz_skyfall', 'fz_cinderburst'] } })
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
  const sec = '.cx-sec[aria-label^="Merges"]'
  await p.page.locator(sec).first().scrollIntoViewIfNeeded().catch(() => {})
  await p.page.evaluate((sec) => document.querySelector(sec)?.scrollIntoView({ block: 'start' }), sec)
  await p.shot('09-codex-tree')
  await p.page.locator(`${sec} .cx-tile`).nth(2).click({ timeout: 3000 }).catch(() => {})
  await p.shot('10-codex-locked')
  await p.page.keyboard.press('Escape')
  await p.page.waitForTimeout(300)
  await p.page.locator(`${sec} .cx-tile[aria-label^="Skyfall"]`).first().click({ timeout: 3000 }).catch(() => {})
  await p.shot('11-codex-found')
}
await browser.close()
