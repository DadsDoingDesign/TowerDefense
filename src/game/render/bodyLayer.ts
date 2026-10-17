/**
 * The hero's BODY piece, worn on the field.
 *
 * The designer: a hero's look must "always reflect what they have equipped,
 * not set classes". The weapon and the off hand are carried as atlas cells in
 * the fists (`gearMarks.ts`); this is the third slot. The Tiny Swords figures
 * are chibi — a big head over a small teal tunic — and ship no gear strips or
 * anchors (HANDOFF §6.4), so a body piece cannot be a sprite pasted on: there
 * is no art to paste and no place to paste it.
 *
 * So it is a layer DERIVED FROM THE SPRITE, frame by frame:
 *
 *  - **the torso is measured, not placed**: `npm run anchors` finds the
 *    tunic in every frame of every hero strip (the bottom-most patch of the
 *    tunic's two inks, `scripts/anchors-lib.measureTorsos`) and writes its
 *    pixels as row spans into `bodyAnchors.generated.ts`. `anchors:check`
 *    fails the build if the table is stale or if any piece, on any frame,
 *    would paint outside its hero cell. The layer follows the figure through
 *    its idle bob and its attack strip because every frame has its own torso;
 *  - **the tunic is re-inked** in the piece's colours (its two shades mapped
 *    to the piece's two), keeping every outline pixel the art drew, and
 *  - **the piece changes the silhouette**, because a recolour alone is a few
 *    px at phone scale: plate and its kin get pauldrons and a tasset, a robe a
 *    skirt to the ground, mail a ragged hem and a belt, a cloak a cape BEHIND
 *    the figure (painted only into empty pixels, so the body and anything it
 *    holds stay in front). Added shapes get the pack's 2 px `#161C2E` outline.
 *
 * Every colour is one the piece's own icon cell uses (`scripts/fw-icons.ts`,
 * tested against the atlas), so the tile and the figure agree.
 *
 * No rarity colour: the figure says rarity by the weapon's glint alone.
 *
 * Composited BEFORE the bake, like the gear doll (`loadout.ts`): one canvas
 * per (source strip, piece), kept, so `pixmap()` — which caches by source
 * identity — bakes it once with ONE contour ring round body and armour.
 */
import type { IconKey } from '../data/iconAtlas'
import { BODY_TORSOS } from './bodyAnchors.generated'

/** The body pieces, by their icon cell (`iconAtlas.NOUN_ICON`). */
export const BODY_KEYS = ['mail', 'plate', 'cloth', 'cloak', 'aegis', 'ironheart', 'silkwind'] as const
export type BodyKey = (typeof BODY_KEYS)[number]
export const isBodyKey = (k: IconKey | string | null | undefined): k is BodyKey => !!k && (BODY_KEYS as readonly string[]).includes(k)

/**
 * One frame's tunic, in the strip CELL's own px (generated). `spans` is the
 * mask as row runs, `[y, xa, xb, …]` with xb inclusive; `feet` is the lowest
 * opaque row under it.
 */
export interface Torso {
  x0: number
  y0: number
  x1: number
  y1: number
  feet: number
  spans: readonly number[]
}
export type TorsoPacks = Readonly<Record<string, Readonly<Record<string, readonly Torso[]>>>>

/** The measured torsos of one pack's strip, or null (an unmeasured pack is never dressed). */
export const torsosFor = (pack: string | undefined, strip: string): readonly Torso[] | null => (pack ? BODY_TORSOS[pack]?.[strip] ?? null : null)

/** The pack's tunic inks — the colours `measureTorsos` reads and the dresser maps. */
export const TUNIC_MID = 0x3e8698
export const TUNIC_DARK = 0x404e75
const INK = 0x161c2e

/**
 * Each piece's inks: `fill` and `shade` take the tunic's mid and dark; the rest
 * are its details. All from its icon cell (`fw-icons.ts` PALETTE letters).
 */
