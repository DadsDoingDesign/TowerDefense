/**
 * The company faces' pixel parts at FIELD / POST size (round 4): the data
 * `post.ts` paints. Each face is its skeleton (`skeleton.ts`) dressed: limbs
 * along the bones, hand-drawn rows pinned to joints, fists on the wrists,
 * a pose per frame. Read the rows as the pixels (one letter an ink, '.'
 * clear); the ring of ink round each part and the outer line are added by
 * the painter, so a row's shape is the part's FILL.
 *
 * Pure data: no DOM.
 */
import type { RampId } from './palette'
import type { PersonaId } from './rig'
import type { JointId, Pose } from './skeleton'

export type Tone = 0 | 1 | 2 | 3
/** letter → [ramp, tone]; tone 'a' is AUTO: light on the part's upper-left edge, shade on its lower-right, mid between. */
export type InkDef = readonly [RampId, Tone | 'a']

/** Who a part belongs to, for the mouth test (the arms and what they hold are taken away). */
export type PartGroup = 'body' | 'head' | 'armN' | 'armF' | 'prop' | 'back'

interface Base {
  id: string
  group: PartGroup
  hidden?: boolean
  /** 0: no ink ring (a strand or a glint drawn on what is under it). */
  ring?: 0 | 1
}
/** Hand-drawn rows, pinned to a joint: the rows' top-left is the joint (rounded) plus `off`. */
export interface RowsPart extends Base {
  kind: 'rows'
  at: JointId
  off: readonly [number, number]
  rows: readonly string[]
  /** Auto-tone bands (px): light from the upper-left edge, shade from the lower-right. */
  band?: readonly [number, number]
}
/** A limb along its bones: a capsule through `chain`, `r` px thick at each joint, one ink letter per bone. */
export interface LimbPart extends Base {
  kind: 'limb'
  chain: readonly JointId[]
  r: readonly number[]
  inks: readonly string[]
  /** A far limb: a tone darker all over. */
  far?: boolean
  /** Drawn off its bones by this much (px): a ridge along a tail's top. */
  shift?: readonly [number, number]
}
/** A fist on the wrist, a little past it along the forearm. */
export interface FistPart extends Base {
  kind: 'fist'
  at: JointId
  from: JointId
  r: number
  ink: string
  far?: boolean
  /** How far past the wrist the fist's centre sits (px). */
  reach?: number
}
export type Part = RowsPart | LimbPart | FistPart

/** 'wink': the near eye (the first) shut, the far one open. */
export type EyeMode = 'open' | 'closed' | 'happy' | 'smug' | 'wink'
/** An eye, its top-left from the head joint (rounded): `w` × `h` of ink. */
export interface Eye { dx: number; dy: number; w: number; h: number }

export interface Key {
  pose?: Pose
  eyes?: EyeMode
  /** Where the eyes look: shifted this many px inside the face (a glance up). */
  look?: readonly [number, number]
  /** One hand-drawn part moved this many px (a hat's brim, a cloak's hem) without moving its joint. */
  nudge?: Readonly<Record<string, readonly [number, number]>>
  show?: readonly string[]
  hide?: readonly string[]
  swap?: Readonly<Record<string, readonly string[]>>
  /** Loose pixels, [x, y, ink] from the head joint (a glint, a falling grain). */
  extra?: readonly (readonly [number, number, string])[]
}

export interface PostFace {
  inks: Readonly<Record<string, InkDef>>
  /** Back to front. */
  parts: readonly Part[]
  eyes: readonly Eye[]
  /** A reptile's eye: gold, with an ink slit. */
  slit?: boolean
  /** The skin an eye closes onto. */
  skin: string
  /** The ground shadow's half-width. */
  shadowRx: number
  /** The lower face where a mouth would be (dx0, dy0, dx1, dy1 from the head joint): no arm, hand or prop ever enters it. */
  mouth: readonly [number, number, number, number]
  idle: readonly Key[]
  /** The idle's own holds (relative weights; the dock's clock scales them to its period). Absent: even. */
  idleMs?: readonly number[]
  tic: readonly Key[]
  ticMs: readonly number[]
  react: readonly Key[]
  reactMs: readonly number[]
}

const BOOTS = { b: ['leather', 0], B: ['leather', 1], j: ['leather', 2] } as const
const L = (id: string, group: PartGroup, chain: readonly JointId[], r: readonly number[], inks: readonly string[], far = false): LimbPart => ({ kind: 'limb', id, group, chain, r, inks, far })
const F = (id: string, group: PartGroup, at: JointId, from: JointId, r: number, ink: string, far = false, reach = 1.2): FistPart => ({ kind: 'fist', id, group, at, from, r, ink, far, reach })
const R = (id: string, group: PartGroup, at: JointId, off: readonly [number, number], rows: readonly string[], more: Partial<RowsPart> = {}): RowsPart => ({ kind: 'rows', id, group, at, off, rows, ...more })

