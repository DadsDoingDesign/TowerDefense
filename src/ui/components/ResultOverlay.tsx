import type { ReactNode } from 'react'
import { RARITY } from '../../game/data/items'
import { useGameStore } from '../../state/gameStore'

/** Wave-clear summary (over the battle screen). Run win/loss lives in RunEndOverlay. */
export function ResultOverlay() {
  const screen = useGameStore((s) => s.screen)
  const runPhase = useGameStore((s) => s.runPhase)
  const lastResult = useGameStore((s) => s.lastResult)
  const roster = useGameStore((s) => s.roster)
  const currentWave = useGameStore((s) => s.currentWave)
  const evolutionQueue = useGameStore((s) => s.evolutionQueue)
  const lastLoot = useGameStore((s) => s.lastLoot)
  const continueAfterWave = useGameStore((s) => s.continueAfterWave)

  const nameOf = (id: string) => roster.find((r) => r.id === id)?.name ?? '—'

  // Only the wave-clear summary here, and only once evolutions are resolved.
  if (
    runPhase !== 'active' ||
    screen !== 'battle' ||
    !lastResult ||
    lastResult.status !== 'cleared' ||
    evolutionQueue.length > 0
  ) {
    return null
  }

  return (
    <div className="overlay-scrim">
      <div className="overlay-card clear">
        <h2>{currentWave?.isBoss ? 'Boss Defeated' : 'Encounter Cleared'}</h2>
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
        {lastLoot.length > 0 && (
          <div className="summary-line">
            <span>Loot found</span>
            <strong className="loot-names">
              {lastLoot.map((it, i) => (
                <span key={it.id} style={{ color: RARITY[it.rarity].color }}>
                  {it.name}
                  {i < lastLoot.length - 1 ? ', ' : ''}
                </span>
              ))}
            </strong>
          </div>
        )}
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
          Return to Map
        </button>
      </div>
    </div>
  )
}

export function Overlay({
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
