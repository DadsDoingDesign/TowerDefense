/**
 * whales-scan — drive the running Fieldwatch app through its real screens and
 * check each one against the Whales house rules (RULES below; they come from
 * the recorded critiques in docs/whales-critique/ and the October 2026 audit).
 *
 *   menu, codex, settings, contract board -> hero pick -> run map -> setup ->
 *   live wave -> sub-wave hold -> wave cleared -> merchant / shrine / campfire
 *   / recruit -> city -> run lost
 *
 * on a phone (390x844 @2x, touch) and a desk (1440x900) viewport. Each screen
 * is measured in the page (scripts/whales-scan-analyze.js: text, contrast
 * grounds, icons, buttons, chrome, headings, spacing, option groups) and its
 * rendered pixels are sampled for text over art and for dark art.
 *
 * Usage
 *   npm i --no-save playwright-core     # not a project dependency (see ui-audit.mjs)
 *   npx vite --port 5192 --strictPort &
 *   node scripts/whales-scan.mjs [outDir] [mobile|desktop|all]
 *
 * Env: SCAN_PORT (default 5192) or SCAN_BASE (a full URL; wins over the port),
 * PW_CHROMIUM (a Chrome or Chromium binary for playwright-core). outDir
 * defaults to ./whales-scan-out (git-ignored). Writes <outDir>/<vp>-<screen>.png
 * and .json, <vp>-log.txt, summary.json and summary.md (one row per screen,
 * one column per rule: the violation count).
 *
 * Honest shortcuts, all logged in <vp>-log.txt: each event is reached by
 * retyping a reachable map node (window.__game, dev builds only); the city is
 * forced through contract.pending; the loss drops the Gate to 1 HP and moves
 * the hero off the field.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.resolve(process.argv[2] ?? 'whales-scan-out')
const ONLY = process.argv[3] ?? 'all'
const BASE = process.env.SCAN_BASE ?? `http://localhost:${process.env.SCAN_PORT ?? 5192}/`
const EXEC = process.env.PW_CHROMIUM
const ANALYZE = fs.readFileSync(path.join(HERE, 'whales-scan-analyze.js'), 'utf8')
fs.mkdirSync(OUT, { recursive: true })

const loadChromium = async () => {
  for (const pkg of ['playwright', 'playwright-core']) {
    try {
      return (await import(pkg)).chromium
    } catch {
      /* try the next one */
    }
  }
  console.error('whales-scan: install playwright or playwright-core first (see the header of this file).')
  process.exit(1)
}

const RULES = {
  contrast: 'text >= 4.5:1 (>= 3:1 large: >=24px or >=18.66px bold)',
  size: 'text >= 11px (--fs-micro house floor)',
  icon: 'meaning-carrying icon with no visible label >= 36 CSS px (72 image px @2x)',
  primary: 'at most one primary (CTA-teal) treatment visible',
  order: 'reading order ends on the primary (no content block below it)',
  chrome: 'banners/header/tips/nav < 30% of the first screen',
  headline: 'a title outranks its body (bigger, or same size and heavier)',
  spacing: 'padding/margin/gap on the 4/8/10/12(/16/20/24/32) scale',
  selected: 'selected option visibly dominates; alternatives equal weight',
  darkArt: 'art/portraits not near-black (mean L >= 0.04 or p90 >= 0.10)',
  hit: 'controls >= 44px in both dimensions (--hit-min)',
}

const VIEWPORTS = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
}

const chromium = await loadChromium()
const browser = await chromium.launch(EXEC ? { executablePath: EXEC } : {})
// A blank page that decodes screenshots and samples pixels (no DOM interference with the app).
let pix = null
const pixPage = async () => {
  if (pix && !pix.isClosed()) return pix
  pix = await (await browser.newContext()).newPage()
  await pix.setContent('<html><body></body></html>')
  return pix
}

const L = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const ratioL = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

