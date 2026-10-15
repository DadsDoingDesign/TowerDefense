import type { ThemeId } from '../../game/run/militiaTheme'
import { ambientCap, drawParticle, FX_PX, step, WORLDS, type Particle, type Pen, type Sweep } from './fxWorlds'

/**
 * The company worlds' one effect loop (Oct 2026).
 *
 * Two pixel canvases, one `requestAnimationFrame` loop:
 *  - the AMBIENT layer — the page's or the home map's own `<canvas class="th-fx">`
 *    (`ThemeFx.tsx`), drawn BEHIND every panel, so an effect never sits under
 *    text without a backing. Only one is attached at a time; the battle and the
 *    run map (the four bands) attach none, so a live wave costs nothing;
 *  - the OVERLAY — one fixed canvas over everything, used only while a press
 *    burst or a switch-in is playing (a few hundred ms).
 *
 * The loop sleeps when there is nothing to draw, while the tab is hidden, and
 * entirely under reduced motion (no particles, no bursts, no switch-ins — the
 * frames and textures stay, static). Ambient particles are capped (60 on a
 * phone, 110 on a desk; `fxWorlds.ambientCap`); under high contrast they are
 * dimmed, never brightened.
 */
interface Layer {
  canvas: HTMLCanvasElement
  pen: CanvasRenderingContext2D
  w: number
  h: number
}

const BURST_CAP = 240

class FxEngine {
  theme: ThemeId = 'neutral'
  private ambient: Layer | null = null
  private overlay: Layer | null = null
  private parts: Particle[] = []
  /** The last world's particles, fading out where they are after a switch. */
  private fading: Particle[] = []
  private over: Particle[] = []
  private sweep: (Sweep & { theme: ThemeId }) | null = null
  private raf = 0
  private last = 0
  private t = 0
  private seeded = false
  private bornAt = typeof performance === 'undefined' ? 0 : performance.now()
  private rand = Math.random

  /** Frames drawn, for the dev handle's smoothness check. */
  frames = 0
  /** The page's text, in effect pixels: the ambient layer is cleared under it. */
  private keep: [number, number, number, number][] = []
  private keptAt = -1e9

  private get still(): boolean {
    if (typeof document === 'undefined') return true
    if (document.documentElement.dataset.reducedMotion === 'true') return true
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  private get dim(): number {
    return document.documentElement.dataset.contrast === 'high' ? 0.6 : 1
  }

  setTheme(id: ThemeId): void {
    if (id === this.theme) return
    this.theme = id
    // The old world's particles fade out where they are; the new one fills in.
    for (const q of this.parts) q.life = Math.min(q.life, q.age + 0.5)
    this.fading = this.parts
    this.parts = []
    this.seeded = false
    this.wake()
  }

  attachAmbient(canvas: HTMLCanvasElement): () => void {
    const pen = canvas.getContext('2d')
    if (!pen) return () => {}
    this.ambient = { canvas, pen, w: 0, h: 0 }
    this.parts = []
    this.seeded = false
    this.wake()
    return () => {
      if (this.ambient?.canvas === canvas) this.ambient = null
    }
  }

  /** A press: the theme's burst at a point on screen (CSS px). */
  burst(cssX: number, cssY: number): void {
    if (this.still) return
    const world = WORLDS[this.theme]
    const add = world.burst(this.rand, cssX / FX_PX, cssY / FX_PX)
    this.over.push(...add)
    if (this.over.length > BURST_CAP) this.over.splice(0, this.over.length - BURST_CAP)
    this.wake()
  }

  /** The switch-in: the theme's flare / wipe / strike / sweep / shimmer over the whole screen. */
  switchIn(id: ThemeId): void {
    if (this.still || performance.now() - this.bornAt < 1200) return
    const world = WORLDS[id]
    const o = this.ensureOverlay()
    this.fit(o)
    this.over.push(...world.switchIn(this.rand, o.w, o.h))
    if (this.over.length > BURST_CAP) this.over.splice(0, this.over.length - BURST_CAP)
    this.sweep = world.drawSweep ? { theme: id, age: 0, life: world.sweepLife ?? 0.5 } : null
    this.wake()
  }

  /** How many particles are alive (dev handle; the cap is checked in the running app). */
  count(): { ambient: number; overlay: number } {
    return { ambient: this.parts.length, overlay: this.over.length }
  }

  /**
   * Where the page's text is: every line box of every text node in the page
   * the layer belongs to (and its form controls), padded a pixel, in effect
   * pixels. Measured a few times a second — the layer then never draws under
   * a word, whatever the panel behind it is made of.
   */
  private measureKeepOut(canvas: HTMLCanvasElement, now: number): void {
    this.keptAt = now
    const root = canvas.closest('.pg, .cx') ?? canvas.parentElement
    const out: [number, number, number, number][] = []
    if (root) {
      const push = (r: DOMRect) => {
        if (r.width <= 0 || r.height <= 0 || r.bottom < 0 || r.top > window.innerHeight) return
        const x = Math.floor(r.left / FX_PX) - 1
        const y = Math.floor(r.top / FX_PX) - 1
        out.push([x, y, Math.ceil(r.right / FX_PX) + 1 - x, Math.ceil(r.bottom / FX_PX) + 1 - y])
      }
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      const range = document.createRange()
      for (let n = walk.nextNode(); n && out.length < 600; n = walk.nextNode()) {
        if (!n.textContent?.trim()) continue
        range.selectNodeContents(n)
        for (const r of range.getClientRects()) push(r)
      }
      for (const el of root.querySelectorAll('input, select, textarea, [role="slider"]')) push(el.getBoundingClientRect())
    }
    this.keep = out
  }

  private ensureOverlay(): Layer {
    if (this.overlay) return this.overlay
    const canvas = document.createElement('canvas')
    canvas.className = 'th-fx-over'
    canvas.setAttribute('aria-hidden', 'true')
    document.body.appendChild(canvas)
    this.overlay = { canvas, pen: canvas.getContext('2d')!, w: 0, h: 0 }
    return this.overlay
  }

  private fit(l: Layer): void {
    const w = Math.ceil(window.innerWidth / FX_PX)
    const h = Math.ceil(window.innerHeight / FX_PX)
    if (w === l.w && h === l.h) return
    l.w = w
    l.h = h
    l.canvas.width = w
    l.canvas.height = h
    l.canvas.style.width = `${w * FX_PX}px`
    l.canvas.style.height = `${h * FX_PX}px`
  }

  private wake(): void {
    if (this.raf || typeof window === 'undefined') return
    if (this.still || document.hidden) {
      this.clear()
      return
    }
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.tick)
  }

