/**
 * Odile design 08, the Bolt Weaver, with a body of her own (the shared gown is
 * out: "Body doesn't need to be shared, it should be unique").
 *
 * She wears the cloth she weaves: a flowing robe of plum silk in three tiers,
 * each a little wider and longer than the one above, every tier's hem a lit
 * scalloped edge; below her knees it gathers in on a cord to a bunched ruffle
 * at the ankles, so the robe swells and closes like a silk-moth's cocoon. Her hair falls
 * down her back behind it. A wide hanging sleeve at her back arm. The bolt rides lower, at her hip, well
 * clear of her hair. Silhouette: the curtain of hair over a swelling,
 * gathered teardrop. The head is design 08's.
 */
import type { Design, Part } from './odile-lib'
import { D08 } from './odile-d08'

const ROBE = [
  '...........QRiiiiiPPPPQ',
  '..........iiQRiiiiPPPQRp',
  '..........iiiQRiiiiPQRPp',
  '.........iiiiiQRRiiPQRPpp',
  '.........wiiiiiPQRiQRPpPp',
  '........wiiiiiPiiQQRPPpPp',
  '........jiiiiiPiiiQRPPpPpp',
  '........wiiiiiPiiiiiiPpPPp',
  '.......wiiiiiiPiiiiiiPPpPp',
  '.......iiiiiiPiiiiiiiPPpPPp',
  '.......iiiiiiPiiiiiiiPPpPPP',
  '......pppiiiiiiiiiiPPPPPPppp',
  '......iiippppppiiiPppppppPPp',
  '.....iiiiiPiiiippppiiPPPPPpp',
  '.....wiiiiPiiiiiiiiPiPPPPPpPp',
  '.....wiiiPiiiiiiiiiPiPPPPPPpp',
  '....wjiiiPiiiiiiiiiPiPPPPPPpPp',
  '....wiiiiPiiiiiiiiiPpPPPPPPpPp',
  '...PwiiiPiiiiiiiiiiPpPPPPPPPppp',
  '...iiiiiPiiiiiiiiiiPpPPPPPPPpPP',
  '...pppiiiiiiiiiiiiiPPPPPPPPPppp',
  '..PPPippppppppiiiiPPppppppppPPpp',
  '..PPPPiiiiiiiPppppppPPPpPPPPPPpp',
  '..PPPPiiiiiiiPiiiiPPPPPpPPPPPppp',
  '..PPPPPiiiiiiPiiiPPPPPPPpPPPpppp',
  '..PPPPPPiiiiPiiiPPPPPPPPpPPpppp',
  '...ppPPPPPiiPiPPPPPPPPPPPppppp',
  '....ppppppppppppppppppppppppp',
  '.......pppppppppppppppppppp',
  '',
  '.......iwiPP.iiiPP.iiiPPiiiPPP',
  '......PiiiPpPiiiPpPiiiPpiiiPPp',
  '......PPPPPpPPPPPpPPPPPpPPPPPp',
  '.......PPPPp.PPPPp.PPPPpPPPPpp',
  '.......Ppppp.Ppppp.Ppppp.Pppp',
]

const SLEEVE = [
  '..iiPP',
  '.iiPPPp',
  'iiPPPpp',
  'iPPPPpp',
  'QQRRRrr',
]

/** Stub feet: only the toes show under the gathered hem. */
const FEET_HEM = ['.kkkk..kkkk', '..kkk..kkk', '..kk....kk']

const SHADOW_M = D08.parts.find((p) => p.id === 'shadow')!.rows

/** The bolt rides at her hip, under her arm, clear of the hair. */
const MOVED: Readonly<Record<string, readonly [number, number]>> = {
  handB: [29, 60],
  handF: [62, 62],
  bolt: [58, 62],
  boltEnd: [72, 62],
  silkEnd: [76, 65],
}

/** The robe, in front of her hair. */
const ROBE_PART: Part = { id: 'robe', group: 'body', x: 33, y: 39, rows: ROBE, squash: [12] }

const KEEP = D08.parts.filter((p) => !['shadow', 'feet', 'body'].includes(p.id))

export const D08_BODY: Design = {
  ...D08,
  id: 'd08-body',
  title: 'Bolt Weaver',
  concept: 'A flowing robe of plum silk in three scalloped tiers, swelling then gathered at the ankles like a cocoon; the bolt carried low at her hip.',
  headBottom: 54,
  parts: [
    { id: 'shadow', group: 'feet', x: 32, y: 71, rows: SHADOW_M, ring: 0 },
    { id: 'feet', group: 'feet', x: 46, y: 73, rows: FEET_HEM, ring: 0 },
    ...KEEP.map((p): Part => (MOVED[p.id] ? { ...p, x: MOVED[p.id][0], y: MOVED[p.id][1] } : p)).flatMap((p): Part[] =>
      // the robe is worn in front of her hair (it falls down her back), behind the circlet, ears and arms
      p.id === 'hair' ? [p, ROBE_PART] : p.id === 'handB' ? [{ id: 'sleeve', group: 'hands', x: 27, y: 56, rows: SLEEVE }, p] : [p],
    ),
  ],
}
