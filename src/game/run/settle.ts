/**
 * What a retired run is owed. Pure: the facts of a run in, the one ledger call
 * to make out. The store's `settleSavedRun` (src/state/game/settle.ts) decides
 * WHICH run to settle and guarantees it is settled once; this decides what
 * settling it pays.
 *
 * Since the mercenary company a run is a contract, and its settle banks gold:
 * what is left of the purse comes home whatever happened (with a share of the
 * road's gold, `hq.homeGold`), the cities' pay is kept even after a fall, and
 * unsold crates are lost.
 */
import type { RunChallenge } from '../../state/seeds'
import type { RunFacts } from '../data/achievements'
import type { Sentinel } from '../types'
import type { HeroStyle } from '../data/items'
import { cashOutValue, CITY_COUNT, cityPay, contractBanked, type RunContract } from './contracts'
import { homeGold, homeTotal, LOST_ROAD_SHARE, ROAD_SHARE, roadShareFor } from './hq'
import { actOf } from './threat'

/**
 * What a run tracks for the feats (Phase 3b) — the few facts a settle cannot
 * read back off the finished run's roster and map. Snapshotted with the run.
 */
export interface RunFeats {
  /** What the first hero fought with when the march began (its weapon's style). */
  starter: HeroStyle | null
  /** Heroes when the march began (the leader plus any hub extras). */
  startSize: number
  maxFielded: number
  actBosses: number
  flawlessBosses: number
  goldPeak: number
}
export const freshFeats = (): RunFeats => ({ starter: null, startSize: 0, maxFielded: 0, actBosses: 0, flawlessBosses: 0, goldPeak: 0 })

/** The facts a settled run's feats are judged on. */
export function runFacts(v: {
  won: boolean
  feats: RunFeats
  roster: readonly Pick<Sentinel, 'mutations'>[]
  deepestLayer: number
  crates: number
  goblinsSeen: number
}): RunFacts {
  return {
    won: v.won,
    starter: v.feats.starter,
    hires: Math.max(0, v.roster.length - v.feats.startSize),
    maxFielded: v.feats.maxFielded,
    act: v.deepestLayer > 0 ? actOf(v.deepestLayer) : 1,
    flawlessBosses: v.feats.flawlessBosses,
    actBosses: v.feats.actBosses,
    mutated: v.roster.some((s) => (s.mutations?.length ?? 0) > 0),
    goldPeak: v.feats.goldPeak,
    crates: v.crates,
    goblinsSeen: v.goblinsSeen,
  }
}

/** Distinct goblin KINDS in a Codex list (a Warded Bomber is still a Bomber). */
export const goblinKinds = (enemyIds: readonly string[]): number => new Set(enemyIds.map((id) => id.split('_')[0])).size

/** What a settle needs to know about the run it is retiring. */
export interface SettleFacts {
  depth: number
  kills: number
  /** The run's purse as it stands: what comes home. */
  gold: number
  /** The contract (null: a run saved before contracts). */
  contract: RunContract | null
  /** A custom seed pays its gold and earns nothing else. */
  challenge: RunChallenge
  /** The facts the feats are judged on, when the settle has them (Phase 3b). */
  facts?: RunFacts
  /**
   * A run saved before contracts (an Endless run included): the Watch Marks it
   * would have paid, as gold — Marks became gold one for one. Read only when
   * the run has no contract to bank.
   */
  legacyGold?: number
}

/**
 * A run only counts as one you PLAYED (m-6): `settleContract` adds a finished
 * contract to the record, so a settle of a never-played run must not.
 */
export const runWasPlayed = (f: Pick<SettleFacts, 'depth' | 'kills'>): boolean => f.depth > 0 || f.kills > 0

/**
 * What the bank gets back from a run: once the contract is signed, what is
 * left of the purse in full, a share of the road's gold (`hq.homeGold` — the
 * designer's road-gold tax), and everything the cities paid. A run with no
 * contract (saved before contracts) is owed its old Marks as gold.
 */
export function runDeposit(f: Pick<SettleFacts, 'gold' | 'contract' | 'legacyGold'>, status?: RunGrantStatus): number {
  if (!f.contract) return Math.max(0, Math.round(f.legacyGold ?? 0))
  if (!f.contract.signed) return 0
  return homeTotal(homeGold({ purse: f.contract.purse, earned: f.contract.earned, gold: f.gold }, roadShareFor(status))) + contractBanked(f.contract)
}

