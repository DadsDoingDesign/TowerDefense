import { useEffect, useRef } from 'react'
import { computeCombat } from '../game/engine/combat'
import {
  drawBattleEntities,
  drawField,
  drawRange,
  drawSentinel,
  drawSlot,
  fitView,
  type DrawSentinel,
} from '../game/render/renderer'
import { dist } from '../game/core/vec'
import { getActiveStyle } from '../game/render/themes'
import { placedSentinels, useGameStore } from '../state/gameStore'

const SLOT_HIT_RADIUS = 26

/**
 * Owns the requestAnimationFrame loop. Draws the field every frame, steps the
 * engine during battle, and handles tap-to-place input during setup. Reads game
 * state via getState() so the loop never restarts on store updates.
 */
export function BattleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const hoverSlot = useRef<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current!
    const wrap = wrapRef.current!
    const ctx = canvas.getContext('2d')!

    let cssW = 0
    let cssH = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      cssW = rect.width
      cssH = rect.height
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    let raf = 0
    let last = performance.now()
    let hudTimer = 0

    const frame = (now: number) => {
      let dt = (now - last) / 1000
      last = now
      if (dt > 0.05) dt = 0.05 // clamp after tab-out / hitch

      const st = useGameStore.getState()
      const { battleMap: map, engine, battlePhase: phase, speed } = st

      // --- simulate ---
      if (phase === 'battle' && engine) {
        engine.step(dt * speed)
        hudTimer += dt
        if (hudTimer >= 0.1) {
          hudTimer = 0
          st.syncHud()
        }
        if (engine.status !== 'running') {
          st.syncHud()
          st.finishBattle()
        }
      }

      // --- draw ---
      const view = fitView(cssW, cssH, map)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.imageSmoothingEnabled = getActiveStyle().smoothing
      ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, dpr * view.ox, dpr * view.oy)

      drawField(ctx, map)

      const liveEngine = st.engine
      if (phase === 'battle' && liveEngine) {
        // Show ranges faintly while the fight runs.
        for (const s of liveEngine.sentinels) {
          if (s.downed) continue
          drawRange(ctx, s.pos, s.profile.range, s.def.accent)
        }
        drawBattleEntities(ctx, liveEngine)
      } else {
        // Setup: slots + placed towers + range previews.
        const placed = placedSentinels(st.roster, st.placements)
        const occupied = new Set(placed.map((p) => p.slotId))
        for (const p of placed) {
          const slot = map.slots.find((s) => s.id === p.slotId)!
          const profile = computeCombat(p.sentinel)
          drawRange(ctx, slot.pos, profile.range, p.sentinel.accent)
        }
        for (const slot of map.slots) {
          if (occupied.has(slot.id)) continue
          const state =
            hoverSlot.current === slot.id
              ? 'hover'
              : st.selectedSentinelId
                ? 'selected'
                : 'empty'
          drawSlot(ctx, slot.pos, state)
        }
        for (const p of placed) {
          const slot = map.slots.find((s) => s.id === p.slotId)!
          const profile = computeCombat(p.sentinel)
          const ds: DrawSentinel = {
            pos: slot.pos,
            archetype: p.sentinel.archetype,
            color: p.sentinel.color,
            accent: p.sentinel.accent,
            range: profile.range,
            aimAngle: 0,
            fireFlash: 0,
            hp: profile.maxHp,
            maxHp: profile.maxHp,
            downed: false,
            procFlash: 0,
            patienceStacks: 0,
            blocking: false,
          }
          drawSentinel(ctx, ds)
        }
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // --- input (setup placement) ---
    const toLogical = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      const st = useGameStore.getState()
      const view = fitView(rect.width, rect.height, st.battleMap)
      return {
        x: (clientX - rect.left - view.ox) / view.scale,
        y: (clientY - rect.top - view.oy) / view.scale,
      }
    }

    const hitSlot = (x: number, y: number): string | null => {
      const st = useGameStore.getState()
      let best: { id: string; d: number } | null = null
      for (const slot of st.battleMap.slots) {
        const d = dist({ x, y }, slot.pos)
        if (d <= SLOT_HIT_RADIUS && (!best || d < best.d)) best = { id: slot.id, d }
      }
      return best?.id ?? null
    }

    const onPointerMove = (e: PointerEvent) => {
      const st = useGameStore.getState()
      if (st.battlePhase !== 'setup') {
        hoverSlot.current = null
        return
      }
      const { x, y } = toLogical(e.clientX, e.clientY)
      hoverSlot.current = hitSlot(x, y)
    }

    const onPointerDown = (e: PointerEvent) => {
      const st = useGameStore.getState()
      if (st.battlePhase !== 'setup') return
      const { x, y } = toLogical(e.clientX, e.clientY)
      const slotId = hitSlot(x, y)
      if (!slotId) return
      const occupied = st.placements[slotId]
      if (st.selectedSentinelId) {
        st.placeOnSlot(slotId)
      } else if (occupied) {
        // Clicking a placed tower opens its upgrade panel (removal lives there).
        st.openUpgrade(occupied)
      }
    }

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerleave', () => (hoverSlot.current = null))

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  return (
    <div className="battle-canvas-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} className="battle-canvas" />
    </div>
  )
}
