import type { ReactNode } from 'react'
import { OfferPick } from './OfferPick'
import type { Offer } from './offers'

/**
 * The merchant as a little shop on the road (Oct 2026; the designer: "it needs
 * to be more aesthetic with our UI — like a real little store on the way
 * through the journey").
 *
 *   ▔▔▔▔▔▔ awning ▔▔▔▔▔▔        ← `StopScene` (merchant), in the road's colour, over the
 *        [ MERCHANT ]             page's one title, hung as a wooden sign
 *   ┌ the shelf ────────────┐   ← the wares on a plank, each with its price on
 *   │ [⚔] [▣] [✦] [▣]       │      a paper tag
 *   └───────────────────────┘
 *   [ repair ] [ restock ]       ← the counter: the stall's services
 *   ┌ the focused option ───┐   ← one `PickCard`; the CTA buys it
 *
 * It is the shared offer pick (`OfferPick`) in a stall's dressing
 * (`shop.css`): a tap focuses, the CTA spends. It sells goods only: no hire
 * on the counter (Oct 2026).
 */

/** The stall's services (wagon repair, restock), as opposed to its wares. */
export const isShopService = (o: Offer): boolean => o.id.startsWith('merchant-')

export function ShopShelf({
  wares,
  services,
  selectedId,
  onPick,
  short,
  sold = 0,
  children,
}: {
  wares: readonly Offer[]
  services: readonly Offer[]
  selectedId: string | null
  onPick: (id: string) => void
  short: (o: Offer) => number
  /** Wares bought off this shelf: their cubbies stay, stamped SOLD. */
  sold?: number
  children?: ReactNode
}) {
  return (
    <OfferPick
      className="shop"
      groups={[
        {
          label: "The merchant's wares",
          offers: wares,
          foot: () => '',
          className: 'shop-wares',
          wrap: 'shop-shelf',
          // A bought ware leaves an empty cubby with a stamp, not a gap: the
          // shelf keeps its shape and the sale is seen to have happened.
          trailing: Array.from({ length: sold }, (_, i) => (
            <span key={`sold${i}`} className="pk-tok shop-sold" aria-hidden="true">
              <span className="shop-sold-stamp">Sold</span>
            </span>
          )),
          columns: wares.length + sold,
        },
        // A service says what it gives ("Cargo +25%", "New wares"), not just its
        // verb: "Repair" read as item durability, which the game does not have.
        { label: 'At the counter', offers: services, foot: (o) => o.sub ?? '', className: 'shop-counter' },
      ]}
      selectedId={selectedId}
      onPick={onPick}
      short={short}
      before={wares.length ? undefined : <p className="shop-empty">The shelf is bare.</p>}
    >
      {children}
    </OfferPick>
  )
}
