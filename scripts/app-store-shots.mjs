/**
 * app-store-shots — the App Store screenshots for the 6.9" iPhone size
 * (1320 × 2868 portrait PNGs), captured from the RUNNING app.
 *
 *   01-battle   a late fight mid-wave: five heroes posted, a road full of raiders
 *   02-home     the contract board (the trade map, five companies' roads)
 *   03-merge    a skill milestone: the cards, and a held skill a card merges into
 *   04-map      the run map, part-way down the road
 *   05-hq       the HQ: the castle built up, the five upgrades
 *   06-boss     an act boss on the field, its bar across the top
 *
 * It drives the app through its real controls (the CTAs, the home's buttons)
 * and its real store (the dev handles in `src/main.tsx`), like `flow-shots.mjs`
 * and `run-shots.mjs`, so every pixel is the game's own render: no mockups, no
 * captions. Viewport 440 × 956 CSS px at DPR 3 (iPhone 16/17 Pro Max class),
 * touch, effects on Full, every coach tip already taught.
 *
 * Usage
 *   npx vite --port 5188 --strictPort &          # the dev server: the dev handles live there
 *   node scripts/app-store-shots.mjs [outDir] [only,scenes]
 *
 * outDir defaults to docs/app-store/screenshots; scenes are the names above
 * without their number (battle,home,merge,map,hq,boss). Needs `playwright`
 * (or `playwright-core`) importable or on NODE_PATH; sharp (a devDependency)
 * recompresses each PNG.
 *
 * Env: SHOTS_BASE (default http://localhost:5188/), PW_CHROMIUM (a Chrome or
 * Chromium binary for playwright-core; unset when using the bundled `playwright`).
 *
 * Honest shortcuts, all logged:
 *  - A mid/late-game company is SEEDED, not played: 31 contracts done,
 *    standing on every road, every card and item kind unlocked, the HQ built
 *    up, a militia founded, a season under way (the save `meta-shots.mjs`
 *    calls "veteran", plus HQ levels like `hq-shots.mjs`). The run itself is
 *    a fresh seed each time (`rng.newRunSeed` mixes in the clock), so names,
 *    roads and waves differ between captures: look at every shot.
 *  - A fight is reached by making its node the next reachable one
 *    (`run-shots.mjs` `enterStop`), with Threat set to what that depth
 *    carries (`threat.threatAtLayer`). The company is dressed for it: four
 *    hires trained to the leader (`recruits.scaledRecruit` + `withRecruits`),
 *    raised to the level the fight wants (10 for the battle, 14 for the
 *    boss), each holding two skills, with a 480-gold purse, and posted one
 *    per stretch of road on safe ground, kept apart so their figures do not
 *    overlap. The battle is the last act's fight with the biggest wave. The
 *    shot waits, at 2× speed, for a busy moment: raiders strung along the
 *    road (or the boss a quarter of the way in, calling each next sub-wave
 *    with its real button), then for any transient pill (coach note, ask
 *    tick) to fade. A fight that gives no such moment is played again on a
 *    fresh run (up to three tries).
 *  - The run map's progress is seeded: one connected path of nodes from the
 *    start to the middle of act 2 is marked cleared, with a 412-gold purse.
 *  - The merge screen raises the leader to a skill milestone holding the
 *    skills that make the choice, as `fusion-shots.mjs` does.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const OUT = path.resolve(process.argv[2] ?? 'docs/app-store/screenshots')
const ONLY = process.argv[3] ? new Set(process.argv[3].split(',')) : null
const BASE = process.env.SHOTS_BASE ?? 'http://localhost:5188/'
const EXEC = process.env.PW_CHROMIUM

const loadChromium = async () => {
  for (const pkg of ['playwright', 'playwright-core']) {
    try {
      return (await import(pkg)).chromium
    } catch {
      /* try the next one */
    }
  }
  // A global install (NODE_PATH) is visible to require, not to import.
  const require = createRequire(import.meta.url)
  for (const pkg of ['playwright', 'playwright-core']) {
    try {
      return require(pkg).chromium
    } catch {
      /* try the next one */
    }
  }
  console.error('app-store-shots: install playwright or playwright-core first (see the header of this file).')
  process.exit(1)
}
const loadSharp = async () => {
  try {
    return (await import('sharp')).default
  } catch {
    return null
  }
}

