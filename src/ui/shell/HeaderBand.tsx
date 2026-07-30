import { MAX_BASE_HP, useGameStore } from '../../state/gameStore'
import { useMetaStore } from '../../state/metaStore'

/**
 * Band 1 — run state, and nothing else. It never holds a control that changes
 * the subject; it only reports where you stand.
 */
export function HeaderBand({ meta }: { meta: boolean }) {
  const marks = useMetaStore((s) => s.watchMarks)
  const mode = useGameStore((s) => s.mode)
  const gold = useGameStore((s) => s.gold)
  const dust = useGameStore((s) => s.dust)
  const threat = useGameStore((s) => s.threat)
  const lives = useGameStore((s) => s.lives)
  const round = useGameStore((s) => s.round)
  const clearedNodeIds = useGameStore((s) => s.clearedNodeIds)
  const baseHpStore = useGameStore((s) => s.baseHp)
  const battlePhase = useGameStore((s) => s.battlePhase)
  const runPhase = useGameStore((s) => s.runPhase)
  const hud = useGameStore((s) => s.hud)

  if (meta) {
    return (
      <header className="sh-header meta">
        <div className="sh-header-row">
          <span className="sh-brand">FIELDWATCH</span>
          <span className="sh-chip gold">✦ {marks}</span>
        </div>
        <div className="sh-header-row sub">
          <span className="sh-muted">The Watchtower</span>
        </div>
      </header>
    )
  }

  const inBattle = battlePhase === 'battle'
  const baseHp = inBattle ? hud.baseHp : baseHpStore
  const maxHp = hud.maxBaseHp || MAX_BASE_HP
  const hpFrac = Math.max(0, baseHp) / maxHp
  const goldDisplay = gold + (inBattle ? hud.goldEarned : 0)
  const depth = Math.max(0, clearedNodeIds.length - 1)

  const status =
    runPhase !== 'active'
      ? 'RUN OVER'
      : inBattle
        ? `LIVE · ${hud.enemiesTotal - hud.enemiesSpawned + hud.enemiesAlive} LEFT`
        : null

  return (
    <header className="sh-header">
      <div className="sh-header-row">
        <span className="sh-brand">FIELDWATCH</span>
        <span className="sh-chip">{mode === 'endless' ? `Round ${round}` : `Depth ${depth}`}</span>
        {mode === 'campaign' && threat > 1.001 && (
          <span className="sh-chip threat" title="Threat — the world escalates as you grow">
            ⚡ ×{threat.toFixed(2)}
          </span>
        )}
        {mode === 'endless' && <span className="sh-chip threat">♥ {lives}</span>}
        {status && <span className="sh-status">{status}</span>}
      </div>

      <div className="sh-header-row sub">
        <span className="sh-base" title="Base integrity">
          <span className="sh-base-glyph">⬡</span>
          <span className="sh-base-bar">
            <span
              className="sh-base-fill"
              style={{
                width: `${hpFrac * 100}%`,
                background: hpFrac > 0.5 ? 'var(--good)' : hpFrac > 0.25 ? 'var(--warn)' : 'var(--bad)',
              }}
            />
          </span>
          <span className="sh-base-val">
            {Math.max(0, Math.ceil(baseHp))}/{maxHp}
          </span>
        </span>
        <span className="sh-res">
          <span className="sh-chip gold">⟡ {goldDisplay}</span>
          {mode === 'endless' && <span className="sh-chip teal">◈ {dust}</span>}
        </span>
      </div>
    </header>
  )
}
