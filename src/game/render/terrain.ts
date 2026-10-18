/**
 * The static battlefield: the ground, the road, the woodland round it, the
 * terrain pieces and the environment grade — baked once per map into one
 * offscreen canvas and blitted.
 *
 * ## One continuous map (grid-fit)
 *
 * The field used to be a 960×560 picture letterboxed in a separately baked
 * "apron" of darker woodland, with a hard step where the two met and the road
 * stopping dead at the seam. The designer called it empty mirror space. Now
 * the bake IS the whole map: the field's grid in the middle and the same
 * meadow, the same lattice and the same road running on past it, with the
 * forest thickening the further it gets from the playable ground. There is no
 * second layer, so there is no seam and no tint step — `BattleCanvas` shows
 * whatever part of it the Stage has room for.
 *
 * ## One lattice
 *
 * Everything that sits on the ground sits on the deployment grid's 40px
 * lattice (`data/terrain.ts`), inside the grid and past it:
 *  - the grass texture is resampled so it repeats every tile (its streak rows
 *    ARE the grid lines, nothing half a tile off them);
 *  - the road runs through tile centres and is one tile wide;
 *  - forest, rocks, ponds, fire and cursed ground each fill whole tiles.
 */
import type { Vec2 } from '../core/vec'
import type { GameMap } from '../types'
import type { FieldSeason, PropKind, PropRule, PropWhere } from '../data/fieldSeasons'
import { pixmap } from './pixmap'
import { CARAVAN_BOX, caravanLayout } from './caravan'
import { ACCENT_KEEP, ACCENT_PAINT, ACCENT_SHIFT, markAccent, seasonFinish, seasonGround, seasonOnDeco, spriteAlpha } from './season'
import { broadleaf, propArt, repaintFoliage, repaintRock, seasonArtStamp } from './seasonArt'
import { hash01, hashStr, valueNoise } from './seasonHash'
import { onSpritesReady, spriteFor } from './sprites'
import { getActiveStyle } from './themes'
import { darken, lighten, mix, roundRect, strokePolyline, toRgb } from './paint'

// ── The world: the field plus the map it continues into ─────────────────────
/**
 * The baked world, in field px: the field's box grown on every side. The
 * margins are whole tiles from the grid's own origin, so the lattice runs on
 * unbroken past it.
 *
 * Sized for the Stage's extremes (a live wave on a 430×932 phone, the setup
 * Stage at 320×568, a 32:9 desk). The side the horde ENTERS from keeps only a
 * short run: `BattleCanvas` never shows past the field's edge there (the
 * column walks in from off-screen). The
 * Gate's side and the two flanks get the room.
 */
export interface WorldBox {
  x0: number
  y0: number
  w: number
  h: number
}
export function worldOf(map: GameMap): WorldBox {
  if (map.orientation === 'portrait') {
    const side = 450
    return { x0: -side, y0: -160, w: map.width + side * 2, h: map.height + 160 + 480 }
  }
  return { x0: -160, y0: -560, w: map.width + 160 + 640, h: map.height + 560 * 2 }
}

/**
 * The part of the field that must always be on screen: the road inside the
 * grid, the Gate and every tile that is not forest (open, cursed, rock, water,
 * fire) — the bounding box of the grid's non-forest tiles, in field px.
 */
export function playRect(map: GameMap): { x0: number; y0: number; x1: number; y1: number } {
  const T = map.tile ?? 40
  const tiles = (map.tiles ?? []).filter((t) => t.block !== 'forest')
  if (!tiles.length) return { x0: 0, y0: 0, x1: map.width, y1: map.height }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const t of tiles) {
    x0 = Math.min(x0, t.pos.x - T / 2)
    y0 = Math.min(y0, t.pos.y - T / 2)
    x1 = Math.max(x1, t.pos.x + T / 2)
    y1 = Math.max(y1, t.pos.y + T / 2)
  }
  return { x0, y0, x1, y1 }
}

/**
 * The road as it is DRAWN: the path with its two off-field ends carried on to
 * the edge of the world, so it runs on off-screen both ways. The engine's
 * path is untouched — enemies still spawn at its first point and leave at its
 * last — this is only paint.
 */
export function drawnRoad(map: GameMap): Vec2[] {
  const p = map.path
  if (p.length < 2) return [...p]
  const far = 4000
  const ext = (a: Vec2, b: Vec2): Vec2 => {
    const dx = a.x - b.x
    const dy = a.y - b.y
    const len = Math.hypot(dx, dy) || 1
    return { x: a.x + (dx / len) * far, y: a.y + (dy / len) * far }
  }
  return [ext(p[0], p[1]), ...p, ext(p[p.length - 1], p[p.length - 2])]
}

// ── Static terrain, baked once per map (H19) ────────────────────────────────
/**
 * `drawField` used to re-render the whole static world EVERY frame; it is
 * composed once into an offscreen canvas at 1:1 with the logical field — so
 * it is also the surface every sprite draws into at exactly 1.000 scale — and
 * blitted with a single `drawImage`.
 *
 * Two bakes, most recent first (Portrait battlefields): a screen turned
 * across the portrait breakpoint swaps a field for its twin and back, and a
 * one-entry cache re-baked (and re-graded, pixel by pixel) the whole map on
 * every trip between them.
 */
const TERRAIN_CACHE_SIZE = 2
let terrainCache: { key: string; canvas: HTMLCanvasElement }[] = []

/**
 * The season the battlefield wears (Oct 2026, `data/fieldSeasons.ts`): the
 * run's hiring company's, set by `BattleCanvas`; null is the plain field. It
 * is part of the bake's key, so a change re-bakes once and costs nothing per
 * frame after.
 */
let fieldSeason: FieldSeason | null = null
export function setFieldSeason(season: FieldSeason | null): void {
  fieldSeason = season
}
export const activeFieldSeason = (): FieldSeason | null => fieldSeason
onSpritesReady(() => {
  terrainCache = []
})
function bakeTerrain(map: GameMap): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const style = getActiveStyle()
  // Each terrain role resolves down the theme's fallback chain on its own, and
  // carries its own pack's density (sprites.ts `spriteFor`).
  const grass = style.sprites ? spriteFor('grass') : undefined
  if (!style.sprites || !grass) return null
  const W = worldOf(map)
  const c = document.createElement('canvas')
  c.width = W.w
  c.height = W.h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false
  // The season's working state for this bake (`render/season.ts`): what it
  // must not touch, and what it painted in its own colour.
  bakeSeason = fieldSeason
    ? { season: fieldSeason, W, keep: keepMask(map, W), accent: new Uint8Array(W.w * W.h), salt: hashStr(`${map.id}|${fieldSeason.name}`), near: nearPlay(map) }
    : null
  ctx.translate(-W.x0, -W.y0)
  const road = spriteFor('road')
  drawSpriteTerrain(ctx, map, W, grass, road, style.path.edge, style.path.fill)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  // The season over the ground and the scenery, before the grade (so the grade
  // still governs the enemies' reserved channels): the road and the danger
  // ground are kept exactly as they are.
  const bs = bakeSeason
  bakeSeason = null
  if (bs) seasonFinish(ctx, W.w, W.h, bs.season, bs.keep.mask, bs.accent)
  // The environment is graded AFTER the dressing goes down, so the grade
  // reaches the decoration sprites (which is where the reserved-channel
  // violation lived) and never touches a gameplay glyph. The wood darkens
  // with its distance from the playable ground in the same pass — a slope,
  // never a step, so nothing reads as a seam.
  const pr = playRect(map)
  gradeEnvironment(ctx, W.w, W.h, { x0: pr.x0 - W.x0, y0: pr.y0 - W.y0, x1: pr.x1 - W.x0, y1: pr.y1 - W.y0 }, bs?.season.accent ? bs.accent : undefined)
  return c
}

/** The season's state while a bake runs (null outside one, or with no season). */
interface BakeSeason {
  season: FieldSeason
  W: WorldBox
  keep: { mask: Uint8Array; canvas: HTMLCanvasElement }
  accent: Uint8Array
  salt: number
  /** Is this field point within reach of the play (`nearPlay`)? */
  near: (x: number, y: number) => boolean
}
let bakeSeason: BakeSeason | null = null

/** The baked world for `map` (cached), or null before the pack has decoded. */
function bakedWorld(map: GameMap): HTMLCanvasElement | null {
  const style = getActiveStyle()
  if (!style.sprites) return null
  // The pack stamp is in the key so a re-exported sprite pack re-bakes rather
  // than leaving a terrain built from the old art on screen.
  const key = `${style.id}:${map.id}:${map.width}x${map.height}:${decoStamp()}:${artStamp('grass')}:${artStamp('road')}:${fieldSeason?.name ?? '-'}:${fieldSeason ? seasonArtStamp() : 0}`
  let hit = terrainCache.find((e) => e.key === key)
  if (!hit) {
    const baked = bakeTerrain(map)
    if (!baked) return null
    hit = { key, canvas: baked }
    terrainCache = [hit, ...terrainCache].slice(0, TERRAIN_CACHE_SIZE)
  } else if (terrainCache[0] !== hit) {
    terrainCache = [hit, ...terrainCache.filter((e) => e !== hit)]
  }
  return hit.canvas
}

/**
 * The whole map under the field's coordinates: the baked world blitted at its
 * own offset, so a context that shows any part of it — the field, the woodland
 * past it — gets the right pixels. One `drawImage`; given the part of the map
 * on screen (`view`, field px), only that part is copied, so a phone never
 * pays to blit the woodland it cannot see.
 */
export function drawField(ctx: CanvasRenderingContext2D, map: GameMap, view?: { x0: number; y0: number; w: number; h: number }): void {
  const style = getActiveStyle()
  const W = worldOf(map)
  if (style.sprites) {
    const baked = bakedWorld(map)
    if (baked) {
      if (!view) {
        ctx.drawImage(baked, W.x0, W.y0)
        return
      }
      // The visible part, clamped to the bake, a whole px either side for the shake.
      const x0 = Math.max(W.x0, view.x0 - 8)
      const y0 = Math.max(W.y0, view.y0 - 8)
      const x1 = Math.min(W.x0 + W.w, view.x0 + view.w + 8)
      const y1 = Math.min(W.y0 + W.h, view.y0 + view.h + 8)
      if (x1 > x0 && y1 > y0) ctx.drawImage(baked, x0 - W.x0, y0 - W.y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0)
      return
    }
  }

  // Procedural fallback (no sprite pack yet): a flat meadow, the grid, the road.
  const grad = ctx.createLinearGradient(0, W.y0, 0, W.y0 + W.h)
  grad.addColorStop(0, style.field.top)
  grad.addColorStop(1, style.field.bottom)
  ctx.fillStyle = grad
  ctx.fillRect(W.x0, W.y0, W.w, W.h)

  ctx.strokeStyle = style.field.grid
  ctx.lineWidth = 1
  ctx.beginPath()
  const step = map.tile ?? style.field.gridStep
  for (let x = 0; x <= map.width; x += step) {
    ctx.moveTo(x, 0)
    ctx.lineTo(x, map.height)
  }
  for (let y = 0; y <= map.height; y += step) {
    ctx.moveTo(0, y)
    ctx.lineTo(map.width, y)
  }
  ctx.stroke()

  drawTerrainGround(ctx, map, style.field.bottom)
  drawPath(ctx, drawnRoad(map))
}

