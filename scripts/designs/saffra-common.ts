/**
 * Saffra designs — the inks and the few small parts the pack itself repeats on
 * every person (nub fists, ink stub legs, the ground shadow). All inks are
 * colours of the old-CC0 Tiny Swords build (the knights', the goblins', the
 * buildings'); nothing from the current download.
 */

/** letter → colour. Each material is three tones (shade · mid · light) plus a dash. */
export const PAL: Readonly<Record<string, string>> = {
  // skin: the pack's own (the pawn's and knight's hands)
  e: '#977b6b', E: '#d5b583', F: '#efe1ab',
  // ginger hair
  q: '#87465a', h: '#b16c4d', H: '#d9945f', j: '#ffcfb4',
  // ember red cloth (the goblins' red)
  r: '#693d5b', R: '#b65555', Q: '#f76666',
  // oxblood (the dark body under a light head, the pack's value plan)
  x: '#5e474e', X: '#87465a',
  // harvest gold cloth
  o: '#a38250', O: '#d08c41', g: '#dab570',
  // straw / brass
  a: '#866353', A: '#b48355', b: '#dab570', B: '#f5efa9',
  // burlap / wood
  u: '#5a4646', U: '#866353', V: '#b48355',
  // dark cloth (the knights' navy, sparingly)
  n: '#404e75', N: '#3e8698',
  // coin gold / flame
  y: '#ffed44', Y: '#fffce7',
  // linen
  l: '#9e8776', L: '#e1d4bd', m: '#fffce7',
  // white dash
  w: '#ffffff',
}

/** Ink stub legs (the pack's: no colour, just two nubs of ink). */
export const FEET = [
  'kkkkkk...kkkkkk',
  'kkkkkk...kkkkkk',
  'kkkkkk...kkkkkk',
  '.kkkkk...kkkkk',
  '.kkkkk...kkkkk',
  '.kkkk.....kkkk',
  '..kkk.....kkk',
]

/** The pack's ground shadow, medium (about the pawn's). */
export const SHADOW_M = [
  '.........ssssssssssssssssss',
  '.....ssssssssssssssssssssssssss',
  '...ssssssssssssssssssssssssssssss',
  '..ssssssssssssssssssssssssssssssss',
  '.ssssssssssssssssssssssssssssssssss',
  '.ssssssssssssssssssssssssssssssssss',
  '..ssssssssssssssssssssssssssssssss',
  '...ssssssssssssssssssssssssssssss',
  '.....ssssssssssssssssssssssssss',
  '.........ssssssssssssssssss',
]

/** A round fist, the back hand (shade on its back edge). */
export const FIST_L = ['.eeE', 'eeEEE', 'eeEEE', 'eeEEE', '.eeE']
/** A round fist, the front hand (lit on its top). */
export const FIST_R = ['.EEF', 'eEEFF', 'eEEEF', 'eEEEE', '.eeE']

/**
 * The tunic every Saffra wears under her head mass: a short bell, narrow at
 * the shoulders and flared at the hem (the pack's bodies are small rounded
 * masses, never boxes). Hand-drawn once in placeholder inks (d shade, m mid,
 * l light, t hem trim) and re-inked per design with {@link bell}, the way the
 * pack reuses one body under its heads.
 */
const BELL = [
  '.....ddmmmmmmmmmmmmll',
  '....ddmmmmmmmmmmmmmmll',
  '....dddmmmmmmmmmmmmmll',
  '...dddmmmmmmmmmmmmmmmll',
  '...dddmmmmmmmmmmmmmmmll',
  '..ddddmmmmmmmmmmmmmmmmll',
  '..ddddmmmmmdmmmmmmmmmmll',
  '.ddddmmmmmmdmmmmmmmmmmmll',
  '.dddddmmmmmdmmmmmmmmdmmll',
  'dddddmmmmmmdmmmmmmmmdmmmll',
  'dttttttttttttttttttttttttd',
  'dddddddddddddddddddddddddd',
  '..dddddddddddddddddddddd',
]

/** The bell tunic re-inked: `inks` maps d / m / l / t to this design's letters; `rows` overrides whole rows (a belt, an apron). */
export function bell(inks: { d: string; m: string; l: string; t: string }, rows: Readonly<Record<number, string>> = {}): string[] {
  return BELL.map((row, i) => rows[i] ?? row.replace(/[dmlt]/g, (c) => inks[c as 'd' | 'm' | 'l' | 't']))
}
