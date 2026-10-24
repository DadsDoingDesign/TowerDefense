import { create } from 'zustand'
import type { CompanyId } from '../../../game/data/companies'

/**
 * A way into a company's loyalty track from outside the hub (Draft 4 · B):
 * the receipt's standing card asks for it, the run returns to the hub, and
 * the Root Shell opens the track page on that company. Presentation only —
 * never saved.
 */
interface TrackLink {
  /** The company whose track the hub should open next, or null. */
  want: CompanyId | null
  open: (company: CompanyId) => void
  clear: () => void
}

export const useTrackLink = create<TrackLink>((set) => ({
  want: null,
  open: (company) => set({ want: company }),
  clear: () => set({ want: null }),
}))
