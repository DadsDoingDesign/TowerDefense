/**
 * The hero builder's review harness — renders the modular heroes
 * (`src/game/render/hero/`) beside the CC0 Tiny Swords originals, and builds
 * the designer's sheets (`docs/characters/*.png`) and phone cards
 * (`docs/characters/cards/`).
 *
 * Run:  npx vite --port 5257  →  http://localhost:5257/harness/heroes.html
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
  CELL, CX, FEET, ITEMS, LAYERS, LIVERIES, RACES, RACE_DEFAULTS, RARITIES, STATUSES, TELLS, FRAME_COUNT, FRAME_MS,
  composeFrame, resolveLook, layerIndex, FACES,
  type AnimId, type HeroFrame, type HeroLook, type LayerId, type PersonaId, type RaceId,
} from '../src/game/render/hero'
import { MINI_FACES, MINI_FEET, MINI_H, MINI_W, miniAt, miniFrame, ticPhase, type MiniAnim } from '../src/game/render/hero/mini'
import { POST_H, POST_W, postAt, postFeetOf, postFrame, postFrames, postMs } from '../src/game/render/hero/post'
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
  g.drawImage(frameCanvas(f), Math.round(x - CX * k), Math.round(y - FEET * k), CELL * k, CELL * k)
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
  /** The CC0 pawn's idle frame 0, trimmed to its pixels. */
  pawn: HTMLCanvasElement
}
let REFS: Refs
/** The pack's plain grass tile (64 px), for cards that need open ground and no road. */
let GRASS: HTMLImageElement | null = null
/** Fill a box with the pack's grass at k× (a field with nothing on it but the figures). */
function meadowIn(g: CanvasRenderingContext2D, b: { x: number; y: number; w: number; h: number }, k: number): void {
  if (!GRASS) return groundIn(g, b, k)
  g.imageSmoothingEnabled = false
  for (let y = b.y; y < b.y + b.h; y += 64 * k) for (let x = b.x; x < b.x + b.w; x += 64 * k) g.drawImage(GRASS, x, y, 64 * k, 64 * k)
}
/** Each face's post, baked with the face at its counter (`stop-scenes.ts --faces`). */
let POST_IMG: Partial<Record<PersonaId, HTMLImageElement | null>> = {}

/** A CC0 sheet's cell (192 px), trimmed to its pixels. */
function trimmedCell(im: HTMLImageElement, col: number, row: number): HTMLCanvasElement {
  const [c, g] = canvas(192, 192)
  g.drawImage(im, col * 192, row * 192, 192, 192, 0, 0, 192, 192)
  const d = g.getImageData(0, 0, 192, 192).data
  let x0 = 192, y0 = 192, x1 = 0, y1 = 0
  for (let y = 0; y < 192; y++) for (let x = 0; x < 192; x++) if (d[(y * 192 + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  const [t, tg] = canvas(x1 - x0 + 1, y1 - y0 + 1)
  tg.drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height)
  return t
}

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
type Group = 'Company faces' | 'Dock' | 'Rig/Parts' | 'Swaps' | 'States' | 'Animation'
interface CardOut { id: string; group: Group; people: string; title: string; caption: string; file: string; canvas: HTMLCanvasElement; frames?: number; delays?: number[] }
const SHEETS: SheetOut[] = []
const CARDS: CardOut[] = []

function sheet(file: string, c: HTMLCanvasElement, title: string): void {
  SHEETS.push({ file, canvas: c })
  out.append(el('h2', undefined, `${file} — ${title}`), c)
}

const CARD = 600
/** A phone card: dark panel, the title on top, the caption under the art, the art in between. */
const slugG = (g: string) => g.toLowerCase().replace(/[^a-z]+/g, '-')
/**
 * A builder (rig) card is magnified to be judged; the game draws the rig 1:1,
 * so every such card says so (the company faces are hand-drawn per size and
 * shown as the game shows them).
 */
const RIG_GROUPS = new Set<Group>(['Rig/Parts', 'Swaps', 'States', 'Animation'])
const rigNote = (group: Group, caption: string): string => (RIG_GROUPS.has(group) && !/hand-drawn/i.test(caption) ? `${caption} (Magnified to judge; the game draws it 1:1.)` : caption)
function card(id: string, group: Group, title: string, caption0: string, draw: (g: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }) => void, w = CARD, h = CARD, people = 'all'): HTMLCanvasElement {
  const caption = rigNote(group, caption0)
  const [c, g] = canvas(w, h)
  paintCard(g, w, h, title, caption, group, draw)
  CARDS.push({ id, group, people, title, caption, file: `${slugG(group)}-${id}.png`, canvas: c })
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
function animCard(id: string, title: string, caption0: string, n: number, delays: number[], draw: (g: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }, i: number) => void, people = 'all', group: Group = 'Animation'): void {
  const caption = rigNote(group, caption0)
  const [c, g] = canvas(CARD, CARD * n)
  for (let i = 0; i < n; i++) {
    g.save()
    g.translate(0, i * CARD)
    paintCard(g, CARD, CARD, title, caption, group, (gg, b) => draw(gg, b, i))
    g.restore()
  }
  CARDS.push({ id, group, people, title, caption, file: `${slugG(group)}-${id}.gif`, canvas: c, frames: n, delays })
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
  // 3×: the same, closer, in two rows: the torch goblin with three peoples, then two and the TNT goblin and the knight
  const k3 = 3
  const [c3, g3] = ground(W / k3, 420 / k3, k3, postOf(), -10)
  const gy3a = 64, gy3b = 134
  refFrame(g3, REFS.torch, 6, 0, 52 * k3, (gy3a + 3) * k3, k3)
  ;(['human', 'elf', 'dwarf'] as RaceId[]).forEach((r, i) => hero(g3, F(BASE_KIT[r]), (150 + i * 96) * k3, gy3a * k3, k3))
  ;(['reptilian', 'gnome'] as RaceId[]).forEach((r, i) => hero(g3, F(BASE_KIT[r]), (110 + i * 96) * k3, gy3b * k3, k3))
  refFrame(g3, REFS.tnt, 6, 0, 300 * k3, (gy3b + 3) * k3, k3)
  refFrame(g3, REFS.knight, 6, 0, 392 * k3, (gy3b + 2) * k3, k3)
  // the sheet
  const [c, g] = canvas(W, 120 + gh1 + 66 + 420 + 10)
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
    card(`race-${r}`, 'Rig/Parts', `${PEOPLE_OF[r].title} — the base`, `Judge the silhouette and face beside the CC0 goblin at the same density (4×, and 1× in the corner). Default head "${d.heads[0]}", hair "${d.hairs[0]}".`, (gg, b) => {
      groundIn(gg, b, 4, -14)
      const fy = b.y + b.h - 50
      refFrame(gg, REFS.torch, 6, 0, b.x + 150, fy + 12, 4)
      hero(gg, F({ race: r }), b.x + 380, fy, 4)
      gg.fillStyle = 'rgba(0,0,0,0.35)'
      gg.fillRect(b.x + b.w - 150, b.y + 8, 142, 110)
      refFrame(gg, REFS.torch, 6, 0, b.x + b.w - 115, b.y + 110, 1)
      hero(gg, F({ race: r }), b.x + b.w - 50, b.y + 106, 1)
    }, CARD, CARD, r)
  }
}

