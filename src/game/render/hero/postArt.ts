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

export type EyeMode = 'open' | 'closed' | 'happy' | 'smug'
/** An eye, its top-left from the head joint (rounded): `w` × `h` of ink. */
export interface Eye { dx: number; dy: number; w: number; h: number }

export interface Key {
  pose?: Pose
  eyes?: EyeMode
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
      L('farLeg', 'body', ['hipF', 'kneeF', 'ankleF'], [2.6, 2.4, 2.2], ['n', 'n'], true),
      R('farBoot', 'body', 'ankleF', [-3, -1], ['bBBBB.', 'bBBBBB', 'bbbbbb']),
      // the far arm: the upper arm hangs, the forearm comes forward, palm up
      L('farArm', 'armF', ['shoulderF', 'elbowF', 'wristF'], [2.3, 2, 1.8], ['o', 't'], true),
      L('nearLeg', 'body', ['hipN', 'kneeN', 'ankleN'], [2.6, 2.4, 2.2], ['n', 'n']),
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
        '....DDDEEDDDDCCCCCc.....',
        '...DDDDDDDDDCCCCCCCc....',
        '..DDDDDDDDDCCCCCCCCcc...',
        '.DDDDDDDDDCCCCCCCCCCcc..',
        '.DDDDDDDDCCCCCCCCCCCCcc.',
        'DDDDDDDDCCCCCCCCCCCCCccc',
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
    idle: [{}, { pose: { chest: [0, -1, 0] } }, { pose: { chest: [0, -1, 0] } }, {}],
    tic: [
      { pose: { reachF: [-6.4, 16.4, 7.5] } },
      { pose: { reachF: [-6.4, 15.6, 7.5] } },
      { pose: { reachF: [-6.4, 16.4, 7.5] }, eyes: 'happy' },
      { eyes: 'happy' },
      { pose: { reachF: [-6.4, 16.4, 7.5] }, eyes: 'happy' },
      {},
    ],
    ticMs: [160, 200, 220, 320, 300, 200],
    react: [{ pose: { all: [0, 1, 0] }, eyes: 'smug' }, { pose: { all: [0, 3, 0] }, eyes: 'happy' }, { pose: { all: [0, 1, 0] }, eyes: 'happy' }, { eyes: 'smug' }],
    reactMs: [80, 120, 100, 160],
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
    mouth: [-2, 2, 11, 10],
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
    idle: [{}, {}, { pose: { chest: [0, 1, 0] } }, { pose: { chest: [0, 1, 0] } }, { pose: { chest: [0, 1, 0] } }, {}, {}],
    // she smooths the silk at her waist, eyes half shut
    tic: [
      { pose: { reachN: [4.5, 17, 4] } },
      { pose: { reachN: [3.5, 17.5, 6] }, eyes: 'closed' },
      { pose: { reachN: [2.5, 17.5, 7.5] }, eyes: 'closed' },
      { pose: { reachN: [3.5, 17.5, 6] }, eyes: 'closed' },
      { pose: { reachN: [4.5, 17, 4] } },
      {},
    ],
    ticMs: [200, 260, 300, 260, 220, 200],
    // a half-bow, eyes shut
    react: [{ pose: { chest: [0, -1, 1] }, eyes: 'closed' }, { pose: { chest: [0, -2, 2], head: [0, -1, 1] }, eyes: 'closed' }, { pose: { chest: [0, -1, 1] }, eyes: 'closed' }, {}],
    reactMs: [140, 260, 160, 160],
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
      L('farLeg', 'body', ['hipF', 'kneeF', 'ankleF'], [2.8, 2.6, 2.4], ['i', 'i'], true),
      R('farBoot', 'body', 'ankleF', [-3, -1], ['bBBBB.', 'bBBBBB', 'bbbbbb']),
      L('farArm', 'armF', ['shoulderF', 'elbowF', 'wristF'], [2.7, 2.5, 2.3], ['v', 't'], true),
      L('nearLeg', 'body', ['hipN', 'kneeN', 'ankleN'], [2.8, 2.6, 2.4], ['i', 'i']),
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
    // a slow weight shift from foot to foot
    idle: [{}, {}, { pose: { lift: [1.74, 0, 0] } }, { pose: { lift: [1.74, 0, 0] } }, { pose: { lift: [1.74, 0, 0] } }, {}, {}, { pose: { lift: [-1.74, 0, 0] } }, { pose: { lift: [-1.74, 0, 0] } }, { pose: { lift: [-1.74, 0, 0] } }, {}],
    // he lifts the slate and chalks a cart home
    tic: [
      { pose: { reachF: [-5.6, 14.6, 5.4] } },
      { pose: { reachF: [-5.6, 14.6, 5.4], reachN: [2, 14.4, 6.5] } },
      { pose: { reachF: [-5.6, 14.6, 5.4], reachN: [1, 13.6, 6.5] }, swap: { slate: ['wWWWWWWWw', 'WzZZZZZZw', 'WzXzXzXzw', 'WzXzXzXXw', 'WzZZZZZZw', 'wwwwwwwww'] } },
      { pose: { reachF: [-5.6, 14.6, 5.4], reachN: [2, 14.4, 6.5] }, swap: { slate: ['wWWWWWWWw', 'WzZZZZZZw', 'WzXzXzXXw', 'WzXzXzXXw', 'WzZZZZZZw', 'wwwwwwwww'] }, eyes: 'smug' },
      { pose: { reachF: [-5.6, 14.6, 5.4] }, swap: { slate: ['wWWWWWWWw', 'WzZZZZZZw', 'WzXzXzXXw', 'WzXzXzXXw', 'WzZZZZZZw', 'wwwwwwwww'] }, eyes: 'smug' },
      {},
    ],
    ticMs: [200, 220, 300, 320, 240, 200],
    // one curt nod
    react: [{ pose: { head: [0, -1, 0.5] }, eyes: 'closed' }, { pose: { head: [0, -2, 1] }, eyes: 'closed' }, { pose: { head: [0, -1, 0.5] } }, {}],
    reactMs: [90, 160, 120, 160],
  },
  // ── Hask, the Butcherblock salter (a proposal). An upright reptilian: the body leans forward over digitigrade legs, a
  //    heavy tail behind as a counterweight, its tip on the ground; a long flat snout with a nostril, a heavy brow over a
  //    gold slit eye, a low oxblood ridge down the back; teal scales; an oxblood apron; a butcher's J hook in the far hand.
  hask: {
    inks: {
      ...BOOTS,
      s: ['scaleTeal', 0], S: ['scaleTeal', 1], L: ['scaleTeal', 2], T: ['scaleTeal', 3], c: ['scaleTeal', 'a'],
      x: ['oxblood', 0], X: ['oxblood', 1], O: ['oxblood', 2], o: ['oxblood', 'a'],
      J: ['bone', 1], K: ['bone', 2], g: ['steel', 0], G: ['steel', 2], w: ['wood', 1],
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
    idle: [{}, { pose: { tail: [0, 0, -1] } }, { pose: { chest: [0, -0.4, 0], tail: [0, 1, -1.5] } }, { pose: { chest: [0, -0.4, 0], tail: [0, 1, -1] } }, { pose: { tail: [0, 0.5, 0] } }, {}, { pose: { tail: [0, 0, 1] } }, {}],
    // a slow blink of the slit eye, the tail swishing
    tic: [{ pose: { tail: [0, 1, -2] } }, { pose: { tail: [0, 2, -3] }, eyes: 'closed' }, { pose: { tail: [0, 2, -3] }, eyes: 'closed' }, { pose: { tail: [0, 1, -2] } }, { pose: { tail: [0, 0, 1] } }, {}],
    ticMs: [200, 300, 300, 200, 240, 200],
    // he twirls the hook
    react: [
      { swap: { hook: ['.w..', '.w..', '.w..', '.w..', '.g..', '.GGG', '...G', '..G.', '....'] } },
      { swap: { hook: ['.w..', '.w..', '.w..', '.w..', '.g..', 'GGG.', 'G...', '.G..', '....'] } },
      { swap: { hook: ['.w..', '.w..', '.w..', '.w..', '.g..', '.GGG', '...G', '..G.', '....'] }, eyes: 'smug' },
      { eyes: 'smug' },
    ],
    reactMs: [120, 120, 120, 200],
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
    mouth: [-3, 1, 9, 6],
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
    idle: [{}, { pose: { chest: [0, -1, 0] } }, { pose: { chest: [0, -1, 0] } }, {}, {}, {}],
    // he holds the vial out to the side, in the light, and smiles at it
    tic: [
      { pose: { reachF: [-7.2, 10, 6] } },
      { pose: { reachF: [-7.5, 11.5, 6.5] } },
      { pose: { reachF: [-7.5, 11.5, 6.5] }, eyes: 'happy' },
      { pose: { reachF: [-7.5, 11.5, 6.5] }, eyes: 'happy' },
      { pose: { reachF: [-7.2, 10, 6] }, eyes: 'happy' },
      {},
    ],
    ticMs: [200, 220, 300, 320, 240, 200],
    // a dip, then the vial lifted
    react: [{ pose: { lift: [0, -1, 0] }, eyes: 'happy' }, { pose: { reachF: [-7.5, 11.5, 6.5] }, eyes: 'happy' }, { pose: { lift: [0, -1, 0] }, eyes: 'happy' }, {}],
    reactMs: [120, 200, 120, 160],
  },
}
