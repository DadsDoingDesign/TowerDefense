/**
 * Skills as the run applies them (SK1). Pure: a hero (and the run's seed and
 * skill pool) in, the choice it owes — or the hero after choosing — out. The
 * data is `data/skills.ts`; the store's `chooseSkill` / `chooseStatBump`, the
 * hero pick, the recruit stops and the balance harness all call these, so a
 * skill the UI offers is a skill the store accepts.
 *
 * ---- randomness, and why none of it touches a stream ----------------------
 *
 * RNG draw ORDER is behaviour in this codebase: one extra draw on the loot
 * stream re-deals every item after it. So nothing here draws from a run
 * stream. Every roll is a FRESH generator seeded by a hash of what it is for:
 *
 *  - the three heroes on offer: `(runSeed, 'heroes')` (`run/heroes.ts`);
 *  - a hire's skill: `(runSeed, 'recruit-skill', heroId)`;
 *  - a milestone's offer: `(runSeed, 'skills', heroId, milestoneLevel)`.
 *
 * Each is a pure function of facts the run already keeps (its seed, the hero's
 * id, the run's skill pool), so the same seed — a Daily, a typed seed —
 * deals the same heroes and the same offers, a reload re-shows the offer it
 * showed, and no existing draw moves by one place.
 */
import { hashSeed, RNG } from '../core/rng'
import {
  ALL_SKILLS,
  BUMP_AMOUNT,
  EVOLUTION_TO_SKILL,
  PERK_TO_SKILL,
  skillById,
  type BumpStat,
  type Skill,
  type SkillLevel,
} from '../data/skills'
import type { Archetype, CoreStats, Sentinel } from '../types'

/** The hero levels a skill offer arrives at; the tier offered is the index + 1. */
export const SKILL_MILESTONES = [5, 10, 15] as const
/** A hero equips at most this many skills. */
export const MAX_SKILLS = 3
/** Skills on one offer. */
export const OFFER_SIZE = 3

export interface Milestone {
  /** 0, 1 or 2 — how many milestones the hero has already settled. */
  index: number
  /** The hero level it arrives at: 5, 10 or 15. */
  level: number
  /** The skill level it offers: 1, 2 or 3. */
  tier: SkillLevel
}

type Grower = Pick<Sentinel, 'id' | 'level' | 'skills' | 'skillPicks'>

const done = (s: Pick<Sentinel, 'skillPicks'>): number => Math.max(0, Math.min(SKILL_MILESTONES.length, Math.floor(s.skillPicks ?? 0)))

/** The milestone this hero has reached and not yet settled, or null. Taken in order. */
export function pendingMilestone(s: Pick<Sentinel, 'level' | 'skillPicks'>): Milestone | null {
  const i = done(s)
  if (i >= SKILL_MILESTONES.length) return null
  const level = SKILL_MILESTONES[i]
  return s.level >= level ? { index: i, level, tier: (i + 1) as SkillLevel } : null
}

/** The next milestone ahead of the hero (reached or not), or null after level 15's. */
export function nextMilestone(s: Pick<Sentinel, 'skillPicks'>): Milestone | null {
  const i = done(s)
  return i >= SKILL_MILESTONES.length ? null : { index: i, level: SKILL_MILESTONES[i], tier: (i + 1) as SkillLevel }
}

/**
 * Draw `n` distinct entries of `src` off `rng`, kept in `src`'s order. An
 * entry `src` holds more than once (a company's piece on its own route,
 * `contracts.weightPool`) is that many times as likely to be drawn, and every
 * copy leaves with it. With no repeats this is the draw it always was.
 */
export function drawDistinct<T>(rng: RNG, src: readonly T[], n: number): T[] {
  let left = [...src]
  const picked = new Set<T>()
  while (picked.size < n && left.length) {
    const x = left[Math.floor(rng.next() * left.length)]
    picked.add(x)
    left = left.filter((y) => y !== x)
  }
  return src.filter((x, i) => picked.has(x) && src.indexOf(x) === i)
}

/**
 * The skills of `tier` in `pool`, in library order (any hero may hold any
 * skill) — each as many times as the pool holds it, so a weighted pool deals
 * by weight. An unweighted pool lists each once, as it always did.
 */
export function poolFor(pool: readonly string[], tier: SkillLevel, except: readonly string[] = []): Skill[] {
  const count = new Map<string, number>()
  for (const id of pool) count.set(id, (count.get(id) ?? 0) + 1)
  const skip = new Set(except)
  return ALL_SKILLS.flatMap((k) => (k.level === tier && !skip.has(k.id) ? Array<Skill>(count.get(k.id) ?? 0).fill(k) : []))
}

/**
 * The skills a hero is offered at its owed milestone: up to three of that
 * milestone's level, from the run's pool, that it does not already hold.
 * Empty when nothing is owed.
 */
export function skillOffer(hero: Grower, pool: readonly string[], runSeed: number): Skill[] {
  const m = pendingMilestone(hero)
  if (!m) return []
  const cands = poolFor(pool, m.tier, hero.skills ?? [])
  return drawDistinct(new RNG(hashSeed(runSeed, 'skills', hero.id, m.level)), cands, OFFER_SIZE)
}

/** True when the hero's skill slots are all taken: a new skill must replace one. */
export const slotsFull = (hero: Pick<Sentinel, 'skills'>): boolean => (hero.skills?.length ?? 0) >= MAX_SKILLS