// ── 2 · the parts map ──────────────────────────────────────────────────────

const LAYER_LABEL: Readonly<Record<LayerId, string>> = {
  back: '1 back', offArm: '2 off-hand arm', legs: '3 legs & boots', body: '4 body (race)', armour: '5 body armour', head: '6 head (race face)',
  hair: '7 hair / headgear', mainArm: '8 main-hand arm', mainItem: '9 main-hand item', offItem: '10 off-hand item', fx: '11 FX tells',
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
  const [c, g] = canvas(W, 1560)
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
  text(g, 'The same frame, layer by layer (2×) — each layer’s pieces as they are drawn, before anything in front covers them', 20, ey, 18, GOLD, 700)
  const box = boxOf([f], 4)
  const bw = (box.x1 - box.x0 + 1) * 2, bh = (box.y1 - box.y0 + 1) * 2
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
  card('rig-anchors', 'Rig/Parts', 'The rig: anchors', 'Every part hangs from these anchors; the peoples differ only in the body numbers between them. Judge whether each anchor sits where a part would attach.', (gg, b) => {
    const kk = 3
    gg.drawImage(c, ox - 10, oy - 10, CELL * k + 20, CELL * k + 20, b.x + (b.w - (CELL * kk + 15)) / 2, b.y + 4, CELL * kk + 15, CELL * kk + 15)
  })
  LAYERS.forEach((l) => {
    card(`layer-${l}`, 'Rig/Parts', `Layer ${LAYER_LABEL[l]}`, `What this layer draws on its own (4×), in its own ink ring; the full figure is in the corner. Judge that it is complete — no holes where other layers sit.`, (gg, b) => {
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
const ONE_KIT: NonNullable<HeroLook['gear']> = { main: 'Arming Sword', off: 'Kite Shield', body: 'Plate' }

function swaps(): void {
  const W = 1344
  const k = 2
  const box = { x0: 40, y0: 48, x1: 140, y1: 144 }
  const cw = (box.x1 - box.x0 + 1) * k, ch = (box.y1 - box.y0 + 1) * k
  const per = Math.floor((W - 20) / (cw + 10))
  const rows1 = Math.ceil(SWAP_KITS.length / per)
  const [c, g] = canvas(W, 120 + rows1 * (ch + 40) + 70 + 2 * (ch + 40) + 70 + 2 * (ch + 40) + 20)
  g.fillStyle = PANEL
  g.fillRect(0, 0, W, c.height)
  text(g, 'Swaps: gear maps to parts', 20, 44, 32, '#f2e8d8', 700, 'left', 'Georgia, serif')
  text(g, 'One human across kits from every people (top); one kit across the five peoples (middle); one hire in each company’s colours (bottom). 2×.', 20, 74, 18, DIM)
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
  y += 2 * (ch + 40) + 30
  text(g, 'One hire (a dwarf, Axe · Round Shield · Chainshirt) in each company’s livery', 20, y, 18, GOLD, 700)
  y += 16
  const cos = Object.keys(LIVERIES)
  cos.forEach((co, i) => cell(i, F({ race: 'dwarf', company: co, gear: { main: 'Axe', off: 'Round Shield', body: 'Chainshirt' } }), co, y))
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
    { title: 'Level tier — the cape grows with the level (shown without a shield, which hides most of it)', rows: [1, 3, 5, 8].map((l) => ({ id: `level-${l}`, label: `level ${l}`, look: w({ level: l }, { gear: { main: 'Sword', body: 'Mail' } }), what: `the cape at level ${l}` })) },
    { title: 'Skill tells', rows: TELLS.map((t) => ({ id: `tell-${t}`, label: t, look: w({ skills: [t] }, t === 'spark' || t === 'bloom' ? { race: 'gnome', company: 'Greenvial', gear: { main: 'Staff', body: 'Robe' } } : {}), frame: 2, what: `the ${t} tell` })) },
    { title: 'Status effects', rows: [...STATUSES.map((s) => ({ id: `status-${s}`, label: s, look: w({ status: [s] }), frame: 2, what: `the ${s} status` })), { id: 'status-wounded', label: 'wounded', look: w({ wounded: true }), frame: 2, what: 'a wound' }] },
  ]
}

function states(): void {
  const W = 1344
  const k = 2
  const box = { x0: 36, y0: 38, x1: 144, y1: 146 }
  const cw = (box.x1 - box.x0 + 1) * k, ch = (box.y1 - box.y0 + 1) * k
  const per = Math.floor((W - 20) / (cw + 10))
  const groups = stateRows()
  const rowsN = groups.reduce((n, gp) => n + Math.ceil(gp.rows.length / per), 0)
  const [c, g] = canvas(W, 110 + rowsN * (ch + 36) + groups.length * 40 + 20)
  g.fillStyle = PANEL
  g.fillRect(0, 0, W, c.height)
  text(g, 'States: one hero, edited by status', 20, 44, 32, '#f2e8d8', 700, 'left', 'Georgia, serif')
  text(g, 'A human (Sword · Kite Shield · Mail). Each state edits only its own layer (STATE_LAYERS, held by the tests). 2×.', 20, 74, 18, DIM)
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
  const box = { x0: 20, y0: 26, x1: 166, y1: 146 }
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
    for (const hd of d.heads) card(`head-${r}-${hd}`, 'Rig/Parts', `${PEOPLE_OF[r].title} — head “${hd}”`, `The race face variant at 6×; the whole figure at 1× in the corner. Judge it reads as ${r} and the features don’t merge.`, (gg, b) => headCard(gg, b, { race: r, head: hd }))
    for (const hr of d.hairs) card(`hair-${r}-${hr}`, 'Rig/Parts', `${PEOPLE_OF[r].title} — hair “${hr}”`, `The hair / headgear variant at 6×; 1× in the corner. Judge the ear and face stay clear of it.`, (gg, b) => headCard(gg, b, { race: r, hair: hr }))
  }
  // the greyscale silhouette test
  card('race-silhouettes', 'Rig/Parts', 'Silhouettes: the five peoples', 'Each people filled flat (top, 3×) and in greyscale (bottom). Judge that they read apart by shape alone.', (gg, b) => {
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
    card(`item-${slugOf(it.name)}`, 'Rig/Parts', it.name, `${PEOPLE_OF[race].title} · ${it.slot} · ${fam} family. Idle at 4×, the strike at 2× (left), 1× in the corner. Judge the grip and the silhouette.`, (gg, b) => {
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
    card(`fallback-${slugOf(name)}`, 'Rig/Parts', `Fallback: “${name}”`, `Gear with no part of its own: ${name.includes('Blade') ? 'a keyword family (blade → sword)' : 'the slot’s generic part'}. Judge that the slot is never empty.`, (gg, b) => {
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
  card('grip-closeup', 'Rig/Parts', 'Grips: fingers over the handle', 'The fist is re-stamped over its grip, so the handle runs under the fingers; nothing floats, and no second fist shows. 8×, around each hand.', (gg, b) => {
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
  const W = 150 + bodies.length * cw + 60
  const H = 66 + 92 + 70 + offs.length * ch + 30
  card('offhand-x-body', 'Rig/Parts', 'Every off hand × every body (1×)', 'Rows: off-hand pieces; columns: body pieces; a human with a Sword, at game density. Judge that no pairing clashes, floats or pastes on. Zoom in.', (gg, b) => {
    bodies.forEach((bd, j) => {
      gg.save()
      gg.translate(b.x + 150 + j * cw + 14, b.y + 58)
      gg.rotate(-0.5)
      text(gg, bd, 0, 0, 12, '#efe6d6', 700)
      gg.restore()
    })
    offs.forEach((of, i) => {
      text(gg, of, b.x + 8, b.y + 70 + i * ch + ch * 0.62, 13, '#efe6d6', 700)
      bodies.forEach((bd, j) => {
        const x = b.x + 150 + j * cw, y = b.y + 70 + i * ch
        gg.fillStyle = (i + j) % 2 ? '#5b8c54' : '#55844f'
        gg.fillRect(x, y, cw, ch)
        const f = F({ race: 'human', company: 'Peppercorn', gear: { main: 'Sword', off: of.startsWith('(') ? null : of, body: bd.startsWith('(') ? null : bd } })
        gg.drawImage(frameCanvas(f), CX - cw / 2 - 2, FEET - ch + 6, cw, ch, x, y, cw * k, ch * k)
      })
    })
  }, W, H)
}

// ── 7 · the company faces: field, bust, dock ──────────────────────────────

/** Dock order (COMPANY_IDS): spice, art, metals, silk, scrolls. */
const DOCK_ORDER: PersonaId[] = ['saffra', 'hask', 'brannoch', 'odile', 'wren']

const miniCache = new Map<string, HTMLCanvasElement>()
function miniCanvas(id: PersonaId, anim: MiniAnim, f: number, locked = false): HTMLCanvasElement {
  const key = `${id}|${anim}|${f}|${locked}`
  const hit = miniCache.get(key)
  if (hit) return hit
  const fr = miniFrame(id, anim, f, locked)
  const [c, g] = canvas(fr.w, fr.h)
  g.putImageData(new ImageData(new Uint8ClampedArray(fr.rgba), fr.w, fr.h), 0, 0)
  miniCache.set(key, c)
  return c
}

/**
 * The faces at FIELD / POST size: hand-drawn at the pack's scale (`post.ts`),
 * drawn 1:1 or at an integer scale, never the rig magnified.
 */
const postCache = new Map<string, HTMLCanvasElement>()
function postCanvas(id: PersonaId, anim: MiniAnim = 'idle', f = 0, locked = false): HTMLCanvasElement {
  const key = `${id}|${anim}|${f}|${locked}`
  const hit = postCache.get(key)
  if (hit) return hit
  const fr = postFrame(id, anim, f, locked)
  const [c, g] = canvas(fr.w, fr.h)
  g.putImageData(new ImageData(new Uint8ClampedArray(fr.rgba), fr.w, fr.h), 0, 0)
  postCache.set(key, c)
  return c
}
/** A post-size face with the middle of its feet at (x, y), k× (an integer: no resampling). */
function postAtXY(g: CanvasRenderingContext2D, id: PersonaId, x: number, y: number, k: number, anim: MiniAnim = 'idle', f = 0, locked = false): void {
  const p = postFeetOf(id)
  g.drawImage(postCanvas(id, anim, f, locked), Math.round(x - p.x * k), Math.round(y - p.y * k), POST_W * k, POST_H * k)
}
/** The CC0 pawn (idle frame 0, trimmed), its feet at (x, y), k×. */
function pawnAt(g: CanvasRenderingContext2D, x: number, y: number, k: number): void {
  const p = REFS.pawn
  g.drawImage(p, Math.round(x - (p.width / 2) * k), Math.round(y - (p.height - 3) * k), p.width * k, p.height * k)
}
/** Each face's post: the shipped scene, the face standing in front of its stall (`stop-scenes.ts --faces`; the two proposals too). */
const POST_SCENE: Readonly<Record<PersonaId, string>> = { saffra: 'liaison-spice', odile: 'liaison-silk', brannoch: 'liaison-metals', hask: 'proposal-butcherblock', wren: 'proposal-greenvial' }

function faces(): void {
  const W = 1344
  const [c, g] = canvas(W, 900)
  g.fillStyle = PANEL
  g.fillRect(0, 0, W, c.height)
  text(g, 'The company faces: field / post size and dock size', 20, 44, 32, '#f2e8d8', 700, 'left', 'Georgia, serif')
  text(g, 'Hand-drawn at each size the game shows them (field / post: the pack’s pawn scale; dock: 24 × 28). Beside the CC0 pawn, knight and goblin, 1× and 3×.', 20, 74, 18, DIM)
  // 1× on the ground with the pack
  const [g1c, g1] = ground(W, 130, 1, postOf(), -30)
  pawnAt(g1, 90, 112, 1)
  refFrame(g1, REFS.knight, 6, 0, 190, 116)
  refFrame(g1, REFS.torch, 6, 0, 290, 116)
  DOCK_ORDER.forEach((id, i) => postAtXY(g1, id, 420 + i * 90, 112, 1))
  DOCK_ORDER.forEach((id, i) => g1.drawImage(miniCanvas(id, 'idle', 0), 900 + i * 60, 112 - (MINI_FEET + 2) * 2, MINI_W * 2, MINI_H * 2))
  g.drawImage(g1c, 0, 92)
  text(g, 'pack', 70, 240, 14, DIM)
  text(g, 'field / post 1×', 420, 240, 14, DIM)
  text(g, 'dock 2× (the slot)', 900, 240, 14, DIM)
  // 3× each, on ground, with the dock figure
  DOCK_ORDER.forEach((id, i) => {
    const fc = FACES.find((x) => x.id === id)!
    const x0 = 20 + i * 264
    const [gc] = ground(84, 90, 3, postOf(), -10)
    g.drawImage(gc, x0, 262)
    postAtXY(g, id, x0 + 126, 262 + 84 * 3, 3)
    g.fillStyle = '#2c3434'
    g.fillRect(x0, 540, 252, 90)
    g.drawImage(miniCanvas(id, 'idle', 0), x0 + 10, 548, MINI_W * 3, MINI_H * 3)
    g.drawImage(miniCanvas(id, 'idle', 0), x0 + 100, 570, MINI_W * 2, MINI_H * 2)
    g.drawImage(miniCanvas(id, 'idle', 0), x0 + 170, 590, MINI_W, MINI_H)
    text(g, fc.name, x0 + 4, 660, 24, '#f2e8d8', 700, 'left', 'Georgia, serif')
    text(g, `${fc.companyName} · ${fc.role}${fc.proposal ? ' · PROPOSAL' : ''}`, x0 + 4, 682, 13, fc.proposal ? GOLD : DIM, 700)
    let ty = 706
    for (const line of [fc.brief.temperament, `Tic: ${fc.brief.tic}`, `Shape: ${fc.brief.silhouette}`]) ty = wrap(g, line, x0 + 4, ty, 248, 14, '#efe6d6', 1.25) + 4
  })
  sheet('docs/characters/faces.png', c, 'the five company faces')

  for (const fc of FACES) {
    const id = fc.id
    const people = fc.look.race
    // the post: the scene at the page's 2× (the 260 px a phone sees), the face in front of its stall
    card(`face-${id}`, 'Company faces', `${fc.name} — at the ${fc.companyName} post`, `The post as a phone shows it: the scene at 2×, the face built on its skeleton at the pack’s scale, standing in front of its stall${fc.proposal ? ' (a proposed post)' : ''}. Judge the people, trade and temperament without this caption.`, (gg, b) => {
      const sc = POST_IMG[id]
      gg.fillStyle = '#16120f'
      gg.fillRect(b.x, b.y, b.w, b.h)
      if (sc) gg.drawImage(sc, 70, 0, 260, 150, b.x + (b.w - 520) / 2, b.y + 6, 520, 300)
      // the figure alone below, 1× and 2×, as the post draws it
      gg.fillStyle = '#2a2420'
      gg.fillRect(b.x + 8, b.y + 316, b.w - 16, b.h - 324)
      postAtXY(gg, id, b.x + 46, b.y + b.h - 18, 1)
      postAtXY(gg, id, b.x + 190, b.y + b.h - 10, 2, 'tic', 2)
      postAtXY(gg, id, b.x + 400, b.y + b.h - 10, 2, 'react', 1)
      text(gg, '1×', b.x + 86, b.y + b.h - 22, 13, DIM, 700)
      text(gg, 'tic, 2×', b.x + 262, b.y + b.h - 22, 13, DIM, 700)
      text(gg, 'picked, 2×', b.x + 472, b.y + b.h - 22, 13, DIM, 700)
    }, CARD, CARD, people)
    // the battlefield: beside the pack's pawn, knight and goblin at the phone's 2×, and the face with the pawn at 4×
    card(`field-${id}`, 'Company faces', `${fc.name} on the field, beside the pack`, 'Top: a battlefield crop at a phone’s 2×, the pack’s pawn, knight and goblin beside the face. Below: the face and the pawn at 4×. Judge that it is one set with the pack, not chunkier.', (gg, b) => {
      meadowIn(gg, b, 2)
      pawnAt(gg, b.x + 64, b.y + 140, 2)
      refFrame(gg, REFS.knight, 6, 0, b.x + 210, b.y + 146, 2)
      refFrame(gg, REFS.torch, 6, 0, b.x + 360, b.y + 146, 2)
      postAtXY(gg, id, b.x + 500, b.y + 140, 2)
      gg.fillStyle = 'rgba(22,28,46,0.35)'
      gg.fillRect(b.x, b.y + 160, b.w, b.h - 160)
      pawnAt(gg, b.x + 150, b.y + b.h - 14, 4)
      postAtXY(gg, id, b.x + 420, b.y + b.h - 10, 4)
    }, CARD, CARD, people)
    card(`brief-${id}`, 'Company faces', `${fc.name}: the brief`, fc.proposal ? `PROPOSAL — ${fc.proposal}` : 'The person behind the design: who, want and worry, temperament, tic, shape, prop.', (gg, b) => {
      gg.fillStyle = '#3a2f27'
      gg.fillRect(b.x + 8, b.y + 8, 196, 196)
      postAtXY(gg, id, b.x + 104, b.y + 196, 3, 'react', 2)
      let ty = b.y + 30
      const tx = b.x + 220, tw = b.w - 230
      for (const [k, v] of [['Who', fc.brief.who], ['Want', fc.brief.want]] as const) {
        text(gg, k, tx, ty, 14, GOLD, 700)
        ty = wrap(gg, v, tx, ty + 18, tw, 14, '#efe6d6', 1.25) + 6
      }
      ty = Math.max(ty, b.y + 224)
      for (const [k, v] of [['Temperament', fc.brief.temperament], ['Tic', fc.brief.tic], ['Silhouette', fc.brief.silhouette], ['Prop', fc.brief.prop]] as const) {
        text(gg, k, b.x + 14, ty, 14, GOLD, 700)
        ty = wrap(gg, v, b.x + 120, ty, b.w - 132, 15, '#efe6d6', 1.25) + 8
      }
    }, CARD, CARD, people)
    // the moves, at the post size: 4× on the ground, 1× in the corner, at the dock's clock
    const clock = MINI_FACES[id]
    for (const a of ['idle', 'tic', 'react'] as MiniAnim[]) {
      const n = postFrames(id, a)
      const ms = postMs(id, a)
      animCard(`${id}-${a}`, `${fc.name} — ${a === 'react' ? 'reaction (slot picked)' : a}`, `Hand-drawn at the post size: ${n} frames, ${a === 'tic' ? `every ${(clock.ticEvery / 1000).toFixed(1)} s` : a === 'idle' ? `a ${(clock.period / 1000).toFixed(2)} s loop` : 'once, when picked'}; 4× and 1× (corner). Judge the timing and that it says the temperament.`, n, ms, (gg, b, i) => {
        groundIn(gg, b, 4, -12)
        postAtXY(gg, id, b.x + b.w / 2, b.y + b.h - 30, 4, a, i)
        gg.fillStyle = 'rgba(0,0,0,0.35)'
        gg.fillRect(b.x + b.w - 96, b.y + 8, 88, 84)
        postAtXY(gg, id, b.x + b.w - 52, b.y + 84, 1, a, i)
      }, people)
    }
    // a few seconds of life, by the face's own clock
    {
      const STEP = 100, N = 40
      animCard(`${id}-life`, `${fc.name} — a few seconds of life`, `Four seconds by the face’s own clock: its idle, and its tic when it falls due (hand-drawn, 4×). Judge that it is calm and says who they are.`, N, Array.from({ length: N }, () => STEP), (gg, b, i) => {
        groundIn(gg, b, 4, -12)
        // start 1.5 s before the face's next tic falls due
        const t0 = (((clock.ticEvery - ticPhase(id) - 1500) % clock.ticEvery) + clock.ticEvery) % clock.ticEvery
        const at = postAt(id, t0 + i * STEP)
        postAtXY(gg, id, b.x + b.w / 2, b.y + b.h - 30, 4, at.anim, at.frame)
      }, people)
    }
    // the dock figure
    card(`dock-${id}`, 'Dock', `${fc.name} at dock size`, 'Redrawn at 24 px for the dock slot (shown 6×): idle, tic, reaction and locked, the 2× slot size beside; the strip below is 1× and 2× on the slot. Judge it is still a person, not a smudge.', (gg, b) => {
      const k = 6
      gg.fillStyle = '#2c3434'
      gg.fillRect(b.x + 8, b.y + 360, b.w - 16, 68)
      const nIdle = MINI_FACES[id].idle.length
      for (let j = 0; j < Math.min(nIdle, 6); j++) gg.drawImage(miniCanvas(id, 'idle', j), b.x + 20 + j * 56, b.y + 366, MINI_W * 2, MINI_H * 2)
      for (let j = 0; j < Math.min(nIdle, 6); j++) gg.drawImage(miniCanvas(id, 'idle', j), b.x + 370 + j * 30, b.y + 384, MINI_W, MINI_H)
      const cells: [MiniAnim, number, boolean, string][] = [['idle', 0, false, 'idle'], ['tic', 2, false, 'tic'], ['react', 1, false, 'picked'], ['idle', 0, true, 'locked']]
      cells.forEach(([a, f, lock, lab], i) => {
        const x = b.x + 8 + (i % 2) * 280, yy = b.y + 6 + Math.floor(i / 2) * 176
        gg.fillStyle = '#3a2f27'
        gg.fillRect(x, yy, MINI_W * k, MINI_H * k)
        gg.drawImage(miniCanvas(id, a, f, lock), x, yy, MINI_W * k, MINI_H * k)
        gg.drawImage(miniCanvas(id, a, f, lock), x + MINI_W * k + 14, yy + 40, MINI_W * 2, MINI_H * 2)
        text(gg, lab, x + MINI_W * k + 14, yy + 30, 15, '#efe6d6', 700)
      })
    }, CARD, CARD, people)
  }

  // the line-ups, one per size
  card('lineup-field', 'Company faces', 'The five at field / post size', 'All five at the pack’s scale beside the pawn and a goblin: 1× (top) and a phone’s 2×. Judge that each is known by its shape and colour, and that they belong with the pack.', (gg, b) => {
    meadowIn(gg, b, 1)
    pawnAt(gg, b.x + 40, b.y + 84, 1)
    refFrame(gg, REFS.torch, 6, 0, b.x + 100, b.y + 88)
    DOCK_ORDER.forEach((id, i) => postAtXY(gg, id, b.x + 170 + i * 80, b.y + 84, 1))
    meadowIn(gg, { x: b.x, y: b.y + 110, w: b.w, h: b.h - 110 }, 2)
    DOCK_ORDER.forEach((id, i) => postAtXY(gg, id, b.x + 62 + i * 112, b.y + b.h - 40, 2))
  }, CARD, CARD, 'all')
  card('lineup-dock', 'Dock', 'The five at dock size', 'All five redrawn at 24 × 28: 1×, the slot’s own 2×, 4×, and locked at 2×, on the slot colour. Judge that each is a person and known by its shape alone.', (gg, b) => {
    gg.fillStyle = '#2c3434'
    gg.fillRect(b.x, b.y, b.w, b.h)
    DOCK_ORDER.forEach((id, i) => {
      const x = b.x + 18 + i * 112
      gg.drawImage(miniCanvas(id, 'idle', 0), x + 36, b.y + 12, MINI_W, MINI_H)
      gg.drawImage(miniCanvas(id, 'idle', 0), x + 24, b.y + 56, MINI_W * 2, MINI_H * 2)
      gg.drawImage(miniCanvas(id, 'idle', 0), x, b.y + 130, MINI_W * 4, MINI_H * 4)
      // and locked, at the slot's 2× (the company not open yet)
      gg.drawImage(miniCanvas(id, 'idle', 0, true), x + 24, b.y + 268, MINI_W * 2, MINI_H * 2)
      text(gg, FACES.find((f) => f.id === id)!.name, x + 48, b.y + b.h - 14, 15, '#efe6d6', 800, 'center')
    })
  }, CARD, CARD, 'all')

  // the silhouette line-up: field / post and dock, filled flat — each must be known by its shape alone
  card('silhouettes', 'Company faces', 'Silhouettes: field and dock', 'The five faces filled flat, at the sizes the game shows them (field / post 1×, dock 2×) and the dock figure at 4×. Judge that each is known by its shape alone.', (gg, b) => {
    gg.fillStyle = '#e1d4bd'
    gg.fillRect(b.x, b.y, b.w, b.h)
    const flat = (src: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement => {
      const [c2, g2] = canvas(w, h)
      const id2 = g2.createImageData(w, h)
      for (let p = 0; p < w * h; p++) if (src[p * 4 + 3] === 255) id2.data.set([22, 28, 46, 255], p * 4)
      g2.putImageData(id2, 0, 0)
      return c2
    }
    DOCK_ORDER.forEach((id, i) => {
      const fc = FACES.find((x) => x.id === id)!
      const x = b.x + 40 + i * 106
      const pf = postFrame(id, 'idle', 0)
      const sil = flat(pf.rgba, pf.w, pf.h)
      const ft = postFeetOf(id)
      gg.drawImage(sil, Math.round(x + 52 - ft.x), Math.round(b.y + 150 - ft.y))
      const m = miniFrame(id, 'idle', 0)
      const ms = flat(m.rgba, m.w, m.h)
      gg.drawImage(ms, x + (104 - MINI_W * 2) / 2, b.y + 170, MINI_W * 2, MINI_H * 2)
      gg.drawImage(ms, x + (104 - MINI_W * 4) / 2, b.y + 250, MINI_W * 4, MINI_H * 4)
      text(gg, fc.name, x + 52, b.y + b.h - 8, 15, '#1d1713', 800, 'center')
    })
    text(gg, 'field', b.x + 6, b.y + 130, 12, '#6d5f52', 700)
    text(gg, '1×', b.x + 6, b.y + 146, 12, '#6d5f52', 700)
    text(gg, 'dock', b.x + 6, b.y + 196, 12, '#6d5f52', 700)
    text(gg, '2×', b.x + 6, b.y + 212, 12, '#6d5f52', 700)
    text(gg, 'dock', b.x + 6, b.y + 300, 12, '#6d5f52', 700)
    text(gg, '4×', b.x + 6, b.y + 316, 12, '#6d5f52', 700)
  }, CARD, CARD, 'all')

  // the dock in motion: the dock's own clock (miniAt), 6.4 s at 80 ms a frame; the third slot picked at 1.6 s, the fifth locked
  const STEP = 80, N = 80
  animCard('dock-motion', 'The dock in motion (2× slot size)', 'The dock’s own clock: each face idles in its own shape and period, tics on its own beat, the third slot picked; the fifth locked. Judge that no two move together.', N, Array.from({ length: N }, () => STEP), (gg, b, i) => {
    gg.fillStyle = '#1d2a2a'
    gg.fillRect(b.x, b.y, b.w, b.h)
    const sw = 100
    const t = i * STEP
    DOCK_ORDER.forEach((id, s) => {
      const x = b.x + 22 + s * (sw + 6), y0 = b.y + 110
      const picked = s === 2
      gg.fillStyle = picked ? '#4a3a24' : '#2c3434'
      gg.fillRect(x, y0, sw, 168)
      gg.strokeStyle = picked ? GOLD : '#4f5e65'
      gg.lineWidth = picked ? 4 : 2
      gg.strokeRect(x, y0, sw, 168)
      const locked = s === 4
      const at = miniAt(id, t, { pickedAt: picked ? 1600 : undefined, still: locked })
      gg.drawImage(miniCanvas(id, at.anim, at.frame, locked), x + (sw - MINI_W * 3) / 2, y0 + 10, MINI_W * 3, MINI_H * 3)
      text(gg, locked ? 'locked' : `Rep ${[4, 2, 6, 3, 0][s]}`, x + sw / 2, y0 + 156, 16, locked ? DIM : '#f2e8d8', 800, 'center')
    })
    text(gg, `${(t / 1000).toFixed(1)} s`, b.x + b.w - 14, b.y + 28, 16, DIM, 700, 'right')
  }, 'all', 'Dock')

  // proof that they never move in step: ten seconds of each face's clock
  card('motion-desync', 'Dock', 'Ten seconds: no two in step', 'Each row is one face over 10 s: the line is how far its head moves (its own shape and period), the blocks its tics (its own interval and phase). Judge that no two line up.', (gg, b) => {
    const x0 = b.x + 150, w = b.w - 162, T = 10000
    const SHAPE: Record<PersonaId, string> = { saffra: 'toe-tap', odile: 'sway + cloak wave', brannoch: 'one slow breath', hask: 'still, tail lash', wren: 'vial glow' }
    gg.fillStyle = '#231c17'
    gg.fillRect(b.x, b.y, b.w, b.h)
    for (let sec = 0; sec <= 10; sec++) {
      const x = x0 + (sec / 10) * w
      gg.fillStyle = '#3b3029'
      gg.fillRect(x, b.y + 8, 1, b.h - 30)
      text(gg, `${sec}`, x, b.y + b.h - 8, 12, DIM, 700, 'center')
    }
    DOCK_ORDER.forEach((id, r) => {
      const f = MINI_FACES[id]
      const y = b.y + 22 + r * 64
      gg.drawImage(miniCanvas(id, 'idle', 0), b.x + 6, y - 14, MINI_W * 2, MINI_H * 2)
      text(gg, FACES.find((fc) => fc.id === id)!.name, b.x + 56, y + 14, 13, '#efe6d6', 700)
      text(gg, `${SHAPE[id]} · ${(f.period / 1000).toFixed(2)} s`, b.x + 56, y + 30, 11, DIM)
      // the idle's motion as a line: which frame of its loop, over time
      gg.strokeStyle = ['#e3b64f', '#d55869', '#5d8be2', '#47aba9', '#95d562'][r]
      gg.lineWidth = 2
      gg.beginPath()
      for (let px = 0; px <= w; px++) {
        const t = (px / w) * T
        const at = miniAt(id, t)
        // the head's real offset in this frame (sideways for a shift or sway, down for a bob or breath)
        const mv = at.anim === 'idle' ? f.idle[at.frame].move?.head ?? [0, 0] : [0, 0]
        const v = mv[0] || -mv[1]
        const yy = y + 12 - v * 9
        px ? gg.lineTo(x0 + px, yy) : gg.moveTo(x0 + px, yy)
      }
      gg.stroke()
      // the tics: blocks where they play
      for (let px = 0; px <= w; px++) {
        const t = (px / w) * T
        if (miniAt(id, t).anim === 'tic') { gg.fillStyle = 'rgba(227,182,79,0.55)'; gg.fillRect(x0 + px, y - 2, 1, 30) }
      }
      text(gg, `tic every ${(f.ticEvery / 1000).toFixed(1)} s · phase ${(ticPhase(id) / 1000).toFixed(1)} s`, x0 + w, y + 40, 11, DIM, 400, 'right')
    })
  }, CARD, 66 + 22 + 5 * 64 + 40 + 92)
}

// ── 8 · zoomed beside the pack (the 8× critique) ───────────────────────────

/** A region of a CC0 strip frame, at k. */
function refCrop(g: CanvasRenderingContext2D, im: HTMLImageElement, n: number, i: number, sx: number, sy: number, w: number, h: number, x: number, y: number, k: number): void {
  const fw = im.width / n
  g.drawImage(im, fw * i + sx, sy, w, h, x, y, w * k, h * k)
}

function zoom(): void {
  // the pack's knight and torch goblin beside our human and gnome, 8×, same region size
  card('zoom-4x', 'Rig/Parts', '4× beside the pack', 'Top: the CC0 knight and torch goblin. Bottom: our human and Wren, same crop size at the same 4×. Judge the outline weight, the three-tone shading and the edges.', (gg, b) => {
    const k = 4
    const w = 64, h = 46
    gg.fillStyle = '#5b8c54'
    gg.fillRect(b.x, b.y, b.w, b.h)
    refCrop(gg, REFS.knight, 6, 0, 8, 10, w, h, b.x + 8, b.y + 6, k)
    refCrop(gg, REFS.torch, 6, 0, 30, 8, w, h, b.x + 8 + w * k + 8, b.y + 6, k)
    const hf = F(BASE_KIT.human), wf = F(FACES[4].look)
    const crop2 = (f: HeroFrame, x: number) => {
      const P = f.pose
      gg.drawImage(frameCanvas(f), Math.round(P.head.x - w / 2 + 6), Math.round(P.head.y - 22), w, h, x, b.y + 6 + h * k + 10, w * k, h * k)
    }
    crop2(hf, b.x + 8)
    crop2(wf, b.x + 8 + w * k + 8)
  })
  card('zoom-8x', 'Rig/Parts', '8×: a face and a fist', 'Left: the CC0 knight’s visor and sword fist. Right: our human’s face and sword fist. 8×, same crop. Judge single pixels: ink runs, tone steps, no strays.', (gg, b) => {
    const k = 8
    const w = 32, h = 22
    const f = F(BASE_KIT.human)
    const P = f.pose
    const panels: [CanvasImageSource, number, number][] = [
      [REFS.knight, 24, 30],
      [frameCanvas(f), Math.round(P.head.x - 6), Math.round(P.head.y - 6)],
      [REFS.knight, 44, 52],
      [frameCanvas(f), Math.round(P.mainHand.x - 14), Math.round(P.mainHand.y - 12)],
    ]
    panels.forEach(([src, sx, sy], i) => {
      const x = b.x + 6 + (i % 2) * (w * k + 10), y = b.y + 6 + Math.floor(i / 2) * (h * k + 8)
      gg.fillStyle = '#5b8c54'
      gg.fillRect(x, y, w * k, h * k)
      gg.drawImage(src, sx, sy, w, h, x, y, w * k, h * k)
    })
  })
  card('scale-1x', 'Rig/Parts', 'Game scale: 1× on the field', 'The five peoples and the five faces at the density the battle draws them, with the CC0 goblins and knight. Judge what reads at a glance.', (gg, b) => {
    const [gc, g2] = ground(b.w, b.h, 1, postOf(), -20)
    refFrame(g2, REFS.torch, 6, 0, 40, 120)
    RACES.forEach((r, i) => hero(g2, F(BASE_KIT[r]), 110 + i * 82, 110, 1))
    FACES.forEach((fc, i) => hero(g2, F(fc.look), 110 + i * 82, 236, 1))
    refFrame(g2, REFS.knight, 6, 0, 40, 246)
    gg.drawImage(gc, b.x, b.y)
  })
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
  const pawnSheet = await img('node_modules/.cache/cc0-pack/Factions/Knights/Troops/Pawn/Blue/Pawn_Blue.png')
  GRASS = await img('assets/sprites/tinyswords/grass.png')
  REFS = { torch: torch!, tnt: tnt!, knight: knight!, tower, pawn: trimmedCell(pawnSheet!, 0, 0) }
  POST_IMG = Object.fromEntries(await Promise.all(DOCK_ORDER.map(async (id) => [id, await img(`node_modules/.cache/hero-posts/${POST_SCENE[id]}.png`)] as const)))
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
  run('faces', faces)
  run('zoom', zoom)
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
    cards: CARDS.map((cd) => ({ id: cd.id, group: cd.group, people: cd.people, title: cd.title, caption: cd.caption, file: cd.file, url: cd.canvas.toDataURL('image/png'), frames: cd.frames, delays: cd.delays })),
  }
  w.__heroReady = true
}

setActiveTheme('tinyswords')
preloadSprites()
onSpritesReady(() => {
  // the terrain bake lands lazily: build once it has
  void build().then(() => setTimeout(() => void build(), 900))
})
