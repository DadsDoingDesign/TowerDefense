/**
 * The company faces' SKELETONS (round 4, Oct 2026; the designer, on the field
 * line-up: "make like a body skeleton frame and then consider their shape and
 * look in 3d space and then design for the 2d angle from there").
 *
 * Each face is a body first: a joint table in 3D body space (px; X toward the
 * person's own right — the NEAR side in our view —, Y up from the soles, Z
 * forward), with the people's own proportions; then a pose per frame (where
 * the hands and feet go, solved by two-bone IK so every bone keeps its
 * length); then ONE projection into the game's 3/4 view facing right
 * ({@link YAW} from facing the viewer, a slight top-down {@link TILT}). The
 * near shoulder, arm, hip and leg come out to the screen's left, a pixel
 * lower and in front; the far ones to the right, a pixel higher and behind.
 * The masses (head ball, chest box, limb cylinders) are data too, so the
 * debug overlay ({@link skeletonOverlay}) can draw the 3D forms the pixels
 * were designed around.
 *
 * The pixel art (`post.ts`) is BUILT on the projected joints: the limbs are
 * drawn from them, the head, torso, boots and props are pinned to them, and a
 * held thing's grip sits on its wrist. `tests/heroBuilder.test.ts` checks the
 * skeleton on every frame (lengths, attachment, the view).
 *
 * Pure: no DOM.
 */
import type { PersonaId } from './rig'

export type V3 = readonly [number, number, number]
export type V2 = readonly [number, number]

export type People = 'human' | 'elf' | 'dwarf' | 'reptilian' | 'gnome'

export type JointId =
  | 'head' | 'neck' | 'chest' | 'pelvis'
  | 'shoulderN' | 'elbowN' | 'wristN'
  | 'shoulderF' | 'elbowF' | 'wristF'
  | 'hipN' | 'kneeN' | 'hockN' | 'ankleN'
  | 'hipF' | 'kneeF' | 'hockF' | 'ankleF'
  | 'tail1' | 'tail2' | 'tail3' | 'tail4'

/** Yaw of the 3/4 view: 0 faces the viewer, 90° is a right profile. */
export const YAW = (55 * Math.PI) / 180
/** How far "toward the viewer" drops on screen (the camera's slight top-down tilt). */
export const TILT = 0.16

/** The proportions of one body (px, 3D). A digitigrade leg has a `hock`. */
export interface BodyPlan {
  people: People
  /** Sole to crown, the hair or hat included. */
  height: number
  /** Crown to chin, the hair or hat included. */
  headH: number
  upperArm: number
  forearm: number
  thigh: number
  shin: number
  /** Digitigrade: hock to ankle (the long foot bone the reptile stands on). */
  hock?: number
  /** Shoulder and hip half-widths. */
  shoulderW: number
  hipW: number
}

/** A mass the pixels were designed around, for the overlay: a ball, a box between two joints, or a limb's cylinder. */
export type Mass =
  | { kind: 'ball'; at: JointId; r: number; dy?: number; dz?: number; stretch?: V3 }
  | { kind: 'box'; from: JointId; to: JointId; w: number; d: number }
  | { kind: 'cyl'; from: JointId; to: JointId; r: number }

export interface Skeleton {
  plan: BodyPlan
  /** The base pose in 3D body space. */
  joints: Readonly<Partial<Record<JointId, V3>>>
  masses: readonly Mass[]
  /** Where the body's origin (between the soles) sits in the 64 cell. */
  root: V2
}

/** The bones: parent → child. A chain exists only if both joints do. */
export const BONES: readonly (readonly [JointId, JointId])[] = [
  ['pelvis', 'chest'], ['chest', 'neck'], ['neck', 'head'],
  ['chest', 'shoulderN'], ['shoulderN', 'elbowN'], ['elbowN', 'wristN'],
  ['chest', 'shoulderF'], ['shoulderF', 'elbowF'], ['elbowF', 'wristF'],
  ['pelvis', 'hipN'], ['hipN', 'kneeN'], ['kneeN', 'hockN'], ['hockN', 'ankleN'], ['kneeN', 'ankleN'],
  ['pelvis', 'hipF'], ['hipF', 'kneeF'], ['kneeF', 'hockF'], ['hockF', 'ankleF'], ['kneeF', 'ankleF'],
  ['pelvis', 'tail1'], ['tail1', 'tail2'], ['tail2', 'tail3'], ['tail3', 'tail4'],
]

