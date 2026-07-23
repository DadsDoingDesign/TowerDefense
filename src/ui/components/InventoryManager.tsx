import { useState, type DragEvent } from 'react'
import { HERO_SLOTS, HERO_SLOT_LABEL, heroSlotsFor } from '../../game/data/items'
import { useGameStore } from '../../state/gameStore'
import type { HeroSlot, Item } from '../../game/types'
import { ItemCard } from './ItemCard'

type DragSource = 'inventory' | { sentinelId: string; slot: HeroSlot }
interface Held {
  item: Item
  from: DragSource
}

/**
 * Full-screen inventory manager. Drag items from the pool onto a hero's slot to
 * equip, drag an equipped item back to the pool to unequip, or drag slot→slot to
 * move. A tap-to-select fallback covers touch. Slot compatibility is enforced by
 * heroSlotsFor(); the store's equipItem already handles two-hand/off-hand rules.
 */
export function InventoryManager() {
  const open = useGameStore((s) => s.inventoryOpen)
  const close = useGameStore((s) => s.closeInventory)
  const roster = useGameStore((s) => s.roster)
  const inventory = useGameStore((s) => s.inventory)
  const equip = useGameStore((s) => s.equipItem)
  const unequip = useGameStore((s) => s.unequipItem)

  const [drag, setDrag] = useState<Held | null>(null)
  const [pick, setPick] = useState<Held | null>(null)

  if (!open) return null

  const active = drag ?? pick
  const compatible = (slot: HeroSlot) => !!active && heroSlotsFor(active.item.slot).includes(slot)

  const apply = (sentinelId: string, slot: HeroSlot, held: Held) => {
    if (!heroSlotsFor(held.item.slot).includes(slot)) return
    if (held.from !== 'inventory') unequip(held.from.sentinelId, held.from.slot)
    equip(sentinelId, slot, held.item.id)
  }

  const onDragStart = (item: Item, from: DragSource) => (e: DragEvent) => {
    setDrag({ item, from })
    setPick(null)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.id)
  }
  const allowDrop = (ok: boolean) => (e: DragEvent) => {
    if (ok) e.preventDefault()
  }
  const dropOnSlot = (sentinelId: string, slot: HeroSlot) => (e: DragEvent) => {
    e.preventDefault()
    if (drag) apply(sentinelId, slot, drag)
    setDrag(null)
    setPick(null)
  }
  const dropOnPool = (e: DragEvent) => {
    e.preventDefault()
    if (drag && drag.from !== 'inventory') unequip(drag.from.sentinelId, drag.from.slot)
    setDrag(null)
    setPick(null)
  }

  // Tap fallback: tap an equipped item to unequip; tap a pool item to select,
  // then tap a compatible slot to place.
  const tapItem = (item: Item, from: DragSource) => () => {
    if (from !== 'inventory') {
      unequip(from.sentinelId, from.slot)
      setPick(null)
      return
    }
    setPick(pick?.item.id === item.id ? null : { item, from })
  }
  const tapSlot = (sentinelId: string, slot: HeroSlot) => () => {
    if (pick && compatible(slot)) apply(sentinelId, slot, pick)
    setPick(null)
  }

  return (
    <div className="inv-scrim" onClick={close}>
      <div className="inv-manager" onClick={(e) => e.stopPropagation()}>
        <div className="inv-head">
          <div className="inv-title">
            <strong>Warband Inventory</strong>
            <span className="inv-sub">Drag items onto a hero&apos;s slot to equip — or tap to select, then tap a slot.</span>
          </div>
          <button className="detail-close" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="inv-body">
          <div className="inv-heroes">
            {roster.map((hero) => (
              <div className="inv-hero" key={hero.id}>
                <div className="inv-hero-id">
                  <span className="inv-hero-glyph" style={{ background: hero.color }}>
                    {hero.name[0]}
                  </span>
                  <div className="inv-hero-text">
                    <strong>{hero.name}</strong>
                    <span>Lv {hero.level}</span>
                  </div>
                </div>
                <div className="inv-slots">
                  {HERO_SLOTS.map((slot) => {
                    const worn = hero.equipment[slot]
                    const ok = compatible(slot)
                    return (
                      <div
                        key={slot}
                        className={`inv-slot ${ok ? 'droppable' : ''} ${active && !ok ? 'dim' : ''}`}
                        onDragOver={allowDrop(ok)}
                        onDrop={dropOnSlot(hero.id, slot)}
                        onClick={tapSlot(hero.id, slot)}
                      >
                        <span className="inv-slot-label">{HERO_SLOT_LABEL[slot]}</span>
                        {worn ? (
                          <div
                            draggable
                            onDragStart={onDragStart(worn, { sentinelId: hero.id, slot })}
                            onDragEnd={() => setDrag(null)}
                            onClick={(e) => {
                              e.stopPropagation()
                              tapItem(worn, { sentinelId: hero.id, slot })()
                            }}
                          >
                            <ItemCard item={worn} compact />
                          </div>
                        ) : (
                          <span className="inv-slot-empty">Empty</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="inv-pool" onDragOver={allowDrop(!!drag)} onDrop={dropOnPool}>
            <div className="inv-pool-head">Inventory ({inventory.length})</div>
            {inventory.length === 0 && <div className="inv-empty">No unequipped items.</div>}
            <div className="inv-pool-grid">
              {inventory.map((item) => (
                <div
                  key={item.id}
                  className={`inv-item ${pick?.item.id === item.id ? 'picked' : ''}`}
                  draggable
                  onDragStart={onDragStart(item, 'inventory')}
                  onDragEnd={() => setDrag(null)}
                  onClick={tapItem(item, 'inventory')}
                >
                  <ItemCard item={item} compact />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
