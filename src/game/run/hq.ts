/**
 * ---------------------------------------------------------------------------
 * The mercenary company's headquarters (build step 3)
 * ---------------------------------------------------------------------------
 *
 * The HQ replaces the Watchtower: one place, two offices, every purchase
 * paid from the bank (`metaStore.bank`) and kept for good.
 *
 *  - **HR** — the opening deal: better first heroes ({@link DEAL_STEPS}), and
 *    the Hiring Hall (the old hub service, folded in).
 *  - **Operations** — pack slots, company focus (one company at a time), and
 *    the scouts (the old map services, folded in).
 *
 * The October 2026 designer pass cut the Finance office (its levels paid back
 * in about 260 runs) and "Fewer boulders" (the harness measured it making runs
 * 4pt harder); both are refunded by the meta migration ({@link refundRetiredHq}).
 * The bank keeps the free base interest as a plain rule ({@link BASE_INTEREST}).
 *
 * Also here, because it is the HQ's ledger too:
 *
 *  - **Road gold** ({@link homeGold}): of the gold the road paid, only
 *    {@link ROAD_SHARE} comes home. The company's advance (`contracts.ADVANCE`)
 *    never does; a purse an older save took from the bank comes home in full.
 *    City pay is banked in full by the contract (`run/contracts`).
 *  - **When the HQ opens** ({@link HQ_OPENS_AT}) and when company focus shows
 *    ({@link FOCUS_FROM_RUN}): the staggered run-2 reveal (`state/staging`).
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

/**
 * The share of the road's gold a FALLEN contract brings home (October audit
 * 1.3, a default the tuning pass owns). A fall still keeps every city's pay and
 * what is left of the purse — never broke — but most of what the road paid
 * stays on the road. That gap is the stake in "cash out or press on": cashing
 * out banks the road's gold at {@link ROAD_SHARE}, a fall at this.
 */
export const LOST_ROAD_SHARE = 0.1

/** The road-gold share a contract that ended this way brings home. */
export const roadShareFor = (status?: 'open' | 'delivered' | 'cashedOut' | 'lost'): number =>
  status === 'lost' ? LOST_ROAD_SHARE : ROAD_SHARE

