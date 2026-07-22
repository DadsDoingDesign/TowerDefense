import type { GameEngine, RtEnemy, RtProjectile, RtSentinel, FloatingText } from '../engine/engine'
import { ARCHETYPES } from '../data/sentinels'
import type { Vec2 } from '../core/vec'
import type { Archetype, GameMap } from '../types'

export interface View {
  scale: number
  ox: number
  oy: number
}

/** Compute a letterbox transform mapping the logical field into the css box. */
export function fitView(cssW: number, cssH: number, map: GameMap): View {
  const scale = Math.min(cssW / map.width, cssH / map.height)
  const ox = (cssW - map.width * scale) / 2
  const oy = (cssH - map.height * scale) / 2
  return { scale, ox, oy }
}

/** A minimal, uniform description of a tower to draw (works for setup + battle). */
export interface DrawSentinel {
  pos: Vec2
  archetype: Archetype
  color: string
  accent: string
  range: number
  aimAngle: number
  fireFlash: number
}

export function sentinelFromRt(s: RtSentinel): DrawSentinel {
  return {
    pos: s.pos,
    archetype: s.def.archetype,
    color: s.def.color,
    accent: s.def.accent,
    range: s.eff.range,
    aimAngle: s.aimAngle,
    fireFlash: s.fireFlash,
  }
}

const COLORS = {
  fieldTop: '#141b17',
  fieldBottom: '#0d1411',
  grid: 'rgba(255,255,255,0.03)',
  pathFill: '#2a2620',
  pathEdge: '#3a352b',
  pathCenter: 'rgba(210,180,120,0.10)',
  base: '#3d5a80',
  baseCore: '#98c1d9',
  slot: 'rgba(255,255,255,0.16)',
  slotFill: 'rgba(255,255,255,0.04)',
  slotHover: '#f0a868',
  slotSelected: '#98c1d9',
}

/** Full background: gradient field + subtle grid + path + base marker. */
export function drawField(ctx: CanvasRenderingContext2D, map: GameMap): void {
  const grad = ctx.createLinearGradient(0, 0, 0, map.height)
  grad.addColorStop(0, COLORS.fieldTop)
  grad.addColorStop(1, COLORS.fieldBottom)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, map.width, map.height)

  // Faint grid for a "tactical map" read.
  ctx.strokeStyle = COLORS.grid
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = 0; x <= map.width; x += 48) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, map.height)
  }
  for (let y = 0; y <= map.height; y += 48) {
    ctx.moveTo(0, y)
    ctx.lineTo(map.width, y)
  }
  ctx.stroke()

  drawPath(ctx, map.path)
  drawBase(ctx, map.base)
}

function drawPath(ctx: CanvasRenderingContext2D, pts: Vec2[]): void {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  ctx.strokeStyle = COLORS.pathEdge
  ctx.lineWidth = 46
  strokePolyline(ctx, pts)

  ctx.strokeStyle = COLORS.pathFill
  ctx.lineWidth = 38
  strokePolyline(ctx, pts)

  ctx.strokeStyle = COLORS.pathCenter
  ctx.lineWidth = 2
  ctx.setLineDash([10, 14])
  strokePolyline(ctx, pts)
  ctx.setLineDash([])
}

function strokePolyline(ctx: CanvasRenderingContext2D, pts: Vec2[]): void {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
}

