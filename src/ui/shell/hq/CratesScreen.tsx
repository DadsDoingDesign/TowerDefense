import { useRef, useState, type CSSProperties } from 'react'
import { crateKinds, PULL_PRICE, pullLift, pullNewChance, pullOdds, type PullResult } from '../../../game/run/hq'
import { useMetaStore } from '../../../state/metaStore'
import { useSettingsStore } from '../../../state/settingsStore'
import { moneyText } from '../../channels'
import { Icon } from '../../Icon'
import { Coin } from '../../pixel'
import { LEVEL_HUE } from '../codex/codexModel'
import { ContractPage, Gold, PageTip } from '../contracts/parts'
import { useMenuMotion } from '../MenuScreen'
import { LOOK_NAME, lookFor, type CrateLook } from './crateArt'
import { CrateHero } from './CrateHero'
import { PAY_MS } from './crateIdle'
import { CrateOpening } from './CrateOpening'
import { crateShelf } from './crateShelf'
import '../../../styles/crates.css'

/**
 * Sealed crates — the item pull (Oct 2026: the crates pass, then the chest
 * pass; the designer: "The chance preview seems like I'm guna win those exact
 * items … it's really sad for what should be highly engaging interaction").
 *
 * One column, no tabs:
 *  - **the stage** — the hero chest (`CrateHero`) on its plinth, alive, in
 *    the look of how many you open at once (1–2 a wooden crate, 3–4 iron-banded,
 *    5 a gold-trimmed chest: `crateArt.lookFor` — presentation only, each is
 *    still one `openCrate`); the ribbon under it says how many (×3) and
 *    steps it; touching the chest opens them, like the CTA;
 *  - **where they come from** — one quiet line;
 *  - **what one holds** — abstract: a mystery card per level (its frame, a
 *    "?", its chance and how many of its kinds are new to you), never a
 *    picture of a kind, so nothing reads as a promise; New to you and what a
 *    duplicate becomes, as label/value rows;
 *  - **the CTA** — Open, with its price. Coins fly from it to the chest, and
 *    the opening (`CrateOpening`) starts from that chest.
 *
 * A crate is a hash of the save's crate seed and its number (`hq.rollPull`),
 * never a run stream; opening several opens each in turn.
 */
