/**
 * The hero builder's review harness — renders the modular heroes
 * (`src/game/render/hero/`) beside the CC0 Tiny Swords originals, and builds
 * the designer's sheets (`docs/characters/*.png`) and phone cards
 * (`docs/characters/cards/`).
 *
 * Run:  npx vite --port 5231  →  http://localhost:5231/harness/heroes.html
 *       (`node scripts/hero-sheets.mjs` writes every sheet and card)
 *
 * Every hero pixel comes from `composeFrame` — the same pure compositor the
 * tests drive. The goblins, the shipped knight and the tower are the CC0
 * pack's own PNGs (the shipped strips in `public/assets/sprites/tinyswords/`;
 * the tower from the verified CC0 cache `harvest-cc0.ts` keeps in
 * `node_modules/.cache/cc0-pack`), blitted 1:1 so the densities compare
 * honestly. The ground is the real Green Line bake (`drawField`).
 */
import '../src/styles/global.css'
import { drawField } from '../src/game/render/renderer'
import { onSpritesReady, preloadSprites } from '../src/game/render/sprites'
import { setActiveTheme } from '../src/game/render/themes'
import { FIRST_MAP } from '../src/game/data/maps'
import {
  CELL, FEET, ITEMS, LAYERS, LIVERIES, RACES, RACE_DEFAULTS, RARITIES, STATUSES, TELLS, FRAME_COUNT, FRAME_MS,
  composeFrame, resolveLook, layerIndex,
  type AnimId, type HeroFrame, type HeroLook, type LayerId, type RaceId,
} from '../src/game/render/hero'
import { torsoOutline } from '../src/game/render/hero/parts'

const out = document.getElementById('out')!
const log = document.getElementById('log')!

// ── the peoples' base kits (tier-1 items of each) ─────────────────────────

export const PEOPLE_OF: Readonly<Record<RaceId, { title: string; company: string }>> = {
  human: { title: 'Humans', company: 'Peppercorn' },
  elf: { title: 'Elves', company: 'Rosethread' },
  dwarf: { title: 'Dwarves', company: 'Ironvein' },
  reptilian: { title: 'Reptilians', company: 'Butcherblock' },
  gnome: { title: 'Gnomes', company: 'Greenvial' },
}
const ITEM_PEOPLE: RaceId[] = ITEMS.map((_, i) => RACES[Math.floor(i / 20)])

export const BASE_KIT: Readonly<Record<RaceId, HeroLook>> = {
  human: { race: 'human', company: 'Peppercorn', gear: { main: 'Sword', off: 'Shield', body: 'Mail' } },
  elf: { race: 'elf', company: 'Rosethread', gear: { main: 'Bow', off: 'Quiver', body: 'Cloak' } },
  dwarf: { race: 'dwarf', company: 'Ironvein', gear: { main: 'Axe', off: 'Round Shield', body: 'Plate' } },
  reptilian: { race: 'reptilian', company: 'Butcherblock', gear: { main: 'Spear', body: 'Leather' } },
  gnome: { race: 'gnome', company: 'Greenvial', gear: { main: 'Wand', off: 'Flask', body: 'Robe' } },
}

// ── canvas helpers ─────────────────────────────────────────────────────────

const el = <K extends keyof HTMLElementTagNameMap>(t: K, cls?: string, text?: string) => {
  const n = document.createElement(t)
  if (cls) n.className = cls
  if (text !== undefined) n.textContent = text
  return n
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = el('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.imageSmoothingEnabled = false
  return [c, g]
}

const frameCache = new Map<HeroFrame, HTMLCanvasElement>()
/** A frame as a 128 × 128 canvas. */
function frameCanvas(f: HeroFrame): HTMLCanvasElement {
  const hit = frameCache.get(f)
  if (hit) return hit
  const [c, g] = canvas(CELL, CELL)
  g.putImageData(new ImageData(new Uint8ClampedArray(f.rgba), CELL, CELL), 0, 0)
  frameCache.set(f, c)
  return c
}

const F = (look: HeroLook, anim: AnimId = 'idle', frame = 0) => composeFrame(look, anim, frame)

/** Draw a frame with its feet at (x, y), scaled k. */
function hero(g: CanvasRenderingContext2D, f: HeroFrame, x: number, y: number, k = 1): void {
  g.drawImage(frameCanvas(f), Math.round(x - 64 * k), Math.round(y - FEET * k), CELL * k, CELL * k)
}

/** The union box of frames' opaque pixels (cell px). */
function boxOf(frames: HeroFrame[], pad = 2): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = CELL, y0 = CELL, x1 = 0, y1 = 0
  for (const f of frames)
    for (let y = 0; y < CELL; y++)
      for (let x = 0; x < CELL; x++)
        if (f.rgba[(y * CELL + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  return { x0: Math.max(0, x0 - pad), y0: Math.max(0, y0 - pad), x1: Math.min(CELL - 1, x1 + pad), y1: Math.min(CELL - 1, y1 + pad) }
}

/** A frame cropped to `box`, scaled k, drawn with its box's top-left at (x, y). */
function crop(g: CanvasRenderingContext2D, f: HeroFrame, box: { x0: number; y0: number; x1: number; y1: number }, x: number, y: number, k: number): void {
  const w = box.x1 - box.x0 + 1, h = box.y1 - box.y0 + 1
  g.drawImage(frameCanvas(f), box.x0, box.y0, w, h, Math.round(x), Math.round(y), w * k, h * k)
}

function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, size = 18, col = '#efe6d6', weight = 400, align: CanvasTextAlign = 'left', font = 'system-ui, sans-serif'): void {
  g.font = `${weight} ${size}px ${font}`
  g.fillStyle = col
  g.textAlign = align
  g.textBaseline = 'alphabetic'
  g.fillText(s, x, y)
}

function wrap(g: CanvasRenderingContext2D, s: string, x: number, y: number, w: number, size: number, col: string, lh = 1.3): number {
  g.font = `400 ${size}px system-ui, sans-serif`
  g.fillStyle = col
  g.textAlign = 'left'
  const words = s.split(' ')
  let line = ''
  for (const wd of words) {
    const t = line ? `${line} ${wd}` : wd
    if (g.measureText(t).width > w && line) { g.fillText(line, x, y); y += size * lh; line = wd } else line = t
  }
  if (line) g.fillText(line, x, y)
  return y + size * lh
}

const PANEL = '#1d1713'
const PANEL2 = '#2a221c'
const GOLD = '#e3b64f'
const DIM = '#b3a48c'

// ── the CC0 references ─────────────────────────────────────────────────────

function img(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => res(null)
    i.src = url
  })
}
interface Refs {
  torch: HTMLImageElement
  tnt: HTMLImageElement
  knight: HTMLImageElement
  tower: HTMLImageElement | null
}
let REFS: Refs