/** The limb bones whose length must never change from frame to frame. */
export const RIGID: readonly (readonly [JointId, JointId])[] = [
  ['shoulderN', 'elbowN'], ['elbowN', 'wristN'], ['shoulderF', 'elbowF'], ['elbowF', 'wristF'],
  ['hipN', 'kneeN'], ['kneeN', 'hockN'], ['hockN', 'ankleN'], ['hipF', 'kneeF'], ['kneeF', 'hockF'], ['hockF', 'ankleF'],
  ['tail1', 'tail2'], ['tail2', 'tail3'], ['tail3', 'tail4'],
]

// ── the five bodies ──────────────────────────────────────────────────────────
//
// Read each as a 3D figure: X is the person's own right (+ near), Y up, Z
// forward. Proportions (head-heights tall): the human 2.6, the elf 3.0 (a long
// neck and shins, narrow shoulders), the dwarf 2.3 but nearly as broad as
// tall (short thick limbs under a barrel chest), the reptile leaning forward
// over digitigrade legs with a tail as long as its body behind for a
// counterweight, the gnome 2.1 with the hat (a big head, tiny limbs). Every
// hand hangs where its people's would: the human's and the elf's at
// mid-thigh, the dwarf's at the hip, the gnome's at the hip.

const SKELETONS: Readonly<Record<PersonaId, Skeleton>> = {
  // Saffra, a human of normal build (for this world's people: 2.4 heads tall), a little lean; she leans in (the chest
  // a px forward of the hips: eager). The near fist on her hip, the elbow out behind; the far forearm forward, palm up.
  saffra: {
    plan: { people: 'human', height: 49, headH: 22, upperArm: 6.6, forearm: 6.3, thigh: 4.1, shin: 4.1, shoulderW: 7, hipW: 3.8 },
    root: [32, 57],
    joints: {
      head: [0, 34.5, 1.8], neck: [0, 23.5, 1.4], chest: [0, 22.5, 1], pelvis: [0, 10.5, 0],
      shoulderN: [7, 21.5, 0.6], elbowN: [11, 16.7, -1.8], wristN: [7.2, 12.4, 0.8],
      shoulderF: [-7, 21.5, 0.6], elbowF: [-7.8, 15.2, 0.4], wristF: [-6.8, 13.4, 6.5],
      hipN: [3.8, 9.5, 0], kneeN: [3.8, 5.5, 0.8], ankleN: [3.8, 1.5, 0],
      hipF: [-3.8, 9.5, 0], kneeF: [-3.8, 5.5, 0.8], ankleF: [-3.8, 1.5, 0],
    },
    masses: [
      { kind: 'ball', at: 'head', r: 11.5 },
      { kind: 'box', from: 'chest', to: 'pelvis', w: 14, d: 9 },
      { kind: 'cyl', from: 'shoulderN', to: 'elbowN', r: 2.4 }, { kind: 'cyl', from: 'elbowN', to: 'wristN', r: 2.1 },
      { kind: 'cyl', from: 'shoulderF', to: 'elbowF', r: 2.4 }, { kind: 'cyl', from: 'elbowF', to: 'wristF', r: 2.1 },
      { kind: 'cyl', from: 'hipN', to: 'kneeN', r: 2.6 }, { kind: 'cyl', from: 'kneeN', to: 'ankleN', r: 2.3 },
      { kind: 'cyl', from: 'hipF', to: 'kneeF', r: 2.6 }, { kind: 'cyl', from: 'kneeF', to: 'ankleF', r: 2.3 },
    ],
  },
  // Odile, a tall slender elf (2.7 heads): narrow shoulders and hips, a long neck, long shins and forearms; she stands
  // tall and still. The near arm hangs, the far forearm comes forward to cradle the bolt against her waist.
  odile: {
    plan: { people: 'elf', height: 56, headH: 21, upperArm: 7.1, forearm: 7.2, thigh: 6.5, shin: 6.6, shoulderW: 5.2, hipW: 2.8 },
    root: [32, 57],
    joints: {
      head: [0, 40.5, 0.8], neck: [0, 30.5, 0.8], chest: [0, 28.5, 0.3], pelvis: [0, 15.5, 0],
      shoulderN: [5.2, 28, 0], elbowN: [6, 21, -0.8], wristN: [6, 14.2, 0.8],
      shoulderF: [-5.2, 28, 0], elbowF: [-6.2, 21.2, 1.5], wristF: [-3.6, 22, 8.2],
      hipN: [2.8, 14.5, 0], kneeN: [2.8, 8, 0.8], ankleN: [2.8, 1.5, -0.2],
      hipF: [-2.8, 14.5, 0], kneeF: [-2.8, 8, 0.8], ankleF: [-2.8, 1.5, -0.2],
    },
    masses: [
      { kind: 'ball', at: 'head', r: 10, stretch: [0.9, 1.05, 1] },
      { kind: 'box', from: 'chest', to: 'pelvis', w: 10, d: 7 },
      { kind: 'cyl', from: 'shoulderN', to: 'elbowN', r: 1.8 }, { kind: 'cyl', from: 'elbowN', to: 'wristN', r: 1.6 },
      { kind: 'cyl', from: 'shoulderF', to: 'elbowF', r: 1.8 }, { kind: 'cyl', from: 'elbowF', to: 'wristF', r: 1.6 },
      { kind: 'cyl', from: 'hipN', to: 'kneeN', r: 2 }, { kind: 'cyl', from: 'kneeN', to: 'ankleN', r: 1.8 },
      { kind: 'cyl', from: 'hipF', to: 'kneeF', r: 2 }, { kind: 'cyl', from: 'kneeF', to: 'ankleF', r: 1.8 },
    ],
  },
  // Brannoch, a squat broad dwarf (2.2 heads, and nearly as broad as he is tall): no neck to speak of, a barrel chest,
  // short thick limbs; planted. The far hand holds the slate up at his belly, the near hand the chalk.
  brannoch: {
    plan: { people: 'dwarf', height: 42, headH: 18, upperArm: 5.7, forearm: 5.8, thigh: 3.5, shin: 3.3, shoulderW: 8.5, hipW: 4.6 },
    root: [32, 57],
    joints: {
      head: [0, 31, 2], neck: [0, 22.5, 1.5], chest: [0, 21.5, 1], pelvis: [0, 9, 0],
      shoulderN: [8.5, 20.5, 0], elbowN: [9.8, 15, -0.6], wristN: [7.4, 10.8, 2.6],
      shoulderF: [-8.5, 20.5, 0], elbowF: [-9.2, 15, 1.2], wristF: [-5.6, 13.2, 5.4],
      hipN: [4.6, 8.2, 0], kneeN: [4.8, 4.8, 0.6], ankleN: [4.8, 1.5, -0.2],
      hipF: [-4.6, 8.2, 0], kneeF: [-4.8, 4.8, 0.6], ankleF: [-4.8, 1.5, -0.2],
    },
    masses: [
      { kind: 'ball', at: 'head', r: 10, stretch: [1.05, 0.95, 1] },
      { kind: 'box', from: 'chest', to: 'pelvis', w: 19, d: 12 },
      { kind: 'cyl', from: 'shoulderN', to: 'elbowN', r: 2.7 }, { kind: 'cyl', from: 'elbowN', to: 'wristN', r: 2.5 },
      { kind: 'cyl', from: 'shoulderF', to: 'elbowF', r: 2.7 }, { kind: 'cyl', from: 'elbowF', to: 'wristF', r: 2.5 },
      { kind: 'cyl', from: 'hipN', to: 'kneeN', r: 2.8 }, { kind: 'cyl', from: 'kneeN', to: 'ankleN', r: 2.6 },
      { kind: 'cyl', from: 'hipF', to: 'kneeF', r: 2.8 }, { kind: 'cyl', from: 'kneeF', to: 'ankleF', r: 2.6 },
    ],
  },
  // Hask, an upright reptilian: the spine leans forward over digitigrade legs (hip, the knee forward, the hock back, the
  // long foot bone down to the toes), a long flat snout out in front and a heavy tail as long as the body behind, its tip
  // on the ground — the counterweight he leans against. Both forearms forward; the far hand holds the hook.
  hask: {
    plan: { people: 'reptilian', height: 46, headH: 13, upperArm: 6.5, forearm: 6, thigh: 7, shin: 6.5, hock: 5.5, shoulderW: 5.5, hipW: 3.6 },
    root: [34, 57],
    joints: {
      head: [0, 37.5, 5], neck: [0, 31, 1.5], chest: [0, 28, -0.5], pelvis: [0, 17.5, -3.5],
      shoulderN: [5.5, 27, -0.5], elbowN: [6.5, 21.4, 2.6], wristN: [5.9, 17.8, 7.4],
      shoulderF: [-5.5, 27, -0.5], elbowF: [-6.1, 21, 1.6], wristF: [-5.5, 17, 6],
      hipN: [3.6, 17, -3.5], kneeN: [3.6, 12.6, 1.9], hockN: [3.6, 6.4, -0.1], ankleN: [3.6, 1.5, 2.5],
      hipF: [-3.6, 17, -3.5], kneeF: [-3.6, 12.6, 1.9], hockF: [-3.6, 6.4, -0.1], ankleF: [-3.6, 1.5, 2.5],
      tail1: [0, 16, -8], tail2: [0, 11.5, -14.5], tail3: [0, 6, -20], tail4: [0, 1.8, -25],
    },
    masses: [
      { kind: 'ball', at: 'head', r: 6.5, dz: -1, stretch: [0.9, 0.85, 1.3] },
      { kind: 'box', from: 'chest', to: 'pelvis', w: 11, d: 10 },
      { kind: 'cyl', from: 'shoulderN', to: 'elbowN', r: 2 }, { kind: 'cyl', from: 'elbowN', to: 'wristN', r: 1.7 },
      { kind: 'cyl', from: 'shoulderF', to: 'elbowF', r: 2 }, { kind: 'cyl', from: 'elbowF', to: 'wristF', r: 1.7 },
      { kind: 'cyl', from: 'hipN', to: 'kneeN', r: 3 }, { kind: 'cyl', from: 'kneeN', to: 'hockN', r: 2 }, { kind: 'cyl', from: 'hockN', to: 'ankleN', r: 1.5 },
      { kind: 'cyl', from: 'hipF', to: 'kneeF', r: 3 }, { kind: 'cyl', from: 'kneeF', to: 'hockF', r: 2 }, { kind: 'cyl', from: 'hockF', to: 'ankleF', r: 1.5 },
      { kind: 'cyl', from: 'tail1', to: 'tail2', r: 3.8 }, { kind: 'cyl', from: 'tail2', to: 'tail3', r: 2.8 }, { kind: 'cyl', from: 'tail3', to: 'tail4', r: 1.6 },
    ],
  },
  // Wren, a tiny gnome (2.1 heads with the hat; a human's height to his hat's brim is his whole height): a big head under
  // a bigger hat, a round little body, limbs half a human's. The far hand holds the vial out at his side.
  wren: {
    plan: { people: 'gnome', height: 43, headH: 27, upperArm: 4.5, forearm: 4.2, thigh: 3.3, shin: 3, shoulderW: 5, hipW: 2.7 },
    root: [31, 57],
    joints: {
      head: [0, 22.5, 1.5], neck: [0, 15.8, 1], chest: [0, 15, 0.5], pelvis: [0, 7.8, 0],
      shoulderN: [5, 14.5, 0], elbowN: [5.8, 10.1, -0.3], wristN: [5.9, 6, 0.9],
      shoulderF: [-5, 14.5, 0], elbowF: [-5.8, 10.3, 1.8], wristF: [-6.6, 8.4, 5.4],
      hipN: [2.7, 7.2, 0], kneeN: [2.7, 3.9, 0.6], ankleN: [2.7, 1.2, -0.3],
      hipF: [-2.7, 7.2, 0], kneeF: [-2.7, 3.9, 0.6], ankleF: [-2.7, 1.2, -0.3],
    },
    masses: [
      { kind: 'ball', at: 'head', r: 7.5 },
      { kind: 'box', from: 'chest', to: 'pelvis', w: 11, d: 9 },
      { kind: 'cyl', from: 'shoulderN', to: 'elbowN', r: 1.8 }, { kind: 'cyl', from: 'elbowN', to: 'wristN', r: 1.6 },
      { kind: 'cyl', from: 'shoulderF', to: 'elbowF', r: 1.8 }, { kind: 'cyl', from: 'elbowF', to: 'wristF', r: 1.6 },
      { kind: 'cyl', from: 'hipN', to: 'kneeN', r: 2 }, { kind: 'cyl', from: 'kneeN', to: 'ankleN', r: 1.8 },
      { kind: 'cyl', from: 'hipF', to: 'kneeF', r: 2 }, { kind: 'cyl', from: 'kneeF', to: 'ankleF', r: 1.8 },
    ],
  },
}

