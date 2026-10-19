import { useState, type CSSProperties } from 'react'
import { crateKinds, PULL_PRICE, pullLift, pullNewChance, pullOdds, type PullResult } from '../../../game/run/hq'
import { useMetaStore } from '../../../state/metaStore'
import { useSettingsStore } from '../../../state/settingsStore'
import { moneyText } from '../../channels'
import { Icon } from '../../Icon'
import { Pixel } from '../../pixel'
import { LEVEL_HUE } from '../codex/codexModel'
import { ContractPage, Gold, PageTip } from '../contracts/parts'
import { CRATE_PALETTE, CRATE_ROWS } from './crateArt'
import { CrateOpening, kindIcon } from './CrateOpening'
import { crateShelf, OPEN_MAX } from './crateShelf'
import '../../../styles/crates.css'

/**
 * Sealed crates — the item pull (Oct 2026, the crates pass; the designer:
 * "make the tabs and upgrade options more simple and clear and up to the ui
 * aesthetic of the rest of the app. This goes for the crate as well").
 *
 * One screen, no tabs, read top to bottom:
 *  - **the crate** — big, in pixels, with how many your bank buys on it, and
 *    one line on where crates come from;
 *  - **what one holds** — one item, by chance: the three levels as tiles
 *    (the Codex's hues), each with its chance; then New to you and what a
 *    duplicate becomes, as label/value rows; standing's lift as the one note;
 *  - **how many** — only when the bank buys two or more;
 *  - **the CTA** — Open, with its price.
 *
 * Opening plays `CrateOpening` over everything: the crates are opened first
 * (`metaStore.openCrate`, once per crate, exactly as one at a time), and the
 * opening only shows what they held. A crate is a hash of the save's crate
 * seed and its number (`hq.rollPull`), never a run stream.
 */
export function CratesScreen({ onBack }: { onBack: () => void }) {
  const bank = useMetaStore((s) => s.bank)
  const items = useMetaStore((s) => s.items)
  const standing = useMetaStore((s) => s.standing)
  const bonus = useMetaStore((s) => s.bonusItems)
  const openCrate = useMetaStore((s) => s.openCrate)
  const taught = useSettingsStore((s) => s.taught.crates)
  const [many, setMany] = useState(1)
  const [opening, setOpening] = useState<PullResult[] | null>(null)
  const have = items ?? []
  const lift = pullLift(standing)
  const odds = pullOdds(lift)
  const fresh = Math.round(100 * pullNewChance(have, lift))
  const shelf = crateShelf(bank)
  const k = Math.max(1, Math.min(many, shelf.max))
  const can = shelf.buys > 0

  const open = () => {
    const got: PullResult[] = []
    for (let i = 0; i < k; i++) {
      const r = openCrate()
      if (!r) break
      got.push(r)
    }
    useSettingsStore.getState().markTaught('crates')
    if (got.length) setOpening(got)
  }

  return (
    <ContractPage
      className="hq crates"
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
            {k > 1 ? `Open ${k} crates` : 'Open a crate'} <small className="ct-cta-cost"><Gold n={k * PULL_PRICE} /></small>
          </>
        ),
        name: `${k > 1 ? `Open ${k} crates` : 'Open a crate'}, ${moneyText(k * PULL_PRICE)}${can ? '' : ' — your bank is short'}`,
        run: open,
        disabled: !can,
        heavy: true,
      }}
    >
      <h1 className="cr-title" tabIndex={-1}>
        Sealed crates
      </h1>

      <div className={`cr-hero${can ? ' is-ready' : ''}`}>
        <span className="cr-hero-art" aria-hidden="true">
          <Pixel rows={CRATE_ROWS} palette={CRATE_PALETTE} scale={5} />
        </span>
        {can && (
          <span className="cr-count" role="img" aria-label={`Your bank buys ${shelf.buys}`}>
            ×{shelf.buys}
          </span>
        )}
        <p className={`cr-from${can ? '' : ' short'}`}>{can ? 'Bought with bank gold. Contracts fill the bank.' : `Your bank is ${moneyText(PULL_PRICE - bank)} short. Contracts fill it.`}</p>
      </div>

      {!taught && <PageTip>A gamble: a delivered contract always unlocks an item.</PageTip>}

      <section className="cr-panel cr-inside" aria-label="What one crate holds">
        <h2 className="cr-h">One item, by chance</h2>
        <div className="cr-bands">
          {odds.map((p, i) => {
            const lvl = (i + 1) as 1 | 2 | 3
            const pool = crateKinds(lvl)
            const sample = pool.find((x) => !have.includes(x)) ?? pool[0]
            return (
              <div key={lvl} className="cr-band" style={{ '--lv': LEVEL_HUE[lvl] } as CSSProperties} aria-label={`Level ${lvl}: ${p} percent`}>
                <span className="cr-band-in" aria-hidden="true">
                  <span className="cr-lv">{lvl}</span>
                  {sample && <Icon name={kindIcon(sample)} lg />}
                </span>
                <b className="cr-pct" aria-hidden="true">
                  {p}%
                </b>
                <span className="cr-band-k" aria-hidden="true">
                  Level {lvl}
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

      {shelf.max > 1 && (
        <div className="cr-many" role="group" aria-label="How many crates to open">
          <span className="field-k">Open</span>
          <button type="button" className="ct-step" onClick={() => setMany(k - 1)} disabled={k <= 1} aria-label="One crate less">
            −
          </button>
          <b className="field-v cr-many-n" aria-live="polite">
            {k}
          </b>
          <button type="button" className="ct-step" onClick={() => setMany(k + 1)} disabled={k >= shelf.max} aria-label="One crate more">
            +
          </button>
          <span className="cr-many-max" aria-hidden="true">
            of {Math.min(OPEN_MAX, shelf.buys)}
          </span>
        </div>
      )}

      {opening && (
        <CrateOpening
          results={opening}
          onDone={() => {
            setOpening(null)
            setMany(1)
          }}
        />
      )}
    </ContractPage>
  )
}
