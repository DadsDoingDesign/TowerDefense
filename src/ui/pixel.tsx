import { memo, type CSSProperties } from 'react'
import { useMetaStore } from '../state/metaStore'
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
export const Pixel = memo(function Pixel({ rows, palette, scale = 2, className, style }: { rows: PixelRows; palette: Palette; scale?: number; className?: string; style?: CSSProperties }) {
  const w = rows[0]?.length ?? 0
  const h = rows.length
  return (
    <svg
      className={`px${className ? ` ${className}` : ''}`}
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      style={style}
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
  // A second term signed with the company (Draft 4 · B) puts a gold rim on its
  // crest everywhere it is drawn (`.crest.rim`, app.css).
  const rim = useMetaStore((s) => !locked && (s.terms?.[company] ?? 1) >= 2)
  // The rim is one of the crest's own pixels wide (`--rim`), not a hairline round 2 px cells.
  return <Pixel rows={logo.rows} palette={logo.palette} scale={scale} className={`crest logo${locked ? ' locked' : ''}${rim ? ' rim' : ''}`} style={rim ? ({ '--rim': `${scale}px` } as CSSProperties) : undefined} />
}

/** The Sovereign Route's crest: a crown on a shield in the Sovereign cyan (the endgame charter). */
export function SovereignCrest({ scale = 2 }: { scale?: number }) {
  const base = SOVEREIGN_COLOR
  const pal: Palette = { o: OUTLINE, c: base, l: shade(base, 0.35), d: shade(base, -0.3), ...CROWN_GOLD, g: '#e0ac4c' }
  return <Pixel rows={crestRows(SOVEREIGN_EMBLEM)} palette={pal} scale={scale} className="crest sovereign" />
}

/**
 * The trade war's leader's crown (Draft 4 § D): the Sovereign crest's crown (`SOVEREIGN_EMBLEM`), in
 * gold with one ruby on its band, outlined so it reads on wood and on the map.
 */
const CROWN_GOLD = { w: '#fff0b8', y: '#a8812c', r: '#e0443a' }
const CROWN_ROWS = outlined(SOVEREIGN_EMBLEM.slice(0, 6))
const CROWN_PALETTE = { ...CROWN_GOLD, g: '#f0c46a', k: '#161c2e' }
export const Crown = ({ scale = 2 }: { scale?: number }) => <Pixel rows={CROWN_ROWS} palette={CROWN_PALETTE} scale={scale} className="crown" />

/** Rows with a one-pixel `k` outline grown around every filled pixel. */
function outlined(rows: readonly string[]): string[] {
  const h = rows.length + 2
  const w = rows[0].length + 2
  const at = (x: number, y: number) => rows[y - 1]?.[x - 1] ?? '.'
  const out: string[] = []
  for (let y = 0; y < h; y++) {
    let line = ''
    for (let x = 0; x < w; x++) {
      const c = at(x, y)
      if (c !== '.') line += c
      else if ([[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => at(x + dx, y + dy) !== '.')) line += 'k'
      else line += '.'
    }
    out.push(line)
  }
  return out
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
  <Pixel rows={bannerRows(look)} palette={bannerPalette(look)} scale={scale} className="banner" />
)
