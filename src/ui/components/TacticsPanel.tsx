import { useGameStore } from '../../state/gameStore'
import { FOCUS_OPTS, focusFull } from '../channels'

/**
 * The legacy `?shell=0` targeting panel.
 *
 * Its four options used to be a private table carrying its own `hint` strings,
 * and two of the four described a rule the engine does not implement: "Closest
 * to the base" for `first` (which is first *in the lane*), and "Closest to the
 * tower" for `nearest` (nearest to the Sentinel — not the same thing once a
 * tower is posted mid-lane). It reads the shared table in `src/ui/channels.ts`
 * now, so this panel and the shell cannot describe one engine-level rule two
 * different ways (L3). The shell's wording is the one that ships.
 */
export function TacticsPanel() {
  const tactics = useGameStore((s) => s.tactics)
  const setTactics = useGameStore((s) => s.setTactics)

  return (
    <div className="tactics-panel">
      <div className="panel-head">
        <span>Tactics</span>
        <span className="hint">{focusFull(tactics.focus)}</span>
      </div>
      <div className="tactics-seg">
        {FOCUS_OPTS.map((f) => (
          <button
            key={f.id}
            className={`tac-btn ${tactics.focus === f.id ? 'active' : ''}`}
            aria-pressed={tactics.focus === f.id}
            aria-label={`${f.full} — for the whole watch`}
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
