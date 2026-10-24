/**
 * ---------------------------------------------------------------------------
 * Company asks (Draft 4 · A — companies as sponsors)
 * ---------------------------------------------------------------------------
 *
 * Every company contract wants something of the run: it is dealt **two asks**
 * from that company's own list ({@link ASKS}). Picking a company is picking a
 * way to run the road. The Sovereign Route — your own road — is dealt **three
 * asks from three different companies' lists** ("a mix of any and all"), and
 * each one met pays standing with the company whose ask it is.
 *
 * What an ask pays ({@link ASK_STANDING}, {@link ASK_TIP}): standing XP with
 * its company on any finish that earns standing (delivered, cashed out or
 * fallen; never a custom seed), and a gold tip the destination pays, so only
 * on a delivery. An ask judged at the end ({@link AskDef.atEnd}: the cargo
 * delivered, the road's gold in hand) can only be met by a delivery.
 *
 * The run carries its asks on the contract (`RunContract.asks`): each one's
 * id, its target as dealt, and what has been counted so far. Counts move at
 * the end of a fight (kills, clean fights, elites, city fights), at a
 * merchant's sale and at a shrine's pact ({@link tallyAsks}). Two of the
 * stats are never counted, because the contract already holds them: the gold
 * the road has paid (`contract.earned`) and, at the destination, the cargo
 * that arrived and the road's gold in hand ({@link askGot}).
 *
 * Pure: no store, no React, no DOM — and **no run-stream draw**. The deal is a
 * hash of (run seed, company) (RNG draw order is behaviour). The store, the UI
 * and the balance harness all read these rules, so none of them can drift.
 */
import { hashSeed } from '../core/rng'
import { COMPANY_IDS, isCompanyId, type CompanyId } from '../data/companies'
import { CITY_COUNT, cityOfLayer, type RunContract } from './contracts'
import { homeGold } from './hq'

// ---------------------------------------------------------------------------
// The numbers (placeholders for the tuning pass)
// ---------------------------------------------------------------------------

/** Standing XP an ask met pays its company, on any finish that earns standing. */
export const ASK_STANDING = 40
/** Gold an ask met tips into the bank — the destination pays it, so a delivery only. */
export const ASK_TIP = 25
/** Asks a company contract is dealt from its own list. */
export const ASKS_PER_CONTRACT = 2
/** Asks the Sovereign Route is dealt: one from each of three companies' lists. */
export const ASKS_PER_CHARTER = 3
/** The most asks any contract carries (the snapshot's cap). */
export const MAX_ASKS = ASKS_PER_CHARTER

// ---------------------------------------------------------------------------
// The lists
// ---------------------------------------------------------------------------

/** What an ask counts. */
export type AskStat =
  /** Raiders felled. */
  | 'kills'
  /** Raiders felled while they burn (the engine's `burningKills`). */
  | 'burnKills'
  /** Plated raiders felled (`killsByKey`, keys ending `_plated`). */
  | 'platedKills'
  /** Warded raiders felled (`killsByKey`, keys ending `_warded`). */
  | 'wardedKills'
  /** Fights won without a leak: no raider reached the wagons, and no cargo lost. */
  | 'cleanFights'
  /** City fights (an act boss, the destination's included) won without a leak. */
  | 'cleanCities'
  /** Elite fights won. */
  | 'eliteWins'
  /** Wares bought from merchants (the Gate repair is a service, not a ware). */
  | 'wares'
  /** Shrine pacts accepted. */
  | 'pacts'
  /** Gold the road paid into the purse (`contract.earned`) — never counted, read. */
  | 'earned'
  /** The cargo that reached the destination, in whole percent — judged at the end. */
  | 'cargo'
  /** The road's gold in the purse at the destination (`hq.homeGold`) — judged at the end. */
  | 'roadGold'

