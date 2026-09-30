import type { GameEngine, RtEnemy, Telegraph } from '../engine/engine'
import { fxReducedMotion } from './fx'
import { animNow, getViewScale } from './frame'
import { enemyHeadTop, pruneHeadTops } from './units'

/** Scratch: ids drawn this frame. Cleared, never reallocated. */
const alive = new Set<string>()

/**
 * ---------------------------------------------------------------------------
 * Telegraphs (Phase 3a) — how every enemy behaviour announces itself
 * ---------------------------------------------------------------------------
 *
 * The behaviour kit's contract (`data/behaviours.ts`) is that nothing an enemy
 * does may be invisible. Two kinds of mark are drawn here, both read straight
 * off engine state so the picture can never disagree with the sim:
 *
 *  1. **Moments** — `engine.telegraphs`: a bomber's (or the King's) target
 *     circle on the Gate during its wind-up, a blast ring, a shaman's pulse, Grukk's war-cry, a leaper's arc,
 *     a split, a Flare, a shatter, a burn spreading. Each carries sim-clock
 *     `t0`/`t1`, so progress is `engine.elapsed`, frozen with the sim (a
 *     breather or a hitstop freezes the marks too).
 *  2. **Standing states** — read off each enemy: the shield-bearer's ring and
 *     the pip on everything it covers, the shaman's cross, the lit fuse on an
 *     unspent sapper, the bomb a bomber still carries, the leaper's chevron,
 *     the berserker's flame once enraged, frost (brittle) as an icy rim, a
 *     war-cry haste as speed lines.
 *
 * Called once per frame from `renderer.drawBattleEntities`, after the enemies
 * are drawn, so the marks sit over the bodies they describe. Colour is never
 * the only channel: every standing state has its own SHAPE (cross, fuse spark,
 * chevron, flame, pip, ring), for the same reason the elite plaques do.
 *
 * Pure canvas primitives, no sprites — nothing to preload, nothing the
 * precache has to know about.
 */
export function drawTelegraphs(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  const now = engine.elapsed
  // Line weights floored in CSS px, like the build slots, so a mark survives
  // the composite being squeezed onto a small phone.
  const lw = Math.max(1.5, 1.6 / Math.max(getViewScale(), 0.05))
  const pulse = fxReducedMotion() ? 1 : 0.5 + 0.5 * Math.sin(animNow() * 8)

  ctx.save()
  for (const t of engine.telegraphs) drawMoment(ctx, t, now, lw, pulse)
  alive.clear()
  for (const e of engine.enemies) {
    alive.add(e.id)
    drawStanding(ctx, e, now, lw, pulse)
  }
  pruneHeadTops(alive)
  ctx.restore()
}

// The breather's banner (`drawBreatherBanner`) was retired by G2-2: the
// instruction it painted across the top of the field ("Sub-wave 1 of 2 held ·
// tap a hero, then a post") now lives in the wave strip's left slot
// (`StripLabel` in `ui/shell/DetailBand.tsx`), so the field keeps its full
// height. The open posts still light up (`BattleCanvas`).

function progress(t: Telegraph, now: number): number {
  const span = t.t1 - t.t0
  return span > 0 ? Math.min(1, Math.max(0, (now - t.t0) / span)) : 1
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, width: number, dash?: number[]): void {
  ctx.beginPath()
  ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2)
  ctx.setLineDash(dash ?? [])
  ctx.lineWidth = width
  ctx.strokeStyle = color
  ctx.stroke()
  ctx.setLineDash([])
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.beginPath()
  ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}

