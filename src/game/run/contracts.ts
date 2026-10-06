/**
 * ---------------------------------------------------------------------------
 * Contracts — what a run is now (the mercenary company, build step 2)
 * ---------------------------------------------------------------------------
 *
 * A run is one trade company's route, and its three act bosses are the
 * route's three cities. The militia is paid in gold, the only currency:
 *
 *  - **Escort** — free. A flat fee at every city the caravan reaches, and a
 *    completion bonus at the end.
 *  - **Staked** — the militia buys cargo crates for the road
 *    ({@link CRATE_PRICE} a crate, up to {@link crateCap}). The first city
 *    sells enough of it to recoup the stake, the second pays earnings, the
 *    destination pays the big completion bonus and the unlocks. More crates
 *    make the road harder (the old difficulty step's dial: enemy strength and
 *    more elites, `watch.difficultyRules`) and pay more at every step: a
 *    bigger bonus, more item chances, and a skill at every milestone crate.
 *
 * **The Gate is the caravan.** Its HP is the cargo's condition, shown as
 * Cargo %. Every city pays by the share that arrives ({@link cityPay}).
 *
 * **Cash out or press on** at cities 1 and 2: sell what is left on the
 * wagons at {@link CASH_OUT_RATE} of its value and head home — standing kept,
 * the road's gold banked at the full share, no completion bonus, no item
 * chances, no contract skill — or keep going. Losing keeps what the cities
 * already paid, but unsold crates are lost and most of the road's gold stays
 * on the road (`hq.LOST_ROAD_SHARE`): that is what pressing on risks
 * (`settle.cityTrade` prices the choice).
 *
 * Pure: no store, no React, no DOM, no run-stream draw. Every roll here is a
 * hash of its own parts (RNG draw order is behaviour). The store, the UI and
 * the balance harness read these numbers, so none of them can drift.
 */
import { hashSeed } from '../core/rng'
import { COMPANY_IDS, companyById, type CompanyId } from '../data/companies'
import { skillById } from '../data/skills'
import { itemKindById, itemPoolFor } from '../data/itemKinds'
import { ACT_LAYERS, ACTS } from './threat'
import { difficultyRules, type DifficultyRules } from './watch'
import { BASE_RUN_HQ, FOCUS_MAX_SHARE, type RunHq } from './hq'
import { CHARTER_FEE, CHARTER_PAYOUT, CHARTER_TOWNS, sovereignPool } from './charter'

// ---------------------------------------------------------------------------
// The numbers (placeholders the designer will tune: "to what makes it fun")
// ---------------------------------------------------------------------------

/** What one cargo crate costs to stake. */
export const CRATE_PRICE = 50
/** What one crate sells for at a city, at full cargo: twice its price. */
export const CRATE_VALUE = 100
/** The absolute ceiling on a stake, whatever the standing. */
export const MAX_CRATES = 8
/** The flat fee every city pays the escort, at full cargo. */
export const ESCORT_FEE = 40
/** The destination's completion bonus: a base, and more for every crate carried. */
export const BONUS_BASE = 150
export const BONUS_PER_CRATE = 40
/**
 * What a city pays for the crates still on the wagons when you cash out: their
 * full value (October audit 1.1). At 0.5 a cash-out was worth 0 gold more often
 * than not, so "head home" was never a choice; what you give up now is the
 * completion bonus, the item chances and the contract skill.
 */
export const CASH_OUT_RATE = 1
/** Today's good sells for this much more (crate sales and the completion bonus). */
export const MARKET_MULT = 1.3
/** The crates that are milestones: each one reached adds one more skill on delivery. */
export const MILESTONE_CRATES: readonly number[] = [2, 5, 8]
/** How much more often a company's own skills and items are dealt on its routes. */
export const COMPANY_WEIGHT = 2

/** The cities on every route: one per act boss. */
export const CITY_COUNT = ACTS

/** The most crates a stake may carry at `standing` with that company: standing + 1. */
export const crateCap = (standing: number): number => Math.max(1, Math.min(MAX_CRATES, Math.floor(Math.max(0, standing)) + 1))

/** Clamp a requested stake to `[0, cap]`. */
export const clampCrates = (crates: number, cap = MAX_CRATES): number =>
  Math.max(0, Math.min(Math.min(MAX_CRATES, cap), Math.floor(Number.isFinite(crates) ? crates : 0)))

