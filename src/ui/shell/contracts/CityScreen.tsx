import { useState } from 'react'
import { companyById } from '../../../game/data/companies'
import {
  canCashOut,
  cargoPct,
  CITY_COUNT,
  cityPay,
  contractStake,
  cratesLeftAfter,
  dangerPips,
  deliveryUnlocks,
  recordAt,
} from '../../../game/run/contracts'
import { cityTrade } from '../../../game/run/settle'
import { ACT_LAYERS, RUN_LAYERS } from '../../../game/run/threat'
import { useGameStore } from '../../../state/gameStore'
import { useMetaStore } from '../../../state/metaStore'
import { useSettingsStore } from '../../../state/settingsStore'
import { Coin, Crate } from '../../pixel'
import { NextGround } from '../NextGround'
import { Icon } from '../../Icon'
import { PickCard, PickStrip } from '../PickStrip'
import { companyVar } from '../../channels'
import { ContractPage, DangerPips, Gold, PageTip, RouteRail, Slip, SlipLine } from './parts'

/** The two ways on from a city: cash out here, or press on. */
type Way = 'out' | 'on'

/**
 * A city — an act boss down (mockup `trade/r3/5-payout.png`).
 *
 * The gold leads: what this city paid, and why ("your stake is back, plus a
 * fee"). The receipt slip itemises it, the route rail shows what is ahead, and
 * then the one question, in the display serif: head home, or press on? Two
 * tokens and ONE card for the focused way (pick one, then read — October
 * 2026), the card holding the whole of its consequence in gold — what you bank now,
 * what delivering would bank, what a fall would bank, the danger and your own
 * record at this stake (`settle.cityTrade`, the settle's own numbers). When a
 * fall would bank as much as cashing out, there is nothing to weigh, and the
 * page says so instead of staging a choice. A first contract learns at its
 * first city that cities pay, and gets the choice from its second (LS3,
 * October audit 1.5).
 */
