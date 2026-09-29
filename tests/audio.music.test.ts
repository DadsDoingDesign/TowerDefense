import { describe, expect, it } from 'vitest'
import { cueFor } from '../src/audio/director'
import { resumeBar } from '../src/audio/music'

describe('resumeBar', () => {
  it('restarts the battle cue and the outros at bar 1 every time', () => {
    expect(resumeBar('battle', 0)).toBe(0)
    expect(resumeBar('battle', 77)).toBe(0)
    expect(resumeBar('victory', 3)).toBe(0)
  })

  it('resumes the hub at the start of the four-bar phrase it stopped in', () => {
    expect(resumeBar('hub', 0)).toBe(0)
    expect(resumeBar('hub', 3)).toBe(0)
    expect(resumeBar('hub', 4)).toBe(4)
    expect(resumeBar('hub', 11)).toBe(8)
  })

  it('wraps to one lap of the form', () => {
    expect(resumeBar('hub', 32)).toBe(0)
    expect(resumeBar('hub', 32 * 3 + 21)).toBe(20)
    expect(resumeBar('hub', -4)).toBe(0)
  })
})

describe('cueFor', () => {
  const live = { screen: 'battle', battlePhase: 'battle', engine: {}, runPhase: 'active' }
  it('plays battle only during a live wave, prep around it, hub at home, nothing at zero volume', () => {
    expect(cueFor(live, 0.5)).toBe('battle')
    expect(cueFor({ ...live, battlePhase: 'setup' }, 0.5)).toBe('prep')
    expect(cueFor({ ...live, screen: 'map', battlePhase: 'setup', engine: null }, 0.5)).toBe('prep')
    expect(cueFor({ ...live, screen: 'hub', battlePhase: 'setup', engine: null }, 0.5)).toBe('hub')
    expect(cueFor(live, 0)).toBe(null)
  })
  it('gives a finished run its outro', () => {
    expect(cueFor({ ...live, runPhase: 'won' }, 0.5)).toBe('victory')
    expect(cueFor({ ...live, runPhase: 'lost', screen: 'hub' }, 0.5)).toBe('defeat')
  })
})
