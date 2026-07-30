import { useEffect } from 'react'
import { sfx, type SoundEvent } from './audio/audio'
import { useGameStore } from './state/gameStore'
import { BattleScreen } from './ui/screens/BattleScreen'
import { CrossroadsScreen } from './ui/screens/CrossroadsScreen'
import { EndlessScreen } from './ui/screens/EndlessScreen'
import { HeroPickScreen } from './ui/screens/HeroPickScreen'
import { HubScreen } from './ui/screens/HubScreen'
import { RunMapScreen } from './ui/screens/RunMapScreen'
import { EquipModal } from './ui/components/EquipModal'
import { InventoryManager } from './ui/components/InventoryManager'
import { RunEndOverlay } from './ui/components/RunEndOverlay'
import { SentinelDetail } from './ui/components/SentinelDetail'
import { TowerUpgradePanel } from './ui/components/TowerUpgradePanel'
import { RootShell } from './ui/shell/RootShell'
import { rootShellEnabled } from './ui/shell/flag'
import './styles/app.css'

const SHELL = rootShellEnabled()

export default function App() {
  const screen = useGameStore((s) => s.screen)

  // One delegated listener gives every button a UI sound. `data-sfx` overrides
  // the sound (or "none" silences it); a few common controls map by class.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest('button, [role="button"]') as HTMLElement | null
      if (!el || (el as HTMLButtonElement).disabled) return
      const ds = el.dataset.sfx
      if (ds === 'none') return
      let ev: SoundEvent = (ds as SoundEvent) || 'click'
      if (!ds) {
        const c = typeof el.className === 'string' ? el.className : ''
        if (c.includes('detail-close')) ev = 'close'
        else if (c.includes('submenu-back')) ev = 'back'
        else if (c.includes('eq-tab') || c.includes('tac-btn') || c.includes('speed-btn') || c.includes('sc-gear-btn')) ev = 'toggle'
      }
      sfx(ev)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  // The Root Shell replaces the whole screen-and-sheet stack, so it is an
  // either/or with the legacy screens rather than something layered on top.
  if (SHELL) {
    return (
      <div className="app-root shell-root">
        <RootShell />
      </div>
    )
  }

  return (
    <div className="app-root">
      {screen === 'hub' && <HubScreen />}
      {screen === 'heroPick' && <HeroPickScreen />}
      {screen === 'crossroads' && <CrossroadsScreen />}
      {screen === 'map' && <RunMapScreen />}
      {screen === 'endless' && <EndlessScreen />}
      {screen === 'battle' && <BattleScreen />}
      {/* Shared across screens */}
      <SentinelDetail />
      <EquipModal />
      <TowerUpgradePanel />
      <InventoryManager />
      <RunEndOverlay />
    </div>
  )
}
