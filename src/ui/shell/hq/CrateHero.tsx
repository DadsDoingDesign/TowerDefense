import { useEffect, useRef } from 'react'
import { shade, type Palette } from '../../../game/data/pixelArt'
import { fxLevel } from '../../../game/render/fxQuality'
import { useMenuMotion } from '../MenuScreen'
import { CRATE_BODY, CRATE_LID, CRATE_LOOKS, LOOK_LIGHT, LOOK_SCALE, PLINTH, PLINTH_PALETTE, type CrateLook } from './crateArt'
import { breathAt, HOP_EVERY_MS, hopAt, idleFps, idleSparks, RAY_TURN_MS, rattleAt, SEAL_MS } from './crateIdle'
import type { CrateFx } from './crateSequence'

const ROWS = [...CRATE_LID, ...CRATE_BODY]
const CW = ROWS[0].length
const CH = ROWS.length
/** The plinth's own pixel: the stage, not the chest, so the chest visibly grows on it. */
const PLINTH_PX = 5
/** The seam between the lid and the body, in crate pixels from the top. */
const SEAM_Y = CRATE_LID.length - 1
/** The seal's red pixels, in crate pixels: they pulse. */
const SEAL_PX: Array<[number, number]> = []
CRATE_BODY.forEach((row, y) => [...row].forEach((ch, x) => ch === 'r' && SEAL_PX.push([x, y + CRATE_LID.length])))

function bake(rows: readonly string[], pal: Palette, s: number, grow = 0, color?: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = rows[0].length * s + grow * 2 * s
  c.height = rows.length * s + grow * 2 * s
  const g = c.getContext('2d')!
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.' || !pal[ch]) continue
      g.fillStyle = color ?? pal[ch]
      g.fillRect(x * s, y * s, s + grow * 2 * s, s + grow * 2 * s)
    }
  })
  return c
}
const step8 = (a: number) => Math.max(0, Math.min(1, Math.round(a * 8) / 8))

interface Spark {
  x: number
  y: number
  age: number
  life: number
}

/**
 * The hero chest on its stage (the chest pass, Oct 2026): the crates screen's
 * centre — the chest you are about to open, in the look of how many you open
 * at once (`crateArt.lookFor`), on a stone plinth, lit, alive (`crateIdle`):
 * its glow breathes, sparkles come and go, light leaks at the lid's seam, the
 * seal pulses, rays turn slowly behind it, and now and then it hops. A
 * `poke` (a touch, a look change) makes it hop at once.
 *
 * One small canvas and one loop, asleep when hidden or `paused` (the opening
 * is up); Light draws at half the rate with half the sparkles; reduced motion
 * draws one still frame.
 */