// ── Terrain pieces (G1-2) ──────────────────────────────────────────────────
/**
 * The ground under each blocked terrain tile, baked with the rest of the field.
 *
 *  - **Water** is Tiny Swords' own flat water (`#47aba9`, `fx/water.png`) with
 *    its foam rim (`#c6f0db` on `#458597`, `fx/foam.png`), drawn as one shape
 *    per lake: neighbouring water tiles are bridged, so tiles make one pond,
 *    not a row of puddles.
 *  - **Fire** is scorched earth — a charcoal patch with embers — under the
 *    animated flames `drawTerrainFlames` stands on it every frame.
 *  - **Rock** is a darker patch of ground the boulder sprites (dressing) sit
 *    on, so a rock tile differs from grass in value as well as in shape.
 *
 * Every piece is inset from its tile edge where the neighbour is not the same
 * kind, so the grid's tile boundaries stay legible when a hero is armed. The
 * road runs through its own tiles (grid-fit), so a piece never meets the dirt.
 * Insets are authored for G1-2's 80px tile and scale with the tile.
 */
const WATER = '#47aba9'
const FOAM = '#c6f0db'
const FOAM_EDGE = '#458597'
/** A burn's corner radius (Oct 2026 asset critique: 12, a tray; now nearer a round scorch). */
const FIRE_R = 15
/** The bank's shadow on the water, and the lake's deeper middle (the pack's water, a step and a half step down). */
const WATER_SHADE = '#357f86'
const WATER_DEEP = '#40a0a1'

type Rect = { x0: number; y0: number; x1: number; y1: number }
type Tile = NonNullable<GameMap['tiles']>[number]

/**
 * A piece's shape as rectangles: one core per tile (inset on every side) plus
 * a square BRIDGE across each shared edge to a neighbour of the same kind.
 * Bridges, not grown cores: a core grown into two neighbours pokes a rounded
 * corner into the diagonal tile at an L, which read as a notch.
 */
function pieceShape(map: GameMap, is: (t: Tile) => boolean, inset: number, r: number): { cores: Rect[]; bridges: Rect[] } {
  const tiles = (map.tiles ?? []).filter(is)
  const T = map.tile ?? 40
  const h = T / 2
  const core = (t: Tile): Rect => ({ x0: t.pos.x - h + inset, x1: t.pos.x + h - inset, y0: t.pos.y - h + inset, y1: t.pos.y + h - inset })
  const cores = new Map(tiles.map((t) => [t.id, core(t)]))
  const bridges: Rect[] = []
  // The portrait twin transposes columns and rows but keeps each tile's
  // landscape id, so neighbours are found by POSITION, whichever way up.
  const byPos = new Map(tiles.map((t) => [`${Math.round(t.pos.x)},${Math.round(t.pos.y)}`, t]))
  for (const t of tiles) {
    const a = cores.get(t.id)!
    // Right and down only, so each shared edge is bridged once.
    const right = byPos.get(`${Math.round(t.pos.x + T)},${Math.round(t.pos.y)}`)
    if (right) {
      const b = cores.get(right.id)!
      bridges.push({ x0: a.x1 - r, x1: b.x0 + r, y0: Math.max(a.y0, b.y0), y1: Math.min(a.y1, b.y1) })
    }
    const down = byPos.get(`${Math.round(t.pos.x)},${Math.round(t.pos.y + T)}`)
    if (down) {
      const b = cores.get(down.id)!
      bridges.push({ x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), y0: a.y1 - r, y1: b.y0 + r })
    }
    // Where four tiles meet (a 2 × 2 patch), the square between the four
    // cores, or the pond has a hole in the middle.
    const diag = byPos.get(`${Math.round(t.pos.x + T)},${Math.round(t.pos.y + T)}`)
    if (right && down && diag) {
      const d = cores.get(diag.id)!
      bridges.push({ x0: a.x1 - r, x1: d.x0 + r, y0: a.y1 - r, y1: d.y0 + r })
    }
  }
  return { cores: [...cores.values()], bridges }
}

/** A piece's shape as ONE path (for a clip): the same cores and bridges {@link fillShape} fills. */
function shapePath(ctx: CanvasRenderingContext2D, s: { cores: Rect[]; bridges: Rect[] }, r: number): void {
  ctx.beginPath()
  for (const c of s.cores) {
    const w = c.x1 - c.x0
    const h = c.y1 - c.y0
    if (w <= 0 || h <= 0) continue
    const rr = Math.max(0, Math.min(r, w / 2, h / 2))
    ctx.moveTo(c.x0 + rr, c.y0)
    ctx.arcTo(c.x1, c.y0, c.x1, c.y1, rr)
    ctx.arcTo(c.x1, c.y1, c.x0, c.y1, rr)
    ctx.arcTo(c.x0, c.y1, c.x0, c.y0, rr)
    ctx.arcTo(c.x0, c.y0, c.x1, c.y0, rr)
    ctx.closePath()
  }
  for (const b of s.bridges) if (b.x1 > b.x0 && b.y1 > b.y0) ctx.rect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0)
}

function fillShape(ctx: CanvasRenderingContext2D, s: { cores: Rect[]; bridges: Rect[] }, r: number): void {
  for (const c of s.cores) {
    roundRect(ctx, c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, r)
    ctx.fill()
  }
  for (const b of s.bridges) if (b.x1 > b.x0 && b.y1 > b.y0) ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0)
}

/**
 * The connected groups of tiles matching `is` (4-neighbour, by position): a
 * pond, a burning patch, a cursed patch — each drawn and labelled as one
 * thing, not tile by tile.
 */
const clusterCache = new WeakMap<GameMap, Map<string, Tile[][]>>()
/** {@link clusters} for a named predicate, kept per map (the per-frame callers ask every frame). */
function clustersOf(map: GameMap, name: string, is: (t: Tile) => boolean): Tile[][] {
  let byName = clusterCache.get(map)
  if (!byName) clusterCache.set(map, (byName = new Map()))
  let hit = byName.get(name)
  if (!hit) byName.set(name, (hit = clusters(map, is)))
  return hit
}
export const cursedClusters = (map: GameMap): Tile[][] => clustersOf(map, 'cursed', (t) => t.danger === 'cursed')

export function clusters(map: GameMap, is: (t: Tile) => boolean): Tile[][] {
  const T = map.tile ?? 40
  const tiles = (map.tiles ?? []).filter(is)
  const byPos = new Map(tiles.map((t) => [`${Math.round(t.pos.x)},${Math.round(t.pos.y)}`, t]))
  const seen = new Set<string>()
  const out: Tile[][] = []
  for (const t of tiles) {
    if (seen.has(t.id)) continue
    const group: Tile[] = []
    const stack = [t]
    seen.add(t.id)
    while (stack.length) {
      const u = stack.pop()!
      group.push(u)
      for (const [dx, dy] of [[T, 0], [-T, 0], [0, T], [0, -T]]) {
        const v = byPos.get(`${Math.round(u.pos.x + dx)},${Math.round(u.pos.y + dy)}`)
        if (v && !seen.has(v.id)) {
          seen.add(v.id)
          stack.push(v)
        }
      }
    }
    out.push(group)
  }
  return out
}

const boundsOf = (tiles: Tile[], T: number, inset: number): Rect => ({
  x0: Math.min(...tiles.map((t) => t.pos.x)) - T / 2 + inset,
  y0: Math.min(...tiles.map((t) => t.pos.y)) - T / 2 + inset,
  x1: Math.max(...tiles.map((t) => t.pos.x)) + T / 2 - inset,
  y1: Math.max(...tiles.map((t) => t.pos.y)) + T / 2 - inset,
})

