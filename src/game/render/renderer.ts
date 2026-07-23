import type { GameEngine, RtEnemy, RtProjectile, RtSentinel, FloatingText } from '../engine/engine'
import { ARCHETYPES } from '../data/sentinels'
import type { Vec2 } from '../core/vec'
import type { Archetype, GameMap } from '../types'
import { getActiveStyle } from './themes'
import { getSprite } from './sprites'

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
  base: '#3d5a80',
  baseCore: '#98c1d9',
  slot: 'rgba(255,255,255,0.16)',
  slotFill: 'rgba(255,255,255,0.04)',
  slotHover: '#f0a868',
  slotSelected: '#98c1d9',
}

/** Full background: gradient field + subtle grid + path + base marker. */
export function drawField(ctx: CanvasRenderingContext2D, map: GameMap): void {
  const style = getActiveStyle()

  // Sprite themes tile real terrain, then fall back to procedural if not loaded.
  if (style.sprites) {
    const grass = getSprite(style.sprites.pack, 'grass')
    const road = getSprite(style.sprites.pack, 'road')
    if (grass && road) {
      drawSpriteTerrain(ctx, map, grass, road, style.path.edge)
      drawBase(ctx, map.base)
      return
    }
  }

  const grad = ctx.createLinearGradient(0, 0, 0, map.height)
  grad.addColorStop(0, style.field.top)
  grad.addColorStop(1, style.field.bottom)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, map.width, map.height)

  ctx.strokeStyle = style.field.grid
  ctx.lineWidth = 1
  ctx.beginPath()
  const step = style.field.gridStep
  for (let x = 0; x <= map.width; x += step) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, map.height)
  }
  for (let y = 0; y <= map.height; y += step) {
    ctx.moveTo(0, y)
    ctx.lineTo(map.width, y)
  }
  ctx.stroke()

  drawPath(ctx, map.path)
  drawBase(ctx, map.base)
}

function drawPath(ctx: CanvasRenderingContext2D, pts: Vec2[]): void {
  const p = getActiveStyle().path
  ctx.lineJoin = 'round'
  ctx.lineCap = p.cap

  ctx.strokeStyle = p.edge
  ctx.lineWidth = p.edgeWidth
  strokePolyline(ctx, pts)

  ctx.strokeStyle = p.fill
  ctx.lineWidth = p.fillWidth
  strokePolyline(ctx, pts)

  ctx.strokeStyle = p.center
  ctx.lineWidth = 2
  if (p.dash) ctx.setLineDash(p.dash)
  strokePolyline(ctx, pts)
  ctx.setLineDash([])
}

function strokePolyline(ctx: CanvasRenderingContext2D, pts: Vec2[]): void {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
}

