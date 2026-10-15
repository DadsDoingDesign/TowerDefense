import { describe, expect, it } from 'vitest'
import { COMPANY_IDS } from '../src/game/data/companies'
import { THEME_IDS } from '../src/game/run/militiaTheme'
import { ambientCap, drawParticle, step, stepAlpha, WORLDS, type Pen } from '../src/ui/theme/fxWorlds'
import { FRAME_SIZE, FRAME_T, RUNES_5, STRIP_H, STRIP_W, worldArt } from '../src/ui/theme/themeArt'

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
