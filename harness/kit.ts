/**
 * Kit look — every body piece on every Tiny Swords look, through the real draw
 * code (`drawSentinel` → `heroFigure`: cuts, `bodyLayer`, bake, held marks),
 * and the portrait each one gets (`heroPortrait`), for the design review.
 *
 * Run:  npx vite --port 5223  →  http://localhost:5223/harness/kit.html
 *       (`?scale=2` for the field's phone density, `?frames=1` for every frame,
 *       `?shield=1` for the knight's off hands over its rebuilt body)
 */
import '../src/styles/global.css'
import { drawSentinel, setPresentationTime, type DrawSentinel } from '../src/game/render/renderer'
import { heroGear, type HeroGear, type Hold } from '../src/game/render/gearMarks'
import { heroPortraitCanvas } from '../src/game/render/heroPortrait'
import { BODY_KEYS } from '../src/game/render/bodyLayer'
import { onSpritesReady, preloadPack } from '../src/game/render/sprites'
import { setActiveTheme } from '../src/game/render/themes'
import { lookOf } from '../src/game/data/gear'
import { lookHue } from '../src/game/data/sentinels'
import { generateItem } from '../src/game/data/items'
import { RNG } from '../src/game/core/rng'
import type { Archetype, Equipment, Item } from '../src/game/types'

const q = new URLSearchParams(location.search)
const SCALE = Number(q.get('scale') ?? 3)
const out = document.getElementById('out')!
const GRASS = '#5a9b43'
/** The figure's box, in logical px; the shield review's is wide enough for the swing. */
const BOX = q.get('shield') ? { w: 136, h: 128, ox: 64, oy: 112 } : { w: 104, h: 112, ox: 46, oy: 96 }

const BODY_KIND: Record<string, string> = {
  mail: 'Mail',
  plate: 'Plate',
  cloth: 'Robe',
  cloak: 'Cloak',
  aegis: 'Aegis',
  ironheart: 'Ironheart Plate',
  silkwind: 'Silkwind Cloak',
}
const deal = (kind: string, n = 1): Item => generateItem(new RNG(7000 + n * 13 + kind.length), { kind, rarity: 'rare', allowCurse: false })
const plain = (kind: string): Item => ({ ...deal(kind), enchantments: [] })

/** The three looks, each in the hands that pick it (`gear.lookOf`). */
const HANDS: { title: string; main: string | null; off: string | null }[] = [
  { title: 'Sword + Shield', main: 'Sword', off: 'Shield' },
  { title: 'Greatsword', main: 'Greatsword', off: null },
  { title: 'Bow', main: 'Bow', off: null },
  { title: 'Wand + Tome', main: 'Wand', off: 'Tome' },
]

function eq(main: string | null, off: string | null, body: string | null): Equipment {
  return { mainHand: main ? plain(main) : null, offHand: off ? plain(off) : null, body: body ? plain(body) : null }
}

/** `&hold=hand|cover` forces how the off hand holds its piece (`gearMarks.holdOf`), to compare the two. */
const HOLD = q.get('hold') as Hold | null
const kitGear = (e: Equipment): HeroGear => (HOLD ? { ...heroGear(e), hold: HOLD } : heroGear(e))

function sentinel(look: Archetype, e: Equipment, fire = 0): DrawSentinel {
  return {
    id: 'kit',
    pos: { x: 0, y: 0 },
    archetype: look,
    ...lookHue(look),
    range: 96,
    aimAngle: 0,
    fireFlash: fire,
    procFlash: 0,
    patienceStacks: 0,
    blocking: false,
    gear: kitGear(e),
  }
}

function fig(e: Equipment, label: string, fire = 0, t = 0): HTMLElement {
  const wrap = document.createElement('figure')
  const c = document.createElement('canvas')
  c.width = BOX.w * SCALE
  c.height = BOX.h * SCALE
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.fillStyle = GRASS
  g.fillRect(0, 0, c.width, c.height)
  g.scale(SCALE, SCALE)
  g.translate(BOX.ox, BOX.oy)
  setPresentationTime(t)
  drawSentinel(g, sentinel(lookOf({ equipment: e }), e, fire))
  const cap = document.createElement('figcaption')
  cap.textContent = label
  wrap.append(c, cap)
  return wrap
}