function drawMoment(ctx: CanvasRenderingContext2D, t: Telegraph, now: number, lw: number, pulse: number): void {
  const p = progress(t, now)
  switch (t.kind) {
    case 'lob':
    case 'kingLob': {
      // The mark on the Gate: a dashed danger ring with a fill that closes in
      // as the fuse burns down — the whole window to kill the thrower.
      const king = t.kind === 'kingLob'
      const hue = king ? '255, 70, 70' : '255, 140, 60'
      disc(ctx, t.x, t.y, t.r * p, `rgba(${hue}, ${0.16 + 0.14 * p})`)
      ring(ctx, t.x, t.y, t.r, `rgba(${hue}, ${0.55 + 0.4 * pulse})`, lw * (king ? 2.2 : 1.6), [lw * 4, lw * 3])
      // Crosshair.
      ctx.beginPath()
      ctx.moveTo(t.x - t.r * 0.35, t.y)
      ctx.lineTo(t.x + t.r * 0.35, t.y)
      ctx.moveTo(t.x, t.y - t.r * 0.35)
      ctx.lineTo(t.x, t.y + t.r * 0.35)
      ctx.lineWidth = lw
      ctx.strokeStyle = `rgba(${hue}, 0.8)`
      ctx.stroke()
      // A faint tether back to the thrower, so the player knows WHO to kill.
      if (t.x2 !== undefined && t.y2 !== undefined) {
        ctx.beginPath()
        ctx.moveTo(t.x2, t.y2)
        const mx = (t.x + t.x2) / 2
        const my = Math.min(t.y, t.y2) - 40
        ctx.quadraticCurveTo(mx, my, t.x, t.y)
        ctx.setLineDash([lw * 2, lw * 3])
        ctx.lineWidth = lw
        ctx.strokeStyle = `rgba(${hue}, 0.45)`
        ctx.stroke()
        ctx.setLineDash([])
      }
      break
    }
    case 'blast':
      disc(ctx, t.x, t.y, t.r * (0.4 + 0.6 * p), `rgba(255, 170, 60, ${0.35 * (1 - p)})`)
      ring(ctx, t.x, t.y, t.r * (0.5 + 0.5 * p), `rgba(255, 120, 40, ${0.9 * (1 - p)})`, lw * 2)
      break
    case 'heal':
      ring(ctx, t.x, t.y, t.r * p, `rgba(122, 220, 110, ${0.8 * (1 - p)})`, lw * 1.6)
      break
    case 'warcry':
      // The wind-up: a ring swelling out to the cry's reach.
      disc(ctx, t.x, t.y, t.r * p, `rgba(220, 40, 30, ${0.08 + 0.08 * pulse})`)
      ring(ctx, t.x, t.y, t.r * p, `rgba(255, 70, 50, ${0.85})`, lw * 2.2)
      ring(ctx, t.x, t.y, t.r, 'rgba(255, 70, 50, 0.35)', lw, [lw * 3, lw * 3])
      break
    case 'phase':
      ring(ctx, t.x, t.y, t.r * (0.6 + 0.8 * p), `rgba(255, 209, 102, ${0.9 * (1 - p)})`, lw * 3)
      break
    case 'leap':
      if (t.x2 !== undefined && t.y2 !== undefined) {
        ctx.beginPath()
        ctx.moveTo(t.x, t.y)
        ctx.quadraticCurveTo((t.x + t.x2) / 2, Math.min(t.y, t.y2) - 50, t.x2, t.y2)
        ctx.setLineDash([lw * 3, lw * 2])
        ctx.lineWidth = lw * 1.4
        ctx.strokeStyle = `rgba(240, 220, 160, ${0.9 * (1 - p)})`
        ctx.stroke()
        ctx.setLineDash([])
      }
      break
    case 'split':
      ring(ctx, t.x, t.y, t.r * (0.5 + 0.7 * p), `rgba(201, 150, 90, ${0.9 * (1 - p)})`, lw * 2)
      break
    case 'flare':
      disc(ctx, t.x, t.y, t.r, `rgba(255, 236, 150, ${0.12 * (1 - p) + 0.04})`)
      ring(ctx, t.x, t.y, t.r, `rgba(255, 226, 120, ${0.7 * (1 - p) + 0.15})`, lw * 1.6)
      break
    case 'shatter':
      ring(ctx, t.x, t.y, t.r * (0.6 + 0.6 * p), `rgba(191, 230, 255, ${1 - p})`, lw * 2)
      break
    case 'spread':
      ring(ctx, t.x, t.y, t.r * p, `rgba(255, 130, 50, ${0.7 * (1 - p)})`, lw * 1.4, [lw * 2, lw * 2])
      break
  }
}

