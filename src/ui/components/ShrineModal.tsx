import { useGameStore } from '../../state/gameStore'

export function ShrineModal() {
  const event = useGameStore((s) => s.event)
  const offer = useGameStore((s) => s.shrineOffer)
  const accept = useGameStore((s) => s.acceptShrine)
  const decline = useGameStore((s) => s.declineShrine)

  if (event?.kind !== 'shrine' || !offer) return null

  return (
    <div className="overlay-scrim">
      <div className="event-modal shrine">
        <div className="event-head">
          <h2>❖ {offer.title}</h2>
        </div>
        <p className="event-sub">A bargain — take the boon and its price, or walk away.</p>

        <div className="shrine-offer">
          <div className="shrine-line boon">
            <span className="sl-tag">Boon</span>
            <span>{offer.boon}</span>
          </div>
          <div className="shrine-line curse">
            <span className="sl-tag">Price</span>
            <span>{offer.curse}</span>
          </div>
        </div>

        <div className="shrine-actions">
          <button className="overlay-btn ghost" onClick={decline}>
            Walk Away
          </button>
          <button className="overlay-btn" onClick={accept}>
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
