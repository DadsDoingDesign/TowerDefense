import { describe, expect, it } from 'vitest'
import { BANNER_H, BANNER_SHAPES, BANNER_W, bannerRows, CHARGE_IDS, TINCTURES } from '../src/game/data/banner'
import { COMPANIES } from '../src/game/data/companies'
import { isMilitiaName, militiaName, militiaTagline, readMilitia, rerollName } from '../src/game/run/militia'
import { migrateMeta, META_VERSION } from '../src/state/metaStore'

/* Your militia's name and banner (build step 4). */
describe('the militia’s name', () => {
  it('is generated, never typed: every name the generator deals passes its own check', () => {
    const seen = new Set<string>()
    for (let s = 0; s < 2000; s++) {
      const n = militiaName(s)
      expect(isMilitiaName(n), n).toBe(true)
      seen.add(n)
    }
    // Plenty of variety to re-roll through.
    expect(seen.size).toBeGreaterThan(800)
  })

  it('the same seed is the same name; a re-roll never deals the name you had', () => {
    expect(militiaName(42)).toBe(militiaName(42))
    for (let s = 0; s < 200; s++) {
      const had = militiaName(s)
      expect(rerollName(s, had).name).not.toBe(had)
    }
  })

  it('free text never passes', () => {
    for (const bad of ['', 'The', 'Ashford Company', 'The Ashford', 'The Ashford Company!', 'The Bums Company', 'The Ashford <b>Company</b>', 'the ashford company', 42, null])
      expect(isMilitiaName(bad)).toBe(false)
    expect(isMilitiaName('The Ashford Company')).toBe(true)
    expect(isMilitiaName('The Grey Lances')).toBe(true)
    expect(isMilitiaName('The Oakmere Free Company')).toBe(true)
  })

  it('reads under the wordmark', () => {
    expect(militiaTagline({ name: 'The Ashford Company' })).toBe('The Ashford Company · guard the road, bank the gold')
    expect(militiaTagline(null)).toBe('Guard the road, bank the gold')
  })
})

describe('the banner', () => {
  it('every shape and mark draws on a 13 × 20 pole with cloth, rim and charge', () => {
    for (const shape of BANNER_SHAPES) {
      for (const charge of CHARGE_IDS) {
        const rows = bannerRows(shape, charge)
        expect(rows).toHaveLength(BANNER_H)
        expect(rows.every((r) => r.length === BANNER_W)).toBe(true)
        const all = rows.join('')
        for (const ch of ['o', 'w', 'g', 'c', 'r', 'p']) expect(all.includes(ch), `${shape}/${charge} ${ch}`).toBe(true)
      }
    }
  })

  it('the field colours are dark and far from every company colour (CIELAB ΔE ≥ 26)', () => {
    const lab = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      const xyz = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883]
      const f = xyz.map((t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116))
      return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])]
    }
    const dE = (a: string, b: string) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]))
    for (const t of Object.values(TINCTURES)) {
      expect(lab(t)[0], t).toBeLessThan(45)
      for (const c of COMPANIES) expect(dE(t, c.color), `${t} vs ${c.id}`).toBeGreaterThanOrEqual(26)
    }
  })
})

describe('the save', () => {
  const good = { name: 'The Ashford Company', shape: 'swallow', tincture: 'navy', charge: 'keep' }
  it('a valid militia survives a load', () => {
    expect(readMilitia(good)).toEqual(good)
    expect(migrateMeta({ militia: good }, META_VERSION).militia).toEqual(good)
  })
  it('anything else loads as none', () => {
    for (const bad of [null, 'x', { ...good, name: 'Free text' }, { ...good, shape: 'kite' }, { ...good, tincture: '#ff0000' }, { ...good, charge: 1 }]) {
      expect(readMilitia(bad)).toBeNull()
      expect(migrateMeta({ militia: bad }, META_VERSION).militia).toBeNull()
    }
    expect(migrateMeta({}, 7).militia).toBeNull()
  })
})
