import type { CSSProperties } from 'react'
import { create } from 'zustand'
import { ELEMENT_TOKEN, type FusionElement } from '../../game/data/fusions'
import type { FxLevel } from '../../game/render/fxQuality'

/**
 * The fuse beat (merging, Oct 2026, `docs/SKILL_FUSION.md` § 5): the
 * moment a card is poured into a held skill. The base and the card slide in
 * and slam together, a flash in the merge's element colour, and the merged
 * card settles — drawn by `FuseBeat.tsx` in the Context panel, with
 * `audio.sfxFusion` landing on the slam.
 *
 * Pure timings here (`tests/fuseBeat.test.ts`); view state beside them, like
 * `levelUps.ts`: what is playing, never snapshotted, never read by the game.
 * The fusion itself is already in the store when the beat starts: the beat
 * only SHOWS it, so skipping it (a tap) loses nothing.
 */
export interface FuseBeatPlan {
  /** The parts slide in from the panel's sides (0: they start together). */
  slideMs: number
  /** The flash after the slam (0: none). */
  flashMs: number
  /** The fused card settles in. */
  settleMs: number
  /**
   * The picture making itself (the merge art pass): the infusion's motif (a
   * named merge: the card) flies onto the base at `flyAtMs` for `flyMs`, and
   * the base's colours swap to the infusion's at `swapAtMs` for `swapMs` (a
   * named merge: the new picture comes in). All 0 under reduced motion: the
   * merged picture simply stands.
   */
  flyAtMs: number
  flyMs: number
  swapAtMs: number
  swapMs: number
  /** When the beat hands back to the hero's card. */
  totalMs: number
  /** Whether anything moves at all. */
  moves: boolean
}

/**
 * Full: 1 s — slide 260, flash 140, settle 360; inside the settling card the
 * motif flies on (60 ms after it starts to rise, 220 ms) and the colours pour
 * over the base as it lands (200 ms in, 160 ms), then a beat to read. Light
 * (the Effects setting, or the automatic step down): no flash, a short slam,
 * the cards cut in, the motif drops on and the colours swap quickly. Off
 * (reduced motion): nothing moves — the merged card and its picture stand,
 * still, long enough to read its name, and the chord plays.
 */
export function fuseBeatPlan(level: FxLevel): FuseBeatPlan {
  if (level === 'off') return { slideMs: 0, flashMs: 0, settleMs: 0, totalMs: 1100, moves: false, flyAtMs: 0, flyMs: 0, swapAtMs: 0, swapMs: 0 }
  if (level === 'light') return { slideMs: 140, flashMs: 0, settleMs: 220, totalMs: 760, moves: true, flyAtMs: 180, flyMs: 120, swapAtMs: 260, swapMs: 90 }
  return { slideMs: 260, flashMs: 140, settleMs: 360, totalMs: 1000, moves: true, flyAtMs: 320, flyMs: 220, swapAtMs: 460, swapMs: 160 }
}

/** What the beat shows: the hero, the merge, and [the base it was dropped on, the card]. */
export interface FuseBeatShow {
  heroId: string
  fusionId: string
  parts: readonly [string, string]
  /** `Date.now()` when it began (a re-render never restarts it). */
  at: number
}

export const useFuseBeat = create<{ show: FuseBeatShow | null }>(() => ({ show: null }))

/** Start the beat (the Level-up panel calls this as it commits a merge). */
export function playFuseBeat(heroId: string, fusionId: string, parts: readonly [string, string]): void {
  useFuseBeat.setState({ show: { heroId, fusionId, parts, at: Date.now() } })
}

/** End it — on its own clock, or on a tap. */
export function endFuseBeat(): void {
  if (useFuseBeat.getState().show) useFuseBeat.setState({ show: null })
}

/** A fusion's element, as the CSS custom property its tag, rule, slot and flash read (a design token). */
export const elementVar = (f: { element: FusionElement }): CSSProperties => ({ '--fz': `var(${ELEMENT_TOKEN[f.element]})` }) as CSSProperties
