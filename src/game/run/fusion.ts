/**
 * Merging as the run applies it (Oct 2026, `docs/SKILL_FUSION.md`). Pure: a
 * hero's skills and the card it is dropping in, what the drop makes out. The
 * data is `data/infusions.ts` (every skill's infusion half and the
 * re-expression rules), `data/fusions.ts` (the named merges) and the resolver
 * in `data/skills.ts` (`mergeId`, `mergedById`); `run/skills.dropSkill` is the
 * one move the store, the panel and the balance harness make.
 *
 * ---- the drop ---------------------------------------------------------------
 *
 * The designer: "If into an empty slot then it's kept as is, but if all slots
 * are full you are forced to merge in." And: "the merging should be possible
 * with any combination in any order, but order does matter and affects what's
 * made."
 *
 *  - Onto an EMPTY slot, the card is learned as itself.
 *  - Onto a HELD skill (always allowed; the only way once all three are
 *    full), the card merges in: the held skill is the BASE and keeps itself,
 *    the card is the INFUSION. Its share and one re-expression rule are
 *    added — or, for the one ordered pair a named merge is, that merge's own
 *    twist. A skill never leaves: there is no swap.
 *  - A slot holds at most `MAX_DEPTH` (3) library skills, and no skill twice.
 *
 * A named merge forms only in its order, and only by a drop: two parts held in
 * separate slots stay as they are (each at full strength — the designer's
 * empty-slot rule), and a hire or the Opening deal never merges anything.
 * Only cards are ever dropped, so a merged skill is only ever a base; were a
 * merged skill ever poured in, it would lend its root's infusion (`infusionOf`).
 *
 * No RNG: the offer is dealt exactly as it always was (`skills.skillOffer`).
 */
import { FUSIONS, type FusionDef } from '../data/fusions'
import { INFUSIONS, type Infusion } from '../data/infusions'
import { chainOf, isCardId, isMergedId, isNamedId, mergedById, mergeId, namedById, type MergedSkill } from '../data/skills'
import type { Sentinel } from '../types'

/** A hero equips at most this many skills (also `skills.MAX_SKILLS`, which reads this). */
export const SLOTS = 3

/** What one drop does. */
export interface Drop {
  /** The slot it lands in (an empty one: the first free). */
  slot: number
  /** The skill that slot holds after it: the card itself, or the merge. */
  into: string
  /** The held skill it merged into (absent: it went into an empty slot). */
  base?: string
  /** The named merge it made, if the order is one's. */
  named?: FusionDef
}

/**
 * What dropping `card` on slot `slot` of `skills` makes, or null when it
 * cannot land there: not a library card, already held (in any slot), a slot
 * index off the hero, or a slot at the depth cap. Reads the skills alone —
 * whether the card is on the offer is `skills.dropSkill`'s check.
 */
export function dropOnto(skills: readonly string[], card: string, slot: number): Drop | null {
  if (!isCardId(card) || !Number.isInteger(slot) || slot < 0 || slot >= SLOTS) return null
  if (skills.some((id) => chainOf(id).includes(card))) return null
  if (slot >= skills.length) return skills.length < SLOTS ? { slot: skills.length, into: card } : null
  const base = skills[slot]
  const into = mergeId(base, card)
  if (!into) return null
  return { slot, into, base, named: namedById(into) }
}

/** The hero's skills after a drop. */
export function afterDrop(skills: readonly string[], d: Drop): string[] {
  return d.base == null ? [...skills, d.into] : skills.map((id, i) => (i === d.slot ? d.into : id))
}

/** What the card makes on each of the hero's three slots, in slot order (null: it cannot land there). */
export function dropTargets(hero: Pick<Sentinel, 'skills'>, card: string): (Drop | null)[] {
  const skills = hero.skills ?? []
  return Array.from({ length: SLOTS }, (_, i) => dropOnto(skills, card, i))
}

/** Every library skill in the hero's slots, merged ones' too: the offer never deals one again. */
export function heldCards(hero: Pick<Sentinel, 'skills'>): string[] {
  return (hero.skills ?? []).flatMap((id) => [...chainOf(id)])
}

/** The named merges a held skill builds into as the BASE, each with the card it needs. */
export const buildsInto = (id: string): FusionDef[] => FUSIONS.filter((f) => f.parts[0] === id)
/** The named merges a card builds into as the INFUSION, each with the base it needs. */
export const buildsWith = (card: string): FusionDef[] => FUSIONS.filter((f) => f.parts[1] === card)
/** Every named merge a skill is a part of, either way, in recipe order. */
export const recipesWith = (id: string): FusionDef[] => FUSIONS.filter((f) => f.parts.includes(id))

/**
 * What a skill lends when poured in. A library card lends its own infusion; a
 * merged skill (never dropped in this build: only cards are) would lend its
 * ROOT base's, so pouring a slot in is the same as pouring its base in.
 */
export function infusionOf(id: string): Infusion | undefined {
  if (isCardId(id)) return INFUSIONS[id]
  const root = chainOf(id)[0]
  return root ? INFUSIONS[root] : undefined
}

/** The merged skills a hero holds, in slot order. */
export const mergedHeld = (hero: Pick<Sentinel, 'skills'>): string[] => (hero.skills ?? []).filter((id) => isMergedId(id))
/** The named merges a hero holds, in slot order (the Codex records these). */
export const namedHeld = (hero: Pick<Sentinel, 'skills'>): string[] => (hero.skills ?? []).filter((id) => isNamedId(id))

/** A held skill read as a merge, when it is one (the hero card, the beat). */
export const asMerged = (id: string): MergedSkill | undefined => mergedById(id)
