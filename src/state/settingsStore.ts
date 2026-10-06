import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { setAudioOptions, setAudioVolumes } from '../audio/audio'
import { applyThemeCss, DEFAULT_THEME, setActiveTheme } from '../game/render/themes'
import { bool, clampNum, onStorageKeyChange, readRaw, safePersistStorage, str } from './storage'

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
  off: { baseDamageMul: 1, label: 'Off', blurb: 'The game as it was written.' },
  steady: { baseDamageMul: 0.6, label: 'Steady', blurb: 'Raiders who reach your wagons steal 40% less cargo.' },
  sure: { baseDamageMul: 0.3, label: 'Sure', blurb: 'Raiders who reach your wagons steal 70% less cargo.' },
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
/*
 * LS3 added one tip per staged idea (`state/staging.ts`): each is said once,
 * the first time its idea is on screen. `gold` retired into `merchant` — the
 * gold tip only ever said "spend it at a Merchant", so it is now said when a
 * merchant is first in reach. `threat` keeps its id (it is persisted) and now
 * speaks of enemy strength.
 */
export const TEACH_IDS = [
  'deploy',
  'equip',
  'threat',
  'subwave',
  'speed',
  'depth',
  'gear',
  'command',
  'merchant',
  'relic',
  'danger',
  'challenge',
  // SK1: the hero pick's "each hero comes with a skill", and the first
  // milestone's "pick a skill". New ideas, so a returning player sees them
  // too; the perk and evolution tips they replace are dropped on load.
  'heroSkill',
  'skill',
  // The classless rework: "what a hero does comes from its gear", said once on
  // the hero pick. New, so a returning player meets it too.
  'heroGear',
  // The mercenary company: one tip each for the contract board, the stake and
  // the cities' cash-out — each said once, where it opens. (The purse's tip
  // went with the purse picker, October 2026: every contract carries the
  // company's advance.)
  'board',
  'stakes',
  'cashOut',
  // The HQ (build step 3): one tip for the headquarters, one for the sealed
  // crates — each said once, the first time the page opens.
  'hq',
  'crates',
  // October 2026 (audit designer item 8): rewards and the campfire commit on
  // a tap. "Tap to take · hold to look", said once, on the first such board.
  // New for everyone: a returning player is the one who expects a confirm.
  'oneTap',
  // The staggered reveal (October 2026): the market of the day and company
  // focus each say one tip, the first time they show (from the fifth contract).
  'market',
  'focus',
] as const
export type TeachId = (typeof TEACH_IDS)[number]
export type TeachSeen = Record<TeachId, boolean>

/**
 * The tips LS3 added. A player who had already played before they existed
 * (settings v3 or older, and a meta save with a finished run) has met every
 * one of these ideas, so the migration marks them taught — nobody who knows
 * the game is walked through it again. "Show the tips again" still brings
 * them all back.
 */
export const LS3_TEACH_IDS: readonly TeachId[] = ['subwave', 'speed', 'depth', 'gear', 'command', 'merchant', 'relic', 'danger', 'challenge']

const NO_TEACH = Object.fromEntries(TEACH_IDS.map((id) => [id, false])) as TeachSeen

/**
 * The audio settings — and the API the Settings row's sliders are wired to.
 *
 * Four independent levels, each 0–1 and persisted:
 *   - `master` — everything.                       setter: `setMasterVolume`
 *   - `music`  — the score. 0 = off (see below).   setter: `setMusicVolume`
 *   - `game`   — "Effects": combat + ceremony.     setter: `setEffectsVolume`
 *   - `ui`     — interface taps and chimes.        setter: `setUiVolume`
 * plus `muted` (`toggleMute`) and the music on/off switch (`toggleMusic`).
 *
 * The levels are what the player chose; the fixed per-bus loudness makeup
 * lives in `src/audio/mix.ts` and is applied on top, so a slider at 1 is the
 * designed maximum and the defaults below are the calibrated mix.
 */
export interface AudioSettings {
  master: number
  /** The Effects bus — combat and ceremony sounds. */
  game: number
  ui: number
  /**
   * The music bus (Phase 3). Zero means "no music at all" rather than "music at
   * zero gain" — the director stops the scheduler entirely — so this doubles as
   * the on/off switch the settings page exposes. It defaults below the SFX
   * buses because a score that competes with combat feedback is a defect.
   */
  music: number
  /**
   * The music level to come back to when the score is switched back on — the
   * last non-zero `music`. Without it, "Music: off → on" threw away whatever
   * the player had set the slider to and reset it to the default.
   */
  musicLevel: number
  muted: boolean
}