export const skeletonOf = (id: PersonaId): Skeleton => SKELETONS[id]

// ── vector helpers ───────────────────────────────────────────────────────────

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: V3) => Math.sqrt(dot(a, a))
const unit = (a: V3): V3 => { const l = len(a) || 1; return mul(a, 1 / l) }
export const dist3 = (a: V3, b: V3) => len(sub(a, b))

/**
 * Two-bone IK: from `root`, bones `l1` then `l2`, reach `target`; the middle
 * joint bends toward `pole`. Out of reach, the chain straightens toward the
 * target (the end stops short), so the bones never stretch.
 */
export function ik2(root: V3, target: V3, l1: number, l2: number, pole: V3): [V3, V3] {
  const to = sub(target, root)
  const d = Math.min(Math.max(len(to), Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3)
  const u = unit(to)
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a))
  const p = sub(pole, mul(u, dot(pole, u)))
  const v = len(p) > 1e-6 ? unit(p) : ([0, 0, 1] as V3)
  const mid = add(root, add(mul(u, a), mul(v, h)))
  const end = add(root, mul(u, d))
  return [mid, end]
}

// ── poses ────────────────────────────────────────────────────────────────────

/**
 * One frame's pose, as offsets from the base (3D px): the body's parts
 * translate (`lift` moves the pelvis and everything above it; `chest` the
 * chest and everything on it; `head` the head and neck); a hand or a foot
 * goes to a `reach` target (3D, absolute) and its elbow or knee is solved;
 * the tail swings by `tail` (added to each tail joint, growing to the tip).
 */
