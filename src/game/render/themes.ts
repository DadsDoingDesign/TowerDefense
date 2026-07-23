/**
 * Render themes — distinct visual directions for the battle canvas + UI accent.
 * Everything is procedural so it works with no external assets; the chosen
 * direction tells us which real sprite pack to drop in later.
 *
 * The renderer reads `activeStyle`; theme previews swap it around a synchronous
 * draw. UI reskin happens via CSS variables in applyThemeCss().
 */
export type TokenShape = 'circle' | 'square' | 'ring' | 'gem'

export interface ThemeStyle {
  id: string
  name: string
  blurb: string
  smoothing: boolean
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

export const THEMES: Record<string, ThemeStyle> = {
  tactical: {
    id: 'tactical',
    name: 'Tactical',
    blurb: 'Clean geometric tokens on a dark field. The current look.',
    smoothing: true,
    css: { accent: '#f0a868', accentDim: 'rgba(240,168,104,0.16)', radius: '12px', bg: '#0a0e0c' },
    field: { top: '#141b17', bottom: '#0d1411', grid: 'rgba(255,255,255,0.03)', gridStep: 48 },
    path: { edge: '#3a352b', fill: '#2a2620', center: 'rgba(210,180,120,0.10)', edgeWidth: 46, fillWidth: 38, dash: [10, 14], cap: 'round' },
    token: { shape: 'circle', gradient: false, glow: 0, outline: 2.5, barrel: true },
    enemy: { shape: 'circle', gradient: false, glow: 0, outline: 0 },
    projectile: { glow: 8, square: false },
  },

  pixel: {
    id: 'pixel',
    name: 'Pixel Keep',
    blurb: 'Retro pixel-art vibe — blocky tokens, tiled road, chunky pixels.',
    smoothing: false,
    css: { accent: '#8bd450', accentDim: 'rgba(139,212,80,0.16)', radius: '3px', bg: '#0b0d0a', panel: '#141810', font: "'Courier New', ui-monospace, monospace" },
    field: { top: '#20301c', bottom: '#16210f', grid: 'rgba(0,0,0,0.25)', gridStep: 24 },
    path: { edge: '#5a4a30', fill: '#caa46a', center: 'rgba(90,74,48,0.6)', edgeWidth: 44, fillWidth: 34, dash: null, cap: 'butt' },
    token: { shape: 'square', gradient: true, glow: 0, outline: 3, barrel: false },
    enemy: { shape: 'square', gradient: true, glow: 0, outline: 2 },
    projectile: { glow: 0, square: true },
  },

  arcane: {
    id: 'arcane',
    name: 'Arcane',
    blurb: 'Painterly fantasy — glowing gem tokens, runic road, soft light.',
    smoothing: true,
    css: { accent: '#f0c060', accentDim: 'rgba(240,192,96,0.16)', radius: '16px', bg: '#0d0a18', panel: '#171227' },
    field: { top: '#221a3a', bottom: '#120e22', grid: 'rgba(180,150,240,0.05)', gridStep: 56 },
    path: { edge: '#2c2350', fill: '#3a2f66', center: 'rgba(240,192,96,0.35)', edgeWidth: 44, fillWidth: 34, dash: [8, 12], cap: 'round' },
    token: { shape: 'gem', gradient: true, glow: 14, outline: 2, barrel: true },
    enemy: { shape: 'circle', gradient: true, glow: 8, outline: 0 },
    projectile: { glow: 16, square: false },
  },

  neon: {
    id: 'neon',
    name: 'Neon Grid',
    blurb: 'Arcade cyberpunk — glowing vector rings on a dark grid.',
    smoothing: true,
    css: { accent: '#39e0e0', accentDim: 'rgba(57,224,224,0.16)', radius: '10px', bg: '#05060a', panel: '#0b0f18' },
    field: { top: '#0a1020', bottom: '#05060a', grid: 'rgba(57,224,224,0.10)', gridStep: 40 },
    path: { edge: '#1b6f77', fill: '#0a1a20', center: 'rgba(57,224,224,0.5)', edgeWidth: 40, fillWidth: 30, dash: [6, 10], cap: 'round' },
    token: { shape: 'ring', gradient: false, glow: 14, outline: 3, barrel: false },
    enemy: { shape: 'ring', gradient: false, glow: 10, outline: 3 },
    projectile: { glow: 18, square: false },
  },

  storybook: {
    id: 'storybook',
    name: 'Storybook',
    blurb: 'Bright flat cartoon — thick outlines, soft pastel field.',
    smoothing: true,
    css: { accent: '#ff8a5c', accentDim: 'rgba(255,138,92,0.18)', radius: '18px', bg: '#14241f', panel: '#1b3029' },
    field: { top: '#26443a', bottom: '#1a3229', grid: 'rgba(255,255,255,0.04)', gridStep: 60 },
    path: { edge: '#6b4a34', fill: '#e8cfa0', center: 'rgba(107,74,52,0.35)', edgeWidth: 46, fillWidth: 36, dash: null, cap: 'round' },
    token: { shape: 'circle', gradient: false, glow: 0, outline: 4, barrel: false },
    enemy: { shape: 'circle', gradient: false, glow: 0, outline: 3.5 },
    projectile: { glow: 4, square: false },
  },
}

export const THEME_IDS = Object.keys(THEMES)
export const DEFAULT_THEME = 'tactical'

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
