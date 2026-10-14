import { CHARGE_NAMES, METAL_NAMES, PATTERN_NAMES, SHAPE_NAMES, TINCTURE_NAMES, type BannerShape, type Charge, type Metal, type Pattern, type Tincture } from './banner'
import { COMPANY_IDS, type CompanyId } from './companies'

/**
 * ---------------------------------------------------------------------------
 * Each company's flag kit (Draft 4 § C, Oct 2026)
 * ---------------------------------------------------------------------------
 *
 * The designer: "maybe you can customize the flag for each team — as you
 * play you get more unlocks from their flag, and when you make your own you
 * can pick things from any one and combine", and "then we bring the
 * customization back into play sooner, making it more fun".
 *
 * Every company has a kit of ten pieces in its own taste, and **one piece
 * unlocks at every standing level 1–10** with it ({@link kitPiecesAt}). A
 * piece dresses that company's standard on its road (`companyStandard.ts`,
 * the livery panel) and, once earned, goes into your own militia's builder
 * marked with the company it came from (`run/livery.earnedBannerParts`).
 *
 * A kit: two COLOURS in the company's hue family, two foot CUTS, two
 * PATTERNS, three EMBLEMS and one TRIM metal. Every kit deals them in the
 * same rhythm — a pattern first, so a standing-1 standard is already
 * visibly yours, then a colour, a cut, an emblem, the trim, and round again;
 * level 10 pays the third emblem.
 *
 * A colour piece names its tincture (the pattern's colour on the standard)
 * and the PAIR it adds to the militia builder's colour carousel (a field and
 * a pattern colour; the builder offers colours as pairs).
 *
 * Pure data: no zustand, no React. A piece's id is unique across all five
 * kits, so a militia option names the one company it came from.
 */
export type KitPiece =
  | { kind: 'colour'; id: Tincture; pair: readonly [Tincture, Tincture] }
  | { kind: 'cut'; id: BannerShape }
  | { kind: 'pattern'; id: Pattern }
  | { kind: 'emblem'; id: Charge }
  | { kind: 'trim'; id: Metal }
export type KitKind = KitPiece['kind']

/** The parts in the order the livery panel and the receipt name them. */
export const KIT_KINDS: readonly KitKind[] = ['cut', 'pattern', 'colour', 'emblem', 'trim']

/** How many pieces a kit holds: one per standing level. */
export const KIT_SIZE = 10

const colour = (id: Tincture, pair: readonly [Tincture, Tincture]): KitPiece => ({ kind: 'colour', id, pair })
const cut = (id: BannerShape): KitPiece => ({ kind: 'cut', id })
const pattern = (id: Pattern): KitPiece => ({ kind: 'pattern', id })
const emblem = (id: Charge): KitPiece => ({ kind: 'emblem', id })
const trim = (id: Metal): KitPiece => ({ kind: 'trim', id })

/** Each company's kit, in unlock order: piece `i` unlocks at standing `i + 1`. */
export const COMPANY_KITS: Readonly<Record<CompanyId, readonly KitPiece[]>> = {
  // Peppercorn Co.: the burning country — saffron and chili, a flame-cut foot.
  spice: [
    pattern('bend'),
    colour('saffron', ['sable', 'saffron']),
    cut('flame'),
    emblem('chili'),
    trim('copper'),
    pattern('chevron'),
    colour('chili', ['chili', 'saffron']),
    cut('swallow'),
    emblem('flame'),
    emblem('sack'),
  ],
  // Easel House: the painter's studio — lilac and raw canvas, chequers, frames.
  art: [
    pattern('checky'),
    colour('lilac', ['lilac', 'sable']),
    cut('scallop'),
    emblem('brush'),
    trim('verdigris'),
    pattern('paly'),
    colour('canvas', ['lilac', 'canvas']),
    cut('square'),
    emblem('frame'),
    emblem('palette'),
  ],
  // Ironvein: the mine and the forge — cobalt and iron, a battled foot.
  metals: [
    pattern('barry'),
    colour('cobalt', ['cobalt', 'slate']),
    cut('battled'),
    emblem('pick'),
    trim('bronze'),
    pattern('chief'),
    colour('iron', ['iron', 'cobalt']),
    cut('shield'),
    emblem('anvil'),
    emblem('gem'),
  ],
  // Rosethread: the loom — rose and ivory, a border, a fringed hem.
  silk: [
    pattern('bordure'),
    colour('rose', ['rose', 'wine']),
    cut('fringe'),
    emblem('spool'),
    trim('rosegold'),
    pattern('pale'),
    colour('ivory', ['rose', 'ivory']),
    cut('tri'),
    emblem('rose'),
    emblem('moth'),
  ],
  // Moonquill: the scriptorium by night — ink and moonsilver, a crescent foot.
  scrolls: [
    pattern('saltire'),
    colour('ink', ['ink', 'slate']),
    cut('crescent'),
    emblem('quill'),
    trim('electrum'),
    pattern('pall'),
    colour('moonsilver', ['ink', 'moonsilver']),
    cut('wave'),
    emblem('candle'),
    emblem('eye'),
  ],
}

