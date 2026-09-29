import { useEffect, useRef, useState } from 'react'
import { peekSavedRun, useGameStore } from '../state/gameStore'
import { describeSnapshot, type RunSnapshot } from '../state/runSnapshot'
import './overlays.css'

/**
 * "Resume run" on boot (C3).
 *
 * Deliberately a boot-time prompt rather than a button somewhere in the shell:
 * the case it exists for is a player who was evicted mid-run and comes back to
 * a fresh page load. Making them hunt for the run they were already in would
 * reproduce the feeling the finding is about.
 *
 * It lives here, in the app root, so the Root Shell's own band layout stays
 * untouched.
 */
export function ResumeRunPrompt() {
  const resumeRun = useGameStore((s) => s.resumeRun)
  const discardSavedRun = useGameStore((s) => s.discardSavedRun)
  const [snap, setSnap] = useState<RunSnapshot | null>(null)
  const [checked, setChecked] = useState(false)
  /*
   * Abandoning ends a run for good, so it arms before it fires (Wave 1) — the
   * shell's rule for anything that cannot be taken back. The first press swaps
   * the button to "Keep the run" and reveals a separate "Yes — abandon it"; a
   * double-tap on one control can never do the destructive thing.
   */
  const [armed, setArmed] = useState(false)
  const armedAt = useRef(0)

  useEffect(() => {
    // Read once, at boot. A snapshot written later in this session belongs to
    // the run already on screen and must never prompt.
    setSnap(peekSavedRun())
    setChecked(true)
  }, [])

  if (!checked || !snap) return null

  const wasMidBattle = snap.screen === 'battle' && !!snap.currentWave

  return (
    <div className="fw-resume" role="dialog" aria-modal="true" aria-labelledby="fw-resume-title">
      <div className="fw-resume-card">
        <h1 className="fw-resume-title" id="fw-resume-title">
          Run in progress
        </h1>
        <p className="fw-resume-body">
          A run was interrupted and saved: <strong>{describeSnapshot(snap)}</strong>.
        </p>
        {wasMidBattle && (
          <p className="fw-resume-body">
            You were mid-wave. It picks back up at the start of{' '}
            <strong>{snap.currentWave?.label ?? 'that wave'}</strong>, with your heroes to post
            again. A half-fought wave is not a save point.
          </p>
        )}
        <div className="fw-resume-actions">
          <button
            type="button"
            className="fw-resume-btn primary"
            data-sfx="confirm"
            onClick={() => {
              resumeRun(snap)
              setSnap(null)
            }}
          >
            Resume run
          </button>
          {armed && (
            <p className="fw-resume-body fw-resume-warn" role="alert">
              The run ends here. You keep the Watch Marks it earned; the company, the map and the pack are gone.
            </p>
          )}
          {armed && (
            <button
              type="button"
              className="fw-resume-btn danger"
              data-sfx="back"
              onClick={(e) => {
                // A tap that was already travelling when this appeared is not a
                // decision (same guard as the shell's armed confirms).
                if (e.detail > 1 || Date.now() - armedAt.current < 400) return
                // Abandoning still pays out the marks the run earned — see
                // `discardSavedRun`.
                discardSavedRun()
                setSnap(null)
              }}
            >
              Yes — abandon it
            </button>
          )}
          <button
            type="button"
            className="fw-resume-btn quiet"
            data-sfx="back"
            onClick={() => {
              armedAt.current = Date.now()
              setArmed((a) => !a)
            }}
          >
            {armed ? 'Keep the run' : 'Abandon and collect marks'}
          </button>
        </div>
      </div>
    </div>
  )
}
