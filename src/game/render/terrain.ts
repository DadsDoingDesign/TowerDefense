/**
 * The static field: terrain, level dressing, the environment grade and the
 * base plate — baked once per map into an offscreen canvas and blitted.
 */
import type { Vec2 } from '../core/vec'
import type { GameMap } from '../types'
import { pixmap } from './pixmap'
import { onSpritesReady, spriteFor } from './sprites'
import { getActiveStyle } from './themes'
import { COLORS, darken, lighten, mix, roundRect, strokePolyline, toRgb } from './paint'

// ── Static terrain, baked once per map (H19) ────────────────────────────────
/**
 * `drawField` used to re-render the whole static world EVERY frame: a
 * `createPattern` allocation, ~20 radial gradients, ~100 tuft strokes, ~170
 * speck arcs, ~135 edge tufts, a fresh vignette gradient and 30 decoration
 * blits — measured at 497 `beginPath`, 985 `moveTo`, 252 `stroke`, 246 `fill`
 * and 213 `arc` per frame, none of which ever changed. The dressing *geometry*
 * was cached; the *pixels* were not.
 *
 * Now the whole static layer is composed once into a 960×560 offscreen canvas —
 * at 1:1 with the logical field, so it is also the surface every sprite draws
 * into at exactly 1.000 scale — and blitted with a single `drawImage`.
 *
 * The cache key carries the sprite-ready flag because the terrain looks
 * different before and after the pack decodes, and `onSpritesReady` drops the
 * bake so the first fully-dressed frame is the one that sticks.
 */
/**
 * Two bakes, most recent first (Portrait battlefields): the menu's attract
 * battle draws the landscape Green Line while a phone battle is fought on a
 * portrait twin, and a one-entry cache re-baked (and re-graded, pixel by pixel)
 * the whole field on every trip between them.
 */
const TERRAIN_CACHE_SIZE = 2
let terrainCache: { key: string; canvas: HTMLCanvasElement }[] = []
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
  const c = document.createElement('canvas')
  c.width = map.width
  c.height = map.height
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false
  const road = spriteFor('road')
  drawSpriteTerrain(ctx, map, grass, road, style.path.edge, style.path.fill)
  // The environment is graded AFTER the dressing goes down and BEFORE the base
  // marker, so the grade reaches the decoration sprites (which is where the
  // reserved-channel violation lived) and never touches a gameplay glyph.
  gradeEnvironment(ctx, map.width, map.height)
  vignette(ctx, map.width, map.height)
  drawBase(ctx, map.base)
  return c
}

/** Full background: gradient field + subtle grid + path + base marker. */
export function drawField(ctx: CanvasRenderingContext2D, map: GameMap): void {
  const style = getActiveStyle()

  // Sprite themes tile real terrain, then fall back to procedural if not loaded.
  if (style.sprites) {
    // The pack stamp is in the key so a re-exported sprite pack re-bakes rather
    // than leaving a terrain built from the old art on screen.
    const key = `${style.id}:${map.id}:${map.width}x${map.height}:${decoStamp()}:${artStamp('grass')}:${artStamp('road')}`
    let hit = terrainCache.find((e) => e.key === key)
    if (!hit) {
      const baked = bakeTerrain(map)
      if (baked) {
        hit = { key, canvas: baked }
        terrainCache = [hit, ...terrainCache].slice(0, TERRAIN_CACHE_SIZE)
      }
    } else if (terrainCache[0] !== hit) {
      terrainCache = [hit, ...terrainCache.filter((e) => e !== hit)]
    }
    if (hit) {
      ctx.drawImage(hit.canvas, 0, 0)
      return
    }
  }

  const grad = ctx.createLinearGradient(0, 0, 0, map.height)
  grad.addColorStop(0, style.field.top)
  grad.addColorStop(1, style.field.bottom)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, map.width, map.height)

  ctx.strokeStyle = style.field.grid
  ctx.lineWidth = 1
  ctx.beginPath()
  const step = style.field.gridStep
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
  drawPath(ctx, map.path)
  drawBase(ctx, map.base)
}

