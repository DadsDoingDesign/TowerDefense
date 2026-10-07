import { memo } from 'react'
import { COMPANY_LOGOS, crestRows, SOVEREIGN_EMBLEM, type CompanyId } from '../game/data/companies'
import { SOVEREIGN_COLOR } from '../game/run/charter'
import { bannerPalette, bannerRows, type BannerLook } from '../game/data/banner'
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

/**
 * A company's mark: its own 16 × 16 logo (`COMPANY_LOGOS`) — a chili for
 * Peppercorn, an easel for Easel House, a pickaxe on ore for Ironvein, a spool
 * for Rosethread, a moon and quill for Moonquill — or the padlock for one not
 * met yet. (It was a shared shield with a small emblem until the October 2026
 * design review; the name `Crest` stays so every call site keeps working.)
 */
export function Crest({ company, scale = 2, locked = false }: { company: CompanyId; scale?: number; locked?: boolean }) {
  const logo = COMPANY_LOGOS[locked ? 'locked' : company]
  return <Pixel rows={logo.rows} palette={logo.palette} scale={scale} className={`crest logo${locked ? ' locked' : ''}`} />
}

/** The Sovereign Route's crest: a crown on a shield in the Sovereign cyan (the endgame charter). */
export function SovereignCrest({ scale = 2 }: { scale?: number }) {
  const base = SOVEREIGN_COLOR
  const pal: Palette = { o: OUTLINE, c: base, l: shade(base, 0.35), d: shade(base, -0.3), p: '#f3e7d0', g: '#e0ac4c' }
  return <Pixel rows={crestRows(SOVEREIGN_EMBLEM)} palette={pal} scale={scale} className="crest sovereign" />
}

/** A contract's crest: its company's, or the Sovereign Route's crown. */
export const RouteCrest = ({ company, scale = 2 }: { company: CompanyId | null; scale?: number }) =>
  company ? <Crest company={company} scale={scale} /> : <SovereignCrest scale={scale} />

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

/** A short sword: an item — flat when `sil` names a colour (a locked one). */
export const Sword = ({ scale = 2, sil }: { scale?: number; sil?: string }) => (
  <Pixel rows={SWORD} palette={sil ? silhouette(sil) : SWORD_PALETTE} scale={scale} className="sword" />
)

/** A padlock — opens later. Light on the dark panels (the mockups' lock was dark on dark). */
export const Lock = ({ scale = 2 }: { scale?: number }) => <Pixel rows={LOCK} palette={LOCK_PALETTE} scale={scale} className="lock" />

/** A sealed scroll — a skill, shown before it is opened; flat when `sil` names a colour. */
export const Scroll = ({ scale = 3, sil }: { scale?: number; sil?: string }) => (
  <Pixel rows={SCROLL} palette={sil ? silhouette(sil) : SCROLL_PALETTE} scale={scale} className="scroll" />
)

/** Your militia's banner: its shape, dark field and parchment charge, on a pole (`data/banner.ts`). */
export const Banner = ({ look, scale = 2 }: { look: BannerLook; scale?: number }) => (
  <Pixel rows={bannerRows(look.shape, look.charge)} palette={bannerPalette(look.tincture)} scale={scale} className="banner" />
)
