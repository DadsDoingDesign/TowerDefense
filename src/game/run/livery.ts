/**
 * ---------------------------------------------------------------------------
 * Liveries: the company standards you dress, and the pieces your militia
 * mixes from them (Draft 4 § C, Oct 2026)
 * ---------------------------------------------------------------------------
 *
 * A LIVERY is how you dress one company's standard (`StandardLook`): kept per
 * company in the meta save (`metaStore.liveries`), flown by the wagon on that
 * company's road and on its notice at home. Only a piece that company's kit
 * has unlocked at your standing with it may be worn ({@link readLivery}); any
 * other part falls back to the plain standard's.
 *
 * Your militia's builder offers its base set plus every piece earned from any
 * company ({@link earnedBannerParts}), each with the company it came from.
 *
 * Pure: no zustand, no React.
 */
import { BANNER_SHAPES, CHARGE_IDS, COLOUR_PAIRS, METAL_IDS, PATTERNS, type BannerShape, type Charge, type Metal, type Pattern, type Tincture } from '../data/banner'
import { COMPANY_IDS, isCompanyId, type CompanyId } from '../data/companies'
import { kitPiecesAt, type KitKind, type KitPiece } from '../data/companyKits'
import { DEFAULT_STANDARD, fullStandard, isDefaultStandard, type StandardLook } from '../data/companyStandard'

export type Liveries = Partial<Record<CompanyId, StandardLook>>

/** Whether `standing` with `company` has unlocked this piece. */
export function ownsPiece(company: CompanyId, standing: number, kind: KitKind, id: string | null): boolean {
  return kitPiecesAt(company, standing).some((p) => p.kind === kind && p.id === id)
}

/** Each part of a standard, as the kit piece it would be (null: the part's default). */
function partsOf(look: StandardLook): { kind: KitKind; id: string | null; isDefault: boolean }[] {
  return [
    { kind: 'cut', id: look.cut, isDefault: look.cut === DEFAULT_STANDARD.cut },
    { kind: 'pattern', id: look.pattern, isDefault: look.pattern === DEFAULT_STANDARD.pattern },
    { kind: 'colour', id: look.tincture2, isDefault: look.tincture2 === DEFAULT_STANDARD.tincture2 },
    { kind: 'emblem', id: look.charge, isDefault: look.charge === DEFAULT_STANDARD.charge },
    { kind: 'trim', id: look.trim, isDefault: look.trim === DEFAULT_STANDARD.trim },
  ]
}

/** The parts of a look that `standing` has not unlocked yet (empty: it can be flown). */
export function lockedParts(company: CompanyId, standing: number, look: StandardLook): KitKind[] {
  return partsOf(fullStandard(look))
    .filter((p) => !p.isDefault && !ownsPiece(company, standing, p.kind, p.id))
    .map((p) => p.kind)
}

/**
 * A stored livery, validated against what `company`'s kit has unlocked at
 * `standing`: each part is kept when it is the default or an owned piece, and
 * falls back to the default otherwise. Anything unreadable is the default.
 */
export function readLivery(company: CompanyId, raw: unknown, standing: number): StandardLook {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STANDARD }
  const o = raw as Record<string, unknown>
  const owns = (kind: KitKind, v: unknown) => typeof v === 'string' && ownsPiece(company, standing, kind, v)
  return {
    cut: owns('cut', o.cut) ? (o.cut as BannerShape) : DEFAULT_STANDARD.cut,
    pattern: owns('pattern', o.pattern) ? (o.pattern as Pattern) : DEFAULT_STANDARD.pattern,
    tincture2: owns('colour', o.tincture2) ? (o.tincture2 as Tincture) : DEFAULT_STANDARD.tincture2,
    charge: owns('emblem', o.charge) ? (o.charge as Charge) : DEFAULT_STANDARD.charge,
    trim: owns('trim', o.trim) ? (o.trim as Metal) : DEFAULT_STANDARD.trim,
  }
}

/**
 * Every stored livery, validated against the standing held with each company
 * (`standingOf` its XP). A livery that comes out plain is dropped, so the save
 * holds only the standards you have dressed.
 */
export function readLiveries(raw: unknown, standingFor: (company: CompanyId) => number): Liveries {
  const out: Liveries = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isCompanyId(k)) continue
    const look = readLivery(k, v, standingFor(k))
    if (!isDefaultStandard(look)) out[k] = look
  }
  return out
}

/** The look a company's standard flies: your livery for it, or the plain standard. */
export const liveryOf = (liveries: Liveries | null | undefined, company: CompanyId): StandardLook => liveries?.[company] ?? DEFAULT_STANDARD

/** One option of the militia builder, and the company whose kit it came from (none: everyone's). */
export interface EarnedOption<T> {
  id: T
  company: CompanyId | null
}

export interface BannerParts {
  shapes: EarnedOption<BannerShape>[]
  patterns: EarnedOption<Pattern>[]
  charges: EarnedOption<Charge>[]
  metals: EarnedOption<Metal>[]
  /** The colour pairs: field and pattern colour, as the builder offers them. */
  pairs: (EarnedOption<string> & { pair: readonly [Tincture, Tincture] })[]
}

/**
 * The militia builder's options: the base set everyone has, then every piece
 * earned from any company, company by company in unlock order. A kit cut that
 * is already a base shape (the swallowtail, the square…) is not offered twice.
 */
export function earnedBannerParts(standingFor: (company: CompanyId) => number): BannerParts {
  const parts: BannerParts = {
    shapes: BANNER_SHAPES.map((id) => ({ id, company: null })),
    patterns: PATTERNS.map((id) => ({ id, company: null })),
    charges: CHARGE_IDS.map((id) => ({ id, company: null })),
    metals: METAL_IDS.map((id) => ({ id, company: null })),
    pairs: COLOUR_PAIRS.map((pair, i) => ({ id: `base:${i}`, company: null, pair })),
  }
  for (const company of COMPANY_IDS) {
    for (const p of kitPiecesAt(company, standingFor(company))) addPiece(parts, company, p)
  }
  return parts
}

function addPiece(parts: BannerParts, company: CompanyId, p: KitPiece): void {
  const add = <T>(list: EarnedOption<T>[], id: T) => {
    if (!list.some((o) => o.id === id)) list.push({ id, company })
  }
  switch (p.kind) {
    case 'cut':
      return add(parts.shapes, p.id)
    case 'pattern':
      return add(parts.patterns, p.id)
    case 'emblem':
      return add(parts.charges, p.id)
    case 'trim':
      return add(parts.metals, p.id)
    case 'colour':
      if (!parts.pairs.some((o) => o.pair[0] === p.pair[0] && o.pair[1] === p.pair[1])) parts.pairs.push({ id: `${company}:${p.id}`, company, pair: p.pair })
  }
}
