/**
 * Peoples & Trades — the proposal's contact sheets (`docs/peoples/`).
 *
 * Run:  npx vite --port 5229  →  http://localhost:5229/harness/peoples.html
 *       (`node scripts/peoples-sheets.mjs` shoots every `.sheet` to its PNG)
 *
 * Per people, two sheets: the 20 items (icon at 2× and 4×, the hero holding
 * or wearing it on a battlefield post at 3×) and the 10 skills (icon, and the
 * hero with the skill's tell, mid-hit on a goblin on the road). Every figure
 * is the game's own `drawSentinel` → `heroFigure` (the cuts, the body dresser,
 * the bake, the fists) on the real Green Line bake (`drawField`), and every
 * goblin the real `drawEnemy`. Draft art enters only through the two seams
 * the draw code takes for it — `HeroGear.art` (a held picture) and
 * `HeroGear.bodyStyle` (a body piece as data) — and the drafted tells
 * (`peoples-tells.ts`). Nothing here is reachable from the game.
 *
 * `window.__peoples` carries the review checks: icon uniqueness (pixel
 * distance between every pair at 1×), hero-figure uniqueness, and whether any
 * tell touches the goblin or its HP bar.
 */
import '../src/styles/global.css'
import { drawEnemy, drawField, drawSentinel, drawTrap, setPresentationTime, type DrawSentinel } from '../src/game/render/renderer'
import { drawFxDecals, drawFxFloaters, drawFxParticles, fxAdvance, fxArc, fxFloater, fxImpact, fxMuzzle, fxProc, fxReset, FLOAT_CRIT, FLOAT_NUM } from '../src/game/render/fx'
import { rigFor, type HeldArt, type HeroGear } from '../src/game/render/gearMarks'
import { onSpritesReady, preloadSprites } from '../src/game/render/sprites'
import { setActiveTheme } from '../src/game/render/themes'
import { iconCell, type IconKey } from '../src/game/data/iconAtlas'
import { lookHue } from '../src/game/data/sentinels'
import { ENEMY_TYPES } from '../src/game/data/enemies'
import { FIRST_MAP } from '../src/game/data/maps'
import { isBodyKey } from '../src/game/render/bodyLayer'
import type { RtEnemy } from '../src/game/engine/engine'
import type { Vec2 } from '../src/game/core/vec'
import { allArt, artRGBA, isArt, PEOPLES, type Art, type DraftItem, type DraftSkill, type People } from '../scripts/peoples-art'
import { drawMark, drawTellOver, drawTellUnder } from './peoples-tells'

const q = new URLSearchParams(location.search)
const ONLY = q.get('people')
const out = document.getElementById('out')!
const MAP = FIRST_MAP
const LOOK = 'fighter' as const
/** The display scales. */
const HERO_X = 3
/** The item post: open grass inside the Green Line's east loop, no road in view. */
const ITEM_POST = tileAt(14, 6)
/** The skill post: open grass beside the road, the goblins on the road east of it. */
const SKILL_POST = tileAt(16, 6)
/** On the road a step down from the hero, so the hero, its blow and the goblin's HP bar all fit a 252 px column at 3×. */
const FOE = { x: SKILL_POST.x + 40, y: SKILL_POST.y + 34 }
const FOE2 = { x: SKILL_POST.x + 41, y: SKILL_POST.y + 74 }
/**
 * Logical px; the hero's art is 84 × 95 at native density, feet at +8. A
 * weapon reaches right of the fist, an off-hand piece left of the other, so
 * each is framed toward its own side.
 */
const ITEM_BOX = { w: 84, h: 112, hx: 42, hy: 92 }
const WEAPON_BOX = { ...ITEM_BOX, hx: 38 }
const SKILL_BOX = { w: 84, h: 184, hx: 30, hy: 92 }

function tileAt(col: number, row: number): Vec2 {
  const t = MAP.tiles?.find((x) => x.col === col && x.row === row)
  if (!t) throw new Error(`no tile ${col},${row}`)
  return { ...t.pos }
}

