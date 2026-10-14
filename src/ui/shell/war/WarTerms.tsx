import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { companyById, rivalOf, type CompanyId } from '../../../game/data/companies'
import {
  canSignExclusive,
  COLD_CRATES,
  contractsLeft,
  desperateLine,
  EXCLUSIVE_XP,
  EXCLUSIVE_XP_UNRIVALLED,
  isCold,
  isDesperate,
  seasonCrateCap,
} from '../../../game/run/tradeWar'
import { standingOf } from '../../../game/run/standing'
import { useMetaStore } from '../../../state/metaStore'
import { companyVar } from '../../channels'
import { Crest } from '../../pixel'
import { shortName, useWar } from './WarParts'

const pct = (m: number) => `+${Math.round((m - 1) * 100)}%`

/**
 * The trade war on a company's terms (Draft 4 § D): its season facts, said
 * once each — desperate terms (pays ×1.5, raiders 20% stronger), your
 * exclusive with it, or its cold shoulder while your exclusive is with its
 * rival — and, while no exclusive is signed this season, the way to offer it
 * one (the exclusive sheet, mockup 4a). Nothing before the war shows.
 */
export function WarTerms({ company }: { company: CompanyId }) {
  const { open, season } = useWar()
  const xp = useMetaStore((s) => s.standing)
  const [sheet, setSheet] = useState(false)
  if (!open) return null
  const desperate = isDesperate(season, company)
  const mine = season.exclusive === company
  const cold = isCold(season, company)
  const offer = canSignExclusive(season, company)
  if (!desperate && !mine && !cold && !offer) return null
  const left = contractsLeft(season)
  return (
    <div className="tw-terms" style={{ '--co': companyVar(company) } as CSSProperties}>
      {desperate && (
        <p className="tw-fact is-desperate">
          <span className="field-k">Desperate terms · Season {season.n}</span>
          <span className="tw-fact-v">{desperateLine()}</span>
        </p>
      )}
      {mine && (
        <p className="tw-fact is-exclusive">
          <span className="field-k">Your exclusive · Season {season.n}</span>
          <span className="tw-fact-v">{pct(rivalOf(company) ? EXCLUSIVE_XP : EXCLUSIVE_XP_UNRIVALLED)} standing from its contracts</span>
        </p>
      )}
      {cold && season.exclusive && (
        <p className="tw-fact is-cold">
          <span className="field-k">Cold · Season {season.n}</span>
          <span className="tw-fact-v">
            Your exclusive is with {shortName(season.exclusive)}: stakes stop at {seasonCrateCap(season, company, standingOf(xp, company))} crates
          </span>
        </p>
      )}
      {offer && (
        <button type="button" className="tw-offer" onClick={() => setSheet(true)}>
          <span className="field-k">{shortName(company)} offers</span>
          <b>An exclusive for Season {season.n}</b>
          <span>
            {left} contract{left === 1 ? '' : 's'} left <i aria-hidden="true">›</i>
          </span>
        </button>
      )}
      {sheet && <ExclusiveSheet company={company} onClose={() => setSheet(false)} />}
    </div>
  )
}

/**
 * The exclusive's offer (mockup 4a): what the company gives, what its rival
 * does, and when both lift. "Sign the exclusive" commits; "Not this season"
 * closes and changes nothing.
 */
export function ExclusiveSheet({ company, onClose }: { company: CompanyId; onClose: () => void }) {
  const { season } = useWar()
  const sign = useMetaStore((s) => s.signExclusive)
  const co = companyById(company)
  const rival = rivalOf(company)
  const left = contractsLeft(season)
  return (
    <Sheet label={`${co.name} offers an exclusive`} onClose={onClose}>
      <div className="tw-sheet" style={{ '--co': companyVar(company) } as CSSProperties}>
        <div className="tw-sheet-head">
          <Crest company={company} scale={3} />
          <span>
            <span className="field-k">{co.name} offers</span>
            <h2>An exclusive</h2>
            <span className="tw-sheet-sub">
              For the rest of Season {season.n} · {left} contract{left === 1 ? '' : 's'}
            </span>
          </span>
        </div>
        <div className="tw-box is-gives">
          <p className="field-k">{co.name} gives</p>
          <p>{pct(rival ? EXCLUSIVE_XP : EXCLUSIVE_XP_UNRIVALLED)} standing from its contracts</p>
        </div>
        {rival ? (
          <div className="tw-box is-rival" style={{ '--rv': companyVar(rival) } as CSSProperties}>
            <p className="field-k">{companyById(rival).name}, its rival, turns cold</p>
            <p>Its stakes stop {COLD_CRATES} crate lower</p>
            <p>Its notice turns cold on the map</p>
          </div>
        ) : (
          <div className="tw-box">
            <p className="field-k">No rival</p>
            <p>{co.name} sells to everyone: the exclusive costs nothing.</p>
          </div>
        )}
        <p className="tw-sheet-note">{rival ? 'Both lift' : 'It lifts'} when Season {season.n + 1} opens.</p>
        <div className="tw-sheet-acts">
          <button
            type="button"
            className="pg-cta"
            onClick={() => {
              if (sign(company)) onClose()
            }}
          >
            Sign the exclusive
          </button>
          <button type="button" className="pg-dual-btn" onClick={onClose}>
            Not this season
          </button>
        </div>
      </div>
    </Sheet>
  )
}

/** A modal sheet over the page: Escape and the scrim close it, focus returns where it was. */
function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('.pg-cta')?.focus()
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      back?.focus?.()
    }
  }, [])
  // On the body, over the page's bands (the terms' foot and CTA would otherwise sit on top of it).
  return createPortal(
    <div className="tw-scrim" role="dialog" aria-modal="true" aria-label={label} ref={ref} onClick={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </div>,
    document.body,
  )
}
