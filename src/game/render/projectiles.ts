/** Shots in flight, swings in progress, and ground traps. */
import type { Vec2 } from '../core/vec'
import type { RtProjectile } from '../engine/engine'
import { getActiveStyle } from './themes'
import { hexToRgba, lighten, roundRect } from './paint'
import { inkOf, leadEffect, type Delivery, type EffectInk, type HitEffect } from './attackLook'

/** How a shot is to be drawn — its delivery and the clock its trail flickers on. */
export interface ShotLook {
  delivery: Delivery
  /** Presentation clock (seconds). */
  now: number
  /** Reduced motion: trails hold still (no flicker, no spin). */
  still: boolean
}

const OUTLINE = 'rgba(22,28,46,0.85)'
const TAU = Math.PI * 2

/**
 * How far above an enemy's position a blow lands, in logical px. An enemy's
 * `pos` is where it stands on the road — its feet — and a sword is swung at
 * the body, so the arc (and its lingering mark in `fx.ts`) crosses the torso.
 */
export const SWING_LIFT = 14

/**
 * A shot. No `shadowBlur` on the sprite themes any more (H19): a Gaussian
 * shadow is among the slowest things Canvas2D can be asked for on a phone, and
 * it was being paid PER PROJECTILE, per frame, for a 3.5px dot. The pop is
 * bought back for free with a dark contour and a lit core — strokes and arcs —
 * so the shot still separates from grass and dirt without a blur kernel.
 *
 * ## The shot is the weapon's (the designer: "the projectiles should match the
 * effects of the weapon")
 *
 * It used to be one hue-tinted dot for every hero. It is now what the weapon
 * throws (`attackLook.deliveryOf`) — a shafted ARROW off a bow, a spinning
 * KNIFE off a dagger, a glowing BOLT off a wand, staff or grimoire (violet for
 * magic), a grey STONE from bare hands — and it drags a TRAIL in the ink of
 * its lead on-hit effect (`attackLook.leadEffect`), each effect with its own
 * shape as well as its own colour: embers for burn, frost shards for chill, a
 * crackle for shock, a red double helix for a siphon. A crit is still bigger,
 * gold-rimmed and longer-tailed. A swing is never drawn here — see
 * {@link drawSwing}.
 */
export function drawProjectile(ctx: CanvasRenderingContext2D, p: RtProjectile, look?: ShotLook): void {
  const pr = getActiveStyle().projectile
  if (pr.square) {
    // The square-token themes keep their own shot.
    ctx.save()
    const r = p.splashRadius > 0 ? 5 : p.isCrit ? 5.5 : 3.5
    ctx.fillStyle = p.color
    if (pr.glow > 0) {
      ctx.shadowColor = p.color
      ctx.shadowBlur = pr.glow
    }
    roundRect(ctx, p.pos.x - r, p.pos.y - r, r * 2, r * 2, 1)
    ctx.fill()
    ctx.restore()
    return
  }
  const delivery = look?.delivery ?? 'bolt'
  if (delivery === 'swing') return
  const now = look?.now ?? 0
  const still = look?.still ?? false
  const effect = leadEffect(p.mods, p.lifedrain)
  const ink = inkOf(delivery, p.damageType, effect)

  const dx = p.toPos.x - p.pos.x
  const dy = p.toPos.y - p.pos.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const crit = p.isCrit

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // The trail goes down first, so the shot's body sits on top of it.
  const tail = (delivery === 'arrow' ? 12 : delivery === 'bolt' ? 6 : 4) * (crit ? 1.3 : 1)
  drawTrail(ctx, effect, ink, p.pos.x - ux * tail, p.pos.y - uy * tail, ux, uy, crit ? 32 : 26, now, still, p.id)

  if (delivery === 'arrow') drawArrow(ctx, p.pos.x, p.pos.y, ux, uy, crit, ink, effect)
  else if (delivery === 'knife') drawKnife(ctx, p.pos.x, p.pos.y, crit, still ? Math.atan2(uy, ux) : now * 26 + idPhase(p.id), effect ? ink : null)
  else if (delivery === 'stone') drawStone(ctx, p.pos.x, p.pos.y, crit, ink)
  else drawBolt(ctx, p.pos.x, p.pos.y, ux, uy, crit, p.splashRadius > 0, ink)
  ctx.restore()
}

