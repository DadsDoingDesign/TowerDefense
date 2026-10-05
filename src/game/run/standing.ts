/**
 * ---------------------------------------------------------------------------
 * Standing — how well a trade company knows your militia (build step 2)
 * ---------------------------------------------------------------------------
 *
 * Standing replaces the single Watch level, one track per company. Playing a
 * company's contracts earns standing XP with THAT company (the Watch XP
 * formula: depth reached, enemies felled, delivery). Each standing level
 * unlocks one random skill card — from that company's pool first, then from
 * any pool once its own is exhausted — and the card's level floor rises with
 * the standing ({@link cardFloor}). Standing also caps the stake
 * (`contracts.crateCap`: standing + 1 crates).
 *
 * Items unlock from contracts instead: a delivered contract opens one skill
 * and one item kind, plus the stake's item chances and milestone skills, at a
 * floor that rises with the stake ({@link contractFloor}).
 *
 * Every unlock goes through `watch.rollFromPool` — one generic roll, fed a
 * pool, a filter and a floor — and every roll is a hash of its salt, never a
 * run-stream draw.
 */
import { ALL_SKILLS, RANDOM_UNLOCK_SKILLS } from '../data/skills'
import { ITEM_KINDS, UNLOCK_ITEM_KINDS } from '../data/itemKinds'
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
 * XP from standing `s` to `s + 1`: 80, then 20 more a level (the Watch
 * level's curve, so a player who sticks to one company levels as fast as the
 * Watch did). Standing 10 costs 1,700 XP with one company: about seven
 * deliveries.
 */
export const standingCost = (s: number): number => watchLevelCost(Math.max(0, Math.floor(s)) + 1)

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

/** The skill card a standing level unlocks (reaching `standing` with `company`). */
export function rollStandingCard(have: readonly string[], company: CompanyId, standing: number, ...salt: (string | number)[]): string | null {
  return rollCompanyPiece({
    pool: RANDOM_UNLOCK_SKILLS,
    have,
    company,
    levelOf: skillLevel,
    companyOf: skillCo,
    floor: cardFloor(standing),
    salt: ['standing-card', company, standing, ...salt],
  })
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

/**
 * The endgame charter's door (build step 5 — a hook, nothing reads it yet):
 * it opens only when everything else is unlocked — every random skill card,
 * every item kind, and the highest standing with every company. `progress` is
 * the share of that catalogue a save holds, for the "Charter: 74%" meter the
 * spec asks for, so the goal reads as a goal rather than a secret.
 */
export function charterProgress(v: { skills: readonly string[]; items: readonly string[]; standing: StandingXp }): { progress: number; unlocked: boolean } {
  const skills = RANDOM_UNLOCK_SKILLS.filter((id) => v.skills.includes(id)).length
  const items = UNLOCK_ITEM_KINDS.filter((id) => v.items.includes(id)).length
  const levels = COMPANY_IDS.reduce((a, c) => a + standingOf(v.standing, c), 0)
  const have = skills + items + levels
  const need = RANDOM_UNLOCK_SKILLS.length + UNLOCK_ITEM_KINDS.length + COMPANY_IDS.length * MAX_STANDING
  return { progress: have / need, unlocked: have >= need }
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
