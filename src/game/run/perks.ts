/**
 * Spec perks as the run applies them (Phase 3b). Pure: a hero in, the choice it
 * owes (or the hero after choosing) out. The data is `data/perks.ts`; the
 * store's `choosePerk` and the balance harness both call these, so a perk the
 * UI offers is a perk the store accepts.
 */
import { PERK_LEVELS, perkOptionsFor, type Perk } from '../data/perks'
import type { Sentinel } from '../types'

/** The line a milestone's perk is chosen from: base archetype at 5, sub-archetype at 15. */
export function perkLine(s: Pick<Sentinel, 'branchPath'>, level: number): string | undefined {
  const idx = PERK_LEVELS.indexOf(level as (typeof PERK_LEVELS)[number])
  return idx < 0 ? undefined : s.branchPath[idx]
}

/**
 * The milestone a hero owes a perk for, or null. Perks are taken in order — the
 * level-5 pick is `perks[0]`, the level-15 pick `perks[1]` — and the level-15
 * one waits for the level-10 evolution, since it is chosen from that line.
 */
export function pendingPerkLevel(s: Pick<Sentinel, 'level' | 'branchPath' | 'perks'>): number | null {
  const taken = s.perks?.length ?? 0
  for (let i = taken; i < PERK_LEVELS.length; i++) {
    const level = PERK_LEVELS[i]
    if (s.level < level) return null
    if (!perkLine(s, level)) return null
    return i === taken ? level : null
  }
  return null
}

/** The options a hero is offered at its owed milestone, with locked ones left out. */
export function perkChoices(
  s: Pick<Sentinel, 'level' | 'branchPath' | 'perks'>,
  unlocked: (achievementId: string) => boolean = () => false,
): Perk[] {
  const level = pendingPerkLevel(s)
  if (level === null) return []
  const line = perkLine(s, level)!
  return perkOptionsFor(level, line).filter((p) => !p.unlock || unlocked(p.unlock))
}

/** The options still locked at the owed milestone (shown greyed, with their feat). */
export function lockedPerkChoices(
  s: Pick<Sentinel, 'level' | 'branchPath' | 'perks'>,
  unlocked: (achievementId: string) => boolean = () => false,
): Perk[] {
  const level = pendingPerkLevel(s)
  if (level === null) return []
  return perkOptionsFor(level, perkLine(s, level)!).filter((p) => p.unlock && !unlocked(p.unlock))
}

/** The hero after taking `perkId` — or null when that perk is not on offer to it. */
export function takePerk<T extends Pick<Sentinel, 'level' | 'branchPath' | 'perks'>>(
  s: T,
  perkId: string,
  unlocked: (achievementId: string) => boolean = () => false,
): T | null {
  if (!perkChoices(s, unlocked).some((p) => p.id === perkId)) return null
  return { ...s, perks: [...(s.perks ?? []), perkId] }
}
