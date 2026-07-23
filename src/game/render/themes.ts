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
  towerScale: number
  enemyScale: number
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
  projectile: { glow: 6, square: false },
}

export const THEMES: Record<string, ThemeStyle> = {
  tinyswords: {
    id: 'tinyswords',
    name: 'Tiny Swords',
    blurb: 'Knight towers hold a sunny meadow against the goblin horde.',
    smoothing: false,
    sprites: { pack: 'tinyswords', towerScale: 2.7, enemyScale: 2.7 },
    css: { accent: '#eab24a', accentDim: 'rgba(234,178,74,0.16)', radius: '8px', bg: '#0e140c', panel: '#18220f' },
    field: { top: '#5a9b43', bottom: '#3f7a30', grid: 'rgba(0,0,0,0.10)', gridStep: 32 },
    path: { edge: '#3c2c18', fill: '#7a5a30', center: 'rgba(0,0,0,0)', edgeWidth: 46, fillWidth: 36, dash: null, cap: 'round' },
    ...SPRITE_FALLBACK,
  },

  fantasy: {
    id: 'fantasy',
    name: 'Fantasy Fields',
    blurb: 'Human heroes vs goblins & orcs on grassy plains.',
    smoothing: false,
    sprites: { pack: 'fantasy', towerScale: 2.5, enemyScale: 2.6 },
    css: { accent: '#d9a441', accentDim: 'rgba(217,164,65,0.16)', radius: '6px', bg: '#0e0b08', panel: '#181209' },
    field: { top: '#2b3a22', bottom: '#1c2718', grid: 'rgba(0,0,0,0.14)', gridStep: 32 },
    path: { edge: '#3c2c18', fill: '#6b4f2c', center: 'rgba(0,0,0,0)', edgeWidth: 44, fillWidth: 34, dash: null, cap: 'round' },
    ...SPRITE_FALLBACK,
  },

  undead: {
    id: 'undead',
    name: 'Undead Crypt',
    blurb: 'Death knights & necromancers hold a cursed stone hall of the dead.',
    smoothing: false,
    sprites: { pack: 'undead', towerScale: 2.5, enemyScale: 2.6 },
    css: { accent: '#9fb4c0', accentDim: 'rgba(159,180,192,0.16)', radius: '6px', bg: '#090b0f', panel: '#12161e' },
    field: { top: '#2b3038', bottom: '#171b22', grid: 'rgba(0,0,0,0.18)', gridStep: 32 },
    path: { edge: '#1c1f26', fill: '#3a2a2a', center: 'rgba(0,0,0,0)', edgeWidth: 44, fillWidth: 34, dash: null, cap: 'round' },
    ...SPRITE_FALLBACK,
  },

  infernal: {
    id: 'infernal',
    name: 'Infernal Depths',
    blurb: 'Hell knights & warlocks against a demon horde over volcanic rock.',
    smoothing: false,
    sprites: { pack: 'infernal', towerScale: 2.5, enemyScale: 2.6 },
    css: { accent: '#ef7738', accentDim: 'rgba(239,119,56,0.16)', radius: '6px', bg: '#140708', panel: '#210b0c' },
    field: { top: '#3a1712', bottom: '#20090a', grid: 'rgba(0,0,0,0.2)', gridStep: 32 },
    path: { edge: '#2a0d0a', fill: '#5a2418', center: 'rgba(0,0,0,0)', edgeWidth: 44, fillWidth: 34, dash: null, cap: 'round' },
    ...SPRITE_FALLBACK,
  },

  frost: {
    id: 'frost',
    name: 'Frostreach',
    blurb: 'Guardians & mages defend the ice against drakes and frost giants.',
    smoothing: false,
    sprites: { pack: 'frost', towerScale: 2.5, enemyScale: 2.6 },
    css: { accent: '#7fd0f0', accentDim: 'rgba(127,208,240,0.16)', radius: '6px', bg: '#071019', panel: '#0e1a28' },
    field: { top: '#26384a', bottom: '#152331', grid: 'rgba(255,255,255,0.05)', gridStep: 32 },
    path: { edge: '#22323f', fill: '#4a6272', center: 'rgba(0,0,0,0)', edgeWidth: 44, fillWidth: 34, dash: null, cap: 'round' },
    ...SPRITE_FALLBACK,
  },

  sylvan: {
    id: 'sylvan',
    name: 'Sylvan Wilds',
    blurb: 'Rangers & druids hold a mossy forest trail against wild beasts.',
    smoothing: false,
    sprites: { pack: 'sylvan', towerScale: 2.5, enemyScale: 2.6 },
    css: { accent: '#8ac74f', accentDim: 'rgba(138,199,79,0.16)', radius: '6px', bg: '#0a1309', panel: '#121d0e' },
    field: { top: '#26401e', bottom: '#182a14', grid: 'rgba(0,0,0,0.14)', gridStep: 32 },
    path: { edge: '#2c2110', fill: '#5a4326', center: 'rgba(0,0,0,0)', edgeWidth: 44, fillWidth: 34, dash: null, cap: 'round' },
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

export const THEME_IDS = Object.keys(THEMES)
export const DEFAULT_THEME = 'tinyswords'

let activeStyle: ThemeStyle = THEMES[DEFAULT_THEME]
export const getActiveStyle = (): ThemeStyle => activeStyle
export function setActiveTheme(id: string): ThemeStyle {
  activeStyle = THEMES[id] ?? THEMES[DEFAULT_THEME]
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
