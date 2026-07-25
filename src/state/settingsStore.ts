import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setAudioVolumes } from '../audio/audio'
import { applyThemeCss, setActiveTheme } from '../game/render/themes'

export type UiScale = 'normal' | 'large'

export interface AudioSettings {
  master: number
  game: number
  ui: number
  muted: boolean
}

interface SettingsState {
  audio: AudioSettings
  reducedMotion: boolean
  highContrast: boolean
  uiScale: UiScale
  setAudio: (patch: Partial<AudioSettings>) => void
  toggleMute: () => void
  setReducedMotion: (v: boolean) => void
  setHighContrast: (v: boolean) => void
  setUiScale: (v: UiScale) => void
}

const prefersReducedMotion =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Reflect accessibility settings onto the document root so CSS can react. */
function applyAccessibility(s: { reducedMotion: boolean; highContrast: boolean; uiScale: UiScale }): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.reducedMotion = s.reducedMotion ? 'true' : 'false'
  root.dataset.contrast = s.highContrast ? 'high' : 'normal'
  root.dataset.scale = s.uiScale
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      audio: { master: 0.8, game: 0.7, ui: 0.9, muted: false },
      reducedMotion: prefersReducedMotion,
      highContrast: false,
      uiScale: 'normal',

      setAudio: (patch) => {
        const audio = { ...get().audio, ...patch }
        set({ audio })
        setAudioVolumes(audio)
      },
      toggleMute: () => {
        const audio = { ...get().audio, muted: !get().audio.muted }
        set({ audio })
        setAudioVolumes(audio)
      },
      setReducedMotion: (v) => {
        set({ reducedMotion: v })
        applyAccessibility({ reducedMotion: v, highContrast: get().highContrast, uiScale: get().uiScale })
      },
      setHighContrast: (v) => {
        set({ highContrast: v })
        applyAccessibility({ reducedMotion: get().reducedMotion, highContrast: v, uiScale: get().uiScale })
      },
      setUiScale: (v) => {
        set({ uiScale: v })
        applyAccessibility({ reducedMotion: get().reducedMotion, highContrast: get().highContrast, uiScale: v })
      },
    }),
    {
      name: 'fieldwatch-settings',
      partialize: (s) => ({
        audio: s.audio,
        reducedMotion: s.reducedMotion,
        highContrast: s.highContrast,
        uiScale: s.uiScale,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyAccessibility(state)
          setAudioVolumes(state.audio)
        }
      },
    },
  ),
)

/** The UI is locked to the Tiny Swords art direction — no theme picker. */
export function initTheme(): void {
  applyThemeCss(setActiveTheme('tinyswords'))
}

/** Apply persisted accessibility + audio settings before first paint. */
export function initSettings(): void {
  const s = useSettingsStore.getState()
  applyAccessibility(s)
  setAudioVolumes(s.audio)
}
