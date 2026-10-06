/**
 * ---------------------------------------------------------------------------
 * The Sovereign Route — the endgame charter (the mercenary company, step 5)
 * ---------------------------------------------------------------------------
 *
 * The designer: "the daily thing should be something that only unlocks when
 * everything is unlocked … where you sponsor your own entire trade route
 * pass. its very expensive but the reward is huge and its the only way to get
 * a final top tier of items. They will only unlock through completing a trade
 * route and there is no staking its all or nothing. and this is a route that
 * even spawns all items and enemies and has a tradeoff from each company to
 * handle."
 *
 * So the Sovereign Route is a contract with no company:
 *
 *  - **The door** ({@link charterDoor}): it opens when every skill card and
 *    every item kind of Levels 1–3 is unlocked. Standing and the HQ do not
 *    count. Until then the menu shows how much of that catalogue you hold.
 *  - **The fee** ({@link CHARTER_FEE}): paid from the bank when the hero is
 *    committed, as a stake is. **All or nothing**: no crates, no city pay (the
 *    cities are waypoints), no cash-out, and a fall loses the fee. Delivered,
 *    the destination pays {@link CHARTER_PAYOUT} in full — cargo does not
 *    scale it — and one Sovereign item kind unlocks ({@link rollSovereign}).
 *  - **Standing with all five** (`standing.charterStandingXp`, October 2026): the
 *    road is every company's, so it earns standing with each of them — as much
 *    as an escort run that ended the same way earns with its one company.
 *  - **Every good, every raider**: the run deals from every pool you own with
 *    no company bias (no route weighting, no HQ focus), and every goblin clan
 *    marches from the first fight (`waves` `muster`).
 *  - **Five trade-offs at once** ({@link TRADE_OFFS}), one per company, each
 *    an existing mechanic: the route's ground on every field is all four
 *    companies' (`terrain` `sovereign`: Peppercorn's fire, Easel House's
 *    lakes, Ironvein's boulders, Moonquill's cursed ground), and Rosethread's
 *    merchants charge double ({@link CHARTER_PRICE_MULT}).
 *
 * The **Sovereign tier** is item Level 4 (`data/itemKinds.ts`): five kinds,
 * one per company, dealt at a low weight once owned ({@link sovereignPool}) —
 * in loot, at merchants and on rolled heroes, never from a sealed crate.
 *
 * Pure: no store, no React, no DOM, no run-stream draw. Every roll here is a
 * fresh generator hashed from its own parts. Every number is a placeholder
 * for the tuning pass.
 */
import { companyById, type CompanyId } from '../data/companies'
import { RANDOM_UNLOCK_SKILLS } from '../data/skills'
import { isSovereignKind, SOVEREIGN_ITEM_KINDS, UNLOCK_ITEM_KINDS } from '../data/itemKinds'
import type { NodeEncounterRules } from '../data/waves'
import type { TerrainRuleId } from '../types'
import { rollFromPool } from './watch'

// ---------------------------------------------------------------------------
// The numbers (placeholders the tuning pass owns)
// ---------------------------------------------------------------------------

/** The route's name, as every surface prints it. */
export const CHARTER_NAME = 'Sovereign Route'
/** The top tier's colour (`trade/NOTES.md` § Palette: ΔE2000 ≥ 20 from every rarity, company and reserved hue). */
export const SOVEREIGN_COLOR = '#38f2e8'
/** The top tier's initial, so it survives with colour switched off. */
export const SOVEREIGN_INITIAL = 'S'
/** The tier's name. */
export const SOVEREIGN_TIER = 'Sovereign'

/**
 * The sponsorship fee, from the bank: about nine good runs of savings. 5,000
 * → 7,000 (the tuning pass): the company that opens the door banks ~670 gold
 * net from an escort and ~810 from a 4-crate contract (REPORT §18), so 5,000
 * was about six good runs.
 */