/** The stats a run COUNTS (the rest are read off the contract). */
export type CountedStat = Exclude<AskStat, 'earned' | 'cargo' | 'roadGold'>

export interface AskDef {
  id: string
  company: CompanyId
  stat: AskStat
  /** The target the ask is dealt with (a contract keeps the target it was dealt). */
  target: number
  /** Judged at the destination: only a delivery can meet it. */
  atEnd?: boolean
  /** The ask, in the company's words, at a target: "Fell 30 Plated raiders". */
  text: (n: number) => string
  /** What the count is, for a progress line or a toast: "Plated felled". */
  label: string
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

const felled = (n: number) => `Fell ${n} raiders`
const cleanFights = (n: number) => `Win ${n} fights without a leak`
const cleanCities = (n: number) => (n === 1 ? 'Win a city fight without a leak' : n >= CITY_COUNT ? 'Win every city fight without a leak' : `Win ${n} city fights without a leak`)

/**
 * Every company's three asks, in catalogue order. The targets were fitted with
 * the balance harness so a typical delivered escort meets each about half the
 * time (`npx tsx balance/ask-rates.ts 400`: an escort on the company's own
 * road, the zero-meta and the veteran company pooled, delivered runs only).
 * Fitted 2026-10-14, met rate pooled (spec start → fit):
 *
 *   spice.burning 40 → 120 (51%)    spice.clean 3 → 7 (52%)    spice.felled 120 → 260 (58%)
 *   art.cargo 90% → 100% (52%)      art.cities 2 → 3 (35%)     art.clean 4 → 7 (53%)
 *   metals.plated 30 → 25 (50%)     metals.elite 1 → 2 (42%)   metals.felled 150 → 290 (41%)
 *   silk.wares 2 → 4 (48%)          silk.roadGold 150 → 3,500 (55%)   silk.earned 200 → 3,900 (49%)
 *   scrolls.pact 1 (7%)             scrolls.warded 30 → 35 (50%)      scrolls.city 1 → 2 (75%)
 *
 * The two city asks cannot land in the band (three cities: 2 is 75%, 3 is
 * 35%), and the pact is a road you choose — the modelled player rarely walks
 * to a shrine, a player the map tags it for can.
 *
 * Each company's asks fit its own pieces without saying so — a company's
 * skills and items are dealt twice as often on its road (`contracts.weightPool`):
 * Peppercorn's burns, Ironvein's plate-breakers. **Never explain the combo**:
 * an ask says what it wants, a piece says what it does.
 */
export const ASKS: readonly AskDef[] = [
  // Peppercorn Co. — fire, a clean road, a big tally.
  { id: 'spice.burning', company: 'spice', stat: 'burnKills', target: 120, text: (n) => `Fell ${n} raiders while they burn`, label: 'Felled while burning' },
  { id: 'spice.clean', company: 'spice', stat: 'cleanFights', target: 7, text: cleanFights, label: 'Fights without a leak' },
  { id: 'spice.felled', company: 'spice', stat: 'kills', target: 260, text: felled, label: 'Raiders felled' },
  // Butcherblock — the meat, kept fresh: the cargo unharmed.
  { id: 'art.cargo', company: 'art', stat: 'cargo', target: 100, atEnd: true, text: (n) => (n >= 100 ? 'Deliver with full cargo' : `Deliver with ${n}% cargo`), label: 'Cargo' },
  { id: 'art.cities', company: 'art', stat: 'cleanCities', target: 3, text: cleanCities, label: 'City fights without a leak' },
  { id: 'art.clean', company: 'art', stat: 'cleanFights', target: 7, text: cleanFights, label: 'Fights without a leak' },
  // Ironvein — plate, elites, a bigger tally.
  { id: 'metals.plated', company: 'metals', stat: 'platedKills', target: 25, text: (n) => `Fell ${n} Plated raiders`, label: 'Plated felled' },
  { id: 'metals.elite', company: 'metals', stat: 'eliteWins', target: 2, text: (n) => (n === 1 ? 'Win an elite fight' : `Win ${n} elite fights`), label: 'Elite fights won' },
  { id: 'metals.felled', company: 'metals', stat: 'kills', target: 290, text: felled, label: 'Raiders felled' },
  // Rosethread — trade on the road.
  { id: 'silk.wares', company: 'silk', stat: 'wares', target: 4, text: (n) => (n === 1 ? 'Buy a ware from a merchant' : `Buy ${n} wares from merchants`), label: 'Wares bought' },
  { id: 'silk.roadGold', company: 'silk', stat: 'roadGold', target: 3500, atEnd: true, text: (n) => `Deliver with ${n.toLocaleString('en')} road gold`, label: 'Road gold' },
  { id: 'silk.earned', company: 'silk', stat: 'earned', target: 3900, text: (n) => `Earn ${n.toLocaleString('en')} gold on the road`, label: 'Gold earned' },
  // Greenvial — pacts and wards.
  { id: 'scrolls.pact', company: 'scrolls', stat: 'pacts', target: 1, text: (n) => (n === 1 ? 'Accept a shrine pact' : `Accept ${n} shrine pacts`), label: 'Pacts accepted' },
  { id: 'scrolls.warded', company: 'scrolls', stat: 'wardedKills', target: 35, text: (n) => `Fell ${n} Warded raiders`, label: 'Warded felled' },
  { id: 'scrolls.city', company: 'scrolls', stat: 'cleanCities', target: 2, text: cleanCities, label: 'City fights without a leak' },
]

const BY_ID = new Map(ASKS.map((a) => [a.id, a]))

/** An ask's definition, or undefined for an id the catalogue does not know. */
export const askById = (id: string): AskDef | undefined => BY_ID.get(id)

/** A company's own list, in catalogue order. */
export const asksOf = (company: CompanyId): AskDef[] => ASKS.filter((a) => a.company === company)

// ---------------------------------------------------------------------------
// The deal
// ---------------------------------------------------------------------------

/** One ask as a run carries it: its id, the target it was dealt, and what has been counted. */
export interface RunAsk {
  id: string
  target: number
  got: number
}

/**
 * The asks a contract is dealt: two distinct asks from `company`'s list, or —
 * on the Sovereign Route (`company` null) — three asks from three different
 * companies' lists, no two counting the same thing. A hash of (run seed,
 * company), never a run-stream draw; the order is the catalogue's, so the
 * terms, the road and the receipt list them alike.
 */
export function dealAsks(runSeed: number, company: CompanyId | null): AskDef[] {
  if (company) {
    const list = asksOf(company)
    const skip = hashSeed(runSeed, 'ask', company) % list.length
    return list.filter((_, i) => i !== skip).slice(0, ASKS_PER_CONTRACT)
  }
  // The Sovereign Route: three companies, each in a hashed order, one ask
  // each — the first of its list (in its own hashed order) whose stat no
  // earlier pick counts.
  const cos = [...COMPANY_IDS].sort((a, b) => hashSeed(runSeed, 'ask-co', a) - hashSeed(runSeed, 'ask-co', b)).slice(0, ASKS_PER_CHARTER)
  const out: AskDef[] = []
  for (const c of cos) {
    const list = asksOf(c)
    const start = hashSeed(runSeed, 'ask', c) % list.length
    for (let k = 0; k < list.length; k++) {
      const a = list[(start + k) % list.length]
      if (!out.some((o) => o.stat === a.stat)) {
        out.push(a)
        break
      }
    }
  }
  return ASKS.filter((a) => out.includes(a))
}

/** A contract's asks as dealt, nothing counted yet. */
export const freshAsks = (runSeed: number, company: CompanyId | null): RunAsk[] => dealAsks(runSeed, company).map((a) => ({ id: a.id, target: a.target, got: 0 }))

// ---------------------------------------------------------------------------
// Counting
// ---------------------------------------------------------------------------

/** What moved a run's counts: a fight's tally, a sale, a pact. */
export type AskTally = Partial<Record<CountedStat, number>>

const whole = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0)

