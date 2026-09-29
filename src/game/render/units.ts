/**
 * The units on the field: sentinels (towers) and enemies, with their HP bars,
 * proc rings, muzzle flashes and walk/roll cycles. Tier/elite plaques are in
 * `plaques.ts`.
 */
import type { Vec2 } from '../core/vec'
import { ARCHETYPE_GLYPH } from '../data/glyphs'
import type { RtEnemy, RtSentinel } from '../engine/engine'
import type { Archetype } from '../types'
import { ANIM_FRAMES, loopFrame } from './anim'
import { fxEnemyDot, fxEnemyFlash, fxEnemyRecoil, fxReducedMotion, fxSentinel, type ProcKind } from './fx'
import { heroStrip, type Loadout } from './loadout'
import { pixmap, quarterTurns } from './pixmap'
import { artFor, getSprite } from './sprites'
import { getActiveStyle } from './themes'
import { animNow, unitPixmapScale } from './frame'
import { darken, hexToRgba, lighten, mix, radialFill, roundRect, shapePath } from './paint'
import { blitPixmap } from './blit'
import { eliteMark, enemyTier } from './plaques'
import { drawEnemyBar, drawHeroBar } from './hpbar'

/** A minimal, uniform description of a tower to draw (works for setup + battle). */
export interface DrawSentinel {
  /** Runtime id — the key the presentation layer files recoil/muzzle/proc under. */
  id: string
  pos: Vec2
  archetype: Archetype
  color: string
  accent: string
  range: number
  aimAngle: number
  fireFlash: number
  /**
   * What this hero is wearing, as gear art names. When set, the body and gear
   * strips are composited into one canvas BEFORE the bake, so the assembled
   * figure gets a single contour ring — see `loadout.ts`. Undefined draws bare.
   */
  loadout?: Loadout
  hp: number
  maxHp: number
  downed: boolean
  procFlash: number
  patienceStacks: number
  blocking: boolean
}

