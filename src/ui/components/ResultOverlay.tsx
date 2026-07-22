import type { ReactNode } from 'react'
import { useGameStore } from '../../state/gameStore'

export function ResultOverlay() {
  const phase = useGameStore((s) => s.phase)
  const lastResult = useGameStore((s) => s.lastResult)
  const roster = useGameStore((s) => s.roster)
  const waveIndex = useGameStore((s) => s.waveIndex)
  const totalWaves = useGameStore((s) => s.totalWaves)
  const evolutionQueue = useGameStore((s) => s.evolutionQueue)
  const continueAfterWave = useGameStore((s) => s.continueAfterWave)
  const newRun = useGameStore((s) => s.newRun)

  const nameOf = (id: string) => roster.find((r) => r.id === id)?.name ?? '—'

  if (phase === 'won') {
    return (
      <Overlay tone="win">
        <h2>Field Secured</h2>
        <p>You held the line through all {totalWaves} waves. The Warden falls.</p>
        <button className="overlay-btn" onClick={newRun}>
          New Run
        </button>
      </Overlay>
    )
  }

  if (phase === 'lost') {
    return (
      <Overlay tone="loss">
        <h2>The Line Breaks</h2>
        <p>
          The base fell on wave {waveIndex}. Permadeath — this run is over.
          {lastResult ? ` ${lastResult.leaks} enemies leaked through.` : ''}
        </p>
        <button className="overlay-btn" onClick={newRun}>
          New Run
        </button>
      </Overlay>
    )
  }

  // Between-wave summary during setup — but let evolution choices resolve first.
  if (phase === 'setup' && lastResult && lastResult.status === 'cleared' && evolutionQueue.length === 0) {
    return (
      <Overlay tone="clear">
        <h2>Wave {waveIndex - 1} Cleared</h2>
        <div className="summary-line">
          <span>Gold earned</span>
          <strong>⟡ {lastResult.goldEarned}</strong>
        </div>
        <div className="summary-line">
          <span>Base integrity</span>
          <strong>
            {Math.ceil(lastResult.baseHpLeft)} left {lastResult.leaks > 0 && `(−${lastResult.leaks})`}
          </strong>
        </div>
        <div className="summary-table">
          {lastResult.perSentinel
            .filter((p) => p.kills > 0 || p.damageDealt > 0)
            .sort((a, b) => b.damageDealt - a.damageDealt)
            .map((p) => (
              <div key={p.id} className={`summary-row ${p.downed ? 'downed' : ''}`}>
                <span className="sr-name">
                  {nameOf(p.id)}
                  {p.downed && <span className="sr-down"> ✕</span>}
                </span>
                <span className="sr-kills">{p.kills} kills</span>
                <span className="sr-dmg">{p.damageDealt} dmg</span>
                <span className="sr-xp">+{p.xpGained} xp</span>
              </div>
            ))}
        </div>
        <button className="overlay-btn" onClick={continueAfterWave}>
          Continue
        </button>
      </Overlay>
    )
  }

  return null
}

function Overlay({
  tone,
  children,
}: {
  tone: 'win' | 'loss' | 'clear'
  children: ReactNode
}) {
  return (
    <div className="overlay-scrim">
      <div className={`overlay-card ${tone}`}>{children}</div>
    </div>
  )
}
