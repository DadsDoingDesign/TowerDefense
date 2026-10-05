import type { TeachId } from '../../state/settingsStore'

/**
 * Which coach tip is live — the rule half of `Coach.tsx`, pure and JSX-free so
 * the order is unit-tested (`tests/staging.test.ts`). `Coach` renders the tip
 * this names; it never decides one of its own.
 */

/** Everything the picker reads: plain facts about the screen right now. */
export interface TipFacts {
  taught: Record<TeachId, boolean>
  inSetup: boolean
  deployed: number
  packCount: number
  wearingAnything: boolean
  showThreat: boolean
  threat: number
  /** A hero owes a skill choice (the first comes at level 5), and it can be made now. */
  owesSkill?: string
  /** The field being set up has cursed ground. */
  danger: boolean
  /** The field being set up carries a map challenge. */
  challenge?: { name: string; blurb: string }
  /** The battle being set up is an elite. */
  elite: boolean
  /** A reward hand in place holds a relic. */
  relicOffered: boolean
  /** The company's Watch Command, while one is shown in setup. */
  command?: { name: string; blurb: string }
  /** A breather: the fight is paused between sub-waves. */
  subwave: boolean
  /** A breather, with the speed control on screen. */
  speed: boolean
  /** Gear and the pack are on screen (after the first win). */
  gear: boolean
  /** The depth chip is on screen, on the run map. */
  depth?: { depth: number; last: number }
  /** A merchant is in reach on the run map. */
  merchant: boolean
}

/**
 * The one live tip, or null. At most one, ever (rule one of the coach).
 *
 * Ordered by urgency rather than by when a player meets them: a choice that is
 * owed, then the ground the player is about to post on, then what to do, then
 * what is new on the screen. LS3 gave every staged idea its tip — one line,
 * the first time the idea is on screen, then never again (`taught`).
 */
export function pickTipId(s: TipFacts): TeachId | null {
  const t = s.taught
  if (!t.skill && s.owesSkill) return 'skill'
  if (!t.danger && s.danger) return 'danger'
  if (!t.challenge && s.challenge) return 'challenge'
  if (!t.deploy && s.inSetup && s.deployed === 0) return 'deploy'
  if (!t.relic && (s.elite || s.relicOffered)) return 'relic'
  if (!t.command && s.command) return 'command'
  if (!t.subwave && s.subwave) return 'subwave'
  if (!t.speed && s.speed) return 'speed'
  // The first win's reward: the gear lesson before the enemy-strength one.
  if (!t.gear && s.gear) return 'gear'
  if (!t.threat && s.showThreat) return 'threat'
  if (!t.equip && s.inSetup && s.packCount > 0 && !s.wearingAnything) return 'equip'
  if (!t.depth && s.depth) return 'depth'
  if (!t.merchant && s.merchant) return 'merchant'
  return null
}