/** The 6.9" display: 1320 × 2868 px. */
const VIEW = { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
const SIZE = { width: 1320, height: 2868 }

/** The veteran company (see the header). */
const SAVE = {
  bank: 12480,
  runs: 31,
  won: 24,
  standing: { spice: 7, art: 4, metals: 5, silk: 3, scrolls: 5 },
  term: { metals: 2 },
  upgrades: { deal: 3, hiring: 1, pack: 3, focus: 2, scouting: 1 },
  focus: 'spice',
  militia: { name: 'The Lantern Guard', shape: 'swallow', tincture: 'crimson', charge: 'keep', pattern: 'plain', tincture2: 'sable', metal: 'gold' },
  season: {
    n: 3,
    contracts: 4,
    shares: { spice: 27, art: 14, metals: 32, silk: 11, scrolls: 16 },
    deliveries: { spice: 1, art: 0, metals: 2, silk: 0, scrolls: 0 },
    log: ['metals', 'spice', null, 'metals'],
  },
  fusions: 9,
  relics: 14,
}

/** Two skills each, for the dressed company: fire, poison, arrows — no sparks (a spark meeting a frosted raider stacks "SHATTER" labels). */
const KITS = [
  ['wildfire', 'hard_hitter'],
  ['fz_hail_of_arrows', 'keen_eye'],
  ['poison_tips', 'cleave'],
  ['volley', 'long_shot'],
  ['fz_cinderburst', 'heavy_blows'],
]

fs.mkdirSync(OUT, { recursive: true })
const chromium = await loadChromium()
const sharp = await loadSharp()
const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {})
const want = (s) => !ONLY || ONLY.has(s)
const log = []

