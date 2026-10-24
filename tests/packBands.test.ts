/**
 * The pack's figure bands (`render/hero/packBands.ts`): the CC0 people sit
 * inside them, and the shapes the designer rejected at post size sit outside.
 */
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { INK, rgbOf } from '../src/game/render/hero/palette'
import { PACK_BANDS, checkBands, measureFigure, type Rgba } from '../src/game/render/hero/packBands'
import { postFrame } from '../src/game/render/hero/post'

const PACK = join(resolve(import.meta.dirname, '..'), 'public', 'assets', 'sprites', 'tinyswords')

/** The pack's stills (CREDITS.md: mystic = Pawn) and where each head ends. */
const PEOPLE: [string, number | undefined][] = [
  ['mystic', 37],
  ['fighter', 65],
  ['rogue', 46],
  ['torch1', 48],
  ['tnt1', 42],
  ['barrel1', undefined],
]

async function read(file: string): Promise<Rgba> {
  const { data, info } = await sharp(join(PACK, `${file}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { w: info.width, h: info.height, data }
}

/** A slim, anatomical person: a small head on a neck, a torso, long thin legs, inked. */
function slimFigure(): Rgba {
  const w = 30
  const h = 56
  const data = new Uint8ClampedArray(w * h * 4)
  const fill = new Set<number>()
  const put = (x: number, y: number) => fill.add(y * w + x)
  for (let y = 2; y < 12; y++) for (let x = 10; x < 20; x++) if ((x - 14.5) ** 2 + (y - 6.5) ** 2 <= 22) put(x, y)
  for (let y = 12; y < 15; y++) for (let x = 13; x < 17; x++) put(x, y)
  for (let y = 15; y < 32; y++) for (let x = 10; x < 20; x++) put(x, y)
  for (let y = 15; y < 30; y++) [7, 8, 21, 22].forEach((x) => put(x, y))
  for (let y = 32; y < 54; y++) [11, 12, 13, 16, 17, 18].forEach((x) => put(x, y))
  const ink = rgbOf(INK)
  for (let i = 0; i < w * h; i++) {
    if (!fill.has(i)) continue
    const x = i % w
    const y = (i / w) | 0
    const edge = [-1, 1].some((d) => !fill.has(i + d) || !fill.has(i + d * w)) || x === 0 || y === 0
    const c = edge ? ink : [214, 156, 96]
    data.set([c[0], c[1], c[2], 255], i * 4)
  }
  return { w, h, data }
}

describe('packBands', () => {
  it('every CC0 person in the pack sits inside the bands', async () => {
    for (const [file, headBottom] of PEOPLE) {
      const m = measureFigure(await read(file), { headBottom })
      expect(checkBands(m), file).toEqual([])
      expect(m.outline, file).toBe(INK)
    }
  })

  it('the pawn measures as the bands say (a guard on the measuring itself)', async () => {
    const m = measureFigure(await read('mystic'), { headBottom: 37 })
    expect(m.box).toMatchObject({ w: 58, h: 53 })
    expect(m.fill).toBeCloseTo(0.65, 2)
    expect(m.headShare).toBeCloseTo(0.68, 2)
    expect(m.outlinePx).toBeCloseTo(2.67, 1)
  })

  it('a slim, anatomical figure falls outside: long legs, too narrow, a small head', () => {
    const m = measureFigure(slimFigure(), { headBottom: 12 })
    const keys = checkBands(m).map((x) => x.key)
    expect(keys).toEqual(expect.arrayContaining(['legShare', 'aspect', 'headShare']))
  })

  it('the 72 × 72 post faces (rejected as "chunky", Oct 2026) miss on the line: an even 2 px ring', () => {
    // Their mass and proportions sit in the bands; their outline does not
    // thicken on curves as the pack's does, so it reads thinner beside it.
    for (const id of ['saffra', 'brannoch', 'odile', 'hask', 'wren'] as const) {
      const f = postFrame(id, 'idle', 0)
      const keys = checkBands(measureFigure({ w: f.w, h: f.h, data: f.rgba })).map((x) => x.key)
      expect(keys, id).toContain('outlinePx')
    }
  })

  it('the bands are sane ranges', () => {
    for (const [k, b] of Object.entries(PACK_BANDS)) expect(b.min, k).toBeLessThanOrEqual(b.max)
  })
})
