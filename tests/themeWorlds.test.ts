import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COMPANY_IDS } from '../src/game/data/companies'
import { THEME_IDS } from '../src/game/run/militiaTheme'
import { AMBIENT_CAP_DESK, AMBIENT_CAP_PHONE, ambientCap, BREATH_S, burstClip, drawParticle, ROAD_BESIDE, ROAD_CLEAR, roadDistance, step, stepAlpha, SWITCH_S, WORLDS, type Pen, type Zone } from '../src/ui/theme/fxWorlds'
import { PixelPen } from '../src/ui/theme/pixelPen'
import { CREST_H, CREST_W, FRAME_SIZE, FRAME_SPAN, FRAME_T, RUNES_5, STRIP_H, STRIP_W, worldArt } from '../src/ui/theme/themeArt'

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
    it(`${c}: one still 9-slice frame, square, with its edge ${FRAME_T} px thick and its middle clear`, () => {
      const f = a.frame
      expect(f.length).toBe(FRAME_SIZE)
      for (const row of f) expect(row.length).toBe(FRAME_SIZE)
      // The middle is clear: a frame never paints over a panel's content.
      for (let y = FRAME_T; y < FRAME_SIZE - FRAME_T; y++) expect(f[y].slice(FRAME_T, FRAME_SIZE - FRAME_T)).toMatch(/^\.+$/)
    })
    it(`${c}: a still CTA strip of ${STRIP_W} × ${STRIP_H}`, () => {
      expect(a.strip.length).toBe(STRIP_H)
      for (const row of a.strip) expect(row.length).toBe(STRIP_W)
      expect(a.strip.join('')).toMatch(/[^.]/)
    })
    it(`${c}: every pixel is a palette colour`, () => {
      for (const rows of [a.frame, a.strip, ...(a.crest ? [a.crest] : [])]) for (const row of rows) for (const ch of row) if (ch !== '.') expect(a.palette[ch], `${c} '${ch}'`).toMatch(/^#[0-9a-f]{6}$/i)
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
      const f = a.frame
      const edge = f.slice(0, FRAME_T).map((r) => r.slice(FRAME_T, FRAME_SIZE - FRAME_T))
      const corner = f.slice(0, FRAME_T).map((r) => r.slice(0, FRAME_T))
      const grey = (rows: readonly string[]) => rows.map((r) => [...r].map((ch) => (ch === '.' ? '.' : lum(a.palette[ch]))).join('')).join('|')
      return { edge: grey(edge), corner: grey(corner) }
    })
    expect(new Set(shapes.map((x) => x.edge)).size).toBe(COMPANY_IDS.length)
    expect(new Set(shapes.map((x) => x.corner)).size).toBe(COMPANY_IDS.length)
  })
  it('Peppercorn’s card wears a still crest of flame tongues', () => {
    const f = worldArt('spice').crest!
    expect(f.length).toBe(CREST_H)
    for (const row of f) expect(row.length).toBe(CREST_W)
    // Rooted on the edge: its foot row is lit all along.
    expect(f[CREST_H - 1]).not.toMatch(/\./)
  })
  it('the runes are 5 × 5', () => {
    for (const r of RUNES_5) {
      expect(r.length).toBe(5)
      for (const row of r) expect(row.length).toBe(5)
    }
  })
})