/** Tile a grass field and stroke a dirt road along the path (sprite themes). */
function drawSpriteTerrain(
  ctx: CanvasRenderingContext2D,
  map: GameMap,
  grass: HTMLImageElement,
  road: HTMLImageElement,
  edgeColor: string,
): void {
  const scale = new DOMMatrix([1.4, 0, 0, 1.4, 0, 0])
  const gp = ctx.createPattern(grass, 'repeat')!
  gp.setTransform(scale)
  ctx.fillStyle = gp
  ctx.fillRect(0, 0, map.width, map.height)
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.fillRect(0, 0, map.width, map.height)

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = edgeColor
  ctx.lineWidth = 46
  strokePolyline(ctx, map.path)
  const rp = ctx.createPattern(road, 'repeat')!
  rp.setTransform(scale)
  ctx.strokeStyle = rp
  ctx.lineWidth = 38
  strokePolyline(ctx, map.path)
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

  const style = getActiveStyle()
  const t = style.token
  const r = 15 * pulse
  const sprite = style.sprites ? getSprite(style.sprites.pack, s.archetype) : undefined

  if (sprite) {
    // Grounding shadow + faction-tinted ring so archetypes stay readable.
    ctx.beginPath()
    ctx.ellipse(0, 13, 14, 5, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.32)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, 2, 16, 0, Math.PI * 2)
    ctx.strokeStyle = hexToRgba(s.accent, 0.6)
    ctx.lineWidth = 2
    ctx.stroke()
    const sz = 15 * pulse * (style.sprites!.towerScale)
    ctx.drawImage(sprite, -sz / 2, -sz / 2 - 5, sz, sz)
    if (s.fireFlash > 0) {
      ctx.beginPath()
      ctx.arc(0, 2, 18, 0, Math.PI * 2)
      ctx.strokeStyle = hexToRgba(s.accent, s.fireFlash * 0.7)
      ctx.lineWidth = 3
      ctx.stroke()
    }
  } else {
    // Barrel/indicator pointing at target (themes that use it)
    if (t.barrel) {
      ctx.save()
      ctx.rotate(s.aimAngle)
      ctx.fillStyle = s.accent
      roundRect(ctx, 6, -3.5, 18 * pulse, 7, 3)
      ctx.fill()
      ctx.restore()
    }

    if (t.glow > 0) {
      ctx.shadowColor = s.accent
      ctx.shadowBlur = t.glow
    }
    if (t.shape === 'ring') {
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.lineWidth = t.outline + 1
      ctx.strokeStyle = s.color
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, r - 4, 0, Math.PI * 2)
      ctx.lineWidth = 2
      ctx.strokeStyle = s.accent
      ctx.stroke()
      ctx.shadowBlur = 0
    } else {
      shapePath(ctx, t.shape, r)
      ctx.fillStyle = t.gradient ? radialFill(ctx, r, s.accent, s.color) : s.color
      ctx.fill()
      ctx.shadowBlur = 0
      if (t.outline > 0) {
        ctx.lineWidth = t.outline
        ctx.strokeStyle = t.shape === 'circle' || t.shape === 'gem' ? s.accent : darken(s.color, 0.45)
        ctx.stroke()
      }
    }

    if (s.fireFlash > 0) {
      ctx.beginPath()
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2)
      ctx.strokeStyle = hexToRgba(s.accent, s.fireFlash * 0.6)
      ctx.lineWidth = 3
      ctx.stroke()
    }

    // Archetype glyph
    ctx.fillStyle = t.shape === 'ring' ? s.accent : 'rgba(0,0,0,0.6)'
    ctx.font = 'bold 14px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(GLYPH[s.archetype], 0, 1)
  }

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

  const style = getActiveStyle()
  const es = style.enemy
  const fill = chilled ? mix(type.color, '#8fd0ff', 0.4) : type.color
  const sprite = style.sprites ? getSprite(style.sprites.pack, type.id) : undefined

  if (sprite) {
    // Grounding shadow + real monster sprite scaled to the enemy's radius.
    ctx.beginPath()
    ctx.ellipse(0, type.radius * 0.7, type.radius * 0.9, type.radius * 0.35, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fill()
    const sz = type.radius * style.sprites!.enemyScale
    ctx.drawImage(sprite, -sz / 2, -sz / 2 - type.radius * 0.25, sz, sz)
    if (chilled) {
      ctx.beginPath()
      ctx.arc(0, 0, type.radius, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(120,190,255,0.28)'
      ctx.fill()
    }
    if (type.isBoss) {
      ctx.beginPath()
      ctx.arc(0, 0, sz / 2 + 2, 0, Math.PI * 2)
      ctx.strokeStyle = '#e0aaff'
      ctx.lineWidth = 2.5
      ctx.stroke()
    }
  } else {
    if (es.glow > 0) {
      ctx.shadowColor = fill
      ctx.shadowBlur = es.glow
    }
    if (es.shape === 'ring') {
      ctx.beginPath()
      ctx.arc(0, 0, type.radius, 0, Math.PI * 2)
      ctx.lineWidth = es.outline + 1.5
      ctx.strokeStyle = fill
      ctx.stroke()
    } else {
      shapePath(ctx, es.shape, type.radius)
      ctx.fillStyle = es.gradient ? radialFill(ctx, type.radius, lighten(fill, 0.3), fill) : fill
      ctx.fill()
      if (es.outline > 0) {
        ctx.lineWidth = es.outline
        ctx.strokeStyle = darken(fill, 0.45)
        ctx.stroke()
      }
    }
    ctx.shadowBlur = 0
    if (type.isBoss) {
      ctx.beginPath()
      ctx.arc(0, 0, type.radius, 0, Math.PI * 2)
      ctx.lineWidth = 3
      ctx.strokeStyle = '#e0aaff'
      ctx.stroke()
    }
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
  const pr = getActiveStyle().projectile
  ctx.save()
  const r = p.splashRadius > 0 ? 5 : p.isCrit ? 4.5 : 3.5
  ctx.fillStyle = p.color
  if (pr.glow > 0) {
    ctx.shadowColor = p.color
    ctx.shadowBlur = pr.glow
  }
  if (pr.square) {
    roundRect(ctx, p.pos.x - r, p.pos.y - r, r * 2, r * 2, 1)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.arc(p.pos.x, p.pos.y, r, 0, Math.PI * 2)
    ctx.fill()
  }
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

// ---- theme shape + color helpers ----

/** Trace a shape path centered at the origin (caller fills/strokes). */
function shapePath(ctx: CanvasRenderingContext2D, shape: string, r: number): void {
  ctx.beginPath()
  if (shape === 'square') {
    const rr = Math.min(3, r / 2)
    ctx.moveTo(-r + rr, -r)
    ctx.arcTo(r, -r, r, r, rr)
    ctx.arcTo(r, r, -r, r, rr)
    ctx.arcTo(-r, r, -r, -r, rr)
    ctx.arcTo(-r, -r, r, -r, rr)
    ctx.closePath()
  } else if (shape === 'gem') {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.closePath()
  } else {
    ctx.arc(0, 0, r, 0, Math.PI * 2)
  }
}

function radialFill(ctx: CanvasRenderingContext2D, r: number, inner: string, outer: string): CanvasGradient {
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r)
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  return g
}

function toRgb(c: string): [number, number, number] {
  if (c.startsWith('#')) {
    const h = c.replace('#', '')
    return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)]
  }
  const m = c.match(/\d+/g)
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [128, 128, 128]
}
function darken(c: string, t: number): string {
  const [r, g, b] = toRgb(c)
  return `rgb(${Math.round(r * (1 - t))},${Math.round(g * (1 - t))},${Math.round(b * (1 - t))})`
}
function lighten(c: string, t: number): string {
  const [r, g, b] = toRgb(c)
  return `rgb(${Math.round(r + (255 - r) * t)},${Math.round(g + (255 - g) * t)},${Math.round(b + (255 - b) * t)})`
}

