import { afterEach, describe, expect, it } from 'vitest'
import { COMPANY_IDS } from '../src/game/data/companies'
import { FIELD_SEASONS, fieldSeasonFor } from '../src/game/data/fieldSeasons'
import { fieldFor, FIRST_MAP, KILN_MAP } from '../src/game/data/maps'
import type { GameMap } from '../src/game/types'
import { clearGrid, EDGE_PEAK, EdgeBand, isClear } from '../src/game/render/edgeFx'
import { FLASH_GAP_S, OVER_GAME, WEATHER_PEAK, WeatherLayer } from '../src/game/render/weatherFx'
import { AUTO_DOWN_MS, AUTO_UP_MS, fxAutoLight, fxLevel, noteFxFrame, onFxLevel, resetFxQuality, setFxSettings } from '../src/game/render/fxQuality'
import { drawnRoad, gradeEnvironment, seasonPropsFor } from '../src/game/render/terrain'
import { ACCENT_KEEP, ACCENT_PAINT, ACCENT_SHIFT } from '../src/game/render/season'
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
  it('each season is a place, not a tint: its scenery changes, it brings props, and it has weather that moves', () => {
    for (const c of COMPANY_IDS) {
      const s = FIELD_SEASONS[c]
      // The scenery: pines repainted, broadleaves standing in, rocks repainted or a ground cover.
      expect(!!(s.foliage || s.broadleaf), `${c} scenery`).toBe(true)
      expect(s.props?.length ?? 0, `${c} props`).toBeGreaterThan(0)
      expect(s.weather.count, `${c} weather`).toBeGreaterThan(0)
      expect(s.weather.count).toBeLessThanOrEqual(18)
      for (const r of [...(s.foliage?.ramps ?? []), s.foliage?.bush, ...(s.broadleaf?.ramps ?? [])]) if (r) expect(r).toHaveLength(5)
      if (s.rocks) expect(s.rocks).toHaveLength(4)
    }
    // What the designer asked for, season by season.
    expect(FIELD_SEASONS.spice.cover && FIELD_SEASONS.spice.broadleaf && FIELD_SEASONS.spice.light).toBeTruthy()
    expect(FIELD_SEASONS.spice.props?.map((p) => p.kind)).toEqual(expect.arrayContaining(['bale', 'sheaf', 'sunflower', 'pumpkin']))
    expect(FIELD_SEASONS.art.broadleaf?.blossom?.length).toBeGreaterThan(0)
    expect(FIELD_SEASONS.art.weather.kinds).toEqual(expect.arrayContaining(['petal', 'butterfly']))
    expect(FIELD_SEASONS.metals.weather.sheet).toBe('rain')
    expect(FIELD_SEASONS.metals.weather.clouds).toBeTruthy()
    expect(FIELD_SEASONS.metals.props?.map((p) => p.kind)).toEqual(expect.arrayContaining(['puddle', 'mud']))
    expect(FIELD_SEASONS.metals.rocks).toBeTruthy()
    expect(FIELD_SEASONS.silk.weather.fog?.banks).toBeGreaterThan(1)
    expect(FIELD_SEASONS.silk.props?.map((p) => p.kind)).toEqual(expect.arrayContaining(['reeds', 'lily']))
    expect(FIELD_SEASONS.scrolls.cover?.tufts && FIELD_SEASONS.scrolls.caps && FIELD_SEASONS.scrolls.icicles && FIELD_SEASONS.scrolls.ice).toBeTruthy()
    expect(FIELD_SEASONS.scrolls.weather.sheet).toBe('snow')
  })
})