/**
 * The contract after `t` was counted. Only the asks whose stat moved change;
 * a contract with no asks (an older save, a first contract) is returned as it
 * was, and null stays null.
 */
export function tallyAsks<C extends Pick<RunContract, 'asks'> | null>(c: C, t: AskTally): C {
  if (!c?.asks?.length) return c
  let moved = false
  const asks = c.asks.map((a) => {
    const def = askById(a.id)
    const n = def && def.stat in t ? whole(t[def.stat as CountedStat]) : 0
    if (!n) return a
    moved = true
    return { ...a, got: a.got + n }
  })
  return moved ? ({ ...c, asks } as C) : c
}

/** The engine's counters a fight's tally is read from (`GameEngine`). */
export interface FightCounts {
  killCount: number
  burningKills: number
  killsByKey: ReadonlyMap<string, number>
}

/** Kills by armour, off the engine's registry keys (`barrel3_plated`). */
const keyed = (byKey: ReadonlyMap<string, number>, suffix: string): number => {
  let n = 0
  for (const [k, v] of byKey) if (k.endsWith(suffix)) n += v
  return n
}

/** What the engine has counted so far in a fight (live, for the battle toast; final, at its end). */
export const engineTally = (e: FightCounts): AskTally => ({
  kills: e.killCount,
  burnKills: e.burningKills,
  platedKills: keyed(e.killsByKey, '_plated'),
  wardedKills: keyed(e.killsByKey, '_warded'),
})

