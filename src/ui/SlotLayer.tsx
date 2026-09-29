import type { Vec2 } from '../game/core/vec'
import type { GameMap } from '../game/types'
import { useGameStore } from '../state/gameStore'

/** The field's CSS rect inside the Stage wrap, and its view scale. */
export interface FieldRect {
  left: number
  top: number
  width: number
  height: number
  scale: number
}

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth']

/**
 * Where a circle is, in words a player can picture: which bend of the road it
 * overlooks. Derived from the map's own path, so a new map needs no copy.
 */
export function slotPlace(map: GameMap, pos: Vec2): string {
  const pts = map.path
  // Interior points are the bends; the ends are the way in and the Gate.
  let best = { i: 0, d: Infinity }
  for (let i = 0; i < pts.length; i++) {
    const p = {
      x: Math.max(0, Math.min(map.width, pts[i].x)),
      y: Math.max(0, Math.min(map.height, pts[i].y)),
    }
    const d = Math.hypot(p.x - pos.x, p.y - pos.y)
    if (d < best.d) best = { i, d }
  }
  if (best.i === 0) return 'by the way in'
  if (best.i >= pts.length - 2 && Math.hypot(map.base.x - pos.x, map.base.y - pos.y) < 260) return 'near the Gate'
  return `by the ${ORDINAL[best.i - 1] ?? `${best.i}th`} bend`
}

/**
 * The build circles as real buttons (Phase 2, finding 6).
 *
 * The circles existed only as canvas pixels — the canvas has no role and no tab
 * stop — so a keyboard or screen-reader player could pick a hero and then had
 * nowhere to put it. This is a layer of transparent buttons laid exactly over
 * the circles: Tab reaches each one, its name says which circle, where it is and
 * who stands on it, and Enter does what a tap does.
 *
 * `pointer-events: none` on every button (see `.slot-layer` in app.css): a
 * finger keeps landing on the canvas, whose hit test has the 44px screen-space
 * floor and nearest-wins snapping, so touch behaviour is unchanged. Keyboard
 * activation and assistive-tech "activate" both fire `click` on the element
 * itself, which pointer-events does not govern.
 *
 * Only during setup: during a live wave there is nothing to place, and a row of
 * stops the player cannot use would be noise in the tab order.
 */
export function SlotLayer({ field }: { field: FieldRect }) {
  const screen = useGameStore((s) => s.screen)
  const battlePhase = useGameStore((s) => s.battlePhase)
  const engine = useGameStore((s) => s.engine)
  const map = useGameStore((s) => s.battleMap)
  const placements = useGameStore((s) => s.placements)
  const roster = useGameStore((s) => s.roster)
  const armed = useGameStore((s) => s.selectedSentinelId)
  const placeOnSlot = useGameStore((s) => s.placeOnSlot)
  const focusTower = useGameStore((s) => s.focusTower)

  if (screen !== 'battle' || battlePhase !== 'setup' || engine) return null
  const armedHero = roster.find((h) => h.id === armed)

  return (
    <div
      className="slot-layer"
      role="group"
      aria-label={armedHero ? `Circles on the field — choose one for ${armedHero.name}` : 'Circles on the field'}
      style={{ left: field.left, top: field.top, width: field.width, height: field.height }}
    >
      {map.slots.map((slot, i) => {
        const heroId = placements[slot.id]
        const hero = heroId ? roster.find((h) => h.id === heroId) : undefined
        const where = slotPlace(map, slot.pos)
        const state = hero ? `${hero.name} posted` : 'empty'
        const action = armedHero
          ? hero && hero.id === armedHero.id
            ? ''
            : ` — post ${armedHero.name} here`
          : hero
            ? ' — show their Skills'
            : ''
        return (
          <button
            key={slot.id}
            type="button"
            className={`slot-btn ${hero ? 'filled' : ''}`}
            style={{ left: slot.pos.x * field.scale, top: slot.pos.y * field.scale }}
            aria-label={`Circle ${i + 1}, ${where}, ${state}${action}`}
            aria-disabled={!armedHero && !hero}
            onClick={() => {
              if (armedHero) placeOnSlot(slot.id)
              else if (hero) focusTower(hero.id)
            }}
          />
        )
      })}
    </div>
  )
}
