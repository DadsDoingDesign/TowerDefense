import { COMPANY_IDS } from '../../game/data/companies'
import { STRIP_H, STRIP_W, worldArt, type Palette, type Rows } from './themeArt'

/**
 * Rasterise the company worlds' pixel art (`themeArt.ts`) into CSS variables,
 * once, when the theme stylesheet is installed: per company, its frame's three
 * flipbook images (`--th-frame-0..2`, a 9-slice for `border-image`) and its CTA
 * strip's sprite sheet (`--th-strip`, four frames stacked), plus their timings.
 * Each image is a few hundred bytes of PNG data URL. Browser only.
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
    const frames = [0, 1, 2].map((i) => a.frames[i % a.frames.length])
    const sheet = [0, 1, 2, 3].flatMap((i) => a.strip[i % a.strip.length])
    const decls = [
      ...frames.map((f, i) => `--th-frame-${i}:${toUrl(f, a.palette)};`),
      `--th-strip:${toUrl(sheet, a.palette)};`,
      `--th-frame-ms:${a.frameMs}ms;`,
      `--th-strip-ms:${a.stripMs}ms;`,
    ].join('')
    return `:root[data-co-theme='${id}']{${decls}}`
  }).join('\n')
}

/** The strip's drawn size: each source pixel at 2 CSS px. */
export const STRIP_CSS = { w: STRIP_W * 2, h: STRIP_H * 2 }