/** What a stake does to the road: the old difficulty step, one step a crate. */
export const stakeRules = (crates: number): DifficultyRules => difficultyRules(clampCrates(crates))

/** Danger, as 1–5 pips — how hard the road is at this load. Never a probability. */
export const dangerPips = (crates: number): number => Math.min(5, 1 + Math.ceil(clampCrates(crates) / 2))

/** Milestone crates this stake reaches (each adds one skill on delivery). */
export const milestonesAt = (crates: number): number => MILESTONE_CRATES.filter((m) => clampCrates(crates) >= m).length
export const isMilestone = (crate: number): boolean => MILESTONE_CRATES.includes(crate)

/** Item chances the stake adds on top of the contract's own item: one per two crates. */
export const stakeItemChances = (crates: number): number => Math.floor(clampCrates(crates) / 2)

/** What delivering a contract unlocks: one skill and one item, plus the stake's. */
export const deliveryUnlocks = (crates: number): { skills: number; items: number } => ({
  skills: 1 + milestonesAt(crates),
  items: 1 + stakeItemChances(crates),
})

/** The destination's completion bonus, before cargo and market. */
export const completionBonus = (crates: number): number => BONUS_BASE + BONUS_PER_CRATE * clampCrates(crates)

// ---------------------------------------------------------------------------
// Cities
// ---------------------------------------------------------------------------

/** Which city (0, 1, 2) a map layer's act boss is, or null for any other layer. */
export const cityOfLayer = (layer: number): number | null =>
  layer > 0 && layer % ACT_LAYERS === 0 && layer / ACT_LAYERS <= CITY_COUNT ? layer / ACT_LAYERS - 1 : null

/**
 * How many crates city `city` sells: half the load at the first (rounded up,
 * so the sale always recoups the stake — a crate sells for twice its price),
 * then the destination takes half of what is left (rounded up) and the second
 * city the rest. The destination is served first so that a bigger stake never
 * pays less (October audit 1.2): the old order left no crate for the
 * destination on small stakes, and contract pay dipped at 4 and 8 crates.
 * By stake 0–8 the destination sells 0, 0, 1, 1, 1, 1, 2, 2, 2.
 */
export function cratesSoldAt(crates: number, city: number): number {
  const c = clampCrates(crates)
  const first = Math.ceil(c / 2)
  const destination = Math.ceil((c - first) / 2)
  return [first, c - first - destination, destination][city] ?? 0
}

/** Crates still on the wagons after `citiesPaid` cities have sold theirs. */
export const cratesLeftAfter = (crates: number, citiesPaid: number): number => {
  let left = clampCrates(crates)
  for (let i = 0; i < Math.min(CITY_COUNT, citiesPaid); i++) left -= cratesSoldAt(crates, i)
  return Math.max(0, left)
}

/** How a contract stands: open while the road goes on, then how it ended. */
export type ContractStatus = 'open' | 'delivered' | 'cashedOut' | 'lost'

/** The terms a contract was signed on — all a payout needs. */
export interface ContractTerms {
  /** The company whose road it is; null on the Sovereign Route, which is no company's. */
  company: CompanyId | null
  /** Crates staked (0: an escort, and always 0 on the Sovereign Route). */
  crates: number
  /** The market multiplier locked when the contract was signed (1, or {@link MARKET_MULT}; always 1 on the Sovereign Route). */
  market: number
  /**
   * The Sovereign Route (the endgame charter, `run/charter.ts`): sponsored
   * with a fee, no crates, no city pay, no cash-out, and one big payout at the
   * destination.
   */
  charter?: boolean
}

export interface CityPay {
  /** Crates this city bought. */
  sold: number
  /** What they sold for. */
  sales: number
  fee: number
  /** The completion bonus (the destination only). */
  bonus: number
  total: number
}

/**
 * How much of the cargo `hp` of the wagons' HP is, in whole percent — for the
 * copy that states an amount (a repair, a mend), at the standard 20-HP
 * wagons unless the run's own maximum is known.
 */
export const cargoShare = (hp: number, max = 20): number => Math.round((100 * Math.max(0, hp)) / Math.max(1, max))

