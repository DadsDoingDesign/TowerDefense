import { OUTLINE, type Palette, type PixelRows } from './pixelArt'

/**
 * ---------------------------------------------------------------------------
 * Your company's flag (the mercenary company; the flag builder, Oct 2026)
 * ---------------------------------------------------------------------------
 *
 * The designer: "a more fleshed out flag builder with better options for
 * designs and colours and then also shapes". A flag is six choices, each a
 * carousel in the builder (`ui/shell/MilitiaScreen.tsx`):
 *
 *  - its SHAPE of cloth;
 *  - its FIELD colour (a tincture);
 *  - a PATTERN that divides the field (plain, per pale, quarterly, a chevron…);
 *  - the pattern's own colour (a second tincture);
 *  - an EMBLEM (a 5 × 5 charge — or none);
 *  - the emblem's METAL, which also edges the cloth.
 *
 * The tinctures stay dark ON PURPOSE (`trade/NOTES.md` § Palette): each sits
 * at ΔE2000 ≥ 26 from every company colour, so a flag never reads as a
 * company or a rarity; the metal (parchment, gold, silver) is what carries it
 * on the dark map and the green field alike.
 *
 * Pure data: the UI draws the rows as SVG (`ui/pixel.tsx`) and the canvases
 * (the battle's wagon, the menu's trade map) draw the same rows. An older
 * save's flag (shape, tincture, charge) is a plain flag in parchment.
 */
export const BANNER_SHAPES = ['swallow', 'square', 'pennant', 'tri', 'gonfalon', 'shield', 'notch', 'wave', 'tall'] as const
export type BannerShape = (typeof BANNER_SHAPES)[number]

export const TINCTURES = {
  sable: '#26242c',
  navy: '#28386a',
  indigo: '#33285e',
  slate: '#3c4a5c',
  teal: '#1f4f52',
  forest: '#2f5638',
  moss: '#4a5226',
  ochre: '#6a5420',
  umber: '#5c3b22',
  rust: '#6e3418',
  crimson: '#6b2226',
  wine: '#5a1f3a',
  plum: '#4e2c4c',
  ash: '#6c675f',
} as const
export type Tincture = keyof typeof TINCTURES
export const TINCTURE_IDS = Object.keys(TINCTURES) as Tincture[]

/** What the builder calls each choice. */
export const SHAPE_NAMES: Record<BannerShape, string> = {
  swallow: 'Swallowtail',
  square: 'Square',
  pennant: 'Pennant',
  tri: 'Cut',
  gonfalon: 'Gonfalon',
  shield: 'Shield',
  notch: 'Notched',
  wave: 'Tattered',
  tall: 'Standard',
}
export const TINCTURE_NAMES: Record<Tincture, string> = {
  sable: 'Sable',
  navy: 'Navy',
  indigo: 'Indigo',
  slate: 'Slate',
  teal: 'Teal',
  forest: 'Forest',
  moss: 'Moss',
  ochre: 'Ochre',
  umber: 'Umber',
  rust: 'Rust',
  crimson: 'Crimson',
  wine: 'Wine',
  plum: 'Plum',
  ash: 'Ash',
}

/** The patterns that divide the field: where the pattern's colour lies. */
export const PATTERNS = ['plain', 'pale', 'fess', 'quarterly', 'bend', 'chevron', 'barry', 'paly', 'cross', 'saltire', 'chief', 'pall'] as const
export type Pattern = (typeof PATTERNS)[number]
export const PATTERN_NAMES: Record<Pattern, string> = {
  plain: 'Plain',
  pale: 'Halves',
  fess: 'Top & bottom',
  quarterly: 'Quarters',
  bend: 'Diagonal',
  chevron: 'Chevron',
  barry: 'Bars',
  paly: 'Stripes',
  cross: 'Cross',
  saltire: 'Saltire',
  chief: 'Chief',
  pall: 'Pall',
}

