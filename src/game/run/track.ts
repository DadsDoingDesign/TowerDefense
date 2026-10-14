/**
 * ---------------------------------------------------------------------------
 * The loyalty track — what each standing level pays, named ahead of time
 * (Draft 4 · B, October 2026)
 * ---------------------------------------------------------------------------
 *
 * The designer: "make the companies a bit of a longer grind", "a visible
 * loyalty track per company … today's random skill per level becomes
 * something you can see coming", and "consider carrying this through the
 * items and skills as well".
 *
 * Every company has a track of ten levels (its standing, `run/standing.ts`).
 * What a level pays is fixed by its place on the track ({@link TRACK_PLAN}):
 *
 *   1 its skill card · 2 stakes open · 3 an item kind of its own · 4 its skill
 *   card · 5 its signature skill · 6 an item kind · 7 its skill card · 8 an
 *   item kind · 9 its skill card, and its Sovereign item named · 10 a second
 *   term — and the flag piece its kit gives at every level
 *   (`data/companyKits.kitPieceAt`).
 *
 * **Never a roll.** The card a level pays is the company's NEXT locked card in
 * catalogue order at the level's floor (`standing.cardFloor`), falling back
 * to the company's at any level, then anyone's at the floor, then anyone's; an
 * item level pays the company's next locked kind (Levels 1–3, the lowest level
 * first), then anyone's.
 * With nothing left to unlock, the level pays the Rare bonus item
 * (`standing.standingBonusKind`, salted by the level and the term only), as a
 * standing level always has. So the track page can show exactly what each
 * level will pay from what is unlocked now ({@link trackPlan}), and the settle
 * pays exactly that ({@link payTrack}) — the same function.
 *
 * **A second term** at standing 10: the company re-signs you ({@link canSignTerm},
 * `metaStore.signTerm`). The track restarts at 1 on a Term II curve the same
 * length, its XP continuing; each Term II level pays a Rare bonus item — and
 * Term II's level 5 pays the signature skill to a militia that crossed standing
 * 5 before the track existed (a save from before v13: its level 5 was paid
 * with a card). Its asks pay double standing (`asks.askStandingFor`), and its
 * crest wears a gold rim. Everything else is kept: standing stays 10 for the
 * stake cap and the flag kit. A term's XP stops at its end: past standing 10
 * the bar is full until you sign.
 *
 * Pure: no zustand, React or DOM, and never a run-stream draw.
 */
import { companyById, COMPANY_IDS, type CompanyId } from '../data/companies'
import { kitPieceAt, type KitPiece } from '../data/companyKits'
import { ITEM_KINDS, SOVEREIGN_LEVEL } from '../data/itemKinds'
import { ALL_SKILLS, RANDOM_UNLOCK_SKILLS, SIGNATURE_SKILLS } from '../data/skills'
import { ASK_STANDING } from './asks'
import { cardFloor, MAX_STANDING, standingBonusKind, standingFor, standingProgress, standingXpFor, standingXpToReach } from './standing'
import { RUN_LAYERS } from './threat'

/** What a level of the track is for, by its place (index 0 = level 1). */
export type TrackStep = 'card' | 'stakes' | 'item' | 'signature' | 'cardSovereign' | 'term'
export const TRACK_PLAN: readonly TrackStep[] = ['card', 'stakes', 'item', 'card', 'signature', 'item', 'card', 'item', 'cardSovereign', 'term']

/** The level whose step is the signature skill (Term II's same level catches it up). */
export const SIGNATURE_LEVEL = 5
/** The level that names the Sovereign item. */
export const SOVEREIGN_NAMED_LEVEL = 9

/** How many terms a company signs: the first, and one re-signing at standing 10. */
export const MAX_TERMS = 2
/** XP a whole term costs (standing 0 → 10): every term is the same length. */
export const TERM_XP = standingXpToReach(MAX_STANDING)

/** Where term `term` starts on a company's cumulative XP. */
export const termStart = (term: number): number => (clampTerm(term) - 1) * TERM_XP
/** The most XP a company can hold during term `term`: its end. Past it the bar is full until you sign. */
export const termCap = (term: number): number => clampTerm(term) * TERM_XP
const clampTerm = (term: number): number => Math.max(1, Math.min(MAX_TERMS, Math.floor(Number.isFinite(term) ? term : 1)))

