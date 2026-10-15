/**
 * home-stability — the home's "no wiggle" proof, in the running app.
 *
 * The designer, October 2026: "when I pick the different companies the map
 * slightly shifts around and maybe the bg trees change up?? it should not do
 * that it should just change the selection." The cause was the card: its
 * chips wrapped to a different height per company, so the open area the map
 * fans its roads into moved, the map re-framed and its terrain re-baked.
 *
 * For a mid save and a veteran save, at 390×844 and 375×667 (phones, @2x)
 * and 1280×800 (desk), with reduced motion and without, this focuses each of
 * the five companies and Buy Company in turn and records:
 *
 *  - the map's frame: its geometry, a hash of its baked terrain and how many
 *    times the terrain was baked (`window.__tradeMapFrame()` / `__tradeMapPerf()`,
 *    dev builds only) and the canvas's size;
 *  - the box of every part of the home: the bar, the places, the season
 *    panel, the window, the foot, the dock and each slot, the Buy Company
 *    slot, the card, its head, each of its rows, the CTA, and every signpost.
 *
 * Every one must be IDENTICAL across the six focuses. It also checks, for each
 * focus, that no city label meets another, a signpost face, anything floating
 * over the map (the season panel, a note, the Buy Company slot) or the open
 * area's edge; that no signpost sits under a floating part; that the bar does
 * not overflow and each place's name fits its plate; that the places are
 * 44px tall; and that the Buy Company slot is a company slot's size, over the
 * dock's rightmost column. Exit code 1 on any failure.
 *
 * Usage (playwright is not a project dependency; see `ui-audit.mjs`):
 *   npx vite --port 5199 --strictPort &
 *   PW_CHROMIUM=<chrome binary, for playwright-core> node scripts/home-stability.mjs
 * Env: HOME_BASE (default http://localhost:5199/).
 */
const BASE = process.env.HOME_BASE ?? 'http://localhost:5199/'
const EXEC = process.env.PW_CHROMIUM

const loadChromium = async () => {
  for (const pkg of ['playwright', 'playwright-core']) {
    try {
      return (await import(pkg)).chromium
    } catch {
      /* try the next one */
    }
  }
  console.error('home-stability: install playwright or playwright-core first (see the header of this file).')
  process.exit(1)
}

