import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { COMPANIES, type CompanyId } from '../../../game/data/companies'
import {
  BASE_INTEREST,
  CASTLE_TIERS,
  castlePart,
  castleTier,
  FOCUS_FROM_RUN,
  FOCUS_ORDER_PRICE,
  FOCUS_STEP,
  hqLevel,
  interestFor,
  ratePct,
  type CastlePartId,
  type CastleTierId,
  type HqId,
} from '../../../game/run/hq'
import { companyOpen } from '../../../game/run/standing'
import { useMetaStore } from '../../../state/metaStore'
import { useSettingsStore } from '../../../state/settingsStore'
import { readRaw, writeRaw } from '../../../state/storage'
import { companyVar, moneyText } from '../../channels'
import { Icon } from '../../Icon'
import { Crest, Lock } from '../../pixel'
import { useMedia } from '../../pointer'
import { Money } from '../Money'
import { PickCard, PickStrip, stepId, type PickTokenSpec } from '../PickStrip'
import { ContractPage, Gold, PageTip } from '../contracts/parts'
import { CASTLE_SCENE, CASTLE_SHEETS, type CastleLayer } from './castleScene.generated'
import { castleSheet, ctaWords, firstFocus, HQ_ORDER, hqCards, TIER_MARK, tierLine, type HqCardView } from './hqModel'

/**
 * The mercenary company's headquarters (the HQ pass, Oct 2026; the designer:
 * "I need the castle icon to be like castle upgrades … make the tabs and
 * upgrade options more simple and clear and up to the ui aesthetic of the rest
 * of the app").
 *
 * One page, no tabs — the two offices held five upgrades between them, and a
 * tab hid three of them — in three parts:
 *
 *  - **the castle** (`.hq-keep`): the HQ as it stands — each upgrade a part
 *    built level by level (`run/hq.castlePart`), the focused one lit, the
 *    whole castle in the material its milestones reached (`castleTier`:
 *    Timber, Stone, Fortified, Grand; the home plate shows the same), and one
 *    line naming the next milestone;
 *  - **pick one, then read** (`PickStrip` + `PickCard`, as the merchant and
 *    the battle's Upgrade panel): the five upgrades as picture tokens, each
 *    with its level pips and its price (in the warning ink when the bank is
 *    short; "Max"; a padlock while company focus is still to open), and the
 *    focused one's card — Now and Next, one note;
 *  - **the CTA** buys the focused upgrade's next level, and says why not when
 *    it cannot ("Need 110 more", "Fully upgraded").
 *
 * Why the strip and not a scroll of cards with a button each: one primary CTA
 * per screen (DESIGN_SYSTEM § 8 rule 6), the five prices side by side at a
 * glance (what can I afford?), and the same pick the merchant uses to buy —
 * Clash of Clans' tap-a-building, read its card, one Upgrade button. Not the
 * Codex's tiles and sheet: a tile opens a card and never buys.
 *
 * Every number is read off `game/run/hq.ts` (through `hqModel.ts`); the store
 * refuses whatever the bank cannot pay.
 */
