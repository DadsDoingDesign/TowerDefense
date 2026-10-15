import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { CHARGES, METALS, patternRows, TINCTURES, type BannerShape, type Charge, type Metal, type Pattern, type Tincture } from '../../../game/data/banner'
import { companyById, type CompanyId } from '../../../game/data/companies'
import { COMPANY_KITS, KIT_KIND_NAMES, kitLevelOf, kitPieceAt, kitPieceName, type KitKind } from '../../../game/data/companyKits'
import { companyStandardPalette, companyStandardRows, DEFAULT_STANDARD, emblemColor, standardPaletteFor, standardRowsFor, type StandardLook } from '../../../game/data/companyStandard'
import { CRATE, cratePalette, shade, WAGON, WAGON_PALETTE } from '../../../game/data/pixelArt'
import { liveryOf, lockedParts, ownsPiece } from '../../../game/run/livery'
import { standingOf } from '../../../game/run/standing'
import { useGameStore } from '../../../state/gameStore'
import { useMetaStore } from '../../../state/metaStore'
import { Icon } from '../../Icon'
import { Lock, Pixel } from '../../pixel'
import { ContractPage } from '../contracts/parts'
import { PartCarousel, type CarouselOption } from './FlagCarousel'
import '../../../styles/company.css'

/**
 * A company's livery (Draft 4 § C, Oct 2026; the designer: "customize the
 * flag for each team — as you play you get more unlocks from their flag",
 * "bring the customization back into play sooner"). Opened from the road's
 * notice at home: its flag is the way in.
 *
 * The page is the company's standard on its wagon, large, over one small
 * carousel per part — Cut, Pattern, Colour, Emblem, Trim. Each offers the
 * plain standard's part and that company's kit pieces of its kind; a piece
 * not unlocked yet is shown dimmed with its lock, says the standing that
 * unlocks it ("Standing 6"), and can be tried on, but the standard cannot be
 * kept with it. The one CTA keeps the look (`metaStore.setLivery`); the back
 * changes nothing. Before standing 1 the page opens on what standing 1
 * unlocks, tried on, with no CTA.
 *
 * Every part is a `PartCarousel`: each holds two to four options, so none is
 * a "many options" part that would take a `FlagWheel` (DESIGN_SYSTEM § 8).
 */
