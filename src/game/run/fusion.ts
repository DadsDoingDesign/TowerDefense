/**
 * Skill fusion as the run applies it (Oct 2026, `docs/SKILL_FUSION.md`). Pure:
 * a hero and the offer it is shown in, what can fuse — or the hero after
 * fusing — out. The data is `data/fusions.ts` (the recipes and their twists);
 * `run/skills.takeSkill` fuses a card that fuses, the store's `chooseFusion`
 * fuses a held pair, and the balance harness calls both.
 *
 * ---- what fuses, and when --------------------------------------------------
 *
 * Only at an owed milestone, only by the player's choice, and two ways:
 *
 *  (a) a CARD that fuses — the hero holds A, and B is on the offer: taking B
 *      fuses it into A's slot, so B takes none (a full hero needs no swap);
 *  (b) a PAIR it holds — the hero holds both A and B (a hire trained past a
 *      milestone, the Opening deal's Level 2 skill, a save from before
 *      fusion): the milestone also offers "Fuse A + B".
 *
 * A fused skill never fuses again: only PLAIN skills (library cards) are ever
 * a recipe's part. No RNG: the offer is dealt exactly as it always was
 * (`skills.skillOffer`), and everything here only reads it.
 */
import { FUSIONS, type FusionDef } from '../data/fusions'
import { fusedById, isCardId, isFusedId, type FusedSkill, type Skill } from '../data/skills'
import type { Sentinel } from '../types'

const key = (a: string, b: string): string => (a < b ? `${a}+${b}` : `${b}+${a}`)
const BY_PAIR = new Map(FUSIONS.map((f) => [key(f.parts[0], f.parts[1]), f]))

/** The fusion two library skills make (in either order), or undefined. A fused skill is never a part. */
export function recipeFor(a: string, b: string): FusedSkill | undefined {
  if (a === b || !isCardId(a) || !isCardId(b)) return undefined
  const f = BY_PAIR.get(key(a, b))
  return f ? fusedById(f.id) : undefined
}

/** Every recipe a library skill is a part of, in recipe order. */
export function recipesWith(skillId: string): FusionDef[] {
  return FUSIONS.filter((f) => f.parts.includes(skillId))
}

/** The parts of every fused skill the hero holds: the offer never deals them again. */
export function fusedParts(hero: Pick<Sentinel, 'skills'>): string[] {
  return (hero.skills ?? []).flatMap((id) => fusedById(id)?.parts ?? [])
}

/** One way a card fuses: the held skill it fuses with, and what they make. */
export interface CardFusion {
  /** The held skill the card fuses with (its slot becomes the fusion). */
  with: string
  into: FusedSkill
}

/**
 * Path (a): what each offer card fuses with — for every card, the held plain
 * skills it makes a recipe with, in slot order (the first is the default
 * partner). A card with none is absent. The offer itself is not touched.
 */
export function cardFusions(hero: Pick<Sentinel, 'skills'>, offer: readonly Pick<Skill, 'id'>[]): Map<string, CardFusion[]> {
  const out = new Map<string, CardFusion[]>()
  const held = (hero.skills ?? []).filter((id) => isCardId(id))
  for (const card of offer) {
    const ways = held.flatMap((h): CardFusion[] => {
      const into = recipeFor(h, card.id)
      return into ? [{ with: h, into }] : []
    })
    if (ways.length) out.set(card.id, ways)
  }
  return out
}

/** One pair the hero already holds that fuses (path b). */
export interface HeldFusion {
  /** The two held skills, in slot order: the first's slot becomes the fusion. */
  a: string
  b: string
  into: FusedSkill
}

/**
 * Path (b): every pair of plain skills the hero holds that is a recipe, in
 * slot order. Read whether or not a milestone is owed; the choice is offered
 * only at one (`run/skills.takeFusion`).
 */
export function heldFusions(hero: Pick<Sentinel, 'skills'>): HeldFusion[] {
  const held = (hero.skills ?? []).filter((id) => isCardId(id))
  const out: HeldFusion[] = []
  for (let i = 0; i < held.length; i++) {
    for (let j = i + 1; j < held.length; j++) {
      const into = recipeFor(held[i], held[j])
      if (into) out.push({ a: held[i], b: held[j], into })
    }
  }
  return out
}

/**
 * The hero's skills after fusing `a` (held) with `b`: `a`'s slot becomes the
 * fusion and `b` leaves (if it was held) — so the slot count drops by one when
 * both were held, and stays when `b` was the card on the offer.
 */
export function fuseSkills(skills: readonly string[], a: string, b: string, into: string): string[] {
  return skills.flatMap((id) => (id === a ? [into] : id === b ? [] : [id]))
}

/** The fused skills a hero holds, in slot order (the Codex reveals these). */
export const fusedHeld = (hero: Pick<Sentinel, 'skills'>): string[] => (hero.skills ?? []).filter((id) => isFusedId(id))
