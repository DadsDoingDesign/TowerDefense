/** Shots in flight and ground traps. */
import type { Vec2 } from '../core/vec'
import type { RtProjectile } from '../engine/engine'
import { getActiveStyle } from './themes'
import { lighten, roundRect } from './paint'

/**
 * A shot. No `shadowBlur` on the sprite themes any more (H19): a Gaussian
 * shadow is among the slowest things Canvas2D can be asked for on a phone, and
 * it was being paid PER PROJECTILE, per frame, for a 3.5px dot. The pop is
 * bought back for free with a dark contour ring and a lit core — two arcs — so
 * the shot still separates from grass and dirt without a blur kernel.
 */
export function drawProjectile(ctx: CanvasRenderingContext2D, p: RtProjectile): void {
  const pr = getActiveStyle().projectile
  ctx.save()
  const r = p.splashRadius > 0 ? 5 : p.isCrit ? 5.5 : 3.5
  ctx.fillStyle = p.color
  if (pr.glow > 0) {
    ctx.shadowColor = p.color
    ctx.shadowBlur = pr.glow
  }
  if (pr.square) {
    roundRect(ctx, p.pos.x - r, p.pos.y - r, r * 2, r * 2, 1)
    ctx.fill()
  } else {
    /**
     * Weight (Nijman: "your bullets are too small").
     *
     * A shot used to be one 3.5 px dot with no direction, no history and no
     * mass, and a *crit* was that dot at 4.5 px — a 1 px difference, which is
     * 0.4 CSS px at the shipping view, i.e. not a channel. Now the shot is
     * **stretched along its own velocity** and drags a three-step tail that
     * fades and narrows, so it reads as travelling rather than as existing at a
     * sequence of positions. A crit is a bigger core, a gold rim, and a longer
     * hotter tail — three channels, not a rounding error.
     */
    const dx = p.toPos.x - p.pos.x
    const dy = p.toPos.y - p.pos.y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const tail = Math.min(16, p.speed * 0.028) * (p.isCrit ? 1.5 : 1)
    for (let i = 3; i >= 1; i--) {
      const t = i / 3
      const rr = r * (1 - t * 0.62)
      ctx.globalAlpha = 0.16 + (1 - t) * 0.34
      ctx.beginPath()
      ctx.arc(p.pos.x - ux * tail * t, p.pos.y - uy * tail * t, rr, 0, Math.PI * 2)
      ctx.fillStyle = p.isCrit ? '#ffd166' : p.color
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(p.pos.x, p.pos.y, r + 1, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(26,15,8,0.55)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(p.pos.x, p.pos.y, r, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.fill()
    if (p.isCrit) {
      ctx.beginPath()
      ctx.arc(p.pos.x, p.pos.y, r - 1, 0, Math.PI * 2)
      ctx.strokeStyle = '#ffd166'
      ctx.lineWidth = 1.6
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(p.pos.x - r * 0.25, p.pos.y - r * 0.25, r * 0.45, 0, Math.PI * 2)
    ctx.fillStyle = lighten(p.color, 0.55)
    ctx.fill()
  }
  ctx.restore()
}

export function drawTrap(ctx: CanvasRenderingContext2D, pos: Vec2, now: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(now * 4 + pos.x)
  ctx.save()
  ctx.translate(pos.x, pos.y)
  ctx.beginPath()
  ctx.arc(0, 0, 30, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(200,90,60,${0.08 + pulse * 0.06})`
  ctx.fill()
  ctx.setLineDash([3, 4])
  ctx.strokeStyle = 'rgba(224,90,79,0.5)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}
