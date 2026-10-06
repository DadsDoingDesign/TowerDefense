import { describe, expect, it } from 'vitest'
import { AUTO_CONTINUE_MS, autoContinueArmed, type AutoContinueFacts } from '../src/ui/shell/autoContinue'
import { migrateSettings } from '../src/state/settingsStore'

/*
 * Held sub-waves continue themselves (Oct 2026 audit, 2.3). The countdown's
 * go/no-go is pure; the hook around it only adds the timer and the touch
 * listeners. The battle side needs no test of its own: the countdown ends by
 * calling `resumeSubWave`, the same action Next does.
 */
const base: AutoContinueFacts = { enabled: true, taught: true, breather: true, held: false, touched: false }

describe('a held sub-wave counts down to continue itself', () => {
  it('runs on a plain hold', () => {
    expect(autoContinueArmed(base)).toBe(true)
    expect(AUTO_CONTINUE_MS).toBeGreaterThanOrEqual(3000)
    expect(AUTO_CONTINUE_MS).toBeLessThanOrEqual(5000)
  })

  it('never runs outside a hold', () => {
    expect(autoContinueArmed({ ...base, breather: false })).toBe(false)
  })

  it('stops for good once the player touches the field or a hero', () => {
    expect(autoContinueArmed({ ...base, touched: true })).toBe(false)
  })

  it('waits while a clearance conflict holds Next', () => {
    expect(autoContinueArmed({ ...base, held: true })).toBe(false)
  })

  it('lets the first hold of a first run teach the move (the sub-wave tip)', () => {
    expect(autoContinueArmed({ ...base, taught: false })).toBe(false)
  })

  it('is a setting: off means Next waits, as before', () => {
    expect(autoContinueArmed({ ...base, enabled: false })).toBe(false)
  })

  it('defaults on, and a stored "off" survives a reload', () => {
    const none = () => null
    expect(migrateSettings({}, 5, none).autoContinue).toBe(true)
    expect(migrateSettings({ autoContinue: false }, 5, none).autoContinue).toBe(false)
    expect(migrateSettings({ autoContinue: 'no' }, 5, none).autoContinue).toBe(true)
  })
})
