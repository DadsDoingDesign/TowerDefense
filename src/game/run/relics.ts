/**
 * Relics as the run applies them (Phase 3b). Pure: held relic ids and the run's
 * numbers in, the next numbers out — the store and the balance harness both
 * call these, so a relic's card and its effect cannot drift apart.
 */
import { generateItem, type EquipRules, type RarityPity, type RosterRef } from '../data/items'
import { hasRelicRule, relicById, relicPool, relicStatGrant } from '../data/relics'
import { nextId, type RNG } from '../core/rng'
import type { RewardCard } from '../data/rewards'
import type { ItemRarity, Sentinel } from '../types'

/** Gate a won fight restores under Field Surgeon's Kit. */
export const SURGEON_HEAL = 4
/** Gold a won fight pays under the Tithe Box. */
export const TITHE_GOLD = 25
/** XP multiplier for the lowest-level hero on the field under the War Diary. */
export const DIARY_XP = 1.5

/** A hero with the held stat relics' flat grants added (a hire joining a company). */
export function withRelicStats<T extends Pick<Sentinel, 'stats' | 'thorns' | 'patience'>>(s: T, held: readonly string[]): T {
  const g = relicStatGrant(held)
  if (!g.stats.str && !g.stats.dex && !g.stats.int && !g.thorns && !g.patience) return s
  return {
    ...s,
    stats: { str: s.stats.str + g.stats.str, dex: s.stats.dex + g.stats.dex, int: s.stats.int + g.stats.int },
    thorns: s.thorns + g.thorns,
    patience: s.patience + g.patience,
  }
}

/** The company after TAKING a relic: its flat grant lands on every hero now. */
export function takeRelicOn(roster: Sentinel[], relicId: string): Sentinel[] {
  return roster.map((s) => withRelicStats(s, [relicId]))
}

/** Gate and gold after a won campaign fight, with the run-rule relics applied. */
export function afterFightRelics(held: readonly string[], v: { baseHp: number; maxBaseHp: number; gold: number }): { baseHp: number; gold: number } {
  return {
    baseHp: hasRelicRule(held, 'fieldSurgeon') ? Math.min(v.maxBaseHp, v.baseHp + SURGEON_HEAL) : v.baseHp,
    gold: v.gold + (hasRelicRule(held, 'titheBox') ? TITHE_GOLD : 0),
  }
}

/** Whether hires arrive trained (Free Companies owned, or the Mercenary Charter held). */
export const hiresTrained = (hubTrained: boolean, held: readonly string[]): boolean =>
  hubTrained || hasRelicRule(held, 'mercenaryCharter')

/**
 * The run's equip rules: whether the company holds the Twinblade Harness
 * (round 3, Q4). Every equip path — the pack, the item panel's plan, a hire
 * dressing from the pack, auto-equip on a drop, the load-time check and the
 * balance model — reads it through here, and `items.heroSlotsFor` applies the
 * per-hero DEX check on top.
 */
export const equipRules = (held: readonly string[]): EquipRules => ({ twinblade: hasRelicRule(held, 'twinblade') })

/**
 * How many items a merchant lays out. Thin Pickings (Vow 1) halves the shelf,
 * 4 → 2 (5 → 3 with the Quartermaster's Seal). It took one item off until the
 * tuning lane raised `STOP_XP_SHARE` to 0.55: the extra stop levels substituted
 * for the lost card and shelf slot, and the rung's cost fell 5pt → 1.5pt, under
 * the 3pt REPORT §13 asks of every rung. Half the shelf reads −6.7pt on the
 * adaptive line (n=600) — "half the build", as the card says.
 */
export const shelfSize = (held: readonly string[], thinPickings = false): number =>
  (hasRelicRule(held, 'quartermaster') ? 5 : 4) - (thinPickings ? 2 : 0)

/** Whether this restock is free (the Seal's first one at each stall). */
export const restockFree = (held: readonly string[], rerolls: number): boolean =>
  hasRelicRule(held, 'quartermaster') && rerolls === 0

/**
 * The War Diary: the lowest-level FIELDED hero's share of a wave's XP ×1.5.
 * Ties go to the first on the field; the others are untouched.
 */
