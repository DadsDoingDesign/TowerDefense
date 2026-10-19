import { beforeEach, describe, expect, it } from 'vitest'
import {
  ALL_BANNER_SHAPES,
  ALL_CHARGE_IDS,
  ALL_METAL_IDS,
  ALL_PATTERNS,
  BANNER_SHAPES,
  CHARGE_IDS,
  CHARGES,
  COLOUR_PAIRS,
  isBannerShape,
  isCharge,
  isMetal,
  isPattern,
  isTincture,
  METAL_IDS,
  PATTERNS,
  TINCTURE_IDS,
} from '../src/game/data/banner'
import { COMPANIES, COMPANY_IDS, COMPANY_LOGOS, type CompanyId } from '../src/game/data/companies'
import { COMPANY_KITS, KIT_SIZE, kitCompanyOf, kitLevelOf, kitPieceAt, kitPieceLabel, kitPiecesAt, kitPiecesBetween, type KitPiece } from '../src/game/data/companyKits'
import {
  companyStandardPalette,
  companyStandardRows,
  DEFAULT_STANDARD,
  isDefaultStandard,
  STANDARD_H,
  STANDARD_W,
  standardKey,
  type StandardLook,
} from '../src/game/data/companyStandard'
import { OUTLINE, shade } from '../src/game/data/pixelArt'
import { earnedBannerParts, liveryOf, lockedParts, readLiveries, readLivery } from '../src/game/run/livery'
import { readMilitia } from '../src/game/run/militia'
import { MAX_STANDING, standingXpToReach } from '../src/game/run/standing'
import { META_VERSION, migrateMeta, useMetaStore } from '../src/state/metaStore'

/*
 * Draft 4 § C — company flags, and your own made from any of them.
 */

/** The standard exactly as it was drawn before it could be dressed (the reference for the default look). */
function legacyStandardRows(company: CompanyId): string[] {
  const W = 19
  const H = 30
  const BOTTOM = 20
  const POINTS = [2.5, 8, 13.5]
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('.'))
  for (let y = 0; y < H; y++) {
    g[y][0] = '1'
    g[y][1] = '2'
  }
  g[0][0] = '3'
  g[0][1] = '3'
  const inCloth = (x: number, y: number) => {
    if (x < 2 || x >= W || y < 1) return false
    if (y <= BOTTOM) return true
    const d = Math.min(...POINTS.map((p) => Math.abs(x - 2 - p)))
    return d <= (BOTTOM + 3 - y) * 1.1
  }
  for (let y = 1; y < H; y++) for (let x = 2; x < W; x++) if (inCloth(x, y)) g[y][x] = '4'
  for (let y = 1; y < H; y++)
    for (let x = 2; x < W; x++) {
      if (g[y][x] !== '4') continue
      if (!inCloth(x, y - 1) || !inCloth(x, y + 1) || !inCloth(x + 1, y)) g[y][x] = '5'
    }
  // The logo's patch (the marks critique, Oct 2026 — a deliberate change to
  // the plain standard): cloth one cell round the logo, in a deeper dye.
  const logo = COMPANY_LOGOS[company].rows
  const logoAt = (x: number, y: number) => (logo[y - 3]?.[x - 3] ?? '.') !== '.'
  for (let y = 1; y < H; y++)
    for (let x = 2; x < W; x++) {
      if (g[y][x] !== '4') continue
      let near = false
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && logoAt(x + dx, y + dy)) near = true
      if (near) g[y][x] = '8'
    }
  COMPANY_LOGOS[company].rows.forEach((row, j) =>
    row.split('').forEach((ch, i) => {
      if (ch !== '.') g[3 + j][3 + i] = ch
    }),
  )
  return g.map((r) => r.join(''))
}

const valueOf = (p: KitPiece): string => p.id

