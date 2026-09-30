import { describe, expect, it } from 'vitest'
import { fieldFor, FIRST_MAP, KILN_MAP } from '../src/game/data/maps'
import { entrySide, stageView, type StageViewInput } from '../src/game/render/frame'
import { playRect, worldOf } from '../src/game/render/terrain'
import type { GameMap } from '../src/game/types'

/**
 * Grid-fit: the map fills the Stage edge to edge (`frame.stageView`). What is
 * pinned here is what the designer asked for and what must never break:
 * the whole playable rect (road, Gate, every open tile) is always on screen,
 * the canvas covers the whole wrap, the horde enters from off-screen, and a
 * desk gets a crisp scale — whole device px, or a whole-number supersample.
 */
const input = (map: GameMap, wrapW: number, wrapH: number, dpr: number, crisp: boolean, padT = 0): StageViewInput => ({
  wrapW,
  wrapH,
  padT,
  padB: 0,
  dpr,
  crisp,
  play: playRect(map),
  world: worldOf(map),
  entry: entrySide(map),
})

/** Stage boxes measured on the shell (wrap CSS px) at the matrix sizes. */
const STAGES: [string, GameMap, number, number, number, boolean][] = [
  ['390×844 portrait', fieldFor(FIRST_MAP.id, null, 'portrait')!, 390, 528, 2, false],
  ['320×568 portrait', fieldFor(KILN_MAP.id, null, 'portrait')!, 320, 285, 2, false],
  ['768×1024 tablet', KILN_MAP, 768, 424, 2, true],
  ['1440×900 desk', FIRST_MAP, 978, 795, 2, true],
  ['1920×1080 desk', KILN_MAP, 1451, 975, 1, true],
  ['2560×1080 ultrawide', FIRST_MAP, 2091, 975, 1, true],
]

describe('stageView', () => {
  it.each(STAGES)('%s: the playable rect is on screen and the canvas covers the wrap', (_name, map, w, h, dpr, crisp) => {
    const v = stageView(input(map, w, h, dpr, crisp))
    const pr = playRect(map)
    // Field px → wrap CSS px.
    const X = (x: number) => v.left + (x - v.x0) * v.scale
    const Y = (y: number) => v.top + (y - v.y0) * v.scale
    expect(X(pr.x0)).toBeGreaterThanOrEqual(-1e-6)
    expect(Y(pr.y0)).toBeGreaterThanOrEqual(-1e-6)
    expect(X(pr.x1)).toBeLessThanOrEqual(w + 1e-6)
    expect(Y(pr.y1)).toBeLessThanOrEqual(h + 1e-6)
    // Edge to edge: no letterbox anywhere.
    expect(v.left).toBeLessThanOrEqual(1e-6)
    expect(v.top).toBeLessThanOrEqual(1e-6)
    expect(v.left + v.w * v.scale).toBeGreaterThanOrEqual(w - 1e-6)
    expect(v.top + v.h * v.scale).toBeGreaterThanOrEqual(h - 1e-6)
    // One axis is filled by the playable rect (as big as it can be)…
    const fillsW = (pr.x1 - pr.x0) * v.scale >= w * 0.9
    const fillsH = (pr.y1 - pr.y0) * v.scale >= h * 0.9
    expect(fillsW || fillsH).toBe(true)
    // …and the horde's way in is never on screen.
    const entry = entrySide(map)
    if (entry === 'left') expect(X(0)).toBeLessThanOrEqual(1e-6)
    if (entry === 'top') expect(Y(0)).toBeLessThanOrEqual(1e-6)
    expect(Number.isInteger(v.x0) && Number.isInteger(v.y0) && Number.isInteger(v.w) && Number.isInteger(v.h)).toBe(true)
  })

  it('a desk scale is crisp: whole device px per field px, or a whole-number supersample', () => {
    // 1440×900 @2: fit 1.019 → exactly 1 (2 device px), lossless.
    const a = stageView(input(FIRST_MAP, 978, 795, 2, true))
    expect(a.scale * 2).toBe(2)
    expect(a.density).toBe(1)
    expect(a.pixelated).toBe(true)
    // 1920×1080 @1: fit 1.51 — snapping to 1 would leave the field in a third
    // of the Stage, so it is composed at ×2 and filtered down.
    const b = stageView(input(KILN_MAP, 1451, 975, 1, true))
    expect(b.scale).toBeCloseTo(1451 / 960, 6)
    expect(b.density).toBe(2)
    expect(b.pixelated).toBe(false)
    // 2560×1080 @1: fit 2.18 → 2, within the 10% snap.
    const c = stageView(input(FIRST_MAP, 2091, 975, 1, true))
    expect(c.scale).toBe(2)
    // A phone is fit exactly (no snap), as before.
    const d = stageView(input(fieldFor(FIRST_MAP.id, null, 'portrait')!, 390, 528, 2, false))
    expect(d.density).toBe(1)
    expect(d.scale).toBeCloseTo(528 / 960, 6)
  })

  it('the boss nameplate strip is reserved: the playable rect sits below it', () => {
    const tall = fieldFor(FIRST_MAP.id, null, 'portrait')!
    const v = stageView(input(tall, 390, 528, 2, false, 54))
    const pr = playRect(tall)
    expect(v.top + (pr.y0 - v.y0) * v.scale).toBeGreaterThanOrEqual(54 - 1e-6)
    expect(v.top).toBeLessThanOrEqual(1e-6)
  })
})
