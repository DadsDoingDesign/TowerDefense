import { companyById } from '../../../game/data/companies'
import {
  cargoPct,
  cashOutValue,
  CITY_COUNT,
  cityPay,
  contractBanked,
  contractStake,
  cratesLeftAfter,
  dangerPips,
  deliveryUnlocks,
  recordAt,
} from '../../../game/run/contracts'
import { ACT_LAYERS, RUN_LAYERS } from '../../../game/run/threat'
import { useGameStore } from '../../../state/gameStore'
import { useMetaStore } from '../../../state/metaStore'
import { useSettingsStore } from '../../../state/settingsStore'
import { Coin, Crate } from '../../pixel'
import { ContractPage, DangerPips, Gold, PageTip, RouteRail, Slip, SlipLine } from './parts'

/**
 * A city — an act boss down (mockup `trade/r3/5-payout.png`).
 *
 * The gold leads: what this city paid, and why ("your stake is back, plus a
 * fee"). The receipt slip itemises it, the route rail shows what is ahead, and
 * then the one question, in the display serif: head home, or press on? Two
 * cards, each with the whole of its consequence in gold — what you leave with
 * now, what you could leave with, the danger and your own record at this
 * stake. A first contract cannot cash out (LS3): its cities just pay.
 */
export function CityScreen() {
  const c = useGameStore((s) => s.contract)
  const baseHp = useGameStore((s) => s.baseHp)
  const maxBaseHp = useGameStore((s) => s.maxBaseHp)
  const firstRun = useGameStore((s) => s.firstRun)
  const layer = useGameStore((s) => s.runMap.nodes.find((n) => n.id === s.currentNodeId)?.layer ?? 0)
  const pressOn = useGameStore((s) => s.pressOn)
  const cashOut = useGameStore((s) => s.cashOut)
  const record = useMetaStore((s) => s.record)
  const taught = useSettingsStore((s) => s.taught.cashOut)
  if (!c || c.pending == null) return null

  const co = companyById(c.company)
  const city = c.pending
  const town = co.towns[city]
  const arrived = c.cargoAt[city] ?? 100
  const here = cityPay(c, city, arrived)
  const cargoNow = cargoPct(baseHp, maxBaseHp)
  const left = cratesLeftAfter(c.crates, city + 1)
  const staked = c.crates > 0
  const stake = contractStake(c)
  const sale = cashOutValue(c, c.paid.length, cargoNow)
  const banked = contractBanked(c)
  // What pressing on could still pay, at the cargo the caravan has now.
  const ahead = Array.from({ length: CITY_COUNT - city - 1 }, (_, i) => cityPay(c, city + 1 + i, cargoNow))
  const could = banked + ahead.reduce((a, p) => a + p.total, 0)
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
      className="ct-city"
      label={`${town}: paid ${here.total} gold`}
      head={
        <>
          <p className="ct-eyebrow">
            Act {city + 1} boss down · {town} market
          </p>
          <h1 className="ct-big" tabIndex={-1}>
            <Coin scale={4} />+{here.total} gold
          </h1>
          <p className="ct-msg">{msg}</p>
        </>
      }
      cta={firstRun ? { label: `Press on to ${co.towns[city + 1]}`, run: pressOn, heavy: true } : undefined}
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

      {firstRun ? (
        <PageTip>Every city on the road pays as the caravan reaches it. From your next contract you may also cash out here and head home.</PageTip>
      ) : (
        <>
          <h2 className="ct-q">Head home, or press on?</h2>
          {!taught && <PageTip>Cashing out sells what is left at half price and ends the contract. Pressing on risks it for the full payout.</PageTip>}
          <div className="ct-choices">
            <div className="ct-ch out">
              <span className="ct-ch-k">Sure thing</span>
              <span className="ct-ch-t">Cash out</span>
              <span className="ct-ch-s">You leave with</span>
              <span className="ct-ch-v">{banked + sale} gold</span>
              <p>
                {left > 0 ? `${town} buys the last ${left} crate${left === 1 ? '' : 's'} cheap. ` : ''}
                No completion bonus, no item chances, no contract skill. Standing so far is kept.
              </p>
              <button className="ct-go" onClick={cashOut}>
                {left > 0 ? 'Sell & head home' : 'Head home'}
              </button>
            </div>
            <div className="ct-ch on">
              <span className="ct-ch-k">Bigger payout</span>
              <span className="ct-ch-t">Press on</span>
              <span className="ct-ch-s">You could leave with</span>
              <span className="ct-ch-v">{could} gold</span>
              <span className="ct-ch-loot">
                + {unlocks.items} item{unlocks.items === 1 ? '' : 's'}, {unlocks.skills} skill{unlocks.skills === 1 ? '' : 's'}
              </span>
              <span className="ct-ch-odds">
                Danger <DangerPips n={dangerPips(c.crates)} />
              </span>
              <span className="ct-ch-odds">
                Cargo {cargoNow}%{rec.runs > 0 ? ` · you’ve delivered ${rec.delivered} of ${rec.runs} like this` : ''}
              </span>
              <p className="ct-ch-risk">
                {left > 0 ? `Fall, and the ${left} unsold crate${left === 1 ? ' is' : 's are'} lost. ` : 'Fall, and the bonus is lost. '}You keep {banked}.
              </p>
              <button className="ct-go primary" onClick={pressOn}>
                Press on
              </button>
            </div>
          </div>
        </>
      )}
    </ContractPage>
  )
}

/** The layer a city's act boss stands on (for copy that names the act). */
export const cityLayer = (city: number): number => (city + 1) * ACT_LAYERS
