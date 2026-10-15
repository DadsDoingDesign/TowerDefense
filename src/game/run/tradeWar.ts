/**
 * ---------------------------------------------------------------------------
 * The trade war — seasons, market share, your patron (Draft 4 § D, simplified)
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
 *  - **The leader** ({@link seasonLeader}) is the company with the biggest
 *    share — only when it leads outright: a tie (a fresh season's even start
 *    included) crowns nobody. It wears the crown; it pays nothing.
 *  - **Your patron** ({@link seasonPatron}) is the company you delivered the
 *    most contracts for this season — any company, leader or not. A tie on
 *    your deliveries goes to the bigger share, then a hash. No delivery this
 *    season, no patron.
 *  - **The season ends** at the settle of its seventh contract
 *    ({@link endSeason}). Your patron pays you {@link PATRON_PURSE} gold for
 *    each of its contracts you delivered (banked at once) and a **pick from
 *    its vault** ({@link vaultPicks}: three of its own item kinds, the ones
 *    still locked first — a locked kind is unlocked, an owned one comes as a
 *    Rare bonus item for the next contract). The **last** company that hires
 *    you ({@link seasonLast}) posts **desperate terms** for the next season:
 *    its contracts pay ×{@link DESPERATE_PAY}, its raiders are
 *    ×{@link DESPERATE_STRENGTH} (`contracts.contractRules`). Then the shares
 *    **regress halfway to even** ({@link regressShares}): a season's lead
 *    carries over, but not all of it.
 *
 * October 2026 the designer cut the rest ("It doesn't really make sense to
 * me what I'm looking at"): the champion threshold, exclusives, rivals and
 * cold rivals are gone (`docs/MERCENARY_COMPANY.md`, Draft 4 § D).
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
import { COMPANY_IDS, isCompanyId, type CompanyId } from '../data/companies'
import { BASIC_ITEM_KINDS, ITEM_KINDS, isItemKind } from '../data/itemKinds'
import { DESPERATE_PAY, DESPERATE_STRENGTH, marketOpen, MAX_CRATES, type ContractStatus } from './contracts'

export { DESPERATE_PAY, DESPERATE_STRENGTH }

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
/** What your patron pays you at the season's end, per contract of its you delivered this season. */
export const PATRON_PURSE = 75
/** Item kinds your patron's vault offers you to pick one from. */
export const VAULT_PICKS = 3

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
  /** The company that led it outright, or null (a tie at the top crowns nobody). */
  leader: CompanyId | null
  /** Your patron: the company you delivered the most for, which paid you; null when you delivered none. */
  patron: CompanyId | null
  /** Your deliveries for it this season. */
  delivered: number
  /** Gold it paid you (banked at the settle that ended the season). */
  purse: number
  /** Its vault, to pick one from (empty without a patron). */
  vault: VaultPick[]
  /** The company posting desperate terms next season (null: no company is last). */
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
  /**
   * This season's finished contracts, in order: the company when it was
   * delivered, null for a cash-out, a fall or the Sovereign Route. Always as
   * long as {@link Season.contracts}; its companies tally to `deliveries`.
   */
  log: (CompanyId | null)[]
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
  return { n: 1, contracts: 0, shares, before: { ...shares }, deliveries: zeros(), log: [], desperate: null, ended: null }
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

/**
 * The shares ranked, biggest first — the standings' row order. A tie on share
 * goes to your deliveries this season, then a hash of the season; the order
 * is only an order: a tie at the top still crowns nobody ({@link seasonLeader}).
 */
export function ranked(s: Pick<Season, 'n' | 'shares' | 'deliveries'>): CompanyId[] {
  return [...COMPANY_IDS].sort(
    (a, b) => s.shares[b] - s.shares[a] || (s.deliveries[b] ?? 0) - (s.deliveries[a] ?? 0) || tieOrder(s.n, 'rank', a) - tieOrder(s.n, 'rank', b),
  )
}

/** A company's place by share: 1 + the companies with a bigger one, so level shares share a place. */
export const placeOf = (s: Pick<Season, 'shares'>, c: CompanyId): number => 1 + COMPANY_IDS.filter((o) => s.shares[o] > s.shares[c]).length

/** The company leading the season outright (the biggest share, alone), or null: a tie at the top — a fresh season's even start too — crowns nobody. */
export function seasonLeader(s: Pick<Season, 'shares'>): CompanyId | null {
  const top = Math.max(...COMPANY_IDS.map((c) => s.shares[c]))
  const at = COMPANY_IDS.filter((c) => s.shares[c] === top)
  return at.length === 1 ? at[0] : null
}

/**
 * The company in last place among those that hire you (`open`) — the one
 * that will post desperate terms next season. Never the leader. A tie for
 * last goes to the one you delivered fewer for, then a hash of the season.
 * Null when there is no last place: no other company hires you, or every
 * company that does holds the same share.
 */
