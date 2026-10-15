import type { CSSProperties } from 'react'
import type { CompanyId } from '../../../game/data/companies'
import { desperateLine, isDesperate } from '../../../game/run/tradeWar'
import { companyVar } from '../../channels'
import { useWar } from './WarParts'

/**
 * The trade war on a company's terms (Draft 4 § D): its one season fact,
 * said once — desperate terms (pays ×1.5, raiders 20% stronger), when it
 * finished last among those that hire you. Nothing before the war shows,
 * and nothing on any other company's terms.
 */
export function WarTerms({ company }: { company: CompanyId }) {
  const { open, season } = useWar()
  if (!open || !isDesperate(season, company)) return null
  return (
    <div className="tw-terms" style={{ '--co': companyVar(company) } as CSSProperties}>
      <p className="tw-fact is-desperate">
        <span className="field-k">Desperate terms · Season {season.n}</span>
        <span className="tw-fact-v">{desperateLine()}</span>
      </p>
    </div>
  )
}
