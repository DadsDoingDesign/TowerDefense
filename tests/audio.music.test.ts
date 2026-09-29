import { describe, expect, it } from 'vitest'
import { cueFor } from '../src/audio/director'
import { resumeStep } from '../src/audio/music'

describe('resumeStep', () => {
  it('restarts the battle cue at bar 1 every time', () => {
    expect(resumeStep('battle', 0)).toBe(0)
    expect(resumeStep('battle', 77)).toBe(0)
  })

  it('resumes the hub at the start of the bar it stopped in', () => {
    expect(resumeStep('hub', 0)).toBe(0)
    expect(resumeStep('hub', 15)).toBe(0)
    expect(resumeStep('hub', 16)).toBe(16)
    expect(resumeStep('hub', 45)).toBe(32)
  })

  it('wraps to one lap of the eight-bar progression', () => {
    expect(resumeStep('hub', 8 * 16)).toBe(0)
    expect(resumeStep('hub', 8 * 16 * 3 + 5 * 16 + 3)).toBe(5 * 16)
    expect(resumeStep('hub', -4)).toBe(0)
  })
})

describe('cueFor', () => {
  const live = { screen: 'battle', battlePhase: 'battle', engine: {}, runPhase: 'active' }
  it('plays battle only during a live wave, hub otherwise, nothing at zero volume', () => {
    expect(cueFor(live, 0.5)).toBe('battle')
    expect(cueFor({ ...live, battlePhase: 'setup' }, 0.5)).toBe('hub')
    expect(cueFor(live, 0)).toBe(null)
  })
})