function drawTerrainGround(ctx: CanvasRenderingContext2D, map: GameMap, green: string): void {
  const tiles = map.tiles
  if (!tiles?.length) return
  const T = map.tile ?? 40
  const k = T / 80
  if (tiles.some((t) => t.block === 'water')) {
    // Three passes over the whole lake so rims never draw over a neighbour's
    // water: dark edge, then foam, then water.
    const passes: [string, number][] = [
      [FOAM_EDGE, 2],
      [FOAM, 4],
      [WATER, 7],
    ]
    for (const [col, inset] of passes) {
      const r = Math.max(6, Math.round((25 - inset) * k * 1.4))
      ctx.fillStyle = col
      fillShape(ctx, pieceShape(map, (t) => t.block === 'water', inset, r), r)
    }
    // Depth (Oct 2026 asset critique: the lake was one flat teal, a pool
    // poured into a tray): the bank's shadow along the far and the lit side
    // (light from the upper left), so the water sits BELOW the grass, and a
    // deeper middle.
    {
      const r = Math.max(6, Math.round(18 * k * 1.4))
      const core = pieceShape(map, (t) => t.block === 'water', 7, r)
      ctx.save()
      shapePath(ctx, core, r)
      ctx.clip()
      ctx.fillStyle = WATER_SHADE
      fillShape(ctx, core, r)
      ctx.translate(2, 3)
      ctx.fillStyle = WATER
      fillShape(ctx, core, r)
      ctx.translate(-2, -3)
      ctx.fillStyle = WATER_DEEP
      fillShape(ctx, pieceShape(map, (t) => t.block === 'water', 15, Math.max(4, r - 6)), Math.max(4, r - 6))
      ctx.restore()
    }
    // A few flat ripples, the way the pack's water is lit, kept inside each
    // tile's water.
    ctx.strokeStyle = 'rgba(198,240,219,0.55)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (const c of pieceShape(map, (t) => t.block === 'water', 10, 0).cores) {
      const seed = mulberry32((Math.round(c.x0) * 928371 + Math.round(c.y0) * 1237) >>> 0)
      const w = 6 + seed() * 6
      const x = c.x0 + w / 2 + seed() * Math.max(0, c.x1 - c.x0 - w)
      const y = c.y0 + seed() * (c.y1 - c.y0)
      ctx.beginPath()
      ctx.moveTo(Math.round(x - w / 2), Math.round(y))
      ctx.lineTo(Math.round(x + w / 2), Math.round(y))
      ctx.stroke()
    }
  }
  if (tiles.some((t) => t.block === 'fire')) {
    // Scorched earth: charcoal, with a warm rim where the grass is burning back.
    const fire = (t: Tile) => t.block === 'fire'
    // Burnt grass round the rim (Oct 2026 asset critique: the patch was a
    // clean rounded tray): the meadow browned in the tile's margin, and the
    // rim's edge eaten into by char, so the burn is ragged where it meets
    // the grass.
    ctx.fillStyle = 'rgba(62, 36, 16, 0.3)'
    fillShape(ctx, pieceShape(map, fire, 0, 17), 17)
    ctx.fillStyle = '#6b3a1c'
    fillShape(ctx, pieceShape(map, fire, 3, FIRE_R), FIRE_R)
    for (const t of tiles) {
      if (!fire(t)) continue
      const x0 = Math.round(t.pos.x - T / 2)
      const y0 = Math.round(t.pos.y - T / 2)
      for (let y = 1; y < T - 1; y++)
        for (let x = 1; x < T - 1; x++) {
          const edge = Math.min(x, y, T - 1 - x, T - 1 - y)
          if (edge > 6) continue
          const h = hash01((x0 + x) >> 1, y0 + y, 47)
          if (h > 0.3) continue
          ctx.fillStyle = edge <= 3 ? '#4a2c18' : '#2b1d17'
          ctx.fillRect(x0 + x, y0 + y, 1, 1)
        }
    }
    // The line where the grass is still burning: a thin ember ring round the char.
    ctx.fillStyle = '#b04a20'
    fillShape(ctx, pieceShape(map, fire, 5, FIRE_R - 2), FIRE_R - 2)
    ctx.fillStyle = '#2b1d17'
    fillShape(ctx, pieceShape(map, fire, 6, FIRE_R - 3), FIRE_R - 3)
    {
      // The char lit from the upper left: a soot shadow under the far rim,
      // pale ash drifted against the near one, and ash flecks across it.
      const char = pieceShape(map, fire, 6, FIRE_R - 3)
      ctx.save()
      shapePath(ctx, char, FIRE_R - 3)
      ctx.clip()
      ctx.fillStyle = '#17100c'
      fillShape(ctx, char, FIRE_R - 3)
      ctx.translate(2, 2)
      ctx.fillStyle = '#2b1d17'
      fillShape(ctx, char, FIRE_R - 3)
      ctx.translate(-2, -2)
      for (const t of tiles) {
        if (!fire(t)) continue
        const x0 = Math.round(t.pos.x - T / 2)
        const y0 = Math.round(t.pos.y - T / 2)
        for (let y = 0; y < T; y += 2)
          for (let x = 0; x < T; x += 2) {
            const r = hash01(x0 + x, y0 + y, 49)
            if (r > 0.05) continue
            ctx.fillStyle = r < 0.012 ? '#5a4a40' : '#3e3028'
            ctx.fillRect(x0 + x, y0 + y, 2, 2)
          }
      }
      ctx.restore()
    }
    for (const t of tiles) {
      if (!fire(t)) continue
      const seed = mulberry32((t.col * 7919 + t.row * 104729) >>> 0)
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = i % 3 ? '#e0772e' : '#f3c14d'
        ctx.fillRect(Math.round(t.pos.x - T / 2 + 8 + seed() * (T - 16)), Math.round(t.pos.y - T / 2 + 8 + seed() * (T - 16)), 2, 2)
      }
    }
  }
  if (tiles.some((t) => t.danger === 'cursed')) drawCursedGround(ctx, map)
  for (const t of tiles) {
    if (t.block !== 'rock') continue
    // Worn ground under the boulders: the grass, darker — a value change
    // under the stone so the tile separates from the meadow.
    ctx.fillStyle = withAlpha(darken(green, 0.35), 0.45)
    ctx.beginPath()
    ctx.ellipse(t.pos.x + 1, t.pos.y + 6, T * 0.46, T * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * Q1: CURSED GROUND — an open patch a hero may stand on at a cost
 * (`data/hazards.ts`). It has to read as "you can post here, but" at a glance,
 * and never as blocked terrain, so it borrows nothing from rock, water or fire:
 *
 *  - **Blighted soil**, not scorch and not stone: the grass is gone to a dark,
 *    dead olive-brown (low chroma, clear of every reserved tier hue) with a
 *    soft rim where it bleeds into the living meadow and a few pale dead tufts.
 *    Rock is LIGHT grey boulders; fire is charcoal with orange embers and
 *    standing flames; water is teal. This is dark, flat and cold.
 *  - **Cracks that glow a sickly green** — the one saturated mark on it, in a
 *    hue no enemy tier wears (t1 red, t2 teal, t3 purple, t4 gold).
 *  - **Two small skulls** at the patch's two ends (`drawTerrainDanger`, per
 *    frame, off the pack's own death strip).
 *
 * Grid-fit: a cursed patch is 2 × 2 tiles, drawn as ONE patch (one soil, one
 * set of cracks) that fills exactly its tiles.
 */
const CURSE_RIM = '#4d4a34'
const CURSE_SOIL = '#3e382c'
const CURSE_GLOW = '#9fcf4a'
const CURSE_CORE = '#e2f59a'
const cursedOf = (t: Tile) => t.danger === 'cursed'
function drawCursedGround(ctx: CanvasRenderingContext2D, map: GameMap): void {
  const T = map.tile ?? 40
  ctx.fillStyle = withAlpha(CURSE_RIM, 0.8)
  fillShape(ctx, pieceShape(map, cursedOf, 2, 12), 12)
  ctx.fillStyle = CURSE_SOIL
  fillShape(ctx, pieceShape(map, cursedOf, 5, 9), 9)
  {
    // Sunken (Oct 2026 asset critique): the blight lies a little below the
    // meadow, a shade under its far and lit-side rims.
    const soil = pieceShape(map, cursedOf, 5, 9)
    ctx.save()
    shapePath(ctx, soil, 9)
    ctx.clip()
    ctx.fillStyle = '#2a261e'
    fillShape(ctx, soil, 9)
    ctx.translate(2, 2)
    ctx.fillStyle = CURSE_SOIL
    fillShape(ctx, soil, 9)
    ctx.restore()
  }
  for (const group of clusters(map, cursedOf)) {
    const core = boundsOf(group, T, 5)
    const seed = mulberry32((group[0].col * 3571 + group[0].row * 7919 + 17) >>> 0)
    // Dead tufts: short pale strokes, the grass that is left.
    ctx.strokeStyle = 'rgba(168,160,122,0.75)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (let i = 0; i < 7; i++) {
      const x = core.x0 + 6 + seed() * (core.x1 - core.x0 - 12)
      const y = core.y0 + 8 + seed() * (core.y1 - core.y0 - 12)
      ctx.beginPath()
      ctx.moveTo(Math.round(x), Math.round(y))
      ctx.lineTo(Math.round(x + (seed() - 0.5) * 6), Math.round(y - 4 - seed() * 3))
      ctx.stroke()
    }
    // Cracks: four lines from near the centre, each bending once — a soft
    // green glow under a bright hairline.
    const cx = (core.x0 + core.x1) / 2
    const cy = (core.y0 + core.y1) / 2
    const cracks: [number, number, number, number, number, number][] = []
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + seed() * 0.9
      const r1 = 9 + seed() * 6
      const rx = (core.x1 - core.x0) / 2 - 4
      const ry = (core.y1 - core.y0) / 2 - 3
      const bend = a + (seed() - 0.5) * 0.9
      const k1 = Math.min(r1, rx, ry)
      cracks.push([cx, cy, cx + Math.cos(a) * k1, cy + Math.sin(a) * k1, cx + Math.cos(bend) * rx, cy + Math.sin(bend) * ry])
    }
    for (const [col, w] of [[withAlpha(CURSE_GLOW, 0.45), 5], [CURSE_CORE, 1.5]] as const) {
      ctx.strokeStyle = col
      ctx.lineWidth = w
      for (const [x0, y0, x1, y1, x2, y2] of cracks) {
        ctx.beginPath()
        ctx.moveTo(Math.round(x0), Math.round(y0))
        ctx.lineTo(Math.round(x1), Math.round(y1))
        ctx.lineTo(Math.round(x2), Math.round(y2))
        ctx.stroke()
      }
    }
  }
}

/**
 * Q1: the skulls on cursed ground, drawn every frame over the baked patch (the
 * death strip loads lazily, so it cannot be baked). Two per patch, at its two
 * bottom corners — beside a hero standing on any of its tiles, never under it.
 */
export function drawTerrainDanger(
  map: GameMap,
  drawSkull: (x: number, y: number, variant: number) => void,
): void {
  const groups = cursedClusters(map)
  if (!groups.length) return
  const T = map.tile ?? 40
  for (const group of groups) {
    const c = boundsOf(group, T, 5)
    drawSkull(c.x0 + 7, c.y1 - 2, 0)
    drawSkull(c.x1 - 7, c.y1 - 3, 1)
  }
}

/**
 * The standing flames on a Wildfire's burning tiles (G1-2) — drawn every frame
 * over the baked scorch, one per tile, out of phase with its neighbours. The
 * fire sheet is the pack's own (`fx/fire.png`), at the field's one density.
 */
export function drawTerrainFlames(
  map: GameMap,
  drawFlame: (x: number, y: number, phase: number) => void,
): void {
  if (!map.tiles) return
  for (const t of map.tiles) {
    if (t.block !== 'fire') continue
    drawFlame(t.pos.x, t.pos.y + 8, t.col * 3 + t.row * 5)
  }
}

function drawPath(ctx: CanvasRenderingContext2D, pts: Vec2[]): void {
  const p = getActiveStyle().path
  ctx.lineJoin = 'round'
  ctx.lineCap = p.cap

  ctx.strokeStyle = p.edge
  ctx.lineWidth = Math.min(p.edgeWidth, ROAD_W)
  strokePolyline(ctx, pts)

  ctx.strokeStyle = p.fill
  ctx.lineWidth = Math.min(p.fillWidth, ROAD_W - 8)
  strokePolyline(ctx, pts)

  ctx.strokeStyle = p.center
  ctx.lineWidth = 2
  if (p.dash) ctx.setLineDash(p.dash)
  strokePolyline(ctx, pts)
  ctx.setLineDash([])
}

/**
 * The road's drawn width: one tile (grid-fit), the dirt plus its dark grassy
 * edge. The road runs through its tiles' centres, so the whole drawn road
 * lies inside its own tiles and the tiles either side are whole grass.
 */
const ROAD_W = 40
/** The dirt inside the edge. */
const DIRT_W = 32

/**
 * The grass texture, resampled to repeat every `period` px (one tile).
 *
 * The pack's grass tile repeats every 32px at the field's density, and its
 * streak rows read as a faint grid of their own — one that did not match the
 * deployment grid (the designer: "it should match the bg layers grid
 * exactly"). So the tile is resampled ONCE, wrap-around (it is drawn 3 × 3 and
 * the middle kept, so the edges are filtered against their real neighbours
 * and the result still tiles seamlessly), to exactly one tile: the texture's
 * rows and the lit grid's lines are the same lines.
 */
const grassTiles = new WeakMap<object, Map<number, HTMLCanvasElement>>()
function grassTile(img: CanvasImageSource & { naturalWidth?: number; width: number | SVGAnimatedLength }, spriteScale: number, period: number): CanvasImageSource | null {
  if (typeof document === 'undefined') return null
  const byP = grassTiles.get(img) ?? new Map<number, HTMLCanvasElement>()
  grassTiles.set(img, byP)
  const hit = byP.get(period)
  if (hit) return hit
  const nw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width
  const nh = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height
  if (!nw || !nh) return null
  void spriteScale
  const big = document.createElement('canvas')
  big.width = nw * 3
  big.height = nh * 3
  const b = big.getContext('2d')
  if (!b) return null
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) b.drawImage(img, x * nw, y * nh)
  const out = document.createElement('canvas')
  out.width = period * 3
  out.height = period * 3
  const o = out.getContext('2d')
  if (!o) return null
  o.imageSmoothingEnabled = true
  o.imageSmoothingQuality = 'high'
  o.drawImage(big, 0, 0, out.width, out.height)
  const tile = document.createElement('canvas')
  tile.width = period
  tile.height = period
  const t = tile.getContext('2d')
  if (!t) return null
  t.drawImage(out, period, period, period, period, 0, 0, period, period)
  byP.set(period, tile)
  return tile
}

