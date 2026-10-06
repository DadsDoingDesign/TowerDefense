import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { sfx } from '../audio/audio'
import { num, numRecord, onStorageKeyChange, safePersistStorage } from './storage'
import { ACHIEVEMENTS, newlyEarned, type RunFacts } from '../game/data/achievements'
import { addFelled, sanitizeFelled } from '../game/data/enemyKnowledge'
import { readMet, type IdeaId } from './staging'
import { rollItemUnlock, rollUnlock, watchLevelFor } from '../game/run/watch'
import { RANDOM_UNLOCK_SKILLS } from '../game/data/skills'
import { SOVEREIGN_ITEM_KINDS, UNLOCK_ITEM_KINDS } from '../game/data/itemKinds'
import { rollSovereign } from '../game/run/charter'
import { COMPANY_IDS, isCompanyId, type CompanyId } from '../game/data/companies'
import { clampCrates, deliveryUnlocks, type StakeRecord } from '../game/run/contracts'
import {
  dealRules,
  earnsInterest,
  foldOldHub,
  hqCost,
  hqLevel,
  hqMax,
  FOCUS_ORDER_PRICE,
  interestFor,
  isHqId,
  MAX_BONUS_ITEMS,
  NO_ORDERS,
  PULL_PRICE,
  pullLift,
  refundRetiredHq,
  rollPull,
  runHqFor,
  scoutsAt,
  type DealRules,
  type HqOrders,
  type PullResult,
  type RunHq,
} from '../game/run/hq'
import { isItemKind } from '../game/data/itemKinds'
import { newRunSeed } from '../game/core/rng'
import {
  charterStandingXp,
  dealMany,
  rollContractItem,
  rollContractSkill,
  rollStandingCard,
  spreadWatchXp,
  standingBonusKind,
  standingFor,
  standingXpFor,
} from '../game/run/standing'
import { readMilitia, type Militia } from '../game/run/militia'

/**
 * The HQ (build step 3) replaced the Watchtower's list of hub purchases. Its
 * offices, prices and effects are pure rules in `game/run/hq.ts`; this store
 * keeps the levels bought (`upgrades`, keyed by `HqId`), the company in focus,
 * the orders paid for the next contract, and the sealed crates' ledger.
 */
/**
 * What a Banner rung used to cost, kept ONLY so {@link migrateMeta} can refund
 * it: rung N cost `200 + 150·(N−1)` (v1 saves could hold rungs 4–5).
 */
const LEGACY_BANNER_PRICE = (rung: number): number => 200 + 150 * (rung - 1)
export const legacyBannerRefund = (unlocked: number): number => {
  let total = 0
  for (let r = 1; r <= Math.max(0, Math.floor(unlocked)); r++) total += LEGACY_BANNER_PRICE(r)
  return total
}

export interface MetaStats {
  bestDepth: number
  /** The most crates ever carried to a delivery (0: escorts only, or none yet). */
  bestStake: number
  totalKills: number
  runsCompleted: number
  runsWon: number
}

/** The Codex (Phase 3b): field notes, persisted with the meta save. */
export interface Codex {
  /** Enemy type ids met in a wave (modded ids included — a Warded Bomber is its own entry). */
  enemies: string[]
  /** Relic ids ever taken. */
  relics: string[]
  /** Q10 — enemies felled, by KIND (the key without its elite modifier). */
  felled: Record<string, number>
}
const freshCodex = (): Codex => ({ enemies: [], relics: [], felled: {} })
const strList = (raw: unknown): string[] =>
  Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === 'string'))] : []
function migrateCodex(raw: unknown): Codex {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { enemies: strList(o.enemies), relics: strList(o.relics), felled: sanitizeFelled(o.felled) }
}
function migrateAchievements(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (!raw || typeof raw !== 'object') return out
  const known = new Set(ACHIEVEMENTS.map((a) => a.id))
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (known.has(k)) out[k] = Math.max(1, Math.floor(num(v, 1)))
  }
  return out
}

/** Standing XP per company: known companies only, whole and non-negative. */
function migrateStanding(raw: unknown): Record<CompanyId, number> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return Object.fromEntries(COMPANY_IDS.map((c) => [c, Math.max(0, Math.floor(num(o[c], 0)))])) as Record<CompanyId, number>
}

