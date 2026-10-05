import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { sfx } from '../audio/audio'
import { num, numRecord, onStorageKeyChange, safePersistStorage } from './storage'
import { ACHIEVEMENTS, newlyEarned, type RunFacts } from '../game/data/achievements'
import { addFelled, sanitizeFelled } from '../game/data/enemyKnowledge'
import { readMet, type IdeaId } from './staging'
import { rollItemUnlock, rollUnlock, watchLevelFor } from '../game/run/watch'
import { RANDOM_UNLOCK_SKILLS } from '../game/data/skills'
import { UNLOCK_ITEM_KINDS } from '../game/data/itemKinds'
import { COMPANY_IDS, isCompanyId, type CompanyId } from '../game/data/companies'
import { clampCrates, deliveryUnlocks, type StakeRecord } from '../game/run/contracts'
import {
  dealMany,
  rollContractItem,
  rollContractSkill,
  rollStandingCard,
  spreadWatchXp,
  standingFor,
  standingXpFor,
} from '../game/run/standing'
import { readMilitia, type Militia } from '../game/run/militia'

/**
 * What a hub purchase *does* to the game (H15).
 *
 *  - `ramp` makes the player stronger, bounded on purpose: every ramp line caps
 *    in one or two purchases — a first-week leg-up, not a permanent power budget.
 *  - `unlock` makes the *run* wider — more map, more stops, more choices —
 *    without making the player stronger at any of them.
 *
 * Bought with gold from the bank since the mercenary company (gold is the only
 * currency). Build step 3 replaces this list with the HQ's offices.
 */
export type UpgradeKind = 'ramp' | 'unlock'

export interface MetaUpgrade {
  id: string
  name: string
  desc: string
  maxLevel: number
  baseCost: number
  step: number
  kind: UpgradeKind
  /**
   * The feat that makes this purchasable (Phase 3b). A horizontal service is
   * opened by PLAYING — the achievement — and then bought with gold; the ramp
   * needs nothing.
   */
  requires?: string
}

export const UPGRADES: MetaUpgrade[] = [
  // ── the onboarding ramp — bounded on purpose ─────────────────────────────
  // `base` makes the wagons sturdier: a raider who reaches them steals a
  // smaller share of the cargo (the Gate's HP is the cargo's condition).
  { id: 'base', name: 'Reinforced Wagons', desc: 'Raiders who reach your wagons steal less cargo', maxLevel: 2, baseCost: 60, step: 40, kind: 'ramp' },
  { id: 'gold', name: 'War Chest', desc: '+25 gold in every purse, on top of what you take', maxLevel: 2, baseCost: 50, step: 30, kind: 'ramp' },
  { id: 'stats', name: 'Seasoned Recruits', desc: '+1 to all stats on every hero you start with or hire', maxLevel: 2, baseCost: 80, step: 50, kind: 'ramp' },
  { id: 'roster', name: 'Reserve Squad', desc: 'Begin each run with an extra hero', maxLevel: 1, baseCost: 150, step: 150, kind: 'ramp' },
  { id: 'loot', name: 'Quartermaster', desc: 'Begin each run with an extra item', maxLevel: 1, baseCost: 70, step: 60, kind: 'ramp' },

  // ── horizontal unlocks — these widen the run, they do not strengthen you ──
  //
  // All three are graded by the harness on TWO gates (§12): the breadth their
  // card promises has to show up in the generated map, and none of them — alone
  // or in any combination — may lower the measured win rate.
  {
    id: 'cartographer',
    name: "Cartographer's Table",
    desc: 'Your scouts map every fork they can find: three or four roads a layer and never a corridor — the route becomes an argument, not a queue',
    maxLevel: 1,
    baseCost: 120,
    step: 0,
    kind: 'unlock',
  },
  {
    id: 'freeCompanies',
    name: 'Hiring Hall',
    desc: 'A second Recruit stop on every map, and hires arrive trained for the depth you hire them at',
    maxLevel: 1,
    baseCost: 180,
    step: 0,
    kind: 'unlock',
  },
  {
    id: 'standingOrders',
    name: 'Scout Reports',
    desc: 'Your scouts pick the fights: no Elite ever stands on a road with no way around it — every ambush has a way past, if you would rather spend the march elsewhere',
    maxLevel: 1,
    baseCost: 160,
    step: 0,
    kind: 'unlock',
  },
  // ── Phase 3b: services opened by a feat, then bought.
  {
    id: 'fieldKitchen',
    name: 'Field Kitchen',
    desc: 'Every campfire offers a third choice: forage the road for 40 gold instead of resting or training',
    maxLevel: 1,
    baseCost: 220,
    step: 0,
    kind: 'unlock',
    requires: 'act_two',
  },
  {
    id: 'cartulary',
    name: 'Relic Cartulary',
    desc: 'An act boss lays out four relics instead of three — the same prize, a wider pick',
    maxLevel: 1,
    baseCost: 260,
    step: 0,
    kind: 'unlock',
    requires: 'first_light',
  },
]
const UPGRADE_BY_ID = new Map(UPGRADES.map((u) => [u.id, u]))

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