function drawBase(ctx: CanvasRenderingContext2D, base: Vec2): void {
  ctx.save()
  ctx.translate(base.x - 6, base.y)
  // Outer plate
  ctx.fillStyle = COLORS.base
  roundRect(ctx, -26, -30, 52, 60, 8)
  ctx.fill()
  // Core
  ctx.fillStyle = COLORS.baseCore
  ctx.beginPath()
  ctx.arc(0, 0, 12, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawSlot(
  ctx: CanvasRenderingContext2D,
  pos: Vec2,
  state: 'empty' | 'hover' | 'selected',
): void {
  ctx.save()
  ctx.translate(pos.x, pos.y)
  ctx.beginPath()
  ctx.arc(0, 0, 20, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.slotFill
  ctx.fill()
  ctx.setLineDash([4, 5])
  ctx.lineWidth = 2
  ctx.strokeStyle =
    state === 'hover' ? COLORS.slotHover : state === 'selected' ? COLORS.slotSelected : COLORS.slot
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

export function drawRange(ctx: CanvasRenderingContext2D, pos: Vec2, range: number, color: string): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, range, 0, Math.PI * 2)
  ctx.fillStyle = hexToRgba(color, 0.06)
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = hexToRgba(color, 0.35)
  ctx.stroke()
  ctx.restore()
}

export function drawSentinel(ctx: CanvasRenderingContext2D, s: DrawSentinel): void {
  const { pos } = s
  const pulse = 1 + s.fireFlash * 0.18
  ctx.save()
  ctx.translate(pos.x, pos.y)

  // Barrel/indicator pointing at target
  ctx.save()
  ctx.rotate(s.aimAngle)
  ctx.fillStyle = s.accent
  roundRect(ctx, 6, -3.5, 18 * pulse, 7, 3)
  ctx.fill()
  ctx.restore()

  // Body token
  ctx.beginPath()
  ctx.arc(0, 0, 15 * pulse, 0, Math.PI * 2)
  ctx.fillStyle = s.color
  ctx.fill()
  ctx.lineWidth = 2.5
  ctx.strokeStyle = s.accent
  ctx.stroke()

  // Muzzle flash glow
  if (s.fireFlash > 0) {
    ctx.beginPath()
    ctx.arc(0, 0, 15 * pulse + 4, 0, Math.PI * 2)
    ctx.strokeStyle = hexToRgba(s.accent, s.fireFlash * 0.6)
    ctx.lineWidth = 3
    ctx.stroke()
  }

  // Archetype glyph
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.font = 'bold 14px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(GLYPH[s.archetype], 0, 1)

  ctx.restore()
}

const GLYPH: Record<Archetype, string> = { fighter: '⚔', rogue: '✦', mystic: '❋' }

export function drawEnemy(ctx: CanvasRenderingContext2D, e: RtEnemy): void {
  const { pos, type } = e
  ctx.save()
  ctx.translate(pos.x, pos.y)

  ctx.beginPath()
  ctx.arc(0, 0, type.radius, 0, Math.PI * 2)
  ctx.fillStyle = type.color
  ctx.fill()
  if (type.isBoss) {
    ctx.lineWidth = 3
    ctx.strokeStyle = '#e0aaff'
    ctx.stroke()
  }
  if (e.hitFlash > 0) {
    ctx.beginPath()
    ctx.arc(0, 0, type.radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${e.hitFlash * 0.7})`
    ctx.fill()
  }

  // HP bar
  const frac = Math.max(0, e.hp) / e.maxHp
  if (frac < 1) {
    const w = Math.max(type.radius * 2, 22)
    const y = -type.radius - 8
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    roundRect(ctx, -w / 2, y, w, 4, 2)
    ctx.fill()
    ctx.fillStyle = frac > 0.5 ? '#7ac74f' : frac > 0.25 ? '#e6b800' : '#e05a4f'
    roundRect(ctx, -w / 2, y, w * frac, 4, 2)
    ctx.fill()
  }
  ctx.restore()
}

export function drawProjectile(ctx: CanvasRenderingContext2D, p: RtProjectile): void {
  ctx.save()
  ctx.beginPath()
  const r = p.splashRadius > 0 ? 5 : p.isCrit ? 4.5 : 3.5
  ctx.arc(p.pos.x, p.pos.y, r, 0, Math.PI * 2)
  ctx.fillStyle = p.color
  ctx.shadowColor = p.color
  ctx.shadowBlur = 8
  ctx.fill()
  ctx.restore()
}

export function drawFloater(ctx: CanvasRenderingContext2D, f: FloatingText): void {
  const alpha = Math.max(0, f.life / f.maxLife)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = f.color
  ctx.font = 'bold 13px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(f.text, f.pos.x, f.pos.y)
  ctx.restore()
}

/** Convenience: draw a whole running battle from an engine. */
export function drawBattleEntities(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  for (const e of engine.enemies) drawEnemy(ctx, e)
  for (const s of engine.sentinels) drawSentinel(ctx, sentinelFromRt(s))
  for (const p of engine.projectiles) drawProjectile(ctx, p)
  for (const f of engine.floaters) drawFloater(ctx, f)
}

// ---- small canvas helpers ----

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Archetype accent used by UI chips too. */
export function archetypeColor(a: Archetype): string {
  return ARCHETYPES[a].color
}
