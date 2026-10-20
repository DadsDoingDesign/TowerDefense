import type { CSSProperties } from 'react'
import { create } from 'zustand'
import { ELEMENT_TOKEN, type FusionElement } from '../../game/data/fusions'
import type { FxLevel } from '../../game/render/fxQuality'

/**
 * The fuse beat (skill fusion, Oct 2026, `docs/SKILL_FUSION.md` § 5): the
 * moment two of a hero's skills become one. The two part cards slide in and
 * slam together, a flash in the fusion's element colour, and the fused card
 * settles — drawn by `FuseBeat.tsx` in the Context panel, with
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
  /** When the beat hands back to the hero's card. */
  totalMs: number
  /** Whether anything moves at all. */
  moves: boolean
}

/**
 * Full: ≈ 0.9 s — slide 260, flash 140, settle 360, a beat to read. Light (the
 * Effects setting, or the automatic step down): no flash, a short slam, the
 * cards cut in. Off (reduced motion): nothing moves — the fused card stands,
 * still, long enough to read its name, and the chord plays.
 */
export function fuseBeatPlan(level: FxLevel): FuseBeatPlan {
  if (level === 'off') return { slideMs: 0, flashMs: 0, settleMs: 0, totalMs: 1100, moves: false }
  if (level === 'light') return { slideMs: 140, flashMs: 0, settleMs: 220, totalMs: 700, moves: true }
  return { slideMs: 260, flashMs: 140, settleMs: 360, totalMs: 920, moves: true }
}

/** What the beat shows: the hero, the fusion, and its two parts. */
export interface FuseBeatShow {
  heroId: string
  fusionId: string
  parts: readonly [string, string]
  /** `Date.now()` when it began (a re-render never restarts it). */
  at: number
}

export const useFuseBeat = create<{ show: FuseBeatShow | null }>(() => ({ show: null }))

/** Start the beat (the Level-up panel calls this as it commits a fusion). */
export function playFuseBeat(heroId: string, fusionId: string, parts: readonly [string, string]): void {
  useFuseBeat.setState({ show: { heroId, fusionId, parts, at: Date.now() } })
}

/** End it — on its own clock, or on a tap. */
export function endFuseBeat(): void {
  if (useFuseBeat.getState().show) useFuseBeat.setState({ show: null })
}

/** A fusion's element, as the CSS custom property its tag, rule, slot and flash read (a design token). */
export const elementVar = (f: { element: FusionElement }): CSSProperties => ({ '--fz': `var(${ELEMENT_TOKEN[f.element]})` }) as CSSProperties
