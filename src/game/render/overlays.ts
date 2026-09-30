/**
 * Field overlays: build slots, the placement dim, range rings, support auras,
 * target reticles, and the base gate / breach telegraphs.
 */
import type { Vec2 } from '../core/vec'
import type { GameMap } from '../types'
import { fxBaseState, fxNow, fxReducedMotion } from './fx'
import { animNow, getViewScale } from './frame'
import { COLORS, hexToRgba, roundRect, strokePolyline } from './paint'

/**
 * A build slot — the circle the coach tells a new player to tap.
 *
 * It used to be a r=20, 2px dashed ring in FIELD units, which the composite's
 * squeeze onto a phone turns into ~8 CSS px of radius and a sub-pixel line on
 * bright grass: the one target the first-run tip points at was the hardest
 * thing on the field to see (Wave 1). Three rules now:
 *
 *  - **A floor in screen space.** The radius is at least `SLOT_MIN_CSS_R` CSS px
 *    and the ring at least 2 CSS px, read off `viewScale` — the same
 *    composite-to-CSS scale the tier notch already uses (M2). It is capped at
 *    `SLOT_MAX_FIELD_R` field units so the two closest slots on any map (95
 *    units apart on the Green Line) never touch.
 *  - **Contrast on any ground.** A dark halo under a light ring, so it reads on
 *    sunlit grass and on the dirt lane alike.
 *  - **Armed = lit.** While a hero is selected for posting (`state` is
 *    'selected' or 'hover') the free slots turn solid gold and pulse, and the
 *    caller dims the rest of the field (`drawPlacementDim`). With reduced motion
 *    the pulse holds still at its brightest — a static highlight, never an
 *    absent one.
 */
const SLOT_MIN_CSS_R = 16
const SLOT_MAX_FIELD_R = 44
const SLOT_MIN_CSS_LINE = 2

export function drawSlot(
  ctx: CanvasRenderingContext2D,
  pos: Vec2,
  state: 'empty' | 'hover' | 'selected',
): void {
  const vs = Math.max(getViewScale(), 0.02)
  const r = Math.min(SLOT_MAX_FIELD_R, Math.max(20, SLOT_MIN_CSS_R / vs))
  const lw = Math.max(2, SLOT_MIN_CSS_LINE / vs)
  const armed = state !== 'empty'
  // 0..1. Held at 1 under reduced motion: the highlight stays, the motion goes.
  const pulse = armed ? (fxReducedMotion() ? 1 : 0.5 + 0.5 * Math.sin(animNow() * 5)) : 0

  ctx.save()
  ctx.translate(pos.x, pos.y)

  if (armed) {
    // The beckon: a soft ring breathing outward from the slot.
    ctx.beginPath()
    ctx.arc(0, 0, r + lw * (1.5 + 2 * pulse), 0, Math.PI * 2)
    ctx.lineWidth = lw * 1.5
    ctx.strokeStyle = `rgba(255, 224, 138, ${0.25 + 0.35 * pulse})`
    ctx.stroke()
  }

  // Fill: a dark wash when idle (reads on grass), warm light when armed.
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = armed ? `rgba(255, 236, 170, ${0.2 + 0.15 * pulse})` : 'rgba(20, 12, 6, 0.28)'
  ctx.fill()

  // Dark halo under the ring, then the ring itself.
  ctx.lineWidth = lw + 2 / vs
  ctx.strokeStyle = 'rgba(20, 12, 6, 0.6)'
  ctx.stroke()
  if (!armed) ctx.setLineDash([lw * 2.5, lw * 1.8])
  ctx.lineWidth = lw
  ctx.strokeStyle = state === 'hover' ? '#fff3c4' : armed ? COLORS.slotArmed : COLORS.slot
  ctx.stroke()
  ctx.setLineDash([])

  // A small plus at the centre: "something goes here".
  const arm = r * 0.32
  ctx.lineWidth = lw
  ctx.lineCap = 'round'
  ctx.strokeStyle = armed ? COLORS.slotArmed : COLORS.slot
  ctx.beginPath()
  ctx.moveTo(-arm, 0)
  ctx.lineTo(arm, 0)
  ctx.moveTo(0, -arm)
  ctx.lineTo(0, arm)
  ctx.stroke()
  ctx.restore()
}