/** What a node is, for the fight-end tally and the map's "Asked" tag. */
export interface AskNode {
  type: string
  layer: number
}

/** Whether a map node is one of the route's cities (an act boss, or the destination). */
export const isCityFight = (n: AskNode): boolean => (n.type === 'miniboss' || n.type === 'boss') && cityOfLayer(n.layer) != null

/**
 * A fight's whole tally, at its end: the engine's counts, and — when it was
 * won — whether it was clean, an elite, a city. A fight is won **without a
 * leak** when no raider reached the wagons (`BattleResult.enemiesLeaked`) and
 * the wagons end it with the cargo they began it with: a champion's charge
 * that the line mended before the end costs nothing, one it did not is cargo
 * lost.
 */
export function fightTally(e: FightCounts, f: { cleared: boolean; enemiesLeaked: number; cargoBefore: number; cargoAfter: number; node: AskNode }): AskTally {
  const clean = f.cleared && f.enemiesLeaked === 0 && f.cargoAfter >= f.cargoBefore
  return {
    ...engineTally(e),
    cleanFights: clean ? 1 : 0,
    cleanCities: clean && isCityFight(f.node) ? 1 : 0,
    eliteWins: f.cleared && f.node.type === 'elite' ? 1 : 0,
  }
}

// ---------------------------------------------------------------------------
// Reading and judging
// ---------------------------------------------------------------------------

/** The facts an ask is judged on beyond its own count. */
export interface AskFacts {
  contract: Pick<RunContract, 'asks' | 'earned' | 'cargoAt' | 'purse' | 'advance' | 'status'>
  /** The purse's gold now (the road's gold is read off it, `hq.homeGold`). */
  gold: number
}

/** The cargo that reached the destination (null until it has). */
const deliveredCargo = (c: Pick<RunContract, 'cargoAt'>): number | null => (c.cargoAt.length >= CITY_COUNT ? c.cargoAt[CITY_COUNT - 1] : null)

/** The road's gold in the purse at `gold` (the advance and the rest of a purse are not the road's). */
export const roadGoldOf = (c: Pick<RunContract, 'purse' | 'earned' | 'advance'>, gold: number): number =>
  homeGold({ purse: c.purse, earned: c.earned, gold, advance: c.advance }).road

