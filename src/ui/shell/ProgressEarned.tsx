import { skillById, skillLevelLabel } from '../../game/data/skills'
import { MAX_DIFFICULTY } from '../../game/run/watch'
import type { RunProgress } from '../../state/metaStore'
import { InfoCard } from './Page'
import { SkillCard } from './SkillCards'

/**
 * SK1 — what a finished run did for the Watch's long game, on its receipt:
 * every skill card it unlocked — each as the card itself, under "New skill
 * unlocked", so the reward reads at a glance — then the Watch XP it earned
 * (and any Watch level it reached), and, for a win, whether the difficulty
 * climbed or why the win paid no card. Each line is a plain sentence; the
 * Codex's skill library has the rest.
 */
export function ProgressEarned({ progress: p }: { progress: RunProgress }) {
  const lines: string[] = []
  const up = p.levelAfter - p.levelBefore
  lines.push(up > 0 ? `+${p.xp} Watch XP — Watch level ${p.levelAfter}${up > 1 ? ` (up ${up})` : ''}!` : `+${p.xp} Watch XP — Watch level ${p.levelAfter}`)
  const w = p.win
  if (w) {
    if (w.stepUp) lines.push(`Difficulty raised to ${w.step + 1}. Your next run opens there; you can turn it down.`)
    else if (w.card && w.step >= MAX_DIFFICULTY) lines.push(`A win at difficulty ${w.step}, the top step.`)
    else if (w.card) lines.push(`A new best score at difficulty ${w.step}: ${w.score}.`)
    else lines.push(`No skill for this win: beat your best score at difficulty ${w.step} (${w.best}), or win at your highest difficulty.`)
  }
  const cards = p.cards.map((id) => skillById(id)).filter((k) => !!k)
  return (
    <>
      {cards.length > 0 && (
        <section className="pg-unlocks" aria-label={`${cards.length} new skill${cards.length === 1 ? '' : 's'} unlocked`}>
          {cards.map((k) => (
            <SkillCard key={k.id} kicker="New skill unlocked" skill={{ name: k.name, level: skillLevelLabel(k.level), text: k.desc }} />
          ))}
        </section>
      )}
      <InfoCard lines={lines} />
    </>
  )
}