/** What a run's purse is worth to the bank when it ends. */
export interface HomeGold {
  /** The purse it set out with. */
  purse: number
  /**
   * The purse was the company's advance (`contracts.ADVANCE`), not the bank's:
   * what is left of it goes back to the company and none of it is banked.
   */
  advance: boolean
  /** What is left of that purse — home in full, unless it was an advance. */
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
 * **The advance** (October 2026): every contract now sets out with the
 * company's advance instead of a purse taken from the bank. It is split off
 * the same way, but it never comes home — it was never the bank's — so only
 * the road's share is banked ({@link homeTotal}). A contract an older save
 * signed with a purse from the bank (`advance` false) settles exactly as it
 * always did: its purse's rest comes home in full.
 *
 * **Spending comes out of the purse first.** A merchant is paid from the purse
 * you brought before any gold the road paid you, so `purseBack` is the purse
 * less everything spent (never below 0), and the rest of the gold in hand is
 * road gold. That makes the split depend only on three totals — the purse, the
 * gold earned on the road, the gold in hand — never on the order things
 * happened in, and no payload can claim more of its gold is purse than the
 * purse it set out with.
 */
export function homeGold(v: { purse: number; earned: number; gold: number; advance?: boolean }, share = ROAD_SHARE): HomeGold {
  const purse = whole(v.purse)
  const gold = whole(v.gold)
  const spent = Math.max(0, purse + whole(v.earned) - gold)
  const purseBack = Math.min(gold, Math.max(0, purse - spent))
  const road = gold - purseBack
  const s = Math.max(0, Math.min(1, share))
  return { purse, advance: v.advance === true, purseBack, road, roadBanked: Math.floor(road * s), pct: Math.round(s * 100) }
}

/** What is left of the purse that the bank gets back: all of it, or none of an advance. */
export const purseHome = (h: Pick<HomeGold, 'purseBack'> & { advance?: boolean }): number => (h.advance ? 0 : h.purseBack)

/** Everything a run's purse puts back in the bank. */
export const homeTotal = (h: Pick<HomeGold, 'purseBack' | 'roadBanked'> & { advance?: boolean }): number => purseHome(h) + h.roadBanked

// ---------------------------------------------------------------------------
// The offices and their prices
// ---------------------------------------------------------------------------

export type HqId = 'deal' | 'hiring' | 'pack' | 'focus' | 'scouting'
export type Office = 'hr' | 'ops'

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
 * A finished escort run banks roughly 300–450 gold under the road-gold share
 * (REPORT §13), so the HQ's whole catalogue (~6,700) is twenty-odd runs of
 * saving, and no single level costs more than three runs.
 *
 * October 2026: Finance's interest levels and "Fewer boulders" are gone
 * ({@link RETIRED_HQ}, refunded); Operations keeps the three purchases with a
 * felt effect — pack slots, company focus and the scouts.
 */
export const HQ_UPGRADES: readonly HqUpgrade[] = [
  { id: 'deal', office: 'hr', name: 'Opening deal', costs: [150, 300, 500, 800, 1200] },
  { id: 'hiring', office: 'hr', name: 'Hiring Hall', costs: [180] },
  { id: 'pack', office: 'ops', name: 'Pack slots', costs: [150, 250, 350, 450] },
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
// The bank's interest — a plain rule (the Finance office was cut)
// ---------------------------------------------------------------------------

/**
 * The bank's interest: a rate on the gold left at home, and the most one
 * contract can pay. Free, with nothing to buy (October 2026: the Finance
 * office's levels paid back in about 260 runs, so they were cut and refunded).
 * The cap is reached at {@link INTEREST_FULL_AT} gold.
 *
 * **Why 20.** The smallest stake — one crate, 50 gold — adds about +50 gold to
 * a contract's expected pay over the free escort (REPORT §13) and +90 when it
 * is delivered. The bank never out-earns a stake, and it only pays on
 * contracts you finish.
 */
export const BASE_INTEREST: { readonly rate: number; readonly cap: number } = { rate: 0.02, cap: 20 }

/** A rate as the page prints it: "2%". */
export const ratePct = (rate: number): string => `${+(rate * 100).toFixed(1)}%`
/** The bank at which the rate meets its cap. */
export const INTEREST_FULL_AT = 1000

/** What a finished contract pays on `bank` gold left at home. */
export function interestFor(bank: number): number {
  return Math.min(BASE_INTEREST.cap, Math.floor(whole(bank) * BASE_INTEREST.rate))
}

/** Which ends earn interest: a finished contract, never a lost one. */
export const earnsInterest = (status: 'delivered' | 'cashedOut' | 'lost' | 'open'): boolean => status === 'delivered' || status === 'cashedOut'

/** The bank's rule, in one line, wherever the bank is shown. */
export const interestLine = (): string =>
  `Your bank earns ${ratePct(BASE_INTEREST.rate)} each time you finish a contract, up to ${BASE_INTEREST.cap} gold. A lost contract earns none.`

// ---------------------------------------------------------------------------
// The staggered reveal (October 2026): when the HQ and company focus open
// ---------------------------------------------------------------------------

/** The HQ opens the first time the bank holds this much (and stays open: a latch, `state/staging`). */
export const HQ_OPENS_AT = 500
/** Company focus shows from this many finished contracts. */
export const FOCUS_FROM_RUN = 5

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/** Pack slots a new militia has; each Pack slots level adds one. */
export const PACK_BASE = 6
export const packSlots = (level: number): number => PACK_BASE + Math.min(hqMax('pack'), whole(level))

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
  /** One more focus step for the next contract. */
  focus: boolean
}
export const NO_ORDERS: HqOrders = { focus: false }

/**
 * What the HQ gives one run, frozen on its contract when the run begins — a
 * purchase made while a run is saved never changes that run.
 */
export interface RunHq {
  /**
   * Seeded boulder patches cleared from every field. Always 0 for a contract
   * signed now ("Fewer boulders" was cut, October 2026); a run an older save
   * signed keeps what it was sent out with.
   */
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
    rocks: 0,
    focus,
    boost: focus ? focusBoost(hqLevel(levels, 'focus'), orders.focus) : 0,
    pack: packSlots(hqLevel(levels, 'pack')),
  }
}

/**
 * The most a run's HQ terms can hold — the snapshot's clamp. Boulders: what a
 * run an older save signed could carry (3 levels and a 2-patch order).
 */
export const MAX_ROCKS_CUT = 5
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
// Retired in October 2026: the Finance office and "Fewer boulders"
// ---------------------------------------------------------------------------

/**
 * What each retired purchase's levels cost, for the refund (meta v11):
 * Finance's interest levels (`rate`) and "Fewer boulders" (`rocks`).
 */
export const RETIRED_HQ: Readonly<Record<string, readonly number[]>> = {
  rate: [200, 400, 700],
  rocks: [250, 450, 700],
}
/** What the retired one-contract boulder order cost. */
export const RETIRED_ROCK_ORDER = 60

/**
 * The meta migration's refund (v11): every retired level bought, at what it
 * cost, and a boulder order paid for but not yet spent.
 */
export function refundRetiredHq(upgrades: Readonly<Record<string, number>>, orders: unknown): number {
  let refund = 0
  for (const [id, costs] of Object.entries(RETIRED_HQ)) {
    const n = Math.min(costs.length, whole(upgrades[id]))
    for (let k = 0; k < n; k++) refund += costs[k]
  }
  const o = orders && typeof orders === 'object' ? (orders as Record<string, unknown>) : {}
  return refund + (o.rocks === true ? RETIRED_ROCK_ORDER : 0)
}

// ---------------------------------------------------------------------------
// Sealed crates — the item pull
// ---------------------------------------------------------------------------

/**
 * One crate's price. Priced against play: a zero-HQ escort banks ~510 gold
 * net and a 4-crate contract ~640 (REPORT §13, after the tuning pass), and a
 * delivered contract opens an item kind for free, so a crate is about one
 * run's savings for one roll that may be a duplicate — playing stays the
 * surer way to unlock gear, and the crate is a side bet. Checked, unchanged.
 */
export const PULL_PRICE = 500

/** The sealed crates open after the first DELIVERED contract (the staggered reveal, `state/staging`). */
export const cratesOpenFor = (delivered: number): boolean => whole(delivered) >= 1

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
