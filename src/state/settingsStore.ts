import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyThemeCss, DEFAULT_THEME, setActiveTheme, THEMES } from '../game/render/themes'

interface SettingsState {
  theme: string
  setTheme: (id: string) => void
}

/** Apply a theme to both the canvas renderer and the UI CSS variables. */
function apply(id: string): void {
  const style = setActiveTheme(id)
  applyThemeCss(style)
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      setTheme: (id) => {
        if (!THEMES[id]) return
        apply(id)
        set({ theme: id })
      },
    }),
    {
      name: 'fieldwatch-settings',
      onRehydrateStorage: () => (state) => {
        // Apply the persisted theme once the store hydrates.
        if (state) apply(state.theme)
      },
    },
  ),
)

/** Call once at startup to apply the persisted theme before first paint. */
export function initTheme(): void {
  apply(useSettingsStore.getState().theme)
}
