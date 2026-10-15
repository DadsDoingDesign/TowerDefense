import type { CompanyId } from './companies'
import type { ThemeId } from '../run/militiaTheme'

/**
 * The battlefield's season (Oct 2026). The designer: "Map should have
 * seasonal themes tho for battles". A run's battles wear its hiring
 * company's season — the same one the home's trade map shows on that
 * company's road (`ui/attract/mapRules.MAP_SEASONS`; same names, same mood)
 * — and the Sovereign Route your militia's chosen world's (none for the
 * house look).
 *
 * Laid into the terrain BAKE (`render/season.ts`, once per map, nothing per
 * frame), on the ground and the scenery only: the road, the danger ground
 * (water, fire, cursed) and everything drawn over the bake — slots, units,
 * shots, the wagon — keep exactly their colours. The environment grade runs
 * after it, so a season can never put a hue back into a channel the enemies
 * have reserved (`terrain.gradeEnvironment`).
 *
 * Pure data.
 */
export type EdgeKind = 'ember' | 'leaf' | 'fleck' | 'blossom' | 'spark' | 'ash' | 'drizzle' | 'petal' | 'mote' | 'snow' | 'star'

export interface FieldSeason {
  name: string
  /** Washes over the ground and scenery, in order: a composite op, a colour, its strength. */
  washes: readonly { op: GlobalCompositeOperation; color: string; alpha: number }[]
  /** Speckle on the open grass (fallen leaves, blossom, hoar-frost): colours and the share of grass pixels. */
  ground?: { colors: readonly string[]; share: number }
  /** Snow along the top of every tree, rock and bush: its colour and the shade under it. */
  caps?: { color: string; shade: string }
  /** Flecks in the tree-tops (turning leaves, blossom): colours and share of crown pixels. */
  crowns?: { colors: readonly string[]; share: number }
  /** A low mist: its colour, its strongest alpha, and how far up the map it reaches (0–1). */
  mist?: { color: string; alpha: number; reach: number }
  /** What drifts in the battle's edge band in this season (with the world's own kinds). */
  edge: readonly EdgeKind[]
}

export const FIELD_SEASONS: Record<CompanyId, FieldSeason> = {
  // Peppercorn: late summer into autumn — amber light, leaves turning and falling.
  spice: {
    name: 'late summer',
    washes: [{ op: 'soft-light', color: '#f0a040', alpha: 0.3 }],
    ground: { colors: ['#8a4a1e', '#a85a24', '#6e3c18'], share: 0.03 },
    crowns: { colors: ['#b86a26', '#9c5420'], share: 0.1 },
    edge: ['ember', 'ember', 'leaf'],
  },
  // Easel House: spring — fresh green, blossom on the boughs and the grass.
  art: {
    name: 'spring',
    washes: [{ op: 'soft-light', color: '#7ad85a', alpha: 0.24 }],
    ground: { colors: ['#f0c8d8', '#fbeef2', '#e8a8c4'], share: 0.012 },
    crowns: { colors: ['#f2c4d6', '#fbe4ec'], share: 0.07 },
    edge: ['fleck', 'fleck', 'blossom'],
  },
  // Ironvein: overcast — the colour drained toward slate, a drizzle at the edges.
  metals: {
    name: 'overcast',
    washes: [
      { op: 'saturation', color: '#7a7a7a', alpha: 0.42 },
      { op: 'soft-light', color: '#6a7a9a', alpha: 0.26 },
    ],
    edge: ['spark', 'spark', 'ash', 'drizzle'],
  },
  // Rosethread: a misty morning — a pale haze lying low.
  silk: {
    name: 'misty morning',
    washes: [{ op: 'soft-light', color: '#e8c8d8', alpha: 0.18 }],
    mist: { color: '#d8ccd8', alpha: 0.26, reach: 0.9 },
    edge: ['petal', 'petal', 'mote'],
  },
  // Moonquill: frost — a cool light, snow on the trees and rocks, rime on the grass.
  scrolls: {
    name: 'frost',
    washes: [
      { op: 'saturation', color: '#8a8a8a', alpha: 0.3 },
      { op: 'screen', color: '#1c2638', alpha: 0.42 },
    ],
    ground: { colors: ['#dce4ee', '#c4d0de'], share: 0.05 },
    caps: { color: '#f2f6fa', shade: '#b8c6d6' },
    edge: ['snow', 'snow', 'star'],
  },
}

/** The season a battle wears for the theme its run wears (none for the house look). */
export const fieldSeasonFor = (theme: ThemeId | null | undefined): FieldSeason | null => (theme && theme !== 'neutral' ? FIELD_SEASONS[theme] : null)
