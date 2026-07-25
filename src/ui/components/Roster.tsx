import { useState, type CSSProperties } from 'react'
import { HERO_SLOTS, HERO_SLOT_LABEL, RARITY } from '../../game/data/items'
import { computeCombat } from '../../game/engine/combat'
import { buildName, levelProgress, MAX_LEVEL } from '../../game/engine/leveling'
import type { HeroSlot, Sentinel } from '../../game/types'
import { useGameStore } from '../../state/gameStore'

export function Roster() {
  const roster = useGameStore((s) => s.roster)
  const placements = useGameStore((s) => s.placements)
  const selectedId = useGameStore((s) => s.selectedSentinelId)
  const evolutionQueue = useGameStore((s) => s.evolutionQueue)
  const select = useGameStore((s) => s.selectSentinel)
  const openDetail = useGameStore((s) => s.openDetail)
  const openEquip = useGameStore((s) => s.openEquip)
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
            onSelect={() => select(selectedId === s.id ? null : s.id)}
            onInfo={() => openDetail(s.id)}
            onEditSlot={(hs) => openEquip(s.id, hs)}
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
  onSelect,
  onInfo,
  onEditSlot,
}: {
  sentinel: Sentinel
  slot: string | null
  selected: boolean
  evolveReady: boolean
  disabled: boolean
  onSelect: () => void
  onInfo: () => void
  onEditSlot: (slot: HeroSlot) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const profile = computeCombat(sentinel)
  const progress = levelProgress(sentinel)
  const status = slot ? 'Deployed' : selected ? 'Selected' : 'Reserve'

  return (
    <div
      className={`sentinel-card ${selected ? 'selected' : ''} ${slot ? 'placed' : ''} ${
        expanded ? 'expanded' : ''
      } ${disabled ? 'disabled' : ''}`}
      style={{ '--accent': sentinel.color } as CSSProperties}
    >
      {/* Tapping the card selects the hero — then tap a build slot to place or
          move it (a placed hero can be re-selected and moved to another slot). */}
      <button className="sc-main" onClick={onSelect} disabled={disabled}>
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
          <span className={`sc-status ${slot ? 'on' : ''} ${selected ? 'sel' : ''}`}>{status}</span>
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

      <div className="sc-corner">
        <button
          className={`sc-gear-btn ${expanded ? 'open' : ''}`}
          onClick={() => setExpanded((e) => !e)}
          aria-label="Equipment"
          title="Equipment"
        >
          {expanded ? '▾' : '⚙'}
        </button>
        <button className="sc-info" onClick={onInfo} aria-label="Sentinel details">
          ⓘ
        </button>
      </div>

      {expanded && (
        <div className="sc-gear">
          {HERO_SLOTS.map((hs) => {
            const worn = sentinel.equipment[hs]
            return (
              <button key={hs} className="sc-gear-slot" onClick={() => onEditSlot(hs)}>
                <span className="scg-label">{HERO_SLOT_LABEL[hs]}</span>
                <span
                  className={`scg-item ${worn ? '' : 'empty'}`}
                  style={worn ? { color: RARITY[worn.rarity].color } : undefined}
                >
                  {worn ? worn.name : 'Empty'}
                </span>
              </button>
            )
          })}
          <span className="sc-gear-hint">Tap a slot to equip</span>
        </div>
      )}
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
