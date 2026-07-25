import { useState } from 'react'
import { canUpgrade, HERO_SLOTS, HERO_SLOT_LABEL, heroSlotsFor, reforgeCost, upgradeCost } from '../../game/data/items'
import type { HeroSlot, Item, Sentinel } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import { ItemCard } from './ItemCard'

type Tab = HeroSlot | 'all'
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'mainHand', label: 'Main' },
  { id: 'offHand', label: 'Off' },
  { id: 'body', label: 'Body' },
]

/**
 * Right-docked equip drawer — opened from a Sentinel's inline gear slots. It
 * deliberately does NOT dim or cover the battlefield (only a transparent
 * click-catcher closes it), so gear can be managed without blocking the game.
 * Shows the hero's three slots, All/Main/Off/Body filter tabs, and a two-step
 * item flow: tap an item to see its full state, then Equip.
 */
export function EquipModal() {
  const ctx = useGameStore((s) => s.equipContext)
  const roster = useGameStore((s) => s.roster)
  const close = useGameStore((s) => s.closeEquip)

  if (!ctx) return null
  const sentinel = roster.find((s) => s.id === ctx.sentinelId)
  if (!sentinel) return null

  return (
    <>
      <div className="eq-catch" onClick={close} />
      <EquipDrawer key={`${ctx.sentinelId}:${ctx.tab}`} sentinel={sentinel} initialTab={ctx.tab} onClose={close} />
    </>
  )
}

function EquipDrawer({ sentinel, initialTab, onClose }: { sentinel: Sentinel; initialTab: Tab; onClose: () => void }) {
  const inventory = useGameStore((s) => s.inventory)
  const gold = useGameStore((s) => s.gold)
  const equip = useGameStore((s) => s.equipItem)
  const unequip = useGameStore((s) => s.unequipItem)
  const reforge = useGameStore((s) => s.reforge)
  const upgrade = useGameStore((s) => s.upgradeItem)

  const [tab, setTab] = useState<Tab>(initialTab)
  const [sel, setSel] = useState<string | null>(null)

  const list = inventory.filter((i) => (tab === 'all' ? true : heroSlotsFor(i.slot).includes(tab)))

  /** Where an item lands: the active tab's slot if compatible, else its primary slot. */
  const targetSlot = (item: Item): HeroSlot => {
    if (tab !== 'all' && heroSlotsFor(item.slot).includes(tab)) return tab
    return item.slot === 'body' ? 'body' : item.slot === 'offHand' ? 'offHand' : 'mainHand'
  }

  const forgeButtons = (item: Item) => (
    <div className="forge-actions">
      <button className="forge-btn" disabled={gold < reforgeCost(item)} onClick={() => reforge(item.id)}>
        Reforge ⟡{reforgeCost(item)}
      </button>
      {canUpgrade(item) && (
        <button className="forge-btn upgrade" disabled={gold < upgradeCost(item)} onClick={() => upgrade(item.id)}>
          Upgrade ⟡{upgradeCost(item)}
        </button>
      )}
    </div>
  )

  return (
    <div className="equip-drawer">
      <div className="eq-head">
        <div className="eq-title">
          <strong style={{ color: sentinel.color }}>{sentinel.name}</strong>
          <span className="eq-sub">Equipment</span>
        </div>
        <span className="eq-gold">⟡ {gold}</span>
        <button className="detail-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {/* The hero's three slots — tap one to filter to it; ✕ to unequip. */}
      <div className="eq-slots">
        {HERO_SLOTS.map((hs) => {
          const worn = sentinel.equipment[hs]
          return (
            <button
              key={hs}
              className={`eq-slot ${tab === hs ? 'active' : ''} ${worn ? 'filled' : ''}`}
              onClick={() => {
                setTab(hs)
                setSel(null)
              }}
            >
              <span className="eq-slot-label">{HERO_SLOT_LABEL[hs]}</span>
              <span className="eq-slot-item">{worn ? worn.name : 'Empty'}</span>
              {worn && (
                <span
                  className="eq-unequip"
                  title="Unequip"
                  onClick={(e) => {
                    e.stopPropagation()
                    unequip(sentinel.id, hs)
                  }}
                >
                  ✕
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="eq-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`eq-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => {
              setTab(t.id)
              setSel(null)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="eq-list">
        {list.length === 0 && <p className="ds-empty">No items{tab !== 'all' ? ' for this slot' : ''}.</p>}
        {list.map((item) => {
          const active = sel === item.id
          return (
            <div className={`eq-item ${active ? 'active' : ''}`} key={item.id}>
              <div className="eq-item-card" onClick={() => setSel(active ? null : item.id)}>
                <ItemCard item={item} compact={!active} />
              </div>
              {active && (
                <div className="eq-item-actions">
                  <button
                    className="equip-btn"
                    onClick={() => {
                      equip(sentinel.id, targetSlot(item), item.id)
                      setSel(null)
                    }}
                  >
                    Equip → {HERO_SLOT_LABEL[targetSlot(item)]}
                  </button>
                  {forgeButtons(item)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
