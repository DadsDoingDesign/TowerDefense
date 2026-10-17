/**
 * Which goblin clan raids a road (Oct 2026, `data/clans.ts`). Pure.
 *
 *  - A company's road: that company's clan, every act.
 *  - The Sovereign Route (your own road, no company's): the clans MIX by act —
 *    each act's clan a fresh hash of (run seed, act), never the act before's,
 *    so the country's raiders change with it. A hash, never a draw on a run
 *    stream: dealing it cannot move the loot, the map or a fight.
 *  - A hand-made bench field (the Green Line, the Kiln Road — the fallback and
 *    the balance suite's fixed benches) keeps the plain goblins: `null`.
 *
 * A clan is a look and a name only (`data/clans.ts`); nothing here reaches the
 * engine.
 */
import { hashSeed } from '../core/rng'
import { CLAN_IDS, CLAN_OF_COMPANY, type ClanId } from '../data/clans'
import type { CompanyId } from '../data/companies'

/** Generated fields carry their recipe as their id (`gen.<profile>.<seed>…`); anything else is hand-made. */
export const isBenchField = (fieldId: string | null | undefined): boolean => !fieldId || !fieldId.startsWith('gen.')

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

/** The clan raiding a fight on `fieldId` in `act` of a run under `terms` (null: the plain goblins). */
export function roadClan(terms: ClanTerms | null | undefined, runSeed: number, act: number, fieldId: string | null | undefined): ClanId | null {
  if (!terms || isBenchField(fieldId)) return null
  if (terms.charter || !terms.company) return sovereignClan(runSeed, act)
  return CLAN_OF_COMPANY[terms.company] ?? null
}

/** The run's clan now: the field it stands on, in the act that field belongs to. */
export function runClan(st: { contract: ClanTerms | null; runSeed: number; fieldAct: number; battleMap: { id: string } | null }): ClanId | null {
  return roadClan(st.contract, st.runSeed, st.fieldAct, st.battleMap?.id)
}
