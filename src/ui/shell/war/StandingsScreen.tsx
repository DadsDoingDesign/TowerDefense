import { useEffect, type CSSProperties } from 'react'
import { companyById, type CompanyId } from '../../../game/data/companies'
import {
  CHAMPION_MIN,
  CHAMPION_PURSE,
  DESPERATE_PAY,
  isCold,
  ranked,
  seasonLeader,
  SEASON_LENGTH,
  VAULT_PICKS,
} from '../../../game/run/tradeWar'
import { companyOpen } from '../../../game/run/standing'
import { useGameStore } from '../../../state/gameStore'
import { useMetaStore } from '../../../state/metaStore'
import { useSettingsStore } from '../../../state/settingsStore'
import { companyVar } from '../../channels'
import { Icon } from '../../Icon'
import { Crest } from '../../pixel'
import { ContractPage, Gold, Slip, SlipLine } from '../contracts/parts'
import { Crown, DesperateChip, shortName, useWar } from './WarParts'

/**
 * The trade war's standings (Draft 4 § D, mockup 3b), opened from the home's
 * war strip. The five companies ranked by their share of the trade, each with
 * its bar, how the last contract moved it, and your deliveries for it this
 * season; this season's desperate company and the exclusive marked where they
 * sit. Under them, what the season's end pays — the leader's purse and vault
 * for its top militia, desperate terms from the last — and where you stand
 * with the leader.
 *
 * The one CTA reads the terms that matter most now: the desperate company's,
 * whose contracts pay ×1.5 this season, else the leader's.
 */
export function StandingsScreen({ onBack }: { onBack: () => void }) {
  const { season } = useWar()
  const bank = useMetaStore((s) => s.bank)
  const xp = useMetaStore((s) => s.standing)
  const openContracts = useGameStore((s) => s.openContracts)
  const order = ranked(season)
  const lead = seasonLeader(season)
  const top = Math.max(...order.map((c) => season.shares[c]))
  const mine = season.deliveries[lead] ?? 0
  const hires = (c: CompanyId | null): c is CompanyId => !!c && companyOpen(c, xp)
  const cta = hires(season.desperate) ? season.desperate : hires(lead) ? lead : null
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
            <span>
              Contract {Math.min(SEASON_LENGTH, season.contracts + 1)} of {SEASON_LENGTH}
            </span>
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
        {order.map((c, i) => {
          const co = companyById(c)
          const share = season.shares[c]
          const moved = share - (season.before[c] ?? share)
          const got = season.deliveries[c] ?? 0
          const cold = isCold(season, c)
          return (
            <li
              key={c}
              className={`tw-row${i === 0 ? ' is-lead' : ''}${cold ? ' is-cold' : ''}`}
              style={{ '--co': companyVar(c) } as CSSProperties}
              aria-label={`${i + 1}. ${co.name}: ${share}% of the trade${moved ? `, ${moved > 0 ? 'up' : 'down'} ${Math.abs(moved)} since the last contract` : ''}. You delivered ${got} this season.${season.desperate === c ? ` On desperate terms: pays ×${DESPERATE_PAY}.` : ''}${season.exclusive === c ? ' Your exclusive.' : ''}${cold ? ' Cold to you this season.' : ''}`}
            >
              <span className="tw-rank" aria-hidden="true">
                {i === 0 ? <Crown /> : i + 1}
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
              {(season.desperate === c || season.exclusive === c || cold) && (
                <span className="tw-tags" aria-hidden="true">
                  {season.desperate === c && <DesperateChip />}
                  {season.exclusive === c && <span className="tw-chip is-exclusive">Your exclusive</span>}
                  {cold && <span className="tw-chip is-cold">Cold</span>}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      <Slip eyebrow="When the season ends · the leader pays" className="tw-pays">
        <SlipLine label="Its purse" value={<>{CHAMPION_PURSE} a delivery</>} />
        <SlipLine label="A pick from its vault" value={`1 of ${VAULT_PICKS} items`} />
        <SlipLine label="The last posts desperate terms" value={`×${DESPERATE_PAY} pay`} />
        <p className="ct-slip-note">
          Its top militia delivers {CHAMPION_MIN} or more of its contracts in the season. {companyById(lead).name} leads, and you have delivered {mine}
          {mine >= CHAMPION_MIN ? ': you are its top militia.' : '.'}
        </p>
      </Slip>
    </ContractPage>
  )
}
