import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COMPANY_IDS } from '../src/game/data/companies'
import { THEME_IDS } from '../src/game/run/militiaTheme'
import { highContrast, parseColor, themeCss, themeFor, THEME_TOKENS, UI_THEMES, type ThemeFacts, type ThemeToken, type UiTheme } from '../src/ui/theme/companyThemes'

/*
 * The company UI themes (Oct 2026). Every theme re-colours the tokens the
 * shell reads, so every theme is held to what `tests/contrast.test.ts` holds
 * the house look to — text at 4.5:1 on every ground it paints, the CTA's ink
 * on its fill and its fill off the page — AND the tokens a theme does NOT
 * set (danger, teal, gold, the rarity and archetype text) still clear on the
 * theme's grounds, since they sit on them.
 */

const ROOT = resolve(import.meta.dirname, '..')
const css = readFileSync(join(ROOT, 'src/styles/global.css'), 'utf8')
const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('\n}', css.indexOf(':root {')))
const rootToken = (name: string): string => {
  const m = rootBlock.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!m) throw new Error(`--${name} is not defined in the default :root`)
  return m[1].trim()
}

type RGB = [number, number, number]
const rgb = (c: string): RGB => {
  const x = parseColor(c)
  return [x.r, x.g, x.b]
}
const over = (fg: string, bg: RGB): RGB => {
  const x = parseColor(fg)
  return [x.r, x.g, x.b].map((c, i) => Math.round(c * x.a + bg[i] * (1 - x.a))) as RGB
}
const lum = ([r, g, b]: RGB) => {
  const f = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** The grounds a theme paints, as `contrast.test.ts` measures the house look's. */
function groundsOf(k: Record<ThemeToken, string>): Record<string, RGB> {
  const panel = rgb(k.panel)
  const panel2 = rgb(k['panel-2'])
  return {
    bg: rgb(k.bg),
    'bg-2': rgb(k['bg-2']),
    panel,
    'panel-2': panel2,
    'panel-3': rgb(k['panel-3']),
    'surface over panel': over(k.surface, panel),
    'surface-strong over panel-2': over(k['surface-strong'], panel2),
    'surface twice over panel': over(k.surface, over(k.surface, panel)),
  }
}
const STRONG = 'surface-strong over panel-2'
const WHITE: RGB = [255, 255, 255]

const companyThemes = COMPANY_IDS.map((c) => UI_THEMES[c])
/** A theme's tokens with its high-contrast ramp laid over them. */
const hcOf = (t: UiTheme) => ({ ...t.tokens, ...highContrast(t) }) as Record<ThemeToken, string>

describe('the theme table', () => {
  it('has the neutral house look and one theme per company, each setting every token', () => {
    expect(THEME_IDS).toEqual(['neutral', ...COMPANY_IDS])
    for (const id of THEME_IDS) {
      expect(UI_THEMES[id].id).toBe(id)
      for (const n of THEME_TOKENS) expect(() => parseColor(UI_THEMES[id].tokens[n]), `${id} --${n}`).not.toThrow()
    }
  })

  it('neutral IS global.css’s :root, value for value — the house look is unchanged', () => {
    for (const n of THEME_TOKENS) expect(UI_THEMES.neutral.tokens[n], `--${n}`).toBe(rootToken(n))
  })

  it('every company theme is its own: no two share a ground, an accent or a CTA', () => {
    for (const n of ['panel', 'accent', 'cta'] as const) {
      const seen = new Set(THEME_IDS.map((id) => UI_THEMES[id].tokens[n]))
      expect(seen.size, `--${n}`).toBe(THEME_IDS.length)
    }
  })

  it('the stylesheet registers every token as a colour and writes a block (and a high-contrast block) per company', () => {
    const out = themeCss()
    for (const n of THEME_TOKENS) expect(out).toContain(`@property --${n}{syntax:'<color>'`)
    for (const c of COMPANY_IDS) {
      expect(out).toContain(`:root[data-co-theme='${c}']{`)
      expect(out).toContain(`:root[data-co-theme='${c}'][data-contrast='high']{`)
    }
    expect(out).not.toContain(`data-co-theme='neutral'`)
  })
})

for (const [label, read] of [
  ['', (t: UiTheme) => t.tokens as Record<ThemeToken, string>],
  [' (high contrast)', hcOf],
] as const) {
  describe(`every company theme clears WCAG AA${label}`, () => {
    for (const t of companyThemes) {
      const k = read(t)
      const g = groundsOf(k)
      it(`${t.id}: --text, --muted, --muted-2, --accent, --accent-text >= 4.5:1 on every ground`, () => {
        for (const name of ['text', 'muted', 'muted-2', 'accent', 'accent-text'] as const)
          for (const [gn, bg] of Object.entries(g)) expect(ratio(rgb(k[name]), bg), `${t.id} --${name} on ${gn}`).toBeGreaterThanOrEqual(4.5)
      })
      it(`${t.id}: --dim 4.5:1 on the opaque panels, 3:1 on the strong wash`, () => {
        for (const gn of ['bg', 'panel', 'panel-2', 'panel-3']) expect(ratio(rgb(k.dim), g[gn]), `${t.id} --dim on ${gn}`).toBeGreaterThanOrEqual(4.5)
        expect(ratio(rgb(k.dim), g[STRONG])).toBeGreaterThanOrEqual(3)
      })
      it(`${t.id}: the ramp keeps its order, text > muted > muted-2 > dim`, () => {
        const l = (n: ThemeToken) => lum(rgb(k[n]))
        expect(l('text')).toBeGreaterThan(l('muted'))
        expect(l('muted')).toBeGreaterThan(l('muted-2'))
        expect(l('muted-2')).toBeGreaterThan(l('dim'))
      })
      it(`${t.id}: the CTA's ink on its fill, and its fill off every ground, 4.5:1`, () => {
        expect(ratio(rgb(k['cta-ink']), rgb(k.cta))).toBeGreaterThanOrEqual(4.5)
        for (const gn of ['bg', 'bg-2', 'panel', 'panel-2']) expect(ratio(rgb(k.cta), g[gn]), `--cta on ${gn}`).toBeGreaterThanOrEqual(4.5)
        expect(ratio(rgb(k['ink-on-fill']), rgb(k.accent)), 'ink on a solid accent').toBeGreaterThanOrEqual(4.5)
        // The home card's desperate badge: the theme's fill ink on the danger text colour.
        expect(ratio(rgb(k['ink-on-fill']), rgb(rootToken('bad-text'))), 'ink on the desperate badge').toBeGreaterThanOrEqual(4.5)
      })
      it(`${t.id}: the home's glass over pure white still carries its text`, () => {
        for (const glass of ['glass', 'glass-strong'] as const)
          for (const name of ['text', 'muted', 'accent-text'] as const)
            expect(ratio(rgb(k[name]), over(k[glass], WHITE)), `${t.id} --${name} on --${glass}`).toBeGreaterThanOrEqual(4.5)
        for (const name of ['bad-text', 'teal-text', 'gold-text'])
          expect(ratio(rgb(rootToken(name)), over(k.glass, WHITE)), `${t.id} --${name} on --glass`).toBeGreaterThanOrEqual(4.5)
        // A locked place's charred plate: the shade at 94% (menu.css).
        const charred = parseColor(k.shade)
        const charredOverWhite = over(`rgba(${charred.r}, ${charred.g}, ${charred.b}, 0.94)`, WHITE)
        expect(ratio(rgb(k.muted), charredOverWhite), `${t.id} --muted on a charred plate`).toBeGreaterThanOrEqual(4.5)
        // The bar's carved plates, at rest and lit.
        for (const plate of ['plate', 'plate-on'] as const) expect(ratio(rgb(k['plate-ink']), rgb(k[plate])), `${t.id} --plate-ink on --${plate}`).toBeGreaterThanOrEqual(4.5)
      })
      // Danger, teal, gold and the rarity and archetype text sit on a
      // theme's grounds unchanged: each clears its bar there (4.5:1; 5:1 for
      // rarity) — or, where the house look itself is under it (the danger
      // text on the strongest wash, 3.7:1), is no worse than the house look.
      it(`${t.id}: the tokens a theme never sets still read on its grounds`, () => {
        const house = groundsOf(UI_THEMES.neutral.tokens as Record<ThemeToken, string>)
        const hold = (name: string, gn: string, bar: number) => {
          const fg = rgb(rootToken(name))
          expect(ratio(fg, g[gn]), `--${name} on ${t.id} ${gn}`).toBeGreaterThanOrEqual(Math.min(bar, ratio(fg, house[gn])))
        }
        for (const name of ['bad-text', 'teal-text', 'gold-text', 'fighter-text', 'rogue-text', 'mystic-text']) for (const gn of ['panel', 'panel-3', STRONG]) hold(name, gn, 4.5)
        for (const r of ['common', 'rare', 'epic', 'legendary', 'mythic']) for (const gn of ['panel-3', STRONG]) hold(`rarity-${r}-text`, gn, 5)
      })
    }
  })
}

describe('high contrast wins over a theme', () => {
  it('is never dimmer than the theme: every text token at least as far from its panel', () => {
    for (const t of companyThemes) {
      const hc = hcOf(t)
      for (const name of ['text', 'muted', 'muted-2', 'dim', 'accent', 'accent-text'] as const) {
        expect(ratio(rgb(hc[name]), rgb(hc.panel)), `${t.id} --${name}`).toBeGreaterThanOrEqual(ratio(rgb(t.tokens[name]), rgb(t.tokens.panel)))
      }
      expect(ratio(rgb(hc['cta-ink']), rgb(hc.cta))).toBeGreaterThanOrEqual(ratio(rgb(t.tokens['cta-ink']), rgb(t.tokens.cta)) - 0.01)
    }
  })
})

describe('which theme is on (themeFor)', () => {
  const base: ThemeFacts = {
    screen: 'hub',
    board: null,
    contract: null,
    homeFocus: null,
    defaultFocus: 'art',
    staged: false,
    firstCompany: 'spice',
    militia: 'neutral',
  }
  it('home: the focused company, else the default; Buy Company your militia’s', () => {
    expect(themeFor(base)).toBe('art')
    expect(themeFor({ ...base, homeFocus: 'metals' })).toBe('metals')
    expect(themeFor({ ...base, homeFocus: 'charter' })).toBe('neutral')
    expect(themeFor({ ...base, homeFocus: 'charter', militia: 'silk' })).toBe('silk')
  })
  it('a first launch is Peppercorn’s, whatever is focused', () => {
    expect(themeFor({ ...base, staged: true, homeFocus: 'metals' })).toBe('spice')
  })
  it('the terms wear the board’s company; a run its contract’s, through every screen and its result', () => {
    expect(themeFor({ ...base, screen: 'contracts', board: { company: 'silk' }, homeFocus: 'silk' })).toBe('silk')
    for (const screen of ['heroPick', 'map', 'crossroads', 'battle'] as const) {
      expect(themeFor({ ...base, screen, contract: { company: 'scrolls' }, homeFocus: 'metals' })).toBe('scrolls')
    }
  })
  it('the Sovereign Route wears your militia’s theme', () => {
    expect(themeFor({ ...base, screen: 'battle', contract: { company: null, charter: true }, militia: 'metals' })).toBe('metals')
    expect(themeFor({ ...base, screen: 'map', contract: { company: null, charter: true } })).toBe('neutral')
  })
  it('the builder’s try-on wins while it is open', () => {
    expect(themeFor({ ...base, homeFocus: 'charter', preview: 'art' })).toBe('art')
  })
})
