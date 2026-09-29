import { beforeEach, describe, expect, it } from 'vitest'
import { migrateSettings, MUSIC_DEFAULT, musicOn, useSettingsStore } from '../src/state/settingsStore'

const fresh = { master: 0.8, game: 0.7, ui: 0.9, music: MUSIC_DEFAULT, musicLevel: MUSIC_DEFAULT, muted: false }

describe('migrateSettings — audio', () => {
  it('fills a pre-music payload with defaults', () => {
    expect(migrateSettings({ audio: { master: 0.5, game: 0.4, ui: 0.3, muted: true } }, 1).audio).toEqual({
      master: 0.5,
      game: 0.4,
      ui: 0.3,
      music: MUSIC_DEFAULT,
      musicLevel: MUSIC_DEFAULT,
      muted: true,
    })
  })

  it('v1 music OFF stays off, and switching it on later is not silent', () => {
    const a = migrateSettings({ audio: { music: 0 } }, 1).audio
    expect(a.music).toBe(0)
    expect(musicOn(a)).toBe(false)
    expect(a.musicLevel).toBe(MUSIC_DEFAULT)
  })

  it('v1 music at a custom level remembers that level', () => {
    const a = migrateSettings({ audio: { music: 0.3 } }, 1).audio
    expect(a.music).toBe(0.3)
    expect(a.musicLevel).toBe(0.3)
  })

  it('coerces garbage to safe ranges', () => {
    const a = migrateSettings({ audio: { master: 'x', game: 9, ui: -2, music: NaN, musicLevel: 0, muted: 'yes' } }, 2).audio
    expect(a).toEqual({ master: 0.8, game: 1, ui: 0, music: MUSIC_DEFAULT, musicLevel: MUSIC_DEFAULT, muted: false })
  })
})

describe('volume setters', () => {
  beforeEach(() => useSettingsStore.setState({ audio: { ...fresh } }))
  const audio = () => useSettingsStore.getState().audio

  it('set and clamp each bus independently', () => {
    const s = useSettingsStore.getState()
    s.setMasterVolume(0.6)
    s.setEffectsVolume(1.7)
    s.setUiVolume(-1)
    expect(audio()).toMatchObject({ master: 0.6, game: 1, ui: 0, music: MUSIC_DEFAULT })
    s.setEffectsVolume(NaN)
    expect(audio().game).toBe(1)
  })

  it('music on/off keeps the slider level', () => {
    const s = useSettingsStore.getState()
    s.setMusicVolume(0.25)
    s.toggleMusic()
    expect(audio().music).toBe(0)
    expect(musicOn(audio())).toBe(false)
    s.toggleMusic()
    expect(audio().music).toBe(0.25)
  })

  it('dragging music to 0 is "off", and on comes back to the last level', () => {
    const s = useSettingsStore.getState()
    s.setMusicVolume(0.4)
    s.setMusicVolume(0)
    expect(musicOn(audio())).toBe(false)
    expect(audio().musicLevel).toBe(0.4)
    s.toggleMusic()
    expect(audio().music).toBe(0.4)
  })

  it('mute is independent of every level', () => {
    const s = useSettingsStore.getState()
    s.setUiVolume(0.33)
    s.toggleMute()
    expect(audio()).toMatchObject({ muted: true, ui: 0.33, music: MUSIC_DEFAULT })
    s.toggleMute()
    expect(audio().muted).toBe(false)
  })
})
