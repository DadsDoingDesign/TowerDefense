import type { GameEngine, RtEnemy, RtProjectile, RtSentinel } from '../engine/engine'
import { ARCHETYPES } from '../data/sentinels'
import { ENEMY_MODS, ENEMY_TYPES, modKey } from '../data/enemies'
import type { Vec2 } from '../core/vec'
import type { Archetype, EnemyType, GameMap } from '../types'
import { getActiveStyle } from './themes'
import { getSprite, onSpritesReady } from './sprites'
import { ANIM_FRAMES, loopFrame } from './anim'
import { pixmap, quarterTurns, type Pixmap } from './pixmap'
import {
  drawFxDecals,
  drawFxFloaters,
  drawFxParticles,
  emberOf,
  flashOf,
  fxBaseState,
  fxEnemyDot,
  fxEnemyFlash,
  fxEnemyRecoil,
  fxNow,
  fxReducedMotion,
  fxSentinel,
  type ProcKind,
} from './fx'

/**
 * The presentation clock (seconds) — ONE clock for every looping animation on
 * the field. The frame loop advances it by *simulated* time, so towers, enemies,
 * traps and auras pause together and speed up together (M28). It used to read
 * wall-clock time, which left towers idling through a frozen battle and idling
 * at 1× while enemies ran at 3×.
 */
let presentationTime = 0
export const setPresentationTime = (t: number): void => {
  presentationTime = t
}
const animNow = () => presentationTime

export interface View {
  scale: number
  ox: number
  oy: number
}

/** Compute a letterbox transform mapping the logical field into the css box. */
export function fitView(cssW: number, cssH: number, map: GameMap): View {
  const scale = Math.min(cssW / map.width, cssH / map.height)
  const ox = (cssW - map.width * scale) / 2
  const oy = (cssH - map.height * scale) / 2
  return { scale, ox, oy }
}

/** A minimal, uniform description of a tower to draw (works for setup + battle). */
export interface DrawSentinel {
  /** Runtime id — the key the presentation layer files recoil/muzzle/proc under. */
  id: string
  pos: Vec2
  archetype: Archetype
  color: string
  accent: string
  range: number
  aimAngle: number
  fireFlash: number
  hp: number
  maxHp: number
  downed: boolean
  procFlash: number
  patienceStacks: number
  blocking: boolean
}

export function sentinelFromRt(s: RtSentinel): DrawSentinel {
  return {
    id: s.id,
    pos: s.pos,
    archetype: s.def.archetype,
    color: s.def.color,
    accent: s.def.accent,
    range: s.profile.range,
    aimAngle: s.aimAngle,
    fireFlash: s.fireFlash,
    hp: s.hp,
    maxHp: s.maxHp,
    downed: s.downed,
    procFlash: s.procFlash,
    patienceStacks: s.patienceStacks,
    blocking: s.blockIds.length > 0,
  }
}

