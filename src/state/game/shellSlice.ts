/**
 * Shell slice: the Root Shell's selection state (what fills the Context panel,
 * which hero tab, which gear slot is waiting). Presentation only — none of it
 * is snapshotted. See docs/FIGMA.md § The Root Shell.
 */
import type { HeroSlot } from '../../game/types'
import type { HeroTab, ShellSelection, Slice } from './types'

export interface ShellActions {
  /** Tapping a deployed tower on the field. */
  focusTower: (sentinelId: string) => void
  shellSelect: (sel: ShellSelection) => void
  setHeroTab: (tab: HeroTab) => void
  activateGearSlot: (sentinelId: string, slot: HeroSlot) => void
  clearGearSlot: () => void
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
})
