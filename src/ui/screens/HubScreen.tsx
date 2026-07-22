import { useGameStore } from '../../state/gameStore'
import { UPGRADES, useMetaStore } from '../../state/metaStore'

export function HubScreen() {
  const watchMarks = useMetaStore((s) => s.watchMarks)
  const stats = useMetaStore((s) => s.stats)
  const sacrificeTier = useMetaStore((s) => s.sacrificeTier)
  const newRun = useGameStore((s) => s.newRun)
  const startEndless = useGameStore((s) => s.startEndless)

  return (
    <div className="hub-screen">
      <header className="hub-header">
        <div className="hub-brand">
          <span className="brand">FIELDWATCH</span>
          <span className="hub-sub">The Watchtower</span>
        </div>
        <span className="marks-chip">✦ {watchMarks} Marks</span>
      </header>

      <div className="hub-body">
        <section className="hub-stats">
          <StatCard label="Best Depth" v={stats.bestDepth} />
          <StatCard label="Enemies Defeated" v={stats.totalKills} />
          <StatCard label="Sentinels Lost" v={stats.sentinelsLost} />
          <StatCard label="Runs Completed" v={stats.runsCompleted} />
          <StatCard label="Runs Won" v={stats.runsWon} />
          <StatCard label="Sacrifice Tier" v={sacrificeTier} accent />
        </section>

        <section className="hub-section">
          <h2>Watchtower Upgrades</h2>
          <p className="hub-note">Permanent bonuses applied to every future run.</p>
          <div className="upgrade-list">
            {UPGRADES.map((u) => (
              <UpgradeRow key={u.id} id={u.id} />
            ))}
          </div>
        </section>

        <section className="hub-section">
          <h2>Dark Sacrifice</h2>
          <SacrificePanel />
        </section>
      </div>

      <footer className="hub-footer hub-footer-modes">
        <button className="start-run-btn" onClick={newRun}>
          Begin Run ▶
        </button>
        <button className="endless-run-btn" onClick={startEndless}>
          Endless Watch ∞
        </button>
      </footer>
    </div>
  )
}

function StatCard({ label, v, accent }: { label: string; v: number; accent?: boolean }) {
  return (
    <div className={`hub-stat ${accent ? 'accent' : ''}`}>
      <span className="hs-val">{v}</span>
      <span className="hs-label">{label}</span>
    </div>
  )
}

function UpgradeRow({ id }: { id: string }) {
  const u = UPGRADES.find((x) => x.id === id)!
  const level = useMetaStore((s) => s.upgrades[id] ?? 0)
  const watchMarks = useMetaStore((s) => s.watchMarks)
  const cost = useMetaStore((s) => s.upgradeCost(id))
  const buy = useMetaStore((s) => s.buyUpgrade)

  const maxed = level >= u.maxLevel
  const afford = watchMarks >= cost

  return (
    <div className="upgrade-row">
      <div className="ur-info">
        <div className="ur-title">
          <strong>{u.name}</strong>
          <span className="ur-level">
            {level}/{u.maxLevel}
          </span>
        </div>
        <span className="ur-desc">{u.desc}</span>
        <div className="ur-pips">
          {Array.from({ length: u.maxLevel }, (_, i) => (
            <span key={i} className={`ur-pip ${i < level ? 'on' : ''}`} />
          ))}
        </div>
      </div>
      <button
        className="ur-buy"
        disabled={maxed || !afford}
        onClick={() => buy(id)}
      >
        {maxed ? 'Maxed' : `✦ ${cost}`}
      </button>
    </div>
  )
}

function SacrificePanel() {
  const tier = useMetaStore((s) => s.sacrificeTier)
  const cost = useMetaStore((s) => s.sacrificeCost())
  const watchMarks = useMetaStore((s) => s.watchMarks)
  const doSacrifice = useMetaStore((s) => s.doSacrifice)

  return (
    <div className="sacrifice-panel">
      <p className="hub-note">
        Trade this run's safety for greater power. Each tier permanently grants{' '}
        <strong>+1 to all starting stats</strong> and <strong>+10% Watch Marks</strong>, but every
        future enemy gains <strong>+15% HP</strong>.
      </p>
      <div className="sacrifice-row">
        <div className="sr-tier">
          <span className="srt-val">Tier {tier}</span>
          <span className="srt-label">
            +{tier} stats · +{tier * 10}% marks · +{tier * 15}% enemy HP
          </span>
        </div>
        <button
          className="sacrifice-btn"
          disabled={watchMarks < cost}
          onClick={doSacrifice}
        >
          Sacrifice ✦ {cost}
        </button>
      </div>
    </div>
  )
}
