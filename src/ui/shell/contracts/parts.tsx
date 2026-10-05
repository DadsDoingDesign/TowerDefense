import type { CSSProperties, ReactNode } from 'react'
import { companyById, type CompanyId } from '../../../game/data/companies'
import { companyVar, moneyText, SOVEREIGN_VAR } from '../../channels'
import { Coin, Crest, Lantern, SovereignCrest } from '../../pixel'
import { CHARTER_NAME, CHARTER_TOWNS } from '../../../game/run/charter'

/**
 * The trade pages' shared parts (the mercenary company, build step 2), drawn
 * in the night-lantern direction the designer approved (`trade/r3/*.png`):
 * the shell's dark panels and gold accent, company colour as rails and light,
 * and a parchment slip wherever the world is talking (a letter, a receipt).
 */

/** The page skeleton: the `.pg` bands, with a head the page draws itself. */
export function ContractPage({
  head,
  children,
  foot,
  cta,
  heat,
  className,
  label,
}: {
  head: ReactNode
  children?: ReactNode
  foot?: ReactNode
  cta?: { label: ReactNode; run: () => void; disabled?: boolean; heavy?: boolean; name?: string }
  /** How warm the lantern glow behind the page is (0–1): a stake heats it. */
  heat?: number
  className?: string
  /** The page's accessible name when the head has no plain heading text. */
  label?: string
}) {
  return (
    <div className={`pg ct ${className ?? ''}`} style={heat != null ? ({ '--heat': heat.toFixed(2) } as CSSProperties) : undefined} aria-label={label}>
      <div className="pg-band pg-head ct-head">{head}</div>
      <div className="pg-band pg-body ct-body">{children}</div>
      {foot && <div className="pg-band pg-foot ct-foot">{foot}</div>}
      {cta && (
        <div className="pg-band pg-cta-band">
          <button className={`pg-cta${cta.heavy ? ' ct-heavy' : ''}`} disabled={cta.disabled} onClick={cta.run} aria-label={cta.name}>
            {cta.label}
          </button>
        </div>
      )}
    </div>
  )
}

/** An amount of gold with the pixel coin, always with its unit in the accessible name. */
export function Gold({ n, word = false, scale = 2, className }: { n: number; word?: boolean; scale?: number; className?: string }) {
  return (
    <span className={`ct-gold${className ? ` ${className}` : ''}`} role="img" aria-label={moneyText(n)}>
      <Coin scale={scale} />
      <span aria-hidden="true">
        {n.toLocaleString('en')}
        {word ? ' gold' : ''}
      </span>
    </span>
  )
}

/** "×1.3 today" — the market of the day, on the good it names. */
export const MarketTag = ({ mult }: { mult: number }) => (
  <span className="ct-market" title="Today's market: this company's goods sell for more">
    ×{mult} today
  </span>
)

/** The route's ground: a swatch chip beside its name (never a signal on its own). */
export const GroundChip = ({ company }: { company: CompanyId }) => {
  const g = companyById(company).ground
  return (
    <span className="ct-ground" style={{ '--gr': g.swatch } as CSSProperties}>
      {g.name}
    </span>
  )
}

/** Danger as 1–5 pips, numbered — never an invented probability. */
export function DangerPips({ n }: { n: number }) {
  return (
    <span className="ct-danger" role="img" aria-label={`Danger ${n} of 5`}>
      <span className="ct-danger-pips" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} className={i < n ? 'on' : ''} />
        ))}
      </span>
      <b aria-hidden="true">{n}/5</b>
    </span>
  )
}

/** The parchment receipt slip: the world's voice, light on the dark page. */
export function Slip({ eyebrow, children, className }: { eyebrow?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`ct-slip${className ? ` ${className}` : ''}`}>
      {eyebrow && <p className="ct-slip-k">{eyebrow}</p>}
      {children}
    </div>
  )
}

/** One dotted line of a slip: a label (and an italic note), then its value. */
export function SlipLine({ label, note, value, total }: { label: ReactNode; note?: string; value: ReactNode; total?: boolean }) {
  return (
    <div className={`ct-ln${total ? ' tot' : ''}`}>
      <span className="ct-ln-l">
        {label}
        {note && <small> {note}</small>}
      </span>
      <span className="ct-dots" aria-hidden="true" />
      <b className="ct-ln-v">{value}</b>
    </div>
  )
}

export interface RailStop {
  town: string
  /** Lit: the caravan has reached it. */
  lit: boolean
  /** The line under the town: "paid 240", "+170 gold". */
  line: string
  done?: boolean
}

/**
 * The route's three cities on a rail lit in the company's colour, as far as the
 * caravan has got (`progress`, 0–1 along the rail).
 */
export function RouteRail({ company, stops, progress, marker }: { company: CompanyId; stops: RailStop[]; progress: number; marker?: ReactNode }) {
  const p = Math.max(0, Math.min(1, progress))
  return (
    <div className="ct-rail" style={{ '--co': companyVar(company) } as CSSProperties}>
      <div className="ct-rail-track" aria-hidden="true">
        <span className="ct-rail-lit" style={{ width: `${p * 100}%` }} />
        {marker && (
          <span className="ct-rail-me" style={{ left: `${p * 100}%` }}>
            {marker}
          </span>
        )}
      </div>
      <ol className="ct-rail-stops">
        {stops.map((s) => (
          <li key={s.town} className={s.done ? 'done' : ''}>
            <Lantern lit={s.lit} />
            <b>{s.town}</b>
            <span>{s.line}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * The contract being set up, on the hero pick: whose road, how much cargo, to
 * where, and the purse — so a first-timer (who never sees the board) still
 * reads that this run is a job for someone.
 */
export function ContractChip({ company, crates, purse }: { company: CompanyId | null; crates: number; purse: number }) {
  if (!company) {
    // The Sovereign Route: no company's, every good, the fee already on the charter page.
    return (
      <p className="ct-contract-chip sovereign" style={{ '--co': SOVEREIGN_VAR } as CSSProperties}>
        <SovereignCrest scale={1} />
        <span>
          <b>{CHARTER_NAME}</b> · every good to {CHARTER_TOWNS[2]} · purse <Gold n={purse} scale={1} />
        </span>
      </p>
    )
  }
  const co = companyById(company)
  return (
    <p className="ct-contract-chip" style={{ '--co': companyVar(company) } as CSSProperties}>
      <Crest company={company} scale={1} />
      <span>
        <b>{co.name}</b> · {crates ? `${crates} crate${crates === 1 ? '' : 's'} of ${co.noun}` : 'escort'} to {co.towns[2]} · purse <Gold n={purse} scale={1} />
      </span>
    </p>
  )
}

/** A coach tip for a trade page: said once, the first time the page matters. */
export const PageTip = ({ children }: { children: ReactNode }) => (
  <p className="ct-tip" role="note">
    {children}
  </p>
)
