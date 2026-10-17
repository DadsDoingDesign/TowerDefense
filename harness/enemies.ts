/**
 * Enemy assets — the render harness behind `scripts/enemy-assets.ts --render`
 * and the Figma page "Enemy assets" (`docs/FIGMA.md` § Enemy assets).
 *
 * Run:  npx vite --port 5225  →  http://localhost:5225/harness/enemies.html
 *
 * Every picture is the game's own `units.drawEnemy` — the clan's baked strip
 * (`clanArt`), the ring, the HP bar with its tier ticks and the elite badge —
 * on a fake runtime enemy standing still on grass. Nothing is redrawn here.
 * Canvases carry `data-out` (written as their exact pixels).
 *
 *  - one render per road × faction × tier × form (base, Swift, Plated, Warded;
 *    a tier 5 is the clan's boss) — `docs/enemy-assets/<road>/`;
 *  - each road's tier-1 run cycle, frame by frame (the parts ride the walk), and
 *    the keg's four roll poses — `<road>/walk-*.png`;
 *  - a sheet per road (rows faction × tier, columns the forms) and the clan
 *    comparison row, in colour and in greyscale — `sheets/`, `compare*.png`.
 */
import { drawEnemy, setEnemyClan, setPresentationTime } from '../src/game/render/renderer'
import { setViewScale } from '../src/game/render/frame'
import { rollPoseFor, walkFrameFor } from '../src/game/render/units'
import { onSpritesReady, preloadPack } from '../src/game/render/sprites'
import { setActiveTheme } from '../src/game/render/themes'
import { ENEMY_TYPES } from '../src/game/data/enemies'
import type { ClanId } from '../src/game/data/clans'
import type { RtEnemy } from '../src/game/engine/engine'
import { enemyAssetRows, FORM_TITLE, FORMS, renderPath, ROADS, roadSlug, roadTitle, sheetPath, walkPath, type Form } from '../scripts/enemy-assets-lib'

const out = document.getElementById('out')!
/** The field's grass (`themes.tinyswords.field.top`). */
const GRASS = '#5a9b43'
/** A line goblin's box and a champion's, in logical px, feet at `oy`. */
const BOX = { w: 76, h: 76, oy: 60 }
const BOSS = { w: 132, h: 140, oy: 118 }
const SCALE = 3

const el = <K extends keyof HTMLElementTagNameMap>(t: K, cls?: string, text?: string) => {
  const n = document.createElement(t)
  if (cls) n.className = cls
  if (text !== undefined) n.textContent = text
  return n
}

function fake(key: string, distance = 0): RtEnemy {
  const type = ENEMY_TYPES[key]
  const maxHp = type.baseHp
  return {
    id: `ea-${key}`,
    key,
    type,
    hp: Math.round(maxHp * 0.72),
    maxHp,
    distance,
    pos: { x: 0, y: 0 },
    hitFlash: 0,
    burnDps: 0,
    burnUntil: -1,
    chillSlow: 0,
    chillUntil: -1,
    stunUntil: -1,
    frostUntil: -1,
    phase: 0,
  } as unknown as RtEnemy
}

/** The distance at which the walk cycle (or the keg's roll) shows frame `f`. */
function distanceFor(key: string, f: number): number {
  const t = ENEMY_TYPES[key]
  const barrel = key.startsWith('barrel')
  for (let d = 0; d < 400; d += 0.5) if ((barrel ? rollPoseFor(d, t.radius) : walkFrameFor(d, `ea-${key}`, 6)) === f) return d
  return 0
}

function canvas(path: string | null, w: number, h: number, scale = SCALE): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = el('canvas')
  c.width = w * scale
  c.height = h * scale
  c.style.width = `${w * 1.5}px`
  if (path) c.dataset.out = path
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = GRASS
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.scale(scale, scale)
  return { c, ctx }
}

/** One goblin, drawn by the game, centred in its box. */
function drawOne(ctx: CanvasRenderingContext2D, clan: ClanId | null, key: string, x: number, y: number, distance = 0): void {
  setEnemyClan(clan)
  ctx.save()
  ctx.translate(x, y)
  drawEnemy(ctx, fake(key, distance), 0, 0, false)
  ctx.restore()
}

const boxOf = (key: string) => (ENEMY_TYPES[key].isBoss ? BOSS : BOX)

function render(clan: ClanId | null, key: string, form: Form): HTMLCanvasElement {
  const k = form === 'base' ? key : `${key}_${form}`
  const b = boxOf(key)
  const { c, ctx } = canvas(renderPath(clan, key, form), b.w, b.h)
  drawOne(ctx, clan, k, b.w / 2, b.oy)
  return c
}

function walk(clan: ClanId | null, key: string): HTMLCanvasElement {
  const b = boxOf(key)
  const n = key.startsWith('barrel') ? 4 : 6
  const { c, ctx } = canvas(walkPath(clan, key), b.w * n, b.h)
  for (let f = 0; f < n; f++) drawOne(ctx, clan, key, b.w * f + b.w / 2, b.oy, distanceFor(key, f))
  return c
}

