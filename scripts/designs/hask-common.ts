/**
 * Hask designs — the inks and the few parts every Hask shares (the snout, the
 * heavy tail, nub fists, ink stub legs, the ground shadow, the bell tunic).
 * Every ink is a colour of the old-CC0 Tiny Swords build (hask.ts audits each
 * one against the cached CC0 pack); nothing from the current download.
 *
 * Hask is Butcherblock's salter, a Reptilian of the salt marsh: reed green,
 * hide brown, bone and brine red. The reptile reads come from shared parts
 * the way the pack shares a body: a long flat snout under the brim (one eye
 * glint, no mouth parts), a scute ridge, and a heavy tail that lies along the
 * ground behind him (never down, so it never reads as a third leg).
 */

/** letter → colour. Each material is three tones (shade · mid · light), plus a dash. */
export const PAL: Readonly<Record<string, string>> = {
  // reptile skin: a marsh olive (the pack's tree / bush greens, warmer than the goblins' green)
  z: '#3d4f4d', g: '#5a7d53', G: '#728844', v: '#9bb94e', V: '#bdd763',
  // the eye
  y: '#ffed44',
  // bone (jaw, belly, bone toggles): the pack's skin / straw ramp
  c: '#977b6b', C: '#d5b583', d: '#efe1ab',
  // hide (raw hides, straps)
  h: '#5a4646', H: '#866353', i: '#b48355', I: '#dab570',
  // tanned leather (aprons, hats)
  a: '#6f5a48', A: '#9e7466', j: '#c5836e',
  // brine red (cloth, meat, stains)
  r: '#693d5b', R: '#b65555', Q: '#f76666', p: '#814248',
  // linen (shade · mid · light · dash)
  l: '#9e8776', b: '#c9aa8e', L: '#e1d4bd', m: '#fffce7',
  // dried reed / straw
  o: '#a38250', O: '#cea554', u: '#f1da84',
  // green reed (woven cloaks): olive mid, pale tip; shaded with the hide browns
  T: '#b3a645', U: '#dcdf71',
  // iron
  n: '#545962', N: '#737f8e', x: '#bac1c8',
  // dusk cloth (plum-grey)
  '1': '#433d5b', '2': '#585076', '3': '#796a86',
  // oilskin teal
  '4': '#2a485e', '5': '#4f7585', '6': '#83a2ac',
  // smoke
  '7': '#a6a199', '8': '#c3c1a6',
  // flame
  '9': '#ffed44', '0': '#f9856c', F: '#d9945f',
  // coin gold
  K: '#dcac48',
  // white dash
  w: '#ffffff',
}

/** Ink stub legs (the pack's: two nubs of ink), a little wider set for his weight. */
export const FEET = [
  'kkkkkk....kkkkkk',
  'kkkkkk....kkkkkk',
  'kkkkkk....kkkkkk',
  '.kkkkk....kkkkk',
  '.kkkkk....kkkkk',
  '.kkkk......kkkk',
  '..kkk......kkk',
]

/** The ground shadow, wide (it takes the tail too). */
export const SHADOW_W = [
  '..............ssssssssssssssssssssss',
  '.........ssssssssssssssssssssssssssssssss',
  '.....ssssssssssssssssssssssssssssssssssssssss',
  '...ssssssssssssssssssssssssssssssssssssssssssss',
  '..ssssssssssssssssssssssssssssssssssssssssssssss',
  '..ssssssssssssssssssssssssssssssssssssssssssssss',
  '...ssssssssssssssssssssssssssssssssssssssssssss',
  '.....ssssssssssssssssssssssssssssssssssssssss',
  '.........ssssssssssssssssssssssssssssssss',
  '..............ssssssssssssssssssssss',
]

/** A clawed nub fist, the back hand (shade on its back edge). */
export const FIST_B = ['.gGG', 'gGGGv', 'gGGGv', 'ggGGG', '.zgg']
/** A clawed nub fist, the front hand (lit on its top). */
export const FIST_F = ['.GvV', 'gGvvV', 'gGGvv', 'gGGGG', '.zgG']

/**
 * The tunic every Hask wears under his head mass: a low, heavy bell, broad at
 * the hem (he sits low on his hips like a lizard at rest). Placeholder inks:
 * d shade, m mid, l light, t hem trim; re-inked per design with {@link bell}.
 */
const BELL = [
  '......ddmmmmmmmmmmmmmmll',
  '.....ddmmmmmmmmmmmmmmmmll',
  '.....dddmmmmmmmmmmmmmmmll',
  '....dddmmmmmmmmmmmmmmmmmll',
  '....dddmmmmmmmmmmmmmmmmmll',
  '...ddddmmmmmmmmmmmmmmmmmmll',
  '...ddddmmmmmmdmmmmmmmmmmmll',
  '..ddddmmmmmmmdmmmmmmmmmmmmll',
  '..dddddmmmmmmdmmmmmmmmmdmmll',
  '.dddddmmmmmmmdmmmmmmmmmdmmmll',
  'dtttttttttttttttttttttttttttd',
  'ddddddddddddddddddddddddddddd',
  '..ddddddddddddddddddddddddd',
]

