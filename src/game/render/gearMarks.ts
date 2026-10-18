/**
 * The hero's REAL gear, carried on the field.
 *
 * The designer: "the items should display on the character". The default Tiny
 * Swords heroes are chibi figures with their weapons painted in — the armoured
 * look always holds a sword and a shield, the hooded one a bow, the robed one
 * bare fists (and swings a hammer in its attack strip) — so the figure said
 * what KIND of hero this is and nothing about what it actually holds. The
 * paper-doll compositor (`loadout.ts`) can only dress a pack that ships
 * per-frame anchors and gear strips; Tiny Swords ships neither (HANDOFF §6.4),
 * and no new art may be added.
 *
 * So the hero carries the item's own atlas picture — the same 16 × 16 cell the
 * pack tile, the gear doll and the reward card show (`public/assets/ui/
 * fw-icons.png`, drawn in the Tiny Swords hand with its `#161C2E` outline):
 *
 *  - **in its fists** ({@link Rig}): the weapon's grip in the right fist, the
 *    off-hand piece in the left, measured off the idle strips;
 *  - **instead of the painted weapon, never beside it**: a hero holding what
 *    the art paints (a knight's sword, an archer's bow) keeps the painted one;
 *    a hero holding anything else has the painted weapon CUT from its idle
 *    strip before the bake, and its own item in the fist — and its attack
 *    strip (which swings the painted weapon) is not played; the item lunges
 *    at the target instead (`units.drawSentinel`);
 *  - **and the same for the off hand**: the armoured look paints a shield on
 *    its left arm. A hero whose off hand holds anything else — a buckler, a
 *    tome, a second blade — or nothing at all (a two-hander, an empty hand)
 *    has that shield cut from BOTH its strips ({@link cutOffHand}), and holds
 *    its own piece, if any, in the left fist. A knight with a greatsword is
 *    not still carrying the shield the art came with;
 *  - **pixel-doubled once, never scaled at draw time**: each cell is baked to a
 *    32 × 32 canvas by nearest-neighbour and blitted at a whole logical px with
 *    no transform, the 1:1 invariant every field sprite keeps (`blit.ts`).
 *    32 logical px is ~13 CSS px on the shipping phone — the painted sword's
 *    size, and readable as a sword vs an axe vs a wand at a glance;
 *  - **an enchanted weapon glints** in its effect's ink (`attackLook.EFFECT_INK`)
 *    and shape — embers off a flaming blade, a frost star on a cold one, a
 *    spark on a shocking one — so the effect is on the hero before it is ever
 *    on a goblin;
 *  - **the body piece** is not a third picture in a fist: it is WORN, a layer
 *    derived from the figure's own tunic, frame by frame (`bodyLayer.ts`).
 *    `HeroGear.body` names it; `units.drawSentinel` dresses the strip after
 *    the cuts and before the bake.
 *
 * Module-level caches only (the atlas image and the baked cells) — pure memo of
 * static art, not battle state.
 */
import { iconCell, itemIcon, type IconKey } from '../data/iconAtlas'
import type { Archetype, Equipment, Sentinel } from '../types'
import { EFFECT_INK, leadEffect, type HitEffect } from './attackLook'
import { mergeMods } from '../data/archetypeTree'
import { isBodyKey, type BodyKey, type BodyStyle } from './bodyLayer'

/** What a hero carries, as atlas cells, plus the glint its weapon wears. */
export interface HeroGear {
  main: IconKey | null
  off: IconKey | null
  /** The body piece it wears (`bodyLayer.ts`), by its icon cell; null for an empty slot. */
  body: BodyKey | null
  /** The lead on-hit effect the WEAPON's own enchantments carry, or null. */
  glint: HitEffect | null
  /**
   * A picture held INSTEAD of an atlas cell, per hand — a 16 × 16 cell and
   * its grip. Never set by {@link heroGear}: it is how a draft item (the
   * Peoples & Trades proposal, `harness/peoples.ts`) is tried in the real
   * fists. A hand with `art` and a null key still cuts the painted piece.
   */
  art?: { main?: HeldArt; off?: HeldArt }
  /** A draft body piece as data (`bodyLayer.BodyStyle`), worn instead of `body`. Never set by {@link heroGear}. */
  bodyStyle?: BodyStyle
}

