import { describe, expect, it } from 'vitest'
import {
  BANNER_H,
  BANNER_SHAPES,
  BANNER_W,
  bannerRows,
  CHARGE_IDS,
  CHARGES,
  COLOUR_PAIRS,
  METAL_IDS,
  pairIndex,
  PATTERNS,
  SOLDIER_H,
  SOLDIER_KINDS,
  SOLDIER_W,
  soldierRows,
  TINCTURES,
} from '../src/game/data/banner'
import { COMPANIES } from '../src/game/data/companies'
import { isMilitiaName, militiaName, militiaTagline, randomBanner, readMilitia, rerollName } from '../src/game/run/militia'
import { checkCompanyName, isProfane } from '../src/game/run/nameFilter'
import { migrateMeta, META_VERSION } from '../src/state/metaStore'

/* Your militia's name and banner (build step 4). */
describe('the militia’s name', () => {
  it('the generator’s names pass its own check — and the typed-name filter', () => {
    const seen = new Set<string>()
    for (let s = 0; s < 2000; s++) {
      const n = militiaName(s)
      expect(isMilitiaName(n), n).toBe(true)
      expect(checkCompanyName(n).ok, n).toBe(true)
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

  it('the generator’s own grammar check still refuses anything it could not deal', () => {
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
  it('every shape, pattern, emblem and metal draws on a 13 × 20 pole', () => {
    for (const shape of BANNER_SHAPES) {
      for (const charge of CHARGE_IDS) {
        const rows = bannerRows({ shape, charge, tincture: 'navy' })
        expect(rows).toHaveLength(BANNER_H)
        expect(rows.every((r) => r.length === BANNER_W)).toBe(true)
        const all = rows.join('')
        for (const ch of ['o', 'w', 'g', 'c', 'r']) expect(all.includes(ch), `${shape}/${charge} ${ch}`).toBe(true)
        // Every emblem but "none" shows on every shape.
        expect(all.includes('p'), `${shape}/${charge} emblem`).toBe(charge !== 'none')
      }
    }
    // Every pattern but plain puts its colour on the cloth of every shape.
    for (const shape of BANNER_SHAPES)
      for (const pattern of PATTERNS) expect(bannerRows({ shape, pattern, tincture: 'navy', charge: 'none' }).join('').includes('d'), `${shape}/${pattern}`).toBe(pattern !== 'plain')
    // The shapes are all different cloth.
    expect(new Set(BANNER_SHAPES.map((shape) => bannerRows({ shape, tincture: 'navy', charge: 'none' }).join(''))).size).toBe(BANNER_SHAPES.length)
    expect(METAL_IDS.length).toBeGreaterThanOrEqual(3)
  })

  it('a random flag never puts a pattern in its field’s own colour', () => {
    for (let s = 0; s < 300; s++) {
      const b = randomBanner(s)
      expect(b.tincture2).not.toBe(b.tincture)
      expect(b.charge).not.toBe('none')
      // The builder offers colours as pairs; a random flag flies one of them.
      expect(pairIndex(b)).toBeGreaterThanOrEqual(0)
    }
  })

  it('every emblem lands whole on every shape — none is cut off by the cloth', () => {
    for (const shape of BANNER_SHAPES) {
      for (const charge of CHARGE_IDS) {
        const want = CHARGES[charge].join('').split('p').length - 1
        const got = bannerRows({ shape, tincture: 'navy', charge }).join('').split('p').length - 1
        expect(got, `${charge} on ${shape}`).toBe(want)
      }
    }
  })

  it('the colour pairs are twelve distinct pairs of two different tinctures', () => {
    expect(COLOUR_PAIRS).toHaveLength(12)
    expect(new Set(COLOUR_PAIRS.map((p) => p.join('|'))).size).toBe(COLOUR_PAIRS.length)
    for (const [a, b] of COLOUR_PAIRS) {
      expect(a).not.toBe(b)
      expect(TINCTURES[a]).toBeDefined()
      expect(TINCTURES[b]).toBeDefined()
    }
    // A flag in two colours that are no pair (an older save's) shows none chosen.
    expect(pairIndex({ shape: 'square', tincture: 'navy', tincture2: 'navy', charge: 'none' })).toBe(-1)
  })

  it('the soldiers wear the flag: its field, its pattern on tabard and shield, its emblem', () => {
    // Three different soldiers.
    const look = { shape: 'square', tincture: 'navy', pattern: 'plain', charge: 'none' } as const
    expect(new Set(SOLDIER_KINDS.map((k) => soldierRows(look, k).join(''))).size).toBe(SOLDIER_KINDS.length)
    for (const kind of SOLDIER_KINDS) {
      const plain = soldierRows(look, kind)
      expect(plain).toHaveLength(SOLDIER_H)
      for (const r of plain) expect(r).toHaveLength(SOLDIER_W)
      const all = plain.join('')
      expect(all).toContain('c')
      expect(all).not.toContain('p')
      for (const pattern of PATTERNS.filter((p) => p !== 'plain')) {
        expect(soldierRows({ ...look, pattern }, kind).join(''), `${kind} ${pattern}`).toContain('d')
      }
      for (const charge of CHARGE_IDS.filter((c) => c !== 'none')) {
        expect(soldierRows({ ...look, charge }, kind).join(''), `${kind} ${charge}`).toContain('p')
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

describe('a typed company name', () => {
  it('takes any clean name, tidied', () => {
    expect(checkCompanyName('  The   Iron  Hounds ')).toEqual({ ok: true, name: 'The Iron Hounds' })
    for (const n of ['Rook & Rye', "O'Malley's Blades", 'Les Épées Grises', 'Company 7', 'The Spice Guard', 'Peacock Lances', 'Horsemen of Ash', 'Thorny Wardens', 'The Therapists', 'Kestrelholt Watch', 'Classic Blades'])
      expect(checkCompanyName(n).ok, n).toBe(true)
  })
  it('refuses empty, too long, odd characters and no letters — saying why', () => {
    for (const bad of ['', 'ab', 'x'.repeat(40), 'The <b> Company', '1234', 42, null]) {
      const c = checkCompanyName(bad)
      expect(c.ok, String(bad)).toBe(false)
      if (!c.ok) expect(c.why.length).toBeGreaterThan(0)
    }
  })
  it('refuses profanity through leetspeak, spacing and stretched letters, and never repeats the word', () => {
    // Built from fragments so the test file reads clean too.
    const f = 'f' + 'uck'
    const s = 'sh' + 'it'
    for (const bad of [f, `The ${f}ers`, 'F u c k'.replace('c', 'c'), `${f.replace('u', 'uuu')} co`, s.replace('i', '1') + ' Lances', `The A${'ss'} Company`, `a$${'$'} blades`, 'B1' + 'tch Guard']) {
      expect(isProfane(bad), bad).toBe(true)
      const c = checkCompanyName(bad)
      expect(c.ok).toBe(false)
      if (!c.ok) expect(c.why.toLowerCase()).not.toContain(f)
    }
  })
})

describe('the save', () => {
  const good = { name: 'The Ashford Company', shape: 'swallow', tincture: 'navy', charge: 'keep' }
  const full = { ...good, pattern: 'plain', tincture2: 'sable', metal: 'parchment' }
  it('an older save’s company loads as a plain flag in parchment', () => {
    expect(readMilitia(good)).toEqual(full)
    expect(migrateMeta({ militia: good }, META_VERSION).militia).toEqual(full)
  })
  it('a typed name and a full flag survive a load', () => {
    const typed = { name: 'Rook & Rye', shape: 'gonfalon', tincture: 'crimson', charge: 'star', pattern: 'quarterly', tincture2: 'navy', metal: 'gold' }
    expect(readMilitia(typed)).toEqual(typed)
    // An unknown newer part drops to its default rather than losing the company.
    expect(readMilitia({ ...typed, pattern: 'zigzag', metal: 'mithril' })).toMatchObject({ pattern: 'plain', metal: 'parchment' })
  })
  it('anything else loads as none', () => {
    for (const bad of [null, 'x', { ...good, name: '' }, { ...good, name: 'The ' + 'f' + 'uck Lances' }, { ...good, shape: 'kite' }, { ...good, tincture: '#ff0000' }, { ...good, charge: 1 }]) {
      expect(readMilitia(bad)).toBeNull()
      expect(migrateMeta({ militia: bad }, META_VERSION).militia).toBeNull()
    }
    expect(migrateMeta({}, 7).militia).toBeNull()
  })
})