/** The track level (0–10) a company's XP is at, within its term. */
export const trackLevel = (xp: number, term: number): number => standingFor(Math.max(0, (xp || 0) - termStart(term)))
/** Where a company's XP sits on its term's track: the level, the XP into and needed for the next. */
export const trackProgress = (xp: number, term: number) => standingProgress(Math.max(0, (xp || 0) - termStart(term)))
/** Whether the company will re-sign you now: standing 10 on a term that is not the last. */
export const canSignTerm = (xp: number, term: number): boolean => clampTerm(term) < MAX_TERMS && trackLevel(xp, term) >= MAX_STANDING

/**
 * A save's term with a company, validated against its XP: whole, 1 to
 * {@link MAX_TERMS}, and never a term the XP has not reached the start of.
 */
export function readTerm(raw: unknown, xp: number): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 1
  const reached = 1 + Math.floor(Math.max(0, xp || 0) / TERM_XP)
  return Math.max(1, Math.min(MAX_TERMS, reached, n))
}

/** "Term II". */
export const termName = (term: number): string => `Term ${['I', 'II', 'III'][clampTerm(term) - 1]}`

// ---------------------------------------------------------------------------
// What a level pays
// ---------------------------------------------------------------------------

/** What one level of a company's track pays. */
export interface TrackPay {
  company: CompanyId
  term: number
  level: number
  /** The skill card it unlocks (null: none, or nothing left). */
  card: string | null
  /** The company's signature skill, unlocked. */
  signature: string | null
  /** The item kind it unlocks. */
  item: string | null
  /** The kind of the Rare bonus item it owes the next contract (nothing was left to unlock). */
  bonus: string | null
  /** The Sovereign kind it names and shows — not an unlock (the Sovereign Route unlocks it). */
  named: string | null
  /** Stakes open on the company's road. */
  stakes: boolean
  /** The company offers a second term. */
  secondTerm: boolean
  /** The flag piece of the company's kit (Term I only: Term II's kit is already whole). */
  flag: KitPiece | null
}

/** What is unlocked now: the cards and the kinds (the basic five and the starters are everyone's). */
export interface Unlocked {
  skills: readonly string[]
  items: readonly string[]
}

const SKILL = new Map(ALL_SKILLS.map((k) => [k.id, k]))
/**
 * The kinds a track can unlock: Levels 1–3, not the basic five — the lowest
 * level first, then catalogue order, so a company's track opens its light
 * kinds before its heavy ones (Ironvein: Pavise and Plate, then Greatsword
 * and Warhammer).
 */
const TRACK_KINDS = ITEM_KINDS.filter((k) => !k.basic && k.level < SOVEREIGN_LEVEL)
  .map((k, i) => ({ k, i }))
  .sort((a, b) => a.k.level - b.k.level || a.i - b.i)
  .map(({ k }) => k)

/** The company's Sovereign kind (Level 4): the one a level 9 names. */
export const sovereignKindOf = (company: CompanyId): string | null => ITEM_KINDS.find((k) => k.level === SOVEREIGN_LEVEL && k.company === company)?.id ?? null

/**
 * The card a level pays: the company's next locked card in catalogue order at
 * the level's floor, then its next at any level, then anyone's at the floor,
 * then anyone's — null when every card is unlocked.
 */
export function nextTrackCard(have: readonly string[], company: CompanyId, level: number): string | null {
  const owned = new Set(have)
  const floor = cardFloor(level)
  const locked = RANDOM_UNLOCK_SKILLS.filter((id) => !owned.has(id)).map((id) => SKILL.get(id)!)
  const tries = [
    (k: (typeof locked)[number]) => k.company === company && k.level >= floor,
    (k: (typeof locked)[number]) => k.company === company,
    (k: (typeof locked)[number]) => k.level >= floor,
    () => true,
  ]
  for (const t of tries) {
    const got = locked.find(t)
    if (got) return got.id
  }
  return null
}

