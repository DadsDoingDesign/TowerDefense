/**
 * ---------------------------------------------------------------------------
 * The mercenary company's headquarters (build step 3)
 * ---------------------------------------------------------------------------
 *
 * The HQ replaces the Watchtower: one place, three offices, every purchase
 * paid from the bank (`metaStore.bank`) and kept for good.
 *
 *  - **HR** — the opening deal: better first heroes ({@link DEAL_STEPS}), and
 *    the Hiring Hall (the old hub service, folded in).
 *  - **Finance** — the bank: gold left at home earns interest at the end of
 *    every FINISHED contract (delivered or cashed out, never lost), capped per
 *    contract so it never out-earns a stake ({@link INTEREST}).
 *  - **Operations** — pack slots, fewer boulders on the fields, company focus
 *    (one company at a time), and the scouts (the old map services, folded in).
 *
 * Also here, because it is the HQ's ledger too:
 *
 *  - **Road gold** ({@link homeGold}): what is left of the purse comes home in
 *    full; of the gold the road paid, only {@link ROAD_SHARE} does. City pay is
 *    banked in full by the contract (`run/contracts`).
 *  - **Sealed crates** (the item pull, {@link rollPull}): a gamble on a random
 *    item kind, its odds lifted by standing; a duplicate is a bonus item in the
 *    next run.
 *
 * Pure: no store, no React, no DOM, no run-stream draw. Every roll here is a
 * fresh generator hashed from its own parts (RNG draw order is behaviour).
 */
import { hashSeed, RNG } from '../core/rng'
import { COMPANY_IDS, type CompanyId } from '../data/companies'
import { itemKindById, UNLOCK_ITEM_KINDS } from '../data/itemKinds'
import { generateItem, ITEM_BASES } from '../data/items'
import type { Item } from '../types'
import { standingOf, type StandingXp } from './standing'

const whole = (n: unknown): number => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0
  return Math.max(0, Math.floor(v))
}

// ---------------------------------------------------------------------------
// 0. Road gold comes home, taxed (the designer's decision)
// ---------------------------------------------------------------------------

/**
 * The share of the road's gold that comes home at the end of a run. The rest
 * stays on the road (spent on the way home, paid out to the crew — the game
 * does not say; it says the share). Tunable: the tuning pass owns it.
 */
export const ROAD_SHARE = 0.25

/** What a run's purse is worth to the bank when it ends. */
export interface HomeGold {
  /** The purse it set out with. */
  purse: number
  /** What is left of that purse — home in full. */
  purseBack: number
  /** Gold the road paid that is still in the purse. */
  road: number
  /** The share of it that comes home ({@link ROAD_SHARE}). */
  roadBanked: number
  /** The share, as a whole percent, for the receipt. */
  pct: number
}

/**
 * Split a run's gold into the purse it set out with and the gold the road
 * paid, and say what comes home.
 *
 * **Spending comes out of the purse first.** A merchant is paid from the purse
 * you brought before any gold the road paid you, so `purseBack` is the purse
 * less everything spent (never below 0), and the rest of the gold in hand is
 * road gold. That makes the split depend only on three totals — the purse, the
 * gold earned on the road, the gold in hand — never on the order things
 * happened in, and no payload can claim more of its gold is purse than the
 * purse it set out with.
 */
export function homeGold(v: { purse: number; earned: number; gold: number }, share = ROAD_SHARE): HomeGold {
  const purse = whole(v.purse)
  const gold = whole(v.gold)
  const spent = Math.max(0, purse + whole(v.earned) - gold)
  const purseBack = Math.min(gold, Math.max(0, purse - spent))
  const road = gold - purseBack
  const s = Math.max(0, Math.min(1, share))
  return { purse, purseBack, road, roadBanked: Math.floor(road * s), pct: Math.round(s * 100) }
}

/** Everything a run's purse puts back in the bank. */
export const homeTotal = (h: Pick<HomeGold, 'purseBack' | 'roadBanked'>): number => h.purseBack + h.roadBanked

// ---------------------------------------------------------------------------
// The offices and their prices
// ---------------------------------------------------------------------------

