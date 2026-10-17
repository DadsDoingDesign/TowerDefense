/**
 * The pure half of `scripts/anchors.ts`: marker scanning, the gear-fits-cell
 * check and the generated-file renderer. Split out so `tests/` can drive them
 * on synthetic buffers without the script's filesystem walk running on import.
 */
import { poseIndexFor } from '../src/game/render/anchors'
import { BODY_KEYS, dressPixels, TUNIC_DARK, TUNIC_MID, type Torso } from '../src/game/render/bodyLayer'

export interface Anchor { mx: number; my: number; ox: number; oy: number; tx: number; ty: number }

export const MARKERS = {
  main: [255, 0, 255],
  off: [0, 255, 255],
  tip: [255, 255, 0],
} as const

/**
 * Find each marker's position per frame cell.
 *
 * Scans once and bins by cell rather than cropping per frame: a strip is at
 * most a few hundred px wide and one pass keeps the "two markers of the same
 * colour in one cell" case detectable, which a per-cell early-exit would hide.
 */
export function scan(data: Uint8Array, w: number, h: number, cells: number): { anchors: Anchor[]; errors: string[] } {
  const cw = Math.round(w / cells)
  const found: Record<keyof typeof MARKERS, ({ x: number; y: number } | null)[]> = {
    main: Array(cells).fill(null),
    off: Array(cells).fill(null),
    tip: Array(cells).fill(null),
  }
  const errors: string[] = []

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      if (data[o + 3] !== 255) continue
      const [r, g, b] = [data[o], data[o + 1], data[o + 2]]
      for (const [name, [mr, mg, mb]] of Object.entries(MARKERS)) {
        if (r !== mr || g !== mg || b !== mb) continue
        const cell = Math.floor(x / cw)
        if (cell >= cells) continue
        const key = name as keyof typeof MARKERS
        if (found[key][cell]) {
          errors.push(`two ${name} markers in cell ${cell}`)
          continue
        }
        // Store cell-relative, which is what the compositor indexes by.
        found[key][cell] = { x: x - cell * cw, y }
      }
    }
  }

  const anchors: Anchor[] = []
  for (let c = 0; c < cells; c++) {
    const m = found.main[c]
    const off = found.off[c]
    const tip = found.tip[c]
    if (!m) errors.push(`no main-hand marker in cell ${c}`)
    anchors.push({
      mx: m?.x ?? Math.round(cw / 2), my: m?.y ?? Math.round(h / 2),
      // An off-hand or tip marker is optional: a two-hander has no off-hand
      // grip and a shield has no tip. Falling back to the main grip keeps the
      // layer attached rather than flinging it to 0,0.
      ox: off?.x ?? m?.x ?? Math.round(cw / 2), oy: off?.y ?? m?.y ?? Math.round(h / 2),
      tx: tip?.x ?? m?.x ?? Math.round(cw / 2), ty: tip?.y ?? 0,
    })
  }
  return { anchors, errors }
}

/** Opaque-pixel bounding box of one cell, cell-relative; null for an empty cell. */
export interface Bounds { x0: number; y0: number; x1: number; y1: number }

export function opaqueBounds(data: Uint8Array, w: number, h: number, cells: number): (Bounds | null)[] {
  const cw = Math.round(w / cells)
  const out: (Bounds | null)[] = []
  for (let c = 0; c < cells; c++) {
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < cw; x++) {
        if (data[(y * w + c * cw + x) * 4 + 3] === 0) continue
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
    out.push(x1 < 0 ? null : { x0, y0, x1, y1 })
  }
  return out
}

export interface HeroStripInfo {
  /** e.g. `fighter_atk`. The animation is the part after the last `_`. */
  name: string
  cellW: number
  cellH: number
  anchors: readonly Anchor[]
}

export interface GearInfo {
  /** e.g. `gear_sword`. */
  role: string
  /** Grip per pose cell (the `mx`/`my` of the gear's own anchor layer). */
  grips: readonly Anchor[]
  bounds: readonly (Bounds | null)[]
}

/**
 * Every (hero frame, gear, hand) where the gear's opaque pixels, placed with
 * its grip on that hand, would leave the hero's cell.
 *
 * The compositor clips each frame to its own cell, so an overhang is not a
 * bleed any more — it is a weapon silently cut off. Either way the art is
 * wrong, and this is where it gets caught: at build time, not by eye. Both
 * hands are checked for every gear piece, because a one-hander may be
 * carried in the off hand (a knife or wand always; a sword, axe, rod or sceptre
 * under the Twinblade Harness — `items.heroSlotsFor`).
 */
