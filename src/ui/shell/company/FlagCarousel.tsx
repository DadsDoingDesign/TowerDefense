import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

/**
 * The flag builder's controls (Oct 2026).
 *
 * The designer, first: "like a Mario Kart carousel that you can swipe each to
 * swap or click to open all options"; then, on the six-row version: "this
 * takes up too much space — find a more compact way: two vertical carousels
 * (banner shape + icon shape), and under each a subset: banner = pattern,
 * icon = colour".
 *
 *  - `FlagWheel`: a vertical wheel, three in view — the chosen option large
 *    in the middle, its neighbours peeking above and below. Swipe it up or
 *    down (or ▲ ▼, a peeking item, the arrow keys) to turn it; tap the middle
 *    to open every option at once (`onOpenAll`, an `OptionGrid` sheet).
 *  - `PartCarousel`: a small horizontal carousel under each wheel (the
 *    pattern; the colour pairs).
 */
export interface CarouselOption {
  id: string
  name: string
}

const SLOT = 60 // px between neighbours on the wheel

export function FlagWheel<T extends CarouselOption>({
  label,
  options,
  value,
  onChange,
  render,
  onOpenAll,
}: {
  label: string
  options: readonly T[]
  value: string
  onChange: (id: string) => void
  /** An option's picture; `big` for the middle one. */
  render: (o: T, big: boolean) => ReactNode
  onOpenAll: () => void
}) {
  const n = options.length
  const at = Math.max(0, options.findIndex((o) => o.id === value))
  const cur = options[at]
  const step = (d: number) => onChange(options[(((at + d) % n) + n) % n].id)

  // The drag: follow the finger, then settle on the nearest option.
  const drag = useRef<{ y: number; id: number; moved: boolean } | null>(null)
  const [dy, setDy] = useState(0)
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { y: e.clientY, id: e.pointerId, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const off = e.clientY - d.y
    if (Math.abs(off) > 6) d.moved = true
    if (d.moved) setDy(off)
  }
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    if (!d || d.id !== e.pointerId) return
    if (d.moved) {
      const by = -Math.round(dy / SLOT) || (Math.abs(dy) > 22 ? -Math.sign(dy) : 0)
      setDy(0)
      if (by) step(by)
      return
    }
    setDy(0)
    // A tap: the middle opens every option; a peeking one turns to it.
    const box = e.currentTarget.getBoundingClientRect()
    const off = (e.clientY - (box.top + box.height / 2)) / SLOT
    if (Math.abs(off) < 0.6) onOpenAll()
    else step(Math.sign(off))
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') step(1)
    else if (e.key === 'ArrowUp') step(-1)
    else if (e.key === 'Enter' || e.key === ' ') onOpenAll()
    else return
    e.preventDefault()
  }

  const shown = [-1, 0, 1].map((off) => ({ off, o: options[(((at + off) % n) + n) % n] }))
  return (
    <div className="fw">
      <div className="fw-head">
        <span className="fw-label">{label}</span>
        <span className="fw-value">{cur.name}</span>
      </div>
      <div className="fw-body">
        <div
          className={`fw-strip${dy ? ' is-dragging' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={`${label}: ${cur.name}, ${at + 1} of ${n}. Swipe or use the arrow keys to change; press to see all.`}
          aria-haspopup="dialog"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => ((drag.current = null), setDy(0))}
          onKeyDown={onKey}
        >
          {shown.map(({ off, o }) => (
            <span
              key={`${o.id}:${off}`}
              className={`fw-item${off === 0 ? ' on' : ''}`}
              style={{ transform: `translate(-50%, calc(-50% + ${off * SLOT + dy}px)) scale(${off === 0 ? 1 : 0.72})`, opacity: off === 0 ? 1 : 0.5 }}
              aria-hidden="true"
            >
              {render(o, off === 0)}
            </span>
          ))}
        </div>
        <div className="fw-steps">
          <button type="button" className="fw-step" onClick={() => step(-1)} aria-label={`Previous ${label.toLowerCase()}`}>
            <Chevron up />
          </button>
          <button type="button" className="fw-step" onClick={() => step(1)} aria-label={`Next ${label.toLowerCase()}`}>
            <Chevron />
          </button>
        </div>
      </div>
    </div>
  )
}

const Chevron = ({ up = false }: { up?: boolean }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
  </svg>
)

/**
 * A small part's horizontal carousel (the pattern; the colour pairs; the
 * designer: "make these horizontal carousels"): three in view, the chosen one
 * ringed in the middle. Swipe it, tap ‹ › or a side item, or use the arrow keys.
 */
export function PartCarousel<T extends CarouselOption>({
  label,
  options,
  value,
  onPick,
  render,
}: {
  label: string
  options: readonly T[]
  /** The chosen option's id; one that is none of `options` shows the first, unringed. */
  value: string
  onPick: (id: string) => void
  render: (o: T) => ReactNode
}) {
  const n = options.length
  const found = options.findIndex((o) => o.id === value)
  const at = Math.max(0, found)
  const step = (d: number) => onPick(options[(((at + d) % n) + n) % n].id)
  const drag = useRef<{ x: number; id: number; moved: boolean } | null>(null)
  const [dx, setDx] = useState(0)
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, id: e.pointerId, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const off = e.clientX - d.x
    if (Math.abs(off) > 6) d.moved = true
    if (d.moved) setDx(off)
  }
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    if (!d || d.id !== e.pointerId) return
    if (d.moved) {
      const by = -Math.round(dx / PART_SLOT) || (Math.abs(dx) > 16 ? -Math.sign(dx) : 0)
      setDx(0)
      if (by) step(by)
      return
    }
    setDx(0)
    const box = e.currentTarget.getBoundingClientRect()
    const off = Math.round((e.clientX - (box.left + box.width / 2)) / PART_SLOT)
    if (off) step(off)
    else if (found < 0) step(0)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') step(1)
    else if (e.key === 'ArrowLeft') step(-1)
    else return
    e.preventDefault()
  }
  const shown = [-1, 0, 1].map((off) => ({ off, o: options[(((at + off) % n) + n) % n] }))
  return (
    <div className="fw-part">
      <div className="fw-head">
        <span className="fw-label">{label}</span>
        <span className="fw-sub">{found < 0 ? 'Your own' : options[at].name}</span>
      </div>
      <div className="fw-track">
        <button type="button" className="fw-nudge" onClick={() => step(-1)} aria-label={`Previous ${label.toLowerCase()}`}>
          ‹
        </button>
        <div
          className={`fw-row${dx ? ' is-dragging' : ''}`}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={1}
          aria-valuemax={n}
          aria-valuenow={at + 1}
          aria-valuetext={found < 0 ? 'Your own' : options[at].name}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => ((drag.current = null), setDx(0))}
          onKeyDown={onKey}
        >
          {shown.map(({ off, o }) => (
            <span
              key={`${o.id}:${off}`}
              className={`fw-chip${off === 0 && found >= 0 ? ' on' : ''}`}
              style={{ transform: `translate(calc(-50% + ${off * PART_SLOT + dx}px), -50%) scale(${off === 0 ? 1 : 0.78})`, opacity: off === 0 ? 1 : 0.55 }}
              aria-hidden="true"
            >
              {render(o)}
            </span>
          ))}
        </div>
        <button type="button" className="fw-nudge" onClick={() => step(1)} aria-label={`Next ${label.toLowerCase()}`}>
          ›
        </button>
      </div>
    </div>
  )
}
const PART_SLOT = 40 // px between neighbours on a part's carousel

/** Every option at once, as a grid: the wheel's "click to open all options". */
export function OptionGrid<T extends CarouselOption>({
  label,
  options,
  value,
  render,
  onPick,
  onClose,
}: {
  label: string
  options: readonly T[]
  value: string
  render: (o: T) => ReactNode
  onPick: (id: string) => void
  onClose: () => void
}) {
  return (
    <div className="fc-sheet">
      <div className="fc-sheet-head">
        <h2>{label}</h2>
        <button type="button" className="fc-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="fc-grid" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={o.id === value}
            className={`fc-cell${o.id === value ? ' on' : ''}`}
            onClick={() => onPick(o.id)}
          >
            <span className="fc-cell-art" aria-hidden="true">
              {render(o)}
            </span>
            <span className="fc-cell-name">{o.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
