import { COMPANY_IDS } from '../../game/data/companies'
import { STRIP_H, STRIP_W, worldArt, type Palette, type Rows } from './themeArt'

/**
 * Rasterise the company worlds' pixel art (`themeArt.ts`) into CSS variables,
 * once, when the theme stylesheet is installed: per company, its frame
 * (`--th-frame-0`, a 9-slice for `border-image`), its CTA strip (`--th-strip`)
 * and the card's crest where a world has one (`--th-crest`) — each one still
 * image (the calm pass, Oct 2026). Each is a few hundred bytes of PNG data
 * URL. Browser only.
 */
function toUrl(rows: Rows, palette: Palette): string {
  const h = rows.length
  const w = rows[0]?.length ?? 0
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) return 'none'
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x]
      if (ch === '.' || !palette[ch]) continue
      g.fillStyle = palette[ch]
      g.fillRect(x, y, 1, 1)
    }
  }
  return `url("${c.toDataURL('image/png')}")`
}

/** The worlds' CSS: one `:root[data-co-theme='<id>']` block of art variables per company. */
export function worldArtCss(): string {
  if (typeof document === 'undefined') return ''
  return COMPANY_IDS.map((id) => {
    const a = worldArt(id)
    const decls = [
      `--th-frame-0:${toUrl(a.frame, a.palette)};`,
      `--th-strip:${toUrl(a.strip, a.palette)};`,
      ...(a.crest ? [`--th-crest:${toUrl(a.crest, a.palette)};`] : []),
    ].join('')
    return `:root[data-co-theme='${id}']{${decls}}`
  }).join('\n')
}

/** The strip's drawn size: each source pixel at 2 CSS px. */
export const STRIP_CSS = { w: STRIP_W * 2, h: STRIP_H * 2 }
