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
