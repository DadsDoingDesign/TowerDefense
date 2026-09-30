/**
 * flow-shots — play one real run and screenshot every step of the core flow.
 *
 *   menu → hero pick → run map → first deploy → wave in progress → wave cleared
 *        → spoils → merchant → run lost
 *
 * on a phone (390x844 @2x) and a desk (1440x900) viewport. It drives the RUNNING
 * app through its real controls (accessible names, the same ones a screen reader
 * uses), so every shot is the actual render path. It is the capture behind the
 * Whales critique in docs/whales-critique/ (Whales UI plan V1).
 *
 * Usage
 *   npm i -D playwright-core          # not a project dependency (see ui-audit.mjs)
 *   npx vite --port 5188 --strictPort &
 *   PW_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
 *     node scripts/flow-shots.mjs [outDir] [mobile|desktop]
 *
 * Env: FLOW_BASE (default http://localhost:5188/), PW_CHROMIUM (a Chrome or
 * Chromium binary for playwright-core; unset when using the bundled `playwright`).
 *
 * Two honest shortcuts, both logged:
 *  - Run maps are random, so the merchant is not always one step away. The
 *    script starts fresh runs (up to 6) until one offers a merchant.
 *  - The loss is FORCED: after the wave starts it drops the live battle's Gate
 *    to 1 HP and moves the hero off the field. The run-end screen is the real
 *    one, but its numbers ("0 stops", "1 Gate in one") come from the shortcut.
 */
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.argv[2] ?? 'docs/whales-critique/after')
const ONLY = process.argv[3]
const BASE = process.env.FLOW_BASE ?? 'http://localhost:5188/'
const EXEC = process.env.PW_CHROMIUM

const loadChromium = async () => {
  for (const pkg of ['playwright', 'playwright-core']) {
    try {
      return (await import(pkg)).chromium
    } catch {
      /* try the next one */
    }
  }
  console.error('flow-shots: install playwright or playwright-core first (see the header of this file).')
  process.exit(1)
}

const VIEWPORTS = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
}

fs.mkdirSync(OUT, { recursive: true })
const chromium = await loadChromium()
const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {})

/** A page plus the three verbs every step uses. */
async function open(label, log) {
  const ctx = await browser.newContext(VIEWPORTS[label])
  const page = await ctx.newPage()
  page.on('pageerror', (e) => log.push(`pageerror: ${e}`))
  const btn = (name, exact = false) => page.getByRole('button', { name, exact }).first()
  const tap = async (name, { exact = false, force = false, wait = 700 } = {}) => {
    try {
      await btn(name, exact).click({ timeout: 8000, force })
      await page.waitForTimeout(wait)
      return true
    } catch {
      log.push(`tap failed: ${name}`)
      return false
    }
  }
  const tipOff = () => btn('Got it').click({ timeout: 800 }).catch(() => {})
  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `${label}-${name}.png`) })
    log.push(`shot ${name}`)
  }
  await page.goto(BASE)
  await page.waitForTimeout(2500)
  return { ctx, page, btn, tap, tipOff, shot }
}

/** Start a run and walk into the first battle; `shots` says whether to capture on the way. */
async function toFirstBattle(p, shots) {
  if (shots) await p.shot('01-menu')
  await p.tap('Start a Run', { wait: 1200 })
  if (shots) await p.shot('02-hero-pick')
  await p.tap('Choose Fighter', { wait: 1500 })
  await p.tap('Battle, fought at Threat ×1 — you can march', { wait: 900 })
  if (shots) await p.shot('03-run-map')
  await p.tap('March', { exact: true, wait: 2500 })
}