/** A held picture that is not an atlas cell: its 16 × 16 pixels and where it is gripped. */
export interface HeldArt {
  cell: HTMLCanvasElement
  grip: Pt
}

/**
 * The gear marks a hero carries. The glint reads the weapon's enchantments
 * only — a burn from a skill is the hero's, not the sword's, and the shot and
 * the swing already wear it (`attackLook.hitEffects` on the projectile's mods).
 */
export function heroGear(equipment: Equipment): HeroGear {
  const { mainHand, offHand, body } = equipment
  const weapon = mainHand ?? (offHand && offHand.slot === 'oneHand' ? offHand : null)
  const mods = weapon ? mergeMods(weapon.enchantments.map((e) => e.mods)) : null
  const worn = body ? itemIcon(body) : null
  return {
    main: mainHand ? itemIcon(mainHand) : null,
    off: offHand ? itemIcon(offHand) : null,
    body: isBodyKey(worn) ? worn : null,
    glint: mods ? leadEffect(mods) : null,
  }
}

/** Memo by the equipment object (the store replaces it on every equip). */
const gearMemo = new WeakMap<Equipment, HeroGear>()
export function heroGearCached(hero: Pick<Sentinel, 'equipment'>): HeroGear {
  let g = gearMemo.get(hero.equipment)
  if (!g) gearMemo.set(hero.equipment, (g = heroGear(hero.equipment)))
  return g
}

/** One atlas cell's side, and the whole-number factor it is drawn at. */
const CELL = 16
export const GEAR_SCALE = 2
const SIDE = CELL * GEAR_SCALE

