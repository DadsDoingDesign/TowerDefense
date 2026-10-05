import { useGameStore } from '../../state/gameStore'
import { leakRows, useBattleLedger } from '../battleLedger'
import { Icon } from '../Icon'

/**
 * "What broke the line" — the cause of a defeat, named (Phase 2, finding 3).
 *
 * The run-end receipt said the Gate fell and how many got through, and never
 * WHICH goblins they were — so a loss taught "lose less" and nothing else. This
 * leads the defeat screen with the answer: the enemy types that reached the
 * Gate, worst first, by Gate damage; the single hardest hit; the wave it
 * happened on; the depth and the seed, so the run can be replayed.
 *
 * The per-type rows come from `battleLedger`, which the battle canvas keeps from
 * the engine's public counters. A run resumed from a save after the fatal wave
 * has no ledger; the card then falls back to the engine's own head count.
 */
export function DefeatReceipt() {
  const recap = useGameStore((s) => s.victory)
  const runSeed = useGameStore((s) => s.runSeed)
  const waveLabel = useGameStore((s) => s.currentWave?.label ?? null)
  const clearedNodeIds = useGameStore((s) => s.clearedNodeIds)
  const ledger = useBattleLedger()
  const ours = ledger.runSeed === runSeed
  const rows = ours ? leakRows(ledger.run).slice(0, 4) : []
  const depth = recap?.depth ?? Math.max(0, clearedNodeIds.length - 1)
  const leaked = recap?.enemiesLeaked ?? rows.reduce((a, r) => a + r.heads, 0)

  return (
    <section className="pg-cause" aria-labelledby="pg-cause-head">
      <h2 className="pg-cause-head" id="pg-cause-head">
        <Icon name="warn" /> What broke the line
      </h2>
      {rows.length > 0 ? (
        <ul className="pg-cause-rows">
          {rows.map((r) => (
            <li key={r.name}>
              <span className="pg-cause-name">{r.name}</span>
              <span className="pg-cause-num">
                ×{r.heads} · {r.damage} Gate
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pg-cause-line">
          {leaked} reached the wagons.
        </p>
      )}
      {ours && ledger.worst && (
        <p className="pg-cause-line">
          Hardest hit: {ledger.worst.name}, {ledger.worst.damage} Gate in one.
        </p>
      )}
      <p className="pg-cause-line muted">
        {waveLabel ? `Last wave: ${waveLabel}` : `Depth ${depth}`} · Seed {runSeed}
      </p>
    </section>
  )
}
