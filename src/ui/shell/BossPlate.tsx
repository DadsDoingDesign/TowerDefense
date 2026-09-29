import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../state/gameStore'
import { useBattleLedger } from '../battleLedger'
import { Icon } from '../Icon'

interface Plate {
  id: string
  name: string
  hp: number
  maxHp: number
  more: number
}

/**
 * The champion's nameplate, pinned to the top of the Stage while one lives
 * (Phase 2, finding 2).
 *
 * A tier-5 champion is the fight's headline, and on the field it was a unit
 * with a purple ring and a 1px bar that a 390px phone draws 12 CSS px wide. The
 * plate names it and gives it a bar the width of the Stage, with a lighter
 * trail for the damage just dealt, so the player can SEE a burst land.
 *
 * It lives in the Stage's reserved top strip — `.sh-stage:has(.sh-bossplate)`
 * pads the canvas wrap by the plate's height, so on a width-bound phone the
 * plate sits in the woodland above the field and covers nothing.
 *
 * The COMBAT agent's boss phases drop into `.sh-bossplate-extra` (phase pips, a
 * phase name) — see docs/FIGMA.md § Live wave layout.
 *
 * Polled at 10 Hz off the engine (which is not reactive), the same cadence the
 * store's `syncHud` uses, so it costs nothing a frame.
 */
export function BossPlate() {
  const champions = useBattleLedger((s) => s.champions)
  const live = useGameStore((s) => s.battlePhase === 'battle' && !!s.engine)
  const [plate, setPlate] = useState<Plate | null>(null)
  const trail = useRef<{ id: string; frac: number; at: number; prev: number }>({ id: '', frac: 1, at: 0, prev: 1 })
  const [trailFrac, setTrailFrac] = useState(1)

  useEffect(() => {
    if (!live || champions.length === 0) {
      setPlate(null)
      return
    }
    const tick = () => {
      const engine = useGameStore.getState().engine
      if (!engine) return setPlate(null)
      const alive = engine.enemies.filter((e) => e.type.isBoss && e.hp > 0)
      if (alive.length === 0) return setPlate(null)
      // The one furthest down the road is the one that matters.
      const lead = alive.reduce((a, b) => (b.distance > a.distance ? b : a))
      const frac = Math.max(0, lead.hp) / lead.maxHp
      const t = trail.current
      const now = performance.now()
      if (t.id !== lead.id) {
        trail.current = { id: lead.id, frac, at: now, prev: frac }
      } else {
        // A fresh hit restarts the hold; after it the trail drains to the bar.
        if (frac < t.prev) t.at = now
        t.prev = frac
        if (frac >= t.frac) t.frac = frac
        else if (now - t.at > 450 || t.frac - frac > 0.3) t.frac = Math.max(frac, t.frac - 0.05)
      }
      setTrailFrac(trail.current.frac)
      setPlate({ id: lead.id, name: lead.type.name, hp: lead.hp, maxHp: lead.maxHp, more: alive.length - 1 })
    }
    tick()
    const iv = window.setInterval(tick, 100)
    return () => window.clearInterval(iv)
  }, [live, champions])

  if (!plate) return null
  const frac = Math.max(0, plate.hp) / plate.maxHp
  return (
    <div className="sh-bossplate" role="group" aria-label={`Champion: ${plate.name}, ${Math.round(frac * 100)}% health`}>
      <div className="sh-bossplate-head">
        <Icon name="boss" className="sh-bossplate-mark" />
        <span className="sh-bossplate-name">{plate.name}</span>
        {plate.more > 0 && <span className="sh-bossplate-more">+{plate.more}</span>}
        <span className="sh-bossplate-extra" />
        <span className="sh-bossplate-hp" aria-hidden="true">
          {Math.ceil(Math.max(0, plate.hp))}
        </span>
      </div>
      <div className="sh-bossplate-bar" aria-hidden="true">
        <span className="sh-bossplate-trail" style={{ width: `${Math.max(frac, trailFrac) * 100}%` }} />
        <span className="sh-bossplate-fill" style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  )
}
