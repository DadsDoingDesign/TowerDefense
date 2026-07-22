import { ENEMY_TYPES } from '../../game/data/enemies'
import { generateWave, waveComposition } from '../../game/data/waves'
import { useGameStore } from '../../state/gameStore'

export function WavePreview() {
  const waveIndex = useGameStore((s) => s.waveIndex)
  const wave = generateWave(waveIndex)
  const comp = waveComposition(wave)
  const total = wave.spawns.length

  return (
    <div className="wave-preview">
      <div className="panel-head">
        <span>{wave.isBoss ? '☠ Boss Wave' : 'Incoming Wave'}</span>
        <span className="hint">{total} enemies</span>
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
