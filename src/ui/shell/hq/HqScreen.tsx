import { useState, type CSSProperties, type ReactNode } from 'react'
import { COMPANIES, companyById, type CompanyId } from '../../../game/data/companies'
import { itemPoolFor } from '../../../game/data/itemKinds'
import { kindCompany, poolShare, weightPool } from '../../../game/run/contracts'
import {
  BASE_INTEREST,
  DEAL_STEPS,
  dealSummary,
  FOCUS_FROM_RUN,
  FOCUS_ORDER_PRICE,
  FOCUS_STEP,
  focusBoost,
  hqCost,
  hqLevel,
  hqMax,
  interestFor,
  packSlots,
  PACK_BASE,
  ratePct,
  scoutsAt,
  type HqId,
  type Office,
} from '../../../game/run/hq'
import { companyOpen } from '../../../game/run/standing'
import { useMetaStore } from '../../../state/metaStore'
import { useSettingsStore } from '../../../state/settingsStore'
import { companyVar, moneyText } from '../../channels'
import { Icon } from '../../Icon'
import { Crest, Lock } from '../../pixel'
import { heroArt } from '../offers'
import { ContractPage, Gold, PageTip } from '../contracts/parts'
import { useReveal } from '../staging'

/**
 * The mercenary company's headquarters (build step 3; mockups
 * `trade/r3/7-hq-hr.png`, `7-hq-ops.png`): one page, two offices behind tabs,
 * and the bank's one rule (its free interest) under the tabs. Every card is
 * one purchase or one order, says what it does in one line, and shows its
 * price on its button. Every number is read off `game/run/hq.ts`; the store
 * refuses whatever the bank cannot pay.
 *
 * October 2026: the Finance office (its levels paid back in ~260 runs) and
 * "Fewer boulders" (−4pt measured) are gone; Operations keeps pack slots,
 * company focus (shown from the fifth finished contract) and the scouts.
 */
export function HqScreen({ onBack, initial = 'hr' }: { onBack: () => void; initial?: Office }) {
  const [office, setOffice] = useState<Office>(initial)
  const bank = useMetaStore((s) => s.bank)
  const taught = useSettingsStore((s) => s.taught.hq)
  const OFFICES: [Office, string][] = [
    ['hr', 'HR'],
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
              <span>Your militia · 2 offices</span>
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
      <BankLine bank={bank} />
      <div className="hq-body" role="tabpanel" id={`hq-panel-${office}`} aria-labelledby={`hq-tab-${office}`}>
        {office === 'hr' ? <HrOffice /> : <OpsOffice />}
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
// The bank: its one rule, where the bank is shown
// ---------------------------------------------------------------------------

/**
 * The bank's free interest (`hq.BASE_INTEREST`), a plain rule since the
 * Finance office was cut: the rate, the cap, and what the next finished
 * contract pays on the bank as it stands.
 */
function BankLine({ bank }: { bank: number }) {
  const last = useMetaStore((s) => s.lastInterest)
  return (
    <p className="hq-bankline" role="note">
      <span>
        <b>Bank interest</b> · next finished contract <b className="tone-good">+{interestFor(bank)}</b>
      </span>
      <small>
        {ratePct(BASE_INTEREST.rate)} of the bank each finished contract, up to {BASE_INTEREST.cap}
        {last != null ? ` · last +${last}` : ''}. Free.
      </small>
    </p>
  )
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

function OpsOffice() {
  const pack = useBuy('pack')
  const scouts = useBuy('scouting')
  const reveal = useReveal()
  const slots = packSlots(pack.level)
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

      {reveal.focus ? <FocusCard /> : <FocusLocked />}

      <Card title="Scouts" line="Your scouts map the road before you march.">
        <Row k="Level 1" v={scoutNow.standingOrders ? '✓ Every ambush has a way around' : 'Every ambush has a way around'} />
        <Row k="Level 2" v={scoutNow.wideMap ? '✓ Three or four roads every layer' : 'Three or four roads every layer'} />
        <BuyButton label={`Train the scouts · level ${scouts.level + 1}`} cost={scouts.cost} can={scouts.can} run={scouts.buy} done="Fully trained." />
      </Card>
    </>
  )
}

/** Company focus before it shows (the staggered reveal): what it is, and when it opens. */
function FocusLocked() {
  const runs = useMetaStore((s) => s.stats.runsCompleted)
  return (
    <section className="hq-card is-locked" aria-label={`Company focus: opens after your ${FOCUS_FROM_RUN}th finished contract`}>
      <h2>
        <Lock scale={2} /> Company focus
      </h2>
      <p className="hq-line">One company at a time. Its skills and items fill more of the pool, on every road.</p>
      <Row k={`Opens after your ${FOCUS_FROM_RUN}th finished contract`} v={`${Math.min(runs, FOCUS_FROM_RUN)} of ${FOCUS_FROM_RUN}`} />
    </section>
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
  const taught = useSettingsStore((s) => s.taught.focus)
  const learn = () => useSettingsStore.getState().markTaught('focus')
  const f = useBuy('focus')
  const boost = focusBoost(f.level, orders.focus)
  const co = focus ? companyById(focus) : null
  const pool = itemPoolFor(items ?? [])
  const before = focus ? Math.round(100 * poolShare(weightPool(pool, null, kindCompany), focus, kindCompany)) : 0
  const after = focus ? Math.round(100 * poolShare(weightPool(pool, null, kindCompany, { company: focus, boost }), focus, kindCompany)) : 0
  return (
    <Card title="Company focus" line="One company at a time. Its skills and items fill more of the pool, on every road.">
      {!taught && <PageTip>New: pick a company’s crest. Its skills and items turn up more often, on every road. Switching is free.</PageTip>}
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
              onClick={() => {
                if (!open) return
                setFocus(focus === c.id ? null : (c.id as CompanyId))
                learn()
              }}
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
