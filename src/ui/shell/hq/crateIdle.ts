import type { CrateLook } from './crateArt'
import type { CrateFx } from './crateSequence'

/**
 * The hero chest's idle on the crates screen (the chest pass, Oct 2026; the
 * designer: "it's really sad for what should be highly engaging
 * interaction") — pure timing, drawn by `CrateHero.tsx`.
 *
 * Alive but calm: a breathing glow, a few sparkles, light leaking at the lid's
 * seam, the seal pulsing, a slow turn of rays, and now and then a hop; a touch
 * makes it hop at once. A bigger chest (more crates at once) hops more often
 * and sparkles more. Light halves the sparkles and the frame rate; reduced
 * motion draws one still frame.
 */

/** A hop: up, a squash on landing, settled. */
export const HOP_MS = 420
/** How often the chest hops by itself, by look: the bigger one is keener. */
export const HOP_EVERY_MS: Readonly<Record<CrateLook, number>> = { wood: 4600, iron: 3800, gold: 3200 }
/** One breath of the glow. */
export const BREATH_MS = 3200
/** One pulse of the seal. */
export const SEAL_MS = 2400
/** One full turn of the rays behind the chest (slow: felt, not watched). */
export const RAY_TURN_MS = 90_000
/** How long the coins take to pay for the crates before the opening starts. */
export const PAY_MS = 460

/** Sparkles alive round the chest at once. */
export function idleSparks(look: CrateLook, fx: CrateFx): number {
  const n = { wood: 3, iron: 5, gold: 9 }[look]
  return fx === 'full' ? n : fx === 'light' ? Math.ceil(n / 2) : 0
}
/** The idle's frame rate: Light draws every other frame; off draws one still frame. */
export const idleFps = (fx: CrateFx): number => (fx === 'full' ? 60 : fx === 'light' ? 30 : 0)

/**
 * The hop at `ms` since it began: how far up (crate pixels) and the squash
 * (1 = none; under 1 = flattened, with the width widened to match).
 */
export function hopAt(ms: number): { lift: number; squash: number } {
  if (!(ms >= 0) || ms >= HOP_MS) return { lift: 0, squash: 1 }
  const k = ms / HOP_MS
  if (k < 0.15) return { lift: 0, squash: 1 - 0.12 * (k / 0.15) } // crouch
  if (k < 0.7) {
    const u = (k - 0.15) / 0.55
    return { lift: 4 * Math.sin(u * Math.PI), squash: 1.06 }
  }
  const u = (k - 0.7) / 0.3
  return { lift: 0, squash: 1 - 0.1 * Math.sin(u * Math.PI) } // land
}

/** A rattle between hops (something inside wants out): a quick two-way wiggle. */
export const RATTLE_MS = 320
/** The rattle's tilt (radians) at `ms` since it began: ± a few degrees, dying away. */
export function rattleAt(ms: number): number {
  if (!(ms >= 0) || ms >= RATTLE_MS) return 0
  const k = ms / RATTLE_MS
  return Math.sin(k * Math.PI * 4) * 0.06 * (1 - k)
}

/** The glow's strength (0–1) at `ms`: a slow breath. */
export const breathAt = (ms: number): number => 0.5 + 0.5 * Math.sin((ms / BREATH_MS) * Math.PI * 2)
