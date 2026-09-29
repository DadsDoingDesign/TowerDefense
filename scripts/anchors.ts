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
 * Every pack under `public/assets/sprites/` is scanned, and the table is keyed
 * by pack: anchors are cell coordinates, and applying one pack's to another's
 * cells (fieldwatch's 64px idle cell on Tiny Swords' 84px one) puts the sword
 * in the wrong place rather than nowhere.
 *
 * The run also fails when any gear piece, gripped at any hero anchor, would
 * reach outside that frame's cell — see `gearFitProblems`.
 *
 * Usage:
 *   npm run anchors          rewrite src/game/render/anchors.generated.ts
 *   npm run anchors:check    exit 1 if that file is stale (build guard)
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { ANIM_FRAMES } from '../src/game/render/anim'
import { GEAR_POSE_CELLS } from '../src/game/render/anchors'
import { gearFitProblems, opaqueBounds, render, scan, type Anchor, type GearInfo, type HeroStripInfo } from './anchors-lib'

const CHECK = process.argv.includes('--check')
const ROOT = join('public', 'assets', 'sprites')
const OUT = join('src', 'game', 'render', 'anchors.generated.ts')

const isGear = (strip: string): boolean => strip.startsWith('gear_') || strip.startsWith('body_')

async function raw(file: string) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data: new Uint8Array(data.buffer, data.byteOffset, data.length), w: info.width, h: info.height }
}

/** Scan one pack. Returns its table, and appends to `problems`. */
async function scanPack(pack: string, problems: string[]): Promise<Record<string, Anchor[]>> {
  const dir = join(ROOT, pack)
  const table: Record<string, Anchor[]> = {}
  const heroes: HeroStripInfo[] = []
  const gear: GearInfo[] = []

  const files = readdirSync(dir).filter((f) => f.endsWith('_anchors.png'))
  for (const file of files.sort()) {
    const strip = file.replace(/_anchors\.png$/, '')
    const cells = isGear(strip) ? GEAR_POSE_CELLS : ANIM_FRAMES[strip]
    if (!cells) {
      problems.push(`${pack}/${file}: no frame count known for "${strip}"`)
      continue
    }

    const marks = await raw(join(dir, file))
    // The marker layer must match its strip exactly or the cell maths drift.
    const source = join(dir, `${strip}.png`)
    const art = existsSync(source) ? await raw(source) : null
    if (art && (art.w !== marks.w || art.h !== marks.h)) {
      problems.push(`${pack}/${file}: ${marks.w}x${marks.h} does not match ${strip}.png ${art.w}x${art.h}`)
      continue
    }

    const { anchors, errors } = scan(marks.data, marks.w, marks.h, cells)
    for (const e of errors) problems.push(`${pack}/${file}: ${e}`)
    table[strip] = anchors

    if (strip.startsWith('gear_') && art) {
      gear.push({ role: strip, grips: anchors, bounds: opaqueBounds(art.data, art.w, art.h, cells) })
    } else if (!isGear(strip)) {
      heroes.push({ name: strip, cellW: Math.round(marks.w / cells), cellH: marks.h, anchors })
    }
  }

  for (const p of gearFitProblems(heroes, gear)) problems.push(`${pack}: ${p}`)
  return table
}

async function main(): Promise<void> {
  const packs: Record<string, Record<string, Anchor[]>> = {}
  const problems: string[] = []

  const dirs = existsSync(ROOT)
    ? readdirSync(ROOT).filter((d) => statSync(join(ROOT, d)).isDirectory()).sort()
    : []
  for (const pack of dirs) {
    if (!readdirSync(join(ROOT, pack)).some((f) => f.endsWith('_anchors.png'))) continue
    packs[pack] = await scanPack(pack, problems)
  }

  if (problems.length) {
    console.error('anchors: problems found\n  ' + problems.join('\n  '))
    process.exit(1)
  }

  const count = Object.values(packs).reduce((n, t) => n + Object.keys(t).length, 0)
  const next = render(packs)
  if (CHECK) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
    if (current.trim() !== next.trim()) {
      console.error(
        `anchors: ${OUT} is stale — ${count} strip(s) on disk disagree with it.\n` +
          'Run `npm run anchors` and commit the result.',
      )
      process.exit(1)
    }
    console.log(`anchors: up to date (${count} strips in ${Object.keys(packs).length} pack(s)); all gear fits its cells.`)
    return
  }

  writeFileSync(OUT, next)
  console.log(`anchors: wrote ${count} strip(s) in ${Object.keys(packs).length} pack(s) to ${OUT}.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
