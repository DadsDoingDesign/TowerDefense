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
 *  - **the painted weapon where it stands in, never a cell beside it**: a
 *    hero holding what the art paints keeps the painted one — and the
 *    knight's painted sword stands in for EVERY melee weapon (axe,
 *    greatsword, warhammer, the Saffron Brand) and for an empty hand
 *    (`Rig.paintedFor`, `paintedBare`): an atlas cell in that fist read as a
 *    small blade on a brown block with the arm kinked where the sword was
 *    cut. Anything else has the painted weapon CUT from its idle strip and
 *    its own cell in the fist only where that reads (`Rig.markMain`: the
 *    robed look's bare fists, yes; the hooded look, whose fist goes with its
 *    bow, draws none) — and its attack strip is not played; the item lunges
 *    at the target instead (`units.drawSentinel`);
 *  - **and the same for the off hand**: the armoured look paints a shield on
 *    its left arm. A hero whose off hand holds anything else — a buckler, a
 *    tome, a second blade — or nothing at all (a two-hander, an empty hand)
 *    has that shield cut from BOTH its strips ({@link cutOffHand}), and holds
 *    its own piece, if any, in the left fist. A knight with a greatsword is
 *    not still carrying the shield the art came with. The shield covered part
 *    of the knight — the side of the helmet and tunic, the near arm, a leg,
 *    a bite of the shadow — so the cut would leave the knight sliced down one
 *    side; the body it hid is rebuilt in the knight's own pixels, frame by
 *    frame, from a patch baked at build time ({@link cutAndFill},
 *    `scripts/shield-fill-lib.ts`), so the same knight stands there with the
 *    shield simply gone, whatever the left fist holds;
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
import { PEOPLE_KINDS, peopleIconKey } from '../data/peopleKinds'
import type { Archetype, Equipment, Sentinel } from '../types'
import { EFFECT_INK, leadEffect, type HitEffect } from './attackLook'
import { mergeMods } from '../data/archetypeTree'
import { isBodyKey, type BodyKey, type BodyStyle } from './bodyLayer'
import { SHIELD_FILL } from './shieldFill.generated'

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
  /** How the off hand holds its piece instead of the table's way ({@link holdOf}): a review seam. Never set by {@link heroGear}. */
  hold?: Hold
}

