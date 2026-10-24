import { mergedById, skillById } from '../../game/data/skills'
import { dropTargets, type Drop } from '../../game/run/fusion'
import type { Sentinel } from '../../game/types'
import { SLOP_PX } from './press'

/**
 * The skill drop's words and states (the drag-and-drop pass, Oct 2026): pure,
 * so `LevelUpPanel` only draws them and `tests/skillDrop.test.ts` reads them.
 * The rule itself is `run/fusion.dropOnto`; this says what each slot will do
 * with the focused card, in the words its target, its CTA and its screen
 * reader name use.
 */

/** What one of the hero's three slots does with the focused card. */
export interface SlotTarget {
  slot: number
  /** `empty`: learned as itself; `merge`: a plain merge; `named`: a named merge; `full`: cannot take it. */
  kind: 'empty' | 'merge' | 'named' | 'full'
  /** The held skill's name ("" for an empty slot). */
  held: string
  /** What it becomes: "Frozen Arc Spark", or the card's own name onto an empty slot. */
  makes: string
  /** The drop, when it can land. */
  drop: Drop | null
  /** Its accessible name: the slot, what is in it, and what dropping here makes. */
  aria: string
}

/**
 * Every slot's target for `card` on `hero`, in slot order. Any empty slot
 * takes it (skills fill in order, so it lands in the first free one).
 */
export function slotTargets(hero: Pick<Sentinel, 'skills'>, card: string): SlotTarget[] {
  const name = skillById(card)?.name ?? card
  const skills = hero.skills ?? []
  return dropTargets(hero, card).map((d, slot): SlotTarget => {
    const held = skills[slot] ? (skillById(skills[slot])?.name ?? skills[slot]) : ''
    if (!d) return { slot, kind: 'full', held, makes: '', drop: null, aria: `Slot ${slot + 1}: ${held}. It holds 3 skills: ${name} cannot merge in.` }
    if (d.base == null) return { slot, kind: 'empty', held, makes: name, drop: d, aria: `Slot ${slot + 1}: empty. Drop ${name} here to learn it as it is.` }
    const into = mergedById(d.into)
    const makes = into?.name ?? d.into
    return {
      slot,
      kind: d.named ? 'named' : 'merge',
      held,
      makes,
      drop: d,
      aria: `Slot ${slot + 1}: ${held}. Drop ${name} here to merge it in: makes ${makes}${d.named ? ', a named merge' : ''}.`,
    }
  })
}

/** The commit's words for the focused card on the chosen slot. */
export function dropCta(card: string, target: SlotTarget | null, full: boolean): { label: string; ready: boolean } {
  const name = skillById(card)?.name ?? card
  if (!target || !target.drop) return { label: full ? 'Choose a skill to merge into' : 'Choose a slot', ready: false }
  if (target.kind === 'empty') return { label: `Learn ${name}`, ready: true }
  return { label: target.kind === 'named' ? `Make ${target.makes}` : `Merge into ${target.makes}`, ready: true }
}

/**
 * The slot a card lands on by default, before the player chooses one: the
 * first empty slot (so a hero with room learns it in one tap and the CTA, as
 * ever), and none for a full hero — a merge is always the player's pick.
 */
export function defaultTarget(targets: readonly SlotTarget[]): number | null {
  return targets.find((t) => t.kind === 'empty')?.slot ?? null
}

/** A press that travels past the tap's slop is a drag (the same slop a one-tap option uses, `press.ts`). */
export const isDrag = (travel: number): boolean => travel > SLOP_PX