describe('the frames: quiet, and one deep (the frames pass, Oct 2026)', () => {
  const lum = (hex: string) => {
    const v = parseInt(hex.slice(1), 16)
    return (0.2126 * (v >> 16) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255
  }
  for (const c of COMPANY_IDS) {
    const f = worldArt(c).frame
    const pal = worldArt(c).palette
    const edge = f.slice(0, FRAME_T).map((r) => r.slice(FRAME_T, FRAME_SIZE - FRAME_T))
    it(`${c}: one dominant line, at most two pixels deep, sparse detail inside it, nothing bright`, () => {
      const lit = (d: number) => [...edge[d]].filter((ch) => ch !== '.').length / FRAME_SPAN
      // The line runs (nearly) the whole edge. Its second pixel may be a band
      // of its own (Ironvein's two-tone iron, Easel House's bristle shade:
      // the second frames pass, Oct 2026), but the inner half stays sparse,
      // and inside the line at most half the pixels are set.
      expect(lit(0), c).toBeGreaterThanOrEqual(0.75)
      for (let d = 2; d < FRAME_T; d++) expect(lit(d), `${c} depth ${d}`).toBeLessThanOrEqual(0.5)
      const inner = edge.slice(1).join('').replace(/\./g, '').length / (FRAME_SPAN * (FRAME_T - 1))
      expect(inner, c).toBeLessThanOrEqual(1 / 2)
      // A dim palette: the line a shade or two off the panel, no accent pixel as bright as a label.
      for (const ch of edge[0]) if (ch !== '.') expect(lum(pal[ch]), `${c} line '${ch}'`).toBeLessThanOrEqual(0.42)
      for (const row of f) for (const ch of row) if (ch !== '.') expect(lum(pal[ch]), `${c} '${ch}'`).toBeLessThanOrEqual(0.6)
    })
    it(`${c}: a quiet corner, its outermost pixel clear`, () => {
      expect(f[0][0]).toBe('.')
      expect(f[0][FRAME_SIZE - 1]).toBe('.')
      expect(f[FRAME_SIZE - 1][0]).toBe('.')
      expect(f[FRAME_SIZE - 1][FRAME_SIZE - 1]).toBe('.')
    })
  }

  const css = readFileSync(join(__dirname, '..', 'src', 'styles', 'worlds.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].replace(/\s+/g, ' ').trim(), body: m[2] }))
  const frameRule = rules.find((r) => r.body.includes('border-image-source: var(--th-frame-0)'))!
  const framed = list(/:is\(([^)]*)\)/.exec(frameRule.sel)![1])

  it('a CTA wears no frame (its world is the strip on its lip)', () => {
    expect(framed).toContain('.mn-card')
    expect(framed).toContain('.pk-card')
    expect(framed).not.toContain('.pg-cta')
    expect(rules.some((r) => /\.pg-cta[^,]*$/.test(r.sel) && /border-image(-source)?:\s*var/.test(r.body))).toBe(false)
  })
  it('no world frame on a framed part inside a framed panel, and no strip or glow on a CTA there', () => {
    const deep = rules.find((r) => /^:root\[data-co-theme\] :is\([^)]*\) :is\([^)]*\)$/.test(r.sel) && /border-image:\s*none/.test(r.body))
    expect(deep, 'the one-deep rule').toBeDefined()
    const [, outer, inner] = /:is\(([^)]*)\) :is\(([^)]*)\)/.exec(deep!.sel)!
    // Every framed panel is an outer frame, and so is the battle's detail band (its trim).
    expect(new Set(list(outer))).toEqual(new Set([...framed, '.sh-detail']))
    // Every framed part loses its frame inside one, and so does a CTA's strip.
    expect(new Set(list(inner))).toEqual(new Set([...framed, '.pg-cta']))
    expect(deep!.body).toMatch(/--th-strip-on:\s*none/)
    expect(deep!.body).toMatch(/--th-glow:/)
    // The strip reads that switch.
    const strip = rules.find((r) => r.sel.endsWith('.pg-cta:not(:disabled)::before') && r.body.includes('var(--th-strip)'))!
    expect(strip.body).toMatch(/content:\s*var\(--th-strip-on/)
  })
  it('the page’s exits row wears none of the world', () => {
    expect(rules.some((r) => r.sel === ':root[data-co-theme] .pg-foot .pg-row' && /border-image:\s*none/.test(r.body))).toBe(true)
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
      expect(burst.length).toBeGreaterThanOrEqual(4)
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
  it('a press burst stays on its CTA’s face: every particle carries the zone, and the clip is the button itself', () => {
    const zone: Zone = { l: 10, t: 250, r: 120, b: 268 }
    for (const id of THEME_IDS) {
      const burst = WORLDS[id].burst(seeded(5), 40, 259, zone)
      expect(burst.length, id).toBeGreaterThanOrEqual(4)
      // Fewer pixels (the calm pass, Oct 2026: up to 56 particles a press before).
      expect(burst.length, id).toBeLessThanOrEqual(20)
      for (const q of burst) expect(q.zone, id).toBe(zone)
    }
    expect(burstClip(zone)).toEqual(zone)
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
  it('a switch-in is a short crossfade with a faint, still wash of the world — no particles, no show', () => {
    expect(SWITCH_S).toBeGreaterThanOrEqual(0.25)
    expect(SWITCH_S).toBeLessThanOrEqual(0.4)
    for (const id of THEME_IDS) expect(WORLDS[id].switchIn(seeded(), 130, 280), id).toEqual([])
    for (const c of COMPANY_IDS) {
      const w = WORLDS[c]
      expect(w.drawSweep, c).toBeTypeOf('function')
      expect(w.sweepLife, c).toBe(SWITCH_S)
      const at = (age: number) => {
        const { pen, rects } = recorder()
        w.drawSweep!(pen, 130, 280, { age, life: SWITCH_S })
        return rects
      }
      const early = at(SWITCH_S * 0.1)
      expect(early.length, c).toBeGreaterThan(0)
      for (const r of early) expect(r.a, c).toBeLessThanOrEqual(0.3)
      // It fades where it lies: the same pixels, fainter, never a band crossing the screen.
      const late = at(SWITCH_S * 0.6)
      const seen = new Set(early.map((r) => `${r.x},${r.y}`))
      for (const r of late) expect(seen.has(`${r.x},${r.y}`), c).toBe(true)
      expect(Math.max(0, ...late.map((r) => r.a)), c).toBeLessThanOrEqual(Math.max(...early.map((r) => r.a)))
    }
  })
  it('the ambient layer is capped: 24 on a phone, 40 on a desk — a third to a half of the old 60 and 110', () => {
    expect(AMBIENT_CAP_PHONE).toBe(24)
    expect(AMBIENT_CAP_DESK).toBe(40)
    for (const id of THEME_IDS) {
      expect(ambientCap(WORLDS[id], 130, 282, 390)).toBeLessThanOrEqual(AMBIENT_CAP_PHONE)
      expect(ambientCap(WORLDS[id], 427, 267, 1280)).toBeLessThanOrEqual(AMBIENT_CAP_DESK)
    }
    // The loudest worlds came down the most: the fire to a quarter (40 → 11), the forge to under a third (60 → 18).
    expect(ambientCap(WORLDS.spice, 130, 282, 390)).toBeLessThanOrEqual(12)
    expect(ambientCap(WORLDS.metals, 130, 282, 390)).toBeLessThanOrEqual(20)
  })
  it('no ambient pixel is brighter than the words: every particle at its world’s peak, over black under 0.65 of white', () => {
    const luma = (hex: string) => {
      const v = parseInt(hex.slice(1), 16)
      return (0.2126 * (v >> 16) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255
    }
    for (const id of THEME_IDS) {
      const world = WORLDS[id]
      expect(world.peak, id).toBeLessThanOrEqual(0.7)
      const rand = seeded(11)
      const scene = { floor: 230, hot: [[20, 150], [70, 120], [120, 90]] as const, map: true }
      const { pen, rects } = recorder()
      for (let i = 0; i < 300; i++) {
        const q = world.spawn(rand, 130, 282, true, scene)
        step(q, rand() * q.life * 0.9, 130, 282)
        drawParticle(pen, q, world.peak)
      }
      expect(rects.length, id).toBeGreaterThan(0)
      for (const r of rects) expect(r.a * luma(r.c), `${id} ${r.c} at ${r.a}`).toBeLessThanOrEqual(0.65)
      // The backdrop's light (the anvils' iron is a sprite, drawn whole).
      const bd = recorder()
      world.backdrop?.(bd.pen, 130, 282, 2.5, scene)
      for (const r of bd.rects) expect(r.a * luma(r.c), `${id} backdrop ${r.c}`).toBeLessThanOrEqual(0.7)
    }
  })
  it('backdrops breathe, never crawl: one frame of the backdrop’s cadence changes under 0.3% of the screen', () => {
    expect(BREATH_S).toBeGreaterThanOrEqual(6)
    const w = 130
    const h = 282
    const scene = { floor: 230, hot: [], map: true }
    for (const id of THEME_IDS) {
      const world = WORLDS[id]
      if (!world.backdrop) continue
      for (let t = 1; t < 9; t += 0.9) {
        const a = new PixelPen(w, h)
        const b = new PixelPen(w, h)
        world.backdrop(a, w, h, t, scene)
        world.backdrop(b, w, h, t + 1 / 12, scene)
        let changed = 0
        let lit = 0
        for (let i = 0; i < a.data.length; i += 4) {
          if (a.data[i + 3] || b.data[i + 3]) lit++
          if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) changed++
        }
        expect(changed / (w * h), `${id} at ${t}`).toBeLessThan(0.003)
        // …and a backdrop lights at most a sixteenth of the screen.
        expect(lit / (w * h), `${id} at ${t}`).toBeLessThan(1 / 16)
      }
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
  it('crossfades two backdrops: all of the old at 0, all of the new at 1, a blend between', () => {
    const prev = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0])
    const next = new Uint8ClampedArray([0, 0, 255, 255, 0, 255, 0, 128])
    const pen = new PixelPen(2, 1)
    pen.crossfade(prev, next, 0)
    expect(Array.from(pen.data.slice(0, 4))).toEqual([255, 0, 0, 255])
    expect(pen.data[7]).toBe(0)
    pen.crossfade(prev, next, 1)
    expect(Array.from(pen.data.slice(0, 4))).toEqual([0, 0, 255, 255])
    expect(pen.data[7]).toBe(128)
    pen.crossfade(prev, next, 0.5)
    // Half the new over half the old: a blend, more covered than either half alone.
    expect(pen.data[0]).toBeGreaterThan(60)
    expect(pen.data[2]).toBeGreaterThan(60)
    expect(pen.data[3]).toBeGreaterThan(128)
    expect(pen.data[7]).toBeLessThan(128)
  })
})