export function CrateHero({ look, poke, paused }: { look: CrateLook; poke: number; paused: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const motion = useMenuMotion()
  const state = useRef({ hop0: -1e9, nextHop: 0, sparks: [] as Spark[], seed: 0x51c3 })

  // A poke (or a new look): hop now.
  useEffect(() => {
    const now = performance.now()
    state.current.hop0 = now
    state.current.nextHop = now + HOP_EVERY_MS[look]
  }, [poke, look])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const g = canvas.getContext('2d')!
    const s = LOOK_SCALE[look]
    const pal = CRATE_LOOKS[look]
    const lightC = LOOK_LIGHT[look]
    const chest = bake(ROWS, pal, s)
    const glow = bake(ROWS, pal, s, 1, lightC)
    const plinth = bake(PLINTH, PLINTH_PALETTE, PLINTH_PX)
    const st = state.current
    const rand = () => ((st.seed = (st.seed * 1664525 + 1013904223) >>> 0) / 4294967296)
    let w = 0
    let h = 0
    const fit = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w
      canvas.height = h
    }
    fit()
    const fxNow = (): CrateFx => (motion ? fxLevel() : 'off')

    const draw = (now: number) => {
      const fx = fxNow()
      g.setTransform(1, 0, 0, 1, 0, 0)
      g.imageSmoothingEnabled = false
      g.clearRect(0, 0, w, h)
      const plTop = h - plinth.height - 4
      const cx = Math.round(w / 2)
      const cwPx = CW * s
      const chPx = CH * s
      const baseY = plTop + PLINTH_PX * 2 // the chest stands on the plinth's top slab
      const midY = baseY - chPx / 2
      const breath = fx === 'off' ? 0.6 : breathAt(now)

      // Rays: a slow turn of soft wedges behind the chest.
      const turn = fx === 'off' ? 0 : ((now % RAY_TURN_MS) / RAY_TURN_MS) * Math.PI * 2
      const n = look === 'gold' ? 14 : look === 'iron' ? 12 : 10
      const len = Math.max(w, h) * 0.75
      g.fillStyle = lightC
      g.globalAlpha = step8(0.07 + 0.04 * breath + (look === 'gold' ? 0.04 : 0))
      for (let i = 0; i < n; i++) {
        const th = turn + (i / n) * Math.PI * 2
        const half = Math.PI / n / 2.4
        g.beginPath()
        g.moveTo(cx, midY)
        g.lineTo(cx + Math.cos(th - half) * len, midY + Math.sin(th - half) * len)
        g.lineTo(cx + Math.cos(th + half) * len, midY + Math.sin(th + half) * len)
        g.closePath()
        g.fill()
      }
      // A pool of light on the plinth.
      g.globalAlpha = step8(0.25 + 0.15 * breath)
      g.fillStyle = shade(lightC, -0.15)
      g.fillRect(cx - cwPx * 0.7, plTop - 2, cwPx * 1.4, 4)
      g.globalAlpha = 1
      g.drawImage(plinth, Math.round(cx - plinth.width / 2), plTop)

      // The hop (now and then, or when poked).
      if (fx !== 'off' && now >= st.nextHop) {
        st.hop0 = now
        st.nextHop = now + HOP_EVERY_MS[look]
      }
      const hop = fx === 'off' ? { lift: 0, squash: 1 } : hopAt(now - st.hop0)
      const sx = 2 - hop.squash
      const lift = Math.round(hop.lift) * s
      // Its shadow, smaller while it is up.
      g.globalAlpha = 0.45
      g.fillStyle = '#0b0705'
      const shw = Math.round(cwPx * 0.5 * (1 - hop.lift / 12))
      g.fillRect(cx - shw, baseY - 3, shw * 2, 5)
      g.globalAlpha = 1

      // Halfway between hops, a rattle: something inside wants out.
      const tilt = fx === 'off' ? 0 : rattleAt(now - (st.nextHop - HOP_EVERY_MS[look] / 2))
      // A soft halo behind, breathing: three stepped discs.
      g.fillStyle = lightC
      for (let k = 3; k >= 1; k--) {
        g.globalAlpha = step8((0.05 + 0.07 * breath) * (look === 'gold' ? 1.4 : 1))
        const r = Math.round((cwPx * 0.32 + 6 * breath) * k * 0.62)
        for (let y = -r; y <= r; y += 3) {
          const hw = Math.round(Math.sqrt(r * r - y * y) / 3) * 3
          g.fillRect(cx - hw, Math.round(midY + y), hw * 2, 3)
        }
      }
      g.globalAlpha = 1
      g.save()
      g.translate(cx, baseY - lift)
      if (tilt) g.rotate(tilt)
      g.scale(sx, hop.squash)
      // The breathing glow: the silhouette in the look's light, one pixel wider.
      g.globalAlpha = step8(0.2 + 0.5 * breath + (look === 'gold' ? 0.12 : 0))
      g.drawImage(glow, -cwPx / 2 - s, -chPx - s)
      g.globalAlpha = 1
      g.drawImage(chest, -cwPx / 2, -chPx)
      // Light leaking at the lid's seam.
      g.globalAlpha = step8(0.3 + 0.6 * breath * (0.85 + 0.15 * Math.sin(now / 37)))
      g.fillStyle = shade(lightC, 0.5)
      g.fillRect(-cwPx / 2 + 2 * s, -chPx + SEAM_Y * s + Math.floor(s / 2), cwPx - 4 * s, Math.max(2, Math.floor(s / 2)))
      // The seal's pulse.
      const seal = fx === 'off' ? 0.2 : 0.5 + 0.5 * Math.sin((now / SEAL_MS) * Math.PI * 2)
      g.globalAlpha = step8(0.45 * seal)
      g.fillStyle = '#ffb4a2'
      for (const [x, y] of SEAL_PX) g.fillRect(-cwPx / 2 + x * s, -chPx + y * s, s, s)
      g.restore()
      g.globalAlpha = 1

      // Sparkles round the chest: a plus of 3 px arms, twinkling in eighths.
      const want = idleSparks(look, fx)
      while (st.sparks.length < want) st.sparks.push({ x: 0, y: 0, age: 1, life: 0 })
      if (st.sparks.length > want) st.sparks.length = want
      g.fillStyle = shade(lightC, 0.6)
      for (const p of st.sparks) {
        if (p.age >= p.life) {
          p.x = Math.round((cx + (rand() - 0.5) * cwPx * 1.6) / 3) * 3
          p.y = Math.round((midY + (rand() - 0.5) * chPx * 1.5) / 3) * 3
          p.age = -rand() * 400
          p.life = 500 + rand() * 500
        }
        if (p.age < 0) continue
        g.globalAlpha = step8(Math.sin((p.age / p.life) * Math.PI))
        // A mote drifts up as it twinkles (in whole 3 px steps).
        const y = p.y - Math.round((p.age / p.life) * 4) * 3
        g.fillRect(p.x - 3, y, 9, 3)
        g.fillRect(p.x, y - 3, 3, 9)
      }
      g.globalAlpha = 1
    }

    let raf = 0
    let lastDraw = 0
    const frames: number[] = []
    const loop = (now: number) => {
      raf = 0
      if (paused || document.hidden) return
      const fx = fxNow()
      const fps = idleFps(fx)
      if (!fps) return draw(now)
      if (now - lastDraw >= 1000 / fps - 4) {
        const dt = lastDraw ? Math.min(100, now - lastDraw) : 16
        for (const p of state.current.sparks) p.age += dt
        if (lastDraw) frames.push(now - lastDraw)
        if (frames.length > 300) frames.shift()
        lastDraw = now
        draw(now)
      }
      raf = requestAnimationFrame(loop)
    }
    const start = () => {
      if (!raf) raf = requestAnimationFrame(loop)
    }
    const ro = new ResizeObserver(() => {
      fit()
      draw(performance.now())
    })
    ro.observe(canvas)
    draw(performance.now())
    start()
    const onVis = () => !document.hidden && start()
    document.addEventListener('visibilitychange', onVis)
    if (import.meta.env.DEV) Object.assign(window, { __crateIdleFrames: frames })
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [look, paused, motion])

  return <canvas ref={ref} className="cr-hero-canvas" aria-hidden="true" />
}