/** A stable small number per projectile id, so two knives never spin in lockstep. */
function idPhase(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return (h & 255) / 40
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, ux: number, uy: number, crit: boolean, ink: EffectInk, effect: HitEffect | null): void {
  const L = crit ? 30 : 26
  const tx = x + ux * L * 0.45
  const ty = y + uy * L * 0.45
  const bx = x - ux * L * 0.55
  const by = y - uy * L * 0.55
  const nx = -uy
  const ny = ux
  // Contour, then the shaft.
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 4.6
  ctx.beginPath()
  ctx.moveTo(bx, by)
  ctx.lineTo(tx, ty)
  ctx.stroke()
  ctx.strokeStyle = '#d9b77e'
  ctx.lineWidth = 2.4
  ctx.stroke()
  // Fletching: two white vanes at the nock.
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 3.4
  ctx.beginPath()
  ctx.moveTo(bx + ux * 5, by + uy * 5)
  ctx.lineTo(bx - ux * 1 + nx * 4, by - uy * 1 + ny * 4)
  ctx.moveTo(bx + ux * 5, by + uy * 5)
  ctx.lineTo(bx - ux * 1 - nx * 4, by - uy * 1 - ny * 4)
  ctx.stroke()
  ctx.strokeStyle = crit ? '#ffd166' : '#f4efe6'
  ctx.lineWidth = 1.6
  ctx.stroke()
  // The head: a steel (or enchanted) barb, outlined.
  const hx = tx + ux * 4
  const hy = ty + uy * 4
  ctx.beginPath()
  ctx.moveTo(hx + ux * 4, hy + uy * 4)
  ctx.lineTo(hx - ux * 5 + nx * 5, hy - uy * 5 + ny * 5)
  ctx.lineTo(hx - ux * 5 - nx * 5, hy - uy * 5 - ny * 5)
  ctx.closePath()
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = effect ? ink.glow : crit ? '#ffd166' : '#eef3f6'
  ctx.fill()
}

function drawKnife(ctx: CanvasRenderingContext2D, x: number, y: number, crit: boolean, angle: number, ink: EffectInk | null): void {
  const L = crit ? 11 : 9
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  ctx.beginPath()
  ctx.moveTo(x + c * L, y + s * L)
  ctx.lineTo(x - s * 3.2, y + c * 3.2)
  ctx.lineTo(x - c * L * 0.7, y - s * L * 0.7)
  ctx.lineTo(x + s * 3.2, y - c * 3.2)
  ctx.closePath()
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 2.2
  ctx.stroke()
  ctx.fillStyle = ink ? ink.glow : crit ? '#ffd166' : '#e9eef2'
  ctx.fill()
}

function drawStone(ctx: CanvasRenderingContext2D, x: number, y: number, crit: boolean, ink: EffectInk): void {
  const r = crit ? 4 : 3.2
  ctx.beginPath()
  ctx.arc(x, y, r + 1, 0, TAU)
  ctx.fillStyle = OUTLINE
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fillStyle = ink.glow
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, TAU)
  ctx.fillStyle = ink.core
  ctx.fill()
}

/** A magic (or enchanted) bolt: an outlined orb with a hot core, stretched along its flight. */
function drawBolt(ctx: CanvasRenderingContext2D, x: number, y: number, ux: number, uy: number, crit: boolean, burst: boolean, ink: EffectInk): void {
  const r = burst ? 6 : crit ? 6.5 : 5
  // Stretched: a short smear behind the orb in the glow ink.
  ctx.strokeStyle = hexToRgba(ink.glow, 0.55)
  ctx.lineWidth = r * 1.7
  ctx.beginPath()
  ctx.moveTo(x - ux * r * 2.2, y - uy * r * 2.2)
  ctx.lineTo(x, y)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, y, r + 1.2, 0, TAU)
  ctx.fillStyle = OUTLINE
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fillStyle = ink.glow
  ctx.fill()
  if (crit) {
    ctx.beginPath()
    ctx.arc(x, y, r - 0.8, 0, TAU)
    ctx.strokeStyle = '#ffd166'
    ctx.lineWidth = 1.6
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(x - r * 0.22, y - r * 0.22, r * 0.5, 0, TAU)
  ctx.fillStyle = lighten(ink.core, 0.2)
  ctx.fill()
}

