import type { CSSProperties, ReactNode } from 'react'
import { railStyle, rarityRank, rarityVar } from '../channels'
import { Icon } from '../Icon'
import { Money } from './Money'
import { RarityTag } from './Page'
import { PickCard, PickStrip, stepId, type PickTokenSpec } from './PickStrip'
import type { Offer } from './offers'

/**
 * An offer board as "pick one, then read" (Oct 2026; the designer: the spoils
 * "and upgrade selections are all the same type of interaction yet all feel so
 * different in how they are handled").
 *
 * The level-up skill pick, the hero pick and the city payout were a strip of
 * picture tokens over one card, with the CTA committing; the spoils and the
 * merchant were rows that unfolded their detail inline. Every choose-one
 * board that commits on its CTA is this now: one or more `PickStrip`s (a
 * shop's shelf and counter are two strips sharing one focus), the focused
 * offer's `PickCard` under them, and the page's CTA. The merchant dresses it
 * as a stall (`ShopFront`); the spoils take it plain.
 */

/** One strip of offers and what each token's foot says. */
export interface OfferGroup {
  /** The strip's accessible name: "The merchant's wares", "Elite spoils". */
  label: string
  offers: readonly Offer[]
  /** The token's one word ("To pack", "Repair"); empty for none. */
  foot: (o: Offer) => string
  /** Dressing for the strip (`shop-wares`). */
  className?: string
  /** A wrapper around the strip, for dressing that frames it (`shop-shelf`, the plank). */
  wrap?: string
}

/** An offer's picture on its token: its mark, its rarity pips and its damage type in the corners. */
export const offerArt = (o: Offer): ReactNode => (
  <span className="pk-ware">
    {o.rarity && (
      <span className="pk-ware-pips rar-tag-pips" style={railStyle(rarityVar(o.rarity)) as CSSProperties}>
        {Array.from({ length: rarityRank(o.rarity) }, (_, i) => (
          <i key={i} />
        ))}
      </span>
    )}
    {o.icon && <Icon name={o.icon} lg />}
    {o.mark && (
      <span className="pk-ware-mark">
        <Icon name={o.mark} />
      </span>
    )}
  </span>
)

export function OfferPick({
  groups,
  selectedId,
  onPick,
  short,
  className,
  before,
  children,
}: {
  groups: readonly OfferGroup[]
  selectedId: string | null
  onPick: (id: string) => void
  /** How far off an offer's price is, in the purse: 0 when it is affordable. */
  short: (o: Offer) => number
  className?: string
  /** Anything between the strips and the card (the shop's bare-shelf line). */
  before?: ReactNode
  /** The focused offer's specifics, under its head. */
  children?: ReactNode
}) {
  const all = groups.flatMap((g) => g.offers)
  const at = all.findIndex((o) => o.id === selectedId)
  const selected = at >= 0 ? all[at] : null
  const token = (o: Offer, g: OfferGroup): PickTokenSpec => ({
    id: o.id,
    art: offerArt(o),
    label: g.foot(o),
    value: o.cost ? <Money amount={o.cost.amount} c={o.cost.currency} /> : undefined,
    warn: short(o) > 0,
    state: o.dim ? 'unavailable' : undefined,
    rail: o.color,
    name: [o.title, o.rarity ? undefined : o.sub, o.cost ? `${o.cost.amount} gold` : ''].filter(Boolean).join(', '),
  })
  // Two strips share the focus, so neither may stand one focused by default.
  const several = groups.filter((g) => g.offers.length).length > 1
  return (
    <div className={`pk pk-offers${className ? ` ${className}` : ''}`}>
      {groups.map((g) => {
        if (!g.offers.length) return null
        const strip = (
          <PickStrip
            key={g.label}
            label={g.label}
            tokens={g.offers.map((o) => token(o, g))}
            focused={selectedId}
            onFocus={onPick}
            allowNone={several}
            className={g.className}
          />
        )
        return g.wrap ? (
          <div key={g.label} className={g.wrap}>
            {strip}
          </div>
        ) : (
          strip
        )
      })}
      {before}
      {selected && (
        <PickCard
          className="pk-offer-card"
          art={selected.icon ? <Icon name={selected.icon} lg /> : undefined}
          kicker={
            selected.rarity ? (
              <RarityTag rarity={selected.rarity} suffix={selected.cost ? undefined : selected.sub} />
            ) : (
              selected.sub
            )
          }
          name={selected.title}
          index={at}
          count={all.length}
          onStep={(d) => {
            const next = stepId(all, selected.id, d)
            if (next) onPick(next)
          }}
          noun="option"
          style={selected.color ? { borderLeft: `3px solid ${selected.color}` } : undefined}
        >
          {children}
        </PickCard>
      )}
    </div>
  )
}
