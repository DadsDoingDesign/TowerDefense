import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { setAudioVolumes } from '../audio/audio'
import { applyThemeCss, setActiveTheme } from '../game/render/themes'
import { bool, clampNum, safePersistStorage, str } from './storage'

export type UiScale = 'normal' | 'large'

/**
 * Colour-vision mode (M34). `default` is the warm brand ramp; the other three
 * re-tint the rarity, archetype and semantic hues in `global.css` so the pairs
 * that collapse under each common confusion are pulled apart — and lean on
 * lightness, which no colour-vision difference takes away.
 *
 * It is an *addition* to the non-colour channels the shell draws (rarity
 * initials, archetype glyphs), never a substitute for them.
 */
export type VisionMode = 'default' | 'deuter' | 'protan' | 'tritan'

/**
 * The assist dial (M34), in the spirit of Hades' God Mode: opt-in, effective,
 * and named for what it gives you rather than for what it assumes about you.
 * There is no "easy" here and no warning label — you turn it on, the watch
 * holds a little better, and nothing else changes.
 *
 * `off` is the shipped difficulty. `steady` and `sure` cut the damage your base
 * takes; nothing about enemy count, loot or Watch Marks moves, so a run played
 * with it on is still the same run.
 */
export type AssistLevel = 'off' | 'steady' | 'sure'

export interface AssistProfile {
  /** Multiplier on damage the base takes when an enemy reaches the line. */
  baseDamageMul: number
  label: string
  blurb: string
}

const ASSIST: Record<AssistLevel, AssistProfile> = {
  off: { baseDamageMul: 1, label: 'Off', blurb: 'The watch stands as it was written.' },
  steady: { baseDamageMul: 0.6, label: 'Steady', blurb: 'The line takes 40% less damage when something gets through.' },
  sure: { baseDamageMul: 0.3, label: 'Sure', blurb: 'The line takes 70% less damage when something gets through.' },
}

/**
 * The assist profile for a level — pure, so the engine, the harness and the UI
 * all read one answer. See the WS9 report for the single call site the engine
 * still needs to add.
 */
export const assistProfile = (level: AssistLevel): AssistProfile => ASSIST[level] ?? ASSIST.off

/**
 * First-run teaching beats (WS9). Each is one idea, taught once, in the place
 * and at the moment it is needed — never a modal tour and never a wall of text.
 *
 * They live in settings rather than in the run so they survive a run ending,
 * and so "Show the tips again" is one row on the settings page.
 */
export type TeachId = 'deploy' | 'equip' | 'threat' | 'evolve'
export const TEACH_IDS = ['deploy', 'equip', 'threat', 'evolve'] as const
export type TeachSeen = Record<TeachId, boolean>

const NO_TEACH: TeachSeen = { deploy: false, equip: false, threat: false, evolve: false }

export interface AudioSettings {
  master: number
  game: number
  ui: number
  /**
   * The music bus (Phase 3). Zero means "no music at all" rather than "music at
   * zero gain" — the director stops the scheduler entirely — so this doubles as
   * the on/off switch the settings page exposes. It defaults below the SFX
   * buses because a score that competes with combat feedback is a defect.
   */
  music: number
  muted: boolean
}

/** Where the Music row puts the dial when it is switched back on. */
export const MUSIC_DEFAULT = 0.55

interface SettingsState {
  audio: AudioSettings
  reducedMotion: boolean
  highContrast: boolean
  uiScale: UiScale
  vision: VisionMode
  assist: AssistLevel
  /** Which teaching beats the player has already been shown. */
  taught: TeachSeen
  setAudio: (patch: Partial<AudioSettings>) => void
  toggleMute: () => void
  setReducedMotion: (v: boolean) => void
  setHighContrast: (v: boolean) => void
  setUiScale: (v: UiScale) => void
  setVision: (v: VisionMode) => void
  toggleMusic: () => void
  setAssist: (v: AssistLevel) => void
  markTaught: (id: TeachId) => void
  resetTeaching: () => void
}

const prefersReducedMotion =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Persisted settings schema version (M11). */
export const SETTINGS_VERSION = 1

const UI_SCALES = ['normal', 'large'] as const
const VISION_MODES = ['default', 'deuter', 'protan', 'tritan'] as const
const ASSIST_LEVELS = ['off', 'steady', 'sure'] as const

type PersistedSettings = Pick<
  SettingsState,
  'audio' | 'reducedMotion' | 'highContrast' | 'uiScale' | 'vision' | 'assist' | 'taught'
>

