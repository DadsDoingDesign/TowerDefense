import { RARITY } from '../../../game/data/items'
import { companyById } from '../../../game/data/companies'
import { SOVEREIGN_ITEM_KINDS } from '../../../game/data/itemKinds'
import { CITY_COUNT, contractBanked, contractStake, cratesLeftAfter } from '../../../game/run/contracts'
import { CHARTER_FEE, CHARTER_NAME, routeOf } from '../../../game/run/charter'
import { useMetaStore } from '../../../state/metaStore'
import { SovereignReveal } from '../charter/SovereignParts'
import { useGameStore } from '../../../state/gameStore'
import { assistProfile, useSettingsStore, type AssistLevel } from '../../../state/settingsStore'
import { itemName, strengthText } from '../../channels'
import { Coin } from '../../pixel'
import { DefeatReceipt } from '../DefeatReceipt'
import { FeatsEarned } from '../FeatsEarned'
import { InfoCard } from '../Page'
import { Icon } from '../../Icon'
import { StandingEarned, UnlocksEarned } from '../ProgressEarned'
import { stakeLine } from '../offers'
import { ContractPage, Gold, Slip, SlipLine } from './parts'

/**
 * How a contract ends (the mercenary company; mockup `trade/r3/6-complete.png`):
 *
 *  - **Delivered** — the destination's gold leads, then what the contract paid
 *    in all, then every unlock as its card (labelled by what paid for it: the
 *    contract, a stake milestone, a standing level), then the standing card.
 *  - **Cashed out** — the gold banked, the cities' receipt, the standing kept.
 *  - **The wagons fell** — the cause first (`DefeatReceipt`), then what was
 *    kept (the cities' pay and the road's share) and what was lost (unsold
 *    crates). The company's advance is never banked.
 *  - **The Sovereign Route** (the endgame charter) — delivered, the payout
 *    leads and the Sovereign item it unlocked is revealed as its card; fallen,
 *    the head says plainly that the fee is lost.
 *
 * Every number is read off the run's receipt (`state.victory`, built at the
 * settle), so the page cannot disagree with what the bank received.
 */
