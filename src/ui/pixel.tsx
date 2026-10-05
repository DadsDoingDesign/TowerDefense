import { memo } from 'react'
import { companyById, crestRows, UNKNOWN_EMBLEM, type CompanyId } from '../game/data/companies'
import {
  COIN,
  COIN_PALETTE,
  CRATE,
  cratePalette,
  GHOST_CRATE,
  LANTERN,
  lanternPalette,
  LOCK,
  LOCK_PALETTE,
  SWORD,
  SWORD_PALETTE,
  OUTLINE,
  pixelRuns,
  SCROLL,
  SCROLL_PALETTE,
  shade,
  silhouette,
  type Palette,
  type PixelRows,
} from '../game/data/pixelArt'

/**
 * Pixel shapes for the trade layer, drawn as crisp SVG at whole-number scales
 * (the night-lantern mockups' `pxSvg`): crests, crates, the coin, lanterns and
 * the sealed skill scroll. The pixel rows live in `game/data/` so the battle
 * canvas draws the same shapes (`render/caravan.ts`).
 *
 * Decorative by default (`aria-hidden`): every shape rides beside the words it
 * illustrates — a crest beside its company's name, a crate beside "4 crates".
 */
export const Pixel = memo(function Pixel({ rows, palette, scale = 2, className }: { rows: PixelRows; palette: Palette; scale?: number; className?: string }) {
  const w = rows[0]?.length ?? 0
  const h = rows.length
  return (
    <svg
      className={`px${className ? ` ${className}` : ''}`}
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {pixelRuns(rows, palette).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  )
})

/** A company's crest: its emblem on a shield in its colour (or a locked "?"). */
export function Crest({ company, scale = 2, locked = false }: { company: CompanyId; scale?: number; locked?: boolean }) {
  const co = companyById(company)
  const base = locked ? '#5a4a36' : co.color
  const pal: Palette = {
    o: OUTLINE,
    c: base,
    l: shade(base, 0.35),
    d: shade(base, -0.3),
    p: locked ? '#8a7656' : '#f3e7d0',
    g: locked ? '#6d5a40' : '#e0ac4c',
  }
  return <Pixel rows={crestRows(locked ? UNKNOWN_EMBLEM : co.emblem)} palette={pal} scale={scale} className="crest" />
}

/** A cargo crate banded in its company's colour, or an empty slot. */
export function Crate({ color = '#c6e05a', scale = 3, ghost = false }: { color?: string; scale?: number; ghost?: boolean }) {
  return <Pixel rows={CRATE} palette={ghost ? GHOST_CRATE : cratePalette(color)} scale={scale} className={ghost ? 'crate ghost' : 'crate'} />
}

/** The coin: gold, the only currency. */
export const Coin = ({ scale = 2 }: { scale?: number }) => <Pixel rows={COIN} palette={COIN_PALETTE} scale={scale} className="coin" />

/** A city's lantern on the route rail — lit once the caravan has reached it. */
export const Lantern = ({ lit, scale = 3 }: { lit: boolean; scale?: number }) => (
  <Pixel rows={LANTERN} palette={lanternPalette(lit)} scale={scale} className={lit ? 'lantern lit' : 'lantern'} />
)

/** A short sword: an item. */
export const Sword = ({ scale = 2 }: { scale?: number }) => <Pixel rows={SWORD} palette={SWORD_PALETTE} scale={scale} className="sword" />

/** A padlock — opens later. Light on the dark panels (the mockups' lock was dark on dark). */
export const Lock = ({ scale = 2 }: { scale?: number }) => <Pixel rows={LOCK} palette={LOCK_PALETTE} scale={scale} className="lock" />

/** A sealed scroll — a skill, shown before it is opened; flat when `sil` names a colour. */
export const Scroll = ({ scale = 3, sil }: { scale?: number; sil?: string }) => (
  <Pixel rows={SCROLL} palette={sil ? silhouette(sil) : SCROLL_PALETTE} scale={scale} className="scroll" />
)