export function CityScreen() {
  const c = useGameStore((s) => s.contract)
  const baseHp = useGameStore((s) => s.baseHp)
  const maxBaseHp = useGameStore((s) => s.maxBaseHp)
  const firstRun = useGameStore((s) => s.firstRun)
  const gold = useGameStore((s) => s.gold)
  const layer = useGameStore((s) => s.runMap.nodes.find((n) => n.id === s.currentNodeId)?.layer ?? 0)
  const pressOn = useGameStore((s) => s.pressOn)
  const cashOut = useGameStore((s) => s.cashOut)
  const record = useMetaStore((s) => s.record)
  const taught = useSettingsStore((s) => s.taught.cashOut)
  // The focused way. Pressing on leads, as it does on every city with nothing
  // to weigh: ending the contract is never what a habitual tap does.
  const [way, setWay] = useState<Way>('on')
  // The Sovereign Route's cities are waypoints: none waits on this page.
  if (!c || c.pending == null || !c.company) return null

  const co = companyById(c.company)
  const city = c.pending
  const town = co.towns[city]
  const arrived = c.cargoAt[city] ?? 100
  const here = cityPay(c, city, arrived)
  const cargoNow = cargoPct(baseHp, maxBaseHp)
  const left = cratesLeftAfter(c.crates, city + 1)
  const staked = c.crates > 0
  const stake = contractStake(c)
  // The choice, priced by the settle's own rules: what cashing out banks now,
  // what a fall banks, what delivering banks (`settle.cityTrade`).
  const trade = cityTrade(c, gold, cargoNow)
  const choose = canCashOut(c, firstRun)
  const nothingToLose = trade.atRisk <= 0
  // What pressing on could still pay, at the cargo the caravan has now.
  const ahead = Array.from({ length: CITY_COUNT - city - 1 }, (_, i) => cityPay(c, city + 1 + i, cargoNow))
  const roadLost = trade.roadIfCashed - trade.roadIfFallen
  const unlocks = deliveryUnlocks(c.crates)
  const rec = recordAt(record, c.crates)
  const stopsLeft = Math.max(0, RUN_LAYERS - 1 - layer)
  const bossesLeft = CITY_COUNT - city - 1
  const msg = staked
    ? here.sales >= stake && city === 0
      ? `Your ${stake}-gold stake is back${here.sales > stake ? ` with ${here.sales - stake} more` : ''}, plus a ${here.fee}-gold fee`
      : `${here.sold} crate${here.sold === 1 ? '' : 's'} sold, and the fee`
    : arrived < 100
      ? `The escort fee, for the ${arrived}% of the cargo that arrived`
      : 'The escort fee, for every crate that arrived'

  return (
    <ContractPage
      // A city with no choice to make is a short board: its one CTA sits right
      // under the receipt rather than at the foot of an empty column (3.5).
      className={`ct-city${!choose || nothingToLose ? ' compact' : ''}`}
      label={`${town}: paid ${here.total} gold`}
      head={
        <>
          <p className="ct-eyebrow">
            {/* The arrival beat (October audit 3.11): the caravan made it, then the pay. */}
            The caravan reaches {town} · act {city + 1}
          </p>
          <h1 className="ct-big" tabIndex={-1}>
            <Coin scale={4} />+{here.total} gold
          </h1>
          <p className="ct-msg">{msg}</p>
        </>
      }
      // The choice is a pick, then the CTA that names it (October 2026): the
      // focused way's verb, with what it banks.
      cta={
        !choose || nothingToLose || way === 'on'
          ? { label: `Press on to ${co.towns[city + 1]}`, run: pressOn, heavy: true }
          : {
              label: (
                <>
                  {left > 0 ? 'Sell & head home' : 'Head home'} <small className="ct-cta-cost"><Gold n={trade.now} /></small>
                </>
              ),
              name: `${left > 0 ? 'Sell and head home' : 'Head home'}, banking ${trade.now} gold`,
              run: cashOut,
              heavy: true,
            }
      }
    >
      <Slip>
        {here.sold > 0 && <SlipLine label={`Sold: ${here.sold} crate${here.sold === 1 ? '' : 's'} of ${co.noun}`} value={<Gold n={here.sales} />} />}
        <SlipLine label="Escort fee" value={<Gold n={here.fee} />} />
        {arrived < 100 && <SlipLine label="Cargo that arrived" value={`${arrived}%`} />}
        {staked && (
          <SlipLine
            label="Unsold, still on the wagons"
            value={
              left > 0 ? (
                <>
                  {Array.from({ length: Math.min(4, left) }, (_, i) => (
                    <Crate key={i} color={co.color} scale={1} />
                  ))}{' '}
                  {left} crate{left === 1 ? '' : 's'}
                </>
              ) : (
                'none'
              )
            }
          />
        )}
      </Slip>

      <RouteRail
        company={c.company}
        progress={city / (CITY_COUNT - 1)}
        stops={co.towns.map((t, i) => ({
          town: t,
          lit: i <= city,
          done: i <= city,
          line: i <= city ? `paid ${c.paid[i] ?? 0}` : i === CITY_COUNT - 1 ? `+${ahead[ahead.length - 1]?.total ?? 0} gold + loot` : `+${ahead[i - city - 1]?.total ?? 0} gold`,
        }))}
      />
      <p className="ct-left">
        Still ahead: {stopsLeft} stop{stopsLeft === 1 ? '' : 's'}, {bossesLeft} boss{bossesLeft === 1 ? '' : 'es'}
      </p>
      <NextGround city={city} />

      {!choose ? (
        <PageTip>Every city on the road pays as the caravan reaches it. From the next city you may cash out here and head home.</PageTip>
      ) : nothingToLose ? (
        <PageTip>
          Nothing on the wagons is at risk yet, so there is nothing to weigh: press on. Once the road has paid you, a fall leaves most of that gold behind.
        </PageTip>
      ) : (
        <>
          <h2 className="ct-q">Head home, or press on?</h2>
          {!taught && (
            <PageTip>
              Cash out to bank everything now. Press on for the bigger payout, but a fall loses the unsold crates and most of the road's gold.
            </PageTip>
          )}
          <div className="pk">
            <PickStrip
              label="Head home, or press on"
              tokens={[
                { id: 'out', art: <Icon name="gold" lg />, label: 'Bank', value: trade.now, name: `Cash out: bank ${trade.now} gold now` },
                {
                  id: 'on',
                  art: <Crate color={co.color} scale={3} />,
                  label: 'Bank',
                  value: `${trade.deliver}+`,
                  name: `Press on: deliver, and bank ${trade.deliver} gold or more`,
                  rail: companyVar(c.company),
                },
              ]}
              focused={way}
              onFocus={(id) => setWay(id as Way)}
            />
            {way === 'out' ? (
              <PickCard
                className="ct-pk-way out"
                kicker="Sure thing"
                name="Cash out"
                index={0}
                count={2}
                onStep={() => setWay('on')}
                noun="choice"
                facts={[
                  { label: 'You bank', value: `${trade.now} gold`, tone: 'accent' },
                  { label: 'Loot', value: 'none' },
                  { label: 'Risk', value: 'none', tone: 'good' },
                ]}
              >
                <p className="pk-does">
                  {left > 0 ? `${town} buys the last ${left} crate${left === 1 ? '' : 's'} for ${trade.sale}. ` : ''}
                  {trade.road > 0 ? `${trade.roadIfCashed} of the road's gold comes home. ` : ''}
                  No completion bonus, no item chances, no contract skill.
                </p>
              </PickCard>
            ) : (
              <PickCard
                className="ct-pk-way on"
                kicker="Bigger payout"
                name="Press on"
                index={1}
                count={2}
                onStep={() => setWay('out')}
                noun="choice"
                facts={[
                  { label: 'Delivered', value: `${trade.deliver}+ gold`, tone: 'accent' },
                  { label: 'Loot', value: `${unlocks.items} item${unlocks.items === 1 ? '' : 's'}, ${unlocks.skills} skill${unlocks.skills === 1 ? '' : 's'}` },
                  { label: 'Danger', value: <DangerPips n={dangerPips(c.crates)} /> },
                ]}
              >
                <p className="pk-does">
                  Cargo {cargoNow}%{rec.runs > 0 ? ` · you’ve delivered ${rec.delivered} of ${rec.runs} like this` : ''}.
                </p>
                <p className="pk-risk">
                  Fall, and you bank {trade.fall}: {left > 0 ? `the ${left} unsold crate${left === 1 ? ' is' : 's are'} lost` : 'the bonus is lost'}
                  {roadLost > 0 ? `, and ${roadLost} of the road's gold stays on the road` : ''}.
                </p>
              </PickCard>
            )}
          </div>
        </>
      )}
    </ContractPage>
  )
}

/** The layer a city's act boss stands on (for copy that names the act). */
export const cityLayer = (city: number): number => (city + 1) * ACT_LAYERS
