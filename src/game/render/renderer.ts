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
  hp: number
  maxHp: number
  downed: boolean
  procFlash: number
  patienceStacks: number
  blocking: boolean
}

export function sentinelFromRt(s: RtSentinel): DrawSentinel {
  return {
    pos: s.pos,
    archetype: s.def.archetype,
    color: s.def.color,
    accent: s.def.accent,
    range: s.profile.range,
    aimAngle: s.aimAngle,
    fireFlash: s.fireFlash,
    hp: s.hp,
    maxHp: s.maxHp,
    downed: s.downed,
    procFlash: s.procFlash,
    patienceStacks: s.patienceStacks,
    blocking: s.blockIds.length > 0,
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
  ctx.save()
  ctx.translate(pos.x, pos.y)

  if (s.downed) {
    // Fallen: a dim marker.
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.arc(0, 0, 13, 0, Math.PI * 2)
    ctx.fillStyle = '#2a2f2c'
    ctx.fill()
    ctx.strokeStyle = '#e05a4f'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#e05a4f'
    ctx.font = 'bold 13px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('✕', 0, 1)
    ctx.restore()
    return
  }

  const pulse = 1 + s.fireFlash * 0.18

  // Proc feedback ring (on-hit effect fired)
  if (s.procFlash > 0) {
    ctx.beginPath()
    ctx.arc(0, 0, 22, 0, Math.PI * 2)
    ctx.strokeStyle = hexToRgba('#ffe08a', s.procFlash * 0.7)
    ctx.lineWidth = 3
    ctx.stroke()
  }

  // Blocking indicator (holding enemies)
  if (s.blocking) {
    ctx.beginPath()
    ctx.arc(0, 0, 20, -0.5, Math.PI + 0.5)
    ctx.strokeStyle = hexToRgba('#e05a4f', 0.5)
    ctx.lineWidth = 2
    ctx.stroke()
  }

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

  // HP bar (only when damaged)
  const frac = Math.max(0, s.hp) / s.maxHp
  if (frac < 0.999) {
    const w = 30
    const y = 20
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    roundRect(ctx, -w / 2, y, w, 4, 2)
    ctx.fill()
    ctx.fillStyle = frac > 0.5 ? '#7ac74f' : frac > 0.25 ? '#e6b800' : '#e05a4f'
    roundRect(ctx, -w / 2, y, w * frac, 4, 2)
    ctx.fill()
  }

  // Patience pips (top-right of token)
  if (s.patienceStacks > 0) {
    for (let i = 0; i < s.patienceStacks; i++) {
      ctx.beginPath()
      ctx.arc(-12 + i * 5, -19, 1.8, 0, Math.PI * 2)
      ctx.fillStyle = '#9ec1f0'
      ctx.fill()
    }
  }

  ctx.restore()
}

const GLYPH: Record<Archetype, string> = { fighter: '⚔', rogue: '✦', mystic: '❋' }

export function drawEnemy(ctx: CanvasRenderingContext2D, e: RtEnemy, now: number): void {
  const { pos, type } = e
  const burning = now < e.burnUntil
  const chilled = now < e.chillUntil
  const stunned = now < e.stunUntil
  ctx.save()
  ctx.translate(pos.x, pos.y)

  ctx.beginPath()
  ctx.arc(0, 0, type.radius, 0, Math.PI * 2)
  ctx.fillStyle = chilled ? mix(type.color, '#8fd0ff', 0.4) : type.color
  ctx.fill()
  if (type.isBoss) {
    ctx.lineWidth = 3
    ctx.strokeStyle = '#e0aaff'
    ctx.stroke()
  }
  // Burning aura
  if (burning) {
    ctx.beginPath()
    ctx.arc(0, 0, type.radius + 3, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(240,120,50,0.7)'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  // Stun stars
  if (stunned) {
    ctx.fillStyle = '#ffe08a'
    ctx.font = 'bold 11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('✦', 0, -type.radius - 6)
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

/** Convenience: draw a whole running battle from an engine. */
export function drawBattleEntities(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  const now = engine.elapsed
  for (const t of engine.traps) drawTrap(ctx, t.pos, now)

  // Faint aura rings for support Sentinels (cleric/guard).
  for (const s of engine.sentinels) {
    if (s.downed) continue
    const m = s.profile.mods
    const aura = m.healAura ?? m.buffAura ?? m.dmgReductionAura
    if (aura) drawAura(ctx, s.pos, aura.radius, m.healAura ? '#7ac74f' : m.dmgReductionAura ? '#98c1d9' : '#f0a868', now)
  }

  const targeted = new Set(engine.sentinels.map((s) => s.targetId).filter(Boolean) as string[])
  for (const e of engine.enemies) drawEnemy(ctx, e, now)
  for (const e of engine.enemies) if (targeted.has(e.id)) drawReticle(ctx, e.pos, e.type.radius)
  for (const s of engine.sentinels) drawSentinel(ctx, sentinelFromRt(s))
  for (const p of engine.projectiles) drawProjectile(ctx, p)
  for (const f of engine.floaters) drawFloater(ctx, f)
}

function drawAura(ctx: CanvasRenderingContext2D, pos: Vec2, radius: number, color: string, now: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(now * 2 + pos.x * 0.05)
  ctx.save()
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
  ctx.strokeStyle = hexToRgba(color, 0.1 + pulse * 0.1)
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 8])
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

function drawReticle(ctx: CanvasRenderingContext2D, pos: Vec2, r: number): void {
  ctx.save()
  ctx.translate(pos.x, pos.y)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 1.5
  const rr = r + 5
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    const a = (i * Math.PI) / 2 + Math.PI / 4
    ctx.arc(0, 0, rr, a - 0.35, a + 0.35)
    ctx.stroke()
  }
  ctx.restore()
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

/** Blend two hex colors, t=0 → a, t=1 → b. Returns an rgb() string. */
export function mix(a: string, b: string, t: number): string {
  const pa = a.replace('#', '')
  const pb = b.replace('#', '')
  const ar = parseInt(pa.substring(0, 2), 16)
  const ag = parseInt(pa.substring(2, 4), 16)
  const ab = parseInt(pa.substring(4, 6), 16)
  const br = parseInt(pb.substring(0, 2), 16)
  const bg = parseInt(pb.substring(2, 4), 16)
  const bb = parseInt(pb.substring(4, 6), 16)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `rgb(${r},${g},${bl})`
}

/** Archetype accent used by UI chips too. */
export function archetypeColor(a: Archetype): string {
  return ARCHETYPES[a].color
}