/**
 * Draw a small sample scene (path + 3 towers + 2 enemies + a shot) for the theme
 * gallery. Uses whatever theme is currently active — wrap in withStyle().
 */
export function drawThemePreview(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const style = getActiveStyle()
  const pts: Vec2[] = [
    { x: -10, y: h * 0.3 },
    { x: w * 0.4, y: h * 0.3 },
    { x: w * 0.4, y: h * 0.72 },
    { x: w + 10, y: h * 0.72 },
  ]

  // background + grid (or tiled terrain for sprite themes)
  const grassImg = style.sprites ? getSprite(style.sprites.pack, 'grass') : undefined
  const roadImg = style.sprites ? getSprite(style.sprites.pack, 'road') : undefined
  if (style.sprites && grassImg && roadImg) {
    ctx.fillStyle = ctx.createPattern(grassImg, 'repeat')!
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fillRect(0, 0, w, h)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = style.path.edge
    ctx.lineWidth = 22
    strokePolyline(ctx, pts)
    ctx.strokeStyle = ctx.createPattern(roadImg, 'repeat')!
    ctx.lineWidth = 17
    strokePolyline(ctx, pts)
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, style.field.top)
    grad.addColorStop(1, style.field.bottom)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = style.field.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 0; x <= w; x += style.field.gridStep / 2) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
    }
    ctx.stroke()

    const p = style.path
    ctx.lineJoin = 'round'
    ctx.lineCap = p.cap
    ctx.strokeStyle = p.edge
    ctx.lineWidth = p.edgeWidth * 0.5
    strokePolyline(ctx, pts)
    ctx.strokeStyle = p.fill
    ctx.lineWidth = p.fillWidth * 0.5
    strokePolyline(ctx, pts)
    ctx.strokeStyle = p.center
    ctx.lineWidth = 1.5
    if (p.dash) ctx.setLineDash(p.dash)
    strokePolyline(ctx, pts)
    ctx.setLineDash([])
  }

  // enemies on the path
  const enemyDemo = [
    { x: w * 0.62, y: h * 0.72, color: '#a8563c', r: 9, id: 'brute' },
    { x: w * 0.82, y: h * 0.72, color: '#8b9467', r: 7, id: 'grunt' },
  ]
  for (const e of enemyDemo) {
    const es = style.enemy
    ctx.save()
    ctx.translate(e.x, e.y)
    const espr = style.sprites ? getSprite(style.sprites.pack, e.id) : undefined
    if (espr) {
      const sz = e.r * style.sprites!.enemyScale
      ctx.drawImage(espr, -sz / 2, -sz / 2 - e.r * 0.25, sz, sz)
      ctx.restore()
      continue
    }
    if (es.glow > 0) {
      ctx.shadowColor = e.color
      ctx.shadowBlur = es.glow
    }
    if (es.shape === 'ring') {
      ctx.beginPath()
      ctx.arc(0, 0, e.r, 0, Math.PI * 2)
      ctx.lineWidth = es.outline + 1.5
      ctx.strokeStyle = e.color
      ctx.stroke()
    } else {
      shapePath(ctx, es.shape, e.r)
      ctx.fillStyle = es.gradient ? radialFill(ctx, e.r, lighten(e.color, 0.3), e.color) : e.color
      ctx.fill()
      if (es.outline > 0) {
        ctx.lineWidth = es.outline
        ctx.strokeStyle = darken(e.color, 0.45)
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  // 3 towers, one per archetype
  const towers: { x: number; y: number; a: Archetype }[] = [
    { x: w * 0.2, y: h * 0.55, a: 'fighter' },
    { x: w * 0.5, y: h * 0.48, a: 'rogue' },
    { x: w * 0.72, y: h * 0.45, a: 'mystic' },
  ]
  for (const tw of towers) {
    drawSentinel(ctx, {
      pos: { x: tw.x, y: tw.y },
      archetype: tw.a,
      color: ARCHETYPES[tw.a].color,
      accent: ARCHETYPES[tw.a].accent,
      range: 0,
      aimAngle: 0.4,
      fireFlash: 0,
      hp: 1,
      maxHp: 1,
      downed: false,
      procFlash: 0,
      patienceStacks: 0,
      blocking: false,
    })
  }

  // a projectile in flight
  drawProjectile(ctx, {
    id: 'demo',
    pos: { x: w * 0.58, y: h * 0.62 },
    toPos: { x: 0, y: 0 },
    targetId: null,
    srcId: '',
    damage: 0,
    damageType: 'physical',
    isCrit: true,
    speed: 0,
    splashRadius: 0,
    pierce: 0,
    color: ARCHETYPES.rogue.accent,
    mods: {},
    lifedrain: 0,
  })
}