export function gearFitProblems(heroes: readonly HeroStripInfo[], gear: readonly GearInfo[]): string[] {
  const problems: string[] = []
  for (const h of heroes) {
    const anim = h.name.slice(h.name.lastIndexOf('_') + 1)
    const frames = h.anchors.length
    for (let f = 0; f < frames; f++) {
      const a = h.anchors[f]
      const pose = poseIndexFor(anim, f, frames)
      for (const g of gear) {
        const b = g.bounds[pose]
        const grip = g.grips[pose]
        if (!b || !grip) continue
        for (const [hand, hx, hy] of [['main', a.mx, a.my], ['off', a.ox, a.oy]] as const) {
          const L = hx - grip.mx + b.x0
          const R = hx - grip.mx + b.x1
          const T = hy - grip.my + b.y0
          const B = hy - grip.my + b.y1
          if (L < 0 || T < 0 || R >= h.cellW || B >= h.cellH) {
            problems.push(
              `${g.role} in the ${hand} hand of ${h.name} frame ${f} (pose ${pose}) spans ` +
                `x ${L}..${R}, y ${T}..${B} — outside the ${h.cellW}x${h.cellH} cell`,
            )
          }
        }
      }
    }
  }
  return problems
}

/** The generated module, keyed by pack so one pack's anchors never reach another's cells. */
export function render(packs: Record<string, Record<string, Anchor[]>>): string {
  const strip = (v: Anchor[]) =>
    v.map((a) => `      { mx: ${a.mx}, my: ${a.my}, ox: ${a.ox}, oy: ${a.oy}, tx: ${a.tx}, ty: ${a.ty} },`).join('\n')
  const table = (t: Record<string, Anchor[]>) =>
    `{\n${Object.keys(t)
      .sort()
      .map((k) => `    ${JSON.stringify(k)}: [\n${strip(t[k])}\n    ],`)
      .join('\n')}\n  }`
  const names = Object.keys(packs).sort()
  const body = names.length === 0 ? '{}' : `{\n${names.map((p) => `  ${JSON.stringify(p)}: ${table(packs[p])},`).join('\n')}\n}`
  return `/**
 * GENERATED — do not edit by hand.
 *
 * Written by \`npm run anchors\`, which reads the \`*_anchors.png\` marker layers
 * in every sprite pack. \`npm run anchors:check\` fails the build if this file
 * and the PNGs disagree, the same guard \`scripts/fw-icons.ts\` puts on the icon
 * atlas.
 *
 * Keyed by PACK first: anchors are cell coordinates, and one pack's cells are
 * not another's (fieldwatch's 64px idle cell against Tiny Swords' 84px). A pack
 * with no entry draws its heroes un-geared rather than wrongly geared.
 */
import type { AnchorPacks } from './anchors'

export const ANCHORS: AnchorPacks = ${body}
`
}

/* ---- the body layer: each frame's tunic, measured off the art ------------- */

/**
 * The hero strips whose tunic is measured, per pack: the packs whose figures
 * wear the tunic inks (`bodyLayer.TUNIC_MID` / `TUNIC_DARK`). Only Tiny Swords.
 */
export const TORSO_PACKS: Readonly<Record<string, readonly string[]>> = {
  tinyswords: ['fighter_idle', 'fighter_atk', 'rogue_idle', 'rogue_atk', 'mystic_idle', 'mystic_atk'],
}

/**
 * Find the tunic in every frame of a hero strip.
 *
 * The tunic's two inks also paint the knight's plume and shield, the archer's
 * plume and bow and the sword's grip wrap, so the tunic is told apart by what
 * it is: per frame, the 4-connected patches of those two inks that are big
 * (≥ 60 px) and a third or more of the dark ink (the plume, the shield's
 * stripes and the bow are mostly the mid ink), and of those the BOTTOM-most —
 * the body is the patch nearest the feet. `feet` is the lowest opaque row in
 * the tunic's columns (the ground shadow is translucent, so never counted).
 */
