/**
 * Item assets — the render harness behind `scripts/item-assets.ts --render`
 * and the Figma page "Item assets" (`docs/FIGMA.md` § Item assets).
 *
 * Run:  npx vite --port 5217  →  http://localhost:5217/harness/items.html
 *
 * Every picture is drawn by the game's own code, never redrawn here:
 *  - the ICON is the pack tile's markup (`DetailBand` PackGrid: `.sh-tile`,
 *    the rarity letter, the `Icon`, the damage mark, the ornament count and the
 *    pips) under the real `global.css` + `shell.css`;
 *  - the FIGURE is `drawSentinel` with `gearMarks.heroGear` on ONE neutral hero
 *    for every item: the Tiny Swords Pawn (the `mystic` art key), the one
 *    figure that paints nothing in its hands, so nothing on it is a class look;
 *  - the DOLL is `drawSentinel` with a `loadout` (the `loadout.ts` compositor)
 *    on the doll pack's one figure (`fieldwatch` — the only pack with gear
 *    strips and anchors).
 *
 * Items are dealt by `generateItem` with the kind and rarity forced and a seed
 * hashed from both, so the enchantments (and so the weapon glint) are the same
 * on every re-render. Canvases carry `data-out` (written as their exact
 * pixels), DOM tiles `data-shot` (element screenshots).
 */
import '../src/styles/global.css'
import '../src/styles/shell.css'
import { drawSentinel, setPresentationTime, type DrawSentinel } from '../src/game/render/renderer'
import { heroGear } from '../src/game/render/gearMarks'
import type { Loadout } from '../src/game/render/loadout'
import { onSpritesReady, preloadPack } from '../src/game/render/sprites'
import { setActiveTheme, THEMES, withStyle } from '../src/game/render/themes'
import { generateItem, itemNoun, RARITY } from '../src/game/data/items'
import { iconCell, itemIcon, type IconKey } from '../src/game/data/iconAtlas'
import { lookOf } from '../src/game/data/gear'
import { lookHue } from '../src/game/data/sentinels'
import { RNG } from '../src/game/core/rng'
import { damageMark, RARITY_INITIAL, rarityRank, rarityVar, railStyle } from '../src/ui/channels'
import type { Archetype, Equipment, Item, ItemRarity } from '../src/game/types'
import { CELL, DRAFTS, draftPixels, itemAssetRows, LOADOUTS, seedFor, slug, type LoadoutSpec } from '../scripts/item-assets-lib'

const out = document.getElementById('out')!

/** Neutral hues for the neutral hero's ground ring: the Common rarity hue, no class colour. */
const NEUTRAL = { color: '#8d8a80', accent: '#c3b291' }
/** The field's own grass (`themes.tinyswords.field.top`), behind every figure. */
const GRASS = '#5a9b43'
/** Every figure is drawn in a 112 × 112 logical box, feet at this point. */
const BOX = { w: 112, h: 112, ox: 52, oy: 96 }

const el = <K extends keyof HTMLElementTagNameMap>(t: K, cls?: string, text?: string) => {
  const n = document.createElement(t)
  if (cls) n.className = cls
  if (text !== undefined) n.textContent = text
  return n
}

function dealt(kind: string, rarity: ItemRarity): Item {
  return generateItem(new RNG(seedFor(kind, rarity)), { kind, rarity, allowCurse: false })
}

function equip(items: readonly Item[]): Equipment {
  const eq: Equipment = { mainHand: null, offHand: null, body: null }
  for (const i of items) {
    if (i.slot === 'body') eq.body = i
    else if (i.slot === 'offHand') eq.offHand = i
    else if (!eq.mainHand) eq.mainHand = i
    else eq.offHand = i
  }
  return eq
}

/** The doll's loadout: the lowercased noun the compositor looks gear up by. */
function dollOf(eq: Equipment): Loadout {
  const n = (i: Item | null) => (i ? (itemNoun(i) ?? '').toLowerCase() || null : null)
  return { mainHand: n(eq.mainHand), offHand: n(eq.offHand), body: n(eq.body) }
}

function sentinel(over: Partial<DrawSentinel>): DrawSentinel {
  return {
    id: 'item-assets',
    pos: { x: 0, y: 0 },
    archetype: 'mystic',
    ...NEUTRAL,
    range: 96,
    aimAngle: 0,
    fireFlash: 0,
    procFlash: 0,
    patienceStacks: 0,
    blocking: false,
    ...over,
  }
}

function figureCanvas(path: string, scale: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = el('canvas')
  c.width = BOX.w * scale
  c.height = BOX.h * scale
  c.style.width = `${BOX.w}px`
  c.dataset.out = path
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = GRASS
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.scale(scale, scale)
  ctx.translate(BOX.ox, BOX.oy)
  draw(ctx)
  return c
}

/** The neutral hero holding `eq`, on the battlefield (the real gear marks). */
const figure = (path: string, eq: Equipment, scale = 3) =>
  figureCanvas(path, scale, (ctx) => drawSentinel(ctx, sentinel({ archetype: 'mystic', gear: heroGear(eq) })))

/** The same kit on the paper doll (the real compositor, on the doll pack). */
const doll = (path: string, eq: Equipment, scale = 3) =>
  figureCanvas(path, scale, (ctx) => withStyle(THEMES.fieldwatch, () => drawSentinel(ctx, sentinel({ archetype: 'fighter', loadout: dollOf(eq) }))))

/** The kit as the game draws it TODAY: the look picked by the weapon (`gear.lookOf`), its hue. */
const today = (path: string, eq: Equipment, scale = 3) => {
  const look: Archetype = lookOf({ equipment: eq })
  return figureCanvas(path, scale, (ctx) => drawSentinel(ctx, sentinel({ archetype: look, ...lookHue(look), gear: heroGear(eq) })))
}

