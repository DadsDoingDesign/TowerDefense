import type { CSSProperties } from 'react'
import { computeEffectiveAttack } from '../../game/engine/effective'
import { ARCHETYPES } from '../../game/data/sentinels'
import type { Sentinel } from '../../game/types'
import { useGameStore } from '../../state/gameStore'

export function Roster() {
  const roster = useGameStore((s) => s.roster)
  const placements = useGameStore((s) => s.placements)
  const selectedId = useGameStore((s) => s.selectedSentinelId)
  const select = useGameStore((s) => s.selectSentinel)
  const phase = useGameStore((s) => s.phase)

  const slotOf = (sentId: string): string | null => {
    for (const [slotId, id] of Object.entries(placements)) if (id === sentId) return slotId
    return null
  }

  const disabled = phase !== 'setup'

  return (
    <div className="roster">
      <div className="panel-head">
        <span>Sentinels</span>
        <span className="hint">{disabled ? 'Battle in progress' : 'Tap a unit, then a slot'}</span>
      </div>
      <div className="roster-list">
        {roster.map((s) => (
          <SentinelCard
            key={s.id}
            sentinel={s}
            slot={slotOf(s.id)}
            selected={selectedId === s.id}
            disabled={disabled}
            onClick={() => select(selectedId === s.id ? null : s.id)}
          />
        ))}
      </div>
    </div>
  )
}

function SentinelCard({
  sentinel,
  slot,
  selected,
  disabled,
  onClick,
}: {
  sentinel: Sentinel
  slot: string | null
  selected: boolean
  disabled: boolean
  onClick: () => void
}) {
  const eff = computeEffectiveAttack(sentinel)
  const meta = ARCHETYPES[sentinel.archetype]
  return (
    <button
      className={`sentinel-card ${selected ? 'selected' : ''} ${slot ? 'placed' : ''}`}
      style={{ '--accent': sentinel.color } as CSSProperties}
      onClick={onClick}
      disabled={disabled}
    >
      <div className="sc-top">
        <span className="sc-glyph" style={{ background: sentinel.color }}>
          {GLYPH[sentinel.archetype]}
        </span>
        <div className="sc-id">
          <span className="sc-name">{sentinel.name}</span>
          <span className="sc-arch">
            {meta.name} · Lv {sentinel.level}
          </span>
        </div>
        <span className={`sc-status ${slot ? 'on' : ''}`}>{slot ? 'Deployed' : 'Reserve'}</span>
      </div>
      <div className="sc-stats">
        <Stat label="STR" v={sentinel.stats.str} />
        <Stat label="DEX" v={sentinel.stats.dex} />
        <Stat label="INT" v={sentinel.stats.int} />
        <Stat label="DPS" v={Math.round(eff.dps)} wide />
      </div>
    </button>
  )
}

function Stat({ label, v, wide }: { label: string; v: number; wide?: boolean }) {
  return (
    <div className={`stat ${wide ? 'wide' : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-val">{v}</span>
    </div>
  )
}

const GLYPH: Record<string, string> = { fighter: '⚔', rogue: '✦', mystic: '❋' }