describe('each company’s kit', () => {
  it('ten pieces in its own taste: two colours, two cuts, two patterns, three emblems, one trim', () => {
    for (const c of COMPANY_IDS) {
      const kit = COMPANY_KITS[c]
      expect(kit, c).toHaveLength(KIT_SIZE)
      const count = (k: KitPiece['kind']) => kit.filter((p) => p.kind === k).length
      expect([count('colour'), count('cut'), count('pattern'), count('emblem'), count('trim')], c).toEqual([2, 2, 2, 3, 1])
      // Every piece is a real part, and none is the plain standard's own.
      for (const p of kit) {
        const ok = { colour: isTincture, cut: isBannerShape, pattern: isPattern, emblem: isCharge, trim: isMetal }[p.kind](p.id)
        expect(ok, `${c} ${p.kind} ${p.id}`).toBe(true)
        expect(p.id).not.toBe({ colour: null, cut: DEFAULT_STANDARD.cut, pattern: 'plain', emblem: 'none', trim: null }[p.kind])
        if (p.kind === 'colour') {
          expect(p.pair[0]).not.toBe(p.pair[1])
          expect(p.pair).toContain(p.id)
        }
      }
    }
  })

  it('a piece belongs to one company only, so a militia option names where it came from', () => {
    const seen = new Map<string, CompanyId>()
    for (const c of COMPANY_IDS)
      for (const p of COMPANY_KITS[c]) {
        const key = `${p.kind}:${valueOf(p)}`
        expect(seen.get(key), key).toBeUndefined()
        seen.set(key, c)
        expect(kitCompanyOf(p.kind, p.id)).toBe(c)
      }
    // A base piece is no company's.
    expect(kitCompanyOf('emblem', 'keep')).toBeNull()
  })

  it('the companies’ colours, emblems, cuts and patterns are new: none is in the base set', () => {
    for (const c of COMPANY_IDS)
      for (const p of COMPANY_KITS[c]) {
        if (p.kind === 'colour') expect(COLOUR_PAIRS.flat(), p.id).not.toContain(p.id)
        if (p.kind === 'emblem') expect(CHARGE_IDS, p.id).not.toContain(p.id)
        if (p.kind === 'trim') expect(METAL_IDS, p.id).not.toContain(p.id)
      }
    // Every part a kit adds is in the full lists a save may hold.
    for (const c of COMPANY_IDS)
      for (const p of COMPANY_KITS[c]) {
        const list: readonly string[] = { colour: TINCTURE_IDS, cut: ALL_BANNER_SHAPES, pattern: ALL_PATTERNS, emblem: ALL_CHARGE_IDS, trim: ALL_METAL_IDS }[p.kind]
        expect(list).toContain(p.id)
      }
  })
})

describe('the unlock order: one piece at every standing level', () => {
  it('standing s owns the first s pieces, in order; none below 1, all ten from 10', () => {
    for (const c of COMPANY_IDS) {
      expect(kitPiecesAt(c, 0)).toEqual([])
      expect(kitPiecesAt(c, -3)).toEqual([])
      expect(kitPiecesAt(c, NaN)).toEqual([])
      for (let s = 1; s <= KIT_SIZE; s++) {
        expect(kitPiecesAt(c, s)).toHaveLength(s)
        expect(kitPiecesAt(c, s)[s - 1]).toEqual(kitPieceAt(c, s))
        expect(kitLevelOf(c, kitPieceAt(c, s)!.kind, kitPieceAt(c, s)!.id)).toBe(s)
      }
      expect(kitPiecesAt(c, MAX_STANDING)).toHaveLength(KIT_SIZE)
      // A longer track later still owns the whole kit, and nothing more.
      expect(kitPiecesAt(c, 25)).toHaveLength(KIT_SIZE)
      expect(kitPieceAt(c, 0)).toBeNull()
      expect(kitPieceAt(c, KIT_SIZE + 1)).toBeNull()
    }
  })

  it('every kit opens with a pattern: a standing-1 standard is already visibly dressed', () => {
    for (const c of COMPANY_IDS) expect(kitPieceAt(c, 1)!.kind, c).toBe('pattern')
  })

  it('a settle that crosses levels names each piece once, with its level', () => {
    expect(kitPiecesBetween('metals', 2, 5).map((x) => x.level)).toEqual([3, 4, 5])
    expect(kitPiecesBetween('metals', 4, 4)).toEqual([])
    expect(kitPiecesBetween('metals', 9, 12).map((x) => x.level)).toEqual([10])
    expect(kitPiecesBetween('metals', 1, 2).map((x) => kitPieceLabel(x.piece))).toEqual(['Cobalt'])
    expect(kitPieceLabel({ kind: 'cut', id: 'battled' })).toBe('Battled cut')
    expect(kitPieceLabel({ kind: 'trim', id: 'copper' })).toBe('Copper trim')
  })
})