/** Win the first battle and take a spoil; returns on the run map. */
async function winFirstBattle(p, shots) {
  await p.tap(/on the bench|— selected/, { wait: 600 })
  if (shots) await p.shot('04-battle-setup')
  await p.tap('Circle 4,', { force: true, wait: 600 })
  await p.tipOff()
  await p.tap('Start Wave', { wait: 1500 })
  await p.tap('Battle speed')
  await p.tap('Battle speed')
  await p.page.waitForTimeout(3500)
  if (shots) await p.shot('05-wave-in-progress')
  for (let i = 0; i < 6; i++) {
    const done = await p
      // A normal wave's reward is picked in place (G3-2): its "Take it" is the
      // way on. An elite's still ends on Continue → the Spoils page.
      .btn(/^Continue$|^Take it$/)
      .waitFor({ state: 'visible', timeout: 12000 })
      .then(() => true, () => false)
    if (done) break
    await p.btn('Send the next sub-wave').click({ timeout: 1000 }).catch(() => {})
  }
  await p.tipOff()
  await p.page.waitForTimeout(400)
  if (shots) await p.shot('06-wave-cleared')
  if (await p.btn(/^Continue$/).count()) {
    await p.tap(/^Continue$/, { wait: 1500 })
    if (shots) await p.shot('07-spoils')
    await p.tap(/· to pack|· relic/, { wait: 500 })
  } else {
    // In place: the first card is already showing; read the second.
    await p.page.locator('.sh-selector .sh-reward').nth(1).click().catch(() => {})
    await p.page.waitForTimeout(500)
    if (shots) await p.shot('07-spoils')
  }
  await p.tap('Take it', { wait: 1500 })
}

async function run(label) {
  const log = []

  // 1. The main path.
  {
    const p = await open(label, log)
    await toFirstBattle(p, true)
    await winFirstBattle(p, true)
    await p.ctx.close()
  }

  // 2. A merchant — fresh runs until one is a march away, from the start or
  //    after the first battle.
  for (let attempt = 1; attempt <= 6; attempt++) {
    const p = await open(label, log)
    await p.tap('Start a Run', { wait: 1200 })
    await p.tap('Choose Fighter', { wait: 1500 })
    let merchant = p.btn('Merchant — you can march here')
    if (!(await merchant.count())) {
      await p.tap('Battle, fought at Threat ×1 — you can march', { wait: 900 })
      await p.tap('March', { exact: true, wait: 2500 })
      await winFirstBattle(p, false)
      merchant = p.btn('Merchant — you can march here')
    }
    if (await merchant.count()) {
      await merchant.click()
      await p.page.waitForTimeout(700)
      await p.tap('March', { exact: true, wait: 2000 })
      await p.tipOff()
      await p.shot('08-merchant')
      await p.ctx.close()
      break
    }
    log.push(`attempt ${attempt}: no merchant reachable`)
    await p.ctx.close()
  }

  // 3. A forced loss in a clean context (see the header).
  const p = await open(label, log)
  await toFirstBattle(p, false)
  await p.tap(/on the bench|— selected/, { wait: 500 })
  await p.tap('Circle 1,', { force: true, wait: 500 })
  await p.tipOff()
  await p.tap('Start Wave', { wait: 2500 })
  await p.page.evaluate(() => {
    const e = window.__game.getState().engine
    if (!e) return
    e.baseHp = 1
    for (const s of e.sentinels) s.pos = { x: -9999, y: -9999 }
  })
  await p.tap('Battle speed')
  await p.tap('Battle speed')
  for (let i = 0; i < 15; i++) {
    await p.btn('Send the next sub-wave').click({ timeout: 500 }).catch(() => {})
    await p.page.waitForTimeout(2500)
    if ((await p.page.evaluate(() => window.__game.getState().runPhase)) !== 'active') break
  }
  await p.page.waitForTimeout(3000)
  log.push(`forced loss, runPhase: ${await p.page.evaluate(() => window.__game.getState().runPhase)}`)
  await p.shot('09-run-lost')
  await p.ctx.close()

  fs.writeFileSync(path.join(OUT, `${label}-log.txt`), log.join('\n') + '\n')
  console.log(`${label}: ${log.join(' | ')}`)
}

for (const label of ONLY ? [ONLY] : Object.keys(VIEWPORTS)) await run(label)
await browser.close()