async function samplePixels(png, dpr, texts, arts) {
  const pg = await pixPage()
  return pg.evaluate(async ({ b64, dpr, texts, arts }) => {
    const blob = await (await fetch('data:image/png;base64,' + b64)).blob()
    const bmp = await createImageBitmap(blob)
    const c = new OffscreenCanvas(bmp.width, bmp.height)
    const g = c.getContext('2d', { willReadFrequently: true })
    g.drawImage(bmp, 0, 0)
    const W = bmp.width, H = bmp.height
    const data = g.getImageData(0, 0, W, H).data
    const at = (x, y) => { x = Math.max(0, Math.min(W - 1, Math.round(x * dpr))); y = Math.max(0, Math.min(H - 1, Math.round(y * dpr))); const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]] }
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
    const Lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    const ring = (b, off) => {
      const pts = []
      const x0 = b.x - off, y0 = b.y - off, x1 = b.x + b.w + off, y1 = b.y + b.h + off
      const n = 24
      for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; pts.push(at(x, y0), at(x, y1)) }
      for (let i = 1; i < n; i++) { const y = y0 + ((y1 - y0) * i) / n; pts.push(at(x0, y), at(x1, y)) }
      // and between glyph lines/inside the box gaps: sample the horizontal mid-line every few px
      return pts
    }
    const tOut = texts.map((b) => {
      const pts = [...ring(b, 2), ...ring(b, 1)]
      const ls = pts.map(Lum).sort((a, z) => a - z)
      const med = ls[Math.floor(ls.length / 2)]
      return { medL: med, loL: ls[Math.floor(ls.length * 0.1)], hiL: ls[Math.floor(ls.length * 0.9)] }
    })
    const aOut = arts.map((b) => {
      const ls = []
      for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) ls.push(Lum(at(b.x + (b.w * (i + 0.5)) / 12, b.y + (b.h * (j + 0.5)) / 12)))
      ls.sort((a, z) => a - z)
      return { meanL: ls.reduce((a, z) => a + z, 0) / ls.length, p90: ls[Math.floor(ls.length * 0.9)] }
    })
    return { tOut, aOut }
  }, { b64: png.toString('base64'), dpr, texts, arts })
}

const summary = [] // rebuilt from every <vp>-<screen>.json in OUT at the end

