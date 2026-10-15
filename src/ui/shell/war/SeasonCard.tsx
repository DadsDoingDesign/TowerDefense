import type { CSSProperties } from 'react'
import type { CompanyId } from '../../../game/data/companies'
import type { PatronStatus } from '../../../game/run/tradeWar'
import { companyVar } from '../../channels'
import { Crest } from '../../pixel'
import { Gold, Slip, SlipLine } from '../contracts/parts'
import { seasonCardCopy } from './seasonCardCopy'

/**
 * The standings' season card (October 2026, the simplified trade war): one
 * paper ledger under the rows. Its eyebrow says when the season ends (the
 * page says it nowhere else); the status line names your patron with its
 * crest — or no patron yet, or the companies level in your deliveries — and
 * what it would pay if the season ended now; two `SlipLine` rows say what it
 * pays; the foot names the company last now and its desperate terms next
 * season. The words are `seasonCardCopy.ts`.
 */
export function SeasonCard({ status: st, last }: { status: PatronStatus; last: CompanyId | null }) {
  const c = seasonCardCopy(st, last)
  const crests = st.state === 'tied' ? st.level : st.patron ? [st.patron] : []
  return (
    <Slip eyebrow={c.when} className="tw-card">
      <div className="tw-pat" role="group" aria-label={`${c.headline}. ${c.sub}${c.sum != null ? ` ${c.sum} gold so far.` : ''}`}>
        <span className={`tw-pat-art${crests.length ? '' : ' is-empty'}`} aria-hidden="true">
          {crests.map((co) => (
            <span key={co} className="tw-pat-crest" style={{ '--co': companyVar(co) } as CSSProperties}>
              <Crest company={co} scale={crests.length > 1 ? 2 : 3} />
            </span>
          ))}
        </span>
        <span className="tw-pat-who" aria-hidden="true">
          <b className="tw-pat-name">{c.headline}</b>
          <span className="tw-pat-sub">{c.sub}</span>
        </span>
        {c.sum != null && (
          <span className="tw-pat-sum" aria-hidden="true">
            <Gold n={c.sum} />
            <small className="field-k">so far</small>
          </span>
        )}
      </div>
      {c.pays.map((p) => (
        <SlipLine key={p.k} label={p.k} value={p.gold != null ? <Gold n={p.gold} word /> : p.v} />
      ))}
      {c.next && (
        <div className="tw-card-next" aria-label={`${c.next.k}. ${c.next.v}.`}>
          <Crest company={c.next.company} scale={2} />
          <span aria-hidden="true">
            <b>{c.next.k}</b>
            <span>{c.next.v}</span>
          </span>
        </div>
      )}
    </Slip>
  )
}
