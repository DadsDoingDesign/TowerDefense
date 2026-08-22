import type { CSSProperties } from 'react'
import { iconCell, type IconKey } from './channels'

/**
 * One cell of `public/assets/ui/fw-icons.png`.
 *
 * It lives at `src/ui/` next to `channels.ts` because the Root Shell
 * (`src/ui/shell/`) is not the only consumer: `src/ui/components/RunMapView`
 * draws the Threat mark from it, and the Stage band renders that component, so
 * a shell-private module would have made the map node's chip and the header's
 * chip two different pictures of the same thing — which is exactly what they
 * were until M11. The earlier version of this note claimed the `?shell=0`
 * screens under `src/ui/screens/` import it; they do not, and never did.
 *
 * ---------------------------------------------------------------------------
 * Why a background sprite and not an `<img>` or an inline SVG
 * ---------------------------------------------------------------------------
 * 71 `<img>` tags means 71 requests and 71 service-worker precache entries, on a
 * build that is already carrying 89 unreferenced files. 71 inline SVGs means the
 * same art inside the JS bundle, parsed on every boot, and pixel-perfect 16px
 * pixel art is exactly the thing SVG is worst at. One 3.8 KB PNG is one request,
 * one cache entry, and byte-exact pixels.
 *
 * ---------------------------------------------------------------------------
 * Integer scales only
 * ---------------------------------------------------------------------------
 * `--fw-i-size` is 16px or 32px and nothing in between. `image-rendering:
 * pixelated` at a fractional scale does not blur — it *drops and doubles*
 * columns, so a 1px outline becomes 1px on one side of the icon and 2px on the
 * other, which reads as a drawing mistake rather than as a scaling artefact.
 * The two sizes are enough: 16px sits on a text line, 32px fills a tile.
 *
 * ---------------------------------------------------------------------------
 * `aria-hidden`, always
 * ---------------------------------------------------------------------------
 * There is no `alt` and no `role="img"` here by design. Every place an icon is
 * drawn, the same meaning is already in text — the row label, the effect
 * sentence, the control's accessible name. An icon that also announced itself
 * would make a screen reader say "burn, burns 8/s for 3s". The corollary is the
 * rule this whole layer is built on: the icon is never the only channel, so it
 * is safe for it to be silent, and safe for it to be missing.
 */
export function Icon({
  name,
  lg,
  className,
}: {
  name: IconKey
  /** 32px instead of 16px. Tiles and the pack grid; never a text line. */
  lg?: boolean
  className?: string
}) {
  const { ix, iy } = iconCell(name)
  return (
    <span
      className={`fw-i${lg ? ' lg' : ''}${className ? ' ' + className : ''}`}
      style={{ '--ix': ix, '--iy': iy } as CSSProperties}
      aria-hidden="true"
      data-icon={name}
    />
  )
}
