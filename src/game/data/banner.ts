import { OUTLINE, type Palette, type PixelRows } from './pixelArt'

/**
 * ---------------------------------------------------------------------------
 * Your militia's banner (the mercenary company, build step 4)
 * ---------------------------------------------------------------------------
 *
 * The designer: "Name your militia and pick a banner that flies on your Gate."
 * A banner is a SHAPE of cloth, a dark FIELD colour (a tincture) and a
 * parchment CHARGE on it, on a wooden pole with a gold finial — the approved
 * picker mockup (`trade/r3/10-banner.png`), its pixel strings ported from the
 * prototype (`trade/r3/lib.js` `banner()`).
 *
 * The tinctures are dark ON PURPOSE (`trade/NOTES.md` § Palette): each sits at
 * ΔE2000 ≥ 26 from every reserved hue (rarity, cursed coral, clearance red,
 * gold, the CTA teal) and from every company colour, so a banner never reads
 * as a company or a rarity. The rim and the charge are parchment, which is
 * what carries it on the dark map and on the green field alike.
 *
 * Pure data, like the crests: the UI draws it as SVG (`ui/pixel.tsx`) and the
 * canvases (the battle's wagon, the menu's trade map) draw the same rows.
 */
export const BANNER_SHAPES = ['swallow', 'pennant', 'square', 'tri'] as const
export type BannerShape = (typeof BANNER_SHAPES)[number]

export const TINCTURES = {
  sable: '#26242c',
  forest: '#2f5638',
  navy: '#28386a',
  umber: '#5c3b22',
  plum: '#4e2c4c',
  ash: '#6c675f',
} as const
export type Tincture = keyof typeof TINCTURES
export const TINCTURE_IDS = Object.keys(TINCTURES) as Tincture[]

/** What the picker calls each choice. */
export const SHAPE_NAMES: Record<BannerShape, string> = { swallow: 'Swallowtail', pennant: 'Pennant', square: 'Square', tri: 'Cut' }
export const TINCTURE_NAMES: Record<Tincture, string> = { sable: 'Sable', forest: 'Forest', navy: 'Navy', umber: 'Umber', plum: 'Plum', ash: 'Ash' }

/** The charges, 5 × 5 parchment marks set on the cloth. */
export const CHARGES = {
  keep: ['p.p.p', 'ppppp', '.ppp.', '.p.p.', '.ppp.'],
  sword: ['..p..', '..p..', '..p..', 'ppppp', '..p..'],
  sun: ['p.p.p', '.ppp.', 'ppppp', '.ppp.', 'p.p.p'],
} as const
export type Charge = keyof typeof CHARGES
export const CHARGE_IDS = Object.keys(CHARGES) as Charge[]
export const CHARGE_NAMES: Record<Charge, string> = { keep: 'Keep', sword: 'Sword', sun: 'Sun' }

export interface BannerLook {
  shape: BannerShape
  tincture: Tincture
  charge: Charge
}

/** The banner a militia flies before it has picked one: navy swallowtail, a keep. */
export const DEFAULT_BANNER: BannerLook = { shape: 'swallow', tincture: 'navy', charge: 'keep' }

export const isBannerShape = (v: unknown): v is BannerShape => typeof v === 'string' && (BANNER_SHAPES as readonly string[]).includes(v)
export const isTincture = (v: unknown): v is Tincture => typeof v === 'string' && Object.prototype.hasOwnProperty.call(TINCTURES, v)
export const isCharge = (v: unknown): v is Charge => typeof v === 'string' && Object.prototype.hasOwnProperty.call(CHARGES, v)

/** The banner's size in pixels: a 2px pole and an 11px-wide cloth. */
export const BANNER_W = 13
export const BANNER_H = 20

/**
 * The banner's pixel rows: `o` the pole's outline, `w` its wood, `g` the gold
 * finial, `c` the cloth, `r` its parchment rim, `p` the charge.
 */
export function bannerRows(shape: BannerShape, charge: Charge): PixelRows {
  const W = BANNER_W
  const H = BANNER_H
  const rows: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('.'))
  for (let y = 0; y < H; y++) {
    rows[y][0] = 'o'
    rows[y][1] = 'w'
  }
  rows[0][0] = 'g'
  rows[0][1] = 'g'
  const clothH = shape === 'square' ? 12 : 15
  for (let y = 1; y <= clothH; y++) {
    for (let x = 2; x < W; x++) {
      let inside = true
      if (shape === 'swallow' && y > clothH - 5) inside = Math.abs(x - 7.5) > (y - (clothH - 5)) * 1.1
      if (shape === 'pennant') inside = x - 2 < (W - 2) * (1 - Math.abs(y - (clothH / 2 + 0.5)) / (clothH / 2 + 0.5)) + 1
      if (shape === 'tri') inside = y < clothH - (x - 2) * 0.8 + 1
      if (inside) rows[y][x] = 'c'
    }
  }
  // The parchment rim: every cloth pixel on the cloth's edge (the pole side excepted).
  const out = rows.map((r) => r.slice())
  const cloth = (y: number, x: number) => rows[y]?.[x] === 'c'
  for (let y = 0; y < H; y++) {
    for (let x = 2; x < W; x++) {
      if (!cloth(y, x)) continue
      if (!cloth(y - 1, x) || !cloth(y + 1, x) || !cloth(y, x + 1) || (x > 2 && !cloth(y, x - 1))) out[y][x] = 'r'
    }
  }
  const ox = shape === 'pennant' ? 3 : 5
  const oy = 4
  CHARGES[charge].forEach((r, j) =>
    r.split('').forEach((ch, i) => {
      if (ch === 'p' && out[oy + j]?.[ox + i] === 'c') out[oy + j][ox + i] = 'p'
    }),
  )
  return out.map((r) => r.join(''))
}

/** The banner's palette: its tincture, a parchment rim and charge, a wooden pole. */
export const bannerPalette = (tincture: Tincture): Palette => ({
  o: OUTLINE,
  w: '#6b4526',
  g: '#e0ac4c',
  c: TINCTURES[tincture],
  r: '#ece0c8',
  p: '#ece0c8',
})
