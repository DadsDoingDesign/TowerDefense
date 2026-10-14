import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CHARGE_NAMES,
  CHARGES,
  DEFAULT_BANNER,
  fullBanner,
  METAL_NAMES,
  METALS,
  PATTERN_NAMES,
  patternRows,
  SHAPE_NAMES,
  soldierPalette,
  soldierRows,
  TINCTURE_NAMES,
  TINCTURES,
  type BannerShape,
  type Charge,
  type Metal,
  type Pattern,
} from '../../game/data/banner'
import { militiaName, randomBanner, rerollName, type Militia } from '../../game/run/militia'
import { companyById, type CompanyId } from '../../game/data/companies'
import { earnedBannerParts, type EarnedOption } from '../../game/run/livery'
import { standingOf } from '../../game/run/standing'
import { checkCompanyName, NAME_MAX } from '../../game/run/nameFilter'
import { useMetaStore } from '../../state/metaStore'
import { Icon } from '../Icon'
import { Banner, Crest, Pixel } from '../pixel'
import { ContractPage } from './contracts/parts'
import { FlagWheel, OptionGrid, PartCarousel, type CarouselOption } from './company/FlagCarousel'
import '../../styles/company.css'

/** A pattern shown on its own: a mid and a light stone, so the division reads whatever your colours. */
const PATTERN_SWATCH = { c: '#4b4238', d: '#c9bfae' }

/** An option of the builder, and the company whose flag it came from (Draft 4 § C): its logo marks the option, and a screen reader hears it. */
interface PartOption extends CarouselOption {
  company: CompanyId | null
}
const fromKit = <T extends string,>(list: EarnedOption<T>[], name: (id: T) => string): PartOption[] =>
  list.map((o) => ({ id: o.id, name: name(o.id), company: o.company, ...(o.company ? { spoken: `${name(o.id)}, from ${companyById(o.company).name}` } : {}) }))

type Wheel = 'shape' | 'charge'

/** The three soldiers under the flag: a swordsman, a spearman, an archer, each his own face. */
const TROOP = [
  { kind: 'sword', skin: '#b07a52' },
  { kind: 'spear', skin: '#e0b48a' },
  { kind: 'bow', skin: '#7a4e32' },
] as const

/**
 * Your militia: its name and its flag (Oct 2026; the designer: "the first
 * thing when you start a new game is to create your company … a more fleshed
 * out flag builder … like a Mario Kart carousel … then you can make any name
 * you want but use a profanity filter").
 *
 * `create`: when the Sovereign Route first opens (the full run, your own
 * road — not a new game's first screen any more: "at the start let's just get
 * into the gameplay loop"); "Found the militia" goes on to its charter, and
 * the back goes home. `edit`: from Settings or the home, with a back that
 * changes nothing. The header is the name: typed (checked by
 * `run/nameFilter`) or rolled with the dice. The flag is two columns under a preview of it on
 * its wagon (the designer, on the six-row builder: "this takes up too much
 * space … two vertical carousels, banner shape + icon shape; under each a
 * subset: banner = pattern, icon = colour"; then "make these horizontal
 * carousels and add a dice in the top"): the FLAG wheel with its pattern
 * carousel, the EMBLEM wheel with the colour pairs (a circle split in the
 * field's and the pattern's colour) and the metal ("same as the colour
 * selection"); the dice on the preview
 * rolls a whole flag. The preview is the flag over three of your soldiers in
 * its colours — a swordsman, a spearman and an archer ("show some soldiers
 * instead of the cart … they all adjust colours and maybe pattern on shield";
 * "make them three different dudes"). Nothing is saved until the CTA.
 */