describe('the company standard, dressed', () => {
  it('the plain look is the standard exactly as it was: the same pixels, the same colours', () => {
    for (const co of COMPANIES) {
      const want = legacyStandardRows(co.id)
      expect(companyStandardRows(co.id)).toEqual(want)
      expect(companyStandardRows(co.id, DEFAULT_STANDARD)).toEqual(want)
      expect(companyStandardRows(co.id, null)).toEqual(want)
      const pal = companyStandardPalette(co.id, DEFAULT_STANDARD)
      expect(pal['1']).toBe(OUTLINE)
      expect(pal['4']).toBe(co.color)
      expect(pal['5']).toBe(shade(co.color, -0.35))
    }
  })

  it('every piece of every kit draws inside the box, with the logo whole and the cloth in the company’s colour', () => {
    for (const co of COMPANIES) {
      const kit = COMPANY_KITS[co.id]
      const looks: StandardLook[] = [DEFAULT_STANDARD]
      for (const p of kit) {
        const l: StandardLook = { ...DEFAULT_STANDARD }
        if (p.kind === 'cut') l.cut = p.id
        if (p.kind === 'pattern') l.pattern = p.id
        if (p.kind === 'colour') l.tincture2 = p.id
        if (p.kind === 'emblem') l.charge = p.id
        if (p.kind === 'trim') l.trim = p.id
        looks.push(l)
      }
      // And everything at once, the second of each.
      const at = (k: KitPiece['kind'], i: number) => kit.filter((p) => p.kind === k)[i]?.id
      looks.push({ cut: at('cut', 1) as never, pattern: at('pattern', 1) as never, tincture2: at('colour', 1) as never, charge: at('emblem', 2) as never, trim: at('trim', 0) as never })
      for (const look of looks) {
        const rows = companyStandardRows(co.id, look)
        const pal = companyStandardPalette(co.id, look)
        expect(rows).toHaveLength(STANDARD_H)
        for (const r of rows) expect(r).toHaveLength(STANDARD_W)
        expect(pal['4']).toBe(co.color)
        for (const k of new Set(rows.join('').replace(/\./g, ''))) expect(pal[k], `${co.id} ${standardKey(look)} key ${k}`).toBeDefined()
        // The logo stays, every cell of it, whatever the dress.
        COMPANY_LOGOS[co.id].rows.forEach((row, j) =>
          row.split('').forEach((ch, i) => {
            if (ch !== '.') expect(rows[3 + j][3 + i]).toBe(ch)
          }),
        )
        // The emblem lands whole under the logo.
        if (look.charge !== 'none') {
          const want = CHARGES[look.charge].join('').split('p').length - 1
          const got = rows
            .slice(20, 25)
            .map((r) => r.slice(8, 13))
            .join('')
            .split('7').length - 1
          expect(got, `${co.id} ${look.charge}`).toBe(want)
        }
        // A pattern shows its colour on the cloth.
        if (look.pattern !== 'plain') expect(rows.join(''), `${co.id} ${look.pattern}`).toContain('6')
      }
      // Each dressed part changes the flag.
      expect(new Set(looks.map((l) => companyStandardRows(co.id, l).join('') + JSON.stringify(companyStandardPalette(co.id, l)))).size).toBe(looks.length)
    }
  })

  it('a cache key per look', () => {
    expect(standardKey(DEFAULT_STANDARD)).toBe(standardKey(null))
    expect(isDefaultStandard({})).toBe(true)
    expect(standardKey({ ...DEFAULT_STANDARD, trim: 'copper' })).not.toBe(standardKey(DEFAULT_STANDARD))
  })
})

