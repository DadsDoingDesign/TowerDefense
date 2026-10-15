/**
 * The home's company dock (October 2026, the map-first home) — the PURE half.
 *
 * Five fixed slots, one per company, always in {@link COMPANY_IDS} order (the
 * order the trade map fans its roads, west to east), each saying what tells
 * one company from another at a glance: your standing with it, its share of
 * the trade while the war is on, and the day's marks — desperate terms, the
 * market of the day, your exclusive, cold to you. The focused company's card
 * says what those marks MEAN; the slot carries the number. Nothing here reads
 * a store: `MenuScreen` passes the save in, `tests/homeDock.test.ts` drives it.
 */
import { COMPANY_IDS, companyById, type CompanyId } from '../../game/data/companies'
import { companyOpen, standingOf, type StandingXp } from '../../game/run/standing'
import { termName, trackLevel } from '../../game/run/track'
import { DESPERATE_PAY, isCold, isDesperate, seasonLeader, type Season } from '../../game/run/tradeWar'

/** A day's mark on a slot, in the order they are shown. */
export type SlotMark = 'desperate' | 'market' | 'exclusive' | 'cold'
const MARK_ORDER: readonly SlotMark[] = ['desperate', 'market', 'exclusive', 'cold']
/** At most this many marks hang on a slot (all of them are in its name, and on its card). */
export const SLOT_MARKS = 2

export interface DockSlot {
  company: CompanyId
  /** It hires you (Moonquill opens at Standing 3 with any company). */
  open: boolean
  /** Standing 0–10 overall, the term signed, and the level on that term's track. */
  standing: number
  term: number
  level: number
  /** The slot's number: "Rep 4", or "II · 3" on a second term (its crest wears the gold rim). */
  rep: string
  /** Its share of the trade (%), while the war shows; else null. */
  share: number | null
  /** It leads the trade war this season, alone (a tie crowns nobody). */
  leads: boolean
  /** Every mark it carries today, in {@link MARK_ORDER}. */
  marks: SlotMark[]
  /** What opens it, on a company not hiring yet. */
  opensAt: number | null
}

/** A mark's face on the slot: the number where there is one. */
export function markText(mark: SlotMark, marketMult: number): string {
  if (mark === 'desperate') return `×${DESPERATE_PAY}`
  if (mark === 'market') return `×${marketMult}`
  if (mark === 'exclusive') return 'Excl.'
  return 'Cold'
}

const MARK_WORDS: Record<SlotMark, (mult: number) => string> = {
  desperate: () => `desperate, pays ×${DESPERATE_PAY}`,
  market: (m) => `its goods sell ×${m} today`,
  exclusive: () => 'your exclusive this season',
  cold: () => 'cold to you this season',
}

const roman = (term: number) => termName(term).replace(/^Term /, '')

export function dockSlots(o: {
  xp: StandingXp
  terms?: Partial<Record<CompanyId, number>> | null
  /** The trade war's season, once it shows; else null. */
  war: Pick<Season, 'n' | 'shares' | 'deliveries' | 'exclusive' | 'desperate'> | null
  /** Today's market, once it shows; else null. */
  market: { company: CompanyId; mult: number } | null
}): DockSlot[] {
  // The crown goes to a leader, not to a tie: an even season (a fresh one) crowns nobody.
  const top = o.war ? Math.max(...COMPANY_IDS.map((c) => o.war!.shares[c])) : 0
  const leader = o.war && COMPANY_IDS.filter((c) => o.war!.shares[c] === top).length === 1 ? seasonLeader(o.war) : null
  return COMPANY_IDS.map((company) => {
    const term = Math.max(1, o.terms?.[company] ?? 1)
    const standing = standingOf(o.xp, company)
    const level = trackLevel(o.xp[company] ?? 0, term)
    const open = companyOpen(company, o.xp)
    const has: Record<SlotMark, boolean> = {
      desperate: !!o.war && isDesperate(o.war, company),
      market: o.market?.company === company,
      exclusive: o.war?.exclusive === company,
      cold: !!o.war && isCold(o.war, company),
    }
    return {
      company,
      open,
      standing,
      term,
      level,
      rep: term > 1 ? `${roman(term)} · ${level}` : `Rep ${standing}`,
      share: o.war ? o.war.shares[company] : null,
      leads: leader === company,
      marks: MARK_ORDER.filter((m) => has[m]),
      opensAt: open ? null : (companyById(company).opensAt ?? 1),
    }
  })
}

/** A slot's accessible name: everything it shows, in words. */
export function slotName(s: DockSlot, marketMult: number): string {
  const co = companyById(s.company)
  if (!s.open) return `${co.name}: not hiring yet, opens at Standing ${s.opensAt}`
  const rep = s.term > 1 ? `${termName(s.term)}, level ${s.level}` : `standing ${s.standing}`
  const share = s.share != null ? `, ${s.share}% of the trade${s.leads ? ', leads the trade war' : ''}` : ''
  const marks = s.marks.map((m) => `, ${MARK_WORDS[m](marketMult)}`).join('')
  return `${co.name}: ${rep}${share}${marks}`
}
