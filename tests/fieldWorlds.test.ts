import { afterEach, describe, expect, it } from 'vitest'
import { COMPANY_IDS } from '../src/game/data/companies'
import { FIELD_SEASONS, fieldSeasonFor } from '../src/game/data/fieldSeasons'
import { FIRST_MAP, KILN_MAP } from '../src/game/data/maps'
import { EdgeBand } from '../src/game/render/edgeFx'
import { AUTO_DOWN_MS, AUTO_UP_MS, fxAutoLight, fxLevel, noteFxFrame, onFxLevel, resetFxQuality, setFxSettings } from '../src/game/render/fxQuality'
import { drawnRoad } from '../src/game/render/terrain'
import { migrateSettings } from '../src/state/settingsStore'
import { MAP_SEASONS } from '../src/ui/attract/mapRules'

/*
 * The company worlds on the battlefield and their cost (Oct 2026): the
 * effects level (setting, automatic step down, reduced motion), the season a
 * battle wears, and the edge band that never touches the game.
 */

afterEach(() => resetFxQuality())

describe('the effects level (fxQuality)', () => {
  const frames = (ms: number, total: number) => {
    for (let t = 0; t < total; t += ms) noteFxFrame(ms)
  }
  it('is Full by default; Light is the setting; reduced motion wins over both', () => {
    expect(fxLevel()).toBe('full')
    setFxSettings('light', false)
    expect(fxLevel()).toBe('light')
    setFxSettings('full', true)
    expect(fxLevel()).toBe('off')
    setFxSettings('light', true)
    expect(fxLevel()).toBe('off')
  })
  it('steps down to Light when the rate stays under 45 fps for two seconds, and not for a blip', () => {
    frames(1000 / 60, 3000)
    expect(fxLevel()).toBe('full')
    frames(1000 / 30, 600) // a blip
    frames(1000 / 60, 2000)
    expect(fxLevel()).toBe('full')
    frames(1000 / 30, AUTO_DOWN_MS + 1500)
    expect(fxLevel()).toBe('light')
    expect(fxAutoLight()).toBe(true)
  })
  it('recovers only after a long stretch with headroom, and waits twice as long after each relapse (no flapping)', () => {
    const seen: string[] = []
    onFxLevel((l) => seen.push(l))
    frames(1000 / 30, AUTO_DOWN_MS + 1500)
    expect(fxLevel()).toBe('light')
    // A rate between the two lines changes nothing either way.
    frames(1000 / 50, AUTO_UP_MS * 2)
    expect(fxLevel()).toBe('light')
    frames(1000 / 60, AUTO_UP_MS + 1500)
    expect(fxLevel()).toBe('full')
    // Down again; this time the same wait is not enough.
    frames(1000 / 30, AUTO_DOWN_MS + 1500)
    frames(1000 / 60, AUTO_UP_MS + 1500)
    expect(fxLevel()).toBe('light')
    frames(1000 / 60, AUTO_UP_MS * 2)
    expect(fxLevel()).toBe('full')
    expect(seen).toEqual(['light', 'full', 'light', 'full'])
  })
  it('the setting’s Light and reduced motion are never measured, and a tab-out is not a slow frame', () => {
    setFxSettings('light', false)
    frames(1000 / 60, AUTO_UP_MS * 4)
    expect(fxLevel()).toBe('light')
    setFxSettings('full', false)
    for (let i = 0; i < 40; i++) noteFxFrame(2000)
    expect(fxLevel()).toBe('full')
  })
  it('is a persisted setting: Full when missing or unknown, Light kept', () => {
    const none = () => null
    expect(migrateSettings({}, 5, none).effects).toBe('full')
    expect(migrateSettings({ effects: 'ultra' }, 6, none).effects).toBe('full')
    expect(migrateSettings({ effects: 'light' }, 6, none).effects).toBe('light')
  })
})