function portrait(e: Equipment, label: string): HTMLElement {
  const wrap = document.createElement('figure')
  wrap.className = 'pt'
  const c = heroPortraitCanvas(lookOf({ equipment: e }), kitGear(e))
  const img = document.createElement('img')
  if (c) img.src = c.toDataURL()
  const sizes = [22, 30, 36, 72]
  for (const s of sizes) {
    const box = document.createElement('span')
    box.className = 'pt-box'
    box.style.width = box.style.height = `${s}px`
    const i = img.cloneNode() as HTMLImageElement
    box.append(i)
    wrap.append(box)
  }
  const cap = document.createElement('figcaption')
  cap.textContent = label
  wrap.append(cap)
  return wrap
}

/**
 * `?shield=1` — the knight with its painted shield cut and the body under it
 * rebuilt (`gearMarks.cutAndFill`, `shieldFill.generated.ts`): every off hand
 * the armoured look holds, and none, each in no body piece and four of them,
 * at rest and through the swing — beside the painted-shield knight it came
 * from (the Shield row). `&scale=` sets the zoom.
 */
const OFF_HANDS: { title: string; main: string | null; off: string | null }[] = [
  { title: 'Sword + Shield (the art as painted)', main: 'Sword', off: 'Shield' },
  { title: 'Sword, empty off hand', main: 'Sword', off: null },
  { title: 'Greatsword (two-hander)', main: 'Greatsword', off: null },
  { title: 'Sword + Tome', main: 'Sword', off: 'Tome' },
  { title: 'Sword + Quiver', main: 'Sword', off: 'Quiver' },
  { title: 'Sword + Focus', main: 'Sword', off: 'Focus' },
  { title: 'Sword + Buckler', main: 'Sword', off: 'Buckler' },
  { title: 'Sword + Pavise', main: 'Sword', off: 'Pavise' },
]
const SHIELD_BODIES = [null, 'Mail', 'Plate', 'Robe', 'Cloak']

function buildShield(): void {
  out.textContent = ''
  const only = q.get('only')
  for (const h of OFF_HANDS) {
    if (only && !h.title.toLowerCase().includes(only.toLowerCase())) continue
    const row = document.createElement('section')
    row.innerHTML = `<h2>${h.title}</h2>`
    const figs = document.createElement('div')
    figs.className = 'row'
    for (const b of SHIELD_BODIES) {
      const e = eq(h.main, h.off, b)
      figs.append(fig(e, `${b ?? 'no body'} · idle`, 0, 0.01))
      if (q.get('frames')) for (const ff of [0.95, 0.6, 0.3]) figs.append(fig(e, `${b ?? 'no body'} · atk ${ff}`, ff))
    }
    row.append(figs)
    const pts = document.createElement('div')
    pts.className = 'row'
    for (const b of SHIELD_BODIES) pts.append(portrait(eq(h.main, h.off, b), b ?? 'no body'))
    if (!q.get('nopt')) row.append(pts)
    out.append(row)
  }
}

function build(): void {
  if (q.get('shield')) return buildShield()
  out.textContent = ''
  for (const h of HANDS) {
    const row = document.createElement('section')
    row.innerHTML = `<h2>${h.title}</h2>`
    const figs = document.createElement('div')
    figs.className = 'row'
    figs.append(fig(eq(h.main, h.off, null), 'no body'))
    for (const k of BODY_KEYS) figs.append(fig(eq(h.main, h.off, BODY_KIND[k]), BODY_KIND[k]))
    row.append(figs)
    if (q.get('frames')) {
      for (const k of [null, ...BODY_KEYS]) {
        const strip = document.createElement('div')
        strip.className = 'row'
        const e = eq(h.main, h.off, k ? BODY_KIND[k] : null)
        for (let f = 0; f < 6; f++) strip.append(fig(e, `${k ?? 'none'} idle ${f}`, 0, f / 6 + 0.01))
        for (const ff of [0.95, 0.7, 0.45, 0.2]) strip.append(fig(e, `${k ?? 'none'} atk ${ff}`, ff))
        row.append(strip)
      }
    }
    const pts = document.createElement('div')
    pts.className = 'row'
    pts.append(portrait(eq(h.main, h.off, null), 'no body'))
    for (const k of BODY_KEYS) pts.append(portrait(eq(h.main, h.off, BODY_KIND[k]), BODY_KIND[k]))
    row.append(pts)
    out.append(row)
  }
}

setActiveTheme('tinyswords')
preloadPack('tinyswords')
onSpritesReady(() => {
  build()
  setTimeout(() => {
    build()
    ;(window as unknown as { __kitReady: boolean }).__kitReady = true
  }, 600)
})
