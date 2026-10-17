import { describe, expect, it } from 'vitest'
import { COMPANY_IDS } from '../src/game/data/companies'
import { THEME_IDS } from '../src/game/run/militiaTheme'
import { ambientCap, burstClip, drawParticle, ROAD_BESIDE, ROAD_CLEAR, roadDistance, step, stepAlpha, WORLDS, type Pen, type Zone } from '../src/ui/theme/fxWorlds'
import { PixelPen } from '../src/ui/theme/pixelPen'
import { CREST_H, CREST_W, FRAME_SIZE, FRAME_T, RUNES_5, STRIP_H, STRIP_W, worldArt } from '../src/ui/theme/themeArt'

/*
 * The company worlds (Oct 2026): each theme's pixel art and motion. The art
 * is pixel rows the browser rasterises once (`themeArtDom`); the motion is
 * particles drawn in whole pixels on a low-resolution canvas (`fxEngine`).
 */

/** A seeded random, so a world can be driven the same way every run. */
function seeded(seed = 7): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** A pen that records what is drawn. */
function recorder() {
  const rects: { x: number; y: number; w: number; h: number; a: number; c: string }[] = []
  const pen: Pen = {
    fillStyle: '#000',
    globalAlpha: 1,
    fillRect(x, y, w, h) {
      rects.push({ x, y, w, h, a: this.globalAlpha, c: String(this.fillStyle) })
    },
  }
  return { pen, rects }
}