/** A CC0 strip's frame `i` (n frames), its bottom at y (the shadow's foot), centred on x, scaled k. */
function refFrame(g: CanvasRenderingContext2D, im: HTMLImageElement, n: number, i: number, x: number, y: number, k = 1): void {
  const fw = im.width / n
  g.drawImage(im, fw * i, 0, fw, im.height, Math.round(x - (fw / 2) * k), Math.round(y - im.height * k), fw * k, im.height * k)
}

// ── the battlefield strip ──────────────────────────────────────────────────

/** Open grass on the Green Line (the peoples harness's item post). */
function postOf(): { x: number; y: number } {
  const t = FIRST_MAP.tiles?.find((x) => x.col === 14 && x.row === 6)
  return t ? { ...t.pos } : { x: 600, y: 400 }
}

/** A canvas of real ground `w × h` logical px around `at`, scaled k, and its ground line. */
function ground(w: number, h: number, k: number, at = postOf(), dy = 0): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const [c, g] = canvas(w * k, h * k)
  g.save()
  g.scale(k, k)
  const x0 = at.x - w / 2, y0 = at.y - h * 0.7 + dy
  g.translate(-x0, -y0)
  drawField(g, FIRST_MAP, { x0, y0, w, h })
  g.restore()
  return [c, g]
}

// ── outputs ────────────────────────────────────────────────────────────────

interface SheetOut { file: string; canvas: HTMLCanvasElement }
interface CardOut { id: string; group: 'Races' | 'Parts' | 'Swaps' | 'States' | 'Animation'; title: string; caption: string; file: string; canvas: HTMLCanvasElement; frames?: number; delays?: number[] }
const SHEETS: SheetOut[] = []
const CARDS: CardOut[] = []

function sheet(file: string, c: HTMLCanvasElement, title: string): void {
  SHEETS.push({ file, canvas: c })
  out.append(el('h2', undefined, `${file} — ${title}`), c)
}

const CARD = 600
/** A phone card: dark panel, the title on top, the caption under the art, the art in between. */
function card(id: string, group: CardOut['group'], title: string, caption: string, draw: (g: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }) => void, w = CARD, h = CARD): HTMLCanvasElement {
  const [c, g] = canvas(w, h)
  paintCard(g, w, h, title, caption, group, draw)
  CARDS.push({ id, group, title, caption, file: `${group.toLowerCase()}-${id}.png`, canvas: c })
  return c
}

function paintCard(g: CanvasRenderingContext2D, w: number, h: number, title: string, caption: string, group: string, draw: (g: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }) => void): void {
  g.fillStyle = PANEL
  g.fillRect(0, 0, w, h)
  g.fillStyle = PANEL2
  g.fillRect(14, 66, w - 28, h - 66 - 92)
  text(g, group.toUpperCase(), 18, 26, 14, GOLD, 700)
  text(g, title, 18, 54, 26, '#f2e8d8', 700, 'left', 'Georgia, serif')
  g.save()
  g.beginPath()
  g.rect(14, 66, w - 28, h - 66 - 92)
  g.clip()
  draw(g, { x: 14, y: 66, w: w - 28, h: h - 66 - 92 })
  g.restore()
  wrap(g, caption, 18, h - 62, w - 36, 18, DIM)
}

/** An animated card: every frame painted as its own full card, stacked (the script makes a GIF). */
function animCard(id: string, title: string, caption: string, n: number, delays: number[], draw: (g: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }, i: number) => void): void {
  const [c, g] = canvas(CARD, CARD * n)
  for (let i = 0; i < n; i++) {
    g.save()
    g.translate(0, i * CARD)
    paintCard(g, CARD, CARD, title, caption, 'Animation', (gg, b) => draw(gg, b, i))
    g.restore()
  }
  CARDS.push({ id, group: 'Animation', title, caption, file: `animation-${id}.gif`, canvas: c, frames: n, delays })
}

/** Fill a card's art box with real ground. */
function groundIn(g: CanvasRenderingContext2D, b: { x: number; y: number; w: number; h: number }, k: number, dy = 0): void {
  const [gc] = ground(Math.ceil(b.w / k), Math.ceil(b.h / k), k, postOf(), dy)
  g.drawImage(gc, b.x, b.y)
}

// ── the review checks ──────────────────────────────────────────────────────

interface Report {
  logicalPerArtPx: number
  silhouette: { a: RaceId; b: RaceId; iou: number }[]
  heights: Record<string, number>
  widths: Record<string, number>
}

function maskOf(f: HeroFrame): Uint8Array {
  const m = new Uint8Array(CELL * CELL)
  for (let i = 0; i < CELL * CELL; i++) m[i] = f.rgba[i * 4 + 3] === 255 ? 1 : 0
  return m
}
function iou(a: Uint8Array, b: Uint8Array): number {
  let i = 0, u = 0
  for (let k = 0; k < a.length; k++) { if (a[k] && b[k]) i++; if (a[k] || b[k]) u++ }
  return u ? i / u : 1
}

// ── 1 · the lineup ─────────────────────────────────────────────────────────

