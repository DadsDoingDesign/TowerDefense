import { itemKindById, kindEffect, kindSlot } from '../../../game/data/itemKinds'
import type { PullResult } from '../../../game/run/hq'

/**
 * The sealed crate's opening (Oct 2026; the designer: "a full on loot crate
 * animation like supercell or any big name dev") as pure sequencing — which
 * beats play, for how long, and how big — so the canvas and the cards only
 * draw it.
 *
 * It READS the crates already opened (`metaStore.openCrate`, `hq.rollPull`):
 * the results are rolled before the first frame, and nothing here draws on
 * any generator. Ordering the reveals (rarest last) changes what is SHOWN
 * first, never what was rolled.
 *
 * The beats, Clash Royale's chest and Brawl Stars' box in the pack's pixels:
 *  1. **drop** — the crate falls in and lands with a thud: squash, dust.
 *  2. **ready** — it sits glowing and wobbling; each tap ({@link TAPS}) shakes
 *     it harder and cracks light through it, the glow climbing toward the best
 *     reward's level ({@link glowAfter}). Idle, it taps itself.
 *  3. **burst** — the lid flies off: a flash, rays, the pack's explosion, a
 *     burst in the level's colour, coins.
 *  4. **card** — each reward flies out face down, builds up (longer for a
 *     higher level), flips, and waits for a tap. Level 3 gets the big beat:
 *     a hit-stop, screen shake and a gold ring.
 *  5. **summary** — everything won, and Collect.
 *
 * Skip goes straight to the summary; reduced motion starts there.
 */

export type CrateTier = 1 | 2 | 3
/** How much plays: `fxQuality.fxLevel()`. */
export type CrateFx = 'full' | 'light' | 'off'

/** The fall and the squash's recovery. */
export const DROP_MS = 640
/** When, inside the drop, the crate meets the floor (the thud). */
export const LAND_MS = 380
/** Taps to break the seal: the third bursts it. */
export const TAPS = 3
/** Idle this long while ready and the crate taps itself (it never stalls). */
export const AUTO_TAP_MS = 2200
/** One tap's shake. */
export const SHAKE_MS = 300
/** Lid off, flash and burst, before the first reward flies. */
export const BURST_MS = 950
/** A reward's flight out of the crate. */
export const FLY_MS = 420
/** The card's flip. */
export const FLIP_MS = 340
/** The face-down build-up before the flip: the higher the level, the longer the wait. */
export const BUILD_MS: Readonly<Record<CrateTier, number>> = { 1: 220, 2: 700, 3: 1500 }
/** A held breath just before the flip (part of the build-up). */
export const HIT_STOP_MS: Readonly<Record<CrateTier, number>> = { 1: 0, 2: 60, 3: 160 }
/** Reduced motion: the summary fades in, nothing else moves. */
export const FADE_MS = 220
/** For the pacing check: a player who taps along at this rate… */
export const TAP_GAP_MS = 420
/** …and reads each card this long. */
export const READ_MS = 1500

/** The glow after `taps` taps: Level 1 at first, Level 2 (if earned) at the second, the best at the burst. */
export function glowAfter(taps: number, best: CrateTier): CrateTier {
  if (taps >= TAPS) return best
  if (taps >= 2) return Math.min(best, 2) as CrateTier
  return 1
}

/** A tap's shake, in effect pixels: harder each time. */
export const shakeAmp = (taps: number): number => [0.6, 1.4, 2.6, 4][Math.max(0, Math.min(3, taps))]

const scaleFor = (fx: CrateFx): number => (fx === 'full' ? 1 : fx === 'light' ? 0.5 : 0)

/** The burst's particles, by the best level (Light halves them; off draws none). */
export function burstParticles(tier: CrateTier, fx: CrateFx): number {
  return Math.round({ 1: 40, 2: 60, 3: 90 }[tier] * scaleFor(fx))
}
/** The coins that pop out with the lid (scenery: a crate is not paid in gold). */
export const burstCoins = (fx: CrateFx): number => Math.round(12 * scaleFor(fx))
/** The flip's burst, by the card's level. */
export function revealParticles(tier: CrateTier, fx: CrateFx): number {
  return Math.round({ 1: 14, 2: 28, 3: 56 }[tier] * scaleFor(fx))
}
/** The landing's dust puffs. */
export const dustPuffs = (fx: CrateFx): number => Math.round(14 * scaleFor(fx))
/** Screen shake on a flip: Level 3's big beat, a nudge for Level 2, none for Level 1. */
export function flipShake(tier: CrateTier): { px: number; ms: number } {
  return tier === 3 ? { px: 6, ms: 460 } : tier === 2 ? { px: 2, ms: 180 } : { px: 0, ms: 0 }
}
/** The gold ring that rings out from a Level 3 card. */
export const flipRing = (tier: CrateTier): boolean => tier === 3
/** The sting a flip plays (`audio.sfxRarity`): one step up the ladder per level. */
export const revealSting = (tier: CrateTier): 'common' | 'rare' | 'legendary' => (tier === 3 ? 'legendary' : tier === 2 ? 'rare' : 'common')