/** The stake record: crate counts 0–8 only, each with runs ≥ delivered ≥ 0. */
function migrateRecord(raw: unknown): Record<string, StakeRecord> {
  const out: Record<string, StakeRecord> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(k)
    if (!Number.isInteger(n) || n !== clampCrates(n) || !v || typeof v !== 'object') continue
    const r = v as Record<string, unknown>
    const runs = Math.max(0, Math.floor(num(r.runs, 0)))
    const delivered = Math.max(0, Math.min(runs, Math.floor(num(r.delivered, 0))))
    if (runs > 0) out[String(n)] = { runs, delivered }
  }
  return out
}

/** The Sovereign Route's record: charters finished (delivered or fallen), and delivered. */
export interface CharterRecord {
  runs: number
  delivered: number
}

/** The charter record: whole, with delivered ≤ runs. */
function migrateCharters(raw: unknown): CharterRecord {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const runs = Math.max(0, Math.min(1e6, Math.floor(num(o.runs, 0))))
  return { runs, delivered: Math.max(0, Math.min(runs, Math.floor(num(o.delivered, 0)))) }
}

/** The Sovereign kinds owned: known ones, each once, in unlock order. */
const migrateSovereign = (raw: unknown): string[] => {
  const known = new Set(SOVEREIGN_ITEM_KINDS)
  return Array.isArray(raw) ? [...new Set(raw.filter((x): x is string => typeof x === 'string' && known.has(x)))] : []
}

/** What the HQ grants each new run. */
export interface MetaBonuses {
  maxBaseHp: number
  /** HR's Opening deal at its top level: a second hero marches with the first. */
  extraSentinels: number
  enemyHpMult: number
  /** HR's Opening deal: how the hero pick is dealt. */
  deal: DealRules
}

/**
 * What the last settle did for the long game, for the run's receipt (the
 * result screen). Process-local, like `lastFeats`.
 */
export interface RunProgress {
  /** The company the contract was for (null: a run from before contracts, or the Sovereign Route). */
  company: CompanyId | null
  /** The Sovereign Route (the endgame charter). */
  charter: boolean
  /** The Sovereign item kind a delivered charter unlocked (null: none, or every one already owned). */
  sovereign: string | null
  /** Standing XP the run earned with it. */
  xp: number
  standingBefore: number
  standingAfter: number
  /** Skill cards the standing levels unlocked, in order. */
  standingCards: string[]
  /**
   * Standing levels crossed once the card pool was exhausted: each pays a Rare
   * bonus item of `kind` in the next contract's pack (October 2026).
   */
  standingBonus: { company: CompanyId; standing: number; kind: string }[]
  /**
   * The Sovereign Route's standing with each of the five companies (it earns
   * with all of them); null on a company's contract.
   */
  standingAll: { company: CompanyId; before: number; after: number }[] | null
  /** Skill cards the delivery unlocked: the contract's own first, then one per milestone crate. */
  contractCards: string[]
  /** Item kinds the delivery unlocked: the contract's own first, then the stake's item chances. */
  items: string[]
  /** Gold the settle put in the bank (the purse home, the road's share, the cities' pay, feats, interest). */
  deposit: number
  /** Interest the bank earned on this contract (`hq.BASE_INTEREST`; 0 on a lost contract). */
  interest: number
  /** True on a custom seed: it paid its gold, and earned nothing else. */
  unranked: boolean
}
export const lastProgress: { run: RunProgress | null } = { run: null }

/** What a contract's settle reports to the ledger (`settleContract`). */
export interface ContractSettle {
  /** Nodes consumed (the depth the standing XP is paid on). */
  depth: number
  kills: number
  /** The contract was delivered. */
  won: boolean
  /**
   * The company, stake and how it ended; null for a run with no contract (a
   * save from before contracts). The Sovereign Route has no company and is
   * marked `charter`.
   */
  contract: { company: CompanyId | null; crates: number; status: 'delivered' | 'cashedOut' | 'lost'; charter?: boolean } | null
  /** Gold back to the bank: what is left of the purse, the cities' pay, any cash-out sale. */
  deposit: number
  /** A custom seed: pays its gold, earns no standing and unlocks nothing. */
  unranked?: boolean
  /** The facts the feats are judged on. Omitted: no feat can be earned. */
  facts?: RunFacts
}

/** The sealed crates' ledger: the save's crate seed and how many have been opened. */
export interface CrateLedger {
  seed: number
  opened: number
}

