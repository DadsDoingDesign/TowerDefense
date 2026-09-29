/**
 * The pure half of `scripts/anchors.ts`: marker scanning, the gear-fits-cell
 * check and the generated-file renderer. Split out so `tests/` can drive them
 * on synthetic buffers without the script's filesystem walk running on import.
 */
import { poseIndexFor } from '../src/game/render/anchors'

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
 * dual-wielded in the off hand (`heroSlotsFor('oneHand')`).
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
