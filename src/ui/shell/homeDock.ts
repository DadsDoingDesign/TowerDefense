/**
 * The home's company dock (October 2026, the map-first home) — the PURE half.
 *
 * Five fixed slots, one per company, always in {@link COMPANY_IDS} order (the
 * order the trade map fans its roads, west to east), each saying what tells
 * one company from another at a glance: your standing with it, its share of
 * the trade while the war is on, and the day's marks — desperate terms, the
 * market of the day. The focused company's card
 * says what those marks MEAN; the slot carries the number. Nothing here reads
 * a store: `MenuScreen` passes the save in, `tests/homeDock.test.ts` drives it.
 *
 * Buy Company, the Sovereign Route, is not in the dock row: it is a slot of
 * its own floating over the dock's right end ({@link charterSlot}).
 */
import { COMPANY_IDS, companyById, type CompanyId } from '../../game/data/companies'
import { companyOpen, standingOf, type StandingXp } from '../../game/run/standing'
import { termName, trackLevel } from '../../game/run/track'
import { DESPERATE_PAY, isDesperate, seasonLeader, type Season } from '../../game/run/tradeWar'
import { CHARTER_FEE, type CharterDoor } from '../../game/run/charter'

/** A day's mark on a slot, in the order they are shown. */
export type SlotMark = 'desperate' | 'market'
const MARK_ORDER: readonly SlotMark[] = ['desperate', 'market']
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
  return `×${marketMult}`
}

const MARK_WORDS: Record<SlotMark, (mult: number) => string> = {
  desperate: () => `desperate, pays ×${DESPERATE_PAY}`,
  market: (m) => `its goods sell ×${m} today`,
}

const roman = (term: number) => termName(term).replace(/^Term /, '')

export function dockSlots(o: {
  xp: StandingXp
  terms?: Partial<Record<CompanyId, number>> | null
  /** The trade war's season, once it shows; else null. */
  war: Pick<Season, 'n' | 'shares' | 'deliveries' | 'desperate'> | null
  /** Today's market, once it shows; else null. */
  market: { company: CompanyId; mult: number } | null
}): DockSlot[] {
  // The crown goes to a leader, not to a tie: an even season (a fresh one) crowns nobody.
  const leader = o.war ? seasonLeader(o.war) : null
  return COMPANY_IDS.map((company) => {
    const term = Math.max(1, o.terms?.[company] ?? 1)
    const standing = standingOf(o.xp, company)
    const level = trackLevel(o.xp[company] ?? 0, term)
    const open = companyOpen(company, o.xp)
    const has: Record<SlotMark, boolean> = {
      desperate: !!o.war && isDesperate(o.war, company),
      market: o.market?.company === company,
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

// ---------------------------------------------------------------------------
// The Buy Company slot (the Sovereign Route)
// ---------------------------------------------------------------------------

/**
 * The Buy Company slot (October 2026; the designer: "a button that looks
 * locked and it's called 'Buy Company'" — then, of its place as the dock's
 * sixth slot, "it's too cramped. but it can sit right above it and be
 * locked", and "should be like one of the other company cards but locked,
 * floating above"). It is not a company's road: it is the Sovereign Route — your own
 * road, every company's goods. Shown from the first home after the free
 * escort, locked or open, so the endgame reads as a goal, not a secret
 * (`docs/MERCENARY_COMPANY.md`, Overlooked § 5). Selecting it lights every
 * road, and its card says what opens it or what it costs.
 */
export interface CharterSlot {
  /** The door is open: every skill card and item kind of Levels 1–3 unlocked. */
  open: boolean
  /** The share of that catalogue held, as a whole percent — 100 only once it is open. */
  pct: number
  /** Unlocks still to get, skills and items together. */
  missing: number
  skills: { have: number; need: number }
  items: { have: number; need: number }
  /** The fee, and the gold the bank lacks for it (0 when it covers it). */
  fee: number
  short: number
}

export function charterSlot(door: CharterDoor, bank: number, fee = CHARTER_FEE): CharterSlot {
  const have = door.skills.have + door.items.have
  const need = door.skills.need + door.items.need
  return {
    open: door.open,
    pct: door.open ? 100 : Math.min(99, Math.floor(door.progress * 100)),
    missing: Math.max(0, need - have),
    skills: door.skills,
    items: door.items,
    fee,
    short: Math.max(0, fee - Math.max(0, Math.floor(bank))),
  }
}

const n = (x: number) => x.toLocaleString('en')

/** The slot's accessible name: what it is, and what stands between you and it. */
export function charterSlotName(s: CharterSlot): string {
  if (!s.open) return `Buy Company: locked, ${s.pct}% unlocked. Opens when every skill and item is unlocked`
  return s.short ? `Buy Company: open, ${n(s.fee)} gold. Your bank is ${n(s.short)} short` : `Buy Company: open, ${n(s.fee)} gold`
}

/**
 * The card's CTA (it opens the charter page): locked, it says what is missing
 * ("Unlock 14 more"); open, it is "Buy Company" with the fee on it — disabled
 * while the bank is short (the card's Bank row says by how much).
 */
export function charterCta(s: CharterSlot): { label: string; fee: number | null; enabled: boolean } {
  if (!s.open) return { label: `Unlock ${s.missing} more`, fee: null, enabled: false }
  return { label: 'Buy Company', fee: s.fee, enabled: !s.short }
}
