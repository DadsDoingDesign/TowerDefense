/**
 * Odile designs — the inks and the few small parts the pack repeats on every
 * person (nub fists, ink stub legs, the ground shadow), plus the two parts
 * every Odile shares: the elf's leaf ears and the tall silk gown. All inks are
 * colours of the old-CC0 Tiny Swords build (the knights', the goblins', the
 * trees' and the barrels'); nothing from the current download. `PACK_INKS`
 * lists them and the measure refuses any other.
 */

/** letter → colour. Each material is a three-tone ramp (shade · mid · light), plus the pack's dashes. */
export const PAL: Readonly<Record<string, string>> = {
  // skin: the pack's own (the pawn's and knight's hands)
  e: '#977b6b', E: '#d5b583', F: '#efe1ab',
  // satin rose (the goblins' rose and the barrels' plum-rose)
  r: '#693d5b', R: '#ab6282', Q: '#c5836e',
  // plum (the purple barrel's ramp)
  p: '#433d5b', P: '#775396', i: '#a8719a',
  // spring green (the bushes' and goblins' greens)
  g: '#2f966a', G: '#38b251', v: '#95d562', V: '#bdd763',
  // silver hair (the rocks' pale ramp)
  a: '#506a69', A: '#669d9d', b: '#8cc3c4', B: '#d0deb5',
  // gold / brass (the torches' and the tree trunks')
  o: '#b48355', O: '#d9945f', y: '#ffed44',
  // wood (the trees')
  u: '#6f5a48', U: '#866353',
  // the knight's navy and teal
  n: '#404e75', N: '#3e8698', t: '#5ab3ac',
  // peach sheen (the goblins' light) and the pack's white dash
  j: '#ffcfb4', w: '#ffffff',
  // smoke grey (the torch goblins' dark)
  x: '#685757',
}

/** Every opaque colour an Odile may use: exactly the old-CC0 stills' palette entries above. */
export const PACK_INKS: readonly string[] = [
  '#161c2e', '#977b6b', '#d5b583', '#efe1ab', '#693d5b', '#ab6282', '#c5836e', '#433d5b', '#775396', '#a8719a',
  '#2f966a', '#38b251', '#95d562', '#bdd763', '#506a69', '#669d9d', '#8cc3c4', '#d0deb5', '#b48355', '#d9945f',
  '#ffed44', '#6f5a48', '#866353', '#404e75', '#3e8698', '#5ab3ac', '#ffcfb4', '#ffffff', '#685757',
]