describe('the edge band never touches the game', () => {
  /** A context that records where it was drawn on. */
  const recorder = () => {
    const rects: { x: number; y: number; a: number }[] = []
    const ctx = {
      globalAlpha: 1,
      fillStyle: '#000',
      imageSmoothingEnabled: false,
      fillRect(x: number, y: number) {
        rects.push({ x, y, a: this.globalAlpha })
      },
      rect(x: number, y: number) {
        rects.push({ x, y, a: this.globalAlpha })
      },
      beginPath: () => {},
      fill: () => {},
      drawImage: () => {},
    }
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
        expect(band.count).toBeLessThanOrEqual(new EdgeBand().caps.desk)
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

describe('the season’s weather keeps the game on top', () => {
  const recorder = () => {
    const rects: { x: number; y: number; a: number }[] = []
    const ctx = {
      globalAlpha: 1,
      fillStyle: '#000',
      imageSmoothingEnabled: false,
      fillRect(x: number, y: number) {
        rects.push({ x, y, a: this.globalAlpha })
      },
      rect(x: number, y: number) {
        rects.push({ x, y, a: this.globalAlpha })
      },
      beginPath: () => {},
      fill: () => {},
      drawImage: () => {},
    }
    return { ctx: ctx as unknown as CanvasRenderingContext2D, rects }
  }
  for (const co of COMPANY_IDS) {
    it(`${co}: capped (≤ 18 on a phone), halved by Light, gone under reduced motion and the house look`, () => {
      const map = FIRST_MAP
      const phone = { x0: 0, y0: 0, w: 640, h: 1100 }
      const run = (level: 'full' | 'light' | 'off') => {
        const w = new WeatherLayer()
        const { ctx } = recorder()
        let most = 0
        for (let f = 0; f < 400; f++) {
          w.frame(ctx, map, phone, 0.5, FIELD_SEASONS[co], level, 1000 / 60)
          most = Math.max(most, w.count)
        }
        return most
      }
      const full = run('full')
      expect(full).toBeGreaterThan(0)
      expect(full).toBeLessThanOrEqual(18)
      expect(full).toBeLessThanOrEqual(WeatherLayer.cap(FIELD_SEASONS[co], true, 'full'))
      expect(run('light')).toBeLessThanOrEqual(Math.ceil(full / 2) + 1)
      expect(run('off')).toBe(0)
      const none = new WeatherLayer()
      none.frame(recorder().ctx, map, phone, 0.5, null, 'full', 16)
      expect(none.count).toBe(0)
    })
  }
  it('the calm pass: every season at 40–50% of its old weather, the game kept clearer, everything fainter', () => {
    // The counts before the calm pass (Oct 2026), a phone at Full.
    const OLD = { spice: 30, art: 30, metals: 40, silk: 18, scrolls: 40 } as const
    for (const c of COMPANY_IDS) {
      const n = FIELD_SEASONS[c].weather.count
      expect(n / OLD[c], c).toBeGreaterThanOrEqual(0.4)
      expect(n / OLD[c], c).toBeLessThanOrEqual(0.5)
    }
    // Ironvein's rain was the loudest: it comes down the most.
    expect(FIELD_SEASONS.metals.weather.count / OLD.metals).toBeLessThanOrEqual(0.4)
    expect(FIELD_SEASONS.metals.weather.clouds!.alpha).toBeLessThanOrEqual(0.1)
    expect(FIELD_SEASONS.silk.weather.fog!.alpha).toBeLessThanOrEqual(0.5)
    expect(OVER_GAME).toBeLessThanOrEqual(0.2)
    expect(WEATHER_PEAK).toBeLessThanOrEqual(0.7)
    expect(EDGE_PEAK).toBeLessThanOrEqual(0.7)
    // The edge band: 45% of its old caps (24 and 40).
    const band = new EdgeBand()
    expect(band.caps.phone).toBeLessThanOrEqual(11)
    expect(band.caps.desk).toBeLessThanOrEqual(18)
  })
  it('the far flash is Full only and rare: none before its first gap, none ever on Light', () => {
    const map = FIRST_MAP
    const view = { x0: 0, y0: 0, w: 640, h: 1100 }
    const flashes = (level: 'full' | 'light', secs: number) => {
      let n = 0
      const ctx = {
        globalAlpha: 1,
        fillStyle: '#000',
        imageSmoothingEnabled: false,
        fillRect() {
          if (this.fillStyle === '#e8f0ff' && this.globalAlpha > 0) n++
        },
        rect: () => {},
        beginPath: () => {},
        fill: () => {},
        drawImage: () => {},
      }
      const w = new WeatherLayer()
      for (let t = 0; t < secs; t += 0.05) w.frame(ctx as unknown as CanvasRenderingContext2D, map, view, 0.5, FIELD_SEASONS.metals, level, 50)
      return n
    }
    expect(FLASH_GAP_S).toBeGreaterThanOrEqual(40)
    expect(flashes('full', FLASH_GAP_S - 1)).toBe(0)
    expect(flashes('light', 240)).toBe(0)
    expect(flashes('full', 240)).toBeGreaterThan(0)
  })
  it('is faint over the game: a particle over the road, a slot or the wagon is drawn at under a fifth of its strength', () => {
    const map = KILN_MAP
    const view = { x0: -60, y0: -40, w: map.width + 120, h: map.height + 80 }
    const g = clearGrid(map)
    for (const co of ['spice', 'art', 'metals', 'scrolls'] as const) {
      const w = new WeatherLayer()
      const { ctx, rects } = recorder()
      for (let f = 0; f < 300; f++) w.frame(ctx, map, view, 1, FIELD_SEASONS[co], 'full', 1000 / 60)
      // Well inside the game (nothing clear within 10 px: a particle's rects sit a few px off its anchor).
      const deep = (x: number, y: number) => [-10, 0, 10].every((dx) => [-10, 0, 10].every((dy) => !isClear(g, x + dx, y + dy)))
      const over = rects.filter((r) => deep(r.x, r.y))
      expect(over.length).toBeGreaterThan(0)
      for (const r of over) expect(r.a).toBeLessThanOrEqual(OVER_GAME + 1 / 24)
    }
  })
})

describe('the season’s props', () => {
  const T = (m: GameMap) => m.tile ?? 40
  const dSeg = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
  }
  const flooded = fieldFor(FIRST_MAP.id, 'flooded', 'landscape')!
  for (const map of [FIRST_MAP, KILN_MAP, flooded]) {
    it(`${map.id}${map.terrainRule ? ' (' + map.terrainRule + ')' : ''}: upright props stand only on forest, nothing on the road, the danger ground, a slot or the wagon`, () => {
      const road = drawnRoad(map)
      for (const co of COMPANY_IDS) {
        const { flat, upright } = seasonPropsFor(map, FIELD_SEASONS[co])
        for (const p of upright) {
          if (p.kind === 'reeds' && FIELD_SEASONS[co].props?.some((r) => r.kind === 'reeds' && r.where === 'water')) {
            const lake = (map.tiles ?? []).some((t) => t.block === 'water' && Math.abs(t.pos.x - p.x) <= T(map) / 2 + 1 && Math.abs(t.pos.y - p.y) <= T(map) / 2 + 8)
            if (lake) continue // on a lake's rim
          }
          // On no tile of the grid that is not forest (an open tile carries nothing that looks like a blocker).
          const tile = (map.tiles ?? []).find((t) => Math.abs(t.pos.x - p.x) <= T(map) / 2 && Math.abs(t.pos.y - (p.y - 3)) <= T(map) / 2)
          expect(tile?.block ?? 'forest', `${co} ${p.kind} at ${p.x},${p.y}`).toBe('forest')
        }
        for (const p of [...flat, ...upright]) {
          let dr = Infinity
          for (let k = 1; k < road.length; k++) dr = Math.min(dr, dSeg(p, road[k - 1], road[k]))
          expect(dr, `${co} ${p.kind} by the road`).toBeGreaterThan(20)
          if (p.kind === 'reeds' || p.kind === 'lily') continue
          expect(Math.hypot(p.x - map.base.x, p.y - map.base.y)).toBeGreaterThan(90)
          for (const t of map.tiles ?? [])
            if (t.danger || t.block === 'water' || t.block === 'fire')
              expect(Math.abs(t.pos.x - p.x) < T(map) / 2 && Math.abs(t.pos.y - p.y) < T(map) / 2, `${co} ${p.kind} on ${t.block ?? t.danger}`).toBe(false)
        }
        // A flat prop on the grass sits off every open tile's standing spot.
        for (const p of flat) {
          if (p.kind === 'lily') continue
          for (const sl of map.slots) expect(Math.hypot(p.x - sl.pos.x, p.y - sl.pos.y), `${co} ${p.kind} on a slot`).toBeGreaterThan(T(map) * 0.4)
        }
      }
    })
  }
  it('the same field and season lay the same props, a different season others, and nothing draws on the RNG', () => {
    const rnd = Math.random
    let draws = 0
    Math.random = () => {
      draws++
      return rnd()
    }
    try {
      const a = seasonPropsFor(KILN_MAP, FIELD_SEASONS.spice)
      const b = seasonPropsFor(KILN_MAP, FIELD_SEASONS.spice)
      expect(b).toEqual(a)
      expect(a.upright.length).toBeGreaterThan(0)
      expect(seasonPropsFor(KILN_MAP, FIELD_SEASONS.metals)).not.toEqual(a)
    } finally {
      Math.random = rnd
    }
    expect(draws).toBe(0)
  })
  it('a flooded field’s lakes get reeds and pads in the misty morning', () => {
    const { flat, upright } = seasonPropsFor(flooded, FIELD_SEASONS.silk)
    expect(upright.some((p) => p.kind === 'reeds')).toBe(true)
    expect(flat.some((p) => p.kind === 'lily')).toBe(true)
  })
})

describe('a season keeps no tier hue near the play (Oct 2026 job critique)', () => {
  const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
  const hsl = (r: number, g: number, b: number) => {
    const R = r / 255, G = g / 255, B = b / 255
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B)
    const l = (mx + mn) / 2, ch = mx - mn
    const s = ch === 0 ? 0 : ch / (1 - Math.abs(2 * l - 1))
    let h = 0
    if (ch > 0) h = mx === R ? 60 * (((G - B) / ch) % 6) : mx === G ? 60 * ((B - R) / ch + 2) : 60 * ((R - G) / ch + 4)
    return { h: h < 0 ? h + 360 : h, s, l }
  }
  /** One row of pixels, each with its accent mark, through the real grade. */
  const grade = (px: [string, number][]) => {
    const data = new Uint8ClampedArray(px.length * 4)
    px.forEach(([c], i) => data.set([...hex(c), 255], i * 4))
    const ctx = { getImageData: () => ({ data }), putImageData: () => undefined } as unknown as CanvasRenderingContext2D
    gradeEnvironment(ctx, px.length, 1, undefined, Uint8Array.from(px.map(([, m]) => m)))
    return px.map((_, i) => hsl(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]))
  }

  it('cuts the gold and the red of the paint near the play, and keeps them on the margins’ set pieces', () => {
    const [goldNear, goldKept, rustNear, rustKept] = grade([
      ['#c6ae56', ACCENT_PAINT],
      ['#c6ae56', ACCENT_KEEP],
      ['#b4561e', ACCENT_PAINT],
      ['#b4561e', ACCENT_KEEP],
    ])
    expect(goldNear.s).toBeLessThan(goldKept.s * 0.6)
    expect(rustNear.s).toBeLessThan(rustKept.s * 0.6)
    // Tier 4's gold is 61 % saturated: nothing near the play comes close.
    expect(goldNear.s).toBeLessThan(0.25)
    expect(rustNear.s).toBeLessThan(0.25)
  })
  it('turns a near tree’s reds and golds to ochre and olive, saturation kept', () => {
    const [rustNear, rustKept, amberNear, amberKept, pine] = grade([
      ['#b4561e', ACCENT_SHIFT],
      ['#b4561e', ACCENT_KEEP],
      ['#dca238', ACCENT_SHIFT],
      ['#dca238', ACCENT_KEEP],
      ['#2a8656', ACCENT_SHIFT],
    ])
    for (const [near, kept] of [[rustNear, rustKept], [amberNear, amberKept]]) {
      expect(near.h).toBeGreaterThanOrEqual(70)
      expect(near.h).toBeLessThanOrEqual(95)
      expect(near.s).toBeGreaterThan(kept.s * 0.85)
    }
    // A green outside the tiers' arc keeps its hue.
    expect(pine.h).toBeGreaterThan(130)
  })
  it('keeps the snow’s cool white near the play (no tier wears it)', () => {
    const [snow] = grade([['#e0e9f6', ACCENT_PAINT]])
    expect(snow.h).toBeGreaterThan(180)
    expect(snow.h).toBeLessThan(250)
  })
  it('lays the harvest’s straw outside tier 4’s gold', () => {
    for (const c of FIELD_SEASONS.spice.cover!.colors) {
      const { h } = hsl(...hex(c))
      expect(h).toBeGreaterThan(68)
      expect(h).toBeLessThan(90)
    }
  })
})
