import { useEffect, useRef, useState } from 'react'
import type { GameEngine } from '../../game/engine/engine'
import { APRON_X, APRON_Y, getApron } from '../../game/render/apron'
import { fxAdvance, fxPreload, fxReset, setFxReducedMotion } from '../../game/render/fx'
import { FxDiffer } from '../../game/render/fxDiff'
import { animNow, getViewScale } from '../../game/render/frame'
import { drawBattleEntities, drawField, setPresentationTime, setViewScale } from '../../game/render/renderer'
import { ATTRACT_MAP, ATTRACT_SCENARIOS, attractFocus, createAttractEngine, stepAttract } from './attractSim'

/**
 * The menu's attract-mode battle — the RENDER half (Phase 4).
 *
 * The real renderer drawing the real engine (`attractSim.ts`), into the key-art
 * frame, on a ~30 fps budget. Loaded lazily by `AttractMode` after the page is
 * idle, and only when motion is allowed; until its first frame is on screen the
 * still diorama underneath is what shows, and it fades in over it.
 *
 * ## Pixel-perfect in a small frame
 *
 * The field is composed at 1:1 exactly as the battle does it (960×560, every
 * sprite a scale-1.000 blit) and then copied to the visible canvas at an
 * INTEGER ratio of DEVICE pixels per composite pixel — ½ (a clean 2:1
 * average), 1, 2 or 3 — never at the fractional 0.8125 the battle has to live
 * with. The visible canvas's backing store is the frame's own device-pixel
 * box, so the browser does no second resample. The ratio is the smallest that
 * fills most of the frame's height, so a 272px phone frame at dpr 2 shows the
 * field at half size (the diorama's own scale) and a dpr-3 phone at two device
 * pixels per art pixel. What the field does not cover is the baked woodland
 * apron the battle uses, copied at the same ratio.
 *
 * ## Borrowed renderer state
 *
 * The renderer keeps two module-level values the battle owns — the
 * presentation clock and the view scale. Each frame here sets its own and puts
 * the previous values back, so the demo never leaves a trace in them; and the
 * shared FX pool is cleared when the demo stops (the battle clears it on every
 * new wave anyway).
 */
const FPS = 30
const FRAME = 1 / FPS
/** Pause on a finished fight before the next scenario starts. */
const HOLD_S = 2.2
/** A scenario that somehow runs long is cut, so the loop always turns over. */
const MAX_FIGHT_S = 80

/** Device px per composite px, from a fixed ladder. */
const LADDER = [0.5, 1, 2, 3, 4]

/**
 * `running` false parks the loop entirely (no rAF at all) and keeps the last
 * frame on screen — `AttractMode` drives it from visibility and intersection.
 */