/** A deterministic Math.random, so every render (and the FX bursts) is the same. */
function seedRandom(seed: number): void {
  let s = seed >>> 0
  Math.random = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const el = <K extends keyof HTMLElementTagNameMap>(t: K, cls?: string, text?: string) => {
  const n = document.createElement(t)
  if (cls) n.className = cls
  if (text !== undefined) n.textContent = text
  return n
}

/* ------------------------------------------------------------------ icons */

const atlas = new Image()
atlas.src = 'assets/ui/fw-icons.png'
const atlasReady = new Promise<void>((res) => (atlas.onload = () => res()))

/** One 16 × 16 icon cell, drafted or from the shipped atlas. */
const cells = new Map<Art | IconKey, HTMLCanvasElement>()
function cellOf(icon: Art | IconKey): HTMLCanvasElement {
  const hit = cells.get(icon)
  if (hit) return hit
  const c = el('canvas')
  c.width = c.height = 16
  const g = c.getContext('2d', { willReadFrequently: true })!
  if (isArt(icon)) g.putImageData(new ImageData(new Uint8ClampedArray(artRGBA(icon)), 16, 16), 0, 0)
  else {
    const { ix, iy } = iconCell(icon)
    g.drawImage(atlas, ix * 16, iy * 16, 16, 16, 0, 0, 16, 16)
  }
  cells.set(icon, c)
  return c
}

function scaled(src: HTMLCanvasElement, k: number, cls = 'ic'): HTMLCanvasElement {
  const c = el('canvas', cls)
  c.width = src.width * k
  c.height = src.height * k
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.drawImage(src, 0, 0, c.width, c.height)
  return c
}

/* ------------------------------------------------------------- the hero */

const DEFAULT_GRIP = { x: 8, y: 11 }
function held(it: DraftItem): HeldArt | undefined {
  return isArt(it.icon) ? { cell: cellOf(it.icon), grip: it.grip ?? DEFAULT_GRIP } : undefined
}

/** What a hero holding / wearing only this item carries — in the real gear shape. */
function gearFor(it: DraftItem, glint = it.glint ?? null): HeroGear {
  const g: HeroGear = { main: null, off: null, body: null, glint: null }
  const key = isArt(it.icon) ? null : it.icon
  if (it.slot === 'body') {
    if (typeof it.body === 'string' && isBodyKey(it.body)) g.body = it.body
    else if (it.body && typeof it.body === 'object') g.bodyStyle = it.body
    return g
  }
  if (it.slot === 'offHand') {
    if (key) g.off = key
    else g.art = { off: held(it) }
    return g
  }
  if (key) g.main = key
  else g.art = { main: held(it), off: it.twin ? held(it) : undefined }
  g.glint = glint
  return g
}

/** A people's skill kit: its main weapon (and off hand), by item name. */
function kitGear(p: People, glint: HeroGear['glint']): HeroGear {
  const main = p.items.find((i) => i.name === p.kit.main)!
  const g = gearFor(main, glint)
  if (p.kit.off) {
    const off = gearFor(p.items.find((i) => i.name === p.kit.off)!)
    g.off = off.off
    if (off.art?.off) g.art = { ...g.art, off: off.art.off }
  }
  return g
}

function sentinel(id: string, pos: Vec2, gear: HeroGear, over: Partial<DrawSentinel> = {}): DrawSentinel {
  return {
    id,
    pos,
    archetype: LOOK,
    ...lookHue(LOOK),
    range: 96,
    aimAngle: 0,
    fireFlash: 0,
    procFlash: 0,
    patienceStacks: 0,
    blocking: false,
    gear,
    ...over,
  }
}

function fieldCanvas(box: { w: number; h: number; hx: number; hy: number }, at: Vec2, k: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = el('canvas', 'hero')
  c.width = box.w * k
  c.height = box.h * k
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.imageSmoothingEnabled = false
  g.scale(k, k)
  const x0 = at.x - box.hx
  const y0 = at.y - box.hy
  g.translate(-x0, -y0)
  drawField(g, MAP, { x0, y0, w: box.w, h: box.h })
  return { c, g }
}

function itemHero(it: DraftItem, k = HERO_X): HTMLCanvasElement {
  const weapon = it.slot !== 'offHand' && it.slot !== 'body'
  const { c, g } = fieldCanvas(weapon ? WEAPON_BOX : ITEM_BOX, ITEM_POST, k)
  setPresentationTime(0.01)
  fxReset()
  drawSentinel(g, sentinel('item', ITEM_POST, gearFor(it)))
  return c
}

/* --------------------------------------------------------- the skill frame */

function goblin(id: string, pos: Vec2, sk: DraftSkill, struck: boolean): RtEnemy {
  // A keg: compact and drawn round its centre, so the blow, its marks and its HP bar all fit the column.
  const type = ENEMY_TYPES.barrel2
  const st = struck ? sk.hit.status ?? [] : []
  return {
    id,
    key: 'barrel2',
    type,
    hp: Math.round(type.baseHp * 0.62),
    maxHp: type.baseHp,
    distance: 0,
    pos: { ...pos },
    hitFlash: 0,
    burnDps: st.includes('burn') ? 10 : 0,
    burnUntil: st.includes('burn') ? 99 : -1,
    chillSlow: st.includes('chill') ? 0.25 : 0,
    chillUntil: st.includes('chill') ? 99 : -1,
    stunUntil: st.includes('stun') ? 99 : -1,
    frostUntil: -1,
    phase: 0,
  } as unknown as RtEnemy
}

/**
 * One skill, mid-hit. `parts` picks what is drawn (for the overlap check the
 * tells and the goblins are drawn alone on a clear canvas).
 */
function skillFrame(p: People, sk: DraftSkill, k: number, parts: 'all' | 'tells' | 'foes' = 'all'): HTMLCanvasElement {
  const glint = sk.tell.find((t) => t.kind === 'glint')
  const gear = kitGear(p, glint && glint.kind === 'glint' ? glint.effect : null)
  let c: HTMLCanvasElement
  let g: CanvasRenderingContext2D
  if (parts === 'all') ({ c, g } = fieldCanvas(SKILL_BOX, SKILL_POST, k))
  else {
    c = el('canvas')
    c.width = SKILL_BOX.w * k
    c.height = SKILL_BOX.h * k
    g = c.getContext('2d', { willReadFrequently: true })!
    g.imageSmoothingEnabled = false
    g.scale(k, k)
    g.translate(-(SKILL_POST.x - SKILL_BOX.hx), -(SKILL_POST.y - SKILL_BOX.hy))
  }
  const hero = SKILL_POST
  const foe = FOE
  const two = !!(sk.hit.second || sk.hit.chain || sk.hit.splash || sk.hit.pierce)
  const now = 0.4
  setPresentationTime(now)
  fxReset()
  seedRandom(7 + sk.name.length * 31)

  // The blow lands (real FX), then the frame is advanced a beat: mid-hit.
  const dx = foe.x - hero.x
  const dy = foe.y - hero.y
  const delivery = p.kit.delivery
  fxMuzzle('hero', hero.x, hero.y, Math.atan2(dy, dx), lookHue(LOOK).accent, delivery)
  fxImpact(foe.x, foe.y, dx, dy, {
    delivery,
    effect: sk.hit.effect ?? null,
    crit: sk.hit.crit,
    splash: sk.hit.splash,
    pierce: sk.hit.pierce,
    damageType: p.kit.damageType,
    srcX: hero.x,
    srcY: hero.y,
    side: 1,
  })
  // No `fxHitEnemy`: its white silhouette would hide the very marks the frame is for.
  if (sk.hit.chain) fxArc(foe.x, foe.y - 10, FOE2.x, FOE2.y - 10)
  if (sk.hit.chain && sk.hit.chain > 1) fxArc(FOE2.x, FOE2.y - 10, FOE2.x + 34, FOE2.y + 20)
  if (sk.hit.proc) fxProc('hero', sk.hit.proc, hero.x, hero.y)
  if (sk.hit.floater) fxFloater(foe.x - 4, foe.y + 2, sk.hit.floater.text, sk.hit.floater.ink, sk.hit.floater.crit ? FLOAT_CRIT : FLOAT_NUM)
  for (let i = 0; i < 3; i++) fxAdvance(1 / 60)

  const held = sk.hit.held || sk.tell.some((t) => t.kind === 'held')
  if (parts !== 'foes') {
    if (parts === 'all') drawFxDecals(g)
    if (parts === 'all' && sk.hit.trap) drawTrap(g, { x: foe.x, y: foe.y + 4 }, now)
    g.save()
    g.translate(hero.x, hero.y)
    for (const t of sk.tell) drawTellUnder(g, t, now)
    g.restore()
  }
  if (parts === 'foes') {
    for (const pos of two ? [FOE2, foe] : [foe]) drawEnemy(g, goblin('chk', pos, sk, true), now, 0, false)
    return c
  }
  // The blow has just left the hand: below the attack strip's threshold, so
  // every kit stands in the same pose and the hit FX carry the moment.
  if (parts === 'all') drawSentinel(g, sentinel('hero', hero, gear, { fireFlash: 0.04, blocking: !!held, delivery, aimAngle: Math.atan2(dy, dx) }))
  const rig = rigFor('tinyswords', LOOK)
  g.save()
  g.translate(hero.x, hero.y)
  for (const t of sk.tell) drawTellOver(g, t, rig.fistR, rig.fistL)
  g.restore()
  if (parts === 'all') {
    // Back to front, as the battle draws (`units.backToFront`): the goblins
    // stand lower on the road than the hero, so they are drawn over it.
    for (const [id, pos] of two ? ([['foe', foe], ['foe2', FOE2]] as const) : ([['foe', foe]] as const)) {
      drawEnemy(g, goblin(id, pos, sk, true), now, 0, false)
      g.save()
      g.translate(Math.round(pos.x), Math.round(pos.y) + 13)
      for (const m of sk.hit.mark ?? []) drawMark(g, m)
      g.restore()
    }
  }
  if (parts === 'all') {
    drawFxParticles(g)
    drawFxFloaters(g)
  }
  return c
}

/* ------------------------------------------------------------- checks */

const bbox = (c: HTMLCanvasElement) => {
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (d[(y * c.width + x) * 4 + 3] > 24) {
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x)
        y1 = Math.max(y1, y)
      }
  return x1 < 0 ? null : { x0, y0, x1, y1 }
}