// ── Terrain pieces (G1-2) ──────────────────────────────────────────────────
/**
 * The ground under each blocked terrain tile, baked with the rest of the field.
 *
 *  - **Water** is Tiny Swords' own flat water (`#47aba9`, `fx/water.png`) with
 *    its foam rim (`#c6f0db` on `#458597`, `fx/foam.png`), drawn as one shape
 *    per lake: neighbouring water tiles are bridged, so two tiles make one
 *    pond, not two puddles.
 *  - **Fire** is scorched earth — a charcoal patch with embers — under the
 *    animated flames `drawTerrainFlames` stands on it every frame.
 *  - **Rock** is a darker patch of ground the boulder sprites (dressing) sit
 *    on, so a rock tile differs from grass in value as well as in shape.
 *
 * Every piece is inset from its tile edge where the neighbour is not the same
 * kind, so the grid's tile boundaries stay legible when a hero is armed; and a
 * side the ROAD runs along (roads follow tile edges, `maps.ts`) keeps clear of
 * the dirt, so a pond never runs into the lane.
 */
const WATER = '#47aba9'
const FOAM = '#c6f0db'
const FOAM_EDGE = '#458597'
/** Clearance from the lane's centre line on a road side: 25px of dirt + 6 of grass. */
const ROAD_INSET = 31

type Rect = { x0: number; y0: number; x1: number; y1: number }
type Tile = NonNullable<GameMap['tiles']>[number]

/**
 * A piece's shape as rectangles: one core per tile (inset on every side, more
 * on a road side) plus a square BRIDGE across each shared edge to a same-kind
 * neighbour. Bridges, not grown cores: a core grown into two neighbours pokes
 * a rounded corner into the diagonal tile at an L, which read as a notch.
 */
function pieceShape(map: GameMap, kind: string, inset: number, r: number): { cores: Rect[]; bridges: Rect[] } {
  const tiles = (map.tiles ?? []).filter((t) => t.block === kind)
  const T = map.tile ?? 80
  const h = T / 2
  const at = new Map(tiles.map((t) => [`${t.col},${t.row}`, t]))
  const roadOn = (x: number, y: number) => distToPath(x, y, map.path) <= 27
  const core = (t: Tile): Rect => {
    const side = (dc: number, dr: number) => (roadOn(t.pos.x + dc * h, t.pos.y + dr * h) ? Math.max(inset, ROAD_INSET) : inset)
    return { x0: t.pos.x - h + side(-1, 0), x1: t.pos.x + h - side(1, 0), y0: t.pos.y - h + side(0, -1), y1: t.pos.y + h - side(0, 1) }
  }
  const cores = new Map(tiles.map((t) => [t.id, core(t)]))
  const bridges: Rect[] = []
  for (const t of tiles) {
    const a = cores.get(t.id)!
    // Right and down only, so each shared edge is bridged once; never across
    // the road.
    const right = at.get(`${t.col + 1},${t.row}`)
    if (right && !roadOn(t.pos.x + h, t.pos.y)) {
      const b = cores.get(right.id)!
      bridges.push({ x0: a.x1 - r, x1: b.x0 + r, y0: Math.max(a.y0, b.y0), y1: Math.min(a.y1, b.y1) })
    }
    const down = at.get(`${t.col},${t.row + 1}`)
    if (down && !roadOn(t.pos.x, t.pos.y + h)) {
      const b = cores.get(down.id)!
      bridges.push({ x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), y0: a.y1 - r, y1: b.y0 + r })
    }
  }
  return { cores: [...cores.values()], bridges }
}

function fillShape(ctx: CanvasRenderingContext2D, s: { cores: Rect[]; bridges: Rect[] }, r: number): void {
  for (const c of s.cores) {
    roundRect(ctx, c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0, r)
    ctx.fill()
  }
  for (const b of s.bridges) if (b.x1 > b.x0 && b.y1 > b.y0) ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0)
}

