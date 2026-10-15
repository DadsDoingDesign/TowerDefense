import type { GroundMark as Mark } from '../game/data/terrain'
import { OUTLINE } from '../game/data/pixelArt'
import { Icon } from './Icon'
import { Pixel } from './pixel'

/**
 * The marks of a road's ground hazard (`terrain.GROUND_EFFECTS`), 16px each:
 * the atlas's flame for fire and its curse for cursed ground; a pond and a
 * boulder, drawn here in the same 1px-outline manner (the atlas has no cell
 * for either). Decorative: the row they sit in says the effect in words.
 */
const POND = ['..oooo..', '.owwwwo.', 'owllwwwo', 'owwwwllo', 'owlwwwwo', '.owwwlo.', '..oooo..', '........']
const POND_PAL = { o: OUTLINE, w: '#4f8fc4', l: '#9fd0f0' }
const BOULDER = ['...ooo..', '..ollgo.', '.olggggo', 'olgggddo', 'ogggdddo', 'oggddddo', '.oooooo.', '........']
const BOULDER_PAL = { o: OUTLINE, l: '#d6d0c2', g: '#a39e92', d: '#6e6a62' }

export function GroundMarks({ marks }: { marks: readonly Mark[] }) {
  return (
    <span className="ground-marks" aria-hidden="true">
      {marks.map((m) =>
        m === 'fire' ? (
          <Icon key={m} name="burn" />
        ) : m === 'curse' ? (
          <Icon key={m} name="curse" />
        ) : (
          <Pixel key={m} rows={m === 'water' ? POND : BOULDER} palette={m === 'water' ? POND_PAL : BOULDER_PAL} scale={2} />
        ),
      )}
    </span>
  )
}
