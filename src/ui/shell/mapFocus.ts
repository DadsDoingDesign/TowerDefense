import { create } from 'zustand'

/**
 * Which run-map node the player is LOOKING at, as opposed to marching to
 * (Wave 1).
 *
 * Tapping a node used to call `selectNode` straight away, which commits the
 * march — so the only way to learn what a fork held was to walk into it. A tap
 * now focuses the node and fills the Context panel with what waits there
 * (`NodePreview`); the march is a second, deliberate action.
 *
 * View state, deliberately outside `gameStore`: it is never saved and never
 * read by the engine. The map opens on a stop you can march to (`offer`). Kept tiny so it cannot grow into a second source of run truth.
 */
interface MapFocus {
  nodeId: string | null
  /** When the current focus landed — a same-node tap inside the settle window is not a march. */
  at: number
  /**
   * The map put this focus there, not the player (Oct 2026 review): the map
   * opens on a stop you can march to, so the Context panel always says what
   * is ahead instead of standing empty under a hint. A tap on an auto-focused
   * node is still a LOOK — only a second tap marches.
   */
  auto: boolean
  focus: (id: string | null) => void
  /** Focus a stop on the player's behalf (see `auto`). */
  offer: (id: string) => void
}

export const useMapFocus = create<MapFocus>((set) => ({
  nodeId: null,
  at: 0,
  auto: false,
  focus: (id) => set({ nodeId: id, at: Date.now(), auto: false }),
  offer: (id) => set({ nodeId: id, at: Date.now(), auto: true }),
}))

/** The stop the map opens on: the first one you can march to. */
export const openingFocus = (reachable: readonly string[], cleared: readonly string[]): string | null =>
  reachable.find((id) => !cleared.includes(id)) ?? null

/**
 * A second tap on the focused node marches — but not inside this window, so a
 * double-tap (or a WebKit double-tap-to-zoom) is one look, never a commit.
 * Same figure and same reasoning as `CONFIRM_SETTLE_MS` in PageScreens.
 */
export const MARCH_SETTLE_MS = 400

/**
 * Where the run map scrolls to so the reachable row is fully on screen (Oct
 * 2026 audit, 3.7). The old rule put the CURRENT node 65% down the box, which
 * on a phone — the route panel takes ~85px of the Stage above the map — left
 * the reachable row (one layer up, ~104px higher) cut by the box's top edge,
 * most visibly after a win. Now: the span from the top of the reachable row
 * to the bottom of the current node is centred in the box when it fits, and
 * when it does not the reachable row wins — it is the decision in front of the
 * player. `above`/`below` are how far a node's box (label, threat chip, ring)
 * reaches past its centre. Pure, unit-tested.
 */
export function frontierScrollTop(f: { curY: number; reachYs: readonly number[]; box: number; above?: number; below?: number }): number {
  const above = f.above ?? 64
  const below = f.below ?? 56
  const top = Math.min(f.curY, ...f.reachYs) - above
  const bottom = f.curY + below
  const span = bottom - top
  const at = span <= f.box ? top - (f.box - span) / 2 : top
  return Math.max(0, Math.round(at))
}
