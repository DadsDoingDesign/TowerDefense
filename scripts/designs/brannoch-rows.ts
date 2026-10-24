/**
 * Brannoch designs — a debugging aid for the critique rounds: prints a design's
 * still as a row-by-row mass profile (solid pixels per row, the mid line
 * marked), so a top-mass or leg-share miss can be traced to its rows.
 *
 *   npx tsx scripts/designs/brannoch-rows.ts d10
 */
import { render, W, H } from './brannoch-lib'
import { DESIGNS } from './brannoch-all'

const id = process.argv[2]
const d = DESIGNS.find((x) => x.id === id)
if (!d) throw new Error(`no design ${id}`)
const img = render(d)
const rows: number[] = []
for (let y = 0; y < H; y++) {
  let n = 0
  for (let x = 0; x < W; x++) if (img.data[(y * W + x) * 4 + 3] >= 200) n++
  rows.push(n)
}
const y0 = rows.findIndex((n) => n > 0)
const y1 = rows.length - 1 - [...rows].reverse().findIndex((n) => n > 0)
const mid = y0 + (y1 - y0 + 1) / 2
let top = 0, all = 0
for (let y = y0; y <= y1; y++) {
  all += rows[y]
  if (y + 0.5 < mid) top += rows[y]
  console.log(`${String(y).padStart(3)} ${y + 0.5 < mid ? 'T' : 'B'} ${String(rows[y]).padStart(3)} ${'#'.repeat(rows[y])}`)
}
console.log(`top ${(top / all).toFixed(3)}  (${y0}..${y1}, mid ${mid})`)
