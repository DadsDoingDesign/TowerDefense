/**
 * Who joins the company, how trained they arrive, and how new bodies and new
 * items land on the roster. Pure — every random draw comes off the RNG the
 * caller passes (the run's loot stream), and every hub read arrives as an
 * argument, so the store and the balance harness price a hire identically.
 */
import type { RNG } from '../core/rng'
import { autoEquipEmpty } from '../engine/kit'
import { applyXp, xpToReach } from '../engine/leveling'
import { withFirstSkill } from './skills'
import { rollRecruitBody } from './heroes'
import { ALL_ITEM_KINDS } from '../data/itemKinds'
import type { Item, Sentinel } from '../types'
import { equipRules, withRelicStats } from './relics'

/** Candidates on a recruit node, an Endless room or the Crossroads. */
export const SLATE_SIZE = 3

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
  skillFor?: (heroId: string) => string | null
  /** The run's unlocked item kinds — what a hire can be rolled carrying. Absent: every kind. */
  itemPool?: readonly string[]
}

export function applyStatBonus(s: Sentinel, n: number): Sentinel {
  if (!n) return s
  return { ...s, stats: { str: s.stats.str + n, dex: s.stats.dex + n, int: s.stats.int + n } }
}

/**
 * A body joining the company: a random hero from the run's unlocked kinds
 * (`heroes.rollRecruitBody` — a common weapon, maybe a common off-hand piece),
 * named off the shared pool clear of `taken`. Every Sentinel who joins after
 * the leader — hub extras, hires, candidates — comes through here.
 */
export function armedSentinel(rng: RNG, itemPool: readonly string[] = ALL_ITEM_KINDS, taken: Iterable<string> = []): Sentinel {
  return rollRecruitBody(rng, itemPool, taken)
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
export function scaledRecruit(rng: RNG, roster: readonly Sentinel[], hub: RecruitHub, taken: Iterable<string> = roster.map((h) => h.name)): Sentinel {
  // Armed, not dressed: the rest of their kit comes out of the pack when they
  // join (`withRecruits`). A hire used to arrive with nothing at all while the
  // balance harness priced every hire as carrying a full opening kit.
  const armed = applyStatBonus(armedSentinel(rng, hub.itemPool, taken), hub.statBonus)
  const base = withFirstSkill(armed, hub.skillFor?.(armed.id) ?? null)
  if (!roster.length) return base
  const target = recruitTargetLevel(roster, hub.trained)
  return target <= 1 ? base : applyXp(base, xpToReach(target))
}

/** Three random candidates — the recruit node / room / crossroads slate. Named apart from each other and the roster. */
export function recruitSlate(rng: RNG, roster: readonly Sentinel[], hub: RecruitHub): Sentinel[] {
  const out: Sentinel[] = []
  for (let i = 0; i < SLATE_SIZE; i++) out.push(scaledRecruit(rng, roster, hub, [...roster, ...out].map((h) => h.name)))
  return out
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
export type SkillDealer = (heroId: string) => string | null

/** The hub's extra Sentinels: random hires from the run's kinds, each with its first skill. */
export function hubExtras(rng: RNG, n: number, skillFor?: SkillDealer, itemPool: readonly string[] = ALL_ITEM_KINDS, taken: string[] = []): Sentinel[] {
  const extra: Sentinel[] = []
  for (let i = 0; i < n; i++) {
    const s = armedSentinel(rng, itemPool, [...taken, ...extra.map((h) => h.name)])
    extra.push(withFirstSkill(s, skillFor?.(s.id) ?? null))
  }
  return extra
}

/**
 * Endless's starting company: three random heroes plus any extra the hub
 * grants, each a hire off the loot stream with its first skill, then the
 * hub's flat stats.
 */
export function buildStartingRoster(rng: RNG, bonuses: CompanyBonuses, skillFor?: SkillDealer, itemPool: readonly string[] = ALL_ITEM_KINDS): Sentinel[] {
  const company = hubExtras(rng, SLATE_SIZE + bonuses.extraSentinels, skillFor, itemPool)
  return company.map((s) => applyStatBonus(s, bonuses.statBonus))
}
