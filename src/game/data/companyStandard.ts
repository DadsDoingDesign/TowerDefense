import { CHARGES, isCharge, isMetal, isPattern, isTincture, METALS, nearEdge, TINCTURES, type BannerShape, type Charge, type Metal, type Pattern, type Tincture } from './banner'
import { COMPANY_LOGOS, companyById, type CompanyId, type CompanyLogo } from './companies'
import { OUTLINE, shade, type Palette, type PixelRows } from './pixelArt'

/**
 * ---------------------------------------------------------------------------
 * A trading company's standard, in pixels (Oct 2026)
 * ---------------------------------------------------------------------------
 *
 * The designer: "make sure the flag on the cart is representative of who the
 * company is for that run". On a company's contract the caravan flies THAT
 * company's standard: its cloth in the company's colour, edged a shade darker,
 * its logo on it, the foot cut in three points. The road notice's
 * `CompanyFlag` draws the same rows. (Your own militia's flag flies only on
 * your own road, the Sovereign Route.)
 *
 * **Dressed** (Draft 4 § C; the designer: "customize the flag for each team
 * — as you play you get more unlocks from their flag"). A {@link StandardLook}
 * picks the CUT of the foot, a PATTERN with its second colour, an EMBLEM set
 * under the logo (the cloth grows to hold it), and the TRIM metal that edges
 * the cloth and colours the emblem. The pieces come from the company's kit
 * (`data/companyKits.ts`), one per standing level. The logo always stays on
 * the cloth and the cloth stays the company's colour, so the flag still says
 * whose road it is. {@link DEFAULT_STANDARD} draws exactly the standard
 * before it could be dressed, plus the logo's patch (the marks critique, Oct
 * 2026: a deliberate change; `tests/companyKits.test.ts` holds it to those
 * pixels).
 *
 * 19 × 30 cells, drawn at 2 px a cell: the same 38 × 60 box as a militia
 * banner at 3 px (`caravan.ts` `CARAVAN_BOX` does not move). The cell keys are
 * digits so they never collide with a logo's letter keys: `1` outline, `2`
 * wood, `3` the gold finial, `4` the cloth, `5` the edge (and the emblem), `6`
 * the pattern, `7` the emblem (in the trim, or the logo's ink), `8` the
 * logo's patch (the cloth a deeper dye, one cell round the logo).
 */
export const STANDARD_W = 19
export const STANDARD_H = 30
/** The cloth's last row before its foot, bare and with an emblem under the logo. */
const CLOTH_BOTTOM = 20
const CLOTH_BOTTOM_EMBLEM = 25
/** The three points of the default foot, as cloth columns (0…16). */
const POINTS = [2.5, 8, 13.5]
/** Where an emblem sits: under the logo, in the middle of the cloth (its top-left cell). */
const EMBLEM_AT: readonly [number, number] = [8, 20]

/** How a company's standard is dressed. Every part's default is the plain standard. */
export interface StandardLook {
  /** The foot's cut, named as the banner shape it matches (`gonfalon`: three points). */
  cut: BannerShape
  pattern: Pattern
  /** The pattern's colour; null: a deeper tone of the company's own colour. */
  tincture2: Tincture | null
  /** A 5 × 5 emblem under the logo, in the trim (the logo's ink on a plain hem); `none` leaves the cloth its length. */
  charge: Charge
  /** The edge and the emblem's metal; null: the company colour a shade darker. */
  trim: Metal | null
}

/** The standard as it flew before it could be dressed: three points, plain, edged a shade darker. */
export const DEFAULT_STANDARD: StandardLook = { cut: 'gonfalon', pattern: 'plain', tincture2: null, charge: 'none', trim: null }

/** A look with every part filled in from the default (a partial or older value). */
export function fullStandard(look?: Partial<StandardLook> | null): StandardLook {
  const l = look ?? {}
  return {
    cut: l.cut ?? DEFAULT_STANDARD.cut,
    pattern: isPattern(l.pattern) ? l.pattern : 'plain',
    tincture2: isTincture(l.tincture2) ? l.tincture2 : null,
    charge: isCharge(l.charge) ? l.charge : 'none',
    trim: isMetal(l.trim) ? l.trim : null,
  }
}

