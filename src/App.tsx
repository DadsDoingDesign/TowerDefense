import { useGameStore } from './state/gameStore'
import { BattleScreen } from './ui/screens/BattleScreen'
import { CrossroadsScreen } from './ui/screens/CrossroadsScreen'
import { EndlessScreen } from './ui/screens/EndlessScreen'
import { HeroPickScreen } from './ui/screens/HeroPickScreen'
import { HubScreen } from './ui/screens/HubScreen'
import { RunMapScreen } from './ui/screens/RunMapScreen'
import { EquipModal } from './ui/components/EquipModal'
import { RunEndOverlay } from './ui/components/RunEndOverlay'
import { SentinelDetail } from './ui/components/SentinelDetail'
import { TowerUpgradePanel } from './ui/components/TowerUpgradePanel'
import './styles/app.css'

export default function App() {
  const screen = useGameStore((s) => s.screen)

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
      <RunEndOverlay />
    </div>
  )
}