interface MetaState {
  /** Gold at home (the mercenary company): stakes and purses come out of it; city pay and the purse's rest go back in. */
  bank: number
  /** HQ levels bought, by `HqId` (`game/run/hq.ts`). */
  upgrades: Record<string, number>
  /** The company in focus (Operations), or null. One at a time. */
  focus: CompanyId | null
  /** Orders paid for the next contract (Operations): spent when a contract is signed. */
  orders: HqOrders
  /** Item kinds owed to the next run as bonus items (a sealed crate's duplicate). */
  bonusItems: string[]
  crates: CrateLedger
  /** What the bank's interest paid on the last finished contract (null: none yet). */
  lastInterest: number | null
  /** Standing XP per company (`run/standing.ts`): standing levels are read off it. */
  standing: Record<CompanyId, number>
  /** Contracts finished and delivered, by crates carried — "your record" on the stakes screen. */
  record: Record<string, StakeRecord>
  /**
   * Skill cards unlocked by standing levels and deliveries, in the order they
   * were unlocked. The starters are everyone's and feat cards follow their
   * feat, so neither is stored. Validated against the library on load.
   */
  skills: string[]
  /** Item KINDS unlocked by deliveries, in unlock order. The basic five are everyone's. */
  items: string[]
  /**
   * The Sovereign tier's kinds owned (Level 4), in unlock order: one per
   * delivered Sovereign Route (`run/charter.rollSovereign`). Dealt at a low
   * weight in every run once owned; never from a sealed crate.
   */
  sovereign: string[]
  /** The Sovereign Route's record (the endgame charter). */
  charters: CharterRecord
  stats: MetaStats
  /** Feats earned (Phase 3b): achievement id → the run count it was earned on. */
  achievements: Record<string, number>
  /** What your militia has seen and used, for the Codex (Phase 3b). */
  codex: Codex
  /** LS3: the ideas this player has met, in the order they first appeared (`state/staging.ts`). */
  met: IdeaId[]
  /**
   * Your militia's name and banner (build step 4) — null until it is raised,
   * after the first finished contract. Validated on load (`run/militia.readMilitia`).
   */
  militia: Militia | null
  // actions
  /** The next level's price, or null when it is maxed or unknown. */
  upgradeCost: (id: string) => number | null
  /** Buy the next level of an HQ purchase from the bank. False when refused. */
  buyUpgrade: (id: string) => boolean
  /**
   * Whether a map or hire service is open, by its old hub name — the HQ's
   * levels behind `run/map.mapOptionsFor` and the hires (`cartographer`,
   * `standingOrders`: the Scouts; `freeCompanies`: the Hiring Hall).
   */
  unlocked: (id: string) => boolean
  /** Put a company in focus (or none). Free; one company at a time. */
  setFocus: (company: CompanyId | null) => void
  /** Pay for an order for the next contract. False when refused. */
  buyOrder: (order: keyof HqOrders) => boolean
  /** What the HQ gives a contract beginning now (orders included, none spent). */
  runHq: () => RunHq
  /** Spend the orders on a signed contract, and hand over the bonus items owed. */
  takeOrders: () => { orders: HqOrders; bonusItems: string[] }
  /** Open a sealed crate: pay, roll, unlock or owe a bonus item. Null when refused. */
  openCrate: () => PullResult | null
  /** Take gold out of the bank. False — and nothing taken — when the bank cannot cover it. */
  withdraw: (n: number) => boolean
  /** Put gold in the bank. */
  deposit: (n: number) => void
  /** Settle a finished contract: bank its gold, pay its standing, deal its unlocks. Returns the gold banked. */
  settleContract: (info: ContractSettle) => number
  bonuses: () => MetaBonuses
  /** True once a feat is earned. */
  achieved: (id: string) => boolean
  /** Add to the Codex. Ids are deduplicated; order of first sighting is kept. */
  recordCodex: (seen: Partial<Omit<Codex, 'felled'>>) => void
  /** Q10 — add one settled wave's kills (by registry key) to the Codex's felled tally. */
  recordFelled: (byKey: Iterable<readonly [string, number]>) => void
  /** LS3 — note ideas as met. Known ids only, each once; a no-op when nothing is new. */
  recordMet: (ids: Iterable<IdeaId>) => void
  /** Raise (or change) the militia's name and banner. An invalid one is ignored. */
  setMilitia: (m: Militia) => void
  resetMeta: () => void
}

const BASE_MAX_HP = 20
/** What a new militia's bank holds: enough for its first purse and a little over. */
export const NEW_BANK = 100

const freshStats = (): MetaStats => ({
  bestDepth: 0,
  bestStake: 0,
  totalKills: 0,
  runsCompleted: 0,
  runsWon: 0,
})
const freshStanding = (): Record<CompanyId, number> => Object.fromEntries(COMPANY_IDS.map((c) => [c, 0])) as Record<CompanyId, number>

