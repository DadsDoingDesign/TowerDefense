/**
 * The static field: terrain, level dressing, the environment grade and the
 * base plate — baked once per map into an offscreen canvas and blitted.
 */
import type { Vec2 } from '../core/vec'
import type { GameMap } from '../types'
import { pixmap } from './pixmap'
import { getSprite, onSpritesReady } from './sprites'
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
