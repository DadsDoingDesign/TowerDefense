import { useEffect, useRef, useState } from 'react'
import {
  BANNER_SHAPES,
  CHARGE_IDS,
  CHARGE_NAMES,
  CHARGES,
  COLOUR_PAIRS,
  DEFAULT_BANNER,
  fullBanner,
  METAL_IDS,
  METAL_NAMES,
  METALS,
  pairIndex,
  PATTERN_NAMES,
  PATTERNS,
  patternRows,
  SHAPE_NAMES,
  soldierPalette,
  soldierRows,
  TINCTURE_NAMES,
  TINCTURES,
  type BannerShape,
  type Charge,
  type Pattern,
} from '../../game/data/banner'
import { militiaName, randomBanner, rerollName, type Militia } from '../../game/run/militia'
import { checkCompanyName, NAME_MAX } from '../../game/run/nameFilter'
import { useMetaStore } from '../../state/metaStore'
import { Icon } from '../Icon'
import { Banner, Pixel } from '../pixel'
import { ContractPage } from './contracts/parts'
import { FlagWheel, OptionGrid, PartCarousel, type CarouselOption } from './company/FlagCarousel'
import '../../styles/company.css'

/** A pattern shown on its own: a mid and a light stone, so the division reads whatever your colours. */
const PATTERN_SWATCH = { c: '#4b4238', d: '#c9bfae' }

const SHAPE_OPTIONS = BANNER_SHAPES.map((id) => ({ id, name: SHAPE_NAMES[id] }))
const CHARGE_OPTIONS = CHARGE_IDS.map((id) => ({ id, name: CHARGE_NAMES[id] }))
const PATTERN_OPTIONS = PATTERNS.map((id) => ({ id, name: PATTERN_NAMES[id] }))
const PAIR_OPTIONS: CarouselOption[] = COLOUR_PAIRS.map(([a, b], i) => ({ id: String(i), name: `${TINCTURE_NAMES[a]} & ${TINCTURE_NAMES[b]}` }))

type Wheel = 'shape' | 'charge'

/** The three soldiers under the flag: one body, three faces. */
const SKINS = ['#e0b48a', '#b07a52', '#7a4e32'] as const

/**
 * Your militia: its name and its flag (Oct 2026; the designer: "the first
 * thing when you start a new game is to create your company … a more fleshed
 * out flag builder … like a Mario Kart carousel … then you can make any name
 * you want but use a profanity filter").
 *
 * `create`: the first screen of a new game — no way back, and "Found the
 * militia" goes to the map (the home). `edit`: from Settings or the home, with
 * a back that changes nothing. The name is typed (checked by `run/nameFilter`)
 * or rolled with the dice. The flag is two columns under a preview of it on
 * its wagon (the designer, on the six-row builder: "this takes up too much
 * space … two vertical carousels, banner shape + icon shape; under each a
 * subset: banner = pattern, icon = colour"; then "make these horizontal
 * carousels and add a dice in the top"): the FLAG wheel with its pattern
 * carousel, the EMBLEM wheel with the colour pairs (a circle split in the
 * field's and the pattern's colour) and the metal; the dice on the preview
 * rolls a whole flag. The preview is the flag over three of your soldiers in
 * its colours ("show some soldiers instead of the cart … they all adjust
 * colours and maybe pattern on shield"). Nothing is saved until the CTA.
 */
