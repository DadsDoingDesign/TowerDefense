/**
 * ---------------------------------------------------------------------------
 * Standing — how well a trade company knows your militia (build step 2)
 * ---------------------------------------------------------------------------
 *
 * Standing replaces the single Watch level, one track per company. Playing a
 * company's contracts earns standing XP with THAT company (the Watch XP
 * formula: depth reached, enemies felled, delivery). What each standing level
 * pays is the company's loyalty track (`run/track.ts`, Draft 4 · B): named
 * ahead of time, never a random roll — a skill card's level floor still rises
 * with the standing ({@link cardFloor}). Standing also caps the stake
 * (`contracts.crateCap`: standing + 1 crates).
 *
 * Items unlock from contracts instead: a delivered contract opens one skill
 * and one item kind, plus the stake's item chances and milestone skills, at a
 * floor that rises with the stake ({@link contractFloor}).
 *
 * **Past the card pool** (October 2026): once every card a standing level
 * could deal is unlocked, the level pays a **Rare bonus item** for the next
 * contract instead ({@link standingBonusKind}) — the sealed crate's duplicate
 * mechanism (`hq.bonusItemsFor`), so a level is never paid with nothing.
 *
 * **A longer grind** (Draft 4 · B): the curve costs 1.75× what it did
 * ({@link standingCost}); the v13 meta migration keeps every save's level
 * and its fraction of the way to the next ({@link migrateStandingXp}).
 *
 * **The Sovereign Route** earns standing with all five companies at once
 * ({@link charterStandingXp}).
 *
 * Every unlock goes through `watch.rollFromPool` — one generic roll, fed a
 * pool, a filter and a floor — and every roll is a hash of its salt, never a
 * run-stream draw.
 */
import { ALL_SKILLS, RANDOM_UNLOCK_SKILLS } from '../data/skills'
import { BASIC_ITEM_KINDS, ITEM_KINDS, UNLOCK_ITEM_KINDS } from '../data/itemKinds'
import { COMPANY_IDS, companyById, type CompanyId } from '../data/companies'
import { rollFromPool, watchLevelCost } from './watch'

/** The highest standing there is. */
export const MAX_STANDING = 10

/**
 * Standing XP a finished contract earns with its company: 15 a depth reached,
 * 1 per 10 enemies felled, 60 for a delivery — the Watch XP formula, now paid
 * to one company. A cash-out keeps what the road so far earned.
 */
export const STANDING_XP = { perDepth: 15, killsPerXp: 10, delivered: 60 } as const

export function standingXpFor(r: { depth: number; kills: number; delivered: boolean }): number {
  const d = Math.max(0, Math.floor(r.depth || 0))
  const k = Math.max(0, Math.floor(r.kills || 0))
  return d * STANDING_XP.perDepth + Math.floor(k / STANDING_XP.killsPerXp) + (r.delivered ? STANDING_XP.delivered : 0)
}

/**
 * The standing XP a Sovereign Route earns, per company (October 2026): the
 * road is every company's, so each of the five gets what an escort that ended
 * the same way earns with its one company — a delivery's with the delivery
 * bonus, a fall's without it.
 */
export function charterStandingXp(r: { depth: number; kills: number; delivered: boolean }): Record<CompanyId, number> {
  const xp = standingXpFor(r)
  return Object.fromEntries(COMPANY_IDS.map((c) => [c, xp])) as Record<CompanyId, number>
}

/**
 * XP from standing `s` to `s + 1`: 140, then 35 more a level (Draft 4 · B,
 * "make the companies a bit of a longer grind"): 1.75× the Watch level's curve
 * it used to share (80, then 20 more). Standing 10 costs 2,975 XP with one
 * company — about ten deliveries with their asks, where it was about seven.
 */
export const standingCost = (s: number): number => STANDING_CURVE.base + STANDING_CURVE.step * Math.max(0, Math.floor(s))
/** The curve's numbers: the first level's cost, and what each level adds. */
export const STANDING_CURVE = { base: 140, step: 35 } as const