/**
 * Persisted meta schema version (M11). Bump this and add a case to
 * {@link migrateMeta} whenever the shape changes.
 *
 * v2 — `stats.bestRound` / `stats.bestDifficulty`; v3 — Banner rungs earned
 * not bought (every mark refunded); v4 — feats and the Codex; v5 — `met`;
 * v6 — SK1 skills, Watch levels and difficulty steps (a played save credited
 * its Watch XP and cards); v7 — item kinds unlock (a played save granted one
 * kind per Watch level past the first).
 *
 * v8 — the mercenary company. **Gold is the only currency**: the Watch Marks a
 * save held become gold in its bank, one for one, and a save never starts
 * below a new militia's {@link NEW_BANK}. **Standing replaces the Watch
 * level**: every skill card and item kind the Watch unlocked is kept, and the
 * Watch XP is spread evenly over the five companies (`spreadWatchXp`) — which
 * deals no new cards, since a level pays only when play crosses it. The
 * difficulty steps, the Daily record and the Endless best are dropped with the
 * systems they recorded (the stake replaces the step); `bestDifficulty`
 * becomes `bestStake` from 0, because a step won is not a crate carried.
 *
 * v9 — the HQ (build step 3). The Watchtower's purchases fold into the
 * offices (`hq.foldOldHub`): the Hiring Hall is kept, Scout Reports (and the
 * Cartographer's Table with it) become the Scouts, and everything else is
 * refunded to the bank at what it cost. New: the focus, the orders, the bonus
 * items owed and the sealed crates' ledger, all empty.
 *
 * v10 — the Sovereign Route (build step 5): the Sovereign kinds owned and the
 * charter record, both empty. Nothing else moves.
 *
 * v11 — the October 2026 designer pass. The Finance office's interest levels
 * and "Fewer boulders" (the permanent levels and the one-contract order) are
 * cut, and refunded to the bank at what they cost (`hq.refundRetiredHq`) —
 * the same pattern as the retired hub's refund at v9. The bank keeps the free
 * base interest. Nothing else moves: the staggered reveal's latches are the
 * `met` list a save already holds, so a player who met the HQ or the crates
 * keeps them.
 */
export const META_VERSION = 11

/** The orders a save holds, as booleans (the boulder order was cut at v11 and refunded). */
const migrateOrders = (raw: unknown): HqOrders => {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { focus: o.focus === true }
}

/** HQ levels: known purchases only, whole, within each one's range. */
function migrateHq(raw: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) if (isHqId(k)) out[k] = Math.max(0, Math.min(hqMax(k), Math.floor(v)))
  return out
}

/** The crates' ledger: a whole positive seed (0: none drawn yet) and a whole count. */
function migrateCrates(raw: unknown): CrateLedger {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const seed = Math.floor(num(o.seed, 0))
  return { seed: seed > 0 && seed <= 0xffffffff ? seed : 0, opened: Math.max(0, Math.min(1e6, Math.floor(num(o.opened, 0)))) }
}

/** The Watch XP a pre-SK1 save is credited (v6): 1 per 10 kills, 60 per win, 45 per run. */
export function retroWatchXp(stats: { totalKills: number; runsWon: number; runsCompleted: number }): number {
  return Math.floor(Math.max(0, stats.totalKills) / 10) + 60 * Math.max(0, stats.runsWon) + 45 * Math.max(0, stats.runsCompleted)
}

/** The cards a fresh unlock run of `n` levels deals onto `have`, in order (v6). */
function dealCards(have: readonly string[], n: number, ...salt: (string | number)[]): string[] {
  const out = [...have]
  for (let i = 0; i < n; i++) {
    const c = rollUnlock(out, ...salt, i)
    if (!c) break
    out.push(c)
  }
  return out.slice(have.length)
}

/** The item kinds a fresh unlock run of `n` steps deals onto `have`, in order (v7). */
export function dealItems(have: readonly string[], n: number, ...salt: (string | number)[]): string[] {
  const out = [...have]
  for (let i = 0; i < n; i++) {
    const c = rollItemUnlock(out, ...salt, i)
    if (!c) break
    out.push(c)
  }
  return out.slice(have.length)
}

/** Persisted slice — the only part of the store that survives a reload. */
type PersistedMeta = Pick<
  MetaState,
  | 'bank'
  | 'upgrades'
  | 'focus'
  | 'orders'
  | 'bonusItems'
  | 'crates'
  | 'lastInterest'
  | 'standing'
  | 'record'
  | 'skills'
  | 'items'
  | 'sovereign'
  | 'charters'
  | 'stats'
  | 'achievements'
  | 'codex'
  | 'met'
  | 'militia'