export const POST_FACES: Readonly<Record<PersonaId, PostFace>> = {
  // ── Saffra, Peppercorn's broker. A human of normal build, lean, leaning in. The near fist on her hip (impatient:
  //    the price is moving), the far hand held out palm-up at the waist with a burlap pepper sack on it, weighing it.
  //    A saffron bandana with a gold band, its knot's tails behind; a red vest over a saffron tunic.
  saffra: {
    inks: {
      ...BOOTS,
      s: ['skinTan', 1], S: ['skinTan', 2], l: ['skinTan', 0], t: ['skinTan', 'a'],
      c: ['ochre', 0], C: ['ochre', 1], D: ['ochre', 2], E: ['ochre', 3], o: ['ochre', 'a'],
      G: ['gold', 2],
      q: ['hairGinger', 0], h: ['hairGinger', 1], H: ['hairGinger', 2],
      r: ['red', 0], R: ['red', 1], Q: ['red', 2],
      n: ['navy', 'a'],
      w: ['wood', 0], u: ['wood', 1], U: ['wood', 2], V: ['wood', 3], e: ['red', 1], z: ['red', 2],
    },
    skin: 's',
    shadowRx: 10,
    mouth: [-2, 2, 13, 8],
    parts: [
      // the bandana's knot and its two tails, behind the head
      R('knot', 'head', 'head', [-15, -4], ['..DC', '.DCC', 'DDCc', 'DCc.', 'DCc.', 'Cc..', 'c...']),
      L('farLeg', 'body', ['hipF', 'kneeF', 'ankleF'], [2.6, 2.4, 1.6], ['n', 'n'], true),
      R('farBoot', 'body', 'ankleF', [-3, -1], ['bBBBB.', 'bBBBBB', 'bbbbbb']),
      // the far arm: the upper arm hangs, the forearm comes forward, palm up
      L('farArm', 'armF', ['shoulderF', 'elbowF', 'wristF'], [2.3, 2, 1.8], ['o', 't'], true),
      L('nearLeg', 'body', ['hipN', 'kneeN', 'ankleN'], [2.6, 2.4, 1.6], ['n', 'n']),
      R('nearBoot', 'body', 'ankleN', [-3, -1], ['jjBBB.', 'jBBBBB', 'bbbbbb']),
      R('neck', 'body', 'neck', [-3, -3], ['.ls..', 'lsss.', 'lsss.', '.ls..']),
      R('torso', 'body', 'chest', [-8, -1], [
        '.....CDDDDC.....',
        '..RQQQCDDCRRRr..',
        '.RQQQRRCDCRRRrr.',
        'RQQQRRRCDCRRRrrr',
        'RQQRRRRCDCRRRrrr',
        'RQQRRRRCCCRRRrrr',
        'RQRRRRRCDCRRRrr.',
        '.RQRRRRCCCRRRr..',
        '.wuuUUUuuuuuuw..',
        '.DDDCCCCCCCCCcc.',
        'DDDDCCCCCCCCCccc',
        'DDDCCCCCCCCCCcc.',
      ]),
      // the head, 3/4 to the right: the cranium toward the back under the bandana, the face plane forward, the near ear
      // at the hairline, the nose breaking the front; no mouth
      R('head', 'head', 'head', [-12, -12], [
        '.......DDDDDDCC.........',
        '.....DDDEEDDDDCCC.......',
        '....DDDEEDDDDCCCcCc.....',
        '...DDDDDDDDDCCCcCCCc....',
        '..DDDDDDDDDCCCcCCCCcc...',
        '.DDDDDDDDDCCcCCCCCCCcc..',
        '.DDDDDDcDCCcCCCCCCCCCcc.',
        'DDDDDDcDCCCCCCCCCCCCCccc',
        'GGGGGGGGGGGGGGGGGGGGGGGG',
        'qHHHhhhhSSSSSSSSSSSSSSSs',
        'qHHhhhhhSSSSSSSSSSSSSSSs',
        'qhhhhhHHlSSSSSSSSSSSSSSss',
        'qhhhhhHhllSSSSSSSSSSSSSss',
        'qhHHhhhhllSSSSSSSSSSSSsss',
        'qhHhhhhhhlSSSSSSSSSSSSss',
        'qhhhhhhhhssSSSSSSSSSSss',
        '.qhhhhhhhssSSSSSSSSSss',
        '..qhhhhhqsssSSSSSSsss',
        '..qqhhhhqssssSSSSsss',
        '...qqqhhq.sssssssss',
        '.....qqq...sssssss',
        '............ssss',
      ]),
      // the near arm, akimbo: the elbow out behind, the fist on the hip
      L('nearArm', 'armN', ['shoulderN', 'elbowN', 'wristN'], [2.4, 2.1, 1.9], ['o', 't']),
      F('nearFist', 'armN', 'wristN', 'elbowN', 2.5, 't', false, 0.8),
      // the sack sits on the far palm; the fist (the thumb) shows over its side
      R('sack', 'prop', 'wristF', [-3, -8], ['...ez...', '..UVVU..', '.wUUUUV.', 'wuUUUUUV', 'wuUUzUUU', 'wuUUUUUU', 'wuuUUUUu', '.wwuuuu.']),
      F('farFist', 'armF', 'wristF', 'elbowF', 2, 't', true, 0.6),
    ],
    eyes: [{ dx: 4, dy: 0, w: 2, h: 3 }, { dx: 9, dy: 0, w: 1, h: 3 }],
    // brisk: a double toe-tap of the near boot, then a short wait
    idle: [
      {},
      { swap: { nearBoot: ['jjBBBB', 'jBBBBb', 'bbbb..'] } },
      {},
      { swap: { nearBoot: ['jjBBBB', 'jBBBBb', 'bbbb..'] } },
      { pose: { chest: [0, -0.6, 0] } },
      {},
    ],
    idleMs: [1150, 110, 110, 110, 160, 471],
    // she flips the pepper sack off her palm, catches it, and grins at its weight
    tic: [
      { pose: { reachF: [-6.8, 12.6, 6.5] } },
      { nudge: { sack: [0, -1] }, swap: { sack: ['........', '..wUUV..', '.wUUUUVz', 'wuUUUUUe', 'wuUzUUUU', 'wuUUUUUU', '.wuuUUu.', '..wwuu..'] } },
      { nudge: { sack: [1, -2] }, swap: { sack: ['........', '........', '.wwuuu..', 'wuUUUUUV', 'wuUUzUUU', 'wuUUUUUU', 'zuUUUUUu', '.ewuuuu.'] } },
      { nudge: { sack: [0, -1] } },
      { pose: { reachF: [-6.8, 12.6, 6.5] } },
      { eyes: 'happy' },
      { eyes: 'happy' },
    ],
    ticMs: [120, 110, 130, 90, 140, 300, 320],
    // "Deal!": the near hand comes off her hip to point at you, and she winks
    react: [
      { pose: { reachN: [7, 18, 7] } },
      { pose: { reachN: [4, 19, 12.5] }, eyes: 'wink' },
      { pose: { reachN: [4, 19, 12.5] }, eyes: 'wink' },
      { eyes: 'happy' },
    ],
    reactMs: [80, 100, 460, 200],
  },
  // ── Odile, Rosethread's mercer. A tall slender elf, upright and still: a long neck, narrow shoulders, long shins. A raven
  //    topknot; the near ear long, out behind over the hair; a rose tunic to mid-thigh with a plum collar and sash, a plum
  //    cloak hanging behind; a cream bolt of silk with a rose ribbon cradled on the far forearm against her waist.
  odile: {
    inks: {
      ...BOOTS,
      s: ['skinRose', 1], S: ['skinRose', 2], l: ['skinRose', 0], t: ['skinRose', 'a'],
      h: ['hairBlack', 0], H: ['hairBlack', 1], G: ['hairBlack', 2],
      m: ['plum', 0], M: ['plum', 1], N: ['plum', 2], o: ['plum', 'a'],
      r: ['rose', 0], R: ['rose', 1], Q: ['rose', 2], e: ['rose', 'a'],
      g: ['gold', 2],
      n: ['navy', 'a'],
      p: ['linen', 0], P: ['linen', 1], W: ['linen', 2],
    },
    skin: 's',
    shadowRx: 9,
    mouth: [-2, 2, 11, 8],
    parts: [
      // the cloak, hanging behind from the shoulders to the calves
      R('cloak', 'back', 'chest', [-9, 0], [
        '...mMMMm..',
        '..mMMMMMm.',
        '.mMNMMMMm.',
        '.mMNMMMmm.',
        'mMNMMMMm..',
        'mMNMMMMm..',
        'mMNMMMmm..',
        'mMNMMMMm..',
        'mMNMMMMm..',
        'mMMMMMmm..',
        'mMNMMMMm..',
        'mMNMMMMm..',
        'mMNMMMmm..',
        'mMMMMMMm..',
        'mMNMMMMm..',
        'mMNMMMmm..',
        'mMMMMMMm..',
        'mmMMMMmm..',
        '.mmMmMm...',
        '..m.m.....',
      ]),
      L('farLeg', 'body', ['hipF', 'kneeF', 'ankleF'], [2.2, 2, 1.8], ['n', 'n'], true),
      R('farBoot', 'body', 'ankleF', [-2, -1], ['bBBB.', 'bBBBB', 'bbbbb']),
      L('farUpper', 'armF', ['shoulderF', 'elbowF'], [1.9, 1.8], ['e'], true),
      L('nearLeg', 'body', ['hipN', 'kneeN', 'ankleN'], [2.2, 2, 1.8], ['n', 'n']),
      R('nearBoot', 'body', 'ankleN', [-2, -1], ['jBBB.', 'BBBBB', 'bbbbb']),
      R('neck', 'body', 'neck', [-2, -3], ['.ls.', 'lss.', 'lss.', 'lss.']),
      R('torso', 'body', 'chest', [-6, -1], [
        '...mMMMMm...',
        '..mMNNMMmm..',
        '.RQQmMMmRRr.',
        '.RQQRRRRRRr.',
        'RQQRRRRRRRrr',
        'RQQRRRRRRRrr',
        'RQRRRRRRRRrr',
        'RQRRRRRRRRr.',
        '.RQRRRRRRRr.',
        '.mMMMMgMMMm.',
        '.RQRRRRRRRr.',
        '.RQRRRRRRRrr',
        'RQQRRRRRRRrr',
        'RQRRRRRRRRRr',
        'RQRRRRRRRRRrr',
        'RQRRRRRRRRRrr',
        'QRRRRRRRRRRrr',
        'RRrRRRrRRRrRr',
      ]),
      // the far forearm comes forward in front of the waist, under the bolt
      L('farFore', 'armF', ['elbowF', 'wristF'], [1.8, 1.6], ['t']),
      // a roll of silk lying across the forearm: its end toward us shows the wound cloth, a rose ribbon round its middle
      R('bolt', 'prop', 'wristF', [-11, -5], [
        '.PWWWWWQWWWPWW.',
        'PPPPPPPRPPPWpWW',
        'PPPPPPPRPPPWWpW',
        'pppppppRpppWpWW',
        '.ppppppppppPWW.',
      ]),
      F('farFist', 'armF', 'wristF', 'elbowF', 1.8, 't', false, 0.5),
      // the topknot, then the head: the hair swept back from the brow, the face long and narrowing to a pointed chin
      R('knot', 'head', 'head', [-4, -14], ['.hHh.', 'hHGHh', '.hHh.']),
      R('head', 'head', 'head', [-9, -11], [
        '......hHHHHh......',
        '....hHHGGHHHHh....',
        '...hHHGGHHHHHHh...',
        '..hHHGHHHHHHHHHh..',
        '.hHHHHHHHHHHHHHHh.',
        '.hHHHHHHHHHHHHHHhh',
        'hHHHHHHHHHHHHHHhhh',
        'hHHHHHHHHHHHHHhhSs',
        'hHHHHHHHHHHHhSSSSs',
        'hHHHHHHHHHhSSSSSSs',
        'hHHHHHHHHSSSSSSSSs',
        'hHHHHHHHSSSSSSSSSss',
        'hhHHHHHlSSSSSSSSSss',
        'hhHHHHHlSSSSSSSSSs',
        '.hhHHHHsSSSSSSSSss',
        '.hhhHHHssSSSSSSss',
        '..hhhHHhssSSSSss',
        '..hhhhhh.ssSSss',
        '...hhhhh..ssss',
        '....hhh....ss',
        '...........s',
      ]),
      // the near ear: long, out behind and up over the hair
      R('ear', 'head', 'head', [-15, -6], [
        'S............',
        '.SS..........',
        '..sSS........',
        '...sSSS......',
        '....sSSSS....',
        '.....ssSSSS..',
        '......sssSSSl',
        '........sssll',
      ]),
      L('nearArm', 'armN', ['shoulderN', 'elbowN', 'wristN'], [1.9, 1.7, 1.5], ['e', 't']),
      F('nearFist', 'armN', 'wristN', 'elbowN', 1.9, 't'),
    ],
    eyes: [{ dx: 3, dy: 0, w: 2, h: 2 }, { dx: 7, dy: 0, w: 1, h: 2 }],
    // a fluid lean forward and back, the cloak following a beat behind
    idle: [
      {},
      { pose: { chest: [0, 0, 0.6] } },
      { pose: { chest: [0, 0, 1.2] }, nudge: { cloak: [1, 0] } },
      { pose: { chest: [0, 0, 1.2] }, nudge: { cloak: [1, 0] } },
      { pose: { chest: [0, 0, 0.6] } },
      {},
      { nudge: { cloak: [-1, 0] } },
      { nudge: { cloak: [-1, 0] } },
    ],
    // she strokes the silk on her arm, eyes half shut
    tic: [
      { pose: { reachN: [3, 19, 5] } },
      { pose: { reachN: [1, 21, 7] } },
      { pose: { reachN: [-1, 21.5, 7.5] }, eyes: 'closed' },
      { pose: { reachN: [-2.5, 21.5, 7.8] }, eyes: 'closed' },
      { pose: { reachN: [-1, 21.5, 7.5] }, eyes: 'closed' },
      { pose: { reachN: [2, 19, 5] } },
    ],
    ticMs: [240, 260, 340, 280, 340, 260],
    // a low, sweeping half-bow
    react: [
      { pose: { chest: [0, -1, 1] } },
      { pose: { chest: [0, -2, 2.5], head: [0, -1, 1] }, eyes: 'closed' },
      { pose: { chest: [0, -2, 2.5], head: [0, -1, 1] }, eyes: 'closed' },
      { pose: { chest: [0, -1, 1] }, eyes: 'closed' },
      {},
    ],
    reactMs: [200, 240, 480, 260, 280],
  },
  // ── Brannoch, Ironvein's factor. A squat broad dwarf, planted: a bald dome, heavy ginger brows, a big nose, a forked
  //    ginger beard with gold beads down over a barrel chest in an iron-blue shirt under a leather apron; the slate up in
  //    the far hand, the chalk in the near.
  brannoch: {
    inks: {
      ...BOOTS,
      s: ['skinTan', 1], S: ['skinTan', 2], l: ['skinTan', 0], E: ['skinTan', 3], t: ['skinTan', 'a'],
      h: ['hairGinger', 0], H: ['hairGinger', 1], G: ['hairGinger', 2], y: ['gold', 2],
      n: ['navy', 0], N: ['navy', 1], M: ['navy', 2], v: ['navy', 'a'],
      a: ['leather', 0], A: ['leather', 1], d: ['leather', 2],
      k2: ['soot', 1], z: ['soot', 0], Z: ['soot', 1], X: ['white', 1], w: ['wood', 1], W: ['wood', 2],
      i: ['iron', 'a'],
    },
    skin: 's',
    shadowRx: 13,
    mouth: [-1, 2, 13, 8],
    parts: [
      L('farLeg', 'body', ['hipF', 'kneeF', 'ankleF'], [2.8, 2.6, 1.7], ['i', 'i'], true),
      R('farBoot', 'body', 'ankleF', [-3, -1], ['bBBBB.', 'bBBBBB', 'bbbbbb']),
      L('farArm', 'armF', ['shoulderF', 'elbowF', 'wristF'], [2.7, 2.5, 2.3], ['v', 't'], true),
      L('nearLeg', 'body', ['hipN', 'kneeN', 'ankleN'], [2.8, 2.6, 1.7], ['i', 'i']),
      R('nearBoot', 'body', 'ankleN', [-3, -1], ['jBBBB.', 'BBBBBB', 'bbbbbb']),
      R('torso', 'body', 'chest', [-10, -1], [
        '....MMNNNNNNNNN.....',
        '..MMMNNNNNNNNNNNn...',
        '.MMNNNNNNNNNNNNNNn..',
        'MMNNNNNNNNNNNNNNNnn.',
        'MMNNNNNdAAAAAANNNnn.',
        'MNNNNNNdAAAAAAANNnn.',
        'MNNNNNNdAAAAAAANNnn.',
        'MNNNNNNdAAAAAAANNnn.',
        'MNNNNNNdAAAAAAANNNn.',
        'aaaaaaaaaayyaaaaaaa.',
        '.NNNNNNdAAAAAAANNNn.',
        '.MNNNNNdAAAAAAAANnn.',
        '..NNNNdAAAAAAAANnn..',
      ]),
      // the bald head, 3/4: the dome back, the brow ridge, the big nose out front; no mouth (the beard covers it)
      R('head', 'head', 'head', [-11, -7], [
        '......sSSSSSSs........',
        '....sSSEESSSSSSs......',
        '..sSSSEESSSSSSSSss....',
        '.sSSSSSSSSSSSSSSSSss..',
        'sSSSSSSSSSSSSSSSSSSs..',
        'sSSSSSSSSSSSSSSSSSSss.',
        'sSSSSSSSSSSHHHHHHHHHs.',
        'sSSSSSlSSSSSSSSSSSSSss',
        'sSSSSllSSSSSSSSSSSSSss',
        'sSSSSllSSSSSSSSSSSSsss',
        'ssSSSSlSSSSSSSSSSSsss.',
        '.ssSSSSsSSSSSSSSSss...',
        '..sssSSssSSSSSSss.....',
        '....sssssssssss.......',
      ]),
      // the beard, from the cheeks down over the chest: a moustache under the nose, the beard forked, a gold bead at
      // each fork
      R('beard', 'head', 'head', [-2, 3], [
        '..GG.....GGGG.',
        '.GGGG..GGGGGGG',
        '.GGGGGGGGGGGGG',
        'GGGHGGGGHGGGGh',
        'GGGHGGGGHGGGHh',
        '.GGHGGGGHGGGHh',
        '.GGGHGGGGHGHh.',
        '..GGHGGGGHGHh.',
        '..GGGHh.GGHh..',
        '...GGh...GGh..',
        '...GHh...GHh..',
        '...yy.....yy..',
      ]),
      R('nose', 'head', 'head', [8, 0], ['.sS.', 'sSSS', 'sSSs', '.ss.']),
      L('nearArm', 'armN', ['shoulderN', 'elbowN', 'wristN'], [2.8, 2.6, 2.4], ['v', 't']),
      F('nearFist', 'armN', 'wristN', 'elbowN', 2.6, 't', false, 0.8),
      R('chalk', 'prop', 'wristN', [1, -3], ['X', 'X'], { ring: 1 }),
      // the slate up in the far hand: a wooden frame, the tally chalked on it
      R('slate', 'prop', 'wristF', [-6, -7], [
        'wWWWWWWWw',
        'WzZZZZZZw',
        'WzXzXzXzw',
        'WzXzXzXzw',
        'WzZZZZZZw',
        'wwwwwwwww',
      ]),
      F('farFist', 'armF', 'wristF', 'elbowF', 2.2, 't', true, 0.6),
    ],
    eyes: [{ dx: 2, dy: 0, w: 2, h: 2 }, { dx: 6, dy: 0, w: 1, h: 2 }],
    // one slow breath, then a long stillness
    idle: [{}, { pose: { chest: [0, 1, 0] } }, { pose: { chest: [0, 1, 0] } }, {}],
    idleMs: [2903, 700, 200, 900],
    // he lifts the slate and chalks a cart home
    tic: [
      { pose: { reachF: [-5.6, 13.9, 5.4] } },
      { pose: { reachF: [-5.6, 13.9, 5.4], reachN: [2, 14.4, 6.5] } },
      { pose: { reachF: [-5.6, 13.9, 5.4], reachN: [1, 13.6, 6.5] }, swap: { slate: ['wWWWWWWWw', 'WzZZZZZZw', 'WzXzXzXzw', 'WzXzXzXXw', 'WzZZZZZZw', 'wwwwwwwww'] } },
      { pose: { reachF: [-5.6, 13.9, 5.4], reachN: [2, 14.4, 6.5] }, swap: { slate: ['wWWWWWWWw', 'WzZZZZZZw', 'WzXzXzXXw', 'WzXzXzXXw', 'WzZZZZZZw', 'wwwwwwwww'] }, eyes: 'smug' },
      { pose: { reachF: [-5.6, 13.9, 5.4] }, swap: { slate: ['wWWWWWWWw', 'WzZZZZZZw', 'WzXzXzXXw', 'WzXzXzXXw', 'WzZZZZZZw', 'wwwwwwwww'] }, eyes: 'smug' },
      {},
    ],
    ticMs: [200, 220, 300, 320, 240, 200],
    // one curt nod
    react: [{ pose: { head: [0, -0.6, 0.5] }, eyes: 'closed' }, { pose: { head: [0, -1.2, 1] }, eyes: 'closed' }, { pose: { head: [0, -0.6, 0.5] } }, {}],
    reactMs: [90, 160, 120, 160],
  },
  // ── Hask, the Butcherblock salter (a proposal). An upright reptilian: the body leans forward over digitigrade legs, a
  //    heavy tail behind as a counterweight, its tip on the ground; a long flat snout with a nostril, a heavy brow over a
  //    gold slit eye, a low oxblood ridge down the back; teal scales; an oxblood apron; a butcher's J hook in the far hand.
  hask: {
    inks: {
      ...BOOTS,
      s: ['scaleTeal', 0], S: ['scaleTeal', 1], L: ['scaleTeal', 2], T: ['scaleTeal', 3], c: ['scaleTeal', 'a'],
      x: ['oxblood', 0], X: ['leather', 1], O: ['leather', 2], o: ['oxblood', 'a'],
      J: ['bone', 1], K: ['bone', 2], g: ['steel', 0], G: ['steel', 2], w: ['wood', 1], W: ['white', 2],
    },
    skin: 'S',
    slit: true,
    shadowRx: 14,
    mouth: [-2, -1, 12, 4],
    parts: [
      L('tail', 'body', ['tail1', 'tail2', 'tail3', 'tail4'], [3.8, 3, 2, 1], ['c', 'c', 'c']),
      // the low oxblood ridge along the top of the tail
      { ...L('ridge', 'back', ['tail1', 'tail2', 'tail3'], [1.1, 0.9, 0.5], ['x', 'x']), shift: [0.6, -2.6], ring: 0 },
      L('farLeg', 'body', ['hipF', 'kneeF', 'hockF', 'ankleF'], [3, 2.2, 1.6, 1.4], ['c', 'c', 'c'], true),
      R('farFoot', 'body', 'ankleF', [-2, -1], ['.SSS.', 'SSSSJ', 'sss.J']),
      L('farArm', 'armF', ['shoulderF', 'elbowF', 'wristF'], [2, 1.8, 1.6], ['c', 'c'], true),
      L('nearLeg', 'body', ['hipN', 'kneeN', 'hockN', 'ankleN'], [3, 2.2, 1.6, 1.4], ['c', 'c', 'c']),
      R('nearFoot', 'body', 'ankleN', [-2, -1], ['.LSS.', 'LSSSJ', 'sss.J']),
      L('neck', 'body', ['chest', 'neck', 'head'], [3.6, 3.2, 3], ['c', 'c']),
      R('torso', 'body', 'chest', [-6, -1], [
        '...LSSSS....',
        '..LSSSSSJJ..',
        '.LSSSSSJKKJ.',
        '.LSSSSJKKKJs',
        'LSSSSSJKKJSs',
        'LSSSSxXXXXxs',
        'LSSSSXOOOOXs',
        'LSSSXOOOOOXs',
        'LSSSXOOOOOx.',
        'LSSSXOOOOXx.',
        '.SSSXOOOOx..',
        '..ssxXXXx...',
      ]),
      // the head, 3/4 to the right: a small cranium behind a heavy brow, the snout long, flat and wide, a nostril on
      // its tip, the pale lower jaw; no ears (he is no wolf)
      R('head', 'head', 'head', [-8, -7], [
        '....................',
        '.sLLLLs.............',
        'sLLTLLLLs...........',
        'sLLLLLLLLLLLLs......',
        'sSLS...LLLLLLLLLs...',
        'sSSSSSSSSSSSSSSSSLs.',
        'sSSSSSSSSSSSSSSSSSSs',
        'sSSSSSSSssssssssssss',
        '.sSSSSJJJJJJJJJJJJJ.',
        '..ssSJJJJJJJJJJJJJ..',
        '...sssssKKKKKK......',
      ]),
      R('nostril', 'head', 'head', [9, -2], ['ss'], { ring: 0 }),
      L('nearArm', 'armN', ['shoulderN', 'elbowN', 'wristN'], [2.1, 1.8, 1.6], ['c', 'c']),
      F('nearFist', 'armN', 'wristN', 'elbowN', 1.9, 'c'),
      R('claws', 'armN', 'wristN', [1, 0], ['J.', '.J'], { ring: 0 }),
      // the J hook hangs from the far fist: the haft in the hand, the steel curve below
      R('hook', 'prop', 'wristF', [0, -3], [
        '.w..',
        '.w..',
        '.w..',
        '.w..',
        '.g..',
        '.G..',
        '.G..',
        '.G.G',
        '..G.',
      ]),
      F('farFist', 'armF', 'wristF', 'elbowF', 1.8, 'c', true, 0.4),
    ],
    eyes: [{ dx: -3, dy: -3, w: 3, h: 2 }],
    // stone still, then the tail lashes, and is still again
    idle: [{}, { pose: { tail: [5, 1, 0] } }, { pose: { tail: [-3, 0.5, 0] } }, {}, { pose: { tail: [2.5, 0.5, 0] } }, {}],
    idleMs: [1500, 110, 100, 1450, 90, 657],
    // a glint runs down the hook
    tic: [
      { extra: [[5, 21, 'W']] },
      { extra: [[5, 22, 'W']] },
      { extra: [[5, 23, 'W']] },
      { extra: [[5, 24, 'W']] },
      { extra: [[6, 25, 'W']] },
      { extra: [[7, 24, 'W']] },
    ],
    ticMs: [200, 120, 160, 440, 100, 130],
    // a sudden cock of the head
    react: [{ pose: { head: [0, -1, -1] } }, { pose: { head: [0, -1.5, -1.5] } }, { pose: { head: [0, -1.5, -1.5] }, eyes: 'smug' }, {}],
    reactMs: [70, 110, 560, 260],
  },
  // ── Wren, the Greenvial herbalist (a proposal). A tiny gnome: a big head under a huge pointed hat with a sprout at its
  //    tip, a big round nose, a rosy cheek, a white beard over a round little moss-green coat; a glowing vial hanging from
  //    the far hand at his side.
  wren: {
    inks: {
      ...BOOTS,
      s: ['skinRose', 1], S: ['skinRose', 2], l: ['skinRose', 0], t: ['skinRose', 'a'],
      T: ['aqua', 1], U: ['aqua', 2], V: ['aqua', 0], Y: ['aqua', 3],
      w: ['hairWhite', 1], W: ['hairWhite', 2], X: ['hairWhite', 3], q: ['hairWhite', 0],
      m: ['moss', 0], M: ['moss', 1], Q: ['moss', 2], c: ['moss', 'a'],
      f: ['leaf', 1], F: ['leaf', 2],
      a: ['glass', 1], A: ['glass', 2], e: ['venom', 1], E: ['venom', 2], n: ['navy', 'a'], r: ['rose', 2],
    },
    skin: 's',
    shadowRx: 9,
    mouth: [-3, 1, 9, 5],
    parts: [
      L('farLeg', 'body', ['hipF', 'kneeF', 'ankleF'], [2, 1.8, 1.7], ['n', 'n'], true),
      R('farBoot', 'body', 'ankleF', [-2, -1], ['bBBB.', 'bBBBB', 'bbbbb']),
      L('farArm', 'armF', ['shoulderF', 'elbowF', 'wristF'], [1.8, 1.6, 1.5], ['c', 't'], true),
      L('nearLeg', 'body', ['hipN', 'kneeN', 'ankleN'], [2, 1.8, 1.7], ['n', 'n']),
      R('nearBoot', 'body', 'ankleN', [-2, -1], ['jBBB.', 'BBBBB', 'bbbbb']),
      R('torso', 'body', 'chest', [-6, -1], [
        '...MMMMMMm...',
        '.QQMMMMMMMMm.',
        'QQMMMMMMMMMmm',
        'QQMMMMMMMMMmm',
        'QMMMMMMMMMMmm',
        'QMMMMMMMMMMmm',
        'QMMMMMMMMMMmm',
        '.MMMMMMMMMMm.',
        '..mmmmmmmmm..',
      ]),
      // the face under the brim: the big round nose out front, a rosy cheek; no mouth (the beard covers it)
      R('head', 'head', 'head', [-8, -6], [
        '..sSSSSSSSSSSs...',
        '.sSSSSSSSSSSSSs..',
        'sSSSSSSSSSSSSSSs.',
        'sSSSllSSSSSSSSSs.',
        'sSSSllSSSSSSSSSs.',
        'sSSSSlSSSSSSSSSss',
        'sSSSSSSSSSSSSSSss',
        '.sSSSSSSSSSSSSss.',
        '..sssSSSSSSSsss..',
        '....sssssssss....',
      ]),
      // the beard hangs from under the nose down over his chest, a moustache either side of the nose
      R('beard', 'head', 'head', [-2, 2], [
        '...WWW...WWW..',
        '.WXXXXW.WXXXW.',
        'WXXXXXXWXXXXXw',
        'WXXXXXXXXXXXWw',
        '.WXXXXXXXXXXWw',
        '.WWXXXXXXXXWw.',
        '..WWXXXXXXWww.',
        '...wWXXXXWww..',
        '....wWWWWww...',
        '.....wWWw.....',
        '......ww......',
      ]),
      R('nose', 'head', 'head', [4, -1], ['.sSS.', 'sSSSS', 'sSSSs', 'ssSss', '.sss.']),
      R('cheek', 'head', 'head', [0, 2], ['rr'], { ring: 0 }),
      // the huge hat: a wide brim, the cone leaning back, a sprout at the tip
      R('hat', 'head', 'head', [-13, -23], [
        '.....f.F.................',
        '......fF.................',
        '......VV.................',
        '.....VTTV................',
        '.....VTTTV...............',
        '......VTTTV..............',
        '......VTTUTV.............',
        '.......VTUUTV............',
        '.......VTTUUTV...........',
        '.......VTTTUUTV..........',
        '......VTTTTUUTTV.........',
        '......VTTTTTUUTTV........',
        '.....VTTTTTTTUUTTV.......',
        '.....VTTTTTTTTUUTTV......',
        '....VTTTTTTTTTTTTTTV.....',
        '....VTTTTTTTTTTTTTTTV....',
        '...VVTTTTTTTTTTTTTTTTV...',
        'VVVTTTTTTTTTTTTTTTTTTTVV.',
        'VTTUUUUUUUUUUUUUUUUUTTTVV',
        '.VVVVVVVVVVVVVVVVVVVVVVV.',
      ]),
      L('nearArm', 'armN', ['shoulderN', 'elbowN', 'wristN'], [1.9, 1.7, 1.6], ['c', 't']),
      F('nearFist', 'armN', 'wristN', 'elbowN', 1.8, 't'),
      // the vial hangs by its neck from the far fist, glowing
      R('vial', 'prop', 'wristF', [-2, 0], ['.aa.', '.aa.', 'aEEa', 'aEeA', 'aeea', '.aa.']),
      F('farFist', 'armF', 'wristF', 'elbowF', 1.7, 't', true, 0.4),
    ],
    eyes: [{ dx: 0, dy: 0, w: 2, h: 2 }, { dx: 3, dy: 0, w: 1, h: 2 }],
    // the body never moves: only the vial's light swells and ebbs
    idle: [
      {},
      { swap: { vial: ['.aa.', '.aa.', 'aEEa', 'aEEA', 'aEea', '.aa.'] } },
      { swap: { vial: ['.aA.', '.aa.', 'AEEa', 'aEEA', 'aEEa', '.aa.'] }, extra: [[5, 16, 'E'], [10, 18, 'E']] },
      { swap: { vial: ['.aa.', '.aa.', 'aEEa', 'aEEA', 'aEea', '.aa.'] } },
      {},
    ],
    idleMs: [2700, 300, 900, 300, 1103],
    // a spore drifts up off the vial and his eyes follow it
    tic: [
      { extra: [[9, 10, 'E']] },
      { extra: [[10, 7, 'E']], look: [1, 0] },
      { extra: [[11, 4, 'E']], look: [1, 0] },
      { extra: [[11, 1, 'E']], look: [1, -1] },
      { extra: [[12, -2, 'E']], look: [1, -1] },
      { extra: [[13, -5, 'e']], look: [1, -1] },
      {},
    ],
    ticMs: [260, 300, 340, 340, 360, 340, 240],
    // the hat's brim sinks over his eyes, then tips back
    react: [
      { nudge: { hat: [0, 1] }, eyes: 'closed' },
      { nudge: { hat: [0, 2] }, eyes: 'closed' },
      { nudge: { hat: [0, -1] }, eyes: 'happy' },
      { nudge: { hat: [0, -1] }, eyes: 'happy' },
      {},
    ],
    reactMs: [420, 300, 640, 420, 300],
  },
}