export default function AttractBattle({ running }: { running: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const loop = useRef<{ start: () => void; stop: () => void } | null>(null)
  const [live, setLive] = useState(false)
  const runningNow = useRef(running)
  runningNow.current = running

  useEffect(() => {
    const canvas = canvasRef.current!
    const frameEl = canvas.parentElement!
    const vctx = canvas.getContext('2d')
    if (!vctx) return
    const map = ATTRACT_MAP
    const comp = document.createElement('canvas')
    comp.width = map.width
    comp.height = map.height
    const cctx = comp.getContext('2d')
    if (!cctx) return
    cctx.imageSmoothingEnabled = false

    let scenario = 0
    // Built in the warm-up below, not here: nothing heavy runs in the commit.
    let engine: GameEngine | null = null
    let differ: FxDiffer | null = null
    /** The camera, in composite px: eases between the company and the fight. */
    let cam = attractFocus(scenario)
    let fightT = 0
    let holdT = 0
    let anim = 0
    let acc = 0
    let last = performance.now()
    let raf = 0
    let drawn = false
    let ready = false
    let cancelled = false

    // Layout, recomputed when the frame resizes.
    let cssW = 0
    let cssH = 0
    let dpr = 1
    let k = 1
    const layout = () => {
      cssW = Math.max(1, Math.floor(frameEl.clientWidth))
      cssH = Math.max(1, Math.floor(frameEl.clientHeight))
      dpr = window.devicePixelRatio || 1
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      // The frame is laid out by flex and can start on a fractional pixel
      // (measured: y = 113.55 on a 390×844 menu). Nudge the canvas back onto
      // the device grid, or every art pixel straddles two device pixels.
      const r = frameEl.getBoundingClientRect()
      const fx = r.left * dpr - Math.floor(r.left * dpr)
      const fy = r.top * dpr - Math.floor(r.top * dpr)
      canvas.style.transform = fx || fy ? `translate(${-fx / dpr}px, ${-fy / dpr}px)` : ''
      canvas.style.imageRendering = 'pixelated'
      // The smallest rung whose field fills ~85% of the frame's height.
      const want = (cssH / map.height) * dpr * 0.85
      k = LADDER.find((r) => r >= want) ?? LADDER[LADDER.length - 1]
    }
    layout()
    const relayout = () => {
      layout()
      if (drawn) paint()
    }
    const ro = new ResizeObserver(relayout)
    ro.observe(frameEl)
    // A move without a resize (the records row arriving above) re-snaps too.
    window.addEventListener('resize', relayout)

    const nextScenario = () => {
      scenario = (scenario + 1) % ATTRACT_SCENARIOS.length
      engine = createAttractEngine(scenario, { preroll: true })
      differ = new FxDiffer(engine)
      cam = attractFocus(scenario)
      acc = 0
      fightT = 0
      holdT = 0
      fxReset()
    }

    /**
     * A slow camera: the company, pulled toward whichever part of the column
     * is closing on it. Eased, and only ever rendered at whole device pixels,
     * so the pan is a calm drift rather than a crawl.
     */
    const follow = (dt: number) => {
      const home = attractFocus(scenario)
      let ex = 0
      let ey = 0
      let n = 0
      for (const e of engine!.enemies) {
        if (Math.hypot(e.pos.x - home.x, e.pos.y - home.y) > 340) continue
        ex += e.pos.x
        ey += e.pos.y
        n++
      }
      const tx = n ? (home.x + ex / n) / 2 : home.x
      const ty = n ? (home.y + ey / n) / 2 : home.y
      const a = Math.min(1, dt * 0.9)
      cam = { x: cam.x + (tx - cam.x) * a, y: cam.y + (ty - cam.y) * a }
    }

    /** Compose the field at 1:1 with the real draw code. */
    const compose = () => {
      const prevT = animNow()
      const prevScale = getViewScale()
      setPresentationTime(anim)
      setViewScale(k / dpr)
      try {
        cctx.setTransform(1, 0, 0, 1, 0, 0)
        drawField(cctx, map)
        drawBattleEntities(cctx, engine!)
        cctx.globalCompositeOperation = 'overlay'
        cctx.fillStyle = 'rgba(255,186,110,0.06)'
        cctx.fillRect(0, 0, map.width, map.height)
        cctx.globalCompositeOperation = 'source-over'
      } finally {
        setPresentationTime(prevT)
        setViewScale(prevScale)
      }
    }

    const needsApron = () => map.width * k < canvas.width || map.height * k < canvas.height

    /** Copy the composite (and the apron round it) to the device at ratio k. */
    const paint = () => {
      const W = canvas.width
      const H = canvas.height
      // Field size in device px, and where its origin lands so the company is
      // centred — clamped so the field never leaves a gap it could have filled.
      const fw = map.width * k
      const fh = map.height * k
      const place = (view: number, size: number, f: number) =>
        size <= view ? Math.round((view - size) / 2) : Math.round(Math.min(0, Math.max(view - size, view / 2 - f * k)))
      const ox = place(W, fw, cam.x)
      const oy = place(H, fh, cam.y)
      vctx.setTransform(1, 0, 0, 1, 0, 0)
      vctx.imageSmoothingEnabled = k < 1
      vctx.imageSmoothingQuality = 'high'
      // The woodland apron only where the field cannot cover the frame (a
      // wide desktop frame). It is the priciest bake on the page, so a phone
      // frame — always covered — never asks for it.
      if (needsApron()) {
        const apron = getApron(map)
        if (apron) {
          vctx.drawImage(apron, ox - APRON_X * k, oy - APRON_Y * k, apron.width * k, apron.height * k)
        } else {
          vctx.fillStyle = '#2b3a1e'
          vctx.fillRect(0, 0, W, H)
        }
      }
      vctx.drawImage(comp, ox, oy, fw, fh)
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      let dt = (now - last) / 1000
      if (dt < FRAME - 0.004) return // the 30 fps budget: skip this vsync
      last = now
      if (dt > 0.25) dt = 0.25

      if (!engine || !differ) return
      const d = differ
      setFxReducedMotion(false)
      fxAdvance(dt)
      if (engine.status === 'running' && fightT < MAX_FIGHT_S) {
        acc += dt
        const ticks = Math.floor(acc * 60 + 1e-6)
        acc -= ticks / 60
        stepAttract(engine, ticks, {
          before: (e) => d.snapBefore(e),
          after: (e) => d.diffAfter(e, 1),
        })
        fightT += ticks / 60
        anim += ticks / 60
      } else {
        holdT += dt
        anim += dt
        if (holdT >= HOLD_S) nextScenario()
      }
      follow(dt)
      compose()
      paint()
      if (!drawn) {
        drawn = true
        setLive(true)
      }
    }
    loop.current = {
      start: () => {
        if (raf || !ready) return
        last = performance.now() - FRAME * 1000
        raf = requestAnimationFrame(frame)
      },
      stop: () => {
        cancelAnimationFrame(raf)
        raf = 0
      },
    }

    /*
     * Warm-up, one idle slice per step. The first frame used to cost ~390 ms in
     * a single task (terrain bake, apron bake, the unit pixmaps, the preroll);
     * a tap landing in it waited for all of it. Split, a tap waits for one
     * slice at most, and the terrain bake it starts with is the battle's own
     * cache — the first real battle on this map inherits it.
     */
    type IdleWin = Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    const w = window as IdleWin
    let idleId = 0
    const idle = (fn: () => void) =>
      (idleId = w.requestIdleCallback ? w.requestIdleCallback(fn, { timeout: 1000 }) : window.setTimeout(fn, 60))
    const stages: (() => void)[] = [
      () => {
        fxPreload()
        drawField(cctx, map)
      },
      () => {
        if (needsApron()) getApron(map)
      },
      () => {
        fxReset()
        engine = createAttractEngine(scenario, { preroll: true })
        differ = new FxDiffer(engine)
      },
      // The unit pixmaps (contour-ring bakes, one per strip) on their own
      // slice: the loop's first frame is then an ordinary 1 ms frame.
      () => compose(),
      () => {
        ready = true
        if (runningNow.current) loop.current?.start()
      },
    ]
    const run = (i: number) => {
      if (cancelled || i >= stages.length) return
      stages[i]()
      idle(() => run(i + 1))
    }
    idle(() => run(0))

    return () => {
      cancelled = true
      if (w.cancelIdleCallback) w.cancelIdleCallback(idleId)
      else window.clearTimeout(idleId)
      loop.current?.stop()
      loop.current = null
      ro.disconnect()
      window.removeEventListener('resize', relayout)
      fxReset()
    }
  }, [])

  useEffect(() => {
    if (running) loop.current?.start()
    else loop.current?.stop()
  }, [running])

  return <canvas ref={canvasRef} className={`pg-art-live${live ? ' is-live' : ''}`} aria-hidden="true" />
}
