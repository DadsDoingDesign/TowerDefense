import { CURRENCY_ICON, moneyText, type Currency } from '../channels'
import { Icon } from '../Icon'

/**
 * An amount of one currency: its atlas mark and the number, and nothing else.
 *
 * One mark per currency (Wave 1). The shell used to print `⟡ 240` beside a
 * pixel coin — a system-font glyph and a sprite for the same thing, and `⟡` was
 * also the run map's Merchant. The mark is the picture; the words are in the
 * accessible name, which is why this is `role="img"` rather than a loose span:
 * inside a button it folds into the button's name ("Buy, 60 gold") where an
 * `aria-hidden` icon alone would leave a bare "60".
 */
export function Money({
  amount,
  c,
  className,
  note,
}: {
  amount: number
  c: Currency
  className?: string
  /** Appended to the accessible name — "not enough yet" on a row you cannot afford. */
  note?: string
}) {
  return (
    <span
      className={`money ${c}${className ? ' ' + className : ''}`}
      role="img"
      aria-label={note ? `${moneyText(amount, c)}, ${note}` : moneyText(amount, c)}
    >
      <Icon name={CURRENCY_ICON[c]} />
      <span className="money-n" aria-hidden="true">
        {amount}
      </span>
    </span>
  )
}
