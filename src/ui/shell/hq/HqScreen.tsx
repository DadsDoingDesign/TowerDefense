import { useState, type CSSProperties, type ReactNode } from 'react'
import { COMPANIES, companyById, type CompanyId } from '../../../game/data/companies'
import { itemPoolFor } from '../../../game/data/itemKinds'
import { contractPlan, crateCap, kindCompany, poolShare, weightPool } from '../../../game/run/contracts'
import {
  DEAL_STEPS,
  dealSummary,
  FOCUS_ORDER_PRICE,
  FOCUS_STEP,
  focusBoost,
  hqCost,
  hqLevel,
  hqMax,
  INTEREST,
  INTEREST_FULL_AT,
  interestFor,
  interestTerms,
  packSlots,
  PACK_BASE,
  ratePct,
  ROCK_ORDER_CUT,
  ROCK_ORDER_PRICE,
  rocksCut,
  scoutsAt,
  type HqId,
  type Office,
} from '../../../game/run/hq'
import { MIN_OBSTACLES, OBSTACLES } from '../../../game/data/hazards'
import { companyOpen, topStanding } from '../../../game/run/standing'
import { useMetaStore } from '../../../state/metaStore'
import { useSettingsStore } from '../../../state/settingsStore'
import { companyVar, moneyText } from '../../channels'
import { Icon } from '../../Icon'
import { Crest, Lock } from '../../pixel'
import { heroArt } from '../offers'
import { ContractPage, Gold, PageTip } from '../contracts/parts'

/**
 * The mercenary company's headquarters (build step 3; mockups
 * `trade/r3/7-hq-hr.png`, `7-hq-finance.png`, `7-hq-ops.png`): one page, three
 * offices behind tabs. Every card is one purchase or one order, says what it
 * does in one line, and shows its price on its button. Every number is read
 * off `game/run/hq.ts`; the store refuses whatever the bank cannot pay.
 */
