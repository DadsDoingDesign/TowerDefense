import { describe, expect, it } from 'vitest'
import { frontierScrollTop, openingFocus, useMapFocus } from '../src/ui/shell/mapFocus'

/*
 * Oct 2026 audit, 3.7: the run map scrolls so the reachable row is fully on
 * screen — on first view and after a win — instead of parking the current
 * node 65% down a box the route panel has already shortened.
 */
describe('the run map keeps the reachable row in view', () => {
  const above = 64
  const below = 56
  const visible = (top: number, box: number, y: number) => y - above >= top && y + below <= top + box

  it('shows the current node and the row above it, centred, when both fit', () => {
    const top = frontierScrollTop({ curY: 900, reachYs: [796, 796], box: 300 })
    expect(visible(top, 300, 900)).toBe(true)
    expect(visible(top, 300, 796)).toBe(true)
  })

  it('a phone after a win: the reachable row is never cut by the top edge', () => {
    // The box measured 270px under the route panel on a 390x844 phone.
    for (const box of [200, 240, 270, 320]) {
      const top = frontierScrollTop({ curY: 1000, reachYs: [896, 896, 896], box })
      expect(top).toBeLessThanOrEqual(896 - above)
    }
  })

  it('when the two do not fit, the reachable row wins', () => {
    const top = frontierScrollTop({ curY: 1000, reachYs: [896], box: 180 })
    expect(top).toBe(896 - above)
  })

  it('never scrolls past the top of the map', () => {
    expect(frontierScrollTop({ curY: 62, reachYs: [], box: 600 })).toBe(0)
  })
})

describe('the stop the map opens on (Oct 2026 review)', () => {
  it('is the first stop you can still march to', () => {
    expect(openingFocus(['n2-0', 'n2-1'], [])).toBe('n2-0')
    expect(openingFocus(['n2-0', 'n2-1'], ['n2-0'])).toBe('n2-1')
  })
  it('is nothing when the road ahead is closed', () => {
    expect(openingFocus([], [])).toBeNull()
    expect(openingFocus(['n2-0'], ['n2-0'])).toBeNull()
  })
  it('an offered focus is the map’s, so a tap on it is still a look', () => {
    useMapFocus.getState().offer('n2-0')
    expect(useMapFocus.getState()).toMatchObject({ nodeId: 'n2-0', auto: true })
    useMapFocus.getState().focus('n2-0')
    expect(useMapFocus.getState()).toMatchObject({ nodeId: 'n2-0', auto: false })
  })
})
