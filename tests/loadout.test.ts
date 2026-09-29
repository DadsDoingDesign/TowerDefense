import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { beforeAll, describe, expect, it, vi } from 'vitest'

/*
 * Just enough DOM for the compositor: images the test settles by hand, and a
 * canvas whose 2D context records what it was asked to do.
 */
const dom = vi.hoisted(() => {
  type Call = [string, ...unknown[]]
  class FakeImage {
    src = ''
    naturalWidth = 0
    naturalHeight = 0
    complete = false
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
  }
  const images: FakeImage[] = []
  class TrackedImage extends FakeImage {
    constructor() {
      super()
      images.push(this)
    }
  }
  const canvases: { calls: Call[] }[] = []
  const document = {
    createElement: (tag: string) => {
      if (tag !== 'canvas') throw new Error(tag)
      const calls: Call[] = []
      const rec = (name: string) => (...args: unknown[]) => void calls.push([name, ...args])
      const ctx = {
        imageSmoothingEnabled: true,
        save: rec('save'),
        restore: rec('restore'),
        beginPath: rec('beginPath'),
        rect: rec('rect'),
        clip: rec('clip'),
        drawImage: rec('drawImage'),
      }
      const c = { width: 0, height: 0, calls, getContext: () => ctx }
      canvases.push(c)
      return c
    },
  }
  ;(globalThis as Record<string, unknown>).document = document
  ;(globalThis as Record<string, unknown>).Image = TrackedImage
  return { images, canvases }
})

import { anchorsFor, gearGrip, poseIndexFor } from '../src/game/render/anchors'
import { heroStrip, type Loadout } from '../src/game/render/loadout'
import { preloadPack } from '../src/game/render/sprites'
import { gearFitProblems, opaqueBounds, scan, type GearInfo, type HeroStripInfo } from '../scripts/anchors-lib'

const ROOT = resolve(import.meta.dirname, '..')
const PNG = (pack: string, role: string) => join(ROOT, 'public/assets/sprites', pack, `${role}.png`)

/** Settle a requested image: real dimensions if the file exists, else a 404. */
async function settle(src: string, fail = false): Promise<void> {
  const img = dom.images.find((i) => i.src === src)!
  const path = join(ROOT, 'public', src)
  let ok = !fail
  if (ok) {
    try {
      const m = await sharp(readFileSync(path)).metadata()
      img.naturalWidth = m.width!
      img.naturalHeight = m.height!
    } catch {
      ok = false
    }
  }
  img.complete = true
  if (ok) img.onload?.()
  else img.onerror?.()
}

const SWORD: Loadout = { mainHand: 'sword', offHand: 'shield', body: 'plate' }

describe('poseIndexFor', () => {
  it('holds rest through idle', () => {
    for (let f = 0; f < 6; f++) expect(poseIndexFor('idle', f, 6)).toBe(0)
  })
  it('walks raise → strike → extend → recover across an attack', () => {
    expect([0, 1, 2, 3, 4, 5].map((f) => poseIndexFor('atk', f, 6))).toEqual([1, 2, 2, 3, 4, 4])
    const eight = [0, 1, 2, 3, 4, 5, 6, 7].map((f) => poseIndexFor('atk', f, 8))
    expect(eight[0]).toBe(1)
    expect(eight[7]).toBe(4)
    expect([...eight].sort()).toEqual(eight) // monotonic
    expect(poseIndexFor('atk', 0, 1)).toBe(2)
  })
})

describe('anchors are keyed by pack', () => {
  it('fieldwatch has fighter anchors; tinyswords has none', () => {
    expect(anchorsFor('fieldwatch', 'fighter_idle')).not.toBeNull()
    expect(anchorsFor('tinyswords', 'fighter_idle')).toBeNull()
  })
  it('a grip lookup in a pack without that gear falls back to bottom-centre', () => {
    expect(gearGrip('tinyswords', 'gear_sword', 0, 48, 56)).toEqual({ x: 24, y: 55 })
    expect(gearGrip('fieldwatch', 'gear_sword', 0, 48, 56)).not.toEqual({ x: 24, y: 55 })
  })
})