export function HqScreen({ onBack }: { onBack: () => void }) {
  const bank = useMetaStore((s) => s.bank)
  const levels = useMetaStore((s) => s.upgrades)
  const runs = useMetaStore((s) => s.stats.runsCompleted)
  const focusCo = useMetaStore((s) => s.focus)
  const buy = useMetaStore((s) => s.buyUpgrade)
  const taught = useSettingsStore((s) => s.taught.hq)
  const cards = hqCards({ levels, bank, runs, focus: focusCo })
  const [picked, setPicked] = useState<HqId>(() => firstFocus(cards))
  const at = Math.max(0, cards.findIndex((c) => c.id === picked))
  const card = cards[at]
  const learn = () => useSettingsStore.getState().markTaught('hq')
  const can = card.state === 'buy'
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
            <span className="ct-who-text">
              <h1 className="ct-title" tabIndex={-1}>
                Headquarters
              </h1>
            </span>
          </div>
          <span className="ct-chip" title="Your bank">
            <Gold n={bank} />
          </span>
        </div>
      }
      cta={{
        label:
          card.state === 'short' ? (
            <>
              Need <small className="ct-cta-cost"><Gold n={card.short} /></small> more
            </>
          ) : card.state === 'buy' ? (
            <>
              {ctaWords(card)} <small className="ct-cta-cost"><Gold n={card.cost!} /></small>
            </>
          ) : (
            ctaWords(card)
          ),
        name:
          card.state === 'buy' || card.state === 'short'
            ? `Upgrade ${card.name} to level ${card.level + 1}, ${moneyText(card.cost!)}${can ? '' : ` — your bank is ${moneyText(card.short)} short`}`
            : `${card.name}: ${ctaWords(card)}`,
        run: () => {
          if (buy(card.id)) learn()
        },
        disabled: !can,
        heavy: true,
      }}
    >
      {!taught && <PageTip>Paid from your bank, kept for good. Tap an upgrade to read it.</PageTip>}
      <div className="hq-grid">
        <Keep levels={levels} lit={card.part} />
        <div className="pk hq-pick">
          <PickStrip
            className="hq-strip"
            label="HQ upgrades"
            tokens={cards.map((c) => token(c, runs))}
            focused={card.id}
            onFocus={(id) => setPicked(id as HqId)}
          />
          <UpgradeCard card={card} index={at} count={cards.length} onStep={(d) => setPicked((stepId(cards, card.id, d) ?? card.id) as HqId)} />
        </div>
        <BankLine bank={bank} />
      </div>
    </ContractPage>
  )
}

// ---------------------------------------------------------------------------
// The castle
// ---------------------------------------------------------------------------

/** One layer of a tier's sheet, stood where it belongs in the scene. */
function Layer({ url, sheetH, layer, className }: { url: string; sheetH: number; layer: CastleLayer; className: string }) {
  const [sx, sy, w, h, x, y] = layer
  return (
    <span
      className={className}
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        backgroundImage: `url(${url})`,
        backgroundPosition: `-${sx}px -${sy}px`,
        backgroundSize: `${CASTLE_SCENE.w}px ${sheetH}px`,
      }}
    />
  )
}

/** The whole castle in a tier: the scene, then each part at its level; the lit one ringed. */
function Castle({ tier, levels, lit, className = '' }: { tier: CastleTierId; levels: Readonly<Record<string, number>>; lit: CastlePartId | null; className?: string }) {
  const sheet = CASTLE_SHEETS[tier]
  const url = castleSheet(tier)
  return (
    <span className={`hq-castle${lit ? ' has-lit' : ''}${className ? ` ${className}` : ''}`} style={{ width: CASTLE_SCENE.w, height: CASTLE_SCENE.h }}>
      <Layer url={url} sheetH={sheet.h} layer={[0, 0, CASTLE_SCENE.w, CASTLE_SCENE.h, 0, 0]} className="hq-layer hq-base" />
      {HQ_ORDER.map((id) => {
        const p = castlePart(id, hqLevel(levels, id))
        return <Layer key={id} url={url} sheetH={sheet.h} layer={sheet.layers[p.id][p.level]} className={`hq-layer hq-part${p.id === lit ? ' is-lit' : ''}`} />
      })}
    </span>
  )
}

/** Remembers, on this device, the tier the castle was last seen in (a UI note, not the save). */
const SEEN_KEY = 'mm.hq.tierSeen'
const readSeen = (): number | null => {
  const v = readRaw(SEEN_KEY)
  const n = v == null ? NaN : Number(v)
  return Number.isFinite(n) ? n : null
}
// Refused in a private window: no celebration next time, nothing else.
const writeSeen = (n: number) => void writeRaw(SEEN_KEY, String(n))

/**
 * The tier's rise, once: the first time the page opens on a tier higher than
 * the one last seen here — or the moment a purchase on the page raises it —
 * the old castle fades off the new one and its name is hung up for a beat.
 * Nothing moves under reduced motion (the note is still kept).
 */