/** One pack tile, the markup `DetailBand`'s PackGrid renders, under the real CSS. */
function tile(item: Item): HTMLElement {
  const b = el('button', 'sh-tile')
  b.type = 'button'
  for (const [k, v] of Object.entries(railStyle(rarityVar(item.rarity)))) b.style.setProperty(k, v)
  b.append(el('span', 'sh-tile-rar', RARITY_INITIAL[item.rarity]))
  const glyph = el('span', 'sh-tile-glyph')
  const icon = (name: IconKey, cls: string) => {
    const s = el('span', cls)
    const { ix, iy } = iconCell(name)
    s.style.setProperty('--ix', String(ix))
    s.style.setProperty('--iy', String(iy))
    return s
  }
  glyph.append(icon(itemIcon(item), 'fw-i lg'))
  const mark = damageMark(item)
  if (mark) glyph.append(icon(mark, 'fw-i sh-tile-mark'))
  b.append(glyph)
  const frame = el('span', `sh-tile-frame r${rarityRank(item.rarity)}`)
  const pips = el('span', 'sh-tile-pips')
  for (let n = 0; n < rarityRank(item.rarity); n++) {
    frame.append(el('i', 'sh-tile-orn'))
    pips.append(el('span', 'sh-tile-pip'))
  }
  b.append(frame, pips)
  return b
}

function tileBox(path: string, item: Item): HTMLElement {
  const box = el('div', 'ia-box')
  box.dataset.shot = path
  box.append(tile(item))
  return box
}

/** A draft or an atlas cell, pixel for pixel at ×16 (256 px). */
function pixelCanvas(path: string, px: (string | null)[][]): HTMLCanvasElement {
  const k = 16
  const c = el('canvas')
  c.width = c.height = CELL * k
  c.style.width = '128px'
  c.dataset.out = path
  const ctx = c.getContext('2d')!
  px.forEach((row, y) =>
    row.forEach((hex, x) => {
      if (!hex) return
      ctx.fillStyle = hex
      ctx.fillRect(x * k, y * k, k, k)
    }),
  )
  return c
}

function atlasCellCanvas(path: string, key: IconKey, atlas: HTMLImageElement): HTMLCanvasElement {
  const k = 16
  const c = el('canvas')
  c.width = c.height = CELL * k
  c.style.width = '128px'
  c.dataset.out = path
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  const { ix, iy } = iconCell(key)
  ctx.drawImage(atlas, ix * CELL, iy * CELL, CELL, CELL, 0, 0, CELL * k, CELL * k)
  return c
}

function loadoutItems(spec: LoadoutSpec): Item[] {
  return [spec.mainHand, spec.offHand, spec.body].filter((x): x is NonNullable<typeof x> => !!x).map((x) => dealt(x.kind, x.rarity))
}

function build(atlas: HTMLImageElement): void {
  out.textContent = ''
  setPresentationTime(0)

  for (const row of itemAssetRows()) {
    const s = slug(row.kind)
    out.append(el('h2', undefined, `${row.kind} — ${row.handRule} · icon ${row.icon} · ${row.dollArt ? row.dollRole : 'no doll art'}`))
    const r = el('div', 'ia-row')
    r.append(el('b', undefined, 'icon / figure / doll'))
    for (const rarity of row.rarities) {
      const item = dealt(row.kind, rarity)
      const eq = equip([item])
      const col = el('div')
      col.title = RARITY[rarity].label
      col.append(tileBox(`items/${s}/icon-${rarity}.png`, item), figure(`items/${s}/figure-${rarity}.png`, eq), doll(`items/${s}/doll-${rarity}.png`, eq))
      r.append(col)
    }
    out.append(r)
  }

  out.append(el('h2', undefined, 'Full loadouts — neutral figure · paper doll · as the game draws it today · the kit'))
  LOADOUTS.forEach((spec, n) => {
    const items = loadoutItems(spec)
    const eq = equip(items)
    const p = `loadouts/${n + 1}-${spec.id}`
    const r = el('div', 'ia-row')
    r.append(el('b', undefined, spec.title))
    const kit = el('div', 'ia-kit')
    kit.dataset.shot = `${p}-kit.png`
    kit.append(...items.map(tile))
    r.append(figure(`${p}-figure.png`, eq, 4), doll(`${p}-doll.png`, eq, 4), today(`${p}-today.png`, eq, 4), kit)
    out.append(r)
  })

  out.append(el('h2', undefined, 'Needs a unique asset — PROPOSED drafts beside the cell each borrows today'))
  for (const d of DRAFTS) {
    const r = el('div', 'ia-row')
    r.append(el('b', undefined, `${d.kind} (borrows ${d.borrows})`))
    r.append(atlasCellCanvas(`drafts/${slug(d.kind)}-current.png`, d.borrows, atlas), pixelCanvas(`drafts/${slug(d.kind)}-proposed.png`, draftPixels(d)))
    out.append(r)
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

setActiveTheme('tinyswords')
preloadPack('tinyswords')
preloadPack('fieldwatch')
onSpritesReady(async () => {
  const atlas = new Image()
  atlas.src = 'assets/ui/fw-icons.png'
  await atlas.decode()
  // `gearMarks` loads the atlas on its first draw and draws nothing until it
  // has decoded; the composites settle once every strip has arrived. Draw once
  // to start both, then draw for real.
  build(atlas)
  await sleep(1200)
  build(atlas)
  await document.fonts.ready
  ;(window as unknown as { __itemAssetsReady: boolean }).__itemAssetsReady = true
})
