/**
 * The battle renderer's public face. Every draw lives in a module of its own —
 *
 *   frame.ts        presentation clock, view scale, letterbox (`fitView`)
 *   terrain.ts      the static field, baked once per map (`drawField`)
 *   units.ts        sentinels + enemies (`drawSentinel`, `drawEnemy`)
 *   plaques.ts      the enemy tier / elite plaque
 *   overlays.ts     slots, ranges, auras, reticles, the base gate (`drawBaseFx`)
 *   projectiles.ts  shots and traps
 *   blit.ts         the 1:1 sprite blit + its census
 *   paint.ts        colour / canvas helpers
 *   preview.ts      the theme gallery scene
 *
 * — and this file re-exports the names callers have always imported from
 * `renderer`, plus `drawBattleEntities`, which composes them in draw order.
 */
import type { GameEngine } from '../engine/engine'
import { drawFxDecals, drawFxFloaters, drawFxParticles } from './fx'
import { animNow } from './frame'
import { drawAura, drawBaseFx, drawReticle } from './overlays'
import { drawProjectile, drawTrap } from './projectiles'
import { drawTelegraphs } from './telegraphs'
import { drawEnemy, drawSentinel, sentinelFromRt } from './units'

export { fitView, setPresentationTime, setViewScale, type View } from './frame'
export { drawField } from './terrain'
export { drawEnemy, drawSentinel, sentinelFromRt, type DrawSentinel } from './units'
export { eliteMark, eliteMarkAudit, enemyTier, tierTagGeometry, type EliteMark } from './plaques'
export { baseAnchor, drawBaseFx, drawPlacementDim, drawRange, drawSlot } from './overlays'
export { drawProjectile, drawTrap } from './projectiles'
export { blitCensus } from './blit'
export { hexToRgba, mix, roundRect } from './paint'
export { drawThemePreview } from './preview'

/** Scratch for `drawBattleEntities`; cleared and refilled, never reallocated. */
const targeted = new Set<string>()

/** Convenience: draw a whole running battle from an engine. */
export function drawBattleEntities(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  // TWO clocks, deliberately (M-1 / WS1-3):
  //  - `now` is the presentation clock, shared with the tower idle loop. It is
  //    for ambient animation — pulses, bobs, walk cycles — and nothing else.
  //  - `simNow` is the engine's own clock. Every gameplay-state timestamp
  //    (burn/chill/stun expiry) is written in it, so anything compared against
  //    one of those must read it and not the presentation clock, which has been
  //    running since the canvas mounted and is ahead by the whole setup phase.
  // Both freeze when the sim does, so pause coherence is unaffected.
  const now = animNow()
  const simNow = engine.elapsed
  for (const t of engine.traps) drawTrap(ctx, t.pos, now)

  // Faint aura rings for support Sentinels (cleric/guard).
  for (const s of engine.sentinels) {
    if (s.downed) continue
    const m = s.profile.mods
    const aura = m.healAura ?? m.buffAura ?? m.dmgReductionAura
    if (aura) drawAura(ctx, s.pos, aura.radius, m.healAura ? '#7ac74f' : m.dmgReductionAura ? '#98c1d9' : '#f0a868', now)
  }

  // Corpses and splats go down BEFORE the living, so permanence never occludes
  // a unit the player has to read (Sakurai: make the character stand out).
  drawFxDecals(ctx)

  // Reused, not rebuilt: this ran a `map` + `filter` + `new Set` every frame
  // for a set that is at most a handful of ids.
  targeted.clear()
  for (const s of engine.sentinels) if (s.targetId) targeted.add(s.targetId)
  for (const e of engine.enemies) drawEnemy(ctx, e, now, simNow)
  drawTelegraphs(ctx, engine) // Phase 3a: behaviour marks (render/telegraphs.ts)
  for (const e of engine.enemies) if (targeted.has(e.id)) drawReticle(ctx, e.pos, e.type.radius)
  for (const s of engine.sentinels) drawSentinel(ctx, sentinelFromRt(s))
  for (const p of engine.projectiles) drawProjectile(ctx, p)

  // Impact debris, chain-lightning arcs, explosions.
  drawFxParticles(ctx)
  // The base's own reaction, over the units standing near it.
  drawBaseFx(ctx, engine.map)
  // Numbers last: they are the only layer that is pure information.
  drawFxFloaters(ctx)
}
