import { useEffect, type CSSProperties } from 'react'
import { mergedById, skillById } from '../../game/data/skills'
import { mergeLayers } from '../../game/data/skillIcons'
import { fxLevel } from '../../game/render/fxQuality'
import { sfxFusion } from '../../audio/audio'
import { PixelIcon, pixelsUrl, SkillIcon } from '../SkillIcon'
import { elementVar, endFuseBeat, fuseBeatPlan, useFuseBeat } from './fuseBeat'
import '../../styles/fusion.css'

/**
 * The fuse beat (merging, Oct 2026): for a moment the Context panel IS the
 * merge — the base (the held skill, from the left) and the card poured into
 * it (from the right) slide in and slam together, a flash in the merge's
 * element colour, and the merged card settles with its name and its rule or
 * twist (a named merge says it is one). Then it hands back to the hero's
 * card, where the merge sits in its slot. A tap skips it. Timings are `fuseBeat.fuseBeatPlan`: lighter on
 * the Light effects setting, and still — no motion at all — under reduced
 * motion. The cue (`audio.sfxFusion`) lands on the slam.
 *
 * Inside the settling card the picture MAKES itself (the merge art pass,
 * `skillIcons.mergeLayers`): the base's picture stands, the card's motif
 * flies onto its corner, and the base's colours pour over into the card's
 * element as it lands — exactly the composite the slot will hold. A named
 * merge: the card flies into the base and the new hand-drawn picture comes
 * in. Under reduced motion only the finished picture shows.
 *
 * Its one job (DESIGN_SYSTEM § 8): to say "this poured into that made this". It
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
  const into = mergedById(show.fusionId)
  const [a, b] = show.parts.map((id) => skillById(id))
  if (!into || !a || !b) return null
  const vars = {
    ...elementVar(into),
    '--fz-slide': `${plan.slideMs}ms`,
    '--fz-flash': `${plan.flashMs}ms`,
    '--fz-settle': `${plan.settleMs}ms`,
    '--fz-fly-at': `${plan.flyAtMs}ms`,
    '--fz-fly': `${plan.flyMs}ms`,
    '--fz-swap-at': `${plan.swapAtMs}ms`,
    '--fz-swap': `${plan.swapMs}ms`,
  } as CSSProperties
  return (
    <div className="sh-context fz-beat" data-fz={level} style={vars} onClick={endFuseBeat} role="status" aria-live="polite">
      <div className="fz-stage">
        <div className="fz-part a" aria-hidden="true">
          <SkillIcon id={a.id} lg />
          <b>{a.name}</b>
        </div>
        <div className="fz-part b" aria-hidden="true">
          <SkillIcon id={b.id} lg />
          <b>{b.name}</b>
        </div>
        {plan.flashMs > 0 && <div className="fz-flash" aria-hidden="true" />}
        <div className="fz-result">
          <span className="fz-result-art" aria-hidden="true">
            {plan.moves ? <MergeArt id={into.id} /> : <SkillIcon id={into.id} lg />}
          </span>
          <span className="fz-result-text">
            <span className="fz-kicker">
              {a.name} ← {b.name}
            </span>
            <strong>
              {into.name}
              {into.named && <span className="sk-star"> ★</span>}
            </strong>
            <span className="fz-result-twist">{into.twist || into.lines[into.lines.length - 1]}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * The merge's picture as it makes itself: three stacked 32 px layers that end
 * as the merged picture (`to` with `fly` over it is it, pixel for pixel).
 * Falls back to the finished picture where there is no canvas.
 */
function MergeArt({ id }: { id: string }) {
  const layers = mergeLayers(id)
  const from = layers && pixelsUrl(`${id}:from`, () => layers.from)
  const to = layers && pixelsUrl(`${id}:to`, () => layers.to)
  const fly = layers && pixelsUrl(`${id}:fly`, () => layers.fly)
  if (!layers || !from || !to || !fly) return <SkillIcon id={id} lg />
  return (
    <span className={`fz-morph${layers.named ? ' named' : ''}`} data-skill={id}>
      <PixelIcon url={from} lg className="fz-l-from" />
      <PixelIcon url={to} lg className="fz-l-to" />
      <PixelIcon url={fly} lg className="fz-l-fly" />
    </span>
  )
}