/**
 * Lay the whole map (sprite themes): the meadow and its lattice-true grass,
 * the terrain pieces, the road running on past the field both ways, and the
 * woodland round it. Design goals (per the level-design review): keep the
 * interior readable — trees frame the playable ground and never stand in it —
 * give the grass low-contrast tonal life so it isn't a solid block, and give
 * the road real character (dirt speckle, worn ruts, a broken tufted edge).
 */
function drawSpriteTerrain(
  ctx: CanvasRenderingContext2D,
  map: GameMap,
  W: WorldBox,
  grass: DrawnArt,
  road: DrawnArt | undefined,
  edgeColor: string,
  fillColor: string,
): void {
  const style = getActiveStyle()
  const green = mix(style.field.top, style.field.bottom, 0.5)
  const dr = getDressing(map)
  const T = map.tile ?? 40

  // Base grass: the pack's tile resampled to one lattice tile, anchored on the
  // grid's own origin (a portrait twin's grid starts past its side pad).
  const lat = latticeOrigin(map)
  const tile = grassTile(grass.img, grass.spriteScale, T)
  const gpm = tile ? null : pixmap(grass.img, { scale: grass.spriteScale })
  const gp = ctx.createPattern(tile ?? (gpm ? (gpm.img as CanvasImageSource) : grass.img), 'repeat')!
  gp.setTransform(new DOMMatrix().translate(lat.x, lat.y))
  ctx.fillStyle = gp
  ctx.fillRect(W.x0, W.y0, W.w, W.h)
  ctx.fillStyle = 'rgba(0,0,0,0.06)'
  ctx.fillRect(W.x0, W.y0, W.w, W.h)

  drawGrassDetail(ctx, dr, green)
  // Terrain pieces' ground (G1-2): lakes, scorched earth, bare soil under rock.
  drawTerrainGround(ctx, map, green)

  // The dirt lane: dark grassy edge, mid fill, worn lighter centre — one tile
  // wide, on past the field both ways.
  const pts = drawnRoad(map)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = edgeColor
  ctx.lineWidth = ROAD_W
  strokePolyline(ctx, pts)
  if (road) {
    const rpm = pixmap(road.img, { scale: road.spriteScale })
    const rp = ctx.createPattern(rpm ? (rpm.img as CanvasImageSource) : road.img, 'repeat')!
    ctx.strokeStyle = rp
    ctx.lineWidth = DIRT_W
    strokePolyline(ctx, pts)
  } else {
    // A sunken lane (Oct 2026 asset critique: it was one flat stroke): the
    // dirt a step darker, then the dirt again a little narrower and nudged
    // down-right, so its far and lit-side banks hold a shade, as a trodden
    // track lies a little below the meadow under a light from the upper left.
    ctx.strokeStyle = darken(fillColor, 0.2)
    ctx.lineWidth = DIRT_W
    strokePolyline(ctx, pts)
    ctx.save()
    ctx.translate(1, 1.5)
    ctx.strokeStyle = fillColor
    ctx.lineWidth = DIRT_W - 3
    strokePolyline(ctx, pts)
    ctx.strokeStyle = lighten(fillColor, 0.1)
    ctx.lineWidth = DIRT_W / 2
    strokePolyline(ctx, pts)
    ctx.restore()
    drawCartTracks(ctx, pts, fillColor)
  }
  drawPathDetail(ctx, dr, fillColor, green)

  // The season on the bare ground, then what it lays on it (puddles,
  // flowers, reeds' pads), then the scenery with the season's own trees and
  // props in it.
  const bs = bakeSeason
  if (bs) {
    const m = ctx.getTransform()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    seasonGround(ctx, W.w, W.h, bs.season, bs.keep.mask, bs.accent, bs.salt)
    ctx.setTransform(m)
  }
  drawWagonClearing(ctx, map)
  const scenery = bs ? seasonScenery(map, dr, bs.season, bs.salt) : null
  if (bs && scenery) for (const p of scenery.flat) drawProp(ctx, p, bs)
  drawDecos(ctx, dr, scenery, wagonBox(map))
}

/**
 * The wagon's clearing (Oct 2026 asset critique): the caravan stood in the
 * forest margin over the baked treetops, a cart pasted on canopies with a
 * brown wash under it. Now nothing of the scenery is drawn inside its box,
 * and the bake lays a trodden clearing there for it to stand in.
 */
function wagonBox(map: GameMap): Rect {
  const at = caravanLayout(map)
  const pad = 4
  return { x0: at.x + CARAVAN_BOX.left - pad, y0: at.y + CARAVAN_BOX.top - pad, x1: at.x + CARAVAN_BOX.right + pad, y1: at.y + CARAVAN_BOX.bottom + pad }
}
function drawWagonClearing(ctx: CanvasRenderingContext2D, map: GameMap): void {
  const b = wagonBox(map)
  const cx = (b.x0 + b.x1) / 2
  const cy = b.y1 - 12
  const rx = (b.x1 - b.x0) * 0.62
  const ry = 22
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 1)
  g.addColorStop(0, 'rgba(96, 74, 44, 0.62)')
  g.addColorStop(0.72, 'rgba(96, 74, 44, 0.5)')
  g.addColorStop(1, 'rgba(96, 74, 44, 0)')
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(rx, ry)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // Wheel ruts into it from the road side, and a few tufts trodden flat.
  ctx.fillStyle = 'rgba(58, 42, 24, 0.4)'
  for (let x = b.x0 + 6; x < b.x1 - 6; x += 3) {
    if (hash01(Math.round(x), Math.round(cy), 57) < 0.3) continue
    ctx.fillRect(Math.round(x), Math.round(cy + 2), 2, 1)
    ctx.fillRect(Math.round(x), Math.round(cy + 8), 2, 1)
  }
}
const inBox = (b: Rect, x0: number, y0: number, x1: number, y1: number): boolean => x1 > b.x0 && x0 < b.x1 && y1 > b.y0 && y0 < b.y1

/**
 * The caravans' wheel tracks down the lane (a merchant road), broken where
 * the dirt has filled them, and a few pebbles, lit on top. Placed by a hash of
 * position along the drawn road — the dressing's own stream is untouched.
 */
function drawCartTracks(ctx: CanvasRenderingContext2D, pts: Vec2[], fill: string): void {
  const track = withAlpha(darken(fill, 0.24), 0.3)
  let k = 0
  for (const s of samplePath(pts, 2, () => true)) {
    k++
    const run = hash01(k >> 4, 0, 61) < 0.8
    if (run) {
      ctx.fillStyle = track
      for (const o of [-7, 7]) ctx.fillRect(Math.round(s.x + s.nx * o - 1), Math.round(s.y + s.ny * o - 1), 2, 2)
    }
    if (hash01(k, 1, 62) < 0.024) {
      const o = (hash01(k, 2, 63) - 0.5) * 22
      const x = Math.round(s.x + s.nx * o)
      const y = Math.round(s.y + s.ny * o)
      ctx.fillStyle = withAlpha(darken(fill, 0.35), 0.8)
      ctx.fillRect(x, y + 1, 3, 1)
      ctx.fillStyle = lighten(fill, 0.22)
      ctx.fillRect(x, y - 1, 3, 2)
      ctx.fillStyle = lighten(fill, 0.4)
      ctx.fillRect(x, y - 1, 1, 1)
    }
  }
}

/** Where the lattice's lines fall: the grid's top-left corner, field px. */
function latticeOrigin(map: GameMap): Vec2 {
  const T = map.tile ?? 40
  const tiles = map.tiles ?? []
  if (!tiles.length) return { x: 0, y: 0 }
  return { x: Math.min(...tiles.map((t) => t.pos.x)) - T / 2, y: Math.min(...tiles.map((t) => t.pos.y)) - T / 2 }
}

// ── Level dressing ──────────────────────────────────────────────────────────
// All geometry is generated once per map (seeded, deterministic) and cached, so
// the animation loop only ever draws it.

/**
 * A dressing sprite. There is no `scale` any more, deliberately: every asset on
 * the field draws at one density (see `pixmap.ts`), so a decoration's size is
 * decided by WHICH art gets picked, never by a random multiplier. `x`/`y` are
 * whole logical px so a flipped blit stays on the pixel grid.
 */
interface Deco { x: number; y: number; name: string; flip: boolean; native?: boolean }
interface Blob { x: number; y: number; r: number; light: boolean }
interface Speck { x: number; y: number; r: number; light: boolean }
interface Rut { x: number; y: number; tx: number; ty: number }
interface Dressing {
  blobs: Blob[]
  tufts: { x: number; y: number; s: number; a: number }[]
  flowers: { x: number; y: number; c: number }[]
  specks: Speck[]
  ruts: Rut[]
  edgeTufts: { x: number; y: number; r: number }[]
  decos: Deco[]
}
let dressCache: { key: string; dr: Dressing } | null = null

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Shortest distance from a point to the path polyline (keeps the lane clear). */
function distToPath(x: number, y: number, pts: Vec2[]): number {
  let best = Infinity
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const dx = b.x - a.x, dy = b.y - a.y
    const len2 = dx * dx + dy * dy || 1
    let t = ((x - a.x) * dx + (y - a.y) * dy) / len2
    t = Math.max(0, Math.min(1, t))
    const px = a.x + t * dx, py = a.y + t * dy
    const d = Math.hypot(x - px, y - py)
    if (d < best) best = d
  }
  return best
}

/** Walk the path polyline at a fixed spacing, yielding point + tangent + normal. */
function samplePath(pts: Vec2[], spacing: number, keep: (x: number, y: number) => boolean) {
  const out: { x: number; y: number; tx: number; ty: number; nx: number; ny: number }[] = []
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const tx = dx / len, ty = dy / len
    for (let d = 0; d < len; d += spacing) {
      const x = a.x + tx * d, y = a.y + ty * d
      if (keep(x, y)) out.push({ x, y, tx, ty, nx: -ty, ny: tx })
    }
  }
  return out
}

/** Every decoration role the renderer may place, in one list. */
const DECO_NAMES = ['tree1', 'tree2', 'tree3', 'tree4', 'rock1', 'rock2', 'rock3', 'rock4', 'bush1', 'bush2']

/** A decoded role and the pack/density it resolved to (sprites.ts `spriteFor`). */
type DrawnArt = NonNullable<ReturnType<typeof spriteFor>>

/**
 * Which pack each role resolved to and how tall it is. A cache key: a role
 * that moves pack (a newly shipped fieldwatch tree), or a re-exported file,
 * has to re-bake the terrain and re-lay the dressing.
 */
const artStamp = (n: string): string => {
  const a = spriteFor(n)
  return a ? `${a.pack}/${a.img.naturalHeight}` : '-'
}
export const decoStamp = (): string => DECO_NAMES.map(artStamp).join(',')
/**
 * The tallest a decoration may be drawn, in logical px.
 *
 * Set to the largest unit silhouette the game can field — a tier-5 Torch
 * champion is 80 logical px — so nothing decorative out-masses the biggest
 * thing on the board. Anything above it is dropped from the pool outright,
 * which is the rule that keeps a re-export from putting a 177px tree back on a
 * 40px goblin.
 */