/** A cache key for a look (the caravan bakes per look). */
export const standardKey = (look?: Partial<StandardLook> | null): string => {
  const l = fullStandard(look)
  return `${l.cut}|${l.pattern}|${l.tincture2 ?? '-'}|${l.charge}|${l.trim ?? '-'}`
}

export const isDefaultStandard = (look?: Partial<StandardLook> | null): boolean => standardKey(look) === standardKey(DEFAULT_STANDARD)

/** The patch's reach round the logo: its eight neighbours (`standardRowsFor`). */
const PATCH_RING: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
]

/** The ragged foot's depth per cloth column (the tattered cut). */
const TATTERS = [2, 1, 3, 1, 2, 0, 2, 3, 1, 2, 0, 1, 3, 2, 1, 2, 3]

/**
 * Whether the foot's cell at cloth column `i` (0…16), `t` rows below the
 * cloth's last row, is cloth — by cut. A cut a kit never gives falls back to
 * the three points.
 */
function inFoot(cut: BannerShape, i: number, t: number): boolean {
  const c = 8 // the middle column
  switch (cut) {
    case 'swallow':
      // Two tails: a V cut up the middle.
      return t <= 3 && Math.abs(i - c) > t * 2.2
    case 'flame':
      // Five tongues of flame, long and short.
      return (
        t <= 3 &&
        [
          [0.5, 2],
          [4, 3],
          [8, 2],
          [12, 3],
          [15.5, 2],
        ].some(([p, len]) => t <= len && Math.abs(i - p) <= (len - t + 1) * 0.7)
      )
    case 'square':
      return false
    case 'scallop':
      // Four round lobes.
      return t <= 2 && [2, 6.25, 10.5, 14.75].some((p) => Math.abs(i - p) <= (t === 1 ? 1.8 : 1.0))
    case 'shield':
      // One long point.
      return t <= 4 && Math.abs(i - c) <= (4.2 - t) * 2.4
    case 'battled':
      // Crenels: a wall's top, turned over.
      return t <= 2 && Math.floor(Math.abs(i - c) / 2) % 2 === 0
    case 'fringe':
      // A hem, then every other thread loose.
      return t === 1 || (t <= 3 && i % 2 === 0)
    case 'tri':
      // A slant: long at the pole, short at the fly.
      return t <= (16 - i) * 0.25
    case 'crescent':
      // A hollow curve, its horns at the sides.
      return t <= 3 * ((i - c) / 8) ** 2 + 0.3
    case 'wave':
      // A foot that has seen the road.
      return t <= TATTERS[i]
    default: {
      // Three points (the gonfalon), as it always was.
      const d = Math.min(...POINTS.map((p) => Math.abs(i - p)))
      return d <= (3 - t) * 1.1
    }
  }
}

/** Whether a standard's cell is the pattern's colour: `i` 0…16 across the cloth, `j` from its top row. */
function inStandardPattern(pattern: Pattern, i: number, j: number, rows: number): boolean {
  const u = i / 16
  const v = j / (rows - 1)
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
      return Math.floor(j / 3) % 2 === 1
    case 'paly':
      return Math.floor(i / 2) % 2 === 1
    case 'cross':
      return Math.abs(i - 8) <= 1 || Math.abs(j + 1 - Math.round(rows / 2)) <= 1
    case 'saltire':
      return Math.abs(u - v) < 0.1 || Math.abs(u - (1 - v)) < 0.1
    case 'chief':
      return j <= 3
    case 'pall':
      return (v < 0.5 && (Math.abs(u - v) < 0.1 || Math.abs(1 - u - v) < 0.1)) || (v >= 0.5 && Math.abs(u - 0.5) < 0.1)
    case 'checky':
      return (Math.floor(i / 3) + Math.floor(j / 3)) % 2 === 1
    default:
      return false
  }
}

