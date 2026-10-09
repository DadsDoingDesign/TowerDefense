import { useRef, type CSSProperties, type ReactNode } from 'react'
import { companyById, type CompanyId } from '../../../game/data/companies'
import { companyVar, moneyText, SOVEREIGN_VAR } from '../../channels'
import { Banner, Coin, Crest, Lantern, SovereignCrest } from '../../pixel'
import type { BannerLook } from '../../../game/data/banner'
import { CHARTER_NAME, CHARTER_TOWNS } from '../../../game/run/charter'
import { useMoreBelow } from '../Page'

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
  // The body's bottom fade only while there is more to scroll (3.5).
  const bodyRef = useRef<HTMLDivElement>(null)
  const more = useMoreBelow(bodyRef)
  return (
    <div className={`pg ct ${className ?? ''}`} style={heat != null ? ({ '--heat': heat.toFixed(2) } as CSSProperties) : undefined} aria-label={label}>
      <div className="pg-band pg-head ct-head">{head}</div>
      <div className={`pg-band pg-body ct-body${more ? ' more' : ''}`} ref={bodyRef}>
        {children}
      </div>
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
 * The hero pick's brand (Oct 2026; the designer: "this screen should feel more
 * branded to the company — the top should have the company flag I'm
 * repping"). The hiring company's cloth hangs from a rod across the head, in
 * its colour, with its seal, its name and the contract's terms; your own
 * militia's flag and name sit under it — who you fly for. The Sovereign
 * Route's cloth is its cyan and crown.
 */
export function ContractBanner({
  company,
  crates,
  purse,
  advance = false,
  militia,
}: {
  company: CompanyId | null
  crates: number
  purse: number
  advance?: boolean
  militia: { name: string; look: BannerLook } | null
}) {
  const co = company ? companyById(company) : null
  const word = advance ? 'advance' : 'purse'
  const terms = co
    ? `${crates ? `${crates} crate${crates === 1 ? '' : 's'} of ${co.noun}` : 'Escort'} to ${co.towns[2]}`
    : `Every good to ${CHARTER_TOWNS[2]}`
  return (
    <div className={`ct-banner${co ? '' : ' sovereign'}`} style={{ '--co': co ? co.color : SOVEREIGN_VAR } as CSSProperties}>
      <span className="ct-banner-rod" aria-hidden="true" />
      <div className="ct-banner-cloth">
        <span className="ct-banner-seal" aria-hidden="true">
          {company ? <Crest company={company} scale={3} /> : <SovereignCrest scale={3} />}
        </span>
        <span className="ct-banner-text">
          <span className="ct-banner-k">{co ? 'Under contract' : 'Your own charter'}</span>
          <b className="ct-banner-name">{co ? co.name : CHARTER_NAME}</b>
          <span className="ct-banner-terms">
            {terms} ·{' '}
            <span className="ct-banner-adv">
              {word} <Gold n={purse} scale={1} />
            </span>
          </span>
        </span>
      </div>
      {militia && (
        <p className="ct-banner-us">
          <Banner look={militia.look} scale={1} />
          <span>
            <b>{militia.name}</b>, flying for {co ? co.name : 'no company but its own'}
          </span>
        </p>
      )}
    </div>
  )
}

/** A coach tip for a trade page: said once, the first time the page matters. */
export const PageTip = ({ children }: { children: ReactNode }) => (
  <p className="ct-tip" role="note">
    {children}
  </p>
)
