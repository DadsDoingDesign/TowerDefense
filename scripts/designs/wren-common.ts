/**
 * Wren designs — the inks and the small parts the pack repeats on every person
 * (nub fists, ink stub legs, the ground shadow, one short bell of a tunic).
 * Every ink is a colour of the old-CC0 Tiny Swords build as shipped in
 * public/assets/sprites/tinyswords/ and public/assets/deco/tinyswords/ (the
 * trees', bushes', rocks', knights' and goblins' ramps); nothing from the
 * current download.
 */

/** letter → colour. Each material is three tones (shade · mid · light) plus a dash. */
export const PAL: Readonly<Record<string, string>> = {
  // the pack's foliage ramp (pines and bushes): bottle jade to moss to lichen
  G: '#2a485e', g: '#27716f', j: '#2f966a', J: '#5ab659', i: '#bdd763',
  // deep moss (the deco shrubs)
  v: '#387253', V: '#529650', W: '#7cbb4e',
  // lichen / olive (the TNT goblin's cloth, the grass's dry blades)
  o: '#6f5a48', O: '#b3a645', P: '#dcdf71', p: '#9bb94e',
  // spore glow
  y: '#f4e341', Y: '#ffed44', z: '#ede6ac', w: '#ffffff',
  // glass / rock teal
  t: '#3e8698', T: '#5ab3ac', u: '#8cc3c4', U: '#d0deb5', q: '#669d9d', Q: '#506a69',
  // foxglove / cap purple
  a: '#433d5b', A: '#775396', b: '#a8719a', B: '#ab6282', c: '#693d5b',
  // red (sparingly)
  r: '#b65555', R: '#f76666',
  // skin (the pawn's hands)
  e: '#977b6b', E: '#d5b583', F: '#efe1ab',
  // the rosy gnome nose
  n: '#9e7466', N: '#c5836e', m: '#ffcfb4',
  // wood, wicker, leather (the pines' trunks)
  d: '#5a4646', D: '#866353', h: '#b48355', H: '#dab570', x: '#685757', X: '#8e7b67',
  // terracotta
  l: '#a55a50', L: '#cc804b', f: '#d9945f',
  // navy cloth (the knights')
  S: '#404e75',
  // pale grey (the deco stones)
  I: '#bcada7',
}

/** Ink stub legs, short: a gnome stands on two nubs. */
export const FEET = [
  'kkkkk...kkkkk',
  'kkkkk...kkkkk',
  'kkkkk...kkkkk',
  '.kkkk...kkkk',
  '..kkk...kkk',
]

/** The pack's ground shadow, a little under the pawn's. */
export const SHADOW = [
  '........ssssssssssssssss',
  '....ssssssssssssssssssssssss',
  '..ssssssssssssssssssssssssssss',
  '.ssssssssssssssssssssssssssssss',
  'ssssssssssssssssssssssssssssssss',
  'ssssssssssssssssssssssssssssssss',
  '.ssssssssssssssssssssssssssssss',
  '..ssssssssssssssssssssssssssss',
  '....ssssssssssssssssssssssss',
  '........ssssssssssssssss',
]

/** A wider ground shadow, for a broad body (the Flowerpot Potter). */
export const SHADOW_W = [
  '..........ssssssssssssssssssss',
  '.....ssssssssssssssssssssssssssssss',
  '..ssssssssssssssssssssssssssssssssssss',
  '.ssssssssssssssssssssssssssssssssssssss',
  'ssssssssssssssssssssssssssssssssssssssss',
  'ssssssssssssssssssssssssssssssssssssssss',
  '.ssssssssssssssssssssssssssssssssssssss',
  '..ssssssssssssssssssssssssssssssssssss',
  '.....ssssssssssssssssssssssssssssss',
  '..........ssssssssssssssssssss',
]

/** A round fist, the back hand (shade on its back edge). */
export const FIST_L = ['.eeE', 'eeEEE', 'eeEEE', 'eeEEE', '.eeE']
/** A round fist, the front hand (lit on its top). */
export const FIST_R = ['.EEF', 'eEEFF', 'eEEEF', 'eEEEE', '.eeE']

/**
 * The gnome's tunic: a short, round bell under the head mass, narrower than
 * the pawn's and two rows shorter (the people are tiny). Drawn once in
 * placeholder inks (d shade, m mid, l light, t hem trim, f a fold) and re-inked
 * per design with {@link bell}, the way the pack reuses one body under its
 * heads. As on the pawn's tunic, the far (left) side sits in the hat's shade
 * and the front (right) side, turned to the viewer, is the lit one.
 */
const BELL = [
  '......ddmmmmmmmmlll',
  '.....ddmmmmmmmmmmll',
  '....dddmmmmmmmmmmlll',
  '...dddmmmmfmmmmmmmll',
  '...dddmmmmfmmmmmmmlll',
  '..ddddmmmmfmmmmmfmmll',
  '..dddmmmmmfmmmmmfmmlll',
  '.ddddmmmmmfmmmmmfmmmll',
  'dttttttttttttttttttttd',
  'dddddddddddddddddddddd',
  '..dddddddddddddddddd',
]

/** The bell re-inked: `inks` maps d / m / l / t / f to this design's letters; `rows` overrides whole rows (a belt, an apron). */
export function bell(inks: { d: string; m: string; l: string; t: string; f?: string }, rows: Readonly<Record<number, string>> = {}): string[] {
  const map = { ...inks, f: inks.f ?? inks.d } as Record<string, string>
  return BELL.map((row, i) => rows[i] ?? row.replace(/[dmltf]/g, (c) => map[c]))
}