/** Bonuses the meta layer grants to each new run. */
export interface MetaBonuses {
  maxBaseHp: number
  /** Gold the War Chest adds to every purse, free. */
  purseBonus: number
  statBonus: number
  extraSentinels: number
  extraItems: number
  enemyHpMult: number
}

/**
 * What the last settle did for the long game, for the run's receipt (the
 * result screen). Process-local, like `lastFeats`.
 */
export interface RunProgress {
  /** The company the contract was for (null: a run from before contracts). */
  company: CompanyId | null
  /** Standing XP the run earned with it. */
  xp: number
  standingBefore: number
  standingAfter: number
  /** Skill cards the standing levels unlocked, in order. */
  standingCards: string[]
  /** Skill cards the delivery unlocked: the contract's own first, then one per milestone crate. */
  contractCards: string[]
  /** Item kinds the delivery unlocked: the contract's own first, then the stake's item chances. */
  items: string[]
  /** Gold the settle put in the bank (the purse home, the cities' pay, feats). */
  deposit: number
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
  /** The company, stake and how it ended; null for a run with no contract (a save from before contracts). */
  contract: { company: CompanyId; crates: number; status: 'delivered' | 'cashedOut' | 'lost' } | null
  /** Gold back to the bank: what is left of the purse, the cities' pay, any cash-out sale. */
  deposit: number
  /** A custom seed: pays its gold, earns no standing and unlocks nothing. */
  unranked?: boolean
  /** The facts the feats are judged on. Omitted: no feat can be earned. */
  facts?: RunFacts
}

