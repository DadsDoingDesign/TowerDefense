/**
 * Phase 1 vertical-slice harness (`docs/ART-PLAN.md` §4).
 *
 * Renders the fighter across several loadouts, at the sizes the game actually
 * blits them, **through the real draw code** — `drawSentinel`, `pixmap`, the
 * loadout compositor. Nothing here reimplements the renderer, because a
 * harness that draws its own version of a sprite proves nothing about the
 * sprite.
 *
 * Run:  npx vite --port 5188  →  http://localhost:5188/harness/
 *
 * What it is for:
 *   - does the style hold at 390 and at 320
 *   - do four loadouts read apart at a glance
 *   - is the contour ring ONE ring around the assembled figure
 *   - do the anchors hold across every frame of every strip
 *   - do the fifteen silhouettes survive the 10px test
 */
import { drawEnemy, drawSentinel, type DrawSentinel } from '../src/game/render/renderer'
import type { Loadout } from '../src/game/render/loadout'
import { onSpritesReady, preloadPack } from '../src/game/render/sprites'
import { setActiveTheme } from '../src/game/render/themes'
import { ENEMY_TYPES } from '../src/game/data/enemies'
import type { RtEnemy } from '../src/game/engine/engine'

const PACK = 'fieldwatch'

/**
 * Device pixels per logical px, measured (`BattleCanvas.tsx:883`). The field
 * composites at 960×560 and blits once at this factor, so a sprite's real
 * on-screen size is `logical × VIEW × dpr`. Anything the harness shows at 1:1
 * is bigger than the player will ever see it.
 */
const VIEWS = [
  { label: '390 phone', view: 0.40625, dpr: 2 },
  { label: '320 phone', view: 0.27677, dpr: 2 },
  { label: '320 + coach strip', view: 0.174, dpr: 2 },
]

const LOADOUTS: { name: string; lo: Loadout }[] = [
  { name: 'bare', lo: { mainHand: null, offHand: null, body: null } },
  { name: 'sword + shield', lo: { mainHand: 'sword', offHand: 'shield', body: 'plate' } },
  { name: 'greatsword', lo: { mainHand: 'greatsword', offHand: null, body: 'plate' } },
  { name: 'staff + robe', lo: { mainHand: 'staff', offHand: null, body: 'robe' } },
  { name: 'dagger + buckler', lo: { mainHand: 'dagger', offHand: 'buckler', body: 'robe' } },
]

const el = <K extends keyof HTMLElementTagNameMap>(t: K, cls?: string, text?: string) => {
  const n = document.createElement(t)
  if (cls) n.className = cls
  if (text !== undefined) n.textContent = text
  return n
}

function sentinel(over: Partial<DrawSentinel> = {}): DrawSentinel {
  return {
    id: 'harness', pos: { x: 0, y: 0 }, archetype: 'fighter',
    color: '#d9743f', accent: '#e0ac4c', range: 96, aimAngle: 0,
    fireFlash: 0, hp: 100, maxHp: 100, downed: false,
    procFlash: 0, patienceStacks: 0, blocking: false, ...over,
  }
}

/**
 * Draw one hero into a fresh canvas at `scale`.
 *
 * `drawSentinel` draws in logical px around the origin, so the canvas is sized
 * in logical px and the whole thing is scaled once — the same shape as the
 * game's single final blit, rather than scaling each sprite.
 */
function heroCanvas(lo: Loadout, firing: boolean, scale: number, box = { w: 120, h: 110 }): HTMLCanvasElement {
  const c = el('canvas')
  c.width = Math.round(box.w * scale)
  c.height = Math.round(box.h * scale)
  c.style.width = `${Math.round(box.w * scale)}px`
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.scale(scale, scale)
  ctx.translate(box.w / 2, box.h - 18)
  drawSentinel(ctx, sentinel({ loadout: lo, fireFlash: firing ? 0.55 : 0 }))
  return c
}

function cell(caption: string, node: HTMLElement, sub?: string): HTMLElement {
  const d = el('div', 'cell')
  d.appendChild(node)
  const cap = el('div', 'cap')
  cap.appendChild(el('b', undefined, caption))
  if (sub) { cap.appendChild(document.createElement('br')); cap.append(sub) }
  d.appendChild(cap)
  return d
}

function section(title: string, note: string): HTMLElement {
  const s = el('section')
  s.appendChild(el('h2', undefined, title))
  s.appendChild(el('p', 'note', note))
  return s
}

/** Fill a canvas's opaque pixels with flat black — the silhouette gate. */
function silhouette(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = el('canvas')
  c.width = src.width; c.height = src.height
  c.className = 'sil'
  const ctx = c.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, c.width, c.height)
  return c
}