export function MilitiaScreen({ onDone, onBack, mode = 'edit' }: { onDone: () => void; onBack?: () => void; mode?: 'create' | 'edit' }) {
  const saved = useMetaStore((s) => s.militia)
  const setMilitia = useMetaStore((s) => s.setMilitia)
  // The base set, and every piece earned from any company's flag (Draft 4 § C).
  const xp = useMetaStore((s) => s.standing)
  const opts = useMemo(() => {
    const parts = earnedBannerParts((c) => standingOf(xp, c))
    return {
      shape: fromKit(parts.shapes, (id) => SHAPE_NAMES[id]),
      charge: fromKit(parts.charges, (id) => CHARGE_NAMES[id]),
      pattern: fromKit(parts.patterns, (id) => PATTERN_NAMES[id]),
      metal: fromKit(parts.metals, (id) => METAL_NAMES[id]),
      pair: parts.pairs.map((o) => ({
        id: o.id,
        name: `${TINCTURE_NAMES[o.pair[0]]} & ${TINCTURE_NAMES[o.pair[1]]}`,
        company: o.company,
        pair: o.pair,
        ...(o.company ? { spoken: `${TINCTURE_NAMES[o.pair[0]]} & ${TINCTURE_NAMES[o.pair[1]]}, from ${companyById(o.company).name}` } : {}),
      })),
    }
  }, [xp])
  const byId = <T extends PartOption,>(list: T[], id: string) => list.find((o) => o.id === id)
  // A fresh name and flag to start from: a UI roll, not a run stream.
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9))
  const [m, setM] = useState<Militia>(() => saved ?? { name: militiaName(seed), ...fullBanner(mode === 'create' ? randomBanner(seed) : DEFAULT_BANNER) })
  const [typed, setTyped] = useState(m.name)
  const [open, setOpen] = useState<Wheel | null>(null)
  const look = fullBanner(m)
  const check = checkCompanyName(typed)

  const roll = () => {
    const next = rerollName(seed + 1, m.name)
    setSeed(next.seed)
    setTyped(next.name)
  }
  const surprise = () => {
    const s = seed + 7
    setSeed(s)
    setM({ ...m, ...randomBanner(s) })
  }
  const set = (patch: Partial<Militia>) => setM((cur) => ({ ...cur, ...patch }))
  const done = () => {
    if (!check.ok) return
    setMilitia({ ...m, name: check.name })
    onDone()
  }

  // Each wheel shows ONLY its own part (the designer: "only show the parts
  // that are selected — it's assembled at the top"): the shape as bare cloth,
  // the emblem alone in the chosen metal.
  // A company's piece wears its logo, small, in the corner (Draft 4 § C).
  const marked = (o: PartOption | undefined, art: ReactNode) =>
    o?.company ? (
      <span className="co-from">
        {art}
        <span className="co-from-mark">
          <Crest company={o.company} scale={1} />
        </span>
      </span>
    ) : (
      art
    )
  const shapeArt = (id: string, big: boolean) =>
    marked(byId(opts.shape, id), <Banner look={{ shape: id as BannerShape, tincture: 'slate', charge: 'none', metal: 'parchment' }} scale={big ? 4 : 3} />)
  const chargeArt = (id: string, big: boolean) =>
    marked(
      byId(opts.charge, id),
      id === 'none' ? (
        <span className={`co-none${big ? ' big' : ''}`} />
      ) : (
        <Pixel rows={CHARGES[id as Charge]} palette={{ p: METALS[look.metal] }} scale={big ? 9 : 7} className="co-emblem" />
      ),
    )
  const pair = opts.pair.find((o) => o.pair[0] === look.tincture && o.pair[1] === look.tincture2)?.id ?? ''

  return (
    <ContractPage
      className={`mi co-build${mode === 'create' ? ' is-create' : ''}`}
      label="Your militia"
      // The header IS the name (the designer: "the top had redundant info —
      // the header can be the input; don't need helper text"): no title over
      // it, no label, no hint; only a reason under it when the name is refused.
      head={
        <div className="ct-hdr co-head">
          {(mode === 'edit' || onBack) && (
            <button className="ct-back" onClick={onBack ?? onDone} aria-label="Back, without changing anything">
              <Icon name="back" />
            </button>
          )}
          <input
            className="co-title-input"
            value={typed}
            maxLength={NAME_MAX}
            autoComplete="off"
            spellCheck={false}
            placeholder="Name your militia"
            onChange={(e) => setTyped(e.target.value)}
            aria-label="Militia name"
            aria-invalid={!check.ok}
            aria-describedby={check.ok ? undefined : 'co-name-why'}
          />
          <button type="button" className="co-dice" onClick={roll} aria-label="Roll a name">
            <DiceIcon />
          </button>
          {!check.ok && (
            <span id="co-name-why" className="co-why" role="alert">
              {check.why}
            </span>
          )}
        </div>
      }
      cta={{
        label: mode === 'create' ? 'Found the militia' : saved ? 'Raise the new flag' : 'Raise the flag',
        run: done,
        heavy: true,
        disabled: !check.ok,
      }}
    >
      <div className="mi-preview co-preview">
        <button type="button" className="co-surprise" onClick={surprise} aria-label="Surprise me: a whole new flag">
          <DiceIcon />
        </button>
        <div className="mi-preview-road" aria-hidden="true" />
        <div className="mi-preview-flag co-wave" aria-hidden="true">
          <Banner look={look} scale={5} />
        </div>
        <div className="co-troop" aria-hidden="true">
          {TROOP.map((t) => (
            <Pixel key={t.kind} rows={soldierRows(look, t.kind)} palette={soldierPalette(look, t.skin)} scale={3} />
          ))}
        </div>
      </div>

      <div className="co-cols">
        <section className="co-col" aria-label="The flag">
          <FlagWheel label="Flag" options={opts.shape} value={look.shape} onChange={(id) => set({ shape: id as BannerShape })} render={(o, big) => shapeArt(o.id, big)} onOpenAll={() => setOpen('shape')} />
          <PartCarousel
            label="Pattern"
            options={opts.pattern}
            value={look.pattern}
            onPick={(id) => set({ pattern: id as Pattern })}
            render={(o) => marked(o, <Pixel rows={patternRows(o.id as Pattern)} palette={PATTERN_SWATCH} scale={2} className="co-pattern" />)}
          />
        </section>
        <section className="co-col" aria-label="The emblem">
          <FlagWheel label="Emblem" options={opts.charge} value={look.charge} onChange={(id) => set({ charge: id as Charge })} render={(o, big) => chargeArt(o.id, big)} onOpenAll={() => setOpen('charge')} />
          <PartCarousel
            label="Colours"
            options={opts.pair}
            value={pair}
            onPick={(id) => {
              const o = byId(opts.pair, id)
              if (o) set({ tincture: o.pair[0], tincture2: o.pair[1] })
            }}
            render={(o) => {
              const [a, b] = o.pair
              return marked(o, <span className="co-pair" style={{ background: `linear-gradient(135deg, ${TINCTURES[a]} 50%, ${TINCTURES[b]} 50%)`, boxShadow: `0 0 0 2px ${METALS[look.metal]}, 0 2px 0 3px rgba(0, 0, 0, 0.4)` }} />)
            }}
          />
          <PartCarousel
            label="Metal"
            options={opts.metal}
            value={look.metal}
            onPick={(id) => set({ metal: id as Metal })}
            render={(o) => marked(o, <span className="co-coin" style={{ background: METALS[o.id as Metal] }} />)}
          />
        </section>
      </div>

      {open && (
        <Sheet label={open === 'shape' ? 'Flag shape' : 'Emblem'} onClose={() => setOpen(null)}>
          <OptionGrid
            label={open === 'shape' ? 'Flag shape' : 'Emblem'}
            options={(open === 'shape' ? opts.shape : opts.charge) as readonly CarouselOption[]}
            value={look[open]}
            render={(o) => (open === 'shape' ? shapeArt(o.id, true) : chargeArt(o.id, true))}
            onPick={(id) => (set(open === 'shape' ? { shape: id as BannerShape } : { charge: id as Charge }), setOpen(null))}
            onClose={() => setOpen(null)}
          />
        </Sheet>
      )}
    </ContractPage>
  )
}

const DiceIcon = () => (
  <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" shapeRendering="crispEdges">
    <rect x="1" y="1" width="14" height="14" fill="currentColor" />
    <rect x="2" y="2" width="12" height="12" fill="#2a1e14" />
    {[
      [4, 4],
      [10, 4],
      [7, 7],
      [4, 10],
      [10, 10],
    ].map(([x, y]) => (
      <rect key={`${x}${y}`} x={x} y={y} width="2" height="2" fill="currentColor" />
    ))}
  </svg>
)

/** A modal sheet: Escape or a tap outside closes it; focus goes in and comes back. */
function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      back?.focus?.()
    }
  }, [])
  return (
    <div className="fc-scrim" role="dialog" aria-modal="true" aria-label={label} ref={ref} onClick={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  )
}
