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
 *  - **pixel-doubled once, never scaled at draw time**: each cell is baked to a
 *    32 × 32 canvas by nearest-neighbour and blitted at a whole logical px with
 *    no transform, the 1:1 invariant every field sprite keeps (`blit.ts`).
 *    32 logical px is ~13 CSS px on the shipping phone — the painted sword's
 *    size, and readable as a sword vs an axe vs a wand at a glance;
 *  - **an enchanted weapon glints** in its effect's ink (`attackLook.EFFECT_INK`)
 *    and shape — embers off a flaming blade, a frost star on a cold one, a
 *    spark on a shocking one — so the effect is on the hero before it is ever
 *    on a goblin;
 *  - **the body piece** is not drawn: armour has no silhouette on these chibi
 *    figures and a third picture would bury the one that matters.
 *
 * Module-level caches only (the atlas image and the baked cells) — pure memo of
 * static art, not battle state.
 */
import { iconCell, itemIcon, type IconKey } from '../data/iconAtlas'
import type { Archetype, Equipment, Sentinel } from '../types'
import { EFFECT_INK, leadEffect, type HitEffect } from './attackLook'
import { mergeMods } from '../data/archetypeTree'

/** What a hero carries, as atlas cells, plus the glint its weapon wears. */
export interface HeroGear {
  main: IconKey | null
  off: IconKey | null
  /** The lead on-hit effect the WEAPON's own enchantments carry, or null. */
  glint: HitEffect | null
}

/**
 * The gear marks a hero carries. The glint reads the weapon's enchantments
 * only — a burn from a skill is the hero's, not the sword's, and the shot and
 * the swing already wear it (`attackLook.hitEffects` on the projectile's mods).
 */
export function heroGear(equipment: Equipment): HeroGear {
  const { mainHand, offHand } = equipment
  const weapon = mainHand ?? (offHand && offHand.slot === 'oneHand' ? offHand : null)
  const mods = weapon ? mergeMods(weapon.enchantments.map((e) => e.mods)) : null
  return {
    main: mainHand ? itemIcon(mainHand) : null,
    off: offHand ? itemIcon(offHand) : null,
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
  },
}

/** A pack with no measured rig: the marks at a generic hand height, nothing unpainted. */
const GENERIC: Rig = { measured: false, fistR: { x: 18, y: -16 }, fistL: { x: -18, y: -16 }, paintedMain: null, paintedOff: null, tip: null, unpaint: [] }

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
  hammer: { x: 7, y: 12 },
  bow: { x: 3, y: 8 },
  staff: { x: 3, y: 12 },
}
const gripOf = (k: IconKey): Pt => GRIP[k] ?? { x: 8, y: 11 }

/** Does this hero's weapon hand hide the art's painted weapon? */
export function unpaints(rig: Rig, gear: HeroGear): boolean {
  return rig.unpaint.length > 0 && rig.paintedMain !== null && gear.main !== rig.paintedMain
}

const unpainted = new WeakMap<object, HTMLCanvasElement>()

/**
 * The idle strip with the painted weapon cut out (see {@link Rig.unpaint}).
 * One canvas per source strip, kept: `pixmap()` caches its bake by source
 * IDENTITY, so a stable canvas is baked once and never again.
 */
export function unpaintedStrip(src: HTMLImageElement | HTMLCanvasElement, rig: Rig, frames: number): HTMLImageElement | HTMLCanvasElement {
  if (typeof document === 'undefined' || !rig.unpaint.length) return src
  const hit = unpainted.get(src)
  if (hit) return hit
  const w = src instanceof HTMLImageElement ? src.naturalWidth : src.width
  const h = src instanceof HTMLImageElement ? src.naturalHeight : src.height
  if (!w || !h) return src
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  if (!g) return src
  g.drawImage(src, 0, 0)
  const cw = Math.round(w / frames)
  for (let f = 0; f < frames; f++) for (const r of rig.unpaint) g.clearRect(f * cw + r.x, r.y, Math.min(r.w, cw - r.x), r.h)
  unpainted.set(src, c)
  return c
}

let atlas: HTMLImageElement | null = null
const baked = new Map<IconKey, HTMLCanvasElement | null>()

function atlasImage(): HTMLImageElement | null {
  if (typeof document === 'undefined') return null
  if (!atlas) {
    atlas = new Image()
    atlas.src = 'assets/ui/fw-icons.png'
  }
  return atlas.complete && atlas.naturalWidth > 0 ? atlas : null
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

/** Blit one mark with its grip on (gx, gy), at a whole logical px. */
function hold(ctx: CanvasRenderingContext2D, key: IconKey, gx: number, gy: number): { x: number; y: number } | null {
  const c = cellCanvas(key)
  if (!c) return null
  const g = gripOf(key)
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
  if (!gear.main) return
  if (gear.main === rig.paintedMain) {
    if (gear.glint && rig.tip && !attacking) drawGlint(ctx, gear.glint, rig.tip.x, rig.tip.y, now, still)
    return
  }
  const at = hold(ctx, gear.main, rig.fistR.x + lungeX, rig.fistR.y + lungeY)
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
