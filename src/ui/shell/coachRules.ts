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
  /**
   * Oct 2026 (2.5): a wave is live (an engine is fighting, breathers
   * included). A tip that comes due now waits for the next pause in setup —
   * unless the coach row was held open for this whole wave
   * (`holdCoachRow`), and then only a live wave's own tips may use it.
   */
  live?: boolean
  /** The coach row was held open when this wave went live (`holdCoachRow`). */
  rowHeld?: boolean
}

/** The tips a live wave may show: each teaches a control that exists only in its breathers. */
export const LIVE_TIP_IDS = ['subwave', 'speed'] as const satisfies readonly TeachId[]

/**
 * Whether the coach row is held open for the WHOLE of a wave that is about to
 * go live (2.5). The Stage is the row's only donor, so a tip appearing at a
 * breather or a leak pushed the field down ~45px mid-fight. The row either
 * opens with the wave — when one of the breather lessons is still to teach
 * and the wave has a breather to teach it at — and stays open until the wave
 * ends, or it does not appear during the wave at all.
 */
export function holdCoachRow(f: { taught: Pick<Record<TeachId, boolean>, 'subwave' | 'speed'>; subWaves: number }): boolean {
  return f.subWaves > 1 && (!f.taught.subwave || !f.taught.speed)
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
  // 2.5: never move the Stage during a live wave. Everything else waits for
  // the wave to end; the breather lessons speak only in a row held open from
  // the wave's start.
  if (s.live) {
    if (!s.rowHeld) return null
    return LIVE_TIP_IDS.find((id) => !t[id] && s[id]) ?? null
  }
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