export interface Pose {
  all?: V3
  lift?: V3
  chest?: V3
  head?: V3
  reachN?: V3
  reachF?: V3
  tail?: V3
}

const ARM = { N: ['shoulderN', 'elbowN', 'wristN'], F: ['shoulderF', 'elbowF', 'wristF'] } as const

/** The 3D joints of a pose. Every limb is re-solved, so its bones keep their lengths. */
export function poseJoints3(id: PersonaId, pose: Pose = {}): Partial<Record<JointId, V3>> {
  const sk = SKELETONS[id]
  const b = sk.joints
  const out: Partial<Record<JointId, V3>> = {}
  const all = pose.all ?? [0, 0, 0]
  const lift = add(all, pose.lift ?? [0, 0, 0])
  const chest = add(lift, pose.chest ?? [0, 0, 0])
  const head = add(chest, pose.head ?? [0, 0, 0])
  const at = (j: JointId, o: V3) => { const p = b[j]; if (p) out[j] = add(p, o) }
  at('pelvis', lift)
  for (const j of ['hipN', 'hipF', 'tail1'] as const) at(j, lift)
  at('chest', chest)
  for (const j of ['shoulderN', 'shoulderF'] as const) at(j, chest)
  at('neck', head)
  at('head', head)
  // arms: the wrist follows the chest unless the pose sends it somewhere; the elbow is solved
  for (const s of ['N', 'F'] as const) {
    const [sj, ej, wj] = ARM[s]
    const S0 = b[sj], E0 = b[ej], W0 = b[wj]
    if (!S0 || !E0 || !W0) continue
    const S = out[sj]!
    const l1 = dist3(S0, E0), l2 = dist3(E0, W0)
    const reach = s === 'N' ? pose.reachN : pose.reachF
    const target = reach ?? add(W0, chest)
    // the elbow bends back and out, as a resting elbow does (its base direction off the shoulder–wrist line)
    const pole = sub(E0, mul(add(S0, W0), 0.5))
    const [E, W] = ik2(S, target, l1, l2, pole)
    out[ej] = E
    out[wj] = W
  }
  // legs: the feet stay planted (unless the whole figure moves); the knee is solved, bending forward
  for (const s of ['N', 'F'] as const) {
    const hj = `hip${s}` as JointId, kj = `knee${s}` as JointId, aj = `ankle${s}` as JointId, hk = `hock${s}` as JointId
    const H0 = b[hj], K0 = b[kj], A0 = b[aj]
    if (!H0 || !K0 || !A0) continue
    const H = out[hj]!
    const A = add(A0, all)
    const C0 = b[hk]
    if (C0) {
      // digitigrade: the hock and ankle (the long foot bone) stay planted; hip→knee→hock solved, the knee forward
      const C = add(C0, all)
      const [K] = ik2(H, C, dist3(H0, K0), dist3(K0, C0), [0, 0, 1])
      out[kj] = K
      out[hk] = C
      out[aj] = A
    } else {
      const [K] = ik2(H, A, dist3(H0, K0), dist3(K0, A0), [0, 0, 1])
      out[kj] = K
      out[aj] = A
    }
  }
  // the tail: hangs off the pelvis, the swing growing toward the tip; its segments keep their lengths
  if (b.tail1) {
    const sw = pose.tail ?? [0, 0, 0]
    let prev = out.tail1!
    const chain: JointId[] = ['tail1', 'tail2', 'tail3', 'tail4']
    for (let i = 1; i < chain.length; i++) {
      const p0 = b[chain[i - 1]]!, p1 = b[chain[i]]!
      const want = add(add(p1, lift), mul(sw, i / (chain.length - 1)))
      const dir = unit(sub(want, prev))
      prev = add(prev, mul(dir, dist3(p0, p1)))
      out[chain[i]] = prev
    }
  }
  return out
}