/** Cargo as a whole percentage of the caravan's condition (the Gate's HP). */
export const cargoPct = (hp: number, max: number): number =>
  max > 0 ? Math.max(0, Math.min(100, Math.round((100 * Math.max(0, hp)) / max))) : 0

/**
 * What city `city` pays when the caravan arrives with `cargo` percent of its
 * cargo. Everything a city pays scales with the cargo that arrives — the fee
 * too, so an escort's battles still matter.
 */
export function cityPay(t: ContractTerms, city: number, cargo = 100): CityPay {
  // The Sovereign Route: the cities are waypoints, and the destination pays
  // the charter's payout in full — all or nothing, whatever cargo arrives.
  if (t.charter) {
    const bonus = city === CITY_COUNT - 1 ? CHARTER_PAYOUT : 0
    return { sold: 0, sales: 0, fee: 0, bonus, total: bonus }
  }
  const share = Math.max(0, Math.min(100, cargo)) / 100
  const sold = cratesSoldAt(t.crates, city)
  const sales = Math.round(sold * CRATE_VALUE * t.market * share)
  const fee = Math.round(ESCORT_FEE * share)
  const bonus = city === CITY_COUNT - 1 ? Math.round(completionBonus(t.crates) * t.market * share) : 0
  return { sold, sales, fee, bonus, total: sales + fee + bonus }
}

/**
 * A contract as the run carries it (snapshotted with the run): its terms, the
 * purse it set out with, and what its cities have paid so far.
 */
export interface RunContract extends ContractTerms {
  /** Gold taken from the bank for the road (merchants and repairs spend it). */
  purse: number
  /** What each city reached has paid, in order. Banked at the settle, so a fall keeps it. */
  paid: number[]
  /** The cargo (percent) the caravan reached each of those cities with — what its pay was scaled by. */
  cargoAt: number[]
  /** The city whose "cash out or press on" is waiting, or null. */
  pending: number | null
  /** What cashing out sold the last crates for (0 unless cashed out). */
  cashOut: number
  status: ContractStatus
  /** True once the hero is committed and the bank has paid the stake and the purse. */
  signed: boolean
  /**
   * Gold the road has paid into the purse so far (fights, shrines, sales) —
   * what splits the purse's gold into the purse you brought and the road's
   * gold at the end (`hq.homeGold`).
   */
  earned: number
  /** What the HQ gave this run, frozen when it began (`hq.runHqFor`). */
  hq: RunHq
}

export const freshContract = (t: ContractTerms, purse: number, hq: RunHq = BASE_RUN_HQ): RunContract => ({
  ...(t.charter ? { charter: true } : {}),
  company: t.charter ? null : t.company,
  crates: t.charter ? 0 : clampCrates(t.crates),
  market: t.charter ? 1 : t.market,
  purse: Math.max(0, Math.floor(purse)),
  paid: [],
  cargoAt: [],
  pending: null,
  cashOut: 0,
  status: 'open',
  signed: false,
  earned: 0,
  hq: { ...hq },
})

/** The contract after the road paid `gold` more into the purse (a gain only; null stays null). */
export function earn<C extends RunContract | null>(c: C, gold: number): C {
  const n = Math.max(0, Math.floor(Number.isFinite(gold) ? gold : 0))
  return c && n > 0 ? ({ ...c, earned: c.earned + n } as C) : c
}

/** Everything the contract has earned for the bank: the cities' pay and any cash-out sale. */
export const contractBanked = (c: Pick<RunContract, 'paid' | 'cashOut'>): number => c.paid.reduce((a, b) => a + b, 0) + c.cashOut

/** What this contract cost the bank to sign: its stake, or the Sovereign Route's fee. */
export const contractStake = (c: Pick<ContractTerms, 'crates' | 'charter'>): number => (c.charter ? CHARTER_FEE : clampCrates(c.crates) * CRATE_PRICE)

/** The whole contract at full cargo: what each city pays, the stake, and the profit. */
export function contractPlan(t: ContractTerms): { cities: CityPay[]; stake: number; total: number; profit: number; skills: number; items: number } {
  const cities = Array.from({ length: CITY_COUNT }, (_, i) => cityPay(t, i, 100))
  const total = cities.reduce((a, c) => a + c.total, 0)
  const stake = contractStake(t)
  return { cities, stake, total, profit: total - stake, ...(t.charter ? { skills: 0, items: 0 } : deliveryUnlocks(t.crates)) }
}

