import { useRef, useState, type KeyboardEvent } from 'react'
import type { Vec2 } from '../game/core/vec'
import { BLOCK_COPY } from '../game/data/terrain'
import type { FieldTile, GameMap } from '../game/types'
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
 * Where a tile is, in words a player can picture: which bend of the road it
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

/** A tile's grid reference as the player sees the field: column letter, row number. */
export const tileRef = (t: Pick<FieldTile, 'col' | 'row'>): string => `${String.fromCharCode(65 + t.col)}${t.row + 1}`

/**
 * The deployment grid as real buttons (G1-2; the build circles' layer before
 * it, Phase 2 finding 6).
 *
 * The grid exists only as canvas pixels — the canvas has no role and no tab
 * stop — so a keyboard or screen-reader player could pick a hero and then have
 * nowhere to put it. This is a layer of transparent buttons laid exactly over
 * the tiles. It is ONE tab stop (a roving tabindex): Tab lands on the grid,
 * the arrow keys walk it tile by tile the way the field is drawn, and Enter
 * does what a tap does — post the armed hero, inspect a posted one, or, on a
 * blocked tile, say why (the coach strip is a live region). Each name says the
 * tile's grid reference, which bend it overlooks, and who stands on it.
 *
 * `pointer-events: none` on every button (see `.slot-layer` in app.css): a
 * finger keeps landing on the canvas, whose tile hit test and press-to-preview
 * are the touch path. Keyboard activation and assistive-tech "activate" both
 * fire `click` on the element itself, which pointer-events does not govern.
 *
 * Only during setup and a breather: during a live wave there is nothing to
 * place, and a grid of stops the player cannot use would be noise.
 */
export function SlotLayer({ field }: { field: FieldRect }) {
  const screen = useGameStore((s) => s.screen)
  const battlePhase = useGameStore((s) => s.battlePhase)
  const engine = useGameStore((s) => s.engine)
  const map = useGameStore((s) => s.battleMap)
  const placements = useGameStore((s) => s.placements)
  const roster = useGameStore((s) => s.roster)
  const armed = useGameStore((s) => s.selectedSentinelId)
  const tapTile = useGameStore((s) => s.tapTile)
  // Phase 3a: during a sub-wave breather the same tiles are the one move —
  // pick a hero up, put it down — so the move is reachable without a pointer.
  const breather = useGameStore((s) => s.hud.breather && !!s.engine?.breather)
  const pick = useGameStore((s) => s.breatherPick)
  const [focusId, setFocusId] = useState<string | null>(null)
  const refs = useRef(new Map<string, HTMLButtonElement>())

  const inBreather = screen === 'battle' && battlePhase === 'battle' && !!engine && breather
  const inSetup = screen === 'battle' && battlePhase === 'setup' && !engine
  if (!inBreather && !inSetup) return null
  const tiles = map.tiles ?? map.slots.map((s, i) => ({ id: s.id, pos: s.pos, col: i, row: 0, block: null }))
  const T = (map.tile ?? 80) * field.scale
  const armedHero = roster.find((h) => h.id === armed)
  // The roving stop: the focused tile if it is still on this field, else the
  // first open one.
  const stop = tiles.find((t) => t.id === focusId)?.id ?? tiles.find((t) => !t.block)?.id ?? tiles[0]?.id

  const at = new Map(tiles.map((t) => [`${t.col},${t.row}`, t]))
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
    if (!d) return
    const cur = tiles.find((t) => t.id === (focusId ?? stop))
    if (!cur) return
    const next = at.get(`${cur.col + d[0]},${cur.row + d[1]}`)
    e.preventDefault()
    if (!next) return
    setFocusId(next.id)
    refs.current.get(next.id)?.focus()
  }

  const label = (t: FieldTile): string => {
    const ref = `Tile ${tileRef(t)}`
    if (t.block) return `${ref}, ${BLOCK_COPY[t.block].line}`
    const where = slotPlace(map, t.pos)
    if (inBreather) {
      const rt = engine!.sentinelOnSlot(t.id)
      const state = rt ? `${rt.def.name} posted` : 'open'
      const action = pick ? (pick === t.id ? ' — put back' : ' — move here') : rt ? ' — pick up to move' : ''
      return `${ref}, ${where}, ${state}${action}`
    }
    const heroId = placements[t.id]
    const hero = heroId ? roster.find((h) => h.id === heroId) : undefined
    const state = hero ? `${hero.name} posted` : 'open'
    const action = armedHero
      ? hero && hero.id === armedHero.id
        ? ''
        : ` — post ${armedHero.name} here`
      : hero
        ? ' — show their Skills'
        : ''
    return `${ref}, ${where}, ${state}${action}`
  }
  const inert = (t: FieldTile): boolean => {
    if (t.block) return true
    if (inBreather) return engine!.subWaveState().moved || (!pick && !engine!.sentinelOnSlot(t.id))
    return !armedHero && !placements[t.id]
  }

  const groupName = inBreather
    ? pick
      ? 'Breather — choose where the hero goes'
      : 'Breather — choose a hero to move (one move)'
    : armedHero
      ? `Tiles on the field — choose one for ${armedHero.name}`
      : 'Tiles on the field'

  return (
    <div
      className="slot-layer"
      role="group"
      aria-label={`${groupName}. Arrow keys move between tiles.`}
      onKeyDown={onKeyDown}
      style={{ left: field.left, top: field.top, width: field.width, height: field.height }}
    >
      {tiles.map((t) => {
        const filled = inBreather ? !!engine!.sentinelOnSlot(t.id) : !!placements[t.id]
        return (
          <button
            key={t.id}
            ref={(el) => {
              if (el) refs.current.set(t.id, el)
              else refs.current.delete(t.id)
            }}
            type="button"
            className={`slot-btn tile-btn ${filled ? 'filled' : ''} ${t.block ? 'blocked' : ''}`}
            style={{ left: t.pos.x * field.scale, top: t.pos.y * field.scale, width: T, height: T }}
            tabIndex={t.id === stop ? 0 : -1}
            aria-label={label(t)}
            aria-disabled={inert(t)}
            onFocus={() => setFocusId(t.id)}
            onClick={() => tapTile(t.id)}
          />
        )
      })}
    </div>
  )
}
