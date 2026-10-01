/**
 * Who joins the company, how trained they arrive, and how new bodies and new
 * items land on the roster. Pure — every random draw comes off the RNG the
 * caller passes (the run's loot stream), and every hub read arrives as an
 * argument, so the store and the balance harness price a hire identically.
 */
import type { RNG } from '../core/rng'
import { autoEquipEmpty, recruitKit, wearKit } from '../engine/kit'
import { applyXp, xpToReach } from '../engine/leveling'
import { withFirstSkill } from './skills'
import { createSentinel, startingRoster } from '../data/sentinels'
import type { Archetype, Item, Sentinel } from '../types'
import { equipRules, withRelicStats } from './relics'

/** Every archetype, in the order every recruit slate is dealt. */
export const RECRUIT_ARCHETYPES: readonly Archetype[] = ['fighter', 'rogue', 'mystic']

/** The hub bonuses a starting company reads (a subset of `metaStore.MetaBonuses`). */
export interface CompanyBonuses {
  statBonus: number
  extraSentinels: number
}

/** What a hire needs to know about the hub. */
export interface RecruitHub {
  /** Seasoned Recruits: flat +n to every stat. */
  statBonus: number
  /** Free Companies: hires arrive at the roster's median rather than three back. */
  trained: boolean
  /**
   * SK1: the Level 1 skill a hire arrives with — `run/skills.recruitSkill`
   * over the run's seed and skill pool. A hash of the hire's id, never a draw
   * on the loot stream, so dealing it moves no other roll. Absent: no skill.
   */
  skillFor?: (heroId: string, archetype: Archetype) => string | null
}

export function applyStatBonus(s: Sentinel, n: number): Sentinel {
  if (!n) return s
  return { ...s, stats: { str: s.stats.str + n, dex: s.stats.dex + n, int: s.stats.int + n } }
}

/**
 * A body joining the company, carrying what `RECRUIT_KIT` hands it (a common
 * weapon of its own damage type). Every Sentinel who joins after the leader —
 * hub extras, hires, candidates — comes through here.
 */
export function armedSentinel(rng: RNG, archetype: Archetype): Sentinel {
  return wearKit(createSentinel(archetype), recruitKit(rng, archetype))
}

/**
 * The level a mid-run hire arrives at (M17): the roster's median, minus three
 * unless Free Companies is owned; never below 1. The balance harness models a
 * hire with this same function.
 */
export function recruitTargetLevel(roster: readonly Pick<Sentinel, 'level'>[], trained = false): number {
  if (!roster.length) return 1
  const levels = roster.map((s) => s.level).sort((a, b) => a - b)
  const median = levels[Math.floor(levels.length / 2)]
  return Math.max(1, trained ? median : median - 3)
}

/**
 * A recruit who has actually been fighting a war (M17).
 *
 * A mercenary you hire at the front is a veteran of somewhere else, so they
 * arrive trained to just behind the company they are joining (three levels
 * back), and `Free Companies` closes that gap entirely. (Hires used to arrive at
 * level 1 with no gear while costing a ×1.05 Threat tax — a strictly bad deal
 * past depth 6.)
 *
 * They arrive with one Level 1 skill (SK1, `hub.skillFor`), and with any skill
 * milestone their level has passed still OWED: the choice belongs to the
 * player, and the level-up surfaces offer it like any other.
 *
 * **Seasoned Recruits applies here too (M18).** Every mid-run body comes
 * through this one funnel (crossroads, recruit node, merchant, endless room,
 * and the endless fallback hire), so applying the hub's stat bonus here covers
 * all five sites at once and cannot be forgotten by the next one that is added.
 */
export function scaledRecruit(rng: RNG, archetype: Archetype, roster: readonly Sentinel[], hub: RecruitHub): Sentinel {
  // Armed, not dressed: the rest of their kit comes out of the pack when they
  // join (`withRecruits`). A hire used to arrive with nothing at all while the
  // balance harness priced every hire as carrying a full opening kit.
  const armed = applyStatBonus(armedSentinel(rng, archetype), hub.statBonus)
  const base = withFirstSkill(armed, hub.skillFor?.(armed.id, archetype) ?? null)
  if (!roster.length) return base
  const target = recruitTargetLevel(roster, hub.trained)
  return target <= 1 ? base : applyXp(base, xpToReach(target))
}

/** One scaled candidate per archetype — the recruit node / room / crossroads slate. */
export function recruitSlate(rng: RNG, roster: readonly Sentinel[], hub: RecruitHub): Sentinel[] {
  return RECRUIT_ARCHETYPES.map((a) => scaledRecruit(rng, a, roster, hub))
}

/**
 * Add hires to the roster and dress their empty slots from the pack. Only
 * EMPTY slots are filled, and only with strict upgrades (`autoEquipEmpty`) —
 * nothing anyone is wearing moves.
 */
export function withRecruits(
  roster: Sentinel[],
  hires: Sentinel[],
  inventory: Item[],
  relics: readonly string[] = [],
): { roster: Sentinel[]; inventory: Item[] } {
  let pack = inventory
  const dressed = hires.map((h) => {
    // A stat relic is "every hero, hires included" (Phase 3b).
    const r = autoEquipEmpty([withRelicStats(h, relics)], pack, equipRules(relics))
    pack = r.rest
    return r.roster[0]
  })
  return { roster: [...roster, ...dressed], inventory: pack }
}

/**
 * New items into the run: each drops into the empty slot it strictly improves
 * most, anywhere on the roster; the rest go to the pack. Never replaces
 * anything worn (`engine/kit.autoEquipEmpty`).
 */
export function receiveItems(
  roster: Sentinel[],
  inventory: Item[],
  items: Item[],
  relics: readonly string[] = [],
): { roster: Sentinel[]; inventory: Item[] } {
  if (!items.length) return { roster, inventory }
  const r = autoEquipEmpty(roster, items, equipRules(relics))
  return { roster: r.roster, inventory: [...inventory, ...r.rest] }
}

/** Deals a body its first skill (SK1) — `RecruitHub.skillFor`'s shape. */
export type SkillDealer = (heroId: string, archetype: Archetype) => string | null

/** The hub's extra Sentinels, armed, cycling fighter → rogue → mystic, each with its first skill. */
export function hubExtras(rng: RNG, n: number, skillFor?: SkillDealer): Sentinel[] {
  const extra: Sentinel[] = []
  for (let i = 0; i < n; i++) {
    const s = armedSentinel(rng, RECRUIT_ARCHETYPES[i % 3])
    extra.push(withFirstSkill(s, skillFor?.(s.id, s.archetype) ?? null))
  }
  return extra
}

/** Endless starting roster including any meta bonuses (extra Sentinels + flat stats), each with its first skill. */
export function buildStartingRoster(rng: RNG, bonuses: CompanyBonuses, skillFor?: SkillDealer): Sentinel[] {
  const extra = hubExtras(rng, bonuses.extraSentinels, skillFor)
  const core = startingRoster().map((s) => withFirstSkill(s, skillFor?.(s.id, s.archetype) ?? null))
  return [...core, ...extra].map((s) => applyStatBonus(s, bonuses.statBonus))
}
