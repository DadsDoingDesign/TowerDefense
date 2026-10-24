/**
 * Procedural battlefields — the gallery (`src/game/data/fieldGen.ts`).
 *
 * Run:  npx vite --port 5188  →  http://localhost:5188/harness/fields.html
 *
 * Every field is drawn through the real draw code (`drawField`, `drawCaravan`
 * — the battle's own terrain bake and wagon), never a schematic: the two
 * hand-made fields first, for reference, then eight fields per weight profile
 * with their scores and the weights that dealt them.
 */
import { drawCaravan, drawField } from '../src/game/render/renderer'
import { onSpritesReady, preloadSprites } from '../src/game/render/sprites'
import { FIELD_PROFILES, generateField, scoreField, type FieldScore, type FieldWeights } from '../src/game/data/fieldGen'
import { FIRST_MAP, KILN_MAP } from '../src/game/data/maps'
import type { GameMap } from '../src/game/types'

const SEEDS = [11, 23, 37, 41, 53, 67, 79, 97]
const out = document.getElementById('out')!

const el = <K extends keyof HTMLElementTagNameMap>(t: K, cls?: string, html?: string) => {
  const n = document.createElement(t)
  if (cls) n.className = cls
  if (html !== undefined) n.innerHTML = html
  return n
}

function figure(map: GameMap, score: FieldScore, label: string, ref = false): HTMLElement {
  const f = el('figure')
  const cv = el('canvas')
  // Half size, at 2× device pixels: the field's own pixels, no smoothing.
  cv.width = map.width
  cv.height = map.height
  const ctx = cv.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  drawField(ctx, map)
  drawCaravan(ctx, map, { color: '#c6e05a', cargo: 1, company: 'spice' })
  f.append(cv)
  const s = score
  f.append(
    el(
      'figcaption',
      undefined,
      `<span class="${ref ? 'ref' : ''}"><b>${label}</b></span>` +
        `<span>len <b>${s.length}</b></span><span>turns <b>${s.turns}</b></span><span>straight <b>${s.longestStraight}</b></span>` +
        `<span>chokes <b>${s.chokes}</b></span><span>open <b>${s.open}</b></span><span>tight <b>${s.tight}</b></span><span>edge <b>${s.edge}</b></span>`,
    ),
  )
  return f
}

const weightsLine = (w: FieldWeights) =>
  `forward ${w.forward} · turn ${w.turn} · back ${w.back} · straight ×${w.straight} · turns ${w.turns[0]}–${w.turns[1]} · straight ≤ ${w.maxStraight}px · chokes ≥ ${w.minChokes} · tight ≤ ${w.maxTight} · edge ≤ ${w.maxEdge} · rocks ${w.rocks[0]}–${w.rocks[1]}`

function render(): void {
  out.append(el('h2', undefined, 'Hand-made (for reference)'))
  const refGrid = el('div', 'grid')
  refGrid.append(figure(FIRST_MAP, scoreField(FIRST_MAP), 'The Green Line', true), figure(KILN_MAP, scoreField(KILN_MAP), 'The Kiln Road', true))
  out.append(refGrid)
  for (const [key, p] of Object.entries(FIELD_PROFILES)) {
    out.append(el('h2', undefined, p.label), el('div', 'w', weightsLine(p.weights)))
    const grid = el('div', 'grid')
    grid.dataset.profile = key
    for (const seed of SEEDS) {
      const g = generateField(seed, p.weights)
      if (!g) {
        grid.append(el('figure', undefined, `seed ${seed}: no road passed`))
        continue
      }
      grid.append(figure(g.map, g.score, `seed ${seed}`))
    }
    out.append(grid)
  }
  document.body.dataset.ready = '1'
}

preloadSprites()
onSpritesReady(render)