/** The bell tunic re-inked: `inks` maps d / m / l / t to this design's letters; `rows` overrides whole rows. */
export function bell(inks: { d: string; m: string; l: string; t: string }, rows: Readonly<Record<number, string>> = {}): string[] {
  return BELL.map((row, i) => rows[i] ?? row.replace(/[dmlt]/g, (c) => inks[c as 'd' | 'm' | 'l' | 't']))
}

/**
 * The head: the cheek and the long flat snout in ONE piece (no ink between,
 * so it reads as one head), its top tucked under each design's hat or hood.
 * A lit bridge dotted with scales, a nostril bulb at the tip, a dark mouth
 * seam from the cheek forward, and a pale lower jaw with belly-scale glints.
 * No teeth, no tongue: nothing at the mouth. The eye is placed per design,
 * in the shadow of the brim.
 */
export const SNOUT = [
  '..gGGGGGGGGGg.gvVv',
  '.gGGvvvvvvvvvGgvvvV',
  'gGGvvvvvvVvvvvVvvvvVV',
  'gGvvvvvvvvGvvvvGvvVvvVV',
  'gGGvvvvvvvvvvvvvvvvGvvvVv',
  'zgGGGGGGGGGGGGGGGGGGGGgvV',
  'zggGGGggGGGGGGggGGGGGGGGG',
  'zzggGGGGGGGGGGGGGGGGgGGGg',
  '.zzzgggggzzzzzzzzzzzzzzz',
  '..zzggggzCCCCdCCCCCdCCCc',
  '....zzzzzcccccccccccc',
]

/** The snout hung low (a stoop: the elder): the upper jaw droops past the lower. */
export const SNOUT_LOW = [
  '..gGGGGGGGGGg.gvVv',
  '.gGGvvvvvvvvvGgvvvV',
  'gGGvvvvvvVvvvvVvvvvV',
  'gGvvvvvvvvGvvvvGvvvvVV',
  'gGGvvvvvvvvvvvvvvvvGvvV',
  'zgGGGGGGGGGGGGGGGGGGGvvVv',
  'zggGGGggGGGGGGggGGGGGGgvV',
  'zzggGGGGGGGGGGGGGGGGgGGGG',
  '.zzzgggggzzzzzzzzzzzGGGGg',
  '..zzggggzCCCCdCCCCCzzzzz',
  '....zzzzzcccccccccc',
]

/**
 * The heavy tail: thick at the hip, lying along the ground behind him, its
 * tip curled up and back (never down, so it never reads as a leg). A row of
 * scutes along the top, scale dots on the flank, a pale belly underneath.
 * The base (its right end) tucks behind the tunic.
 */
export const TAIL = [
  '..GvG...................',
  '.gGvVG..................',
  'gGGvGg..................',
  'gGGGGg.......vV....vV...',
  'ggGGGG....vV.GvG..GvGGGG',
  '.ggGGGGGGGGvGGGGGGGGGGGG',
  '.zggGGGGGGGGGGGGggGGGGGG',
  '..zggGGGGggGGGGGGGGGGggG',
  '...zgggGGGGGGGGGGGGGGGGG',
  '....zzgggggggggggggggggg',
  '......zzzzzgggggggggCCCC',
  '...........zzzzzcccccccc',
]
/** The tip raised (the wind-up of a thump, or a swish). */
export const TAIL_UP = [
  '.GvG....................',
  'gGvVG...................',
  'gGGvGg..................',
  'gGGGGg.......vV....vV...',
  '.gGGGG....vV.GvG..GvGGGG',
  '.zgGGGGGGGGvGGGGGGGGGGGG',
  '..zggGGGGGGGGGGGggGGGGGG',
  '...zgGGGGggGGGGGGGGGGggG',
  '....zggGGGGGGGGGGGGGGGGG',
  '.....zzggggggggggggggggg',
  '.......zzzzzggggggggCCCC',
  '...........zzzzzcccccccc',
]
/** The tip flat on the ground (the thump). */
export const TAIL_DOWN = [
  '........................',
  '........................',
  '........................',
  '.............vV....vV...',
  '..........vV.GvG..GvGGGG',
  '..GvGGGGGGGvGGGGGGGGGGGG',
  '.gGVGGGGGGGGGGGGggGGGGGG',
  'gGGGGGGGGggGGGGGGGGGGggG',
  'zggGGGGGGGGGGGGGGGGGGGGG',
  '.zzggggggggggggggggggggg',
  '...zzzzzzzggggggggggCCCC',
  '...........zzzzzcccccccc',
]
