/**
 * ---------------------------------------------------------------------------
 * The company UI themes (Oct 2026)
 * ---------------------------------------------------------------------------
 *
 * The designer: "i want allll of the ui to re-theme to the company you chose"
 * and "in the start when you click into a company the ui is themed and when
 * you run with that team you get that ui the rest of the run".
 *
 * A theme is a whole set of the design tokens `src/styles/global.css` defines
 * on `:root` — the grounds (`--bg` … `--panel-3`), the glass over the trade
 * map, the parchment washes, the lines, the text ramp, the accent and its text,
 * the primary CTA's fill, ink and edge, the shade the dark washes are mixed
 * from and the page's glow — so every screen re-themes through the tokens it
 * already reads, with no per-component edits. `neutral` is the house look:
 * EXACTLY the `:root` values (held by `tests/companyThemes.test.ts`), so it
 * emits no CSS at all.
 *
 * Each company's is built from its own colour and identity:
 *   - Peppercorn Co. — spicy greens: olive grounds, its pepper-lime accent and
 *     CTA, a warm paprika glow;
 *   - Butcherblock — the smokehouse on the marsh: smoke-grey hide grounds,
 *     a bone accent, a cured-meat CTA, an ember glow and a second of mist;
 *   - Ironvein — steel blue and slate;
 *   - Rosethread — rose and silk: wine grounds, rose accent, a pale sheen;
 *   - Greenvial — the glasshouse: bottle-green grounds, a jade accent and
 *     CTA, a faint glow of spores.
 *
 * What a theme never touches: gold (money is `--gold`, the same everywhere),
 * the rarity ramp, the archetype hues, the company hues (`--co-*`), the danger
 * and good colours, the parchment voice and the map's wood — and nothing drawn
 * on a canvas. It changes colours, never boxes.
 *
 * Applied as `:root[data-co-theme='<id>']` (`useCompanyTheme`), which outranks
 * `:root`; under high contrast `:root[data-co-theme][data-contrast='high']`
 * applies the theme's lifted ramp ({@link highContrast}), so high contrast
 * always wins and is never dimmer than the theme. The colour-vision modes
 * re-tint only tokens a theme does not set, so they compose with any theme.
 *
 * Pure: no DOM. `tests/companyThemes.test.ts` holds every theme's text to
 * 4.5:1 on its grounds, as `tests/contrast.test.ts` does the house look.
 */
import type { CompanyId } from '../../game/data/companies'
import { THEME_IDS, type ThemeId } from '../../game/run/militiaTheme'

export { THEME_IDS, type ThemeId }

/** The tokens a theme sets (each a `--<name>` colour on `:root`). */
export const THEME_TOKENS = [
  'bg',
  'bg-2',
  'panel',
  'panel-2',
  'panel-3',
  'line',
  'line-strong',
  'rule',
  'text',
  'muted',
  'muted-2',
  'dim',
  'accent',
  'accent-dim',
  'accent-text',
  'ink-on-fill',
  'cta',
  'cta-ink',
  'cta-edge',
  'surface',
  'surface-strong',
  'glass',
  'glass-strong',
  'night',
  'shade',
  'glow',
  'glow-2',
  'plate',
  'plate-on',
  'plate-rim',
  'plate-ink',
] as const
export type ThemeToken = (typeof THEME_TOKENS)[number]

export interface UiTheme {
  id: ThemeId
  /** What the picker calls it: "Ironvein steel". */
  name: string
  tokens: Readonly<Record<ThemeToken, string>>
}

const theme = (id: ThemeId, name: string, tokens: Record<ThemeToken, string>): UiTheme => ({ id, name, tokens })