/** Where a burning tile's scorch sits (its core), for the flames to stand in. */
function scorchOf(map: GameMap, t: Tile): Rect {
  const s = pieceShape({ ...map, tiles: [t] }, 'fire', 7, 0)
  return s.cores[0]
}

function drawTerrainGround(ctx: CanvasRenderingContext2D, map: GameMap, green: string): void {
  const tiles = map.tiles
  if (!tiles?.length) return
  const T = map.tile ?? 80
  if (tiles.some((t) => t.block === 'water')) {
    // Three passes over the whole lake so rims never draw over a neighbour's
    // water: dark edge, then foam, then water.
    const passes: [string, number][] = [
      [FOAM_EDGE, 3],
      [FOAM, 5],
      [WATER, 10],
    ]
    for (const [col, inset] of passes) {
      const r = Math.max(8, 25 - inset)
      ctx.fillStyle = col
      fillShape(ctx, pieceShape(map, 'water', inset, r), r)
    }
    // A few flat ripples, the way the pack's water is lit, kept inside each
    // tile's water.
    ctx.strokeStyle = 'rgba(198,240,219,0.55)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (const c of pieceShape(map, 'water', 16, 0).cores) {
      const seed = mulberry32((Math.round(c.x0) * 928371 + Math.round(c.y0) * 1237) >>> 0)
      for (let i = 0; i < 2; i++) {
        const w = 8 + seed() * 8
        const x = c.x0 + w / 2 + seed() * Math.max(0, c.x1 - c.x0 - w)
        const y = c.y0 + seed() * (c.y1 - c.y0)
        ctx.beginPath()
        ctx.moveTo(Math.round(x - w / 2), Math.round(y))
        ctx.lineTo(Math.round(x + w / 2), Math.round(y))
        ctx.stroke()
      }
    }
  }
  if (tiles.some((t) => t.block === 'fire')) {
    // Scorched earth: charcoal, with a warm rim where the grass is burning back.
    ctx.fillStyle = '#6b3a1c'
    fillShape(ctx, pieceShape(map, 'fire', 5, 22), 22)
    ctx.fillStyle = '#2b1d17'
    fillShape(ctx, pieceShape(map, 'fire', 9, 18), 18)
    for (const t of tiles) {
      if (t.block !== 'fire') continue
      const c = scorchOf(map, t)
      const seed = mulberry32((t.col * 7919 + t.row * 104729) >>> 0)
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = i % 3 ? '#e0772e' : '#f3c14d'
        ctx.fillRect(Math.round(c.x0 + 6 + seed() * (c.x1 - c.x0 - 12)), Math.round(c.y0 + 6 + seed() * (c.y1 - c.y0 - 12)), 2, 2)
      }
    }
  }
  for (const t of tiles) {
    if (t.block !== 'rock') continue
    // Worn ground under the boulders: the grass, darker — a value change
    // under the cluster so the tile separates from the meadow.
    ctx.fillStyle = withAlpha(darken(green, 0.35), 0.45)
    ctx.beginPath()
    ctx.ellipse(t.pos.x + 2, t.pos.y + 12, T * 0.42, T * 0.24, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

/**
 * The standing flames on a Wildfire's burning tiles (G1-2) — drawn every frame
 * over the baked scorch, two per tile out of phase, both standing inside the
 * scorch (which keeps off the road). The fire sheet is the pack's own
 * (`fx/fire.png`), at the field's one density.
 */
export function drawTerrainFlames(
  map: GameMap,
  drawFlame: (x: number, y: number, phase: number) => void,
): void {
  if (!map.tiles) return
  for (const t of map.tiles) {
    if (t.block !== 'fire') continue
    const c = scorchOf(map, t)
    const cx = (c.x0 + c.x1) / 2
    const cy = (c.y0 + c.y1) / 2
    const dx = Math.min(13, (c.x1 - c.x0) / 2 - 12)
    drawFlame(cx - dx, cy + 12, t.col * 3 + t.row)
    drawFlame(cx + dx, cy + 2, t.col * 5 + t.row * 2 + 3)
  }
}


function drawPath(ctx: CanvasRenderingContext2D, pts: Vec2[]): void {
  const p = getActiveStyle().path
  ctx.lineJoin = 'round'
  ctx.lineCap = p.cap

  ctx.strokeStyle = p.edge
  ctx.lineWidth = p.edgeWidth
  strokePolyline(ctx, pts)

  ctx.strokeStyle = p.fill
  ctx.lineWidth = p.fillWidth
  strokePolyline(ctx, pts)

  ctx.strokeStyle = p.center
  ctx.lineWidth = 2
  if (p.dash) ctx.setLineDash(p.dash)
  strokePolyline(ctx, pts)
  ctx.setLineDash([])
}

/**
 * Tile the grass field and lay the dirt lane (sprite themes). Design goals
 * (per the level-design review): keep the interior readable — trees frame the
 * map at its margins, never in the play area — give the grass low-contrast
 * tonal life so it isn't a solid block, and give the road real character
 * (dirt speckle, worn ruts, a broken tufted edge).
 */
function drawSpriteTerrain(
  ctx: CanvasRenderingContext2D,
  map: GameMap,
  grass: DrawnArt,
  road: DrawnArt | undefined,
  edgeColor: string,
  fillColor: string,
): void {
  const style = getActiveStyle()
  const green = mix(style.field.top, style.field.bottom, 0.5)
  const dr = getDressing(map)

  // Base grass tiles + a whisper of darkening so bright units pop.
  //
  // The tile used to be stretched ×1.4 — the ONLY asset on the field that was
  // upscaled, which is why terrain pixels measured 2.2× the hero's and 6.5× a
  // barrel's. It is box-filtered to the same ×½ density as everything else now
  // and tiled 1:1, so one grass pixel is one unit pixel.
  const gpm = pixmap(grass.img, { scale: grass.spriteScale })
  const gp = ctx.createPattern(gpm ? (gpm.img as CanvasImageSource) : grass.img, 'repeat')!
  ctx.fillStyle = gp
  ctx.fillRect(0, 0, map.width, map.height)
  ctx.fillStyle = 'rgba(0,0,0,0.06)'
  ctx.fillRect(0, 0, map.width, map.height)

  drawGrassDetail(ctx, dr, green)
  // Terrain pieces' ground (G1-2): lakes, scorched earth, bare soil under rock.
  drawTerrainGround(ctx, map, green)

  // The dirt lane: dark grassy edge, mid fill, worn lighter centre.
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = edgeColor
  ctx.lineWidth = 50
  strokePolyline(ctx, map.path)
  if (road) {
    const rpm = pixmap(road.img, { scale: road.spriteScale })
    const rp = ctx.createPattern(rpm ? (rpm.img as CanvasImageSource) : road.img, 'repeat')!
    ctx.strokeStyle = rp
    ctx.lineWidth = 40
    strokePolyline(ctx, map.path)
  } else {
    ctx.strokeStyle = fillColor
    ctx.lineWidth = 40
    strokePolyline(ctx, map.path)
    ctx.strokeStyle = lighten(fillColor, 0.1)
    ctx.lineWidth = 20
    strokePolyline(ctx, map.path)
  }
  drawPathDetail(ctx, dr, fillColor, green)

  drawDecos(ctx, dr)
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
function samplePath(pts: Vec2[], spacing: number) {
  const out: { x: number; y: number; tx: number; ty: number; nx: number; ny: number }[] = []
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const tx = dx / len, ty = dy / len
    for (let d = 0; d < len; d += spacing) out.push({ x: a.x + tx * d, y: a.y + ty * d, tx, ty, nx: -ty, ny: tx })
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
 * DRAWN HEIGHT, and report the shallowest anchor a tree may take without its
 * crown being clipped off the top of the field (nine of thirty trees were, in
 * the state this replaced).
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

function buildDressing(map: GameMap): Dressing {
  const rng = mulberry32(((map.width * 73856093) ^ (map.height * 19349663) ^ (map.path.length * 83492791)) >>> 0)
  const W = map.width, H = map.height
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)]

  // Grass: soft tonal blobs + tufts + occasional flowers (all low contrast).
  const blobs: Blob[] = []
  // Denser and stronger than they were. Desaturating the environment (see
  // `gradeEnvironment`) also flattens it, and the first graded pass read as one
  // dead olive sheet — the checklist's "no large flat areas" failing in the
  // course of fixing the checklist's saturation failure. Large, soft, LOW-
  // frequency value patches are the right answer: they give the ground life at
  // a scale no unit competes with, unlike local contrast, which does.
  for (let i = Math.round((W * H) / 24000) + 6; i > 0; i--) blobs.push({ x: rng() * W, y: rng() * H, r: 58 + rng() * 116, light: rng() < 0.5 })
  const tufts: Dressing['tufts'] = []
  for (let i = Math.round((W * H) / 4200); i > 0; i--) {
    const x = rng() * W, y = rng() * H
    if (distToPath(x, y, map.path) < 24) continue
    tufts.push({ x, y, s: 3 + rng() * 3.4, a: 0.34 + rng() * 0.3 })
  }
  const flowers: Dressing['flowers'] = []
  for (let i = Math.round((W * H) / 24000); i > 0; i--) {
    const x = rng() * W, y = rng() * H
    if (distToPath(x, y, map.path) < 26) continue
    flowers.push({ x, y, c: Math.floor(rng() * 4) })
  }

  // Path: dirt speckle, worn ruts, grass tufts breaking the outline.
  const specks: Speck[] = [], ruts: Rut[] = [], edgeTufts: Dressing['edgeTufts'] = []
  const half = 15
  for (const s of samplePath(map.path, 10)) {
    if (rng() < 0.85) specks.push({ x: s.x + s.nx * (rng() * 2 - 1) * half, y: s.y + s.ny * (rng() * 2 - 1) * half, r: 1.2 + rng() * 2, light: rng() < 0.45 })
    if (rng() < 0.5) for (const o of [-7, 7]) ruts.push({ x: s.x + s.nx * o, y: s.y + s.ny * o, tx: s.tx, ty: s.ty })
    for (const o of [-(half + 2), half + 2]) if (rng() < 0.34) edgeTufts.push({ x: s.x + s.nx * o + (rng() - 0.5) * 6, y: s.y + s.ny * o + (rng() - 0.5) * 5, r: 2.4 + rng() * 2 })
  }

  // Decorations (G1-2): driven by the deployment grid, not scattered.
  //
  // Deployment is free-form on a tile grid now, and a decoration is no longer
  // only dressing — it is how a player reads that a tile is blocked. So the
  // rule is one-to-one: **every blocked tile shows its reason, and no open
  // tile carries anything that looks like one.** The forest frame is trees on
  // the outer ring of tiles (and in a portrait twin's side pads, which are
  // outside the grid), a rock tile is a boulder cluster on bare soil, and open
  // grass keeps only the flat detail above (blobs, tufts, flowers). The old
  // pebble litter across the meadow is gone: a pebble on an open tile would
  // say "rock" about a tile a hero can stand on.
  //
  // What stays from the measured passes this replaced: one density (the pool
  // carries the size range, no random scale), nothing taller than the biggest
  // unit (`DECO_CEIL`), nothing clipped off the top of the field, and nothing
  // leaning over the lane — every tree is still tested along its whole trunk
  // (`clearSprite`), because a canopy over the road hides the thing the game
  // is about.
  const decos: Deco[] = []
  const { trees: TREES, litter: LITTER, height: DH } = decoPools()
  const T = map.tile ?? 80
  const tiles = map.tiles ?? []
  const at = new Map(tiles.map((t) => [`${t.col},${t.row}`, t]))
  const clearSprite = (x: number, y: number, h: number, m: number) =>
    distToPath(x, y, map.path) > m &&
    distToPath(x, y - h * 0.5, map.path) > m * 0.86 &&
    distToPath(x, y - h * 0.88, map.path) > m * 0.72
  const put = (x: number, y: number, name: string, margin = 34) => {
    const h = DH[name] ?? 0
    if (y - h < 0 || y > H) return false
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

  for (const t of tiles) {
    const x0 = t.pos.x - T / 2
    const y0 = t.pos.y - T / 2
    const y1 = t.pos.y + T / 2
    if (t.block === 'forest') {
      const above = at.get(`${t.col},${t.row - 1}`)
      const below = at.get(`${t.col},${t.row + 1}`)
      // How tall a tree this tile can hold: up into the tile above when that is
      // forest too (the canopy layers), 12px into open grass (a crown tip, never
      // a trunk), not at all into the lane.
      const canopyTop = !above ? 0 : above.block === 'forest' ? above.pos.y - T / 2 : above.block === 'lane' ? y0 : y0 - 12
      // Top-row tiles stand their tree a few px into the tile below (never the
      // lane) rather than clip its crown off the field's edge.
      const dip = !above && below && below.block !== 'lane' ? 12 : 0
      const baseY = y1 - 3 + dip - Math.floor(rng() * 3)
      const x = t.pos.x + (rng() - 0.5) * 14
      const tree = treesByHeight.find((n) => baseY - (DH[n] ?? 0) >= Math.max(0, canopyTop))
      if (!(tree && put(x, baseY, tree))) {
        // No tree fits: a thicket instead, two shrubs across the tile, each at
        // the lowest spot in it that stays off the road.
        for (const fx of [0.3, 0.7]) {
          const name = pick(shrubs)
          for (let yy = y1 - 8 - Math.floor(rng() * 6); yy > y0 + (DH[name] ?? 20); yy -= 6) {
            if (put(x0 + T * fx + (rng() - 0.5) * 8, yy, name, 30)) break
          }
        }
      }
      // Undergrowth at the tree's foot, off to one side.
      if (rng() < 0.55) put(x + (rng() < 0.5 ? -22 : 22), baseY - 2, pick(shrubs), 26)
    } else if (t.block === 'rock') {
      // A boulder cluster: two big stones and a small one, drawn at the pack's
      // NATIVE density — the density the units stand at (`unitPixmapScale`) —
      // so a rock tile reads as "rock" at 44 CSS px and not as a pebble. At the
      // ×½ litter density the biggest stone was 23px on an 80px tile.
      const big = [...boulders].sort((a, b) => (DH[b] ?? 0) - (DH[a] ?? 0))
      const native = (x: number, y: number, name: string | undefined) => {
        if (!name) return
        decos.push({ x: Math.round(x), y: Math.round(y), name, flip: rng() < 0.5, native: true })
      }
      native(t.pos.x + 12, t.pos.y + 4, big[1] ?? big[0])
      native(t.pos.x - 9, t.pos.y + 20, big[0])
      native(t.pos.x + 20, t.pos.y + 26, big[big.length - 1])
    }
  }
  // A portrait twin's side pads sit outside the grid: forest, like the ring.
  if (map.orientation === 'portrait') {
    const padW = tiles.length ? Math.min(...tiles.map((t) => t.pos.x)) - T / 2 : 0
    if (padW > 0) {
      for (const px of [padW / 2, W - padW / 2]) {
        for (let y = (DH[treesByHeight[0]] ?? 88) + 2; y < H - 2; y += 58 + Math.floor(rng() * 22)) {
          put(px + (rng() - 0.5) * 8, y, pick(treesByHeight) ?? TREES[0], 30)
        }
      }
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

function drawDecos(ctx: CanvasRenderingContext2D, dr: Dressing): void {
  if (!getActiveStyle().sprites) return
  for (const d of dr.decos) {
    const spr = spriteFor(d.name)
    if (!spr) continue
    const pm = pixmap(spr.img, { scale: d.native ? 1 : spr.spriteScale })
    if (!pm) continue
    const w = pm.fw, h = pm.fh
    // Contact shadow — kept on all three object classes, per the checklist.
    ctx.beginPath()
    ctx.ellipse(d.x, d.y - 2, w * 0.34, w * 0.14, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.20)'
    ctx.fill()
    const x = d.x - Math.round(w / 2)
    const y = d.y - h
    if (d.flip) {
      ctx.save()
      ctx.translate(d.x, 0)
      ctx.scale(-1, 1)
      ctx.translate(-d.x, 0)
      ctx.drawImage(pm.img, x, y, w, h)
      ctx.restore()
    } else {
      ctx.drawImage(pm.img, x, y, w, h)
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

/** 0 outside the feathered reserved window, 1 across its core. */
function goldWeight(hue: number): number {
  if (hue <= GOLD_LO || hue >= GOLD_HI) return 0
  if (hue >= GOLD_CORE_LO && hue <= GOLD_CORE_HI) return 1
  return hue < GOLD_CORE_LO
    ? (hue - GOLD_LO) / (GOLD_CORE_LO - GOLD_LO)
    : (GOLD_HI - hue) / (GOLD_HI - GOLD_CORE_HI)
}

export function gradeEnvironment(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const id = ctx.getImageData(0, 0, w, h)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2]
    const y = 0.299 * r + 0.587 * g + 0.114 * b
    // Hue, by the standard six-sector formula — no trig, one divide.
    const mx = r > g ? (r > b ? r : b) : g > b ? g : b
    const mn = r < g ? (r < b ? r : b) : g < b ? g : b
    const dl = mx - mn
    let gw = 0
    if (dl > 0) {
      const raw = 60 * (mx === r ? (g - b) / dl : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4)
      gw = goldWeight(raw < 0 ? raw + 360 : raw)
    }
    const sat = gw > 0 ? ENV_SAT * (1 - (1 - GOLD_KEEP) * gw) : ENV_SAT
    const wr = ENV_WARM_R + (WARM_MEAN - ENV_WARM_R) * gw
    const wg = ENV_WARM_G + (WARM_MEAN - ENV_WARM_G) * gw
    const wb = ENV_WARM_B + (WARM_MEAN - ENV_WARM_B) * gw
    let nr = y + (r - y) * sat
    let ng = y + (g - y) * sat
    let nb = y + (b - y) * sat
    nr = ENV_PIVOT + (nr - ENV_PIVOT) * ENV_CONTRAST + ENV_LIFT + wr
    ng = ENV_PIVOT + (ng - ENV_PIVOT) * ENV_CONTRAST + ENV_LIFT + wg
    nb = ENV_PIVOT + (nb - ENV_PIVOT) * ENV_CONTRAST + ENV_LIFT + wb
    d[i] = nr < 0 ? 0 : nr > 255 ? 255 : nr
    d[i + 1] = ng < 0 ? 0 : ng > 255 ? 255 : ng
    d[i + 2] = nb < 0 ? 0 : nb > 255 ? 255 : nb
  }
  ctx.putImageData(id, 0, 0)
}

/** Soft darkening toward the edges so the field reads with depth, not flat. */
function vignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.22)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

function drawBase(ctx: CanvasRenderingContext2D, base: Vec2): void {
  ctx.save()
  ctx.translate(base.x - 6, base.y)
  // Outer plate
  ctx.fillStyle = COLORS.base
  roundRect(ctx, -26, -30, 52, 60, 8)
  ctx.fill()
  // Core
  ctx.fillStyle = COLORS.baseCore
  ctx.beginPath()
  ctx.arc(0, 0, 12, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