/** Where the Music row puts the dial when it is switched back on. */
export const MUSIC_DEFAULT = 0.55

/** Is the score switched on? (`music` at 0 means off — the one definition.) */
export const musicOn = (a: Pick<AudioSettings, 'music'>): boolean => a.music > 0

const vol01 = (v: number, fallback: number): number => clampNum(v, fallback, 0, 1)

interface SettingsState {
  audio: AudioSettings
  reducedMotion: boolean
  highContrast: boolean
  uiScale: UiScale
  vision: VisionMode
  assist: AssistLevel
  /** Which teaching beats the player has already been shown. */
  taught: TeachSeen
  /**
   * LS3: "Show everything from the start". Off, a first run is staged — new
   * ideas arrive when they matter. On, nothing is held back (and the next run
   * deals its road as any returning player's would).
   */
  showEverything: boolean
  setShowEverything: (v: boolean) => void
  /**
   * Oct 2026 (2.3): a held sub-wave counts down on Next and sends the next
   * sub-wave itself unless the player touches the field (`autoContinue.ts`).
   * On by default; off, Next waits as it always did.
   */
  autoContinue: boolean
  setAutoContinue: (v: boolean) => void
  /**
   * "Calm audio" (Phase-2 accessibility): the score without drums, a gentler
   * limiter, and the effects brought forward — for sensory sensitivity, for
   * playing at night, for anyone the fight music is too much for.
   */
  calmAudio: boolean
  /** Fold the mix to mono (one earbud, one speaker, a hearing difference). */
  monoAudio: boolean
  setCalmAudio: (v: boolean) => void
  setMonoAudio: (v: boolean) => void
  setAudio: (patch: Partial<AudioSettings>) => void
  /** Master level, 0–1. */
  setMasterVolume: (v: number) => void
  /** Music level, 0–1. 0 switches the score off; any other value is remembered for `toggleMusic`. */
  setMusicVolume: (v: number) => void
  /** Effects (combat + ceremony) level, 0–1. */
  setEffectsVolume: (v: number) => void
  /** Interface level, 0–1. */
  setUiVolume: (v: number) => void
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

/**
 * Persisted settings schema version (M11). 2: `audio.musicLevel`. 3: `calmAudio`,
 * `monoAudio`. 4: `showEverything`, and the LS3 tips (see {@link LS3_TEACH_IDS}).
 * 5: `autoContinue` (a missing key reads as on).
 */
export const SETTINGS_VERSION = 5

const UI_SCALES = ['normal', 'large'] as const
const VISION_MODES = ['default', 'deuter', 'protan', 'tritan'] as const
const ASSIST_LEVELS = ['off', 'steady', 'sure'] as const

type PersistedSettings = Pick<
  SettingsState,
  | 'audio'
  | 'reducedMotion'
  | 'highContrast'
  | 'uiScale'
  | 'vision'
  | 'assist'
  | 'taught'
  | 'calmAudio'
  | 'monoAudio'
  | 'showEverything'
  | 'autoContinue'
>

/**
 * Coerce any stored payload to the current shape (M11).
 *
 * Volumes are multiplied into gain nodes, so an `undefined` here would set a
 * gain to NaN and silence the game permanently — with the bad value written
 * straight back to storage on the next change. Every field is clamped to a
 * range it is actually allowed to hold.
 */
export function migrateSettings(persisted: unknown, version: number, metaRaw: () => string | null = () => readRaw('fieldwatch-meta')): PersistedSettings {
  const o = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>
  // v3 → v4 (LS3): a player who had finished a run before the new tips
  // existed has met their ideas already. Only on a real version step —
  // `merge` calls this with the current version on every load.
  const taught = readTaught(o.taught)
  if (version < 4 && playedBefore(metaRaw())) for (const id of LS3_TEACH_IDS) taught[id] = true
  const a = (o.audio && typeof o.audio === 'object' ? o.audio : {}) as Record<string, unknown>
  return {
    audio: {
      master: clampNum(a.master, 0.8, 0, 1),
      game: clampNum(a.game, 0.7, 0, 1),
      ui: clampNum(a.ui, 0.9, 0, 1),
      // A payload written before music existed has no `music` key at all, so it
      // takes the default and the returning player simply gets the score.
      music: clampNum(a.music, MUSIC_DEFAULT, 0, 1),
      // v1 had no `musicLevel`: music on/off was `music` alone, and "off" was
      // stored as 0. Come back to the level the player had if there is one,
      // else the default — never to 0, which would make "on" silent.
      musicLevel: readMusicLevel(a),
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
    taught,
    // v2 and earlier had neither: both default off, the mix as designed.
    calmAudio: bool(o.calmAudio, false),
    monoAudio: bool(o.monoAudio, false),
    showEverything: bool(o.showEverything, false),
    // v4 and earlier never had it: held waves continue themselves by default.
    autoContinue: bool(o.autoContinue, true),
  }
}

/** Whether a stored meta payload records a finished run. Never throws. */
function playedBefore(raw: string | null): boolean {
  if (!raw) return false
  try {
    const o = JSON.parse(raw) as { state?: { stats?: { runsCompleted?: unknown } } }
    const n = o?.state?.stats?.runsCompleted
    return typeof n === 'number' && Number.isFinite(n) && n > 0
  } catch {
    return false
  }
}

function readMusicLevel(a: Record<string, unknown>): number {
  const stored = clampNum(a.musicLevel, 0, 0, 1)
  if (stored > 0) return stored
  const music = clampNum(a.music, 0, 0, 1)
  return music > 0 ? music : MUSIC_DEFAULT
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
      audio: { master: 0.8, game: 0.7, ui: 0.9, music: MUSIC_DEFAULT, musicLevel: MUSIC_DEFAULT, muted: false },
      reducedMotion: prefersReducedMotion,
      highContrast: false,
      uiScale: 'normal',
      vision: 'default',
      assist: 'off',
      taught: { ...NO_TEACH },
      calmAudio: false,
      monoAudio: false,
      showEverything: false,

      setShowEverything: (v) => set({ showEverything: v }),
      autoContinue: true,
      setAutoContinue: (v) => set({ autoContinue: v }),

      setCalmAudio: (v) => {
        set({ calmAudio: v })
        setAudioOptions({ calm: v })
      },
      setMonoAudio: (v) => {
        set({ monoAudio: v })
        setAudioOptions({ mono: v })
      },
      setAudio: (patch) => {
        const audio = { ...get().audio, ...patch }
        set({ audio })
        setAudioVolumes(audio)
      },
      setMasterVolume: (v) => get().setAudio({ master: vol01(v, get().audio.master) }),
      setEffectsVolume: (v) => get().setAudio({ game: vol01(v, get().audio.game) }),
      setUiVolume: (v) => get().setAudio({ ui: vol01(v, get().audio.ui) }),
      setMusicVolume: (v) => {
        const music = vol01(v, get().audio.music)
        get().setAudio(music > 0 ? { music, musicLevel: music } : { music: 0 })
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
        const a = get().audio
        const audio = a.music > 0 ? { ...a, music: 0, musicLevel: a.music } : { ...a, music: a.musicLevel > 0 ? a.musicLevel : MUSIC_DEFAULT }
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
        calmAudio: s.calmAudio,
        monoAudio: s.monoAudio,
        showEverything: s.showEverything,
        autoContinue: s.autoContinue,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyAccessibility(state)
          setAudioVolumes(state.audio)
          setAudioOptions({ calm: state.calmAudio, mono: state.monoAudio })
        }
      },
    },
  ),
)

// Settings changed in another tab apply here too (and re-run the rehydrate
// hook above, so accessibility and volumes follow), instead of being reverted
// by this tab's next save.
onStorageKeyChange('fieldwatch-settings', () => void useSettingsStore.persist.rehydrate())

/** The UI is locked to the Tiny Swords art direction — no theme picker. */
export function initTheme(): void {
  applyThemeCss(setActiveTheme(DEFAULT_THEME))
}

/** Apply persisted accessibility + audio settings before first paint. */
export function initSettings(): void {
  const s = useSettingsStore.getState()
  applyAccessibility(s)
  setAudioVolumes(s.audio)
  setAudioOptions({ calm: s.calmAudio, mono: s.monoAudio })
}
