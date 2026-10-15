import { ASSISTED_TAG } from '../../game/run/ranking'
import { Icon } from '../Icon'

/**
 * The "Assisted" marker (the gameplay pass, Oct 2026): says that assist was on
 * at some point of this run, so it counts for no leaderboard
 * (`game/run/ranking.countsForRanking`). One part, two places: the HUD's
 * header row while the run is marked, and the run's result page. It says
 * nothing about how well the run was played — Celeste marks an Assist Mode
 * save, Hades says God Mode is on, and neither takes anything away.
 */
export function AssistedTag({ where }: { where: 'hud' | 'result' }) {
  return (
    <span className={`assisted-tag ${where === 'hud' ? 'sh-chip ' : ''}${where}`} role="img" aria-label="Assisted run: it does not count for leaderboards">
      <Icon name="assist" />
      <span aria-hidden="true">{ASSISTED_TAG}</span>
    </span>
  )
}