const COLORS = {
  base: '#3d5a80',
  baseCore: '#98c1d9',
  slot: 'rgba(255,255,255,0.16)',
  slotFill: 'rgba(255,255,255,0.04)',
  slotHover: '#f0a868',
  slotSelected: '#98c1d9',
}

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
let terrainCache: { key: string; canvas: HTMLCanvasElement } | null = null
onSpritesReady(() => {
  terrainCache = null
})
function bakeTerrain(map: GameMap): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const style = getActiveStyle()
  const grass = style.sprites ? getSprite(style.sprites.pack, 'grass') : undefined
  if (!style.sprites || !grass) return null
  const c = document.createElement('canvas')
  c.width = map.width
  c.height = map.height
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.imageSmoothingEnabled = false
  const road = getSprite(style.sprites.pack, 'road')
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
    const key = `${style.id}:${map.id}:${map.width}x${map.height}:${
      style.sprites ? DECO_NAMES.map((n) => getSprite(style.sprites!.pack, n)?.naturalHeight ?? 0).join(',') : ''
    }`
    if (!terrainCache || terrainCache.key !== key) {
      const baked = bakeTerrain(map)
      terrainCache = baked ? { key, canvas: baked } : null
    }
    if (terrainCache) {
      ctx.drawImage(terrainCache.canvas, 0, 0)
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

  drawPath(ctx, map.path)
  drawBase(ctx, map.base)
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

function strokePolyline(ctx: CanvasRenderingContext2D, pts: Vec2[]): void {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.stroke()
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
  grass: HTMLImageElement,
  road: HTMLImageElement | undefined,
  edgeColor: string,
  fillColor: string,
): void {
  const style = getActiveStyle()
  const green = mix(style.field.top, style.field.bottom, 0.5)
  const dr = getDressing(map)
  const sc = style.sprites!.spriteScale

  // Base grass tiles + a whisper of darkening so bright units pop.
  //
  // The tile used to be stretched ×1.4 — the ONLY asset on the field that was
  // upscaled, which is why terrain pixels measured 2.2× the hero's and 6.5× a
  // barrel's. It is box-filtered to the same ×½ density as everything else now
  // and tiled 1:1, so one grass pixel is one unit pixel.
  const gpm = pixmap(grass, { scale: sc })
  const gp = ctx.createPattern(gpm ? (gpm.img as CanvasImageSource) : grass, 'repeat')!
  ctx.fillStyle = gp
  ctx.fillRect(0, 0, map.width, map.height)
  ctx.fillStyle = 'rgba(0,0,0,0.06)'
  ctx.fillRect(0, 0, map.width, map.height)

  drawGrassDetail(ctx, dr, green)

  // The dirt lane: dark grassy edge, mid fill, worn lighter centre.
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = edgeColor
  ctx.lineWidth = 50
  strokePolyline(ctx, map.path)
  if (road) {
    const rpm = pixmap(road, { scale: sc })
    const rp = ctx.createPattern(rpm ? (rpm.img as CanvasImageSource) : road, 'repeat')!
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
interface Deco { x: number; y: number; name: string; flip: boolean }
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

function mulberry32(seed: number): () => number {
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
function decoPools(): { trees: string[]; litter: string[]; top: number; height: Record<string, number> } {
  const style = getActiveStyle()
  const pack = style.sprites?.pack
  const sc = style.sprites?.spriteScale ?? 1
  const trees: string[] = []
  const litter: string[] = []
  const height: Record<string, number> = {}
  let tallest = 0
  for (const n of DECO_NAMES) {
    const spr = pack ? getSprite(pack, n) : undefined
    if (!spr) continue
    const h = Math.ceil(spr.naturalHeight * sc)
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
  const clearOf = (x: number, y: number, m = 44) =>
    distToPath(x, y, map.path) > m &&
    Math.hypot(x - map.base.x, y - map.base.y) > 70 &&
    !map.slots.some((s) => Math.hypot(x - s.pos.x, y - s.pos.y) < 40)

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

  // Decorations. Three measured problems are being answered here at once.
  //
  // 1. PROPORTION. 28 of the 30 decorations were trees; they covered 35.7% of
  //    the field; `tree2` drew 155–177 logical px against a 61px hero and a
  //    34px tier-1 goblin — 5.2× a tier-1 enemy — and nine of thirty were
  //    clipped off the top edge. Placement was never the problem (`clearOf`
  //    works: 0 of 30 touched the lane or a slot), so the fix is scale and mix.
  // 2. DENSITY. Every deco had a random 0.4–0.72 scale factor. There is one
  //    density now, so the pool itself has to carry the size range.
  // 3. RESERVED CHANNELS. Rocks were ~85% tier-2 teal and `tree4` ~55% tier-4
  //    gold — environment art wearing the hues that encode enemy tier. Grading
  //    (see `gradeEnvironment`) desaturates that away; the mix change means far
  //    less of the field is wearing it in the first place.
  //
  // Which asset counts as a "tree" is DERIVED from its drawn height rather than
  // from its filename (see `decoPools`), because a name is not a size: the pack
  // was re-exported mid-pass and `tree4` went from a 124px tree to a 32px stump
  // while `tree2` lost a third of its height. A hard-coded pool would have gone
  // silently wrong; a height test just reclassified the stump as litter.
  const decos: Deco[] = []
  const { trees: TREES, litter: LITTER, top: TREE_TOP, height: DH } = decoPools()
  /**
   * Clearance is tested along the whole TRUNK, not just at the anchor.
   *
   * `clearOf` asks about the point a decoration stands on, which is the right
   * question for a pebble and the wrong one for a tree: an 88px crown hanging
   * off a base that is a legal 46px from the lane still leans over the lane, and
   * the first pass at this drew a treeline across the top of the map with its
   * canopy sitting on the enemy path. The mid-trunk and crown are checked too,
   * at a relaxing margin — a canopy may come nearer than a trunk, because it is
   * further from where the units walk.
   */
  const clearSprite = (x: number, y: number, h: number, m: number) =>
    clearOf(x, y, m) &&
    distToPath(x, y - h * 0.5, map.path) > m * 0.86 &&
    distToPath(x, y - h * 0.88, map.path) > m * 0.72
  const put = (x: number, y: number, name: string, margin = 46) => {
    if (x < 10 || x > W - 10 || y < (DH[name] ?? 0) + 4 || y > H - 2) return false
    if (!clearSprite(x, y, DH[name] ?? 0, margin)) return false
    decos.push({ x: Math.round(x), y: Math.round(y), name, flip: rng() < 0.5 })
    return true
  }
  /**
   * A treeline that survives the lane. The path hugs the top edge for a third
   * of the map's width, so a single fixed band of trees is simply deleted there
   * — the first pass at this drew four trees on the whole field. Each column
   * therefore gets three candidate depths and takes the first that clears; a
   * blocked column steps inward rather than vanishing, and where no tree fits at
   * all it falls back to litter, so the frame stays continuous without anything
   * leaning over the lane.
   */
  const treeline = (x: number, ys: number[]) => {
    for (const y of ys) if (put(x + (rng() - 0.5) * 16, y + (rng() - 0.5) * 10, pick(TREES))) return
    for (const y of ys) if (put(x + (rng() - 0.5) * 16, y + (rng() - 0.5) * 10, pick(LITTER), 38)) return
  }
  for (let x = 22; x < W - 22; x += 74 + rng() * 40) {
    if (rng() < 0.86) treeline(x, [TREE_TOP + 2, TREE_TOP + 27, TREE_TOP + 54])
    if (rng() < 0.80) treeline(x, [H - 6, H - 31, H - 58])
  }
  for (let y = TREE_TOP + 46; y < H - 44; y += 66 + rng() * 34) {
    if (rng() < 0.72) treeline(22, [y, y + 22])
    if (rng() < 0.72) treeline(W - 22, [y, y + 22])
  }
  // Ground litter. Everything in this pool is shorter than the shortest hero at
  // this density (22 logical px against 32), so none of it can compete with a
  // unit wherever it lands — but it is still kept sparse. The first pass ran
  // this at 0.34/0.62 and scattered ~35 pebbles over the field, which read as
  // gravel rather than as a meadow.
  for (let gx = 52; gx < W - 40; gx += 84) {
    for (let gy = 64; gy < H - 24; gy += 76) {
      const x = gx + (rng() - 0.5) * 58, y = gy + (rng() - 0.5) * 54
      if (rng() < 0.34) put(x, y, pick(LITTER), 40)
    }
  }
  decos.sort((a, b) => a.y - b.y)
  return { blobs, tufts, flowers, specks, ruts, edgeTufts, decos }
}

function getDressing(map: GameMap): Dressing {
  // The pack stamp is part of the key: which asset is a tree and which is
  // litter is decided by measured height, so a re-export has to regenerate the
  // layout rather than reuse one built against the old sizes.
  const pack = getActiveStyle().sprites?.pack
  const stamp = pack ? DECO_NAMES.map((n) => getSprite(pack, n)?.naturalHeight ?? 0).join(',') : ''
  const key = `${map.width}x${map.height}:${map.path.length}:${Math.round(map.path[1]?.x ?? 0)}:${stamp}`
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
  const style = getActiveStyle()
  if (!style.sprites) return
  const sc = style.sprites.spriteScale
  for (const d of dr.decos) {
    const spr = getSprite(style.sprites.pack, d.name)
    if (!spr) continue
    const pm = pixmap(spr, { scale: sc })
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

function gradeEnvironment(ctx: CanvasRenderingContext2D, w: number, h: number): void {
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

export function drawSlot(
  ctx: CanvasRenderingContext2D,
  pos: Vec2,
  state: 'empty' | 'hover' | 'selected',
): void {
  ctx.save()
  ctx.translate(pos.x, pos.y)
  ctx.beginPath()
  ctx.arc(0, 0, 20, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.slotFill
  ctx.fill()
  ctx.setLineDash([4, 5])
  ctx.lineWidth = 2
  ctx.strokeStyle =
    state === 'hover' ? COLORS.slotHover : state === 'selected' ? COLORS.slotSelected : COLORS.slot
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

export function drawRange(ctx: CanvasRenderingContext2D, pos: Vec2, range: number, color: string): void {
  ctx.save()
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, range, 0, Math.PI * 2)
  ctx.fillStyle = hexToRgba(color, 0.06)
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = hexToRgba(color, 0.35)
  ctx.stroke()
  ctx.restore()
}

/**
 * Blit one baked frame at 1:1, with its contour+rim ring underneath.
 *
 * `Math.round` on the destination: the composite is 960×560 = the logical
 * field, so a whole logical px IS a whole texel of the offscreen. Snapping the
 * blit there is what stops the crawl — a moving unit used to land on a
 * different sub-pixel phase every frame, and with nearest-neighbour
 * minification that changed *which* source pixels survived, frame to frame, on
 * every unit in motion. One logical px is 0.41 CSS px at the shipping view, so
 * the snap costs less than half a CSS pixel of position and the final smoothed
 * blit recovers the sub-pixel motion anyway.
 */
function blitPixmap(
  ctx: CanvasRenderingContext2D,
  pm: Pixmap,
  frame: number,
  cx: number,
  by: number,
  flashA = 0,
  dotA = 0,
): void {
  const sx = frame * pm.fw
  const dx = Math.round(cx - pm.fw / 2)
  const dy = Math.round(by - pm.fh)
  if (blitCensus.on) census(ctx, dx, dy)
  if (pm.ring) ctx.drawImage(pm.ring, sx, 0, pm.fw, pm.fh, dx, dy, pm.fw, pm.fh)
  ctx.drawImage(pm.img, sx, 0, pm.fw, pm.fh, dx, dy, pm.fw, pm.fh)
  /**
   * Continuous attrition — burn, thorns, a trap — in the unit's own ember
   * silhouette at a third of the impact flash's alpha (C1).
   *
   * Drawn UNDER the impact flash so a shot landing on a burning enemy still
   * reads as a shot. This is a pulse, not a level: see `fxDotEnemy`.
   */
  if (dotA > 0) {
    const em = emberOf(pm)
    if (em) {
      ctx.save()
      ctx.globalAlpha = Math.min(1, dotA) * 0.34
      ctx.drawImage(em, sx, 0, pm.fw, pm.fh, dx, dy, pm.fw, pm.fh)
      ctx.restore()
    }
  }
  /**
   * The hit mark, and the one change that fixes the most frequent event in the
   * game (impact was ONE white circle over `type.radius`, sitting inside the
   * silhouette rather than being it, and decaying at `dt*4` in GAME time).
   *
   * A white silhouette of the unit's own baked frame, on the same 1:1 cell grid
   * and therefore still a scale-1.000 draw, held for a fixed ~110 REAL ms so it
   * is exactly as readable at 3× as at 1×.
   */
  if (flashA > 0) {
    const fl = flashOf(pm)
    if (fl) {
      ctx.save()
      ctx.globalAlpha = Math.min(1, flashA) * 0.92
      ctx.drawImage(fl, sx, 0, pm.fw, pm.fh, dx, dy, pm.fw, pm.fh)
      ctx.restore()
    }
  }
}

/**
 * The 1.000 invariant, measured on the TRANSFORM as well as the size ratio (M4).
 *
 * The pass that built this pipeline graded itself on `dw/sw × dh/sh === 1.000`
 * and reported zero non-1.000 draws — while 1,935 of ~15,000 field blits, all
 * of them barrels, were being drawn under `ctx.rotate` at fourteen distinct
 * angles, twelve of them non-axis-aligned. A nearest-neighbour rotation of
 * pixel art is the third of the three amateur tells the surrounding comments
 * spend paragraphs eliminating, and the metric could not see it, because a
 * rotated blit is still 1.000 × 1.000. A ratio is not a resample test.
 *
 * So the invariant is stated in full here, in the one function every sprite in
 * the field goes through, and it is four conditions rather than one:
 *
 *   A. size ratio     `dw/sw` and `dh/sh` are exactly 1 — structural: this
 *                     function only ever passes `pm.fw`/`pm.fh` for both.
 *   B. context scale  `|a|` and `|d|` are exactly 1.
 *   C. context skew   `b` and `c` are exactly 0 — no rotation at ANY scale.
 *   D. destination    `dx`, `dy` are whole logical px — structural: `Math.round`.
 *
 * `on` is false by default and the census costs literally nothing until a
 * harness turns it on, because `getTransform()` allocates a `DOMMatrix` and
 * this runs ~70 times a frame.
 */
export const blitCensus = {
  on: false,
  blits: 0,
  /** Violations of B, C and D above. A is structurally impossible here. */
  ctxScaled: 0,
  ctxRotated: 0,
  fracDest: 0,
}
function census(ctx: CanvasRenderingContext2D, dx: number, dy: number): void {
  const t = ctx.getTransform()
  blitCensus.blits++
  if (Math.abs(Math.abs(t.a) - 1) > 1e-9 || Math.abs(Math.abs(t.d) - 1) > 1e-9) blitCensus.ctxScaled++
  if (Math.abs(t.b) > 1e-9 || Math.abs(t.c) > 1e-9) blitCensus.ctxRotated++
  if (dx % 1 !== 0 || dy % 1 !== 0) blitCensus.fracDest++
}

/**
 * The live view scale — logical field px → CSS px — pushed in by `BattleCanvas`
 * whenever the element is laid out.
 *
 * The renderer draws into a 960×560 composite and has no other way to know how
 * far that composite is about to be squeezed, which is exactly how the tier
 * notch ended up **1.11 CSS px wide with a 0.72 px gap** on a 320×568 phone
 * (see `drawTierTag`). Any glyph whose job is to be READ needs a floor
 * expressed in the units the eye lives in, and that floor cannot be computed
 * without this number.
 *
 * Defaults to the shipping phone's 0.406 so a draw before the first layout —
 * or from a harness that never mounts `BattleCanvas` — is sized sanely rather
 * than sized for a desktop.
 */
let viewScale = 0.40625
export const setViewScale = (s: number): void => {
  if (s > 0 && Number.isFinite(s)) viewScale = s
}
export const getViewScale = (): number => viewScale

/**
 * The four procs, each with its own colour AND its own geometry.
 *
 * `procFlash` was one shared `#ffe08a` ring for shock, execute, burn and stun —
 * four mechanics with different costs, different builds and different reasons
 * to care, rendered identically, so the ring told the player only "something
 * procced". Colour alone would not have fixed it either: at the shipping view a
 * tower is ~19 CSS px and two hues at that size are one hue to a deuteranope.
 * So each proc also gets a *shape*: shock a spiked corona, burn a rising triple
 * flame, execute a downward chevron pair, stun four orbiting pips.
 */
function drawProcRing(ctx: CanvasRenderingContext2D, kind: ProcKind, k: number, now: number): void {
  if (!kind || k <= 0) return
  const a = Math.min(1, k)
  const r = 22 + (1 - a) * 5
  const col = kind === 'shock' ? '#bfe9ff' : kind === 'burn' ? '#ff8a3c' : kind === 'execute' ? '#ff5d5d' : '#ffe08a'
  ctx.save()
  ctx.strokeStyle = hexToRgba(col, a * 0.85)
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  if (kind === 'shock') {
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2 + now * 5
      ctx.moveTo(Math.cos(t) * r, Math.sin(t) * r)
      ctx.lineTo(Math.cos(t) * (r + 6), Math.sin(t) * (r + 6))
    }
    ctx.lineWidth = 1.6
    ctx.stroke()
  } else if (kind === 'burn') {
    ctx.beginPath()
    ctx.arc(0, 0, r, 0.3, Math.PI - 0.3)
    ctx.stroke()
    ctx.beginPath()
    for (let i = -1; i <= 1; i++) {
      const x = i * 8
      const h = 9 + Math.sin(now * 14 + i) * 2.5
      ctx.moveTo(x, -r + 4)
      ctx.quadraticCurveTo(x + 3, -r - h * 0.5, x, -r - h)
      ctx.quadraticCurveTo(x - 3, -r - h * 0.5, x, -r + 4)
    }
    ctx.fillStyle = hexToRgba(col, a * 0.8)
    ctx.fill()
  } else if (kind === 'execute') {
    for (const d of [0, 6]) {
      ctx.beginPath()
      ctx.moveTo(-11, -6 + d)
      ctx.lineTo(0, 4 + d)
      ctx.lineTo(11, -6 + d)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.lineWidth = 1.4
    ctx.strokeStyle = hexToRgba(col, a * 0.5)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.lineWidth = 1.4
    ctx.strokeStyle = hexToRgba(col, a * 0.45)
    ctx.stroke()
    ctx.fillStyle = hexToRgba(col, a)
    for (let i = 0; i < 4; i++) {
      const t = (i / 4) * Math.PI * 2 + now * 3.4
      ctx.beginPath()
      ctx.arc(Math.cos(t) * r, Math.sin(t) * r * 0.55 - 6, 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

/** Muzzle flash — "your bullets are too small" applied at the barrel (Nijman). */
function drawMuzzle(ctx: CanvasRenderingContext2D, k: number, angle: number, color: string): void {
  if (k <= 0) return
  const a = Math.min(1, k)
  const len = 13 + a * 9
  const wide = 4 + a * 4
  ctx.save()
  ctx.rotate(angle)
  ctx.globalAlpha = a
  ctx.fillStyle = lighten(color, 0.55)
  ctx.beginPath()
  ctx.moveTo(6, 0)
  ctx.lineTo(6 + len, -wide)
  ctx.lineTo(6 + len * 1.22, 0)
  ctx.lineTo(6 + len, wide)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,246,224,0.9)'
  ctx.beginPath()
  ctx.arc(9, 0, 3 + a * 2.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export function drawSentinel(ctx: CanvasRenderingContext2D, s: DrawSentinel): void {
  const { pos } = s
  const fs = fxSentinel(s.id)
  ctx.save()
  // Snap to the composite's pixel grid — see blitPixmap. The fire recoil is
  // added BEFORE the round, so the whole unit (sprite, ring, HP bar, tier tag)
  // moves together and still lands on a whole logical px.
  ctx.translate(Math.round(pos.x + fs.rx), Math.round(pos.y + fs.ry))

  if (s.downed) {
    // Fallen: a dim marker.
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.arc(0, 0, 13, 0, Math.PI * 2)
    ctx.fillStyle = '#2a2f2c'
    ctx.fill()
    ctx.strokeStyle = '#e05a4f'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#e05a4f'
    ctx.font = 'bold 13px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('✕', 0, 1)
    ctx.restore()
    return
  }

  const pulse = 1 + s.fireFlash * 0.18

  // Proc feedback — differentiated by colour AND geometry (see drawProcRing).
  // Driven off the presentation clock, so a proc tell holds the same ~0.5 REAL
  // seconds at 1× and at 3×; `s.procFlash` decays in game time and at 3× was
  // gone in a sixth of a second.
  drawProcRing(ctx, fs.procKind, fs.proc, animNow())

  // Blocking indicator (holding enemies)
  if (s.blocking) {
    ctx.beginPath()
    ctx.arc(0, 0, 20, -0.5, Math.PI + 0.5)
    ctx.strokeStyle = hexToRgba('#e05a4f', 0.5)
    ctx.lineWidth = 2
    ctx.stroke()
  }

  const style = getActiveStyle()
  const t = style.token
  const r = 15 * pulse
  const pack = style.sprites?.pack
  const idle = pack ? getSprite(pack, `${s.archetype}_idle`) : undefined
  const atk = pack ? getSprite(pack, `${s.archetype}_atk`) : undefined
  const staticSpr = pack ? getSprite(pack, s.archetype) : undefined

  const groundRing = () => {
    ctx.beginPath()
    ctx.ellipse(0, 13, 14, 5, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.32)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(0, 2, 16, 0, Math.PI * 2)
    ctx.strokeStyle = hexToRgba(s.accent, 0.6)
    ctx.lineWidth = 2
    ctx.stroke()
  }

  const towerPm = (() => {
    if (!style.sprites) return null
    const firing = s.fireFlash > 0.05 && !!atk
    const strip = (firing ? atk : idle) ?? idle ?? atk
    if (!strip) return null
    const frames = ANIM_FRAMES[`${s.archetype}_${firing ? 'atk' : 'idle'}`] ?? 1
    const pm = pixmap(strip, { scale: style.sprites.spriteScale, frames, ring: true })
    if (!pm) return null
    const frame = firing
      ? Math.min(frames - 1, Math.floor((1 - Math.max(0, Math.min(1, s.fireFlash))) * frames))
      : loopFrame(animNow(), frames, 6, s.pos.x * 0.05)
    return { pm, frame }
  })()

  if (towerPm) {
    groundRing()
    // Play the attack strip while firing (advances as fireFlash decays), else
    // loop the idle strip.
    //
    // The old code divided a fixed body height by each strip's own source
    // height, so every archetype was forced to the same 60.75 logical px
    // regardless of how tall the art actually is (95 / 79 / 63 px) — three
    // different sprite scales, and two heroes standing side by side differed in
    // pixel density by 1.51×. They all draw at one density now, which means the
    // warrior really is taller than the pawn, which is what the art says.
    // Anchored at the FEET (bottom edge at y = 8), so the taller attack frames
    // grow upward — a raised sword — instead of sinking the character.
    blitPixmap(ctx, towerPm.pm, towerPm.frame, 0, 8)
  } else if (staticSpr) {
    groundRing()
    const pm = pixmap(staticSpr, { scale: style.sprites!.spriteScale, ring: true })
    if (pm) blitPixmap(ctx, pm, 0, 0, 8)
    if (s.fireFlash > 0) {
      ctx.beginPath()
      ctx.arc(0, 2, 18, 0, Math.PI * 2)
      ctx.strokeStyle = hexToRgba(s.accent, s.fireFlash * 0.7)
      ctx.lineWidth = 3
      ctx.stroke()
    }
  } else {
    // Barrel/indicator pointing at target (themes that use it)
    if (t.barrel) {
      ctx.save()
      ctx.rotate(s.aimAngle)
      ctx.fillStyle = s.accent
      roundRect(ctx, 6, -3.5, 18 * pulse, 7, 3)
      ctx.fill()
      ctx.restore()
    }

    if (t.glow > 0) {
      ctx.shadowColor = s.accent
      ctx.shadowBlur = t.glow
    }
    if (t.shape === 'ring') {
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.lineWidth = t.outline + 1
      ctx.strokeStyle = s.color
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(0, 0, r - 4, 0, Math.PI * 2)
      ctx.lineWidth = 2
      ctx.strokeStyle = s.accent
      ctx.stroke()
      ctx.shadowBlur = 0
    } else {
      shapePath(ctx, t.shape, r)
      ctx.fillStyle = t.gradient ? radialFill(ctx, r, s.accent, s.color) : s.color
      ctx.fill()
      ctx.shadowBlur = 0
      if (t.outline > 0) {
        ctx.lineWidth = t.outline
        ctx.strokeStyle = t.shape === 'circle' || t.shape === 'gem' ? s.accent : darken(s.color, 0.45)
        ctx.stroke()
      }
    }

    if (s.fireFlash > 0) {
      ctx.beginPath()
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2)
      ctx.strokeStyle = hexToRgba(s.accent, s.fireFlash * 0.6)
      ctx.lineWidth = 3
      ctx.stroke()
    }

    // Archetype glyph
    ctx.fillStyle = t.shape === 'ring' ? s.accent : 'rgba(0,0,0,0.6)'
    ctx.font = 'bold 14px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(GLYPH[s.archetype], 0, 1)
  }

  // Muzzle flash, over the art, at the barrel. Kept under reduced motion (it is
  // a 90 ms state tell, not travel) but the recoil and sparks are not.
  drawMuzzle(ctx, fs.muzzle, fs.muzzleAngle, s.accent)

  // HP bar (only when damaged)
  const frac = Math.max(0, s.hp) / s.maxHp
  if (frac < 0.999) {
    const w = 30
    const y = 20
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    roundRect(ctx, -w / 2, y, w, 4, 2)
    ctx.fill()
    ctx.fillStyle = frac > 0.5 ? '#7ac74f' : frac > 0.25 ? '#e6b800' : '#e05a4f'
    roundRect(ctx, -w / 2, y, w * frac, 4, 2)
    ctx.fill()
  }

  // Patience pips (top-right of token)
  if (s.patienceStacks > 0) {
    for (let i = 0; i < s.patienceStacks; i++) {
      ctx.beginPath()
      ctx.arc(-12 + i * 5, -19, 1.8, 0, Math.PI * 2)
      ctx.fillStyle = '#9ec1f0'
      ctx.fill()
    }
  }

  ctx.restore()
}

/**
 * Kept in step with `ARCHETYPE_GLYPH` in `src/ui/channels.ts`, which is the
 * source of truth. Duplicated rather than imported because `game/render` must
 * not depend on `ui/` — if these two ever disagree, the same hero reads as one
 * class on the canvas and another on its roster card.
 *
 * `rogue` is `➶`, NOT `✦`. `✦` is Watch Marks and nothing else; it used to be
 * the rogue mark here *and* the stun mark below, so a single glyph carried
 * three meanings across two files.
 */
const GLYPH: Record<Archetype, string> = { fighter: '⚔', rogue: '➶', mystic: '❋' }

/**
 * @param now    the presentation clock — ambient animation ONLY (walk cycle, bob).
 * @param simNow the ENGINE clock (`engine.elapsed`). Every gameplay-state
 *   timestamp on an enemy — `burnUntil`, `chillUntil`, `stunUntil` — is written
 *   in engine time, so it can only be compared against engine time (M-1). The
 *   presentation clock starts at canvas mount and advances on REAL time through
 *   setup, so it sits roughly `setupSeconds` ahead of the sim; comparing status
 *   timestamps against it made every effect shorter than the preceding setup
 *   undrawable, and a 0.5s stun undrawable at all. Defaults to `now` so a caller
 *   with only one clock (none today) still type-checks.
 */
export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  e: RtEnemy,
  now: number,
  simNow: number = now,
): void {
  const { pos, type } = e
  const burning = simNow < e.burnUntil
  const chilled = simNow < e.chillUntil
  const stunned = simNow < e.stunUntil
  /**
   * Presentation-only knockback (doctrine item 7).
   *
   * `pos` is the SIM's position and decides hit detection, splash and blocking;
   * this is a decaying draw offset on top of it, so a hit visibly throws a
   * goblin three pixels back down the lane without moving it one unit of
   * `distance`. Added before the round so the whole unit — sprite, ring, HP
   * bar, tier tag — travels together and still lands on a whole logical px.
   */
  const kick = fxEnemyRecoil(e.id)
  const flash = fxEnemyFlash(e.id)
  // Attrition (burn/thorns/trap) is its OWN channel and is not a hit — see
  // `fxDotEnemy`. Conflating the two is what turned every burning enemy into a
  // featureless white blob for the whole burn (C1).
  const dot = fxEnemyDot(e.id)
  ctx.save()
  // Snap to the composite's pixel grid — see blitPixmap. This is what ends the
  // per-frame pixel crawl on everything that moves.
  ctx.translate(Math.round(pos.x + kick.x), Math.round(pos.y + kick.y))

  const style = getActiveStyle()
  const es = style.enemy
  const fill = chilled ? mix(type.color, '#8fd0ff', 0.4) : type.color
  const pack = style.sprites?.pack
  const walkFrames = pack ? ANIM_FRAMES[`${type.id}_walk`] : undefined
  const walk = pack && walkFrames ? getSprite(pack, `${type.id}_walk`) : undefined
  const staticSpr = pack ? getSprite(pack, type.id) : undefined
  /**
   * TWO render buckets, and only two (see `pixmap.ts`): rank and file at half
   * density, the tier-5 champion at the pack's native density — so a champion
   * is exactly 2× its own faction's line troops. Tiers 1–4 are deliberately the
   * same size; tier is read off the notch tag, which encodes it as a count.
   *
   * `type.radius` is GAMEPLAY (hit detection, splash, blocking) and is not
   * touched here — only the render scale is.
   */
  const spriteScale = style.sprites ? (type.isBoss ? 1 : style.sprites.spriteScale) : 1

  const enemyShadow = () => {
    ctx.beginPath()
    ctx.ellipse(0, type.radius * 0.7, type.radius * 0.9, type.radius * 0.35, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fill()
  }
  const overlays = (ringR: number) => {
    if (chilled) {
      ctx.beginPath()
      ctx.arc(0, 0, type.radius, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(120,190,255,0.28)'
      ctx.fill()
    }
    if (type.isBoss) {
      ctx.beginPath()
      ctx.arc(0, 0, ringR, 0, Math.PI * 2)
      ctx.strokeStyle = '#e0aaff'
      ctx.lineWidth = 2.5
      ctx.stroke()
    }
  }

  // Top of the drawn art, in token space. The tier tag hangs off this rather
  // than off `radius`, because a sprite is ~2.7× the token: anchoring to the
  // radius put the tag ON the goblin's head at tier 1 and inside the champion's
  // chest at tier 5.
  let artTop = -type.radius

  const walkPm = walk && walkFrames ? pixmap(walk, { scale: spriteScale, frames: walkFrames, ring: true }) : null
  const staticPm = !walkPm && staticSpr
    ? pixmap(staticSpr, { scale: spriteScale, ring: true, cell: barrelCell(type.id, staticSpr) })
    : null

  if (walkPm) {
    enemyShadow()
    /**
     * Run cycle, driven by DISTANCE rather than by the clock (M6).
     *
     * It was `loopFrame(now, frames, 10, …)` — a fixed 10 fps cadence on every
     * enemy in the game. A `Swift` elite translates 40% faster and took exactly
     * as many steps to do it, so it visibly moon-walked; a `Plated` elite is
     * 10% slower and skated. Chilled enemies did the same thing in the other
     * direction. Tying the cycle to ground covered fixes all three at once and
     * needs no knowledge of the modifier: `STRIDE` logical px per frame, so at
     * the ~135 px/s of a line goblin the cadence is the same ~10 fps this
     * shipped with, and anything moving faster or slower steps to match.
     *
     * `distance` is the sim's own odometer, so this still freezes on pause and
     * still runs on simulated time — the M28 property is unchanged.
     */
    const step = Math.floor(e.distance / STRIDE + idPhase(e.id) * walkFrames!)
    const frame = ((step % walkFrames!) + walkFrames!) % walkFrames!
    // The bob is rounded with the blit, so it steps a whole logical px at a
    // time rather than resampling the sprite on every frame of its own cycle.
    const bob = Math.sin(now * 12 + pos.x * 0.3) * 1.4
    const feet = type.radius * 0.55 + bob
    blitPixmap(ctx, walkPm, frame, 0, feet, flash, dot)
    // 0.9 rather than 1.0: the top tenth of a Tiny Swords frame is transparent
    // headroom, and anchoring to the frame rather than to the character left
    // the tag visibly detached — 9 logical px of nothing over a champion.
    artTop = Math.round(feet - walkPm.fh) + walkPm.fh * 0.1
    overlays(walkPm.fh / 2 + 2)
  } else if (staticPm) {
    enemyShadow()
    const isBarrel = type.id.startsWith('barrel')
    if (isBarrel) {
      /**
       * Barrels roll as they trundle down the lane — and the roll is now made
       * of **pre-rendered quarter turns**, not of a live `ctx.rotate` (M4).
       *
       * The previous version quantised to sixteenths of a turn on the argument
       * that discrete poses "keep the sprite on one sampling phase for the
       * whole of each step". That is true and it was not enough: twelve of the
       * sixteen poses are non-axis-aligned, and a nearest-neighbour rotation of
       * pixel art looks like one at any sampling phase — it is the third of the
       * three amateur tells the rest of this pipeline exists to eliminate.
       * Worse, the pass's own metric could not see it, because `dw/sw` stays
       * exactly 1.000 under a rotation; 1,935 of ~15,000 field blits (12.9%)
       * were being resampled and the scorecard read clean. See `blitCensus`.
       *
       * Quarter turns are the only rotations of a raster that are **lossless**
       * — they are a permutation of the source pixels, not a resample — and
       * baking them into a four-cell strip means the runtime draw is back under
       * the identity transform, at 1.000, on a whole-px destination, like every
       * other sprite in the field. The roll is chunkier by design: four poses
       * of a tumbling barrel read as a tumble, and none of them is smeared.
       */
      /**
       * ── and the roll runs off the ODOMETER, not off `x + y` (minor 5) ─────
       *
       * The pose index was `floor((pos.x + pos.y) / (r * 1.6))`. The sum of the
       * two axes is not distance travelled: wherever the lane heads
       * right-and-up the sum FALLS while the barrel advances, so the barrel
       * tumbled backwards down the hill, and wherever `dx ≈ −dy` the sum is
       * flat and the roll stalled while the barrel kept translating. Measured
       * along the whole Green Line at 2 px steps: **18.4% of the lane ran the
       * roll in reverse**, in two contiguous stretches worth ~1.3–1.7 s each at
       * 1×. The gross rate looked right — 110 pose changes against a physically
       * correct 112 — which is exactly why it survived: only the SIGN was
       * wrong, and a rate metric cannot see a sign.
       *
       * `e.distance` is the sim's own odometer, the same one the walk cycle
       * above already runs on. It is monotonic, so the roll can never reverse
       * or stall, and it is in simulated time, so this still freezes on pause
       * (M28). `r * 1.6` is kept as the arc per quarter turn: a real barrel of
       * radius r covers `πr/2 ≈ 1.571r` per quarter turn, so the shipped
       * constant was already within 2% of physically correct and only ever
       * looked wrong because it was being fed the wrong odometer.
       */
      const rollPm = quarterTurns(staticPm)
      const pose = ((Math.floor(e.distance / (type.radius * 1.6)) % 4) + 4) % 4
      ctx.save()
      ctx.translate(0, -Math.round(type.radius * 0.1))
      blitPixmap(ctx, rollPm, pose, 0, rollPm.fh / 2, flash, dot)
      ctx.restore()
      artTop = -type.radius * 0.1 - rollPm.fh * 0.45
      overlays(rollPm.fh / 2 + 2)
    } else {
      const feet = type.radius * 0.55
      blitPixmap(ctx, staticPm, 0, 0, feet, flash, dot)
      artTop = Math.round(feet - staticPm.fh) + staticPm.fh * 0.1
      overlays(staticPm.fh / 2 + 2)
    }
  } else {
    if (es.glow > 0) {
      ctx.shadowColor = fill
      ctx.shadowBlur = es.glow
    }
    if (es.shape === 'ring') {
      ctx.beginPath()
      ctx.arc(0, 0, type.radius, 0, Math.PI * 2)
      ctx.lineWidth = es.outline + 1.5
      ctx.strokeStyle = fill
      ctx.stroke()
    } else {
      shapePath(ctx, es.shape, type.radius)
      ctx.fillStyle = es.gradient ? radialFill(ctx, type.radius, lighten(fill, 0.3), fill) : fill
      ctx.fill()
      if (es.outline > 0) {
        ctx.lineWidth = es.outline
        ctx.strokeStyle = darken(fill, 0.45)
        ctx.stroke()
      }
    }
    ctx.shadowBlur = 0
    if (type.isBoss) {
      ctx.beginPath()
      ctx.arc(0, 0, type.radius, 0, Math.PI * 2)
      ctx.lineWidth = 3
      ctx.strokeStyle = '#e0aaff'
      ctx.stroke()
    }
  }
  // Burning aura
  if (burning) {
    ctx.beginPath()
    ctx.arc(0, 0, type.radius + 3, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(240,120,50,0.7)'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  // Stun mark. Drawn rather than typeset: this used to be a `✦` in system-ui,
  // which collided with Watch Marks (and with the old rogue glyph above), and
  // rendered at ~4.5 CSS px — a speck in a Crimson Text storybook direction.
  // Two orbiting sparks read as "dazed" at the size this actually ships at.
  if (stunned) {
    // Ambient orbit only — the two sparks are the information, the spin is not,
    // so reduced motion parks them rather than hiding them.
    const spin = fxReducedMotion() ? 0 : animNow() * 4
    ctx.fillStyle = '#ffe08a'
    for (let i = 0; i < 2; i++) {
      const a = spin + i * Math.PI
      ctx.beginPath()
      ctx.arc(Math.cos(a) * 5, -type.radius - 6 + Math.sin(a) * 2, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  // The sprite branches flash their own silhouette (see blitPixmap). Only the
  // procedural fallback — no art loaded — still needs the flat disc, and it
  // needs the same two-channel split: white for an impact, ember for attrition.
  if (!walkPm && !staticPm) {
    if (dot > 0) {
      ctx.beginPath()
      ctx.arc(0, 0, type.radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,138,60,${Math.min(1, dot) * 0.3})`
      ctx.fill()
    }
    if (flash > 0) {
      ctx.beginPath()
      ctx.arc(0, 0, type.radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255,246,228,${Math.min(1, flash) * 0.75})`
      ctx.fill()
    }
  }

  // HP bar
  const frac = Math.max(0, e.hp) / e.maxHp
  if (frac < 1) {
    const w = Math.max(type.radius * 2, 22)
    const y = -type.radius - 8
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    roundRect(ctx, -w / 2, y, w, 4, 2)
    ctx.fill()
    ctx.fillStyle = frac > 0.5 ? '#7ac74f' : frac > 0.25 ? '#e6b800' : '#e05a4f'
    roundRect(ctx, -w / 2, y, w * frac, 4, 2)
    ctx.fill()
  }

  // Above the art AND above the HP bar, whichever reaches higher.
  drawTierTag(ctx, enemyTier(type.id), type.radius, Math.min(artTop, -type.radius - 8), eliteMark(type))
  ctx.restore()
}

/**
 * Logical px of ground covered per frame of a walk cycle.
 *
 * 13.5 is chosen so a tier-2 line goblin (134 px/s) steps at ~9.9 fps — the
 * fixed 10 the cycle used to run at — so nothing about the shipped cast's
 * cadence changes. What changes is that a Swift elite at 188 px/s now steps at
 * ~13.9 fps instead of moon-walking, and a chilled enemy's legs slow with it.
 */
const STRIDE = 13.5

/**
 * A stable per-entity phase offset, so a column of identical goblins is not one
 * animation played by six bodies.
 *
 * It was `pos.x * 0.08`, which is a function of WHERE the unit is rather than
 * of which unit it is — fine against a clock, wrong against an odometer, since
 * both terms would then advance together and the cycle would beat. Ids are
 * `en<counter><base36>` and monotonic, so hashing the whole string is enough to
 * scatter neighbours without any per-frame state.
 */
const phaseCache = new Map<string, number>()
function idPhase(id: string): number {
  const hit = phaseCache.get(id)
  if (hit !== undefined) return hit
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  const v = ((h >>> 0) % 997) / 997
  // Bounded: ids are unique per run and a wave is a few hundred bodies, but a
  // long endless run must not grow this without limit.
  if (phaseCache.size > 4000) phaseCache.clear()
  phaseCache.set(id, v)
  return v
}

/**
 * A dormant guard, kept because the bug it catches is invisible.
 *
 * `barrel1..5.png` used to be 158×164 crops off a Tiny Swords sheet holding
 * **four** barrels in a 2×2 grid — one whole barrel at (0,0,58,70) and three
 * fragments clipped by the right and bottom edges (verified by an alpha
 * column/row-run scan: columns 1–58 and 137–157, rows 1–70 and 119–163,
 * identical in all five files). The renderer drew the entire sheet as one
 * enemy, squashed into a `sz × sz` square from a 158×164 source at scale 0.22,
 * which is why a barrel measured 0.18 device px per source px — the sparsest
 * thing on the field by a factor of 6.3 — and read as a dark smudge.
 *
 * The pack has since been re-exported to a trimmed 52×72 single barrel, so this
 * no longer fires (`naturalWidth` 52 < 120). It stays because a four-up sheet
 * drawn as one sprite does not look like a bug, it looks like bad art, and the
 * next re-export should not be able to bring it back silently. The square
 * destination is gone regardless: `blitPixmap` draws `fw × fh`, so the barrel's
 * 3.7% vertical squash cannot recur either.
 */
const BARREL_CELL = { x: 0, y: 0, w: 60, h: 72 }
const barrelCell = (id: string, img: HTMLImageElement) =>
  id.startsWith('barrel') && img.naturalWidth >= 120 ? BARREL_CELL : undefined

/** Tier 1–5, read off the type id (`torch3` → 3). */
export function enemyTier(id: string): number {
  const n = Number(id.slice(-1))
  return n >= 1 && n <= 5 ? n : 1
}

/**
 * The non-colour tier channel (M34).
 *
 * `drawEnemy` used to answer "how dangerous is this thing?" with hue alone —
 * tiers 2/3/4 are literally the same blue/purple/gold in all three factions, so
 * the ONLY difference between a Bomber and a Sapper was a colour a deuteranope
 * cannot separate from the one next to it. The shell carries non-colour
 * channels everywhere in the DOM (rarity initials, archetype glyphs); the
 * canvas had none.
 *
 * **Why notches and not a glyph.** The field is 960×560 logical px drawn into
 * ~390×387 CSS px — a scale of ~0.41 — so a tier-1 goblin is about **9 CSS px
 * across on a phone**. Anything drawn INSIDE that silhouette (a numeral, a pip
 * row, an outline weight) lands at 1–3 px and is not a channel, it is texture.
 * So the tag sits ABOVE the head where it has its own space, carries its own
 * dark ground so it never has to fight grass or dirt for contrast, and encodes
 * tier as a COUNT — the one visual variable that survives every colour vision
 * difference, every scale and every screenshot. Tag WIDTH grows with the count
 * too, so the channel still reads even where four notches and five do not
 * resolve individually.
 *
 * It is also sized off `radius`, which already grows with tier, so the tag gets
 * bigger exactly where the count gets harder to read, and a tier-1 swarm wears
 * the smallest mark on the field rather than the noisiest.
 */
/**
 * ── the floor, in the units the eye lives in (M2) ───────────────────────────
 *
 * The comment this replaces claimed the notch "never drops below the ~1.6 CSS
 * px it needs to survive the phone's 0.41 scale". 0.41 is the **largest** view
 * scale in the support matrix, not the smallest. Measured at 320×568 — the
 * smallest supported phone — the view scale is 0.277 in battle and 0.269 during
 * setup, which put the notch at **1.11 CSS px with a 0.72 px gap**: below the
 * resolving limit, so four notches and five were one smear and tier was a
 * colour-only channel again, on exactly the device where it matters most and
 * for exactly the player the plaque was built for.
 *
 * A constant in logical px cannot express "big enough to read" when the number
 * of CSS px a logical px buys varies 1.5× across the matrix. So the notch and
 * the gap are now floored in **CSS px**, converted back through the live view
 * scale (`setViewScale`), and the radius-driven size is kept as the *lower*
 * bound it always was — a champion still wears a bigger tag than a runt, the
 * runt just never wears an illegible one.
 */
const NOTCH_MIN_CSS = 1.7
const NOTCH_GAP_MIN_CSS = 1.15
const NOTCH_H_MIN_CSS = 2.8

/**
 * ── the mark's INSIDE needed a floor of its own (minor 3) ───────────────────
 *
 * `NOTCH_MIN_CSS` floors the notch — a solid bar whose only job is to be
 * counted. It says nothing about the elite mark beside it, and the mark's
 * internal features were left on the radius-driven scale alone. Measured on
 * tier-3 elites at every viewport in the matrix: the swift chevron's stroke was
 * **0.77 CSS px** and the gap between its two chevrons **0.64** — 45% and 38%
 * of the notch floor. At dpr 2 that is two 1.5-device-px strokes 1.3 device px
 * apart, so the one thing the mark encodes, that there are TWO of them, aliases
 * away and "double chevron" reads as a smudge. Tier 3 is where elites are most
 * common, so this was the common case.
 *
 * 1.15 rather than 1.7 because these are separation features, not countable
 * ones: it is the same number `NOTCH_GAP_MIN_CSS` uses for "these two things
 * must not merge", which is exactly the question here. The mark's WIDTH is
 * derived from it rather than the other way round — see `tierTagGeometry` — so
 * the plaque grows to fit a legible mark instead of the mark shrinking to fit
 * the plaque.
 *
 * The other two marks are solid silhouettes with no thin interior: the warded
 * diamond has none at all, and the plated shield's one distinguishing feature
 * is its taper, which was 1.40 CSS px of a 2.90 CSS px mark — a shield that
 * read as a bar. The taper is now 0.58 of the mark's height, which against the
 * `NOTCH_H_MIN_CSS` floor is never less than 1.62 CSS px and needs no separate
 * constant.
 */
const MARK_FEATURE_MIN_CSS = 1.15

/**
 * The tag's geometry in LOGICAL px, exported so a harness can measure the
 * channel rather than re-deriving the formula and measuring its own copy of it.
 * (`rv-small` hard-coded `4 * scale`, which is why the regression it caught was
 * caught by eye and not by the gate.)
 *
 * `markStroke` / `markArm` are part of the return for the same reason: they are
 * the numbers minor 3 is about, and a harness that re-derives them measures its
 * own copy of the formula rather than the channel.
 */
export function tierTagGeometry(tier: number, radius: number, elite: EliteMark = null) {
  const k = Math.max(1, radius / 13)
  const vs = Math.max(viewScale, 0.02)
  const notchW = Math.max(4 * k, NOTCH_MIN_CSS / vs)
  const notchH = Math.max(6.5 * k, NOTCH_H_MIN_CSS / vs)
  const gap = Math.max(2.6 * k, NOTCH_GAP_MIN_CSS / vs)
  const padX = Math.max(2.4 * k, gap * 0.9)
  const padY = 1.8 * k
  /**
   * The double chevron is the only mark with interior features, so it is the
   * only one whose width is driven by a floor rather than by the plaque scale.
   * Laid out as `[stroke][gap][stroke][arm]` with the gap set equal to the
   * stroke — three floored spans and the chevron's own reach — so the width
   * follows from the floor instead of the features being squeezed into it.
   */
  const markStroke = elite === 'swift' ? Math.max(notchH * 0.24, MARK_FEATURE_MIN_CSS / vs) : 0
  const markArm = elite === 'swift' ? Math.max(notchH * 0.34, markStroke) : 0
  // The elite mark is a SECOND field on the same plaque, set off by a wider gap
  // so the count never absorbs it (see `drawEliteMark`).
  const markW = elite === 'swift' ? 3 * markStroke + markArm : elite ? notchH * 0.92 : 0
  const markGap = elite ? gap * 1.9 : 0
  const w = tier * notchW + (tier - 1) * gap + markGap + markW + padX * 2
  const h = notchH + padY * 2
  return {
    k, notchW, notchH, gap, padX, padY, markW, markGap, markStroke, markArm, w, h,
    cssNotch: notchW * vs,
    cssGap: gap * vs,
    cssMarkStroke: markStroke * vs,
    /** The gap between the two chevrons — equal to the stroke by construction. */
    cssMarkGap: markStroke * vs,
    /** The plated shield's taper, the one feature that separates it from a bar. */
    cssMarkTaper: notchH * PLATED_TAPER * vs,
  }
}

function drawTierTag(
  ctx: CanvasRenderingContext2D,
  tier: number,
  radius: number,
  top: number,
  elite: EliteMark,
): void {
  const G = tierTagGeometry(tier, radius, elite)
  const y = top - G.h - 2 * G.k

  // Dark plaque, light notches — deliberately the same contrast direction as
  // the HP bar right below it (`rgba(0,0,0,0.55)` ground, bright fill), so the
  // two read as one small HUD stack rather than as a second, louder decoration.
  // The first pass inverted it — dark notches on a cream plaque — and became the
  // brightest thing on the field, which is exactly what the review checklist
  // forbids: nothing may out-contrast the units themselves.
  ctx.fillStyle = 'rgba(26,17,9,0.62)'
  roundRect(ctx, -G.w / 2, y, G.w, G.h, 1.6 * G.k)
  ctx.fill()

  ctx.fillStyle = 'rgba(244,233,208,0.95)'
  for (let i = 0; i < tier; i++) {
    const x = -G.w / 2 + G.padX + i * (G.notchW + G.gap)
    ctx.fillRect(x, y + G.padY, G.notchW, G.notchH)
  }

  if (elite) {
    const x = -G.w / 2 + G.padX + tier * G.notchW + (tier - 1) * G.gap + G.markGap
    drawEliteMark(ctx, elite, x, y + G.padY, G.markW, G.notchH, G.markStroke, G.markArm)
  }
}

/**
 * ── every elite variant was pixel-identical to its base type (M6) ───────────
 *
 * `applyMod` in `enemies.ts` overrides `id` (forced back to the base, so the
 * sprite and the tier both resolve to the base type), `name`, `speed`,
 * `physResist` and `magResist` — and `drawEnemy` read none of those except
 * `id`. So a Warded Bomber shrugging off 49% magic was the same pixels as one
 * shrugging off 15%; a Plated column was identical but 10% slower; and a Swift
 * column was 40% faster translation on a fixed 10 fps walk cycle, which is a
 * moon-walk. Mid-fight the player could not tell which goblins were the
 * 55%-plated ones — the single most decision-relevant fact about them.
 *
 * The channel is a SHAPE on the plaque the tier count already owns, for the
 * same reason the count is a count: a second hue would be a second thing a
 * deuteranope cannot separate at 19 CSS px, and this codebase has now solved
 * this exact problem twice (the notch plaque, the four proc geometries).
 * Plated is a shield, Warded a diamond ward, Swift a double chevron — three
 * silhouettes that survive at the notch's own size, on the notch's own ground.
 */
export type EliteMark = 'plated' | 'warded' | 'swift' | null

/** How deep the plated shield's point is cut, as a fraction of the mark height. */
const PLATED_TAPER = 0.58

/**
 * ── the channel is keyed on the MODIFIER, not on a display string (M2) ──────
 *
 * The first version of this string-matched `'Plated '` / `'Warded '` / `'Swift '`
 * against `type.name`. Correct today, and one edit from silently wrong: the
 * thing it matched is `EnemyMod.prefix`, whose own docstring in `enemies.ts`
 * calls it "Display prefix on the enemy's name, shown in the pre-wave preview".
 * Retitling `Plated` to `Ironclad` — a copy change, in a file this very comment
 * calls another agent's — would have returned `null` for every plated variant,
 * dropped the mark, and made every elite pixel-identical to its base again:
 * **the exact defect this fix exists to close, restored with every gate green.**
 * The failure is silent in the other direction too — a future base enemy named
 * "Swift Runner" would have worn an unearned chevron.
 *
 * So the mark is keyed on the `EnemyType` OBJECT, resolved once from the
 * registry through `modKey` — the same `(base, mod)` composition `enemies.ts`
 * registers under, which is the gameplay identity that file itself names as the
 * durable one ("The key is the gameplay identity … The `id` is the *art*
 * identity"). Renaming a prefix now changes nothing here; only renaming a mod's
 * `id` can, and that is a registry key, not copy.
 *
 * And it fails LOUDLY rather than silently: `ELITE_MARK_BY_MOD` must cover
 * every entry in `ENEMY_MODS`, and a modifier that ships without one throws on
 * import in dev and logs in prod, instead of quietly wearing no mark. A fourth
 * modifier is a plausible next move for that file; this is the guard that makes
 * adding one a build failure rather than a regression nobody sees.
 */
const ELITE_MARK_BY_MOD: Readonly<Record<string, Exclude<EliteMark, null>>> = {
  plated: 'plated',
  warded: 'warded',
  swift: 'swift',
}

/** Registered `EnemyType` object → its mark. Identity, not text. */
const ELITE_BY_TYPE = new Map<EnemyType, Exclude<EliteMark, null>>()
{
  const uncovered: string[] = []
  for (const m of ENEMY_MODS) if (!ELITE_MARK_BY_MOD[m.id]) uncovered.push(m.id)
  // `applyMod` forces the variant's `id` back to the base's, so a registry entry
  // whose key equals its own `id` is a BASE type and everything else is a
  // variant — which is how the base types are enumerated without importing a
  // list `enemies.ts` does not export.
  for (const [key, type] of Object.entries(ENEMY_TYPES)) {
    if (type.id !== key) continue
    for (const m of ENEMY_MODS) {
      const mark = ELITE_MARK_BY_MOD[m.id]
      const variant = ENEMY_TYPES[modKey(key, m.id)]
      if (mark && variant) ELITE_BY_TYPE.set(variant, mark)
    }
  }
  if (uncovered.length > 0) {
    const msg =
      `renderer: elite modifier(s) ${uncovered.join(', ')} have no mark in ELITE_MARK_BY_MOD — ` +
      `every variant of them draws pixel-identical to its base type (M2).`
    if (import.meta.env?.DEV) throw new Error(msg)
    console.error(msg)
  }
}

export function eliteMark(type: EnemyType): EliteMark {
  return ELITE_BY_TYPE.get(type) ?? null
}

/**
 * Every registered enemy type with the mark it resolves to — the shape a
 * harness needs to assert coverage over the whole registry rather than over the
 * three variants someone remembered to check.
 */
export function eliteMarkAudit(): { key: string; base: string; mod: string | null; name: string; mark: EliteMark }[] {
  const rows: { key: string; base: string; mod: string | null; name: string; mark: EliteMark }[] = []
  for (const [key, type] of Object.entries(ENEMY_TYPES)) {
    const mod = ENEMY_MODS.find((m) => modKey(type.id, m.id) === key)
    rows.push({ key, base: type.id, mod: mod ? mod.id : null, name: type.name, mark: eliteMark(type) })
  }
  return rows
}

function drawEliteMark(
  ctx: CanvasRenderingContext2D,
  kind: Exclude<EliteMark, null>,
  x: number,
  y: number,
  w: number,
  h: number,
  stroke: number,
  arm: number,
): void {
  const cx = x + w / 2
  const cy = y + h / 2
  ctx.fillStyle = 'rgba(244,233,208,0.95)'
  ctx.beginPath()
  if (kind === 'plated') {
    // A shield: flat shoulders, tapered point. Reads as "armoured" — and the
    // taper is the ONLY thing separating it from a notch, so it takes 0.58 of
    // the height rather than 0.50, which puts it above the feature floor at
    // every viewport in the matrix instead of 0.25 CSS px under it.
    ctx.moveTo(x, y)
    ctx.lineTo(x + w, y)
    ctx.lineTo(x + w, y + h * (1 - PLATED_TAPER))
    ctx.lineTo(cx, y + h)
    ctx.lineTo(x, y + h * (1 - PLATED_TAPER))
    ctx.closePath()
  } else if (kind === 'warded') {
    // A diamond ward — the only mark with no flat edge, so it separates from
    // the notches beside it by outline alone.
    ctx.moveTo(cx, y)
    ctx.lineTo(x + w, cy)
    ctx.lineTo(cx, y + h)
    ctx.lineTo(x, cy)
    ctx.closePath()
  } else {
    /**
     * A double chevron, pointing the way it runs — laid out from the FLOORED
     * stroke and arm `tierTagGeometry` computed, not from fractions of `w`.
     *
     * `w` is now derived from them (`3 * stroke + arm`), so the two chevrons sit
     * at 0 and `2 * stroke` and the whole mark lands exactly inside its box:
     * stroke, a gap equal to the stroke, stroke, arm. The old form took its
     * thickness as `0.3 * w` and its separation as `0.55 * w` — which also
     * over-ran the box by one stroke — so both features shrank with the plaque
     * and neither had a floor. See `MARK_FEATURE_MIN_CSS`.
     */
    for (const o of [0, stroke * 2]) {
      ctx.moveTo(x + o, y)
      ctx.lineTo(x + o + stroke, y)
      ctx.lineTo(x + o + arm + stroke, cy)
      ctx.lineTo(x + o + stroke, y + h)
      ctx.lineTo(x + o, y + h)
      ctx.lineTo(x + o + arm, cy)
      ctx.closePath()
    }
  }
  ctx.fill()
}

/**
 * A shot. No `shadowBlur` on the sprite themes any more (H19): a Gaussian
 * shadow is among the slowest things Canvas2D can be asked for on a phone, and
 * it was being paid PER PROJECTILE, per frame, for a 3.5px dot. The pop is
 * bought back for free with a dark contour ring and a lit core — two arcs — so
 * the shot still separates from grass and dirt without a blur kernel.
 */
export function drawProjectile(ctx: CanvasRenderingContext2D, p: RtProjectile): void {
  const pr = getActiveStyle().projectile
  ctx.save()
  const r = p.splashRadius > 0 ? 5 : p.isCrit ? 5.5 : 3.5
  ctx.fillStyle = p.color
  if (pr.glow > 0) {
    ctx.shadowColor = p.color
    ctx.shadowBlur = pr.glow
  }
  if (pr.square) {
    roundRect(ctx, p.pos.x - r, p.pos.y - r, r * 2, r * 2, 1)
    ctx.fill()
  } else {
    /**
     * Weight (Nijman: "your bullets are too small").
     *
     * A shot used to be one 3.5 px dot with no direction, no history and no
     * mass, and a *crit* was that dot at 4.5 px — a 1 px difference, which is
     * 0.4 CSS px at the shipping view, i.e. not a channel. Now the shot is
     * **stretched along its own velocity** and drags a three-step tail that
     * fades and narrows, so it reads as travelling rather than as existing at a
     * sequence of positions. A crit is a bigger core, a gold rim, and a longer
     * hotter tail — three channels, not a rounding error.
     */
    const dx = p.toPos.x - p.pos.x
    const dy = p.toPos.y - p.pos.y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len
    const uy = dy / len
    const tail = Math.min(16, p.speed * 0.028) * (p.isCrit ? 1.5 : 1)
    for (let i = 3; i >= 1; i--) {
      const t = i / 3
      const rr = r * (1 - t * 0.62)
      ctx.globalAlpha = 0.16 + (1 - t) * 0.34
      ctx.beginPath()
      ctx.arc(p.pos.x - ux * tail * t, p.pos.y - uy * tail * t, rr, 0, Math.PI * 2)
      ctx.fillStyle = p.isCrit ? '#ffd166' : p.color
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(p.pos.x, p.pos.y, r + 1, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(26,15,8,0.55)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(p.pos.x, p.pos.y, r, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.fill()
    if (p.isCrit) {
      ctx.beginPath()
      ctx.arc(p.pos.x, p.pos.y, r - 1, 0, Math.PI * 2)
      ctx.strokeStyle = '#ffd166'
      ctx.lineWidth = 1.6
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(p.pos.x - r * 0.25, p.pos.y - r * 0.25, r * 0.45, 0, Math.PI * 2)
    ctx.fillStyle = lighten(p.color, 0.55)
    ctx.fill()
  }
  ctx.restore()
}

export function drawTrap(ctx: CanvasRenderingContext2D, pos: Vec2, now: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(now * 4 + pos.x)
  ctx.save()
  ctx.translate(pos.x, pos.y)
  ctx.beginPath()
  ctx.arc(0, 0, 30, 0, Math.PI * 2)
  ctx.fillStyle = `rgba(200,90,60,${0.08 + pulse * 0.06})`
  ctx.fill()
  ctx.setLineDash([3, 4])
  ctx.strokeStyle = 'rgba(224,90,79,0.5)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

/** Scratch for `drawBattleEntities`; cleared and refilled, never reallocated. */
const targeted = new Set<string>()

/** Convenience: draw a whole running battle from an engine. */
export function drawBattleEntities(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
  // TWO clocks, deliberately (M-1 / WS1-3):
  //  - `now` is the presentation clock, shared with the tower idle loop. It is
  //    for ambient animation — pulses, bobs, walk cycles — and nothing else.
  //  - `simNow` is the engine's own clock. Every gameplay-state timestamp
  //    (burn/chill/stun expiry) is written in it, so anything compared against
  //    one of those must read it and not the presentation clock, which has been
  //    running since the canvas mounted and is ahead by the whole setup phase.
  // Both freeze when the sim does, so pause coherence is unaffected.
  const now = animNow()
  const simNow = engine.elapsed
  for (const t of engine.traps) drawTrap(ctx, t.pos, now)

  // Faint aura rings for support Sentinels (cleric/guard).
  for (const s of engine.sentinels) {
    if (s.downed) continue
    const m = s.profile.mods
    const aura = m.healAura ?? m.buffAura ?? m.dmgReductionAura
    if (aura) drawAura(ctx, s.pos, aura.radius, m.healAura ? '#7ac74f' : m.dmgReductionAura ? '#98c1d9' : '#f0a868', now)
  }

  // Corpses and splats go down BEFORE the living, so permanence never occludes
  // a unit the player has to read (Sakurai: make the character stand out).
  drawFxDecals(ctx)

  // Reused, not rebuilt: this ran a `map` + `filter` + `new Set` every frame
  // for a set that is at most a handful of ids.
  targeted.clear()
  for (const s of engine.sentinels) if (s.targetId) targeted.add(s.targetId)
  for (const e of engine.enemies) drawEnemy(ctx, e, now, simNow)
  for (const e of engine.enemies) if (targeted.has(e.id)) drawReticle(ctx, e.pos, e.type.radius)
  for (const s of engine.sentinels) drawSentinel(ctx, sentinelFromRt(s))
  for (const p of engine.projectiles) drawProjectile(ctx, p)

  // Impact debris, chain-lightning arcs, explosions.
  drawFxParticles(ctx)
  // The base's own reaction, over the units standing near it.
  drawBaseFx(ctx, engine.map)
  // Numbers last: they are the only layer that is pure information.
  drawFxFloaters(ctx)
}

/**
 * The base takes damage, visibly (and the run-loss moment lands).
 *
 * The base plate is baked into the terrain — it is static geometry — so it
 * never reacted to anything: leaked enemies simply vanished at the end of the
 * path, the marker sat there unchanged, and the run could be lost without one
 * pixel of the field acknowledging it. This is the overlay that answers all of
 * it, in four escalating states.
 */
/**
 * Where the base's reaction is DRAWN, which is not where the base is.
 *
 * Measured while building this: `FIRST_MAP.base` is `{x: 990, y: 520}` — the
 * last point of a path that deliberately runs off both edges so enemies enter
 * and leave off-screen — and the field is **960** wide. The marker `drawBase`
 * bakes into the terrain spans x 958–1010, so *two pixels of it are on screen
 * and the rest is past the right edge.*
 *
 * That is the real reason "the base never visually reacts": there was nothing
 * on screen to react. Flashing the plate would have changed nothing a player
 * can see. So the reaction is anchored to the boundary the enemies actually
 * cross, clamped inward by one marker's width, and the boundary itself is drawn
 * (`drawBreachLine`) so that the place the run is lost is a place on the screen
 * at all.
 *
 * Gameplay is untouched: `map.base` is not moved, the baked `drawBase` is not
 * moved, and nothing about where the path ends changes.
 */
export function baseAnchor(map: GameMap): Vec2 {
  return {
    x: Math.max(34, Math.min(map.width - 34, map.base.x - 6)),
    y: Math.max(34, Math.min(map.height - 34, map.base.y)),
  }
}

/**
 * The angle of the last lane segment, so the gate below stands ACROSS the road
 * rather than along it — on either shipped map, and on any future one.
 */
function laneAngle(map: GameMap): number {
  const p = map.path
  const a = p[p.length - 2] ?? p[0]
  const b = p[p.length - 1]
  return Math.atan2(b.y - a.y, b.x - a.x)
}

/**
 * The line, as a thing: a warm-wood palisade gate standing across the lane at
 * the last visible point before the field edge.
 *
 * This is the piece the brief called "give the base a reaction", and the reason
 * it is a *new object* rather than a flash on the old one is measured in
 * {@link baseAnchor} — the old one is off-screen. A game whose core verb is
 * WATCHING had nothing on the field standing for the thing being defended, so
 * "the base took damage" had no referent for the eye to land on.
 *
 * It carries the base's health in **structure**, not only in colour: planks go
 * missing from the middle outward as the line is worn down, the gate reddens
 * and flashes white as a leak lands, and it lies flat when the run is lost.
 * Colour alone would fail the same colour-vision test the tier notches exist to
 * pass. It stands on the field boundary, out of the play area, so it frames
 * rather than competes (level-design checklist).
 */
function drawGate(ctx: CanvasRenderingContext2D, map: GameMap, dmg: number, hurt: number, lost: number): void {
  const a = baseAnchor(map)
  const heat = Math.max(dmg, Math.min(1, hurt / 0.55))
  const fallen = lost >= 0
  ctx.save()
  ctx.translate(a.x, a.y)
  ctx.rotate(laneAngle(map))
  // +x now runs down the lane and +y across it, so the gate is a row of planks
  // along y standing in the direction the enemies are walking.

  // Contact shadow, like every other object class on the field.
  ctx.fillStyle = 'rgba(0,0,0,0.26)'
  ctx.beginPath()
  ctx.ellipse(3, 0, 7, 32, 0, 0, Math.PI * 2)
  ctx.fill()

  /**
   * ── the count told the truth about nothing (C3) ──────────────────────────
   *
   * The mapping this replaces was:
   *
   *     gone = min(PLANKS - 2, floor(dmg * (PLANKS - 1)))   // 0…5
   *     rank = |i - (PLANKS - 1) / 2|                       // 3,2,1,0,1,2,3
   *     if (rank < gone / 2 && !fallen) continue
   *
   * and it was wrong three separate ways, all of them in the direction of
   * flattering the player about how the line is doing:
   *
   *  1. `rank` is integer-spaced, so halving `gone` made half its values do
   *     nothing: gone 0→7 planks standing, 1→6, 2→**6**, 3→4, 4→**4**, 5→2.
   *     Seven planks, four states.
   *  2. `floor` meant `gone` stayed 0 until a sixth of the base was lost. With
   *     `MAX_BASE_HP = 20` that is 19, 18 and 17 of 20 all drawing a
   *     **completely intact** gate — three leaks, 15% of the run's health,
   *     reported as "undamaged" by the channel whose entire job is to report it.
   *  3. `fallen` short-circuited the `continue`, so at the moment the run was
   *     lost every plank came back: the gate went from 2 planks to **7**. The
   *     count inverted at the one moment it had to be unambiguous.
   *
   * And this is the channel the comment above calls "the one visual variable
   * that survives every colour-vision difference" — so for the player who most
   * needs it, it was the channel that was lying.
   *
   * The replacement is a plain monotone count with no halving anywhere:
   * `ceil` so the FIRST point of damage costs a plank rather than being
   * invisible, clamped so one plank always remains while the gate is a gate,
   * and `fallen` changes the plank GEOMETRY (they lie flat) without changing
   * how many there are. Seven distinct states, strictly non-increasing, and the
   * fewest planks are shown exactly when the least is left.
   *
   *     baseHp/20   20    19    17    13    11     6     1     defeat
   *     dmg        0.00  0.05  0.15  0.35  0.45  0.70  0.95   1.00
   *     standing      7     6     5     4     3     2     1      1
   */
  const PLANKS = 7
  const step = 9
  const span = step * (PLANKS - 1)
  const gone = Math.min(PLANKS - 1, Math.ceil(Math.max(0, Math.min(1, dmg)) * PLANKS))
  const mid = (PLANKS - 1) / 2
  const w = fallen ? 16 : 9
  const x0 = fallen ? -2 : -4.5
  for (let i = 0; i < PLANKS; i++) {
    const y = -span / 2 + i * step
    /**
     * Planks are taken from the middle outward, so the gap reads as a breach.
     *
     * `order` is this plank's position in that removal sequence — centre first,
     * then alternating outward — so comparing it against a whole `gone` removes
     * exactly `gone` planks. The previous `rank < gone / 2` compared an
     * integer-spaced rank against a half-integer and silently merged states.
     */
    const rank = Math.abs(i - mid)
    const order = rank === 0 ? 0 : 2 * rank - 1 + (i > mid ? 1 : 0)
    if (order < gone) continue
    // Dark ground first, so the palisade separates from the dirt it stands on
    // — the same contour trick the unit sprites get baked (see pixmap.ts).
    ctx.fillStyle = 'rgba(24,14,8,0.85)'
    ctx.fillRect(x0 - 1, y - 4, w + 2, 8)
    ctx.fillStyle = i % 2 ? '#6b4526' : '#7a5230'
    ctx.fillRect(x0, y - 3, w, 6)
    ctx.fillStyle = 'rgba(255,232,190,0.26)'
    ctx.fillRect(x0, y - 3, w, 1.6)
  }
  if (!fallen) {
    ctx.fillStyle = '#4a2d18'
    for (const o of [-15, 15]) ctx.fillRect(-6, o - 2, 12, 4)
  }

  if (heat > 0.02) {
    ctx.globalAlpha = Math.min(0.8, heat * 0.85)
    ctx.strokeStyle = '#e05a4f'
    ctx.lineWidth = 1.4 + heat * 2
    ctx.beginPath()
    ctx.rect(-8, -span / 2 - 6, 16, span + 12)
    ctx.stroke()
  }
  if (hurt > 0) {
    const k = Math.min(1, hurt / 0.55)
    ctx.globalAlpha = k * k * 0.45
    ctx.fillStyle = '#ffdcd2'
    ctx.fillRect(-8, -span / 2 - 6, 16, span + 12)
  }
  ctx.restore()
}

export function drawBaseFx(ctx: CanvasRenderingContext2D, map: GameMap): void {
  const b = fxBaseState()
  const now = fxNow()
  const anchor = baseAnchor(map)
  const x = anchor.x
  const y = anchor.y
  const dmg = 1 - Math.max(0, Math.min(1, b.frac))

  // 1 + 2. The gate carries the standing damage AND the breach flash.
  drawGate(ctx, map, dmg, b.hurt, b.lost)

  ctx.save()
  ctx.translate(x, y)

  // 3. Critical: as the line nears breaking, the ground behind the gate beats.
  //    Only past half, so a calm wave stays calm (Lisa Brown, "The Nuance of
  //    Juice": feedback that fires constantly stops meaning anything).
  if (dmg > 0.5 && b.lost < 0 && !fxReducedMotion()) {
    const beat = 0.5 + 0.5 * Math.sin(now * (5 + dmg * 7))
    ctx.globalAlpha = (0.16 + beat * 0.34) * dmg
    ctx.strokeStyle = '#e05a4f'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, 30 + beat * 6, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.restore()

  // 4. The run-loss ceremony: a white blowout that decays into a dark field
  // closing in on the breach. It has to land inside `WAVE_BEAT_LOSS_MS` (550ms
  // — the hold `gameStore.finishBattle` keeps the engine mounted for), so it is
  // timed to be fully read by ~0.5s rather than to unfold at leisure.
  if (b.lost >= 0 && !fxReducedMotion()) {
    const t = b.lost
    ctx.save()
    if (t < 0.3) {
      // Bright, but not a whiteout: the field has to stay legible through it,
      // because what the player needs to see is the line breaking, not a flash.
      ctx.globalAlpha = Math.max(0, 1 - t / 0.3) ** 1.4 * 0.7
      ctx.fillStyle = '#fff3e0'
      ctx.fillRect(0, 0, 4000, 4000)
    }
    const g = ctx.createRadialGradient(x, y, 20, x, y, 660 - Math.min(430, t * 900))
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, `rgba(24,10,6,${Math.min(0.6, t * 1.4)})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 4000, 4000)
    ctx.restore()
  }
}

function drawAura(ctx: CanvasRenderingContext2D, pos: Vec2, radius: number, color: string, now: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(now * 2 + pos.x * 0.05)
  ctx.save()
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
  ctx.strokeStyle = hexToRgba(color, 0.1 + pulse * 0.1)
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 8])
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

function drawReticle(ctx: CanvasRenderingContext2D, pos: Vec2, r: number): void {
  ctx.save()
  ctx.translate(pos.x, pos.y)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 1.5
  const rr = r + 5
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    const a = (i * Math.PI) / 2 + Math.PI / 4
    ctx.arc(0, 0, rr, a - 0.35, a + 0.35)
    ctx.stroke()
  }
  ctx.restore()
}

// ---- small canvas helpers ----

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** Blend two hex colors, t=0 → a, t=1 → b. Returns an rgb() string. */
export function mix(a: string, b: string, t: number): string {
  const pa = a.replace('#', '')
  const pb = b.replace('#', '')
  const ar = parseInt(pa.substring(0, 2), 16)
  const ag = parseInt(pa.substring(2, 4), 16)
  const ab = parseInt(pa.substring(4, 6), 16)
  const br = parseInt(pb.substring(0, 2), 16)
  const bg = parseInt(pb.substring(2, 4), 16)
  const bb = parseInt(pb.substring(4, 6), 16)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `rgb(${r},${g},${bl})`
}

/** Archetype accent used by UI chips too. */
export function archetypeColor(a: Archetype): string {
  return ARCHETYPES[a].color
}

// ---- theme shape + color helpers ----

/** Trace a shape path centered at the origin (caller fills/strokes). */
function shapePath(ctx: CanvasRenderingContext2D, shape: string, r: number): void {
  ctx.beginPath()
  if (shape === 'square') {
    const rr = Math.min(3, r / 2)
    ctx.moveTo(-r + rr, -r)
    ctx.arcTo(r, -r, r, r, rr)
    ctx.arcTo(r, r, -r, r, rr)
    ctx.arcTo(-r, r, -r, -r, rr)
    ctx.arcTo(-r, -r, r, -r, rr)
    ctx.closePath()
  } else if (shape === 'gem') {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.closePath()
  } else {
    ctx.arc(0, 0, r, 0, Math.PI * 2)
  }
}

function radialFill(ctx: CanvasRenderingContext2D, r: number, inner: string, outer: string): CanvasGradient {
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r)
  g.addColorStop(0, inner)
  g.addColorStop(1, outer)
  return g
}

function toRgb(c: string): [number, number, number] {
  if (c.startsWith('#')) {
    const h = c.replace('#', '')
    return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)]
  }
  const m = c.match(/\d+/g)
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [128, 128, 128]
}
function darken(c: string, t: number): string {
  const [r, g, b] = toRgb(c)
  return `rgb(${Math.round(r * (1 - t))},${Math.round(g * (1 - t))},${Math.round(b * (1 - t))})`
}
function lighten(c: string, t: number): string {
  const [r, g, b] = toRgb(c)
  return `rgb(${Math.round(r + (255 - r) * t)},${Math.round(g + (255 - g) * t)},${Math.round(b + (255 - b) * t)})`
}

/**
 * Draw a small sample scene (path + 3 towers + 2 enemies + a shot) for the theme
 * gallery. Uses whatever theme is currently active — wrap in withStyle().
 */
export function drawThemePreview(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const style = getActiveStyle()
  const pts: Vec2[] = [
    { x: -10, y: h * 0.3 },
    { x: w * 0.4, y: h * 0.3 },
    { x: w * 0.4, y: h * 0.72 },
    { x: w + 10, y: h * 0.72 },
  ]

  // background + grid (or tiled terrain for sprite themes)
  const grassImg = style.sprites ? getSprite(style.sprites.pack, 'grass') : undefined
  const roadImg = style.sprites ? getSprite(style.sprites.pack, 'road') : undefined
  if (style.sprites && grassImg) {
    ctx.fillStyle = ctx.createPattern(grassImg, 'repeat')!
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.fillRect(0, 0, w, h)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = style.path.edge
    ctx.lineWidth = 22
    strokePolyline(ctx, pts)
    ctx.strokeStyle = roadImg ? ctx.createPattern(roadImg, 'repeat')! : style.path.fill
    ctx.lineWidth = 17
    strokePolyline(ctx, pts)
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, style.field.top)
    grad.addColorStop(1, style.field.bottom)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = style.field.grid
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = 0; x <= w; x += style.field.gridStep / 2) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
    }
    ctx.stroke()

    const p = style.path
    ctx.lineJoin = 'round'
    ctx.lineCap = p.cap
    ctx.strokeStyle = p.edge
    ctx.lineWidth = p.edgeWidth * 0.5
    strokePolyline(ctx, pts)
    ctx.strokeStyle = p.fill
    ctx.lineWidth = p.fillWidth * 0.5
    strokePolyline(ctx, pts)
    ctx.strokeStyle = p.center
    ctx.lineWidth = 1.5
    if (p.dash) ctx.setLineDash(p.dash)
    strokePolyline(ctx, pts)
    ctx.setLineDash([])
  }

  // enemies on the path
  const enemyDemo = [
    { x: w * 0.62, y: h * 0.72, color: '#8a5ec0', r: 9, id: 'barrel3' },
    { x: w * 0.82, y: h * 0.72, color: '#d0563a', r: 7, id: 'torch2' },
  ]
  for (const e of enemyDemo) {
    const es = style.enemy
    ctx.save()
    ctx.translate(e.x, e.y)
    const espr = style.sprites ? getSprite(style.sprites.pack, e.id) : undefined
    if (espr) {
      /**
       * The last non-1.000 sprite draw in the codebase, removed (minor).
       *
       * This was `drawImage(espr, …, sz, sz)` with `sz = radius × enemyScale` —
       * a gameplay number times a deprecated multiplier, squashed into a square
       * destination: exactly the three defects the whole Phase-3 pixel pipeline
       * was built to end, still sitting here. It is unreachable today (only
       * `tinyswords` is ever the active theme and nothing calls this), which is
       * precisely why it had to go: it would have reintroduced the defect
       * silently on the day a theme picker landed, in the one screen whose job
       * is to show the player what the art looks like.
       */
      const pm = pixmap(espr, { scale: style.sprites!.spriteScale, ring: true })
      if (pm) blitPixmap(ctx, pm, 0, 0, e.r * 0.55)
      ctx.restore()
      continue
    }
    if (es.glow > 0) {
      ctx.shadowColor = e.color
      ctx.shadowBlur = es.glow
    }
    if (es.shape === 'ring') {
      ctx.beginPath()
      ctx.arc(0, 0, e.r, 0, Math.PI * 2)
      ctx.lineWidth = es.outline + 1.5
      ctx.strokeStyle = e.color
      ctx.stroke()
    } else {
      shapePath(ctx, es.shape, e.r)
      ctx.fillStyle = es.gradient ? radialFill(ctx, e.r, lighten(e.color, 0.3), e.color) : e.color
      ctx.fill()
      if (es.outline > 0) {
        ctx.lineWidth = es.outline
        ctx.strokeStyle = darken(e.color, 0.45)
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  // 3 towers, one per archetype
  const towers: { x: number; y: number; a: Archetype }[] = [
    { x: w * 0.2, y: h * 0.55, a: 'fighter' },
    { x: w * 0.5, y: h * 0.48, a: 'rogue' },
    { x: w * 0.72, y: h * 0.45, a: 'mystic' },
  ]
  for (const tw of towers) {
    drawSentinel(ctx, {
      id: `preview-${tw.a}`,
      pos: { x: tw.x, y: tw.y },
      archetype: tw.a,
      color: ARCHETYPES[tw.a].color,
      accent: ARCHETYPES[tw.a].accent,
      range: 0,
      aimAngle: 0.4,
      fireFlash: 0,
      hp: 1,
      maxHp: 1,
      downed: false,
      procFlash: 0,
      patienceStacks: 0,
      blocking: false,
    })
  }

  // a projectile in flight
  drawProjectile(ctx, {
    id: 'demo',
    pos: { x: w * 0.58, y: h * 0.62 },
    toPos: { x: w * 0.72, y: h * 0.7 },
    targetId: null,
    srcId: '',
    damage: 0,
    damageType: 'physical',
    isCrit: true,
    speed: 0,
    splashRadius: 0,
    pierce: 0,
    color: ARCHETYPES.rogue.accent,
    mods: {},
    lifedrain: 0,
  })
}
