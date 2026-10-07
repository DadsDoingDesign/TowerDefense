import type { TeachId } from '../../state/settingsStore'

/**
 * Which coach hint is live, where it floats and how long it stays — the rule
 * half of `Coach.tsx`, pure and JSX-free so it is unit-tested
 * (`tests/staging.test.ts`). `Coach` renders what this names; it never decides
 * anything of its own.
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
   * A wave is live (an engine is fighting, breathers included). Only a live
   * wave's own lessons may speak now — the rest wait for the next pause in
   * setup, so nothing new floats over a field that is being fought on.
   */
  live?: boolean
  /**
   * The Stage is too short to hold the wave-clear ceremony AND a pill
   * (`stageCrowded`): a small phone's reward-in-place Stage is ~90-190px, and
   * the pill would sit on "Wave cleared". Every tip waits — the reward's own
   * lessons (gear, a relic, a skill) come again on the run map.
   */
  ceremonyCrowded?: boolean
}

/** The tips a live wave may show: each teaches a control that exists only in its breathers. */
export const LIVE_TIP_IDS = ['subwave', 'speed'] as const satisfies readonly TeachId[]

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
  if (s.ceremonyCrowded) return null
  // A live wave hears only its own lessons, and those only in a breather
  // (the fight is paused). Everything else waits for the wave to end.
  if (s.live) return LIVE_TIP_IDS.find((id) => !t[id] && s[id]) ?? null
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

// ---------------------------------------------------------------------------
// The hint pill (October 2026): no row, no "Got it"
// ---------------------------------------------------------------------------

/**
 * What the pill holds, by precedence. A field note (a tap on a tile that will
 * not take a hero says why) is an answer to something the player just did, so
 * it pre-empts anything on show, at once — no quiet window. The new-ground
 * note is about this fight, now, so it outranks the lessons. A tip comes last.
 */
export type PillPick = { kind: 'note' } | { kind: 'ground' } | { kind: 'tip'; id: TeachId } | null

export function pickPill(f: { note: boolean; ground: boolean; tip: TeachId | null }): PillPick {
  if (f.note) return { kind: 'note' }
  if (f.ground) return { kind: 'ground' }
  return f.tip ? { kind: 'tip', id: f.tip } : null
}

/** Which edge of the Stage the pill floats on. */
export type PillWhere = 'top' | 'bottom'

/**
 * The tips about something BELOW the Stage — the party row, the wave strip,
 * the gear and the pack — float on its bottom edge, next to the thing they
 * name. Tips about the field or the header (the depth and strength chips)
 * float on the top edge. The pill is never over the control it teaches: both
 * edges are inside the Stage, and those controls are not.
 *
 * `deploy` is about the field ("then a glowing tile") and stays on top: the
 * bottom of a portrait field is the wagons, which the first fight is about.
 */
const BOTTOM_TIPS: ReadonlySet<TeachId> = new Set<TeachId>([
  'skill', // the glowing hero card in the party row
  'relic', // the reward hand, in the party band
  'command', // the Watch Command button in the wave strip
  'subwave', // Next, in the wave strip
  'speed', // Speed, in the wave strip
  'gear', // the gear slots, under the Stage
  'equip', // the + under Gear
])

export function tipWhere(id: TeachId, at: { wagonsLow?: boolean; onMap?: boolean } = {}): PillWhere {
  if (!BOTTOM_TIPS.has(id)) return 'top'
  // …unless the wagons are down there (`wagonsLow`): on a portrait field the
  // road ends at the bottom edge, and the caravan is the one thing on the
  // field a pill must never sit on while it can still be hit or moved round.
  // And never on the run map, whose bottom edge is the stops you can march
  // to — the one thing on the map a player must see; its top is the route
  // panel, which a few seconds' cover costs nothing.
  return at.wagonsLow || at.onMap ? 'top' : 'bottom'
}

/**
 * Whether the wagons (the road's last point) sit in the bottom quarter of the
 * field, where a bottom-edge pill would cover them. Only asked while the field
 * is in play (setup, a breather): after the fight the field is dimmed under
 * the ceremony and the bottom edge is free to use.
 */
export function wagonsLow(gateY: number | null | undefined, fieldH: number): boolean {
  if (gateY == null || !(fieldH > 0)) return false
  return gateY > fieldH * 0.75
}

/**
 * The shortest Stage that holds the wave-clear ceremony (its banner and sums,
 * ~150px) and a two- or three-line pill under it without the two touching.
 */
export const CEREMONY_ROOM_PX = 240

/** How long tips stay quiet as a wave settles, while the Stage re-lays out for the reward. */
export const SETTLE_QUIET_MS = 700

/** Whether a settled wave's Stage is too short for a pill beside its ceremony. */
export function stageCrowded(f: { settled: boolean; stageH: number }): boolean {
  return f.settled && f.stageH > 0 && f.stageH < CEREMONY_ROOM_PX
}

/**
 * A field note is about one tile. It floats on the top edge unless that tile
 * is in the top third of the field, when the bottom edge keeps it clear. A
 * note with no tile (the road) takes the top.
 */
export function noteWhere(tileY: number | null | undefined, fieldH: number): PillWhere {
  if (tileY == null || !(fieldH > 0)) return 'top'
  return tileY < fieldH / 3 ? 'bottom' : 'top'
}

/** A hint's floor: long enough to notice it and start reading. */
export const PILL_BASE_MS = 2500
/** And the reading time each word adds. */
export const PILL_PER_WORD_MS = 60
/** No hint outstays this, however long its line. */
export const PILL_MAX_MS = 9000
/** The fade in and out (CSS `--sh-pill-fade`); instant under reduced motion. */
export const PILL_FADE_MS = 220

/** Words in a line of copy (whitespace-separated; "—" and "·" are not words). */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

/**
 * How long a hint stays up before it fades out on its own: a floor plus a
 * little per word, capped. Hidden-tab time does not count (`Coach` pauses the
 * clock while `document.hidden`).
 */
export function pillDurationMs(text: string): number {
  return Math.min(PILL_MAX_MS, PILL_BASE_MS + PILL_PER_WORD_MS * wordCount(text))
}

/**
 * How long the pill stays empty after one tip leaves before the next may take
 * its place (F10): the second lesson arrives as a new thought, not as the same
 * hint changing its words. Notes and the new-ground note skip it.
 */
export const TIP_GAP_MS = 4000