/**
 * Where an ask stands: its count (read off the contract for `earned`, the
 * cargo and the road's gold — the cargo at the destination once it has
 * arrived, else the cargo the wagons carry now when `cargoNow` is given).
 */
export function askGot(a: RunAsk, f: AskFacts, cargoNow?: number): number {
  const def = askById(a.id)
  if (!def) return a.got
  if (def.stat === 'earned') return whole(f.contract.earned)
  if (def.stat === 'roadGold') return roadGoldOf(f.contract, f.gold)
  if (def.stat === 'cargo') return deliveredCargo(f.contract) ?? whole(cargoNow ?? 0)
  return a.got
}

/** How an ask ended, for the settle and the receipt. */
export interface AskResult {
  id: string
  company: CompanyId
  target: number
  got: number
  met: boolean
}

/**
 * Every ask judged as the contract finished `status`: a count ask is met once
 * its count reached its target, however the run ended; an ask judged at the
 * end only on a delivery.
 */
export function judgeAsks(f: AskFacts, status: 'delivered' | 'cashedOut' | 'lost'): AskResult[] {
  const out: AskResult[] = []
  for (const a of f.contract.asks ?? []) {
    const def = askById(a.id)
    if (!def) continue
    const got = askGot(a, f)
    const met = got >= a.target && (!def.atEnd || status === 'delivered')
    out.push({ id: a.id, company: def.company, target: a.target, got, met })
  }
  return out
}

/** Whether an ask is already met mid-road (an ask judged at the end never is until it is delivered). */
export const askMetNow = (a: RunAsk, f: AskFacts): boolean => {
  const def = askById(a.id)
  return !!def && !def.atEnd && askGot(a, f) >= a.target
}

/**
 * The standing XP one ask met pays its company: {@link ASK_STANDING}, doubled
 * once you have signed a second term with it (Draft 4 · B, `run/track.ts`).
 */
export const askStandingFor = (term: number): number => ASK_STANDING * (term >= 2 ? 2 : 1)

/**
 * The standing XP each company earns from the asks met (only on a finish that
 * earns standing), each at its company's term (`termOf`; omitted: the first).
 */
export function askStanding(results: readonly AskResult[], termOf: (company: CompanyId) => number = () => 1): Partial<Record<CompanyId, number>> {
  const out: Partial<Record<CompanyId, number>> = {}
  for (const r of results) if (r.met && isCompanyId(r.company)) out[r.company] = (out[r.company] ?? 0) + askStandingFor(termOf(r.company))
  return out
}

/** The gold the asks met tip into the bank: the destination pays it, so a delivery only. */
export const askTips = (results: readonly AskResult[], status: 'delivered' | 'cashedOut' | 'lost'): number =>
  status === 'delivered' ? results.filter((r) => r.met).length * ASK_TIP : 0

/** The most a contract's asks can tip: every one met on a delivery. */
export const askTipMax = (asks: readonly unknown[]): number => asks.length * ASK_TIP

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** The ask in its company's words, at the target it was dealt. */
export const askText = (a: Pick<RunAsk, 'id' | 'target'>): string => askById(a.id)?.text(a.target) ?? ''

/** A count against its target: "13/30", "92%" (the cargo), "1,480/3,500" (gold). */
export function askProgressText(a: Pick<RunAsk, 'id' | 'target'>, got: number): string {
  const def = askById(a.id)
  const n = Math.max(0, Math.floor(got))
  const k = (x: number) => x.toLocaleString('en')
  if (def?.stat === 'cargo') return `${n}%`
  if (def?.stat === 'roadGold' || def?.stat === 'earned') return `${k(n)}/${k(a.target)}`
  return `${k(Math.min(n, a.target))}/${k(a.target)}`
}