async function capture(p, vp, name, note = '') {
  const { page } = p
  await page.waitForTimeout(350)
  const png = await page.screenshot()
  fs.writeFileSync(path.join(OUT, `${vp}-${name}.png`), png)
  const raw = await page.evaluate(ANALYZE)
  const dpr = VIEWPORTS[vp].deviceScaleFactor
  let sp
  try { sp = await samplePixels(png, dpr, raw.texts.map((t) => t.box), raw.art.map((a) => ({ x: a.x, y: a.y, w: a.w, h: a.h }))) } catch (e) { console.log('pixel page died, retrying', e.message); pix = null; sp = await samplePixels(png, dpr, raw.texts.map((t) => t.box), raw.art.map((a) => ({ x: a.x, y: a.y, w: a.w, h: a.h }))) }
  const { tOut, aOut } = sp
  const v = Object.fromEntries(Object.keys(RULES).map((k) => [k, []]))

  // contrast + size
  raw.texts.forEach((t, i) => {
    const fgL = L(...hexRgb(t.fg))
    t.pxRatio = +ratioL(fgL, tOut[i].medL).toFixed(2)
    t.pxWorst = +ratioL(fgL, tOut[i].loL < fgL ? tOut[i].hiL : tOut[i].loL).toFixed(2)
    const need = t.large ? 3 : 4.5
    // Uncertain ground (art/canvas/gradient behind): trust the rendered pixels. Otherwise the DOM composite,
    // cross-checked by pixels (anti-aliased / translucent washes over panels).
    t.ratio = t.uncertain.length ? t.pxRatio : t.domRatio
    t.need = need
    if (t.ratio < need) v.contrast.push({ text: t.text, sel: t.sel, fs: t.fs, fw: t.fw, color: t.color, bg: t.uncertain.length ? `pixels (L=${tOut[i].medL.toFixed(3)})` : t.bg, ratio: t.ratio, dom: t.domRatio, px: t.pxRatio, need, uncertain: t.uncertain.slice(0, 2) })
    // Text inside a mask-image fade (the scrolling page body's bottom 32px): the glyphs themselves are faded.
    if (t.mask && t.mask.fromBottom < 32 && t.mask.fromBottom > -1) v.contrast.push({ text: t.text, sel: t.sel, fs: t.fs, color: t.color, ratio: 'faded by mask', fade: t.mask, need })
    if (t.fs < 11) v.size.push({ text: t.text, sel: t.sel, fs: t.fs })
  })
  const advisory7 = raw.texts.filter((t) => t.fs <= 12 && t.ratio >= t.need && t.ratio < 7).map((t) => ({ text: t.text, sel: t.sel, fs: t.fs, ratio: t.ratio }))

  // icons
  const strictIcons = []
  for (const ic of raw.icons) {
    if (ic.isStage || ic.big) continue
    const m = Math.min(ic.w, ic.h)
    if (m >= 36) continue
    const rec = { sel: ic.sel, icon: ic.icon || ic.glyph || ic.tag, size: `${ic.w}x${ic.h}`, image_px: `${ic.w * dpr}x${ic.h * dpr}`, label: ic.label }
    if (!ic.label || ic.label.kind === 'aria-only') v.icon.push(rec)
    else strictIcons.push(rec)
  }

  // primary count + reading order
  const vis = raw.buttons.filter((b) => b.inViewport)
  const prim = vis.filter((b) => b.ctaFill && !b.disabled)
  if (prim.length > 1) v.primary.push({ count: prim.length, buttons: prim.map((b) => `${b.name} [${b.sel}] ${b.w}x${b.h}@${b.y}`) })
  if (prim.length) {
    const pr = prim.reduce((a, b) => (b.y > a.y ? b : a))
    const bottom = pr.y + pr.h
    const below = [
      ...raw.texts.filter((t) => t.box.y >= bottom - 2 && t.box.y < raw.vh - 16).map((t) => ({ kind: 'text', what: t.text, sel: t.sel, y: t.box.y })),
      ...raw.icons.filter((i) => i.y >= bottom - 2 && i.y < raw.vh - 16 && i.w * i.h > 400).map((i) => ({ kind: i.tag, what: i.icon || i.sel, sel: i.sel, y: i.y, area: i.w * i.h })),
    ]
    if (below.length) v.order.push({ primary: pr.name, primaryBottom: bottom, belowCount: below.length, sample: below.slice(0, 6) })
  }
  // chrome
  if (raw.chrome.pct >= 30) v.chrome.push({ pct: raw.chrome.pct, els: raw.chrome.els })
  // headline
  for (const h of raw.heads) {
    if (h.fs < h.bodyFs || (h.fs === h.bodyFs && h.fw <= h.bodyFw)) v.headline.push(h)
  }
  // spacing
  v.spacing = raw.spacing
  // selected
  for (const g of raw.groups) {
    const s = g.selected[0]
    const same = g.others.some((o) => o.bg === s.bg && o.border === s.border && o.shadow === s.shadow && o.outline === s.outline)
    if (same || g.otherAreaSpread > 1.15) v.selected.push({ ...g, selectedLooksLikeOthers: same })
  }
  // dark art
  raw.art.forEach((a, i) => { a.meanL = +aOut[i].meanL.toFixed(3); a.p90 = +aOut[i].p90.toFixed(3); if (a.meanL < 0.04 && a.p90 < 0.1) v.darkArt.push({ sel: a.sel, size: `${a.w}x${a.h}`, meanL: a.meanL, p90: a.p90 }) })
  // hit targets
  for (const b of vis) if (!b.disabled && (b.w < 44 || b.h < 44) && b.w > 0) v.hit.push({ name: b.name, sel: b.sel, size: `${b.w}x${b.h}` })

  const counts = Object.fromEntries(Object.entries(v).map(([k, arr]) => [k, arr.length]))
  const rec = { vp, screen: name, note, url: raw.url, title: raw.title, chromePct: raw.chrome.pct, counts, violations: v, strictIcons, advisory7, primaries: prim.map((b) => b.name), buttons: raw.buttons, heads: raw.heads, groups: raw.groups, texts: raw.texts, icons: raw.icons, art: raw.art }
  fs.writeFileSync(path.join(OUT, `${vp}-${name}.json`), JSON.stringify(rec, null, 1))
  summary.push({ vp, screen: name, note, chromePct: raw.chrome.pct, counts, primaries: rec.primaries, strictIcons: strictIcons.length, advisory7: advisory7.length })
  console.log(`${vp}-${name}`, JSON.stringify(counts), 'chrome', raw.chrome.pct + '%', 'primary:', rec.primaries.join(' | '))
}