function lineup(): void {
  const W = 1344
  // 1×: a strip of real ground, the tower, two goblins, the five peoples and the shipped knight
  const k1 = 1, gw1 = W, gh1 = 230
  const [c1, g1] = ground(gw1 / k1, gh1 / k1, k1, postOf(), -20)
  const gy = 190
  if (REFS.tower) g1.drawImage(REFS.tower, 40, gy - REFS.tower.height + 10)
  refFrame(g1, REFS.torch, 6, 0, 260, gy + 8)
  let x = 380
  for (const r of RACES) { hero(g1, F(BASE_KIT[r]), x, gy, 1); x += 110 }
  refFrame(g1, REFS.tnt, 6, 0, x + 10, gy + 8)
  refFrame(g1, REFS.knight, 6, 0, x + 130, gy + 6)
  // 3×: the same, closer, without the tower
  const k3 = 3
  const [c3, g3] = ground(W / k3, 420 / k3, k3, postOf(), -10)
  const gy3 = 112
  refFrame(g3, REFS.torch, 6, 0, 46, gy3 + 3, k3)
  let x3 = 112
  for (const r of RACES) { hero(g3, F(BASE_KIT[r]), x3 * k3, gy3 * k3, k3); x3 += 46 }
  refFrame(g3, REFS.tnt, 6, 0, 400 * k3, (gy3 + 3) * k3, k3)
  // the sheet
  const [c, g] = canvas(W, 90 + gh1 + 50 + 420 + 70)
  g.fillStyle = PANEL
  g.fillRect(0, 0, c.width, c.height)
  text(g, 'Five peoples in their base kit, beside the pack', 20, 44, 32, '#f2e8d8', 700, 'left', 'Georgia, serif')
  text(g, 'Our own heroes (the hero builder) with the CC0 Tiny Swords tower, goblins and the shipped knight, on the real Green Line ground.', 20, 74, 18, DIM)
  text(g, '1× — game density (one art px per field px)', 20, 112, 16, GOLD, 700)
  g.drawImage(c1, 0, 120)
  const lab = ['CC0 tower', 'CC0 torch goblin', ...RACES.map((r) => `${PEOPLE_OF[r].title}`), 'CC0 TNT goblin', 'shipped knight']
  const lx = [100, 260, 380, 490, 600, 710, 820, 940, 1060]
  lab.forEach((s, i) => text(g, s, lx[i], 120 + gh1 + 22, 14, DIM, 400, 'center'))
  text(g, '3×', 20, 120 + gh1 + 58, 16, GOLD, 700)
  g.drawImage(c3, 0, 120 + gh1 + 66)
  sheet('docs/characters/lineup.png', c, 'the five peoples beside the pack')

  // cards: each race base beside a CC0 goblin
  for (const r of RACES) {
    const d = RACE_DEFAULTS[r]
    card(`race-${r}`, 'Races', `${PEOPLE_OF[r].title} — the base`, `Judge the silhouette and face beside the CC0 goblin at the same density (4×, and 1× in the corner). Default head "${d.heads[0]}", hair "${d.hairs[0]}".`, (gg, b) => {
      groundIn(gg, b, 4, -14)
      const fy = b.y + b.h - 50
      refFrame(gg, REFS.torch, 6, 0, b.x + 150, fy + 12, 4)
      hero(gg, F({ race: r }), b.x + 380, fy, 4)
      gg.fillStyle = 'rgba(0,0,0,0.35)'
      gg.fillRect(b.x + b.w - 150, b.y + 8, 142, 110)
      refFrame(gg, REFS.torch, 6, 0, b.x + b.w - 115, b.y + 110, 1)
      hero(gg, F({ race: r }), b.x + b.w - 50, b.y + 106, 1)
    })
  }
}

// ── 2 · the parts map ──────────────────────────────────────────────────────

const LAYER_LABEL: Readonly<Record<LayerId, string>> = {
  back: '1 back', offArm: '2 off-hand arm', legs: '3 legs & boots', body: '4 body (race)', armour: '5 body armour', head: '6 head (race face)',
  hair: '7 hair / headgear', mainArm: '8 main-hand arm', mainItem: '9 main-hand item', offItem: '10 off-hand item', fx: '11 FX tells',
}

/** One layer of a frame, alone (its pieces, inked as in the composite). */
function layerAlone(f: HeroFrame, layer: LayerId): HTMLCanvasElement {
  const [c, g] = canvas(CELL, CELL)
  const id = g.createImageData(CELL, CELL)
  const li = layerIndex(layer)
  for (let i = 0; i < CELL * CELL; i++) {
    if (f.owner[i] !== li) continue
    for (let k = 0; k < 4; k++) id.data[i * 4 + k] = f.rgba[i * 4 + k]
  }
  g.putImageData(id, 0, 0)
  return c
}

/** The pieces of a layer (before anything covers them), for the exploded view. */
function layerPieces(f: HeroFrame, layer: LayerId): HTMLCanvasElement {
  // re-run the composite of just this layer's pieces
  const [c, g] = canvas(CELL, CELL)
  const id = g.createImageData(CELL, CELL)
  const pcs = f.layers[layer]
  const ink = [0x16, 0x1c, 0x2e]
  for (const pc of pcs) {
    const buf = pc.buf
    const sel = (i: number) => buf.ramp[i] !== 0
    if (pc.ring) {
      const r = pc.ring
      for (let y = 0; y < CELL; y++)
        for (let x = 0; x < CELL; x++) {
          const i = y * CELL + x
          if (!sel(i) || buf.flag[i] & 1) continue
          for (let dy = -r; dy <= r; dy++)
            for (let dx = -r; dx <= r; dx++) {
              if (dx * dx + dy * dy > (r === 2 ? 5 : 1)) continue
              const xx = x + dx, yy = y + dy
              if (xx < 0 || yy < 0 || xx >= CELL || yy >= CELL) continue
              const j = yy * CELL + xx
              if (sel(j)) continue
              id.data.set([...ink, 255], j * 4)
            }
        }
    }
    for (let i = 0; i < CELL * CELL; i++) {
      if (!sel(i)) continue
      // the composite's own colour where this layer won; else the layer's ink lookup
      const won = f.owner[i] === layerIndex(layer)
      if (won) id.data.set([f.rgba[i * 4], f.rgba[i * 4 + 1], f.rgba[i * 4 + 2], 255], i * 4)
      else id.data.set(buf.tone[i] === 0 ? [...ink, 255] : hexRGB(colourAt(f, layer, pc, i)), i * 4)
    }
  }
  g.putImageData(id, 0, 0)
  return c
}

import { colourOf } from '../src/game/render/hero/raster'
function colourAt(_f: HeroFrame, _l: LayerId, pc: { buf: Parameters<typeof colourOf>[0] }, i: number): string {
  return colourOf(pc.buf, i)
}
function hexRGB(h: string): [number, number, number, number] {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]
}

