/**
 * How a relic reads on a card (Phase 3b) — the reward page, the Codex and the
 * run receipt all print relics through here, so the words a relic is sold with
 * are the words it is remembered by.
 */
import { relicById, type Relic } from '../../game/data/relics'

/** "Rule relic" / "Stat relic" — the half of the pool it comes from. */
export const relicKindLabel = (r: Relic): string => (r.kind === 'rule' ? 'Rule relic' : 'Stat relic')

/** The body lines of a relic: its rule, and its scope. */
export function relicLines(id: string | undefined): string[] {
  const r = id ? relicById(id) : undefined
  if (!r) return []
  // Every relic's line already states its whole effect, numbers and all
  // ("+7% attack speed · all your heroes"); the generated stat lines under it
  // said the same thing again in other words (Oct 2026: "say a fact once").
  return [r.desc, `${relicKindLabel(r)} — held for the rest of the run, by all your heroes.`]
}