function useTierRise(index: number): number | null {
  const reducedSetting = useSettingsStore((s) => s.reducedMotion)
  const osReduced = useMedia('(prefers-reduced-motion: reduce)')
  const motion = !(reducedSetting || osReduced)
  const [rise, setRise] = useState<number | null>(() => {
    const seen = readSeen()
    return motion && seen != null && seen < index ? seen : null
  })
  const last = useRef(index)
  useEffect(() => {
    if (index > last.current && motion) setRise(last.current)
    last.current = index
    writeSeen(index)
  }, [index, motion])
  useEffect(() => {
    if (rise == null) return
    const t = setTimeout(() => setRise(null), RISE_MS)
    return () => clearTimeout(t)
  }, [rise])
  return rise
}
/** How long a rise plays: the old castle fades over the first half, the name holds, then goes. */
const RISE_MS = 2600

/** The HQ as it stands: the castle with the focused upgrade's part lit, its tier, and the next milestone. */
function Keep({ levels, lit }: { levels: Readonly<Record<string, number>>; lit: CastlePartId }) {
  const t = castleTier(levels)
  const line = tierLine(levels)
  const rise = useTierRise(t.index)
  return (
    <section className="hq-card hq-keep" aria-label={`Your HQ: ${t.tier.name}. ${line}.`}>
      <div className="hq-scene" style={{ height: CASTLE_SCENE.h }}>
        <Castle tier={t.tier.id} levels={levels} lit={lit} />
        {rise != null && (
          <span className="hq-rise" aria-hidden="true">
            <Castle tier={CASTLE_TIERS[rise].id} levels={levels} lit={null} className="hq-rise-old" />
            <span className="hq-rise-tag">{t.tier.name}</span>
          </span>
        )}
      </div>
      <div className="hq-stage" aria-hidden="true">
        <span className="hq-stage-name">{t.tier.name}</span>
        <ol className="hq-stages">
          {CASTLE_TIERS.map((st, i) => (
            <li key={st.id} className={i < t.index ? 'done' : i === t.index ? 'on' : ''}>
              <Icon name={TIER_MARK[st.id]} />
            </li>
          ))}
        </ol>
      </div>
      <p className={`hq-tier-line${t.next ? '' : ' is-done'}`} aria-hidden="true">
        {line}
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------------
// The strip and the card
// ---------------------------------------------------------------------------

/** Level pips: `on` of `of`. */
const Pips = ({ on, of }: { on: number; of: number }) => (
  <span className={`hq-pips${on >= of ? ' full' : ''}`}>
    {Array.from({ length: of }, (_, i) => (
      <i key={i} className={i < on ? 'on' : ''} />
    ))}
  </span>
)

function token(c: HqCardView, runs: number): PickTokenSpec {
  const art = (
    <span className="hq-tok">
      <Pips on={c.level} of={c.max} />
      <Icon name={c.mark} lg />
      {c.state === 'locked' && (
        <span className="hq-tok-lock">
          <Lock scale={1} />
        </span>
      )}
    </span>
  )
  const lvl = `level ${c.level} of ${c.max}`
  // Locked: the padlock says so; the foot counts the contracts towards it.
  if (c.state === 'locked')
    return { id: c.id, art, label: `${Math.min(runs, FOCUS_FROM_RUN)}/${FOCUS_FROM_RUN}`, state: 'locked', name: `${c.name}, locked. ${c.locked}` }
  if (c.state === 'max') return { id: c.id, art, label: 'Max', name: `${c.name}, ${lvl}, fully upgraded` }
  return {
    id: c.id,
    art,
    label: '',
    value: <Money amount={c.cost!} c="gold" />,
    warn: c.state === 'short',
    name: `${c.name}, ${lvl}, next ${moneyText(c.cost!)}${c.state === 'short' ? ', your bank is short' : ''}`,
  }
}

function UpgradeCard({ card, index, count, onStep }: { card: HqCardView; index: number; count: number; onStep: (d: number) => void }) {
  const runs = useMetaStore((s) => s.stats.runsCompleted)
  // The part it builds, then its level: "Lookout · 1/2".
  const kicker = `${card.partName} · ${card.state === 'locked' ? 'Locked' : `${card.level}/${card.max}`}`
  return (
    <PickCard
      className={`hq-up is-${card.state}`}
      art={<Icon name={card.mark} lg />}
      kicker={kicker}
      name={card.name}
      index={index}
      count={count}
      onStep={onStep}
      noun="upgrade"
    >
      <dl className="hq-rows">
        {card.state === 'locked' ? (
          <>
            <Row k="Opens" v={card.locked!.replace(/^Opens a/, 'A')} />
            <Row k="So far" v={`${Math.min(runs, FOCUS_FROM_RUN)} of ${FOCUS_FROM_RUN}`} />
          </>
        ) : (
          <>
            <Row k="Now" v={card.now} quiet={card.level === 0} />
            <Row k="Next" v={card.next ?? '—'} quiet={!card.next} next={!!card.next} />
          </>
        )}
      </dl>
      {card.note && <p className="pg-card-body note hq-note-line">{card.note}</p>}
      {card.id === 'focus' && card.state !== 'locked' && <FocusPick />}
    </PickCard>
  )
}

const Row = ({ k, v, quiet, next }: { k: string; v: string; quiet?: boolean; next?: boolean }) => (
  <div className={`hq-row${next ? ' is-next' : ''}`}>
    <dt className="field-k">{k}</dt>
    <dd className={`field-v${quiet ? ' quiet' : ''}`} title={v}>
      {v}
    </dd>
  </div>
)

/**
 * Company focus's own controls: which company (the crests, free to switch,
 * applied on the tap), and the one-contract order (a second, quiet purchase —
 * the page's CTA raises the focus for good).
 */
function FocusPick() {
  const focus = useMetaStore((s) => s.focus)
  const setFocus = useMetaStore((s) => s.setFocus)
  const standing = useMetaStore((s) => s.standing)
  const orders = useMetaStore((s) => s.orders)
  const bank = useMetaStore((s) => s.bank)
  const buyOrder = useMetaStore((s) => s.buyOrder)
  const canOrder = !!focus && bank >= FOCUS_ORDER_PRICE
  return (
    <div className="hq-focus-pick">
      <div className="hq-focus" role="radiogroup" aria-label="Company in focus">
        {COMPANIES.map((c) => {
          const open = companyOpen(c.id, standing)
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={focus === c.id}
              aria-disabled={!open}
              aria-label={open ? `${c.name} in focus` : `${c.name}: opens at Standing ${c.opensAt} with any company`}
              className={`hq-fc${focus === c.id ? ' on' : ''}`}
              style={{ '--co': companyVar(c.id) } as CSSProperties}
              onClick={() => {
                if (!open) return
                setFocus(focus === c.id ? null : (c.id as CompanyId))
              }}
              title={open ? c.name : `${c.name} opens at Standing ${c.opensAt} with any company`}
            >
              <Crest company={c.id} scale={2} locked={!open} />
            </button>
          )
        })}
      </div>
      {orders.focus ? (
        <p className="hq-order is-done" role="status">
          +{FOCUS_STEP}% more next contract
        </p>
      ) : (
        <button
          type="button"
          className="hq-order"
          disabled={!canOrder}
          onClick={() => buyOrder('focus')}
          aria-label={`+${FOCUS_STEP}% for your next contract only, ${moneyText(FOCUS_ORDER_PRICE)}${focus ? (canOrder ? '' : ' — your bank is short') : ' — pick a company first'}`}
        >
          <span>+{FOCUS_STEP}% next contract only</span>
          <Money amount={FOCUS_ORDER_PRICE} c="gold" />
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The bank: its one rule, where the bank is shown
// ---------------------------------------------------------------------------

/** The bank's free interest (`hq.BASE_INTEREST`): one quiet line under the upgrades. */
function BankLine({ bank }: { bank: number }) {
  return (
    <p className="hq-bankline" role="note">
      <span className="field-k">Bank interest</span>
      <span className="hq-bank-v">
        <b>+{interestFor(bank)}</b> next finished contract
      </span>
      <small>
        {ratePct(BASE_INTEREST.rate)} of the bank, up to {BASE_INTEREST.cap}
      </small>
    </p>
  )
}