export function ResultScreen() {
  const recap = useGameStore((s) => s.victory)
  const runPhase = useGameStore((s) => s.runPhase)
  const returnToHub = useGameStore((s) => s.returnToHub)
  const runAgain = useGameStore((s) => s.runAgain)
  const clearedNodeIds = useGameStore((s) => s.clearedNodeIds)
  const assist = useSettingsStore((s) => s.assist)
  const setAssist = useSettingsStore((s) => s.setAssist)
  const outcome = recap?.outcome ?? (runPhase === 'won' ? 'delivered' : runPhase === 'cashedOut' ? 'cashedOut' : 'lost')
  const c = recap?.contract ?? null
  const charter = !!c?.charter
  const co = c?.company ? companyById(c.company) : null
  const route = c ? routeOf(c) : null
  const owned = useMetaStore((s) => s.sovereign.length)
  const depth = recap?.depth ?? Math.max(0, clearedNodeIds.length - 1)
  const deposit = recap?.deposit ?? 0
  const paidAll = c ? c.paid.reduce((a, b) => a + b, 0) : 0
  const stake = c ? contractStake(c) : 0
  const lost = c && outcome === 'lost' ? cratesLeftAfter(c.crates, c.paid.length) : 0
  // The purse's split (the road-gold share): what was left of the purse comes
  // home in full; of the road's gold, only a share does.
  const home = recap?.home ?? null
  const interest = recap?.interest ?? 0
  const dest = route?.towns[CITY_COUNT - 1] ?? 'the end of the road'
  const town = route && c ? route.towns[Math.max(0, c.paid.length - 1)] : ''

  const eyebrow = charter
    ? outcome === 'delivered'
      ? `${dest} · the charter is paid`
      : `${CHARTER_NAME} · charter lost`
    : outcome === 'delivered'
      ? `${dest} · contract fulfilled`
      : outcome === 'cashedOut'
        ? `${town} · headed home`
        : co
          ? `${co.name} · contract lost`
          : 'Contract lost'
  const title = outcome === 'delivered' ? 'Delivered' : outcome === 'cashedOut' ? 'Cashed out' : 'The wagons fell'
  const lead = outcome === 'delivered' ? (c?.paid[CITY_COUNT - 1] ?? deposit) : deposit
  const sub = charter
    ? outcome === 'delivered'
      ? `The ${CHARTER_NAME} paid ${paidAll.toLocaleString('en')} gold · ${(paidAll - CHARTER_FEE).toLocaleString('en')} after its ${CHARTER_FEE.toLocaleString('en')} fee.`
      : `Raiders took the last of the cargo after ${depth} stop${depth === 1 ? '' : 's'}. The cities on this road pay nothing.`
    : outcome === 'delivered'
      ? stake > 0
        ? `This contract paid ${paidAll} gold in all · ${paidAll - stake} profit after your stake.`
        : `This contract paid ${paidAll} gold in all.`
      : outcome === 'cashedOut'
        ? `${town} bought what was left. ${deposit} gold went to your bank.`
        : `Raiders took the last of the cargo after ${depth} stop${depth === 1 ? '' : 's'}. What the cities paid is yours.`

  return (
    <ContractPage
      className={`ct-result ${outcome}${charter ? ' charter' : ''}`}
      label={title}
      head={
        <div className="ct-result-head" role="status" aria-live="polite">
          <p className="ct-eyebrow">{eyebrow}</p>
          <h1 className="ct-title lg" tabIndex={-1}>
            {title}
          </h1>
          {charter && outcome === 'lost' && <p className="ct-fee-lost">The {CHARTER_FEE.toLocaleString('en')} gold fee is lost</p>}
          {(outcome !== 'lost' || (deposit > 0 && !charter)) && (
            <p className="ct-big" aria-label={`${outcome === 'delivered' ? '' : 'banked '}${lead} gold`}>
              <Coin scale={4} />+{lead.toLocaleString('en')} gold
            </p>
          )}
          <p className="ct-sub">{sub}</p>
          {home && ((home.purseBack > 0 && !home.advance) || home.road > 0) && (
            <p className="ct-sub ct-home">
              {/* Oct 2026: the road part only when the road paid, and a fall says
                  why its share is smaller (`hq.LOST_ROAD_SHARE`). The company's
                  advance never comes home: it is named as the company's, not
                  as gold returned. An older save's purse still comes home. */}
              {/* The advance's repayment is on the slip, not here: one line keeps
                  the head under the 30% chrome budget. */}
              {[
                home.purseBack > 0 && !home.advance ? `Purse returned ${home.purseBack.toLocaleString('en')}` : '',
                home.road > 0
                  ? `Road gold ${home.road.toLocaleString('en')} → ${home.roadBanked.toLocaleString('en')} banked (${home.pct}%${outcome === 'lost' ? ', the contract fell' : ''})`
                  : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
      }
      cta={{ label: 'Take another contract', run: runAgain, heavy: true }}
      /*
       * Oct 2026 (3.5): the exits are ONE row of two quiet buttons — the
       * mobile system's dual action footer. As two 56px picture rows they
       * stacked 134px of chrome on the run-end screen (40% of a phone with
       * the head), above the one next step.
       */
      foot={
        <div className="pg-dual">
          {outcome === 'lost' && assist === 'off' && (
            <button className="pg-dual-btn" onClick={() => setAssist('steady')}>
              <Icon name="assist" /> Assist: Steady
            </button>
          )}
          <button className="pg-dual-btn" onClick={returnToHub}>
            <Icon name="back" /> Back to the menu
          </button>
        </div>
      }
    >
      {/* A fall names its cause first (Phase 2). */}
      {outcome === 'lost' && <DefeatReceipt />}

      {/* A delivery's first news is what it unlocked. */}
      {charter && outcome === 'delivered' && recap?.progress && !recap.progress.unranked && (
        <SovereignReveal kind={recap.progress.sovereign} owned={owned} of={SOVEREIGN_ITEM_KINDS.length} />
      )}
      {recap?.progress && <UnlocksEarned progress={recap.progress} crates={c?.crates ?? 0} />}
      {recap?.progress && <StandingEarned progress={recap.progress} />}

      {c && route && (
        <Slip eyebrow="Banked · in gold" className="ct-receipt">
          {c.paid.map((p, i) =>
            charter ? (
              i === CITY_COUNT - 1 && <SlipLine key={route.towns[i]} label={route.towns[i]} note="the charter's payout" value={<Gold n={p} />} />
            ) : (
              <SlipLine key={route.towns[i]} label={route.towns[i]} note={c.cargoAt[i] != null && c.cargoAt[i] < 100 ? `at ${c.cargoAt[i]}% cargo` : undefined} value={<Gold n={p} />} />
            ),
          )}
          {c.cashOut > 0 && <SlipLine label="The last crates, sold" value={<Gold n={c.cashOut} />} />}
          {home && !home.advance && home.purseBack > 0 && <SlipLine label="Purse returned" value={<Gold n={home.purseBack} />} />}
          {home && home.advance && home.purseBack > 0 && (
            <SlipLine label="The advance" note={`${home.purseBack.toLocaleString('en')} repaid${co ? ` to ${co.name}` : ''}`} value={<Gold n={0} />} />
          )}
          {home && home.road > 0 && <SlipLine label="Road gold" note={`${home.road.toLocaleString('en')} → ${home.pct}% banked`} value={<Gold n={home.roadBanked} />} />}
          {interest > 0 && <SlipLine label="Interest on your bank" value={<Gold n={interest} />} />}
          {lost > 0 && <SlipLine label="Unsold crates, lost" value={`${lost} crate${lost === 1 ? '' : 's'}`} />}
          <SlipLine total label="To your bank" value={`+${deposit.toLocaleString('en')} gold`} />

          {contractBanked(c) === 0 && outcome === 'lost' && !charter && <p className="ct-slip-note">No city was reached, so none paid.</p>}
          {charter && outcome === 'lost' && <p className="ct-slip-note">The charter fee, {CHARTER_FEE.toLocaleString('en')} gold, was paid when you signed. A fall keeps none of it.</p>}
        </Slip>
      )}

      {recap && recap.heroes.length > 0 && (
        <div className="pg-recap">
          <div className="pg-recap-head">
            <span>Your heroes</span>
            <span>KILLS · DMG</span>
          </div>
          {recap.heroes.map((h) => (
            <div className="pg-recap-row" key={h.id}>
              <span className="pg-recap-name">
                {h.name}
                <span className="pg-recap-build">
                  {h.build} · L{h.level}
                </span>
              </span>
              <span className="pg-recap-num">
                {h.kills} · {h.damage}
              </span>
            </div>
          ))}
        </div>
      )}

      <FeatsEarned />

      {outcome === 'lost' && <AssistCard assist={assist} />}

      {recap && recap.spoils.length > 0 && (
        <InfoCard
          lines={[
            `The last stand left ${recap.spoils.length} thing${recap.spoils.length === 1 ? '' : 's'} behind`,
            ...recap.spoils.map((i) => `${itemName(i)} · ${RARITY[i.rarity].label}`),
          ]}
        />
      )}

      {recap && (
        <InfoCard
          lines={[
            `${recap.kills} felled · ${recap.enemiesLeaked} reached the wagons in the last wave · cargo ${recap.cargo}%`,
            `${c ? stakeLine(c.crates, charter) : ''} ${strengthText(recap.threat)} at the end`.trim(),
            `Run seed ${recap.seed}${recap.challenge.kind === 'seeded' ? ' · custom seed' : ''} — the same seed deals the same map, loot and rolls.`,
          ]}
        />
      )}
    </ContractPage>
  )
}

/**
 * The assist dial, offered at the one moment it is relevant (F11): after a
 * fall, as a card among the others — no diagnosis, no penalty, exact words.
 */
function AssistCard({ assist }: { assist: AssistLevel }) {
  const steady = assistProfile('steady')
  if (assist !== 'off') {
    return (
      <InfoCard
        lines={[
          `Assist is on — ${assistProfile(assist).label}.`,
          assistProfile(assist).blurb,
          'Change it or turn it off whenever you like, in Settings or mid-run.',
        ]}
      />
    )
  }
  return (
    <InfoCard
      lines={[
        'Assist is there if you want it.',
        `${steady.label} — ${steady.blurb.charAt(0).toLowerCase()}${steady.blurb.slice(1)}`,
        'Nothing else moves: same waves, same loot, same pay. Change it whenever you like, mid-run included.',
      ]}
    />
  )
}
