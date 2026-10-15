/**
 * ---------------------------------------------------------------------------
 * The trade war — seasons, market share, rivals (Draft 4 § D)
 * ---------------------------------------------------------------------------
 *
 * The five companies fight over the trade, and the militia's contracts move
 * it. A **season** is {@link SEASON_LENGTH} finished contracts (counted at the
 * settle); each company holds a **share** of the trade in whole points that
 * always sum to 100, starting even ({@link SHARE_START} each).
 *
 *  - **A contract moves share** ({@link shareMove}): delivered, its company
 *    takes {@link DELIVERED_SHARE} points (+1 for every two crates staked)
 *    from the others; cashed out, {@link CASHED_OUT_SHARE}; fallen, it loses
 *    {@link LOST_SHARE} to the others. Points are taken one at a time from the
 *    biggest other share (given one at a time to the smallest), so the moves
 *    are as even as whole points allow, and no share drops below
 *    {@link SHARE_FLOOR} — every company stays on the bar. **The Sovereign
 *    Route** is your own road: it counts toward the season but moves no
 *    share. A custom seed counts for nothing, as it earns nothing else.
 *  - **The season ends** at the settle of its seventh contract
 *    ({@link endSeason}). The **leader** (the biggest share) pays its
 *    **champion**: if you delivered at least {@link CHAMPION_MIN} of its
 *    contracts this season you are its top militia, and it pays
 *    {@link CHAMPION_PURSE} gold per delivery (banked at once) and a **pick
 *    from its vault** ({@link vaultPicks}: three of its own item kinds, the
 *    ones still locked first — a locked kind is unlocked, an owned one comes
 *    as a Rare bonus item for the next contract). The **last** company that
 *    hires you posts **desperate terms** for the next season: its contracts
 *    pay ×{@link DESPERATE_PAY}, its raiders are ×{@link DESPERATE_STRENGTH}
 *    (`contracts.contractRules`). Then the shares **regress halfway to even**
 *    ({@link regressShares}): a season's lead carries over, but not all of it.
 *  - **Rivals and exclusives** ({@link rivalOf}): once a season, from a
 *    company's terms, you may sign an **exclusive** with it. Its contracts pay
 *    ×{@link EXCLUSIVE_XP} standing XP this season (Easel House, which has no
 *    rival: ×{@link EXCLUSIVE_XP_UNRIVALLED}, and it costs nothing); its
 *    rival's stake cap is one crate lower ({@link seasonCrateCap}) and its
 *    notice on the home turns **cold**. It lasts until the season ends.
 *
 * Staged with the market of the day (`contracts.MARKET_FROM_RUN`): before
 * the fifth finished contract no contract counts, and nothing shows.
 *
 * Pure: no store, no React, no DOM — and **no run-stream draw**. Every tie
 * and every vault pick is a hash of its own parts (RNG draw order is
 * behaviour). The store (`metaStore.settleContract`), the UI and the tests
 * read these rules, so none of them can drift.
 */
import { hashSeed } from '../core/rng'
import { COMPANY_IDS, isCompanyId, rivalOf, type CompanyId } from '../data/companies'
import { BASIC_ITEM_KINDS, ITEM_KINDS, isItemKind } from '../data/itemKinds'
import { crateCap, DESPERATE_PAY, DESPERATE_STRENGTH, marketOpen, MAX_CRATES, type ContractStatus } from './contracts'

export { rivalOf, DESPERATE_PAY, DESPERATE_STRENGTH }

// ---------------------------------------------------------------------------
// The numbers (placeholders for the tuning pass)
// ---------------------------------------------------------------------------