/** A page on the seeded save, at home; `company` is the road in focus. */
async function open(company = 'spice', { motion = true } = {}) {
  const ctx = await browser.newContext({ ...VIEW, reducedMotion: motion ? 'no-preference' : 'reduce' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`))
  await page.goto(BASE)
  await page.waitForFunction(() => !!window.__meta, null, { timeout: 30000 })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(async (save) => {
    localStorage.clear()
    const st = await import('/src/game/run/standing.ts')
    const tr = await import('/src/game/run/track.ts')
    const sk = await import('/src/game/data/skills.ts')
    const ik = await import('/src/game/data/itemKinds.ts')
    const tw = await import('/src/game/run/tradeWar.ts')
    const stg = await import('/src/state/staging.ts')
    const ss = await import('/src/state/settingsStore.ts')
    const fz = await import('/src/game/data/fusions.ts')
    const en = await import('/src/game/data/enemies.ts')
    const rl = await import('/src/game/data/relics.ts')
    const m = window.__meta.getState()
    window.__meta.setState({
      bank: save.bank,
      upgrades: save.upgrades,
      focus: save.focus,
      standing: Object.fromEntries(Object.entries(save.standing).map(([c, lv]) => [c, st.standingXpToReach(lv) + ((save.term[c] ?? 1) > 1 ? tr.TERM_XP : 0)])),
      terms: save.term,
      skills: [...sk.RANDOM_UNLOCK_SKILLS],
      items: [...ik.UNLOCK_ITEM_KINDS],
      met: [...stg.IDEAS],
      militia: save.militia,
      season: { ...tw.freshSeason(), ...save.season },
      codex: {
        ...m.codex,
        fusions: fz.FUSIONS.slice(0, save.fusions).map((f) => f.id),
        enemies: Object.keys(en.ENEMY_TYPES),
        relics: rl.RELICS.slice(0, save.relics).map((r) => r.id),
      },
      stats: { ...m.stats, runsCompleted: save.runs, runsWon: save.won },
    })
    window.__settings.setState({ taught: Object.fromEntries(ss.TEACH_IDS.map((id) => [id, true])), showEverything: true, effects: 'full' })
  }, SAVE)
  await page.waitForTimeout(400)
  await page.reload()
  await page.waitForFunction(() => document.querySelector('.tm-canvas.is-ready'), null, { timeout: 30000 }).catch(() => log.push('home map not ready'))
  // Hold Full effects: the automatic step down to Light would only be the headless browser's frame rate.
  await page.evaluate(() => window.__fxQuality?.setFxAuto?.(false))
  await page.waitForTimeout(900)
  await page.evaluate((c) => window.__game.getState().focusRoad(c), company)
  await page.waitForTimeout(1200)
  const st = (fn, arg) => page.evaluate(fn, arg)
  const shot = async (name) => {
    const file = path.join(OUT, `${name}.png`)
    const raw = await page.screenshot({ type: 'png' })
    if (sharp) await sharp(raw).png({ compressionLevel: 9, effort: 10, adaptiveFiltering: true }).toFile(file)
    else fs.writeFileSync(file, raw)
    log.push(`shot ${name}`)
  }
  return { ctx, page, st, shot }
}

/**
 * Let the transient pills go before a shot: the coach strip's field note (it
 * names the cursed ground whenever a hero is opened in setup) and a company
 * ask's progress tick. Both fade on their own; this only waits for them.
 */
const pillsOff = (p, timeout = 10000) =>
  p.page
    .waitForFunction(() => !document.querySelector('.sh-coach') && !document.querySelector('.sh-asktick:not(.out)'), null, { timeout, polling: 100 })
    .catch(() => log.push('a pill was still up at the shot'))

const cta = async (p, wait = 1500) => {
  await p.page.locator('.pg-cta:visible').first().click({ timeout: 8000 })
  await p.page.waitForTimeout(wait)
}

/** Home → terms → sign → the hero pick (two taps: the home card's CTA, then the terms' CTA). */
async function toPick(p) {
  await p.page.locator('.mn-cta').first().click({ timeout: 8000 })
  await p.page.waitForTimeout(1500)
  await cta(p)
}

/** …→ choose the focused hero → the opening fight. */
async function toBattle(p) {
  await toPick(p)
  await cta(p, 2500)
}

/** The company of five, at `level`, each with two skills (see the header). */
async function dress(p, level) {
  const names = await p.st(
    async ({ level, kits }) => {
      const g = window.__game
      const { RNG } = await import('/src/game/core/rng.ts')
      const rec = await import('/src/game/run/recruits.ts')
      const lvl = await import('/src/game/engine/leveling.ts')
      const items = await import('/src/game/data/items.ts')
      const rng = new RNG(9071)
      const s = g.getState()
      const hub = { statBonus: 0, trained: true, itemPool: s.itemPool, slate: 4 }
      const hires = []
      for (let i = 0; i < 4; i++) hires.push(rec.scaledRecruit(rng, [s.roster[0], ...hires], hub))
      const loot = Array.from({ length: 6 }, (_, k) => items.generateItem(rng, { depth: 3 + k }))
      const w = rec.withRecruits([s.roster[0]], hires, loot, s.relics)
      const roster = w.roster.map((h, k) => ({
        ...lvl.applyXp(h, Math.max(0, lvl.xpToReach(level) - (h.xp ?? 0))),
        skills: kits[k],
        // Every milestone the level has passed, settled: no "Skill ↑" owed.
        skillPicks: level >= 15 ? 3 : level >= 10 ? 2 : level >= 5 ? 1 : 0,
      }))
      // A purse that has been on the road a while.
      g.setState({ roster, inventory: w.inventory, gold: 480 })
      return roster.map((h) => `${h.name} L${h.level}`)
    },
    { level, kits: KITS },
  )
  log.push(`dressed: ${names.join(', ')}`)
}

/**
 * Make a node of `type` the next stop and step onto it, at the Threat its
 * depth carries. `pick`: 'deep' the deepest such node; 'crowd' the one in the
 * last act whose wave fields the most raiders (read off the same
 * `waves.nodeEncounter` the store deals it from); else the shallowest.
 */
async function enterNode(p, type, pick = 'first') {
  const r = await p.st(
    async ({ type, pick }) => {
      const g = window.__game
      const th = await import('/src/game/run/threat.ts')
      const wv = await import('/src/game/data/waves.ts')
      const mp = await import('/src/game/run/map.ts')
      const ch = await import('/src/game/run/charter.ts')
      const s = g.getState()
      const all = s.runMap.nodes.filter((x) => x.type === type && !s.clearedNodeIds.includes(x.id)).sort((a, b) => a.layer - b.layer)
      const size = (x) => wv.nodeEncounter(mp.encounterNode(x), s.runSeed, ch.encounterRulesOf(s.contract))?.spawns.length ?? 0
      const last = all.filter((x) => th.actOf(x.layer) === th.ACTS)
      const n =
        pick === 'deep' ? all[all.length - 1] : pick === 'crowd' ? (last.length ? last : all).reduce((a, b) => (size(b) > size(a) ? b : a)) : all[0]
      if (!n) return null
      if (s.screen === 'battle') g.setState({ screen: 'map' })
      g.setState({ reachableNodeIds: [n.id], event: null, merchant: null, shrineOffer: null, threat: th.threatAtLayer(n.layer) })
      g.getState().selectNode(n.id)
      const w = g.getState().currentWave
      return `${n.type} at depth ${n.layer}, ${w?.spawns?.length ?? 0} raiders, Threat ×${g.getState().threat.toFixed(2)}`
    },
    { type, pick },
  )
  log.push(r ? `entered ${r}` : `no ${type} node`)
  await p.page.waitForTimeout(1800)
  return !!r
}

/**
 * Post the whole company along the road: the road up to the wagons is cut
 * into one stretch per hero, and each hero takes the open tile (never cursed
 * ground) nearest its stretch's middle, at least `gap` tiles from any other
 * hero. Shooters and casters take the early stretches and swingers the late
 * ones, so a hold does not pile the whole wave up at the first bend.
 */
async function postAll(p, gap = 2) {
  const placed = await p.st(
    async (gap) => {
      const g = window.__game
      const pl = await import('/src/game/run/placement.ts')
      const gear = await import('/src/game/data/gear.ts')
      const s0 = g.getState()
      const map = s0.battleMap
      const tile = map.tile ?? 40
      const road = pl.roadOf(map)
      const end = pl.gateDistance(road, map.base)
      const danger = new Set((map.tiles ?? []).filter((t) => t.danger).map((t) => t.id))
      const open = map.slots.filter((t) => !danger.has(t.id))
      const heroes = [...s0.roster].sort((a, b) => (gear.heroStyle(a) === 'swing') - (gear.heroStyle(b) === 'swing'))
      const taken = []
      const out = []
      heroes.forEach((h, k) => {
        const aim = road.pointAt((end * (k + 0.6)) / (heroes.length + 0.4))
        const near = open
          .filter((t) => !taken.some((q) => Math.hypot(q.x - t.pos.x, q.y - t.pos.y) < gap * tile))
          .sort((a, b) => Math.hypot(a.pos.x - aim.x, a.pos.y - aim.y) - Math.hypot(b.pos.x - aim.x, b.pos.y - aim.y))
        for (const t of near) {
          g.setState({ selectedSentinelId: h.id })
          g.getState().placeOnSlot(t.id)
          if (g.getState().placements[t.id] === h.id) {
            taken.push(t.pos)
            break
          }
        }
        out.push(Object.values(g.getState().placements).includes(h.id))
      })
      g.setState({ selectedSentinelId: null })
      return out
    },
    gap,
  )
  log.push(`posted ${placed.filter(Boolean).length} of ${placed.length}`)
  await p.page.waitForTimeout(600)
}

/** Start the wave at 2× and wait for a busy moment: at least `min` raiders on the field and something in the air. */
async function busyMoment(p, { min = 14, settle = 900, timeout = 40000, boss = false } = {}) {
  await p.page.getByRole('button', { name: /Start Wave/ }).first().click({ timeout: 6000 })
  await p.st(() => window.__game.getState().setSpeed?.(2))
  const t0 = Date.now()
  let best = 0
  while (Date.now() - t0 < timeout) {
    await p.page.waitForTimeout(200)
    const n = await p.st((boss) => {
      const e = window.__game.getState().engine
      if (!e) return -1
      const alive = e.enemies.filter((x) => x.hp > 0)
      // The boss well onto the field (a quarter of the road), not still at the edge.
      if (boss) return alive.some((x) => x.type?.isBoss && x.distance >= 0.25 * e.path.length) ? alive.length : 0
      // Spread along the road, not one knot: count only when the field's raiders span a quarter of it.
      const d = alive.map((x) => x.distance)
      const span = d.length ? (Math.max(...d) - Math.min(...d)) / e.path.length : 0
      return span >= 0.25 ? alive.length : 0
    }, boss)
    if (n < 0) break
    best = Math.max(best, n)
    // Between sub-waves, call the next one in (the real control) rather than wait out the lull.
    if (boss && n < min) await p.page.getByRole('button', { name: 'Send the next sub-wave' }).first().click({ timeout: 150 }).catch(() => {})
    if (n >= min) {
      await p.page.waitForTimeout(settle)
      await pillsOff(p, 4000)
      log.push(`busy moment: ${n} raiders on the field after ${((Date.now() - t0) / 1000).toFixed(1)} s`)
      return true
    }
  }
  log.push(`no busy moment (most raiders at once: ${best})`)
  return false
}

// ---------------------------------------------------------------------------

async function battle() {
  const p = await open('spice')
  await toBattle(p)
  await dress(p, 10)
  await enterNode(p, 'battle', 'crowd')
  await postAll(p)
  if (!(await busyMoment(p, { min: 26, settle: 1000 }))) return p.ctx.close().then(() => false)
  await p.shot('01-battle')
  await p.ctx.close()
}

async function home() {
  const p = await open('metals')
  await p.page.waitForTimeout(1500)
  await p.shot('02-home')
  await p.ctx.close()
}

async function merge() {
  // Butcherblock's road: its ground (flooded canals) puts no warning over the Stage.
  const p = await open('art')
  await toBattle(p)
  // Level 5, holding Frostbite: Keen Eye on the offer makes Rimecut dropped on it.
  await p.st(() => {
    const g = window.__game
    const s = g.getState()
    const roster = s.roster.map((h, k) => (k === 0 ? { ...h, level: 5, skills: ['frostbite'], skillPicks: 0 } : h))
    g.setState({ roster, skillPool: ['keen_eye', 'long_reach', 'quick_hands', 'heavy_blows', 'berserk'] })
    const hero = roster[0]
    const cursed = new Set((s.battleMap.tiles ?? []).filter((t) => t.danger).map((t) => t.id))
    const free = s.battleMap.slots.filter((sl) => !s.placements[sl.id] && !cursed.has(sl.id))
    g.setState({ selectedSentinelId: hero.id })
    g.getState().placeOnSlot((free[Math.floor(free.length / 3)] ?? s.battleMap.slots[0]).id)
    g.getState().shellSelect({ kind: 'hero', id: hero.id })
    if (innerWidth < 700 && !g.getState().detailOpen) g.getState().toggleDetail()
  })
  await p.page.waitForTimeout(500)
  await p.page.locator('.sh-upgrade').first().click({ timeout: 5000 })
  await p.page.waitForTimeout(700)
  await p.page.locator('.pk-tok[data-pick="skill:keen_eye"]').first().click().catch(() => log.push('merge: no Keen Eye token'))
  await p.page.waitForTimeout(400)
  await p.page.locator('.sk-slot[data-slot="0"]').first().click().catch(() => log.push('merge: no slot'))
  await p.page.waitForTimeout(700)
  await pillsOff(p)
  await p.page.waitForTimeout(300)
  await p.shot('03-merge')
  await p.ctx.close()
}

async function map() {
  const p = await open('silk')
  await toBattle(p)
  // One connected path from the start to the middle of act 2, cleared.
  const r = await p.st(() => {
    const g = window.__game
    const s = g.getState()
    const { nodes, edges } = s.runMap
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const start = nodes.find((n) => n.type === 'start') ?? nodes.reduce((a, b) => (a.layer <= b.layer ? a : b))
    const cleared = [start.id]
    let at = start
    const prefer = ['battle', 'elite', 'merchant', 'battle', 'campfire', 'miniboss', 'battle', 'shrine']
    for (let i = 0; i < 6; i++) {
      const next = edges.filter((e) => e.from === at.id).map((e) => byId.get(e.to)).filter(Boolean)
      if (!next.length) break
      at = next.find((n) => n.type === prefer[i]) ?? next[0]
      cleared.push(at.id)
    }
    const reach = edges.filter((e) => e.from === at.id).map((e) => e.to)
    g.setState({ screen: 'map', clearedNodeIds: cleared, currentNodeId: at.id, reachableNodeIds: reach, activeNodeId: null, currentWave: null, battlePhase: 'setup', gold: 412 })
    return `${cleared.length} nodes cleared to depth ${at.layer}`
  })
  log.push(`map: ${r}`)
  await p.page.waitForTimeout(1500)
  await p.shot('04-map')
  await p.ctx.close()
}

async function hq() {
  const p = await open('spice')
  await p.page.getByRole('button', { name: /^(HQ|Headquarters)/ }).first().click({ timeout: 6000 })
  await p.page.waitForTimeout(1800)
  await p.shot('05-hq')
  await p.ctx.close()
}

async function boss() {
  const p = await open('spice')
  await toBattle(p)
  await dress(p, 14)
  await enterNode(p, 'boss', 'deep')
  await postAll(p)
  if (!(await busyMoment(p, { min: 8, settle: 300, boss: true, timeout: 110000 }))) return p.ctx.close().then(() => false)
  await p.shot('06-boss')
  await p.ctx.close()
}

const SCENES = { battle, home, merge, map, hq, boss }
for (const [name, fn] of Object.entries(SCENES)) {
  if (!want(name)) continue
  // A fight is a fresh run each time: when no busy moment came, take it again.
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if ((await fn()) !== false) break
    } catch (e) {
      log.push(`ERR ${name}: ${e.message.split('\n')[0].slice(0, 200)}`)
    }
    log.push(`${name}: attempt ${attempt} gave no shot`)
  }
}
await browser.close()

// Every file must be exactly the 6.9" size.
if (sharp)
  for (const f of fs.readdirSync(OUT).filter((f) => /^\d\d-.*\.png$/.test(f))) {
    const m = await sharp(path.join(OUT, f)).metadata()
    if (m.width !== SIZE.width || m.height !== SIZE.height) log.push(`WRONG SIZE ${f}: ${m.width}×${m.height}`)
  }
console.log(log.join('\n'))
