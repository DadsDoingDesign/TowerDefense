import { describe, expect, it } from 'vitest'
import { ARRIVAL_MS, classifyPress, commits, HOLD_MS, SLOP_PX, travelOf, type Press } from '../src/ui/shell/press'

/**
 * One-tap commits (October 2026): rewards and the campfire commit on a tap,
 * and only on a tap. `classifyPress` is the whole rule; `oneTap.tsx` only
 * measures real events into a `Press`.
 */
const shown = 1000
const at = (downAfterShown: number, held: number, travel = 0, cancelled = false): Press => ({
  shownAt: shown,
  downAt: shown + downAfterShown,
  upAt: shown + downAfterShown + held,
  travel,
  cancelled,
})

describe('classifyPress — tap vs hold vs drag vs too soon', () => {
  it('a still, short press well after the surface appeared is a tap, and commits', () => {
    expect(classifyPress(at(600, 90))).toBe('tap')
    expect(commits(at(600, 90))).toBe(true)
  })

  it('a press held for the hold time is a look: it never commits', () => {
    expect(classifyPress(at(600, HOLD_MS))).toBe('hold')
    expect(classifyPress(at(600, 2000))).toBe('hold')
    expect(commits(at(600, HOLD_MS))).toBe(false)
    // One millisecond short of the hold is still a tap.
    expect(classifyPress(at(600, HOLD_MS - 1))).toBe('tap')
  })

  it('a press that travels past the slop is a scroll, however short', () => {
    expect(classifyPress(at(600, 60, SLOP_PX + 0.5))).toBe('drag')
    expect(classifyPress(at(600, 60, 40))).toBe('drag')
    expect(commits(at(600, 60, 40))).toBe(false)
    // Within the slop a finger's wobble is still a tap.
    expect(classifyPress(at(600, 60, SLOP_PX))).toBe('tap')
  })

  it('a drag outranks a hold: a long press that scrolled is a scroll', () => {
    expect(classifyPress(at(600, 900, 30))).toBe('drag')
  })

  it('a press the browser cancelled (it became a scroll) never commits', () => {
    expect(classifyPress(at(600, 40, 0, true))).toBe('drag')
  })

  it('a press that starts within the arrival guard is ignored, whatever it was', () => {
    // The tail of a double-tap on the previous screen's button.
    expect(classifyPress(at(0, 60))).toBe('tooSoon')
    expect(classifyPress(at(ARRIVAL_MS - 1, 60))).toBe('tooSoon')
    expect(classifyPress(at(120, 900))).toBe('tooSoon')
    expect(classifyPress(at(120, 60, 50))).toBe('tooSoon')
    expect(commits(at(ARRIVAL_MS - 1, 60))).toBe(false)
    // From the guard's edge on, a tap is a tap.
    expect(classifyPress(at(ARRIVAL_MS, 60))).toBe('tap')
  })

  it('a keyboard activation (no travel, no hold) commits once the guard has passed', () => {
    const key = (t: number): Press => ({ shownAt: shown, downAt: shown + t, upAt: shown + t, travel: 0 })
    expect(classifyPress(key(400))).toBe('tap')
    expect(classifyPress(key(100))).toBe('tooSoon')
  })

  it('the thresholds are the ones the designer approved', () => {
    expect(HOLD_MS).toBe(350)
    expect(SLOP_PX).toBe(8)
    expect(ARRIVAL_MS).toBe(250)
  })
})

describe('travelOf', () => {
  it('is the straight-line distance in CSS px', () => {
    expect(travelOf({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
    expect(travelOf({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(0)
  })
})
