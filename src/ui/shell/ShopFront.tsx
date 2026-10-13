import type { CSSProperties, ReactNode } from 'react'
import { railStyle, rarityRank, rarityVar } from '../channels'
import { Icon } from '../Icon'
import { Money } from './Money'
import { RarityTag } from './Page'
import { PickCard, PickStrip, stepId, type PickTokenSpec } from './PickStrip'
import type { Offer } from './offers'

/**
 * The merchant as a little shop on the road (Oct 2026; the designer: "it needs
 * to be more aesthetic with our UI — like a real little store on the way
 * through the journey").
 *
 * It was a list of rows like every other board. Now it is a stall:
 *
 *   ▔▔▔▔▔▔ awning ▔▔▔▔▔▔        ← `ShopAwning`, in the road's colour, over the
 *        [ MERCHANT ]             page's one title, hung as a wooden sign
 *   ┌ the shelf ────────────┐   ← the wares: a `PickStrip` of goods on a plank,
 *   │ [⚔] [▣] [✦] [▣]       │      each with its price on a paper tag
 *   └───────────────────────┘
 *   [ repair ] [ restock ]       ← the counter: the stall's services
 *   ┌ the focused option ───┐   ← one `PickCard`, the same recipe as every
 *   └───────────────────────┘      pick-one surface; the CTA buys it
 *
 * A tap on a good FOCUSES it and the pinned CTA buys it — the shop spends
 * gold, so it keeps "pick, then commit". It sells goods only: no hire on the
 * counter (Oct 2026).
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
  /** How far off a price is, in the purse: 0 when it is affordable. */
  short: (o: Offer) => number
  /** The focused option's specifics, under its head. */
  children?: ReactNode
}) {
  const all = [...wares, ...services]
  const at = all.findIndex((o) => o.id === selectedId)
  const selected = at >= 0 ? all[at] : null
  const token = (o: Offer, label: string): PickTokenSpec => ({
    id: o.id,
    art: (
      <span className="shop-ware">
        {o.rarity && (
          <span className="shop-ware-pips rar-tag-pips" style={railStyle(rarityVar(o.rarity)) as CSSProperties}>
            {Array.from({ length: rarityRank(o.rarity) }, (_, i) => (
              <i key={i} />
            ))}
          </span>
        )}
        {o.icon && <Icon name={o.icon} lg />}
        {o.mark && (
          <span className="shop-ware-mark">
            <Icon name={o.mark} />
          </span>
        )}
      </span>
    ),
    label,
    value: o.cost ? <Money amount={o.cost.amount} c={o.cost.currency} /> : undefined,
    warn: short(o) > 0,
    state: o.dim ? 'unavailable' : undefined,
    rail: o.color,
    name: [o.title, o.sub, o.cost ? `${o.cost.amount} gold` : ''].filter(Boolean).join(', '),
  })
  return (
    <div className="shop">
      {wares.length > 0 ? (
        <div className="shop-shelf">
          <PickStrip label="The merchant's wares" tokens={wares.map((o) => token(o, o.sub ?? ''))} focused={selectedId} onFocus={onPick} allowNone className="shop-wares" />
        </div>
      ) : (
        <p className="shop-empty">The shelf is bare. Restock it, or march on.</p>
      )}
      {services.length > 0 && (
        <PickStrip
          label="At the counter"
          tokens={services.map((o) => token(o, o.id === 'merchant-repair' ? 'Repair' : 'Restock'))}
          focused={selectedId}
          onFocus={onPick}
          allowNone
          className="shop-counter"
        />
      )}
      {selected && (
        <PickCard
          className="shop-card"
          art={selected.icon ? <Icon name={selected.icon} lg /> : undefined}
          kicker={selected.rarity ? <RarityTag rarity={selected.rarity} /> : selected.sub}
          name={selected.title}
          index={at}
          count={all.length}
          onStep={(d) => {
            const next = stepId(all, selected.id, d)
            if (next) onPick(next)
          }}
          noun="item"
        >
          {children}
        </PickCard>
      )}
    </div>
  )
}