export type HqId = 'deal' | 'hiring' | 'rate' | 'pack' | 'rocks' | 'focus' | 'scouting'
export type Office = 'hr' | 'finance' | 'ops'

export interface HqUpgrade {
  id: HqId
  office: Office
  /** The card's title. */
  name: string
  /** The price of each level, in gold from the bank: `costs[k]` buys level k + 1. */
  costs: readonly number[]
}

/**
 * Every permanent HQ purchase. Placeholders the tuning pass will move; what
 * each was priced against is beside it.
 *
 * A finished escort run banks roughly 450 gold under the road-gold share (the
 * cities' ~90 + a quarter of ~1,400 road gold, REPORT §13), so the HQ's whole
 * catalogue (~8,800) is twenty-odd runs of saving, and no single level costs
 * more than three runs.
 */
export const HQ_UPGRADES: readonly HqUpgrade[] = [
  { id: 'deal', office: 'hr', name: 'Opening deal', costs: [150, 300, 500, 800, 1200] },
  { id: 'hiring', office: 'hr', name: 'Hiring Hall', costs: [180] },
  { id: 'rate', office: 'finance', name: 'Interest', costs: [200, 400, 700] },
  { id: 'pack', office: 'ops', name: 'Pack slots', costs: [150, 250, 350, 450] },
  { id: 'rocks', office: 'ops', name: 'Fewer boulders', costs: [250, 450, 700] },
  { id: 'focus', office: 'ops', name: 'Company focus', costs: [250, 500, 800] },
  { id: 'scouting', office: 'ops', name: 'Scouts', costs: [150, 200] },
]
export const HQ_IDS: readonly HqId[] = HQ_UPGRADES.map((u) => u.id)
const HQ_BY_ID = new Map(HQ_UPGRADES.map((u) => [u.id, u]))
export const hqUpgrade = (id: string): HqUpgrade | undefined => HQ_BY_ID.get(id as HqId)
export const isHqId = (v: unknown): v is HqId => typeof v === 'string' && HQ_BY_ID.has(v as HqId)
/** The top level of a purchase. */
export const hqMax = (id: HqId): number => HQ_BY_ID.get(id)?.costs.length ?? 0
/** The price of the NEXT level from `level`, or null when it is maxed. */
export const hqCost = (id: HqId, level: number): number | null => HQ_BY_ID.get(id)?.costs[whole(level)] ?? null

/** A save's HQ levels, each clamped to its purchase's range (unknown ids dropped). */
export type HqLevels = Partial<Record<HqId, number>>
export const hqLevel = (levels: Readonly<Record<string, number>> | undefined, id: HqId): number =>
  Math.min(hqMax(id), whole(levels?.[id]))

// ---------------------------------------------------------------------------
// HR — the opening deal
// ---------------------------------------------------------------------------

/** How a run's hero pick is dealt. Level 0 is the deal every new militia gets. */
export interface DealRules {
  /** Heroes on the pick. */
  pick: number
  /** Every hero carries a body piece, and an off-hand piece when a hand is free. */
  dressed: boolean
  /** Body pieces arrive Rare (Common at level 0). */
  rareBody: boolean
  /** One hero of the pick starts with a Level 2 skill instead of a Level 1. */
  skill2: boolean
  /** A second hero (a random hire) marches with the one you pick. */
  second: boolean
}

export const BASE_DEAL: DealRules = { pick: 3, dressed: false, rareBody: false, skill2: false, second: false }

/**
 * One line per level, each a whole, plain improvement to the first heroes —
 * read in order, each adds to the ones before it.
 */
export const DEAL_STEPS: readonly { line: string; rules: Partial<DealRules> }[] = [
  { line: 'Every hero comes with body armour, and an off-hand piece if a hand is free.', rules: { dressed: true } },
  { line: 'Body armour arrives Rare.', rules: { rareBody: true } },
  { line: 'Pick 1 of 4 heroes.', rules: { pick: 4 } },
  { line: 'One of them starts with a Level 2 skill.', rules: { skill2: true } },
  { line: 'A second hero marches with the one you pick.', rules: { second: true } },
]

