import { useState, type DragEvent } from 'react'
import { HERO_SLOTS, HERO_SLOT_LABEL, RARITY, heroSlotsFor } from '../../game/data/items'
import type { HeroSlot, Item } from '../../game/types'
import { scrapDust, scrapGold, useGameStore } from '../../state/gameStore'
import { ItemCard } from './ItemCard'

type DragSource = 'inventory' | { sentinelId: string; slot: HeroSlot }
interface Held {
  item: Item
  from: DragSource
}

const KIND_ABBR: Record<string, string> = { oneHand: '1H', twoHand: '2H', offHand: 'OFF', body: 'BODY' }
const tileTag = (item: Item) => (item.keepsake ? 'KEEP' : KIND_ABBR[item.slot] ?? '?')

/**
 * Grid-based inventory manager. Left: a hero selector + that hero's three
 * equipment slots (drop targets). Right: a tile grid of all owned items with a
 * selected-item detail and Equip / Dismantle actions. Drag a tile onto a slot
 * to equip, drag an equipped item to the grid to unequip, or tap-to-select.
 */
export function InventoryManager() {
  const open = useGameStore((s) => s.inventoryOpen)
  const close = useGameStore((s) => s.closeInventory)
  const roster = useGameStore((s) => s.roster)
  const inventory = useGameStore((s) => s.inventory)
  const gold = useGameStore((s) => s.gold)
  const dust = useGameStore((s) => s.dust)
  const mode = useGameStore((s) => s.mode)
  const equip = useGameStore((s) => s.equipItem)
  const unequip = useGameStore((s) => s.unequipItem)
  const sortInv = useGameStore((s) => s.sortInventory)
  const dismantle = useGameStore((s) => s.dismantleItem)

  const [heroId, setHeroId] = useState<string | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  const [drag, setDrag] = useState<Held | null>(null)

  if (!open) return null
  const hero = roster.find((h) => h.id === heroId) ?? roster[0]
  const selItem = inventory.find((i) => i.id === pick) ?? null
  const compatible = (slot: HeroSlot) => !!drag && heroSlotsFor(drag.item.slot).includes(slot)

  const targetSlot = (item: Item): HeroSlot =>
    item.slot === 'body' ? 'body' : item.slot === 'offHand' ? 'offHand' : 'mainHand'

  const applyToSlot = (slot: HeroSlot, held: Held) => {
    if (!hero || !heroSlotsFor(held.item.slot).includes(slot)) return
    if (held.from !== 'inventory') unequip(held.from.sentinelId, held.from.slot)
    equip(hero.id, slot, held.item.id)
    setPick(null)
  }

  const onDragStart = (item: Item, from: DragSource) => (e: DragEvent) => {
    setDrag({ item, from })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.id)
  }
  const dropOnSlot = (slot: HeroSlot) => (e: DragEvent) => {
    e.preventDefault()
    if (drag) applyToSlot(slot, drag)
    setDrag(null)
  }
  const dropOnGrid = (e: DragEvent) => {
    e.preventDefault()
    if (drag && drag.from !== 'inventory') unequip(drag.from.sentinelId, drag.from.slot)
    setDrag(null)
  }

  return (
    <div className="inv-scrim" onClick={close}>
      <div className="inv2" onClick={(e) => e.stopPropagation()}>
        <div className="inv2-head">
          <strong>Inventory</strong>
          <div className="inv2-res">
            <span className="gold-chip">⟡ {gold}</span>
            {mode === 'endless' && <span className="dust-chip">◈ {dust}</span>}
          </div>
          <button className="detail-close" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="inv2-body">
          {/* ---- hero + equipped ---- */}
          <div className="inv2-left">
            <div className="inv2-heroes">
              {roster.map((h) => (
                <button
                  key={h.id}
                  className={`inv2-hero ${hero?.id === h.id ? 'active' : ''}`}
                  style={{ borderColor: h.color }}
                  onClick={() => {
                    setHeroId(h.id)
                    setPick(null)
                  }}
                >
                  <span className="inv2-hero-glyph" style={{ background: h.color }}>
                    {h.name[0]}
                  </span>
                  <span className="inv2-hero-name">{h.name}</span>
                </button>
              ))}
            </div>
            {hero && (
              <div className="inv2-slots">
                {HERO_SLOTS.map((slot) => {
                  const worn = hero.equipment[slot]
                  const ok = compatible(slot)
                  return (
                    <div
                      key={slot}
                      className={`inv2-slot ${ok ? 'droppable' : ''} ${drag && !ok ? 'dim' : ''}`}
                      onDragOver={(e) => ok && e.preventDefault()}
                      onDrop={dropOnSlot(slot)}
                      onClick={() => {
                        if (selItem && heroSlotsFor(selItem.slot).includes(slot)) applyToSlot(slot, { item: selItem, from: 'inventory' })
                      }}
                    >
                      <span className="inv2-slot-label">{HERO_SLOT_LABEL[slot]}</span>
                      {worn ? (
                        <button
                          className={`inv-tile rar-${worn.rarity} filled`}
                          draggable
                          onDragStart={onDragStart(worn, { sentinelId: hero.id, slot })}
                          onDragEnd={() => setDrag(null)}
                          onClick={(e) => {
                            e.stopPropagation()
                            unequip(hero.id, slot)
                          }}
                          title={`${worn.name} — tap to unequip`}
                        >
                          <span className="inv-tile-tag">{tileTag(worn)}</span>
                        </button>
                      ) : (
                        <span className="inv2-slot-empty">Empty</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ---- item grid ---- */}
          <div className="inv2-right">
            <div className="inv2-grid" onDragOver={(e) => drag && e.preventDefault()} onDrop={dropOnGrid}>
              {inventory.length === 0 && <div className="inv-empty">No unequipped items.</div>}
              {inventory.map((item) => (
                <button
                  key={item.id}
                  className={`inv-tile rar-${item.rarity} ${pick === item.id ? 'picked' : ''}`}
                  draggable
                  onDragStart={onDragStart(item, 'inventory')}
                  onDragEnd={() => setDrag(null)}
                  onClick={() => setPick(pick === item.id ? null : item.id)}
                  title={item.name}
                >
                  <span className="inv-tile-tag">{tileTag(item)}</span>
                  {item.enchantments.some((e) => e.id.startsWith('cx_')) && <span className="inv-tile-curse">◆</span>}
                </button>
              ))}
            </div>

            {selItem && (
              <div className="inv2-detail">
                <ItemCard item={selItem} />
                <div className="inv2-actions">
                  {hero && (
                    <button className="equip-btn" data-sfx="none" onClick={() => applyToSlot(targetSlot(selItem), { item: selItem, from: 'inventory' })}>
                      Equip → {HERO_SLOT_LABEL[targetSlot(selItem)]}
                    </button>
                  )}
                  <button
                    className="dismantle-btn"
                    data-sfx="none"
                    onClick={() => {
                      dismantle(selItem.id)
                      setPick(null)
                    }}
                  >
                    Dismantle +⟡{scrapGold(selItem)}
                    {mode === 'endless' ? ` ◈${scrapDust(selItem)}` : ''}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="inv2-foot">
          <span className="inv2-hint">Drag a tile onto a slot to equip · tap to inspect</span>
          <div className="inv2-foot-btns">
            <button className="inv2-sort" data-sfx="toggle" onClick={sortInv}>
              Sort
            </button>
            <button className="inv2-close" onClick={close}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
