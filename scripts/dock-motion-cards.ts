/**
 * dock-motion-cards — the phone-board cards for the dock faces' BRANDED motion
 * (round 4, Oct 2026: each face moves in its own kind of way; `render/hero/mini.ts`).
 *
 *   npx tsx scripts/dock-motion-cards.ts [outDir]            (default docs/characters/cards/motion-r4)
 *   npx vite --port 5273 --strictPort &   then add --live    (also shoots the real dock in motion)
 *
 * Per face, `motion-<id>.webp`: a 4 s loop, ~600 px wide — its idle, a tic and
 * the reaction side by side, each from the shipping draw code (`miniFrame`, the
 * clock's own holds), integer-upscaled for the card only (7×; the slot's real 2×
 * under each). `--live`: `motion-dock.webp`, the real home on a fake clock with a
 * slot picked part-way. Writes `manifest.json` ({ id, group, people, title, caption, file }).
 * Env (live): DOCK_BASE (http://localhost:5273/), PW_CHROMIUM, PW_MODULE.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { MINI_FACES, MINI_H, MINI_W, miniAt, miniFrame, miniMs, type MiniAnim } from '../src/game/render/hero/mini'
import type { PersonaId } from '../src/game/render/hero/rig'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const args = process.argv.slice(2)
const LIVE = args.includes('--live')
const OUT = path.resolve(args.find((a) => !a.startsWith('--')) ?? 'docs/characters/cards/motion-r4')
fs.mkdirSync(OUT, { recursive: true })

const W = 600
const K = 7
const LOOP = 4000
const STEP = 20
const LEAD = 450
const ORDER: PersonaId[] = ['saffra', 'odile', 'brannoch', 'hask', 'wren']
const WHO: Record<PersonaId, { name: string; of: string; brief: string; caption: string }> = {
  saffra: {
    name: 'Saffra',
    of: 'Peppercorn Co. · human spice broker',
    brief: 'Brisk, light, impatient: a quick double toe-tap and a short wait',
    caption: 'Saffra: a quick toe-tap, she flips and catches the pepper sack, then points with a wink when picked. Is it brisk and impatient?',
  },
  odile: {
    name: 'Odile',
    of: 'Rosethread · elf silk mercer',
    brief: 'Fluid, unhurried, never quite still: the head leads, the cloak follows in a wave',
    caption: 'Odile: a slow sway with a wave down her cloak, she strokes the silk, then a low half-bow when picked. Is it smooth and warm?',
  },
  brannoch: {
    name: 'Brannoch',
    of: 'Ironvein · dwarf ore factor',
    brief: 'Planted and heavy: one slow breath, then nothing; the least motion of the five',
    caption: 'Brannoch: one slow breath and a long stillness, he chalks the tally, then one gruff nod when picked. Is it planted and gruff?',
  },
  hask: {
    name: 'Hask',
    of: 'Easel House slot → Butcherblock · reptilian salter',
    brief: 'Coiled stillness, then sudden: frozen holds broken by fast tail lashes; never blinks',
    caption: 'Hask: frozen, then a lash of the tail; the hook glints; a snap and a cocked head when picked. Is it coiled and predatory?',
  },
  wren: {
    name: 'Wren',
    of: 'Moonquill slot → Greenvial · gnome herbalist',
    brief: 'Small, odd, ominous: the body never moves, only the vial’s light breathes',
    caption: 'Wren: only the vial glows, a spore drifts up, then a slow look up from under the hat when picked. Is it quiet and a little ominous?',
  },
}

const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0)
const frameAt = (ms: readonly number[], into: number): number => {
  let acc = 0
  for (let i = 0; i < ms.length; i++) { acc += ms[i]; if (into < acc) return i }
  return ms.length - 1
}
/** The idle frame at idle-clock time `t` (the clock's own holds). */
const idleAt = (id: PersonaId, t: number) => frameAt(miniMs(id, 'idle'), ((t % MINI_FACES[id].period) + MINI_FACES[id].period) % MINI_FACES[id].period)
/** Where the idle panel starts: just before the idle's first move, so the loop shows it. */
const idleStart = (id: PersonaId) => Math.max(0, miniMs(id, 'idle')[0] - 350)

