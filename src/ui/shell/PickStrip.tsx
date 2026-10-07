import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'

/**
 * ---------------------------------------------------------------------------
 * Pick one, then read (October 2026; Figma "Proposal · Pick one, then read")
 * ---------------------------------------------------------------------------
 *
 * The designer: "when i have multiple options of a new thing like the company,
 * the first hero, etc it should be similar to a tabbing behavior so the options
 * dont take up a ton of space, then the info for each option is displayed
 * systematically below making it quick to focus on each option 1 by 1 and then
 * compare that way. the tabs shouldnt look like tabs necessarily".
 *
 * So every choose-one surface — the contract board, the hero pick, a recruit,
 * a city's cash-out-or-press-on, a skill milestone — is the same three parts:
 *
 *   [tok] [TOK] [tok] [tok]      ← `PickStrip`: a picture + ONE label/number,
 *          ▾                        no name, so nothing in the strip truncates
 *   ┌ art  KICKER        1/4 ┐   ← `PickCard`: always the same recipe — head,
 *   │      Name              │      three key facts, what it does, specifics
 *   │ FACT | FACT | FACT     │
 *   │ what it does…          │
 *   └────────────────────────┘
 *   [ Read Peppercorn's terms ]  ← the CTA names the focused option
 *
 * A tap on a token FOCUSES it and never commits; comparing is flipping — the
 * eye stays on the card and only its values change, while the strip shows the
 * deciding number for every option at once. On a desk (≥900 wide) the strip
 * stands as a rail beside the card (`pick.css`).
 *
 * Not for one-tap surfaces (the spoils, the campfire): those commit on the tap
 * by design, and a strip that only focuses would add a step back.
 */

export interface PickTokenSpec {
  id: string
  /** The picture that fills the token's top: a logo, a hero's sprite, an icon. */
  art: ReactNode
  /** The one label under it: "Rep:", "DPS", "Gold". */
  label: string
  /** Its number, right-aligned; absent where there is nothing to weigh. */
  value?: ReactNode
  /** The control's accessible name — the option's full name and its number. */
  name: string
  /** `locked`: not open yet (the card says when). `unavailable`: open, but out of reach now. */
  state?: 'locked' | 'unavailable'
  /** Paints the value in the warning ink ("need 40"). */
  warn?: boolean
  /** A hue for the token's foot rail (a company's colour, a hero's look). */
  rail?: string
}

/**
 * The options, one token each, as a radio group: ← → (and ↑ ↓ on the desk
 * rail) move the focus, Home and End jump to the ends, and focus follows the
 * selection — so a keyboard reads the card for every option in turn.
 */
export function PickStrip({
  label,
  tokens,
  focused,
  onFocus,
  className,
}: {
  label: string
  tokens: readonly PickTokenSpec[]
  focused: string | null
  onFocus: (id: string) => void
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const at = Math.max(
    0,
    tokens.findIndex((t) => t.id === focused),
  )
  const move = (i: number) => {
    const t = tokens[(i + tokens.length) % tokens.length]
    if (!t) return
    onFocus(t.id)
    ref.current?.querySelector<HTMLButtonElement>(`[data-pick="${CSS.escape(t.id)}"]`)?.focus()
  }
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (step) move(at + step)
    else if (e.key === 'Home') move(0)
    else if (e.key === 'End') move(tokens.length - 1)
    else return
    e.preventDefault()
  }
  return (
    <div
      ref={ref}
      className={`pk-strip${className ? ` ${className}` : ''}`}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
      style={{ '--pk-n': tokens.length } as CSSProperties}
    >
      {tokens.map((t, i) => {
        const on = i === at
        return (
          <button
            key={t.id}
            type="button"
            data-pick={t.id}
            className={`pk-tok${t.state ? ` ${t.state}` : ''}`}
            role="radio"
            aria-checked={on}
            aria-label={t.name}
            // One tab stop for the group; the arrows move within it.
            tabIndex={on ? 0 : -1}
            data-sfx="toggle"
            style={t.rail ? ({ '--pk-rail': t.rail } as CSSProperties) : undefined}
            onClick={() => onFocus(t.id)}
          >
            <span className="pk-art" aria-hidden="true">
              {t.art}
            </span>
            <span className="pk-foot" aria-hidden="true">
              <span className="pk-label">{t.label}</span>
              {t.value != null && <b className={`pk-value${t.warn ? ' warn' : ''}`}>{t.value}</b>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** One key fact in the card's row of three: "REP 3", "MARKET ×1.3 today". */
export interface PickFact {
  label: string
  value: ReactNode
  tone?: 'good' | 'bad' | 'accent' | 'hot'
}

/**
 * The focused option, always in the same recipe: a head (its picture, a
 * kicker, its name, "n / N" with steps), up to three key facts, then whatever
 * the surface needs below — what it does, its gear, its letter.
 */
export function PickCard({
  art,
  kicker,
  name,
  index,
  count,
  onStep,
  facts,
  children,
  className,
  style,
  noun = 'option',
}: {
  art?: ReactNode
  kicker?: ReactNode
  name: ReactNode
  index: number
  count: number
  onStep: (delta: number) => void
  facts?: readonly PickFact[]
  children?: ReactNode
  className?: string
  style?: CSSProperties
  /** What one option is called, for the step buttons' names ("Next company"). */
  noun?: string
}) {
  return (
    <section className={`pk-card${className ? ` ${className}` : ''}`} style={style}>
      <div className="pk-head">
        {art && (
          <span className="pk-head-art" aria-hidden="true">
            {art}
          </span>
        )}
        <span className="pk-head-text">
          {kicker && <span className="pk-kicker">{kicker}</span>}
          <span className="pk-name">{name}</span>
        </span>
        {count > 1 && (
          <span className="pk-pager">
            <button type="button" className="pk-step" aria-label={`Previous ${noun}`} onClick={() => onStep(-1)}>
              ‹
            </button>
            <span className="pk-n">
              {index + 1} / {count}
            </span>
            <button type="button" className="pk-step" aria-label={`Next ${noun}`} onClick={() => onStep(1)}>
              ›
            </button>
          </span>
        )}
      </div>
      {facts && facts.length > 0 && (
        <dl className="pk-facts">
          {facts.map((f) => (
            <div key={f.label} className={`pk-fact${f.tone ? ` ${f.tone}` : ''}`}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </section>
  )
}

/** A labelled block inside the card: "GEAR", "SKILL", "NEXT AT STANDING 4". */
export const PickSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="pk-sec">
    <p className="pk-sec-k">{title}</p>
    {children}
  </div>
)

/** Step a focus through a list, wrapping at the ends. */
export function stepId<T extends { id: string }>(list: readonly T[], current: string | null, delta: number): string | null {
  if (!list.length) return null
  const i = Math.max(
    0,
    list.findIndex((t) => t.id === current),
  )
  return list[(i + delta + list.length) % list.length].id
}
