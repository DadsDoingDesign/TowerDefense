/**
 * The hero rig — ONE skeleton for every people, posed per frame.
 *
 * A pose is a set of named anchors in the 128 px cell (feet on y = 112):
 * `head`, `torso`, `hips`, `back`, `mainHand`, `offHand`, `footBack`,
 * `footFront`, plus the two shoulders the arms hang from. Every anchor has a
 * position, an angle (for a hand: the direction "up the held item" points,
 * degrees clockwise from straight up) and a facing. Parts never place
 * themselves by hand: they read the anchors, and the torso / head boxes,
 * so one sword, one cape or one breastplate fits all five peoples.
 *
 * The peoples differ by proportion only, inside fixed limits
 * ({@link RACE_LIMITS}), so a part made for one fits the rest:
 *  - human: the baseline;
 *  - elf: taller and slimmer (longer torso and legs, narrower head);
 *  - dwarf: short and broad (wide torso, stub legs, low head);
 *  - reptilian: a snout and a tail (baseline frame, longer reach);
 *  - gnome: small with a big head (short torso and legs, the widest head).
 *
 * Animation is data: per animation, per frame, a few numbers (bob, lean, jump,
 * and each hand's reach / direction / item angle). The attack is one of four
 * MOTIONS, chosen by what the main hand holds: swing (blades, axes, hammers,
 * bare fists), thrust (spears, polearms), shoot (bows), cast (wands, staffs,
 * books). Frame counts and cadence follow the pack's: idle 6 frames at 6 fps,
 * walk 6 frames at 10 fps, attack 6 frames timed slow-in / fast-strike.
 *
 * Pure: no DOM.
 */
import { CX, FEET } from './raster'

export type RaceId = 'human' | 'elf' | 'dwarf' | 'reptilian' | 'gnome'
export const RACES: readonly RaceId[] = ['human', 'elf', 'dwarf', 'reptilian', 'gnome']

/** A people's body, in px. */
export interface RaceBody {
  /** Head half-width / half-height. */
  headRx: number
  headRy: number
  /** How far the head sinks into the torso's top. */
  neck: number
  /** Torso half-width at the chest, its height, and how far its hem flares. */
  torsoRx: number
  torsoH: number
  flare: number
  legH: number
  legR: number
  footRx: number
  /** Half the distance between the feet. */
  stance: number
  armLen: number
  armR: number
  handR: number
}

export const RACE_BODY: Readonly<Record<RaceId, RaceBody>> = {
  human: { headRx: 17, headRy: 16, neck: 5, torsoRx: 13, torsoH: 18, flare: 2, legH: 7, legR: 3, footRx: 4.5, stance: 6, armLen: 11, armR: 3, handR: 4 },
  elf: { headRx: 15, headRy: 16.5, neck: 5, torsoRx: 11, torsoH: 21, flare: 1, legH: 10, legR: 2.6, footRx: 4, stance: 5, armLen: 12.5, armR: 2.6, handR: 3.6 },
  dwarf: { headRx: 18, headRy: 15, neck: 6, torsoRx: 17, torsoH: 15, flare: 3, legH: 3, legR: 3.6, footRx: 5.5, stance: 8, armLen: 10, armR: 3.6, handR: 4.6 },
  reptilian: { headRx: 16, headRy: 14, neck: 4, torsoRx: 13, torsoH: 19, flare: 2, legH: 7, legR: 3.2, footRx: 5, stance: 6, armLen: 12, armR: 3, handR: 4 },
  gnome: { headRx: 19, headRy: 17.5, neck: 5, torsoRx: 10, torsoH: 12, flare: 2, legH: 3, legR: 2.6, footRx: 4, stance: 5, armLen: 8.5, armR: 2.6, handR: 3.6 },
}

/** The limits every people's body stays inside, so every part fits every people. */
export const RACE_LIMITS: Readonly<Record<keyof RaceBody, readonly [number, number]>> = {
  headRx: [14, 20], headRy: [13, 18], neck: [3, 7], torsoRx: [9, 18], torsoH: [11, 22], flare: [0, 4],
  legH: [2, 11], legR: [2.4, 4], footRx: [3.5, 6], stance: [4, 9], armLen: [8, 13], armR: [2.4, 4], handR: [3.4, 5],
}

export interface Anchor {
  x: number
  y: number
  /** Degrees clockwise from straight up (a hand: the held item's direction). */
  angle: number
  facing: 1 | -1
}

