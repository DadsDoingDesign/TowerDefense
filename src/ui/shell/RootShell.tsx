import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useGameStore } from '../../state/gameStore'
import { assertRarityTokensMatch } from '../channels'
import { DetailBand } from './DetailBand'
import { HeaderBand } from './HeaderBand'
import { SelectorBand } from './SelectorBand'
import { StageBand } from './StageBand'
import { PageScreen } from './PageScreens'
import { MenuScreen } from './MenuScreen'
import { MilitiaScreen } from './MilitiaScreen'
import { LiveryScreen } from './company/LiveryScreen'
import { StandingsScreen } from './war/StandingsScreen'
import { SeasonEndScreen } from './war/SeasonEndScreen'
import type { CompanyId } from '../../game/data/companies'
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
import '../../styles/battle-band.css'
import '../../styles/contracts.css'
import '../../styles/pick.css'
import '../../styles/shop.css'
import '../../styles/stops.css'
import '../../styles/liaisons.css'
import '../../styles/menu.css'
import '../../styles/hq.css'
import '../../styles/charter.css'
import '../../styles/war.css'
import '../../styles/worlds.css'
import { useLevelUpTracker } from './levelUps'
import { useMenuStaged, useReveal, useStagingRecorder } from './staging'
import { useMetaStore } from '../../state/metaStore'
import { charterDoor } from '../../game/run/charter'
import { useTrackLink } from './company/trackLink'
import { useCompanyTheme } from '../theme/useCompanyTheme'

/*
 * The hub's sub-pages load as their own chunks (Lane 4.3). None of them is the
 * first screen — that is the menu, or a battle on a resumed run — so the entry
 * script no longer carries them, and the first paint is that much sooner on a
 * slow link. The service worker precaches every chunk Rollup emits
 * (`build/pwa.ts`: the critical set), so they still open offline.
 *
 * They are fetched on idle right after the first screen is up (`usePagePrefetch`),
 * so a tap almost never waits on one, and an open tab never asks the network for
 * a chunk a newer deploy has since replaced.
 */
const PAGES = {
  result: () => import('./contracts/ContractResult'),
  contracts: () => import('./contracts/ContractsScreen'),
  city: () => import('./contracts/CityScreen'),
  hq: () => import('./hq/HqScreen'),
  crates: () => import('./hq/CratesScreen'),
  charter: () => import('./charter/CharterScreen'),
  codex: () => import('./codex/CodexScreen'),
  track: () => import('./company/TrackScreen'),
}
const ResultScreen = lazy(() => PAGES.result().then((m) => ({ default: m.ResultScreen })))
const ContractsScreen = lazy(() => PAGES.contracts().then((m) => ({ default: m.ContractsScreen })))
const CityScreen = lazy(() => PAGES.city().then((m) => ({ default: m.CityScreen })))
const HqScreen = lazy(() => PAGES.hq().then((m) => ({ default: m.HqScreen })))
const CratesScreen = lazy(() => PAGES.crates().then((m) => ({ default: m.CratesScreen })))
const CharterScreen = lazy(() => PAGES.charter().then((m) => ({ default: m.CharterScreen })))
const CodexScreen = lazy(() => PAGES.codex().then((m) => ({ default: m.CodexScreen })))
const TrackScreen = lazy(() => PAGES.track().then((m) => ({ default: m.TrackScreen })))

/** Warm every lazy page once, when the browser is next idle after mount. */
function usePagePrefetch(): void {
  useEffect(() => {
    const run = () => {
      for (const load of Object.values(PAGES)) load().catch(() => {})
    }
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout: 4000 })
      return () => w.cancelIdleCallback?.(id)
    }
    const t = window.setTimeout(run, 1500)
    return () => window.clearTimeout(t)
  }, [])
}

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
  codex: { title: 'Codex', subtitle: 'Every item, skill, goblin, relic and feat your militia has found.' },
  settings: { title: 'Settings', subtitle: 'Audio, motion, contrast, scale, colour vision, assist and tips.' },
  militia: { title: 'Your militia' },
  livery: {},
  war: {},
  track: {},
}