const pixels = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data

/** How many pixels differ between two same-size RGBA buffers. */
function diff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let n = 0
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) n++
  return n
}

interface Report {
  icons: number
  closestIcons: { a: string; b: string; d: number }[]
  heroes: number
  closestHeroes: { a: string; b: string; d: number }[]
  tellOverlaps: string[]
  tellMaxX: { skill: string; x: number }[]
}

function checks(): Report {
  allArt()
  const icons: { key: string; px: Uint8ClampedArray }[] = []
  const heroes: { key: string; px: Uint8ClampedArray }[] = []
  const tellOverlaps: string[] = []
  const tellMaxX: { skill: string; x: number }[] = []
  for (const p of PEOPLES) {
    for (const it of p.items) {
      icons.push({ key: `${p.id}/${it.name}`, px: pixels(cellOf(it.icon)) })
      heroes.push({ key: `${p.id}/${it.name}`, px: pixels(itemHero(it, 1)) })
    }
    for (const sk of p.skills) {
      icons.push({ key: `${p.id}/skill/${sk.name}`, px: pixels(cellOf(sk.icon)) })
      const tc = skillFrame(p, sk, 1, 'tells')
      const fc = skillFrame(p, sk, 1, 'foes')
      const tells = bbox(tc)
      const foes = bbox(fc)
      if (tells && foes) {
        // The HP bar rides the top of the goblin's box: any tell pixel on a
        // goblin pixel there hides it; anywhere else on the goblin is noted.
        const tp = pixels(tc)
        const fp = pixels(fc)
        let bar = 0
        let body = 0
        for (let y = foes.y0; y <= foes.y1; y++)
          for (let x = foes.x0; x <= foes.x1; x++) {
            const o = (y * tc.width + x) * 4
            if (tp[o + 3] > 24 && fp[o + 3] > 24) {
              if (y <= foes.y0 + 10) bar++
              else body++
            }
          }
        if (bar || body) tellOverlaps.push(`${p.id}/${sk.name} (bar ${bar}, goblin ${body})`)
      }
      if (tells) tellMaxX.push({ skill: `${p.id}/${sk.name}`, x: tells.x1 - SKILL_BOX.hx })
    }
  }
  const closest = (list: { key: string; px: Uint8ClampedArray }[]) => {
    const pairs: { a: string; b: string; d: number }[] = []
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) pairs.push({ a: list[i].key, b: list[j].key, d: diff(list[i].px, list[j].px) })
    return pairs.sort((x, y) => x.d - y.d).slice(0, 8)
  }
  return { icons: icons.length, closestIcons: closest(icons), heroes: heroes.length, closestHeroes: closest(heroes), tellOverlaps, tellMaxX: tellMaxX.sort((a, b) => b.x - a.x).slice(0, 5) }
}

