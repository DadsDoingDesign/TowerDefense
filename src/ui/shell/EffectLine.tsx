import { effectIcon, type IconKey } from '../channels'
import { Icon } from '../Icon'

/**
 * One line of generated effect text, with its own mark.
 *
 * `describeMods` / `describeBase` / `describeEnchant` produce every effect
 * sentence in the game and they are read on the hero card's full sheet, in
 * item details, on mutations, on reward cards and on shrines. Classifying the
 * OUTPUT (see `effectIcon`) lights all of that with one table and leaves
 * `src/game/data/` untouched.
 *
 * A line the table does not recognise — a pure stat grant, an authored blurb —
 * renders exactly as it did before, with the `·` bullet. There is deliberately
 * no "unknown" icon: a wrong picture is worse than no picture, and the sentence
 * was always the real channel anyway.
 *
 * `mark` overrides the classification where the CALLER knows something the
 * sentence cannot say: a cursed enchantment (`Reckless — +85% damage, −45%
 * attack speed` classifies to `damage`, and the fact that decides the purchase
 * is that it is a curse). The caller reads `e.id`, so nothing here keeps a copy
 * of which labels are curses.
 *
 * (Moved out of `DetailBand.tsx` in the battle-band pass, Oct 2026, so the hero
 * card and the reward cards can share it without an import cycle.)
 */
export function EffectLine({ text, tone, bullet, mark, inline }: { text: string; tone?: string; bullet?: boolean; mark?: IconKey; inline?: boolean }) {
  const icon = mark ?? effectIcon(text)
  // `inline`: a span, for a line inside a button (a reward card), where a <p> is not allowed.
  const Tag = inline ? 'span' : 'p'
  return (
    <Tag className={`sh-line ${tone ?? ''} ${icon ? 'iconed' : ''}`}>
      {icon ? <Icon name={icon} /> : bullet ? '· ' : null}
      {text}
    </Tag>
  )
}
