/**
 * How a relic reads on a card (Phase 3b) — the reward page, the Codex and the
 * run receipt all print relics through here, so the words a relic is sold with
 * are the words it is remembered by.
 */
import { relicById } from '../../game/data/relics'
import type { BodyLine } from './offers'


/**
 * How every relic works, said under its effect as a quiet note (Oct 2026; the
 * designer: "+5 Patience to team / *relics affect new team members and stack
 * for the remainder of your run*").
 */
export const RELIC_NOTE = 'Relics affect new team members and stack for the rest of your run.'

/** The body lines of a relic: its effect, short ("+5 Patience to team"), then the note. */
export function relicLines(id: string | undefined): BodyLine[] {
  const r = id ? relicById(id) : undefined
  if (!r) return []
  return [{ text: r.desc }, { text: RELIC_NOTE, tone: 'note' }]
}
