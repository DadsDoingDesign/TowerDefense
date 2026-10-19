/**
 * peoples-shots — the peoples' new items and skills, captured from the RUNNING
 * app for the design review (Oct 2026): the merchant's shelf and one of its
 * wares' cards, the spoils, an owed skill choice, the Codex's Items and Skills
 * tabs and a tile's card, and a live battle with new gear on the figures.
 *
 *   npx vite --port 5231 --strictPort &
 *   node scripts/peoples-shots.mjs <outDir>
 *
 * Every state is reached through the real store and controls (the dev handles
 * in `src/main.tsx`); the shortcuts are named: the save has every kind and
 * card unlocked (a veteran's), a hero is raised to level 10 to owe a Level 2
 * skill, the company is dressed in new kinds dealt by the real generator, and
 * a stop is entered by making its node the next reachable one.
 *
 * Env: SHOTS_BASE (default http://127.0.0.1:5231/), PW_CHROMIUM.
 */
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.argv[2] ?? 'peoples-shots')
const BASE = process.env.SHOTS_BASE ?? 'http://127.0.0.1:5231/'
const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'))

fs.mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 600 / 390, isMobile: true, hasTouch: true, reducedMotion: 'reduce' })
const page = await ctx.newPage()
const log = []
page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`))
const st = (fn, arg) => page.evaluate(fn, arg)
const shot = async (name, opts = {}) => {
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(OUT, `${name}.png`), ...opts })
  log.push(`shot ${name}`)
}
const cta = async (wait = 1500) => {
  await page.locator('.pg-cta:visible').first().click({ timeout: 8000 })
  await page.waitForTimeout(wait)
}

// ---- a veteran's save: every kind and card unlocked --------------------------
await page.goto(BASE)
await page.waitForFunction(() => !!window.__meta, null, { timeout: 30000 })
await page.waitForLoadState('networkidle').catch(() => {})
await st(async () => {
  localStorage.clear()
  const st = await import('/src/game/run/standing.ts')
  const sk = await import('/src/game/data/skills.ts')
  const ik = await import('/src/game/data/itemKinds.ts')
  window.__meta.setState({
    bank: 2400,
    standing: { spice: st.standingXpToReach(4), art: st.standingXpToReach(3), metals: st.standingXpToReach(4), silk: st.standingXpToReach(2), scrolls: st.standingXpToReach(2) },
    skills: [...sk.RANDOM_UNLOCK_SKILLS, ...Object.values(sk.SIGNATURE_SKILLS)],
    items: [...ik.UNLOCK_ITEM_KINDS],
    sovereign: [...ik.SOVEREIGN_ITEM_KINDS],
    stats: { ...window.__meta.getState().stats, runsCompleted: 9, runsWon: 6 },
  })
  const s = window.__settings.getState()
  window.__settings.setState({ taught: { ...s.taught, board: true, market: true, war: true }, showEverything: true })
})
await page.waitForTimeout(400)
await page.reload()
await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 })
await page.waitForTimeout(1200)

// ---- the Codex ---------------------------------------------------------------
await page.getByRole('button', { name: /^Codex/ }).first().click({ timeout: 8000 })
await page.waitForTimeout(1400)
await shot('codex-items')
// Scroll the grid to the off hands, where the new shields sit.
await page.locator('.cx-tile', { hasText: 'Kite Shield' }).first().scrollIntoViewIfNeeded().catch(() => {})
await shot('codex-items-offhand')
await page.locator('.cx-tile', { hasText: 'Kite Shield' }).first().click({ timeout: 4000 }).catch((e) => log.push('tile ' + e.message.slice(0, 80)))
await page.waitForTimeout(700)
await shot('codex-item-card')
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
await page.getByRole('tab', { name: /^Skills/ }).first().click({ timeout: 4000 }).catch((e) => log.push('skills tab ' + e.message.slice(0, 80)))
await page.waitForTimeout(800)
await page.locator('.cx-tile', { hasText: 'Banner Bearer' }).first().scrollIntoViewIfNeeded().catch(() => {})
await shot('codex-skills')
await page.locator('.cx-tile', { hasText: 'Bolder Bash' }).first().click({ timeout: 4000 }).catch((e) => log.push('skill tile ' + e.message.slice(0, 80)))
await page.waitForTimeout(700)
await shot('codex-skill-card')
await page.goto(BASE)
await page.waitForFunction(() => !!window.__game, null, { timeout: 30000 })
await page.waitForTimeout(1200)

// ---- a contract with Ironvein (the dwarves) -----------------------------------
await st(() => window.__game.getState().focusRoad('metals'))
await page.waitForTimeout(600)
await cta() // home → terms
await cta() // sign → pick
await cta(2600) // march → the opening fight

// Dress the company in new kinds (the real generator, forced kinds) and add a caster.
await st(async () => {
  const g = window.__game
  const items = await import('/src/game/data/items.ts')
  const { RNG } = await import('/src/game/core/rng.ts')
  const rng = new RNG(31337)
  const deal = (kind, rarity = 'rare') => items.generateItem(rng, { kind, rarity, allowCurse: false })
  const s = g.getState()
  const lead = s.roster[0]
  const knight = { ...lead, equipment: { mainHand: deal('Hand Hammer'), offHand: deal('Anvil Shield', 'epic'), body: deal('Stoneskin Mail') } }
  const caster = { ...lead, id: lead.id + '-g', name: 'Tansy', equipment: { mainHand: deal('Sprout Wand', 'epic'), offHand: deal('Herb Pouch'), body: deal('Mossweave Robe') } }
  const archer = { ...lead, id: lead.id + '-e', name: 'Ilsa', equipment: { mainHand: deal('Recurve Bow', 'legendary'), offHand: null, body: deal('Woven Vest') } }
  const spear = { ...lead, id: lead.id + '-r', name: 'Sszar', equipment: { mainHand: deal('Spear'), offHand: null, body: deal('Scale Hide') } }
  const pack = ['Kite Shield', 'Falchion', 'Thornrod', 'Twin Knives', 'Bearded Axe', 'Javelin Sling'].map((k, i) => deal(k, ['common', 'rare', 'epic'][i % 3]))
  g.setState({ roster: [knight, caster, archer, spear], inventory: pack, gold: 420 })
})
await page.waitForTimeout(500)
for (const [i, at] of [[0, 0.3], [1, 0.45], [2, 0.6], [3, 0.75]]) {
  await st(
    ({ i, at }) => {
      const g = window.__game
      const s = g.getState()
      const hero = s.roster[i]
      if (!hero) return
      const taken = new Set(Object.values(s.placements))
      const free = s.battleMap.slots.filter((sl) => !taken.has(sl.id) && !s.placements[sl.id])
      const slot = free[Math.floor(free.length * at)] ?? free[0]
      g.setState({ selectedSentinelId: hero.id })
      g.getState().placeOnSlot(slot.id)
    },
    { i, at },
  )
  await page.waitForTimeout(250)
}
await shot('battle-setup')

// A Level 2 skill owed: the hero at level 10, its first milestone settled.
// The offer is a hash of (run seed, hero id); the hero's id is stepped until
// the real offer shows at least two of the rosters' new cards.
await st(async () => {
  const g = window.__game
  const sk = await import('/src/game/run/skills.ts')
  const data = await import('/src/game/data/skills.ts')
  const s = g.getState()
  const base = s.roster[0]
  let hero = { ...base, level: 10, skillPicks: 1, skills: ['hard_hitter'] }
  for (let n = 0; n < 400; n++) {
    const h = { ...hero, id: `${base.id}-${n}` }
    const offer = sk.skillOffer(h, s.skillPool, s.runSeed)
    if (offer.filter((k) => data.PEOPLES_SKILLS.includes(k.id)).length >= 2) {
      hero = h
      break
    }
  }
  const placements = Object.fromEntries(Object.entries(s.placements).map(([tile, id]) => [tile, id === base.id ? hero.id : id]))
  g.setState({ roster: s.roster.map((h, k) => (k === 0 ? hero : h)), placements })
  g.getState().shellSelect({ kind: 'hero', id: hero.id })
  if (innerWidth < 700 && !g.getState().detailOpen) g.getState().toggleDetail()
})
await page.waitForTimeout(600)
await shot('hero-card')
await page.locator('.sh-upgrade').first().click({ timeout: 4000 }).catch((e) => log.push('upgrade ' + e.message.slice(0, 80)))
await page.waitForTimeout(800)
await shot('skill-choice')
// Focus each token in turn: a new card's own words.
for (let i = 0; i < 3; i++) {
  await page.locator('.pk-tok').nth(i).click({ timeout: 2000 }).catch(() => {})
  await page.waitForTimeout(400)
  await shot(`skill-choice-${i}`)
}
await st(() => {
  const g = window.__game
  g.getState().shellSelect(null)
  if (innerWidth < 700 && g.getState().detailOpen) g.getState().toggleDetail()
})
await page.waitForTimeout(400)

// The fight, live: the new gear on the figures.
await st(() => window.__game.getState().setSpeed?.(1))
await page.getByRole('button', { name: /Start Wave/ }).first().click({ timeout: 5000 }).catch((e) => log.push('start ' + e.message.slice(0, 80)))
await page.waitForTimeout(6500)
await shot('battle-live')
const box = await st(() => {
  const c = document.querySelector('canvas')
  const r = c?.getBoundingClientRect()
  return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null
})
if (box) await shot('battle-live-field', { clip: box })

// Clear it, then the spoils.
await st(() => {
  const e = window.__game.getState().engine
  if (!e) return
  e.spawnIndex = e.spawnQueue.length
  e.enemies = []
  e.projectiles = []
  e.pendingSpawns = []
  e.breather = null
})
await page.waitForTimeout(1400)
await st(() => window.__game.getState().skipWaveBeat())
await page.waitForTimeout(1600)
await shot('spoils')
await st(() => {
  const g = window.__game
  const r = g.getState().reward
  if (r?.length) g.getState().chooseReward(r[0].id)
})
await page.waitForTimeout(1600)

// The merchant.
await st(() => {
  const g = window.__game
  if (g.getState().screen === 'battle') g.setState({ screen: 'map' })
})
const ok = await st(() => {
  const g = window.__game
  const s = g.getState()
  const n = s.runMap.nodes.find((x) => x.type === 'merchant' && !s.clearedNodeIds.includes(x.id))
  if (!n) return false
  g.setState({ reachableNodeIds: [n.id], event: null, merchant: null, shrineOffer: null })
  g.getState().selectNode(n.id)
  return true
})
await page.waitForTimeout(1600)
if (ok) {
  await shot('merchant')
  const names = await st(() => window.__game.getState().merchant?.items?.map((e) => e.item.name) ?? [])
  log.push('shelf: ' + names.join(' | '))
  for (let i = 0; i < 4; i++) {
    await page.locator('.shop-wares button').nth(i).click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(500)
    await shot(`merchant-ware-${i}`)
  }
} else log.push('no merchant')

fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n') + '\n')
console.log(log.join('\n'))
await browser.close()
