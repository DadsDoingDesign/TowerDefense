/**
 * held-gear-cards — the review cards of the held-gear fix (Oct 2026; the
 * designer: "When an item is equipped the animation on the map doesn't move
 * the item, it stays still while the character moves which looks odd").
 * From frame shots of the real draw code (`scripts/held-gear-shots.mjs` over
 * `harness/kit.html?held=1`, taken before and after the fix):
 *
 *   - held-gear-before-after.png (≤ 700 px wide): each holding hand through
 *     its six frames at 3×, before | after — before, the fist bobs out from
 *     under a still item; after, the item rides the fist;
 *   - held-gear-idle.webp: the idle loop of three kits at 2×, at the field's
 *     own cadence (6 fps), before over after.
 *
 *   node scripts/held-gear-shots.mjs <before> 1   (on the old build)
 *   node scripts/held-gear-shots.mjs <after> 1
 *   npx tsx scripts/held-gear-cards.ts <before> <after>
 */
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const [BEFORE, AFTER] = process.argv.slice(2).map((p) => resolve(p))
const OUT = join(resolve(import.meta.dirname, '..'), 'docs', 'ui-audit-2026-10', 'held-gear')
mkdirSync(OUT, { recursive: true })
const W = 700
const BG = '#1a1f2b'
/** The harness canvas's hero origin (`kit.ts` BOX for `?held=1`), in its px at scale 1. */
const ORIGIN = { x: 64, y: 112 }
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const text = (s: string, x: number, y: number, size = 15, fill = '#e8e2d2', weight = 600) =>
  `<text x="${x}" y="${y}" fill="${fill}" font-family="sans-serif" font-weight="${weight}" font-size="${size}">${esc(s)}</text>`
type Layer = { input: Buffer; left: number; top: number }

/** One frame's crop round (cx, cy) — origin px — `w` × `h` logical, at `k`×, nearest-neighbour. */
async function crop(dir: string, kit: string, frame: string, cx: number, cy: number, w: number, h: number, k: number): Promise<Buffer> {
  return sharp(join(dir, kit, `${frame}.png`))
    .extract({ left: ORIGIN.x + cx - Math.floor(w / 2), top: ORIGIN.y + cy - Math.floor(h / 2), width: w, height: h })
    .resize(w * k, h * k, { kernel: 'nearest' })
    .png()
    .toBuffer()
}

