/**
 * Render themes — distinct visual directions for the battle canvas + UI accent.
 * Everything is procedural so it works with no external assets; the chosen
 * direction tells us which real sprite pack to drop in later.
 *
 * The renderer reads `activeStyle`; theme previews swap it around a synchronous
 * draw. UI reskin happens via CSS variables in applyThemeCss().
 */
export type TokenShape = 'circle' | 'square' | 'ring' | 'gem'

/** When set, the theme renders real sprites from a pack (see game/render/sprites.ts). */
export interface SpriteConfig {
  pack: string
  /**
   * THE density of the pack, and the only sprite scale the renderer has (Phase
   * 3). Every asset — grass, dressing, towers, enemies — is box-filtered by this
   * factor once at load and then drawn **1:1** into the 960×560 field
   * composite, so no sprite is ever resampled per frame.
   *
   * `0.5` for Tiny Swords, whose art is authored around a 73px goblin; the
   * from-scratch `fieldwatch` pack draws native. Tier-5 champions are the one
   * exception and always draw at `1` — see the two-bucket note in `pixmap.ts`.
   */
  spriteScale: 0.5 | 1
  /**
   * @deprecated Dead since Phase 3 and kept only so a theme literal reads as a
   * complete record of what a pack used to be tuned with. Nothing reads these:
   * the renderer sizes every sprite from the art, not from a gameplay radius,
   * which is what made two heroes side by side differ in pixel density by 1.51×
   * and put a 6.30× density spread on one screen.
   */
  towerScale: number
  /** @deprecated see towerScale. */
  enemyScale: number
  /**
   * The per-role fallback chain (HANDOFF §6.4): packs to draw a role from when
   * this pack does not ship it, in order. Each role comes from the FIRST pack
   * in `[pack, ...fallback]` that ships its family, at THAT pack's density
   * (`packDensity`) — so a half-authored pack can go live role by role, and
   * a role nobody ships still falls through to the procedural token.
   */
  fallback?: readonly string[]
}

export interface ThemeStyle {
  id: string
  name: string
  blurb: string
  smoothing: boolean
  sprites?: SpriteConfig
  css: {
    accent: string
    accentDim: string
    radius: string
    bg: string
    panel?: string
    font?: string
  }
  field: { top: string; bottom: string; grid: string; gridStep: number }
  path: {
    edge: string
    fill: string
    center: string
    edgeWidth: number
    fillWidth: number
    dash: number[] | null
    cap: CanvasLineCap
  }
  token: { shape: TokenShape; gradient: boolean; glow: number; outline: number; barrel: boolean }
  enemy: { shape: TokenShape; gradient: boolean; glow: number; outline: number }
  projectile: { glow: number; square: boolean }
}

// Shared token/enemy/projectile fallbacks (used only until sprites finish loading).
const SPRITE_FALLBACK = {
  token: { shape: 'circle' as const, gradient: false, glow: 0, outline: 2, barrel: false },
  enemy: { shape: 'circle' as const, gradient: false, glow: 0, outline: 0 },
  // No shadowBlur. It cost a Gaussian blur per projectile per frame for a
  // 3.5px dot; `drawProjectile` buys the same separation back with a contour
  // ring and a lit core (H19).
  projectile: { glow: 0, square: false },
}

