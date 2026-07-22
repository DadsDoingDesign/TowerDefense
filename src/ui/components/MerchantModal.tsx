import { ARCHETYPES } from '../../game/data/sentinels'
import { useGameStore } from '../../state/gameStore'
import { ItemCard } from './ItemCard'

export function MerchantModal() {
  const event = useGameStore((s) => s.event)
  const merchant = useGameStore((s) => s.merchant)
  const gold = useGameStore((s) => s.gold)
  const roster = useGameStore((s) => s.roster)
  const buyItem = useGameStore((s) => s.buyMerchantItem)
  const buyRecruit = useGameStore((s) => s.buyMerchantRecruit)
  const leave = useGameStore((s) => s.leaveEvent)

  if (event?.kind !== 'merchant' || !merchant) return null

  return (
    <div className="overlay-scrim">
      <div className="event-modal">
        <div className="event-head">
          <h2>⟡ Merchant</h2>
          <span className="equip-gold">⟡ {gold}</span>
        </div>
        <p className="event-sub">Spend your gold before the next battle.</p>

        <div className="merchant-list">
          {merchant.items.map(({ item, price }) => (
            <ItemCard
              key={item.id}
              item={item}
              footer={
                <button
                  className="buy-btn"
                  disabled={gold < price}
                  onClick={() => buyItem(item.id)}
                >
                  Buy ⟡{price}
                </button>
              }
            />
          ))}
          {merchant.items.length === 0 && <p className="ds-empty">Sold out.</p>}

          {merchant.recruit && (
            <div className="merchant-recruit">
              <div className="mr-info">
                <strong>Recruit: {merchant.recruit.sentinel.name}</strong>
                <span>{ARCHETYPES[merchant.recruit.sentinel.archetype].name}</span>
              </div>
              <button
                className="buy-btn"
                disabled={gold < merchant.recruit.price || roster.length >= 5}
                onClick={buyRecruit}
              >
                Recruit ⟡{merchant.recruit.price}
              </button>
            </div>
          )}
        </div>

        <button className="overlay-btn" onClick={leave}>
          Leave
        </button>
      </div>
    </div>
  )
}
