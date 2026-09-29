import { useEffect, useState } from 'react'
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
            <strong>{snap.currentWave?.label ?? 'that wave'}</strong>, with your towers to place
            again — a half-fought wave is not a save point.
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
          <button
            type="button"
            className="fw-resume-btn quiet"
            data-sfx="back"
            onClick={() => {
              // Abandoning still pays out the marks the run earned — see
              // `discardSavedRun`.
              discardSavedRun()
              setSnap(null)
            }}
          >
            Abandon and collect marks
          </button>
        </div>
      </div>
    </div>
  )
}
