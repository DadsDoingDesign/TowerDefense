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
 *   - Easel House — painterly violet: plum grounds, lilac accent, a second
 *     ochre glow like a dab of another paint;
 *   - Ironvein — steel blue and slate;
 *   - Rosethread — rose and silk: wine grounds, rose accent, a pale sheen;
 *   - Moonquill — moonlit silver on indigo night.
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
    text: '#f0f3dc',
    muted: '#cfd7ad',
    'muted-2': '#c3cd9f',
    dim: '#abb687',
    accent: '#c6e05a',
    'accent-dim': 'rgba(198, 224, 90, 0.16)',
    'accent-text': '#d4ea7c',
    'ink-on-fill': '#141a06',
    cta: '#b4d24a',
    'cta-ink': '#141a06',
    'cta-edge': '#d8ec8e',
    surface: 'rgba(214, 228, 168, 0.08)',
    'surface-strong': 'rgba(214, 228, 168, 0.13)',
    glass: 'rgba(14, 17, 9, 0.84)',
    'glass-strong': 'rgba(14, 17, 9, 0.92)',
    night: '#12160c',
    shade: '#0e1108',
    glow: 'rgba(232, 120, 58, 0.1)',
    'glow-2': 'rgba(198, 224, 90, 0.05)',
  }),
  // Easel House: plum grounds, a lilac accent, a dab of ochre in the corner.
  art: theme('art', 'Easel violet', {
    bg: '#19141f',
    'bg-2': '#201929',
    panel: '#251d30',
    'panel-2': '#2f253d',
    'panel-3': '#3a2d4b',
    line: 'rgba(214, 196, 245, 0.13)',
    'line-strong': 'rgba(214, 196, 245, 0.24)',
    text: '#f2ecfa',
    muted: '#d4c6e6',
    'muted-2': '#c8b8de',
    dim: '#b09fc8',
    accent: '#c6a4ff',
    'accent-dim': 'rgba(198, 164, 255, 0.16)',
    'accent-text': '#d6bdff',
    'ink-on-fill': '#170c26',
    cta: '#b28cf6',
    'cta-ink': '#170c26',
    'cta-edge': '#d8c2ff',
    surface: 'rgba(218, 204, 242, 0.08)',
    'surface-strong': 'rgba(218, 204, 242, 0.14)',
    glass: 'rgba(16, 12, 22, 0.84)',
    'glass-strong': 'rgba(16, 12, 22, 0.92)',
    night: '#140f1a',
    shade: '#100b16',
    glow: 'rgba(198, 164, 255, 0.09)',
    'glow-2': 'rgba(226, 170, 90, 0.07)',
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
  }),
  // Moonquill: indigo night, moonlit silver, a periwinkle CTA.
  scrolls: theme('scrolls', 'Moonquill silver', {
    bg: '#121322',
    'bg-2': '#181a2c',
    panel: '#1c1e33',
    'panel-2': '#24273f',
    'panel-3': '#2d314c',
    line: 'rgba(206, 212, 240, 0.13)',
    'line-strong': 'rgba(206, 212, 240, 0.24)',
    text: '#eef0fa',
    muted: '#c8cce2',
    'muted-2': '#bbc0da',
    dim: '#a3a9c6',
    accent: '#d4daf2',
    'accent-dim': 'rgba(212, 218, 242, 0.16)',
    'accent-text': '#e2e6f7',
    'ink-on-fill': '#0e1030',
    cta: '#a9b7f2',
    'cta-ink': '#0e1030',
    'cta-edge': '#d0d9fa',
    surface: 'rgba(212, 218, 242, 0.08)',
    'surface-strong': 'rgba(212, 218, 242, 0.14)',
    glass: 'rgba(11, 12, 24, 0.84)',
    'glass-strong': 'rgba(11, 12, 24, 0.92)',
    night: '#0e0f1c',
    shade: '#0a0b18',
    glow: 'rgba(214, 222, 255, 0.08)',
    'glow-2': 'rgba(96, 84, 210, 0.1)',
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
  /** A theme being tried on in the militia builder, while it is open. */
  preview?: ThemeId | null
}

/**
 * The theme the whole UI wears now:
 *  - a run (terms through result) wears its hiring company's — your
 *    militia's on the Sovereign Route;
 *  - the home and the pages opened from it wear the focused company's (a
 *    first launch: the first company's), and Buy Company your militia's;
 *  - the militia builder wears the theme it is trying on.
 */
export function themeFor(f: ThemeFacts): ThemeId {
  if (f.preview) return f.preview
  if (f.screen !== 'hub') {
    if (f.screen === 'contracts' && f.board) return f.board.company
    if (f.contract) return f.contract.charter ? f.militia : (f.contract.company ?? 'neutral')
    return f.board?.company ?? 'neutral'
  }
  if (f.staged) return f.firstCompany
  const focus = f.homeFocus ?? f.defaultFocus
  return focus === 'charter' ? f.militia : focus
}
