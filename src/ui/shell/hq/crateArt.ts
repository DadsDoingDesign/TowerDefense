import { OUTLINE, type Palette, type PixelRows } from '../../../game/data/pixelArt'

/**
 * The sealed crate, in pixels (Oct 2026): original art in the Tiny Swords
 * look — the `#161c2e` outline every sprite in the pack carries, warm planks,
 * slate iron at the corners with gold nails, and the red wax seal on the hasp
 * that names it "sealed". The old CC0 pack has no chest or crate, so this is
 * drawn here; nothing is imported from any pack.
 *
 * Two parts, so the lid can fly off when it bursts: the lid (32 × 9, its hasp
 * strap hanging over the seam) and the body (32 × 20). The canvas
 * (`crateStage.ts`) bakes them once; the screen draws the whole crate as SVG
 * (`ui/pixel.Pixel`) from {@link CRATE_ROWS}.
 */
export const CRATE_LID: PixelRows = [
  '..oooooooooooooooooooooooooooo..',
  '.ohhhllllllllllllllllllllllhhho.',
  'omymmwwWwwwwwwwwWwwwwwwwwWwmmymo',
  'ommmmwWwwwwwwwwWwwwwwwwwWwwmmmmo',
  'oooooooooooooooooooooooooooooooo',
  'ohhhhwwwwwwwwohmmmowwwwwwwwhhhho',
  'omymmddwwwwwdohmmmoddwwwwwdmmymo',
  'oMMMMWWWWWWWWohmmmoWWWWWWWWMMMMo',
  'oooooooooooooohmmmoooooooooooooo',
]
export const CRATE_BODY: PixelRows = [
  'ohhhhllllllllohmmmollllllllhhhho',
  'ohmmMwwwwwwwwohmmmowwwwwwwwhmmMo',
  'ohmmMwwwWWwwwohmmmowwwwwwwwhmmMo',
  'ohymMwwwwwwwwoooooowwwwwWwwhmyMo',
  'ohYmMWWWWWWWWorrrroWWWWWWWWhmYMo',
  'ohmmMdddddddorsrrrrodddddddhmmMo',
  'ohmmMlllllllorsrRrrolllllllhmmMo',
  'ohmmMwwwwwwworrRRrRowwwwwwwhmmMo',
  'ohmmMwwwwwwworrrrrRowwWWwwwhmmMo',
  'ohymMwwWwwwwwoRRRRowwwwwwwwhmyMo',
  'ohYmMWWWWWWWWWooooWWWWWWWWWhmYMo',
  'ohmmMddddddddorrrroddddddddhmmMo',
  'ohmmMllllllllorRRrollllllllhmmMo',
  'ohmmMwwwwwwwwwoRRowwwwwwwwwhmmMo',
  'ohmmMwwwwwWWwwwoowwwwwwwwwwhmmMo',
  'ohymMwwwwwwwwwwwwwwwwWWwwwwhmyMo',
  'ohYmMWWWWWWWWWWWWWWWWWWWWWWhmYMo',
  'ohmmMddddddddddddddddddddddhmmMo',
  'oMMMMWWWWWWWWWWWWWWWWWWWWWWMMMMo',
  '.oooooooooooooooooooooooooooooo.',
]
/** The whole crate, lid on: 32 × 29. */
export const CRATE_ROWS: PixelRows = [...CRATE_LID, ...CRATE_BODY]

export const CRATE_PALETTE: Palette = {
  o: OUTLINE,
  l: '#d6975a',
  w: '#b0763e',
  W: '#8a5a30',
  d: '#5c3a1f',
  h: '#b9bfcc',
  m: '#7a8194',
  M: '#454a5a',
  r: '#c8372d',
  R: '#7e1f1c',
  s: '#f27a62',
  y: '#f0c03a',
  Y: '#b58324',
}

/**
 * The home bar's mark for the sealed crates: the same crate at 16 × 12, drawn
 * at the sheet's double (32px) like every place's mark — the seal on its
 * hasp is what says "sealed" at that size.
 */
export const CRATE_MARK: PixelRows = [
  '.oooooooooooooo.',
  'ohllllllllllllho',
  'omwwwwwwwwwwwwmo',
  'omWWWWohmoWWWWmo',
  'ooooooohmooooooo',
  'ohllllohmollllho',
  'omwwwosrrrowwwmo',
  'omdddorrRRodddmo',
  'omlllloooollllmo',
  'omwwwwwwwwwwwwmo',
  'omWWWWWWWWWWWWmo',
  '.oooooooooooooo.',
]

/**
 * The chest grows with how many you open at once (the chest pass, Oct 2026;
 * presentation only — still one `openCrate` per crate): a wooden crate,
 * rope-lashed, for one or two; the iron-banded crate for three or four; a
 * gold-trimmed chest in dark red wood for five. The same rows in each, the
 * palette swapped, and a bigger scale on the screen.
 */
export type CrateLook = 'wood' | 'iron' | 'gold'
export const CRATE_LOOKS: Readonly<Record<CrateLook, Palette>> = {
  wood: { ...CRATE_PALETTE, h: '#c9925a', m: '#94622f', M: '#5c3a1f', y: '#d8c08a', Y: '#8a6a3a' },
  iron: CRATE_PALETTE,
  gold: { ...CRATE_PALETTE, l: '#b8643c', w: '#94482c', W: '#6e321f', d: '#4a1f14', h: '#fff0a0', m: '#e8b23a', M: '#9a6418', y: '#fff6c8', Y: '#c48a1e' },
}
/** Which chest a count of crates opened at once is drawn as. */
export const lookFor = (count: number): CrateLook => (count >= 5 ? 'gold' : count >= 3 ? 'iron' : 'wood')
/** CSS px per crate pixel on the screen, by look: the chest grows. */
export const LOOK_SCALE: Readonly<Record<CrateLook, number>> = { wood: 4, iron: 5, gold: 6 }
/** Each look's light: its glow, rays and sparks. */
export const LOOK_LIGHT: Readonly<Record<CrateLook, string>> = { wood: '#f0c03a', iron: '#f2e2b0', gold: '#ffd84a' }
/** Each look's name (its accessible name). */
export const LOOK_NAME: Readonly<Record<CrateLook, string>> = { wood: 'a wooden crate', iron: 'an iron-banded crate', gold: 'a gold-trimmed chest' }

/** The stage's stone plinth, 40 × 7, drawn under the chest. */
export const PLINTH: PixelRows = [
  '..oooooooooooooooooooooooooooooooooooo..',
  '.osssssssssssssssssssssssssssssssssssso.',
  'oSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSo',
  'oooooooooooooooooooooooooooooooooooooooo',
  'obbbbbbbobbbbbbbbbobbbbbbbbbobbbbbbbbbbo',
  'oBBBBBBBoBBBBBBBBBoBBBBBBBBBoBBBBBBBBBBo',
  '.oooooooooooooooooooooooooooooooooooooo.',
]
export const PLINTH_PALETTE: Palette = { o: OUTLINE, s: '#8f8a86', S: '#6d6864', b: '#5a5552', B: '#43403e' }
