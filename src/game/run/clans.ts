/**
 * Which goblin clan raids a road (Oct 2026, `data/clans.ts`). Pure.
 *
 * The clan follows the RUN, not the field:
 *  - A company's road: that company's clan, every act, on every field — a
 *    generated road and the hand-made Green Line and Kiln Road alike.
 *  - The Sovereign Route (your own road, no company's): the clans MIX by act —
 *    each act's clan a fresh hash of (run seed, act), never the act before's,
 *    so the country's raiders change with it. A hash, never a draw on a run
 *    stream: dealing it cannot move the loot, the map or a fight.
 *  - No run (the home, a harness, the balance suite): `DEFAULT_CLAN`.
 *
 * A clan is a look and a name only (`data/clans.ts`); nothing here reaches the
 * engine.
 */
import { hashSeed } from '../core/rng'
import { CLAN_IDS, CLAN_OF_COMPANY, DEFAULT_CLAN, type ClanId } from '../data/clans'
import type { CompanyId } from '../data/companies'

/** The Sovereign Route's clan for one act: a hash of (seed, act), never the act before's clan. */
export function sovereignClan(runSeed: number, act: number): ClanId {
  const a = Math.max(1, Math.floor(act) || 1)
  const prev = a > 1 ? sovereignClan(runSeed, a - 1) : null
  const pool = CLAN_IDS.filter((c) => c !== prev)
  return pool[hashSeed(runSeed, 'sovereign-clan', a) % pool.length]
}

/** The terms a clan is read off: whose road it is. */
export interface ClanTerms {
  company: CompanyId | null
  charter?: boolean
}

/** The clan raiding a fight in `act` of a run under `terms` (no terms: `DEFAULT_CLAN`). */
export function roadClan(terms: ClanTerms | null | undefined, runSeed: number, act: number): ClanId {
  if (!terms) return DEFAULT_CLAN
  if (terms.charter || !terms.company) return sovereignClan(runSeed, act)
  return CLAN_OF_COMPANY[terms.company] ?? DEFAULT_CLAN
}

/** The run's clan now, in the act its field belongs to. */
export function runClan(st: { contract: ClanTerms | null; runSeed: number; fieldAct: number }): ClanId {
  return roadClan(st.contract, st.runSeed, st.fieldAct)
}