describe('each company world’s pixel art', () => {
  for (const c of COMPANY_IDS) {
    const a = worldArt(c)
    it(`${c}: a 9-slice frame flipbook, square, with its edge ${FRAME_T} px thick and its middle clear`, () => {
      expect(a.frames.length).toBeGreaterThanOrEqual(2)
      for (const f of a.frames) {
        expect(f.length).toBe(FRAME_SIZE)
        for (const row of f) expect(row.length).toBe(FRAME_SIZE)
        // The middle is clear: a frame never paints over a panel's content.
        for (let y = FRAME_T; y < FRAME_SIZE - FRAME_T; y++) expect(f[y].slice(FRAME_T, FRAME_SIZE - FRAME_T)).toMatch(/^\.+$/)
      }
      // A flipbook moves: its frames are not all the same.
      expect(new Set(a.frames.map((f) => f.join('|'))).size).toBeGreaterThan(1)
    })
    it(`${c}: a CTA strip of ${STRIP_W} × ${STRIP_H} frames that animate`, () => {
      expect(a.strip.length).toBeGreaterThanOrEqual(3)
      for (const f of a.strip) {
        expect(f.length).toBe(STRIP_H)
        for (const row of f) expect(row.length).toBe(STRIP_W)
      }
      expect(new Set(a.strip.map((f) => f.join('|'))).size).toBeGreaterThan(1)
    })
    it(`${c}: every pixel is a palette colour`, () => {
      for (const rows of [...a.frames, ...a.strip]) for (const row of rows) for (const ch of row) if (ch !== '.') expect(a.palette[ch], `${c} '${ch}'`).toMatch(/^#[0-9a-f]{6}$/i)
    })
  }
  it('the frames are 4 px thick (8 CSS px at the sheet’s double), each with its own edge and corner', () => {
    expect(FRAME_T).toBe(4)
    // Greyscale-distinct: no two worlds share an edge's pattern of light and dark.
    const lum = (hex: string) => {
      const v = parseInt(hex.slice(1), 16)
      return Math.round((0.3 * (v >> 16) + 0.59 * ((v >> 8) & 255) + 0.11 * (v & 255)) / 32)
    }
    const shapes = COMPANY_IDS.map((c) => {
      const a = worldArt(c)
      const f = a.frames[0]
      const edge = f.slice(0, FRAME_T).map((r) => r.slice(FRAME_T, FRAME_SIZE - FRAME_T))
      const corner = f.slice(0, FRAME_T).map((r) => r.slice(0, FRAME_T))
      const grey = (rows: readonly string[]) => rows.map((r) => [...r].map((ch) => (ch === '.' ? '.' : lum(a.palette[ch]))).join('')).join('|')
      return { edge: grey(edge), corner: grey(corner) }
    })
    expect(new Set(shapes.map((x) => x.edge)).size).toBe(COMPANY_IDS.length)
    expect(new Set(shapes.map((x) => x.corner)).size).toBe(COMPANY_IDS.length)
  })
  it('Peppercorn’s card wears a crest of flame tongues that flicker', () => {
    const crest = worldArt('spice').crest!
    expect(crest.length).toBeGreaterThanOrEqual(3)
    for (const f of crest) {
      expect(f.length).toBe(CREST_H)
      for (const row of f) expect(row.length).toBe(CREST_W)
      // Rooted on the edge: its foot row is lit all along.
      expect(f[CREST_H - 1]).not.toMatch(/\./)
    }
    expect(new Set(crest.map((f) => f.join('|'))).size).toBeGreaterThan(1)
  })
  it('the runes are 5 × 5', () => {
    for (const r of RUNES_5) {
      expect(r.length).toBe(5)
      for (const row of r) expect(row.length).toBe(5)
    }
  })
})

describe('each world’s motion', () => {
  for (const id of THEME_IDS) {
    const world = WORLDS[id]
    it(`${id}: ambient particles spawn on screen, move, and end`, () => {
      const rand = seeded()
      const w = 130
      const h = 280
      const parts = Array.from({ length: 40 }, () => world.spawn(rand, w, h, true))
      for (const q of parts) {
        expect(q.x).toBeGreaterThanOrEqual(-12)
        expect(q.x).toBeLessThanOrEqual(w + 12)
        expect(q.life).toBeGreaterThan(0)
      }
      let alive = parts
      for (let t = 0; t < 40 * 60 && alive.length; t++) alive = alive.filter((q) => step(q, 1 / 60, w, h))
      expect(alive.length).toBe(0) // nothing lives for ever
    })
    it(`${id}: a press bursts, and only pixels are drawn — whole, in eighth-step alpha`, () => {
      const rand = seeded(3)
      const burst = world.burst(rand, 60, 200)
      expect(burst.length).toBeGreaterThan(5)
      const { pen, rects } = recorder()
      for (const q of burst) {
        step(q, 0.2, 130, 280)
        drawParticle(pen, q, 1)
      }
      world.backdrop?.(pen, 130, 280, 1.3)
      expect(rects.length).toBeGreaterThan(0)
      for (const r of rects) {
        expect(Number.isInteger(r.x) && Number.isInteger(r.y), 'whole pixels').toBe(true)
        expect(r.a * 8).toBe(Math.round(r.a * 8))
      }
    })
  }
  it('a press burst is zoned to its CTA: every particle carries the zone, and the zone never reaches the text above', () => {
    const zone: Zone = { l: 10, t: 250, r: 120, b: 268 }
    for (const id of THEME_IDS) {
      const burst = WORLDS[id].burst(seeded(5), 40, 259, zone)
      expect(burst.length, id).toBeGreaterThan(5)
      for (const q of burst) expect(q.zone, id).toBe(zone)
    }
    const clip = burstClip(zone)
    // A little to the sides and below; barely above (the panel's words sit there).
    expect(zone.t - clip.t).toBeLessThanOrEqual(2)
    expect(clip.b).toBeGreaterThan(zone.b)
  })
  it('the fire and the forge burn along the floor the engine measures (the dock’s top)', () => {
    const scene = { floor: 200, hot: [[60, 120] as const] }
    for (const id of ['spice', 'metals'] as const) {
      const { pen, rects } = recorder()
      WORLDS[id].backdrop!(pen, 130, 282, 1, scene)
      const lit = rects.filter((r) => r.a > 0)
      // Most of the light sits within a band round the floor, not at the screen's foot.
      const near = lit.filter((r) => r.y > 200 - 40 && r.y < 200 + 6).length
      expect(near / lit.length, id).toBeGreaterThan(0.6)
    }
    // The fire crowds embers BESIDE the focused road, never on its line: a
    // square ember on the road read like one of its stops.
    const road = { floor: 200, hot: [[10, 170], [40, 140], [60, 120], [90, 110], [120, 80]] as const }
    for (const r of [road, scene]) {
      const rand = seeded(9)
      const embers = Array.from({ length: 400 }, () => WORLDS.spice.spawn(rand, 130, 282, true, r)).filter((q) => q.kind === 'ember')
      const dist = embers.map((q) => roadDistance(r.hot, q.x, q.y))
      expect(dist.filter((d) => d <= ROAD_BESIDE).length / embers.length).toBeGreaterThan(0.2)
      expect(Math.min(...dist)).toBeGreaterThanOrEqual(ROAD_CLEAR)
    }
  })
  it('every company world switches in with a sweep across the screen', () => {
    for (const c of COMPANY_IDS) {
      const w = WORLDS[c]
      expect(w.drawSweep, c).toBeTypeOf('function')
      expect(w.sweepLife ?? 0, c).toBeGreaterThanOrEqual(0.5)
      const { pen, rects } = recorder()
      w.drawSweep!(pen, 130, 280, { age: (w.sweepLife ?? 1) / 2, life: w.sweepLife ?? 1 })
      expect(rects.length, c).toBeGreaterThan(0)
    }
  })
  it('the ambient layer is capped: at most 60 particles on a phone, 110 on a desk', () => {
    for (const id of THEME_IDS) {
      expect(ambientCap(WORLDS[id], 130, 282, 390)).toBeLessThanOrEqual(60)
      expect(ambientCap(WORLDS[id], 427, 267, 1280)).toBeLessThanOrEqual(110)
    }
  })
  it('alpha steps in eighths', () => {
    expect([0.05, 0.2, 0.4, 0.62, 0.97, 1.4].map(stepAlpha)).toEqual([0, 0.25, 0.375, 0.625, 1, 1])
  })
})

describe('the pixel pen (the ambient layer’s software canvas)', () => {
  it('fills whole pixels, clipped to the buffer', () => {
    const pen = new PixelPen(4, 3)
    pen.fillStyle = '#ff8000'
    pen.fillRect(-1, 1, 3, 9)
    const px = (x: number, y: number) => Array.from(pen.data.slice((y * 4 + x) * 4, (y * 4 + x) * 4 + 4))
    expect(px(0, 1)).toEqual([255, 128, 0, 255])
    expect(px(1, 2)).toEqual([255, 128, 0, 255])
    expect(px(2, 1)).toEqual([0, 0, 0, 0])
    expect(px(0, 0)).toEqual([0, 0, 0, 0])
  })
  it('blends source-over in straight alpha, as a canvas does', () => {
    const pen = new PixelPen(1, 1)
    pen.fillStyle = '#0000ff'
    pen.globalAlpha = 0.5
    pen.fillRect(0, 0, 1, 1)
    expect(pen.data[3]).toBe(128)
    pen.fillStyle = '#ff0000'
    pen.fillRect(0, 0, 1, 1)
    // Alpha 0.5 over 0.5: 0.75 covered; red takes two thirds of the colour.
    expect(pen.data[3]).toBeGreaterThanOrEqual(190)
    expect(pen.data[3]).toBeLessThanOrEqual(192)
    expect(pen.data[0]).toBeGreaterThan(165)
    expect(pen.data[2]).toBeGreaterThan(80)
    pen.clearRect(0, 0, 1, 1)
    expect(Array.from(pen.data)).toEqual([0, 0, 0, 0])
  })
})