const DECO_CEIL = 96
/** Below this, a decoration is ground litter rather than part of the frame. */
const DECO_TREE_MIN = 40

/**
 * Split the pack's dressing into a framing pool and a litter pool BY MEASURED
 * DRAWN HEIGHT, and report the tallest tree.
 */
export function decoPools(): { trees: string[]; litter: string[]; top: number; height: Record<string, number> } {
  const trees: string[] = []
  const litter: string[] = []
  const height: Record<string, number> = {}
  let tallest = 0
  for (const n of DECO_NAMES) {
    // Measured at the density of the pack it is drawn FROM, so a fallback
    // Tiny Swords tree under the one-density theme is still halved (§5.1).
    const spr = spriteFor(n)
    if (!spr) continue
    const h = Math.ceil(spr.img.naturalHeight * spr.spriteScale)
    height[n] = h
    if (h > DECO_CEIL) continue
    if (h >= DECO_TREE_MIN) {
      trees.push(n)
      if (h > tallest) tallest = h
    } else {
      litter.push(n)
    }
  }
  if (!trees.length) trees.push(...litter)
  return { trees, litter: litter.length ? litter : trees, top: tallest + 5, height }
}

/**
 * What stands on each tile of the WORLD lattice — the grid's tiles where it
 * has them, and past the grid the map it continues into: road where the drawn
 * road runs, forest everywhere else.
 */
type Ground = 'open' | 'lane' | 'forest' | 'rock' | 'water' | 'fire'
function worldLattice(map: GameMap, W: WorldBox, road: Vec2[]): { cells: { x: number; y: number; kind: Ground }[]; at: (x: number, y: number) => Ground | undefined } {
  const T = map.tile ?? 40
  const lat = latticeOrigin(map)
  const byPos = new Map((map.tiles ?? []).map((t) => [`${Math.round(t.pos.x)},${Math.round(t.pos.y)}`, t]))
  const cells: { x: number; y: number; kind: Ground }[] = []
  const kinds = new Map<string, Ground>()
  const i0 = Math.floor((W.x0 - lat.x) / T)
  const i1 = Math.ceil((W.x0 + W.w - lat.x) / T)
  const j0 = Math.floor((W.y0 - lat.y) / T)
  const j1 = Math.ceil((W.y0 + W.h - lat.y) / T)
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const x = lat.x + i * T + T / 2
      const y = lat.y + j * T + T / 2
      const t = byPos.get(`${Math.round(x)},${Math.round(y)}`)
      const kind: Ground = t ? (t.block ?? 'open') : distToPath(x, y, road) < T / 2 ? 'lane' : 'forest'
      cells.push({ x, y, kind })
      kinds.set(`${Math.round(x)},${Math.round(y)}`, kind)
    }
  }
  return { cells, at: (x, y) => kinds.get(`${Math.round(x)},${Math.round(y)}`) }
}

function buildDressing(map: GameMap): Dressing {
  const rng = mulberry32(((map.width * 73856093) ^ (map.height * 19349663) ^ (map.path.length * 83492791)) >>> 0)
  const Wd = worldOf(map)
  const T = map.tile ?? 40
  const road = drawnRoad(map)
  const pick = <V,>(arr: V[]) => arr[Math.floor(rng() * arr.length)]
  const area = Wd.w * Wd.h
  const rx = () => Wd.x0 + rng() * Wd.w
  const ry = () => Wd.y0 + rng() * Wd.h

  // Grass: soft tonal blobs + tufts + occasional flowers (all low contrast),
  // over the whole map at the field's own density.
  const blobs: Blob[] = []
  // Denser and stronger than they were. Desaturating the environment (see
  // `gradeEnvironment`) also flattens it, and the first graded pass read as one
  // dead olive sheet. Large, soft, LOW-frequency value patches are the right
  // answer: they give the ground life at a scale no unit competes with.
  for (let i = Math.round(area / 24000) + 6; i > 0; i--) blobs.push({ x: rx(), y: ry(), r: 58 + rng() * 116, light: rng() < 0.5 })
  const tufts: Dressing['tufts'] = []
  for (let i = Math.round(area / 4200); i > 0; i--) {
    const x = rx(), y = ry()
    if (distToPath(x, y, road) < ROAD_W / 2 + 3) continue
    tufts.push({ x, y, s: 3 + rng() * 3.4, a: 0.34 + rng() * 0.3 })
  }
  const flowers: Dressing['flowers'] = []
  for (let i = Math.round(area / 24000); i > 0; i--) {
    const x = rx(), y = ry()
    if (distToPath(x, y, road) < ROAD_W / 2 + 5) continue
    flowers.push({ x, y, c: Math.floor(rng() * 4) })
  }

  // Path: dirt speckle, worn ruts, grass tufts breaking the outline — along
  // the drawn road, as far as the world reaches.
  const inWorld = (x: number, y: number) => x > Wd.x0 - 20 && x < Wd.x0 + Wd.w + 20 && y > Wd.y0 - 20 && y < Wd.y0 + Wd.h + 20
  const specks: Speck[] = [], ruts: Rut[] = [], edgeTufts: Dressing['edgeTufts'] = []
  const half = DIRT_W / 2 - 4
  for (const s of samplePath(road, 10, inWorld)) {
    if (rng() < 0.85) specks.push({ x: s.x + s.nx * (rng() * 2 - 1) * half, y: s.y + s.ny * (rng() * 2 - 1) * half, r: 1.2 + rng() * 1.8, light: rng() < 0.45 })
    if (rng() < 0.5) for (const o of [-6, 6]) ruts.push({ x: s.x + s.nx * o, y: s.y + s.ny * o, tx: s.tx, ty: s.ty })
    for (const o of [-(DIRT_W / 2 - 1), DIRT_W / 2 - 1]) if (rng() < 0.34) edgeTufts.push({ x: s.x + s.nx * o + (rng() - 0.5) * 4, y: s.y + s.ny * o + (rng() - 0.5) * 3, r: 2.2 + rng() * 1.6 })
  }

  // Decorations, driven by the lattice (G1-2, grid-fit).
  //
  // A decoration is how a player reads that a tile is blocked, so the rule is
  // one-to-one: **every blocked tile shows its reason, and no open tile
  // carries anything that looks like one.** Forest is trees on forest tiles —
  // the grid's frame and the whole map past it, thinnest at the playable
  // ground's edge and thickening outward; a rock tile is a boulder on bare
  // soil; open grass keeps only the flat detail above.
  //
  // What stays from the measured passes this replaced: one density (the pool
  // carries the size range, no random scale), nothing taller than the biggest
  // unit (`DECO_CEIL`), and nothing leaning over the road — every tree is
  // tested along its whole trunk (`clearSprite`), because a canopy over the
  // road hides the thing the game is about.
  const decos: Deco[] = []
  const { trees: TREES, litter: LITTER, height: DH } = decoPools()
  const lattice = worldLattice(map, Wd, road)
  const pr = playRect(map)
  const outside = (x: number, y: number) => Math.max(pr.x0 - x, x - pr.x1, pr.y0 - y, y - pr.y1, 0)
  const clearSprite = (x: number, y: number, h: number, m: number) =>
    distToPath(x, y, road) > m &&
    distToPath(x, y - h * 0.5, road) > m * 0.86 &&
    distToPath(x, y - h * 0.88, road) > m * 0.72
  const put = (x: number, y: number, name: string, margin: number) => {
    const h = DH[name] ?? 0
    if (!clearSprite(x, y, h, margin)) return false
    decos.push({ x: Math.round(x), y: Math.round(y), name, flip: rng() < 0.5 })
    return true
  }
  const bushes = LITTER.filter((n) => n.startsWith('bush'))
  const shrubs = bushes.length ? bushes : LITTER
  const rocks = LITTER.filter((n) => n.startsWith('rock'))
  const boulders = rocks.length ? rocks : LITTER
  // Tallest first, so a tile takes the biggest tree that fits.
  const treesByHeight = [...TREES].sort((a, b) => (DH[b] ?? 0) - (DH[a] ?? 0))
  const big = [...boulders].sort((a, b) => (DH[b] ?? 0) - (DH[a] ?? 0))

  for (const c of lattice.cells) {
    const y1 = c.y + T / 2
    if (c.kind === 'forest') {
      const out = outside(c.x, c.y)
      // How tall a tree this tile can hold: up through the forest tiles above
      // it, and at most a crown tip (10px) into whatever stops the run.
      let top = c.y - T / 2
      let run = 0
      while (run < 3 && lattice.at(c.x, top - T / 2) === 'forest') {
        top -= T
        run++
      }
      const above = lattice.at(c.x, top - T / 2)
      const canopyTop = above === undefined ? -Infinity : above === 'lane' ? top : top - 10
      // Thin at the playable edge, a wood beyond: a tree on some tiles, a
      // thicket on others, and a clearing now and then so it is not one mat.
      const glade = Math.sin(c.x * 0.011 + 1.3) * Math.cos(c.y * 0.013 + 0.4) > 0.6
      const pTree = (out < 50 ? 0.4 : out < 140 ? 0.62 : 0.8) * (glade ? 0.35 : 1)
      const baseY = y1 - 2 - Math.floor(rng() * 4)
      // A crown is wider than a tile: beside open ground it leans away, so no
      // canopy reaches over a tile a hero can stand on.
      const lean = (lattice.at(c.x - T, c.y) !== 'forest' ? 6 : 0) - (lattice.at(c.x + T, c.y) !== 'forest' ? 6 : 0)
      const x = c.x + lean + (rng() - 0.5) * 8
      if (rng() < pTree) {
        const tree = treesByHeight.find((n) => baseY - (DH[n] ?? 0) >= canopyTop)
        if (tree && put(x, baseY, tree, ROAD_W / 2 + 8)) continue
      }
      // No tree: undergrowth — a shrub, or bare forest floor.
      if (rng() < (out < 50 ? 0.55 : 0.35)) {
        const name = pick(shrubs)
        if (baseY - (DH[name] ?? 20) >= canopyTop) put(x, baseY, name, ROAD_W / 2 + 4)
      }
    } else if (c.kind === 'rock') {
      // A boulder per rock tile, drawn at the pack's NATIVE density — the
      // density the units stand at (`unitPixmapScale`) — so a rock tile reads
      // as "rock" at a glance and not as a pebble; a pebble beside it now and
      // then. A 2 × 2 patch of rock is four stones: a cluster.
      // Big and middling stones alternate across a patch (a checkerboard of
      // the lattice), so a 2 × 2 patch reads as one heap, not four boulders.
      const seed = mulberry32((Math.round(c.x) * 92821 + Math.round(c.y) * 6271) >>> 0)
      const odd = (Math.round((c.x - T / 2) / T) + Math.round((c.y - T / 2) / T)) % 2 !== 0
      const stone = odd ? big[Math.min(2, big.length - 1)] : big[Math.floor(seed() * Math.min(2, big.length))]
      if (stone) decos.push({ x: Math.round(c.x + (seed() - 0.5) * 8), y: Math.round(c.y + (odd ? 14 : 10)), name: stone, flip: seed() < 0.5, native: true })
      if (odd && seed() < 0.6 && big.length > 1) decos.push({ x: Math.round(c.x + (seed() < 0.5 ? -11 : 11)), y: Math.round(c.y + 4), name: big[big.length - 1], flip: seed() < 0.5, native: true })
    }
  }
  decos.sort((a, b) => a.y - b.y)
  return { blobs, tufts, flowers, specks, ruts, edgeTufts, decos }
}

