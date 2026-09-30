/**
 * Unit health bars — Phase 2, "readable battles".
 *
 * What the review found: enemy tier pips stacked into a white ribbon down a
 * crowded lane; HP bars were 4 logical px — 1.6 CSS px on the shipping phone, a
 * hairline; and nothing showed a hit landing except the number over it.
 *
 * One bar per unit now carries all of it:
 *
 *  - **Height floored in CSS px** (`BAR_CSS` fill + `EDGE_CSS` dark outline),
 *    converted through the live view scale, so it is ≥ 2 device px on every
 *    phone at every scale — the tier-notch lesson from `plaques.ts`, applied to
 *    the bar.
 *  - **Tier is tick marks IN the bar**: a tier-3 goblin's bar is cut into three
 *    segments. It is a count (survives colour-vision modes and screenshots) and
 *    it costs no extra row above the head, so a column of twenty enemies is one
 *    row of bars, not a bar and a plaque each.
 *  - **A recent-damage trail**: the part just lost stays lit cream for a beat
 *    and then drains, so a burst reads as a burst.
 *  - **Elite modifier as a badge over the head**, the same shield / diamond /
 *    chevron marks the plaque used, on a dark disc so it separates from the art.
 *
 * The trail is presentation state keyed by unit id, advanced on the REAL-time
 * FX clock (so it reads the same at 1× and 3×) and swept when a unit stops
 * being drawn. It never reads or writes the sim.
 */
import { fxNow } from './fx'
import { getViewScale } from './frame'
import { drawEliteMark, type EliteMark } from './plaques'

/** Fill height and outline, in CSS px. 2.5 + 2×1 = 4.5 CSS px of bar. */
const BAR_CSS = 2.5
const EDGE_CSS = 1
/** Width floor in CSS px for a line unit. */
const WIDTH_CSS = 17
/** How long the trail holds before draining, and how fast it drains (frac/s). */
const TRAIL_HOLD = 0.4
const TRAIL_DRAIN = 1.4

interface Trail {
  trail: number
  prev: number
  hitAt: number
  seen: number
}
const trails = new Map<string, Trail>()
let sweepAt = 0

function trailFor(id: string, frac: number): number {
  const now = fxNow()
  let t = trails.get(id)
  if (!t) {
    t = { trail: frac, prev: frac, hitAt: -1, seen: now }
    trails.set(id, t)
  }
  // A heal (or a fresh unit reusing an id) snaps the trail up with the bar.
  if (frac > t.prev + 1e-6) t.trail = frac
  if (frac < t.prev - 1e-6) {
    if (t.trail < t.prev) t.trail = t.prev
    t.hitAt = now
  }
  t.prev = frac
  const dt = Math.max(0, now - t.seen)
  t.seen = now
  if (t.trail > frac && now - t.hitAt > TRAIL_HOLD) t.trail = Math.max(frac, t.trail - TRAIL_DRAIN * dt)
  if (now - sweepAt > 2) {
    sweepAt = now
    for (const [k, v] of trails) if (now - v.seen > 2) trails.delete(k)
  }
  return t.trail
}

function fillColour(frac: number): string {
  return frac > 0.5 ? '#7ac74f' : frac > 0.25 ? '#e6b800' : '#e05a4f'
}

/**
 * Geometry of a bar in logical px for the current view scale — exported so a
 * harness can assert the CSS-px floors rather than eyeball them.
 */
export function barGeometry(minWidth: number) {
  const vs = Math.max(getViewScale(), 0.02)
  const px = 1 / vs
  const fillH = Math.max(3, BAR_CSS * px)
  const edge = Math.max(1, EDGE_CSS * px)
  const w = Math.max(minWidth, WIDTH_CSS * px)
  return { px, fillH, edge, w, h: fillH + edge * 2, cssFill: fillH * vs }
}

/**
 * An enemy's bar, its tier ticks and its elite badge, centred on x = 0 with
 * its BOTTOM at `bottom` (token space). Returns the top of what it drew so a
 * caller can stack above it.
 */
export function drawEnemyBar(
  ctx: CanvasRenderingContext2D,
  id: string,
  hp: number,
  maxHp: number,
  tier: number,
  elite: EliteMark,
  champion: boolean,
  bottom: number,
): number {
  const frac = Math.max(0, Math.min(1, hp / maxHp))
  const trail = trailFor(id, frac)
  const G = barGeometry(champion ? 44 : 26)
  const w = Math.round(champion ? Math.max(G.w * 1.6, 52) : G.w)
  const x = -Math.round(w / 2)
  const y = Math.round(bottom - G.h)
  const inner = w - G.edge * 2
  const damaged = frac < 0.999

  // Outline and trough. Full-HP line troops draw a little quieter so a healthy
  // column reads as a row of tier counts, not a wall of green.
  ctx.globalAlpha = damaged || champion || elite ? 1 : 0.82
  ctx.fillStyle = champion ? '#3a200c' : 'rgba(12,7,3,0.92)'
  ctx.fillRect(x, y, w, G.h)
  ctx.fillStyle = '#2a1b10'
  ctx.fillRect(x + G.edge, y + G.edge, inner, G.fillH)
  if (trail > frac) {
    ctx.fillStyle = '#f3dfb1'
    ctx.fillRect(x + G.edge, y + G.edge, inner * trail, G.fillH)
  }
  ctx.fillStyle = fillColour(frac)
  ctx.fillRect(x + G.edge, y + G.edge, inner * frac, G.fillH)
  // Tier: the bar cut into `tier` segments by dark ticks the height of the bar.
  if (!champion && tier > 1) {
    ctx.fillStyle = 'rgba(12,7,3,0.95)'
    const tw = Math.max(1, G.px * 1.1)
    for (let i = 1; i < tier; i++) {
      const tx = Math.round(x + G.edge + (inner * i) / tier - tw / 2)
      ctx.fillRect(tx, y, tw, G.h)
    }
  }
  // A champion's frame is gold, so the one bar that matters most is findable.
  if (champion) {
    ctx.strokeStyle = '#e0ac4c'
    ctx.lineWidth = Math.max(1, G.px)
    ctx.strokeRect(x - G.px * 0.5, y - G.px * 0.5, w + G.px, G.h + G.px)
  }
  ctx.globalAlpha = 1
  let top = y

  if (elite) {
    // A dark disc with the modifier mark, sitting on the bar's centre.
    const r = Math.max(5, 4.2 * G.px)
    const cy = Math.round(top - r - G.px)
    ctx.beginPath()
    ctx.arc(0, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(20,12,6,0.92)'
    ctx.fill()
    ctx.lineWidth = Math.max(1, G.px * 0.9)
    ctx.strokeStyle = '#e0ac4c'
    ctx.stroke()
    const mh = r * 1.1
    const stroke = elite === 'swift' ? Math.max(mh * 0.24, 1.15 * G.px) : 0
    const arm = elite === 'swift' ? Math.max(mh * 0.34, stroke) : 0
    const mw = elite === 'swift' ? 3 * stroke + arm : mh * 0.92
    drawEliteMark(ctx, elite, -mw / 2, cy - mh / 2, mw, mh, stroke, arm)
    top = cy - r
  }
  return top
}