export const CHARTER_FEE = 7000
/**
 * What a delivered Sovereign Route pays at its destination: five fees. 20,000
 * (four fees) → 35,000 (the tuning pass): at four fees the charter broke even
 * at 25% delivery and the door's company delivered 23–27%, so its expected
 * value was about nothing — a gamble with no reason to take it. At five fees
 * it breaks even at 20%; that company delivers 26% (28% with every Sovereign
 * item), worth about +2,000 a charter on average and 35,000 on the day.
 */
export const CHARTER_PAYOUT = 35000
/**
 * The muster's teeth (the tuning pass): every raider on the Sovereign Route is
 * this much stronger — its HP, and what it steals when it reaches the wagons —
 * on top of every clan marching from the first fight. The clans alone cost
 * nothing measurable (REPORT §18: −0.5pt lifted, i.e. none — the teaching
 * ramp only holds bombers back at depth 1 and armour to depth 2, fights a
 * late-game company walks through). Measured on §18's company (600 paired
 * runs): without the muster 30.3% delivered; ×1.25 18.5% (the muster would be
 * the whole charter); ×1.07 26.0% — a condition worth about 4pt, like each of
 * the others is meant to be.
 */
export const MUSTER_STRENGTH = 1.07
/** The muster's strength, as the copy says it ("7%"). */
export const MUSTER_PCT = Math.round((MUSTER_STRENGTH - 1) * 100)
/** Rosethread's trade-off: every merchant price on the route is this many times as much. */
export const CHARTER_PRICE_MULT = 2
/**
 * How rarely an owned Sovereign kind is dealt: every other kind in a pool is
 * listed this many times for its one listing, so one Sovereign kind turns up
 * a quarter as often as any other kind of its slot.
 */
export const SOVEREIGN_DILUTION = 4
/** The route's ground on every field (`data/terrain.COMPOSITE_RULES`). */
export const CHARTER_GROUND: TerrainRuleId = 'sovereign'
/** The route's three waypoints: act 1's, act 2's, and the destination. */
export const CHARTER_TOWNS: readonly [string, string, string] = ['Freemark', 'Crownwater', 'Highcharter']

// ---------------------------------------------------------------------------
// The door
// ---------------------------------------------------------------------------

export interface CharterDoor {
  /** Random skill cards unlocked, of all there are. */
  skills: { have: number; need: number }
  /** Item kinds of Levels 1–3 unlocked (the basic five not counted), of all there are. */
  items: { have: number; need: number }
  /** The share of that catalogue held, 0–1: the menu's meter. */
  progress: number
  /** Everything is unlocked: the charter may be signed. */
  open: boolean
}

/**
 * Whether the Sovereign Route is open: every skill card a contract, a
 * standing level or a sealed crate can unlock, and every item kind of Levels
 * 1–3. HQ offices and standing do not count; feat cards follow their feats
 * and are not in it.
 */
export function charterDoor(v: { skills: readonly string[]; items: readonly string[] }): CharterDoor {
  const skills = { have: RANDOM_UNLOCK_SKILLS.filter((id) => v.skills.includes(id)).length, need: RANDOM_UNLOCK_SKILLS.length }
  const items = { have: UNLOCK_ITEM_KINDS.filter((id) => v.items.includes(id)).length, need: UNLOCK_ITEM_KINDS.length }
  const have = skills.have + items.have
  const need = skills.need + items.need
  return { skills, items, progress: need ? have / need : 1, open: have >= need }
}

// ---------------------------------------------------------------------------
// The five trade-offs
// ---------------------------------------------------------------------------

/** One company's condition on the Sovereign Route: its rule, and that rule in one line. */
export interface TradeOff {
  company: CompanyId
  rule: string
  line: string
}

/**
 * Every company sets one condition, all five at once. Each is a mechanic the
 * game already has, and each line says only what it does.
 */