/** The emblems, 5 × 5 marks set on the cloth in its metal. */
export const CHARGES = {
  none: ['.....', '.....', '.....', '.....', '.....'],
  keep: ['p.p.p', 'ppppp', '.ppp.', '.p.p.', '.ppp.'],
  sword: ['..p..', '..p..', '..p..', 'ppppp', '..p..'],
  sun: ['p.p.p', '.ppp.', 'ppppp', '.ppp.', 'p.p.p'],
  star: ['..p..', '.ppp.', 'ppppp', '.ppp.', '.p.p.'],
  crown: ['.....', 'p.p.p', 'ppppp', 'ppppp', '.....'],
  moon: ['.ppp.', 'pp...', 'p....', 'pp...', '.ppp.'],
  axe: ['pp.p.', 'ppppp', 'pp.p.', '...p.', '...p.'],
  tree: ['..p..', '.ppp.', 'ppppp', '..p..', '..p..'],
  heart: ['pp.pp', 'ppppp', 'ppppp', '.ppp.', '..p..'],
  key: ['.ppp.', '.p.p.', '.ppp.', '..p..', '..pp.'],
  skull: ['.ppp.', 'ppppp', 'p.p.p', 'ppppp', '.p.p.'],
  coin: ['.ppp.', 'p.p.p', 'ppppp', 'p.p.p', '.ppp.'],
  anchor: ['..p..', '.ppp.', '..p..', 'p.p.p', '.ppp.'],
  bird: ['p...p', 'pp.pp', '.ppp.', '..p..', '.....'],
  wheat: ['p.p.p', '.ppp.', 'p.p.p', '.ppp.', '..p..'],
} as const
export type Charge = keyof typeof CHARGES
export const CHARGE_IDS = Object.keys(CHARGES) as Charge[]
export const CHARGE_NAMES: Record<Charge, string> = {
  none: 'None',
  keep: 'Keep',
  sword: 'Sword',
  sun: 'Sun',
  star: 'Star',
  crown: 'Crown',
  moon: 'Moon',
  axe: 'Axe',
  tree: 'Tree',
  heart: 'Heart',
  key: 'Key',
  skull: 'Skull',
  coin: 'Coin',
  anchor: 'Anchor',
  bird: 'Hawk',
  wheat: 'Wheat',
}

/** The metals: the emblem's colour and the cloth's edge. */
export const METALS = { parchment: '#ece0c8', gold: '#e0ac4c', silver: '#c3cad2' } as const
export type Metal = keyof typeof METALS
export const METAL_IDS = Object.keys(METALS) as Metal[]
export const METAL_NAMES: Record<Metal, string> = { parchment: 'Parchment', gold: 'Gold', silver: 'Silver' }

export interface BannerLook {
  shape: BannerShape
  tincture: Tincture
  charge: Charge
  /** Absent on a flag an older save made: plain. */
  pattern?: Pattern
  /** The pattern's colour. Absent: sable. */
  tincture2?: Tincture
  /** The emblem's and the edge's metal. Absent: parchment. */
  metal?: Metal
}

/** The flag a company flies before it has made one: navy swallowtail, a keep. */
export const DEFAULT_BANNER: BannerLook = { shape: 'swallow', tincture: 'navy', charge: 'keep', pattern: 'plain', tincture2: 'sable', metal: 'parchment' }

export const isBannerShape = (v: unknown): v is BannerShape => typeof v === 'string' && (BANNER_SHAPES as readonly string[]).includes(v)
export const isTincture = (v: unknown): v is Tincture => typeof v === 'string' && Object.prototype.hasOwnProperty.call(TINCTURES, v)
export const isCharge = (v: unknown): v is Charge => typeof v === 'string' && Object.prototype.hasOwnProperty.call(CHARGES, v)
export const isPattern = (v: unknown): v is Pattern => typeof v === 'string' && (PATTERNS as readonly string[]).includes(v)
export const isMetal = (v: unknown): v is Metal => typeof v === 'string' && Object.prototype.hasOwnProperty.call(METALS, v)

/** A flag with every optional part filled in. */
export function fullBanner(b: BannerLook): Required<BannerLook> {
  return { pattern: 'plain', tincture2: 'sable', metal: 'parchment', ...b } as Required<BannerLook>
}

/** The flag's size in pixels: a 2px pole and an 11px-wide cloth. */
export const BANNER_W = 13
export const BANNER_H = 20

/** Where the cloth is, by shape: x in 2…12, y from 1 down to the cloth's depth. */
function inCloth(shape: BannerShape, x: number, y: number, clothH: number): boolean {
  const W = BANNER_W
  const cx = 7.5
  switch (shape) {
    case 'swallow':
      return y <= clothH - 5 || Math.abs(x - cx) > (y - (clothH - 5)) * 1.1
    case 'pennant':
      return x - 2 < (W - 2) * (1 - Math.abs(y - (clothH / 2 + 0.5)) / (clothH / 2 + 0.5)) + 1
    case 'tri':
      return y < clothH - (x - 2) * 0.8 + 1
    case 'gonfalon': {
      // Three tails along the foot.
      if (y <= clothH - 4) return true
      const d = Math.min(...[3.5, 7.5, 11.5].map((t) => Math.abs(x - t)))
      return d < (clothH - y + 1) * 0.55 + 0.2
    }
    case 'shield':
      return y <= clothH - 6 || Math.abs(x - cx) < (clothH - y + 1) * 0.95
    case 'notch':
      return !(x >= W - 4 && Math.abs(y - (clothH / 2 + 0.5)) < (x - (W - 5)) * 0.9)
    case 'wave':
      // A ragged foot and fly, as a flag that has seen the road.
      return y <= clothH - 2 - ((x * 7) % 3 === 0 ? 1 : 0) && !(x === W - 1 && y % 4 === 1)
    default:
      return true
  }
}