export function LiveryScreen({ company, onDone }: { company: CompanyId; onDone: () => void }) {
  const co = companyById(company)
  const xp = useMetaStore((s) => s.standing)
  const saved = useMetaStore((s) => liveryOf(s.liveries, company))
  const setLivery = useMetaStore((s) => s.setLivery)
  // The page wears its company's theme: its road is the one in focus.
  const focusRoad = useGameStore((s) => s.focusRoad)
  useEffect(() => focusRoad(company), [company, focusRoad])
  const standing = standingOf(xp, company)
  // Before standing 1, open on what standing 1 unlocks, tried on.
  const [look, setLook] = useState<StandardLook>(() => (standing >= 1 ? saved : withPiece(DEFAULT_STANDARD, company, 1)))
  const locked = lockedParts(company, standing, look)
  const set = (patch: Partial<StandardLook>) => setLook((cur) => ({ ...cur, ...patch }))

  const option = (kind: KitKind, id: string | null, name: string): CarouselOption => {
    const lvl = id == null ? null : kitLevelOf(company, kind, id)
    const mine = lvl == null || ownsPiece(company, standing, kind, id)
    return { id: id ?? '', name, ...(mine ? {} : { locked: true, note: `Standing ${lvl}` }) }
  }
  const pieces = (kind: KitKind) => COMPANY_KITS[company].filter((p) => p.kind === kind).map((p) => option(kind, p.id, kitPieceName(p)))
  // Each part: the plain standard's, then the kit's pieces of its kind.
  const options = {
    cut: [option('cut', DEFAULT_STANDARD.cut, 'Three points'), ...pieces('cut')],
    pattern: [option('pattern', 'plain', 'Plain'), ...pieces('pattern')],
    colour: [option('colour', null, 'Shade'), ...pieces('colour')],
    emblem: [option('emblem', 'none', 'None'), ...pieces('emblem')],
    trim: [option('trim', null, 'Shade'), ...pieces('trim')],
  }

  const color = co.color
  const tone = look.tincture2 ? TINCTURES[look.tincture2] : shade(color, -0.18)
  const edge = look.trim ? METALS[look.trim] : shade(color, -0.35)
  const lockMark = (o: CarouselOption, art: ReactNode) => (
    <span className="lv-opt">
      {art}
      {o.locked && (
        <span className="lv-lock">
          <Lock scale={2} />
        </span>
      )}
    </span>
  )

  const keep = () => {
    setLivery(company, look)
    onDone()
  }
  const name = `${co.name.replace(/ Co\.$/, '')}’s standard`

  return (
    <ContractPage
      className="mi lv"
      label={name}
      head={
        <div className="ct-hdr lv-head">
          <button className="ct-back" onClick={onDone} aria-label="Back, without changing anything">
            <Icon name="back" />
          </button>
          <h1 className="ct-title lv-title" tabIndex={-1}>
            {name}
          </h1>
          <span className="lv-standing">
            <span className="field-k">Standing</span>
            <span className="field-v">{standing}</span>
          </span>
        </div>
      }
      cta={
        standing >= 1
          ? {
              label: 'Fly this standard',
              run: keep,
              heavy: true,
              disabled: locked.length > 0,
              name: locked.length ? `Fly this standard: ${locked.map((k) => KIT_KIND_NAMES[k].toLowerCase()).join(', ')} not unlocked yet` : undefined,
            }
          : undefined
      }
    >
      <div className="mi-preview lv-preview" style={{ '--co': color } as CSSProperties}>
        <div className="mi-preview-road" aria-hidden="true" />
        <div className="lv-wagon" aria-hidden="true">
          <span className="lv-crates">
            {[0, 1, 2].map((i) => (
              <Pixel key={i} rows={CRATE} palette={cratePalette(color)} scale={3} />
            ))}
          </span>
          <Pixel rows={WAGON} palette={WAGON_PALETTE} scale={3} />
        </div>
        <div className="lv-flag co-wave" aria-hidden="true">
          <Pixel rows={companyStandardRows(company, look)} palette={companyStandardPalette(company, look)} scale={5} className="banner" />
        </div>
      </div>

      <div className="lv-parts">
        <PartCarousel
          label="Cut"
          options={options.cut}
          value={look.cut}
          onPick={(id) => set({ cut: id as BannerShape })}
          render={(o) => lockMark(o, <Pixel rows={bareCloth(o.id as BannerShape)} palette={standardPaletteFor(BARE, color, null)} scale={2} className="lv-cut" />)}
        />
        <PartCarousel
          label="Pattern"
          options={options.pattern}
          value={look.pattern}
          onPick={(id) => set({ pattern: id as Pattern })}
          render={(o) => lockMark(o, <Pixel rows={patternRows(o.id as Pattern)} palette={{ c: color, d: tone }} scale={2} className="co-pattern" />)}
        />
        <PartCarousel
          label="Colour"
          options={options.colour}
          value={look.tincture2 ?? ''}
          // A colour shows through a pattern: on a plain cloth, the first of the kit's patterns comes with it.
          onPick={(id) => set({ tincture2: (id || null) as Tincture | null, ...(id && look.pattern === 'plain' ? { pattern: firstPattern(company, standing) } : {}) })}
          render={(o) =>
            lockMark(
              o,
              <span
                className="co-pair"
                style={{
                  background: `linear-gradient(135deg, ${color} 50%, ${o.id ? TINCTURES[o.id as Tincture] : shade(color, -0.18)} 50%)`,
                  boxShadow: `0 0 0 2px ${edge}, 0 2px 0 3px rgba(0, 0, 0, 0.4)`,
                }}
              />,
            )
          }
        />
        <PartCarousel
          label="Emblem"
          options={options.emblem}
          value={look.charge}
          onPick={(id) => set({ charge: id as Charge })}
          render={(o) => lockMark(o, o.id === 'none' ? <span className="co-none" /> : <Pixel rows={onCloth(o.id as Charge)} palette={{ c: color, p: emblemColor(look) }} scale={4} className="co-pattern" />)}
        />
        <PartCarousel
          label="Trim"
          options={options.trim}
          value={look.trim ?? ''}
          onPick={(id) => set({ trim: (id || null) as Metal | null })}
          render={(o) => lockMark(o, <span className="co-coin" style={{ background: o.id ? METALS[o.id as Metal] : shade(color, -0.35) }} />)}
        />
      </div>
    </ContractPage>
  )
}

/** A cut on its own: the standard's bare cloth, no logo — the Cut row shows that one part. */
const BARE = { rows: [], palette: {} }
const bareCloth = (cut: BannerShape) => {
  const rows = standardRowsFor(BARE, { cut })
  // Off the pole, and just the foot and a little cloth above it.
  return rows.map((r) => r.slice(2)).slice(16, 26)
}

/** An emblem as the Emblem row shows it: on a patch of the company's cloth, as it sits on the standard. */
const onCloth = (charge: Charge): string[] => {
  const edge = 'c'.repeat(7)
  return [edge, ...CHARGES[charge].map((r) => `c${r.replace(/\./g, 'c')}c`), edge]
}

/** The kit's first pattern you own (or its first, to try on). */
const firstPattern = (company: CompanyId, standing: number): Pattern => {
  const kit = COMPANY_KITS[company].filter((p) => p.kind === 'pattern')
  return (kit.find((p) => ownsPiece(company, standing, 'pattern', p.id)) ?? kit[0]).id as Pattern
}

/** A look with the piece standing `level` unlocks put on. */
function withPiece(look: StandardLook, company: CompanyId, level: number): StandardLook {
  const p = kitPieceAt(company, level)
  if (!p) return look
  switch (p.kind) {
    case 'cut':
      return { ...look, cut: p.id }
    case 'pattern':
      return { ...look, pattern: p.id }
    case 'colour':
      return { ...look, tincture2: p.id }
    case 'emblem':
      return { ...look, charge: p.id }
    case 'trim':
      return { ...look, trim: p.id }
  }
}