export const BODY_INK = {
  mail: { fill: '#bac1c8', shade: '#737f8e', belt: '#b48355', beltShade: '#866353' },
  plate: { fill: '#bac1c8', shade: '#4a6982', shine: '#fffce7' },
  cloth: { fill: '#ccb88d', shade: '#9e8776', shine: '#e1d4bd' },
  cloak: { fill: '#38b251', shade: '#276740', shine: '#95d562', lining: '#b65555', clasp: '#ffed44' },
  aegis: { fill: '#bac1c8', shade: '#4a6982', shine: '#fffce7', rim: '#d08c41', sun: '#ffed44' },
  ironheart: { fill: '#737f8e', shade: '#4a6982', shine: '#737f8e', heart: '#f76666', heartShade: '#87465a', heartShine: '#fffce7' },
  silkwind: { fill: '#775396', shade: '#87465a', shine: '#a8719a', clasp: '#ffed44', claspShade: '#d08c41' },
} as const satisfies Record<BodyKey, Record<string, string>>

const rgb = (hex: string): number => parseInt(hex.slice(1), 16)

/** RGBA pixels, writable — an `ImageData.data` or a test's raw buffer. */
export type Pixels = { [i: number]: number; length: number }

/** What a dress did: pixels changed, and pixels it wanted outside the cell (must be 0). */
export interface DressResult {
  changed: number
  overflow: number
}

/**
 * Dress ONE frame (columns `fx .. fx+cw` of a strip `w` wide) in `key`, in
 * place. `f` / `frames` phase the silk cape's billow. Pure: no DOM.
 */