function partsMap(): void {
  const W = 1344
  const look: HeroLook = { race: 'human', company: 'Peppercorn', gear: { main: 'Sword', off: 'Kite Shield', body: 'Mail' }, state: { level: 5, skills: ['Banner Bearer'], rarity: { main: 'rare' } } }
  const f = F(look)
  const P = f.pose
  const [c, g] = canvas(W, 1500)
  g.fillStyle = PANEL
  g.fillRect(0, 0, W, c.height)
  text(g, 'The rig and the parts, exploded in draw order', 20, 44, 32, '#f2e8d8', 700, 'left', 'Georgia, serif')
  text(g, 'One skeleton for every people: anchors per frame, parts drawn by slot from back to front, each piece ringed in the pack’s ink.', 20, 74, 18, DIM)
  // the rig at 4× with its anchors
  const k = 4
  const ox = 30, oy = 100
  g.fillStyle = PANEL2
  g.fillRect(ox - 10, oy - 10, CELL * k + 20, CELL * k + 20)
  g.drawImage(frameCanvas(f), ox, oy, CELL * k, CELL * k)
  const anchors: [string, { x: number; y: number }, string][] = [
    ['head', P.head, '#f2e8d8'], ['torso', P.torso, '#f2e8d8'], ['hips', P.hips, '#f2e8d8'], ['back', P.back, '#8fe2b9'],
    ['main hand', P.mainHand, '#ffed44'], ['off hand', P.offHand, '#ffed44'], ['foot (back)', P.footBack, '#f69e7d'], ['foot (front)', P.footFront, '#f69e7d'],
  ]
  for (const [name, a, col] of anchors) {
    const x = ox + a.x * k, y = oy + a.y * k
    g.fillStyle = col
    g.strokeStyle = '#120e0b'
    g.lineWidth = 3
    g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); g.stroke()
    text(g, name, x + 10, y - 8, 15, col, 700)
  }
  // the torso box the armour is cut to
  g.strokeStyle = 'rgba(143,226,185,0.8)'
  g.lineWidth = 2
  g.beginPath()
  torsoOutline(P).forEach(([x, y], i) => (i ? g.lineTo(ox + x * k, oy + y * k) : g.moveTo(ox + x * k, oy + y * k)))
  g.closePath(); g.stroke()
  // the hand angles
  for (const h of [P.mainHand, P.offHand]) {
    const r = (h.angle * Math.PI) / 180
    g.strokeStyle = '#ffed44'; g.lineWidth = 2
    g.beginPath(); g.moveTo(ox + h.x * k, oy + h.y * k); g.lineTo(ox + (h.x + Math.sin(r) * 14) * k, oy + (h.y - Math.cos(r) * 14) * k); g.stroke()
  }
  // the spec table beside it
  const tx = ox + CELL * k + 40
  let ty = 120
  text(g, 'Anchors (per frame, per people)', tx, ty, 20, GOLD, 700); ty += 28
  for (const s of [
    'head · torso · hips · back · main hand · off hand · two feet,',
    'plus the shoulders the arms hang from. Each has x, y, an angle',
    '(a hand: the held item’s direction) and a facing. The peoples',
    'differ by body numbers only (RACE_BODY, inside RACE_LIMITS),',
    'so every part reads the anchors and fits every people.',
  ]) { text(g, s, tx, ty, 16, '#efe6d6'); ty += 22 }
  ty += 16
  text(g, 'Draw order (back → front)', tx, ty, 20, GOLD, 700); ty += 28
  const ROWS: [LayerId, string, string][] = [
    ['back', 'back', 'cape (level tier / cloak) · quiver · javelins · Banner Bearer'],
    ['offArm', 'off hand', 'sleeve + fist (closes over a held grip)'],
    ['legs', 'hips, feet', 'legs + boots (slowed: frost)'],
    ['body', 'torso', 'the people’s torso; a reptilian’s tail'],
    ['armour', 'torso box', 'mail · padded · leather · plate · robe · apron · cloak…'],
    ['head', 'head', 'the race face: ears, beard, snout, nose, eyes'],
    ['hair', 'head', 'hair variant, or the hood a body piece brings'],
    ['mainArm', 'main hand', 'sleeve + fist (re-stamped over the grip)'],
    ['mainItem', 'main hand', 'the weapon in the hand’s frame; rarity trim'],
    ['offItem', 'off hand', 'shield · orb · tome · flask · off dagger'],
    ['fx', 'any', 'smear, spark, tells, status effects'],
  ]
  for (const [l, a, what] of ROWS) {
    text(g, LAYER_LABEL[l], tx, ty, 16, '#f2e8d8', 700)
    text(g, a, tx + 200, ty, 15, '#8fe2b9')
    text(g, what, tx + 300, ty, 15, DIM)
    ty += 24
  }
  // the exploded layers
  const ey = oy + CELL * k + 50
  text(g, 'The same frame, layer by layer (3×) — each layer’s pieces as they are drawn, before anything in front covers them', 20, ey, 18, GOLD, 700)
  const box = boxOf([f], 4)
  const bw = (box.x1 - box.x0 + 1) * 3, bh = (box.y1 - box.y0 + 1) * 3
  const per = Math.floor((W - 20) / (bw + 12))
  LAYERS.forEach((l, i) => {
    const cx = 20 + (i % per) * (bw + 12)
    const cy = ey + 20 + Math.floor(i / per) * (bh + 40)
    g.fillStyle = PANEL2
    g.fillRect(cx, cy, bw, bh)
    const pcs = layerPieces(f, l)
    g.drawImage(pcs, box.x0, box.y0, box.x1 - box.x0 + 1, box.y1 - box.y0 + 1, cx, cy, bw, bh)
    text(g, LAYER_LABEL[l], cx + 4, cy + bh + 20, 15, '#efe6d6', 700)
  })
  sheet('docs/characters/parts-map.png', c, 'the rig, anchors and layers')

  // cards: each layer alone
  card('rig-anchors', 'Parts', 'The rig: anchors', 'Every part hangs from these anchors; the peoples differ only in the body numbers between them. Judge whether each anchor sits where a part would attach.', (gg, b) => {
    const kk = 3
    gg.drawImage(c, ox - 10, oy - 10, CELL * k + 20, CELL * k + 20, b.x + (b.w - (CELL * kk + 15)) / 2, b.y + 4, CELL * kk + 15, CELL * kk + 15)
  })
  LAYERS.forEach((l) => {
    card(`layer-${l}`, 'Parts', `Layer ${LAYER_LABEL[l]}`, `What this layer draws on its own (4×), in its own ink ring; the full figure is in the corner. Judge that it is complete — no holes where other layers sit.`, (gg, b) => {
      const pcs = layerPieces(f, l)
      const kk = 4
      gg.drawImage(pcs, box.x0, box.y0, box.x1 - box.x0 + 1, box.y1 - box.y0 + 1, b.x + (b.w - (box.x1 - box.x0 + 1) * kk) / 2, b.y + 20, (box.x1 - box.x0 + 1) * kk, (box.y1 - box.y0 + 1) * kk)
      gg.drawImage(frameCanvas(f), box.x0, box.y0, box.x1 - box.x0 + 1, box.y1 - box.y0 + 1, b.x + b.w - (box.x1 - box.x0 + 1) - 10, b.y + 10, box.x1 - box.x0 + 1, box.y1 - box.y0 + 1)
    })
  })
}

