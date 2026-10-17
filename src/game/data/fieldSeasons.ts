import type { CompanyId } from './companies'
import type { ThemeId } from '../run/militiaTheme'

/**
 * The battlefield's season (Oct 2026). The designer: "Map should have
 * seasonal themes tho for battles", then "map seasons should have more
 * visual interest beyond a color filter". A run's battles wear its hiring
 * company's season — the same one the home's trade map shows on that
 * company's road (`ui/attract/mapRules.MAP_SEASONS`; same names, same mood)
 * — and the Sovereign Route your militia's chosen world's (none for the
 * house look).
 *
 * Each season is a PLACE, not a tint: it changes the scenery (the pines'
 * needles repainted, broadleaf trees standing in for some of them, rocks
 * wet or snowed on), lays a ground cover (dry grass, snow, mud), stands
 * seasonal props in the woods (hay bales, sunflowers, reeds, drifts) and
 * brings weather that moves (rain, snow, petals, fog banks, cloud shadows).
 *
 * The STATIC part is laid into the terrain BAKE (`render/season.ts`,
 * `render/seasonArt.ts`, once per map, nothing per frame), on the ground and
 * the scenery only: the road (and its verge), the danger ground (water,
 * fire, cursed) and every open tile's standing spot keep exactly what they
 * had, and upright props stand only on forest tiles. The MOVING part is
 * `render/weatherFx.ts`, drawn under the wagon and the units. Placement is a
 * hash of the field's id and the season — never a draw on any RNG stream.
 *
 * Pure data.
 */
export type EdgeKind = 'ember' | 'leaf' | 'fleck' | 'blossom' | 'spark' | 'ash' | 'drizzle' | 'petal' | 'mote' | 'snow' | 'star'

/**
 * A repaint of the pack's five-step foliage ramp (darkest → lightest; the
 * pines' and bushes' `#2a485e #27716f #2f966a #5ab659 #bdd763`).
 */
export type Ramp = readonly [string, string, string, string, string]
/** A repaint of the rocks' four steps (`#506a69 #669d9d #8cc3c4 #d0deb5`). */
export type RockRamp = readonly [string, string, string, string]

/** What a season stands in the scenery (`render/seasonArt.ts` draws each). */
export type PropKind =
  | 'bale' // a round hay bale
  | 'sheaf' // a stook of wheat sheaves
  | 'sunflower' // a clump of sunflowers
  | 'pumpkin' // Tiny Swords' pumpkins (CC0, `deco_12/13`)
  | 'flowers' // a cluster of blooms (flat)
  | 'puddle' // a rain puddle with the sky in it (flat)
  | 'mud' // a wet mud patch (flat)
  | 'reeds' // reeds and bulrushes
  | 'lily' // lily pads on the water's rim
  | 'mushroom' // Tiny Swords' mushrooms (CC0, `deco_01–02`), the caps repainted tan
  | 'drift' // a snow drift
  | 'leaves' // a drift of fallen leaves (flat)

/**
 * Where a prop may stand: `forest` — a forest tile's floor (upright props
 * live only there: an open tile never carries anything that looks like what
 * blocks a tile); `open` — flat props on the open grass, off every open
 * tile's standing spot; `water` — reeds on the bank and pads on the rim of a
 * lake (the lake itself stays water).
 */
export type PropWhere = 'forest' | 'open' | 'water'

export interface PropRule {
  kind: PropKind
  where: PropWhere
  /** The chance a candidate place takes one (0–1). */
  share: number
}

/** What moves in a season's weather layer (`render/weatherFx.ts`). */
export type WeatherKind = 'rain' | 'snow' | 'petal' | 'leaf' | 'dust' | 'fluff' | 'butterfly' | 'dew'

export interface SeasonWeather {
  /** The particles, as a weighted list (a kind twice is twice as common). */
  kinds: readonly WeatherKind[]
  /** How many on a phone at Full (a desk gets ~1.7×; Light halves both). */
  count: number
  /** Fog banks drifting at different speeds (parallax), thickest at the view's margins. */
  fog?: { color: string; alpha: number; banks: number }
  /** Cloud shadows drifting slowly across the field. */
  clouds?: { color: string; alpha: number; count: number }
  /** A sheet of rain or snow falling over the view (a scrolled tile, faint over the game, fuller at the edges). */
  sheet?: 'rain' | 'snow'
  /** A rare, faint flash of lightning, at the margins only (Full only). */
  lightning?: boolean
}

