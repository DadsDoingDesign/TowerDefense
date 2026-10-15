/**
 * ---------------------------------------------------------------------------
 * What a company's liaison says (Draft 4 · D — "someone to talk to")
 * ---------------------------------------------------------------------------
 *
 * The liaisons' words are data (`data/liaisons.ts`); this is which line is
 * said, when. Every choice is a hash — of the run seed and the city on the
 * road, of the run seed at the end — **never a draw on a run stream** (RNG
 * draw order is behaviour), so a line holds still while you look at it and a
 * reload says the same thing.
 *
 *  - **At a city**: a reaction to the cargo that arrived, or to one of the
 *    contract's asks — still open, or already met. A rough arrival (under
 *    60%) is always what they talk about.
 *  - **At the end**: delivered (by how many asks were met), cashed out, or
 *    fallen.
 *
 * The Sovereign Route has no liaison: it is your own road, and no company
 * hired you for it.
 *
 * Pure: no store, no React, no DOM.
 */
import { hashSeed } from '../core/rng'
import { companyById, type CompanyId } from '../data/companies'
import { LIAISONS, type Liaison } from '../data/liaisons'
import { askById, askMetNow, type AskFacts, type AskResult, type RunAsk } from './asks'
import { CITY_COUNT } from './contracts'

/** The longest a line may run, its quotes included: two lines of the bubble (as a stop keeper's, `stopScene.MAX_LINE`). */
export const LIAISON_MAX_LINE = 40

/** Cargo at a city (percent) a liaison calls a good haul, and below which a rough one. */
export const CARGO_GOOD = 90
export const CARGO_ROUGH = 60

/** "Brannoch · Ironvein’s factor": who is speaking, for the name plate. */
export function liaisonPlate(company: CompanyId): string {
  const l = LIAISONS[company]
  return `${l.name} · ${companyById(company).name.replace(/ Co\.$/, '')}’s ${l.role}`
}

/** A line filled in for the road, and quoted. `city` is the city the caravan stands in (for `{here}` / `{next}`). */
export function fillLine(company: CompanyId, line: string, city = 0): string {
  const towns = companyById(company).towns
  const [c1, c2, dest] = towns
  const here = towns[Math.max(0, Math.min(CITY_COUNT - 1, city))]
  const next = towns[Math.max(0, Math.min(CITY_COUNT - 1, city + 1))]
  const filled = line.replace(/\{c1\}/g, c1).replace(/\{c2\}/g, c2).replace(/\{dest\}/g, dest).replace(/\{here\}/g, here).replace(/\{next\}/g, next)
  return `“${filled}”`
}

const pick = (lines: readonly string[], h: number): string => lines[h % lines.length]

/** Everything a city's line can react to. */
export interface CityMoment {
  /** The run's seed (the contract's own deal). */
  seed: number
  /** Which city (0-based) the caravan stands in. */
  city: number
  /** The cargo (percent) it arrived with. */
  arrived: number
  /** The contract's asks and the facts they are judged on; none on a first contract. */
  asks?: readonly RunAsk[]
  facts?: AskFacts
}

/** The cargo's mood at a city. */
export const cargoMood = (arrived: number): keyof Liaison['city'] => (arrived >= CARGO_GOOD ? 'good' : arrived >= CARGO_ROUGH ? 'fair' : 'rough')

/**
 * Every line the liaison could truly say at this city: one about the cargo,
 * and one per ask the company has words for (met, if it is met now; else the
 * nudge). A rough arrival leaves only the cargo line.
 */
export function cityLines(company: CompanyId, m: CityMoment): string[] {
  const l = LIAISONS[company]
  const mood = cargoMood(m.arrived)
  const cargo = pick(l.city[mood], hashSeed(m.seed, 'liaison-cargo', company, m.city))
  if (mood === 'rough') return [cargo]
  const out = [cargo]
  for (const a of m.asks ?? []) {
    const words = l.asks[a.id]
    if (!words || !askById(a.id)) continue
    const met = !!m.facts && askMetNow(a, m.facts)
    out.push(met && words.met ? words.met : words.open)
  }
  return out
}

/** At a city: one line, fixed for (run, city). */
export function cityLine(company: CompanyId, m: CityMoment): string {
  const lines = cityLines(company, m)
  return fillLine(company, pick(lines, hashSeed(m.seed, 'liaison', company, m.city)), m.city)
}

export type LiaisonEnd = 'delivered' | 'cashedOut' | 'lost'

/**
 * On the receipt: delivered (by how many of its asks were met — all, some,
 * none, or a contract that asked nothing), cashed out at `city`, or fallen.
 */
export function endLine(company: CompanyId, outcome: LiaisonEnd, seed: number, asks: readonly Pick<AskResult, 'met'>[] = [], city = CITY_COUNT - 1): string {
  const l = LIAISONS[company]
  const met = asks.filter((a) => a.met).length
  const lines =
    outcome === 'lost'
      ? l.fallen
      : outcome === 'cashedOut'
        ? l.cashedOut
        : !asks.length
          ? l.delivered.plain
          : met === asks.length
            ? l.delivered.all
            : met > 0
              ? l.delivered.some
              : l.delivered.none
  return fillLine(company, pick(lines, hashSeed(seed, 'liaison-end', company)), city)
}