// ── 3 · swaps ──────────────────────────────────────────────────────────────

const SWAP_KITS: [string, HeroLook['gear']][] = [
  ['Bare', {}],
  ['Sword · Shield · Mail', { main: 'Sword', off: 'Shield', body: 'Mail' }],
  ['Greatsword · Plate', { main: 'Greatsword', body: 'Plate' }],
  ['Bow · Quiver · Cloak', { main: 'Bow', off: 'Quiver', body: 'Cloak' }],
  ['Axe · Round Shield · Chainshirt', { main: 'Axe', off: 'Round Shield', body: 'Chainshirt' }],
  ['Spear · Leather', { main: 'Spear', body: 'Leather' }],
  ['Staff · Robe', { main: 'Staff', body: 'Robe' }],
  ['Twin Knives · Silk Wrap', { main: 'Twin Knives', body: 'Silk Wrap' }],
  ['Banner Pole · Brigandine', { main: 'Banner Pole', body: 'Brigandine' }],
  ['Cleaver · Buckler · Apron', { main: 'Cleaver', off: 'Buckler', body: 'Smokehouse Apron' }],
  ['Maul · Forge Apron', { main: 'Maul', body: 'Forge Apron' }],
  ['Wand · Tome · Hood', { main: 'Wand', off: 'Tome', body: 'Thornweave Hood' }],
]
const ONE_KIT: HeroLook['gear'] = { main: 'Arming Sword', off: 'Kite Shield', body: 'Plate' }

function swaps(): void {
  const W = 1344
  const k = 3
  const box = { x0: 20, y0: 30, x1: 112, y1: 118 }
  const cw = (box.x1 - box.x0 + 1) * k, ch = (box.y1 - box.y0 + 1) * k
  const per = Math.floor((W - 20) / (cw + 10))
  const rows1 = Math.ceil(SWAP_KITS.length / per)
  const [c, g] = canvas(W, 120 + rows1 * (ch + 40) + 70 + (ch + 40) + 70 + (ch + 40) + 20)
  g.fillStyle = PANEL
  g.fillRect(0, 0, W, c.height)
  text(g, 'Swaps: gear maps to parts', 20, 44, 32, '#f2e8d8', 700, 'left', 'Georgia, serif')
  text(g, 'One human across kits from every people (top); one kit across the five peoples (middle); one hire in each company’s colours (bottom). 3×.', 20, 74, 18, DIM)
  let y = 100
  const cell = (i: number, f: HeroFrame, label: string, yy: number) => {
    const x = 20 + (i % per) * (cw + 10)
    const yc = yy + Math.floor(i / per) * (ch + 40)
    g.fillStyle = PANEL2
    g.fillRect(x, yc, cw, ch)
    crop(g, f, box, x, yc, k)
    text(g, label, x + 4, yc + ch + 20, 14, '#efe6d6', 700)
  }
  SWAP_KITS.forEach(([label, gear], i) => cell(i, F({ race: 'human', company: 'Peppercorn', gear }), label, y))
  y += rows1 * (ch + 40) + 30
  text(g, `One kit — ${ONE_KIT.main} · ${ONE_KIT.off} · ${ONE_KIT.body} — on every people (each in its own company’s colours)`, 20, y, 18, GOLD, 700)
  y += 16
  RACES.forEach((r, i) => cell(i, F({ race: r, company: PEOPLE_OF[r].company, gear: ONE_KIT }), PEOPLE_OF[r].title, y))
  y += ch + 70
  text(g, 'One hire (a dwarf, Axe · Round Shield · Chainshirt) in each company’s livery', 20, y, 18, GOLD, 700)
  y += 16
  const cos = Object.keys(LIVERIES)
  cos.forEach((co, i) => { if (i < per) cell(i, F({ race: 'dwarf', company: co, gear: { main: 'Axe', off: 'Round Shield', body: 'Chainshirt' } }), co, y) })
  sheet('docs/characters/swaps.png', c, 'kits and peoples')

  // cards
  SWAP_KITS.forEach(([label, gear], i) => card(`kit-${i}`, 'Swaps', label, 'One human (Peppercorn) in this kit, 4×; bare in the corner. Judge that every piece is held or worn, not pasted on.', (gg, b) => {
    const f = F({ race: 'human', company: 'Peppercorn', gear })
    groundIn(gg, b, 4, -10)
    hero(gg, f, b.x + b.w / 2, b.y + b.h - 40, 4)
    hero(gg, F({ race: 'human', company: 'Peppercorn' }), b.x + b.w - 50, b.y + 110, 1)
  }))
  RACES.forEach((r) => card(`onekit-${r}`, 'Swaps', `${PEOPLE_OF[r].title} in the same kit`, `${ONE_KIT.main} · ${ONE_KIT.off} · ${ONE_KIT.body}, made once, worn by a ${r}. Judge the fit to this body, 4× (the human in the corner for comparison).`, (gg, b) => {
    groundIn(gg, b, 4, -10)
    hero(gg, F({ race: r, company: PEOPLE_OF[r].company, gear: ONE_KIT }), b.x + b.w / 2, b.y + b.h - 40, 4)
    hero(gg, F({ race: 'human', company: 'Peppercorn', gear: ONE_KIT }), b.x + b.w - 50, b.y + 110, 1)
  }))
  cos.forEach((co) => card(`livery-${co.replace(/\s+/g, '-').toLowerCase()}`, 'Swaps', `${co} livery`, `The same dwarf hire with the company’s cloth and trim swapped in; nothing else changes. Judge it reads as this company at 1× (corner).`, (gg, b) => {
    groundIn(gg, b, 4, -10)
    const f = F({ race: 'dwarf', company: co, gear: { main: 'Axe', off: 'Round Shield', body: 'Chainshirt' } })
    hero(gg, f, b.x + b.w / 2, b.y + b.h - 40, 4)
    hero(gg, f, b.x + b.w - 50, b.y + 110, 1)
  }))
}

// ── 4 · states ─────────────────────────────────────────────────────────────