function drawStanding(ctx: CanvasRenderingContext2D, e: RtEnemy, now: number, lw: number, pulse: number): void {
  const x = e.pos.x
  // Above the HP bar stack the unit renderer drew (units are drawn at ~2× their
  // gameplay radius since Phase 2), falling back to the radius before a draw.
  const top = (enemyHeadTop(e.id) ?? e.pos.y - e.type.radius) - 8
  // Frost: an icy rim — brittle to physical, and a shock will shatter it.
  if (now < e.frostUntil) ring(ctx, x, e.pos.y, e.type.radius + 3, 'rgba(191, 230, 255, 0.8)', lw)
  // War-cry haste: two speed lines behind it.
  if (now < e.hasteUntil) {
    ctx.beginPath()
    ctx.moveTo(x - e.type.radius - 4, e.pos.y - 4)
    ctx.lineTo(x - e.type.radius - 14, e.pos.y - 4)
    ctx.moveTo(x - e.type.radius - 4, e.pos.y + 3)
    ctx.lineTo(x - e.type.radius - 12, e.pos.y + 3)
    ctx.lineWidth = lw
    ctx.strokeStyle = 'rgba(255, 90, 70, 0.85)'
    ctx.stroke()
  }
  // Standing ground marks first (unscaled), then the head icons, which are
  // scaled up so a ~12px glyph survives a phone's ×0.4 composite — the units
  // themselves are drawn at ~2× their radius since Phase 2.
  const bs = e.type.behaviours
  for (const b of bs ?? []) {
    if (b.kind === 'shieldAura') ring(ctx, x, e.pos.y, b.radius, `rgba(120, 180, 255, ${0.22 + 0.12 * pulse})`, lw, [lw * 3, lw * 2])
  }
  const k = Math.min(2.4, Math.max(1.5, 0.8 / Math.max(getViewScale(), 0.05)))
  ctx.save()
  ctx.translate(x, top)
  ctx.scale(k, k)
  ctx.translate(-x, -top)
  // Shielded by a bearer: a small blue pip, left of the head.
  if (e.shield > 0) {
    ctx.beginPath()
    ctx.moveTo(x - 10, top - 5)
    ctx.lineTo(x - 5, top - 3)
    ctx.lineTo(x - 5, top + 2)
    ctx.lineTo(x - 10, top + 5)
    ctx.lineTo(x - 15, top + 2)
    ctx.lineTo(x - 15, top - 3)
    ctx.closePath()
    ctx.fillStyle = 'rgba(120, 180, 255, 0.95)'
    ctx.fill()
  }
  for (const b of bs ?? []) {
    switch (b.kind) {
      case 'shieldAura':
        break
      case 'healPulse': {
        // A green cross over the shaman.
        ctx.fillStyle = 'rgba(122, 220, 110, 0.95)'
        ctx.fillRect(x - 2, top - 6, 4, 12)
        ctx.fillRect(x - 6, top - 2, 12, 4)
        break
      }
      case 'enrage':
        if (e.enraged) drawFlame(ctx, x, top, pulse)
        break
      case 'sapper': {
        // A lit fuse: a short line with a flickering spark on the end.
        ctx.beginPath()
        ctx.moveTo(x + 4, top + 4)
        ctx.lineTo(x + 8, top - 4)
        ctx.lineWidth = lw
        ctx.strokeStyle = 'rgba(60, 40, 20, 0.9)'
        ctx.stroke()
        disc(ctx, x + 8, top - 5, 2 + 2 * pulse, `rgba(255, ${170 + Math.round(60 * pulse)}, 60, 0.95)`)
        break
      }
      case 'lob':
        if (e.lobCharges > 0 && e.lobUntil === 0) {
          // The charge it is still carrying.
          disc(ctx, x + 8, top, 4, 'rgba(40, 30, 30, 0.95)')
          disc(ctx, x + 10, top - 4, 1.6, 'rgba(255, 200, 80, 0.95)')
        }
        break
      case 'leap':
        if (!e.leapt) {
          ctx.beginPath()
          ctx.moveTo(x - 6, top + 3)
          ctx.lineTo(x, top - 4)
          ctx.lineTo(x + 6, top + 3)
          ctx.lineWidth = lw * 1.5
          ctx.strokeStyle = 'rgba(240, 220, 160, 0.95)'
          ctx.stroke()
        }
        break
      case 'split': {
        // A crack across the barrel.
        ctx.beginPath()
        ctx.moveTo(x - 5, e.pos.y - 8)
        ctx.lineTo(x - 1, e.pos.y - 2)
        ctx.lineTo(x - 4, e.pos.y + 2)
        ctx.lineTo(x + 2, e.pos.y + 8)
        ctx.lineWidth = lw
        ctx.strokeStyle = 'rgba(30, 20, 10, 0.8)'
        ctx.stroke()
        break
      }
      case 'bossSplit':
        if (e.phase === 0 && e.hp / e.maxHp < b.at + 0.15) drawFlame(ctx, x, top - 6, pulse * 0.6)
        break
      case 'kingLob':
      case 'warCry':
        // Their moments are the telegraph (the wind-up rings above).
        break
    }
  }
  ctx.restore()
}

function drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, pulse: number): void {
  ctx.beginPath()
  ctx.moveTo(x, y - 8 - 2 * pulse)
  ctx.quadraticCurveTo(x + 6, y - 1, x + 3, y + 4)
  ctx.lineTo(x - 3, y + 4)
  ctx.quadraticCurveTo(x - 6, y - 1, x, y - 8 - 2 * pulse)
  ctx.fillStyle = 'rgba(255, 90, 40, 0.95)'
  ctx.fill()
}