export const THEMES: Record<string, ThemeStyle> = {
  tinyswords: {
    id: 'tinyswords',
    name: 'Tiny Swords',
    blurb: 'Knights hold a sunny meadow against the goblin horde.',
    smoothing: false,
    sprites: { pack: 'tinyswords', spriteScale: 0.5, towerScale: 2.7, enemyScale: 2.7 },
    css: { accent: '#e0ac4c', accentDim: 'rgba(224,172,76,0.16)', radius: '10px', bg: '#201711', panel: '#2f2418' },
    field: { top: '#5a9b43', bottom: '#3f7a30', grid: 'rgba(0,0,0,0.10)', gridStep: 32 },
    path: { edge: '#3c2c18', fill: '#7a5a30', center: 'rgba(0,0,0,0)', edgeWidth: 46, fillWidth: 36, dash: null, cap: 'round' },
    ...SPRITE_FALLBACK,
  },

  /**
   * The from-scratch replacement pack (`docs/ART-PLAN.md`).
   *
   * `spriteScale: 1` is the whole point: at one density the artist authors
   * exactly what the player sees, with no box filter deciding which pixels
   * survive. Tiny Swords stays at `0.5`, and stays the DEFAULT theme until
   * enough of this pack is authored to carry the game.
   *
   * `fallback` makes that incremental: every role this pack does not ship is
   * drawn from Tiny Swords at Tiny Swords' own density (`packDensity`), so the
   * old trap — flipping the density under the old files drew every sprite at
   * 2× and pushed every tree past `DECO_CEIL` (96 drawn px), where decorations
   * vanish with no warning — cannot recur. Preview it with `?art=fieldwatch`.
   *
   * Colours below are `BRAND.md` tokens rather than the meadow greens, since
   * this pack is authored against the brand rather than inheriting a look.
   */
  fieldwatch: {
    id: 'fieldwatch',
    name: 'Fieldwatch',
    blurb: 'The watch holds the line. Storybook chunk at one density.',
    smoothing: false,
    sprites: { pack: 'fieldwatch', spriteScale: 1, towerScale: 1, enemyScale: 1, fallback: ['tinyswords'] },
    css: { accent: '#e0ac4c', accentDim: 'rgba(224,172,76,0.16)', radius: '10px', bg: '#201711', panel: '#2f2418' },
    field: { top: '#5a9b43', bottom: '#3f7a30', grid: 'rgba(0,0,0,0.10)', gridStep: 32 },
    path: { edge: '#3c2c18', fill: '#7a5a30', center: 'rgba(0,0,0,0)', edgeWidth: 46, fillWidth: 36, dash: null, cap: 'round' },
    ...SPRITE_FALLBACK,
  },

  tactical: {
    id: 'tactical',
    name: 'Tactical (minimal)',
    blurb: 'No sprites — clean geometric tokens on a dark field.',
    smoothing: true,
    css: { accent: '#f0a868', accentDim: 'rgba(240,168,104,0.16)', radius: '12px', bg: '#0a0e0c' },
    field: { top: '#141b17', bottom: '#0d1411', grid: 'rgba(255,255,255,0.03)', gridStep: 48 },
    path: { edge: '#3a352b', fill: '#2a2620', center: 'rgba(210,180,120,0.10)', edgeWidth: 46, fillWidth: 38, dash: [10, 14], cap: 'round' },
    token: { shape: 'circle', gradient: false, glow: 0, outline: 2.5, barrel: true },
    enemy: { shape: 'circle', gradient: false, glow: 0, outline: 0 },
    projectile: { glow: 8, square: false },
  },
}

export const DEFAULT_THEME = 'tinyswords'

/**
 * The density a pack is authored at — the `spriteScale` of the theme that
 * owns it. A pack's density is a property of its files, not of whichever theme
 * is borrowing them, which is why a fallback role keeps its own scale: a
 * Tiny Swords tree drawn under the fieldwatch theme is still halved, and never
 * trips `DECO_CEIL` (HANDOFF §5.1).
 */
export function packDensity(pack: string): 0.5 | 1 {
  for (const t of Object.values(THEMES)) if (t.sprites?.pack === pack) return t.sprites.spriteScale
  return 1
}

/**
 * The art preview switch: `?art=fieldwatch` boots the named sprite theme
 * instead of the default, so authored roles can be reviewed in the real game
 * with everything else falling back down the chain. Only sprite themes are
 * accepted. It is a URL switch rather than a setting on purpose: nothing
 * persists it and no player can reach it by accident. Returns null when absent
 * or unknown.
 */
export function artOverride(search: string = typeof location === 'undefined' ? '' : location.search): string | null {
  const id = new URLSearchParams(search).get('art')
  return id && THEMES[id]?.sprites ? id : null
}

let activeStyle: ThemeStyle = THEMES[DEFAULT_THEME]
export const getActiveStyle = (): ThemeStyle => activeStyle

const themeListeners: ((style: ThemeStyle) => void)[] = []
/**
 * Observe theme switches. The sprite loader subscribes so that whoever adds a
 * theme picker cannot ship one whose pack was never fetched: `setActiveTheme` is
 * the single place a theme becomes current, so it is the single place the pack
 * has to be requested from (M37). Fires on the initial `initTheme()` call too.
 */
export function onThemeChange(cb: (style: ThemeStyle) => void): void {
  themeListeners.push(cb)
}

export function setActiveTheme(id: string): ThemeStyle {
  activeStyle = THEMES[id] ?? THEMES[DEFAULT_THEME]
  for (const cb of themeListeners) cb(activeStyle)
  return activeStyle
}

/** Run a draw callback under a specific theme, restoring the active one after. */
export function withStyle(style: ThemeStyle, fn: () => void): void {
  const prev = activeStyle
  activeStyle = style
  try {
    fn()
  } finally {
    activeStyle = prev
  }
}

/** Push a theme's palette into CSS custom properties so the whole UI reskins. */
export function applyThemeCss(style: ThemeStyle): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--accent', style.css.accent)
  root.style.setProperty('--accent-dim', style.css.accentDim)
  root.style.setProperty('--radius', style.css.radius)
  root.style.setProperty('--bg', style.css.bg)
  if (style.css.panel) root.style.setProperty('--panel', style.css.panel)
  document.body.style.fontFamily = style.css.font ?? ''
}
