import { describe, expect, it } from 'vitest'
import { freshSeason, patronStatus, PATRON_PURSE, recordContract, SEASON_LENGTH, seasonLast, type Season, type WarContract } from '../src/game/run/tradeWar'
import type { CompanyId } from '../src/game/data/companies'
import { seasonCardCopy } from '../src/ui/shell/war/seasonCardCopy'

/*
 * The standings' season card, in words, for each state the simplified trade
 * war can be in (October 2026): no delivery yet, one company ahead in your
 * deliveries, a tie (broken by share, or by the season's hash), and the
 * season's last contract. The card never repeats a share or a per-company
 * delivery count — the rows above it carry those.
 */
const deliver = (company: CompanyId, crates = 0): WarContract => ({ company, crates, status: 'delivered' })
const play = (s: Season, list: WarContract[]): Season => list.reduce(recordContract, s)
const card = (s: Season) => seasonCardCopy(patronStatus(s), seasonLast(s))

describe('the season card', () => {
  it('no delivery yet: no patron, what one would pay, no running amount', () => {
    const c = card(play(freshSeason(), [{ company: 'art', crates: 0, status: 'lost' }]))
    expect(c.when).toBe(`The season ends in ${SEASON_LENGTH - 1} contracts`)
    expect(c.headline).toBe('No patron yet')
    expect(c.sub).toBe('Whichever company you deliver the most for pays you.')
    expect(c.sum).toBeNull()
    expect(c.pays).toEqual([
      { k: 'Each contract you deliver for it', v: `${PATRON_PURSE} gold`, gold: PATRON_PURSE },
      { k: 'One of its items', v: 'pick 1 of 3' },
    ])
  })

  it('one company ahead in your deliveries: it is your patron, with what it pays so far', () => {
    const c = card(play(freshSeason(), [deliver('metals'), deliver('silk'), deliver('metals')]))
    expect(c.headline).toBe('Ironvein is your patron')
    expect(c.sub).toBe('You delivered the most for it this season.')
    expect(c.sum).toBe(2 * PATRON_PURSE)
    expect(c.pays[1].k).toBe('One Ironvein item')
    expect(c.when).toBe(`The season ends in ${SEASON_LENGTH - 3} contracts`)
  })

  it('tied in your deliveries: both named, and what breaks the tie', () => {
    const c = card(play(freshSeason(), [deliver('metals', 8), deliver('art')]))
    expect(c.headline).toBe('Ironvein and Butcherblock are level')
    expect(c.sub).toBe('A tie goes to the bigger share: Ironvein pays, for now.')
    expect(c.sum).toBe(PATRON_PURSE)
    // Level on share too: the season's hash, said as "for now".
    const flat = { ...freshSeason(), contracts: 2, deliveries: { ...freshSeason().deliveries, metals: 1, art: 1 } }
    expect(card(flat).sub).toMatch(/^Your deliveries and their shares are level: (Ironvein|Butcherblock) pays, for now\.$/)
  })

  it('the season’s last contract: said as such, and with no delivery yet, what one would do', () => {
    const ahead = card(play(freshSeason(), Array.from({ length: SEASON_LENGTH - 1 }, () => deliver('spice'))))
    expect(ahead.when).toBe('The season’s last contract is next')
    const none = card(play(freshSeason(), Array.from({ length: SEASON_LENGTH - 1 }, () => ({ company: 'art' as const, crates: 0, status: 'cashedOut' as const }))))
    expect(none.headline).toBe('No patron yet')
    expect(none.sub).toBe('Deliver your next contract, and its company pays you.')
  })

  it('next season: the company last now and its desperate terms; none when every company is level', () => {
    const c = card(play(freshSeason(), [deliver('metals'), deliver('metals'), { company: 'silk', crates: 0, status: 'lost' }]))
    expect(c.next).toEqual({ company: 'silk', k: 'Last now: Rosethread', v: 'Next season it pays ×1.5, and its raiders are 20% stronger' })
    expect(card(freshSeason()).next).toBeNull()
  })

  it('never repeats a share or a per-company count the rows show', () => {
    const s = play(freshSeason(), [deliver('metals'), deliver('silk'), deliver('metals')])
    const { next, ...rest } = card(s)
    const words = JSON.stringify(rest)
    expect(next).not.toBeNull()
    expect(words).not.toMatch(/%/)
    expect(words).not.toMatch(/\bdelivered \d/)
  })
})
