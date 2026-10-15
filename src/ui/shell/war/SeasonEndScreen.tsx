import { useState, type CSSProperties } from 'react'
import { companyById } from '../../../game/data/companies'
import { itemKindById } from '../../../game/data/itemKinds'
import { ITEM_BASES } from '../../../game/data/items'
import { CHAMPION_MIN, desperateLine, type SeasonEnd } from '../../../game/run/tradeWar'
import { useMetaStore } from '../../../state/metaStore'
import { companyVar, itemIcon } from '../../channels'
import { Icon } from '../../Icon'
import { Crest } from '../../pixel'
import { PickCard, PickStrip, stepId } from '../PickStrip'
import { CompanyFlag, ContractPage, Gold, Slip, SlipLine } from '../contracts/parts'
import { Crown, ShareBar, shortName } from './WarParts'

const SLOT_WORD: Record<string, string> = { oneHand: 'Weapon', twoHand: 'Weapon', offHand: 'Off hand', body: 'Body' }
const kindIcon = (kind: string) => itemIcon({ name: kind, slot: ITEM_BASES[kind]?.slot ?? 'oneHand' })

/**
 * A season's end (Draft 4 § D, mockup 3c): shown at home after the settle
 * that finished the season's seventh contract, until it is read. The leader
 * takes the season — its standard, its share, and whether you were its top
 * militia. A champion is paid: the purse (banked at the settle) on a slip,
 * then a pick of one of three items from its vault — the shared pick-one
 * parts (`PickStrip` + `PickCard`), the CTA names and takes it. Last, the
 * next season: the company that finished last and its desperate terms.
 */
export function SeasonEndScreen({ end }: { end: SeasonEnd }) {
  const close = useMetaStore((s) => s.closeSeasonEnd)
  const banners = useMetaStore((s) => s.liveries)
  const lead = companyById(end.leader)
  const [focus, setFocus] = useState<string | null>(end.vault[0]?.kind ?? null)
  const pick = end.vault.find((v) => v.kind === focus) ?? end.vault[0] ?? null
  const kind = pick ? itemKindById(pick.kind) : undefined
  const next = end.n + 1
  const sub = end.champion
    ? `${end.share}% of the trade · you were its top militia`
    : `${end.share}% of the trade · you delivered ${end.delivered} of its contracts (its top militia delivers ${CHAMPION_MIN})`

  return (
    <ContractPage
      className="tw tw-end"
      label={`${lead.name} takes the season`}
      head={
        <div className="tw-end-head" role="status" style={{ '--co': companyVar(end.leader) } as CSSProperties}>
          <p className="ct-eyebrow">Season {end.n} ends</p>
          <div className="tw-end-art" aria-hidden="true">
            <CompanyFlag company={end.leader} look={banners[end.leader] ?? null} />
            <span className="tw-end-seal">
              <span className="tw-end-crown">
                <Crown scale={3} />
              </span>
              <Crest company={end.leader} scale={4} />
            </span>
            <CompanyFlag company={end.leader} look={banners[end.leader] ?? null} />
          </div>
          <h1 className="ct-title lg" tabIndex={-1}>
            {shortName(end.leader)} takes the season
          </h1>
          <p className="ct-sub">{sub}</p>
        </div>
      }
      cta={{
        label: pick ? `Take the ${pick.kind}` : `On to Season ${next}`,
        run: () => close(pick?.kind ?? null),
        heavy: true,
      }}
    >
      {end.champion && (
        <Slip eyebrow={`${lead.name} pays its champion`} className="tw-pays">
          <SlipLine label="Its purse" note={`${end.delivered} deliveries · banked`} value={<Gold n={end.purse} />} />
          {end.vault.length > 0 && <SlipLine label="A pick from its vault" value={`one of ${end.vault.length}`} />}
        </Slip>
      )}

      {pick && kind && (
        <div className="tw-vault">
          <PickStrip
            label={`${lead.name}’s vault: pick one`}
            tokens={end.vault.map((v) => ({
              id: v.kind,
              art: <Icon name={kindIcon(v.kind)} lg />,
              label: v.unlock ? 'New' : 'Rare',
              name: `${v.kind}: ${v.unlock ? 'unlocks it' : 'a Rare one for your next contract'}`,
              rail: companyVar(end.leader),
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
              { label: 'Slot', value: SLOT_WORD[kind.slot] },
              { label: 'Level', value: kind.level },
              { label: 'Yours', value: pick.unlock ? 'for good' : 'next contract', tone: 'accent' },
            ]}
          >
            <p className="pk-does">{kind.does}</p>
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
        <div className="tw-next-row is-lead">
          <Crest company={end.leader} scale={2} />
          <span>
            <b>{shortName(end.leader)}’s banners line every road</b>
            <span className="tw-next-sub">while it leads the trade</span>
          </span>
        </div>
        <ShareBar season={{ n: end.n, shares: end.shares, deliveries: {} as SeasonEnd['shares'] }} />
      </section>
    </ContractPage>
  )
}
