/**
 * Palette-quantises the UI-audit PNGs in place.
 *
 * The audit captures ~150 screenshots; raw they run ~23MB, which is several
 * times the size of the rest of the repo. These are flat pixel-art UIs, so a
 * 256-colour palette is visually lossless in practice and cuts about 70%.
 *
 *   node scripts/ui-audit-compress.mjs
 */
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('docs/ui-audit')

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.png') ? [path.join(d, e.name)] : [],
  )

const files = walk(ROOT)
let before = 0
let after = 0

for (const f of files) {
  const size = fs.statSync(f).size
  before += size
  const buf = await sharp(f).png({ palette: true, quality: 90, effort: 9 }).toBuffer()
  // Never grow a file — a few tiny clips compress worse as palette PNGs.
  if (buf.length < size) fs.writeFileSync(f, buf)
  after += Math.min(buf.length, size)
}

const mb = (n) => (n / 1048576).toFixed(1)
console.log(`${files.length} files: ${mb(before)}MB -> ${mb(after)}MB (${Math.round(100 - (after / before) * 100)}% smaller)`)
