import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../state/gameStore'
import { Icon } from '../Icon'
import '../overlays.css'

/**
 * The way out of a run, from the run map or a fight (Oct 2026). Since the Root
 * Shell there was none: the only exit was a reload and the resume prompt's
 * "abandon". A button at the head of the run's header opens this dialog; it
 * says what leaving costs and leaves on the second, separate button —
 * `returnToHub`, which settles the run as a fall: what the cities paid and
 * the road's share come home, unsold cargo is lost (and a charter's fee).
 */
export function LeaveRun() {
  const [open, setOpen] = useState(false)
  const charter = useGameStore((s) => !!s.contract?.charter)
  const advance = useGameStore((s) => !!s.contract?.advance)
  const returnToHub = useGameStore((s) => s.returnToHub)
  const opener = useRef<HTMLButtonElement>(null)
  const stay = useRef<HTMLButtonElement>(null)
  const openedAt = useRef(0)

  useEffect(() => {
    if (!open) return
    stay.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const close = () => {
    setOpen(false)
    opener.current?.focus()
  }
  const kept = advance ? 'a share of the road’s gold' : 'the rest of your purse'

  return (
    <>
      <button
        ref={opener}
        type="button"
        className="sh-leave"
        aria-label={charter ? 'Leave the charter' : 'Leave the contract'}
        aria-haspopup="dialog"
        data-sfx="back"
        onClick={() => {
          openedAt.current = Date.now()
          setOpen(true)
        }}
      >
        <span className="sh-leave-face" aria-hidden="true">
          <Icon name="back" />
        </span>
      </button>
      {open && (
        <div className="fw-resume" role="dialog" aria-modal="true" aria-labelledby="sh-leave-title" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="fw-resume-card">
            <h2 className="fw-resume-title" id="sh-leave-title">
              {charter ? 'Leave the charter?' : 'Leave the contract?'}
            </h2>
            <p className="fw-resume-body">
              {charter
                ? `The Sovereign Route ends here and its fee is lost. You keep ${kept}; your heroes, the map and the pack are gone.`
                : `The contract ends here, as if the wagons fell. You keep what its cities paid and ${kept}; unsold crates, your heroes, the map and the pack are gone.`}
            </p>
            <div className="fw-resume-actions">
              <button ref={stay} type="button" className="fw-resume-btn primary" data-sfx="confirm" onClick={close}>
                Keep marching
              </button>
              <button
                type="button"
                className="fw-resume-btn danger"
                data-sfx="back"
                onClick={(e) => {
                  // A tap already travelling when the dialog opened is not a decision.
                  if (e.detail > 1 || Date.now() - openedAt.current < 400) return
                  setOpen(false)
                  returnToHub()
                }}
              >
                Leave and bank what it earned
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
