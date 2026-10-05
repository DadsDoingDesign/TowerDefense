import { skillById, skillLevelLabel } from '../../game/data/skills'
import { MAX_SKILLS, nextMilestone, pendingMilestone } from '../../game/run/skills'
import type { Sentinel } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import { Icon } from '../Icon'
import { takeUp, waveLive } from './levelUps'

/**
 * The hero's Skills tab (SK1): what it holds, what it is owed, what is next.
 *
 * Skills are the one way a hero grows, so the tab is short and plain: up to
 * three skills, each with its level and its one sentence; a choice waiting
 * (with the way back to it, between rounds); and the hero level the next offer
 * arrives at. The tab's layout belongs to the shell — this is only the body.
 */
export function SkillPanel({ hero }: { hero: Sentinel }) {
  const live = useGameStore(waveLive)
  const held = (hero.skills ?? []).map((id) => skillById(id)).filter((k) => !!k)
  const owed = pendingMilestone(hero)
  const next = nextMilestone(hero)
  return (
    <>
      <p className="sh-line muted head">
        Skills · {held.length}/{MAX_SKILLS}
      </p>
      {/* What is owed (or next) leads: on a phone the tab is ~150px tall, and
          "choose it when this wave is over" must not sit under the fold. */}
      {owed ? (
        <div className="sh-upgblock">
          <p className="sh-line accent">
            <Icon name="boon" /> Level {owed.level}: a {skillLevelLabel(owed.tier)} skill to choose.
          </p>
          {live ? (
            <p className="sh-line muted">Choose it when this wave is over.</p>
          ) : (
            <button
              className="sh-btn small"
              // The Context panel shows the choice again on its own (it reads `later`).
              onClick={() => takeUp(hero.id)}
            >
              Choose now
            </button>
          )}
        </div>
      ) : next ? (
        <p className="sh-line muted">
          <Icon name="boon" /> Next skill at level {next.level} — a choice of three {skillLevelLabel(next.tier)} skills.
        </p>
      ) : (
        <p className="sh-line muted">
          <Icon name="boon" /> All three skill choices made.
        </p>
      )}
      {held.map((k) => (
        <div className="sh-upgblock" key={k.id}>
          <div className="sh-upg">
            <div className="sh-upg-head">
              <strong>{k.name}</strong>
              <span className="sh-line muted">{skillLevelLabel(k.level)}</span>
            </div>
          </div>
          <p className="sh-line">{k.desc}</p>
        </div>
      ))}
      {held.length === 0 && <p className="sh-line muted">No skills yet.</p>}
    </>
  )
}
