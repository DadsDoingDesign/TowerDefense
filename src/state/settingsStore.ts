import { applyThemeCss, setActiveTheme } from '../game/render/themes'

/**
 * The UI is locked to the Tiny Swords art direction — there is no theme picker.
 * This applies it to both the canvas renderer and the UI CSS variables at
 * startup (called once from main.tsx before first paint).
 */
export function initTheme(): void {
  applyThemeCss(setActiveTheme('tinyswords'))
}
