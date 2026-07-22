import { placedSentinels, useGameStore } from '../../state/gameStore'

export function BattleControls() {
  const phase = useGameStore((s) => s.battlePhase)
  const roster = useGameStore((s) => s.roster)
  const placements = useGameStore((s) => s.placements)
  const startWave = useGameStore((s) => s.startWave)
  const hud = useGameStore((s) => s.hud)

  const deployed = placedSentinels(roster, placements).length

  if (phase === 'battle') {
    const killed = hud.enemiesSpawned - hud.enemiesAlive
    return (
      <div className="battle-controls live">
        <div className="live-stat">
          <span className="ls-label">Enemies</span>
          <span className="ls-val">
            {hud.enemiesAlive} <em>on field</em>
          </span>
        </div>
        <div className="live-progress">
          <div
            className="live-progress-fill"
            style={{ width: `${(killed / Math.max(1, hud.enemiesTotal)) * 100}%` }}
          />
        </div>
        <div className="live-stat right">
          <span className="ls-label">Cleared</span>
          <span className="ls-val">
            {killed}/{hud.enemiesTotal}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="battle-controls">
      <span className="deploy-count">
        {deployed} deployed
        {deployed === 0 && <em className="warn"> — deploy at least one Sentinel</em>}
      </span>
      <button className="start-btn" onClick={startWave} disabled={deployed === 0}>
        Start Wave ▶
      </button>
    </div>
  )
}
