import type { CSSProperties } from 'react'
import { companyById, type CompanyId } from '../../../game/data/companies'
import { DESPERATE_PAY, desperateLine, ranked, type Season, type Shares } from '../../../game/run/tradeWar'
import { useMetaStore } from '../../../state/metaStore'
import { companyVar } from '../../channels'
import { Crown } from '../../pixel'

export { Crown }
import { useReveal } from '../staging'

/**
 * The trade war's shared parts (Draft 4 § D): the five-colour share bar, the
 * leader's crown and the desperate chip. (On the home, the war is the dock's
 * shares and the season pill: `MenuScreen`.) The rules
 * are `game/run/tradeWar.ts`; these only draw them.
 */

/** The trade war as the UI sees it: whether it shows yet (with the market), and the season. */
export function useWar(): { open: boolean; season: Season } {
  const reveal = useReveal()
  const season = useMetaStore((s) => s.season)
  return { open: reveal.war, season }
}

export { shortName } from './seasonCardCopy'

/**
 * The five shares as one bar: a segment per company in its colour, widest
 * first, its share inside when there is room. Colour never carries it alone:
 * the accessible name reads every company and its share.
 */
export function ShareBar({ season, className }: { season: Pick<Season, 'n' | 'shares' | 'deliveries'>; className?: string }) {
  const order = ranked(season)
  return (
    <span className={`tw-bar${className ? ` ${className}` : ''}`} role="img" aria-label={shareWords(season.shares, order)}>
      {order.map((c) => (
        <span key={c} className="tw-seg" style={{ flexGrow: season.shares[c], '--co': companyVar(c) } as CSSProperties}>
          {season.shares[c] >= 9 && <span aria-hidden="true">{season.shares[c]}%</span>}
        </span>
      ))}
    </span>
  )
}

const shareWords = (shares: Shares, order: readonly CompanyId[]) => `Share of the trade: ${order.map((c) => `${companyById(c).name} ${shares[c]}%`).join(', ')}`

/**
 * "This season: pays ×1.5" — the company on desperate terms THIS season, on
 * its standings row. It says "this season" because the season card under the
 * rows names the company last now, whose terms are NEXT season's: the two
 * must never read as one fact contradicting the other.
 */
export const DesperateChip = () => (
  <span className="tw-chip is-desperate" title={desperateLine()}>
    This season: pays ×{DESPERATE_PAY}
  </span>
)