/** The deal at an Opening deal level. */
export function dealRules(level: number): DealRules {
  const n = Math.min(DEAL_STEPS.length, whole(level))
  return DEAL_STEPS.slice(0, n).reduce<DealRules>((r, s) => ({ ...r, ...s.rules }), { ...BASE_DEAL })
}

/** The deal now, as one line ("Pick 1 of 3 · dressed …"). */
export function dealSummary(level: number): string {
  const r = dealRules(level)
  const parts = [`Pick 1 of ${r.pick}`]
  if (r.dressed) parts.push(r.rareBody ? 'Rare body armour' : 'body armour')
  if (r.skill2) parts.push('one with a Level 2 skill')
  if (r.second) parts.push('a second hero')
  return parts.join(' · ')
}

// ---------------------------------------------------------------------------
// Finance — interest on the bank
// ---------------------------------------------------------------------------

/**
 * Interest by Finance level: a rate on the gold left in the bank, and the most
 * one contract can pay. Every cap is reached at {@link INTEREST_FULL_AT} gold.
 *
 * **Why 50 at most.** The smallest stake — one crate, 50 gold — adds about
 * +55 gold to a contract's expected pay over the free escort (REPORT §13,
 * cash-out line, delivery ~20%), and +90 when it is delivered (it sells for
 * 100 and adds 40 to the completion bonus). So even the top cap is below what
 * one crate adds, on average and on delivery: the bank never out-earns a
 * stake, and the bank only pays on contracts you finish.
 */
export const INTEREST: readonly { rate: number; cap: number }[] = [
  { rate: 0.02, cap: 20 },
  { rate: 0.03, cap: 30 },
  { rate: 0.04, cap: 40 },
  { rate: 0.05, cap: 50 },
]
/** The bank at which every rate meets its cap. */
export const INTEREST_FULL_AT = 1000

export const interestTerms = (level: number): { rate: number; cap: number } => INTEREST[Math.min(INTEREST.length - 1, whole(level))]

/** What a finished contract pays on `bank` gold left at home. */
export function interestFor(bank: number, level: number): number {
  const t = interestTerms(level)
  return Math.min(t.cap, Math.floor(whole(bank) * t.rate))
}

/** Which ends earn interest: a finished contract, never a lost one. */
export const earnsInterest = (status: 'delivered' | 'cashedOut' | 'lost' | 'open'): boolean => status === 'delivered' || status === 'cashedOut'

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/** Pack slots a new militia has; each Pack slots level adds one. */
export const PACK_BASE = 6
export const packSlots = (level: number): number => PACK_BASE + Math.min(hqMax('pack'), whole(level))

/**
 * Boulders. Every battle's field lays {@link OBSTACLES} seeded boulder patches
 * (`data/hazards.ts`); each "Fewer boulders" level takes one away for good,
 * and a paid order clears {@link ROCK_ORDER_CUT} more for one contract. The
 * field always keeps `hazards.MIN_OBSTACLES` of them, and a quarry road's own
 * extra boulders (its route ground) are never cleared.
 */
export const ROCK_ORDER_CUT = 2
export const ROCK_ORDER_PRICE = 60
export const rocksCut = (level: number, ordered: boolean): number => Math.min(hqMax('rocks'), whole(level)) + (ordered ? ROCK_ORDER_CUT : 0)

/**
 * Company focus: ONE company at a time. Each level adds {@link FOCUS_STEP}
 * percentage points to that company's share of a run's dealing pools (its
 * skills and its item kinds); a paid order adds one step more for one
 * contract. A share is never pushed past {@link FOCUS_MAX_SHARE}% — the other
 * companies' pieces always still turn up.
 */
export const FOCUS_STEP = 15
export const FOCUS_ORDER_PRICE = 50
export const FOCUS_MAX_SHARE = 90
export const focusBoost = (level: number, ordered: boolean): number =>
  FOCUS_STEP * (Math.min(hqMax('focus'), whole(level)) + (ordered ? 1 : 0))