/**
 * The trail behind a shot, from (x, y) back along −u for `len` px, in the
 * shape of its lead effect. Everything is a handful of arcs and strokes —
 * no particles, no allocation — and holds still under reduced motion.
 */
function drawTrail(
  ctx: CanvasRenderingContext2D,
  effect: HitEffect | null,
  ink: EffectInk,
  x: number,
  y: number,
  ux: number,
  uy: number,
  len: number,
  now: number,
  still: boolean,
  id: string,
): void {
  const nx = -uy
  const ny = ux
  const t = still ? 0 : now
  const ph = idPhase(id)
  if (effect === 'burn') {
    // Embers shed behind the shot: hot and big near it, small and red far off.
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) / 4
      const wob = Math.sin(t * 31 + i * 2.1 + ph) * 3 * k
      ctx.globalAlpha = 0.95 - k * 0.55
      ctx.fillStyle = i % 2 ? ink.core : ink.glow
      ctx.beginPath()
      ctx.arc(x - ux * len * k + nx * wob, y - uy * len * k + ny * wob - k * 4, 4.6 * (1 - k * 0.55), 0, TAU)
      ctx.fill()
    }
  } else if (effect === 'chill') {
    // A cold streak and three frost shards (diamonds) strung along it.
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = ink.glow
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - ux * len, y - uy * len)
    ctx.stroke()
    for (let i = 0; i < 3; i++) {
      const k = (i + 0.6) / 3
      const cx = x - ux * len * k + nx * (i % 2 ? 3.5 : -3.5)
      const cy = y - uy * len * k + ny * (i % 2 ? 3.5 : -3.5)
      const r = 4 * (1 - k * 0.4)
      ctx.globalAlpha = 1 - k * 0.5
      ctx.beginPath()
      ctx.moveTo(cx, cy - r)
      ctx.lineTo(cx + r * 0.7, cy)
      ctx.lineTo(cx, cy + r)
      ctx.lineTo(cx - r * 0.7, cy)
      ctx.closePath()
      ctx.fillStyle = i % 2 ? ink.glow : ink.core
      ctx.fill()
    }
  } else if (effect === 'shock') {
    // A crackle: a jagged line that re-rolls ~20 times a second.
    let h = ((Math.floor(t * 20) + 1) * 2654435761 + ph * 977) >>> 0
    const rnd = () => {
      h = (h * 1664525 + 1013904223) >>> 0
      return h / 4294967296 - 0.5
    }
    ctx.beginPath()
    ctx.moveTo(x, y)
    for (let i = 1; i <= 4; i++) {
      const k = i / 4
      const o = rnd() * 12 * (1 - k * 0.3)
      ctx.lineTo(x - ux * len * k + nx * o, y - uy * len * k + ny * o)
    }
    ctx.globalAlpha = 0.7
    ctx.strokeStyle = ink.glow
    ctx.lineWidth = 4.4
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.strokeStyle = ink.spark
    ctx.lineWidth = 1.8
    ctx.stroke()
  } else if (effect === 'drain') {
    // A siphon: two red strands twisting round the flight line.
    for (let strand = 0; strand < 2; strand++) {
      ctx.beginPath()
      for (let i = 0; i <= 5; i++) {
        const k = i / 5
        const o = Math.sin(k * 6 + t * 18 + strand * Math.PI + ph) * 4.2 * (1 - k * 0.4)
        const px = x - ux * len * k + nx * o
        const py = y - uy * len * k + ny * o
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.globalAlpha = 0.85
      ctx.strokeStyle = strand ? ink.glow : ink.spark
      ctx.lineWidth = 2.4
      ctx.stroke()
    }
  } else {
    // No element: the old three-step fading tail, in the delivery's own ink.
    for (let i = 3; i >= 1; i--) {
      const k = i / 3
      ctx.globalAlpha = 0.14 + (1 - k) * 0.3
      ctx.fillStyle = ink.glow
      ctx.beginPath()
      ctx.arc(x - ux * len * 0.6 * k, y - uy * len * 0.6 * k, 3.2 * (1 - k * 0.55), 0, TAU)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1
}

/**
 * A blow in progress — the melee hero's hit, drawn where it lands and never as
 * a projectile (the designer: "if a weapon is melee it shouldnt fire
 * projectiles").
 *
 * The engine still carries a melee hit as a projectile: it crosses the reach in
 * ≤ 0.17 s and the damage lands on arrival (the balance is that timing, so it
 * is not touched). Its travelled fraction is used here as the swing's
 * PROGRESS: a blade arc centred on the hero — a swing goes round the one
 * holding it — sweeping across the target and reaching it exactly as the hit
 * lands. The arc is in the effect's ink (`attackLook.EFFECT_INK`), so a
 * flaming sword's blow is orange-gold, a frost axe's cold teal, a shocking
 * hammer's crackling white-blue. The lingering mark at the moment of impact,
 * and the effect's own particles, are `fx.fxImpact`'s (`delivery: 'swing'`).
 *
 * Under reduced motion the arc is drawn whole for the blow's brief life
 * instead of sweeping: it is the tell that a hit is coming, not travel.
 */
export function drawSwing(ctx: CanvasRenderingContext2D, p: RtProjectile, from: Vec2, still: boolean): void {
  const tx = p.toPos.x
  const ty = p.toPos.y
  const R = Math.hypot(tx - from.x, ty - from.y)
  if (R < 4) return
  const left = Math.hypot(tx - p.pos.x, ty - p.pos.y)
  const prog = still ? 1 : Math.max(0, Math.min(1, 1 - left / R))
  const ink = inkOf('swing', p.damageType, leadEffect(p.mods, p.lifedrain))
  drawSlashArc(ctx, from.x, from.y - SWING_LIFT, R, Math.atan2(ty - from.y, tx - from.x), swingSide(p.id), prog, 1, ink, p.isCrit)
}

/** Which way a blow sweeps — alternating per shot, so a flurry reads as a flurry. */
export function swingSide(id: string): 1 | -1 {
  return id.charCodeAt(id.length - 1) & 1 ? 1 : -1
}

/** The angular width of a swing at radius R: ~52 px of arc, capped. */
export const swingSpan = (R: number): number => Math.min(1.6, 52 / Math.max(R, 1))

/**
 * One blade arc round (cx, cy) at radius R, through angle `mid`, sweeping in
 * direction `side`. `prog` 0→1 is how far the edge has travelled (it reaches
 * `mid` + half the span at 1), `alpha` fades the whole mark. Drawn as three
 * tapered strokes: a soft wide glow, the hot edge, and a thin highlight.
 * Shared with `fx.ts`'s lingering slash so the blow and its mark are one shape.
 */
export function drawSlashArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  mid: number,
  side: 1 | -1,
  prog: number,
  alpha: number,
  ink: EffectInk,
  crit: boolean,
): void {
  if (prog <= 0 || alpha <= 0) return
  const span = swingSpan(R) * (crit ? 1.25 : 1)
  const a0 = mid - (span / 2) * side
  const lead = a0 + span * prog * side
  const H = crit ? 12 : 9
  ctx.save()
  // The soft glow (the effect's ink), then the hot blade, then a bright edge.
  crescent(ctx, cx, cy, R, a0, lead, H + 7)
  ctx.globalAlpha = alpha * 0.45
  ctx.fillStyle = ink.glow
  ctx.fill()
  crescent(ctx, cx, cy, R, a0, lead, H)
  ctx.globalAlpha = alpha
  ctx.fillStyle = crit ? '#ffd166' : ink.core
  ctx.fill()
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = 1
  ctx.globalAlpha = alpha * 0.5
  ctx.stroke()
  ctx.restore()
}

/**
 * A blade-shaped crescent along the circle (cx, cy, R) from angle `from` to
 * `to`: pointed at the trailing end, fullest just behind the leading edge,
 * `H` px thick at most. Sixteen points — one path, filled.
 */
function crescent(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number, from: number, to: number, H: number): void {
  const N = 8
  ctx.beginPath()
  for (let i = 0; i <= N; i++) {
    const u = i / N
    const a = from + (to - from) * u
    const h = H * Math.pow(Math.sin(Math.PI * (0.06 + 0.8 * u)), 0.8) * 0.5
    const x = cx + Math.cos(a) * (R + h)
    const y = cy + Math.sin(a) * (R + h)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  for (let i = N; i >= 0; i--) {
    const u = i / N
    const a = from + (to - from) * u
    const h = H * Math.pow(Math.sin(Math.PI * (0.06 + 0.8 * u)), 0.8) * 0.5
    ctx.lineTo(cx + Math.cos(a) * (R - h), cy + Math.sin(a) * (R - h))
  }
  ctx.closePath()
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
