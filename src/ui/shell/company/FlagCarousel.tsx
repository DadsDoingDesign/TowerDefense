import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

/**
 * One row of the flag builder (Oct 2026; the designer: "like a Mario Kart
 * carousel that you can swipe each to swap or click to open all options").
 *
 * The options wrap round, five in view: the chosen one large in the middle,
 * two either side shrinking away. Swipe the row (or tap ‹ ›, or a side item,
 * or the arrow keys) to turn it; tap the middle to open every option at once
 * (`onOpenAll`). A drag follows the finger and settles on the nearest option.
 */
export interface CarouselOption {
  id: string
  name: string
}

const SLOT = 66 // px between neighbours

export function FlagCarousel<T extends CarouselOption>({
  label,
  options,
  value,
  onChange,
  render,
  onOpenAll,
  disabled,
  note,
}: {
  label: string
  options: readonly T[]
  value: string
  onChange: (id: string) => void
  render: (o: T) => ReactNode
  onOpenAll: () => void
  disabled?: boolean
  /** Said in place of the value when the row is disabled ("Pick a pattern first"). */
  note?: string
}) {
  const n = options.length
  const at = Math.max(0, options.findIndex((o) => o.id === value))
  const cur = options[at]
  const step = (d: number) => onChange(options[(((at + d) % n) + n) % n].id)

  // The drag: follow the finger, then settle on the nearest option.
  const drag = useRef<{ x: number; id: number; moved: boolean } | null>(null)
  const [dx, setDx] = useState(0)
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return
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
      const by = -Math.round(dx / SLOT) || (Math.abs(dx) > 24 ? -Math.sign(dx) : 0)
      setDx(0)
      if (by) step(by)
      return
    }
    setDx(0)
    // A tap: the middle opens every option; a side item turns to it.
    const box = e.currentTarget.getBoundingClientRect()
    const off = Math.round((e.clientX - (box.left + box.width / 2)) / SLOT)
    if (off === 0) onOpenAll()
    else step(off)
  }
  const onKey = (e: KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'ArrowRight') step(1)
    else if (e.key === 'ArrowLeft') step(-1)
    else if (e.key === 'Enter' || e.key === ' ') onOpenAll()
    else return
    e.preventDefault()
  }

  const shown = [-2, -1, 0, 1, 2].map((off) => ({ off, o: options[(((at + off) % n) + n) % n] }))
  return (
    <div className={`fc${disabled ? ' is-off' : ''}`}>
      <div className="fc-head">
        <span className="fc-label">{label}</span>
        <span className="fc-value">{disabled && note ? note : cur.name}</span>
        <span className="fc-n" aria-hidden="true">
          {at + 1}/{n}
        </span>
      </div>
      <div className="fc-track">
        <button type="button" className="fc-step" onClick={() => step(-1)} disabled={disabled} aria-label={`Previous ${label.toLowerCase()}`}>
          ‹
        </button>
        <div
          className={`fc-strip${dx ? ' is-dragging' : ''}`}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled || undefined}
          aria-label={`${label}: ${cur.name}, ${at + 1} of ${n}. Swipe or use the arrow keys to change; press to see all.`}
          aria-haspopup="dialog"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => ((drag.current = null), setDx(0))}
          onKeyDown={onKey}
        >
          {shown.map(({ off, o }) => (
            <span
              key={`${o.id}:${off === -2 || off === 2 ? off : 'c'}`}
              className={`fc-item${off === 0 ? ' on' : ''}`}
              style={{ transform: `translateX(calc(-50% + ${off * SLOT + dx}px)) scale(${off === 0 ? 1 : Math.abs(off) === 1 ? 0.78 : 0.6})`, opacity: off === 0 ? 1 : Math.abs(off) === 1 ? 0.7 : 0.35 }}
              aria-hidden="true"
            >
              {render(o)}
            </span>
          ))}
        </div>
        <button type="button" className="fc-step" onClick={() => step(1)} disabled={disabled} aria-label={`Next ${label.toLowerCase()}`}>
          ›
        </button>
      </div>
    </div>
  )
}

/** Every option at once, as a grid: the carousel's "click to open all options". */
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
