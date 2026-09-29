/**
 * Extract paper-doll attach points from marker-pixel layers.
 *
 * ## Why a PNG and not a table
 *
 * Gear has to sit in a hand that moves every frame. Hand-maintaining those
 * coordinates works exactly once — the first time the artist nudges a sprite,
 * the table is wrong and nothing warns you, because a weapon floating 2px off
 * a fist still renders. So the anchor lives where the art lives: the artist
 * adds a layer in Aseprite, drops one marker pixel per frame, and exports it
 * next to the strip. Moving the hand moves the anchor, always.
 *
 * ## The format
 *
 * For every `<role>_<anim>.png` an optional `<role>_<anim>_anchors.png` of
 * identical dimensions, transparent except for up to three marker pixels per
 * frame cell:
 *
 *   magenta #FF00FF  main-hand grip
 *   cyan    #00FFFF  off-hand grip
 *   yellow  #FFFF00  weapon tip (enchant particle origin)
 *
 * Gear sheets use the same convention under `gear_<name>_anchors.png`, where
 * magenta is the grip — the point that lands on the hero's hand — and yellow
 * is the tip.
 *
 * Exact colours, full alpha. Anything else is ignored, so the artist can keep
 * a dimmed reference copy of the body on the layer beneath without disturbing
 * the read.
 *
 * Usage:
 *   npm run anchors          rewrite src/game/render/anchors.generated.ts
 *   npm run anchors:check    exit 1 if that file is stale (build guard)
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const PACK = process.argv.find((a) => a.startsWith('--pack='))?.slice(7) ?? 'fieldwatch'
const CHECK = process.argv.includes('--check')
const SPRITES = join('public', 'assets', 'sprites', PACK)
const OUT = join('src', 'game', 'render', 'anchors.generated.ts')

/** Frame counts must match ANIM_FRAMES in src/game/render/anim.ts. */
const ANIM_FRAMES: Record<string, number> = {
  fighter_idle: 6, fighter_atk: 6,
  rogue_idle: 6, rogue_atk: 8,
  mystic_idle: 6, mystic_atk: 6,
}
/** Gear strips are one cell per pose — keep in sync with GEAR_POSES. */
const GEAR_POSE_CELLS = 5

interface Anchor { mx: number; my: number; ox: number; oy: number; tx: number; ty: number }

const MARKERS = {
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
function scan(data: Buffer, w: number, h: number, cells: number): { anchors: Anchor[]; errors: string[] } {
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

async function main(): Promise<void> {
  if (!existsSync(SPRITES)) {
    console.log(`anchors: no pack at ${SPRITES} yet — nothing to extract.`)
    if (!CHECK) writeOut({})
    return
  }

  const table: Record<string, Anchor[]> = {}
  const problems: string[] = []

  const files = readdirSync(SPRITES).filter((f) => f.endsWith('_anchors.png'))
  for (const file of files.sort()) {
    const strip = file.replace(/_anchors\.png$/, '')
    const cells = strip.startsWith('gear_') || strip.startsWith('body_')
      ? GEAR_POSE_CELLS
      : ANIM_FRAMES[strip]
    if (!cells) {
      problems.push(`${file}: no frame count known for "${strip}"`)
      continue
    }

    const img = sharp(join(SPRITES, file))
    const meta = await img.metadata()
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })

    // The marker layer must match its strip exactly or the cell maths drift.
    const source = join(SPRITES, `${strip}.png`)
    if (existsSync(source)) {
      const sm = await sharp(source).metadata()
      if (sm.width !== meta.width || sm.height !== meta.height) {
        problems.push(`${file}: ${meta.width}x${meta.height} does not match ${strip}.png ${sm.width}x${sm.height}`)
        continue
      }
    }

    const { anchors, errors } = scan(data, info.width, info.height, cells)
    for (const e of errors) problems.push(`${file}: ${e}`)
    table[strip] = anchors
  }

  if (problems.length) {
    console.error('anchors: problems found\n  ' + problems.join('\n  '))
    process.exit(1)
  }

  const next = render(table)
  if (CHECK) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
    if (current.trim() !== next.trim()) {
      console.error(
        `anchors: ${OUT} is stale — ${Object.keys(table).length} strip(s) on disk disagree with it.\n` +
        `Run \`npm run anchors\` and commit the result.`,
      )
      process.exit(1)
    }
    console.log(`anchors: up to date (${Object.keys(table).length} strips).`)
    return
  }

  writeFileSync(OUT, next)
  console.log(`anchors: wrote ${Object.keys(table).length} strip(s) to ${OUT}.`)
}

function writeOut(table: Record<string, Anchor[]>): void {
  writeFileSync(OUT, render(table))
}

function render(table: Record<string, Anchor[]>): string {
  const body = Object.keys(table).length === 0
    ? '{}'
    : `{\n${Object.entries(table)
        .map(([k, v]) => `  ${JSON.stringify(k)}: [\n${v
          .map((a) => `    { mx: ${a.mx}, my: ${a.my}, ox: ${a.ox}, oy: ${a.oy}, tx: ${a.tx}, ty: ${a.ty} },`)
          .join('\n')}\n  ],`)
        .join('\n')}\n}`
  return `/**
 * GENERATED — do not edit by hand.
 *
 * Written by \`npm run anchors\`, which reads the \`*_anchors.png\` marker layers
 * in the active pack. \`npm run anchors:check\` fails the build if this file and
 * the PNGs disagree, the same guard \`scripts/fw-icons.ts\` puts on the icon
 * atlas.
 *
 * Empty until the first hero art lands. An empty table is not an error: the
 * compositor falls back to drawing the body alone, so the game renders
 * un-geared rather than not at all.
 */
import type { AnchorTable } from './anchors'

export const ANCHORS: AnchorTable = ${body}
`
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
