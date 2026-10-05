import { useState } from 'react'
import { itemKindById } from '../../../game/data/itemKinds'
import { ITEM_BASES } from '../../../game/data/items'
import { crateKinds, PULL_BASE, PULL_PRICE, pullLift, pullNewChance, pullOdds, type PullResult } from '../../../game/run/hq'
import { useGameStore } from '../../../state/gameStore'
import { useMetaStore } from '../../../state/metaStore'
import { useSettingsStore } from '../../../state/settingsStore'
import { itemIcon, moneyText } from '../../channels'
import { Icon } from '../../Icon'
import { Crate } from '../../pixel'
import { MenuRow } from '../Page'
import { ContractPage, Gold, PageTip, Slip } from '../contracts/parts'

const SLOT_WORD: Record<string, string> = { oneHand: 'Weapon', twoHand: 'Weapon', offHand: 'Off hand', body: 'Body' }

/** An item kind's icon, by its noun. */
const kindIcon = (kind: string) => itemIcon({ name: kind, slot: ITEM_BASES[kind]?.slot ?? 'oneHand' })

/**
 * Sealed crates — the item pull (build step 3; mockup `trade/r3/8-pull.png`).
 *
 * The framing leads (a side bet; contracts are the surer way), then the odds
 * in plain whole percent — the base and yours, with what your standing moved —
 * then some of what is inside, the duplicate rule on its own slip, and the
 * crate's price on the button. A crate is a hash of the save's crate seed and
 * its number (`hq.rollPull`), never a run stream.
 */
export function CratesScreen({ onBack }: { onBack: () => void }) {
  const bank = useMetaStore((s) => s.bank)
  const items = useMetaStore((s) => s.items)
  const standing = useMetaStore((s) => s.standing)
  const bonus = useMetaStore((s) => s.bonusItems)
  const openCrate = useMetaStore((s) => s.openCrate)
  const taught = useSettingsStore((s) => s.taught.crates)
  const openContracts = useGameStore((s) => s.openContracts)
  const [last, setLast] = useState<PullResult | null>(null)
  const lift = pullLift(standing)
  const odds = pullOdds(lift)
  const have = items ?? []
  const fresh = Math.round(100 * pullNewChance(have, lift))
  const all = [1, 2, 3].flatMap((l) => crateKinds(l as 1 | 2 | 3))
  const sample = [...all.filter((k) => !have.includes(k)), ...all.filter((k) => have.includes(k))].slice(0, 5)
  const can = bank >= PULL_PRICE
  const open = () => {
    const got = openCrate()
    if (got) setLast(got)
    useSettingsStore.getState().markTaught('crates')
  }
  const k = last ? itemKindById(last.kind) : undefined

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
      foot={
        <div className="pg-rows">
          <MenuRow label="Take a contract instead" icon="depth" big onClick={() => openContracts()} />
        </div>
      }
      cta={{
        label: (
          <>
            Open a crate <small className="ct-cta-cost"><Gold n={PULL_PRICE} /></small>
          </>
        ),
        name: `Open a crate, ${moneyText(PULL_PRICE)}${can ? '' : ' — your bank is short'}`,
        run: open,
        disabled: !can,
        heavy: true,
      }}
    >
      <div className="hq-crate-title">
        <span className={`hq-crate-art${last ? ' opened' : ''}`} aria-hidden="true">
          <Crate color="#e0ac4c" scale={4} />
        </span>
        <span>
          <h1 className="ct-title" tabIndex={-1}>
            Sealed crates
          </h1>
          <p>A side bet: one random item, yours for good. Contracts are the surer way to unlock gear.</p>
        </span>
      </div>

      {!taught && <PageTip>A crate is a gamble. Delivering a contract always unlocks an item.</PageTip>}

      {last && k && (
        <div className={`hq-pulled${last.duplicate ? ' dup' : ''}`} role="status" aria-live="polite">
          <span className="hq-pulled-icon" aria-hidden="true">
            <Icon name={kindIcon(last.kind)} lg />
          </span>
          <span className="hq-pulled-text">
            <span className="hq-pulled-k">{last.duplicate ? 'Already yours — a bonus item next contract' : 'New item unlocked'}</span>
            <b>{last.kind}</b>
            <small>
              {SLOT_WORD[k.slot]} · Level {k.level}
            </small>
            <span className="hq-pulled-does">{last.duplicate ? `A Rare ${last.kind} lands in your pack when you sign your next contract.` : k.does}</span>
          </span>
        </div>
      )}

      <section className="hq-odds" aria-label="The odds, per crate">
        <div className="hq-odds-h" aria-hidden="true">
          <span>Inside each crate</span>
          <span>Base</span>
          <span>Yours</span>
        </div>
        {odds.map((p, i) => (
          <div className="hq-odds-r" key={i} aria-label={`Level ${i + 1}: ${p} percent (base ${PULL_BASE[i]})`}>
            <span className="hq-odds-n">
              <i>L{i + 1}</i> Level {i + 1} <small>· {crateKinds((i + 1) as 1 | 2 | 3).length} kinds</small>
            </span>
            <span className="hq-odds-b">{PULL_BASE[i]}%</span>
            <span className="hq-odds-y">
              {p}%{p > PULL_BASE[i] && <em>+{p - PULL_BASE[i]}</em>}
            </span>
          </div>
        ))}
        <p className="hq-note">
          {lift > 0
            ? `Your standing with the companies moves ${lift} point${lift === 1 ? '' : 's'} from Level 1 to Levels 2 and 3.`
            : 'Standing with any company moves the odds toward Levels 2 and 3.'}{' '}
          {fresh > 0 ? (
            <>
              A kind you don’t have yet: <b>{fresh}%</b>.
            </>
          ) : (
            <b>You own every kind: each crate is a bonus item.</b>
          )}
        </p>
        {!can && <p className="hq-note">Your bank holds {bank.toLocaleString('en')} gold; a crate is {PULL_PRICE}.</p>}
      </section>

      <section className="hq-pool" aria-label="Some of what is in the crates">
        <p className="ct-eyebrow left">Some of what’s inside</p>
        <div className="hq-pool-row">
          {sample.map((kind) => (
            <span key={kind} className={`hq-pool-it${have.includes(kind) ? ' have' : ''}`} title={`${kind} · Level ${itemKindById(kind)?.level}${have.includes(kind) ? ' · yours' : ''}`}>
              <Icon name={kindIcon(kind)} lg />
              <small>{kind}</small>
            </span>
          ))}
        </div>
      </section>

      <Slip className="hq-dup">
        <p className="hq-dup-k">Already own it?</p>
        <p className="hq-dup-t">You get it as a bonus Rare item in your next contract, in your pack.</p>
        {bonus.length > 0 && <p className="hq-dup-t">Waiting for your next contract: {bonus.join(', ')}.</p>}
      </Slip>
    </ContractPage>
  )
}