/* -------------------------------------------------------------- the sheets */

const levelTag = (l: number) => (l === 4 ? 'L4 ★' : `L${l}`)

function itemCell(it: DraftItem): HTMLElement {
  const cell = el('figure', `cell lv${it.level}`)
  const head = el('div', 'head')
  const cell16 = cellOf(it.icon)
  head.append(scaled(cell16, 4), scaled(cell16, 2))
  const tags = el('div', 'tags')
  tags.append(el('span', `lv lv${it.level}`, levelTag(it.level)))
  if (it.status === 'new') tags.append(el('span', 'new', 'NEW'))
  if (it.status === 'renamed') tags.append(el('span', 'ren', 'RENAMED'))
  head.append(tags)
  cell.append(head, el('figcaption', 'name', it.name))
  if (it.was) cell.append(el('div', 'was', `was ${it.was}`))
  cell.append(itemHero(it))
  return cell
}

function skillCell(p: People, sk: DraftSkill): HTMLElement {
  const cell = el('figure', `cell sk lv${sk.level}`)
  const head = el('div', 'head')
  const cell16 = cellOf(sk.icon)
  head.append(scaled(cell16, 4), scaled(cell16, 2))
  const tags = el('div', 'tags')
  tags.append(el('span', `lv lv${sk.level}`, `L${sk.level}`))
  if (sk.signature) tags.append(el('span', 'sig', 'SIGNATURE'))
  else if (sk.status.startsWith('new')) tags.append(el('span', 'new', 'NEW'))
  head.append(tags)
  cell.append(head, el('figcaption', 'name', sk.name))
  cell.append(skillFrame(p, sk, HERO_X))
  return cell
}

