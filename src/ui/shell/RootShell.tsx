import { useEffect, useState } from 'react'
import { useGameStore } from '../../state/gameStore'
import { EvolutionModal } from '../components/EvolutionModal'
import { assertRarityTokensMatch } from '../channels'
import { Coach } from './Coach'
import { DetailBand } from './DetailBand'
import { HeaderBand } from './HeaderBand'
import { SelectorBand } from './SelectorBand'
import { StageBand } from './StageBand'
import { MenuScreen, PageScreen, ResultScreen } from './PageScreens'
import { useShellContext } from './context'
import { useOffers, type MetaView } from './offers'
import '../../styles/page.css'
import '../../styles/shell.css'

/**
 * The whole game in one screen. Four bands at fixed heights; every surface the
 * app used to push — sheets, drawers, modals, separate screens — is a state of
 * these bands. See docs/FIGMA.md § The Root Shell for the rules.
 *
 * The one blocking overlay that survives is the evolution choice, which is
 * destructive and irreversible.
 */
/** The Watchtower submenus have no board copy of their own. */
const META_COPY: Record<MetaView, { title?: string; subtitle?: string }> = {
  menu: {},
  perks: { title: 'Upgrade Perks', subtitle: 'Watch Marks buy permanent bonuses that carry into every run.' },
  settings: { title: 'Settings', subtitle: 'Audio, motion, contrast, scale, colour vision and assist.' },
}

export function RootShell() {
  const ctx = useShellContext()
  const screen = useGameStore((s) => s.screen)
  const shellSelect = useGameStore((s) => s.shellSelect)
  const [metaView, setMetaView] = useState<MetaView>('menu')
  const offers = useOffers(metaView, setMetaView)

  // Dev-only: shout if `--rarity-*` and `items.ts` have drifted apart. The ramp
  // lived in two places before and could disagree silently (DESIGN_SYSTEM 3.1);
  // now the shell reads the tokens, so a drift would silently mis-colour every
  // pack tile. Runs once, after the stylesheets are up.
  useEffect(() => {
    if (import.meta.env.DEV) assertRarityTokensMatch()
  }, [])

  // The Watchtower's submenus are a change of Selector contents, not a screen.
  // Leaving the hub drops back to its menu so returning is never mid-submenu.
  useEffect(() => {
    if (screen !== 'hub') {
      setMetaView('menu')
      shellSelect(null)
    }
  }, [screen, shellSelect])

  // Battle and the run map keep the four bands; everything else is a page.
  // Pages carry no app header — the serif title is the header, per the design,
  // and run resources ride in the title block only where spending matters.
  if (ctx.layout === 'page') {
    const isMenu = screen === 'hub' && metaView === 'menu'
    return (
      <div className="shell shell-page">
        {ctx.stage === 'result' ? (
          <ResultScreen />
        ) : isMenu ? (
          <MenuScreen offers={offers} />
        ) : (
          <PageScreen ctx={ctx} offers={offers} {...META_COPY[metaView]} />
        )}
        <EvolutionModal />
      </div>
    )
  }

  return (
    <div className="shell">
      <HeaderBand />
      {/* First-run teaching, in its own grid row so it never covers the Stage
          and never shifts a control (WS9). Renders nothing once taught. */}
      <Coach />
      <StageBand ctx={ctx} />
      {/* No `ctx` and no `offers`: this band is the party row and nothing else.
          The offers branch it used to carry was unreachable — see the note in
          SelectorBand.tsx and the invariant in context.ts. */}
      <SelectorBand />
      <DetailBand offers={offers} />
      <EvolutionModal />
    </div>
  )
}
