import { useState } from 'react'
import { BattleCanvas } from '../BattleCanvas'
import { BattleControls } from '../components/BattleControls'
import { EvolutionModal } from '../components/EvolutionModal'
import { ResultOverlay } from '../components/ResultOverlay'
import { Roster } from '../components/Roster'
import { TacticsPanel } from '../components/TacticsPanel'
import { TopBar } from '../components/TopBar'
import { WavePreview } from '../components/WavePreview'
import { useGameStore } from '../../state/gameStore'

type HudTab = 'squad' | 'tactics' | 'wave'

export function BattleScreen() {
  const battlePhase = useGameStore((s) => s.battlePhase)
  const roster = useGameStore((s) => s.roster)
  const isSetup = battlePhase === 'setup'
  const [tab, setTab] = useState<HudTab>('squad')

  const tabs: { id: HudTab; label: string }[] = [
    { id: 'squad', label: `Squad · ${roster.length}` },
    { id: 'tactics', label: 'Tactics' },
    { id: 'wave', label: 'Wave' },
  ]

  return (
    <div className={`battle-screen ${isSetup ? 'setup' : 'live'}`}>
      <TopBar />

      <div className="battle-body">
        <BattleCanvas />

        <aside className="side-panel">
          {isSetup ? (
            <>
              {/* Tabbed on mobile (one panel at a time); all shown on wide screens. */}
              <div className="hud-tabs">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    className={`hud-tab ${tab === t.id ? 'active' : ''}`}
                    data-sfx="toggle"
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className={`hud-panel ${tab === 'wave' ? 'show' : ''}`}>
                <WavePreview />
              </div>
              <div className={`hud-panel ${tab === 'tactics' ? 'show' : ''}`}>
                <TacticsPanel />
              </div>
              <div className={`hud-panel ${tab === 'squad' ? 'show' : ''}`}>
                <Roster />
              </div>
            </>
          ) : (
            <Roster />
          )}
        </aside>
      </div>

      <BattleControls />
      <EvolutionModal />
      <ResultOverlay />
    </div>
  )
}