/** The rows for any logo (a company's, or the padlock for a road not hiring yet). */
export function standardRowsFor(logo: CompanyLogo, look?: Partial<StandardLook> | null): PixelRows {
  const l = fullStandard(look)
  const bottom = l.charge === 'none' ? CLOTH_BOTTOM : CLOTH_BOTTOM_EMBLEM
  const g: string[][] = Array.from({ length: STANDARD_H }, () => Array<string>(STANDARD_W).fill('.'))
  // The pole: outline, wood, a gold finial.
  for (let y = 0; y < STANDARD_H; y++) {
    g[y][0] = '1'
    g[y][1] = '2'
  }
  g[0][0] = '3'
  g[0][1] = '3'
  // The cloth, and its foot cut.
  const inCloth = (x: number, y: number) => {
    if (x < 2 || x >= STANDARD_W || y < 1 || y >= STANDARD_H) return false
    if (y <= bottom) return true
    return inFoot(l.cut, x - 2, y - bottom)
  }
  for (let y = 1; y < STANDARD_H; y++) for (let x = 2; x < STANDARD_W; x++) if (inCloth(x, y)) g[y][x] = '4'
  // The edge — every cloth cell beside the outside (the pole side excepted) —
  // and the pattern inside it.
  const clothRows = bottom
  for (let y = 1; y < STANDARD_H; y++)
    for (let x = 2; x < STANDARD_W; x++) {
      if (g[y][x] !== '4') continue
      if (!inCloth(x, y - 1) || !inCloth(x, y + 1) || !inCloth(x + 1, y)) g[y][x] = '5'
      else if (l.pattern === 'bordure' ? nearEdge(inCloth, x, y, 2, 2) : inStandardPattern(l.pattern, x - 2, y - 1, clothRows)) g[y][x] = '6'
    }
  // The logo's patch (the marks critique, Oct 2026): every logo is drawn in
  // its company's colour, so on a cloth OF that colour it was only an
  // outline. A patch of deeper cloth, one cell round the logo's silhouette,
  // sews it on: the logo reads as a thing on the flag, the flag stays the
  // company's colour. The cloth's edge is kept.
  const logoAt = (x: number, y: number) => (logo.rows[y - 3]?.[x - 3] ?? '.') !== '.'
  for (let y = 1; y < STANDARD_H; y++)
    for (let x = 2; x < STANDARD_W; x++) {
      if (g[y][x] !== '4' && g[y][x] !== '6') continue
      if (PATCH_RING.some(([dx, dy]) => logoAt(x + dx, y + dy))) g[y][x] = '8'
    }
  // The logo, 16 × 16, on the cloth.
  logo.rows.forEach((row, j) =>
    row.split('').forEach((ch, i) => {
      if (ch !== '.') g[3 + j][3 + i] = ch
    }),
  )
  // The emblem under it, in the trim.
  if (l.charge !== 'none') {
    const [ox, oy] = EMBLEM_AT
    CHARGES[l.charge].forEach((r, j) =>
      r.split('').forEach((ch, i) => {
        if (ch === 'p') g[oy + j][ox + i] = '7'
      }),
    )
  }
  return g.map((r) => r.join(''))
}

/** The emblem's colour: the trim's metal, or the logo's own ink on a plain hem. */
export const emblemColor = (look?: Partial<StandardLook> | null): string => {
  const l = fullStandard(look)
  return l.trim ? METALS[l.trim] : OUTLINE
}

/** How much deeper than the cloth the logo's patch is dyed. */
export const PATCH_SHADE = -0.55

/** A standard's palette for any logo and cloth colour. */
export function standardPaletteFor(logo: CompanyLogo, color: string, look?: Partial<StandardLook> | null): Palette {
  const l = fullStandard(look)
  return {
    ...logo.palette,
    1: OUTLINE,
    2: '#6b4526',
    3: '#e0ac4c',
    4: color,
    5: l.trim ? METALS[l.trim] : shade(color, -0.35),
    6: l.tincture2 ? TINCTURES[l.tincture2] : shade(color, -0.18),
    7: emblemColor(l),
    8: shade(color, PATCH_SHADE),
  }
}

export function companyStandardRows(company: CompanyId, look?: Partial<StandardLook> | null): PixelRows {
  return standardRowsFor(COMPANY_LOGOS[company], look)
}

export function companyStandardPalette(company: CompanyId, look?: Partial<StandardLook> | null): Palette {
  return standardPaletteFor(COMPANY_LOGOS[company], companyById(company).color, look)
}
