/**
 * The hero rig — ONE skeleton for every people, posed per frame.
 *
 * A pose is a set of named anchors in the 176 px cell (feet on y = 138):
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

/**
 * Measured against the pack's pawn, knight and archer (round 3): the head is the
 * widest mass, the body under it narrow and short, the legs thin and dark, the
 * arms slim, the fists small. The arm is two bones (`armLen` × 0.6 each), so a
 * resting arm bends and its fist hangs at mid-thigh.
 */
export const RACE_BODY: Readonly<Record<RaceId, RaceBody>> = {
  human: { headRx: 20.5, headRy: 19, neck: 6, torsoRx: 11.5, torsoH: 20, flare: 2, legH: 7.5, legR: 2.8, footRx: 4.4, stance: 5.5, armLen: 15, armR: 2.7, handR: 3.7 },
  elf: { headRx: 18, headRy: 20, neck: 6, torsoRx: 9.5, torsoH: 23, flare: 1, legH: 11, legR: 2.5, footRx: 4.2, stance: 5, armLen: 17, armR: 2.4, handR: 3.4 },
  dwarf: { headRx: 21.5, headRy: 18, neck: 7, torsoRx: 15.5, torsoH: 17, flare: 3, legH: 3.5, legR: 3.6, footRx: 5, stance: 8, armLen: 11, armR: 3.4, handR: 4.2 },
  reptilian: { headRx: 19, headRy: 17, neck: 5, torsoRx: 11.5, torsoH: 22, flare: 2, legH: 8, legR: 3, footRx: 4.8, stance: 6, armLen: 16, armR: 2.8, handR: 3.8 },
  gnome: { headRx: 23, headRy: 21, neck: 6, torsoRx: 9.5, torsoH: 14, flare: 2, legH: 3.5, legR: 2.5, footRx: 4, stance: 5, armLen: 11.5, armR: 2.4, handR: 3.4 },
}