async function open(vp, log) {
  const ctx = await browser.newContext(VIEWPORTS[vp])
  const page = await ctx.newPage()
  page.on('pageerror', (e) => log.push(`pageerror: ${e.message}`))
  const btn = (name, exact = false) => page.getByRole('button', { name, exact }).first()
  const tap = async (name, { exact = false, force = false, wait = 700, timeout = 6000 } = {}) => {
    try { await btn(name, exact).click({ timeout, force }); await page.waitForTimeout(wait); return true } catch { log.push(`tap failed: ${name}`); return false }
  }
  const tipOff = () => btn('Got it').click({ timeout: 600 }).catch(() => {})
  await page.goto(BASE)
  await page.waitForTimeout(2500)
  return { ctx, page, btn, tap, tipOff }
}
const G = (p, fn, arg) => p.page.evaluate(fn, arg)

/** Retype one reachable node into `type` (dev shortcut) so an event is a march away. */
async function forceNode(p, type) {
  return G(p, (type) => {
    const st = window.__game.getState()
    const id = st.reachableNodeIds.find((n) => !st.clearedNodeIds.includes(n))
    if (!id) return null
    window.__game.setState({ runMap: { ...st.runMap, nodes: st.runMap.nodes.map((n) => (n.id === id ? { ...n, type } : n)) } })
    return id
  }, type)
}
async function marchTo(p, label) {
  const ok = await p.tap(new RegExp(label + '.*you can march here'), { wait: 800 })
  if (ok) await p.tap('March', { exact: true, wait: 2200 })
  return ok
}


/** Post the armed hero: tap an open tile inside the Stage; a phone's first tap zooms (N6), so retry on the new layout. */
async function placeHero(p, vp) {
  for (let i = 0; i < 4; i++) {
    const enabled = await p.page.getByRole('button', { name: /Start Wave/ }).first().isEnabled().catch(() => false)
    if (enabled) return true
    const pt = await p.page.evaluate(() => {
      const st = document.querySelector('.sh-stage')?.getBoundingClientRect()
      const ok = [...document.querySelectorAll('.slot-layer button')].filter((b) => /open/.test(b.getAttribute('aria-label') || '')).map((b) => b.getBoundingClientRect()).filter((r) => st && r.top > st.top + 60 && r.bottom < st.bottom - 20 && r.left > st.left + 10 && r.right < st.right - 10)
      const r = ok[Math.floor(ok.length / 2)]
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
    })
    if (!pt) return false
    if (VIEWPORTS[vp].hasTouch) await p.page.touchscreen.tap(pt.x, pt.y)
    else await p.page.mouse.click(pt.x, pt.y)
    await p.page.waitForTimeout(700)
    await p.tipOff()
  }
  return p.page.getByRole('button', { name: /Start Wave/ }).first().isEnabled().catch(() => false)
}