/** The pieces owned at `standing` with `company`, in unlock order (none below 1). */
export function kitPiecesAt(company: CompanyId, standing: number): readonly KitPiece[] {
  const n = Math.max(0, Math.min(KIT_SIZE, Math.floor(Number.isFinite(standing) ? standing : 0)))
  return COMPANY_KITS[company].slice(0, n)
}

/** The piece standing `level` with `company` unlocks (null past the kit, or below 1). */
export function kitPieceAt(company: CompanyId, level: number): KitPiece | null {
  return level >= 1 && level <= KIT_SIZE ? (COMPANY_KITS[company][level - 1] ?? null) : null
}

/** The pieces earned going from standing `before` to `after` with `company`, with the level of each. */
export function kitPiecesBetween(company: CompanyId, before: number, after: number): { level: number; piece: KitPiece }[] {
  const out: { level: number; piece: KitPiece }[] = []
  for (let s = Math.max(1, Math.floor(before) + 1); s <= Math.min(KIT_SIZE, Math.floor(after)); s++) out.push({ level: s, piece: COMPANY_KITS[company][s - 1] })
  return out
}

/** The standing that unlocks a piece of `company`'s kit (null: not in its kit). */
export function kitLevelOf(company: CompanyId, kind: KitKind, id: string): number | null {
  const i = COMPANY_KITS[company].findIndex((p) => p.kind === kind && p.id === id)
  return i < 0 ? null : i + 1
}

/** Which company's kit a piece is from (null: a base piece everyone has, or none). */
export function kitCompanyOf(kind: KitKind, id: string): CompanyId | null {
  return COMPANY_IDS.find((c) => kitLevelOf(c, kind, id) != null) ?? null
}

/** A piece's own name: "Saffron", "Flame", "Diagonal", "Chili", "Copper". */
export function kitPieceName(p: Pick<KitPiece, 'kind' | 'id'>): string {
  switch (p.kind) {
    case 'colour':
      return TINCTURE_NAMES[p.id as Tincture]
    case 'cut':
      return SHAPE_NAMES[p.id as BannerShape]
    case 'pattern':
      return PATTERN_NAMES[p.id as Pattern]
    case 'emblem':
      return CHARGE_NAMES[p.id as Charge]
    case 'trim':
      return METAL_NAMES[p.id as Metal]
  }
}

/** What each part is called, as the livery panel labels it and the receipt names a piece. */
export const KIT_KIND_NAMES: Record<KitKind, string> = { cut: 'Cut', pattern: 'Pattern', colour: 'Colour', emblem: 'Emblem', trim: 'Trim' }

/** A piece as the receipt names it: "Cobalt", "Flame cut", "Diagonal pattern", "Chili emblem", "Copper trim". */
export function kitPieceLabel(p: Pick<KitPiece, 'kind' | 'id'>): string {
  const name = kitPieceName(p)
  return p.kind === 'colour' ? name : `${name} ${KIT_KIND_NAMES[p.kind].toLowerCase()}`
}