/** A held picture that is not an atlas cell: its 16 × 16 pixels and where it is gripped. */
export interface HeldArt {
  cell: HTMLCanvasElement
  grip: Pt
  /** How the off hand holds it ({@link holdOf}); default `cover`. */
  hold?: Hold
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
  /**
   * The weapons the painted one STANDS IN FOR ({@link paintsMain}): a hero
   * holding any of them keeps the painted weapon, uncut, and no mark is drawn.
   * An atlas cell in the fist of a figure painted this big read as a small
   * blade on a brown block, with the arm kinked where the painted weapon was
   * cut (the designer's review, Oct 2026), so the swap is made only where it
   * reads natively.
   */
  paintedFor: readonly IconKey[]
  /** The painted weapon stays when the weapon hand is empty too: cutting it leaves the arm kinked round a missing hilt. */
  paintedBare: boolean
  /**
   * Whether a weapon the art does not paint is drawn as its atlas cell in the
   * fist. Only where it reads natively: the robed look's bare fists hold a
   * wand or a staff; the hooded look has no fist left once its bow is cut, so
   * a dagger there would float — it draws none.
   */
  markMain: boolean
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

/**
 * The peoples' weapons the painted ones stand in for (Oct 2026): every
 * swinging one is the knight's painted sword, every bow the archer's bow —
 * the rule above, kept for the new kinds (their own cell shows where the
 * figure draws it: the robed look's fists, and every tile in the UI).
 */
const PEOPLE_SWINGS = PEOPLE_KINDS.filter((k) => k.swings).map((k) => peopleIconKey(k.id) as IconKey)
const PEOPLE_BOWS = PEOPLE_KINDS.filter((k) => k.bow).map((k) => peopleIconKey(k.id) as IconKey)

const TINY_SWORDS: Readonly<Record<Archetype, Rig>> = {
  // fighter_idle: 6 × 84×95 — sword up in the right fist, shield on the left arm.
  fighter: {
    measured: true,
    fistR: { x: 21, y: -21 },
    fistL: { x: -26, y: -24 },
    paintedMain: 'blade',
    // every melee weapon: the sword, an axe, a greatsword, a warhammer, the Saffron Brand
    paintedFor: ['blade', 'axe', 'greatblade', 'hammer', 'brand', ...PEOPLE_SWINGS],
    paintedBare: true,
    markMain: false,
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
    paintedFor: ['bow', ...PEOPLE_BOWS],
    paintedBare: false,
    markMain: false,
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
    paintedFor: [],
    paintedBare: false,
    markMain: true,
    paintedOff: null,
    tip: null,
    unpaint: [],
    offCut: false,
  },
}

/** A pack with no measured rig: the marks at a generic hand height, nothing unpainted. */
const GENERIC: Rig = { measured: false, fistR: { x: 18, y: -16 }, fistL: { x: -18, y: -16 }, paintedMain: null, paintedFor: [], paintedBare: false, markMain: true, paintedOff: null, tip: null, unpaint: [], offCut: false }

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
  // The peoples' weapons (Oct 2026): each draft's own grip (`scripts/peoples-art/`).
  armingSword: { x: 7, y: 11 },
  falchion: { x: 2, y: 11 },
  spicedBlade: { x: 3, y: 12 },
  halberd: { x: 4, y: 10 },
  bannerPole: { x: 3, y: 11 },
  pepperportSabre: { x: 5, y: 12 },
  pepperportStandard: { x: 7, y: 13 },
  shortbow: { x: 4, y: 8 },
  longbow: { x: 4, y: 8 },
  twinKnives: { x: 9, y: 10 },
  recurveBow: { x: 7, y: 8 },
  loomwardenBow: { x: 2, y: 8 },
  rangersDirk: { x: 4, y: 10 },
  starstringLongbow: { x: 4, y: 7 },
  whisperfang: { x: 3, y: 10 },
  handHammer: { x: 6, y: 11 },
  minersPick: { x: 6, y: 12 },
  beardedAxe: { x: 6, y: 12 },
  maul: { x: 4, y: 11 },
  greataxe: { x: 7, y: 12 },
  quarryBreaker: { x: 6, y: 12 },
  mountainbreaker: { x: 7, y: 11 },
  spear: { x: 4, y: 10 },
  fangKnife: { x: 4, y: 10 },
  boneClub: { x: 3, y: 12 },
  cleaver: { x: 4, y: 10 },
  meatHook: { x: 7, y: 2 },
  harpoon: { x: 7, y: 11 },
  glaive: { x: 4, y: 12 },
  bonecrusher: { x: 3, y: 12 },
  venomFang: { x: 4, y: 11 },
  wyrmtoothSpear: { x: 4, y: 10 },
  butcherKingsCleaver: { x: 3, y: 11 },
  sproutWand: { x: 3, y: 10 },
  thornrod: { x: 3, y: 11 },
  sparkCoil: { x: 7, y: 12 },
  bloomstaff: { x: 4, y: 11 },
  greenvialHerbal: { x: 7, y: 12 },
  worldrootStaff: { x: 7, y: 10 },
}
const gripOf = (k: IconKey): Pt => GRIP[k] ?? { x: 8, y: 11 }

/**
 * Is the art's painted weapon the picture of this hero's weapon? It is for
 * the weapon itself and for every weapon it stands in for ({@link
 * Rig.paintedFor}). Never for a draft's held picture (`HeroGear.art`).
 */
export function paintsMain(rig: Rig, gear: Pick<HeroGear, 'main' | 'art'>): boolean {
  if (gear.art?.main || rig.paintedMain === null) return false
  return gear.main === null ? rig.paintedBare : gear.main === rig.paintedMain || rig.paintedFor.includes(gear.main)
}

