import { describe, expect, it } from 'vitest'
import { COARSE as TILE } from '../src/game/data/terrain'
import {
  HOLD_MS,
  PAN_SLOP,
  TOUCH_FLOOR,
  clampView,
  easeOutCubic,
  lerpView,
  nextPressMode,
  panView,
  placeZoomScale,
  zoomAround,
  type ViewBox,
} from '../src/ui/fieldZoom'

/*
 * Zoom to place (Q3): when the field zooms, the scale it picks, and that the
 * scale is always a whole number of device pixels per field (= art) pixel.
 * Fitted scales are the portrait twin's measured Stage scales (maps.ts
 * § Portrait battlefields): 320×568 0.344 · 375×667 0.435 · 390×844 0.597.
 */

describe('placeZoomScale — when it triggers', () => {
  it('does nothing where a tile already clears the 44 px floor (390 phone, desk)', () => {
    expect(TILE * 0.597).toBeGreaterThanOrEqual(TOUCH_FLOOR)
    expect(placeZoomScale(0.597, 2, TILE)).toBeNull()
    expect(placeZoomScale(0.597, 3, TILE)).toBeNull()
    expect(placeZoomScale(1, 1, TILE)).toBeNull()
    expect(placeZoomScale(1, 2, TILE)).toBeNull()
    // Exactly on the floor counts as clearing it.
    expect(placeZoomScale(TOUCH_FLOOR / TILE, 2, TILE)).toBeNull()
  })

  it('zooms on the small phones, where a tile is 27–35 CSS px', () => {
    expect(placeZoomScale(0.344, 2, TILE)).not.toBeNull()
    expect(placeZoomScale(0.435, 2, TILE)).not.toBeNull()
    expect(placeZoomScale(0.435, 3, TILE)).not.toBeNull()
  })

  it('refuses nonsense input rather than zooming to Infinity', () => {
    expect(placeZoomScale(0, 2, TILE)).toBeNull()
    expect(placeZoomScale(NaN, 2, TILE)).toBeNull()
    expect(placeZoomScale(0.4, 2, 0)).toBeNull()
    // A missing dpr is treated as 1.
    expect(placeZoomScale(0.4, 0, TILE)).toBe(1)
    expect(placeZoomScale(0.4, NaN, TILE)).toBe(1)
  })
})

describe('placeZoomScale — the scale chosen', () => {
  it('picks 2 device px per field px at dpr 2 (a 1 px step would be a 40 px tile)', () => {
    expect(placeZoomScale(0.344, 2, TILE)).toBe(1)
    expect(placeZoomScale(0.435, 2, TILE)).toBe(1)
    expect(TILE * (1 / 2)).toBeLessThan(TOUCH_FLOOR)
  })

  it('picks 2 device px per field px at dpr 3 (a 53 px tile)', () => {
    expect(placeZoomScale(0.435, 3, TILE)).toBeCloseTo(2 / 3, 12)
    expect(TILE * (2 / 3)).toBeGreaterThanOrEqual(TOUCH_FLOOR)
  })

  it('is always whole device pixels, clears the floor, is the SMALLEST such step, and zooms in', () => {
    for (const dpr of [1, 1.5, 2, 2.625, 2.75, 3, 3.5, 4]) {
      for (let base = 0.1; base < TOUCH_FLOOR / TILE; base += 0.013) {
        const zs = placeZoomScale(base, dpr, TILE)!
        expect(zs).not.toBeNull()
        const k = zs * dpr
        expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-9)
        expect(Math.round(k)).toBeGreaterThanOrEqual(1)
        expect(TILE * zs).toBeGreaterThanOrEqual(TOUCH_FLOOR - 1e-9)
        expect(zs).toBeGreaterThan(base)
        // One whole step smaller either misses the floor or is not a zoom in.
        const smaller = (Math.round(k) - 1) / dpr
        expect(TILE * smaller < TOUCH_FLOOR || smaller <= base).toBe(true)
      }
    }
  })

  it('honours a custom floor', () => {
    expect(placeZoomScale(0.435, 2, TILE, 30)).toBeNull()
    expect(placeZoomScale(0.3, 2, TILE, 30)).toBe(0.5)
  })
})