/** What each panel shows at card time t: the idle; idle → the tic → idle; idle → the reaction → idle. */
function panelAt(id: PersonaId, panel: 0 | 1 | 2, t: number): { anim: MiniAnim; frame: number } {
  const t0 = idleStart(id)
  if (panel === 0) return { anim: 'idle', frame: idleAt(id, t0 + t) }
  const anim: MiniAnim = panel === 1 ? 'tic' : 'react'
  const ms = miniMs(id, anim)
  if (t >= LEAD && t < LEAD + sum(ms)) return { anim, frame: frameAt(ms, t - LEAD) }
  return { anim: 'idle', frame: idleAt(id, t) }
}

/** Paint a frame k× into an RGBA buffer at (x, y). */
function blit(buf: Buffer, bw: number, id: PersonaId, anim: MiniAnim, frame: number, x0: number, y0: number, k: number): void {
  const fr = miniFrame(id, anim, frame)
  for (let y = 0; y < MINI_H; y++)
    for (let x = 0; x < MINI_W; x++) {
      const o = (y * MINI_W + x) * 4
      const a = fr.rgba[o + 3] / 255
      if (!a) continue
      for (let yy = 0; yy < k; yy++)
        for (let xx = 0; xx < k; xx++) {
          const p = ((y0 + y * k + yy) * bw + x0 + x * k + xx) * 4
          for (let c = 0; c < 3; c++) buf[p + c] = Math.round(buf[p + c] * (1 - a) + fr.rgba[o + c] * a)
        }
    }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const HEAD = 92
const PAD = 8
const PW = MINI_W * K + PAD * 2, PH = MINI_H * K + PAD
const GAP = Math.floor((W - 3 * PW) / 4)
const SMALL_H = MINI_H * 2 + 16
const H = HEAD + PH + 12 + SMALL_H + 34
const PANEL_X = [0, 1, 2].map((i) => GAP + i * (PW + GAP))

async function characterCard(id: PersonaId) {
  const f = MINI_FACES[id]
  const who = WHO[id]
  const labels = [`idle · ${(f.period / 1000).toFixed(1)} s loop`, `tic · every ${(f.ticEvery / 1000).toFixed(1)} s`, 'picked']
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#16120e"/>
    <text x="${GAP}" y="22" fill="#e3b64f" font-family="sans-serif" font-weight="700" font-size="12" letter-spacing="1.5">CHARACTER MOTION · ROUND 4</text>
    <text x="${GAP}" y="50" fill="#f2e8d8" font-family="Georgia, serif" font-weight="700" font-size="24">${esc(who.name)}<tspan fill="#b3a48c" font-family="sans-serif" font-weight="400" font-size="14" dx="12">${esc(who.of)}</tspan></text>
    <text x="${GAP}" y="76" fill="#efe6d6" font-family="sans-serif" font-size="15">${esc(who.brief)}</text>
    ${PANEL_X.map((x) => `<rect x="${x}" y="${HEAD}" width="${PW}" height="${PH}" fill="#2c3434"/><rect x="${x}" y="${HEAD + PH + 12}" width="${PW}" height="${SMALL_H}" fill="#2c3434"/>`).join('')}
    ${PANEL_X.map((x, i) => `<text x="${x + PW / 2}" y="${H - 12}" fill="#efe6d6" font-family="sans-serif" font-weight="700" font-size="15" text-anchor="middle">${labels[i]}</text>`).join('')}
  </svg>`
  const base: Buffer = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer()
  const frames: Buffer[] = []
  const delays: number[] = []
  let last = ''
  for (let t = 0; t < LOOP; t += STEP) {
    const at = [0, 1, 2].map((p) => panelAt(id, p as 0 | 1 | 2, t))
    const key = at.map((a) => `${a.anim}${a.frame}`).join('|')
    if (key === last) { delays[delays.length - 1] += STEP; continue }
    last = key
    const buf = Buffer.from(base)
    at.forEach((a, p) => {
      blit(buf, W, id, a.anim, a.frame, PANEL_X[p] + PAD, HEAD + PAD, K)
      // the slot's real 2×, centred under the big one
      blit(buf, W, id, a.anim, a.frame, PANEL_X[p] + (PW - MINI_W * 2) / 2, HEAD + PH + 12 + 8, 2)
    })
    frames.push(await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer())
    delays.push(STEP)
  }
  const file = `motion-${id}.webp`
  await sharp(frames, { join: { animated: true } }).webp({ lossless: true, effort: 6, loop: 0, delay: delays }).toFile(path.join(OUT, file))
  const kb = Math.round(fs.statSync(path.join(OUT, file)).size / 1024)
  console.log(`wrote ${file} (${W}×${H}, ${frames.length} frames, ${kb} KB)`)
  return { id: `motion-${id}`, group: 'Character motion', people: who.name, title: `${who.name} — motion`, caption: who.caption, file }
}

/**
 * The blob test: the five as flat shapes (no faces, no colour) on the dock's own clock, in dock order, Brannoch
 * picked part-way — the motion alone has to say who is who.
 */
async function blobCard() {
  const DOCK: PersonaId[] = ['saffra', 'hask', 'brannoch', 'odile', 'wren']
  const BK = 4, T0 = 1500, PICKED = 'brannoch', PICK_AT = 3300
  const cw = Math.floor(W / 5), top = 50, bh = MINI_H * BK
  const BH = top + bh + 44
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${BH}"><rect width="100%" height="100%" fill="#16120e"/>
    <text x="14" y="30" fill="#f2e8d8" font-family="sans-serif" font-weight="700" font-size="18">Motion only · the dock’s clock · Brannoch picked at 1.8 s</text>
    ${DOCK.map((id, i) => `<text x="${i * cw + cw / 2}" y="${BH - 14}" fill="#b3a48c" font-family="sans-serif" font-weight="700" font-size="15" text-anchor="middle">${WHO[id].name}</text>`).join('')}
  </svg>`
  const base: Buffer = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer()
  const frames: Buffer[] = []
  const delays: number[] = []
  let last = ''
  for (let t = 0; t < LOOP; t += STEP) {
    const at = DOCK.map((id) => miniAt(id, T0 + t, { pickedAt: id === PICKED ? PICK_AT : undefined }))
    const key = at.map((a) => `${a.anim}${a.frame}`).join('|')
    if (key === last) { delays[delays.length - 1] += STEP; continue }
    last = key
    const buf = Buffer.from(base)
    at.forEach((a, i) => {
      const fr = miniFrame(DOCK[i], a.anim, a.frame)
      const x0 = i * cw + (cw - MINI_W * BK) / 2
      for (let y = 0; y < MINI_H; y++)
        for (let x = 0; x < MINI_W; x++) {
          if (fr.rgba[(y * MINI_W + x) * 4 + 3] !== 255) continue
          for (let yy = 0; yy < BK; yy++) for (let xx = 0; xx < BK; xx++) buf.set([225, 212, 189, 255], ((top + y * BK + yy) * W + x0 + x * BK + xx) * 4)
        }
    })
    frames.push(await sharp(buf, { raw: { width: W, height: BH, channels: 4 } }).png().toBuffer())
    delays.push(STEP)
  }
  const file = 'motion-blobs.webp'
  await sharp(frames, { join: { animated: true } }).webp({ lossless: true, effort: 6, loop: 0, delay: delays }).toFile(path.join(OUT, file))
  console.log(`wrote ${file} (${W}×${BH}, ${frames.length} frames, ${Math.round(fs.statSync(path.join(OUT, file)).size / 1024)} KB)`)
  return { id: 'motion-blobs', group: 'Character motion', people: 'all', title: 'Motion only — the five as shapes', caption: 'The five as flat shapes on the dock’s clock, Brannoch picked part-way: can you tell who is who from how they move alone?', file }
}

const manifest: object[] = []
for (const id of ORDER) manifest.push(await characterCard(id))
manifest.push(await blobCard())

if (LIVE) manifest.push(await liveDock())

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`manifest: ${manifest.length} cards`)

