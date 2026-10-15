import { describe, expect, it } from 'vitest'
import { freshSeason, seasonBars, SEASON_LENGTH } from '../src/game/run/tradeWar'
import { barKind, seasonPanelName } from '../src/ui/shell/homeSeason'

/*
 * The home's season panel (October 2026): a bar per contract of the season,
 * in order — delivered (the company's colour), fell or cashed out (earth), or
 * still to come (dim). Always the season's length, so the panel never changes
 * size.
 */
describe('the season panel', () => {
  it('a fresh season: every bar still to come', () => {
    const bars = seasonBars(freshSeason())
    expect(bars).toHaveLength(SEASON_LENGTH)
    expect(bars.map(barKind).every((k) => k === 'ahead')).toBe(true)
  })

  it('reads the season’s log in order: delivered, missed, then the ones to come', () => {
    const bars = seasonBars({ contracts: 4, log: ['metals', null, 'spice', 'metals'] })
    expect(bars.map(barKind)).toEqual(['delivered', 'fell', 'delivered', 'delivered', 'ahead', 'ahead', 'ahead'])
    expect(bars.slice(0, 4)).toEqual(['metals', 'miss', 'spice', 'metals'])
  })

  it('its name says the season, what is left, who leads and each contract so far', () => {
    const bars = seasonBars({ contracts: 2, log: ['art', null] })
    expect(seasonPanelName(3, 5, 'metals', bars)).toBe(
      'Trade war, season 3: 5 contracts left, Ironvein leads. So far: delivered for Easel House, fell or cashed out. Open the standings.',
    )
    expect(seasonPanelName(1, 7, null, seasonBars(freshSeason()))).toBe('Trade war, season 1: 7 contracts left. Open the standings.')
  })
})