export function MilitiaScreen({ onDone, mode = 'edit' }: { onDone: () => void; mode?: 'create' | 'edit' }) {
  const saved = useMetaStore((s) => s.militia)
  const setMilitia = useMetaStore((s) => s.setMilitia)
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
  const shapeArt = (id: string, big: boolean) => (
    <Banner look={{ shape: id as BannerShape, tincture: 'slate', charge: 'none', metal: 'parchment' }} scale={big ? 4 : 3} />
  )
  const chargeArt = (id: string, big: boolean) =>
    id === 'none' ? (
      <span className={`co-none${big ? ' big' : ''}`} />
    ) : (
      <Pixel rows={CHARGES[id as Charge]} palette={{ p: METALS[look.metal] }} scale={big ? 9 : 7} className="co-emblem" />
    )
  const pair = pairIndex(look)

  return (
    <ContractPage
      className={`mi co-build${mode === 'create' ? ' is-create' : ''}`}
      label="Your militia"
      head={
        <div className="ct-hdr">
          {mode === 'edit' && (
            <button className="ct-back" onClick={onDone} aria-label="Back, without changing anything">
              <Icon name="back" />
            </button>
          )}
          <div className="ct-who">
            <h1 className="ct-title" tabIndex={-1}>
              {mode === 'create' ? 'Found your militia' : 'Your militia'}
            </h1>
            <span>Its name, and the flag over your wagons</span>
          </div>
        </div>
      }
      cta={{
        label: mode === 'create' ? 'Found the militia' : saved ? 'Raise the new flag' : 'Raise the flag',
        run: done,
        heavy: true,
        disabled: !check.ok,
      }}
    >
      <label className="co-name">
        <span className="co-k">Militia name</span>
        <span className="co-name-row">
          <input
            className="co-input"
            value={typed}
            maxLength={NAME_MAX}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setTyped(e.target.value)}
            aria-invalid={!check.ok}
            aria-describedby="co-name-why"
          />
          <button type="button" className="co-dice" onClick={roll} aria-label="Roll a name">
            <DiceIcon />
          </button>
        </span>
        <span id="co-name-why" className={`co-why${check.ok ? '' : ' bad'}`} aria-live="polite">
          {check.ok ? 'Type any name, or roll one.' : check.why}
        </span>
      </label>

      <div className="mi-preview co-preview">
        <button type="button" className="co-surprise" onClick={surprise} aria-label="Surprise me: a whole new flag">
          <DiceIcon />
        </button>
        <span className="mi-preview-cap" aria-hidden="true">{check.ok ? check.name : 'Your militia'}</span>
        <div className="mi-preview-road" aria-hidden="true" />
        <div className="mi-preview-flag co-wave" aria-hidden="true">
          <Banner look={look} scale={5} />
        </div>
        <div className="co-troop" aria-hidden="true">
          {SKINS.map((skin) => (
            <Pixel key={skin} rows={soldierRows(look)} palette={soldierPalette(look, skin)} scale={3} />
          ))}
        </div>
      </div>

      <div className="co-cols">
        <section className="co-col" aria-label="The flag">
          <FlagWheel label="Flag" options={SHAPE_OPTIONS} value={look.shape} onChange={(id) => set({ shape: id as BannerShape })} render={(o, big) => shapeArt(o.id, big)} onOpenAll={() => setOpen('shape')} />
          <PartCarousel
            label="Pattern"
            options={PATTERN_OPTIONS}
            value={look.pattern}
            onPick={(id) => set({ pattern: id as Pattern })}
            render={(o) => <Pixel rows={patternRows(o.id as Pattern)} palette={PATTERN_SWATCH} scale={2} className="co-pattern" />}
          />
        </section>
        <section className="co-col" aria-label="The emblem">
          <FlagWheel label="Emblem" options={CHARGE_OPTIONS} value={look.charge} onChange={(id) => set({ charge: id as Charge })} render={(o, big) => chargeArt(o.id, big)} onOpenAll={() => setOpen('charge')} />
          <PartCarousel
            label="Colours"
            options={PAIR_OPTIONS}
            value={String(pair)}
            onPick={(id) => {
              const [tincture, tincture2] = COLOUR_PAIRS[Number(id)]
              set({ tincture, tincture2 })
            }}
            render={(o) => {
              const [a, b] = COLOUR_PAIRS[Number(o.id)]
              return <span className="co-pair" style={{ background: `linear-gradient(135deg, ${TINCTURES[a]} 50%, ${TINCTURES[b]} 50%)`, boxShadow: `0 0 0 2px ${METALS[look.metal]}, 0 2px 0 3px rgba(0, 0, 0, 0.4)` }} />
            }}
          />
          <div className="co-metals">
            <span className="fw-label">Metal</span>
            <span role="radiogroup" aria-label="Emblem metal" className="co-metal-row">
              {METAL_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={look.metal === id}
                  aria-label={METAL_NAMES[id]}
                  className={`co-metal${look.metal === id ? ' on' : ''}`}
                  style={{ background: METALS[id] }}
                  onClick={() => set({ metal: id })}
                />
              ))}
            </span>
          </div>
        </section>
      </div>

      {open && (
        <Sheet label={open === 'shape' ? 'Flag shape' : 'Emblem'} onClose={() => setOpen(null)}>
          <OptionGrid
            label={open === 'shape' ? 'Flag shape' : 'Emblem'}
            options={(open === 'shape' ? SHAPE_OPTIONS : CHARGE_OPTIONS) as readonly CarouselOption[]}
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