describe('the season a battle wears', () => {
  it('every company has one, named as its road’s season on the home’s map; the house look has none', () => {
    for (const c of COMPANY_IDS) {
      expect(FIELD_SEASONS[c].name).toBe(MAP_SEASONS[c].name)
      expect(fieldSeasonFor(c)).toBe(FIELD_SEASONS[c])
      expect(FIELD_SEASONS[c].edge.length).toBeGreaterThan(0)
    }
    expect(fieldSeasonFor('neutral')).toBeNull()
    expect(fieldSeasonFor(null)).toBeNull()
  })
  it('the frost puts snow on the scenery; autumn and spring put colour in the crowns and on the grass', () => {
    expect(FIELD_SEASONS.scrolls.caps).toBeTruthy()
    expect(FIELD_SEASONS.spice.crowns && FIELD_SEASONS.spice.ground).toBeTruthy()
    expect(FIELD_SEASONS.art.crowns && FIELD_SEASONS.art.ground).toBeTruthy()
    expect(FIELD_SEASONS.silk.mist).toBeTruthy()
  })
})

describe('the edge band never touches the game', () => {
  /** A context that records where it was drawn on. */
  const recorder = () => {
    const rects: { x: number; y: number }[] = []
    const ctx = { globalAlpha: 1, fillStyle: '#000', fillRect: (x: number, y: number) => rects.push({ x, y }) }
    return { ctx: ctx as unknown as CanvasRenderingContext2D, rects }
  }
  const dSeg = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
  }
  for (const map of [FIRST_MAP, KILN_MAP]) {
    for (const co of COMPANY_IDS) {
      it(`${map.id}, ${co}: in the band at the view's edges, clear of the road, every slot and the wagon`, () => {
        const band = new EdgeBand()
        const view = { x0: -60, y0: -40, w: map.width + 120, h: map.height + 80 }
        const { ctx, rects } = recorder()
        for (let f = 0; f < 150; f++) band.frame(ctx, map, view, 1, FIELD_SEASONS[co], 'full', 1000 / 60)
        expect(rects.length).toBeGreaterThan(0)
        expect(band.count).toBeLessThanOrEqual(40)
        const road = drawnRoad(map)
        const T = map.tile ?? 40
        const edge = 26 * 1.4 + 6
        const seen = new Set<string>()
        const bad: string[] = []
        for (const r of rects) {
          const key = `${r.x},${r.y}`
          if (seen.has(key)) continue
          seen.add(key)
          const p = { x: r.x + 1, y: r.y + 1 }
          let dr = Infinity
          for (let k = 1; k < road.length; k++) dr = Math.min(dr, dSeg(p, road[k - 1], road[k]))
          if (dr <= 30) bad.push(`road ${key}`)
          if (map.slots.some((s) => Math.hypot(p.x - s.pos.x, p.y - s.pos.y) <= T * 0.6)) bad.push(`slot ${key}`)
          if (Math.hypot(p.x - map.base.x, p.y - map.base.y) <= 80) bad.push(`wagon ${key}`)
          const inBand = p.x < view.x0 + edge || p.x > view.x0 + view.w - edge || p.y < view.y0 + edge || p.y > view.y0 + view.h - edge
          if (!inBand) bad.push(`inside ${key}`)
        }
        expect(bad).toEqual([])
      })
    }
  }
  it('Light halves it; reduced motion clears it; the house look has none', () => {
    const map = FIRST_MAP
    const view = { x0: -60, y0: -40, w: map.width + 120, h: map.height + 80 }
    const { ctx } = recorder()
    const full = new EdgeBand()
    const light = new EdgeBand()
    for (let f = 0; f < 600; f++) {
      full.frame(ctx, map, view, 1, FIELD_SEASONS.scrolls, 'full', 1000 / 60)
      light.frame(ctx, map, view, 1, FIELD_SEASONS.scrolls, 'light', 1000 / 60)
    }
    expect(light.count).toBeLessThanOrEqual(Math.ceil(full.count / 2) + 1)
    full.frame(ctx, map, view, 1, FIELD_SEASONS.scrolls, 'off', 16)
    expect(full.count).toBe(0)
    light.frame(ctx, map, view, 1, null, 'full', 16)
    expect(light.count).toBe(0)
  })
})