export function seasonLast(s: Pick<Season, 'n' | 'shares' | 'deliveries'>, open: (c: CompanyId) => boolean = () => true): CompanyId | null {
  const lead = seasonLeader(s)
  const hiring = COMPANY_IDS.filter(open)
  if (hiring.every((c) => s.shares[c] === s.shares[hiring[0]])) return null
  return [...ranked(s)].reverse().find((c) => c !== lead && open(c)) ?? null
}

/**
 * Your patron this season: the company you delivered the most contracts for
 * — any company, leading or not. A tie on your deliveries goes to the bigger
 * share, then a hash of the season. Null when you delivered none.
 */
export function seasonPatron(s: Pick<Season, 'n' | 'shares' | 'deliveries'>): CompanyId | null {
  const got = (c: CompanyId) => s.deliveries[c] ?? 0
  const best = [...COMPANY_IDS].sort((a, b) => got(b) - got(a) || s.shares[b] - s.shares[a] || tieOrder(s.n, 'patron', a) - tieOrder(s.n, 'patron', b))[0]
  return got(best) > 0 ? best : null
}

/**
 * Where you stand with your patron this season, for the standings' card:
 * who it is (or none yet), what it would pay if the season ended now, the
 * companies level with it on your deliveries (a tie, decided by share), and
 * how many contracts are left — the last one said as such.
 */
export interface PatronStatus {
  /** 'none': no delivery yet · 'ahead': one company leads your deliveries · 'tied': two or more are level. */
  state: 'none' | 'ahead' | 'tied'
  patron: CompanyId | null
  /** Your deliveries for it this season. */
  delivered: number
  /** What it pays if the season ended now: {@link PATRON_PURSE} × delivered. */
  purse: number
  /** On a tie: every company level with it on your deliveries, the patron first (the tie-break's order). Else empty. */
  level: CompanyId[]
  /** On a tie: what breaks it now — the bigger share, or (shares level too) the season's hash. */
  breaksBy: 'share' | 'hash' | null
  /** Contracts left in the season, this one included. */
  left: number
  /** The contract you sign next is the season's last. */
  lastContract: boolean
}

export function patronStatus(s: Pick<Season, 'n' | 'contracts' | 'shares' | 'deliveries'>): PatronStatus {
  const patron = seasonPatron(s)
  const left = contractsLeft(s)
  const base = { left, lastContract: left === 1 }
  if (!patron) return { state: 'none', patron: null, delivered: 0, purse: 0, level: [], breaksBy: null, ...base }
  const delivered = s.deliveries[patron] ?? 0
  const level = COMPANY_IDS.filter((c) => (s.deliveries[c] ?? 0) === delivered)
  const tied = level.length > 1
  return {
    state: tied ? 'tied' : 'ahead',
    patron,
    delivered,
    purse: PATRON_PURSE * delivered,
    level: tied ? [patron, ...level.filter((c) => c !== patron).sort((a, b) => s.shares[b] - s.shares[a])] : [],
    breaksBy: !tied ? null : level.some((c) => c !== patron && s.shares[c] === s.shares[patron]) ? 'hash' : 'share',
    ...base,
  }
}

/** The shares regressed halfway to even (whole points, summing to 100): a season's lead carries over, but not all of it. */
export const regressShares = (shares: Shares): Shares => fitShares(Object.fromEntries(COMPANY_IDS.map((c) => [c, (shares[c] + SHARE_START) / 2])) as Shares)

// ---------------------------------------------------------------------------
// The vault
// ---------------------------------------------------------------------------

/**
 * A company's vault, for you as its patron: {@link VAULT_PICKS} of its own item
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
  const delivered = company && c.status === 'delivered' ? company : null
  if (delivered) deliveries[delivered] = (deliveries[delivered] ?? 0) + 1
  return { ...s, contracts: s.contracts + 1, before: { ...s.shares }, shares, deliveries, log: [...(s.log ?? []), delivered] }
}

/** Whether the season has run its {@link SEASON_LENGTH} contracts. */
export const seasonOver = (s: Pick<Season, 'contracts'>): boolean => s.contracts >= SEASON_LENGTH

/**
 * Close a season: the leader (outright, else none), your patron and what it
 * pays (a purse per delivery for it and a pick from its vault — nothing
 * without a delivery), the next season's desperate company (last of those
 * that hire you), and the next season — its shares regressed halfway to
 * even, its tallies cleared.
 */