interface Pt {
  x: number
  y: number
}
interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * How one pack's figure of one look holds things — measured off its idle
 * strip at native density, in logical px from the hero's draw origin (feet at
 * y = +8, `drawSentinel`), except `unpaint`, which is in the strip CELL's own
 * px (every frame of the idle strip gets the same cut).
 *
 *  - `fistR` / `fistL`: where a held item's GRIP goes ({@link GRIP});
 *  - `paintedMain` / `paintedOff`: the weapon / off-hand the art already holds
 *    (the armoured look's sword and shield, the hooded look's bow). When the
 *    hero carries THAT, the painted one is the picture and no mark is added;
 *  - `tip`: where the painted weapon's point is, for its enchantment glint;
 *  - `unpaint`: the rectangles that hold the painted weapon. When the hero
 *    carries anything else in its weapon hand — another weapon, or nothing —
 *    they are cleared from the idle strip BEFORE the bake (so the contour ring
 *    is drawn round what is left, `loadout.ts`'s rule), and its own item's
 *    picture goes in the fist instead. A knight with an axe holds an axe, not
 *    a sword with an axe stuck to it; a knight with only a shield holds no
 *    sword at all. The attack strips keep their art: the blow is the slash.
 */
interface Rig {
  /** Measured off this pack's art (false: the generic placement, nothing cut or assumed). */
  measured: boolean
  fistR: Pt
  fistL: Pt
  paintedMain: IconKey | null
  paintedOff: IconKey | null
  tip: Pt | null
  unpaint: readonly Rect[]
  /**
   * The painted off-hand piece (`paintedOff`) is the LEFTMOST painted object in
   * every frame of both strips, ringed by the outline colour, so it is cut by
   * flood rather than by rectangles ({@link cutOffHand}). Rectangles cannot do
   * it here: the shield overlaps the body on a diagonal, and it moves across
   * the attack strip. Measured: 536 px of shield in each of the twelve frames
   * (idle and attack), and nothing of the body in the fill.
   */
  offCut: boolean
}

const TINY_SWORDS: Readonly<Record<Archetype, Rig>> = {
  // fighter_idle: 6 × 84×95 — sword up in the right fist, shield on the left arm.
  fighter: {
    measured: true,
    fistR: { x: 21, y: -21 },
    fistL: { x: -26, y: -24 },
    paintedMain: 'blade',
    paintedOff: 'shield',
    tip: { x: 39, y: -60 },
    unpaint: [
      { x: 57, y: 0, w: 27, h: 54 },
      { x: 61, y: 54, w: 23, h: 9 },
    ],
    offCut: true,
  },
  // rogue_idle: 6 × 71×79 — a bow held upright at the right side.
  rogue: {
    measured: true,
    fistR: { x: 25, y: -13 },
    fistL: { x: -24, y: -11 },
    paintedMain: 'bow',
    paintedOff: null,
    tip: { x: 22, y: -50 },
    unpaint: [
      { x: 48, y: 0, w: 23, h: 30 },
      { x: 54, y: 30, w: 17, h: 18 },
      { x: 50, y: 48, w: 21, h: 31 },
    ],
    offCut: false,
  },
  // mystic_idle: 6 × 64×63 — bare fists either side.
  mystic: {
    measured: true,
    fistR: { x: 20, y: -13 },
    fistL: { x: -18, y: -12 },
    paintedMain: null,
    paintedOff: null,
    tip: null,
    unpaint: [],
    offCut: false,
  },
}

/** A pack with no measured rig: the marks at a generic hand height, nothing unpainted. */
const GENERIC: Rig = { measured: false, fistR: { x: 18, y: -16 }, fistL: { x: -18, y: -16 }, paintedMain: null, paintedOff: null, tip: null, unpaint: [], offCut: false }

/** The rig for a pack's look. Only Tiny Swords (the default theme) is measured. */
export const rigFor = (pack: string | undefined, look: Archetype): Rig => (pack === 'tinyswords' ? TINY_SWORDS[look] : GENERIC)

/**
 * Where each picture is HELD, in its 16 px cell: the hilt of a blade, the
 * foot of an axe or hammer handle, the riser of the bow; anything else (a
 * shield, a book, an orb, a quiver) by the middle of its lower edge.
 */
const GRIP: Partial<Record<IconKey, Pt>> = {
  blade: { x: 3, y: 12 },
  dagger: { x: 4, y: 12 },
  axe: { x: 7, y: 12 },
  wand: { x: 3, y: 12 },
  sceptre: { x: 3, y: 12 },
  greatblade: { x: 2, y: 13 },
  brand: { x: 3, y: 12 },
  rod: { x: 2, y: 12 },
  hammer: { x: 7, y: 12 },
  bow: { x: 3, y: 8 },
  staff: { x: 3, y: 12 },
}
const gripOf = (k: IconKey): Pt => GRIP[k] ?? { x: 8, y: 11 }

/** Does this hero's weapon hand hide the art's painted weapon? */
export function unpaints(rig: Rig, gear: HeroGear): boolean {
  return rig.unpaint.length > 0 && rig.paintedMain !== null && gear.main !== rig.paintedMain
}

/**
 * Does this hero's off hand hide the art's painted off-hand piece? Yes
 * whenever it holds anything but that piece — including nothing (a two-hander,
 * or an empty off hand). The knight's shield is the only one painted.
 */
export function unpaintsOff(rig: Rig, gear: HeroGear): boolean {
  return rig.offCut && rig.paintedOff !== null && gear.off !== rig.paintedOff
}

/** What to cut from a strip: the painted weapon (idle strip only), the painted off-hand piece. */
export interface Cut {
  main: boolean
  off: boolean
}

const unpainted = new WeakMap<object, Map<string, HTMLCanvasElement>>()

/**
 * A strip with the painted weapon and/or off-hand piece cut out (see
 * {@link Rig.unpaint}, {@link Rig.offCut}). One canvas per source strip and
 * cut, kept: `pixmap()` caches its bake by source IDENTITY, so a stable canvas
 * is baked once and never again.
 */
export function unpaintedStrip(src: HTMLImageElement | HTMLCanvasElement, rig: Rig, frames: number, cut: Cut): HTMLImageElement | HTMLCanvasElement {
  const main = cut.main && rig.unpaint.length > 0
  const off = cut.off && rig.offCut
  if (typeof document === 'undefined' || (!main && !off)) return src
  const key = `${main ? 'm' : ''}${off ? 'o' : ''}`
  let byCut = unpainted.get(src)
  const hit = byCut?.get(key)
  if (hit) return hit
  const w = src instanceof HTMLImageElement ? src.naturalWidth : src.width
  const h = src instanceof HTMLImageElement ? src.naturalHeight : src.height
  if (!w || !h) return src
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d', { willReadFrequently: off })
  if (!g) return src
  g.drawImage(src, 0, 0)
  const cw = Math.round(w / frames)
  if (main) for (let f = 0; f < frames; f++) for (const r of rig.unpaint) g.clearRect(f * cw + r.x, r.y, Math.min(r.w, cw - r.x), r.h)
  if (off) {
    const img = g.getImageData(0, 0, w, h)
    for (let f = 0; f < frames; f++) cutOffHand(img.data, w, h, f * cw, Math.min(cw, w - f * cw))
    g.putImageData(img, 0, 0)
  }
  if (!byCut) unpainted.set(src, (byCut = new Map()))
  byCut.set(key, c)
  return c
}

/** The pack's outline ink (`#161C2E`), within a step of rounding. */
const isInk = (d: ArrayLike<number>, o: number): boolean =>
  d[o + 3] >= 128 && Math.abs(d[o] - 22) <= 2 && Math.abs(d[o + 1] - 28) <= 2 && Math.abs(d[o + 2] - 46) <= 2

/**
 * Cut the leftmost painted piece out of one frame (columns `x0 .. x0+cw`) of
 * RGBA pixels, in place — with its outline, and without the body it overlaps.
 * Returns how many pixels it cleared.
 *
 *  1. Seed on the frame's leftmost opaque pixel that is not outline ink (the
 *     shield's rim, in every frame), and flood the 8-connected NON-ink pixels:
 *     the ink ring stops the flood at the body.
 *  2. Take in the slivers the ring cut off from it — non-ink islands of ≤ 24 px
 *     inside its bounds (the rim's last highlight, under the ink).
 *  3. Peel its ink ring, three px deep: ink touching the cut that does not also
 *     touch an untouched painted pixel goes; ink that does is the BODY's
 *     outline and stays. The contour bake rings whatever is left.
 *
 * The ground shadow is translucent, so it is never ink and never cut.
 */
export function cutOffHand(d: { [i: number]: number; length: number }, w: number, h: number, x0: number, cw: number): number {
  const at = (x: number, y: number) => (y * w + x) * 4
  const inFrame = (x: number, y: number) => x >= x0 && x < x0 + cw && y >= 0 && y < h
  const paint = (x: number, y: number) => d[at(x, y) + 3] >= 128 && !isInk(d, at(x, y))
  /** Each 8-neighbour of pixel index `p` inside the frame. */
  const around = (p: number, visit: (x: number, y: number, q: number) => boolean | void): boolean => {
    const px = p % w
    const py = (p - px) / w
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = px + dx
        const y = py + dy
        if ((dx || dy) && inFrame(x, y) && visit(x, y, y * w + x) === true) return true
      }
    return false
  }
  const flood = (start: number, into: Set<number>, ok: (x: number, y: number, q: number) => boolean) => {
    into.add(start)
    const stack = [start]
    while (stack.length)
      around(stack.pop()!, (x, y, q) => {
        if (!into.has(q) && ok(x, y, q)) {
          into.add(q)
          stack.push(q)
        }
      })
  }

  let seed = -1
  for (let x = x0; x < x0 + cw && seed < 0; x++)
    for (let y = 0; y < h; y++)
      if (paint(x, y)) {
        seed = y * w + x
        break
      }
  if (seed < 0) return 0
  const fill = new Set<number>()
  flood(seed, fill, (x, y) => paint(x, y))

  // 2 · the slivers, inside the piece's bounds (+3 px).
  let bx0 = Infinity
  let bx1 = -Infinity
  let by0 = Infinity
  let by1 = -Infinity
  for (const p of fill) {
    const x = p % w
    const y = (p - x) / w
    bx0 = Math.min(bx0, x - 3)
    bx1 = Math.max(bx1, x + 3)
    by0 = Math.min(by0, y - 3)
    by1 = Math.max(by1, y + 3)
  }
  const inBox = (p: number) => {
    const x = p % w
    const y = (p - x) / w
    return x >= bx0 && x <= bx1 && y >= by0 && y <= by1
  }
  const seen = new Set<number>()
  for (let y = Math.max(0, by0); y <= Math.min(h - 1, by1); y++)
    for (let x = Math.max(x0, bx0); x <= Math.min(x0 + cw - 1, bx1); x++) {
      const p = y * w + x
      if (fill.has(p) || seen.has(p) || !paint(x, y)) continue
      const island = new Set<number>()
      flood(p, island, (qx, qy, q) => !fill.has(q) && paint(qx, qy))
      for (const q of island) seen.add(q)
      if (island.size <= 24 && [...island].every(inBox)) for (const q of island) fill.add(q)
    }

  // 3 · peel the ink ring.
  const inkAround = (from: Iterable<number>): Set<number> => {
    const ring = new Set<number>()
    for (const p of from)
      around(p, (x, y, q) => {
        if (!fill.has(q) && isInk(d, at(x, y))) ring.add(q)
      })
    return ring
  }
  let ring = inkAround(fill)
  for (let pass = 0; pass < 3 && ring.size; pass++) {
    const peeled = [...ring].filter((p) => !around(p, (x, y, q) => !fill.has(q) && paint(x, y)))
    for (const p of peeled) fill.add(p)
    ring = inkAround(peeled)
  }
  for (const p of fill) d[p * 4 + 3] = 0
  return fill.size
}