/** The house look: global.css's `:root`, value for value. */
const NEUTRAL = theme('neutral', 'Lantern wood', {
  bg: '#201711',
  'bg-2': '#2a1f16',
  panel: '#2f2418',
  'panel-2': '#3a2c1c',
  'panel-3': '#46331f',
  line: 'rgba(233, 205, 150, 0.12)',
  'line-strong': 'rgba(233, 205, 150, 0.22)',
  rule: '#e9cd96',
  text: '#f3e7d0',
  muted: '#d4c0a0',
  'muted-2': '#ccb694',
  dim: '#b9a17f',
  accent: '#e0ac4c',
  'accent-dim': 'rgba(224, 172, 76, 0.16)',
  'accent-text': '#f0c46a',
  'ink-on-fill': '#1b1409',
  cta: '#57a2b6',
  'cta-ink': '#1b1409',
  'cta-edge': '#86c6d6',
  surface: 'rgba(220, 205, 172, 0.08)',
  'surface-strong': 'rgba(220, 205, 172, 0.14)',
  glass: 'rgba(20, 15, 10, 0.84)',
  'glass-strong': 'rgba(20, 15, 10, 0.92)',
  night: '#17110c',
  shade: '#140e08',
  glow: 'rgba(224, 172, 76, 0.06)',
  'glow-2': 'rgba(0, 0, 0, 0)',
  plate: '#6b4526',
  'plate-on': '#7d5330',
  'plate-rim': '#2e1c0e',
  'plate-ink': '#f6e8cc',
})