export type AnchorId = 'head' | 'torso' | 'hips' | 'back' | 'mainHand' | 'offHand' | 'footBack' | 'footFront'
export const ANCHORS: readonly AnchorId[] = ['head', 'torso', 'hips', 'back', 'mainHand', 'offHand', 'footBack', 'footFront']

export type Expression = 'neutral' | 'focus' | 'hurt' | 'happy'

export type AnimId = 'idle' | 'walk' | 'attack' | 'hit' | 'cheer'
export const ANIMS: readonly AnimId[] = ['idle', 'walk', 'attack', 'hit', 'cheer']
export type Motion = 'swing' | 'thrust' | 'shoot' | 'cast'
export const MOTIONS: readonly Motion[] = ['swing', 'thrust', 'shoot', 'cast']
/** How the hands share the main item. */
export type Grip = 'one' | 'two' | 'bow' | 'twin'

/** What a frame asks the FX layer for (the swing's smear, a loosed arrow, a spell's spark). */
export interface FrameFx {
  smear?: 1 | 2
  thrust?: boolean
  loose?: boolean
  charge?: boolean
  burst?: boolean
}

export interface Pose {
  race: RaceId
  body: RaceBody
  anim: AnimId
  frame: number
  motion: Motion
  grip: Grip
  head: Anchor
  torso: Anchor
  hips: Anchor
  back: Anchor
  mainHand: Anchor
  offHand: Anchor
  footBack: Anchor
  footFront: Anchor
  shoulderMain: { x: number; y: number }
  shoulderOff: { x: number; y: number }
  /** The torso box this frame: top edge, height, half-width. */
  torsoTop: number
  torsoH: number
  /** The bow's string is in the off hand. */
  drawn: boolean
  expression: Expression
  fx: FrameFx
  /** The jump: the shadow stays on the ground. */
  lift: number
}

/** A hand's keyframe: reach (× arm length), direction (deg, 0 = right, 90 = down), item angle. */
type HandKey = readonly [r: number, dir: number, item: number]

interface Key {
  /** Torso-top dip (breathing): hips and feet stay. */
  bob?: number
  /** Head lag, on top of the bob. */
  headDy?: number
  headTilt?: number
  /** Upper-body lean toward the facing side, px. */
  lean?: number
  /** The whole figure, off the ground. */
  lift?: number
  main?: HandKey
  off?: HandKey
  expr?: Expression
  drawn?: boolean
  fx?: FrameFx
  /** The front foot steps (px). */
  step?: number
  /** Walk: each foot's stride offset and lift (px): [backDx, backLift, frontDx, frontLift]. */
  feet?: readonly [number, number, number, number]
}

/** Rest hands per grip. */
const REST: Readonly<Record<Grip, { main: HandKey; off: HandKey }>> = {
  one: { main: [1.0, 48, 30], off: [0.95, 125, -10] },
  two: { main: [1.0, 55, 20], off: [0.95, 125, 0] },
  bow: { main: [1.0, 40, 0], off: [0.95, 125, 0] },
  twin: { main: [1.0, 48, 40], off: [0.95, 125, -35] },
}

const IDLE: readonly Key[] = [
  { bob: 0, headDy: 0 },
  { bob: 0, headDy: 0, main: [0, 0, 1], off: [0, 0, -1] },
  { bob: 1, headDy: 0, main: [0, 1, 2], off: [0, -1, -2] },
  { bob: 1, headDy: 1, main: [0, 1, 2], off: [0, -1, -2] },
  { bob: 1, headDy: 1, main: [0, 0, 1], off: [0, 0, -1] },
  { bob: 0, headDy: 1 },
]
/** Idle hand keys are offsets from rest (added). */
const IDLE_IS_OFFSET = true

