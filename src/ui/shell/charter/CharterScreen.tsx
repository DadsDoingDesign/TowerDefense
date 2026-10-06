import type { CSSProperties } from 'react'
import { companyById } from '../../../game/data/companies'
import { SOVEREIGN_ITEM_KINDS } from '../../../game/data/itemKinds'
import {
  CHARTER_FEE,
  CHARTER_NAME,
  CHARTER_PAYOUT,
  CHARTER_TERMS,
  CHARTER_TOWNS,
  charterDoor,
  TRADE_OFFS,
} from '../../../game/run/charter'
import { useGameStore } from '../../../state/gameStore'
import { ADVANCE } from '../../../game/run/contracts'
import { useMetaStore } from '../../../state/metaStore'
import { companyVar, moneyText } from '../../channels'
import { Icon } from '../../Icon'
import { Coin, Crest, Lock, Sword } from '../../pixel'
import { ContractPage, Gold } from '../contracts/parts'
import { SovereignMark, sovereignIcon } from './SovereignParts'

/**
 * The Sovereign Route — the endgame charter's page (build step 5; mockups
 * `trade/r3/9-charter-locked.png` and `9-charter-open.png`).
 *
 * **Locked**: what opens it, as a meter — every skill and every item kind
 * unlocked — with the two parts behind it, and two lines on what it is. The
 * CTA says when it opens.
 *
 * **Open**: the contract. The three terms first (the fee, what finishing
 * pays, what a fall pays — October 2026: the fee 5,000, the payout 16,000, and
 * standing with all five companies either way), then every company's
 * condition in one line each,
 * then the road's own terms, then the Sovereign unlock — what is still to
 * win. The fee is on the button. Everything here is read off the pure rules
 * (`run/charter.ts`), so the page cannot promise what the road does not do.
 */