export function sentinelFromRt(s: RtSentinel): DrawSentinel {
  return {
    id: s.id,
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

/**
 * The four procs, each with its own colour AND its own geometry.
 *
 * `procFlash` was one shared `#ffe08a` ring for shock, execute, burn and stun —
 * four mechanics with different costs, different builds and different reasons
 * to care, rendered identically, so the ring told the player only "something
 * procced". Colour alone would not have fixed it either: at the shipping view a
 * tower is ~19 CSS px and two hues at that size are one hue to a deuteranope.
 * So each proc also gets a *shape*: shock a spiked corona, burn a rising triple
 * flame, execute a downward chevron pair, stun four orbiting pips.
 */
function drawProcRing(ctx: CanvasRenderingContext2D, kind: ProcKind, k: number, now: number): void {
  if (!kind || k <= 0) return
  const a = Math.min(1, k)
  const r = 22 + (1 - a) * 5
  const col = kind === 'shock' ? '#bfe9ff' : kind === 'burn' ? '#ff8a3c' : kind === 'execute' ? '#ff5d5d' : '#ffe08a'
  ctx.save()
  ctx.strokeStyle = hexToRgba(col, a * 0.85)
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  if (kind === 'shock') {
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2 + now * 5
      ctx.moveTo(Math.cos(t) * r, Math.sin(t) * r)
      ctx.lineTo(Math.cos(t) * (r + 6), Math.sin(t) * (r + 6))
    }
    ctx.lineWidth = 1.6
    ctx.stroke()
  } else if (kind === 'burn') {
    ctx.beginPath()
    ctx.arc(0, 0, r, 0.3, Math.PI - 0.3)
    ctx.stroke()
    ctx.beginPath()
    for (let i = -1; i <= 1; i++) {
      const x = i * 8
      const h = 9 + Math.sin(now * 14 + i) * 2.5
      ctx.moveTo(x, -r + 4)
      ctx.quadraticCurveTo(x + 3, -r - h * 0.5, x, -r - h)
      ctx.quadraticCurveTo(x - 3, -r - h * 0.5, x, -r + 4)
    }
    ctx.fillStyle = hexToRgba(col, a * 0.8)
    ctx.fill()
  } else if (kind === 'execute') {
    for (const d of [0, 6]) {
      ctx.beginPath()
      ctx.moveTo(-11, -6 + d)
      ctx.lineTo(0, 4 + d)
      ctx.lineTo(11, -6 + d)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.lineWidth = 1.4
    ctx.strokeStyle = hexToRgba(col, a * 0.5)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.lineWidth = 1.4
    ctx.strokeStyle = hexToRgba(col, a * 0.45)
    ctx.stroke()
    ctx.fillStyle = hexToRgba(col, a)
    for (let i = 0; i < 4; i++) {
      const t = (i / 4) * Math.PI * 2 + now * 3.4
      ctx.beginPath()
      ctx.arc(Math.cos(t) * r, Math.sin(t) * r * 0.55 - 6, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

/** Muzzle flash — "your bullets are too small" applied at the barrel (Nijman). */
function drawMuzzle(ctx: CanvasRenderingContext2D, k: number, angle: number, color: string): void {
  if (k <= 0) return
  const a = Math.min(1, k)
  const len = 13 + a * 9
  const wide = 4 + a * 4
  ctx.save()
  ctx.rotate(angle)
  ctx.globalAlpha = a
  ctx.fillStyle = lighten(color, 0.55)
  ctx.beginPath()
  ctx.moveTo(6, 0)
  ctx.lineTo(6 + len, -wide)
  ctx.lineTo(6 + len * 1.22, 0)
  ctx.lineTo(6 + len, wide)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,246,224,0.9)'
  ctx.beginPath()
  ctx.arc(9, 0, 3 + a * 2.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawSentinel(ctx: CanvasRenderingContext2D, s: DrawSentinel): void {
  const { pos } = s
  const fs = fxSentinel(s.id)
  ctx.save()
  // Snap to the composite's pixel grid — see blitPixmap. The fire recoil is
  // added BEFORE the round, so the whole unit (sprite, ring, HP bar, tier tag)
  // moves together and still lands on a whole logical px.
  ctx.translate(Math.round(pos.x + fs.rx), Math.round(pos.y + fs.ry))

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

  // Proc feedback — differentiated by colour AND geometry (see drawProcRing).
  // Driven off the presentation clock, so a proc tell holds the same ~0.5 REAL
  // seconds at 1× and at 3×; `s.procFlash` decays in game time and at 3× was
  // gone in a sixth of a second.
  drawProcRing(ctx, fs.procKind, fs.proc, animNow())

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
  // The figure's pack, from the theme's per-role fallback chain — the whole
  // family (still, idle, attack) comes from one pack, at that pack's density.
  const art = artFor(s.archetype)
  const pack = art?.pack
  const idle = pack ? getSprite(pack, `${s.archetype}_idle`) : undefined
  const atk = pack ? getSprite(pack, `${s.archetype}_atk`) : undefined
  const staticSpr = pack ? getSprite(pack, s.archetype) : undefined

  const groundRing = () => {
    ctx.beginPath()
    ctx.ellipse(0, 13, 14, 5, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.32)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, 2, 16, 0, Math.PI * 2)
    ctx.strokeStyle = hexToRgba(s.accent, 0.6)
    ctx.lineWidth = 2
    ctx.stroke()
  }

  const towerPm = (() => {
    if (!art) return null
    const firing = s.fireFlash > 0.05 && !!atk
    const anim = firing ? 'atk' : 'idle'
    const frames = ANIM_FRAMES[`${s.archetype}_${anim}`] ?? 1
    // heroStrip returns the bare body when nothing is equipped, so the
    // un-geared path is exactly what it was before the compositor existed.
    const strip =
      heroStrip(art.pack, s.archetype, anim, frames, s.loadout) ??
      ((firing ? atk : idle) ?? idle ?? atk)
    if (!strip) return null
    const pm = pixmap(strip, { scale: unitPixmapScale(art.spriteScale), frames, ring: true })
    if (!pm) return null
    const frame = firing
      ? Math.min(frames - 1, Math.floor((1 - Math.max(0, Math.min(1, s.fireFlash))) * frames))
      : loopFrame(animNow(), frames, 6, s.pos.x * 0.05)
    return { pm, frame }
  })()

  if (towerPm) {
    groundRing()
    // Play the attack strip while firing (advances as fireFlash decays), else
    // loop the idle strip.
    //
    // The old code divided a fixed body height by each strip's own source
    // height, so every archetype was forced to the same 60.75 logical px
    // regardless of how tall the art actually is (95 / 79 / 63 px) — three
    // different sprite scales, and two heroes standing side by side differed in
    // pixel density by 1.51×. They all draw at one density now, which means the
    // warrior really is taller than the pawn, which is what the art says.
    // Anchored at the FEET (bottom edge at y = 8), so the taller attack frames
    // grow upward — a raised sword — instead of sinking the character.
    blitPixmap(ctx, towerPm.pm, towerPm.frame, 0, 8)
  } else if (staticSpr) {
    groundRing()
    const pm = pixmap(staticSpr, { scale: unitPixmapScale(art!.spriteScale), ring: true })
    if (pm) blitPixmap(ctx, pm, 0, 0, 8)
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
    ctx.fillText(ARCHETYPE_GLYPH[s.archetype], 0, 1)
  }

  // Muzzle flash, over the art, at the barrel. Kept under reduced motion (it is
  // a 90 ms state tell, not travel) but the recoil and sparks are not.
  drawMuzzle(ctx, fs.muzzle, fs.muzzleAngle, s.accent)

  // HP bar (only when damaged) — the CSS-px-floored bar with its damage
  // trail, under the hero's feet (Phase 2, `hpbar.ts`).
  drawHeroBar(ctx, s.id, s.hp, s.maxHp, 14)

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

/**
 * @param now    the presentation clock — ambient animation ONLY (walk cycle, bob).
 * @param simNow the ENGINE clock (`engine.elapsed`). Every gameplay-state
 *   timestamp on an enemy — `burnUntil`, `chillUntil`, `stunUntil` — is written
 *   in engine time, so it can only be compared against engine time (M-1). The
 *   presentation clock starts at canvas mount and advances on REAL time through
 *   setup, so it sits roughly `setupSeconds` ahead of the sim; comparing status
 *   timestamps against it made every effect shorter than the preceding setup
 *   undrawable, and a 0.5s stun undrawable at all. Defaults to `now` so a caller
 *   with only one clock (none today) still type-checks.
 */
export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  e: RtEnemy,
  now: number,
  simNow: number = now,
): void {
  const { pos, type } = e
  const burning = simNow < e.burnUntil
  const chilled = simNow < e.chillUntil
  const stunned = simNow < e.stunUntil
  /**
   * Presentation-only knockback (doctrine item 7).
   *
   * `pos` is the SIM's position and decides hit detection, splash and blocking;
   * this is a decaying draw offset on top of it, so a hit visibly throws a
   * goblin three pixels back down the lane without moving it one unit of
   * `distance`. Added before the round so the whole unit — sprite, ring, HP
   * bar, tier tag — travels together and still lands on a whole logical px.
   */
  const kick = fxEnemyRecoil(e.id)
  const flash = fxEnemyFlash(e.id)
  // Attrition (burn/thorns/trap) is its OWN channel and is not a hit — see
  // `fxDotEnemy`. Conflating the two is what turned every burning enemy into a
  // featureless white blob for the whole burn (C1).
  const dot = fxEnemyDot(e.id)
  ctx.save()
  // Snap to the composite's pixel grid — see blitPixmap. This is what ends the
  // per-frame pixel crawl on everything that moves.
  ctx.translate(Math.round(pos.x + kick.x), Math.round(pos.y + kick.y))

  const style = getActiveStyle()
  const es = style.enemy
  const fill = chilled ? mix(type.color, '#8fd0ff', 0.4) : type.color
  const art = artFor(type.id)
  const pack = art?.pack
  const walkFrames = pack ? ANIM_FRAMES[`${type.id}_walk`] : undefined
  const walk = pack && walkFrames ? getSprite(pack, `${type.id}_walk`) : undefined
  const staticSpr = pack ? getSprite(pack, type.id) : undefined
  /**
   * TWO render buckets, and only two (see `pixmap.ts`): rank and file at half
   * density, the tier-5 champion at the pack's native density — so a champion
   * is exactly 2× its own faction's line troops. Tiers 1–4 are deliberately the
   * same size; tier is read off the notch tag, which encodes it as a count.
   *
   * `type.radius` is GAMEPLAY (hit detection, splash, blocking) and is not
   * touched here — only the render scale is.
   */
  const spriteScale = art ? unitPixmapScale(art.spriteScale, !!type.isBoss) : 1

  const enemyShadow = () => {
    ctx.beginPath()
    ctx.ellipse(0, type.radius * 0.7, type.radius * 0.9, type.radius * 0.35, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fill()
  }
  const overlays = (ringR: number) => {
    if (chilled) {
      ctx.beginPath()
      ctx.arc(0, 0, type.radius, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(120,190,255,0.28)'
      ctx.fill()
    }
    if (type.isBoss) {
      ctx.beginPath()
      ctx.arc(0, 0, ringR, 0, Math.PI * 2)
      ctx.strokeStyle = '#e0aaff'
      ctx.lineWidth = 2.5
      ctx.stroke()
    }
  }

  // Top of the drawn art, in token space. The tier tag hangs off this rather
  // than off `radius`, because a sprite is ~2.7× the token: anchoring to the
  // radius put the tag ON the goblin's head at tier 1 and inside the champion's
  // chest at tier 5.
  let artTop = -type.radius

  const walkPm = walk && walkFrames ? pixmap(walk, { scale: spriteScale, frames: walkFrames, ring: true }) : null
  const staticPm = !walkPm && staticSpr
    ? pixmap(staticSpr, { scale: spriteScale, ring: true, cell: barrelCell(type.id, staticSpr) })
    : null

  if (walkPm) {
    enemyShadow()
    /**
     * Run cycle, driven by DISTANCE rather than by the clock (M6).
     *
     * It was `loopFrame(now, frames, 10, …)` — a fixed 10 fps cadence on every
     * enemy in the game. A `Swift` elite translates 40% faster and took exactly
     * as many steps to do it, so it visibly moon-walked; a `Plated` elite is
     * 10% slower and skated. Chilled enemies did the same thing in the other
     * direction. Tying the cycle to ground covered fixes all three at once and
     * needs no knowledge of the modifier: `STRIDE` logical px per frame, so at
     * the ~135 px/s of a line goblin the cadence is the same ~10 fps this
     * shipped with, and anything moving faster or slower steps to match.
     *
     * `distance` is the sim's own odometer, so this still freezes on pause and
     * still runs on simulated time — the M28 property is unchanged.
     */
    const frame = walkFrameFor(e.distance, e.id, walkFrames!)
    // The bob is rounded with the blit, so it steps a whole logical px at a
    // time rather than resampling the sprite on every frame of its own cycle.
    const bob = Math.sin(now * 12 + pos.x * 0.3) * 1.4
    const feet = type.radius * 0.55 + bob
    blitPixmap(ctx, walkPm, frame, 0, feet, flash, dot)
    // 0.9 rather than 1.0: the top tenth of a Tiny Swords frame is transparent
    // headroom, and anchoring to the frame rather than to the character left
    // the tag visibly detached — 9 logical px of nothing over a champion.
    artTop = Math.round(feet - walkPm.fh) + walkPm.fh * 0.1
    overlays(walkPm.fh / 2 + 2)
  } else if (staticPm) {
    enemyShadow()
    const isBarrel = type.id.startsWith('barrel')
    if (isBarrel) {
      /**
       * Barrels roll as they trundle down the lane — and the roll is now made
       * of **pre-rendered quarter turns**, not of a live `ctx.rotate` (M4).
       *
       * The previous version quantised to sixteenths of a turn on the argument
       * that discrete poses "keep the sprite on one sampling phase for the
       * whole of each step". That is true and it was not enough: twelve of the
       * sixteen poses are non-axis-aligned, and a nearest-neighbour rotation of
       * pixel art looks like one at any sampling phase — it is the third of the
       * three amateur tells the rest of this pipeline exists to eliminate.
       * Worse, the pass's own metric could not see it, because `dw/sw` stays
       * exactly 1.000 under a rotation; 1,935 of ~15,000 field blits (12.9%)
       * were being resampled and the scorecard read clean. See `blitCensus`.
       *
       * Quarter turns are the only rotations of a raster that are **lossless**
       * — they are a permutation of the source pixels, not a resample — and
       * baking them into a four-cell strip means the runtime draw is back under
       * the identity transform, at 1.000, on a whole-px destination, like every
       * other sprite in the field. The roll is chunkier by design: four poses
       * of a tumbling barrel read as a tumble, and none of them is smeared.
       */
      /**
       * ── and the roll runs off the ODOMETER, not off `x + y` (minor 5) ─────
       *
       * The pose index was `floor((pos.x + pos.y) / (r * 1.6))`. The sum of the
       * two axes is not distance travelled: wherever the lane heads
       * right-and-up the sum FALLS while the barrel advances, so the barrel
       * tumbled backwards down the hill, and wherever `dx ≈ −dy` the sum is
       * flat and the roll stalled while the barrel kept translating. Measured
       * along the whole Green Line at 2 px steps: **18.4% of the lane ran the
       * roll in reverse**, in two contiguous stretches worth ~1.3–1.7 s each at
       * 1×. The gross rate looked right — 110 pose changes against a physically
       * correct 112 — which is exactly why it survived: only the SIGN was
       * wrong, and a rate metric cannot see a sign.
       *
       * `e.distance` is the sim's own odometer, the same one the walk cycle
       * above already runs on. It is monotonic, so the roll can never reverse
       * or stall, and it is in simulated time, so this still freezes on pause
       * (M28). `r * 1.6` is kept as the arc per quarter turn: a real barrel of
       * radius r covers `πr/2 ≈ 1.571r` per quarter turn, so the shipped
       * constant was already within 2% of physically correct and only ever
       * looked wrong because it was being fed the wrong odometer.
       */
      const rollPm = quarterTurns(staticPm)
      const pose = rollPoseFor(e.distance, type.radius)
      ctx.save()
      ctx.translate(0, -Math.round(type.radius * 0.1))
      blitPixmap(ctx, rollPm, pose, 0, rollPm.fh / 2, flash, dot)
      ctx.restore()
      artTop = -type.radius * 0.1 - rollPm.fh * 0.45
      overlays(rollPm.fh / 2 + 2)
    } else {
      const feet = type.radius * 0.55
      blitPixmap(ctx, staticPm, 0, 0, feet, flash, dot)
      artTop = Math.round(feet - staticPm.fh) + staticPm.fh * 0.1
      overlays(staticPm.fh / 2 + 2)
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
  // Stun mark. Drawn rather than typeset: this used to be a `✦` in system-ui,
  // which collided with Watch Marks (and with the old rogue glyph above), and
  // rendered at ~4.5 CSS px — a speck in a Crimson Text storybook direction.
  // Two orbiting sparks read as "dazed" at the size this actually ships at.
  if (stunned) {
    // Ambient orbit only — the two sparks are the information, the spin is not,
    // so reduced motion parks them rather than hiding them.
    const spin = fxReducedMotion() ? 0 : animNow() * 4
    ctx.fillStyle = '#ffe08a'
    for (let i = 0; i < 2; i++) {
      const a = spin + i * Math.PI
      ctx.beginPath()
      ctx.arc(Math.cos(a) * 5, -type.radius - 6 + Math.sin(a) * 2, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // The sprite branches flash their own silhouette (see blitPixmap). Only the
  // procedural fallback — no art loaded — still needs the flat disc, and it
  // needs the same two-channel split: white for an impact, ember for attrition.
  if (!walkPm && !staticPm) {
    if (dot > 0) {
      ctx.beginPath()
      ctx.arc(0, 0, type.radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,138,60,${Math.min(1, dot) * 0.3})`
      ctx.fill()
    }
    if (flash > 0) {
      ctx.beginPath()
      ctx.arc(0, 0, type.radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,246,228,${Math.min(1, flash) * 0.75})`
      ctx.fill()
    }
  }

  // HP bar, tier ticks and elite badge — one stack over the head (Phase 2,
  // `hpbar.ts`). The tier plaque it replaces stacked into a white ribbon down
  // a crowded lane; the count now lives inside the bar.
  const barTop = drawEnemyBar(ctx, e.id, e.hp, e.maxHp, enemyTier(type.id), eliteMark(type), !!type.isBoss, Math.round(artTop) - 1)
  // Phase 3a: where this enemy's head-stack ends, in field space, so the
  // behaviour marks (`telegraphs.ts`) sit above the bar instead of on the art.
  headTops.set(e.id, Math.round(pos.y + kick.y) + barTop)
  ctx.restore()
}

/** Top of each drawn enemy's bar stack this frame (field px), keyed by id. */
const headTops = new Map<string, number>()
/** Where to put a mark above this enemy's bar, or undefined before its first draw. */
export const enemyHeadTop = (id: string): number | undefined => headTops.get(id)
/** Drop entries for enemies no longer drawn (called once a battle frame). */
export function pruneHeadTops(alive: ReadonlySet<string>): void {
  for (const id of headTops.keys()) if (!alive.has(id)) headTops.delete(id)
}

/**
 * Logical px of ground covered per frame of a walk cycle.
 *
 * 13.5 is chosen so a tier-2 line goblin (134 px/s) steps at ~9.9 fps — the
 * fixed 10 the cycle used to run at — so nothing about the shipped cast's
 * cadence changes. What changes is that a Swift elite at 188 px/s now steps at
 * ~13.9 fps instead of moon-walking, and a chilled enemy's legs slow with it.
 */
const STRIDE = 13.5

/**
 * The walk-cycle frame for an enemy that has covered `distance` of lane: one
 * frame per `STRIDE` px, offset by the unit's stable id phase (see `idPhase`).
 * Pure, and exported so the cadence rule is testable without a canvas.
 */
export function walkFrameFor(distance: number, id: string, frames: number): number {
  const step = Math.floor(distance / STRIDE + idPhase(id) * frames)
  return ((step % frames) + frames) % frames
}

/**
 * The barrel's quarter-turn pose (0–3) off the ODOMETER, `r * 1.6` px of lane
 * per quarter turn — monotonic in `distance`, so the roll can never reverse or
 * stall (see the note in `drawEnemy`).
 */
export function rollPoseFor(distance: number, radius: number): number {
  return ((Math.floor(distance / (radius * 1.6)) % 4) + 4) % 4
}

/**
 * A stable per-entity phase offset, so a column of identical goblins is not one
 * animation played by six bodies.
 *
 * It was `pos.x * 0.08`, which is a function of WHERE the unit is rather than
 * of which unit it is — fine against a clock, wrong against an odometer, since
 * both terms would then advance together and the cycle would beat. Ids are
 * `en<counter><base36>` and monotonic, so hashing the whole string is enough to
 * scatter neighbours without any per-frame state.
 */
const phaseCache = new Map<string, number>()
export function idPhase(id: string): number {
  const hit = phaseCache.get(id)
  if (hit !== undefined) return hit
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  const v = ((h >>> 0) % 997) / 997
  // Bounded: ids are unique per run and a wave is a few hundred bodies, but a
  // long endless run must not grow this without limit.
  if (phaseCache.size > 4000) phaseCache.clear()
  phaseCache.set(id, v)
  return v
}

/**
 * A dormant guard, kept because the bug it catches is invisible.
 *
 * `barrel1..5.png` used to be 158×164 crops off a Tiny Swords sheet holding
 * **four** barrels in a 2×2 grid — one whole barrel at (0,0,58,70) and three
 * fragments clipped by the right and bottom edges (verified by an alpha
 * column/row-run scan: columns 1–58 and 137–157, rows 1–70 and 119–163,
 * identical in all five files). The renderer drew the entire sheet as one
 * enemy, squashed into a `sz × sz` square from a 158×164 source at scale 0.22,
 * which is why a barrel measured 0.18 device px per source px — the sparsest
 * thing on the field by a factor of 6.3 — and read as a dark smudge.
 *
 * The pack has since been re-exported to a trimmed 52×72 single barrel, so this
 * no longer fires (`naturalWidth` 52 < 120). It stays because a four-up sheet
 * drawn as one sprite does not look like a bug, it looks like bad art, and the
 * next re-export should not be able to bring it back silently. The square
 * destination is gone regardless: `blitPixmap` draws `fw × fh`, so the barrel's
 * 3.7% vertical squash cannot recur either.
 */
const BARREL_CELL = { x: 0, y: 0, w: 60, h: 72 }
const barrelCell = (id: string, img: HTMLImageElement) =>
  id.startsWith('barrel') && img.naturalWidth >= 120 ? BARREL_CELL : undefined
