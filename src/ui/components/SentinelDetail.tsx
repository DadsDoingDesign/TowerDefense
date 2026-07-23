import { describeMods } from '../../game/data/describe'
import { computeCombat, totalStats } from '../../game/engine/combat'
import {
  branchLabel,
  buildName,
  evolutionOptions,
  MAX_LEVEL,
  TIER1_LEVEL,
  TIER2_LEVEL,
} from '../../game/engine/leveling'
import { ARCHETYPES } from '../../game/data/sentinels'
import { HERO_SLOTS, HERO_SLOT_LABEL } from '../../game/data/items'
import type { HeroSlot, Item } from '../../game/types'
import { useGameStore } from '../../state/gameStore'

export function SentinelDetail() {
  const detailId = useGameStore((s) => s.detailId)
  const roster = useGameStore((s) => s.roster)
  const close = useGameStore((s) => s.closeDetail)
  const openEquip = useGameStore((s) => s.openEquip)

  if (!detailId) return null
  const s = roster.find((x) => x.id === detailId)
  if (!s) return null

  const profile = computeCombat(s)
  const stats = totalStats(s)
  const abilities = describeMods(profile.mods)
  const meta = ARCHETYPES[s.archetype]

  const nextTier =
    s.branchPath.length === 1
      ? { level: TIER1_LEVEL, label: 'Sub-archetype' }
      : s.branchPath.length === 2
        ? { level: TIER2_LEVEL, label: 'Specialization' }
        : null
  const preview = nextTier && s.level >= nextTier.level ? evolutionOptions(s) : []

  return (
    <div className="overlay-scrim" onClick={close}>
      <div className="detail-card" onClick={(e) => e.stopPropagation()}>
        <div className="detail-head" style={{ borderColor: s.color }}>
          <span className="detail-glyph" style={{ background: s.color }}>
            {GLYPH[s.archetype]}
          </span>
          <div className="detail-title">
            <h3>{s.name}</h3>
            <span className="detail-sub">
              {buildName(s)} · Lv {s.level}/{MAX_LEVEL}
            </span>
          </div>
          <button className="detail-close" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="detail-branch">
          <span className="dl-label">Path</span>
          <span className="dl-value">{branchLabel(s)}</span>
          <span className="dl-blurb">{meta.blurb}</span>
        </div>

        <div className="detail-stats">
          <DStat label="STR" v={stats.str} />
          <DStat label="DEX" v={stats.dex} />
          <DStat label="INT" v={stats.int} />
          <DStat label="Thorns" v={Math.round(profile.thorns)} />
          <DStat label="Patience" v={s.patience} />
        </div>
        <div className="detail-derived">
          <DDeriv label="DPS" v={Math.round(profile.dps)} />
          <DDeriv label="Range" v={Math.round(profile.range)} />
          <DDeriv label="Max HP" v={profile.maxHp} />
          <DDeriv label="Crit" v={`${Math.round(profile.critChance * 100)}%`} />
        </div>

        <div className="detail-section">
          <span className="ds-head">Abilities</span>
          {abilities.length ? (
            <ul className="ability-list">
              {abilities.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className="ds-empty">Basic attacks only — evolve to specialize.</p>
          )}
        </div>

        <div className="detail-section">
          <span className="ds-head">Equipment</span>
          <div className="equip-slots">
            {HERO_SLOTS.map((slot) => (
              <EquipSlot
                key={slot}
                slot={slot}
                item={s.equipment[slot]}
                onClick={() => openEquip(s.id, slot)}
              />
            ))}
          </div>
        </div>

        <div className="detail-section">
          <span className="ds-head">Evolution</span>
          {s.branchPath.length >= 3 ? (
            <p className="ds-empty">Fully evolved.</p>
          ) : preview.length ? (
            <div className="evo-preview">
              <span className="evo-ready">Ready — choose after the next wave:</span>
              {preview.map((n) => (
                <div key={n.id} className="evo-preview-row">
                  <strong>{n.name}</strong>
                  <span>{n.ability}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="ds-empty">
              Next {nextTier?.label} unlocks at level {nextTier?.level}.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function EquipSlot({
  slot,
  item,
  onClick,
}: {
  slot: HeroSlot
  item: Item | null
  onClick: () => void
}) {
  return (
    <button className={`equip-slot ${item ? `rar-${item.rarity}` : 'empty'}`} onClick={onClick}>
      <span className="es-slot">{HERO_SLOT_LABEL[slot]}</span>
      <span className="es-name">{item ? item.name : 'Empty'}</span>
    </button>
  )
}

function DStat({ label, v }: { label: string; v: number }) {
  return (
    <div className="dstat">
      <span className="dstat-val">{v}</span>
      <span className="dstat-label">{label}</span>
    </div>
  )
}

function DDeriv({ label, v }: { label: string; v: number | string }) {
  return (
    <div className="dderiv">
      <span className="dderiv-label">{label}</span>
      <span className="dderiv-val">{v}</span>
    </div>
  )
}

const GLYPH: Record<string, string> = { fighter: '⚔', rogue: '✦', mystic: '❋' }