export function measureTorsos(data: Uint8Array, w: number, h: number, frames: number): { torsos: Torso[]; errors: string[] } {
  const cw = Math.round(w / frames)
  const torsos: Torso[] = []
  const errors: string[] = []
  const tunic = (p: number) => {
    const o = p * 4
    if (data[o + 3] < 128) return 0
    const c = (data[o] << 16) | (data[o + 1] << 8) | data[o + 2]
    return c === TUNIC_MID ? 1 : c === TUNIC_DARK ? 2 : 0
  }
  for (let f = 0; f < frames; f++) {
    const fx = f * cw
    const seen = new Uint8Array(w * h)
    let best: { px: number[]; y1: number } | null = null
    for (let y = 0; y < h; y++)
      for (let x = fx; x < fx + cw; x++) {
        const p = y * w + x
        if (seen[p] || !tunic(p)) continue
        const px: number[] = []
        let dark = 0
        let y1 = 0
        const stack = [p]
        seen[p] = 1
        while (stack.length) {
          const q = stack.pop()!
          px.push(q)
          if (tunic(q) === 2) dark++
          const qx = q % w
          const qy = (q - qx) / w
          y1 = Math.max(y1, qy)
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const X = qx + dx
            const Y = qy + dy
            if (X < fx || X >= fx + cw || Y < 0 || Y >= h) continue
            const r = Y * w + X
            if (seen[r] || !tunic(r)) continue
            seen[r] = 1
            stack.push(r)
          }
        }
        if (px.length < 60 || dark / px.length < 0.3) continue
        if (!best || y1 > best.y1 || (y1 === best.y1 && px.length > best.px.length)) best = { px, y1 }
      }
    if (!best) {
      errors.push(`no tunic in frame ${f}`)
      torsos.push({ x0: 0, y0: 0, x1: 0, y1: 0, feet: 0, spans: [] })
      continue
    }
    const rows = new Map<number, number[]>()
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -1
    let y1 = -1
    for (const q of best.px) {
      const x = (q % w) - fx
      const y = Math.floor(q / w)
      if (!rows.has(y)) rows.set(y, [])
      rows.get(y)!.push(x)
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      y0 = Math.min(y0, y)
      y1 = Math.max(y1, y)
    }
    const spans: number[] = []
    for (const y of [...rows.keys()].sort((a, b) => a - b)) {
      const xs = rows.get(y)!.sort((a, b) => a - b)
      let a = xs[0]
      for (let i = 1; i <= xs.length; i++)
        if (i === xs.length || xs[i] !== xs[i - 1] + 1) {
          spans.push(y, a, xs[i - 1])
          a = xs[i]
        }
    }
    let feet = y1
    for (let y = h - 1; y > y1 && feet === y1; y--)
      for (let x = x0; x <= x1; x++)
        if (data[(y * w + fx + x) * 4 + 3] >= 128) {
          feet = y
          break
        }
    torsos.push({ x0, y0, x1, y1, feet, spans })
  }
  return { torsos, errors }
}

/**
 * Every piece whose dressing of this strip would paint outside a frame's cell
 * (or paint nothing) — the body layer's twin of {@link gearFitProblems}. It
 * dresses a copy of the real strip in every piece and asks the dresser what it
 * had to clip.
 */
export function bodyFitProblems(name: string, data: Uint8Array, w: number, h: number, torsos: readonly Torso[]): string[] {
  const problems: string[] = []
  for (const key of BODY_KEYS) {
    const { changed, overflow } = dressPixels(new Uint8Array(data), w, h, torsos, key)
    if (overflow) problems.push(`body ${key} on ${name}: ${overflow} px outside the hero cell`)
    if (!changed) problems.push(`body ${key} on ${name}: draws nothing`)
  }
  return problems
}

/** The generated torso module, keyed by pack. */
export function renderTorsos(packs: Record<string, Record<string, Torso[]>>): string {
  const frame = (t: Torso) => `      { x0: ${t.x0}, y0: ${t.y0}, x1: ${t.x1}, y1: ${t.y1}, feet: ${t.feet}, spans: [${t.spans.join(', ')}] },`
  const table = (t: Record<string, Torso[]>) =>
    `{\n${Object.keys(t)
      .sort()
      .map((k) => `    ${JSON.stringify(k)}: [\n${t[k].map(frame).join('\n')}\n    ],`)
      .join('\n')}\n  }`
  const names = Object.keys(packs).sort()
  const body = names.length === 0 ? '{}' : `{\n${names.map((p) => `  ${JSON.stringify(p)}: ${table(packs[p])},`).join('\n')}\n}`
  return `/**
 * GENERATED — do not edit by hand.
 *
 * Written by \`npm run anchors\` (\`scripts/anchors-lib.measureTorsos\`): the
 * tunic of every frame of every measured hero strip, as row spans
 * \`[y, xa, xb, …]\` in the strip cell's own px — what the body layer
 * (\`bodyLayer.ts\`) re-inks and dresses. \`npm run anchors:check\` fails the
 * build if this file and the PNGs disagree, or if any body piece on any frame
 * would paint outside its hero cell.
 */
import type { TorsoPacks } from './bodyLayer'

export const BODY_TORSOS: TorsoPacks = ${body}
`
}