/** The item kind a level pays: the company's next locked kind (Levels 1–3, lowest first), then anyone's — null when none is left. */
export function nextTrackItem(have: readonly string[], company: CompanyId): string | null {
  const owned = new Set(have)
  const locked = TRACK_KINDS.filter((k) => !owned.has(k.id))
  return (locked.find((k) => k.company === company) ?? locked[0])?.id ?? null
}

/**
 * What level `level` of `company`'s track pays in term `term`, given what is
 * unlocked now. Deterministic: the same inputs pay the same, so the track can
 * show it ahead of time. A level that can find nothing left to unlock pays
 * the Rare bonus item (the stakes and term levels unlock nothing, and pay none).
 */
export function trackPay(company: CompanyId, term: number, level: number, have: Unlocked): TrackPay {
  const t = clampTerm(term)
  const pay: TrackPay = {
    company,
    term: t,
    level,
    card: null,
    signature: null,
    item: null,
    bonus: null,
    named: null,
    stakes: false,
    secondTerm: false,
    flag: t === 1 ? kitPieceAt(company, level) : null,
  }
  const bonus = () => standingBonusKind(have.items, company, level, 'track', t)
  const signature = SIGNATURE_SKILLS[company]
  if (t > 1) {
    // Term II: a Rare bonus item a level — and, at its level 5, the signature
    // skill to a militia whose Term I level 5 was paid before the track.
    if (level === SIGNATURE_LEVEL && signature && !have.skills.includes(signature)) pay.signature = signature
    else pay.bonus = bonus()
    return pay
  }
  switch (TRACK_PLAN[level - 1]) {
    case 'stakes':
      pay.stakes = true
      break
    case 'term':
      pay.secondTerm = true
      break
    case 'signature':
      if (signature && !have.skills.includes(signature)) pay.signature = signature
      else pay.bonus = bonus()
      break
    case 'item':
      pay.item = nextTrackItem(have.items, company)
      if (!pay.item) pay.bonus = bonus()
      break
    case 'card':
    case 'cardSovereign':
      pay.card = nextTrackCard(have.skills, company, level)
      if (!pay.card) pay.bonus = bonus()
      if (TRACK_PLAN[level - 1] === 'cardSovereign') pay.named = sovereignKindOf(company)
      break
  }
  return pay
}

/** `have` with what a level paid added. */
const withPay = (have: Unlocked, p: TrackPay): Unlocked => ({
  skills: p.card || p.signature ? [...have.skills, ...[p.card, p.signature].filter((x): x is string => !!x)] : have.skills,
  items: p.item ? [...have.items, p.item] : have.items,
})

/** One row of the track page: what the level pays, and where you stand to it. */
export interface TrackRow {
  pay: TrackPay
  /** Crossed already. What a crossed level paid is not kept: only its fixed parts (the flag piece, the signature, the Sovereign named) are exact. */
  earned: boolean
  /** The next level to cross. */
  next: boolean
}

/**
 * A company's track as its page shows it: the ten levels of the term you are
 * on. The levels still ahead are dealt one after another from what is
 * unlocked now — exactly what the settle will pay, unless something else
 * (a delivery, a crate, another company's level) unlocks one of them first.
 */
export function trackPlan(company: CompanyId, o: { xp: number; term: number } & Unlocked): TrackRow[] {
  const term = clampTerm(o.term)
  const at = trackLevel(o.xp, term)
  let have: Unlocked = { skills: o.skills, items: o.items }
  const rows: TrackRow[] = []
  for (let level = 1; level <= MAX_STANDING; level++) {
    const pay = trackPay(company, term, level, have)
    if (level > at) have = withPay(have, pay)
    rows.push({ pay, earned: level <= at, next: level === at + 1 })
  }
  return rows
}

// ---------------------------------------------------------------------------
// The settle
// ---------------------------------------------------------------------------

/** How far a settle moved one company's track. */
export interface TrackSpan {
  company: CompanyId
  term: number
  /** Track levels within the term. */
  before: number
  after: number
}