function build(): void {
  const app = document.getElementById('app')!
  app.textContent = ''

  // ---- 1. loadouts at true device size --------------------------------
  for (const v of VIEWS) {
    const s = section(
      `Loadouts — ${v.label}`,
      `scale ${(v.view * v.dpr).toFixed(4)} device px per logical px. This is the size a player actually sees. ` +
      `If two loadouts do not read apart here, the gear channel is decorative.`,
    )
    const row = el('div', 'row')
    for (const { name, lo } of LOADOUTS) {
      row.appendChild(cell(name, heroCanvas(lo, false, v.view * v.dpr), 'idle'))
    }
    s.appendChild(row)
    const row2 = el('div', 'row')
    for (const { name, lo } of LOADOUTS) {
      row2.appendChild(cell(name, heroCanvas(lo, true, v.view * v.dpr), 'attack'))
    }
    s.appendChild(row2)
    app.appendChild(s)
  }

  // ---- 2. 4x inspection ------------------------------------------------
  const insp = section(
    'Loadouts — 4× inspection',
    'Nearest-neighbour blow-up for checking the composite. Look for ONE contour ring around the whole ' +
    'figure: a ring between hand and weapon means the composite ran after the bake.',
  )
  const irow = el('div', 'row')
  for (const { name, lo } of LOADOUTS) {
    const c = heroCanvas(lo, false, 4)
    c.style.imageRendering = 'pixelated'
    irow.appendChild(cell(name, c, 'idle ×4'))
  }
  insp.appendChild(irow)
  const irow2 = el('div', 'row')
  for (const { name, lo } of LOADOUTS) {
    const c = heroCanvas(lo, true, 4)
    c.style.imageRendering = 'pixelated'
    irow2.appendChild(cell(name, c, 'attack ×4'))
  }
  insp.appendChild(irow2)
  app.appendChild(insp)

  // ---- 3. anchor drift across every frame -----------------------------
  const drift = section(
    'Anchor drift — every frame, longest weapon',
    'Gate: the grip must not slide and the weapon must not clip the body, in all 6 idle and all 6 attack frames. ' +
    'Attack frames are driven by fireFlash, which is what the game does.',
  )
  const lo = LOADOUTS[2].lo // greatsword: the longest reach, so drift shows first
  const arow = el('div', 'row')
  for (let f = 0; f < 6; f++) {
    const c = el('canvas')
    c.width = 120 * 3; c.height = 110 * 3
    c.style.imageRendering = 'pixelated'
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.scale(3, 3)
    ctx.translate(60, 92)
    // fireFlash decays 1→0 and the strip plays across it; step it to hit frame f.
    drawSentinel(ctx, sentinel({ loadout: lo, fireFlash: 1 - (f + 0.5) / 6 }))
    arow.appendChild(cell(`atk ${f}`, c))
  }
  drift.appendChild(arow)
  app.appendChild(drift)

  // ---- 4. silhouette gate ---------------------------------------------
  const sil = section(
    'Silhouette gate — 10 CSS px',
    'Fill solid black, scale to the smallest measured case. Every enemy must be nameable and no two ' +
    'factions confusable. Heroes must separate by outline alone, because colour-vision modes re-tint hue.',
  )
  const srow = el('div', 'row')
  for (const { name, lo: l } of LOADOUTS) {
    srow.appendChild(cell(name, silhouette(heroCanvas(l, false, 0.348)), 'hero'))
  }
  sil.appendChild(srow)

  const erow = el('div', 'row')
  for (const def of Object.values(ENEMY_TYPES)) {
    const c = el('canvas')
    c.width = 110; c.height = 90
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.translate(55, 64)
    const e: RtEnemy = {
      id: `h-${def.id}`, type: def, hp: def.baseHp, maxHp: def.baseHp,
      // A non-zero distance matters: the walk cycle and the barrel roll are
      // driven by ground covered, not by the clock.
      distance: 40, pos: { x: 0, y: 0 }, hitFlash: 0,
      burnDps: 0, burnUntil: 0, burnSrcId: undefined, burnType: 'physical',
      chillSlow: 0, chillUntil: 0, stunUntil: 0, blockedBy: null,
    }
    drawEnemy(ctx, e, 0, 0)
    erow.appendChild(cell(def.id, silhouette(c), def.name))
  }
  sil.appendChild(erow)
  app.appendChild(sil)

  document.getElementById('sub')!.append(' — pack: ' + PACK)
}

setActiveTheme(PACK)
preloadPack(PACK)
onSpritesReady(() => {
  try {
    build()
  } catch (e) {
    document.getElementById('warn')!.textContent = `Harness error: ${(e as Error).message}`
    throw e
  }
})