/** Finished contracts in a season. */
export const SEASON_LENGTH = 7
/** Every company's share when the war begins: even. */
export const SHARE_START = 100 / COMPANY_IDS.length
/** No share falls below this: every company keeps a segment on the bar. */
export const SHARE_FLOOR = 2
/** Points a delivered contract takes for its company. */
export const DELIVERED_SHARE = 4
/** …plus one for every this-many crates staked (a bigger stake moves more goods). */
export const CRATES_PER_EXTRA_SHARE = 2
/** Points a cashed-out contract takes for its company (it sold some of its goods). */
export const CASHED_OUT_SHARE = 2
/** Points a fallen contract costs its company (handed to the others). */
export const LOST_SHARE = 2
/** Deliveries for the leader this season that make you its top militia. */
export const CHAMPION_MIN = 2
/** What the leader pays its champion, per delivery for it this season. */
export const CHAMPION_PURSE = 75
/** Item kinds the leader's vault offers its champion to pick one from. */
export const VAULT_PICKS = 3
/** An exclusive's standing XP multiplier on its company's contracts. */
export const EXCLUSIVE_XP = 1.5
/** …for a company with no rival (Easel House): smaller, and it costs nothing. */
export const EXCLUSIVE_XP_UNRIVALLED = 1.25
/** How many crates lower a cold rival's stake cap is. */
export const COLD_CRATES = 1

// ---------------------------------------------------------------------------
// The state
// ---------------------------------------------------------------------------

export type Shares = Record<CompanyId, number>

/** One pick from the leader's vault: an item kind, and whether taking it unlocks it (else a Rare bonus item). */
export interface VaultPick {
  kind: string
  /** True: the kind is still locked, and taking it unlocks it. False: owned — a Rare bonus item for the next contract. */
  unlock: boolean
}

/** How a season ended — kept on the save until its page is read (and the vault pick made). */
export interface SeasonEnd {
  /** The season that ended. */
  n: number
  /** The company that took it. */
  leader: CompanyId
  /** Its share at the end. */
  share: number
  /** Your deliveries for it this season. */
  delivered: number
  /** You were its top militia: it paid you. */
  champion: boolean
  /** Gold it paid you (banked at the settle that ended the season). */
  purse: number
  /** Its vault, to pick one from (empty unless champion). */
  vault: VaultPick[]
  /** The company posting desperate terms next season (null: none hires you). */
  desperate: CompanyId | null
  /** The shares as the season closed (before the regression). */
  shares: Shares
}

export interface Season {
  /** The season's number, from 1. */
  n: number
  /** Contracts finished this season (0 … {@link SEASON_LENGTH} − 1). */
  contracts: number
  /** Each company's share, whole, summing to 100. */
  shares: Shares
  /** The shares before the last finished contract moved them — the standings' trend. */
  before: Shares
  /** Your deliveries this season, per company. */
  deliveries: Record<CompanyId, number>
  /** The company you signed an exclusive with this season, or null. */
  exclusive: CompanyId | null
  /** The company on desperate terms this season (last place last season), or null. */
  desperate: CompanyId | null
  /** The season that just ended, until its page is read. */
  ended: SeasonEnd | null
}

const evenShares = (): Shares => fitShares(Object.fromEntries(COMPANY_IDS.map((c) => [c, SHARE_START])) as Shares)
const zeros = (): Record<CompanyId, number> => Object.fromEntries(COMPANY_IDS.map((c) => [c, 0])) as Record<CompanyId, number>

/** The war before its first contract: season 1, even shares. */
export function freshSeason(): Season {
  const shares = evenShares()
  return { n: 1, contracts: 0, shares, before: { ...shares }, deliveries: zeros(), exclusive: null, desperate: null, ended: null }
}

/** Whether the trade war is on: from the market of the day's opening (`contracts.MARKET_FROM_RUN` finished contracts). */
export const warOpen = (runsCompleted: number): boolean => marketOpen(runsCompleted)

/** Contracts still to finish before the season ends. */
export const contractsLeft = (s: Pick<Season, 'contracts'>): number => Math.max(0, SEASON_LENGTH - s.contracts)

// ---------------------------------------------------------------------------
// Shares
// ---------------------------------------------------------------------------

/** A stable order for ties: a hash of the season and the purpose, per company. */
const tieOrder = (n: number, why: string, c: CompanyId): number => hashSeed('trade-war', why, n, c)

/**
 * Any shares as whole points summing to 100, each at least {@link SHARE_FLOOR}
 * (largest remainder; a tie goes to the catalogue's order). Garbage reads as even.
 */