/** Project a body-space point into the cell (px), for a body rooted at `root`. */
export function project(p: V3, root: V2): [number, number] {
  const c = Math.cos(YAW), s = Math.sin(YAW)
  const [X, Y, Z] = p
  const depth = X * s + Z * c
  return [root[0] + (-X * c + Z * s), root[1] - Y + TILT * depth]
}

/** How near the viewer a body-space point is (bigger is nearer): the draw order of the limbs. */
export const depthOf = (p: V3): number => p[0] * Math.sin(YAW) + p[2] * Math.cos(YAW)

/** A pose's joints in the cell (float px), projected. */
export function poseJoints2(id: PersonaId, pose: Pose = {}): Partial<Record<JointId, [number, number]>> {
  const sk = SKELETONS[id]
  const j3 = poseJoints3(id, pose)
  const out: Partial<Record<JointId, [number, number]>> = {}
  for (const k of Object.keys(j3) as JointId[]) out[k] = project(j3[k]!, sk.root)
  return out
}

/** The rigid bones' lengths in a pose (3D px). */
export function boneLengths(id: PersonaId, pose: Pose = {}): Map<string, number> {
  const j = poseJoints3(id, pose)
  const m = new Map<string, number>()
  for (const [a, b] of RIGID) if (j[a] && j[b]) m.set(`${a}-${b}`, dist3(j[a]!, j[b]!))
  return m
}