interface MetaState {
  /** Gold at home (the mercenary company): stakes and purses come out of it; city pay and the purse's rest go back in. */
  bank: number
  upgrades: Record<string, number>
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
  upgradeCost: (id: string) => number
  buyUpgrade: (id: string) => void
  /** True once this hub unlock has been bought. */
  unlocked: (id: string) => boolean
  /** Take gold out of the bank. False — and nothing taken — when the bank cannot cover it. */
  withdraw: (n: number) => boolean
  /** Put gold in the bank. */
  deposit: (n: number) => void
  /** Settle a finished contract: bank its gold, pay its standing, deal its unlocks. Returns the gold banked. */
  settleContract: (info: ContractSettle) => number
  bonuses: () => MetaBonuses
  /** True once a feat is earned. */
  achieved: (id: string) => boolean
  /** Whether a hub purchase's feat (if it has one) is earned. */
  purchasable: (id: string) => boolean
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
 */
export const META_VERSION = 8

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
type PersistedMeta = Pick<MetaState, 'bank' | 'upgrades' | 'standing' | 'record' | 'skills' | 'items' | 'stats' | 'achievements' | 'codex' | 'met' | 'militia'>

/**
 * Bring any stored payload up to the current shape, defaulting EVERY numeric
 * field (M11). This store does `x + n` arithmetic, so a field arriving as
 * `undefined` from an older save would become NaN on the first grant and stay
 * NaN forever. Anything unrecognisable becomes its default.
 */
export function migrateMeta(persisted: unknown, version: number): PersistedMeta {
  const o = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>
  const rawStats = (o.stats && typeof o.stats === 'object' ? o.stats : {}) as Record<string, unknown>
  const upgrades = numRecord(o.upgrades)
  for (const u of UPGRADES) {
    if (upgrades[u.id] != null) upgrades[u.id] = Math.max(0, Math.min(u.maxLevel, Math.floor(upgrades[u.id])))
  }
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
  const bank =
    version < 8
      ? Math.max(NEW_BANK, Math.floor(Math.max(0, num(o.watchMarks, 0)) + refund))
      : Math.max(0, Math.floor(num(o.bank, NEW_BANK)))
  const standing = version < 8 ? spreadWatchXp(watchXp) : migrateStanding(o.standing)
  return {
    bank,
    upgrades,
    standing,
    record: migrateRecord(o.record),
    skills,
    items,
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
      standing: freshStanding(),
      record: {},
      skills: [],
      items: [],
      stats: freshStats(),
      achievements: {},
      codex: freshCodex(),
      met: [],
      militia: null,

      upgradeCost: (id) => {
        const u = UPGRADE_BY_ID.get(id)!
        const level = get().upgrades[id] ?? 0
        return u.baseCost + u.step * level
      },

      buyUpgrade: (id) => {
        const u = UPGRADE_BY_ID.get(id)
        if (!u) return
        const { bank, upgrades } = get()
        const level = upgrades[id] ?? 0
        if (level >= u.maxLevel) return
        // A service behind a feat cannot be bought before the feat.
        if (!get().purchasable(id)) return sfx('error')
        const cost = get().upgradeCost(id)
        if (bank < cost) return sfx('error')
        set({ bank: bank - cost, upgrades: { ...upgrades, [id]: level + 1 } })
        sfx('confirm')
      },

      unlocked: (id) => (get().upgrades[id] ?? 0) > 0,

      achieved: (id) => !!get().achievements[id],

      purchasable: (id) => {
        const u = UPGRADE_BY_ID.get(id)
        return !!u && (!u.requires || !!get().achievements[u.requires])
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
        const banked = Math.max(0, Math.round(num(deposit, 0))) + featGold

        // ---- standing with the company, and what it unlocks ----------------
        const company = contract && isCompanyId(contract.company) ? contract.company : null
        const ranked = !!company && !unranked
        const standingXp = { ...freshStanding(), ...get().standing }
        const xpBefore = company ? Math.max(0, num(standingXp[company], 0)) : 0
        const xp = ranked ? standingXpFor({ depth: d, kills: k, delivered: won }) : 0
        const before = standingFor(xpBefore)
        const after = standingFor(xpBefore + xp)
        const have = get().skills
        const haveItems = Array.isArray(get().items) ? get().items : []
        // One card per standing level crossed, each at that level's floor,
        // the company's own cards first.
        const standingCards: string[] = []
        if (company) {
          for (let s = before + 1; s <= after; s++) {
            const c = rollStandingCard([...have, ...standingCards], company, s, runsDone)
            if (c) standingCards.push(c)
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

        lastProgress.run = { company, xp, standingBefore: before, standingAfter: after, standingCards, contractCards, items, deposit: banked, unranked: !!company && unranked }

        // The record: every finished contract at its stake, and whether it arrived.
        const record = { ...get().record }
        if (contract) {
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
          standing: company && xp ? { ...standingXp, [company]: xpBefore + xp } : standingXp,
          record,
          skills: newCards.length ? [...have, ...newCards] : have,
          items: items.length ? [...haveItems, ...items] : haveItems,
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
        const { upgrades } = get()
        const lvl = (id: string) => upgrades[id] ?? 0
        return {
          maxBaseHp: BASE_MAX_HP + lvl('base') * 5,
          purseBonus: lvl('gold') * 25,
          statBonus: lvl('stats'),
          extraSentinels: lvl('roster'),
          extraItems: lvl('loot'),
          // Nothing the hub sells makes the world harder. The stake does.
          enemyHpMult: 1,
        }
      },

      resetMeta: () =>
        set({
          bank: NEW_BANK,
          upgrades: {},
          standing: freshStanding(),
          record: {},
          skills: [],
          items: [],
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
        standing: s.standing,
        record: s.record,
        skills: s.skills,
        items: s.items,
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