/**
 * The curve before Draft 4 · B (80, then 20 more a level: standing 10 at
 * 1,700 XP), kept ONLY for the v13 meta migration ({@link migrateStandingXp}).
 */
export const legacyStandingCost = (s: number): number => watchLevelCost(Math.max(0, Math.floor(s)) + 1)

/**
 * A company's stored XP from the old curve onto the new one (meta v13): the
 * same standing, and the same fraction of the way to the next. Nobody loses a
 * level, and no level is crossed by the move (a level pays only when play
 * crosses it). At standing 10 the XP is the new curve's top: anything past
 * the old top was worth nothing, and the track caps a term at its end.
 */
export function migrateStandingXp(oldXp: number): number {
  const xp = Math.max(0, Math.floor(oldXp || 0))
  let level = 0
  let reach = 0
  while (level < MAX_STANDING && xp >= reach + legacyStandingCost(level)) reach += legacyStandingCost(level++)
  if (level >= MAX_STANDING) return standingXpToReach(MAX_STANDING)
  const frac = (xp - reach) / legacyStandingCost(level)
  return standingXpToReach(level) + Math.floor(frac * standingCost(level))
}

/** Cumulative XP to reach standing `s` (standing 0 = 0 XP: a company you have never worked for). */
export function standingXpToReach(s: number): number {
  let t = 0
  for (let k = 0; k < Math.min(MAX_STANDING, Math.floor(s)); k++) t += standingCost(k)
  return t
}

/** The standing a cumulative XP total is, 0–{@link MAX_STANDING}. */
export function standingFor(xp: number): number {
  let s = 0
  while (s < MAX_STANDING && xp >= standingXpToReach(s + 1)) s++
  return s
}

/** Where a total sits: its standing, and the XP into and needed for the next. */
export function standingProgress(xp: number): { standing: number; into: number; need: number; max: boolean } {
  const standing = standingFor(xp)
  const max = standing >= MAX_STANDING
  return { standing, into: max ? 0 : Math.max(0, xp - standingXpToReach(standing)), need: max ? 0 : standingCost(standing), max }
}

/** The level floor of the card a standing level unlocks: 1, 2 from standing 4, 3 from standing 7. */
export const cardFloor = (standing: number): 1 | 2 | 3 => (standing >= 7 ? 3 : standing >= 4 ? 2 : 1)

/** The level floor of a delivered contract's unlocks: 1, 2 from 3 crates, 3 from 6. */
export const contractFloor = (crates: number): 1 | 2 | 3 => (crates >= 6 ? 3 : crates >= 3 ? 2 : 1)

/** A save's standing per company (XP), defaulted to 0 for any company it does not name. */
export type StandingXp = Readonly<Partial<Record<CompanyId, number>>>
export const standingOf = (xp: StandingXp, company: CompanyId): number => standingFor(Math.max(0, xp[company] ?? 0))
/** The best standing held with any company. */
export const topStanding = (xp: StandingXp): number => Math.max(0, ...COMPANY_IDS.map((c) => standingOf(xp, c)))

/** Whether `company` hires yet: Moonquill opens at standing 3 with any company. */
export function companyOpen(company: CompanyId, xp: StandingXp): boolean {
  const at = companyById(company).opensAt
  return !at || topStanding(xp) >= at
}

/**
 * Old Watch XP, spread over the companies (the meta migration): evenly, so a
 * veteran opens every road at the same standing rather than one road far
 * ahead of the rest. Every card and item kind the Watch unlocked is kept; the
 * spread XP deals no new ones (a level is only ever paid once, when it is
 * crossed by play).
 */
export function spreadWatchXp(watchXp: number): Record<CompanyId, number> {
  const each = Math.floor(Math.max(0, watchXp) / COMPANY_IDS.length)
  return Object.fromEntries(COMPANY_IDS.map((c) => [c, each])) as Record<CompanyId, number>
}

