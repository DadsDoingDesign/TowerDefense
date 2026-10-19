/**
 * Odile design 01, the Loom Mistress, with a body of her own (the shared gown
 * is out: "Body doesn't need to be shared, it should be unique").
 *
 * A weaver's working dress cut close: a fitted spring-green bodice laced up
 * the front, drawn in to a narrow belted waist, then a rose skirt falling in a bell,
 * its hem sweeping longer at the back; a linen apron tied at the belt with a pocket, its hem hung with
 * the cut ends of every thread she has used (green and plum); the shuttle
 * rides tucked in her belt. Her hands rest on the skirt; her hair
 * falls behind her shoulders, so the bodice stands in front of it. Silhouette: the spool over an
 * hourglass whose hem trails back. The spool hat, ears and cheek are design 01's.
 * Tic: she draws the shuttle from her belt, spins it in her fingers and tucks it back.
 */
import type { Design, Part } from './odile-lib'
import { D01 } from './odile-d01'

const BODY = [
  '.............GvvvvvvvvvvvvGGggg',
  '..............vvvvvvvvvvvvvGggg',
  '..............vvvvvvvvvvvvvGgg',
  '..............vvvvvvvvvvvvvvgg',
  '...............vvvvgvvvvEFvggg',
  '...............vvwvgvvvgFEgggg',
  '................vvwgvvvvEFvgg',
  '................vvvgvvvvFEggg',
  '................vvvgvvvgEFggg',
  '.................vvgvvvvFEgg',
  '.................gggggggEFgg',
  '.................gggggggFEgg',
  '.................UUUUUUUUUUUU',
  '...............QQuuuuuuuuuuuu',
  '...........QQQQQQQQQFFFFFFFFFRr',
  '..........QQQrjQQQrjFwwFFFFFFRRr',
  '.........QQQQrjQQQrjFFFFEEEFFFRr',
  '.........QQQQrjQQQrFFFFFEFEFFFRrr',
  '........QQQQrQjQQQrFFFFFEEEFFFrRr',
  '........QQQQrjQQQrjFFFFFFFFFFFFRr',
  '........QQQQrjQQQrjFFFFFFFFFFFFRRr',
  '.......QQQQQrjQQQrjQQQQQQRRRRRrRRR',
  '......QQQQrrjQQQrjQQGQPQvRpRGRPrRRR',
  '.....RQQQrjQQQQrjQQQGQPQvRpRGRPRrRRR',
  '...RRRRQrjQQQQrrrrrrrrPrvrrrGrPrrrrrrr',
  '..rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
  '..rrrrrrrrrrrrrrr',
]

/** The shuttle tucked in her belt (the one she draws in the tic). */
const BELT_SHUTTLE = [
  '..oOOOOOOw',
  'ooOrRQQOOOO',
  'UUorRRQoooo',
  '..UUUUUUu',
]

/** The shuttle in her fist, upright, mid-spin. */
const SHUTTLE_UP = ['.Oo', 'OOw', 'oRo', 'oQo', 'oRo', 'oOo', '.u']

/** Stub feet: only the toes show under the skirt. */
const FEET_HEM = ['kkkkk..kkkkk', '.kkkk..kkkk', '..kkk..kkk']

const SHADOW_M = D01.parts.find((p) => p.id === 'shadow')!.rows

/** Her hands rest on the skirt's swell, clear of the waist so it reads. */
const MOVED: Readonly<Record<string, readonly [number, number]>> = {
  handB: [34, 59],
  handF: [61, 58],
}

/** Her hair falls behind her shoulders, so the bodice stands in front of it. */
const HAIR_BEHIND = D01.parts.find((p) => p.id === 'hair')!

const KEEP = D01.parts.filter((p) => !['shadow', 'feet', 'body', 'shuttle', 'shuttleL'].includes(p.id))

export const D01_BODY: Design = {
  ...D01,
  id: 'd01-body',
  title: 'Loom Mistress',
  concept: 'A fitted green bodice laced to a narrow belted waist, a rose bell skirt, a linen apron hung with cut threads, the shuttle in her belt.',
  headBottom: 53,
  parts: [
    { id: 'shadow', group: 'feet', x: 32, y: 66, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 46, y: 69, rows: FEET_HEM, ring: 0 },
    HAIR_BEHIND,
    { id: 'body', group: 'body', x: 27, y: 44, rows: BODY, squash: [8] },
    { id: 'beltShuttle', group: 'body', x: 44, y: 55, rows: BELT_SHUTTLE },
    ...KEEP.filter((p) => p.id !== 'hair').map((p): Part => (MOVED[p.id] ? { ...p, x: MOVED[p.id][0], y: MOVED[p.id][1] } : p)),
    { id: 'shuttleUp', group: 'prop', x: 63, y: 61, rows: SHUTTLE_UP, hidden: true },
  ],
  // she draws the shuttle from her belt, spins it in her fingers, and tucks it back
  tic: [
    { nudge: { handF: [-2, 1] } },
    { hide: ['beltShuttle'], show: ['shuttleUp'] },
    { hide: ['beltShuttle'], show: ['shuttleUp'], swap: { shuttleUp: [...SHUTTLE_UP].reverse() }, squash: 1 },
    { hide: ['beltShuttle'], show: ['shuttleUp'] },
    { nudge: { handF: [-2, 1] } },
    {},
  ],
  ticMs: [120, 160, 160, 160, 120, 200],
}
