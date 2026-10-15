import { useEffect, type CSSProperties } from 'react'
import { companyById, type CompanyId } from '../../../game/data/companies'
import { DESPERATE_PAY, patronStatus, placeOf, ranked, seasonLast, seasonLeader } from '../../../game/run/tradeWar'
import { companyOpen } from '../../../game/run/standing'
import { useGameStore } from '../../../state/gameStore'
import { useMetaStore } from '../../../state/metaStore'
import { useSettingsStore } from '../../../state/settingsStore'
import { companyVar } from '../../channels'
import { Icon } from '../../Icon'
import { Crest } from '../../pixel'
import { ContractPage, Gold } from '../contracts/parts'
import { SeasonCard } from './SeasonCard'
import { Crown, DesperateChip, shortName, useWar } from './WarParts'

/**
 * The trade war's standings (Draft 4 § D), opened from the home's season
 * pill. The five companies ranked by their share of the trade, each with its
 * bar, how the last contract moved it, and your deliveries for it this
 * season; the crown on an outright leader only (level shares share a place),
 * and this season's desperate company tagged where it sits. Under them, the
 * season card (`SeasonCard`): when the season ends — said there, not in the
 * head — your patron and what it pays, and who is last now.
 *
 * The one CTA reads the terms that matter most now: the desperate company's,
 * whose contracts pay ×1.5 this season, else your patron's, else the leader's.
 */
export function StandingsScreen({ onBack }: { onBack: () => void }) {
  const { season } = useWar()
  const bank = useMetaStore((s) => s.bank)
  const xp = useMetaStore((s) => s.standing)
  const openContracts = useGameStore((s) => s.openContracts)
  const order = ranked(season)
  const lead = seasonLeader(season)
  const top = Math.max(...order.map((c) => season.shares[c]))
  const hires = (c: CompanyId | null): c is CompanyId => !!c && companyOpen(c, xp)
  const status = patronStatus(season)
  const last = seasonLast(season, (c) => companyOpen(c, xp))
  const cta = [season.desperate, status.patron, lead].find(hires) ?? null
  // Opening the standings reads the war's one tip.
  useEffect(() => useSettingsStore.getState().markTaught('war'), [])

  return (
    <ContractPage
      className="tw"
      label={`Season ${season.n}: the standings`}
      head={
        <div className="ct-hdr">
          <button className="ct-back" onClick={onBack} aria-label="Back to the roads">
            <Icon name="back" />
          </button>
          <span className="ct-who-text">
            <h1 className="ct-title sm" tabIndex={-1}>
              Season {season.n}
            </h1>
          </span>
          <span className="ct-chip" title="Your bank">
            <Gold n={bank} />
          </span>
        </div>
      }
      cta={cta ? { label: `Read ${shortName(cta)}’s terms`, run: () => openContracts({ company: cta }), heavy: true } : undefined}
    >
      <div className="tw-cols" aria-hidden="true">
        <span className="field-k">Share of the trade</span>
        <span className="field-k">You delivered</span>
      </div>
      <ol className="tw-rows" aria-label="The companies, by share of the trade">
        {order.map((c) => {
          const co = companyById(c)
          const share = season.shares[c]
          const moved = share - (season.before[c] ?? share)
          const got = season.deliveries[c] ?? 0
          const place = placeOf(season, c)
          const leads = lead === c
          return (
            <li
              key={c}
              className={`tw-row${leads ? ' is-lead' : ''}`}
              style={{ '--co': companyVar(c) } as CSSProperties}
              aria-label={`${leads ? 'Leads' : place === 1 ? 'Level first' : `${place}.`} ${co.name}: ${share}% of the trade${moved ? `, ${moved > 0 ? 'up' : 'down'} ${Math.abs(moved)} since the last contract` : ''}. You delivered ${got} this season.${season.desperate === c ? ` On desperate terms: pays ×${DESPERATE_PAY}.` : ''}`}
            >
              <span className="tw-rank" aria-hidden="true">
                {leads ? <Crown /> : place}
              </span>
              <span className="tw-co" aria-hidden="true">
                <Crest company={c} scale={2} />
                <b>{co.name}</b>
              </span>
              <span className="tw-share" aria-hidden="true">
                {share}%
                <small className={moved > 0 ? 'up' : moved < 0 ? 'down' : ''}>{moved > 0 ? `▲${moved}` : moved < 0 ? `▼${-moved}` : '–'}</small>
              </span>
              <span className="tw-got" aria-hidden="true">
                {got}
              </span>
              <span className="tw-track" aria-hidden="true">
                <span style={{ width: `${(share / top) * 100}%` }} />
              </span>
              {season.desperate === c && (
                <span className="tw-tags" aria-hidden="true">
                  <DesperateChip />
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <SeasonCard status={status} last={last} />
    </ContractPage>
  )
}