/**
 * Coerce any stored payload to the current shape (M11).
 *
 * Volumes are multiplied into gain nodes, so an `undefined` here would set a
 * gain to NaN and silence the game permanently — with the bad value written
 * straight back to storage on the next change. Every field is clamped to a
 * range it is actually allowed to hold.
 */
export function migrateSettings(persisted: unknown, _version: number): PersistedSettings {
  const o = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>
  const a = (o.audio && typeof o.audio === 'object' ? o.audio : {}) as Record<string, unknown>
  return {
    audio: {
      master: clampNum(a.master, 0.8, 0, 1),
      game: clampNum(a.game, 0.7, 0, 1),
      ui: clampNum(a.ui, 0.9, 0, 1),
      // A payload written before music existed has no `music` key at all, so it
      // takes the default and the returning player simply gets the score.
      music: clampNum(a.music, MUSIC_DEFAULT, 0, 1),
      muted: bool(a.muted, false),
    },
    reducedMotion: bool(o.reducedMotion, prefersReducedMotion),
    highContrast: bool(o.highContrast, false),
    uiScale: str<UiScale>(o.uiScale, 'normal', UI_SCALES),
    vision: str<VisionMode>(o.vision, 'default', VISION_MODES),
    assist: str<AssistLevel>(o.assist, 'off', ASSIST_LEVELS),
    // A payload written before teaching existed has no `taught` at all, and a
    // half-written one may have any subset — coerce every flag rather than
    // spreading whatever arrived, so an unknown key can never become a beat
    // that is silently already "seen".
    taught: readTaught(o.taught),
  }
}

function readTaught(v: unknown): TeachSeen {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const out = { ...NO_TEACH }
  for (const id of TEACH_IDS) out[id] = bool(o[id], false)
  return out
}

/** Reflect accessibility settings onto the document root so CSS can react. */
function applyAccessibility(s: {
  reducedMotion: boolean
  highContrast: boolean
  uiScale: UiScale
  vision: VisionMode
}): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.reducedMotion = s.reducedMotion ? 'true' : 'false'
  root.dataset.contrast = s.highContrast ? 'high' : 'normal'
  root.dataset.scale = s.uiScale
  root.dataset.vision = s.vision
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      audio: { master: 0.8, game: 0.7, ui: 0.9, music: MUSIC_DEFAULT, muted: false },
      reducedMotion: prefersReducedMotion,
      highContrast: false,
      uiScale: 'normal',
      vision: 'default',
      assist: 'off',
      taught: { ...NO_TEACH },

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
      /**
       * Music on/off, as its own control.
       *
       * Separate from mute because they answer different questions: mute is
       * "silence, I am in public", and this is "keep the feedback, drop the
       * score". Sound effects carry information in this game and the score does
       * not, so a player who wants one without the other must not have to give
       * up both.
       */
      toggleMusic: () => {
        const cur = get().audio.music
        const audio = { ...get().audio, music: cur > 0 ? 0 : MUSIC_DEFAULT }
        set({ audio })
        setAudioVolumes(audio)
      },
      /*
       * Every accessibility setter writes the field and then re-applies the
       * WHOLE root state. Passing the three siblings by hand (as this used to)
       * is one forgotten argument away from a setter that silently clears
       * another's dataset flag — which is exactly the shape of bug that makes
       * "I turned high contrast on and my text size reset" impossible to
       * reproduce.
       */
      setReducedMotion: (v) => {
        set({ reducedMotion: v })
        applyAccessibility(get())
      },
      setHighContrast: (v) => {
        set({ highContrast: v })
        applyAccessibility(get())
      },
      setUiScale: (v) => {
        set({ uiScale: v })
        applyAccessibility(get())
      },
      setVision: (v) => {
        set({ vision: v })
        applyAccessibility(get())
      },
      setAssist: (v) => set({ assist: v }),

      // Teaching is write-once per beat: a tip that has been dismissed stays
      // dismissed, and re-marking is a no-op rather than a fresh write to
      // storage on every render that happens to notice.
      markTaught: (id) => {
        if (get().taught[id]) return
        set({ taught: { ...get().taught, [id]: true } })
      },
      resetTeaching: () => set({ taught: { ...NO_TEACH } }),
    }),
    {
      name: 'fieldwatch-settings',
      version: SETTINGS_VERSION,
      storage: createJSONStorage(() => safePersistStorage),
      migrate: migrateSettings,
      merge: (persisted, current) => ({ ...current, ...migrateSettings(persisted, SETTINGS_VERSION) }),
      partialize: (s) => ({
        audio: s.audio,
        reducedMotion: s.reducedMotion,
        highContrast: s.highContrast,
        uiScale: s.uiScale,
        vision: s.vision,
        assist: s.assist,
        taught: s.taught,
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
