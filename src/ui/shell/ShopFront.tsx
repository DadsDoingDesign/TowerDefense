import type { CSSProperties, ReactNode } from 'react'
import { OfferPick } from './OfferPick'
import type { Offer } from './offers'

/**
 * The merchant as a little shop on the road (Oct 2026; the designer: "it needs
 * to be more aesthetic with our UI — like a real little store on the way
 * through the journey").
 *
 *   ▔▔▔▔▔▔ awning ▔▔▔▔▔▔        ← `ShopAwning`, in the road's colour, over the
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

/** The striped canvas over the stall's sign, in the road's colour. */
export const ShopAwning = ({ color }: { color?: string }) => (
  <div className="shop-awning" aria-hidden="true" style={color ? ({ '--aw': color } as CSSProperties) : undefined} />
)

export function ShopShelf({
  wares,
  services,
  selectedId,
  onPick,
  short,
  children,
}: {
  wares: readonly Offer[]
  services: readonly Offer[]
  selectedId: string | null
  onPick: (id: string) => void
  short: (o: Offer) => number
  children?: ReactNode
}) {
  return (
    <OfferPick
      className="shop"
      groups={[
        { label: "The merchant's wares", offers: wares, foot: () => '', className: 'shop-wares', wrap: 'shop-shelf' },
        { label: 'At the counter', offers: services, foot: (o) => (o.id === 'merchant-repair' ? 'Repair' : 'Restock'), className: 'shop-counter' },
      ]}
      selectedId={selectedId}
      onPick={onPick}
      short={short}
      before={wares.length ? undefined : <p className="shop-empty">The shelf is bare. Restock it, or march on.</p>}
    >
      {children}
    </OfferPick>
  )
}
