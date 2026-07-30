import { useEffect, useState } from 'react'
import { useGameStore } from '../../state/gameStore'
import { EvolutionModal } from '../components/EvolutionModal'
import { DetailBand } from './DetailBand'
import { HeaderBand } from './HeaderBand'
import { SelectorBand } from './SelectorBand'
import { StageBand } from './StageBand'
import { useShellContext } from './context'
import { useOffers, type MetaView } from './offers'
import '../../styles/shell.css'

/**
 * The whole game in one screen. Four bands at fixed heights; every surface the
 * app used to push — sheets, drawers, modals, separate screens — is a state of
 * these bands. See docs/FIGMA.md § The Root Shell for the rules.
 *
 * The one blocking overlay that survives is the evolution choice, which is
 * destructive and irreversible.
 */
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