describe('liveries: the standards you dressed, validated against your standing', () => {
  const dressed: StandardLook = { cut: 'flame', pattern: 'bend', tincture2: 'saffron', charge: 'chili', trim: 'copper' }
  it('a look the kit has unlocked is kept; a piece not unlocked yet falls back to the plain part', () => {
    expect(readLivery('spice', dressed, 10)).toEqual(dressed)
    expect(readLivery('spice', dressed, 5)).toEqual(dressed)
    // Standing 3: the pattern, the colour and the cut; no emblem, no trim.
    expect(readLivery('spice', dressed, 3)).toEqual({ ...dressed, charge: 'none', trim: null })
    expect(readLivery('spice', dressed, 0)).toEqual(DEFAULT_STANDARD)
    expect(lockedParts('spice', 3, dressed)).toEqual(['emblem', 'trim'])
    expect(lockedParts('spice', 5, dressed)).toEqual([])
  })
  it('another company’s piece is never worn, and junk is the plain standard', () => {
    expect(readLivery('metals', dressed, 10)).toEqual(DEFAULT_STANDARD)
    for (const bad of [null, 1, 'x', [], { cut: 7, pattern: 'zigzag', tincture2: '#fff', charge: {}, trim: 'mithril' }]) expect(readLivery('spice', bad, 10)).toEqual(DEFAULT_STANDARD)
  })
  it('the save keeps only the companies you dressed, each read at its own standing', () => {
    const at = { spice: 10, art: 0, metals: 2, silk: 0, scrolls: 0 } as Record<CompanyId, number>
    const read = readLiveries({ spice: dressed, metals: { ...DEFAULT_STANDARD, pattern: 'barry', tincture2: 'cobalt', cut: 'battled' }, art: { pattern: 'checky' }, nope: dressed }, (c) => at[c])
    expect(read).toEqual({ spice: dressed, metals: { ...DEFAULT_STANDARD, pattern: 'barry', tincture2: 'cobalt' } })
    expect(readLiveries('x', () => 10)).toEqual({})
    expect(liveryOf(read, 'art')).toEqual(DEFAULT_STANDARD)
    expect(liveryOf(read, 'spice')).toEqual(dressed)
  })
})

describe('the meta save carries the liveries (v12)', () => {
  beforeEach(() => useMetaStore.getState().resetMeta())
  const xpFor = (s: number) => standingXpToReach(s)

  it('an older save has none; a current one is validated against the standing it holds', () => {
    expect(META_VERSION).toBeGreaterThanOrEqual(12)
    expect(migrateMeta({ bank: 200 }, 11).liveries).toEqual({})
    const m = migrateMeta({ standing: { spice: xpFor(4) }, liveries: { spice: { cut: 'flame', pattern: 'bend', tincture2: 'saffron', charge: 'chili', trim: 'copper' } } }, META_VERSION)
    expect(m.liveries).toEqual({ spice: { cut: 'flame', pattern: 'bend', tincture2: 'saffron', charge: 'chili', trim: null } })
    expect(migrateMeta({ liveries: { spice: { pattern: 'bend' } } }, META_VERSION).liveries).toEqual({})
  })

  it('setLivery keeps what your standing allows, and a plain look clears the entry', () => {
    useMetaStore.setState({ standing: { spice: xpFor(2), art: 0, metals: 0, silk: 0, scrolls: 0 } })
    useMetaStore.getState().setLivery('spice', { cut: 'flame', pattern: 'bend', tincture2: 'saffron', charge: 'none', trim: null })
    expect(useMetaStore.getState().liveries).toEqual({ spice: { ...DEFAULT_STANDARD, pattern: 'bend', tincture2: 'saffron' } })
    useMetaStore.getState().setLivery('spice', DEFAULT_STANDARD)
    expect(useMetaStore.getState().liveries).toEqual({})
  })
})