// ---------------------------------------------------------------------------
// The rolls
// ---------------------------------------------------------------------------

const skillLevel = (id: string): number => ALL_SKILLS.find((k) => k.id === id)?.level ?? 1
const skillCo = (id: string): CompanyId | undefined => ALL_SKILLS.find((k) => k.id === id)?.company
const kindLevel = (id: string): number => ITEM_KINDS.find((k) => k.id === id)?.level ?? 1
const kindCo = (id: string): CompanyId | undefined => ITEM_KINDS.find((k) => k.id === id)?.company

/**
 * One locked entry of `pool` for `company`, at `floor` or above if it can:
 * the company's own entries at the floor, then anyone's at the floor, then
 * the company's at any level, then anyone's — or null when nothing is locked.
 */
function rollCompanyPiece(o: {
  pool: readonly string[]
  have: readonly string[]
  company: CompanyId
  levelOf: (id: string) => number
  companyOf: (id: string) => CompanyId | undefined
  floor: number
  salt: readonly (string | number)[]
}): string | null {
  const own = (id: string) => o.companyOf(id) === o.company
  const tries: { filter?: (id: string) => boolean; minTier?: number }[] = [
    { filter: own, minTier: o.floor },
    { minTier: o.floor },
    { filter: own },
    {},
  ]
  for (const t of tries) {
    const got = rollFromPool({ pool: o.pool, have: o.have, tierOf: o.levelOf, ...t, salt: o.salt })
    if (got) return got
  }
  return null
}

/**
 * The kind of the Rare bonus item a standing level pays once the card pool is
 * exhausted (`track.trackPay` found no card or kind left): one of the kinds you own — the
 * company's own first, then any, then the basic five — a hash of its own
 * parts, never a run stream. The bonus item itself is dealt into the next
 * contract's pack (`hq.bonusItemsFor`), as a sealed crate's duplicate is.
 */
export function standingBonusKind(haveItems: readonly string[], company: CompanyId, standing: number, ...salt: (string | number)[]): string {
  const owned = new Set([...BASIC_ITEM_KINDS, ...haveItems])
  // Levels 1–3 only, in the catalogue's stable order: never a Sovereign kind.
  const pool = ITEM_KINDS.filter((k) => owned.has(k.id) && k.level <= 3).map((k) => k.id)
  const s = ['standing-bonus', company, standing, ...salt]
  return (
    rollFromPool({ pool, have: [], filter: (id) => kindCo(id) === company, salt: s }) ??
    rollFromPool({ pool, have: [], salt: s }) ??
    BASIC_ITEM_KINDS[0]
  )
}

/** A skill card a delivered contract unlocks (the contract's own, or a milestone's). */
export function rollContractSkill(have: readonly string[], company: CompanyId, crates: number, ...salt: (string | number)[]): string | null {
  return rollCompanyPiece({
    pool: RANDOM_UNLOCK_SKILLS,
    have,
    company,
    levelOf: skillLevel,
    companyOf: skillCo,
    floor: contractFloor(crates),
    salt: ['contract-skill', company, crates, ...salt],
  })
}

/** An item kind a delivered contract unlocks (its own item, or an item chance). */
export function rollContractItem(have: readonly string[], company: CompanyId, crates: number, ...salt: (string | number)[]): string | null {
  return rollCompanyPiece({
    pool: UNLOCK_ITEM_KINDS,
    have,
    company,
    levelOf: kindLevel,
    companyOf: kindCo,
    floor: contractFloor(crates),
    salt: ['contract-item', company, crates, ...salt],
  })
}

/** `n` rolls of `roll`, each onto what the ones before it opened. */
export function dealMany(have: readonly string[], n: number, roll: (have: readonly string[], i: number) => string | null): string[] {
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const got = roll([...have, ...out], i)
    if (!got) break
    out.push(got)
  }
  return out
}
