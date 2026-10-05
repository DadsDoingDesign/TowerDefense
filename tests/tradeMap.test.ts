import { describe, expect, it } from 'vitest'
import { COMPANY_IDS, type CompanyId } from '../src/game/data/companies'
import {
  brightenEase,
  BRIGHTEN_MS,
  buildGeometry,
  glowAlpha,
  glowWidth,
  makeTraffic,
  PULSE_SECONDS,
  pulseCount,
  pulseIndex,
  roadViews,
  WAGON_STANDING,
} from '../src/ui/attract/mapRules'

/*
 * The menu's trade map (build step 4) — the motion spec of `trade/NOTES.md`
 * held as numbers, and the geometry the painter draws.
 */
const all = (n: number) => Object.fromEntries(COMPANY_IDS.map((c) => [c, n])) as Record<CompanyId, number>
const yes = Object.fromEntries(COMPANY_IDS.map((c) => [c, true])) as Record<CompanyId, boolean>

describe('the motion spec', () => {
  it('pulses: 1 + 0.75 × standing, none on a road never worked', () => {
    expect(pulseCount(0)).toBe(0)
    expect(pulseCount(1)).toBe(2)
    expect(pulseCount(4)).toBe(4)
    expect(pulseCount(10)).toBe(9)
  })

  it('glow by standing: 4 + 1.2 × standing wide, 0.05 + 0.022 × standing strong', () => {
    expect(glowWidth(0)).toBe(4)
    expect(glowWidth(10)).toBeCloseTo(16)
    expect(glowAlpha(10)).toBeCloseTo(0.27)
  })

  it('every pulse takes 8–14 s end to end; about 70% run outbound', () => {
    const t = makeTraffic(roadViews({ standing: all(10), hiring: yes, firstRun: false, first: 'spice' }))
    expect(t.length).toBe(5 * pulseCount(10))
    for (const p of t) {
      expect(1 / p.speed).toBeGreaterThanOrEqual(PULSE_SECONDS[0])
      expect(1 / p.speed).toBeLessThanOrEqual(PULSE_SECONDS[1])
    }
    const out = t.filter((p) => p.dir === 1).length / t.length
    expect(out).toBeGreaterThan(0.5)
    expect(out).toBeLessThan(0.9)
  })

  it('a wagon every third pulse from standing 7, and never below it', () => {
    for (const s of [6, WAGON_STANDING, 10]) {
      const t = makeTraffic(roadViews({ standing: { ...all(0), spice: s }, hiring: yes, firstRun: false, first: 'spice' }))
      const wagons = t.filter((p) => p.wagon).length
      expect(wagons).toBe(s >= WAGON_STANDING ? Math.floor(pulseCount(s) / 3) : 0)
    }
  })

  it('the brighten eases out over 600ms and stops there', () => {
    expect(brightenEase(0)).toBe(0)
    expect(brightenEase(BRIGHTEN_MS / 2)).toBeGreaterThan(0.5)
    expect(brightenEase(BRIGHTEN_MS)).toBe(1)
    expect(brightenEase(BRIGHTEN_MS * 3)).toBe(1)
  })

  it('a pulse stays on its road at every moment', () => {
    const [p] = makeTraffic(roadViews({ standing: all(5), hiring: yes, firstRun: false, first: 'spice' }))
    for (let t = 0; t < 40; t += 0.37) {
      const j = pulseIndex(p, 120, t)
      expect(j).toBeGreaterThanOrEqual(0)
      expect(j).toBeLessThan(120)
    }
  })
})

describe('how each road reads', () => {
  it('a first launch: one faint road (the free escort’s), the rest uncharted', () => {
    const v = roadViews({ standing: all(0), hiring: { ...yes, scrolls: false }, firstRun: true, first: 'spice' })
    expect(v.filter((r) => r.state === 'faint').map((r) => r.company)).toEqual(['spice'])
    expect(v.filter((r) => r.state === 'uncharted')).toHaveLength(4)
    const t = makeTraffic(v)
    expect(t).toHaveLength(pulseCount(1))
    expect(t.every((p) => p.company === 'spice' && p.faint && !p.wagon)).toBe(true)
  })

  it('a veteran: every road lit at its standing', () => {
    const v = roadViews({ standing: { spice: 10, art: 8, metals: 7, silk: 6, scrolls: 4 }, hiring: yes, firstRun: false, first: 'spice' })
    expect(v.every((r) => r.state === 'lit' && r.light === r.standing)).toBe(true)
  })

  it('a company that hires but has not been worked for is dotted and named; one that does not hire is uncharted', () => {
    const v = roadViews({ standing: { ...all(0), spice: 3 }, hiring: { ...yes, scrolls: false }, firstRun: false, first: 'spice' })
    expect(v.find((r) => r.company === 'art')!.state).toBe('hiring')
    expect(v.find((r) => r.company === 'scrolls')!.state).toBe('uncharted')
    expect(makeTraffic(v).every((p) => p.company === 'spice')).toBe(true)
  })
})

describe('the geometry', () => {
  for (const [name, W, H, open] of [
    ['phone 390×844', 195, 422, { x: 0, y: 70, w: 195, h: 220 }],
    ['phone 320×568', 160, 284, { x: 0, y: 45, w: 160, h: 115 }],
    ['desk 1440×900', 720, 450, { x: 225, y: 0, w: 495, h: 450 }],
  ] as const) {
    it(`${name}: five continuous roads from the hub, their towns on them, inside the open area`, () => {
      const g = buildGeometry(W, H, open)
      expect(g.routes).toHaveLength(5)
      for (const r of g.routes) {
        expect(r.chain[0]).toEqual(g.hub)
        for (let i = 1; i < r.chain.length; i++) {
          const [ax, ay] = r.chain[i - 1]
          const [bx, by] = r.chain[i]
          expect(Math.max(Math.abs(ax - bx), Math.abs(ay - by))).toBe(1)
        }
        for (const t of r.towns) expect(r.chain.some((q) => q[0] === t[0] && q[1] === t[1])).toBe(true)
        const [dx, dy] = r.towns[2]
        expect(dx).toBeGreaterThanOrEqual(open.x)
        expect(dx).toBeLessThanOrEqual(open.x + open.w)
        // Room above every destination for its label.
        expect(dy).toBeGreaterThanOrEqual(open.y + 20)
        expect(dy).toBeLessThanOrEqual(open.y + open.h)
      }
    })
  }
})
