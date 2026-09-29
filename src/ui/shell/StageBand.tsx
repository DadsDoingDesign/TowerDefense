import { BattleCanvas } from '../BattleCanvas'
import { RunMapView } from '../components/RunMapView'
import type { ShellContext } from './context'

/**
 * Band 2 — the subject. Rule two of the shell: nothing ever covers this. No
 * sheet, no drawer, no scrim. Every "screen" the game used to push is a
 * different subject rendered here.
 *
 * Only the two `bands` contexts reach this band: the battlefield and the run
 * map. The `board`, `title` and `result` stages are all `layout: 'page'` in
 * `useShellContext`, so they render as pages instead — the board card, the
 * title card and the result card that used to live here were unreachable and
 * are gone.
 *
 * ---------------------------------------------------------------------------
 * The wave strip is gone from here, and that is the whole of M1
 * ---------------------------------------------------------------------------
 * This band used to render a `.sh-wave-strip` — wave label, progress bar and
 * the speed toggle — `position: absolute; inset: 0 0 auto 0` over the canvas,
 * on a `rgba(20,12,6,0.72)` scrim. It contained a control at the 44px touch
 * minimum, so it was never a hairline: it stood 54–62px tall depending on UI
 * scale, and it sat on top of the one thing the shell promises never to cover.
 *
 * Measured across the matrix (`rv-occlude.mjs`), as a share of the composed
 * field: 390×844 1.4%, 375×667 23.9%, 360×640 27.9%, 320×568 35.5%, and 40.4%
 * at 320×568 with Large UI. The 390×844 number is the outlier and it is the
 * outlier for a geometric reason — at that aspect the canvas is width-limited
 * and letterboxes, so the strip lands on the black bar above the field. Every
 * other phone makes the canvas height-limited, it rises to the top of the
 * Stage, and the scrim lands on the map. On `kilnroad` that put build slot `s1`
 * (250,60) and the whole top lane at y=120 behind a translucent panel on four
 * of ten matrix cells, including slots the player is being told to tap.
 *
 * Every Phase-3 render was taken at 390×844 — the one viewport whose geometry
 * hides this.
 *
 * The strip's contents have moved to `WaveBar` in band 4, which already renders
 * for every frame of a battle and already reserves its height. Nothing was lost
 * (the label, the progress and the speed toggle are all still on screen, in a
 * band that scrolls with the rest of the panel) and the Stage keeps the whole
 * of its box. No conditional inset, no reflow when a wave starts, and no
 * "reserved" strip of dead pixels during setup — the fix costs the field
 * nothing at all, which is what makes it the right one rather than a trade.
 */
export function StageBand({ ctx }: { ctx: ShellContext }) {
  return (
    <section className={`sh-stage stage-${ctx.stage}`}>
      {ctx.stage === 'battlefield' && <BattleCanvas />}
      {ctx.stage === 'map' && <RunMapView />}
    </section>
  )
}
