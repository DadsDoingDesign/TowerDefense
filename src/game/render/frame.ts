/**
 * The renderer's shared frame state: the presentation clock, the live view
 * scale, and the Stage view (grid-fit; the letterbox transform before it). Set by `BattleCanvas` once per frame /
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

/**
 * Compute a letterbox transform mapping the logical field into the css box.
 * Superseded in the battle by {@link stageView} (grid-fit), which fills the
 * Stage with the map; kept for anything that wants the plain fit.
 */
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

/**
 * ── The Stage view (grid-fit): the map fills the Stage, edge to edge ─────────
 *
 * `fitView` letterboxed the fixed field box into the Stage and left the rest
 * to a separately baked apron. The map is one continuous bake now
 * (`terrain.worldOf`), so the Stage simply shows as much of it as fits:
 *
 *  1. **What must be seen** is the playable rectangle (`terrain.playRect`):
 *     the road inside the grid, the Gate and every tile that is not forest.
 *     It is fit to the Stage's content box — the largest scale that keeps it
 *     all on screen — and everything the Stage has left over is more map.
 *  2. **Crisp where it can be** (the wide layout, `--field-snap`): a scale
 *     within 10% of a whole number of device px per field px snaps down to it
 *     (lossless, `pixelated`). Otherwise the field is not squeezed back to the
 *     smaller whole step — that is what left a 960px field in a 1451px Stage
 *     on a 1080p desk — it is composed at a whole-number DENSITY above the
 *     scale (`density` composite px per field px, every sprite a clean
 *     nearest-neighbour ×2 or ×3) and the compositor filters that one image
 *     down to the screen: the pixel art keeps even, square pixels at any size.
 *     Phones keep today's rule (their field is fit exactly, `auto` below 1:1).
 *  3. **The horde walks in from off-screen.** On the side the road ENTERS
 *     (`entry`), the view never shows past the field's edge — the leftover
 *     room goes to the Gate's side instead — so an enemy spawning at the
 *     path's first point is always off-screen and walks in along the road.
 *
 * Pure: the numbers only. `BattleCanvas` lays the element out and draws.
 */
export interface StageView {
  /** CSS px per field px. */
  scale: number
  /** Composite px per field px: 1, or the whole-number supersample of step 2. */
  density: number
  /** `image-rendering` for the element. */
  pixelated: boolean
  /** The part of the map the canvas shows, field px (whole numbers). */
  x0: number
  y0: number
  w: number
  h: number
  /** Where that part's top-left corner sits in the wrap, CSS px. */
  left: number
  top: number
}

export interface StageViewInput {
  /** The wrap's full box, CSS px. */
  wrapW: number
  wrapH: number
  /** The strips the wrap reserves (the boss nameplate) — the playable rect is fit below them. */
  padT: number
  padB: number
  dpr: number
  /** The wide layout's whole-device-pixel rule (`--field-snap`). */
  crisp: boolean
  play: { x0: number; y0: number; x1: number; y1: number }
  world: { x0: number; y0: number; w: number; h: number }
  /** The field edge the road enters by (the shipped fields: left, or top on a portrait twin), or null. */
  entry: 'left' | 'top' | null
}

/** A scale within this fraction of a whole number of device px snaps down to it. */
export const SNAP_WITHIN = 0.1
/** The largest supersample density (×3 covers every desk scale to 3:1). */
export const MAX_DENSITY = 3

export function stageView(v: StageViewInput): StageView {
  const dpr = v.dpr > 0 && Number.isFinite(v.dpr) ? v.dpr : 1
  const boxW = Math.max(1, v.wrapW)
  const boxH = Math.max(1, v.wrapH - v.padT - v.padB)
  const rw = Math.max(1, v.play.x1 - v.play.x0)
  const rh = Math.max(1, v.play.y1 - v.play.y0)
  const fit = Math.min(boxW / rw, boxH / rh)
  let scale = fit
  let density = 1
  let pixelated = fit * dpr >= 1
  if (v.crisp && fit * dpr >= 1) {
    const r = fit * dpr
    const n = Math.floor(r + 1e-6)
    if (n / r >= 1 - SNAP_WITHIN - 1e-9) {
      scale = n / dpr
      pixelated = true
    } else {
      density = Math.min(MAX_DENSITY, Math.ceil(r - 1e-6))
      pixelated = false
    }
  }
  // Centre the playable rect in the content box…
  let fx = (boxW - rw * scale) / 2 - v.play.x0 * scale
  let fy = v.padT + (boxH - rh * scale) / 2 - v.play.y0 * scale
  // …except toward the road's way in: never past the field's edge there.
  if (v.entry === 'left') fx = Math.min(fx, 0)
  else if (v.entry === 'top') fy = Math.min(fy, v.padT)
  const snap = (n: number) => Math.round(n * dpr) / dpr
  fx = snap(fx)
  fy = snap(fy)
  // The map the Stage shows, in whole field px, never past the bake.
  const wx0 = v.world.x0
  const wy0 = v.world.y0
  const wx1 = v.world.x0 + v.world.w
  const wy1 = v.world.y0 + v.world.h
  const x0 = Math.max(wx0, Math.floor(-fx / scale))
  const y0 = Math.max(wy0, Math.floor(-fy / scale))
  const x1 = Math.min(wx1, Math.ceil((v.wrapW - fx) / scale))
  const y1 = Math.min(wy1, Math.ceil((v.wrapH - fy) / scale))
  return {
    scale,
    density,
    pixelated,
    x0,
    y0,
    w: Math.max(1, x1 - x0),
    h: Math.max(1, y1 - y0),
    left: fx + x0 * scale,
    top: fy + y0 * scale,
  }
}

/** Which field edge the road enters by (its first point lies past it), or null. */
export function entrySide(map: GameMap): StageViewInput['entry'] {
  const p = map.path[0]
  if (!p) return null
  if (p.x < 0) return 'left'
  if (p.y < 0) return 'top'
  return null
}