const STATE_BASE: HeroLook = { race: 'human', company: 'Peppercorn', gear: { main: 'Sword', off: 'Kite Shield', body: 'Mail' } }
type StateRow = { id: string; label: string; look: HeroLook; anim?: AnimId; frame?: number; what: string }
function stateRows(): { title: string; rows: StateRow[] }[] {
  const w = (st: HeroLook['state'], over: Partial<HeroLook> = {}): HeroLook => ({ ...STATE_BASE, ...over, state: st })
  return [
    { title: 'Rarity — the trim and the gem on the item (common → mythic)', rows: RARITIES.map((r) => ({ id: `rarity-${r}`, label: r, look: w({ rarity: { main: r, off: r } }), what: `the ${r} trim on the sword and the shield` })) },
    { title: 'Level tier — the cape grows with the level', rows: [1, 3, 5, 8].map((l) => ({ id: `level-${l}`, label: `level ${l}`, look: w({ level: l }), what: `the cape at level ${l}` })) },
    { title: 'Skill tells', rows: TELLS.map((t) => ({ id: `tell-${t}`, label: t, look: w({ skills: [t] }, t === 'spark' || t === 'bloom' ? { race: 'gnome', company: 'Greenvial', gear: { main: 'Staff', body: 'Robe' } } : {}), frame: 2, what: `the ${t} tell` })) },
    { title: 'Status effects', rows: [...STATUSES.map((s) => ({ id: `status-${s}`, label: s, look: w({ status: [s] }), frame: 2, what: `the ${s} status` })), { id: 'status-wounded', label: 'wounded', look: w({ wounded: true }), frame: 2, what: 'a wound' }] },
  ]
}

function states(): void {
  const W = 1344
  const k = 3
  const box = { x0: 14, y0: 18, x1: 118, y1: 120 }
  const cw = (box.x1 - box.x0 + 1) * k, ch = (box.y1 - box.y0 + 1) * k
  const per = Math.floor((W - 20) / (cw + 10))
  const groups = stateRows()
  const rowsN = groups.reduce((n, gp) => n + Math.ceil(gp.rows.length / per), 0)
  const [c, g] = canvas(W, 110 + rowsN * (ch + 36) + groups.length * 40 + 20)
  g.fillStyle = PANEL
  g.fillRect(0, 0, W, c.height)
  text(g, 'States: one hero, edited by status', 20, 44, 32, '#f2e8d8', 700, 'left', 'Georgia, serif')
  text(g, 'A human (Sword · Kite Shield · Mail). Each state edits only its own layer (STATE_LAYERS, held by the tests). 3×.', 20, 74, 18, DIM)
  let y = 110
  for (const gp of groups) {
    text(g, gp.title, 20, y + 4, 18, GOLD, 700)
    y += 16
    gp.rows.forEach((row, i) => {
      const x = 20 + (i % per) * (cw + 10)
      const yc = y + Math.floor(i / per) * (ch + 36)
      g.fillStyle = PANEL2
      g.fillRect(x, yc, cw, ch)
      crop(g, F(row.look, row.anim ?? 'idle', row.frame ?? 0), box, x, yc, k)
      text(g, row.label, x + 4, yc + ch + 20, 15, '#efe6d6', 700)
    })
    y += Math.ceil(gp.rows.length / per) * (ch + 36) + 24
  }
  sheet('docs/characters/states.png', c, 'rarity, level, tells, status')

  for (const gp of groups)
    for (const row of gp.rows)
      card(row.id, 'States', `${row.label[0].toUpperCase()}${row.label.slice(1)}`, `Before (left, 2×) and after (4×): ${row.what}. Judge that only that changes, and that it reads at 1× (corner).`, (gg, b) => {
        groundIn(gg, b, 4, -10)
        const base = F(row.look.race === STATE_BASE.race ? { ...STATE_BASE } : { ...row.look, state: {} }, row.anim ?? 'idle', row.frame ?? 0)
        const after = F(row.look, row.anim ?? 'idle', row.frame ?? 0)
        hero(gg, base, b.x + 90, b.y + b.h - 40, 2)
        hero(gg, after, b.x + b.w / 2 + 70, b.y + b.h - 40, 4)
        hero(gg, after, b.x + b.w - 50, b.y + 110, 1)
      })
}

// ── 5 · animation ──────────────────────────────────────────────────────────

const ANIM_SHOWN: AnimId[] = ['idle', 'walk', 'attack', 'hit', 'cheer']

function animation(): void {
  const W = 1344
  const k = 2
  const rowsPerRace = ANIM_SHOWN.length
  const box = { x0: 6, y0: 14, x1: 124, y1: 120 }
  const cw = (box.x1 - box.x0 + 1) * k, ch = (box.y1 - box.y0 + 1) * k
  const maxF = Math.max(...ANIM_SHOWN.map((a) => FRAME_COUNT[a]))
  const scale = Math.min(1, (W - 140) / (maxF * (cw + 4)))
  const cwS = Math.floor(cw * scale), chS = Math.floor(ch * scale)
  const [c, g] = canvas(W, 110 + RACES.length * (rowsPerRace * (chS + 8) + 50))
  g.fillStyle = PANEL
  g.fillRect(0, 0, W, c.height)
  text(g, 'Animation: idle, walk, attack, hit and cheer for every people', 20, 44, 32, '#f2e8d8', 700, 'left', 'Georgia, serif')
  text(g, 'Base kits. Idle 6 frames at 6 fps (the game’s loop), walk 6 at 10 fps, attack 6 timed slow wind-up, fast strike. One frame per column.', 20, 74, 18, DIM)
  let y = 100
  for (const r of RACES) {
    text(g, PEOPLE_OF[r].title, 20, y + 20, 20, GOLD, 700)
    y += 30
    for (const a of ANIM_SHOWN) {
      text(g, a, 20, y + chS / 2, 15, '#efe6d6', 700)
      for (let i = 0; i < FRAME_COUNT[a]; i++) {
        const x = 110 + i * (cwS + 4)
        g.fillStyle = PANEL2
        g.fillRect(x, y, cwS, chS)
        const f = F(BASE_KIT[r], a, i)
        g.drawImage(frameCanvas(f), box.x0, box.y0, box.x1 - box.x0 + 1, box.y1 - box.y0 + 1, x, y, cwS, chS)
      }
      y += chS + 8
    }
    y += 20
  }
  sheet('docs/characters/animation.png', c, 'frames per people')

  for (const r of RACES)
    for (const a of ['idle', 'walk', 'attack'] as AnimId[]) {
      const n = FRAME_COUNT[a]
      animCard(`${r}-${a}`, `${PEOPLE_OF[r].title} — ${a}`, `${n} frames at the game’s timing, 4×, with the 1× figure in the corner. Judge the motion reads and the held item stays in the hand.`, n, [...FRAME_MS[a]], (gg, b, i) => {
        groundIn(gg, b, 4, -10)
        const f = F(BASE_KIT[r], a, i)
        hero(gg, f, b.x + b.w / 2 - 20, b.y + b.h - 40, 4)
        hero(gg, f, b.x + b.w - 50, b.y + 110, 1)
      })
    }
}