/** What the scouts open, by level: a way round every ambush, then wider roads. */
export const scoutsAt = (level: number): { standingOrders: boolean; wideMap: boolean } => ({
  standingOrders: whole(level) >= 1,
  wideMap: whole(level) >= 2,
})

/** The orders a run can be sent out with, paid for once, at the HQ. */
export interface HqOrders {
  /** Clear {@link ROCK_ORDER_CUT} more boulders from every field of the next contract. */
  rocks: boolean
  /** One more focus step for the next contract. */
  focus: boolean
}
export const NO_ORDERS: HqOrders = { rocks: false, focus: false }

/**
 * What the HQ gives one run, frozen on its contract when the run begins — a
 * purchase made while a run is saved never changes that run.
 */
export interface RunHq {
  /** Seeded boulder patches cleared from every field. */
  rocks: number
  /** The focused company, or null. */
  focus: CompanyId | null
  /** Its focus, in percentage points of the pool (0 with no company). */
  boost: number
  /** Pack slots. */
  pack: number
}
export const BASE_RUN_HQ: RunHq = { rocks: 0, focus: null, boost: 0, pack: PACK_BASE }

/** The run terms the HQ gives a contract beginning now. */
export function runHqFor(levels: Readonly<Record<string, number>>, focus: CompanyId | null, orders: HqOrders): RunHq {
  return {
    rocks: rocksCut(hqLevel(levels, 'rocks'), orders.rocks),
    focus,
    boost: focus ? focusBoost(hqLevel(levels, 'focus'), orders.focus) : 0,
    pack: packSlots(hqLevel(levels, 'pack')),
  }
}

/** The most a run's HQ terms can hold — the snapshot's clamp. */
export const MAX_ROCKS_CUT = 3 + ROCK_ORDER_CUT
export const MAX_FOCUS_BOOST = FOCUS_STEP * 4
export const MAX_PACK = PACK_BASE + 4

// ---------------------------------------------------------------------------
// The old hub, folded into the offices
// ---------------------------------------------------------------------------

/** What each old Watchtower purchase cost (level k cost `base + step·k`), for the refund. */
const OLD_HUB: Record<string, { base: number; step: number; max: number }> = {
  base: { base: 60, step: 40, max: 2 },
  gold: { base: 50, step: 30, max: 2 },
  stats: { base: 80, step: 50, max: 2 },
  roster: { base: 150, step: 150, max: 1 },
  loot: { base: 70, step: 60, max: 1 },
  cartographer: { base: 120, step: 0, max: 1 },
  freeCompanies: { base: 180, step: 0, max: 1 },
  standingOrders: { base: 160, step: 0, max: 1 },
  fieldKitchen: { base: 220, step: 0, max: 1 },
  cartulary: { base: 260, step: 0, max: 1 },
}

/** What `level` levels of an old purchase cost in all. */
function oldPaid(id: string, level: number): number {
  const u = OLD_HUB[id]
  if (!u) return 0
  let t = 0
  for (let k = 0; k < Math.min(u.max, whole(level)); k++) t += u.base + u.step * k
  return t
}

/**
 * The meta migration's fold (v9). What maps one to one onto an office is
 * kept; everything else is refunded to the bank at what it cost:
 *
 *  - **Hiring Hall** (`freeCompanies`) → HR's Hiring Hall, kept.
 *  - **Scout Reports** (`standingOrders`) → Operations' Scouts level 1, kept;
 *    with **Cartographer's Table** as well → Scouts level 2. A Cartographer
 *    bought without Scout Reports is refunded (its level needs the first).
 *  - Refunded: Reinforced Wagons, War Chest, Seasoned Recruits, Reserve
 *    Squad, Quartermaster, Field Kitchen, Relic Cartulary.
 */
