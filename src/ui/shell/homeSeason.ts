/**
 * The home's season panel (October 2026, the designer's "option 2") — the
 * PURE half. Under the purse, a small glass panel says the trade war's season
 * ("SEASON 3", "3 left ›") over a row of seven bars, one per contract of the
 * season, in order (`tradeWar.seasonBars`, read off `season.log`): a contract
 * delivered takes the colour of the company it was delivered for, a fall or
 * a cash-out (`'miss'`) a muted earth tone, and the contracts still to come
 * are dim. The whole panel opens the standings. `tests/homeSeason.test.ts`
 * drives it.
 */
import { companyById, type CompanyId } from '../../game/data/companies'
import type { SeasonBar } from '../../game/run/tradeWar'

/** A bar's class on the panel: delivered (in its company's colour), missed, or still ahead. */
export const barKind = (b: SeasonBar): 'delivered' | 'fell' | 'ahead' => (b == null ? 'ahead' : b === 'miss' ? 'fell' : 'delivered')

/** The panel's accessible name: the season, what is left, who leads, and each contract so far. */
export function seasonPanelName(n: number, left: number, leader: CompanyId | null, bars: readonly SeasonBar[]): string {
  const said = bars.filter((b) => b != null).map((b) => (b === 'miss' ? 'fell or cashed out' : `delivered for ${companyById(b as CompanyId).name.replace(/ Co\.$/, '')}`))
  return `Trade war, season ${n}: ${left} contract${left === 1 ? '' : 's'} left${leader ? `, ${companyById(leader).name} leads` : ''}${said.length ? `. So far: ${said.join(', ')}` : ''}. Open the standings.`
}
