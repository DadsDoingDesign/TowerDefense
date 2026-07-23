import { effectiveUpgradeLevels } from '../../game/engine/combat'
import { UPGRADE_PATHS, milestoneForLevel } from '../../game/data/upgradeTree'
import { useGameStore } from '../../state/gameStore'

/**
 * Opened by clicking a placed tower during setup. Shows the tower's three
 * purchasable upgrade paths (three cumulative levels each, unlocked at XP
 * milestones), the free levels its gear/mutations grant, and a Remove action.
 */
export function TowerUpgradePanel() {
  const targetId = useGameStore((s) => s.upgradeTarget)
  const roster = useGameStore((s) => s.roster)
  const placements = useGameStore((s) => s.placements)
  const gold = useGameStore((s) => s.gold)
  const buy = useGameStore((s) => s.buyTowerUpgrade)
  const close = useGameStore((s) => s.closeUpgrade)
  const clearSlot = useGameStore((s) => s.clearSlot)

  if (!targetId) return null
  const s = roster.find((x) => x.id === targetId)
  if (!s) return null

  const effective = effectiveUpgradeLevels(s)
  const slotId = Object.keys(placements).find((id) => placements[id] === s.id)

  return (
    <div className="overlay-scrim" onClick={close}>
      <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <div className="upg-head">
          <div className="upg-title">
            <strong style={{ color: s.color }}>{s.name}</strong>
            <span className="upg-sub">Level {s.level} · Tower Upgrades</span>
          </div>
          <div className="upg-gold">⟡ {gold}</div>
          <button className="detail-close" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="upg-paths">
          {UPGRADE_PATHS.map((path) => {
            const bought = s.upgrades?.[path.id] ?? 0
            const eff = effective[path.id] ?? 0
            // You buy toward the next level above what you already have (free
            // grants fill the lowest levels), so a granted L1 → first buy is L2.
            const nextLevel = eff + 1
            const canBuyMore = eff < path.levels.length
            const nextCost = canBuyMore ? path.levels[nextLevel - 1].cost : 0
            const milestone = canBuyMore ? milestoneForLevel(nextLevel) : 0
            const meetsLevel = s.level >= milestone
            const canAfford = gold >= nextCost
            const buyable = canBuyMore && meetsLevel && canAfford
            return (
              <div className="upg-path" key={path.id}>
                <div className="upg-path-head">
                  <strong>{path.name}</strong>
                  <span className="upg-path-blurb">{path.blurb}</span>
                </div>
                <div className="upg-levels">
                  {path.levels.map((lvl, i) => {
                    const n = i + 1
                    const state = n <= bought ? 'owned' : n <= eff ? 'granted' : 'locked'
                    return (
                      <div className={`upg-level ${state}`} key={i}>
                        <span className="upg-level-pip">{n}</span>
                        <span className="upg-level-desc">{lvl.desc}</span>
                        {state === 'granted' && <span className="upg-tag granted">Free</span>}
                        {state === 'owned' && <span className="upg-tag owned">✓</span>}
                      </div>
                    )
                  })}
                </div>
                {canBuyMore ? (
                  <button className="upg-buy" disabled={!buyable} onClick={() => buy(s.id, path.id)}>
                    {meetsLevel ? `Buy L${nextLevel} · ⟡${nextCost}` : `Unlocks at Lv ${milestone}`}
                  </button>
                ) : (
                  <button className="upg-buy" disabled>
                    Maxed
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="upg-foot">
          {slotId && (
            <button
              className="upg-remove"
              onClick={() => {
                clearSlot(slotId)
                close()
              }}
            >
              Remove from slot
            </button>
          )}
          <button className="upg-done" onClick={close}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