/** Ink stub legs (the pack's: no colour, just two nubs of ink), a little longer under a gown. */
export const FEET = [
  'kkkkkk..kkkkkk',
  'kkkkkk..kkkkkk',
  '.kkkkk..kkkkk',
  '.kkkkk..kkkkk',
  '.kkkk....kkkk',
  '..kkk....kkk',
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
 * The elf's near ear (the right one: she faces right): a broad leaf reaching
 * out from under the head mass, its belly wide and its tip lifted, never a
 * thin spike (a spike reads as a horn). Lit along its top edge, the inner
 * fold a shade line along the belly.
 */
export const EAR_NEAR = [
  '............FF',
  '..........EEF',
  '.......EEEEEF',
  '....EEEEEEEF',
  '..eEEEeeEEF',
  'eeEEEeeEEE',
  'eeEeeEEEE',
  '.eeeEEE',
  '..eee',
]
/** The far ear (the left one), foreshortened behind the head: shorter, the same lifted tip. */
export const EAR_FAR = [
  'FF',
  'FEE',
  'FEEEEE',
  '.FEEEEEE',
  '..EEEeeEEe',
  '...EEEEeeee',
  '....EEEEeee',
  '......eee',
]

/**
 * The near cheek under a brim or a fringe: a sliver of face, the nose a point
 * to the right; no eyes, no mouth (the pack hides its faces).
 */
export const CHEEK = [
  'EEEEEEFF',
  'eEEEEEFFFF',
  'eEEEEEEFF',
  '.eEEEEEE',
  '..eeeEE',
]

/**
 * Hair flaring out from under a brim to the shoulders (the pawn's skirt of
 * hair), combed into four locks, a notch at the front for the cheek; the ears
 * come out through it. Its top two rows sit in the brim's shade. Placeholder
 * inks l / m / d, re-inked with {@link ink}.
 */
export const HAIR_FLARE = [
  '....mmmmmmmmmmmmmmmmmmmmmmmmdddddddddddd',
  '...mmmmdmmmmmmdmmmmmmmdmmmmdddddddddddd',
  '...lllmllllllmmlllllmmmllmmmmmmdmmmddd',
  '..lllmlllllllmllllllmllllmmmmmdmmmd',
  '..llmlllllllmlllllllmlllmmmmmmdmmd',
  '.lllmllllllmmlllllllmllmmmmdmmmdd',
  '.llmmlllllmmmllllllmmlmmmmmdmmmdd',
  'lllmmllllmmdmlllllmmdmmmmmmdmmmdd',
  'llmmdmlllmmdmmllllmmdmmmmmmddmmdd',
  'lmmmdmmlmmdmmmmllmmddmmmmmddmmdd',
  'mmmddmmmmddmmmmmmmdddmmmmddddmdd',
  '.mddd.mmddd.mmmmdd..mmmmdd.dddd',
  '..dd...ddd...mddd....dddd...dd',
]

/** Re-ink placeholder letters (every other letter is kept). */
export function ink(rows: readonly string[], map: Readonly<Record<string, string>>): string[] {
  return rows.map((r) => r.replace(/./g, (c) => map[c] ?? c))
}

/**
 * The gown every Odile wears under her head mass: a tall bell, narrow at the
 * shoulders and flared at the hem (an elf's taper; the pack's bodies are
 * small rounded masses, never boxes). Hand-drawn once in placeholder inks
 * (l light, m mid, d shade, t hem trim, f a fold) and re-inked per design with
 * {@link gown}, the way the pack reuses one body under its heads. Lit from the
 * upper left like every head mass; the folds run down from the waist.
 */
const GOWN = [
  '......lllllmmmmmdd',
  '......lllllmmmmmdd',
  '.....llllllmmmmmmdd',
  '.....lllllllmmmmmdd',
  '.....lllllllmmmmmdd',
  '....llllllllmmmmmmdd',
  '....lllllllmmmmmmmdd',
  '....llllllflmmmmmmdd',
  '...llllllflllmmmmmmdd',
  '...llllllflllmmmfmmdd',
  '..lllllllfllllmmfmmmdd',
  '..llllllfllllmmmfmmmdd',
  '.lllllllfllllmmmmfmmmdd',
  '.llllllflllllmmmmfmmmdd',
  'llllllflllllmmmmmmfmmmdd',
  'dttttttttttttttttttttttd',
  'dddddddddddddddddddddddd',
  '..dddddddddddddddddddd',
]

/** The gown re-inked: `inks` maps l / m / d / t / f to this design's letters; `rows` overrides whole rows (a sash, an apron). */
export function gown(inks: { l: string; m: string; d: string; t: string; f?: string }, rows: Readonly<Record<number, string>> = {}): string[] {
  const map = { ...inks, f: inks.f ?? inks.d }
  return GOWN.map((row, i) => rows[i] ?? row.replace(/[lmdtf]/g, (c) => map[c as 'l' | 'm' | 'd' | 't' | 'f']))
}

/** Lay hand-drawn patches over a part's rows (an apron, a sash, a pocket): each patch's '.' is see-through. */
export function over(rows: readonly string[], patches: readonly (readonly [number, number, readonly string[]])[]): string[] {
  const out = rows.map((r) => [...r])
  for (const [x, y, patch] of patches)
    patch.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch === '.') return
        const line = out[y + r]
        if (!line) return
        while (line.length <= x + c) line.push('.')
        line[x + c] = ch
      }),
    )
  return out.map((r) => r.join(''))
}
