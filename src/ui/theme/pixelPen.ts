import type { Pen } from './fxWorlds'

/**
 * A software pen for the company worlds' ambient layer (Oct 2026): the
 * `Pen` the worlds draw with, writing straight into an RGBA pixel buffer the
 * engine hands to the canvas once a frame (`putImageData`). The layer is small
 * (a third of the screen each way) but a world makes thousands of one-pixel
 * fills a frame — glows are dithered, flames are columns — and as canvas calls
 * those cost a GPU round trip each on a phone; as array writes they are cheap.
 *
 * Source-over blending on straight (non-premultiplied) alpha, as a canvas
 * does. Colours are `#rrggbb` (the worlds' palettes), parsed once and cached.
 * Pure: no DOM.
 */
export class PixelPen implements Pen {
  fillStyle: Pen['fillStyle'] = '#000000'
  globalAlpha = 1
  readonly data: Uint8ClampedArray
  private rgb = new Map<string, number>()

  constructor(
    readonly w: number,
    readonly h: number,
    data?: Uint8ClampedArray,
  ) {
    this.data = data ?? new Uint8ClampedArray(w * h * 4)
  }

  private lastStyle: unknown = null
  private lastRgb = 0

  private color(): number {
    const c = this.fillStyle
    if (c === this.lastStyle) return this.lastRgb
    const key = typeof c === 'string' ? c : '#000000'
    let v = this.rgb.get(key)
    if (v === undefined) {
      const m = /^#([0-9a-f]{6})$/i.exec(key)
      v = m ? parseInt(m[1], 16) : 0
      this.rgb.set(key, v)
    }
    this.lastStyle = c
    this.lastRgb = v
    return v
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    const a = this.globalAlpha
    if (!(a > 0) || w <= 0 || h <= 0) return
    let x0 = x | 0
    let y0 = y | 0
    let x1 = (x + w) | 0
    let y1 = (y + h) | 0
    if (x0 < 0) x0 = 0
    if (y0 < 0) y0 = 0
    if (x1 > this.w) x1 = this.w
    if (y1 > this.h) y1 = this.h
    if (x1 <= x0 || y1 <= y0) return
    const c = this.color()
    const r = c >> 16
    const g = (c >> 8) & 255
    const b = c & 255
    const d = this.data
    const A = a >= 1 ? 255 : Math.round(a * 255)
    const sa = A / 255
    const W = this.w
    for (let yy = y0; yy < y1; yy++) {
      let i = (yy * W + x0) << 2
      for (let xx = x0; xx < x1; xx++, i += 4) {
        const da = d[i + 3]
        if (A === 255 || da === 0) {
          d[i] = r
          d[i + 1] = g
          d[i + 2] = b
          d[i + 3] = A
          continue
        }
        // Source over: out = src·a + dst·(1 − a), in straight alpha.
        const dA = (da / 255) * (1 - sa)
        const oa = sa + dA
        const k = 1 / oa
        d[i] = (r * sa + d[i] * dA) * k
        d[i + 1] = (g * sa + d[i + 1] * dA) * k
        d[i + 2] = (b * sa + d[i + 2] * dA) * k
        d[i + 3] = oa * 255
      }
    }
  }

  /** Clear a box to transparent. */
  clearRect(x: number, y: number, w: number, h: number): void {
    const x0 = Math.max(0, x | 0)
    const y0 = Math.max(0, y | 0)
    const x1 = Math.min(this.w, (x + w) | 0)
    const y1 = Math.min(this.h, (y + h) | 0)
    if (x1 <= x0 || y1 <= y0) return
    for (let yy = y0; yy < y1; yy++) this.data.fill(0, (yy * this.w + x0) * 4, (yy * this.w + x1) * 4)
  }

  /** Clear everything. */
  clear(): void {
    this.data.fill(0)
  }
}
