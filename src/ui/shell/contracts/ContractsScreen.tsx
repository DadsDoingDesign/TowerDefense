import { type CSSProperties } from 'react'
import { companyById, type CompanyId } from '../../../game/data/companies'
import {
  ADVANCE,
  CRATE_PRICE,
  contractPlan,
  crateCap,
  dangerPips,
  isMilestone,
  marketFor,
  MAX_CRATES,
  recordAt,
  STAKES_OPEN_AT,
  utcDateKey,
} from '../../../game/run/contracts'
import { standingOf } from '../../../game/run/standing'
import { difficultyEffect } from '../../../game/run/watch'
import { useGameStore } from '../../../state/gameStore'
import { useMetaStore } from '../../../state/metaStore'
import { useSettingsStore } from '../../../state/settingsStore'
import { stakeCap } from '../../../state/game/contractSlice'
import { stakesShown } from '../../../state/staging'
import { ROAD_SHARE } from '../../../game/run/hq'
import { useReveal } from '../staging'
import { companyVar } from '../../channels'
import { Icon } from '../../Icon'
import { Crate, Crest, Lock, Scroll, Sword } from '../../pixel'
import { ContractPage, DangerPips, Gold, MarketTag, PageTip, Slip, SlipLine } from './parts'

/**
 * A company's terms (the mercenary company; mockups `trade/r3/3-stakes.png`,
 * `3-stakes-free.png`): the free escort or a stake of crates, what the road
 * pays at every city, and the company's advance for the road. Every number is
 * read off `run/contracts.ts`; the store clamps whatever the page asks for.
 *
 * The company is chosen on the menu (Oct 2026, Figma "B2"): the trade map's
 * signposts are the board, and its notice's CTA opens this page. Back returns
 * to the menu with the road still focused.
 *
 * The staggered reveal (October 2026): a company takes stakes from standing
 * {@link STAKES_OPEN_AT} with it (escort only before, and the terms say when
 * they open), and the market of the day shows from the fifth finished
 * contract (`state/staging.revealOf`).
 */
export function ContractsScreen() {
  const board = useGameStore((s) => s.board)
  if (!board) return null
  return <Terms company={board.company} crates={board.crates} />
}

function BankChip() {
  const bank = useMetaStore((s) => s.bank)
  return (
    <span className="ct-chip" title="Your bank">
      <Gold n={bank} />
    </span>
  )
}

function Back({ label }: { label: string }) {
  const back = useGameStore((s) => s.boardBack)
  return (
    <button className="ct-back" onClick={back} aria-label={label}>
      <Icon name="back" />
    </button>
  )
}

// ---------------------------------------------------------------------------
// The terms
// ---------------------------------------------------------------------------

