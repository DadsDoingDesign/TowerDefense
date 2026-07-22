import { BattleCanvas } from '../BattleCanvas'
import { BattleControls } from '../components/BattleControls'
import { EquipModal } from '../components/EquipModal'
import { EvolutionModal } from '../components/EvolutionModal'
import { ResultOverlay } from '../components/ResultOverlay'
import { Roster } from '../components/Roster'
import { SentinelDetail } from '../components/SentinelDetail'
import { TopBar } from '../components/TopBar'
import { WavePreview } from '../components/WavePreview'
import { useGameStore } from '../../state/gameStore'

export function BattleScreen() {
  const phase = useGameStore((s) => s.phase)
  const isSetup = phase === 'setup'

  return (
    <div className="battle-screen">
      <TopBar />

      <div className="battle-body">
        <BattleCanvas />

        <aside className="side-panel">
          {isSetup && <WavePreview />}
          <Roster />
        </aside>
      </div>

      <BattleControls />
      <EvolutionModal />
      <ResultOverlay />
      <SentinelDetail />
      <EquipModal />
    </div>
  )
}
