import { useGameStore } from '../../state/gameStore'

/** Run-level win/loss. Permadeath: a loss ends the run. */
export function RunEndOverlay() {
  const runPhase = useGameStore((s) => s.runPhase)
  const clearedNodeIds = useGameStore((s) => s.clearedNodeIds)
  const newRun = useGameStore((s) => s.newRun)

  if (runPhase === 'active') return null

  const depth = clearedNodeIds.length - 1 // minus the start node

  return (
    <div className="overlay-scrim">
      <div className={`overlay-card ${runPhase === 'won' ? 'win' : 'loss'}`}>
        {runPhase === 'won' ? (
          <>
            <h2>The Watch Holds</h2>
            <p>You reached the end of the line and struck down the Colossus. The field is secured.</p>
          </>
        ) : (
          <>
            <h2>The Line Breaks</h2>
            <p>
              Your base has fallen after clearing {depth} node{depth === 1 ? '' : 's'}. Permadeath —
              this run is over.
            </p>
          </>
        )}
        <button className="overlay-btn" onClick={newRun}>
          New Run
        </button>
      </div>
    </div>
  )
}