function Terms({ company, crates }: { company: CompanyId; crates: number }) {
  const meta = useMetaStore()
  const setCrates = useGameStore((s) => s.setCrates)
  const sign = useGameStore((s) => s.signContract)
  const taught = useSettingsStore((s) => s.taught)
  const showEverything = useSettingsStore((s) => s.showEverything)
  const reveal = useReveal()
  const co = companyById(company)
  const market = marketFor(company, utcDateKey(), reveal.market)
  const standing = standingOf(meta.standing, company)
  const standingCap = crateCap(standing)
  // Stakes open per company at standing 2 with it (the staggered reveal).
  const stakesOpen = stakesShown(meta.standing, company, showEverything)
  const cap = stakeCap(meta, company)
  const plan = contractPlan({ company, crates, market })
  const stake = crates * CRATE_PRICE
  const rec = recordAt(meta.record, crates)
  const staked = crates > 0
  const [c1, c2, dest] = co.towns
  const sold = plan.cities.map((c) => c.sold)

  return (
    <ContractPage
      label={`${co.name} — the terms`}
      heat={0.08 + crates * 0.035}
      head={
        <div className="ct-hdr">
          <Back label="Back to the roads" />
          <div className="ct-who">
            <Crest company={company} />
            <span className="ct-who-text">
              <h1 className="ct-title sm" tabIndex={-1}>
                {co.name}
              </h1>
              <span>
                {co.goods} road
                {market > 1 && (
                  <>
                    {' '}
                    · <MarketTag mult={market} />
                  </>
                )}
              </span>
            </span>
          </div>
          <BankChip />
        </div>
      }
      foot={<p className="ct-risk">{staked ? 'Fall, and you keep what the cities paid. Unsold cargo is lost.' : 'You keep every fee you have earned, even if you fall.'}</p>}
      cta={{
        label: staked ? (
          <>
            Send the caravan <small className="ct-cta-cost"><Gold n={stake} /></small>
          </>
        ) : (
          'Take the free escort'
        ),
        name: staked ? `Send the caravan, ${stake} gold stake` : 'Take the free escort',
        run: sign,
        heavy: true,
      }}
    >
      <div className="ct-modes" role="radiogroup" aria-label="Contract">
        <button className={`ct-mode free${staked ? '' : ' on'}`} role="radio" aria-checked={!staked} onClick={() => setCrates(0)}>
          <span className="ct-mode-k">Free</span>
          <b>Escort</b>
          <span>Paid at every city. Nothing to lose.</span>
        </button>
        {stakesOpen ? (
          <button
            className={`ct-mode staked${staked ? ' on' : ''}`}
            role="radio"
            aria-checked={staked}
            aria-disabled={cap < 1}
            onClick={() => cap >= 1 && setCrates(staked ? crates : Math.min(cap, 2))}
          >
            <span className="ct-mode-k">Staked</span>
            <b>Carry cargo</b>
            <span>Bigger bonus, more loot, tougher raiders.</span>
          </button>
        ) : (
          <button className="ct-mode staked locked" role="radio" aria-checked={false} aria-disabled="true" aria-label={`Staked: stakes open at Standing ${STAKES_OPEN_AT} with ${co.name}`}>
            <span className="ct-mode-k">
              <Lock /> Staked
            </span>
            <b>Carry cargo</b>
            <span>
              Stakes open at Standing {STAKES_OPEN_AT} with {co.name}
            </span>
          </button>
        )}
      </div>

      {stakesOpen && !taught.stakes && <PageTip>Each crate costs {CRATE_PRICE} gold and makes the road harder. Delivered, every crate pays more.</PageTip>}

      {stakesOpen && (
      <div className="ct-ladder" style={{ '--co': companyVar(company) } as CSSProperties}>
        <div className="ct-ladder-head">
          <span className="ct-eyebrow">Your stake · {CRATE_PRICE} gold a crate</span>
          <b>
            {crates} crate{crates === 1 ? '' : 's'}
          </b>
        </div>
        <div className="ct-ladder-row">
          <button className="ct-step" onClick={() => setCrates(crates - 1)} disabled={crates <= 0} aria-label="One crate less">
            −
          </button>
          <div className="ct-rungs" role="slider" aria-label="Crates" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={crates}>
            {Array.from({ length: MAX_CRATES }, (_, i) => i + 1).map((r) => {
              const locked = r > standingCap
              return (
                <button key={r} className={`ct-rung${r <= crates ? ' on' : ''}${locked ? ' locked' : ''}`} onClick={() => setCrates(r)} tabIndex={-1} aria-hidden="true">
                  {isMilestone(r) && (
                    <span className="ct-ms">
                      +1
                      <br />
                      skill
                    </span>
                  )}
                  {locked ? <Lock /> : <Crate color={co.color} scale={2} ghost={r > crates} />}
                  <span className="ct-rung-n">{r}</span>
                </button>
              )
            })}
          </div>
          <button className="ct-step" onClick={() => setCrates(crates + 1)} disabled={crates >= cap} aria-label="One crate more">
            +
          </button>
        </div>
        <div className="ct-odds">
          <span className="ct-odds-row">
            <span className="ct-odds-k">Danger</span> <DangerPips n={dangerPips(crates)} />
            {staked && <b className="ct-raid">{difficultyEffect(crates)}</b>}
          </span>
          <span className="ct-rec">
            {rec.runs > 0 ? (
              <>
                Your record {staked ? `at ${crates}+ crate${crates === 1 ? '' : 's'}` : 'on escorts'}:{' '}
                <b>
                  {rec.delivered} of {rec.runs} delivered
                </b>
              </>
            ) : staked ? (
              'No record at this stake yet.'
            ) : (
              'Standard raiders.'
            )}
          </span>
          {standingCap < MAX_CRATES && (
            <span className="ct-lockline">
              Crate {standingCap + 1} opens at Standing {standingCap} with {co.name}
            </span>
          )}
          {cap < standingCap && <span className="ct-lockline">Your bank covers {cap} crate{cap === 1 ? '' : 's'}.</span>}
        </div>
      </div>
      )}

      <Slip eyebrow="What it pays · in gold" className="ct-pay">
        <SlipLine label={c1} note={staked && sold[0] ? 'stake back + fee' : 'escort fee'} value={<Gold n={plan.cities[0].total} />} />
        <SlipLine label={c2} note={sold[1] ? 'fee + cargo sales' : 'escort fee'} value={<Gold n={plan.cities[1].total} />} />
        <SlipLine label={dest} note={sold[2] ? 'cargo + bonus' : 'fee + completion bonus'} value={<Gold n={plan.cities[2].total} />} />
        <div className="ct-ends">
          <span>
            <Sword /> {plan.items} item chance{plan.items === 1 ? '' : 's'}
          </span>
          <span>
            <Scroll scale={2} /> {plan.skills} skill{plan.skills === 1 ? '' : 's'}
          </span>
        </div>
        <SlipLine total label={staked ? 'Profit if delivered' : 'Pay if delivered'} value={`+${plan.profit} gold`} />
        <p className="ct-slip-note">Each city pays for the share of cargo that arrives.</p>
      </Slip>

      <div className="ct-advance">
        <span>
          <b>
            {co.name} advances {ADVANCE} gold for the road
          </b>
          <small>Not from your bank, and repaid at the end. {Math.round(ROAD_SHARE * 100)}% of the road’s gold comes home.</small>
        </span>
        <span className="ct-advance-v">
          <Gold n={ADVANCE} />
        </span>
      </div>
    </ContractPage>
  )
}
