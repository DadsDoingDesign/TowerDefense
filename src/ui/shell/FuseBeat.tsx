import { useEffect, type CSSProperties } from 'react'
import { fusedById, skillById, skillHeadline } from '../../game/data/skills'
import { fxLevel } from '../../game/render/fxQuality'
import { sfxFusion } from '../../audio/audio'
import { Icon } from '../Icon'
import { elementVar, endFuseBeat, fuseBeatPlan, useFuseBeat } from './fuseBeat'
import '../../styles/fusion.css'

/**
 * The fuse beat (skill fusion, Oct 2026): for a moment the Context panel IS
 * the fusion — the two part cards slide in from its sides and slam together,
 * a flash in the fusion's element colour, and the fused card settles with its
 * name and twist. Then it hands back to the hero's card, where the fusion sits
 * in its slot. A tap skips it. Timings are `fuseBeat.fuseBeatPlan`: lighter on
 * the Light effects setting, and still — no motion at all — under reduced
 * motion. The cue (`audio.sfxFusion`) lands on the slam.
 *
 * Its one job (DESIGN_SYSTEM § 8): to say "these two became this one". It
 * holds no choice and no control but the skip.
 */
export function FuseBeat() {
  const show = useFuseBeat((s) => s.show)
  const level = fxLevel()
  const plan = fuseBeatPlan(level)
  useEffect(() => {
    if (!show) return
    sfxFusion(plan.moves ? plan.slideMs / 1000 : 0)
    const t = window.setTimeout(endFuseBeat, Math.max(0, plan.totalMs - (Date.now() - show.at)))
    return () => window.clearTimeout(t)
    // One beat per show: its `at` keys it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show?.at])
  if (!show) return null
  const into = fusedById(show.fusionId)
  const [a, b] = show.parts.map((id) => skillById(id))
  if (!into || !a || !b) return null
  const vars = {
    ...elementVar(into),
    '--fz-slide': `${plan.slideMs}ms`,
    '--fz-flash': `${plan.flashMs}ms`,
    '--fz-settle': `${plan.settleMs}ms`,
  } as CSSProperties
  return (
    <div className="sh-context fz-beat" data-fz={level} style={vars} onClick={endFuseBeat} role="status" aria-live="polite">
      <div className="fz-stage">
        <div className="fz-part a" aria-hidden="true">
          <Icon name={skillHeadline(a).icon} lg />
          <b>{a.name}</b>
        </div>
        <div className="fz-part b" aria-hidden="true">
          <Icon name={skillHeadline(b).icon} lg />
          <b>{b.name}</b>
        </div>
        {plan.flashMs > 0 && <div className="fz-flash" aria-hidden="true" />}
        <div className="fz-result">
          <span className="fz-result-art" aria-hidden="true">
            <Icon name={into.icon} lg />
          </span>
          <span className="fz-result-text">
            <span className="fz-kicker">
              {a.name} + {b.name}
            </span>
            <strong>{into.name}</strong>
            <span className="fz-result-twist">{into.twist}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
