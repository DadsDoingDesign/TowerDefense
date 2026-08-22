/**
 * The pre-shell screen stack, behind `?shell=0` (H14).
 *
 * These six screens and the modals they own are a **comparison mode**, not the
 * shipping UI — `docs/FIGMA.md` and `CLAUDE.md` both say so, and the Root Shell
 * has replaced every one of them. They still exist because several regression
 * harnesses drive `?shell=0` and because it is the escape hatch if the shell
 * breaks in the field.
 *
 * What they must NOT be is part of every player's first download. `App.tsx`
 * reaches this file through `React.lazy`, so the whole tree — ~2,300 lines of
 * TSX across six screens and twelve legacy-only components — becomes a chunk
 * that is fetched only when the flag actually selects it. The build still emits
 * it, and the service worker still precaches it (see the CRITICAL list in
 * `vite.config.ts`), so `?shell=0` keeps working offline.
 *
 * Everything shared with the shell (the resume prompt, the rotate prompt, the
 * error boundary) stays eager in `App.tsx`: a resume prompt that waits on a
 * chunk is a resume prompt that flashes.
 *
 * **The stylesheet is split too.** `src/styles/app.css` used to be 3,929 lines
 * imported eagerly from `App.tsx` for a UI nobody loads. It is now two files:
 *
 * - `src/styles/app.css` — 400 lines / 10.6 KB, still imported by `App.tsx`,
 *   because the SHELL depends on this much of it: `.app-root`,
 *   `.battle-canvas*` (BattleCanvas, via StageBand), `.overlay-scrim` /
 *   `.overlay-card` and the whole `.evolve-*` / `.eo-*` group (EvolutionModal,
 *   still a blocking modal in the shell), the `.run-map-*` / `.map-node*` /
 *   `.mn-*` group (RunMapView), and three document-wide blocks — the
 *   `@media (pointer: coarse)` 44px tap-target floor,
 *   `:root[data-reduced-motion='true']`, and the `:root[data-contrast='high']`
 *   TOKEN overrides. None of those three exist anywhere else:
 *   `shell.css`/`page.css` only carry `.sh-*`/`.pg-*` variants of the last two
 *   and redefine no tokens, so a lazy high-contrast block would mean high
 *   contrast silently doing nothing in the UI the game ships.
 * - `src/styles/legacy.css` — 3,216 lines / 60.6 KB, imported from HERE, so it
 *   rides this chunk instead of the boot payload.
 *
 * 61 rule blocks (362 lines / 6.6 KB) were referenced by no TSX in the repo and
 * were deleted rather than moved; `legacy.css`'s header lists them.
 */
import { useGameStore } from '../../state/gameStore'
import '../../styles/legacy.css'
import { BattleScreen } from './BattleScreen'
import { CrossroadsScreen } from './CrossroadsScreen'
import { EndlessScreen } from './EndlessScreen'
import { HeroPickScreen } from './HeroPickScreen'
import { HubScreen } from './HubScreen'
import { RunMapScreen } from './RunMapScreen'
import { EquipModal } from '../components/EquipModal'
import { InventoryManager } from '../components/InventoryManager'
import { RunEndOverlay } from '../components/RunEndOverlay'
import { SentinelDetail } from '../components/SentinelDetail'
import { TowerUpgradePanel } from '../components/TowerUpgradePanel'

export default function LegacyApp() {
  const screen = useGameStore((s) => s.screen)
  return (
    <>
      {screen === 'hub' && <HubScreen />}
      {screen === 'heroPick' && <HeroPickScreen />}
      {screen === 'crossroads' && <CrossroadsScreen />}
      {screen === 'map' && <RunMapScreen />}
      {screen === 'endless' && <EndlessScreen />}
      {screen === 'battle' && <BattleScreen />}
      {/* Shared across the legacy screens */}
      <SentinelDetail />
      <EquipModal />
      <TowerUpgradePanel />
      <InventoryManager />
      <RunEndOverlay />
    </>
  )
}