function getDressing(map: GameMap): Dressing {
  // The pack stamp is part of the key: which asset is a tree and which is
  // litter is decided by measured height, so a re-export has to regenerate the
  // layout rather than reuse one built against the old sizes.
  const key = `${map.id}:${map.width}x${map.height}:${map.path.length}:${Math.round(map.path[1]?.x ?? 0)}:${decoStamp()}`
  if (!dressCache || dressCache.key !== key) dressCache = { key, dr: buildDressing(map) }
  return dressCache.dr
}

const FLOWER_COLORS = ['#f2ead0', '#e8cf55', '#e07ba0', '#eaf2f6']

/** rgba() from any hex OR rgb() colour (mix/lighten/darken all return rgb()). */
function withAlpha(c: string, a: number): string {
  const [r, g, b] = toRgb(c)
  return `rgba(${r},${g},${b},${a})`
}

function drawGrassDetail(ctx: CanvasRenderingContext2D, dr: Dressing, green: string): void {
  for (const b of dr.blobs) {
    const col = b.light ? lighten(green, 0.18) : darken(green, 0.20)
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
    g.addColorStop(0, withAlpha(col, 0.36))
    g.addColorStop(1, withAlpha(col, 0))
    ctx.fillStyle = g
    ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2)
  }
  const tuft = darken(green, 0.26)
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  for (const t of dr.tufts) {
    ctx.strokeStyle = withAlpha(tuft, t.a)
    ctx.beginPath()
    ctx.moveTo(t.x, t.y); ctx.lineTo(t.x, t.y - t.s)
    ctx.moveTo(t.x - 2, t.y); ctx.lineTo(t.x - 3, t.y - t.s * 0.7)
    ctx.moveTo(t.x + 2, t.y); ctx.lineTo(t.x + 3, t.y - t.s * 0.7)
    ctx.stroke()
  }
  for (const f of dr.flowers) {
    ctx.fillStyle = FLOWER_COLORS[f.c]
    ctx.beginPath(); ctx.arc(f.x, f.y, 1.6, 0, Math.PI * 2); ctx.fill()
  }
}

function drawPathDetail(ctx: CanvasRenderingContext2D, dr: Dressing, fill: string, green: string): void {
  for (const s of dr.specks) {
    ctx.fillStyle = withAlpha(s.light ? lighten(fill, 0.16) : darken(fill, 0.22), 0.5)
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill()
  }
  ctx.strokeStyle = withAlpha(darken(fill, 0.16), 0.35)
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (const r of dr.ruts) { ctx.moveTo(r.x - r.tx * 3, r.y - r.ty * 3); ctx.lineTo(r.x + r.tx * 3, r.y + r.ty * 3) }
  ctx.stroke()
  // Grass blades poking over the dirt edge — irregular, so the lane isn't a clean stroke.
  ctx.strokeStyle = withAlpha(lighten(green, 0.02), 0.92)
  ctx.lineWidth = 1.2
  ctx.lineCap = 'round'
  for (const e of dr.edgeTufts) {
    ctx.beginPath()
    ctx.moveTo(e.x, e.y + 1); ctx.lineTo(e.x, e.y - e.r)
    ctx.moveTo(e.x - 1.6, e.y + 1); ctx.lineTo(e.x - 2.4, e.y - e.r * 0.7)
    ctx.moveTo(e.x + 1.6, e.y + 1); ctx.lineTo(e.x + 2.4, e.y - e.r * 0.7)
    ctx.stroke()
  }
}

/**
 * What a season must not touch, as a mask over the bake (1 = keep): the road
 * and its verge, and the danger ground — water, fire and cursed tiles — which
 * are gameplay, read by their colour.
 */
function keepMask(map: GameMap, W: WorldBox): { mask: Uint8Array; canvas: HTMLCanvasElement } {
  const c = document.createElement('canvas')
  c.width = W.w
  c.height = W.h
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.translate(-W.x0, -W.y0)
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.strokeStyle = '#fff'
  // Exactly the drawn road, and exactly each danger piece's drawn shape (Oct
  // 2026 asset critique): a kept verge round them — 4 px of the road's sides,
  // a square 2 px past each tile — left a ring of summer grass round every
  // road and patch in the frost's snow and the harvest's straw, a seam.
  g.lineWidth = ROAD_W
  strokePolyline(g, drawnRoad(map))
  g.fillStyle = '#fff'
  const k = (map.tile ?? 40) / 80
  const water = (t: Tile) => t.block === 'water'
  const fire = (t: Tile) => t.block === 'fire'
  const rW = Math.max(6, Math.round(23 * k * 1.4))
  fillShape(g, pieceShape(map, water, 2, rW), rW)
  fillShape(g, pieceShape(map, fire, 3, FIRE_R), FIRE_R)
  fillShape(g, pieceShape(map, cursedOf, 2, 12), 12)
  const data = g.getImageData(0, 0, W.w, W.h).data
  const out = new Uint8Array(W.w * W.h)
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 3] > 0 ? 1 : 0
  return { mask: out, canvas: c }
}

/** A seasonal prop placed in the scenery: where its foot stands, which, and which variation. */
interface PlacedProp { x: number; y: number; kind: PropKind; v: number; flip: boolean }
/** The season's scenery for one field: flat props on the ground, upright ones in the wood, and the shrubs they stand in for. */
interface Scenery { flat: PlacedProp[]; upright: PlacedProp[]; swapped: Set<number> }
let sceneryCache: { key: string; s: Scenery } | null = null

/**
 * Where the season's props go on this field (`data/fieldSeasons.ts`,
 * `props`): a hash of the field's id and the season, never a draw on any RNG
 * stream, so the field's own dressing (`buildDressing`) is untouched.
 *
 *  - `forest`: one per forest tile at most — in a shrub's place, at a tree's
 *    foot, or on bare forest floor; upright props live only here, so an open
 *    tile never carries anything that looks like what blocks one;
 *  - `open`: flat props at the corners of an open tile, off its standing
 *    spot, never on the road, the danger ground or the wagon;
 *  - `water`: reeds and pads along a lake's rim.
 */
function seasonScenery(map: GameMap, dr: Dressing, season: FieldSeason, salt: number): Scenery {
  const key = `${map.id}:${map.width}x${map.height}:${season.name}:${dr.decos.length}`
  if (sceneryCache?.key === key) return sceneryCache.s
  const out: Scenery = { flat: [], upright: [], swapped: new Set() }
  const rules = season.props ?? []
  const T = map.tile ?? 40
  const W = worldOf(map)
  const road = drawnRoad(map)
  const lat = latticeOrigin(map)
  const clearOfGame = (x: number, y: number, r: number) =>
    distToPath(x, y, road) > ROAD_W / 2 + 8 + r && Math.hypot(x - map.base.x, y - map.base.y) > 96 && x > W.x0 + 4 && x < W.x0 + W.w - 4 && y > W.y0 + 4 && y < W.y0 + W.h - 4
  const pick = (where: PropWhere, r: number): PropRule | null => {
    let acc = 0
    for (const rule of rules) {
      if (rule.where !== where) continue
      acc += rule.share
      if (r < acc) return rule
    }
    return null
  }
  const place = (rule: PropRule, x: number, y: number, a: number, b: number) => {
    const p: PlacedProp = { x: Math.round(x), y: Math.round(y), kind: rule.kind, v: Math.floor(hash01(a, b, salt + 5) * 6), flip: hash01(a, b, salt + 6) < 0.5 }
    if (FLAT_PROPS.has(rule.kind)) out.flat.push(p)
    else out.upright.push(p)
  }
  const cellOf = (x: number, y: number) => `${Math.floor((x - lat.x) / T)},${Math.floor((y - lat.y) / T)}`
  if (rules.some((r) => r.where === 'forest')) {
    // What already stands on each forest tile: its shrub (by index), its tree.
    const shrubAt = new Map<string, number>()
    const treeAt = new Set<string>()
    dr.decos.forEach((d, i) => {
      const k = cellOf(d.x, d.y - 3)
      const name = d.name ?? ''
      if (name.startsWith('bush')) shrubAt.set(k, i)
      else if (name.startsWith('tree')) treeAt.add(k)
    })
    for (const c of worldLattice(map, W, road).cells) {
      if (c.kind !== 'forest') continue
      // In clumps, when the season says so: a field of bales, a reed bed.
      if (season.clump && valueNoise(c.x, c.y, season.clump, salt + 17) > 0.5) continue
      const i = Math.floor((c.x - lat.x) / T)
      const j = Math.floor((c.y - lat.y) / T)
      const rule = pick('forest', hash01(i, j, salt))
      if (!rule) continue
      const k = `${i},${j}`
      const shrub = shrubAt.get(k)
      if (shrub !== undefined && !FLAT_PROPS.has(rule.kind)) {
        const d = dr.decos[shrub]
        if (!clearOfGame(d.x, d.y, 8)) continue
        out.swapped.add(shrub)
        place(rule, d.x, d.y, i, j)
        continue
      }
      // At a tree's foot (in front of it), or on the bare floor.
      const side = hash01(i, j, salt + 1) < 0.5 ? -1 : 1
      const x = c.x + (treeAt.has(k) ? side * T * 0.24 : (hash01(i, j, salt + 2) - 0.5) * T * 0.3)
      const y = c.y + T / 2 - 2 - Math.floor(hash01(i, j, salt + 3) * 4)
      if (!clearOfGame(x, y, 10)) continue
      place(rule, x, y, i, j)
    }
  }
  const tiles = map.tiles ?? []
  if (rules.some((r) => r.where === 'open')) {
    for (const t of tiles) {
      if (t.block || t.danger) continue
      for (let q = 0; q < 4; q++) {
        const rule = pick('open', hash01(t.col * 2 + (q & 1), t.row * 2 + (q >> 1), salt + 7))
        if (!rule) continue
        const x = t.pos.x + (q & 1 ? 1 : -1) * T * 0.34
        const y = t.pos.y + (q >> 1 ? 1 : -1) * T * 0.34
        // Off the danger ground and the lakes beside this tile too.
        const near = tiles.some((o) => (o.block === 'water' || o.block === 'fire' || o.danger) && Math.abs(o.pos.x - x) < T * 0.75 && Math.abs(o.pos.y - y) < T * 0.75)
        if (near || !clearOfGame(x, y, 10)) continue
        place(rule, x, y, t.col * 2 + (q & 1), t.row * 2 + (q >> 1))
      }
    }
  }
  if (rules.some((r) => r.where === 'water')) {
    const isWater = (x: number, y: number) => tiles.some((o) => o.block === 'water' && Math.abs(o.pos.x - x) < 1 && Math.abs(o.pos.y - y) < 1)
    const sides: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    for (const t of tiles) {
      if (t.block !== 'water') continue
      sides.forEach(([nx, ny], si) => {
        if (isWater(t.pos.x + nx * T, t.pos.y + ny * T)) return
        for (const rule of rules) {
          if (rule.where !== 'water' || hash01(t.col * 4 + si, t.row, salt + 9 + rule.kind.length) >= rule.share) continue
          const along = (hash01(t.col * 4 + si, t.row, salt + 11) - 0.5) * T * 0.5
          const inset = rule.kind === 'lily' ? T * 0.5 - 16 : T * 0.5 - 7
          const x = t.pos.x + nx * inset + (ny !== 0 ? along : 0)
          const y = t.pos.y + ny * inset + (nx !== 0 ? along : 0) + (rule.kind === 'reeds' ? 6 : 0)
          if (distToPath(x, y, road) <= ROAD_W / 2 + 6) continue
          place(rule, x, y, t.col * 4 + si, t.row + rule.kind.length * 97)
        }
      })
    }
  }
  out.upright.sort((a, b) => a.y - b.y)
  sceneryCache = { key, s: out }
  return out
}