/** Whether `(x, y)` takes the pattern's colour. The cloth is x 2…12, y 1…clothH. */
function inPattern(pattern: Pattern, x: number, y: number, clothH: number): boolean {
  const u = (x - 2) / (BANNER_W - 3) // 0…1 across the cloth
  const v = (y - 1) / (clothH - 1) // 0…1 down it
  switch (pattern) {
    case 'pale':
      return u > 0.5
    case 'fess':
      return v > 0.5
    case 'quarterly':
      return u > 0.5 !== v > 0.5
    case 'bend':
      return u > v
    case 'chevron':
      return v > 0.3 + Math.abs(u - 0.5) * 0.9 && v < 0.58 + Math.abs(u - 0.5) * 0.9
    case 'barry':
      return Math.floor((y - 1) / 3) % 2 === 1
    case 'paly':
      return Math.floor((x - 2) / 2) % 2 === 1
    case 'cross':
      return Math.abs(x - 7) <= 1 || Math.abs(y - Math.round(clothH / 2)) <= 1
    case 'saltire':
      return Math.abs(u - v) < 0.12 || Math.abs(u - (1 - v)) < 0.12
    case 'chief':
      return y <= 4
    case 'pall':
      return (v < 0.5 && (Math.abs(u - v) < 0.12 || Math.abs(1 - u - v) < 0.12)) || (v >= 0.5 && Math.abs(u - 0.5) < 0.12)
    default:
      return false
  }
}

/**
 * The flag's pixel rows: `o` the pole's outline, `w` its wood, `g` the gold
 * finial, `c` the field, `d` the pattern, `r` the metal edge, `p` the emblem.
 */
export function bannerRows(look: BannerLook): PixelRows {
  const { shape, charge, pattern } = fullBanner(look)
  const W = BANNER_W
  const H = BANNER_H
  const rows: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('.'))
  for (let y = 0; y < H; y++) {
    rows[y][0] = 'o'
    rows[y][1] = 'w'
  }
  rows[0][0] = 'g'
  rows[0][1] = 'g'
  const clothH = shape === 'square' ? 12 : shape === 'tall' ? 17 : 15
  for (let y = 1; y <= clothH; y++) for (let x = 2; x < W; x++) if (inCloth(shape, x, y, clothH)) rows[y][x] = 'c'
  // The metal edge: every cloth pixel on the cloth's edge (the pole side excepted).
  const out = rows.map((r) => r.slice())
  const cloth = (y: number, x: number) => rows[y]?.[x] === 'c'
  for (let y = 0; y < H; y++) {
    for (let x = 2; x < W; x++) {
      if (!cloth(y, x)) continue
      if (!cloth(y - 1, x) || !cloth(y + 1, x) || !cloth(y, x + 1) || (x > 2 && !cloth(y, x - 1))) out[y][x] = 'r'
      else if (inPattern(pattern, x, y, clothH)) out[y][x] = 'd'
    }
  }
  const ox = shape === 'pennant' ? 3 : 5
  const oy = shape === 'tall' ? 5 : 4
  CHARGES[charge].forEach((r, j) =>
    r.split('').forEach((ch, i) => {
      const at = out[oy + j]?.[ox + i]
      if (ch === 'p' && (at === 'c' || at === 'd')) out[oy + j][ox + i] = 'p'
    }),
  )
  return out.map((r) => r.join(''))
}

/**
 * A pattern on its own, as an 11 × 12 tile (`c` the field, `d` the pattern's
 * colour): what the builder's Pattern row shows, so the row shows that one
 * part and not the whole flag again.
 */
export function patternRows(pattern: Pattern): PixelRows {
  const clothH = 12
  return Array.from({ length: clothH }, (_, j) =>
    Array.from({ length: BANNER_W - 2 }, (_, i) => (inPattern(pattern, i + 2, j + 1, clothH) ? 'd' : 'c')).join(''),
  )
}

/** The flag's palette: its tinctures, its metal on the emblem and the edge, a wooden pole. */
export function bannerPalette(look: BannerLook): Palette {
  const b = fullBanner(look)
  return {
    o: OUTLINE,
    w: '#6b4526',
    g: '#e0ac4c',
    c: TINCTURES[b.tincture],
    d: TINCTURES[b.tincture2],
    r: METALS[b.metal],
    p: METALS[b.metal],
  }
}

/** A cache key for a flag (the canvases bake per look). */
export const bannerKey = (look: BannerLook): string => {
  const b = fullBanner(look)
  return `${b.shape}|${b.tincture}|${b.pattern}|${b.tincture2}|${b.charge}|${b.metal}`
}