/** How a settled contract ended. A fall banks less of the road's gold (`hq.LOST_ROAD_SHARE`). */
export type RunGrantStatus = 'delivered' | 'cashedOut' | 'lost'

/**
 * "Cash out or press on", priced (October audit 1.4) — what the city screen
 * states, from the same rules the settle pays by, so the two cannot drift.
 *
 *  - `now`: banked if you cash out here — the cities' pay, the last crates
 *    sold, the purse's rest and the road's gold at the full share.
 *  - `fall`: banked if you press on and fall — the cities' pay and the purse's
 *    rest, the road's gold at the fallen share, and no crates.
 *  - `deliver`: banked if you deliver from here at today's cargo — every city
 *    still ahead paid at `cargo`, and the road's gold you hold now at the full
 *    share (the road pays more on the way, so it is a floor).
 *  - `atRisk`: `now − fall`, what pressing on puts on the line. 0 means there
 *    is nothing to lose, and the screen says so rather than staging a choice.
 */
export interface CityTrade {
  now: number
  fall: number
  deliver: number
  atRisk: number
  /** The crate sale cashing out makes. */
  sale: number
  /** The road's gold in the purse now, and what each ending banks of it. */
  road: number
  roadIfCashed: number
  roadIfFallen: number
}

export function cityTrade(c: RunContract, gold: number, cargo: number): CityTrade {
  const banked = contractBanked(c)
  const sale = cashOutValue(c, c.paid.length, cargo)
  const cashed = homeGold({ purse: c.purse, earned: c.earned, gold }, ROAD_SHARE)
  const fallen = homeGold({ purse: c.purse, earned: c.earned, gold }, LOST_ROAD_SHARE)
  const city = c.pending ?? Math.max(0, c.paid.length - 1)
  let ahead = 0
  for (let i = city + 1; i < CITY_COUNT; i++) ahead += cityPay(c, i, cargo).total
  const now = banked + sale + homeTotal(cashed)
  const fall = banked + homeTotal(fallen)
  return {
    now,
    fall,
    deliver: banked + ahead + homeTotal(cashed),
    atRisk: Math.max(0, now - fall),
    sale,
    road: cashed.road,
    roadIfCashed: cashed.roadBanked,
    roadIfFallen: fallen.roadBanked,
  }
}

/** The arguments `metaStore.settleContract` takes, as a settle builds them. */
export interface RunGrant {
  depth: number
  won: boolean
  kills: number
  contract: { company: RunContract['company']; crates: number; status: 'delivered' | 'cashedOut' | 'lost'; charter?: boolean } | null
  deposit: number
  unranked?: boolean
  facts?: RunFacts
}

export type PayoutPlan =
  | { kind: 'none' }
  /** A signed contract abandoned before it was played: its purse (and stake's nothing) goes home. */
  | { kind: 'deposit'; amount: number }
  | { kind: 'grant'; grant: RunGrant }

/** The grant a finished contract makes, however it finished. */
export function contractGrant(f: SettleFacts, status: RunGrantStatus): RunGrant {
  return {
    depth: f.depth,
    won: status === 'delivered',
    kills: f.kills,
    contract: f.contract ? { company: f.contract.company, crates: f.contract.crates, status, ...(f.contract.charter ? { charter: true } : {}) } : null,
    deposit: runDeposit(f, status),
    unranked: f.challenge.kind === 'seeded',
    ...(f.facts ? { facts: f.facts } : {}),
  }
}

/**
 * The payout for a retired, un-won run (walked away from, or found in storage
 * from a session that died). It is a fall: the cities' pay and the purse come
 * home, unsold crates are lost. A contract never signed (the hero was never
 * committed) took nothing from the bank and pays nothing.
 */
export function planPayout(f: SettleFacts): PayoutPlan {
  if (!runWasPlayed(f)) {
    const amount = runDeposit(f)
    return amount > 0 ? { kind: 'deposit', amount } : { kind: 'none' }
  }
  return { kind: 'grant', grant: contractGrant(f, 'lost') }
}