/**
 * The deployment grid (G1-2): the open tiles, lit, while a hero is armed.
 *
 * The grid is only on screen when it is needed — a hero picked up in setup,
 * or the breather's one move — and then it is the brightest thing on a dimmed
 * field (`drawPlacementDim` goes down first). Open tiles get a warm wash and a
 * light outline, inset so neighbours read as separate squares; blocked tiles
 * get nothing, so they stay dark under the dim with their terrain showing. The
 * tile under the pointer (or the finger, while it is down) is lit harder.
 *
 * Line widths have a floor in SCREEN px (read off `viewScale`) so the outline
 * is ≥ 1.5 CSS px on a phone, where a tile is ~44 CSS px. With reduced motion
 * the breathing wash holds still at its brightest.
 */
export function drawTileGrid(
  ctx: CanvasRenderingContext2D,
  map: GameMap,
  opts: { hover: string | null; faint?: boolean; skip?: ReadonlySet<string> },
): void {
  const T = map.tile ?? 80
  const vs = Math.max(getViewScale(), 0.02)
  const pulse = fxReducedMotion() ? 1 : 0.5 + 0.5 * Math.sin(animNow() * 3)
  const k = opts.faint ? 0.55 : 1
  const inset = Math.max(3, 2 / vs)
  const lw = Math.max(1.5, 1.5 / vs)
  // The road runs along tile edges, so a roadside tile's square takes in a
  // strip of dirt. The lit squares are drawn on a layer and the road is cut
  // out of it, so what lights up is exactly the grass a hero stands on.
  const layer = gridLayer(map.width, map.height)
  const lctx = layer?.getContext('2d') ?? null
  const g = lctx ?? ctx
  if (lctx) lctx.clearRect(0, 0, map.width, map.height)
  g.save()
  for (const s of map.slots) {
    if (opts.skip?.has(s.id)) continue
    const hover = s.id === opts.hover
    const x = s.pos.x - T / 2 + inset
    const y = s.pos.y - T / 2 + inset
    const w = T - inset * 2
    roundRect(g, x, y, w, w, Math.min(10, w / 5))
    g.fillStyle = hover
      ? 'rgba(255, 243, 196, 0.34)'
      : `rgba(255, 236, 170, ${(0.08 + 0.06 * pulse) * k})`
    g.fill()
    g.lineWidth = hover ? lw * 1.6 : lw
    g.strokeStyle = hover ? '#fff3c4' : `rgba(255, 224, 138, ${(0.42 + 0.2 * pulse) * k})`
    g.stroke()
  }
  g.restore()
  if (lctx && layer) {
    // Cut the road (its drawn 50px, plus the outline's width) out of the layer.
    lctx.save()
    lctx.globalCompositeOperation = 'destination-out'
    lctx.lineJoin = 'round'
    lctx.lineCap = 'round'
    lctx.lineWidth = 50 + lw * 2
    lctx.strokeStyle = '#000'
    strokePolyline(lctx, map.path)
    lctx.restore()
    ctx.drawImage(layer, 0, 0)
  }
}

/** One scratch layer for the grid, reused frame to frame (one field size at a time). */
let gridCanvas: HTMLCanvasElement | null = null
function gridLayer(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  if (!gridCanvas) gridCanvas = document.createElement('canvas')
  if (gridCanvas.width !== w || gridCanvas.height !== h) {
    gridCanvas.width = w
    gridCanvas.height = h
  }
  return gridCanvas
}

/**
 * G1-2: the answer at the point of touch when a blocked tile is tapped — a
 * brief outline on that tile, fading over `BLOCKED_FLASH_S`, while the coach
 * strip says why in words. Under reduced motion it holds at half strength for
 * the same time instead of fading.
 */