export interface FieldSeason {
  name: string
  /** Washes over the ground and scenery, in order: a composite op, a colour, its strength. */
  washes: readonly { op: GlobalCompositeOperation; color: string; alpha: number }[]
  /** Speckle on the open grass (fallen leaves, blossom, hoar-frost): colours and the share of grass pixels. */
  ground?: { colors: readonly string[]; share: number }
  /**
   * A ground cover in patches over the grass (dry grass, snow, mud): its
   * ramp (dark → light; a grass pixel takes the step of its own lightness,
   * so the grass's texture shows through), how much of the grass it covers
   * (0–1), and whether the darkest blades poke through it.
   */
  cover?: { colors: readonly string[]; share: number; tufts?: boolean; grain: number }
  /** Snow along the top of every tree, rock and bush: its colour and the shade under it. */
  caps?: { color: string; shade: string }
  /**
   * The pines repainted: each tree takes one of these ramps, by a hash
   * (null keeps the pack's green), and the bushes theirs.
   */
  foliage?: { ramps: readonly (Ramp | null)[]; bush?: Ramp }
  /** Round broadleaf trees standing in for a share of the pines, in these ramps; `blossom` dots them with flowers. */
  broadleaf?: { share: number; ramps: readonly Ramp[]; blossom?: readonly string[] }
  /** The rocks repainted (wet, snowed on) — a lightest step past the pack's own is a highlight. */
  rocks?: RockRamp
  /** Icicles under the pines' boughs. */
  icicles?: boolean
  /** The lakes' rims frozen (the water inside stays water). */
  ice?: boolean
  /** Dew: a sparse glint on the grass (the weather layer twinkles some of it). */
  dew?: number
  /** A low light from one side: how much it lifts the lit side and dims the far side, and how long the shadows fall (×). */
  light?: { from: 'w' | 'e'; lift: number; dim: number; shadow: number }
  /** Seasonal props in the scenery. */
  props?: readonly PropRule[]
  /** Colour that survives the environment grade's gold cut (the season's own accents: harvest gold, snow's cool white). */
  accent?: boolean
  /** A low mist: its colour, its strongest alpha, and how far up the map it reaches (0–1). */
  mist?: { color: string; alpha: number; reach: number }
  /** What drifts in the battle's edge band in this season (with the world's own kinds). */
  edge: readonly EdgeKind[]
  /** The season's weather (`render/weatherFx.ts`). */
  weather: SeasonWeather
}

// The ramps. Chosen to read through the environment grade (`terrain.gradeEnvironment`:
// saturation ×0.62), and kept off the enemies' tier hues where the grade cannot.
const RUST: Ramp = ['#3a2230', '#6a2e2a', '#9e4a2a', '#cc6e30', '#eca04a']
const AMBER: Ramp = ['#3e2a34', '#7a4a26', '#b4782a', '#dca238', '#f4d266']
const CRIMSON: Ramp = ['#341c2c', '#5e2430', '#8e3430', '#b8502e', '#de8444']
const MAPLE: Ramp = ['#3a2230', '#74321e', '#b4561e', '#e08a2c', '#f6c058']
const FRESH: Ramp = ['#24504a', '#2a8656', '#3aac58', '#74d256', '#d2f07a']
const BLOSSOM: Ramp = ['#5a3a5a', '#9c5e7c', '#d48aa6', '#f0b8cc', '#fde8f0']
const WHITE_BLOOM: Ramp = ['#4e4e66', '#8a88a6', '#c6c4da', '#eceaf4', '#ffffff']
const WET: Ramp = ['#182a3a', '#1a4450', '#205e58', '#367c54', '#6c9c62']
const HAZE: Ramp = ['#4a5a6a', '#5a8284', '#6a9c8a', '#90bc8c', '#cfdcb0']
const SNOWPINE: Ramp = ['#203a52', '#26585e', '#d4e0ee', '#eef4fc', '#ffffff']
const SNOWBUSH: Ramp = ['#7a90ac', '#a4b8d0', '#d0dcec', '#eaf0fa', '#ffffff']