export interface TrackSettle {
  /** Each company's XP after the settle (capped at its term's end). */
  xp: Record<CompanyId, number>
  /** Every level crossed, company by company in `COMPANY_IDS` order, in order. */
  pays: TrackPay[]
  /** Every company whose XP moved. */
  spans: TrackSpan[]
  /** The skill cards unlocked (signature skills included), in order. */
  cards: string[]
  /** The item kinds unlocked, in order. */
  items: string[]
}

/**
 * Pay each company its XP `gains` and every track level that crosses, onto
 * what is unlocked now. A level is paid only when play crosses it, so a level
 * is never paid twice (and a save's levels from before the track pay nothing
 * new). XP stops at the term's end.
 */
export function payTrack(o: {
  gains: Partial<Record<CompanyId, number>>
  xp: Partial<Record<CompanyId, number>>
  terms: Partial<Record<CompanyId, number>>
} & Unlocked): TrackSettle {
  const xp = Object.fromEntries(COMPANY_IDS.map((c) => [c, Math.max(0, Math.floor(o.xp[c] ?? 0))])) as Record<CompanyId, number>
  let have: Unlocked = { skills: o.skills, items: o.items }
  const pays: TrackPay[] = []
  const spans: TrackSpan[] = []
  for (const c of COMPANY_IDS) {
    const gain = Math.max(0, Math.floor(o.gains[c] ?? 0))
    if (!gain) continue
    const term = readTerm(o.terms[c] ?? 1, xp[c])
    const from = xp[c]
    const to = Math.max(from, Math.min(from + gain, termCap(term)))
    const before = trackLevel(from, term)
    const after = trackLevel(to, term)
    xp[c] = to
    spans.push({ company: c, term, before, after })
    for (let level = before + 1; level <= after; level++) {
      const pay = trackPay(c, term, level, have)
      have = withPay(have, pay)
      pays.push(pay)
    }
  }
  const cards = have.skills.slice(o.skills.length)
  const items = have.items.slice(o.items.length)
  return { xp, pays, spans, cards, items }
}

// ---------------------------------------------------------------------------
// The pace
// ---------------------------------------------------------------------------

/**
 * The standing XP a typical delivery earns with its company: the whole road
 * (`RUN_LAYERS − 1` stops), the ~270 raiders a delivered escort fells
 * (`balance/ask-rates.ts`), the delivery, and one of its two asks met (each
 * is fitted to be met about half the time) — paid double in Term II.
 */
export function typicalDeliveryXp(term = 1): number {
  return standingXpFor({ depth: RUN_LAYERS - 1, kills: 270, delivered: true }) + ASK_STANDING * (clampTerm(term) > 1 ? 2 : 1)
}

/** About how many typical deliveries reach `level` of the term's track from `xp` (0 when reached). */
export function deliveriesTo(xp: number, term: number, level: number): number {
  const need = termStart(term) + standingXpToReach(level) - Math.max(0, xp || 0)
  return need <= 0 ? 0 : Math.ceil(need / typicalDeliveryXp(term))
}

/** "about one delivery away", "about 3 deliveries away". */
export function deliveriesWord(n: number): string {
  return n <= 1 ? 'about one delivery away' : `about ${n} deliveries away`
}

/** A short name for a company in a row ("Peppercorn", "Easel House"). */
export const shortCompany = (company: CompanyId): string => companyById(company).name.replace(/ Co\.$/, '')

/**
 * The next level's reward in a word or two, for the road notice's standing
 * chip ("Rep 3 · Gilt Frame at 4"): the card's, signature's or kind's own
 * name, "stakes", "a Rare Axe", "a second term" — null at the end of the last
 * term.
 */
export function nextRewardWord(rows: readonly TrackRow[]): string | null {
  const next = rows.find((r) => r.next)
  if (!next) return null
  const p = next.pay
  const skill = p.signature ?? p.card
  const what = skill
    ? (SKILL.get(skill)?.name ?? 'a skill')
    : p.item
      ? p.item
      : p.bonus
        ? `a Rare ${p.bonus}`
        : p.stakes
          ? 'stakes'
          : p.secondTerm
            ? 'a second term'
            : null
  return what ? `${what} at ${p.level}` : null
}