>

/**
 * Bring any stored payload up to the current shape, defaulting EVERY numeric
 * field (M11). This store does `x + n` arithmetic, so a field arriving as
 * `undefined` from an older save would become NaN on the first grant and stay
 * NaN forever. Anything unrecognisable becomes its default.
 */
export function migrateMeta(persisted: unknown, version: number): PersistedMeta {
  const o = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>
  const rawStats = (o.stats && typeof o.stats === 'object' ? o.stats : {}) as Record<string, unknown>
  // v9: the Watchtower's purchases fold into the HQ's offices; the rest is
  // refunded to the bank (only on a real version step — `merge` calls this on
  // every load).
  const fold = version < 9 ? foldOldHub(numRecord(o.upgrades)) : null
  const upgrades = fold ? migrateHq(fold.levels as Record<string, number>) : migrateHq(numRecord(o.upgrades))
  // v11: Finance's levels and "Fewer boulders" (and an unspent boulder order)
  // are refunded. A v9/v10 save is the only one that can hold them; again only
  // on a real version step.
  const retired = version >= 9 && version < 11 ? refundRetiredHq(numRecord(o.upgrades), o.orders) : 0
  // v3: Banner rungs were bought with marks until then; every one is given back
  // (as gold now). Only on a real version step — `merge` calls this with
  // META_VERSION on every load, and a refund there would pay on every boot.
  const rawTier = Math.max(0, Math.floor(num(o.topDifficulty ?? o.sacrificeTier, 0)))
  const refund = version < 3 ? legacyBannerRefund(rawTier) : 0
  const stats: MetaStats = {
    bestDepth: Math.max(0, num(rawStats.bestDepth, 0)),
    bestStake: clampCrates(num(rawStats.bestStake, 0)),
    totalKills: Math.max(0, num(rawStats.totalKills, 0)),
    runsCompleted: Math.max(0, num(rawStats.runsCompleted, 0)),
    runsWon: Math.max(0, num(rawStats.runsWon, 0)),
  }
  // Only the random cards are stored, each once, in unlock order.
  const known = new Set(RANDOM_UNLOCK_SKILLS)
  let skills = Array.isArray(o.skills) ? [...new Set(o.skills.filter((x): x is string => typeof x === 'string' && known.has(x)))] : []
  let watchXp = Math.max(0, Math.floor(num(o.watchXp, 0)))
  // v6: a save that played before skills is credited the Watch XP its record
  // implies, and the cards those levels unlock.
  if (version < 6 && watchXp === 0 && stats.runsCompleted > 0) {
    watchXp = retroWatchXp(stats)
    skills = [...skills, ...dealCards(skills, watchLevelFor(watchXp) - 1, 'v6', stats.runsCompleted)]
  }
  // v7: item kinds, each once, known ones only, in unlock order.
  const kinds = new Set(UNLOCK_ITEM_KINDS)
  let items = Array.isArray(o.items) ? [...new Set(o.items.filter((x): x is string => typeof x === 'string' && kinds.has(x)))] : []
  if (version < 7 && items.length === 0) items = dealItems([], watchLevelFor(watchXp) - 1, 'v7', stats.runsCompleted)
  // v8: Marks become gold; the Watch XP is spread over the companies.
  const bank0 =
    version < 8
      ? Math.max(NEW_BANK, Math.floor(Math.max(0, num(o.watchMarks, 0)) + refund))
      : Math.max(0, Math.floor(num(o.bank, NEW_BANK)))
  const bank = Math.min(1e9, bank0 + (fold?.refund ?? 0) + retired)
  const standing = version < 8 ? spreadWatchXp(watchXp) : migrateStanding(o.standing)
  const lastInterest = o.lastInterest == null ? null : Math.max(0, Math.min(1e6, Math.floor(num(o.lastInterest, 0))))
  return {
    bank,
    upgrades,
    focus: isCompanyId(o.focus) ? o.focus : null,
    orders: migrateOrders(o.orders),
    bonusItems: Array.isArray(o.bonusItems) ? o.bonusItems.filter(isItemKind).slice(0, MAX_BONUS_ITEMS) : [],
    crates: migrateCrates(o.crates),
    lastInterest,
    standing,
    record: migrateRecord(o.record),
    skills,
    items,
    sovereign: migrateSovereign(o.sovereign),
    charters: migrateCharters(o.charters),
    stats,
    achievements: migrateAchievements(o.achievements),
    codex: migrateCodex(o.codex),
    met: readMet(o.met),
    militia: readMilitia(o.militia),
  }
}

