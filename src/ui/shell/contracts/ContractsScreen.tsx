import type { CSSProperties } from 'react'
import { hashSeed } from '../../../game/core/rng'
import { COMPANIES, companyById, type CompanyId } from '../../../game/data/companies'
import { RANDOM_UNLOCK_SKILLS } from '../../../game/data/skills'
import {
  CRATE_PRICE,
  contractLetter,
  contractPlan,
  crateCap,
  dangerPips,
  isMilestone,
  marketFor,
  MAX_CRATES,
  purseOptions,
  recordAt,
  utcDateKey,
} from '../../../game/run/contracts'
import { cardFloor, companyOpen, MAX_STANDING, standingOf, standingProgress } from '../../../game/run/standing'
import { difficultyEffect } from '../../../game/run/watch'
import { useGameStore } from '../../../state/gameStore'
import { useMetaStore } from '../../../state/metaStore'
import { useSettingsStore } from '../../../state/settingsStore'
import { stakeCap } from '../../../state/game/contractSlice'
import { companyVar } from '../../channels'
import { Icon } from '../../Icon'
import { Crate, Crest, Lock, Scroll, Sword } from '../../pixel'
import { ContractPage, DangerPips, Gold, GroundChip, MarketTag, PageTip, Slip, SlipLine } from './parts'

/**
 * The contract board and its terms (the mercenary company; mockups
 * `trade/r3/2-contracts.png`, `3-stakes.png`, `3-stakes-free.png`).
 *
 * Two steps on one screen, the way the mockups draw them: pick a company (its
 * ground, today's market, your standing, its letter, what the next standing
 * level unlocks), then the terms — the free escort or a stake of crates, what
 * the road pays at every city, and the purse you take. Every number is read
 * off `run/contracts.ts`; the store clamps whatever the page asks for.
 */
export function ContractsScreen() {
  const board = useGameStore((s) => s.board)
  if (!board) return null
  return board.step === 'terms' ? <Terms company={board.company} crates={board.crates} purse={board.purse} /> : <Board selected={board.company} seed={board.seed} />
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
// The board
// ---------------------------------------------------------------------------

function Board({ selected, seed }: { selected: CompanyId; seed: number }) {
  const standing = useMetaStore((s) => s.standing)
  const skills = useMetaStore((s) => s.skills)
  const pick = useGameStore((s) => s.boardPick)
  const terms = useGameStore((s) => s.boardTerms)
  const taught = useSettingsStore((s) => s.taught.board)
  const today = utcDateKey()
  const co = companyById(selected)
  const xp = standing[selected] ?? 0
  const prog = standingProgress(xp)
  const skillsLeft = RANDOM_UNLOCK_SKILLS.some((id) => !skills.includes(id))

  return (
    <ContractPage
      label="Contract board"
      head={
        <div className="ct-hdr">
          <Back label="Back to the menu" />
          <div className="ct-who">
            <h1 className="ct-title" tabIndex={-1}>
              Contract board
            </h1>
            <span>Pick a company, pick a road</span>
          </div>
          <BankChip />
        </div>
      }
      cta={{ label: 'Read the terms', run: terms, heavy: true, disabled: !companyOpen(selected, standing) }}
    >
      {!taught && <PageTip>Each company pays your militia to guard its road. The free escort is always on offer.</PageTip>}
      <div className="ct-list" role="radiogroup" aria-label="Company">
        {COMPANIES.map((c) => {
          const open = companyOpen(c.id, standing)
          const s = standingOf(standing, c.id)
          const market = marketFor(c.id, today)
          return (
            <button
              key={c.id}
              className={`ct-co${c.id === selected ? ' sel' : ''}${open ? '' : ' locked'}`}
              style={{ '--co': companyVar(c.id) } as CSSProperties}
              role="radio"
              aria-checked={c.id === selected}
              aria-disabled={!open}
              onClick={() => open && pick(c.id)}
            >
              <Crest company={c.id} locked={!open} />
              <span className="ct-co-main">
                <span className="ct-co-name">
                  <b>{c.name}</b> <span className="ct-co-goods">· {c.goods}</span>
                </span>
                <span className="ct-co-meta">
                  {open ? <GroundChip company={c.id} /> : <span className="ct-co-goods">Opens at Standing {c.opensAt} with any company</span>}
                  {open && market > 1 && <MarketTag mult={market} />}
                </span>
              </span>
              <span className="ct-co-lv">
                {open ? (
                  <>
                    <b>{s}</b>
                    <span>Standing</span>
                  </>
                ) : (
                  <Lock scale={3} />
                )}
              </span>
            </button>
          )
        })}
      </div>

      <div className="ct-letter">
        <p className="ct-letter-from">A letter from {co.name}</p>
        <p className="ct-letter-line">“{contractLetter(selected, hashSeed(seed, 'contract', selected))}”</p>
        <span className="ct-letter-seal">
          <Crest company={selected} />
        </span>
      </div>

      <div className="ct-next">
        <span className="ct-next-stone" aria-hidden="true">
          <Scroll sil="#5a4a36" />
          <b>?</b>
        </span>
        <span className="ct-next-text">
          {prog.max ? (
            <>
              <b>Standing {MAX_STANDING} with {co.name}</b>
              <span>The highest there is.</span>
            </>
          ) : skillsLeft ? (
            <>
              <b>Next: a random skill</b>
              <span>
                at Standing {prog.standing + 1} · {prog.need - prog.into} more standing XP
              </span>
            </>
          ) : (
            <>
              <b>Next: Standing {prog.standing + 1}</b>
              <span>Every skill is unlocked · one more crate</span>
            </>
          )}
        </span>
        {!prog.max && skillsLeft && cardFloor(prog.standing + 1) > 1 && <span className="ct-level">Level {cardFloor(prog.standing + 1)}+</span>}
      </div>
    </ContractPage>
  )
}

// ---------------------------------------------------------------------------
// The terms
// ---------------------------------------------------------------------------

function Terms({ company, crates, purse }: { company: CompanyId; crates: number; purse: number }) {
  const meta = useMetaStore()
  const setCrates = useGameStore((s) => s.setCrates)
  const setPurse = useGameStore((s) => s.setPurse)
  const sign = useGameStore((s) => s.signContract)
  const taught = useSettingsStore((s) => s.taught)
  const co = companyById(company)
  const market = marketFor(company, utcDateKey())
  const standing = standingOf(meta.standing, company)
  const standingCap = crateCap(standing)
  const cap = stakeCap(meta, company)
  const plan = contractPlan({ company, crates, market })
  const stake = crates * CRATE_PRICE
  const purses = purseOptions(meta.bank - stake)
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
          <Back label="Back to the contract board" />
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
      </div>

      {!taught.stakes && <PageTip>Each crate costs {CRATE_PRICE} gold and makes the road harder. Delivered, every crate pays more.</PageTip>}

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

      <label className="ct-purse">
        <span>
          <b>Purse for the road</b>
          <small>Spend it in the run; the rest comes home.</small>
        </span>
        <span className="ct-purse-pick">
          <Gold n={purse} />
          <select value={purse} onChange={(e) => setPurse(Number(e.target.value))} aria-label="Purse for the road, in gold">
            {purses.map((p) => (
              <option key={p} value={p}>
                {p} gold
              </option>
            ))}
          </select>
        </span>
      </label>
      {!taught.purse && <PageTip>The bank stays home. The purse is all you can spend on the road — merchants, repairs, hires.</PageTip>}
    </ContractPage>
  )
}