describe('anchor scan (synthetic)', () => {
  const W = 20, H = 10, CELLS = 2
  const buf = () => new Uint8Array(W * H * 4)
  const put = (d: Uint8Array, x: number, y: number, rgb: readonly number[]) => {
    const o = (y * W + x) * 4
    d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255
  }

  it('reads cell-relative markers and falls back for optional ones', () => {
    const d = buf()
    put(d, 3, 4, [255, 0, 255]) // main, cell 0
    put(d, 1, 5, [0, 255, 255]) // off, cell 0
    put(d, 4, 0, [255, 255, 0]) // tip, cell 0
    put(d, 17, 6, [255, 0, 255]) // main, cell 1 (x 7 in-cell)
    put(d, 12, 2, [255, 0, 254]) // near-magenta: ignored
    const { anchors, errors } = scan(d, W, H, CELLS)
    expect(errors).toEqual([])
    expect(anchors[0]).toEqual({ mx: 3, my: 4, ox: 1, oy: 5, tx: 4, ty: 0 })
    expect(anchors[1]).toEqual({ mx: 7, my: 6, ox: 7, oy: 6, tx: 7, ty: 0 })
  })

  it('reports a missing main marker and a duplicate', () => {
    const d = buf()
    put(d, 1, 1, [255, 0, 255])
    put(d, 2, 2, [255, 0, 255])
    const { errors } = scan(d, W, H, CELLS)
    expect(errors).toContain('two main markers in cell 0')
    expect(errors).toContain('no main-hand marker in cell 1')
  })

  it('measures opaque bounds per cell', () => {
    const d = buf()
    put(d, 2, 3, [1, 1, 1])
    put(d, 5, 7, [1, 1, 1])
    expect(opaqueBounds(d, W, H, CELLS)).toEqual([{ x0: 2, y0: 3, x1: 5, y1: 7 }, null])
  })
})

