import type { CSSProperties } from 'react'
import { Icon } from '../Icon'
import type { StopKind } from './stopScene'

/**
 * A stop on the road drawn as a PLACE (Oct 2026; the designer: "do one more
 * design pass to really up the aesthetic … consider this for all the special
 * events, shrine and campfire — what's unique to them and makes it lively for
 * the story").
 *
 * Every stop's head is the same three parts, each in its own place's dress:
 *
 *   ░ backdrop ░  the place: the merchant's awning, the campfire's night and
 *      [ ✦ ]      flame, the shrine's stone and glow, the recruiter's tent
 *   [  SIGN  ]    the page's one title, hung on two cords (`stops.css`)
 *   “a line”      what the world says, on a paper slip (the page's subtitle)
 *
 * The backdrop and its mark are decoration (`aria-hidden`): the title and
 * the line carry the words.
 */
export function StopScene({ kind, color }: { kind: StopKind; color?: string }) {
  return (
    <div className={`stop-scene stop-${kind}`} aria-hidden="true" style={color ? ({ '--aw': color } as CSSProperties) : undefined}>
      {kind === 'merchant' && <div className="shop-awning" />}
      {kind === 'campfire' && (
        <div className="stop-sky">
          <span className="stop-glow" />
          <CampfireMark />
        </div>
      )}
      {kind === 'shrine' && (
        <div className="stop-arch">
          <span className="stop-glow" />
          <span className="stop-mark">
            <Icon name="shrine" lg />
          </span>
        </div>
      )}
      {kind === 'recruit' && (
        <div className="stop-tent">
          <span className="stop-mark">
            <Icon name="recruit" lg />
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * The campfire's mark: the atlas has no fire cell, so a 16 × 16 pixel fire,
 * drawn at 3× like every place mark, whose flame flickers (`stops.css`;
 * still under reduced motion).
 */
const LOGS = ['..bbb......bbb..', '.bBBBbbbbbbBBBb.', '..bbBBBBBBBBbb..']
const FLAME = [
  '.......o........',
  '......oo....o...',
  '......oyo...o...',
  '.....oyyo..oo...',
  '....oyyyyo.oyo..',
  '....oyywyyooyo..',
  '...ooyywwyyyo...',
  '...oyywwwwyyo...',
  '....oyywwyyo....',
  '.....oyyyyo.....',
]
const INK: Record<string, string> = { o: '#e0743a', y: '#f0c46a', w: '#fff3c4', b: '#4a2e18', B: '#7a5030' }
const rects = (rows: readonly string[], top: number) =>
  rows.flatMap((row, r) => [...row].map((c, x) => (INK[c] ? <rect key={`${top + r}-${x}`} x={x} y={top + r} width={1} height={1} fill={INK[c]} /> : null)))
const CampfireMark = () => (
  <svg className="stop-mark stop-fire" viewBox="0 0 16 16" width={48} height={48} shapeRendering="crispEdges">
    <g className="stop-flame">{rects(FLAME, 2)}</g>
    {rects(LOGS, 12)}
  </svg>
)
