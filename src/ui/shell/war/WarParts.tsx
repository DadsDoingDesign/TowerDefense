import type { CSSProperties } from 'react'
import { companyById, type CompanyId } from '../../../game/data/companies'
import { contractsLeft, DESPERATE_PAY, desperateLine, ranked, seasonLeader, type Season, type Shares } from '../../../game/run/tradeWar'
import { useMetaStore } from '../../../state/metaStore'
import { companyVar } from '../../channels'
import { Crest, Crown } from '../../pixel'

export { Crown }
import { useReveal } from '../staging'

/**
 * The trade war's shared parts (Draft 4 § D): the five-colour share bar, the
 * home's slim war strip, the leader's crown and the desperate chip. The rules
 * are `game/run/tradeWar.ts`; these only draw them.
 */

/** The trade war as the UI sees it: whether it shows yet (with the market), and the season. */
export function useWar(): { open: boolean; season: Season } {
  const reveal = useReveal()
  const season = useMetaStore((s) => s.season)
  return { open: reveal.war, season }
}

/** "Peppercorn Co." → "Peppercorn", where a line names the company twice or is short of room. */
export const shortName = (id: CompanyId): string => companyById(id).name.replace(/ Co\.$/, '')

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
 * The home's war strip (mockup 3a): "Trade war · Season 3", the contracts
 * left, and the share bar. One tap opens the standings.
 */
export function WarStrip({ season, onOpen }: { season: Season; onOpen: () => void }) {
  const left = contractsLeft(season)
  const lead = seasonLeader(season)
  return (
    <button
      type="button"
      className="tw-strip"
      onClick={onOpen}
      aria-label={`Trade war, season ${season.n}: ${left} contract${left === 1 ? '' : 's'} left. ${companyById(lead).name} leads with ${season.shares[lead]}%.${season.exclusive ? ` Your exclusive is with ${companyById(season.exclusive).name}.` : ''} Open the standings.`}
    >
      <span className="tw-strip-head" aria-hidden="true">
        <span className="field-k">
          <span className="tw-war-word">Trade war · </span>Season {season.n}
        </span>
        {/* Your exclusive this season, if signed: its logo, said once (mockup 4b). */}
        {season.exclusive && (
          <span className="tw-strip-ex">
            <Crest company={season.exclusive} scale={1} /> Exclusive
          </span>
        )}
        <span className="tw-left">
          {left} {season.exclusive ? '' : <span className="tw-war-word">{`contract${left === 1 ? '' : 's'} `}</span>}left <i>›</i>
        </span>
      </span>
      <ShareBar season={season} />
    </button>
  )
}

/** "Desperate · pays ×1.5" — a company on desperate terms this season. */
export const DesperateChip = () => (
  <span className="tw-chip is-desperate" title={desperateLine()}>
    Desperate · pays ×{DESPERATE_PAY}
  </span>
)
