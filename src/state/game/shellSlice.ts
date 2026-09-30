/**
 * Shell slice: the Root Shell's selection state (what fills the Context panel,
 * which hero tab, which gear slot is waiting). Presentation only — none of it
 * is snapshotted. See docs/FIGMA.md § The Root Shell.
 */
import { sfx } from '../../audio/audio'
import type { HeroSlot } from '../../game/types'
import type { HeroTab, ShellSelection, Slice } from './types'

export interface ShellActions {
  /** Tapping a deployed tower on the field. */
  focusTower: (sentinelId: string) => void
  shellSelect: (sel: ShellSelection) => void
  setHeroTab: (tab: HeroTab) => void
  activateGearSlot: (sentinelId: string, slot: HeroSlot) => void
  clearGearSlot: () => void
  /** Open / close the Detail band during a collapsed (portrait) setup. */
  toggleDetail: () => void
  /**
   * G1-2: a tap landed on a blocked tile — note it, so the coach strip says
   * why ("Rock: nothing can stand here"). A no-op for an open or unknown tile.
   */
  noteTerrain: (tileId: string) => void
  /** G1-2: a tap landed on the road itself, between the tiles. */
  noteRoad: () => void
  /** Retire the blocked-tile note (the strip's "Got it", or its timeout). */
  clearFieldNote: () => void
}

export const createShellSlice: Slice<ShellActions> = (set, get) => ({
  // Tapping a placed tower on the field puts that hero in the Context panel
  // on its Upgrades tab. Deliberately leaves `selectedSentinelId`
  // alone — tapping a tower inspects it, it does not pick it up.
  focusTower: (sentinelId) =>
    set({
      shellSelection: { kind: 'hero', id: sentinelId },
      heroTab: 'upgrades',
      gearSlot: null,
    }),

  // Selecting a hero is also what arms it for placement, so the Selector's
  // one gesture both fills the Context panel and picks up the tower.
  shellSelect: (sel) => {
    const prev = get().shellSelection
    const same = prev && sel && prev.kind === sel.kind && prev.id === sel.id
    const next = same ? null : sel
    set({
      shellSelection: next,
      heroTab: next?.kind === 'hero' && prev?.kind === 'hero' && prev.id === next.id ? get().heroTab : 'stats',
      gearSlot: null,
      selectedSentinelId: next?.kind === 'hero' ? next.id : null,
    })
  },

  setHeroTab: (tab) => set({ heroTab: tab, gearSlot: null }),

  activateGearSlot: (sentinelId, slot) => set({ gearSlot: { sentinelId, slot } }),
  clearGearSlot: () => set({ gearSlot: null }),
  toggleDetail: () => set({ detailOpen: !get().detailOpen }),

  noteTerrain: (tileId) => {
    const tile = get().battleMap.tiles?.find((t) => t.id === tileId)
    if (!tile?.block) return
    set({ fieldNote: { tileId, kind: tile.block, at: Date.now() } })
    sfx('error')
  },
  noteRoad: () => {
    set({ fieldNote: { tileId: null, kind: 'lane', at: Date.now() } })
    sfx('error')
  },
  clearFieldNote: () => {
    if (get().fieldNote) set({ fieldNote: null })
  },
})
