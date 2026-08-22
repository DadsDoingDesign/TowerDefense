import type { ReactNode } from 'react'
import { useGameStore } from '../../state/gameStore'
import { rarityVar } from '../channels'
import { ItemCard } from './ItemCard'

/** Wave-clear summary (over the battle screen). Run win/loss lives in RunEndOverlay. */
export function ResultOverlay() {
  const screen = useGameStore((s) => s.screen)
  const mode = useGameStore((s) => s.mode)
  const lives = useGameStore((s) => s.lives)
  const runPhase = useGameStore((s) => s.runPhase)
  const lastResult = useGameStore((s) => s.lastResult)
  const roster = useGameStore((s) => s.roster)
  const currentWave = useGameStore((s) => s.currentWave)
  const evolutionQueue = useGameStore((s) => s.evolutionQueue)
  const lastLoot = useGameStore((s) => s.lastLoot)
  const continueAfterWave = useGameStore((s) => s.continueAfterWave)
  const reward = useGameStore((s) => s.reward)
  const chooseReward = useGameStore((s) => s.chooseReward)

  const nameOf = (id: string) => roster.find((r) => r.id === id)?.name ?? '—'

  // Show once evolutions are resolved. Campaign only shows on a clear (a loss is
  // run-ending); endless also shows a "wave lost" summary when a life remains.
  const cleared = lastResult?.status === 'cleared'
  const endlessSurvivedLoss = mode === 'endless' && lastResult?.status === 'defeated'
  if (
    runPhase !== 'active' ||
    screen !== 'battle' ||
    !lastResult ||
    evolutionQueue.length > 0 ||
    (!cleared && !endlessSurvivedLoss)
  ) {
    return null
  }

  const title = cleared
    ? currentWave?.isBoss
      ? 'Boss Defeated'
      : 'Encounter Cleared'
    : 'Wave Lost'
  const continueLabel = mode === 'endless' ? 'Continue' : 'Return to Map'

  return (
    <div className="overlay-scrim">
      <div className={`overlay-card ${cleared ? 'clear' : 'loss'}`}>
        <h2>{title}</h2>
        {endlessSurvivedLoss && (
          <p className="life-lost">The base fell — a life was lost. {lives} remaining.</p>
        )}
        <div className="summary-line">
          <span>Gold earned</span>
          <strong>⟡ {lastResult.goldEarned}</strong>
        </div>
        <div className="summary-line">
          <span>Base integrity</span>
          <strong>
            {/* Both numbers arrive whole from the engine and reconcile by
                construction (`startBaseHp − leakDamage + healed`), so rounding
                them again here is what produced "19 left (−2)" against a
                20-HP base. `leakDamage` is also the honest name for what this
                line has always meant (F2). */}
            {lastResult.baseHpLeft} left {lastResult.leakDamage > 0 && `(−${lastResult.leakDamage})`}
          </strong>
        </div>
        {lastLoot.length > 0 && (
          <div className="summary-line">
            <span>Loot found</span>
            <strong className="loot-names">
              {lastLoot.map((it, i) => (
                <span key={it.id} style={{ color: rarityVar(it.rarity) }}>
                  {it.name}
                  {i < lastLoot.length - 1 ? ', ' : ''}
                </span>
              ))}
            </strong>
          </div>
        )}
        <div className="summary-table">
          {lastResult.perSentinel
            .filter((p) => p.kills > 0 || p.damageDealt > 0)
            .sort((a, b) => b.damageDealt - a.damageDealt)
            .map((p) => (
              <div key={p.id} className={`summary-row ${p.downed ? 'downed' : ''}`}>
                <span className="sr-name">
                  {nameOf(p.id)}
                  {p.downed && <span className="sr-down"> ✕</span>}
                </span>
                <span className="sr-kills">{p.kills} kills</span>
                <span className="sr-dmg">{p.damageDealt} dmg</span>
                <span className="sr-xp">+{p.xpGained} xp</span>
              </div>
            ))}
        </div>
        {reward ? (
          <div className="reward-pick">
            <span className="reward-title">Choose one reward</span>
            <div className="reward-cards">
              {reward.map((c) => (
                <button key={c.id} className={`reward-card kind-${c.kind}`} onClick={() => chooseReward(c.id)}>
                  {c.kind === 'item' && c.item ? (
                    <ItemCard item={c.item} />
                  ) : (
                    <div className="reward-stat">
                      <span className="rs-tag">Attribute</span>
                      <span className="rs-title">{c.title}</span>
                      <span className="rs-desc">{c.desc}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button className="overlay-btn" onClick={continueAfterWave}>
            {continueLabel}
          </button>
        )}
      </div>
    </div>
  )
}

export function Overlay({
  tone,
  children,
}: {
  tone: 'win' | 'loss' | 'clear'
  children: ReactNode
}) {
  return (
    <div className="overlay-scrim">
      <div className={`overlay-card ${tone}`}>{children}</div>
    </div>
  )
}
