/**
 * Odile design 04, the Ford Toll-Keeper, with a body of her own (the shared
 * gown is out: "Body doesn't need to be shared, it should be unique").
 *
 * She stands on the ford stones in all weathers: a waxed river-blue cloak
 * from the shoulders to the ankles, stiff enough to stand out in an A at the
 * hem, hanging open a hand's width at the front over a rose gown; the wax
 * catches the light in short streaks and holds beads of river water. The toll
 * satchel rides her hip on a strap over the shoulder, a brass buckle and a
 * tally tag. Silhouette: the lily pad over a planted, wide-hemmed A.
 * The head, hands and lantern are design 04's.
 */
import type { Design, Part } from './odile-lib'
import { D04 } from './odile-d04'
import { over } from './odile-common'

const CLOAK = [
  '...............ttttttttttttNNNn',
  '..............tttttttttttttNNNNn',
  '..............ttttttttttttttNNNn',
  '.............ttNttttNttttNttNNNnn',
  '.............ttNttttNttttNttNNNNn',
  '.............tNtttttNttttNttNNNNn',
  '............ttNttttNtttttNttNNNNNn',
  '............ttNttttNtttttNttNNNNNn',
  '...........ttNtttttNtttttNttNNNNNNn',
  '...........ttNtttttNtttttNttNNNNNNn',
  '..........ttNttttttNtttttNttNNnRRNNn',
  '..........ttNtttttNttttttNttNNnRQNNn',
  '.........tttwtttttNttttttNttNNnRQRNNn',
  '.........ttNttttttNtttwttNttNNnRQRNNn',
  '........tttNttttttNttttttNttNNnRQRNNNn',
  '........tttNtttttwNttttttNttNNnRQRNNNn',
  '.......tttNttttttNttttttNttNNNnRRQRNNnn',
  '.......ttwNttttttNttttttNttNNNnRRQRNNNn',
  '......ttwtNttttttNttttttNttNNNnRRQRNNNnn',
  '......tttNtttttttNttttttNttNNNnRRQRNNNnN',
  '.....ttttNtttttttNttttttNttNNnRRRQRRNNNnN',
  '....tttttNttttttNtttttttNtNNNnRRRQRRNNNnNn',
  '...ttnttNtwnttttNtntttttNtNNNnRRRQRRtnNnNNn',
  '...twnttNttnttttNtnwttttNtNNNnRRRQRRRnNNnNN',
  '..NttntNtttnttttNtntttttNnNNNnRRRRQRRnNNnNNN',
  '.NNtnttNttnttttttnttttttNnNNNnRRRRQRRNNNnNnnn',
  'nnnnnnnnnnnnnnnnnnnnnnnnnnnnnnRRRRQRRnnnnnnnnn',
  '..nnnnnnnnnnnnnnnnnnnnnnnnnnnnRRRRQRRRnnnnnn',
  '..............................RRRRQRRR',
]

const STRAP = [
  '.........uU',
  '........uU',
  '.......uU',
  '......uU',
  '.....uU',
  '....uU',
  '...uU',
  '..uU',
]

const SATCHEL = [
  '.uUUUUUUu',
  'uUooooooUu',
  'uUoowyooUu',
  'uuuuyyuuuu',
  'uUoUuuUUUu',
  'uUoUUUUUuu',
  'uUUUUUUuuu',
  '.uuuuuuuu',
]

const TAG = [
  '.u',
  'oo',
  'oy',
  'oo',
]

/** The cloak with the satchel's strap laid over it. */
const CLOAK_STRAPPED = over(CLOAK, [[17, 3, STRAP]])

/** Stub feet: only the toes show under a hem this long. */
const FEET_HEM = ['kkkkk..kkkkk', '.kkkk..kkkk', '..kkk..kkk']

const SHADOW_M = D04.parts.find((p) => p.id === 'shadow')!.rows

/** Where design 04's own parts sit on this taller body. */
const MOVED: Readonly<Record<string, readonly [number, number]>> = {
  handB: [27, 58],
  handF: [67, 57],
  lantern: [67, 59],
}

const KEEP = D04.parts.filter((p) => !['shadow', 'feet', 'body'].includes(p.id))

export const D04_BODY: Design = {
  ...D04,
  id: 'd04-body',
  title: 'Ford Toll-Keeper',
  concept: 'A waxed river-blue cloak to the ankles, standing out in an A at the hem, beaded with river water; the toll satchel on her hip.',
  headBottom: 53,
  parts: [
    { id: 'shadow', group: 'feet', x: 32, y: 71, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 44, y: 73, rows: FEET_HEM, ring: 0 },
    { id: 'cloak', group: 'body', x: 27, y: 46, rows: CLOAK_STRAPPED, squash: [12] },
    { id: 'satchel', group: 'body', x: 34, y: 61, rows: SATCHEL },
    { id: 'tag', group: 'body', x: 36, y: 69, rows: TAG, ring: 1 },
    ...KEEP.map((p): Part => (MOVED[p.id] ? { ...p, x: MOVED[p.id][0], y: MOVED[p.id][1] } : p)),
  ],
}