const COMPANY_THEMES: Record<CompanyId, UiTheme> = {
  // Peppercorn Co.: olive and pepper-lime, warmed by a paprika glow.
  spice: theme('spice', 'Peppercorn green', {
    bg: '#15190f',
    'bg-2': '#1b2013',
    panel: '#202616',
    'panel-2': '#282f1d',
    'panel-3': '#313923',
    line: 'rgba(214, 232, 160, 0.13)',
    'line-strong': 'rgba(214, 232, 160, 0.24)',
    rule: '#d6e8a0',
    text: '#f0f3dc',
    muted: '#cfd7ad',
    'muted-2': '#c3cd9f',
    dim: '#abb687',
    accent: '#c6e05a',
    'accent-dim': 'rgba(198, 224, 90, 0.16)',
    'accent-text': '#d4ea7c',
    'ink-on-fill': '#141a06',
    cta: '#a9c548',
    'cta-ink': '#141a06',
    'cta-edge': '#cfe48a',
    surface: 'rgba(214, 228, 168, 0.08)',
    'surface-strong': 'rgba(214, 228, 168, 0.13)',
    glass: 'rgba(14, 17, 9, 0.84)',
    'glass-strong': 'rgba(14, 17, 9, 0.92)',
    night: '#12160c',
    shade: '#0e1108',
    glow: 'rgba(232, 120, 58, 0.1)',
    'glow-2': 'rgba(198, 224, 90, 0.05)',
    plate: '#4c5724',
    'plate-on': '#5a672b',
    'plate-rim': '#1a200a',
    'plate-ink': '#f4f6dc',
  }),
  // Butcherblock: smoke-grey hide grounds, bone, a cured-meat CTA; an ember
  // in the smokehouse and the marsh mist behind it.
  art: theme('art', 'Butcherblock smoke', {
    bg: '#191514',
    'bg-2': '#201b19',
    panel: '#25201d',
    'panel-2': '#2f2925',
    'panel-3': '#3a322d',
    line: 'rgba(226, 210, 180, 0.13)',
    'line-strong': 'rgba(226, 210, 180, 0.24)',
    rule: '#e2d2b4',
    text: '#f2ece2',
    muted: '#d6cbbb',
    'muted-2': '#cbbfad',
    dim: '#b3a692',
    accent: '#e3cfa6',
    'accent-dim': 'rgba(227, 207, 166, 0.16)',
    'accent-text': '#ecdcbc',
    'ink-on-fill': '#1f150c',
    cta: '#e08a7c',
    'cta-ink': '#200c08',
    'cta-edge': '#f2b6aa',
    surface: 'rgba(226, 214, 196, 0.08)',
    'surface-strong': 'rgba(226, 214, 196, 0.14)',
    glass: 'rgba(15, 12, 11, 0.84)',
    'glass-strong': 'rgba(15, 12, 11, 0.92)',
    night: '#141110',
    shade: '#100d0c',
    glow: 'rgba(224, 138, 124, 0.08)',
    'glow-2': 'rgba(176, 196, 184, 0.06)',
    plate: '#5a4636',
    'plate-on': '#6a5240',
    'plate-rim': '#1e140e',
    'plate-ink': '#f6eee2',
  }),
  // Ironvein: slate grounds and steel blue.
  metals: theme('metals', 'Ironvein steel', {
    bg: '#121821',
    'bg-2': '#18202b',
    panel: '#1c2531',
    'panel-2': '#242f3d',
    'panel-3': '#2b3747',
    line: 'rgba(176, 202, 236, 0.13)',
    'line-strong': 'rgba(176, 202, 236, 0.24)',
    rule: '#b0caec',
    text: '#e8eef6',
    muted: '#bfccdc',
    'muted-2': '#b2c1d4',
    dim: '#9aadc4',
    accent: '#94b6f1',
    'accent-dim': 'rgba(148, 182, 241, 0.16)',
    'accent-text': '#a9c3f4',
    'ink-on-fill': '#0b1220',
    cta: '#739de8',
    'cta-ink': '#0b1220',
    'cta-edge': '#a8c4f4',
    surface: 'rgba(190, 210, 236, 0.08)',
    'surface-strong': 'rgba(190, 210, 236, 0.14)',
    glass: 'rgba(11, 15, 21, 0.84)',
    'glass-strong': 'rgba(11, 15, 21, 0.92)',
    night: '#0e131a',
    shade: '#0b1018',
    glow: 'rgba(134, 170, 238, 0.08)',
    'glow-2': 'rgba(200, 214, 232, 0.04)',
    plate: '#3e4e63',
    'plate-on': '#4a5c74',
    'plate-rim': '#131a25',
    'plate-ink': '#eef3fa',
  }),
  // Rosethread: wine grounds, rose accent, a pale silk sheen.
  silk: theme('silk', 'Rosethread rose', {
    bg: '#1f1418',
    'bg-2': '#281a20',
    panel: '#2d1e25',
    'panel-2': '#39262f',
    'panel-3': '#452e39',
    line: 'rgba(244, 200, 216, 0.13)',
    'line-strong': 'rgba(244, 200, 216, 0.24)',
    rule: '#f4c8d8',
    text: '#fbecf1',
    muted: '#e3c7d1',
    'muted-2': '#d9b9c5',
    dim: '#c2a0ad',
    accent: '#eaa9c0',
    'accent-dim': 'rgba(234, 169, 192, 0.16)',
    'accent-text': '#f3c0d2',
    'ink-on-fill': '#250d17',
    cta: '#e39ab5',
    'cta-ink': '#250d17',
    'cta-edge': '#f5c8d8',
    surface: 'rgba(242, 212, 222, 0.08)',
    'surface-strong': 'rgba(242, 212, 222, 0.14)',
    glass: 'rgba(22, 13, 17, 0.84)',
    'glass-strong': 'rgba(22, 13, 17, 0.92)',
    night: '#1a1014',
    shade: '#160c11',
    glow: 'rgba(234, 169, 192, 0.09)',
    'glow-2': 'rgba(255, 236, 222, 0.05)',
    plate: '#6e3a4c',
    'plate-on': '#80455a',
    'plate-rim': '#2a1119',
    'plate-ink': '#fcecf2',
  }),
  // Greenvial: the glasshouse — bottle-green grounds, jade, a glow of spores.
  scrolls: theme('scrolls', 'Greenvial glass', {
    bg: '#0f1915',
    'bg-2': '#13201b',
    panel: '#172620',
    'panel-2': '#1c2d27',
    'panel-3': '#263b33',
    line: 'rgba(184, 230, 210, 0.13)',
    'line-strong': 'rgba(184, 230, 210, 0.24)',
    rule: '#b8e6d2',
    text: '#eaf6f0',
    muted: '#c2dccf',
    'muted-2': '#b4d0c2',
    dim: '#9bb8aa',
    accent: '#7fe0c4',
    'accent-dim': 'rgba(127, 224, 196, 0.16)',
    'accent-text': '#a2ead4',
    'ink-on-fill': '#06201a',
    cta: '#4cc49e',
    'cta-ink': '#06201a',
    'cta-edge': '#98e6cc',
    surface: 'rgba(196, 236, 220, 0.08)',
    'surface-strong': 'rgba(196, 236, 220, 0.14)',
    glass: 'rgba(9, 16, 13, 0.84)',
    'glass-strong': 'rgba(9, 16, 13, 0.92)',
    night: '#0c1411',
    shade: '#09110e',
    glow: 'rgba(127, 224, 196, 0.08)',
    'glow-2': 'rgba(216, 255, 122, 0.05)',
    plate: '#2c5a4a',
    'plate-on': '#346a57',
    'plate-rim': '#0b1f18',
    'plate-ink': '#eefaf4',
  }),
}