// ---------------------------------------------------------------- the plan

export interface RewardCard {
  kind: string
  tier: CrateTier
  /** Not yet unlocked: the card says New. */
  isNew: boolean
  /** "Level 2" — the Codex's word for it. */
  levelName: string
  /** "Body", "Either hand"… */
  slot: string
  /** The one line under the name: what it does, or what a duplicate becomes. */
  line: string
}

/** What a duplicate becomes, said once (the card and the summary). */
export const DUPLICATE_LINE = 'Already yours: a Rare one in your next contract'

export function rewardCard(r: PullResult): RewardCard {
  const k = itemKindById(r.kind)
  return {
    kind: r.kind,
    tier: r.level,
    isNew: !r.duplicate,
    levelName: `Level ${r.level}`,
    slot: k ? kindSlot(k) : '',
    line: r.duplicate ? DUPLICATE_LINE : k ? kindEffect(k) : '',
  }
}

export interface CratePlan {
  /** The rewards in reveal order: lowest level first, the best saved for last (stable within a level). */
  cards: RewardCard[]
  /** The best level inside: the crate's glow at the burst. */
  best: CrateTier
  /** The summary's title. */
  title: string
}

export function cratePlan(results: readonly PullResult[]): CratePlan {
  const cards = results.map(rewardCard).map((c, i) => ({ c, i }))
  cards.sort((a, b) => a.c.tier - b.c.tier || a.i - b.i)
  const best = results.reduce<number>((m, r) => Math.max(m, r.level), 1) as CrateTier
  return { cards: cards.map((x) => x.c), best, title: results.length > 1 ? `From ${results.length} crates` : 'From your crate' }
}

// ---------------------------------------------------------------- the phases

export type CardStep = 'fly' | 'build' | 'flip' | 'shown'
export type Phase =
  | { at: 'drop'; t0: number }
  | { at: 'ready'; taps: number; t0: number; tapAt: number }
  | { at: 'burst'; t0: number }
  | { at: 'card'; i: number; step: CardStep; t0: number }
  | { at: 'summary'; t0: number }

/** Where an opening starts: the drop, or (reduced motion, or nothing to show) the summary. */
export function startPhase(plan: CratePlan, fx: CrateFx, now: number): Phase {
  return fx === 'off' || plan.cards.length === 0 ? { at: 'summary', t0: now } : { at: 'drop', t0: now }
}

const stepMs = (step: CardStep, tier: CrateTier): number => (step === 'fly' ? FLY_MS : step === 'build' ? BUILD_MS[tier] : step === 'flip' ? FLIP_MS : Infinity)
const NEXT_STEP: Record<Exclude<CardStep, 'shown'>, CardStep> = { fly: 'build', build: 'flip', flip: 'shown' }

/** The clock's transitions: the beats that end by themselves. */
export function advance(p: Phase, plan: CratePlan, now: number): Phase {
  const dt = now - p.t0
  switch (p.at) {
    case 'drop':
      return dt >= DROP_MS ? { at: 'ready', taps: 0, t0: now, tapAt: now } : p
    case 'ready':
      // Idle too long: the crate taps itself, so the moment never stalls.
      return now - p.tapAt >= AUTO_TAP_MS ? tapPhase(p, plan, now) : p
    case 'burst':
      return dt >= BURST_MS ? { at: 'card', i: 0, step: 'fly', t0: now } : p
    case 'card': {
      if (p.step === 'shown') return p
      const tier = plan.cards[p.i]?.tier ?? 1
      return dt >= stepMs(p.step, tier) ? { ...p, step: NEXT_STEP[p.step], t0: now } : p
    }
    case 'summary':
      return p
  }
}

/** A tap: shake the crate (the third bursts it), hurry a card to its face, or move to the next. */
export function tapPhase(p: Phase, plan: CratePlan, now: number): Phase {
  switch (p.at) {
    case 'drop':
      return p
    case 'ready': {
      const taps = p.taps + 1
      return taps >= TAPS ? { at: 'burst', t0: now } : { at: 'ready', taps, t0: p.t0, tapAt: now }
    }
    case 'burst':
      return p
    case 'card':
      if (p.step === 'fly' || p.step === 'build') return { ...p, step: 'flip', t0: now }
      if (p.step === 'flip') return p
      return p.i + 1 < plan.cards.length ? { at: 'card', i: p.i + 1, step: 'fly', t0: now } : { at: 'summary', t0: now }
    case 'summary':
      return p
  }
}

/** Skip: straight to everything won. */
export const skipPhase = (now: number): Phase => ({ at: 'summary', t0: now })

/**
 * How long an opening runs for a player who taps along ({@link TAP_GAP_MS}
 * between taps) and reads each card for {@link READ_MS} — the pacing the
 * critique holds to (6–10 s for one crate, longer for a better one).
 */
export function pacedMs(plan: CratePlan): number {
  let ms = DROP_MS + TAPS * TAP_GAP_MS + BURST_MS
  for (const c of plan.cards) ms += FLY_MS + BUILD_MS[c.tier] + FLIP_MS + READ_MS
  return ms
}
