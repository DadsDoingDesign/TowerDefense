import { describeGrant } from '../../game/data/describe'
import { branchLabel, evolutionOptions } from '../../game/engine/leveling'
import { useGameStore } from '../../state/gameStore'

/**
 * Shown after a battle when a Sentinel crossed level 10 or 20 and is owed an
 * evolution choice. Handles the queue one Sentinel at a time.
 */
export function EvolutionModal() {
  const queue = useGameStore((s) => s.evolutionQueue)
  const roster = useGameStore((s) => s.roster)
  const choose = useGameStore((s) => s.chooseEvolution)

  if (queue.length === 0) return null
  const sentinel = roster.find((s) => s.id === queue[0])
  if (!sentinel) return null

  const options = evolutionOptions(sentinel)
  const tier = sentinel.branchPath.length === 1 ? 'Sub-archetype' : 'Specialization'

  return (
    <div className="overlay-scrim">
      <div className="overlay-card evolve">
        <span className="evolve-kicker">✦ {tier} Unlocked</span>
        <h2>{sentinel.name} evolves</h2>
        <p className="evolve-branch">{branchLabel(sentinel)}</p>
        <div className="evolve-options">
          {options.map((node) => (
            <button
              key={node.id}
              className="evolve-option"
              style={{ borderColor: sentinel.color }}
              onClick={() => choose(sentinel.id, node.id)}
            >
              <span className="eo-name">{node.name}</span>
              <span className="eo-ability">{node.ability}</span>
              {node.grant && <span className="eo-grant">{describeGrant(node.grant)}</span>}
            </button>
          ))}
        </div>
        {queue.length > 1 && <p className="evolve-more">{queue.length - 1} more to evolve…</p>}
      </div>
    </div>
  )
}