async function startRun(p, vp, shots) {
  await p.tap('Take the free escort', { wait: 1400 })
  if (shots) {
    await capture(p, vp, '03-hero-pick')
    // select the second card so the selected-vs-alternatives rule has something to judge
    await p.page.locator('button').filter({ hasText: /Skill/ }).nth(1).click().catch(() => {})
    await p.page.waitForTimeout(500)
    await capture(p, vp, '03b-hero-pick-second')
  }
  await p.tap(/^Choose /, { wait: 1600 })
  await p.tipOff()
}

async function fightFirst(p, vp, shots, log) {
  if (shots) await capture(p, vp, '04-run-map')
  await p.tap(/Battle.*you can march here/, { wait: 900 })
  if (shots) await capture(p, vp, '04b-run-map-preview')
  await p.tap('March', { exact: true, wait: 2600 })
  await p.tipOff()
  if (shots) await capture(p, vp, '05-battle-setup')
  await p.tap(/on the bench|— selected/, { wait: 600 })
  if (shots) await capture(p, vp, '05b-setup-hero-armed')
  if (!(await placeHero(p, vp))) log.push('could not post the hero')
  await p.page.waitForTimeout(600)
  await p.tipOff()
  if (shots) await capture(p, vp, '05c-setup-posted')
  await p.tap(/Start Wave/, { wait: 1500 })
  await p.tap('Battle speed', { wait: 200 })
  await p.page.waitForTimeout(2500)
  if (shots) await capture(p, vp, '06-live-wave')
  let held = false
  for (let i = 0; i < 40; i++) {
    const done = await p.btn(/^Continue$|^Take it$/).isVisible().catch(() => false)
    if (done) break
    const next = p.btn('Send the next sub-wave')
    if (await next.isVisible().catch(() => false)) {
      if (!held && shots) { await p.tipOff(); await capture(p, vp, '07-subwave-held'); held = true }
      await next.click().catch(() => {})
    }
    await p.page.waitForTimeout(800)
  }
  await p.tipOff()
  await p.page.waitForTimeout(500)
  if (shots) await capture(p, vp, '08-wave-cleared-spoils')
  if (await p.btn(/^Continue$/).isVisible().catch(() => false)) {
    await p.tap(/^Continue$/, { wait: 1400 })
    if (shots) await capture(p, vp, '08b-spoils-page')
  } else {
    await p.page.locator('.sh-selector .sh-reward').nth(1).click().catch(() => {})
    await p.page.waitForTimeout(500)
    if (shots) await capture(p, vp, '08b-spoils-second-card')
  }
  await p.tap('Take it', { wait: 1600 })
  await p.tipOff()
}

