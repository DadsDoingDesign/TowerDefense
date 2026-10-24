import type { ThemeId } from '../../game/run/militiaTheme'
import * as fxQuality from '../../game/render/fxQuality'
import { fxLevel, noteFxFrame } from '../../game/render/fxQuality'
import { PixelPen } from './pixelPen'
import { ambientCap, burstClip, drawParticle, FX_PX, step, SWITCH_S, WORLDS, type Particle, type Pen, type Scene, type Sweep, type Zone } from './fxWorlds'

/**
 * The company worlds' one effect loop (Oct 2026).
 *
 * Two pixel canvases, one `requestAnimationFrame` loop:
 *  - the AMBIENT layer — the page's or the home map's own `<canvas class="th-fx">`
 *    (`ThemeFx.tsx`), drawn BEHIND every panel, so an effect never sits under
 *    text without a backing. Only one is attached at a time; the battle and the
 *    run map (the four bands) attach none, so a live wave costs nothing. It is
 *    drawn in software (`pixelPen.ts`) at 24 fps, its backdrop at 12, and put
 *    on the canvas in one `putImageData`;
 *  - the OVERLAY — one fixed canvas over everything, used only while a press
 *    burst or a switch-in is playing (a few hundred ms). A press burst is
 *    clipped to its CTA and the margins round it (`fxWorlds.burstClip`), and
 *    the overlay is cleared under every word inside that zone — the CTA's own
 *    label included — so a burst never crosses text. While a switch-in
 *    sweeps the screen, it is cleared under every word and every panel on it.
 *
 * The loop sleeps when there is nothing to draw, while the tab is hidden, and
 * entirely under reduced motion (no particles, no bursts, no switch-ins — the
 * frames and textures stay, static). Ambient particles are capped (24 on a
 * phone, 40 on a desk; `fxWorlds.ambientCap`) and drawn at their world's
 * `peak`; under high contrast they are dimmed, never brightened. A change of
 * world is a crossfade (`fxWorlds.SWITCH_S`): the old particles and backdrop
 * fade out where they are while the new ones fade in.
 */
interface Layer {
  canvas: HTMLCanvasElement
  pen: CanvasRenderingContext2D
  w: number
  h: number
}
/** The ambient layer's pixels, drawn in software and put on its canvas once a frame. */
interface Buffers {
  w: number
  h: number
  frame: PixelPen
  backdrop: PixelPen
  /** The last world's backdrop, crossfading out after a switch. */
  prev: PixelPen
  image: ImageData
  /** When the backdrop was last drawn, and for which world. */
  at: number
  theme: ThemeId | null
}

const BURST_CAP = 240
/**
 * The ambient layer draws at a pixel-art cadence, 24 a second (a particle
 * moves a whole effect pixel only every few frames anyway); its backdrop
 * (glows, washes, the flame line) at 12.
 */
const AMBIENT_MS = 1000 / 24 - 2
const BACKDROP_MS = 1000 / 12 - 2

/** The panels the ambient layer keeps out of (the framed ones and their kin). */
const PANELS = [
  '.mn-card', '.mn-slot', '.mn-season', '.mn-coach', '.mn-own', '.pg-strip', '.shop-wares', '.shop-counter',
  '.pg-row', '.pg-chip', '.pg-notice', '.hq-card', '.tk-card', '.tk-row', '.tk-chip',
  '.fc-sheet', '.co-col', '.pk-card', '.pk-tok', '.ask-panel', '.ct-mode', '.ct-stand-btn',
  '.ct-route', '.ct-slip', '.ct-banner', '.sh-context', '.cx-tile', '.cx-card', '.cx-tab',
].join(', ')

class FxEngine {
  theme: ThemeId = 'neutral'
  private ambient: Layer | null = null
  private overlay: Layer | null = null
  private parts: Particle[] = []
  /** The last world's particles, fading out where they are after a switch. */
  private fading: Particle[] = []
  private fadingTheme: ThemeId = 'neutral'
  /** When (this.t) the theme last changed: the crossfade runs `SWITCH_S` from it. */
  private switchedAt = -1e9
  private over: Particle[] = []
  private sweep: (Sweep & { theme: ThemeId }) | null = null
  private raf = 0
  private last = 0
  private t = 0
  private seeded = false
  private bornAt = typeof performance === 'undefined' ? 0 : performance.now()
  private rand = Math.random

