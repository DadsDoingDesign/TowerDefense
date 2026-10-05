/**
 * What a retired run is owed. Pure: the facts of a run in, the one ledger call
 * to make out. The store's `settleSavedRun` (src/state/game/settle.ts) decides
 * WHICH run to settle and guarantees it is settled once; this decides what
 * settling it pays.
 *
 * Since the mercenary company a run is a contract, and its settle banks gold:
 * what is left of the purse comes home whatever happened, the cities' pay is
 * kept even after a fall, and unsold crates are lost.
 */
import type { RunChallenge } from '../../state/seeds'
import type { RunFacts } from '../data/achievements'
import type { Sentinel } from '../types'
import type { HeroStyle } from '../data/items'
import { contractBanked, type RunContract } from './contracts'
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
 * What the bank gets back from a run: once the contract is signed, the
 * purse's rest and everything the cities paid. A run with no contract (saved
 * before contracts) is owed its old Marks as gold.
 */
export function runDeposit(f: Pick<SettleFacts, 'gold' | 'contract' | 'legacyGold'>): number {
  if (!f.contract) return Math.max(0, Math.round(f.legacyGold ?? 0))
  if (!f.contract.signed) return 0
  return Math.max(0, Math.round(f.gold)) + contractBanked(f.contract)
}

/** The arguments `metaStore.settleContract` takes, as a settle builds them. */
export interface RunGrant {
  depth: number
  won: boolean
  kills: number
  contract: { company: RunContract['company']; crates: number; status: 'delivered' | 'cashedOut' | 'lost' } | null
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
export function contractGrant(f: SettleFacts, status: 'delivered' | 'cashedOut' | 'lost'): RunGrant {
  return {
    depth: f.depth,
    won: status === 'delivered',
    kills: f.kills,
    contract: f.contract ? { company: f.contract.company, crates: f.contract.crates, status } : null,
    deposit: runDeposit(f),
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