/** "13 felled", "2 wares bought" — what the receipt says a count reached. */
export function askGotText(a: Pick<RunAsk, 'id' | 'target'>, got: number): string {
  const def = askById(a.id)
  const n = Math.max(0, Math.floor(got))
  switch (def?.stat) {
    case 'kills':
    case 'burnKills':
    case 'platedKills':
    case 'wardedKills':
      return `${n} felled`
    case 'cleanFights':
    case 'cleanCities':
      return `${n} without a leak`
    case 'eliteWins':
      return `${n} won`
    case 'wares':
      return `${n} bought`
    case 'pacts':
      return `${n} accepted`
    case 'earned':
      return `${n} gold earned`
    case 'cargo':
      return `${n}% cargo`
    case 'roadGold':
      return `${n} road gold`
    default:
      return String(n)
  }
}

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------

/**
 * Whether a node still ahead serves an ask — the run map tags it "Asked": an
 * elite for an elite ask, a city for a clean city fight, a Plated or Warded
 * fight for its tally, a merchant for wares, a shrine for a pact. Asks that
 * every fight serves (a tally of kills, a clean fight) tag nothing: a tag on
 * every node is a tag on none.
 */
export function nodeServesAsk(a: RunAsk, node: AskNode, mod: string | null): boolean {
  const def = askById(a.id)
  if (!def) return false
  switch (def.stat) {
    case 'eliteWins':
      return node.type === 'elite'
    case 'cleanCities':
      return isCityFight(node)
    case 'platedKills':
      return mod === 'plated'
    case 'wardedKills':
      return mod === 'warded'
    case 'wares':
      return node.type === 'merchant'
    case 'pacts':
      return node.type === 'shrine'
    default:
      return false
  }
}

// ---------------------------------------------------------------------------
// The snapshot
// ---------------------------------------------------------------------------

const MAX_COUNT = 1e6

/**
 * A stored contract's asks, validated: unknown ids dropped, each id once, a
 * company contract's only from its own list, at most {@link MAX_ASKS} (two on a
 * company's road), every number whole and non-negative — a target at least 1,
 * a cargo target at most 100. Anything else is no ask at all: an older save
 * carried none, and a contract with none pays exactly what it always did.
 */
export function readAsks(raw: unknown, company: CompanyId | null): RunAsk[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const cap = company ? ASKS_PER_CONTRACT : ASKS_PER_CHARTER
  const seen = new Set<string>()
  const out: RunAsk[] = []
  for (const x of raw) {
    if (out.length >= cap) break
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const def = typeof o.id === 'string' ? askById(o.id) : undefined
    if (!def || seen.has(def.id)) continue
    if (company && def.company !== company) continue
    if (typeof o.target !== 'number' || !Number.isFinite(o.target)) continue
    const target = Math.min(def.stat === 'cargo' ? 100 : MAX_COUNT, Math.max(1, Math.floor(o.target)))
    const got = Math.min(MAX_COUNT, whole(o.got))
    seen.add(def.id)
    out.push({ id: def.id, target, got })
  }
  return out.length ? out : undefined
}

/**
 * Judged asks as a settle receives them, validated: known ids once each, the
 * company the catalogue names, whole counts, and `met` only when strictly
 * true — so a settle can pay no more asks than the most a contract carries.
 */
export function readAskResults(raw: unknown): AskResult[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: AskResult[] = []
  for (const x of raw) {
    if (out.length >= MAX_ASKS) break
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const def = typeof o.id === 'string' ? askById(o.id) : undefined
    if (!def || seen.has(def.id)) continue
    seen.add(def.id)
    out.push({ id: def.id, company: def.company, target: Math.max(1, Math.min(MAX_COUNT, whole(o.target))), got: Math.min(MAX_COUNT, whole(o.got)), met: o.met === true })
  }
  return out
}

/** Plural helper for the UI's "asks met" lines. */
export const asksMetWord = (n: number): string => `${n} ${plural(n, 'ask', 'asks')} met`