export const FIELD_SEASONS: Record<CompanyId, FieldSeason> = {
  // Peppercorn: late summer into the harvest — the larches turning, maples in
  // the wood, the grass gone to straw in patches, bales and sunflowers among
  // the trees, a low warm sun with long shadows, dust and seed fluff drifting.
  spice: {
    name: 'late summer',
    washes: [{ op: 'soft-light', color: '#f0a040', alpha: 0.3 }],
    ground: { colors: ['#8a4a1e', '#a85a24', '#6e3c18'], share: 0.02 },
    // The straw leans to the green side of yellow (~70°), past tier 4's gold
    // (30–60°), so it goes through the grade as straw rather than as a cut
    // grey (Oct 2026 job critique: the ground cover keeps no tier's hue).
    cover: { colors: ['#748745', '#8fa752', '#a9c06d', '#c1d788'], share: 0.42, grain: 1 },
    foliage: { ramps: [AMBER, RUST, AMBER, CRIMSON, null], bush: RUST },
    broadleaf: { share: 0.3, ramps: [MAPLE, RUST, CRIMSON] },
    light: { from: 'w', lift: 0.1, dim: 0.12, shadow: 2.4 },
    accent: true,
    props: [
      { kind: 'bale', where: 'forest', share: 0.22 },
      { kind: 'sheaf', where: 'forest', share: 0.14 },
      { kind: 'sunflower', where: 'forest', share: 0.16 },
      { kind: 'pumpkin', where: 'forest', share: 0.12 },
      { kind: 'leaves', where: 'open', share: 0.05 },
    ],
    edge: ['ember', 'ember', 'leaf'],
    weather: { kinds: ['dust', 'dust', 'fluff', 'fluff', 'leaf'], count: 30 },
  },
  // Easel House: spring — fresh green, blossom trees in pink and white,
  // flowers through the meadow, petals on the air and a pair of butterflies.
  art: {
    name: 'spring',
    washes: [{ op: 'soft-light', color: '#7ad85a', alpha: 0.26 }],
    ground: { colors: ['#f0c8d8', '#fbeef2', '#e8a8c4'], share: 0.008 },
    foliage: { ramps: [FRESH], bush: FRESH },
    broadleaf: { share: 0.38, ramps: [BLOSSOM, BLOSSOM, WHITE_BLOOM], blossom: ['#fff4f8', '#f6c8da'] },
    accent: true,
    props: [
      { kind: 'flowers', where: 'open', share: 0.32 },
      { kind: 'flowers', where: 'forest', share: 0.5 },
    ],
    edge: ['fleck', 'fleck', 'blossom'],
    weather: { kinds: ['petal', 'petal', 'petal', 'butterfly'], count: 30 },
  },
  // Ironvein: overcast and raining — dark wet pines, rocks with a wet shine,
  // mud and puddles with the sky in them, rain falling and splashing, cloud
  // shadows crossing the field, now and then a far-off flash.
  metals: {
    name: 'overcast',
    washes: [
      { op: 'saturation', color: '#7a7a7a', alpha: 0.45 },
      { op: 'soft-light', color: '#9aaccc', alpha: 0.3 },
    ],
    cover: { colors: ['#647458', '#708064', '#7e8e70', '#8c9c7c'], share: 0.34, grain: 1.4 },
    foliage: { ramps: [WET], bush: WET },
    rocks: ['#3e4e56', '#56747a', '#7a9ca2', '#c4d8de'],
    props: [
      { kind: 'puddle', where: 'open', share: 0.1 },
      { kind: 'mud', where: 'open', share: 0.04 },
      { kind: 'puddle', where: 'forest', share: 0.16 },
      { kind: 'mud', where: 'forest', share: 0.22 },
    ],
    edge: ['spark', 'spark', 'ash'],
    weather: { kinds: ['rain'], count: 40, sheet: 'rain', clouds: { color: '#141c2a', alpha: 0.16, count: 2 }, lightning: true },
  },
  // Rosethread: a misty morning — fog banks drifting at the margins, the far
  // trees softened, dew on the grass, reeds and lily pads by the water,
  // mushrooms in the wood.
  silk: {
    name: 'misty morning',
    washes: [
      { op: 'soft-light', color: '#e8c8d8', alpha: 0.2 },
      { op: 'screen', color: '#3a3444', alpha: 0.35 },
    ],
    foliage: { ramps: [HAZE], bush: HAZE },
    dew: 0.006,
    light: { from: 'e', lift: 0.08, dim: 0, shadow: 1 },
    mist: { color: '#d8ccd8', alpha: 0.3, reach: 0.9 },
    props: [
      { kind: 'reeds', where: 'water', share: 0.7 },
      { kind: 'lily', where: 'water', share: 0.5 },
      { kind: 'reeds', where: 'forest', share: 0.16 },
      { kind: 'mushroom', where: 'forest', share: 0.22 },
    ],
    edge: ['petal', 'mote'],
    weather: { kinds: ['dew', 'dew', 'dust'], count: 18, fog: { color: '#f4eef6', alpha: 0.85, banks: 6 } },
  },
  // Moonquill: frost — snow over the ground with the grass poking through,
  // snow-laden pines with icicles, rocks and bushes under snow, the lakes'
  // rims frozen, a steady snowfall.
  scrolls: {
    name: 'frost',
    washes: [
      { op: 'saturation', color: '#8a8a8a', alpha: 0.3 },
      { op: 'screen', color: '#1c2638', alpha: 0.32 },
    ],
    cover: { colors: ['#c2d0e4', '#d2deee', '#e0e9f6', '#eef4fc'], share: 0.86, tufts: true, grain: 1.2 },
    caps: { color: '#f2f6fa', shade: '#b8c6d6' },
    foliage: { ramps: [SNOWPINE], bush: SNOWBUSH },
    rocks: ['#7c8ea6', '#a8bad0', '#dce6f4', '#ffffff'],
    icicles: true,
    ice: true,
    accent: true,
    props: [{ kind: 'drift', where: 'forest', share: 0.3 }],
    edge: ['star', 'star', 'snow'],
    weather: { kinds: ['snow'], count: 40, sheet: 'snow' },
  },
}

/** The season a battle wears for the theme its run wears (none for the house look). */
export const fieldSeasonFor = (theme: ThemeId | null | undefined): FieldSeason | null => (theme && theme !== 'neutral' ? FIELD_SEASONS[theme] : null)