/**
 * Whether the stat bump is on the table at this milestone. It is the full
 * hero's alternative to a swap (the spec), and it also fills an offer the pool
 * cannot: a milestone always has three things to choose from.
 */
export function bumpOffered(hero: Grower, pool: readonly string[], runSeed: number): boolean {
  if (!pendingMilestone(hero)) return false
  return slotsFull(hero) || skillOffer(hero, pool, runSeed).length < OFFER_SIZE
}

/** The bump this milestone pays: +N to one stat, by its level. */
export const bumpAmount = (m: Pick<Milestone, 'tier'>): number => BUMP_AMOUNT[m.tier]

/**
 * The hero after taking `skillId` at its owed milestone — or null when that
 * skill is not on its offer, or the hero is full and `drop` names none of its
 * skills. A full hero swaps: `drop` leaves, the new skill takes its place.
 */
export function takeSkill<T extends Grower>(hero: T, skillId: string, pool: readonly string[], runSeed: number, drop?: string | null): T | null {
  if (!skillOffer(hero, pool, runSeed).some((k) => k.id === skillId)) return null
  const have = hero.skills ?? []
  let skills: string[]
  if (slotsFull(hero)) {
    if (!drop || !have.includes(drop)) return null
    skills = have.map((id) => (id === drop ? skillId : id))
  } else {
    skills = [...have, skillId]
  }
  return { ...hero, skills, skillPicks: done(hero) + 1 }
}

/** The hero after taking the stat bump at its owed milestone, or null when it is not offered. */
export function takeBump<T extends Grower & Pick<Sentinel, 'stats'>>(hero: T, stat: BumpStat, pool: readonly string[], runSeed: number): T | null {
  const m = pendingMilestone(hero)
  if (!m || !bumpOffered(hero, pool, runSeed) || !['str', 'dex', 'int'].includes(stat)) return null
  const stats: CoreStats = { ...hero.stats, [stat]: hero.stats[stat] + bumpAmount(m) }
  return { ...hero, stats, skillPicks: done(hero) + 1 }
}

// ---------------------------------------------------------------------------
// Dealing a hero its first skill
// ---------------------------------------------------------------------------

/** The Level 1 skill a hire arrives with: one random Level 1 card from the pool. */
export function recruitSkill(runSeed: number, heroId: string, pool: readonly string[]): string | null {
  const fits = poolFor(pool, 1)
  if (!fits.length) return null
  return fits[Math.floor(new RNG(hashSeed(runSeed, 'recruit-skill', heroId)).next() * fits.length)].id
}

/** A fresh hero with its first skill (no milestone is settled by it). */
export function withFirstSkill<T extends Pick<Sentinel, 'skills'>>(hero: T, skill: string | null): T {
  return skill ? { ...hero, skills: [skill] } : hero
}

// ---------------------------------------------------------------------------
// Old saves: perks and evolutions become skills
// ---------------------------------------------------------------------------

/** The class's main stat — where a perk or evolution with no skill slot left goes. */
const MAIN_STAT: Record<Archetype, BumpStat> = { fighter: 'str', rogue: 'dex', mystic: 'int' }

export interface LegacyGrowth {
  archetype: Archetype
  level: number
  branchPath?: readonly string[]
  perks?: readonly string[]
  skills?: readonly string[]
  skillPicks?: number
  stats: CoreStats
}

/**
 * A hero saved before skills (SK1): its perks and evolutions become skills,
 * in the order it chose them (level-5 perk, level-10 evolution, level-15 perk,
 * level-20 specialization). Each maps through `PERK_TO_SKILL` /
 * `EVOLUTION_TO_SKILL`; a duplicate, or one past the three slots, becomes the
 * stat bump of its milestone on the class's main stat instead, so nothing the
 * hero earned is lost. The evolution's own stat grant was paid into `stats`
 * when it evolved, so it stays.
 *
 * `skillPicks` counts the old CHOICES made at 5, 10 and 15, so a hero that had
 * not yet chosen its level-15 perk is still owed its level-15 skill.
 */
export function migrateGrowth(h: LegacyGrowth): { skills: string[]; skillPicks: number; stats: CoreStats } {
  const perks = h.perks ?? []
  const path = h.branchPath ?? []
  const steps: { skill: string | undefined; tier: SkillLevel }[] = []
  if (perks[0]) steps.push({ skill: PERK_TO_SKILL[perks[0]], tier: 1 })
  if (path[1]) steps.push({ skill: EVOLUTION_TO_SKILL[path[1]], tier: 2 })
  if (perks[1]) steps.push({ skill: PERK_TO_SKILL[perks[1]], tier: 3 })
  if (path[2]) steps.push({ skill: EVOLUTION_TO_SKILL[path[2]], tier: 3 })
  const skills = [...(h.skills ?? [])].filter((id) => !!skillById(id))
  const stats = { ...h.stats }
  for (const s of steps) {
    const k = s.skill ? skillById(s.skill) : undefined
    if (k && !skills.includes(k.id) && skills.length < MAX_SKILLS) skills.push(k.id)
    else stats[MAIN_STAT[h.archetype]] += BUMP_AMOUNT[s.tier]
  }
  const old = (perks.length >= 1 ? 1 : 0) + (path.length >= 2 ? 1 : 0) + (perks.length >= 2 ? 1 : 0)
  const reached = SKILL_MILESTONES.filter((l) => h.level >= l).length
  const skillPicks = Math.max(Math.floor(h.skillPicks ?? 0), Math.min(reached, old))
  return { skills, skillPicks: Math.min(SKILL_MILESTONES.length, skillPicks), stats }
}