export function fitShares(raw: Partial<Record<CompanyId, number>>): Shares {
  const vals = COMPANY_IDS.map((c) => {
    const v = raw[c]
    return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0
  })
  const total = vals.reduce((a, b) => a + b, 0)
  const spare = 100 - SHARE_FLOOR * COMPANY_IDS.length
  // Above the floor, the shares split what is left in proportion.
  const above = total > 0 ? vals.map((v) => Math.max(0, v - SHARE_FLOOR)) : vals.map(() => 1)
  const aboveTotal = above.reduce((a, b) => a + b, 0) || 1
  const exact = above.map((v) => (v / aboveTotal) * spare)
  const whole = exact.map(Math.floor)
  let left = spare - whole.reduce((a, b) => a + b, 0)
  const order = exact.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    whole[i]++
    left--
  }
  return Object.fromEntries(COMPANY_IDS.map((c, i) => [c, whole[i] + SHARE_FLOOR])) as Shares
}

/** Whether `s` is a valid share table: every company, whole, at least the floor, summing to 100. */
export const sharesValid = (s: Partial<Record<string, number>>): boolean =>
  COMPANY_IDS.every((c) => Number.isInteger(s[c]) && (s[c] as number) >= SHARE_FLOOR) && COMPANY_IDS.reduce((a, c) => a + (s[c] ?? 0), 0) === 100

/**
 * The shares after `company` gains `delta` points (or loses −`delta`). A gain
 * takes one point at a time from the biggest other share still above the
 * floor; a loss gives one at a time to the smallest. As even as whole points
 * allow; the sum stays 100, and no share leaves the floor.
 */
export function moveShares(shares: Shares, company: CompanyId, delta: number): Shares {
  const out = { ...shares }
  const others = COMPANY_IDS.filter((c) => c !== company)
  const steps = Math.abs(Math.trunc(delta))
  for (let i = 0; i < steps; i++) {
    if (delta > 0) {
      const from = others.filter((c) => out[c] > SHARE_FLOOR).sort((a, b) => out[b] - out[a] || COMPANY_IDS.indexOf(a) - COMPANY_IDS.indexOf(b))[0]
      if (!from) break
      out[from]--
      out[company]++
    } else {
      if (out[company] <= SHARE_FLOOR) break
      const to = [...others].sort((a, b) => out[a] - out[b] || COMPANY_IDS.indexOf(a) - COMPANY_IDS.indexOf(b))[0]
      out[company]--
      out[to]++
    }
  }
  return out
}

/** How a finished contract moves its company's share: + delivered (more for a bigger stake), + a little cashed out, − fallen. */
export function shareMove(status: Exclude<ContractStatus, 'open'>, crates: number): number {
  const k = Math.max(0, Math.min(MAX_CRATES, Math.floor(Number.isFinite(crates) ? crates : 0)))
  if (status === 'delivered') return DELIVERED_SHARE + Math.floor(k / CRATES_PER_EXTRA_SHARE)
  if (status === 'cashedOut') return CASHED_OUT_SHARE
  return -LOST_SHARE
}

/** The shares ranked, biggest first. A tie goes to your deliveries this season, then a hash of the season. */
export function ranked(s: Pick<Season, 'n' | 'shares' | 'deliveries'>): CompanyId[] {
  return [...COMPANY_IDS].sort(
    (a, b) => s.shares[b] - s.shares[a] || (s.deliveries[b] ?? 0) - (s.deliveries[a] ?? 0) || tieOrder(s.n, 'rank', a) - tieOrder(s.n, 'rank', b),
  )
}

/** The company leading the season now. */
export const seasonLeader = (s: Pick<Season, 'n' | 'shares' | 'deliveries'>): CompanyId => ranked(s)[0]

/**
 * The company in last place among those that hire you (`open`) — the one
 * that will post desperate terms. Never the leader; null when no other hires you.
 */
export function seasonLast(s: Pick<Season, 'n' | 'shares' | 'deliveries'>, open: (c: CompanyId) => boolean = () => true): CompanyId | null {
  const order = ranked(s)
  const lead = order[0]
  return [...order].reverse().find((c) => c !== lead && open(c)) ?? null
}

/** The shares regressed halfway to even (whole points, summing to 100): a season's lead carries over, but not all of it. */
export const regressShares = (shares: Shares): Shares => fitShares(Object.fromEntries(COMPANY_IDS.map((c) => [c, (shares[c] + SHARE_START) / 2])) as Shares)

// ---------------------------------------------------------------------------
// The vault
// ---------------------------------------------------------------------------