export const TRADE_OFFS: readonly TradeOff[] = [
  { company: 'spice', rule: 'Wildfire on every field', line: 'Fire covers part of every field.' },
  { company: 'art', rule: 'The canals flood', line: 'Lakes cover some of the best ground.' },
  { company: 'metals', rule: 'Quarry boulders', line: '4 more boulders a field. They can’t be cleared.' },
  { company: 'silk', rule: 'Merchants charge double', line: 'Every merchant price is twice as much.' },
  { company: 'scrolls', rule: 'More cursed ground', line: '2 more cursed patches on every field.' },
]

/** What the route deals and fields, said once on the contract screen. */
export const CHARTER_TERMS: readonly string[] = [
  'Deals every item and skill you own, for no company.',
  `Every goblin clan marches from the first fight, ${MUSTER_PCT}% stronger, and steals ${MUSTER_PCT}% more.`,
  'No crates, no city pay, no cashing out. The cities are waypoints.',
]

// ---------------------------------------------------------------------------
// The road
// ---------------------------------------------------------------------------

/** A contract as the route it runs: a company's, or the Sovereign Route (`company` null). */
export interface RouteRef {
  company: CompanyId | null
  charter?: boolean
}

/** Whether a contract is the Sovereign Route. */
export const isCharter = (c: RouteRef | null | undefined): boolean => !!c?.charter

/** What every surface names a road by: its name, its goods, its colour and its three towns. */
export interface RouteView {
  name: string
  goods: string
  color: string
  towns: readonly [string, string, string]
}

/** The Sovereign Route as a road. */
export const CHARTER_ROUTE: RouteView = { name: CHARTER_NAME, goods: 'Every good', color: SOVEREIGN_COLOR, towns: CHARTER_TOWNS }

/** The road a contract runs: the Sovereign Route, else its company's. */
export function routeOf(c: RouteRef): RouteView {
  if (c.charter || !c.company) return CHARTER_ROUTE
  const co = companyById(c.company)
  return { name: co.name, goods: co.goods, color: co.color, towns: co.towns }
}

/** The encounter rules a contract's road fields its waves under: the muster on the Sovereign Route, else none. */
export const encounterRulesOf = (c: RouteRef | null | undefined): NodeEncounterRules | undefined =>
  isCharter(c) ? { allElite: false, eliteDepth: 0, muster: true } : undefined

/** The merchant's price multiplier on a contract's road. */
export const priceMultOf = (c: RouteRef | null | undefined): number => (isCharter(c) ? CHARTER_PRICE_MULT : 1)

/** A merchant's price on a contract's road. */
export const routePrice = (price: number, c: RouteRef | null | undefined): number => Math.round(price * priceMultOf(c))

// ---------------------------------------------------------------------------
// The Sovereign tier
// ---------------------------------------------------------------------------

/**
 * The Sovereign kind a delivered charter unlocks: one still locked, at
 * random — a hash of the save's charter count, never a run stream. Null once
 * every Sovereign kind is owned.
 */
export function rollSovereign(owned: readonly string[], ...salt: (string | number)[]): string | null {
  return rollFromPool({ pool: SOVEREIGN_ITEM_KINDS, have: owned, salt: ['sovereign', ...salt] })
}

/**
 * A run's item pool with the Sovereign tier at its low weight: when the pool
 * holds a Sovereign kind, every other entry is listed
 * {@link SOVEREIGN_DILUTION} times for each Sovereign listing. A pool with no
 * Sovereign kind is returned as it was, so a run dealt before the tier — or
 * by a save that owns none — deals exactly what it always did, draw for draw.
 */
export function sovereignPool(pool: readonly string[]): string[] {
  if (!pool.some(isSovereignKind)) return [...pool]
  return pool.flatMap((id) => (isSovereignKind(id) ? [id] : Array<string>(SOVEREIGN_DILUTION).fill(id)))
}

/** The share (0–1) of a dealing pool that is Sovereign. */
export const sovereignShare = (pool: readonly string[]): number => (pool.length ? pool.filter(isSovereignKind).length / pool.length : 0)
