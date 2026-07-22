import { useGameStore } from './state/gameStore'
import { BattleScreen } from './ui/screens/BattleScreen'
import { RunMapScreen } from './ui/screens/RunMapScreen'
import { EquipModal } from './ui/components/EquipModal'
import { RunEndOverlay } from './ui/components/RunEndOverlay'
import { SentinelDetail } from './ui/components/SentinelDetail'
import './styles/app.css'

export default function App() {
  const screen = useGameStore((s) => s.screen)

  return (
    <div className="app-root">
      {screen === 'map' ? <RunMapScreen /> : <BattleScreen />}
      {/* Shared across screens */}
      <SentinelDetail />
      <EquipModal />
      <RunEndOverlay />
    </div>
  )
}
