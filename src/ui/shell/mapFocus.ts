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
 * View state, deliberately outside `gameStore`: it is never saved, never read
 * by the engine, and a resumed run should open on the map with nothing
 * focused. Kept tiny so it cannot grow into a second source of run truth.
 */
interface MapFocus {
  nodeId: string | null
  /** When the current focus landed — a same-node tap inside the settle window is not a march. */
  at: number
  focus: (id: string | null) => void
}

export const useMapFocus = create<MapFocus>((set) => ({
  nodeId: null,
  at: 0,
  focus: (id) => set({ nodeId: id, at: Date.now() }),
}))

/**
 * A second tap on the focused node marches — but not inside this window, so a
 * double-tap (or a WebKit double-tap-to-zoom) is one look, never a commit.
 * Same figure and same reasoning as `CONFIRM_SETTLE_MS` in PageScreens.
 */
export const MARCH_SETTLE_MS = 400