describe('your own militia mixes them', () => {
  it('the builder offers the base set, then every earned piece marked with its company', () => {
    const none = earnedBannerParts(() => 0)
    expect(none.shapes.map((o) => o.id)).toEqual([...BANNER_SHAPES])
    expect(none.patterns.map((o) => o.id)).toEqual([...PATTERNS])
    expect(none.charges.map((o) => o.id)).toEqual([...CHARGE_IDS])
    expect(none.metals.map((o) => o.id)).toEqual([...METAL_IDS])
    expect(none.pairs).toHaveLength(COLOUR_PAIRS.length)
    for (const list of [none.shapes, none.patterns, none.charges, none.metals, none.pairs]) for (const o of list) expect(o.company).toBeNull()

    const at: Record<CompanyId, number> = { spice: 4, art: 1, metals: 10, silk: 0, scrolls: 0 }
    const some = earnedBannerParts((c) => at[c])
    // Peppercorn at 4: Diagonal (a base pattern, so not twice), Saffron, Flame, Chili.
    expect(some.shapes.find((o) => o.id === 'flame')?.company).toBe('spice')
    expect(some.charges.find((o) => o.id === 'chili')?.company).toBe('spice')
    expect(some.pairs.find((o) => o.id === 'spice:saffron')?.pair).toEqual(['sable', 'saffron'])
    expect(some.charges.find((o) => o.id === 'flame')).toBeUndefined()
    // Butcherblock at 1: its chequers (a chopping block's end grain).
    expect(some.patterns.find((o) => o.id === 'checky')?.company).toBe('art')
    // Ironvein at 10: everything, the shield cut already a base shape.
    for (const id of ['pick', 'anvil', 'gem'] as const) expect(some.charges.find((o) => o.id === id)?.company).toBe('metals')
    expect(some.metals.find((o) => o.id === 'bronze')?.company).toBe('metals')
    expect(some.shapes.filter((o) => o.id === 'shield')).toHaveLength(1)
    expect(some.shapes.find((o) => o.id === 'shield')?.company).toBeNull()
    // Nothing from a company you have no standing with.
    expect(some.charges.some((o) => o.company === 'silk' || o.company === 'scrolls')).toBe(false)
    // No option twice.
    for (const list of [some.shapes, some.patterns, some.charges, some.metals, some.pairs]) expect(new Set(list.map((o) => o.id)).size).toBe(list.length)
  })

  it('a militia flying company pieces loads whole', () => {
    const mixed = { name: 'The Ashford Company', shape: 'crescent', tincture: 'saffron', tincture2: 'cobalt', pattern: 'checky', charge: 'anvil', metal: 'verdigris' }
    expect(readMilitia(mixed)).toEqual(mixed)
    expect(migrateMeta({ militia: mixed }, META_VERSION).militia).toEqual(mixed)
    for (const c of COMPANY_IDS)
      for (const p of COMPANY_KITS[c]) {
        const m = { name: 'The Ashford Company', shape: 'square', tincture: 'navy', charge: 'keep', pattern: 'plain', tincture2: 'sable', metal: 'parchment' } as Record<string, string>
        if (p.kind === 'cut') m.shape = p.id
        if (p.kind === 'pattern') m.pattern = p.id
        if (p.kind === 'colour') [m.tincture, m.tincture2] = p.pair
        if (p.kind === 'emblem') m.charge = p.id
        if (p.kind === 'trim') m.metal = p.id
        expect(readMilitia(m), `${c} ${p.kind} ${p.id}`).toEqual(m)
      }
  })
})