let atlas: HTMLImageElement | null = null
const baked = new Map<IconKey, HTMLCanvasElement | null>()
const atlasWaiters: (() => void)[] = []

function atlasImage(): HTMLImageElement | null {
  if (typeof document === 'undefined') return null
  if (!atlas) {
    atlas = new Image()
    atlas.onload = () => atlasWaiters.splice(0).forEach((cb) => cb())
    atlas.src = 'assets/ui/fw-icons.png'
  }
  return atlas.complete && atlas.naturalWidth > 0 ? atlas : null
}

/**
 * Whether the held marks can be drawn yet (the atlas has decoded). Starts the
 * load; `then` runs once when it lands. A portrait waits on it rather than
 * caching a hero with empty fists (`heroPortrait.ts`).
 */
export function gearAtlasReady(then?: () => void): boolean {
  const ok = atlasImage() !== null
  if (!ok && then && typeof document !== 'undefined') atlasWaiters.push(then)
  return ok
}

/** One atlas cell, pixel-doubled once into its own canvas. Null until the sheet decodes. */
function cellCanvas(key: IconKey): HTMLCanvasElement | null {
  const hit = baked.get(key)
  if (hit !== undefined) return hit
  const img = atlasImage()
  if (!img) return null
  const c = document.createElement('canvas')
  c.width = SIDE
  c.height = SIDE
  const g = c.getContext('2d')
  if (!g) {
    baked.set(key, null)
    return null
  }
  g.imageSmoothingEnabled = false
  const { ix, iy } = iconCell(key)
  g.drawImage(img, ix * CELL, iy * CELL, CELL, CELL, 0, 0, SIDE, SIDE)
  baked.set(key, c)
  return c
}

