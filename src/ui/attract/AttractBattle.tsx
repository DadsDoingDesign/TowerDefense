import { useEffect, useRef, useState } from 'react'
import type { GameEngine } from '../../game/engine/engine'
import { apronMargins, getApron } from '../../game/render/apron'
import { fxAdvance, fxPreload, fxReset, setFxReducedMotion } from '../../game/render/fx'
import { FxDiffer } from '../../game/render/fxDiff'
import { animNow, getViewScale } from '../../game/render/frame'
import { drawBattleEntities, drawField, setPresentationTime, setViewScale } from '../../game/render/renderer'
import {
  ATTRACT_CUT,
  ATTRACT_MAP,
  attractCamera,
  createAttractEngine,
  directAttractSteps,
  stepAttract,
  type AttractScript,
} from './attractSim'

/**
 * The menu's attract-mode battle — the RENDER half.
 *
 * The real renderer drawing the real engine (`attractSim.ts`) BEHIND the whole
 * Watchtower menu (Whales UI plan H1-2), on a ~30 fps budget. Loaded lazily by
 * `AttractMode` after the page is idle, and only when motion is allowed.
 *
 * ## A title sequence, not a feed
 *
 * One scene, one cut (`directAttract`): fade up on the lane entrance, the
 * camera eases along the road with the champion, the knights hold, he falls —
 * a short freeze, a small kick of the camera and a warm flare where he fell —
 * then a beat on the company and a fade back to the page ground, and the same
 * shot again. The sim runs against a TARGET tick derived from the loop clock,
 * so every loop plays the same ticks at the same moments whatever the frame
 * rate did.
 *
 * ## Pixel-perfect at any size
 *
 * The field is composed at 1:1 exactly as the battle does it (960×560, every
 * sprite a scale-1.000 blit) and then copied to the visible canvas at an
 * INTEGER ratio `k` of DEVICE pixels per composite pixel, never a fraction. The
 * canvas's backing store is its own device-pixel box, so the browser does no
 * second resample, and the camera origin (shake included) is rounded to whole
 * device pixels, so the pan never smears a sprite across two of them. `k` is
 * picked so a phone shows about one art pixel per CSS pixel and a desk about
 * two. What the field does not cover is the woodland apron the battle uses.
 *
 * ## Where the subject sits
 *
 * The page tells the camera where its window onto the scene is: the frame's
 * `--cine-fx` / `--cine-fy` (fractions of its box) are where the camera centre
 * lands — the gap between the title and the rows on a phone, the open left of
 * the screen on a desk where the menu floats on the right.
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
/** The camera kick on the big hit: peak offset in art px, and its length. */
const KICK_PX = 3
const KICK_S = 0.5
/** The warm flare where the champion falls. */
const FLARE_S = 0.8
const FLARE_R = 130
/** How far (art px) the field's edge is feathered into the woodland. */
const FEATHER = 44
/** Art px from a figure's feet (its position) up to where the eye reads it. */
const AIM_LIFT = 22
/** The warm grade the composite gets, applied to the apron too so the two meet. */
const WARM = 'rgba(255,186,110,0.06)'

/**
 * The apron with the composite's warm grade baked in (once per apron bake):
 * without it the lit field and the woodland meet on a visible seam the moment
 * the camera shows both. One per mounted demo, so the copy goes when it does.
 */