describe('zoom geometry', () => {
  // The 375×667 portrait case: a 620×960 field fit at 0.435 into a 375-wide box.
  const W = 620
  const H = 960
  const box: ViewBox = { left: 0, top: 0, width: 375, height: 418 }
  const fit = clampView({ scale: 0.435, left: 0, top: 0 }, W, H, box)

  it('keeps the touched field point under the finger', () => {
    const ax = 200
    const ay = 210
    const before = { x: (ax - fit.left) / fit.scale, y: (ay - fit.top) / fit.scale }
    const z = zoomAround(fit, 1, ax, ay, W, H, box, 2)
    expect(z.scale).toBe(1)
    expect(Math.abs(ax - (z.left + before.x * z.scale))).toBeLessThanOrEqual(0.5)
    expect(Math.abs(ay - (z.top + before.y * z.scale))).toBeLessThanOrEqual(0.5)
  })

  it('never lets a zoomed field come away from the box edge, and sits on the device grid', () => {
    for (const [ax, ay] of [
      [0, 0],
      [375, 418],
      [10, 400],
      [370, 5],
    ]) {
      const z = zoomAround(fit, 1, ax, ay, W, H, box, 2)
      expect(z.left).toBeLessThanOrEqual(box.left)
      expect(z.top).toBeLessThanOrEqual(box.top)
      expect(z.left + W * z.scale).toBeGreaterThanOrEqual(box.left + box.width)
      expect(z.top + H * z.scale).toBeGreaterThanOrEqual(box.top + box.height)
      expect(Number.isInteger(z.left * 2)).toBe(true)
      expect(Number.isInteger(z.top * 2)).toBe(true)
    }
  })

  it('pans within the field and stops at its edges', () => {
    const z = zoomAround(fit, 1, 187, 209, W, H, box, 2)
    const far = panView(z, 10_000, 10_000, W, H, box, 2)
    expect(far.left).toBe(0)
    expect(far.top).toBe(0)
    const other = panView(z, -10_000, -10_000, W, H, box, 2)
    expect(other.left).toBe(box.width - W)
    expect(other.top).toBe(box.height - H)
    const nudge = panView(z, -3, 4, W, H, box, 2)
    expect(nudge.left).toBe(z.left - 3)
    expect(nudge.top).toBe(z.top + 4)
  })

  it('centres an axis where the field is smaller than the box', () => {
    const v = clampView({ scale: 0.5, left: -100, top: -100 }, W, H, { left: 0, top: 0, width: 800, height: 400 })
    expect(v.left).toBe((800 - W * 0.5) / 2)
  })

  it('eases along a line that keeps the anchor still, ending exactly on the target', () => {
    const z = zoomAround(fit, 1, 187, 209, W, H, box, 2)
    const lx = (187 - fit.left) / fit.scale
    for (const t of [0.25, 0.5, 0.75]) {
      const v = lerpView(fit, z, easeOutCubic(t))
      // Anchor point stays put (to the rounding of the snapped target).
      expect(Math.abs(v.left + lx * v.scale - 187)).toBeLessThanOrEqual(0.5)
    }
    expect(lerpView(fit, z, easeOutCubic(1))).toEqual(z)
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(2)).toBe(1)
  })
})

describe('nextPressMode — tap, pan, or hold-to-preview on a zoomed field', () => {
  it('a finger that stays inside the slop is still a tap (lifting chooses)', () => {
    expect(nextPressMode('pending', PAN_SLOP, 5000)).toBe('pending')
  })
  it('a quick drag is a pan', () => {
    expect(nextPressMode('pending', PAN_SLOP + 1, HOLD_MS - 1)).toBe('pan')
  })
  it('a rest then a slide is the hold-to-preview slide (lifting chooses)', () => {
    expect(nextPressMode('pending', PAN_SLOP + 1, HOLD_MS)).toBe('hold')
  })
  it('is sticky', () => {
    expect(nextPressMode('pan', 0, 10_000)).toBe('pan')
    expect(nextPressMode('hold', 100, 0)).toBe('hold')
  })
})