async function run(vp) {
  const log = []
  const full = vp === 'mobile'
  // A. menu + codex + settings + contracts board
  {
    const p = await open(vp, log)
    await capture(p, vp, '01-menu')
    if (full) {
      if (await p.tap('Codex', { exact: true, wait: 1000 })) { await capture(p, vp, '02a-codex'); await p.tap(/^Back|Close|Return/, { wait: 800 }) || (await p.page.goBack().catch(() => {})) }
      await p.page.goto(BASE); await p.page.waitForTimeout(2000)
      if (await p.tap('Settings', { exact: true, wait: 1000 })) { await capture(p, vp, '02b-settings') }
      await p.page.goto(BASE); await p.page.waitForTimeout(2000)
      if (await p.tap(/see its contracts/, { wait: 1200 })) { await capture(p, vp, '02c-contract-board') }
    }
    await p.ctx.close()
  }
  // B. main path
  {
    const p = await open(vp, log)
    await startRun(p, vp, true)
    await fightFirst(p, vp, true, log)
    await capture(p, vp, '09-run-map-after-win')
    // level-up badge?
    const lv = p.page.locator('button', { hasText: /↑/ }).first()
    if (await lv.isVisible().catch(() => false)) { await lv.click().catch(() => {}); await p.page.waitForTimeout(600); await capture(p, vp, '09b-level-up') }
    // C. events, each forced one march away (dev shortcut, logged)
    const kinds = full ? ['merchant', 'shrine', 'campfire', 'recruit'] : ['merchant']
    for (const kind of kinds) {
      const id = await forceNode(p, kind)
      log.push(`forced ${kind} at ${id}`)
      const label = kind[0].toUpperCase() + kind.slice(1)
      if (await marchTo(p, label)) {
        await p.tipOff()
        await capture(p, vp, `10-${kind}`, 'node retyped via __game (dev shortcut)')
        await G(p, () => window.__game.getState().leaveEvent())
        await p.page.waitForTimeout(800)
      }
    }
    // D. city (cash out or press on) via contract.pending (dev shortcut)
    if (full) {
      const okCity = await G(p, () => { const st = window.__game.getState(); if (!st.contract) return false; window.__game.setState({ contract: { ...st.contract, paid: [140], cargoAt: [90], pending: 0 } }); return true })
      if (okCity) { await p.page.waitForTimeout(900); await capture(p, vp, '11-city', 'contract.pending forced via __game'); await G(p, () => { const st = window.__game.getState(); window.__game.setState({ contract: { ...st.contract, pending: null } }) }) }
    }
    await p.ctx.close()
  }
  // E. forced loss (same shortcut flow-shots uses)
  if (full) {
    const p = await open(vp, log)
    await startRun(p, vp, false)
    await p.tap(/Battle.*you can march here/, { wait: 900 })
    await p.tap('March', { exact: true, wait: 2500 })
    await p.tipOff()
    await p.tap(/on the bench|— selected/, { wait: 500 })
    await placeHero(p, vp)
    await p.tipOff()
    await p.tap(/Start Wave/, { wait: 2000 })
    await G(p, () => { const e = window.__game.getState().engine; if (!e) return; e.baseHp = 1; for (const s of e.sentinels) s.pos = { x: -9999, y: -9999 } })
    await p.tap('Battle speed'); await p.tap('Battle speed')
    for (let i = 0; i < 15; i++) {
      await p.btn('Send the next sub-wave').click({ timeout: 500 }).catch(() => {})
      await p.page.waitForTimeout(2000)
      if ((await G(p, () => window.__game.getState().runPhase)) !== 'active') break
    }
    await p.page.waitForTimeout(2500)
    await p.tipOff()
    await capture(p, vp, '12-run-lost', 'loss forced via __game (Gate 1 HP, hero moved off)')
    await p.ctx.close()
  }
  fs.writeFileSync(path.join(OUT, `${vp}-log.txt`), log.join('\n') + '\n')
  console.log(vp, 'log:', log.join(' | '))
}

for (const vp of ONLY === 'all' ? Object.keys(VIEWPORTS) : [ONLY]) await run(vp)
summary.length = 0
for (const f of fs.readdirSync(OUT).filter((f) => /^(mobile|desktop)-.*\.json$/.test(f)).sort()) {
  const r = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'))
  summary.push({ vp: r.vp, screen: r.screen, note: r.note, chromePct: r.chromePct, counts: r.counts, primaries: r.primaries, strictIcons: r.strictIcons.length, advisory7: r.advisory7.length })
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ rules: RULES, screens: summary }, null, 1))
const keys = Object.keys(RULES)
const md = [`| screen | chrome% | ${keys.join(' | ')} | primaries |`, `|---|---|${keys.map(() => '---').join('|')}|---|`,
  ...summary.map((s) => `| ${s.vp}-${s.screen} | ${s.chromePct} | ${keys.map((k) => s.counts[k]).join(' | ')} | ${s.primaries.join(' / ')} |`)].join('\n')
fs.writeFileSync(path.join(OUT, 'summary.md'), md + '\n')
console.log(md)
await browser.close()
