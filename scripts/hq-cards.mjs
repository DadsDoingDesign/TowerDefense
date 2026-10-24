/**
 * hq-cards — the HQ pass's review cards (`docs/ui-audit-2026-10/hq/`), ~600 px
 * wide, composed from a round of `scripts/hq-shots.mjs` (after), one taken
 * before the pass, and the flat castles `scripts/hq-keep.ts --compose` writes.
 *
 *   npx tsx scripts/hq-keep.ts --compose <composeDir>
 *   node scripts/hq-cards.mjs <afterDir> <beforeDir> <composeDir>
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const [AFTER, BEFORE, COMP] = process.argv.slice(2).map((p) => path.resolve(p))
if (!AFTER || !BEFORE || !COMP) {
  console.error('hq-cards: <afterDir> <beforeDir> <composeDir>')
  process.exit(1)
}
const OUT = path.resolve(import.meta.dirname, '..', 'docs', 'ui-audit-2026-10', 'hq')
fs.mkdirSync(OUT, { recursive: true })
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.rmSync(path.join(OUT, f))

const BG = '#1b1418'
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const label = (w, text, size = 18) =>
  Buffer.from(
    `<svg width="${w}" height="${size + 14}" xmlns="http://www.w3.org/2000/svg"><text x="${w / 2}" y="${size + 2}" font-family="sans-serif" font-weight="700" font-size="${size}" fill="#f1e4be" text-anchor="middle">${esc(text)}</text></svg>`,
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
      comp.push({ input: label(cell, f.text), left: x, top: y })
      comp.push({ input: f.buf, left: x + Math.round((cell - f.w) / 2), top: y + 36 })
    }
    y += rowH[r] + gap
  }
  await sharp({ create: { width: W, height: H, channels: 4, background: BG } }).composite(comp).png({ compressionLevel: 9 }).toFile(path.join(OUT, file))
  console.log('hq-cards:', file, W, 'x', H)
}

const A = (f) => path.join(AFTER, f)
const B = (f) => path.join(BEFORE, f)
const C = (f) => path.join(COMP, f)

await grid('before-after-phone.png', [
  { src: B('hq-s3-p390.png'), text: 'Before: HR tab' },
  { src: B('hq-s3-p390-ops.png'), text: 'Before: Operations' },
  { src: A('hq-t3-p390.png'), text: 'After' },
], { cols: 3, cell: 190 })
await grid('before-after-desk.png', [
  { src: B('hq-s3-d1280.png'), text: 'Before (desk)' },
  { src: A('hq-t3-d1280.png'), text: 'After (desk)' },
], { cols: 1, cell: 600 })
// Each tier's whole castle, its parts at mixed levels — the flat bake, at its own pixels.
await grid('tier-castles.png', [
  { src: C('tier-timber.png'), text: 'Timber: yard 2, hall 0, store 1, lookout 1' },
  { src: C('tier-stone.png'), text: 'Stone: yard 3, hall 1, store 2, pennants 1' },
  { src: C('tier-fortified.png'), text: 'Fortified: yard 4, store 3, pennants 2' },
  { src: C('tier-grand.png'), text: 'Grand: every part at its last level' },
], { cols: 2, cell: 400, kernel: 'nearest' })
// One part across its levels: the barracks yard (Opening deal), cropped to the yard.
const yard = []
for (let lv = 0; lv <= 5; lv++) {
  const f = path.join(COMP, `crop-yard-${lv}.png`)
  await sharp(C(`part-yard-${lv}.png`)).extract({ left: 20, top: 180, width: 180, height: 120 }).png().toFile(f)
  yard.push({ src: f, text: lv === 0 ? 'Level 0: the plot' : `Level ${lv}` })
}
await grid('part-yard-levels.png', yard, { cols: 3, cell: 180, kernel: 'nearest' })
const look = []
for (let lv = 0; lv <= 2; lv++) {
  const f = path.join(COMP, `crop-lookout-${lv}.png`)
  await sharp(C(`part-lookout-${lv}.png`)).extract({ left: 250, top: 0, width: 110, height: 130 }).png().toFile(f)
  look.push({ src: f, text: lv === 0 ? 'Lookout 0: timber' : `Lookout ${lv}` })
}
await grid('part-lookout-levels.png', look, { cols: 3, cell: 160, kernel: 'nearest' })
await grid('highlight-on-tap.png', [
  { src: A('keep-t3-p390-tok0.png'), text: 'Opening deal: the yard' },
  { src: A('keep-t3-p390-tok1.png'), text: 'Hiring Hall: the great hall' },
  { src: A('keep-t3-p390-tok2.png'), text: 'Pack slots: the storehouse' },
  { src: A('keep-t3-p390-tok3.png'), text: 'Company focus: the pennants' },
  { src: A('keep-t3-p390-tok4.png'), text: 'Scouts: the lookout' },
], { cols: 2, cell: 300 })
await grid('milestone-line.png', [
  { src: A('keep-t1-p390-tok0.png'), text: 'Timber: one upgrade short' },
  { src: A('keep-t2-p390-tok0.png'), text: 'Stone' },
  { src: A('keep-t3-p390-tok0.png'), text: 'Fortified' },
  { src: A('keep-t4-p390-tok0.png'), text: 'Grand' },
], { cols: 2, cell: 290 })
await grid('home-mark-tiers.png', [
  { src: A('plate-t0-p390.png'), text: 'Timber' },
  { src: A('plate-t2-p390.png'), text: 'Stone' },
  { src: A('plate-t3-p390.png'), text: 'Fortified' },
  { src: A('plate-t4-p390.png'), text: 'Grand' },
  { src: A('plate-t0-d1280.png'), text: 'desk' },
  { src: A('plate-t2-d1280.png'), text: 'desk' },
  { src: A('plate-t3-d1280.png'), text: 'desk' },
  { src: A('plate-t4-d1280.png'), text: 'desk' },
], { cols: 4, cell: 130 })
await grid('home-bar-tiers.png', [
  { src: A('bar-t0-p390.png'), text: 'Timber' },
  { src: A('bar-t2-p390.png'), text: 'Stone' },
  { src: A('bar-t3-p390.png'), text: 'Fortified' },
  { src: A('bar-t4-p390.png'), text: 'Grand' },
], { cols: 1, cell: 600 })
await grid('card-states.png', [
  { src: A('hq-t2-p390-tok3.png'), text: 'Locked' },
  { src: A('hq-t3-p390-tok2.png'), text: 'Buyable' },
  { src: A('hq-t2-p390-tok0.png'), text: "Can't afford" },
  { src: A('hq-t4-p390-tok0.png'), text: 'Maxed' },
], { cols: 4, cell: 150 })
await grid('tier-rise.png', [
  { src: A('rise-a-p390.png'), text: 'Rise: the old castle fades' },
  { src: A('rise-b-p390.png'), text: 'Its name, for a beat' },
  { src: A('rise-c-p390.png'), text: 'Then the page' },
], { cols: 3, cell: 190 })
await grid('phone-320.png', [
  { src: A('hq-t3-p320.png'), text: '320: the castle edge to edge' },
  { src: A('hq-t1-p320-tok4.png'), text: '320: the card' },
], { cols: 2, cell: 290 })
await grid('desk-layout.png', [
  { src: A('hq-t3-d1280-tok2.png'), text: 'Desk: castle left, pick right, the storehouse lit' },
  { src: A('hq-t4-d1280-tok3.png'), text: 'Desk: Grand castle, company focus' },
], { cols: 1, cell: 600 })