export function CratesScreen({ onBack }: { onBack: () => void }) {
  const bank = useMetaStore((s) => s.bank)
  const items = useMetaStore((s) => s.items)
  const standing = useMetaStore((s) => s.standing)
  const bonus = useMetaStore((s) => s.bonusItems)
  const openCrate = useMetaStore((s) => s.openCrate)
  const taught = useSettingsStore((s) => s.taught.crates)
  const motion = useMenuMotion()
  const [many, setMany] = useState(1)
  const [poke, setPoke] = useState(0)
  const [paying, setPaying] = useState<{ results: PullResult[]; look: CrateLook; from: { x: number; y: number } } | null>(null)
  const [opening, setOpening] = useState<{ results: PullResult[]; look: CrateLook } | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const have = items ?? []
  const lift = pullLift(standing)
  const odds = pullOdds(lift)
  const fresh = Math.round(100 * pullNewChance(have, lift))
  const shelf = crateShelf(bank)
  const k = Math.max(1, Math.min(many, Math.max(1, shelf.max)))
  const look = lookFor(k)
  const can = shelf.buys > 0
  const busy = !!paying || !!opening
  const name = k > 1 ? `Open ${k} crates` : 'Open a crate'

  const open = (fromEl?: Element | null) => {
    if (busy) return
    setPoke((n) => n + 1)
    if (!can) return
    const got: PullResult[] = []
    for (let i = 0; i < k; i++) {
      const r = openCrate()
      if (!r) break
      got.push(r)
    }
    useSettingsStore.getState().markTaught('crates')
    if (!got.length) return
    // The coins pay first (from the CTA to the chest), then the chest opens.
    const stage = stageRef.current?.getBoundingClientRect()
    const src = (fromEl ?? document.querySelector('.crates .pg-cta'))?.getBoundingClientRect()
    if (!motion || !stage || !src) {
      setOpening({ results: got, look })
      return
    }
    setPaying({ results: got, look, from: { x: src.left + src.width / 2 - (stage.left + stage.width / 2), y: src.top + src.height / 2 - (stage.top + stage.height * 0.46) } })
    // The chest hops as the coins land in it.
    window.setTimeout(() => setPoke((n) => n + 1), PAY_MS * 0.6)
    window.setTimeout(() => {
      setPaying(null)
      setOpening({ results: got, look })
    }, PAY_MS)
  }

  return (
    <ContractPage
      className={`hq crates${opening ? " is-under" : ""}`}
      label="Sealed crates"
      head={
        <div className="ct-hdr">
          <button className="ct-back" onClick={onBack} aria-label="Back to the menu">
            <Icon name="back" />
          </button>
          <span className="ct-chip" title="Your bank">
            <Gold n={bank} />
          </span>
        </div>
      }
      cta={{
        label: (
          <>
            {name} <small className="ct-cta-cost"><Gold n={k * PULL_PRICE} /></small>
          </>
        ),
        name: `${name}, ${moneyText(k * PULL_PRICE)}${can ? '' : ' — your bank is short'}`,
        run: () => open(document.querySelector('.crates .pg-cta .ct-cta-cost')),
        disabled: !can || busy,
        heavy: true,
      }}
    >
      <h1 className="cr-title" tabIndex={-1}>
        Sealed crates
      </h1>

      <div className={`cr-stage look-${look}${can ? ' is-ready' : ''}`} ref={stageRef}>
        <button
          type="button"
          className="cr-hero-btn"
          onClick={(e) => open(can ? document.querySelector('.crates .pg-cta .ct-cta-cost') : e.currentTarget)}
          aria-label={can ? `${name}, ${moneyText(k * PULL_PRICE)}: ${LOOK_NAME[look]}` : `${LOOK_NAME[look]}: your bank is short`}
          aria-disabled={!can || busy ? 'true' : undefined}
        >
          <CrateHero look={look} poke={poke} paused={!!opening} />
        </button>
        <div className="cr-ribbon" role="group" aria-label="How many crates to open">
          {shelf.max > 1 && (
            <button type="button" className="cr-rib-step" onClick={() => setMany(k - 1)} disabled={k <= 1 || busy} aria-label="One crate less">
              −
            </button>
          )}
          <b className="cr-rib-n" aria-live="polite">
            ×{k}
          </b>
          {shelf.max > 1 && (
            <button type="button" className="cr-rib-step" onClick={() => setMany(k + 1)} disabled={k >= shelf.max || busy} aria-label="One crate more">
              +
            </button>
          )}
        </div>
        {paying && (
          <span className="cr-pay" aria-hidden="true" style={{ '--fx': `${paying.from.x}px`, '--fy': `${paying.from.y}px` } as CSSProperties}>
            {Array.from({ length: 6 + 2 * paying.results.length }, (_, i) => (
              <span key={i} className="cr-pay-coin" style={{ '--i': i } as CSSProperties}>
                <Coin scale={3} />
              </span>
            ))}
          </span>
        )}
      </div>
      <p className={`cr-from${can ? '' : ' short'}`}>{can ? `Bank gold buys them · yours buys ${shelf.buys}` : `Your bank is ${moneyText(PULL_PRICE - bank)} short · contracts fill it`}</p>

      {!taught && <PageTip>A gamble: a delivered contract always unlocks an item.</PageTip>}

      <section className="cr-panel cr-inside" aria-label="What one crate holds">
        <h2 className="cr-h">One item, by chance</h2>
        <div className="cr-bands">
          {odds.map((p, i) => {
            const lvl = (i + 1) as 1 | 2 | 3
            const unseen = crateKinds(lvl).filter((x) => !have.includes(x)).length
            return (
              <div key={lvl} className="cr-band" style={{ '--lv': LEVEL_HUE[lvl] } as CSSProperties} aria-label={`Level ${lvl}: ${p} percent; ${unseen} of its kinds new to you`}>
                <span className="cr-myst" aria-hidden="true">
                  <span className="cr-lv">{lvl}</span>
                  <span className="cr-q">?</span>
                </span>
                <b className="cr-pct" aria-hidden="true">
                  {p}%
                </b>
                <span className="cr-band-k" aria-hidden="true">
                  Level {lvl}
                </span>
                <span className="cr-band-new" aria-hidden="true">
                  {unseen > 0 ? `${unseen} new` : 'All yours'}
                </span>
              </div>
            )
          })}
        </div>
        <div className="cr-rows">
          <div className="cr-row">
            <span className="field-k">New to you</span>
            <span className="field-v">{fresh > 0 ? `${fresh}%` : 'None left'}</span>
          </div>
          <div className="cr-row">
            <span className="field-k">Already yours</span>
            <span className="field-v">A Rare one, next contract</span>
          </div>
          {bonus.length > 0 && (
            <div className="cr-row">
              <span className="field-k">Waiting</span>
              <span className="field-v">{bonus.join(', ')}</span>
            </div>
          )}
        </div>
        <p className="cr-note">{lift > 0 ? 'Your standing lifts Levels 2 and 3.' : 'Standing with any company lifts Levels 2 and 3.'}</p>
      </section>

      {opening && (
        <CrateOpening
          results={opening.results}
          look={opening.look}
          onDone={() => {
            setOpening(null)
            setMany(1)
          }}
        />
      )}
    </ContractPage>
  )
}