export function foldOldHub(old: Readonly<Record<string, number>>): { levels: HqLevels; refund: number } {
  const lv = (id: string) => Math.min(OLD_HUB[id]?.max ?? 0, whole(old[id]))
  const levels: HqLevels = {}
  let refund = 0
  if (lv('freeCompanies')) levels.hiring = 1
  if (lv('standingOrders')) levels.scouting = lv('cartographer') ? 2 : 1
  else refund += oldPaid('cartographer', lv('cartographer'))
  for (const id of ['base', 'gold', 'stats', 'roster', 'loot', 'fieldKitchen', 'cartulary']) refund += oldPaid(id, lv(id))
  return { levels, refund }
}

// ---------------------------------------------------------------------------
// Sealed crates — the item pull
// ---------------------------------------------------------------------------

/**
 * One crate's price. Priced against play: a finished escort run banks ~450
 * gold (`HQ_UPGRADES`), and a delivered contract opens an item kind for free,
 * so a crate is about a run's savings for one roll that may be a duplicate —
 * playing stays the surer way to unlock gear, and the crate is a side bet.
 */
export const PULL_PRICE = 500

/** The odds of each Level, in whole percent, before standing lifts them. */
export const PULL_BASE: readonly [number, number, number] = [70, 22, 8]
/** The most points standing can move off Level 1. */
export const PULL_LIFT_MAX = 30

/** Standing levels across every company: each one moves a point off Level 1. */
export function pullLift(standing: StandingXp): number {
  return Math.min(PULL_LIFT_MAX, COMPANY_IDS.reduce((a, c) => a + standingOf(standing, c), 0))
}

/** The odds of a Level 1, 2 or 3 kind, in whole percent (they sum to 100). */
export function pullOdds(lift: number): [number, number, number] {
  const l = Math.min(PULL_LIFT_MAX, whole(lift))
  const toTwo = Math.round((l * 2) / 3)
  return [PULL_BASE[0] - l, PULL_BASE[1] + toTwo, PULL_BASE[2] + (l - toTwo)]
}

/** Every kind a crate can hold at a Level: the unlockable kinds (never the basic five). */
export const crateKinds = (level: 1 | 2 | 3): string[] => UNLOCK_ITEM_KINDS.filter((k) => itemKindById(k)?.level === level)

/** The chance (0–1) that a crate holds a kind not yet unlocked. */
export function pullNewChance(have: readonly string[], lift: number): number {
  const odds = pullOdds(lift)
  return ([1, 2, 3] as const).reduce((a, lvl, i) => {
    const pool = crateKinds(lvl)
    return a + (odds[i] / 100) * (pool.length ? pool.filter((k) => !have.includes(k)).length / pool.length : 0)
  }, 0)
}

export interface PullResult {
  kind: string
  level: 1 | 2 | 3
  /** Already unlocked: it becomes a bonus item in the next run instead. */
  duplicate: boolean
}

/**
 * Open crate number `n` of a save whose crates are seeded `seed`: a Level by
 * the odds, then a kind of that Level, uniformly — a fresh generator hashed
 * from (seed, n), so a crate never moves a run stream and the same crate
 * always holds the same thing.
 */
export function rollPull(seed: number, n: number, lift: number, have: readonly string[]): PullResult {
  const rng = new RNG(hashSeed('sealed-crate', seed, n))
  const odds = pullOdds(lift)
  const u = rng.next() * 100
  const level: 1 | 2 | 3 = u < odds[0] ? 1 : u < odds[0] + odds[1] ? 2 : 3
  const pool = crateKinds(level)
  const kind = pool[Math.floor(rng.next() * pool.length)]
  return { kind, level, duplicate: have.includes(kind) }
}

/** Bonus items owed to the next run: at most this many wait. */
export const MAX_BONUS_ITEMS = 6

/**
 * The bonus items a run starts with: one Rare item of each owed kind, no
 * curses, generated off a fresh generator hashed from the run seed — so they
 * move no run stream, and the same seed deals the same pieces.
 */
export function bonusItemsFor(runSeed: number, kinds: readonly string[]): Item[] {
  const rng = new RNG(hashSeed(runSeed, 'bonus-items'))
  return kinds
    .filter((k) => !!ITEM_BASES[k])
    .slice(0, MAX_BONUS_ITEMS)
    .map((kind) => generateItem(rng, { kind, rarity: 'rare', allowCurse: false }))
}