/**
 * The leader's vault, for its champion: {@link VAULT_PICKS} of its own item
 * kinds (Levels 1–3, never Sovereign), the ones you have not unlocked first,
 * each group in a hash order of (season, company). Taking a locked kind
 * unlocks it; an owned one is a Rare bonus item for the next contract.
 */
export function vaultPicks(company: CompanyId, haveItems: readonly string[], n: number): VaultPick[] {
  const owned = new Set([...BASIC_ITEM_KINDS, ...haveItems])
  const mine = ITEM_KINDS.filter((k) => k.company === company && k.level <= 3).map((k) => k.id)
  const order = (id: string) => hashSeed('trade-war', 'vault', n, company, id)
  const locked = mine.filter((id) => !owned.has(id)).sort((a, b) => order(a) - order(b))
  const have = mine.filter((id) => owned.has(id)).sort((a, b) => order(a) - order(b))
  return [...locked.map((kind) => ({ kind, unlock: true })), ...have.map((kind) => ({ kind, unlock: false }))].slice(0, VAULT_PICKS)
}

// ---------------------------------------------------------------------------
// A finished contract, and the season's end
// ---------------------------------------------------------------------------

/** What the settle tells the war about a finished contract. */
export interface WarContract {
  company: CompanyId | null
  crates: number
  status: Exclude<ContractStatus, 'open'>
  charter?: boolean
}

/**
 * The season after a contract finishes: one more counted, its company's
 * share moved, and a delivery tallied. The Sovereign Route counts but moves
 * nothing. Returns the season as it stands; {@link seasonOver} says whether it
 * must now end.
 */
export function recordContract(s: Season, c: WarContract): Season {
  const company = !c.charter && isCompanyId(c.company) ? c.company : null
  const shares = company ? moveShares(s.shares, company, shareMove(c.status, c.crates)) : { ...s.shares }
  const deliveries = { ...s.deliveries }
  if (company && c.status === 'delivered') deliveries[company] = (deliveries[company] ?? 0) + 1
  return { ...s, contracts: s.contracts + 1, before: { ...s.shares }, shares, deliveries }
}

/** Whether the season has run its {@link SEASON_LENGTH} contracts. */
export const seasonOver = (s: Pick<Season, 'contracts'>): boolean => s.contracts >= SEASON_LENGTH

/**
 * Close a season: the leader, whether you were its champion (and what it
 * pays), the next season's desperate company (last of those that hire you),
 * and the next season — its shares regressed halfway to even, its tallies,
 * its exclusive cleared.
 */
export function endSeason(s: Season, opts: { haveItems: readonly string[]; open?: (c: CompanyId) => boolean }): { next: Season; end: SeasonEnd } {
  const leader = seasonLeader(s)
  const delivered = s.deliveries[leader] ?? 0
  const champion = delivered >= CHAMPION_MIN
  const desperate = seasonLast(s, opts.open)
  const end: SeasonEnd = {
    n: s.n,
    leader,
    share: s.shares[leader],
    delivered,
    champion,
    purse: champion ? CHAMPION_PURSE * delivered : 0,
    vault: champion ? vaultPicks(leader, opts.haveItems, s.n) : [],
    desperate,
    shares: { ...s.shares },
  }
  const shares = regressShares(s.shares)
  return {
    end,
    next: { n: s.n + 1, contracts: 0, shares, before: { ...shares }, deliveries: zeros(), exclusive: null, desperate, ended: end },
  }
}

// ---------------------------------------------------------------------------
// Exclusives, cold rivals, desperate terms
// ---------------------------------------------------------------------------

/** Whether an exclusive may be signed with `company` now: once a season. */
export const canSignExclusive = (s: Pick<Season, 'exclusive'>, company: CompanyId): boolean => s.exclusive == null && isCompanyId(company)

/** The standing XP multiplier an exclusive gives its company's contracts (1 for every other). */
export const exclusiveXpMult = (s: Pick<Season, 'exclusive'>, company: CompanyId | null): number =>
  company && s.exclusive === company ? (rivalOf(company) ? EXCLUSIVE_XP : EXCLUSIVE_XP_UNRIVALLED) : 1

/** Whether `company`'s notice is cold this season: its rival holds your exclusive. */
export const isCold = (s: Pick<Season, 'exclusive'>, company: CompanyId): boolean => !!s.exclusive && rivalOf(s.exclusive) === company