  private bufs: Buffers | null = null
  private ambientAt = -1e9
  /** Slow motion for a capture (the review strips); 1 in play. */
  timeScale = 1
  /** Frames drawn, for the dev handle's smoothness check. */
  frames = 0
  /** The page's text, in effect pixels: the ambient layer is cleared under it. */
  private keep: [number, number, number, number][] = []
  private keptAt = -1e9
  /** Where the world burns along and crowds round (`fxWorlds.Scene`), measured with the text. */
  private scene: Scene = { floor: 1e9, hot: [], map: false }
  /** The words inside the live bursts' zones: the overlay is cleared under them. */
  private overKeep: [number, number, number, number][] = []
  private overKeptAt = -1e9

  /** Held by a full-screen moment that draws its own effects (the crate opening): one big effect at a time. */
  private held = false
  hold(on: boolean): void {
    this.held = on
    if (on) this.clear()
    else this.wake()
  }
  private get still(): boolean {
    if (typeof document === 'undefined' || this.held) return true
    if (fxLevel() === 'off') return true
    if (document.documentElement.dataset.reducedMotion === 'true') return true
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  private get dim(): number {
    return document.documentElement.dataset.contrast === 'high' ? 0.6 : 1
  }

  setTheme(id: ThemeId): void {
    if (id === this.theme) return
    // A crossfade over `SWITCH_S`: the old world's particles and backdrop
    // fade out where they are while the new one fades in.
    this.fadingTheme = this.theme
    this.theme = id
    this.fading = this.parts
    this.parts = []
    this.seeded = false
    this.switchedAt = this.t
    if (this.bufs) {
      this.bufs.prev.data.set(this.bufs.backdrop.data)
      this.bufs.at = -1e9
    }
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

  /**
   * A press: the theme's burst at a point on screen (CSS px), on the CTA whose
   * box is `cta` (CSS px) — the burst plays on it and in its margins only.
   */
  burst(cssX: number, cssY: number, cta?: { left: number; top: number; right: number; bottom: number }): void {
    if (this.still) return
    const world = WORLDS[this.theme]
    const zone: Zone | undefined = cta && {
      l: Math.round(cta.left / FX_PX),
      t: Math.round(cta.top / FX_PX),
      r: Math.round(cta.right / FX_PX),
      b: Math.round(cta.bottom / FX_PX),
    }
    this.fit(this.ensureOverlay())
    const add = world.burst(this.rand, cssX / FX_PX, cssY / FX_PX, zone)
    this.over.push(...add)
    if (this.over.length > BURST_CAP) this.over.splice(0, this.over.length - BURST_CAP)
    this.overKeptAt = -1e9
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
    this.overKeptAt = -1e9
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
      // And every panel: the world moves between the panels, never inside one
      // (many are translucent washes).
      for (const el of root.querySelectorAll(PANELS)) push(el.getBoundingClientRect())
    }
    this.keep = out
    // The scene: the floor is the top of the home's dock (the foot of the
    // screen elsewhere); the hot points are the focused road's.
    const dock = root?.querySelector('.mn-dock')
    const floor = dock ? dock.getBoundingClientRect().top / FX_PX : 1e9
    const hot: [number, number][] = []
    const svg = root?.querySelector<SVGElement>('.tm-leaders[data-road]')
    if (svg) {
      const box = svg.getBoundingClientRect()
      for (const pt of (svg.dataset.road ?? '').split(' ')) {
        const [x, y] = pt.split(',').map(Number)
        if (Number.isFinite(x) && Number.isFinite(y)) hot.push([(box.left + x) / FX_PX, (box.top + y) / FX_PX])
      }
    }
    this.scene = { floor, hot, map: canvas.classList.contains('is-map'), light: fxLevel() === 'light' }
  }

  /** The words inside the live bursts' zones (CSS px boxes → effect pixels), for the overlay. */
  private measureOverKeep(now: number): void {
    this.overKeptAt = now
    const zones: Zone[] = []
    for (const q of this.over) if (q.zone && !zones.includes(q.zone)) zones.push(q.zone)
    const out: [number, number, number, number][] = []
    // A switch-in plays over the whole screen: then every word on it is kept.
    const all = !!this.sweep || this.over.some((q) => !q.zone)
    if (zones.length || all) {
      const clips = zones.map(burstClip)
      const vh = this.view?.h ?? window.innerHeight
      const hit = (r: DOMRect) => {
        if (all) return r.bottom > 0 && r.top < vh
        const x0 = r.left / FX_PX
        const y0 = r.top / FX_PX
        const x1 = r.right / FX_PX
        const y1 = r.bottom / FX_PX
        return clips.some((c) => x1 >= c.l && x0 <= c.r && y1 >= c.t && y0 <= c.b)
      }
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      const range = document.createRange()
      for (let n = walk.nextNode(); n && out.length < 400; n = walk.nextNode()) {
        if (!n.textContent?.trim()) continue
        range.selectNodeContents(n)
        for (const r of range.getClientRects()) {
          if (r.width <= 0 || r.height <= 0 || !hit(r)) continue
          const x = Math.floor(r.left / FX_PX) - 1
          const y = Math.floor(r.top / FX_PX) - 1
          out.push([x, y, Math.ceil(r.right / FX_PX) + 1 - x, Math.ceil(r.bottom / FX_PX) + 1 - y])
        }
      }
      // A switch-in plays over the map and the margins, never inside a panel
      // (the motion audit, Oct 2026: its sweep crossed the card and the dock
      // just as the card's new words landed). The panels are measured once.
      if (all)
        for (const el of document.querySelectorAll(PANELS)) {
          const r = el.getBoundingClientRect()
          if (r.width <= 0 || r.height <= 0 || r.bottom < 0 || r.top > vh) continue
          const x = Math.floor(r.left / FX_PX)
          const y = Math.floor(r.top / FX_PX)
          out.push([x, y, Math.ceil(r.right / FX_PX) - x, Math.ceil(r.bottom / FX_PX) - y])
        }
    }
    this.overKeep = out
  }

  private buffers(a: Layer): Buffers {
    if (this.bufs && this.bufs.w === a.w && this.bufs.h === a.h) return this.bufs
    const frame = new PixelPen(a.w, a.h)
    const image = new ImageData(frame.data as Uint8ClampedArray<ArrayBuffer>, a.w, a.h)
    this.bufs = { w: a.w, h: a.h, frame, backdrop: new PixelPen(a.w, a.h), prev: new PixelPen(a.w, a.h), image, at: -1e9, theme: null }
    return this.bufs
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

  /** The viewport, read on a resize (reading it every frame costs a style flush on a phone). */
  private view: { w: number; h: number } | null = null

  private fit(l: Layer): void {
    if (!this.view) this.view = { w: window.innerWidth, h: window.innerHeight }
    const w = Math.ceil(this.view.w / FX_PX)
    const h = Math.ceil(this.view.h / FX_PX)
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
    // The frame's length feeds the automatic step down to the light set.
    if (this.ambient) noteFxFrame(now - this.last)
    const light = fxLevel() === 'light'
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000)) * this.timeScale
    this.last = now
    this.t += dt
    this.frames++
    const dim = this.dim
    const world = WORLDS[this.theme]

    const a = this.ambient
    if (a) {
      this.fit(a)
      if (now - this.keptAt > 300) this.measureKeepOut(a.canvas, now)
      // The light set: half the particles (the oldest go first), no glows.
      const cap = Math.round(ambientCap(world, a.w, a.h, a.w * FX_PX) * (light ? 0.5 : 1))
      if (this.parts.length > cap) this.parts.splice(0, this.parts.length - cap)
      if (this.scene.light !== light) {
        this.scene = { ...this.scene, light }
        if (this.bufs) this.bufs.at = -1e9
      }
      const sc = this.scene
      if (!this.seeded) {
        // The first fill is staggered through its lives, so the world does
        // not fade in, and later die out, all at once (a whole screen of
        // embers guttering together read as a pulse).
        while (this.parts.length < cap) {
          const q = world.spawn(this.rand, a.w, a.h, true, sc)
          q.age = Math.max(q.age, this.rand() * q.life * 0.7)
          this.parts.push(q)
        }
        this.seeded = true
      }
      // Keep the screen full: a couple of new particles a frame, never past the cap.
      for (let i = 0; i < 2 && this.parts.length < cap; i++) this.parts.push(world.spawn(this.rand, a.w, a.h, false, sc))
      this.parts = this.parts.filter((q) => step(q, dt, a.w, a.h))
      // The crossfade after a switch: 0 → 1 over `SWITCH_S`.
      const mix = Math.min(1, Math.max(0, (this.t - this.switchedAt) / SWITCH_S))
      this.fading = mix < 1 ? this.fading.filter((q) => step(q, dt, a.w, a.h)) : []
      // Drawn at a pixel-art cadence, in software (`PixelPen`), and put on
      // the canvas in one go.
      // The light set draws at half the cadence as well.
      if (now - this.ambientAt >= AMBIENT_MS * (light ? 2 : 1)) {
        this.ambientAt = now
        const b = this.buffers(a)
        // The backdrop (glows, washes, the flame line) is redrawn a few
        // times a second; at full strength under high contrast's dim too
        // (it is already faint). Particles are dimmed.
        if (now - b.at >= BACKDROP_MS * (light ? 2 : 1) || b.theme !== this.theme) {
          b.at = now
          b.theme = this.theme
          b.backdrop.clear()
          world.backdrop?.(b.backdrop, a.w, a.h, this.t, sc)
        }
        if (mix < 1) b.frame.crossfade(b.prev.data, b.backdrop.data, mix)
        else b.frame.data.set(b.backdrop.data)
        // Each world's particles at its own strength (`World.peak`), the old
        // world's fading out as the new one's fade in.
        const oldDim = dim * WORLDS[this.fadingTheme].peak * (1 - mix)
        for (const q of this.fading) drawParticle(b.frame, q, oldDim)
        const newDim = dim * world.peak * mix
        for (const q of this.parts) drawParticle(b.frame, q, newDim)
        // Nothing under text: clear the layer under every line of the page's text.
        for (const [x, y, w, h] of this.keep) b.frame.clearRect(x, y, w, h)
        a.pen.putImageData(b.image, 0, 0)
      }
    }

    const o = this.overlay
    if (o && (this.over.length || this.sweep)) {
      this.fit(o)
      this.over = this.over.filter((q) => step(q, dt, o.w, o.h))
      o.pen.clearRect(0, 0, o.w, o.h)
      const pen = o.pen as unknown as Pen
      // The press bursts first, each clipped to its CTA's zone, then cleared
      // under every word there (the label included)…
      if (now - this.overKeptAt > 150) this.measureOverKeep(now)
      let zone: Zone | undefined
      let clipped = false
      for (const q of this.over) {
        if (!q.zone) continue
        if (q.zone !== zone) {
          if (clipped) o.pen.restore()
          zone = q.zone
          const c = burstClip(zone)
          o.pen.save()
          o.pen.beginPath()
          o.pen.rect(c.l, c.t, c.r - c.l, c.b - c.t)
          o.pen.clip()
          clipped = true
        }
        drawParticle(pen, q, 1)
      }
      if (clipped) o.pen.restore()
      o.pen.globalAlpha = 1
      // …then the switch-in: a sweep and its particles over the whole screen…
      if (this.sweep) {
        this.sweep.age += dt
        const sw = WORLDS[this.sweep.theme]
        if (this.sweep.age >= this.sweep.life || !sw.drawSweep) this.sweep = null
        else sw.drawSweep(pen, o.w, o.h, this.sweep)
      }
      for (const q of this.over) if (!q.zone) drawParticle(pen, q, 1)
      o.pen.globalAlpha = 1
      // …and nothing over a word: cleared under each one the effects reach.
      for (const [x, y, w, h] of this.overKeep) o.pen.clearRect(x, y, w, h)
    } else if (o) {
      o.pen.clearRect(0, 0, o.w, o.h)
    }

    if (a || this.over.length || this.sweep) this.raf = requestAnimationFrame(this.tick)
  }