/** A road's sheet: rows faction × tier, columns the forms (the asset page's component set). */
function sheet(clan: ClanId | null, grey = false): HTMLCanvasElement {
  const rows = enemyAssetRows().filter((r) => r.clan === clan)
  const cw = BOSS.w
  const hOf = (boss: boolean) => (boss ? BOSS.h : BOX.h)
  const tops = rows.map((_, j) => rows.slice(0, j).reduce((a, r) => a + hOf(r.boss), 0))
  const { c, ctx } = canvas(grey ? null : sheetPath(clan), cw * FORMS.length, tops[rows.length - 1] + hOf(rows[rows.length - 1].boss), 2)
  rows.forEach((r, j) => FORMS.forEach((form, i) => drawOne(ctx, clan, form === 'base' ? r.key : `${r.key}_${form}`, cw * i + cw / 2, tops[j] + (r.boss ? BOSS.oy : BOX.oy))))
  return c
}

/** The clan comparison: each road's tier 3 of every faction and its torch champion, side by side. */
function compare(grey: boolean): HTMLCanvasElement {
  const keys = ['torch3', 'tnt3', 'barrel3', 'torch5']
  const cws = [64, 56, 48, 136]
  const group = cws.reduce((a, b) => a + b, 0) + 12
  const ch = 150
  const { c, ctx } = canvas(grey ? 'compare-grey.png' : 'compare.png', group * ROADS.length, ch)
  ROADS.forEach((clan, n) =>
    keys.forEach((key, i) => {
      const x = n * group + 6 + cws.slice(0, i).reduce((a, b) => a + b, 0) + cws[i] / 2
      drawOne(ctx, clan, key, x, key === 'torch5' ? 136 : 128)
    }),
  )
  if (grey) {
    const g = c.getContext('2d')!
    const img = g.getImageData(0, 0, c.width, c.height)
    for (let p = 0; p < img.data.length; p += 4) {
      const l = Math.round(0.299 * img.data[p] + 0.587 * img.data[p + 1] + 0.114 * img.data[p + 2])
      img.data[p] = img.data[p + 1] = img.data[p + 2] = l
    }
    g.putImageData(img, 0, 0)
  }
  return c
}

function build(): void {
  out.textContent = ''
  setPresentationTime(0)
  setViewScale(1)
  out.append(el('h2', undefined, 'Clan comparison — tier 3 of each faction, and the torch champion'), compare(false), compare(true))
  for (const clan of ROADS) {
    out.append(el('h2', undefined, roadTitle(clan)))
    for (const row of enemyAssetRows().filter((r) => r.clan === clan)) {
      const r = el('div', 'ea-row')
      r.append(el('b', undefined, `${row.name} — ${row.look}`))
      for (const form of FORMS) {
        const col = el('div')
        col.title = FORM_TITLE[form]
        col.append(render(clan, row.key, form))
        r.append(col)
      }
      out.append(r)
    }
    const w = el('div', 'ea-row')
    w.append(el('b', undefined, 'run cycle / roll, frame by frame'), walk(clan, 'torch1'), walk(clan, 'tnt1'), walk(clan, 'barrel1'), walk(clan, 'torch5'))
    out.append(w)
    const s = el('div', 'ea-row')
    s.append(el('b', undefined, `sheet · ${roadSlug(clan)}`), sheet(clan))
    out.append(s)
  }
  setEnemyClan(null)
}

/**
 * The draw cost of a crowded wave, plain against a clan: the critique wave's 27
 * bodies (tiers 1–5, elites, two champions) drawn `frames` times into a
 * field-sized canvas, walking. `window.__benchDraw('delve')` → ms per frame.
 */
function benchDraw(clan: ClanId | null, frames = 600): number {
  const keys = ['torch1', 'torch1', 'torch1', 'torch1', 'torch1', 'tnt2_warded', 'torch2', 'torch2', 'torch2', 'barrel1', 'torch3_plated', 'torch3_plated', 'torch2_swift', 'torch2_swift', 'tnt1', 'tnt1', 'tnt1', 'torch4', 'torch4', 'barrel3_warded', 'tnt3', 'tnt3', 'barrel4', 'tnt4_plated', 'torch3', 'torch5', 'tnt5']
  const c = document.createElement('canvas')
  c.width = 960
  c.height = 560
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  setEnemyClan(clan)
  const es = keys.map((k, i) => {
    const e = fake(k)
    e.id = `bench-${i}`
    e.pos = { x: 40 + ((i * 37) % 880), y: 60 + ((i * 53) % 440) }
    return e
  })
  for (const e of es) drawEnemy(ctx, e, 0, 0, false) // warm the bakes
  const t0 = performance.now()
  for (let f = 0; f < frames; f++) {
    ctx.clearRect(0, 0, 960, 560)
    for (const e of es) {
      e.distance += 2.3
      drawEnemy(ctx, e, f / 60, f / 60, false)
    }
  }
  return (performance.now() - t0) / frames
}
;(window as unknown as { __benchDraw: typeof benchDraw }).__benchDraw = benchDraw

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

setActiveTheme('tinyswords')
preloadPack('tinyswords')
onSpritesReady(async () => {
  build()
  await sleep(600)
  build()
  ;(window as unknown as { __enemyAssetsReady: boolean }).__enemyAssetsReady = true
})
