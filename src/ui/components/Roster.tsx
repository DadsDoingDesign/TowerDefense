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
  const clearSlot = useGameStore((s) => s.clearSlot)
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
        {roster.map((s) => {
          const slot = slotOf(s.id)
          return (
            <SentinelCard
              key={s.id}
              sentinel={s}
              slot={slot}
              selected={selectedId === s.id}
              evolveReady={evolutionQueue.includes(s.id)}
              disabled={disabled}
              onDeploy={() => (slot ? clearSlot(slot) : select(selectedId === s.id ? null : s.id))}
              onInfo={() => openDetail(s.id)}
              onEditSlot={(hs) => openEquip(s.id, hs)}
            />
          )
        })}
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
  onDeploy,
  onInfo,
  onEditSlot,
}: {
  sentinel: Sentinel
  slot: string | null
  selected: boolean
  evolveReady: boolean
  disabled: boolean
  onDeploy: () => void
  onInfo: () => void
  onEditSlot: (slot: HeroSlot) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const profile = computeCombat(sentinel)
  const progress = levelProgress(sentinel)
  const deployLabel = slot ? 'Deployed' : selected ? 'Selected' : 'Reserve'

  return (
    <div
      className={`sentinel-card ${selected ? 'selected' : ''} ${slot ? 'placed' : ''} ${
        expanded ? 'expanded' : ''
      } ${disabled ? 'disabled' : ''}`}
      style={{ '--accent': sentinel.color } as CSSProperties}
    >
      <div className="sc-main" role="button" tabIndex={0} onClick={() => setExpanded((e) => !e)}>
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
          <button
            className={`sc-deploy ${slot ? 'on' : ''} ${selected ? 'sel' : ''}`}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation()
              onDeploy()
            }}
            title={slot ? 'Recall from slot' : 'Select, then tap a build slot'}
          >
            {deployLabel}
          </button>
          <button
            className="sc-info"
            onClick={(e) => {
              e.stopPropagation()
              onInfo()
            }}
            aria-label="Sentinel details"
          >
            ⓘ
          </button>
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
        <span className="sc-chevron">{expanded ? '▾ gear' : '▸ gear'}</span>
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