/** The most crates `company` takes at `standing`, this season: one fewer while it is cold (never below one). */
export const seasonCrateCap = (s: Pick<Season, 'exclusive'>, company: CompanyId, standing: number): number =>
  isCold(s, company) ? Math.max(1, crateCap(standing) - COLD_CRATES) : crateCap(standing)

/** Whether a contract with `company` signed now is on desperate terms. */
export const isDesperate = (s: Pick<Season, 'desperate'>, company: CompanyId | null): boolean => !!company && s.desperate === company

// ---------------------------------------------------------------------------
// The save
// ---------------------------------------------------------------------------

const whole = (v: unknown, max: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0)
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function readShares(raw: unknown): Shares {
  if (!isObj(raw)) return evenShares()
  return sharesValid(raw as Record<string, number>) ? (Object.fromEntries(COMPANY_IDS.map((c) => [c, raw[c] as number])) as Shares) : fitShares(raw as Partial<Shares>)
}

function readTally(raw: unknown): Record<CompanyId, number> {
  const o = isObj(raw) ? raw : {}
  return Object.fromEntries(COMPANY_IDS.map((c) => [c, whole(o[c], SEASON_LENGTH)])) as Record<CompanyId, number>
}

function readEnd(raw: unknown): SeasonEnd | null {
  if (!isObj(raw) || !isCompanyId(raw.leader)) return null
  const champion = raw.champion === true
  const delivered = whole(raw.delivered, SEASON_LENGTH)
  const vault = champion && Array.isArray(raw.vault)
    ? raw.vault
        .filter((v): v is { kind: string; unlock?: unknown } => isObj(v) && isItemKind(v.kind) && ITEM_KINDS.find((k) => k.id === v.kind)!.company === raw.leader && ITEM_KINDS.find((k) => k.id === v.kind)!.level <= 3)
        .slice(0, VAULT_PICKS)
        .map((v) => ({ kind: v.kind, unlock: v.unlock === true }))
    : []
  const shares = readShares(raw.shares)
  return {
    n: Math.max(1, whole(raw.n, 1e6)),
    leader: raw.leader,
    share: shares[raw.leader],
    delivered,
    champion,
    // Never more than the rule pays for the deliveries it claims.
    purse: champion ? Math.min(whole(raw.purse, 1e6), CHAMPION_PURSE * delivered) : 0,
    vault: vault.filter((v, i) => vault.findIndex((w) => w.kind === v.kind) === i),
    desperate: isCompanyId(raw.desperate) && raw.desperate !== raw.leader ? raw.desperate : null,
    shares,
  }
}

/**
 * The persisted season, validated (meta v14): every share whole and summing to
 * 100 (else refitted), the count inside a season, the tallies whole and at
 * most a season's, the exclusive and desperate known companies or null, and a
 * pending end only as the rules could have written it. Anything else — and an
 * older save, which has none — is a fresh war.
 */
export function readSeason(raw: unknown): Season {
  if (!isObj(raw)) return freshSeason()
  const shares = readShares(raw.shares)
  const before = isObj(raw.before) ? readShares(raw.before) : { ...shares }
  const deliveries = readTally(raw.deliveries)
  const contracts = Math.min(SEASON_LENGTH - 1, whole(raw.contracts, SEASON_LENGTH))
  // You cannot have delivered more contracts this season than were finished.
  let total = COMPANY_IDS.reduce((a, c) => a + deliveries[c], 0)
  for (const c of [...COMPANY_IDS].reverse()) {
    while (total > contracts && deliveries[c] > 0) {
      deliveries[c]--
      total--
    }
  }
  return {
    n: Math.max(1, whole(raw.n, 1e6)),
    contracts,
    shares,
    before,
    deliveries,
    exclusive: isCompanyId(raw.exclusive) ? raw.exclusive : null,
    desperate: isCompanyId(raw.desperate) ? raw.desperate : null,
    ended: readEnd(raw.ended),
  }
}

/** The desperate terms, in words: "Pays ×1.5 · its raiders 20% stronger". */
export const desperateLine = (): string => `Pays ×${DESPERATE_PAY} · its raiders ${Math.round((DESPERATE_STRENGTH - 1) * 100)}% stronger`
