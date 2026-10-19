/**
 * Brannoch designs — the inks and the few small parts the pack repeats on
 * every person (nub fists, ink stub legs, the ground shadow), sized for a
 * dwarf: squat, broad, square. Every ink is a colour of the old-CC0 Tiny
 * Swords build already in this repo (`brannoch-pal.ts` audits it); nothing
 * from the current download.
 */

/** letter → colour. Each material is three tones (shade · mid · light), some with a dash. */
export const PAL: Readonly<Record<string, string>> = {
  // skin: the pack's own (the pawn's and knight's hands)
  e: '#977b6b', E: '#d5b583', F: '#efe1ab',
  // a dwarf's ruddy nose and cheek (the pack's warm pinks)
  c: '#a06961', C: '#c88176', D: '#f69e7d',
  // copper-ginger hair (the pack's)
  q: '#87465a', h: '#b16c4d', H: '#d9945f', j: '#ffcfb4',
  // grey-white hair
  m: '#a29395', M: '#c3c1a6', L: '#e1d4bd', l: '#fffce7',
  // soot-black hair, slate, coal
  z: '#394243', Z: '#565361', d: '#796a86',
  // chestnut-brown hair, hide, fur
  b: '#6f5a48', B: '#9e7466', G: '#c9aa8e',
  // riveted iron (cool steel)
  f: '#425062', i: '#4f5e65', I: '#737f8e', J: '#bac1c8', K: '#c8d0d8',
  // overcast blue cloth (Ironvein's road)
  v: '#2a485e', n: '#4a6982', N: '#83a2ac',
  // forge orange, embers
  o: '#a55a50', O: '#cc804b', g: '#f69e7d',
  // flame / lamp glow
  y: '#ffe325', Y: '#faee6d',
  // brass
  a: '#a38250', A: '#d08c41', t: '#dab570',
  // leather, wood
  u: '#5a4646', U: '#866353', V: '#b48355',
  // forge red cloth (the goblins' red)
  r: '#693d5b', R: '#b65555', Q: '#f76666',
  // quarry stone
  p: '#796865', P: '#a39681', T: '#bcaba8',
  // white dash
  w: '#ffffff',
}

/** The letters a light dash may use alone (exempt from the stray-pixel audit). */
export const DASH = ['#ffffff', '#ffcfb4', '#fffce7', '#faee6d', '#ffe325', '#c8d0d8', '#f69e7d']

/** Ink stub legs, set wide (a dwarf stands planted). */
export const FEET = [
  'kkkkkkk....kkkkkkk',
  'kkkkkkk....kkkkkkk',
  'kkkkkkk....kkkkkkk',
  '.kkkkkk....kkkkkk',
  '.kkkkk......kkkkk',
  '..kkk........kkk',
]

/** The pack's ground shadow, wide (a dwarf's footprint). */
export const SHADOW = [
  '...........ssssssssssssssssss',
  '......sssssssssssssssssssssssssssss',
  '...sssssssssssssssssssssssssssssssssss',
  '..sssssssssssssssssssssssssssssssssssss',
  '.sssssssssssssssssssssssssssssssssssssss',
  '.sssssssssssssssssssssssssssssssssssssss',
  '..sssssssssssssssssssssssssssssssssssss',
  '...sssssssssssssssssssssssssssssssssss',
  '......sssssssssssssssssssssssssssss',
  '...........ssssssssssssssssss',
]

/** A big round fist, the back hand (in the body's shade). */
export const FIST_B = ['.eeEE', 'eeEEEE', 'eeEEEE', 'eeEEEE', 'eeeEEe', '.eeee']
/** A big round fist, the front hand (lit on its top). */
export const FIST_F = ['.EEFF', 'eEEFFF', 'eEEEFF', 'eEEEEE', 'eeEEEe', '.eeee']

/**
 * The tunic every Brannoch wears under his head mass: a short, broad bell,
 * square in the shoulder and flared at the hem (the pack's bodies are small
 * rounded masses, narrower than the head mass that overhangs them). Hand-drawn once in placeholder inks (1 light, 2 mid,
 * 3 shade, 4 hem trim, 5 stitch) and re-inked per design with {@link bell},
 * the way the pack reuses one body under its heads. Light from the upper
 * left: a lit rim on the left, a two-step shade down the right, two folds.
 */
const BELL = [
  '......11222222222222222333',
  '.....1122222222222222223333',
  '....112222222222222222223333',
  '....112222222322222222223333',
  '...1122222222322222232223333',
  '...1122222222322222232223333',
  '..11222222223322222322233333',
  '.1122222222223222223322233333',
  '11222222222223222222322233333',
  '444444444444444444444444444444',
  '445544554455445544554455445543',
  '333333333333333333333333333333',
  '..3333333333333333333333333333',
]

/** The bell re-inked: `inks` maps 1–5 to this design's letters; `rows` overrides whole rows (a belt, an apron, a patch; placeholders allowed). */
export function bell(inks: { 1: string; 2: string; 3: string; 4: string; 5?: string }, rows: Readonly<Record<number, string>> = {}): string[] {
  const map: Record<string, string> = { 1: inks[1], 2: inks[2], 3: inks[3], 4: inks[4], 5: inks[5] ?? inks[3] }
  return BELL.map((row, i) => (rows[i] ?? row).replace(/[1-5]/g, (c) => map[c]))
}

/** Where every design stands on its 100 × 100 canvas (shared so the cards line up). */
export const AT = {
  shadow: [30, 68],
  feet: [41, 65],
  body: [34, 52],
  handB: [29, 58],
  handF: [66, 58],
} as const
