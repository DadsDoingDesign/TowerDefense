/**
 * How a relic reads on a card (Phase 3b) — the reward page, the Codex and the
 * run receipt all print relics through here, so the words a relic is sold with
 * are the words it is remembered by.
 */
import { describeGrant, describeMods } from '../../game/data/describe'
import { relicById, type Relic } from '../../game/data/relics'

/** "Rule relic" / "Stat relic" — the half of the pool it comes from. */
export const relicKindLabel = (r: Relic): string => (r.kind === 'rule' ? 'Rule relic' : 'Stat relic')

/** The body lines of a relic: its rule, the engine's read-out, and its scope. */
export function relicLines(id: string | undefined): string[] {
  const r = id ? relicById(id) : undefined
  if (!r) return []
  const out = [r.desc]
  if (r.grant && (r.grant.stats || r.grant.thorns || r.grant.patience)) out.push(describeGrant(r.grant))
  if (r.grant?.mods) out.push(...describeMods(r.grant.mods).filter((l) => !r.desc.includes(l)))
  out.push(`${relicKindLabel(r)} — held for the rest of the run, by the whole company.`)
  return out
}