/**
 * Within reach of the play: where a goblin's art and bar can stand in front
 * of it (Oct 2026 job critique) — a tile and a half of the road's centre
 * line (its half-width and a goblin's height) — or a hero's (on an open
 * tile). A season's tree here keeps no tier's hue (`season.ACCENT_SHIFT`);
 * past it, at the margins, it keeps its own. (The ground's paint is
 * `ACCENT_PAINT` wherever it lies.)
 */
const NEAR_ROAD_TILES = 1.5
const NEAR_SLOT_TILES = 0.75
function nearPlay(map: GameMap): (x: number, y: number) => boolean {
  const T = map.tile ?? 40
  const road = drawnRoad(map)
  const rr = NEAR_ROAD_TILES * T
  const sr2 = (NEAR_SLOT_TILES * T) ** 2
  const slots = map.slots.map((s) => s.pos)
  return (x, y) => {
    for (const p of slots) if ((p.x - x) ** 2 + (p.y - y) ** 2 <= sr2) return true
    return distToPath(x, y, road) <= rr
  }
}

/** The props that lie flat on the ground (drawn before the scenery; never in the depth order). */
const FLAT_PROPS = new Set<PropKind>(['flowers', 'puddle', 'mud', 'lily', 'leaves', 'pool'])

/** One prop, its foot at (x, y): flat ones centred there, upright ones standing on it. */
function drawProp(ctx: CanvasRenderingContext2D, p: PlacedProp, bs: BakeSeason): void {
  const art = propArt(p.kind, p.v)
  if (!art) return
  const x = Math.round(p.x - art.w / 2)
  const y = art.upright ? p.y - art.h : Math.round(p.y - art.h / 2)
  if (art.upright && !bs.season.light) {
    ctx.beginPath()
    ctx.ellipse(p.x, p.y - 1, art.w * 0.4, Math.max(2, art.w * 0.14), 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.20)'
    ctx.fill()
  }
  const flip = p.flip && art.upright
  blit(ctx, art.img, x, y, art.w, art.h, flip, p.x)
  if (bs.season.accent || p.kind === 'puddle') {
    const a = spriteAlpha(art.img, art.w, art.h)
    // An upright prop stands only on a forest tile, at the margins: the
    // season's set piece keeps its own colour. A flat one lies on the open
    // ground, near the play, and keeps no tier's hue.
    if (a && bs.season.accent) markAccent(bs.accent, bs.W.w, bs.W.h, a, x - bs.W.x0, y - bs.W.y0, art.w, art.h, flip, art.upright ? ACCENT_KEEP : ACCENT_PAINT)
    // A puddle holds the sky's own blue: the overcast's washes pass it by (it is graded with the rest).
    if (a && p.kind === 'puddle') markAccent(bs.keep.mask, bs.W.w, bs.W.h, a, x - bs.W.x0, y - bs.W.y0, art.w, art.h, flip)
  }
}

/** Draw an image at (x, y), mirrored about `cx` when `flip`. */
function blit(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number, flip: boolean, cx: number): void {
  if (flip) {
    ctx.save()
    ctx.translate(cx, 0)
    ctx.scale(-1, 1)
    ctx.translate(-cx, 0)
    ctx.drawImage(img, x, y, w, h)
    ctx.restore()
  } else {
    ctx.drawImage(img, x, y, w, h)
  }
}

/** A decoration's drawn size (for the long shadows). */
function decoSize(d: Deco): { w: number; h: number } | null {
  const spr = spriteFor(d.name)
  if (!spr) return null
  const pm = pixmap(spr.img, { scale: d.native ? 1 : spr.spriteScale })
  return pm ? { w: pm.fw, h: pm.fh } : null
}

/**
 * A low sun (late summer): every shadow long and falling away from it, laid on
 * the ground before anything stands on it — one layer, so two shadows never
 * darken twice — and never on the road or the danger ground.
 */
function drawLongShadows(ctx: CanvasRenderingContext2D, bs: BakeSeason, items: { y: number; deco?: Deco; prop?: PlacedProp }[]): void {
  const light = bs.season.light
  if (!light) return
  const layer = document.createElement('canvas')
  layer.width = bs.W.w
  layer.height = bs.W.h
  const g = layer.getContext('2d')
  if (!g) return
  g.translate(-bs.W.x0, -bs.W.y0)
  g.fillStyle = '#000'
  const dir = light.from === 'w' ? 1 : -1
  for (const it of items) {
    const w = it.deco ? (decoSize(it.deco)?.w ?? 0) : it.prop ? (propArt(it.prop.kind, it.prop.v)?.w ?? 0) : 0
    if (!w) continue
    const x = it.deco?.x ?? it.prop?.x ?? 0
    const len = w * 0.34 * light.shadow
    g.beginPath()
    g.ellipse(x + dir * (len - w * 0.3), it.y - 2, len, Math.max(2, w * 0.13), 0, 0, Math.PI * 2)
    g.fill()
  }
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.globalCompositeOperation = 'destination-out'
  g.drawImage(bs.keep.canvas, 0, 0)
  const a0 = ctx.globalAlpha
  ctx.globalAlpha = 0.24
  ctx.drawImage(layer, bs.W.x0, bs.W.y0)
  ctx.globalAlpha = a0
}

