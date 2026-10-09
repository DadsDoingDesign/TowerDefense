import { useEffect, useRef, useState } from 'react'
import {
  BANNER_SHAPES,
  CHARGE_IDS,
  CHARGE_NAMES,
  DEFAULT_BANNER,
  fullBanner,
  METAL_IDS,
  METAL_NAMES,
  PATTERN_NAMES,
  PATTERNS,
  SHAPE_NAMES,
  TINCTURE_IDS,
  TINCTURE_NAMES,
  type BannerLook,
} from '../../game/data/banner'
import { CRATE, cratePalette, WAGON, WAGON_PALETTE } from '../../game/data/pixelArt'
import { militiaName, randomBanner, rerollName, type Militia } from '../../game/run/militia'
import { checkCompanyName, NAME_MAX } from '../../game/run/nameFilter'
import { useMetaStore } from '../../state/metaStore'
import { Icon } from '../Icon'
import { Banner, Pixel } from '../pixel'
import { ContractPage } from './contracts/parts'
import { FlagCarousel, OptionGrid, type CarouselOption } from './company/FlagCarousel'
import '../../styles/company.css'

type Part = 'shape' | 'tincture' | 'pattern' | 'tincture2' | 'charge' | 'metal'

/** The six rows, in the order a flag is built: cloth, field, division, its colour, emblem, metal. */
const PARTS: { id: Part; label: string; options: CarouselOption[] }[] = [
  { id: 'shape', label: 'Shape', options: BANNER_SHAPES.map((id) => ({ id, name: SHAPE_NAMES[id] })) },
  { id: 'tincture', label: 'Field colour', options: TINCTURE_IDS.map((id) => ({ id, name: TINCTURE_NAMES[id] })) },
  { id: 'pattern', label: 'Pattern', options: PATTERNS.map((id) => ({ id, name: PATTERN_NAMES[id] })) },
  { id: 'tincture2', label: 'Pattern colour', options: TINCTURE_IDS.map((id) => ({ id, name: TINCTURE_NAMES[id] })) },
  { id: 'charge', label: 'Emblem', options: CHARGE_IDS.map((id) => ({ id, name: CHARGE_NAMES[id] })) },
  { id: 'metal', label: 'Emblem metal', options: METAL_IDS.map((id) => ({ id, name: METAL_NAMES[id] })) },
]

/**
 * Your company: its name and its flag (Oct 2026; the designer: "the first
 * thing when you start a new game is to create your company … a more fleshed
 * out flag builder with better options for designs and colours and then also
 * shapes … like a Mario Kart carousel … then you can make any name you want
 * but use a profanity filter").
 *
 * `create`: the first screen of a new game — no way back, and "Found the
 * company" goes to the map (the home). `edit`: from Settings, with a back
 * that changes nothing. The name is typed (checked by `run/nameFilter`) or
 * rolled with the dice; the flag is six carousels over a large preview of
 * the flag on its wagon, with "Surprise me" for a whole random flag. Nothing
 * is saved until the CTA.
 */
export function MilitiaScreen({ onDone, mode = 'edit' }: { onDone: () => void; mode?: 'create' | 'edit' }) {
  const saved = useMetaStore((s) => s.militia)
  const setMilitia = useMetaStore((s) => s.setMilitia)
  // A fresh name and flag to start from: a UI roll, not a run stream.
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9))
  const [m, setM] = useState<Militia>(() => saved ?? { name: militiaName(seed), ...fullBanner(mode === 'create' ? randomBanner(seed) : DEFAULT_BANNER) })
  const [typed, setTyped] = useState(m.name)
  const [open, setOpen] = useState<Part | null>(null)
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
  const set = (part: Part, id: string) => setM((cur) => ({ ...cur, [part]: id }) as Militia)
  const done = () => {
    if (!check.ok) return
    setMilitia({ ...m, name: check.name })
    onDone()
  }

  // What each carousel shows: the whole flag with that one part swapped in.
  const preview = (part: Part, id: string, scale = 3) => {
    const b: BannerLook = { ...look, [part]: id }
    // A pattern colour reads only on a divided field: show it on halves.
    if (part === 'tincture2' && look.pattern === 'plain') b.pattern = 'pale'
    return <Banner look={b} scale={scale} />
  }
  const partOf = (id: Part) => PARTS.find((p) => p.id === id)!

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

      <div className="mi-preview co-preview" aria-hidden="true">
        <span className="mi-preview-cap">{check.ok ? check.name : 'Your militia'}</span>
        <div className="mi-preview-road" />
        <div className="mi-preview-flag co-wave">
          <Banner look={look} scale={6} />
        </div>
        <div className="mi-preview-cart">
          <div className="mi-preview-crates">
            {[0, 1, 2].map((i) => (
              <Pixel key={i} rows={CRATE} palette={cratePalette('#c6e05a')} scale={3} />
            ))}
          </div>
          <Pixel rows={WAGON} palette={WAGON_PALETTE} scale={4} />
        </div>
      </div>
      <button type="button" className="co-surprise" onClick={surprise}>
        <DiceIcon /> Surprise me
      </button>

      <div className="co-rows">
        {PARTS.map((p) => (
          <FlagCarousel
            key={p.id}
            label={p.label}
            options={p.options}
            value={String(look[p.id])}
            onChange={(id) => set(p.id, id)}
            render={(o) => preview(p.id, o.id)}
            onOpenAll={() => setOpen(p.id)}
            disabled={p.id === 'tincture2' && look.pattern === 'plain'}
            note="Pick a pattern first"
          />
        ))}
      </div>

      {open && (
        <Sheet label={partOf(open).label} onClose={() => setOpen(null)}>
          <OptionGrid
            label={partOf(open).label}
            options={partOf(open).options}
            value={String(look[open])}
            render={(o) => preview(open, o.id, 4)}
            onPick={(id) => (set(open, id), setOpen(null))}
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