export function CharterScreen({ onBack }: { onBack: () => void }) {
  const bank = useMetaStore((s) => s.bank)
  const skills = useMetaStore((s) => s.skills)
  const items = useMetaStore((s) => s.items)
  const owned = useMetaStore((s) => s.sovereign)
  const record = useMetaStore((s) => s.charters)
  const signCharter = useGameStore((s) => s.signCharter)
  const door = charterDoor({ skills, items: items ?? [] })
  const pct = Math.floor(door.progress * 100)
  const can = door.open && bank >= CHARTER_FEE
  const left = SOVEREIGN_ITEM_KINDS.filter((k) => !owned.includes(k))

  const head = (
    <div className="ct-hdr">
      <button className="ct-back" onClick={onBack} aria-label="Back to the menu">
        <Icon name="back" />
      </button>
      <span className="ct-chip" title="Your bank">
        <Gold n={bank} />
      </span>
    </div>
  )

  return (
    <ContractPage
      className={`ch${door.open ? ' is-open' : ' is-locked'}`}
      label={CHARTER_NAME}
      head={head}
      cta={
        door.open
          ? {
              label: (
                <>
                  Charter the road <small className="ct-cta-cost"><Gold n={CHARTER_FEE} /></small>
                </>
              ),
              name: `Charter the road, ${moneyText(CHARTER_FEE)}${can ? '' : ' — your bank is short'}`,
              run: signCharter,
              disabled: !can,
              heavy: true,
            }
          : { label: 'Opens at 100%', run: () => undefined, disabled: true }
      }
    >
      <div className="ch-hero">
        <p className="ch-kick">The endgame charter</p>
        <h1 className="ct-title" tabIndex={-1}>
          {CHARTER_NAME}
        </h1>
        <p className="ch-sub">Sponsor your own road. Every good, every raider.</p>
        <span className="ch-frame" aria-hidden="true">
          <Sword scale={6} sil={door.open ? undefined : '#2f4a48'} />
        </span>
      </div>

      {!door.open ? (
        <>
          <section className="ch-meter" aria-label={`${pct}% unlocked. It opens when every skill and item is unlocked.`}>
            <div className="ch-meter-top">
              <span className="ct-eyebrow left">Opens when every skill and item is unlocked</span>
              <b aria-hidden="true">{pct}%</b>
            </div>
            <span className="ch-bar" aria-hidden="true">
              <i style={{ width: `${Math.max(1, pct)}%` }} />
            </span>
            <Part label="Skills unlocked" have={door.skills.have} need={door.skills.need} />
            <Part label="Items unlocked" have={door.items.have} need={door.items.need} />
          </section>
          <div className="ch-what">
            <p>
              <Coin scale={2} />
              <span>
                <b>All or nothing.</b> No crates, no city pay. One huge payout.
              </span>
            </p>
            <p>
              <Lock scale={2} />
              <span>
                <b>The only source of Sovereign items</b>, the top tier.
              </span>
            </p>
            <p>
              <Icon name="depth" />
              <span>
                <b>To get there:</b> every delivered contract unlocks a skill and an item; standing and sealed crates unlock more.
              </span>
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="ch-terms">
            <div>
              <span>Charter</span>
              <b>
                <Gold n={CHARTER_FEE} />
              </b>
            </div>
            <div>
              <span>If you finish</span>
              <b>
                <Gold n={CHARTER_PAYOUT} />
              </b>
              {left.length > 0 && (
                <small className="ch-plus">
                  + a <SovereignMark /> item
                </small>
              )}
            </div>
            <div className="risk">
              <span>If you fall</span>
              <b>No gold</b>
            </div>
          </div>
          <p className="ch-standing">
            <b>Standing with all five companies</b>, win or lose: each earns what an escort that ended the same way earns with its one.
          </p>

          <section className="ch-offs" aria-label="Every company sets a condition">
            <p className="ct-eyebrow left">Every company sets a condition</p>
            {TRADE_OFFS.map((t) => {
              const co = companyById(t.company)
              return (
                <div key={t.company} className="ch-off" style={{ '--co': companyVar(t.company) } as CSSProperties}>
                  <Crest company={t.company} scale={2} />
                  <span>
                    <b>
                      {co.name}: {t.rule}
                    </b>
                    <span>{t.line}</span>
                  </span>
                </div>
              )
            })}
          </section>

          <section className="ch-unlock" aria-label="The Sovereign unlock">
            <p className="ct-eyebrow left">
              <SovereignMark /> The Sovereign unlock
            </p>
            <p className="ch-unlock-line">
              {left.length > 0
                ? `Deliver it and one Sovereign item is yours: ${left.length} of ${SOVEREIGN_ITEM_KINDS.length} still to win.`
                : 'Every Sovereign item is yours. The payout is the whole of it now.'}
            </p>
            <div className="ch-kinds">
              {SOVEREIGN_ITEM_KINDS.map((k) => {
                const have = owned.includes(k)
                return (
                  <span key={k} className={`ch-kind${have ? ' have' : ''}`} title={have ? `${k} · yours` : 'Still to win'}>
                    {have ? <Icon name={sovereignIcon(k)} lg /> : <span className="ch-kind-q">?</span>}
                    <small>{have ? k : 'Locked'}</small>
                  </span>
                )
              })}
            </div>
            {record.runs > 0 && (
              <p className="ch-note">
                Your record: {record.delivered} of {record.runs} delivered.
              </p>
            )}
          </section>

          <section className="ch-road" aria-label="The road">
            <p className="ct-eyebrow left">The road</p>
            <ul>
              {CHARTER_TERMS.map((line) => (
                <li key={line}>{line}</li>
              ))}
              <li>
                By {CHARTER_TOWNS[0]} and {CHARTER_TOWNS[1]} to {CHARTER_TOWNS[2]}, with the <Gold n={ADVANCE} scale={1} /> advance every contract carries.
              </li>
            </ul>
          </section>


          {!can && (
            <p className="ch-note short">
              Your bank holds {bank.toLocaleString('en')} gold; the charter is {CHARTER_FEE.toLocaleString('en')}.
            </p>
          )}
        </>
      )}
    </ContractPage>
  )
}

/** One part of the door: a label, a small bar and "34/90". */
function Part({ label, have, need }: { label: string; have: number; need: number }) {
  return (
    <div className="ch-part">
      <span>{label}</span>
      <span className="ch-mini" aria-hidden="true">
        <i style={{ width: `${need ? (100 * have) / need : 100}%` }} />
      </span>
      <span>
        {have}/{need}
      </span>
    </div>
  )
}