  private clear(): void {
    for (const l of [this.ambient, this.overlay]) l?.pen.clearRect(0, 0, l.w, l.h)
    this.over = []
    this.sweep = null
  }

  private tick = (now: number): void => {
    this.raf = 0
    if (this.still || document.hidden) {
      this.clear()
      return
    }
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000))
    this.last = now
    this.t += dt
    this.frames++
    const dim = this.dim
    const world = WORLDS[this.theme]

    const a = this.ambient
    if (a) {
      this.fit(a)
      if (now - this.keptAt > 300) this.measureKeepOut(a.canvas, now)
      const cap = ambientCap(world, a.w, a.h, window.innerWidth)
      if (!this.seeded) {
        while (this.parts.length < cap) this.parts.push(world.spawn(this.rand, a.w, a.h, true))
        this.seeded = true
      }
      // Keep the screen full: a couple of new particles a frame, never past the cap.
      for (let i = 0; i < 2 && this.parts.length < cap; i++) this.parts.push(world.spawn(this.rand, a.w, a.h, false))
      this.parts = this.parts.filter((q) => step(q, dt, a.w, a.h))
      this.fading = this.fading.filter((q) => step(q, dt, a.w, a.h))
      const pen = a.pen as unknown as Pen
      a.pen.clearRect(0, 0, a.w, a.h)
      if (world.backdrop) {
        world.backdrop(pen, a.w, a.h, this.t)
        a.pen.globalAlpha = 1
      }
      // The backdrop is drawn at full strength under high contrast's dim too:
      // it is already faint. Particles are dimmed.
      for (const q of this.fading) drawParticle(pen, q, dim)
      for (const q of this.parts) drawParticle(pen, q, dim)
      a.pen.globalAlpha = 1
      // Nothing under text: clear the layer under every line of the page's text.
      for (const [x, y, w, h] of this.keep) a.pen.clearRect(x, y, w, h)
    }

    const o = this.overlay
    if (o && (this.over.length || this.sweep)) {
      this.fit(o)
      this.over = this.over.filter((q) => step(q, dt, o.w, o.h))
      o.pen.clearRect(0, 0, o.w, o.h)
      const pen = o.pen as unknown as Pen
      if (this.sweep) {
        this.sweep.age += dt
        const sw = WORLDS[this.sweep.theme]
        if (this.sweep.age >= this.sweep.life || !sw.drawSweep) this.sweep = null
        else sw.drawSweep(pen, o.w, o.h, this.sweep)
      }
      for (const q of this.over) drawParticle(pen, q, 1)
      o.pen.globalAlpha = 1
    } else if (o) {
      o.pen.clearRect(0, 0, o.w, o.h)
    }

    if (a || this.over.length || this.sweep) this.raf = requestAnimationFrame(this.tick)
  }

  /** Wire the presses and the tab's visibility, once. */
  install(): void {
    if (typeof document === 'undefined' || (window as unknown as { __fxInstalled?: boolean }).__fxInstalled) return
    ;(window as unknown as { __fxInstalled?: boolean }).__fxInstalled = true
    document.addEventListener('visibilitychange', () => this.wake())
    const isCta = (el: EventTarget | null): HTMLElement | null => {
      const b = (el as HTMLElement | null)?.closest?.('.pg-cta') as HTMLButtonElement | null
      return b && !b.disabled ? b : null
    }
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (isCta(e.target)) this.burst(e.clientX, e.clientY)
      },
      { capture: true, passive: true },
    )
    // A keyboard press: the burst from the button's middle.
    document.addEventListener(
      'click',
      (e) => {
        const b = e.detail === 0 ? isCta(e.target) : null
        if (!b) return
        const r = b.getBoundingClientRect()
        this.burst(r.left + r.width / 2, r.top + r.height / 2)
      },
      { capture: true, passive: true },
    )
  }
}

export const fx = new FxEngine()

if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __fx: FxEngine }).__fx = fx