/**
 * The feats the most recent settle earned — read by the run's receipt right
 * after it settles. Process-local, not persisted: the ledger is `achievements`.
 */
export const lastFeats: { ids: string[] } = { ids: [] }

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => ({
      bank: NEW_BANK,
      upgrades: {},
      focus: null,
      orders: { ...NO_ORDERS },
      bonusItems: [],
      crates: { seed: 0, opened: 0 },
      lastInterest: null,
      standing: freshStanding(),
      record: {},
      skills: [],
      items: [],
      sovereign: [],
      charters: { runs: 0, delivered: 0 },
      stats: freshStats(),
      achievements: {},
      codex: freshCodex(),
      met: [],
      militia: null,

      upgradeCost: (id) => (isHqId(id) ? hqCost(id, hqLevel(get().upgrades, id)) : null),

      buyUpgrade: (id) => {
        if (!isHqId(id)) return false
        const { bank, upgrades } = get()
        const level = hqLevel(upgrades, id)
        const cost = hqCost(id, level)
        if (cost == null) return false
        if (bank < cost) {
          sfx('error')
          return false
        }
        set({ bank: bank - cost, upgrades: { ...upgrades, [id]: level + 1 } })
        sfx('confirm')
        return true
      },

      unlocked: (id) => {
        const u = get().upgrades
        const scouts = scoutsAt(hqLevel(u, 'scouting'))
        if (id === 'cartographer') return scouts.wideMap
        if (id === 'standingOrders') return scouts.standingOrders
        if (id === 'freeCompanies') return hqLevel(u, 'hiring') > 0
        return false
      },

      achieved: (id) => !!get().achievements[id],

      setFocus: (company) => {
        const next = company && isCompanyId(company) ? company : null
        if (next !== get().focus) set({ focus: next })
      },

      buyOrder: (order) => {
        const { bank, orders, focus } = get()
        if (order !== 'focus' || orders[order]) return false
        // A focus order needs a company in focus to push.
        if (!focus) return false
        const price = FOCUS_ORDER_PRICE
        if (bank < price) {
          sfx('error')
          return false
        }
        set({ bank: bank - price, orders: { ...orders, [order]: true } })
        sfx('confirm')
        return true
      },

      runHq: () => {
        const { upgrades, focus, orders } = get()
        return runHqFor(upgrades, focus, orders)
      },

      takeOrders: () => {
        const { orders, bonusItems } = get()
        set({ orders: { ...NO_ORDERS }, bonusItems: [] })
        return { orders, bonusItems }
      },

      openCrate: () => {
        const { bank, crates, items, standing, bonusItems } = get()
        if (bank < PULL_PRICE) {
          sfx('error')
          return null
        }
        // The save's crates are seeded once, at the first one opened; crate n
        // is a hash of (that seed, n) — its own stream, never a run's.
        const seed = crates.seed || newRunSeed() >>> 0 || 1
        const have = Array.isArray(items) ? items : []
        const got = rollPull(seed, crates.opened, pullLift(standing), have)
        set({
          bank: bank - PULL_PRICE,
          crates: { seed, opened: crates.opened + 1 },
          items: got.duplicate ? have : [...have, got.kind],
          bonusItems: got.duplicate ? [...bonusItems, got.kind].slice(0, MAX_BONUS_ITEMS) : bonusItems,
        })
        sfx('coin')
        return got
      },

      withdraw: (n) => {
        const amount = Math.max(0, Math.floor(num(n, 0)))
        const bank = Math.max(0, num(get().bank, 0))
        if (amount > bank) return false
        if (amount) set({ bank: bank - amount })
        return true
      },

      deposit: (n) => {
        const amount = Math.max(0, Math.round(num(n, 0)))
        if (amount) set({ bank: Math.max(0, num(get().bank, 0)) + amount })
      },

      recordCodex: (seen) => {
        const cur = get().codex
        const merge = (a: string[], b?: string[]) => (b && b.some((x) => !a.includes(x)) ? [...a, ...b.filter((x, i) => !a.includes(x) && b.indexOf(x) === i)] : a)
        const next: Codex = { enemies: merge(cur.enemies, seen.enemies), relics: merge(cur.relics, seen.relics), felled: cur.felled }
        if (next.enemies !== cur.enemies || next.relics !== cur.relics) set({ codex: next })
      },

      recordMet: (ids) => {
        const cur = get().met
        const next = readMet([...cur, ...ids])
        if (next.length !== cur.length) set({ met: next })
      },

      recordFelled: (byKey) => {
        const cur = get().codex
        const felled = addFelled(cur.felled, byKey)
        if (felled) set({ codex: { ...cur, felled } })
      },

      settleContract: ({ depth, won, kills, contract, deposit, unranked = false, facts }) => {
        const { stats, achievements } = get()
        const d = Math.max(0, num(depth, 0))
        const k = Math.max(0, num(kills, 0))
        // Feats: judged on the facts this run leaves, earned once, each paying
        // its purse into the bank.
        const feats = facts ? newlyEarned(facts, achievements) : []
        const runsDone = num(stats.runsCompleted, 0) + 1
        const featGold = feats.reduce((a, f) => a + f.gold, 0)
        lastFeats.ids = feats.map((f) => f.id)
        // The bank: a finished contract (delivered or cashed out, never lost)
        // earns interest on the gold left at home — the bank before this
        // settle's deposit lands — capped per contract (`hq.BASE_INTEREST`, a
        // plain rule since the Finance office was cut). A custom seed earns
        // none, as it earns no standing.
        const status = contract?.status ?? 'lost'
        const paysInterest = !!contract && !unranked && earnsInterest(status)
        const interest = paysInterest ? interestFor(num(get().bank, 0)) : 0
        const banked = Math.max(0, Math.round(num(deposit, 0))) + featGold + interest

        // ---- standing with the company, and what it unlocks ----------------
        const company = contract && isCompanyId(contract.company) ? contract.company : null
        const charter = !!contract?.charter
        const ranked = !!company && !unranked
        const standingXp = { ...freshStanding(), ...get().standing }
        const xpBefore = company ? Math.max(0, num(standingXp[company], 0)) : 0
        const xp = ranked ? standingXpFor({ depth: d, kills: k, delivered: won }) : 0
        const before = standingFor(xpBefore)
        const after = standingFor(xpBefore + xp)
        const have = get().skills
        const haveItems = Array.isArray(get().items) ? get().items : []
        // The Sovereign Route earns standing with all five companies — each
        // what an escort that ended the same way earns with its one (October
        // 2026). A custom seed earns none.
        const gains: Partial<Record<CompanyId, number>> = charter && !unranked ? charterStandingXp({ depth: d, kills: k, delivered: won }) : company && xp ? { [company]: xp } : {}
        const nextStanding = { ...standingXp }
        // One card per standing level crossed, each at that level's floor,
        // the company's own cards first. Once the card pool is exhausted, a
        // level pays a Rare bonus item for the next contract instead — a hash
        // of its own parts, never a run stream.
        const standingCards: string[] = []
        const standingBonus: RunProgress['standingBonus'] = []
        const standingAll: NonNullable<RunProgress['standingAll']> = []
        for (const c of COMPANY_IDS) {
          const gain = gains[c] ?? 0
          if (!gain) continue
          const from = Math.max(0, num(standingXp[c], 0))
          const lvBefore = standingFor(from)
          const lvAfter = standingFor(from + gain)
          nextStanding[c] = from + gain
          if (charter) standingAll.push({ company: c, before: lvBefore, after: lvAfter })
          for (let s = lvBefore + 1; s <= lvAfter; s++) {
            const card = rollStandingCard([...have, ...standingCards], c, s, runsDone)
            if (card) standingCards.push(card)
            else standingBonus.push({ company: c, standing: s, kind: standingBonusKind(haveItems, c, s, runsDone) })
          }
        }
        // A delivery: the contract's skill and item, a skill per milestone
        // crate and the stake's item chances — the floor rising with the stake.
        const crates = contract ? clampCrates(contract.crates) : 0
        const owed = ranked && won && contract?.status === 'delivered' ? deliveryUnlocks(crates) : { skills: 0, items: 0 }
        const contractCards = company
          ? dealMany([...have, ...standingCards], owed.skills, (h, i) => rollContractSkill(h, company, crates, runsDone, i))
          : []
        const items = company ? dealMany(haveItems, owed.items, (h, i) => rollContractItem(h, company, crates, runsDone, i)) : []

        // The Sovereign Route (the endgame charter): a delivery unlocks one
        // Sovereign kind still locked — a hash of the charter count, never a
        // run stream. A custom seed unlocks nothing, as ever.
        const charters = migrateCharters(get().charters)
        const owned = migrateSovereign(get().sovereign)
        const sovereign = charter && won && contract?.status === 'delivered' && !unranked ? rollSovereign(owned, charters.delivered, runsDone) : null

        lastProgress.run = {
          company,
          charter,
          sovereign,
          // The Sovereign Route's XP is the same with each of the five.
          xp: charter ? (Object.values(gains)[0] ?? 0) : xp,
          standingBefore: before,
          standingAfter: after,
          standingCards,
          standingBonus,
          standingAll: charter ? standingAll : null,
          contractCards,
          items,
          deposit: banked,
          interest,
          unranked: (!!company || charter) && unranked,
        }

        // The record: every finished contract at its stake, and whether it
        // arrived. A charter has its own record — it is no stake.
        const record = { ...get().record }
        if (contract && !charter) {
          const key = String(crates)
          const cur = record[key] ?? { runs: 0, delivered: 0 }
          record[key] = { runs: cur.runs + 1, delivered: cur.delivered + (won ? 1 : 0) }
        }
        const newCards = [...standingCards, ...contractCards]

        // Every read is coerced: this is `x + n` arithmetic over a persisted
        // record, and one field arriving as `undefined` would turn a stat into
        // NaN permanently (M11).
        set({
          bank: Math.max(0, num(get().bank, 0)) + banked,
          ...(paysInterest ? { lastInterest: interest } : {}),
          standing: nextStanding,
          // A standing level past the card pool owes a Rare bonus item to the
          // next contract (`hq.bonusItemsFor`), as a sealed crate's duplicate does.
          ...(standingBonus.length ? { bonusItems: [...get().bonusItems, ...standingBonus.map((b) => b.kind)].slice(0, MAX_BONUS_ITEMS) } : {}),
          record,
          skills: newCards.length ? [...have, ...newCards] : have,
          items: items.length ? [...haveItems, ...items] : haveItems,
          ...(charter ? { charters: { runs: charters.runs + 1, delivered: charters.delivered + (won ? 1 : 0) } } : {}),
          ...(sovereign ? { sovereign: [...owned, sovereign] } : {}),
          achievements: feats.length ? { ...achievements, ...Object.fromEntries(feats.map((f) => [f.id, runsDone])) } : achievements,
          stats: {
            bestDepth: Math.max(num(stats.bestDepth, 0), d),
            bestStake: won ? Math.max(num(stats.bestStake, 0), crates) : num(stats.bestStake, 0),
            totalKills: num(stats.totalKills, 0) + k,
            runsCompleted: runsDone,
            runsWon: num(stats.runsWon, 0) + (won ? 1 : 0),
          },
        })
        return banked
      },

      setMilitia: (m) => {
        const militia = readMilitia(m)
        if (militia) set({ militia })
      },

      bonuses: () => {
        const deal = dealRules(hqLevel(get().upgrades, 'deal'))
        return {
          // Nothing the HQ sells makes the wagons sturdier or the world harder:
          // the stake is the difficulty dial, and Assist softens a leak.
          maxBaseHp: BASE_MAX_HP,
          extraSentinels: deal.second ? 1 : 0,
          enemyHpMult: 1,
          deal,
        }
      },

      resetMeta: () =>
        set({
          bank: NEW_BANK,
          upgrades: {},
          focus: null,
          orders: { ...NO_ORDERS },
          bonusItems: [],
          crates: { seed: 0, opened: 0 },
          lastInterest: null,
          standing: freshStanding(),
          record: {},
          skills: [],
          items: [],
          sovereign: [],
          charters: { runs: 0, delivered: 0 },
          stats: freshStats(),
          achievements: {},
          codex: freshCodex(),
          met: [],
          militia: null,
        }),
    }),
    {
      name: 'fieldwatch-meta',
      version: META_VERSION,
      storage: createJSONStorage(() => safePersistStorage),
      partialize: (s) => ({
        bank: s.bank,
        upgrades: s.upgrades,
        focus: s.focus,
        orders: s.orders,
        bonusItems: s.bonusItems,
        crates: s.crates,
        lastInterest: s.lastInterest,
        standing: s.standing,
        record: s.record,
        skills: s.skills,
        items: s.items,
        sovereign: s.sovereign,
        charters: s.charters,
        stats: s.stats,
        achievements: s.achievements,
        codex: s.codex,
        met: s.met,
        militia: s.militia,
      }),
      migrate: migrateMeta,
      // `migrate` only runs when the stored version differs, so the coercion is
      // also applied through `merge` — a payload that is the current version but
      // corrupt still lands as defaults instead of NaN.
      merge: (persisted, current) => ({ ...current, ...migrateMeta(persisted, META_VERSION) }),
    },
  ),
)

// Another tab's bank and unlocks land here instead of being overwritten by
// this tab's stale copy on its next save (see onStorageKeyChange).
onStorageKeyChange('fieldwatch-meta', () => void useMetaStore.persist.rehydrate())