// ── 6 · head and hair variants, every part, grips, the off-hand × body grid ─

function variants(): void {
  for (const r of RACES) {
    const d = RACE_DEFAULTS[r]
    for (const hd of d.heads) card(`head-${r}-${hd}`, 'Races', `${PEOPLE_OF[r].title} — head “${hd}”`, `The race face variant at 6×; the whole figure at 1× in the corner. Judge it reads as ${r} and the features don’t merge.`, (gg, b) => headCard(gg, b, { race: r, head: hd }))
    for (const hr of d.hairs) card(`hair-${r}-${hr}`, 'Races', `${PEOPLE_OF[r].title} — hair “${hr}”`, `The hair / headgear variant at 6×; 1× in the corner. Judge the ear and face stay clear of it.`, (gg, b) => headCard(gg, b, { race: r, hair: hr }))
  }
  // the greyscale silhouette test
  card('silhouettes', 'Races', 'Silhouettes: the five peoples', 'Each people filled flat (top, 3×) and in greyscale (bottom). Judge that they read apart by shape alone.', (gg, b) => {
    const k = 3
    RACES.forEach((r, i) => {
      const f = F({ race: r })
      const x = b.x + 60 + i * 104
      const [sc, sg] = canvas(CELL, CELL)
      const id = sg.createImageData(CELL, CELL)
      for (let p = 0; p < CELL * CELL; p++) if (f.rgba[p * 4 + 3] === 255) id.data.set([22, 28, 46, 255], p * 4)
      sg.putImageData(id, 0, 0)
      gg.drawImage(sc, 24, 30, 80, 90, x - 40 * k / 2 - 10, b.y + 6, 80 * k * 0.5, 90 * k * 0.5)
      const [gc2, g2] = canvas(CELL, CELL)
      const id2 = g2.createImageData(CELL, CELL)
      for (let p = 0; p < CELL * CELL; p++) {
        const a = f.rgba[p * 4 + 3]
        if (a !== 255) continue
        const l = Math.round(0.3 * f.rgba[p * 4] + 0.59 * f.rgba[p * 4 + 1] + 0.11 * f.rgba[p * 4 + 2])
        id2.data.set([l, l, l, 255], p * 4)
      }
      g2.putImageData(id2, 0, 0)
      gg.drawImage(gc2, 24, 30, 80, 90, x - 40 * k / 2 - 10, b.y + 190, 80 * k * 0.5, 90 * k * 0.5)
      text(gg, PEOPLE_OF[r].title, x + 10, b.y + b.h - 8, 15, '#efe6d6', 700, 'center')
    })
  })
}

function headCard(gg: CanvasRenderingContext2D, b: { x: number; y: number; w: number; h: number }, look: HeroLook): void {
  const f = F(look)
  const P = f.pose
  const k = 6
  const hw = 64, hh = 58
  const sx = Math.round(P.head.x - hw / 2 - 4), sy = Math.round(P.head.y - hh / 2 - 6)
  gg.fillStyle = '#5b8c54'
  gg.fillRect(b.x, b.y, b.w, b.h)
  gg.drawImage(frameCanvas(f), sx, sy, hw, hh, b.x + (b.w - hw * k) / 2, b.y + (b.h - hh * k) / 2, hw * k, hh * k)
  hero(gg, f, b.x + b.w - 50, b.y + 110, 1)
}

/** Every roster item, on its own people, alone (bare otherwise), idle at 4× and its strike at 2×. */
function itemCards(): void {
  ITEMS.forEach((it, i) => {
    const race = ITEM_PEOPLE[i]
    const slot = it.slot === 'body' ? 'body' : it.slot === 'offHand' ? 'off' : 'main'
    const look: HeroLook = { race, company: PEOPLE_OF[race].company, gear: { [slot]: it.name } }
    const R = resolveLook(look)
    const fam = slot === 'body' ? R.body?.family : slot === 'off' ? (R.off?.family ?? R.main?.family) : R.main?.family
    const what = slot === 'body' ? 'worn on the torso' : slot === 'off' ? 'in the off hand' : it.slot === 'twoHand' ? 'in both hands' : 'in the main hand'
    card(`item-${slugOf(it.name)}`, 'Parts', it.name, `${PEOPLE_OF[race].title} · ${it.slot} · ${fam} family. Idle at 4×, the strike at 2× (left), 1× in the corner. Judge the grip and the silhouette.`, (gg, b) => {
      groundIn(gg, b, 4, -10)
      const f = F(look)
      hero(gg, f, b.x + b.w / 2 + 60, b.y + b.h - 40, 4)
      hero(gg, F(look, 'attack', 3), b.x + 90, b.y + b.h - 40, 2)
      hero(gg, f, b.x + b.w - 50, b.y + 110, 1)
      text(gg, what, b.x + 10, b.y + 22, 15, '#f2e8d8', 700)
    })
  })
  // the generic fallbacks
  for (const [slot, name] of [['main', 'Mystery Blade'], ['off', 'Odd Trinket'], ['body', 'Strange Garb'], ['main', 'Unnamed Thing']] as const) {
    card(`fallback-${slugOf(name)}`, 'Parts', `Fallback: “${name}”`, `Gear with no part of its own: ${name.includes('Blade') ? 'a keyword family (blade → sword)' : 'the slot’s generic part'}. Judge that the slot is never empty.`, (gg, b) => {
      groundIn(gg, b, 4, -10)
      const f = F({ race: 'human', company: 'neutral', gear: { [slot]: name } })
      hero(gg, f, b.x + b.w / 2, b.y + b.h - 40, 4)
      hero(gg, f, b.x + b.w - 50, b.y + 110, 1)
    })
  }
}

