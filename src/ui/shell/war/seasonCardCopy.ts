/**
 * The standings' season card — the PURE half (October 2026, the simplified
 * trade war). Its words for every state, from the rules' `patronStatus` and
 * the company last now (`seasonLast`): when the season ends, who your patron
 * is (none yet / one ahead in your deliveries / level), what it would pay if
 * the season ended now, and who is last. Each fact once: the rows above the
 * card carry the shares and your deliveries per company, so the card names
 * neither. `SeasonCard.tsx` draws it; `tests/seasonCardCopy.test.ts` reads it.
 */
import { companyById, type CompanyId } from '../../../game/data/companies'
import { DESPERATE_PAY, DESPERATE_STRENGTH, PATRON_PURSE, VAULT_PICKS, type PatronStatus } from '../../../game/run/tradeWar'

/** "Peppercorn Co." → "Peppercorn", where a line names the company twice or is short of room (re-exported by `WarParts`). */
export const shortName = (id: CompanyId): string => companyById(id).name.replace(/ Co\.$/, '')

export interface SeasonCardCopy {
  /** The eyebrow: when the season ends, said once on the page. */
  when: string
  /** The status line: who your patron is. */
  headline: string
  /** Why (none yet, a tie and what breaks it), or what makes one. */
  sub: string
  /** What it would pay if the season ended now: the running amount, or null with no patron. */
  sum: number | null
  /** What it pays, as `.field-k` / `.field-v` rows. */
  pays: { k: string; v: string; gold?: number }[]
  /** Next season: the company last now and its desperate terms, or null (no last place). */
  next: { company: CompanyId; k: string; v: string } | null
}

const names = (cs: readonly CompanyId[]) => {
  const n = cs.map(shortName)
  return n.length <= 2 ? n.join(' and ') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
}

/** "Pays ×1.5 · its raiders 20% stronger" as the next season's line. */
export const desperateNext = () => `Next season it pays ×${DESPERATE_PAY}, and its raiders are ${Math.round((DESPERATE_STRENGTH - 1) * 100)}% stronger`

export function seasonCardCopy(st: PatronStatus, last: CompanyId | null): SeasonCardCopy {
  const when = st.lastContract ? 'The season’s last contract is next' : `The season ends in ${st.left} contracts`
  const patron = st.patron ? shortName(st.patron) : null
  const headline = st.state === 'none' ? 'No patron yet' : st.state === 'tied' ? `${names(st.level)} are level` : `${patron} is your patron`
  const sub =
    st.state === 'none'
      ? st.lastContract
        ? 'Deliver your next contract, and its company pays you.'
        : 'Whichever company you deliver the most for pays you.'
      : st.state === 'tied'
        ? st.breaksBy === 'hash'
          ? `Your deliveries and their shares are level: ${patron} pays, for now.`
          : `A tie goes to the bigger share: ${patron} pays, for now.`
        : 'You delivered the most for it this season.'
  return {
    when,
    headline,
    sub,
    sum: st.patron ? st.purse : null,
    pays: [
      { k: 'Each contract you deliver for it', v: `${PATRON_PURSE} gold`, gold: PATRON_PURSE },
      { k: patron ? `One ${patron} item` : 'One of its items', v: `pick 1 of ${VAULT_PICKS}` },
    ],
    next: last ? { company: last, k: `Last now: ${shortName(last)}`, v: desperateNext() } : null,
  }
}
