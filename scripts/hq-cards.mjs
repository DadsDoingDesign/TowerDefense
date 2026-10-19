/**
 * hq-cards — the HQ pass's review cards (`docs/ui-audit-2026-10/hq/`), ~600 px
 * wide, composed from a round of `scripts/hq-shots.mjs` (after) and one taken
 * before the pass.
 *
 *   node scripts/hq-cards.mjs <afterDir> <beforeDir>
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const [AFTER, BEFORE] = process.argv.slice(2).map((p) => path.resolve(p))
if (!AFTER || !BEFORE) {
  console.error('hq-cards: <afterDir> <beforeDir>')
  process.exit(1)
}
const OUT = path.resolve(import.meta.dirname, '..', 'docs', 'ui-audit-2026-10', 'hq')
const SCENES = path.resolve(import.meta.dirname, '..', 'public', 'assets', 'scenes')
fs.mkdirSync(OUT, { recursive: true })

const BG = '#1b1418'
const label = (w, text, size = 22) =>
  Buffer.from(
    `<svg width="${w}" height="${size + 14}" xmlns="http://www.w3.org/2000/svg"><text x="${w / 2}" y="${size + 2}" font-family="sans-serif" font-weight="700" font-size="${size}" fill="#f1e4be" text-anchor="middle">${text}</text></svg>`,
  )

/** Lay images out in a grid, each fitted to `cell` px wide (never wider than it is), a label over each. */
async function grid(file, items, { cols, cell, gap = 16, pad = 16, kernel = 'lanczos3' }) {
  const fitted = []
  for (const it of items) {
    const meta = await sharp(it.src).metadata()
    const w = Math.min(cell, meta.width)
    const buf = await sharp(it.src).resize({ width: w, kernel }).png().toBuffer()
    const m = await sharp(buf).metadata()
    fitted.push({ buf, w: m.width, h: m.height, text: it.text })
  }
  const rows = Math.ceil(fitted.length / cols)
  const rowH = []
  for (let r = 0; r < rows; r++) rowH.push(Math.max(...fitted.slice(r * cols, r * cols + cols).map((f) => f.h)) + 36)
  const W = pad * 2 + cols * cell + (cols - 1) * gap
  const H = pad * 2 + rowH.reduce((a, b) => a + b, 0) + (rows - 1) * gap
  const comp = []
  let y = pad
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const f = fitted[r * cols + c]
      if (!f) continue
      const x = pad + c * (cell + gap)
      comp.push({ input: label(cell, f.text, 18), left: x, top: y })
      comp.push({ input: f.buf, left: x + Math.round((cell - f.w) / 2), top: y + 36 })
    }
    y += rowH[r] + gap
  }
  await sharp({ create: { width: W, height: H, channels: 4, background: BG } }).composite(comp).png({ compressionLevel: 9 }).toFile(path.join(OUT, file))
  console.log('hq-cards:', file, W, 'x', H)
}

const A = (f) => path.join(AFTER, f)
const B = (f) => path.join(BEFORE, f)

await grid('before-after-phone.png', [
  { src: B('hq-s3-p390.png'), text: 'Before: HR tab' },
  { src: B('hq-s3-p390-ops.png'), text: 'Before: Operations tab' },
  { src: A('hq-s3-p390.png'), text: 'After: one page' },
], { cols: 3, cell: 190 })
await grid('before-after-desk.png', [
  { src: B('hq-s3-d1280.png'), text: 'Before (desk)' },
  { src: A('hq-s3-d1280.png'), text: 'After (desk)' },
], { cols: 1, cell: 600 })
await grid('plate-stages.png', [
  { src: A('plate-s1-p390.png'), text: 'Lodge · 0' },
  { src: A('plate-s2-p390.png'), text: 'Watchtower · 3' },
  { src: A('plate-s3-p390.png'), text: 'Castle · 7' },
  { src: A('plate-s4-p390.png'), text: 'Stronghold · 12' },
  { src: A('plate-s1-d1280.png'), text: 'desk' },
  { src: A('plate-s2-d1280.png'), text: 'desk' },
  { src: A('plate-s3-d1280.png'), text: 'desk' },
  { src: A('plate-s4-d1280.png'), text: 'desk' },
], { cols: 4, cell: 130 })
await grid('home-bar-stages.png', [
  { src: A('bar-s1-p390.png'), text: 'Lodge' },
  { src: A('bar-s2-p390.png'), text: 'Watchtower' },
  { src: A('bar-s3-p390.png'), text: 'Castle' },
  { src: A('bar-s4-p390.png'), text: 'Stronghold' },
], { cols: 1, cell: 600 })
// The big castle: the baked pictures at their own pixels, two a row (never scaled up).
await grid('castle-stages.png', [
  { src: path.join(SCENES, 'hq-lodge.png'), text: 'Lodge (0): a tower going up' },
  { src: path.join(SCENES, 'hq-watchtower.png'), text: 'Watchtower (3): the castle laid out' },
  { src: path.join(SCENES, 'hq-castle.png'), text: 'Castle (7): bare flagpoles' },
  { src: path.join(SCENES, 'hq-stronghold.png'), text: 'Stronghold (12): flags, red banners' },
], { cols: 2, cell: 400, kernel: 'nearest' })
await grid('castle-in-page.png', [
  { src: A('hq-s1-p390.png'), text: 'Lodge' },
  { src: A('hq-s2-p390.png'), text: 'Watchtower' },
  { src: A('hq-s3-p390.png'), text: 'Castle' },
  { src: A('hq-max-p390.png'), text: 'Stronghold' },
], { cols: 4, cell: 150 })
await grid('card-states.png', [
  { src: A('hq-s2-p390-tok3.png'), text: 'Locked' },
  { src: A('hq-s3-p390-tok2.png'), text: 'Buyable' },
  { src: A('hq-s2-p390-tok0.png'), text: "Can't afford" },
  { src: A('hq-max-p390-tok0.png'), text: 'Maxed' },
], { cols: 4, cell: 150 })
await grid('card-states-close.png', [
  { src: A('card-s2-p390-tok3.png'), text: 'Locked' },
  { src: A('card-s3-p390-tok2.png'), text: 'Buyable' },
  { src: A('card-s2-p390-tok0.png'), text: "Can't afford" },
  { src: A('card-max-p390-tok0.png'), text: 'Maxed' },
], { cols: 2, cell: 290 })
await grid('focus-card.png', [{ src: A('hq-s3-p390-tok3.png'), text: 'Company focus: crests and the one-contract order' }], { cols: 1, cell: 390 })
await grid('desk-layout.png', [
  { src: A('hq-s3-d1280.png'), text: 'Desk: castle left, pick right, CTA under the pick' },
  { src: A('hq-s4-d1280-tok3.png'), text: 'Desk: Stronghold, company focus' },
], { cols: 1, cell: 600 })
