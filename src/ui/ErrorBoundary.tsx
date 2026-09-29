import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { flushRunSnapshot, peekSavedRun, useGameStore } from '../state/gameStore'
import { clearSnapshot, describeSnapshot, type RunSnapshot } from '../state/runSnapshot'
import { clearFatal, currentFatal, subscribeFatal } from './fatal'
import './overlays.css'

/**
 * Crash recovery (H21).
 *
 * Before this there was no error handling anywhere in the tree — one throw gave
 * a white screen, and (with C3 unfixed) also ate the run. Now a crash lands
 * here with the run snapshot intact, so the honest offer is "go back to the
 * last checkpoint", not "start over".
 */

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
  snapshot: RunSnapshot | null
}

/**
 * Re-throws an out-of-tree fault (a rAF crash) during render so the boundary
 * above catches it. One recovery UI for both kinds of failure.
 */
function FatalRelay(): null {
  const [, force] = useState(0)
  useEffect(() => subscribeFatal(() => force((n) => n + 1)), [])
  const err = currentFatal()
  if (err) throw err
  return null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, snapshot: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Fieldwatch crashed:', error, info.componentStack)
    // The run is the expensive thing in the room. Get it to disk before doing
    // anything else, and only then look for a checkpoint to offer.
    let snapshot: RunSnapshot | null = null
    try {
      flushRunSnapshot()
      snapshot = peekSavedRun()
    } catch {
      /* if even the snapshot path is broken, still show the recovery screen */
    }
    this.setState({ snapshot })
  }

  private reset = (): void => {
    clearFatal()
    this.setState({ error: null, snapshot: null })
  }

  /** Put the last checkpoint back in play, in this same page load. */
  private resume = (): void => {
    const snap = this.state.snapshot
    this.reset()
    if (snap) {
      try {
        useGameStore.getState().resumeRun(snap)
        return
      } catch {
        /* fall through to a reload, which re-offers the same snapshot */
      }
    }
    window.location.reload()
  }

  private abandon = (): void => {
    clearFatal()
    // Settle the run rather than just deleting it — the crash is not the
    // player's fault, so it must not cost them the marks they earned (C3).
    try {
      useGameStore.getState().discardSavedRun()
    } catch {
      clearSnapshot()
    }
    window.location.reload()
  }

  render(): ReactNode {
    const { error, snapshot } = this.state
    if (!error) {
      return (
        <>
          <FatalRelay />
          {this.props.children}
        </>
      )
    }

    return (
      <div className="fw-crash" role="alert">
        <div className="fw-crash-card">
          <h1 className="fw-crash-title">The watch broke</h1>
          <p className="fw-crash-body">
            Something went wrong and the game stopped. This is a bug, not something you did.
          </p>
          {snapshot ? (
            <p className="fw-crash-body">
              Your run was saved: <strong>{describeSnapshot(snapshot)}</strong>. You can pick it back
              up from the last checkpoint.
            </p>
          ) : (
            <p className="fw-crash-body">There was no run in progress to save.</p>
          )}
          <div className="fw-crash-actions">
            {snapshot && (
              <button type="button" className="fw-crash-btn primary" onClick={this.resume}>
                Return to last checkpoint
              </button>
            )}
            <button type="button" className="fw-crash-btn" onClick={() => window.location.reload()}>
              Reload
            </button>
            {snapshot && (
              <button type="button" className="fw-crash-btn quiet" onClick={this.abandon}>
                Abandon run
              </button>
            )}
          </div>
          <pre className="fw-crash-detail">{error.message}</pre>
        </div>
      </div>
    )
  }
}