export function dressFrame(d: Pixels, w: number, h: number, fx: number, cw: number, t: Torso, key: BodyKey, f = 0, frames = 1): DressResult {
  const res: DressResult = { changed: 0, overflow: 0 }
  const at = (x: number, y: number) => (y * w + fx + x) * 4
  const inCell = (x: number, y: number) => x >= 0 && x < cw && y >= 0 && y < h
  const id = (x: number, y: number) => y * cw + x
  const solid = (x: number, y: number) => inCell(x, y) && d[at(x, y) + 3] >= 128
  const colourAt = (x: number, y: number) => {
    const o = at(x, y)
    return (d[o] << 16) | (d[o + 1] << 8) | d[o + 2]
  }
  const put = (x: number, y: number, c: number) => {
    if (!inCell(x, y)) {
      res.overflow++
      return
    }
    const o = at(x, y)
    const r = (c >> 16) & 255
    const g = (c >> 8) & 255
    const b = c & 255
    if (d[o] === r && d[o + 1] === g && d[o + 2] === b && d[o + 3] === 255) return
    d[o] = r
    d[o + 1] = g
    d[o + 2] = b
    d[o + 3] = 255
    res.changed++
  }

  // The tunic mask and its measures.
  const mask = new Set<number>()
  const rowMin = new Map<number, number>()
  const rowMax = new Map<number, number>()
  for (let i = 0; i + 2 < t.spans.length; i += 3) {
    const [y, xa, xb] = [t.spans[i], t.spans[i + 1], t.spans[i + 2]]
    for (let x = xa; x <= xb; x++) mask.add(id(x, y))
    rowMin.set(y, Math.min(rowMin.get(y) ?? Infinity, xa))
    rowMax.set(y, Math.max(rowMax.get(y) ?? -Infinity, xb))
  }
  const ext = (ya: number, yb: number) => {
    let lo = Infinity
    let hi = -Infinity
    for (let y = ya; y <= yb; y++) {
      if (rowMin.has(y)) lo = Math.min(lo, rowMin.get(y)!)
      if (rowMax.has(y)) hi = Math.max(hi, rowMax.get(y)!)
    }
    return lo <= hi ? { lo, hi } : { lo: t.x0, hi: t.x1 }
  }
  const shoulders = ext(t.y0, t.y0 + 3)
  const hem = ext(t.y1 - 1, t.y1)
  const cx = Math.round((t.x0 + t.x1) / 2)
  const cy = Math.round((t.y0 + t.y1) / 2)
  const inMask = (x: number, y: number) => inCell(x, y) && mask.has(id(x, y))

  const ink = BODY_INK[key] as Record<string, string>
  const fill = rgb(ink.fill)
  const shade = rgb(ink.shade)

  // 1 · re-ink the tunic: its mid → fill, its dark → shade; outline pixels kept.
  for (const p of mask) {
    const x = p % cw
    const y = (p - x) / cw
    const c = colourAt(x, y)
    if (c !== TUNIC_MID && c !== TUNIC_DARK) continue
    put(x, y, c === TUNIC_DARK ? shade : fill)
  }

  // Shapes the piece adds, each with the pack's outline.
  const shape = (pixels: Iterable<[number, number, number]>, behind: boolean) => {
    const own = new Set<number>()
    const list: [number, number, number][] = []
    for (const [x, y, c] of pixels) {
      if (!inCell(x, y)) {
        res.overflow++
        continue
      }
      if ((behind && solid(x, y)) || own.has(id(x, y))) continue
      own.add(id(x, y))
      list.push([x, y, c])
    }
    if (!list.length) return
    const wasEmpty = (x: number, y: number) => inCell(x, y) && !solid(x, y) && !own.has(id(x, y))
    // The ring: 1 px all round (over the body too, for a front piece), and a
    // second px wherever it faces empty space — the pack's 2 px contour.
    const ring1 = new Set<number>()
    for (const [x, y] of list)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx
          const Y = y + dy
          if (!inCell(X, Y) || own.has(id(X, Y)) || mask.has(id(X, Y))) continue
          if (behind && solid(X, Y)) continue
          ring1.add(id(X, Y))
        }
    const ring2 = new Set<number>()
    for (const p of ring1) {
      const x = p % cw
      const y = (p - x) / cw
      if (solid(x, y)) continue
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx
        const Y = y + dy
        if (wasEmpty(X, Y) && !ring1.has(id(X, Y)) && !mask.has(id(X, Y))) ring2.add(id(X, Y))
      }
    }
    for (const [x, y, c] of list) put(x, y, c)
    for (const p of [...ring1, ...ring2]) put(p % cw, (p - (p % cw)) / cw, INK)
  }

  /** A shoulder dome, centred on (sx, top + ry), `ry` tall over a flat foot. */
  function* dome(sx: number, top: number, rx: number, ry: number, c: { fill: number; shine: number; shade: number }) {
    for (let y = top; y <= top + ry + 1; y++)
      for (let x = sx - rx; x <= sx + rx; x++) {
        const nx = (x - sx) / rx
        const ny = (y - (top + ry)) / ry
        if (y <= top + ry && nx * nx + ny * ny > 1) continue
        const shine = y <= top + 1 && x < sx
        const low = y === top + ry + 1
        yield [x, y, shine ? c.shine : low ? c.shade : c.fill] as [number, number, number]
      }
  }
  /** A band under the tunic's hem, `rows` deep, cut into `teeth`. */
  function* tasset(rows: number, pick: (x: number, y: number, k: number) => number | null) {
    for (let k = 1; k <= rows; k++)
      for (let x = hem.lo + 1; x <= hem.hi - 1; x++) {
        const c = pick(x, t.y1 + k, k)
        if (c !== null) yield [x, t.y1 + k, c] as [number, number, number]
      }
  }
  /** A cape behind the figure, flaring to the back (left: every figure faces right). */
  function* cape(top: number, flare: number, billow: number, c: { fill: number; shade: number; shine: number; lining?: number }) {
    const bottom = t.feet - 1
    const span = Math.max(1, bottom - top)
    const phase = (2 * Math.PI * f) / Math.max(1, frames)
    for (let y = top; y <= bottom; y++) {
      const k = (y - top) / span
      const wave = billow ? Math.round(billow * Math.sin(phase + k * 4.2)) : 0
      // It hangs behind, so it shows wherever the figure does not: beside the
      // legs on both sides (wider at the back), and between them.
      const left = shoulders.lo - 2 - Math.round(flare * k) - wave
      const right = shoulders.hi + 1 + Math.round(flare * 0.45 * k)
      // The hem lifts toward its back corner when the wind has it.
      for (let x = left; x <= right; x++) {
        const lift = billow ? Math.round(Math.max(0, (left + 8 - x) * 0.6)) : 0
        if (y > bottom - lift) continue
        const outer = x <= left + 2
        const hemRow = y >= bottom - lift - 1
        const lining = c.lining !== undefined && hemRow && x > left + 4
        yield [x, y, lining ? c.lining! : hemRow ? c.shade : outer ? c.shine : c.fill] as [number, number, number]
      }
    }
  }

  // Ironheart's pauldrons and lames are the dark iron, lit by its mid.
  const steel = (k: 'plate' | 'aegis' | 'ironheart') =>
    k === 'ironheart'
      ? { fill: rgb(BODY_INK.ironheart.shade), shine: rgb(BODY_INK.ironheart.fill), shade: INK }
      : { fill: rgb(BODY_INK[k].fill), shine: rgb(BODY_INK[k].shine), shade: rgb(BODY_INK[k].shade) }

  switch (key) {
    case 'mail': {
      // Rings: a 2 px checker of the two steels over the whole shirt.
      const lite = rgb(ink.fill)
      const dark = rgb(ink.shade)
      for (const p of mask) {
        const x = p % cw
        const y = (p - x) / cw
        if (colourAt(x, y) === INK) continue
        put(x, y, ((x >> 1) + (y >> 1)) & 1 ? dark : lite)
      }
      // A leather belt two rows above the hem.
      for (const [dy, c] of [[-3, rgb(ink.belt)], [-2, rgb(ink.beltShade)]] as const) {
        const y = t.y1 + dy
        for (let x = t.x0; x <= t.x1; x++) if (inMask(x, y) && colourAt(x, y) !== INK) put(x, y, c)
      }
      // A ragged hem over the thighs: teeth of rings, 3 and 2 px long.
      shape(tasset(3, (x, _y, k) => (k <= (((x - hem.lo) >> 1) & 1 ? 3 : 2) ? (((x >> 1) + k) & 1 ? dark : lite) : null)), false)
      break
    }
    case 'plate':
    case 'ironheart': {
      const c = steel(key)
      // The breastplate's shine: a 2 px stripe left of centre.
      for (let y = t.y0 + 2; y <= t.y1 - 3; y++)
        for (const x of [cx - 5, cx - 4]) if (inMask(x, y) && colourAt(x, y) !== INK) put(x, y, c.shine)
      // A tasset of two lames, and the pauldrons.
      shape(tasset(3, (_x, _y, k) => (k === 2 ? c.shade : c.fill)), false)
      shape(dome(shoulders.lo, t.y0 - 3, 5, 4, c), false)
      shape(dome(shoulders.hi, t.y0 - 3, 5, 4, c), false)
      if (key === 'ironheart') {
        // The red heart at the chest.
        const H = ['.RR.RR.', 'RWRRRRn', 'RRRRRRn', '.RRRRn.', '..RRn..', '...n...']
        const col = { R: rgb(BODY_INK.ironheart.heart), n: rgb(BODY_INK.ironheart.heartShade), W: rgb(BODY_INK.ironheart.heartShine) } as Record<string, number>
        const hx = cx - 3
        const hy = Math.max(t.y0 + 1, cy - 3)
        H.forEach((row, j) => [...row].forEach((ch, i) => col[ch] !== undefined && put(hx + i, hy + j, col[ch])))
      }
      break
    }
    case 'aegis': {
      const c = steel('aegis')
      const rim = rgb(ink.rim)
      const sun = rgb(ink.sun)
      // A gold rim round the cuirass: tunic pixels on the mask's edge.
      for (const p of mask) {
        const x = p % cw
        const y = (p - x) / cw
        if (colourAt(x, y) === INK) continue
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inMask(x + dx, y + dy) || colourAt(x + dx, y + dy) === INK)
        if (edge) put(x, y, rim)
      }
      // The sun boss: a gold disc with four rays.
      const sx = cx + 1
      const sy = cy
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) put(sx + dx, sy + dy, dx === -1 && dy === -1 ? c.shine : sun)
      for (const [dx, dy] of [[0, -4], [0, 4], [-4, 0], [4, 0]]) if (inMask(sx + dx, sy + dy)) put(sx + dx, sy + dy, sun)
      // Small gold-rimmed shoulder caps.
      const cap = { fill: rim, shine: sun, shade: rgb('#a38250') }
      shape(dome(shoulders.lo, t.y0 - 2, 4, 3, cap), false)
      shape(dome(shoulders.hi, t.y0 - 2, 4, 3, cap), false)
      break
    }
    case 'cloth': {
      // A long skirt to the ground, widening as it falls, with folds.
      const shine = rgb(ink.shine)
      const bottom = t.feet - 2
      function* skirt() {
        for (let y = t.y1 + 1; y <= bottom; y++) {
          const k = y - t.y1
          const lo = hem.lo - Math.min(4, k >> 1)
          const hi = hem.hi + Math.min(4, k >> 1)
          for (let x = lo; x <= hi; x++) {
            const fold = (x - lo) % 6 === 3
            yield [x, y, y >= bottom - 1 ? shade : fold ? shade : x <= lo + 1 ? shine : fill] as [number, number, number]
          }
        }
      }
      shape(skirt(), false)
      break
    }
    case 'cloak':
    case 'silkwind': {
      const silk = key === 'silkwind'
      const c = { fill, shade, shine: rgb(ink.shine), lining: silk ? undefined : rgb(BODY_INK.cloak.lining) }
      shape(cape(t.y0 - 4, silk ? 15 : 11, silk ? 3 : 0, c), true)
      // The clasp at the throat.
      const gold = rgb(ink.clasp)
      const low = silk ? rgb(BODY_INK.silkwind.claspShade) : gold
      const kx = cx + 2
      const ky = t.y0 + 1
      for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) put(kx + dx, ky + dy, dx < 0 || dy < 0 || dx > 1 || dy > 1 ? INK : dy === 0 ? gold : low)
      break
    }
  }
  return res
}

