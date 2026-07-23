import type { CSSProperties } from 'react'
import { computeCombat } from '../../game/engine/combat'
import { buildName, levelProgress, MAX_LEVEL } from '../../game/engine/leveling'
import type { Sentinel } from '../../game/types'
import { useGameStore } from '../../state/gameStore'

export function Roster() {
  const roster = useGameStore((s) => s.roster)
  const placements = useGameStore((s) => s.placements)
  const selectedId = useGameStore((s) => s.selectedSentinelId)
  const evolutionQueue = useGameStore((s) => s.evolutionQueue)
  const select = useGameStore((s) => s.selectSentinel)
  const openDetail = useGameStore((s) => s.openDetail)
  const phase = useGameStore((s) => s.battlePhase)

  const slotOf = (sentId: string): string | null => {
    for (const [slotId, id] of Object.entries(placements)) if (id === sentId) return slotId
    return null
  }

  const disabled = phase !== 'setup'

  return (
    <div className="roster">
      <div className="panel-head">
        <span>Sentinels</span>
        <button className="inv-open-btn" onClick={() => useGameStore.getState().openInventory()}>
          🎒 Inventory
        </button>
      </div>
      <div className="roster-list">
        {roster.map((s) => (
          <SentinelCard
            key={s.id}
            sentinel={s}
            slot={slotOf(s.id)}
            selected={selectedId === s.id}
            evolveReady={evolutionQueue.includes(s.id)}
            disabled={disabled}
            onClick={() => select(selectedId === s.id ? null : s.id)}
            onInfo={() => openDetail(s.id)}
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
  evolveReady,
  disabled,
  onClick,
  onInfo,
}: {
  sentinel: Sentinel
  slot: string | null
  selected: boolean
  evolveReady: boolean
  disabled: boolean
  onClick: () => void
  onInfo: () => void
}) {
  const profile = computeCombat(sentinel)
  const progress = levelProgress(sentinel)
  return (
    <div
      className={`sentinel-card ${selected ? 'selected' : ''} ${slot ? 'placed' : ''} ${
        disabled ? 'disabled' : ''
      }`}
      style={{ '--accent': sentinel.color } as CSSProperties}
    >
      <button className="sc-main" onClick={onClick} disabled={disabled}>
        <div className="sc-top">
          <span className="sc-glyph" style={{ background: sentinel.color }}>
            {GLYPH[sentinel.archetype]}
          </span>
          <div className="sc-id">
            <span className="sc-name">
              {sentinel.name}
              {evolveReady && <span className="evolve-dot" title="Evolution ready">★</span>}
            </span>
            <span className="sc-arch">
              {buildName(sentinel)} · Lv {sentinel.level}
            </span>
          </div>
          <span className={`sc-status ${slot ? 'on' : ''}`}>{slot ? 'Deployed' : 'Reserve'}</span>
        </div>
        <div className="sc-stats">
          <Stat label="STR" v={sentinel.stats.str} />
          <Stat label="DEX" v={sentinel.stats.dex} />
          <Stat label="INT" v={sentinel.stats.int} />
          <Stat label="DPS" v={Math.round(profile.dps)} wide />
        </div>
        <div className="xp-bar" title={`Level ${sentinel.level} / ${MAX_LEVEL}`}>
          <div className="xp-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      </button>
      <button className="sc-info" onClick={onInfo} aria-label="Sentinel details">
        ⓘ
      </button>
    </div>
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