export function HqScreen({ onBack, initial = 'hr' }: { onBack: () => void; initial?: Office }) {
  const [office, setOffice] = useState<Office>(initial)
  const bank = useMetaStore((s) => s.bank)
  const taught = useSettingsStore((s) => s.taught.hq)
  const OFFICES: [Office, string][] = [
    ['hr', 'HR'],
    ['finance', 'Finance'],
    ['ops', 'Operations'],
  ]
  return (
    <ContractPage
      className="hq"
      label="Headquarters"
      head={
        <div className="ct-hdr">
          <button className="ct-back" onClick={onBack} aria-label="Back to the menu">
            <Icon name="back" />
          </button>
          <div className="ct-who">
            <span className="hq-keep" aria-hidden="true">
              <Icon name="base" lg />
            </span>
            <span className="ct-who-text">
              <h1 className="ct-title" tabIndex={-1}>
                Headquarters
              </h1>
              <span>Your militia · 3 offices</span>
            </span>
          </div>
          <span className="ct-chip" title="Your bank">
            <Gold n={bank} />
          </span>
        </div>
      }
    >
      <div className="hq-tabs" role="tablist" aria-label="Offices">
        {OFFICES.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            id={`hq-tab-${id}`}
            aria-selected={office === id}
            aria-controls={`hq-panel-${id}`}
            className={`hq-tab${office === id ? ' on' : ''}`}
            onClick={() => {
              setOffice(id)
              useSettingsStore.getState().markTaught('hq')
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {!taught && <PageTip>Everything here is paid from your bank and lasts for good. An order lasts one contract.</PageTip>}
      <div className="hq-body" role="tabpanel" id={`hq-panel-${office}`} aria-labelledby={`hq-tab-${office}`}>
        {office === 'hr' ? <HrOffice /> : office === 'finance' ? <FinanceOffice /> : <OpsOffice />}
      </div>
    </ContractPage>
  )
}

// ---------------------------------------------------------------------------
// Shared parts
// ---------------------------------------------------------------------------

function useBuy(id: HqId) {
  const level = useMetaStore((s) => hqLevel(s.upgrades, id))
  const bank = useMetaStore((s) => s.bank)
  const buy = useMetaStore((s) => s.buyUpgrade)
  const cost = hqCost(id, level)
  return { level, max: hqMax(id), cost, can: cost != null && bank >= cost, buy: () => buy(id) }
}

/** A buy button: what it does, then its price; or a plain "done" line when maxed. */
function BuyButton({ label, cost, can, run, done, wide = true }: { label: string; cost: number | null; can: boolean; run: () => void; done: string; wide?: boolean }) {
  if (cost == null)
    return (
      <p className={`hq-done${wide ? ' wide' : ''}`} role="status">
        {done}
      </p>
    )
  return (
    <button className={`hq-btn${wide ? ' wide' : ''}`} onClick={run} disabled={!can} aria-label={`${label}, ${moneyText(cost)}${can ? '' : ' — your bank is short'}`}>
      <span>{label}</span>
      <small>
        <Gold n={cost} />
      </small>
    </button>
  )
}

/** Level pips: `on` of `of`. */
const Pips = ({ on, of }: { on: number; of: number }) => (
  <span className="hq-pips" role="img" aria-label={`Level ${on} of ${of}`}>
    {Array.from({ length: of }, (_, i) => (
      <i key={i} className={i < on ? 'on' : ''} />
    ))}
  </span>
)

const Card = ({ title, line, children, className }: { title: string; line: string; children: ReactNode; className?: string }) => (
  <section className={`hq-card${className ? ` ${className}` : ''}`} aria-label={title}>
    <h2>{title}</h2>
    <p className="hq-line">{line}</p>
    {children}
  </section>
)

const Row = ({ k, v, tone }: { k: string; v: ReactNode; tone?: 'good' }) => (
  <div className="hq-kv">
    <span>{k}</span>
    <b className={tone ? `tone-${tone}` : undefined}>{v}</b>
  </div>
)

// ---------------------------------------------------------------------------
// HR
// ---------------------------------------------------------------------------

const LOOKS = ['fighter', 'mystic', 'rogue'] as const

function HrOffice() {
  const deal = useBuy('deal')
  const hiring = useBuy('hiring')
  const next = DEAL_STEPS[deal.level]
  const pick = deal.level >= 3 ? 4 : 3
  return (
    <>
      <Card title="Opening deal" line="Better first heroes at the start of every contract.">
        <Pips on={deal.level} of={deal.max} />
        <div className="hq-deal" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) =>
            i < pick ? (
              <span key={i} className="hq-hero">
                <img src={heroArt(LOOKS[i % 3])} alt="" />
              </span>
            ) : (
              <span key={i} className="hq-hero locked">
                <Lock scale={3} />
              </span>
            ),
          )}
        </div>
        <Row k="Now" v={dealSummary(deal.level)} />
        {next && <Row k={`Level ${deal.level + 1}`} v={next.line.replace(/\.$/, '')} />}
        <BuyButton label={`Upgrade to level ${deal.level + 1}`} cost={deal.cost} can={deal.can} run={deal.buy} done="The best opening deal there is." />
      </Card>
      <Card title="Hiring Hall" line="A second Recruit stop on every map, and hires arrive trained for the depth you hire them at.">
        <BuyButton label="Open the Hiring Hall" cost={hiring.cost} can={hiring.can} run={hiring.buy} done="Open. Every map has a second Recruit stop." />
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

function FinanceOffice() {
  const bank = useMetaStore((s) => s.bank)
  const last = useMetaStore((s) => s.lastInterest)
  const standing = useMetaStore((s) => s.standing)
  const rate = useBuy('rate')
  const now = interestTerms(rate.level)
  const next = INTEREST[rate.level + 1]
  const payout = interestFor(bank, rate.level)
  // Bank vs. stake: the most interest pays against what the smallest stake and
  // the biggest you may carry add to a delivered contract, at full cargo.
  const escort = contractPlan({ company: 'spice', crates: 0, market: 1 }).profit
  const one = contractPlan({ company: 'spice', crates: 1, market: 1 }).profit - escort
  const most = crateCap(topStanding(standing))
  const big = contractPlan({ company: 'spice', crates: most, market: 1 }).profit - escort
  const top = Math.max(big, one, now.cap)
  const bars: [string, number, string][] = [
    ['Interest, at most', now.cap, 'var(--accent)'],
    ['1-crate stake', one, 'var(--co-spice)'],
    ...(most > 1 ? ([[`${most}-crate stake`, big, 'var(--co-spice)']] as [string, number, string][]) : []),
  ]
  return (
    <>
      <Card title="The bank" line="Gold left here earns interest each time you finish a contract.">
        <p className="hq-big" aria-label={moneyText(bank)}>
          <Gold n={bank} scale={3} />
        </p>
        <Row k="Interest" v={`${ratePct(now.rate)} per finished contract`} />
        <Row k="Most per contract" v={`${now.cap} gold`} />
        <Row k="Next contract" v={`+${payout} gold`} tone="good" />
        {last != null && <Row k="Last contract" v={`+${last} gold`} />}
        <p className="hq-note">
          You set out with a purse; the rest stays here and earns. A lost contract earns nothing. Interest is capped, so staking cargo always pays more.
        </p>
        <BuyButton
          label={next ? `Raise the rate to ${ratePct(next.rate)} · most ${next.cap}` : 'Maxed'}
          cost={rate.cost}
          can={rate.can}
          run={rate.buy}
          done={`The top rate. It fills at ${INTEREST_FULL_AT.toLocaleString('en')} gold banked.`}
        />
      </Card>
      <Card title="Bank vs. stake" line="What one delivered contract adds each way, in gold.">
        {bars.map(([label, n, color]) => (
          <div className="hq-cmp" key={label}>
            <span>{label}</span>
            <i style={{ width: `${Math.max(4, (100 * n) / top)}%`, background: color }} />
            <b>+{n}</b>
          </div>
        ))}
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

function OpsOffice() {
  const pack = useBuy('pack')
  const rocks = useBuy('rocks')
  const scouts = useBuy('scouting')
  const orders = useMetaStore((s) => s.orders)
  const bank = useMetaStore((s) => s.bank)
  const buyOrder = useMetaStore((s) => s.buyOrder)
  const slots = packSlots(pack.level)
  const fields = Math.max(Math.min(OBSTACLES, MIN_OBSTACLES), OBSTACLES - rocksCut(rocks.level, orders.rocks))
  const scoutNow = scoutsAt(scouts.level)
  return (
    <>
      <Card title="Pack slots" line="Room to carry gear between fights. A full pack sells its cheapest piece.">
        <span className="hq-slots" role="img" aria-label={`${slots} slots`}>
          {Array.from({ length: PACK_BASE + pack.max }, (_, i) => (
            <i key={i} className={i < slots ? 'on' : ''} />
          ))}
        </span>
        <BuyButton label={`Add a slot · ${slots + 1} of ${PACK_BASE + pack.max}`} cost={pack.cost} can={pack.can} run={pack.buy} done={`${slots} slots: the biggest pack there is.`} />
      </Card>

      <Card title="Boulders" line={`Rocks that block where heroes can stand. Each field lays ${OBSTACLES}; at least ${MIN_OBSTACLES} always stand.`}>
        <Row k="Your next fields" v={`${fields} boulders`} />
        <div className="hq-acts">
          {orders.rocks ? (
            <p className="hq-done">Cleared for your next contract.</p>
          ) : (
            <BuyButton wide={false} label={`Clear ${ROCK_ORDER_CUT} for one contract`} cost={ROCK_ORDER_PRICE} can={bank >= ROCK_ORDER_PRICE} run={() => buyOrder('rocks')} done="" />
          )}
          <BuyButton wide={false} label={`Fewer for good · ${rocks.level}/${rocks.max}`} cost={rocks.cost} can={rocks.can} run={rocks.buy} done={`${rocks.max} fewer, for good.`} />
        </div>
      </Card>

      <FocusCard />

      <Card title="Scouts" line="Your scouts map the road before you march.">
        <Row k="Level 1" v={scoutNow.standingOrders ? '✓ Every ambush has a way around' : 'Every ambush has a way around'} />
        <Row k="Level 2" v={scoutNow.wideMap ? '✓ Three or four roads every layer' : 'Three or four roads every layer'} />
        <BuyButton label={`Train the scouts · level ${scouts.level + 1}`} cost={scouts.cost} can={scouts.can} run={scouts.buy} done="Fully trained." />
      </Card>
    </>
  )
}

/**
 * Company focus: ONE company, chosen with the crests (free to switch), its
 * share raised by the permanent steps and, for one contract, an order. The
 * share line is the player's own item pool, before and after.
 */
function FocusCard() {
  const focus = useMetaStore((s) => s.focus)
  const setFocus = useMetaStore((s) => s.setFocus)
  const standing = useMetaStore((s) => s.standing)
  const items = useMetaStore((s) => s.items)
  const orders = useMetaStore((s) => s.orders)
  const bank = useMetaStore((s) => s.bank)
  const buyOrder = useMetaStore((s) => s.buyOrder)
  const f = useBuy('focus')
  const boost = focusBoost(f.level, orders.focus)
  const co = focus ? companyById(focus) : null
  const pool = itemPoolFor(items ?? [])
  const before = focus ? Math.round(100 * poolShare(weightPool(pool, null, kindCompany), focus, kindCompany)) : 0
  const after = focus ? Math.round(100 * poolShare(weightPool(pool, null, kindCompany, { company: focus, boost }), focus, kindCompany)) : 0
  return (
    <Card title="Company focus" line="One company at a time. Its skills and items fill more of the pool, on every road.">
      <div className="hq-focus" role="radiogroup" aria-label="Company in focus">
        {COMPANIES.map((c) => {
          const open = companyOpen(c.id, standing)
          return (
            <button
              key={c.id}
              role="radio"
              aria-checked={focus === c.id}
              aria-disabled={!open}
              className={`hq-fc${focus === c.id ? ' on' : ''}`}
              style={{ '--co': companyVar(c.id) } as CSSProperties}
              onClick={() => open && setFocus(focus === c.id ? null : (c.id as CompanyId))}
              title={open ? c.name : `${c.name} opens at Standing ${c.opensAt} with any company`}
            >
              <Crest company={c.id} scale={1} locked={!open} />
              <span>{c.goods.split(' ')[0]}</span>
            </button>
          )
        })}
      </div>
      <div className="hq-steps" aria-label={`Focus +${f.level * FOCUS_STEP}% for good`}>
        {Array.from({ length: f.max }, (_, i) => (
          <span key={i} className={i < f.level ? 'on' : ''}>
            +{(i + 1) * FOCUS_STEP}%
          </span>
        ))}
      </div>
      {co ? (
        <Row k={`${co.goods.split(' ')[0]} in your item pool`} v={boost ? `${before}% → ${after}%` : `${before}%`} />
      ) : (
        <Row k="In focus" v="No company yet — pick a crest" />
      )}
      <div className="hq-acts">
        {orders.focus ? (
          <p className="hq-done">+{FOCUS_STEP}% more for your next contract.</p>
        ) : (
          <BuyButton wide={false} label={`+${FOCUS_STEP}% for one contract`} cost={FOCUS_ORDER_PRICE} can={!!focus && bank >= FOCUS_ORDER_PRICE} run={() => buyOrder('focus')} done="" />
        )}
        <BuyButton
          wide={false}
          label={`Raise focus to +${(f.level + 1) * FOCUS_STEP}%`}
          cost={f.cost}
          can={f.can}
          run={f.buy}
          done={`+${f.max * FOCUS_STEP}% for good.`}
        />
      </div>
    </Card>
  )
}