// ---- the card: each holding hand, frame by frame
{
  /** kit (shot dir), strip, the hand's frame-0 point + where the item reaches, label. */
  /** `fist`: the hand's place on idle frame 0 (the rig's), ticked on every cell's edges as a still reference. */
  const CASES: { kit: string; strip: 'idle' | 'atk'; cx: number; cy: number; fist?: [number, number]; label: string }[] = [
    { kit: 'caster-staff', strip: 'idle', cx: 26, cy: -18, fist: [20, -13], label: 'Caster · Staff, right hand (idle)' },
    { kit: 'caster-wand', strip: 'idle', cx: 26, cy: -18, fist: [20, -13], label: 'Caster · Wand, right hand (idle)' },
    { kit: 'caster-wand-tome', strip: 'idle', cx: -20, cy: -16, fist: [-18, -12], label: 'Caster · Tome, left hand (idle)' },
    { kit: 'archer-bow-quiver', strip: 'idle', cx: -24, cy: -16, fist: [-24, -11], label: 'Archer · Quiver, left hand (idle)' },
    { kit: 'caster-no-weapon-tome', strip: 'atk', cx: -32, cy: -16, label: 'Caster · Tome through the hammer swing (attack strip)' },
    { kit: 'knight-sword-tome', strip: 'idle', cx: -26, cy: -22, label: 'Knight · Tome (its own rebuilt-body grips: unchanged)' },
  ]
  const CW = 36
  const CH = 30
  const K = 3
  const GAP = 4
  const left = Math.round((W - (6 * CW * K + 5 * GAP)) / 2)
  const layers: Layer[] = []
  let svg =
    text('Held gear moves with the hand · before | after', 16, 30, 21, '#ffffff', 700) +
    text('The real draw code, six frames side by side, 3×. Before: the fist bobs out', 16, 52, 13, '#c9cbbf', 400) +
    text('from under a still item. After: the item rides the fist, frame by frame.', 16, 69, 13, '#c9cbbf', 400) +
    text('Gold ticks on each cell’s edges: where the fist is on frame 0.', 16, 86, 13, '#c9cbbf', 400)
  let y = 100
  for (const c of CASES) {
    svg += text(c.label, 16, y + 14, 14, '#ffe46b')
    y += 22
    for (const [tag, dir] of [['before', BEFORE], ['after', AFTER]] as const) {
      svg += text(tag, left, y + 12, 12, tag === 'after' ? '#9fe08a' : '#e08a8a', 700)
      y += 16
      for (let f = 0; f < 6; f++) {
        const frame = `${c.strip}-${f}`
        if (!existsSync(join(dir, c.kit, `${frame}.png`))) continue
        const x = left + f * (CW * K + GAP)
        layers.push({ input: await crop(dir, c.kit, frame, c.cx, c.cy, CW, CH, K), left: x, top: y })
        if (c.fist) {
          // The frame-0 fist, as px of the 3× cell: ticks on the left and bottom edges.
          const fx = (c.fist[0] - (c.cx - Math.floor(CW / 2))) * K
          const fy = (c.fist[1] - (c.cy - Math.floor(CH / 2))) * K
          svg += `<rect x="${x}" y="${y + fy}" width="5" height="${K}" fill="#ffd34d"/><rect x="${x + CW * K - 5}" y="${y + fy}" width="5" height="${K}" fill="#ffd34d"/>`
          svg += `<rect x="${x + fx}" y="${y}" width="${K}" height="5" fill="#ffd34d"/><rect x="${x + fx}" y="${y + CH * K - 5}" width="${K}" height="5" fill="#ffd34d"/>`
        }
      }
      y += CH * K + 8
    }
    y += 6
  }
  const file = join(OUT, 'held-gear-before-after.png')
  await sharp({ create: { width: W, height: y, channels: 4, background: BG } })
    .composite([...layers, { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}">${svg}</svg>`), left: 0, top: 0 }])
    .png({ compressionLevel: 9 })
    .toFile(file)
  console.log('  wrote', file)
}

// ---- the loop: three kits, before over after, at the field's 6 fps
{
  const KITS = [
    ['caster-wand-tome', 'Wand + Tome'],
    ['caster-staff', 'Staff'],
    ['archer-bow-quiver', 'Bow + Quiver'],
  ] as const
  const FW = 96
  const FH = 84
  const K = 2
  const GAP = 12
  const left = Math.round((W - (KITS.length * FW * K + (KITS.length - 1) * GAP)) / 2)
  const rowH = FH * K
  const H = 40 + 2 * (rowH + 26)
  const frames: Buffer[] = []
  for (let f = 0; f < 6; f++) {
    const layers: Layer[] = []
    let svg = text('Idle loop, 2× · top: before · bottom: after', 16, 26, 16, '#ffffff', 700)
    let y = 40
    for (const [tag, dir] of [['before', BEFORE], ['after', AFTER]] as const) {
      KITS.forEach(([, name], i) => {
        svg += text(`${tag} · ${name}`, left + i * (FW * K + GAP), y + 14, 12, tag === 'after' ? '#9fe08a' : '#e08a8a', 700)
      })
      y += 22
      for (const [i, [kit]] of KITS.entries()) layers.push({ input: await crop(dir, kit, `idle-${f}`, 0, -30, FW, FH, K), left: left + i * (FW * K + GAP), top: y })
      y += rowH + 4
    }
    frames.push(
      await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
        .composite([...layers, { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svg}</svg>`), left: 0, top: 0 }])
        .png()
        .toBuffer(),
    )
  }
  const file = join(OUT, 'held-gear-idle.webp')
  await sharp(frames, { join: { animated: true } }).webp({ lossless: true, effort: 6, loop: 0, delay: Array(6).fill(167) }).toFile(file)
  console.log('  wrote', file)
}
