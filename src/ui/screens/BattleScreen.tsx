import { BattleCanvas } from '../BattleCanvas'
import { BattleControls } from '../components/BattleControls'
import { EvolutionModal } from '../components/EvolutionModal'
import { ResultOverlay } from '../components/ResultOverlay'
import { Roster } from '../components/Roster'
import { TopBar } from '../components/TopBar'
import { WavePreview } from '../components/WavePreview'
import { useGameStore } from '../../state/gameStore'

export function BattleScreen() {
  const battlePhase = useGameStore((s) => s.battlePhase)
  const isSetup = battlePhase === 'setup'

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
    </div>
  )
}