function apronWarmer(): (src: HTMLCanvasElement) => HTMLCanvasElement {
  let warmed: { src: HTMLCanvasElement; out: HTMLCanvasElement } | null = null
  return (src) => {
    if (warmed?.src === src) return warmed.out
    const out = document.createElement('canvas')
    out.width = src.width
    out.height = src.height
    const c = out.getContext('2d')
    if (!c) return src
    c.drawImage(src, 0, 0)
    c.globalCompositeOperation = 'overlay'
    c.fillStyle = WARM
    c.fillRect(0, 0, out.width, out.height)
    warmed = { src, out }
    return out
  }
}

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}

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
    const M = apronMargins(map)
    const comp = document.createElement('canvas')
    comp.width = map.width
    comp.height = map.height
    const cctx = comp.getContext('2d')
    if (!cctx) return
    cctx.imageSmoothingEnabled = false
    const warm = apronWarmer()

    // Built in the warm-up below, not here: nothing heavy runs in the commit.
    let script: AttractScript | null = null
    let engine: GameEngine | null = null
    let differ: FxDiffer | null = null
    /** Wall seconds into the current loop (the hitstop included). */
    let loopT = 0
    let anim = 0
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
    let focusX = 0.5
    let focusY = 0.5
    let spillR = false
    let spillT = false
    let ground = '#201711'
    let pull: [number, number] = [0.2, 0.62]
    const layout = () => {
      cssW = Math.max(1, Math.floor(frameEl.clientWidth))
      cssH = Math.max(1, Math.floor(frameEl.clientHeight))
      dpr = window.devicePixelRatio || 1
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      // A frame laid out on a fractional pixel would put every art pixel
      // across two device pixels; nudge the canvas back onto the device grid.
      const r = frameEl.getBoundingClientRect()
      const fx = r.left * dpr - Math.floor(r.left * dpr)
      const fy = r.top * dpr - Math.floor(r.top * dpr)
      canvas.style.transform = fx || fy ? `translate(${-fx / dpr}px, ${-fy / dpr}px)` : ''
      canvas.style.imageRendering = 'pixelated'
      const cs = getComputedStyle(frameEl)
      const num = (name: string, fb: number) => {
        const v = parseFloat(cs.getPropertyValue(name))
        return Number.isFinite(v) ? v : fb
      }
      focusX = num('--cine-fx', 0.5)
      focusY = num('--cine-fy', 0.5)
      spillR = num('--cine-spill-r', 0) > 0
      spillT = num('--cine-spill-t', 0) > 0
      ground = cs.getPropertyValue('--bg').trim() || ground
      // CSS px per art px, so the shot is about the same in art px everywhere:
      // ~390 art px across a portrait phone, ~450 art px tall on a desk (2 at
      // 1440×900) — a closer camera than the battle's, which is what lets it
      // travel. Always a whole number of DEVICE px, rounded with a little give
      // toward the bigger rung (a 375-wide phone at dpr 2 keeps k = 2).
      // (A portrait tablet stops at 1.5: its menu keeps the phone column, and
      // at 2 the champion alone filled the window.)
      const want = cssH > cssW ? Math.min(1.5, cssW / 390) : cssH / 450
      k = Math.max(1, Math.min(6, Math.floor(want * dpr + 0.3)))
      // How far the camera leans from the champion toward the company: a
      // narrow view stays on him, a wide one keeps them both in the shot.
      const viewArt = (cssW * dpr) / k
      pull = viewArt < 700 ? [0.08, 0.5] : [0.2, 0.62]
    }
    layout()
    const relayout = () => {
      layout()
      if (drawn) paint(camAt())
    }
    const ro = new ResizeObserver(relayout)
    ro.observe(frameEl)
    window.addEventListener('resize', relayout)

    const cut = () => {
      const s = script!
      const hitAt = (s.hitTick - s.startTick) / 60
      const total = s.lengthTicks / 60 + ATTRACT_CUT.hitstop
      return { hitAt, total }
    }

    const resetLoop = () => {
      fxReset()
      engine = createAttractEngine(script!.startTick)
      differ = new FxDiffer(engine)
      loopT = 0
    }

    /** Seconds since the big hit, in wall time (negative before it). */
    const sinceHit = () => loopT - cut().hitAt

    /** The camera centre (field px) for this moment of the loop, kick included. */
    const camAt = () => {
      const s = script!
      const simSec = (engine!.tick - s.startTick) / 60
      const c = attractCamera(s, simSec, pull)
      // Positions are feet; the figures stand above them. Aim at their middle.
      c.y -= AIM_LIFT
      const u = sinceHit()
      if (u >= 0 && u < KICK_S) {
        // A fixed, decaying pattern — the same kick every loop — in whole art px.
        const a = KICK_PX * (1 - u / KICK_S) ** 2
        return { x: c.x + Math.round(a * Math.sin(u * 53)), y: c.y + Math.round(a * Math.cos(u * 71)) }
      }
      return c
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
        cctx.fillStyle = WARM
        cctx.fillRect(0, 0, map.width, map.height)
        cctx.globalCompositeOperation = 'source-over'
      } finally {
        setPresentationTime(prevT)
        setViewScale(prevScale)
      }
    }

    /**
     * Where the field's origin lands on the device canvas, for a camera centre
     * `cam`: the centre on the page's focal point, on whole device pixels, and
     * clamped. Where the view fits inside the field on an axis it stays inside
     * the field — the woodland apron meets the lit field on a deliberate step
     * (the battle's treeline) that reads as a frame edge on a title screen —
     * except on a side the page opens (`--cine-spill-r` / `--cine-spill-t`:
     * the desk's menu column covers its right, and its establishing shot looks
     * up the road into the wood). Where it cannot fit, it may use the apron,
     * never beyond.
     */
    const origin = (view: number, size: number, margin: number, focus: number, c: number, spillLo = false, spillHi = false) => {
      const fits = view <= size * k
      const lo = view - (size + (fits && !spillHi ? 0 : margin)) * k
      const hi = (fits && !spillLo ? 0 : margin) * k
      if (lo > hi) return Math.round((view - size * k) / 2)
      return Math.round(Math.min(hi, Math.max(lo, view * focus - c * k)))
    }

    /** Copy the composite (and the apron round it) to the device at ratio k. */
    const paint = (cam: { x: number; y: number }) => {
      const W = canvas.width
      const H = canvas.height
      const fw = map.width * k
      const fh = map.height * k
      const ox = origin(W, map.width, M.x, focusX, cam.x, false, spillR)
      const oy = origin(H, map.height, M.y, focusY, cam.y, spillT, false)
      vctx.setTransform(1, 0, 0, 1, 0, 0)
      vctx.imageSmoothingEnabled = false
      if (ox > 0 || oy > 0 || ox + fw < W || oy + fh < H) {
        const apron = getApron(map)
        if (apron) {
          // Only the bands the field does not cover (a phone always shows
          // woodland above and below, and blitting the whole apron under the
          // field every frame was a second full-screen fill). Band edges sit
          // on whole art px from the field's edge, so the copy stays on grid.
          const a = warm(apron)
          const band = (sx: number, sy: number, sw: number, sh: number) => {
            if (sw > 0 && sh > 0) vctx.drawImage(a, sx, sy, sw, sh, ox + (sx - M.x) * k, oy + (sy - M.y) * k, sw * k, sh * k)
          }
          const up = Math.min(M.y, Math.ceil(oy / k))
          const down = Math.min(M.y, Math.ceil((H - oy - fh) / k))
          const left = Math.min(M.x, Math.ceil(ox / k))
          const right = Math.min(M.x, Math.ceil((W - ox - fw) / k))
          const x0 = M.x - left
          const wAll = left + map.width + right
          band(x0, M.y - up, wAll, up)
          band(x0, M.y + map.height, wAll, down)
          band(x0, M.y, left, map.height)
          band(M.x + map.width, M.y, right, map.height)
        } else {
          vctx.fillStyle = '#2b3a1e'
          vctx.fillRect(0, 0, W, H)
        }
      }
      vctx.drawImage(comp, ox, oy, fw, fh)
      // Where the woodland shows, feather the lit field into it: the apron
      // steps down in one flat band at the field's edge (right for a battle,
      // where it is the Stage's frame), which on a moving title shot reads as
      // a hard line across the screen.
      const F = FEATHER * k
      const feather = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
        const g = vctx.createLinearGradient(x0, y0, x1, y1)
        g.addColorStop(0, 'rgba(18,11,5,0.42)')
        g.addColorStop(1, 'rgba(18,11,5,0)')
        vctx.fillStyle = g
        vctx.fillRect(rx, ry, rw, rh)
      }
      if (oy > 0) feather(0, oy, 0, oy + F, ox, oy, fw, F)
      if (oy + fh < H) feather(0, oy + fh, 0, oy + fh - F, ox, oy + fh - F, fw, F)
      if (ox > 0) feather(ox, 0, ox + F, 0, ox, oy, F, fh)
      if (ox + fw < W) feather(ox + fw, 0, ox + fw - F, 0, ox + fw - F, oy, F, fh)

      if (!script) return
      // The flare: a warm bloom where the champion fell, over in half a second.
      const u = sinceHit()
      if (u >= 0 && u < FLARE_S) {
        const a = 0.6 * (1 - u / FLARE_S) ** 1.5
        const px = ox + script.hitPos.x * k
        const py = oy + script.hitPos.y * k
        const r = FLARE_R * k
        const g = vctx.createRadialGradient(px, py, 0, px, py, r)
        g.addColorStop(0, `rgba(255,226,170,${a})`)
        g.addColorStop(0.45, `rgba(255,170,90,${a * 0.45})`)
        g.addColorStop(1, 'rgba(255,150,70,0)')
        vctx.globalCompositeOperation = 'lighter'
        vctx.fillStyle = g
        vctx.fillRect(px - r, py - r, r * 2, r * 2)
        vctx.globalCompositeOperation = 'source-over'
      }
      // The fades, to and from the page's own ground.
      const { total } = cut()
      const fade = Math.max(1 - smooth(loopT / ATTRACT_CUT.fadeIn), smooth((loopT - (total - ATTRACT_CUT.fadeOut)) / ATTRACT_CUT.fadeOut))
      if (fade > 0.002) {
        vctx.globalAlpha = fade
        vctx.fillStyle = ground
        vctx.fillRect(0, 0, W, H)
        vctx.globalAlpha = 1
      }
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      let dt = (now - last) / 1000
      if (dt < FRAME - 0.004) return // the 30 fps budget: skip this vsync
      last = now
      if (dt > 0.25) dt = 0.25
      if (!engine || !differ || !script) return

      const { hitAt, total } = cut()
      loopT += dt
      if (loopT >= total) resetLoop()
      const frozen = loopT >= hitAt && loopT < hitAt + ATTRACT_CUT.hitstop
      setFxReducedMotion(false)
      if (!frozen) {
        fxAdvance(dt)
        anim += dt
        // Play to the tick this moment of the loop belongs to.
        const simSec = loopT >= hitAt + ATTRACT_CUT.hitstop ? loopT - ATTRACT_CUT.hitstop : loopT
        const target = script.startTick + Math.min(script.lengthTicks, Math.floor(simSec * 60 + 1e-6))
        const d = differ
        if (target > engine.tick)
          stepAttract(engine, target - engine.tick, {
            before: (e) => d.snapBefore(e),
            after: (e) => d.diffAfter(e, 1),
          })
      }
      compose()
      paint(camAt())
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
     * Warm-up, one idle slice per step, so a tap never waits on more than one
     * slice: the terrain bake (the battle's own cache — the first real battle
     * on this map inherits it), the apron, the director's headless play of the
     * scene in ~240-tick chunks, the engine at the opening frame, and the unit
     * pixmaps. The loop's first frame is then an ordinary 1 ms frame.
     */
    type IdleWin = Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    const w = window as IdleWin
    let idleId = 0
    const idle = (fn: () => void) =>
      (idleId = w.requestIdleCallback ? w.requestIdleCallback(fn, { timeout: 1000 }) : window.setTimeout(fn, 60))
    const director = directAttractSteps()
    /** A stage returning `true` wants another slice. */
    const stages: (() => boolean | void)[] = [
      () => {
        fxPreload()
        drawField(cctx, map)
      },
      () => {
        const a = getApron(map)
        if (a) warm(a)
      },
      () => {
        const r = director.next()
        if (!r.done) return true
        script = r.value
      },
      () => {
        resetLoop()
      },
      () => compose(),
      () => {
        ready = true
        if (runningNow.current) loop.current?.start()
      },
    ]
    const run = (i: number) => {
      if (cancelled || i >= stages.length) return
      const again = stages[i]() === true
      idle(() => run(again ? i : i + 1))
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
