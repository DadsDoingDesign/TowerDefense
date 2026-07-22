import { ENEMY_TYPES } from '../../game/data/enemies'
import { waveComposition } from '../../game/data/waves'
import { useGameStore } from '../../state/gameStore'

export function WavePreview() {
  const wave = useGameStore((s) => s.currentWave)
  const mode = useGameStore((s) => s.mode)
  const threat = useGameStore((s) => s.threat)
  if (!wave) return null
  const comp = waveComposition(wave)
  const total = wave.spawns.length
  const showThreat = mode === 'campaign' && threat > 1.001

  return (
    <div className="wave-preview">
      <div className="panel-head">
        <span>{wave.isBoss ? '☠ Boss Wave' : 'Incoming Wave'}</span>
        <span className="hint">
          {total} enemies{showThreat && ` · ⚡×${threat.toFixed(2)} HP`}
        </span>
      </div>
      <div className="wave-enemies">
        {comp.map(({ typeId, count }) => {
          const t = ENEMY_TYPES[typeId]
          return (
            <div key={typeId} className="wave-enemy">
              <span className="we-dot" style={{ background: t.color }} />
              <span className="we-name">{t.name}</span>
              <span className="we-count">×{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