  /** The effects level changed (`fxQuality`): start or stop the loop to match. */
  levelChanged(): void {
    if (this.still) this.clear()
    else this.wake()
  }

  /** Wire the presses and the tab's visibility, once. */
  install(): void {
    if (typeof document === 'undefined' || (window as unknown as { __fxInstalled?: boolean }).__fxInstalled) return
    ;(window as unknown as { __fxInstalled?: boolean }).__fxInstalled = true
    document.addEventListener('visibilitychange', () => this.wake())
    window.addEventListener('resize', () => (this.view = null), { passive: true })
    const isCta = (el: EventTarget | null): HTMLElement | null => {
      // A quiet pinned control (a setting's toggle) is not the primary: no burst.
      const b = (el as HTMLElement | null)?.closest?.('.pg-cta:not(.quiet)') as HTMLButtonElement | null
      return b && !b.disabled ? b : null
    }
    document.addEventListener(
      'pointerdown',
      (e) => {
        const b = isCta(e.target)
        if (b) this.burst(e.clientX, e.clientY, b.getBoundingClientRect())
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
        this.burst(r.left + r.width / 2, r.top + r.height / 2, r)
      },
      { capture: true, passive: true },
    )
  }
}

export const fx = new FxEngine()

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __worldFx: FxEngine }).__worldFx = fx
  // The effects level, for the review's measurements (`fxQuality`).
  ;(window as unknown as { __fxQuality: typeof fxQuality }).__fxQuality = fxQuality
}