const VIEWS = {
  '390x844': { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  '375x667': { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  '1280x800': { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
}
const FOCI = ['spice', 'art', 'metals', 'silk', 'scrolls', 'charter']
const SAVES = {
  mid: { runs: 6, bank: 340, standing: { spice: 3, art: 1 }, skills: 10, items: 8, season: { n: 1, contracts: 3, deliveries: { spice: 2, art: 0, metals: 0, silk: 0, scrolls: 0 }, log: ['spice', null, 'spice'] } },
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
}

/** Write a save through the dev handles (`src/main.tsx`), then reload into it. */
async function openHome(browser, view, save, motion) {
  const ctx = await browser.newContext({ ...VIEWS[view], reducedMotion: motion ? 'no-preference' : 'reduce' })
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e)))
  await page.goto(BASE)
  await page.waitForFunction(() => !!window.__meta, null, { timeout: 15000 })
  await page.evaluate(async (save) => {
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
  await page.waitForTimeout(400)
  await page.reload()
  await page.waitForFunction(() => document.querySelector('.tm-canvas.is-ready'), null, { timeout: 15000 })
  await page.waitForTimeout(600)
  return { ctx, page, errs }
}

/** Everything a pick must not move, and everything that must never collide. */
const measure = () => {
  const r = (sel) => {
    const e = document.querySelector(sel)
    if (!e) return null
    const b = e.getBoundingClientRect()
    return [b.left, b.top, b.width, b.height].map((n) => Math.round(n * 100) / 100).join(',')
  }
  const all = (sel) =>
    Array.from(document.querySelectorAll(sel))
      .map((e) => {
        const b = e.getBoundingClientRect()
        return [b.left, b.top, b.width, b.height].map((n) => Math.round(n * 100) / 100).join(',')
      })
      .join(' ')
  const cv = document.querySelector('.tm-canvas')
  const box = (e) => e.getBoundingClientRect()
  const hit = (a, b) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)
  const problems = []
  const towns = Array.from(document.querySelectorAll('.tm-town:not(.is-hidden)')).map(box)
  // A signpost's face: its 44px button less the 6px above and below.
  const signs = Array.from(document.querySelectorAll('.tm-pill')).map((e) => {
    const b = e.getBoundingClientRect()
    return { left: b.left, right: b.right, top: b.top + 6, bottom: b.bottom - 6 }
  })
  const notes = Array.from(document.querySelectorAll('.mn-under > .mn-season, .mn-notes > *, .mn-own')).map(box)
  const win = box(document.querySelector('.mn-window'))
  towns.forEach((t, i) => {
    towns.forEach((u, j) => j > i && hit(t, u) && problems.push(`city ${i} × city ${j}`))
    signs.forEach((s, j) => hit(t, s) && problems.push(`city ${i} × signpost ${j}`))
    notes.forEach((s, j) => hit(t, s) && problems.push(`city ${i} × note ${j}`))
    if (t.left < win.left || t.right > win.right || t.top < win.top || t.bottom > win.bottom) problems.push(`city ${i} outside the open area`)
  })
  signs.forEach((s, i) => {
    signs.forEach((u, j) => j > i && hit(s, u) && problems.push(`signpost ${i} × ${j}`))
    notes.forEach((n, j) => hit(s, n) && problems.push(`signpost ${i} under floating part ${j}`))
  })
  const bar = document.querySelector('.mn-bar')
  if (bar.scrollWidth > bar.clientWidth + 1) problems.push(`the bar overflows (${bar.scrollWidth} > ${bar.clientWidth})`)
  for (const p of document.querySelectorAll('.mn-place')) {
    const n = box(p.querySelector('.mn-place-name'))
    const b = box(p)
    if (n.left < b.left - 1 || n.right > b.right + 1) problems.push(`"${p.textContent}" is wider than its plate`)
    if (b.height < 44) problems.push(`"${p.textContent}" is under 44px`)
    if (b.right > window.innerWidth) problems.push(`"${p.textContent}" is past the screen's edge`)
  }
  const buy = document.querySelector('.mn-own')
  const slots = Array.from(document.querySelectorAll('.mn-dock .mn-slot')).map(box)
  if (buy && slots.length) {
    const b = box(buy)
    const last = slots[slots.length - 1]
    if (Math.abs(b.width - last.width) > 1 || Math.abs(b.height - last.height) > 1) problems.push('the Buy Company slot is not a company slot’s size')
    if (Math.abs(b.right - last.right) > 1 || b.bottom > last.top) problems.push('the Buy Company slot is not over the dock’s right end')
  }
  if (slots.length && slots.length !== 5) problems.push(`the dock has ${slots.length} slots`)
  return {
    keep: {
      frame: JSON.stringify(window.__tradeMapFrame?.() ?? null),
      bakes: window.__tradeMapPerf?.().bakes,
      canvas: cv ? `${cv.width}x${cv.height} @ ${r('.tm-canvas')}` : null,
      bar: r('.mn-bar'),
      places: all('.mn-place'),
      window: r('.mn-window'),
      foot: r('.mn-foot'),
      season: r('.mn-season'),
      buy: r('.mn-own'),
      dock: r('.mn-dock'),
      slots: all('.mn-dock .mn-slot'),
      card: r('.mn-card'),
      cardHead: r('.mn-card-head'),
      rows: all('.mn-fact'),
      cta: r('.mn-cta'),
      signposts: all('.tm-label'),
    },
    problems,
  }
}

const chromium = await loadChromium()
const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {})
let failed = 0
for (const save of Object.keys(SAVES)) {
  for (const view of Object.keys(VIEWS)) {
    for (const motion of [false, true]) {
      const { ctx, page, errs } = await openHome(browser, view, SAVES[save], motion)
      const runs = []
      for (const f of FOCI) {
        await page.evaluate((f) => window.__game.getState().focusRoad(f), f)
        await page.waitForTimeout(motion ? 500 : 250)
        runs.push(await page.evaluate(measure))
      }
      const moved = Object.keys(runs[0].keep).filter((k) => runs.some((x) => x.keep[k] !== runs[0].keep[k]))
      const problems = runs.flatMap((x, i) => x.problems.map((p) => `${FOCI[i]}: ${p}`))
      const ok = !moved.length && !problems.length && !errs.length && runs[0].keep.frame !== 'null'
      if (!ok) failed++
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${save} ${view}${motion ? ' (motion)' : ''}${moved.length ? ` — moved: ${moved.join(', ')}` : ''}${problems.length ? ` — ${problems.join('; ')}` : ''}${errs.length ? ` — ${errs.join('; ')}` : ''}`)
      await ctx.close()
    }
  }
}
await browser.close()
console.log(failed ? `${failed} failed` : 'every pick keeps the home’s geometry, its framing and its terrain')
process.exit(failed ? 1 : 0)