export function diaryXp<T extends { id: string; xpGained: number }>(awards: T[], roster: readonly Pick<Sentinel, 'id' | 'level'>[], held: readonly string[]): T[] {
  if (!hasRelicRule(held, 'warDiary') || !awards.length) return awards
  const level = (id: string) => roster.find((s) => s.id === id)?.level ?? 99
  let low = awards[0]
  for (const a of awards) if (level(a.id) < level(low.id)) low = a
  return awards.map((a) => (a === low ? { ...a, xpGained: Math.round(a.xpGained * DIARY_XP) } : a))
}

/** Relic-card rarity weights: the old stat-card table, luck tilting it up. */
const RARITY_WEIGHT: Record<ItemRarity, number> = { common: 40, rare: 34, epic: 18, legendary: 8, mythic: 0 }
function pickRarity(rng: RNG, luck: number): ItemRarity {
  const tiers: ItemRarity[] = ['common', 'rare', 'epic', 'legendary']
  const weights = tiers.map((t, i) => RARITY_WEIGHT[t] * (1 + luck * i))
  let roll = rng.range(0, weights.reduce((a, b) => a + b, 0))
  for (let i = 0; i < tiers.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return tiers[i]
  }
  return 'common'
}

/** A relic card, drawn at a rolled rarity from the pool (falling back to any tier). */
export function relicCard(rng: RNG, luck: number, pool: ReturnType<typeof relicPool>, exclude: Set<string>): RewardCard | null {
  const open = pool.filter((r) => !exclude.has(r.id))
  if (!open.length) return null
  const rarity = pickRarity(rng, luck)
  const tier = open.filter((r) => r.rarity === rarity)
  const r = rng.pick(tier.length ? tier : open)
  exclude.add(r.id)
  return {
    id: nextId('rw'),
    kind: 'relic',
    title: r.name,
    desc: r.desc,
    rarity: r.rarity,
    relic: r.id,
    ...(r.downside ? { downside: r.downside } : {}),
  }
}

export type HandKind = 'battle' | 'elite' | 'boss'

/**
 * The reward hand after a cleared campaign fight (Phase 3b):
 *
 *  - a battle: items and relics, half and half, at least one item (as the old
 *    stat/item hand was);
 *  - an elite: the same, but one card is always a relic;
 *  - an act boss: three relics — the act's prize.
 *
 * With the pool exhausted a relic slot falls back to an item, so a hand is
 * never short.
 */
/** How many cards a clear lays out: three, two under Vow 1 (Thin Pickings). */
export const handSize = (opts: { thinPickings: boolean }): number => (opts.thinPickings ? 2 : 3)

export function rewardHand(
  rng: RNG,
  opts: {
    kind: HandKind
    luck: number
    count: number
    held: readonly string[]
    unlocked?: (achievementId: string) => boolean
    roster?: readonly RosterRef[]
    pity?: RarityPity
    /** The run's unlocked item kinds (an item card deals only these). */
    kinds?: readonly string[]
    /** Vow 1 (Thin Pickings): a plain battle deals no relic. */
    noBattleRelics?: boolean
  },
): RewardCard[] {
  const pool = relicPool({ held: opts.held, unlocked: opts.unlocked })
  const used = new Set<string>()
  const kinds: ('item' | 'relic')[] = []
  for (let i = 0; i < opts.count; i++) kinds.push(opts.kind === 'boss' ? 'relic' : rng.chance(0.5) ? 'relic' : 'item')
  if (opts.kind === 'battle' && opts.noBattleRelics) kinds.fill('item')
  if (opts.kind !== 'boss' && !kinds.includes('item')) kinds[0] = 'item'
  if (opts.kind === 'elite' && !kinds.includes('relic')) kinds[kinds.length - 1] = 'relic'
  return kinds.map((k) => {
    if (k === 'relic') {
      const c = relicCard(rng, opts.luck, pool, used)
      if (c) return c
    }
    const item = generateItem(rng, { luck: opts.luck, roster: opts.roster, pity: opts.pity, commitPity: false, kinds: opts.kinds })
    return { id: nextId('rw'), kind: 'item', title: item.name, desc: '', rarity: item.rarity, item }
  })
}

/** The relic a card carries, if it is a relic card this build knows. */
export const cardRelic = (c: Pick<RewardCard, 'kind' | 'relic'>) => (c.kind === 'relic' && c.relic ? relicById(c.relic) : undefined)
