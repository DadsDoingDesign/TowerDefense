import type { FocusMode } from '../../game/types'
import { useGameStore } from '../../state/gameStore'

const FOCUS_OPTS: { id: FocusMode; label: string; hint: string }[] = [
  { id: 'first', label: 'First', hint: 'Closest to the base' },
  { id: 'lowestHp', label: 'Low HP', hint: 'Focus-fire the weakest' },
  { id: 'strongest', label: 'Strong', hint: 'Prioritize tanky enemies' },
  { id: 'nearest', label: 'Near', hint: 'Closest to the tower' },
]

export function TacticsPanel() {
  const tactics = useGameStore((s) => s.tactics)
  const setTactics = useGameStore((s) => s.setTactics)

  return (
    <div className="tactics-panel">
      <div className="panel-head">
        <span>Tactics</span>
        <span className="hint">{FOCUS_OPTS.find((f) => f.id === tactics.focus)?.hint}</span>
      </div>
      <div className="tactics-seg">
        {FOCUS_OPTS.map((f) => (
          <button
            key={f.id}
            className={`tac-btn ${tactics.focus === f.id ? 'active' : ''}`}
            onClick={() => setTactics({ focus: f.id })}
          >
            {f.label}
          </button>
        ))}
      </div>
      <button
        className={`hold-fire ${tactics.holdFire ? 'on' : ''}`}
        onClick={() => setTactics({ holdFire: !tactics.holdFire })}
      >
        <span className="hf-check">{tactics.holdFire ? '☑' : '☐'}</span>
        Hold fire until enemies pass the midpoint
      </button>
    </div>
  )
}