/** Does this hero's weapon hand hide the art's painted weapon? */
export function unpaints(rig: Rig, gear: HeroGear): boolean {
  return rig.unpaint.length > 0 && rig.paintedMain !== null && gear.main !== rig.paintedMain && !paintsMain(rig, gear)
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
 * The body the painted shield hid, rebuilt per frame at build time
 * (`scripts/shield-fill-lib.ts`, written by `npm run anchors` into
 * `shieldFill.generated.ts`, checked by `anchors:check`): one strip's patch.
 * `frames[f]` is runs `y, x, codes` in the frame's own px, one palette index
 * per pixel (`FILL_CODES`); a 0-alpha colour clears.
 */
export interface StripFill {
  /** The strip the patch was made for; any other size is never patched. */
  w: number
  h: number
  /** Packed `0xRRGGBBAA`. */
  palette: readonly number[]
  /**
   * Per frame, where the off-hand piece is held on the rebuilt knight, in
   * logical px from the hero's origin: `[handX, handY, coverX, coverY]` — the
   * near hand, hidden behind the body at the tunic's side ({@link Hold}
   * `hand`), and the painted shield's edge against the body — its right
   * edge, at its middle height (`cover`).
   */
  grips: readonly (readonly [number, number, number, number])[]
  frames: readonly (readonly (number | string)[])[]
}
export type ShieldFills = Readonly<Record<string, Readonly<Record<string, StripFill>>>>

/** The palette index alphabet of a {@link StripFill}'s codes. */
export const FILL_CODES = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** The rebuilt-body patch for a pack's strip, or null (nothing measured: the cut is left as it is). */
export const shieldFillFor = (pack: string | undefined, strip: string): StripFill | null => (pack ? SHIELD_FILL[pack]?.[strip] ?? null : null)

/** The torso table's key for a strip with its painted shield cut and the body rebuilt (`bodyAnchors.generated.ts`). */
export const bareStrip = (strip: string): string => `${strip}_bare`

/**
 * What the off hand does to a strip (`role`, e.g. `fighter_idle`) of a pack's
 * look: whether the painted piece is cut ({@link unpaintsOff}), the patch that
 * rebuilds the body under it, and the torso table the body piece dresses it
 * from. A hero holding the painted piece itself (a knight with a Shield) gets
 * no cut, no patch and the strip's own torso: the art exactly as painted.
 */
export function offHandPlan(pack: string | undefined, rig: Rig, gear: HeroGear | undefined, role: string): { cut: boolean; fill: StripFill | null; torso: string } {
  const cut = !!gear && unpaintsOff(rig, gear)
  const fill = cut ? shieldFillFor(pack, role) : null
  return { cut, fill, torso: fill ? bareStrip(role) : role }
}

/**
 * Write one frame's patch into RGBA pixels, in place (columns `x0 ..` of a
 * strip `w` wide). Pure: the anchors script, the tests and the canvas path
 * all go through it. Returns the pixels written.
 */
export function applyShieldFill(d: { [i: number]: number; length: number }, w: number, x0: number, fill: StripFill, f: number): number {
  const runs = fill.frames[f]
  if (!runs) return 0
  let n = 0
  for (let i = 0; i + 2 < runs.length; i += 3) {
    const y = runs[i] as number
    const x = runs[i + 1] as number
    const codes = runs[i + 2] as string
    for (let j = 0; j < codes.length; j++) {
      const c = fill.palette[FILL_CODES.indexOf(codes[j])]
      const o = (y * w + x0 + x + j) * 4
      d[o] = c >>> 24
      d[o + 1] = (c >>> 16) & 255
      d[o + 2] = (c >>> 8) & 255
      d[o + 3] = c & 255
      n++
    }
  }
  return n
}

/**
 * Cut the painted off-hand piece from every frame of a strip's RGBA pixels and,
 * when a patch is given (and made for this size), rebuild the body it hid.
 * In place. The canvas path ({@link unpaintedStrip}) and the build check share it.
 */
export function cutAndFill(d: { [i: number]: number; length: number }, w: number, h: number, frames: number, fill: StripFill | null): void {
  const cw = Math.round(w / frames)
  const patch = fill && fill.w === w && fill.h === h && fill.frames.length === frames ? fill : null
  for (let f = 0; f < frames; f++) {
    cutOffHand(d, w, h, f * cw, Math.min(cw, w - f * cw))
    if (patch) applyShieldFill(d, w, f * cw, patch, f)
  }
}

/**
 * A strip with the painted weapon and/or off-hand piece cut out (see
 * {@link Rig.unpaint}, {@link Rig.offCut}) — and, where the off hand is cut,
 * the body under it rebuilt (`fill`, {@link shieldFillFor}). One canvas per
 * source strip and cut, kept: `pixmap()` caches its bake by source IDENTITY,
 * so a stable canvas is baked once and never again.
 */
export function unpaintedStrip(
  src: HTMLImageElement | HTMLCanvasElement,
  rig: Rig,
  frames: number,
  cut: Cut,
  fill: StripFill | null = null,
): HTMLImageElement | HTMLCanvasElement {
  const main = cut.main && rig.unpaint.length > 0
  const off = cut.off && rig.offCut
  if (typeof document === 'undefined' || (!main && !off)) return src
  const key = `${main ? 'm' : ''}${off ? (fill ? 'of' : 'o') : ''}`
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
    cutAndFill(img.data, w, h, frames, fill)
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
 * The ground shadow is translucent, so it is never ink and never cut. What
 * the shield hid of the body is NOT restored here: {@link cutAndFill} writes
 * the build-time patch that does that over the result.
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
export function drawOffHand(ctx: CanvasRenderingContext2D, rig: Rig, gear: HeroGear, grip?: StripFill['grips'][number]): void {
  const art = gear.art?.off
  const key = art ? null : gear.off
  if (!art && (!key || key === rig.paintedOff)) return
  if (!grip) {
    hold(ctx, key, rig.fistL.x, rig.fistL.y, art)
    return
  }
  if (holdOf(key, gear) === 'hand') {
    hold(ctx, key, grip[0], grip[1], art)
    return
  }
  // Where the painted shield stood: against the body as the shield's edge was,
  // at its middle height — the hand behind it, as the art's is.
  const c = art ? artCanvas(art) : cellCanvas(key!)
  if (!c) return
  const b = opaqueBox(c)
  ctx.drawImage(c, Math.round(grip[2] - b.x1), Math.round(grip[3] - (b.y0 + b.y1) / 2))
}

const boxes = new WeakMap<HTMLCanvasElement, { x0: number; x1: number; y0: number; y1: number }>()
/** The painted box of a held picture's canvas (memo per canvas). */
function opaqueBox(c: HTMLCanvasElement): { x0: number; x1: number; y0: number; y1: number } {
  const hit = boxes.get(c)
  if (hit) return hit
  let box = { x0: 0, x1: c.width - 1, y0: 0, y1: c.height - 1 }
  const d = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data
  if (d) {
    let x0 = Infinity
    let x1 = -1
    let y0 = Infinity
    let y1 = -1
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (d[(y * c.width + x) * 4 + 3] >= 128) {
          x0 = Math.min(x0, x)
          x1 = Math.max(x1, x)
          y0 = Math.min(y0, y)
          y1 = Math.max(y1, y)
        }
    if (x1 >= 0) box = { x0, x1, y0, y1 }
  }
  boxes.set(c, box)
  return box
}

/**
 * How the rebuilt knight holds an off-hand piece (`StripFill.grips`):
 *  - `cover`: where the painted shield stood, over the same footprint, so the
 *    piece takes the shield's place and the hand is behind it, as the art's
 *    is — the shields, the books, the quiver, the banner, every board;
 *  - `hand`: gripped at its own grip by the near hand, at the tunic's side —
 *    a second weapon (every key with a {@link GRIP}).
 */
export type Hold = 'hand' | 'cover'
const HAND_HELD = new Set<IconKey>(Object.keys(GRIP) as IconKey[])
export function holdOf(key: IconKey | null, gear: Pick<HeroGear, 'hold' | 'art'>): Hold {
  if (gear.hold) return gear.hold
  if (gear.art?.off) return gear.art.off.hold ?? 'cover'
  return key && HAND_HELD.has(key) ? 'hand' : 'cover'
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
  if (paintsMain(rig, gear)) {
    if (gear.glint && rig.tip && !attacking) drawGlint(ctx, gear.glint, rig.tip.x, rig.tip.y, now, still)
    return
  }
  // A cell that would not read in this look's fist is not drawn at all (`Rig.markMain`).
  if (!art && !rig.markMain) return
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
