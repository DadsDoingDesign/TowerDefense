import type { CSSProperties } from 'react'
import type { ThemeId } from '../../game/run/militiaTheme'
import { uiTheme } from './companyThemes'

/**
 * A UI theme shown as itself (Oct 2026): a chip of its panel, its accent
 * across the top and its CTA as a bar along the foot — so a picker or a track
 * row shows what the theme LOOKS like, whatever theme the page around it
 * wears. Decorative: the name always rides beside it.
 */
export function ThemeSwatch({ theme, size = 'sm' }: { theme: ThemeId; size?: 'sm' | 'lg' }) {
  const k = uiTheme(theme).tokens
  return (
    <span
      className={`th-swatch${size === 'lg' ? ' lg' : ''}`}
      style={{ '--th-panel': k['panel-2'], '--th-accent': k.accent, '--th-cta': k.cta, '--th-line': k['line-strong'] } as CSSProperties}
      aria-hidden="true"
    />
  )
}
