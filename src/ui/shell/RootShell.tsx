import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../state/gameStore'
import { assertRarityTokensMatch } from '../channels'
import { Coach } from './Coach'
import { DetailBand } from './DetailBand'
import { HeaderBand } from './HeaderBand'
import { SelectorBand } from './SelectorBand'
import { StageBand } from './StageBand'
import { PageScreen } from './PageScreens'
import { MenuScreen } from './MenuScreen'
import { MilitiaScreen } from './MilitiaScreen'
import { ResultScreen } from './contracts/ContractResult'
import { ContractsScreen } from './contracts/ContractsScreen'
import { CityScreen } from './contracts/CityScreen'
import { HqScreen } from './hq/HqScreen'
import { CratesScreen } from './hq/CratesScreen'
import { CharterScreen } from './charter/CharterScreen'
import { useShellContext } from './context'
import { useBattleLayout } from './live'
import { Announcer } from './Announcer'
import { ReceiptToast } from './PackStrip'
import { Shortcuts } from './Shortcuts'
import { useOffers, type MetaView } from './offers'
import '../../styles/page.css'
import '../../styles/shell.css'
import '../../styles/shell-live.css'
import '../../styles/shell-wide.css'
import '../../styles/shell-reward.css'
import '../../styles/contracts.css'
import '../../styles/menu.css'
import '../../styles/hq.css'
import '../../styles/charter.css'
import { useLevelUpTracker } from './levelUps'
import { useMenuStaged, useStagingRecorder } from './staging'

/**
 * The whole game in one screen. Four bands at fixed heights; every surface the
 * app used to push — sheets, drawers, modals, separate screens — is a state of
 * these bands. See docs/FIGMA.md § The Root Shell for the rules.
 *
 * The one blocking overlay that survives is the evolution choice, which is
 * destructive and irreversible.
 */
/** The hub's submenus with no board copy of their own (the HQ and the crates draw their own heads). */
const META_COPY: Record<MetaView, { title?: string; subtitle?: string }> = {
  menu: {},
  hq: {},
  crates: {},
  charter: {},
  codex: { title: 'Codex', subtitle: 'Your collection of skills and items, your standing, feats to earn, and everything your militia has met on the road.' },
  settings: { title: 'Settings', subtitle: 'Audio, motion, contrast, scale, colour vision, assist and tips.' },
  militia: { title: 'Your militia' },
}

export function RootShell() {
  const ctx = useShellContext()
  const screen = useGameStore((s) => s.screen)
  const shellSelect = useGameStore((s) => s.shellSelect)
  const [metaView, setMetaView] = useState<MetaView>('menu')
  // The banner picker returns to where it was opened from (the menu's tip, or Settings).
  const beforeMilitia = useRef<MetaView>('menu')
  useEffect(() => {
    if (metaView !== 'militia') beforeMilitia.current = metaView
  }, [metaView])
  const offers = useOffers(metaView, setMetaView)
  const battle = useBattleLayout()
  // G3-2: level-ups from a normal wave wait on the roster, not in a modal.
  useLevelUpTracker()
  // LS3: latch every idea the player meets, on every screen.
  useStagingRecorder()
  // LS3: the HQ and the sealed crates open after the first finished contract.
  const menuStaged = useMenuStaged()
  const metaCopy = META_COPY[metaView]

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

  /*
   * Focus follows the screen (Phase 2, finding 6). A new screen used to leave
   * keyboard focus on a control that no longer existed — it fell to <body>,
   * and the next Tab started from the top of a page the user could not see
   * the start of. Each screen's heading takes focus now, so a screen reader
   * reads where you are and Tab starts from the top of it.
   *
   * Skipped while a modal is open (the evolution choice manages its own focus)
   * and on the very first paint, which is the browser's to own.
   */
  const screenKey = `${ctx.layout}|${screen}|${ctx.stage}|${ctx.board?.title ?? ''}|${metaView}`
  const firstKey = useRef(true)
  useEffect(() => {
    if (firstKey.current) {
      firstKey.current = false
      return
    }
    const raf = requestAnimationFrame(() => {
      if (document.querySelector('[aria-modal="true"]')) return
      const h = document.querySelector<HTMLElement>('.shell h1')
      h?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(raf)
  }, [screenKey])

  // Battle and the run map keep the four bands; everything else is a page.
  // Pages carry no app header — the serif title is the header, per the design,
  // and run resources ride in the title block only where spending matters.
  if (ctx.layout === 'page') {
    const isMenu = screen === 'hub' && metaView === 'menu'
    return (
      <div className="shell shell-page">
        {ctx.stage === 'result' ? (
          <ResultScreen />
        ) : ctx.stage === 'contracts' ? (
          <ContractsScreen />
        ) : ctx.stage === 'city' ? (
          <CityScreen />
        ) : screen === 'hub' && metaView === 'hq' && !menuStaged ? (
          <HqScreen onBack={() => setMetaView('menu')} />
        ) : screen === 'hub' && metaView === 'crates' && !menuStaged ? (
          <CratesScreen onBack={() => setMetaView('menu')} />
        ) : screen === 'hub' && metaView === 'charter' && !menuStaged ? (
          <CharterScreen onBack={() => setMetaView('menu')} />
        ) : isMenu ? (
          <MenuScreen offers={offers} onMilitia={() => setMetaView('militia')} onCharter={() => setMetaView('charter')} />
        ) : screen === 'hub' && metaView === 'militia' ? (
          <MilitiaScreen onDone={() => setMetaView(beforeMilitia.current)} />
        ) : (
          <PageScreen ctx={ctx} offers={offers} {...metaCopy} />
        )}
        <Announcer />
        <ReceiptToast />
      </div>
    )
  }

  // Phase 2: a live wave collapses the Detail band into the wave strip and
  // hands the Stage its height; a selection re-opens it (`useBattleLayout`).
  const cls = ['shell', battle.collapsed ? 'is-collapsed' : '', battle.peek ? 'is-peek' : ''].filter(Boolean).join(' ')

  return (
    <div className={cls} data-battle={battle.layout}>
      <HeaderBand />
      {/* First-run teaching, in its own grid row so it never covers the Stage
          and never shifts a control (WS9). Renders nothing once taught. */}
      <Coach />
      <StageBand ctx={ctx} />
      {/* No `ctx`: this band is the party row — except after a cleared normal
          wave, when the reward hand joins it (G3-2), which is what `offers`
          is for. The old offers branch was unreachable — see the note in
          SelectorBand.tsx and the invariant in context.ts. */}
      <SelectorBand offers={offers} />
      <DetailBand offers={offers} />
      {/* Keyboard shortcuts + the "?" sheet (Phase 4). The button shows only
          to a fine pointer; the keys work on any keyboard. */}
      <Shortcuts />
      <Announcer />
      <ReceiptToast />
    </div>
  )
}
