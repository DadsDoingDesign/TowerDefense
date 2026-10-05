import { RARITY } from '../../../game/data/items'
import { companyById } from '../../../game/data/companies'
import { CITY_COUNT, contractBanked, contractStake, cratesLeftAfter } from '../../../game/run/contracts'
import { useGameStore } from '../../../state/gameStore'
import { assistProfile, useSettingsStore, type AssistLevel } from '../../../state/settingsStore'
import { itemName, strengthText } from '../../channels'
import { Coin } from '../../pixel'
import { DefeatReceipt } from '../DefeatReceipt'
import { FeatsEarned } from '../FeatsEarned'
import { InfoCard, MenuRow } from '../Page'
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
 *    kept (the cities' pay and the purse) and what was lost (unsold crates).
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
  const co = c ? companyById(c.company) : null
  const depth = recap?.depth ?? Math.max(0, clearedNodeIds.length - 1)
  const deposit = recap?.deposit ?? 0
  const paidAll = c ? c.paid.reduce((a, b) => a + b, 0) : 0
  const stake = c ? contractStake(c) : 0
  const lost = c && outcome === 'lost' ? cratesLeftAfter(c.crates, c.paid.length) : 0
  const purseHome = recap?.goldLeft ?? 0
  const dest = co?.towns[CITY_COUNT - 1] ?? 'the end of the road'
  const town = co && c ? co.towns[Math.max(0, c.paid.length - 1)] : ''

  const eyebrow =
    outcome === 'delivered' ? `${dest} · contract fulfilled` : outcome === 'cashedOut' ? `${town} · headed home` : co ? `${co.name} · contract lost` : 'Contract lost'
  const title = outcome === 'delivered' ? 'Delivered' : outcome === 'cashedOut' ? 'Cashed out' : 'The wagons fell'
  const lead = outcome === 'delivered' ? (c?.paid[CITY_COUNT - 1] ?? deposit) : deposit
  const sub =
    outcome === 'delivered'
      ? stake > 0
        ? `This contract paid ${paidAll} gold in all · ${paidAll - stake} profit after your stake.`
        : `This contract paid ${paidAll} gold in all.`
      : outcome === 'cashedOut'
        ? `${town} bought what was left. ${deposit} gold went to your bank.`
        : `Raiders took the last of the cargo after ${depth} stop${depth === 1 ? '' : 's'}. What the cities paid is yours.`

  return (
    <ContractPage
      className={`ct-result ${outcome}`}
      label={title}
      head={
        <div className="ct-result-head" role="status" aria-live="polite">
          <p className="ct-eyebrow">{eyebrow}</p>
          <h1 className="ct-title lg" tabIndex={-1}>
            {title}
          </h1>
          {(outcome !== 'lost' || deposit > 0) && (
            <p className="ct-big" aria-label={`${outcome === 'delivered' ? '' : 'banked '}${lead} gold`}>
              <Coin scale={4} />+{lead} gold
            </p>
          )}
          <p className="ct-sub">{sub}</p>
        </div>
      }
      cta={{ label: 'Take another contract', run: runAgain, heavy: true }}
      foot={
        <div className="pg-rows">
          {outcome === 'lost' && assist === 'off' && <MenuRow label="Turn on Assist · Steady" icon="armour" big onClick={() => setAssist('steady')} />}
          <MenuRow label="Back to the menu" icon="back" big onClick={returnToHub} />
        </div>
      }
    >
      {/* A fall names its cause first (Phase 2). */}
      {outcome === 'lost' && <DefeatReceipt />}

      {/* A delivery's first news is what it unlocked. */}
      {recap?.progress && <UnlocksEarned progress={recap.progress} crates={c?.crates ?? 0} />}
      {recap?.progress && <StandingEarned progress={recap.progress} />}

      {c && co && (
        <Slip eyebrow="Banked · in gold" className="ct-receipt">
          {c.paid.map((p, i) => (
            <SlipLine key={co.towns[i]} label={co.towns[i]} note={c.cargoAt[i] != null && c.cargoAt[i] < 100 ? `at ${c.cargoAt[i]}% cargo` : undefined} value={<Gold n={p} />} />
          ))}
          {c.cashOut > 0 && <SlipLine label="The last crates, sold cheap" value={<Gold n={c.cashOut} />} />}
          {purseHome > 0 && <SlipLine label="Your purse, home again" value={<Gold n={purseHome} />} />}
          {lost > 0 && <SlipLine label="Unsold crates, lost" value={`${lost} crate${lost === 1 ? '' : 's'}`} />}
          <SlipLine total label="To your bank" value={`+${deposit} gold`} />
          {contractBanked(c) === 0 && outcome === 'lost' && <p className="ct-slip-note">No city was reached, so none paid.</p>}
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
            `${c ? stakeLine(c.crates) : ''} ${strengthText(recap.threat)} at the end`.trim(),
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