/** The limits every people's body stays inside, so every part fits every people. */
export const RACE_LIMITS: Readonly<Record<keyof RaceBody, readonly [number, number]>> = {
  headRx: [17, 24], headRy: [16, 22], neck: [4, 8], torsoRx: [9, 16], torsoH: [13, 24], flare: [0, 4],
  legH: [3, 12], legR: [2.4, 3.8], footRx: [3.8, 5.2], stance: [4.5, 9], armLen: [10, 18], armR: [2.3, 3.5], handR: [3.3, 4.4],
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

export type Expression = 'neutral' | 'focus' | 'hurt' | 'happy' | 'smug' | 'wink' | 'closed'

export type AnimId = 'idle' | 'walk' | 'attack' | 'hit' | 'cheer' | 'tic' | 'react'
export const ANIMS: readonly AnimId[] = ['idle', 'walk', 'attack', 'hit', 'cheer', 'tic', 'react']

/**
 * A company face's way of standing (`docs/characters/`): the temperament in
 * the body. lean: eager, in at you · rock: back on the heels, pleased with
 * itself · planted: square, stubborn · hunch: low and wary · still: quiet.
 */
export type Posture = 'lean' | 'rock' | 'planted' | 'hunch' | 'still'
/** The five company faces: each brings its own idle tempo, tic and reaction. */
export type PersonaId = 'saffra' | 'odile' | 'brannoch' | 'hask' | 'wren'
export const PERSONAS: readonly PersonaId[] = ['saffra', 'odile', 'brannoch', 'hask', 'wren']
export type Motion = 'swing' | 'thrust' | 'shoot' | 'cast'
export const MOTIONS: readonly Motion[] = ['swing', 'thrust', 'shoot', 'cast']
/** How the hands share the main item. */
export type Grip = 'one' | 'two' | 'bow' | 'twin'

/** What a frame asks the FX layer for (the swing's smear, a loosed arrow, a spell's spark). */
export interface FrameFx {
  /** A tail's swish: the tip's offset (px). */
  tail?: number
  /** Saffra's scale tips under a pinch; the pinch falls. */
  weigh?: boolean
  pinch?: boolean
  /** Brannoch's tally: marks added to the slate. */
  tally?: number
  /** A vial held to the light glints. */
  glint?: boolean
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
  /** A wind-up: the near arm and what it holds pass BEHIND the head this frame. */
  behind: boolean
}

/** A hand's keyframe: reach (× arm length), direction (deg, 0 = right, 90 = down), item angle. */
type HandKey = readonly [r: number, dir: number, item: number]

export interface Key {
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
  /** The near arm winds up behind the head (drawn before it). */
  behind?: boolean
}

/** Rest hands per grip. */
const REST: Readonly<Record<Grip, { main: HandKey; off: HandKey }>> = {
  one: { main: [1.05, 52, 50], off: [0.95, 125, -10] },
  // a two-hander rests tipped forward: an upright pole would rise past the face
  two: { main: [1.0, 50, 48], off: [0.95, 125, 0] },
  bow: { main: [1.0, 66, 38], off: [0.95, 125, 0] },
  twin: { main: [1.0, 58, 40], off: [0.95, 125, -35] },
}

/**
 * A face's own resting hands (over the grip's): Saffra shows her scale forward
 * at the waist, her elbow bent; Wren carries his vial up at his side (a short
 * people's hanging hand is at the ground).
 */
const PERSONA_REST: Partial<Record<PersonaId, { main?: HandKey; off?: HandKey }>> = {
  saffra: { main: [0.85, 30, 0] },
  wren: { off: [0.72, 140, 0] },
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

/**
 * The attacks. A chibi arm cannot reach over its head, so a wind-up goes UP AND
 * BACK, behind the head (as the pack's warrior winds up), never up in front of
 * the face.
 */
const ATTACK: Readonly<Record<Motion, readonly Key[]>> = {
  swing: [
    { lean: -1, main: [1.0, -140, -20], off: [0.9, 125, -10], expr: 'focus', behind: true },
    { lean: -2, main: [1.05, -155, -40], off: [0.85, 135, -15], expr: 'focus', headDy: -1, behind: true },
    { lean: 1, main: [1.1, 4, 78], off: [0.9, 120, -5], expr: 'focus', fx: { smear: 1 }, step: 1 },
    { lean: 3, bob: 1, main: [1.15, 22, 112], off: [0.9, 105, 0], expr: 'focus', fx: { smear: 2 }, step: 2 },
    { lean: 2, bob: 1, main: [1.05, 48, 132], off: [0.9, 110, -5], step: 2 },
    { lean: 0, main: [0.95, 62, 62], off: [0.9, 115, -10], step: 1 },
  ],
  thrust: [
    { lean: -1, main: [0.65, 150, 84], off: [0.9, 120, 0], expr: 'focus' },
    { lean: -2, main: [0.45, 160, 88], off: [0.9, 130, 0], expr: 'focus' },
    { lean: 3, main: [1.4, 2, 90], off: [0.9, 100, 0], expr: 'focus', fx: { thrust: true }, step: 2 },
    { lean: 3, main: [1.45, 6, 90], off: [0.9, 100, 0], expr: 'focus', step: 2 },
    { lean: 1, main: [1.05, 30, 66], off: [0.9, 110, 0], step: 1 },
    { lean: 0, main: [0.92, 66, 48], off: [0.9, 115, 0] },
  ],
  shoot: [
    { lean: 0, main: [1.2, 8, 18], off: [0.9, 6, 0], expr: 'focus' },
    { lean: -1, main: [1.25, 8, 18], off: [0.35, 200, 0], expr: 'focus', drawn: true },
    { lean: -1, main: [1.25, 8, 18], off: [0.55, 192, 0], expr: 'focus', drawn: true },
    { lean: 1, main: [1.25, 8, 18], off: [0.95, 198, 0], expr: 'focus', fx: { loose: true } },
    { lean: 0, main: [1.2, 12, 30], off: [0.85, 160, 0] },
    { lean: 0, main: [1.05, 30, 45], off: [0.9, 125, 0] },
  ],
  cast: [
    { lean: -1, main: [1.0, -135, -10], off: [0.9, 125, 0], expr: 'focus', behind: true },
    { lean: -1, main: [1.05, -150, -15], off: [0.9, 135, 0], expr: 'focus', fx: { charge: true }, headDy: -1, behind: true },
    { lean: 2, main: [1.25, 2, 64], off: [0.9, 110, 0], expr: 'focus', fx: { burst: true }, step: 1 },
    { lean: 2, main: [1.25, 6, 66], off: [0.9, 110, 0], expr: 'focus', step: 1 },
    { lean: 1, main: [1.05, 28, 44], off: [0.9, 115, 0] },
    { lean: 0, main: [0.95, 62, 50], off: [0.9, 115, 0] },
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
  { lean: -3, headTilt: -10, main: [0.95, 70, 70], off: [0.95, 135, -20], expr: 'hurt' },
  { lean: -2, bob: 1, headTilt: -6, main: [0.95, 65, 62], off: [0.95, 125, -15], expr: 'hurt' },
  { lean: -1, headTilt: -2, expr: 'neutral' },
]

/** Cheer: the near fist pumps at chest height (a near arm raised would cross the face), the far arm goes up behind the head. */
const CHEER: readonly Key[] = [
  { bob: 1, headDy: 1, main: [0.95, 60, 50], off: [0.9, 110, 0], expr: 'happy' },
  { lift: 4, main: [1.2, 40, 44], off: [1.15, -112, 0], expr: 'happy' },
  { lift: 6, main: [1.25, 34, 40], off: [1.2, -106, 0], expr: 'happy' },
  { lift: 2, main: [1.1, 46, 50], off: [1.05, -118, 0], expr: 'happy' },
]

// ── the company faces: idle tempo, tic, reaction (hand keys are absolute) ──

/**
 * Each face moves in its own SHAPE, at its own period (co-prime, never equal):
 * Saffra a brisk bob (0.83 s), Odile a slow breath that rises (1.57 s),
 * Brannoch a planted weight shift (2.21 s), Hask a sway with his tail (1.93 s),
 * Wren a gentle bob with a lagging hat (1.31 s). Idle hand keys are offsets.
 */
export const PERSONA_IDLE: Readonly<Record<PersonaId, readonly Key[]>> = {
  saffra: [{ bob: 0 }, { bob: 1 }, { bob: 1, headDy: 1 }, { bob: 0, headDy: 1 }, { bob: 0 }],
  odile: [{}, {}, { headDy: -1 }, { headDy: -1, main: [0, -2, 0] }, { headDy: -1, main: [0, -2, 0] }, { headDy: -1 }, {}, {}],
  brannoch: [{}, { lean: -1 }, { lean: -1 }, { lean: -1 }, { lean: 0 }, {}, { lean: 1 }, { lean: 1 }, { lean: 1 }, { lean: 0 }, {}],
  hask: [
    { fx: { tail: 0 } }, { lean: 1, fx: { tail: 1 } }, { lean: 1, fx: { tail: 2 } }, { lean: 1, fx: { tail: 2 } }, { lean: 0, fx: { tail: 1 } },
    { fx: { tail: 0 } }, { lean: -1, fx: { tail: -1 } }, { lean: -1, fx: { tail: -2 } }, { lean: -1, fx: { tail: -2 } }, { fx: { tail: -1 } },
  ],
  wren: [{}, { bob: 1 }, { bob: 1, headDy: 1 }, { headDy: 1 }, {}, {}],
}
/** Each face's idle period (ms): co-prime in 10 ms units (83, 157, 221, 193, 131). */
export const PERSONA_IDLE_PERIOD: Readonly<Record<PersonaId, number>> = { saffra: 829, odile: 1571, brannoch: 2213, hask: 1933, wren: 1307 }
/** Per-frame hold of a face's idle (ms; the period spread over its frames). */
export const PERSONA_IDLE_MS: Readonly<Record<PersonaId, number>> = Object.fromEntries(
  (Object.keys(PERSONA_IDLE_PERIOD) as PersonaId[]).map((id) => [id, PERSONA_IDLE_PERIOD[id] / PERSONA_IDLE[id].length]),
) as Record<PersonaId, number>

/**
 * The tics — none of them at the face. Saffra lifts her scale a little and
 * watches it tip, and grins at the price; Odile smooths the bolt on her arm, at the waist; Brannoch lifts his
 * slate and chalks another cart; Hask blinks slowly and swishes his tail; Wren
 * holds the vial out to the side, in the light.
 */
export const PERSONA_TIC: Readonly<Record<PersonaId, readonly Key[]>> = {
  saffra: [
    { main: [0.85, 30, 0] },
    { main: [0.85, 22, 0], expr: 'focus' },
    { main: [0.85, 20, 0], expr: 'focus', fx: { weigh: true } },
    { main: [0.85, 20, 0], expr: 'happy', fx: { weigh: true } },
    { main: [0.85, 24, 0], expr: 'happy' },
    { main: [0.85, 30, 0] },
  ],
  odile: [
    { main: [1.1, 120, 0], expr: 'smug' },
    { main: [1.4, 138, 0], expr: 'smug' },
    { main: [1.55, 146, 0], expr: 'smug' },
    { main: [1.4, 140, 0], expr: 'smug' },
    { main: [1.55, 146, 0], expr: 'closed' },
    { main: [1.15, 115, 0], expr: 'smug' },
  ],
  brannoch: [
    { off: [1.0, 110, 0] },
    { off: [1.0, 105, 0], bob: 1, expr: 'focus' },
    { off: [1.0, 110, 0], expr: 'focus', fx: { tally: 1 } },
    { off: [1.0, 105, 0], bob: 1, expr: 'focus', fx: { tally: 1 } },
    { off: [1.0, 110, 0], expr: 'focus', fx: { tally: 2 } },
    { off: [0.95, 120, 0], fx: { tally: 2 } },
  ],
  hask: [
    { fx: { tail: 0 } },
    { expr: 'smug', fx: { tail: 2 } },
    { expr: 'closed', fx: { tail: 4 } },
    { expr: 'closed', fx: { tail: 3 } },
    { expr: 'smug', fx: { tail: 0 } },
    { fx: { tail: -3 } },
  ],
  wren: [
    { off: [1.1, 140, 0], expr: 'focus' },
    { off: [1.4, 165, 0], expr: 'focus' },
    { off: [1.6, 188, 0], expr: 'focus', fx: { glint: true } },
    { off: [1.6, 188, 0], expr: 'happy', fx: { glint: true } },
    { off: [1.3, 160, 0], expr: 'happy' },
    { off: [1.0, 125, 0] },
  ],
}

/** The reactions, each its own style: Saffra a quick hop and a wink; Odile a slow half-bow; Brannoch one curt nod; Hask twirls his hook; Wren a small bounce, the vial raised to the side. */
export const PERSONA_REACT: Readonly<Record<PersonaId, readonly Key[]>> = {
  saffra: [
    { lift: 1, main: [1.15, 42, 0], expr: 'wink' },
    { lift: 2, main: [1.2, 36, 0], expr: 'wink' },
    { lift: 1, main: [1.1, 46, 0], expr: 'happy' },
    { expr: 'happy' },
  ],
  odile: [
    { lean: 2, headDy: 1, headTilt: 5, main: [0.85, 118, 0], expr: 'closed' },
    { lean: 3, headDy: 2, headTilt: 8, main: [0.8, 120, 0], expr: 'closed' },
    { lean: 2, headDy: 1, headTilt: 4, main: [0.85, 118, 0], expr: 'happy' },
    { lean: 0, expr: 'smug' },
  ],
  brannoch: [{ headDy: 2, headTilt: 6 }, { headDy: 1, headTilt: 2 }, { headDy: 0 }],
  hask: [
    { main: [1.1, 20, 100], fx: { tail: 2 } },
    { main: [1.15, 18, 165], fx: { tail: 3 } },
    { main: [1.15, 18, 230], fx: { tail: 1 } },
    { main: [1.0, 50, 140], fx: { tail: 0 } },
  ],
  wren: [
    { lift: 1, off: [1.3, 160, 0], expr: 'happy' },
    { lift: 2, off: [1.55, 182, 0], expr: 'happy', fx: { glint: true } },
    { lift: 0, off: [1.3, 160, 0], expr: 'happy' },
    { off: [1.0, 125, 0] },
  ],
}

/** How a posture sets the body: a lean, a head drop and tilt, a wider stance. */
const POSTURE: Readonly<Record<Posture, { lean: number; headDy: number; headTilt: number; stance: number }>> = {
  lean: { lean: 2, headDy: 0, headTilt: 3, stance: 0 },
  rock: { lean: -2, headDy: -1, headTilt: -4, stance: 0 },
  planted: { lean: 0, headDy: 1, headTilt: 0, stance: 2 },
  hunch: { lean: 1, headDy: 3, headTilt: 4, stance: 1 },
  still: { lean: 0, headDy: 0, headTilt: 0, stance: 0 },
}

export const FRAME_COUNT: Readonly<Record<AnimId, number>> = { idle: IDLE.length, walk: WALK.length, attack: 6, hit: HIT.length, cheer: CHEER.length, tic: 6, react: 4 }

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
  tic: [140, 140, 260, 260, 160, 140],
  react: [90, 140, 120, 120],
}

function keysFor(anim: AnimId, motion: Motion, persona?: PersonaId): readonly Key[] {
  if (persona) {
    if (anim === 'idle') return PERSONA_IDLE[persona]
    if (anim === 'tic') return PERSONA_TIC[persona]
    if (anim === 'react') return PERSONA_REACT[persona]
  }
  if (anim === 'tic' || anim === 'react') return IDLE
  return anim === 'idle' ? IDLE : anim === 'walk' ? WALK : anim === 'attack' ? ATTACK[motion] : anim === 'hit' ? HIT : CHEER
}

/** Frames in an animation (a company face's idle, tic and reaction are its own). */
export function framesFor(anim: AnimId, persona?: PersonaId): number {
  if (persona && (anim === 'idle' || anim === 'tic' || anim === 'react')) return keysFor(anim, 'swing', persona).length
  return FRAME_COUNT[anim]
}

/** Per-frame hold times (ms) for an animation of a look. */
export function frameMsFor(anim: AnimId, persona?: PersonaId): number[] {
  const n = framesFor(anim, persona)
  if (persona && anim === 'idle') return Array.from({ length: n }, () => PERSONA_IDLE_MS[persona])
  const base = FRAME_MS[anim]
  return Array.from({ length: n }, (_, i) => base[i] ?? base[base.length - 1])
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
export function poseFor(race: RaceId, anim: AnimId, frame: number, motion: Motion = 'swing', grip: Grip = 'one', persona?: PersonaId, posture: Posture = 'still'): Pose {
  const b0 = RACE_BODY[race]
  const pz = POSTURE[posture]
  const b = pz.stance ? { ...b0, stance: b0.stance + pz.stance } : b0
  const keys = keysFor(anim, motion, persona)
  const k = keys[((frame % keys.length) + keys.length) % keys.length]
  const lift = k.lift ?? 0
  const bob = k.bob ?? 0
  const lean = (k.lean ?? 0) + pz.lean

  const footY = FEET - 2.5 - lift
  const hipsY = FEET - 3 - b.legH - lift
  const torsoTop = hipsY - b.torsoH + bob
  const torsoH = b.torsoH - bob
  const headY = torsoTop - b.headRy + b.neck + (k.headDy ?? 0) + pz.headDy
  const step = k.step ?? 0

  const torsoX = CX + lean * 0.6
  // the arms hang from the torso's sides BELOW the head (an arm drawn in front of the head
  // must never start under the chin, where it reads as something at the mouth)
  const chin = headY + b.headRy
  const shoulderY = Math.min(hipsY - 2, Math.max(torsoTop + 4, chin + b.armR + 1.5))
  const shoulderMain = { x: torsoX + b.torsoRx - 1.5, y: shoulderY }
  const shoulderOff = { x: torsoX - b.torsoRx + 1.5, y: shoulderY }

  const rest = { ...REST[grip], ...(persona ? PERSONA_REST[persona] : undefined) }
  const hand = (key: HandKey | undefined, base: HandKey, offset: boolean): HandKey =>
    !key ? base : offset ? [base[0] + key[0], base[1] + key[1], base[2] + key[2]] : key
  const offsetKeys = (anim === 'idle' || anim === 'walk') && IDLE_IS_OFFSET
  let mk = hand(k.main, rest.main, offsetKeys)
  let ok = hand(k.off, rest.off, offsetKeys)
  // both hands on one shaft: the arms stay closer in (a broad people never overreaches the cell)
  if (grip === 'two' && anim === 'attack') mk = [mk[0] * 0.8, mk[1], mk[2]]
  // a bow at rest is carried low and tipped forward (its upper limb never rises past the face)
  if (grip === 'bow' && anim !== 'attack') mk = [mk[0], Math.max(mk[1], 62), Math.max(50, mk[2])]

  const place = (sh: { x: number; y: number }, key: HandKey): Anchor => {
    const rad = (key[1] * Math.PI) / 180
    return { x: sh.x + Math.cos(rad) * b.armLen * key[0], y: sh.y + Math.sin(rad) * b.armLen * key[0], angle: key[2], facing: 1 }
  }
  let mainHand = place(shoulderMain, mk)
  // a resting hand hangs where its arm puts it (never pushed out sideways: that straightens the arm)
  const resting = anim === 'idle' || anim === 'walk' || anim === 'hit' || anim === 'cheer'
  // the bigger the head, the further forward a resting one-hander leans (its blade clears the face)
  if (resting && (grip === 'one' || grip === 'twin' || grip === 'bow' || grip === 'two')) mainHand = { ...mainHand, angle: Math.max(mainHand.angle, 50 + Math.max(0, b.headRx - 20) * (grip === 'two' ? 8 : 5)) }
  let offHand = place(shoulderOff, ok)
  if (grip === 'two') {
    // the off hand closes on the shaft, a hand's breadth below the main
    const rad = (mainHand.angle * Math.PI) / 180
    const gap = b.handR * 2 + 1
    offHand = { x: mainHand.x - Math.sin(rad) * gap, y: mainHand.y + Math.cos(rad) * gap, angle: mainHand.angle, facing: 1 }
  } else if (grip === 'twin' && anim === 'attack') {
    // twin blades: the off blade follows the main a beat behind
    const prev = keys[(frame + keys.length - 1) % keys.length].main ?? rest.main
    // the same stroke from the far shoulder, a beat behind (never mirrored up across the face)
    ok = [prev[0] * 0.9, prev[1], prev[2] + 30]
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
    head: { x: CX + lean + 1, y: headY, angle: (k.headTilt ?? 0) + pz.headTilt, facing: 1 },
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
    behind: !!k.behind,
  }
}
