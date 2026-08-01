import { useEffect, useState } from 'react'
import { useGameStore } from '../../state/gameStore'
import { EvolutionModal } from '../components/EvolutionModal'
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
  settings: { title: 'Settings', subtitle: 'Audio, motion, contrast and scale.' },
}

export function RootShell() {
  const ctx = useShellContext()
  const screen = useGameStore((s) => s.screen)
  const shellSelect = useGameStore((s) => s.shellSelect)
  const [metaView, setMetaView] = useState<MetaView>('menu')
  const offers = useOffers(metaView, setMetaView)

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
      <HeaderBand meta={ctx.meta} />
      <StageBand ctx={ctx} />
      <SelectorBand ctx={ctx} offers={offers} />
      <DetailBand offers={offers} />
      <EvolutionModal />
    </div>
  )
}