function drawDecos(ctx: CanvasRenderingContext2D, dr: Dressing, scenery: Scenery | null = null, clear: Rect | null = null): void {
  if (!getActiveStyle().sprites) return
  const bs = bakeSeason
  const season = bs?.season ?? null
  // The season's upright props stand in the scenery's depth order; the
  // shrubs they stand in for are gone. Nothing stands in the wagon's clearing.
  type Item = { y: number; deco?: Deco; prop?: PlacedProp }
  const items: Item[] = []
  dr.decos.forEach((d, idx) => {
    if (scenery?.swapped.has(idx)) return
    const sz = clear ? decoSize(d) : null
    if (clear && sz && inBox(clear, d.x - sz.w / 2, d.y - sz.h, d.x + sz.w / 2, d.y)) return
    items.push({ y: d.y, deco: d })
  })
  if (scenery) {
    for (const p of scenery.upright) {
      const art = clear ? propArt(p.kind, p.v) : null
      if (clear && art && inBox(clear, p.x - art.w / 2, p.y - art.h, p.x + art.w / 2, p.y)) continue
      items.push({ y: p.y, prop: p })
    }
    items.sort((a, b) => a.y - b.y)
  }
  if (bs) drawLongShadows(ctx, bs, items)
  const light = !!season?.light
  let salt = 0
  for (const it of items) {
    if (it.prop) {
      if (bs) drawProp(ctx, it.prop, bs)
      continue
    }
    const d = it.deco!
    const spr = spriteFor(d.name)
    if (!spr) continue
    const pm = pixmap(spr.img, { scale: d.native ? 1 : spr.spriteScale })
    if (!pm) continue
    const w = pm.fw, h = pm.fh
    // Contact shadow — kept on all three object classes, per the checklist
    // (laid with the long shadows above when the season has a low sun).
    if (!light) {
      ctx.beginPath()
      ctx.ellipse(d.x, d.y - 2, w * 0.34, w * 0.14, 0, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(0,0,0,0.20)'
      ctx.fill()
    }
    let x = d.x - Math.round(w / 2)
    let y = d.y - h
    const tree = d.name.startsWith('tree')
    let img: CanvasImageSource = pm.img
    let iw = w
    let ih = h
    if (season && bs) {
      const r = hash01(d.x, d.y, bs.salt + 31)
      if (tree && season.broadleaf && h >= 60 && r < season.broadleaf.share) {
        // A broadleaf in the pine's place: no taller and no wider than it.
        const bh = Math.round(h * 0.8)
        const bw = Math.min(w, Math.round(bh * 0.78))
        const ramp = season.broadleaf.ramps[Math.floor(hash01(d.x, d.y, bs.salt + 32) * season.broadleaf.ramps.length)]
        const art = broadleaf(ramp, Math.floor(hash01(d.x, d.y, bs.salt + 33) * 1000), bw, bh, season.broadleaf.blossom)
        if (art) {
          img = art.img
          iw = bw
          ih = bh
          x = d.x - Math.round(bw / 2)
          y = d.y - bh
        }
      } else if ((tree || d.name.startsWith('bush')) && season.foliage) {
        const ramp = tree ? season.foliage.ramps[Math.floor(hash01(d.x, d.y, bs.salt + 34) * season.foliage.ramps.length)] : (season.foliage.bush ?? null)
        if (ramp) img = repaintFoliage(pm.img, w, h, ramp) ?? pm.img
      } else if (d.name.startsWith('rock') && season.rocks) {
        img = repaintRock(pm.img, w, h, season.rocks) ?? pm.img
      }
    }
    blit(ctx, img, x, y, iw, ih, d.flip, d.x)
    // The season on it, right after it, so the next piece in front covers it
    // as it covers the piece.
    if (season && bs) {
      const a = spriteAlpha(img, iw, ih)
      if (a) {
        if (season.caps || season.icicles) seasonOnDeco(ctx, a, x, y, iw, ih, d.flip, tree && iw === w, season, salt++)
        // A season's tree keeps its colour at the margins; within reach of
        // the play (by its foot or its crown) its reds and golds turn olive.
        if (season.accent && img !== pm.img) {
          const near = bs.near(d.x, d.y) || bs.near(d.x, d.y - ih / 2)
          markAccent(bs.accent, bs.W.w, bs.W.h, a, x - bs.W.x0, y - bs.W.y0, iw, ih, d.flip, near ? ACCENT_SHIFT : ACCENT_KEEP)
        }
      }
    }
  }
}

/**
 * The reserved-channel fix (TF2 doctrine: environment art may not use a channel
 * that gameplay has reserved).
 *
 * Measured before: enemy tier is encoded as HUE — t1 red `#b05050`, t2 teal
 * `#388098`, t3 purple `#705090`, t4 gold `#b0a040` — while rocks sat 53–67% in
 * the t2-teal hue bin and `tree4` 56% in the t4-gold bin. Saturation was
 * inverted on top of that: the environment averaged **43.9%** saturation
 * against the units' **38.4%**, and the two loudest trees (51.9 and 50.8) beat
 * every unit on the field.
 *
 * One pass over the baked terrain fixes all of it at once, and it costs nothing
 * per frame because the terrain is baked once per map:
 *
 *  - saturation ×0.62, so the environment can no longer carry hue information
 *    at all and the units become the most saturated things on screen;
 *  - contrast pulled toward a mid pivot and the whole thing dropped a little,
 *    opening a value gap under the units (whose own contrast now comes from the
 *    baked contour, see `pixmap.ts`);
 *  - a small warm push, because the brand is warm storybook and a desaturated
 *    green otherwise reads grey.
 */
const ENV_SAT = 0.62
const ENV_CONTRAST = 0.97
const ENV_PIVOT = 118
const ENV_LIFT = 2
const ENV_WARM_R = 12
const ENV_WARM_G = 4
const ENV_WARM_B = -7
/** A season's accent keeps its hue but a little less chroma than the rest, so the units stay the most saturated thing on screen. */
const ACCENT_SAT = 0.88

/**
 * ── the last reserved channel the uniform grade did not clear (minor) ───────
 *
 * Measured after the first pass: teal (t2) and purple (t3) really are at 0.0%
 * of the environment's hue-carrying pixels and red (t1) at 0.2% — but the
 * 30–60° bin still held **28.4%**, because that bin is the dirt lane and
 * `#b0a040` (tier 4) sits at 51°. Gold is what a champion wears while standing
 * on that lane, so it is the one remaining collision that costs a read.
 *
 * Two things were tried before this one, and both are worth recording because
 * both look obviously right and neither is:
 *
 *  1. **A harder saturation cut in the window.** Scaling every channel toward
 *     luma *preserves the hue angle exactly* — that is what makes it a
 *     saturation operation. With the window's chroma cut to ×0.34 the bin came
 *     back **28.4%, to the decimal**: same pixels, same angle, still above the
 *     12% threshold at which the measurement counts hue as information.
 *  2. **Rotating the arc out of the bin.** Remapping [0°, 90°] → [60°, 90°],
 *     chroma-preserving, with 90° as a fixed point so the lane edge grew no
 *     seam. It works perfectly and the measurement goes to 0.0% in every
 *     reserved bin — and it turns the road green, because *brown is 30–60°*.
 *     There is no hue below 60 that is not either gold (30–60) or red (0–30,
 *     also reserved), so a lane that is out of the bin is a lane that is not
 *     earth. Captured; the field reads as one green sheet with a darker stripe
 *     through it, which fails the level-design checklist's "give the road real
 *     character" to fix a colour-channel overlap. Rejected on the picture.
 *
 * So the reachable fix is the third: cut the reserved window's chroma hard
 * enough that it stops being a hue at all, and stop the grade's own warm push
 * from rebuilding one inside the window. `ENV_WARM_*` is a fixed +12/+4/−7,
 * which is itself a gold cast — it puts a floor under the window's saturation
 * that no amount of desaturation upstream can get under. Inside the window it
 * is blended toward its own neutral mean, so the lane keeps the grade's warmth
 * in VALUE without carrying it as chroma.
 *
 * The residue is reported rather than hidden, and there is a handoff attached:
 * the environment can be pushed to the edge of the threshold but it cannot
 * leave the bin and stay earth, so the last of this belongs to tier 4's own
 * colour (`#d4b24a` / `#b0a040` in `src/game/data/enemies.ts`, another agent's
 * file). Every other reserved bin is at 0.0% and this one is the one where the
 * environment has a legitimate claim to the hue.
 *
 * Runs inside the once-per-map terrain bake, so it costs nothing per frame.
 */
const GOLD_LO = 22
const GOLD_HI = 68
const GOLD_CORE_LO = 30
const GOLD_CORE_HI = 60
/** Chroma kept at the centre of the reserved window, as a fraction of ENV_SAT. */
const GOLD_KEEP = 0.36
/** The warm push, hue-neutralised — same mean value, no colour. */
const WARM_MEAN = (ENV_WARM_R + ENV_WARM_G + ENV_WARM_B) / 3

/**
 * The wood's shade (grid-fit). The old field carried a vignette and the apron
 * a flat 34% step at the field's edge; one continuous map has neither. The
 * ground darkens smoothly with its distance from the playable rectangle —
 * nothing at its edge, {@link SHADE_MAX} by {@link SHADE_REACH} px out — so the
 * lit meadow sits in a deepening wood with no line anywhere.
 */
const SHADE_MAX = 0.5
const SHADE_REACH = 420

/**
 * Tier 1's red window (0–30°, feathered 340–350° and 24–30°), cut only on a
 * season's paint near the play (`season.ACCENT_PAINT`): the plain field has
 * no red to cut, and the danger ground (fire) is never season paint.
 */
function redWeight(hue: number): number {
  if (hue <= 24 || hue >= 350) return 1
  if (hue < 30) return (30 - hue) / 6
  if (hue > 340) return (hue - 340) / 10
  return 0
}

/**
 * A near tree's hue (`season.ACCENT_SHIFT`): the tiers' warm arc, 340° round
 * to 68°, laid in order onto 70–78° (rust to ochre, amber to a yellowing olive) — the
 * green side of yellow, short of the pines' and the meadow's green; -1 for a
 * hue outside it, which is kept.
 */
// 70–78° (Oct 2026 asset critique; it was 75–90°): the near maples read as
// yellowing birch, not as summer trees standing in an autumn wood.
const SHIFT_LO = 70
const SHIFT_HI = 78
function shiftedHue(hue: number): number {
  const h = hue >= 340 ? hue - 360 : hue
  if (h < -20 || h > GOLD_HI) return -1
  return SHIFT_LO + ((h + 20) / (GOLD_HI + 20)) * (SHIFT_HI - SHIFT_LO)
}

/** An RGB with this max and min channel (so value and chroma) at `hue`. */
function hueRgb(hue: number, mx: number, mn: number): [number, number, number] {
  const c = mx - mn
  const hp = hue / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x]
  return [r + mn, g + mn, b + mn]
}

/** 0 outside the feathered reserved window, 1 across its core. */
function goldWeight(hue: number): number {
  if (hue <= GOLD_LO || hue >= GOLD_HI) return 0
  if (hue >= GOLD_CORE_LO && hue <= GOLD_CORE_HI) return 1
  return hue < GOLD_CORE_LO
    ? (hue - GOLD_LO) / (GOLD_CORE_LO - GOLD_LO)
    : (GOLD_HI - hue) / (GOLD_HI - GOLD_CORE_HI)
}

export function gradeEnvironment(ctx: CanvasRenderingContext2D, w: number, h: number, lit?: { x0: number; y0: number; x1: number; y1: number }, accent?: Uint8Array): void {
  const id = ctx.getImageData(0, 0, w, h)
  const d = id.data
  // The shade per column and per row, so the per-pixel cost is one max.
  const colOut = new Float32Array(w)
  const rowOut = new Float32Array(h)
  if (lit) {
    for (let x = 0; x < w; x++) colOut[x] = Math.max(0, lit.x0 - x, x - lit.x1)
    for (let y = 0; y < h; y++) rowOut[y] = Math.max(0, lit.y0 - y, y - lit.y1)
  }
  let i = 0
  for (let y = 0; y < h; y++) {
    const ry = rowOut[y]
    for (let x = 0; x < w; x++, i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2]
      let yl = 0.299 * r + 0.587 * g + 0.114 * b
      // Hue, by the standard six-sector formula — no trig, one divide.
      const mx = r > g ? (r > b ? r : b) : g > b ? g : b
      const mn = r < g ? (r < b ? r : b) : g < b ? g : b
      const dl = mx - mn
      let gw = 0
      // A season's own accent (`render/season.ts`) keeps its hue through the
      // gold window and takes the warm push as value only: the harvest's
      // props and far trees, the snow's cool white. It is still desaturated
      // like the rest. Its paint near the play (`ACCENT_PAINT`) keeps its hue
      // only where no tier wears it: in the red or the gold window it is cut
      // like the environment's own — red too, which the plain field never
      // carries but the harvest's rust would.
      const mark = accent === undefined ? 0 : accent[i >> 2]
      let acc = mark === ACCENT_KEEP || mark === ACCENT_SHIFT || (mark === ACCENT_PAINT && dl === 0)
      if (mark === ACCENT_SHIFT && dl > 0) {
        const raw = 60 * (mx === r ? (g - b) / dl : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4)
        const to = shiftedHue(raw < 0 ? raw + 360 : raw)
        if (to >= 0) {
          // Same max, same min (value and chroma kept), the new hue.
          const [sr, sg, sb] = hueRgb(to, mx, mn)
          r = sr
          g = sg
          b = sb
          yl = 0.299 * r + 0.587 * g + 0.114 * b
        }
      }
      if (dl > 0 && !acc) {
        const raw = 60 * (mx === r ? (g - b) / dl : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4)
        const hue = raw < 0 ? raw + 360 : raw
        gw = goldWeight(hue)
        if (mark === ACCENT_PAINT) {
          const wt = Math.max(gw, redWeight(hue))
          if (wt > 0) gw = wt
          else acc = true
        }
      }
      const sat = acc ? ENV_SAT * ACCENT_SAT : gw > 0 ? ENV_SAT * (1 - (1 - GOLD_KEEP) * gw) : ENV_SAT
      const wk = acc ? 1 : gw
      const wr = ENV_WARM_R + (WARM_MEAN - ENV_WARM_R) * wk
      const wg = ENV_WARM_G + (WARM_MEAN - ENV_WARM_G) * wk
      const wb = ENV_WARM_B + (WARM_MEAN - ENV_WARM_B) * wk
      let nr = yl + (r - yl) * sat
      let ng = yl + (g - yl) * sat
      let nb = yl + (b - yl) * sat
      nr = ENV_PIVOT + (nr - ENV_PIVOT) * ENV_CONTRAST + ENV_LIFT + wr
      ng = ENV_PIVOT + (ng - ENV_PIVOT) * ENV_CONTRAST + ENV_LIFT + wg
      nb = ENV_PIVOT + (nb - ENV_PIVOT) * ENV_CONTRAST + ENV_LIFT + wb
      if (lit) {
        const out = colOut[x] > ry ? colOut[x] : ry
        if (out > 0) {
          const t = out >= SHADE_REACH ? 1 : out / SHADE_REACH
          // Ease in, so the first tiles past the edge barely change.
          const k = 1 - SHADE_MAX * t * t * (3 - 2 * t)
          // Toward the page's warm near-black (18,11,5), not grey.
          nr = 18 + (nr - 18) * k
          ng = 11 + (ng - 11) * k
          nb = 5 + (nb - 5) * k
        }
      }
      d[i] = nr < 0 ? 0 : nr > 255 ? 255 : nr
      d[i + 1] = ng < 0 ? 0 : ng > 255 ? 255 : ng
      d[i + 2] = nb < 0 ? 0 : nb > 255 ? 255 : nb
    }
  }
  ctx.putImageData(id, 0, 0)
}

/**
 * Where a season's props stand on a field (tests and the review): the flat
 * ones and the upright ones, with the field's own dressing as the bake sees
 * it. Pure — no canvas, no RNG stream.
 */
export function seasonPropsFor(map: GameMap, season: FieldSeason): { flat: { x: number; y: number; kind: PropKind }[]; upright: { x: number; y: number; kind: PropKind }[] } {
  const s = seasonScenery(map, getDressing(map), season, hashStr(`${map.id}|${season.name}`))
  return { flat: s.flat, upright: s.upright }
}