export const BLOCKED_FLASH_S = 0.7
export function drawBlockedFlash(ctx: CanvasRenderingContext2D, map: GameMap, tileId: string, age: number): void {
  if (age < 0 || age > BLOCKED_FLASH_S) return
  const t = map.tiles?.find((x) => x.id === tileId)
  if (!t) return
  const T = map.tile ?? 80
  const vs = Math.max(getViewScale(), 0.02)
  const a = fxReducedMotion() ? 0.5 : 1 - age / BLOCKED_FLASH_S
  const inset = Math.max(3, 2 / vs)
  ctx.save()
  roundRect(ctx, t.pos.x - T / 2 + inset, t.pos.y - T / 2 + inset, T - inset * 2, T - inset * 2, 10)
  ctx.lineWidth = Math.max(2.5, 2.5 / vs)
  ctx.strokeStyle = `rgba(20, 12, 6, ${0.7 * a})`
  ctx.stroke()
  ctx.lineWidth = Math.max(1.5, 1.5 / vs)
  ctx.strokeStyle = `rgba(240, 150, 120, ${0.95 * a})`
  ctx.stroke()
  ctx.restore()
}

/**
 * Dims the field while a hero is armed for posting, so the lit slots are the
 * brightest thing on it (Wave 1). Drawn before the slots and before the posted
 * heroes, so neither is dimmed. Static — no motion to reduce.
 */