function sheet(p: People, kind: 'items' | 'skills'): HTMLElement {
  const s = el('section', `sheet ${p.id}`)
  s.dataset.out = `docs/peoples/${p.id}-${kind}.png`
  const h = el('header')
  h.append(el('h1', undefined, `${p.title} · ${p.company}`))
  h.append(el('div', 'sub', kind === 'items' ? `Items — 20 kinds, by level · ${p.materials}` : `Skills — 10, by level, signature first · the tell on the hero, mid-hit`))
  h.append(el('div', 'draft', 'DRAFT ART · proposal'))
  s.append(h)
  const grid = el('div', `grid ${kind}`)
  if (kind === 'items') {
    const items = [...p.items].sort((a, b) => a.level - b.level)
    for (const it of items) grid.append(itemCell(it))
  } else {
    const skills = [...p.skills].sort((a, b) => (b.signature ? 1 : 0) - (a.signature ? 1 : 0) || a.level - b.level)
    for (const sk of skills) grid.append(skillCell(p, sk))
  }
  s.append(grid)
  s.append(el('footer', undefined, kind === 'items' ? 'Each cell: the icon at 4× and 2×; the hero holding or wearing only that item, on a grass post, at 3× (the game’s own figure, fists and body dresser).' : 'Each cell: the icon at 4× and 2×; the hero with the skill’s tell, mid-hit on a goblin on the road, at 3× (real hit FX; drafted tells where the game has none).'))
  return s
}

function build(): void {
  out.textContent = ''
  for (const p of PEOPLES) {
    if (ONLY && p.id !== ONLY) continue
    if (!p.items.length) continue
    out.append(sheet(p, 'items'), sheet(p, 'skills'))
  }
}

setActiveTheme('tinyswords')
preloadSprites()
onSpritesReady(async () => {
  await atlasReady
  build()
  // A second pass once every lazy bake (terrain, clan strips) has landed.
  setTimeout(() => {
    build()
    const w = window as unknown as { __peoples: Report; __peoplesReady: boolean }
    w.__peoples = checks()
    w.__peoplesReady = true
  }, 900)
})