export function endSeason(s: Season, opts: { haveItems: readonly string[]; open?: (c: CompanyId) => boolean }): { next: Season; end: SeasonEnd } {
  const patron = seasonPatron(s)
  const delivered = patron ? (s.deliveries[patron] ?? 0) : 0
  const desperate = seasonLast(s, opts.open)
  const end: SeasonEnd = {
    n: s.n,
    leader: seasonLeader(s),
    patron,
    delivered,
    purse: PATRON_PURSE * delivered,
    vault: patron ? vaultPicks(patron, opts.haveItems, s.n) : [],
    desperate,
    shares: { ...s.shares },
  }
  const shares = regressShares(s.shares)
  return {
    end,
    next: { n: s.n + 1, contracts: 0, shares, before: { ...shares }, deliveries: zeros(), log: [], desperate, ended: end },
  }
}

/** One of the season's seven bars: the company a finished contract was delivered for, `'miss'` (cashed out, fallen, or your own road), or null (not played yet). */
export type SeasonBar = CompanyId | 'miss' | null

/** The season's {@link SEASON_LENGTH} contracts as bars, in order — for the home's season widget. */
export const seasonBars = (s: Pick<Season, 'contracts' | 'log'>): SeasonBar[] =>
  Array.from({ length: SEASON_LENGTH }, (_, i) => (i < s.contracts ? (s.log[i] ?? 'miss') : null))

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
  if (!isObj(raw)) return null
  // Before the October 2026 simplification an end named the leader and
  // whether you were its champion. A champion's leader paid you: it reads as
  // your patron. An end that paid nothing reads as no page at all (its
  // "you delivered none" would not be true; the standings say the rest).
  const old = !('patron' in raw)
  if (old && !(raw.champion === true && isCompanyId(raw.leader))) return null
  const patron = old ? (raw.leader as CompanyId) : isCompanyId(raw.patron) ? raw.patron : null
  const leader = isCompanyId(raw.leader) ? raw.leader : null
  // A patron is one you delivered for: at least once.
  const delivered = patron ? Math.max(1, whole(raw.delivered, SEASON_LENGTH)) : 0
  const own = (kind: string) => ITEM_KINDS.find((k) => k.id === kind)!
  const vault = patron && Array.isArray(raw.vault)
    ? raw.vault
        .filter((v): v is { kind: string; unlock?: unknown } => isObj(v) && isItemKind(v.kind) && own(v.kind).company === patron && own(v.kind).level <= 3)
        .slice(0, VAULT_PICKS)
        .map((v) => ({ kind: v.kind, unlock: v.unlock === true }))
    : []
  const shares = readShares(raw.shares)
  return {
    n: Math.max(1, whole(raw.n, 1e6)),
    // The crown is the shares' to give: an outright leader only.
    leader: leader && seasonLeader({ shares }) === leader ? leader : null,
    patron,
    delivered,
    // Never more than the rule pays for the deliveries it claims.
    purse: patron ? Math.min(whole(raw.purse, 1e6), PATRON_PURSE * delivered) : 0,
    vault: vault.filter((v, i) => vault.findIndex((w) => w.kind === v.kind) === i),
    desperate: isCompanyId(raw.desperate) && raw.desperate !== leader ? raw.desperate : null,
    shares,
  }
}

/**
 * The season's log, validated: unknown ids read as null, clipped to the
 * contracts finished, and its companies tallying to `deliveries` — else (an
 * older save has none) rebuilt from the tallies as best it can be: the
 * deliveries first, in catalogue order, then the misses.
 */
function readLog(raw: unknown, contracts: number, deliveries: Record<CompanyId, number>): (CompanyId | null)[] {
  const log = Array.isArray(raw) ? raw.slice(0, contracts).map((c) => (isCompanyId(c) ? c : null)) : []
  if (log.length === contracts && COMPANY_IDS.every((c) => log.filter((x) => x === c).length === deliveries[c])) return log
  const rebuilt: (CompanyId | null)[] = COMPANY_IDS.flatMap((c) => Array.from({ length: deliveries[c] }, () => c))
  return [...rebuilt, ...Array.from({ length: contracts - rebuilt.length }, () => null)]
}

/**
 * The persisted season, validated (meta v14): every share whole and summing to
 * 100 (else refitted), the count inside a season, the tallies whole and at
 * most a season's, the log of them in order (`readLog`), the desperate
 * company a known one or null, and a pending
 * end only as the rules could have written it. Anything else — and an older
 * save, which has none — is a fresh war. A save from before the October 2026
 * simplification held an `exclusive`: it is read past and dropped.
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
    log: readLog(raw.log, contracts, deliveries),
    desperate: isCompanyId(raw.desperate) ? raw.desperate : null,
    ended: readEnd(raw.ended),
  }
}

/** The desperate terms, in words: "Pays ×1.5 · its raiders 20% stronger". */
export const desperateLine = (): string => `Pays ×${DESPERATE_PAY} · its raiders ${Math.round((DESPERATE_STRENGTH - 1) * 100)}% stronger`
