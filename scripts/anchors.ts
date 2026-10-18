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
 * ## The body layer's torsos
 *
 * The same run measures the tunic of every frame of the hero strips in
 * `TORSO_PACKS` (Tiny Swords: no marker layers, so the art itself is read —
 * `measureTorsos`) into `bodyAnchors.generated.ts`, and fails when any body
 * piece, dressed on any frame, would paint outside its hero cell
 * (`bodyFitProblems`).
 *
 * Usage:
 *   npm run anchors          rewrite src/game/render/anchors.generated.ts
 *                            and src/game/render/bodyAnchors.generated.ts
 *   npm run anchors:check    exit 1 if either file is stale (build guard)
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { ANIM_FRAMES } from '../src/game/render/anim'
import { GEAR_POSE_CELLS } from '../src/game/render/anchors'
import type { Torso } from '../src/game/render/bodyLayer'
import { bareStrip, cutAndFill, type StripFill } from '../src/game/render/gearMarks'
import { fillProblems, renderShieldFill, SHIELD_STRIPS, shieldFills, type RawStrip } from './shield-fill-lib'
import {
  bodyFitProblems,
  gearFitProblems,
  measureTorsos,
  opaqueBounds,
  render,
  renderTorsos,
  scan,
  TORSO_PACKS,
  type Anchor,
  type GearInfo,
  type HeroStripInfo,
} from './anchors-lib'

const CHECK = process.argv.includes('--check')
const ROOT = join('public', 'assets', 'sprites')
const OUT = join('src', 'game', 'render', 'anchors.generated.ts')
const BODY_OUT = join('src', 'game', 'render', 'bodyAnchors.generated.ts')
const FILL_OUT = join('src', 'game', 'render', 'shieldFill.generated.ts')

/**
 * Rebuild the knight's body under its painted shield (`shield-fill-lib`), per
 * pack in `SHIELD_STRIPS`, and measure the rebuilt tunic of each strip into
 * `torsos` as `bareStrip(strip)` — the table the body layer dresses a cut
 * knight from. Appends to `problems`.
 */
async function scanShields(torsos: Record<string, Record<string, Torso[]>>, problems: string[]): Promise<Record<string, Record<string, StripFill>>> {
  const out: Record<string, Record<string, StripFill>> = {}
  for (const [pack, names] of Object.entries(SHIELD_STRIPS)) {
    const strips: RawStrip[] = []
    for (const name of names) {
      const frames = ANIM_FRAMES[name]
      const file = join(ROOT, pack, `${name}.png`)
      if (!frames || !existsSync(file)) {
        problems.push(`${pack}/${name}: no strip or frame count`)
        continue
      }
      const art = await raw(file)
      strips.push({ name, data: art.data, w: art.w, h: art.h, frames })
    }
    const fills = shieldFills(strips)
    out[pack] = {}
    for (const s of strips) {
      const { fill } = fills[s.name]
      out[pack][s.name] = fill
      for (const p of fillProblems(`${pack}/${s.name}`, s, fill)) problems.push(p)
      const bare = new Uint8Array(s.data)
      cutAndFill(bare, s.w, s.h, s.frames, fill)
      const { torsos: t, errors } = measureTorsos(bare, s.w, s.h, s.frames)
      const name = bareStrip(s.name)
      for (const e of errors) problems.push(`${pack}/${name}: ${e}`)
      for (const p of bodyFitProblems(`${pack}/${name}`, bare, s.w, s.h, t)) problems.push(p)
      ;(torsos[pack] ??= {})[name] = t
    }
  }
  return out
}

/** Measure every torso strip of every pack in `TORSO_PACKS`; appends to `problems`. */
async function scanTorsos(problems: string[]): Promise<Record<string, Record<string, Torso[]>>> {
  const out: Record<string, Record<string, Torso[]>> = {}
  for (const [pack, strips] of Object.entries(TORSO_PACKS)) {
    out[pack] = {}
    for (const strip of strips) {
      const frames = ANIM_FRAMES[strip]
      const file = join(ROOT, pack, `${strip}.png`)
      if (!frames || !existsSync(file)) {
        problems.push(`${pack}/${strip}: no strip or frame count`)
        continue
      }
      const art = await raw(file)
      const { torsos, errors } = measureTorsos(art.data, art.w, art.h, frames)
      for (const e of errors) problems.push(`${pack}/${strip}: ${e}`)
      for (const p of bodyFitProblems(`${pack}/${strip}`, art.data, art.w, art.h, torsos)) problems.push(p)
      out[pack][strip] = torsos
    }
  }
  return out
}

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
  const torsos = await scanTorsos(problems)
  const fills = await scanShields(torsos, problems)

  if (problems.length) {
    console.error('anchors: problems found\n  ' + problems.join('\n  '))
    process.exit(1)
  }

  const count = Object.values(packs).reduce((n, t) => n + Object.keys(t).length, 0)
  const bodyCount = Object.values(torsos).reduce((n, t) => n + Object.keys(t).length, 0)
  const next = render(packs)
  const nextBody = renderTorsos(torsos)
  const nextFill = renderShieldFill(fills)
  const fillCount = Object.values(fills).reduce((n, t) => n + Object.keys(t).length, 0)
  if (CHECK) {
    for (const [file, want, n] of [[OUT, next, count], [BODY_OUT, nextBody, bodyCount], [FILL_OUT, nextFill, fillCount]] as const) {
      const current = existsSync(file) ? readFileSync(file, 'utf8') : ''
      if (current.trim() !== want.trim()) {
        console.error(`anchors: ${file} is stale — ${n} strip(s) on disk disagree with it.\n` + 'Run `npm run anchors` and commit the result.')
        process.exit(1)
      }
    }
    console.log(
      `anchors: up to date (${count} strips in ${Object.keys(packs).length} pack(s), ${bodyCount} torso strip(s), ${fillCount} shield-fill strip(s)); all gear and every body piece fits its cells, and every rebuilt body is whole.`,
    )
    return
  }

  writeFileSync(OUT, next)
  writeFileSync(BODY_OUT, nextBody)
  writeFileSync(FILL_OUT, nextFill)
  console.log(
    `anchors: wrote ${count} strip(s) in ${Object.keys(packs).length} pack(s) to ${OUT}, ${bodyCount} torso strip(s) to ${BODY_OUT}, and ${fillCount} shield-fill strip(s) to ${FILL_OUT}.`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
