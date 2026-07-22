import { MAX_BASE_HP, useGameStore, type Speed } from '../../state/gameStore'

const SPEEDS: Speed[] = [1, 2, 3]

export function TopBar() {
  const battlePhase = useGameStore((s) => s.battlePhase)
  const currentWave = useGameStore((s) => s.currentWave)
  const baseHpStore = useGameStore((s) => s.baseHp)
  const gold = useGameStore((s) => s.gold)
  const hud = useGameStore((s) => s.hud)
  const speed = useGameStore((s) => s.speed)
  const setSpeed = useGameStore((s) => s.setSpeed)

  const inBattle = battlePhase === 'battle'
  const baseHp = inBattle ? hud.baseHp : baseHpStore
  const maxHp = hud.maxBaseHp || MAX_BASE_HP
  const goldDisplay = gold + (inBattle ? hud.goldEarned : 0)
  const hpFrac = Math.max(0, baseHp) / maxHp

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="brand">FIELDWATCH</span>
        <span className="wave-chip">{currentWave?.label ?? 'Encounter'}</span>
      </div>

      <div className="base-hp" title="Base integrity">
        <span className="base-hp-label">⬡ BASE</span>
        <div className="base-hp-bar">
          <div
            className="base-hp-fill"
            style={{
              width: `${hpFrac * 100}%`,
              background: hpFrac > 0.5 ? '#7ac74f' : hpFrac > 0.25 ? '#e6b800' : '#e05a4f',
            }}
          />
        </div>
        <span className="base-hp-val">
          {Math.max(0, Math.ceil(baseHp))}/{maxHp}
        </span>
      </div>

      <div className="topbar-right">
        <span className="gold-chip">⟡ {goldDisplay}</span>
        <div className="speed-toggle" role="group" aria-label="Battle speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={`speed-btn ${speed === s ? 'active' : ''}`}
              onClick={() => setSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
