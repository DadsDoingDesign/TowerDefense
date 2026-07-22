import { buildName } from '../../game/engine/leveling'
import { MAX_BASE_HP, useGameStore } from '../../state/gameStore'
import { MerchantModal } from '../components/MerchantModal'
import { RecruitModal } from '../components/RecruitModal'
import { ShrineModal } from '../components/ShrineModal'
import { RunMapView } from '../components/RunMapView'

const GLYPH: Record<string, string> = { fighter: '⚔', rogue: '✦', mystic: '❋' }

export function RunMapScreen() {
  const roster = useGameStore((s) => s.roster)
  const baseHp = useGameStore((s) => s.baseHp)
  const gold = useGameStore((s) => s.gold)
  const inventory = useGameStore((s) => s.inventory)
  const evolutionQueue = useGameStore((s) => s.evolutionQueue)
  const runMap = useGameStore((s) => s.runMap)
  const cleared = useGameStore((s) => s.clearedNodeIds)
  const openDetail = useGameStore((s) => s.openDetail)

  const depth = cleared.length - 1
  const hpFrac = Math.max(0, baseHp) / MAX_BASE_HP

  return (
    <div className="run-map-screen">
      <header className="map-header">
        <div className="mh-left">
          <span className="brand">FIELDWATCH</span>
          <span className="wave-chip">
            Depth {depth}/{runMap.layers - 1}
          </span>
        </div>
        <div className="mh-right">
          <span className="mh-base" title="Base integrity">
            ⬡ {Math.ceil(baseHp)}/{MAX_BASE_HP}
            <span className="mh-hp-bar">
              <span
                className="mh-hp-fill"
                style={{
                  width: `${hpFrac * 100}%`,
                  background: hpFrac > 0.5 ? '#7ac74f' : hpFrac > 0.25 ? '#e6b800' : '#e05a4f',
                }}
              />
            </span>
          </span>
          <span className="gold-chip">⟡ {gold}</span>
        </div>
      </header>

      <div className="map-hint">Choose your next path — each node is a decision.</div>

      <RunMapView />

      <div className="map-roster">
        <div className="mr-scroll">
          {roster.map((s) => (
            <button key={s.id} className="mr-chip" onClick={() => openDetail(s.id)} style={{ borderColor: s.color }}>
              <span className="mr-glyph" style={{ background: s.color }}>
                {GLYPH[s.archetype]}
              </span>
              <span className="mr-text">
                <span className="mr-name">
                  {s.name}
                  {evolutionQueue.includes(s.id) && <span className="evolve-dot"> ★</span>}
                </span>
                <span className="mr-build">
                  {buildName(s)} · Lv {s.level}
                </span>
              </span>
            </button>
          ))}
          <div className="mr-bag" title="Items in inventory">
            🎒 {inventory.length}
          </div>
        </div>
      </div>

      <MerchantModal />
      <ShrineModal />
      <RecruitModal />
    </div>
  )
}
