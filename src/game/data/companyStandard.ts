import { COMPANY_LOGOS, companyById, type CompanyId } from './companies'
import { OUTLINE, shade, type Palette, type PixelRows } from './pixelArt'

/**
 * ---------------------------------------------------------------------------
 * A trading company's standard, in pixels (Oct 2026)
 * ---------------------------------------------------------------------------
 *
 * The designer: "make sure the flag on the cart is representative of who the
 * company is for that run". On a company's contract the caravan flies THAT
 * company's standard: its cloth in the company's colour, edged a shade darker,
 * its logo on it, the foot cut in three points — the road notice's
 * `CompanyFlag` drawn for the canvas. (Your own militia's flag flies only on
 * your own road, the Sovereign Route.)
 *
 * 19 × 30 cells, drawn at 2 px a cell: the same 38 × 60 box as a militia
 * banner at 3 px (`caravan.ts` `CARAVAN_BOX` does not move). The cell keys are
 * digits so they never collide with a logo's letter keys.
 */
export const STANDARD_W = 19
export const STANDARD_H = 30
/** The cloth's last row, before its three-pointed foot. */
const CLOTH_BOTTOM = 20
/** The three points of the foot, as cloth columns (0…16). */
const POINTS = [2.5, 8, 13.5]

export function companyStandardRows(company: CompanyId): PixelRows {
  const g: string[][] = Array.from({ length: STANDARD_H }, () => Array<string>(STANDARD_W).fill('.'))
  // The pole: outline, wood, a gold finial.
  for (let y = 0; y < STANDARD_H; y++) {
    g[y][0] = '1'
    g[y][1] = '2'
  }
  g[0][0] = '3'
  g[0][1] = '3'
  // The cloth, and its foot cut in three points.
  const inCloth = (x: number, y: number) => {
    if (x < 2 || x >= STANDARD_W || y < 1) return false
    if (y <= CLOTH_BOTTOM) return true
    const i = x - 2
    const d = Math.min(...POINTS.map((p) => Math.abs(i - p)))
    return d <= (CLOTH_BOTTOM + 3 - y) * 1.1
  }
  for (let y = 1; y < STANDARD_H; y++) for (let x = 2; x < STANDARD_W; x++) if (inCloth(x, y)) g[y][x] = '4'
  // The edge, a shade darker — every cloth cell beside the outside (the pole side excepted).
  for (let y = 1; y < STANDARD_H; y++)
    for (let x = 2; x < STANDARD_W; x++) {
      if (g[y][x] !== '4') continue
      if (!inCloth(x, y - 1) || !inCloth(x, y + 1) || !inCloth(x + 1, y)) g[y][x] = '5'
    }
  // The logo, 16 × 16, on the cloth.
  COMPANY_LOGOS[company].rows.forEach((row, j) =>
    row.split('').forEach((ch, i) => {
      if (ch !== '.') g[3 + j][3 + i] = ch
    }),
  )
  return g.map((r) => r.join(''))
}

export function companyStandardPalette(company: CompanyId): Palette {
  const color = companyById(company).color
  return { ...COMPANY_LOGOS[company].palette, 1: OUTLINE, 2: '#6b4526', 3: '#e0ac4c', 4: color, 5: shade(color, -0.35) }
}