const bakedArt = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()
/** A held picture's cell, pixel-doubled once like an atlas cell. */
function artCanvas(art: HeldArt): HTMLCanvasElement | null {
  const hit = bakedArt.get(art.cell)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = SIDE
  c.height = SIDE
  const g = c.getContext('2d')
  if (!g) return null
  g.imageSmoothingEnabled = false
  g.drawImage(art.cell, 0, 0, CELL, CELL, 0, 0, SIDE, SIDE)
  bakedArt.set(art.cell, c)
  return c
}

/** Blit one mark with its grip on (gx, gy), at a whole logical px. */
function hold(ctx: CanvasRenderingContext2D, key: IconKey | null, gx: number, gy: number, art?: HeldArt): { x: number; y: number } | null {
  const c = art ? artCanvas(art) : key ? cellCanvas(key) : null
  if (!c) return null
  const g = art ? art.grip : gripOf(key!)
  const x = Math.round(gx - g.x * GEAR_SCALE)
  const y = Math.round(gy - g.y * GEAR_SCALE)
  ctx.drawImage(c, x, y)
  return { x, y }
}

/**
 * Draw the off-hand mark in the left fist — after the body, so it is held in
 * front — unless the art already paints that very thing there (the armoured
 * look's shield). The context is at the hero's origin.
 */
export function drawOffHand(ctx: CanvasRenderingContext2D, rig: Rig, gear: HeroGear): void {
  const art = gear.art?.off
  if (art) {
    hold(ctx, null, rig.fistL.x, rig.fistL.y, art)
    return
  }
  if (!gear.off || gear.off === rig.paintedOff) return
  hold(ctx, gear.off, rig.fistL.x, rig.fistL.y)
}

