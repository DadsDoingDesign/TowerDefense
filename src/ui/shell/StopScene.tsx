import type { CSSProperties } from 'react'
import { Icon } from '../Icon'
import type { IconKey } from '../channels'
import type { StopKind } from './stopScene'
import { FIRE_CELL, SCENE_ANCHORS, SCENE_SIZE } from './stopScenes.generated'

/**
 * A stop on the road drawn as a PLACE, with someone in it talking to you
 * (Oct 2026; the designer, on the first pass: "Can they feel more
 * environmental … a campfire with a person that's talking to you, a shop
 * counter with a clerk and wares"; the approved direction is option 1 of the
 * stop-scene canvas, "scene and speech").
 *
 * The scene is baked from the CC0 Tiny Swords pack by `scripts/stop-scenes.ts`
 * (`public/assets/scenes/<stop>.png`) and drawn at 2× on an 800 × 300 stage,
 * centred: a phone sees its middle, where the scene is composed, and a desk
 * the wooded wings too. On it, from the baked anchors:
 *
 *   - the merchant's clerk holds up the ware you are looking at (`held`);
 *   - the campfire's flame burns (the pack's own fire strip, stepped);
 *   - the keeper says the stop's line in a speech bubble.
 *
 * The art, the flame and the held ware are decoration (an empty `alt`,
 * `aria-hidden`). The bubble is the stop's line, read in place: the page's
 * head carries no subtitle at a stop, so there is no second copy. The title
 * is the page's own `h1`, hung on the scene as the place's sign (`stops.css`).
 */
export function StopScene({ kind, line, held }: { kind: StopKind; line?: string; held?: IconKey }) {
  const a = SCENE_ANCHORS[kind]
  const z = 2
  const stageW = SCENE_SIZE.w * z
  const stageH = SCENE_SIZE.h * z
  const [sx, sy] = a.speaker
  // Speakers right of centre lean their bubble left, the rest lean right, so
  // a bubble always stays inside the middle a phone sees.
  const leftLean = sx * z > stageW / 2 + 40
  const showHeld = 'held' in a && !!held
  // Over the speaker's head where there is sky for it; BESIDE the head for a
  // tall speaker or a clerk holding a ware up, so the bubble never leaves the
  // phone's shorter scene (whose stage is lifted ~36px) or hides the ware.
  const beside = showHeld || sy * z < 120
  const bubble: CSSProperties = beside
    ? leftLean
      ? { right: stageW - sx * z + 18, bottom: stageH - sy * z - 22 }
      : { left: sx * z + 18, bottom: stageH - sy * z - 22 }
    : leftLean
      ? { right: stageW - sx * z - 22, bottom: stageH - sy * z + 14 }
      : { left: sx * z - 22, bottom: stageH - sy * z + 14 }
  return (
    <div className={`stop-scene stop-${kind}`}>
      <div className="ss-stage" style={{ width: stageW, height: stageH }}>
        <img className="ss-art" src={`assets/scenes/${kind}.png`} alt="" width={stageW} height={stageH} draggable={false} />
        {'fire' in a && (
          <span
            className="ss-fire"
            aria-hidden="true"
            style={{ left: (a.fire[0] - FIRE_CELL.cx) * z, top: (a.fire[1] - FIRE_CELL.by) * z }}
          />
        )}
        {showHeld && 'held' in a && (
          <span className="ss-held" aria-hidden="true" style={{ left: a.held[0] * z - 16, top: a.held[1] * z - 30 }}>
            <Icon name={held!} lg />
          </span>
        )}
        {line && (
          <p className={`ss-bubble${leftLean ? ' lean-left' : ''}`} style={bubble}>
            {line}
          </p>
        )}
      </div>
    </div>
  )
}
