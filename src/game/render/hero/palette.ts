/**
 * The hero builder's inks — every ramp is four tones (shade, mid, light,
 * specular) in the CC0 Tiny Swords build's own colours, measured off the
 * pack (`Warrior_Blue`, `Pawn_Blue`, `Archer_Blue`, the goblins, the tower
 * and the house). The pack shades every material in exactly three tones plus
 * a white specular dash, so a ramp is the whole vocabulary of a material.
 *
 * Added on purpose (the pack has no bare faces but the goblins'): the skin
 * ramps are built from pack colours too — `#d9945f` / `#ffcfb4` are the TNT
 * goblin's, `#e3c18c` / `#f5efa9` the house's plaster — only their grouping
 * into a ramp is ours. Nothing here is from the current (non-CC0) download.
 *
 * Pure data: no DOM.
 */

/** The pack's outline, the same on every Tiny Swords sprite. */
export const INK = '#161c2e'
/** The pack's ground shadow: the ink at alpha 80 (measured). */
export const SHADOW_ALPHA = 80

/** shade, mid, light, specular. */
export type Ramp = readonly [string, string, string, string]

export const RAMPS = {
  // ── the knights' own ──────────────────────────────────────────────────
  cream: ['#977b6b', '#d5b583', '#efe1ab', '#ffffff'],
  teal: ['#404e75', '#3e8698', '#5ab3ac', '#8fe2b9'],
  // ── the goblins' ──────────────────────────────────────────────────────
  red: ['#693d5b', '#b65555', '#f76666', '#ffcfb4'],
  green: ['#417168', '#38b251', '#95d562', '#c6f0db'],
  // ── the buildings' ────────────────────────────────────────────────────
  stone: ['#435b7d', '#448e9f', '#5ab9bb', '#8fe2b9'],
  wood: ['#5a4646', '#866353', '#b48355', '#dab570'],
  plaster: ['#8a6763', '#af8c79', '#e3c18c', '#f5efa9'],
  // ── the atlas / clan palette (`fw-icons`, `enemy-clans-art` MASTER) ──
  steel: ['#4f5e65', '#737f8e', '#bac1c8', '#ffffff'],
  iron: ['#394243', '#4f5e65', '#737f8e', '#bac1c8'],
  gold: ['#a38250', '#d08c41', '#ffed44', '#fffce7'],
  brass: ['#866353', '#b48355', '#dab570', '#f5efa9'],
  plum: ['#433d5b', '#775396', '#a8719a', '#e1d4bd'],
  rose: ['#87465a', '#b45076', '#d55869', '#f69e7d'],
  navy: ['#2a3e5d', '#404e75', '#3e8698', '#8cc3c4'],
  leaf: ['#276740', '#387253', '#38b251', '#95d562'],
  moss: ['#387253', '#417168', '#95d562', '#c6f0db'],
  aqua: ['#27716f', '#47aba9', '#8cc3c4', '#c6f0db'],
  ochre: ['#a38250', '#d08c41', '#dab570', '#fffce7'],
  oxblood: ['#5e474e', '#87465a', '#b65555', '#f69e7d'],
  bone: ['#9e8776', '#ccb88d', '#e1d4bd', '#fffce7'],
  linen: ['#9e8776', '#e1d4bd', '#fffce7', '#ffffff'],
  leather: ['#5a4646', '#6f5a48', '#866353', '#b48355'],
  hide: ['#685757', '#977b6b', '#c5836e', '#ffcfb4'],
  soot: ['#2a3e5d', '#394243', '#4f5e65', '#737f8e'],
  // ── skins (pack colours, grouped by us) ───────────────────────────────
  skinTan: ['#9e7466', '#d9945f', '#ffcfb4', '#fffce7'],
  skinUmber: ['#5a4646', '#866353', '#b48355', '#dab570'],
  skinRose: ['#c5836e', '#f69e7d', '#ffcfb4', '#fffce7'],
  skinPale: ['#af8c79', '#e3c18c', '#f5efa9', '#ffffff'],
  skinRuddy: ['#9e7466', '#c5836e', '#ffcfb4', '#fffce7'],
  scaleTeal: ['#435b7d', '#448e9f', '#5ab9bb', '#8fe2b9'],
  scaleOchre: ['#866353', '#a38250', '#dab570', '#f5efa9'],
  // ── hair ──────────────────────────────────────────────────────────────
  hairBrown: ['#5a4646', '#866353', '#b48355', '#dab570'],
  hairBlond: ['#a38250', '#dab570', '#efe1ab', '#fffce7'],
  hairGinger: ['#87465a', '#b16c4d', '#d9945f', '#ffcfb4'],
  hairBlack: ['#161c2e', '#2a3e5d', '#404e75', '#737f8e'],
  hairWhite: ['#737f8e', '#bac1c8', '#e1d4bd', '#ffffff'],
  hairSilver: ['#95809d', '#bac1c8', '#fffce7', '#ffffff'],
  // ── light, for tells (drawn without ink) ──────────────────────────────
  ember: ['#b16c4d', '#d9945f', '#ffed44', '#ffffff'],
  frost: ['#3e8698', '#8cc3c4', '#c6f0db', '#ffffff'],
  venom: ['#387253', '#38b251', '#95d562', '#e1f5c0'],
  glass: ['#47aba9', '#8cc3c4', '#c6f0db', '#ffffff'],
  white: ['#e1d4bd', '#fffce7', '#ffffff', '#ffffff'],
} as const satisfies Record<string, Ramp>

export type RampId = keyof typeof RAMPS
export const RAMP_IDS = Object.keys(RAMPS) as RampId[]
export const isRampId = (s: string): s is RampId => s in RAMPS

/** "#rrggbb" → [r, g, b]. */
export function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Every colour the builder can put on a hero (ink and the ramps). */
export function builderColours(): Set<string> {
  const out = new Set<string>([INK])
  for (const r of Object.values(RAMPS)) for (const c of r) out.add(c)
  return out
}