/**
 * May the contract waiting at city `c.pending` cash out? Never on the Sovereign
 * Route (all or nothing). A first contract (LS3) learns at its first city that
 * cities pay, and is offered the choice from its second (October audit 1.5):
 * the push-your-luck moment is the game's headline, and the first run is the
 * one that decides whether a player stays.
 */
export const canCashOut = (c: Pick<RunContract, 'pending' | 'charter'>, firstRun: boolean): boolean =>
  c.pending != null && !c.charter && (!firstRun || c.pending >= FIRST_RUN_CASH_OUT_CITY)
/** The first city (0-based) a first contract may cash out at. */
export const FIRST_RUN_CASH_OUT_CITY = 1

/** What cashing out sells the crates still on the wagons for, at `cargo` percent. */
export function cashOutValue(t: ContractTerms, citiesPaid: number, cargo = 100): number {
  if (t.charter) return 0
  const share = Math.max(0, Math.min(100, cargo)) / 100
  return Math.round(cratesLeftAfter(t.crates, citiesPaid) * CRATE_VALUE * t.market * CASH_OUT_RATE * share)
}

// ---------------------------------------------------------------------------
// The market of the day
// ---------------------------------------------------------------------------

/** `YYYY-MM-DD` for the UTC day containing `now` — the market's clock. */
export function utcDateKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * The good that pays more today: a stable hash of the UTC date, so every
 * player on every device sees the same one with no server.
 */
export const marketOfDay = (dateKey: string): CompanyId => COMPANY_IDS[hashSeed('fieldwatch-market', dateKey) % COMPANY_IDS.length]

/** The market multiplier a contract for `company` signs at on `dateKey`. */
export const marketFor = (company: CompanyId | null, dateKey: string): number => (company && marketOfDay(dateKey) === company ? MARKET_MULT : 1)

// ---------------------------------------------------------------------------
// The purse
// ---------------------------------------------------------------------------

/**
 * The purse is gold you take from the bank for the road. Merchants and
 * repairs spend only the purse and what the run earns. At the end, win or
 * lose, what is left of the purse comes home in full, and a share of the gold
 * the road paid comes with it (`hq.homeGold`). The bank stays home and the
 * HQ's Finance office pays interest on it.
 */
export const PURSE_STEPS: readonly number[] = [0, 30, 60, 100, 150, 200]
/** The purse a first contract carries, and the default: the old starting gold. */
export const DEFAULT_PURSE = 60

/** The purse sizes the bank can fund. */
export const purseOptions = (bank: number): number[] => PURSE_STEPS.filter((p) => p <= Math.max(0, bank))

/** The default purse: the largest step at or under both the bank and {@link DEFAULT_PURSE}. */
export const defaultPurse = (bank: number): number => {
  const fit = PURSE_STEPS.filter((p) => p <= Math.min(Math.max(0, bank), DEFAULT_PURSE))
  return fit[fit.length - 1] ?? 0
}

/** A requested purse, clamped to a step the bank (after the stake) can fund. */
export function clampPurse(purse: number, bank: number): number {
  const ok = purseOptions(bank)
  const want = Number.isFinite(purse) ? purse : 0
  return ok.filter((p) => p <= want).pop() ?? 0
}

// ---------------------------------------------------------------------------
// Pool affinity
// ---------------------------------------------------------------------------

export const skillCompany = (id: string): CompanyId | undefined => skillById(id)?.company
export const kindCompany = (id: string): CompanyId | undefined => itemKindById(id)?.company

/**
 * A run's DEALING pool: each id once, or {@link COMPANY_WEIGHT} times when it
 * belongs to the route's company. Every dealer (`run/heroes`, `run/skills`,
 * `data/items.generateItem`) draws by multiplicity, so the company's pieces
 * are dealt about twice as often while every other piece still appears. With
 * no company the pool is returned as it was, so an unweighted run deals
 * exactly what it always dealt, draw for draw.
 *
 * **Company focus** (the HQ's Operations): `focus` raises ONE company's share
 * of the pool by `boost` percentage points (never past `hq.FOCUS_MAX_SHARE`).
 * The shares are kept in whole multiplicities at {@link FOCUS_SCALE}× so a
 * step lands within a fraction of a point of what the HQ card says. With no
 * focus (or a company with no piece in this pool) the pool is exactly the
 * unfocused one, draw for draw.
 */
