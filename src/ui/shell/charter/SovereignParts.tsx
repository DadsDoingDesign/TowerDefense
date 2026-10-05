import { itemKindById } from '../../../game/data/itemKinds'
import { ITEM_BASES } from '../../../game/data/items'
import { SOVEREIGN_INITIAL, SOVEREIGN_TIER } from '../../../game/run/charter'
import { itemIcon } from '../../channels'
import { Icon } from '../../Icon'

/**
 * The Sovereign tier's marks (the endgame charter): the cyan "S" badge, and
 * the reveal card a delivered Sovereign Route shows. Cyan is a fill and a
 * light here, never body text on its own: the badge carries its initial, the
 * card its tier's name.
 */

const SLOT_WORD: Record<string, string> = { oneHand: 'Weapon', twoHand: 'Weapon', offHand: 'Off hand', body: 'Body' }

/** The tier's initial on a cyan chip — the "S" that survives with colour off. */
export const SovereignMark = ({ title = `${SOVEREIGN_TIER} tier` }: { title?: string }) => (
  <span className="sov-mark" title={title} aria-hidden="true">
    {SOVEREIGN_INITIAL}
  </span>
)

/** A Sovereign kind's icon, by its noun. */
export const sovereignIcon = (kind: string) => itemIcon({ name: kind, slot: ITEM_BASES[kind]?.slot ?? 'oneHand' })

/**
 * The reveal: the Sovereign kind a delivered charter unlocked, as its card —
 * the mark, the name, "Weapon · Sovereign", and its one sentence. With every
 * kind already owned, it says so instead.
 */
export function SovereignReveal({ kind, owned, of }: { kind: string | null; owned: number; of: number }) {
  const k = kind ? itemKindById(kind) : undefined
  if (!kind || !k) {
    return (
      <div className="sov-reveal none" role="status">
        <SovereignMark />
        <span className="sov-reveal-text">
          <span className="sov-reveal-k">Sovereign items</span>
          <b>Every one is yours already</b>
          <span className="sov-reveal-does">The payout is the whole of it this time.</span>
        </span>
      </div>
    )
  }
  return (
    <div className="sov-reveal" role="status" aria-label={`Sovereign item unlocked: ${kind}. ${k.does}`}>
      <span className="sov-reveal-icon" aria-hidden="true">
        <Icon name={sovereignIcon(kind)} lg />
        <SovereignMark />
      </span>
      <span className="sov-reveal-text">
        <span className="sov-reveal-k">Sovereign item unlocked</span>
        <b>{kind}</b>
        <small>
          {SLOT_WORD[k.slot]} · {SOVEREIGN_TIER} · {owned} of {of} yours
        </small>
        <span className="sov-reveal-does">{k.does}</span>
      </span>
    </div>
  )
}
