/** The theme gallery's sample scene. */
import type { Vec2 } from '../core/vec'
import { ARCHETYPES } from '../data/sentinels'
import type { Archetype } from '../types'
import { pixmap } from './pixmap'
import { getSprite } from './sprites'
import { getActiveStyle } from './themes'
import { darken, lighten, radialFill, shapePath, strokePolyline } from './paint'
import { blitPixmap } from './blit'
import { drawSentinel } from './units'
import { drawProjectile } from './projectiles'

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
  if (style.sprites && grassImg) {
    ctx.fillStyle = ctx.createPattern(grassImg, 'repeat')!
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fillRect(0, 0, w, h)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = style.path.edge
    ctx.lineWidth = 22
    strokePolyline(ctx, pts)
    ctx.strokeStyle = roadImg ? ctx.createPattern(roadImg, 'repeat')! : style.path.fill
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
    { x: w * 0.62, y: h * 0.72, color: '#8a5ec0', r: 9, id: 'barrel3' },
    { x: w * 0.82, y: h * 0.72, color: '#d0563a', r: 7, id: 'torch2' },
  ]
  for (const e of enemyDemo) {
    const es = style.enemy
    ctx.save()
    ctx.translate(e.x, e.y)
    const espr = style.sprites ? getSprite(style.sprites.pack, e.id) : undefined
    if (espr) {
      /**
       * The last non-1.000 sprite draw in the codebase, removed (minor).
       *
       * This was `drawImage(espr, …, sz, sz)` with `sz = radius × enemyScale` —
       * a gameplay number times a deprecated multiplier, squashed into a square
       * destination: exactly the three defects the whole Phase-3 pixel pipeline
       * was built to end, still sitting here. It is unreachable today (only
       * `tinyswords` is ever the active theme and nothing calls this), which is
       * precisely why it had to go: it would have reintroduced the defect
       * silently on the day a theme picker landed, in the one screen whose job
       * is to show the player what the art looks like.
       */
      const pm = pixmap(espr, { scale: style.sprites!.spriteScale, ring: true })
      if (pm) blitPixmap(ctx, pm, 0, 0, e.r * 0.55)
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
      id: `preview-${tw.a}`,
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
    toPos: { x: w * 0.72, y: h * 0.7 },
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
