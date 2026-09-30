/**
 * Shell slice: the Root Shell's selection state (what fills the Context panel,
 * which hero tab, which gear slot is waiting). Presentation only — none of it
 * is snapshotted. See docs/FIGMA.md § The Root Shell.
 */
import { sfx } from '../../audio/audio'
import { dangerAt } from '../../game/data/hazards'
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
  /**
   * Q1: a hero was just posted or moved onto `tileId`; if that tile is cursed
   * ground, the coach strip says what it costs (and the canvas flashes it). A
   * no-op on safe ground, and it does not re-announce, inside 1.5s, the tile it
   * is already naming.
   */
  noteDanger: (tileId: string) => void
  /** Q1: {@link noteDanger} for this field's cursed tile, if it has one — on arming a hero. */
  noteDangerOnField: () => void
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
    // Q1: arming a hero on a field with cursed ground says what that ground
    // costs — now, while the finger is still on the Selector, rather than on
    // press-over-the-tile, where the strip opening would slide the field out
    // from under the finger. The canvas outlines the tile for as long.
    const st = get()
    if (next?.kind === 'hero' && st.screen === 'battle' && st.battlePhase === 'setup' && !st.engine) st.noteDangerOnField()
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
  noteDanger: (tileId) => {
    const kind = dangerAt(get().battleMap, tileId)
    if (!kind) return
    const cur = get().fieldNote
    if (cur && cur.tileId === tileId && cur.kind === kind && Date.now() - cur.at < 1500) return
    set({ fieldNote: { tileId, kind, at: Date.now() } })
  },
  noteDangerOnField: () => {
    const t = get().battleMap.tiles?.find((x) => x.danger)
    if (t) get().noteDanger(t.id)
  },
})
