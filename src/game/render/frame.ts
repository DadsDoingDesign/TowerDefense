/**
 * The renderer's shared frame state: the presentation clock, the live view
 * scale, and the letterbox transform. Set by `BattleCanvas` once per frame /
 * layout; read by every draw module.
 */
import type { GameMap } from '../types'

/**
 * The presentation clock (seconds) — ONE clock for every looping animation on
 * the field. The frame loop advances it by *simulated* time, so towers, enemies,
 * traps and auras pause together and speed up together (M28). It used to read
 * wall-clock time, which left towers idling through a frozen battle and idling
 * at 1× while enemies ran at 3×.
 */
let presentationTime = 0
export const setPresentationTime = (t: number): void => {
  presentationTime = t
}
export const animNow = (): number => presentationTime

export interface View {
  scale: number
  ox: number
  oy: number
}

/** Compute a letterbox transform mapping the logical field into the css box. */
export function fitView(cssW: number, cssH: number, map: GameMap): View {
  const scale = Math.min(cssW / map.width, cssH / map.height)
  const ox = (cssW - map.width * scale) / 2
  const oy = (cssH - map.height * scale) / 2
  return { scale, ox, oy }
}

/**
 * The live view scale — logical field px → CSS px — pushed in by `BattleCanvas`
 * whenever the element is laid out.
 *
 * The renderer draws into a 960×560 composite and has no other way to know how
 * far that composite is about to be squeezed, which is exactly how the tier
 * notch ended up **1.11 CSS px wide with a 0.72 px gap** on a 320×568 phone
 * (see `drawTierTag`). Any glyph whose job is to be READ needs a floor
 * expressed in the units the eye lives in, and that floor cannot be computed
 * without this number.
 *
 * Defaults to the shipping phone's 0.406 so a draw before the first layout —
 * or from a harness that never mounts `BattleCanvas` — is sized sanely rather
 * than sized for a desktop.
 */
let viewScale = 0.40625
export const setViewScale = (s: number): void => {
  if (s > 0 && Number.isFinite(s)) viewScale = s
}
/** The live view scale, for glyphs that need a floor in CSS px. */
export const getViewScale = (): number => viewScale