describe('gear fits its cell', () => {
  const hero = (mx: number): HeroStripInfo => ({
    name: 'fighter_atk',
    cellW: 98,
    cellH: 90,
    anchors: Array.from({ length: 6 }, () => ({ mx, my: 55, ox: 34, oy: 60, tx: 0, ty: 0 })),
  })
  const sword: GearInfo = {
    role: 'gear_sword',
    grips: Array.from({ length: 5 }, () => ({ mx: 24, my: 44, ox: 24, oy: 44, tx: 0, ty: 0 })),
    bounds: Array.from({ length: 5 }, () => ({ x0: 0, y0: 18, x1: 47, y1: 40 })),
  }

  it('accepts a hand far enough from the edge', () => {
    expect(gearFitProblems([hero(74)], [sword])).toEqual([])
  })

  it('refuses the overhang that used to bleed into the next frame', () => {
    const p = gearFitProblems([hero(76)], [sword])
    expect(p.length).toBeGreaterThan(0)
    expect(p[0]).toMatch(/gear_sword in the main hand of fighter_atk frame 0 .* outside the 98x90 cell/)
  })

  it('holds for the shipped fieldwatch pack (the build guard, re-run here)', async () => {
    const { ANCHORS } = await import('../src/game/render/anchors.generated')
    const pack = ANCHORS.fieldwatch
    const heroes: HeroStripInfo[] = []
    const gear: GearInfo[] = []
    for (const [name, anchors] of Object.entries(pack)) {
      const { data, info } = await sharp(PNG('fieldwatch', name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const px = new Uint8Array(data.buffer, data.byteOffset, data.length)
      if (name.startsWith('gear_')) gear.push({ role: name, grips: anchors, bounds: opaqueBounds(px, info.width, info.height, 5) })
      else if (!name.startsWith('body_')) heroes.push({ name, cellW: info.width / anchors.length, cellH: info.height, anchors })
    }
    expect(heroes.length).toBeGreaterThan(0)
    expect(gear.length).toBeGreaterThan(0)
    expect(gearFitProblems(heroes, gear)).toEqual([])
  })
})

describe('heroStrip', () => {
  beforeAll(async () => {
    preloadPack('fieldwatch')
    preloadPack('tinyswords')
    // Everything but the plate overlay arrives now; the plate is late.
    for (const img of dom.images) if (!img.src.endsWith('/body_plate.png')) await settle(img.src)
  })

  it('returns the SAME composite object frame after frame', () => {
    const a = heroStrip('fieldwatch', 'fighter', 'idle', 6, { mainHand: 'sword', offHand: 'shield', body: null })
    const b = heroStrip('fieldwatch', 'fighter', 'idle', 6, { mainHand: 'sword', offHand: 'shield', body: null })
    expect(a).not.toBeNull()
    expect(b).toBe(a)
  })

  it('caches an incomplete composite until more art arrives, then rebuilds once', async () => {
    const built = dom.canvases.length
    const a = heroStrip('fieldwatch', 'fighter', 'atk', 6, SWORD) // plate not loaded yet
    const b = heroStrip('fieldwatch', 'fighter', 'atk', 6, SWORD)
    expect(b).toBe(a)
    expect(dom.canvases.length).toBe(built + 1)
    await settle('assets/sprites/fieldwatch/body_plate.png')
    const c = heroStrip('fieldwatch', 'fighter', 'atk', 6, SWORD)
    const d = heroStrip('fieldwatch', 'fighter', 'atk', 6, SWORD)
    expect(c).not.toBe(a)
    expect(d).toBe(c)
    expect(dom.canvases.length).toBe(built + 2)
  })

  it('gear art that never arrives (a 404) settles into the cache instead of rebuilding forever', () => {
    const lo: Loadout = { mainHand: 'warhammer', offHand: null, body: null } // not in the placeholder pack
    const a = heroStrip('fieldwatch', 'fighter', 'idle', 6, lo)
    for (let i = 0; i < 10; i++) expect(heroStrip('fieldwatch', 'fighter', 'idle', 6, lo)).toBe(a)
  })

  it('a pack without anchors gets the bare body, not another pack’s grips', () => {
    const body = heroStrip('tinyswords', 'fighter', 'idle', 6, null)
    expect(body).not.toBeNull()
    expect(heroStrip('tinyswords', 'fighter', 'idle', 6, SWORD)).toBe(body)
  })

  it('clips every frame to its own cell', () => {
    const before = dom.canvases.length
    heroStrip('fieldwatch', 'fighter', 'atk', 6, { mainHand: 'greatsword', offHand: null, body: null })
    const { calls } = dom.canvases[before]
    const rects = calls.filter((c) => c[0] === 'rect')
    expect(rects).toEqual([0, 1, 2, 3, 4, 5].map((f) => ['rect', f * 98, 0, 98, 90]))
    expect(calls.filter((c) => c[0] === 'clip')).toHaveLength(6)
    expect(calls.filter((c) => c[0] === 'save').length).toBe(calls.filter((c) => c[0] === 'restore').length)
    // Every draw happens inside a save/clip, never between frames.
    let depth = 0
    for (const c of calls) {
      if (c[0] === 'save') depth++
      if (c[0] === 'restore') depth--
      if (c[0] === 'drawImage') expect(depth).toBe(1)
    }
  })

  it('is a real LRU: a recently used entry survives a flood of new ones', () => {
    const keep: Loadout = { mainHand: 'dagger', offHand: null, body: null }
    const kept = heroStrip('fieldwatch', 'fighter', 'idle', 6, keep)
    const nouns = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']
    for (const n of nouns) {
      for (const m of ['x', 'y']) heroStrip('fieldwatch', 'fighter', 'idle', 6, { mainHand: n + m, offHand: null, body: null })
      // Touch the kept entry between inserts, as a hero on screen would every frame.
      expect(heroStrip('fieldwatch', 'fighter', 'idle', 6, keep)).toBe(kept)
    }
  })
})
