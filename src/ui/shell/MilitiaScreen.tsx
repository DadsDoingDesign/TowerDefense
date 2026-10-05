import { useState, type CSSProperties } from 'react'
import {
  BANNER_SHAPES,
  CHARGE_IDS,
  CHARGE_NAMES,
  DEFAULT_BANNER,
  SHAPE_NAMES,
  TINCTURE_IDS,
  TINCTURE_NAMES,
  TINCTURES,
  type BannerLook,
} from '../../game/data/banner'
import { CRATE, cratePalette, WAGON, WAGON_PALETTE } from '../../game/data/pixelArt'
import { militiaName, rerollName, type Militia } from '../../game/run/militia'
import { useMetaStore } from '../../state/metaStore'
import { Icon } from '../Icon'
import { Banner, Pixel } from '../pixel'
import { ContractPage } from './contracts/parts'

/**
 * Your militia: its name and its banner (the mercenary company, build step 4;
 * mockup `trade/r3/10-banner.png`).
 *
 * The name is picked from generated names with a re-roll — never typed, so it
 * needs no moderation (`run/militia.ts`). The banner is a shape, one of the
 * six dark field colours that never read as a company or a rarity, and a
 * parchment emblem (`data/banner.ts`). The preview is the battle's wagon with
 * the banner beside it, where it will fly.
 *
 * Opened by the menu's one coach tip after the first finished contract, and
 * from Settings after that (the HQ may link here too: `setMetaView('militia')`).
 * Nothing is saved until "Raise the banner".
 */
export function MilitiaScreen({ onDone }: { onDone: () => void }) {
  const saved = useMetaStore((s) => s.militia)
  const setMilitia = useMetaStore((s) => s.setMilitia)
  // A fresh name to start from: a UI roll, not a run stream.
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9))
  const [m, setM] = useState<Militia>(() => saved ?? { name: militiaName(seed), ...DEFAULT_BANNER })
  const look: BannerLook = { shape: m.shape, tincture: m.tincture, charge: m.charge }
  const reroll = () => {
    const next = rerollName(seed + 1, m.name)
    setSeed(next.seed)
    setM({ ...m, name: next.name })
  }
  const raise = () => {
    setMilitia(m)
    onDone()
  }

  return (
    <ContractPage
      className="mi"
      label="Your militia"
      head={
        <div className="ct-hdr">
          <button className="ct-back" onClick={onDone} aria-label="Back, without changing anything">
            <Icon name="back" />
          </button>
          <div className="ct-who">
            <h1 className="ct-title" tabIndex={-1}>
              Your militia
            </h1>
            <span>Its name and the banner over your wagons</span>
          </div>
        </div>
      }
      cta={{ label: saved ? 'Raise the new banner' : 'Raise the banner', run: raise, heavy: true }}
    >
      <p className="ct-eyebrow left">Name</p>
      <div className="mi-name">
        <output className="mi-name-v" aria-live="polite">
          {m.name}
        </output>
        <button type="button" className="mi-reroll" onClick={reroll}>
          Another name
        </button>
      </div>

      <div className="mi-preview" aria-hidden="true">
        <span className="mi-preview-cap">Flies over your wagons</span>
        <div className="mi-preview-road" />
        <div className="mi-preview-flag">
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

      <p className="ct-eyebrow left" id="mi-shape">
        Shape
      </p>
      <div className="mi-opts" role="radiogroup" aria-labelledby="mi-shape">
        {BANNER_SHAPES.map((shape) => (
          <button
            key={shape}
            type="button"
            role="radio"
            aria-checked={m.shape === shape}
            aria-label={SHAPE_NAMES[shape]}
            className={`mi-opt${m.shape === shape ? ' on' : ''}`}
            onClick={() => setM({ ...m, shape })}
          >
            <Banner look={{ ...look, shape }} scale={3} />
          </button>
        ))}
      </div>

      <p className="ct-eyebrow left" id="mi-colour">
        Colour
      </p>
      <div className="mi-swatches" role="radiogroup" aria-labelledby="mi-colour">
        {TINCTURE_IDS.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={m.tincture === t}
            className={`mi-swatch${m.tincture === t ? ' on' : ''}`}
            onClick={() => setM({ ...m, tincture: t })}
          >
            <i style={{ '--sw': TINCTURES[t] } as CSSProperties} />
            <span>{TINCTURE_NAMES[t]}</span>
          </button>
        ))}
      </div>

      <p className="ct-eyebrow left" id="mi-emblem">
        Emblem
      </p>
      <div className="mi-opts three" role="radiogroup" aria-labelledby="mi-emblem">
        {CHARGE_IDS.map((charge) => (
          <button
            key={charge}
            type="button"
            role="radio"
            aria-checked={m.charge === charge}
            aria-label={CHARGE_NAMES[charge]}
            className={`mi-opt${m.charge === charge ? ' on' : ''}`}
            onClick={() => setM({ ...m, charge })}
          >
            <Banner look={{ ...look, shape: 'square', charge }} scale={3} />
          </button>
        ))}
      </div>

      <p className="mi-note">Dark colours only, so your banner never reads as a company or a rarity.</p>
    </ContractPage>
  )
}
