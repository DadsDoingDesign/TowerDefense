import { canUpgrade, reforgeCost, upgradeCost } from '../../game/data/items'
import type { Item, ItemSlot } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import { ItemCard } from './ItemCard'

const SLOT_LABEL: Record<ItemSlot, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  trinket: 'Trinket',
}

/** Choose/swap gear for a Sentinel slot, and run the Forge sinks on any item. */
export function EquipModal() {
  const ctx = useGameStore((s) => s.equipContext)
  const roster = useGameStore((s) => s.roster)
  const inventory = useGameStore((s) => s.inventory)
  const gold = useGameStore((s) => s.gold)
  const close = useGameStore((s) => s.closeEquip)
  const equip = useGameStore((s) => s.equipItem)
  const unequip = useGameStore((s) => s.unequipItem)
  const reforge = useGameStore((s) => s.reforge)
  const upgrade = useGameStore((s) => s.upgradeItem)

  if (!ctx) return null
  const sentinel = roster.find((s) => s.id === ctx.sentinelId)
  if (!sentinel) return null

  const equipped = sentinel.equipment[ctx.slot]
  const options = inventory.filter((i) => i.slot === ctx.slot)

  const forgeButtons = (item: Item) => (
    <div className="forge-actions">
      <button
        className="forge-btn"
        disabled={gold < reforgeCost(item)}
        onClick={() => reforge(item.id)}
      >
        Reforge ⟡{reforgeCost(item)}
      </button>
      {canUpgrade(item) && (
        <button
          className="forge-btn upgrade"
          disabled={gold < upgradeCost(item)}
          onClick={() => upgrade(item.id)}
        >
          Upgrade ⟡{upgradeCost(item)}
        </button>
      )}
    </div>
  )

  return (
    <div className="overlay-scrim" onClick={close}>
      <div className="equip-modal" onClick={(e) => e.stopPropagation()}>
        <div className="equip-head">
          <h3>
            {SLOT_LABEL[ctx.slot]} — {sentinel.name}
          </h3>
          <span className="equip-gold">⟡ {gold}</span>
          <button className="detail-close" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="equip-body">
          <div className="equip-current">
            <span className="ds-head">Equipped</span>
            {equipped ? (
              <ItemCard
                item={equipped}
                footer={
                  <div className="equip-actions">
                    <button className="unequip-btn" onClick={() => unequip(sentinel.id, ctx.slot)}>
                      Unequip
                    </button>
                    {forgeButtons(equipped)}
                  </div>
                }
              />
            ) : (
              <p className="ds-empty">Nothing equipped.</p>
            )}
          </div>

          <div className="equip-list">
            <span className="ds-head">
              Inventory ({options.length} {SLOT_LABEL[ctx.slot].toLowerCase()})
            </span>
            {options.length === 0 && <p className="ds-empty">No items for this slot.</p>}
            {options.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                footer={
                  <div className="equip-actions">
                    <button className="equip-btn" onClick={() => equip(sentinel.id, ctx.slot, item.id)}>
                      Equip
                    </button>
                    {forgeButtons(item)}
                  </div>
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