// ── the overlay ──────────────────────────────────────────────────────────────

const BONE_N: readonly [number, number, number] = [255, 138, 40]
const BONE_F: readonly [number, number, number] = [80, 170, 255]
const BONE_C: readonly [number, number, number] = [255, 255, 255]
const MASS: readonly [number, number, number] = [255, 236, 90]

/**
 * The debug overlay: the frame's art at `k`× (nearest neighbour), dimmed,
 * with the 3D masses outlined (yellow), the bones (near orange, far blue, the
 * spine and tail white) and a dot on every joint. For the review cards and
 * the harness; never drawn in the game.
 */
export function skeletonOverlay(id: PersonaId, art: { w: number; h: number; rgba: Uint8ClampedArray }, pose: Pose, k: number, offset: V2 = [0, 0]): { w: number; h: number; rgba: Uint8ClampedArray } {
  const W = art.w * k, H = art.h * k
  const out = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const s = (((y / k) | 0) * art.w + ((x / k) | 0)) * 4
      const o = (y * W + x) * 4
      if (art.rgba[s + 3] === 0) continue
      out[o] = art.rgba[s] * 0.62
      out[o + 1] = art.rgba[s + 1] * 0.62
      out[o + 2] = art.rgba[s + 2] * 0.62
      out[o + 3] = 255
    }
  const sk = SKELETONS[id]
  const root: V2 = [sk.root[0] + offset[0], sk.root[1] + offset[1]]
  const j3 = poseJoints3(id, pose)
  const P = (p: V3): [number, number] => { const q = project(p, root); return [(q[0] + 0.5) * k, (q[1] + 0.5) * k] }
  const plot = (x: number, y: number, c: readonly number[], r: number) => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + 0.5) continue
        const xx = Math.round(x + dx), yy = Math.round(y + dy)
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
        out.set([c[0], c[1], c[2], 255], (yy * W + xx) * 4)
      }
  }
  const line = (a: [number, number], b: [number, number], c: readonly number[], r: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])))
    for (let i = 0; i <= n; i++) plot(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, c, r)
  }
  const c = Math.cos(YAW), s = Math.sin(YAW)
  // the masses, first and thin, so the bones read over them
  const thin = Math.max(0, Math.round(k / 8))
  for (const m of sk.masses) {
    if (m.kind === 'ball') {
      const at = j3[m.at]
      if (!at) continue
      const st = m.stretch ?? [1, 1, 1]
      const ctr = add(at, [0, m.dy ?? 0, m.dz ?? 0])
      // the ball's outline: its equator and its meridian through the view, sampled
      const pts: [number, number][] = []
      for (let i = 0; i <= 48; i++) {
        const t = (i / 48) * Math.PI * 2
        // a great circle facing the viewer: the axes the screen sees
        const v: V3 = [-c * Math.cos(t) * m.r * st[0], Math.sin(t) * m.r * st[1], s * Math.cos(t) * m.r * st[2]]
        pts.push(P(add(ctr, v)))
      }
      for (let i = 1; i < pts.length; i++) line(pts[i - 1], pts[i], MASS, thin)
      // and its face's centre line (where the face points), so the 3/4 turn is visible
      const fl: [number, number][] = []
      for (let i = 0; i <= 24; i++) {
        const t = -Math.PI / 2 + (i / 24) * Math.PI
        const v: V3 = [0, Math.sin(t) * m.r * st[1], Math.cos(t) * m.r * st[2]]
        fl.push(P(add(ctr, v)))
      }
      for (let i = 1; i < fl.length; i++) line(fl[i - 1], fl[i], MASS, 0)
    } else if (m.kind === 'box') {
      const a = j3[m.from], b = j3[m.to]
      if (!a || !b) continue
      const corners = (p: V3) => [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([x, z]) => P(add(p, [(x * m.w) / 2, 0, (z * m.d) / 2])))
      const ta = corners(a), tb = corners(b)
      for (let i = 0; i < 4; i++) {
        line(ta[i], ta[(i + 1) % 4], MASS, thin)
        line(tb[i], tb[(i + 1) % 4], MASS, thin)
        line(ta[i], tb[i], MASS, thin)
      }
    } else {
      const a = j3[m.from], b = j3[m.to]
      if (!a || !b) continue
      // the cylinder's two silhouette lines
      const pa = P(a), pb = P(b)
      const dx = pb[0] - pa[0], dy = pb[1] - pa[1]
      const l = Math.hypot(dx, dy) || 1
      const nx = (-dy / l) * m.r * k, ny = (dx / l) * m.r * k
      line([pa[0] + nx, pa[1] + ny], [pb[0] + nx, pb[1] + ny], MASS, 0)
      line([pa[0] - nx, pa[1] - ny], [pb[0] - nx, pb[1] - ny], MASS, 0)
    }
  }
  const r = Math.max(1, Math.round(k / 5))
  // far bones first, then the spine, then the near ones
  const side = (a: JointId, b: JointId) => (a.endsWith('F') || b.endsWith('F') ? 0 : a.endsWith('N') || b.endsWith('N') ? 2 : 1)
  for (const pass of [0, 1, 2])
    for (const [a, b] of BONES) {
      if (side(a, b) !== pass) continue
      const ja = j3[a], jb = j3[b]
      if (!ja || !jb) continue
      // a digitigrade leg draws knee→hock→ankle, not knee→ankle
      if ((a === 'kneeN' && b === 'ankleN' && j3.hockN) || (a === 'kneeF' && b === 'ankleF' && j3.hockF)) continue
      line(P(ja), P(jb), pass === 0 ? BONE_F : pass === 2 ? BONE_N : BONE_C, r)
    }
  for (const j of Object.keys(j3) as JointId[]) {
    const p = P(j3[j]!)
    plot(p[0], p[1], [22, 28, 46], r + 2)
    plot(p[0], p[1], j.endsWith('F') ? BONE_F : j.endsWith('N') ? BONE_N : BONE_C, r + 1)
  }
  return { w: W, h: H, rgba: out }
}