/**
 * Draw the weapon mark in the right fist, `lunge` logical px toward the aim
 * (a swing's reach — 0 at rest), and its enchantment glint. When the art
 * already paints this very weapon (a knight's sword, an archer's bow) no mark
 * is added and the glint goes on the painted point instead.
 */
export function drawMainHand(
  ctx: CanvasRenderingContext2D,
  rig: Rig,
  gear: HeroGear,
  lungeX: number,
  lungeY: number,
  now: number,
  still: boolean,
  /** The art's own attack strip is playing: its painted weapon is mid-swing, away from `tip`. */
  attacking = false,
): void {
  const art = gear.art?.main
  if (!gear.main && !art) return
  if (!art && gear.main === rig.paintedMain) {
    if (gear.glint && rig.tip && !attacking) drawGlint(ctx, gear.glint, rig.tip.x, rig.tip.y, now, still)
    return
  }
  const at = hold(ctx, gear.main, rig.fistR.x + lungeX, rig.fistR.y + lungeY, art)
  if (at && gear.glint) drawGlint(ctx, gear.glint, at.x + SIDE - 6, at.y + 6, now, still)
}

/**
 * The enchantment, worn: a few strokes at the weapon's tip (every weapon cell
 * points up and to the right, so the tip is the cell's upper-right). Each
 * effect has its own SHAPE as well as its own ink, the rule `attackLook`'s
 * palette is written under.
 */
function drawGlint(ctx: CanvasRenderingContext2D, effect: HitEffect, x: number, y: number, now: number, still: boolean): void {
  const ink = EFFECT_INK[effect]
  const t = still ? 0.3 : now
  ctx.save()
  // A soft halo of the ink round the tip first: it is what carries the colour
  // at 13 CSS px, where the strokes on top are a pixel or two.
  ctx.globalAlpha = 0.35 + (still ? 0 : 0.12 * Math.sin(t * 6))
  ctx.fillStyle = ink.glow
  ctx.beginPath()
  ctx.arc(x, y, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  if (effect === 'burn') {
    // Three embers lifting off the tip, out of phase.
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.4 + i / 3) % 1
      ctx.globalAlpha = 1 - k * 0.8
      ctx.fillStyle = i % 2 ? ink.core : ink.glow
      ctx.beginPath()
      ctx.arc(x + (i - 1) * 3 + Math.sin(t * 9 + i * 3) * 1.5, y - 1 - k * 16, 3.6 - k * 2, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (effect === 'chill') {
    // A four-point frost star that breathes.
    const r = 6 + Math.sin(t * 4) * 1.2
    ctx.strokeStyle = OUTLINE_INK
    ctx.lineWidth = 4.4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x - r, y)
    ctx.lineTo(x + r, y)
    ctx.moveTo(x, y - r)
    ctx.lineTo(x, y + r)
    ctx.stroke()
    ctx.strokeStyle = ink.core
    ctx.lineWidth = 2.2
    ctx.stroke()
  } else if (effect === 'shock') {
    // A zig-zag spark that re-rolls a few times a second.
    const s = Math.floor(t * 7) % 2 ? 1 : -1
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x - 5, y - 7 * s)
    ctx.lineTo(x + 2, y - 1 * s)
    ctx.lineTo(x - 2, y + 1 * s)
    ctx.lineTo(x + 5, y + 7 * s)
    ctx.strokeStyle = OUTLINE_INK
    ctx.lineWidth = 4.4
    ctx.stroke()
    ctx.strokeStyle = ink.spark
    ctx.lineWidth = 2.2
    ctx.stroke()
  } else {
    // drain / stun / execute: a bead of the ink, pulsing.
    ctx.fillStyle = OUTLINE_INK
    ctx.beginPath()
    ctx.arc(x, y, 4.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = ink.glow
    ctx.beginPath()
    ctx.arc(x, y, 3.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = ink.core
    ctx.beginPath()
    ctx.arc(x - 1, y - 1, 1.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** The atlas outline (`#161C2E`), so a glint's strokes sit on the field like the icons do. */
const OUTLINE_INK = '#161c2e'