export function weightPool(
  pool: readonly string[],
  company: CompanyId | null | undefined,
  companyOf: (id: string) => CompanyId | undefined,
  focus?: { company: CompanyId | null; boost: number } | null,
): string[] {
  const once = [...new Set(pool)]
  const weight = (id: string) => (company && companyOf(id) === company ? COMPANY_WEIGHT : 1)
  const plain = () => (company ? once.flatMap((id) => Array<string>(weight(id)).fill(id)) : once)
  if (!focus?.company || !(focus.boost > 0)) return plain()
  const mine = (id: string) => companyOf(id) === focus.company
  const a = once.filter(mine).reduce((t, id) => t + weight(id), 0)
  const b = once.filter((id) => !mine(id)).reduce((t, id) => t + weight(id), 0)
  if (!a || !b) return plain()
  const target = Math.min(FOCUS_MAX_SHARE / 100, a / (a + b) + focus.boost / 100)
  const k = (target * b) / (1 - target) / a
  return once.flatMap((id) => Array<string>(mine(id) ? Math.max(1, Math.round(weight(id) * FOCUS_SCALE * k)) : weight(id) * FOCUS_SCALE).fill(id))
}

/**
 * A run's item DEALING pool from the kinds it may deal (the basic five are
 * added): weighted to the route's company and the HQ's focus
 * ({@link weightPool}), then with any owned Sovereign kind at its low weight
 * (`charter.sovereignPool`). The store, the snapshot's rebuild and the harness
 * all build it here, so they cannot drift.
 */
export function runItemPool(
  kinds: readonly string[],
  company: CompanyId | null | undefined,
  focus?: { company: CompanyId | null; boost: number } | null,
): string[] {
  return sovereignPool(weightPool(itemPoolFor(kinds), company, kindCompany, focus))
}

/** The resolution company focus is kept at: every unfocused entry ×20. */
export const FOCUS_SCALE = 20

/** A company's share of a dealing pool (0–1), as dealt by multiplicity. */
export const poolShare = (pool: readonly string[], company: CompanyId, companyOf: (id: string) => CompanyId | undefined): number =>
  pool.length ? pool.filter((id) => companyOf(id) === company).length / pool.length : 0

// ---------------------------------------------------------------------------
// Contract letters
// ---------------------------------------------------------------------------

/** The route's three towns: a company's, or the Sovereign Route's (`company` null). */
export const routeTowns = (company: CompanyId | null): readonly [string, string, string] => (company ? companyById(company).towns : CHARTER_TOWNS)

/**
 * One line of flavour for a contract, from the company and its destination —
 * a hash of the contract's seed picks which of the company's lines.
 */
export function contractLetter(company: CompanyId | null, seed: number): string {
  if (!company) return `Your own charter: every good the five companies trade, by ${CHARTER_TOWNS[0]} and ${CHARTER_TOWNS[1]} to ${CHARTER_TOWNS[2]}.`
  const co = companyById(company)
  const line = co.letters[hashSeed(seed, 'letter', company) % co.letters.length]
  const [c1, c2, dest] = co.towns
  return line.replace('{name}', co.name).replace('{noun}', co.noun).replace('{c1}', c1).replace('{c2}', c2).replace('{dest}', dest)
}

// ---------------------------------------------------------------------------
// The record — the only odds the game shows
// ---------------------------------------------------------------------------

/** Contracts finished and delivered at one stake. */
export interface StakeRecord {
  runs: number
  delivered: number
}

/**
 * The player's own record at a stake: escorts on their own, staked contracts
 * at this many crates or more ("3 of 4 delivered"). Never an invented
 * probability.
 */
export function recordAt(record: Readonly<Record<string, StakeRecord>>, crates: number): StakeRecord {
  const c = clampCrates(crates)
  let runs = 0
  let delivered = 0
  for (const [k, r] of Object.entries(record)) {
    const n = Number(k)
    if (!Number.isInteger(n)) continue
    if (c === 0 ? n === 0 : n >= c) {
      runs += r.runs
      delivered += r.delivered
    }
  }
  return { runs, delivered }
}