export function drawPlacementDim(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save()
  ctx.fillStyle = 'rgba(12, 8, 4, 0.4)'
  ctx.fillRect(0, 0, w, h)
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

/**
 * The base takes damage, visibly (and the run-loss moment lands).
 *
 * The base plate is baked into the terrain — it is static geometry — so it
 * never reacted to anything: leaked enemies simply vanished at the end of the
 * path, the marker sat there unchanged, and the run could be lost without one
 * pixel of the field acknowledging it. This is the overlay that answers all of
 * it, in four escalating states.
 */
/**
 * Where the base's reaction is DRAWN, which is not where the base is.
 *
 * Measured while building this: `FIRST_MAP.base` is `{x: 990, y: 520}` — the
 * last point of a path that deliberately runs off both edges so enemies enter
 * and leave off-screen — and the field is **960** wide. The marker `drawBase`
 * bakes into the terrain spans x 958–1010, so *two pixels of it are on screen
 * and the rest is past the right edge.*
 *
 * That is the real reason "the base never visually reacts": there was nothing
 * on screen to react. Flashing the plate would have changed nothing a player
 * can see. So the reaction is anchored to the boundary the enemies actually
 * cross, clamped inward by one marker's width, and the boundary itself is drawn
 * (`drawBreachLine`) so that the place the run is lost is a place on the screen
 * at all.
 *
 * Gameplay is untouched: `map.base` is not moved, the baked `drawBase` is not
 * moved, and nothing about where the path ends changes.
 */
export function baseAnchor(map: GameMap): Vec2 {
  return {
    x: Math.max(34, Math.min(map.width - 34, map.base.x - 6)),
    y: Math.max(34, Math.min(map.height - 34, map.base.y)),
  }
}

/**
 * The angle of the last lane segment, so the gate below stands ACROSS the road
 * rather than along it — on either shipped map, and on any future one.
 */
function laneAngle(map: GameMap): number {
  const p = map.path
  const a = p[p.length - 2] ?? p[0]
  const b = p[p.length - 1]
  return Math.atan2(b.y - a.y, b.x - a.x)
}

/**
 * The line, as a thing: a warm-wood palisade gate standing across the lane at
 * the last visible point before the field edge.
 *
 * This is the piece the brief called "give the base a reaction", and the reason
 * it is a *new object* rather than a flash on the old one is measured in
 * {@link baseAnchor} — the old one is off-screen. A game whose core verb is
 * WATCHING had nothing on the field standing for the thing being defended, so
 * "the base took damage" had no referent for the eye to land on.
 *
 * It carries the base's health in **structure**, not only in colour: planks go
 * missing from the middle outward as the line is worn down, the gate reddens
 * and flashes white as a leak lands, and it lies flat when the run is lost.
 * Colour alone would fail the same colour-vision test the tier notches exist to
 * pass. It stands on the field boundary, out of the play area, so it frames
 * rather than competes (level-design checklist).
 */
function drawGate(ctx: CanvasRenderingContext2D, map: GameMap, dmg: number, hurt: number, lost: number): void {
  const a = baseAnchor(map)
  const heat = Math.max(dmg, Math.min(1, hurt / 0.55))
  const fallen = lost >= 0
  ctx.save()
  ctx.translate(a.x, a.y)
  ctx.rotate(laneAngle(map))
  // +x now runs down the lane and +y across it, so the gate is a row of planks
  // along y standing in the direction the enemies are walking.

  // Contact shadow, like every other object class on the field.
  ctx.fillStyle = 'rgba(0,0,0,0.26)'
  ctx.beginPath()
  ctx.ellipse(3, 0, 7, 32, 0, 0, Math.PI * 2)
  ctx.fill()

  /**
   * ── the count told the truth about nothing (C3) ──────────────────────────
   *
   * The mapping this replaces was:
   *
   *     gone = min(PLANKS - 2, floor(dmg * (PLANKS - 1)))   // 0…5
   *     rank = |i - (PLANKS - 1) / 2|                       // 3,2,1,0,1,2,3
   *     if (rank < gone / 2 && !fallen) continue
   *
   * and it was wrong three separate ways, all of them in the direction of
   * flattering the player about how the line is doing:
   *
   *  1. `rank` is integer-spaced, so halving `gone` made half its values do
   *     nothing: gone 0→7 planks standing, 1→6, 2→**6**, 3→4, 4→**4**, 5→2.
   *     Seven planks, four states.
   *  2. `floor` meant `gone` stayed 0 until a sixth of the base was lost. With
   *     `MAX_BASE_HP = 20` that is 19, 18 and 17 of 20 all drawing a
   *     **completely intact** gate — three leaks, 15% of the run's health,
   *     reported as "undamaged" by the channel whose entire job is to report it.
   *  3. `fallen` short-circuited the `continue`, so at the moment the run was
   *     lost every plank came back: the gate went from 2 planks to **7**. The
   *     count inverted at the one moment it had to be unambiguous.
   *
   * And this is the channel the comment above calls "the one visual variable
   * that survives every colour-vision difference" — so for the player who most
   * needs it, it was the channel that was lying.
   *
   * The replacement is a plain monotone count with no halving anywhere:
   * `ceil` so the FIRST point of damage costs a plank rather than being
   * invisible, clamped so one plank always remains while the gate is a gate,
   * and `fallen` changes the plank GEOMETRY (they lie flat) without changing
   * how many there are. Seven distinct states, strictly non-increasing, and the
   * fewest planks are shown exactly when the least is left.
   *
   *     baseHp/20   20    19    17    13    11     6     1     defeat
   *     dmg        0.00  0.05  0.15  0.35  0.45  0.70  0.95   1.00
   *     standing      7     6     5     4     3     2     1      1
   */
  const PLANKS = 7
  const step = 9
  const span = step * (PLANKS - 1)
  const gone = Math.min(PLANKS - 1, Math.ceil(Math.max(0, Math.min(1, dmg)) * PLANKS))
  const mid = (PLANKS - 1) / 2
  const w = fallen ? 16 : 9
  const x0 = fallen ? -2 : -4.5
  for (let i = 0; i < PLANKS; i++) {
    const y = -span / 2 + i * step
    /**
     * Planks are taken from the middle outward, so the gap reads as a breach.
     *
     * `order` is this plank's position in that removal sequence — centre first,
     * then alternating outward — so comparing it against a whole `gone` removes
     * exactly `gone` planks. The previous `rank < gone / 2` compared an
     * integer-spaced rank against a half-integer and silently merged states.
     */
    const rank = Math.abs(i - mid)
    const order = rank === 0 ? 0 : 2 * rank - 1 + (i > mid ? 1 : 0)
    if (order < gone) continue
    // Dark ground first, so the palisade separates from the dirt it stands on
    // — the same contour trick the unit sprites get baked (see pixmap.ts).
    ctx.fillStyle = 'rgba(24,14,8,0.85)'
    ctx.fillRect(x0 - 1, y - 4, w + 2, 8)
    ctx.fillStyle = i % 2 ? '#6b4526' : '#7a5230'
    ctx.fillRect(x0, y - 3, w, 6)
    ctx.fillStyle = 'rgba(255,232,190,0.26)'
    ctx.fillRect(x0, y - 3, w, 1.6)
  }
  if (!fallen) {
    ctx.fillStyle = '#4a2d18'
    for (const o of [-15, 15]) ctx.fillRect(-6, o - 2, 12, 4)
  }

  if (heat > 0.02) {
    ctx.globalAlpha = Math.min(0.8, heat * 0.85)
    ctx.strokeStyle = '#e05a4f'
    ctx.lineWidth = 1.4 + heat * 2
    ctx.beginPath()
    ctx.rect(-8, -span / 2 - 6, 16, span + 12)
    ctx.stroke()
  }
  if (hurt > 0) {
    const k = Math.min(1, hurt / 0.55)
    ctx.globalAlpha = k * k * 0.45
    ctx.fillStyle = '#ffdcd2'
    ctx.fillRect(-8, -span / 2 - 6, 16, span + 12)
  }
  ctx.restore()
}

export function drawBaseFx(ctx: CanvasRenderingContext2D, map: GameMap): void {
  const b = fxBaseState()
  const now = fxNow()
  const anchor = baseAnchor(map)
  const x = anchor.x
  const y = anchor.y
  const dmg = 1 - Math.max(0, Math.min(1, b.frac))

  // 1 + 2. The gate carries the standing damage AND the breach flash.
  drawGate(ctx, map, dmg, b.hurt, b.lost)

  ctx.save()
  ctx.translate(x, y)

  // 3. Critical: as the line nears breaking, the ground behind the gate beats.
  //    Only past half, so a calm wave stays calm (Lisa Brown, "The Nuance of
  //    Juice": feedback that fires constantly stops meaning anything).
  if (dmg > 0.5 && b.lost < 0 && !fxReducedMotion()) {
    const beat = 0.5 + 0.5 * Math.sin(now * (5 + dmg * 7))
    ctx.globalAlpha = (0.16 + beat * 0.34) * dmg
    ctx.strokeStyle = '#e05a4f'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, 30 + beat * 6, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.restore()

  // 4. The run-loss ceremony: a white blowout that decays into a dark field
  // closing in on the breach. It has to land inside `WAVE_BEAT_LOSS_MS` (550ms
  // — the hold `gameStore.finishBattle` keeps the engine mounted for), so it is
  // timed to be fully read by ~0.5s rather than to unfold at leisure.
  if (b.lost >= 0 && !fxReducedMotion()) {
    const t = b.lost
    ctx.save()
    if (t < 0.3) {
      // Bright, but not a whiteout: the field has to stay legible through it,
      // because what the player needs to see is the line breaking, not a flash.
      ctx.globalAlpha = Math.max(0, 1 - t / 0.3) ** 1.4 * 0.7
      ctx.fillStyle = '#fff3e0'
      ctx.fillRect(0, 0, 4000, 4000)
    }
    const g = ctx.createRadialGradient(x, y, 20, x, y, 660 - Math.min(430, t * 900))
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, `rgba(24,10,6,${Math.min(0.6, t * 1.4)})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 4000, 4000)
    ctx.restore()
  }
}

export function drawAura(ctx: CanvasRenderingContext2D, pos: Vec2, radius: number, color: string, now: number): void {
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

export function drawReticle(ctx: CanvasRenderingContext2D, pos: Vec2, r: number): void {
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