const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** The held-item grip close-up: fists closing over the grip at 8×, idle and mid-strike. */
function gripCards(): void {
  const looks: [string, HeroLook, AnimId, number][] = [
    ['Sword, idle', { race: 'human', company: 'Peppercorn', gear: { main: 'Sword', off: 'Flask' } }, 'idle', 0],
    ['Sword, strike', { race: 'human', company: 'Peppercorn', gear: { main: 'Sword', off: 'Flask' } }, 'attack', 3],
    ['Greatsword (both hands)', { race: 'dwarf', company: 'Ironvein', gear: { main: 'Greatsword' } }, 'idle', 0],
    ['Spear thrust', { race: 'reptilian', company: 'Butcherblock', gear: { main: 'Spear' } }, 'attack', 3],
  ]
  card('grip-closeup', 'Parts', 'Grips: fingers over the handle', 'The fist is re-stamped over its grip, so the handle runs under the fingers; nothing floats, and no second fist shows. 8×, around each hand.', (gg, b) => {
    const k = 8
    looks.forEach(([label, look, anim, fr], i) => {
      const f = F(look, anim, fr)
      const h = f.pose.mainHand
      const s = 30
      const x = b.x + 8 + (i % 2) * (b.w / 2)
      const y = b.y + 8 + Math.floor(i / 2) * (b.h / 2)
      gg.fillStyle = '#5b8c54'
      gg.fillRect(x, y, s * k * 0.95, s * k * 0.8)
      gg.drawImage(frameCanvas(f), Math.round(h.x - s / 2), Math.round(h.y - s / 2 - 2), s, s * 0.84, x, y, s * k * 0.95, s * k * 0.8)
      text(gg, label, x + 6, y + s * k * 0.8 + 18, 14, '#efe6d6', 700)
    })
  })
  const offs = ['(empty)', 'Shield', 'Kite Shield', 'Heater Shield', 'Round Shield', 'Buckler', 'Pavise', 'Quiver', 'Javelin Sling', 'Focus', 'Tome', 'Herb Pouch', 'Flask', 'Philter Rack', 'Dagger']
  const bodies = ['(none)', 'Mail', 'Gambeson', 'Leather', 'Brigandine', 'Plate', "Sergeant's Cuirass", 'Robe', 'Forge Apron', 'Cloak', 'Woven Vest', 'Thornweave Hood', 'Scale Hide', 'Brew Belt']
  const k = 1
  const cw = 70, ch = 84
  const W = 150 + bodies.length * cw + 20
  const H = 66 + 92 + 40 + offs.length * ch + 30
  card('offhand-x-body', 'Parts', 'Every off hand × every body (1×)', 'Rows: off-hand pieces; columns: body pieces; a human with a Sword, at game density. Judge that no pairing clashes, floats or pastes on. Zoom in.', (gg, b) => {
    bodies.forEach((bd, j) => {
      gg.save()
      gg.translate(b.x + 150 + j * cw + cw / 2, b.y + 30)
      gg.rotate(-0.5)
      text(gg, bd, 0, 0, 12, '#efe6d6', 700)
      gg.restore()
    })
    offs.forEach((of, i) => {
      text(gg, of, b.x + 8, b.y + 40 + i * ch + ch * 0.62, 13, '#efe6d6', 700)
      bodies.forEach((bd, j) => {
        const x = b.x + 150 + j * cw, y = b.y + 40 + i * ch
        gg.fillStyle = (i + j) % 2 ? '#5b8c54' : '#55844f'
        gg.fillRect(x, y, cw, ch)
        const f = F({ race: 'human', company: 'Peppercorn', gear: { main: 'Sword', off: of.startsWith('(') ? null : of, body: bd.startsWith('(') ? null : bd } })
        gg.drawImage(frameCanvas(f), 64 - cw / 2 - 2, 112 - ch + 6, cw, ch, x, y, cw * k, ch * k)
      })
    })
  }, W, H)
}

// ── build ──────────────────────────────────────────────────────────────────

function measureReport(): Report {
  const masks = RACES.map((r) => maskOf(F({ race: r })))
  const sil: Report['silhouette'] = []
  for (let i = 0; i < RACES.length; i++) for (let j = i + 1; j < RACES.length; j++) sil.push({ a: RACES[i], b: RACES[j], iou: Math.round(iou(masks[i], masks[j]) * 100) / 100 })
  const heights: Record<string, number> = {}
  const widths: Record<string, number> = {}
  for (const r of RACES) {
    const bx = boxOf([F({ race: r })], 0)
    heights[r] = bx.y1 - bx.y0 + 1
    widths[r] = bx.x1 - bx.x0 + 1
  }
  heights.knight = REFS.knight.height
  widths.knight = REFS.knight.width / 6
  heights.torch = REFS.torch.height
  heights.tnt = REFS.tnt.height
  return { logicalPerArtPx: 1, silhouette: sil, heights, widths }
}

async function build(): Promise<void> {
  const [torch, tnt, knight, tower] = await Promise.all([
    img('assets/sprites/tinyswords/torch1_walk.png'),
    img('assets/sprites/tinyswords/tnt1_walk.png'),
    img('assets/sprites/tinyswords/fighter_idle.png'),
    img('node_modules/.cache/cc0-pack/Factions/Knights/Buildings/Tower/Tower_Blue.png'),
  ])
  REFS = { torch: torch!, tnt: tnt!, knight: knight!, tower }
  out.textContent = ''
  SHEETS.length = 0
  CARDS.length = 0
  const only = new URLSearchParams(location.search).get('only')
  const run = (name: string, fn: () => void) => { if (!only || only.split(',').includes(name)) fn() }
  run('lineup', lineup)
  run('parts', partsMap)
  run('swaps', swaps)
  run('states', states)
  run('animation', animation)
  run('variants', variants)
  run('items', itemCards)
  run('grips', gripCards)
  if (!only || only.includes('cards')) {
    const wrapC = el('div', 'cards')
    for (const cd of CARDS) wrapC.append(cd.canvas)
    out.append(el('h2', undefined, `cards (${CARDS.length})`), wrapC)
  }
  const report = measureReport()
  log.textContent = `tower: ${tower ? 'CC0 cache' : 'MISSING'} · sheets ${SHEETS.length} · cards ${CARDS.length}\n` + JSON.stringify(report)
  const w = window as unknown as { __heroOut: unknown; __heroReady: boolean }
  w.__heroOut = {
    report,
    sheets: SHEETS.map((s) => ({ file: s.file, url: s.canvas.toDataURL('image/png') })),
    cards: CARDS.map((cd) => ({ id: cd.id, group: cd.group, title: cd.title, caption: cd.caption, file: cd.file, url: cd.canvas.toDataURL('image/png'), frames: cd.frames, delays: cd.delays })),
  }
  w.__heroReady = true
}

setActiveTheme('tinyswords')
preloadSprites()
onSpritesReady(() => {
  // the terrain bake lands lazily: build once it has
  void build().then(() => setTimeout(() => void build(), 900))
})