/** Dress every frame of a strip's RGBA pixels in place. */
export function dressPixels(d: Pixels, w: number, h: number, torsos: readonly Torso[], key: BodyKey): DressResult {
  const frames = torsos.length
  const cw = Math.round(w / frames)
  const out: DressResult = { changed: 0, overflow: 0 }
  for (let f = 0; f < frames; f++) {
    const r = dressFrame(d, w, h, f * cw, Math.min(cw, w - f * cw), torsos[f], key, f, frames)
    out.changed += r.changed
    out.overflow += r.overflow
  }
  return out
}

const dressed = new WeakMap<object, Map<BodyKey, HTMLCanvasElement>>()

/**
 * The strip with the body piece on, or the strip itself when there is none to
 * wear or the pack is unmeasured — the same object, so the bake behind an
 * empty body slot is exactly what it was. One canvas per (source, piece),
 * kept: `pixmap()` bakes it once.
 */
export function dressedStrip(
  src: HTMLImageElement | HTMLCanvasElement,
  pack: string | undefined,
  strip: string,
  frames: number,
  key: BodyKey | null,
): HTMLImageElement | HTMLCanvasElement {
  if (!key || typeof document === 'undefined') return src
  const torsos = torsosFor(pack, strip)
  if (!torsos || torsos.length !== frames) return src
  let byKey = dressed.get(src)
  const hit = byKey?.get(key)
  if (hit) return hit
  const w = 'naturalWidth' in src ? src.naturalWidth : src.width
  const h = 'naturalHeight' in src ? src.naturalHeight : src.height
  if (!w || !h) return src
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) return src
  g.drawImage(src, 0, 0)
  const img = g.getImageData(0, 0, w, h)
  dressPixels(img.data, w, h, torsos, key)
  g.putImageData(img, 0, 0)
  if (!byKey) dressed.set(src, (byKey = new Map()))
  byKey.set(key, c)
  return c
}