const ATTACK: Readonly<Record<Motion, readonly Key[]>> = {
  swing: [
    { lean: -1, main: [0.9, -105, -30], off: [0.9, 125, -10], expr: 'focus' },
    { lean: -2, main: [1.0, -125, -62], off: [0.85, 135, -15], expr: 'focus', headDy: -1 },
    { lean: 1, main: [1.1, -35, 48], off: [0.9, 120, -5], expr: 'focus', fx: { smear: 1 }, step: 1 },
    { lean: 3, bob: 1, main: [1.15, 22, 112], off: [0.9, 105, 0], expr: 'focus', fx: { smear: 2 }, step: 2 },
    { lean: 2, bob: 1, main: [1.05, 48, 132], off: [0.9, 110, -5], step: 2 },
    { lean: 0, main: [0.95, 62, 62], off: [0.9, 115, -10], step: 1 },
  ],
  thrust: [
    { lean: -1, main: [0.65, 165, 82], off: [0.9, 120, 0], expr: 'focus' },
    { lean: -2, main: [0.45, 185, 86], off: [0.9, 130, 0], expr: 'focus' },
    { lean: 3, main: [1.4, 2, 90], off: [0.9, 100, 0], expr: 'focus', fx: { thrust: true }, step: 2 },
    { lean: 3, main: [1.45, 6, 90], off: [0.9, 100, 0], expr: 'focus', step: 2 },
    { lean: 1, main: [1.05, 30, 66], off: [0.9, 110, 0], step: 1 },
    { lean: 0, main: [0.92, 66, 32], off: [0.9, 115, 0] },
  ],
  shoot: [
    { lean: 0, main: [1.2, -4, 0], off: [0.9, -8, 0], expr: 'focus' },
    { lean: -1, main: [1.25, -4, 0], off: [0.35, 200, 0], expr: 'focus', drawn: true },
    { lean: -1, main: [1.25, -4, 0], off: [0.55, 192, 0], expr: 'focus', drawn: true },
    { lean: 1, main: [1.25, -4, 0], off: [0.95, 198, 0], expr: 'focus', fx: { loose: true } },
    { lean: 0, main: [1.2, 2, 0], off: [0.85, 160, 0] },
    { lean: 0, main: [1.05, 30, 0], off: [0.9, 125, 0] },
  ],
  cast: [
    { lean: -1, main: [1.0, -62, -8], off: [0.9, 125, 0], expr: 'focus' },
    { lean: -1, main: [1.05, -92, 0], off: [0.9, 135, 0], expr: 'focus', fx: { charge: true }, headDy: -1 },
    { lean: 2, main: [1.25, -18, 66], off: [0.9, 110, 0], expr: 'focus', fx: { burst: true }, step: 1 },
    { lean: 2, main: [1.25, -12, 72], off: [0.9, 110, 0], expr: 'focus', step: 1 },
    { lean: 1, main: [1.05, 28, 44], off: [0.9, 115, 0] },
    { lean: 0, main: [0.95, 62, 30], off: [0.9, 115, 0] },
  ],
}

/** Walk: 6 frames, a contact–pass–contact stride; hands swing against the feet (offsets from rest). */
const WALK: readonly Key[] = [
  { bob: 0, feet: [-3, 0, 3, 0], main: [0, -10, -2], off: [0, 12, 0] },
  { bob: 1, feet: [-1, 0, 1, 2], main: [0, -4, -1], off: [0, 5, 0] },
  { bob: 0, lift: 1, feet: [1, 1, -1, 1], main: [0, 4, 1], off: [0, -5, 0] },
  { bob: 0, feet: [3, 0, -3, 0], main: [0, 10, 2], off: [0, -12, 0] },
  { bob: 1, feet: [1, 2, -1, 0], main: [0, 4, 1], off: [0, -5, 0] },
  { bob: 0, lift: 1, feet: [-1, 1, 1, 1], main: [0, -4, -1], off: [0, 5, 0] },
]

const HIT: readonly Key[] = [
  { lean: -3, headTilt: -10, main: [0.9, 95, 12], off: [0.95, 135, -20], expr: 'hurt' },
  { lean: -2, bob: 1, headTilt: -6, main: [0.9, 85, 20], off: [0.95, 125, -15], expr: 'hurt' },
  { lean: -1, headTilt: -2, expr: 'neutral' },
]

const CHEER: readonly Key[] = [
  { bob: 1, headDy: 1, main: [0.9, 70, 30], off: [0.9, 110, 0], expr: 'happy' },
  { lift: 4, main: [1.1, -78, -6], off: [1.0, -104, 0], expr: 'happy' },
  { lift: 6, main: [1.15, -84, 0], off: [1.05, -100, 0], expr: 'happy' },
  { lift: 2, main: [1.05, -70, 8], off: [1.0, -112, 0], expr: 'happy' },
]

export const FRAME_COUNT: Readonly<Record<AnimId, number>> = { idle: IDLE.length, walk: WALK.length, attack: 6, hit: HIT.length, cheer: CHEER.length }

/**
 * Per-frame hold times (ms) for previews. Idle: the game's 6 fps loop. Attack:
 * slow wind-up, fast strike, a held impact, an easy recovery.
 */
export const FRAME_MS: Readonly<Record<AnimId, readonly number[]>> = {
  idle: [167, 167, 167, 167, 167, 167],
  walk: [100, 100, 100, 100, 100, 100],
  attack: [120, 110, 55, 90, 90, 120],
  hit: [70, 90, 120],
  cheer: [90, 110, 140, 110],
}

