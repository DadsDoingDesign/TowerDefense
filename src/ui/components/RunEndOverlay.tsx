import { useGameStore } from '../../state/gameStore'

/** Run-level win/loss. Permadeath: a loss ends the run and returns to the hub. */
export function RunEndOverlay() {
  const runPhase = useGameStore((s) => s.runPhase)
  const screen = useGameStore((s) => s.screen)
  const clearedNodeIds = useGameStore((s) => s.clearedNodeIds)
  const marksEarned = useGameStore((s) => s.marksEarned)
  const returnToHub = useGameStore((s) => s.returnToHub)

  // Only show while still inside the run (not after returning to the hub).
  if (runPhase === 'active' || screen === 'hub') return null

  const depth = clearedNodeIds.length - 1

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
        <div className="marks-earned">
          <span>Watch Marks earned</span>
          <strong>✦ {marksEarned}</strong>
        </div>
        <button className="overlay-btn" onClick={returnToHub}>
          Return to Watchtower
        </button>
      </div>
    </div>
  )
}
