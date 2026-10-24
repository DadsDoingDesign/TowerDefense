import { useState, type CSSProperties } from 'react'
import { companyById } from '../../../game/data/companies'
import { itemKindById, kindEffect, kindSlot } from '../../../game/data/itemKinds'
import { ITEM_BASES } from '../../../game/data/items'
import { desperateLine, PATRON_PURSE, type SeasonEnd } from '../../../game/run/tradeWar'
import { useMetaStore } from '../../../state/metaStore'
import { companyVar, itemIcon } from '../../channels'
import { Icon } from '../../Icon'
import { Crest } from '../../pixel'
import { PickCard, PickStrip, stepId } from '../PickStrip'
import { CompanyFlag, ContractPage, Gold, Slip, SlipLine } from '../contracts/parts'
import { Crown, ShareBar, shortName } from './WarParts'

const kindIcon = (kind: string) => itemIcon({ name: kind, slot: ITEM_BASES[kind]?.slot ?? 'oneHand' })

/**
 * A season's end (Draft 4 § D, simplified October 2026): shown at home after
 * the settle that finished the season's seventh contract, until it is read.
 * Your patron — the company you delivered the most for — pays you: its
 * standard, the purse (banked at the settle) on a slip, then a pick of one of
 * three of its items — the shared pick-one parts (`PickStrip` + `PickCard`),
 * the CTA names and takes it. No delivery, no patron: the page says so
 * plainly. Last, the next season: the company that came last and its
 * desperate terms, and the leader (outright only) the shares carry over.
 */
export function SeasonEndScreen({ end }: { end: SeasonEnd }) {
  const close = useMetaStore((s) => s.closeSeasonEnd)
  const banners = useMetaStore((s) => s.liveries)
  const patron = end.patron
  const [focus, setFocus] = useState<string | null>(end.vault[0]?.kind ?? null)
  const pick = end.vault.find((v) => v.kind === focus) ?? end.vault[0] ?? null
  const kind = pick ? itemKindById(pick.kind) : undefined
  const next = end.n + 1
  const title = patron ? `${shortName(patron)} pays you` : 'No company pays you'

  return (
    <ContractPage
      className="tw tw-end"
      label={`Season ${end.n} ends: ${title}`}
      head={
        <div className="tw-end-head" role="status" style={patron ? ({ '--co': companyVar(patron) } as CSSProperties) : undefined}>
          <p className="ct-eyebrow">Season {end.n} ends</p>
          {patron && (
            <div className="tw-end-art" aria-hidden="true">
              <CompanyFlag company={patron} look={banners[patron] ?? null} />
              <span className="tw-end-seal">
                <Crest company={patron} scale={4} />
              </span>
              <CompanyFlag company={patron} look={banners[patron] ?? null} />
            </div>
          )}
          <h1 className="ct-title lg" tabIndex={-1}>
            {title}
          </h1>
          <p className="ct-sub">{patron ? 'Your patron: you delivered the most for it this season.' : 'You delivered no contracts this season.'}</p>
        </div>
      }
      cta={{
        label: pick ? `Take the ${pick.kind}` : `On to Season ${next}`,
        run: () => close(pick?.kind ?? null),
        heavy: true,
      }}
    >
      {patron && (
        <Slip eyebrow="Banked" className="tw-pays">
          <SlipLine label={`For your ${end.delivered} ${end.delivered === 1 ? 'delivery' : 'deliveries'}`} note={`${PATRON_PURSE} each`} value={<Gold n={end.purse} />} />
        </Slip>
      )}

      {patron && pick && kind && (
        <div className="tw-vault">
          <PickStrip
            label={`Pick one of ${shortName(patron)}’s items`}
            tokens={end.vault.map((v) => ({
              id: v.kind,
              art: <Icon name={kindIcon(v.kind)} lg />,
              label: v.unlock ? 'New' : 'Rare',
              name: `${v.kind}: ${v.unlock ? 'unlocks it' : 'a Rare one for your next contract'}`,
              rail: companyVar(patron),
            }))}
            focused={focus}
            onFocus={setFocus}
          />
          <PickCard
            kicker={pick.unlock ? 'Unlocks it' : 'Rare bonus item'}
            name={pick.kind}
            index={end.vault.findIndex((v) => v.kind === pick.kind)}
            count={end.vault.length}
            onStep={(d) => setFocus(stepId(end.vault.map((v) => ({ id: v.kind })), focus, d))}
            noun="item"
            facts={[
              { label: 'Slot', value: kindSlot(kind) },
              { label: 'Level', value: kind.level },
              { label: 'Yours', value: pick.unlock ? 'for good' : 'next contract', tone: 'accent' },
            ]}
          >
            <p className="pk-does">{kindEffect(kind)}</p>
          </PickCard>
        </div>
      )}

      <section className="tw-next" aria-label={`Season ${next}`}>
        <p className="field-k">Season {next}</p>
        {end.desperate && (
          <div className="tw-next-row">
            <Crest company={end.desperate} scale={2} />
            <span>
              <b>{companyById(end.desperate).name} finished last</b>
              <span className="tw-next-terms">{desperateLine()}</span>
            </span>
          </div>
        )}
        {/* The shares carry half their lead into the new season (`tradeWar.regressShares`). */}
        {end.leader ? (
          <div className="tw-next-row is-lead">
            <Crown />
            <Crest company={end.leader} scale={2} />
            <span>
              <b>{shortName(end.leader)} leads into Season {next}</b>
              <span className="tw-next-sub">half its lead carries over</span>
            </span>
          </div>
        ) : (
          <div className="tw-next-row is-lead">
            <span>
              <b>No company leads</b>
              <span className="tw-next-sub">the biggest shares ended level</span>
            </span>
          </div>
        )}
        <ShareBar season={{ n: end.n, shares: end.shares, deliveries: {} as SeasonEnd['shares'] }} />
      </section>
    </ContractPage>
  )
}