function keysFor(anim: AnimId, motion: Motion): readonly Key[] {
  return anim === 'idle' ? IDLE : anim === 'walk' ? WALK : anim === 'attack' ? ATTACK[motion] : anim === 'hit' ? HIT : CHEER
}

/** Every (anim, frame) the rig can pose for a motion. */
export function framesOf(anim: AnimId): number {
  return FRAME_COUNT[anim]
}

/**
 * The pose: anchors for one people, one animation frame, one way of holding.
 * `grip` decides where the off hand goes (on the shaft for a two-hander, on
 * the string for a bow, mirroring the main for twin blades).
 */
export function poseFor(race: RaceId, anim: AnimId, frame: number, motion: Motion = 'swing', grip: Grip = 'one'): Pose {
  const b = RACE_BODY[race]
  const keys = keysFor(anim, motion)
  const k = keys[((frame % keys.length) + keys.length) % keys.length]
  const lift = k.lift ?? 0
  const bob = k.bob ?? 0
  const lean = k.lean ?? 0

  const footY = FEET - 2.5 - lift
  const hipsY = FEET - 3 - b.legH - lift
  const torsoTop = hipsY - b.torsoH + bob
  const torsoH = b.torsoH - bob
  const headY = torsoTop - b.headRy + b.neck + (k.headDy ?? 0)
  const step = k.step ?? 0

  const torsoX = CX + lean * 0.6
  const shoulderY = torsoTop + 4
  const shoulderMain = { x: torsoX + b.torsoRx - 2.5, y: shoulderY }
  const shoulderOff = { x: torsoX - b.torsoRx + 2.5, y: shoulderY }

  const rest = REST[grip]
  const hand = (key: HandKey | undefined, base: HandKey, offset: boolean): HandKey =>
    !key ? base : offset ? [base[0] + key[0], base[1] + key[1], base[2] + key[2]] : key
  const offsetKeys = (anim === 'idle' || anim === 'walk') && IDLE_IS_OFFSET
  let mk = hand(k.main, rest.main, offsetKeys)
  let ok = hand(k.off, rest.off, offsetKeys)
  // a bow is held up and forward in every frame the attack is not drawing it
  if (grip === 'bow' && anim !== 'attack' && anim !== 'cheer') mk = [mk[0], mk[1], 0]

  const place = (sh: { x: number; y: number }, key: HandKey): Anchor => {
    const rad = (key[1] * Math.PI) / 180
    return { x: sh.x + Math.cos(rad) * b.armLen * key[0], y: sh.y + Math.sin(rad) * b.armLen * key[0], angle: key[2], facing: 1 }
  }
  const mainHand = place(shoulderMain, mk)
  let offHand = place(shoulderOff, ok)
  if (grip === 'two') {
    // the off hand closes on the shaft, a hand's breadth below the main
    const rad = (mainHand.angle * Math.PI) / 180
    const gap = b.handR * 2 + 1
    offHand = { x: mainHand.x - Math.sin(rad) * gap, y: mainHand.y + Math.cos(rad) * gap, angle: mainHand.angle, facing: 1 }
  } else if (grip === 'twin' && anim === 'attack') {
    // twin blades: the off blade follows the main a beat behind
    const prev = keys[(frame + keys.length - 1) % keys.length].main ?? rest.main
    ok = [prev[0] * 0.9, 180 - prev[1], -prev[2]]
    offHand = place(shoulderOff, ok)
  } else {
    offHand = { ...offHand, angle: ok[2] }
  }

  return {
    race,
    body: b,
    anim,
    frame,
    motion,
    grip,
    head: { x: CX + lean + 1, y: headY, angle: k.headTilt ?? 0, facing: 1 },
    torso: { x: torsoX, y: torsoTop + torsoH / 2, angle: 0, facing: 1 },
    hips: { x: CX + lean * 0.3, y: hipsY, angle: 0, facing: 1 },
    back: { x: torsoX - b.torsoRx * 0.35, y: torsoTop + 2, angle: 0, facing: 1 },
    mainHand,
    offHand,
    footBack: { x: CX - b.stance + (k.feet?.[0] ?? 0), y: footY - (k.feet?.[1] ?? 0), angle: 0, facing: 1 },
    footFront: { x: CX + b.stance - 1 + step + (k.feet?.[2] ?? 0), y: footY - (k.feet?.[3] ?? 0), angle: 0, facing: 1 },
    shoulderMain,
    shoulderOff,
    torsoTop,
    torsoH,
    drawn: !!k.drawn,
    expression: k.expr ?? 'neutral',
    fx: k.fx ?? {},
    lift,
  }
}