/** Every theme by id. */
export const UI_THEMES: Readonly<Record<ThemeId, UiTheme>> = { neutral: NEUTRAL, ...COMPANY_THEMES }

export const uiTheme = (id: ThemeId): UiTheme => UI_THEMES[id] ?? NEUTRAL

// ---------------------------------------------------------------------------
// Colour arithmetic (no DOM)
// ---------------------------------------------------------------------------

export type RGBA = { r: number; g: number; b: number; a: number }

/** `#rrggbb` or `rgba(r, g, b, a)` → channels. */
export function parseColor(c: string): RGBA {
  const h = c.trim().match(/^#([0-9a-f]{6})$/i)
  if (h) {
    const v = h[1]
    return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16), a: 1 }
  }
  const m = c.match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/)
  if (!m) throw new Error(`not a theme colour: ${c}`)
  return { r: +m[1], g: +m[2], b: +m[3], a: +m[4] }
}

const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')
const toHex = (c: RGBA) => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`

/** `a` mixed `t` of the way to `b` (opaque). */
export function mix(a: string, b: string, t: number): string {
  const x = parseColor(a)
  const y = parseColor(b)
  return toHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t, a: 1 })
}

const withAlpha = (c: string, a: number): string => {
  const x = parseColor(c)
  return `rgba(${x.r}, ${x.g}, ${x.b}, ${a})`
}

/**
 * A theme's high-contrast ramp: the same hues, the text lifted toward white,
 * the lines heavier, the two working panels sunk, the accent and the CTA
 * brighter and the CTA's ink darker — the moves `:root[data-contrast='high']`
 * makes to the house look, so high contrast is never dimmer than the theme.
 */
export function highContrast(t: UiTheme): Partial<Record<ThemeToken, string>> {
  const k = t.tokens
  return {
    text: mix(k.text, '#ffffff', 0.6),
    muted: mix(k.muted, '#ffffff', 0.3),
    'muted-2': mix(k['muted-2'], '#ffffff', 0.3),
    dim: mix(k.dim, '#ffffff', 0.15),
    line: withAlpha(k.line, 0.3),
    'line-strong': withAlpha(k['line-strong'], 0.5),
    panel: mix(k.panel, '#000000', 0.22),
    'panel-2': mix(k['panel-2'], '#000000', 0.18),
    accent: mix(k.accent, '#ffffff', 0.2),
    'accent-text': mix(k['accent-text'], '#ffffff', 0.2),
    cta: mix(k.cta, '#ffffff', 0.2),
    'cta-ink': mix(k['cta-ink'], '#000000', 0.4),
  }
}

// ---------------------------------------------------------------------------
// The stylesheet
// ---------------------------------------------------------------------------

const decls = (tokens: Partial<Record<ThemeToken, string>>): string =>
  THEME_TOKENS.filter((n) => tokens[n] != null)
    .map((n) => `--${n}:${tokens[n]};`)
    .join('')

/** How long a re-theme takes: one easing of every token at once. */
export const THEME_EASE_MS = 420

/**
 * The CSS every theme needs, generated from the table so the table is the
 * one source: each token registered as a `<color>` (so a change of theme
 * EASES — a registered property transitions, a plain one snaps), the root's
 * transition of them, and one block per company theme plus its high-contrast
 * block. Reduced motion already kills every transition (`app.css`).
 */
export function themeCss(): string {
  const reg = THEME_TOKENS.map((n) => `@property --${n}{syntax:'<color>';inherits:true;initial-value:${NEUTRAL.tokens[n]};}`).join('\n')
  const ease = `:root{transition:${THEME_TOKENS.map((n) => `--${n} ${THEME_EASE_MS}ms ease`).join(',')};}`
  const blocks = THEME_IDS.filter((id) => id !== 'neutral')
    .map((id) => {
      const t = UI_THEMES[id]
      return `:root[data-co-theme='${id}']{${decls(t.tokens)}}\n:root[data-co-theme='${id}'][data-contrast='high']{${decls(highContrast(t))}}`
    })
    .join('\n')
  return `${reg}\n${ease}\n@media (prefers-reduced-motion: reduce){:root{transition:none;}}\n${blocks}\n`
}

// ---------------------------------------------------------------------------
// Which theme is on
// ---------------------------------------------------------------------------

/** What decides the theme: the run (if one is on) and, at home, the focus. */
export interface ThemeFacts {
  /** The game store's screen. */
  screen: 'hub' | 'contracts' | 'heroPick' | 'map' | 'crossroads' | 'battle'
  /** The contract board, while the terms are open. */
  board: { company: CompanyId } | null
  /** The run's contract (kept through its result). */
  contract: { company: CompanyId | null; charter?: boolean } | null
  /** The home's focus: a company's road, or `'charter'` (Buy Company). */
  homeFocus: CompanyId | 'charter' | null
  /** The road the home focuses when nothing is picked (`contractSlice.homeCompany`). */
  defaultFocus: CompanyId
  /** LS3: a first launch — the home shows only the first company's road. */
  staged: boolean
  /** The first launch's company (Peppercorn's free escort). */
  firstCompany: CompanyId
  /** Your militia's chosen theme ('neutral' with no militia). */
  militia: ThemeId
  /**
   * A theme shown over everything while it is set: the militia builder's
   * try-on, or the run a boot's "Resume run" prompt offers.
   */
  preview?: ThemeId | null
}

/** The theme a contract wears: its hiring company's, or your militia's on the Sovereign Route. */
export function contractTheme(contract: { company: CompanyId | null; charter?: boolean }, militia: ThemeId): ThemeId {
  return contract.charter ? militia : (contract.company ?? 'neutral')
}

/**
 * The theme the whole UI wears now:
 *  - a run (terms through result) wears its hiring company's — your
 *    militia's on the Sovereign Route;
 *  - the home and the pages opened from it wear the focused company's (a
 *    first launch: the first company's), and Buy Company your militia's;
 *  - the militia builder wears the theme it is trying on, and the boot's
 *    "Resume run" prompt the theme of the run it offers.
 */
export function themeFor(f: ThemeFacts): ThemeId {
  if (f.preview) return f.preview
  if (f.screen !== 'hub') {
    if (f.screen === 'contracts' && f.board) return f.board.company
    if (f.contract) return contractTheme(f.contract, f.militia)
    return f.board?.company ?? 'neutral'
  }
  if (f.staged) return f.firstCompany
  const focus = f.homeFocus ?? f.defaultFocus
  return focus === 'charter' ? f.militia : focus
}
