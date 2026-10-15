import { useLayoutEffect, useRef } from 'react'
import { create } from 'zustand'
import { FIRST_COMPANY } from '../../game/data/companies'
import { flyingMilitia, militiaTheme } from '../../game/run/militia'
import type { ThemeId } from '../../game/run/militiaTheme'
import { homeCompany } from '../../state/game/contractSlice'
import { useGameStore } from '../../state/gameStore'
import { useMetaStore } from '../../state/metaStore'
import { useMenuStaged } from '../shell/staging'
import { themeCss, themeFor, uiTheme } from './companyThemes'
import { fx } from './fxEngine'
import { worldArtCss } from './themeArtDom'

/**
 * A theme shown over everything while it is set: the militia builder's
 * try-on, or the saved run the boot's "Resume run" prompt offers. UI state
 * only: never saved.
 */
export const useThemePreview = create<{ preview: ThemeId | null; set: (t: ThemeId | null) => void }>((set) => ({
  preview: null,
  set: (preview) => set({ preview }),
}))

/** Put the themes' stylesheet in the document, once. */
function installThemeCss(): void {
  if (typeof document === 'undefined' || document.getElementById('co-themes')) return
  const el = document.createElement('style')
  el.id = 'co-themes'
  // The colours, then each world's pixel art as CSS variables (`themeArtDom`).
  el.textContent = `${themeCss()}\n${worldArtCss()}`
  document.head.appendChild(el)
}

/**
 * Dress the whole UI in the theme the game is in (`companyThemes.themeFor`):
 * `data-co-theme` on the root, which the generated stylesheet keys every
 * token off, and the browser's theme colour. Derived from saved state only —
 * the run's contract, your militia, the home's focus — so a reload mid-run
 * wears the same theme. Set before paint, so nothing flashes the house look.
 */
export function useCompanyTheme(): ThemeId {
  const screen = useGameStore((s) => s.screen)
  const board = useGameStore((s) => s.board)
  const contract = useGameStore((s) => s.contract ?? s.victory?.contract ?? null)
  const homeFocus = useGameStore((s) => s.homeFocus)
  const standing = useMetaStore((s) => s.standing)
  const runs = useMetaStore((s) => s.stats.runsCompleted)
  const militia = useMetaStore((s) => flyingMilitia(s.militia, s))
  const preview = useThemePreview((s) => s.preview)
  const staged = useMenuStaged()
  const id = themeFor({
    screen,
    board,
    contract,
    homeFocus,
    // Only read when nothing is focused at home (the menu's own default).
    defaultFocus: homeFocus ? FIRST_COMPANY : homeCompany({ standing, stats: { runsCompleted: runs } }),
    staged,
    firstCompany: FIRST_COMPANY,
    militia: militiaTheme(militia),
    preview,
  })
  // The switch-in plays when the world changes at home (a focus, the
  // builder's try-on) — not on the way into a run, and never on the first paint.
  const prev = useRef<string | null>(null)
  useLayoutEffect(() => {
    installThemeCss()
    fx.install()
    fx.setTheme(id)
    if (prev.current && prev.current !== id && screen === 'hub') fx.switchIn(id)
    prev.current = id
    const root = document.documentElement
    if (id === 'neutral') delete root.dataset.coTheme
    else root.dataset.coTheme = id
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', uiTheme(id).tokens.bg)
  }, [id])
  return id
}
