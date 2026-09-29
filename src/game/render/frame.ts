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

/**
 * The pixmap density units (heroes and enemies) are drawn at — Phase 2,
 * "readable battles".
 *
 * The shell caps at 520px wide, so the 960-wide field is ALWAYS displayed at a
 * view scale of 0.54 or less, and at 390px it is 0.406. At the pack's ×½ bucket
 * a line goblin was ~12 CSS px tall and a hero ~15 on the shipping phone —
 * measured, not estimated — against a readability target of 24. The field is
 * width-bound on every portrait phone (the lane runs edge to edge on both maps,
 * so no zoom can grow it without cropping the lane), which leaves exactly one
 * honest lever: draw the units at the pack's NATIVE density. That is the
 * cleanest bucket the pipeline has — the source drawn 1:1, no filter at all —
 * and it roughly doubles every unit: goblins ~24 CSS px, heroes ~30.
 *
 * The champion keeps its "exactly 2× its line troops" rule by taking the new
 * `2` bucket (a lossless pixel-doubled native strip).
 *
 * Nothing here is gameplay: `type.radius`, ranges, slots and the path are
 * untouched, only the art's size on the composite changes. A pack authored at
 * one density (`spriteScale: 1`, the fieldwatch pack) keeps what it had.
 */
export function unitPixmapScale(spriteScale: 0.5 | 1, champion = false): 0.5 | 1 | 2 {
  if (spriteScale === 1) return 1
  return champion ? 2 : 1
}