/** The real home on a fake clock: 4 s of the dock, the third slot (Ironvein) picked at 1.8 s. */
async function liveDock() {
  const BASE = process.env.DOCK_BASE ?? 'http://localhost:5273/'
  const EXEC = process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
  const { chromium } = await import(process.env.PW_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs')
  const browser = await chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {})
  const DPR = 1.5, FPS = 25, SECS = 4, PICK = 1.8
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e: Error) => console.error('  ! pageerror', e.message))
  await page.goto(BASE)
  await page.waitForFunction(() => !!(window as any).__meta, null, { timeout: 30000 })
  // a played save (as scripts/dock-faces.mjs): every company hiring
  await page.evaluate(async () => {
    const w = window as any
    localStorage.clear()
    const st = await import('/src/game/run/standing.ts' as string)
    const tw = await import('/src/game/run/tradeWar.ts' as string)
    const lv: Record<string, number> = { spice: 4, art: 2, metals: 6, silk: 3, scrolls: 3 }
    w.__meta.setState({
      bank: 12480,
      standing: Object.fromEntries(Object.keys(lv).map((c) => [c, st.standingXpToReach(lv[c])])),
      season: { ...tw.freshSeason(), n: 3, contracts: 4, shares: { spice: 27, art: 14, metals: 32, silk: 11, scrolls: 16 }, deliveries: { spice: 1, art: 0, metals: 2, silk: 0, scrolls: 0 }, log: ['metals', 'spice', null, 'metals'] },
      stats: { ...w.__meta.getState().stats, runsCompleted: 31, runsWon: 31 },
    })
    const s = w.__settings.getState()
    w.__settings.setState({ taught: { ...s.taught, board: true, market: true, war: true } })
  })
  await page.waitForTimeout(300)
  await page.clock.install()
  await page.reload()
  await page.waitForSelector('.mn-dock .mn-slot', { timeout: 30000 })
  await page.evaluate(() => (window as any).__game.getState().focusRoad('spice'))
  await page.clock.runFor(1500)
  const box = await page.evaluate(() => {
    const a = document.querySelector('.mn-docked')!.getBoundingClientRect()
    return { y: a.top, h: a.height }
  })
  const clip = { x: 0, y: Math.round(box.y - 8), width: 390, height: Math.round(box.h + 14) }
  const shots: Buffer[] = []
  for (let i = 0; i < SECS * FPS; i++) {
    if (i === Math.round(PICK * FPS)) await page.evaluate(() => (window as any).__game.getState().focusRoad('metals'))
    await page.clock.runFor(1000 / FPS)
    shots.push(await page.screenshot({ type: 'png', clip }))
  }
  await ctx.close()
  await browser.close()
  const w = clip.width * DPR, h = clip.height * DPR
  const head = 44
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h + head}"><rect width="100%" height="100%" fill="#16120e"/><text x="12" y="29" fill="#f2e8d8" font-family="sans-serif" font-weight="700" font-size="19">The real dock · 4 s · Ironvein picked at 1.8 s</text></svg>`
  const base = await sharp(Buffer.from(svg)).png().toBuffer()
  const frames: Buffer[] = []
  const delays: number[] = []
  let prev: Buffer | null = null
  for (const s of shots) {
    if (prev && s.equals(prev)) { delays[delays.length - 1] += 1000 / FPS; continue }
    prev = s
    frames.push(await sharp(base).composite([{ input: s, left: 0, top: head }]).png().toBuffer())
    delays.push(1000 / FPS)
  }
  const file = 'motion-dock.webp'
  let kb = Infinity
  for (const quality of [90, 80, 70, 60]) {
    await sharp(frames, { join: { animated: true } }).webp({ quality, effort: 6, loop: 0, delay: delays.map(Math.round) }).toFile(path.join(OUT, file))
    kb = Math.round(fs.statSync(path.join(OUT, file)).size / 1024)
    if (kb <= 1400) break
  }
  console.log(`wrote ${file} (${w}×${h + head}, ${frames.length} frames, ${kb} KB)`)
  return { id: 'motion-dock', group: 'Character motion', people: 'all', title: 'The dock in motion — all five', caption: 'The real home’s dock, 4 s on the game’s clock, Ironvein picked part-way: can you tell who is who by how they move, and is it calm?', file }
}
