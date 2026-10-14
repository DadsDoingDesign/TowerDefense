import { describe, expect, it } from 'vitest'
import { isStopKind, MAX_LINE, STOP_LINES, stopLine, type StopKind } from '../src/ui/shell/stopScene'

describe('what the keeper says at a stop (Oct 2026)', () => {
  const kinds: StopKind[] = ['merchant', 'campfire', 'shrine', 'recruit']

  it('every stop kind has lines, and a node always says the same one', () => {
    for (const k of kinds) {
      expect(STOP_LINES[k].length).toBeGreaterThanOrEqual(3)
      for (let i = 0; i < 40; i++) expect(stopLine(k, `n${i}`)).toBe(stopLine(k, `n${i}`))
    }
  })

  it('different stops on a road say different things', () => {
    for (const k of kinds) {
      const said = new Set(Array.from({ length: 40 }, (_, i) => stopLine(k, `n${i}`)))
      expect(said.size).toBe(STOP_LINES[k].length)
    }
  })

  it('every line is speech, short enough for the bubble', () => {
    for (const k of kinds)
      for (const l of STOP_LINES[k]) {
        expect(l.startsWith('“') && l.endsWith('”')).toBe(true)
        expect(l.length).toBeLessThanOrEqual(MAX_LINE)
      }
  })

  it('knows a stop from anything else', () => {
    for (const k of kinds) expect(isStopKind(k)).toBe(true)
    for (const k of ['battle', 'elite', 'boss', '', null, undefined]) expect(isStopKind(k)).toBe(false)
  })
})