export function RootShell() {
  const ctx = useShellContext()
  // The whole UI wears the company the game is with (Oct 2026): the focused
  // road at home, the hiring company through a run (`ui/theme`).
  useCompanyTheme()
  const screen = useGameStore((s) => s.screen)
  const shellSelect = useGameStore((s) => s.shellSelect)
  // Your militia is founded when the Sovereign Route opens — the full run,
  // where you raise your own trade road (Oct 2026; the designer: "not have a
  // user pick their own company stuff until they unlock the full run … at the
  // start let's just get into the gameplay loop").
  const militia = useMetaStore((s) => s.militia)
  const skills = useMetaStore((s) => s.skills)
  const items = useMetaStore((s) => s.items)
  const charterOpen = useMemo(() => charterDoor({ skills, items: items ?? [] }).open, [skills, items])
  const [metaView, setMetaView] = useState<MetaView>('menu')
  // The company whose standard the livery panel dresses (Draft 4 § C).
  const [liveryOf, setLiveryOf] = useState<CompanyId | null>(null)
  // The company whose loyalty track the track page shows (Draft 4 · B).
  const [trackOf, setTrackOf] = useState<CompanyId | null>(null)
  // The receipt's standing card asks for a track from outside the hub: open it
  // once the run is back at the hub.
  const wantTrack = useTrackLink((s) => s.want)
  // The banner picker returns to where it was opened from (the menu's tip, or Settings).
  const beforeMilitia = useRef<MetaView>('menu')
  useEffect(() => {
    if (metaView !== 'militia') beforeMilitia.current = metaView
  }, [metaView])
  const offers = useOffers(metaView, setMetaView)
  useEffect(() => {
    if (!wantTrack || screen !== 'hub' || ctx.stage === 'result') return
    setTrackOf(wantTrack)
    setMetaView('track')
    useTrackLink.getState().clear()
  }, [wantTrack, screen, ctx.stage])
  const battle = useBattleLayout()
  // G3-2: level-ups from a normal wave wait on the roster, not in a modal.
  useLevelUpTracker()
  // LS3: latch every idea the player meets, on every screen.
  useStagingRecorder()
  // LS3: the HQ and the sealed crates open after the first finished contract.
  const menuStaged = useMenuStaged()
  const reveal = useReveal()
  const metaCopy = META_COPY[metaView]
  // The trade war (Draft 4 § D): a season that just ended is read at home before anything else.
  const seasonEnd = useMetaStore((s) => s.season.ended)
  usePagePrefetch()

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
        {/* While a page chunk is still on its way, the page frame stays up and
            empty — no spinner to flash, nothing to shift when it lands. */}
        <Suspense fallback={null}>
          {ctx.stage === 'result' ? (
            <ResultScreen />
          ) : ctx.stage === 'contracts' ? (
            <ContractsScreen />
          ) : ctx.stage === 'city' ? (
            <CityScreen />
          ) : screen === 'hub' && seasonEnd && !menuStaged ? (
            <SeasonEndScreen end={seasonEnd} />
          ) : screen === 'hub' && metaView === 'war' && !menuStaged && reveal.war ? (
            <StandingsScreen onBack={() => setMetaView('menu')} />
          ) : screen === 'hub' && metaView === 'hq' && !menuStaged && reveal.hq ? (
            <HqScreen onBack={() => setMetaView('menu')} />
          ) : screen === 'hub' && metaView === 'crates' && !menuStaged && reveal.crates ? (
            <CratesScreen onBack={() => setMetaView('menu')} />
          ) : screen === 'hub' && metaView === 'charter' && !menuStaged && charterOpen && !militia ? (
            // The Sovereign Route is your own road: found your militia — its
            // name and its flag — first, then its charter.
            <MilitiaScreen mode="create" onBack={() => setMetaView('menu')} onDone={() => setMetaView('charter')} />
          ) : screen === 'hub' && metaView === 'charter' && !menuStaged ? (
            <CharterScreen onBack={() => setMetaView('menu')} />
          ) : screen === 'hub' && metaView === 'codex' ? (
            <CodexScreen onBack={() => setMetaView('menu')} />
          ) : isMenu ? (
            <MenuScreen
              offers={offers}
              onMilitia={() => setMetaView('militia')}
              onCharter={() => setMetaView('charter')}
              onLivery={(c) => (setLiveryOf(c), setMetaView('livery'))}
              onWar={() => setMetaView('war')}
              onTrack={(c) => (setTrackOf(c), setMetaView('track'))}
            />
          ) : screen === 'hub' && metaView === 'livery' && liveryOf && !menuStaged ? (
            <LiveryScreen company={liveryOf} onDone={() => setMetaView('menu')} />
          ) : screen === 'hub' && metaView === 'track' && trackOf && !menuStaged ? (
            <TrackScreen company={trackOf} onBack={() => setMetaView('menu')} />
          ) : screen === 'hub' && metaView === 'militia' ? (
            <MilitiaScreen onDone={() => setMetaView(beforeMilitia.current)} />
          ) : (
            <PageScreen ctx={ctx} offers={offers} {...metaCopy} />
          )}
        </Suspense>
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
      {/* First-run teaching floats over the Stage's edge as a hint pill
          (`Coach`, rendered by `StageBand`): no row of its own, so the Stage
          keeps one box for the whole battle. */}
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
