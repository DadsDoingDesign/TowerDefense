import { achievementById } from '../../game/data/achievements'
import { useGameStore } from '../../state/gameStore'
import { useMetaStore } from '../../state/metaStore'

/**
 * Which horizontal unlocks the player has earned, for the perk UI.
 *
 * One seam, so the picker, the Skills panel and the store's `choosePerk` ask
 * the same question. Perk options behind a feat stay locked until the
 * achievement ledger lands (`metaStore`), and say which feat opens them.
 */
export function usePerkUnlocks(): (achievementId: string) => boolean {
  // Subscribed, so earning a feat opens its options without a reload.
  const achievements = useMetaStore((s) => s.achievements)
  const usesHub = useGameStore((s) => s.challenge.kind !== 'daily')
  return (id: string) => usesHub && !!achievements[id]
}

/** The feat that opens a locked option, in the player's words. */
export function featName(achievementId: string): string {
  const a = achievementById(achievementId)
  return a ? `opened by the feat “${a.name}”: ${a.feat.replace(/\.$/, '').toLowerCase()}` : 'opened by a feat'
}
